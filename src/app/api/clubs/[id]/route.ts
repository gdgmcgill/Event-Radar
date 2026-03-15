import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]
 * Public endpoint - returns club details with follower count.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const [clubResult, followerResult] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase
        .from("club_followers")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId),
    ]);

    if (clubResult.error || !clubResult.data) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    return NextResponse.json({
      club: clubResult.data,
      followerCount: followerResult.count ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch club" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clubs/[id]
 * Owner-only endpoint - updates club details.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .eq("role", "owner")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Only the club owner can update club details" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "name",
      "description",
      "category",
      "instagram_handle",
      "logo_url",
      "banner_url",
      "website_url",
      "discord_url",
      "twitter_url",
      "linkedin_url",
    ] as const;

    const updates: Record<string, string | null> = {};
    for (const field of allowedFields) {
      if (field in body) {
        const value = body[field];
        updates[field] =
          typeof value === "string" ? value.trim() || null : value;
      }
    }

    // Validate URL fields
    const urlFields = ["website_url", "discord_url", "twitter_url", "linkedin_url"] as const;
    for (const field of urlFields) {
      if (updates[field] && typeof updates[field] === "string") {
        try {
          new URL(updates[field] as string);
        } catch {
          return NextResponse.json(
            { error: `Invalid URL for ${field}` },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: club, error } = await supabase
      .from("clubs")
      .update(updates)
      .eq("id", clubId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ club });
  } catch {
    return NextResponse.json(
      { error: "Failed to update club" },
      { status: 500 }
    );
  }
}
