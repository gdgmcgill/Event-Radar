import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";
import { getESTNow } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const nowEST = getESTNow();
    const nowISO = nowEST.toISOString();

    // Also include events starting within the next 30 minutes ("starting soon")
    const soonEST = new Date(nowEST.getTime() + 30 * 60 * 1000);
    const soonISO = soonEST.toISOString();

    // Safety guard: no campus event lasts more than 24 hours.
    // Exclude events whose start_date is more than 24h in the past to prevent
    // stale events with bad/null end_dates from appearing.
    const cutoffEST = new Date(nowEST.getTime() - 24 * 60 * 60 * 1000);
    const cutoffISO = cutoffEST.toISOString();

    // "Happening now" = already started AND not yet ended, OR starting within 30 min
    // We use an OR filter: (start_date <= now AND end_date >= now) OR (start_date > now AND start_date <= now+30m)
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)")
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("start_date", cutoffISO)
      .not("end_date", "is", null)
      .or(`and(start_date.lte.${nowISO},end_date.gte.${nowISO}),and(start_date.gt.${nowISO},start_date.lte.${soonISO})`)
      .order("start_date", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Supabase error fetching happening now events:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const events = (eventsData || []).map(event =>
      transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching happening now events:", message, error);
    return NextResponse.json(
      { error: "Failed to fetch happening now events", details: message },
      { status: 500 }
    );
  }
}
