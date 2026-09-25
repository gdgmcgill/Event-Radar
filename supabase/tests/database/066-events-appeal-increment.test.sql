-- =============================================================================
-- 066-events-appeal-increment.test.sql — the events appeal transition must be
-- counted: a creator's rejected | suspended → pending reset has to raise
-- appeal_count by exactly one, in both directions.
--
-- Review fix REVIEW-05 iter3 WR-02 against
-- supabase/migrations/20260925130000_events_guard_appeal_increment.sql, which
-- replaces the body of the trigger function 20260925120000 created. 065 keeps
-- pinning the rest of that guard (its rows 13, 22 and 23 cover the lowered
-- counter and the +1 appeal).
--
-- WHAT WAS WRONG. The appeal arm admitted any rejected | suspended → pending
-- update, so `PATCH /rest/v1/events?id=eq.<id> {"status":"pending"}` with the
-- creator's own JWT skipped POST /api/events/[id]/appeal: no appeal review
-- row, no admin notification, appeal_count unchanged (the moderation
-- dashboard's `.gt("appeal_count", 0)` then shows a first-time submission),
-- and no limit on repeating it.
--
-- ASSERTION SHAPES, as in 065: a refusal is throws_ok(…, '42501'); an
-- allowed write is results_eq on RETURNING; the integrity reads at the end
-- run as the table owner.
--
-- THE FIXTURE AND auth.users (D-21), as in 065: `events_created_by_fkey` is
-- dropped inside this file's transaction, no auth.users row is written, and
-- the final ROLLBACK restores the constraint. Literal ids in the
-- 00000000-0000-4000-8000-0000000066xx block and no seed row, so the file
-- runs identically unseeded and seeded.
-- =============================================================================

BEGIN;
SELECT plan(12);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role (owns the tables, bypasses RLS).
--
--   C  creator  — roles {user}
--   X  admin    — roles {user,admin}
--
--   a1  C, rejected,  appeal_count 0   (the WR-02 bypass target, then appealed)
--   a2  C, suspended, appeal_count 2   (uncounted reset refused, then appealed)
--   a3  C, rejected,  appeal_count 0   (over-counted and uncounted resets refused)
--   a4  C, rejected,  appeal_count 0   (the admin resets it without a count)
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name, roles) VALUES
  ('00000000-0000-4000-8000-000000006601', 'pgtap-066-creator@mail.mcgill.ca', 'T066 Creator C', '{user}'),
  ('00000000-0000-4000-8000-000000006603', 'pgtap-066-admin@mail.mcgill.ca',   'T066 Admin X',   '{user,admin}');

ALTER TABLE public.events DROP CONSTRAINT events_created_by_fkey;

INSERT INTO public.events (id, title, description, start_date, end_date, club_id, created_by, status, appeal_count) VALUES
  ('00000000-0000-4000-8000-0000000066e1', 'T066 a1', 'd1', '2031-04-01T18:00:00Z', '2031-04-01T20:00:00Z', NULL, '00000000-0000-4000-8000-000000006601', 'rejected',  0),
  ('00000000-0000-4000-8000-0000000066e2', 'T066 a2', 'd2', '2031-04-02T18:00:00Z', '2031-04-02T20:00:00Z', NULL, '00000000-0000-4000-8000-000000006601', 'suspended', 2),
  ('00000000-0000-4000-8000-0000000066e3', 'T066 a3', 'd3', '2031-04-03T18:00:00Z', '2031-04-03T20:00:00Z', NULL, '00000000-0000-4000-8000-000000006601', 'rejected',  0),
  ('00000000-0000-4000-8000-0000000066e4', 'T066 a4', 'd4', '2031-04-04T18:00:00Z', '2031-04-04T20:00:00Z', NULL, '00000000-0000-4000-8000-000000006601', 'rejected',  0);


-- =============================================================================
-- Schema shape
-- =============================================================================

-- 1. The replaced function body carries the new rule (the migration applied).
SELECT ok(
  position('an appeal must raise appeal_count by exactly one'
           IN pg_get_functiondef('public.events_guard_moderated_update()'::regprocedure)) > 0,
  'events_guard_moderated_update requires the appeal to raise appeal_count by one');

