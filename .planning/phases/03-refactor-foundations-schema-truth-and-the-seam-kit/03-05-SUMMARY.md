---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 05
subsystem: database
tags: [supabase, postgres, rls, pgtap, pg_cron, migrations, indexes, trigram, mutation-testing, refac-02, refac-03]

requires:
  - phase: 03-04
    provides: "supabase/migrations/20260915214553_baseline.sql — production's schema as real DDL, a folder that replays with `supabase db reset --local` exit 0, and a zero-byte `db diff --linked`. Every object this plan adds is a deliberate delta on top of a KNOWN starting state, which no previous plan in this project could claim"
  - phase: 03-01
    provides: "The AR-12 read-only transport (.planning/audit/tools/sql-readonly.mjs), the 45-row production history census that proves cron.schedule was never recorded, and scripts/check-migration-filenames.mjs"
  - phase: 01
    provides: ".planning/audit/findings.json (F-015, F-016, F-020, F-042, F-049), rls/rls-review.md §§ 5-6, async/cron-job.json — production's live cron catalog"
provides:
  - "supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql — six measured-missing indexes, the orphaned-table drop, and the three club_invitations policies that unbreak invitation acceptance"
  - "supabase/migrations/20260915230100_cron_compute_user_scores.sql — the scoring schedule, byte-identical to production, idempotent by reading the job catalog"
  - "supabase/tests/database/ — the project's FIRST database test suite: 47 assertions across 4 files, zero-dependency, running under `supabase test db --local`"
  - "tests.act_as / act_as_anon / act_as_owner — in-repo impersonation helpers setting both claim forms, with a self-check that proves impersonation actually happened"
  - "tests.index_columns / index_am / index_is_partial / explain_text — introspection helpers so an index assertion names a table and columns rather than a string"
  - "scripts/pgtap-mutation-check.sh — a rerunnable assertion-strength harness that proves each policy test bites, and rejects a red that is a parse error rather than an assertion failure"
  - "A measured, line-by-line-attributed diff against production: nine statements, nine additions, one-to-one"
affects:
  - "03-06 (REFAC-04, type drift): types.ts must be regenerated from the LOCAL schema, which now carries six indexes and three policies production lacks; the F-049 events_tests entry disappears when it is. 03-06 also owns the CI job that runs `supabase test db` — this plan deliberately did not touch the workflow file"
  - "03-07 (seed + Playwright): the seed loader now has a database with working invitee policies to seed against; the club-invitation acceptance flow is testable end to end for the first time"
  - "03-08: the gated production repair (D-02). The nine objects this plan added exist LOCALLY ONLY; applying them to production is that plan's decision, and it is blocked while the production history is unreconciled"
  - "Phase 5: inherits the 41-versus-24 policy divergence, F-017 (experiments), F-037 (dead cron handlers), the other two production-only cron jobs, and the two deprecated policy forms across ~100 inherited policies — all named explicitly in evidence/schema-fixes-note.md § 4"
  - "Phase 8 (deployment certification): pgTAP is a LOCAL-ONLY control. Nothing in this plan asserts anything about the running production database"

tech-stack:
  added: []
  patterns:
    - "Measure before re-issuing: an archived migration's title is not evidence that its content is needed. The nine FK indexes were already live, so re-issuing them would have been dead SQL asserting a fix for a defect that does not exist"
    - "Assertion strength as a deliverable: the mutation harness is committed alongside the suite, not performed once by hand. A green suite is not evidence; a suite that goes red when its subject is removed is"
    - "Reject the wrong kind of red: a policy whose removal makes the suite fail to PARSE proves nothing about the assertion. The harness requires pg_prove to have produced real test results with a real failure count"
    - "Denial has two shapes: a raised 42501 is asserted as a raise; a USING-clause filter is asserted as emptiness PLUS an RLS-bypassed integrity check, because an empty result is otherwise indistinguishable from a deleted row"
    - "Never prove an allowed write by the statement completing — it completes when it matched zero rows. Every allowed write uses RETURNING and asserts the returned value"
    - "Impersonation self-check as the FIRST assertion: a helper that silently fails to impersonate makes every deny assertion pass for the wrong reason"
    - "Idempotence by catalog guard, not by exception swallowing: a block that catches and discards cron.unschedule's error is indistinguishable from a block that did nothing"
    - "The diff is a measurement, not a problem to be closed. When a plan deliberately adds objects, the criterion becomes accountability — every statement attributed — rather than emptiness"
    - "Restore by `git checkout --`, never by re-editing. A hand-restoration across several rounds is how a stray character survives into a committed migration"

