---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 13
subsystem: route-adoption-sweep-a
status: complete
tags: [withRoute, cache-classes, logger, error-vocabulary, admin, moderation, clubs, organizer-requests, my-clubs, REFAC-19, REFAC-20, F-026, F-058, F-059]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-12: withRoute, CACHE_CLASSES/applyCachePolicy, log, the cache census and the server-console census; 06-07: the F-026/F-058/F-059 DEFECT pins and the console-coupled worklist; 06-01: the defect ledger and its five-step protocol"
provides:
  - "43 route files (60 handlers) in the admin, moderation, clubs, organizer-requests and my-clubs families on `export const VERB = withRoute({ cache, action }, …)`"
  - "Public club reads on their classes: clubs, clubs/[id], clubs/new, clubs/trending public-60-300; clubs/featured public-60-120 (bytes kept); clubs/[id]/events and everything else private"
  - "38 console sites on the JSON logger; 9 caught-error text lines gone (7 were response bodies, now generic text)"
  - "src/__tests__/api/admin/admin-arm-tree-defect.test.ts and src/__tests__/api/auth-ring/write-arm-tree-defect.test.ts: the arm-table tree checks, reading both export forms"
  - "cache-headers-defect C4/C5, uncaught-throw-defect U3, error-text-defect E2 with ADOPTED/FIXED/ADDED/RETIRED lists that 06-14 extends"
  - "evidence/route-adoption-a.txt; 84 defect-ledger rows"
affects: [06-14, 06-15, 06-16, 06-18]
tech-stack:
  added: []
  patterns:
    - "A DEFECT suite tracks adoption with an explicit list (`ADOPTED`, `FIXED`, `ADDED`, `RETIRED`). Adopted rows run under the fixed-shape describe (C4/C5, U3, E2), and the rest stay in the old one. 06-14 appends to the same lists."
    - "A tree scan of route exports must read both forms, `export\\s+(?:async\\s+function|const)\\s+VERB`. A scan that reads only `export async function` loses a verb once its file is wrapped."
key-files:
  created:
    - src/__tests__/api/admin/admin-arm-tree-defect.test.ts
    - src/__tests__/api/auth-ring/write-arm-tree-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/route-adoption-a.txt
  modified:
    - src/app/api/admin/**/route.ts (24 files)
    - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
    - src/app/api/clubs/**/route.ts (16 files)
    - src/app/api/organizer-requests/route.ts
    - src/app/api/my-clubs/route.ts
    - src/__tests__/api/cache-headers-defect.test.ts
    - src/__tests__/api/uncaught-throw-defect.test.ts
    - src/__tests__/api/error-text-defect.test.ts
    - src/__tests__/api/cache-headers-census.test.ts
    - src/__tests__/api/admin/admin-guard-characterization.test.ts
    - src/__tests__/api/auth-ring/write-handlers-characterization.test.ts
    - src/__tests__/api/review05/admin-event-notification.test.ts
    - src/__tests__/api/review05/club-transfer.test.ts
    - scripts/server-console-allowlist.json
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "Two PRESERVE tree scans read `export async function`, and it does not match a wrapped export. Their tree comparisons moved out of PRESERVE into two new DEFECT suites under the ledger protocol. Every behaviour row stays in PRESERVE, unedited. See Deviation 1."
  - "A handler's withRoute action reuses the route's own 'Failed to …' phrase where one exists. Otherwise it is a verb-noun phrase for the handler. A caught-error body becomes the route's generic text, and the error is logged."
  - "clubs/featured keeps its bytes on a 200. clubs, clubs/[id], clubs/new and clubs/trending now send `public, s-maxage=60, stale-while-revalidate=300` from the origin: the vercel.json directives plus an explicit `public`."
metrics:
  duration: 17min
  completed: 2026-09-27
  tasks: 2
  files: 56
---

# Phase 6 Plan 13: Route adoption sweep A (admin, moderation, clubs, organizer-requests, my-clubs) Summary

**What changed in these five families:**
- Every handler now runs through `withRoute` with a declared cache class.
- Admin, moderation and member-dependent reads answer `private, no-store` with an `x-request-id` on every status.
- Uncaught throws answer the seam's JSON 500.
- Logs are JSON lines with the request id.
- No response body carries a caught database error's text.

**What did not change:**
- The public club reads' 200 bytes.
- Every behaviour pin: the eight admin and club specs pass from a fresh reset.

## What was built

