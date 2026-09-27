import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";
import { parseBody } from "@/server/body";
import { ClubTransferBody } from "@/contracts/clubs";
import { logRouteError, withRoute } from "@/server/route";

export const POST = withRoute({ cache: "private", action: "transfer ownership" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const parsed = await parseBody(request, ClubTransferBody);
  if (!parsed.ok) return parsed.response;
  const { newOwnerId } = parsed.data;

  // A self-transfer would promote and then demote the same row, leaving the
  // club with no owner (REVIEW-05 WR-02). Refused before any write. This is
  // the cheap check for the canonical spelling; the membership row below is
  // the authoritative one.
  if (newOwnerId === user.id) {
    return NextResponse.json(
      { error: "You already own this club" },
      { status: 400 }
    );
  }

  // Verify target is a club member
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("id, role, user_id")
    .eq("club_id", clubId)
    .eq("user_id", newOwnerId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this club" }, { status: 400 });
  }

  // The string check above misses a non-canonical spelling of the caller's
  // own id (upper case, braces, no hyphens): Postgres's uuid cast accepts
  // them all, so the lookup returned the caller's own owner row. The
  // identity the database returned is the one compared (REVIEW-05 iter3
  // WR-01).
  if (String(targetMember.user_id).toLowerCase() === user.id.toLowerCase()) {
    return NextResponse.json(
      { error: "You already own this club" },
      { status: 400 }
    );
  }

  // DI-62: memberships and audit commit together; the RPC locks the club
  // and rechecks ownership after waiting for concurrent transfer attempts.
  const { data: outcome, error } = await getElevatedClient().rpc("transfer_club_ownership_atomic", {
    p_club_id: clubId,
    p_actor_id: user.id,
    p_new_owner_id: targetMember.user_id,
  });
  if (error) {
    logRouteError(error);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }
  if (outcome !== "ok") {
    return NextResponse.json(
      { error: "Member changed concurrently. Please refresh and try again." },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
});
