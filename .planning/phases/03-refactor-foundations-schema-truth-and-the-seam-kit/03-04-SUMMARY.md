---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 04
subsystem: database-foundations
tags: [supabase, migrations, baseline, pg_dump, rls, pg_trgm, ci, ar-12, refac-01]
requires:
  - phase: 03-01
    provides: "A running local stack with an EMPTY public schema, the AR-12 read-only transport, the 45-row production history census (Q1 = yes), and scripts/check-migration-filenames.mjs captured RED"
  - phase: 01
    provides: ".planning/audit/rls/pg_policies.json (101 live policies), findings.json, drift.md, REDACTION.md"
provides:
  - "A migrations folder that replays: `supabase db reset` exits 0 applying one baseline, nothing passed over"
  - "A zero-byte `supabase db diff --linked --schema public,storage` — the schema built from the repository IS production's schema"
  - "supabase/migrations/<ts>_baseline.sql — production's public schema as real DDL plus the 15 application-owned storage policies"
  - "All 44 pre-baseline migrations preserved byte-identical in _archive_pre_baseline/ as 44 git renames with 0 changed lines"
  - "The 18 remote-only production versions recovered as documentation in _archive_pre_baseline/recovered/"
  - "The migration-filename parse check wired into CI, its red-to-green pair complete"
  - "A measured reconciliation note: what was fixed, what production still holds uncontrolled, and the deferred production repair"
affects:
  - "03-05 (REFAC-02): inherits two MEASURED re-issue targets (two missing trigram indexes, three absent invitee policies) and one confirmed no-op to skip (fk_indexes_and_cleanup)"
  - "03-03 (REFAC-03): cron.schedule confirmed absent from the baseline AND from all 45 history rows — the schedule must be authored from the live catalog"
  - "03-06 (type drift gate), 03-07 (seed + Playwright): every one of these needs a local database built from the folder, which now exists for the first time"
  - "03-08: owns D-02's gated production-history repair; this plan wrote the deferral in full"
  - "Phase 8 (deployment certification): inherits the outstanding repair and the rule that `db push` must not run against production until it is resolved"
tech-stack:
  added: []
  patterns:
    - "Baseline-by-dump, never by pull: `db dump --linked` is a pure pg_dump read; `db pull --linked` may write production's history table"
    - "Service-owned vs application-owned schema split: a migration declares storage POLICIES, never storage STRUCTURE"
    - "Fidelity by set difference: policy (table, name) pairs extracted from both sides and diffed programmatically, never compared by eye"
    - "Envelope-before-read, per read: AR-12's clause is per-read, so a fresh envelope is captured rather than a prior plan's reused"
    - "Evidence files cite their own assertion patterns by reference rather than inlining them, so a tripwire cannot match itself"
    - "A failed run is kept in the transcript as the measurement that produced the correction"
key-files:
  created:
    - supabase/migrations/20260915214553_baseline.sql
    - supabase/migrations/_archive_pre_baseline/README.md
    - supabase/migrations/_archive_pre_baseline/recovered/ (18 .sql.recovered files + README.md)
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/archive-rename-diff.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/transport-identity.03-04.json
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/baseline-review.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/policy-census-crosscheck.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/db-reset.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/migration-list.local.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/db-diff.prod.sql
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/filename-check.green.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/reconciliation-note.md
  modified:
    - .github/workflows/ci.yml
    - supabase/migrations/ (all 44 .sql files moved into _archive_pre_baseline/ — renames only, 0 content changes)
