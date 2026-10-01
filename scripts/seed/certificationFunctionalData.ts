/** CERT-01 opt-in superset. Default functional personas and snapshots stay intact. */
import { createHash } from "node:crypto";
import type { Database } from "../../src/lib/supabase/types";
import { generateCertificationData } from "./certificationData";
import { PERSONAS, SEED_STAMP } from "./personas";

type Tables = Database["public"]["Tables"];
export const FUNCTIONAL_TABLES = [
  "users", "clubs", "club_members", "events", "rsvps", "saved_events", "user_interactions", "notifications", "club_invitations",
  "club_followers", "user_follows", "event_invites", "organizer_requests", "reviews", "event_reports", "moderation_reviews",
  "experiments", "experiment_variants", "experiment_assignments", "user_event_scores", "recommendation_feedback", "recommendation_explicit_feedback",
  "admin_audit_log", "featured_events", "featured_clubs", "feedback", "feedback_request_log",
] as const satisfies readonly (keyof Tables)[];
export type FunctionalTable = typeof FUNCTIONAL_TABLES[number];
type Rows = { [K in FunctionalTable]: Array<Tables[K]["Insert"] & (K extends "user_event_scores" ? object : { id: string })> };
export const FUNCTIONAL_NAMESPACE = "c0700003";
export const FUNCTIONAL_BOUNDS: [string, string] = ["c0700003-0000-0000-0000-000000000000", "c0700004-0000-0000-0000-000000000000"];
export const FUNCTIONAL_PASSWORD = "Certification-local-only-2026!";
export const NOTIFICATION_TYPES = ["event_reminder_24h", "event_reminder_1h", "reminder_24h", "reminder_1h", "event_approved", "event_rejected", "event_suspended", "new_follower", "new_friend", "event_invite", "club_announcement", "club_update", "new_event", "club_approved", "club_rejected", "club_suspended", "organizer_approved", "organizer_rejected", "feedback_request", "club_appeal", "event_appeal", "user_banned", "user_unbanned"] as const;
export const FUNCTIONAL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
export function functionalId(kind: number, index = 0) { return `${FUNCTIONAL_NAMESPACE}-${kind.toString(16).padStart(4, "0")}-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`; }

