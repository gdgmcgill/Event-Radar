# Foundation Audit — Artifact Index

**Phase:** 01-read-only-foundation-audit (Stage 1)
**Index seeded:** 2026-09-14 by plan 01-01 · **Finalized:** 2026-09-14 by plan 01-13

This directory is the phase's entire output. Nothing outside `.planning/` was created or modified by any plan in this phase; that invariant is the phase's exit criterion and is enforced mechanically, not by discipline.

---

## Reading order

A new reviewer should read these in order, and should be able to answer every question below without opening a source file:

1. **[`FOUNDATION_AUDIT.md`](./FOUNDATION_AUDIT.md)** — the finding register. 70 findings, 4 Critical, 17 High, sorted by severity, each with evidence, reproduction, a recommended fix and a validation criterion. Ends with the deliberately-unapplied-fix list, the blocked-item index with retry commands, and the coverage statement.
2. **[`security/threat-model-anonymous.md`](./security/threat-model-anonymous.md)**, **[`-tenant.md`](./security/threat-model-tenant.md)**, **[`-escalation.md`](./security/threat-model-escalation.md)** — one page per trust boundary, each with a quantified entry-point table, a STRIDE table citing finding ids, and a statement of what held.
3. **[`inventory/endpoints.json`](./inventory/endpoints.json)** and **[`pages.json`](./pages.json)** — the classified surface, 94 handlers and 43 pages, the substrate every other artifact is derived from.
4. **[`SEVERITY_SLA.md`](./SEVERITY_SLA.md)** — the grading policy, written before the first finding existed.

---

## Run this first

```bash
bash .planning/audit/tools/readonly-guard.sh                 # exit 0 = nothing outside .planning/ changed
node .planning/audit/tools/validate.mjs --quick              # runs the checks whose inputs exist
node .planning/audit/tools/validate.mjs                      # full sweep; see § Gate status
node .planning/audit/tools/validate.mjs --list               # check name, requirement, inputs
node .planning/audit/tools/gen-foundation-audit.mjs --check  # fails if FOUNDATION_AUDIT.md is stale
```

The guard runs after **every** task in every plan of this phase, including pure-analysis ones — the read-only invariant is the one thing a single careless edit destroys irrecoverably. `validate.mjs` has zero dependencies and imports nothing from `src/`; a Jest test would have to live in `src/`, which would itself fail the exit criterion.

**Counts are never taken from a planning document.** `baseline/versions.txt` re-derives the route, page and migration counts from the working tree, and `validate.mjs` asserts against that file. REQUIREMENTS.md, PROJECT.md and the orchestrator brief disagree with the tree; see `versions.txt` and finding F-063.

---

## Gate status at phase close

| Gate | Command | Result |
|---|---|---|
| Read-only invariant | `bash tools/readonly-guard.sh` | **PASS** — exit 0 |
| Read-only, independently | `git diff --stat 8d329c3..HEAD -- . ':!.planning'` | **PASS** — empty |
| Redaction self-sweep | see `REDACTION.md` § Phase-gate self-sweep | **CLEAN** — 33 shape matches, 0 payloads |
| Artifact validator | `node tools/validate.mjs` | **RED on 1 of 21 checks** — `schema-snapshots`, blocked; see below |

`schema-snapshots` (AUDIT-01) fails on `schema/staging.schema.sql` and `schema/local.schema.sql`, both BLOCKED stubs. The gate was **not weakened**: AUDIT-01 is withheld in `REQUIREMENTS.md` with the reason intact, and both blocking inputs carry a retry command in `FOUNDATION_AUDIT.md` § Blocked Items. Every other check passes.

---

## Harness — plan 01-01

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `tools/readonly-guard.sh` | phase exit gate (AUDIT-13 adjacent) | 01-01 | `bash .planning/audit/tools/readonly-guard.sh` | present |
| `tools/validate.mjs` | AUDIT-20, AUDIT-21 enforcement | 01-01, 01-07 | `node .planning/audit/tools/validate.mjs --selftest` | present |
| `baseline/git-status.before.txt` | AUDIT-13 | 01-01 | delete, then `bash .planning/audit/tools/readonly-guard.sh` | present |
| `baseline/lock.sha256` | AUDIT-13 | 01-01 | `shasum -a 256 package-lock.json package.json` | present |
| `inventory/endpoints.schema.json` | AUDIT-03 | 01-01 | hand-authored | present |
| `inventory/pages.schema.json` | AUDIT-04 | 01-01 | hand-authored | present |
| `findings.schema.json` | AUDIT-20 | 01-01 | hand-authored | present |
| `SEVERITY_SLA.md` | AUDIT-21 | 01-01 | hand-authored; `validate.mjs --check sla` | present |
| `BLOCKING-INPUTS.md` | gates AUDIT-01/02/05/06/08/11/18/19 | 01-01 | hand-authored | present |
| `REDACTION.md` | AUDIT-01 safety (Pitfall 4) | 01-01, 01-13 | consolidated from `redaction/*.md` plus the gate sweep | present |
| `README.md` | index | 01-01, 01-13 | hand-authored | present |

