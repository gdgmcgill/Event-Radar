/**
 * POST /api/admin/users/[id]/ban re-bans a user whose temporary ban has
 * expired (REVIEW-05 WR-05).
 *
 * Expiry never clears `banned_at` (only the unban arm does), so the raw
 * column answered 409 "User is already banned" for a user every other check
 * (`isBanned`) treats as active. The route now tests `isBanned()`.
 */

import {
  ADMIN,
  OTHER,
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

type Route = typeof import("@/app/api/admin/users/[id]/ban/route");

function asAdminBanning(target: Record<string, unknown>): void {
  mockCookie = makeFake({
    user: ADMIN,
    profile: profileOf(ADMIN.id, ["user", "admin"]),
    answers: {
      "users.select": { data: { id: OTHER, name: "Target", roles: ["user"], ...target } },
    },
  });
  mockElevated = makeFake();
}

async function ban() {
  const { POST }: Route = await import("@/app/api/admin/users/[id]/ban/route");
  return POST(
    jsonRequest(`admin/users/${OTHER}/ban`, "POST", { reason: "Spam", duration_days: 7 }),
    idParams(OTHER)
  );
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("an expired temporary ban does not block a new ban", async () => {
  asAdminBanning({
    banned_at: "2019-01-01T00:00:00.000Z",
    ban_expires_at: "2020-01-01T00:00:00.000Z",
  });
  const res = await ban();
  expect(res.status).toBe(200);
  const [update] = callsTo(mockElevated, "users", "update");
  expect(update.payload).toMatchObject({ ban_reason: "Spam", banned_by: ADMIN.id });
  expect((update.payload as { ban_expires_at: string }).ban_expires_at).toEqual(
    expect.any(String)
  );
});

it("an active temporary ban still answers 409", async () => {
  asAdminBanning({
    banned_at: "2026-01-01T00:00:00.000Z",
    ban_expires_at: "2099-01-01T00:00:00.000Z",
  });
  const res = await ban();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "User is already banned" });
  expect(callsTo(mockElevated, "users", "update")).toHaveLength(0);
});

it("a permanent ban still answers 409", async () => {
  asAdminBanning({ banned_at: "2026-01-01T00:00:00.000Z", ban_expires_at: null });
  const res = await ban();
  expect(res.status).toBe(409);
});

it("the target read selects ban_expires_at", async () => {
  asAdminBanning({ banned_at: null, ban_expires_at: null });
  await ban();
  const reads = callsTo(mockCookie, "users", "select");
  expect(reads[0].columns).toBe("id, name, banned_at, ban_expires_at, roles");
});
