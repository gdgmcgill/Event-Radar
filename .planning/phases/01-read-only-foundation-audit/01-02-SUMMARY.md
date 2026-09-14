---
phase: 01-read-only-foundation-audit
plan: 02
subsystem: api
tags: [audit, endpoint-inventory, node-esm, json-schema, csv, grep-signals, authz, cache-control, zero-dependency]

# Dependency graph
requires:
  - phase: 01-01
    provides: "endpoints.schema.json (the row contract), validate.mjs --check endpoints-signals (the gate), baseline/versions.txt route_ts_count=94 (the denominator), readonly-guard.sh (the exit criterion)"
provides:
  - "inventory/endpoints.json — 94 schema-valid rows, the phase keystone artifact; every route handler with methods, dynamic segments, 20 machine-derived signals, and placeholder human-classification fields"
  - "gen-endpoint-inventory.mjs — zero-dependency ESM generator with merge-by-id semantics; a re-run never discards hand classification"
  - "gen-endpoints-csv.mjs — derived-view emitter with an inline RFC-4180 quote/escape and no src/ import"
  - "inventory/endpoints.csv — 95-line sortable review view carrying the derived no_auth_signal column"
  - "signals.env_gated_auth — the AUDIT-10 fail-open boolean the 01-01 contract asked this plan to emit; 2 endpoints flagged"
  - "The 13-route no-authorization-signal review queue, machine-identified"
