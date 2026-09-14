---
phase: 01-read-only-foundation-audit
plan: 11
subsystem: audit-inventory
tags: [audit, classification, authz, personas, cache, read-only]
requires:
  - .planning/audit/inventory/endpoints.json (01-02 signals)
  - .planning/audit/inventory/pages.json (01-03 signals + ring columns)
  - .planning/audit/quality/dead-code.md (01-05)
  - .planning/audit/authz/service-role-register.json (01-07)
  - .planning/audit/authz/fail-open-register.md (01-07)
  - .planning/audit/rls/rls-review.md (01-09)
  - .planning/audit/async/cron-webhook-inventory.md (01-10)
  - .planning/audit/raw/vercel/env-names.json (01-10)
provides:
  - fully classified endpoints.json (10 verdict fields + 13 persona expectations on 94 rows)
  - fully classified pages.json (effective_protection + dead_or_duplicate on 43 rows)
  - classification-rules.md (the written derivation behind every cell)
  - a re-runnable classifier under .planning/audit/tools/
affects:
  - 01-12 (the personalized row set is the cache probe target)
  - 01-13 (the 14-row divergence queue is the finding intake)
  - CERT-06 (the persona matrix is its data source)
  - REFAC-15, REFAC-19 (input_validation and cache_policy_target are their inputs)
tech-stack:
  added: []
  patterns:
    - "human verdict table + mechanical derivation, so a 1,222-cell matrix is reproducible rather than hand-typed"
    - "merge-by-id writes, so the 01-02/01-03 generators can be re-run without discarding classification"
key-files:
  created:
    - .planning/audit/inventory/classification-rules.md
    - .planning/audit/tools/classify-inventory.mjs
  modified:
    - .planning/audit/inventory/endpoints.json
    - .planning/audit/inventory/endpoints.csv
    - .planning/audit/inventory/pages.json
key-decisions:
  - "expected_status records what a route SHOULD return, never what it returns today; the divergence is the finding"
  - "personalized compares the SUCCESS bodies of two callers both authorized for the route, excluding error bodies"
  - "auth_requirement records the weakest gate any exported method enforces, because that is the route's real exposure"
  - "the aborted run's 33 hand-edited rows were discarded rather than completed, because a hand edit is not re-derivable"
requirements-completed: [AUDIT-03, AUDIT-04]
duration: ~50 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 11: Endpoint and Page Classification Summary

Moved 94 endpoints and 43 pages from machine-derived signals to resolved human verdicts, filled all 1,222 persona-expectation cells from written rules applied by a committed script, and turned the `no-residual-placeholders` gate green for the first time since plan 01-02 seeded it.

| | |
|---|---|
| Tasks | 3 of 3 |
| Commits | 4 (3 task + 1 metadata) |
| Files created | 2 |
| Files modified | 3 |
| Cells filled | 1,222 persona expectations + 940 row-level verdicts |
| Files touched outside `.planning/` | **0** |

---

## 0. The aborted run — what was found and what was done

The orchestrator flagged one uncommitted modification left by a previous executor that an API usage limit terminated mid-plan.

**Inspected.** `git diff --stat .planning/audit/inventory/endpoints.json` showed 122 insertions / 122 deletions. Counting `+ "auth_requirement"` lines gave **33 of 94 rows** partially classified — only the four authorization fields, with `personalized`, `cache_policy_today`, `cache_policy_target`, `input_validation`, `test_present`, `dead_or_duplicate` and all thirteen persona keys still at the `"unknown"` sentinel. The content that was there looked defensible on inspection (it had already spotted that `/api/admin/calculate-popularity` is `machine` rather than `admin`, and that it sits outside the 01-07 register).

**Restored anyway.** `git checkout -- .planning/audit/inventory/endpoints.json`. Not because the 33 rows were wrong, but because a hand edit is not re-derivable: nobody downstream can reproduce it, and nobody can tell which cells came from a rule and which from fatigue. Verifying 33 rows by hand costs the same as re-deriving 94 by rule, and only one of those produces an artifact CERT-06 can defend.

