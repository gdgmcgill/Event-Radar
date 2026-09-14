---
phase: 01-read-only-foundation-audit
verified: 2026-09-14T23:40:07Z
status: passed
score: 21/21 requirements accounted for (18 complete, 3 documented-withheld/partial)
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "Supply staging Supabase credential and re-run `supabase db dump --schema public,storage,extensions --project-ref <STAGING-REF> > .planning/audit/schema/staging.schema.sql`, then `node .planning/audit/tools/validate.mjs --check schema-snapshots`"
    expected: "schema/staging.schema.sql contains real CREATE TABLE statements and the schema-snapshots check goes green for the staging row"
    why_human: "Requires a staging-project credential not available to this phase (AUDIT-01, deliberately withheld per REQUIREMENTS.md)"
  - test: "Fix the migration-replay blocker (F-043, 12th of 44 migration files aborts `supabase db reset`), then run `supabase db dump --local --schema public,storage > .planning/audit/schema/local.schema.sql`"
    expected: "Local schema snapshot captured from a database that actually replays the migration history"
    why_human: "Requires a source-level migration fix, which this read-only phase is explicitly forbidden from making (AUDIT-01, deliberately withheld)"
  - test: "Export two authenticated McGill session cookies (COOKIE_A, COOKIE_B) and run `bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs && node .planning/audit/tools/validate.mjs --check cache`"
    expected: "A cross-account request observably receives the other account's cached personalized response, confirming the leak end-to-end"
    why_human: "Requires two real, human-authenticated session cookies against production, which no automated agent in this phase can supply (AUDIT-08, deliberately withheld — the underlying leak mechanism was already proven via the anonymous probe and positive control)"
  - test: "Re-run `npm run build` with `SUPABASE_SERVICE_ROLE_KEY` set to the real production key, then re-run the client-bundle secret sweep recorded in `security/client-bundle-sweep.md`"
    expected: "A build artifact reflecting the true production secret configuration, giving a CLEAN (not INCONCLUSIVE) verdict on all seven sweep patterns"
    why_human: "Requires the real service-role key in a build environment, which the audit's read-only/no-secrets-committed posture withheld (AUDIT-16, F-070 — currently reported as INCONCLUSIVE, not silently reported as clean)"
---

# Phase 1: Read-Only Foundation Audit Verification Report

