/**
 * PRESERVE characterization — /api/events/[id]/save (REFAC-09)
 *
 * Written against the UNMODIFIED route `src/app/api/events/[id]/save/route.ts`
 * at the base commit recorded on line 1 of
 * `.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.before.txt`.
 * Plan 04-05 moves this handler onto the request-context seam; this file must
 * pass byte-for-byte, unedited, after that commit. A red here after 04-05 is a
 * behaviour change, not a test problem.
 *
 * Tests cover:
 *   - DELETE: anonymous and auth-error callers get 401; a success returns
 *     `{ saved: false }` and removes only the caller's row for this event; an
 *     unsave of something never saved is still `{ saved: false }`; a delete
 *     error and a thrown error each return their own 500 body
 *   - POST: the ban check runs FIRST — a permanent or still-running suspension
 *     is 403 before any event is read, an expired suspension is not blocked;
 *     anonymous 401; event lookup error 500; missing or soft-deleted event 404;
 *     existing-row check error 500; the toggle — not saved → insert exactly one
 *     row with the caller's id → `{ saved: true }`, already saved → remove it →
 *     `{ saved: false }`; insert, toggle-delete and thrown errors each their 500
 *   - (The ban-asymmetry cases once pinned here moved out with their fix in
 *     05-06; they live in `ban-asymmetry-defect.test.ts`.)
 *
 * WHY THE MOCK SEAM IS THE SERVER FACTORY:
 *   The route imports `createClient` from "@/lib/supabase/server" today, and
 *   `createRequestContext()` in `src/server/context.ts` awaits the very same
 *   factory after 04-05 adopts the seam, so the seam this suite mocks does not
 *   move under the refactor. `@/lib/ban` is deliberately NOT mocked: the ban
 *   check (since 05-06, `requireActiveUser`) applies the real `isBanned()` to
 *   the `users.banned_at, ban_expires_at` the request context reads from the
 *   same fake, so the ban tests pin the real rule, not a stub's return value.
 *   The fake (`../../helpers/
 *   fakeSupabase.ts`) evaluates filters against rows it holds, so a handler
 *   that stopped scoping its delete by `user_id` would delete the other user's
 *   row below and go red.
 *
 * Deliberately NOT pinned: the `console.error` context strings (silenced, not
 *   asserted), and nothing here depends on the club shape (F-080) or the
 *   upcoming floor (F-085) — this route returns neither.
 *
 * Every assertion invokes an exported handler and asserts on the returned
 * response and, for writes, the fake's resulting table state or call log. It
 * has been observed turning red under mutations of the route — cycles 1, 1b
 * and 1c: the saved-true literal, the ban check's early return, and the
 * DELETE's user_id scope — each recorded with its failing test names in
 * `evidence/slice-1-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { DELETE, POST } from "@/app/api/events/[id]/save/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const OTHER_USER_ID = "5eed0000-0000-4000-8000-00000000c002";
const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";
const OTHER_EVENT_ID = "5eed0000-0000-4000-8000-00000000e002";
const DELETED_EVENT_ID = "5eed0000-0000-4000-8000-00000000e003";
const MISSING_EVENT_ID = "5eed0000-0000-4000-8000-00000000e999";

const PG_ERROR = { code: "XX000", message: "fake failure" };

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

const EVENTS: FakeRow[] = [
  { id: EVENT_ID, status: "approved", deleted_at: null },
  { id: OTHER_EVENT_ID, status: "approved", deleted_at: null },
  { id: DELETED_EVENT_ID, status: "approved", deleted_at: "2026-01-02T00:00:00+00:00" },
];

function setup(init: Partial<FakeSupabaseInit> = {}): FakeSupabase {
  mockFake = createFakeSupabase({
    user: CALLER,
    tables: {
      users: [profile()],
      events: EVENTS,
      saved_events: [],
    },
    ...init,
  });
  return mockFake;
}

function withTables(tables: Record<string, FakeRow[]>): Record<string, FakeRow[]> {
  return { users: [profile()], events: EVENTS, saved_events: [], ...tables };
}

function request(method: "POST" | "DELETE", eventId = EVENT_ID): NextRequest {
  return new NextRequest(`http://localhost:3000/api/events/${eventId}/save`, { method });
}

function context(eventId = EVENT_ID) {
  return { params: Promise.resolve({ id: eventId }) };
}

function savedRows(fake: FakeSupabase) {
  return fake.tables.saved_events.map((r) => ({ user_id: r.user_id, event_id: r.event_id }));
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── DELETE ─────────────────────────────────────────────────────────────────

describe("DELETE /api/events/[id]/save — authentication", () => {
  it("returns 401 Unauthorized for an anonymous caller", async () => {
    setup({ user: null });
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 Unauthorized when auth reports an error and no user", async () => {
    setup({ user: null, authError: { message: "invalid JWT", status: 401 } });
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("DELETE /api/events/[id]/save — unsave", () => {
  it("returns { saved: false } and removes only the caller's row for this event", async () => {
    const fake = setup({
      tables: withTables({
        saved_events: [
          { id: "s1", user_id: CALLER.id, event_id: EVENT_ID },
          { id: "s2", user_id: CALLER.id, event_id: OTHER_EVENT_ID },
          { id: "s3", user_id: OTHER_USER_ID, event_id: EVENT_ID },
        ],
      }),
    });
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: false });
    expect(savedRows(fake)).toEqual([
      { user_id: CALLER.id, event_id: OTHER_EVENT_ID },
      { user_id: OTHER_USER_ID, event_id: EVENT_ID },
    ]);
  });

  it("returns { saved: false } when nothing was saved", async () => {
    setup();
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: false });
  });

  it("returns 500 Failed to unsave event when the delete errors, and removes nothing", async () => {
    const fake = setup({
      tables: withTables({ saved_events: [{ id: "s1", user_id: CALLER.id, event_id: EVENT_ID }] }),
      errors: { "saved_events.delete": PG_ERROR },
    });
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to unsave event" });
    expect(savedRows(fake)).toEqual([{ user_id: CALLER.id, event_id: EVENT_ID }]);
  });

  it("returns 500 Internal server error when the client throws", async () => {
    setup({ throwOn: { saved_events: "connection reset" } });
    const res = await DELETE(request("DELETE"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});

// ─── POST ───────────────────────────────────────────────────────────────────

describe("POST /api/events/[id]/save — ban check runs first", () => {
  it("returns 403 Account suspended for a permanently banned caller, before any event is read", async () => {
    const fake = setup({
      tables: withTables({ users: [profile({ banned_at: "2026-01-01T00:00:00+00:00" })] }),
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account suspended" });
    expect(fake.calls.filter((c) => c.table === "events")).toHaveLength(0);
    expect(fake.calls.filter((c) => c.table === "saved_events")).toHaveLength(0);
    expect(savedRows(fake)).toEqual([]);
  });

  it("returns 403 Account suspended while a temporary suspension is still running", async () => {
    setup({
      tables: withTables({
        users: [profile({ banned_at: "2026-01-01T00:00:00+00:00", ban_expires_at: "2099-01-01T00:00:00+00:00" })],
      }),
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account suspended" });
  });

  it("does not block a caller whose suspension has expired", async () => {
    const fake = setup({
      tables: withTables({
        users: [profile({ banned_at: "2020-01-01T00:00:00+00:00", ban_expires_at: "2020-02-01T00:00:00+00:00" })],
      }),
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
    expect(savedRows(fake)).toEqual([{ user_id: CALLER.id, event_id: EVENT_ID }]);
  });
});

describe("POST /api/events/[id]/save — authentication", () => {
  it("returns 401 Unauthorized for an anonymous caller", async () => {
    setup({ user: null });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 Unauthorized when auth reports an error and no user", async () => {
    setup({ user: null, authError: { message: "invalid JWT", status: 401 } });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("POST /api/events/[id]/save — event lookup", () => {
  it("returns 500 Failed to verify event when the event read errors", async () => {
    setup({ errors: { events: PG_ERROR } });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to verify event" });
  });

  it("returns 404 Event not found for an id that does not exist", async () => {
    const fake = setup();
    const res = await POST(request("POST", MISSING_EVENT_ID), context(MISSING_EVENT_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
    expect(savedRows(fake)).toEqual([]);
  });

  it("returns 404 Event not found for a soft-deleted event", async () => {
    const fake = setup();
    const res = await POST(request("POST", DELETED_EVENT_ID), context(DELETED_EVENT_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
    expect(savedRows(fake)).toEqual([]);
  });
});

describe("POST /api/events/[id]/save — toggle", () => {
  it("returns 500 Failed to check saved event when the existing-row read errors", async () => {
    setup({ errors: { "saved_events.select": PG_ERROR } });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to check saved event" });
  });

  it("saves an unsaved event: { saved: true } and exactly one row inserted with the caller's id", async () => {
    const fake = setup({
      tables: withTables({
        saved_events: [{ id: "s3", user_id: OTHER_USER_ID, event_id: EVENT_ID }],
      }),
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
    const inserts = fake.calls.filter((c) => c.table === "saved_events" && c.operation === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual({ user_id: CALLER.id, event_id: EVENT_ID });
    expect(savedRows(fake)).toEqual([
      { user_id: OTHER_USER_ID, event_id: EVENT_ID },
      { user_id: CALLER.id, event_id: EVENT_ID },
    ]);
  });

  it("unsaves an already-saved event: { saved: false } and the caller's row removed", async () => {
    const fake = setup({
      tables: withTables({
        saved_events: [
          { id: "s1", user_id: CALLER.id, event_id: EVENT_ID },
          { id: "s3", user_id: OTHER_USER_ID, event_id: EVENT_ID },
        ],
      }),
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: false });
    expect(savedRows(fake)).toEqual([{ user_id: OTHER_USER_ID, event_id: EVENT_ID }]);
    expect(
      fake.calls.filter((c) => c.table === "saved_events" && c.operation === "insert")
    ).toHaveLength(0);
  });

  it("returns 500 Failed to save event when the insert errors", async () => {
    const fake = setup({ errors: { "saved_events.insert": PG_ERROR } });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save event" });
    expect(savedRows(fake)).toEqual([]);
  });

  it("returns 500 Failed to unsave event when the toggle's delete errors", async () => {
    setup({
      tables: withTables({ saved_events: [{ id: "s1", user_id: CALLER.id, event_id: EVENT_ID }] }),
      errors: { "saved_events.delete": PG_ERROR },
    });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to unsave event" });
  });

  it("returns 500 Internal server error when the client throws", async () => {
    setup({ throwOn: { events: "connection reset" } });
    const res = await POST(request("POST"), context());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
