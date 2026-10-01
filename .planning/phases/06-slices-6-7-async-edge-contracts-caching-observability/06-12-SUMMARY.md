---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 12
subsystem: observability-and-caching-seam
status: complete
tags: [logger, request-id, async-local-storage, withRoute, cache-classes, proxy, census-gate, REFAC-20, REFAC-19, DEC-73, DEC-74, DI-45, DI-70, F-058]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-07: the console-coupled test inventory and the F-058/F-059/cache DEFECT pins; 06-04/06-11: the census-script shape and its CI step; 06-01: DEC-73, DEC-74, DEC-75 and the defect ledger"
provides:
  - "src/server/log.ts: log.debug/info/warn/error (one redacted JSON line: ts, level, msg, requestId, route, scope, fields), runWithRequest, currentRequestId, redact"
  - "src/server/route.ts: withRoute({ cache, action? }, handler) preserving the handler's parameter list; REQUEST_ID_HEADER; requestIdFrom"
  - "src/server/http.ts: CACHE_CLASSES, CacheClass, cachePolicy, applyCachePolicy (ok/created/success unchanged)"
  - "src/proxy.ts stamps a proxy-minted x-request-id on the request (forwarded as x-middleware-request-x-request-id) and on every response it returns, and runs the ring inside the request store"
  - "createRequestContext() takes requestId from the request store; DI-45's warn line 'auth user lookup failed' (code, status)"
  - "instrumentation, ratelimit/index, ratelimit/upstashStore, afterResponse and logAdminAction on the logger"
  - "scripts/check-server-console.mjs + scripts/server-console-allowlist.json (70 entries, 188 sites) and the CI step 'Server console census'"
  - "src/__tests__/api/cache-headers-census.test.ts: PENDING_WRAP (all 91 route files), OVERRIDES, DELETED, P0 tree-vs-inventory"
