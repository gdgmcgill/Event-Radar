---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 16
subsystem: observability-sentry-and-csp
status: complete
tags: [sentry, observability, pii-scrubbing, request-id, csp, playwright, REFAC-21, REFAC-23, F-055, DI-21, DI-80, DI-81, DEC-61, DEC-76, DEC-77]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-01: sentry-legitimacy bundle, DEC-61/DEC-76/DEC-77/DEC-81, DI-21/DI-80/DI-81, the defect ledger; 06-07: csp-defect.test.ts (F-055 pin); 06-12/06-14: log.ts, withRoute, the proxy's request id; 06-15: the harness state (233 spec tests green)"
provides:
  - "@sentry/nextjs 10.75.3 exact, with the CLI binary download skipped locally and in CI (SENTRYCLI_SKIP_DOWNLOAD=1)"
  - "src/lib/observability/scrub.ts: redactEmails, scrubEventFields (isomorphic)"
  - "src/server/observability/sentry.ts: scrubEvent, hashUserId, captureServerError"
  - "src/sentry.server.config.ts: sentryServerOptions, initSentryServer (sendDefaultPii false, tracesSampleRate 0; no DSN = disabled with one info line)"
  - "src/instrumentation-client.ts: browser init from NEXT_PUBLIC_SENTRY_DSN, user removed"
  - "src/instrumentation.ts: Sentry init before the boot checks; onRequestError exported (captureRequestError in a request_id scope)"
  - "src/lib/env.ts: usableSentryDsn, sentryDsn, sentryDsnProblem"
  - "withRoute's catch and the proxy's ring catch capture with tags request_id and route"
  - "next.config.js: withSentryConfig (no tunnel, telemetry off, source maps disabled without a token); contentSecurityPolicy(env) with no 'unsafe-eval' outside next dev"
  - "playwright.config.ts: bypassCSP false; e2e/specs/csp.spec.ts"
  - "docs/observability.md"
affects: [06-17, 06-18, phase-08]
tech-stack:
  added: ["@sentry/nextjs 10.75.3 (exact)"]
  patterns:
    - "Transport proof on the real SDK: init with the production options and one substitution, an in-memory transport built with Sentry.createTransport, plus a positive control in beforeSend so 'absent after scrubbing' is never vacuous"
    - "A build-time policy is built from the build's environment and pinned per environment (production, harness, development) in the DEFECT suite"
    - "A browser-enforced check gets a positive control: the same spec re-run against the pre-fix config must fail"
key-files:
  created:
    - src/lib/observability/scrub.ts
    - src/lib/observability/scrub.test.ts
    - src/server/observability/sentry.ts
    - src/server/__tests__/sentry.test.ts
    - src/sentry.server.config.ts
    - src/instrumentation-client.ts
    - e2e/specs/csp.spec.ts
    - docs/observability.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/sentry-install.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/sentry.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/build-ci-env.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/csp.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/playwright.csp.txt
  modified:
    - package.json
    - package-lock.json
    - .github/workflows/ci.yml
    - src/lib/env.ts
    - src/lib/env.test.ts
    - src/instrumentation.ts
    - src/instrumentation.test.ts
    - src/server/route.ts
    - src/proxy.ts
    - next.config.js
    - playwright.config.ts
    - src/__tests__/config/csp-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "The transport proof uses the real SDK (research A3), not jest.mock: @sentry/nextjs 10.75.3 initializes in Jest's node project with the production options and only the transport swapped for an in-memory one. Default integrations are narrowed to the five that install no process handlers and do not patch http in the worker."
  - "withSentryConfig is required from @sentry/nextjs/config (the root export prints a v11 deprecation notice) with telemetry: false, so no build (local or CI) sends plugin data to Sentry. The harness blanks SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN so a developer's .env can never report harness errors to a real project."
  - "The CSP is built inside headers() from the environment the build sees. 'unsafe-eval' appears only when NODE_ENV is development. A Supabase origin outside *.supabase.co is admitted with its ws twin, and an https Sentry DSN's ingest origin (never the key) joins connect-src. Every other directive is byte-identical."
metrics:
  duration: "575min wall clock (05:46Z to 15:21Z), including the previous executor's stall and restart"
  completed: 2026-09-27
  tasks: 3
  files: 26
