/**
 * DEFECT characterization — F-071
 *
 * Subject: `src/app/api/events/[id]/friends/route.ts`, the fallback path taken
 * when the `get_friends_going_to_event` RPC errors.
 *
 * The defect: line 48 passes a PostgREST **query builder** to `.in("user_id", …)`
 * where an array of ids is required. `(supabase as any)` erased the client type
 * — including the argument types of `.in()` — so the compiler never saw it. It
 * is the last cast under `src/app/api/events/` and the one cast this plan
 * deliberately did NOT remove, because removing it forces a behaviour change.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins what the handler does TODAY. It passes today
 *     and is expected to keep passing until the fixing slice lands.
 *   - It is NOT a failing test, and it is NOT a fix. Phase 4's event-and-friends
 *     slice owns the correction; when that slice changes the behaviour these
 *     assertions will move, deliberately and visibly, instead of the change
 *     going unnoticed.
 *
 * Why the mock reimplements `.in()` rather than stubbing it: the defect lives in
 * postgrest-js's own argument handling, so a `jest.fn()` that records its
 * arguments would prove nothing. `postgrestIn` below is the real algorithm,
 * transcribed from node_modules/@supabase/postgrest-js/dist/cjs/
 * PostgrestFilterBuilder.js:
 *
 *     in(column, values) {
 *       const cleanedValues = Array.from(new Set(values)).map(…).join(',')
 *       this.url.searchParams.append(column, `in.(${cleanedValues})`)
 *       return this
 *     }
 *
 * `new Set(x)` requires `x` to be iterable. A builder is not. That is the whole
 * bug, and it is why the transport is mocked but the argument handling is not.
 *
 * Registered as F-071 in .planning/audit/findings.json. Closes in Phase 4.
 *
 * Status: FIXED in 04-05, by the commit `fix(04-05): pass follower ids to
 * .in() in the friends fallback (F-071)`. The fallback now awaits the caller's
 * `user_follows` read first and passes `.in("user_id", …)` an ARRAY of the
 * followed ids (empty when the read returns nothing), and the client cast is
 * gone: it was the last one under `src/app/api/`. In that same commit the
 * defect-path assertions MOVED. "`.in()` receives a builder" became "`.in()`
 * receives the caller's followed ids". "The fallback throws, answers
 * `{ friends: [], count: 0 }` and never issues the reverse-follow query" became
 * "the reverse-follow query is issued and the response is the mutual follows
 * with a matching count". Both old assertions went red against the fix before
 * they moved (`evidence/defect-ledger.md`). The mechanism test (a builder is
 * not iterable) stays as a documented historical fact, and `postgrestIn` still
 * runs on every `.in()` argument, so a builder there would still throw. The
 * file keeps its tag and its F-071 citation so the history stays readable.
 *
 * One more assertion moved in 05-06, for a different finding: the
 * unauthenticated case pinned the anonymous 200 `{ friends: [], count: 0 }`,
 * and F-028 (DEC-39) makes it 401 `{"error":"Unauthorized"}`. It moved in
 * the commit `fix(05-06): four personalized routes answer anonymous callers
 * 401 (F-028)`, with a ledger row.
 */

import { NextRequest } from "next/server";

// ─── Mocks ──────────────────────────────────────────────────────────────────

/**
 * postgrest-js's `.in()`, transcribed. Throws exactly where the real one throws
 * when handed a non-iterable.
 */
function postgrestIn(values: unknown): string {
  return Array.from(new Set(values as Iterable<unknown>))
    .map((s) => `${s}`)
    .join(",");
}

type MockResult = { data: unknown; error: unknown };
type EqCall = { table: string; column: string; value: unknown };

/** Every argument `.in()` was called with, across the whole test file. */
let inCalls: unknown[] = [];

/** Every `.eq()` filter, in call order, tagged with the table it applied to. */
let eqCalls: EqCall[] = [];

/**
 * A chainable, awaitable stand-in for a PostgrestFilterBuilder. It is a plain
 * object with no `Symbol.iterator`, which is the property that matters: that is
 * what used to be handed to `.in()` on the defect line.
 *
 * The result is resolved lazily from the `.eq()` filters seen so far, so the
 * two `user_follows` reads (the caller's follows, then the reverse follows) can
 * answer differently.
 */
function createMockBuilder(
  table: string,
  resolve: (eqs: EqCall[]) => MockResult
): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const eqs: EqCall[] = [];
  for (const method of ["select", "neq", "gte", "lte", "order", "limit"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.eq = jest.fn((column: string, value: unknown) => {
    const call = { table, column, value };
    eqs.push(call);
    eqCalls.push(call);
    return builder;
  });
  builder.in = jest.fn((_column: string, values: unknown) => {
    inCalls.push(values);
    // The real algorithm. Throws on a non-iterable, which was the defect.
    postgrestIn(values);
    return builder;
  });
  // Terminal read used by createRequestContext()'s profile lookup (added in
  // 04-05 when the handler adopted the seam). It resolves to the table's
  // result like every other read here; no assertion depends on the profile.
  builder.single = jest.fn(() => Promise.resolve(resolve(eqs)));
  builder.then = (onFulfilled: (value: MockResult) => unknown) =>
    Promise.resolve(resolve(eqs)).then(onFulfilled);
  return builder;
}

const EMPTY: MockResult = { data: null, error: null };

let mockUser: { id: string } | null = null;
let mockRpcResult: MockResult = EMPTY;
/**
 * Results keyed by table, or by `table.eqColumn` for the first `.eq()` column,
 * which is how the two `user_follows` reads are told apart:
 * `user_follows.follower_id` (whom the caller follows) and
 * `user_follows.following_id` (who follows the caller).
 */
let mockTableResults: Map<string, MockResult>;

function resolveTable(table: string, eqs: EqCall[]): MockResult {
  const first = eqs[0]?.column;
  return (
    (first !== undefined ? mockTableResults.get(`${table}.${first}`) : undefined) ??
    mockTableResults.get(table) ??
    EMPTY
  );
}

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  rpc: jest.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(mockRpcResult)),
  from: jest.fn((table: string) =>
    createMockBuilder(table, (eqs) => resolveTable(table, eqs))
  ),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const CALLER_ID = "user-1";
