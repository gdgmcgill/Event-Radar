import { IDS, type PersonaKey } from "../fixtures";
import { AUDIT_PERSONAS, type AuditPersona, type EndpointRow } from "./certificationInventory";
import type { IsolatedProbe } from "./isolatedProbes";

export const MISSING_ID = "5eed0000-0000-4000-8000-00000000c099";
/** `anonymousCapable`: a public intake write (M3 P1-09) that accepts anonymous
 * and incomplete-profile callers by design, so every non-banned persona gets
 * the same answer (404 while `discovery_ui` is off). */
export interface MutationProbe { status: number; isolated?: IsolatedProbe; body?: "missing-file-form"; anonymousCapable?: true; }
/** Exact outcome for an active, onboarded caller with the required global role.
 * Requests use malformed JSON (or a readable form without a file) and an
 * absent target id, except self-follow.
 * These are authorization/validation probes, never successful workflow tests. */
export const MUTATIONS: Record<string, MutationProbe> = {
  "POST /api/admin/opportunities": { status: 400 },
  "PATCH /api/admin/opportunities/[id]": { status: 400 },
  "PUT /api/admin/events/[id]/discovery": { status: 400 },
  "PATCH /api/admin/events/[id]/discovery": { status: 400 },
  "PUT /api/opportunities/[id]/save": { status: 404 },
  "DELETE /api/opportunities/[id]/save": { status: 404 },
  "POST /api/admin/resources": { status: 400 },
  "PATCH /api/admin/resources/[id]": { status: 400 },
  "POST /api/admin/resources/[id]/file": { status: 400, body: "missing-file-form" },
  "POST /api/submissions": { status: 404, anonymousCapable: true },
  "POST /api/company-requests": { status: 404, anonymousCapable: true },
  "POST /api/listing-reports": { status: 404, anonymousCapable: true },
  "PATCH /api/admin/submissions/[id]": { status: 400 },
  "PATCH /api/admin/listing-reports/[id]": { status: 400 },
  "POST /api/admin/ingestion/images": { status: 400 },
  "POST /api/admin/calculate-popularity": { status: 200, isolated: "popularity" },
  "PATCH /api/admin/clubs/[id]": { status: 400 },
  "PATCH /api/admin/events/[id]/edits": { status: 400 },
  "PUT /api/admin/events/[id]": { status: 400 },
  "DELETE /api/admin/events/[id]": { status: 200, isolated: "audit-delete" },
  "PATCH /api/admin/events/[id]/status": { status: 400 },
  "POST /api/admin/events": { status: 400 },
  "PATCH /api/admin/experiments/[id]": { status: 400 },
  "DELETE /api/admin/experiments/[id]": { status: 404 },
  "POST /api/admin/experiments": { status: 400 },
  "PATCH /api/admin/featured/[id]": { status: 400 },
  "DELETE /api/admin/featured/[id]": { status: 200, isolated: "audit-delete" },
  "POST /api/admin/featured": { status: 400 },
  "PATCH /api/admin/organizer-requests/[id]": { status: 400 },
  "PATCH /api/admin/reports/[id]": { status: 400 },
  "POST /api/admin/users/[id]/ban": { status: 400 },
  "DELETE /api/admin/users/[id]/ban": { status: 404 },
  "PATCH /api/admin/users/[id]": { status: 400 },
  "POST /api/clubs/[id]/appeal": { status: 400 },
  "POST /api/clubs/[id]/follow": { status: 201, isolated: "club-follow" },
  "DELETE /api/clubs/[id]/follow": { status: 200 },
  "POST /api/clubs/[id]/invites": { status: 403 },
  "PATCH /api/clubs/[id]/members/role": { status: 403 },
  "DELETE /api/clubs/[id]/members": { status: 403 },
  "PATCH /api/clubs/[id]": { status: 403 },
  "DELETE /api/clubs/[id]": { status: 403 },
  "POST /api/clubs/[id]/transfer": { status: 403 },
  "POST /api/clubs/banner": { status: 400, body: "missing-file-form" },
  "POST /api/clubs/logo": { status: 400, body: "missing-file-form" },
  "POST /api/clubs": { status: 400 },
  "POST /api/events/[id]/appeal": { status: 400 },
  "POST /api/events/[id]/invite": { status: 400 },
  "POST /api/events/[id]/report": { status: 400 },
  "POST /api/events/[id]/reviews": { status: 404 },
  "PATCH /api/events/[id]": { status: 404 },
  "DELETE /api/events/[id]": { status: 404 },
  "POST /api/events/[id]/rsvp": { status: 400 },
  "DELETE /api/events/[id]/rsvp": { status: 400 },
  "PUT /api/events/[id]/save": { status: 404 },
  "POST /api/events/[id]/save": { status: 404 },
  "DELETE /api/events/[id]/save": { status: 200 },
  "POST /api/events/create": { status: 400 },
  "POST /api/events/upload-image": { status: 400, body: "missing-file-form" },
  "POST /api/feedback": { status: 400 },
  "POST /api/interactions": { status: 400 },
  "PATCH /api/notifications/[id]": { status: 200 },
  "POST /api/notifications": { status: 400 },
  "POST /api/onboarding/complete": { status: 200 },
  "POST /api/organizer-requests": { status: 400 },
  "POST /api/profile/avatar": { status: 400, body: "missing-file-form" },
  "POST /api/profile/banner": { status: 400, body: "missing-file-form" },
  "DELETE /api/profile/inferred-tags": { status: 400 },
  "PUT /api/profile/interests": { status: 400 },
  "POST /api/recommendations/batch": { status: 200, isolated: "batch" },
  "POST /api/recommendations/feedback": { status: 400 },
  "POST /api/user/engagement": { status: 200 },
  "POST /api/users/[id]/follow": { status: 400 },
  "DELETE /api/users/[id]/follow": { status: 200 },
  "PATCH /api/users/[id]": { status: 403 },
  "POST /auth/signout": { status: 302, isolated: "signout" },
};

