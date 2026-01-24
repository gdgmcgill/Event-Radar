-- =============================================
-- User Interactions Table
-- Track all user interactions with events
-- =============================================

-- =============================================
-- USER_INTERACTIONS TABLE
-- Stores individual interaction events for analytics
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (
    interaction_type IN ('view', 'click', 'save', 'unsave', 'share', 'calendar_add')
  ),
  session_id TEXT,
  source TEXT CHECK (
    source IS NULL OR source IN ('home', 'search', 'recommendation', 'calendar', 'direct', 'modal')
  ),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- Optimize common query patterns
-- =============================================

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id
  ON public.user_interactions(user_id);

-- Index for querying by event
CREATE INDEX IF NOT EXISTS idx_user_interactions_event_id
  ON public.user_interactions(event_id);

-- Index for querying by type
CREATE INDEX IF NOT EXISTS idx_user_interactions_type
  ON public.user_interactions(interaction_type);

-- Index for time-based queries (trending calculations)
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at
  ON public.user_interactions(created_at DESC);

-- Composite index for user + event queries
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_event
  ON public.user_interactions(user_id, event_id);

-- Composite index for trending calculations (type + time)
CREATE INDEX IF NOT EXISTS idx_user_interactions_type_time
  ON public.user_interactions(interaction_type, created_at DESC);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.user_interactions IS 'Tracks all user interactions with events for analytics and recommendations';
COMMENT ON COLUMN public.user_interactions.interaction_type IS 'Type of interaction: view, click, save, unsave, share, calendar_add';
COMMENT ON COLUMN public.user_interactions.source IS 'Where the interaction originated: home, search, recommendation, calendar, direct, modal';
COMMENT ON COLUMN public.user_interactions.session_id IS 'Optional session identifier for grouping interactions';
COMMENT ON COLUMN public.user_interactions.metadata IS 'Additional context data in JSON format';
