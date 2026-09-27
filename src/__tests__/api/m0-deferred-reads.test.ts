/** M0 / DI-87/88: reset-schema reads and honest cache behavior. */
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fakeSupabase";
let mockDb: FakeSupabase;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockDb.client) }));
const id = "07000000-0000-4000-8000-000000000001";
const clubId = "07000000-0000-4000-8000-000000000002";
const req = (path: string) => new NextRequest(`http://localhost${path}`);
const error = { code: "08006", message: "private database details" };
beforeEach(() => { jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it("DI-87: admin clubs resolves creators without an impossible embedded FK", async () => {
  mockDb = createFakeSupabase({ user: { id }, tables: {
    users: [{ id, name: "Owner", email: "owner@mail.mcgill.ca", roles: ["admin"], onboarding_completed: true }],
    clubs: [{ id: clubId, name: "Club", created_by: id, status: "pending" }],
  } });
  const response = await (await import("@/app/api/admin/clubs/route")).GET(req("/api/admin/clubs"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ total: 1, clubs: [{ id: clubId, users: { name: "Owner", email: "owner@mail.mcgill.ca" } }] });
  expect(mockDb.calls.find((call) => call.table === "clubs")?.columns).toBe("*");
});

it("DI-87: organizer queue embeds the explicit subject foreign key", async () => {
  mockDb = createFakeSupabase({ user: { id }, tables: { users: [{ id, roles: ["admin"], onboarding_completed: true }] } });
  const response = await (await import("@/app/api/admin/organizer-requests/route")).GET(req("/api/admin/organizer-requests"));
  expect(response.status).toBe(200);
  expect(mockDb.calls.find((call) => call.table === "organizer_requests")?.columns).toContain("users!organizer_requests_user_id_fkey");
});

it.each(["GET", "POST"] as const)("DI-87: engagement %s uses the caller-scoped aggregate RPC", async (method) => {
  const summary = { user_id: id, total_views: 2, total_clicks: 1 };
  mockDb = createFakeSupabase({ user: { id }, tables: { users: [{ id, roles: ["user"], onboarding_completed: true }] }, rpc: { get_user_engagement: { data: summary, error: null } } });
  const response = await (await import("@/app/api/user/engagement/route"))[method]();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual(method === "GET" ? summary : { success: true, engagement: summary });
  expect(mockDb.calls.some((call) => call.table === "user_engagement_summary")).toBe(false);
  const rpc = mockDb.calls.find((call) => call.operation === "rpc");
  expect(rpc?.table).toBe("get_user_engagement");
  expect(rpc?.payload ?? {}).toEqual({});
});

it("DI-87: engagement query failure remains a private500", async () => {
  mockDb = createFakeSupabase({ user: { id }, rpc: { get_user_engagement: { data: null, error } } });
  const response = await (await import("@/app/api/user/engagement/route")).GET();
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).not.toContain(error.message);
});

it.each(["clubs", "club_followers"])("DI-88: %s read error is500/private rather than a shared404/false count", async (table) => {
  mockDb = createFakeSupabase({ tables: { clubs: [{ id: clubId }] }, errors: { [table]: error } });
  const response = await (await import("@/app/api/clubs/[id]/route")).GET(req(`/api/clubs/${clubId}`), { params: Promise.resolve({ id: clubId }) });
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).not.toContain(error.message);
});
it("DI-88: actual absence still answers404", async () => {
  mockDb = createFakeSupabase({});
  const response = await (await import("@/app/api/clubs/[id]/route")).GET(req(`/api/clubs/${clubId}`), { params: Promise.resolve({ id: clubId }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Club not found" });
});
