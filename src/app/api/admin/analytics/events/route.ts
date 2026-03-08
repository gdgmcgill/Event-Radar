import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [recentEvents, topEvents, allApproved] = await Promise.all([
    supabase
      .from("events")
      .select("created_at, tags, status")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("event_popularity_scores")
      .select("event_id, popularity_score, view_count, save_count, click_count")
      .order("popularity_score", { ascending: false })
      .limit(10),
    supabase
      .from("events")
      .select("id, title, start_date, tags, image_url")
      .eq("status", "approved"),
  ]);

  // Daily event creation (last 30 days)
  const dailyCreation = buildDailyCounts(
    (recentEvents.data ?? []).map((e) => e.created_at),
    thirtyDaysAgo,
    now
  );

  // Category distribution across all approved events
  const tagCounts: Record<string, number> = {};
  for (const event of allApproved.data ?? []) {
    const tags = event.tags as string[] | null;
    if (tags) {
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }
  const categoryDistribution = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  // Status breakdown of last 30 days
  const statusCounts: Record<string, number> = { approved: 0, pending: 0, rejected: 0 };
  for (const event of recentEvents.data ?? []) {
    const status = event.status as string;
    if (status in statusCounts) statusCounts[status]++;
  }

  // Top events with titles
  const topEventIds = (topEvents.data ?? []).map((e) => e.event_id);
  const eventTitleMap = new Map<string, { title: string; tags: string[] | null }>();
  if (topEventIds.length > 0) {
    const { data: titleData } = await supabase
      .from("events")
      .select("id, title, tags")
      .in("id", topEventIds);
    for (const e of titleData ?? []) {
      eventTitleMap.set(e.id, { title: e.title, tags: e.tags });
    }
  }

  const topPerformers = (topEvents.data ?? []).map((score) => ({
    event_id: score.event_id,
    title: eventTitleMap.get(score.event_id)?.title ?? "Unknown",
    tags: eventTitleMap.get(score.event_id)?.tags ?? [],
    popularity_score: score.popularity_score,
    view_count: score.view_count,
    save_count: score.save_count,
    click_count: score.click_count,
  }));

  return NextResponse.json({
    dailyCreation,
    categoryDistribution,
    statusBreakdown: statusCounts,
    topPerformers,
    totalApproved: allApproved.data?.length ?? 0,
  });
}

function buildDailyCounts(timestamps: string[], from: Date, to: Date) {
  const counts: Record<string, number> = {};
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    counts[current.toISOString().split("T")[0]] = 0;
    current.setDate(current.getDate() + 1);
  }

  for (const ts of timestamps) {
    const date = ts.split("T")[0];
    if (date in counts) counts[date]++;
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}
