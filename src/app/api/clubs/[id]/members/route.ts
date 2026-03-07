import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is a member of this club
    const { data: callerMembership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (!callerMembership) {
      return NextResponse.json(
        { error: "You must be a member of this club to view members" },
        { status: 403 }
      );
    }

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
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is owner
    const { data: callerMembership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .eq("role", "owner")
      .maybeSingle();

    if (!callerMembership) {
      return NextResponse.json(
        { error: "Only the club owner can remove members" },
        { status: 403 }
      );
    }

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
