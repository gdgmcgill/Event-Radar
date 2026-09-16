-- =============================================================================
-- 20260916000000_invitation_policy_fixes.sql
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit
-- Fix-forward for 03-REVIEW.md CR-04, WR-01 and WR-02
--
-- FIX FORWARD, NEVER EDIT IN PLACE. `20260915230000_fk_indexes_and_policy_gaps.sql`
-- is not touched by this file. A migration that has been applied anywhere is a
-- historical record; editing one makes two environments that ran "the same"
-- migration diverge with nothing in the history to say so. Every policy below
-- is DROP POLICY IF EXISTS followed by CREATE POLICY, so this file both
-- supersedes the earlier definitions and is idempotent on its own.
--
-- BLAST RADIUS, STATED PLAINLY. Neither this file nor its predecessor has been
-- applied to production: the repository's post-baseline migrations exist
-- locally only, and the production history repair is deferred (DI-23, F-045).
-- So this changes no production behaviour today. It changes what every
-- environment built from this repository gets from now on, which is the thing
-- the baseline made true of migrations in this tree.
--
-- =============================================================================
-- WHAT WAS WRONG
-- =============================================================================
--
-- CR-04 — the invitee UPDATE policy pinned two columns and left four loose.
--   WITH CHECK constrained `invitee_email` and `status`. `club_id`,
--   `inviter_id`, `token` and `expires_at` were unconstrained, so the holder of
--   ANY pending invitation could send, with their own anon-key JWT:
--
--     PATCH /rest/v1/club_invitations?id=eq.<their invite>
--     {"status":"accepted","club_id":"<any club uuid>"}
--
--   The row passes USING (theirs, pending) and passes WITH CHECK (still theirs,
--   now accepted). `src/app/invites/[token]/page.tsx` then reads
--   `invitation.club_id` and inserts a `club_members` row for whatever club the
--   row now names: the escalation path from "invited to club A" to "member of
--   club B". A partial miss of the plan's own registered threat T-03-05-07.
--
--   USING also omitted the expiry, so an invitation the application treats as
--   dead after seven days (`page.tsx`, "Invitation Expired") was still
--   `pending` at the policy tier and stayed accept-able forever.
--
-- WR-01 — the accept path could not complete at all. `club_members` carries no
--   INSERT policy any invitee satisfies (baseline: admins ALL, owners
--   DELETE/SELECT, users SELECT own), so `memberResult.error` was always set
--   and the page rendered "Something Went Wrong". The three earlier policies
--   were necessary and not sufficient.
--
--   That gap was also the only thing blunting CR-04 — which means CR-04 goes
--   live the moment WR-01 is fixed. They are therefore fixed in ONE file, and
--   the `club_members` INSERT policy below is deliberately the narrowest thing
--   that makes acceptance work.
--
-- WR-02 — the policies compared emails case-sensitively; the application does
--   not. `public.users.email` is written straight from `user.email` with no
--   normalisation (`src/app/auth/callback/route.ts`), while
--   `src/app/invites/[token]/page.tsx` compares
--   `user.email?.toLowerCase() !== invitation.invitee_email.toLowerCase()`.
--   One mixed-case row in `users.email` made the invitation invisible to its
--   own recipient — reproducing the exact F-016 symptom this series exists to
--   remove, silently, in USING-filter shape: zero rows, no error.
--
-- =============================================================================
-- WHY TWO SECURITY DEFINER HELPERS, AND WHY THEY ARE NOT THE CR-01/CR-05 SHAPE
-- =============================================================================
--
-- A policy on `club_invitations` cannot read `club_invitations` in a subquery:
-- Postgres re-applies the table's own policies to that reference and raises
-- `infinite recursion detected in policy for relation`. The same problem, one
-- table over, applies to a `club_members` policy that needs to consult
-- `club_invitations` — it would then depend on the invitation SELECT policy, so
-- a future narrowing of one policy would silently change the other.
--
-- The baseline's own answer to this is `public.is_club_owner()`: a SECURITY
-- DEFINER helper whose queries run as the table owner and therefore bypass RLS.
-- These two follow that precedent, and they are built to the rules CR-01 and
-- CR-05 say the inherited five broke:
--
--   * DERIVE THE SUBJECT FROM THE SESSION. Neither takes a user id. Both read
--     `(SELECT auth.uid())` internally, so neither can be pointed at somebody
--     else — which is precisely the defect that makes `get_friends(uuid)` an
--     IDOR (registered as F-074).
--   * `SET search_path = ''` AND FULLY QUALIFIED BODIES, so a schema-creation
--     privilege anywhere in the cluster cannot redirect a relation reference
--     (the `function_search_path_mutable` class; registered as F-076).
--   * `REVOKE EXECUTE FROM PUBLIC, anon`. `authenticated` is the only grantee,
--     because an anonymous caller has no invitation to ask about.
--   * BOOLEAN RETURNS, NOT ROW RETURNS. Neither discloses a column. The worst
--     an authenticated caller can do with them is confirm a guess it already
--     had to make.
-- =============================================================================


