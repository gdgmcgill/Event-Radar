---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 14
subsystem: route-adoption-sweep-b
status: complete
tags: [withRoute, cache-classes, logger, error-vocabulary, vercel-json, events, auth-callback, REFAC-19, REFAC-20, F-025, F-026, F-058, F-059, DI-26]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-12: withRoute, CACHE_CLASSES/applyCachePolicy, log, the cache census and the server-console census; 06-13: the per-file adoption pass and the ADOPTED/FIXED/ADDED/RETIRED lists; 06-07: the F-025/F-026/F-058/F-059 DEFECT pins and the console inventory; 06-01: the defect ledger"
provides:
  - "Every route file in the tree (48 here, 91 across 06-13/06-14) on `export const VERB = withRoute({ cache, action }, …)`; PENDING_WRAP empty and asserted empty"
  - "vercel.json without the /api headers rule ($schema, buildCommand, framework, regions unchanged)"
  - "Public event reads on explicit classes: /api/events public-30-60, /api/events/featured public-60-120 (bytes unchanged), export/happening-now/new/popular public-60-300; /api/events/[id], rsvp GET and every personalized or auth-gated export private"
  - "107 console sites and 23 caught-error text lines retired; the server-console allow-list is health S2 9, tagMapping S1 1 and the callback's PRESERVE-pinned redirect S2 1"
  - "withRoute NextResponse overload (a NextResponse-only handler keeps its type)"
  - "src/__tests__/api/recommendations/batch-error-text-defect.test.ts; evidence/route-adoption-b.txt; 72 defect-ledger rows"
