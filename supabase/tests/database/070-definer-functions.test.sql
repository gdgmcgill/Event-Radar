-- =============================================================================
-- 070-definer-functions.test.sql — the SECURITY DEFINER surface of the async
-- edge: who may execute it, what path it resolves names on, whom the friends
-- reads answer for, which events the reminders cover, and the service-only
-- cron status read health depends on.
-- Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-05
-- Requirements REFAC-14, REFAC-22 (input) · DEC-68, DEC-70, DEC-71
-- Migration 20260926120000_async_edge_definer_hardening.sql
--
-- WHAT WAS WRONG
--
--   F-075 (High). `compute_user_scores()`, `send_event_reminders()` and
--   `send_feedback_requests()` are SECURITY DEFINER writers owned by postgres,
--   and `baseline.sql:2716-2719` default-grants every function in public to
--   anon and authenticated (plus the implicit PUBLIC grant). So any visitor
--   holding the anon key could rescore every user or send reminders through
--   PostgREST. Measured: `SET ROLE anon; SELECT public.send_event_reminders()`
--   succeeds (evidence/definer-hardening-red.txt).
--   F-076. None of the five baseline definer functions pinned `search_path`.
--   F-074 (High). `get_friends(target_user_id)` and
--   `get_friends_going_to_event(current_user_id, …)` answered for whatever
--   subject the caller named: user A could list user B's friends.
--   F-093 (Medium, INTENTIONAL). `send_event_reminders()` reminded users about
--   soft-deleted and unapproved events.
--   C4. Health needs pg_cron freshness, service_role cannot read schema `cron`,
--   and a new public function is anon-executable by default — so the read is a
--   definer function whose grants must be asserted, not assumed.
--
-- WHAT STAYS (DEC-68, REFAC-14). The scoring formula is not rewritten: the
-- migration pins compute's and feedback's search_path with ALTER FUNCTION
-- only, and this file pins both bodies by md5(prosrc) plus the invariant that
-- every computed score is the sum of its five breakdown parts. The elevated
-- door (service_role) keeps EXECUTE on everything here, and keeps the
-- public-profile friends read (C5, `src/app/users/[id]/page.tsx`).
--
-- ASSERTION SHAPES
--   * privilege   → ok([NOT] has_function_privilege(role, signature, 'EXECUTE'))
--                   for PUBLIC, anon, authenticated and service_role;
--   * refusal     → throws_ok(call, '42501') as the refused role;
--   * row results → is(count, n) or results_eq on ids;
--   * cron_job_status() rows are guarded by to_regprocedure, so on a schema
--     without the function they FAIL with a clear description instead of
--     aborting the file at parse time.
--
-- THE FIXTURE AND auth.users (D-21, as in 065/066). Literal ids in the
-- 00000000-0000-4000-8000-0000000070xx block, written as the session role
-- (owns the tables, bypasses RLS). No auth.users row is written: the two FKs a
-- definer function writes through into auth.users
-- (`notifications_user_id_fkey`, `user_event_scores_user_id_fkey`) are dropped
-- inside this transaction and the final ROLLBACK restores them. No seed row is
-- relied on, so the file runs identically unseeded (CI `types` job) and seeded.
--
-- THE REMINDER AND SCORING CALLS RUN ONLY INSIDE THIS TRANSACTION (DEC-71).
-- Everything they write is rolled back.
--
-- IMPERSONATING THE DOOR. `tests.act_as` covers authenticated users; the door
-- is service_role with `role` = service_role in its JWT claims, which is what
-- `auth.role()` reads. Two helpers are created inside the transaction (rolled
-- back with it). `tests.act_as_owner_070()` also clears
-- `request.jwt.claim.role`, which `tests.act_as_owner()` does not touch: a
-- stale 'service_role' there would make a later `tests.act_as(A)` look like the
-- door to `auth.role()`, and the A-for-B row would pass for the wrong reason.
-- =============================================================================

BEGIN;
SELECT plan(49);


-- -----------------------------------------------------------------------------
-- Helpers (transaction-local)
-- -----------------------------------------------------------------------------

CREATE FUNCTION tests.act_as_service_role_070() RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
END
$$;

CREATE FUNCTION tests.act_as_owner_070() RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM tests.act_as_owner();
  PERFORM set_config('request.jwt.claim.role', '', true);
