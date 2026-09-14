---
phase: 01-read-only-foundation-audit
plan: 08
subsystem: database
tags: [supabase, postgres, migrations, schema-drift, typescript, pg_cron, storage, static-analysis]

# Dependency graph
requires:
  - phase: 01-read-only-foundation-audit (plan 01-06)
    provides: "production catalog census (information-schema-columns.json), the applied-migration envelope (raw/prod/migrations-applied.json), the failed local replay transcript (schema/local-reset.txt), and the MCP/Management-API transport precedent"
  - phase: 01-read-only-foundation-audit (plan 01-01)
    provides: "readonly-guard.sh, REDACTION.md sweep patterns, the redaction/ per-plan ledger convention, BLOCKING-INPUTS.md"
provides:
  - "AUDIT-02 three-way drift table — drift.json (288 rows) and drift.md, covering all 243 production columns across all 30 production tables"
  - "gen-drift-table.mjs — zero-dependency ESM generator reconciling catalog census, statically parsed migrations, and types.ts per column"
  - "Applied-migration accounting for production: 45 applied versions vs 39 declared by 44 files, overlapping in only 27"
  - "The evidence that supabase/migrations/ has no shadow-database build at all, reached from a second command (db diff) independently of plan 01-06's replay"
  - "Six named drift consequences ready to become findings: rsvps, events_tests, user_engagement_summary, users.is_admin, 3 dashboard storage buckets, 3 pg_cron jobs"
affects: [01-13 finding register, 01-18 storage policy review, 01-11 cron inventory, REFAC-01 migration history, REFAC-02 schema-as-code, REFAC-04 generated types]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static SQL parsing as a first-class substitute for migration replay when the folder cannot replay"
    - "Capture-envelope reuse: a blocked CLI command is satisfied from a previously captured raw envelope, with the transport deviation stated in the artifact itself"
    - "Deferred-with-reason stubs that separate 'input not supplied' from 'the repository is broken', and name which one applies"

key-files:
  created:
    - .planning/audit/schema/migration-list.prod.txt
    - .planning/audit/schema/migration-list.staging.txt
    - .planning/audit/schema/migration-list.local.txt
    - .planning/audit/schema/db-diff.prod.sql
    - .planning/audit/schema/db-diff.staging.sql
    - .planning/audit/tools/gen-drift-table.mjs
    - .planning/audit/schema/drift.json
    - .planning/audit/schema/drift.md
    - .planning/audit/redaction/01-08.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Mark AUDIT-02 complete despite neither `supabase db diff` nor `supabase migration list` having run — the requirement's substance is delivered at higher fidelity, and the tool failure is itself a Stage 3 finding"
  - "Derive the migrations column by static SQL parsing rather than replay, and say so on the artifact, because replay cannot run"
  - "Record db-diff.prod.sql as blocked TWICE — no credential, and a shadow build that would fail anyway — so a later pass does not mistake it for a credential problem"
  - "Classify object-scope rows (storage buckets, pg_cron jobs) on production-versus-migrations alone, since types.ts models only the public schema"
  - "Re-derive the redaction sweep under bash after discovering the zsh run was a false clean, and record the false clean in the ledger rather than quietly replacing it"

patterns-established:
  - "Generator merge semantics: OWNED_FIELDS are overwritten, `human_note` and any hand-added key survive a re-run, and consecutive runs are byte-identical"
  - "Markdown views are rendered from the JSON they describe so the two representations cannot disagree"
  - "A blocked artifact carries the exact command that would produce it, the variable NAMES it waits on, and an explicit statement of which precondition is missing"
  - "A sweep that cannot fail is not a sweep — record the command shape, not just the counts"

requirements-completed: [AUDIT-02]

# Metrics
duration: 52 min
completed: 2026-09-14
status: complete
---

# Phase 1 Plan 08: Schema Drift Slice Summary

