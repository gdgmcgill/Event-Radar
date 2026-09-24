import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { NextResponse } from "next/server";

/**
 * GET /api/events/friends-activity — Events where 2+ friends are going
 */
export async function GET() {
  try {
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Get friend IDs (mutual follows)
    const { data: friends, error: friendsError } = await supabase.rpc(
      "get_friends",
      { target_user_id: user.id }
    );

    if (friendsError || !friends || friends.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const friendIds = friends.map((f: any) => f.id);

    // Get saved events by friends for upcoming events
    const today = new Date().toISOString().split("T")[0];

    const { data: savedByFriends, error: savedError } = await supabase
      .from("saved_events")
      .select("event_id, user_id, users!inner(id, name, avatar_url), events!inner(id, title, start_date, location, image_url)")
      .in("user_id", friendIds)
      .gte("events.start_date", today);

    if (savedError || !savedByFriends) {
      return NextResponse.json({ events: [] });
    }

    // Group by event_id and count friends
    const eventMap = new Map<string, {
      event: any;
      // `users.name` is nullable in the schema. The response has always carried
      // whatever the column held, null included; the declared type said `string`
      // and the client cast kept that lie compiling. Widening the declaration
      // changes no payload — it stops the local type from contradicting the row.
      friends: { id: string; name: string | null; avatar_url: string | null }[];
    }>();

    for (const row of savedByFriends) {
      const eventId = row.event_id;
      // `saved_events.event_id` is nullable in the schema. The select uses
      // `events!inner`, so PostgREST cannot return a row whose event_id is null
      // and this guard is unreachable in practice — it is here because the map
      // is keyed by event id and a null key would silently merge unrelated rows
      // if the join were ever loosened.
      if (eventId === null) continue;
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
