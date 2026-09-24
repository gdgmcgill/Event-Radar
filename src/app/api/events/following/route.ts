/**
 * GET /api/events/following
 * Returns upcoming approved events from clubs the current user follows.
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { EVENT_WITH_CLUB_SELECT, transformEventFromDB } from "@/lib/tagMapping";
import { getESTToday } from "@/lib/timezone";

export async function GET() {
  try {
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Get club IDs the user follows
    const { data: follows } = await supabase
      .from("club_followers")
      .select("club_id")
      .eq("user_id", user.id);

    const clubIds = (follows ?? []).map((f) => f.club_id);
    if (clubIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // Fetch upcoming approved events from those clubs
    const today = getESTToday();
    const { data: eventsData, error } = await supabase
      .from("events")
      .select(EVENT_WITH_CLUB_SELECT)
      .in("club_id", clubIds)
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("Error fetching followed club events:", error);
      return NextResponse.json({ events: [] });
    }

    const events = (eventsData || []).map((event) =>
      transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error in GET /api/events/following:", error);
    return NextResponse.json({ events: [] });
  }
}
