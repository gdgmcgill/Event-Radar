/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { EventTag } from "@/types";

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

    // Build Supabase query for events
    let eventsQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
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

    // Transform events to match frontend expectations
    const events = (eventsData || []).map(event => {
      const startDate = new Date(event.start_date);
      const endDate = event.end_date ? new Date(event.end_date) : null;
      
      // Map database tags to EventTag enum values
      const mappedTags = (event.tags || []).map((tag: string) => {
        const lowerTag = tag.toLowerCase();
        return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
      }).filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
      
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
        status: 'approved', // Default since column doesn't exist
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
