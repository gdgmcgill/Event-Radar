import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format, eachDayOfInterval, subDays, parseISO } from "date-fns";
import type { EventAnalytics } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]/analytics
 * Returns club-level analytics: follower growth, total attendees, popular tags, per-event metrics.
 * Requires authentication and club membership.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization: verify user is a club member
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a club member to view analytics" },
        { status: 403 }
      );
    }

    // ── Follower Growth (last 30 days, cumulative) ─────────────────────────
    const thirtyDaysAgo = subDays(new Date(), 30);
    const { data: followers } = await supabase
      .from("club_followers")
      .select("created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    const followerList = followers ?? [];

    let followerGrowth: { date: string; count: number }[] = [];

    if (followerList.length > 0) {
      const days = eachDayOfInterval({
        start: thirtyDaysAgo,
        end: new Date(),
      });

      // Count cumulative followers per day
      let cumulative = 0;
      // Count followers before the 30-day window
      for (const f of followerList) {
        if (parseISO(f.created_at) < thirtyDaysAgo) {
          cumulative++;
        }
      }

      followerGrowth = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        // Add followers that joined on this day
        for (const f of followerList) {
          const fDay = format(parseISO(f.created_at), "yyyy-MM-dd");
          if (fDay === dayStr) {
            cumulative++;
          }
        }
        return {
          date: format(day, "MMM d"),
          count: cumulative,
        };
      });
    }

    // ── Club Events ────────────────────────────────────────────────────────
    const { data: events } = await supabase
      .from("events")
      .select("id, title, event_date, tags")
      .eq("club_id", clubId)
      .order("event_date", { ascending: false });

    const eventList = events ?? [];
    const eventIds = eventList.map((e: { id: string }) => e.id);

    // ── Total Attendees (rsvp status = going across all club events) ──────
    let totalAttendees = 0;
    let rsvpList: { event_id: string; status: string }[] = [];

    if (eventIds.length > 0) {
      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("event_id, status")
        .in("event_id", eventIds)
        .eq("status", "going");

      rsvpList = (rsvps ?? []) as { event_id: string; status: string }[];
      totalAttendees = rsvpList.length;
    }

    // ── Popular Tags ───────────────────────────────────────────────────────
    const tagCounts = new Map<string, number>();
    for (const event of eventList) {
      const tags = (event as { tags: string[] | null }).tags ?? [];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Per-Event Analytics (bulk queries) ─────────────────────────────────
    let popularityMap = new Map<
      string,
      { view_count: number; click_count: number; save_count: number; unique_viewers: number }
    >();
    let savedMap = new Map<string, number>();

    if (eventIds.length > 0) {
      // Bulk fetch popularity scores
      const { data: scores } = await supabase
        .from("event_popularity_scores")
        .select("event_id, view_count, click_count, save_count, unique_viewers")
        .in("event_id", eventIds);

      for (const s of scores ?? []) {
        const score = s as {
          event_id: string;
          view_count: number;
          click_count: number;
          save_count: number;
          unique_viewers: number;
        };
        popularityMap.set(score.event_id, score);
      }

      // Bulk fetch saved_events counts
      const { data: saved } = await supabase
        .from("saved_events")
        .select("event_id")
        .in("event_id", eventIds);

      for (const s of saved ?? []) {
        const sv = s as { event_id: string };
        savedMap.set(sv.event_id, (savedMap.get(sv.event_id) ?? 0) + 1);
      }
    }

    // Also fetch all rsvps (not just going) for per-event breakdown
    let allRsvps: { event_id: string; status: string }[] = [];
    if (eventIds.length > 0) {
      const { data: allRsvpData } = await supabase
        .from("rsvps")
        .select("event_id, status")
        .in("event_id", eventIds);

      allRsvps = (allRsvpData ?? []) as { event_id: string; status: string }[];
    }

    const eventsAnalytics: EventAnalytics[] = eventList.map(
      (event: { id: string; title: string; event_date: string }) => {
        const pop = popularityMap.get(event.id);
        const eventRsvps = allRsvps.filter((r) => r.event_id === event.id);
        return {
          event_id: event.id,
          title: event.title,
          event_date: event.event_date,
          views: pop?.view_count ?? 0,
          clicks: pop?.click_count ?? 0,
          saves: savedMap.get(event.id) ?? 0,
          unique_viewers: pop?.unique_viewers ?? 0,
          rsvp_going: eventRsvps.filter((r) => r.status === "going").length,
          rsvp_interested: eventRsvps.filter((r) => r.status === "interested")
            .length,
          rsvp_cancelled: eventRsvps.filter((r) => r.status === "cancelled")
            .length,
        };
      }
    );

    return NextResponse.json({
      follower_growth: followerGrowth,
      total_attendees: totalAttendees,
      popular_tags: popularTags,
      events: eventsAnalytics,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
