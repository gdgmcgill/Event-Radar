---
phase: 01-read-only-foundation-audit
plan: 09
subsystem: database
tags: [rls, postgres, supabase, pg-policies, authorization, security, schema-drift, heatmap, pgtap]

# Dependency graph
requires:
  - phase: 01-01
    provides: "readonly-guard.sh, validate.mjs (--check rls, --check heatmap), REDACTION.md, the redaction/ ledger directory, findings.schema.json and SEVERITY_SLA.md"
  - phase: 01-06
    provides: "the 21 SELECT-only production capture envelopes under raw/prod/ (pg-policies, tables, grants, indexes, information-schema-columns, functions, triggers, constraints, row-counts, storage-policies) and the transport resolution this plan inherited"
  - phase: 01-02
    provides: "inventory/endpoints.json — signals.tables_referenced and signals.uses_service_client, which decide per table whether a policy gap is RLS-reliant or service-role-masked"
  - phase: 01-07
    provides: "authz/service-role-register.json — the 25 RLS-bypassing callsites"
  - phase: 01-08
    provides: "schema/drift.json — the prod-only classification of rsvps and the migrations-only classification of user_engagement_summary"
provides:
  - "rls/pg_policies.json — all 101 live policies across public and storage, per-row provenance (captured_at, transport, source envelope, executed SQL), with roles parsed, ALL expanded to the four DML commands, and unconditional-true detection precomputed"
  - "rls/rls-enabled.json — 38 relations with relrowsecurity, relforcerowsecurity, policy counts by command, and the anon/authenticated/service_role DML grants that decide whether a policy is load-bearing or inert"
  - "rls/policy-column-indexes.json — 80 policy-referenced columns with index coverage, including columns reached across tables through EXISTS subqueries"
  - "rls/rls-flags.json — 94 flags over six classes, each citing table, policy, evidence, anonymous reachability, proposed severity and rationale"
  - "rls/rls-review.md — the AUDIT-05 review: eight sections, 21 proposed findings (2 Critical, 5 High), every claim citing the raw capture by path"
  - "tools/pivot-rls-heatmap.mjs — deterministic zero-dependency ESM pivot; no socket, no env read, CSV quoting inline"
  - "rls/rls-heatmap.csv — the AUDIT-06 grid, 152 rows, allow/deny/none, storage.objects included"
  - "rls/rls-heatmap-notes.csv — per-cell traceability back to the policies that produced each allow"
  - "redaction/01-09.md — sweep counts (all zero) with a positive control, and the ten policy-expression literals enumerated and classified"
  - "The finding that 41 of 101 live policies are declared by no migration and 24 migration-declared policies are absent from production — a blocking input to REFAC-01"
