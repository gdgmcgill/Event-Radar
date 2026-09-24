import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const body = await request.json();
  const { status, category, message } = body;

  if (!["approved", "rejected", "suspended"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // The event read and update and the moderation review run on the caller's
  // cookie client: the admin policies on events and moderation_reviews permit
  // them (DEC-49). The creator's notification goes through the elevated door:
  // notifications INSERT is granted to service_role only. REGISTRY.md row:
  // "Notify another user (notifications insert)".
  const supabase = ctx.supabase;

  // Fetch current event
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("title, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Transition guard: only allow valid status transitions
  const allowedTransitions: Record<string, string[]> = {
    pending: ["approved", "rejected"],
    approved: ["suspended"],
    suspended: ["approved", "rejected"],
    rejected: [], // appeals handle rejected → pending
  };

  const allowed = allowedTransitions[event.status] || [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${event.status}' to '${status}'` },
      { status: 409 }
    );
  }

  // Validate rejection fields
  if (status === "rejected") {
    if (!category || !message?.trim()) {
      return NextResponse.json(
        { error: "Rejection requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid rejection category" },
        { status: 400 }
      );
    }
  }

  // Validate suspension fields (same requirements as rejection)
  if (status === "suspended") {
    if (!category || !message?.trim()) {
      return NextResponse.json(
        { error: "Suspension requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid suspension category" },
        { status: 400 }
      );
    }
  }

  // Update event status
  const { error: updateError } = await supabase
    .from("events")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Insert moderation review row
  if (status === "rejected") {
    await supabase.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "rejection",
      category: category as RejectionCategory,
      message: message.trim(),
      author_id: user.id,
    });
  } else if (status === "suspended") {
    await supabase.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "suspension",
      category: category as RejectionCategory,
      message: message.trim(),
      author_id: user.id,
    });
  } else if (status === "approved" && event.status === "suspended") {
    await supabase.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "unsuspension",
      category: null,
      message: "Event unsuspended and approved.",
      author_id: user.id,
    });
  } else if (status === "approved" && (event.appeal_count ?? 0) > 0) {
    await supabase.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "approval",
      category: null,
      message: "Event approved.",
      author_id: user.id,
    });
  }

  // Log audit action
  try {
    const auditAction =
      status === "approved" && event.status === "suspended"
        ? "unsuspended"
        : (status as "approved" | "rejected" | "suspended");
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: auditAction,
      targetType: "event",
      targetId: id,
      metadata: { event_title: event.title },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  // Send notification to event creator
  try {
    if (event.created_by) {
      if (status === "approved") {
        await getElevatedClient().from("notifications").upsert(
          {
            user_id: event.created_by,
            type: "event_approved",
            title: "Event Approved!",
            message: `Your event "${event.title}" has been approved and is now live.`,
            event_id: id,
            read: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,event_id,type" }
        );
      } else if (status === "suspended") {
        const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
        await getElevatedClient().from("notifications").insert({
          user_id: event.created_by,
          type: "event_suspended",
          title: "Event Suspended",
          message: `Your event "${event.title}" has been suspended. Reason: ${categoryLabel} — ${message.trim()}`,
          event_id: id,
          read: false,
          created_at: new Date().toISOString(),
        });
      } else {
        const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
        await getElevatedClient().from("notifications").insert({
          user_id: event.created_by,
          type: "event_rejected",
          title: "Event Not Approved",
          message: `Your event "${event.title}" was not approved. Reason: ${categoryLabel} — ${message.trim()}`,
          event_id: id,
          read: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (notifErr) {
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
