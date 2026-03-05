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

export interface ClubInvitation {
  id: string;
  club_id: string;
  inviter_id: string;
  invitee_email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ClubFollower {
  id: string;
  user_id: string;
  club_id: string;
  created_at: string;
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

/** A/B Testing Types */
export type ExperimentStatus = "draft" | "running" | "paused" | "completed";
export type ExperimentMetric = "ctr" | "save_rate" | "dismiss_rate";

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  target_metric: ExperimentMetric;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variants?: ExperimentVariant[];
}

export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
}

export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  variant_id: string;
  user_id: string;
  assigned_at: string;
}

export interface VariantMetrics {
  variant_id: string;
  variant_name: string;
  assignments: number;
  impressions: number;
  clicks: number;
  saves: number;
  dismisses: number;
  ctr_percent: number;
  save_rate_percent: number;
  dismiss_rate_percent: number;
}

export interface ExperimentResults {
  experiment: Experiment;
  variant_metrics: VariantMetrics[];
  significance: {
    statistic: number;
    p_value: number;
    significant: boolean;
  } | null;
}

// ── Analytics Types ────────────────────────────────────────────────────────

export interface EventAnalytics {
  event_id: string;
  title: string;
  event_date: string;
  views: number;
  clicks: number;
  saves: number;
  unique_viewers: number;
  rsvp_going: number;
  rsvp_interested: number;
}

export interface ClubAnalytics {
  follower_growth: { date: string; count: number }[];
  total_attendees: number;
  popular_tags: { tag: string; count: number }[];
  events: EventAnalytics[];
}

