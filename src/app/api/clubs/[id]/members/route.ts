import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { CLUB_ROLES, requireClubRole } from "@/server/authz/requireClubRole";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]/members
 * Returns club members with user details. Requires club membership (owner or organizer).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const supabase = ctx.supabase;

    // Verify caller is a member of this club (owner or organizer)
    const gate = await requireClubRole(
      supabase,
      clubId,
      auth.user.id,
      CLUB_ROLES,
      "You must be a member of this club to view members"
    );
    if (!gate.ok) return gate.response;

    // Fetch members - query club_members then fetch user details separately
    // since Supabase generated types don't define the relationship
    const { data: members, error } = await supabase
      .from("club_members")
      .select("id, user_id, role, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Fetch user details for all members
    const userIds = members.map((m) => m.user_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name, avatar_url")
      .in("id", userIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));

    const membersWithUsers = members.map((member) => ({
      ...member,
      user: userMap.get(member.user_id) ?? null,
    }));

    return NextResponse.json({ members: membersWithUsers });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clubs/[id]/members
 * Remove a member from the club. Owner-only. Cannot remove self.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: clubId } = await params;

    // Verify caller is owner
    const gate = await requireClubRole(
      supabase,
      clubId,
      user.id,
      ["owner"],
      "Only the club owner can remove members"
    );
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const { memberId } = body as { memberId: string };

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // Fetch the target member to verify they're not the owner
    const { data: targetMember } = await supabase
      .from("club_members")
      .select("user_id, role")
      .eq("id", memberId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (targetMember.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the club" },
        { status: 400 }
      );
    }

    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the club owner" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("id", memberId)
      .eq("club_id", clubId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
