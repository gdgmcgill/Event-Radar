/**
 * Supabase database types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string | null;
          location: string;
          category: string | null;
          tags: string[];
          image_url: string | null;
          organizer: string | null;
          rsvp_count: number;
          created_at: string;
          updated_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          start_date: string;
          end_date?: string | null;
          location: string;
          category?: string | null;
          tags?: string[];
          image_url?: string | null;
          organizer?: string | null;
          rsvp_count?: number;
          created_at?: string;
          updated_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          start_date?: string;
          end_date?: string | null;
          location?: string;
          category?: string | null;
          tags?: string[];
          image_url?: string | null;
          organizer?: string | null;
          rsvp_count?: number;
          created_at?: string;
          updated_at?: string;
          status?: string;
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
      clubs: {
        Row: {
          id: string;
          name: string;
          instagram_handle: string | null;
          logo_url: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          instagram_handle?: string | null;
          logo_url?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          instagram_handle?: string | null;
          logo_url?: string | null;
          description?: string | null;
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
          avatar_url: string | null;
          interest_tags: string[];
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          interest_tags?: string[];
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          interest_tags?: string[];
          is_admin?: boolean;
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
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_interactions: {
        Row: {
          id: string;
          user_id: string | null;
          event_id: string;
          interaction_type: 'view' | 'click' | 'save' | 'unsave' | 'share' | 'calendar_add';
          session_id: string | null;
          source: 'home' | 'search' | 'recommendation' | 'calendar' | 'direct' | 'modal' | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_id: string;
          interaction_type: 'view' | 'click' | 'save' | 'unsave' | 'share' | 'calendar_add';
          session_id?: string | null;
          source?: 'home' | 'search' | 'recommendation' | 'calendar' | 'direct' | 'modal' | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_id?: string;
          interaction_type?: 'view' | 'click' | 'save' | 'unsave' | 'share' | 'calendar_add';
          session_id?: string | null;
          source?: 'home' | 'search' | 'recommendation' | 'calendar' | 'direct' | 'modal' | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      event_popularity_scores: {
        Row: {
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
        };
        Insert: {
          event_id: string;
          view_count?: number;
          click_count?: number;
          save_count?: number;
          share_count?: number;
          calendar_add_count?: number;
          unique_viewers?: number;
          popularity_score?: number;
          trending_score?: number;
          last_calculated_at?: string;
        };
        Update: {
          event_id?: string;
          view_count?: number;
          click_count?: number;
          save_count?: number;
          share_count?: number;
          calendar_add_count?: number;
          unique_viewers?: number;
          popularity_score?: number;
          trending_score?: number;
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
          favorite_tags: { tag: string; count: number }[];
          favorite_clubs: { club_id: string; count: number }[];
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_views?: number;
          total_clicks?: number;
          total_saves?: number;
          total_shares?: number;
          total_calendar_adds?: number;
          favorite_tags?: { tag: string; count: number }[];
          favorite_clubs?: { club_id: string; count: number }[];
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_views?: number;
          total_clicks?: number;
          total_saves?: number;
          total_shares?: number;
          total_calendar_adds?: number;
          favorite_tags?: { tag: string; count: number }[];
          favorite_clubs?: { club_id: string; count: number }[];
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_event_popularity: {
        Args: { p_event_id: string };
        Returns: void;
      };
      update_user_engagement: {
        Args: { p_user_id: string };
        Returns: void;
      };
      calculate_popularity_score: {
        Args: {
          p_view_count: number;
          p_click_count: number;
          p_save_count: number;
          p_share_count: number;
          p_calendar_add_count: number;
          p_unique_viewers: number;
        };
        Returns: number;
      };
      calculate_trending_score: {
        Args: { p_event_id: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};
