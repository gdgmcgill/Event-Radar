/**
 * Service-role routing: which client performs each operation (plan 05-15,
 * REFAC-13, DEC-49).
 *
 * After 05-15 a route reaches the service role only through
 * `getElevatedClient()` (`src/server/db/elevated`), and only for an operation
 * no existing RLS policy permits. Every operation a policy already permits
 * runs on the caller's cookie client. This suite drives each migrated
 * handler's success path and records, per client, the ordered list of
 * `<table>.<operation>` calls, so a later edit that moves an operation to the
 * other client turns a row red.
 *
 * Seams:
 *   - `@/lib/supabase/server` returns the cookie fake A (the request context's
 *     client, and the client a route builds itself);
 *   - `@/lib/supabase/service` returns the elevated fake B. The door wraps this
 *     module, so a door call lands on B, and so does the audit writer
 *     (`logAdminAction`, a door caller since 05-14).
 *
 * The request context's own profile read (`users` with the context's five
 * columns) is left out of A's list: it belongs to the context, not to the
 * handler. Every other call is listed, in order.
 *
 * The fakes are deliberately thin: each call resolves from a per-test answer
 * map keyed `<table>.<operation>`, so the suite pins routing, not query
 * semantics. The query shapes are pinned by the PRESERVE and DEFECT suites.
 */

import { NextRequest } from "next/server";

// ─── A thin recording fake ─────────────────────────────────────────────────

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

interface Answer {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

type Answers = Record<string, Answer>;

interface RecordingFake {
  client: unknown;
  calls: string[];
}

const PROFILE_COLUMNS =
  "id, roles, onboarding_completed, banned_at, ban_expires_at";

interface FakeOptions {
  user?: { id: string; email: string } | null;
  profile?: Record<string, unknown> | null;
  answers?: Answers;
}

function makeFake(options: FakeOptions = {}): RecordingFake {
  const calls: string[] = [];
  const answers = options.answers ?? {};

  function builder(table: string) {
    let operation: Operation = "select";
    let columns: string | null = null;
    let terminal: "then" | "single" | "maybeSingle" = "then";

    const resolve = () => {
      const isContextRead =
        table === "users" && operation === "select" && columns === PROFILE_COLUMNS;
      if (isContextRead) {
        return { data: options.profile ?? null, error: null, count: null };
      }
      calls.push(`${table}.${operation}`);
      const answer = answers[`${table}.${operation}`] ?? {};
      const error = answer.error ?? null;
      let data: unknown = answer.data ?? null;
      if (terminal !== "then" && Array.isArray(data)) data = data[0] ?? null;
      if (terminal === "single" && data === null && error === null) {
        return {
          data: null,
          error: { code: "PGRST116", message: "no rows" },
          count: null,
        };
      }
      return {
        data,
        error,
        count: Array.isArray(data) ? data.length : null,
      };
    };

    const chain: Record<string, unknown> = {};
    const passthrough = [
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "or",
      "gte",
      "lte",
      "gt",
      "lt",
      "ilike",
      "like",
      "contains",
      "overlaps",
      "order",
      "range",
      "limit",
    ];
    for (const method of passthrough) chain[method] = () => chain;
    chain.select = (cols?: string) => {
      if (operation === "select") columns = cols ?? "*";
      return chain;
    };
    for (const op of ["insert", "update", "upsert", "delete"] as const) {
      chain[op] = () => {
        operation = op;
        return chain;
      };
    }
    chain.single = () => {
      terminal = "single";
      return chain;
    };
    chain.maybeSingle = () => {
      terminal = "maybeSingle";
      return chain;
    };
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve().then(resolve).then(onFulfilled, onRejected);
    return chain;
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: null,
      }),
    },
    from: (table: string) => builder(table),
    rpc: (name: string) => {
      const settle = () => {
        calls.push(`rpc:${name}`);
        const answer = answers[`rpc:${name}`] ?? {};
        return { data: answer.data ?? null, error: answer.error ?? null };
      };
      return {
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve().then(settle).then(onFulfilled, onRejected),
      };
    },
    storage: {
      from: (bucket: string) => ({
        upload: async () => {
          calls.push(`storage:${bucket}.upload`);
          return { data: { path: "x" }, error: null };
        },
        getPublicUrl: (path: string) => {
          calls.push(`storage:${bucket}.getPublicUrl`);
          return { data: { publicUrl: `http://storage.test/${bucket}/${path}` } };
        },
      }),
    },
  };

  return { client, calls };
}

