-- Thumbs up/down feedback: one row per user per event (feedback_type = positive | negative)
-- Run in Supabase SQL Editor if not using CLI

CREATE TABLE IF NOT EXISTS recommendation_explicit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_explicit_feedback_user_id
  ON recommendation_explicit_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_explicit_feedback_event_id
  ON recommendation_explicit_feedback(event_id);

ALTER TABLE recommendation_explicit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own explicit feedback"
  ON recommendation_explicit_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own explicit feedback"
  ON recommendation_explicit_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own explicit feedback"
  ON recommendation_explicit_feedback FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE recommendation_explicit_feedback IS 'Thumbs up/down per user per event; one row per (user_id, event_id)';
