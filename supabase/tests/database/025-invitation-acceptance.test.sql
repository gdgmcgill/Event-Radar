-- =============================================================================
-- 025-invitation-acceptance.test.sql — the accept transaction, end to end, and
-- the four things an invitee must NOT be able to do while performing it.
--
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit
-- Covers 03-REVIEW.md CR-04, WR-01 and WR-02, against
-- supabase/migrations/20260916000000_invitation_policy_fixes.sql
--
-- WHY A SECOND FILE RATHER THAN MORE CASES IN 020
--   020 asserts three policies IN ISOLATION. Its own limitation is what let
--   WR-01 through: every one of its assertions can pass while the acceptance
--   TRANSACTION — update the invitation, insert the membership — remains
--   impossible, because it never performs that transaction. This file is
--   organised around the transaction instead, so "the three policies exist" and
--   "an invitee can actually join" are two different reds.
--
-- THE FIXTURE CARRIES THE BUG ON PURPOSE.
--   `users.email` for the invitee is stored MIXED CASE and every
--   `club_invitations.invitee_email` is stored lowercase. That is not tidiness —
--   it is WR-02 reproduced: `src/app/auth/callback/route.ts` writes
--   `user.email` with no normalisation while
--   `src/app/invites/[token]/page.tsx` compares with `.toLowerCase()` on both
--   sides. Under the case-SENSITIVE policies this file's very first ALLOW
--   returns zero rows, silently, which is exactly the F-016 symptom.
--
-- ASSERTION SHAPES, same contract as 020:
--   * a WITH CHECK violation raises 42501                → throws_ok
--   * a USING clause filters the row: no error, no rows  → is_empty, and then
--     an integrity assertion with RLS bypassed, because an empty result is
--     otherwise indistinguishable from a deleted row
--   * an ALLOW is never proven by a statement completing — a statement that
--     matched zero rows completes happily. Every allow uses RETURNING.
--
-- ORDER IS LOAD-BEARING. Every DENY runs BEFORE the successful accept, so no
-- deny can be satisfied by a UNIQUE(user_id, club_id) violation raised on a row
-- an earlier allow had already inserted — that would be a 23505 wearing a
-- passing test's clothes.
--
-- One transaction, rolled back. Nothing survives the file.
-- =============================================================================

BEGIN;
SELECT plan(18);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role, which owns these tables and bypasses
-- RLS. The fixture is a precondition, not a thing under test.
--
--   owner    — owns clubs A, B and C, and sent every invitation below
--   invitee  — addressee of the two live invitations to club A and of one
--              EXPIRED invitation to club C. Their stored email is mixed case.
--   stranger — authenticated, invited to nothing
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name) VALUES
  ('00000000-0000-4000-8000-000000000011', 'pgtap-invite-owner@mail.mcgill.ca',    'Invite Owner'),
  ('00000000-0000-4000-8000-000000000012', 'PgTap-Invite-Invitee@Mail.McGill.CA',  'Invite Invitee'),
  ('00000000-0000-4000-8000-000000000013', 'pgtap-invite-stranger@mail.mcgill.ca', 'Invite Stranger');

INSERT INTO public.clubs (id, name) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'pgTAP Invite Club A'),
  ('00000000-0000-4000-8000-0000000000d2', 'pgTAP Invite Club B'),
  ('00000000-0000-4000-8000-0000000000d3', 'pgTAP Invite Club C');

INSERT INTO public.club_members (user_id, club_id, role) VALUES
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000d1', 'owner'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000d2', 'owner'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000d3', 'owner');

INSERT INTO public.club_invitations
  (id, club_id, inviter_id, invitee_email, status, expires_at) VALUES
  -- live, club A — the one that gets accepted at the end
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-000000000011', 'pgtap-invite-invitee@mail.mcgill.ca',
   'pending', now() + interval '7 days'),
  -- live, club A — the one every tampering attempt is aimed at, so the accepted
  -- row above cannot mask a failure here
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-000000000011', 'pgtap-invite-invitee@mail.mcgill.ca',
   'pending', now() + interval '7 days'),
  -- EXPIRED, club C. Still `pending` in the status column — which is the whole
  -- point: the application calls this dead and the policy tier used to disagree.
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000d3',
   '00000000-0000-4000-8000-000000000011', 'pgtap-invite-invitee@mail.mcgill.ca',
   'pending', now() - interval '1 day');