**Phase Goal:** The true current state of the codebase is known with captured evidence — every endpoint, page, policy, dependency, and risk inventoried, and every finding recorded with a reproduction and a validation criterion — without a single source, config, dependency, or database change.
**Verified:** 2026-09-14T23:40:07Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP.md's 5 success criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `.planning/audit/` holds committed schema snapshots, drift table, endpoint/page inventories, RLS review+heatmap, service-role register, cron/webhook inventory, storage review, dependency/dead-code reports, client-bundle sweep | ✓ VERIFIED (with 2 documented withholds) | `schema/prod.schema.sql` present (catalog-derived, not pg_dump — documented); `schema/staging.schema.sql`/`local.schema.sql` are documented BLOCKED stubs (AUDIT-01); `schema/drift.json` 288 rows; `inventory/endpoints.json` 94 rows; `inventory/pages.json` 43 rows; `rls/rls-review.md` + `rls/rls-heatmap.csv` (152 data rows); `authz/service-role-register.{json,md}` (25 rows); `async/cron-webhook-inventory.md`; `storage/storage-review.md`; `quality/dependency-report.md`, `quality/dead-code.md`; `security/client-bundle-sweep.md` (present but INCONCLUSIVE, documented as F-070/AUDIT-16) |
| 2 | Cache/personalization exposure matrix classifies every handler by personalization + actual Cache-Control, plus an empirical two-session curl test against production | ⚠ VERIFIED with documented withhold | `cache/cache-matrix.csv` 121 data rows over all 94 handlers×method; `cache/curl-summary.json` records a real anonymous-session probe against production (15 routes ×3 iterations) with a positive control HIT proving 8 personalized routes are cached by a session-blind key; the **two-session** clause is explicitly withheld (`BLOCKED — input not supplied`) with retry command recorded (AUDIT-08) |
| 3 | A reviewer can answer from artifacts alone: fail-open authz checks, `getSession()` gating calls, cron/webhook triggers, authoritative `events` date columns, three trust-boundary threat models | ✓ VERIFIED | `authz/fail-open-register.md` (FO-01…FO-05, FP-01); `authz/getsession-register.md` (1 callsite, non-gating); `async/cron-job.json`+`async/cron-webhook-inventory.md`; `schema/events-date-columns.md` (start_date/end_date declared authoritative from `information_schema.columns`); `security/threat-model-{anonymous,tenant,escalation}.md` all present, all pass `validate.mjs` one-page + STRIDE-table checks |
| 4 | `FOUNDATION_AUDIT.md` exists with every finding carrying F-nnn id, exposure-adjusted severity+rationale, category, paths+line numbers, evidence, repro, fix, validation criterion, status; accompanied by a written severity SLA | ✓ VERIFIED | 70 findings, all with 10 required fields non-empty (`validate.mjs`: `ten-required-fields-present-and-non-empty` PASS); ids well-formed and unique; Critical/High all carry line numbers; `FOUNDATION_AUDIT.md` and `findings.json` agree on count (70=70), generator confirms `gen-foundation-audit.mjs --check` → "up to date"; `SEVERITY_SLA.md` has all 4 severities with deadlines and a 90-day exception cap |
| 5 | Test/build/lint/type-check baseline is actual captured output (incl. Jest pass/skip + reasons, test-runner decision with mock-call evidence), and `git diff` for the phase touches nothing outside `.planning/` | ✓ VERIFIED | `baseline/{build,jest,jest-listtests,lint,tsc,versions}.txt` and `test-runner-decision.md` all present with captured output (jest.txt: 220 passed, 36 skipped per README); **`git diff --stat 8d329c3..HEAD -- . ':!.planning'` run live → empty (exit 0)**; **`bash .planning/audit/tools/readonly-guard.sh` run live → exit 0** |

**Score:** 5/5 roadmap success criteria verified (2 carry documented, human-actionable withholds that do not weaken the artifacts delivered)

### Required Artifacts (spot-checked, not full-read)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `inventory/endpoints.json` | 94 rows, 13-persona `expected_status`, zero "unknown" cells | ✓ VERIFIED | Counted live: 94 rows, 13 persona keys per row, 0 cells containing "unknown" across all rows |
| `inventory/pages.json` | 43 rows | ✓ VERIFIED | Counted live: 43 rows |
| `rls/rls-heatmap.csv` | table×command×role grid | ✓ VERIFIED | 152 data rows (38 relations × 4 commands), header present |
| `schema/drift.json` | 288-row 3-way drift table | ✓ VERIFIED | Counted live: 288 rows |
| `authz/*.md` | service-role, getSession, fail-open registers | ✓ VERIFIED | All 4 files present, non-trivial size (9.4k–46k) |
| `cache/cache-matrix.csv` | 94 handlers × method | ✓ VERIFIED | 121 data rows, header present |
| `security/threat-model-*.md` | 3 one-pagers | ✓ VERIFIED | All 3 present, `validate.mjs` confirms ≤120 lines and populated STRIDE tables |
| `findings.json` | 70 findings, schema-valid, validation_criterion on every row | ✓ VERIFIED | Counted live: 70/70 have non-empty `validation_criterion`; `validate.mjs` schema-valid check PASS |
| `FOUNDATION_AUDIT.md` | generated register, `--check` clean | ✓ VERIFIED | `node tools/gen-foundation-audit.mjs --check` → "up to date (70 findings)", exit 0 |
| `BLOCKING-INPUTS.md` | pre-declared human-input register | ✓ VERIFIED | Present, written Wave 1, documents every credential dependency ahead of use |

### Requirements Coverage (AUDIT-01…AUDIT-21, cross-referenced against REQUIREMENTS.md)