## Inventories — plans 01-02, 01-03, 01-11

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `inventory/endpoints.json` | AUDIT-03 | 01-02 signals, 01-11 classification | `node .planning/audit/tools/gen-endpoint-inventory.mjs` | present — 94 rows, fully classified |
| `inventory/endpoints.csv` | AUDIT-03 | 01-02 | `node .planning/audit/tools/gen-endpoints-csv.mjs` — derived; never hand-edited | present |
| `inventory/pages.json` | AUDIT-04 | 01-03 signals, 01-11 classification | `node .planning/audit/tools/gen-page-inventory.mjs` | present — 43 rows |
| `inventory/special-files.json` | AUDIT-04 | 01-03 | `node .planning/audit/tools/gen-page-inventory.mjs` | present |
| `inventory/build-routes.txt` | AUDIT-04 | 01-03 | `npm run build` route table, captured | present |
| `inventory/classification-rules.md` | AUDIT-03, AUDIT-04 | 01-11 | hand-authored; § 6 carries the 14-item divergence queue | present |
| `tools/classify-inventory.mjs` | AUDIT-03, AUDIT-04 | 01-11 | `node .planning/audit/tools/classify-inventory.mjs` | present |
| `security/client-bundle-sweep.md` | AUDIT-16 | 01-03 | sweep over `.next/static` and `public/` | **present, INCONCLUSIVE** — the build ran without the real service-role key, so its seven zero counts prove absence from that build, not absence in general. Blocking input: a build with `SUPABASE_SERVICE_ROLE_KEY` populated. Finding F-070. |

The generators **merge by `id`** and never overwrite human classification fields. A regeneration that replaces the file silently discards a day of work.

## Baseline and quality — plans 01-03, 01-04, 01-05, 01-07

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `baseline/build.txt` | AUDIT-13 | **01-03** | `npm run build` output, captured | present — produced by 01-03, not 01-04; `versions.txt`'s `build_exit_code` and `build_route_row_count` depend on it |
| `baseline/jest.txt` | AUDIT-13 | 01-04 | `npx jest --ci --verbose` output, captured | present — 16 of 21 suites, 220 passed, 36 skipped |
| `baseline/jest-listtests.txt` | AUDIT-13 | 01-04 | `npx jest --listTests` output, captured | present — 21 absolute paths; the file-count evidence `test-runner-decision.md` cites |
| `baseline/tsc.txt` | AUDIT-13 | 01-04 | `npx tsc --noEmit` output, captured | present — zero diagnostics, with the exclusions block |
| `baseline/lint.txt` | AUDIT-13 | 01-04 | `npm run lint` output, captured | present — 12 warnings, 0 errors |
| `baseline/versions.txt` | AUDIT-13 | 01-01, 01-03, 01-04 | see the inline commands in the file | present — the only count authority in this phase; trailing comments list the three stale doc counts |
| `baseline/test-runner-decision.md` | AUDIT-13 | 01-04 | hand-authored from the mock-call evidence | present — 14-to-0 Jest-versus-Vitest, per-suite skip reasons, four gaps |
| `baseline/BASELINE-REFRESH.md` | AUDIT-13 | 01-04 | hand-authored | present |
| `quality/npm-audit.prod.json` | AUDIT-12 | 01-05 | `npm audit --omit=dev --json --package-lock-only` | present — 38 advisories over 680 prod deps |
| `quality/npm-audit.all.json` | AUDIT-12 | 01-05 | `npm audit --json --package-lock-only` | present — 42 advisories |
| `quality/npm-outdated.json` | AUDIT-12 | 01-05 | `npm outdated --json` (no lock-only flag exists) | present — 41 packages behind |
| `quality/npm-ls-prod.json` | AUDIT-12 | 01-05 | `npm ls --omit=dev --json` | present |
| `quality/dependency-report.md` | AUDIT-12 | 01-05 | hand-authored from the raw captures | present — reachability judgment on all 24 High/Critical rows |
| `quality/knip.out.json` / `knip.md` / `knip.config.json` | AUDIT-15 | 01-05 | `npx knip@6.35.1 -c .planning/audit/quality/knip.config.json` | present |
| `quality/depcruise.out.json` / `depcruise.config.cjs` | AUDIT-15 | 01-05 | `npx dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs` | present — 308 modules, 703 dependencies, 0 unresolved |
| `quality/depcruise.reaches-apidocs.json` | AUDIT-12 | 01-05 | same cruiser, scoped to the `/docs` closure | present — the five-module reachability closure |
| `quality/dead-code.md` | AUDIT-15 | 01-05 | hand-authored from the tool output | present — § 4 is the 12-row stale-documentation table |
| `quality/error-observability.md` | AUDIT-14 | 01-07 | grep census over `src/app/api/` | present — the five integers with derivations |

