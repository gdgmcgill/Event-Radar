/**
 * PATCH /api/admin/events/[id]/status: the creator's moderation notification
 * is actually written, once per (creator, event, type) (REVIEW-05 iter3 WR-07).
 *
 * notifications_dedup_idx is UNIQUE (user_id, event_id, type) WHERE event_id
 * IS NOT NULL. The approval arm upserted with
 * `onConflict: "user_id,event_id,type"`; Postgres cannot infer a partial
 * index from that, so every approval failed with 42P10 (reproduced on the
 * local stack), and nothing read the error. The rejection and suspension
 * arms inserted, which collides (23505) on a second rejection or suspension
 * after an appeal. The handler now reads the existing row first and updates
 * it (new text, unread, re-dated), or inserts one when there is none, and
 * logs every error. The real-stack assertion that an approval produces
 * exactly one notification is in e2e/specs/admin-write-paths.spec.ts.
 */

import {
  ADMIN,
  EVENT_ID,
  OTHER,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  type Answers,
  type Fake,
} from "./fake";

let mockCookie: Fake;
let mockElevated: Fake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

type Route = typeof import("@/app/api/admin/events/[id]/status/route");

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function asAdmin(eventStatus: string, elevated: Answers = {}): void {
  mockCookie = makeFake({
    user: ADMIN,
    profile: profileOf(ADMIN.id, ["user", "admin"]),
    answers: {
      "events.select": {
        data: { title: "Review Event", created_by: OTHER, status: eventStatus, appeal_count: 1 },
      },
    },
  });
  mockElevated = makeFake({ answers: elevated });
}

async function decide(body: Record<string, unknown>) {
  const { PATCH }: Route = await import("@/app/api/admin/events/[id]/status/route");
  return PATCH(
    jsonRequest(`admin/events/${EVENT_ID}/status`, "PATCH", body),
    idParams(EVENT_ID)
  );
}

function logged(fragment: string): boolean {
  return errorSpy.mock.calls.some((c) => String(c[0]).includes(fragment));
}

it("an approval with no prior notification inserts exactly one event_approved row, never upserts", async () => {
  asAdmin("pending", { "notifications.select": { data: null } });
  const res = await decide({ status: "approved" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });

  expect(callsTo(mockElevated, "notifications", "upsert")).toHaveLength(0);
  const [read] = callsTo(mockElevated, "notifications", "select");
  expect(read.filters).toEqual([
    { op: "eq", column: "user_id", value: OTHER },
    { op: "eq", column: "event_id", value: EVENT_ID },
    { op: "eq", column: "type", value: "event_approved" },
  ]);
  const inserts = callsTo(mockElevated, "notifications", "insert");
  expect(inserts).toHaveLength(1);
  expect(inserts[0].payload).toMatchObject({
    user_id: OTHER,
    type: "event_approved",
    title: "Event Approved!",
    message: 'Your event "Review Event" has been approved and is now live.',
    event_id: EVENT_ID,
    read: false,
  });
  expect(callsTo(mockElevated, "notifications", "update")).toHaveLength(0);
});

it("a second approval (after a suspension) refreshes the existing row instead of inserting", async () => {
  asAdmin("suspended", { "notifications.select": { data: { id: "note-1" } } });
  const res = await decide({ status: "approved" });
  expect(res.status).toBe(200);
  expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
  const [update] = callsTo(mockElevated, "notifications", "update");
  expect(update.filters).toEqual([{ op: "eq", column: "id", value: "note-1" }]);
  expect(update.payload).toMatchObject({
    title: "Event Approved!",
    message: 'Your event "Review Event" has been approved and is now live.',
    read: false,
  });
});

it("a re-rejection after an appeal refreshes the event_rejected row with the new reason", async () => {
  asAdmin("pending", { "notifications.select": { data: { id: "note-2" } } });
  const res = await decide({ status: "rejected", category: "other", message: "Second look: no" });
  expect(res.status).toBe(200);
  const [read] = callsTo(mockElevated, "notifications", "select");
  expect(read.filters).toContainEqual({ op: "eq", column: "type", value: "event_rejected" });
  const [update] = callsTo(mockElevated, "notifications", "update");
  expect((update.payload as { message: string }).message).toContain("Second look: no");
  expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
});

it("a first suspension inserts one event_suspended row", async () => {
  asAdmin("approved", { "notifications.select": { data: null } });
  const res = await decide({ status: "suspended", category: "other", message: "Paused" });
  expect(res.status).toBe(200);
  const inserts = callsTo(mockElevated, "notifications", "insert");
  expect(inserts).toHaveLength(1);
  expect(inserts[0].payload).toMatchObject({ type: "event_suspended", user_id: OTHER });
});

it("a failed notification write is logged; the decision still answers 200", async () => {
  asAdmin("pending", {
    "notifications.select": { data: null },
    "notifications.insert": { error: { code: "42P10", message: "no matching constraint" } },
  });
  const res = await decide({ status: "approved" });
  expect(res.status).toBe(200);
  expect(logged("[Admin] Failed to send notification")).toBe(true);
});

it("a failed read of the existing notification is logged and nothing is written", async () => {
  asAdmin("pending", { "notifications.select": { error: { message: "read down" } } });
  const res = await decide({ status: "approved" });
  expect(res.status).toBe(200);
  expect(logged("[Admin] Failed to read existing notification")).toBe(true);
  expect(callsTo(mockElevated, "notifications", "insert")).toHaveLength(0);
  expect(callsTo(mockElevated, "notifications", "update")).toHaveLength(0);
});
