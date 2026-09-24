-- =============================================================================
-- 20260923120000_events_insert_club_scope.sql
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-11
-- F-008 · DEC-42 · 05-RESEARCH.md C10
--
-- FIX FORWARD, NEVER EDIT IN PLACE. `20260915214553_baseline.sql` created the
-- policy this file replaces and is not touched. A migration that has been
-- applied anywhere is a historical record; editing one makes two environments
-- that ran "the same" migration diverge with nothing in the history to say so.
-- The policy below is DROP POLICY IF EXISTS followed by CREATE POLICY, and the
-- helper is CREATE OR REPLACE, so this file supersedes the baseline definition
-- and is idempotent on its own.
--
-- BLAST RADIUS, STATED PLAINLY. The repository's post-baseline migrations exist
-- locally only; the production migration-history repair is deferred (DI-23,
-- F-045). So this changes no production behaviour today. It changes what every
-- environment built from this repository gets from now on. F-008 stays Open in
-- the register until the DI-23 repair applies this file to production
-- (DEC-57), with `closes_in_phase: "08"`.
--
-- =============================================================================
-- WHAT WAS WRONG (F-008)
-- =============================================================================
--
-- The baseline policy was
--
--   CREATE POLICY "Authenticated users can insert events" ON public.events
--     FOR INSERT TO authenticated WITH CHECK (true);
--
-- so any signed-in user could send, with their own anon-key JWT:
--
--   POST /rest/v1/events
--   {"title":"…","club_id":"<any club>","created_by":"<any user>",
--    "status":"approved", …}
--
-- and publish an APPROVED event under another club, attributed to another
-- user, skipping moderation entirely. Measured on the local stack in plan 05-09
-- (`evidence/rls-ring-before.txt` P1 and P2: `INSERT 0 1` twice, as
-- cross_club_attacker, once with a forged creator and once self-approving into
-- a club they are not a member of). The authz ring (`POST /api/events/create`)
-- already refused both; the RLS ring did not.
--
-- =============================================================================
-- WHAT THE POLICY NOW SAYS (DEC-42)
-- =============================================================================
--
--   is_admin()                                   -- the admin arm
--   OR (    created_by = the caller                -- no forged creator
--       AND (   status = 'pending'                 -- anyone may propose
--            OR (    status = 'approved'           -- approval only for
--                AND club_id IS NOT NULL          --   a member of an
--                AND is_club_member(club_id)      --   APPROVED club
--                AND <club_id is approved>)))
--
-- * The admin arm is load-bearing: `POST /api/admin/events` inserts with no
--   `created_by` (src/app/api/admin/events/route.ts), and an admin creating
--   through `POST /api/events/create` is auto-approved whatever the club.
-- * The approval arm mirrors the handler's own auto-approve rule
--   (src/app/api/events/create/route.ts): a member (any club_members role) of
--   an approved club gets `approved`; everyone else gets `pending`.
-- * A PENDING event may still name a club the caller does not belong to. That
--   is today's product behaviour at both rings (a student proposing an event
--   for a club), no finding asks to change it, and moderation still sees it
--   (DEC-42, research Open Question 2). Do not tighten it here.
-- * Any other status (`rejected`, `suspended`) on insert is refused to
--   non-admins, which no handler ever sends.
-- =============================================================================


-- =============================================================================
-- 1. Helper: is the CALLER a member of this club, in any role?
--
--    SECURITY DEFINER so the check does not depend on the caller's own
--    club_members SELECT visibility (which is "own rows, or every row of a club
--    you own"). The body reads only the caller's own membership — `auth.uid()`,
--    never a parameter — so it discloses nothing the caller cannot already see.
--    `SET search_path = ''` with a fully qualified body closes the mutable
--    search_path hole a SECURITY DEFINER function otherwise has (T-05-11-06).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.club_members cm
     WHERE cm.club_id = p_club_id
       AND cm.user_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION public.is_club_member(uuid) IS
  'True when the CALLING user (auth.uid(), never a parameter) holds any '
  'club_members row for this club. Used by the events INSERT policy so only a '
  'member of an approved club can insert an approved event into it (F-008, '
  'DEC-42).';

REVOKE ALL     ON FUNCTION public.is_club_member(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.is_club_member(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_club_member(uuid) TO authenticated, service_role;


-- =============================================================================
-- 2. The events INSERT policy — F-008
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
CREATE POLICY "Authenticated users can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = (SELECT auth.uid())
      AND (
        status = 'pending'
        OR (
          status = 'approved'
          AND club_id IS NOT NULL
          AND public.is_club_member(club_id)
          AND EXISTS (
            SELECT 1
              FROM public.clubs c
             WHERE c.id = events.club_id
               AND c.status = 'approved'
          )
        )
      )
    )
  );
