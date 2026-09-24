-- =============================================================================
-- 060-club-tenant-isolation.test.sql — the RLS ring for the club tables, in
-- both directions: what a cross-club attacker cannot do, and what a member, an
-- owner and an admin still can.
--
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-11
-- Covers F-008 (DEC-42) against
-- supabase/migrations/20260923120000_events_insert_club_scope.sql, and pins the
-- measured club-table policies of `evidence/rls-ring-before.txt` (P3..P7) so a
-- later migration cannot loosen them silently. Row labels "§ D <table · op>" name
-- the row of 05-RESEARCH.md § D (the RLS-ring matrix); "P<n>" to the before-probe.
--
-- THREE ASSERTION SHAPES, and which one each row uses is the point:
--
--   * WITH CHECK deny  → throws_ok(…, '42501'). An INSERT refused by RLS raises.
--     No deny INSERT uses RETURNING, so the outcome is the WITH CHECK decision
--     alone and never a SELECT-policy side effect (research § D).
--   * USING deny       → is_empty(UPDATE/DELETE … RETURNING), then
--     tests.act_as_owner() and isnt_empty on the untouched row. A USING clause
--     filters silently: without the integrity half, an empty result is
--     indistinguishable from a row that was deleted.
--   * ALLOWED insert whose row reaches auth.users → throws_ok(…, '23503').
--     `events.created_by` is a foreign key into `auth.users`, which GoTrue owns
--     and this suite never writes (D-21). RLS WITH CHECK runs before the
--     foreign-key trigger, so a 23503 means the policy ADMITTED the row and
--     only the fixture's absent auth user stopped it. The same house pattern as
--     src/__tests__/moderation/audit-shape.test.ts ("reaches the FK check, i.e.
--     the shape is accepted"). A 42501 in one of these rows would be a red.
--
-- Where an allow does not reach auth.users (the admin event with no creator,
-- the owner's delete and invitation) it is proven by RETURNING or by an
-- integrity read, never by lives_ok alone.
--
-- The fixture uses literal ids in the 00000000-0000-4000-8000-0000000060xx
-- block and no seed row, so the file runs identically unseeded (CI's `types`
-- job) and seeded. One transaction, rolled back; nothing survives the file.
-- =============================================================================

BEGIN;
SELECT plan(30);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role (owns the tables, bypasses RLS).
--
--   A  owner      — owner of club CA (approved) and of club CP (pending)
--   M  organizer  — organizer member of CA
--   B  attacker   — owner of club CB (approved) only; no row in CA
--   X  admin      — roles {admin}, no club membership
--
-- Ownership lives in club_members, which is what is_club_owner and
-- is_club_member read; clubs.created_by (an auth.users key) stays NULL.
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name, roles) VALUES
  ('00000000-0000-4000-8000-000000006001', 'pgtap-060-owner@mail.mcgill.ca',     'T060 Owner A',     '{user}'),
  ('00000000-0000-4000-8000-000000006002', 'pgtap-060-organizer@mail.mcgill.ca', 'T060 Organizer M', '{user}'),
  ('00000000-0000-4000-8000-000000006003', 'pgtap-060-attacker@mail.mcgill.ca',  'T060 Attacker B',  '{user}'),
  ('00000000-0000-4000-8000-000000006004', 'pgtap-060-admin@mail.mcgill.ca',     'T060 Admin X',     '{user,admin}');

INSERT INTO public.clubs (id, name, description, status) VALUES
  ('00000000-0000-4000-8000-0000000060c1', 'T060 Club A',       'club A original', 'approved'),
  ('00000000-0000-4000-8000-0000000060c2', 'T060 Club B',       'club B original', 'approved'),
  ('00000000-0000-4000-8000-0000000060c3', 'T060 Pending Club', 'pending club',    'pending');

INSERT INTO public.club_members (id, user_id, club_id, role) VALUES
  ('00000000-0000-4000-8000-0000000060d1', '00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-0000000060c1', 'owner'),
  ('00000000-0000-4000-8000-0000000060d2', '00000000-0000-4000-8000-000000006002', '00000000-0000-4000-8000-0000000060c1', 'organizer'),
  ('00000000-0000-4000-8000-0000000060d3', '00000000-0000-4000-8000-000000006003', '00000000-0000-4000-8000-0000000060c2', 'owner'),
  ('00000000-0000-4000-8000-0000000060d4', '00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-0000000060c3', 'owner');


-- =============================================================================
-- The helper's own hardening (T-05-11-06)
-- =============================================================================

-- 1
SELECT ok(
  (SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
     FROM pg_proc p
    WHERE p.oid = 'public.is_club_member(uuid)'::regprocedure),
  'is_club_member is SECURITY DEFINER with an empty search_path');

-- 2
SELECT ok(
  NOT has_function_privilege('anon', 'public.is_club_member(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.is_club_member(uuid)', 'EXECUTE'),
  'is_club_member: anon cannot execute it, authenticated can');


-- =============================================================================
-- events INSERT — F-008, the attacker (§ D "events INSERT")
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006003');

-- 3. FIRST behavioural assertion, deliberately: if impersonation silently did
-- not happen, every deny below would pass for the wrong reason.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000006003'::uuid,
          'act_as moved auth.uid() to the attacker — impersonation is real');

