/**
 * PRESERVE characterization — /api/users/saved-events (REFAC-09)
 *
 * Written against the UNMODIFIED route `src/app/api/users/saved-events/route.ts`
 * at the base commit recorded on line 1 of
 * `.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.before.txt`.
 * Plan 04-05 moves this handler onto the request-context seam; this file must
 * pass byte-for-byte, unedited, after that commit. A red here after 04-05 is a
 * behaviour change, not a test problem.
 *
 * Tests cover:
 *   - anonymous and auth-error callers get 401 Unauthorized
 *   - a caller with no saved rows gets `{ events: [], savedEventIds: [] }`
 *   - only the CALLER's saved rows are read; only approved, non-deleted events
 *     come back; each event is the full transformed event plus `saved_at`
 *   - the three sort orders: default (and any unknown value) by saved_at
 *     descending, `sort=date` by start_date ascending, `sort=title` by title
 *   - an upcoming floor exists by default (an event two years past is dropped)
 *     and `include_past=true` removes it (the past event comes back)
 *   - `savedEventIds` mirrors the returned order exactly
 *   - saved-rows error, events error and a thrown error each return their 500
 *
 * WHY THE MOCK SEAM IS THE SERVER FACTORY:
 *   The route imports `createClient` from "@/lib/supabase/server" today, and
 *   `createRequestContext()` in `src/server/context.ts` awaits the very same
 *   factory after 04-05 adopts the seam, so the seam this suite mocks does not
 *   move under the refactor. The fake (`../../helpers/fakeSupabase.ts`)
 *   evaluates `in`/`eq`/`is`/`gte` against rows it holds, so a handler that
 *   stopped filtering by status or deleted_at would return the pending or
 *   deleted fixture below and go red.
 *
 * Deliberately NOT pinned:
 *   - the VALUE of the upcoming floor. The route floors on true UTC while
 *     `/api/events` floors on Eastern wall-clock — that disagreement is F-085
 *     and is pinned only in `saved-events-time-floor-defect.test.ts`. Every
 *     fixture here sits months or years from the pinned clock, so a four- or
 *     five-hour shift of the floor cannot move an assertion in this file.
 *   - the club shape (F-080). Fixtures carry `organizer: null` and no `club`
 *     key, so `transformEventFromDB` builds no club and none is asserted.
 *   - tag coercion (F-081). Fixtures use only tags that map to themselves.
 *   - the `console.warn`/`console.error` context strings (silenced).
 *
 * The clock is pinned with Jest's modern fake timers faking `Date` only, so the
 * past/upcoming split of the fixtures is the same on every run.
 *
 * Every assertion invokes the exported `GET` and asserts on the returned
 * response. Each behaviour group has been observed turning this suite red
 * under a mutation of the route; see `evidence/slice-1-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/users/saved-events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CLOCK = new Date("2026-09-23T16:00:00.000Z");

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const OTHER_USER_ID = "5eed0000-0000-4000-8000-00000000c002";

const PG_ERROR = { code: "XX000", message: "fake failure" };

function eventRow(id: string, title: string, start: string, tag: string, overrides: FakeRow = {}): FakeRow {
  return {
    id,
    title,
    description: `${title} description`,
    start_date: start,
    end_date: start,
    location: "Leacock 132",
    organizer: null,
    club_id: null,
    tags: [tag],
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

// Three upcoming approved events whose saved_at, start_date and title orders
// all differ, so each sort is distinguishable from the other two.
const BRAVO = eventRow("5eed0000-0000-4000-8000-00000000e001", "Bravo Lecture", "2026-10-05T18:00:00+00:00", "academic");
const ALPHA = eventRow("5eed0000-0000-4000-8000-00000000e002", "Alpha Mixer", "2026-11-20T23:00:00+00:00", "social");
const CHARLIE = eventRow("5eed0000-0000-4000-8000-00000000e003", "Charlie Match", "2026-10-01T15:00:00+00:00", "sports");
// Two years in the past — dropped by the default floor whatever its value.
const DELTA_PAST = eventRow("5eed0000-0000-4000-8000-00000000e004", "Delta Yoga", "2024-09-01T15:00:00+00:00", "wellness");
const PENDING = eventRow("5eed0000-0000-4000-8000-00000000e005", "Echo Fair", "2026-10-10T15:00:00+00:00", "career", { status: "pending" });
const REJECTED = eventRow("5eed0000-0000-4000-8000-00000000e006", "Foxtrot Night", "2026-10-11T15:00:00+00:00", "cultural", { status: "rejected" });
const DELETED = eventRow("5eed0000-0000-4000-8000-00000000e007", "Golf Day", "2026-10-12T15:00:00+00:00", "sports", { deleted_at: "2026-09-01T00:00:00+00:00" });
const NOT_SAVED = eventRow("5eed0000-0000-4000-8000-00000000e008", "Hotel Talk", "2026-10-13T15:00:00+00:00", "academic");
const OTHERS_ONLY = eventRow("5eed0000-0000-4000-8000-00000000e009", "India Social", "2026-10-14T15:00:00+00:00", "social");

const SAVED_AT = {
  [BRAVO.id as string]: "2026-09-01T10:00:00+00:00",
  [ALPHA.id as string]: "2026-09-10T10:00:00+00:00",
  [CHARLIE.id as string]: "2026-08-15T10:00:00+00:00",
  [DELTA_PAST.id as string]: "2026-09-20T10:00:00+00:00",
  [PENDING.id as string]: "2026-09-21T10:00:00+00:00",
  [REJECTED.id as string]: "2026-09-21T11:00:00+00:00",
  [DELETED.id as string]: "2026-09-21T12:00:00+00:00",
};

const CALLER_SAVED: FakeRow[] = Object.entries(SAVED_AT).map(([eventId, createdAt], i) => ({
  id: `saved-${i}`,
  user_id: CALLER.id,
  event_id: eventId,
  created_at: createdAt,
}));

const OTHER_SAVED: FakeRow[] = [
  { id: "saved-other-1", user_id: OTHER_USER_ID, event_id: OTHERS_ONLY.id, created_at: "2026-09-22T10:00:00+00:00" },
  { id: "saved-other-2", user_id: OTHER_USER_ID, event_id: BRAVO.id, created_at: "2026-09-22T11:00:00+00:00" },
];

const ALL_EVENTS = [BRAVO, ALPHA, CHARLIE, DELTA_PAST, PENDING, REJECTED, DELETED, NOT_SAVED, OTHERS_ONLY];

/** What the route returns for one fixture row: every stored column, the tag
 *  unchanged, an empty saved_by_users, no club, and the caller's saved_at. */
