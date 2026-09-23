---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 06
subsystem: testing
tags: [slice-close, tsconfig, type-check, di-24, f-050, f-066, f-071, f-079, playwright, findings-register]

# Dependency graph
requires:
  - phase: 04-05
    provides: "the Slice 1 refactor commits a5ee4fc, fe4e9f9, d40dee4 (F-079), 1351480 (F-071) and the defect ledger"
  - phase: 04-04
    provides: "Playwright 37 (event-read-path.spec.ts), the tag gate at 17 files, the stack reset and seeded"
  - phase: 04-02
    provides: "the four Slice 1 PRESERVE suites and the save-and-rsvp harness tests used as re-confirmation"
  - phase: 04-01
    provides: "evidence/floor.before.txt, the command list and before values"
provides:
  - "Test files are inside the type-check: tsconfig.json no longer excludes *.test.ts(x); tsc and next build both check them, with 0 errors"
  - "Every dynamically imported route handler in the suites is typed as the handler's own type; the rsvp/reviews `let GET: any` is gone"
  - "The analytics fixtures use start_date, and the webhook comment no longer denies club_id/status (F-050 residue: 8 lines -> 1, tagMapping.ts:98)"
  - "Slice 1 after-evidence: floor.slice-1-after.txt, playwright.slice-1-after.txt (37/37 from a clean reset), slice-1-close.md (16/16 Validated rows)"
  - "F-079 and F-071 are Fixed in the register; F-066 has its type-check clause met and stays Open; F-066's duplicate resolution key is merged"
