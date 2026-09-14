---
phase: 01-read-only-foundation-audit
plan: 04
subsystem: testing
tags: [audit, baseline, jest, ts-jest, tsc, eslint, vitest-orphans, ci, skipped-suites, read-only]

# Dependency graph
requires:
  - phase: 01-01
    provides: "validate.mjs --check baseline (the AUDIT-13 gate, including its skip-reason bullet convention), readonly-guard.sh (the read-only exit criterion), baseline/versions.txt (ci_node_major=20 vs node_version=24.16.0), and the withheld-mark-complete precedent that AUDIT-13 would be closed by this plan"
  - phase: 01-03
    provides: "baseline/build.txt — the fifth baseline file --check baseline requires; this plan supplies the other four and the decision record"
provides:
  - "baseline/jest.txt — npx jest --ci --verbose captured verbatim: 5 skipped / 16 passed of 21 suites, 36 skipped / 220 passed of 256 tests, exit 0, plus the derived names of the five suites Jest refuses to print"
  - "baseline/jest-listtests.txt — npx jest --listTests, 21 test files, the denominator every later count is measured against"
  - "baseline/tsc.txt — npx tsc --noEmit (the exact CI command) at zero diagnostics, annotated with the tsconfig exclusions that make a clean result narrower than it reads"
  - "baseline/lint.txt — npm run lint at 12 warnings / 0 errors / exit 0, with --fix never run"
  - "baseline/test-runner-decision.md — the AUDIT-13 record: keep Jest, 14-to-0 mock-call evidence, one reason per skipped suite, and the four CI/script gaps as 01-13 finding candidates"
  - "The measured STAB-13 target: 220 passing tests in 16 executing suites with lint, type-check and build all at exit 0"
  - "STAB-08 sizing: un-skipping the four component/hook suites needs @testing-library/react + @testing-library/jest-dom + jest-environment-jsdom + an environment override + removal of the `{} as any` import stubs — four things, not one"
