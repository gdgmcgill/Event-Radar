-- New tables for recommendation engine
-- user_event_scores: precomputed personalized scores per user per event
CREATE TABLE IF NOT EXISTS user_event_scores (
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  score       float NOT NULL,
  breakdown   jsonb NOT NULL DEFAULT '{}',
  scored_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_scores_user_score
  ON user_event_scores (user_id, score DESC);

-- tag_interaction_counts: precomputed rollup of interactions by tag per user
CREATE TABLE IF NOT EXISTS tag_interaction_counts (
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tag              text NOT NULL,
  save_count       int NOT NULL DEFAULT 0,
  click_count      int NOT NULL DEFAULT 0,
  view_count       int NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  PRIMARY KEY (user_id, tag)
);

-- Add inferred_tags column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS inferred_tags text[] NOT NULL DEFAULT '{}';

-- RLS policies
ALTER TABLE user_event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_interaction_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own scores"
  ON user_event_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all scores"
  ON user_event_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read their own tag counts"
  ON tag_interaction_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tag counts"
  ON tag_interaction_counts FOR ALL
  USING (auth.role() = 'service_role');