Every npm invocation is followed by the read-only guard: npm reifies lockfile metadata on *read* commands when `node_modules` disagrees with the lockfile, and that is a working-tree change outside `.planning/`.

## Authorization registers — plan 01-07

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `authz/service-role-register.json` | AUDIT-07 | 01-07 | derived from `inventory/endpoints.json` signals | present — 25 rows, 10 justified, 14 needs-decision, 1 unjustified |
| `authz/service-role-register.md` | AUDIT-07 | 01-07 | derived view of the JSON | present — carries the 26th-construction coverage caveat (F-067) |
| `authz/getsession-register.md` | AUDIT-09 | 01-07 | derived from `signals.calls_get_session` | present — one callsite, non-gating, with the reason |
| `authz/fail-open-register.md` | AUDIT-10 | 01-07 | derived from `signals.env_gated_auth` | present — FO-01…FO-05 and FP-01, plus the detector-coverage method finding |

## Live database — plans 01-06, 01-08, 01-09, 01-10 (credentialed)

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `raw/prod/*.json` (23 files) + `MANIFEST.json` | AUDIT-01/02/05/11/18/19 substrate | 01-06, 01-11 | SELECT-only Management API captures; each file records its own executed `query` | present — `total_redactions: 0`, independently re-verified |
| `raw/vercel/project.json`, `env-names.json` | AUDIT-11 | 01-10 | Vercel REST API, read-only | present — zero cron definitions; exactly 3 production env vars |
| `schema/prod.schema.sql` | AUDIT-01 | 01-06 | `node .planning/audit/tools/gen-prod-schema.mjs` | present — scoped to public, storage, cron; auth schema never captured |
| `schema/staging.schema.sql` | AUDIT-01 | 01-06 | `supabase db dump --schema public,storage,extensions --project-ref <STAGING-REF>` | **BLOCKED — input not supplied.** Blocking input: a credential for the staging project. Stub in place; `validate.mjs --check schema-snapshots` is red on this row by design. |
| `schema/local.schema.sql` | AUDIT-01 | 01-06 | `supabase db reset && supabase db dump --local --schema public,storage` | **BLOCKED — the repository's own migration history.** `db reset` aborts at the 12th of 44 files (finding F-043). Not an absent input: Docker was available and every file is tracked. |
| `schema/local-reset.txt` | AUDIT-01, AUDIT-02 | 01-06 | `supabase db reset` transcript, captured | present — this is the evidence for F-043 |
| `schema/information-schema-columns.json` | AUDIT-19 | 01-06 | read-only SQL over `information_schema.columns` | present |
| `schema/events-date-columns.md` | AUDIT-19 | 01-06 | hand-authored, citing the column census | present — `start_date`/`end_date` declared authoritative; five stale references named (F-050) |
| `schema/migration-list.prod.txt` | AUDIT-02 | 01-08 | derived from `raw/prod/migrations-applied.json` | present — 45 applied versus 44 files (F-045) |
| `schema/migration-list.local.txt` | AUDIT-02 | 01-08 | derived from the `db reset` transcript | present |
| `schema/migration-list.staging.txt` | AUDIT-02 | 01-08 | `supabase migration list --project-ref <STAGING-REF>` | **BLOCKED — input not supplied.** Stub carrying variable names only. |
| `schema/db-diff.prod.sql`, `db-diff.staging.sql` | AUDIT-02 | 01-08 | `supabase db diff --linked --schema public > <file>` — **never `-f`** | **BLOCKED — input not supplied.** Neither named tool could run; the reason is itself finding F-043. The AUDIT-02 deliverable was produced at higher fidelity by three-source reconciliation instead. |
| `schema/drift.json` / `drift.md` | AUDIT-02 | 01-08 | `node .planning/audit/tools/gen-drift-table.mjs` | present — 288 rows, 76 out of sync |
| `rls/pg_policies.json` | AUDIT-05 | 01-09 | read-only SQL over `pg_policies` (`raw/prod/pg-policies.json`) | present — 101 policies |
| `rls/rls-enabled.json` | AUDIT-05 | 01-09 | read-only SQL over `pg_class`/`pg_tables` | present — 38 relations, 0 with RLS disabled |
| `rls/policy-column-indexes.json` | AUDIT-05 | 01-09 | read-only SQL | present — 80 columns, 5 unindexed |
| `rls/rls-flags.json` | AUDIT-05 | 01-09 | derived from the three captures above | present — 94 flags across 6 classes |
| `rls/rls-review.md` | AUDIT-05 | 01-09 | hand-authored across the six flag classes | present — 21 proposed findings, 2 Critical, 5 High |
| `rls/rls-heatmap.csv` / `rls-heatmap-notes.csv` | AUDIT-06 | 01-09 | `node .planning/audit/tools/pivot-rls-heatmap.mjs` | present — table × command × role grid over all 38 relations |
| `storage/buckets.json` | AUDIT-18 | 01-10 | read-only SQL over `storage.buckets` | present — 4 buckets, 3 undeclared, 2 without a MIME allow-list |
| `storage/storage-policies.json` | AUDIT-18 | 01-10 | read-only SQL over storage policies | present — 15 object policies with derived ownership flags |
| `storage/storage-review.md` | AUDIT-18 | 01-10 | hand-authored per bucket | present — ST-01…ST-07 |
| `async/cron-job.json`, `cron-job-run-details.json` | AUDIT-11 | 01-10 | read-only SQL over `cron.job` and `cron.job_run_details` | present — 3 jobs, 100 runs, zero failures |
| `async/extensions.json` | AUDIT-11 | 01-10 | read-only SQL over `pg_available_extensions` | present — records that `pg_net` is **not** installed |
| `async/vercel-crons.md` | AUDIT-11 | 01-10 | derived from `raw/vercel/project.json` | present — zero platform cron definitions, with provenance |
| `async/cron-webhook-inventory.md` | AUDIT-11 | 01-10 | hand-authored; a verdict per named source | present — 11-row table, CW-01 and CW-02 |
| GoTrue auth hook configuration | AUDIT-11 | 01-10 | Supabase dashboard → Authentication → Hooks | **BLOCKED — dashboard state.** The `pg-functions://` form is ruled out by the function catalog; the HTTP form is not readable through any read-only capture used in this phase. |

