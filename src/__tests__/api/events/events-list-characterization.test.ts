/**
 * PRESERVE characterization — GET /api/events (REFAC-10)
 *
 * Written against the UNMODIFIED route `src/app/api/events/route.ts` at plan
 * 04-04's base commit b632f62. Slice 2 changes this handler four times
 * (04-07 tag surfacing, 04-08 search escaping, 04-09 the cursor contract,
 * 04-10 the club embed). Every one of those commits must leave this file
 * green, byte-for-byte and unedited. A red here after any of them is a
 * behaviour change, not a test problem.
 *
 * Tests cover:
 *   - only approved, non-deleted events come back, in start_date order
 *   - with no `dateFrom` the start_date floor is `getESTNowISO()` (mocked to a
 *     fixed instant; an event one minute before it is dropped, one minute
 *     after it is kept); an explicit `dateFrom` replaces the floor in either
 *     direction; `dateTo` adds an upper bound
 *   - `tags` filters by array overlap with the comma-split, TRIMMED values
 *     (`sports, social` matches a social event, which only trimming allows)
 *   - `ids` restricts by id, ignoring blank elements, and never widens past
 *     the approved/non-deleted filter
 *   - an invalid `timeOfDay` or `dayType` is 400 with the exact current
 *     message and issues no query of any kind
 *   - the time-of-day RPC restricts by its ids; an empty or null RPC result is
 *     an early 200 with an empty list and no events query
 *   - page mode: `page=2&limit=10` over 25 matching rows returns the 11th to
 *     20th rows in start_date order with `total: 25, totalPages: 3`
 *   - a successful fuzzy RPC restricts to its ids and orders by RANK, not by
 *     start_date; a fuzzy RPC with no matches is an early empty 200; a fuzzy
 *     RPC error falls back to one or() filter mentioning `title.ilike.`,
 *     `description.ilike.` and the term
 *   - PGRST103, PGRST116 and a message starting with `{` are benign: 200 with
 *     an empty list; any other query error, or a thrown error, is a 500
 *   - the success response carries
 *     `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`
 *
 * DELIBERATELY NOT PINNED (each is allowed to change in the named commit):
 *   - the or() argument string beyond "mentions both columns and the term" —
 *     F-082, moved by 04-08, which quotes and escapes the term. The exact raw
 *     string lives in `search-escaping-defect.test.ts`.
 *   - the exact response key set, the number of order() calls (04-09 adds an
 *     `id` tie-break), and whether early returns carry cursor keys — F-083,
 *     moved by 04-09 (DEC-25). Bodies here are matched on the five current
 *     keys with toMatchObject, so an added `nextCursor`/`prevCursor` cannot
 *     move an assertion. The absence of cursors is pinned only in
 *     `pagination-contract-defect.test.ts`.
 *   - the select column string and the club shape — F-080, moved by 04-10
 *     (DEC-27). Fixtures carry `organizer: null` and no `club` key, so the
 *     transform builds no club, and no club is asserted.
 *   - any tag outside academic, social, sports, career, cultural and wellness
 *     — F-081, moved by 04-07 / the 04-11 checkpoint (DEC-26). Fixtures use
 *     only those six members, which map to themselves.
 *   - the text of any 500 body — F-059, Phase 5. Only the status is asserted.
 *   - the VALUE semantics of the floor (Eastern wall-clock versus UTC) — F-085,
 *     Phase 6. The floor is mocked; this file pins only that it is applied.
 *
 * WHY THE SEAM IS THE SERVER FACTORY: the route awaits `createClient()` from
 * "@/lib/supabase/server"; the in-memory fake (`../../helpers/fakeSupabase.ts`)
 * stands behind it and EVALUATES `eq`/`is`/`in`/`gte`/`lte`/`overlaps` and the
 * ordering against the rows it holds, so a handler that stopped filtering by
 * status, deleted_at, tags or date would return a fixture below that must not
 * come back. `@/lib/tagMapping` is NOT mocked: the real transform runs, which
 * is harmless on these fixtures and keeps 04-07's move of it honest.
 *
 * Every assertion invokes the exported `GET` and asserts on the returned
 * response, except the fallback or() and the "no query issued" checks, which
 * read the fake's call log because the fake cannot evaluate a logic tree and
 * because "nothing was queried" has no response-level signature.
 * Observed red under a mutation of the approved-status filter; see
 * `evidence/slice-2-mutation-check.txt`.
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

/** Must equal the literal in the timezone mock above. */
const FLOOR = "2026-09-23T12:00:00.000Z";

const PG_ERROR = { code: "XX000", message: "fake failure" };

