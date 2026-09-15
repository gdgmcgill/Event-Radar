-- Reviews table migration
-- NOTE: This migration is a SQL file for reference. The actual table must be
-- created via the Supabase SQL editor by the user. Copy and paste this SQL
-- into the Supabase dashboard > SQL Editor and run it.

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_event_id ON reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_event ON reviews(user_id, event_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  -- Users can insert their own reviews
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_insert_own' AND tablename = 'reviews') THEN
    CREATE POLICY reviews_insert_own ON reviews
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Users can select their own reviews
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_select_own' AND tablename = 'reviews') THEN
    CREATE POLICY reviews_select_own ON reviews
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Club organizers can select reviews for their club's events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_select_organizer' AND tablename = 'reviews') THEN
    CREATE POLICY reviews_select_organizer ON reviews
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN club_members cm ON cm.club_id = e.club_id
          WHERE e.id = reviews.event_id
            AND cm.user_id = auth.uid()
        )
      );
  END IF;
END $$;
