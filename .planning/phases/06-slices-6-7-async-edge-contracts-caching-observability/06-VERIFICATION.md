---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
verified: 2026-09-27T00:00:00Z
status: gaps_found
score: 6/8 requirements verified (2 requirements PARTIAL, with named residue confirmed independently)
behavior_unverified: 0
overrides_applied: 0
re_verification: null
gaps:
  - truth: "Every handler validates input with a zod schema and returns a consistent 400 shape on malformed input (REFAC-15, ROADMAP Success Criterion 2)"
    status: partial
    reason: "Every Next.js route handler (89/89) is on a zod contract and answers a consistent 400 shape (confirmed live: `node scripts/check-contracts.mjs` -> committed=0 live=0). The events-webhook Supabase Edge Function, which the project's own REQUIREMENTS.md traceability explicitly folds into this requirement, still answers 500 Internal server error to three malformed payload shapes on purpose: a JSON `null` body, a `null` element inside `events`, and a non-string tag. This is not a deployment-only gap — the handler code itself (`supabase/functions/_shared/webhook-handler.ts`) has not been changed to reject these shapes with 400; the test file says outright 'PRESERVED, ON PURPOSE ... Turning them into 400s is the webhook's share of F-094 and is not a change this plan makes.'"
    artifacts:
      - path: "supabase/functions/_shared/webhook-handler.ts"
        issue: "Still answers 500 to a JSON null payload, a null array element, and a non-string tag instead of a 400 shape"
      - path: "src/__tests__/webhook/webhook-handler.test.ts"
        issue: "Rows 7, 11, 12 explicitly pin the 500 behavior as PRESERVED, confirming the gap is intentional and unresolved, not a stale test"
    missing:
      - "A code change to supabase/functions/_shared/webhook-handler.ts (and/or its Deno adapter) that validates the payload shape before the null-dereference/type-coercion path and returns webhookPayloadError-style 400s for these three shapes, with the PRESERVE rows in webhook-handler.test.ts moved to DEFECT/asserted-400 rows and a ledger entry (per this project's own DI-83 tracking, already registered and scheduled for closure alongside the CI redeploy in Phase 8)"
deferred:
  - truth: "A deliberately triggered error appears in Sentry carrying the correlation id, with source maps uploaded (REFAC-21, ROADMAP Success Criterion 4)"
    addressed_in: "Phase 8"
    evidence: "Phase 8 Success Criterion 4: 'A deliberately triggered error and a downtime condition each produce an alert a human observes receiving with the Sentry event and correlation id retrievable...' — this is the literal closure of REFAC-21's two open clauses (live Sentry event, source-map upload), both of which require a human to create a Sentry project and set SENTRY_DSN/SENTRY_AUTH_TOKEN, an action no code-executing agent in this environment can take. Tracked as DI-81 and listed as a named Phase 8 deploy prerequisite in evidence/PHASE-6-COMPLETION.md § 8."
  - truth: "The cross-user cache regression test passes against Vercel's real CDN, not just a local stand-in (F-025's own validation criterion, related to REFAC-19)"
    addressed_in: "Phase 8"
    evidence: "findings.json F-025 status: Open, closes_in_phase: \"08\", resolution text: 'every repository clause is met; the real-CDN re-run is the owner's (DI-81)'. Phase 8 Success Criterion 2 is where staging/production configuration and behavior gets diffed and confirmed against a real deployed environment. The requirement text REFAC-19 asks for 'a cross-user cache regression test passes', which is independently confirmed passing (23/23 in e2e/specs/cross-user-cache.spec.ts) — the real-CDN run is a stricter, additional check tracked separately as F-025, not a literal clause of REFAC-19."
human_verification:
  - test: "Set SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN/SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT in Vercel, deploy, trigger an error through a wrapped route, and confirm the resulting Sentry event's `tags.request_id` equals the response's `x-request-id` header, with the stack trace resolving through uploaded source maps"
    expected: "A real Sentry event appears in the project's issue stream, carrying the same request id as the HTTP response, with a de-minified stack trace"
    why_human: "Requires creating/owning a Sentry project and setting production secrets — no agent in this sandbox has or should have those credentials; this task explicitly bars touching production"
  - test: "Run the two-session CDN probe against a real Vercel preview/production deployment: `bash .planning/audit/tools/cache-probe.sh` with PROD_HOST, COOKIE_A, COOKIE_B set, then `node .planning/audit/tools/gen-cache-matrix.mjs`"
    expected: "Positive control HITs; no personalized route returns x-vercel-cache HIT or STALE for session B after session A populated it"
    why_human: "Requires a live Vercel deployment and two real authenticated sessions; cannot be run against the local stack, and this task explicitly forbids touching production"
  - test: "Redeploy the events-webhook Supabase Edge Function from CI with WEBHOOK_SECRET confirmed, and independently confirm the live function's behavior after the DI-83 code fix lands"
    expected: "The deployed function answers 400 (not 500) to the three malformed payload shapes, matching the fixed local test suite"
    why_human: "Requires CI/CD deploy access to the Supabase project, which this environment does not have and this task explicitly forbids exercising"
