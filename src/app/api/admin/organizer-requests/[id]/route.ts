import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";

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
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // The request read and update, the target's roles read, the membership
  // upsert and the club name read run on the caller's cookie client: the admin
  // policies on organizer_requests, users (SELECT), club_members and the public
  // clubs read permit them (DEC-49). The roles write and the notification go
  // through the elevated door.
  const supabase = ctx.supabase;

  const { data: orgRequest, error: fetchError } = await supabase
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

  const { error: updateError } = await supabase
    .from("organizer_requests")
    .update({
      status,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: status as "approved" | "rejected",
      targetType: "organizer_request",
      targetId: id,
      metadata: { user_id: orgRequest.user_id, club_id: orgRequest.club_id },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  if (status === "approved") {
    const { data: targetUser } = await supabase
      .from("users")
      .select("roles")
      .eq("id", orgRequest.user_id)
      .single();

    if (targetUser && !targetUser.roles?.includes("club_organizer")) {
      const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
      // users has no admin UPDATE policy and the F-006 grant withholds roles.
      // REGISTRY.md row: "Set another user's roles on approval
      // (club_organizer)".
      await getElevatedClient()
        .from("users")
        .update({
          roles: updatedRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgRequest.user_id);
    }

    await supabase.from("club_members").upsert(
      {
        user_id: orgRequest.user_id,
        club_id: orgRequest.club_id,
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );
  }

  try {
    const { data: club } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", orgRequest.club_id)
      .single();

    const clubName = club?.name || "the club";
    const isApproved = status === "approved";

    // REGISTRY.md row: "Notify another user (notifications insert)".
    await getElevatedClient().from("notifications").insert({
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
