/**
 * PRESERVE characterization — /api/events/[id]/rsvp (REFAC-09)
 *
 * Written against the UNMODIFIED route `src/app/api/events/[id]/rsvp/route.ts`
 * at the base commit recorded on line 1 of
 * `.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.before.txt`.
 * Plan 04-05 moves this handler onto the request-context seam AND replaces the
 * way GET counts RSVPs (F-079). This file must pass byte-for-byte, unedited,
 * after both commits. A red here after 04-05 is a behaviour change, not a test
 * problem.
 *
 * THE COUNT TESTS ARE BLIND TO HOW THE COUNTS ARE COMPUTED — deliberately.
 *   They seed the fake's `rsvps` table with going, interested and cancelled
 *   rows across two events and assert ONLY on the response body. The fake
 *   answers a row-returning select (today: load the rows, filter in
 *   JavaScript) and a `{ count: "exact", head: true }` select (after 04-05)
 *   from the same rows with the same filter semantics, so both
 *   implementations produce the same body here. That is what lets this suite
 *   prove "before and after" for the F-079 fix without being edited. How the
 *   counts are computed today is pinned separately, in
 *   `rsvp-count-defect.test.ts`, and that file is the one 04-05 moves. This
 *   suite never asserts on the rsvps call log for GET.
 *
 * Tests cover:
 *   - GET counts: going and interested counted per event, cancelled rows and
 *     other events' rows excluded, `total === going + interested`; zero rows
 *     give zeros
 *   - GET `user_rsvp`: null for an anonymous caller; the caller's own
 *     non-cancelled row (id, status, created_at, updated_at) when signed in;
 *     null when the caller's only row is cancelled
 *   - GET errors: missing or soft-deleted event 404, event lookup error 500,
 *     rsvps read error 500
 *   - POST create 201, update to a different status 200, same status 200
 *     "Already RSVP'd", re-RSVP after a cancel 200; a banned caller 403 before
 *     any RSVP read or write; a body `user_id` that is not the caller's is 403
 *     and writes nothing (T-04-02-04)
 *   - DELETE soft-cancels the caller's active row (status → cancelled, other
 *     rows untouched); no active row 404; mismatched body `user_id` 403 with
 *     nothing cancelled
 *   - (The ban-asymmetry cases once pinned here moved out with their fix in
 *     05-06; they live in `ban-asymmetry-defect.test.ts`.)
 *
 * The 16 error-path tests in `rsvp.test.ts` (401s, 400 validation, the
 * existing 403/404 cases) are not repeated here; 04-06 owns that file.
 *
 * WHY THE MOCK SEAM IS THE SERVER FACTORY:
 *   The route imports `createClient` from "@/lib/supabase/server" today, and
 *   `createRequestContext()` in `src/server/context.ts` awaits the very same
 *   factory after 04-05 adopts the seam, so the seam this suite mocks does not
 *   move under the refactor. `@/lib/ban` is deliberately NOT mocked: the ban
 *   check (since 05-06, `requireActiveUser`) applies the real `isBanned()` to
 *   the `users.banned_at, ban_expires_at` the request context reads from the
 *   same fake (`../../helpers/fakeSupabase.ts`), so the ban tests pin the real
 *   rule.
 *
 * Deliberately NOT pinned: the `console.error`/`console.warn` context strings
 *   (silenced), and nothing here involves the club shape (F-080) or an upcoming
 *   floor (F-085) — this route returns neither. Whether the RSVP table is
 *   readable anonymously is F-011 (Phase 5); these tests only assert what the
 *   handler returns given the rows the client can see.
 *
 * Every assertion invokes an exported handler and asserts on the returned
 * response and, for writes, the fake's resulting table state. It has been
 * observed turning red under mutations of the route — cycles 4, 4b and 4c: the
 * total, the user_rsvp cancelled filter, and the DELETE's cancelled write —
 * each recorded with its failing test names in
 * `evidence/slice-1-mutation-check.txt`. Cycle 5c in the same file is the
 * control for the count property above: the 04-05 head-count shape applied to
 * the route leaves this suite GREEN while cycle 5b turns
 * `rsvp-count-defect.test.ts` red.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { DELETE, GET, POST } from "@/app/api/events/[id]/rsvp/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";
const OTHER_EVENT_ID = "5eed0000-0000-4000-8000-00000000e002";
const DELETED_EVENT_ID = "5eed0000-0000-4000-8000-00000000e003";
const MISSING_EVENT_ID = "5eed0000-0000-4000-8000-00000000e999";

const PG_ERROR = { code: "XX000", message: "fake failure" };
const INSERT_NOW = "2026-09-23T12:00:00.000Z";

const EVENTS: FakeRow[] = [
  { id: EVENT_ID, status: "approved", deleted_at: null },
  { id: OTHER_EVENT_ID, status: "approved", deleted_at: null },
  { id: DELETED_EVENT_ID, status: "approved", deleted_at: "2026-01-02T00:00:00+00:00" },
];

function profile(overrides: FakeRow = {}): FakeRow {
  return {
    id: CALLER.id,
    roles: ["user"],
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
    ...overrides,
  };
}

let seq = 0;
function rsvp(userSuffix: string, eventId: string, status: string, overrides: FakeRow = {}): FakeRow {
  seq += 1;
  return {
    id: `rsvp-${seq}`,
    user_id: `5eed0000-0000-4000-8000-000000009${userSuffix.padStart(3, "0")}`,
    event_id: eventId,
    status,
    created_at: "2026-09-01T10:00:00+00:00",
    updated_at: "2026-09-02T10:00:00+00:00",
    ...overrides,
  };
}

/** Three going, two interested and four cancelled on EVENT_ID, plus rows on
 *  another event that must never be counted. No row belongs to the caller. */
