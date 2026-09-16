import { createServiceClient } from "@/lib/supabase/service";
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

export async function logAdminAction(params: {
  adminUserId: string;
  adminEmail?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  // The generated JSON type, not a widened record. `admin_audit_log.metadata`
  // is `Json | null`, and a `Record<string, unknown>` is not a `Json` because
  // `unknown` admits values Postgres cannot store. This is the same shape as
  // five of the six errors that blocked the supabase-js bump in Phase 2.
  metadata?: Json;
}) {
  const supabase = createServiceClient();
  await supabase.from("admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  });
}
