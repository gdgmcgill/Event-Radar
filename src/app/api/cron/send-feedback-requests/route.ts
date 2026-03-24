import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getESTNow } from "@/lib/timezone";

export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = getESTNow();
  let eventsProcessed = 0;
  let feedbackRequestsSent = 0;
  let feedbackRequestsSkipped = 0;

  try {
    // ── Find eligible events (ended 1-25 hours ago) ────────────────────────
    const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() -  1 * 60 * 60 * 1000).toISOString();

    const { data: eligibleEvents } = await supabase
      .from("events")
      .select("id, title, end_date")
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("end_date", windowStart)
      .lte("end_date", windowEnd);

    if (eligibleEvents && eligibleEvents.length > 0) {
      eventsProcessed = eligibleEvents.length;
      const eventIds = eligibleEvents.map((e) => e.id);

      // Step 2: fetch attendees who RSVPd "going"
      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("user_id, event_id")
        .in("event_id", eventIds)
        .eq("status", "going");

      if (rsvps && rsvps.length > 0) {
        // Step 3: batch-fetch already-logged feedback requests to deduplicate
        const { data: logged } = await supabase
          .from("feedback_request_log")
          .select("user_id, event_id")
          .eq("request_type", "post_event")
          .in("event_id", eventIds);

        const sentSet = new Set(
          (logged ?? []).map((r) => `${r.user_id}:${r.event_id}`)
        );

        // Step 4: per-user insert with error isolation
        for (const row of rsvps) {
          const event = eligibleEvents.find((e) => e.id === row.event_id);
          if (!event) continue;

          // Skip — already notified during a previous cron run
          if (sentSet.has(`${row.user_id}:${event.id}`)) {
            feedbackRequestsSkipped++;
            continue;
          }

          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: row.user_id,
            event_id: event.id,
            type: "feedback_request",
            title: `How was ${event.title}?`,
            message:
              "Share your experience — your feedback helps organizers improve future events.",
            read: false,
          });

          // null = fresh insert; 23505 = notification already existed (orphaned prior send)
          if (!notifErr || notifErr.code === "23505") {
            const { error: logErr } = await supabase.from("feedback_request_log").insert({
              user_id: row.user_id,
              event_id: event.id,
              request_type: "post_event",
            });

            // Only count as sent if log entry succeeded (or was already there)
            if (!logErr || logErr.code === "23505") {
              feedbackRequestsSent++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      events_processed: eventsProcessed,
      feedback_requests_sent: feedbackRequestsSent,
      feedback_requests_skipped: feedbackRequestsSkipped,
    });
  } catch (err) {
    console.error("[Cron] send-feedback-requests error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
