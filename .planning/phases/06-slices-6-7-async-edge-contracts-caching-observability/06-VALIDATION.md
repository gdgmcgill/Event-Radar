---
phase: 6
slug: slices-6-7-async-edge-contracts-caching-observability
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-25
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by the planner from 06-RESEARCH.md § Validation Architecture and the 18 PLAN.md files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 (node + jsdom projects), pgTAP via `supabase test db --local` (CLI 2.115.0), Playwright 1.63 persona harness (production build, one worker) |
| **Config file** | `jest.config.js`, `playwright.config.ts`, `supabase/tests/database/` |
| **Quick run command** | `npx jest --ci <changed suite paths>` plus the census script the task touches |
| **Full suite command** | `npx jest --ci && supabase test db --local && npx playwright test && node scripts/check-elevated-ratchet.mjs && node scripts/check-characterization-tags.mjs --all && node scripts/check-contracts.mjs && node scripts/check-contracts.mjs --client && node scripts/check-server-console.mjs && npm run lint && npx tsc --noEmit` (the census scripts exist from 06-04, 06-11 and 06-12 onward) |
| **Estimated runtime** | quick: under 30 s per task; full: about 15 min (Playwright production build plus ~100 specs dominates) |
| **Floor at planning time** | Jest 1651 passed + 1 skipped (88 suites); pgTAP Files=11 Tests=200; Playwright 91/91; ratchet committed=2 live=2; tag gate ok 34 (re-measured by 06-01 Task 1) |

---

## Sampling Rate

