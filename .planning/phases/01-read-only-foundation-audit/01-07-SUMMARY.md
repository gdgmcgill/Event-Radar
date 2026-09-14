---
phase: 01-read-only-foundation-audit
plan: 07
subsystem: auth
tags: [authorization, rls, service-role, supabase, fail-open, getsession, observability, error-handling, static-analysis, read-only]

# Dependency graph
requires:
  - phase: 01-01
    provides: "validate.mjs (the service-role, authz-registers and observability checks), readonly-guard.sh, baseline/versions.txt as the only count source, SEVERITY_SLA.md for the severity vocabulary"
  - phase: 01-02
    provides: "inventory/endpoints.json — signals.uses_service_client (22 route handlers), signals.calls_get_session, signals.env_gated_auth, signals.has_try_catch, signals.catch_any_count, signals.env_vars_referenced"
  - phase: 01-03
    provides: "inventory/pages.json (the single service-role page row and its protection columns) and security/client-bundle-sweep.md, whose ENVSTATE is what makes the page-component risk UNRESOLVED rather than clean"
provides:
  - "AUDIT-07: a 25-row machine-readable service-role register with all four justification questions answered as reasoned sentences on every row, plus a generated Markdown view — 10 justified, 14 needs-decision, 1 unjustified"
  - "The headline elevation-of-privilege candidate: src/app/users/[id]/page.tsx:35 (generateMetadata) constructs the RLS-bypassing client with no authentication and filters it on an attacker-supplied path parameter"
  - "A named coverage gap: /api/admin/calculate-popularity builds a service-role client inline, so the factory-shaped detection signal cannot see it — a 26th construction site"
  - "AUDIT-09: the single getSession callsite (health route line 160) classified non-gating with the reason, and the March CONCERNS.md plural claim corrected with evidence"
  - "AUDIT-10: four env-conditional authorization checks (not two), with line ranges, reachable routes, failure modes, RLS-bypass flags and proposed severities — FO-01 Critical, FO-02 High, FO-03 Medium, FO-05 Low, plus FO-04 as the fail-closed positive control and FP-01 as a documented signal false positive"
  - "AUDIT-14: five reproducible integers (22 / 22 / 5 / 162 / 0) with per-file lists, the middleware fail-open record, and the next.config.js security headers as the positive control"
  - "The REFAC-20 observability baseline, stated so the same commands re-run after the work produce a comparable number"
