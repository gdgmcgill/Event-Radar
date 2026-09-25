---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 18
subsystem: api
tags: [rate-limiting, upstash, redis, supply-chain, DEC-50, DEC-51, DEC-59, REFAC-18, instrumentation, playwright]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-17: RateLimitStore interface, policy.ts budgets, MemoryRateLimitStore, applyRateLimit/getRateLimitStore; floor Jest 1397/1397, Playwright 91/91, tag gate ok 34, ratchet 2/2"
provides:
  - "@upstash/ratelimit 2.0.8 and @upstash/redis 1.38.2, exact pins (DEC-59 verdict 'use 2.0.8')"
  - "src/server/ratelimit/upstashStore.ts: UpstashRateLimitStore (explicit Redis client, telemetry off, fixedWindow per budget, prefix uv:rl, 1000 ms timeout, analytics off, fail-open on timeout or store error)"
  - "src/lib/env.ts: upstashConfig() (whole UPSTASH_* then KV_* pairs, never throws), rateLimitRequireDistributed() (optional validated flag), InvalidEnvError, UPSTASH_ENV_NAMES"
  - "getRateLimitStore() selects Upstash when configured, else memory with one warning; rateLimitStoreKind() for health reporting"
  - "register(): production without a store logs one error and serves; RATE_LIMIT_REQUIRE_DISTRIBUTED=true refuses to start"
  - "playwright.config.ts webServer.env blanks the four store names and the flag"
  - "evidence/upstash-legitimacy.txt (registry bundle + verdict), evidence/upstash-install.txt (install, lockfile review, audit, tests, build, boot probes, mutations, Playwright)"
affects: [05-19, phase-06, phase-08]

# Tech tracking
tech-stack:
  added: ["@upstash/ratelimit 2.0.8", "@upstash/redis 1.38.2", "@upstash/core-analytics 0.0.10 (transitive)", "uncrypto 0.1.3 (transitive)"]
  patterns:
    - "A distributed store fails open: a timeout or an error allows the request and logs the key, never the token"
    - "Store selection happens once per process and is observable (rateLimitStoreKind)"
    - "An optional boolean env flag is validated: a value other than true/false is rejected, so a typo cannot switch a fail-closed control off"
    - "Contract tests against live services are describe.skip with the reason in the title, and a Jest JSON check proves they are the only pending tests"

key-files:
  created:
    - src/server/ratelimit/upstashStore.ts
    - src/server/ratelimit/upstashStore.test.ts
    - src/server/ratelimit/upstash.contract.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/upstash-legitimacy.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/upstash-install.txt
  modified:
    - package.json
    - package-lock.json
    - src/lib/env.ts
    - src/lib/env.test.ts
    - src/server/ratelimit/index.ts
    - src/instrumentation.ts
    - src/instrumentation.test.ts
    - playwright.config.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md

key-decisions:
  - "Installed @upstash/ratelimit 2.0.8 and @upstash/redis 1.38.2 exact, per the DEC-59 rule-resolved verdict 'use 2.0.8'. Both are older than 30 days. The owner's countersignature is carried to 05-19"
  - "DEC-59 Part 2 replaces DEC-50's boot clause: production without a store logs one error and serves from the memory store. RATE_LIMIT_REQUIRE_DISTRIBUTED=true restores the fail-closed boot. The flag applies wherever it is set, not only in production"
  - "upstashConfig() takes whole pairs only (UPSTASH_* first, then KV_*). It never combines a URL from one pair with a token from the other, and it never throws"
  - "A store error (not only a timeout) allows the request. @upstash/ratelimit propagates Redis errors, and without the catch the proxy would answer 500 on every /api request during a store outage"
  - "The Upstash window comes from the policy's windowMs ('60000 ms'), not a hardcoded '60 s', so the store honours the RateLimitStore contract. The policy passes 60 000 ms, so the effective window is the same"

patterns-established:
  - "New third-party runtime dependencies enter through a registry bundle (npm view, dry-run pack, tarball integrity, lifecycle-script and native-file scan) and one reviewed lockfile diff"

requirements-completed: [REFAC-18]

# Metrics
duration: 16min
completed: 2026-09-25
---

# Phase 5 Plan 18: The Upstash rate-limit store Summary

**Rate limiting can now count in Upstash Redis, shared across serverless instances. The store is `@upstash/ratelimit` 2.0.8 with a fixed window, over an explicitly built `@upstash/redis` 1.38.2 client with telemetry off. It is selected when `UPSTASH_REDIS_REST_*` or the Marketplace's `KV_REST_API_*` pair is configured. Without a pair, the in-memory store is used and one warning is logged. In production that case also logs one error at boot, and the server keeps serving (DEC-59). `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` turns a missing store into a refusal to start. A store timeout (1000 ms) or error lets the request through and is logged. The lockfile gained exactly four entries, the production audit is unchanged at 0 high/0 critical, Jest has 1438 passing tests plus 1 skipped (the live contract), and Playwright is 91/91.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-09-25T05:44:24Z
- **Completed:** 2026-09-25T05:59:28Z
- **Tasks:** 3 (Task 2 resolved by rule, see Deviations)
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments

