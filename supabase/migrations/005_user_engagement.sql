-- =============================================
-- User Engagement Summary Table
-- Aggregated user engagement metrics
-- =============================================

-- =============================================
-- USER_ENGAGEMENT_SUMMARY TABLE
-- Stores aggregated engagement data per user
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_engagement_summary (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_saves INTEGER NOT NULL DEFAULT 0,
  total_shares INTEGER NOT NULL DEFAULT 0,
  total_calendar_adds INTEGER NOT NULL DEFAULT 0,
  favorite_tags JSONB DEFAULT '[]',
  favorite_clubs JSONB DEFAULT '[]',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Index for finding active users
CREATE INDEX IF NOT EXISTS idx_user_engagement_last_active
  ON public.user_engagement_summary(last_active_at DESC);

-- Index for querying by engagement level
CREATE INDEX IF NOT EXISTS idx_user_engagement_total_clicks
  ON public.user_engagement_summary(total_clicks DESC);

-- =============================================
-- TRIGGER: Update updated_at
-- =============================================
CREATE TRIGGER update_user_engagement_updated_at
  BEFORE UPDATE ON public.user_engagement_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION: Update User Engagement
-- Recalculates all engagement metrics for a user
-- =============================================
CREATE OR REPLACE FUNCTION public.update_user_engagement(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_views INTEGER;
  v_total_clicks INTEGER;
  v_total_saves INTEGER;
  v_total_shares INTEGER;
  v_total_calendar_adds INTEGER;
  v_favorite_tags JSONB;
  v_favorite_clubs JSONB;
  v_last_active TIMESTAMPTZ;
BEGIN
  -- Count interactions by type
  SELECT
    COALESCE(SUM(CASE WHEN interaction_type = 'view' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'click' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'save' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'share' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'calendar_add' THEN 1 ELSE 0 END), 0),
    MAX(created_at)
  INTO
    v_total_views, v_total_clicks, v_total_saves,
    v_total_shares, v_total_calendar_adds, v_last_active
  FROM public.user_interactions
  WHERE user_id = p_user_id
    AND interaction_type != 'unsave';

  -- Calculate favorite tags (from high-intent interactions)
  SELECT COALESCE(jsonb_agg(tag_data), '[]'::jsonb)
  INTO v_favorite_tags
  FROM (
    SELECT jsonb_build_object('tag', tag, 'count', count) as tag_data
    FROM (
      SELECT unnest(e.tags) as tag, COUNT(*) as count
      FROM public.user_interactions ui
      JOIN public.events e ON e.id = ui.event_id
      WHERE ui.user_id = p_user_id
        AND ui.interaction_type IN ('save', 'click', 'calendar_add')
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    ) tag_counts
  ) tags;

  -- Calculate favorite clubs (from high-intent interactions)
  SELECT COALESCE(jsonb_agg(club_data), '[]'::jsonb)
  INTO v_favorite_clubs
  FROM (
    SELECT jsonb_build_object('club_id', club_id, 'count', count) as club_data
    FROM (
      SELECT e.club_id, COUNT(*) as count
      FROM public.user_interactions ui
      JOIN public.events e ON e.id = ui.event_id
      WHERE ui.user_id = p_user_id
        AND ui.interaction_type IN ('save', 'click', 'calendar_add')
        AND e.club_id IS NOT NULL
      GROUP BY e.club_id
      ORDER BY count DESC
      LIMIT 10
    ) club_counts
  ) clubs;

  -- Upsert the engagement summary
  INSERT INTO public.user_engagement_summary (
    user_id, total_views, total_clicks, total_saves, total_shares,
    total_calendar_adds, favorite_tags, favorite_clubs, last_active_at
  ) VALUES (
    p_user_id, v_total_views, v_total_clicks, v_total_saves, v_total_shares,
    v_total_calendar_adds, v_favorite_tags, v_favorite_clubs, v_last_active
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_views = EXCLUDED.total_views,
    total_clicks = EXCLUDED.total_clicks,
    total_saves = EXCLUDED.total_saves,
    total_shares = EXCLUDED.total_shares,
    total_calendar_adds = EXCLUDED.total_calendar_adds,
    favorite_tags = EXCLUDED.favorite_tags,
    favorite_clubs = EXCLUDED.favorite_clubs,
    last_active_at = EXCLUDED.last_active_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.user_engagement_summary IS 'Aggregated user engagement metrics for personalization';
COMMENT ON COLUMN public.user_engagement_summary.favorite_tags IS 'Array of {tag, count} objects showing most interacted tags';
COMMENT ON COLUMN public.user_engagement_summary.favorite_clubs IS 'Array of {club_id, count} objects showing most interacted clubs';
COMMENT ON FUNCTION public.update_user_engagement IS 'Recalculates all engagement metrics for a user';
