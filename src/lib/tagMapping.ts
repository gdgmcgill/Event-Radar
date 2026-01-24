/**
 * Shared tag mapping utilities for transforming database events to frontend format
 */

import { EventTag, Event, Club } from "@/types";

/**
 * Mapping from database tags (lowercase) to EventTag enum values
 */
export const tagMapping: Record<string, EventTag> = {
  // Direct mappings
  academic: EventTag.ACADEMIC,
  social: EventTag.SOCIAL,
  sports: EventTag.SPORTS,
  career: EventTag.CAREER,
  cultural: EventTag.CULTURAL,
  wellness: EventTag.WELLNESS,
  // Alias mappings
  coding: EventTag.ACADEMIC,
  technology: EventTag.ACADEMIC,
  hackathon: EventTag.ACADEMIC,
  workshop: EventTag.ACADEMIC,
  networking: EventTag.SOCIAL,
  party: EventTag.SOCIAL,
  fitness: EventTag.WELLNESS,
  health: EventTag.WELLNESS,
  art: EventTag.CULTURAL,
  music: EventTag.CULTURAL,
  dance: EventTag.CULTURAL,
  professional: EventTag.CAREER,
  internship: EventTag.CAREER,
  job: EventTag.CAREER,
  game: EventTag.SPORTS,
  competition: EventTag.SPORTS,
};

/**
 * Map an array of database tags to EventTag enum values
 * @param dbTags - Array of tag strings from database
 * @returns Array of unique EventTag values
 */
export function mapTags(dbTags: string[]): EventTag[] {
  const mappedTags = (dbTags || []).map((tag: string) => {
    const lowerTag = tag.toLowerCase().trim();
    return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
  });

  // Remove duplicates
  return [...new Set(mappedTags)];
}

/**
 * Database event row type (matches what Supabase returns)
 */
interface DBEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date?: string | null;
  location: string;
  club_id?: string | null;
  organizer?: string; // Legacy field
  tags: string[];
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  club?: DBClub | null;
}

interface DBClub {
  id: string;
  name: string;
  instagram_handle?: string | null;
  logo_url?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Transform a database event to the frontend Event type
 * Converts start_date (TIMESTAMPTZ) to separate event_date and event_time for frontend
 * @param dbEvent - Event row from database
 * @returns Transformed Event object
 */
export function transformEventFromDB(dbEvent: DBEvent): Event {
  const startDate = new Date(dbEvent.start_date);

  // Build club object from relation or legacy organizer field
  let club: Club | undefined = undefined;
  if (dbEvent.club) {
    club = {
      id: dbEvent.club.id,
      name: dbEvent.club.name,
      instagram_handle: dbEvent.club.instagram_handle || null,
      logo_url: dbEvent.club.logo_url || null,
      description: dbEvent.club.description || null,
      created_at: dbEvent.club.created_at,
      updated_at: dbEvent.club.updated_at,
    };
  } else if (dbEvent.organizer) {
    // Legacy support: create minimal club from organizer string
    club = {
      id: dbEvent.organizer,
      name: dbEvent.organizer,
      instagram_handle: null,
      logo_url: null,
      description: null,
      created_at: dbEvent.created_at,
      updated_at: dbEvent.updated_at,
    };
  }

  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    event_date: startDate.toISOString().split("T")[0], // YYYY-MM-DD
    event_time: startDate.toTimeString().slice(0, 5), // HH:MM
    location: dbEvent.location,
    club_id: dbEvent.club_id || dbEvent.organizer || "unknown",
    tags: mapTags(dbEvent.tags),
    image_url: dbEvent.image_url || null,
    created_at: dbEvent.created_at,
    updated_at: dbEvent.updated_at,
    status: (dbEvent.status as "pending" | "approved" | "rejected") || "approved",
    approved_by: dbEvent.approved_by || null,
    approved_at: dbEvent.approved_at || null,
    club,
    saved_by_users: [],
  };
}
