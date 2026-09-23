/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { transformEventFromDB } from "@/lib/tagMapping";
import { getESTNowISO } from "@/lib/timezone";
import { ilikeContainsFilter, postgrestQuotedValue } from "@/lib/searchFilter";
import {
  decodeEventCursor,
  encodeEventCursor,
  type EventCursor,
} from "@/lib/eventCursor";

/** Shape of event row from DB */
type EventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  tags: string[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string | null;
  organizer?: string | null;
  club_id?: string;
  club?: Record<string, unknown> | null;
};

/**
 * Every filter the list applies, resolved before any query is built. The main
 * query and, in cursor mode, the total head-count query are both built from
 * this, so the two can never disagree about which events match.
 */
type EventListFilters = {
  requestedIds: string[] | null;
  tags: string[] | null;
  /** The escaped ilike or() used when the fuzzy RPC errors (F-082). */
  searchFallback: string | null;
  fuzzyRankedIds: string[] | null;
  dateFloor: string;
  dateTo: string | null;
  timeFilteredIds: string[] | null;
};

/** The filter methods the list uses, as any PostgREST filter builder has them. */
interface EventListFilterable<Self> {
  eq(column: "status", value: "approved"): Self;
  is(column: "deleted_at", value: null): Self;
  in(column: "id", values: readonly string[]): Self;
  overlaps(column: "tags", value: string[]): Self;
  or(filters: string): Self;
  gte(column: "start_date", value: string): Self;
  lte(column: "start_date", value: string): Self;
}

/**
 * Apply the list's filters, in the order the handler has always applied them.
 * The approved-status and deleted_at filters come first, on every query,
 * including the cursor-mode total (T-04-09-03).
 */
function applyEventListFilters<Q extends EventListFilterable<Q>>(
  query: Q,
  filters: EventListFilters
): Q {
  let q = query.eq("status", "approved").is("deleted_at", null);

  // Filter by IDs (e.g. for recommendation list)
  if (filters.requestedIds) q = q.in("id", filters.requestedIds);

  if (filters.tags) q = q.overlaps("tags", filters.tags);

  if (filters.searchFallback) {
    q = q.or(filters.searchFallback);
  } else if (filters.fuzzyRankedIds) {
    q = q.in("id", filters.fuzzyRankedIds);
  }

  q = q.gte("start_date", filters.dateFloor);
  if (filters.dateTo) q = q.lte("start_date", filters.dateTo);

  if (filters.timeFilteredIds) q = q.in("id", filters.timeFilteredIds);

  return q;
}

/**
 * The keyset condition "after this cursor" in `(start_date, id)` ascending
 * order, as a PostgREST or() logic tree. Both values are double-quoted by
 * `postgrestQuotedValue`, so neither can leave its value position, whatever
 * the decoder let through (T-04-09-01). PostgREST ANDs this or() with the
 * search fallback's or(): repeated `or` parameters are conjunctive.
 */
function keysetAfter(cursor: EventCursor): string {
  const at = postgrestQuotedValue(cursor.sortValue);
  const id = postgrestQuotedValue(cursor.id);
  return `start_date.gt.${at},and(start_date.eq.${at},id.gt.${id})`;
}