-- =============================================================================
-- 1. Helper: did this UPDATE change anything other than `status`?
--
--    Called from WITH CHECK with the NEW row's columns. It compares them
--    against the row as STORED — the subquery runs under the statement's
--    snapshot and therefore does not see the update in progress — and returns
--    false the moment any of the six immutable columns differs.
--
--    This is the "constrain the mutable set to `status` only" form rather than
--    a column-by-column pin, because a column-by-column pin is a list that goes
--    stale: add a seventh column to `club_invitations` tomorrow and a pin-list
--    silently stops covering it. This signature does not — adding a column
--    without adding it here is a compile-time-visible omission in one place.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.club_invitation_unchanged_except_status(
  p_id            uuid,
  p_club_id       uuid,
  p_inviter_id    uuid,
  p_invitee_email text,
  p_token         uuid,
  p_expires_at    timestamptz,
  p_created_at    timestamptz
) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.club_invitations ci
     WHERE ci.id            = p_id
       AND ci.club_id       = p_club_id
       AND ci.inviter_id    = p_inviter_id
       AND ci.invitee_email = p_invitee_email
       AND ci.token         = p_token
       AND ci.expires_at    = p_expires_at
       AND ci.created_at    = p_created_at
  );
$$;

COMMENT ON FUNCTION public.club_invitation_unchanged_except_status(
  uuid, uuid, uuid, text, uuid, timestamptz, timestamptz
) IS
  'True when the supplied values match the stored club_invitations row on every '
  'column except status. Used by the invitee accept and owner revoke WITH CHECK '
  'clauses so an UPDATE can change status and nothing else (03-REVIEW.md CR-04).';