---

# Phase 6 Plan 16: Sentry with request-id tags and PII scrubbing; CSP without eval Summary

Sentry 10.75.3 is now wired into the route wrapper, the proxy, Next's `onRequestError` and the browser. PII scrubbing was decided before install. Every server event carries `request_id`, the same value as the response's `x-request-id`, which a real-SDK in-memory transport proves. Without a DSN, Sentry turns itself off and logs one line; without an auth token, the build still succeeds. The production CSP no longer allows `'unsafe-eval'`, and the full Playwright suite (259 passed) now runs with the CSP enforced.

## What was built

**Task 1 (commit `0013c08`, before the stall).** The live registry integrity matched the 06-01 bundle, so `SENTRYCLI_SKIP_DOWNLOAD=1 npm install --save-exact @sentry/nextjs@10.75.3` ran. The CLI printed "Skipping download", so no binary was fetched. Only the optional `@sentry/cli-<platform>` packages were recorded in the lockfile, which gained 135 entries. The audit gate exits 0. `ci.yml` sets `SENTRYCLI_SKIP_DOWNLOAD: "1"` at workflow level. `docs/observability.md` covers the log fields, the request id's path, the Sentry posture, the five variables and the owner's setup steps.

**Task 2 (commit `848034e`).** The resumed tree held the scrubber, the capture module, `sentry.server.config.ts`, the `env.ts` readers, the `register()`/`onRequestError` changes and red-first tests. I verified all of it and kept it. The resume run gave 107 passed and 7 failed, and the 7 were exactly the wrapper and proxy transport rows. I then:
- added `captureServerError(error, { requestId, route })` to `withRoute`'s catch and to the proxy ring's outer catch, each placed after its log line;
- wrote `src/instrumentation-client.ts`;
- wrapped `next.config.js` in `withSentryConfig`;
- made the `instrumentation.ts` comment say plainly that a boot refusal is logged and not captured;
- fixed two type errors, both in the test file only.

Results: the four suites passed 114/114, and full Jest passed 3389 tests (+2 suites, +49 tests over 06-15). tsc exit 0, lint 0 errors, and both censuses pass. The CI-env build with every SENTRY_* variable blank exited 0. Its only Sentry line is "No auth token provided. Will not create release." The default build also exited 0.

**Task 3 (commit `d6e8489`).** The CSP is now `contentSecurityPolicy(env)`, and `bypassCSP` is `false`. The F-055 pin moved under the five-step protocol: unedited red (2 failed), moved green (6/6), pre-fix red (4 failed), `cmp` exit 0. It has three ledger rows. `e2e/specs/csp.spec.ts` checks the header and looks for CSP reports on five persona pages through two independent channels: the console and `securitypolicyviolation` events. As a positive control, I ran it against the pre-fix config and it failed 4 of 6: the header row, plus the three signed-in pages, whose `connect-src` calls to `127.0.0.1:54321` were blocked. Against the fixed config it passes 16/16. The full suite ran from a fresh reset in two alphabetical halves: 183 + 76 = 259 passed, 0 failed.

## Verification (task `<verify>` commands, as written)

| Task | Command | Result |
|---|---|---|
| 1 | `node -p ... \| grep -x 10.75.3 && grep -q SENTRYCLI_SKIP_DOWNLOAD ci.yml && npm audit --audit-level=high --omit=dev` | exit 0 (evidence/sentry-install.txt) |
| 2 | `npx jest --ci <4 suites> && npx tsc --noEmit && node scripts/check-server-console.mjs` | exit 0, 114 tests (evidence/sentry.txt § 5) |
| 3 | `npx jest --ci src/__tests__/config && npx playwright test e2e/specs/csp.spec.ts && grep -q 'bypassCSP: false' playwright.config.ts` | exit 0, 9 Jest + 16 Playwright (evidence/csp.txt § 5) |

