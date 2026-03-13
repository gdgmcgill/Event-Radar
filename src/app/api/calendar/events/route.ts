import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/calendar/events
 * Returns the authenticated user's saved + RSVP'd events with club info.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch saved event IDs
    const { data: savedRows } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", user.id);

    // Fetch RSVP'd event IDs (going or interested)
    const { data: rsvpRows } = await supabase
      .from("rsvps")
      .select("event_id, status")
      .eq("user_id", user.id)
      .in("status", ["going", "interested"]);

    const savedIds = new Set((savedRows || []).map((r) => r.event_id));
    const rsvpMap = new Map(
      (rsvpRows || []).map((r) => [r.event_id, r.status])
    );
    const allIds = [...new Set([...savedIds, ...rsvpMap.keys()])];

    if (allIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { data: events, error } = await supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url)")
      .in("id", allIds)
      .eq("status", "approved")
      .order("event_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const annotated = (events || []).map((e) => ({
      ...e,
      is_saved: savedIds.has(e.id),
      rsvp_status: rsvpMap.get(e.id) || null,
    }));

    return NextResponse.json({ events: annotated });
  } catch (error) {
    console.error("Calendar events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