affects: [01-10 cron and storage, 01-11 endpoint classification, 01-12 findings register, 01-13 phase gate, Stage 3 REFAC-01 migration reconciliation, Stage 3 authorization slice, Stage 4 pgTAP RLS matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static catalog pivot with its limits stated on the artifact: an allow cell means a policy is consulted, not that its predicate returns rows, and the docblock says so rather than leaving a reader to infer it"
    - "Deny versus none as distinct cell values, so an RLS-disabled table can never be read as a wall of allow"
    - "Per-row provenance on a derived artifact (captured_at, transport, source, source_query) so each row is citable without a wrapper envelope the validator would reject"
    - "Mechanical detection plus hand-assigned severity: the script guarantees the flag list is complete, an explicit severity map keyed by policy id carries the judgement and its rationale into the JSON"
    - "Validator-constrained artifacts get a sidecar rather than a widened schema: traceability that would break --check heatmap lives in rls-heatmap-notes.csv, same script, same inputs, same row order"
    - "Positive control on every redaction sweep: a pattern that MUST match is run alongside the patterns that must not, so a zero count is evidence rather than an artifact of shell quoting"

key-files:
  created:
    - .planning/audit/rls/pg_policies.json
    - .planning/audit/rls/rls-enabled.json
    - .planning/audit/rls/policy-column-indexes.json
    - .planning/audit/rls/rls-flags.json
    - .planning/audit/rls/rls-review.md
    - .planning/audit/tools/pivot-rls-heatmap.mjs
    - .planning/audit/rls/rls-heatmap.csv
    - .planning/audit/rls/rls-heatmap-notes.csv
    - .planning/audit/redaction/01-09.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Mark AUDIT-05 complete despite the transport deviation: the requirement's words are 'from live pg_policies (not from migration files)', and the source is a SELECT-only production capture whose executed SQL is on disk. The deviation is which client issued the SELECT, not whether the database was the source."
  - "Extend the flag set from the plan's four classes to six, adding WITH CHECK (true) and unindexed-policy-column — all three Critical/High write-path findings live on the write side, and a review that reported only USING (true) would have found none of them"
  - "Emit the heatmap's policy-count and policy-name traceability as rls-heatmap-notes.csv rather than trailing columns, because validate.mjs --check heatmap rejects any non-empty cell outside table/command that is not allow|deny|none — the plan requires both the columns and the check, and only the sidecar satisfies both"
  - "Include all 38 public and storage relations in the enablement census and the heatmap, not just public: storage.objects carries 15 policies and the phase brief requires it in the grid. cron is excluded — it is AUDIT-11's scope and carries no policy"
  - "Compute the service_role column by the same mechanical rule as every other role and state the BYPASSRLS caveat in the docblock, rather than special-casing it to allow: a grid whose cells are computed two different ways is not checkable"
  - "Do not replay supabase/migrations/ against any environment — a reset would drop 41 live policies. Baseline from production first."
  - "Derive the four Task 1 artifacts from the committed raw envelopes with the field-by-field transform documented in rls-review.md § Derivation rather than adding a generator outside the plan's files_modified"

patterns-established:
  - "Flag classes are reported even when empty: section 1 says 'zero RLS-disabled tables' rather than omitting the section, because an absent section reads as an unasked question"
  - "Every proposed finding carries anonymous reachability and whether a compensating control exists at the authorization ring, so severity is derived rather than asserted"
  - "A derived security artifact names its own detection heuristic and that heuristic's limits in a per-row field (policy-column-indexes.json → detection)"
  - "Where the index census does not cover a schema, the artifact reports indexed: null and makes no claim, rather than reporting false"

requirements-completed: [AUDIT-05, AUDIT-06]

# Metrics
duration: 27 min
completed: 2026-09-14
status: complete
---

# Phase 1 Plan 09: Row-Level Security Slice Summary

**All 101 live policies captured and reviewed: row security is enabled on every one of the 38 relations, but `anon` holds all four DML grants on every public table so RLS is the only control — and inside it sit two Criticals (any authenticated user can set their own `users.roles` to `admin`; any anonymous caller can write the moderation audit log), 61 of 101 policies with no `TO` clause, and a migration history that declares 41 fewer policies than production runs.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-14T19:28Z
- **Completed:** 2026-09-14T19:55Z
- **Tasks:** 3
- **Files created:** 9 (all under `.planning/audit/`); 3 tracking files modified

## Accomplishments

- **AUDIT-05 and AUDIT-06 are both complete and marked**, with the transport deviation written inline into the REQUIREMENTS.md traceability rows. `validate.mjs --check rls` and `--check heatmap` both exit 0.
- **The wide-open failure mode is absent, and that is a real result rather than a formality.** `relrowsecurity` is `true` on all 38 relations — zero RLS-disabled tables. It matters because of what sits underneath: **every one of the 30 public tables grants `SELECT, INSERT, UPDATE, DELETE` to both `anon` and `authenticated`**. There is no second control at the table-privilege layer. One disabled table would have been an unauthenticated read/write of its entire contents through the publishable key.
- **The serious findings are all on the write side, which is why the flag set was extended.** The plan named `USING (true)`; production has 12 of those, and they are mostly privacy rather than integrity. The 9 `WITH CHECK (true)` policies are where the damage is: `admin_audit_log` accepts inserts from `{public}` with no predicate at all (the policy is *named* "Admins can insert audit log"), `events` INSERT imposes no predicate so the `pending → approved` moderation pipeline is bypassable from the client, and `user_interactions` INSERT lets an anonymous caller attribute an interaction to any `user_id` — on a table with an `AFTER INSERT` trigger that recomputes popularity.
- **The single highest-impact finding is a privilege-escalation path that no one policy looks wrong on its own.** `users :: Users can update own profile` is `USING (auth.uid() = id)` with no `WITH CHECK`; `authenticated` holds a table-level `UPDATE` grant covering every column; `users.roles` has no `CHECK` constraint and no trigger. **Any signed-in user can `PATCH` their own row to `roles = '{admin}'`**, after which `is_admin()` — which eleven policies and 27 `verifyAdmin()` callsites depend on — returns true for them. The same policy permits self-unbanning. It took joining the policy capture, the grant capture, the constraint capture and the trigger capture to see it.
- **61 of 101 policies carry no `TO` clause, and there is not one `TO anon` policy in the database.** Anonymous access is granted exclusively as a side effect of a missing role clause, never deliberately. 39 of those are shut by their `auth.uid()`-bearing predicate rather than by their role clause — a widening path, not a present breach — and 8 are not shut at all.
- **The migration history and the running database describe two different security postures.** 41 of 101 live policies are declared by **no** migration; 24 migration-declared policies are **absent** from production. A replay from zero would produce a database missing 41 of production's policies and carrying 24 it does not have. `011_rls_audit.sql` certifies `rsvps` and `user_interactions` as correct — from comments, about policies production does not run.
- **The AUDIT-06 grid is complete, deterministic, and distinguishes `deny` from `none`.** 152 rows, 4 role columns, 331 `allow` / 277 `deny` / 0 `none`, `storage.objects` included, byte-identical across runs.

## Task Commits

1. **Task 1: Capture live policies, enablement, and policy-column indexes** — `0a4d788` (feat)
2. **Task 2: Review the four flag classes against the live capture** — `47da840` (feat)
3. **Task 3: Pivot the capture into the coverage heatmap** — `7a6b866` (feat)

**Plan metadata:** the final `docs(01-09)` commit carrying this summary, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## Files Created/Modified

| File | What it is |
|---|---|
| `rls/pg_policies.json` | 101 policies, `public` + `storage`, sorted by schema/table/command/name. Each row self-describing: `roles` parsed to an array, `has_to_clause`, `commands` (ALL expanded to the four DML), `qual_is_unconditional_true`, `with_check_is_unconditional_true`, `applies_to_anon`, `applies_to_authenticated`, plus `captured_at`, `transport`, `source` and `source_query` |
| `rls/rls-enabled.json` | 38 relations (30 `public`, 8 `storage`). `rls_enabled`, `rls_forced`, `policy_count`, `policy_count_by_cmd`, `policy_names`, `grants_dml` per grantee, `anon_has_any_grant`, `approx_rows`, and a `flag` field for the two silent extremes |
| `rls/policy-column-indexes.json` | 80 columns. `indexed`, `index_names`, `leading_column_of`, `referenced_by_policies`, `referenced_by_policies_cross_table`, `consequence`, and a `detection` field naming the heuristic and its limits. `indexed: null` for `storage`, where the index census does not exist |
| `rls/rls-flags.json` | `provenance` (including all five executed SQL statements), `totals`, `counts_by_flag_class`, `flag_class_definitions`, and 94 flags each with table, policy, command, roles, verbatim evidence, `anon_reachable`, `severity_proposed` and `rationale` |
| `rls/rls-review.md` | The AUDIT-05 narrative. §0 the three structural facts and the static-review caveat, §1–§4 the four required flag classes, §5 unindexed policy columns, §6 the two-way migration reconciliation, §7 the 21 proposed findings, §8 the handoff |
| `tools/pivot-rls-heatmap.mjs` | 252-line zero-dependency ESM pivot. Precondition guard, inline four-line CSV quoter, `ALL`-expansion, `PERMISSIVE`-only grants, row-count invariant enforced with a hard exit. No socket, no `process.env`, no import from `src/` |
| `rls/rls-heatmap.csv` | 152 rows: `table, command, anon, authenticated, public, service_role` |
| `rls/rls-heatmap-notes.csv` | 152 rows: `table, command, rls_enabled, policy_count, allowing_policies` — the policy names behind each `allow`, annotated with the roles they grant |
| `redaction/01-09.md` | Eleven patterns over eight artifacts, all zero, with the positive control recorded; the `set -x` incident recorded rather than omitted; the ten policy-expression literals enumerated in full and classified |

## The policy set, in numbers

| | Count |
|---|---:|
| Live policies (`public` + `storage`) | **101** |
| Relations censused (`public` 30 + `storage` 8) | **38** |
| Relations with row security **disabled** | **0** |
| Relations with `relforcerowsecurity` | **0** |
| Relations with RLS enabled and **zero** policies | **7** (all `storage` internals) |
| Policies with `USING (true)` | **12** |
| Policies with `WITH CHECK (true)` | **9** |
| Policies with no `TO` clause (`roles = {public}`) | **61** |
| …of those, shut by an `auth.uid()`-bearing predicate | 39 |
| …of those, not shut at all | 14 (8 judged in §3b/§3c, 6 `storage.objects` bucket-scoped) |
| Policies `TO authenticated` / `TO service_role` / `TO anon` | 35 / 5 / **0** |
| Policies wrapping `auth.uid()` as `(select auth.uid())` | **1 of 101** |
| Unwrapped `auth.uid()` occurrences, re-evaluated per row | 68 across 59 policies |
| Policy-referenced columns with **no** index | **5** |
| Live policies declared by **no** migration | **41 (41%)** |
| Migration-declared policies **absent** from production | **24** |
| Flags raised | **94** across 6 classes |
| Proposed findings | **21** — 2 Critical, 5 High, 5 Medium, 8 Low, 1 Informational |

### The two Criticals

1. **Self-service privilege escalation on `users`.** `USING (auth.uid() = id)`, no `WITH CHECK`, table-level `UPDATE` grant to `authenticated` covering every column, no `CHECK` on `roles`, no trigger. Set your own `roles` to `admin`; `is_admin()` agrees from that moment. Self-unban works the same way. Reachable by any user who completes McGill sign-in, with no handler in the path — it is a direct PostgREST write, so no Ring-2 control applies.
2. **Unauthenticated write to `admin_audit_log`.** Two INSERT policies, both `WITH CHECK (true)`, both `roles = {public}`, on a table where `anon` holds `INSERT`. Forge an approval attributed to a real admin, or flood the table to bury a real entry. Neither policy is needed: both legitimate writers are service-role callsites that bypass RLS.

### The five Highs

`events` INSERT bypasses moderation · `user_interactions` INSERT lets `anon` forge another user's interaction history through a popularity trigger · any authenticated user may INSERT/UPDATE/**DELETE** any `event_popularity_scores` row (`cmd = ALL`, role check in the predicate) · `rsvps` publishes the attendance graph to `anon` · the migration/production policy divergence, as a single finding.

### Two live functional breaks, found as a by-product

- **Club-invitation acceptance is broken in production.** `20260226000001_invitee_select_update_policy.sql` declares the invitee `SELECT` and `UPDATE` policies; production has neither. `club_invitations` has exactly two live policies, both `is_club_owner(club_id)`, so an invitee can neither see nor accept their invitation. `/api/clubs/[id]/invites` is RLS-reliant, so nothing masks it. **The fix is already in the repository, unapplied.** Recorded as a STATE.md blocker.
- **A/B assignment silently degrades for every non-admin.** `experiments` and `experiment_variants` each have exactly one live policy, an admin-only `ALL`; the five migration-declared read policies are absent. `/api/recommendations` reads all three experiment tables on the cookie client, so non-admin callers get zero rows and fall through to the control path without erroring.

## Decisions Made

1. **AUDIT-05 marked complete despite the transport deviation.** The requirement says "from live `pg_policies` (not from migration files)". The source is `raw/prod/pg-policies.json`, a SELECT-only production capture that records its own executed SQL. What deviated is *which client issued the SELECT*, not whether the database was the source — and the clause the requirement is actually defending (do not read policies from the repository) is satisfied at full strength. Written inline into the traceability row, following the AUDIT-02 precedent from plan 01-08.
2. **Six flag classes, not four.** `WITH CHECK (true)` and `unindexed-policy-column` were added. All three Critical/High write-path findings sit on the write side; a review that reported only `USING (true)` would have found none of them, and would have passed the validator while doing so.
3. **Sidecar over trailing columns for heatmap traceability.** See § Deviations.
4. **All 38 `public` + `storage` relations in the census and the grid.** `cron.job` and `cron.job_run_details` are excluded — AUDIT-11's scope, and neither carries a policy. Recorded in the redaction ledger so the 38-vs-40 relation count is legible rather than read as a dropped table.
5. **`service_role` computed mechanically, with the `BYPASSRLS` caveat in the docblock.** Special-casing it to `allow` would have made the grid uncheckable and hidden the more useful fact — that the policy set does not contemplate it.
6. **Severity by explicit map, completeness by machine.** The detection is mechanical, so the flag list cannot be short; the severity and its exposure rationale are hand-assigned per policy id and carried into the JSON, so the judgement is inspectable rather than buried in prose.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The plan's two trailing heatmap columns cannot coexist with the check the same plan requires to pass**

- **Found during:** Task 3 (pivot design, before writing the generator)
- **Issue:** The plan asks for "two trailing columns per row: a policy-count column and a notes column carrying the names of the policies that produced an allow" **and** for `validate.mjs --check heatmap` to exit 0. The validator asserts that every non-empty cell whose column is not `table`, `table_name` or `command` is one of `allow` / `deny` / `none`. A policy count (`"3"`) or a policy-name list fails that assertion. The two requirements are not jointly satisfiable in one file, and `validate.mjs` is not in this plan's `files_modified` so widening the check was not available.
- **Fix:** `rls-heatmap.csv` carries the grid only and is validator-clean. The traceability is emitted to `rls-heatmap-notes.csv` by the same script, from the same inputs, one row per grid row in the same order, carrying `rls_enabled`, `policy_count` and the allowing policy names annotated with the roles they grant. The reasoning is recorded in the generator's own docblock so the next reader does not "fix" it by merging the files back.
- **Files modified:** `.planning/audit/tools/pivot-rls-heatmap.mjs`, `.planning/audit/rls/rls-heatmap-notes.csv`
- **Verification:** `validate.mjs --check heatmap` exits 0 (both rules pass); the sidecar has 152 rows matching the grid's 152.
- **Committed in:** `7a6b866` (Task 3 commit)

**2. [Rule 2 — Missing Critical] Flag classes extended from four to six**

- **Found during:** Task 1 (first pass over the captured expressions)
- **Issue:** The plan's flag queries cover `qual = 'true'` and `roles = '{public}'`. Production's `USING (true)` set is 12 policies and is mostly a privacy question. The `WITH CHECK (true)` set — which the plan's queries do not reach — is 9 policies and contains the `admin_audit_log` Criticals, the `events` moderation bypass, and the `user_interactions` forgery. An AUDIT-05 review that omitted them would have reported no Critical at all.
- **Fix:** Added `with-check-true` and `unindexed-policy-column` as flag classes in `rls-flags.json`, with `flag_class_definitions` documenting all six. `rls-review.md` § 3 reviews the write-side twins alongside the read side and says why.
- **Files modified:** `.planning/audit/rls/rls-flags.json`, `.planning/audit/rls/rls-review.md`
- **Verification:** 94 flags across 6 classes; `validate.mjs --check rls` still passes all four required flag-class assertions.
- **Committed in:** `0a4d788`, `47da840`

**3. [Rule 3 — Blocking] Transport already replaced upstream; Task 1 artifacts derived from the committed envelopes**

- **Found during:** Task 1
- **Issue:** The plan's Task 1 says to run four captures through `tools/sql-readonly.mjs`. No credential exists in this environment and no MCP tool is available to this agent. Production had, however, already been read SELECT-only by the orchestrator and committed as envelopes under `raw/prod/` (plan 01-06's resolution).
- **Fix:** All four artifacts derived from the committed envelopes, with per-row `source`, `transport`, `captured_at` and `source_query` so each row cites the executed SQL. The **field-by-field transform is documented in `rls-review.md` § Derivation and provenance**, so the artifacts are reproducible from the raw capture without a credential. No generator was added under `tools/` for Task 1, because the plan's `files_modified` lists only `pivot-rls-heatmap.mjs` there.
- **Trade-off, stated rather than glossed:** the Task 1 artifacts have a documented transform but no committed generator, which is weaker than the `gen-*.mjs` precedent set by plans 01-02, 01-03, 01-06 and 01-08. Cheap to close later — the transform is deterministic and fully specified — and noted here so a later pass knows it is an absence, not an oversight.
- **Files modified:** all four Task 1 artifacts
- **Verification:** all four parse; counts agree with the envelopes' own `row_count` fields (101, 38 of 40, 143, 119, 243); `validate.mjs --check rls` exits 0.
- **Committed in:** `0a4d788`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical)
**Impact on plan:** No scope creep. Deviation 1 is forced by a contradiction inside the plan itself and is resolved in the direction that keeps the machine-checked artifact machine-checkable. Deviation 2 is the difference between a review that reports two Criticals and one that reports none. Deviation 3 inherits a resolution made two plans earlier.

