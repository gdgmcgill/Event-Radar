import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, category, message } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch current event
  const { data: event, error: fetchError } = await serviceClient
    .from("events")
    .select("title, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Status guard: prevent duplicate actions
  if (event.status === status) {
    return NextResponse.json(
      { error: `Event is already ${status}` },
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

  // Update event status
  const { error: updateError } = await serviceClient
    .from("events")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Insert moderation review row
  if (status === "rejected") {
    await serviceClient.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "rejection",
      category: category as RejectionCategory,
      message: message.trim(),
      author_id: user.id,
    });
  } else if (status === "approved" && (event.appeal_count ?? 0) > 0) {
    await serviceClient.from("moderation_reviews").insert({
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
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status as "approved" | "rejected",
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
        await serviceClient.from("notifications").upsert(
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
      } else {
        const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
        await serviceClient.from("notifications").insert({
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
