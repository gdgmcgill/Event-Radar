---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 08
subsystem: event-read-path
status: complete
tags: [refac-10, f-082, f-059, f-078, dec-32, search, postgrest, ilike, escaping, live-probe, a2]

# Dependency graph
requires:
  - phase: 04-06
    provides: "test files type-checked by tsc; Playwright floor 37 (evidence/playwright.slice-1-after.txt)"
  - phase: 04-04
    provides: "search-escaping-defect.test.ts (F-082 DEFECT, F-059 echo), events-list PRESERVE suite, event-read-path.spec.ts tests 6-7"
  - phase: 04-01
    provides: "DEC-32 (F-082 ships unconditionally, * knowingly out of scope) in evidence/phase-04-decisions.md"
provides:
  - "src/lib/searchFilter.ts: escapeLikeLiteral, postgrestQuotedValue, ilikeContainsFilter"
  - "The events-list ILIKE fallback builds its or() argument from ilikeContainsFilter for title and description"
  - "F-082 DEFECT pins moved (4 Jest + get-events hackathon + e2e tests 6-7, now FIXED F-082)"
  - "scripts/probes/search-escape-probe.ts: local-only live probe; research assumption A2 closed by measurement"
  - "F-082 rows in evidence/defect-ledger.md citing DEC-32, with the '* knowingly out of scope' line"
