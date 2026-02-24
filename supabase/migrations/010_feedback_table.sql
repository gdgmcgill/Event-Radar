-- Feedback table for beta testers to report bugs and suggestions
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('bug', 'feature', 'general')),
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying feedback
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- RLS policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit feedback
CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous feedback via service role (API route handles this)
CREATE POLICY "Service role full access"
  ON feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read all feedback
CREATE POLICY "Admins can read feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );
