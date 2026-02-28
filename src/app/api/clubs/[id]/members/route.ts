/**
 * GET /api/clubs/:id/members
 * List members (and pending invites for owners) for a specific club
 * Requires: club membership for this club
 *
 * DELETE /api/clubs/:id/members
 * Remove a member from the club
 * Requires: owner role for this club
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in" },
        { status: 401 }
      );
    }

    // Verify the caller is a member of this club and get their role
    const { data: membership, error: membershipError } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this club" },
        { status: 403 }
      );
    }

    // Fetch members via Supabase join query (RLS enforces access)
    // Owners see all members; organizers see only themselves (per RLS policy)
    const { data: members, error } = await supabase
      .from("club_members")
      .select(`
        id,
        user_id,
        role,
        created_at,
        users (
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching club members:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Owners also see pending invitations
    let pendingInvites: Array<{ id: string; invitee_email: string; created_at: string; token: string }> = [];
    if (membership.role === "owner") {
      const { data: invites } = await supabase
        .from("club_invitations")
        .select("id, invitee_email, created_at, token")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      pendingInvites = invites ?? [];
    }

    return NextResponse.json({ members: members ?? [], pendingInvites });
  } catch (error) {
    console.error("Error in GET club members:", error);
    return NextResponse.json(
      { error: "Failed to fetch club members" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in" },
        { status: 401 }
      );
    }

    // Parse userId from request body
    const { userId: targetUserId } = await request.json();

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Check caller is an owner of this club
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .single();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the club owner can remove members" },
        { status: 403 }
      );
    }

    // Explicit self-removal guard before hitting DB (better UX error message)
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the club" },
        { status: 400 }
      );
    }

    // Delete the member row (DB-level self-removal guard is backup via CHECK constraint)
    const { error: deleteError } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      console.error("Error removing club member:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Member removed" });
  } catch (error) {
    console.error("Error in DELETE club member:", error);
    return NextResponse.json(
      { error: "Failed to remove club member" },
      { status: 500 }
    );
  }
}
