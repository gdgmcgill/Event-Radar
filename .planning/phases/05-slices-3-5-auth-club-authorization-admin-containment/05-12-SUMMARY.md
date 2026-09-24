---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 12
subsystem: testing
tags: [jest, playwright, characterization, admin-guard, csrf, mutation-testing, F-061, F-001, F-091, F-005, F-086, F-090, DI-48, REFAC-13, REFAC-17]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-11: slice 4 closed on a green floor (Jest 1135, tag gate ok 29, Playwright 76/0); 05-08: DI-48 registered (a banned admin is refused on /api/admin/* only by the proxy)"
provides:
  - "ADMIN_ARMS: 35 admin-arm descriptors derived from the tree (33 helper arms in 25 files plus both calculate-popularity verbs), typed through each handler's own export, with anonymous/student/admin/bannedAdmin personas and an elevated-fake builder"
  - "PRESERVE admin guard net (73 tests): table equals tree; student 403 Forbidden at 32 arms; anonymous 401 at the 3 arms that answer it; admin admitted at all 35"
  - "DEFECT admin guard net (73 tests): F-061 anonymous 403 at 30 arms and batch's non-admin 401; F-001 calculate-popularity open to anonymous and non-admin callers; DI-48 banned admin admitted at 35 arms. FIXED_ARMS and BAN_GUARDED_ARMS are empty"
  - "DEFECT F-091 (6 tests), F-005 (6 tests, jsdom), F-086 (4 tests), each with rows that do not move"
  - "Playwright: DEFECT F-061 and two DEFECT F-090 tests on the real stack, with PRESERVE rows; no saved row left behind"
  - "8 source-mutation cycles and 4 ledger-set measurements, each red on its named rows and restored byte-identical"
affects: [05-13, 05-14, 05-15, 05-17, 05-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS expressed in a fake by what the cookie fake holds: fake A carries only the rows the caller's UPDATE can match, so a 0-row update and its 500 are reproduced rather than asserted from memory"
    - "Two ledger sets in one DEFECT file (FIXED_ARMS for F-061/F-001, BAN_GUARDED_ARMS for DI-48), so one fix commit does not have to decide the other defect"
    - "A server-component page characterized in the jsdom project by calling the default export and generateMetadata directly, with next/navigation's notFound/redirect mocked as throwing sentinels"

key-files:
  created:
    - src/__tests__/api/admin/adminArmTable.ts
    - src/__tests__/api/admin/admin-guard-characterization.test.ts
    - src/__tests__/api/admin/admin-guard-defect.test.ts
    - src/__tests__/api/admin/admin-users-patch-defect.test.ts
    - src/__tests__/pages/public-profile-defect.test.tsx
    - src/__tests__/api/events/pending-edits-defect.test.ts
    - e2e/specs/admin-guard.spec.ts
    - e2e/specs/csrf-origin.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-5-characterization.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-5-mutation-check.txt
  modified: []

key-decisions:
  - "The measurement overrides research § B. admin/clubs GET and admin/organizer-requests GET already answer a non-admin 403 Forbidden, so their student 403 is PRESERVE. Only recommendations/batch POST carries the F-061 non-admin-401 DEFECT row"
  - "DI-48 is pinned (D4, all 35 arms) through its own BAN_GUARDED_ARMS set, not FIXED_ARMS. 05-13's requireRole swap can fill FIXED_ARMS without also having to compose requireActiveUser"
  - "F-091 pins the real-stack 500, not the fake's 200: fake A holds only the caller's own users row, which is what RLS lets the cookie UPDATE match"
  - "calculate-popularity GET has no rpc. Its F-001 today-shape is the event_popularity_scores read on the elevated fake. The fixed shape for both verbs is that the elevated fake is never called"

patterns-established:
  - "Admin-arm characterization: a tree-derived table, PRESERVE for the bytes that survive, DEFECT rows flipping through a set held in the DEFECT file, and a ledger-set measurement that proves each set's fixed branch is not vacuous"

requirements-completed: []  # REFAC-13 and REFAC-17 are characterized here, not delivered; 05-13..05-17 deliver them

# Metrics
duration: 14min
completed: 2026-09-24
---

# Phase 5 Plan 12: Slice 5 Characterization Summary

**This plan pins every admin arm's surviving bytes and its F-061/F-001 defects arm by arm, from a 35-row table derived from the tree. It also pins three behaviour defects (F-091, F-005, F-086), the banned-admin gap (DI-48), and the CSRF exposure (F-090) on the real stack. Every pin was measured before it was written and was shown red under a source mutation. No production file changed.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-09-24T21:08Z
- **Completed:** 2026-09-24T21:22Z
- **Tasks:** 3 of 3
- **Files created:** 10 (1 test helper, 5 Jest suites, 2 Playwright specs, 2 evidence files). No file was modified.

## Accomplishments

- **The arm table** (`adminArmTable.ts`) was built from a node enumeration of the tree: 35 arms in 26 files.
  - 33 arms in 25 files call the admin-verify helper. This matches the before-floor census of 33 callsites.
  - The other 2 arms are calculate-popularity, which gates on `ADMIN_API_KEY` alone.
  - Each `invoke` imports its route and calls the handler as its own type. Six handlers take no arguments and are called with none. `tsc` exits 0.
  - Three flags record the measured deny behaviour: `anonymous401` (3 arms), `student401` (1 arm) and `machineKey` (2 arms).
- **PRESERVE** (`admin-guard-characterization.test.ts`, 73 tests):
  - P0: the table equals the tree, and the flag sets are exact.
  - P1: a student gets `403 {"error":"Forbidden"}` with no write at 32 arms.
  - P2: an anonymous caller gets `401 {"error":"Unauthorized"}` at `admin/clubs` GET, `admin/organizer-requests` GET and `recommendations/batch` POST.
  - P3: an admin is admitted (neither 401 nor 403) at all 35 arms.
- **DEFECT** (`admin-guard-defect.test.ts`, 73 tests; cites F-061 and F-001):
  - D1: an anonymous caller gets 403 at 30 arms. Fixed shape: 401 Unauthorized.
  - D2: a non-admin gets 401 at batch. Fixed shape: 403 Forbidden.
  - D3: calculate-popularity POST/GET answer 200 to anonymous and non-admin callers. Today POST calls the `update_event_popularity` rpc and GET reads the scores, both on the elevated fake. Fixed shape: 401 or 403, with the elevated fake never called.
  - D4: DI-48. A banned admin is admitted at all 35 arms. Fixed shape: `403 {"error":"Account suspended"}`.
  - `FIXED_ARMS` and `BAN_GUARDED_ARMS` are both empty.
- **F-091** (`admin-users-patch-defect.test.ts`). Pinned today:
  - Another user's roles change is written on the cookie client, strips `admin`, answers 500, and writes no audit row.
  - The organizer toggle answers 500 in the same way.
  - An admin's own-id roles change is admitted, and the strip demotes the admin.
  - `superuser` is not validated.
  - Rows that do not move: a name-only self edit, and a non-admin 403.
- **F-005** (`public-profile-defect.test.tsx`, jsdom). Pinned today:
  - `generateMetadata` puts a private target's name in the title with zero session reads.
  - The private page renders to an anonymous viewer without calling `notFound()`.
  - The users select is the exact string, including `email`.
  - Rows that do not move: a public profile renders, its title carries the name, and a missing target 404s.
- **F-086** (`pending-edits-defect.test.ts`, real transform):
  - Pinned today: neither the creator nor an admin receives `pending_edits`.
  - Rows that do not move: the stranger and anonymous rows.
  - `events-detail-characterization.test.ts` and `audit-shape.test.ts` pass unedited.
- **Playwright**, after a clean reset and seed, 17/17 (10 setup and 7 spec tests):
  - `admin-guard.spec.ts`: anonymous `GET /api/admin/stats` answers 403 (DEFECT F-061). Student 403 and admin 200 are PRESERVE.
  - `csrf-origin.spec.ts`: a signed-in POST with `Origin: https://evil.example`, or with `Sec-Fetch-Site: cross-site`, answers 200 `{saved:true}` and writes the row (DEFECT F-090 ×2). Same-origin and headerless POSTs are PRESERVE.
  - Afterwards, `saved_events` holds 0 rows for onboarded_student × secondApprovedEvent, and 0 in the whole table.
- **Mutation evidence** (`slice-5-mutation-check.txt`):
  - 8 source cycles: the helper admitting everyone, the batch fix shape (a control), removing admin/clubs's 401 branch, a key-less calculate-popularity 401, no admin strip, a private-profile `notFound()`, copying pending_edits, and the helper refusing banned callers.
  - Each cycle went red on its named rows and was restored with `git diff --exit-code` 0.
  - 4 ledger-set measurements showed that each set's fixed branch is not vacuous.

## Task Commits

1. **Task 1: admin arm table, PRESERVE and DEFECT guard suites.** `52937b6` (test)
2. **Task 2: F-091, F-005 and F-086 pins.** `1753bc3` (test)
3. **Task 3: admin-guard and CSRF Playwright pins; mutation evidence.** `c865d51` (test)

## Floor after this plan

| Gate | Before (05-11) | After |
|---|---|---|
| `npx jest --ci` | 1135 passed | 1297 passed, 0 failed, 70 suites (+162 tests, +5 suites) |
| `node scripts/check-characterization-tags.mjs --all` | ok 29 | ok 34 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| Playwright (targeted, clean reset) | n/a | 17/17 (admin-guard 3, csrf-origin 4, setup 10) |
| `git diff --stat 4e368b6 -- src/app src/lib src/server` | n/a | empty |

## Decisions Made

- **The measurement wins over research § B.** DEC-44's evidence and research § B say that `admin/clubs` GET and `admin/organizer-requests` GET answer 401 to non-admins. The source checks `!user → 401` first and `!isAdmin → 403` second, and the measurement confirms a student gets 403 Forbidden. That is already the contract, so it is PRESERVE (P1). Only `recommendations/batch` POST has a D2 row.
- **DI-48 has its own ledger set.** The notes passed in ask for the banned-admin gap to be pinned as a DEFECT. 05-13's plan composes only `requireRole`. Keying D4 on `FIXED_ARMS` would block 05-13 unless it also decides DI-48, so D4 flips through `BAN_GUARDED_ARMS` instead.
- **F-091 reproduces the real 500.** Fake A holds only the caller's own row, as RLS does for the cookie UPDATE. So the other-target update matches 0 rows and `.single()` errors, exactly as on the local stack. Fake B holds every row, which lets the 05-14 fix (an update on B) succeed without a fixture edit.

## Deviations from Plan

### Rule-resolved choices

**1. The legacy-401 set splits in two after measurement.**
- The plan treats all three sites as "student → today 401". Only `recommendations/batch` POST behaves that way.
- The table therefore carries `anonymous401` (3 arms) and `student401` (1 arm) instead of one `legacy401` flag.
- The plan's must-have ("legacy401 arms, student → today 401") holds for the one arm where it is true. The other two arms' student 403 is pinned PRESERVE. The evidence is in `slice-5-characterization.txt` § 1.3–1.5.

**2. Mutation cycle (2) was replaced.** The plan's cycle, "give admin/clubs GET a 403 for non-admins", would be a no-op because it already answers 403. Two cycles replace it:
- 2a gives batch POST the 05-13 fix shape. Only D2 turned red, and P2's batch row stayed green (a control).
- 2b removes admin/clubs GET's anonymous-401 branch. P2's admin/clubs row turned red.

**3. calculate-popularity GET has no rpc.** The plan says "the rpc called on fake B" for both verbs. GET's today-shape is `event_popularity_scores.select, events.select` on fake B. POST's is `events.select, update_event_popularity.rpc`.

**4. Addition beyond the plan: D4 (DI-48) and mutation cycle 7.** These follow the orchestrator's note and DI-48's owner text. They add no production change.

**5. Cycle 3 turned 8 rows red, against 6 predicted.** The two calculate-popularity D4 rows ("banned admin admitted today") also went red, because the mutation refuses every caller. The result is correct, and it is recorded in the evidence reading.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-dom/server` does not load in the jsdom project**
- **Found during:** Task 2, the first run of `public-profile-defect.test.tsx`.
- **Issue:** `ReferenceError: TextEncoder is not defined` when the suite imported `renderToStaticMarkup`.
- **Fix:** the suite renders the page's element with `@testing-library/react`'s `render` and reads `container.textContent`. No config was changed.
- **Commit:** `1753bc3`

**2. [Rule 1 - Bug, my own draft] Capitalized tag words in cross-references**
- **Issue:** the draft DEFECT docblocks said "PRESERVE sibling" and "PRESERVE suite". Under the file-level tag gate, that would have tagged those files PRESERVE+DEFECT.
- **Fix:** each file is now referenced by name (05-02/05-03 convention). The gate reads exactly one tag per new file.
- **Commits:** `52937b6`, `1753bc3`

### Evidence notes

- In `slice-5-characterization.txt` Part 3, the reset and seed steps were piped through `tail`. Their two `exit=` values are therefore tail's, which the file says. Their own success lines are recorded verbatim: `Finished supabase db reset on branch main.` and the seed summary. The Playwright `exit=0` is the runner's own.

## Observations for later plans

- **05-13:**
  - Its Task 1 commit body says "admin/clubs GET non-admins now 403", and its Task 2 says "`admin/organizer-requests` GET … become 403 for non-admins". Both are already true.
  - For those two arms, the swap to `requireRole` changes nothing observable. Adding them to `FIXED_ARMS` is harmless because neither has a D1 or D2 row.
  - The only non-admin status change in slice 5 is `recommendations/batch` POST.
  - `BAN_GUARDED_ARMS` flips only if 05-13 composes `requireActiveUser(ctx)` ahead of `requireRole`, or makes `requireRole` read the ban columns.
- **05-14:** add both calculate-popularity ids to `FIXED_ARMS`. The fixed D3 rows require that the elevated fake is never called for a refused caller. The admin row is P3 in the PRESERVE file.
- **05-19:** the INTENTIONAL BEHAVIOUR CHANGE list says "three routes' non-admins 403". Measured, it is one route.
- **The fake gaps** (`upsert`, `contains`) make three admin arms throw after the gate. P3 counts a throw as admission. No pinned value depends on those gaps.

## Deferred items found

- **Candidate (05-19 to register as DI-52 or record as a correction):** research § B, DEC-44's evidence, and the 05-13/05-19 plan text overstate the legacy-401 set. `admin/clubs` GET and `admin/organizer-requests` GET answer a non-admin 403 today. Only `recommendations/batch` POST answers 401. This is a planning-register correction, not a product defect.

## Known Stubs

None. Only test files and evidence were created.

## Threat Flags

None. No endpoint, auth path, file-access pattern or schema changed. The threat-register mitigations were applied:
- **T-05-12-01:** the arm list is derived from the tree and recorded, and PRESERVE P0 re-derives it on every run (35 descriptors).
- **T-05-12-02:** a `finally` DELETE, and the post-run `saved_events` count of 0.
- **T-05-12-03:** neither spec requests calculate-popularity (grep exit 1), and the unit suites mock the rpc.
- **T-05-12-04:** every pin cites F-061, F-001, F-005, F-086, F-090 or F-091, all registered, or DI-48. The tag gate reports ok 34.

## Issues Encountered

None beyond the deviations above.

## Next Phase Readiness

- 05-13 can start. The stack is reset and seeded; the Playwright run leaves no residue, and port 3000 is free. The tree is clean apart from the three untracked files that must stay untracked.

## Self-Check: PASSED

- FOUND: src/__tests__/api/admin/adminArmTable.ts, src/__tests__/api/admin/admin-guard-characterization.test.ts, src/__tests__/api/admin/admin-guard-defect.test.ts, src/__tests__/api/admin/admin-users-patch-defect.test.ts, src/__tests__/pages/public-profile-defect.test.tsx, src/__tests__/api/events/pending-edits-defect.test.ts, e2e/specs/admin-guard.spec.ts, e2e/specs/csrf-origin.spec.ts, evidence/slice-5-characterization.txt, evidence/slice-5-mutation-check.txt
- FOUND: commits 52937b6, 1753bc3, c865d51
- Tag gate `--all` ok 34; tsc exit 0; Jest 1297/1297; `git diff --stat 4e368b6 -- src/app src/lib src/server` empty

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
