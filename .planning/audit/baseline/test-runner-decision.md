# Test Runner Decision — AUDIT-13

**Plan:** 01-04 · **Phase:** 01-read-only-foundation-audit · **Recorded:** 2026-09-14
**Status:** Recorded, not decided. The runner choice was locked before this phase began
(`01-RESEARCH.md` § Phase Constraints → Locked). This file exists so Stage 2's **STAB-08**
does not have to re-derive the evidence, and so the decision cannot be re-argued from memory.

> **Decision: keep Jest.** The Vitest configuration files are orphans and are slated for
> deletion in Stage 2 (STAB-08). Nothing in this phase deletes or edits them — Phase 1 is
> strictly read-only outside `.planning/`.

Every number below was produced by the command printed next to it, in this working tree,
on 2026-09-14. Nothing is transcribed from a planning document. Where a number came from a
captured file, the file is cited by path rather than restated as an assertion.

---

## 1. The 14-to-0 mock-call evidence

**14 to 0: the `jest.*` mock API is called in 14 of the 21 test files, the Vitest `vi.*` mock API in 0.**

**14 of the 21 test files call the Jest mock API (`jest.mock` / `jest.fn` / `jest.spyOn` /
`jest.clearAllMocks`); 0 files call the Vitest mock API (`vi.mock` / `vi.fn` / `vi.spyOn` /
`vi.mocked`). 14 to 0.** Migrating to Vitest would mean rewriting the mock surface of 14
files to gain nothing the current runner does not already do.

```bash
# Jest mock API — 14 files
command grep -rlE '\bjest\.(mock|fn|spyOn|clearAllMocks|resetAllMocks|requireActual|useFakeTimers|Mocked)' \
  --include='*.test.ts' --include='*.test.tsx' src/ | wc -l      # -> 14

# Vitest mock API — 0 files
command grep -rlE '\bvi\.(mock|fn|spyOn|clearAllMocks|resetAllMocks|importActual|useFakeTimers|mocked)' \
  --include='*.test.ts' --include='*.test.tsx' src/ | wc -l      # -> 0

# Not one test file even imports from vitest
command grep -rn "from ['\"]vitest" --include='*.test.ts' --include='*.test.tsx' src/ | wc -l   # -> 0
```

`command grep` is used deliberately: the `grep` on `PATH` in this environment is a ugrep
shim that honours `.gitignore` and rejects some BRE patterns (recorded in `01-01-SUMMARY.md`).
Counts taken with the shim are not trustworthy for this phase.

The 14 files, in full, so the count can be audited rather than believed:

| # | File | # | File |
|---|---|---|---|
| 1 | `src/__tests__/api/clubs/analytics.test.ts` | 8 | `src/app/api/events/export/route.test.ts` |
| 2 | `src/__tests__/api/events/analytics.test.ts` | 9 | `src/app/api/events/route.test.ts` |
| 3 | `src/__tests__/api/events/date-validation.test.ts` | 10 | `src/components/ErrorBoundary.test.tsx` |
| 4 | `src/__tests__/api/events/get-events.test.ts` | 11 | `src/components/events/EventFilters.test.tsx` |
| 5 | `src/__tests__/api/events/reviews.test.ts` | 12 | `src/components/events/FilterSidebar.test.tsx` |
| 6 | `src/__tests__/api/events/rsvp.test.ts` | 13 | `src/hooks/useEvents.test.ts` |
| 7 | `src/app/api/admin/analytics/users/route.test.ts` | 14 | `src/lib/exportUtils.test.ts` |

## 2. Vitest is not installed; its config files are orphans

| Claim | Command | Result | Evidence |
|---|---|---|---|
| `vitest` is absent from the manifest | `command grep -c '"vitest"' package.json` | `0` | `package.json` |
| `vitest` is absent from the lockfile | `command grep -c '"vitest"' package-lock.json` | `0` | `package-lock.json` |
| `vitest` is absent from `node_modules` | `[ -d node_modules/vitest ]` | false | working tree |
| `@vitejs/plugin-react` is absent | `[ -d node_modules/@vitejs/plugin-react ]` | false | working tree |
| `vitest.config.ts` exists anyway | `[ -f vitest.config.ts ]` | true | repo root |
| `vitest.setup.ts` exists anyway | `[ -f vitest.setup.ts ]` | true | repo root |

`vitest.config.ts` imports `vitest/config` and `@vitejs/plugin-react`; `vitest.setup.ts`
imports `@testing-library/jest-dom/vitest`. None of the three packages is installed, so
neither file can execute. `tsconfig.json` lists `vitest.config.ts` in its `exclude` array —
without that exclusion `npx tsc --noEmit` would fail on the unresolvable imports. The
exclusion is itself evidence that the orphan status is long-standing and already worked
around rather than fixed. See `.planning/audit/baseline/tsc.txt` § EXCLUSIONS.