decisions:
  - "D-15: the baseline is produced by `supabase db dump --linked`, never `supabase db pull --linked`. The CLI documents that `db pull` may record the pulled migration in the REMOTE history table — the exact production write D-02 gates behind plan 03-08 and T-03-04-04 prohibits. 03-RESEARCH.md § Assumptions Log A1 already named the dump as producing equivalent DDL, so A1 is closed as routed-around rather than verified."
  - "D-16: the baseline carries the `public` schema in full plus the 15 `storage.objects` policies, and NOTHING else from the storage schema. The plan's `--schema public,storage` baseline cannot replay — the migration role holds no CREATE on the storage schema (measured: has_schema_privilege = f; storage.objects owned by supabase_storage_admin). Storage STRUCTURE is service-owned and created identically in every environment; storage POLICIES are application-owned and creatable. The diff still covers both schemas, so the empty result is what PROVES the split is safe."
  - "D-17: `supabase db dump` filters CREATE EXTENSION out of its output, so the dumped baseline silently lacked pg_trgm, which `public.search_events_fuzzy` genuinely needs. migra's own emitted DDL was inserted verbatim. A reset could never have caught this — CREATE FUNCTION does not validate a GUC in a function body."
  - "The 18 remote-only versions were recovered (Q1 = yes) with a `.sql.recovered` suffix, so the CLI could not read one as a migration even from the top level."
  - "The production history repair is DEFERRED, not skipped. It remains D-02's gated decision for plan 03-08; the reconciliation note states in writing that declining it is acceptable and defers it to Phase 8, and names the one real cost — `db push` must not run against production while it is outstanding."
  - "`supabase db reset --local` is invoked with `--local` EXPLICIT on every run. The default is local, but the project is now linked and `--linked` on the same command resets production."
patterns-established:
  - "Baseline-by-archive (D-01) executed end to end: 44 files move byte-identical, one generated baseline replaces them, and REFAC-01's no-rename clause is honoured BY the move/rename distinction rather than in spite of it"
  - "Programmatic fidelity checking: 41 of 101 policies are declared by no migration, so an eye check is structurally insufficient — both sides are reduced to (table, name) pairs and diffed as sets"
  - "Generated artifacts get generated fixes: the pg_trgm line is migra's own output pasted verbatim, not hand-authored, so the baseline stays a copy of production rather than a claim about it"
requirements-completed: [REFAC-01]
metrics:
  duration_minutes: 45
  tasks_completed: 3
  files_created: 32
  files_modified: 2
  commits: 4
  completed: 2026-09-15
status: complete
---

# Phase 3 Plan 04: Migration Reconciliation Summary

**A migrations folder that aborted at its twelfth file now replays to completion from a single generated baseline whose schema has no difference against production — and not one of the 44 existing files was renamed to get there.**

## Performance

- **Duration:** 45 min (across two executor sessions, separated by a credential checkpoint)
- **Started:** 2026-09-15T21:19Z
- **Completed:** 2026-09-15T22:05Z
- **Tasks:** 3 of 3
- **Files created:** 32 · **Files modified:** 2 (plus 44 pure renames)

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Archive all 44 migration files as 44 pure renames | `799bce0` | refactor |
| 1 | Archive README + REFAC-01's no-rename evidence | `de05f83` | docs |
| — | *Checkpoint: credential blocker recorded* | `a3b5bfe` | docs |
| 2 | Pull the baseline and review it by count and by name | `4969180` | feat |
| 3 | Apply locally, prove the diff empty, wire the CI gate | `bec4cf1` | feat |

Task 1 was executed by the first executor session and verified — not redone — by this one.

## The headline result

**REFAC-01's two success criteria are met, and neither had ever succeeded on this tree.**

```
$ supabase db reset --local                                 → exit 0, one migration, nothing passed over
$ supabase db diff --linked --schema public,storage         → 0 bytes, "No schema changes found"
                                                              "files":[]  "dropStatements":[]
```

`dropStatements` being empty is worth naming separately: replaying the baseline produces production's schema without needing to *remove* anything from it. The two schemas are equal, not merely compatible.

**And nothing was renamed.** All 44 files moved into `_archive_pre_baseline/` byte-identical and name-identical. Git records **44 `R100` renames and 0 changed lines** across every path, in a commit touching nothing outside `supabase/migrations/`. `008b_add_is_admin_to_users.sql` — the unparseable name at the centre of F-047 — still sits in the archive under exactly that name. It simply stopped being a migration.

## What the numbers were, and are