affects: [01-09 RLS and authorization, 01-11 endpoint and page classification, 01-13 phase gate and findings.json, Stage 3 REFAC-13 admin containment, Stage 3 REFAC-20 observability, Stage 4 persona matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived row sets: a register's population comes from an existing inventory signal, never from a fresh grep, and the generator throws rather than writing a file when the derived count disagrees with baseline/versions.txt"
    - "Generated Markdown views: the .md is rendered from the .json by a command quoted inside the .md itself, so the human view and the machine view cannot drift"
    - "Four-answer sentences, not booleans: a boolean true for rls_bypass_required records the claim without the reason, and the reason is the requirement"
    - "Negative rows are deliverables: the fail-closed sibling route, the detector false positive, and the excluded grep matches are all registered so a zero or a count is falsifiable rather than asserted"
    - "Multi-detector sweeps: a defect class with more than one syntax needs more than one detector, and the under-reporting of the single specified detector is itself recorded as a finding"

key-files:
  created:
    - .planning/audit/authz/service-role-register.json
    - .planning/audit/authz/service-role-register.md
    - .planning/audit/authz/getsession-register.md
    - .planning/audit/authz/fail-open-register.md
    - .planning/audit/quality/error-observability.md
  modified:
    - .planning/audit/tools/validate.mjs

key-decisions:
  - "The service-role register is 25 rows including the factory module itself; validate.mjs NON_ROUTE_SERVICE_CLIENT_CALLSITES corrected 2 -> 3 and the derived count now cross-checked against baseline/versions.txt service_client_file_count"
  - "Verdict rubric: needs-decision marks rows blocked on a policy fact (plan 01-09 RLS) or a product decision, not on more reading — 10 justified, 14 needs-decision, 1 unjustified"
  - "src/app/users/[id]/page.tsx generateMetadata line 35 is the sole unjustified callsite: no authentication before construction, attacker-supplied path parameter as filter, on a component that compiles toward the client boundary"
  - "AUDIT-10 found four env-conditional authorization checks, not two; the 01-PATTERNS.md detector finds only calculate-popularity, so three further detectors were required and the under-reporting is filed as a method finding"
  - "/api/admin/events env_gated_auth is a detector false positive (a query-string filter, not an env var) and is registered as such rather than deleted, because validate.mjs requires the route to appear and a documented false positive stops the next reviewer re-investigating it"
  - "routes_leaking_internal_error_text = 22 files across 40 sites, measured by a published scan that excludes console.* and throw sinks because only the response body crosses the trust boundary"

patterns-established:
  - "Reconciliation-or-throw: the register generator asserts its derived count against versions.txt before writing, so a missed callsite fails loudly instead of producing a plausible artifact"
  - "Published exclusions: every raw grep match that did not become a row is listed with the reason it was excluded, which is what makes request_correlation_callsite_count = 0 falsifiable"
  - "Positive controls in a defect register: FO-04 (the fail-closed cron route) and the next.config.js headers are recorded so a reader can tell whether the codebase knows what correct looks like"

requirements-completed: [AUDIT-07, AUDIT-09, AUDIT-10, AUDIT-14]

# Metrics
duration: 21min
completed: 2026-09-14
status: complete
---

# Phase 1 Plan 07: Static Authorization Slice Summary

**Three authorization registers plus the observability baseline: 25 service-role callsites judged against four questions each (1 unjustified — an unauthenticated RLS-bypassing read in a page component's generateMetadata), the single getSession callsite proved non-gating against a stale March claim of two, four env-conditional authorization checks where the phase's own detector found one, and five reproducible integers that explain why none of it is currently visible in production.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-14T14:48:54-04:00
- **Completed:** 2026-09-14T15:09:00-04:00
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- **AUDIT-07 — every place the RLS-bypassing client is constructed is now visible, with a judgment.** 25 callsites: 22 route handlers derived from `endpoints.json`'s `uses_service_client` signal, plus the page component, `src/lib/audit.ts` and the factory module. Each row answers all four justification questions as a reasoned sentence with line numbers, carries a verdict, and cites the check that runs (or does not) before construction. 10 justified, 14 needs-decision, 1 unjustified.
- **The headline finding candidate.** `src/app/users/[id]/page.tsx:35` — `generateMetadata()` constructs the service-role client with **no authentication of any kind** and passes an attacker-supplied path parameter straight to `.eq("id", id)`. The page body's `getUser()` at line 56 does not help: its only branch redirects a self-view, so an anonymous request still reaches the second construction at line 63. `pages.json` records `effective_protection: "auth"` for this route, which overstates the guard — flagged for plan 01-11.
- **A named blind spot in the detection signal itself.** `/api/admin/calculate-popularity` builds its own service-role client inline (`createAdminClient()`, lines 15-29) instead of using the factory, so `signals.uses_service_client` is `false` for it. It is a 26th construction site the register's contract cannot contain; recorded as a coverage caveat with the fix (`import "server-only"` on the factory plus a lint rule banning direct key reads elsewhere).
- **AUDIT-09 — a negative confirmed with evidence.** Exactly one `getSession()` callsite exists repo-wide (`src/app/api/health/route.ts:160`). It is non-gating, and the *reason* is specific: the `data` binding is destructured and never referenced again, so a forged cookie changes nothing. Recorded why `getUser()` would be the **wrong** fix here (it errors for anonymous callers on a route that is anonymous by design). `.planning/codebase/CONCERNS.md` (2026-03-05) is named as the stale source for the plural claim, with the analytics route's `verifyAdmin()` remediation as the correction.
- **AUDIT-10 — four fail-open shapes, where the specified detector finds one.** FO-01 `/api/admin/calculate-popularity` GET+POST (`ADMIN_API_KEY`, **Critical**, anonymous, service-role, no compensating control); FO-02 `/api/cron/send-reminders` (`CRON_SECRET`, **High**, guessable-open against `Bearer undefined`); FO-03 `src/middleware.ts:10-16` (the entire auth ring is env-conditional, **Medium**); FO-05 `/auth/callback` `ADMIN_EMAILS` role grant (fails closed, **Low**, registered so a future edit to line 22 is recognised as privilege-escalation). FO-04 `/api/cron/send-feedback-requests` is registered as the fail-closed positive control and named as FO-02's fix.
- **AUDIT-14 — the observability baseline, as five reproducible integers.** 22 of 94 route files have no error handling; 22 files leak internal error text across 40 sites; 5 `catch (error: any)` clauses, all in `/api/health`; 162 `console.*` calls across 60 files with no logger in `package.json`; **0** request-correlation callsites, with all 12 raw grep matches published as explicit exclusions.
- **Nothing in `src/` changed.** Asserted after every task by `git diff --exit-code -- src/` and `readonly-guard.sh`; `git diff --stat` for the whole run touches `.planning/` only.

## Task Commits

1. **Task 1: Register every service-role callsite with its four justification answers** — `7f39826` (feat)
2. **Task 2: Classify every session-reading call and every env-var-conditional authorization check** — `d872313` (feat)
3. **Task 3: Quantify error handling and observability** — `62789e4` (feat)

**Plan metadata:** see the final `docs(01-07)` commit.

## Files Created/Modified

- `.planning/audit/authz/service-role-register.json` — 25 rows; `file`, `route`, `id`, `kind`, `construction_lines`, the four justification answers, `verdict`, `notes`
- `.planning/audit/authz/service-role-register.md` — generated table + per-callsite detail, with the coverage caveat, the finding-candidate table and the open questions blocked on plan 01-09
- `.planning/audit/authz/getsession-register.md` — the one callsite, its safety reason, the published exclusions, and the stale-documentation correction
- `.planning/audit/authz/fail-open-register.md` — FO-01…FO-05 and FP-01 with line ranges, reachable routes, failure modes, RLS-bypass flags and proposed severities; a method finding on detector coverage
- `.planning/audit/quality/error-observability.md` — the five integers with derivations, per-file lists, the set-overlap computation, the middleware fail-open record and the security-header positive control
- `.planning/audit/tools/validate.mjs` — `NON_ROUTE_SERVICE_CLIENT_CALLSITES` 2 → 3 with the reconciliation history in the comment, plus a new `callsite-count-agrees-with-baseline` assertion

## Decisions Made

- **The register includes the factory module, so it is 25 rows and not 24.** The must-have is that a reviewer can see *every place the client is constructed*, and the factory is where it is literally constructed. `baseline/versions.txt` agrees (`service_client_file_count=25`, whose own comment says it "includes the definition module itself").
- **Verdicts are graded against a published rubric** so `needs-decision` is not read as a softer `unjustified`. It marks rows where the missing input is a policy fact or a product decision — 5 of the 14 are blocked specifically on `rls/pg_policies.json` from plan 01-09.
- **The four answers are sentences, not booleans.** The validator only requires non-null; a bare `true` would satisfy it while recording nothing a reviewer could act on.
- **FP-01 is registered rather than deleted.** `validate.mjs --check authz-registers` requires every `env_gated_auth` route to appear, and a documented false positive is what stops the next reviewer re-investigating `/api/admin/events:55`. The signal correction is assigned to plan 01-11: `env_gated_auth` should be `detector match AND env_vars_referenced is non-empty`.
- **`routes_leaking_internal_error_text` excludes `console.*` and `throw` sinks** — logging an internal message server-side is correct; only the response body crosses the anonymous trust boundary. The scan is published verbatim so the 22 is re-derivable.
- **Two app-generated validation messages were qualified rather than silently counted.** `events/[id]:290` and `events/create:78` return this codebase's own date-validator text at 400; both files stay in the count because each also has a genuine Supabase leak at 500.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's own acceptance criteria were mutually unsatisfiable against `validate.mjs`**

- **Found during:** Task 1
- **Issue:** The plan requires the register to be 25 rows (22 route handlers + the page + `lib/audit.ts` + the factory) **and** requires `node .planning/audit/tools/validate.mjs --check service-role` to exit 0. The check computed `22 + NON_ROUTE_SERVICE_CLIENT_CALLSITES`, and that constant was seeded as `2` in plan 01-01 — following `01-RESEARCH.md` § Validation Architecture Test Map, which names only the page and `lib/audit.ts` — giving 24. Writing 25 rows failed the validator; writing 24 failed the plan. The constant also contradicted `validate.mjs`'s own stated design rule that no numeric count literal belongs in the file and that `baseline/versions.txt` is the only count source: that file records `service_client_file_count=25` with a comment stating it includes the definition module.
- **Fix:** Changed the constant to `3` with the full reconciliation history in the comment, and added a second assertion, `callsite-count-agrees-with-baseline`, that cross-checks the derived count against `versions.txt` — so the number is now derived and a future factory-less callsite fails the check loudly instead of silently.
- **Files modified:** `.planning/audit/tools/validate.mjs`
- **Verification:** `--check service-role` 3/3 PASS; `--selftest` 10/10 PASS; `--quick` shows no new failures (the 3 remaining failures are the pre-existing staging/local schema dumps from plan 01-06 and the endpoints classification owned by plan 01-11).
- **Committed in:** `7f39826` (Task 1 commit)

**2. [Rule 2 - Missing Critical] The generated `.md` needed two extra sections the plan did not ask for**

- **Found during:** Task 1
- **Issue:** The plan's must-have is that a reviewer can see **every** place the RLS-bypassing client is constructed. Deriving the row set from `signals.uses_service_client` — which the plan mandates, correctly — silently excludes any handler that builds the client without the factory, and one does: `/api/admin/calculate-popularity` (`createAdminClient()`, lines 15-29). A register that satisfied its own contract while omitting a service-role construction site would have been quietly wrong.
- **Fix:** Added § 4 "Coverage caveat" naming the 26th construction site, the `git grep` that finds it, why it is deliberately not a JSON row (it would break the cross-reference check), and where it *is* registered in full (`fail-open-register.md` FO-01). Filed the factory-shaped blind spot as its own finding for plan 01-13.
- **Files modified:** `.planning/audit/authz/service-role-register.md`
- **Verification:** `--check service-role` still passes at 25 rows; the caveat is prose, not a row.
- **Committed in:** `7f39826` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Two fail-open rows the specified detector cannot find**

- **Found during:** Task 2
- **Issue:** The plan supplies one generalized detector (`if\s*\(\s*[A-Za-z_]\w*\s*&&\s*[^)]*!==`). It finds FO-01 and one false positive, and nothing else. It cannot find `src/middleware.ts:10-16`, where the values are bound to locals first and the operator is `||` over negations — a branch that drops the **entire authentication ring** for every matched route — and it cannot find the `ADMIN_EMAILS` role grant at `/auth/callback`, where the env read is the whole condition. Shipping a register that listed only what one regex finds would have asserted a complete population that is not.
- **Fix:** Ran three further detectors (interpolated-env comparison, any env read inside a conditional across `src/app/api` + `src/middleware.ts` + `src/app/auth`, and a direct read of the middleware's shape), registered FO-03 and FO-05, and added § 4 "Method finding — the specified detector under-reports" so the coverage limit is itself a Low finding for plan 01-13 rather than an undocumented judgment call.
- **Files modified:** `.planning/audit/authz/fail-open-register.md`
- **Verification:** `--check authz-registers` 4/4 PASS; all four detector commands are published in § 1 with their outputs.
- **Committed in:** `d872313` (Task 2 commit)

**4. [Rule 1 - Bug] An optional-chaining gap in the error-leak scan under-reported by one file**

- **Found during:** Task 3
- **Issue:** The first scan's regex ended `(\?\.)?\.message`, which requires a literal `.` after an optional `?.` — so `error?.message` (i.e. `"error" + "?." + "message"`) never matched. `src/app/api/auth-debug/route.ts:39` was silently missing from the count.
- **Fix:** Corrected to `\??\.message`; the count moved from 21 to 22 files / 40 lines. The corrected scan is what is published in the artifact, so the number and the command agree.
- **Files modified:** `.planning/audit/quality/error-observability.md`
- **Verification:** Re-ran the published scan — `FILES: 22 LINES: 40`; the `routes_leaking_internal_error_text` key parses as `22` under the validator's own `integerFor` regex.
- **Committed in:** `62789e4` (Task 3 commit)

**5. [Rule 1 - Bug] A quoted line number in the getSession register was wrong**

- **Found during:** Task 2
- **Issue:** The correction table initially claimed `src/app/api/recommendations/analytics/route.ts:19` is the 403 return. Line 19 is the closing brace; `verifyAdmin()` is line 16 and the 403 is line 18. An audit that corrects a stale document with a wrong line number forfeits the correction.
- **Fix:** Verified against source with `sed -n '14,20p'` and restated as "`verifyAdmin()` at line 16, `if (!isAdmin)` at line 17, 403 at line 18".
- **Files modified:** `.planning/audit/authz/getsession-register.md`
- **Verification:** `sed -n '14,20p' src/app/api/recommendations/analytics/route.ts`
- **Committed in:** `d872313` (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (1 blocking, 2 missing critical, 2 bugs)
**Impact on plan:** No scope creep — every deviation served a must-have the plan already states. Deviation 1 is the only one that touched a file outside this plan's `files_modified`, and it touched a `.planning/` validator, not `src/`. Deviations 2 and 3 are the substantive ones: both closed a gap where an artifact would have satisfied its mechanical contract while being materially incomplete.

## Issues Encountered

- **`grep` in this shell is a ugrep shim that honours `.gitignore`.** Every count that this plan relies on was taken with `command grep`, `git grep` or a Node scan, and the exact command is recorded beside each number in the artifacts. Flagged in the console-count section so a future re-derivation on a differently-ignored checkout is reproducible.
- **`/api/admin/events` is flagged `env_gated_auth: true` and is not env-gated.** The detector matched `if (status && status !== "all")` at line 55 — a query-string filter. The route's real gate is `verifyAdmin()` at line 23, and its `env_vars_referenced` is empty, which is the field that settles it. Registered as FP-01 with the signal correction assigned to plan 01-11.
- **The service-role register's open questions are genuinely blocked, not deferred out of convenience.** 5 of the 14 `needs-decision` rows turn on whether a self-update or owner-visibility RLS policy exists; `rls/pg_policies.json` does not exist yet (plan 01-09). Recorded as an explicit table in § 6 of the register rather than resolved by guesswork.
- **`security/client-bundle-sweep.md` carries `ENVSTATE: INCONCLUSIVE-key-absent-from-build-env`.** Its zero hits therefore prove the key was absent from that build, not that it would not be inlined by a build that had it. Every `reachable_from_client_bundle` answer in the register states this, and the page-component row is recorded as UNRESOLVED rather than clean.
- **Three `validate.mjs --quick` checks still fail, none of them this plan's.** `schema-snapshots` on staging and local (plan 01-06, documented as blocked by the repository's own migration history) and `endpoints :: no-residual-placeholders` (the classification pass, owned by plan 01-11).

## Requirements

All four clauses were checked against the artifacts on disk before marking:

| requirement | clause | satisfied by |
|---|---|---|
| AUDIT-07 | every `createServiceClient()` callsite registered with a per-callsite answer to all four questions | `service-role-register.json` — 25 rows, all four non-null, verified by the validator and by the plan's own node one-liners |
| AUDIT-09 | every `getSession()` call classified gating or non-gating, annotated why safe | `getsession-register.md` — one callsite, non-gating, with the written reason and the published exclusions |
| AUDIT-10 | every env-conditional authorization check listed with its reachable route | `fail-open-register.md` — FO-01…FO-05 and FP-01, each with file, line range, variable, reachable route, failure mode, RLS-bypass flag and severity |
| AUDIT-14 | assessment quantifies all five measures | `error-observability.md` — 22 / 22 / 5 / 162 / 0, each with its derivation |

Marked complete: **AUDIT-07, AUDIT-09, AUDIT-10, AUDIT-14**. None withheld.

## User Setup Required

None — this plan runs only `git grep`, `command grep`, Node scans over existing JSON, and file writes under `.planning/`. No package manager was invoked and no credential was read.

## Next Phase Readiness

**Ready:**
- **Plan 01-09 (RLS)** has a concrete work list rather than a general sweep: § 6 of the service-role register names the exact policy questions that would convert 5 `needs-decision` rows to `justified` or `unjustified` — a self-update policy on `users`, owner-visibility of rejected/suspended `clubs` and `events`, and the readability of `users` for the suggestions scan.
- **Plan 01-11 (classification)** has two concrete corrections: the `env_gated_auth` signal definition (FP-01) and the `effective_protection` value for `/users/[id]`, which reads `auth` on the strength of a `getUser()` that has no unauthenticated branch.
- **Plan 01-13 (findings)** can file directly from the three summary tables — 6 candidates from the fail-open register, 15 non-justified rows from the service-role register, and 6 from the observability assessment — each already carrying file paths, line numbers, a severity proposal and an exposure rationale.
- **Stage 3 REFAC-20** has its baseline as five integers plus the success condition stated in the artifact.

**Concerns carried forward:**
- **FO-01 is Critical and is not new.** `.planning/codebase/CONCERNS.md` documented it on 2026-03-05, citing the same lines. It has survived six months. Per `SEVERITY_SLA.md`, no Critical may remain Open when Phase 5 starts.
- **The page-component client-bundle question cannot be closed by this phase.** It needs a sweep re-run with `ENVSTATE: real-secrets-present`. Until then `src/app/users/[id]/page.tsx` carries an unresolved reachability answer alongside a confirmed unauthenticated service-role read.
- **Four stale-documentation corrections now exist across two plans** (the plural `getSession` claim, the analytics-authorization claim, the console census, and the three in `versions.txt`). Plan 01-13 should file one grouped finding rather than seven.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 6 created files exist on disk; all 4 commits (`7f39826`, `d872313`, `62789e4`, `9b320b0`) are present in `git log`. `validate.mjs --check service-role|authz-registers|observability` all exit 0; `git diff --exit-code -- src/` is clean; `readonly-guard.sh` exits 0. The 5 untracked paths (`.agents/`, `.mcp.json`, `docs/product-master-plan.md`, `skills-lock.json`, `.planning/research/.cache/`) are not this plan's and were neither staged nor removed.
