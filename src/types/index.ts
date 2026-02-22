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
  is_admin: boolean;
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
  tags?: Array<EventTag | string>;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  searchQuery?: string;
  clubId?: string;
}

// =============================================
// User Interaction Tracking Types
// =============================================

export type InteractionType = 'view' | 'click' | 'save' | 'unsave' | 'share' | 'calendar_add';

export type InteractionSource = 'home' | 'search' | 'recommendation' | 'calendar' | 'direct' | 'modal';

export interface UserInteraction {
  id: string;
  user_id: string | null;
  event_id: string;
  interaction_type: InteractionType;
  session_id: string | null;
  source: InteractionSource | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TrackInteractionPayload {
  event_id: string;
  interaction_type: InteractionType;
  source?: InteractionSource;
  session_id?: string;
  metadata?: Record<string, unknown>;
}

// =============================================
// Event Popularity Types
// =============================================

export interface EventPopularityScore {
  event_id: string;
  view_count: number;
  click_count: number;
  save_count: number;
  share_count: number;
  calendar_add_count: number;
  unique_viewers: number;
  popularity_score: number;
  trending_score: number;
  last_calculated_at: string;
}

export interface PopularEventsResponse {
  events: (Event & { popularity?: EventPopularityScore })[];
  total: number;
}

// =============================================
// User Engagement Types
// =============================================

export interface TagCount {
  tag: string;
  count: number;
}

export interface ClubCount {
  club_id: string;
  count: number;
}

export interface UserEngagementSummary {
  user_id: string;
  total_views: number;
  total_clicks: number;
  total_saves: number;
  total_shares: number;
  total_calendar_adds: number;
  favorite_tags: TagCount[];
  favorite_clubs: ClubCount[];
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}