function eventRow(
  id: string,
  title: string,
  start: string,
  tags: string[],
  overrides: FakeRow = {}
): FakeRow {
  return {
    id,
    title,
    description: `${title} description`,
    start_date: start,
    end_date: start,
    location: "Leacock 132",
    organizer: null,
    club_id: null,
    tags,
    image_url: null,
    category: null,
    source: "manual",
    source_url: null,
    content_hash: null,
    rsvp_count: 0,
    is_free: true,
    price: null,
    rsvp_link: null,
    created_by: null,
    created_at: "2026-08-01T12:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
    status: "approved",
    deleted_at: null,
    appeal_count: 0,
    ...overrides,
  };
}

const id = (n: string) => `5eed0000-0000-4000-8000-00000000e${n}`;

const ALPHA = eventRow(id("001"), "Alpha Lecture", "2026-10-05T18:00:00+00:00", ["academic"]);
const BRAVO = eventRow(id("002"), "Bravo Mixer", "2026-10-01T23:00:00+00:00", ["social"]);
const CHARLIE = eventRow(id("003"), "Charlie Match", "2026-11-10T15:00:00+00:00", ["sports"]);
const DELTA = eventRow(id("004"), "Delta Career Fair", "2026-10-20T15:00:00+00:00", ["career", "academic"]);
const PENDING = eventRow(id("005"), "Echo Pending", "2026-10-02T15:00:00+00:00", ["academic"], { status: "pending" });
const REJECTED = eventRow(id("006"), "Foxtrot Rejected", "2026-10-03T15:00:00+00:00", ["social"], { status: "rejected" });
const DELETED = eventRow(id("007"), "Golf Deleted", "2026-10-04T15:00:00+00:00", ["academic"], {
  deleted_at: "2026-09-01T00:00:00+00:00",
});
const PAST = eventRow(id("008"), "Hotel Past", "2025-03-01T15:00:00+00:00", ["wellness"]);
const JUST_BEFORE = eventRow(id("009"), "India Before", "2026-09-23T11:59:00.000Z", ["cultural"]);
const JUST_AFTER = eventRow(id("00a"), "Juliet After", "2026-09-23T12:01:00.000Z", ["cultural"]);

const ALL_EVENTS = [ALPHA, BRAVO, CHARLIE, DELTA, PENDING, REJECTED, DELETED, PAST, JUST_BEFORE, JUST_AFTER];

/** The default feed: approved, not deleted, at or after the floor, by start_date. */
const DEFAULT_ORDER = [JUST_AFTER, BRAVO, ALPHA, DELTA, CHARLIE].map((e) => e.id);

/** 25 upcoming approved events, one day apart, for the page-mode tests. */
const PAGED = Array.from({ length: 25 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return eventRow(
    `5eed0000-0000-4000-8000-0000000p00${n}`,
    `Paged ${n}`,
    `2026-10-${n}T15:00:00+00:00`,
    ["academic"]
  );
});

interface ListBody {
  events: Array<{ id: string; title: string; start_date: string; tags: string[] }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function setup(init: Partial<FakeSupabaseInit> = {}): FakeSupabase {
  mockFake = createFakeSupabase({
    user: null,
    tables: { events: ALL_EVENTS },
    ...init,
  });
  return mockFake;
}

async function get(query = "", init: Partial<FakeSupabaseInit> = {}) {
  const fake = setup(init);
  const res = await GET(new NextRequest(`http://localhost:3000/api/events${query}`));
  const body = (await res.json()) as ListBody & { error?: string };
  return { res, body, fake };
}

const ids = (body: ListBody): string[] => body.events.map((e) => e.id);

const eventSelects = (calls: FakeCall[]): FakeCall[] =>
  calls.filter((c) => c.table === "events" && c.operation === "select");

const FUZZY_ERROR = {
  search_events_fuzzy: {
    data: null,
    error: { code: "0A000", message: "SET is not allowed in a non-volatile function" },
  },
};

const EMPTY_BODY = { events: [], total: 0, page: 1, limit: 50, totalPages: 0 };

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/events — the base filter and ordering", () => {
  it("returns only approved, non-deleted, upcoming events, in start_date order", async () => {
    const { res, body } = await get();
    expect(res.status).toBe(200);
    expect(ids(body)).toEqual(DEFAULT_ORDER);
    expect(body).toMatchObject({ total: 5, page: 1, limit: 50, totalPages: 1 });
  });

  it("never returns a pending, rejected or soft-deleted event, whatever else is asked", async () => {
    const { body } = await get(`?dateFrom=2020-01-01T00:00:00Z&ids=${PENDING.id},${REJECTED.id},${DELETED.id},${ALPHA.id}`);
    expect(ids(body)).toEqual([ALPHA.id]);
  });

  it("returns each event transformed, with its stored title, start_date and stable tags", async () => {
    const { body } = await get(`?ids=${DELTA.id}`);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      id: DELTA.id,
      title: "Delta Career Fair",
      start_date: "2026-10-20T15:00:00+00:00",
      tags: ["career", "academic"],
    });
  });
});

