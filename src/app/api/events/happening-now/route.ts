import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { transformEventFromDB } from "@/lib/tagMapping";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Calculate time window: Now to exactly 2 hours from now
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const nowISO = now.toISOString();
    const soonISO = twoHoursFromNow.toISOString();

    // Query events starting within the next 2 hours
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)")
      .eq("status", "approved")
      .gte("start_date", nowISO)
      .lte("start_date", soonISO)
      .order("start_date", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Supabase error fetching happening now events:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const events = (eventsData || []).map(event =>
      transformEventFromDB(event as unknown as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({
      events,
    });
  } catch (error) {
    console.error("Error fetching happening now events:", error);
    return NextResponse.json(
      { error: "Failed to fetch happening now events" },
      { status: 500 }
    );
  }
}
