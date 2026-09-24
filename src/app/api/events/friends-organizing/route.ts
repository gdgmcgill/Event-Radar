import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { NextResponse } from "next/server";
import { getESTToday } from "@/lib/timezone";

/**
 * GET /api/events/friends-organizing — Upcoming events created by friends
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

    const today = getESTToday();

    // Get upcoming approved events created by friends
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, start_date, location, image_url, created_by, users!events_created_by_fkey(id, name, avatar_url)")
      .in("created_by", friendIds)
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(10);

    if (eventsError || !events) {
      return NextResponse.json({ events: [] });
    }

    const results = events.map((e: any) => ({
      id: e.id,
      title: e.title,
      start_date: e.start_date,
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
