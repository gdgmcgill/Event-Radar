/** F-009/F-010: exercise the real route with separated cookie/elevated fakes. */
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeSupabase } from "../../helpers/fakeSupabase";
import { E1, OTHER_USER_ID, STUDENT, cookieInit, read } from "../recommendations/recommendationFixtures";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mockElevated.client, serviceRoleKey: () => "test-key" }));
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockElevated = createFakeSupabase();
});
afterEach(() => jest.restoreAllMocks());

async function post(extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/interactions/route");
  return read(await POST(new NextRequest("http://localhost/api/interactions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_id: E1, interaction_type: "view", ...extra }),
  })));
}

it.each(["anonymous", "student"] as const)("%s identity is server-bound despite a forged user_id", async persona => {
  mockCookie = createFakeSupabase(cookieInit({ persona }));
  const result = await post({ user_id: OTHER_USER_ID, source: "home", metadata: { rank: 1 } });
  expect(result.status).toBe(201);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(mockCookie.calls.filter(c => c.operation === "insert")).toHaveLength(0);
  expect(mockCookie.calls.some(c => c.table === "events" && c.operation === "select")).toBe(true);
  expect(mockElevated.calls).toHaveLength(1);
  expect(mockElevated.calls[0]).toMatchObject({ table: "user_interactions", operation: "insert", payload: {
    user_id: persona === "student" ? STUDENT.id : null,
    event_id: E1, interaction_type: "view", source: "home", metadata: { rank: 1 },
  } });
});

it("an event hidden by cookie RLS is not looked up or written through elevation", async () => {
  const init = cookieInit({ persona: "student" });
  mockCookie = createFakeSupabase({ ...init, tables: { ...init.tables, events: [] } });
  expect((await post()).status).toBe(404);
  expect(mockElevated.calls).toHaveLength(0);
});

it.each(["banned", "unonboarded"])("%s callers cannot enter the elevated writer", async state => {
  const init = cookieInit({ persona: "student", onboarded: state !== "unonboarded" });
  if (state === "banned") init.tables!.users[0].banned_at = "2026-01-01T00:00:00Z";
  mockCookie = createFakeSupabase(init);
  expect((await post()).status).toBe(403);
  expect(mockElevated.calls).toHaveLength(0);
});

it("invalid metadata is rejected before elevation", async () => {
  mockCookie = createFakeSupabase(cookieInit({ persona: "anonymous" }));
  expect((await post({ metadata: { nested: { arbitrary: "object" } } })).status).toBe(400);
  expect(mockElevated.calls).toHaveLength(0);
});

it("failed event visibility query never reaches the elevated writer", async () => {
  mockCookie = createFakeSupabase({ ...cookieInit({ persona: "student" }), errors: { events: { code: "08006", message: "offline" } } });
  expect((await post()).status).toBe(500);
  expect(mockElevated.calls).toHaveLength(0);
});

it("failed server write returns an observable private error", async () => {
  mockCookie = createFakeSupabase(cookieInit({ persona: "student" }));
  mockElevated = createFakeSupabase({ errors: { user_interactions: { code: "08006", message: "database offline" } } });
  const result = await post();
  expect(result.status).toBe(500);
  expect(result.body).toEqual({ error: "Failed to record interaction" });
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(console.error).toHaveBeenCalled();
});
