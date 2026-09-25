---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 16
subsystem: database
tags: [rls, grants, pgtap, migration, F-006, F-007, C3, DEC-47, REFAC-13, mutation-check, playwright]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-14: the audit writer on the elevated door. 05-15: roles, ban and first-sign-in writes on the door; avatar, banner and users/[id] self-update on the cookie client. Floor: Jest 1325/1325, Playwright 91/91, pgTAP Files=7 Tests=116"
provides:
  - "supabase/migrations/20260923130000_users_grants_audit_log_insert.sql: users UPDATE limited to 11 profile columns for authenticated; INSERT and anon UPDATE revoked; own-row policy TO authenticated WITH CHECK; SECURITY DEFINER counter trigger; admin_audit_log INSERT policies dropped and INSERT/UPDATE/DELETE/TRUNCATE revoked. Local only until DI-23"
  - "pgTAP 050 (23 assertions) and 055 (17): red against the old schema, green unseeded and seeded"
  - "the mutation check covers *_users_grants_audit_log_insert.sql; four manual grant mutations are recorded"
  - "the grant audit: every cookie-client users write fits the grant"
affects: [05-17, 05-18, 05-19, phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A privilege denial raises 42501 before any row is read, so UPDATE/DELETE deny rows need no fixture row, and a column-scoped deny raises even on the caller's own row"
    - "An allow row whose failure mode is a raised error uses lives_ok plus an owner integrity read, so the failure is an assertion and not a file abort"
    - "Revokes and grants are not policies. The harness cannot mutate them, so each one gets a manual mutation cycle: comment it out, reset, test red, git checkout, reset, test green"

key-files:
  created:
    - supabase/migrations/20260923130000_users_grants_audit_log_insert.sql
    - supabase/tests/database/050-users-privilege-escalation.test.sql
    - supabase/tests/database/055-admin-audit-log-insert.test.sql
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/rls-privilege-before.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/schema-push-slice-5.txt
  modified:
    - scripts/pgtap-mutation-check.sh

key-decisions:
  - "TRUNCATE on admin_audit_log is revoked from anon and authenticated as well as INSERT, UPDATE and DELETE. TRUNCATE bypasses RLS, so the privilege is its only barrier, and the must-have says no client may delete audit rows"
  - "The users-INSERT deny row uses a newcomer who has no profile row and inserts their OWN id with {user,admin}. The plan's 'S inserts a new id' is refused by the old policy too, so it cannot be red before the fix. It is kept as a pinned row (17)"
  - "types.ts was regenerated and is byte-identical, so it is not in the fix commit (research A2)"

patterns-established:
  - "A both-direction grant file: schema-shape rows, then the impersonation proof, then column denials with an integrity read, the allow writes, the INSERT and anon denials, and the trigger side effect"

requirements-completed: []  # REFAC-13 continues in 05-17..05-19 (rate limiting, CSRF, slice close); not marked complete here

# Metrics
duration: 29min
completed: 2026-09-25
---

# Phase 5 Plan 16: F-006/F-007 RLS-ring migration Summary

**A student can no longer make themselves an admin or lift their own ban through PostgREST: authenticated now has UPDATE on only the eleven profile columns the app writes, and has no INSERT at all. Nobody but the service role can write, change or delete the audit log. Saving an event still moves `saved_events_count` because the counter trigger runs as its definer. All of this is local-only until DI-23. pgTAP 050 and 055 went red against the old schema and are green unseeded and seeded (Files=9, Tests=156). The mutation check and four manual grant mutations each turn the suite red. The five plan specs pass (32/32), and so does the full Playwright suite (91/91).**

## Performance

- **Duration:** about 29 min
- **Started:** 2026-09-25T04:53:41Z
- **Completed:** 2026-09-25T05:22:43Z
- **Tasks:** 2 of 2
- **Files:** 5 created, 1 modified

## Accomplishments

- **Grant audit** (`rls-privilege-before.txt` § 1). Five cookie-client users writes:
  - `users/[id]` PATCH (nine fields plus `updated_at`)
  - avatar, banner and interests
  - inferred-tags

  Every column they can carry is in the grant, so no stop was needed. The roles, ban and first-sign-in writes (seven sites) already go through the door. `compute_user_scores()` is DEFINER. The one INVOKER writer was the counter trigger.
- **Red first** (§ 3). Against the pre-migration schema:
  - 050 fails 15 of 23: self-set roles, counter and email; self-cleared ban and expiry; the newcomer's admin self-insert; the anon UPDATE; the integrity reads; and the schema-shape rows.
  - 055 fails 12 of 17. Its INSERTs reached the auth.users FK (23503), and its UPDATE, DELETE and TRUNCATE completed.
  - The allow rows passed, as they should before a fix.
- **The migration.** It is written in the 05-11 header form and is idempotent. The exact GRANT list is `name, avatar_url, banner_url, pronouns, year, faculty, visibility, interest_tags, inferred_tags, onboarding_completed, updated_at`. The own-row policy is `TO authenticated USING/WITH CHECK ((SELECT auth.uid()) = id)`. The counter trigger is `SECURITY DEFINER SET search_path = ''`, with a schema-qualified body and EXECUTE revoked from PUBLIC, anon and authenticated.
- **Local schema push** (`schema-push-slice-5.txt`):
  - CLI 2.115.0. The reset applies 6 migrations, and the types diff is empty.
  - pgTAP passes unseeded and seeded: Files=9, Tests=156.
  - A post-state probe confirms the grants and policies as written.
  - The CI drift diff is empty after the commit.
- **Proof that the tests bite:**
  - The mutation check exits 0 over 6 policies. When the own-row policy is removed, 050 fails 5 of 23 (the allow rows).
  - M1, the users UPDATE revoke removed: 050 fails 10 of 23.
  - M2, the audit revoke removed: 055 fails 7 of 17.
  - M3 (extra), the users INSERT revoke removed: 050 fails 2 of 23.
  - M4 (extra), the counter trigger back to INVOKER: 050 fails rows 1 and 20-21.
  - Each mutation was restored with `git checkout` and went green again.
- **Browser flows:** the five plan specs pass 32/32 on the first run from a clean reset, and the full suite passes 91/91 from a second fresh reset. Jest passes 1325/1325 and tsc exits 0. The stack was left reset and seeded, and port 3000 is free.

## Task Commits

1. **Task 1: grant audit and red run.** `62e0861` (docs)
2. **Tasks 1+2: migration, 050, 055, mutation glob.** `d7c2036` (fix, INTENTIONAL BEHAVIOUR CHANGE). This is one commit, as the plan requires. types.ts is unchanged, so it is not in the commit.
3. **Task 2: 050's save rows made assertion-shaped.** `92b509a` (test)
4. **Task 2: local schema push evidence.** `928b425` (docs)

## Floor after this plan

| Gate | Before (05-15) | After |
|---|---|---|
| pgTAP unseeded / seeded | Files=7 Tests=116 | Files=9 Tests=156 / Files=9 Tests=156 |
| `npx jest --ci` | 1325, 71 suites | 1325 passed, 71 suites |
| `npx tsc --noEmit` | 0 | 0 |
| Playwright | 91/91 | the five specs 32/32, full suite 91/91 (first runs) |
| migration filenames | 5 | 6 |
| mutation check | 5 policies | 6 policies, failures=0 |

## Decisions Made

See `key-decisions` above. Each is a rule-resolved reading of DEC-47 and the plan, and none needs a new DEC id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own test] 050 row 13 compared text[] with text**
- **Found during:** Task 1, first red run.
- **Issue:** `ARRAY['{music}'::text[]]` builds a two-dimensional array, so `results_eq` failed on a type mismatch instead of on behaviour.
- **Fix:** I changed it to `$q$VALUES ('{music}'::text[])$q$`. The recorded red run uses the corrected file, and in it row 13 passes as an allow row.
- **Files modified:** `050-users-privilege-escalation.test.sql`, before the first commit.