-- 4. P1: the forged creator + forged approval. Was INSERT 0 1 before F-008.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 attacker forged', '2031-01-01T18:00:00Z', '2031-01-01T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006001', 'approved')$q$,
  '42501', NULL,
  'attacker (§ D events INSERT, P1): approved event in club A with created_by = the owner is refused');

-- 5. P2: a non-member self-approving into another club. Was INSERT 0 1.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 attacker self', '2031-01-02T18:00:00Z', '2031-01-02T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006003', 'approved')$q$,
  '42501', NULL,
  'attacker (§ D events INSERT, P2): approved event in club A under their own id is refused — not a member');

-- 6. The creator binding holds for pending events too.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 attacker pending forged', '2031-01-03T18:00:00Z', '2031-01-03T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006001', 'pending')$q$,
  '42501', NULL,
  'attacker (§ D events INSERT): even a pending event cannot carry somebody else''s created_by');

-- 7. ALLOW (DEC-42): anyone may propose a pending event, for any club.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 attacker pending own', '2031-01-04T18:00:00Z', '2031-01-04T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006003', 'pending')$q$,
  '23503', NULL,
  'attacker (§ D events INSERT, DEC-42): a pending event naming club A under their own id passes RLS (23503 = reached the auth.users FK)');

-- 8. ALLOW, the attacker's own lane: approved into the club they own.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 attacker own club', '2031-01-05T18:00:00Z', '2031-01-05T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c2',
             '00000000-0000-4000-8000-000000006003', 'approved')$q$,
  '23503', NULL,
  'attacker in their own lane: approved event in club B, which they own, passes RLS (23503)');


-- =============================================================================
-- events INSERT — the legitimate paths (T-05-11-02)
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006002');

-- 9. ALLOW: a member (organizer) of an approved club posts an approved event.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 member approved', '2031-01-06T18:00:00Z', '2031-01-06T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006002', 'approved')$q$,
  '23503', NULL,
  'organizer M (§ D events INSERT, owner-member arm): approved event in club A, of which M is a member, passes RLS (23503)');

-- 10. DENY: approval needs a club. A club-less approved insert is refused.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 member no club', '2031-01-07T18:00:00Z', '2031-01-07T20:00:00Z',
             NULL, '00000000-0000-4000-8000-000000006002', 'approved')$q$,
  '42501', NULL,
  'organizer M: an approved event with no club is refused — approval requires a club');

SELECT tests.act_as('00000000-0000-4000-8000-000000006001');

-- 11. DENY: membership of a PENDING club does not confer approval.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 owner pending club', '2031-01-08T18:00:00Z', '2031-01-08T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c3',
             '00000000-0000-4000-8000-000000006001', 'approved')$q$,
  '42501', NULL,
  'owner A (§ D events INSERT): approved event in their own PENDING club is refused — the club is not approved');

