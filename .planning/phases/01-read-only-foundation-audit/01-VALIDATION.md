---
phase: 1
slug: read-only-foundation-audit
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
updated: 2026-09-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Critical framing:** the normal answer — "add a Jest test" — is forbidden in this phase. Jest tests live under `src/`, and writing to `src/` fails the phase's own exit criterion. The validation harness is a zero-dependency Node validator plus a shell guard, both under `.planning/audit/tools/`, invoked directly. `jest.config.js`, `package.json`, and every file under `src/` remain untouched.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (deliberate). Node 24 built-ins only. |
| **Config file** | `.planning/audit/tools/validate.mjs` — self-contained, check registry is a top-level const. **Does not exist yet → Wave 1 (plan 01-01, task 2).** |
| **Quick run command** | `node .planning/audit/tools/validate.mjs --quick && bash .planning/audit/tools/readonly-guard.sh` |
| **Full suite command** | `node .planning/audit/tools/validate.mjs && bash .planning/audit/tools/readonly-guard.sh` |
| **Estimated runtime** | ~2 seconds quick, ~10 seconds full |
| **App test suite** | `npx jest` runs **once**, as AUDIT-13 evidence capture in plan 01-04, never as a gate. Its output is an artifact (`baseline/jest.txt`). |

---

## Sampling Rate

