-- =============================================================================
-- 040-seed-coverage.test.sql — REFAC-07's coverage claim, asserted at the tier
-- that can actually see the rows
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
--
-- REFAC-07 says the seed covers "every user role, ban state, club status, and
-- event status". A sentence in a summary cannot be regression-tested. This file
-- turns each of those four axes into assertions that fail when a later change
-- silently drops a state, which is the only way the claim stays true.
--
-- THE FOUR AXES ARE ENUMERATED FROM THE SCHEMA, NOT FROM THE PLAN.
--   roles          — all three values of the `user_role` enum
--   ban states     — the complete truth table of the expression src/proxy.ts
--                    evaluates: banned_at IS NOT NULL AND (expiry IS NULL OR
--                    expiry > now()). Four rows, including the expired
--                    suspension that LOOKS banned and must not be treated as it
--   club statuses  — pending / approved / rejected
--   event statuses — all FOUR values `events_status_check` permits. The plan
--                    named three; the constraint allows a fourth ('suspended')
--                    and seeding it costs one row, so the gap is closed here
--                    rather than described in a deferral
--
-- WHY THIS FILE SKIPS INSTEAD OF FAILING WHEN THE SEED IS ABSENT.
--   `supabase test db` runs every file in this directory, and the type-drift CI
--   job runs it immediately after a bare `supabase db reset` with no seed. These
--   assertions would fail there for a reason that has nothing to do with the
--   schema that job exists to check. So each assertion is guarded by a seed
--   sentinel and emits a TAP SKIP with its reason when the seed is not loaded —
--   visible in the output, never silent, and never a false green. The end-to-end
--   CI job loads the seed FIRST and then runs this command, which is where these
--   assertions actually execute.
--
-- The sentinel is the admin persona's fixed id. `personas.ts` is the only other
-- place that literal appears.
-- =============================================================================

BEGIN;
SELECT plan(21);

CREATE OR REPLACE FUNCTION pg_temp.seeded() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = '5eed0000-0000-4000-8000-000000000007'
  );
$$;

-- The pinned instant from scripts/seed/clock.ts appears as a literal in the
-- assertions below rather than behind a helper: format() cannot be used to
-- inject it, because the LIKE patterns in the same statements contain a % that
-- format() reads as a specifier and rejects. Restating the literal is the lesser
-- evil, and the 5eed sentinel prefix means a drift fails loudly rather than
-- silently matching nothing.

CREATE OR REPLACE FUNCTION pg_temp.why() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT 'seed not loaded — run `npx tsx scripts/seed/load.ts` after `supabase db reset`';
$$;


-- -----------------------------------------------------------------------------
-- 1. Every value of the user_role enum is held by at least one seeded user (3)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users WHERE 'user'::public.user_role = ANY(roles) $$,
    'seed covers role: user')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users WHERE 'club_organizer'::public.user_role = ANY(roles) $$,
    'seed covers role: club_organizer')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users WHERE 'admin'::public.user_role = ANY(roles) $$,
    'seed covers role: admin')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 2. The complete ban truth table (4)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users
        WHERE id::text LIKE '5eed0000-%' AND banned_at IS NULL $$,
    'seed covers ban state: not banned')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users
        WHERE banned_at IS NOT NULL AND ban_expires_at IS NULL $$,
    'seed covers ban state: permanent ban (no expiry)')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users
        WHERE banned_at IS NOT NULL
          AND ban_expires_at > '2026-06-01T16:00:00.000Z'::timestamptz $$,
    'seed covers ban state: active suspension (expiry after the pinned now)')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users
        WHERE banned_at IS NOT NULL
          AND ban_expires_at < '2026-06-01T16:00:00.000Z'::timestamptz $$,
    'seed covers ban state: EXPIRED suspension — looks banned, must not be treated as banned')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 3. Both onboarding states, because the proxy guards on one of them (2)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users WHERE onboarding_completed IS TRUE $$,
    'seed covers onboarding: completed')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty(
    $$ SELECT 1 FROM public.users WHERE onboarding_completed IS FALSE $$,
    'seed covers onboarding: mid-onboarding')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 4. Every club status (3)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.clubs WHERE status = 'pending' $$,
             'seed covers club status: pending')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.clubs WHERE status = 'approved' $$,
             'seed covers club status: approved')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.clubs WHERE status = 'rejected' $$,
             'seed covers club status: rejected')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 5. Every event status the check constraint permits (4)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.events WHERE status = 'pending' $$,
             'seed covers event status: pending')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.events WHERE status = 'approved' $$,
             'seed covers event status: approved')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.events WHERE status = 'rejected' $$,
             'seed covers event status: rejected')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.events WHERE status = 'suspended' $$,
             'seed covers event status: suspended — the fourth value the constraint allows')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 6. Club membership shapes the authorization ring reads (3)
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.club_members WHERE role = 'owner' $$,
             'seed covers membership role: owner — what is_club_owner reads')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  isnt_empty($$ SELECT 1 FROM public.club_members WHERE role = 'organizer' $$,
             'seed covers membership role: organizer — a non-owning member')
  ELSE skip(pg_temp.why()) END;

-- The cross-club attacker exists to be somewhere ELSE. If a later edit puts it
-- in the approved club, every cross-tenant assertion built on it quietly stops
-- testing anything.
SELECT CASE WHEN pg_temp.seeded() THEN
  is_empty(
    $$ SELECT 1 FROM public.club_members
        WHERE user_id = '5eed0000-0000-4000-8000-000000000006'
          AND club_id = '5eed0000-0000-4000-8000-0000000000c1' $$,
    'cross-club attacker belongs to no club the club owner owns')
  ELSE skip(pg_temp.why()) END;


-- -----------------------------------------------------------------------------
-- 7. The timestamps are pinned, not wall-clock (2)
--    This is the determinism contract, asserted where the rows live.
-- -----------------------------------------------------------------------------

SELECT CASE WHEN pg_temp.seeded() THEN
  is_empty(
    $$ SELECT 1 FROM public.users
        WHERE id::text LIKE '5eed0000-%'
          AND (created_at <> '2026-06-01T16:00:00.000Z'::timestamptz
            OR updated_at <> '2026-06-01T16:00:00.000Z'::timestamptz) $$,
    'every seeded user carries the pinned stamp, not a wall-clock one')
  ELSE skip(pg_temp.why()) END;

SELECT CASE WHEN pg_temp.seeded() THEN
  is_empty(
    $$ SELECT 1 FROM public.events
        WHERE id::text LIKE '5eed0000-%'
          AND (created_at <> '2026-06-01T16:00:00.000Z'::timestamptz
            OR updated_at <> '2026-06-01T16:00:00.000Z'::timestamptz) $$,
    'every seeded event carries the pinned stamp, not a wall-clock one')
  ELSE skip(pg_temp.why()) END;


SELECT * FROM finish();
ROLLBACK;
