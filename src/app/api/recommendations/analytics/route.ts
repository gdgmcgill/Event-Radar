/**
 * GET /api/recommendations/analytics
 * Admin-only: recommendation quality metrics (CTR, save rate, dismiss rate, avg rank).
 * Uses current user's session; with RLS, returns only that user's feedback.
 * For org-wide metrics, use a Supabase client with service role key.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

type Period = "7d" | "30d";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Restrict to admin when isAdmin(session.user.id) is implemented
    // if (!(await isAdmin(session.user.id))) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "7d") as Period;
    if (period !== "7d" && period !== "30d") {
      return NextResponse.json(
        { error: "Invalid period. Use 7d or 30d" },
        { status: 400 }
      );
    }

    const days = period === "7d" ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const { data: rawRows, error } = await supabase
      .from("recommendation_feedback")
      .select("action, recommendation_rank, created_at")
      .gte("created_at", sinceIso);

    if (error) {
      console.error("Analytics query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch analytics", detail: error.message },
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
    const { data: recentEvents } = await supabase
      .from("recommendation_feedback")
      .select("event_id")
      .gte("created_at", sinceIso)
      .eq("action", "impression");

    const eventIds = [...new Set((recentEvents ?? []).map((r: { event_id: string }) => r.event_id))];

    let tagDistribution: Record<string, number> = {};
    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from("events")
        .select("tags")
        .in("id", eventIds);

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
    console.error("Recommendation analytics error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
