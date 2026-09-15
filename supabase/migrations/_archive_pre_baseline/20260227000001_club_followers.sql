-- Phase 9: Follow System — club_followers table + RLS policies
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS public.club_followers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_followers_unique UNIQUE (user_id, club_id)
);

ALTER TABLE public.club_followers ENABLE ROW LEVEL SECURITY;

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_club_followers_club_id ON public.club_followers(club_id);
CREATE INDEX IF NOT EXISTS idx_club_followers_user_id ON public.club_followers(user_id);

-- RLS Policies:

-- 1. Public SELECT — anyone (including anon) can read follower rows
-- This enables public follower count. API routes control what data is exposed.
DROP POLICY IF EXISTS "Anyone can view follower data" ON public.club_followers;
CREATE POLICY "Anyone can view follower data"
  ON public.club_followers
  FOR SELECT
  USING (true);

-- 2. Authenticated users can follow (INSERT their own rows)
DROP POLICY IF EXISTS "Authenticated users can follow clubs" ON public.club_followers;
CREATE POLICY "Authenticated users can follow clubs"
  ON public.club_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Authenticated users can unfollow (DELETE their own rows)
DROP POLICY IF EXISTS "Authenticated users can unfollow clubs" ON public.club_followers;
CREATE POLICY "Authenticated users can unfollow clubs"
  ON public.club_followers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