-- 12. ALLOW: the same owner may still propose it as pending.
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, created_by, status)
     VALUES ('t060 owner pending club pending', '2031-01-09T18:00:00Z', '2031-01-09T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c3',
             '00000000-0000-4000-8000-000000006001', 'pending')$q$,
  '23503', NULL,
  'owner A: a pending event in their pending club passes RLS (23503)');

SELECT tests.act_as('00000000-0000-4000-8000-000000006004');

-- 13. ALLOW, the admin arm: POST /api/admin/events inserts with no created_by.
-- No auth.users key is set, so the row really lands; proven by the read below.
SELECT lives_ok(
  $q$INSERT INTO public.events (id, title, start_date, end_date, club_id, created_by, status)
     VALUES ('00000000-0000-4000-8000-0000000060e1', 't060 admin no creator',
             '2031-01-10T18:00:00Z', '2031-01-10T20:00:00Z', NULL, NULL, 'approved')$q$,
  'admin X (§ D events INSERT, admin arm): an approved event with no creator and no club is accepted');

SELECT tests.act_as_owner();

-- 14. INTEGRITY for 13: the row exists, approved, with no creator.
SELECT isnt_empty(
  $q$SELECT id FROM public.events
      WHERE id = '00000000-0000-4000-8000-0000000060e1'
        AND status = 'approved' AND created_by IS NULL$q$,
  'the admin''s event is in the table with RLS bypassed — the allow wrote the row');

SELECT tests.act_as_anon();

-- 15. DENY: anonymous callers have no INSERT policy at all (P8).
SELECT throws_ok(
  $q$INSERT INTO public.events (title, start_date, end_date, club_id, status)
     VALUES ('t060 anon', '2031-01-11T18:00:00Z', '2031-01-11T20:00:00Z',
             '00000000-0000-4000-8000-0000000060c1', 'approved')$q$,
  '42501', NULL,
  'anonymous (§ D events INSERT, P8): an events insert is refused');


-- =============================================================================
-- clubs UPDATE — attacker denied, and the owner denied too (C11, DEC-41):
-- the owner's path is the registered elevated door, not a policy.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006003');

-- 16
SELECT is_empty(
  $q$UPDATE public.clubs SET description = 'hijacked'
      WHERE id = '00000000-0000-4000-8000-0000000060c1'
      RETURNING id$q$,
  'attacker (§ D clubs UPDATE): UPDATE of club A affects no row');

SELECT tests.act_as('00000000-0000-4000-8000-000000006001');

-- 17
SELECT is_empty(
  $q$UPDATE public.clubs SET description = 'owner direct write'
      WHERE id = '00000000-0000-4000-8000-0000000060c1'
      RETURNING id$q$,
  'owner A (§ D clubs UPDATE, P3, C11): a DIRECT UPDATE of their own club still affects no row — the door is the owner path');

SELECT tests.act_as_owner();

-- 18. INTEGRITY for 16 and 17.
SELECT isnt_empty(
  $q$SELECT id FROM public.clubs
      WHERE id = '00000000-0000-4000-8000-0000000060c1'
        AND description = 'club A original'$q$,
  'club A''s description is unchanged with RLS bypassed — both updates were filtered');


-- =============================================================================
-- club_members — role changes and removals
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006001');

-- 19
SELECT is_empty(
  $q$UPDATE public.club_members SET role = 'owner'
      WHERE id = '00000000-0000-4000-8000-0000000060d2'
      RETURNING id$q$,
  'owner A (§ D club_members UPDATE, P4, C11): a DIRECT role change on M''s membership affects no row');

SELECT tests.act_as('00000000-0000-4000-8000-000000006003');

-- 20
SELECT is_empty(
  $q$DELETE FROM public.club_members
      WHERE id = '00000000-0000-4000-8000-0000000060d2'
      RETURNING id$q$,
  'attacker (§ D club_members DELETE, P5): DELETE of M''s membership in club A affects no row');

-- 21
SELECT is_empty(
  $q$UPDATE public.club_members SET role = 'owner'
      WHERE club_id = '00000000-0000-4000-8000-0000000060c1'
      RETURNING id$q$,
  'attacker: a role change on any club A membership affects no row');

SELECT tests.act_as_owner();

