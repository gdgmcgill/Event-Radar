import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";

/**
 * The fields PATCH /api/events/[id] routes through pending_edits (its
 * MODERATED_FIELDS). The only keys an approval may copy onto the event.
 */
const MODERATED_FIELDS = ["title", "image_url"] as const;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

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

  // The event read and both updates run on the caller's cookie client: the
  // admin policies on events ("Admins can view all events", "Admins can
  // update any event") permit them (DEC-49). The creator's notification goes
  // through the elevated door: notifications INSERT is granted to service_role
  // only. REGISTRY.md row: "Notify another user (notifications insert)".
  const supabase = ctx.supabase;

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
    // Only the moderated fields leave the queue (REVIEW-05 WR-01). PATCH
    // /api/events/[id] writes nothing else into pending_edits, but the column
    // is creator-writable, and this update runs with admin privileges: an
    // unlisted key (created_by, club_id, status, …) must never be applied.
    const liveUpdates: Record<string, unknown> = { pending_edits: null };
    const approvedFields: string[] = [];
    for (const key of MODERATED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(pendingEdits, key)) {
        liveUpdates[key] = pendingEdits[key];
        approvedFields.push(key);
      }
    }

    const { data: updateData, error: updateError } = await supabase
      .from("events")
      .update(liveUpdates)
      .eq("id", id)
      .not("pending_edits", "is", null)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!updateData || updateData.length === 0) {
      return NextResponse.json(
        { error: "Pending edits were modified concurrently. Please refresh and try again." },
        { status: 409 }
      );
    }

    if (event.created_by) {
      await getElevatedClient().from("notifications").insert({
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
      requestId: ctx.requestId,
      action: "approved_edits",
      targetType: "event",
      targetId: id,
      metadata: { approved_fields: approvedFields },
    });

    return NextResponse.json({ success: true, message: "Edits approved" });
  }

  // Reject
  const { data: rejectData, error: updateError } = await supabase
    .from("events")
    .update({ pending_edits: null })
    .eq("id", id)
    .not("pending_edits", "is", null)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!rejectData || rejectData.length === 0) {
    return NextResponse.json(
      { error: "Pending edits were modified concurrently. Please refresh and try again." },
      { status: 409 }
    );
  }

  if (event.created_by) {
    await getElevatedClient().from("notifications").insert({
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
    requestId: ctx.requestId,
    action: "rejected_edits",
    targetType: "event",
    targetId: id,
    metadata: { reason, rejected_fields: Object.keys(pendingEdits).filter(k => k !== "submitted_at") },
  });

  return NextResponse.json({ success: true, message: "Edits rejected" });
}
