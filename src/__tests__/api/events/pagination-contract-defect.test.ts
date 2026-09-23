/**
 * DEFECT characterization — F-083
 *
 * Subject: the contract between `src/hooks/useEvents.ts` lines 53-138 and
 * `src/app/api/events/route.ts` GET, lines 158-339 — specifically the
 * parameter parsing at 164-172, the single `.order('start_date')` at 196, the
 * OFFSET window at 272-275, and the five-key response at 326-333.
 *
 * The defect: the client pages by keyset cursor — it sends `cursor` and reads
 * `data.nextCursor` / `data.prevCursor` — while the route reads no `cursor`
 * parameter, pages by `.range(from, to)`, orders by `start_date` alone, and
 * returns `{ events, total, page, limit, totalPages }` with no cursor at all.
 * `src/app/page.tsx:510-518` renders "Load More" only when `nextCursor` is set,
 * so the button never renders: a filtered or searched feed stops at its first
 * 30 results. `command grep -c -i cursor src/app/api/events/route.ts` is 0.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins what the handler does TODAY: a well-formed
 *     base64 `{ sortValue, id }` cursor is ignored (the window still starts
 *     at row 0 and the first rows come back); no `nextCursor` or `prevCursor`
 *     property is emitted, even when more rows remain; an unparseable cursor
 *     is a 200; ordering is `start_date` alone with no `id` tie-break; the
 *     body — on success and on the early returns — has exactly five keys. It
 *     passes today and is expected to keep passing until the fixing commit.
 *   - It is NOT a failing test and NOT a fix. Plan 04-09 implements DEC-25:
 *     a keyset cursor on `(start_date, id)` ascending, base64 JSON
 *     `{ sortValue, id }`, `nextCursor`/`prevCursor` added to the response,
 *     `total` unchanged, an invalid cursor rejected with 400
 *     `{ error: "Invalid cursor" }`. In that commit EVERY assertion below
 *     moves — deliberately and visibly — and `src/app/api/events/route.test.ts`
 *     (the skipped suite this file does not touch) is revived against it.
 *   - Page mode is NOT pinned here. `page`/`limit` stay accepted under DEC-25,
 *     and `events-list-characterization.test.ts` pins them in a way the
 *     cursor commit cannot move.
 *
 * Why most assertions are on the RESPONSE and two are on the fake's CALL LOG:
 * the missing keys are a response property and are asserted there. "The
 * cursor is ignored" is asserted twice — once as the rows returned (the first
 * page, not the page after the cursor) and once as the OFFSET window the
 * handler asks for — and "no id tie-break" is only visible as the order keys
 * handed to the query builder. The in-memory fake
 * (`../../helpers/fakeSupabase.ts`) records both.
 *
 * Registered as F-083 in .planning/audit/findings.json. Closes in Phase 4.
 * Observed red under a mutation that adds a null `nextCursor` key to the
 * success body; see `evidence/slice-2-mutation-check.txt`.
 *
 * Status: FIXED in 04-09, by the commit `fix(04-09): implement the cursor
 * contract the client already speaks (F-083, F-066)`, which implements
 * DEC-25. The route now decodes `cursor` with `decodeEventCursor`
 * (`src/lib/eventCursor.ts`) and rejects a bad one with 400
 * `{ error: "Invalid cursor" }` before any query. It orders by `start_date`
 * then `id`. In cursor mode it adds the keyset or()
 * `start_date.gt."<v>",and(start_date.eq."<v>",id.gt."<id>")` and asks for rows
 * 0 through limit-1, and it takes `total` from a separate head count carrying
 * every other filter. Every body now has seven keys: the five page-mode keys
 * plus `nextCursor` and `prevCursor`. In that same commit EVERY assertion below
 * MOVED from the before-state listed above to the fixed contract. Five of the
 * seven before-assertions went red against the fixed route first
 * (`evidence/defect-ledger.md`). The other two ("the first rows come back" and
 * "rows 0 through limit-1") stayed green, because the fake records an or()
 * without evaluating it and the cursor-mode window really is rows 0 through
 * limit-1. They move to assertions on the keyset or() itself. That the rows
 * after the cursor are what comes back is proven against the real PostgREST
 * by `e2e/specs/event-read-path.spec.ts` (the PRESERVE cursor traversals).
 * The file keeps its tag and its F-083 citation so the history stays
 * readable. `events-list-characterization.test.ts` pinned page mode across
 * the change and was not edited. The contract itself is specified by
 * `src/app/api/events/route.test.ts`, which is no longer skipped.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

jest.mock("@/lib/timezone", () => ({
  ...jest.requireActual<typeof import("@/lib/timezone")>("@/lib/timezone"),
  getESTNowISO: () => "2026-09-23T12:00:00.000Z",
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** 25 upcoming approved events, one day apart, stable tags, no club. */
const ROWS: FakeRow[] = Array.from({ length: 25 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const start = `2026-10-${n}T15:00:00+00:00`;
  return {
    id: `5eed0000-0000-4000-8000-0000000c00${n}`,
    title: `Cursor ${n}`,
    description: null,
    start_date: start,
    end_date: start,
    location: "Leacock 132",
    organizer: null,
    club_id: null,
    tags: ["academic"],
    image_url: null,
    created_at: "2026-08-01T12:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
    status: "approved",
    deleted_at: null,
  };
});

