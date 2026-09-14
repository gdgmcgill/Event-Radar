# Foundation Audit — Artifact Index

**Phase:** 01-read-only-foundation-audit (Stage 1)
**Index created:** 2026-09-14 by plan 01-01. **Finalized by plan 01-13** — rows marked `pending` below are produced by later plans in this phase.

This directory is the phase's entire output. Nothing outside `.planning/` is created or modified by any plan in this phase; that invariant is the phase's exit criterion and is enforced mechanically, not by discipline.

---

## Run this first

```bash
bash .planning/audit/tools/readonly-guard.sh                 # exit 0 = nothing outside .planning/ changed
node .planning/audit/tools/validate.mjs --quick              # runs the checks whose inputs exist
node .planning/audit/tools/validate.mjs                      # full sweep; every check must pass at the gate
node .planning/audit/tools/validate.mjs --list               # check name, requirement, inputs
```

The guard runs after **every** task in every plan of this phase, including pure-analysis ones — the read-only invariant is the one thing a single careless edit destroys irrecoverably. `validate.mjs` has zero dependencies and imports nothing from `src/`; a Jest test would have to live in `src/`, which would itself fail the exit criterion.

**Counts are never taken from a planning document.** `baseline/versions.txt` re-derives the route, page and migration counts from the working tree, and `validate.mjs` asserts against that file. REQUIREMENTS.md, PROJECT.md and the orchestrator brief disagree with the tree; see the discrepancy block at the end of `versions.txt`.

---

## Harness — plan 01-01

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `tools/readonly-guard.sh` | Phase exit gate (AUDIT-13 adjacent) | 01-01 | `bash .planning/audit/tools/readonly-guard.sh` | present |
| `tools/validate.mjs` | AUDIT-20, AUDIT-21 enforcement | 01-01 | `node .planning/audit/tools/validate.mjs --selftest` | present |
| `baseline/git-status.before.txt` | AUDIT-13 | 01-01 | delete, then `bash .planning/audit/tools/readonly-guard.sh` | present |
| `baseline/lock.sha256` | AUDIT-13 | 01-01 | `shasum -a 256 package-lock.json package.json` | present |
| `baseline/versions.txt` | AUDIT-13 | 01-01 | see the inline commands in the file | present |
| `inventory/endpoints.schema.json` | AUDIT-03 | 01-01 | hand-authored | present |
| `inventory/pages.schema.json` | AUDIT-04 | 01-01 | hand-authored | present |
| `findings.schema.json` | AUDIT-20 | 01-01 | hand-authored | present |
| `SEVERITY_SLA.md` | AUDIT-21 | 01-01 | hand-authored; `validate.mjs --check sla` | present |
| `BLOCKING-INPUTS.md` | gates AUDIT-01/02/05/06/08/11/18/19 | 01-01 | hand-authored | present |
| `REDACTION.md` | AUDIT-01 safety (Pitfall 4) | 01-01, 01-13 | concatenated from `redaction/*.md` at the gate | present (ledger pending) |
| `README.md` | index | 01-01, 01-13 | hand-authored | present (rows pending) |

## Inventories — plans 01-02, 01-03, 01-11

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `inventory/endpoints.json` | AUDIT-03 | 01-02 signals, 01-11 classification | `node .planning/audit/tools/gen-endpoint-inventory.mjs` | pending |
| `inventory/endpoints.csv` | AUDIT-03 | 01-02 | derived from the JSON; never hand-edited | pending |
| `inventory/pages.json` | AUDIT-04 | 01-03 signals, 01-11 classification | `node .planning/audit/tools/gen-page-inventory.mjs` | pending |
| `inventory/special-files.json` | AUDIT-04 | 01-03 | `node .planning/audit/tools/gen-page-inventory.mjs` | pending |
| `inventory/build-routes.txt` | AUDIT-04 | 01-03 | `npm run build` route table, captured | pending |
| `security/client-bundle-sweep.md` | AUDIT-16 | 01-03 | sweep over `.next/static` and `public/` | pending |

The generators **merge by `id`** and never overwrite human classification fields. A regeneration that replaces the file silently discards a day of work.

## Baseline and quality — plans 01-04, 01-05, 01-07

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `baseline/jest.txt` | AUDIT-13 | 01-04 | `npx jest --ci` output, captured | pending |
| `baseline/tsc.txt` | AUDIT-13 | 01-04 | `npx tsc --noEmit` output, captured | pending |
| `baseline/lint.txt` | AUDIT-13 | 01-04 | `npm run lint` output, captured | pending |
| `baseline/build.txt` | AUDIT-13 | 01-04 | `npm run build` output, captured | pending |
| `baseline/test-runner-decision.md` | AUDIT-13 | 01-04 | hand-authored from the mock-call evidence | pending |
| `quality/npm-audit.prod.json` | AUDIT-12 | 01-05 | `npm audit --omit=dev --json --package-lock-only` | pending |
| `quality/npm-audit.all.json` | AUDIT-12 | 01-05 | `npm audit --json --package-lock-only` | pending |
| `quality/npm-outdated.json` | AUDIT-12 | 01-05 | `npm outdated --json` (no lock-only flag exists) | pending |
| `quality/dependency-report.md` | AUDIT-12 | 01-05 | hand-authored from the raw captures | pending |
| `quality/knip.out.json` | AUDIT-15 | 01-05 | pinned `npx knip -c .planning/audit/quality/knip.config.json` | pending |
| `quality/depcruise.out.json` | AUDIT-15 | 01-05 | pinned `npx depcruise -c .planning/audit/quality/depcruise.config.cjs` | pending |
| `quality/dead-code.md` | AUDIT-15 | 01-05 | hand-authored from the tool output | pending |
| `quality/error-observability.md` | AUDIT-14 | 01-07 | grep census over `src/app/api/` | pending |