export function generateFunctionalCertificationData() {
  // Reuse the validated relational core, changing EVERY namespace reference.
  const base = JSON.parse(JSON.stringify(generateCertificationData("adversarial").tables).replaceAll("c0700002", FUNCTIONAL_NAMESPACE).replaceAll("adversarial", "functional")) as ReturnType<typeof generateCertificationData>["tables"];
  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    Object.assign(base.users[i], { name: p.name, roles: p.roles, onboarding_completed: p.onboarding_completed, interest_tags: [...p.interest_tags], banned_at: p.banned_at, ban_expires_at: p.ban_expires_at, ban_reason: p.ban_reason, year: p.year, faculty: p.faculty });
  }
  const owners = [3, 4, 5, 3];
  base.clubs.forEach((club, i) => { club.created_by = functionalId(1, owners[i]); club.status = ["approved", "pending", "rejected", "deleted"][i]; });
  base.club_members.forEach((member, i) => { member.user_id = functionalId(1, owners[i]); });
  base.clubs.push({ ...base.clubs[0], id: functionalId(2, 4), name: "Certification suspended club", status: "suspended", created_by: functionalId(1, 4) });
  base.club_members.push(
    { id: functionalId(3, 4), club_id: functionalId(2, 4), user_id: functionalId(1, 4), role: "owner", created_at: SEED_STAMP },
    { id: functionalId(3, 5), club_id: functionalId(2), user_id: functionalId(1, 2), role: "organizer", created_at: SEED_STAMP },
    { id: functionalId(3, 6), club_id: functionalId(2), user_id: functionalId(1, 4), role: "owner", created_at: SEED_STAMP },
  );
  base.club_invitations.forEach((invite, i) => { invite.inviter_id = functionalId(1, owners[i]); });
  base.events.forEach((event, i) => {
    event.created_by = functionalId(1, owners[i % owners.length]);
    // Recompute hashes after changing the generator's organizer labels.
    event.content_hash = createHash("sha256").update(`${event.title.toLowerCase().trim()}|${event.start_date.slice(0, 10)}|${event.organizer!.toLowerCase()}`).digest("hex");
    event.rsvp_count = 0;
  });
  base.events[20].deleted_at = SEED_STAMP;
  base.events[21].source = "instagram"; base.events[21].source_url = "https://instagram.com/p/certification-fixture";
  base.events[18].pending_edits = { title: "Reviewed title", submitted_at: SEED_STAMP };
  base.rsvps[0].status = "cancelled";
  base.rsvps[1].status = "interested";
  for (const rsvp of base.rsvps) if (rsvp.status === "going") base.events.find((event) => event.id === rsvp.event_id)!.rsvp_count!++;
  base.notifications = NOTIFICATION_TYPES.map((type, i) => ({ id: functionalId(8, i), user_id: functionalId(1, 0), event_id: functionalId(4, i % base.events.length), type, title: `Synthetic ${type}`, message: "Certification notification", read: i % 2 === 0, created_at: SEED_STAMP }));
  const tables: Rows = {
    ...base,
    club_followers: [{ id: functionalId(11), user_id: functionalId(1, 0), club_id: functionalId(2), created_at: SEED_STAMP }],
    user_follows: [{ id: functionalId(12), follower_id: functionalId(1, 0), following_id: functionalId(1, 2), created_at: SEED_STAMP }],
    event_invites: [{ id: functionalId(13), inviter_id: functionalId(1, 2), invitee_id: functionalId(1, 0), event_id: functionalId(4, 1), created_at: SEED_STAMP }],
    organizer_requests: ["pending", "approved", "rejected"].map((status, i) => ({ id: functionalId(14, i), user_id: functionalId(1, 10 + i % 2), club_id: functionalId(2, i), status, message: "Certification organizer request", reviewed_by: status === "pending" ? null : functionalId(1, 6), created_at: SEED_STAMP, updated_at: SEED_STAMP })),
    reviews: [{ id: functionalId(15), user_id: functionalId(1, 0), event_id: functionalId(4), rating: 4, comment: "Synthetic review", created_at: SEED_STAMP }],
    event_reports: ["pending", "reviewed", "dismissed"].map((status, i) => ({ id: functionalId(16, i), reporter_id: functionalId(1, i), event_id: functionalId(4, 18), category: "other", message: "Synthetic report", status, created_at: SEED_STAMP })),
    moderation_reviews: ["rejection", "appeal", "approval", "suspension"].map((action, i) => ({ id: functionalId(17, i), target_type: i % 2 ? "club" : "event", target_id: i % 2 ? functionalId(2, 2) : functionalId(4, 18), action, category: action === "rejection" ? "other" : null, author_id: functionalId(1, action === "appeal" ? 5 : 6), message: "Synthetic moderation history", created_at: SEED_STAMP })),
    experiments: ["running", "draft", "paused", "completed"].map((status, i) => ({ id: functionalId(18, i), name: `Certification ${status} experiment`, status, description: "Opt-in certification only", target_metric: "click_rate", created_at: SEED_STAMP, updated_at: SEED_STAMP })),
    experiment_variants: ["control", "treatment"].map((name, i) => ({ id: functionalId(19, i), experiment_id: functionalId(18), name, config: {}, weight: 1, created_at: SEED_STAMP })),
    experiment_assignments: [{ id: functionalId(20), experiment_id: functionalId(18), variant_id: functionalId(19), user_id: functionalId(1, 0), assigned_at: SEED_STAMP }],
    // Only one user is scored: a second user's absence exercises live fallback.
    user_event_scores: [{ user_id: functionalId(1, 0), event_id: functionalId(4, 1), score: 0.8, breakdown: { tag_match: 0.8 }, scored_at: SEED_STAMP }],
    recommendation_feedback: ["impression", "click", "save", "dismiss"].map((action, i) => ({ id: functionalId(21, i), user_id: functionalId(1, 0), event_id: functionalId(4, 1), recommendation_rank: 1, action, experiment_variant_id: functionalId(19), created_at: SEED_STAMP })),
    recommendation_explicit_feedback: ["positive", "negative"].map((feedback_type, i) => ({ id: functionalId(22, i), user_id: functionalId(1, i), event_id: functionalId(4, 1), feedback_type, created_at: SEED_STAMP })),
    admin_audit_log: [{ id: functionalId(23), admin_user_id: functionalId(1, 6), action: "event_approved", target_type: "event", target_id: functionalId(4, 1), metadata: { certification: true }, created_at: SEED_STAMP }],
    featured_events: [{ id: functionalId(24), event_id: functionalId(4, 1), created_by: functionalId(1, 6), starts_at: "2036-06-01T00:00:00Z", ends_at: "2037-06-01T00:00:00Z", created_at: SEED_STAMP }],
    featured_clubs: [{ id: functionalId(25), club_id: functionalId(2), created_by: functionalId(1, 6), starts_at: "2036-06-01T00:00:00Z", ends_at: "2037-06-01T00:00:00Z", created_at: SEED_STAMP }],
    feedback: [{ id: functionalId(26), user_id: functionalId(1, 0), message: "Synthetic platform feedback", created_at: SEED_STAMP }],
    feedback_request_log: [{ id: functionalId(27), user_id: functionalId(1, 0), event_id: functionalId(4), request_type: "post_event", sent_at: SEED_STAMP }],
  };
  return { version: 1 as const, name: "functional" as const, namespace: FUNCTIONAL_NAMESPACE, tables,
    storage: { bucket: "avatars", path: `${functionalId(1, 0)}/certification-functional.png`, owner: functionalId(1, 0), sha256: createHash("sha256").update(Buffer.from(FUNCTIONAL_PNG, "base64")).digest("hex"),
      clubBranding: { bucket: "club-logos", path: `${functionalId(2)}/certification-functional.png`, owner: functionalId(1, 3), deniedPath: `${functionalId(2, 2)}/certification-cross-club-probe.png` } } };
}
export function functionalManifest(data = generateFunctionalCertificationData()) {
  return { version: data.version, name: data.name, namespace: data.namespace, counts: Object.fromEntries(FUNCTIONAL_TABLES.map((table) => [table, data.tables[table].length])), storage: data.storage, sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex") };
}
