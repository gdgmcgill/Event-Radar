import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;
  const supabase = ctx.supabase;

  const { id: clubId } = await params;

  // Verify current user is owner
  const gate = await requireClubRole(
    supabase,
    clubId,
    user.id,
    ["owner"],
    "Only the club owner can transfer ownership"
  );
  if (!gate.ok) return gate.response;

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

  // The elevated door, after the owner gate (DEC-41): club_members UPDATE is
  // admin-only under RLS, and after F-007 no client role may insert audit
  // rows. REGISTRY.md rows: "Owner changes a member's role or transfers
  // ownership" and "Record a club deletion or ownership transfer in
  // admin_audit_log".
  const serviceClient = getElevatedClient();

  // Set new owner
  const { error: newOwnerError } = await serviceClient
    .from("club_members")
    .update({ role: "owner" })
    .eq("id", targetMember.id);

  if (newOwnerError) {
    return NextResponse.json({ error: "Failed to set new owner" }, { status: 500 });
  }

  // Demote current owner to organizer. The guard reports the role only, so
  // the caller's own membership is addressed by (club_id, user_id) (DEC-40).
  const { error: demoteError } = await serviceClient
    .from("club_members")
    .update({ role: "organizer" })
    .eq("club_id", clubId)
    .eq("user_id", user.id);

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
    admin_user_id: user.id,
    action: "club_ownership_transferred",
    target_type: "club",
    target_id: clubId,
    metadata: { new_owner_id: newOwnerId, previous_owner_id: user.id },
  });

  return NextResponse.json({ success: true });
}