**Stale-documentation cross-reference:** `.claude/CLAUDE.md` § Technology Stack still lists
**Vitest** as a framework of this project. It is not one. That is a Low-severity stale-docs
finding for plan 01-13, already noted in `01-RESEARCH.md` § State of the Art. This phase
records it; it does not edit the file.

## 3. Installed runner versions and peer compatibility

| Package | Range in `package.json` | Resolved in `node_modules` |
|---|---|---|
| `jest` | `^30.2.0` | `30.2.0` |
| `ts-jest` | `^29.4.6` | `29.4.6` |
| `@types/jest` | `^30.0.0` | installed |
| `typescript` | `^5.4.0` | `5.9.3` |

`ts-jest@29.4.6` declares `peerDependencies.jest: "^29.0.0 || ^30.0.0"` and
`peerDependencies.typescript: ">=4.3 <6"` (read with
`node -p "JSON.stringify(require('ts-jest/package.json').peerDependencies)"`).
The installed Jest 30 and TypeScript 5.9.3 both satisfy those ranges. **There is no
ts-jest/Jest major mismatch on this tree** — a version skew is sometimes offered as a reason
to switch runners, and it does not apply here. `jest.config.js` uses `preset: 'ts-jest'`,
`testEnvironment: 'node'`, the `^@/(.*)$` → `<rootDir>/src/$1` mapper, and ignores
`/node_modules/`, `/.claude/`, and `/supabase/functions/tests/`.

## 4. The baseline run — pass, fail, and skip counts

Parsed from `.planning/audit/baseline/jest.txt` (command `npx jest --ci --verbose`, exit 0):

| Dimension | Skipped | Passed | Failed | Total |
|---|---|---|---|---|
| Test suites | 5 | 16 | 0 | 21 |
| Tests | 36 | 220 | 0 | 256 |

Wall time 2.652 s. The suite file count is corroborated independently by
`.planning/audit/baseline/jest-listtests.txt` (`npx jest --listTests`), which enumerates
**21** test files — verify with
`command grep -c '\.test\.' .planning/audit/baseline/jest-listtests.txt`.

**This is evidence capture, not a gate.** `01-RESEARCH.md` § Validation Architecture is
explicit that the app suite is run once as an AUDIT-13 artifact. Stage 2's STAB-13 exit
criterion is measured against these numbers: 220 passing tests across 16 executing suites,
with lint, type-check, and build all at exit 0.

## 5. Why each suite does not run

Jest prints no reporter line at all for a suite in which every test is skipped, so the five
are derived as the set difference between `jest-listtests.txt` and the 16 `PASS` lines in
`jest.txt`; the derivation command is recorded in the provenance block of `jest.txt`.

| Suite | Skipped tests | Skip mechanism | Reason it does not run |
|---|---|---|---|
| `src/app/api/events/route.test.ts` | 4 | `describe.skip` at line 19 | **Contract drift, not a missing package.** The suite tests cursor-based pagination for `GET /api/events`; `src/app/api/events/route.ts` exists but contains zero occurrences of `cursor` (`command grep -c 'cursor' src/app/api/events/route.ts` → `0`). The route was rewritten and the tests were skipped rather than updated. Its own skip title says so: *"tests written for cursor-based route that no longer exists"*. |
| `src/components/ErrorBoundary.test.tsx` | 2 | `describe.skip` at line 45 | `@testing-library/react` is not installed (`[ -d node_modules/@testing-library/react ]` → false). The file compiles only because `render`/`screen`/`fireEvent`/`waitFor` are stubbed as `const { ... } = {} as any` in place of the real import. |
| `src/components/events/EventFilters.test.tsx` | 5 | `describe.skip` at line 8 | Same missing package, same `{} as any` import stub. |
| `src/components/events/FilterSidebar.test.tsx` | 4 | `describe.skip` at line 22 | Same missing package; the file's own comment also names `@testing-library/jest-dom` as missing. |
| `src/hooks/useEvents.test.ts` | 20 | `describe.skip` at line 54 | Same missing package. The file carries a `TODO: Rework` header naming `@testing-library/react` and `@testing-library/react-hooks` as the prerequisites for un-skipping. |
| `src/__tests__/api/events/get-events.test.ts` | 1 | `it.skip` at line 420 | **Not a skipped suite** — this suite passes; one test inside it is skipped for contract drift (`"only queries with eq('status','approved') — route no longer uses eq() for status filtering"`). It is the 36th skipped test: 4+2+5+4+20 = 35 in the five suites, plus this one. |

One reason bullet per skipped suite, in the form `validate.mjs --check baseline` counts:

- `src/app/api/events/route.test.ts` — skipped because the cursor-pagination contract it asserts was removed from the route; un-skipping requires rewriting the tests, not installing anything.
- `src/components/ErrorBoundary.test.tsx` — skipped because `@testing-library/react` is not installed.
- `src/components/events/EventFilters.test.tsx` — skipped because `@testing-library/react` is not installed.
- `src/components/events/FilterSidebar.test.tsx` — skipped because `@testing-library/react` and `@testing-library/jest-dom` are not installed.
- `src/hooks/useEvents.test.ts` — skipped because `@testing-library/react` (and per its own TODO, `@testing-library/react-hooks`) is not installed.
- `src/__tests__/api/events/get-events.test.ts` — one `it.skip` inside an otherwise passing suite, skipped for the same kind of contract drift as `route.test.ts`.

**A second blocker the four component/hook suites share, which installing a package alone
will not clear:** `jest.config.js` sets `testEnvironment: 'node'` globally, and
`jest-environment-jsdom` and `jsdom` are both absent from `node_modules`. None of the four
files carries an `@jest-environment jsdom` docblock (`command grep -rn '@jest-environment' src/`
returns nothing). Un-skipping them in Stage 2 therefore needs `@testing-library/react`,
`@testing-library/jest-dom`, `jest-environment-jsdom`, a per-file or per-project environment
override, **and** removal of the `{} as any` import stubs. That is STAB-08's scope, sized here
so it is not discovered mid-slice.

**Nothing was installed to make any of this pass.** Per the plan's threat register
(`T-01-04-02`), installing a test-environment package to convert a skip into a pass would
have mutated `package.json` and `package-lock.json` and broken the phase's read-only exit
criterion. `readonly-guard.sh` exits 0 after every capture in this plan.

## 6. Baseline gaps — finding candidates for plan 01-13

These are not opinions about the baseline; they are properties of it, each with a path a
reviewer can open.

| # | Gap | Evidence | Why it matters |
|---|---|---|---|
| 1 | **CI never runs the tests.** `.github/workflows/ci.yml` has exactly four steps after checkout and `npm ci`: `npm run lint`, `npx tsc --noEmit`, `npm run build`. There is no test step. | `.github/workflows/ci.yml`; `.planning/audit/baseline/jest-listtests.txt` | All 21 suites — the 16 that pass and the 5 that are skipped — never execute in CI. A test that never runs in CI cannot protect a merge, so today's 220 passing tests are a local-only signal. STAB-13 cannot be enforced automatically until a test step exists. |
| 2 | **CI pins a Node major older than the local runtime.** `ci.yml` sets `node-version: 20`; this machine is Node 24.16.0 (`baseline/versions.txt` keys `ci_node_major` and `node_version`). | `.github/workflows/ci.yml`; `.planning/audit/baseline/versions.txt` | Two-major runtime split between the gate and the developer. It also bounds this audit: `dependency-cruiser@18.3.0` requires `^22 \|\| ^24 \|\| >=26`, so plan 01-05's tooling could not run on CI's Node at all and must run locally. |
| 3 | **`package.json` declares no `test` script.** `npm test` fails with `npm error Missing script: "test"`. | `package.json`; reproduce with `npm test` | There is no discoverable entry point for the suite. Every invocation in this audit is `npx jest ...` for that reason, and the absence is itself part of the baseline — it is the most likely reason gap 1 was never noticed. |
| 4 | **`check:feedback` is a broken npm script.** `package.json` declares `"check:feedback": "node scripts/check-feedback-loop.mjs"`, but `scripts/` contains only `fix-instagram-images.ts`, `platform-analytics.ts`, and `upload-images.ts`. | `package.json`; `ls scripts/` | A declared script that cannot execute is dead config — Low severity, but it misleads anyone reading `package.json` for the project's checks, and it was surfaced independently during pattern mapping (`01-PATTERNS.md` § Incidental Findings). |

## 7. What a clean type-check does not cover

`tsconfig.json` excludes `**/*.test.ts` and `**/*.test.tsx` (along with `node_modules`,
`demo-video`, `internal`, `supabase/functions`, and `vitest.config.ts`). **The 21 test files
are therefore never type-checked by `npx tsc --noEmit`** — the command CI runs and the
command captured in `.planning/audit/baseline/tsc.txt`. Type errors in test code surface only
through ts-jest at run time, and only for the 16 suites that actually execute; the 5 skipped
suites are type-checked by neither path. This is a pre-existing hole, recorded here because
"type-check is green" is otherwise read as covering more than it does.

## 8. Reproduce this file

```bash
npx jest --listTests                      # 21 test files
npx jest --ci --verbose                   # 5 skipped / 16 passed suites, 36 skipped / 220 passed tests
npx tsc --noEmit                          # zero diagnostics, exit 0
npm run lint                              # 12 warnings, 0 errors, exit 0
bash .planning/audit/tools/readonly-guard.sh
node .planning/audit/tools/validate.mjs --check baseline
```

Captured artifacts this file cites: `baseline/jest.txt`, `baseline/jest-listtests.txt`,
`baseline/tsc.txt`, `baseline/lint.txt`, `baseline/build.txt` (captured by plan 01-03),
`baseline/versions.txt`.
