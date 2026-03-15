/**
 * GET /api/events/following
 * Returns upcoming approved events from clubs the current user follows.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ events: [] });
    }

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
    const today = new Date().toISOString().split("T")[0];
    const { data: events, error } = await supabase
      .from("events")
      .select("*, clubs:club_id (id, name, logo_url)")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("Error fetching followed club events:", error);
      return NextResponse.json({ events: [] });
    }

    // Flatten the club join
    const mapped = (events ?? []).map((e) => ({
      ...e,
      club: e.clubs ?? null,
      clubs: undefined,
    }));

    return NextResponse.json({ events: mapped });
  } catch (error) {
    console.error("Error in GET /api/events/following:", error);
    return NextResponse.json({ events: [] });
  }
}
