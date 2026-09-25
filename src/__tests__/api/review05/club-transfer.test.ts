/**
 * POST /api/clubs/[id]/transfer: self-transfer, rollback, audit error
 * (REVIEW-05 WR-02).
 *
 * - A self-transfer promoted and then demoted the owner's own row, leaving
 *   the club with no owner. It is now refused with 400 before any write.
 * - When the demotion fails, the rollback restores the target's ORIGINAL
 *   role (it used to write "owner" again, leaving two owners).
 * - A failed audit insert is logged, never silent.
 */

import {
  CLUB_ID,
  MEMBERSHIP_ID,
  OTHER,
  STUDENT,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  writes,
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

type Route = typeof import("@/app/api/clubs/[id]/transfer/route");

let errorSpy: jest.SpyInstance;

function asOwner(elevated: Answers = {}): void {
  mockCookie = makeFake({
    user: STUDENT,
    profile: profileOf(STUDENT.id, ["user"]),
    answers: {
      "club_members.select": [
        { data: { role: "owner" } }, // the owner gate
        { data: { id: MEMBERSHIP_ID, role: "organizer" } }, // the target
      ],
    },
  });
  mockElevated = makeFake({ answers: elevated });
}

async function transfer(newOwnerId: string) {
  const { POST }: Route = await import("@/app/api/clubs/[id]/transfer/route");
  return POST(
    jsonRequest(`clubs/${CLUB_ID}/transfer`, "POST", { newOwnerId }),
    idParams(CLUB_ID)
  );
}

beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("a self-transfer is refused with 400 and writes nothing", async () => {
  asOwner();
  const res = await transfer(STUDENT.id);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "You already own this club" });
  expect(writes(mockElevated)).toEqual([]);
  expect(writes(mockCookie)).toEqual([]);
});

it("a failed demotion rolls the target back to its original role, not to owner", async () => {
  asOwner({
    "club_members.update": [
      { data: null }, // promote
      { error: { message: "demote failed" } }, // demote
      { data: null }, // rollback
    ],
  });
  const res = await transfer(OTHER);
  expect(res.status).toBe(500);
  const updates = callsTo(mockElevated, "club_members", "update");
  expect(updates).toHaveLength(3);
  expect(updates[2].payload).toEqual({ role: "organizer" });
  expect(updates[2].filters).toEqual([
    { op: "eq", column: "id", value: MEMBERSHIP_ID },
  ]);
});

it("a failed audit insert still answers success but is logged", async () => {
  asOwner({ "admin_audit_log.insert": { error: { message: "audit down" } } });
  const res = await transfer(OTHER);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
  expect(
    errorSpy.mock.calls.some((c) =>
      String(c[0]).startsWith("[clubs/transfer] audit insert failed")
    )
  ).toBe(true);
});
