/**
 * PRESERVE characterization — the notification routes (plan 06-02, REFAC-15)
 *
 * Written against the UNMODIFIED `notifications/route.ts` (GET, POST),
 * `notifications/[id]/route.ts` (PATCH) and `notifications/count/route.ts`
 * (GET) at plan 06-02's base commit, before 06-04 puts a contract on the
 * `cursor` and `action` query params and moves count's anonymous branch
 * (F-028). This file must pass UNEDITED after that. It pins:
 *
 *   list GET     anonymous and auth-error 401 Unauthorized; a signed-in
 *                caller's own rows newest first, 20 per page, `next_cursor`
 *                the 20th row's created_at when a 21st exists and null
 *                otherwise; `cursor` keeps rows strictly older than it;
 *                `unread_count` counts the caller's unread rows only;
 *   POST         the guards first (anonymous 401, not onboarded 403), then
 *                `?action=mark-all-read` marks only the caller's unread rows
 *                and answers `{ success: true }`; any other or absent action
 *                answers 400 `{"error":"Invalid action"}` with no write;
 *   PATCH [id]   anonymous 401; marks the caller's own row read and answers
 *                `{ success: true }`; another user's id answers the same
 *                success and changes nothing (the `user_id` filter);
 *   count GET    a signed-in caller gets `{ unread_count: n }` for their own
 *                unread rows.
 *
 * Not pinned here: the 500 bodies that echo `error.message` (F-059, moved in
 * slice 7) and count's anonymous 200 (F-028), which is in
 * `notifications-count-defect.test.ts`. There is no DELETE arm in these
 * files, so no delete row exists.
 *
 * Seam: `@/lib/supabase/server` returns the cookie fake.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

type ListGET = (typeof import("@/app/api/notifications/route"))["GET"];
type ListPOST = (typeof import("@/app/api/notifications/route"))["POST"];
type ItemPATCH = (typeof import("@/app/api/notifications/[id]/route"))["PATCH"];
type CountGET = (typeof import("@/app/api/notifications/count/route"))["GET"];

let mockCookie: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Fixture ───────────────────────────────────────────────────────────────

const CALLER = {
  id: "06000000-0000-4000-8000-000000000011",
  email: "slice6.notify@mail.mcgill.ca",
};
const OTHER = "06000000-0000-4000-8000-000000000012";

function nid(n: number): string {
  return `06000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
}

/** Minute n of 2026-09-01; a larger n is newer. */
function at(n: number): string {
  return `2026-09-01T10:${String(n).padStart(2, "0")}:00.000Z`;
}

/** 25 caller rows (1..25, newest is 25; odd ids unread) and 2 of another user. */
function notificationRows(count = 25): FakeRow[] {
  const rows: FakeRow[] = [];
  for (let n = 1; n <= count; n += 1) {
    rows.push({
      id: nid(n),
      user_id: CALLER.id,
      type: "event_reminder",
      title: `Notification ${n}`,
      message: `Message ${n}`,
      read: n % 2 === 0,
      created_at: at(n),
    });
  }
  rows.push(
    { id: nid(90), user_id: OTHER, type: "event_reminder", title: "Other A", message: "x", read: false, created_at: at(59) },
    { id: nid(91), user_id: OTHER, type: "event_reminder", title: "Other B", message: "x", read: false, created_at: at(58) }
  );
  return rows;
}

function callerRow(onboarded = true): FakeRow {
  return {
    id: CALLER.id,
    email: CALLER.email,
    roles: ["user"],
    onboarding_completed: onboarded,
    banned_at: null,
    ban_expires_at: null,
  };
}

function signedIn(
  opts: { onboarded?: boolean; count?: number } = {}
): FakeSupabaseInit {
  return {
    user: CALLER,
    tables: {
      users: [callerRow(opts.onboarded ?? true)],
      notifications: notificationRows(opts.count ?? 25),
    },
  };
}

const ANONYMOUS: FakeSupabaseInit = {
  user: null,
  tables: { users: [], notifications: notificationRows() },
};

function use(init: FakeSupabaseInit): void {
  mockCookie = createFakeSupabase(init);
}

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

function writes(): FakeCall[] {
  return mockCookie.calls.filter((c) =>
    ["insert", "update", "delete"].includes(c.operation)
  );
}

function row(id: string): FakeRow {
  return mockCookie.tables.notifications.find((r) => r.id === id)!;
}

const BASE = "http://localhost:3000/api/notifications";

// ─── list GET ──────────────────────────────────────────────────────────────

