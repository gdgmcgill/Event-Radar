/**
 * Supabase database types
 * TODO: Generate these types using Supabase CLI:
 * npx supabase gen types typescript --project-id jnlbrvejjjgtjhlajfss > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string;
          event_date: string;
          event_time: string;
          location: string;
          organizer: string | null;
          club_id: string | null;
          tags: string[];
          image_url: string | null;
          category: string | null;
          source_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          status: "pending" | "approved" | "rejected";
          approved_by: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          start_date?: string;
          end_date?: string;
          event_date?: string;
          event_time?: string;
          location: string;
          organizer?: string | null;
          club_id?: string | null;
          tags?: string[];
          image_url?: string | null;
          category?: string | null;
          source_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: "pending" | "approved" | "rejected";
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          start_date?: string;
          end_date?: string;
          event_date?: string;
          event_time?: string;
          location?: string;
          organizer?: string | null;
          club_id?: string | null;
          tags?: string[];
          image_url?: string | null;
          category?: string | null;
          source_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: "pending" | "approved" | "rejected";
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          instagram_handle: string | null;
          logo_url: string | null;
          status: "pending" | "approved" | "rejected";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          instagram_handle?: string | null;
          logo_url?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          instagram_handle?: string | null;
          logo_url?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          full_name: string | null;
          avatar_url: string | null;
          roles: ("user" | "admin" | "club_organizer")[];
          interest_tags: string[];
          inferred_tags: string[];
          saved_events_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          roles?: ("user" | "admin" | "club_organizer")[];
          interest_tags?: string[];
          inferred_tags?: string[];
          saved_events_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          roles?: ("user" | "admin" | "club_organizer")[];
          interest_tags?: string[];
          inferred_tags?: string[];
          saved_events_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_events: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          status: "going" | "interested" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          status: "going" | "interested" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          status?: "going" | "interested" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          event_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          event_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          event_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      organizer_requests: {
        Row: {
          id: string;
          user_id: string;
          club_id: string;
          message: string | null;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          club_id: string;
          message?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string;
          message?: string | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_members: {
        Row: {
          id: string;
          user_id: string;
          club_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          club_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_interactions: {
        Row: {
          id: string;
          user_id: string | null;
          event_id: string;
          interaction_type:
            | "view"
            | "click"
            | "save"
            | "unsave"
            | "share"
            | "calendar_add";
          session_id: string | null;
          source:
            | "home"
            | "search"
            | "recommendation"
            | "calendar"
            | "direct"
            | "modal"
            | "my-events"
            | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_id: string;
          interaction_type:
            | "view"
            | "click"
            | "save"
            | "unsave"
            | "share"
            | "calendar_add";
          session_id?: string | null;
          source?:
            | "home"
            | "search"
            | "recommendation"
            | "calendar"
            | "direct"
            | "modal"
            | "my-events"
            | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_id?: string;
          interaction_type?:
            | "view"
            | "click"
            | "save"
            | "unsave"
            | "share"
            | "calendar_add";
          session_id?: string | null;
          source?:
            | "home"
            | "search"
            | "recommendation"
            | "calendar"
            | "direct"
            | "modal"
            | "my-events"
            | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      event_popularity_scores: {
        Row: {
          event_id: string;
          popularity_score: number;
          trending_score: number;
          view_count: number;
          click_count: number;
          save_count: number;
          calendar_add_count: number;
          unique_viewers: number;
          last_calculated_at: string;
        };
        Insert: {
          event_id: string;
          popularity_score?: number;
          trending_score?: number;
          view_count?: number;
          click_count?: number;
          save_count?: number;
          calendar_add_count?: number;
          unique_viewers?: number;
          last_calculated_at?: string;
        };
        Update: {
          event_id?: string;
          popularity_score?: number;
          trending_score?: number;
          view_count?: number;
          click_count?: number;
          save_count?: number;
          calendar_add_count?: number;
          unique_viewers?: number;
          last_calculated_at?: string;
        };
        Relationships: [];
      };
      user_engagement_summary: {
        Row: {
          user_id: string;
          total_views: number;
          total_clicks: number;
          total_saves: number;
          total_shares: number;
          total_calendar_adds: number;
          favorite_tags: string[];
          favorite_clubs: string[];
          last_active_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          total_views?: number;
          total_clicks?: number;
          total_saves?: number;
          total_shares?: number;
          total_calendar_adds?: number;
          favorite_tags?: string[];
          favorite_clubs?: string[];
          last_active_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          user_id?: string;
          total_views?: number;
          total_clicks?: number;
          total_saves?: number;
          total_shares?: number;
          total_calendar_adds?: number;
          favorite_tags?: string[];
          favorite_clubs?: string[];
          last_active_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      recommendation_feedback: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          recommendation_rank: number;
          action: string;
          session_id: string | null;
          experiment_variant_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          recommendation_rank: number;
          action: string;
          session_id?: string | null;
          experiment_variant_id: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          recommendation_rank?: number;
          action?: string;
          session_id?: string | null;
          experiment_variant_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      recommendation_explicit_feedback: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          feedback_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          feedback_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          feedback_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      club_invitations: {
        Row: {
          id: string;
          club_id: string;
          inviter_id: string;
          invitee_email: string;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          inviter_id: string;
          invitee_email: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          inviter_id?: string;
          invitee_email?: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_invitations_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_followers: {
        Row: {
          id: string;
          user_id: string;
          club_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          club_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_followers_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      experiments: {
        Row: {
          id: string;
          name: string;
          description: string;
          status: "draft" | "running" | "paused" | "completed";
          target_metric: "ctr" | "save_rate" | "dismiss_rate";
          start_date: string | null;
          end_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          status?: "draft" | "running" | "paused" | "completed";
          target_metric?: "ctr" | "save_rate" | "dismiss_rate";
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          status?: "draft" | "running" | "paused" | "completed";
          target_metric?: "ctr" | "save_rate" | "dismiss_rate";
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      experiment_variants: {
        Row: {
          id: string;
          experiment_id: string;
          name: string;
          config: Record<string, unknown>;
          weight: number;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          name: string;
          config?: Record<string, unknown>;
          weight?: number;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          name?: string;
          config?: Record<string, unknown>;
          weight?: number;
        };
        Relationships: [];
      };
      experiment_assignments: {
        Row: {
          id: string;
          experiment_id: string;
          variant_id: string;
          user_id: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          variant_id: string;
          user_id: string;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          variant_id?: string;
          user_id?: string;
          assigned_at?: string;
        };
        Relationships: [];
      };
      email_reminder_log: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          reminder_type: "reminder_24h" | "reminder_1h";
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          reminder_type: "reminder_24h" | "reminder_1h";
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          reminder_type?: "reminder_24h" | "reminder_1h";
          sent_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      compute_user_scores: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
