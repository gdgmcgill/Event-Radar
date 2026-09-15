---
phase: 02-dependency-and-runtime-stabilization
plan: 08
subsystem: testing
tags: [jest, jsdom, testing-library, jest-dom, ts-jest, react, typescript, npm, lockfile]

# Dependency graph
requires:
  - phase: 02-dependency-and-runtime-stabilization
    provides: "batch 0's Node 24 pin (engines/.nvmrc/CI), the `test` script and the CI jest step; batch 4's htmlparser2 ESM transform in jest.config.js; check-baseline.mjs as the STAB-13 comparator"
  - phase: 01-read-only-foundation-audit
    provides: "the AUDIT-13 baseline (220 passing / 36 skipped / 16 of 21 suites), jest-listtests.txt, test-runner-decision.md section 5 per-suite skip reasons, and AUDIT-19/F-050's finding that the day-and-clock event columns do not exist"
provides:
  - "A jsdom test environment for the suites that need one, installed as four devDependencies with the non-optional @testing-library/dom peer resolved"
  - "A two-project Jest configuration (node + jsdom) whose routing rule lives in one reviewable place and is not keyed on file extension"
  - "jest.setup.ts loading the DOM matchers into the jsdom project only"
  - "Four previously-skipped suites executing and passing, with their fixture drift repaired against the real types"
  - "A written disposition for the fifth suite, and an explicit hand-off of its contract question to REFAC-10"
  - "The measured STAB-13 position on both numbers: 278 passing, 5 skipped, 22 of 23 executing"
  - "A recorded, measured statement that the tsconfig test-file exclusion was retained, so F-066 reads as partially closed"
affects: [02-09, 02-10, 02-11, phase-03-schema-and-types, phase-04-event-read-path, REFAC-10, REFAC-04, F-066]

# Tech tracking
tech-stack:
  added:
    - "jest-environment-jsdom ^30.2.0 (resolved 30.5.1 — major matches jest 30)"
    - "@testing-library/react ^16.3.3"
    - "@testing-library/dom ^10.4.2 (RTL's non-optional peer)"
    - "@testing-library/jest-dom ^7.0.1 (engines.node >= 22)"
  patterns:
    - "Two Jest projects over one shared base object, spread into both so neither can drift from the other's module resolution"
    - "Environment routing declared once in jest.config.js rather than per-file via docblocks"
    - "Fixtures repaired to satisfy the types; types never loosened and casts never added to close a gap"
    - "Assertions that restate an enum value interpolate the enum instead, so they cannot drift from it independently"
    - "Decide-do-not-fix: a suite whose contract has drifted is dispositioned in writing and handed to the phase that owns the route, never revived against current behaviour"

key-files:
  created:
    - "jest.setup.ts"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/skipped-suite-disposition.md"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b5.before.sha256"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-05-lint.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-05-tsc.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-05-jest.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-05-build.txt"
  modified:
    - "jest.config.js"
    - "package.json"
    - "package-lock.json"
    - "src/components/ErrorBoundary.test.tsx"
    - "src/components/events/EventFilters.test.tsx"
    - "src/components/events/FilterSidebar.test.tsx"
    - "src/hooks/useEvents.test.ts"

key-decisions:
  - "Batch 5 (02-08): the jsdom environment routing rule lives in jest.config.js, not in per-file docblocks — src/hooks/useEvents.test.ts is a .ts file that needs a DOM, so the rule was never 'by extension', and a config-level rule keeps it in one reviewable place and tags every result line with its project"
  - "Batch 5 (02-08): src/app/api/events/route.test.ts is DECIDED, NOT FIXED — left skipped, not rewritten, not deleted, handler not edited. The contract question goes to REFAC-10 in Phase 4"
  - "Batch 5 (02-08): the cursor divergence is LIVE, not historical — src/hooks/useEvents.ts still sends cursor= and reads nextCursor/prevCursor while src/app/api/events/route.ts has zero occurrences of cursor and paginates on page/limit. Phase 1 recorded only that the suite had drifted; that the client still depends on the drifted contract is new"
  - "Batch 5 (02-08): the 20 revived useEvents tests assert cursor semantics against a mocked fetch, so they pass regardless of what the real route does and will NOT catch that divergence — recorded so REFAC-10 does not mistake green tests for a verified contract"
  - "Batch 5 (02-08): the tsconfig test-file exclusion is retained. Removing it today yields 68 errors across 6 files (down from the research's 86 across 10). 29 of the 68 are route-handler casts whose obvious fix is widening signatures under src/app/api/** — a behaviour change disguised as a type fix. F-066 is PARTIALLY closed"
  - "Batch 5 (02-08): only STAB-08 is marked complete. STAB-09 is not claimed because this batch ran no smoke pass; STAB-11 is a standing property that closes at 02-11; STAB-13 is a phase exit criterion owned by 02-11"