-- 22. INTEGRITY for 19, 20 and 21.
SELECT results_eq(
  $q$SELECT role FROM public.club_members
      WHERE id = '00000000-0000-4000-8000-0000000060d2'$q$,
  ARRAY['organizer'],
  'M''s membership is still there and still organizer with RLS bypassed');

SELECT tests.act_as('00000000-0000-4000-8000-000000006001');

-- 23. ALLOW (P6): the owner removes a member of their own club.
SELECT results_eq(
  $q$DELETE FROM public.club_members
      WHERE id = '00000000-0000-4000-8000-0000000060d2'
      RETURNING user_id$q$,
  ARRAY['00000000-0000-4000-8000-000000006002'::uuid],
  'owner A (§ D club_members DELETE, P6): removing M from club A deletes exactly M''s row');

SELECT tests.act_as_owner();

-- 24. The removal really happened, and only that row.
SELECT results_eq(
  $q$SELECT user_id FROM public.club_members
      WHERE club_id = '00000000-0000-4000-8000-0000000060c1' ORDER BY user_id$q$,
  ARRAY['00000000-0000-4000-8000-000000006001'::uuid],
  'club A now holds only its owner — the delete removed M and nothing else');


-- =============================================================================
-- club_invitations INSERT
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006003');

-- 25. DENY (P7).
SELECT throws_ok(
  $q$INSERT INTO public.club_invitations (club_id, inviter_id, invitee_email)
     VALUES ('00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006003', 'pgtap-060-victim@mail.mcgill.ca')$q$,
  '42501', NULL,
  'attacker (§ D club_invitations INSERT, P7): an invitation to club A is refused');

SELECT tests.act_as('00000000-0000-4000-8000-000000006001');

-- 26. ALLOW. `club_invitations.inviter_id` references public.users (not
-- auth.users), and A has a public.users row, so the row really lands and
-- RETURNING proves it (the owner can SELECT their club's invitations).
SELECT results_eq(
  $q$INSERT INTO public.club_invitations (club_id, inviter_id, invitee_email)
     VALUES ('00000000-0000-4000-8000-0000000060c1',
             '00000000-0000-4000-8000-000000006001', 'pgtap-060-invitee@mail.mcgill.ca')
     RETURNING club_id$q$,
  ARRAY['00000000-0000-4000-8000-0000000060c1'::uuid],
  'owner A (§ D club_invitations INSERT): an invitation to their own club is accepted');

SELECT tests.act_as_owner();

-- 27. INTEGRITY: exactly the owner's invitation exists; the attacker's does not.
SELECT results_eq(
  $q$SELECT invitee_email FROM public.club_invitations
      WHERE club_id = '00000000-0000-4000-8000-0000000060c1' ORDER BY invitee_email$q$,
  ARRAY['pgtap-060-invitee@mail.mcgill.ca'],
  'club A holds the owner''s invitation and not the attacker''s');

-- =============================================================================
-- Pinned as measured (§ D "clubs INSERT", "club_members INSERT"): no attacker
-- path creates a club or plants themselves in another club.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006003');

-- 28
SELECT throws_ok(
  $q$INSERT INTO public.clubs (id, name, status)
     VALUES ('00000000-0000-4000-8000-0000000060c9', 't060 attacker club', 'approved')$q$,
  '42501', NULL,
  'attacker (§ D clubs INSERT): a direct club insert is refused (admin-only policy)');

-- 29
SELECT throws_ok(
  $q$INSERT INTO public.club_members (user_id, club_id, role)
     VALUES ('00000000-0000-4000-8000-000000006003',
             '00000000-0000-4000-8000-0000000060c1', 'owner')$q$,
  '42501', NULL,
  'attacker (§ D club_members INSERT): self-insert as owner of club A is refused');

SELECT tests.act_as_owner();

-- 30. No attacker event reached the table by any path.
SELECT is_empty(
  $q$SELECT id FROM public.events
      WHERE created_by = '00000000-0000-4000-8000-000000006003'
         OR title LIKE 't060 attacker%'$q$,
  'no event created by or titled for the attacker exists with RLS bypassed');

SELECT * FROM finish();
ROLLBACK;
