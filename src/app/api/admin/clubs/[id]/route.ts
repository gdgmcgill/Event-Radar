import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("admin")) {
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
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );

    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_approved",
        title: "Club Approved!",
        message: `Your club "${club.name}" has been approved. You are now an organizer and can create events.`,
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