affects: [06-13, 06-14, 06-15, 06-16, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "A route adopts the seam as `export const GET = withRoute({ cache: \"<class>\", action: \"<verb phrase>\" }, async (request: NextRequest, ctx: RouteParams) => …)`; the census then requires the file to leave PENDING_WRAP, hold no literal Cache-Control, and declare its corrected class on GET and \"private\" on every other verb"
    - "A log line is `log.<level>(\"message without prefix\", { scope: \"<old bracket prefix>\", …fields })`; an Error field serializes to { name, message, code }; warn and error reach console.error, info and debug console.log"
    - "A test asserting a log line parses the one JSON argument: `JSON.parse(String(spy.mock.calls[0][0]))` then `toMatchObject({ level, scope, msg, …fields })`; a console.warn spy no longer sees logger warnings (they go to console.error)"
key-files:
  created:
    - src/server/log.ts
    - src/server/route.ts
    - src/server/__tests__/log.test.ts
    - src/server/__tests__/route.test.ts
    - src/proxy-request-id.test.ts
    - scripts/check-server-console.mjs
    - scripts/server-console-allowlist.json
    - src/__tests__/scripts/check-server-console.test.ts
    - src/__tests__/api/cache-headers-census.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/logger-foundation.txt
  modified:
    - src/server/http.ts
    - src/server/__tests__/http.test.ts
    - src/proxy.ts
    - src/proxy-defect.test.ts
    - src/server/context.ts
    - src/server/__tests__/context.test.ts
    - src/instrumentation.ts
    - src/instrumentation.test.ts
    - src/server/ratelimit/index.ts
    - src/server/ratelimit/upstashStore.ts
    - src/server/ratelimit/selection.test.ts
    - src/server/ratelimit/upstashStore.test.ts
    - src/server/afterResponse.ts
    - src/__tests__/api/review05/fanout-after.test.ts
    - src/lib/audit.ts
    - src/__tests__/moderation/audit-shape.test.ts
    - .github/workflows/ci.yml
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "A1 holds in the direct form: `request.headers.set(\"x-request-id\", id)` on the proxy's NextRequest is forwarded by every `NextResponse.next({ request })`, including the one setAll rebuilds. Next's adapter builds that request from a fresh, mutable Headers object. The clone-and-pass fallback was not needed. The proxy also stamps its pass-through response; Next copies proxy response headers onto the final response with setHeader, so a wrapped handler's own x-request-id (the same value) replaces it rather than duplicating it."
  - "The proxy body moved unchanged into `ring(request)`, which `proxy()` runs inside runWithRequest after stamping the id. This leaves the createServerClient to getUser region, PROTECTED_ROUTES, the matcher and the rate-limit call byte-identical (cmp exit 0 on the region and the config block)."
  - "The logger redacts a superset of DEC-74's key list (adds cookies, set-cookie, secret, apikey; case-insensitive) and reduces non-plain objects to a type tag rather than walking them. withRoute re-wraps a response whose headers are immutable (Response.redirect) instead of throwing, so the header and the cache class land on every return path."
  - "S2 keeps C7's broad rule (any `.message` token in a route file except dateError.message). It measures 42 sites in 22 files, not C7's 40. The +2 are `updateError.message` 500 bodies in clubs/[id]/appeal:83 and events/[id]/appeal:88, which existed at the floor's base but were missing from C7's list. The F-059 worklist is 35 body sites plus the callback redirect."
metrics:
  duration: 19min
  completed: 2026-09-27
  tasks: 3
  files: 28
---

# Phase 6 Plan 12: Logger, withRoute, cache classes and the request id Summary

This plan builds the seam that slice 7's route sweeps adopt:
- a redacted JSON logger over an AsyncLocalStorage request store;
- `withRoute`, which keeps each handler's type and puts the cache class and `x-request-id` on every response, turning an uncaught throw into the JSON 500;
- four named cache classes;
- a proxy-minted request id that reaches the handler's context;
- two shrink-only gates (server console and caught-error text; the route-wrap cache census) ready for 06-13 and 06-14.

## What was built

**Task 1 (`d790b21`): the three seam pieces, test first.**
- **`src/server/log.ts`.** Each call writes one line: `{ ts, level, msg, requestId, route, scope, …fields }`.
  - error and warn go to `console.error`; info and debug go to `console.log`.
  - Named secret keys become `[redacted]`, email-shaped text becomes `[email]`, and an Error becomes `{ name, message, code }`.
  - Newlines stay inside the one line. The logger never throws.
- **`src/server/route.ts`.** `withRoute` echoes a UUID-shaped id or mints one, and runs the handler inside the store. A throw becomes `{"error":"Failed to <action>"}` 500 with one `unhandled route error` line. The cache class and the id are applied on every path.
- **`src/server/http.ts`.** Gains `CACHE_CLASSES`, `cachePolicy` and `applyCachePolicy`. A public class applies only on GET or HEAD with status 200 or 404; everything else gets `private, no-store`. Vary is never set.
- **Tests.** 73 unit rows, recorded red first. They include a type-level proof that a `(req, { params })` handler and a zero-argument handler keep their exact types.

**Task 2 (`4ad1fae`): the request id through the proxy and the context.**
- The first statement of `proxy()` mints the id and overwrites any client value.
- Every proxy response carries the id: pass-through, 429, 403 cross-site, 403 profile/ban, 500, and each redirect.
- The proxy's two lines and instrumentation's three are JSON. The logger is imported on instrumentation's nodejs branch only.
- `createRequestContext()` reads the store's id and logs DI-45's warn line. The DI-70 comments are corrected in `proxy.ts` and `context.ts`.
- `src/proxy-request-id.test.ts` has 14 rows.

**Task 3 (`f044f02`): the non-route modules, the censuses, and CI.**
- The four modules are on the logger. The console inventory's fallout is handled.
- `check-server-console.mjs` has 15 fixture rows. Its allow-list holds 188 sites in 70 entries, none under `src/server/`, the proxy, instrumentation or `audit.ts`.
- The cache census has all 91 route files in PENDING_WRAP. Mutation controls: M1 through M3 go red; M4a (a correct wrap) passes; M4b (wrong class) and M4c (a literal Cache-Control) go red.
- CI step `Server console census`.
- The four proxy-adjacent Playwright specs pass from a fresh reset and seed (29 tests).

## Verification (all in `evidence/logger-foundation.txt`, exit codes verbatim)

- Task 1 verify: 3 suites / 73 tests; tsc exit 0.
- Task 2 verify: 7 suites / 110 tests, tsc and lint, exit 0.
- Task 3 verify: census `committed=188 live=188 delta=0`, 2 suites / 110 tests, full Jest 122 suites / 3094 passed / 1 skipped, tsc, exit 0.
- `npm run lint`: 0 errors, 17 warnings, all pre-existing.
- `check-contracts.mjs`: 0/0, and `--client` violations=0.
- Tag gate: 54 files ok. Elevated ratchet: 0/0.
- PRESERVE suites green and unedited: `proxy.test.ts`, `proxy-characterization.test.ts`, `middlewareRateLimit.test.ts`, `getsession-gate.test.ts`.
- PROTECTED_ROUTES re-derived: the same eight routes. The createServerClient to getUser region and the `config` block are byte-identical.
- End-to-end probe beyond the plan: a throwaway spec run through the harness and then deleted. A page 200, an API 200, the `/profile` 307 and a cross-site 403 each carried a fresh proxy UUID, never the client's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A route.test row could not be constructed**
- **Found during:** Task 1 (going green).
- **Issue:** The row "a uuid with a newline appended" could not be built, because Fetch's Headers class throws on a newline in a value, so no request can carry one.
- **Fix:** The row became "two ids comma-joined", which is how a repeated header actually arrives. Log injection through `msg` stays covered by log.test.
- **Files modified:** `src/server/__tests__/route.test.ts`.
- **Commit:** `d790b21`.

**2. [Rule 2 - Critical] Immutable response headers**
- **Found during:** Task 1.
- **Issue:** `withRoute` would throw on a `Response.redirect()` return, whose headers are immutable.
- **Fix:** Such a response is re-wrapped with the same status, headers and body, with a test row. The proxy's `stampRequestId` never throws either.
- **Files modified:** `src/server/route.ts`, `src/proxy.ts`.
- **Commits:** `d790b21`, `4ad1fae`.

**3. [Rule 2 - Critical] Redaction wider than DEC-74's list**
- **Found during:** Task 1.
- **Issue:** DEC-74's key list leaves some secret-bearing keys unredacted.
- **Fix:** The logger also redacts `cookies`, `set-cookie`, `secret` and `apikey`, matches keys case-insensitively, and never walks non-plain objects (phase constraint 11).
- **Files modified:** `src/server/log.ts`.
- **Commit:** `d790b21`.

### Measured differences from the plan and the inventory (recorded, as in earlier plans)

- **`proxy-ratelimit-failopen.test.ts` needed no edit.** The inventory had this row as "edited in place". Its content checks still hold, because the line keeps the error's class name and never the secret. This resolves inventory note 3 in favour of keeping the class.
- **`upstashStore.test.ts:349` went red and was edited in place.** The inventory classifies it as A (count only). It broke because the logger sends warn to `console.error` (inventory note 1).
  - **Also affected (`:330`).** The configured row's warn-spy check would have passed vacuously for the same reason. It now also counts warn-level JSON lines.
- **Nothing moved out of a PRESERVE file.** `proxy-characterization.test.ts` has no exact console assertion. The only moves are in two DEFECT files, each with a ledger row citing F-058 and the full five-step protocol:
  - `proxy-defect` :213 and :241;
  - `audit-shape` :327.
- **S2 = 42 sites vs C7's 40.** See the decision above. S1 reconciles exactly with C1: 160 − 2 (cron routes deleted in 06-03) − 12 (converted here) = 146.
- **The cache census had no natural red run.** It describes the tree as it stands. Its red proof is the four mutation controls, each reverted and checked with `cmp`.

## Issues Encountered

None. Every state call ran on its first attempt, and no auth gates came up.

## Known Stubs

None. `PENDING_WRAP` (91 files) and the 186 non-reasoned allow-list sites are intentional worklists, and 06-13 and 06-14 shrink them.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: pii-in-logs | src/server/ratelimit/upstashStore.ts | The store-timeout and store-error lines keep today's `key` field, which is `METHOD:path:client-ip`. The plan preserves module fields and the logger does not redact IPs. Decide in 06-16 (observability docs) or by the owner whether to log only the method and path. |
| threat_flag: cached-correlation-id | src/proxy.ts | Once 06-13/06-14 make a route public, a CDN-cached response replays the `x-request-id` of the request that filled the cache to later clients. It is not a secret, but a correlation id taken from a cache hit points at the original request. Note this for 06-15's cache e2e and for `docs/observability.md`. |

## Requirements

REFAC-19 and REFAC-20 are **left open**.
- **REFAC-20** requires the logger to replace `console.*` in server code on both runtimes. The proxy side is done, but 142 console sites remain in route files and 3 in `src/app/clubs/page.tsx`. 06-13 and 06-14 convert those.
- **REFAC-19** needs the route sweeps, the `vercel.json` headers removal and the cross-user cache test (06-13 to 06-15).

DI-45 and DI-70 are fixed in `4ad1fae`. The deferred register is left for the slice-close plan to update.

## Self-Check: PASSED

- All ten created files are present on disk.
- Commits `d790b21`, `4ad1fae` and `f044f02` are present in `git log`.
- `git status --short` before the docs commit shows only the plan's docs files and the three pre-existing untracked paths.
