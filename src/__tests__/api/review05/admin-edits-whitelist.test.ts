/** DI-68: the route transmits the reviewed snapshot; SQL pgTAP verifies
 * whitelisted publication and all-or-nothing audit/notification effects. */
import { ADMIN, EVENT_ID, OTHER, callsTo, idParams, jsonRequest, makeFake, profileOf, type Fake } from "./fake";
let mockCookie: Fake;
let mockElevated: Fake;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mockElevated.client, serviceRoleKey: () => "test-key" }));
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockCookie = makeFake({ user: ADMIN, profile: profileOf(ADMIN.id, ["user", "admin"]) });
  mockElevated = makeFake({ answers: { "rpc:review_event_edits_atomic": { data: "ok" } } });
});
afterEach(() => jest.restoreAllMocks());
async function review(body: unknown) {
  const { PATCH } = await import("@/app/api/admin/events/[id]/edits/route");
  return PATCH(jsonRequest(`admin/events/${EVENT_ID}/edits`, "PATCH", body), idParams(EVENT_ID));
}
it("binds approval to the displayed object and the authenticated admin, including unexpected keys", async () => {
  const snapshot = { title: "Reviewed", image_url: "https://example.test/img.png", created_by: OTHER, status: "rejected", submitted_at: "v1" };
  const response = await review({ action: "approve", expected_pending_edits: snapshot, actor_id: OTHER });
  expect(response.status).toBe(200);
  expect(mockCookie.calls).toHaveLength(0);
  expect(callsTo(mockElevated, "rpc:review_event_edits_atomic", "select")[0].payload).toEqual({ p_actor_id: ADMIN.id, p_event_id: EVENT_ID, p_action: "approve", p_expected_pending_edits: snapshot, p_reason: undefined });
});
it.each(["approve", "reject"])("%s refuses a stale version with 409", async action => {
  mockElevated = makeFake({ answers: { "rpc:review_event_edits_atomic": { data: "conflict" } } });
  const response = await review({ action, reason: "outdated", expected_pending_edits: { title: "Old" } });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "Pending edits were modified concurrently. Please refresh and try again." });
  expect(mockElevated.calls).toHaveLength(1);
});
it("refuses a decision without the reviewed snapshot before any elevated call", async () => {
  expect((await review({ action: "approve" })).status).toBe(400);
  expect(mockElevated.calls).toHaveLength(0);
});
it("preserves ordinary success and transaction failure responses", async () => {
  const body = { action: "approve", expected_pending_edits: { title: "New" } };
  expect(await (await review(body)).json()).toEqual({ success: true, message: "Edits approved" });
  mockElevated = makeFake({ answers: { "rpc:review_event_edits_atomic": { error: { message: "audit failed" } } } });
  const response = await review(body);
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
