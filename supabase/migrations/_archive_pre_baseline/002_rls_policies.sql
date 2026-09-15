-- =============================================
-- Uni-Verse Row Level Security Policies
-- Secure access to tables based on user authentication
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CLUBS POLICIES
-- Public read access for all users
-- =============================================
CREATE POLICY "Clubs are viewable by everyone"
  ON public.clubs
  FOR SELECT
  USING (true);

CREATE POLICY "Clubs can be inserted by authenticated users"
  ON public.clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Clubs can be updated by authenticated users"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- EVENTS POLICIES
-- Public read for approved events, write for authenticated
-- =============================================
CREATE POLICY "Approved events are viewable by everyone"
  ON public.events
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "All events viewable by authenticated users"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Events can be inserted by authenticated users"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Events can be updated by authenticated users"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- USERS POLICIES
-- Users can only access their own profile
-- =============================================
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- SAVED_EVENTS POLICIES
-- Users can only manage their own saved events
-- =============================================
CREATE POLICY "Users can view their own saved events"
  ON public.saved_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save events"
  ON public.saved_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own events"
  ON public.saved_events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
