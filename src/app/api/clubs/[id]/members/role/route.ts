import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";

/** PostgREST's code when `.single()` matches no row. */
const NO_ROW = "PGRST116";

export async function PATCH(
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

  // Only owner can change roles
  const gate = await requireClubRole(
    supabase,
    clubId,
    user.id,
    ["owner"],
    "Only the club owner can change roles"
  );
  if (!gate.ok) return gate.response;

  const { memberId, role } = await request.json();

  if (!memberId || role !== "organizer") {
    return NextResponse.json({ error: "Invalid request. Role must be 'organizer'." }, { status: 400 });
  }

  // Cannot change own role
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role. Use transfer ownership instead." }, { status: 400 });
  }

  // The owner's role change runs on the elevated door AFTER the owner gate
  // (F-087, DEC-41): club_members UPDATE is admin-only under RLS. The only
  // role this path can write is "organizer" (validated above), and the owner
  // row and the caller's own row are refused above. REGISTRY.md row: "Owner
  // changes a member's role or transfers ownership".
  //
  // The write is scoped on its own (REVIEW-05 WR-03): the checks above ran on
  // a separate read, so the elevated update re-states them as filters. It can
  // touch only a row of THIS club that is not, at the moment of the write, an
  // owner row. If a concurrent transfer made the target the owner, nothing
  // matches and the route answers 409 rather than demoting the new owner.
  const { data: updated, error } = await getElevatedClient()
    .from("club_members")
    .update({ role })
    .eq("id", memberId)
    .eq("club_id", clubId)
    .neq("role", "owner")
    .select()
    .single();

  if (error?.code === NO_ROW) {
    return NextResponse.json(
      { error: "Member changed concurrently. Please refresh and try again." },
      { status: 409 }
    );
  }

  if (error) {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}
