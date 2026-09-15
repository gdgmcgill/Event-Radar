-- =============================================
-- Migration: club_roles_and_invitations
-- Phase: 05-database-foundation
-- Requirements: DBROLE-01, DBROLE-02, DBROLE-03, DBROLE-04, DBROLE-05, DBROLE-07
-- (DBROLE-06 is handled in src/app/api/admin/clubs/[id]/route.ts)
--
-- Purpose: Add owner/organizer role distinction to club_members,
--          a SECURITY DEFINER helper function, owner-scoped RLS policies,
--          performance index, and the club_invitations table.
-- Idempotent: safe to re-run.
-- =============================================


-- =============================================
-- SECTION 1 — Backfill existing club creators to owner role (DBROLE-01 prerequisite)
-- Runs BEFORE the CHECK constraint so the UPDATE normalises any 'organizer' rows
-- that belong to the club creator. Running again is a no-op (owner → owner).
-- =============================================

UPDATE public.club_members
SET role = 'owner'
WHERE (user_id, club_id) IN (
  SELECT created_by, id FROM public.clubs
  WHERE status = 'approved' AND created_by IS NOT NULL
);


-- =============================================
-- SECTION 2 — DBROLE-01: CHECK constraint on club_members.role
-- Allows only 'owner' and 'organizer'. Uses a DO block so it is idempotent.
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'club_members'
      AND constraint_name = 'club_members_role_check'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_role_check
      CHECK (role IN ('owner', 'organizer'));
  END IF;
END $$;


-- =============================================
-- SECTION 3 — DBROLE-02: is_club_owner() SECURITY DEFINER function
-- Checks whether the calling user is an 'owner' of the given club.
-- SECURITY DEFINER + SET search_path prevent RLS infinite recursion.
-- Pattern mirrors is_admin() from 011_rls_audit.sql.
-- =============================================

CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;


-- =============================================
-- SECTION 4 — DBROLE-05: Composite index on club_members(club_id, role)
-- Speeds up is_club_owner() lookups and owner-filtered queries.
-- =============================================

CREATE INDEX IF NOT EXISTS idx_club_members_club_role
  ON public.club_members(club_id, role);


-- =============================================
-- SECTION 5 — DBROLE-03: Owner cross-row SELECT policy on club_members
-- Lets the club owner see ALL members of their club (not just themselves).
-- Does NOT modify or drop existing "Users see own memberships" or
-- "Admins manage memberships" policies.
-- =============================================

DROP POLICY IF EXISTS "Club owners can view all club members" ON public.club_members;

CREATE POLICY "Club owners can view all club members"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));


-- =============================================
-- SECTION 6 — DBROLE-04: Owner DELETE policy with self-removal guard
-- Club owner can remove any member except themselves.
-- The (select auth.uid()) wrapper is required for initPlan caching.
-- =============================================

DROP POLICY IF EXISTS "Club owners can remove members" ON public.club_members;

CREATE POLICY "Club owners can remove members"
  ON public.club_members
  FOR DELETE
  TO authenticated
  USING (is_club_owner(club_id) AND user_id != (select auth.uid()));


-- =============================================
-- SECTION 7 — DBROLE-07: club_invitations table
-- Stores pending/accepted/expired/revoked invite tokens sent by club owners.
-- =============================================

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email TEXT       NOT NULL,
  token        UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_club_invitations_club_id
  ON public.club_invitations(club_id);

CREATE INDEX IF NOT EXISTS idx_club_invitations_token
  ON public.club_invitations(token);

CREATE INDEX IF NOT EXISTS idx_club_invitations_email
  ON public.club_invitations(invitee_email);

-- RLS Policies
DROP POLICY IF EXISTS "Club owners can view club invitations" ON public.club_invitations;

CREATE POLICY "Club owners can view club invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));

DROP POLICY IF EXISTS "Club owners can create club invitations" ON public.club_invitations;

CREATE POLICY "Club owners can create club invitations"
  ON public.club_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_club_owner(club_id));

-- Comments
COMMENT ON TABLE public.club_invitations IS
  'Pending and historical invitations sent by club owners to prospective members. Tokens expire after 7 days.';

COMMENT ON COLUMN public.club_invitations.token IS
  'Unique UUID token included in the invite link. Used for accept/revoke flows.';