key-files:
  created:
    - supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql
    - supabase/migrations/20260915230100_cron_compute_user_scores.sql
    - supabase/tests/database/000-setup.sql
    - supabase/tests/database/010-fk-indexes.test.sql
    - supabase/tests/database/020-rls-policy-gaps.test.sql
    - supabase/tests/database/030-cron-schedule.test.sql
    - scripts/pgtap-mutation-check.sh
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/schema-fixes-note.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/db-reset.after-fixes.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/pgtap-run.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/pgtap-mutation-check.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/cron-idempotence.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/db-diff.after-fixes.sql
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/transport-identity.03-05.json
  modified: []

key-decisions:
  - "D-18: the nine archived FK indexes are NOT re-issued. All nine were measured live in production and present in the baseline, so re-issuing would be dead SQL. REFAC-02's index half is re-aimed at what is genuinely missing — the F-015 composite, the two F-020 policy-column gaps, the unindexed recommendation_feedback FK column, and the two trigram indexes search_events_fuzzy was written for. The truth REFAC-02 actually asserts is about the STATE of the database, so all nine are asserted in 010-fk-indexes.test.sql anyway"
  - "D-19: both new UPDATE policies get a WITH CHECK stronger than the archived file's. The archived clauses constrained only the destination status; they were widened to re-assert ownership, so an invitee cannot rewrite invitee_email while accepting and an owner cannot reassign club_id while revoking (T-03-05-07)"
  - "D-20: the mutation check was AUTOMATED rather than performed by hand as 03-RESEARCH.md classified it. A script turns a one-time human observation into a rerunnable control and checks the SHAPE of the red, which an eye does not reliably do"
  - "D-21: clubs.created_by is left NULL in the pgTAP fixture. It is a nullable FK into auth.users, which GoTrue owns; club ownership is expressed where the policy actually reads it — the club_members row is_club_owner consults — so no test writes into the auth schema"
  - "The three nine-index assertions live in the test file rather than the migration. Provenance and state are different claims, and REFAC-02 asks about state"
  - "pgTAP is created in the LOCAL test database only and is deliberately not installed in production. These 47 assertions are a development-time control and make no claim about the running production database"

patterns-established:
  - "Mutation-checked database tests: every RLS policy a migration adds carries an allow/deny pair, and a committed harness proves each pair goes red when the policy is removed"
  - "Two-shape denial assertions: raises asserted as raises, filtered reads asserted as emptiness plus an integrity check"
  - "In-repo impersonation: two set_config helpers covering both claim forms, no registry-fetched test-helper package anywhere in the test command"
  - "Index assertions name table and ordered column list, plus access method where the access method is the load-bearing property, plus a plan assertion where usability is the real claim"
  - "Evidence files reference tripwire patterns rather than spelling them out, so a grep cannot match its own disclaimer"

requirements-completed: [REFAC-02, REFAC-03]

duration: 78min
completed: 2026-09-15
status: complete
---

# Phase 03 Plan 05: Schema Fixes and the Assertion-Strength Harness — Summary

**Six measured-missing indexes, the three RLS policies that unbreak club-invitation acceptance, and the `compute_user_scores` schedule — all carried by 47 pgTAP assertions that a committed mutation harness has proven can actually fail.**

## Performance

- **Duration:** 78 min
- **Started:** 2026-09-16T00:25:00Z
- **Completed:** 2026-09-16T01:43:00Z
- **Tasks:** 3
- **Files created:** 14 (2 migrations, 4 pgTAP files, 1 script, 7 evidence artifacts)

## Accomplishments