| | Before | After |
|---|---|---|
| Top-level files | 44 | **1** |
| Distinct versions among them | 39 | 1 |
| Collision groups | 4, covering 9 files | **0** |
| Filenames silently passed over | 1 | **0** |
| `db reset` | aborts at the 12th file on `Key (version)=(011)` | **exit 0** |
| `db diff --linked` | unusable — its shadow replays these same files | **0 bytes** |
| Files renamed | — | **0** |

## Verification results

| Check | Result |
|---|---|
| `supabase db reset --local` | exit 0; transcript grep for the CLI's silent-pass-over word = **0** |
| `supabase migration list --local` | exactly **1** applied version, `20260915214553`, matching the one top-level file |
| `evidence/db-diff.prod.sql` | **0 bytes** |
| Four-point object check | rsvps present (F-044); no `user_engagement_summary` (F-048); no `events_tests` (F-049); no `users.is_admin` column (F-047) — all ✅ |
| Policy census crosscheck | live **101**, baseline **101**, symmetric difference **0** |
| `node scripts/check-migration-filenames.mjs` | exit 0; empty-directory negative control still exits 1 |
| CI wiring | `check-migration-filenames` ×1, `node-version:` literals ×0, Docker ×0 |
| AR-12 envelope | `txn_read_only: "on"`, `role: supabase_read_only_user`, captured **79 s before** the dump |
| `npm run lint` | exit 0 — 0 errors, 19 warnings (phase floor) |
| `npx tsc --noEmit` | exit 0, no output |
| `npm test -- --ci` | exit 0 — **332 passed, 5 skipped** (phase floor) |
| `check-baseline.mjs` | exit 0 — **22 passed, 0 failed** |
| `git status --porcelain src/ package.json package-lock.json` | empty |

## The check that actually mattered

Forty-one of production's 101 RLS policies are declared by no migration at all (F-012). That makes an eye review structurally insufficient — there is nothing local to compare against, so a reviewer would be checking the file against itself. **T-03-04-05 is the threat that the baseline silently drops a live policy, and it was closed by measurement:** both sides were reduced to `schema.table :: policyname` pairs and diffed as sets.

```
live_policy_count=101
baseline_policy_count=101
symmetric_difference_count=0
```

Every live policy is in the baseline, on the same table, under the same name. The plan required each symmetric-difference entry to be explained individually — there are none. Worth stating why that was not assumed: the census was captured 2026-09-14 and the baseline 2026-09-15, so a non-empty difference would have been *legitimate*. Production simply had not moved.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] D-16: the plan's `--schema public,storage` baseline cannot replay**

- **Found during:** Task 3, the first `db reset`.
- **Issue:** The reset aborted at statement 21 — `permission denied for schema storage` on `CREATE TYPE "storage"."buckettype"`. The plan and 03-RESEARCH.md both specify `--schema public,storage`, and that baseline is not applyable.
- **Diagnosis, probed rather than assumed:** `has_schema_privilege('postgres','storage','CREATE')` = **f**; `storage.objects` is owned by `supabase_storage_admin`; `postgres` is neither a superuser nor a member of that role; `CREATE TYPE storage.…` → permission denied; `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` → must be owner; **but `CREATE POLICY … ON storage.objects` → permitted.** The local database already had the storage schema's 10 tables and its enum, and RLS already enabled, before any migration ran.
- **Fix:** The baseline carries `public` in full plus the 15 `storage.objects` policies and nothing else from the storage schema. The privilege boundary falls exactly on the ownership boundary: storage *structure* is service-owned and created identically from the same image in every environment; storage *policies* are application-owned. All 15 live storage policies are on `storage.objects`, so nothing is lost.
- **Why this does not weaken the gate:** `db diff --linked --schema public,storage` still diffs **both** schemas. If local and production disagreed about the service-managed structure, the diff would be non-empty. It is empty — so the claim is tested, not assumed.
- **Files:** `supabase/migrations/20260915214553_baseline.sql`, `evidence/db-reset.txt` (run 1 kept deliberately), `evidence/baseline-review.md` § 0.1. **Commit:** `bec4cf1`.

