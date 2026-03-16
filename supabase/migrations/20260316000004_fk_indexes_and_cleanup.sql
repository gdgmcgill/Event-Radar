-- Add missing indexes on foreign key columns for query performance
-- and clean up orphaned test table.

-- =============================================
-- FK indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_club_invitations_inviter_id
  ON public.club_invitations (inviter_id);

CREATE INDEX IF NOT EXISTS idx_event_reports_reviewed_by
  ON public.event_reports (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_featured_clubs_club_id
  ON public.featured_clubs (club_id);

CREATE INDEX IF NOT EXISTS idx_featured_clubs_created_by
  ON public.featured_clubs (created_by);

CREATE INDEX IF NOT EXISTS idx_featured_events_created_by
  ON public.featured_events (created_by);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON public.feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_club_id
  ON public.notifications (club_id);

CREATE INDEX IF NOT EXISTS idx_organizer_requests_reviewed_by
  ON public.organizer_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_users_banned_by
  ON public.users (banned_by);

-- =============================================
-- Drop orphaned test table (has RLS enabled but zero policies)
-- =============================================

DROP TABLE IF EXISTS public.events_tests;
