/**
 * TypeScript interfaces for Uni-Verse
 * These types match the Supabase database schema
 */

export enum EventTag {
  ACADEMIC = "academic",
  SOCIAL = "social",
  SPORTS = "sports",
  CAREER = "career",
  CULTURAL = "cultural",
  WELLNESS = "wellness",
}

export interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string; // ISO date string
  event_time: string; // HH:mm format
  location: string;
  club_id: string;
  tags: EventTag[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  // Relations
  club?: Club;
  saved_by_users?: string[]; // Array of user IDs who saved this event
}

export interface Club {
  id: string;
  name: string;
  instagram_handle: string | null;
  logo_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Matches public.users table schema
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface SavedEvent {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
  // Relations
  event?: Event;
  user?: User;
}

export interface EventFilter {
  tags?: EventTag[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  clubId?: string;
}