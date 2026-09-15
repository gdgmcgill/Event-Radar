-- Migration: feedback_request_log
-- Prevents duplicate feedback notifications per user per event.
-- The UNIQUE constraint on (user_id, event_id, request_type) is the hard guard;
-- the cron also does a pre-send lookup to skip already-logged rows.

CREATE TABLE feedback_request_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  request_type  TEXT        NOT NULL DEFAULT 'post_event' CHECK (request_type IN ('post_event', 'post_event_reminder')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, request_type)
);

-- Index to speed up the pre-send dedup lookup (filter by request_type + event_id)
CREATE INDEX feedback_request_log_type_event_idx
  ON feedback_request_log (request_type, event_id);

-- Index on event_id for future aggregate queries
CREATE INDEX feedback_request_log_event_idx
  ON feedback_request_log (event_id);

-- RLS: internal log — service role handles all writes (bypasses RLS).
-- Users can only read their own entries; no direct write access.
ALTER TABLE feedback_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback request log"
  ON feedback_request_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage feedback request log"
  ON feedback_request_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