patterns-established:
  - "Shared-base Jest projects: lift the live single-project settings verbatim into a `common` object and spread it, so a two-project split cannot silently change resolution for the suites that already passed"
  - "Mechanical gate literals: a verify that greps a file for a forbidden token will also match that token inside an explanatory comment — describe the forbidden thing in prose instead of naming it"
  - "jest.mock factory ordering: jest.mock is hoisted above the imports, so any module whose binding the factory reads must be imported before the module under test"
  - "Discovery diffing: after any testMatch change, compare `jest --ci --listTests` against the Phase 1 listing so a silently-dropped suite is visible rather than merely absent"

requirements-completed: [STAB-08]

# Metrics
duration: 13min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 08: Batch 5 — jsdom Test Harness and the Skipped Suites Summary

**Four testing-library/jsdom devDependencies installed together, Jest split into `node` and `jsdom` projects over one shared base, four previously-skipped suites revived and their fixture drift repaired against the real types — skipped tests 36 → 5, passing 220 → 278 — with the fifth suite dispositioned in writing rather than revived against a contract that may be the defect.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-15T06:10:14Z
- **Completed:** 2026-09-15T06:23:30Z
- **Tasks:** 3
- **Files modified:** 12 (5 created, 7 modified)

## Accomplishments

- **The skip count finally moved.** STAB-13's gate is a pass count *and* a skip count, phrased that way because "tests pass" was already true of a tree in which five suites never ran. Passing went 220 → 278 and skipped went 36 → 5, both measured, both recorded as `key=value` lines against their baselines.
- **Four packages, one install, the peer resolved.** `@testing-library/dom` is listed by RTL 16 under `peerDependencies` with no optional marker; installing the other three alone would have left it unmet. `npm ls @testing-library/dom` now resolves 10.4.2 deduped under all three consumers.
- **React did not move.** RTL 16 peers `^18.0.0 || ^19.0.0`, so the resolver had a choice. `react` and `react-dom` are `^18.3.0` in the manifest and 18.3.1 in the lockfile, unchanged.
- **The lockfile was read, not regenerated.** 1392 lines changed; structural review recorded 87 entries added, 0 removed, 0 re-resolved, `lockfileVersion` 3 → 3, every addition inside the jsdom/testing-library subtree.
- **Discovery is provably unchanged.** 23 test files before and after the config rewrite, byte-identical, and the 21 Phase 1 baseline paths are all still present with exactly the two suites plans 02-02 and 02-06 added.
- **No production module was edited.** Asserted mechanically, not promised: `git diff` over `src/app`, `src/lib`, `src/hooks/useEvents.ts` and the three subject components is empty.
- **A live contract divergence was surfaced and handed on.** The production hook still speaks cursor while the route it calls speaks `page`/`limit`. Recorded, not repaired.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install the four test-harness packages and configure two Jest projects** — `0556444` (chore)
2. **Task 2: Un-skip the four revivable suites and repair their fixture drift** — `09d2934` (test)
3. **Task 3: Disposition the fifth suite, run the batch-5 gate, record the measured STAB-13 numbers** — `c1c6d42` (docs)

**Plan metadata:** see the final `docs(02-08)` commit.

## Files Created/Modified

**Created**

- `jest.setup.ts` — one side-effect import of `@testing-library/jest-dom`, loaded into the jsdom project only
- `evidence/skipped-suite-disposition.md` — the five-suite record, the decide-do-not-fix reasoning with its re-runnable greps, the REFAC-10 hand-off, and the retained-tsconfig-exclusion measurement (207 lines)
- `evidence/lock.b5.before.sha256` — pre-batch lockfile hash
- `evidence/batch-05-{lint,tsc,jest,build}.txt` — the four gate captures, each with a provenance block and `exit_code=0`

**Modified**

- `package.json` — four devDependencies added
- `package-lock.json` — reconciled with `npm install --package-lock-only`, reviewed as a diff, applied with `npm ci`
- `jest.config.js` — rewritten as `projects: [node, jsdom]` over a shared `common` base
- `src/components/ErrorBoundary.test.tsx` — stub → real import; stray `"use client"` removed
- `src/components/events/EventFilters.test.tsx` — stub → real import
- `src/components/events/FilterSidebar.test.tsx` — stub → real import; `"academic"` × 3 → `EventTag.ACADEMIC`; `@/types` moved above the component import
- `src/hooks/useEvents.test.ts` — stub and rework TODO removed; tag strings → enum members; `Club` and `Event` fixtures completed against their interfaces; `filters` binding typed `EventFilter`; the two non-existent date columns removed

