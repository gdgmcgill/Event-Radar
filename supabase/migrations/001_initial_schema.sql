-- =============================================
-- Uni-Verse Database Schema
-- Initial migration: Core tables for event platform
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CLUBS TABLE
-- Organizations that host events
-- =============================================
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  instagram_handle TEXT,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- EVENTS TABLE
-- Main events with start_date as TIMESTAMPTZ
-- =============================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- USERS TABLE
-- User profiles linked to Supabase auth
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  interest_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SAVED_EVENTS TABLE
-- User-event relationship for bookmarked events
-- =============================================
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- =============================================
-- INDEXES
-- Performance optimization for common queries
-- =============================================

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_club_id ON public.events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN(tags);

-- Saved events indexes
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON public.saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON public.saved_events(event_id);

-- =============================================
-- UPDATED_AT TRIGGER
-- Auto-update updated_at timestamp on row changes
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_clubs_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- COMMENTS
-- Document table purposes
-- =============================================
COMMENT ON TABLE public.clubs IS 'Organizations that host campus events';
COMMENT ON TABLE public.events IS 'Campus events with approval workflow';
COMMENT ON TABLE public.users IS 'User profiles with interest preferences';
COMMENT ON TABLE public.saved_events IS 'User bookmarked events';