END
$$;


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role.
--
--   A 7001  asks about friends          C 7003  A's mutual follow (A's friend)
--   B 7002  another user                D 7004  B's mutual follow (B's friend)
--   U 7005  scoring + reminder subject, interest_tags {tech}
--
--   70e1  approved, 10 days out, tags {tech}  — C and D saved it (friends event)
--   70a1  approved, starts now()+24h          — U saved it (must be reminded)
--   70a2  approved, soft-deleted, now()+24h   — U saved it (must NOT be reminded)
--   70a3  pending, now()+24h                  — U saved it (must NOT be reminded)
--
-- now()+24h sits inside send_event_reminders()'s 24-hour window
-- (`now() + 23 hours` .. `now() + 25 hours`, baseline.sql:391) because now()
-- is the transaction start time in both this file and the function.
-- -----------------------------------------------------------------------------

ALTER TABLE public.notifications     DROP CONSTRAINT notifications_user_id_fkey;
ALTER TABLE public.user_event_scores DROP CONSTRAINT user_event_scores_user_id_fkey;

INSERT INTO public.users (id, email, name, roles, interest_tags) VALUES
  ('00000000-0000-4000-8000-000000007001', 'pgtap-070-a@mail.mcgill.ca', 'T070 A', '{user}', '{}'),
  ('00000000-0000-4000-8000-000000007002', 'pgtap-070-b@mail.mcgill.ca', 'T070 B', '{user}', '{}'),
  ('00000000-0000-4000-8000-000000007003', 'pgtap-070-c@mail.mcgill.ca', 'T070 C', '{user}', '{}'),
  ('00000000-0000-4000-8000-000000007004', 'pgtap-070-d@mail.mcgill.ca', 'T070 D', '{user}', '{}'),
  ('00000000-0000-4000-8000-000000007005', 'pgtap-070-u@mail.mcgill.ca', 'T070 U', '{user}', '{tech}');

INSERT INTO public.user_follows (follower_id, following_id) VALUES
  ('00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000007003'),
  ('00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000007001'),
  ('00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000007004'),
  ('00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000007002');

INSERT INTO public.events (id, title, description, start_date, end_date, status, deleted_at, tags) VALUES
  ('00000000-0000-4000-8000-0000000070e1', 'T070 friends event', 'f',
     now() + interval '10 days', now() + interval '10 days 2 hours', 'approved', NULL,  '{tech}'),
  ('00000000-0000-4000-8000-0000000070a1', 'T070 approved',      'r1',
     now() + interval '24 hours', now() + interval '26 hours',       'approved', NULL,  '{tech}'),
  ('00000000-0000-4000-8000-0000000070a2', 'T070 deleted',       'r2',
     now() + interval '24 hours', now() + interval '26 hours',       'approved', now(), '{tech}'),
  ('00000000-0000-4000-8000-0000000070a3', 'T070 pending',       'r3',
     now() + interval '24 hours', now() + interval '26 hours',       'pending',  NULL,  '{tech}');

INSERT INTO public.saved_events (user_id, event_id) VALUES
  ('00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-0000000070e1'),
  ('00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-0000000070e1'),
  ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-0000000070a1'),
  ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-0000000070a2'),
  ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-0000000070a3');


-- =============================================================================
-- REFAC-14 / DEC-68 — the formula is pinned, not changed (green before and after)
-- =============================================================================

-- 1.
-- M0 permits only DI-82's explicit full-table rebuild predicates. Normalize
-- those two statements to keep the original scoring formula byte-for-byte pin.
SELECT is((SELECT md5(replace(replace(prosrc,
            'DELETE FROM tag_interaction_counts WHERE true;', 'DELETE FROM tag_interaction_counts;'),
            'DELETE FROM user_event_scores WHERE true;', 'DELETE FROM user_event_scores;'))
            FROM pg_proc WHERE oid = 'public.compute_user_scores()'::regprocedure),
          'ed64959b44c9329a1212cde928810010',
          'compute_user_scores body is unchanged — the scoring formula is pinned (REFAC-14, DEC-68)');

