-- =============================================================================
-- 050-users-privilege-escalation.test.sql — the RLS ring for public.users, in
-- both directions: what a signed-in user can no longer write about themselves,
-- and every profile write the application still makes on the cookie client.
--
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-16
-- Covers F-006 (DEC-47, 05-RESEARCH.md C3) against
-- supabase/migrations/20260923130000_users_grants_audit_log_insert.sql.
--
-- WHAT WAS WRONG. The baseline granted UPDATE on the whole users table to
-- `authenticated` (and to `anon`), and the own-row policy had a USING clause
-- and no column scope. So a student could send, with their own JWT,
--   PATCH /rest/v1/users?id=eq.<me>  {"roles":["user","admin"]}
-- and become an admin, and a banned user could clear their own `banned_at`.
-- A signed-in user with no profile row could also INSERT one with any roles.
--
-- ASSERTION SHAPES
--   * A column the grant withholds → throws_ok(…, '42501'). A column privilege
--     is checked before any row is read, so the refusal raises even for the
--     caller's own row. The integrity read afterwards (RLS bypassed) proves the
--     column did not move.
--   * Another user's row → is_empty(UPDATE … RETURNING) plus an integrity read:
--     the USING clause filters silently.
--   * An allowed write → results_eq on RETURNING, or lives_ok followed by an
--     integrity read as the table owner; never lives_ok alone.
--   * The saved-events counter (C3) is read back as the table owner after the
--     save and after the unsave: the trigger now runs as its definer, and a
--     SECURITY INVOKER trigger would raise 42501 on the save instead.
--
-- The fixture uses literal ids in the 00000000-0000-4000-8000-0000000050xx block
-- and no seed row, so the file runs identically unseeded (CI's `types` job) and
-- seeded. No row is written into the auth schema (D-21): public.users.id has no
-- foreign key into auth.users, and the fixture event has no creator. One
-- transaction, rolled back; nothing survives the file.
-- =============================================================================

BEGIN;
SELECT plan(23);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role (owns the tables, bypasses RLS).
--
--   S  student  — roles {user}, not banned
--   B  banned   — roles {user}, banned_at set (≙ the seed's banned persona)
--   N  newcomer — an authenticated identity with NO public.users row (the
--                 state between GoTrue sign-up and the callback's profile sync)
--   E  event    — approved, no creator, no club
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name, roles, banned_at, ban_reason) VALUES
  ('00000000-0000-4000-8000-000000005001', 'pgtap-050-student@mail.mcgill.ca', 'T050 Student S', '{user}', NULL, NULL),
  ('00000000-0000-4000-8000-000000005002', 'pgtap-050-banned@mail.mcgill.ca',  'T050 Banned B',  '{user}', now(), 'pgtap fixture');

INSERT INTO public.events (id, title, start_date, end_date, status) VALUES
  ('00000000-0000-4000-8000-0000000050e1', 'T050 Event', '2031-02-01T18:00:00Z', '2031-02-01T20:00:00Z', 'approved');


-- =============================================================================
-- Schema shape (T-05-16-05)
-- =============================================================================

-- 1
SELECT ok(
  (SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
     FROM pg_proc p
    WHERE p.oid = 'public.update_saved_events_count()'::regprocedure),
  'update_saved_events_count is SECURITY DEFINER with an empty search_path (C3)');

-- 2
SELECT ok(
  NOT has_function_privilege('anon', 'public.update_saved_events_count()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.update_saved_events_count()', 'EXECUTE'),
  'update_saved_events_count: neither anon nor authenticated can call it directly');

-- 3
SELECT ok(
  (SELECT roles = ARRAY['authenticated']::name[] AND with_check IS NOT NULL
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'Users can update own profile'),
  'the own-row UPDATE policy is TO authenticated and carries a WITH CHECK');


-- =============================================================================
-- Self-escalation — F-006, the student
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005001');

-- 4. FIRST behavioural assertion, deliberately: if impersonation silently did
-- not happen, every deny below would pass for the wrong reason.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000005001'::uuid,
          'act_as moved auth.uid() to the student — impersonation is real');

-- 5. The F-006 path itself.
SELECT throws_ok(
  $q$UPDATE public.users SET roles = '{user,admin}'
      WHERE id = '00000000-0000-4000-8000-000000005001'$q$,
  '42501', NULL,
  'student (F-006): setting their own roles to {user,admin} is refused');

-- 6. The counter is not the user's to set either (C3 option (a)).
SELECT throws_ok(
  $q$UPDATE public.users SET saved_events_count = 999
      WHERE id = '00000000-0000-4000-8000-000000005001'$q$,
  '42501', NULL,
  'student: setting their own saved_events_count is refused');

-- 7. The sign-in identity is GoTrue's, not a profile field.
SELECT throws_ok(
  $q$UPDATE public.users SET email = 'pgtap-050-hijack@mail.mcgill.ca'
      WHERE id = '00000000-0000-4000-8000-000000005001'$q$,
  '42501', NULL,
  'student: rewriting their own email is refused');

-- 8. USING still holds for someone else's row, on a granted column.
SELECT is_empty(
  $q$UPDATE public.users SET name = 'T050 renamed by S'
      WHERE id = '00000000-0000-4000-8000-000000005002'
      RETURNING id$q$,
  'student: renaming another user affects no row');


-- =============================================================================
-- Self-unban — F-006, the banned user
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005002');

-- 9
SELECT throws_ok(
  $q$UPDATE public.users SET banned_at = NULL
      WHERE id = '00000000-0000-4000-8000-000000005002'$q$,
  '42501', NULL,
  'banned user (F-006): clearing their own banned_at is refused');

-- 10
SELECT throws_ok(
  $q$UPDATE public.users SET ban_expires_at = now() - interval '1 day'
      WHERE id = '00000000-0000-4000-8000-000000005002'$q$,
  '42501', NULL,
  'banned user: back-dating their own ban expiry is refused');

SELECT tests.act_as_owner();

-- 11. INTEGRITY for 5-10: nothing the denials named moved.
SELECT results_eq(
  $q$SELECT id, roles::text, email, saved_events_count, name, banned_at IS NOT NULL, ban_expires_at IS NULL
       FROM public.users
      WHERE id IN ('00000000-0000-4000-8000-000000005001',
                   '00000000-0000-4000-8000-000000005002')
      ORDER BY id$q$,
  $q$VALUES
      ('00000000-0000-4000-8000-000000005001'::uuid, '{user}', 'pgtap-050-student@mail.mcgill.ca', 0, 'T050 Student S', false, true),
      ('00000000-0000-4000-8000-000000005002'::uuid, '{user}', 'pgtap-050-banned@mail.mcgill.ca',  0, 'T050 Banned B',  true,  true)$q$,
  'with RLS bypassed: S is still {user} with its email and a zero counter, B is still banned with no expiry, B''s name is untouched');


-- =============================================================================
-- Every profile write the application makes on the cookie client (T-05-16-04)
--   users/[id] PATCH: name, avatar_url, banner_url, interest_tags, pronouns,
--                     year, faculty, visibility, onboarding_completed, updated_at
--   profile/avatar, profile/banner, profile/interests: one column + updated_at
--   profile/inferred-tags: inferred_tags + updated_at
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005001');

-- 12
SELECT results_eq(
  $q$UPDATE public.users
        SET name = 'T050 Student Renamed',
            avatar_url = 'https://example.test/a.png',
            banner_url = 'https://example.test/b.png',
            pronouns = 'they/them',
            year = 'U2',
            faculty = 'Science',
            visibility = 'private',
            interest_tags = '{academic,tech}',
            onboarding_completed = true,
            updated_at = now()
      WHERE id = '00000000-0000-4000-8000-000000005001'
      RETURNING name$q$,
  ARRAY['T050 Student Renamed'],
  'student: a self-update of every granted profile column is accepted');

-- 13. C3: the inferred-tags route writes this on the cookie client.
SELECT results_eq(
  $q$UPDATE public.users SET inferred_tags = '{music}', updated_at = now()
      WHERE id = '00000000-0000-4000-8000-000000005001'
      RETURNING inferred_tags$q$,
  $q$VALUES ('{music}'::text[])$q$,
  'student (C3): a self-update of inferred_tags is accepted');

-- 14. A self-update also still works for a banned user (the ban is enforced by
-- the proxy and the guards, not by withholding the profile columns).
SELECT tests.act_as('00000000-0000-4000-8000-000000005002');
SELECT results_eq(
  $q$UPDATE public.users SET pronouns = 'she/her'
      WHERE id = '00000000-0000-4000-8000-000000005002'
      RETURNING pronouns$q$,
  ARRAY['she/her'],
  'banned user: a self-update of a granted column is still accepted — only the ban columns are withheld');

SELECT tests.act_as_owner();

-- 15. INTEGRITY for 12-13: the values landed.
SELECT results_eq(
  $q$SELECT name, visibility, onboarding_completed, interest_tags, inferred_tags, roles::text
       FROM public.users WHERE id = '00000000-0000-4000-8000-000000005001'$q$,
  $q$VALUES ('T050 Student Renamed', 'private', true, '{academic,tech}'::text[], '{music}'::text[], '{user}')$q$,
  'with RLS bypassed: S''s profile columns hold the new values and roles is still {user}');


-- =============================================================================
-- Profile-row INSERT — research open point, DEC-47
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005003');

-- 16. The newcomer has no users row. Before the migration the own-row INSERT
-- policy admitted this, roles included; the callback's elevated upsert is the
-- only writer now.
SELECT throws_ok(
  $q$INSERT INTO public.users (id, email, roles)
     VALUES ('00000000-0000-4000-8000-000000005003', 'pgtap-050-newcomer@mail.mcgill.ca', '{user,admin}')$q$,
  '42501', NULL,
  'newcomer with no profile row: inserting their own row with {user,admin} is refused');

SELECT tests.act_as('00000000-0000-4000-8000-000000005001');

-- 17
SELECT throws_ok(
  $q$INSERT INTO public.users (id, email, roles)
     VALUES ('00000000-0000-4000-8000-000000005004', 'pgtap-050-other@mail.mcgill.ca', '{user}')$q$,
  '42501', NULL,
  'student: inserting a users row for another id is refused');

SELECT tests.act_as_owner();

-- 18. INTEGRITY for 16-17.
SELECT is_empty(
  $q$SELECT id FROM public.users
      WHERE id IN ('00000000-0000-4000-8000-000000005003',
                   '00000000-0000-4000-8000-000000005004')$q$,
  'with RLS bypassed: neither inserted users row exists');


-- =============================================================================
-- anon — the baseline granted ALL on users to anon (C3)
-- =============================================================================

SELECT tests.act_as_anon();

-- 19
SELECT throws_ok(
  $q$UPDATE public.users SET name = 'x'$q$,
  '42501', NULL,
  'anonymous: any UPDATE of users is refused outright');


-- =============================================================================
-- Saving still works, and the counter moves (C3, T-05-16-03)
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005001');

-- 20. The counter trigger runs inside this INSERT. As SECURITY INVOKER under
-- the column grant it raised "permission denied for table users" (measured).
-- lives_ok, not results_eq, so that raise is reported as this row failing
-- rather than aborting the file; the integrity read in 21 is the allow proof.
SELECT lives_ok(
  $q$INSERT INTO public.saved_events (user_id, event_id)
     VALUES ('00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-0000000050e1')$q$,
  'student: saving an event is accepted — the counter trigger does not raise');

SELECT tests.act_as_owner();

-- 21. INTEGRITY for 20: the saved row exists and the counter moved up.
SELECT results_eq(
  $q$SELECT (SELECT saved_events_count FROM public.users WHERE id = '00000000-0000-4000-8000-000000005001'),
            (SELECT count(*)::int FROM public.saved_events
              WHERE user_id = '00000000-0000-4000-8000-000000005001'
                AND event_id = '00000000-0000-4000-8000-0000000050e1')$q$,
  $q$VALUES (1, 1)$q$,
  'with RLS bypassed: S''s saved row exists and saved_events_count is 1 after the save');

SELECT tests.act_as('00000000-0000-4000-8000-000000005001');

-- 22. Unsaving runs the same trigger's DELETE arm.
SELECT lives_ok(
  $q$DELETE FROM public.saved_events
      WHERE user_id = '00000000-0000-4000-8000-000000005001'
        AND event_id = '00000000-0000-4000-8000-0000000050e1'$q$,
  'student: unsaving the event is accepted — the counter trigger does not raise');

SELECT tests.act_as_owner();

-- 23. INTEGRITY for 22: the row is gone and the counter moved back down.
SELECT results_eq(
  $q$SELECT (SELECT saved_events_count FROM public.users WHERE id = '00000000-0000-4000-8000-000000005001'),
            (SELECT count(*)::int FROM public.saved_events WHERE user_id = '00000000-0000-4000-8000-000000005001')$q$,
  $q$VALUES (0, 0)$q$,
  'with RLS bypassed: after S unsaves, the saved_events row is gone and the counter is back to 0');

SELECT * FROM finish();
ROLLBACK;
