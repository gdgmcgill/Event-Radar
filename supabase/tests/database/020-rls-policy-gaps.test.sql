-- =============================================================================
-- 020-rls-policy-gaps.test.sql — allow/deny pairs for the three policies
-- 20260915230000_fk_indexes_and_policy_gaps.sql adds (F-016)
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
--
-- THE ASSERTION SHAPES ARE THE POINT OF THIS FILE.
--
-- RLS denial has two distinct shapes and only one of them throws:
--
--   * a WITH CHECK violation raises SQLSTATE 42501       → assert the raise
--   * a USING clause filters the row: no error, no rows  → assert emptiness,
--     AND then assert, with RLS bypassed, that the row is still there. Without
--     that second half an empty result is indistinguishable from a deleted row,
--     and the "denial" could be a data-loss bug wearing a passing test.
--
-- And the rule that makes an ALLOW meaningful: a write is never proven by the
-- statement merely completing. A statement that matched zero rows completes
-- perfectly happily. Every allowed write below uses RETURNING and asserts the
-- value that came back.
--
-- This is 02-REVIEW.md WR-04's finding one tier down — a suite whose assertions
-- cannot fail when the thing they check is removed is a false attestation, not
-- a control. `scripts/pgtap-mutation-check.sh` is what converts the assertions
-- below from plausible to proven: it comments out each of the three policies in
-- turn and requires this file to go red.
--
-- The whole file is one transaction and rolls back, so it leaves no rows behind
-- and can run against a freshly reset database any number of times.
-- =============================================================================

BEGIN;
SELECT plan(15);


-- -----------------------------------------------------------------------------
-- Fixture. Written as the session role, which owns these tables and therefore
-- bypasses RLS — the fixture is a precondition, not a thing under test.
--
--   owner     — owns club C and sent every invitation below
--   invitee   — the addressee of invitations A and B
--   stranger  — an authenticated user with no relationship to club C
--   invitation C — addressed to an email with no user row at all, so no
--                  authenticated caller in this file is its invitee
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name) VALUES
  ('00000000-0000-4000-8000-000000000001', 'pgtap-owner@mail.mcgill.ca',    'Owner'),
  ('00000000-0000-4000-8000-000000000002', 'pgtap-invitee@mail.mcgill.ca',  'Invitee'),
  ('00000000-0000-4000-8000-000000000003', 'pgtap-stranger@mail.mcgill.ca', 'Stranger');

-- `clubs.created_by` is a nullable foreign key into `auth.users`, which GoTrue
-- owns. Ownership for this fixture is expressed where the policy actually reads
-- it — the `club_members` row below, which is what `is_club_owner` consults —
-- so nothing here needs to write into the auth schema.
INSERT INTO public.clubs (id, name) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'pgTAP Test Club');

INSERT INTO public.club_members (user_id, club_id, role) VALUES
  ('00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-0000000000c1', 'owner');

INSERT INTO public.club_invitations (id, club_id, inviter_id, invitee_email, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
   '00000000-0000-4000-8000-000000000001', 'pgtap-invitee@mail.mcgill.ca', 'pending'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1',
   '00000000-0000-4000-8000-000000000001', 'pgtap-invitee@mail.mcgill.ca', 'pending'),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000c1',
   '00000000-0000-4000-8000-000000000001', 'pgtap-nobody@mail.mcgill.ca',  'pending');


-- =============================================================================
-- Policy 1 — "Invitees can view their own invitations" (SELECT)
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000002');

-- FIRST ASSERTION, deliberately. If impersonation silently did not happen, every
-- deny below would pass for the wrong reason and this file would certify
-- nothing. Prove the helper moved the observed subject before trusting anything
-- that depends on it.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000000002'::uuid,
          'act_as moved auth.uid() to the invitee — impersonation is real');

-- ALLOW. Proven by the value returned, not by the statement completing.
SELECT results_eq(
  $q$SELECT invitee_email FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000a1'$q$,
  ARRAY['pgtap-invitee@mail.mcgill.ca'],
  'the invitee can read the invitation addressed to them');

-- DENY, USING-filter shape. Invitation C is addressed to somebody else; the
-- policy filters it away silently rather than raising.
SELECT is_empty(
  $q$SELECT id FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000c9'$q$,
  'the invitee cannot read an invitation addressed to a different email');

-- INTEGRITY for the denial above. The row is still there; the empty result was
-- a filter, not a deletion.
SELECT tests.act_as_owner();
SELECT isnt_empty(
  $q$SELECT id FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000c9'$q$,
  'invitation C still exists with RLS bypassed — the denial filtered, it did not delete');