**2. [Rule 2 - Missing proof] The save row aborted the file instead of failing**
- **Found during:** Task 2, manual mutation M4.
- **Issue:** With the counter trigger back to INVOKER, the save raised inside `results_eq`. pg_prove reported "Bad plan: planned 23 but ran 19", a red that is not an assertion.
- **Fix:** Rows 20 and 22 are now `lives_ok`, and rows 21 and 23 are the owner integrity reads (row and counter). M4 now fails rows 1 and 20-21 as assertions. The mutation check and all four manual cycles were re-run on the final file.
- **Commit:** `92b509a`

**3. [Rule 3 - Blocking, as in 05-11] The mutation check ran after the fix commit**
- It restores with `git checkout --` and refuses to start while a listed migration is uncommitted. The manual cycles restore the same way.

### Rule-resolved choices

- **TRUNCATE is revoked on `admin_audit_log`.** It is in addition to the plan's `REVOKE INSERT, UPDATE, DELETE`, which appears verbatim. 055 row 15 pins it.
- **The manual cycles are M1 and M2 as the plan names them, plus M3 and M4.** M2 cannot turn 055's INSERT rows red: with the policies dropped, RLS refuses the insert with the same 42501. Row 1 pins the policy half and row 2 the privilege half, and M2 turned row 2 red.
- **The wizard e2e test PATCHes `name` only.** `onboarding_completed` under the grant is proven at the RLS ring by 050 row 12.

