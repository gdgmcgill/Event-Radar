import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: orgRequest, error: fetchError } = await serviceClient
    .from("organizer_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !orgRequest) {
    return NextResponse.json(
      { error: "Organizer request not found" },
      { status: 404 }
    );
  }

  if (orgRequest.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been reviewed" },
      { status: 409 }
    );
  }

  const { error: updateError } = await serviceClient
    .from("organizer_requests")
    .update({
      status,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status as "approved" | "rejected",
      targetType: "organizer_request",
      targetId: id,
      metadata: { user_id: orgRequest.user_id, club_id: orgRequest.club_id },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  if (status === "approved") {
    const { data: targetUser } = await serviceClient
      .from("users")
      .select("roles")
      .eq("id", orgRequest.user_id)
      .single();

    if (targetUser && !targetUser.roles?.includes("club_organizer")) {
      const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
      await serviceClient
        .from("users")
        .update({
          roles: updatedRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgRequest.user_id);
    }

    await serviceClient.from("club_members").upsert(
      {
        user_id: orgRequest.user_id,
        club_id: orgRequest.club_id,
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );
  }

  try {
    const { data: club } = await serviceClient
      .from("clubs")
      .select("name")
      .eq("id", orgRequest.club_id)
      .single();

    const clubName = club?.name || "the club";
    const isApproved = status === "approved";

    await serviceClient.from("notifications").insert({
      user_id: orgRequest.user_id,
      type: isApproved ? "organizer_approved" : "organizer_rejected",
      title: isApproved
        ? "Organizer Request Approved!"
        : "Organizer Request Not Approved",
      message: isApproved
        ? `Your request to become an organizer for ${clubName} has been approved. You can now create events for this club.`
        : `Your request to become an organizer for ${clubName} was not approved.`,
    });
  } catch (notifErr) {
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
