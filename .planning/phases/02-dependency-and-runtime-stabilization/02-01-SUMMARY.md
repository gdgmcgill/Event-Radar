---
phase: 02-dependency-and-runtime-stabilization
plan: 01
subsystem: infra
tags: [nodejs, nvmrc, npm, jest, github-actions, ci, typescript, types-node, vitest-removal, toolchain]

# Dependency graph
requires:
  - phase: 01-read-only-foundation-audit
    provides: "baseline/versions.txt (node 24.16.0, ci_node_major=20), baseline/jest.txt (220 passed / 36 skipped / 16 of 21 suites), baseline/tsc.txt (0 diagnostics), baseline/lint.txt (12 warnings / 0 errors), baseline/build.txt (exit 0) — the AUDIT-13 reference numbers every gate in this plan is measured against; baseline/test-runner-decision.md — the recorded Keep-Jest decision and its 14-to-0 mock-call evidence"
provides:
  - "A single declared Node major (24) read by three consumers that cannot disagree: .nvmrc, package.json engines, and .github/workflows/ci.yml via node-version-file"
  - "`npm test` and `npm test:ci` scripts — the suite has a discoverable entry point for the first time"
  - "A CI `Run tests` step, so the 220 passing tests gate a pull request instead of being a local-only signal"
  - "@types/node on ^24, matching the pinned runtime, with a written STAB-10 migration note"
  - "The batch-0 gate captured as four verbatim command logs with provenance blocks — the reference every later Phase 2 batch is diffed against"
  - "A repository free of Vitest and Playwright residue, in the working tree and in git"
