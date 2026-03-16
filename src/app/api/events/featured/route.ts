import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("featured_events")
      .select("*, event:events(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out entries where the joined event is missing, not approved, or soft-deleted
    const featured = (data ?? []).filter(
      (row: any) => row.event && row.event.status === "approved" && row.event.deleted_at === null
    );

    return NextResponse.json({ featured });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
}