/** The skipped suite's encoding: base64 of JSON { sortValue, id }. Points at row 5. */
const CURSOR_AT_ROW_5 = Buffer.from(
  JSON.stringify({ sortValue: ROWS[4].start_date, id: ROWS[4].id })
).toString("base64");

const SEVEN_KEYS = [
  "events",
  "limit",
  "nextCursor",
  "page",
  "prevCursor",
  "total",
  "totalPages",
];

interface ListBody {
  events: Array<{ id: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
}

const decode = (cursor: string | null) =>
  JSON.parse(Buffer.from(String(cursor), "base64").toString("utf-8")) as {
    sortValue: string;
    id: string;
  };

async function get(query: string, init: Partial<FakeSupabaseInit> = {}) {
  mockFake = createFakeSupabase({ user: null, tables: { events: ROWS }, ...init });
  const res = await GET(new NextRequest(`http://localhost:3000/api/events${query}`));
  const body = (await res.json()) as ListBody;
  return { res, body, fake: mockFake };
}

const eventSelect = (calls: FakeCall[]): FakeCall | undefined =>
  calls.find(
    (c) => c.table === "events" && c.operation === "select" && !c.options?.head
  );

const headCount = (calls: FakeCall[]): FakeCall | undefined =>
  calls.find(
    (c) => c.table === "events" && c.operation === "select" && c.options?.head === true
  );

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("F-083 (fixed in 04-09) — the route speaks the client's keyset cursor", () => {
  it("a well-formed cursor adds the keyset or() after the cursor's row, both values quoted", async () => {
    const { res, fake } = await get(`?limit=3&cursor=${encodeURIComponent(CURSOR_AT_ROW_5)}`);
    expect(res.status).toBe(200);
    const ors = eventSelect(fake.calls)?.filters.filter((f) => f.op === "or");
    expect(ors).toEqual([
      {
        op: "or",
        column: "",
        value:
          `start_date.gt."${ROWS[4].start_date}",` +
          `and(start_date.eq."${ROWS[4].start_date}",id.gt."${ROWS[4].id}")`,
      },
    ]);
  });

  it("with a cursor, the handler asks for rows 0 through limit-1 after it, and counts the total with a separate head count", async () => {
    const { fake } = await get(`?limit=3&cursor=${encodeURIComponent(CURSOR_AT_ROW_5)}`);
    const main = eventSelect(fake.calls);
    expect(main?.range).toEqual({ from: 0, to: 2 });
    const count = headCount(fake.calls);
    expect(count?.options).toEqual({ count: "exact", head: true });
    // Every filter but the keyset: the total counts all matching events.
    expect(count?.filters).toEqual(main?.filters.filter((f) => f.op !== "or"));
  });

  it("the body has a nextCursor and a prevCursor property", async () => {
    const { body } = await get(`?limit=3&cursor=${encodeURIComponent(CURSOR_AT_ROW_5)}`);
    expect(body).toHaveProperty("nextCursor");
    expect(body).toHaveProperty("prevCursor");
    // prevCursor names the first returned row (which rows those are is the
    // real PostgREST's to decide; the fake does not evaluate the keyset).
    const first = ROWS.find((r) => r.id === body.events[0].id);
    expect(decode(body.prevCursor)).toEqual({ sortValue: first?.start_date, id: first?.id });
  });

  it("with more rows than the limit, a next cursor naming the last returned row is emitted — the body has the seven keys", async () => {
    const { body } = await get("?limit=10");
    expect(body.total).toBe(25);
    expect(body.events).toHaveLength(10);
    expect(decode(body.nextCursor)).toEqual({ sortValue: ROWS[9].start_date, id: ROWS[9].id });
    expect(body.prevCursor).toBeNull();
    expect(Object.keys(body).sort()).toEqual(SEVEN_KEYS);
  });

  it("cursor=not-a-valid-cursor is rejected with a 400, and nothing is queried", async () => {
    const { res, body, fake } = await get("?limit=3&cursor=not-a-valid-cursor");
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid cursor" });
    expect(fake.calls).toEqual([]);
  });

  it("ordering is start_date ascending, then id ascending — the tie-break a keyset relies on", async () => {
    const { fake } = await get("?limit=3");
    expect(eventSelect(fake.calls)?.order).toEqual([
      { column: "start_date", ascending: true, nullsFirst: false },
      { column: "id", ascending: true, nullsFirst: false },
    ]);
  });

  it("the early returns carry the seven keys, with both cursors null", async () => {
    const time = await get("?dayType=weekend", {
      rpc: { get_event_ids_by_time_filter: { data: [], error: null } },
    });
    expect(Object.keys(time.body).sort()).toEqual(SEVEN_KEYS);
    expect(time.body).toMatchObject({ nextCursor: null, prevCursor: null });

    const search = await get("?search=nothing", {
      rpc: { search_events_fuzzy: { data: [], error: null } },
    });
    expect(Object.keys(search.body).sort()).toEqual(SEVEN_KEYS);
    expect(search.body).toMatchObject({ nextCursor: null, prevCursor: null });
  });
});