-- -----------------------------------------------------------------------------
-- pg_temp.try_join — the ALLOW half of the membership insert, made ASSERTABLE.
--
-- WHY THIS EXISTS, AND WHY A BARE `results_eq(INSERT ... RETURNING ...)` DOES NOT
--   An RLS-denied INSERT RAISES. Inside a pgTAP file that means the surrounding
--   transaction aborts and every remaining assertion is skipped, so the run ends
--   as `Bad plan. You planned 18 tests but ran 16` — a red, but a red that
--   `scripts/pgtap-mutation-check.sh` correctly refuses to accept as proof,
--   because a plan error and a broken fixture look identical to it. The harness
--   caught precisely that when the club_members policy was first mutated out.
--
--   So the insert runs inside a plpgsql block with an EXCEPTION handler, which
--   is a subtransaction: the denial is caught, the outer transaction survives,
--   and the ALLOW becomes an assertion that can FAIL AND BE COUNTED.
--
--   It is still proven by what came back — the club_id the database returned,
--   not the statement completing. The denial returns a distinguishable literal
--   rather than NULL so a failure message says which of the two happened.
--
--   SECURITY INVOKER (the default). It must run with the caller's RLS.
-- -----------------------------------------------------------------------------

CREATE FUNCTION pg_temp.try_join(p_user uuid, p_club uuid, p_role text)
  RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_club uuid;
BEGIN
  INSERT INTO public.club_members (user_id, club_id, role)
  VALUES (p_user, p_club, p_role)
  RETURNING club_id INTO v_club;
  RETURN v_club::text;
EXCEPTION
  WHEN insufficient_privilege THEN
    RETURN 'DENIED: row-level security refused the membership insert (42501)';
END
$fn$;


-- =============================================================================
-- A. Impersonation is real, and the case-insensitive match works — WR-02
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000012');

-- FIRST ASSERTION, deliberately. If impersonation silently did not happen every
-- deny below would pass for the wrong reason and this file would certify nothing.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000000012'::uuid,
          'act_as moved auth.uid() to the invitee — impersonation is real');

-- ALLOW, and the WR-02 regression guard. `users.email` is stored
-- 'PgTap-Invite-Invitee@Mail.McGill.CA'; `invitee_email` is stored lowercase.
-- Under a case-sensitive policy this returns zero rows and no error.
SELECT results_eq(
  $q$SELECT id::text FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000f1'$q$,
  ARRAY['00000000-0000-4000-8000-0000000000f1'],
  'the invitee sees their invitation even though users.email differs in CASE');


-- =============================================================================
-- B. CR-04 — accepting may change `status` and nothing else
--
-- All four aimed at invitation f2, and all four run before anything succeeds.
-- =============================================================================

-- THE ESCALATION ITSELF: repoint the invitation at a club that did not invite
-- them, in the same statement that accepts it.
SELECT throws_ok(
  $q$UPDATE public.club_invitations
        SET status = 'accepted',
            club_id = '00000000-0000-4000-8000-0000000000d2'
      WHERE id = '00000000-0000-4000-8000-0000000000f2'$q$,
  '42501', NULL,
  'the invitee cannot repoint an invitation at another club while accepting it');

-- Self-extension. `expires_at` was unconstrained too, so an invitee could have
-- accepted and given themselves a year to do it again.
SELECT throws_ok(
  $q$UPDATE public.club_invitations
        SET status = 'accepted',
            expires_at = now() + interval '365 days'
      WHERE id = '00000000-0000-4000-8000-0000000000f2'$q$,
  '42501', NULL,
  'the invitee cannot extend their own invitation while accepting it');

-- Rewriting provenance: who sent it.
SELECT throws_ok(
  $q$UPDATE public.club_invitations
        SET status = 'accepted',
            inviter_id = '00000000-0000-4000-8000-000000000012'
      WHERE id = '00000000-0000-4000-8000-0000000000f2'$q$,
  '42501', NULL,
  'the invitee cannot rewrite who invited them while accepting it');

-- The invitee_email half, re-asserted here because these clauses are now
-- lower()-wrapped and 020's version of this assertion is not.
SELECT throws_ok(
  $q$UPDATE public.club_invitations
        SET status = 'accepted',
            invitee_email = 'pgtap-invite-stranger@mail.mcgill.ca'
      WHERE id = '00000000-0000-4000-8000-0000000000f2'$q$,
  '42501', NULL,
  'the invitee cannot reassign an invitation to another address while accepting it');

