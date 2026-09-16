-- =============================================================================
-- 20260915230100_cron_compute_user_scores.sql
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
-- Requirement REFAC-03
--
-- CLOSES (in part): F-042 — all three pg_cron jobs exist only in production;
--         the repository's sole trace is a commented-out schedule line in a
--         never-applied migration.
--
-- SCOPE. REFAC-03 names `compute_user_scores` and only that job. The other two
-- live jobs — `send-event-reminders` (*/15 * * * *) and `send-feedback-requests`
-- (*/30 * * * *) — remain production-only, so F-042 is NARROWED by this
-- migration, not closed. F-037 (two dead Next.js handlers duplicating live
-- pg_cron functions) is adjacent but is a source-code finding; both belong to
-- Phase 5.
--
-- PROVENANCE. The job name, schedule expression and command below are
-- byte-identical to `.planning/audit/async/cron-job.json`, which is a read of
-- production's own `cron.job` catalog captured under the AR-12 envelope. They
-- are NOT taken from migration history: `cron.schedule` appears in 0 of the 45
-- production history rows, and the repository's only trace is a commented-out
-- line in the archived, never-applied `20260313000002_recommendation_engine.sql`.
-- History cannot be the source here because history never recorded it.
--
-- WHY THE LITERALS MATTER. `030-cron-schedule.test.sql` asserts exactly these
-- two literals. If this migration and that test drift from production, a local
-- or staging environment silently never scores anyone, `user_event_scores`
-- stays empty (F-041), and every recommendation falls back to popularity
-- ranking with nothing failing — which is the condition REFAC-03 exists to end.
--
-- IDEMPOTENT BY CONSTRUCTION, and deliberately not by exception-swallowing.
-- `cron.unschedule(name)` RAISES when no such job exists, so the guard reads
-- the job catalog instead. A block that caught and discarded the exception
-- would be indistinguishable from a block that did nothing at all.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'compute-user-scores') THEN
    PERFORM cron.unschedule('compute-user-scores');
  END IF;
END
$$;

SELECT cron.schedule(
  'compute-user-scores',
  '0 */6 * * *',
  $job$SELECT compute_user_scores()$job$
);
