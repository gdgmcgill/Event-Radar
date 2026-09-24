---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 04
subsystem: auth
tags: [env, config, instrumentation, seam-guards, ban, onboarding, F-003, F-027, DEC-34, DEC-35, DEC-37]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-02: the F-003 env census and the proxy ring nets; 05-03: the handler-ring nets (one users read per guarded arm; the DEC-35 bytes)"
provides:
  - "src/lib/env.ts: MissingEnvError, requireEnvValue, supabaseUrl, supabaseAnonKey, isVercelProduction. Values are read lazily with literal member reads"
  - "serviceRoleKey() in src/lib/supabase/service.ts, the only service-key read the plan owns"
  - "src/instrumentation.ts register(): a boot completeness check, guarded for the build phase and the edge runtime"
  - "assertElevatedConfigured() in the elevated door"
  - "requireActiveUser (401 / 403 Profile not found / 403 Account suspended) and requireOnboarded (anonymous passes / 403 Profile not found / 403 Onboarding required)"
  - "RequestProfile and PROFILE_COLUMNS widened to banned_at and ban_expires_at; one users read serves every guard"
  - "/api/auth-debug deleted (F-027)"
  - "F-003 env census moved from 15 to the callback's 4 (ledger row)"
affects: [05-05, 05-06, 05-07, 05-08, 05-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy validated env: requireEnvValue(name, process.env.LITERAL) at first read, never at import and never by computed key"
    - "Boot check through instrumentation register(), skipped when NEXT_RUNTIME is not nodejs or NEXT_PHASE is phase-production-build"
    - "Seam guards read ctx.profile only, and a null profile is denied (fail closed)"

key-files:
  created:
    - src/lib/env.ts
    - src/lib/env.test.ts
    - src/instrumentation.ts
    - src/instrumentation.test.ts
    - src/server/authz/requireActiveUser.ts
    - src/server/authz/requireOnboarded.ts
    - src/server/__tests__/requireActiveUser.test.ts
    - src/server/__tests__/requireOnboarded.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/env-and-guards.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/build-ci-env.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/boot-check.txt
  modified:
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/service.ts
    - src/app/auth/signout/route.ts
    - src/lib/__tests__/env-assertions-defect.test.ts
    - src/server/db/elevated/index.ts
    - src/server/context.ts
    - src/server/__tests__/context.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
  deleted:
    - src/app/api/auth-debug/route.ts

key-decisions:
  - "The boot check means 'refuses to serve', not 'process exits'. Measured on Next 16.3.5: next start prints Ready and runs register() lazily on the first request. A throw produces 'Failed to prepare server' and a 500 on every request, and the process keeps running"
  - "Research A1 was measured. The CI-env build exits 0 even with the NEXT_PHASE guard removed, so Next 16.3.5 does not call register() in build workers. The guard stays as DEC-37 requires, and a unit case pins it"
  - "register() imports the elevated door dynamically, on the nodejs branch only, so the edge compilation never bundles the service module"
  - "requireOnboarded admits only onboarding_completed === true. A null value is refused (fail closed)"

patterns-established:
  - "Import-free Jest test files carry `export {};` so tsc treats them as modules and their top-level names do not collide"

requirements-completed: []  # REFAC-11 is partly delivered here (validated config, and the guards exist). The proxy and handler adoption in 05-05..05-07 close it

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 04: Validated Config and Seam Guards Summary

**This plan added lazy `MissingEnvError` readers and routed the three Supabase factories and the sign-out route through them. It also added a `register()` boot check (measured: a server missing the service key answers 500 and logs the variable's name) and the two fail-closed seam guards `requireActiveUser` and `requireOnboarded` with the exact DEC-34/DEC-35 bytes. `/api/auth-debug` is deleted. The CI-env build still exits 0, and every PRESERVE suite passes unedited.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-09-24T05:02:41Z
- **Completed:** 2026-09-24T05:27:21Z
- **Tasks:** 3 of 3, plus one follow-up style commit
- **Files:** 11 created, 9 modified, 1 deleted

## Accomplishments

- **Validated config (Task 1).** `src/lib/env.ts` never reads at import and never by computed key. The two public readers and `isVercelProduction()` key production on `VERCEL_ENV`.
  - `server.ts` and the sign-out route call `supabaseUrl()` and `supabaseAnonKey()`.
  - `client.ts` keeps literal `NEXT_PUBLIC_*` reads so the browser bundle inlines them, and wraps each in `requireEnvValue`.
  - `service.ts` exposes `serviceRoleKey()`, and that read stays in its lint home.
- **F-027.** `/api/auth-debug` is deleted. A grep before deletion found no caller in `src` or `e2e`. `endpoints.json` was not touched (DEC-55).
- **F-003 census step one.** The census moved from 15 pairs to the callback's 4. It followed the ledger protocol: the unedited suite went red, the moved suite went green, a pre-fix restore went red, and the fixed source was restored byte-identical (`cmp`).
- **C8 proven.** `SUPABASE_SERVICE_ROLE_KEY= NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key npm run build` exits 0 (`build-ci-env.txt`).
- **Boot check (Task 2).**
  - `register()` validates all three variables, logs `[Config] refusing to start: <message>` and rethrows.
  - The door's `assertElevatedConfigured()` validates the key without building a client.
  - There are 10 unit cases: all set; each of three unset; each of three blank; build phase; edge; no runtime.
  - `boot-check.txt` records:
    - the build exits 0 with and without the phase guard;
    - a start probe with a blank key answers 500 with `MissingEnvError` naming `SUPABASE_SERVICE_ROLE_KEY`;
    - a control run with a dummy key reaches the health route, which answers 503;
    - `lsof -i :3100` exits 1 after every run.
- **Seam guards (Task 3).** `requireActiveUser` has 8 cases and `requireOnboarded` has 6. Every deny arm asserts its status and its body with `await result.response.json()`.
  - `PROFILE_COLUMNS` is now `"id, roles, onboarding_completed, banned_at, ban_expires_at"`.
  - The context docblock now names both guards and records that DI-35 is closed.

## Task Commits

1. **Task 1: lazy validated config, readers rewired, auth-debug deleted, census step one.** `7bef995` (refactor)
2. **Task 2: boot completeness check in register().** `6e716fb` (feat)
3. **Task 3: requireActiveUser and requireOnboarded, profile slice widened.** `853f405` (feat)
4. **Follow-up: service-key read on one line so the acceptance grep matches.** `9f75904` (style)

## Floor after this plan

| Gate | Before (05-03) | After |
|---|---|---|
| `npx jest --ci` | 968 passed, 58 suites | 1008 passed, 0 failed, 62 suites (+16 env, +10 instrumentation, +8 active-user, +6 onboarded) |
| `node scripts/check-characterization-tags.mjs --all` | ok 26 | ok 26 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors | 0 errors (19 warnings, all in files this plan did not touch) |
| `node scripts/check-elevated-ratchet.mjs` | committed=25 live=25 | committed=25 live=25 (instrumentation is not in the census) |
| CI-env `npm run build` | not measured | exit 0 |
| PRESERVE diff vs `8b5d240` | n/a | empty for all 13 PRESERVE files and the PRESERVE+DEFECT file |

## Decisions Made

- **Boot-check semantics were measured, not assumed.** Next 16.3.5 runs `register()` when it prepares the server for the first request, not at "Ready". A throwing `register()` gives "Failed to prepare server" and a 500 per request, and the process does not exit. The unit tests are the authority on `register()`. The evidence records Next's behaviour as observed.
- **A1 is closed by measurement.** The build does not invoke `register()` even with the guard removed. The guard is kept because DEC-37 requires it, as a hedge against a future Next.
- **`register()` loads the door with a dynamic import on the nodejs branch.** This keeps the service module out of the edge bundle, following Next's instrumentation guide. The lint rule bans dynamic imports of the service module only, not of the door.
- **`requireOnboarded` treats `null` as not onboarded.** Only `true` admits, per the plan's behaviour list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A stale generated `.next/dev/types` broke tsc and the build after the route deletion**
- **Found during:** Task 1
- **Issue:** `tsconfig.json` includes `.next/dev/types/**/*.ts`. A `next dev` run on 2026-09-16 had left a `validator.ts` that imports the deleted `auth-debug` route. The first CI-env build and tsc failed with TS2307. Only `next dev` regenerates that directory, and a clean CI checkout never has it.
- **Fix:** removed the gitignored `.next/dev/types` directory. No tracked file changed. Both failures and the fix are recorded verbatim in `build-ci-env.txt` and `env-and-guards.txt` §1f.
- **Commit:** `7bef995` (evidence only)

**2. [Rule 1 - Bug] Two import-free test files collided under tsc**
- **Found during:** Task 2
- **Issue:** `env.test.ts` and `instrumentation.test.ts` had no top-level import or export, so tsc treated them as scripts sharing the global scope (TS2451 and TS2300 on `MANAGED_KEYS`, `env`, `saved`). The CI-env build's type check failed as a result.
- **Fix:** added `export {};` with a one-line reason to both files.
- **Commit:** `6e716fb`

**3. [Rule 1 - Acceptance] The service-key read was wrapped across lines**
- **Found during:** final acceptance pass
- **Issue:** the criterion greps the one-line string `requireEnvValue("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)`.
- **Fix:** joined the call onto one line under `// prettier-ignore`. No behaviour change.
- **Commit:** `9f75904`

### Rule-resolved choices

- **Census file edit scope.** The plan says to change "only the expected list". The comment directly above the list and the count in the first test's title ("15" → "4") were also updated, because leaving them would make them false. The docblock and the tag are unchanged, and the ledger row records the scope.
- **One commit per task, not separate RED and GREEN commits.** The plan fixes one commit message per task. Each RED run is recorded verbatim in the evidence instead: env 16 failed, instrumentation 10 failed, guards cannot-find-module, context 1 failed.
- **An extra start-probe run.** The first probe requested `127.0.0.1`, while Next listened on the `localhost` IPv6 loopback, so that run was refused and never exercised `register()`. It is kept in the evidence as (b1). The probe was then repeated against `localhost` (b2), and a control run was added (b3).

## TDD Gate Compliance

`tdd="true"` tasks: tests were written first and seen red before implementation (evidence §1b, Task 2 RED block, §3a/§3b). Per the plan's commit spec, test and implementation share each task's single commit, so there are no separate `test(...)` commits.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None. `src/instrumentation.ts` names the Upstash arm that 05-18 adds (DEC-50). That is a documented hand-off, not a stub.

## Threat Flags

None. No new endpoint, auth path or schema change. One endpoint was removed (F-027). The only new file on a runtime path is `src/instrumentation.ts`, and it logs variable names, never values.

## Next Phase Readiness

- 05-05 (proxy and callback) can use `supabaseUrl()`, `supabaseAnonKey()` and `isVercelProduction()`. It also empties the census of the callback's 4 remaining pairs.
- 05-06 and 05-07 can adopt `requireActiveUser` then `requireOnboarded`. Each guard reads the widened context row and issues no second `users` read, which is what the 05-03 D1 fixed shape requires.

## Self-Check: PASSED

- FOUND: src/lib/env.ts, src/lib/env.test.ts, src/instrumentation.ts, src/instrumentation.test.ts, src/server/authz/requireActiveUser.ts, src/server/authz/requireOnboarded.ts, src/server/__tests__/requireActiveUser.test.ts, src/server/__tests__/requireOnboarded.test.ts, evidence/env-and-guards.txt, evidence/build-ci-env.txt, evidence/boot-check.txt
- ABSENT (as intended): src/app/api/auth-debug/route.ts
- FOUND commits: 7bef995, 6e716fb, 853f405, 9f75904
