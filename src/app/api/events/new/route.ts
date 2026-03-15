import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { transformEventFromDB } from "@/lib/tagMapping";

/**
 * GET /api/events/new
 * Returns the 10 most recently created approved upcoming events.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)")
      .eq("status", "approved")
      .gte("start_date", today)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ events: [] });
    }

    const events = (eventsData || []).map((event) =>
      transformEventFromDB(event as unknown as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Failed to fetch new events" }, { status: 500 });
  }
}
