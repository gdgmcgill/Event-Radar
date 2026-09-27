---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 04
subsystem: api-contracts
status: complete
tags: [zod, contracts, parseBody, parseQuery, census-gate, recommendations, notifications, interactions, feedback, elevated-door, e2e, F-017, F-028, F-092, F-094, DI-44, DI-82, DEC-65, DEC-68, DEC-69, REFAC-14, REFAC-15]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-02: the slice-6 PRESERVE suites and the F-017/F-028/F-092/F-094 DEFECT pins; 06-03: zod 4.6.5 and the zod contract style (one error per rule, key order = check order)"
provides:
  - "src/server/body.ts: Parsed<T>, ParseOptions, parseWith, parseBody, parseQuery beside an unchanged readJsonObject"
  - "src/contracts/common.ts: Uuid, IsoDateString, NonEmptyTrimmedString, ErrorBody"
  - "src/contracts/recommendations.ts (RecommendationsQuery, FeedbackEventIdsQuery, AnalyticsQuery, ThumbsFeedbackBody, AnalyticsFeedbackBody, RecommendationFeedbackBody), interactions.ts (InteractionBody), notifications.ts (NotificationsQuery, NotificationsListQuery), feedback.ts (FeedbackBody)"
  - "scripts/check-contracts.mjs + scripts/contracts-allowlist.json (51 entries, 86 sites; no slice-6 file) and the CI step 'Contracts census'"
  - "Seven slice-6 routes read input only through parseBody/parseQuery; notifications/count answers anonymous 401 through requireUser"
  - "F-017 fixed through getElevatedClient() with a REGISTRY row; F-092 fixed with a separate users read"
  - "e2e/specs/async-edge.spec.ts (3 tests); evidence/contracts-slice-6.txt, evidence/async-edge-fixes.txt; 15 defect-ledger rows; DI-82"
affects: [06-05, 06-06, 06-08, 06-09, 06-10, 06-11, 06-12, 06-14]
tech-stack:
  added: []
  patterns:
    - "parseBody reads through readJsonObject first, so the two existing 400 strings stay byte-identical; parseWith answers the first zod issue and adds field only for keys named in fieldFor"
    - "parseQuery passes each key's FIRST value (searchParams.get semantics) and collects a repeated key as an array only when the schema declares that key as an array"
    - "A route that branched on body shape gets a dispatching schema (looseObject + transform selecting a branch schema) whose output carries a kind discriminant"
    - "Query values the handler coerced silently are reproduced with optional string + transform (parseInt/parseFloat with today's defaults), never a new 400"
    - "Census gate on the ratchet's model: live {file, rule, count} vs a JSON allow-list; grown or new pairs fail with file:line, retired pairs pass and are printed"
key-files:
  created:
    - src/contracts/common.ts
    - src/contracts/recommendations.ts
    - src/contracts/interactions.ts
    - src/contracts/notifications.ts
    - src/contracts/feedback.ts
    - src/contracts/__tests__/slice-6-contracts.test.ts
    - src/server/__tests__/body.test.ts
    - src/__tests__/scripts/check-contracts.test.ts
    - scripts/check-contracts.mjs
    - scripts/contracts-allowlist.json
    - e2e/specs/async-edge.spec.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/contracts-slice-6.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/async-edge-fixes.txt
  modified:
    - src/server/body.ts
    - .github/workflows/ci.yml
    - src/app/api/recommendations/route.ts
    - src/app/api/recommendations/feedback/route.ts
    - src/app/api/recommendations/analytics/route.ts
    - src/app/api/interactions/route.ts
    - src/app/api/feedback/route.ts
    - src/app/api/notifications/route.ts
    - src/app/api/notifications/count/route.ts
    - src/app/api/admin/reports/route.ts
    - src/hooks/useNotificationCount.ts
    - src/components/layout/SideNavBar.tsx
    - src/server/db/elevated/REGISTRY.md
    - src/__tests__/api/slice6-malformed-input-defect.test.ts
    - src/__tests__/api/notifications/notifications-count-defect.test.ts
    - src/__tests__/api/recommendations/experiment-assignment-defect.test.ts
    - src/__tests__/api/admin/admin-reports-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/deferred-items.md
decisions:
  - "A non-object feedback subject answers 400 with a new text, 'Subject must be a string'. Today it threw on .trim() (500) and no text existed to keep; DEC-65 makes a non-string field a 400"
  - "A truthy non-string event_id at interactions and recommendations/feedback now answers that route's presence 400 instead of reaching PostgREST (22P02, 500). Not pinned by 06-02 because the fake answered 404/200; asserted in slice-6-contracts.test.ts"
  - "recommendation_rank keeps today's JavaScript comparison (a numeric string below 1 is refused, other strings pass to the database); session_id, metadata and experiment_variant_id pass through unvalidated. No 400 was added where today's handler coerced silently (C11)"
  - "notifications/[id] was not changed: it reads no body and no query, only its route param, and UUID route params belong to 06-10 (DEC-66)"
  - "The census skips comment lines and exempts the auth callback's four OAuth params by name, so its R3 total is 54 against floor C4's 59; the -5 is itemized in the evidence"
