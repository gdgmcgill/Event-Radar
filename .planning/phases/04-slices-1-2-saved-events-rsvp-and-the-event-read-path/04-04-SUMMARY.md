---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 04
subsystem: testing
tags: [characterization, jest, playwright, postgrest, supabase-fake, event-read-path, mutation-testing]

# Dependency graph
requires:
  - phase: 04-01
    provides: "F-080..F-083 in the register, the PRESERVE/DEFECT tag gate, DEC-25/26/27/32"
  - phase: 04-02
    provides: "the in-memory fake src/__tests__/helpers/fakeSupabase.ts, the header-tag discipline, the mutation-cycle and evidence format"
provides:
  - "Two PRESERVE suites (list 33 tests, detail 16 tests) that no planned Slice 2 commit may move, each with a DELIBERATELY NOT PINNED block naming the commit allowed to change each excluded item"
  - "Four DEFECT suites: F-082 (search interpolation + F-059 echo), F-083 (cursor contract), F-080 (four separately-moving pins A-D), F-081 (tag coercion via @/lib/tagMapping)"
  - "e2e/specs/event-read-path.spec.ts: 4 PRESERVE + 5 DEFECT tests against the real local PostgREST; Playwright 37 = 28 + 9"
  - "15 mutation cycles including 3 controls showing that a DEFECT-moving change leaves the PRESERVE suites green; four subjects proven unmodified and older than their suites"
  - "The fake's overlaps() is now evaluated as Postgres && (additive)"
  - "DI-36: the detail GET never returns pending_edits to anyone; its visibility gate is dead"