- **After every task commit:** `bash .planning/audit/tools/readonly-guard.sh && node .planning/audit/tools/validate.mjs --check <the-check-this-task-owns>` — under 2 s. The guard runs on **every** task, including pure-analysis ones, because the read-only invariant is the one thing a single careless edit destroys irrecoverably.
- **After every plan wave:** `node .planning/audit/tools/validate.mjs --quick && bash .planning/audit/tools/readonly-guard.sh` — full artifact, schema, and cross-reference sweep over everything that exists so far.
- **Before `/gsd-verify-work`:** full suite green with **no check selector** (all 21 checks must PASS, not SKIP), plus the secret sweep over `.planning/audit/` itself, plus `git status --porcelain -- . ':(exclude).planning'` byte-identical to the Wave 1 baseline.
- **Max feedback latency:** 2 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUDIT-13 | T-01-01-01 / T-01-01-02 | Tree outside `.planning/` provably unmodified; lockfile hash pinned | guard | `bash .planning/audit/tools/readonly-guard.sh && grep -q '^route_ts_count=94$' .planning/audit/baseline/versions.txt` | ❌ W1 (self-creating) | ⬜ pending |
| 1-01-02 | 01 | 1 | AUDIT-20 | T-01-01-03 | Absent artifact fails `--check`, never passes silently | selftest | `node .planning/audit/tools/validate.mjs --selftest` | ❌ W1 (self-creating) | ⬜ pending |
| 1-01-03 | 01 | 1 | AUDIT-21 | T-01-01-03 / T-01-01-04 | Credential request names variables only; severity graded against a pre-committed policy | content | `node .planning/audit/tools/validate.mjs --check sla` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 2 | AUDIT-03 | T-01-02-02 / T-01-02-03 | Env var NAMES only in artifact; merge-by-id preserves classification | schema + count | `node .planning/audit/tools/validate.mjs --check endpoints-signals` | ✅ | ⬜ pending |
| 1-02-02 | 02 | 2 | AUDIT-03 | T-01-02-04 | Derived CSV isolates the 13-route no-auth-signal review queue | count | `test "$(wc -l < .planning/audit/inventory/endpoints.csv)" = 95 && node .planning/audit/tools/validate.mjs --check endpoints-signals` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 2 | AUDIT-04 | T-01-03-04 | A full build mutates nothing tracked | guard | `bash .planning/audit/tools/readonly-guard.sh && test -s .planning/audit/inventory/build-routes.txt` | ✅ | ⬜ pending |
| 1-03-02 | 03 | 2 | AUDIT-04 | T-01-03-05 | Layout-guarded subtrees are not misreported as unprotected | schema + cross-ref | `node .planning/audit/tools/validate.mjs --check pages` | ✅ | ⬜ pending |
| 1-03-03 | 03 | 2 | AUDIT-16 | T-01-03-01 / T-01-03-02 / T-01-03-03 | No secret in the client bundle; a clean result is falsifiable via recorded ENVSTATE; no matched value echoed | content | `node .planning/audit/tools/validate.mjs --check bundle-sweep` | ✅ | ⬜ pending |
| 1-04-01 | 04 | 2 | AUDIT-13 | T-01-04-01 / T-01-04-02 | Caches are gitignored; no install to make a suite pass | artifact | `bash .planning/audit/tools/readonly-guard.sh && grep -q 'Test Suites:' .planning/audit/baseline/jest.txt` | ✅ | ⬜ pending |
| 1-04-02 | 04 | 2 | AUDIT-13 | T-01-04-04 | Locked decision carries cited evidence, not assertions | content | `node .planning/audit/tools/validate.mjs --check baseline` | ✅ | ⬜ pending |
| 1-05-01 | 05 | 2 | AUDIT-12 | **T-01-05-SC** | Pinned third-party execution gated by a never-auto-approved human checkpoint | guard | `bash .planning/audit/tools/readonly-guard.sh` | ✅ | ⬜ pending |
| 1-05-02 | 05 | 2 | AUDIT-12 | T-01-05-01 / T-01-05-02 / T-01-05-03 / T-01-05-04 | Lockfile byte-identical after every npm read; no root config; reachable High has a written judgment | schema + content | `node .planning/audit/tools/validate.mjs --check deps` | ✅ | ⬜ pending |
| 1-05-03 | 05 | 2 | AUDIT-15 | T-01-05-05 | No unconfirmed knip hit passes through to Stage 2 removal | content | `node .planning/audit/tools/validate.mjs --check dead-code` | ✅ | ⬜ pending |
| 1-06-01 | 06 | 2 | AUDIT-01 | T-01-06-03 | Credentials present in env, absent from disk; never printed | env probe | `node -e "const e=process.env;process.exit((e.SUPABASE_ACCESS_TOKEN&&e.PROD_PROJECT_REF)\|\|e.PROD_DB_URL\|\|e.SUPABASE_DB_PASSWORD?0:1)"` | ✅ | ⬜ pending |
| 1-06-02 | 06 | 2 | AUDIT-19 | T-01-06-01 | SQL write is impossible — server-enforced read-only; service-role client never used as transport | content + cross-ref | `node .planning/audit/tools/validate.mjs --check dates` | ✅ | ⬜ pending |
| 1-06-03 | 06 | 2 | AUDIT-01 | T-01-06-02 / T-01-06-04 / T-01-06-05 / T-01-06-06 | Auth schema excluded; no credential in any dump; no migration file created | artifact | `node .planning/audit/tools/validate.mjs --check schema-snapshots && test -z "$(git status --porcelain -- supabase/migrations)"` | ✅ | ⬜ pending |
| 1-07-01 | 07 | 3 | AUDIT-07 | T-01-07-03 | Every RLS-bypass callsite has four non-null justifications and a verdict | cross-ref | `node .planning/audit/tools/validate.mjs --check service-role` | ✅ | ⬜ pending |
| 1-07-02 | 07 | 3 | AUDIT-09, AUDIT-10 | T-01-07-01 / T-01-07-02 / T-01-07-06 | Both confirmed fail-open findings banked with line ranges; nothing fixed | cross-ref | `node .planning/audit/tools/validate.mjs --check authz-registers && git diff --exit-code --quiet -- src/` | ✅ | ⬜ pending |
| 1-07-03 | 07 | 3 | AUDIT-14 | T-01-07-04 / T-01-07-05 | Error-leak count and middleware fail-open recorded as integers with derivations | content | `node .planning/audit/tools/validate.mjs --check observability` | ✅ | ⬜ pending |
| 1-08-01 | 08 | 3 | AUDIT-02 | T-01-08-01 / T-01-08-02 / T-01-08-03 | Diff captured from stdout; migration count unchanged; no credential in output | guard + count | `bash .planning/audit/tools/readonly-guard.sh && test -z "$(git status --porcelain -- supabase/)"` | ✅ | ⬜ pending |
| 1-08-02 | 08 | 3 | AUDIT-02 | T-01-08-04 / T-01-08-05 | Types file judged, never trusted; a parser hole fails the check | schema + cross-ref | `node .planning/audit/tools/validate.mjs --check drift` | ✅ | ⬜ pending |
| 1-09-01 | 09 | 3 | AUDIT-05 | T-01-09-05 / T-01-09-06 | Policies read from the live database, not migration files; no embedded value committed | artifact | `bash .planning/audit/tools/readonly-guard.sh && node -e "JSON.parse(require('fs').readFileSync('.planning/audit/rls/pg_policies.json','utf8'))"` | ✅ | ⬜ pending |
| 1-09-02 | 09 | 3 | AUDIT-05 | T-01-09-01 / T-01-09-02 / T-01-09-03 | All four flag classes addressed with severities and cited evidence | artifact + content | `node .planning/audit/tools/validate.mjs --check rls` | ✅ | ⬜ pending |
| 1-09-03 | 09 | 3 | AUDIT-06 | T-01-09-04 | Deny is distinguished from none in every cell | schema | `node .planning/audit/tools/validate.mjs --check heatmap` | ✅ | ⬜ pending |
| 1-10-01 | 10 | 3 | AUDIT-18 | T-01-10-02 / T-01-10-03 / T-01-10-04 / T-01-10-06 | Path-prefix ownership, read visibility, and limits answered per bucket | cross-ref | `node .planning/audit/tools/validate.mjs --check storage` | ✅ | ⬜ pending |
| 1-10-02 | 10 | 3 | AUDIT-11 | T-01-10-07 | Dashboard state recorded with no token value transcribed | artifact | `test -s .planning/audit/async/vercel-crons.md && bash .planning/audit/tools/readonly-guard.sh` | ✅ | ⬜ pending |
| 1-10-03 | 10 | 3 | AUDIT-11 | T-01-10-01 / T-01-10-05 | All six trigger sources get an explicit verdict; unconfirmed trigger on a Validated workflow is a High | content | `node .planning/audit/tools/validate.mjs --check cron` | ✅ | ⬜ pending |
| 1-11-01 | 11 | 4 | AUDIT-03 | T-01-11-01 / T-01-11-06 | Highest-risk cohort classified first; service-role verdicts transcribed, not re-decided | cross-ref | `node .planning/audit/tools/validate.mjs --check endpoints-signals && git diff --exit-code --quiet -- src/` | ✅ | ⬜ pending |
| 1-11-02 | 11 | 4 | AUDIT-03 | T-01-11-02 | Personalization defined by body-varies-per-user, decoupled from auth requirement | schema | `node .planning/audit/tools/validate.mjs --check endpoints-signals` | ✅ | ⬜ pending |
| 1-11-03 | 11 | 4 | AUDIT-03, AUDIT-04 | T-01-11-01 / T-01-11-03 / T-01-11-04 / T-01-11-05 | No unclassified endpoint or page survives; expectations record intended behavior, not current defects | schema + cross-ref | `node .planning/audit/tools/validate.mjs --check endpoints && node .planning/audit/tools/validate.mjs --check pages` | ✅ | ⬜ pending |
| 1-12-01 | 12 | 5 | AUDIT-08 | T-01-12-03 | Cookies live in shell variables only; distinctness confirmed without printing | env probe | `node -e "const e=process.env;process.exit(e.PROD_HOST&&e.COOKIE_A&&e.COOKIE_B&&e.COOKIE_A!==e.COOKIE_B?0:1)"` | ✅ | ⬜ pending |
| 1-12-02 | 12 | 5 | AUDIT-08 | T-01-12-02 / T-01-12-04 / T-01-12-06 | GET-only, header-only, set-cookie redacted at write time, no token on disk | artifact + cross-ref | `bash .planning/audit/tools/readonly-guard.sh && test -z "$(grep -rl 'auth-token=' .planning/audit/cache/curl/ 2>/dev/null)"` | ✅ | ⬜ pending |
| 1-12-03 | 12 | 5 | AUDIT-08 | T-01-12-01 / T-01-12-05 | Every personalized endpoint has a verdict; a control-less run cannot read as clean | cross-ref | `node .planning/audit/tools/validate.mjs --check cache` | ✅ | ⬜ pending |
| 1-13-01 | 13 | 6 | AUDIT-17 | T-01-13-04 | Three boundaries examined; coverage argument states negatives as well as findings | artifact | `node .planning/audit/tools/validate.mjs --check threat-models` | ✅ | ⬜ pending |
| 1-13-02 | 13 | 6 | AUDIT-20 | T-01-13-02 / T-01-13-04 / T-01-13-05 / T-01-13-06 | Evidence is a resolvable path, never an inline value; every Critical/High has line numbers; registers cannot drift | schema + cross-ref | `node .planning/audit/tools/validate.mjs --check findings` | ✅ | ⬜ pending |
| 1-13-03 | 13 | 6 | AUDIT-20 | T-01-13-01 / T-01-13-03 / T-01-13-07 | No credential in any committed artifact; tree outside `.planning/` byte-identical to baseline | guard + full suite | `node .planning/audit/tools/validate.mjs && bash .planning/audit/tools/readonly-guard.sh` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no three consecutive tasks lack an automated verify — all 35 tasks carry one, including the four human checkpoints, which verify via an exit-code environment probe plus the guard.