/** The cursor naming a returned row's position, or null if it has no start_date. */
function cursorFor(row: EventRow | undefined): string | null {
  if (!row || typeof row.start_date !== "string" || !row.start_date) return null;
  return encodeEventCursor({ sortValue: row.start_date, id: row.id });
}

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
 *      - name: timeOfDay
 *        description: Filter by time of day (morning 6-12, afternoon 12-17, evening 17-22, night 22-6)
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *          enum: [morning, afternoon, evening, night]
 *      - name: dayType
 *        description: Filter by day type
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *          enum: [weekday, weekend]
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
 *      - name: cursor
 *        description: Opaque keyset cursor from a previous response's nextCursor; returns the events after it in (start_date, id) order. Takes precedence over page.
 *        in: query
 *        required: false
 *        schema:
 *          type: string
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
 *                      start_date:
 *                        type: string
 *                      end_date:
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
 *                nextCursor:
 *                  type: string
 *                  nullable: true
 *                  description: Cursor for the events after this page; null when there are none
 *                prevCursor:
 *                  type: string
 *                  nullable: true
 *                  description: Cursor naming this page's first event (cursor requests only)
 *        description: Events fetched successfully
 *      400:
 *        description: Invalid timeOfDay, dayType or cursor
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
    const idsParam = searchParams.get('ids');
    const timeOfDay = searchParams.get('timeOfDay');
    const dayType = searchParams.get('dayType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate timeOfDay and dayType values
    const validTimeOfDay = ['morning', 'afternoon', 'evening', 'night'];
    const validDayType = ['weekday', 'weekend'];

    if (timeOfDay && !validTimeOfDay.includes(timeOfDay)) {
      return NextResponse.json(
        { error: `Invalid timeOfDay value. Must be one of: ${validTimeOfDay.join(', ')}` },
        { status: 400 }
      );
    }

    if (dayType && !validDayType.includes(dayType)) {
      return NextResponse.json(
        { error: `Invalid dayType value. Must be one of: ${validDayType.join(', ')}` },
        { status: 400 }
      );
    }

    // Keyset cursor (F-083, DEC-25). Rejected before any query is issued.
    // An empty `cursor=` is treated as absent, as useEvents never sends one.
    // `sort`, `direction`, `clubId` and `before` are deliberately not read:
    // the only caller sends start_date/asc and no clubId (DEC-25).
    const cursorParam = searchParams.get('cursor');
    let cursor: EventCursor | null = null;
    if (cursorParam) {
      cursor = decodeEventCursor(cursorParam);
      if (!cursor) {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
      }
    }

    // Build Supabase query for events, in (start_date, id) order: id breaks
    // ties between equal start dates, so a keyset never skips or repeats.
    let eventsQuery = supabase
      .from('events')
      .select('*, club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at)', { count: 'exact' })
      .order('start_date', { ascending: true })
      .order('id', { ascending: true });

    let requestedIds: string[] | null = null;
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        requestedIds = ids;
      }
    }

    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : null;

    // Fuzzy search: use pg_trgm RPC to get ranked event IDs, then filter
    let fuzzyRankedIds: string[] | null = null;
    let searchFallback: string | null = null;
    if (search) {
      const { data: searchResults, error: searchError } = await supabase.rpc(
        'search_events_fuzzy',
        { search_term: search, result_limit: limit }
      );

      if (searchError) {
        console.error('Fuzzy search RPC error:', searchError);
        // Fallback to basic ILIKE search if RPC fails. The term is escaped for
        // LIKE and double-quoted for PostgREST (F-082, see searchFilter.ts).
        searchFallback = [
          ilikeContainsFilter('title', search),
          ilikeContainsFilter('description', search),
        ].join(',');
      } else if (searchResults && (searchResults as { event_id: string }[]).length > 0) {
        fuzzyRankedIds = (searchResults as { event_id: string; rank: number }[]).map(
          (r) => r.event_id
        );
      } else {
        // No fuzzy matches — return empty result
        return NextResponse.json({
          events: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          nextCursor: null,
          prevCursor: null,
        });
      }
    }

    // Default to upcoming events unless an explicit dateFrom is provided
    const dateFloor = dateFrom || getESTNowISO();

    // Time-based filtering (requires RPC since Supabase JS can't do EXTRACT)
    let timeFilteredIds: string[] | null = null;
    if (timeOfDay || dayType) {
      // `searchParams.get()` yields `string | null`; the RPC's two arguments are
      // both optional `text DEFAULT NULL`. Omitting an argument and passing SQL
      // NULL select the same branch of the function body
      // (`time_of_day IS NULL OR …`), so `?? undefined` preserves the query
      // exactly while telling the truth about the argument type.
      const { data: timeFilteredRows } = await supabase.rpc('get_event_ids_by_time_filter', {
        time_of_day: timeOfDay ?? undefined,
        day_type: dayType ?? undefined,
      });

      if (timeFilteredRows && timeFilteredRows.length > 0) {
        timeFilteredIds = timeFilteredRows.map((r: { event_id: string }) => r.event_id);
      } else {
        return NextResponse.json({
          events: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          nextCursor: null,
          prevCursor: null,
        });
      }
    }

    const filters: EventListFilters = {
      requestedIds,
      tags: tagArray,
      searchFallback,
      fuzzyRankedIds,
      dateFloor,
      dateTo,
      timeFilteredIds,
    };
    eventsQuery = applyEventListFilters(eventsQuery, filters);

    // A rank-ordered (fuzzy) list has no (start_date, id) position, so it is
    // paged by page/limit only and emits no cursors (DEC-25; dead today, F-078).
    const keyset = cursor && !fuzzyRankedIds ? cursor : null;

    // Cursor mode: the rows after the cursor, first `limit` of them, plus a
    // separate head count with every filter except the keyset, so `total`
    // stays the count of all matching events. Page mode: the OFFSET window.
    let totalQuery = null;
    if (keyset) {
      eventsQuery = eventsQuery.or(keysetAfter(keyset)).range(0, limit - 1);
      totalQuery = applyEventListFilters(
        supabase.from('events').select('id', { count: 'exact', head: true }),
        filters
      );
    } else {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      eventsQuery = eventsQuery.range(from, to);
    }

    // Execute events query (and, in cursor mode, the total count)
    const [eventsResult, totalResult] = await Promise.all([eventsQuery, totalQuery]);
    const { data: eventsData, error: eventsError, count } = eventsResult;
    const total = keyset ? totalResult?.count || 0 : count || 0;

    if (eventsError) {
      // Handle range errors gracefully (e.g., page beyond available data)
      const errorCode = (eventsError as { code?: string }).code;
      const errorMessage = eventsError.message;

      // Check for known benign error codes or malformed responses
      const isBenignError =
        errorCode === 'PGRST103' ||
        errorCode === 'PGRST116' ||
        (typeof errorMessage === 'string' && errorMessage.startsWith('{'));

      if (isBenignError) {
        // Range not satisfiable, no rows, or malformed response - return empty result
        return NextResponse.json({
          events: [],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          nextCursor: null,
          prevCursor: null,
        });
      }

      console.error("Supabase error fetching events:", JSON.stringify(eventsError));
      const safeMessage = typeof errorMessage === 'string' && !errorMessage.startsWith('{')
        ? errorMessage
        : 'Failed to fetch events';
      return NextResponse.json({ error: safeMessage }, { status: 500 });
    }

    if (totalResult?.error) {
      console.error("Supabase error counting events:", JSON.stringify(totalResult.error));
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Transform events to match frontend expectations
    let rows = (eventsData || []) as EventRow[];

    // Cursors name positions in (start_date, id) order, so they are taken
    // from the rows as the database ordered them. In cursor mode `count` is
    // the number of rows after the cursor, so more remain when it exceeds
    // what came back; in page mode, when this window ends before `total`.
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;
    if (!fuzzyRankedIds && rows.length > 0) {
      const last = rows[rows.length - 1];
      if (keyset) {
        if ((count || 0) > rows.length) nextCursor = cursorFor(last);
        prevCursor = cursorFor(rows[0]);
      } else if ((page - 1) * limit + rows.length < total) {
        nextCursor = cursorFor(last);
      }
    }

    // Re-sort by fuzzy rank order when fuzzy search was used
    if (fuzzyRankedIds) {
      const orderMap = new Map(fuzzyRankedIds.map((id, idx) => [id, idx]));
      rows = rows.slice().sort((a, b) => {
        const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIdx - bIdx;
      });
    }

    const events = rows.map((event) =>
      transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
    );

    return NextResponse.json(
      {
        events,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        nextCursor,
        prevCursor,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