**Replaced with a script.** `.planning/audit/tools/classify-inventory.mjs` carries the human verdict table and the mechanical derivation. Every number in this summary re-runs from the committed inputs. This was also the interruption insurance the plan asked for: the work was committed in three phases, so a second termination could have lost at most one task.

---

## 1. What was classified

### Authorization (all 94 rows)

| `auth_requirement` | rows |
|---|---|
| `authenticated` | 40 |
| `anonymous` | 26 |
| `admin` | 25 |
| `machine` | 3 |

| `rls_reliance` | rows |
|---|---|
| `partial` | 57 |
| `bypassed` | 23 |
| `primary` | 9 |
| `none` | 5 |

`service_role_justified` was **transcribed** from `authz/service-role-register.json` by file key on all 22 service-client rows, never re-decided; a scripted comparison of the two files reports zero mismatches. `/api/admin/calculate-popularity` is the 23rd `bypassed` row and carries an explicit `not-in-register` string, because it builds its client with an inline `createAdminClient()` rather than importing `createServiceClient()` — which is precisely why 01-07's register, keyed on the factory import, could not see it.

### How many rows changed verdict from the machine-derived seed

Every field on every row was at the `"unknown"` sentinel, so strictly all 94 rows changed on all 10 fields. The number that actually means something is **how often the human verdict contradicts what a signals-only derivation would have produced**:

> **19 of 94 rows (20%)** have an `auth_requirement` that a naive reading of `signals` gets wrong.

- **3 rows** a signals-only pass calls `anonymous` and are really `machine` — both `/api/cron/*` and `/api/admin/calculate-popularity`. The signals cannot see a bearer-secret comparison.
- **16 rows** a signals-only pass calls `authenticated` and are really `anonymous`. These are handlers that call `getUser()` and then **never refuse**. `signals.calls_get_user` is true on every one; reading only the signal would have marked sixteen open routes as protected.

That 16-row set is the plan's real yield. It contains `/api/auth-debug`, `/api/health`, `/api/interactions`, `/api/feedback`, and the eight anonymous-tolerant personalized routes below.

### Personalization — the number plan 01-12 needs

> **27 of 94 endpoints are personalized. 25 of those carry the blanket `s-maxage=60, stale-while-revalidate=300` header from `vercel.json`. 8 of those 25 are reachable with no session at all.**
>
> (10 personalized rows are `anonymous` overall; the two that are not in the 8 are `/api/recommendations`, which sets its own `private, no-store`, and `/auth/callback`, which falls outside the `/api/` prefix.)

The `vercel.json` rule's `source` is `/api/(.*)` with no exception for authenticated or personalized routes, and `/api/recommendations` is the only handler in the entire tree that sets `private, no-store` for itself.

The eight anonymous-tolerant personalized GET routes — the ones that answer a signed-in caller with their own data and an anonymous caller with an empty shell, at the same URL, under a shared-cache header:

`/api/auth-debug` · `/api/clubs/[id]/events` · `/api/events/[id]/friends` · `/api/events/[id]/rsvp` · `/api/events/following` · `/api/events/friends-activity` · `/api/events/friends-organizing` · `/api/notifications/count`

### Caching, validation, tests, liveness

- `cache_policy_today` quotes the blanket header verbatim on 91 rows and the handler's own header on 3. The two `/auth/*` rows fall outside the `/api/` prefix and record that explicitly.
- `input_validation`: **77 manual, 17 none, 0 zod** — no schema validator is imported anywhere in `src/`. **Two handlers parse a body and validate nothing**: `/api/admin/events/[id]` and `/api/admin/users/[id]`. The second PATCHes `users`, the table 01-09 recorded a Critical self-escalation hole on.
- `test_present`: **7 of 94**, matched against `baseline/jest-listtests.txt`. `date-validation.test.ts` was deliberately left unmapped — it tests pure functions, not a handler. Read alongside `dead-code.md` row 12 (CI never runs the suites), the figure enforced on every commit is **0**.
- `dead_or_duplicate`: the two `/api/cron/*` handlers, on 01-10's `pg_cron` evidence. knip flagged no handler because it treats every `route.ts` as an entry point and structurally cannot.