**2. [Rule 1 — Bug] D-17: `db dump` omits `CREATE EXTENSION`, and only the diff could catch it**

- **Found during:** Task 3, the first `db diff` — which returned exactly one line.
- **Issue:** `create extension if not exists "pg_trgm" with schema "public";`. `supabase db dump` filters extensions out of its output, so the baseline was incomplete while the reset was green.
- **Why it matters:** `public.search_events_fuzzy` executes `SET pg_trgm.similarity_threshold = 0.1` in its body. Without the extension the function errors **at call time**, not at migration time — `CREATE FUNCTION` does not validate a GUC reference inside a body. Any environment built from that baseline would have looked healthy and broken on first search.
- **Fix:** migra's own emitted DDL inserted verbatim, ahead of every type and table. A generated baseline deserves a generated fix; hand-authoring it would have made the baseline a claim about production rather than a copy of it.
- **Files:** `supabase/migrations/20260915214553_baseline.sql`. **Commit:** `bec4cf1`.

**3. [Rule 2 — Safety] `--local` made explicit on every `db reset`**

- **Found during:** Task 3, reading `db reset --help` before running it.
- **Issue:** The plan's command is bare `supabase db reset`. The default is local — but the project is linked by this point, and `--linked` on that same command **resets the remote project**. A default whose failure mode is production should not be relied on.
- **Fix:** `--local` passed explicitly on all three runs, and the reasoning recorded at the top of the transcript so a later reader copying the command inherits the guard.
- **Files:** `evidence/db-reset.txt`. **Commit:** `bec4cf1`.

**4. [Rule 1 — Bug] Two evidence files matched the greps they were asserting**

- **Found during:** Tasks 2 and 3, running the acceptance criteria.
- **Issue:** `baseline-review.md` § 6 inlined the credential sweep patterns, and `db-reset.txt` inlined the CLI's silent-pass-over word and the push subcommand. Each therefore matched the very grep whose result it was reporting as zero.
- **Fix:** Both cite their patterns by reference — to `REDACTION.md § The five shapes`, to F-047, and to the plan's prohibitions — with the reasoning stated, because a later reader will otherwise "helpfully" re-inline them.
- **Files:** `evidence/baseline-review.md`, `evidence/db-reset.txt`. **Commits:** `4969180`, `bec4cf1`.

### Decisions taken at the checkpoint, before this session

**D-15 — baseline by dump, not by pull.** The first executor stopped at a checkpoint on exactly this, and the orchestrator decided it. `supabase db pull --linked` may record the pulled migration in production's `supabase_migrations.schema_migrations` — the production write D-02 gates behind plan 03-08 and T-03-04-04 prohibits by name. `db dump --linked` is a pure `pg_dump` read and cannot write at all. 03-RESEARCH.md § Assumptions Log A1 rated the `db pull` mechanic as the one unverified step on the critical path (High) and already named the dump as the documented fallback producing equivalent DDL — **so A1 closes as routed-around rather than verified, and production's history is provably untouched.**

### Authentication gate (resolved, not a deviation)

The first session stopped at a `human-action` checkpoint: the Management API token and database password were absent. Both were supplied through the macOS keychain. Each was read **in the same command that used it**, never passed as `-p`/`--password` (which would put it in shell history), and written to no file. `.env.local` was never opened. `SUPABASE_DB_PASSWORD` was unset on completion. The link succeeded on the CLI's default pooler path on the first attempt — `--skip-pooler` was prepared but not needed.

### Deliberately not done

- **No production write of any kind.** No `db push`, no `migration repair`, no `db pull`, no `migration fetch`.
- **`supabase/seed.sql` not created** (T-03-04-10). A file there would run inside every reset and falsify plan 03-07's determinism claim before it is written. The reset's `WARN: no files matched pattern: supabase/seed.sql` is the expected, correct output.
- **No archived file moved back to the top level**, and no archived file's name or content changed.
- **No package installed.** `package.json` and `package-lock.json` untouched.
- **The production history repair not performed.** Deferred in writing — see below.