REVOKE ALL     ON FUNCTION public.club_invitation_unchanged_except_status(
  uuid, uuid, uuid, text, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.club_invitation_unchanged_except_status(
  uuid, uuid, uuid, text, uuid, timestamptz, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.club_invitation_unchanged_except_status(
  uuid, uuid, uuid, text, uuid, timestamptz, timestamptz) TO authenticated, service_role;


-- =============================================================================
-- 2. Helper: does the CALLER hold an open invitation to this club?
--
--    "Open" is `pending` OR `accepted`, and not expired. Both statuses are
--    admitted deliberately: `src/app/invites/[token]/page.tsx` issues the
--    membership INSERT and the status UPDATE inside a single `Promise.all`, so
--    the two race. A policy that required `status = 'accepted'` would pass or
--    fail depending on which request PostgREST happened to finish first, which
--    is the worst possible property for an access-control rule to have.
--
--    Admitting `pending` widens nothing that matters: the caller is the named
--    recipient of a live invitation to that club either way, and joining is the
--    only thing the invitation is for.
--
--    Email comparison is `lower()` on both sides — WR-02.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_open_club_invitation(p_club_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.club_invitations ci
      JOIN public.users u ON u.id = (SELECT auth.uid())
     WHERE ci.club_id = p_club_id
       AND lower(ci.invitee_email) = lower(u.email)
       AND ci.status IN ('pending', 'accepted')
       AND ci.expires_at > now()
  );
$$;

COMMENT ON FUNCTION public.has_open_club_invitation(uuid) IS
  'True when the CALLING user (auth.uid(), never a parameter) is the named '
  'recipient of a live, unexpired invitation to this club. Used by the '
  'club_members INSERT policy so an invitee can complete acceptance '
  '(03-REVIEW.md WR-01).';

REVOKE ALL     ON FUNCTION public.has_open_club_invitation(uuid) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.has_open_club_invitation(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.has_open_club_invitation(uuid) TO authenticated, service_role;


-- =============================================================================
-- 3. Keep the case-insensitive predicate indexable — WR-02
--
--    `lower(invitee_email) = lower(...)` cannot use a plain b-tree on
--    `invitee_email`. Without this expression index every invitee policy
--    evaluation is a sequential scan of the table, per candidate row.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_club_invitations_email_lower
  ON public.club_invitations (lower(invitee_email));


-- =============================================================================
-- 4. The invitee SELECT policy, case-insensitively — WR-02
-- =============================================================================

DROP POLICY IF EXISTS "Invitees can view their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can view their own invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(invitee_email)
      = lower((SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid())))
  );


-- =============================================================================
-- 5. The invitee UPDATE policy — CR-04 and WR-02
--
--    USING  : their own invitation, still pending, AND NOT YET EXPIRED. The
--             expiry belongs here rather than in WITH CHECK because an expired
--             invitation should be invisible to the accept path, not rejected
--             by it — that is what makes the policy tier agree with
--             `src/app/invites/[token]/page.tsx`'s own expiry check.
--    CHECK  : still theirs, now accepted, and NOTHING ELSE MOVED.
-- =============================================================================

DROP POLICY IF EXISTS "Invitees can accept their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can accept their own invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (
    lower(invitee_email)
      = lower((SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid())))
    AND status = 'pending'
    AND expires_at > now()
  )
  WITH CHECK (
    lower(invitee_email)
      = lower((SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid())))
    AND status = 'accepted'
    AND public.club_invitation_unchanged_except_status(
          id, club_id, inviter_id, invitee_email, token, expires_at, created_at)
  );


-- =============================================================================
-- 6. The owner REVOKE policy gets the same immutability clause
--
--    NOT COSMETIC SYMMETRY. Multiple permissive policies on one command are
--    OR-ed, USING with USING and WITH CHECK with WITH CHECK. Without this
--    clause, a user who owns club B and holds a pending invitation to club A
--    could satisfy the invitee half of USING (their own pending row) and the
--    owner half of WITH CHECK (is_club_owner(NEW.club_id = B), status
--    'revoked') in one statement, repointing somebody's invitation from A to B.
--    It grants no membership, so it is destructive rather than an escalation —
--    and it is still a row moving between tenants, which is what T-03-05-07 is
--    about.
-- =============================================================================

DROP POLICY IF EXISTS "Club owners can update club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can update club invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (public.is_club_owner(club_id) AND status = 'pending')
  WITH CHECK (
    public.is_club_owner(club_id)
    AND status = 'revoked'
    AND public.club_invitation_unchanged_except_status(
          id, club_id, inviter_id, invitee_email, token, expires_at, created_at)
  );


-- =============================================================================
-- 7. The missing club_members INSERT policy — WR-01
--
--    THE NARROWEST RULE THAT MAKES ACCEPTANCE WORK. Three independent clauses,
--    each of which alone would leave a hole:
--
--      user_id = (SELECT auth.uid())   — only for themselves. Without it an
--                                        invitee could enrol anybody.
--      role    = 'organizer'           — the non-owning member role, and the
--                                        exact value `page.tsx` inserts.
--                                        `club_members_role_check` permits only
--                                        'owner' and 'organizer'; there is no
--                                        'member' in this schema. Without this
--                                        clause an invitation to a club would
--                                        be a grant of OWNERSHIP of it.
--      has_open_club_invitation(...)   — and only to a club that invited them,
--                                        by email, with a live invitation.
--
--    What this deliberately does NOT do: it does not let an invitee update or
--    delete a membership, does not let them join a club that merely exists, and
--    does not survive the invitation's expiry.
-- =============================================================================

DROP POLICY IF EXISTS "Invitees can join the club they were invited to" ON public.club_members;
CREATE POLICY "Invitees can join the club they were invited to"
  ON public.club_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'organizer'
    AND public.has_open_club_invitation(club_id)
  );
