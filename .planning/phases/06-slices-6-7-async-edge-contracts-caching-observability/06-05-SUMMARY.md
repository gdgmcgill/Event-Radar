---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 05
subsystem: database-async-edge
status: complete
tags: [pgtap, pg_cron, security-definer, search_path, grants, rpc, supabase, migration, F-042, F-074, F-075, F-076, F-093, C4, DEC-68, DEC-70, DEC-71, DI-82, REFAC-14, REFAC-22]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-02: the recommendations PRESERVE pins and DEC-68's md5 values; 06-04: the async-edge e2e spec and DI-82"
provides:
  - "supabase/migrations/20260926120000_async_edge_definer_hardening.sql: the two production-only pg_cron jobs, EXECUTE revoked on the three scheduled writers, search_path pinned without body changes, subject-bound friends RPCs, the F-093 reminder filter, public.cron_job_status()"
  - "public.cron_job_status() RETURNS TABLE(jobname, schedule, active, last_start, last_status), SECURITY DEFINER, search_path '', EXECUTE for service_role only (the input 06-17's health check reads)"
  - "supabase/tests/database/031-cron-jobs.test.sql (13) and 070-definer-functions.test.sql (47): red before, green after, unseeded and seeded"
  - "src/lib/supabase/types.ts regenerated with --local: exactly the cron_job_status RPC entry"
  - "evidence/definer-hardening-red.txt, evidence/schema-push-slice-6.txt, evidence/slice-6-mutation-check.txt"
