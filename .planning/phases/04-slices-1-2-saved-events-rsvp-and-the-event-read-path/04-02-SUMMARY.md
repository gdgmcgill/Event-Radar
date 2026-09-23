---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 02
subsystem: testing
tags: [characterization, jest, playwright, supabase-fake, rsvp, saved-events, mutation-testing]

# Dependency graph
requires:
  - phase: 04-01
    provides: "the before-floor on base 794556a, F-079..F-085 in the register, the PRESERVE/DEFECT tag gate, DEC-23..DEC-32"
provides:
  - "src/__tests__/helpers/fakeSupabase.ts: createFakeSupabase(init) -> { client, calls, tables }, an in-memory PostgREST-shaped fake that evaluates filters and answers row and count/head reads from the same rows"
  - "four PRESERVE suites (save, saved-events, calendar, rsvp) and two DEFECT suites (F-079, F-085) against the unmodified Slice 1 handlers, 75 tests"
  - "an RSVP count contract that does not depend on how the counts are computed: the 04-05 head-count shape leaves it green, as the control cycle shows"
  - "Playwright 28: the saved state proven through GET /api/users/saved-events, the going count read after a reload (2), and a cancelled RSVP not counted (0)"
  - "a 16-cycle mutation record and a git-ancestry proof that every subject predates its suite"
