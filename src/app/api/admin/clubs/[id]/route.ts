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

  const { data: club, error: fetchError } = await serviceClient
    .from("clubs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  if (club.status !== "pending") {
    return NextResponse.json(
      { error: "This club has already been reviewed" },
      { status: 409 }
    );
  }

  const { error: updateError } = await serviceClient
    .from("clubs")
    .update({
      status,
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
      targetType: "club",
      targetId: id,
      metadata: { club_name: club.name },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  if (status === "approved" && club.created_by) {
    const { data: targetUser } = await serviceClient
      .from("users")
      .select("roles")
      .eq("id", club.created_by)
      .single();

    if (targetUser && !targetUser.roles?.includes("club_organizer")) {
      const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
      await serviceClient
        .from("users")
        .update({
          roles: updatedRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", club.created_by);
    }

    await serviceClient.from("club_members").upsert(
      {
        user_id: club.created_by,
        club_id: id,
        role: "owner",              // DBROLE-06: creator becomes owner, not organizer
      },
      { onConflict: "user_id,club_id" }
    );

    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_approved",
        title: "Club Approved!",
        message: `Your club "${club.name}" has been approved. You are now the owner and can create events.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  if (status === "rejected" && club.created_by) {
    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_rejected",
        title: "Club Not Approved",
        message: `Your club "${club.name}" was not approved.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  return NextResponse.json({ success: true });
}