function crowd(): FakeRow[] {
  return [
    rsvp("1", EVENT_ID, "going"),
    rsvp("2", EVENT_ID, "going"),
    rsvp("3", EVENT_ID, "going"),
    rsvp("4", EVENT_ID, "interested"),
    rsvp("5", EVENT_ID, "interested"),
    rsvp("6", EVENT_ID, "cancelled"),
    rsvp("7", EVENT_ID, "cancelled"),
    rsvp("8", EVENT_ID, "cancelled"),
    rsvp("9", EVENT_ID, "cancelled"),
    rsvp("10", OTHER_EVENT_ID, "going"),
    rsvp("11", OTHER_EVENT_ID, "going"),
    rsvp("12", OTHER_EVENT_ID, "interested"),
  ];
}

function callerRow(eventId: string, status: string): FakeRow {
  return {
    id: `caller-${eventId.slice(-4)}`,
    user_id: CALLER.id,
    event_id: eventId,
    status,
    created_at: "2026-09-05T09:00:00+00:00",
    updated_at: "2026-09-06T09:00:00+00:00",
  };
}

function setup(init: Partial<FakeSupabaseInit> = {}): FakeSupabase {
  mockFake = createFakeSupabase({
    user: CALLER,
    now: INSERT_NOW,
    tables: { users: [profile()], events: EVENTS, rsvps: crowd() },
    ...init,
  });
  return mockFake;
}

function withTables(tables: Record<string, FakeRow[]>): Record<string, FakeRow[]> {
  return { users: [profile()], events: EVENTS, rsvps: crowd(), ...tables };
}

function getRequest(eventId = EVENT_ID): NextRequest {
  return new NextRequest(`http://localhost:3000/api/events/${eventId}/rsvp`);
}

