-- Event Radar Database Schema
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  instagram_handle TEXT,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  interest_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT NOT NULL,
  location TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved events junction table
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_club_id ON public.events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON public.saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON public.saved_events(event_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Clubs: Everyone can read, anyone can manage (for testing/development)
-- TODO: In production, restrict INSERT/UPDATE/DELETE to admin users only
CREATE POLICY "Clubs are viewable by everyone" 
  ON public.clubs FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert clubs" 
  ON public.clubs FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update clubs" 
  ON public.clubs FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete clubs" 
  ON public.clubs FOR DELETE 
  USING (true);

-- Users: Users can read their own data
CREATE POLICY "Users can view own profile" 
  ON public.users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Events: Everyone can read approved events
CREATE POLICY "Approved events are viewable by everyone" 
  ON public.events FOR SELECT 
  USING (status = 'approved' OR auth.uid() IS NOT NULL);

-- Events: Anyone can create (for testing/development)
-- TODO: In production, restrict to authenticated users only
CREATE POLICY "Anyone can create events" 
  ON public.events FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update events" 
  ON public.events FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete events" 
  ON public.events FOR DELETE 
  USING (true);

-- Saved Events: Users can manage their own saved events
CREATE POLICY "Users can view own saved events" 
  ON public.saved_events FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved events" 
  ON public.saved_events FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved events" 
  ON public.saved_events FOR DELETE 
  USING (auth.uid() = user_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