affects: [06-06, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "Grants asserted, never assumed: every public function a migration hardens gets PUBLIC, anon, authenticated and service_role has_function_privilege rows plus a real 42501 call as the refused role"
    - "One catalog invariant for F-076 (count of prosecdef functions in public with no search_path= entry is 0) plus a non-vacuity row"
    - "Rows about a function that may not exist yet are guarded with to_regprocedure (oid form of has_function_privilege, CASE … fail() … END around dynamic calls), so the red run fails row by row instead of aborting at parse time"
    - "Service-role impersonation in pgTAP: a transaction-local helper sets role plus request.jwt.claim.role and request.jwt.claims; a paired owner helper clears claim.role so a later tests.act_as() cannot inherit the door's identity"
    - "Manual clause mutations for a migration with no CREATE POLICY: copy the committed file, remove one clause by exact-string replace, reset, test, restore from the copy, prove with cmp and git diff --exit-code"
key-files:
  created:
    - supabase/migrations/20260926120000_async_edge_definer_hardening.sql
    - supabase/tests/database/031-cron-jobs.test.sql
    - supabase/tests/database/070-definer-functions.test.sql
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/definer-hardening-red.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/schema-push-slice-6.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/slice-6-mutation-check.txt
  modified:
    - src/lib/supabase/types.ts
decisions:
  - "The breakdown invariant allows a 0.0003 residual. The score and each of the five parts are ROUND(…, 4), so the sum of rounded parts can differ from the rounded score by at most 6 x 0.00005. A row missing any breakdown key counts as a violation, so a NULL sum cannot pass"
  - "031 also asserts that the local cron catalog holds exactly production's three jobs, one row per name. A future migration that adds a job must update 031, which is the point: repository truth equals production's catalog"
  - "scripts/pgtap-mutation-check.sh was run unchanged and its POLICY_MIGRATION_GLOBS was not extended. The new migration creates no policy, so an entry would match nothing and prove nothing; M1-M4 prove the new clauses instead"
  - "DI-82 (the batch route's 500 under PostgREST safeupdate) is left for 06-06. The fix changes compute_user_scores' body, which this plan's text pins by md5 and never tells it to change"
metrics:
  duration: "25 min"
  completed: "2026-09-27"
  tasks: 3
  files: 7
---

# Phase 6 Plan 05: Async Edge Definer Hardening Summary

**One migration makes the database half of the async edge match production and least-privilege: it declares production's two missing pg_cron jobs byte for byte, and it takes EXECUTE on the three scheduled writers away from PUBLIC, anon and authenticated. It pins their search_path with no change to the scoring formula, binds `get_friends`/`get_friends_going_to_event` to the caller or the service role, stops reminders for deleted and unapproved events, and adds a service-role-only `cron_job_status()`. pgTAP 031 and 070 prove all of it: red before, green after, and each clause shown to matter by mutation.**

## What was done

**Task 1: red first.** `031-cron-jobs.test.sql` (13 rows) pins all three production jobs: count per name, schedule, command and `active`, with literals copied from `.planning/audit/async/cron-job.json` (lower-case `select` for reminders, upper-case `SELECT` for feedback, C25), plus the whole catalog. `070-definer-functions.test.sql` (47 rows; 25 `has_function_privilege` lines) covers:
- the md5 pins for compute and feedback;
- the score-equals-breakdown invariant on an in-transaction fixture user;
- F-093 with three saved events 24 h out (approved; approved and soft-deleted; pending);
- the F-076 catalog invariant and a non-vacuity row;
- F-075 privileges for PUBLIC, anon, authenticated and service_role, and real anon calls that must raise 42501;
- F-074 privileges, anon refusals, A-for-B (0 rows), A-for-A (C) and service_role-for-B (D) for both friends functions;
- C4 `cron_job_status()` existence, grants, the authenticated 42501 and the service_role listing.

The fixtures use literal `…0070xx` ids created as the session role. The two FKs into `auth.users` that the definer writers reach are dropped inside the transaction (the D-21 pattern of 065/066), and the reminder and scoring calls run only inside `BEGIN … ROLLBACK` (DEC-71).

From a fresh reset, the pre-migration run shows **031 FAILED 9/13** and **070 FAILED 31/47**. Green before the migration, as required: the md5 pins, the breakdown invariant, the approved-event reminder, the service_role/authenticated keep rows, and the own-friends and door reads. A rolled-back probe shows `SET ROLE anon; SELECT public.send_event_reminders()` succeeding today. The evidence records the pg_prove summary plus the raw TAP stream (40 `not ok` lines).

**Task 2: the migration.** `20260926120000_async_edge_definer_hardening.sql` uses the analog's header (CLOSES local pending DI-23, FIX FORWARD, idempotence, BLAST RADIUS, WHAT WAS WRONG, WHAT IT NOW SAYS). Its five sections, in the plan's order:
1. Unschedule-if-exists, then `cron.schedule` for both jobs.
2. `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` and `ALTER FUNCTION … SET search_path = public, pg_temp` on compute and feedback. No body change.
3. `send_event_reminders` re-created with the baseline body plus `AND e.deleted_at IS NULL AND e.status = 'approved'` in both loops. A diff against the baseline body shows only those four lines. Then the same revoke.
4. Both friends functions re-created with the same signatures, `SET search_path = ''`, qualified relations and `(subject = (SELECT auth.uid()) OR (SELECT auth.role()) = 'service_role')`. Then `REVOKE … FROM PUBLIC, anon`.
5. `cron_job_status()` with a lateral newest-run join, `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE … TO service_role`.

The trailing comment states that `config.toml` needs no change (C3), that default privileges are left alone, and that pg_cron runs its jobs as `postgres`, which the revokes do not affect. `check-migration-filenames.mjs` passes 9 files, and `config.toml` and the baseline are untouched.

**Task 3 [BLOCKING]: the local schema push.** These steps ran in order, each recorded with its exit code in `evidence/schema-push-slice-6.txt`:
- CLI 2.115.0; `supabase db reset --local` applied 9 migrations.
- `gen types --local`: the diff is exactly the `cron_job_status` entry (+10 lines).
- `tsc` exit 0; Jest 102 suites / 1995 tests passed (1 skipped).
- pgTAP **UNSEEDED Files=13 Tests=260 PASS**; seed; **SEEDED Files=13 Tests=260 PASS**.
- `cron.job` probe **EQUAL** to `cron-job.json` for all three jobs (jobname, schedule, command, active, username).
- PostgREST RPC with the local anon key: 42501 "permission denied for function …" for all five hardened functions.
- `git diff --exit-code -- supabase/config.toml` exit 0.

Committed as `0ba575a` with the plan's message and body. Then the mutation check (`evidence/slice-6-mutation-check.txt`):
- `scripts/pgtap-mutation-check.sh`: 6 policies, each RED_ASSERTION when removed and GREEN when restored, failures=0, exit 0.
- M1, the compute/feedback revoke: 070 fails 10-12, 18-20, 22, 24.
- M2, the friends predicate: 070 fails 35 and 37.
- M3, the F-093 filters: 070 fails 6 and 7.
- M4, the cron_job_status revoke: 070 fails 42-44 and 46.
- Every restore passed `cmp` with exit 0. The final reset, seed and green run left `supabase/` clean and port 3000 free.

Playwright (`public-profile-privacy`, `async-edge`, `event-read-path`): **26 passed**. After that run, the database was reset and re-seeded, and the plan's verify (`test db && gen types | diff && filenames`) exited 0.

## Floor after this plan

| Gate | Result |
|---|---|
| `supabase test db --local` | Files=13, Tests=260, PASS, both unseeded and seeded (was 11 files / 200 tests) |
| `supabase gen types … \| diff -u src/lib/supabase/types.ts -` | empty after the commit |
| `npx tsc --noEmit` | exit 0 |
| `npx jest --ci` | 102 suites / 1995 tests passed, 1 skipped (unchanged) |
| `npm run lint` | 0 errors (18 warnings, unchanged) |
| `npm run build` | exit 0 (inside the Playwright webServer) |
| `node scripts/check-migration-filenames.mjs` | PASS, 9 files |
| Docker stack | reset, seeded, healthy; no hung `psql`/`docker exec`; port 3000 free |

## Deviations from Plan

### Auto-fixed Issues

None. The migration and both test files went green on their first post-migration run.

### Plan text vs measurement

- **Commits.** The plan puts Tasks 1 and 2 into Task 3's single commit ("Do not commit the tests yet", "Do not commit yet"), so there is no per-task commit for Tasks 1 and 2. The mutation-check and Playwright evidence landed in a second commit (`e55e1c9`), because the mutation script requires the migration to be committed first.
- **"`bash scripts/pgtap-mutation-check.sh` per its usage on the new migration".** The script takes no arguments and mutates only `CREATE POLICY` statements in its four listed migrations. The new migration has none, so the script was run as-is (it proves the older policies still bite with 031/070 present) and the new clauses were proven by M1-M4. This is recorded in the evidence header.
- **The raw TAP capture.** The plan's verify greps `not ok`, which pg_prove's summary does not print. The raw stream was captured by running each file through `psql`, with `pgtap` created before and dropped after, matching the state `supabase test db` leaves behind.
- **After Playwright,** the first drift-gate run failed `040-seed-coverage` row 20 ("every seeded user carries the pinned stamp"). The specs write to seeded users and `update_users_updated_at` stamps `now()`. This is pre-existing and independent of this migration. A reset and re-seed (the Phase 5 precedent) made it pass, and both runs are recorded.

## Issues

- **DI-82 is not addressed, deliberately.** The plan does not tell this plan to change `compute_user_scores()`, and DEC-68 pins its body by md5, which 070 row 1 now enforces. The fix (for example `DELETE … WHERE true`) belongs to 06-06 as a DEFECT-then-fix with the md5 pin re-derived. The migration header says so. The Playwright `async-edge` spec still passes on 06-04's fixture workaround.
- **F-078** (the `search_events_fuzzy` 0A000, already in the audit) printed 7 times in the Playwright server log, as it did in 06-04's run. It is out of scope and unchanged.
- No `gsd` state-call failures at the time of writing (see the state commit).

## Requirements

REFAC-14 and REFAC-22 are **not** marked complete. This plan is slice 6's database half: REFAC-14 closes at the slice-6 close (06-06), and REFAC-22's health endpoint is 06-17, which will read `cron_job_status()` through the door. Under DEC-72, the findings this plan fixes locally (F-074, F-075, F-076, F-093) stay Open at "08" until DI-23. F-042's criterion (repository truth after a fresh reset) is met, and the register edit belongs to the slice close.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. The one new surface, `public.cron_job_status()`, is T-06-05-04: service_role only, asserted by 070 rows 41-47 and proven by M4.

## Self-Check: PASSED

- FOUND: the migration, `031-cron-jobs.test.sql`, `070-definer-functions.test.sql`, `src/lib/supabase/types.ts`, and the three evidence files
- FOUND: commits `0ba575a` (6 files, body contains INTENTIONAL BEHAVIOUR CHANGE and LOCAL ONLY) and `e55e1c9`
- No production push command and no linked-project flag in any evidence file (grep exit 1)
