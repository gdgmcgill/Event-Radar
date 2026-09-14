---
phase: 01-read-only-foundation-audit
plan: 01
subsystem: testing
tags: [audit, json-schema, bash, node-esm, validator, read-only-guard, security-policy]

# Dependency graph
requires: []
provides:
  - "readonly-guard.sh — baseline-diffed read-only guard; the phase's exit criterion, run after every task in every plan of this phase"
  - "validate.mjs — zero-dependency ESM validator registering all 21 named checks, with --check/--quick/--selftest/--list"
  - "baseline/versions.txt — re-derived route/page/migration counts and toolchain versions; the only count source any validator may read"
  - "baseline/git-status.before.txt + lock.sha256 — the guard's referents"
  - "endpoints.schema.json, pages.schema.json, findings.schema.json — the three machine contracts for the keystone artifacts"
  - "SEVERITY_SLA.md — AUDIT-21 severity policy, written before the first finding is filed"
  - "BLOCKING-INPUTS.md — every human-supplied input by env var NAME only, with the AUDIT requirement each one blocks"
  - "REDACTION.md + redaction/ — the ledger index and per-plan append target"
  - "README.md — the artifact index, seeded with every planned artifact and its regenerating command"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 01-13, CERT-06, CERT-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-dependency validation harness under .planning/audit/tools/ — a Jest test would have to live in src/, which fails the phase's own exit criterion"
    - "Thresholds-as-data: expected counts parsed from baseline/versions.txt, never a numeric literal in the validator"
    - "Baseline-diffed read-only guard rather than an emptiness assertion"
    - "One-assertion-per-rule reporting: PASS|FAIL|SKIP <check> :: <rule> :: <detail>"
    - "Hand-rolled draft-2020-12 JSON Schema subset checker (type/required/properties/items/enum/pattern/additionalProperties)"
    - "Credential names only in committed planning artifacts; values live in the operator's terminal"

key-files:
  created:
    - .planning/audit/tools/readonly-guard.sh
    - .planning/audit/tools/validate.mjs
    - .planning/audit/baseline/git-status.before.txt
    - .planning/audit/baseline/lock.sha256
    - .planning/audit/baseline/versions.txt
    - .planning/audit/inventory/endpoints.schema.json
    - .planning/audit/inventory/pages.schema.json
    - .planning/audit/findings.schema.json
    - .planning/audit/BLOCKING-INPUTS.md
    - .planning/audit/REDACTION.md
    - .planning/audit/SEVERITY_SLA.md
    - .planning/audit/README.md
    - .planning/audit/redaction/.gitkeep
  modified: []

key-decisions:
  - "Expected counts are re-derived from the working tree into baseline/versions.txt and read from there; no numeric literal for the route/page/migration counts exists in validate.mjs. Upstream docs say 92 routes and 45 migrations; the tree has 94 and 44, so a validator that trusted them would fail on a correct inventory."
  - "The read-only guard diffs against a captured baseline instead of asserting git status is empty, because docs/product-master-plan.md is already untracked and an emptiness assertion cries wolf on a clean checkout."
  - "An absent input artifact is a FAIL under --check and a SKIP under --quick — never a silent pass. This is what makes the per-task gate meaningful before the evidence exists."
  - "Schemas are hand-written draft-2020-12 subsets checked by ~90 lines inside validate.mjs; installing ajv would mutate package.json and fail the phase's exit criterion."
  - "Severity is exposure-adjusted with a written rationale; CVSS vectors are not assigned to application-logic findings, and a Critical may not be risk-accepted at all."
  - "Deadlines in SEVERITY_SLA.md are phase-relative, not calendar dates, so they do not drift out of meaning when a phase slips."
  - "signals.additionalProperties is true while the endpoint row root is false — a later generator may add a signal without a schema change, but a typo in a human-classification field is caught."

patterns-established:
  - "Read-only guard after every external command: bash .planning/audit/tools/readonly-guard.sh"
  - "Per-task gate: guard + node validate.mjs --check <the-check-this-task-owns>"
  - "Per-wave gate: guard + full node validate.mjs"
  - "Evidence is referenced by path under .planning/audit/, never inlined — an inline cookie or connection string is how this audit would leak what it exists to protect"
  - "Generators merge by id and never overwrite human classification fields"

requirements-completed: [AUDIT-13, AUDIT-20, AUDIT-21]

# Metrics
duration: 13 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 01: Audit Harness Foundation Summary

**A baseline-diffed bash read-only guard plus a 979-line zero-dependency ESM validator registering all 21 named checks against three hand-written JSON Schemas, with counts re-derived into `baseline/versions.txt` rather than trusted from planning docs.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-14T06:59:36Z
- **Completed:** 2026-09-14T07:12:30Z
- **Tasks:** 3
- **Files created:** 13 (all under `.planning/audit/`; zero files outside `.planning/` touched)

## Accomplishments