---

## Wave 0 Requirements

Wave 0 is **plan 01-01 (frontmatter `wave: 1`)**. Every other plan depends on it, and no evidence-gathering command runs before it completes.

- [ ] `.planning/audit/tools/readonly-guard.sh` — the phase exit criterion; must exist before task 1 of any other plan. Baseline-diffed, never emptiness-asserted (`docs/product-master-plan.md` is already untracked).
- [ ] `.planning/audit/baseline/git-status.before.txt` + `.planning/audit/baseline/lock.sha256` — the guard's referents.
- [ ] `.planning/audit/baseline/versions.txt` — re-derived counts (94 routes / 43 pages / 44 migrations) and tool versions. The validator asserts against this file, never against a planning-document literal — upstream documents say 92 and 45 and are wrong.
- [ ] `.planning/audit/tools/validate.mjs` — zero-dependency validator with `--check <name>`, `--quick`, and `--selftest`; all 21 check names registered up front so no later plan needs to edit it (which would create same-wave file contention).
- [ ] `.planning/audit/inventory/endpoints.schema.json`, `.planning/audit/inventory/pages.schema.json`, `.planning/audit/findings.schema.json` — hand-written draft-2020-12 subsets checked by a hand-rolled checker inside `validate.mjs` (no `ajv`, no install).
- [ ] `.planning/audit/BLOCKING-INPUTS.md` — the credential and host request, written before Wave 2 is attempted so human latency overlaps the static analysis.
- [ ] `.planning/audit/REDACTION.md` + `.planning/audit/redaction/` — created in Wave 0 so every credentialed plan has a per-plan file to append to without same-wave contention.
- [ ] `.planning/audit/SEVERITY_SLA.md` — written before any finding exists, so severity is graded against a pre-committed policy rather than argued after the fact.