-- =============================================================================
-- Policy 2 — "Invitees can accept their own invitations" (UPDATE)
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000002');

-- ALLOW. The accept transition, proven by the status that came back.
SELECT results_eq(
  $q$UPDATE public.club_invitations SET status = 'accepted'
      WHERE id = '00000000-0000-4000-8000-0000000000a1'
      RETURNING status$q$,
  ARRAY['accepted'],
  'the invitee can accept their own pending invitation');

-- DENY, WITH CHECK shape. The USING clause admits the row — it is the invitee's
-- own pending invitation — so the row IS found and the destination state is
-- what fails. That raises.
SELECT throws_ok(
  $q$UPDATE public.club_invitations SET status = 'revoked'
      WHERE id = '00000000-0000-4000-8000-0000000000b1'$q$,
  '42501',
  NULL,
  'the invitee cannot revoke an invitation — accept is the only transition open to them');

-- DENY, WITH CHECK shape, ownership half. This is the assertion that the
-- archived migration could not have made: its WITH CHECK constrained only the
-- destination status, so an invitee could have rewritten invitee_email onto
-- somebody else in the same statement that accepted the invitation.
SELECT throws_ok(
  $q$UPDATE public.club_invitations
        SET status = 'accepted', invitee_email = 'pgtap-stranger@mail.mcgill.ca'
      WHERE id = '00000000-0000-4000-8000-0000000000b1'$q$,
  '42501',
  NULL,
  'the invitee cannot reassign an invitation to another address while accepting it');

-- INTEGRITY for both raises. Neither rejected statement left a partial effect.
SELECT tests.act_as_owner();
SELECT results_eq(
  $q$SELECT status, invitee_email FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000b1'$q$,
  $q$VALUES ('pending', 'pgtap-invitee@mail.mcgill.ca')$q$,
  'invitation B is untouched — still pending, still addressed to the invitee');


-- =============================================================================
-- Cross-tenant reads: a stranger and an anonymous caller
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000000003');
SELECT is_empty(
  $q$SELECT id FROM public.club_invitations
      WHERE invitee_email = 'pgtap-invitee@mail.mcgill.ca'$q$,
  'a stranger sees none of the invitee''s invitations');

SELECT tests.act_as('00000000-0000-4000-8000-000000000002');
SELECT isnt_empty(
  $q$SELECT id FROM public.club_invitations
      WHERE invitee_email = 'pgtap-invitee@mail.mcgill.ca'$q$,
  'the invitee still sees their own invitations — the stranger''s empty read was a filter');


-- =============================================================================
-- Policy 3 — "Club owners can update club invitations" (UPDATE)
-- =============================================================================

-- DENY, USING-filter shape. A non-owner's revoke matches no row, and an UPDATE
-- that matches no row raises nothing at all — which is precisely why this is
-- asserted as emptiness and then followed by an integrity check.
SELECT tests.act_as('00000000-0000-4000-8000-000000000003');
SELECT is_empty(
  $q$UPDATE public.club_invitations SET status = 'revoked'
      WHERE id = '00000000-0000-4000-8000-0000000000c9'
      RETURNING id$q$,
  'a non-owner revoking an invitation affects zero rows');

SELECT tests.act_as_owner();
SELECT results_eq(
  $q$SELECT status FROM public.club_invitations
      WHERE id = '00000000-0000-4000-8000-0000000000c9'$q$,
  ARRAY['pending'],
  'invitation C is still pending — the non-owner''s empty update changed nothing');

-- DENY for the anonymous caller. Every policy on this table names `authenticated`
-- as its target role, so `anon` matches none of them and the table is closed.
SELECT tests.act_as_anon();
SELECT is_empty(
  $q$SELECT id FROM public.club_invitations$q$,
  'an anonymous caller sees no invitations at all');

SELECT tests.act_as_owner();
SELECT isnt_empty(
  $q$SELECT id FROM public.club_invitations$q$,
  'all three invitations still exist with RLS bypassed');

-- ALLOW. The owner's revoke transition, proven by the status that came back.
SELECT tests.act_as('00000000-0000-4000-8000-000000000001');
SELECT results_eq(
  $q$UPDATE public.club_invitations SET status = 'revoked'
      WHERE id = '00000000-0000-4000-8000-0000000000c9'
      RETURNING status$q$,
  ARRAY['revoked'],
  'the club owner can revoke a pending invitation for their own club');


SELECT * FROM finish();
ROLLBACK;