describe("GET /api/events — date bounds", () => {
  it("with no dateFrom, floors start_date at getESTNowISO(): one minute before is dropped, one minute after is kept", async () => {
    const { body } = await get();
    expect(ids(body)).toContain(JUST_AFTER.id);
    expect(ids(body)).not.toContain(JUST_BEFORE.id);
    expect(ids(body)).not.toContain(PAST.id);
  });

  it("an explicit dateFrom earlier than the floor replaces it", async () => {
    const { body } = await get("?dateFrom=2025-01-01T00:00:00Z");
    expect(ids(body)).toEqual([PAST.id, JUST_BEFORE.id, ...DEFAULT_ORDER]);
    expect(body.total).toBe(7);
  });

  it("an explicit dateFrom later than the floor replaces it", async () => {
    const { body } = await get("?dateFrom=2026-10-02T00:00:00Z");
    expect(ids(body)).toEqual([ALPHA.id, DELTA.id, CHARLIE.id]);
  });

  it("dateTo adds an inclusive upper bound on start_date", async () => {
    const { body } = await get("?dateTo=2026-10-20T15:00:00Z");
    expect(ids(body)).toEqual([JUST_AFTER.id, BRAVO.id, ALPHA.id, DELTA.id]);
  });

  it("the floor constant this file assumes is the one the mock returns", () => {
    expect(jest.requireMock<typeof import("@/lib/timezone")>("@/lib/timezone").getESTNowISO()).toBe(FLOOR);
  });
});

describe("GET /api/events — tags and ids", () => {
  it("tags=academic, social returns events whose tags overlap either value", async () => {
    const { body } = await get("?tags=academic, social");
    expect(ids(body)).toEqual([BRAVO.id, ALPHA.id, DELTA.id]);
  });

  it("tag values are trimmed: 'sports, social' matches the social event too", async () => {
    const { body } = await get("?tags=sports, social");
    expect(ids(body)).toEqual([BRAVO.id, CHARLIE.id]);
  });

  it("a tag no event carries returns an empty list with total 0", async () => {
    const { res, body } = await get("?tags=wellness");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ events: [], total: 0, totalPages: 0 });
  });

  it("ids=a,b restricts the result to those ids", async () => {
    const { body } = await get(`?ids=${ALPHA.id},${CHARLIE.id}`);
    expect(ids(body)).toEqual([ALPHA.id, CHARLIE.id]);
  });

  it("blank and space-padded elements of ids are ignored", async () => {
    const { body } = await get(`?ids=${CHARLIE.id}, ,${ALPHA.id} ,`);
    expect(ids(body)).toEqual([ALPHA.id, CHARLIE.id]);
  });
});

