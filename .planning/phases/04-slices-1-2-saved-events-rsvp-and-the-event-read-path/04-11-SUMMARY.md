---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 11
subsystem: planning
status: complete
tags: [phase-close, owner-checkpoint, option-defer, F-080, F-081, F-082, F-083, F-066, F-050, REFAC-09, REFAC-10, DEC-32]

# Dependency graph
requires:
  - phase: 04-10
    provides: "F-080 non-visual half (pins B and C) and the pin table for A and D; club-join latency (A4)"
  - phase: 04-09
    provides: "F-083 cursor contract (ea71bb6) and F-066's skipped-suite clause; composite-index follow-up"
  - phase: 04-08
    provides: "F-082 escaping shipped under DEC-32 (c20d59b)"
  - phase: 04-07
    provides: "Tag mapping centralized and unknown tags surfaced; KNOWN_NON_ROUNDTRIP_TAGS; DI-37"
  - phase: 04-06
    provides: "Slice 1 close-out format and the after-floor command set"
provides:
  - "evidence/visual-fix-decision.md: the checkpoint resolved by rule to option-defer, the checkpoint as it would have been presented, and how to reverse it"
  - "DI-39 (F-080 visual half) and DI-40 (F-081 identity mappings), both owned by the phase owner"
  - "evidence/floor.phase-after.txt, evidence/playwright.phase-after.txt (+ run1-flake), evidence/jest.phase-after.suites.txt"
  - "evidence/PHASE-4-COMPLETION.md: criteria clause by clause, requirement states, 16/16 Validated rows, citations distinct=100 missing=0"
  - "Register: F-050, F-066, F-082, F-083 Fixed; F-080/F-081 Open with partial-fix resolutions"