affects: [01-05, 01-13, 02-stabilization, STAB-08, STAB-13, CERT-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delimited-verbatim capture: the command's bytes are never touched, and everything appended sits below a labelled provenance fence that states it is not command output"
    - "Zero-byte output is still annotated: a capture file containing only `exit_code=0` is not evidence, so the empty result is delimited and its exclusions are spelled out"
    - "Derive what the tool refuses to print: Jest emits no reporter line for a fully-skipped suite, so the five are computed as a set difference and the derivation command is embedded in the artifact"
    - "Cite the captured file, never restate the number: every count in the decision record names the command that produced it and the file it can be re-read from"
    - "Size the remediation while the evidence is open: recording the second blocker (no jsdom environment) alongside the first (no testing-library) is what stops STAB-08 discovering it mid-slice"

key-files:
  created:
    - .planning/audit/baseline/jest.txt
    - .planning/audit/baseline/jest-listtests.txt
    - .planning/audit/baseline/tsc.txt
    - .planning/audit/baseline/lint.txt
    - .planning/audit/baseline/test-runner-decision.md
  modified: []

key-decisions:
  - "jest.txt is captured with --ci --verbose, but the provenance block states plainly that --verbose does NOT name the five fully-skipped suites. Jest 30 prints no PASS/FAIL line for a suite in which every test is skipped. The five are derived as the set difference between jest-listtests.txt (21 paths) and the 16 PASS lines, and the derivation one-liner is embedded in the artifact so a reviewer can re-run it rather than trust it."
  - "tsc.txt carries delimiters and a 20-line EXCLUSIONS block around a zero-byte result. The plan said capture verbatim; verbatim here is nothing at all, and a file whose entire content is `exit_code=0` cannot satisfy the must_have 'captured type-check output with its exclusions noted'. The captured bytes are still untouched — the annotation sits outside the fence."
  - "The skip reasons split into two kinds, and the artifact keeps them apart: four suites are blocked by a missing package (@testing-library/react), one — src/app/api/events/route.test.ts — is contract drift, because route.ts exists but no longer contains the word `cursor`. Conflating them would send STAB-08 to npm install for a problem npm cannot fix."
  - "Recorded a second blocker the plan did not ask for: jest.config.js sets testEnvironment 'node' globally and neither jest-environment-jsdom nor jsdom is installed, and no skipped file carries an @jest-environment docblock. Installing testing-library alone would leave all four suites still unable to run."
  - "AUDIT-13 IS marked complete, departing from the 01-01/01-03 withholding precedent. Every clause of the requirement is now satisfied by artifacts on disk — test/build/lint/type-check captures, Jest pass/skip counts, a reason per skipped suite, and the keep-Jest decision with its 14-vs-0 evidence — and `validate.mjs --check baseline` exits 0 with 9 passing rules. The precedent is to withhold when the artifacts contradict the claim, not to withhold reflexively."
  - "Nothing was installed and no skip was repaired. Converting a skipped suite into a passing one required a package install, which would mutate package.json and package-lock.json and end the phase's read-only exit criterion (threat T-01-04-02). The skips are handed to STAB-08 as sized work."

patterns-established:
  - "Provenance fence: an appended block that names the command, cwd, timestamp, toolchain, and — critically — states which of its own claims are derived rather than observed"
  - "Two-kind skip taxonomy (missing dependency vs contract drift) so the remediation plan is not uniformly wrong for one of them"
  - "Delete the tool's own byproduct: tsc --noEmit with incremental:true writes tsconfig.tsbuildinfo, which is gitignored and therefore INVISIBLE to readonly-guard.sh; it was deleted after each run so the tree is byte-identical, not merely guard-clean"

requirements-completed: [AUDIT-13]

# Metrics
duration: 9 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 04: Test, Type-Check and Lint Baseline Summary

**The AUDIT-13 green-gate baseline captured as literal command output — 220 passing tests across 16 of 21 Jest suites at exit 0, a clean `tsc --noEmit` whose exclusions are spelled out, 12 lint warnings, and a keep-Jest decision record carrying 14-to-0 mock-call evidence, a named reason for every one of the five skipped suites, and four CI/script gaps filed as finding candidates.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-14T07:33:00Z
- **Completed:** 2026-09-14T07:42:00Z
- **Tasks:** 2
- **Files created:** 5 (all under `.planning/audit/baseline/`)

## Accomplishments

- **"Green relative to what" now has an answer on disk.** Stage 2's STAB-13 exit criterion is measurable against a specific number rather than a memory: 16 suites executing, 220 tests passing, 36 skipped, `tsc --noEmit` at zero diagnostics, `eslint .` at 12 warnings and 0 errors, every file ending in its exit code.
- **Every skipped suite has a named, actionable reason,** split into the two kinds that need different fixes: four blocked by an uninstalled `@testing-library/react`, one (`src/app/api/events/route.test.ts`) blocked by contract drift — the route it tests no longer implements cursor pagination, so no install will revive it.
- **The keep-Jest decision is now re-readable instead of re-arguable.** 14 of 21 test files call the `jest.*` mock API, 0 call `vi.*`; `vitest` is absent from `package.json`, `package-lock.json` and `node_modules` while `vitest.config.ts` and `vitest.setup.ts` sit in the repo root; and `ts-jest@29.4.6`'s peer range (`jest: ^29 || ^30`) is satisfied by the installed `jest@30.2.0`, so the version-skew argument for switching does not apply here.
- **Four baseline gaps recorded as 01-13 finding candidates,** each with an evidence path: `ci.yml` runs lint + tsc + build but no test step, so all 21 suites never execute in CI; `ci.yml` pins Node 20 against a local Node 24.16.0; `package.json` declares no `test` script at all (`npm test` errors with `Missing script: "test"`); and `check:feedback` points at `scripts/check-feedback-loop.mjs`, which does not exist.
- **The read-only invariant held throughout.** `readonly-guard.sh` exited 0 after every external command, and the one byproduct a tool did generate — `tsconfig.tsbuildinfo`, gitignored and therefore invisible to the guard — was deleted so the tree is byte-identical to its pre-plan state.

## Task Commits

1. **Task 1: Capture the test, type-check and lint output verbatim** — `ea9fb08` (feat)
2. **Task 2: Record the test-runner decision and the reason for every skipped suite** — `fe0ebcb` (feat)

## Files Created

- `.planning/audit/baseline/jest.txt` (18.5 KB) — `npx jest --ci --verbose` verbatim. Test Suites: 5 skipped, 16 passed, 16 of 21 total. Tests: 36 skipped, 220 passed, 256 total. 2.652 s. `exit_code=0`. Provenance fence names the five skipped suites as a derivation and embeds the command that reproduces it.
- `.planning/audit/baseline/jest-listtests.txt` (1.7 KB) — `npx jest --listTests`, 21 absolute test-file paths, `exit_code=0`.
- `.planning/audit/baseline/tsc.txt` (2.0 KB) — `npx tsc --noEmit`, zero bytes of diagnostics, `exit_code=0`, with the EXCLUSIONS block explaining that all 21 test files, `vitest.config.ts`, `supabase/functions` and `internal/` are outside the type-check.
- `.planning/audit/baseline/lint.txt` (4.7 KB) — `npm run lint` verbatim: 12 problems, 0 errors, 12 warnings (3 `no-img-element`, 3 `react-hooks/exhaustive-deps` on `my-events`, 1 on `page.tsx`, 2 unused `eslint-disable` directives, 2 anonymous default exports in `load-tests/`), `exit_code=0`.
- `.planning/audit/baseline/test-runner-decision.md` (14 KB) — eight sections: the 14-to-0 evidence with the full 14-file list, the Vitest-orphan table, installed versions and peer compatibility, the pass/skip table, the per-suite skip table plus reason bullets, the four gaps, the type-check hole, and a reproduce block.

## Decisions Made

Recorded in the frontmatter `key-decisions` block. The two that will matter most downstream:

- **The five skipped suites are derived, not read.** Jest prints no reporter line for a fully-skipped suite and `--verbose` does not change that. Rather than leave a plausible-looking but unfounded claim in the artifact, `jest.txt` states the limitation explicitly and carries the set-difference one-liner that reproduces the list.
- **AUDIT-13 is marked complete,** unlike AUDIT-13/20 in 01-01 and AUDIT-04/16 in 01-03. Those were withheld because the artifacts contradicted the claim. Here they corroborate it: all five baseline files exist, `--check baseline` reports 9 passed / 0 failed, and every clause of the requirement text maps to a specific file section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `--verbose` does not make skipped suites individually visible; the artifact would have carried a false claim**

- **Found during:** Task 1 (jest capture)
- **Issue:** The plan directed a "reporter setting that prints per-suite status so skipped suites are individually visible", and the first provenance block I wrote asserted that `--verbose` achieved this. Inspecting the capture disproved it: `jest.txt` contains 16 `PASS` lines and zero lines naming any of the five skipped suites. Jest 30 omits fully-skipped suites from the reporter entirely. Shipping that sentence would have put an unverifiable claim into the phase's evidence base — the exact failure mode `T-01-04-04` exists to prevent.
- **Fix:** Rewrote the provenance block to state the limitation outright, derived the five suite paths as the set difference between `jest-listtests.txt` (21) and the `PASS` lines (16), listed them, and embedded the `node -e` one-liner that reproduces the derivation. Verified the embedded command runs and returns exactly those five paths.
- **Files modified:** `.planning/audit/baseline/jest.txt`
- **Verification:** Embedded derivation command executed from the repo root; output matches the five listed paths. Independently cross-checked against `describe.skip` call sites in `src/` — same five files.
- **Committed in:** `ea9fb08`

**2. [Rule 2 - Missing Critical] `tsc.txt` would have consisted solely of `exit_code=0`**

- **Found during:** Task 1 (tsc capture)
- **Issue:** `npx tsc --noEmit` emitted zero bytes. Following "capture verbatim, append the exit code" literally produced a 12-byte file. That passes `test -s` and the validator's `sizeOf > 0`, but it fails the plan's own must_have — "Captured type-check output **with its exclusions noted**" — and tells a reviewer nothing, least of all that a clean type-check here covers none of the 21 test files.
- **Fix:** Kept the captured bytes untouched inside explicit `--- begin/end verbatim ---` delimiters (with the zero-byte result stated as such), then appended an EXCLUSIONS block below the provenance fence listing `tsconfig.json`'s exclude array and its four consequences — chiefly that all 21 test suites are excluded from type-checking, and that `vitest.config.ts` is excluded precisely because its imports do not resolve.
- **Files modified:** `.planning/audit/baseline/tsc.txt`
- **Verification:** `tail -n1` is `exit_code=0`; `validate.mjs --check baseline` passes `baseline-file-non-empty`; the exclusion list was read from `tsconfig.json`, not transcribed from a planning doc.
- **Committed in:** `ea9fb08`

**3. [Rule 2 - Missing Critical] Second blocker on the four component/hook suites recorded beyond the plan's ask**

- **Found during:** Task 2 (skip-reason research)
- **Issue:** The plan's reason taxonomy was "a missing jsdom test environment, a missing testing-library package, or a config-level exclusion" — as alternatives. On this tree two of them apply at once to the same four files. `@testing-library/react` is absent, **and** `jest.config.js` sets `testEnvironment: 'node'` globally while `jest-environment-jsdom` and `jsdom` are also absent and no skipped file carries an `@jest-environment jsdom` docblock. Recording only the first reason would have led STAB-08 to install one package, re-run, and still find four red suites.
- **Fix:** The per-suite table gives each suite its primary reason; a separate paragraph records the shared second blocker and enumerates all four prerequisites for un-skipping, including removal of the `const { render, screen } = {} as any` import stubs that let the files compile today.
- **Files modified:** `.planning/audit/baseline/test-runner-decision.md`
- **Verification:** `[ -d node_modules/<pkg> ]` checked for `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, `jsdom`, `vitest`, `@vitejs/plugin-react` — all absent; `command grep -rn '@jest-environment' src/` returns nothing; skipped-test counts per suite (4+2+5+4+20=35) plus the one `it.skip` in `get-events.test.ts` reconcile exactly to Jest's reported 36.
- **Committed in:** `fe0ebcb`

**4. [Rule 2 - Missing Critical] Deleted the `tsconfig.tsbuildinfo` byproduct the guard cannot see**

- **Found during:** Task 1 (tsc capture)
- **Issue:** `tsconfig.json` sets `"incremental": true`, so `npx tsc --noEmit` writes a 364 KB `tsconfig.tsbuildinfo` at the repo root. It did not exist before this plan. Because `*.tsbuildinfo` is gitignored, `git status --porcelain` never reports it, so `readonly-guard.sh` exits 0 whether or not the file is there — the guard is structurally blind to it. Leaving it would have meant the tree was guard-clean but not unchanged.
- **Fix:** Deleted it after each of the two `tsc` runs, and recorded the behaviour in `tsc.txt`'s EXCLUSIONS block so the next plan that runs `tsc` knows to do the same. Confirmed neither `tsconfig.tsbuildinfo` nor `.eslintcache` existed before the plan started.
- **Files modified:** None tracked (removed an untracked, gitignored byproduct)
- **Verification:** `ls tsconfig.tsbuildinfo` → no such file; `readonly-guard.sh` exit 0; `git status --short` shows only the two pre-existing untracked paths (`docs/product-master-plan.md`, `.planning/research/.cache/…json`), neither touched.
- **Committed in:** n/a (no file change to commit)

**5. [Rule 2 - Missing Critical] `exit_code=` appended to `jest-listtests.txt` as well**

- **Found during:** Task 1
- **Issue:** The plan required the exit-code footer on `jest.txt`, `tsc.txt` and `lint.txt` but not on `jest-listtests.txt`, leaving one of the four captures without provenance for whether its command actually succeeded.
- **Fix:** Appended `exit_code=0` there too. Confirmed it does not disturb the acceptance criterion `grep -c '\.test\.'`, which still returns exactly 21.
- **Files modified:** `.planning/audit/baseline/jest-listtests.txt`
- **Verification:** `command grep -c '\.test\.' .planning/audit/baseline/jest-listtests.txt` → `21`.
- **Committed in:** `ea9fb08`

---

**Total deviations:** 5 auto-fixed (1 Rule 1 bug, 4 Rule 2 missing-critical)
**Impact on plan:** No scope change and no file written outside the plan's `files_modified` list. Deviation 1 removed a false claim from the phase's evidence base; deviations 2, 3 and 5 were each required to satisfy a `must_haves` clause or an acceptance criterion the literal reading would have left unmet; deviation 4 closed a blind spot in the phase's own read-only guard.

## Issues Encountered

- **`README.md`'s baseline row block is now stale in two ways, and was deliberately left alone.** It attributes `baseline/build.txt` to plan 01-04, but plan 01-03 already produced it (its `versions.txt` keys `build_exit_code` and `build_route_row_count` depend on it), and it has no row at all for `baseline/jest-listtests.txt`, which this plan created and which `test-runner-decision.md` cites as its file-count evidence. `README.md` is outside this plan's `files_modified` and the index is explicitly "finalized by plan 01-13". **Action for 01-13:** re-point the `build.txt` row to 01-03, add a `jest-listtests.txt` row, and flip all five baseline rows from `pending` to `present`.
- **`validate.mjs --quick` reports one FAIL that is not this plan's.** `endpoints :: no-residual-placeholders` fails with 2068 unclassified fields on `inventory/endpoints.json`. That is the expected pre-classification state — 01-02 produced signals, and `README.md` scopes classification to 01-11, which is why the weaker `--check endpoints-signals` gate exists. Pre-existing, unrelated to AUDIT-13, and deliberately not touched under the scope boundary.
- **The ugrep-shim caveat from 01-01 held for a third plan.** Every count in this plan's artifacts was produced with `command grep` or inside a Node one-liner. It is load-bearing here: the 14-to-0 comparison is the decision's entire evidentiary basis, and a shim that honours `.gitignore` and rejects some BRE patterns cannot be trusted to produce it.
- **`npm test` was run once, deliberately, to capture its failure** (`npm error Missing script: "test"`) as gap 3's reproduction. It wrote a debug log under `~/.npm/_logs/`, outside the repository; `readonly-guard.sh` exited 0 afterwards.

## User Setup Required

None — no external service configuration required. This plan ran entirely against the local toolchain.

## Next Phase Readiness

- **AUDIT-13 is closed.** `validate.mjs --check baseline` reports 9 passed / 0 failed, all five baseline files are present and non-empty, and `readonly-guard.sh` exits 0. This is the first requirement in the phase to be marked complete on the strength of its own artifacts rather than withheld.
- **Ready for 01-05** (dependency and dead-code analysis), which is the next plan in wave 2 and shares this plan's npm-invocation hazard: every npm command must be followed by the guard, and CI's Node 20 cannot run `dependency-cruiser@18.3.0`, a constraint gap 2 of the decision record now documents with evidence.
- **Handed to plan 01-13:** four finding candidates (`ci.yml` has no test step; `ci.yml` Node 20 vs local 24.16.0; no `test` script; broken `check:feedback` script), plus the stale `.claude/CLAUDE.md` Vitest claim corroborated here by three independent absence checks, plus the two `README.md` corrections listed under Issues.
- **Handed to Stage 2 (STAB-08 / STAB-13):** the exact green target (220 passing / 16 suites / three exit-0 commands), and a sized un-skip task — four packages and a config change for the component and hook suites, a test rewrite for `route.test.ts`, which no install can fix.
- **No blockers.**

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All 5 artifacts + SUMMARY.md verified present on disk with `[ -f ]`.
- All 3 commits verified in `git log`: `ea9fb08`, `fe0ebcb`, `cfce5dd`.
- `git diff --name-only 98ee836 HEAD` touches 6 files, all under `.planning/` — the phase's read-only exit criterion holds for this plan.
- `node .planning/audit/tools/validate.mjs --check baseline` exit 0 (9 passed, 0 failed).
- `bash .planning/audit/tools/readonly-guard.sh` exit 0.