**Task 1 (`217593b`): the admin and moderation routes.**
- **Wrapping.** 25 files and 34 handlers, all on the `private` class. Each export is `export const VERB = withRoute({ cache: "private", action }, async (<same parameters>) => …)`, and the authz order is unchanged.
- **Logging.** 34 console calls went to `log.error`, each carrying `scope` plus the same context as fields.
- **Caught-error text.** Four lines no longer carry an error's `.message`:
  - calculate-popularity's per-event errors now read `"Failed to update popularity"`;
  - the moderation reviews 500 is now `"Failed to fetch moderation reviews"`;
  - admin/events/[id]/status copies the notification text through destructuring. That line was never a response, and nothing changed in behaviour.
- **Pins moved:** C1/C2 → C4/C5 (32 rows), U1 → U3 (18 rows), and E1 → E2 (3 rows).
- **PRESERVE move.** admin-guard P0's tree comparison moved out (see Deviation 1).
- **Census and allow-list.** PENDING_WRAP went from 91 to 66. The allow-list went from 70 entries / 188 sites to 56 / 150.

**Task 2 (`2c12a61`): the club, organizer-request and my-clubs routes.**
- **Wrapping.** 18 files and 26 handlers:
  - clubs, clubs/[id], clubs/new and clubs/trending GET use `public-60-300`;
  - clubs/featured GET uses `public-60-120`, and its own header line was removed;
  - clubs/[id]/events GET and every other export are `private`.
- **Logging.** 4 console calls went to the logger. The transfer and delete audit lines now carry `requestId` and `clubId` as fields.
- **Caught-error bodies.** Five became generic text: appeal ×2, featured, and organizer-requests ×2.
- **Pins moved:** C1/C2 → C4/C5 (16 rows), U1 → U3 (4 rows), and E1 → E2 (4 rows). The appeal `updateError` site was never in C7, so it is pinned as an E2 addition.
- **PRESERVE move.** write-handlers P0's enumeration moved out (see Deviation 1).
- **Census and allow-list.** PENDING_WRAP went from 66 to 48. The allow-list went from 56 / 150 to 50 / 141.
- **Evidence and specs.** The evidence file was written, and the eight specs passed (52/52).

## Verification (verbatim in `evidence/route-adoption-a.txt`)

**Task 1 verify:**
- `npx jest --ci src/__tests__/api src/server`: exit 0, 72 suites and 1649 passed.
- `check-server-console`: exit 0, `committed=150 live=150`.
- `npx tsc --noEmit`: exit 0.

**Task 2 verify:**
- Full `npx jest --ci`: exit 0, 124 suites and 3234 passed with 1 skipped. The floor was 122 suites and 3094 tests.
- `check-server-console`: exit 0, `committed=141 live=141`.
- `check-contracts`: exit 0, 0/0.
- `check-contracts --client`: exit 0, violations=0.
- `tsc`: exit 0.
- `npm run lint`: exit 0, 0 errors and 17 warnings, all pre-existing.

**Other gates:**
- Tag gate: `ok 56 files`, which is 54 plus the two new DEFECT suites.
- Elevated ratchet: 0/0.

**Five-step protocol, for each task:**
- Step 2 went red on the unedited DEFECT suites.
- Step 3 went green.
- Step 4 swapped in the pre-fix sources (25, then 18 files) and turned red exactly on the moved rows:
  - Task 1: C4 16, C5 16, E2 3, T1 33, U3 18, plus the U0, E0 and 2 notification rows;
  - Task 2: C4 8, C5 8, E2 5, T1 13, U3 4, plus U0, E0 and the transfer row.
- `cmp` confirmed every restored file: differences=0 both times.

**Playwright:**
- Run after `supabase db reset --local` and the seed: admin-guard, admin-write-paths, admin-moderation-queue, admin-audit-row, club-owner-surfaces, club-authorization, club-invitation-acceptance and async-edge. 52 passed on the first run.
- Port 3000 was free before and after.

**Public-read probe.** A throwaway harness was deleted after use. It ran on the pre-fix and the fixed sources:
- featured's 200 is byte-identical;
- the four public-60-300 GETs now send the class value from the origin (before, they relied on vercel.json);
- a 500 is `private, no-store`;
- no `Vary` header anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two PRESERVE tree scans cannot pass once exports are wrapped**
- **Found during:** Task 1 step 2, and again in Task 2 step 2.
- **Issue.** Two tests compare their arm table with the route tree by reading `export async function <VERB>` from the source:
  - `admin-guard-characterization.test.ts` P0;
  - `write-handlers-characterization.test.ts` P0.

  The plan's must-have form, `export const VERB = withRoute(…)`, has no such text. So those comparisons go red, and "the PRESERVE suites pass unedited" and "every export is withRoute" cannot both hold. The census test also rejects any leftover `export async function`, so the two forms cannot coexist in one file.
