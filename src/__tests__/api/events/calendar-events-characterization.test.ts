/**
 * PRESERVE characterization — /api/calendar/events (REFAC-09)
 *
 * Written against the UNMODIFIED route `src/app/api/calendar/events/route.ts`
 * at the base commit recorded on line 1 of
 * `.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.before.txt`.
 * Plan 04-05 moves this handler onto the request-context seam; this file must
 * pass byte-for-byte, unedited, after that commit. A red here after 04-05 is a
 * behaviour change, not a test problem.
 *
 * Tests cover:
 *   - anonymous and auth-error callers get 401 Unauthorized
 *   - a caller with nothing saved and no RSVP gets `{ events: [] }`
 *   - the result is the UNION of the caller's saved ids and going/interested
 *     RSVP ids — ordered by start_date ascending, each annotated with
 *     `is_saved` and `rsvp_status`; a cancelled RSVP contributes nothing;
 *     another user's saves and RSVPs contribute nothing; pending, rejected and
 *     soft-deleted events are excluded
 *   - an event reached only through an RSVP (never saved) is returned
 *   - `from` and `to` bound start_date inclusively (gte / lte)
 *   - the club embedded by the query passes its ten real columns through
 *   - an events query error is a 500; a thrown error is
 *     500 `{ error: "Failed to fetch calendar events" }`
 *
 * WHY THE MOCK SEAM IS THE SERVER FACTORY:
 *   The route imports `createClient` from "@/lib/supabase/server" today, and
 *   `createRequestContext()` in `src/server/context.ts` awaits the very same
 *   factory after 04-05 adopts the seam, so the seam this suite mocks does not
 *   move under the refactor. The fake (`../../helpers/fakeSupabase.ts`)
 *   evaluates `eq`/`in`/`is`/`gte`/`lte` against rows it holds, so dropping the
 *   status filter on the RSVP read, or the user filter on either read, returns
 *   a fixture below that must not appear, and the suite goes red.
 *
 * Deliberately NOT pinned:
 *   - the BODY of the events-query 500. It echoes the PostgREST error text to
 *     the caller, which is F-059 (Phase 5); only the status is asserted.
 *   - the club shape (F-080). Most fixtures have no club (the embed answers
 *     null and `organizer` is null, so no club is built or asserted). The one
 *     club test asserts only that the ten columns the embed selects arrive with
 *     their values — never the five URL fields and `contact_email` that
 *     `transformEventFromDB` hard-codes to null, since that is the defect.
 *   - tag coercion (F-081). Fixtures use only tags that map to themselves.
 *   - a failed saved-rows or RSVP-rows read (the route ignores both errors;
 *     that is not a contract worth freezing).
 *
 * Every assertion invokes the exported `GET` and asserts on the returned
 * response. It has been observed turning red under mutations of the route —
 * cycles 3, 3b and 3c: the is_saved annotation, the
 * RSVP status filter, and the `to` bound — each
 * recorded with its failing test names in `evidence/slice-1-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/calendar/events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const OTHER_USER_ID = "5eed0000-0000-4000-8000-00000000c002";
const CLUB_ID = "5eed0000-0000-4000-8000-0000000000c1";

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

const SAVED_ONLY = eventRow("5eed0000-0000-4000-8000-00000000e001", "Saved Only", "2026-10-20T18:00:00+00:00", "academic");
const SAVED_AND_INTERESTED = eventRow("5eed0000-0000-4000-8000-00000000e002", "Saved And Interested", "2026-10-05T18:00:00+00:00", "social");
const GOING_ONLY = eventRow("5eed0000-0000-4000-8000-00000000e003", "Going Only", "2026-11-02T18:00:00+00:00", "sports");
const CANCELLED_ONLY = eventRow("5eed0000-0000-4000-8000-00000000e004", "Cancelled Only", "2026-10-10T18:00:00+00:00", "career");
const OTHERS_ONLY = eventRow("5eed0000-0000-4000-8000-00000000e005", "Others Only", "2026-10-11T18:00:00+00:00", "cultural");
const SAVED_PENDING = eventRow("5eed0000-0000-4000-8000-00000000e006", "Saved Pending", "2026-10-12T18:00:00+00:00", "wellness", { status: "pending" });
const GOING_REJECTED = eventRow("5eed0000-0000-4000-8000-00000000e007", "Going Rejected", "2026-10-13T18:00:00+00:00", "wellness", { status: "rejected" });
const SAVED_DELETED = eventRow("5eed0000-0000-4000-8000-00000000e008", "Saved Deleted", "2026-10-14T18:00:00+00:00", "academic", { deleted_at: "2026-09-01T00:00:00+00:00" });
// A past event is still on the calendar: the route has no upcoming floor.
const SAVED_PAST = eventRow("5eed0000-0000-4000-8000-00000000e009", "Saved Past", "2025-03-01T18:00:00+00:00", "social");

const EVENTS = [
  SAVED_ONLY, SAVED_AND_INTERESTED, GOING_ONLY, CANCELLED_ONLY, OTHERS_ONLY,
  SAVED_PENDING, GOING_REJECTED, SAVED_DELETED, SAVED_PAST,
];

const SAVED: FakeRow[] = [
  { id: "sv1", user_id: CALLER.id, event_id: SAVED_ONLY.id },
  { id: "sv2", user_id: CALLER.id, event_id: SAVED_AND_INTERESTED.id },
  { id: "sv3", user_id: CALLER.id, event_id: SAVED_PENDING.id },
  { id: "sv4", user_id: CALLER.id, event_id: SAVED_DELETED.id },
  { id: "sv5", user_id: CALLER.id, event_id: SAVED_PAST.id },
  { id: "sv6", user_id: OTHER_USER_ID, event_id: OTHERS_ONLY.id },
];

const RSVPS: FakeRow[] = [
  { id: "r1", user_id: CALLER.id, event_id: SAVED_AND_INTERESTED.id, status: "interested" },
  { id: "r2", user_id: CALLER.id, event_id: GOING_ONLY.id, status: "going" },
  { id: "r3", user_id: CALLER.id, event_id: CANCELLED_ONLY.id, status: "cancelled" },
  { id: "r4", user_id: CALLER.id, event_id: GOING_REJECTED.id, status: "going" },
  { id: "r5", user_id: OTHER_USER_ID, event_id: OTHERS_ONLY.id, status: "going" },
];

/** What the route returns for one fixture row: every stored column, the tag
 *  unchanged, an empty saved_by_users, no club, and the two annotations. */