Plan-level: `npx jest --ci` 3391 passed; `npx tsc --noEmit` exit 0; `npm run lint` 0 errors / 17 warnings (unchanged); `check-server-console` and `check-contracts` pass; `check-characterization-tags --all` passes 57 files; the CI-env build exits 0; the full Playwright suite exits 0 with `bypassCSP: false`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test type errors in `sentry.test.ts`**
- **Found during:** Task 2 (tsc after the first green)
- **Issue:** `Transport` is not exported by `@sentry/nextjs`. The probe handler was declared with zero arguments but called with a request.
- **Fix:** Used `ReturnType<typeof Sentry.createTransport>`, and gave the probe handler a `(_request: Request)` parameter. No route signature was widened.
- **Commit:** `848034e`

**2. [Rule 2 - Missing critical] Sentry build-plugin telemetry off; config subpath import**
- **Found during:** Task 2
- **Issue:** The plugin's telemetry defaults to on, which would send build data to Sentry from every build. Importing `withSentryConfig` from the package root prints a v11 deprecation notice.
- **Fix:** Set `telemetry: false` and switched to `require("@sentry/nextjs/config")`. The comment avoids the literal `tunnelRoute` so the acceptance grep count stays 0.
- **Commit:** `848034e`

**3. [Rule 2 - Missing critical] Harness blanks the Sentry variables**
- **Found during:** Task 3
- **Issue:** The harness server loads `.env`. A developer DSN there would send the harness's deliberate errors to a real project.
- **Fix:** Set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to `""` in the `webServer` env, the same pattern the Upstash names use.
- **Commit:** `d6e8489`

**4. [Rule 1 - Bug] `csp.spec.ts` first attempt**
- **Found during:** Task 3
- **Issue:** The first run had 2 failures, and neither was a CSP report. `/events/<id>` never reaches `networkidle`, and the first match for the persona name on `/profile` is a hidden sidebar copy.
- **Fix:** Added `filter({ visible: true })`, and replaced `networkidle` with `load` plus a 2 s settle window. Both runs are recorded in evidence/csp.txt § 4.
- **Commit:** `d6e8489`

**5. [Rule 3 - Blocking] Global name collision under tsc**
- **Found during:** Task 3
- **Issue:** The DEFECT test is an import-free script, so its `KEYS` collided with `selection.test.ts`.
- **Fix:** Renamed it to `CSP_ENV_KEYS`. I re-ran protocol steps 3 and 4 on the final text.
- **Commit:** `d6e8489`

**Additions beyond the plan's list:** a positive-control run of the CSP spec against the pre-fix config; the P5 Sentry-origin row in the DEFECT suite; the scrubber also removes client-address headers, `request.env`, and query strings in `contexts.nextjs.request_path` and breadcrumbs. The last item was already in the resumed code and is covered by `scrub.test.ts`.

## Issues and notes

- **Requirements not marked complete.** REFAC-21's local proof is fully committed. Two of its clauses are still owner-pending: an error actually appearing in a Sentry project, and source-map upload, which needs `SENTRY_AUTH_TOKEN`. Both need a real DSN and token, and this plan may not create a Sentry project. REFAC-23 closes in 06-18. Both are left open for the phase close to decide.
- **F-055** keeps its `'unsafe-inline'` half open (DI-80). I did not edit the finding's status or DI-21's disposition in the registers; the fixing slice-close plan (06-18) does that (DEC-72).
- **Other executors' leftovers:** the two stale `npm run dev` wrappers (PIDs 15950, 15966) never held port 3000 and were left alone. DI-87 and DI-88 are not mine; the "Fuzzy search RPC error" lines in the harness log are DI-87 territory, and every spec still passed.
- The event's `server_name` is the host name. On Vercel that is the function host, not personal data, so it was left in.

## Pending owner actions (DEC-81, DI-81; for PHASE-6-COMPLETION.md § owner actions)

1. Countersign DEC-60 (zod 4.6.5) and DEC-61 (@sentry/nextjs 10.75.3) from their legitimacy bundles before any push to main.
2. With a real DSN on a preview deploy, trigger an error through a wrapped route and confirm the Sentry event carries tag `request_id` equal to the response's `x-request-id`. Also set the five Sentry variables and update `.env.local.example` (docs/observability.md).

## Known Stubs

None.

## Threat Flags

None. The browser posts to the DSN's ingest origin, which `connect-src` admits only when `NEXT_PUBLIC_SENTRY_DSN` is set at build time. That is the plan's no-tunnel design (T-06-16-04), not new surface.

## Self-Check: PASSED