const EVENT_ID = "event-1";

function createRouteContext(eventId = EVENT_ID) {
  return { params: Promise.resolve({ id: eventId }) };
}

function createRequest(eventId = EVENT_ID): NextRequest {
  return new NextRequest(`http://localhost:3000/api/events/${eventId}/friends`);
}

function friend(id: string) {
  return { id, name: `Friend ${id}`, avatar_url: null };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

type FriendsGet = (typeof import("@/app/api/events/[id]/friends/route"))["GET"];
let GET: FriendsGet;

// The fallback now logs each failure it degrades over (WR-02, Phase 4 code
// review). The suite drives the RPC-error path on purpose, so the log lines
// are expected; silence them without asserting on them.
let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.resetModules();
  jest.clearAllMocks();
  inCalls = [];
  eqCalls = [];
  mockUser = { id: CALLER_ID };
  mockRpcResult = EMPTY;
  mockTableResults = new Map();

  const mod = await import("@/app/api/events/[id]/friends/route");
  GET = mod.GET;
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("DEFECT F-071 (fixed in 04-05) — the fallback passes an array of followed ids", () => {
  it("the mechanism, kept as history: a PostgREST builder is not iterable, so Set() rejects it", () => {
    const builder = createMockBuilder("user_follows", () => EMPTY);

    expect(Symbol.iterator in builder).toBe(false);
    expect(() => postgrestIn(builder)).toThrow(TypeError);

    // For contrast, the shape the call site now produces:
    expect(postgrestIn(["a", "b"])).toBe("a,b");
  });

  it("the happy path is unaffected — when the RPC succeeds the fallback never runs", async () => {
    mockRpcResult = {
      data: [{ id: "friend-1", name: "Friend One", avatar_url: null }],
      error: null,
    };

    const res = await GET(createRequest(), createRouteContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.friends).toHaveLength(1);
    // The fallback was never entered, so `.in()` was never reached.
    expect(inCalls).toHaveLength(0);
  });

  it("the fallback path passes .in() an array of the caller's followed ids", async () => {
    mockRpcResult = { data: null, error: { message: "function does not exist" } };
    mockTableResults.set("user_follows.follower_id", {
      data: [{ following_id: "friend-1" }, { following_id: "friend-2" }],
      error: null,
    });

    await GET(createRequest(), createRouteContext());

    expect(inCalls).toHaveLength(1);
    const passed = inCalls[0];

    // Moved from `Array.isArray(passed) === false` and a builder's select/eq.
    expect(Array.isArray(passed)).toBe(true);
    expect(passed).toEqual(["friend-1", "friend-2"]);

    // The ids come from the caller's follows, scoped to the caller.
    expect(eqCalls).toContainEqual({
      table: "user_follows",
      column: "follower_id",
      value: CALLER_ID,
    });
  });

  it("the fallback issues the reverse-follow query and answers with the mutual follows and a matching count", async () => {
    mockRpcResult = { data: null, error: { message: "function does not exist" } };
    // The caller follows friend-1 and friend-2 ...
    mockTableResults.set("user_follows.follower_id", {
      data: [{ following_id: "friend-1" }, { following_id: "friend-2" }],
      error: null,
    });
    // ... both of whom saved the event (what `.in()` over those ids returns) ...
    mockTableResults.set("saved_events", {
      data: [
        { user_id: "friend-1", users: friend("friend-1") },
        { user_id: "friend-2", users: friend("friend-2") },
      ],
      error: null,
    });
    // ... but only friend-1 follows the caller back (friend-3 is not followed).
    mockTableResults.set("user_follows.following_id", {
      data: [{ follower_id: "friend-1" }, { follower_id: "friend-3" }],
      error: null,
    });

    const res = await GET(createRequest(), createRouteContext());
    const body = await res.json();

    // Moved from `{ friends: [], count: 0 }` (the swallowed TypeError).
    expect(res.status).toBe(200);
    expect(body).toEqual({ friends: [friend("friend-1")], count: 1 });

    // Moved from "exactly saved_events then user_follows; the reverse-follow
    // query never happens". After the context's profile read: the caller's
    // follows, the saved_events read, then the reverse-follow read.
    expect(mockSupabase.from.mock.calls.map((c) => c[0])).toEqual([
      "users",
      "user_follows",
      "saved_events",
      "user_follows",
    ]);
    expect(eqCalls).toContainEqual({
      table: "user_follows",
      column: "following_id",
      value: CALLER_ID,
    });
    expect(eqCalls).toContainEqual({
      table: "saved_events",
      column: "event_id",
      value: EVENT_ID,
    });
  });

  it("a caller who follows nobody passes an empty array and answers with nobody", async () => {
    mockRpcResult = { data: null, error: { message: "function does not exist" } };

    const res = await GET(createRequest(), createRouteContext());
    const body = await res.json();

    expect(inCalls).toEqual([[]]);
    expect(res.status).toBe(200);
    expect(body).toEqual({ friends: [], count: 0 });
  });

  it("an unauthenticated caller short-circuits before any of this", async () => {
    mockUser = null;

    const res = await GET(createRequest(), createRouteContext());
    const body = await res.json();

    // Moved in 05-06 (F-028, DEC-39): was 200 { friends: [], count: 0 }.
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