metrics:
  duration: "20 min"
  completed: "2026-09-26"
  tasks: 3
  files: 32
---

# Phase 6 Plan 04: Slice-6 Contracts and Route Fixes Summary

**Slice 6's handlers now read their input only through zod contracts via `parseBody`/`parseQuery`. They keep today's 400 bytes, which the 06-02 PRESERVE suites confirm by passing unedited. Malformed bodies answer 400 instead of 500. A shrink-only census gate in CI stops new raw reads. Three route defects are also fixed: the anonymous notifications count now answers 401 (F-028), non-admins are assigned A/B variants through the elevated door (F-017), and the admin reports list answers 200 with each reporter's name (F-092).**

## What was done

**Task 1: the boundary and the gate** (`635db3f`)
- `body.test.ts` and `check-contracts.test.ts` failed first: 9 of 10 census tests failed, and the body suite could not load. After the change, 35 tests pass.
- `readJsonObject` is byte-identical. The diff removes no line; it only adds docblock and import lines above the function and new code below it.
- `parseQuery` hands the schema each key's first value, which is what `searchParams.get` returned. A repeated key becomes an array only when the schema declares that key as an array; zod's internal `def` is read through optional, default and pipe wrappers to decide.
- `check-contracts.mjs` enforces four rules:
  - R1: a raw `request.json()`/`req.json()` read outside `body.ts`.
  - R2: a `.formData()` read outside `body.ts`.
  - R3: a `searchParams.get/getAll/has` read in a route file. The auth callback is exempt for exactly `code`, `next`, `error` and `error_description`.
  - R4: a `readJsonObject(` call in a route file.
- The census's CLI:
  - It supports `--write`, `--root` and `--allowlist`.
  - An empty allow-list is valid.
  - A malformed allow-list fails.
- The initial census found 58 entries covering 95 sites. Against the floor censuses:
  - R1 = C2 (21 sites) and R2 = C3 (5); both equal.
  - R4 = C5 (15); equal.
  - R3 is 54 against C4's 59. Four of the difference are the exempt callback params; the fifth is a comment line at `events/route.ts:384` that the floor's grep counted.
- The CI step "Contracts census" runs right after the elevated-callsite ratchet.

**Task 2: the four family contracts, adopted** (`2617b7b`)
- `slice-6-contracts.test.ts` failed first because the modules were absent. It now has 73 rows, and every expected body is copied from the 06-02 suites.
- Seven routes now parse after their guard prologue, at the same point in the flow as before. Every success body, DB call and business rule is unchanged, and all 93 PRESERVE tests pass with `git diff` empty on those four files.
- DI-44: the thumbs and analytics feedback shapes declare no `user_id`. Both `authUser?.id ?? body.user_id` fallbacks and their dead 401s are gone. The four remaining `user_id` lines are the GET read filter, the upsert value, the `onConflict` column list and the insert value, and all of them use the caller's id.
- The count route now goes through `createRequestContext` + `requireUser`. `useNotificationCount({ enabled })` skips both the fetch and the polling interval when `enabled` is false, and `SideNavBar` passes `enabled={isAuthenticated}`.
  - Measured: both consumers of the hook already rendered only for signed-in users, so anonymous pages polled 0 times before and after this change.
- Ledger protocol: the DEFECT suites were run unedited against the fix.
  - Red: 12 of 16. These are the 10 F-094 rows that move plus the 2 F-028 rows. The 3 "number" rows stay green because the contracts keep their bytes.
  - After the moves: green, 16/16.
  - Against the pre-fix source: red again, 12 of 16. The fixed source was then restored, and `cmp` exits 0 for all four files.
- 7 allow-list entries were retired, leaving 51 entries and 86 sites.

