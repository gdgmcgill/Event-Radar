export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          appeal_count: number
          banner_url: string | null
          category: string | null
          contact_email: string | null
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
          appeal_count?: number
          banner_url?: string | null
          category?: string | null
          contact_email?: string | null
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
          appeal_count?: number
          banner_url?: string | null
          category?: string | null
          contact_email?: string | null
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
      event_discovery_metadata: {
        Row: {
          canonical_event_id: string | null
          canonical_opportunity_id: string | null
          checked_at: string | null
          curator_note: string | null
          deadline_at: string | null
          deadline_date: string | null
          deadline_precision: string
          duplicate_review_note: string | null
          editorial_priority: number
          eligibility_text: string | null
          event_id: string
          fields: string[]
          is_pick: boolean
          listing_type: string
          organizer_university_id: string | null
          pick_reason: string | null
          relevance_scope: string
          review_at: string | null
          source_timezone: string
          timezone_assumed: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          canonical_event_id?: string | null
          canonical_opportunity_id?: string | null
          checked_at?: string | null
          curator_note?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_precision?: string
          duplicate_review_note?: string | null
          editorial_priority?: number
          eligibility_text?: string | null
          event_id: string
          fields?: string[]
          is_pick?: boolean
          listing_type?: string
          organizer_university_id?: string | null
          pick_reason?: string | null
          relevance_scope?: string
          review_at?: string | null
          source_timezone?: string
          timezone_assumed?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          canonical_event_id?: string | null
          canonical_opportunity_id?: string | null
          checked_at?: string | null
          curator_note?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_precision?: string
          duplicate_review_note?: string | null
          editorial_priority?: number
          eligibility_text?: string | null
          event_id?: string
          fields?: string[]
          is_pick?: boolean
          listing_type?: string
          organizer_university_id?: string | null
          pick_reason?: string | null
          relevance_scope?: string
          review_at?: string | null
          source_timezone?: string
          timezone_assumed?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_discovery_metadata_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_metadata_canonical_opportunity_id_fkey"
            columns: ["canonical_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_metadata_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_metadata_organizer_university_id_fkey"
            columns: ["organizer_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_metadata_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_discovery_universities: {
        Row: {
          event_id: string
          university_id: string
        }
        Insert: {
          event_id: string
          university_id: string
        }
        Update: {
          event_id?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_discovery_universities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
      event_reports: {
        Row: {
          category: string
          created_at: string
          event_id: string
          id: string
          message: string | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          event_id: string
          id?: string
          message?: string | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          message?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          appeal_count: number
          category: string | null
          club_id: string | null
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          is_free: boolean
          location: string | null
          organizer: string | null
          pending_edits: Json | null
          price: string | null
          rsvp_count: number | null
          rsvp_link: string | null
          source: string
          source_url: string | null
          start_date: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          appeal_count?: number
          category?: string | null
          club_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          is_free?: boolean
          location?: string | null
          organizer?: string | null
          pending_edits?: Json | null
          price?: string | null
          rsvp_count?: number | null
          rsvp_link?: string | null
          source?: string
          source_url?: string | null
          start_date: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          appeal_count?: number
          category?: string | null
          club_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_free?: boolean
          location?: string | null
          organizer?: string | null
          pending_edits?: Json | null
          price?: string | null
          rsvp_count?: number | null
          rsvp_link?: string | null
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
      experiment_assignments: {
        Row: {
          assigned_at: string
          experiment_id: string
          id: string
          user_id: string
          variant_id: string
        }
        Insert: {
          assigned_at?: string
          experiment_id: string
          id?: string
          user_id: string
          variant_id: string
        }
        Update: {
          assigned_at?: string
          experiment_id?: string
          id?: string
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_assignments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_variants: {
        Row: {
          config: Json
          created_at: string
          experiment_id: string
          id: string
          name: string
          weight: number
        }
        Insert: {
          config?: Json
          created_at?: string
          experiment_id: string
          id?: string
          name: string
          weight?: number
        }
        Update: {
          config?: Json
          created_at?: string
          experiment_id?: string
          id?: string
          name?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          target_metric: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          target_metric?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          target_metric?: string | null
          updated_at?: string
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
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string | null
          type: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject?: string | null
          type?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string | null
          type?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_request_log: {
        Row: {
          event_id: string
          id: string
          request_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          request_type?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          request_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_deliveries: {
        Row: {
          duplicates: number
          error_code: string | null
          event_count: number
          id: string
          inserted: number
          invalid: number
          items_seen: number | null
          outcome: string
          producer: string
          received_at: string
          run_id: string | null
        }
        Insert: {
          duplicates?: number
          error_code?: string | null
          event_count: number
          id?: string
          inserted?: number
          invalid?: number
          items_seen?: number | null
          outcome: string
          producer: string
          received_at?: string
          run_id?: string | null
        }
        Update: {
          duplicates?: number
          error_code?: string | null
          event_count?: number
          id?: string
          inserted?: number
          invalid?: number
          items_seen?: number | null
          outcome?: string
          producer?: string
          received_at?: string
          run_id?: string | null
        }
        Relationships: []
      }
      legacy_reminder_log: {
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
            foreignKeyName: "legacy_reminder_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          client_hash: string
          created_at: string
          details: string | null
          event_id: string | null
          id: string
          opportunity_id: string | null
          reason: string
          reporter_user_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string | null
          status: string
        }
        Insert: {
          client_hash: string
          created_at?: string
          details?: string | null
          event_id?: string | null
          id?: string
          opportunity_id?: string | null
          reason: string
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          status?: string
        }
        Update: {
          client_hash?: string
          created_at?: string
          details?: string | null
          event_id?: string | null
          id?: string
          opportunity_id?: string | null
          reason?: string
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_reviews: {
        Row: {
          action: string
          author_id: string
          category: string | null
          created_at: string | null
          id: string
          message: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          author_id: string
          category?: string | null
          created_at?: string | null
          id?: string
          message: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          author_id?: string
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          club_id: string | null
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
          club_id?: string | null
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
          club_id?: string | null
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
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          action_note: string | null
          action_url: string | null
          application_mode: string
          canonical_event_id: string | null
          canonical_opportunity_id: string | null
          checked_at: string | null
          created_at: string
          created_by: string
          curator_note: string | null
          deadline_at: string | null
          deadline_date: string | null
          deadline_precision: string
          deleted_at: string | null
          description: string
          duplicate_review_note: string | null
          editorial_priority: number
          eligibility_text: string | null
          ends_at: string | null
          fields: string[]
          id: string
          is_pick: boolean
          listing_type: string
          location: string
          organization: string
          organizer_university_id: string | null
          pick_reason: string | null
          published_at: string | null
          relevance_scope: string
          review_at: string | null
          slug: string
          source_timezone: string
          source_type: string
          source_url: string | null
          starts_at: string | null
          status: string
          subtype: string | null
          timezone_assumed: boolean
          title: string
          updated_at: string
          updated_by: string
          work_mode: string
        }
        Insert: {
          action_note?: string | null
          action_url?: string | null
          application_mode?: string
          canonical_event_id?: string | null
          canonical_opportunity_id?: string | null
          checked_at?: string | null
          created_at?: string
          created_by: string
          curator_note?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_precision?: string
          deleted_at?: string | null
          description: string
          duplicate_review_note?: string | null
          editorial_priority?: number
          eligibility_text?: string | null
          ends_at?: string | null
          fields?: string[]
          id?: string
          is_pick?: boolean
          listing_type: string
          location?: string
          organization: string
          organizer_university_id?: string | null
          pick_reason?: string | null
          published_at?: string | null
          relevance_scope?: string
          review_at?: string | null
          slug: string
          source_timezone?: string
          source_type?: string
          source_url?: string | null
          starts_at?: string | null
          status?: string
          subtype?: string | null
          timezone_assumed?: boolean
          title: string
          updated_at?: string
          updated_by: string
          work_mode?: string
        }
        Update: {
          action_note?: string | null
          action_url?: string | null
          application_mode?: string
          canonical_event_id?: string | null
          canonical_opportunity_id?: string | null
          checked_at?: string | null
          created_at?: string
          created_by?: string
          curator_note?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          deadline_precision?: string
          deleted_at?: string | null
          description?: string
          duplicate_review_note?: string | null
          editorial_priority?: number
          eligibility_text?: string | null
          ends_at?: string | null
          fields?: string[]
          id?: string
          is_pick?: boolean
          listing_type?: string
          location?: string
          organization?: string
          organizer_university_id?: string | null
          pick_reason?: string | null
          published_at?: string | null
          relevance_scope?: string
          review_at?: string | null
          slug?: string
          source_timezone?: string
          source_type?: string
          source_url?: string | null
          starts_at?: string | null
          status?: string
          subtype?: string | null
          timezone_assumed?: boolean
          title?: string
          updated_at?: string
          updated_by?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_canonical_opportunity_id_fkey"
            columns: ["canonical_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organizer_university_id_fkey"
            columns: ["organizer_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_universities: {
        Row: {
          opportunity_id: string
          university_id: string
        }
        Insert: {
          opportunity_id: string
          university_id: string
        }
        Update: {
          opportunity_id?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_universities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
          experiment_variant_id: string | null
          id: string
          recommendation_rank: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          experiment_variant_id?: string | null
          id?: string
          recommendation_rank: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          experiment_variant_id?: string | null
          id?: string
          recommendation_rank?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_experiment_variant_id_fkey"
            columns: ["experiment_variant_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_actions: {
        Row: {
          action: string
          created_at: string
          id: number
          resource_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          resource_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_actions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          audience: string
          author_name: string
          author_url: string | null
          body_markdown: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          published_at: string | null
          resource_type: string
          reviewed_at: string | null
          slug: string
          source_note: string | null
          status: string
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience: string
          author_name: string
          author_url?: string | null
          body_markdown?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          published_at?: string | null
          resource_type: string
          reviewed_at?: string | null
          slug: string
          source_note?: string | null
          status?: string
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          author_name?: string
          author_url?: string | null
          body_markdown?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          published_at?: string | null
          resource_type?: string
          reviewed_at?: string | null
          slug?: string
          source_note?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      saved_opportunities: {
        Row: {
          created_at: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_opportunities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          client_hash: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          details: Json
          id: string
          kind: string
          organization: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          status: string
          submitter_user_id: string | null
          target_opportunity_id: string | null
          target_resource_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_hash: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind: string
          organization: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: string
          submitter_user_id?: string | null
          target_opportunity_id?: string | null
          target_resource_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_hash?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          organization?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: string
          submitter_user_id?: string | null
          target_opportunity_id?: string | null
          target_resource_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_target_opportunity_id_fkey"
            columns: ["target_opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_target_resource_id_fkey"
            columns: ["target_resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
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
      universities: {
        Row: {
          active: boolean
          city: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          city: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          city?: string
          id?: string
          name?: string
          slug?: string
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
          affiliation_source: string | null
          avatar_url: string | null
          ban_expires_at: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          banner_url: string | null
          created_at: string | null
          email: string
          faculty: string | null
          id: string
          inferred_tags: string[]
          interest_tags: string[] | null
          name: string | null
          onboarding_completed: boolean | null
          other_university: string | null
          pinned_contracts: string[] | null
          program: string | null
          pronouns: string | null
          roles: Database["public"]["Enums"]["user_role"][]
          saved_events_count: number
          total_habits_completed: number | null
          university_id: string | null
          updated_at: string | null
          visibility: string
          year: string | null
        }
        Insert: {
          affiliation_source?: string | null
          avatar_url?: string | null
          ban_expires_at?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          created_at?: string | null
          email: string
          faculty?: string | null
          id?: string
          inferred_tags?: string[]
          interest_tags?: string[] | null
          name?: string | null
          onboarding_completed?: boolean | null
          other_university?: string | null
          pinned_contracts?: string[] | null
          program?: string | null
          pronouns?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          saved_events_count?: number
          total_habits_completed?: number | null
          university_id?: string | null
          updated_at?: string | null
          visibility?: string
          year?: string | null
        }
        Update: {
          affiliation_source?: string | null
          avatar_url?: string | null
          ban_expires_at?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          created_at?: string | null
          email?: string
          faculty?: string | null
          id?: string
          inferred_tags?: string[]
          interest_tags?: string[] | null
          name?: string | null
          onboarding_completed?: boolean | null
          other_university?: string | null
          pinned_contracts?: string[] | null
          program?: string | null
          pronouns?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          saved_events_count?: number
          total_habits_completed?: number | null
          university_id?: string | null
          updated_at?: string | null
          visibility?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      discovery_public: {
        Row: {
          action_note: string | null
          action_url: string | null
          actionable_at: string | null
          application_mode: string | null
          canonical_id: string | null
          canonical_kind: string | null
          checked_at: string | null
          curator_note: string | null
          deadline_at: string | null
          deadline_date: string | null
          deadline_precision: string | null
          description: string | null
          editorial_priority: number | null
          eligibility_text: string | null
          ends_at: string | null
          expires_at: string | null
          fields: string[] | null
          id: string | null
          is_pick: boolean | null
          kind: string | null
          listing_type: string | null
          location: string | null
          organization: string | null
          organizer_university_id: string | null
          pick_reason: string | null
          published_at: string | null
          relevance_scope: string | null
          review_at: string | null
          slug: string | null
          source_timezone: string | null
          source_type: string | null
          source_url: string | null
          starts_at: string | null
          subtype: string | null
          timezone_assumed: boolean | null
          title: string | null
          university_ids: string[] | null
          work_mode: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      club_invitation_unchanged_except_status: {
        Args: {
          p_club_id: string
          p_created_at: string
          p_expires_at: string
          p_id: string
          p_invitee_email: string
          p_inviter_id: string
          p_token: string
        }
        Returns: boolean
      }
      compute_user_scores: { Args: never; Returns: undefined }
      cron_job_status: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_start: string
          last_status: string
          schedule: string
        }[]
      }
      curate_event_discovery: {
        Args: {
          p_actor: string
          p_can_pick?: boolean
          p_data: Json
          p_expected?: string
          p_id: string
        }
        Returns: Json
      }
      curate_opportunity: {
        Args: {
          p_action: string
          p_actor: string
          p_can_pick?: boolean
          p_data?: Json
          p_expected?: string
          p_id: string
        }
        Returns: Json
      }
      curate_resource: {
        Args: {
          p_action: string
          p_actor: string
          p_data?: Json
          p_expected?: string
          p_id: string
        }
        Returns: Json
      }
      discovery_deadline: {
        Args: {
          p_at: string
          p_date: string
          p_precision: string
          p_timezone: string
        }
        Returns: string
      }
      discovery_duplicate_candidates: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      discovery_require_editor: {
        Args: { p_actor: string }
        Returns: undefined
      }
      discovery_validate_metadata: {
        Args: { p_data: Json }
        Returns: undefined
      }
      discovery_validate_publish: { Args: { p_id: string }; Returns: undefined }
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
      get_public_event_rsvp_counts: {
        Args: { target_event_id: string }
        Returns: {
          going: number
          interested: number
        }[]
      }
      get_user_engagement: { Args: never; Returns: Json }
      has_open_club_invitation: {
        Args: { p_club_id: string }
        Returns: boolean
      }
      intake_listing_report: {
        Args: {
          p_client_hash: string
          p_details: string
          p_id: string
          p_kind: string
          p_reason: string
          p_user: string
        }
        Returns: undefined
      }
      intake_submission: {
        Args: {
          p_client_hash: string
          p_contact_email: string
          p_contact_name: string
          p_details: Json
          p_kind: string
          p_organization: string
          p_source_url: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      is_club_owner: { Args: { p_club_id: string }; Returns: boolean }
      merge_event_discovery: {
        Args: {
          p_actor: string
          p_canonical_id: string
          p_canonical_kind: string
          p_expected?: string
          p_id: string
          p_reason: string
        }
        Returns: undefined
      }
      query_discovery: {
        Args: {
          p_after?: Json
          p_as_of: string
          p_filters?: Json
          p_limit?: number
        }
        Returns: Json[]
      }
      query_saved_discovery: {
        Args: { p_after?: Json; p_as_of: string; p_limit?: number }
        Returns: Json[]
      }
      resolve_listing_report: {
        Args: {
          p_action: string
          p_actor: string
          p_id: string
          p_note: string
        }
        Returns: Json
      }
      review_event_edits_atomic: {
        Args: {
          p_action: string
          p_actor_id: string
          p_event_id: string
          p_expected_pending_edits: Json
          p_reason?: string
        }
        Returns: string
      }
      review_organizer_request_atomic: {
        Args: { p_actor_id: string; p_request_id: string; p_status: string }
        Returns: string
      }
      review_submission: {
        Args: {
          p_action: string
          p_actor: string
          p_expected: string
          p_id: string
          p_reason: string
        }
        Returns: Json
      }
      search_events_fuzzy: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          event_id: string
          rank: number
        }[]
      }
      send_event_reminders: { Args: never; Returns: Json }
      send_feedback_requests: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_club_ownership_atomic: {
        Args: { p_actor_id: string; p_club_id: string; p_new_owner_id: string }
        Returns: string
      }
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

