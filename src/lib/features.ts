import "server-only";
import { isBanned } from "@/lib/ban";
import type { RequestContext } from "@/server/context";

/** P1-01: release configuration is read on the server, never from a URL,
 * cookie, user metadata, or NEXT_PUBLIC environment variable. Only `true`
 * enables a switch; missing, empty and malformed values fail closed.
 */
export const FEATURE_ENV = {
  discovery_ui: "FEATURE_DISCOVERY_UI",
  native_applications: "FEATURE_NATIVE_APPLICATIONS",
  recruiter_access: "FEATURE_RECRUITER_ACCESS",
  resume_parsing: "FEATURE_RESUME_PARSING",
  new_feedback_writes: "FEATURE_NEW_FEEDBACK_WRITES",
} as const;
export type FeatureName = keyof typeof FEATURE_ENV;
export type FeatureFlags = Readonly<Record<FeatureName, boolean>>;
type FeatureEnvironment = Readonly<Record<string, string | undefined>>;

export function getFeatureFlags(env: FeatureEnvironment = process.env): FeatureFlags {
  return Object.fromEntries(Object.entries(FEATURE_ENV).map(([name, key]) => [name, env[key] === "true"])) as Record<FeatureName, boolean>;
}

export function isFeatureEnabled(name: FeatureName): boolean {
  return getFeatureFlags()[name];
}

/** Preview grants presentation access only. It cannot enable a backend write
 * family, bypass an authorization guard, or restore public legacy reviews.
 * Callers must supply a server-verified context, not client profile claims.
 */
export function getDiscoveryAccess(
  ctx: Pick<RequestContext, "user" | "profile">,
  env: FeatureEnvironment = process.env,
): { enabled: boolean; preview: boolean } {
  const enabled = getFeatureFlags(env).discovery_ui;
  const preview = !enabled && env.FEATURE_DISCOVERY_ADMIN_PREVIEW === "true" &&
    !!ctx.user && !!ctx.profile && ctx.profile.id === ctx.user.id &&
    ctx.profile.roles?.includes("admin") === true && !isBanned(ctx.profile);
  return { enabled: enabled || preview, preview };
}

/** Segment-aware future route families; query strings never activate them.
 * A route can additionally declare its feature in withRoute for defense in
 * depth when introduced under a different URL. Enabled is not authorized.
 */
export function getDisabledRouteFeature(
  pathname: string,
  method: string,
  flags: FeatureFlags = getFeatureFlags(),
): FeatureName | null {
  let path = pathname;
  try { path = decodeURIComponent(pathname).replace(/\/{2,}/g, "/"); } catch { /* the framework rejects malformed URLs */ }
  const needs: FeatureName[] = [];
  if (/^\/(?:api\/)?(?:talent|applications)(?:\/|$)/.test(path) ||
      /^\/api\/opportunities\/[^/]+\/applications(?:\/|$)/.test(path)) needs.push("native_applications");
  if (/^\/(?:api\/)?recruiting(?:\/|$)/.test(path) || /^\/api\/admin\/recruiting(?:\/|$)/.test(path)) needs.push("recruiter_access");
  if (/^\/api\/talent\/resumes(?:\/[^/]+)?\/parse(?:\/|$)/.test(path)) needs.push("resume_parsing");
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
      /^\/api\/events\/[^/]+\/feedback(?:\/|$)/.test(path)) needs.push("new_feedback_writes");
  return needs.find((name) => !flags[name]) ?? null;
}