**Task 3: F-017, F-092 and the e2e spec** (`376bf37`)
- F-017: the three experiment reads and the assignment insert now run on `getElevatedClient()`. The insert's `user_id` is the id from `getUser()` and nothing else.
  - REGISTRY row added. The ratchet reports `committed=0 live=0`.
  - D1 and D2 went red, then green after the move (the student gets `control`, λ 1, and exactly one insert with the student's id), then red against the pre-fix source. C1 and C2 and both PRESERVE suites stayed green throughout.
- F-092: the embed is gone. `users` is read for `id, name, avatar_url` only, and each report's reporter is mapped to `{ id, display_name, avatar_url }`. D1 went red, then green (200 with the reporter), then red against the pre-fix source.
- The e2e runs started from a fresh `supabase db reset --local` and seed:
  - `async-edge.spec.ts`: 3 passed.
  - `admin-moderation-queue.spec.ts` + `event-read-path.spec.ts`: 15 passed.
  - Residue afterwards: 0 reports, experiments, variants, assignments and scores. Events are at the seed's 5 and users at 10. Port 3000 is free.

## Floor after this plan

| Check | Result |
|---|---|
| `npx jest --ci` | 102 passed, 1 skipped; 1995 tests passed, 1 skipped; exit 0 (3 suites and 108 tests more than 06-03) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 18 warnings (the pre-existing set) |
| `node scripts/check-contracts.mjs` | `committed=86 live=86 delta=0`, exit 0 |
| `node scripts/check-elevated-ratchet.mjs` | `committed=0 live=0 delta=0`, exit 0 |
| `npx playwright test e2e/specs/async-edge.spec.ts` | 3 passed (fresh reset and seed) |
| `next build` | succeeded inside the Playwright webServer (`✓ Compiled successfully`), 3 runs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The e2e spec does not call `/api/recommendations/batch`, because that route always answers 500**
- **Found during:** Task 3, the first e2e run.
- **Issue:** `compute_user_scores()` starts with an unqualified `DELETE FROM user_event_scores`. PostgREST's `authenticator` role preloads `safeupdate` (measured from `pg_roles.rolconfig`), so the admin batch route answers `500 DELETE requires a WHERE clause` (21000). This was already true before this plan: the pg_cron path, which runs as postgres, is unaffected, and the Jest PRESERVE row passes only because the fake has no safeupdate.
- **Fix:** The spec inserts the student's score row through the local service client instead, and removes it (and asserts the baseline had none) in cleanup. No product code changed. The defect is registered as **DI-82**. It is not fixable in this plan because DEC-68 pins the function body by md5.
- **Files modified:** `e2e/specs/async-edge.spec.ts`, `evidence/deferred-items.md`
- **Commit:** `376bf37`

**2. [Rule 1 - Bug] A variable in `notifications/route.ts` shadowed another**
- **Found during:** Task 2. A new `const query` collided with the existing `let query` builder.
- **Fix:** Renamed it to `params`. It was caught by the PRESERVE suite before commit.

### Plan text vs measurement
- **Ledger rows:** there are 12 for Task 2, where the plan said 11 ("nine F-094"). The F-094 suite pins 10 rows that move: 3 not-JSON, 3 array, 3 JSON-null and 1 numeric subject. Task 3 adds 3 more (F-017 × 2, F-092 × 1), for a total of 15.
- **`grep -c user_id` in recommendations/feedback:** it returns 4, not 2. Two lines are writes of the caller's id, one is the `onConflict` column-list string, and one is the GET read filter on the caller's id. No line takes a body value (evidence § 2.9).
- **"Eight adopted route files":** the count is seven plus the count route. `notifications/[id]` reads no input, so nothing was adopted there.
- **Initial allow-list R3:** it is 54 against C4's 59; the delta is itemized above and in evidence § 1.4.

## Issues

- **Characterization tag gate is red on HEAD (pre-existing, from 06-03):** `node scripts/check-characterization-tags.mjs --all` fails on `src/__tests__/webhook/verify-signature.test.ts` and `webhook-handler.test.ts`, because their docblocks name neither PRESERVE nor DEFECT. This makes the CI step "Characterization tag gate" fail. None of this plan's files are affected: the four moved DEFECT suites pass the gate as DEFECT (F-094, F-028, F-017, F-092). This is outside this plan's scope and has not been fixed. It needs a one-line tag decision by 06-03's owner or the next plan.
- One Bash loop failed silently under zsh (an unsplit file list), so the first pre-fix run for Task 2 did not actually swap the sources. It was redone under bash; the evidence records only the valid run.

## Requirements

REFAC-14 and REFAC-15 are **not** marked complete. This plan delivers slice 6's share of each: the F-017 and F-028 fixes for REFAC-14, and the contracts plus census gate for REFAC-15. The remaining work is in 06-05 and 06-06 for REFAC-14, and in 06-08 through 06-11 for REFAC-15, whose allow-list still holds 51 entries.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- T-06-04-01: covered by the contracts.
- T-06-04-02: the insert takes its id from `getUser()` only, D1 asserts that id, and the REGISTRY row is added.
- T-06-04-03: a red fixture shows that an unlisted site fails the gate, and the CI step exists.
- T-06-04-04: anonymous callers get 401.
- T-06-04-05: the reporter select is `id, name, avatar_url` only, and the e2e test checks the exact three keys with `toStrictEqual`.

## Self-Check: PASSED

- All 13 created files were found on disk.
- Commits `635db3f`, `2617b7b` and `376bf37` were found in `git log`.
- `e2e/specs/async-edge.spec.ts` is 277 lines (minimum 60) and `scripts/check-contracts.mjs` is 280+ lines (minimum 80).
- The defect ledger has 15 rows for 06-04, all with hashes filled in.
