/**
 * GET /api/events
 * Fetch events with optional filters
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { EventTag } from "@/types";

const SAMPLE_EVENTS = [
  {
    id: "evt-acad-1",
    title: "AI Research Colloquium",
    description: "Talks and posters on the latest ML research from campus labs.",
    event_date: "2025-12-05",
    event_time: "17:00",
    location: "Engineering Hall 201",
    club_id: "cs-society",
    tags: [EventTag.ACADEMIC],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "cs-society",
      name: "CS Society",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
  {
    id: "evt-social-1",
    title: "Campus Mixer Night",
    description: "Meet students across faculties with music and snacks.",
    event_date: "2025-12-06",
    event_time: "19:30",
    location: "Student Center Atrium",
    club_id: "student-union",
    tags: [EventTag.SOCIAL],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "student-union",
      name: "Student Union",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
  {
    id: "evt-sport-1",
    title: "Intramural Soccer Finals",
    description: "Championship match under the lights.",
    event_date: "2025-12-08",
    event_time: "20:00",
    location: "North Field",
    club_id: "athletics",
    tags: [EventTag.SPORTS],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "athletics",
      name: "Athletics",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
  {
    id: "evt-career-1",
    title: "Tech Careers Fair",
    description: "Meet recruiters from startups and FAANG.",
    event_date: "2025-12-10",
    event_time: "13:00",
    location: "Main Hall",
    club_id: "career-center",
    tags: [EventTag.CAREER],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "career-center",
      name: "Career Center",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
  {
    id: "evt-cultural-1",
    title: "Global Cultures Showcase",
    description: "Food, dance, and music from student cultural clubs.",
    event_date: "2025-12-12",
    event_time: "18:00",
    location: "Quad",
    club_id: "international-club",
    tags: [EventTag.CULTURAL],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "international-club",
      name: "International Club",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
  {
    id: "evt-wellness-1",
    title: "Mindfulness & Yoga",
    description: "Guided session to de-stress during finals.",
    event_date: "2025-12-13",
    event_time: "09:00",
    location: "Wellness Center Studio",
    club_id: "wellness-club",
    tags: [EventTag.WELLNESS, EventTag.ACADEMIC],
    image_url: null,
    created_at: "2025-11-30T00:00:00.000Z",
    updated_at: "2025-11-30T00:00:00.000Z",
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "wellness-club",
      name: "Wellness Club",
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-11-30T00:00:00.000Z",
    },
    saved_by_users: [],
  },
];

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
    // Temporary: return sample events to drive UI with category tags
    return NextResponse.json({
      events: SAMPLE_EVENTS,
      total: SAMPLE_EVENTS.length,
      page: 1,
      limit: SAMPLE_EVENTS.length,
      totalPages: 1,
    });

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