-- INTEGRITY for all four raises. Not one left a partial effect.
SELECT tests.act_as_owner();
SELECT results_eq(
  $q$SELECT status, club_id::text FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000f2'$q$,
  $q$VALUES ('pending', '00000000-0000-4000-8000-0000000000d1')$q$,
  'invitation f2 is untouched — still pending, still pointed at club A');


-- =============================================================================
-- C. CR-04, second half — an expired invitation is not accept-able
--
-- USING-filter shape: the row is not admitted at all, so the UPDATE matches
-- zero rows and raises nothing. Asserted as emptiness, then as integrity.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000012');
SELECT is_empty(
  $q$UPDATE public.club_invitations SET status = 'accepted'
      WHERE id = '00000000-0000-4000-8000-0000000000f3'
      RETURNING id$q$,
  'accepting an EXPIRED invitation affects zero rows — the policy tier now '
  'agrees with the application''s own expiry check');

SELECT tests.act_as_owner();
SELECT results_eq(
  $q$SELECT status FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000f3'$q$,
  ARRAY['pending'],
  'the expired invitation still exists and is still pending — that empty '
  'update was a filter, not a deletion');


-- =============================================================================
-- D. WR-01 — the new club_members INSERT policy, and the five holes it does
--    NOT have. Every one of these runs before the successful join.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000012');

-- A club that never invited them. This is the second half of the CR-04
-- escalation: even if the invitation row could be repointed, the membership
-- insert must independently refuse.
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000012',
             '00000000-0000-4000-8000-0000000000d2', 'organizer')$q$,
  '42501', NULL,
  'the invitee cannot join a club that did not invite them');

-- A club whose invitation has EXPIRED. The invitation exists and names them;
-- it is simply dead, and a dead invitation is not a door.
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000012',
             '00000000-0000-4000-8000-0000000000d3', 'organizer')$q$,
  '42501', NULL,
  'an expired invitation does not let the invitee join that club');

-- Role escalation. Without the role clause, being invited to a club would be a
-- grant of OWNERSHIP of it — `is_club_owner` reads exactly this column.
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000012',
             '00000000-0000-4000-8000-0000000000d1', 'owner')$q$,
  '42501', NULL,
  'the invitee cannot make themselves OWNER of the club that invited them');

-- Enrolling somebody else on the strength of their own invitation.
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000013',
             '00000000-0000-4000-8000-0000000000d1', 'organizer')$q$,
  '42501', NULL,
  'the invitee cannot enrol another user with their own invitation');

-- A user with no invitation anywhere.
SELECT tests.act_as('00000000-0000-4000-8000-000000000013');
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000013',
             '00000000-0000-4000-8000-0000000000d1', 'organizer')$q$,
  '42501', NULL,
  'a user who was never invited cannot join the club');

-- And the anonymous caller. The policy names `authenticated`, so `anon` matches
-- nothing and the table is closed to it.
SELECT tests.act_as_anon();
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000000012',
             '00000000-0000-4000-8000-0000000000d1', 'organizer')$q$,
  '42501', NULL,
  'an anonymous caller cannot insert a membership row at all');


-- =============================================================================
-- E. WR-01 — the acceptance transaction, performed
--
-- This is the assertion 020 could not make. Both halves of what
-- `src/app/invites/[token]/page.tsx` issues, each proven by what came back.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000012');

SELECT results_eq(
  $q$UPDATE public.club_invitations SET status = 'accepted'
      WHERE id = '00000000-0000-4000-8000-0000000000f1'
      RETURNING status$q$,
  ARRAY['accepted'],
  'the invitee can accept their own live invitation');

SELECT is(
  pg_temp.try_join('00000000-0000-4000-8000-000000000012',
                   '00000000-0000-4000-8000-0000000000d1', 'organizer'),
  '00000000-0000-4000-8000-0000000000d1',
  'and can then insert the membership row — the accept path completes, which '
  'it could not before (F-016 / WR-01)');

-- INTEGRITY. The membership is really there, with the role the policy pinned,
-- read back with RLS bypassed so this cannot be the caller seeing their own
-- uncommitted wish.
SELECT tests.act_as_owner();
SELECT results_eq(
  $q$SELECT role FROM public.club_members
      WHERE user_id = '00000000-0000-4000-8000-000000000012'
        AND club_id = '00000000-0000-4000-8000-0000000000d1'$q$,
  ARRAY['organizer'],
  'the membership row exists with role organizer — not owner');


SELECT * FROM finish();
ROLLBACK;
