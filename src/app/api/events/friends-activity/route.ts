import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/events/friends-activity — Events where 2+ friends are going
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ events: [] });
    }

    // Get friend IDs (mutual follows)
    const { data: friends, error: friendsError } = await (supabase as any).rpc(
      "get_friends",
      { target_user_id: user.id }
    );

    if (friendsError || !friends || friends.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const friendIds = friends.map((f: any) => f.id);

    // Get saved events by friends for upcoming events
    const today = new Date().toISOString().split("T")[0];

    const { data: savedByFriends, error: savedError } = await (supabase as any)
      .from("saved_events")
      .select("event_id, user_id, users!inner(id, name, avatar_url), events!inner(id, title, event_date, event_time, location, image_url)")
      .in("user_id", friendIds)
      .gte("events.event_date", today);

    if (savedError || !savedByFriends) {
      return NextResponse.json({ events: [] });
    }

    // Group by event_id and count friends
    const eventMap = new Map<string, {
      event: any;
      friends: { id: string; name: string; avatar_url: string | null }[];
    }>();

    for (const row of savedByFriends) {
      const eventId = row.event_id;
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          event: row.events,
          friends: [],
        });
      }
      const entry = eventMap.get(eventId)!;
      entry.friends.push({
        id: row.users.id,
        name: row.users.name,
        avatar_url: row.users.avatar_url,
      });
    }

    // Filter to events with 2+ friends and sort by friend count
    const results = Array.from(eventMap.values())
      .filter((e) => e.friends.length >= 2)
      .sort((a, b) => b.friends.length - a.friends.length)
      .slice(0, 5)
      .map((e) => ({
        ...e.event,
        friends_going: e.friends,
        friends_count: e.friends.length,
      }));

    return NextResponse.json({ events: results });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
