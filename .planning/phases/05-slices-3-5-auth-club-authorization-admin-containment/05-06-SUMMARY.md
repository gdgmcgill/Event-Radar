---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 06
subsystem: auth
tags: [handler-ring, seam-guards, ban, onboarding, F-028, F-062, F-088, F-089, DEC-34, DEC-35, DEC-39]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-03: WRITE_ARMS table, the PRESERVE and DEFECT handler-ring nets, the F-028 DEFECT suite; 05-04: requireActiveUser and requireOnboarded, the widened context row; 05-05: the fail-closed proxy (floor Jest 1012, tag gate ok 26)"
provides:
  - "14 write arms in 11 files open with createRequestContext(), requireActiveUser(ctx), requireOnboarded(ctx): banned, profile-less and un-onboarded callers are refused on the handler ring"
  - "The Phase 4 ban asymmetry is closed: a banned caller can no longer unsave or cancel an RSVP (ban-asymmetry-defect.test.ts)"
  - "14 ids in GUARDED; the 35 D1/D2/D3 rows for these arms are in their fixed shape"
  - "Four F-028 routes answer an anonymous caller 401 {\"error\":\"Unauthorized\"}"
  - "No handler in the events family calls the legacy ban helper any more; 05-07 owns the rest"
affects: [05-07, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard prologue: ctx → requireActiveUser → requireOnboarded as the first statements inside the existing try; `await params` moves after it"
    - "An arm with its own anonymous 401 text keeps an explicit `if (!ctx.user)` branch before the guards (DEC-34)"
    - "Legacy mock suites get an active, onboarded users row as a fixture completion, never an assertion change"

key-files:
  created:
    - src/__tests__/api/events/ban-asymmetry-defect.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/handler-adoption-events.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-fixture-completions.md
  modified:
    - src/app/api/events/[id]/save/route.ts
    - src/app/api/events/[id]/rsvp/route.ts
    - src/app/api/events/create/route.ts
    - src/app/api/events/[id]/invite/route.ts
    - src/app/api/events/[id]/appeal/route.ts
    - src/app/api/events/[id]/report/route.ts
    - src/app/api/events/[id]/reviews/route.ts
    - src/app/api/events/[id]/route.ts
    - src/app/api/events/upload-image/route.ts
    - src/app/api/recommendations/feedback/route.ts
    - src/app/api/user/engagement/route.ts
    - src/app/api/events/following/route.ts
    - src/app/api/events/friends-activity/route.ts
    - src/app/api/events/friends-organizing/route.ts
    - src/app/api/events/[id]/friends/route.ts
    - src/__tests__/api/events/save-characterization.test.ts
    - src/__tests__/api/events/rsvp-characterization.test.ts
    - src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts
    - src/__tests__/api/events/anonymous-personalized-defect.test.ts
    - src/__tests__/api/events/friends-defect.test.ts
    - src/__tests__/api/events/rsvp.test.ts
    - src/__tests__/api/events/reviews.test.ts
    - src/__tests__/api/events/date-validation.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md

key-decisions:
  - "recommendations/feedback POST gets the plan's explicit anonymous branch first. That makes the body user_id fallback unreachable, which closes 05-03's candidate impersonation DI on the handler ring. The dead fallback code is left in place (the plan says to keep every read and write) and a comment says it is unreachable"
  - "The guard prologue goes before `await params` in the arms that awaited params first. params is an already-resolved promise and does no I/O, so the order is not observable"
  - "The two moved blocks each took the blank separator line above them. The diff of the PRESERVE files is 31 deletions and 0 additions"

patterns-established:
  - "Moving a PRESERVE pin: delete the block with nothing else changed, recreate it in a <name>-defect.test.ts in the fixed shape, and add a ledger row, all in the fix commit"

requirements-completed: []  # REFAC-11 is partial: 05-07 guards the remaining 25 arms

# Metrics
duration: 10min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 06: Events-Family Write Guards and F-028 Summary

**Fourteen events-family write arms now decide ban, onboarding and missing-profile outcomes themselves, starting with `requireActiveUser(ctx)` and `requireOnboarded(ctx)`. The Phase 4 ban asymmetry is closed: a banned user can no longer unsave or cancel an RSVP. The four F-028 personalized GETs answer an anonymous caller `401 {"error":"Unauthorized"}`. Every PRESERVE byte held. The only PRESERVE-file changes are the two sanctioned block deletions.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-09-24T05:41:10Z
- **Completed:** 2026-09-24T05:51:00Z
- **Tasks:** 2 of 2
- **Files:** 3 created, 24 modified

## Accomplishments

### Task 1: events-family write arms (DEC-34, F-088, F-089)

- **Guard prologue on 14 arms in 11 files.** The arms are save POST and DELETE, rsvp POST and DELETE, create, invite, appeal, report, reviews POST, `events/[id]` PATCH and DELETE, upload-image, `recommendations/feedback` POST and `user/engagement` POST.
  - Each now runs `createRequestContext()`, then `requireActiveUser(ctx)`, then `requireOnboarded(ctx)` as its first statements.
  - The legacy `checkBanStatus()` call and each handler's own `getUser()` are gone. So is the `createClient` import where it served only auth. Reviews, `events/[id]` and feedback keep it for their GETs.
  - Every later read, write, service-client use, `club_members` check and error body is unchanged.
- **Own anonymous text kept.** `events/[id]` PATCH, `events/create` and `recommendations/feedback` keep their own 401 text in an explicit `if (!ctx.user)` branch placed before the guards. PRESERVE P1 holds all three byte-for-byte.
- **Ban asymmetry closed.** The two "ban asymmetry — pinned for Phase 5 (DEC-24)" blocks were deleted from the save and rsvp PRESERVE suites. The diff is 31 deletions and 0 additions. The same cases were recreated in `ban-asymmetry-defect.test.ts` in their fixed shape: 403 `Account suspended`, the saved row and the RSVP untouched, and no write call.
- **`GUARDED` has 14 ids.** The 35 rows this flips (7 D1, 14 D2, 14 D3) now assert the fixed shapes.
- **Ledger protocol.** The suites were run in three states, each recorded in `handler-adoption-events.txt` §1–§3:
  - unedited: red, 37 failures (the 35 rows plus the 2 blocks);
  - moved: green;
  - pre-fix sources restored from `9c33617`: red, 37 failures. The fixed sources were then restored and checked `cmp`-identical, all 11.
- **Legacy suites.** `rsvp.test.ts`, `reviews.test.ts` and `date-validation.test.ts` failed only on the guards' 403s. Each fixture gained an active, onboarded `users` row, and no `expect(` line changed (grep exit 1). All three edits are recorded in `slice-3-fixture-completions.md`.

### Task 2: F-028 (DEC-39)

- **The three older routes.** `following`, `friends-activity` and `friends-organizing` now use `createRequestContext()` and `requireUser(ctx)`. `events/[id]/friends` changed only its anonymous branch. None of the four gained a ban or onboarding guard (DEC-34).
- **The DEFECT suite.** The four anonymous rows in `anonymous-personalized-defect.test.ts` moved to 401 and now also assert that the degraded body is gone. The four signed-in rows were not edited. The Status line reads `FIXED in 05-06`.
- **The friends suite.** `friends-defect.test.ts` pinned the anonymous 200 at line 308. That assertion moved to 401 in the same commit and has its own ledger row.
- **Protocol runs.** Unedited: red, 5 failures. Moved: green. Pre-fix restored: red, 5 failures. Then `cmp`-identical restore (Task 2 §1–§3).

## Task Commits

1. **Task 1: events-family write arms fail closed.** `aa50ff6` (fix, INTENTIONAL BEHAVIOUR CHANGE)
2. **Task 2: four personalized routes answer anonymous callers 401.** `7ff08c1` (fix, INTENTIONAL BEHAVIOUR CHANGE)

**Plan metadata:** the final docs commit. It covers the SUMMARY, STATE, ROADMAP and REQUIREMENTS, and backfills `7ff08c1` into the ledger.

## Floor after this plan

| Gate | Before (05-05) | After |
|---|---|---|
| `npx jest --ci` | 1012 passed, 62 suites | 1012 passed, 0 failed, 63 suites (2 moved out of Phase 4 suites and 2 added in the new DEFECT file) |
| `node scripts/check-characterization-tags.mjs --all` | ok 26 | ok 27 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings (none in a touched file) |
| `node scripts/check-elevated-ratchet.mjs` | committed=25 live=24 | committed=25 live=24 |
| CI-env `npm run build` | exit 0 | exit 0 |
| `git diff 9c33617 -- 'src/__tests__/api/events/*-characterization.test.ts' …/write-handlers-characterization.test.ts` | n/a | 31 deletions, 0 additions, all inside the two moved blocks |

## Decisions Made

- **The `recommendations/feedback` anonymous branch comes first.** The plan requires it for any arm whose anonymous bytes are not the plain 401. A side effect is that the handler's `authUser?.id ?? body.user_id` fallbacks can no longer run without a session. That closes, on the handler ring, the impersonation path 05-03 flagged as a candidate DI.
  - The client (`useTracking.ts`) sends `user_id: ""`, so no legitimate caller relied on the fallback.
  - An anonymous request with a malformed body now gets the 401 instead of a 400 or 500. Its only client caller is fire-and-forget and ignores the response.
- **The dead fallback code stays.** The plan says to keep every read and write otherwise unchanged. A comment marks the fallback as unreachable. Removing it, and registering or closing the DI, is left to 05-07 or 05-08.
- **The guard prologue now runs before `await params`** where a handler awaited params first. Nothing observable changes.

## Deviations from Plan

### Rule-resolved choices

**1. The two PRESERVE docblocks still describe the moved cases.** The save and rsvp suites' "Tests cover" bullets still say "The ban asymmetry, pinned for Phase 5". The plan limits the PRESERVE edit to deleting the two describe blocks and nothing else, so the stale bullets were left in place. A future docs pass can remove them with a ledger note.

**2. The `ban-asymmetry-defect.test.ts` rsvp fixture uses a four-row crowd, not the Phase 4 file's twelve rows.** The crowd exists only to show that other users' rows are untouched. The new file asserts that directly, which the moved block did not.

**3. Empty-body literals remain in the four F-028 routes.** The acceptance note says the fixed DEFECT rows check that the anonymous response is gone, and they do (`not.toEqual(degradedBody)`). The same literals still appear in the signed-in no-data paths and the catch paths, which are unchanged.
- The evidence lists every remaining occurrence (Task 2 §4).
- A signed-in user who follows nothing still gets `{"events":[]}`, and that is correct.

**4. `user/engagement` POST no longer logs `Unauthenticated request …` on an auth error.** The context does not surface the auth error object. No response byte changes, and no test pinned the log.

### Auto-fixed Issues

**1. [Rule 1 - Lint] An unused `user` binding in `events/upload-image`**
- **Found during:** Task 1
- **Issue:** the handler used `user` only for its null check, so the mechanical `const user = active.user;` would have been an unused variable.
- **Fix:** omitted the binding.
- **Commit:** `aa50ff6`

**2. [Rule 3 - Blocking] The `date-validation.test.ts` fixture override lives in `beforeEach`**
- **Found during:** Task 1, legacy suites
- **Issue:** the first fixture edit changed the module-level `from` mock. `beforeEach` replaces that mock on every test, so 22 tests stayed red.
- **Fix:** reverted that edit and put the `users` columns in the `beforeEach` implementation instead. No assertion changed.
- **Commit:** `aa50ff6`

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. The threat register's mitigations were applied:
- **T-05-06-01:** the 14 arms are in `GUARDED` and their fixed shapes pass.
- **T-05-06-02:** the Phase 4 PRESERVE suites and 05-03 P0–P5 pass unedited. P3 and P5 show that onboarding exemptions and anonymous-tolerant arms outside this plan still admit.
- **T-05-06-03:** the PRESERVE diff has 0 additions.
- **T-05-06-04:** the four routes answer 401.

## Observations for later plans

- **05-07 legacy-ban callers.** `checkBanStatus()` still has three callers outside this plan's files: `clubs` POST, `clubs/[id]/appeal` POST and `users/[id]/follow` POST. 05-07 deletes the helper once those move. The docblock in `src/server/context.ts` also still names the helper as the handler-ring ban check, and that text should be updated when the helper goes.
- **05-08 Playwright.** Direct API writes by the un-onboarded seed persona (`scripts/seed/personas.ts:193`) on events-family arms now get 403 `Onboarding required`. `ban-and-onboarding-ring.spec.ts` should expect it.
- **Candidate DI (feedback impersonation).** The handler-ring path is closed by the anonymous-first branch. The unreachable `body.user_id` fallbacks remain in the source, and the RLS question (can the anon role write a foreign `user_id`) is still unprobed.

## Issues Encountered

None beyond the deviations above.

## Self-Check: PASSED

- FOUND: src/__tests__/api/events/ban-asymmetry-defect.test.ts, evidence/handler-adoption-events.txt, evidence/slice-3-fixture-completions.md, 05-06-SUMMARY.md
- FOUND commits: aa50ff6, 7ff08c1
- `grep -c "requireOnboarded(ctx)"` is 2 in save, rsvp and `events/[id]`, and 1 in each of the other eight files
- Jest 1012/1012, tsc exit 0, tag gate ok 27, CI-env build exit 0