## What production still holds that this did not change

The baseline is a photograph of production. **A photograph of a door does not lock it**, and the reconciliation note says so at length because this is the section most likely to be misread.

| Object | Status |
|---|---|
| `supabase_migrations.schema_migrations` | **Untouched.** 45 rows, still no row for the baseline version. |
| 41 previously-undeclared RLS policies | **Now controlled** — in the baseline, verified by set difference. The one item that genuinely moved from uncontrolled to controlled. |
| 3 dashboard-created storage buckets | **Not captured.** A `db reset` produces a database with no buckets in it. |
| 3 pg_cron jobs | **Not captured.** `cron.schedule` appears 0 times in the baseline and in 0 of the 45 history rows. |

### The deferred production repair, stated in full

The one remaining production write is `supabase migration repair --status applied 20260915214553 --linked`. It is **not** performed, and the plan is complete without it: REFAC-01's criteria are a reset and a diff, and neither depends on production's history table. It stays D-02's gated decision for plan 03-08, and declining it is an acceptable outcome that defers to Phase 8's deployment certification.

**The one real cost, named:** while the repair is outstanding, production's history has no row saying the baseline is applied, so a `supabase db push` would try to apply it — redundant at best, destructive at worst. **Deferring the repair is safe; deferring it and then pushing is not.**

And under no option are the 45 historical versions to be marked `reverted`. They are true statements about what happened, and eighteen of them are the only surviving record of the March 2026 burst.

## Carry-forwards for plan 03-05 — measured, not suspected

The three Wave 1 predictions about a baseline that did not yet exist were all checked against the real file.

**1. A real performance defect, newly visible.** Of the twelve never-applied files, ten are entirely live in production already. One is partial: `20260308000001_fuzzy_search.sql` declares a function and two trigram indexes. **The function is live; both indexes are absent.** Production's `public.events` carries five indexes and not one is trigram, while `search_events_fuzzy` calls `similarity()`. Every fuzzy search in production today is a sequential scan computing trigram similarity per row, and it degrades with every event added. **This is REFAC-02's strongest candidate** and was invisible before a baseline existed to compare against.

**2. Club-invitation acceptance is broken in production.** The three invitee policies are in neither production nor the baseline (F-016). `public.club_invitations` has exactly two policies, both for club owners. **An invitee can neither see nor accept their own invitation.** Re-add as a new migration.

**3. `fk_indexes_and_cleanup` is a confirmed no-op — do not re-issue it.** All nine of its FK indexes are present in the baseline and `events_tests` is already absent. Writing that migration would do nothing.

**4. There is no cron schedule to recover anywhere.** The commented-out line in `20260313000002_recommendation_engine.sql` remains REFAC-03's only raw material.

## Requirements completed

- **REFAC-01** — Migration reconciliation. The folder replays, the diff against production is empty, and no file was renamed.

## Self-Check: PASSED

- **13 claimed files** verified present on disk, plus the 18 `.recovered` files.
- **5 claimed commits** verified in `git log` (`799bce0`, `de05f83`, `a3b5bfe`, `4969180`, `bec4cf1`).
- The zero-byte diff, the 101/101/0 policy crosscheck, the CI step, and the full phase floor were all re-verified **after** the final commit, not before it.

**One near-miss worth recording, because it is a trap the next reader will hit too.** The self-check first computed the archive's changed-line count as **799**, which would have meant REFAC-01 was violated. It was not: `git show -M --numstat <sha>` prints the commit header and message, and summing `$1+$2` across every line sweeps up the digits in the commit message. The correct form is `git show --format= -M --numstat`, which yields **44 rows, 0 changed lines**. Task 1's own evidence had already caught this and recorded *both* values deliberately — `changed_line_count=0` alongside `changed_line_count_header_contaminated=799` — which is the only reason the discrepancy resolved in seconds instead of triggering a re-do of the archive. Evidence that records the wrong answer next to the right one, and says which is which, earns its keep.