- **Club-invitation acceptance is no longer broken in a database built from this repository.** F-016 — production carries exactly two policies on `club_invitations`, both `is_club_owner(club_id)`, so an invitee can neither see nor accept their own invitation and `/api/clubs/[id]/invites` is RLS-reliant with nothing masking it. Three policies close it, written in the current form and with a stronger `WITH CHECK` than the archived file had.
- **The anonymous event feed's policy predicate is indexed.** F-015 — `Approved events are viewable by everyone` is `USING (status = 'approved')` and none of `events`' seven indexes covered `status`, so every anonymous feed read sequentially scanned the largest table in the product on behalf of an unauthenticated caller.
- **`search_events_fuzzy` has the trigram indexes it was written for.** Measured, not inherited: production runs the function without them, so every fuzzy search computed trigram similarity per row in the executor. The migration that declared them was never applied.
- **The scoring job is schema-as-code for the first time.** `cron.schedule` appears in 0 of the 45 production history rows; the repository's only trace was a commented-out line in a never-applied file. Two consecutive resets each leave exactly one job on production's own expression.
- **The project has its first database test suite** — 47 assertions, zero dependencies, and a harness that has watched every one of the three new policies turn its test red on removal and green on restore.

## Task Commits

1. **Task 1: Re-issue the indexes and audit-named policy gaps as one new migration** — `3e004b9` (feat)
2. **Task 2: Codify the scoring schedule and write the pgTAP suites** — `0c9d459` (feat)
3. **Task 3: Apply, prove idempotence, mutation-check every policy, close the diff** — `bd5d35e` (test)

## Files Created

| File | What it does |
|---|---|
| `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql` | Six indexes (F-015, F-020, trigram, FK-shaped), `DROP TABLE IF EXISTS public.events_tests` (F-049), three `club_invitations` policies (F-016) |
| `supabase/migrations/20260915230100_cron_compute_user_scores.sql` | `compute-user-scores`, `0 */6 * * *`, `SELECT compute_user_scores()` — idempotent via a job-catalog guard |
| `supabase/tests/database/000-setup.sql` | pgTAP, the `tests` schema, three impersonation helpers and four introspection helpers, plus a 5-assertion self-check |
| `supabase/tests/database/010-fk-indexes.test.sql` | 23 assertions: the nine already-live FK indexes plus this plan's six by table and ordered columns, GIN for both trigram indexes, three plan assertions, and the absence of `events_tests` |
| `supabase/tests/database/020-rls-policy-gaps.test.sql` | 15 assertions: allow/deny per new policy, both denial shapes, every allowed write proven by `RETURNING` |
| `supabase/tests/database/030-cron-schedule.test.sql` | 4 assertions: schedule, command, active, and exactly one job |
| `scripts/pgtap-mutation-check.sh` | The assertion-strength harness — 3 policies × 2 rounds × (reset + suite) |
| `evidence/schema-fixes-note.md` | What was added, what was deliberately left to Phase 5, the diff attributed line by line |
| `evidence/{db-reset.after-fixes,pgtap-run,pgtap-mutation-check,cron-idempotence}.txt`, `evidence/db-diff.after-fixes.sql`, `evidence/transport-identity.03-05.json` | The captures behind every claim above |

## Decisions Made

Recorded in full in the frontmatter and in `evidence/schema-fixes-note.md`. The four that matter:

- **D-18 — the nine FK indexes were not re-issued.** The plan's premise moved under it: all nine are already live, confirmed against both production history (03-01) and the baseline (03-04). Re-issuing them would have been dead SQL asserting a fix for a defect that does not exist. They are asserted in the test file instead, because REFAC-02's truth is about the state of the database, not about which migration produced it.
- **D-19 — both new UPDATE policies are stronger than the archived text.** The archived `WITH CHECK` clauses constrained only the destination `status`. A `USING` clause decides which rows you may touch; a `WITH CHECK` clause decides what they may become. Without the ownership half, an invitee could rewrite `invitee_email` onto someone else in the same statement that accepted the invitation, and an owner could reassign an invitation to a club they do not own.
- **D-20 — the mutation check was automated.** 03-RESEARCH.md classified it as a manual step where a human observes the red. Thirty lines of shell turns that into a rerunnable control, and it checks the *shape* of the red — a policy whose removal makes the suite fail to parse rather than to assert proves nothing, and an eye does not reliably catch that distinction.
- **D-21 — no test writes into the `auth` schema.** `clubs.created_by` is a nullable FK into `auth.users`, which GoTrue owns. Club ownership is expressed in the `club_members` row that `is_club_owner` actually consults.

## Deviations from Plan

The plan was authored before 03-04's baseline existed, so several of its premises were predictions. All were measured and all are recorded.

### Auto-fixed Issues