### Pages

All 43 carry a resolved `effective_protection` reconciling both rings. **14 are `admin` via a guarded ancestor layout** while `middleware_protected` is false on every one of them — reporting only the middleware ring would have marked the entire moderation subtree unprotected. **One row was flipped**: `users.id`, `auth` → `unprotected_but_should_be` (see § 3, D-11).

---

## 2. The derivation is written down

`.planning/audit/inventory/classification-rules.md` states one rule per persona (R2–R14), the success-code rule (S1), the field rules (A1–A5, P1, C1–C2, V1, T1, D1, G1–G2, D2), and all five hand overrides with their reasons. Three things in it are worth pulling out because they are easy to re-derive wrongly:

1. **The onboarding guard never fires on an endpoint.** `src/middleware.ts` gates on `... && !path.startsWith("/api/") && !path.startsWith("/auth/")`. So `mid_onboarding_student` equals `onboarded_student` on all 94 rows. On pages it is a 307 redirect.
2. **`PROTECTED_ROUTES` never fires on an endpoint either.** All eight entries are page paths. Every 401 in this inventory comes from the handler itself.
3. **The ban ring *does* fire on endpoints.** `BAN_EXEMPT_PATHS` lists only `/banned`, `/auth/signout` and `/auth/callback`, so a banned user calling any API route is intercepted before the handler runs — which is why R10 applies to 92 of 94 rows and not to the twelve handlers that call `checkBanStatus()` themselves.

All three rings sit behind FO-03: `src/middleware.ts:13-16` returns an unauthenticated `NextResponse.next()` when the Supabase env vars are missing, and the whole body is wrapped in a `try/catch` that falls through the same way.

**Five hand overrides**, each recorded with its reason in § 5 of the rules file: four cells keeping `/auth/callback` and `/auth/signout` reachable while banned (a banned user who cannot sign out is trapped in a session they cannot end), and the one page flip. **No route was undecidable from source** — every one of the 94 resolved from the handler body plus the registers.

---

## 3. Queues for plan 01-13

The rules file § 6 carries the full table with evidence paths. Fourteen divergences between what a route should return and what it does.

### Fail-open, live in production (D-1 … D-3)

`raw/vercel/env-names.json` shows only three variables configured in production; neither `ADMIN_API_KEY` nor `CRON_SECRET` is among them, so all three machine rows are broken **now**, not conditionally:

- **D-1 Critical** — `/api/admin/calculate-popularity` returns **200 to an anonymous caller on both GET and POST** and then constructs a service-role client. The gate is `if (expectedKey && ...)`; with the key unset it evaluates false regardless of the header.
- **D-2 High** — `/api/cron/send-reminders` compares against the fixed literal `Bearer undefined`, which anyone can send.
- **D-3** — `/api/cron/send-feedback-requests` returns **500 to every caller**, unconditionally. Fail-closed, and therefore provably dead rather than dormant.

### Systemic status-code defects (D-4, D-5)

- **D-4** — 22 admin handlers answer an anonymous caller with **403 where the contract says 401**. `verifyAdmin()` has no `user == null` branch distinct from the role failure, so the two are indistinguishable to a caller and to any test.
- **D-5** — the ban ring answers a JSON API call with a **307 redirect to an HTML page**, on 92 routes.

### Cache-disclosure surface (D-6 … D-8)

- **D-6** — 8 personalized routes return 200 to anonymous callers with a degraded body and a shared-cache header.
- **D-7** — `/api/auth-debug` **echoes the caller's own id and email with no gate whatsoever**, under the blanket `s-maxage=60`. Anonymous, personalized and shared-cacheable at once.
- **D-8** — `/api/health` returns a full infrastructure health report, including a live auth-configuration probe, to anyone.

### AUDIT-04 findings (D-11 … D-14)