-- 2. The trigger still points at that function and is enabled.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.events'::regclass
       AND t.tgname = 'events_guard_moderated_update'
       AND t.tgfoid = 'public.events_guard_moderated_update()'::regprocedure
       AND t.tgenabled = 'O'
       AND NOT t.tgisinternal),
  'events_guard_moderated_update is still the enabled trigger on public.events');


-- =============================================================================
-- The creator C — refused: an appeal reset that is not counted exactly once
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006601');

-- 3. Impersonation is real, or every deny below passes for the wrong reason.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000006601'::uuid,
          'act_as moved auth.uid() to the creator — impersonation is real');

-- 4. THE WR-02 BYPASS: rejected → pending with the counter unchanged.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending'
      WHERE id = '00000000-0000-4000-8000-0000000066e1'$q$,
  '42501', NULL,
  'creator: rejected → pending without raising appeal_count is refused');

-- 5. The same bypass while rewriting the rejected content in one statement.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending', title = 'T066 a1 rewritten', description = 'new'
      WHERE id = '00000000-0000-4000-8000-0000000066e1'$q$,
  '42501', NULL,
  'creator: an uncounted reset that also rewrites the content is refused');

-- 6. suspended → pending with the counter unchanged.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending'
      WHERE id = '00000000-0000-4000-8000-0000000066e2'$q$,
  '42501', NULL,
  'creator: suspended → pending without raising appeal_count is refused');

-- 7. Over-counting is not an appeal either.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending', appeal_count = appeal_count + 2
      WHERE id = '00000000-0000-4000-8000-0000000066e3'$q$,
  '42501', NULL,
  'creator: an appeal reset that raises appeal_count by two is refused');


-- =============================================================================
-- The creator C — allowed: the write POST /api/events/[id]/appeal makes
-- =============================================================================

-- 8. rejected → pending, appeal_count + 1, filtered on the old status.
SELECT results_eq(
  $q$UPDATE public.events
        SET status = 'pending', appeal_count = appeal_count + 1, updated_at = now()
      WHERE id = '00000000-0000-4000-8000-0000000066e1' AND status = 'rejected'
      RETURNING status || '|' || appeal_count$q$,
  ARRAY['pending|1'],
  'creator: the appeal route''s write (rejected → pending, appeal_count + 1) is allowed');

-- 9. suspended → pending, appeal_count + 1.
SELECT results_eq(
  $q$UPDATE public.events
        SET status = 'pending', appeal_count = appeal_count + 1, updated_at = now()
      WHERE id = '00000000-0000-4000-8000-0000000066e2' AND status = 'suspended'
      RETURNING status || '|' || appeal_count$q$,
  ARRAY['pending|3'],
  'creator: the appeal route''s write (suspended → pending, appeal_count + 1) is allowed');


-- =============================================================================
-- The admin X: outside the guard, as before
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006603');

-- 10
SELECT results_eq(
  $q$UPDATE public.events SET status = 'pending'
      WHERE id = '00000000-0000-4000-8000-0000000066e4'
      RETURNING status || '|' || appeal_count$q$,
  ARRAY['pending|0'],
  'admin: resetting a rejected event to pending without a count is allowed');


-- =============================================================================
-- Integrity: every refused write left its row untouched (RLS bypassed).
-- =============================================================================

SELECT tests.act_as_owner();

-- 11. a3 was refused twice and is unchanged.
SELECT results_eq(
  $q$SELECT status || '|' || appeal_count || '|' || title
       FROM public.events
      WHERE id = '00000000-0000-4000-8000-0000000066e3'$q$,
  ARRAY['rejected|0|T066 a3'],
  'a3 kept its rejected status, its counter and its title');

-- 12. a1 and a2 moved only by their counted appeals; a1's content is intact.
SELECT results_eq(
  $q$SELECT id::text || '|' || status || '|' || appeal_count || '|' || title || '|' || description
       FROM public.events
      WHERE id IN ('00000000-0000-4000-8000-0000000066e1',
                   '00000000-0000-4000-8000-0000000066e2')
      ORDER BY id$q$,
  ARRAY[
    '00000000-0000-4000-8000-0000000066e1|pending|1|T066 a1|d1',
    '00000000-0000-4000-8000-0000000066e2|pending|3|T066 a2|d2'
  ],
  'a1 and a2 moved only by their counted appeals; the refused rewrite left a1''s content');

SELECT * FROM finish();
ROLLBACK;