function bodyRequest(method: "POST" | "DELETE", body: Record<string, unknown>, eventId = EVENT_ID): NextRequest {
  return new NextRequest(`http://localhost:3000/api/events/${eventId}/rsvp`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(eventId = EVENT_ID) {
  return { params: Promise.resolve({ id: eventId }) };
}

function callerRows(fake: FakeSupabase) {
  return fake.tables.rsvps.filter((r) => r.user_id === CALLER.id);
}

function nonCallerSnapshot(fake: FakeSupabase) {
  return fake.tables.rsvps
    .filter((r) => r.user_id !== CALLER.id)
    .map((r) => `${r.id}:${r.event_id}:${r.status}`);
}

beforeEach(() => {
  seq = 0;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── GET: counts ────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/rsvp — counts (implementation-blind)", () => {
  it("counts 3 going and 2 interested for an anonymous caller, excluding cancelled rows and other events", async () => {
    setup({ user: null });
    const res = await GET(getRequest(), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      counts: { going: 3, interested: 2, total: 5 },
      user_rsvp: null,
    });
    expect(body.counts.total).toBe(body.counts.going + body.counts.interested);
  });

  it("counts the other event's rows for that event only", async () => {
    setup({ user: null });
    const res = await GET(getRequest(OTHER_EVENT_ID), context(OTHER_EVENT_ID));
    expect(await res.json()).toEqual({
      counts: { going: 2, interested: 1, total: 3 },
      user_rsvp: null,
    });
  });

  it("returns zero counts for an event with only cancelled RSVPs", async () => {
    setup({
      user: null,
      tables: withTables({ rsvps: [rsvp("1", EVENT_ID, "cancelled"), rsvp("2", EVENT_ID, "cancelled")] }),
    });
    const res = await GET(getRequest(), context());
    expect(await res.json()).toEqual({
      counts: { going: 0, interested: 0, total: 0 },
      user_rsvp: null,
    });
  });
});

// ─── GET: user_rsvp ─────────────────────────────────────────────────────────

describe("GET /api/events/[id]/rsvp — user_rsvp", () => {
  it("returns the caller's non-cancelled row with id, status, created_at and updated_at, and counts it", async () => {
    const mine = callerRow(EVENT_ID, "interested");
    setup({ tables: withTables({ rsvps: [...crowd(), mine] }) });
    const res = await GET(getRequest(), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      counts: { going: 3, interested: 3, total: 6 },
      user_rsvp: {
        id: mine.id,
        status: "interested",
        created_at: mine.created_at,
        updated_at: mine.updated_at,
      },
    });
  });

  it("returns user_rsvp null for a signed-in caller whose only row is cancelled", async () => {
    setup({ tables: withTables({ rsvps: [...crowd(), callerRow(EVENT_ID, "cancelled")] }) });
    const res = await GET(getRequest(), context());
    expect(await res.json()).toEqual({
      counts: { going: 3, interested: 2, total: 5 },
      user_rsvp: null,
    });
  });

  it("returns user_rsvp null for a signed-in caller whose RSVP is on a different event", async () => {
    setup({ tables: withTables({ rsvps: [...crowd(), callerRow(OTHER_EVENT_ID, "going")] }) });
    const res = await GET(getRequest(), context());
    expect(await res.json()).toEqual({
      counts: { going: 3, interested: 2, total: 5 },
      user_rsvp: null,
    });
  });
});

// ─── GET: errors ────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/rsvp — errors", () => {
  it("returns 404 Event not found for an id that does not exist", async () => {
    setup({ user: null });
    const res = await GET(getRequest(MISSING_EVENT_ID), context(MISSING_EVENT_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
  });

  it("returns 404 Event not found for a soft-deleted event", async () => {
    setup({ user: null });
    const res = await GET(getRequest(DELETED_EVENT_ID), context(DELETED_EVENT_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
  });

  it("returns 500 Failed to verify event when the event read errors", async () => {
    setup({ user: null, errors: { events: PG_ERROR } });
    const res = await GET(getRequest(), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to verify event" });
  });

  it("returns 500 Failed to fetch RSVPs when the rsvps read errors", async () => {
    setup({ user: null, errors: { rsvps: PG_ERROR } });
    const res = await GET(getRequest(), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch RSVPs" });
  });
});

// ─── POST ───────────────────────────────────────────────────────────────────

describe("POST /api/events/[id]/rsvp — create and update", () => {
  it("creates an RSVP: 201 with the new row, and exactly one row for the caller", async () => {
    const fake = setup();
    const before = nonCallerSnapshot(fake);
    const res = await POST(bodyRequest("POST", { user_id: CALLER.id, status: "going" }), context());
    expect(res.status).toBe(201);
    const rows = callerRows(fake);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ user_id: CALLER.id, event_id: EVENT_ID, status: "going" }));
    expect(await res.json()).toEqual({
      success: true,
      message: "RSVP'd as going",
      rsvp: {
        id: rows[0].id,
        status: "going",
        created_at: rows[0].created_at,
        updated_at: rows[0].updated_at,
      },
    });
    expect(nonCallerSnapshot(fake)).toEqual(before);
  });

  it("updates an existing RSVP to a different status: 200 'RSVP updated to interested'", async () => {
    const mine = callerRow(EVENT_ID, "going");
    const fake = setup({ tables: withTables({ rsvps: [...crowd(), mine] }) });
    const res = await POST(bodyRequest("POST", { user_id: CALLER.id, status: "interested" }), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: "RSVP updated to interested",
      rsvp: {
        id: mine.id,
        status: "interested",
        created_at: mine.created_at,
        updated_at: callerRows(fake)[0].updated_at,
      },
    });
    expect(callerRows(fake).map((r) => `${r.id}:${r.status}`)).toEqual([`${mine.id}:interested`]);
  });

  it("returns 200 'Already RSVP'd as going' with the existing row when the status is unchanged", async () => {
    const mine = callerRow(EVENT_ID, "going");
    const fake = setup({ tables: withTables({ rsvps: [...crowd(), mine] }) });
    const res = await POST(bodyRequest("POST", { user_id: CALLER.id, status: "going" }), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: "Already RSVP'd as going",
      rsvp: { id: mine.id, status: "going", created_at: mine.created_at },
    });
    expect(callerRows(fake).map((r) => `${r.id}:${r.status}`)).toEqual([`${mine.id}:going`]);
  });

  it("re-activates a cancelled RSVP as an update: 200 'RSVP updated to going', no second row", async () => {
    const mine = callerRow(EVENT_ID, "cancelled");
    const fake = setup({ tables: withTables({ rsvps: [...crowd(), mine] }) });
    const res = await POST(bodyRequest("POST", { user_id: CALLER.id, status: "going" }), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: "RSVP updated to going",
      rsvp: {
        id: mine.id,
        status: "going",
        created_at: mine.created_at,
        updated_at: callerRows(fake)[0].updated_at,
      },
    });
    expect(callerRows(fake).map((r) => `${r.id}:${r.status}`)).toEqual([`${mine.id}:going`]);
  });
});

