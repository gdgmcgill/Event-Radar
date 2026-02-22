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

    // Transform events using shared utility
    const events = ((eventsData || []) as EventRow[]).map(event =>
      transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
    );

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
