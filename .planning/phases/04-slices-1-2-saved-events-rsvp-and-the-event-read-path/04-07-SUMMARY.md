---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 07
subsystem: event-read-path
tags: [refac-10, f-081, f-050, dec-26, tag-mapping, eventTags, golden-table, completeness-test, mutation-check]

# Dependency graph
requires:
  - phase: 04-06
    provides: "test files type-checked by tsc; the last stale-date census line (src/lib/tagMapping.ts:98) assigned to 04-07"
  - phase: 04-04
    provides: "tag-coercion-defect.test.ts (F-081 DEFECT suite) that must pass unmodified; the note to put the DEC-26 warning in transformEventFromDB, not mapTags"
  - phase: 04-01
    provides: "DEC-26 in evidence/phase-04-decisions.md; evidence/deferred-items.md (next item DI-37)"
provides:
  - "src/lib/eventTags.ts: the single definition of the DB-tag to EventTag mapping (TAG_ALIASES, partitionTags, mapTags, KNOWN_NON_ROUNDTRIP_TAGS)"
  - "src/lib/tagMapping.ts holds no alias table; it re-exports mapTags and transformEventFromDB calls partitionTags"
  - "One [tags] console.warn per transformed event with unmapped tags, payload { eventId, unmapped }; rendered output unchanged"
  - "Completeness test over Object.values(EventTag), proved to bite by a mutation cycle"
  - "F-050's last source hit gone: stale-date census 1 -> 0 lines"
  - "DI-37 registered (prototype-key tags), owner 04-11"