Every npm invocation is followed by the read-only guard: npm reifies lockfile metadata on *read* commands when `node_modules` disagrees with the lockfile, and that is a working-tree change outside `.planning/`.

## Authorization registers — plan 01-07

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `authz/service-role-register.json` | AUDIT-07 | 01-07 | derived from `inventory/endpoints.json` signals | pending |
| `authz/service-role-register.md` | AUDIT-07 | 01-07 | derived view of the JSON | pending |
| `authz/getsession-register.md` | AUDIT-09 | 01-07 | derived from `signals.calls_get_session` | pending |
| `authz/fail-open-register.md` | AUDIT-10 | 01-07 | derived from `signals.env_gated_auth` | pending |

## Live database — plans 01-06, 01-08, 01-09, 01-10 (credentialed)

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `schema/prod.schema.sql` | AUDIT-01 | 01-06 | `supabase db dump --schema public,storage,extensions` | pending |
| `schema/staging.schema.sql` | AUDIT-01 | 01-06 | same, staging ref | pending |
| `schema/local.schema.sql` | AUDIT-01 | 01-06 | same, local | pending |
| `schema/information-schema-columns.json` | AUDIT-19 | 01-06 | read-only SQL over `information_schema.columns` | pending |
| `schema/events-date-columns.md` | AUDIT-19 | 01-06 | hand-authored, citing the column census | pending |
| `schema/migration-list.{prod,staging,local}.txt` | AUDIT-02 | 01-08 | `supabase migration list` | pending |
| `schema/db-diff.{prod,staging}.sql` | AUDIT-02 | 01-08 | `supabase db diff --linked --schema public > <file>` — **never `-f`** | pending |
| `schema/drift.json` / `drift.md` | AUDIT-02 | 01-08 | three-source reconciliation generator | pending |
| `rls/pg_policies.json` | AUDIT-05 | 01-09 | read-only SQL over `pg_policies` | pending |
| `rls/rls-enabled.json` | AUDIT-05 | 01-09 | read-only SQL over `pg_class`/`pg_tables` | pending |
| `rls/policy-column-indexes.json` | AUDIT-05 | 01-09 | read-only SQL | pending |
| `rls/rls-review.md` | AUDIT-05 | 01-09 | hand-authored across the four flag classes | pending |
| `rls/rls-heatmap.csv` | AUDIT-06 | 01-09 | `node .planning/audit/tools/pivot-rls-heatmap.mjs` | pending |
| `storage/buckets.json` | AUDIT-18 | 01-10 | read-only SQL over `storage.buckets` | pending |
| `storage/storage-policies.json` | AUDIT-18 | 01-10 | read-only SQL over storage policies | pending |
| `storage/storage-review.md` | AUDIT-18 | 01-10 | hand-authored per bucket | pending |
| `async/cron-job.json` | AUDIT-11 | 01-10 | read-only SQL over `cron.job` | pending |
| `async/cron-webhook-inventory.md` | AUDIT-11 | 01-10 | hand-authored; a verdict per named source | pending |

Credentialed plans read secrets from the environment only. See `BLOCKING-INPUTS.md` for the variable names and `REDACTION.md` for what each plan must scrub before committing.

## Cache exposure — plan 01-12 (credentialed)

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `cache/curl/<slug>.<session>.<n>.headers.txt` | AUDIT-08 | 01-12 | `curl -sSI`, GET only, `set-cookie` redacted on write | pending |
| `cache/curl-summary.json` | AUDIT-08 | 01-12 | probe harness output, incl. the positive control | pending |
| `cache/cache-matrix.csv` / `.json` | AUDIT-08 | 01-12 | derived from the probe and `inventory/endpoints.json` | pending |

`cache-matrix.csv` must carry the columns `route`, `personalized`, `verdict`, `positive_control`, `observed_cache_states` — `validate.mjs --check cache` reads exactly those, requires a non-`not-probed` verdict for every personalized endpoint, and requires at least one positive-control row recording a `HIT`. A run where nothing ever cached licenses no conclusion at all.

## Synthesis — plan 01-13

| Artifact | Requirement | Plan | Regenerate with | Status |
|---|---|---|---|---|
| `security/threat-model-anonymous.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | pending |
| `security/threat-model-tenant.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | pending |
| `security/threat-model-escalation.md` | AUDIT-17 | 01-13 | hand-authored, one page, STRIDE table | pending |
| `findings.json` | AUDIT-20 | 01-13 | hand-authored against `findings.schema.json` | pending |
| `FOUNDATION_AUDIT.md` | AUDIT-20 | 01-13 | **generated from `findings.json`** so the two cannot drift | pending |
| `redaction/*.md` → `REDACTION.md` | AUDIT-01 safety | 01-13 | concatenation plus the phase-gate secret sweep | pending |

---

## Conventions

- **JSON is the artifact; Markdown is a derived view.** A prose table of ninety-odd endpoints cannot be consumed by CERT-06.
- **Finding ids are stable.** `F-nnn` is never renumbered, even when a finding is withdrawn.
- **Evidence is referenced by path, never inlined.** An inline cookie or connection string is how this audit would leak the secrets it exists to protect.
- **Configs stay out of the repo root.** `knip.config.json` and `depcruise.config.cjs` live under `quality/` and are passed with `-c`; writing them to the root would be a repo change.
- **`git status --porcelain` is never asserted to be empty.** `docs/product-master-plan.md` is already untracked; the guard diffs against a captured baseline instead.

---

*Phase: 01-read-only-foundation-audit*
*Index seeded by plan 01-01; finalized by plan 01-13*
