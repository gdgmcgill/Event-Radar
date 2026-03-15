export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      club_followers: {
        Row: {
          club_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_followers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitations: {
        Row: {
          club_id: string
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          inviter_id: string
          status: string
          token: string
        }
        Insert: {
          club_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email: string
          inviter_id: string
          status?: string
          token?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          inviter_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discord_url: string | null
          id: string
          instagram_handle: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          status: string
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discord_url?: string | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          status?: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discord_url?: string | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          status?: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      email_reminder_log: {
        Row: {
          event_id: string | null
          id: string
          reminder_type: string
          sent_at: string
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          reminder_type: string
          sent_at?: string
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reminder_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          invitee_id: string
          inviter_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          invitee_id: string
          inviter_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_popularity_scores: {
        Row: {
          calendar_add_count: number | null
          click_count: number | null
          event_id: string
          last_calculated_at: string | null
          popularity_score: number | null
          save_count: number | null
          share_count: number | null
          trending_score: number | null
          unique_viewers: number | null
          view_count: number | null
        }
        Insert: {
          calendar_add_count?: number | null
          click_count?: number | null
          event_id: string
          last_calculated_at?: string | null
          popularity_score?: number | null
          save_count?: number | null
          share_count?: number | null
          trending_score?: number | null
          unique_viewers?: number | null
          view_count?: number | null
        }
        Update: {
          calendar_add_count?: number | null
          click_count?: number | null
          event_id?: string
          last_calculated_at?: string | null
          popularity_score?: number | null
          save_count?: number | null
          share_count?: number | null
          trending_score?: number | null
          unique_viewers?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_popularity_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          club_id: string | null
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          location: string | null
          organizer: string | null
          rsvp_count: number | null
          source: string
          source_url: string | null
          start_date: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          club_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          location?: string | null
          organizer?: string | null
          rsvp_count?: number | null
          source?: string
          source_url?: string | null
          start_date: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          club_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          location?: string | null
          organizer?: string | null
          rsvp_count?: number | null
          source?: string
          source_url?: string | null
          start_date?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      events_tests: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          location: string | null
          organizer: string | null
          rsvp_count: string | null
          start_date: string | null
          status: string | null
          tags: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id: string
          image_url?: string | null
          location?: string | null
          organizer?: string | null
          rsvp_count?: string | null
          start_date?: string | null
          status?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          organizer?: string | null
          rsvp_count?: string | null
          start_date?: string | null
          status?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      featured_clubs: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          priority: number
          sponsor_name: string | null
          starts_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          priority?: number
          sponsor_name?: string | null
          starts_at: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          priority?: number
          sponsor_name?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_events: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          event_id: string
          id: string
          priority: number
          sponsor_name: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          event_id: string
          id?: string
          priority?: number
          sponsor_name?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          event_id?: string
          id?: string
          priority?: number
          sponsor_name?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_requests: {
        Row: {
          club_id: string
          created_at: string
          id: string
          message: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_explicit_feedback: {
        Row: {
          created_at: string
          event_id: string
          feedback_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          feedback_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          feedback_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendation_feedback: {
        Row: {
          action: string
          created_at: string
          event_id: string
          id: string
          recommendation_rank: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          id?: string
          recommendation_rank: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          id?: string
          recommendation_rank?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_events: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_interaction_counts: {
        Row: {
          click_count: number
          last_interaction: string | null
          save_count: number
          tag: string
          user_id: string
          view_count: number
        }
        Insert: {
          click_count?: number
          last_interaction?: string | null
          save_count?: number
          tag: string
          user_id: string
          view_count?: number
        }
        Update: {
          click_count?: number
          last_interaction?: string | null
          save_count?: number
          tag?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      user_event_scores: {
        Row: {
          breakdown: Json
          event_id: string
          score: number
          scored_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          event_id: string
          score: number
          scored_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          event_id?: string
          score?: number
          scored_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interactions: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          interaction_type: string
          metadata: Json | null
          session_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          faculty: string | null
          id: string
          inferred_tags: string[]
          interest_tags: string[] | null
          name: string | null
          onboarding_completed: boolean | null
          pinned_contracts: string[] | null
          pronouns: string | null
          roles: Database["public"]["Enums"]["user_role"][]
          saved_events_count: number
          total_habits_completed: number | null
          updated_at: string | null
          visibility: string | null
          year: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          faculty?: string | null
          id?: string
          inferred_tags?: string[]
          interest_tags?: string[] | null
          name?: string | null
          onboarding_completed?: boolean | null
          pinned_contracts?: string[] | null
          pronouns?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          saved_events_count?: number
          total_habits_completed?: number | null
          updated_at?: string | null
          visibility?: string | null
          year?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          faculty?: string | null
          id?: string
          inferred_tags?: string[]
          interest_tags?: string[] | null
          name?: string | null
          onboarding_completed?: boolean | null
          pinned_contracts?: string[] | null
          pronouns?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          saved_events_count?: number
          total_habits_completed?: number | null
          updated_at?: string | null
          visibility?: string | null
          year?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_user_scores: { Args: never; Returns: undefined }
      get_event_ids_by_time_filter: {
        Args: { day_type?: string; time_of_day?: string }
        Returns: {
          event_id: string
        }[]
      }
      get_friends: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      get_friends_going_to_event: {
        Args: { current_user_id: string; target_event_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_club_owner: { Args: { p_club_id: string }; Returns: boolean }
      search_events_fuzzy: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          event_id: string
          rank: number
        }[]
      }
      send_event_reminders: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_event_popularity: {
        Args: { p_event_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_action: "approved" | "rejected" | "created" | "updated" | "deleted"
      audit_target: "event" | "user" | "club"
      user_role: "user" | "club_organizer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_action: ["approved", "rejected", "created", "updated", "deleted"],
      audit_target: ["event", "user", "club"],
      user_role: ["user", "club_organizer", "admin"],
    },
  },
} as const
