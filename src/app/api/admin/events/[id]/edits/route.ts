import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, reason } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "reason is required when rejecting edits" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id, title, pending_edits, created_by")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.pending_edits) {
    return NextResponse.json(
      { error: "This event has no pending edits" },
      { status: 400 }
    );
  }

  const pendingEdits = event.pending_edits as Record<string, string>;

  if (action === "approve") {
    const liveUpdates: Record<string, unknown> = { pending_edits: null };
    for (const [key, value] of Object.entries(pendingEdits)) {
      if (key !== "submitted_at") {
        liveUpdates[key] = value;
      }
    }

    const { error: updateError } = await supabase
      .from("events")
      .update(liveUpdates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (event.created_by) {
      await supabase.from("notifications").insert({
        user_id: event.created_by,
        type: "edit_approved",
        title: "Edits Approved",
        message: `Your edits to "${event.title}" have been approved and are now live.`,
        event_id: id,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: "approved_edits",
      targetType: "event",
      targetId: id,
      metadata: { approved_fields: Object.keys(pendingEdits).filter(k => k !== "submitted_at") },
    });

    return NextResponse.json({ success: true, message: "Edits approved" });
  }

  // Reject
  const { error: updateError } = await supabase
    .from("events")
    .update({ pending_edits: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (event.created_by) {
    await supabase.from("notifications").insert({
      user_id: event.created_by,
      type: "edit_rejected",
      title: "Edits Rejected",
      message: `Your edits to "${event.title}" were rejected: ${reason}`,
      event_id: id,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email,
    action: "rejected_edits",
    targetType: "event",
    targetId: id,
    metadata: { reason, rejected_fields: Object.keys(pendingEdits).filter(k => k !== "submitted_at") },
  });

  return NextResponse.json({ success: true, message: "Edits rejected" });
}