## Deferred items found (for 05-19 to register; not fixed here)

- **`users` still grants DELETE and TRUNCATE to anon and authenticated** (post-state probe, block 7). DELETE has no policy, so it affects 0 rows. TRUNCATE bypasses RLS, but PostgREST exposes no TRUNCATE, and the FKs into `users` make a plain TRUNCATE fail. This is a candidate for Phase 7's per-table privilege review. The baseline's blanket `GRANT ALL` pattern is on most tables.
- **"Users can insert own profile" is now dead** (no INSERT privilege). It is left in place so that no policy was dropped without need. Phase 7 can remove it.
- **Carried from 05-15, unchanged:**
  - `GET /api/admin/reports` answers 500 (PGRST200 on the `reporter:users!event_reports_reporter_id_fkey` embed).
  - `/users/[id]` can only soft-404, because the root `loading.tsx` streams a 200 first.
  - The ratchet script's header prose is stale at "0 of the 2 entries".
  - The public profile title duplicates the site suffix.
- **Registers:** F-006 and F-007 stay Open with `closes_in_phase: "08"` until DI-23 (DEC-57). The findings.json edit is 05-19's. No DEFECT Jest test moved, so no ledger row was added. 05-11 added none for F-008 either.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:
- **T-05-16-01:** 050 rows 5, 9 and 10 raise 42501; M1 turns them red.
- **T-05-16-02:** 055 rows 6, 9 and 12 raise 42501; M2 turns the write rows red.
- **T-05-16-03:** 050 rows 20-23 pass; M4 turns them red; `save-and-rsvp` passes.
- **T-05-16-04:** the grant audit is recorded, and the profile, wizard and admin specs pass.
- **T-05-16-05:** 050 rows 1-2 check the definer setting, the empty search_path and the revoked EXECUTE.
- **T-05-16-06:** a grep of the evidence for the linked flag or the push subcommand exits 1.

## Issues Encountered

None beyond the deviations above. Every Playwright run passed on its first attempt.

## Next Phase Readiness

- 05-17 may start. The stack is reset and seeded, port 3000 is free, and the tree is clean apart from the three untracked files that must stay untracked.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260923130000_users_grants_audit_log_insert.sql, supabase/tests/database/050-users-privilege-escalation.test.sql (308 lines), supabase/tests/database/055-admin-audit-log-insert.test.sql (195 lines), evidence/rls-privilege-before.txt, evidence/schema-push-slice-5.txt
- FOUND commits: 62e0861, d7c2036, 92b509a, 928b425
- `node scripts/check-migration-filenames.mjs` passes on 6 migrations. `git diff --name-only a64a60c HEAD -- supabase/migrations/` lists only the new file, so the five earlier migrations are unchanged.
