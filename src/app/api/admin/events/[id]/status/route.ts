import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, isAdmin } = await verifyAdmin();
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

  // Send notification to event creator
  try {
    const serviceClient = createServiceClient();
    const { data: event } = await serviceClient
      .from("events")
      .select("title, created_by")
      .eq("id", id)
      .single();

    if (event?.created_by) {
      const isApproved = status === "approved";
      await serviceClient.from("notifications").insert({
        user_id: event.created_by,
        type: isApproved ? "event_approved" : "event_rejected",
        title: isApproved ? "Event Approved!" : "Event Not Approved",
        message: isApproved
          ? `Your event "${event.title}" has been approved and is now live.`
          : `Your event "${event.title}" was not approved.`,
        event_id: id,
      });
    }
  } catch (notifErr) {
    // Notification failure should not break the status update
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