- **Legitimacy bundle (Task 1).** `evidence/upstash-legitimacy.txt` covers both the plan's proposed pins (2.1.0 / 1.38.4) and the chosen pins (2.0.8 / 1.38.2), plus `@upstash/core-analytics` 0.0.10 and `uncrypto` 0.1.3. It records `npm view` output (maintainers, publisher, repository, deps, scripts, integrity, attestations), publish dates and ages, `npm pack --dry-run` listings, and six tarballs fetched to the scratchpad. For each tarball: sha512 equals `dist.integrity`, there are no install-time lifecycle scripts, and there are no native files. A code-surface scan and a summary table close the bundle. Nothing was installed while it was built.
- **The install.** One `npm install --save-exact`. The lockfile gained 4 entries, with 0 removed, 0 re-resolved and `lockfileVersion` 3 unchanged. `npm ls` shows `@upstash/redis` deduped under core-analytics. `npm ci --dry-run` exits 0. `npm audit --audit-level=high --omit=dev` exits 0 with the same 2 moderate findings as before.
- **UpstashRateLimitStore.** One Redis client per store. One `Ratelimit` per (limit, window), kept for the module's lifetime so the ephemeral cache works. A result maps to `{ allowed: success, limit, resetAtMs: reset }`. A timeout logs `[RateLimit] store timeout; request allowed` with the key, and a store error logs `[RateLimit] store error; request allowed` with the key and message.
- **Selection and boot.** `getRateLimitStore()` chooses the store once, and `rateLimitStoreKind()` reports the choice. `register()` reads the flag first (a malformed value refuses to start). It then either passes, logs the one degraded-production error, or refuses when the flag is set.
- **Measured on a real `next start`** (`upstash-install.txt` §10), one run per scenario:
  - Production with no store: requests are served (503 from the health route itself), with one error and one warning.
  - Production with the enforce flag: `[Config] refusing to start` naming both pairs, and every request answered 500.
  - A configured but unreachable store: the Upstash store is selected, every call is allowed after the 1000 ms timeout, and the token is never logged.
- **Harness guard.** `webServer.env` sets the four store names and `RATE_LIMIT_REQUIRE_DISTRIBUTED` to `""`. The harness server logged the memory-store warning exactly once in each run.
- **Tests.** 41 new passing tests: env +19, instrumentation +8, upstashStore 14. The contract suite is `describe.skip` with its reason in the title. A Jest JSON check confirms it is the only pending test. Ten mutation checks all went red and were each restored byte-identical.

## Task Commits

1. **Task 1: Assemble the package-legitimacy bundle without installing anything.** `76db9c6` (docs)
2. **Task 2: Human package-legitimacy verification, resolved by rule per DEC-59.** `01941cc` (docs, the verdict appended verbatim)
3. **Task 3: Install the chosen exact versions, add UpstashRateLimitStore, select by validated config, degrade loudly in production, guard the harness.** `941bee7` (feat, INTENTIONAL BEHAVIOUR CHANGE). TDD: the RED run (23 failed, including "Cannot find module './upstashStore'") is recorded in `upstash-install.txt` §5. It is one commit per task, following the Phase 5 pattern.

## Floor after this plan

| Gate | 05-17 floor | After 05-18 |
|------|-------------|-------------|
| `npx jest --ci` | 1397 passed, 74 suites | 1438 passed + 1 skipped (live contract), 76 suites (75 run, 1 skipped) |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 18 warnings | 0 errors, 18 warnings (none in a touched file) |
| `npm audit --audit-level=high --omit=dev` | exit 0 | exit 0 (2 moderate, unchanged) |
| CI-env build | exit 0 | exit 0 (store variables blanked too) |
| tag gate | ok 34 | ok 34 |
| ratchet | 2/2 | committed=2 live=2 delta=0 |
| Playwright | 91/91 | plan specs 20/20 from a clean reset; full suite 91/91 from a second clean reset |

## Decisions Made

See `key-decisions` in the frontmatter. DEC-59 Parts 1 and 2 were executed as written.

## Deviations from Plan

### Checkpoint resolved by rule

**Task 2 (checkpoint:human-verify, gate="blocking-human") was resolved by rule per DEC-59, not by a named human.** The orchestrator committed DEC-59 (db1a43f) before dispatch, with the verdict "use 2.0.8". The verdict line was appended verbatim to `evidence/upstash-legitimacy.txt` (commit `01941cc`), and execution continued without stopping. The plan's acceptance criterion "ends with the human verdict naming the person" is therefore met by the orchestrator's rule-recorded verdict, not by a person. **The owner's countersignature is carried as a human-verify item for 05-19's phase completion note** (also recorded as DI-42 step 1c).

**Carried to the countersignature (a registry fact, not a verdict change):** the chosen `@upstash/ratelimit` 2.0.8 was published manually by `cahidarda` (a listed maintainer on every Upstash package) and has **no provenance attestation**. The proposed 2.1.0 was published from GitHub Actions with SLSA provenance. The tarball integrity matches the registry for both. DEC-59's table describes the maintainers as "Upstash org accounts (`*@upstash.com`, `upstashnpm`)". The bundle records the actual publisher of each version, and for core-analytics 0.0.10 that is `hezarfen`, a gmail account that is a listed maintainer. Both redis pins carry provenance.

