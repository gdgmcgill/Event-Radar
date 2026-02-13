/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { EventTag } from "@/types";
import type { Database } from "@/lib/supabase/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build Supabase query for approved events only
    let eventsQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
      .order('start_date', { ascending: true });

    // Apply filters
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      eventsQuery = eventsQuery.overlaps('tags', tagArray);
    }

    if (search) {
      eventsQuery = eventsQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (dateFrom) {
      eventsQuery = eventsQuery.gte('start_date', dateFrom);
    }

    if (dateTo) {
      eventsQuery = eventsQuery.lte('start_date', dateTo);
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

    // Transform events to match frontend Event type
    const events = ((eventsData || []) as EventRow[]).map(event => {
      const startDate = new Date(event.start_date);

      // Map database tags to EventTag enum values
      const mappedTags = (event.tags || []).map((tag: string) => {
        const lowerTag = tag.toLowerCase();
        return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
      }).filter((tag: EventTag, index: number, self: EventTag[]) => self.indexOf(tag) === index); // Remove duplicates

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: startDate.toISOString().split('T')[0], // YYYY-MM-DD
        event_time: startDate.toTimeString().slice(0, 5), // HH:MM
        location: event.location,
        club_id: event.organizer || 'unknown',
        tags: mappedTags,
        image_url: event.image_url,
        created_at: event.created_at,
        updated_at: event.updated_at,
        status: event.status,
        approved_by: null,
        approved_at: null,
        club: event.organizer ? {
          id: event.organizer,
          name: event.organizer,
          instagram_handle: null,
          logo_url: null,
          description: null,
          created_at: event.created_at,
          updated_at: event.updated_at,
        } : null,
        saved_by_users: []
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