affects: [04-03, 04-05, 04-06, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "characterization suites mock only @/lib/supabase/server with a mock-prefixed module variable holding a fresh in-memory fake; @/lib/ban runs for real against the same fake"
    - "PRESERVE count assertions are made on the response body only; DEFECT assertions are made on the fake's call log"
    - "mutation cycles driven by a scratchpad script: first-occurrence textual mutation, suite red, git checkout --, git diff --quiet, suite green"
    - "the system clock is pinned with modern fake timers that fake Date only (every scheduling API in doNotFake)"

key-files:
  created:
    - src/__tests__/helpers/fakeSupabase.ts
    - src/__tests__/api/events/save-characterization.test.ts
    - src/__tests__/api/events/saved-events-characterization.test.ts
    - src/__tests__/api/events/saved-events-time-floor-defect.test.ts
    - src/__tests__/api/events/calendar-events-characterization.test.ts
    - src/__tests__/api/events/rsvp-characterization.test.ts
    - src/__tests__/api/events/rsvp-count-defect.test.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-characterization.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-mutation-check.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-unmodified.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.slice-1-before.txt
  modified:
    - e2e/specs/save-and-rsvp.spec.ts

key-decisions:
  - "The fake takes per-operation error keys (`saved_events.insert`) as well as per-table ones, because save POST reads and writes the same table and each needs its own 500 path"
  - "The fake projects columns and answers embeds from the row's own key (null when absent), so select('id, status, created_at') bodies are what PostgREST would return and the calendar embed returns null the way a null FK does"
  - "PRESERVE fixtures sit months or years away from the pinned clock, so F-085's 4-5 hour floor shift cannot move a PRESERVE assertion"
  - "The calendar club test asserts only the ten embedded columns via objectContaining; the six hard-coded nulls (F-080) are never asserted"
  - "Update assertions read updated_at back from the fake's row after the write, so they pin the handler's passthrough and not the fake's lack of a trigger"
  - "REFAC-09 is NOT marked complete: this plan delivers its 'characterization tests pass before' clause only; seam adoption and the count query are 04-05 (the 04-01 precedent)"

patterns-established:
  - "createFakeSupabase is the Slice 1 test seam. 04-05 must pass the four PRESERVE suites unedited and move only the two DEFECT suites"
  - "Each PRESERVE header names the mutation cycles that turned it red, not a blanket 'every behaviour' claim"

requirements-completed: []  # plan lists REFAC-09; only its before-state clause is delivered here (see Deviations 5)

# Metrics
duration: 14min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 02: Slice 1 Characterization Net Summary

**An in-memory Supabase fake that evaluates filters and answers row and head-count reads from the same rows. Four PRESERVE suites and two DEFECT suites (F-079, F-085) against the unmodified save, saved-events, calendar and RSVP handlers: 75 tests. Every suite was seen going red under a mutation (16 cycles). Playwright 28 = floor 27 + 1, now checking saved state through the API and RSVP counts after a reload.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-09-23T04:53:45Z
- **Completed:** 2026-09-23T05:07:02Z
- **Tasks:** 3 of 3
- **Files:** 11 created, 1 modified

## Accomplishments

- **The fake models the database; it doesn't script the answers.** `eq/neq/is/in/gte/lte/lt/gt` are evaluated with SQL's NULL rule. `order` keys are cumulative, `range`/`limit` are applied after sorting, and `count`/`head` follow PostgREST semantics. `single`/`maybeSingle` return PGRST116, and writes mutate the table. Every query is logged. The file uses no jest global and imports no SDK type, and it type-checks inside the main `tsc` program.
- **The RSVP count test passes whichever way the counts are computed, and the record shows it.** Control cycle 5b/5c applied the exact 04-05 shape (two `{ count: "exact", head: true }` reads) to the route. `rsvp-count-defect` went red and `rsvp-characterization` stayed green (20/20). So 04-05 can fix F-079 without editing the PRESERVE suite.
- **The ban asymmetry is pinned.** A permanently banned caller gets 403 on save POST and RSVP POST, before any event or RSVP read. The same caller's save DELETE returns 200 `{ saved: false }` and their RSVP DELETE returns 200 "RSVP cancelled". Phase 5 (REFAC-11) now has a measured starting point.
- **T-04-02-04 is re-asserted with state checks.** A body `user_id` that doesn't match the session gets 403 on POST and DELETE, and the fake's table shows nothing written or cancelled.
- **The persona harness covers research Pitfalls 1 and 2.** The save test reloads, waits for GET `/api/users/saved-events`, checks that `savedEventIds` contains the event, and then checks the Unsave control. The RSVP test reads going = 2 after its reload. A new test reads going = 0 on the event whose only RSVP is cancelled.

## Task Commits

1. **Task 1: in-memory fake; pin save, saved-events, calendar and F-085**: `f16a7ad` (test)
2. **Task 2: implementation-blind RSVP PRESERVE; F-079 DEFECT**: `1338aee` (test)
3. **Task 3: persona harness additions, mutation and ancestry proofs**: `5ea616f` (test)

## Files Created/Modified

- `src/__tests__/helpers/fakeSupabase.ts`: `createFakeSupabase(init)` returns `{ client, calls, tables }`. `init` takes user, authError, tables, errors (`table` or `table.operation`), throwOn, rpc and now.
- `save-characterization.test.ts` (PRESERVE, 21 tests): the DELETE and POST branches, the toggle's table state, the ban-first ordering, expired versus running suspensions, and the asymmetry.
- `saved-events-characterization.test.ts` (PRESERVE, 14 tests): 401s, empty, the three sorts plus the fallback for an unknown sort, `include_past`, approved and non-deleted events only, the caller's own `saved_at`, and three 500s.
- `saved-events-time-floor-defect.test.ts` (DEFECT F-085, 4 tests): the floor is `2026-09-23T18:30:00.000Z` at 14:30 EDT, not `…14:30…`. There is an EST variant, a behavioural drop of an event 90 minutes away, and a test that `include_past` sends no floor.
- `calendar-events-characterization.test.ts` (PRESERVE, 12 tests): the union and annotation, cancelled and other-user rows excluded, from/to bounds, the ten embedded club columns, the 500 status only (F-059), and the thrown-error 500 body.
- `rsvp-characterization.test.ts` (PRESERVE, 20 tests): counts, `user_rsvp`, GET errors, POST create/update/already/re-activate after cancel, refusals, DELETE soft-cancel/404/403, and the asymmetry.
- `rsvp-count-defect.test.ts` (DEFECT F-079, 4 tests): one unscoped rsvps read with columns `id, status`, `options === null`, and filters exactly `[eq event_id, neq status cancelled]`.
- `e2e/specs/save-and-rsvp.spec.ts`: a header paragraph, two assertions, one test, and a `goingCount(page)` locator anchored so that "N friends going" can't match.
- `evidence/slice-1-characterization.txt`: the Task 1 and Task 2 runs, both DI-24 throwaway-tsconfig runs (with `--listFilesOnly` proving the files were in the program), and the plan verification.
- `evidence/slice-1-mutation-check.txt`: 16 cycles, 0 failed.
- `evidence/slice-1-unmodified.txt`: four empty diffs against the base and 8 `merge-base --is-ancestor` checks at exit 0 (against HEAD and against each suite's commit).
- `evidence/playwright.slice-1-before.txt`: reset, seed, 28 passed, exit=0.

## Decisions Made

See `key-decisions` in the frontmatter. The one with the most reach is the per-operation error key, which later suites that use the fake will depend on. `errors["saved_events.insert"]` wins over `errors["saved_events"]`, and neither one mutates the table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Evidence accuracy] The PRESERVE headers' mutation claim was narrowed to the cycles actually run**
- **Found during:** Task 3.
- **Issue:** The first drafts said "each behaviour group has been observed turning this suite red". The cycles cover three mutations per PRESERVE suite, not every group.
- **Fix:** Each header now names its cycles, for example "cycles 1, 1b and 1c: the saved-true literal, the ban check's early return, and the DELETE's user_id scope". The rewording is header-only. The tests are byte-identical to the versions the cycles ran against.
- **Commit:** `5ea616f`.

**2. [Rule 2 - Gate strictness] Tag words in prose made two suites read as PRESERVE+DEFECT**
- **Found during:** Tasks 1 and 3.
- **Issue:** The gate matches `PRESERVE` and `DEFECT` case-sensitively anywhere in the leading docblock. The F-085 header said "the same seam as the PRESERVE suite", and the reworded RSVP header said "turns the DEFECT suite red". The gate still passed, but it tagged those files as both.
- **Fix:** Both now name the file (`saved-events-characterization.test.ts`, `rsvp-count-defect.test.ts`). `--all` reports exactly one tag per new suite. **For 04-05/04-06:** when you edit these headers, don't write the other tag word in capitals.
- **Commits:** `f16a7ad`, `5ea616f`.

**3. [Rule 1 - Acceptance grep] The fake's header tripped its own no-jest grep**
- **Found during:** Task 1.
- **Issue:** The header's prose mentioned `jest.fn()`, and `grep -lE "\bjest\."` printed the file.
- **Fix:** Reworded it to "mock-function stubs". The grep now exits 1 with no output. This is recorded in the evidence.
- **Commit:** `f16a7ad`.

**4. [Rule 2 - Mutation strength] 10 cycles beyond the plan's six named mutations, including a control**
- **Found during:** Task 3.
- **Fix:** Cycles b and c were added to each PRESERVE suite: the ban early return, the DELETE user_id scope, the approved filter, the `include_past` switch, the RSVP status filter, the `to` bound, the `user_rsvp` cancelled filter and the soft-cancel write. The 5b/5c control applies the 04-05 head-count rewrite. One cycle (4b) first aborted because its pattern had the wrong indentation, and the driver refused to apply it. The pattern was fixed and all 16 cycles were re-run into one clean record.
- **Commit:** `5ea616f`.

**5. [Project precedent over the executor default] REFAC-09 not marked complete**
- **Issue:** The plan's frontmatter lists REFAC-09, but this plan delivers only its "characterization tests pass before" clause. Seam adoption and the count query belong to 04-05.
- **Fix:** `requirements-completed: []`, and `requirements.mark-complete` was not run. This follows the 04-01 and 01-01 precedent.

### Measured, not a deviation

- `git diff --name-only 794556a -- … scripts` lists `scripts/check-characterization-tags.mjs`. That is 04-01's tag gate, committed after the base was measured (`27472b6`). The plan's verification line assumed nothing under `scripts/` would differ. The narrower check over `src/app src/lib src/server supabase` is empty. Both are recorded in `slice-1-unmodified.txt`.
- Playwright's server log shows `Fuzzy search RPC error … SET is not allowed in a non-volatile function`. This is pre-existing: it also appears in `floor.before.txt` and is already in `findings.json`.

---

**Total deviations:** 5 (3 accuracy/gate fixes, 1 strengthening, 1 precedent-driven state choice).
**Impact on plan:** No scope creep. No file under `src/app`, `src/lib`, `src/server`, `supabase/` or `scripts/` was modified, and every mutation was reverted with an exit-0 `git diff --quiet`. `rsvp.test.ts` was not touched.

## TDD Gate Compliance

Tasks 1 and 2 are marked `tdd="true"`, but they are characterization tasks: the tests are written against existing, unmodified code, so there is no RED-before-implementation step to take. In their place, the RED gate for this plan is the Task 3 mutation record. Every suite was observed failing when the behaviour it pins was removed, and passing again after the restore. All three commits are `test(...)`. No `feat(...)` commit exists, by design, because this plan must not change production code.

## Issues Encountered

- zsh's `echo` turned `\b` into a backspace in the first Task 1 evidence capture. It was re-captured with `printf`, and a control-character count of 0 was checked.
- The reset block in the Playwright evidence pipes through a key/secret/token filter, so the `exit=` shown there is the filter's. The file notes this. The reset's own success is its "Finished supabase db reset" line.

## Known Stubs

None.

## Next Phase Readiness

- **04-03 (same wave):** the tag gate `--all` now finds 11 suites (it was 5) and passes. When 04-03 wires the gate into CI, it covers these six suites.
- **04-05 must:** pass `save-`, `saved-events-`, `calendar-events-` and `rsvp-characterization` unedited; move `rsvp-count-defect` to "two head-count reads" in the F-079 commit; and leave `saved-events-time-floor-defect` alone (F-085 is Phase 6). Its before-run command is in its own plan. Expect 75/75 on the Slice 1 pattern.
- **Fake behaviours 04-05 may meet:** `createRequestContext()`'s `users … .single()` is answered from `tables.users`. Every authenticated fixture includes a profile row with `roles`, `onboarding_completed`, `banned_at` and `ban_expires_at`. A missing row returns PGRST116, which leaves the profile null.
- **Floors after this plan:** jest 433 passed / 5 skipped / 438 (40 passed, 1 skipped, 41 suites); Playwright 28; lint 0 errors / 19 warnings; tsc clean.
- **Local stack:** reset and freshly seeded after the Playwright run (10 personas, 2 RSVPs, 0 saved events). Port 3000 is free.

## Self-Check: PASSED

- All 12 plan files were found on disk.
- Commits `f16a7ad`, `1338aee` and `5ea616f` are in `git log`.
- `playwright.slice-1-before.txt` ends `28 passed` / `exit=0`. `grep -c users/saved-events` returns 4 and `grep -c secondApprovedEvent` returns 2 on the spec.
- `git diff --stat 794556a -- src/app src/lib src/server` is empty. `check-characterization-tags.mjs --all` reports `ok 11 files`.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Completed: 2026-09-23*
