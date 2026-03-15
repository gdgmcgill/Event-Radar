import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/events/new
 * Returns the 10 most recently created approved upcoming events.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "approved")
      .gte("start_date", today)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ events: events ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch new events" }, { status: 500 });
  }
}
