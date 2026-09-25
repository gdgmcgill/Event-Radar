/**
 * DEFECT characterization — F-028: notifications/count answers an anonymous
 * caller 200 (plan 06-02, REFAC-15)
 *
 * `src/app/api/notifications/count/route.ts:12-14` returns
 * `200 {"unread_count":0}` when there is no user or `getUser` reports an
 * error, where every other protected read answers 401. DEC-69 moves this arm
 * to `requireUser`, so both rows below become
 * `401 {"error":"Unauthorized"}` (INTENTIONAL BEHAVIOUR CHANGE, with a
 * defect-ledger row citing F-028).
 *
 * Pinned today:
 *   D1  anonymous → 200 `{ unread_count: 0 }`, and no notifications read;
 *   D2  a `getUser` auth error (expired token) → the same 200, no read.
 *
 * The signed-in count is pinned in `notifications-characterization.test.ts`
 * and does not move. Values were measured before they were written.
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

describe("DEFECT F-028: anonymous notifications/count answers 200", () => {
  it("D1: anonymous → 200 { unread_count: 0 }, no notifications read", async () => {
    expect(
      await count({ user: null, tables: { notifications: UNREAD } })
    ).toEqual({ status: 200, body: { unread_count: 0 } });
    expect(mockCookie.calls.filter((c) => c.table === "notifications")).toHaveLength(0);
  });

  it("D2: getUser auth error → the same 200 { unread_count: 0 }, no read", async () => {
    expect(
      await count({
        user: null,
        authError: { message: "invalid JWT: token is expired", status: 401 },
        tables: { notifications: UNREAD },
      })
    ).toEqual({ status: 200, body: { unread_count: 0 } });
    expect(mockCookie.calls.filter((c) => c.table === "notifications")).toHaveLength(0);
  });
});