affects: [04-07, 04-08, 04-09, 04-10, 04-11, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route handler reference in a test: `let GET: (typeof import(\"@/app/api/.../route\"))[\"GET\"]`, assigned without a cast and called with the request type the handler declares plus `{ params: Promise.resolve({ id }) }`"
    - "`let x = null as T | null` rather than `let x: T | null = null` when a closure assigns x, so the use site is not narrowed to null"
    - "Script-style suites become modules (an import, or `export {}`) so their top-level names stop colliding once tsc sees them"

key-files:
  created:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/tsc-tests-included.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.slice-1-after.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.slice-1-after.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-close.md
  modified:
    - tsconfig.json
    - CLAUDE.md
    - supabase/functions/events-webhook/index.ts
    - src/__tests__/api/clubs/analytics.test.ts
    - src/__tests__/api/events/analytics.test.ts
    - src/__tests__/api/events/rsvp.test.ts
    - src/__tests__/api/events/reviews.test.ts
    - src/__tests__/api/events/get-events.test.ts
    - src/__tests__/api/events/date-validation.test.ts
    - src/__tests__/moderation/audit-shape.test.ts
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md

key-decisions:
  - "Test requests are built as each handler declares them: NextRequest for rsvp, analytics, create and [id] PATCH; a plain Request for reviews, whose route declares Request. No handler signature moved"
  - "The date-validation TS2353 was a cross-file name collision, not a fixture lie. The file's own mockUser type already carries email, so the error disappeared once the file became a module and no fixture changed"
  - "F-066's two duplicate `resolution` keys were merged, in the order Phase 2, Phase 3, Phase 4, because JSON.parse had dropped the Phase 3 paragraph. This costs one deleted line more than the acceptance bound of 3"
  - "For the harness run, the database was reset and seeded again right after the seeded pgTAP probe, rather than repeating the before-floor's 11b re-seed on an already seeded database, so Playwright started from a clean reset"
  - "REFAC-09 is complete: seam adoption (04-05), head-count RSVP queries (d40dee4), and characterization passing before (04-02) and after (04-05 Jest, 04-06 Playwright and floor). REFAC-10 is not; its fixes are 04-07 to 04-11"

patterns-established:
  - "Slice close-out note: floor before/after table, harness before/after, one row per Validated bullet naming a test or the diff that shows it untouched, findings closed and partial, the no-visual-change argument, and log-line deltas"

requirements-completed: [REFAC-09]

# Metrics
duration: 12min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 06: Slice 1 Close Summary

**The test tree is now inside the type-check. Removing the exclusion surfaced 71 errors in 7 suites, and all of them were fixed in the tests, with no route signature changed and no `any` added. The stale analytics date fixtures and the edge-function comment now describe the real schema. Slice 1 is closed with evidence: every floor command is at or above its before value, Playwright passes 37/37 from a clean reset, all 16 Validated workflows are accounted for, and F-079 and F-071 are Fixed in the register.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-09-23T05:52:31Z
- **Completed:** 2026-09-23T06:05:01Z
- **Tasks:** 3 of 3
- **Files:** 4 created, 13 modified

## Accomplishments

- **F-050's test and edge-function residue is gone.** Six fixture rows went from `event_date` to `start_date`, the column both analytics routes select. No assertion read the date, so none moved, and the three analytics suites are 12/12 before and after. The webhook's docblock now lists the columns the function actually writes, including `status`, and says it sets no `club_id` rather than claiming the column does not exist. Its non-comment diff is empty. The census went from 8 lines in 4 files to 1 line, `src/lib/tagMapping.ts:98`, which belongs to 04-07.
- **DI-24 / F-066's type-check clause is met.** The census before the fixes was 71 errors in 7 files: TS2451 26, TS2554 17, TS2352 15, TS2393 12, TS2353 1. That is the research's 77 minus friends-defect's 6, which 04-05 had already fixed. After the fixes it is 0, and `next build`'s type-check now covers the tests too. A throwaway negative control showed that a one-argument call, or a plain `Request` passed where `NextRequest` is declared, now fails `tsc`. `git diff -- src/app src/lib src/server` is empty for this plan.
- **Slice 1 closed with evidence.** Every `floor.before.txt` command was re-run on `9530d35`. Jest is at 512/5 (before: 358/5), lint 0/19, tsc clean (now including tests), the audit gate unchanged, the ratchet `committed=25 live=25 delta=0`, validate `--quick` 118/2/1 with the same two by-design FAILs, pgTAP 86 on both unseeded and seeded runs (040: 21 SKIP and 21 ok), Playwright 37/37, and both censuses lower. `slice-1-close.md` has one row for each of the 16 Validated bullets. Row 5, save/unsave and RSVP, is re-confirmed by the three `save-and-rsvp.spec.ts` tests and the four PRESERVE suites. The other 15 are shown untouched by the Slice 1 production diff and named with their surviving tests, except notifications and interaction tracking, which are stated honestly as having no test.
- **The register is updated.** F-079 and F-071 are set to `Fixed`, each with a resolution naming its commit, the moved DEFECT suite and `slice-1-close.md`. F-066 records the type-check clause as met and stays Open, because the skipped-suite clause is 04-09's. FOUNDATION_AUDIT.md was regenerated (Open 73 → 71, Fixed 12 → 14), and `validate --check findings` passes 8/8.

## Task Commits

1. **Task 1: stale event-date fixtures and the webhook comment (F-050)**: `a037d95` (fix)
2. **Task 2: type-check the test files; all fixes in tests (DI-24, F-066)**: `9530d35` (chore)
3. **Task 3: Slice 1 after-floor, Playwright, close-out, register**: `ba425f2` (docs)

## Files Created/Modified

- `tsconfig.json`: the `**/*.test.ts` and `**/*.test.tsx` excludes are removed; the other four entries are kept.
- `CLAUDE.md`: the test-file sentence now says test files are type-checked by the main tsconfig and run by Jest's two projects, and gives the handler-typing rule.
- `supabase/functions/events-webhook/index.ts`: comment only.
- `src/__tests__/api/{clubs,events}/analytics.test.ts`: `start_date` fixtures, a NextRequest import, and a typed `GET`.
- `src/__tests__/api/events/rsvp.test.ts`: typed GET/POST/DELETE (no `any`), NextRequest requests, and the init written inline.
- `src/__tests__/api/events/reviews.test.ts`: `export {}`, and typed GET/POST (no `any`); requests stay `Request`, as the route declares.
- `src/__tests__/api/events/date-validation.test.ts`: NextRequest builders, and typed POST/PATCH.
- `src/__tests__/api/events/get-events.test.ts`: 8 × `let capturedBuilder = null as B | null`.
- `src/__tests__/moderation/audit-shape.test.ts`: `ModerationDashboardPage()` called with no argument, removing 3 `any`.
- `.planning/audit/findings.json`, `FOUNDATION_AUDIT.md`: the flips and resolutions described above.
- `evidence/defect-ledger.md`: an F-066 row and a register-flips section.
- `evidence/tsc-tests-included.txt` (261 lines), `floor.slice-1-after.txt` (865), `playwright.slice-1-after.txt` (301), `slice-1-close.md` (99).

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Register defect] F-066 carried two `resolution` keys. They were merged, which means 4 deleted lines instead of the bound of 3**
- **Found during:** Task 3.
- **Issue:** F-066 had a Phase 3 `resolution` line followed by a Phase 2 `resolution` line in the same object. JSON.parse keeps only the last, so the Phase 3 paragraph (the DI-24 hand-off) never reached FOUNDATION_AUDIT.md. Appending the 04-06 note to either line would have left one paragraph invisible.
- **Fix:** One key holding the Phase 2, Phase 3 and Phase 4 paragraphs in that order, with a sentence recording the merge. A scan of all 85 records now finds no duplicate keys. `git diff --numstat` is 5 added and 4 deleted: two status lines plus the two F-066 lines. That is one over the acceptance bound. No other line changed, and the file was not reformatted, which is the bound's purpose (T-04-06-04).
- **Commit:** `ba425f2`.