describe("POST /api/events/[id]/rsvp — refusals", () => {
  it("returns 403 Account suspended for a banned caller, before any RSVP read or write", async () => {
    const fake = setup({
      tables: withTables({ users: [profile({ banned_at: "2026-01-01T00:00:00+00:00" })] }),
    });
    const res = await POST(bodyRequest("POST", { user_id: CALLER.id, status: "going" }), context());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account suspended" });
    expect(fake.calls.filter((c) => c.table === "rsvps")).toHaveLength(0);
    expect(callerRows(fake)).toEqual([]);
  });

  it("returns 403 and writes nothing when the body user_id is not the caller's", async () => {
    const victim = rsvp("1", EVENT_ID, "going");
    const fake = setup();
    const before = nonCallerSnapshot(fake);
    const res = await POST(bodyRequest("POST", { user_id: victim.user_id, status: "interested" }), context());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "user_id does not match authenticated user" });
    expect(nonCallerSnapshot(fake)).toEqual(before);
    expect(callerRows(fake)).toEqual([]);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────────────

describe("DELETE /api/events/[id]/rsvp — cancel", () => {
  it("soft-cancels the caller's active row: 200 'RSVP cancelled', status becomes cancelled, others untouched", async () => {
    const mine = callerRow(EVENT_ID, "going");
    const alsoMine = callerRow(OTHER_EVENT_ID, "interested");
    const fake = setup({ tables: withTables({ rsvps: [...crowd(), mine, alsoMine] }) });
    const before = nonCallerSnapshot(fake);
    const res = await DELETE(bodyRequest("DELETE", { user_id: CALLER.id }), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: "RSVP cancelled" });
    expect(callerRows(fake).map((r) => `${r.event_id}:${r.status}`)).toEqual([
      `${EVENT_ID}:cancelled`,
      `${OTHER_EVENT_ID}:interested`,
    ]);
    expect(nonCallerSnapshot(fake)).toEqual(before);
  });

  it("returns 404 No active RSVP found for this event when the caller's only row is already cancelled", async () => {
    setup({ tables: withTables({ rsvps: [...crowd(), callerRow(EVENT_ID, "cancelled")] }) });
    const res = await DELETE(bodyRequest("DELETE", { user_id: CALLER.id }), context());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No active RSVP found for this event" });
  });

  it("returns 403 and cancels nothing when the body user_id is not the caller's", async () => {
    const mine = callerRow(EVENT_ID, "going");
    const victim = rsvp("1", EVENT_ID, "going");
    const fake = setup({ tables: withTables({ rsvps: [...crowd(), mine] }) });
    const before = nonCallerSnapshot(fake);
    const res = await DELETE(bodyRequest("DELETE", { user_id: victim.user_id }), context());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "user_id does not match authenticated user" });
    expect(nonCallerSnapshot(fake)).toEqual(before);
    expect(callerRows(fake).map((r) => r.status)).toEqual(["going"]);
  });
});