- **After every task commit:** the task's `<verify><automated>` command (targeted Jest suites and the relevant census script)
- **After every plan (each plan is its own wave; executors run sequentially):** the plan's `<verification>` block; plans that touch routes or the database also run the named Playwright specs from a fresh `supabase db reset --local` and seed
- **At each slice close (06-06, 06-18):** the full suite from a clean reset, unseeded and seeded pgTAP, the CI-env build, `validate.mjs --check findings`
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 30 s for a task's automated check; slice floors are the long-running exception

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | REFAC-23 | T-06-01-04 | Floor measured on the local stack only | floor | `head -1 evidence/floor.before.txt \| grep -E '^base='` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | REFAC-14, REFAC-15 | T-06-01-01, T-06-01-SC | Register edited surgically; package facts recorded before install | register + registry | `node .planning/audit/tools/validate.mjs --check findings && node scripts/check-characterization-tags.mjs --all` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | all eight | T-06-01-02 | Every rule-resolved choice numbered and overridable | doc | `grep -c '^## DEC-' evidence/phase-06-decisions.md` (22) | ✅ | ⬜ pending |
| 6-02-01 | 02 | 2 | REFAC-14 | T-06-02-01, T-06-02-03 | F-017 pinned as DEFECT, not frozen as contract | characterization | `npx jest --ci src/__tests__/api/recommendations` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | REFAC-15 | T-06-02-01 | F-028, F-092, F-094 pinned as DEFECT | characterization | `npx jest --ci src/__tests__/api/notifications src/__tests__/api/interactions src/__tests__/api/slice6-malformed-input-defect.test.ts src/__tests__/api/admin/admin-reports-defect.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 2 | REFAC-23 | T-06-02-02 | Pins proven to bite by mutation | mutation | `npx jest --ci && node scripts/check-characterization-tags.mjs --all` | ✅ | ⬜ pending |
| 6-03-01 | 03 | 3 | REFAC-14 | T-06-03-01, T-06-03-05 | Dead cron routes gone; service-role lint boundary still bites | census + lint | `test ! -e src/app/api/cron && npm run lint && node scripts/check-elevated-ratchet.mjs` | ✅ | ⬜ pending |
| 6-03-02 | 03 | 3 | REFAC-14, REFAC-15 | T-06-03-02, T-06-03-SC | Wrong-length signature refused without a throw; zod installed on verified integrity | unit | `npx jest --ci src/__tests__/webhook/verify-signature.test.ts src/__tests__/webhook/webhook-contract.test.ts` | ❌ W0 | ⬜ pending |
| 6-03-03 | 03 | 3 | REFAC-14 | T-06-03-03, T-06-03-04 | Replayed payload reported duplicate, nothing re-inserted | unit | `npx jest --ci src/__tests__/webhook` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 4 | REFAC-15 | T-06-04-03 | Census gate fails on an unlisted raw parse | unit + census | `npx jest --ci src/server/__tests__/body.test.ts src/__tests__/scripts/check-contracts.test.ts && node scripts/check-contracts.mjs` | ❌ W0 | ⬜ pending |
| 6-04-02 | 04 | 4 | REFAC-15, REFAC-14 | T-06-04-01, T-06-04-04 | Malformed input 400; anonymous count 401 | unit + characterization | `npx jest --ci src/contracts src/__tests__/api/recommendations src/__tests__/api/notifications src/__tests__/api/interactions` | ❌ W0 | ⬜ pending |
| 6-04-03 | 04 | 4 | REFAC-14 | T-06-04-02, T-06-04-05 | Elevated assignment keyed by the caller only; reporter read without email | unit + e2e | `npx jest --ci src/__tests__/api/recommendations src/__tests__/api/admin/admin-reports-defect.test.ts && npx playwright test e2e/specs/async-edge.spec.ts` | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 5 | REFAC-14 | T-06-05-01, T-06-05-02 | pgTAP red against the unfixed schema | pgTAP | `supabase test db --local` (recorded red in `evidence/definer-hardening-red.txt`) | ❌ W0 | ⬜ pending |
| 6-05-02 | 05 | 5 | REFAC-14, REFAC-22 | T-06-05-03, T-06-05-04, T-06-05-05 | Revokes, search_path pins, subject binding, service-only cron status | migration lint | `node scripts/check-migration-filenames.mjs` | ✅ | ⬜ pending |
| 6-05-03 | 05 | 5 | REFAC-14, REFAC-22 | T-06-05-06 | [BLOCKING] local-only schema push; both directions green; clauses load-bearing | pgTAP + types + mutation | `supabase test db --local && supabase gen types typescript --local --schema public \| diff -u src/lib/supabase/types.ts -` | ❌ W0 | ⬜ pending |
| 6-06-01 | 06 | 6 | REFAC-23 | T-06-06-03 | Slice-6 floor from a clean reset | floor + e2e | `npx playwright test` (full) plus the floor blocks | ✅ | ⬜ pending |
| 6-06-02 | 06 | 6 | REFAC-14, REFAC-23 | T-06-06-01, T-06-06-02 | Local-only fixes stay Open at 08 | register | `node .planning/audit/tools/validate.mjs --check findings` | ✅ | ⬜ pending |
| 6-07-01 | 07 | 7 | REFAC-15 | T-06-07-01 | Every slice-7 400 pinned before contracts | characterization | `npx jest --ci src/__tests__/contracts` | ❌ W0 | ⬜ pending |
| 6-07-02 | 07 | 7 | REFAC-19, REFAC-20, REFAC-22 | T-06-07-02, T-06-07-04 | F-025/026/029/054/055/058/059 pinned as DEFECT | characterization | `npx jest --ci src/__tests__/api/error-text-defect.test.ts src/__tests__/api/uncaught-throw-defect.test.ts src/__tests__/api/cache-headers-defect.test.ts src/__tests__/api/health src/__tests__/config src/__tests__/pages/docs-gate-defect.test.ts` | ❌ W0 | ⬜ pending |
| 6-07-03 | 07 | 7 | REFAC-20, REFAC-23 | T-06-07-03 | Console-coupled tests classified before the logger | inventory + mutation | `npx jest --ci && node scripts/check-characterization-tags.mjs --all` | ✅ | ⬜ pending |
| 6-08-01 | 08 | 8 | REFAC-15 | T-06-08-01, T-06-08-02 | Events bodies and uploads validated; file checks kept | unit + characterization | `npx jest --ci src/contracts src/server/__tests__/body.test.ts src/__tests__/contracts src/__tests__/api/events && node scripts/check-contracts.mjs` | ❌ W0 | ⬜ pending |
| 6-08-02 | 08 | 8 | REFAC-15 | T-06-08-03, T-06-08-04 | Events queries validated with no new 400 | unit + e2e | `npx jest --ci && node scripts/check-contracts.mjs && npx tsc --noEmit` | ✅ | ⬜ pending |
| 6-09-01 | 09 | 9 | REFAC-15 | T-06-09-01, T-06-09-03 | No non-http(s) club link stored | unit | `npx jest --ci src/contracts src/__tests__/api/clubs src/__tests__/contracts && node scripts/check-contracts.mjs` | ❌ W0 | ⬜ pending |
| 6-09-02 | 09 | 9 | REFAC-15 | T-06-09-02, T-06-09-04 | User and profile input validated | unit + e2e | `npx jest --ci && node scripts/check-contracts.mjs && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 6-10-01 | 10 | 10 | REFAC-15 | T-06-10-01, T-06-10-02 | Canonical ids at self-checks; typed admin payloads | unit | `npx jest --ci src/contracts src/__tests__/api/admin src/__tests__/contracts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 6-10-02 | 10 | 10 | REFAC-15 | T-06-10-03, T-06-10-04 | Contracts census at zero | census | `node scripts/check-contracts.mjs \| grep 'committed=0 live=0'` | ✅ | ⬜ pending |
| 6-11-01 | 11 | 11 | REFAC-16 | T-06-11-01, T-06-11-02 | Development checks warn without data, never throw | unit (jsdom) | `npx jest --ci src/hooks` | ❌ W0 | ⬜ pending |
| 6-11-02 | 11 | 11 | REFAC-16 | T-06-11-03, T-06-11-04 | Client mutations typed from contracts; zod absent from client chunks | census + build | `node scripts/check-contracts.mjs --client && npx tsc --noEmit` | ✅ | ⬜ pending |
| 6-12-01 | 12 | 12 | REFAC-20, REFAC-19 | T-06-12-01, T-06-12-03 | Logger redacts PII; wrapper sets class on every status | unit | `npx jest --ci src/server/__tests__/log.test.ts src/server/__tests__/route.test.ts src/server/__tests__/http.test.ts` | ❌ W0 | ⬜ pending |
| 6-12-02 | 12 | 12 | REFAC-20 | T-06-12-02, T-06-12-04 | Proxy overwrites client request ids; nothing added before getUser | unit | `npx jest --ci src/proxy src/server/__tests__/context.test.ts src/instrumentation.test.ts` | ❌ W0 | ⬜ pending |
| 6-12-03 | 12 | 12 | REFAC-20, REFAC-19 | T-06-12-05 | Console and cache censuses without bypass | unit + census | `node scripts/check-server-console.mjs && npx jest --ci src/__tests__/scripts/check-server-console.test.ts src/__tests__/api/cache-headers-census.test.ts` | ❌ W0 | ⬜ pending |
| 6-13-01 | 13 | 13 | REFAC-19, REFAC-20 | T-06-13-01, T-06-13-02, T-06-13-03 | Admin routes private; no error text echoed | unit + census | `npx jest --ci src/__tests__/api src/server && node scripts/check-server-console.mjs` | ✅ | ⬜ pending |
| 6-13-02 | 13 | 13 | REFAC-19, REFAC-20 | T-06-13-04 | Public club reads keep bytes; clubs/[id]/events private | unit + e2e | `npx jest --ci && node scripts/check-server-console.mjs && npx tsc --noEmit` | ✅ | ⬜ pending |
| 6-14-01 | 14 | 14 | REFAC-19, REFAC-20 | T-06-14-02 | Event detail private | unit + census | `npx jest --ci src/__tests__/api && node scripts/check-server-console.mjs` | ✅ | ⬜ pending |
| 6-14-02 | 14 | 14 | REFAC-19, REFAC-20 | T-06-14-01, T-06-14-03, T-06-14-04 | Blanket header gone; callback logs no PII; full suite green | config + census + e2e | `node -e "process.exit(require('./vercel.json').headers?1:0)" && npx jest --ci && npx playwright test` | ✅ | ⬜ pending |
| 6-15-01 | 15 | 15 | REFAC-19 | T-06-15-05 | Endpoint contract matches implemented classes | contract regen | `node .planning/audit/tools/validate.mjs --check endpoints && npx jest --ci src/__tests__/api/cache-headers-census.test.ts` | ✅ | ⬜ pending |
| 6-15-02 | 15 | 15 | REFAC-19 | T-06-15-01, T-06-15-02, T-06-15-03, T-06-15-04 | B never receives A's body; controls prove the test bites | e2e | `npx playwright test e2e/specs/cross-user-cache.spec.ts` | ❌ W0 | ⬜ pending |
| 6-15-03 | 15 | 15 | REFAC-19, REFAC-23 | T-06-15-05 | Every route's header proven live | e2e | `npx playwright test e2e/specs/cache-headers.spec.ts e2e/specs/cross-user-cache.spec.ts` | ❌ W0 | ⬜ pending |
| 6-16-01 | 16 | 16 | REFAC-21 | T-06-16-SC | Sentry installed on verified integrity, no CLI binary download | install | `node -p "require('./package.json').dependencies['@sentry/nextjs']" \| grep -x 10.75.3 && npm audit --audit-level=high --omit=dev` | ✅ | ⬜ pending |
| 6-16-02 | 16 | 16 | REFAC-21 | T-06-16-01, T-06-16-02, T-06-16-03, T-06-16-04 | No cookies, bodies, query strings or emails in events; request_id tag; token-less build | unit + build | `npx jest --ci src/lib/observability src/server/__tests__/sentry.test.ts src/lib/env.test.ts src/instrumentation.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 6-16-03 | 16 | 16 | REFAC-23 | T-06-16-05 | No eval in production CSP; harness runs under the CSP | unit + e2e | `npx jest --ci src/__tests__/config && npx playwright test e2e/specs/csp.spec.ts` | ❌ W0 | ⬜ pending |
| 6-17-01 | 17 | 17 | REFAC-22 | T-06-17-01, T-06-17-02, T-06-17-05 | Liveness-only for anonymous; digest compare for the token; no session accessor | unit + census | `npx jest --ci src/__tests__/api/health src/server/__tests__/getsession-gate.test.ts src/lib/env.test.ts` | ❌ W0 | ⬜ pending |
| 6-17-02 | 17 | 17 | REFAC-22 | T-06-17-03, T-06-17-04 | /docs and /health admin-only; banned admins refused | unit + e2e | `npx jest --ci src/server/__tests__/requireAdminPage.test.ts src/__tests__/pages && npx playwright test e2e/specs/health.spec.ts e2e/specs/admin-page-gates.spec.ts` | ❌ W0 | ⬜ pending |
| 6-18-01 | 18 | 18 | REFAC-15, REFAC-23 | T-06-18-SC | supabase-js bump proven in a worktree first | unit + tsc | `npx jest --ci src/__tests__/api/events && npx tsc --noEmit` | ✅ | ⬜ pending |
| 6-18-02 | 18 | 18 | REFAC-23 | T-06-18-02, T-06-18-03 | Phase floor from a clean reset; honest register | floor + e2e | full suite command above; `node .planning/audit/tools/validate.mjs --check findings` | ✅ | ⬜ pending |
| 6-18-03 | 18 | 18 | all eight | T-06-18-01, T-06-18-04, T-06-18-05 | Every claim cited; CLAUDE.md untouched without owner authorization | doc + citation count | `grep -c 'missing=0' evidence/PHASE-6-COMPLETION.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

`evidence/` above is `.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/`.

---

## Wave 0 Requirements

Phase 6 has no separate Wave 0 plan: every "❌ W0" file is created test-first by the task that needs it, and recorded red before the code it pins (tdd="true" tasks) or pinned against unchanged source (characterization tasks).

- [ ] `src/__tests__/api/recommendations/*`, `src/__tests__/api/notifications/*`, `src/__tests__/api/interactions/*`, `src/__tests__/api/slice6-malformed-input-defect.test.ts`, `src/__tests__/api/admin/admin-reports-defect.test.ts` — slice-6 pins (06-02)
- [ ] `src/__tests__/webhook/*.test.ts` over `supabase/functions/_shared/*` — webhook proof under Jest (Deno absent) (06-03)
- [ ] `src/server/__tests__/body.test.ts`, `src/contracts/__tests__/slice-6-contracts.test.ts`, `src/__tests__/scripts/check-contracts.test.ts` and `scripts/check-contracts.mjs` with red fixtures (06-04)
- [ ] `supabase/tests/database/031-cron-jobs.test.sql`, `070-definer-functions.test.sql` — red before the migration (06-05)
- [ ] `src/__tests__/contracts/*`, the seven slice-7 DEFECT suites, `evidence/console-coupled-tests.md` (06-07)
- [ ] `src/contracts/__tests__/events.test.ts`, `clubs.test.ts`, `users.test.ts`, `admin.test.ts` (06-08..06-10)
- [ ] `src/hooks/contract-dev-check.test.ts` (06-11)
- [ ] `src/server/__tests__/log.test.ts`, `route.test.ts`, `src/proxy-request-id.test.ts`, `src/__tests__/api/cache-headers-census.test.ts`, `scripts/check-server-console.mjs` with `src/__tests__/scripts/check-server-console.test.ts` (06-12)
- [ ] `e2e/helpers/sharedCacheProxy.ts`, `e2e/specs/cross-user-cache.spec.ts`, `e2e/specs/cache-headers.spec.ts` (06-15)
- [ ] `src/lib/observability/scrub.test.ts`, `src/server/__tests__/sentry.test.ts`, `e2e/specs/csp.spec.ts`; `playwright.config.ts` `bypassCSP: false` (06-16)
- [ ] `src/__tests__/api/health/health.test.ts`, `src/server/__tests__/requireAdminPage.test.ts`, `e2e/specs/health.spec.ts`, `e2e/specs/admin-page-gates.spec.ts` (06-17)
- [ ] `src/__tests__/helpers/fakeSupabase.ts` extensions: `rpc:cron_job_status` rows, a PGRST202 error, elevated experiments reads (06-02, 06-17)
- [ ] Framework installs: `zod` 4.6.5 (06-03), `@sentry/nextjs` 10.75.3 with `SENTRYCLI_SKIP_DOWNLOAD=1` (06-16), each after its registry integrity matches the 06-01 bundle

---

## Manual-Only Verifications

These are the end-of-phase human-checks (`workflow.human_verify_mode: end-of-phase`; DEC-81, DI-81). None blocks execution; each is listed in `PHASE-6-COMPLETION.md` § Phase 8 deploy prerequisites.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner countersigns the zod 4.6.5 and @sentry/nextjs 10.75.3 pins | REFAC-15, REFAC-21 | Legitimacy verdicts on `too-new` releases were rule-resolved without an owner | Read `evidence/zod-legitimacy.txt` and `evidence/sentry-legitimacy.txt`; append a signed paragraph under DEC-60 and DEC-61 |
| A deliberately triggered error appears in the real Sentry project with the correlation id | REFAC-21 | No DSN exists; locally the transport is mocked | Set SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN on a preview deploy, trigger an error through a wrapped route, match the event's `request_id` tag to the response's `x-request-id` |
| No personalized route returns `x-vercel-cache: HIT` for session B after session A | REFAC-19 (F-025) | Needs the real Vercel CDN and two real sessions; no push is authorized | `export PROD_HOST=<preview URL> COOKIE_A=… COOKIE_B=…; bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs` |
| events-webhook redeployed from CI with WEBHOOK_SECRET confirmed; the Deno suite run | REFAC-14 (F-039) | Deploying and Deno are owner-side; Deno is not installed here | Redeploy from a CI job at a named commit; run `supabase/functions/tests/webhook.test.ts` under Deno; send a wrong-length signature and a replay |
| Production `/auth/v1/health` and `/storage/v1/status` answer like local | REFAC-22 | Production is never read in this phase | After the first deploy, call `/api/health` with HEALTH_TOKEN and confirm `auth` and `storage` are `ok` |
| CLAUDE.md fact corrections applied | REFAC-23 (docs hygiene) | Agents do not edit CLAUDE.md without the owner's authorization | Review `evidence/claude-md-corrections.patch`; apply with `git apply` or sign an authorization under DI-46 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s per task (slice floors excepted)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (plan checker)
