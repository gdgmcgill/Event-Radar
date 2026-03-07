import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const remindersSent: Record<string, number> = { "24h": 0, "1h": 0 };
  const remindersSkipped: Record<string, number> = { "24h": 0, "1h": 0 };

  try {
    // ── 24-hour reminders ──────────────────────────────────────────────────
    const h24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const h24End   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    // Step 1: find events in the 24h window
    const { data: events24h } = await supabase
      .from("events")
      .select("id, title, start_date")
      .gte("start_date", h24Start)
      .lte("start_date", h24End);

    if (events24h && events24h.length > 0) {
      const eventIds24h = events24h.map((e) => e.id);

      // Step 2: find users who saved those events
      const { data: saved24h } = await supabase
        .from("saved_events")
        .select("user_id, event_id")
        .in("event_id", eventIds24h);

      if (saved24h && saved24h.length > 0) {
        // Batch-fetch already-logged 24h reminders (mirrors a LEFT JOIN ... IS NULL check)
        const { data: logged24h } = await supabase
          .from("email_reminder_log")
          .select("user_id, event_id")
          .eq("reminder_type", "reminder_24h")
          .in("event_id", eventIds24h);

        const sent24hSet = new Set(
          (logged24h ?? []).map((r) => `${r.user_id}:${r.event_id}`)
        );

        for (const row of saved24h) {
          const event = events24h.find((e) => e.id === row.event_id);
          if (!event) continue;

          // Skip — already sent during a previous cron run
          if (sent24hSet.has(`${row.user_id}:${event.id}`)) {
            remindersSkipped["24h"]++;
            continue;
          }

          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: row.user_id,
            event_id: event.id,
            type: "event_reminder_24h",
            title: "Event Tomorrow",
            message: `"${event.title}" starts in about 24 hours.`,
          });

          // null = fresh insert; 23505 = notification already existed (orphaned prior send)
          if (!notifErr || notifErr.code === "23505") {
            // Record the send so re-runs stay silent
            await supabase.from("email_reminder_log").insert({
              user_id: row.user_id,
              event_id: event.id,
              reminder_type: "reminder_24h",
            });
            remindersSent["24h"]++;
          }
        }
      }
    }

    // ── 1-hour reminders ───────────────────────────────────────────────────
    const h1Start = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
    const h1End   = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

    // Step 1: find events in the 1h window
    const { data: events1h } = await supabase
      .from("events")
      .select("id, title, start_date")
      .gte("start_date", h1Start)
      .lte("start_date", h1End);

    if (events1h && events1h.length > 0) {
      const eventIds1h = events1h.map((e) => e.id);

      // Step 2: find users who saved those events
      const { data: saved1h } = await supabase
        .from("saved_events")
        .select("user_id, event_id")
        .in("event_id", eventIds1h);

      if (saved1h && saved1h.length > 0) {
        // Batch-fetch already-logged 1h reminders
        const { data: logged1h } = await supabase
          .from("email_reminder_log")
          .select("user_id, event_id")
          .eq("reminder_type", "reminder_1h")
          .in("event_id", eventIds1h);

        const sent1hSet = new Set(
          (logged1h ?? []).map((r) => `${r.user_id}:${r.event_id}`)
        );

        for (const row of saved1h) {
          const event = events1h.find((e) => e.id === row.event_id);
          if (!event) continue;

          // Skip — already sent during a previous cron run
          if (sent1hSet.has(`${row.user_id}:${event.id}`)) {
            remindersSkipped["1h"]++;
            continue;
          }

          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: row.user_id,
            event_id: event.id,
            type: "event_reminder_1h",
            title: "Event Starting Soon",
            message: `"${event.title}" starts in about 1 hour!`,
          });

          // null = fresh insert; 23505 = notification already existed (orphaned prior send)
          if (!notifErr || notifErr.code === "23505") {
            // Record the send so re-runs stay silent
            await supabase.from("email_reminder_log").insert({
              user_id: row.user_id,
              event_id: event.id,
              reminder_type: "reminder_1h",
            });
            remindersSent["1h"]++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      reminders_sent: remindersSent,
      reminders_skipped: remindersSkipped,
      checked_at: now.toISOString(),
    });
  } catch (err) {
    console.error("[Cron] send-reminders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
