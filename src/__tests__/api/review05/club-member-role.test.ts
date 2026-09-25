/**
 * PATCH /api/clubs/[id]/members/role scopes its elevated write
 * (REVIEW-05 WR-03).
 *
 * The club scope and the not-an-owner rule used to rest on a separate read
 * on the cookie client; the service-role update filtered on the membership
 * id alone. The write now re-states both as filters, and a write that
 * matches nothing (the target became the owner, or the row is another
 * club's) answers 409 instead of 500 or a wrong-row write.
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

type Route = typeof import("@/app/api/clubs/[id]/members/role/route");

function asOwner(elevated: Answers): void {
  mockCookie = makeFake({
    user: STUDENT,
    profile: profileOf(STUDENT.id, ["user"]),
    answers: {
      "club_members.select": [
        { data: { role: "owner" } },
        { data: { user_id: OTHER, role: "organizer" } },
      ],
    },
  });
  mockElevated = makeFake({ answers: elevated });
}

async function patch() {
  const { PATCH }: Route = await import("@/app/api/clubs/[id]/members/role/route");
  return PATCH(
    jsonRequest(`clubs/${CLUB_ID}/members/role`, "PATCH", {
      memberId: MEMBERSHIP_ID,
      role: "organizer",
    }),
    idParams(CLUB_ID)
  );
}

afterEach(() => jest.restoreAllMocks());

it("the elevated update is filtered by id, club and not-owner", async () => {
  asOwner({
    "club_members.update": { data: { id: MEMBERSHIP_ID, role: "organizer" } },
  });
  const res = await patch();
  expect(res.status).toBe(200);
  const [update] = callsTo(mockElevated, "club_members", "update");
  expect(update.filters).toEqual([
    { op: "eq", column: "id", value: MEMBERSHIP_ID },
    { op: "eq", column: "club_id", value: CLUB_ID },
    { op: "neq", column: "role", value: "owner" },
  ]);
});

it("an update that matches no row (the target became the owner) answers 409", async () => {
  asOwner({ "club_members.update": { data: null } });
  const res = await patch();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "Member changed concurrently. Please refresh and try again.",
  });
});

it("any other database error still answers 500", async () => {
  asOwner({ "club_members.update": { error: { message: "boom", code: "XX000" } } });
  const res = await patch();
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "Failed to update role" });
});