---

# Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability Verification Report

**Phase Goal:** The asynchronous edge is credentialed and characterized, every handler validates its input, personalized responses stop being shareable by the CDN, and a failure in production becomes visible — closing Stage 3 with the behavior it started with.
**Verified:** 2026-09-27
**Status:** gaps_found
**Re-verification:** No — initial verification

## M0 follow-up — 2026-09-27

The report/frontmatter below records the original Phase 6 verification, not the current M0 tree. M0 corrects DI-83 locally: all three malformed payloads return 400 before any insert; shared Jest, 3 Deno handler tests and 19 real local Edge tests pass. The seven review warnings also have local repairs and regression evidence. See the [M0 report](../../milestones/m0/REPORT.md) for the final local results, remaining requirement gaps and unchanged external gates. This follow-up does not claim remote Edge deployment, Sentry receipt, CDN isolation or full foundation certification; historical findings below remain provenance.

## Method

This report does not restate `evidence/PHASE-6-COMPLETION.md`'s claims. Every load-bearing claim below was
independently re-checked against the live tree at `main` @ `3fc6aa5` (HEAD; documentation-only commits after
the phase's last code commit `f4c59e4`): reading source files, running the project's own census/check scripts,
running one named Jest test per behavior-dependent claim (never the full suite, per this task's instructions
and the recorded evidence in `evidence/floor.phase-after.txt`), diffing `git show` against cited commit hashes,
and cross-referencing `.planning/REQUIREMENTS.md` / `.planning/audit/findings.json` against the phase's own
completion note. No Playwright run, no database reset, and no production/Sentry/Vercel action was taken, per
this task's working rules.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cron and webhook routes require credentials and fail closed when absent; recommendation API surface characterized input → ranked output, formula unchanged | ✓ VERIFIED | `src/app/api/cron/` does not exist (`find` returns nothing); `vercel.json` has no `crons` key; `src/__tests__/webhook/webhook-handler.test.ts` passes live (330 tests, 0 failed) and asserts 401 on bad/missing/wrong-length signatures and `duplicate` on replay; `pgTAP` row pinning `md5(prosrc)` of `compute_user_scores()` is unedited by this phase except `SET search_path`/`REVOKE` per `evidence/schema-push-slice-6.txt` |
| 2 | Every handler validates input with a zod schema from `src/contracts/` and returns a consistent 400 shape on malformed input; schemas exported and reused by client hooks | ✗ PARTIAL | `node scripts/check-contracts.mjs` → `committed=0 live=0` (verified live, all 89 route files); `node scripts/check-contracts.mjs --client` → `client files=38 violations=0` (verified live). **Not met:** the events-webhook edge function still answers 500 (not 400) to a JSON null body, a null array element, and a non-string tag — confirmed by running `src/__tests__/webhook/webhook-handler.test.ts` live and reading rows 7/11/12, which assert `toBe(500)` on purpose |
| 3 | The blanket `s-maxage=60` is gone from `vercel.json`, personalized routes return `private, no-store`, public routes opt in explicitly, a cross-user cache regression test passes | ✓ VERIFIED (locally) | `vercel.json` read directly: no `headers` key, only `buildCommand`/`framework`/`regions`. `node scripts/check-contracts.mjs`-equivalent cache census: `src/__tests__/api/cache-headers-census.test.ts` passes live (part of the 330-test run above). `e2e/specs/cross-user-cache.spec.ts` recorded passing 23/23 in `evidence/playwright.phase-after.txt` (read, not re-run per task instructions) through a documented Vercel-rules stand-in proxy, not the real CDN — the real-CDN run is F-025's own open criterion (see Deferred) |
| 4 | Server emits structured JSON logs with levels and a correlation id on Node and middleware; a deliberately triggered error appears in Sentry with that id (Turbopack-aware, source maps, env/release tags, PII scrubbing decided pre-install); `/api/health` reports DB/auth/storage/pg_cron/webhook in a documented shape without `getSession()` | ✗ PARTIAL | `src/server/log.ts`, `src/proxy.ts` (`runWithRequest`), `src/server/route.ts` (`runWithRequest`, `applyCachePolicy`) confirmed wired by direct grep. `src/server/__tests__/sentry.test.ts`, `src/__tests__/api/health/health.test.ts`, `src/server/__tests__/getsession-gate.test.ts` all run live and pass (49/49 tests). `docs/health.md` and `src/contracts/health.ts` exist and match. **Not met:** no Sentry project/DSN exists, so no live event has ever reached Sentry, and no source map has ever been uploaded (`SENTRY_AUTH_TOKEN` absent) — both require owner/production action this environment cannot take |
| 5 | After the final slice the Playwright happy-path specs pass and every Validated workflow in PROJECT.md is re-confirmed; each slice lands as one reviewable change naming finding IDs; intentional behavior changes logged | ✓ VERIFIED | `evidence/playwright.phase-after.txt` read directly: 269 passed, 0 failed, CSP enforced (`bypassCSP: false`), two halves, first run each. `.planning/PROJECT.md` "Validated" section lists exactly 16 rows, matching `evidence/PHASE-6-COMPLETION.md` § 4's 16-row table verbatim. All cited commit hashes (`ffd973e`, `239b7cd`, `edb5eef`, `e2771b7`, `54da7b5`, `6221669`, `64939b2`, `83e2f7e`, `eaed119`, `848034e`, `747ef77`, `00aa06d`, `b8e20f4`, `f4c59e4`, `d790b21`) resolve with `git cat-file -e` |

**Score:** 3/5 success criteria fully VERIFIED, 2/5 PARTIAL (SC2 on a genuine unfixed code path; SC4 on an owner/production-only action)

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| REFAC-14 | Cron/webhook credentialed and fail closed; recommendations characterized | ✓ VERIFIED (Complete) | Cron routes deleted (confirmed absent); webhook HMAC/replay tests pass live; recommendations characterization test and pgTAP md5 pin exist and are unedited by the phase except the documented `SET search_path`/`REVOKE` |
| REFAC-15 | Every handler validates input with a zod schema; consistent 400 shape; schemas in `src/contracts/` | ✗ PARTIAL (confirmed, not just restated) | `src/contracts/` has 10 modules + `webhook.ts` (confirmed via `ls`); contracts census 0/0 (confirmed live); **the webhook edge function's three malformed-payload 500s are a real, unfixed gap**, confirmed by reading and running `webhook-handler.test.ts` |
| REFAC-16 | zod contracts exported and reused by client hooks | ✓ VERIFIED (Complete) | 9 of 10 hook files import from `@/contracts` (confirmed via grep); `--client` census reports `violations=0` live |
| REFAC-19 | Blanket cache removed; personalized `private, no-store`; public opt-in; cross-user test passes | ✓ VERIFIED (Complete) | `vercel.json` confirmed to have no `headers` rule; 89/89 route files on `withRoute` (confirmed via grep count); cross-user test recorded passing (not re-run, per instructions) |
| REFAC-20 | Structured JSON logger with levels and correlation id, replacing `console.*`, on Node and middleware | ✓ VERIFIED (Complete) | `src/server/log.ts` exists and is wired into `src/proxy.ts` and `src/server/route.ts` (confirmed via grep); `node scripts/check-server-console.mjs` → `committed=2 live=2` PASS, run live; the two allowed entries (`src/lib/tagMapping.ts`, a client-shared module, and the auth callback's redirect text) are outside server-only scope, confirmed by reading both files |
| REFAC-21 | Sentry installed (Turbopack-aware, source maps, env/release tags, PII scrubbing pre-install); live error with correlation id | ✗ PARTIAL (confirmed) | `@sentry/nextjs@10.75.3` exact in `package.json` (confirmed); `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/sentry.server.config.ts` all exist; `sentry.test.ts` passes live proving the correlation-id tag through a mocked transport. **No Sentry project exists and no source map has been uploaded** — both require a human with Sentry/Vercel credentials this environment does not have |
| REFAC-22 | `/api/health` checks DB/auth/storage/pg_cron/webhook, documented shape, no `getSession()` for access control | ✓ VERIFIED (Complete) | `src/contracts/health.ts`, `docs/health.md` exist and match; `health.test.ts` and `getsession-gate.test.ts` pass live; census confirms 0 non-test `getSession(` calls (spot-checked via the passing gate test) |
| REFAC-23 | Playwright happy-path specs pass after each slice; Validated workflow list re-confirmed | ✓ VERIFIED (Complete) | `evidence/playwright.phase-after.txt` (269/0) and `evidence/playwright.slice-6-after.txt` (100/0) read directly; `.planning/PROJECT.md`'s 16 Validated rows match the phase's own re-confirmation table |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Phase 6 row set (REFAC-14, 15, 16, 19, 20, 21, 22, 23)
matches exactly the union of `requirements:` frontmatter across all 18 plans.

### Required Artifacts (spot-checked, not exhaustive — 18 plans, ~90 files modified)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `vercel.json` | No `headers`/`s-maxage` rule | ✓ VERIFIED | Read directly: `{buildCommand, framework, regions}` only |
| `src/app/api/cron/*` | Deleted | ✓ VERIFIED | Directory does not exist |
| `src/contracts/*.ts` (10 modules + webhook.ts) | Zod schemas per domain | ✓ VERIFIED | `ls` confirms all 11 files present |
| `scripts/check-contracts.mjs` | Census gate, empty allow-list | ✓ VERIFIED, WIRED | Runs live: `committed=0 live=0`; `--client` `violations=0` |
| `scripts/check-server-console.mjs` | Console census | ✓ VERIFIED, WIRED | Runs live: `committed=2 live=2` PASS |
| `src/server/log.ts` | JSON logger, `runWithRequest`, `currentRequestId` | ✓ VERIFIED, WIRED | Imported and used in `src/proxy.ts` and `src/server/route.ts` (grep-confirmed) |
| `src/server/route.ts` | `withRoute` wrapper applying cache policy | ✓ VERIFIED, WIRED | 89/89 route files call `withRoute(` (grep count matches route file count) |
| `src/contracts/health.ts`, `docs/health.md` | Health contract + docs | ✓ VERIFIED | Exist; `health.test.ts` passes live |
| `src/server/observability/sentry.ts`, `src/sentry.server.config.ts`, `src/instrumentation*.ts` | Sentry wiring | ✓ VERIFIED, WIRED (up to mocked-transport proof) | Exist; `sentry.test.ts` passes live proving correlation-id tagging through the SDK's own transport — no live Sentry backend involved (correctly disclosed) |
| `supabase/functions/_shared/webhook-handler.ts` | 400 on every malformed shape | ⚠️ STUB (partial) — 3 of the family's malformed shapes still 500 | Read directly and confirmed via the passing (but intentionally-permissive) `webhook-handler.test.ts` rows 7/11/12 |

### Data-Flow Trace (Level 4)

Not applicable in the traditional sense — this phase's artifacts are server-side validation/caching/logging
infrastructure, not UI components rendering fetched data. The closest analogue (recommendation route → scoring
function) was already characterized pre-phase and pinned by `md5(prosrc)`; no new data-flow path was introduced.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/proxy.ts` | `src/server/log.ts` | `runWithRequest(...)` | ✓ WIRED | Grep-confirmed both call sites |
| `src/server/route.ts` | `src/server/http.ts` | `applyCachePolicy(response, opts.cache, method)` | ✓ WIRED | Grep-confirmed, used inside `runWithRequest` callback |
| `src/hooks/*.ts` | `src/contracts/*.ts` | typed request/response contracts | ✓ WIRED | 9/10 hooks import from `@/contracts`; `--client` census confirms `violations=0` |
| `src/app/api/health/route.ts` | `src/contracts/health.ts` | shared response shape | ✓ WIRED | `health.test.ts` passes live against the contract |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Contracts census is empty (REFAC-15/16) | `node scripts/check-contracts.mjs` / `--client` | `committed=0 live=0`; `client files=38 violations=0` | ✓ PASS |
| Server console census is at its allow-list (REFAC-20) | `node scripts/check-server-console.mjs` | `committed=2 live=2` PASS | ✓ PASS |
| Webhook malformed-payload behavior (REFAC-15 gap) | `npx jest --ci src/__tests__/webhook/webhook-handler.test.ts` | 330 passed (suite includes other tests); rows 7/11/12 assert `toBe(500)` | ✓ PASS (confirms the gap is real and intentional, not a false claim) |
| Cache-headers census (REFAC-19) | `npx jest --ci src/__tests__/api/cache-headers-census.test.ts` | passed | ✓ PASS |
| `vercel.json` no longer carries the blanket rule (REFAC-19) | `npx jest --ci src/__tests__/config/vercel-json-defect.test.ts` | passed | ✓ PASS |
| Sentry correlation-id tagging through mocked transport (REFAC-21) | `npx jest --ci src/server/__tests__/sentry.test.ts` | passed | ✓ PASS (proves the code path; does not and cannot prove a live Sentry event) |
| `/api/health` documented shape (REFAC-22) | `npx jest --ci src/__tests__/api/health/health.test.ts` | passed | ✓ PASS |
| No non-test `getSession()` (REFAC-22) | `npx jest --ci src/server/__tests__/getsession-gate.test.ts` | passed | ✓ PASS |
| `npm audit --audit-level=high --omit=dev` | run live | 0 critical, 0 high, 2 moderate, 1 low — exit 0 | ✓ PASS, matches recorded evidence |
| Citation integrity of `evidence/PHASE-6-COMPLETION.md` | the note's own § 12 command, re-run live | `distinct=87 missing=0` | ✓ PASS |

No Playwright run and no `supabase db reset` were performed, per this task's explicit working rules; the
recorded `evidence/playwright.phase-after.txt` (269 passed, 0 failed) was read and cross-checked against
`evidence/PHASE-6-COMPLETION.md`'s citations of it instead.

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this project and none is declared by any 06-*-PLAN.md or
06-*-SUMMARY.md. Skipped: no probes to run.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/lib/classifier.ts` | 324 | `location: locationMatch \|\| "TBD"` | ℹ️ Info — false positive | This is a literal fallback **value** for an extracted event's `location` field (pre-existing pipeline design, touched only by an unrelated comment fix in `db839a7`), not a code debt marker or incomplete-work comment. Not a blocker. |

No other `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers were found across the phase's diff
(`git diff --name-only f186621 f4c59e4 -- src supabase`, excluding tests).

### Gaps Summary

One genuine, code-level gap blocks a clean pass: **REFAC-15's webhook residue.** The events-webhook Supabase
Edge Function still answers `500 Internal server error` to three malformed payload shapes (a JSON `null` body,
a `null` element inside `events`, and a non-string tag) instead of the `400` shape every other handler in the
codebase now returns. This is not a stale claim or a hidden regression — the project's own test suite pins the
500s as `PRESERVED, ON PURPOSE` and its own `REQUIREMENTS.md`/`findings.json` (DI-83) already record this as an
open, tracked item scheduled to close in Phase 8 alongside a CI redeploy of the edge function. Independent
verification in this pass confirms the claim is accurate: the code has genuinely not been changed, the test
rows genuinely assert 500, and no fix is pending only on deployment — the handler logic itself needs a small,
local, testable code change (validate the three shapes before the null-dereference/type-coercion path) that
could be done inside a normal GSD closure plan without any production or Sentry access.

Two further items are correctly deferred rather than counted as phase-6 gaps, because they require credentials
and infrastructure genuinely outside any code-executing agent's reach and are explicitly Phase 8's own success
criteria/tracked findings: (1) a live Sentry event with source maps (REFAC-21's two open clauses, DI-81, Phase 8
Success Criterion 4), and (2) the real-Vercel-CDN run of the cross-user cache probe (F-025, Open at "08", Phase
8 Success Criterion 2's operational-certification scope). Both are listed under `deferred` in this report's
frontmatter and under Human Verification, not `gaps`, because no further phase-6 code change would move them —
they need an owner with Sentry/Vercel account access, which this task explicitly forbids exercising.

Everything else independently checked in this pass — the contracts census, the cache census, the console
census, the health endpoint, the logger wiring, the client-contract reuse, the cron deletion, the webhook's
HMAC/replay behavior, the Playwright and Validated-workflow re-confirmation, and every cited commit hash —
matched the phase's own claims exactly, with no discrepancy found beyond the REFAC-15 residue and the two
already-disclosed owner-action items.

### Human Verification Required

See frontmatter `human_verification` above for the three items (Sentry live event + source maps; real-CDN
cross-user probe; webhook CI redeploy). None of them can be exercised inside this environment; all three are
already tracked by name in this project's own findings/decision register (DI-81, DI-83, F-025) and are named
Phase 8 deploy prerequisites in `evidence/PHASE-6-COMPLETION.md` § 8.

---

*Verified: 2026-09-27*
*Verifier: Claude (gsd-verifier)*