export const isAnonymous = (who: AuditPersona) => who === "anonymous" || who === "machine_no_credential";
const isBanned = (who: AuditPersona) => who === "banned_permanent" || who === "suspended_active";
/** Public intake writes have a 5-per-minute budget per client address and
 * path (src/server/ratelimit/policy.ts). Thirteen personas probing from one
 * loopback address would exhaust it and read 429, so each persona probes an
 * intake route as its own documentation-range client address. */
export function probeHeaders(method: string, route: string, who: AuditPersona): Record<string, string> {
  if (!MUTATIONS[`${method} ${route}`]?.anonymousCapable) return {};
  return { "x-real-ip": `198.51.100.${AUDIT_PERSONAS.indexOf(who) + 1}` };
}

export function probeUrl(row: EndpointRow, method: string, who: AuditPersona): string {
  let url = row.route.replace("[targetType]", "event").replace("[targetId]", IDS.approvedEvent);
  if (method !== "GET") {
    const id = row.route === "/api/users/[id]/follow" && !isAnonymous(who) ? IDS[who as PersonaKey] : MISSING_ID;
    url = url.replace("[id]", id);
  } else {
    url = url.replace("[id]", row.route.includes("/clubs/") ? IDS.approvedClub : row.route.includes("/events/") ? IDS.approvedEvent : row.route.includes("/users/") ? IDS.onboarded_student : MISSING_ID);
  }
  if (method === "GET" && row.route === "/api/events/export") url += "?format=csv";
  return url;
}
export function expectedProbe(row: EndpointRow, method: string, who: AuditPersona): { status: number; skip?: string; isolated?: IsolatedProbe } {
  if (who === "non_mcgill_signin") return { status: 0, skip: "External OAuth persona is not part of the baseline seed; verified non-campus admission is covered by M1 callback contracts and a separate disposable-user local workflow." };
  if (row.route === "/auth/callback") return { status: 307 };
  if (row.route === "/auth/signout") return isAnonymous(who) ? { status: 302 } : { status: 302, isolated: "signout" };
  if (isBanned(who)) return { status: 403 };
  if (method !== "GET") {
    const probe = MUTATIONS[`${method} ${row.route}`];
    if (!probe) throw new Error(`Unclassified mutation: ${method} ${row.route}`);
    if (probe.anonymousCapable) return { status: probe.status };
    if (isAnonymous(who)) return { status: ["/api/feedback", "/api/interactions"].includes(row.route) ? 400 : 401 };
    if (row.auth_requirement === "admin" && who !== "admin") return { status: 403 };
    // P1-02: a cookie-only completion request cannot finish an incomplete
    // authoritative profile. Completed personas retain their idempotent 200.
    if (who === "mid_onboarding_student" && row.route === "/api/onboarding/complete") return { status: 400 };
    if (who === "mid_onboarding_student" && row.route !== "/api/onboarding/complete") return { status: 403 };
    return { status: probe.status, isolated: probe.isolated };
  }
  // Deliberate deltas from historical row-level inventory expectations.
  if (row.route === "/api/notifications/count") return { status: isAnonymous(who) ? 401 : 200 };
  if (row.route === "/api/health") return { status: 200 }; // Admin health has a separate body/status consistency assertion.
  if (row.route === "/api/clubs/[id]/invites" && who === "club_member") return { status: 403 }; // owner-only
  if (row.route === "/api/moderation/reviews/[targetType]/[targetId]") return { status: isAnonymous(who) ? 401 : ["admin", "club_owner"].includes(who) ? 200 : 403 };
  if (row.route === "/api/events/[id]/reviews") return { status: isAnonymous(who) ? 401 : 200 }; // authenticated, scoped review data
  if (row.route.startsWith("/api/admin/experiments/[id]") && who === "admin") return { status: 404 }; // absent fixture
  const status = row.expected_status[who];
  if (typeof status !== "number") throw new Error(`Unclassified GET status: ${row.route} ${who}`);
  return { status };
}