**A 288-row three-way drift table showing production and `supabase/migrations/` agree on only 27 of 45+39 migration versions and diverge on 76 columns, while `types.ts` matches production exactly — so the drift runs entirely between production and the repository, and the shadow-database diff that was supposed to prove it cannot be built at all.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-09-14T19:12Z
- **Completed:** 2026-09-14T20:04Z
- **Tasks:** 2
- **Files created:** 9 (all under `.planning/audit/`)

## Accomplishments

- **The core Stage 1 question is answered per column.** `schema/drift.json` carries 288 rows — 278 column rows covering every one of the 243 production columns, plus table- and object-scope rows — each with `exists_in_prod`, `exists_in_migrations`, and `typed_correctly` set, and a `drift_class` from the agreed five-value vocabulary. `schema/drift.md` is rendered from that JSON so the two cannot disagree.
- **The "45 vs 44 migrations" documentation discrepancy turned out to understate the gap by an order of magnitude.** The 44 files collapse to 39 distinct versions (four collision groups across nine files); production reports 45 applied versions; the two sets overlap in **27**. **18 versions are applied in production with no file in the repository** — 17 of them in a two-day burst on 2026-03-15/16 — and **12 files declare a version production never applied**.
- **`supabase db diff` was proven impossible, not merely unavailable.** It builds a shadow Postgres by replaying `supabase/migrations/` before comparing anything, and that replay aborts at the 12th of 44 files. A production credential would not have unblocked it. This is the same defect plan 01-06 found, reached independently through a second command, which upgrades it from "a local stack problem" to "this repository has no schema-as-code".
- **Zero `type-mismatch` rows, which is a finding rather than an all-clear.** Every production column has a correctly-typed `Row` property in `types.ts`, enum arrays included. That places `types.ts` downstream of production: it was regenerated *after* the out-of-band changes landed. REFAC-04 is cheap; REFAC-01 is the expensive one — and regenerating types would *hide* drift, because the generator reads production, not the migrations folder.
- **Six named drift consequences, each ready to become a finding in plan 01-13**, listed in `drift.md` § Named consequences and enumerated below.

## Task Commits

1. **Task 1: Capture migration history and the shadow-database diff** — `0f08b29` (feat)
2. **Task 2: Generate the three-way drift table and its human view** — `c6c9710` (feat)

**Plan metadata:** see final `docs(01-08)` commit.

## Files Created/Modified

| File | What it is |
|---|---|
| `schema/migration-list.prod.txt` | Applied-migration accounting for production, derived from the plan 01-06 Management API envelope. LOCAL/REMOTE/TIME table over 57 versions, plus the collision census and the 18-remote-only / 12-local-only breakdown |
| `schema/migration-list.staging.txt` | `BLOCKED — input not supplied`, with the exact `--project-ref` / `--db-url` commands and the note that an absent staging project is itself a finding |
| `schema/migration-list.local.txt` | The local applied set transcribed from `local-reset.txt`: 11 applied, 1 silently skipped, 1 aborting, 32 never reached |
| `schema/db-diff.prod.sql` | Blocked twice — no credential, and a shadow build that fails regardless. Records the verified preconditions (Docker **is** reachable, CLI **is** installed, project **is not** linked) so the block is not misattributed later |
| `schema/db-diff.staging.sql` | Blocked three times — the two above plus no staging baseline to diff against |
| `tools/gen-drift-table.mjs` | 1,079-line zero-dependency ESM generator: SQL lexer respecting quotes and dollar-quoted bodies, `CREATE TABLE`/`ALTER TABLE ADD COLUMN`/`DROP` extraction, brace-depth `types.ts` Row parser, pg→TS expectation table keyed on `udt_name`, merge-by-key writer |
| `schema/drift.json` | 288 rows, the machine-readable table. Sorted to a total order; two consecutive runs are byte-identical |
| `schema/drift.md` | Generated human view: source hierarchy, per-class summary, the `types.ts`-is-generator-output correction, named consequences, per-table sections listing only the drifting rows |
| `redaction/01-08.md` | Per-plan redaction ledger: nine artifacts, seven patterns, per-file counts, the one non-zero count itemised and dismissed, and the false-clean incident |

## The drift, in numbers