## Decisions Made

**The environment routing rule is not "by extension."** `src/hooks/useEvents.test.ts` is a `.ts` file that renders React hooks and needs a DOM. A per-file `@jest-environment` docblock would work, but the rule would then be scattered across files and invisible in review. Putting it in `jest.config.js` keeps it in one place and has a second benefit that showed up immediately: every result line is now tagged `PASS node` or `PASS jsdom`, so a suite routed to the wrong environment is visible in the log rather than merely slow or mysteriously broken.

**The shared base is spread, not restated.** The `common` object carries the ts-jest preset, the `@/` alias mapper, the batch-4 htmlparser2 ESM transform and the three ignore patterns, and is spread into both projects. Restating them would let the two projects drift; spreading them means the 18 suites that already passed cannot change resolution as a side effect of the split.

**The fifth suite is decided, not fixed.** `src/app/api/events/route.test.ts` asserts a cursor contract; the handler has zero occurrences of `cursor` and paginates on `page`/`limit`. Reviving it against the handler would freeze a possible defect as the specification — the T-01-11-04 trap Phase 1 named. It stays skipped with its self-documenting title, and REFAC-10 in Phase 4 gets the question with the three decisions it has to make written out.

**The divergence is live.** This is the finding this batch added rather than inherited. `src/hooks/useEvents.ts` sends `cursor=` and reads `nextCursor`/`prevCursor`; the route reads and returns neither. Phase 1 recorded that the *suite* had drifted from the route. That the *client* is still written against the drifted contract is new, and it makes "the tests are simply obsolete" a much weaker hypothesis. Recorded in the disposition note § 2.2, not repaired — reconciling a client/server contract is a behaviour change and Phase 2 preserves behaviour.

**The 20 revived hook tests will not catch that divergence,** because they assert cursor semantics against a mocked `fetch`. Worth saying out loud in the hand-off, so nobody in Phase 4 reads 20 green cursor tests as evidence that the route does cursors.

**The tsconfig exclusion stays.** Measured after this batch: removing it yields 68 errors across 6 files, all under `src/__tests__/api/`. 38 are cross-file scope collisions; 29 are route-handler casts whose obvious-looking fix is widening handler signatures under `src/app/api/**` — a behaviour change disguised as a type fix. F-066 is **partially closed**: skips cleared, type-check hole retained on purpose. Plan 02-11 must quote `evidence/skipped-suite-disposition.md` § 4 rather than claim it.

## Requirements

| ID | Verdict | Why |
|---|---|---|
| **STAB-08** | **Complete** | Every clause is now satisfied on disk: `vitest.config.ts` and `vitest.setup.ts` are gone (batch 0), `jest-environment-jsdom` and the three testing-library packages are installed and the previously-skipped `.tsx` suites execute, `"test": "jest"` exists in `package.json`, and `.github/workflows/ci.yml` line 37 runs `npm test`. The requirement names the installable skips; the fifth suite was never one. |
| STAB-09 | Pending | Its clause reads "each followed by lint, type-check, test, build, **and a smoke pass**". This batch ran the first four and no smoke pass — the plan's file list did not include one, this being an install batch rather than an upgrade batch. Not claimable here. |
| STAB-11 | Pending | A standing property across the whole phase, not a deliverable of one plan. This batch honoured it (diff-reviewed lockfile, no forced remediation; `check-baseline.mjs` confirms the commit range is clean), but it closes at 02-11. |
| STAB-13 | Pending | Measured green and better than baseline on both numbers here, but it is a **phase exit criterion** owned by 02-11, per the standing decision recorded in STATE.md. |

Following this phase's precedent: a requirement is marked complete only when every clause of it is delivered.

## Verification

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 — 0 errors, 19 warnings, **identical per rule** to batch 4; none of the four rewritten test files appears |
| `npx tsc --noEmit` | exit 0 — zero bytes, despite 87 new lockfile entries including `@types/jsdom` |
| `npx jest --ci` | exit 0 — **278 passed / 5 skipped / 22 of 23 suites**, 0 failing |
| `npm run build` | exit 0 — cold after `rm -rf .next`; 140 route-table lines (same as batch 4); Browserslist warning still absent |
| `npm ci` | exit 0 from the reconciled lockfile, peer resolved |
| `check-baseline.mjs` | exit 0 — 22 passed, 0 failed, 0 skipped |
| React untouched | `^18.3.0` in manifest, 18.3.1 in lockfile, both sides of the install |
| No production module edited | `git diff` over `src/app`, `src/lib`, `src/hooks/useEvents.ts`, the three subject components — empty |
| Discovery | 23 files, identical before and after the config rewrite; 21 baseline paths all present, 0 dropped |
| Four revived suites in isolation | 31 passed, 0 skipped |

