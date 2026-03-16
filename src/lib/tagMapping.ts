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
  description: string | null;
  start_date: string;
  end_date?: string | null;
  location: string | null;
  club_id?: string | null;
  organizer?: string | null;
  tags: string[];
  image_url?: string | null;
  category?: string | null;
  source?: string;
  source_url?: string | null;
  content_hash?: string | null;
  rsvp_count?: number | null;
  created_at: string;
  updated_at: string | null;
  status?: string;
  created_by?: string | null;
  deleted_at?: string | null;
  appeal_count?: number;
  club?: DBClub | null;
}

interface DBClub {
  id: string;
  name: string;
  instagram_handle?: string | null;
  logo_url?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Transform a database event to the frontend Event type
 * Passes through start_date/end_date directly (no more event_date/event_time split)
 * @param dbEvent - Event row from database
 * @returns Transformed Event object
 */
export function transformEventFromDB(dbEvent: DBEvent): Event {
  // Build club object from relation or legacy organizer field
  let club: Club | undefined = undefined;
  if (dbEvent.club) {
    club = {
      id: dbEvent.club.id,
      name: dbEvent.club.name,
      instagram_handle: dbEvent.club.instagram_handle || null,
      logo_url: dbEvent.club.logo_url || null,
      banner_url: null,
      description: dbEvent.club.description || null,
      category: dbEvent.club.category ?? null,
      website_url: null,
      discord_url: null,
      twitter_url: null,
      linkedin_url: null,
      contact_email: null,
      status: (dbEvent.club.status ?? "approved") as Club["status"],
      created_by: dbEvent.club.created_by ?? null,
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
      banner_url: null,
      description: null,
      category: null,
      website_url: null,
      discord_url: null,
      twitter_url: null,
      linkedin_url: null,
      contact_email: null,
      status: "approved",
      created_by: null,
      created_at: dbEvent.created_at,
      updated_at: dbEvent.updated_at ?? dbEvent.created_at,
    };
  }

  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    start_date: dbEvent.start_date,
    end_date: dbEvent.end_date ?? dbEvent.start_date,
    location: dbEvent.location,
    organizer: dbEvent.organizer ?? null,
    club_id: dbEvent.club_id ?? null,
    tags: mapTags(dbEvent.tags),
    image_url: dbEvent.image_url || null,
    category: dbEvent.category ?? null,
    source: dbEvent.source ?? "manual",
    source_url: dbEvent.source_url ?? null,
    content_hash: dbEvent.content_hash ?? null,
    rsvp_count: dbEvent.rsvp_count ?? null,
    created_by: dbEvent.created_by || null,
    created_at: dbEvent.created_at,
    updated_at: dbEvent.updated_at,
    status: (dbEvent.status as "pending" | "approved" | "rejected") || "approved",
    deleted_at: dbEvent.deleted_at ?? null,
    appeal_count: dbEvent.appeal_count,
    club,
    saved_by_users: [],
  };
}