| Drift class | Rows | Meaning |
|---|---:|---|
| `in-sync` | 212 | all three sources agree |
| `prod-only` | 39 | exists in production; **no migration declares it** |
| `migrations-only` | 22 | a migration declares it; **production does not have it** |
| `type-mismatch` | 0 | production and migrations agree but `types.ts` disagrees |
| `types-only` | 15 | `types.ts` declares it; nothing else does |
| **total** | **288** | 278 column rows, 7 table rows, 7 object rows |

**76 of 288 rows are not in sync.**

### Named consequences (finding candidates for plan 01-13)

1. **`rsvps` is created by no migration at all.** The table exists in production with all six of its columns `prod-only`. `011_rls_audit.sql` writes RLS policies *for* it and `20260313000002_recommendation_engine.sql` reads it; neither creates it. `011_rls_audit.sql` is also one half of the duplicate-`011` pair that aborts the replay. A table holding user-linked RSVP state has no schema-as-code anywhere.
2. **`users.is_admin` is declared by the one file the CLI silently skips.** `008b_add_is_admin_to_users.sql` does not parse as `<version>_<name>.sql`, so the CLI prints *Skipping* and continues with exit status 0. `009_user_roles.sql` guards its `DROP COLUMN is_admin` behind a `DO $$ … IF EXISTS` block precisely because the column is absent on a fresh replay.
3. **`events_tests` exists only in `types.ts`** (14 columns + the table row = all 15 `types-only` rows). The only migration mentioning it is a `DROP TABLE IF EXISTS` in `20260316000004_fk_indexes_and_cleanup.sql` — a file whose version was never applied. Created out of band, dropped out of band, captured into the types file, cleanup migration still unapplied.
4. **`user_engagement_summary` was never built.** `005_user_engagement.sql` creates it; production has no such table. Eleven of the 22 `migrations-only` rows are its columns.
5. **3 of 4 storage buckets exist only in production** (`avatars`, `banners`, `club-logos`). `supabase/config.toml`'s `[storage.buckets.*]` block is entirely commented out and only `event-images` has a migration. All three are `public = true`; two carry no MIME-type allow-list at all. This is AUDIT-18's subject reached from the drift side.
6. **All 3 pg_cron jobs exist only in production** (`compute-user-scores`, `send-event-reminders`, `send-feedback-requests`). The sole trace in the repository is a commented-out `cron.schedule(...)` line in a file whose version was never applied. Three live scheduled jobs mutating production data, none of them schema-as-code.

Incidental but worth a look during Stage 2: `users` carries `pinned_contracts text[]` and `total_habits_completed integer` in production, both `prod-only` and both semantically foreign to a campus-events product; and `users.full_name` is `migrations-only` while `users.name` is `prod-only`, the shape a rename performed out of band leaves behind.

## Decisions Made

1. **Mark AUDIT-02 complete despite neither named tool having run.** The requirement names `supabase db diff` and `supabase migration list`; neither could run. The deliverable it describes — every table and column with all three statuses — is nonetheless complete, and at higher fidelity than a textual diff would give. The tool that failed did so for a reason that is itself a Stage 3 finding, so withholding the requirement would have penalised the audit for discovering the defect it exists to find. The deviation is written inline into the REQUIREMENTS.md traceability row, not just here.
2. **Derive the migrations column by static parsing, and label the question it answers.** `exists_in_migrations` means "a migration file declares this", **not** "a rebuilt database would have this" — the second is unanswerable today. Both `drift.md` and the generator's header docblock say so explicitly, so no downstream reader over-reads the column.
3. **Record the diffs as blocked twice.** Writing only "no credential" would have invited a later pass to supply a password, re-run, and fail again. The stub names both blocks and marks the second as the finding.
4. **Object-scope rows are classified on production-versus-migrations alone.** `types.ts` models the `public` schema and has no obligation to storage buckets or cron jobs, so `typed_correctly` is `false` by construction on those rows and each one says so in its `notes`. The alternative — a `null` — would have failed the validator's all-three-statuses-set assertion for a non-reason.
5. **No `supabase link`, ever.** Linking writes project state into `supabase/.temp/`, inside the directory under audit. Every command recorded in every artifact uses the per-command `--project-ref` / `--db-url` form instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first redaction sweep was a false clean and was re-derived**

