import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fakeSupabase";
import { captureServerError } from "@/server/observability/sentry";

let mockCookie: FakeSupabase;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/server/observability/sentry", () => ({ captureServerError: jest.fn() }));

const failure = { code: "08006", message: "private database connection detail" };
const caller = { id: "06000000-0000-4000-8000-000000000011" };
const endpoints = [
  { path: "/api/clubs/new", table: "clubs", key: "clubs", load: async () => (await import("@/app/api/clubs/new/route")).GET() },
  { path: "/api/clubs/trending", table: "clubs", key: "clubs", load: async () => (await import("@/app/api/clubs/trending/route")).GET(new NextRequest("https://example.test/api/clubs/trending")) },
  { path: "/api/events/new", table: "events", key: "events", load: async () => (await import("@/app/api/events/new/route")).GET() },
];

beforeEach(() => {
  jest.mocked(captureServerError).mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it.each(endpoints)("$path: DB errors are reported and cannot enter shared caches", async ({ table, load }) => {
  mockCookie = createFakeSupabase({ errors: { [table]: failure } });
  const response = await load();
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).not.toContain(failure.message);
  expect(captureServerError).toHaveBeenCalledTimes(1);
  expect(captureServerError).toHaveBeenCalledWith(failure, expect.objectContaining({ requestId: response.headers.get("x-request-id") }));
});

it.each(endpoints)("$path: a successful empty read remains publicly cacheable", async ({ key, load }) => {
  mockCookie = createFakeSupabase({});
  const response = await load();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
  expect(await response.json()).toEqual({ [key]: [] });
  expect(captureServerError).not.toHaveBeenCalled();
});

it.each(endpoints.filter((endpoint) => endpoint.table === "clubs"))(
  "$path: enrichment failures do not cache fabricated zero counts", async ({ load }) => {
    mockCookie = createFakeSupabase({
      tables: { clubs: [{ id: "club-1", status: "approved" }] }, errors: { club_followers: failure },
    });
    const response = await load();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(captureServerError).toHaveBeenCalledTimes(1);
  }
);

it("notification count errors are 500, not a successful zero unread count", async () => {
  mockCookie = createFakeSupabase({ user: caller, errors: { notifications: failure } });
  const { GET } = await import("@/app/api/notifications/count/route");
  const response = await GET();
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: "Failed to fetch notification count" });
  expect(captureServerError).toHaveBeenCalledTimes(1);
});

it("a handled admin DB error keeps the response vocabulary and reports the actual cause once", async () => {
  mockCookie = createFakeSupabase({
    user: caller,
    tables: { users: [{ id: caller.id, roles: ["admin"], onboarding_completed: true }] },
    errors: { featured_events: failure },
  });
  const { GET } = await import("@/app/api/admin/featured/route");
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Internal server error" });
  expect(captureServerError).toHaveBeenCalledTimes(1);
  expect(captureServerError).toHaveBeenCalledWith(failure, expect.any(Object));
  expect(console.error).toHaveBeenCalledTimes(1);
});

it("a previously bare catch retains the thrown exception without changing its response body", async () => {
  mockCookie = createFakeSupabase({
    user: caller,
    tables: { users: [{ id: caller.id, roles: ["admin"], onboarding_completed: true }] },
    throwOn: { featured_events: "original failure" },
  });
  const { GET } = await import("@/app/api/admin/featured/route");
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Failed to fetch featured events" });
  expect(captureServerError).toHaveBeenCalledTimes(1);
  expect(captureServerError).toHaveBeenCalledWith(expect.objectContaining({ message: "original failure" }), expect.any(Object));
  expect(console.error).toHaveBeenCalledTimes(1);
});

it.each(["0", "-1", "abc"])("invalid audit page %s issues a valid first-page range", async (page) => {
  mockCookie = createFakeSupabase({
    user: caller,
    tables: { users: [{ id: caller.id, roles: ["admin"], onboarding_completed: true }] },
  });
  const { GET } = await import("@/app/api/admin/audit-log/route");
  const response = await GET(new NextRequest(`https://example.test/api/admin/audit-log?page=${page}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ page: 1 });
  expect(mockCookie.calls.find((call) => call.table === "admin_audit_log")?.range).toEqual({ from: 0, to: 19 });
});

it.each([
  { session_id: { arbitrary: true } }, { metadata: { nested: { payload: true } } },
  { metadata: { excessive: "x".repeat(257) } },
])("anonymous malformed tracking extras %# are rejected before the event read or insert", async (extras) => {
  mockCookie = createFakeSupabase({ user: null });
  const { POST } = await import("@/app/api/interactions/route");
  const response = await POST(new NextRequest("https://example.test/api/interactions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: "event-1", interaction_type: "view", ...extras }),
  }));
  expect(response.status).toBe(400);
  expect(mockCookie.calls.filter((call) => ["events", "user_interactions"].includes(call.table))).toHaveLength(0);
});