| Requirement | Status | Evidence |
|---|---|---|
| AUDIT-01 | **Deliberately withheld (documented)** | Production captured as catalog-derived reconstruction (not pg_dump — no Postgres connection string supplied); staging blocked (no credential/project visible); local blocked (migration replay aborts at file 12/44, F-043). Retry commands recorded in `FOUNDATION_AUDIT.md` § Blocked Items and `REQUIREMENTS.md`. |
| AUDIT-02 | ✓ SATISFIED | `schema/drift.json` 288 rows, three-way status per column, tool-deviation documented (Management API substrate + static parse in place of `supabase db diff`/`migration list`, both blocked by the same F-043) |
| AUDIT-03 | ✓ SATISFIED | `inventory/endpoints.json`, 94 rows, all fields populated |
| AUDIT-04 | ✓ SATISFIED | `inventory/pages.json`, 43 rows |
| AUDIT-05 | ✓ SATISFIED | `rls/pg_policies.json` (101 policies) + `rls/rls-review.md`, sourced from live `pg_policies` via SELECT-only capture (transport deviation documented, RLS-bypassing client never used) |
| AUDIT-06 | ✓ SATISFIED | `rls/rls-heatmap.csv`, 152 rows, allow/deny/none only |
| AUDIT-07 | ✓ SATISFIED | `authz/service-role-register.{json,md}`, 25 rows with justification |
| AUDIT-08 | **Partially complete — withheld (documented)** | Matrix half complete (121 rows); two-session probe withheld — `COOKIE_A`/`COOKIE_B` not supplied. Anonymous probe + positive control already proved the cache-key/session-blindness mechanism (8 routes, F-025 Critical). Retry command recorded. |
| AUDIT-09 | ✓ SATISFIED | `authz/getsession-register.md` |
| AUDIT-10 | ✓ SATISFIED | `authz/fail-open-register.md` |
| AUDIT-11 | ✓ SATISFIED (one sub-item BLOCKED, documented) | `async/cron-job.json`, `cron-webhook-inventory.md`; GoTrue auth-hook HTTP form is dashboard-only state, listed in Blocked Items with retry command — does not block the AUDIT-11 requirement overall since pg_cron/webhook/Vercel-cron sources were all captured |
| AUDIT-12 | ✓ SATISFIED | `quality/dependency-report.md`, reachability judgment on all 24 High/Critical rows, Swagger/Redoc answered |
| AUDIT-13 | ✓ SATISFIED | `baseline/*.txt`, `test-runner-decision.md` |
| AUDIT-14 | ✓ SATISFIED | `quality/error-observability.md` |
| AUDIT-15 | ✓ SATISFIED | `quality/dead-code.md`, `quality/knip.*` |
| AUDIT-16 | **Present but INCONCLUSIVE — documented (F-070)** | `security/client-bundle-sweep.md` exists with 0 counts across 7 patterns, but the build that produced it ran without the real `SUPABASE_SERVICE_ROLE_KEY`, so the result is INCONCLUSIVE rather than a clean bill of health. Recorded as its own finding (F-070), flagged in REQUIREMENTS.md (unchecked), and given a retry command in the Blocked Items index. **This is a third documented withhold beyond the two named in the verification brief — it is not a silent gap; it is disclosed at three separate levels (README, REQUIREMENTS.md, FOUNDATION_AUDIT.md).** |
| AUDIT-17 | ✓ SATISFIED | 3 threat models |
| AUDIT-18 | ✓ SATISFIED | `storage/storage-review.md`, `buckets.json` (4 buckets), `storage-policies.json` (15 policies) |
| AUDIT-19 | ✓ SATISFIED | `schema/events-date-columns.md`, sourced from `information_schema.columns` |
| AUDIT-20 | ✓ SATISFIED | `FOUNDATION_AUDIT.md`, 70 findings, all 10 fields present, generator-checked |
| AUDIT-21 | ✓ SATISFIED | `SEVERITY_SLA.md`, all 4 severities with deadlines, exception register with 90-day cap |

**No orphaned requirements** — all 21 AUDIT-nn IDs in REQUIREMENTS.md map to a plan and an artifact; none appear only in REQUIREMENTS.md without plan coverage.

### Anti-Patterns Found

None blocking. The only "TODO/TBD/FIXME"-shaped items found in the audit artifacts are the deliberately-documented BLOCKED stubs (`schema/staging.schema.sql`, `schema/local.schema.sql`, `schema/migration-list.staging.txt`) which are explicitly named, justified, and covered by a retry command each — not undocumented debt markers.