-- 2.
SELECT is((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.send_feedback_requests()'::regprocedure),
          'c69a62ad437efb7e875517f6b94c3b4b',
          'send_feedback_requests body is unchanged — only its search_path is pinned (C6)');

-- The real PostgREST/safeupdate execution is covered by async-edge.spec.ts.
SELECT ok((SELECT position('DELETE FROM tag_interaction_counts WHERE true;' IN prosrc) > 0
                  AND position('DELETE FROM user_event_scores WHERE true;' IN prosrc) > 0
           FROM pg_proc WHERE oid = 'public.compute_user_scores()'::regprocedure),
          'DI-82: both intentional full rebuilds have explicit predicates');
SELECT lives_ok('SELECT public.compute_user_scores()', 'DI-82: scoring still executes');

-- 3.
SELECT ok((SELECT count(*) FROM public.user_event_scores
            WHERE user_id = '00000000-0000-4000-8000-000000007005') >= 1,
          'compute_user_scores() writes scores for the fixture user (interest {tech})');

-- 4. Each part is ROUND(…, 4) and so is the score, so the sum of five rounded
--    parts may differ from the rounded total by at most 6 × 0.00005 = 0.0003.
--    A row missing any of the five keys counts as a violation (a NULL sum must
--    not slip through the comparison).
SELECT is((SELECT count(*)::int FROM public.user_event_scores s
            WHERE NOT (s.breakdown ?& ARRAY['tag', 'interaction', 'popularity', 'recency', 'social'])
               OR abs(s.score::numeric
                      - ((s.breakdown->>'tag')::numeric
                       + (s.breakdown->>'interaction')::numeric
                       + (s.breakdown->>'popularity')::numeric
                       + (s.breakdown->>'recency')::numeric
                       + (s.breakdown->>'social')::numeric)) > 0.0003),
          0,
          'every computed score equals the sum of its five breakdown parts (REFAC-14 invariant)');


-- =============================================================================
-- F-093 — reminders only for approved, non-deleted events (INTENTIONAL)
-- =============================================================================

DO $$ BEGIN PERFORM public.send_event_reminders(); END $$;

-- 5.
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE user_id = '00000000-0000-4000-8000-000000007005'
              AND event_id = '00000000-0000-4000-8000-0000000070a1'
              AND type = 'reminder_24h'),
          1,
          'the approved event 24 h out gets exactly one reminder_24h');

-- 6.
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE user_id = '00000000-0000-4000-8000-000000007005'
              AND event_id = '00000000-0000-4000-8000-0000000070a2'),
          0,
          'a soft-deleted event gets no reminder (F-093)');

-- 7.
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE user_id = '00000000-0000-4000-8000-000000007005'
              AND event_id = '00000000-0000-4000-8000-0000000070a3'),
          0,
          'a pending (unapproved) event gets no reminder (F-093)');


-- =============================================================================
-- F-076 — every SECURITY DEFINER function in public pins search_path
-- =============================================================================

-- 8. One invariant over the catalog, not a list: a future definer function
--    without a search_path entry turns this red by existing.
SELECT is((SELECT count(*)::int FROM pg_proc p
            WHERE p.prosecdef
              AND p.pronamespace = 'public'::regnamespace
              AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
                               WHERE c LIKE 'search_path=%')),
          0,
          'every SECURITY DEFINER function in public pins search_path (F-076)');

-- 9. Non-vacuity: the invariant ranges over the eleven baseline/Phase 3-5
--    definer functions plus cron_job_status().
SELECT ok((SELECT count(*) FROM pg_proc p
            WHERE p.prosecdef AND p.pronamespace = 'public'::regnamespace) >= 12,
          'the F-076 invariant covers at least twelve definer functions, cron_job_status() included');


-- =============================================================================
-- F-075 — the three scheduled writers are off the public surface
-- =============================================================================

-- 10-13. compute_user_scores
SELECT ok(NOT has_function_privilege('public', 'public.compute_user_scores()', 'EXECUTE'),
          'PUBLIC cannot execute compute_user_scores() (F-075)');
SELECT ok(NOT has_function_privilege('anon', 'public.compute_user_scores()', 'EXECUTE'),
          'anon cannot execute compute_user_scores() (F-075)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.compute_user_scores()', 'EXECUTE'),
          'authenticated cannot rescore every user (F-075)');
SELECT ok(has_function_privilege('service_role', 'public.compute_user_scores()', 'EXECUTE'),
          'service_role keeps compute_user_scores() — the batch route''s elevated door');

-- 14-17. send_event_reminders
SELECT ok(NOT has_function_privilege('public', 'public.send_event_reminders()', 'EXECUTE'),
          'PUBLIC cannot execute send_event_reminders() (F-075)');
