/** PRESERVE M1/M2: new endpoint boundary contracts, extending F-058 census.
 * Actual guards/withRoute execute; only request context and database transport
 * are isolated. Every new arm has injected-failure coverage after its guards. */
import { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";
import { M2_ARMS, M2_ID, m2Request } from "./m2RouteArms";
let mockCtx: RequestContext;
const mockFrom = jest.fn(() => { throw new Error("PRIVATE_DATABASE_SENTINEL"); });
const mockRpc = jest.fn(() => { throw new Error("PRIVATE_DATABASE_SENTINEL"); });
// The resources file upload also touches Storage before its RPC call; a
// harmless stub lets that arm's generic-500 assertion reach the RPC throw
// below instead of an unrelated "storage undefined" crash.
const mockStorage = { from: () => ({ upload: async () => ({ data: { path: "stub" }, error: null }), createSignedUrl: async () => ({ data: { signedUrl: "https://storage.example/stub" }, error: null }) }) };
const mockDb = { from: mockFrom, rpc: mockRpc, storage: mockStorage };
jest.mock("@/server/context", () => ({ createRequestContext: () => Promise.resolve(mockCtx) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockDb }));
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockDb) }));
const original = process.env.FEATURE_DISCOVERY_UI;
beforeEach(() => {
 process.env.FEATURE_DISCOVERY_UI = "true";
 jest.clearAllMocks();
 jest.spyOn(console,"error").mockImplementation(() => {});
 mockCtx = { user: { id: M2_ID },profile: { id: M2_ID,roles: ["user","admin"],onboarding_completed: true,banned_at: null,ban_expires_at: null },supabase: mockDb,requestId: "m2-boundary-test" } as unknown as RequestContext;
});
afterEach(() => { jest.restoreAllMocks(); if (original === undefined) delete process.env.FEATURE_DISCOVERY_UI; else process.env.FEATURE_DISCOVERY_UI = original; });
it.each(M2_ARMS)("$verb $route: unexpected backend failure becomes private generic 500", async arm => {
 const response = await arm.invoke(m2Request(arm));
 expect(response.status).toBe(500);
 expect(response.headers.get("cache-control")).toBe("private, no-store");
 expect(await response.text()).not.toContain("PRIVATE_DATABASE_SENTINEL");
 expect(mockFrom.mock.calls.length + mockRpc.mock.calls.length).toBeGreaterThan(0);
});
it.each(M2_ARMS.filter(a => a.query || a.body))("$verb $route: malformed input fails before DB", async arm => {
 const response = await arm.invoke(m2Request(arm,true));
 expect(response.status).toBe(400);
 expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
});
for (const persona of ["anonymous","missing","banned","student"] as const) {
 it.each(M2_ARMS.filter(a => a.admin || (a.active && persona !== "student")))(`$verb $route: ${persona} gate precedes any DB operation`, async arm => {
  if (persona === "anonymous") mockCtx.user = null;
  if (persona === "missing") mockCtx.profile = null;
  if (persona === "banned") mockCtx.profile!.banned_at = "2026-01-01T00:00:00Z";
  if (persona === "student") mockCtx.profile!.roles = ["user"];
  const response = await arm.invoke(m2Request(arm));
  expect(response.status).toBe(persona === "anonymous" ? 401 : 403);
  expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
 });
}
it.each(M2_ARMS.filter(a => a.write && !a.anonymousWrite))("$verb $route: incomplete profile cannot mutate saves", async arm => {
 mockCtx.profile!.onboarding_completed = false;
 expect((await arm.invoke(m2Request(arm))).status).toBe(403);
 expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
});

it.each(M2_ARMS.filter(a => ["discovery","saved"].includes(a.route)))("$route: InvalidCursor exposes only the fixed public restart message", async arm => {
 const response = await arm.invoke(new NextRequest(`http://localhost/api/${arm.route}?cursor=broken`));
 expect(response.status).toBe(400);
 expect(await response.json()).toEqual({ error: "Invalid or expired cursor; restart this view" });
 expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
});
