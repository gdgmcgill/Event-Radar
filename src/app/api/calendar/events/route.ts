import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";

/**
 * GET /api/calendar/events
 * Returns the authenticated user's saved + RSVP'd events with club info.
 *
 * Optional query params for date-range filtering:
 *   ?from=2026-01-01&to=2026-03-31
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

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

    let query = supabase
      .from("events")
      .select(
        "*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)"
      )
      .in("id", allIds)
      .eq("status", "approved")
      .order("start_date", { ascending: true });

    if (from) {
      query = query.gte("start_date", from);
    }
    if (to) {
      query = query.lte("start_date", to);
    }

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform DB rows → frontend Event shape (derives event_date, event_time from start_date)
    const transformed = (events || []).map((e) =>
      transformEventFromDB(e as any)
    );

    // Annotate with user's save/RSVP status
    const annotated = transformed.map((e) => ({
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