## Issues Encountered

- **A `node -e` one-liner silently mis-counted the inline admin `EXISTS` policies as zero**, because the regex `\s` escapes were consumed by the shell before Node saw them. The count was wrong by 12 and the wrong number had already been written into the review. Caught by re-deriving the same figure from a `.mjs` file where no shell quoting intervenes. The review's §4d, §4a, and findings 13, 14 and 19 were corrected from 11 → 12 inline policies, 5 → 6 helper calls, "53 gate on `auth.uid()`" → the accurate 32/7/14 split, and "~50 unwrapped" → 68 occurrences across 59 policies — **before** the Task 2 commit. **Rule for this phase, extending plan 01-08's `zsh` word-splitting finding: any number that reaches an artifact is derived from a file-based script, never from an inline `-e` string containing regex escapes.**
- **`set -x` was enabled for one Task 1 verification block**, which `readonly-guard.sh` explicitly warns against in this phase. The exposure is nil — every traced command was a literal `node -e` string with no variable expansion, and the environment holds no credential — but it is recorded in `redaction/01-09.md` § 1 rather than omitted, because a ledger that drops inconvenient facts is worthless.
- **The `grep` shim rejected `\S` and `\s` in ERE**, as the phase brief warned. All sweeps use `command grep` with POSIX classes, run under `bash -c` with a real array.

