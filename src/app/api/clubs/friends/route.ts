import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: friends, error: friendsError } = await (supabase as any).rpc(
      "get_friends",
      { target_user_id: user.id }
    );

    if (friendsError || !friends || friends.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const friendIds = friends.map((f: any) => f.id);

    const { data: friendFollows, error: followError } = await supabase
      .from("club_followers")
      .select("club_id, user_id")
      .in("user_id", friendIds);

    if (followError || !friendFollows || friendFollows.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const clubFriendCounts: Record<string, number> = {};
    for (const f of friendFollows) {
      clubFriendCounts[f.club_id] = (clubFriendCounts[f.club_id] ?? 0) + 1;
    }

    const clubIds = Object.keys(clubFriendCounts);

    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .in("id", clubIds)
      .eq("status", "approved");

    if (clubsError || !clubs || clubs.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const today = new Date().toISOString().split("T")[0];
    const approvedClubIds = clubs.map((c) => c.id);

    const [followersResult, eventsResult] = await Promise.all([
      supabase
        .from("club_followers")
        .select("club_id")
        .in("club_id", approvedClubIds),
      supabase
        .from("events")
        .select("club_id")
        .in("club_id", approvedClubIds)
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
        friends_following: clubFriendCounts[club.id] ?? 0,
      }))
      .sort((a, b) => b.friends_following - a.friends_following)
      .slice(0, 15);

    return NextResponse.json({ clubs: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch friends' clubs" },
      { status: 500 }
    );
  }
}
