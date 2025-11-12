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
          event_date: string;
          event_time: string;
          location: string;
          club_id: string;
          tags: string[];
          image_url: string | null;
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
          event_date: string;
          event_time: string;
          location: string;
          club_id: string;
          tags: string[];
          image_url?: string | null;
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
          event_date?: string;
          event_time?: string;
          location?: string;
          club_id?: string;
          tags?: string[];
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: "pending" | "approved" | "rejected";
          approved_by?: string | null;
          approved_at?: string | null;
        };
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
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          interest_tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          interest_tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          interest_tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