## User Setup Required

None — no external service configuration required. This plan issued no SQL, opened no socket, and read no environment variable.

## Next Phase Readiness

**Ready for plan 01-10.** Both requirements are marked with their deviations inline.

Consumers of this plan's output:

- **Plan 01-10 (AUDIT-11 cron, AUDIT-18 storage):** `storage.objects` is in the grid and its `USING (true)` policy is flagged, but the storage verdict — buckets, folder scoping, the `Authenticated users can upload event images` policy that checks `bucket_id` and nothing else — is that plan's. 13 of the 15 `storage.objects` policies are declared by no migration. `cron` was deliberately excluded from the census.
- **Plan 01-11 (AUDIT-03 classification):** the per-table RLS-reliant vs service-role split is the input to `rls_reliance` on all 94 endpoint rows. The tables where a gap is masked by nothing — `club_invitations`, `experiments`, `users` reads — are where `expected_status` will disagree with the code.
- **Plan 01-12 / 01-13 (AUDIT-20 finding register):** § 7's 21 proposed findings are ready to bank against `findings.schema.json`, each with anonymous reachability and compensating-control fields already populated.
- **Stage 3 REFAC-01:** two blocking inputs — do not replay the migrations, and `CREATE INDEX ON public.events (status, start_date) WHERE deleted_at IS NULL`.
- **Stage 4 pgTAP:** `rls-heatmap.csv` transcribes one assertion per cell; `rls-heatmap-notes.csv` says which policy each `allow` should be attributed to.

