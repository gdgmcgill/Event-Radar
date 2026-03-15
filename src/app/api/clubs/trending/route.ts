import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "15", 10) || 15, 100);

    const supabase = await createClient();

    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved");

    if (clubsError || !clubs) {
      return NextResponse.json({ clubs: [] });
    }

    const clubIds = clubs.map((c) => c.id);
    if (clubIds.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const today = new Date().toISOString().split("T")[0];

    const [followersResult, eventsResult] = await Promise.all([
      supabase
        .from("club_followers")
        .select("club_id")
        .in("club_id", clubIds),
      supabase
        .from("events")
        .select("club_id")
        .in("club_id", clubIds)
        .eq("status", "approved")
        .gte("start_date", today),
    ]);

    const followerCounts: Record<string, number> = {};
    for (const f of followersResult.data ?? []) {
      followerCounts[f.club_id] = (followerCounts[f.club_id] ?? 0) + 1;
    }

    const upcomingCounts: Record<string, number> = {};
    for (const e of eventsResult.data ?? []) {
      if (e.club_id) {
        upcomingCounts[e.club_id] = (upcomingCounts[e.club_id] ?? 0) + 1;
      }
    }

    const enriched = clubs
      .map((club) => ({
        ...club,
        follower_count: followerCounts[club.id] ?? 0,
        upcoming_event_count: upcomingCounts[club.id] ?? 0,
      }))
      .sort((a, b) => b.follower_count - a.follower_count)
      .slice(0, limit);

    return NextResponse.json({ clubs: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch trending clubs" },
      { status: 500 }
    );
  }
}
