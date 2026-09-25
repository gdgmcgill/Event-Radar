---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 17
subsystem: api
tags: [rate-limiting, csrf, proxy, F-090, F-058, DEC-50, DEC-52, REFAC-13, REFAC-17, REFAC-18, playwright, mutation-check]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-12: the F-090 e2e pins (e2e/specs/csrf-origin.spec.ts). 05-16: floor Jest 1325/1325, Playwright 91/91, pgTAP 156, tag gate ok 34"
provides:
  - "src/server/ratelimit/: RateLimitStore/RateDecision (types.ts), rateLimitPolicy/clientIp/tooManyRequests/ADMIN_BUDGETS/PUBLIC_BUDGETS (policy.ts), MemoryRateLimitStore/consumeSync (memoryStore.ts), applyRateLimit/getRateLimitStore (index.ts)"
  - "/api/admin/* rate limited: 600 GET and 120 mutation per IP, per path, per 60 s"
  - "src/server/csrf.ts: isCrossSiteMutation and crossSiteBlocked, called by the proxy after the limiter and before session work"
  - "evidence/csrf-assessment.md: REFAC-17's written assessment, seven residuals owned"
affects: [05-18, 05-19, phase-06, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A store interface that only counts (consume(key, limit, windowMs) → { allowed, limit, resetAtMs }); the policy owns the key, the budget and the 429, so a distributed store is a drop-in"
    - "A sync wrapper and an async entry point share one policy module and one bucket map, proved by an equivalence table under a frozen clock"
    - "A pure request predicate with a proxy-level test that asserts the refusal happens before createServerClient is built"

key-files:
  created:
    - src/server/ratelimit/types.ts
    - src/server/ratelimit/policy.ts
    - src/server/ratelimit/memoryStore.ts
    - src/server/ratelimit/index.ts
    - src/server/ratelimit/policy.test.ts
    - src/server/ratelimit/memoryStore.test.ts
    - src/server/csrf.ts
    - src/server/__tests__/csrf.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/ratelimit.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/csrf.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/csrf-assessment.md
  modified:
    - src/middlewareRateLimit.ts
    - src/proxy.ts
    - e2e/specs/csrf-origin.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md

key-decisions:
  - "The rate-limit rule carries a scope ('public' | 'admin'). The sync wrapper returns null for the admin scope, so its PRESERVE 'exempts /api/admin/*' case stays true while the async path budgets admin"
  - "The admin prefix match stays startsWith('/api/admin'), the same predicate the old exclusion used, so no path moves between the public and admin budgets"
  - "MemoryRateLimitStore's default clock is () => Date.now(), read at call time. Capturing the Date.now reference at construction let the two paths count on different clocks under a spied clock"
  - "The CSRF host is x-forwarded-host's first entry, else host, else nextUrl.host, lower-cased. new URL(origin).host drops default ports, so https://x:443 matches host x"
  - "REFAC-17 is marked complete here. REFAC-18 continues in 05-18 (the Upstash store) and REFAC-13 closes at 05-19 (slice close), so neither is marked"

patterns-established:
  - "Budgets live once in src/server/ratelimit/policy.ts; any new limiter entry point reads rateLimitPolicy rather than restating numbers"

requirements-completed: [REFAC-17]  # REFAC-13 (rate-limit clause delivered) closes at 05-19; REFAC-18 (interface delivered) completes with 05-18's store

# Metrics
duration: 15min
completed: 2026-09-25
---

# Phase 5 Plan 17: Rate limiting behind a store interface, and the CSRF origin check Summary

**The limiter now runs from a `RateLimitStore` interface. The budgets live in one policy module, and `/api/admin/*` is budgeted at 600 GET and 120 mutation requests per IP, per path, per minute. The 601st admin GET and the 121st admin POST get the existing 429. A state-changing `/api/*` request that carries `Sec-Fetch-Site: cross-site`, or an `Origin` from another host, now gets 403 `{"error":"Cross-site request blocked"}` in the proxy before any session work. Same-origin browsers and header-less machine callers still pass. The F-090 e2e pins flipped to FIXED. `evidence/csrf-assessment.md` assesses the exposure against the `@supabase/ssr` 0.7.0 cookies as installed and gives each of seven residuals a severity and an owner. Jest 1397/1397, Playwright 91/91.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-09-25T05:26:07Z
- **Completed:** 2026-09-25T05:41:00Z
- **Tasks:** 2
- **Files modified:** 15 (11 created, 4 modified)

## Accomplishments

- **Store interface (REFAC-18, first half).** `RateLimitStore.consume(key, limit, windowMs)` is the whole contract. The memory store keeps the same `globalThis.__uni_verse_mw_rate_limit__` map and the same prune-then-fixed-window-from-first-hit counting. `getRateLimitStore()` is the only place 05-18 needs to touch to select Upstash.
- **One copy of the budgets.** `policy.ts` holds the public budgets (unchanged: 300 GET, 30 mutation, 300 for the two analytics prefixes), `ADMIN_BUDGETS` (600/120, with DEC-50's rationale in the comment), `clientIp` (x-real-ip first, research A5) and the byte-identical 429 builder. `src/middlewareRateLimit.ts` has no budget literal left. `applyApiRateLimit` is still synchronous and public-only, and its PRESERVE suite passes unedited.
- **Admin budgets (REFAC-13's rate-limit clause, F-058).** The proxy's first statement is `await applyRateLimit(request, getRateLimitStore())`. `evidence/ratelimit.txt` §9 counts the moderation fan-out: no page load reaches any one admin path more than once, and the widest (`/moderation/stats`) reaches three paths once each.
- **Equivalence.** An eight-row table (seven public `/api` shapes plus one non-`/api` path) runs budget + 2 times through both paths under a frozen clock. On every call the status, body and four headers match.
- **CSRF check (REFAC-17, F-090, DEC-52).** `isCrossSiteMutation` is pure. It never checks GET/HEAD/OPTIONS or non-`/api` paths. It refuses `Sec-Fetch-Site: cross-site`, a foreign `Origin` host, and a `null` or unparseable `Origin`. It passes requests that carry neither header. The proxy calls it after the limiter and before the env reads. The index order is recorded, and a Jest case proves `createServerClient` is never built for a refused request.
- **Assessment.** The installed cookie attributes are quoted from `constants.js`: `SameSite=Lax`, `HttpOnly` false, no `Secure`, `Path=/`, 400 days. It covers what Lax sends and withholds, the absence of any Server Action (so route handlers had no built-in origin check), the control and what it passes on purpose, and seven residuals: DI-41 invites GET, recommendations GET, `needs_onboarding`, legacy browsers, `Secure`/HSTS/DI-43, Chrome's Lax+POST window (A3), and `/auth/signout`. It closes with the tests that prove each arm.

## Task Commits

1. **Task 1: RateLimitStore, one policy with admin budgets, the memory store, and the proxy on the async entry point.** `408064d` (feat, INTENTIONAL BEHAVIOUR CHANGE)
2. **Task 2: The CSRF origin check in the proxy, its e2e flip, and the written assessment.** `f245d58` (feat, INTENTIONAL BEHAVIOUR CHANGE)

The plan metadata commit follows this summary. It carries the ledger rows' fix hash (`f245d58`).

## Floor after this plan

| Gate | 05-16 floor | After 05-17 |
|------|-------------|-------------|
| `npx jest --ci` | 1325 passed, 71 suites | 1397 passed, 74 suites (+31 ratelimit, +41 csrf) |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors | 0 errors (18 pre-existing warnings, none in a touched file) |
| tag gate | ok 34 | ok 34 |
| Playwright | 91/91 | 91/91 full suite (fresh reset); plan specs 17/17 twice from clean resets |
| pgTAP | Files=9 Tests=156 | not re-run (no schema change) |

## Decisions Made

See `key-decisions` in the frontmatter. DEC-50 and DEC-52 were executed as written. The admin budget's rationale is stated in `policy.ts` and in `evidence/ratelimit.txt` §9.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The memory store's default clock was captured at construction**
- **Found during:** Task 1 (equivalence test)
- **Issue:** `constructor(now = Date.now)` stored the original function reference, so under a spied `Date.now` the async path counted on the real clock while the sync wrapper used the spied one. The sync path's prune then deleted the async path's buckets.
- **Fix:** the default is `() => Date.now()`, read on every call. The docblock says why.
- **Files modified:** src/server/ratelimit/memoryStore.ts
- **Commit:** 408064d

**2. [Rule 3 - Blocking] tsc rejected two `it.each` header tables in csrf.test.ts**
- **Found during:** Task 2
- **Issue:** TypeScript inferred the tables as unions with optional keys, which are not assignable to `Record<string, string>`.
- **Fix:** typed them `it.each<Record<string, string>>`.
- **Files modified:** src/server/__tests__/csrf.test.ts
- **Commit:** f245d58

### Additions beyond the plan's letter (no behaviour outside scope)

- **Proxy-level CSRF cases:** 403 before `createServerClient`, 403 with the env removed, same-origin and header-less requests reaching session work, and the rate limit answered before the origin check. They sit in `csrf.test.ts`, so the PRESERVE proxy suites stay unedited.
- **Mutation checks:** two for the rate-limit tests and six for the CSRF tests. Each went red and was restored cmp-identical.
- **Ledger protocol for the e2e flip:** step 2 (the 05-12 spec unedited against the fixed proxy: red on exactly the two DEFECT tests) and step 4 (the flipped spec against the proxy without the check: red on exactly the two FIXED tests).
- **Full Playwright run:** 91/91 from a fresh reset, confirming every other spec is unaffected by the origin check and the admin budgets.
- **One commit per task, no separate RED commit:** the plan names one commit per task, and prior Phase 5 plans follow that pattern. The RED runs are recorded in `evidence/ratelimit.txt` §3 and `evidence/csrf.txt` §2.

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking type error). **Impact:** none on scope.

## Notes for later plans

- `src/middlewareRateLimit.test.ts` and `scripts/smoke.sh:96` cite line numbers in `src/middlewareRateLimit.ts` (for example `:28 LIMITS.POST`) that no longer exist. The constants are still true in `policy.ts`. The PRESERVE file may not be edited, and `smoke.sh` is out of scope. Left as is.
- F-090's status and resolution in `.planning/audit/findings.json` are for the slice-close plan (DEC-57). This plan edits only the ledger.
- Converting `/invites/[token]` acceptance to a POST remains the owner's call (DI-41). The assessment records it as a Low residual.

## Known Stubs

None.

## Threat Flags

None. The plan's threat model covers every surface this plan touches: the CSRF boundary, the IP-keyed limiter and the admin budgets.

## Issues Encountered

None beyond the deviations above. Every Playwright run passed on its first attempt, apart from the two deliberate protocol-red runs.

## Next Phase Readiness

05-18 can add `UpstashRateLimitStore implements RateLimitStore` and select it in `getRateLimitStore()` without touching the policy, the memory path or the proxy. The local stack is left reset and seeded, and port 3000 is free.

## Self-Check: PASSED

All 12 created files are present, and commits 408064d and f245d58 are in the log.
