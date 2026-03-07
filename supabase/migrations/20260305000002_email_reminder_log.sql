-- Migration: email_reminder_log
-- Prevents duplicate reminder notifications when the cron misfires or runs twice.
-- The UNIQUE constraint on (user_id, event_id, reminder_type) is the hard guard;
-- the cron also does a pre-send lookup to skip already-logged rows.

CREATE TABLE email_reminder_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      UUID        REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT        NOT NULL CHECK (reminder_type IN ('reminder_24h', 'reminder_1h')),
  sent_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, event_id, reminder_type)
);

-- Index to speed up the pre-send dedup lookup (filter by reminder_type + event_id)
CREATE INDEX email_reminder_log_type_event_idx
  ON email_reminder_log (reminder_type, event_id);

-- RLS: internal log — service role handles all writes (bypasses RLS).
-- Users can only read their own entries; no direct write access.
ALTER TABLE email_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminder log"
  ON email_reminder_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage reminder log"
  ON email_reminder_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