affects: [04-08, 04-09, 04-10, 04-11, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden table written with literal expected values and run green against the pre-move function before the move, then re-pointed at the new module and re-run"
    - "partition-then-project: partitionTags returns { mapped, unmapped }; the silent mapper is its .mapped projection and the caller that knows the entity id does the logging"
    - "Known-defect allow-list plus a two-sided completeness predicate (unlisted non-round-tripper fails; listed round-tripper fails)"

key-files:
  created:
    - src/lib/eventTags.ts
    - src/lib/eventTags.test.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/tag-centralization.txt
  modified:
    - src/lib/tagMapping.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md

key-decisions:
  - "The DEC-26 warning lives in transformEventFromDB, not mapTags, so tag-coercion-defect.test.ts's 'no console output from mapTags' assertion passes unmodified"
  - "The eventTags.ts JSDoc names four TAG_HIERARCHY disagreements (hackathon, workshop, fitness, competition), not the plan's three, per 04-04's note on competition"
  - "The old tagMapping const export was dropped, not re-exported: no importer in src/, scripts/ or e2e/"
  - "REFAC-10 is not marked complete: its remaining fixes are 04-08 to 04-11"

patterns-established:
  - "Unknown-input surfacing without visual change: keep the default, report what hit it, log at the layer that knows the entity id"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 07: Tag mapping centralized in eventTags.ts with unmapped tags surfaced by a [tags] warning Summary

**The DB-tag to `EventTag` mapping now has one home, `src/lib/eventTags.ts`. A golden table written against the old function proves no mapped output changed. Unknown tags still render as Social, but `transformEventFromDB` now logs them with the event id, and a completeness test fails if an `EventTag` member is added without a mapping.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-09-23T06:07:28Z
- **Completed:** 2026-09-23T06:12Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **One mapping module.** `TAG_ALIASES` has the same 22 entries in the same order. It lives in `src/lib/eventTags.ts` with `mapTags`. `src/lib/tagMapping.ts` has no alias table left (`grep -c "Record<string, EventTag>"` gives 0). It imports from `@/lib/eventTags` once and re-exports `mapTags`, so all eight routes and every suite that imports or mocks `@/lib/tagMapping` work unchanged.
- **No output change, proved first.** The golden table covers the 22 alias keys, the 12 enum members, `quidditch`, `" Music "`, de-duplication, `null` and `[]`. It passed 40/40 against the pre-move function while `src/lib/eventTags.ts` did not exist yet. After the move it passed again, directly and through the `@/lib/tagMapping` re-export. `tag-coercion-defect.test.ts` shows no diff since `caf122c` and passes.
- **Unknown tags surfaced (DEC-26, non-visual half).** `partitionTags` returns `{ mapped, unmapped }`. `mapped` is exactly today's output, and `mapTags` is now `partitionTags(...).mapped`, so it stays silent. `transformEventFromDB` emits one `console.warn("[tags] Unmapped tags rendered as Social", { eventId, unmapped })` for each event that has an unmapped tag. The JSDoc says that volume is accepted until Phase 6.
- **Completeness guarded.** `KNOWN_NON_ROUNDTRIP_TAGS` lists the six F-081 members in one place. The test checks both directions: an unlisted non-round-tripper fails, and so does a listed member that has started to round-trip. It also shows a synthetic thirteenth member being caught. In the mutation cycle, removing `NETWORKING` from the list turned 3 tests red, and restoring it turned them green again.
- **F-050 closed at source.** The stale comment at `tagMapping.ts:98` now names only `start_date`/`end_date`. The stale-date census went from 1 line to 0.

## Task Commits

1. **Task 1: Move the mapping into src/lib/eventTags.ts, golden table first**: `2db5d2a` (refactor)
2. **Task 2: Surface unmapped tags non-visually; completeness test (DEC-26)**: `46731e6` (feat)

## Files Created/Modified

- `src/lib/eventTags.ts`: exports `TAG_ALIASES`, `partitionTags`, `PartitionedTags`, `mapTags` and `KNOWN_NON_ROUNDTRIP_TAGS`. The file JSDoc cites REFAC-10 and F-081 and names the `TAG_HIERARCHY` disagreement.
- `src/lib/eventTags.test.ts`: the golden table, the re-export identity check, partition behaviour, completeness with a synthetic-member check, and the warning tests (which spy on `console.warn` and restore it). 123 tests.
- `src/lib/tagMapping.ts`: the alias table and the `mapTags` body are removed. It imports and re-exports `mapTags`, `transformEventFromDB` calls `partitionTags` and warns, and the stale comment is reworded.
- `evidence/tag-centralization.txt`: the before-run, the after-move run, the Task 2 RED and GREEN runs, the mutation cycle, and full verification.
- `evidence/deferred-items.md`: DI-37 appended.

## Decisions Made

- The warning goes in the transform, not in `mapTags`, because the transform knows the event id and `tag-coercion-defect` asserts that `mapTags` is silent.
- The JSDoc names four `TAG_HIERARCHY` disagreements: hackathon, workshop, fitness and competition.
- The unused `tagMapping` const export is dropped. It had no importers.
- REFAC-10 is not marked complete in REQUIREMENTS.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Accuracy] The eventTags.ts JSDoc names four TAG_HIERARCHY disagreements, not three**
- **Found during:** Task 1
- **Issue:** The plan's JSDoc brief lists hackathon/workshop → tech and fitness → sports. `src/lib/constants.ts:344` also has `competition: EventTag.CAREER`, where `TAG_ALIASES` maps it to sports (04-04's F-081 note).
- **Fix:** Named all four. `constants.ts` is not modified.
- **Commit:** `2db5d2a`

**2. [Process] The mutation was restored from a sha1-verified copy, not with `git checkout --`**
- **Found during:** Task 2
- **Issue:** The mutation cycle runs before the Task 2 commit. At that point `git checkout -- src/lib/eventTags.ts` would restore the Task 1 version and lose `partitionTags`.
- **Fix:** Saved a copy before mutating and restored from it. The restored sha1 `fc5565c…` matches the pre-mutation sha1, recorded in the evidence.
- **Commit:** `46731e6`

