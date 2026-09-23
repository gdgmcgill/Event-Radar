/**
 * GET /api/events — the cursor pagination contract (DEC-25, F-083).
 *
 * PRESERVE, from plan 04-09 on: this suite is the decided contract between
 * `src/hooks/useEvents.ts` and the route, and every later refactor of the
 * event read path must keep it green. Until plan 04-09 it was a skipped
 * describe titled "tests written for
 * cursor-based route that no longer exists": the hook paged by cursor, the
 * route ignored the cursor, and "Load More" on `/` never rendered (F-083).
 * It was REWRITTEN against DEC-25 rather than revived against the route as it
 * stood. Phase 1's rule T-01-11-04 forbids the latter, because recording broken
 * behaviour as the contract would launder a defect into a specification.
 *
 * The contract, as specified here:
 *
 *   - every request orders by `start_date` ascending, then `id` ascending;
 *   - page mode (no cursor) is unchanged: `range((page-1)*limit, page*limit-1)`
 *     with `total`, `page`, `limit` and `totalPages` from the one query's count.
 *     It emits `nextCursor` naming the last returned row while rows remain,
 *     and `prevCursor` is null;
 *   - cursor mode adds the keyset `or()` "after (sortValue, id)", with both
 *     values double-quoted, asks for rows 0 through limit-1, and emits
 *     `nextCursor` when more rows follow and `prevCursor` naming the first
 *     returned row. `total` comes from a separate head count carrying every
 *     filter except the keyset, so it counts all matching events regardless
 *     of cursor;
 *   - a cursor `decodeEventCursor` rejects is 400 `{ error: "Invalid cursor" }`,
 *     and nothing is queried;
 *   - the fuzzy-rank path (dead today, F-078) and every early return emit
 *     null cursors;
 *   - every `data.<field>` that `useEvents.ts` reads is a key of the response.
 *     This is derived from the hook's source at test time, so the two sides
 *     cannot drift apart silently again.
 *
 * Dropped from the old suite: the `before` test. No client sends `before`,
 * and DEC-25 leaves it (and `sort`, `direction`, `clubId`) unimplemented.
 *
 * Why a recording mock and not the in-memory fake: the fake records an `or()`
 * without evaluating it, so it cannot return "the rows after the cursor". Here
 * each query's result is set by the test, standing in for a PostgREST that
 * applied the keyset, and the queries the route builds are asserted from the
 * recorded calls. The traversal itself (the rows after the cursor, with and
 * without a search `or()`) is proven against the real local PostgREST by
 * `e2e/specs/event-read-path.spec.ts`. Page-mode rows are pinned behaviourally
 * by `src/__tests__/api/events/events-list-characterization.test.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ─── Recording Supabase mock ────────────────────────────────────────────────

interface RecordedCall {
  method: string;
  args: unknown[];
}

interface RecordedQuery {
  table: string;
  head: boolean;
  calls: RecordedCall[];
}

interface MainResult {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
  count: number | null;
}

interface CountResult {
  count: number | null;
  error: { code?: string; message: string } | null;
}

interface RpcResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const BUILDER_METHODS = [
  "select",
  "order",
  "eq",
  "is",
  "in",
  "overlaps",
  "or",
  "gte",
  "lte",
  "range",
] as const;

let mockQueries: RecordedQuery[];
let mockRpcCalls: Array<{ name: string; args: unknown }>;
let mainResult: MainResult;
let countResult: CountResult;
let rpcResults: Record<string, RpcResult>;

function mockBuilder(table: string): Record<string, unknown> {
  const recorded: RecordedQuery = { table, head: false, calls: [] };
  mockQueries.push(recorded);
  const builder: Record<string, unknown> = {};
  for (const method of BUILDER_METHODS) {
    builder[method] = (...args: unknown[]) => {
      recorded.calls.push({ method, args });
      if (method === "select") {
        const options = args[1] as { head?: boolean } | undefined;
        recorded.head = options?.head === true;
      }
      return builder;
    };
  }
  builder.then = (
    onfulfilled: (value: unknown) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) =>
    Promise.resolve(
      recorded.head ? { data: null, ...countResult } : mainResult
    ).then(onfulfilled, onrejected);
  return builder;
}

const mockClient = {
  from: (table: string) => mockBuilder(table),
  rpc: (name: string, args: unknown) => {
    mockRpcCalls.push({ name, args });
    return Promise.resolve(
      rpcResults[name] ?? { data: null, error: { message: `no rpc ${name}` } }
    );
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockClient),
}));

jest.mock("@/lib/tagMapping", () => ({
  transformEventFromDB: (event: unknown) => event,
}));

jest.mock("@/lib/timezone", () => ({
  ...jest.requireActual<typeof import("@/lib/timezone")>("@/lib/timezone"),
  getESTNowISO: () => "2026-01-15T12:00:00.000Z",
}));

// ─── Fixtures and helpers ───────────────────────────────────────────────────

const UUID = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
];

const START = [
  "2026-02-01T10:00:00+00:00",
  "2026-02-02T10:00:00+00:00",
  "2026-02-03T10:00:00+00:00",
  "2026-02-04T10:00:00+00:00",
  "2026-02-05T10:00:00+00:00",
];

/** Event n (1-based), as PostgREST returns a row. */
const buildEvent = (n: number) => ({
  id: UUID[n - 1],
  title: `Event ${n}`,
  start_date: START[n - 1],
  created_at: START[n - 1],
});

