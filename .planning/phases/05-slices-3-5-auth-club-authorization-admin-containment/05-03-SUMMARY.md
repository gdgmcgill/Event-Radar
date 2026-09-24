---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 03
subsystem: testing
tags: [jest, characterization, handler-ring, ban, onboarding, mutation-testing, F-088, F-089, F-028]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-01: F-088/F-089 registered, DEC-34/DEC-35/DEC-39; 05-02: Jest floor 785, tag gate ok 23"
provides:
  - "WRITE_ARMS: 39 write-arm descriptors derived from the route tree, typed through each handler's own export, plus six persona builders and runArm/refusedWith/writeCalls/callShape helpers"
  - "PRESERVE net (69 tests): table equals tree, the anonymous bytes of every arm, the legacy 403 Account suspended bytes, both onboarding exemptions admitted, expired suspension admitted, anonymous-tolerant writers admitted"
  - "DEFECT net (106 tests) F-088 D1/D2 and F-089 D3 with an empty GUARDED set; 05-06 and 05-07 flip one row per arm by adding its id"
  - "DEFECT F-028 (8 tests): four personalized GETs answer anonymous 200 today; signed-in rows stay fixed"
  - "8 source-mutation cycles and 1 GUARDED measurement, each red as predicted, each restored byte-identical"