describe("notifications GET (list)", () => {
  async function list(query = "") {
    const GET: ListGET = (await import("@/app/api/notifications/route")).GET;
    return json(await GET(new NextRequest(`${BASE}${query}`)));
  }

  it("anonymous → 401 Unauthorized", async () => {
    use(ANONYMOUS);
    expect(await list()).toEqual({ status: 401, body: { error: "Unauthorized" } });
  });

  it("auth error → 401 Unauthorized", async () => {
    use({ ...signedIn(), user: null, authError: { message: "jwt expired", status: 401 } });
    expect(await list()).toEqual({ status: 401, body: { error: "Unauthorized" } });
  });

  it("first page: the caller's 20 newest, next_cursor = the 20th's created_at, unread_count of the caller only", async () => {
    use(signedIn());
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(["notifications", "unread_count", "next_cursor"]);
    const ids = (body.notifications as Array<{ id: string }>).map((n) => n.id);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => nid(25 - i)));
    expect(body.next_cursor).toBe(at(6));
    expect(body.unread_count).toBe(13);
  });

  it("cursor: rows strictly older than the cursor; the last page has next_cursor null", async () => {
    use(signedIn());
    const { status, body } = await list(`?cursor=${encodeURIComponent(at(6))}`);
    expect(status).toBe(200);
    const ids = (body.notifications as Array<{ id: string }>).map((n) => n.id);
    expect(ids).toEqual([nid(5), nid(4), nid(3), nid(2), nid(1)]);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(13);
  });

  it("exactly 20 rows: one page, next_cursor null", async () => {
    use(signedIn({ count: 20 }));
    const { body } = await list();
    expect((body.notifications as unknown[]).length).toBe(20);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(10);
  });
});

// ─── POST ──────────────────────────────────────────────────────────────────

describe("notifications POST", () => {
  async function post(query: string) {
    const POST: ListPOST = (await import("@/app/api/notifications/route")).POST;
    return json(await POST(new NextRequest(`${BASE}${query}`, { method: "POST" })));
  }

  it("anonymous → 401 Unauthorized before the action is read", async () => {
    use(ANONYMOUS);
    expect(await post("?action=bogus")).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(writes()).toHaveLength(0);
  });

  it("not onboarded → 403 Onboarding required before the action is read", async () => {
    use(signedIn({ onboarded: false }));
    expect(await post("?action=bogus")).toEqual({
      status: 403,
      body: { error: "Onboarding required" },
    });
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ["no action", ""],
    ["an unknown action", "?action=delete-all"],
    ["an empty action", "?action="],
    ["a case variant", "?action=MARK-ALL-READ"],
  ])("%s → 400 Invalid action, no write", async (_label, query) => {
    use(signedIn());
    expect(await post(query)).toEqual({
      status: 400,
      body: { error: "Invalid action" },
    });
    expect(writes()).toHaveLength(0);
  });

  it("mark-all-read → 200 { success: true }; only the caller's rows become read", async () => {
    use(signedIn());
    expect(await post("?action=mark-all-read")).toEqual({
      status: 200,
      body: { success: true },
    });
    const all = mockCookie.tables.notifications;
    expect(all.filter((r) => r.user_id === CALLER.id).every((r) => r.read)).toBe(true);
    expect(row(nid(90)).read).toBe(false);
    expect(row(nid(91)).read).toBe(false);
  });
});

// ─── PATCH [id] ────────────────────────────────────────────────────────────

describe("notifications/[id] PATCH", () => {
  async function patch(id: string) {
    const PATCH: ItemPATCH = (await import("@/app/api/notifications/[id]/route"))
      .PATCH;
    return json(
      await PATCH(new Request(`${BASE}/${id}`, { method: "PATCH" }), {
        params: Promise.resolve({ id }),
      })
    );
  }

  it("anonymous → 401 Unauthorized, no write", async () => {
    use(ANONYMOUS);
    expect(await patch(nid(1))).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(writes()).toHaveLength(0);
  });

  it("own unread row → 200 { success: true } and the row is read", async () => {
    use(signedIn());
    expect(row(nid(1)).read).toBe(false);
    expect(await patch(nid(1))).toEqual({ status: 200, body: { success: true } });
    expect(row(nid(1)).read).toBe(true);
    expect(row(nid(3)).read).toBe(false);
  });

  it("another user's row → the same 200 success, and nothing changes", async () => {
    use(signedIn());
    expect(await patch(nid(90))).toEqual({ status: 200, body: { success: true } });
    expect(row(nid(90)).read).toBe(false);
  });
});

// ─── count GET (signed in) ─────────────────────────────────────────────────

describe("notifications/count GET, signed in", () => {
  it("answers { unread_count } for the caller's own unread rows", async () => {
    use(signedIn());
    const GET: CountGET = (await import("@/app/api/notifications/count/route")).GET;
    expect(await json(await GET())).toEqual({
      status: 200,
      body: { unread_count: 13 },
    });
  });

  it("a caller with no unread rows gets { unread_count: 0 }", async () => {
    use({ ...signedIn(), tables: { users: [callerRow()], notifications: [] } });
    const GET: CountGET = (await import("@/app/api/notifications/count/route")).GET;
    expect(await json(await GET())).toEqual({
      status: 200,
      body: { unread_count: 0 },
    });
  });
});
