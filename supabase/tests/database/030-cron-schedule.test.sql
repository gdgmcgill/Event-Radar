-- =============================================================================
-- 030-cron-schedule.test.sql — the compute_user_scores schedule (REFAC-03)
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
--
-- The two literals asserted below are production's own, read from
-- `.planning/audit/async/cron-job.json` — the live `cron.job` catalog — and NOT
-- from migration history, which never recorded the schedule at all.
--
-- The count assertion is the idempotence assertion, and it is what makes a
-- double reset meaningful. `cron.schedule` with an existing name updates in
-- place in some pg_cron versions and duplicates in others; asserting exactly
-- one job is how the unschedule-then-schedule guard in the migration stops
-- being decorative.
-- =============================================================================

BEGIN;
SELECT plan(4);

SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname = 'compute-user-scores'),
          1,
          'exactly one compute-user-scores job exists — the migration is idempotent');

SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'compute-user-scores'),
          '0 */6 * * *',
          'compute-user-scores runs every six hours, as it does in production');

SELECT is((SELECT command FROM cron.job WHERE jobname = 'compute-user-scores'),
          'SELECT compute_user_scores()',
          'compute-user-scores calls the scoring function, byte-identical to production');

SELECT ok((SELECT active FROM cron.job WHERE jobname = 'compute-user-scores'),
          'compute-user-scores is active — a scheduled-but-inactive job scores nobody');

SELECT * FROM finish();
ROLLBACK;
