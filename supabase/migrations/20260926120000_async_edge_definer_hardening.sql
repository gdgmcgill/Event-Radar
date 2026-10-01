-- =============================================================================
-- 20260926120000_async_edge_definer_hardening.sql
-- Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-05
-- Requirements REFAC-14, REFAC-22 (input) · DEC-68, DEC-70, DEC-71
--
-- CLOSES (local, pending DI-23): F-042, F-074, F-075, F-076, F-093, and adds
-- REFAC-22's `public.cron_job_status()` (C4).
--
-- FIX FORWARD, NEVER EDIT IN PLACE. `20260915214553_baseline.sql` and
-- `20260915230100_cron_compute_user_scores.sql` are not touched. This file
-- declares two jobs, revokes grants, pins search_path with ALTER FUNCTION, and
-- replaces three function bodies with CREATE OR REPLACE (same name, same
-- signature, same return type, same volatility), so every caller and the
-- generated types keep their shape. The only new object is cron_job_status().
--
-- IDEMPOTENT ON ITS OWN. The jobs use the unschedule-if-exists guard of
-- 20260915230100 (read the catalog, never swallow the exception); CREATE OR
-- REPLACE, REVOKE, GRANT and ALTER FUNCTION … SET are all re-runnable.
--
-- BLAST RADIUS, STATED PLAINLY. Like every Phase 4-6 migration, this file
-- exists locally only until the production migration-history repair (DI-23,
-- Phase 8) applies it. It changes no production behaviour today, and the app
-- depends on none of it: the revokes only remove anon reach, the friends
-- predicate is additive (every cookie-client caller already passes its own
-- id), and health maps a missing cron_job_status() (PGRST202) to "unknown".
--
-- =============================================================================
-- WHAT WAS WRONG
-- =============================================================================
--
-- F-042. Production runs three pg_cron jobs; the repository declared one. A
--   database built from this folder never sent a reminder or a feedback
--   request, with nothing failing.
-- F-075 (High). compute_user_scores(), send_event_reminders() and
--   send_feedback_requests() are SECURITY DEFINER writers owned by postgres,
--   and baseline.sql:2716-2719 default-grants every function in public to
--   anon and authenticated (PUBLIC also holds EXECUTE). Measured:
--   `SET ROLE anon; SELECT public.send_event_reminders()` succeeds
--   (evidence/definer-hardening-red.txt).
-- F-076. None of those three, nor the two friends functions, pinned
--   search_path.
-- F-074 (High). get_friends(target_user_id) and
--   get_friends_going_to_event(current_user_id, target_event_id) answered for
--   any subject the caller named: user A could list user B's friends.
-- F-093 (Medium). send_event_reminders() had no `deleted_at IS NULL` and no
--   `status = 'approved'` filter, so it reminded users about soft-deleted and
--   unapproved events (the database half of F-037's divergence #3).
-- C4. /api/health needs pg_cron freshness; service_role has no USAGE on
--   schema cron and PostgREST exposes only the API schemas.
--
-- =============================================================================
-- WHAT IT NOW SAYS
-- =============================================================================
--
-- 1. F-042: send-event-reminders (*/15) and send-feedback-requests (*/30) are
--    declared with schedule and command literals byte-identical to
--    `.planning/audit/async/cron-job.json` — including the case difference
--    between `select` and `SELECT` (C25). compute-user-scores stays with its
--    own migration.
-- 2. F-075 + F-076, NO BODY CHANGE (C6, DEC-68): EXECUTE is revoked from
--    PUBLIC, anon and authenticated on compute_user_scores() and
--    send_feedback_requests(), and their search_path is pinned with ALTER
--    FUNCTION. md5(prosrc) stays ed64959b44c9329a1212cde928810010 (compute)
--    and c69a62ad437efb7e875517f6b94c3b4b (feedback); pgTAP 070 pins both.
--    The scoring formula (REFAC-14) is untouched.
-- 3. F-093 (INTENTIONAL BEHAVIOUR CHANGE): send_event_reminders() keeps its
--    baseline body except that both reminder loops now read only approved,
--    non-deleted events; search_path is pinned; the same REVOKE follows.
-- 4. F-074 (C5): both friends functions keep their signatures and gain
--    `SET search_path = ''`, schema-qualified relations and the predicate
--    "the subject is the caller, or the caller is service_role". The elevated
--    door (service_role) therefore keeps the public-profile read at
--    src/app/users/[id]/page.tsx. EXECUTE is revoked from PUBLIC and anon;
--    authenticated and service_role keep it.
-- 5. C4: public.cron_job_status() — SECURITY DEFINER, search_path '', one row
--    per job with its newest run — executable by service_role only, after an
--    explicit revoke from PUBLIC, anon and authenticated (the default
--    privileges would otherwise hand it to both API roles).
--
-- NOT HERE, DELIBERATELY. DI-82 (POST /api/recommendations/batch answers 500
-- because PostgREST's preloaded safeupdate refuses compute_user_scores()'
-- unqualified DELETE) needs a body change, and this file pins that body; it
-- is left to its owner (06-06), where the md5 pin is re-derived.
--
-- pgTAP: supabase/tests/database/031-cron-jobs.test.sql and
-- supabase/tests/database/070-definer-functions.test.sql, red before this file
-- and green after it (evidence/definer-hardening-red.txt,
-- evidence/schema-push-slice-6.txt, evidence/slice-6-mutation-check.txt).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. F-042 — the two production-only jobs, literals from cron-job.json
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-event-reminders') THEN
    PERFORM cron.unschedule('send-event-reminders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-feedback-requests') THEN
    PERFORM cron.unschedule('send-feedback-requests');
  END IF;
END
$$;

SELECT cron.schedule(
  'send-event-reminders',
  '*/15 * * * *',
  $job$select public.send_event_reminders()$job$
);

SELECT cron.schedule(
  'send-feedback-requests',
  '*/30 * * * *',
  $job$SELECT public.send_feedback_requests()$job$
);


-- -----------------------------------------------------------------------------
-- 2. F-075 + F-076 — compute and feedback: grants and path only, bodies kept
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.compute_user_scores(), public.send_feedback_requests()
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.compute_user_scores()    SET search_path = public, pg_temp;
ALTER FUNCTION public.send_feedback_requests() SET search_path = public, pg_temp;


-- -----------------------------------------------------------------------------
-- 3. F-093 — reminders only for approved, non-deleted events
--    (INTENTIONAL BEHAVIOUR CHANGE; body otherwise byte-for-byte the baseline's)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_event_reminders() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
declare
  row record;
  cnt int;
  sent_24h int := 0;
  sent_1h int := 0;
begin
  -- 24-hour reminders: events starting between now+23h and now+25h
  for row in
    select se.user_id, e.id as event_id, e.title
    from saved_events se
    join events e on e.id = se.event_id
    where e.start_date between (now() + interval '23 hours') and (now() + interval '25 hours')
      AND e.deleted_at IS NULL
      AND e.status = 'approved'
  loop
    select count(*) into cnt
    from notifications
    where user_id = row.user_id
      and event_id = row.event_id
      and type = 'reminder_24h';

    if cnt = 0 then
      insert into notifications (user_id, type, title, message, event_id)
      values (
        row.user_id,
        'reminder_24h',
        'Event Tomorrow',
        '"' || row.title || '" starts in about 24 hours.',
        row.event_id
      );
      sent_24h := sent_24h + 1;
    end if;
  end loop;

  -- 1-hour reminders: events starting between now+55min and now+65min
  for row in
    select se.user_id, e.id as event_id, e.title
    from saved_events se
    join events e on e.id = se.event_id
    where e.start_date between (now() + interval '55 minutes') and (now() + interval '65 minutes')
      AND e.deleted_at IS NULL
      AND e.status = 'approved'
  loop
    select count(*) into cnt
    from notifications
    where user_id = row.user_id
      and event_id = row.event_id
      and type = 'reminder_1h';

    if cnt = 0 then
      insert into notifications (user_id, type, title, message, event_id)
      values (
        row.user_id,
        'reminder_1h',
        'Event Starting Soon',
        '"' || row.title || '" starts in about 1 hour!',
        row.event_id
      );
      sent_1h := sent_1h + 1;
    end if;
  end loop;

  return jsonb_build_object('24h', sent_24h, '1h', sent_1h, 'checked_at', now());
end;
$$;

REVOKE EXECUTE ON FUNCTION public.send_event_reminders() FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. F-074 (C5) — friends reads bound to the caller, or to the elevated door
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_friends(target_user_id uuid)
    RETURNS TABLE(id uuid, name text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = ''
    AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM public.users u
  JOIN public.user_follows f1 ON f1.following_id = u.id AND f1.follower_id = target_user_id
  JOIN public.user_follows f2 ON f2.follower_id = u.id AND f2.following_id = target_user_id
  WHERE (target_user_id = (SELECT auth.uid()) OR (SELECT auth.role()) = 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.get_friends_going_to_event(current_user_id uuid, target_event_id uuid)
    RETURNS TABLE(id uuid, name text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = ''
    AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM public.users u
  JOIN public.saved_events se ON se.user_id = u.id AND se.event_id = target_event_id
  JOIN public.user_follows f1 ON f1.following_id = u.id AND f1.follower_id = current_user_id
  JOIN public.user_follows f2 ON f2.follower_id = u.id AND f2.following_id = current_user_id
  WHERE (current_user_id = (SELECT auth.uid()) OR (SELECT auth.role()) = 'service_role');
$$;

REVOKE EXECUTE ON FUNCTION public.get_friends(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_friends_going_to_event(uuid, uuid) FROM PUBLIC, anon;


-- -----------------------------------------------------------------------------
-- 5. C4 — pg_cron freshness for /api/health, service_role only (REFAC-22)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cron_job_status()
    RETURNS TABLE(jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = ''
    AS $$
  SELECT j.jobname, j.schedule, j.active, r.start_time, r.status
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) r ON true
  ORDER BY j.jobname;
$$;

REVOKE ALL ON FUNCTION public.cron_job_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_job_status() TO service_role;


-- =============================================================================
-- Deliberately unchanged
--
-- * supabase/config.toml needs no change (C3): pg_cron is in the local image's
--   shared_preload_libraries and the extension is created by 20260915230100.
-- * Default privileges (baseline.sql:2716-2719) are deliberately NOT altered;
--   every function above that must not be public is revoked explicitly, and
--   pgTAP 070 asserts each of those grants. A FUTURE function in public still
--   inherits anon and authenticated EXECUTE and must revoke it itself (06-RESEARCH
--   Pitfall 2); 070's F-076 invariant only guarantees it pins search_path.
-- * pg_cron runs every job as `postgres` (cron-job.json `username`), the owner
--   of these functions; none of the revokes above apply to it, so the three
--   jobs keep running exactly as in production.
-- =============================================================================
