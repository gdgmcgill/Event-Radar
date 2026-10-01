---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 07
subsystem: testing
status: complete
tags: [jest, characterization, contracts, 400-bytes, error-text, cache-headers, health, csp, docs-gate, console-inventory, mutation-testing, F-025, F-026, F-029, F-054, F-055, F-058, F-059, F-094, REFAC-15, REFAC-19, REFAC-20, REFAC-22, REFAC-23]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-06: slice 6 closed on a green floor (Jest 1995 passed + 1 skipped, tag gate 44, contracts census 86/86, ratchet 0/0); floor.before.txt census C7; the fakeSupabase helper and the adminArmTable/writeHandlerTable descriptor shapes"
provides:
  - "badRequestTable.ts: 174 slice-7 400 rows (shape, order and reachable rule rows) plus 13 query-coercion rows, with invokers typed by each handler's own export and a student/owner/admin world"
  - "PRESERVE bad-request-characterization: every slice-7 shape-400 with its exact body and today's check order, P0 tree coverage with PINNED_ELSEWHERE references, FIELD_SITES"
  - "DEFECT malformed-input (F-094, F-058): not-JSON, array and non-string field at all 18 raw request.json sites and 15 readJsonObject files, with the write list pinned"
  - "DEFECT error-text (F-059): 34 census-C7 sites each leak a per-site sentinel; 6 non-body lines listed; E0 reconciles with the census file by file (40)"
  - "DEFECT uncaught-throw (F-058): the 22 no-try route files (26 arms) reject on a throwing dependency; control answers a JSON 500"
  - "DEFECT cache-headers (F-026, F-025): 44 private-target GET arms answer with no Cache-Control signed in and anonymous; /api/recommendations control"
  - "DEFECT health (F-029), vercel-json (F-025, F-026), csp (F-055), docs-gate (F-054)"
  - "evidence/console-coupled-tests.md: 110 console spy sites, kind A (97) or B (13), grouped by converting plan"
  - "evidence/slice-7-characterization.txt: measurements, M1 and M2 red with cmp exit 0, suite runs, tag gate, full Jest"