**3. [Process] RED was recorded in the evidence, not as a separate `test(...)` commit**
- **Issue:** The plan's constraint 7 says "two commits": the move, then the surfacing. The TDD protocol's RED commit would make three.
- **Fix:** The RED run (47 failed / 76 passed, exit 1, taken before `partitionTags` existed) is recorded in `tag-centralization.txt` § 3. The plan's two-commit shape is kept.

**4. [Rule 2 - Correctness, deferred] Tags named after prototype keys are registered as DI-37, not fixed**
- **Found during:** Task 2
- **Issue:** `TAG_ALIASES[lowerTag]` on an object literal resolves `constructor` and `__proto__` to truthy prototype members. Measured: `mapTags(["constructor"])` returns a function, which serializes as `null`. The pre-move code behaves the same.
- **Fix:** Not fixed, because fixing it changes mapped output, which this plan forbids. Registered as DI-37 with owner 04-11, beside the F-081 identity mappings.

---

**Total deviations:** 4 (1 accuracy, 2 process, 1 deferred correctness item registered with an owner).
**Impact on plan:** No route file, `src/components`, `constants.ts`, `classifier.ts` or migration changed (`git diff --stat HEAD~2` on those paths is empty). No package was installed. The local stack and production were not touched.

## TDD Gate Compliance

- Task 1: the golden table was written first and passed against the pre-move function. It is a characterization, so green was expected. It was then re-run green after the move. Recorded in evidence §§ 1–2.
- Task 2: RED was recorded in evidence § 3 (47 failing, exit 1) and GREEN in § 4. No separate `test(...)` commit, per the plan's two-commit constraint (deviation 3).

## Issues Encountered

- My first draft of the partition-equivalence `it.each` passed bare arrays as rows, which Jest spreads into separate arguments. I wrapped each input in a one-element tuple before any GREEN run.
- The first JSDoc wording mentioned `[tags]` a second time, which broke the `grep -c "\[tags\]" = 1` acceptance check. I reworded it to "tags-prefixed".

## Next Phase Readiness

- **Floors after this plan:** Jest **635 passed / 5 skipped / 640** (47 passed + 1 skipped of 48 suites; +123 tests and +1 suite from `eventTags.test.ts`). tsc is clean with tests included. Lint is 0 errors / 19 warnings. Tag gate `ok 17 files`: `eventTags.test.ts` is a unit suite that the characterization discovery does not pick up. Stale-date census **0 lines**. Build and ratchet were not re-run, since no route or config changed.
- **For 04-08 / 04-09:** `src/app/api/events/route.ts` was not touched. Its `transformEventFromDB` import from `@/lib/tagMapping` is unchanged, and the `jest.mock("@/lib/tagMapping", …)` in `get-events`, `date-validation` and `route.test.ts` still works. Any suite that runs the real transform over an unmapped tag now gets one `console.warn` per event. Every current suite either silences `console.warn` or uses only mapped tags; the full run printed 0 `[tags]` lines.
- **For 04-11 (F-081 decision):** the fix is one place. Add `tech`, `food`, `volunteer`, `arts`, `music` and `networking` as identity entries in `TAG_ALIASES` and empty `KNOWN_NON_ROUNDTRIP_TAGS`. The completeness test fails until both are done. The golden table's six member rows and the F-081 DEFECT suite's assertions then move, along with the e2e category-row check on `/`. `competition` (sports here, career in `TAG_HIERARCHY`) is a fourth disagreement to decide or document. DI-37 (the prototype keys: use `Object.hasOwn`) belongs there too. F-050's status flip to Fixed is also 04-11's.
- **Phase 6:** replace the `[tags]` `console.warn` with structured logging and sampling (T-04-07-03).

## Self-Check: PASSED

- FOUND: src/lib/eventTags.ts, src/lib/eventTags.test.ts, evidence/tag-centralization.txt
- FOUND: commits 2db5d2a, 46731e6
- Empty diffs since caf122c: tag-coercion-defect, events-list and events-detail characterization, src/app, src/components, constants.ts, classifier.ts, supabase/migrations

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 07*