/** The old suite's helpers, kept: base64 of JSON { sortValue, id }. */
const encodeCursor = (payload: { sortValue: string; id: string }) =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

const decodeCursor = (cursor: string) =>
  JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as {
    sortValue: string;
    id: string;
  };

const cursorAt = (n: number) => encodeCursor({ sortValue: START[n - 1], id: UUID[n - 1] });

interface ListBody {
  events: Array<{ id: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
  error?: string;
}

async function get(query: string) {
  const response = await GET(new NextRequest(`http://localhost/api/events${query}`));
  const body = (await response.json()) as ListBody;
  return { response, body };
}

const mainQuery = () => mockQueries.find((q) => q.table === "events" && !q.head);
const headQuery = () => mockQueries.find((q) => q.table === "events" && q.head);
const callsOf = (query: RecordedQuery | undefined, method: string) =>
  (query?.calls ?? []).filter((c) => c.method === method).map((c) => c.args);

/** The filter calls of a query, i.e. everything but select, order and range. */
const filterCalls = (query: RecordedQuery | undefined) =>
  (query?.calls ?? []).filter(
    (c) => !["select", "order", "range"].includes(c.method)
  );

beforeEach(() => {
  mockQueries = [];
  mockRpcCalls = [];
  mainResult = { data: [], error: null, count: 0 };
  countResult = { count: 0, error: null };
  rpcResults = {};
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Ordering ───────────────────────────────────────────────────────────────

describe("GET /api/events — ordering", () => {
  it("orders by start_date ascending, then id ascending, in page and cursor mode", async () => {
    await get("?limit=2");
    await get(`?limit=2&cursor=${encodeURIComponent(cursorAt(2))}`);
    const mains = mockQueries.filter((q) => !q.head);
    expect(mains).toHaveLength(2);
    for (const query of mains) {
      expect(callsOf(query, "order")).toEqual([
        ["start_date", { ascending: true }],
        ["id", { ascending: true }],
      ]);
    }
  });
});

// ─── Page mode ──────────────────────────────────────────────────────────────

describe("GET /api/events — page mode (no cursor)", () => {
  it("returns nextCursor on the first page when more results exist, naming the last returned row", async () => {
    mainResult = { data: [buildEvent(1), buildEvent(2)], error: null, count: 3 };

    const { response, body } = await get("?limit=2");

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.prevCursor).toBeNull();
    expect(body.nextCursor).toBeTruthy();
    expect(decodeCursor(String(body.nextCursor))).toEqual({
      sortValue: START[1],
      id: UUID[1],
    });
  });

  it("keeps the OFFSET window, the count-derived totals, and issues exactly one query", async () => {
    mainResult = { data: [buildEvent(3), buildEvent(4)], error: null, count: 5 };

    const { body } = await get("?page=2&limit=2");

    expect(mockQueries).toHaveLength(1);
    expect(callsOf(mainQuery(), "range")).toEqual([[2, 3]]);
    expect(callsOf(mainQuery(), "or")).toEqual([]);
    expect(body).toMatchObject({ total: 5, page: 2, limit: 2, totalPages: 3 });
    expect(decodeCursor(String(body.nextCursor)).id).toBe(UUID[3]);
  });

  it("emits a null nextCursor on the last page", async () => {
    mainResult = { data: [buildEvent(5)], error: null, count: 5 };

    const { body } = await get("?page=3&limit=2");

    expect(body.events).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
    expect(body.prevCursor).toBeNull();
  });

  it("treats an empty cursor parameter as absent", async () => {
    mainResult = { data: [buildEvent(1)], error: null, count: 1 };

    const { response } = await get("?limit=2&cursor=");

    expect(response.status).toBe(200);
    expect(callsOf(mainQuery(), "range")).toEqual([[0, 1]]);
    expect(headQuery()).toBeUndefined();
  });
});

// ─── Cursor mode ────────────────────────────────────────────────────────────

describe("GET /api/events — cursor mode", () => {
  it("returns prevCursor for the first row and a null nextCursor at the end", async () => {
    // PostgREST applied the keyset: rows 3 and 4 are all that follow row 2.
    mainResult = { data: [buildEvent(3), buildEvent(4)], error: null, count: 2 };
    countResult = { count: 4, error: null };

    const { response, body } = await get(`?limit=2&cursor=${encodeURIComponent(cursorAt(2))}`);

    expect(response.status).toBe(200);
    expect(body.events.map((e) => e.id)).toEqual([UUID[2], UUID[3]]);
    expect(body.nextCursor).toBeNull();
    expect(body.prevCursor).toBeTruthy();
    expect(decodeCursor(String(body.prevCursor))).toEqual({
      sortValue: START[2],
      id: UUID[2],
    });
  });

  it("returns nextCursor for the last row when more rows follow the page", async () => {
    // Rows 2 to 5 follow row 1; the page holds the first two of them.
    mainResult = { data: [buildEvent(2), buildEvent(3)], error: null, count: 4 };
    countResult = { count: 5, error: null };

    const { body } = await get(`?limit=2&cursor=${encodeURIComponent(cursorAt(1))}`);

    expect(decodeCursor(String(body.nextCursor))).toEqual({
      sortValue: START[2],
      id: UUID[2],
    });
    expect(decodeCursor(String(body.prevCursor)).id).toBe(UUID[1]);
  });

  it("adds a keyset or() on (start_date, id) with both values double-quoted, and asks for rows 0 through limit-1", async () => {
    mainResult = { data: [buildEvent(3)], error: null, count: 1 };
    countResult = { count: 3, error: null };

    await get(`?limit=2&cursor=${encodeURIComponent(cursorAt(2))}`);

    expect(callsOf(mainQuery(), "or")).toEqual([
      [
        `start_date.gt."${START[1]}",and(start_date.eq."${START[1]}",id.gt."${UUID[1]}")`,
      ],
    ]);
    expect(callsOf(mainQuery(), "range")).toEqual([[0, 1]]);
  });

  it("takes total from the head count with every filter except the keyset, not from the remaining count", async () => {
    mainResult = { data: [buildEvent(4)], error: null, count: 1 };
    countResult = { count: 4, error: null };

    const { body } = await get(`?limit=2&cursor=${encodeURIComponent(cursorAt(3))}`);

    expect(body.total).toBe(4);
    expect(body.totalPages).toBe(2);
    const head = headQuery();
    expect(callsOf(head, "select")).toEqual([["id", { count: "exact", head: true }]]);
    expect(callsOf(head, "or")).toEqual([]);
    expect(callsOf(head, "range")).toEqual([]);
    const mainFilters = filterCalls(mainQuery());
    expect(filterCalls(head)).toEqual(mainFilters.slice(0, -1));
    expect(mainFilters[mainFilters.length - 1].method).toBe("or");
  });

  it("applies the search fallback's or() to both queries, and the keyset or() to the main query only", async () => {
    rpcResults = {
      search_events_fuzzy: { data: null, error: { message: "function does not exist" } },
    };
    mainResult = { data: [buildEvent(2)], error: null, count: 1 };
    countResult = { count: 2, error: null };

    await get(`?limit=1&tags=academic&search=Seed&cursor=${encodeURIComponent(cursorAt(1))}`);

    const mainOrs = callsOf(mainQuery(), "or").map(([arg]) => String(arg));
    expect(mainOrs).toHaveLength(2);
    expect(mainOrs[0]).toContain("title.ilike.");
    expect(mainOrs[1]).toContain(`id.gt."${UUID[0]}"`);
    expect(callsOf(headQuery(), "or")).toEqual([[mainOrs[0]]]);
    expect(callsOf(headQuery(), "overlaps")).toEqual([["tags", ["academic"]]]);
  });

  it("returns 500 when the total count fails", async () => {
    mainResult = { data: [buildEvent(2)], error: null, count: 1 };
    countResult = { count: null, error: { message: "count failed" } };

    const { response, body } = await get(`?limit=1&cursor=${encodeURIComponent(cursorAt(1))}`);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch events" });
  });
});

// ─── Invalid cursors ────────────────────────────────────────────────────────

describe("GET /api/events — invalid cursors", () => {
  it.each<[string, string]>([
    ["not-a-valid-cursor", "not-a-valid-cursor"],
    ["a non-UUID id", encodeCursor({ sortValue: START[0], id: "evt-1" })],
    ["a sortValue that is not a date", encodeCursor({ sortValue: "soon", id: UUID[0] })],
    [
      "a sortValue carrying a filter injection",
      encodeCursor({ sortValue: `${START[0]},status.eq.pending`, id: UUID[0] }),
    ],
  ])("rejects %s with 400 Invalid cursor, before any query", async (_label, cursor) => {
    const { response, body } = await get(`?cursor=${encodeURIComponent(cursor)}`);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid cursor" });
    expect(mockQueries).toEqual([]);
    expect(mockRpcCalls).toEqual([]);
  });
});

// ─── Null cursors ───────────────────────────────────────────────────────────

describe("GET /api/events — paths that emit null cursors", () => {
  it("the fuzzy-rank path emits null cursors and ignores a cursor (no keyset, no head count)", async () => {
    rpcResults = {
      search_events_fuzzy: {
        data: [
          { event_id: UUID[1], rank: 0.9 },
          { event_id: UUID[0], rank: 0.5 },
        ],
        error: null,
      },
    };
    mainResult = { data: [buildEvent(1), buildEvent(2)], error: null, count: 3 };

    const { body } = await get(`?limit=2&search=seed&cursor=${encodeURIComponent(cursorAt(1))}`);

    expect(body.events.map((e) => e.id)).toEqual([UUID[1], UUID[0]]);
    expect(body.nextCursor).toBeNull();
    expect(body.prevCursor).toBeNull();
    expect(callsOf(mainQuery(), "or")).toEqual([]);
    expect(headQuery()).toBeUndefined();
  });

  it("both early returns carry null cursors", async () => {
    rpcResults = { search_events_fuzzy: { data: [], error: null } };
    const search = await get("?search=nothing");
    expect(search.body).toMatchObject({ events: [], total: 0, nextCursor: null, prevCursor: null });

    rpcResults = { get_event_ids_by_time_filter: { data: [], error: null } };
    const time = await get("?dayType=weekend");
    expect(time.body).toMatchObject({ events: [], total: 0, nextCursor: null, prevCursor: null });
  });

  it("the benign-error branch carries null cursors", async () => {
    mainResult = {
      data: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
      count: 3,
    };

    const { response, body } = await get("?page=9&limit=2");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ events: [], total: 3, nextCursor: null, prevCursor: null });
  });
});

// ─── The hook and the route, held together ──────────────────────────────────

describe("GET /api/events — every field useEvents reads is in the response", () => {
  it("each data.<field> read in src/hooks/useEvents.ts is a key of the success body", async () => {
    const hookSource = readFileSync(
      join(process.cwd(), "src", "hooks", "useEvents.ts"),
      "utf-8"
    );
    const fields = new Set(
      Array.from(hookSource.matchAll(/\bdata\.([A-Za-z_$][\w$]*)/g), (m) => m[1])
    );
    // Guard against a regex that silently matches nothing.
    expect(fields.has("nextCursor")).toBe(true);

    mainResult = { data: [buildEvent(1)], error: null, count: 2 };
    const { body } = await get("?limit=1");

    for (const field of fields) {
      expect(Object.keys(body)).toContain(field);
    }
  });
});