affects: [04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PRESERVE bodies matched with toMatchObject on the five current keys, so DEC-25's added cursor keys cannot move them; the exact key set is pinned only in the F-083 DEFECT suite"
    - "Control mutation cycles: apply the planned fix's shape to the subject, and require the DEFECT suite red AND the PRESERVE suite green"
    - "A delegating jest.fn wrapper on transformEventFromDB (default = real function) to observe a handler branch that the real transform makes unreachable"
    - "API-level Playwright tests via the request fixture, so the real PostgREST grammar is exercised"

key-files:
  created:
    - src/__tests__/api/events/events-list-characterization.test.ts
    - src/__tests__/api/events/search-escaping-defect.test.ts
    - src/__tests__/api/events/pagination-contract-defect.test.ts
    - src/__tests__/api/events/events-detail-characterization.test.ts
    - src/__tests__/api/events/club-fabrication-defect.test.ts
    - src/__tests__/lib/tag-coercion-defect.test.ts
    - e2e/specs/event-read-path.spec.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-2-characterization.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-2-mutation-check.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-2-unmodified.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.slice-2-before.txt
  modified:
    - src/__tests__/helpers/fakeSupabase.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md

key-decisions:
  - "The detail PRESERVE suite does not pin 'creator/admin receive pending_edits' through the real transform. Measured: nobody does (DI-36). It pins non-owner stripping with the real transform (layer a), and the handler's gate through a delegating transform wrapper that carries the column (layer b)"
  - "F-081's e2e test pins the feed's category ROWS, not a card badge: on / every card is a DiscoveryCard, which renders no tag labels. 'Seed Approved Event' sits under a Social row, and no Tech row exists"
  - "Page mode is pinned by returned rows (the 11th to 20th in start_date order), not by the range() call, so 04-09 can fetch limit+1 without moving a PRESERVE assertion"
  - "The fake's overlaps() is evaluated rather than recorded, so the tag filter is pinned behaviourally. No 04-02 suite called it"
  - "REFAC-10 is NOT marked complete: this plan delivers only its 'characterization before' clause (the 04-01/04-02 precedent)"
  - "DI-32 needed no work: it was closed before Phase 4 (855da7f + b9f9bcb, CI run 35055404669 green). The 04-03 handoff line calling it 04-04's was stale"

patterns-established:
  - "Each DEFECT pin names the plan that moves it in its describe title (moves in 04-10 / moves only if the 04-11 decision ships ...)"
  - "A PRESERVE header lists every excluded item next to the F-nnn and plan allowed to change it"

requirements-completed: []  # REFAC-10 listed; only its before-state clause is delivered (see Deviations 5)

# Metrics
duration: 15min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 04: Slice 2 Characterization Net Summary

**The event read path now has a before-picture: two PRESERVE suites (list and detail) that were checked against the planned Slice 2 fixes, four DEFECT suites pinning F-080..F-083 under the plan that moves each pin, and a 9-test Playwright spec that confirms against the real local PostgREST that a comma in search is a 500 echoing the logic tree, `%` matches everything, no `nextCursor` is ever sent, the detail page is "Hosted by" the organizer label, and the feed files an academic+tech event under Social. 78 new Jest tests, 15 mutation cycles with 3 controls, and Playwright at 37 = 28 + 9.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-09-23T05:24:41Z
- **Completed:** 2026-09-23T05:39:55Z
- **Tasks:** 3 of 3
- **Files:** 11 created, 2 modified

## Accomplishments

- **PRESERVE was tested against the planned fixes, not just claimed.** Three control cycles applied the shape of a planned fix to the route: 04-08's quoted `or()`, 04-09's added `nextCursor`, and a changed tag default. In each case the DEFECT suite went red and the PRESERVE suites stayed green. Bodies are matched on the five current keys with `toMatchObject`, and page mode is pinned by the rows returned rather than by the `range()` call.
- **The list contract is behavioural.** The fake evaluates the filters, so the tests check which fixtures come back rather than which methods were called. That covers approved/non-deleted only; the date floor (one minute either side); `dateFrom` replacing the floor in both directions; trimmed tag overlap (`sports, social` matches the social event only because of trimming); ids with blanks; exact 400 messages with no query issued; the early returns; page 2 of 25; fuzzy rank order beating start_date; the benign PGRST103, PGRST116 and `{` errors; and the Cache-Control header.
- **Four F-080 pins, each moving in one named plan.** Pin A (organizer fallback) and pin D (detail selects `*`, so the response names "Seed Organizer A") move only if the 04-11 decision ships the fix. Pin B (five blanked URL columns) and pin C (saved-events selects `*`) move in 04-10. `contact_email` is deliberately not pinned (DEC-27 keeps it out).
- **Real-parser facts measured on the running app.** `search=a,b` returns 500 with `"failed to parse logic tree ((title.ilike.%a,b%,…))" (line 1, column 20)`. `search=%25` returns total 2. Neither reaches a Jest suite's parser.
- **DI-36 found and measured.** `transformEventFromDB` never copies `pending_edits`, so `/api/events/[id]` returns it to nobody, the creator included. The creator's "Your changes … will be reviewed" notice (`EventDetailView.tsx:207`) cannot render from this route. Evidence: a transform probe, plus mutation cycle 4, where deleting the stripping branch turns only the wrapper-layer tests red. Registered in `evidence/deferred-items.md` with owner Phase 5 (REFAC-13).

## Task Commits

1. **Task 1: list PRESERVE, F-082 and F-083 DEFECT, fake overlaps**: `72baa0c` (test)
2. **Task 2: detail PRESERVE, F-080 and F-081 DEFECT, DI-36**: `5efe9ce` (test)
3. **Task 3: Playwright spec, mutation and ancestry proofs**: `350fda3` (test)

## Files Created/Modified

- `events-list-characterization.test.ts` (PRESERVE, 33 tests): mocks only the server factory and `getESTNowISO`; the real transform runs on stable-tag, no-club fixtures.
- `search-escaping-defect.test.ts` (DEFECT F-082, names F-059/F-078, 5 tests): the exact raw `or()` strings for `a,b`, `%`, `_`; the unquoted comma splitting the tree; the PGRST100 message echoed in a 500, which stays after 04-08.
- `pagination-contract-defect.test.ts` (DEFECT F-083, 7 tests): cursor ignored (rows and window), no `nextCursor`/`prevCursor`, invalid cursor 200, `start_date`-only order, five-key bodies on success and on the early returns.
- `events-detail-characterization.test.ts` (PRESERVE, 16 tests): 404s, 500s, the one-key `{ event }`, and the `pending_edits` gate in two layers.
- `club-fabrication-defect.test.ts` (DEFECT F-080, names F-050, 6 tests): pins A-D as separate describes.
- `src/__tests__/lib/tag-coercion-defect.test.ts` (DEFECT F-081, 11 tests): imports `mapTags` from `@/lib/tagMapping`; covers the six non-identity members, the collapse of two coerced tags, the seeded pairs, and the silent default with every console method spied.
- `e2e/specs/event-read-path.spec.ts`: 9 tests, anonymous, each title prefixed `PRESERVE:` or `DEFECT F-0nn:`.
- `src/__tests__/helpers/fakeSupabase.ts`: `overlaps` evaluated as Postgres `&&`; header updated.
- `evidence/deferred-items.md`: DI-36 appended to Part 4.
- Evidence: `slice-2-characterization.txt` (both tasks' runs, DI-24 throwaway-tsconfig runs, DI-36 probe, plan verification), `slice-2-mutation-check.txt` (15 cycles), `slice-2-unmodified.txt` (4 empty diffs against base and HEAD, 8 ancestry exits of 0), `playwright.slice-2-before.txt` (reset, seed, 37 passed, exit=0).

## Decisions Made

See `key-decisions` in the frontmatter. The two with the most reach are the DI-36 two-layer design, which 04-10/04-11 must leave green when they edit that route's GET, and pinning F-081 on the feed's category rows rather than on a card badge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan premise false] The detail PRESERVE does not assert "creator and admin get pending_edits" through the real transform**
- **Found during:** Task 2.
- **Issue:** The plan's behaviour list says the creator and admins receive `pending_edits`. Measured: the transform drops the column, so nobody does. Pinning either reading as PRESERVE would be wrong: "they do" is false, and "they don't" would preserve a defect.
- **Fix:** Layer (a) pins non-owner stripping with the real transform. Layer (b) pins the handler's gate through a delegating wrapper, which is stable because 04-07, 04-10 and 04-11 all keep `transformEventFromDB` exported from `@/lib/tagMapping`. DI-36 was registered with an owner.
- **Files:** `events-detail-characterization.test.ts`, `evidence/deferred-items.md` (not in `files_modified`; it is the register's designated append point).
- **Commit:** `5efe9ce`.

**2. [Rule 1 - Plan premise false] Test 9 pins the category rows, not a badge on the card**
- **Found during:** Task 3.
- **Issue:** The plan asked for a `Social` label within the feed card. On `/`, every card is a `DiscoveryCard`, which renders no tag labels. Labels reach the page as `CategoryRowsSection` headings (accessible name like "Social 2 events"). The page that does render badges (`/clubs/[id]`) never calls `mapTags`, so it is not this read path.
- **Fix:** The approved event is asserted under the Social and Academic rows, with zero Tech rows. The absence check runs only after the rows have rendered, and the scope is section headings, which the filter chips are not.
- **Commit:** `350fda3`.

**3. [Rule 2 - Mutation strength] 15 cycles instead of 6, including 3 controls**
- **Fix:** Added 1b-1d (trim, rank re-sort, Cache-Control), 4b-4c (deleted_at, admin check), 5b (saved-events embed), and controls 2b/3b/6b. Every red cycle names failing tests; none is a compile error.
- **Commit:** `350fda3`.

**4. [Rule 1 - Accuracy] The PGRST100 fixture now carries the live-measured message**
- **Issue:** The Task 1 fixture ended "(line 1, column 2)", copied from the register's truncated quote. The running app logs "(line 1, column 20)".
- **Fix:** The fixture string was corrected in Task 3. The assertion logic is unchanged, and the suite was re-run green (evidence, Task 3 block).
- **Commit:** `350fda3`.

**5. [Project precedent] REFAC-10 not marked complete**
- This plan delivers only the characterization-before clause. The fixes are 04-07 to 04-11. This follows the 04-01, 04-02 and 04-03 precedent.

### Measured, not a deviation

- **DI-32 required nothing.** The orchestrator's handoff (from the 04-03 summary) said "DI-32 the red e2e job is yours". Phase 4's `evidence/deferred-items.md` records it as CLOSED before Phase 4 (`855da7f` + `b9f9bcb`, CI run `35055404669` green on all three jobs). `e2e/env.ts` no longer consults `NEXT_PUBLIC_*`, and `b9f9bcb` is an ancestor of HEAD. No workflow change was made or needed, and nothing was pushed.
- The plan's base-relative diff check was run against `b632f62` (HEAD at the start of this plan), because `794556a` precedes 04-03's intended `src/server/context.ts` change.

---

**Total deviations:** 5 (2 false plan premises corrected by measurement, 1 strengthening, 1 accuracy fix, 1 precedent-driven state choice).
**Impact on plan:** No scope creep. No file under `src/app`, `src/lib`, `src/server` or `supabase/` was modified. `get-events.test.ts` and `src/app/api/events/route.test.ts` are untouched. No seed change. No package installed.

## TDD Gate Compliance

Tasks 1 and 2 are marked `tdd="true"`, but they are characterization tasks against unmodified code, so there is no RED-before-implementation step. Their RED gate is the Task 3 mutation record: every suite was seen failing under a mutation of what it pins, and green after the byte-identical restore. All three commits are `test(...)`. There is no `feat(...)` commit, by design.

## Issues Encountered

- The first run of test 9 matched headings by exact name, but each row heading's accessible name includes its count. It was fixed with an anchored regex before the evidence run.

## Known Stubs

None.

## Threat Flags

None. The spec only reads public, anonymous endpoints, and no new surface was introduced.

## Next Phase Readiness

- **04-05 (Slice 1, same wave):** the fake's `overlaps` is now evaluated. No Slice 1 handler calls it, and all 04-02 suites re-ran green (125/125 across characterization and defect suites).
- **04-06 (DI-24 un-exclusion):** all six new suites type-check under the throwaway-tsconfig recipe (evidence, both task blocks).
- **04-07:** `tag-coercion-defect.test.ts` must pass unmodified. Its "no signal" assertion is on `mapTags`, so put the DEC-26 warning in `transformEventFromDB`, not in `mapTags`.
- **04-08:** moves the 4 raw-string assertions in `search-escaping-defect`. The F-059 echo assertion stays. e2e tests 6 and 7 move. Control 2b shows the list PRESERVE stays green.
- **04-09:** moves every assertion in `pagination-contract-defect` and e2e test 5. Control 3b shows the list PRESERVE stays green.
- **04-10:** moves F-080 pins B and C only. It must leave the detail suite (both layers) green and must not fix DI-36 in passing.
- **04-11:** pins A and D and e2e test 8 move only on option-ship-club/both; the F-081 six-member assertions and e2e test 9 move only if the identity mappings ship.
- **Floors after this plan:** jest 511 passed / 5 skipped / 516 (46 passed, 1 skipped of 47 suites); Playwright 37; lint 0 errors / 19 warnings; tsc clean; tag gate `ok 17 files`; ratchet `committed=25 live=25 delta=0`.
- **Local stack:** reset and re-seeded after the Playwright run (10 personas, 2 RSVPs, 0 saved events). Port 3000 is free.

## Self-Check: PASSED

- All 13 plan and key files were found on disk. None of the min_lines floors is missed: list 473, search 160, pagination 181, club 234, tag 112, spec 180.
- Commits `72baa0c`, `5efe9ce` and `350fda3` are in `git log`.
- `playwright.slice-2-before.txt` ends with `37 passed` / `exit=0`. The title grep returns 9. `git diff --name-only b632f62 -- src/app src/lib src/server` is empty.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Completed: 2026-09-23*
