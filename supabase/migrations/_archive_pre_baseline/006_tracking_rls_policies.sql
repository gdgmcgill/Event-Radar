-- =============================================
-- Row Level Security Policies for Tracking Tables
-- =============================================

-- =============================================
-- Enable RLS on all tracking tables
-- =============================================
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_popularity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement_summary ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER_INTERACTIONS POLICIES
-- Users can insert their own interactions
-- Users can view their own interactions
-- Service role can view all for analytics
-- =============================================

-- Allow authenticated users to insert their own interactions
CREATE POLICY "Users can insert their own interactions"
  ON public.user_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own interactions
CREATE POLICY "Users can view their own interactions"
  ON public.user_interactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow anonymous users to insert anonymous interactions (user_id = NULL)
CREATE POLICY "Anonymous users can insert interactions"
  ON public.user_interactions
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- =============================================
-- EVENT_POPULARITY_SCORES POLICIES
-- Public read access for everyone
-- Only service role can write (via API)
-- =============================================

-- Allow everyone to read popularity scores
CREATE POLICY "Popularity scores are viewable by everyone"
  ON public.event_popularity_scores
  FOR SELECT
  USING (true);

-- Service role can manage popularity scores (implicit with service key)
-- No insert/update/delete policies needed for regular users

-- =============================================
-- USER_ENGAGEMENT_SUMMARY POLICIES
-- Users can only view their own engagement summary
-- =============================================

-- Allow users to view their own engagement summary
CREATE POLICY "Users can view their own engagement summary"
  ON public.user_engagement_summary
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- GRANT PERMISSIONS
-- Allow service role full access for analytics
-- =============================================

-- Note: Service role bypasses RLS by default
-- These grants ensure the tables are accessible

GRANT SELECT ON public.user_interactions TO authenticated;
GRANT INSERT ON public.user_interactions TO authenticated;
GRANT INSERT ON public.user_interactions TO anon;

GRANT SELECT ON public.event_popularity_scores TO authenticated;
GRANT SELECT ON public.event_popularity_scores TO anon;

GRANT SELECT ON public.user_engagement_summary TO authenticated;
