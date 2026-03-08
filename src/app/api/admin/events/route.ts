import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sanitizeText } from "@/lib/sanitize";

type MetricsSortField = "popularity_score" | "trending_score" | "view_count" | "click_count" | "save_count";
const METRICS_SORT_FIELDS = new Set<string>(["popularity_score", "trending_score", "view_count", "click_count", "save_count"]);

interface PopularityScores {
  popularity_score: number;
  trending_score: number;
  view_count: number;
  click_count: number;
  save_count: number;
  calendar_add_count: number;
  unique_viewers: number;
}

interface EventWithPopularity {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  organizer: string | null;
  tags: string[] | null;
  status: string;
  created_at: string | null;
  event_popularity_scores: PopularityScores[] | null;
}

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sort") || "created_at";
  const sortDir = searchParams.get("direction") || "desc";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const sortByMetric = METRICS_SORT_FIELDS.has(sortBy);

  let query = supabase
    .from("events")
    .select("*, event_popularity_scores(*)", { count: "exact" });

  if (!sortByMetric) {
    query = query.order(sortBy as "created_at", { ascending: sortDir === "asc" });
  }

  query = query.range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let events = ((data ?? []) as unknown as EventWithPopularity[]).map((event) => {
    const scores = event.event_popularity_scores?.[0] ?? null;
    const { event_popularity_scores: _, ...rest } = event;
    return {
      ...rest,
      metrics: scores
        ? {
            popularity_score: scores.popularity_score,
            trending_score: scores.trending_score,
            view_count: scores.view_count,
            click_count: scores.click_count,
            save_count: scores.save_count,
            calendar_add_count: scores.calendar_add_count,
            unique_viewers: scores.unique_viewers,
          }
        : null,
    };
  });

  if (sortByMetric) {
    const field = sortBy as MetricsSortField;
    const asc = sortDir === "asc";
    events.sort((a, b) => {
      const aVal = a.metrics?.[field] ?? -1;
      const bVal = b.metrics?.[field] ?? -1;
      return asc ? aVal - bVal : bVal - aVal;
    });
  }

  return NextResponse.json({ events, total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { start_date, end_date, organizer, tags, image_url, category } = body;

  // Sanitize text inputs to prevent XSS
  const title = sanitizeText(body.title ?? "");
  const description = sanitizeText(body.description ?? "");
  const location = sanitizeText(body.location ?? "");

  if (!title || !start_date || !end_date) {
    return NextResponse.json(
      { error: "title, start_date, and end_date are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      description: description || "",
      start_date,
      end_date,
      location: location || "",
      organizer: organizer || null,
      tags: tags || [],
      image_url: image_url || null,
      category: category || null,
      status: "approved",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}
