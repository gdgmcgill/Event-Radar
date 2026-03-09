import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/cron/archive-events
 *
 * Archives events whose end_date (or start_date when end_date is absent)
 * is more than 7 days in the past.  Archived events keep their row in the
 * `events` table but their status is set to "archived", which causes them
 * to be excluded from browse/search while remaining visible in club
 * dashboards and analytics.
 *
 * Authentication: Bearer token matching the CRON_SECRET env variable.
 * Schedule suggestion: run once daily (e.g. "0 3 * * *").
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffIso = cutoff.toISOString();

  try {
    // Find approved/pending events that have passed the 7-day cutoff.
    // We prefer end_date when available; otherwise fall back to start_date.
    // The filter uses start_date as the primary column because end_date may
    // be NULL, and Supabase JS doesn't support coalesce in client queries.
    // Events with an end_date are re-checked after the initial fetch.
    const { data: candidates, error: fetchError } = await supabase
      .from("events")
      .select("id, start_date, end_date")
      .in("status", ["approved", "pending"])
      .lt("start_date", cutoffIso);

    if (fetchError) {
      console.error("[Cron] archive-events fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        success: true,
        archived: 0,
        checked_at: new Date().toISOString(),
      });
    }

    // Keep only events where the effective end date is older than the cutoff.
    // For events with an end_date that is still within 7 days, skip them.
    const toArchive = candidates.filter((ev) => {
      const effectiveEnd = ev.end_date ?? ev.start_date;
      return effectiveEnd && new Date(effectiveEnd) < cutoff;
    });

    if (toArchive.length === 0) {
      return NextResponse.json({
        success: true,
        archived: 0,
        checked_at: new Date().toISOString(),
      });
    }

    const idsToArchive = toArchive.map((ev) => ev.id);

    const { error: updateError } = await supabase
      .from("events")
      .update({ status: "archived" as never, updated_at: new Date().toISOString() })
      .in("id", idsToArchive);

    if (updateError) {
      console.error("[Cron] archive-events update error:", updateError);
      return NextResponse.json(
        { error: "Failed to archive events" },
        { status: 500 }
      );
    }

    console.log(`[Cron] archive-events: archived ${idsToArchive.length} events`);

    return NextResponse.json({
      success: true,
      archived: idsToArchive.length,
      archived_ids: idsToArchive,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] archive-events unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
