/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { EventTag } from "@/types";

/** Shape of event row from DB (may use start_date/end_date/organizer or event_date/event_time/club_id) */
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
  event_date?: string;
  event_time?: string;
  club_id?: string;
};

// Mapping from database tags to EventTag enum
const tagMapping: Record<string, EventTag> = {
  'coding': EventTag.ACADEMIC,
  'networking': EventTag.SOCIAL,
  'hackathon': EventTag.ACADEMIC,
  'career': EventTag.CAREER,
  'sports': EventTag.SPORTS,
  'wellness': EventTag.WELLNESS,
  'cultural': EventTag.CULTURAL,
  'social': EventTag.SOCIAL,
  'academic': EventTag.ACADEMIC,
  'technology': EventTag.ACADEMIC,
};

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

    // Build Supabase query for events — exclude archived events from browse/search
    let eventsQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .neq('status', 'archived' as never)
      .order('start_date', { ascending: true });

    // Filter by IDs (e.g. for recommendation list)
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        eventsQuery = eventsQuery.in('id', ids);
      }
    }

    // Apply filters
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      eventsQuery = eventsQuery.overlaps('tags', tagArray);
    }

    // Fuzzy search: use pg_trgm RPC to get ranked event IDs, then filter
    let fuzzyRankedIds: string[] | null = null;
    if (search) {
      const { data: searchResults, error: searchError } = await (supabase as any).rpc(
        'search_events_fuzzy',
        { search_term: search, result_limit: limit }
      );

      if (searchError) {
        console.error('Fuzzy search RPC error:', searchError);
        // Fallback to basic ILIKE search if RPC fails
        eventsQuery = eventsQuery.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      } else if (searchResults && (searchResults as { event_id: string }[]).length > 0) {
        fuzzyRankedIds = (searchResults as { event_id: string; rank: number }[]).map(
          (r) => r.event_id
        );
        eventsQuery = eventsQuery.in('id', fuzzyRankedIds);
      } else {
        // No fuzzy matches — return empty result
        return NextResponse.json({
          events: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }
    }

    if (dateFrom) {
      eventsQuery = eventsQuery.gte('start_date', dateFrom);
    }

    if (dateTo) {
      eventsQuery = eventsQuery.lte('start_date', dateTo);
    }

    // Time-based filtering (requires RPC since Supabase JS can't do EXTRACT)
    if (timeOfDay || dayType) {
      const { data: timeFilteredIds } = await (supabase as any).rpc('get_event_ids_by_time_filter', {
        time_of_day: timeOfDay,
        day_type: dayType,
      });

      if (timeFilteredIds && timeFilteredIds.length > 0) {
        const ids = timeFilteredIds.map((r: { event_id: string }) => r.event_id);
        eventsQuery = eventsQuery.in('id', ids);
      } else {
        return NextResponse.json({ events: [], total: 0, page, limit, totalPages: 0 });
      }
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    eventsQuery = eventsQuery.range(from, to);

    // Execute events query
    const { data: eventsData, error: eventsError, count } = await eventsQuery;

    if (eventsError) {
      console.error("Supabase error fetching events:", eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // Transform events to match frontend expectations
    let rows = (eventsData || []) as EventRow[];

    // Re-sort by fuzzy rank order when fuzzy search was used
    if (fuzzyRankedIds) {
      const orderMap = new Map(fuzzyRankedIds.map((id, idx) => [id, idx]));
      rows = rows.slice().sort((a, b) => {
        const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIdx - bIdx;
      });
    }

    const events = rows.map((event) => {
      const startDateStr = event.start_date ?? event.event_date;
      const startDate = new Date(startDateStr ?? "");
      const endDate = event.end_date ? new Date(event.end_date) : null;

      // Map database tags to EventTag enum values
      const mappedTags = (event.tags || [])
        .map((tag: string) => {
          const lowerTag = tag.toLowerCase();
          return tagMapping[lowerTag] || EventTag.SOCIAL;
        })
        .filter((tag, index, self) => self.indexOf(tag) === index);

      const clubId = event.organizer ?? event.club_id ?? "unknown";

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: startDate.toISOString().split("T")[0],
        event_time: startDateStr ? startDate.toTimeString().slice(0, 5) : (event.event_time ?? "00:00"),
        location: event.location,
        club_id: clubId,
        tags: mappedTags,
        image_url: event.image_url,
        created_at: event.created_at,
        updated_at: event.updated_at,
        status: "approved" as const,
        approved_by: null,
        approved_at: null,
        club: clubId !== "unknown" ? {
          id: clubId,
          name: typeof event.organizer === "string" ? event.organizer : clubId,
          instagram_handle: null,
          logo_url: null,
          description: null,
          created_at: event.created_at,
          updated_at: event.updated_at,
        } : null,
        saved_by_users: [],
      };
    });

    return NextResponse.json({ 
      events, 
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
