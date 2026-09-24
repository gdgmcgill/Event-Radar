---
phase: 5
slug: slices-3-5-auth-club-authorization-admin-containment
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-23
planned: 2026-09-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 (node + jsdom projects), pgTAP via `supabase test db --local`, Playwright 1.63 persona harness |
| **Config file** | `jest.config.js`, `playwright.config.ts`, `supabase/tests/database/` |
| **Quick run command** | `npx jest --ci <changed suite paths>` (single suite, under 10 seconds) |
| **Full suite command** | `supabase db reset --local && supabase test db --local && npx tsx scripts/seed/load.ts && supabase test db --local && npx jest --ci && npx tsc --noEmit && npm run lint && node scripts/check-elevated-ratchet.mjs && node scripts/check-characterization-tags.mjs --all && npx playwright test` |
| **Estimated runtime** | quick run under 10 seconds; full suite several minutes (Playwright rebuilds the app and never reuses a server) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command on the touched suites, plus `node scripts/check-characterization-tags.mjs --all`; add `npm run lint` when imports change and `supabase test db --local` when SQL changes
- **After every slice close (05-08, 05-11, 05-19):** Run the full suite command from a clean reset and record it in `evidence/floor.slice-N-after.txt` / `evidence/floor.phase-after.txt`
- **Before `/gsd-verify-work`:** Full suite must be green, plus `supabase gen types typescript --local --schema public | diff -u src/lib/supabase/types.ts -` empty and the CI-env `npm run build` exit 0
- **Max feedback latency:** 10 seconds for the per-task quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | REFAC-11 | T-05-01-05 | the DI-38 race is gone before the floor is measured | e2e + floor | `head -1 .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/floor.before.txt \| grep -E '^base=[0-9a-f]{40}$'` | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | all five | T-05-01-01, T-05-01-02 | every F-nnn a DEFECT suite will cite exists | gate | `node .planning/audit/tools/validate.mjs --check findings && node scripts/check-characterization-tags.mjs --all` | ✅ | ⬜ pending |
| 5-01-03 | 01 | 1 | all five | — | every rule-resolved choice written before it executes | doc | `grep -c '^## DEC-' .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/phase-05-decisions.md` | ❌ W0 (task creates) | ⬜ pending |
| 5-02-01 | 02 | 2 | REFAC-11 | T-05-02-01 | proxy ring pinned PRESERVE and DEFECT | unit | `npx jest --ci src/proxy-characterization.test.ts src/proxy-defect.test.ts src/proxy.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | REFAC-11 | T-05-02-02 | open redirect pinned DEFECT; env census; one getSession | unit | `npx jest --ci src/app/auth/callback src/lib/__tests__/env-assertions-defect.test.ts src/server/__tests__/getsession-gate.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | REFAC-11 | T-05-02-01 | every ring pin proven to bite; source untouched | gate | `node scripts/check-characterization-tags.mjs --all && npx tsc --noEmit && git diff --exit-code -- src/proxy.ts src/app/auth/callback/route.ts` | ✅ | ⬜ pending |
| 5-03-01 | 03 | 2 | REFAC-11 | T-05-03-01, T-05-03-03 | all 39 write arms pinned (anonymous bytes, legacy ban bytes, today's admissions) | unit | `npx jest --ci src/__tests__/api/auth-ring` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | REFAC-11 | — | F-028 anonymous 200s pinned | unit | `npx jest --ci src/__tests__/api/events/anonymous-personalized-defect.test.ts src/__tests__/api/events/friends-defect.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | REFAC-11 | T-05-03-02 | handler net bites; source untouched | gate | `node scripts/check-characterization-tags.mjs --all && npx tsc --noEmit && git diff --exit-code -- src/app src/lib src/server` | ✅ | ⬜ pending |
| 5-04-01 | 04 | 3 | REFAC-11 | T-05-04-02, T-05-04-03, T-05-04-05 | env validated lazily; no import-time throw; auth-debug gone | unit | `npx jest --ci src/lib/env.test.ts src/lib/__tests__/env-assertions-defect.test.ts src/proxy.test.ts && npm run lint && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 3 | REFAC-11 | T-05-04-04 | server refuses to start without config, except build and edge | unit | `npx jest --ci src/instrumentation.test.ts src/server/__tests__/elevated.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-03 | 04 | 3 | REFAC-11 | T-05-04-01 | guards fail closed on null profile, ban, onboarding | unit | `npx jest --ci src/server && npx jest --ci` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 4 | REFAC-11 | T-05-05-01, T-05-05-02, T-05-05-07 | proxy fails closed; banned /api JSON 403; DB-truth onboarding | unit | `npx jest --ci src/proxy.test.ts src/proxy-characterization.test.ts src/proxy-defect.test.ts && npx tsc --noEmit && npm run lint` | ✅ (05-02) | ⬜ pending |
| 5-05-02 | 05 | 4 | REFAC-11 | T-05-05-03..06 | no role grant at sign-in; fail-closed sync; same-origin next; McGill kept | unit | `npx jest --ci src/app/auth src/lib/__tests__/env-assertions-defect.test.ts && node scripts/check-elevated-ratchet.mjs` | ✅ (05-02) | ⬜ pending |
| 5-06-01 | 06 | 5 | REFAC-11 | T-05-06-01..03 | events-family write arms refuse banned, profile-less, un-onboarded | unit | `npx jest --ci src/__tests__/api src/app/api && npx tsc --noEmit && npm run lint` | ✅ (05-03) | ⬜ pending |
| 5-06-02 | 06 | 5 | REFAC-11 | T-05-06-04 | four personalized routes 401 to anonymous | unit | `npx jest --ci src/__tests__/api/events/anonymous-personalized-defect.test.ts && npx jest --ci` | ✅ (05-03) | ⬜ pending |
| 5-07-01 | 07 | 6 | REFAC-11 | T-05-07-01 | clubs-family write arms guarded | unit | `npx jest --ci src/__tests__/api src/app/api && npx tsc --noEmit` | ✅ (05-03) | ⬜ pending |
| 5-07-02 | 07 | 6 | REFAC-11 | T-05-07-01..04 | every write arm guarded; wizard and anonymous telemetry preserved; legacy helper deleted | unit | `npx jest --ci && npx tsc --noEmit && npm run lint && node scripts/check-characterization-tags.mjs --all` | ✅ (05-03) | ⬜ pending |
| 5-08-01 | 08 | 7 | REFAC-11 | T-05-08-01..03 | ban, onboarding and no-profile rings proven in the browser | e2e | `npx playwright test e2e/specs/ban-and-onboarding-ring.spec.ts e2e/specs/no-profile-row.spec.ts` (task verify: `npx tsc --noEmit` + evidence file) | ❌ W0 | ⬜ pending |
| 5-08-02 | 08 | 7 | REFAC-11 | T-05-08-05 | contract agrees with slice 3 | gate | `node .planning/audit/tools/validate.mjs --check endpoints` | ✅ | ⬜ pending |
| 5-08-03 | 08 | 7 | REFAC-11 | T-05-08-04 | slice 3 floor green; closures evidenced | floor | `node .planning/audit/tools/validate.mjs --check findings` + `evidence/playwright.slice-3-after.txt` exit=0 | ✅ | ⬜ pending |
| 5-09-01 | 09 | 8 | REFAC-12 | T-05-09-01 | 17 club sites pinned; F-087 pinned | unit | `npx jest --ci src/__tests__/api/clubs && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-09-02 | 09 | 8 | REFAC-12 | T-05-09-02..04 | cross-club 403s pinned in the browser; RLS ring measured | e2e + probe | `npx playwright test e2e/specs/club-authorization.spec.ts` (task verify: tsc + `evidence/rls-ring-before.txt`) | ❌ W0 | ⬜ pending |
| 5-09-03 | 09 | 8 | REFAC-12 | T-05-09-01 | club net bites | gate | `node scripts/check-characterization-tags.mjs --all && npx jest --ci && git diff --exit-code -- src/app src/lib src/server` | ✅ | ⬜ pending |
| 5-10-01 | 10 | 9 | REFAC-12 | T-05-10-01, T-05-10-02 | club-route gates through requireClubRole, exact bytes, no admin bypass | unit | `npx jest --ci src/__tests__/api/clubs src/server && npx tsc --noEmit && npm run lint` | ✅ (05-09) | ⬜ pending |
| 5-10-02 | 10 | 9 | REFAC-12, REFAC-13 | T-05-10-05 | event-side club flags and admin via hasRole | unit | `npx jest --ci src/__tests__/api/events src/__tests__/api/clubs && npx tsc --noEmit` | ✅ (05-09) | ⬜ pending |
| 5-10-03 | 10 | 9 | REFAC-12 | T-05-10-03, T-05-10-04 | owner writes through the door with a whitelist | unit + e2e | `npx jest --ci src/__tests__/api/clubs && node scripts/check-elevated-ratchet.mjs && npm run lint` | ✅ (05-09) | ⬜ pending |
| 5-11-01 | 11 | 10 | REFAC-12 | T-05-11-01, T-05-11-06 | F-008 policy and both-direction pgTAP written | pgTAP (files) | `node scripts/check-migration-filenames.mjs` | ❌ W0 | ⬜ pending |
| 5-11-02 | 11 | 10 | REFAC-12 | T-05-11-02..04 | [BLOCKING] local schema push; RLS ring proven; types match | pgTAP | `supabase test db --local && supabase gen types typescript --local --schema public \| diff -u src/lib/supabase/types.ts -` | ✅ (5-11-01) | ⬜ pending |
| 5-11-03 | 11 | 10 | REFAC-12 | T-05-11-05 | F-016 proven locally; slice 4 floor green | e2e + floor | `node .planning/audit/tools/validate.mjs --check findings` + `npx playwright test` from a clean reset | ❌ W0 (spec) | ⬜ pending |
| 5-12-01 | 12 | 11 | REFAC-13 | T-05-12-01 | admin guard pinned at all 35 arms | unit | `npx jest --ci src/__tests__/api/admin && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-12-02 | 12 | 11 | REFAC-13 | T-05-12-04 | F-091, F-005, F-086 pinned | unit | `npx jest --ci src/__tests__/api/admin src/__tests__/pages src/__tests__/api/events/pending-edits-defect.test.ts src/__tests__/moderation/audit-shape.test.ts` | ❌ W0 | ⬜ pending |
| 5-12-03 | 12 | 11 | REFAC-13, REFAC-17 | T-05-12-02, T-05-12-03 | admin-guard and CSRF exposure pinned in the browser | e2e | `npx playwright test e2e/specs/admin-guard.spec.ts e2e/specs/csrf-origin.spec.ts` (task verify: tsc + tag gate + clean src) | ❌ W0 | ⬜ pending |
| 5-13-01 | 13 | 12 | REFAC-13 | T-05-13-01, T-05-13-02 | requireRole at 12 admin files | unit | `npx jest --ci src/__tests__/api/admin src/app/api/admin && npx tsc --noEmit` | ✅ (05-12) | ⬜ pending |
| 5-13-02 | 13 | 12 | REFAC-13 | T-05-13-01 | requireRole at 13 admin files | unit | `npx jest --ci src/__tests__/api/admin src/app/api/admin && npx tsc --noEmit` | ✅ (05-12) | ⬜ pending |
| 5-13-03 | 13 | 12 | REFAC-13 | T-05-13-03 | layouts and moderation reviews through the context; helper deleted | unit + e2e | `test ! -e src/lib/admin.ts && npx jest --ci && npx tsc --noEmit && npm run lint` | ✅ | ⬜ pending |
| 5-14-01 | 14 | 13 | REFAC-13 | T-05-14-01, T-05-14-02 | FO-01 closed; admin role changes land, validated, audited | unit | `npx jest --ci src/__tests__/api/admin && node scripts/check-elevated-ratchet.mjs && npx tsc --noEmit && npm run lint` | ✅ (05-12) | ⬜ pending |
| 5-14-02 | 14 | 13 | REFAC-13 | T-05-14-03, T-05-14-05 | one audit row per action through the only writer | unit + e2e | `npx jest --ci src/__tests__/moderation src/__tests__/api/admin src/app/api/admin`; `npx playwright test e2e/specs/admin-audit-row.spec.ts` | ✅ (audit-shape) / ❌ W0 (spec) | ⬜ pending |
| 5-14-03 | 14 | 13 | REFAC-13 | T-05-14-04 | pending edits to owner and admins only; contract regenerated | unit + gate | `npx jest --ci src/__tests__/api/events && node .planning/audit/tools/validate.mjs --check endpoints` | ✅ (05-12) | ⬜ pending |
| 5-15-01 | 15 | 14 | REFAC-13 | T-05-15-02, T-05-15-05 | admin service-role uses split and registered; flows proven live | unit + e2e | `npx jest --ci src/__tests__/api/service-role-routing.test.ts src/__tests__/api/admin && node scripts/check-elevated-ratchet.mjs`; `npx playwright test e2e/specs/admin-write-paths.spec.ts` | ❌ W0 | ⬜ pending |
| 5-15-02 | 15 | 14 | REFAC-13 | T-05-15-04 | non-admin service-role uses through the door or the cookie client | unit | `npx jest --ci && node scripts/check-elevated-ratchet.mjs && npm run lint && npx tsc --noEmit` | ✅ (5-15-01) | ⬜ pending |
| 5-15-03 | 15 | 14 | REFAC-13 | T-05-15-01, T-05-15-03 | private profiles 404 to anonymous, no email read; allow-list = 2 cron routes | unit + e2e + gate | `npx jest --ci src/__tests__/pages && node scripts/check-elevated-ratchet.mjs && npm run lint` | ✅ (05-12) / ❌ W0 (spec) | ⬜ pending |
| 5-16-01 | 16 | 15 | REFAC-13 | T-05-16-01, T-05-16-02 | escalation and forgery tests red against today's schema | pgTAP | `node scripts/check-migration-filenames.mjs` + `evidence/rls-privilege-before.txt` | ❌ W0 | ⬜ pending |
| 5-16-02 | 16 | 15 | REFAC-13 | T-05-16-01..06 | [BLOCKING] local schema push; save and profile still work | pgTAP + e2e | `supabase test db --local && supabase gen types typescript --local --schema public \| diff -u src/lib/supabase/types.ts -` | ✅ (5-16-01) | ⬜ pending |
| 5-17-01 | 17 | 16 | REFAC-13, REFAC-18 | T-05-17-03..06 | admin routes rate limited through a store interface | unit | `npx jest --ci src/server/ratelimit src/middlewareRateLimit.test.ts src/proxy-characterization.test.ts src/proxy.test.ts && npx tsc --noEmit && npm run lint` | ❌ W0 | ⬜ pending |
| 5-17-02 | 17 | 16 | REFAC-17 | T-05-17-01, T-05-17-02 | cross-site mutations refused; same-origin and machine callers pass | unit + e2e | `npx jest --ci src/server/__tests__/csrf.test.ts src/proxy-characterization.test.ts src/proxy-defect.test.ts`; `npx playwright test e2e/specs/csrf-origin.spec.ts` | ❌ W0 | ⬜ pending |
| 5-18-01 | 18 | 17 | REFAC-18 | T-05-18-SC | registry facts gathered; nothing installed | doc | `git diff --exit-code -- package.json package-lock.json` | ❌ W0 | ⬜ pending |
| 5-18-02 | 18 | 17 | REFAC-18 | T-05-18-SC | human package-legitimacy verdict (blocking-human) | manual | — (checkpoint; see Manual-Only) | — | ⬜ pending |
| 5-18-03 | 18 | 17 | REFAC-18 | T-05-18-01..05 | distributed store selected by config; production boot requires it; harness guarded | unit | `npx jest --ci src/server/ratelimit src/lib/env.test.ts src/instrumentation.test.ts && npm audit --audit-level=high --omit=dev && npx tsc --noEmit && npm run lint` | ❌ W0 | ⬜ pending |
| 5-19-01 | 19 | 18 | all five | T-05-19-SC | supabase-js 2.116.0 proven then bumped | build | `npx tsc --noEmit && npm audit --audit-level=high --omit=dev` | ✅ | ⬜ pending |
| 5-19-02 | 19 | 18 | all five | T-05-19-02, T-05-19-03 | phase after-floor green; register reconciled | floor | `node .planning/audit/tools/validate.mjs --check findings` + `npx playwright test` from a clean reset | ✅ | ⬜ pending |
| 5-19-03 | 19 | 18 | all five | T-05-19-01, T-05-19-04 | completion note with missing=0 citations and the owner's pre-deploy actions | doc | `grep -c 'missing=0' .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/PHASE-5-COMPLETION.md` | ❌ W0 (task creates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Characterization files that must exist, green against unmodified source, before the refactor plan that depends on them runs. Each is created by the plan named and is the Wave 0 for the plans after it.

- [ ] `src/proxy-characterization.test.ts`, `src/proxy-defect.test.ts` (05-02) — before 05-05
- [ ] `src/app/auth/callback/route-defect.test.ts`, `src/lib/__tests__/env-assertions-defect.test.ts`, `src/server/__tests__/getsession-gate.test.ts` (05-02) — before 05-04 and 05-05
- [ ] `src/__tests__/api/auth-ring/writeHandlerTable.ts`, `write-handlers-characterization.test.ts`, `write-handlers-ring-defect.test.ts`, `src/__tests__/api/events/anonymous-personalized-defect.test.ts` (05-03) — before 05-06 and 05-07
- [ ] `src/lib/env.test.ts`, `src/instrumentation.test.ts`, `src/server/__tests__/requireActiveUser.test.ts`, `src/server/__tests__/requireOnboarded.test.ts` (05-04, test-first inside the plan)
- [ ] `e2e/specs/ban-and-onboarding-ring.spec.ts`, `e2e/specs/no-profile-row.spec.ts` (05-08)
- [ ] `src/__tests__/api/clubs/club-gates-characterization.test.ts`, `src/__tests__/api/clubs/club-owner-writes-defect.test.ts`, `e2e/specs/club-authorization.spec.ts`, `evidence/rls-ring-before.txt` (05-09) — before 05-10 and 05-11
- [ ] `supabase/tests/database/060-club-tenant-isolation.test.sql` (05-11 Task 1) — before the 05-11 [BLOCKING] push
- [ ] `src/__tests__/api/admin/adminArmTable.ts`, `admin-guard-characterization.test.ts`, `admin-guard-defect.test.ts`, `admin-users-patch-defect.test.ts`, `src/__tests__/pages/public-profile-defect.test.tsx`, `src/__tests__/api/events/pending-edits-defect.test.ts`, `e2e/specs/admin-guard.spec.ts`, `e2e/specs/csrf-origin.spec.ts` (05-12) — before 05-13..05-17
- [ ] `supabase/tests/database/050-users-privilege-escalation.test.sql`, `055-admin-audit-log-insert.test.sql`, run red against today's schema (05-16 Task 1) — before the 05-16 [BLOCKING] push
- [ ] `src/server/ratelimit/policy.test.ts`, `memoryStore.test.ts`, `src/server/__tests__/csrf.test.ts` (05-17, test-first inside the plan)
- [ ] `src/server/ratelimit/upstashStore.test.ts`, `upstash.contract.test.ts` (05-18, after the checkpoint)

No framework install is needed: Jest (node and jsdom projects), pgTAP through the Supabase CLI 2.115.0, and the Playwright persona harness already exist and are green at the before-floor.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Package legitimacy of `@upstash/ratelimit` 2.1.0, `@upstash/redis` 1.38.4 and their transitive `@upstash/core-analytics`, `uncrypto` | REFAC-18 | Research flagged them [SUS]; the planner's supply-chain rule makes this checkpoint blocking and never auto-approvable (DEC-51) | 05-18 Task 2: read `evidence/upstash-legitimacy.txt`, check the npm pages for publisher, repository, dates and install scripts, answer approved / use 2.0.8 / reject |
| The Upstash contract test against a real store | REFAC-18 | No store may be created by this phase; the suite is skipped (not passed) without configuration | After the owner provisions Upstash (DI-42), export the two variables and run `npx jest --ci src/server/ratelimit/upstash.contract.test.ts` |
| CI `ci`, `types` and `e2e` jobs on the phase head | all five | Observation needs a push the executor may not make | After the owner pushes, record the run id and the three conclusions in `evidence/PHASE-5-COMPLETION.md` § CI observation |
| Production counts of un-onboarded users and auth users with no profile row | REFAC-11 | Production is never read by this phase | Owner-authorized read-only count before the Phase 8 deploy (A6, DI-42) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the one exception, 5-18-02, is the blocking-human legitimacy checkpoint, listed under Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency under 10 s for the per-task quick run (Playwright and pgTAP run at slice closes, not per task)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-09-24 by the phase planner; execution sign-off pending