**1. [Rule 1 — Bug] The plan's index half targeted a defect that does not exist**
- **Found during:** Task 1
- **Issue:** The plan directed re-issuing the nine `CREATE INDEX IF NOT EXISTS` statements from the archived `20260316000004_fk_indexes_and_cleanup.sql`, and set an acceptance criterion of ≥10 `IF NOT EXISTS` occurrences on that basis. All nine indexes are already live — measured in production history by plan 03-01 and confirmed present in the baseline by plan 03-04 — so the file is a confirmed no-op.
- **Fix:** Did not re-issue. Re-aimed the index half at what is genuinely uncovered, measured from the live schema: the F-015 composite `events (status, start_date) WHERE deleted_at IS NULL`, the two F-020 policy-column gaps, the unindexed `recommendation_feedback.event_id`, and the two trigram indexes `search_events_fuzzy` needs. Six indexes, so the `IF NOT EXISTS` count is **6, not ≥10**. The nine already-live names are asserted in `010-fk-indexes.test.sql` anyway, so REFAC-02's truth is proven by a database test rather than by an argument about provenance.
- **Verification:** `evidence/schema-fixes-note.md` § 1; `supabase test db --local` asserts all fifteen index names by table and column.
- **Committed in:** `3e004b9`

**2. [Rule 2 — Security] The archived UPDATE policies' `WITH CHECK` clauses permitted row reassignment**
- **Found during:** Task 1
- **Issue:** `20260226000001_invitee_select_update_policy.sql` constrains only the destination `status` in both `WITH CHECK` clauses. An invitee could have set `invitee_email` to another address in the same statement that accepted the invitation; an owner could have reassigned `club_id` while revoking. This is the threat model's `T-03-05-07` and the RLS-basics `USING`-plus-`WITH CHECK` rule.
- **Fix:** Widened both `WITH CHECK` clauses to re-assert ownership alongside the status transition.
- **Verification:** `020-rls-policy-gaps.test.sql` assertion 7 — an invitee accepting while rewriting `invitee_email` raises `42501`. The mutation harness confirms the assertion bites.
- **Committed in:** `3e004b9`

**3. [Rule 2 — Security] No AR-12 envelope was specified for this plan's production read**
- **Found during:** Task 3
- **Issue:** The plan's task 3 lists no transport-identity artifact, but `T-03-05-01` records the envelope discipline as "re-captured per read", and AR-12's clause is per-read — a stale envelope proves nothing about a later connection.
- **Fix:** Captured `evidence/transport-identity.03-05.json` through `sql-readonly.mjs` immediately before the `db diff --linked` read. Result: `role = supabase_read_only_user`, `transaction_read_only = on`.
- **Verification:** The artifact's `captured_at_utc` precedes the diff.
- **Committed in:** `bd5d35e`

**4. [Rule 1 — Bug] An acceptance-criterion tripwire matches its own documentation**
- **Found during:** Task 3
- **Issue:** The criterion greps the evidence directory for the CLI's schema-push subcommand to prove no push occurred. Three files written by earlier plans contain the literal **while asserting the command was not run**, so the grep reports hits for prose saying the opposite of what it looks for. This is the same defect class 03-04 named when it wrote that evidence should cite assertion patterns by reference.
- **Fix:** This plan's seven new artifacts reference the subcommand rather than spelling it out and all read 0. The three inherited files are left untouched — rewriting another plan's committed evidence to satisfy a grep would be worse than the grep being imprecise. The underlying fact is stated unambiguously in `evidence/schema-fixes-note.md` § 7 and should be carried into Phase 5's criteria.
- **Verification:** `grep -c "db push"` reads 0 on all seven new files.
- **Committed in:** `bd5d35e`

**5. [Rule 3 — Blocking] Two grep-count criteria could not pass against prose containing their own patterns**
- **Found during:** Task 1
- **Issue:** `grep -c "DROP POLICY IF EXISTS"` read 4 against 3 policies, and the wrapped-auth-uid count read 3 against 4 occurrences — in both cases the migration's own header prose contained the pattern.
- **Fix:** Reworded the header to describe the guards rather than quote them. Counts are now exact: 3 `CREATE POLICY`, 3 `DROP POLICY IF EXISTS`, 3 `TO` clauses, 3 auth-uid references and 3 wrapped, 0 deprecated role-function occurrences.
- **Committed in:** `3e004b9`

---