affects: [phase-05, phase-06, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An owner checkpoint with no owner answer resolves by the plan's written rule, and the decision file says so in those words"
    - "A completion note carries its own one-line citation checker, run after staging, with the result written into the note"

key-files:
  created:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/visual-fix-decision.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/PHASE-4-COMPLETION.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.phase-after.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.phase-after.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.phase-after.run1-flake.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/jest.phase-after.suites.txt
  modified:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "The 04-11 checkpoint was resolved by rule to option-defer (no owner answer was available), not by the executor's judgement; F-080's visual half and F-081's identity mappings did not ship"
  - "REFAC-10 is recorded PARTIAL naming 'events list uses a real club join instead of fabricating club objects'; its REQUIREMENTS.md checkbox stays unticked"
  - "ROADMAP criterion 4's 'no intentional visual change' clause is recorded MET scoped by DEC-32, with the F-082 delta named and the PARTIAL reading stated if the owner rejects DEC-32"
  - "DI-38 fired again at the after-floor and is re-owned to Phase 5; the spec is not changed under option-defer"

patterns-established:
  - "Phase close-out evidence: floor.phase-after.txt mirrors floor.before.txt block for block, plus a post-register-edit block"

requirements-completed: []  # REFAC-09 was completed by 04-06 (re-confirmed here); REFAC-10 is PARTIAL (club-fabrication clause, DI-39) and is deliberately not marked complete

# Metrics
duration: 11min
completed: 2026-09-23
---

# Phase 4 Plan 11: Owner Checkpoint and Phase 4 Close-Out Summary

**The owner checkpoint on the two seeded-visible fixes was resolved by rule to `option-defer`, because no owner answer was available. Nothing under `src/` or `e2e/` changed. Phase 4 then closed on a measured floor: Jest 721/0 skipped across 50 of 50 suites, Playwright 40/0 from a clean reset after one DI-38 flake, and pgTAP 86/86. F-050, F-066, F-082 and F-083 were flipped to Fixed. The completion note records criteria 1, 3 and 4 MET, criterion 2 and REFAC-10 PARTIAL on the club-fabrication clause, and REFAC-09 Complete. Its citation check reports 100 distinct paths and 0 missing.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-09-23T22:47:05Z
- **Completed:** 2026-09-23T22:58Z
- **Tasks:** 3 (1 checkpoint resolved by rule, 2 auto)
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments

- **Checkpoint resolved by the plan's rule, and recorded that way.** `evidence/visual-fix-decision.md` names `option-defer`, says "resolved by rule — no owner answer was available", and is dated 2026-09-23. It keeps the full checkpoint as it would have been presented, including the measured deltas. On seeded data the detail page says "Hosted by Seed Organizer C" for both approved events. The badges read Academic + Social and Cultural + Social. The file quotes DEC-32's rule (b) to record F-082 as outside the checkpoint, notes that no owner objection was raised, and gives the exact reversal path.
- **The deferrals are owned.** DI-39 covers F-080's visual half and DI-40 covers F-081's six identity mappings, both owned by the phase owner. DI-37 travels with DI-40. The ledger records that pins A and D and the F-081 suite are unmoved.
- **After-floor at or above the before-floor on every row** (`evidence/floor.phase-after.txt`, head `d0135a3`):
  - Jest: 721 passed, 0 skipped (the before-floor was 358/5).
  - The phase subset: 249/0.
  - Lint: 0/19.
  - tsc: clean with tests included.
  - Audit: 0 high.
  - Ratchet: 25/25 delta 0.
  - Migration filenames: 4.
  - validate --quick: 118/2/1.
  - pgTAP: 86 on both runs (21 SKIP unseeded, 21 ok seeded).
  - Stale-date census: 0.
  - `(supabase as any)` under `src/app/api/`: 0.
- **Register reconciled surgically:**
  - `findings.json` diff: 10 lines added, 5 deleted, with no reformatting.
  - F-050, F-066 (both clauses), F-082 (under DEC-32) and F-083 are now Fixed. F-083 carries the Phase 8 composite-index follow-up.
  - F-080 and F-081 stay Open, with resolutions naming the shipped halves and DI-39/DI-40.
  - `FOUNDATION_AUDIT.md` was regenerated: Open 71 → 67, Fixed 14 → 18. Validate passes 8/8.
- **Completion note** (`evidence/PHASE-4-COMPLETION.md`, 263 lines):
  - All four criteria and both requirements, clause by clause.
  - 16 of 16 Validated rows, with rows 13 and 16 stated honestly as having no test.
  - Every intentional behaviour change, with its authority.
  - DI and A1-A8 dispositions.
  - `CI run UNOBSERVED — no push was authorized in this phase`.
  - A one-line citation checker: `distinct=100 missing=0`.

## Task Commits

1. **Task 1: owner checkpoint.** Resolved by rule (`option-defer`, no owner answer); no files changed and no commit, by design.
2. **Task 2: record the decision and the deferrals**: `d0135a3` (docs)
3. **Task 3: after-floor, harness, register, completion note**: `94be806` (docs)

**Plan metadata:** the final docs commit that adds this file.

## Files Created/Modified

- `evidence/visual-fix-decision.md`: the decision, the checkpoint as it would have been presented, the DEC-32 paragraph, and the reversal path.
- `evidence/PHASE-4-COMPLETION.md`: the phase completion note.
- `evidence/floor.phase-after.txt`: blocks 1-16 mirroring the before-floor, plus block 17 (tag gate, `--check findings` and the ratchet, run after the register edit).
- `evidence/playwright.phase-after.txt` (run 2, 40/0, ends `exit=0`) and `evidence/playwright.phase-after.run1-flake.txt` (run 1, 39/1, DI-38).
- `evidence/jest.phase-after.suites.txt`: per-suite counts cited by the Validated table.
- `evidence/deferred-items.md`: DI-39, DI-40, DI-37's disposition, and Part 5 (the final state of every item; the next id is DI-41).
- `evidence/defect-ledger.md`: the "not moved" section for pins A and D and F-081.
- `.planning/audit/findings.json` and `FOUNDATION_AUDIT.md`: the flips and resolutions.
- `.planning/REQUIREMENTS.md`: REFAC-10's traceability row is Partial, with the clause named.
- `.planning/ROADMAP.md`: Phase 4's requirement-state line.

## Decisions Made

See `key-decisions` above. The checkpoint was not decided by the executor. The plan's no-answer rule selected `option-defer`.

## The checkpoint, for the owner to review after the fact

**Decision:** should F-080's visual half and F-081's identity mappings ship as logged intentional visual changes, or be deferred with an owner? The first removes the organizer-string club fallback in `transformEventFromDB` and gives `/api/events/[id]` the real club embed. The second maps tech, food, volunteer, arts, music and networking to themselves.

| Option | What it changes | Consequence |
|---|---|---|
| `option-defer` (**applied, by rule**) | Nothing rendered | Criterion 2 and REFAC-10 clause 1 are PARTIAL. Production keeps naming an app-created event's creator as host. Badges keep disagreeing with tag filters |
| `option-ship-club` | Both seeded detail pages change from "Hosted by Seed Organizer C" to "Hosted by Seed Approved Club". In production, app-created events name the club rather than the creator, and scraped club-less events lose the organizer pill and the "Hosted by" block | Criterion 2 and REFAC-10 are met. Overrides orchestrator decision 1 for host text. Cost is +0.34 ms median locally |
| `option-ship-both` | The above, plus Seed Approved Event's badges go from Academic + Social to Academic + Tech, and Music Night's from Cultural + Social to Music + Social. Tag filters and badges agree | Also closes F-081, with DI-37 and the `competition` hierarchy call beside it. Overrides orchestrator decision 1 for six categories' badges |

**Shipped without the checkpoint, under DEC-32:** F-082 (`c20d59b`). A `%` or `_` search on seeded data returned both approved events before and none after. `a,b` went from a 500 to a 200, and the feed shows "No events found" both times. Rule (b): a seeded-visible fix goes to the checkpoint only when its ROADMAP clause can be delivered without the visible change. Criterion 3 names `%` and `_`, so no delivery can.

**To reverse the deferral:** add an owner-signed paragraph to `evidence/visual-fix-decision.md` naming the option. Then run that file's § "Reversing this decision" steps as a follow-up plan:

- Commit A (F-080): the detail select, removing the fallback, moving pins A and D, and flipping Playwright test 8.
- Commit B (F-081): the identity mappings, emptying `KNOWN_NON_ROUNDTRIP_TAGS`, moving the golden rows and the suite, and flipping test 9.

Each commit body begins `INTENTIONAL VISUAL CHANGE`. Afterwards, flip F-080/F-081 to Fixed, close DI-39/DI-40/DI-37, and change REFAC-10 to Complete. A DEC-32 objection goes in the same file and becomes a DI owned by the phase owner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Evidence completeness] Two evidence files added beyond the plan's list**
- **Found during:** Task 3.
- **Issue:** The completion note cites per-suite test counts and a post-register-edit tag-gate and validate run. The plan's evidence files did not carry either, and the evidence discipline requires a committed path for every claim.
- **Fix:** Added `evidence/jest.phase-after.suites.txt` (per-suite counts from `jest --json` on the same tree). Also appended block 17 to `evidence/floor.phase-after.txt` (tag gate `ok 18 files`, `--check findings` 8/8, ratchet 25/25).
- **Commit:** `94be806`.

