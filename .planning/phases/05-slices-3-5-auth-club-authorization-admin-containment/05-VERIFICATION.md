---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
verified: 2026-09-25T20:56:02Z
status: human_needed
score: 4/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
deferred:
  - truth: "Every fail-open endpoint fails closed (FO-02: src/app/api/cron/send-reminders/route.ts still compares against the literal 'Bearer undefined' when CRON_SECRET is unset, and both cron routes still import createServiceClient directly instead of going through the elevated door)"
    addressed_in: "Phase 6"
    evidence: "Phase 6 (ROADMAP.md) Success Criterion 1: 'Cron and webhook routes require credentials and fail closed when they are absent' — Requirement REFAC-14 explicitly owns both cron routes per REQUIREMENTS.md and PHASE-5-COMPLETION.md §2/§3. Re-derived independently: grep confirms send-reminders/route.ts:9 uses `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` with no early guard for an unset secret, while send-feedback-requests/route.ts correctly 500s when CRON_SECRET is unset. Both files import createServiceClient directly (grep -rln \"createServiceClient(\" src), and eslint.elevated-allowlist.mjs allow-lists exactly these two paths, nothing else."
behavior_unverified_items:
  - truth: "Rate limiting runs from a distributed store so it holds across serverless instances"
    test: "Provision a real Upstash (or KV) store in production, set RATE_LIMIT_REQUIRE_DISTRIBUTED=true, and run src/server/ratelimit/upstash.contract.test.ts against it"
    expected: "The contract test passes against a live store, and the boot check refuses to start without one"
    why_human: "No store is provisioned (DI-42); this is an infrastructure/owner action, not a code change. src/server/ratelimit/upstash.contract.test.ts is conditionally describe.skip()'d whenever UPSTASH_REDIS_REST_*/KV_REST_API_* env vars are absent (confirmed by reading the file), and the current CI/local run has none configured, so the property 'holds across serverless instances' has literally never been exercised — only unit-tested against a mocked client."
human_verification:
  - test: "Countersign DEC-59's Upstash package-legitimacy verdict ('use 2.0.8', unsigned, resolved by rule with no owner present) or switch to the provenance-attested 2.1.0 as the plan originally proposed"
    expected: "An owner reviews and signs off on the dependency choice before it reaches production, given the blocking-human checkpoint at 05-18 Task 2 went unanswered and was resolved autonomously"
    why_human: "This is a security/supply-chain judgment call (provenance vs. maintainer-signed age) the phase's own evidence (evidence/upstash-legitimacy.txt, PHASE-5-COMPLETION.md §6, §8(a)) explicitly reserves for the owner and states was never actually reviewed by one"
  - test: "Provision Upstash (or Vercel KV) in the production environment, set the resulting env vars, then set RATE_LIMIT_REQUIRE_DISTRIBUTED=true"
    expected: "Rate limiting counts requests from a shared store across all serverless instances instead of per-instance from memory"
    why_human: "Infrastructure provisioning action outside the codebase; PHASE-5-COMPLETION.md §8(a) names this as an explicit owner action required before any push to main"
  - test: "Decide DI-41: whether GET /invites/[token] (invitation acceptance) should move behind a CSRF-protected POST, given it is the one residual CSRF exposure outside /api/*"
    expected: "An explicit owner decision, since it is a UX change to a Validated workflow"
    why_human: "Product/UX tradeoff explicitly deferred to the owner in evidence/csrf-assessment.md and PHASE-5-COMPLETION.md §8(d)"
  - test: "Run an owner-authorized, read-only count of production users with onboarding_completed false/null and auth users with no public.users row, before deploying"
    expected: "A known blast-radius number for who gets redirected to onboarding or signed out once this phase's proxy/callback changes deploy"
    why_human: "Requires production database read access the phase itself never used (PHASE-5-COMPLETION.md §8(b), assumption A6, OPEN)"
  - test: "Decide whether to apply the two local-only Critical-severity migrations (F-006 self-escalation/self-unban, F-007 audit-log forgery) to production ahead of the Phase 8 migration-history repair (DI-23), or accept both stay exploitable in production until then"
    expected: "An explicit owner decision, since these are Critical findings closed only on the local stack"
    why_human: "PHASE-5-COMPLETION.md §7/§8(c): production is never touched by this phase; the migrations exist only locally and the owner must choose the timeline"
---

# Phase 5: Slices 3–5 — Auth, Club Authorization, Admin Containment Verification Report

