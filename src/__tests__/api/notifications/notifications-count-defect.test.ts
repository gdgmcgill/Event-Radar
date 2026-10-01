/**
 * DEFECT characterization — F-028: notifications/count answered an anonymous
 * caller 200 (plan 06-02 pinned it; plan 06-04 fixed it, REFAC-15, DEC-69)
 *
 * `src/app/api/notifications/count/route.ts` returned `200 {"unread_count":0}`
 * when there was no user or `getUser` reported an error, where every other
 * protected read answers 401. Plan 06-04 moved this arm to
 * `createRequestContext()` + `requireUser`, so both rows now assert
 * `401 {"error":"Unauthorized"}` (INTENTIONAL BEHAVIOUR CHANGE, with a
 * defect-ledger row each citing F-028). The side navigation requests the
 * count only for a signed-in user, so anonymous pages do not poll it.
 *
 * Pinned after the fix:
 *   D1  anonymous → 401 `{ error: "Unauthorized" }`, and no notifications read;
 *   D2  a `getUser` auth error (expired token) → the same 401, no read.
 *
 * The signed-in count is pinned in `notifications-characterization.test.ts`
 * and did not move.
 *
 * Seam: `@/lib/supabase/server` returns the cookie fake.
 */

import {
  createFakeSupabase,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

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

const UNREAD = [
  {
    id: "06000000-0000-4000-8000-000000000201",
    user_id: "06000000-0000-4000-8000-000000000021",
    read: false,
    created_at: "2026-09-01T10:00:00.000Z",
  },
];

async function count(init: FakeSupabaseInit) {
  mockCookie = createFakeSupabase(init);
  const GET: CountGET = (await import("@/app/api/notifications/count/route")).GET;
  const response = await GET();
  return { status: response.status, body: await response.json() };
}

describe("F-028 fixed: anonymous notifications/count answers 401", () => {
  it("D1: anonymous → 401 Unauthorized, no notifications read", async () => {
    expect(
      await count({ user: null, tables: { notifications: UNREAD } })
    ).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(mockCookie.calls.filter((c) => c.table === "notifications")).toHaveLength(0);
  });

  it("D2: getUser auth error → the same 401 Unauthorized, no read", async () => {
    expect(
      await count({
        user: null,
        authError: { message: "invalid JWT: token is expired", status: 401 },
        tables: { notifications: UNREAD },
      })
    ).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(mockCookie.calls.filter((c) => c.table === "notifications")).toHaveLength(0);
  });
});
