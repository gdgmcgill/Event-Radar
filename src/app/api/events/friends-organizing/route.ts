import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/events/friends-organizing — Upcoming events created by friends
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

    const today = new Date().toISOString().split("T")[0];

    // Get upcoming approved events created by friends
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, event_date, event_time, location, image_url, created_by, users!events_created_by_fkey(id, name, avatar_url)")
      .in("created_by", friendIds)
      .eq("status", "approved")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(10);

    if (eventsError || !events) {
      return NextResponse.json({ events: [] });
    }

    const results = events.map((e: any) => ({
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      event_time: e.event_time,
      location: e.location,
      image_url: e.image_url,
      organizer: e.users
        ? { id: e.users.id, name: e.users.name, avatar_url: e.users.avatar_url }
        : null,
    }));

    return NextResponse.json({ events: results });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
