/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { transformEventFromDB } from "@/lib/tagMapping";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

type SortField = "start_date" | "created_at" | "popularity_score" | "trending_score";
type SortDirection = "asc" | "desc";

type CursorPayload = {
  sortValue: string | number;
  id: string;
};

type EventWithPopularity = EventRow & {
  popularity?: Array<{
    popularity_score: number | null;
    trending_score: number | null;
  }>;
};

const SORT_FIELDS = new Set<SortField>([
  "start_date",
  "created_at",
  "popularity_score",
  "trending_score",
]);
const MAX_LIMIT = 100;

const decodeCursor = (cursor: string): CursorPayload | null => {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as CursorPayload;
    if (!payload || typeof payload.id !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

/**
 * @swagger
 * /api/events:
 *   get:
 *    summary: /api/events
 *    description: Fetch events with optional filters
 *    tags:
 *      - Events
 *    parameters:
 *      - name: tags
 *        description: Comma-separated list of tags
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: search
 *        description: Search query
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: dateFrom
 *        description: Start date for filtering
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: dateTo
 *        description: End date for filtering
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: page
 *        description: Page number for pagination
 *        in: query
 *        required: false
 *        schema:
 *          type: integer
 *      - name: limit
 *        description: Number of events per page
 *        in: query
 *        required: false
 *        schema:
 *          type: integer
 *    responses:
 *      200:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                events:
 *                  type: array
 *                  items:
 *                    type: object
 *                    properties:
 *                      id:
 *                        type: string
 *                      title:
 *                        type: string
 *                      description:
 *                        type: string
 *                      event_date:
 *                        type: string
 *                      event_time:
 *                        type: string
 *                      location:
 *                        type: string
 *                      club_id:
 *                        type: string
 *                      tags:
 *                        type: array
 *                        items:
 *                          type: string
 *                      image_url:
 *                        type: string
 *                      created_at:
 *                        type: string
 *                      updated_at:
 *                        type: string
 *                      status:
 *                        type: string
 *                        example: approved
 *                      approved_by:
 *                        type: string
 *                      approved_at:
 *                        type: string
 *                      club:
 *                        type: object
 *                        properties:
 *                          id:
 *                            type: string
 *                          name:
 *                            type: string
 *                          instagram_handle:
 *                            type: string
 *                          logo_url:
 *                            type: string
 *                          description:
 *                            type: string
 *                          created_at:
 *                            type: string
 *                          updated_at:
 *                            type: string
 *                      saved_by_users:
 *                        type: array
 *                total:
 *                  type: integer
 *                page:
 *                  type: integer
 *                limit:
 *                  type: integer
 *                totalPages:
 *                  type: integer
 *        description: Events fetched successfully
 *      500:
 *        description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sortParam = (searchParams.get("sort") || "start_date") as SortField;
    const directionParam = (searchParams.get("direction") || "asc") as SortDirection;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10), 1),
      MAX_LIMIT
    );
    const cursor = searchParams.get("cursor");
    const before = searchParams.get("before");

    if (!SORT_FIELDS.has(sortParam)) {
      return NextResponse.json(
        { error: "sort must be one of: start_date, created_at, popularity_score, trending_score" },
        { status: 400 }
      );
    }

    if (directionParam !== "asc" && directionParam !== "desc") {
      return NextResponse.json(
        { error: "direction must be 'asc' or 'desc'" },
        { status: 400 }
      );
    }

    if (cursor && before) {
      return NextResponse.json(
        { error: "cursor and before cannot be used together" },
        { status: 400 }
      );
    }

    const sort = sortParam;
    const direction = directionParam;
    const cursorToken = before || cursor;
    const cursorPayload = cursorToken ? decodeCursor(cursorToken) : null;
    if (cursorToken && !cursorPayload) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    // Build Supabase query for approved events only
    const isPopularitySort =
      sort === "popularity_score" || sort === "trending_score";
    const selectClause = isPopularitySort
      ? "*, popularity:event_popularity_scores!inner(popularity_score, trending_score)"
      : "*";
    const isAsc = direction === "asc";
    const queryAscending = before ? !isAsc : isAsc;

    let eventsQuery = supabase
      .from("events")
      .select(selectClause, { count: "exact" })
      .eq("status", "approved");

    // Apply filters
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      eventsQuery = eventsQuery.overlaps("tags", tagArray);
    }

    if (search) {
      eventsQuery = eventsQuery.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    if (dateFrom) {
      eventsQuery = eventsQuery.gte("start_date", dateFrom);
    }

    if (dateTo) {
      eventsQuery = eventsQuery.lte("start_date", dateTo);
    }

    if (isPopularitySort) {
      eventsQuery = eventsQuery.order(sort, {
        ascending: queryAscending,
        foreignTable: "event_popularity_scores",
      });
    } else {
      eventsQuery = eventsQuery.order(sort, { ascending: queryAscending });
    }
    eventsQuery = eventsQuery.order("id", { ascending: queryAscending });

    // Apply pagination
    if (cursorPayload) {
      const sortColumn = isPopularitySort
        ? `event_popularity_scores.${sort}`
        : sort;
      const op = queryAscending ? "gt" : "lt";
      const sortValue = cursorPayload.sortValue;
      const orFilter = `${sortColumn}.${op}.${sortValue},and(${sortColumn}.eq.${sortValue},id.${op}.${cursorPayload.id})`;
      eventsQuery = eventsQuery.or(orFilter).limit(limit + 1);
    } else {
      // For first page, still fetch limit + 1 to detect if nextCursor exists
      const from = (page - 1) * limit;
      const to = from + limit; // Note: limit, not limit - 1, so we fetch limit + 1 total
      eventsQuery = eventsQuery.range(from, to);
    }

    // Execute events query
    const { data: eventsData, error: eventsError, count } = await eventsQuery
      .returns<EventWithPopularity[]>();

    if (eventsError) {
      console.error("Supabase error fetching events:", eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // Transform events using shared utility
    let rawEvents = eventsData ?? [];
    const hasExtra = rawEvents.length > limit;
    if (hasExtra) {
      rawEvents = rawEvents.slice(0, limit);
    }
    if (before) {
      rawEvents = rawEvents.reverse();
    }

    const getSortValue = (event: EventWithPopularity): string | number => {
      if (sort === "popularity_score" || sort === "trending_score") {
        const score = event.popularity?.[0]?.[sort];
        return typeof score === "number" ? score : 0;
      }
      return event[sort] ?? "";
    };

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (rawEvents.length > 0) {
      const first = rawEvents[0];
      const last = rawEvents[rawEvents.length - 1];

      const firstCursor = encodeCursor({
        sortValue: getSortValue(first),
        id: first.id,
      });
      const lastCursor = encodeCursor({
        sortValue: getSortValue(last),
        id: last.id,
      });

      if (before) {
        prevCursor = hasExtra ? firstCursor : null;
        nextCursor = lastCursor;
      } else {
        prevCursor = cursorPayload ? firstCursor : null;
        nextCursor = hasExtra ? lastCursor : null;
      }
    }

    const events = rawEvents.map(event =>
      transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json({
      events,
      total: count || 0,
      page: cursorPayload ? undefined : page,
      limit,
      totalPages: cursorPayload ? undefined : Math.ceil((count || 0) / limit),
      nextCursor,
      prevCursor,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