affects: [04-09, 04-11, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer escaping as three named pure functions (LIKE layer, PostgREST quoted-value layer, composition), one unit test per character per layer"
    - "Local-only live probe: localStackEnv() -> assertSeedTargetAllowed() before any client -> reserved id namespace -> finally-delete -> anon read proving zero remain"
    - "KNOWN verdict row in a probe: pins accepted, un-fixable behaviour and flips to FAIL if the upstream behaviour changes"

key-files:
  created:
    - src/lib/searchFilter.ts
    - src/lib/searchFilter.test.ts
    - scripts/probes/search-escape-probe.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/search-escape-probe.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.escaping.txt
  modified:
    - src/app/api/events/route.ts
    - src/__tests__/api/events/search-escaping-defect.test.ts
    - src/__tests__/api/events/get-events.test.ts
    - e2e/specs/event-read-path.spec.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md

key-decisions:
  - "F-082 shipped under DEC-32 (no owner override paragraph existed in the DEC-32 section at start), not the 04-11 checkpoint"
  - "escapeLikeLiteral leaves * untouched: PostgREST rewrites * to % after unquoting, so escaping it would turn a * search into a literal-% search; pinned by a unit test and the probe's KNOWN row"
  - "The FIXED F-082 Playwright block moved to the end of the spec so the remaining DEFECT tests (F-080, F-081) are not under a FIXED divider; header list uses 'FIXED (F-082)' so only the two test titles carry the literal 'FIXED F-082'"
  - "Ledger steps 2 and 4 controls were run for the Jest rows (5 red each way) although the plan did not list them, because the ledger's protocol applies to every row"
  - "REFAC-10 is not marked complete: 04-09 to 04-11 still carry its remaining clauses"

patterns-established:
  - "Escape at a named lib function, never inline in a route; measure against the real parser with a guarded local probe when a unit test cannot observe the grammar"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-09-23
---

# Phase 4 Plan 08: Search Input Escaping (F-082) Summary

**Search terms now reach PostgREST's `or()` filter LIKE-escaped (`%`, `_`, backslash) and double-quoted (comma, parentheses, dot, quote) through `ilikeContainsFilter` in `src/lib/searchFilter.ts`. A live probe against local PostgREST v16.1 shows each special character matching only its literal row. `*` stays at today's wildcard behaviour, knowingly out of scope under DEC-32.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-23T06:14:19Z
- **Completed:** 2026-09-23T06:21Z
- **Tasks:** 2
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- **DEC-32 gate checked first.** The DEC-32 section of `evidence/phase-04-decisions.md` has no owner-signed override paragraph, so the plan ran.
- **The escape is a named, tested function.** `src/lib/searchFilter.ts` exports `escapeLikeLiteral`, `postgrestQuotedValue` and `ilikeContainsFilter`. Its header documents the two-layer model, the two-backslash rows, why the default LIKE escape is relied on, and "Asterisk — knowingly out of scope". `searchFilter.test.ts` has 29 tests: one per character (percent, underscore, backslash, comma, open parenthesis, close parenthesis, double quote, asterisk) for each export, plus plain-text and composition cases.
- **Route call site.** The RPC-error branch of `src/app/api/events/route.ts` now passes `[ilikeContainsFilter("title", search), ilikeContainsFilter("description", search)].join(",")`. Nothing else in the route changed: the fuzzy success path, the date floor, tags, pagination, Cache-Control and the F-059 error branch are untouched.
- **Pins moved in the fixing commit.** In `search-escaping-defect.test.ts`, the 4 raw-string assertions now expect the escaped, quoted form, and a "Status: FIXED in 04-08" paragraph was added. The F-059 echo assertion stays, with a note. `get-events.test.ts` now expects the quoted `hackathon` string. In `event-read-path.spec.ts`, tests 6 and 7 are retitled `FIXED F-082` (`a,b` gives 200 with `[]`; `%` gives total 0).
- **A2 closed by measurement.** Across the probe cases: 6 PASS (`100%`, bare `%`, `_`, `"`, backslash, `comma, paren (x)`), each matching exactly its own row with 0 seeded rows. 1 KNOWN: bare `*` matches all 5 probe rows plus both seeded events. An anon follow-up read shows 0 probe rows left.
- **Plain-text search unchanged.** The events-list PRESERVE suite passed unmodified against both the pre-fix and fixed routes. The "Music Night" Playwright PRESERVE test passed. No "failed to parse logic tree" appears anywhere in the Playwright server log.

## Task Commits

1. **Task 1: escape search input via searchFilter.ts, move the F-082 pins.** `c20d59b` (fix). The body states the `%`/`_` and `a,b` seeded deltas and that plain text is unchanged, and cites DEC-32 with its rule.
2. **Task 2: local-only probe, Playwright harness, ledger.** `0192157` (test).

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `src/lib/searchFilter.ts` (92 lines): the three exports and the documented model.
- `src/lib/searchFilter.test.ts` (165 lines): 29 unit tests.
- `src/app/api/events/route.ts`: one import and the fallback's `or()` argument.
- `src/__tests__/api/events/search-escaping-defect.test.ts`: the F-082 describe moved; the F-059 echo describe kept.
- `src/__tests__/api/events/get-events.test.ts`: the hackathon `or()` expectation is now quoted.
- `e2e/specs/event-read-path.spec.ts`: tests 6 and 7 are FIXED, the header list is updated, and the FIXED block moved to the end.
- `scripts/probes/search-escape-probe.ts` (212 lines): the guarded local probe, not wired into CI or npm.
- `evidence/search-escape-probe.txt`: seed, probe table (`exit=0`), anon read (0 rows), seeded approved ids untouched.
- `evidence/playwright.escaping.txt`: port check, reset, seed, 37 passed / 0 failed, `exit=0`.
- `evidence/defect-ledger.md`: 7 F-082 rows, plus an evidence section covering DEC-32, the behaviour change, steps 2-5, A2 and the "`*` knowingly out of scope:" line.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Halved backslashes in the moved DEFECT assertions**
- **Found during:** Task 1.
- **Issue:** The Python helper wrote the `%` and `_` expectations with `\\` where the JS source needed `\\\\`. Those lines would have asserted one runtime backslash instead of two.
- **Fix:** Corrected before any test run or commit.
- **Files modified:** `src/__tests__/api/events/search-escaping-defect.test.ts`.
- **Commit:** `c20d59b`.

**2. [Rule 3 - Blocking] "FIXED F-082" count in the spec**
- **Found during:** Task 1.
- **Issue:** The acceptance criterion requires exactly 2 lines containing `FIXED F-082`. The first header rewording produced 5.
- **Fix:** The header list reads `FIXED (F-082)`, so only the two test titles carry the literal. The FIXED block moved below the remaining DEFECT tests.
- **Commit:** `c20d59b`.

**3. [Rule 2 - Missing verification] Ledger protocol controls**
- **Found during:** Task 2.
- **Issue:** The ledger's protocol (steps 2 and 4) applies to every row, but the plan did not list those controls.
- **Fix:** Ran them with temporary copies, then deleted the copies and restored the route, confirming it was identical to HEAD under `cmp`. Old assertions against the fixed route: 5 failed. Moved assertions against the pre-fix route: 5 failed, with PRESERVE green both times. Recorded in the ledger. For the Playwright rows, the pre-fix side is `playwright.slice-2-before.txt` (500 and total 2), so the app was not rebuilt against the pre-fix route.

**4. [Process] No separate RED commit**
- `tdd="true"` would normally produce a `test(...)` RED commit. Plan constraint 7 mandates exactly two commits (the fix, then the probe). RED was observed (the suite failed on the missing module) but was not committed separately.

**Total deviations:** 3 auto-fixed and 1 process note. **Impact:** none on scope. All were correctness or protocol completeness.

## TDD Gate Compliance

RED was observed (`searchFilter.test.ts` failed: module not found) and then GREEN (29/29) before the fix commit. There is no separate `test(...)` RED commit, because plan constraint 7 fixes the commit count at two. The fix commit is `fix(...)`, not `feat(...)`, per the plan's mandated subject.

## Issues Encountered

None. `e2e/specs/event-read-path.spec.ts` was not Prettier-clean before this plan either (checked against `HEAD~1`), so it was not reformatted.

## Threat Flags

None. The probe's write surface (local service role) is T-04-08-04/05 in the plan's threat model and is mitigated as specified.

## Next Phase Readiness

- **04-09:** `src/app/api/events/route.ts` changed only in the search fallback and one import line, and pagination is untouched. `search-escaping-defect.test.ts` and `get-events.test.ts` now expect quoted `or()` strings. Keep them if you touch the search branch. e2e test 5 (DEFECT F-083) is still in the DEFECT block. The FIXED F-082 block is now at the end of the spec.
- **04-11:** flip F-082 in `findings.json` and record it as shipped under DEC-32 (commit `c20d59b`). It is not up for deferral. F-059's echo branch is still open (Phase 5). Its Jest assertion stays, fed by an injected PGRST100 fixture.
- **Phase 5 (F-078):** the fuzzy RPC path is the natural owner of a literal-`*` search. The probe's KNOWN row will print FAIL if PostgREST ever stops rewriting `*`.
- **Floors after this plan:**
  - Jest: **664 passed / 5 skipped / 669** (48 passed + 1 skipped of 49 suites; +29 tests, +1 suite)
  - tsc: clean, tests included
  - Lint: 0 errors / 19 warnings
  - Tag gate: `ok 17 files`
  - Ratchet: `committed=25 live=25 delta=0`
  - Playwright: **37** passed
- **Local stack:** reset and re-seeded after the Playwright run (10 personas, 5 clubs, 5 events, 2 RSVPs, 0 saved events). Port 3000 is free.

## Self-Check: PASSED

- FOUND: src/lib/searchFilter.ts, src/lib/searchFilter.test.ts, scripts/probes/search-escape-probe.ts, evidence/search-escape-probe.txt, evidence/playwright.escaping.txt
- FOUND commits: c20d59b, 0192157