SELECT ok(NOT has_function_privilege('anon', 'public.send_event_reminders()', 'EXECUTE'),
          'anon cannot send reminders (F-075)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.send_event_reminders()', 'EXECUTE'),
          'authenticated cannot send reminders (F-075)');
SELECT ok(has_function_privilege('service_role', 'public.send_event_reminders()', 'EXECUTE'),
          'service_role keeps send_event_reminders()');

-- 18-21. send_feedback_requests
SELECT ok(NOT has_function_privilege('public', 'public.send_feedback_requests()', 'EXECUTE'),
          'PUBLIC cannot execute send_feedback_requests() (F-075)');
SELECT ok(NOT has_function_privilege('anon', 'public.send_feedback_requests()', 'EXECUTE'),
          'anon cannot send feedback requests (F-075)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.send_feedback_requests()', 'EXECUTE'),
          'authenticated cannot send feedback requests (F-075)');
SELECT ok(has_function_privilege('service_role', 'public.send_feedback_requests()', 'EXECUTE'),
          'service_role keeps send_feedback_requests()');

-- 22-24. The refusal is real, not only a catalog bit.
SELECT tests.act_as_anon();
SELECT throws_ok('SELECT public.compute_user_scores()', '42501',
                 NULL, 'anon calling compute_user_scores() is refused with 42501');
SELECT throws_ok('SELECT public.send_event_reminders()', '42501',
                 NULL, 'anon calling send_event_reminders() is refused with 42501');
SELECT throws_ok('SELECT public.send_feedback_requests()', '42501',
                 NULL, 'anon calling send_feedback_requests() is refused with 42501');
SELECT tests.act_as_owner_070();


-- =============================================================================
-- F-074 — the friends reads answer for the caller, or for the door (C5)
-- =============================================================================

-- 25-32. Privileges: anon and PUBLIC out; users and the door in.
SELECT ok(NOT has_function_privilege('public', 'public.get_friends(uuid)', 'EXECUTE'),
          'PUBLIC cannot execute get_friends(uuid) (F-074)');
SELECT ok(NOT has_function_privilege('anon', 'public.get_friends(uuid)', 'EXECUTE'),
          'anon cannot execute get_friends(uuid) (F-074)');
SELECT ok(has_function_privilege('authenticated', 'public.get_friends(uuid)', 'EXECUTE'),
          'authenticated keeps get_friends(uuid) — six callsites pass the caller''s own id');
SELECT ok(has_function_privilege('service_role', 'public.get_friends(uuid)', 'EXECUTE'),
          'service_role keeps get_friends(uuid) — the public profile reads through the door');
SELECT ok(NOT has_function_privilege('public', 'public.get_friends_going_to_event(uuid, uuid)', 'EXECUTE'),
          'PUBLIC cannot execute get_friends_going_to_event(uuid, uuid) (F-074)');
SELECT ok(NOT has_function_privilege('anon', 'public.get_friends_going_to_event(uuid, uuid)', 'EXECUTE'),
          'anon cannot execute get_friends_going_to_event(uuid, uuid) (F-074)');
SELECT ok(has_function_privilege('authenticated', 'public.get_friends_going_to_event(uuid, uuid)', 'EXECUTE'),
          'authenticated keeps get_friends_going_to_event(uuid, uuid)');
SELECT ok(has_function_privilege('service_role', 'public.get_friends_going_to_event(uuid, uuid)', 'EXECUTE'),
          'service_role keeps get_friends_going_to_event(uuid, uuid)');

-- 33-34.
SELECT tests.act_as_anon();
SELECT throws_ok($q$SELECT * FROM public.get_friends('00000000-0000-4000-8000-000000007002')$q$,
                 '42501', NULL, 'anon calling get_friends is refused with 42501');
SELECT throws_ok($q$SELECT * FROM public.get_friends_going_to_event('00000000-0000-4000-8000-000000007002',
                                                                  '00000000-0000-4000-8000-0000000070e1')$q$,
                 '42501', NULL, 'anon calling get_friends_going_to_event is refused with 42501');

-- 35-38. User A.
SELECT tests.act_as('00000000-0000-4000-8000-000000007001');

SELECT is((SELECT count(*)::int FROM public.get_friends('00000000-0000-4000-8000-000000007002')),
          0,
          'A asking for B''s friends gets nothing (F-074: the IDOR is closed)');