### Superseded by DEC-59 Part 2 (the plan's boot clause)

- **Plan:** `upstashConfig()` throws `MissingEnvError` in production when both pairs are absent, and `register()` rejects.
- **Built:** `upstashConfig()` never throws. `register()` logs one error naming all four variables and the degradation, and the server keeps serving. It rejects only when `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` (or when the flag is malformed). `RATE_LIMIT_REQUIRE_DISTRIBUTED` was added to the validated readers as optional. Unit tests cover the three branches the orchestrator named and five more. All three branches were measured on a built server.

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A store error would have answered 500 on every /api request**
- **Found during:** Task 3 (reading `@upstash/ratelimit` `limit()`: Redis errors propagate, and only the timeout is caught)
- **Issue:** The plan handled only `reason === "timeout"`. A rejected `limit()` (network, auth, quota) would reject `applyRateLimit`, and the proxy's catch-all answers 500, which contradicts DEC-50's availability-over-limiting rule.
- **Fix:** `consume()` catches, logs `[RateLimit] store error; request allowed` with the key and the error message (never the token), and allows the request. Unit-tested and mutation-checked.
- **Files modified:** src/server/ratelimit/upstashStore.ts
- **Commit:** 941bee7

**2. [Rule 1 - Bug] Pair mixing in the research's `upstashConfig` sketch**
- **Found during:** Task 3
- **Issue:** `UPSTASH_URL || KV_URL` with `UPSTASH_TOKEN || KV_TOKEN` could pair one integration's URL with the other's token.
- **Fix:** whole pairs only (UPSTASH first, then KV). Tested, including the half-set case.
- **Files modified:** src/lib/env.ts
- **Commit:** 941bee7

**3. [Rule 2 - Missing critical functionality] A typo in the opt-in fail-closed flag**
- **Found during:** Task 3
- **Issue:** Reading any value other than "true" as false would let `RATE_LIMIT_REQUIRE_DISTRIBUTED=1` silently leave the boot open.
- **Fix:** values other than true/false (case-insensitive) throw `InvalidEnvError`, and `register()` logs the error and refuses to start.
- **Files modified:** src/lib/env.ts, src/instrumentation.ts
- **Commit:** 941bee7

### Additions beyond the plan's letter

- `RATE_LIMIT_REQUIRE_DISTRIBUTED` is blanked in `webServer.env` (a fifth name), so a developer `.env` that opts into the fail-closed boot cannot stop the harness server.
- `rateLimitStoreKind()` is exported for the Phase 6 health route that DEC-59 mentions. Nothing calls it yet.
- The CI-env build also blanks the store variables. Three boot probes, ten mutation checks and a full Playwright run were added.
- DI-42 in `evidence/deferred-items.md` was amended: item 1 is no longer a boot blocker, step 1b is to set the enforce flag after provisioning, and step 1c is to countersign the package verdict.

**Total deviations:** 1 checkpoint resolved by rule, 1 superseded clause, 3 auto-fixed (2 missing critical, 1 bug). **Impact:** none on scope. The fail-open fixes enforce DEC-50's own rule.

## Human-verify items carried to 05-19

1. **Countersign the Upstash package verdict** ("use 2.0.8": `@upstash/ratelimit` 2.0.8, `@upstash/redis` 1.38.2) from `evidence/upstash-legitimacy.txt`. Note that 2.0.8 has no provenance attestation. Reversal path: DEC-59 § Reversing.
2. **DI-42 item 1:** provision Upstash (both name pairs, `iad1`), then set `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`. Until then, production rate limiting is per instance.
3. **Optionally,** run `src/server/ratelimit/upstash.contract.test.ts` against a disposable store once one exists. It was skipped in this plan.

## Known Stubs

None. `rateLimitStoreKind()` has no caller yet. It is complete and exported for Phase 6's health route, not a placeholder.

## Threat Flags

None. The only new outbound surface is server → Upstash REST, which is in the plan's threat model (T-05-18-01, -03). The code sends it no analytics and no telemetry, and it is unreachable from local and CI runs (T-05-18-04).

## Issues Encountered

- `@upstash/redis` retries connection errors, so against an unreachable store the library's 1000 ms timeout wins before any error surfaces. Each request then completes in about 1.0 to 1.1 s. That is DEC-50's accepted bound. The library may keep retrying in the background after the timeout, but the request is not held.
- `npm install` printed "9 vulnerabilities (… 2 high, 1 critical)". That count includes devDependencies. The production gate (`--omit=dev`, as CI runs it) is unchanged at 2 moderate.

## Next Phase Readiness

05-19 can close slice 5. REFAC-18 is delivered: the interface came from 05-17, and the distributed store, selection and boot arm come from this plan. The countersignature and DI-42 are listed above for the completion note. The local stack is left reset and seeded, and ports 3000 and 3100 are free.

## Self-Check: PASSED

All 5 created files are present, and commits 76db9c6, 01941cc and 941bee7 are in the log.
