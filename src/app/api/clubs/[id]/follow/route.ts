import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]/follow
 * Returns whether the current user follows this club.
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

    const { data } = await supabase
      .from("club_followers")
      .select("id")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    return NextResponse.json({ following: !!data });
  } catch {
    return NextResponse.json(
      { error: "Failed to check follow status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs/[id]/follow
 * Follow a club.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.from("club_followers").upsert(
      { user_id: user.id, club_id: clubId },
      { onConflict: "user_id,club_id", ignoreDuplicates: true }
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to follow club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ following: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to follow club" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clubs/[id]/follow
 * Unfollow a club.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("club_followers")
      .delete()
      .eq("user_id", user.id)
      .eq("club_id", clubId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to unfollow club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ following: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to unfollow club" },
      { status: 500 }
    );
  }
}