## Deviations from Plan

None in substance — the plan executed as written. Two mechanical adjustments were needed to satisfy the plan's own automated verifies, and both are worth recording because they are a reusable lesson rather than an incident:

**1. [Rule 3 — Blocking] A gate literal matched inside an explanatory comment**

- **Found during:** Task 1, then again in Task 2
- **Issue:** Task 1's verify greps `jest.config.js` for `passWithNoTests` and fails if found. The config comment explaining *why the flag is absent* named the flag, so the gate matched its own documentation. The identical thing happened in Task 2: the verify greps `useEvents.test.ts` for the two non-existent column names, and the comment citing AUDIT-19 named them.
- **Fix:** Both comments rewritten to describe the forbidden thing in prose — "no permissive no-tests-found flag", "the two separate day-and-clock columns this fixture used to carry". The substance of each comment is unchanged.
- **Verification:** Both task verifies exit 0; `grep -c 'passWithNoTests' jest.config.js package.json` prints 0 for both files.
- **Committed in:** `0556444` and `09d2934` (part of the task commits)

**2. [Rule 3 — Blocking] `jest.mock` hoisting vs. the enum import in FilterSidebar**

- **Found during:** Task 2
- **Issue:** Replacing the `"academic"` literal inside the `jest.mock` factory with `EventTag.ACADEMIC` introduces an ordering hazard. `jest.mock` is hoisted above the imports, and the factory is invoked while `FilterSidebar` is being required — before a `@/types` import placed *after* the component import would have run.
- **Fix:** `@/types` imported before `@/components/events/FilterSidebar`, with a comment stating why so nobody "tidies" the import order back.
- **Verification:** The suite's 4 tests pass.
- **Committed in:** `09d2934`

**Scope note.** The `Event` fixture in `useEvents.test.ts` was missing eleven required fields, not just the `Club` fixture's eight that the plan named. Both were completed against their interfaces. This is within the plan's explicit instruction ("repair fixtures to match the types … do not reach for a cast"), not an expansion of it.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking)
**Impact on plan:** None on scope or substance. Both were mechanical conflicts between a gate's grep and a comment's wording, resolved by rewording the comment rather than weakening the gate.

## Issues Encountered

**The plan's arithmetic under-predicted the result, in the right direction.** RESEARCH § A5 estimated ~251 passing. The actual is 278, because the estimate was built on the Phase 1 baseline of 220 and this phase's earlier batches had already taken the tree to 247. 247 + 31 = 278, and the 31 is exactly the sum of the per-suite Phase 1 skip counts (2 + 5 + 4 + 20). The estimate was a sizing figure and is labelled as such; the measured numbers are the ones recorded.

**The F-066 error count had already improved before it was measured.** The research recorded 86 errors across 10 files. The post-batch measurement is 68 across 6. The 14 `TS2339` diagnostics on `toBeInTheDocument`/`toHaveClass` disappeared once `@testing-library/jest-dom` and `jest.setup.ts` were in the program, and task 2 repaired 4 of the 5 genuine fixture drifts. Recorded as 86 → 68 rather than quietly restating the research figure.

**The batch-4 SIGSEGV did not recur.** Batch 4 logged an unexplained worker signal loss on `src/app/api/events/export/route.test.ts` and asked that batch 5 say whether it returned. Across roughly a dozen full runs in this batch, including the gate capture, it did not.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready.**

- The test harness is complete for the rest of Phase 2 and for Stage 3. Phase 3's Playwright persona harness and characterization slices now have a working DOM environment and a component-test idiom to follow.
- `jest.config.js`'s two projects are the place any future environment routing goes. Adding a third project (or routing another `.ts` directory to jsdom) is a one-line change in one file.

**Carried forward, explicitly:**

- **REFAC-10 (Phase 4)** owns the cursor contract question. `evidence/skipped-suite-disposition.md` § 3 names the three decisions and warns that the revived hook suite cannot adjudicate them.
- **F-066 is partially closed.** Plan 02-11 must record it as partial and quote § 4 of the disposition note, including the measured 68-across-6 figure. Phase 3 is the natural home for the remaining work, alongside REFAC-04's generated types.
- **STAB-09, STAB-11, STAB-13 remain Pending** with the reasons tabled above. 02-11 closes STAB-11 and STAB-13; STAB-09 needs the smoke pass its clause names.

---
*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-08*
*Completed: 2026-09-15*

## Self-Check: PASSED

All 9 created/modified artifacts verified present on disk. All 3 task commits verified in `git log`.