describe("GET /api/events — timeOfDay and dayType", () => {
  it("an invalid timeOfDay is 400 with the exact message, and nothing is queried", async () => {
    const { res, body, fake } = await get("?timeOfDay=noon");
    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid timeOfDay value. Must be one of: morning, afternoon, evening, night",
    });
    expect(fake.calls).toEqual([]);
  });

  it("an invalid dayType is 400 with the exact message, and nothing is queried", async () => {
    const { res, body, fake } = await get("?dayType=holiday");
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid dayType value. Must be one of: weekday, weekend" });
    expect(fake.calls).toEqual([]);
  });

  it("a valid timeOfDay restricts the list to the RPC's ids (still approved and upcoming only)", async () => {
    const { body, fake } = await get("?timeOfDay=evening", {
      rpc: {
        get_event_ids_by_time_filter: {
          data: [{ event_id: CHARLIE.id }, { event_id: ALPHA.id }, { event_id: PENDING.id }, { event_id: PAST.id }],
          error: null,
        },
      },
    });
    expect(ids(body)).toEqual([ALPHA.id, CHARLIE.id]);
    const rpc = fake.calls.find((c) => c.operation === "rpc");
    expect(rpc?.table).toBe("get_event_ids_by_time_filter");
    expect(rpc?.payload).toMatchObject({ time_of_day: "evening" });
  });

  it("an empty time-filter RPC result is an early 200 with an empty list, and no events query", async () => {
    const { res, body, fake } = await get("?dayType=weekend", {
      rpc: { get_event_ids_by_time_filter: { data: [], error: null } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject(EMPTY_BODY);
    expect(eventSelects(fake.calls)).toEqual([]);
  });

  it("a null time-filter RPC result (the RPC errored) is the same early empty 200", async () => {
    const { res, body, fake } = await get("?timeOfDay=morning", {
      rpc: { get_event_ids_by_time_filter: { data: null, error: PG_ERROR } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject(EMPTY_BODY);
    expect(eventSelects(fake.calls)).toEqual([]);
  });

  it("the early return echoes the requested page and limit", async () => {
    const { body } = await get("?dayType=weekday&page=3&limit=7", {
      rpc: { get_event_ids_by_time_filter: { data: [], error: null } },
    });
    expect(body).toMatchObject({ events: [], total: 0, page: 3, limit: 7, totalPages: 0 });
  });
});

describe("GET /api/events — page mode", () => {
  const paged = { tables: { events: PAGED } };

  it("page=2&limit=10 over 25 rows returns the 11th to 20th rows with total 25 and totalPages 3", async () => {
    const { body } = await get("?page=2&limit=10", paged);
    expect(ids(body)).toEqual(PAGED.slice(10, 20).map((e) => e.id));
    expect(body).toMatchObject({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it("the last partial page holds the remainder", async () => {
    const { body } = await get("?page=3&limit=10", paged);
    expect(ids(body)).toEqual(PAGED.slice(20).map((e) => e.id));
    expect(body).toMatchObject({ total: 25, page: 3, limit: 10, totalPages: 3 });
  });

  it("with no page or limit, page 1 of up to 50 rows is returned", async () => {
    const { body } = await get("", paged);
    expect(ids(body)).toEqual(PAGED.map((e) => e.id));
    expect(body).toMatchObject({ total: 25, page: 1, limit: 50, totalPages: 1 });
  });

  it("total counts every matching row, not the rows on the page", async () => {
    const { body } = await get("?limit=2");
    expect(ids(body)).toEqual(DEFAULT_ORDER.slice(0, 2));
    expect(body).toMatchObject({ total: 5, page: 1, limit: 2, totalPages: 3 });
  });
});

describe("GET /api/events — search", () => {
  it("a successful fuzzy RPC restricts to its ids and orders by rank, not by start_date", async () => {
    const { body } = await get("?search=match", {
      rpc: {
        search_events_fuzzy: {
          data: [
            { event_id: CHARLIE.id, rank: 0.9 },
            { event_id: ALPHA.id, rank: 0.4 },
            { event_id: PAST.id, rank: 0.3 },
          ],
          error: null,
        },
      },
    });
    // ALPHA starts before CHARLIE; rank puts CHARLIE first. PAST is below the floor.
    expect(ids(body)).toEqual([CHARLIE.id, ALPHA.id]);
    expect(body.total).toBe(2);
  });

  it("a fuzzy RPC with no matches is an early 200 with an empty list and total 0, and no events query", async () => {
    const { res, body, fake } = await get("?search=zzz", {
      rpc: { search_events_fuzzy: { data: [], error: null } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject(EMPTY_BODY);
    expect(eventSelects(fake.calls)).toEqual([]);
  });

  it("when the fuzzy RPC errors, exactly one or() filter mentioning title.ilike., description.ilike. and the term is applied", async () => {
    const { res, fake } = await get("?search=lecture", { rpc: FUZZY_ERROR });
    expect(res.status).toBe(200);
    const [select] = eventSelects(fake.calls);
    const ors = select.filters.filter((f) => f.op === "or");
    expect(ors).toHaveLength(1);
    const expression = String(ors[0].value);
    expect(expression).toContain("title.ilike.");
    expect(expression).toContain("description.ilike.");
    expect(expression).toContain("lecture");
  });

  it("with no search term, no search RPC is called and no or() filter is applied", async () => {
    const { fake } = await get();
    expect(fake.calls.filter((c) => c.operation === "rpc")).toEqual([]);
    expect(eventSelects(fake.calls)[0].filters.filter((f) => f.op === "or")).toEqual([]);
  });
});

describe("GET /api/events — errors", () => {
  it("PGRST103 (range not satisfiable) is benign: 200 with an empty list", async () => {
    const { res, body } = await get("?page=9&limit=10", {
      errors: { events: { code: "PGRST103", message: "Requested range not satisfiable" } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ events: [], total: 0, page: 9, limit: 10, totalPages: 0 });
  });

  it("PGRST116 is benign: 200 with an empty list", async () => {
    const { res, body } = await get("", {
      errors: { events: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject(EMPTY_BODY);
  });

  it("an error whose message starts with '{' is benign: 200 with an empty list", async () => {
    const { res, body } = await get("", {
      errors: { events: { code: "", message: "{\"malformed\":true}" } },
    });
    expect(res.status).toBe(200);
    expect(body).toMatchObject(EMPTY_BODY);
  });

  it("any other query error is a 500", async () => {
    const { res } = await get("", { errors: { events: PG_ERROR } });
    expect(res.status).toBe(500);
  });

  it("a thrown error is a 500", async () => {
    const { res } = await get("", { throwOn: { events: "connection reset" } });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/events — caching", () => {
  it("a successful response carries Cache-Control: public, s-maxage=30, stale-while-revalidate=60", async () => {
    const { res } = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=60");
  });
});