- **D-11** — `/users/[id]` is `unprotected_but_should_be`. Its `page_guard: "getUser"` looked like protection to 01-03; it is not. The `getUser()` at line 56 only redirects a **self**-view to `/profile`, so an anonymous request reaches the service-role read at line 63 selecting `email`, `visibility` and `interest_tags`, filtered on an attacker-supplied path id — and `generateMetadata` at lines 33-48 builds the same RLS-bypassing client with no session read at all. This is the only `unjustified` verdict in the whole service-role register.
- **D-12 — the documented-versus-source drift the plan asked for explicitly.** `CLAUDE.md:50` documents **six** protected routes; `src/middleware.ts:114` has **eight** — it also contains `/settings` and `/friends`. The drift runs in the dangerous direction: an auditor trusting `CLAUDE.md` marks two genuinely protected routes as public. `pages.json` was computed from the source array throughout, never from `CLAUDE.md`.
- **D-13** — a **method** finding. 14 pages are protected by a layout ring invisible to the middleware list, and one page is unprotected despite a guard mechanism being present. The single-ring answer is wrong in both directions.
- **D-14** — `/docs` renders redoc unguarded; `/health` and `/feedback` are public pages fronting D-8.

---

## 4. Verification

All run from the repo root at the final commit.

| Check | Result |
|---|---|
| `validate.mjs --check endpoints` | **5 passed, 0 failed** — including `no-residual-placeholders :: fully classified` |
| `validate.mjs --check pages` | **4 passed, 0 failed** |
| `validate.mjs --quick` | 100 passed, 2 failed, 4 skipped — **the placeholder failure is gone**; the 2 remaining are pre-existing `schema-snapshots` failures on the staging and local dumps, owned by 01-06/01-08 and untouched here |
| 13 persona keys on every row | pass |
| `"unknown"` anywhere in `endpoints.json` / `pages.json` | **0 / 0** |
| `effective_protection` in the schema enum on all 43 | pass |
| layout-guarded pages resolving to `admin` | **14** (criterion: ≥14) |
| `endpoints.csv` | **95 lines**, produced by `gen-endpoints-csv.mjs`, never hand-edited |
| `readonly-guard.sh` | exit 0, after every task |
| `git diff --exit-code -- src/` | clean, after every task |
| files touched outside `.planning/` across all 4 commits | **0** |

**Idempotence proven twice, not assumed.** After the full classification, `gen-endpoint-inventory.mjs` was re-run and the result diffed field-by-field against a pre-run snapshot: all 10 row-level verdict fields **and the complete 13-key persona matrix** survived byte-for-byte on all 94 rows. `gen-page-inventory.mjs` likewise preserved the `users.id` override. The generators merge by `id`, and the classifier does too.

---

## 5. Deviations from Plan

### 1. [Rule 3 — Blocking] Plan enum values contradict the schema files the validator enforces

- **Found during:** Tasks 2 and 3.
- **Issue:** The plan text names `schema` as the third `input_validation` value and `club-role` / `unprotected-but-should-be` (hyphenated) for `effective_protection`. `endpoints.schema.json` says `zod`; `pages.schema.json` says `club_role` / `unprotected_but_should_be` (underscored). `validate.mjs` enforces the schema files, so following the plan's spelling would have produced a hard `schema-valid` failure.
- **Fix:** Used the schema spellings throughout. Recorded in `classification-rules.md` § V1 and § G1 so the next reader does not "correct" it back. No row uses `zod` or `club_role` in any case — no schema validator is imported anywhere in `src/`, and no page is club-role-gated.
- **Commits:** `f01e810`, `d11d859`.

### 2. [Rule 2 — Missing critical] Added a classification script the plan said not to add

- **Found during:** Task 1, driven by the retry brief.
- **Issue:** The plan's "Artifacts this phase produces" section states "No new script is created". That was written for a clean first run. After an interruption that left 33 hand-edited rows, hand-editing the remaining 61 would have produced an artifact nobody can reproduce or defend — and the orchestrator's retry instruction explicitly required the classification be produced "through a committed, re-runnable script so the result is reproducible".
- **Fix:** Added `.planning/audit/tools/classify-inventory.mjs`, declared here and in `classification-rules.md` § 8, alongside the plan's four `files_modified`. It writes only under `.planning/audit/inventory/`. The CSV is still regenerated with 01-02's `gen-endpoints-csv.mjs` and never hand-edited, exactly as the plan requires.
- **Commit:** `98cff2d`.

