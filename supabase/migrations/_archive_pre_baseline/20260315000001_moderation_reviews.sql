-- Add appeal_count to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS appeal_count integer NOT NULL DEFAULT 0;

-- Add appeal_count to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS appeal_count integer NOT NULL DEFAULT 0;

-- Add club_id to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE;

-- Create moderation_reviews table
CREATE TABLE moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event', 'club')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('rejection', 'appeal', 'approval')),
  category text CHECK (
    category IN ('inappropriate_content', 'missing_information', 'duplicate', 'policy_violation', 'incorrect_details', 'other')
  ),
  message text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Enforce: rejections must have category, appeals/approvals must not
  CONSTRAINT category_required_for_rejection CHECK (
    (action = 'rejection' AND category IS NOT NULL) OR
    (action IN ('appeal', 'approval') AND category IS NULL)
  )
);

-- Index for fetching review threads
CREATE INDEX idx_moderation_reviews_target ON moderation_reviews (target_type, target_id, created_at);

-- RLS policies
ALTER TABLE moderation_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access" ON moderation_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );

-- Creators can view reviews of their items
CREATE POLICY "Creators can view reviews of their items" ON moderation_reviews
  FOR SELECT USING (
    (target_type = 'event' AND EXISTS (
      SELECT 1 FROM events WHERE id = target_id AND created_by = auth.uid()
    ))
    OR
    (target_type = 'club' AND EXISTS (
      SELECT 1 FROM clubs WHERE id = target_id AND created_by = auth.uid()
    ))
  );

-- Creators can insert appeal rows for their items
CREATE POLICY "Creators can appeal their items" ON moderation_reviews
  FOR INSERT WITH CHECK (
    action = 'appeal'
    AND author_id = auth.uid()
    AND (
      (target_type = 'event' AND EXISTS (
        SELECT 1 FROM events WHERE id = target_id AND created_by = auth.uid()
      ))
      OR
      (target_type = 'club' AND EXISTS (
        SELECT 1 FROM clubs WHERE id = target_id AND created_by = auth.uid()
      ))
    )
  );