Open concerns carried forward: the `storage` index census does not exist, so two `storage.objects` policy columns are reported `indexed: null` and no claim is made; and every `allow` in the grid is a statement about which policy is consulted, not about which rows come back — Stage 4 is where that gap closes.

---
*Phase: 01-read-only-foundation-audit*
*Plan: 01-09*
*Completed: 2026-09-14*

## Self-Check: PASSED

Verified after writing this summary, against disk and git rather than against memory:

- All 9 artifacts in `key-files.created` exist on disk (`[ -f ]` on each), plus this summary.
- All 4 commits resolve in `git log --oneline --all`: `0a4d788`, `47da840`, `7a6b866`, `0ab514a`.
- `git diff --name-only 0a4d788~1..HEAD` lists **13 paths, none outside `.planning/`**.
- `node .planning/audit/tools/validate.mjs --check rls` — exit 0, 5 assertions passed.
- `node .planning/audit/tools/validate.mjs --check heatmap` — exit 0, 2 assertions passed.
- `bash .planning/audit/tools/readonly-guard.sh` — exit 0, after every task and again now.
- `git status --porcelain -- supabase/ src/` — empty. `ls supabase/migrations | wc -l` — 44,
  matching `baseline/versions.txt migration_count`.
- Pivot idempotency re-confirmed: two consecutive runs leave `rls-heatmap.csv` and
  `rls-heatmap-notes.csv` byte-identical (`shasum -a 256 -c`).
- Counts re-derived from the files rather than recalled: 101 policies, 38 relations, 80 columns,
  94 flags across the 6 classes, 152 grid rows, 152 sidecar rows, 331 `allow` / 277 `deny` /
  0 `none` summing to 608 = 152 × 4 role columns.
- No artifact under `.planning/audit/rls/` matches a JWT, secret-prefix, or password-bearing
  connection-string pattern (`grep -rlE` returns nothing, exit 1).

**One number written from memory was wrong and was corrected here before this section was
appended:** the proposed-findings severity split is **2 Critical / 5 High / 5 Medium / 8 Low /
1 Informational**, not the "7 Medium, 6 Low" first written. Caught by parsing § 7's table out of
`rls-review.md` rather than counting it by eye. This is the second recalled-number error in this
plan — the first, the inline-admin-`EXISTS` count, is recorded under § Issues Encountered — and
both were caught the same way: re-deriving the figure from a file-based script. Recorded rather
than silently fixed, because a summary that quietly corrects itself gives no signal about which
of its other numbers were derived and which were recalled.

---
*Phase: 01-read-only-foundation-audit*
*Plan: 01-09*