### 3. [Rule 2 — Missing critical] `pages.json` needed one verdict flipped, not just `dead_or_duplicate` filled

- **Found during:** Task 3.
- **Issue:** `validate.mjs --check pages` was **already passing** before this plan ran — 01-03 had resolved `effective_protection` and `dead_or_duplicate` on all 43 rows. A green check was not evidence of a correct classification: 01-03's own summary warned as much, and 01-07 had recorded that `users.id` was overstated as `auth`.
- **Fix:** Re-asserted the ring-reconciliation rule mechanically (so a regeneration cannot silently weaken a verdict) and applied the one named override. One row changed.
- **Commit:** `d11d859`.

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical). **Impact:** none adverse — deviation 1 prevented a validator failure, deviations 2 and 3 are the difference between an artifact that passes its gate and one that is actually true.

---

## 6. Requirements

| Requirement | Verdict | Reasoning |
|---|---|---|
| **AUDIT-03** | **complete** | Every clause is now satisfied on disk: methods, observed auth requirement, role required, RLS reliance, service-role use, cache headers, personalization, input validation, test present — all resolved on all 94 rows in a machine-readable file, plus the 13-persona matrix CERT-06 consumes. Note this checkbox was already ticked in `REQUIREMENTS.md` before this plan ran; it is only now genuinely earned. |
| **AUDIT-04** | **complete** | All 43 pages carry public/protected (`effective_protection`, reconciling both rings), client/server (`component_type`), data source, auth guard (`middleware_protected` + `layout_guard` + `page_guard`), dead/duplicate, and the cross-check against the middleware protected-route list — computed from the eight-entry source array, with the six-versus-eight documentation drift recorded as finding D-12 rather than silently absorbed. |

No requirement was withheld.

---

## 7. Notes for downstream plans

- **01-12** — your probe set is the 27 personalized rows; start with the 8 anonymous-tolerant ones, because those can be exercised with no session at all, which makes the positive control easy and the finding unambiguous. `/api/recommendations` is the natural **negative** control: it is personalized and already sets `private, no-store`. Remember `raw/prod/exact-counts.json` puts `user_event_scores` at 0 rows, so every recommendation response today is the popularity fallback and two users may legitimately see the same body — probe a notifications or friends route for the disclosure proof instead.
- **01-13** — § 6 of `classification-rules.md` is a ready-made intake of 14 finding candidates with evidence paths. D-1 (anonymous service-role write), D-7 (`/api/auth-debug` identity echo) and D-11 (`/users/[id]` anonymous PII read) are the three that combine an open gate with a real disclosure. D-4 and D-5 are systemic and cheap to fix; D-13 is a method finding worth stating, because the single-ring page answer was wrong in both directions.
- **CERT-06** — `expected_status` is the contract, not a recording of today. Ten cells will fail on a freshly built tree by design (D-1 … D-3, D-6). That is the gate working.
- **Re-running** — `node .planning/audit/tools/classify-inventory.mjs` is idempotent and safe after any generator run. If you change a verdict, change it in the `VERDICTS` table and the matching rule in `classification-rules.md`, never in the JSON.

---

## Self-Check: PASSED

Files claimed created, verified present with `[ -f ]`:

- `.planning/audit/inventory/classification-rules.md` — FOUND
- `.planning/audit/tools/classify-inventory.mjs` — FOUND

Commits claimed, verified with `git log --oneline`:

- `98cff2d` feat(01-11): classify the high-risk authz cohorts via a re-runnable script — FOUND
- `f01e810` feat(01-11): resolve personalization, caching, validation and liveness on all 94 handlers — FOUND
- `d11d859` feat(01-11): write the persona expectation matrix and the page protection verdicts — FOUND

`git diff --name-only 98cff2d~1 HEAD` returns five paths, all under `.planning/`. No file outside `.planning/` was created, modified or deleted.

---

*Phase: 01-read-only-foundation-audit · Plan 11 of 13 · Ready for 01-12*
