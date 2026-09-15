-- =============================================
-- Phase 1: Club RLS and Schema Fixes
-- 1. Replace overly permissive club UPDATE policy with owner-only
-- 2. Ensure club_members.created_at column exists
-- 3. Add self-insertion policy on club_members for invite acceptance
-- =============================================

-- SECTION 1: Replace club UPDATE policy with owner-only
-- The existing policy "Clubs can be updated by authenticated users" allows
-- any authenticated user to update any club. Replace with owner-only.
DROP POLICY IF EXISTS "Clubs can be updated by authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "Club owners can update own club" ON public.clubs;

CREATE POLICY "Club owners can update own club"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (is_club_owner(id))
  WITH CHECK (is_club_owner(id));

-- SECTION 2: Ensure club_members.created_at exists (idempotent)
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- SECTION 3: Self-insertion policy for invite acceptance
-- Users need to insert their own membership row when accepting an invite.
-- Existing policies only allow admin ALL and self SELECT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_members'
      AND policyname = 'Users can insert own membership'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own membership"
      ON public.club_members
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;
