-- Migration: event_reports
-- Tracks user-submitted reports against events for moderation review.

CREATE TABLE event_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL CHECK (category IN (
    'inappropriate_content', 'missing_information', 'duplicate',
    'policy_violation', 'incorrect_details', 'other'
  )),
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID        REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, reporter_id)
);

-- Indexes for common query patterns
CREATE INDEX event_reports_event_idx ON event_reports (event_id);
CREATE INDEX event_reports_status_idx ON event_reports (status);

-- RLS
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reports"
  ON event_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON event_reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Service role has full access to event_reports"
  ON event_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
