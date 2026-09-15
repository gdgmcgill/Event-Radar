-- Recommendation feedback table for tracking impressions, clicks, saves, and dismissals
-- Run this migration in Supabase SQL editor or via Supabase CLI

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  recommendation_rank INTEGER NOT NULL CHECK (recommendation_rank >= 1),
  action TEXT NOT NULL CHECK (action IN ('impression', 'click', 'save', 'dismiss')),
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for analytics queries (by time and action)
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_created_at ON recommendation_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_action ON recommendation_feedback(action);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_user_created ON recommendation_feedback(user_id, created_at);

-- RLS: users can insert their own feedback; service role can read all for analytics
ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON recommendation_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback"
  ON recommendation_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Admin/analytics: use service role key or a separate policy for admin users
-- For now, analytics API uses server-side createClient() which may use service role
COMMENT ON TABLE recommendation_feedback IS 'Tracks recommendation impressions, clicks, saves, and dismissals for model quality metrics';