Credentialed plans read secrets from the environment only. See `BLOCKING-INPUTS.md` for the variable names and `REDACTION.md` for what each plan scrubbed before committing.

## Cache exposure — plan 01-12 (credentialed)

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `tools/cache-probe.sh` | AUDIT-08 | 01-12 | `bash .planning/audit/tools/cache-probe.sh` (reads `PROD_HOST`, `COOKIE_A`, `COOKIE_B`, `CLUB_ID`, `EVENT_ID` from the environment only) | present |
| `cache/curl/<slug>.<session>.<n>.headers.txt` | AUDIT-08 | 01-12 | the probe; GET only, `set-cookie` redacted on write | present — 45 anonymous captures |
| `cache/curl-summary.json` | AUDIT-08 | 01-12 | probe harness output | present — positive control `hit_observed: true`, `run_verdict: anonymous-half-only` |
| `cache/cache-matrix.csv` / `.json` | AUDIT-08 | 01-12 | `node .planning/audit/tools/gen-cache-matrix.mjs` | present — 121 rows over all 94 handlers |
| two-session cross-account probe | AUDIT-08 | 01-12 | see the retry command in `curl-summary.json` and in `FOUNDATION_AUDIT.md` § Blocked Items | **BLOCKED — input not supplied.** `COOKIE_A` and `COOKIE_B` were never exported; no cookie value entered the machine. **AUDIT-08 is withheld, not complete.** The generator promotes `latent-hazard` to `leak-confirmed` automatically when both are present. |

