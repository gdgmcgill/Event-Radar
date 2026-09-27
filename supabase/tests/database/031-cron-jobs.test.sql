-- =============================================================================
-- 031-cron-jobs.test.sql — all three production pg_cron jobs are repository
-- truth (F-042)
-- Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-05
-- Requirement REFAC-14 · migration 20260926120000_async_edge_definer_hardening.sql
--
-- WHAT WAS WRONG (F-042). Production runs three pg_cron jobs. Until this plan
-- the repository declared one of them (`compute-user-scores`, plan 03-05), so a
-- database built from `supabase/migrations/` never sent a 24-hour or 1-hour
-- reminder and never asked anyone for feedback — with nothing failing.
--
-- THE LITERALS ARE PRODUCTION'S OWN, copied byte for byte from
-- `.planning/audit/async/cron-job.json` (a read of production's `cron.job`
-- catalog), never retyped from memory. They are NOT uniformly cased (C25):
--
--   send-event-reminders    */15 * * * *   select public.send_event_reminders()
--   compute-user-scores     0 */6 * * *    SELECT compute_user_scores()
--   send-feedback-requests  */30 * * * *   SELECT public.send_feedback_requests()
--
-- A "normalised" command would pass a looser test and disagree with production.
--
-- ASSERTION SHAPES. Per job: exactly one row by name (the idempotence of the
-- unschedule-if-exists guard, as in 030), the schedule literal, the command
-- literal and `active`. Then one catalog-wide count: the local catalog holds
-- exactly production's three jobs, no more.
--
-- NO FIXTURE. The jobs come from migrations, so the file reads the catalog
-- only and runs identically unseeded and seeded. 030 keeps pinning
-- compute-user-scores on its own; its rows are repeated here so that this file
-- alone describes the whole production schedule.
-- =============================================================================

BEGIN;
SELECT plan(13);


-- -----------------------------------------------------------------------------
-- send-event-reminders — every 15 minutes, lower-case command (C25)
-- -----------------------------------------------------------------------------

-- 1.
SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname = 'send-event-reminders'),
          1,
          'exactly one send-event-reminders job exists (F-042) — the migration is idempotent');

-- 2.
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'send-event-reminders'),
          '*/15 * * * *',
          'send-event-reminders runs every fifteen minutes, as it does in production');

-- 3.
SELECT is((SELECT command FROM cron.job WHERE jobname = 'send-event-reminders'),
          'select public.send_event_reminders()',
          'send-event-reminders command is byte-identical to production (lower-case select)');

-- 4.
SELECT ok(coalesce((SELECT active FROM cron.job WHERE jobname = 'send-event-reminders'), false),
          'send-event-reminders is active');


-- -----------------------------------------------------------------------------
-- compute-user-scores — every six hours (declared by 20260915230100, 030)
-- -----------------------------------------------------------------------------

-- 5.
SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname = 'compute-user-scores'),
          1,
          'exactly one compute-user-scores job exists');

-- 6.
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'compute-user-scores'),
          '0 */6 * * *',
          'compute-user-scores runs every six hours, as it does in production');

-- 7.
SELECT is((SELECT command FROM cron.job WHERE jobname = 'compute-user-scores'),
          'SELECT compute_user_scores()',
          'compute-user-scores command is byte-identical to production');

-- 8.
SELECT ok(coalesce((SELECT active FROM cron.job WHERE jobname = 'compute-user-scores'), false),
          'compute-user-scores is active');


-- -----------------------------------------------------------------------------
-- send-feedback-requests — every 30 minutes, upper-case command (C25)
-- -----------------------------------------------------------------------------

-- 9.
SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname = 'send-feedback-requests'),
          1,
          'exactly one send-feedback-requests job exists (F-042) — the migration is idempotent');

-- 10.
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'send-feedback-requests'),
          '*/30 * * * *',
          'send-feedback-requests runs every thirty minutes, as it does in production');

-- 11.
SELECT is((SELECT command FROM cron.job WHERE jobname = 'send-feedback-requests'),
          'SELECT public.send_feedback_requests()',
          'send-feedback-requests command is byte-identical to production (upper-case SELECT)');

-- 12.
SELECT ok(coalesce((SELECT active FROM cron.job WHERE jobname = 'send-feedback-requests'), false),
          'send-feedback-requests is active');


-- -----------------------------------------------------------------------------
-- The whole catalog
-- -----------------------------------------------------------------------------

-- 13.
SELECT results_eq(
  $q$SELECT jobname FROM cron.job ORDER BY jobname$q$,
  ARRAY['compute-user-scores', 'send-event-reminders', 'send-feedback-requests'],
  'the local cron catalog holds exactly production''s three jobs, one row per name');

SELECT * FROM finish();
ROLLBACK;