- **Found during:** Task 2 (redaction step, while extending the sweep to the Task 2 artifacts)
- **Issue:** The sweep loop used `grep -cE "$p" $FILES` with `FILES` a space-separated path string. The interactive shell for this phase is **zsh**, which does **not** word-split an unquoted parameter. The loop therefore passed one long non-existent path to `grep`, matched nothing, and printed `0` for all seven patterns. The Task 1 sweep had already been run and committed on that basis. A sweep that structurally cannot return a non-zero count is worthless as evidence, and it had already been written into `redaction/01-08.md` as a clean result.
- **Fix:** Re-ran the sweep under `bash -c` with a proper array over all eight artifacts, per file. One genuine non-zero surfaced: `sb_secret_` appears once, in `tools/gen-drift-table.mjs`, inside the generator's own `scrub()` regex — a pattern definition, not a value, and exactly the `tools/` carve-out `REDACTION.md` § Self-reference caveat already describes. Corrected `redaction/01-08.md` to report the true counts, itemise and dismiss the single hit, and record the false-clean incident with the rule for future passes: never use an unquoted variable holding a path list under zsh.
- **Files modified:** `.planning/audit/redaction/01-08.md`
- **Verification:** Per-file counts re-derived under bash; the direct single-file `grep -c 'sb_secret_' tools/gen-drift-table.mjs` returns `1`, confirming the loop is now capable of returning a non-zero.
- **Committed in:** `c6c9710`

**2. [Rule 2 - Missing Critical] Added table-scope rows for production tables no migration creates**

- **Found during:** Task 2, after the first generator run
- **Issue:** The plan asked for table-level rows in two directions — objects the column census cannot express, and tables in the migrations folder absent from production. It did not ask for the third direction: a table that exists in production which no migration creates at all. The first run surfaced `rsvps` with all six columns `prod-only` and no table-level row to say *why*, which reads as six independent column omissions rather than one whole-table gap.
- **Fix:** Added a third table-scope pass emitting a `prod-only` row for any production table absent from the migration parse, with a note stating that every one of its columns is `prod-only` for the same single reason.
- **Files modified:** `.planning/audit/tools/gen-drift-table.mjs`
- **Verification:** Row count 287 → 288; `table-scope prod-only: rsvps`; generator still byte-identical across consecutive runs.
- **Committed in:** `c6c9710`

**3. [Rule 1 - Bug] Hard-coded counts in the generated Markdown were replaced with derived ones**

- **Found during:** Task 2, reviewing the rendered `drift.md`
- **Issue:** Three sentences in the "Named consequences" block spelled out numbers as literals ("Eleven of the twenty-two", "two of them carry no MIME-type allow-list"). Correct on the day, silently wrong the moment the data moves — the exact failure mode `drift.md` is generated from `drift.json` to avoid.
- **Fix:** Derived all three from the row set (`uesCols`, `counts["migrations-only"]`, `orphanBuckets.length`, `openMime`), and extended the storage-bucket `prod_type` to carry `mime_allowlist=` so the MIME count is derivable from the rows rather than from a side lookup.
- **Files modified:** `.planning/audit/tools/gen-drift-table.mjs`
- **Verification:** Regenerated; the rendered sentences now read "11 of the 22" and "2 of them", matching the data. `drift.md` byte-identical across consecutive runs.
- **Committed in:** `c6c9710`

### Planned-tool deviations (not auto-fixes — the plan anticipated these)

