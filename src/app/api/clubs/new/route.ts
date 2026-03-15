import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/clubs/new
 * Returns recently approved clubs, ordered by created_at desc. Limit 10.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10);

    if (clubsError || !clubs || clubs.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const clubIds = clubs.map((c) => c.id);
    const today = new Date().toISOString().split("T")[0];

    const [followersResult, upcomingResult, totalResult] = await Promise.all([
      supabase.from("club_followers").select("club_id").in("club_id", clubIds),
      supabase.from("events").select("club_id").in("club_id", clubIds).eq("status", "approved").gte("start_date", today),
      supabase.from("events").select("club_id").in("club_id", clubIds).eq("status", "approved"),
    ]);

    const followerCounts: Record<string, number> = {};
    for (const f of followersResult.data ?? []) {
      followerCounts[f.club_id] = (followerCounts[f.club_id] ?? 0) + 1;
    }

    const upcomingCounts: Record<string, number> = {};
    for (const e of upcomingResult.data ?? []) {
      if (e.club_id) upcomingCounts[e.club_id] = (upcomingCounts[e.club_id] ?? 0) + 1;
    }

    const totalCounts: Record<string, number> = {};
    for (const e of totalResult.data ?? []) {
      if (e.club_id) totalCounts[e.club_id] = (totalCounts[e.club_id] ?? 0) + 1;
    }

    const enriched = clubs.map((club) => ({
      ...club,
      follower_count: followerCounts[club.id] ?? 0,
      upcoming_event_count: upcomingCounts[club.id] ?? 0,
      total_event_count: totalCounts[club.id] ?? 0,
    }));

    return NextResponse.json({ clubs: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch new clubs" }, { status: 500 });
  }
}
