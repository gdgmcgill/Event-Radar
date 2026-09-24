import { getElevatedClient } from "@/server/db/elevated";
import type { Json } from "@/lib/supabase/types";

export type AuditAction =
  | "approved"
  | "rejected"
  | "created"
  | "updated"
  | "deleted"
  | "bulk_approved"
  | "bulk_rejected"
  | "report_reviewed"
  | "report_dismissed"
  | "approved_edits"
  | "rejected_edits"
  | "suspended"
  | "unsuspended"
  | "banned"
  | "unbanned";

export type AuditTargetType = "event" | "user" | "club" | "featured_event" | "organizer_request" | "event_report";

/**
 * Records one moderation action in `admin_audit_log`.
 *
 * The insert goes through the elevated door: after F-007 no client role may
 * insert audit rows, so the door is the only writer and the record cannot be
 * forged by the actor it records (REGISTRY.md row: audit-log writer).
 *
 * The row carries the actor's id only. `admin_audit_log` has no email column;
 * sending one made PostgREST reject every insert, silently, which is F-073.
 * Readers resolve the actor's name and email from `users` by id.
 *
 * Resolves without throwing. A rejected insert is logged loudly with the
 * request id, so a lost audit row is visible in the logs instead of silent.
 */
export async function logAdminAction(params: {
  adminUserId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  // The generated JSON type, not a widened record. `admin_audit_log.metadata`
  // is `Json | null`, and a `Record<string, unknown>` is not a `Json` because
  // `unknown` admits values Postgres cannot store. This is the same shape as
  // five of the six errors that blocked the supabase-js bump in Phase 2.
  metadata?: Json;
  /** The request context's id, for correlating a rejected write. */
  requestId?: string;
}) {
  const supabase = getElevatedClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[Audit] admin_audit_log insert rejected", {
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      requestId: params.requestId,
      code: error.code,
      message: error.message,
    });
  }
}
