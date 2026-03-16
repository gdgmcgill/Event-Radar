-- =============================================================================
-- Post-audit fixes: constraints, indexes, RLS policies
-- =============================================================================

-- 1. Moderation reviews: allow suspension/unsuspension actions
-- Drop the old CHECK and recreate with expanded values
ALTER TABLE moderation_reviews DROP CONSTRAINT IF EXISTS moderation_reviews_action_check;
ALTER TABLE moderation_reviews ADD CONSTRAINT moderation_reviews_action_check
  CHECK (action IN ('rejection', 'appeal', 'approval', 'suspension', 'unsuspension'));

-- 2. appeal_count >= 0 CHECK constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_appeal_count_non_negative;
ALTER TABLE events ADD CONSTRAINT chk_events_appeal_count_non_negative
  CHECK (appeal_count >= 0);

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS chk_clubs_appeal_count_non_negative;
ALTER TABLE clubs ADD CONSTRAINT chk_clubs_appeal_count_non_negative
  CHECK (appeal_count >= 0);

-- 3. Missing indexes
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_event_reports_reporter_id ON event_reports(reporter_id);

-- 4. event_invites: add DELETE policy so inviter/invitee can cancel invites
CREATE POLICY "Users can delete own invites"
  ON public.event_invites FOR DELETE
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- 5. featured_clubs: create table if missing, enable RLS, add policies
CREATE TABLE IF NOT EXISTS public.featured_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sponsor_name text,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  UNIQUE(club_id, start_date)
);

ALTER TABLE public.featured_clubs ENABLE ROW LEVEL SECURITY;

-- Public can read active featured clubs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'featured_clubs' AND policyname = 'Public can read active featured clubs'
  ) THEN
    CREATE POLICY "Public can read active featured clubs"
      ON public.featured_clubs FOR SELECT
      USING (is_active = true AND end_date > now());
  END IF;
END $$;

-- Admins can manage featured clubs (uses service role, but policy for completeness)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'featured_clubs' AND policyname = 'Admins can manage featured clubs'
  ) THEN
    CREATE POLICY "Admins can manage featured clubs"
      ON public.featured_clubs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(roles)
        )
      );
  END IF;
END $$;
