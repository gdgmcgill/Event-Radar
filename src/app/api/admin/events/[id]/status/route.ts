import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("events")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch event details for notification and audit
  const serviceClient = createServiceClient();
  const { data: event } = await serviceClient
    .from("events")
    .select("title, created_by")
    .eq("id", id)
    .single();

  // Log audit action
  try {
    if (user) {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: status as "approved" | "rejected",
        targetType: "event",
        targetId: id,
        metadata: { event_title: event?.title },
      });
    }
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  // Send notification to event creator
  try {
    if (event?.created_by) {
      const isApproved = status === "approved";
      await serviceClient.from("notifications").upsert(
        {
          user_id: event.created_by,
          type: isApproved ? "event_approved" : "event_rejected",
          title: isApproved ? "Event Approved!" : "Event Not Approved",
          message: isApproved
            ? `Your event "${event.title}" has been approved and is now live.`
            : `Your event "${event.title}" was not approved.`,
          event_id: id,
          read: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id,type" }
      );
    }
  } catch (notifErr) {
    // Notification failure should not break the status update
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
