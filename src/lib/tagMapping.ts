/**
 * Shared tag mapping utilities for transforming database events to frontend format
 */

import type { Event, Club } from "@/types";
import { mapTags, partitionTags } from "@/lib/eventTags";

// The tag mapping lives in src/lib/eventTags.ts (REFAC-10). mapTags is
// re-exported so this module's public surface is unchanged.
export { mapTags };

// ─── The shared club embed (F-080, DEC-27) ──────────────────────────────────

/**
 * The club embed every list-shaped event read selects: the ten columns the
 * routes always asked for, plus the five link columns the `Club` type
 * promises (banner_url, website_url, discord_url, twitter_url, linkedin_url),
 * which the transform used to hard-code to null because nobody asked for them.
 *
 * `contact_email` is deliberately NOT embedded (DEC-27, data minimisation):
 * event payloads are anonymous and cacheable, and a club's contact email is
 * read with the club, on the club's own surfaces.
 *
 * Kept a string literal (`as const`) so supabase-js can infer the embed's row
 * type from it; compose it only from literals.
 */
export const EVENT_CLUB_EMBED =
  "club:clubs(id, name, logo_url, instagram_handle, description, category, status, created_by, created_at, updated_at, banner_url, website_url, discord_url, twitter_url, linkedin_url)" as const;

/** Every event column plus the shared club embed. */
export const EVENT_WITH_CLUB_SELECT = `*, ${EVENT_CLUB_EMBED}` as const;

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
  is_free?: boolean;
  price?: string | null;
  rsvp_link?: string | null;
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
  banner_url?: string | null;
  website_url?: string | null;
  discord_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
}

/**
 * Transform a database event to the frontend Event type
 * Passes the authoritative start_date and end_date columns through unchanged
 *
 * Tags the mapping does not know still render as Social, but are no longer
 * silent: one tags-prefixed console.warn per transformed event names the
 * event id and its unmapped tags (DEC-26, F-081). It fires per event, so a
 * list page can log up to its page size; that volume is accepted until
 * Phase 6 replaces console with structured logging.
 * @param dbEvent - Event row from database
 * @returns Transformed Event object
 */
export function transformEventFromDB(dbEvent: DBEvent): Event {
  const { mapped: tags, unmapped } = partitionTags(dbEvent.tags);
  if (unmapped.length > 0) {
    console.warn("[tags] Unmapped tags rendered as Social", {
      eventId: dbEvent.id,
      unmapped,
    });
  }

  // Build club object from relation or legacy organizer field
  let club: Club | undefined = undefined;
  if (dbEvent.club) {
    club = {
      id: dbEvent.club.id,
      name: dbEvent.club.name,
      instagram_handle: dbEvent.club.instagram_handle || null,
      logo_url: dbEvent.club.logo_url || null,
      banner_url: dbEvent.club.banner_url ?? null,
      description: dbEvent.club.description || null,
      category: dbEvent.club.category ?? null,
      website_url: dbEvent.club.website_url ?? null,
      discord_url: dbEvent.club.discord_url ?? null,
      twitter_url: dbEvent.club.twitter_url ?? null,
      linkedin_url: dbEvent.club.linkedin_url ?? null,
      // Not embedded on purpose (DEC-27, data minimisation): see EVENT_CLUB_EMBED.
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
    tags,
    image_url: dbEvent.image_url || null,
    category: dbEvent.category ?? null,
    source: dbEvent.source ?? "manual",
    source_url: dbEvent.source_url ?? null,
    content_hash: dbEvent.content_hash ?? null,
    rsvp_count: dbEvent.rsvp_count ?? null,
    is_free: dbEvent.is_free ?? true,
    price: dbEvent.price ?? null,
    rsvp_link: dbEvent.rsvp_link ?? null,
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