`cache-matrix.csv` carries the columns `route`, `personalized`, `verdict`, `positive_control`, `observed_cache_states` — `validate.mjs --check cache` reads exactly those, requires a non-`not-probed` verdict for every personalized endpoint, and requires at least one positive-control row recording a `HIT`. A run where nothing ever cached licenses no conclusion at all.

## Synthesis — plan 01-13

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `security/threat-model-anonymous.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | present |
| `security/threat-model-tenant.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | present |
| `security/threat-model-escalation.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | present |
| `findings.json` | AUDIT-20 | 01-13 | hand-authored against `findings.schema.json` | present — 70 records |
| `tools/gen-foundation-audit.mjs` | AUDIT-20 | 01-13 | `node .planning/audit/tools/gen-foundation-audit.mjs` | present |
| `FOUNDATION_AUDIT.md` | AUDIT-20 | 01-13 | **generated** — `node .planning/audit/tools/gen-foundation-audit.mjs` | present — never hand-edited; `--check` fails if stale |
| `redaction/*.md` → `REDACTION.md` | AUDIT-01 safety | 01-13 | consolidated by hand; sweep re-run per `REDACTION.md` § Phase-gate self-sweep | present — `SWEEP_RESULT=CLEAN` |

---

## Requirement coverage

Every one of the twenty-one requirement identifiers maps to at least one artifact above.

| Requirement | Primary artifact | Status |
|---|---|---|
| AUDIT-01 | `schema/prod.schema.sql` | **withheld** — staging and local snapshots blocked |
| AUDIT-02 | `schema/drift.md` | complete (named tools blocked; deliverable produced at higher fidelity) |
| AUDIT-03 | `inventory/endpoints.json` | complete |
| AUDIT-04 | `inventory/pages.json` | complete |
| AUDIT-05 | `rls/rls-review.md` | complete |
| AUDIT-06 | `rls/rls-heatmap.csv` | complete |
| AUDIT-07 | `authz/service-role-register.json` | complete |
| AUDIT-08 | `cache/cache-matrix.csv` | **withheld** — two-session probe blocked |
| AUDIT-09 | `authz/getsession-register.md` | complete |
| AUDIT-10 | `authz/fail-open-register.md` | complete |
| AUDIT-11 | `async/cron-webhook-inventory.md` | complete |
| AUDIT-12 | `quality/dependency-report.md` | complete |
| AUDIT-13 | `baseline/` | complete |
| AUDIT-14 | `quality/error-observability.md` | complete |
| AUDIT-15 | `quality/dead-code.md` | complete |
| AUDIT-16 | `security/client-bundle-sweep.md` | complete, verdict INCONCLUSIVE by design |
| AUDIT-17 | `security/threat-model-*.md` | complete |
| AUDIT-18 | `storage/storage-review.md` | complete |
| AUDIT-19 | `schema/events-date-columns.md` | complete |
| AUDIT-20 | `findings.json` + `FOUNDATION_AUDIT.md` | complete |
| AUDIT-21 | `SEVERITY_SLA.md` | complete |

---

## Conventions

- **JSON is the artifact; Markdown is a derived view.** A prose table of ninety-odd endpoints cannot be consumed by CERT-06.
- **Finding ids are stable.** `F-nnn` is never renumbered, even when a finding is withdrawn.
- **Evidence is referenced by path, never inlined.** An inline cookie or connection string is how this audit would leak the secrets it exists to protect.
- **Configs stay out of the repo root.** `knip.config.json` and `depcruise.config.cjs` live under `quality/` and are passed with `-c`; writing them to the root would be a repo change.
- **`git status --porcelain` is never asserted to be empty.** `docs/product-master-plan.md` is already untracked; the guard diffs against a captured baseline instead.
- **`grep` in this shell is a ugrep shim** that honours `.gitignore` and rejects some BRE patterns. Every count in this directory was taken with `command grep`, `git grep`, or Node.
- **A blocked artifact is marked, never omitted.** Each carries the blocking input by name and a retry command, so a reader can tell a gap from an oversight.

---

*Phase: 01-read-only-foundation-audit*
*Index seeded by plan 01-01; finalized by plan 01-13*