- **Fix.** The ledger's "moved out of PRESERVE" protocol, applied to each tree comparison:
  - The comparison moved into a new DEFECT suite: `admin-arm-tree-defect.test.ts` and `write-arm-tree-defect.test.ts`.
  - **T0** in each new suite reads both export forms, so the completeness check still guards 06-14.
  - **T1** pins the wrapped after-shape. It went red on the pre-fix sources: 33 and 13 rows.
  - The edits to the PRESERVE files remove lines only: the one comparison, its helpers and its imports. Each docblock gains a pointer to the new suite.
  - P0's length and uniqueness checks, and every behaviour row (P1–P3 and P1–P5), are unedited and green. `adminArmTable.ts`, `writeHandlerTable.ts` and `badRequestTable.ts` are unedited.
  - Each move has a ledger row.
- **This fails one of the plan's acceptance criteria as written:** "admin-guard-characterization passes with no edit". The owner or verifier should confirm this resolution. Reverting it is a two-file change.
- **Files modified:**
  - `src/__tests__/api/admin/admin-guard-characterization.test.ts`
  - `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts`
  - the two new suites
- **Commits:** `217593b`, `2c12a61`.

**2. [Rule 1 - Bug] The DEFECT suites' own tree scans read one export form**
- **Found during:** Task 1.
- **Issue.** `uncaught-throw-defect` U0 reads `export async function`, so a wrapped no-try file would have listed no verbs.
- **Fix.** U0 now reads both forms and still pins 22 files and 26 arms. A new row checks that each adopted arm's file declares its action. This has a ledger row.
- **Commit:** `217593b`.

### Measured differences from the plan (recorded)

- **Files and handlers.** 43 files, matching the plan's "about 43", and 60 handlers.
  - The first commit's body originally said "37 console sites" and "35 handlers". I amended that local, unpushed commit to the measured 34 and 34 before any later commit.
  - The arm table's 35 includes the two recommendations arms, which belong to 06-14.
- **The plan's PENDING_WRAP acceptance one-liner is vacuous.** Its slice ends at the `]` of `string[]`, so it never reads the array. A strict check over the array also exits 0: 48 entries, none from these families.
- **Census C7 misses the `updateError.message` sites.** Its exclusion of `dateError.message` matches `updateError.message` as a substring, and that is why 06-12 counted 42 S2 sites against C7's 40. The clubs appeal site is now fixed and pinned as an E2 addition. The events appeal site is left for 06-14.
- **`admin-console-defect.test.ts` and `clubs-console-defect.test.ts` were not created.** The plan made them conditional, and no PRESERVE suite in these families has a kind-B console pin: all 22 spies in the 06-13 group are kind A. Instead, two untagged kind-B suites were edited in place, as the inventory says: `admin-event-notification` and `club-transfer`.
- **A NOT_DRIVEN line was retired, not fixed.** `admin/events/[id]/status/route.ts:244` (`row.message`) was never a caught error. It was rewritten through destructuring so the S2 census no longer counts it, and it sits in `RETIRED` with its reason.

## Issues Encountered

- **Two scripting slips, both harmless.**
  - The first step-4 swap ran under zsh, which did not word-split the file list. Nothing was swapped. The run was redone under bash, and `cmp` confirmed the tree.
  - macOS bash 3.2 has no `mapfile`, so the script uses a `read` loop instead.
- **No auth gates.** Every state call succeeded on its first attempt.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: silent-500s | src/app/api/admin/*.ts, src/app/api/clubs/**/route.ts | Many handlers answer `{"error":"Internal server error"}` or `Failed to …` on a database error without logging it. That was true before this plan, which converted existing console calls and added logs only where error text left a body. A failure there stays invisible until 06-16's Sentry path, which sees only uncaught throws. Worth a log line per site in a later sweep. |
| threat_flag: cached-404 | src/app/api/clubs/[id]/route.ts | The club detail GET answers 404 when the database read errors, and `public-60-300` makes a 404 shareable, so a transient database error can be cached for 60 s. Before this plan, vercel.json cached every status. 06-15's cache e2e should decide whether an errored read should answer 500. |

## Requirements

REFAC-19 and REFAC-20 are left open, because both still need work from 06-14 and 06-15:
- **REFAC-19** also needs the remaining 48 route files and the removal of the `vercel.json` headers (06-14), plus the cross-user cache test (06-15).
- **REFAC-20** needs the remaining console sites converted: 141 allow-listed sites, 06-14.

## Self-Check: PASSED

- The created files exist: `admin-arm-tree-defect.test.ts`, `write-arm-tree-defect.test.ts` and `evidence/route-adoption-a.txt`.
- Commits `217593b` and `2c12a61` are in `git log`. The ledger carries `217593b` 56 times and `2c12a61` 28 times.
- No TODO, FIXME or placeholder text in any changed source file.
