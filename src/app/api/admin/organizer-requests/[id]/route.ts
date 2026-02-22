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

  // Check admin role
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

  // Fetch the request to get user_id and club_id
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

  // Update the request status
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

  // If approved, grant the club_organizer role and add to club_members
  if (status === "approved") {
    // Add 'club_organizer' to user's roles if not already present
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

    // Insert into club_members (ignore if already exists)
    await serviceClient.from("club_members").upsert(
      {
        user_id: orgRequest.user_id,
        club_id: orgRequest.club_id,
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );
  }

  // Send notification to the requester
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