**2. [Rule 3 - Known flake] The DI-38 re-run rule was applied**
- **Found during:** Task 3.
- **Issue:** Playwright run 1 gave 39/1, failing only at `save-and-rsvp.spec.ts:53` with DI-38's exact protocol error.
- **Fix:** A fresh reset and seed, then one re-run: 40/0, `exit=0`. Both logs were kept. DI-38 was re-owned to Phase 5, and the spec was not changed (no test or source change under `option-defer`).
- **Commit:** `94be806`.

**3. [Precedent choice] REFAC-10's REQUIREMENTS.md checkbox stays unticked**
- **Issue:** Phase 3 ticked the checkbox of PARTIAL requirements (REFAC-01, REFAC-04) and wrote "Partial" in the traceability table.
- **Fix:** For REFAC-10 the box stays `[ ]`, so the checklist does not read as complete. The traceability row records Partial with the clause named, and `requirements.mark-complete` was not run.

---

**Total deviations:** 3 (1 evidence addition, 1 rule-driven re-run, 1 recording choice). **Impact:** none on scope. `git diff --stat bb27c64 HEAD -- src/ e2e/ supabase/ package.json package-lock.json` is empty.

## Issues Encountered

- The first citation-check run reported 1 missing path. It was the note's own illustrative placeholder `evidence/…`, which was reworded to `evidence/<file>`. The check then gave `distinct=100 missing=0`.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema changed. T-04-11-01 is mitigated: the decision file states the rule, and each deferral has an owner. T-04-11-03 is mitigated: 0 missing citations. T-04-11-04 is mitigated: surgical edits and validate 8/8. T-04-11-05 is mitigated: no push, and CI is recorded as UNOBSERVED.

## User Setup Required

- **The phase owner** should review `evidence/visual-fix-decision.md`. The default can stand, or be reversed by the documented path.
- CI on this phase's head is unobserved until the owner pushes.

## Next Phase Readiness

- **Phase 5 inherits:**
  - DI-25: the supabase-js minor; the `ssr` major at the earliest.
  - DI-36: `pending_edits` visibility (REFAC-13).
  - DI-38: the save-and-rsvp reload race.
  - DI-22.
  - F-072 and F-073, the last `(supabase as any)` at `src/app/moderation/page.tsx:78`.
  - F-078: the fuzzy RPC, the literal `*`, and a rank keyset.
  - F-059: the error echo.
  - REFAC-11's fail-closed ban check.
- **The phase owner holds:** DI-39, DI-40 and DI-37. REFAC-10 and criterion 2 stay PARTIAL until DI-39 ships.
- **Phase 6:** F-084, F-085 and the `[tags]` warning's structured logging.
- **Phase 8:** F-083's composite `(start_date, id)` index, A1, DI-23.
- **Floors at close:**
  - Jest: 721 passed / 0 skipped, 50 of 50 suites.
  - tsc: clean with tests.
  - Lint: 0/19.
  - Tag gate: ok 18 files.
  - Ratchet: 25/25 delta 0.
  - pgTAP: 86/86.
  - Playwright: 40.
- **Local stack:** reset and seeded (10 personas, 5 clubs, 6 memberships, 5 events, 2 RSVPs, 0 saved events). Port 3000 is free.

## Self-Check: PASSED

- FOUND: evidence/visual-fix-decision.md (65 lines, min 20), evidence/PHASE-4-COMPLETION.md (263 lines, min 120), evidence/floor.phase-after.txt (line 1 `head=d0135a3f…`), evidence/playwright.phase-after.txt (ends `exit=0`, 40 passed), evidence/playwright.phase-after.run1-flake.txt, evidence/jest.phase-after.suites.txt, evidence/deferred-items.md, evidence/defect-ledger.md
- FOUND: commits d0135a3, 94be806
- `git diff --stat bb27c64 HEAD -- src/ e2e/ supabase/ package.json package-lock.json` is empty; no tracked file was deleted by either commit

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
