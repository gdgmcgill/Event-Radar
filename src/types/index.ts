/**
 * TypeScript interfaces for UNI-VERSE
 * These types match the Supabase database schema
 */

export type UserRole = "user" | "admin" | "club_organizer";

export type RsvpStatus = "going" | "interested" | "cancelled";

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
  MUSIC = "music",
  TECH = "tech",
  FOOD = "food",
  VOLUNTEER = "volunteer",
  ARTS = "arts",
  NETWORKING = "networking",
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
  appeal_count?: number;
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
  banner_url: string | null;
  website_url: string | null;
  discord_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  contact_email: string | null;
  status: "pending" | "approved" | "rejected" | "deleted";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  appeal_count?: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  saved_events_count: number;
  roles: UserRole[];
  interest_tags: string[];
  inferred_tags: string[];
  pronouns?: string | null;
  year?: string | null;
  faculty?: string | null;
  visibility?: "public" | "private";
  onboarding_completed?: boolean;
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
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
}

export interface ClubFollower {
  id: string;
  user_id: string;
  club_id: string;
  created_at: string;
}

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface EventInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  event_id: string;
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
  club_id?: string | null;
  read: boolean;
  created_at: string;
}

export interface EventFilter {
  tags?: string[];
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

export type InteractionType =
  | "view"
  | "click"
  | "save"
  | "unsave"
  | "share"
  | "calendar_add";

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
  rsvp_cancelled: number;
}

export interface ClubAnalytics {
  follower_growth: { date: string; count: number }[];
  total_attendees: number;
  popular_tags: { tag: string; count: number }[];
  events: EventAnalytics[];
  engagement_trend: { date: string; rate: number }[];
  peak_hours: { hour: number; count: number }[];
  peak_days: { day: string; count: number }[];
  best_event_type: { tag: string; avg_rsvps: number; comparison: number } | null;
}

// ── Review Types ─────────────────────────────────────────────────────────

export interface Review {
  id: string;
  user_id: string;
  event_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewAggregate {
  average_rating: number;
  total_reviews: number;
  distribution: { rating: number; count: number }[];
  comments: { rating: number; comment: string; created_at: string }[];
}

// ── Featured Events Types ─────────────────────────────────────────────

export interface FeaturedEvent {
  id: string;
  event_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  event: Event;
}

// ── Moderation / Rejection Types ─────────────────────────────────────

export const REJECTION_CATEGORIES = {
  inappropriate_content: "Inappropriate Content",
  missing_information: "Missing Information",
  duplicate: "Duplicate",
  policy_violation: "Policy Violation",
  spam: "Spam",
  other: "Other",
} as const;

export type RejectionCategory = keyof typeof REJECTION_CATEGORIES;

export type ModerationAction = "rejection" | "appeal" | "approval";

export interface ModerationReview {
  id: string;
  target_type: "event" | "club";
  target_id: string;
  action: ModerationAction;
  category: string | null;
  message: string;
  author_id: string;
  created_at: string;
  author_name?: string;
}

// ── Featured Clubs Types ──────────────────────────────────────────────

export interface FeaturedClub {
  id: string;
  club_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  club: Club;
}

// ── Moderation Review Types ──────────────────────────────────────────

export const REJECTION_CATEGORIES = {
  inappropriate_content: "Inappropriate Content",
  missing_information: "Missing Information",
  duplicate: "Duplicate",
  policy_violation: "Policy Violation",
  incorrect_details: "Incorrect Details",
  other: "Other",
} as const;

export type RejectionCategory = keyof typeof REJECTION_CATEGORIES;

export type ModerationAction = "rejection" | "appeal" | "approval";

export interface ModerationReview {
  id: string;
  target_type: "event" | "club";
  target_id: string;
  action: ModerationAction;
  category: RejectionCategory | null;
  message: string;
  author_id: string;
  created_at: string;
  author_name?: string;
}