SELECT results_eq(
  $q$SELECT id FROM public.get_friends('00000000-0000-4000-8000-000000007001')$q$,
  ARRAY['00000000-0000-4000-8000-000000007003'::uuid],
  'A asking for A''s own friends gets C — the six own-id callsites are unchanged');

SELECT is((SELECT count(*)::int FROM public.get_friends_going_to_event(
             '00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-0000000070e1')),
          0,
          'A asking which of B''s friends go to the event gets nothing (F-074)');

SELECT results_eq(
  $q$SELECT id FROM public.get_friends_going_to_event('00000000-0000-4000-8000-000000007001',
                                                     '00000000-0000-4000-8000-0000000070e1')$q$,
  ARRAY['00000000-0000-4000-8000-000000007003'::uuid],
  'A asking which of A''s own friends go to the event gets C');

-- 39-40. The elevated door (service_role) keeps the public-profile read.
SELECT tests.act_as_owner_070();
SELECT tests.act_as_service_role_070();

SELECT results_eq(
  $q$SELECT id FROM public.get_friends('00000000-0000-4000-8000-000000007002')$q$,
  ARRAY['00000000-0000-4000-8000-000000007004'::uuid],
  'service_role asking for B''s friends gets D — /users/[id] still lists a public profile''s friends (C5)');

SELECT results_eq(
  $q$SELECT id FROM public.get_friends_going_to_event('00000000-0000-4000-8000-000000007002',
                                                     '00000000-0000-4000-8000-0000000070e1')$q$,
  ARRAY['00000000-0000-4000-8000-000000007004'::uuid],
  'service_role asking which of B''s friends go to the event gets D');

SELECT tests.act_as_owner_070();


-- =============================================================================
-- C4 — public.cron_job_status(): service_role only (REFAC-22 input)
--
-- Guarded by to_regprocedure: on a schema without the function each row FAILS
-- with its description rather than aborting the file.
-- =============================================================================

-- 41.
SELECT has_function('public', 'cron_job_status', ARRAY[]::name[],
                    'public.cron_job_status() exists (C4)');

-- 42-45.
SELECT ok(coalesce(NOT has_function_privilege('public', to_regprocedure('public.cron_job_status()'), 'EXECUTE'), false),
          'PUBLIC cannot execute cron_job_status() — the default grant is explicitly revoked (C4)');
SELECT ok(coalesce(NOT has_function_privilege('anon', to_regprocedure('public.cron_job_status()'), 'EXECUTE'), false),
          'anon cannot execute cron_job_status() — job names and failure states stay private (C4)');
SELECT ok(coalesce(NOT has_function_privilege('authenticated', to_regprocedure('public.cron_job_status()'), 'EXECUTE'), false),
          'authenticated cannot execute cron_job_status() (C4)');
SELECT ok(coalesce(has_function_privilege('service_role', to_regprocedure('public.cron_job_status()'), 'EXECUTE'), false),
          'service_role can execute cron_job_status() — health reads it through the door');

-- 46.
SELECT tests.act_as('00000000-0000-4000-8000-000000007001');
SELECT CASE
  WHEN to_regprocedure('public.cron_job_status()') IS NULL
    THEN fail('an authenticated caller is refused cron_job_status() with 42501 — FUNCTION ABSENT')
  ELSE throws_ok('SELECT * FROM public.cron_job_status()', '42501', NULL,
                 'an authenticated caller is refused cron_job_status() with 42501')
END;

-- 47.
SELECT tests.act_as_owner_070();
SELECT tests.act_as_service_role_070();
SELECT CASE
  WHEN to_regprocedure('public.cron_job_status()') IS NULL
    THEN fail('as service_role, cron_job_status() lists the three jobs — FUNCTION ABSENT')
  ELSE results_eq(
    $q$SELECT jobname || '|' || schedule || '|' || active::text
         FROM public.cron_job_status() ORDER BY jobname$q$,
    ARRAY['compute-user-scores|0 */6 * * *|true',
          'send-event-reminders|*/15 * * * *|true',
          'send-feedback-requests|*/30 * * * *|true'],
    'as service_role, cron_job_status() lists the three jobs with their schedules')
END;
SELECT tests.act_as_owner_070();

SELECT * FROM finish();
ROLLBACK;
