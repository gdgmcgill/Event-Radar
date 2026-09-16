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
 */

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

/** Every argument `.in()` was called with, across the whole test file. */
let inCalls: unknown[] = [];

/**
 * A chainable, awaitable stand-in for a PostgrestFilterBuilder. It is a plain
 * object with no `Symbol.iterator`, which is the property that matters: this is
 * what gets handed to `.in()` on the defect line.
 */
function createMockBuilder(resolved: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "gte", "lte", "order", "limit"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.in = jest.fn((_column: string, values: unknown) => {
    inCalls.push(values);
    // The real algorithm. Throws on a non-iterable, which is the defect.
    postgrestIn(values);
    return builder;
  });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolved).then(resolve);
  return builder;
}

let mockUser: { id: string } | null = null;
let mockRpcResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockTableResults: Map<string, { data: unknown; error: unknown }>;

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  rpc: jest.fn(() => Promise.resolve(mockRpcResult)),
  from: jest.fn((table: string) =>
    createMockBuilder(mockTableResults.get(table) ?? { data: null, error: null })
  ),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createRouteContext(eventId = "event-1") {
  return { params: Promise.resolve({ id: eventId }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

let GET: any;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  inCalls = [];
  mockUser = { id: "user-1" };
  mockRpcResult = { data: null, error: null };
  mockTableResults = new Map();

  const mod = await import("@/app/api/events/[id]/friends/route");
  GET = mod.GET;
});

describe("DEFECT F-071 — the builder passed where an array is required", () => {
  it("the mechanism: a PostgREST builder is not iterable, so Set() rejects it", () => {
    const builder = createMockBuilder({ data: null, error: null });

    expect(Symbol.iterator in builder).toBe(false);
    expect(() => postgrestIn(builder)).toThrow(TypeError);

    // For contrast, the shape the call site was supposed to produce:
    expect(postgrestIn(["a", "b"])).toBe("a,b");
  });

  it("the happy path is unaffected — when the RPC succeeds the fallback never runs", async () => {
    mockRpcResult = {
      data: [{ id: "friend-1", name: "Friend One", avatar_url: null }],
      error: null,
    };

    const res = await GET({} as any, createRouteContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.friends).toHaveLength(1);
    // The fallback was never entered, so `.in()` was never reached.
    expect(inCalls).toHaveLength(0);
  });

  it("the fallback path receives a query builder, not an array of ids", async () => {
    mockRpcResult = { data: null, error: { message: "function does not exist" } };

    await GET({} as any, createRouteContext());

    expect(inCalls).toHaveLength(1);
    const passed = inCalls[0] as Record<string, unknown>;

    // This is the defect, stated as an assertion. The day it is fixed, the
    // argument becomes an array of ids and these three lines go red.
    expect(Array.isArray(passed)).toBe(false);
    expect(typeof passed.select).toBe("function");
    expect(typeof passed.eq).toBe("function");
  });

  it("today's behaviour: the fallback throws and the handler answers with an empty list", async () => {
    mockRpcResult = { data: null, error: { message: "function does not exist" } };
    // Even with saved_events ready to return rows, none of them are reached:
    // `.in()` throws before the query is ever awaited.
    mockTableResults.set("saved_events", {
      data: [{ user_id: "friend-1", users: { id: "friend-1", name: "Friend One", avatar_url: null } }],
      error: null,
    });

    const res = await GET({} as any, createRouteContext());
    const body = await res.json();

    // 200, not 500: the TypeError is swallowed by the handler's outer catch.
    // A caller cannot tell this apart from "this event has no friends going".
    expect(res.status).toBe(200);
    expect(body).toEqual({ friends: [], count: 0 });

    // Exactly two `from()` calls, in this order: the saved_events query, then
    // the user_follows builder that becomes the bad `.in()` argument. The THIRD
    // call the handler would make — the reverse-follow query that computes
    // mutuality — never happens, because `.in()` throws before it.
    expect(mockSupabase.from.mock.calls.map((c) => c[0])).toEqual([
      "saved_events",
      "user_follows",
    ]);
  });

  it("an unauthenticated caller short-circuits before any of this", async () => {
    mockUser = null;

    const res = await GET({} as any, createRouteContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ friends: [], count: 0 });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