| Plan expected | What happened | Where recorded |
|---|---|---|
| `supabase migration list --linked` for production | No credential and no link permitted; derived from `raw/prod/migrations-applied.json` (Management API, plan 01-06) | Provenance block at the top of `migration-list.prod.txt` |
| `supabase migration list --project-ref` for staging | No staging project reachable by any transport | `migration-list.staging.txt`, `BLOCKED — input not supplied` |
| `supabase migration list --local` | Ports 54321–54327 held by an unrelated stack; and the replay aborts regardless | `migration-list.local.txt`, transcribed from `local-reset.txt` |
| `supabase db diff` × 2, stdout-redirected | Cannot run, and would fail with a credential — the shadow build is broken | `db-diff.prod.sql`, `db-diff.staging.sql` |
| The drift table's migrations column from the diff | Static SQL parsing of the 44 files | `gen-drift-table.mjs` header, `drift.md` § the three sources |

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical) + 5 anticipated tool substitutions.
**Impact on plan:** No scope creep. Every plan artifact exists; the two genuinely blocked ones carry the exact commands and an explicit statement of which precondition is missing. The auto-fixes tightened evidence quality (a sweep that can fail, counts that cannot go stale) and closed a gap in the drift table's coverage.

## Issues Encountered

- **The container daemon precondition from 01-RESEARCH.md Pitfall 5 is no longer the blocker it was.** `baseline/versions.txt` records `docker_daemon_reachable=false` as of 07:00; Docker reports `29.4.0` now. This was verified and written into `db-diff.prod.sql` so a later reader does not attribute the empty diff to Docker. The baseline line is stale but was deliberately **not** edited — it is a Wave 0 capture, and rewriting a captured baseline to match a later observation would destroy the thing it is for.
- **The out-of-repo scratch stack from plan 01-06 no longer exists** (the CLI's error path tore it down; only the unrelated `PassiveIncomeInvestingDEMO` containers are running). `migration-list.local.txt` is therefore transcribed from the committed transcript rather than re-queried. The transcript *is* the local applied set, so nothing is lost.
- **`grep` in this shell is a ugrep shim.** All counts relied on for evidence were taken with `command grep`; the zsh word-splitting incident above was a separate and more serious instance of the same class of problem.

## Read-only compliance

- `bash .planning/audit/tools/readonly-guard.sh` — exit 0 after every command and after both commits.
- `git status --porcelain -- supabase/` — empty throughout. No migration file created; `-f`/`--file` never passed; `supabase/.temp/project-ref` absent (never linked).
- `ls supabase/migrations | wc -l` — **44**, matching `baseline/versions.txt migration_count=44`.
- `git diff --stat` across `0f08b29..c6c9710` touches nothing outside `.planning/`.
- Untracked paths belonging to other work (`.agents/`, `.mcp.json`, `skills-lock.json`, `docs/product-master-plan.md`, `.planning/research/.cache/`) were neither staged nor deleted.
- No credential entered the shell; no secret was passed as a command-line argument; `set -x` was never enabled.

## User Setup Required

None — no external service configuration required. Two artifacts remain blocked on operator input (`STAGING_PROJECT_REF` or `STAGING_DB_URL`); both name the variable and the exact command, and `BLOCKING-INPUTS.md` § 1 already tracks them.

## Next Phase Readiness

**Ready for plan 01-09.** AUDIT-02 is complete and marked, with the tool deviation written inline into the REQUIREMENTS.md traceability row.

Consumers of this plan's output:
- **Plan 01-13 (AUDIT-20 finding register):** six named consequences above, plus the version-accounting finding (27-of-45/39 overlap) and the "no shadow database can be built" finding. Every non-`in-sync` row in `drift.json` is a finding candidate.
- **Plan 01-18 (AUDIT-18 storage policies):** three dashboard-created public buckets, two with no MIME allow-list, are already identified as `prod-only`.
- **Plan 01-11 (AUDIT-11 cron inventory):** all three pg_cron jobs are `prod-only`, and the file that would have scheduled one of them was never applied.
- **Stage 3 REFAC-01:** this is the headline. No environment can be rebuilt from source; production's schema exists only in production.

Open concerns carried forward: staging remains entirely unaudited and unverified as to whether it exists at all; and `AUDIT-01`'s staging/local snapshots stay blocked for the same reasons, so `validate.mjs --check schema-snapshots` still fails by design.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