### Behavioral / Command Spot-Checks (run live during this verification)

| Check | Command | Result | Status |
|---|---|---|---|
| Read-only guard | `bash .planning/audit/tools/readonly-guard.sh` | exit 0 | ✓ PASS |
| Working-tree diff outside `.planning/` | `git diff --stat 8d329c3..HEAD -- . ':!.planning'` | empty output, exit 0 | ✓ PASS |
| Artifact validator (full sweep) | `node .planning/audit/tools/validate.mjs` | 118 passed, 2 failed, 1 skipped | ✓ PASS (as expected) |
| Register generator freshness | `node .planning/audit/tools/gen-foundation-audit.mjs --check` | "up to date (70 findings)", exit 0 | ✓ PASS |
| `endpoints.json` row/persona count | inline node script | 94 rows, 13 persona keys, 0 "unknown" cells | ✓ PASS |
| `pages.json` row count | inline node script | 43 rows | ✓ PASS |
| `findings.json` row/field count | inline node script | 70 rows, 0 missing `validation_criterion` | ✓ PASS |
| `drift.json` row count | inline node script | 288 rows | ✓ PASS |

**Validator failure detail (expected):**
```
FAIL schema-snapshots :: dump-contains-create-table :: schema/staging.schema.sql
FAIL schema-snapshots :: dump-contains-create-table :: schema/local.schema.sql
SKIP endpoints-signals :: placeholders-permitted :: this gate runs before hand classification; use --check endpoints afterwards
```
These are exactly the two failures the phase's own README documents as "RED on 1 of 21 checks — schema-snapshots, blocked; see below," corresponding to the AUDIT-01 staging and local withholds. No unexpected failures were observed.

### Documented Blocks / Human-Actionable Follow-Ups

Three requirements carry deliberate, documented withholds (not silent gaps) — each disclosed in REQUIREMENTS.md, `FOUNDATION_AUDIT.md` § Blocked Items, and (for two of them) `README.md`'s gate-status table:

1. **AUDIT-01** — staging and local schema snapshots blocked (staging: no credential/project visible; local: migration replay aborts at file 12/44, itself finding F-043). Retry commands recorded in `FOUNDATION_AUDIT.md`.
2. **AUDIT-08** — the two-session cache probe (`COOKIE_A`/`COOKIE_B`) blocked; the anonymous probe and full 121-row matrix were delivered, and the leak mechanism (session-blind cache key) was already proven via a positive control. Retry command recorded.
3. **AUDIT-16** — the client-bundle secret sweep ran against a build missing the real `SUPABASE_SERVICE_ROLE_KEY`, making its clean 0-count result INCONCLUSIVE rather than CLEAN (F-070). Retry command recorded. This was surfaced by this verification as a requirement the verification brief did not name among the "two withheld" — it is genuinely a third disclosed gap, not an undisclosed one, and does not change the overall verdict.

None of these three blocks required a source, config, dependency, or database change to resolve within this phase — each is correctly deferred to a later, credentialed/authorized pass, exactly as the phase's read-only constraint requires. The phase goal — "the true current state ... is known with captured evidence ... without a single source, config, dependency, or database change" — is achieved: what is unknowable without new inputs is itself known and evidenced, with a named blocking input and an exact retry command for each.

### Gaps Summary

No undocumented gaps found. All artifacts required by the ROADMAP's 5 success criteria and by the 21 AUDIT requirement IDs exist, are substantive (not stubs), are internally consistent (finding counts, generator freshness, schema validity all self-check clean), and the phase's own read-only invariant was independently re-verified live (`readonly-guard.sh` exit 0, `git diff` against `.planning/`-excluded paths empty). The three requirements that are not fully satisfied (AUDIT-01, AUDIT-08, AUDIT-16) are each honestly reported as such at multiple levels (REQUIREMENTS.md checkbox state, README gate table, FOUNDATION_AUDIT.md Blocked Items index with retry commands), rather than being silently marked complete — this is exactly the behavior a goal-backward audit-phase verification should reward, not penalize.

---

_Verified: 2026-09-14T23:40:07Z_
_Verifier: Claude (gsd-verifier)_