affects: [05-04, 05-06, 05-07, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Table-driven handler ring: one descriptor per arm, whose invoke closure dynamically imports the route and calls the verb as its own type"
    - "DEFECT rows flip through a GUARDED set held in the DEFECT file. The fixing commit edits one token per arm, and the PRESERVE file is never touched"
    - "runArm records a handler that throws as status 'threw', so fake gaps (upsert, ilike, contains, storage) count as admissions instead of crashing the suite"

key-files:
  created:
    - src/__tests__/api/auth-ring/writeHandlerTable.ts
    - src/__tests__/api/auth-ring/write-handlers-characterization.test.ts
    - src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts
    - src/__tests__/api/events/anonymous-personalized-defect.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-characterization-handlers.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-mutation-check-handlers.txt
  modified: []

key-decisions:
  - "The arm list is re-derived from src/app/api on every run (PRESERVE P0), so an arm added without a descriptor turns the net red"
  - "Anonymous-tolerant arms pin their measured status and success:true, not the fake-generated interaction id"
  - "D1's fixed shape requires exactly one users select. The guard therefore has to read the context's single profile row, not add a second read"
  - "Kept the capitalized tag words out of cross-references, so each file's gate tag is exactly its role (05-02 convention)"

patterns-established:
  - "Measure first with a temporary harness that is never committed, record the output verbatim, then pin"
  - "A fix-shape CONTROL for each DEFECT family (2b D1, 2c D2, 4b D3) shows that the guard moves only its DEFECT row"

requirements-completed: []  # REFAC-11 is characterized here, not delivered; 05-06/05-07 close the handler-ring clauses

# Metrics
duration: 11min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 03: Handler Ring Characterization Summary

**This plan pinned all 39 state-changing, non-admin write arms in one descriptor table. Every arm's anonymous bytes and the ten legacy `403 {"error":"Account suspended"}` responses are PRESERVE. Today's admission of banned, profile-less and un-onboarded callers is DEFECT F-088/F-089. The four F-028 anonymous 200s are also DEFECT. Every pin was measured before it was written and was shown red under a source mutation.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-09-24T04:49:06Z
- **Completed:** 2026-09-24T05:00:14Z
- **Tasks:** 3 of 3
- **Files created:** 6 (1 test helper, 3 test suites, 2 evidence files). No file was modified.

## Accomplishments

- **The descriptor table** (`writeHandlerTable.ts`) has one entry for each of the 39 arms the node enumeration finds in `src/app/api`, excluding `admin/`, `cron/` and `recommendations/batch/`.
  - Each `invoke` imports its route and calls the handler as its own type. `onboarding/complete` and `user/engagement` are called with no arguments. No handler signature was widened, and `tsc` exits 0.
  - The flags mark 10 `legacyBan` arms, 2 `onboardingExempt` arms and 2 `anonymousTolerant` arms.
  - Six personas: anonymous, active, banned, expired, unonboarded, noProfile.
- **PRESERVE** (`write-handlers-characterization.test.ts`, 69 tests):
  - P0: the table equals the tree, and the three flag sets are exact.
  - P1 (anonymous): 34 arms answer 401 `{"error":"Unauthorized"}`. Three answer 401 with their own text: `events/[id]` PATCH, `events/create` POST and `recommendations/feedback` POST. Anonymous callers never write on the non-tolerant arms. `feedback` answers 200 and `interactions` answers 201.
  - P2: a banned caller on each of the ten legacy arms gets exactly `403 {"error":"Account suspended"}`, with no insert, update, delete or rpc.
  - P3: an un-onboarded caller is admitted on both exemptions. `onboarding/complete` answers 200 `{"success":true}`, and the self `users/[id]` PATCH stores `onboarding_completed: true`.
  - P4: an expired suspension is not refused.
  - P5: the anonymous-tolerant writers admit an active signed-in caller.
- **DEFECT** (`write-handlers-ring-defect.test.ts`, 106 tests; cites F-088, F-089 and F-062):
  - D1: the banned caller on the 29 arms without the legacy helper.
  - D2: the no-profile caller on all 39 arms.
  - D3: the un-onboarded caller on the 37 non-exempt arms.
  - `GUARDED` is declared as `new Set<string>([])`. For every arm id, a guarded row switches from the today-shape to the fixed shape: exact 403 bytes, and either no write (D2/D3) or exactly `["users.select"]` (D1).
- **F-028** (`anonymous-personalized-defect.test.ts`, 8 tests):
  - Anonymous callers get 200 today: `{"events":[]}` from `following`, `friends-activity` and `friends-organizing`, and `{"friends":[],"count":0}` from `events/[id]/friends`.
  - For each route, a signed-in row pins 200 and the route's first data read.
  - The evidence lists each client caller with its signed-in guard. All four callers are user-gated and ignore a non-ok response.
- **What the measurement showed** (`slice-3-characterization-handlers.txt` §2, 234 lines):
  - A banned caller reaches an insert, update, delete or rpc on 12 arms. A caller with no profile does on 16 arms, and an un-onboarded caller on 17.
  - `profile/inferred-tags` DELETE already answers `404 {"error":"Profile not found"}` for a no-profile caller. The D2 fix changes only its status.
- **Mutation evidence** (`slice-3-mutation-check-handlers.txt`):
  - The five named cycles each went red on the predicted row.
  - The three controls (2b, 2c, 4b) each reddened exactly one DEFECT row and left all 69 PRESERVE tests green.
  - M1 (adding a GUARDED id against unmodified source) reddened D1, D2 and D3 for that arm, so the fixed-shape branch is not vacuous.
  - Every file was restored with `git diff --exit-code` 0.

## Task Commits

1. **Task 1: descriptor table, PRESERVE and DEFECT suites.** `de4388e` (test)
2. **Task 2: F-028 anonymous 200s.** `567d506` (test)
3. **Task 3: mutation evidence and closing checks.** `4098ce1` (docs)

## Floor after this plan

| Gate | Before (05-02) | After |
|---|---|---|
| `npx jest --ci` | 785 passed | 968 passed, 0 failed, 58 suites (+183 tests, +3 suites) |
| `node scripts/check-characterization-tags.mjs --all` | ok 23 | ok 26 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `git status --porcelain -- src/app src/lib src/server supabase/` | empty | empty |

## Decisions Made

- **Measured before pinning.** Two temporary harnesses produced the measurements. `zz-measure-temp.test.ts` covered the 6 personas across 39 arms, and `zz-measure-f028-temp.test.ts` covered the four routes. Both were deleted after their run and never committed. Their output is in the evidence verbatim.
- **D1's fixed shape is exactly one `users` select.** That is DEC-36's single read. The legacy arms read `users` twice today (the helper, then the context on `save` and `rsvp` POST). So the 05-04 guard must work from the context's own profile row, extended with the ban columns, rather than adding a read. If it adds a read, every D1 row it flips will fail its fixed shape.
- **D2's fixed body is `"Profile not found"`, following DEC-35.** The research's Pattern 1 sketch returns `"Account suspended"` for a null profile. DEC-35 superseded that sketch, and the pin follows DEC-35.

## Deviations from Plan

### Rule-resolved choices

**1. The tree has 39 arms in 33 files, not 30.** The arm list matches the plan exactly. The plan's file count was wrong, because six files hold two arms each. The tree wins, and the evidence records the enumeration. DEC-34's "40 arms" is these 39 plus the admin-gated `recommendations/batch` POST.

**2. The acceptance grep counts 40 `id: "` matches.** The criterion is ≥39, so it passes. `CALLER`'s own `id` field is the 40th match. The evidence records the exact descriptor-versus-tree comparison: table=39, tree=39, equal=true.

**3. The literal `git diff --stat <05-01 head> -- src/app src/lib src/server` cannot print nothing.** 05-02 added three test files under those paths, and this plan added none. The evidence records the command verbatim with its output. It also records the same diff excluding `*.test.ts(x)`, which is empty; the diff from this plan's base `0c265a4`, which is empty; and name-status showing only `A` lines under `src/`. 05-02 met the same situation and recorded it the same way.

**4. Cycles 2 and 4 also redden a P1 row.** The plan words both mutations as a 403 "for every caller" / "first", so the anonymous caller gets the 403 too. Both cycles' expected lines predicted the extra ✕, and it appeared. Controls 2b and 4b apply the guard after authentication and show that PRESERVE stays green.

**5. Additions beyond the plan's list (evidence and pins only):**
- PRESERVE P0 (table equals tree, flag sets exact) and P5 (anonymous-tolerant arms admit a signed-in caller).
- Three control cycles and measurement M1.
- None of these changes a plan-required assertion. P0 is the T-05-03-01 mitigation made executable.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Miscounted anonymous 401s in a draft docblock and in the evidence**
- **Found during:** Task 1, while writing the evidence.
- **Issue:** the draft said "35 arms answer 401 Unauthorized, two with their own text". The measurement shows 34 and three.
- **Fix:** corrected both before the Task 1 commit. The pinned `ANONYMOUS_BYTES` map was always the measured values; only the prose was wrong.
- **Files modified:** `write-handlers-characterization.test.ts` (docblock), `evidence/slice-3-characterization-handlers.txt`.
- **Commit:** `de4388e`

**2. [Rule 1 - Bug] The table-versus-tree evidence one-liner counted CALLER's id**
- **Found during:** Task 1 evidence.
- **Issue:** the first comparison regex matched `id: "5eed…"` and reported table=40, equal=false.
- **Fix:** narrowed the regex to `<route> <VERB>` ids and replaced those three evidence lines with the corrected run (table=39, equal=true). The P0 test compares ids from the imported array, so it was never affected.
- **Commit:** `de4388e`

## Observations for later plans

- **05-06 must also move `src/__tests__/api/events/friends-defect.test.ts:308`.** Its test "an unauthenticated caller short-circuits before any of this" pins the anonymous `{"friends":[],"count":0}` on `events/[id]/friends`. It moves together with the F-028 A4 row and needs its own ledger entry.
- **Flipping a row** means adding the arm id to `GUARDED` in `write-handlers-ring-defect.test.ts` in the same commit that guards the arm, with a `defect-ledger.md` row. Before the id is added, the today-shape assertion must go red against the fix. That is the ledger's proof that the row pinned something.
- **Three arms keep their own anonymous text** under DEC-34: `events/[id]` PATCH, `events/create` POST and `recommendations/feedback` POST. P1 pins all three.
- **`recommendations/feedback` POST cannot be guarded with a plain `requireActiveUser` ahead of the anonymous branch.** Its thumbs and analytics paths fall back to a body `user_id` when there is no session, and P1 pins the 401 text of the no-`user_id` path. See the deferred item below.
- **The fake has no `upsert`, `ilike`, `contains` or `storage` member.** Arms that reach one of them answer 500 or throw (`runArm` records `"threw"`). No PRESERVE value depends on that. A guarded arm stops before any of them, so the fixed shapes are unaffected.

## Deferred items found

- **Candidate DI (05-08 to register):** in `src/app/api/recommendations/feedback/route.ts`, both POST paths take `authUser?.id ?? body.user_id`. So with no session, the handler writes feedback attributed to whatever `user_id` the body names: an explicit-feedback upsert on the thumbs path, an insert on the analytics path. No finding in `findings.json` covers it; the search terms were `recommendations/feedback`, body `user_id` and impersonation. It was not verified whether the tables' RLS refuses an anon-role write with a foreign `user_id`. That probe belongs in the local-stack RLS work, not in this plan. DEC-34's "keep its own anonymous branch first" wording would preserve the fallback, so 05-07 should decide on it deliberately.

## Known Stubs

None. Only test files and evidence were created.

## Threat Flags

None. No endpoint, auth path, file-access pattern or schema changed. The threat-register mitigations were applied:
- T-05-03-01: P0 derives the arm list from the tree on every run.
- T-05-03-02: every cycle ends with `git diff --exit-code` 0, and the FINAL check covers all seven touched files.
- T-05-03-03: the invoke closures call each handler as its own type, and `tsc` exits 0.
- T-05-03-04: every pinned value was measured first, and the measurements are in the evidence.

## Issues Encountered

None beyond the two auto-fixes above.

## Next Phase Readiness

- 05-04 builds `requireActiveUser` and `requireOnboarded`. Its bodies must be `"Account suspended"`, `"Profile not found"` and `"Onboarding required"`, and the ban read must come from the context's single `users` row (D1's fixed shape).
- 05-06 (the events family, 12 arms) and 05-07 (the other 27) flip `GUARDED` rows. The PRESERVE file and `writeHandlerTable.ts` must stay unedited.

## Self-Check: PASSED

- FOUND: src/__tests__/api/auth-ring/writeHandlerTable.ts, src/__tests__/api/auth-ring/write-handlers-characterization.test.ts, src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts, src/__tests__/api/events/anonymous-personalized-defect.test.ts, evidence/slice-3-characterization-handlers.txt, evidence/slice-3-mutation-check-handlers.txt
- FOUND: commits de4388e, 567d506, 4098ce1
- Tag gate `--all` ok 26; tsc exit 0; Jest 968/968; `git status --porcelain -- src/app src/lib src/server supabase/` empty

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