*Framework install: none required. Nothing is added to `package.json` or `package-lock.json`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pinned third-party tool legitimacy | AUDIT-12, AUDIT-15 | Authorising execution of registry-fetched code is a trust decision, not a computation. Never auto-approvable. | Plan 01-05, task 1: confirm publisher, repository, and exact pinned version for both packages on the registry, then approve or reject. |
| Supabase credentials and container daemon | AUDIT-01, AUDIT-02, AUDIT-05, AUDIT-06, AUDIT-11, AUDIT-18, AUDIT-19 | A personal access token must be minted by a signed-in human; project reference ids are dashboard-only; starting a container daemon is a desktop action. | Plan 01-06, task 1: export the named variables, start the daemon, confirm whether a staging project exists. |
| Deployment platform cron list | AUDIT-11 | No unauthenticated API exposes it; the repository has already been searched and the answer is not there. | Plan 01-10, task 2: read the project's Cron Jobs settings page and paste the list or confirm it is empty. |
| Production hostname and two session cookie sets | AUDIT-08 | The hostname appears nowhere in the repository; live session cookies can only be copied from a signed-in browser's developer tools. | Plan 01-12, task 1: export the hostname and both cookie strings, including chunked suffixes, for two distinct accounts. |
| Reviewer can answer the five questions from artifacts alone | ROADMAP success criterion 3 | Judging whether a document is self-sufficient is inherently a human read. Runs as an end-of-phase `<human-check>`, not a checkpoint task, per `workflow.human_verify_mode: end-of-phase`. | Plan 01-13, task 3 `<human-check>`: open `FOUNDATION_AUDIT.md` and `README.md` and answer the five questions without opening a source file. |

Each manual item still carries an automated companion: the four checkpoints verify with an exit-code environment probe plus the read-only guard, so no task in the phase lacks an `<automated>` verify.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`validate.mjs`, `readonly-guard.sh`, three schemas, three baseline files)
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — set to approved once Wave 0 (plan 01-01) lands and `wave_0_complete` flips to true.