function expected(row: FakeRow) {
  return { ...row, saved_by_users: [], saved_at: SAVED_AT[row.id as string] };
}

function setup(init: Partial<FakeSupabaseInit> = {}): FakeSupabase {
  mockFake = createFakeSupabase({
    user: CALLER,
    tables: {
      users: [{ id: CALLER.id, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null }],
      saved_events: [...CALLER_SAVED, ...OTHER_SAVED],
      events: ALL_EVENTS,
    },
    ...init,
  });
  return mockFake;
}

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/users/saved-events${query}`);
}

beforeEach(() => {
  jest.useFakeTimers({
    now: CLOCK,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask",
      "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback",
      "setImmediate", "clearImmediate", "setInterval", "clearInterval",
      "setTimeout", "clearTimeout",
    ],
  });
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/users/saved-events — authentication", () => {
  it("returns 401 Unauthorized for an anonymous caller", async () => {
    setup({ user: null });
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 Unauthorized when auth reports an error and no user", async () => {
    setup({ user: null, authError: { message: "invalid JWT", status: 401 } });
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("GET /api/users/saved-events — empty", () => {
  it("returns { events: [], savedEventIds: [] } when the caller has saved nothing", async () => {
    setup({
      tables: { saved_events: [...OTHER_SAVED], events: ALL_EVENTS },
    });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], savedEventIds: [] });
  });
});

describe("GET /api/users/saved-events — default request", () => {
  it("returns the caller's approved, non-deleted, upcoming saved events by saved_at descending, each with saved_at", async () => {
    setup();
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [expected(ALPHA), expected(BRAVO), expected(CHARLIE)],
      savedEventIds: [ALPHA.id, BRAVO.id, CHARLIE.id],
    });
  });

  it("treats an unknown sort value as the default saved_at-descending order", async () => {
    setup();
    const res = await GET(request("?sort=popularity"));
    const body = await res.json();
    expect(body.savedEventIds).toEqual([ALPHA.id, BRAVO.id, CHARLIE.id]);
  });

  it("carries the caller's own saved_at, not another user's, on an event both saved", async () => {
    setup();
    const res = await GET(request());
    const body = await res.json();
    const bravo = body.events.find((e: { id: string }) => e.id === BRAVO.id);
    expect(bravo.saved_at).toBe("2026-09-01T10:00:00+00:00");
  });
});

describe("GET /api/users/saved-events — sort orders", () => {
  it("sort=date orders by start_date ascending", async () => {
    setup();
    const res = await GET(request("?sort=date"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [expected(CHARLIE), expected(BRAVO), expected(ALPHA)],
      savedEventIds: [CHARLIE.id, BRAVO.id, ALPHA.id],
    });
  });

  it("sort=title orders by title", async () => {
    setup();
    const res = await GET(request("?sort=title"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [expected(ALPHA), expected(BRAVO), expected(CHARLIE)],
      savedEventIds: [ALPHA.id, BRAVO.id, CHARLIE.id],
    });
  });
});

describe("GET /api/users/saved-events — include_past", () => {
  it("include_past=true applies no start_date floor: the past saved event comes back", async () => {
    setup();
    const res = await GET(request("?include_past=true"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [expected(DELTA_PAST), expected(ALPHA), expected(BRAVO), expected(CHARLIE)],
      savedEventIds: [DELTA_PAST.id, ALPHA.id, BRAVO.id, CHARLIE.id],
    });
  });

  it("include_past with any other value keeps the floor", async () => {
    setup();
    const res = await GET(request("?include_past=1"));
    const body = await res.json();
    expect(body.savedEventIds).toEqual([ALPHA.id, BRAVO.id, CHARLIE.id]);
  });

  it("include_past=true with sort=date still excludes pending, rejected and deleted events", async () => {
    setup();
    const res = await GET(request("?include_past=true&sort=date"));
    const body = await res.json();
    expect(body.savedEventIds).toEqual([DELTA_PAST.id, CHARLIE.id, BRAVO.id, ALPHA.id]);
  });
});

describe("GET /api/users/saved-events — errors", () => {
  it("returns 500 Failed to fetch saved events when the saved-rows read errors", async () => {
    setup({ errors: { saved_events: PG_ERROR } });
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch saved events" });
  });

  it("returns 500 Failed to fetch event details when the events read errors", async () => {
    setup({ errors: { events: PG_ERROR } });
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch event details" });
  });

  it("returns 500 Internal server error when the client throws", async () => {
    setup({ throwOn: { saved_events: "connection reset" } });
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