function expected(row: FakeRow, isSaved: boolean, rsvpStatus: string | null) {
  return { ...row, saved_by_users: [], is_saved: isSaved, rsvp_status: rsvpStatus };
}

function setup(init: Partial<FakeSupabaseInit> = {}): FakeSupabase {
  mockFake = createFakeSupabase({
    user: CALLER,
    tables: {
      users: [{ id: CALLER.id, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null }],
      saved_events: SAVED,
      rsvps: RSVPS,
      events: EVENTS,
    },
    ...init,
  });
  return mockFake;
}

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/calendar/events${query}`);
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/calendar/events — authentication", () => {
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

describe("GET /api/calendar/events — empty", () => {
  it("returns { events: [] } when the caller has nothing saved and no RSVP", async () => {
    setup({
      tables: {
        saved_events: SAVED.filter((r) => r.user_id !== CALLER.id),
        rsvps: RSVPS.filter((r) => r.user_id !== CALLER.id),
        events: EVENTS,
      },
    });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });

  it("returns { events: [] } when the caller's only RSVP is cancelled and nothing is saved", async () => {
    setup({
      tables: {
        saved_events: [],
        rsvps: [{ id: "r3", user_id: CALLER.id, event_id: CANCELLED_ONLY.id, status: "cancelled" }],
        events: EVENTS,
      },
    });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });
});

describe("GET /api/calendar/events — union and annotation", () => {
  it("returns saved ∪ going/interested events by start_date ascending, annotated with is_saved and rsvp_status", async () => {
    setup();
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [
        expected(SAVED_PAST, true, null),
        expected(SAVED_AND_INTERESTED, true, "interested"),
        expected(SAVED_ONLY, true, null),
        expected(GOING_ONLY, false, "going"),
      ],
    });
  });

  it("returns an event reached only through a going RSVP, with is_saved false", async () => {
    setup({
      tables: {
        saved_events: [],
        rsvps: [{ id: "r2", user_id: CALLER.id, event_id: GOING_ONLY.id, status: "going" }],
        events: EVENTS,
      },
    });
    const res = await GET(request());
    expect(await res.json()).toEqual({ events: [expected(GOING_ONLY, false, "going")] });
  });
});

describe("GET /api/calendar/events — from/to", () => {
  it("from bounds start_date inclusively from below", async () => {
    setup();
    const res = await GET(request("?from=2026-10-20T18:00:00%2B00:00"));
    const body = await res.json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([SAVED_ONLY.id, GOING_ONLY.id]);
  });

  it("to bounds start_date inclusively from above", async () => {
    setup();
    const res = await GET(request("?to=2026-10-20T18:00:00%2B00:00"));
    const body = await res.json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([
      SAVED_PAST.id, SAVED_AND_INTERESTED.id, SAVED_ONLY.id,
    ]);
  });

  it("from and to together keep only the window", async () => {
    setup();
    const res = await GET(request("?from=2026-10-01&to=2026-10-31"));
    expect(await res.json()).toEqual({
      events: [
        expected(SAVED_AND_INTERESTED, true, "interested"),
        expected(SAVED_ONLY, true, null),
      ],
    });
  });
});

describe("GET /api/calendar/events — embedded club", () => {
  it("passes the ten embedded club columns through with their values", async () => {
    const club = {
      id: CLUB_ID,
      name: "Seed Robotics Club",
      logo_url: "https://example.test/logo.png",
      instagram_handle: "seedrobotics",
      description: "Robots.",
      category: "academic",
      status: "approved",
      created_by: null,
      created_at: "2026-01-01T00:00:00+00:00",
      updated_at: "2026-01-02T00:00:00+00:00",
    };
    setup({
      tables: {
        saved_events: [{ id: "sv1", user_id: CALLER.id, event_id: SAVED_ONLY.id }],
        rsvps: [],
        events: [{ ...SAVED_ONLY, club_id: CLUB_ID, club }],
      },
    });
    const res = await GET(request());
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].club_id).toBe(CLUB_ID);
    expect(body.events[0].club).toEqual(expect.objectContaining(club));
  });
});

describe("GET /api/calendar/events — errors", () => {
  it("returns status 500 when the events query errors", async () => {
    setup({ errors: { events: PG_ERROR } });
    const res = await GET(request());
    expect(res.status).toBe(500);
  });

  it("returns 500 Failed to fetch calendar events when the client throws", async () => {
    setup({ throwOn: { saved_events: "connection reset" } });
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch calendar events" });
  });
});
