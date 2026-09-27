/** DI-62: preflight authorization and atomic transfer boundary. SQL rollback
 * and competing-session probes verify memberships/audit consistency. */
import { CLUB_ID, MEMBERSHIP_ID, OTHER, STUDENT, callsTo, idParams, jsonRequest, makeFake, profileOf, type Answers, type Fake } from "./fake";
let mockCookie: Fake;
let mockElevated: Fake;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mockElevated.client, serviceRoleKey: () => "test-key" }));
function asOwner(answer: Answers = { "rpc:transfer_club_ownership_atomic": { data: "ok" } }, target = OTHER) {
  mockCookie = makeFake({ user: STUDENT, profile: profileOf(STUDENT.id, ["user"]), answers: {
    "club_members.select": [{ data: { role: "owner" } }, { data: { id: MEMBERSHIP_ID, role: "organizer", user_id: target } }],
  } });
  mockElevated = makeFake({ answers: answer });
}
async function transfer(newOwnerId: string) {
  const { POST } = await import("@/app/api/clubs/[id]/transfer/route");
  return POST(jsonRequest(`clubs/${CLUB_ID}/transfer`, "POST", { newOwnerId }), idParams(CLUB_ID));
}
beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());
it.each([STUDENT.id, STUDENT.id.toUpperCase()])("self-transfer %s cannot reach the writer", async id => {
  asOwner(undefined, STUDENT.id);
  const response = await transfer(id);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "You already own this club" });
  expect(mockElevated.calls).toHaveLength(0);
});
it("promotes, demotes and audits via one server transaction", async () => {
  asOwner();
  const response = await transfer(OTHER);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(mockElevated.calls).toHaveLength(1);
  expect(callsTo(mockElevated, "rpc:transfer_club_ownership_atomic", "select")[0].payload).toEqual({ p_club_id: CLUB_ID, p_actor_id: STUDENT.id, p_new_owner_id: OTHER });
});
it("a concurrent membership change returns 409 without app-level rollback writes", async () => {
  asOwner({ "rpc:transfer_club_ownership_atomic": { data: "conflict" } });
  expect((await transfer(OTHER)).status).toBe(409);
  expect(mockElevated.calls).toHaveLength(1);
});
it("a transaction/audit failure returns private 500", async () => {
  asOwner({ "rpc:transfer_club_ownership_atomic": { error: { message: "audit failed" } } });
  const response = await transfer(OTHER);
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(console.error).toHaveBeenCalled();
});
