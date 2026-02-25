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
  let remindersSent = { "24h": 0, "1h": 0 };

  try {
    // 24-hour reminders: events starting between now+23h and now+25h
    const h24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const h24End = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: saved24h } = await supabase
      .from("saved_events")
      .select("user_id, event_id, events:event_id(id, title, start_date)")
      .gte("events.start_date", h24Start)
      .lte("events.start_date", h24End);

    if (saved24h) {
      for (const row of saved24h) {
        const event = row.events as unknown as { id: string; title: string; start_date: string } | null;
        if (!event) continue;

        const { error: err24h } = await supabase.from("notifications").upsert(
          {
            user_id: row.user_id,
            event_id: event.id,
            type: "event_reminder_24h",
            title: "Event Tomorrow",
            message: `"${event.title}" starts in about 24 hours.`,
          },
          { onConflict: "user_id,event_id,type", ignoreDuplicates: true }
        );
        if (!err24h) remindersSent["24h"]++;
      }
    }

    // 1-hour reminders: events starting between now+55min and now+65min
    const h1Start = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
    const h1End = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

    const { data: saved1h } = await supabase
      .from("saved_events")
      .select("user_id, event_id, events:event_id(id, title, start_date)")
      .gte("events.start_date", h1Start)
      .lte("events.start_date", h1End);

    if (saved1h) {
      for (const row of saved1h) {
        const event = row.events as unknown as { id: string; title: string; start_date: string } | null;
        if (!event) continue;

        const { error: err1h } = await supabase.from("notifications").upsert(
          {
            user_id: row.user_id,
            event_id: event.id,
            type: "event_reminder_1h",
            title: "Event Starting Soon",
            message: `"${event.title}" starts in about 1 hour!`,
          },
          { onConflict: "user_id,event_id,type", ignoreDuplicates: true }
        );
        if (!err1h) remindersSent["1h"]++;
      }
    }

    return NextResponse.json({
      success: true,
      reminders_sent: remindersSent,
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
