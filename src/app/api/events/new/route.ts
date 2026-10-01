import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { EVENT_WITH_CLUB_SELECT, transformEventFromDB } from "@/lib/tagMapping";
import { withRoute } from "@/server/route";

/**
 * GET /api/events/new
 * Returns the 10 most recently created approved upcoming events.
 */
export const GET = withRoute({ cache: "public-60-300", action: "fetch new events" }, async () => {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: eventsData, error } = await supabase
    .from("events")
    .select(EVENT_WITH_CLUB_SELECT)
    .eq("status", "approved")
    .is("deleted_at", null)
    .gte("start_date", today)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  const events = (eventsData || []).map((event) =>
    transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
  );

  return NextResponse.json({ events });
});