affects: [02-02, 02-03, 02-05, 02-09, 02-11, all-later-phase-2-batches, phase-03-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node major declared once in .nvmrc and read by every consumer (engines pins the same major; CI reads the file, never a literal)"
    - "Batch gate: lint -> tsc -> test -> build, all four exit 0, captured verbatim with a provenance block before the batch is considered closed"
    - "Lockfile reconciliation: shasum -a 256 before, npm install --package-lock-only, read git diff --stat, then npm ci — never a bare npm install, never npm audit fix, never a lockfile delete"

key-files:
  created:
    - .nvmrc
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/types-node-major-note.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b0.before.sha256
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-lint.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-tsc.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-jest.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-build.txt
  modified:
    - package.json
    - package-lock.json
    - .github/workflows/ci.yml
    - tsconfig.json
    - .gitignore
  deleted:
    - vitest.config.ts
    - vitest.setup.ts
    - test-results/.last-run.json

key-decisions:
  - "Node 24 is pinned as `24.x` in engines rather than `>=24` — `24.x` is the form Vercel maps to the latest 24.x release line, and engines.node overrides the Vercel project dashboard's Node.js Version setting, making the repository the single source of truth"
  - "CI reads `node-version-file: '.nvmrc'` rather than repeating the major as a literal, so the version cannot drift between the repo and the gate"
  - "@types/node 20 -> 24 is the only major-version bump in all of Phase 2, and it is forced by the runtime pin rather than elected; it produced zero new tsc diagnostics and zero source changes"
  - "The `test` script is plain `jest` with NO --passWithNoTests: Jest 30 exits 1 when it matches no tests, and a config error that made Jest match nothing must never report green in CI"
  - "The `npm audit --audit-level=high --omit=dev` CI step was deliberately NOT added in this batch — it exits 1 on this tree today and would red-light every PR from now through batch 5; it lands last, in plan 02-09"
  - "tsconfig.json keeps excluding **/*.test.ts and **/*.test.tsx. Only the dangling `vitest.config.ts` entry was removed. Un-excluding the test files is F-066's criterion, produces 86 errors across 10 files, and is out of scope for Phase 2 (RESEARCH Open Question 3)"
  - "STAB-02's CI half is recorded as `ci_npm_unknown_config=unobserved` with two verified reasons rather than guessed — the batch-0 commits are unpushed, and the most recent completed CI run's logs have been expired by GitHub (HTTP 410). No repository edit was invented to 'fix' a machine-state warning"

patterns-established:
  - "Single-source version declaration: one file holds the value, every consumer reads that file rather than restating it"
  - "Evidence capture discipline: verbatim combined stdout+stderr, then an appended `# ===` provenance block naming command / cwd / captured_at / toolchain and a final bare exit_code line; baseline deltas recorded as key=value lines so they can be diffed, not read"
  - "Open questions are answered in writing with the reason, including when the answer is 'unobserved' — an unanswerable question gets its blockers recorded, not a silent omission"

requirements-completed: [STAB-01, STAB-10]
requirements-advanced-not-completed: [STAB-02, STAB-08, STAB-13]  # see "Requirements Status Correction" — each is only partially satisfied by this plan

# Metrics
duration: 14min
completed: 2026-09-14
status: complete
---

# Phase 02 Plan 01: Toolchain Floor (Batch 0a) Summary

**Node 24 pinned once in `.nvmrc` and read by `engines` and CI, `npm test` created and wired into the pull-request gate for the first time, `@types/node` raised to ^24, and the Vitest/Playwright residue deleted — with all four batch-gate commands captured verbatim at exit 0.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-09-15T03:36Z
- **Completed:** 2026-09-15T03:50:41Z
- **Tasks:** 3 of 3
- **Files modified:** 14 (7 created, 5 modified, 3 deleted)

## Accomplishments

- **CI now runs the tests.** `.github/workflows/ci.yml` gained a `Run tests` step between type-check and build. Before this plan, `package.json` declared no `test` script at all (`npm test` → `npm error Missing script: "test"`), so CI's lint/type-check/build gate had never once executed the 220 passing tests. That was F-065's core defect and it is closed.
- **One Node major, three consumers, no way to disagree.** `.nvmrc` holds `24`; `package.json` `engines.node` is `24.x`; CI reads `node-version-file: '.nvmrc'` instead of the literal `node-version: 20` it carried before. The two-major split between the gate (Node 20) and the developer (Node 24.16.0) recorded in `baseline/versions.txt` is gone. This also clears the hard prerequisite for batch 5: `@testing-library/jest-dom@7` declares `engines.node >= 22`.
- **`@types/node` 20 → 24 landed with zero fallout.** 0 tsc diagnostics before, 0 after, no source change, 46 lockfile lines moved, 0 new package names. The forced-not-elected rationale, the before/after diagnostic counts, and the "only major in Phase 2" scope statement are written up in `evidence/types-node-major-note.md` (STAB-10).
- **Two test runners' worth of dead config deleted.** `vitest.config.ts`, `vitest.setup.ts`, and `test-results/.last-run.json` are gone from the tree and from git, along with the `check:feedback` script pointing at a file that does not exist and the now-dangling `tsconfig.json` exclude entry that existed only to keep `tsc` green over an orphan. STAB-08's deletion clause plus all of F-064.
- **The batch-0 gate is evidence, not a claim.** Four verbatim captures with provenance blocks, every number identical to the AUDIT-13 baseline: lint 12 warnings / 0 errors, tsc 0 diagnostics, jest 220 passed / 36 skipped / 16 of 21 suites / 0 failures, build exit 0 on a cold `rm -rf .next` run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin Node 24 across engines, .nvmrc, CI, and @types/node** — `1e2647e` (chore)
2. **Task 2: Add the test scripts, wire CI to run them, and delete the two-runner residue** — `3eeaa2a` (chore)
3. **Task 3: Capture the batch-0 gate evidence and confirm the CI npm config surface** — `6a08405` (docs)

**Plan metadata:** see the `docs(02-01): complete toolchain floor plan` commit.

## Files Created/Modified

**Created**
- `.nvmrc` — contains `24`. Single source of truth for the Node major; fnm reads it locally, `actions/setup-node` resolves the bare major to the latest 24.x.
- `evidence/types-node-major-note.md` — STAB-10 migration note for the `@types/node` 20 → 24 major: the forcing rationale, the before/after consumer table, the 0-to-0 diagnostic count with its two honest caveats (test files excluded from tsc, `skipLibCheck: true`), the lockfile impact, and the scope statement that this is Phase 2's only major.
- `evidence/lock.b0.before.sha256` — `35b2d002…f0ff72`, recorded before the manifest was touched.
- `evidence/batch-00-lint.txt`, `batch-00-tsc.txt`, `batch-00-jest.txt`, `batch-00-build.txt` — the four gate captures.

**Modified**
- `package.json` — added `engines` (`node: 24.x`, `npm: >=11`); `@types/node` `^20.11.0` → `^24.13.4`; added `test: jest` and `test:ci: jest --ci`; removed the broken `check:feedback` script.
- `package-lock.json` — reconciled with `npm install --package-lock-only`. 46 lines changed (12 insertions, 34 deletions), `lockfileVersion` unchanged, 0 new package names. `@types/node` resolved 20.19.25 → 24.13.4.
- `.github/workflows/ci.yml` — `Setup Node.js` switched from `node-version: 20` to `node-version-file: '.nvmrc'`; new `Run tests` step (`npm test`) inserted between `TypeScript type-check` and `Run build`.
- `tsconfig.json` — removed the `"vitest.config.ts"` exclude entry. Every other entry, including `**/*.test.ts` and `**/*.test.tsx`, left untouched.
- `.gitignore` — added `test-results/` under the existing `# testing` section.

**Deleted**
- `vitest.config.ts` — imported `vitest/config` and `@vitejs/plugin-react`, neither installed anywhere in the tree.
- `vitest.setup.ts` — imported `@testing-library/jest-dom/vitest`, not installed.
- `test-results/.last-run.json` — asserted `{"status":"failed"}` from a Playwright installation that does not exist.

All three deletions were intentional and are the explicit subject of STAB-08 and F-064. No unexpected deletion occurred: `git diff --diff-filter=D HEAD~1 HEAD` on the evidence commit is empty, and the deletions in `3eeaa2a` are exactly the three named files.

## Decisions Made

Beyond the decisions transcribed into frontmatter above, two are worth expanding because a later reader will otherwise wonder:

**Why the batch's changes span three commits when the batch gate says "exactly one".** The batch-gate rule is that *a batch's manifest + lockfile change* lands in one commit — its purpose is to make the lockfile diff reviewable as a single atomic unit. That is honoured exactly: `1e2647e` is the only commit in this plan that touches `package-lock.json`, and it carries the dependency change. `3eeaa2a` touches `package.json` scripts with a zero-line lockfile diff, and `6a08405` touches only `.planning/`, which the rule explicitly permits to be separate. Every commit body carries the batch id, the manifest lines changed, the lockfile diff line count, and the gate results known at that point, as the rule requires.

**Why nothing was done about the npm unknown-config warning.** RESEARCH Open Question 5 asks whether CI's `Install dependencies` step emits one. It could not be observed (see below), and — critically — it must not be "fixed" speculatively. There is no `.npmrc` in this tree, `npm config list` prints zero key=value lines from any of npm's four scopes, and `npm config get devdir` returns `undefined`. The warning, if it exists, is a property of a machine, not of this repository. Editing the repo would have invented a fix for a defect the repo does not have.

## Requirements Status Correction

The plan's frontmatter lists `requirements: [STAB-01, STAB-02, STAB-08, STAB-10, STAB-13]`, and the
state tooling marked all five Complete in `REQUIREMENTS.md`. **Three of those five were reverted to
Pending, because this plan only partially satisfies them.** In a program whose stated core value is
that workflows are *verified* rather than claimed, a traceability table that says Complete when the
requirement's own text is half-unmet is a correctness defect, so it was corrected rather than left.

| Req | Marked | Why |
|---|---|---|
| STAB-01 | **Complete** | Its text is fully met: Node and npm pinned in `engines` and `.nvmrc`, and CI uses the same major by reading `.nvmrc`. The "matched to the Vercel runtime" clause holds because `engines.node` overrides the dashboard; the dashboard value is carried as a user-setup item. |
| STAB-10 | **Complete** | Its text is fully met for the one major that exists: `@types/node` 20→24 landed as its own change, with a migration note (`evidence/types-node-major-note.md`) and its own smoke pass (the four-command gate). Reopens only if a later batch discovers a second major — plan 02-11 re-checks. |
| STAB-02 | reverted to **Pending** | "resolved **or its source documented**". Only the local half is documented. The CI half is recorded as `ci_npm_unknown_config=unobserved` with its blockers. Plan 02-03 owns the local half and carries the combined answer. |
| STAB-08 | reverted to **Pending** | Its text has four clauses. Two are met (vitest files deleted; `test` script exists and CI runs it). Two are **not**: `jest-environment-jsdom` and the testing-library packages are not installed, and the skipped `.tsx` suites therefore still do not run. That is batch 5's scope, explicitly deferred by this plan. |
| STAB-13 | reverted to **Pending** | True at this commit (all four checks are at or better than the AUDIT-13 baseline), but STAB-13 is a **phase exit criterion**, not a per-batch one. It can only be honestly closed once the last batch's gate is green, in plan 02-11. Closing it now would mean every subsequent batch is measured against an already-ticked box. |

## Deviations from Plan

One deviation, and it is a bookkeeping correction rather than a code change:

**1. [Rule 1 — Bug] Reverted three prematurely-completed requirements in REQUIREMENTS.md**
- **Found during:** the state-update step after Task 3
- **Issue:** `requirements.mark-complete` faithfully marked all five IDs from the plan's frontmatter, but STAB-02, STAB-08, and STAB-13 are each only partially satisfied by batch 0a (details in the table above). The traceability table and checkboxes would have asserted work that has not happened.
- **Fix:** Reverted the checkbox and the traceability-table status for STAB-02, STAB-08, and STAB-13 to Pending; left STAB-01 and STAB-10 Complete. Documented the split in this summary so the reason survives.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `grep -nE '^\| STAB-(01|02|08|10|13) \|' .planning/REQUIREMENTS.md` shows Complete / Pending / Pending / Complete / Pending
- **Committed in:** the plan-metadata commit

---

**Total deviations:** 1 auto-fixed (1 Rule 1 correctness fix, in planning metadata only)
**Impact on plan:** None on scope or code. No source file, dependency, or configuration was affected. The correction makes the requirements record match what was actually built.

### Plan execution itself

The three tasks ran exactly as written. No Rule 2, 3, or 4 situation arose. No auto-fix was required, no architectural question arose, no authentication gate was hit, and no checkpoint was reached.

The plan's phase-locked constraints were all held:

| Constraint | Held? | Evidence |
|---|---|---|
| 1. `react`/`react-dom` never touched | yes | `git diff -- package.json \| grep -cE '^[+-].*"react(-dom)?"'` → 0 |
| 2. No `npm audit fix --force`; lockfile reconciled, never regenerated | yes | only `npm install --package-lock-only` then `npm ci` were run; `lockfileVersion` unchanged |
| 3. `.env.local` never read/written; no secret values in `.planning/` | yes | no `.env*` path appears in any of the three commits |
| 4. No migration replay, no `supabase db push`, no DB operation | yes | no file under `supabase/` touched; no database command run |
| 5. `shasum -a 256`, not `sha256sum` | yes | `evidence/lock.b0.before.sha256` produced with `shasum -a 256` |
| 6. Zero-dependency tooling — no tool added to `package.json` | yes | `tech-stack.added` is empty; the only dependency change is a version move on an already-declared package |
| 7. No behaviour changes | yes | no file under `src/` modified; the `middleware`→`proxy` deprecation and the caniuse-lite staleness notice in the build output are pre-existing and were left alone |

## Issues Encountered

**1. The plan's own verifier regex tripped on my provenance prose.** Task 3's verification greps the whole of `batch-00-jest.txt` for `/\d+ failed/` as a failing-run detector. My first draft of the provenance block contained the sentence *"the Tests: line is the authority, and it reports 0 failed"* — literally true, and it matched the failure regex. The verifier correctly reported `jest:failures`. Resolved by rewording the prose to "its failure count is zero" and leaving an inline note in the file explaining why that phrasing is deliberate, so a future editor does not reintroduce the collision. The captured Jest output itself was never modified; only my appended commentary was. Re-ran the verifier clean.

**2. STAB-02's CI half could not be observed, and both fallbacks were exhausted.** The question needs a real CI run's `Install dependencies` log. (a) This plan does not push, and local `main` is many commits ahead of `origin/main` (`6f9c3b7`), so no batch-0 run exists. (b) The most recent completed run — `26121379844`, CI / main / push, success, 2026-05-19 — cannot substitute either: `gh run view 26121379844 --log` returns `failed to get run log: HTTP 410`, GitHub having expired its logs. Recorded as `ci_npm_unknown_config=unobserved` with both blockers written out, plus the three local-side facts, so plan 02-03 (which owns STAB-02's local half) can carry the combined answer without re-deriving anything.

## Verification Results

All plan-level verification criteria pass:

| Criterion | Result |
|---|---|
| `npm run lint` exit 0, 0 errors, ≤12 warnings | PASS — exit 0, 12 warnings, 0 errors (baseline-identical) |
| `npx tsc --noEmit` exit 0 with no output | PASS — exit 0, 0 bytes |
| `npm test -- --ci` exit 0, ≥220 passing, 0 failing | PASS — 220 passed, 36 skipped, 16 of 21 suites, 0 failures |
| `npm run build` exit 0 | PASS — exit 0, cold build after `rm -rf .next`, "✓ Compiled successfully" |
| `npm ci` from the reconciled lockfile exit 0 | PASS |
| lockfile `git diff --stat` read and line count recorded in the batch commit body | PASS — 46 lines, recorded in `1e2647e` |
| No file under `src/`, `supabase/`, or `.env*` modified | PASS — `git diff --name-only 506141f..HEAD` contains no such path |

The plan's three per-task automated verification scripts all print their success sentinel: `STAB-01 OK`, `STAB-08 batch-0 OK`, `batch-00 evidence OK`.

## Known Stubs

None. This plan wrote no application code — no file under `src/` was touched. There is no placeholder value, empty-array default, or unwired data source introduced anywhere.

## Threat Flags

None. No network endpoint, auth path, file-access pattern, or schema change was introduced. The plan's own threat register (`T-02-01-01` through `T-02-01-SC`) is satisfied as written: the lockfile was hashed before the edit and its diff read before `npm ci` (`T-02-01-01`); only lint/tsc/jest/build output — none of it credentialed — was committed to `.planning/` (`T-02-01-04`); and the Vercel dashboard divergence is written down as a user-setup item rather than assumed away (`T-02-01-05`).

## User Setup Required

One item, carried from the plan's `user_setup` block and still outstanding:

**Vercel — read (and optionally set to 24.x) the Node.js Version setting.**
Location: Vercel Dashboard → Project (uni-verse) → Settings → General → Node.js Version.

This is *not* blocking. `engines.node: "24.x"` in `package.json` overrides the dashboard value, so Vercel builds will use Node 24 regardless of what the setting currently reads. The reason to look anyway is bookkeeping: `02-RESEARCH.md` assumption A1 records the dashboard value as unobserved, and Vercel disables Node 20 on 2026-10-01. Reading it once converts an assumption into a fact and confirms the override is doing what this plan claims.

## Next Phase Readiness

**Ready.** Batch 0a's whole purpose was to put an automated net under everything that follows, and the net is up:

- Every later Phase 2 batch can now run the same four-command gate and diff its numbers against `evidence/batch-00-*.txt`. A regression introduced by a dependency bump will show as a delta against a captured reference rather than a vague sense that something broke.
- The Node 24 pin unblocks batch 5's test-harness install (`@testing-library/jest-dom@7` needs `engines.node >= 22`).
- The lockfile reconciliation ritual (hash → `--package-lock-only` → read `--stat` → `npm ci`) has been executed once end-to-end and is proven on this tree.

**Carried forward, deliberately open:**

- **F-066 is only partially addressed.** The `tsconfig.json` test-file exclusion stands. Plan 02-11's completion note must record F-066 as *partially* closed, not claimed — un-excluding the 21 test files produces 86 errors across 10 files and is out of Phase 2's scope.
- **STAB-02 is half-answered.** `ci_npm_unknown_config=unobserved`; plan 02-03 owns the local half and carries the combined answer. If someone pushes this branch before 02-03 runs, the CI half becomes observable and the value in `batch-00-jest.txt` should be updated in place rather than left stale.
- **The `npm audit` CI gate is intentionally absent.** It exits 1 on this tree today (42 vulnerabilities: 2 low, 14 moderate, 23 high, 3 critical, as reported by `npm install --package-lock-only`). It lands in plan 02-09, last, once the batches ahead of it have brought the tree down to something the gate can pass.
- **5 Jest suites remain skipped** (35 tests) plus one `it.skip` (the 36th). Un-skipping is batch 5's scope and needs `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, a per-project environment override, and removal of the `{} as any` import stubs.

---
*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-01*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 8 claimed-created files exist on disk; all 3 claimed-deleted files are absent from the
tree and from `git ls-files`; all 3 task commit hashes (`1e2647e`, `3eeaa2a`, `6a08405`)
resolve in `git log`.