- **The phase's exit criterion now exists and passes.** `readonly-guard.sh` captured a non-empty baseline (`?? docs/product-master-plan.md`) and runs three checks: status-diff against that baseline, `shasum -c` on `package-lock.json` + `package.json`, and `git diff --exit-code` over everything outside `.planning/`. It uses `set -u`, deliberately not `set -e` (an early abort would suppress the diagnostic that makes a violation actionable) and never `set -x` (it would echo any password in the environment of a later credentialed task).
- **Counts were re-derived, and two upstream documents are demonstrably wrong.** `find src/app -name route.ts` gives **94** where REQUIREMENTS.md and the orchestrator brief say 92; `ls supabase/migrations` gives **44** where PROJECT.md says 45; `src/middleware.ts:114` `PROTECTED_ROUTES` has **8** entries where CLAUDE.md documents 6. All three are recorded as a trailing comment block in `versions.txt` for plan 01-13 to file as Low-severity stale-documentation findings.
- **All 21 checks are registered and self-test green**, each mapped to its AUDIT requirement and declaring its input artifacts. `--selftest` verifies the registry matches the canonical name list exactly, that the three schemas parse, and that the hand-rolled checker accepts a valid endpoint fixture and raises four distinct errors on a deliberately broken one.
- **The keystone schema encodes the CERT-06 contract**: 13 persona keys in `expected_status` with `additionalProperties: false`, so a missing persona is a schema error rather than an implicit placeholder — which is precisely the clause CERT-06 needs ("fails on any unclassified endpoint").
- **The severity policy was written before the first finding**, so severity cannot be argued down after the fact. Four exposure-adjusted levels with phase-relative deadlines, an explicit refusal to assign CVSS to application-logic findings, and a 90-day exception register whose expiry is mechanically enforced by `--check findings`.
- **The credential request exists before any credentialed task runs**, naming only variable names and recording which AUDIT requirement each missing input blocks — and stating at the top that no value is ever pasted under `.planning/`.

## Task Commits

1. **Task 1: Capture the read-only baseline and the guard that enforces it** — `8d329c3` (feat)
2. **Task 2: Zero-dependency artifact validator and the three JSON Schemas** — `028a3cc` (feat)
3. **Task 3: Blocking-input request, redaction ledger, severity SLA, and audit index** — `f02daee` (docs)

## Files Created

| File | What it does |
|---|---|
| `.planning/audit/tools/readonly-guard.sh` | The phase exit gate. Captures on first run, then three checks; exit-code contract only, no functions. 53 lines. |
| `.planning/audit/tools/validate.mjs` | 21-check artifact + schema + cross-reference validator. ESM, `node:fs` + `node:path` only. 979 lines. |
| `.planning/audit/baseline/git-status.before.txt` | The non-empty baseline the guard diffs against. |
| `.planning/audit/baseline/lock.sha256` | `package-lock.json` + `package.json` hashes — the npm-silent-repair hazard. |
| `.planning/audit/baseline/versions.txt` | 16 `key=value` rows: re-derived counts, toolchain versions, CI-vs-local Node split, and the three upstream discrepancies. |
| `.planning/audit/inventory/endpoints.schema.json` | AUDIT-03 row shape: 19 required signals, 10 human-classification fields, 13 persona keys. |
| `.planning/audit/inventory/pages.schema.json` | AUDIT-04 row shape including `layout_guard` for the second auth ring the middleware list misses. |
| `.planning/audit/findings.schema.json` | AUDIT-20 record: `^F-\d{3}$` ids, 11-value category enum, `risk_acceptance` shape. |
| `.planning/audit/SEVERITY_SLA.md` | AUDIT-21 policy. Passes `--check sla` with 14 rules green. |
| `.planning/audit/BLOCKING-INPUTS.md` | Four input groups, each naming the blocked AUDIT requirements and the consuming wave. |
| `.planning/audit/REDACTION.md` | Ledger index, standard placeholders, six phase-gate sweep patterns, self-reference caveat. |
| `.planning/audit/README.md` | Artifact index: path, requirement, producing plan, regenerating command, pending status. |
| `.planning/audit/redaction/.gitkeep` | The per-plan append target for credentialed plans. |

## Contracts later plans must honour

These were invented here because the validator needs something concrete to assert against. They are recorded in `README.md` so the producing plan does not have to re-derive them:

- **`cache/cache-matrix.csv`** must carry columns `route`, `personalized`, `verdict`, `positive_control`, `observed_cache_states`. `--check cache` requires a non-`not-probed` verdict for every `personalized: true` endpoint and at least one `positive_control` row whose `observed_cache_states` contains `HIT`.
- **`quality/error-observability.md`** must state five keys as integers: `routes_without_try_catch`, `routes_leaking_internal_error_text`, `catch_any_count`, `console_call_count`, `request_correlation_callsite_count`.
- **`baseline/test-runner-decision.md`** carries both the Jest-vs-Vitest mock-call evidence and one bullet per skipped Jest suite; `--check baseline` counts the bullets against the skip count in `jest.txt`.
- **`async/cron-webhook-inventory.md`** must contain the word `verdict` at least once per named source (six sources).
- **`signals.env_gated_auth`** is an optional boolean on the endpoint row; `--check authz-registers` uses it to find the AUDIT-10 fail-open callsites. Plan 01-02's generator should emit it.
- **`service-role-register.json`** rows need all four justification keys: `rls_bypass_required`, `caller_authenticated_first`, `user_input_used_as_filter`, `reachable_from_client_bundle`. Expected row count is the number of endpoints with `signals.uses_service_client` true plus 2 non-route callsites.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **no numeric literal for the route, page, or migration counts appears in `validate.mjs`** — verified by `grep -cE '\b(94|43|44)\b' .planning/audit/tools/validate.mjs` returning 0. Every such count is parsed from `baseline/versions.txt`, which is itself re-derived by running the command. This is the direct mitigation for the failure mode where the validator asserts the planning document's 92 and fails on a correct 94-row inventory.