**Phase Goal:** Authorization decisions happen in exactly one fails-closed place, cross-tenant and privilege-escalation paths are denied at both the authz ring and the RLS ring, and the service-role client has exactly one registered door.
**Verified:** 2026-09-25T20:56:02Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All five truths are the ROADMAP.md Phase 5 Success Criteria (merged with PLAN frontmatter must_haves — no reduction in scope; frontmatter truths in all 19 plans were a subset of these five).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every authorization decision uses `getUser()` not `getSession()`; middleware is advisory-only; ban check fails closed; onboarding guard cannot be bypassed by direct API calls; env-var non-null assertions replaced with validated config | ✓ VERIFIED | `grep -rn "getSession(" src --include='*.ts' --include='*.tsx' \| grep -v test` returns exactly one hit, `src/app/api/health/route.ts:160`, which gates nothing. `grep -rn "process\.env\.[A-Z_]*!" src` (non-test) returns 0. `src/lib/env.ts` exists and is read by `src/instrumentation.ts`. `requireActiveUser` is wired into 59 non-test files under `src/app/api`, `requireOnboarded` into 33. `verifyAdmin`/`checkBanStatus` (the deleted legacy helpers) return 0 hits anywhere in `src` |
| 2 | The 19 hand-rolled club-membership checks collapse into `requireClubRole`, and a cross-club access attempt returns 403 at the authz ring and is independently denied at the RLS ring | ✓ VERIFIED | `grep -rn "requireClubRole(" src/app/api --include='*.ts' \| grep -v test` = 18 call sites (matches the phase's own count, since one composite site has two arms). `supabase test db --local` run fresh in this session: `060-club-tenant-isolation.test.sql` plan(30), all green ("All tests successful", Files=11 Tests=200, Result: PASS across the full pgTAP suite including 050, 055, 065, 066). `e2e/specs/club-authorization.spec.ts` (235 lines, 19 `test(` blocks) is a real, substantive spec covering cross-club attacker rows, not a stub |
| 3 | Every fail-open endpoint fails closed, `verifyAdmin()` guards every admin route, and every remaining service-role use goes through `src/server/db/elevated/` with a registered justification | ✓ VERIFIED, with one clause deferred to Phase 6 (see `deferred` below) | `grep -rln 'requireRole(ctx, "admin")' src/app/api` = 26 files (35 arms per the phase's own census, re-derivable the same way). `verifyAdmin`/the old admin helper: 0 references anywhere. `grep -rln "createServiceClient(" src` returns exactly the factory (`src/lib/supabase/service.ts`), the one door (`src/server/db/elevated/index.ts`), and the two cron routes (plus two auth-callback tests). `node scripts/check-elevated-ratchet.mjs` → `committed=2 live=2 delta=0`, PASS. `eslint.elevated-allowlist.mjs` allow-lists exactly `send-feedback-requests/route.ts` and `send-reminders/route.ts` — nothing else. `src/server/db/elevated/REGISTRY.md` has populated, specific justification rows. The one unmet sub-clause (FO-02, the reminder cron's `Bearer undefined` comparison) is real and independently re-confirmed by reading the route file, but it is explicitly disclosed by the phase's own evidence and owned by Phase 6 (REFAC-14) — see Deferred Items below |
| 4 | Rate limiting runs from a distributed store so it holds across serverless instances and now covers `/api/admin/*`; CSRF exposure is assessed against Supabase cookie SameSite behavior and protection added on state-changing routes wherever exposure remains | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (distributed-store clause); CSRF clause VERIFIED | `/api/admin/*` rate-limit coverage: `src/server/ratelimit/policy.ts` `ADMIN_BUDGETS` (600 GET / 120 mutation) confirmed present, exercised by `policy.test.ts` in the passing Jest run. CSRF: `src/server/csrf.ts` exists, `e2e/specs/csrf-origin.spec.ts` (117 lines) is substantive, `evidence/csrf-assessment.md` exists. **Distributed-store clause is a state/runtime property that cannot be exercised**: `src/server/ratelimit/upstashStore.ts` exists and is unit-tested against a mocked client, but `src/server/ratelimit/upstash.contract.test.ts` is `describe.skip`'d whenever no live store is configured (confirmed by reading the file — the guard is `const describeWithStore = config ? describe : describe.skip;`), and no store is configured in this environment or in production (disclosed, DI-42). "Holds across serverless instances" is asserted but has never been behaviorally exercised against a real store — present and wired, not proven |
| 5 | After each of the three slices the Playwright specs pass and the Validated workflow list is re-confirmed — every persona can sign in, non-McGill sign-in is rejected, banned users are blocked, organizers reach their club surfaces | ✓ VERIFIED | `evidence/floor.phase-after.txt` and `evidence/playwright.phase-after.txt` document 91/0 from a clean reset; `PHASE-5-COMPLETION.md` §4 walks all 16 Validated-workflow rows to specific, still-present spec files (`e2e/specs/banned-redirect.spec.ts`, `e2e/specs/club-owner-surfaces.spec.ts`, `e2e/specs/admin-write-paths.spec.ts`, etc. — all confirmed to exist and be non-trivial by line/test counts above). Non-McGill rejection re-confirmed independently: `src/app/auth/callback/route.test.ts` test 4 present and part of the 1651-passing Jest run in this session |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | "Every fail-open endpoint fails closed" (FO-02, the reminder cron's `Bearer undefined` comparison) and "every remaining service-role use goes through `src/server/db/elevated/`" (the two cron routes) | Phase 6 | Phase 6 Success Criterion 1 in ROADMAP.md: "Cron and webhook routes require credentials and fail closed when they are absent." REFAC-14 is a Phase 6 requirement. REQUIREMENTS.md's REFAC-13 row and PHASE-5-COMPLETION.md §2/§3/§8 all state this identically and name the same two files. Independently re-confirmed by reading both cron route files in this session |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/db/elevated/` | The one door to the service-role client | ✓ VERIFIED | `index.ts` exports `getElevatedClient()`; `REGISTRY.md` has populated justification rows, not placeholders |
| `eslint.elevated-allowlist.mjs` | Shrink-only ratchet, allow-list = 2 cron routes only | ✓ VERIFIED | Contents confirmed: exactly `send-feedback-requests/route.ts` and `send-reminders/route.ts` |
| `src/lib/env.ts` | Validated config replacing non-null assertions | ✓ VERIFIED | Exists; 0 remaining `process.env.X!` in non-test `src` |
| `src/server/ratelimit/upstashStore.ts` + `policy.ts` | Distributed rate-limit store, admin budgets | ✓ VERIFIED (exists, substantive, wired) but data-flow to a real store is DISCONNECTED in this environment/production | Store selection logic confirmed; contract test skip-guard confirmed; no live store configured |
| `src/server/csrf.ts` | CSRF origin check on state-changing routes | ✓ VERIFIED | Exists; exercised by `e2e/specs/csrf-origin.spec.ts` |
| `supabase/tests/database/050-users-privilege-escalation.test.sql`, `055-admin-audit-log-insert.test.sql`, `060-club-tenant-isolation.test.sql`, `065-events-moderated-update.test.sql`, `066-events-appeal-increment.test.sql` | RLS-ring allow/deny pgTAP coverage | ✓ VERIFIED, all green | Ran `supabase test db --local` fresh in this session: `Files=11, Tests=200, Result: PASS` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Admin API route handlers (26 files, 35 arms) | `requireRole(ctx, "admin")` | Direct call after `requireActiveUser(ctx)` | WIRED | Confirmed by grep count matching the phase's own claimed census exactly |
| Club API route handlers | `requireClubRole` | Direct call, 18 sites | WIRED | Confirmed by grep; 0 remaining hand-rolled `club_members` gate reads |
| Service-role consumers (non-cron) | `src/server/db/elevated/index.ts` | `getElevatedClient()` | WIRED | `grep -rln "createServiceClient("` shows nothing outside the factory, the door, the two disclosed cron routes, and tests |
| Proxy / route handlers | `getUser()` | Auth decision | WIRED | 0 gating `getSession(` calls remain |
| Rate limiter | Upstash store | `getRateLimitStore()` selection | PARTIAL — code path wired, runtime store absent | Selection logic present and unit-tested; no live store configured to complete the data flow in this environment or in production |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit/integration suite | `npx jest --ci` | `1 skipped, 87 passed, 87 of 88 suites; Tests: 1651 passed, 1 skipped, 1652 total; exit 0` | ✓ PASS (matches the floor documented for post-review-fix commits) |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint | `npm run lint` | 0 errors, 18 warnings, exit 0 | ✓ PASS |
| Dependency audit | `npm audit --audit-level=high --omit=dev` | 0 critical, 0 high, 2 moderate (yaml transitive, dev-tool only) | ✓ PASS (below the `high` gate) |
| Elevated-client ratchet | `node scripts/check-elevated-ratchet.mjs` | `committed=2 live=2 delta=0`, PASS | ✓ PASS |
| Characterization tag gate | `node scripts/check-characterization-tags.mjs --all` | `ok 34 files` | ✓ PASS |
| RLS ring (pgTAP, local stack) | `supabase test db --local` | `Files=11, Tests=200, Result: PASS` | ✓ PASS |
| Distributed rate-limit contract | `src/server/ratelimit/upstash.contract.test.ts` | `describe.skip`'d — no live store configured | ? SKIP (see behavior_unverified_items) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| REFAC-11 | 05-01..05-08, 05-19 | Slice 3: `getUser()`, advisory middleware, fail-closed ban, onboarding guard, validated config | ✓ SATISFIED (Complete per REQUIREMENTS.md `[x]`) | Truth 1 above |
| REFAC-12 | 05-01, 05-09..05-11, 05-19 | Slice 4: `requireClubRole` collapse, dual-ring cross-club denial | ✓ SATISFIED (Complete per REQUIREMENTS.md `[x]`) | Truth 2 above |
| REFAC-13 | 05-01, 05-12..05-16, 05-19 | Slice 5: fail-closed endpoints, admin guard, service-role containment, admin rate limiting | ✓ SATISFIED on 3 of 4 clauses; PARTIAL on cron (correctly `[ ]` in REQUIREMENTS.md, deferred to Phase 6/REFAC-14) | Truth 3 above; deferred item 1 |
| REFAC-17 | 05-01, 05-12, 05-17, 05-19 | CSRF assessment and protection | ✓ SATISFIED (Complete per REQUIREMENTS.md `[x]`) | Truth 4, CSRF clause |
| REFAC-18 | 05-01, 05-17, 05-18, 05-19 | Distributed rate-limit store | PARTIAL, correctly `[ ]` in REQUIREMENTS.md — needs owner action (Upstash provisioning), not a code gap | Truth 4, distributed-store clause; human_verification items |

No orphaned requirements: all 5 IDs declared in the phase (`Requirements: REFAC-11, REFAC-12, REFAC-13, REFAC-17, REFAC-18`) are claimed by at least one of the 19 plans (re-derived directly from each PLAN.md frontmatter), and REQUIREMENTS.md's phase-5 table row for each agrees with PHASE-5-COMPLETION.md.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers found in the 107 non-test source/migration files the phase touched (`git diff --name-only 27adf51..HEAD -- src supabase`, filtered to non-test paths, then grepped). No debt-marker blocker.

### Human Verification Required

See frontmatter `human_verification` for the full list with test/expected/why_human. Summary:

1. Countersign DEC-59's Upstash package pin (2.0.8, unsigned/no-provenance) or switch to 2.1.0 (provenance-attested) — the 05-18 blocking-human checkpoint went unanswered and was resolved autonomously.
2. Provision Upstash/KV in production and set `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` — required before any push to `main` per the phase's own evidence.
3. Decide DI-41 (GET invitation-acceptance CSRF exposure) — a UX tradeoff reserved for the owner.
4. Run the pre-deploy blast-radius count (un-onboarded / profile-less production users).
5. Decide whether to apply the two local-only Critical migrations (F-006, F-007) to production ahead of the Phase 8 repair (DI-23), or leave both exploitable in production until then.

### Gaps Summary

No BLOCKER-level gaps. The phase goal — one fails-closed authorization ring, dual-ring cross-tenant/escalation denial, and a single registered door to the service-role client — is achieved in the codebase and independently re-derived by direct grep/test execution rather than trusting SUMMARY.md or PHASE-5-COMPLETION.md's narrative. The two-item cron exception to "exactly one door" is real, disclosed accurately, and owned by Phase 6 (REFAC-14) with matching ROADMAP.md Success Criteria — filed as `deferred`, not a gap. The distributed rate-limit store is code-complete but runtime-unproven and requires an owner infrastructure action; combined with the unanswered 05-18 package-legitimacy checkpoint and several other named owner decisions (DI-41, the blast-radius count, the two local-only Critical migrations), this phase has real pending human/owner actions before it is safe to push to `main` — hence `human_needed` rather than `passed`.

---

_Verified: 2026-09-25T20:56:02Z_
_Verifier: Claude (gsd-verifier)_