**Total deviations:** 5 auto-fixed (2 × Rule 1, 2 × Rule 2, 1 × Rule 3). No Rule 4 architectural decision arose.
**Impact on plan:** No scope creep. Three deviations are measurement correcting a pre-measurement premise; two are security and evidence controls the plan's own threat model required but its task text omitted. The plan's `success_criteria` are met in full — the only numeric acceptance criterion not met is the ≥10 `IF NOT EXISTS` count, which was arithmetic on the premise deviation 1 falsified.

## Issues Encountered

- **A previous executor stalled on a wedged Docker engine.** The engine was restarted before this run; no commits or files from that attempt existed, so execution started from Task 1. Every `supabase`/`docker` command in this run carried a bounded wait as a defensive habit. Docker answered in well under 15 s throughout and no checkpoint was needed.
- **`clubs_created_by_fkey` points at `auth.users`, not `public.users`.** The first pgTAP fixture failed with a foreign-key violation. Resolved by D-21 — leave the column NULL and express ownership in `club_members`, where `is_club_owner` reads it. A test that wrote into the `auth` schema would have violated the phase's GoTrue-owns-auth split before plan 03-07 relies on it.
- **`mapfile` is bash 4 and macOS ships bash 3.2.** The harness's policy enumeration was rewritten as a `while read` loop so it runs on the machine it is meant to run on.
- **The harness was re-run after a comment-only edit to its own contract header**, so the committed script is byte-for-byte the one that produced `evidence/pgtap-mutation-check.txt`. Both runs recorded `failures=0` and identical verdicts.

## Verification

| Check | Result |
|---|---|
| `supabase db reset --local` ×2 | exit 0 both; skip tripwire 0/0; all three versions listed |
| `supabase test db --local` | exit 0, **47 assertions, 4 files** |
| `bash scripts/pgtap-mutation-check.sh` | exit 0 — 3 × `RED_ASSERTION` → `GREEN`, `failures=0`, `migrations_dir_clean=true` |
| cron idempotence | `job_count=1` on `0 */6 * * *` after each of two resets |
| `supabase db diff --linked --schema public,storage` | 9 statements, 9 additions, attributed one-to-one |
| liveness assertions in the suite (comments excluded) | 0 |
| deprecated role-function form in the new migration | 0 |
| unwrapped auth-uid in the new migration | 0 of 3 |
| registry-fetched test helper anywhere under `supabase/tests/` | 0 |
| `git status --porcelain supabase/migrations/_archive_pre_baseline/ src/` | empty |
| `npm run lint` | exit 0 — 0 errors, 19 warnings |
| `npx tsc --noEmit` | exit 0, no output |
| `npm test -- --ci` | exit 0 — **332 passed, 5 skipped** (phase floor) |
| `check-baseline.mjs` | exit 0 — **22 passed, 0 failed** |
| production writes | **none.** One read, under the AR-12 envelope |

## User Setup Required

None — no external service configuration required. No package was installed; `package.json` and `package-lock.json` are untouched.

## Next Phase Readiness

**Ready.** The local database is built from three migrations, carries working invitee policies, and has a test suite that has been proven to bite.

Carried forward, explicitly:

- **Plan 03-06** regenerates `types.ts` from the *local* schema, which now holds nine objects production does not. The `events_tests` entry (F-049's other half) disappears when it does. 03-06 also owns the CI job that runs `supabase test db` — this plan deliberately did not touch `.github/workflows/ci.yml` so only one plan edits it at a time.
- **Plan 03-08** owns the gated production repair (D-02). **The nine objects added here exist locally only.** Club-invitation acceptance is still broken in the running production database, and it stays broken until that gate is passed — this plan fixed the repository, not production, and says so rather than implying otherwise.
- **Phase 5** inherits, all named in `evidence/schema-fixes-note.md` § 4: the 41-versus-24 policy divergence, F-017 (experiment reads returning zero rows for non-admins), F-037 (dead cron handlers), the two production-only cron jobs that keep F-042 narrowed rather than closed, and the two deprecated policy forms across ~100 inherited policies.
- **Phase 8** should note that pgTAP is a development-time control. It is not installed in production and nothing here asserts anything about the running production database.

---
*Phase: 03-refactor-foundations-schema-truth-and-the-seam-kit*
*Plan: 05 · Requirements: REFAC-02, REFAC-03*
*Completed: 2026-09-15*

## Self-Check: PASSED

All 14 files claimed as created exist on disk. All three task commit hashes (`3e004b9`, `0c9d459`, `bd5d35e`) resolve in `git log`. Verified 2026-09-15.
