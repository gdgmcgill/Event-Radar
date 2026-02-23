-- Migration: notifications_rls_and_dedup
-- Adds RLS policies, UNIQUE dedup index, and performance indexes
-- to the notifications table (created in 007_add_created_by_and_notifications.sql).
--
-- Safe to run idempotently: uses IF NOT EXISTS and DO blocks to skip
-- already-existing objects.

-- Enable RLS (idempotent: safe to call if already enabled)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT only their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users can view own notifications'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own notifications"
        ON public.notifications FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;

-- Policy 2: Users can UPDATE only their own rows (to mark read)
-- Column-level restriction enforced in API route by only updating the `read` column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users can mark own notifications read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can mark own notifications read"
        ON public.notifications FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;

-- No INSERT policy for authenticated role.
-- Service role (used by cron and admin routes via createServiceClient()) bypasses
-- RLS entirely. Omitting an INSERT policy blocks any direct browser client INSERT.

-- UNIQUE dedup index: prevent duplicate notifications from cron retries.
-- Covers event_reminder_24h, event_reminder_1h, event_approved, event_rejected.
-- Uses partial index (WHERE event_id IS NOT NULL) because standard UNIQUE constraints
-- treat multiple NULLs as distinct values in PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_idx
  ON public.notifications (user_id, event_id, type)
  WHERE event_id IS NOT NULL;

-- Performance indexes (naming convention: {table}_{column(s)}_idx)
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read)
  WHERE read = FALSE;
