/**
 * TypeScript interfaces for Uni-Verse
 * These types match the Supabase database schema
 */

export type UserRole = "user" | "admin" | "club_organizer";

export type RsvpStatus = "going" | "interested";

export type InteractionSource =
  | "home"
  | "search"
  | "recommendation"
  | "calendar"
  | "direct"
  | "modal"
  | "my-events";

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
  source_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  // Relations
  club?: Club;
  saved_by_users?: string[];
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  status?: "pending" | "approved" | "rejected";
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  roles: UserRole[];
  interest_tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ClubMember {
  id: string;
  user_id: string;
  club_id: string;
  role: string;
  created_at: string;
  club?: Club;
  user?: User;
}

export interface OrganizerRequest {
  id: string;
  user_id: string;
  club_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  club?: Club;
  user?: User;
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

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  event_id?: string | null;
  read: boolean;
  created_at: string;
}

export interface EventFilter {
  tags?: EventTag[];
  dateRange?: {
    start: Date;
    end?: Date;
  };
  searchQuery?: string;
  clubId?: string;
}

export interface EventPopularityScore {
  popularity_score: number;
  trending_score: number;
  view_count: number;
  click_count: number;
  save_count: number;
  calendar_add_count: number;
  unique_viewers: number;
}

export interface TrackInteractionPayload {
  event_id: string;
  interaction_type:
    | "view"
    | "click"
    | "save"
    | "unsave"
    | "share"
    | "calendar_add";
  source?: InteractionSource | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
}

/** Recommendation feedback action types */
export type RecommendationFeedbackAction =
  | "impression"
  | "click"
  | "save"
  | "dismiss";

