/**
 * GET /api/recommendations/analytics
 * Admin-only: recommendation quality metrics (CTR, save rate, dismiss rate, avg rank).
 * Reads aggregate feedback across participants after active-admin authorization.
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { parseQuery } from "@/server/body";
import { AnalyticsQuery } from "@/contracts/recommendations";
import type { NextRequest } from "next/server";
import { withRoute } from "@/server/route";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch analytics" }, async (request: NextRequest) => {
  try {
    const ctx = await createRequestContext();
    const activeUser = requireActiveUser(ctx);
    if (!activeUser.ok) return activeUser.response;
    const auth = requireRole(ctx, "admin");
    if (!auth.ok) return auth.response;
    const supabase = ctx.supabase;

    // `period` defaults to 7d; anything but 7d or 30d is today's 400.
    const query = parseQuery(request.nextUrl.searchParams, AnalyticsQuery);
    if (!query.ok) return query.response;
    const { period } = query.data;

    const days = period === "7d" ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    // Feedback RLS permits only own-row SELECT; admin metrics need all users.
    const elevated = getElevatedClient();
    const { data: rawRows, error } = await elevated
      .from("recommendation_feedback")
      .select("action, recommendation_rank, created_at")
      .gte("created_at", sinceIso);

    if (error) {
      log.error("Analytics query error", { error });
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    type Row = { action: string; recommendation_rank: number; created_at: string };
    const list: Row[] = (rawRows ?? []) as Row[];
    const impressions = list.filter((r: Row) => r.action === "impression");
    const clicks = list.filter((r: Row) => r.action === "click");
    const saves = list.filter((r: Row) => r.action === "save");
    const dismisses = list.filter((r: Row) => r.action === "dismiss");

    const impressionCount = impressions.length;
    const clickCount = clicks.length;
    const saveCount = saves.length;
    const dismissCount = dismisses.length;

    const ctr =
      impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0;
    const saveRate =
      impressionCount > 0 ? (saveCount / impressionCount) * 100 : 0;
    const dismissRate =
      impressionCount > 0 ? (dismissCount / impressionCount) * 100 : 0;

    const clickedRanks = clicks.map((r: Row) => r.recommendation_rank);
    const avgRankOfClicked =
      clickedRanks.length > 0
        ? clickedRanks.reduce((a: number, b: number) => a + b, 0) /
          clickedRanks.length
        : null;

    // Tag distribution from recent recommendation feedback
    const { data: recentEvents, error: recentError } = await elevated
      .from("recommendation_feedback")
      .select("event_id")
      .gte("created_at", sinceIso)
      .eq("action", "impression");

    if (recentError) throw recentError;

    const eventIds = [...new Set((recentEvents ?? []).map((r: { event_id: string }) => r.event_id))];

    let tagDistribution: Record<string, number> = {};
    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("tags")
        .in("id", eventIds);

      if (eventsError) throw eventsError;

      for (const ev of (events ?? []) as { tags: string[] }[]) {
        for (const tag of ev.tags ?? []) {
          const key = tag.toLowerCase();
          tagDistribution[key] = (tagDistribution[key] || 0) + 1;
        }
      }
    }

    return NextResponse.json({
      period,
      since: sinceIso,
      metrics: {
        impressions: impressionCount,
        clicks: clickCount,
        saves: saveCount,
        dismisses: dismissCount,
        ctr_percent: Math.round(ctr * 100) / 100,
        save_rate_percent: Math.round(saveRate * 100) / 100,
        dismiss_rate_percent: Math.round(dismissRate * 100) / 100,
        avg_rank_of_clicked: avgRankOfClicked,
      },
      diversity: {
        recommended_tag_distribution: tagDistribution,
        unique_tags_shown: Object.keys(tagDistribution).length,
      },
    });
  } catch (error) {
    log.error("Recommendation analytics error", { error });
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
});
