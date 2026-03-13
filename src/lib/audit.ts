import { createServiceClient } from "@/lib/supabase/service";

export type AuditAction =
  | "approved"
  | "rejected"
  | "created"
  | "updated"
  | "deleted"
  | "bulk_approved"
  | "bulk_rejected";

export type AuditTargetType = "event" | "user" | "club" | "featured_event";

export async function logAdminAction(params: {
  adminUserId: string;
  adminEmail?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  await (supabase as any).from("admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  });
}
