/**
 * PATCH /api/admin/events/[id]/edits approves only the moderated fields
 * (REVIEW-05 WR-01).
 *
 * `pending_edits` is creator-writable, and the approval update runs with the
 * admin's privileges. Before the fix every key but `submitted_at` was copied
 * onto the event, so a creator could stage `created_by`, `club_id` or
 * `status` for an unsuspecting admin to apply.
 */

import {
  ADMIN,
  EVENT_ID,
  OTHER,
  OTHER_CLUB_ID,
  THIRD,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
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

type Route = typeof import("@/app/api/admin/events/[id]/edits/route");

function asAdminWithPending(pending: Record<string, unknown>): void {
  mockCookie = makeFake({
    user: ADMIN,
    profile: profileOf(ADMIN.id, ["user", "admin"]),
    answers: {
      "events.select": {
        data: { id: EVENT_ID, title: "Old", pending_edits: pending, created_by: OTHER },
      },
      "events.update": { data: [{ id: EVENT_ID }] },
    },
  });
  mockElevated = makeFake();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("approve", () => {
  it("copies title and image_url, and nothing else, onto the event", async () => {
    asAdminWithPending({
      title: "New title",
      image_url: "https://images.example/new.png",
      created_by: THIRD,
      club_id: OTHER_CLUB_ID,
      status: "approved",
      deleted_at: null,
      submitted_at: "2026-09-25T00:00:00.000Z",
    });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/edits/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "approve" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    const [update] = callsTo(mockCookie, "events", "update");
    expect(update.payload).toEqual({
      pending_edits: null,
      title: "New title",
      image_url: "https://images.example/new.png",
    });
    const [audit] = callsTo(mockElevated, "admin_audit_log", "insert");
    expect((audit.payload as { metadata: unknown }).metadata).toEqual({
      approved_fields: ["title", "image_url"],
    });
  });

  it("a queue holding only forged keys clears the queue and applies nothing", async () => {
    asAdminWithPending({ created_by: THIRD, status: "approved" });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/edits/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "approve" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    const [update] = callsTo(mockCookie, "events", "update");
    expect(update.payload).toEqual({ pending_edits: null });
  });

  it("the ordinary title-only queue is applied as before", async () => {
    asAdminWithPending({ title: "New", submitted_at: "2026-09-25T00:00:00.000Z" });
    const { PATCH }: Route = await import("@/app/api/admin/events/[id]/edits/route");
    const res = await PATCH(
      jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "approve" }),
      idParams(EVENT_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: "Edits approved" });
    const [update] = callsTo(mockCookie, "events", "update");
    expect(update.payload).toEqual({ pending_edits: null, title: "New" });
  });
});
