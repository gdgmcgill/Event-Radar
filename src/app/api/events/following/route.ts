/**
 * GET /api/events/following
 * Returns upcoming approved events from clubs the current user follows.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";

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
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)")
      .in("club_id", clubIds)
      .eq("status", "approved")
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("Error fetching followed club events:", error);
      return NextResponse.json({ events: [] });
    }

    const events = (eventsData || []).map((event) =>
      transformEventFromDB(event as unknown as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error in GET /api/events/following:", error);
    return NextResponse.json({ events: [] });
  }
}