affects: [01-07, 01-11, 01-12, 01-13, CERT-05, CERT-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Merge-by-id generators: read the artifact back, index by id, overwrite only machine-derived keys, leave human fields verbatim"
    - "Idempotence as the proof of merge semantics — shasum before and after a second run must match"
    - "JSON is the artifact, CSV is a derived view generated from it and never hand-edited"
    - "Placeholder sentinel is the literal string 'unknown' on every human field AND on all 13 expected_status persona keys, so a row is schema-valid before classification but still fails --check endpoints"
    - "Audit tools reimplement trivial app-layer helpers inline rather than importing from src/"

key-files:
  created:
    - .planning/audit/tools/gen-endpoint-inventory.mjs
    - .planning/audit/tools/gen-endpoints-csv.mjs
    - .planning/audit/inventory/endpoints.json
    - .planning/audit/inventory/endpoints.csv
  modified: []

key-decisions:
  - "expected_status is seeded with all 13 CERT-05 persona keys set to 'unknown', not as the empty object the plan and RESEARCH prototype specified. endpoints.schema.json declares the 13 keys required with additionalProperties false, and validate.mjs treats a missing key as a schema error and never as an implicit placeholder — an empty object would have failed the plan's own --check endpoints-signals acceptance criterion on all 94 rows."
  - "signals.env_gated_auth is emitted even though the plan's signal list omits it. Plan 01-01 recorded it as a contract this plan's generator owes --check authz-registers, and plan 01-07's fail-open register (AUDIT-10) has no other data source."
  - "Rows are constructed in explicit key order (identity, signals, then human fields) rather than by spreading the prior row first. Both merge correctly; explicit ordering also makes the output diff-stable and matches the canonical row shape in RESEARCH Pattern 1."
  - "The CSV omits dynamic_segments and env_gated_auth. The plan fixes the column list and requires no_auth_signal to be the last field so `awk -F, '$NF==\"true\"'` works; adding columns would have broken that contract."
  - "README.md status rows for endpoints.json/csv were left as 'pending'. README finalization belongs to plan 01-13, and README.md is not in this plan's files_modified — the read-only phase constraint is scoped per plan, not per phase."

patterns-established:
  - "Generator merge test: mutate a human field, regenerate, assert it survived, restore — proves T-01-02-03 is mitigated rather than asserted"
  - "Aggregate counts measured by RESEARCH against the working tree are re-asserted as acceptance criteria, so a regex transcription error fails loudly instead of producing a plausible-looking inventory"

requirements-completed: [AUDIT-03]

# Metrics
duration: 20 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 02: Endpoint Inventory Slice Summary

**A zero-dependency ESM generator that greps 94 `route.ts` handlers into a merge-by-id `endpoints.json` carrying 20 machine-derived signals per row, plus the derived 95-line CSV whose `no_auth_signal` column isolates the 13 handlers with no authorization check of any kind.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-14T06:59:00Z
- **Completed:** 2026-09-14T07:19:20Z
- **Tasks:** 2
- **Files created:** 4 (all under `.planning/audit/`; zero files outside `.planning/` touched)

## Accomplishments

- **The phase keystone exists and validates.** `inventory/endpoints.json` holds 94 rows, one per `src/app/**/route.ts`, and `node .planning/audit/tools/validate.mjs --check endpoints-signals` is green on all three rules: row count matches `baseline/versions.txt` `route_ts_count`, every row is schema-valid against `endpoints.schema.json`, and every row carries `signals`.
- **Every aggregate RESEARCH measured against this tree was reproduced exactly** — not approximately. 94 rows; 22 `uses_service_client`; 22 files with no `try {` anywhere; 4 setting their own `Cache-Control`; 13 with no auth signal at all; 32 distinct tables referenced. The method census also matches to the unit (GET 60, POST 34, PATCH 13, DELETE 12, PUT 2), as does the env-var set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`). Six independent aggregates agreeing is what makes the regex transcription trustworthy.
- **Merge-by-id is demonstrated, not asserted.** Beyond the required byte-identical second run, a destructive test was run: `endpoints[0]` was hand-classified (`auth_requirement: "admin"`, `role_required: "admin"`, `expected_status.anonymous: 401`, `findings: ["F-001"]`), the generator was re-run, and all four values survived while `signals` was regenerated. The file was then restored to the identical SHA-256. This is the direct mitigation for threat T-01-02-03.
- **The AUDIT-10 fail-open register has its data source.** `signals.env_gated_auth` flags `/api/admin/calculate-popularity` and `/api/admin/events` — handlers where an authorization branch is conditional on an env var being present, the shape that silently disables auth when the variable is unset. Both run on a service-role client.
- **The 13-route hand-review queue is machine-identified and sortable.** `endpoints.csv` ends every row with `no_auth_signal`, so `awk -F, 'NR>1 && $NF=="true"'` returns exactly the 13 handlers that call none of `auth.getUser()`, `verifyAdmin()`, or `auth.getSession()`. Plan 01-11 starts there.
- **No app-layer coupling.** The CSV emitter reimplements quote-and-escape in five lines rather than importing the repo's existing CSV writer from `src/lib/`, keeping the `.planning/` toolchain importable with zero repo surface.

## Task Commits

1. **Task 1: Generate the 94-row endpoint inventory with merge-by-id semantics** — `a0969e4` (feat)
2. **Task 2: Derive the CSV review view and surface the no-auth-signal queue** — `5b0eeb3` (feat)

## Files Created

| File | What it does | Lines |
|---|---|---|
| `.planning/audit/tools/gen-endpoint-inventory.mjs` | ESM generator. `find src/app -name route.ts`, derive `id`/`route`/`methods`/`dynamic_segments`/20 signals, merge into the existing JSON by `id`. `node:fs` + `node:child_process` only. | 145 |
| `.planning/audit/tools/gen-endpoints-csv.mjs` | ESM CSV emitter. Reads `endpoints.json` as its only input; inline RFC-4180 quote/escape; adds the derived `no_auth_signal` column. | 95 |
| `.planning/audit/inventory/endpoints.json` | AUDIT-03 keystone. 94 rows; the data source for AUDIT-07, AUDIT-08, AUDIT-10, AUDIT-14 and CERT-06. | 5771 |
| `.planning/audit/inventory/endpoints.csv` | Derived human-review view. 1 header + 94 rows, 33 columns, `no_auth_signal` last. Never hand-edited. | 95 |

## Signal aggregates (measured, not transcribed)

| Signal | Count of 94 |
|---|---|
| rows emitted | 94 |
| `uses_service_client` | 22 |
| no `try {` anywhere in the file | 22 |
| sets its own `Cache-Control` | 4 |
| **no auth signal at all** (`getUser`/`verifyAdmin`/`getSession` all false) | **13** |
| `env_gated_auth` (AUDIT-10 fail-open shape) | 2 |
| distinct tables referenced | 32 |
| method exports | GET 60, POST 34, PATCH 13, DELETE 12, PUT 2 |

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **`expected_status` is seeded with all 13 persona keys rather than as `{}`.** The plan and the RESEARCH prototype both specified an empty object, but `endpoints.schema.json` declares those 13 keys `required` and `validate.mjs` emits `missing key (a missing key is a schema error, never an implicit placeholder)` for each absent one — 1,222 schema errors across 94 rows, failing the plan's own acceptance criterion. Seeding `"unknown"` satisfies the schema (`["integer","string"]`), preserves the placeholder semantics `placeholderHits()` looks for, and keeps `--check endpoints` correctly red until plan 01-11 classifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `expected_status: {}` would have failed the plan's own validator gate**

- **Found during:** Task 1 (generator authoring, before first run)
- **Issue:** The action text says "seed `expected_status` as an empty object", copied from the RESEARCH § Code Examples 3 prototype which predates `endpoints.schema.json`. The schema declares all 13 CERT-05 persona keys `required` with `additionalProperties: false`, and `validate.mjs:174` treats a missing required key as a hard schema error by explicit design ("a missing key is a schema error, never an implicit placeholder" — the exact clause CERT-06 depends on). An empty object yields 13 errors per row on every one of the 94 rows, which fails Task 1's own acceptance criterion `validate.mjs --check endpoints-signals exits 0`.
- **Fix:** `humanDefaults()` seeds `expected_status` as `Object.fromEntries(PERSONAS.map(p => [p, "unknown"]))`. The schema permits `["integer","string"]` per persona; `"unknown"` is the sentinel `placeholderHits()` scans for, so `--check endpoints` still fails on every unclassified persona exactly as CERT-06 requires.
- **Files modified:** `.planning/audit/tools/gen-endpoint-inventory.mjs`
- **Verification:** `--check endpoints-signals` → `schema-valid :: all rows valid`. `--check endpoints` → `FAIL :: no-residual-placeholders :: 2068 unclassified`, i.e. 94 rows × (10 human fields + 12 remaining personas), which is the correct pre-classification state.
- **Committed in:** `a0969e4`

**2. [Rule 2 - Missing Critical] `signals.env_gated_auth` emitted despite being absent from the plan's signal list**

- **Found during:** Task 1
- **Issue:** Task 1 enumerates the 19 schema-required signal keys and omits `env_gated_auth`. But `01-01-SUMMARY.md` § "Contracts later plans must honour" states verbatim: "`signals.env_gated_auth` is an optional boolean on the endpoint row; `--check authz-registers` uses it to find the AUDIT-10 fail-open callsites. **Plan 01-02's generator should emit it.**" `README.md` likewise lists `authz/fail-open-register.md` as "derived from `signals.env_gated_auth`". Without it, plan 01-07 has no data source for AUDIT-10 and would have to re-scan `src/` with a second, divergent regex.
- **Fix:** Added the signal using the generalized detector from `01-PATTERNS.md` § Grep targets — `/if\s*\(\s*[A-Za-z_]\w*\s*&&\s*[^)]*!==/`. `signals.additionalProperties` is `true` and the schema documents this exact key, so no schema change was needed.
- **Files modified:** `.planning/audit/tools/gen-endpoint-inventory.mjs`
- **Verification:** 2 endpoints flagged — `/api/admin/calculate-popularity` (the known fail-open reference case from PATTERNS) and `/api/admin/events`. `--check endpoints-signals` remains green.
- **Committed in:** `a0969e4`

**3. [Rule 3 - Blocking] Docblock reference to `src/lib/exportUtils.ts` broke a Task 2 acceptance criterion**

- **Found during:** Task 2 (acceptance verification)
- **Issue:** Task 2 requires `grep -c 'exportUtils' gen-endpoints-csv.mjs` to be `0`. The criterion exists to prove the tool does not import the app-layer CSV writer. The `<read_first>` for the same task points at the PATTERNS row that names the file, and the docblock cited it by name to explain *why* it is not imported — which is exactly the string the criterion forbids. Measured 1, required 0.
- **Fix:** Reworded the docblock to "The nearest CSV writer in this repo lives under `src/lib/` and is deliberately NOT imported", preserving the rationale without the literal token. No import ever existed; only the comment was at issue.
- **Files modified:** `.planning/audit/tools/gen-endpoints-csv.mjs`
- **Verification:** `command grep -c 'exportUtils' .planning/audit/tools/gen-endpoints-csv.mjs` → `0`. CSV regenerated byte-identically afterwards.
- **Committed in:** `5b0eeb3`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing-critical, 1 blocking)
**Impact on plan:** No scope change and no new files. Deviation 1 was required for the plan's own gate to pass at all; deviation 2 honours a contract plan 01-01 explicitly assigned to this plan; deviation 3 was a comment edit. All three are inside the `files_modified` list.

## Issues Encountered

- **`--check endpoints` (as opposed to `--check endpoints-signals`) fails, and should.** `validate.mjs --quick` reports `21 passed, 1 failed, 19 skipped`; the single failure is `endpoints :: no-residual-placeholders :: 2068 unclassified`. That is the post-classification gate owned by plan 01-11, and the pre-classification gate this plan owns is the `endpoints-signals` variant, which is green. A passing `--check endpoints` today would mean the placeholder sentinels were wrong.
- **Four CSV rows have more than 33 comma-separated fields under `awk -F,`.** Their `cache_control_values` cell holds a real directive list (`public, s-maxage=..., stale-while-revalidate=...`) and is correctly double-quoted per RFC 4180, which `awk -F,` does not understand. This is harmless for the plan's criterion because the quoted cell is never last: `no_auth_signal` is the final column and always an unquoted `true`/`false`, so `$NF` is exact. Verified independently — the CSV's 13 and the JSON's 13 agree.
- **The `grep` shim caveat from 01-01 held.** Every count relied on in this plan was derived either inside the Node generators or with `command grep`, never the shell's ugrep shim.

## Read-Only Compliance

| Gate | Result |
|---|---|
| `bash .planning/audit/tools/readonly-guard.sh` after every command | exit 0 |
| Files outside `.planning/` in `a0969e4~1..HEAD` | 0 |
| Deletions in this run's commits | 0 |
| `shasum -a 256 -c baseline/lock.sha256` (inside the guard) | exit 0 — lockfile and manifest untouched |
| Secret sweep over the 4 new artifacts (JWT / `sb_secret_` / connection-string shapes) | 0 hits |
| `env_vars_referenced` content | 6 variable NAMES, no values (threat T-01-02-02 mitigated) |

No package manager, `npx`, or `supabase` command was run. The two pre-existing untracked paths (`docs/product-master-plan.md`, `.planning/research/.cache/`) and the pre-existing uncommitted edit to `.planning/config.json` were left exactly as found and were not staged.

## Threat Flags

None. The generator opens route sources with `readFileSync` only and writes one path under `.planning/`; no new security surface was introduced by this plan.

## Known Stubs

None that block the plan's goal. All 94 rows carry the `"unknown"` placeholder on their 10 human-classification fields and 13 `expected_status` personas **by design** — that is this plan's contract with plan 01-11, and `validate.mjs --check endpoints` mechanically fails until they are resolved, so the placeholders cannot be forgotten.

## User Setup Required

None — this plan reads only the working tree and needs no credential. It was one of the plans 01-01 identified as having zero blocking inputs.

## Self-Check: PASSED

All 4 created files verified present on disk. Both task commits verified in `git log`. All 15 acceptance criteria across the two tasks re-run and green after the final edit. Plan-level `<verification>` re-run: `--check endpoints-signals` exit 0, `readonly-guard.sh` exit 0, both generators byte-identical across consecutive runs.

## Next Phase Readiness

- **Plan 01-07 is unblocked on all four of its registers.** `service-role-register.json` has its 22 `uses_service_client` rows (plus the 2 non-route callsites `validate.mjs` expects, for 24); `getsession-register.md` has its `calls_get_session` rows; `fail-open-register.md` has its 2 `env_gated_auth` rows; and `quality/error-observability.md` has three of its five required integers already measured (`routes_without_try_catch` = 22, plus per-row `catch_any_count` and `console_count`).
- **Plan 01-11 has a machine-ordered starting queue** — the 13 `no_auth_signal` rows in `endpoints.csv`, then the 22 service-client rows.
- **Plan 01-12's cache probe has its route list.** `jq -r '.[] | select(.personalized==true) | .route'` returns nothing until 01-11 classifies `personalized`, which is the correct dependency order; the 4 endpoints already setting their own `Cache-Control` are visible now.
- **Plan 01-03 should mirror this generator's merge-by-id shape** for `pages.json`; `gen-endpoint-inventory.mjs` is the reference implementation.
- **One concern for 01-13:** 13 of 94 handlers (14%) call no authorization primitive at all, and 2 of the admin handlers are env-gated fail-open on a service-role client. Neither is a finding yet — classification in 01-11 decides which are legitimately anonymous — but both queues are now enumerated rather than estimated.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