**2. [Rule 3 - Scope] Two test files outside Task 2's `<files>` were typed**
- `src/__tests__/api/clubs/analytics.test.ts` and `src/__tests__/api/events/analytics.test.ts` had 9 errors each. The plan anticipates this: fix it if the fix is test-local, record it, and commit it. Both were already in the plan's `files_modified` through Task 1. Recorded in `tsc-tests-included.txt`.

**3. [Measured, not assumed] The "three genuine fixture lies" were not three here**
- Two were friends-defect's, which 04-05 had already fixed. The third, date-validation's `email` on `{ id: string }`, was a collision artefact, and no fixture changed. Recorded rather than "fixed".

**4. [Accuracy] The stale-date census expected "two remaining hits"; one remains**
- `src/lib/tagMapping.ts:98` is one line. The acceptance criterion (only tagMapping lines remain) holds.

**5. [Accuracy] DEC-29 is three log lines, not four**
- `git show a5ee4fc -- src/app` removes exactly three `console.warn` lines. The 04-05 SUMMARY says "four … 401 paths". The close-out states the measured three.

---

**Total deviations:** 5 (1 register-defect fix that exceeds a line bound by one, 1 in-scope test addition, 3 measurement corrections).
**Impact on plan:** No file under `src/app`, `src/lib`, `src/server` or `supabase/migrations` changed. No package was installed. Production was not touched.

## TDD Gate Compliance

The plan is `type: execute` with no `tdd="true"` tasks. The type-check change has its own red/green evidence: 71 errors, then 0, plus a negative control.

## Issues Encountered

- `npm run build` in Task 2 compiled from cache in 348 ms, but its "Running TypeScript … Finished TypeScript" step ran over the new program. The Task 3 Playwright webServer build ran from scratch and also passed.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema changed. T-04-06-01 and T-04-06-02 are met: the source diff is empty and no added test line contains `any`. T-04-06-04 is met, with the one-line overage above explained.

## Next Phase Readiness

- **Floors after this plan:** jest 512 passed / 5 skipped / 517 (46 passed + 1 skipped of 47 suites); tsc clean **with test files included**; lint 0 errors / 19 warnings; build exit 0; tag gate `ok 17 files`; ratchet `committed=25 live=25 delta=0`; Playwright 37; validate `--check findings` 8/8; stale-date census 1 line; `(supabase as any)` census 3 lines (1 code site).
- **For Wave 5 (04-07, 04-08): tsc now type-checks test files.** Any new or edited suite must compile: type handler references as `(typeof import("<route>"))["GET"]`, build requests as the handler declares them, and make script-style files modules. `next build` fails on a test type error too.
- **04-07** owns the last stale-date line (`src/lib/tagMapping.ts:98`). F-050's status flip is 04-11's.
- **04-09** owns F-066's remaining clause: `src/app/api/events/route.test.ts` is still skipped (4 pending). When it closes, append to F-066's single `resolution` key; there is no longer a duplicate.
- `get-events.test.ts` changed only in its 8 `capturedBuilder` declarations; its assertions are untouched.
- **Local stack:** reset and seeded after the Playwright run (10 personas, 2 RSVPs, 0 saved events). Port 3000 is free (`lsof` exit=1).
- DI-24's row in `evidence/deferred-items.md` still reads "split across 04-06 and 04-09". The 04-06 half is done, and the row was left for 04-09 to close in full.

## Self-Check: PASSED