affects: [06-08, 06-09, 06-10, 06-12, 06-13, 06-14, 06-16, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "One sentinel per census site (SENTINEL-<n>) injected through the fake's error or a thrown error, so each F-059 row proves its own line leaks and E0 reconciles the rows with the census file by file"
    - "Worklists re-derived from the tree or the inventory on every run (raw request.json sites, readJsonObject files, no-try files, private-target GET rows, census C7), so a fix commit turns the DEFECT pin red on the list as well as the behaviour"
    - "Test-local client wrappers (withContainsAndNot, throwingOn with context-read sparing, the health auth accessors) instead of extending the shared fake"
key-files:
  created:
    - src/__tests__/contracts/badRequestTable.ts
    - src/__tests__/contracts/bad-request-characterization.test.ts
    - src/__tests__/contracts/malformed-input-defect.test.ts
    - src/__tests__/api/error-text-defect.test.ts
    - src/__tests__/api/uncaught-throw-defect.test.ts
    - src/__tests__/api/cache-headers-defect.test.ts
    - src/__tests__/api/health/health-defect.test.ts
    - src/__tests__/config/vercel-json-defect.test.ts
    - src/__tests__/config/csp-defect.test.ts
    - src/__tests__/pages/docs-gate-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/slice-7-characterization.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/console-coupled-tests.md
  modified: []
decisions:
  - "The shared fakeSupabase.ts is not extended. admin/organizers and events/happening-now go through a test-local withContainsAndNot wrapper, because PRESERVE suites pin the throws the fake's gaps produce"
  - "field is pinned where it is emitted today. That is more sites than C10's four: clubs POST and clubs/[id] PATCH ('Invalid value for <field>') and the end_date-only branch of events/[id] PATCH also emit it. 06-08 and 06-09 must name these keys in fieldFor"
  - "The F-059 worklist is 34 driven sites plus 6 listed lines (40 in all). events/route.ts:448 is a body site (it reaches the body through safeMessage), not the 'benign-error' line the census cell called it"
  - "Of the 110 console spy sites, 13 assert exact arguments. Only eventTags.test.ts is a PRESERVE file with such assertions, so its two [tags] assertions move to a -defect file in 06-14. The three B sites that spy on console.warn must switch to console.error when the logger lands"
metrics:
  duration: "26min"
  completed: "2026-09-27"
  tasks: 3
  files: 12
---

# Phase 6 Plan 07: Slice 7 Characterization Summary

**Slice 7 now starts with its bytes pinned:**
- 9 new Jest suites (435 tests) pin every slice-7 400 in today's check order, plus the query parameters that are coerced silently.
- They pin the malformed-input defect at all 33 parse sites and the caught-error text at 34 census-C7 sites.
- They pin the 26 handlers with no try, the 44 GET arms with no private cache header, the anonymous health report, the CSP, the vercel.json rule and the ungated /docs.
- A 110-row inventory gives every console-coupled test a planned move.
- Two source mutations each turned pins red and were restored byte-identical. No production file changed.

## What was done

**Task 1: the 400 table and F-094** (`ee69dda`)
- `badRequestTable.ts` has 174 rows, read from each handler's ladder at f550de9:
  - families: events, clubs, users, profile, organizer-requests, admin, moderation and the five multipart uploads;
  - 134 shape rows, 22 order rows and 18 reachable business-rule rows (C11).
- It also has 13 query-coercion rows, one per route in the plan's list. Examples: `limit=5.9` becomes 5, `admin/events limit=abc` becomes a NaN range, and `admin/audit-log page=0` becomes offset -20.
- A temporary harness measured every row before it was pinned. All 174 matched the reading from the handlers on the first run. The coercion rows matched after the `contains` wrapper was added.
- The PRESERVE suite (192 tests) has:
  - P0: tree coverage. Every route file that can answer a 400 has a row, or is named with the suites that already pin it: the event list and the slice-6 families.
  - P0: `field` appears only on the measured `FIELD_SITES`.
  - P1: exact bodies with `toEqual`.
  - P2: the coerced values.
- The DEFECT suite (72 tests, F-094 and F-058) has:
  - D0: the site lists equal the tree (18 raw `request.json()` sites and 15 `readJsonObject` files).
  - D1 and D2: a not-JSON body and an array at each raw site.
  - D3: a number in a trimmed or compared field at all 33 sites. Every row pins the write list.
  - Measured outcomes include:
    - four rejected promises on `.trim()` of a number;
    - numeric values written as-is: an experiment name and status, an event title and a pending edit;
    - "5" coerced by `sanitizeText`;
    - two array bodies that perform an update carrying only `updated_at`.

**Task 2: seven defects** (`830c0ba`)
- **error-text (F-059), 35 tests.** Each of the 34 reachable census-C7 sites leaks its own `SENTINEL-<n>`. Health's nine sites are all reached; its outer catch is reached through a `process.env` proxy. The six lines that are not a reachable body are listed with a reason. E0 checks that the rows plus the list equal the census, file by file.
- **uncaught-throw (F-058), 28 tests.**
  - The arm list is exactly the 22 route files with no `try` (26 handlers).
  - Each arm rejects when its first dependency after the guards throws.
  - `events/featured` is the control: it answers a JSON 500 to the same throw.
- **cache-headers (F-026 and F-025), 92 tests.**
  - The rows come from `endpoints.json`: every private-target GET arm.
  - 44 arms answer with a null Cache-Control, both signed in and anonymous.
  - `/api/recommendations` is the control and sends `private, no-store`.
  - The stale `auth-debug` row and `/auth/callback` are not driven, and the reason for each is recorded.
- **health (F-029), 5 tests.** An anonymous caller gets:
  - six named checks, with table and provider names;
  - the result of a live `signInWithOAuth` probe and a `getSession` read. The route never reads the caller.
  - the provider's error text (503);
  - the missing variable names (503);
  - memory figures.
- **vercel-json, csp and docs-gate, 11 tests.**
  - vercel.json has the one `/api/(.*)` rule with `s-maxage=60, stale-while-revalidate=300`.
  - script-src is `'self' 'unsafe-inline' 'unsafe-eval'`.
  - connect-src does not admit the local stack.
  - The development and production policies are identical.
  - `/docs` has no layout, and its page imports no guard. It is not in PROTECTED_ROUTES. The admin layout is the control.

**Task 3: the console inventory and the proof** (`22cdde4`)
- `console-coupled-tests.md` has one row for each of the 110 `spyOn(console` sites in 56 files:
  - 97 are kind A (silenced, or checked only for call count). They need no edit.
  - 13 are kind B (they assert exact arguments).
  - The B sites split by converting plan: 06-12 has 8, 06-13 has 2 and 06-14 has 3.
- Research's 42 files and 68 sites was exact at `f215fb7`. The 14 files added since then only silence the console: 8 came from 06-02 and 6 from this plan.
- **M1** changed "Title is required" in `events/create/route.ts`. Three PRESERVE rows and one F-094 row went red. `cmp` exit 0.
- **M2** replaced `error.message` at `events/my-events/route.ts:24` with a constant. The row's E1 check went red, and so did the E0 census row. `cmp` exit 0.
- `slice-7-characterization.txt` records every run with its exit code.

## Floor after this plan

| Gate | Before (06-06 close) | After |
|---|---|---|
| `npx jest --ci` | 102 suites + 1 skipped, 1995 passed + 1 skipped | 111 suites + 1 skipped, 2430 passed + 1 skipped, 0 failed |
| `node scripts/check-characterization-tags.mjs --all` | ok 44 | ok 53 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npx eslint` on the new files | — | 0 errors, 0 warnings |
| `git diff --stat f550de9 HEAD -- src/app src/server src/lib supabase next.config.js vercel.json` | — | empty |

Each task's `<verify>` command exited 0 (evidence § 9).

## Deviations from Plan

### Plan text corrected by measurement

**1. "Ten new suites" means nine suites plus the helper.**
- `badRequestTable.ts` is not a test file (the 06-02 precedent).
- The tag gate grew by 9 (44 to 53), which meets "at least the slice-6 close count plus 9".

**2. `field` is emitted at more sites than C10's four.**
- It is also emitted by clubs POST and clubs/[id] PATCH ("Invalid value for …"), and by the end_date-only branch of events/[id] PATCH.
- These are pinned as measured. The acceptance line "field exists only for start_date, the dateValidation field, roles and name" is therefore false of today's code.
- `FIELD_SITES` in the PRESERVE suite lists every measured site.
- The events list's `limit`/`page` 400s also carry `field`. They are already pinned by `events-list-characterization.test.ts` and are referenced, not duplicated.

**3. The census C7 classification of `events/route.ts:448` was wrong.**
- It reaches the body through `safeMessage` (`route.ts:470-473`), so it is driven.
- The acceptance "rows plus listed sites equal the census total" holds: 34 + 6 = 40.

**4. Research's console totals reflect an older tree.**
- At `f215fb7` they are exact (42 files, 68 sites). At this HEAD the count is 56 files and 110 sites.
- The delta is stated in the inventory. Research named the callback suites as exact-argument sites; they only silence the console.

**5. Query-coercion rows are a separate type.**
- The plan's `BadRequestRow` has `status: 400`, and the listed query routes other than events, export and popular have no 400 today.
- Their coercion rows are `QueryCoercionRow`, which reads the value from the response or from the fake's recorded query.

### Additions (Rule 2: needed for faithful pins)

**6. Test-local client wrappers instead of extending the fake.**
- The wrappers are `withContainsAndNot`, `throwingOn` (which spares the context's profile read on the cookie client only) and the health auth accessors.
- The plan allowed extending `createFakeSupabase` "only where a shape is missing, keeping existing behaviour identical". Adding `contains` would change existing fake-gap outcomes, so `fakeSupabase.ts` is unchanged.

**7. The clubs POST D3 row pairs a numeric name with a missing email.**
- A numeric name alone reached the fake's `ilike` gap, which is not production behaviour.
- The pinned row proves the number passed the required-name check.

**8. P0/E0/U0/C0/D0 tree-derived list checks were added to every table-driven DEFECT suite.** A fix commit shrinks the list and turns the pin red there too.

### Requirements not marked complete

**9. REFAC-15, REFAC-19, REFAC-20, REFAC-22 and REFAC-23 stay Pending.**
- This plan characterizes them; it does not deliver them.
- Following the 06-01 and 06-02 precedent, `requirements.mark-complete` was not run.

**Total deviations:** 5 measured corrections of plan text, 3 Rule-2 additions and 1 state-protocol omission. **Impact:** none on production code. Every pin is today's measured behaviour.

## Observations for later plans

- **06-08 / 06-09 (contracts):** name the `FIELD_SITES` keys in `fieldFor`.
  - For clubs, `Invalid value for <field>` must keep `field` for every allowed key.
  - Declare keys in the order the order rows pin. Examples: create checks price before the dates; clubs POST checks the link type before the required fields; users PATCH checks name before visibility and pronouns before year.
  - Each malformed-input row moves with a ledger row citing F-094.
- **06-12:** eight kind-B sites are edited in place. See the inventory's notes:
  - the warn-to-error remap for `upstashStore.test.ts:96`;
  - the `"TypeError"` content check in `proxy-ratelimit-failopen.test.ts:79`.
- **06-13 / 06-14:** wrapping a no-try file moves its U1 rows to a JSON 500 and shrinks U0.
  - Each generic 500 moves its E1 row. The callback's `message` query is pinned by the PRESERVE `route.test.ts:269`, which F-059's fix must move through a DEFECT file.
  - 06-14 moves `eventTags.test.ts`'s two `[tags]` assertions to a `-defect` file.
  - 06-14 deletes the vercel.json rule (V1-V3 move).
- **06-15:** the cache census can reuse `cache-headers-defect`'s invoker map. C1 and C2 flip arm by arm as `cachePolicy` lands.
- **06-16:** csp P2 and P4 move when `'unsafe-eval'` goes. P3 moves for a local-stack build.
- **06-17:** health H1-H5 and docs G1-G2 move.

## Issues

- A patch command that ran under an unquoted heredoc dropped the backtick-quoted words from the evidence notes: the shell executed them. The evidence file was rebuilt from a script file, and the rebuilt text was checked.
- Two unused `eslint-disable` lines were removed after Task 2's verify run. The two affected suites were re-run (99/99) before the commit.

## Known Stubs

None. Only tests, a test helper and evidence were created.

## Threat Flags

None. No endpoint, auth path or schema was changed. The threat register's mitigations were applied:
- **T-06-07-01:** the table has 174 rows, the P0 coverage test is in place, and M1 went red.
- **T-06-07-02:** the census C7 rows plus the listed lines equal 40, E0 enforces that on every run, and M2 went red.
- **T-06-07-03:** every console site is classified with a move.
- **T-06-07-04:** health-defect asserts the anonymous body's dependency names.

Only synthetic `5eed0000-…-0a7…` ids and `SENTINEL-<n>` strings are used.

## Environment

- Neither Docker nor the local Supabase stack was used, and port 3000 was not touched.
- Both measurement harnesses were deleted before any commit.

## Self-Check: PASSED

- FOUND: all 12 created files:
  - `badRequestTable.ts`: 858 lines;
  - the PRESERVE suite: 258 lines;
  - both evidence files: 694 and 205 lines.
- FOUND: commits `ee69dda`, `830c0ba` and `22cdde4`. None deletes a file.
- `git diff --name-only f550de9 HEAD -- src/app src/server src/lib supabase next.config.js vercel.json`: 0 files. `fakeSupabase.ts` is unchanged.
- Jest: 2430 passed, 1 skipped, 0 failed. Tag gate: ok 53. tsc: exit 0.
