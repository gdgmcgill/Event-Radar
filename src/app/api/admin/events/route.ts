import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";
import { parseBody, readQuery } from "@/server/body";
import { AdminEventCreateBody, AdminEventsQuery } from "@/contracts/admin";
import { computeEventContentHash } from "@/lib/contentHash";
import { logRouteError, withRoute } from "@/server/route";
import { log } from "@/server/log";

type MetricsSortField = "popularity_score" | "trending_score" | "view_count" | "click_count" | "save_count";
const METRICS_SORT_FIELDS = new Set<string>(["popularity_score", "trending_score", "view_count", "click_count", "save_count"]);

interface PopularityScores {
  event_id: string;
  popularity_score: number;
  trending_score: number;
  view_count: number;
  click_count: number;
  save_count: number;
  calendar_add_count: number;
  unique_viewers: number;
}

export const GET = withRoute({ cache: "private", action: "fetch admin events" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  // Today's defaults and silent coercion (NaN kept), never a 400; deleted
  // events are included for audit only on includeDeleted=true.
  const {
    status,
    search,
    sort: sortBy,
    direction: sortDir,
    limit,
    offset,
    includeDeleted,
  } = readQuery(request.nextUrl.searchParams, AdminEventsQuery);

  const sortByMetric = METRICS_SORT_FIELDS.has(sortBy);

  let query = supabase
    .from("events")
    .select("*", { count: "exact" });

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

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
    logRouteError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const eventIds = (data ?? []).map((e: { id: string }) => e.id);
  const { data: scoresData } = await supabase
    .from("event_popularity_scores")
    .select("*")
    .in("event_id", eventIds);

  const scoresMap = new Map<string, PopularityScores>();
  for (const row of (scoresData ?? []) as PopularityScores[]) {
    scoresMap.set(row.event_id, row);
  }

  let events = (data ?? []).map((event: { id: string }) => {
    const scores = scoresMap.get(event.id) ?? null;
    return {
      ...event,
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
});

export const POST = withRoute({ cache: "private", action: "create event" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const supabase = ctx.supabase;

  // title, description and location arrive sanitized (to prevent XSS), the
  // required rule already applied (src/contracts/admin.ts).
  const parsed = await parseBody(request, AdminEventCreateBody);
  if (!parsed.ok) return parsed.response;
  const {
    title,
    description,
    location,
    start_date,
    end_date,
    organizer,
    tags,
    image_url,
    category,
  } = parsed.data;

  // Compute content hash for duplicate detection
  const contentHash = await computeEventContentHash(title, start_date, organizer || "");

  // Check for duplicate events
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("content_hash", contentHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A similar event already exists with the same title, date, and organizer" },
      { status: 409 }
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
      content_hash: contentHash,
    })
    .select()
    .single();

  if (error) {
    logRouteError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: "created",
      targetType: "event",
      targetId: data.id,
      metadata: { title },
    });
  } catch (auditErr) {
    log.error("Failed to log audit action", { scope: "Admin", error: auditErr });
  }

  return NextResponse.json({ event: data }, { status: 201 });
});
