import { getFeatureFlags, getDiscoveryAccess, getDisabledRouteFeature, FEATURE_ENV } from "./features";
import { withRoute } from "@/server/route";
import type { RequestContext } from "@/server/context";

const admin = { user: { id: "a" }, profile: { id: "a", roles: ["user", "admin"], banned_at: null, ban_expires_at: null } } as Pick<RequestContext, "user" | "profile">;
const closed = getFeatureFlags({});

it("defaults closed and accepts only exact server-side true values", () => {
  expect(Object.values(closed)).toEqual([false, false, false, false, false]);
  for (const invalid of ["", "1", "TRUE", "yes", "false"]) expect(getFeatureFlags({ FEATURE_DISCOVERY_UI: invalid }).discovery_ui).toBe(false);
  expect(getFeatureFlags({ NEXT_PUBLIC_FEATURE_DISCOVERY_UI: "true" }).discovery_ui).toBe(false);
  expect(getFeatureFlags({ FEATURE_DISCOVERY_UI: "true" }).discovery_ui).toBe(true);
});

it("requires an explicit preview switch and an active matching admin identity", () => {
  const env = { FEATURE_DISCOVERY_ADMIN_PREVIEW: "true" };
  expect(getDiscoveryAccess(admin)).toEqual({ enabled: false, preview: false });
  expect(getDiscoveryAccess(admin, env)).toEqual({ enabled: true, preview: true });
  expect(getDiscoveryAccess({ user: null, profile: null }, env).enabled).toBe(false);
  expect(getDiscoveryAccess({ ...admin, profile: null }, env).enabled).toBe(false);
  for (const changes of [{ roles: ["user"] }, { id: "other" }, { banned_at: "2026-01-01", ban_expires_at: null }, { banned_at: "2026-01-01", ban_expires_at: "invalid" }]) {
    expect(getDiscoveryAccess({ ...admin, profile: { ...admin.profile!, ...changes } } as typeof admin, env).enabled).toBe(false);
  }
  expect(getDiscoveryAccess({ user: null, profile: null }, { FEATURE_DISCOVERY_UI: "true" })).toEqual({ enabled: true, preview: false });
});

it.each([
  ["/api/talent/profile", "GET", "native_applications"],
  ["/api/%74alent/profile", "POST", "native_applications"],
  ["/api/opportunities/123/applications", "POST", "native_applications"],
  ["/talent", "GET", "native_applications"],
  ["/recruiting/roles/123", "GET", "recruiter_access"],
  ["/api/admin/recruiting/invites", "POST", "recruiter_access"],
  ["/api/events/123/feedback", "PUT", "new_feedback_writes"],
])("guards segment-aware future family %s %s", (path, method, feature) => {
  expect(getDisabledRouteFeature(path, method, closed)).toBe(feature);
});

it("composes parse + applications gates, and does not confuse adjacent legacy routes", () => {
  expect(getDisabledRouteFeature("/api/talent/resumes/123/parse", "POST", { ...closed, native_applications: true })).toBe("resume_parsing");
  for (const path of ["/api/feedback", "/api/events/123/reviews", "/api/talented", "/api/recruiting-news", "/api/events/123/feedback-extra", "/api/events/123/feedback"]) {
    expect(getDisabledRouteFeature(path, "GET", closed)).toBeNull();
  }
});

it("the handler boundary denies disabled writes before any handler work, regardless of request overrides", async () => {
  const before = { ...process.env };
  try {
    for (const key of Object.values(FEATURE_ENV)) delete process.env[key];
    const handler = jest.fn(async (_request: Request) => new Response("changed"));
    const route = withRoute({ cache: "public-60-300" }, handler);
    const denied = await route(new Request("https://example.test/api/talent/profile?native_applications=true", {
      method: "POST", headers: { cookie: "FEATURE_NATIVE_APPLICATIONS=true", "x-feature-native-applications": "true" },
    }));
    expect(denied.status).toBe(404); expect(await denied.json()).toEqual({ error: "Not found" });
    expect(denied.headers.get("cache-control")).toBe("private, no-store");
    expect(handler).not.toHaveBeenCalled();
    process.env.FEATURE_NATIVE_APPLICATIONS = "true";
    expect((await route(new Request("https://example.test/api/talent/profile", { method: "POST" }))).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const explicit = withRoute({ cache: "private", feature: "resume_parsing" }, handler);
    expect((await explicit(new Request("https://example.test/api/other-parser"))).status).toBe(404);
    expect(handler).toHaveBeenCalledTimes(1);
  } finally { process.env = before; }
});