affects: [06-15, 06-16, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "When a DEFECT list empties, the describe keeps one row asserting the list is [] (Jest refuses an empty it.each)"
    - "withRoute overloads: Promise<NextResponse> in, Promise<NextResponse> out; any other Response keeps Promise<Response>"
key-files:
  created:
    - src/__tests__/api/recommendations/batch-error-text-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/route-adoption-b.txt
  modified:
    - src/app/api/events/**/route.ts (21 files), src/app/api/calendar/events/route.ts
    - src/app/api/{users,user,profile,notifications,recommendations}/**/route.ts, interactions, feedback, onboarding/complete, health
    - src/app/auth/callback/route.ts, src/app/auth/signout/route.ts, src/app/clubs/page.tsx
    - src/server/route.ts
    - vercel.json
    - scripts/server-console-allowlist.json
    - src/__tests__/api/cache-headers-census.test.ts, cache-headers-defect.test.ts, error-text-defect.test.ts, uncaught-throw-defect.test.ts
    - src/__tests__/config/vercel-json-defect.test.ts
    - src/__tests__/api/events/search-escaping-defect.test.ts, get-events.test.ts, src/__tests__/api/review05/notifications-door.test.ts
    - src/__tests__/api/recommendations/recommendations-family-characterization.test.ts (one row moved out)
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "The callback's auth_failed redirect keeps `message=<provider text>`: the PRESERVE callback suite pins it and the callback may change only logging and the wrapper. It stays as one reasoned S2 allow-list entry, so the plan's allow-list one-liner (health + tagMapping only) exits 1 by design."
  - "recommendations/batch's 500 drops `details` (F-059); the PRESERVE row that pinned it moved out to batch-error-text-defect.test.ts under the ledger protocol, as 06-13 did for its tree scans."
  - "withRoute gains a NextResponse overload rather than any change to a test or a handler signature: the callback PRESERVE suites read res.cookies, which Promise<Response> erased."
  - "eventTags.test.ts's two [tags] warn pins did not move: tagMapping.ts stays on console by the plan's must-have, so no red step exists."
metrics:
  duration: 21min
  completed: 2026-09-27
  tasks: 2
  files: 64
---

# Phase 6 Plan 14: Route adoption sweep B Summary

**Every route handler now declares its cache class through `withRoute`, the blanket `s-maxage=60` rule is gone from `vercel.json`, and server code logs JSON lines with a request id.** Public event reads keep their bytes; event detail, RSVP reads and every personalized or auth-gated route answer `private, no-store`, as does every 401 and 500.

## What was built

**Task 1 (`29ced7e`): events and calendar, 22 files, 28 handlers.**
- Classes: `/api/events` GET `public-30-60` and `/api/events/featured` GET `public-60-120` (their own header lines removed, same bytes from the class); export, happening-now, new and popular GET `public-60-300`; everything else `private`, including `/api/events/[id]` (C7) and the rsvp GET (DEC-69).
- 50 console sites to the logger; 14 caught-error text lines gone (13 census-C7 sites and the events appeal `updateError` site outside C7). happening-now's catch no longer returns `details`.
- `events/route.ts` reads the benign-error code and message by destructuring and answers `Failed to fetch events` otherwise.
- Pins moved: cache-headers C1/C2 → C4/C5 (18), uncaught-throw U1 → U3 (2 + U0), error-text E1 → E2 (13 + ADDED + E0), search-escaping's F-059 echo. 37 ledger rows.

**Task 2 (`6221669`): the rest, 26 files, 30 handlers, all `private`.**
- users, user, profile, notifications, recommendations (its own headers removed), interactions, feedback, onboarding, health (wrapped only) and both auth routes.
- The callback keeps its behaviour. Its log fields never carry the email (the not-McGill line logs `userId`), the code or the redirect target. The two internal throws log the Supabase error as a field and carry no error text.
- `src/app/clubs/page.tsx`: three console calls to the logger (no request store, so no id).
- `vercel.json` without `headers`; `PENDING_WRAP` empty and asserted empty.
- Pins moved: C1/C2 → C4/C5 (22; both lists now empty), U1 → U3 (2; U1 empty), E1 → E2 (5; 4 callback lines retired), vercel-json V1–V3, and the batch rpc-error row out of PRESERVE. 35 ledger rows.
- Allow-list: 50 entries / 141 sites at base → 3 / 11.

## Verification (verbatim in `evidence/route-adoption-b.txt`)

- Task 1 verify: `npx jest --ci src/__tests__/api` exit 0 (55 suites, 1477 passed); `check-server-console` exit 0 (`committed=77 live=77`); `tsc` exit 0.
- Task 2 verify: vercel.json no-headers exit 0; `npx jest --ci` exit 0 (125 suites, 3335 passed, 1 skipped); `check-server-console` exit 0 (`committed=11 live=11`); `tsc` exit 0; `npm run lint` exit 0 (0 errors, 17 pre-existing warnings).
- `check-contracts` 0/0 and `--client` violations=0; tag gate `ok 57 files`; elevated ratchet 0/0; `npm run build` exit 0.
- Five-step protocol for each task: step 2 red on the unedited suites, step 3 green, step 4 red on exactly the moved rows against the pre-fix sources (39 and 35 failures), `cmp` differences=0 after restoring (22 and 28 files).
- Public-read probe on pre-fix and fixed sources: the events and featured 200s are byte-identical; the four public-60-300 reads now send the class value from the origin; every 500 is `private, no-store`; no `Vary`.
- Playwright, full suite: all 19 specs, 90 tests plus setup, in three time-boxed parts, each from `supabase db reset --local` and the seed. 0 failed, 0 flaky, first run. Port 3000 free before and after.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `withRoute` erased `NextResponse` from the callback's type**
- **Found during:** Task 2 tsc. `route.test.ts:288/311/327` and `route-defect.test.ts:171/315` read `res.cookies` (TS2339 on `Response`).
- **Fix:** a `NextResponse` overload in `src/server/route.ts`. Every path of such a handler yields a NextResponse: the wrapper's 500 is `serverError`'s NextResponse, and a NextResponse's headers are settable, so it is returned unchanged. Runtime unchanged; `route.test.ts`'s type rows still pass.
- **Commit:** `6221669`.

**2. [Rule 3 - Blocking] `events/export` could type-return `undefined`**
- `else if (format === "ical")` became `else`, with a comment. ExportQuery admits only `csv` and `ical`, so this changes no behaviour. **Commit:** `29ced7e`.

**3. [Rule 1 - Ledger protocol] A PRESERVE row pinned the batch error text**
- `recommendations-family-characterization.test.ts` pinned `details: "scoring exploded"`, and fixing F-059 there contradicts it. The row moved into `batch-error-text-defect.test.ts` (B1). It went red on the pre-fix source. The PRESERVE file loses only that row and gains a docblock pointer. Owner or verifier should confirm this, as with 06-13's Deviation 1. **Commit:** `6221669`.

### Measured differences from the plan (recorded)

- **Callback S2 residue: the plan's Task 2 allow-list one-liner exits 1.** `/?error=auth_failed&message=<exchangeError.message>` is pinned by the PRESERVE callback suite. The callback may change only logging and the wrapper, so the site stays, allow-listed with a reason. It goes to the caller's own redirect, not a JSON body. Phase 7 or the owner decides it.
- **No console pins needed moving.** `eventTags.test.ts :195/:279` stay green because `tagMapping.ts` stays on console. `events-console-defect.test.ts` and `route-console-defect.test.ts` were not created: every events and callback console spy is kind A.
- **Counts.** 48 files, 58 handlers, 107 S1 and 23 S2 sites. I amended Task 1's local, unpushed commit body before Task 2 to the measured 28 handlers and 50 console sites.
- **Two untagged suites edited in place:** `get-events.test.ts` (the 500 text) and `notifications-door.test.ts` (parses the JSON line).
- **DI-47(a):** the inferred-tags 404 is reachable (a read error, or a row deleted after the context read). It stays, with a comment, and is recorded for Phase 7. DI-47(b) and DI-59 (a)–(c) name files this plan does not touch, so they carry forward.
- **Empty `/api/events` 200s now carry `public-30-60`.** These are the fuzzy miss, the time-filter miss and the benign range error. Before, they set no header and production gave them vercel.json's value.

## Issues Encountered

- zsh does not word-split a `$VAR` holding `python3 script`; the helpers were called by path.
- In the server output, a pre-existing issue: `search_events_fuzzy` fails with 0A000 and the route falls back to ILIKE (already recorded in `.planning/audit`).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: redirect-error-text | src/app/auth/callback/route.ts | The auth_failed redirect still carries the provider's error text in `message` (PRESERVE-pinned). It goes to the same browser that started the sign-in, and the logs no longer carry it separately. |
| threat_flag: cached-404 | src/app/api/events/featured/route.ts, public classes | A public class shares a 404, as 06-12 decided (Vercel caches 404s). None of the six public event reads answers 404 today; 06-15's cache e2e covers the class behaviour. |

## Requirements

- **REFAC-20:** marked complete. Server code now logs through the JSON logger with levels and a request id: the proxy and instrumentation (06-12), then every route and the one Server Component page (06-13, 06-14). The only console call left is `src/lib/tagMapping.ts`, which is shared with client components and allow-listed with its reason, the end state the plan names.
- **REFAC-19:** left open. The vercel.json rule is removed and every route declares its class, but the cross-user cache regression test is 06-15's.

## Self-Check: PASSED

- The created files exist: `batch-error-text-defect.test.ts`, `evidence/route-adoption-b.txt`.
- Commits `29ced7e` and `6221669` are in `git log`. The ledger carries `29ced7e` 37 times and `6221669` 35 times.
- No TODO, FIXME or placeholder text in any changed source file.
