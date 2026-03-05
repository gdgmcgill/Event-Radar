/**
 * GET /api/clubs/:id/follow
 * Check if the current user follows this club and if they are a member.
 * Returns { is_following: false, is_member: false } for unauthenticated users.
 *
 * POST /api/clubs/:id/follow
 * Follow a club. Idempotent — safe to call multiple times.
 * Requires: authenticated user
 *
 * DELETE /api/clubs/:id/follow
 * Unfollow a club.
 * Requires: authenticated user
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated: public-safe default
    if (!user) {
      return NextResponse.json({ is_following: false, is_member: false });
    }

    // Run both checks in parallel
    const [followerResult, memberResult] = await Promise.all([
      supabase
        .from("club_followers")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .maybeSingle(),
      supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      is_following: followerResult.data !== null,
      is_member: memberResult.data !== null,
    });
  } catch (error) {
    console.error("Error in GET club follow status:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow status" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

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

    const { error } = await supabase
      .from("club_followers")
      .upsert(
        { user_id: user.id, club_id: clubId },
        { onConflict: "user_id,club_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("Error following club:", error);
      return NextResponse.json({ error: "Failed to follow club" }, { status: 500 });
    }

    return NextResponse.json({ message: "Followed" }, { status: 201 });
  } catch (error) {
    console.error("Error in POST club follow:", error);
    return NextResponse.json(
      { error: "Failed to follow club" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

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

    const { error } = await supabase
      .from("club_followers")
      .delete()
      .eq("user_id", user.id)
      .eq("club_id", clubId);

    if (error) {
      console.error("Error unfollowing club:", error);
      return NextResponse.json({ error: "Failed to unfollow club" }, { status: 500 });
    }

    return NextResponse.json({ message: "Unfollowed" }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE club follow:", error);
    return NextResponse.json(
      { error: "Failed to unfollow club" },
      { status: 500 }
    );
  }
}