## Deviations from Plan

### 1. [Rule 2 — Missing Critical] `requirements mark-complete` restricted to AUDIT-21

- **Found during:** Task 3 / state update
- **Issue:** The plan frontmatter declares `requirements: [AUDIT-13, AUDIT-20, AUDIT-21]`, but this plan only *stands up the enforcement* for AUDIT-13 and AUDIT-20 — it does not deliver them. Plan 01-04 produces the AUDIT-13 baseline captures (`jest.txt`, `tsc.txt`, `lint.txt`, `build.txt`, `test-runner-decision.md`) and plan 01-13 produces the AUDIT-20 finding register (`findings.json`, `FOUNDATION_AUDIT.md`), and both declare the same requirement ids. Marking all three complete now would let ROADMAP.md and REQUIREMENTS.md claim delivery of artifacts that do not exist, and `validate.mjs --check baseline` and `--check findings` both FAIL today, which is the correct state.
- **Fix:** `requirements-completed` in the frontmatter copies the plan array verbatim as the template mandates, but only `AUDIT-21` was passed to `requirements mark-complete`. AUDIT-13 and AUDIT-20 stay Pending until 01-04 and 01-13 close them.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `node .planning/audit/tools/validate.mjs --check baseline` and `--check findings` both exit 1 with `inputs-present :: absent: ...`, confirming the requirements are genuinely open.
- **Committed in:** `f02daee` follow-up metadata commit

---

**Total deviations:** 1 auto-fixed (1 missing-critical / false-completion guard)
**Impact on plan:** No scope change. Prevents a false "complete" signal on two requirements that three plans share.

## Issues Encountered

- **`grep` in the execution shell is a ugrep shim that honours `.gitignore`.** The first acceptance-criteria run reported a spurious FAIL (`ugrep: error at position 8`) because ugrep rejected `^?? docs/product-master-plan.md` as a pattern. Re-verified with `grep -Fxq` and with `command grep`, both of which confirm the line is present. All count-derivation commands were then cross-checked against system `grep` — `createServiceClient` file count (25) and `auth.getSession` callsite count (1) are identical under both, so `versions.txt` is unaffected. Later plans running greps over `src/` should be aware that the shell `grep` is not GNU grep.
- **Docker daemon is not reachable** (`docker info` returns nothing). Recorded as `docker_daemon_reachable=false` in `versions.txt` and as a gated input in `BLOCKING-INPUTS.md` section 3 — it blocks only the AUDIT-01 dumps and the AUDIT-02 `db diff`, not the Management-API SQL work.

## Read-Only Compliance

| Gate | Result |
|---|---|
| `bash .planning/audit/tools/readonly-guard.sh` | exit 0 |
| `git status --porcelain -- . ':(exclude).planning'` vs baseline | byte-identical |
| `git diff --name-only 8d329c3^..HEAD` outside `.planning/audit/` | 0 files |
| Deletions in this run's commits | 0 |
| `shasum -a 256 -c baseline/lock.sha256` | exit 0 — lockfile and manifest untouched |
| Secret sweep over `.planning/audit/` (JWT / `sb_secret_` / connection-string shapes) | no hits |

No `npm install`, `npx`, or `supabase` command was run by this plan. The two pre-existing untracked paths (`docs/product-master-plan.md`, `.planning/research/.cache/`) were left exactly as found and were not staged.

## User Setup Required

None — no external service configuration is required by this plan. The credential request for *later* plans is at `.planning/audit/BLOCKING-INPUTS.md`; nothing in it is needed before plan 01-06 (Wave 2A).

## Self-Check: PASSED

All 13 created files verified present on disk. All three task commits verified in `git log`. All 26 acceptance criteria across the three tasks re-run and green. Plan-level `<verification>` re-run: guard exit 0, `--selftest` exit 0, `--quick` exit 0, `--check sla` exit 0, live `git status` byte-identical to the baseline.

## Next Phase Readiness

Wave 2 is unblocked. Plan 01-02 can call `node .planning/audit/tools/validate.mjs --check endpoints-signals` the moment its generator emits a file, and `--check endpoints` has a schema and a count to assert against. Plans 01-02 through 01-05 and 01-07 have **zero blocking inputs** and run regardless of credential availability.

The credential gate before Wave 2A (plans 01-06, 01-08, 01-09, 01-10) and before Wave 2B (plan 01-12) now has a written request to present: `.planning/audit/BLOCKING-INPUTS.md`.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
