import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify current user is owner
  const { data: currentMember } = await supabase
    .from("club_members")
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!currentMember || currentMember.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can transfer ownership" }, { status: 403 });
  }

  const { newOwnerId } = await request.json();

  if (!newOwnerId) {
    return NextResponse.json({ error: "newOwnerId is required" }, { status: 400 });
  }

  // Verify target is a club member
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", newOwnerId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this club" }, { status: 400 });
  }

  // Use service client for update (bypass RLS)
  const serviceClient = createServiceClient();

  // Set new owner
  const { error: newOwnerError } = await serviceClient
    .from("club_members")
    .update({ role: "owner" })
    .eq("id", targetMember.id);

  if (newOwnerError) {
    return NextResponse.json({ error: "Failed to set new owner" }, { status: 500 });
  }

  // Demote current owner to organizer
  const { error: demoteError } = await serviceClient
    .from("club_members")
    .update({ role: "organizer" })
    .eq("id", currentMember.id);

  if (demoteError) {
    // Rollback: restore original owner
    await serviceClient
      .from("club_members")
      .update({ role: "owner" })
      .eq("id", targetMember.id);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }

  // Audit log
  await serviceClient.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "club_ownership_transferred",
    target_type: "club",
    target_id: clubId,
    details: { new_owner_id: newOwnerId, previous_owner_id: user.id },
  });

  return NextResponse.json({ success: true });
}