// ─── Seams ─────────────────────────────────────────────────────────────────

let mockCookie: RecordingFake;
let mockElevated: RecordingFake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

// ─── Personas and fixtures (synthetic ids, not seed ids) ───────────────────

const ADMIN = { id: "5eed0000-0000-4000-8000-0a5150000001", email: "routing.admin@mail.mcgill.ca" };
const STUDENT = { id: "5eed0000-0000-4000-8000-0a5150000002", email: "routing.student@mail.mcgill.ca" };
const OTHER = "5eed0000-0000-4000-8000-0a5150000003";
const CLUB_ID = "5eed0000-0000-4000-8000-0a51500000c1";
const EVENT_ID = "5eed0000-0000-4000-8000-0a51500000e1";
const REQUEST_ID = "5eed0000-0000-4000-8000-0a51500000f1";
const REPORT_ID = "5eed0000-0000-4000-8000-0a51500000a1";

function profileOf(id: string, roles: string[]) {
  return {
    id,
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

function asAdmin(cookie: Answers, elevated: Answers = {}): void {
  mockCookie = makeFake({
    user: ADMIN,
    profile: profileOf(ADMIN.id, ["user", "admin"]),
    answers: cookie,
  });
  mockElevated = makeFake({ answers: elevated });
}

function asStudent(cookie: Answers, elevated: Answers = {}): void {
  mockCookie = makeFake({
    user: STUDENT,
    profile: profileOf(STUDENT.id, ["user"]),
    answers: cookie,
  });
  mockElevated = makeFake({ answers: elevated });
}

const BASE = "http://localhost:3000/api";

function jsonRequest(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`${BASE}/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Admin family (Task 1) ─────────────────────────────────────────────────

describe("admin/clubs/[id] PATCH", () => {
  type Route = typeof import("@/app/api/admin/clubs/[id]/route");

  it("approve: club, review and owner membership on the cookie client; roles and notification through the door", async () => {
    asAdmin({
      "clubs.select": {
        data: { id: CLUB_ID, name: "Routing Club", status: "pending", created_by: OTHER, appeal_count: 1 },
      },
      "users.select": { data: { roles: ["user"] } },
    });
    const { PATCH }: Route = await import("@/app/api/admin/clubs/[id]/route");
    const res = await PATCH(
      jsonRequest(`admin/clubs/${CLUB_ID}`, "PATCH", { status: "approved" }),
      idParams(CLUB_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual([
      "clubs.select",
      "clubs.update",
      "moderation_reviews.insert",
      "users.select",
      "club_members.upsert",
    ]);
    expect(mockElevated.calls).toEqual([
      "admin_audit_log.insert",
      "users.update",
      "notifications.insert",
    ]);
  });

  it("reject: the review on the cookie client; only the notification through the door", async () => {
    asAdmin({
      "clubs.select": {
        data: { id: CLUB_ID, name: "Routing Club", status: "pending", created_by: OTHER, appeal_count: 0 },
      },
    });
    const { PATCH }: Route = await import("@/app/api/admin/clubs/[id]/route");
    const res = await PATCH(
      jsonRequest(`admin/clubs/${CLUB_ID}`, "PATCH", {
        status: "rejected",
        category: "other",
        message: "Not a club",
      }),
      idParams(CLUB_ID)
    );

    expect(res.status).toBe(200);
    expect(mockCookie.calls).toEqual([
      "clubs.select",
      "clubs.update",
      "moderation_reviews.insert",
    ]);
    expect(mockElevated.calls).toEqual(["admin_audit_log.insert", "notifications.insert"]);
  });
});

describe("admin/events/[id]/edits PATCH", () => {
  type Route = typeof import("@/app/api/admin/events/[id]/edits/route");

  it("approve: event read and update on the cookie client; notification through the door", async () => {
    asAdmin({
      "events.select": {
        data: { id: EVENT_ID, title: "Routing Event", pending_edits: { title: "New" }, created_by: OTHER },
      },
      "events.update": { data: [{ id: EVENT_ID }] },
    });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/edits/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "approve" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: "Edits approved" });
    expect(mockCookie.calls).toEqual(["events.select", "events.update"]);
    expect(mockElevated.calls).toEqual(["notifications.insert", "admin_audit_log.insert"]);
  });

  it("reject: the same split", async () => {
    asAdmin({
      "events.select": {
        data: { id: EVENT_ID, title: "Routing Event", pending_edits: { title: "New" }, created_by: OTHER },
      },
      "events.update": { data: [{ id: EVENT_ID }] },
    });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/edits/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "reject", reason: "No" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    expect(mockCookie.calls).toEqual(["events.select", "events.update"]);
    expect(mockElevated.calls).toEqual(["notifications.insert", "admin_audit_log.insert"]);
  });
});

describe("admin/events/[id]/status PATCH", () => {
  type Route = typeof import("@/app/api/admin/events/[id]/status/route");

  it("approve after an appeal: event and review on the cookie client; notification upsert through the door", async () => {
    asAdmin({
      "events.select": {
        data: { title: "Routing Event", created_by: OTHER, status: "pending", appeal_count: 1 },
      },
    });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/status/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/status`, "PATCH", { status: "approved" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual([
      "events.select",
      "events.update",
      "moderation_reviews.insert",
    ]);
    expect(mockElevated.calls).toEqual(["admin_audit_log.insert", "notifications.upsert"]);
  });

  it("suspend: the same split, with a notification insert", async () => {
    asAdmin({
      "events.select": {
        data: { title: "Routing Event", created_by: OTHER, status: "approved", appeal_count: 0 },
      },
    });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/status/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/status`, "PATCH", {
        status: "suspended",
        category: "other",
        message: "Paused",
      }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    expect(mockCookie.calls).toEqual([
      "events.select",
      "events.update",
      "moderation_reviews.insert",
    ]);
    expect(mockElevated.calls).toEqual(["admin_audit_log.insert", "notifications.insert"]);
  });
});

describe("admin/organizer-requests/[id] PATCH", () => {
  type Route = typeof import("@/app/api/admin/organizer-requests/[id]/route");

  it("approve: request, roles read, membership and club read on the cookie client; roles write and notification through the door", async () => {
    asAdmin({
      "organizer_requests.select": {
        data: { id: REQUEST_ID, user_id: OTHER, club_id: CLUB_ID, status: "pending" },
      },
      "users.select": { data: { roles: ["user"] } },
      "clubs.select": { data: { name: "Routing Club" } },
    });
    const { PATCH }: Route = await import("@/app/api/admin/organizer-requests/[id]/route");
    const res = await PATCH(
      jsonRequest(`admin/organizer-requests/${REQUEST_ID}`, "PATCH", { status: "approved" }),
      idParams(REQUEST_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual([
      "organizer_requests.select",
      "organizer_requests.update",
      "users.select",
      "club_members.upsert",
      "clubs.select",
    ]);
    expect(mockElevated.calls).toEqual([
      "admin_audit_log.insert",
      "users.update",
      "notifications.insert",
    ]);
  });
});

describe("admin/organizers GET", () => {
  it("every read on the cookie client; nothing through the door", async () => {
    asAdmin({
      "users.select": {
        data: [{ id: OTHER, name: "Org", email: "org@mail.mcgill.ca", roles: ["user", "club_organizer"] }],
      },
      "club_members.select": { data: [{ user_id: OTHER, club_id: CLUB_ID, clubs: { id: CLUB_ID, name: "Routing Club" } }] },
      "events.select": { data: [{ created_by: OTHER }] },
    });
    const { GET } = await import("@/app/api/admin/organizers/route");
    const res = await GET(new NextRequest(`${BASE}/admin/organizers`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizers[0]).toMatchObject({ id: OTHER, event_count: 1 });
    expect(mockCookie.calls).toEqual(["users.select", "club_members.select", "events.select"]);
    expect(mockElevated.calls).toEqual([]);
  });
});

describe("admin/reports GET", () => {
  it("every read on the cookie client; nothing through the door", async () => {
    asAdmin({
      "event_reports.select": { data: [{ id: REPORT_ID, event_id: EVENT_ID, status: "pending" }] },
    });
    const { GET } = await import("@/app/api/admin/reports/route");
    const res = await GET(new NextRequest(`${BASE}/admin/reports`));

    expect(res.status).toBe(200);
    expect((await res.json()).reports[0]).toMatchObject({ id: REPORT_ID, report_count: 1 });
    expect(mockCookie.calls).toEqual(["event_reports.select", "event_reports.select"]);
    expect(mockElevated.calls).toEqual([]);
  });
});

describe("admin/reports/[id] PATCH", () => {
  type Route = typeof import("@/app/api/admin/reports/[id]/route");

  it("read and update on the cookie client; only the audit writer through the door", async () => {
    asAdmin({
      "event_reports.select": { data: { id: REPORT_ID, event_id: EVENT_ID, status: "pending" } },
    });
    const { PATCH }: Route = await import("@/app/api/admin/reports/[id]/route");
    const res = await PATCH(
      jsonRequest(`admin/reports/${REPORT_ID}`, "PATCH", { status: "reviewed" }),
      idParams(REPORT_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual(["event_reports.select", "event_reports.update"]);
    expect(mockElevated.calls).toEqual(["admin_audit_log.insert"]);
  });
});

describe("admin/users/[id]/ban", () => {
  type Route = typeof import("@/app/api/admin/users/[id]/ban/route");

  it("POST with suspend_content: reads and content suspension on the cookie client; ban columns and notification through the door", async () => {
    asAdmin({
      "users.select": { data: { id: OTHER, name: "Target", banned_at: null, roles: ["user"] } },
      "events.select": { data: [{ id: EVENT_ID, title: "Routing Event" }] },
      "clubs.select": { data: [{ id: CLUB_ID, name: "Routing Club" }] },
    });
    const { POST }: Route = await import("@/app/api/admin/users/[id]/ban/route");
    const res = await POST(
      jsonRequest(`admin/users/${OTHER}/ban`, "POST", {
        reason: "Spam",
        duration_days: 7,
        suspend_content: true,
      }),
      idParams(OTHER)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual([
      "users.select",
      "events.select",
      "clubs.select",
      "events.update",
      "moderation_reviews.insert",
      "clubs.update",
      "moderation_reviews.insert",
    ]);
    expect(mockElevated.calls).toEqual([
      "users.update",
      "notifications.insert",
      "admin_audit_log.insert",
    ]);
  });

  it("DELETE: the read on the cookie client; clearing the ban and the notification through the door", async () => {
    asAdmin({
      "users.select": { data: { id: OTHER, name: "Target", banned_at: "2026-01-01T00:00:00.000Z" } },
    });
    const { DELETE }: Route = await import("@/app/api/admin/users/[id]/ban/route");
    const res = await DELETE(jsonRequest(`admin/users/${OTHER}/ban`, "DELETE"), idParams(OTHER));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCookie.calls).toEqual(["users.select"]);
    expect(mockElevated.calls).toEqual([
      "users.update",
      "notifications.insert",
      "admin_audit_log.insert",
    ]);
  });
});

// Used by the non-admin family below; referenced here so the persona builder
// is type-checked with the admin family.
void asStudent;
