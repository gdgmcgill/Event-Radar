-- =============================================
-- Event Popularity Scores Table
-- Pre-computed popularity metrics for events
-- =============================================

-- =============================================
-- EVENT_POPULARITY_SCORES TABLE
-- Stores aggregated popularity metrics
-- =============================================
CREATE TABLE IF NOT EXISTS public.event_popularity_scores (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  calendar_add_count INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  popularity_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  trending_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- Optimize sorting and filtering by scores
-- =============================================

-- Index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_event_popularity_score
  ON public.event_popularity_scores(popularity_score DESC);

-- Index for sorting by trending
CREATE INDEX IF NOT EXISTS idx_event_trending_score
  ON public.event_popularity_scores(trending_score DESC);

-- Index for finding stale scores
CREATE INDEX IF NOT EXISTS idx_event_popularity_last_calc
  ON public.event_popularity_scores(last_calculated_at);

-- =============================================
-- FUNCTION: Calculate Popularity Score
-- Computes the weighted popularity score for an event
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_popularity_score(
  p_view_count INTEGER,
  p_click_count INTEGER,
  p_save_count INTEGER,
  p_share_count INTEGER,
  p_calendar_add_count INTEGER,
  p_unique_viewers INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  -- Weights: view=1, click=2, save=5, share=4, calendar_add=3, unique_viewers=0.5
  RETURN (
    (p_view_count * 1) +
    (p_click_count * 2) +
    (p_save_count * 5) +
    (p_share_count * 4) +
    (p_calendar_add_count * 3) +
    (p_unique_viewers * 0.5)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- FUNCTION: Calculate Trending Score
-- Computes time-decayed score (72-hour half-life)
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_trending_score(p_event_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_interaction RECORD;
  v_weight DECIMAL;
  v_hours_ago DECIMAL;
  v_decay_factor DECIMAL;
BEGIN
  -- Weight mapping for interaction types
  FOR v_interaction IN
    SELECT
      interaction_type,
      created_at,
      CASE interaction_type
        WHEN 'view' THEN 1
        WHEN 'click' THEN 2
        WHEN 'save' THEN 5
        WHEN 'share' THEN 4
        WHEN 'calendar_add' THEN 3
        ELSE 0
      END as weight
    FROM public.user_interactions
    WHERE event_id = p_event_id
      AND created_at > NOW() - INTERVAL '7 days'
      AND interaction_type != 'unsave'
  LOOP
    -- Calculate hours since interaction
    v_hours_ago := EXTRACT(EPOCH FROM (NOW() - v_interaction.created_at)) / 3600;

    -- Apply exponential decay with 72-hour half-life
    -- decay = 0.5^(hours_ago / 72)
    v_decay_factor := POWER(0.5, v_hours_ago / 72);

    -- Add weighted, decayed score
    v_score := v_score + (v_interaction.weight * v_decay_factor);
  END LOOP;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Update Event Popularity
-- Recalculates all metrics for a single event
-- =============================================
CREATE OR REPLACE FUNCTION public.update_event_popularity(p_event_id UUID)
RETURNS VOID AS $$
DECLARE
  v_view_count INTEGER;
  v_click_count INTEGER;
  v_save_count INTEGER;
  v_share_count INTEGER;
  v_calendar_add_count INTEGER;
  v_unique_viewers INTEGER;
  v_popularity_score DECIMAL;
  v_trending_score DECIMAL;
BEGIN
  -- Count each interaction type
  SELECT
    COALESCE(SUM(CASE WHEN interaction_type = 'view' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'click' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'save' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'share' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN interaction_type = 'calendar_add' THEN 1 ELSE 0 END), 0),
    COUNT(DISTINCT user_id)
  INTO
    v_view_count, v_click_count, v_save_count,
    v_share_count, v_calendar_add_count, v_unique_viewers
  FROM public.user_interactions
  WHERE event_id = p_event_id
    AND interaction_type != 'unsave';

  -- Calculate scores
  v_popularity_score := public.calculate_popularity_score(
    v_view_count, v_click_count, v_save_count,
    v_share_count, v_calendar_add_count, v_unique_viewers
  );

  v_trending_score := public.calculate_trending_score(p_event_id);

  -- Upsert the popularity record
  INSERT INTO public.event_popularity_scores (
    event_id, view_count, click_count, save_count, share_count,
    calendar_add_count, unique_viewers, popularity_score, trending_score, last_calculated_at
  ) VALUES (
    p_event_id, v_view_count, v_click_count, v_save_count, v_share_count,
    v_calendar_add_count, v_unique_viewers, v_popularity_score, v_trending_score, NOW()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    view_count = EXCLUDED.view_count,
    click_count = EXCLUDED.click_count,
    save_count = EXCLUDED.save_count,
    share_count = EXCLUDED.share_count,
    calendar_add_count = EXCLUDED.calendar_add_count,
    unique_viewers = EXCLUDED.unique_viewers,
    popularity_score = EXCLUDED.popularity_score,
    trending_score = EXCLUDED.trending_score,
    last_calculated_at = EXCLUDED.last_calculated_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.event_popularity_scores IS 'Pre-computed popularity metrics for events, updated periodically';
COMMENT ON COLUMN public.event_popularity_scores.popularity_score IS 'Weighted sum of all interactions (all-time)';
COMMENT ON COLUMN public.event_popularity_scores.trending_score IS 'Time-decayed score emphasizing recent interactions';
COMMENT ON FUNCTION public.calculate_popularity_score IS 'Computes weighted popularity: view=1, click=2, save=5, share=4, calendar=3, unique=0.5';
COMMENT ON FUNCTION public.calculate_trending_score IS 'Computes time-decayed trending score with 72-hour half-life';
COMMENT ON FUNCTION public.update_event_popularity IS 'Recalculates all popularity metrics for a single event';
