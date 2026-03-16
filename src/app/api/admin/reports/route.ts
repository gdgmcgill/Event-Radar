import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const eventId = url.searchParams.get("event_id");
  const rawLimit = parseInt(url.searchParams.get("limit") || "50");
  const limit = isNaN(rawLimit) || rawLimit < 0 ? 50 : Math.min(rawLimit, 100);
  const rawOffset = parseInt(url.searchParams.get("offset") || "0");
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const supabase = createServiceClient();

  let query = supabase
    .from("event_reports")
    .select(`
      *,
      event:events!inner(id, title, status, deleted_at),
      reporter:users!event_reports_reporter_id_fkey(id, display_name, avatar_url)
    `)
    .is("event.deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data: reports, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute accurate report_count per event via a separate query
  const eventIds = [...new Set((reports || []).map((r: any) => r.event_id))];
  const eventCounts: Record<string, number> = {};

  if (eventIds.length > 0) {
    const { data: countRows } = await supabase
      .from("event_reports")
      .select("event_id")
      .in("event_id", eventIds)
      .eq("status", "pending");

    if (countRows) {
      for (const row of countRows) {
        eventCounts[row.event_id] = (eventCounts[row.event_id] || 0) + 1;
      }
    }
  }

  const enriched = (reports || []).map((r: any) => ({
    ...r,
    report_count: eventCounts[r.event_id] || 1,
  }));

  return NextResponse.json({ reports: enriched });
}
