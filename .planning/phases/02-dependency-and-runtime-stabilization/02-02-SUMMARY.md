---
phase: 02-dependency-and-runtime-stabilization
plan: 02
subsystem: testing
tags: [jest, ts-jest, next-16, middleware, proxy, rate-limiting, characterization-testing, shell, curl, zero-dependency-tooling]

# Dependency graph
requires:
  - phase: 01-read-only-foundation-audit
    provides: "The AUDIT-13 baseline captures (baseline/jest.txt, lint.txt, tsc.txt, versions.txt) that check-baseline.mjs parses its reference numbers out of, plus the validate.mjs / cache-probe.sh / readonly-guard.sh tooling precedents"
  - phase: 02-dependency-and-runtime-stabilization
    provides: "Plan 02-01's toolchain floor — Node 24 pinned across engines/.nvmrc/CI, the `npm test` script the comparator's jest check shells out to, and the Vitest residue removal"
provides:
  - "src/middlewareRateLimit.test.ts — 8 passing assertions locking the rate limiter's 429 budget, Retry-After header, /api/admin bypass, high-frequency write budget, non-/api pass-through and exact budget boundary"
  - "src/middleware.test.ts — 19 passing assertions locking the matcher's include set (8 PROTECTED_ROUTES + 5 public paths) and exclude set (6 paths) through Next's own matcher compiler"
  - "evidence/tools/check-baseline.mjs — one command that answers 'is this tree at or better than AUDIT-13', across 7 checks tagged STAB-13/01/10/05/11"
  - "evidence/tools/majors.b0.json — the batch-0 dependency-major, react-range and lockfileVersion snapshot the drift checks compare against"
  - "scripts/smoke.sh — the Tier 2 anonymous HTTP smoke pass, 10 named rows, in-pipeline redaction"
  - "evidence/smoke.b0.txt — the batch-0 smoke capture: 9/10 total, ring rows 4/4"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, phase-03-playwright-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Characterization-before-change: the assertions that guard an irreversible rename are written, run and committed against the unmodified subject first"
    - "Reference numbers are parsed from committed captures at run time, never inlined as literals"
    - "Ring rows vs data rows: a smoke script separates request-path assertions from environment-dependent ones so a limited environment is named, not absorbed"

key-files:
  created:
    - src/middlewareRateLimit.test.ts
    - src/middleware.test.ts
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/majors.b0.json
    - scripts/smoke.sh
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b0.txt
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "STAB-06 is characterized before the rename, not after: 27 assertions pass on unmodified production source, so batch 3 has a real before to diff against"
  - "The matcher test imports unstable_doesMiddlewareMatch and the literal unstable_doesProxyMatch is banned from the file by an automated gate — the documented proxy-named export exists in neither 16.2.1 nor 16.3.5"
  - "check-baseline.mjs parses every reference number out of .planning/audit/baseline/ at run time; a grep for 220/256/36 in the file returns 0, and a missing capture is a hard FAIL under --check"
  - "majors.b0.json records b0_commit, so lockfile-discipline scans exactly <b0>..HEAD rather than an eyeballed phase range"
  - "smoke.sh splits its summary into ring rows (5 6 8 10) and data rows (1 2 3 4 7 9) so an environment-limited failure is named rather than silently absorbed"
  - "Smoke row 2 FAILS on this environment and the expectation was NOT lowered: the connected Supabase project returns total=0 approved upcoming events"
  - "Row 5's Location is percent-encoded (next=%2Fprofile); smoke.sh decodes %2F before asserting instead of weakening the assertion to a prefix match"
  - "STAB-06/09/13 reverted to Pending after mark-complete, following the 02-01 precedent — this plan builds the instruments that will answer those requirements and satisfies none of them"

patterns-established:
  - "PRESERVE suite: a test file whose top-level describe states that its job is to behave identically after a named future change, with the reason recorded in the file-level JSDoc"
  - "Constants-from-source: a test reads its magic numbers out of the subject and records them as SCREAMING_SNAKE module constants with a source-line comment, because a plan can go stale and the source cannot"
  - "Fragment-built detector regexes: a tool that greps for a forbidden command builds the pattern from parts so it is not its own first false positive"
  - "Status-file exit propagation: a shell script whose whole body is piped through a redactor hands its failure count back through a temp file, because the pipe puts the body in a subshell"

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 02: Batch 0b — The Three Instruments Summary

**Two PRESERVE characterization suites locking the rate limiter's 429 budget and the matcher's include/exclude sets against unmodified source, a zero-dependency 7-check STAB-13 comparator that parses its reference numbers out of the Phase 1 captures, and a 10-row anonymous HTTP smoke script whose four request-path rows pass green today.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-15T03:48:00Z
- **Completed:** 2026-09-15T04:10:00Z
- **Tasks:** 3
- **Files created:** 6 (plus 3 planning files modified)

## Accomplishments

- **The batch-3 rename now has a before.** `src/middleware.ts` is this application's only page-level authentication ring and Next 16 hard-throws if `middleware.*` and `proxy.*` coexist, so the rename is one atomic commit with no halfway point to inspect. 27 assertions across two suites now record today's behaviour as passing facts. Plan 02-06 can diff `✓` lines instead of asserting equivalence.
- **STAB-13 is answerable by one command.** `node evidence/tools/check-baseline.mjs` runs 7 checks and exits 0 with `--- 21 passed, 0 failed, 0 skipped` on this tree, reading the baseline pass/skip/suite counts, the eslint warning ceiling and the dependency-major snapshot out of files rather than out of literals.
- **"A smoke pass" is now a command with captured, redacted output.** Ten named rows, each printing the value it actually saw. Ring rows 5, 6, 8 and 10 — the two protected-route redirects, the 31-POST 429, and the `/_next/static` exclusion — are 4/4 green against `npm run dev`.
- **Nothing was added to `package.json`.** Both tools are invoked by path, and the comparator asserts its own absence from the manifest.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the two STAB-06 characterization suites** — `c7c5c49` (test)
2. **Task 2: Build the zero-dependency STAB-13 baseline comparator** — `a7058f2` (chore)
3. **Task 3: Write the Tier 2 anonymous HTTP smoke script** — `2060091` (chore)

**Plan metadata:** see the final `docs(02-02)` commit.

## Files Created/Modified

- `src/middlewareRateLimit.test.ts` — PRESERVE suite for `applyApiRateLimit`. 8 tests: the 429 + `Retry-After` response past the POST budget, the `/api/admin` bypass at 3× the budget, the high-frequency write budget for both prefixes, the non-`/api` pass-through for GET and POST, and the exact boundary (30 allowed, the 31st blocked). Budgets are module constants read from the subject with source-line comments.
- `src/middleware.test.ts` — PRESERVE suite for the matcher, driven through `unstable_doesMiddlewareMatch`. 19 tests: all 8 `PROTECTED_ROUTES` plus `/`, `/api/events`, `/docs`, `/banned`, `/onboarding` match; `/_next/static/chunks/main-app.js`, `/_next/image`, `/favicon.ico`, `/auth/callback`, `/logo.png`, `/icon.svg` do not; and the matcher stays a single-entry array. Renamed to `src/proxy.test.ts` inside the batch-3 commit — only the import specifier changes.
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs` — 7 checks: `jest`, `tsc`, `lint` (STAB-13), `node-pin` (STAB-01), `no-unplanned-majors` (STAB-10), `react-untouched` (STAB-05), `lockfile-discipline` (STAB-11). `PASS|FAIL|SKIP <check> :: <rule> :: <detail>` reporting plus a summary line, `--check`/`--quick`/`--list`/`--help`, `node:` imports only, Phase 1 secret scrubbing on every caught error.
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/majors.b0.json` — 55 declared ranges with their majors, the `react` / `react-dom` ranges, `lockfileVersion: 3`, and `b0_commit: c7c5c49`.
- `scripts/smoke.sh` — executable, `set -uo pipefail`, no `-e`, no trace flag. `SMOKE_HOST` required with no default; `SMOKE_OUT` / `SMOKE_LABEL` / `SMOKE_IP` / `SMOKE_CARD_MARKER` / `SMOKE_TIMEOUT` optional. Redaction runs inside the pipeline that writes the capture.
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b0.txt` — the batch-0 run against `npm run dev`.
- `.planning/STATE.md`, `.planning/ROADMAP.md` — position, decisions, metrics, phase-2 plan progress 1/11 → 2/11. `.planning/REQUIREMENTS.md` was transiently edited by `requirements mark-complete` and reverted in the same session, so it ends byte-identical to its committed state (see Deviation 1).

## Smoke Run Record (batch 0, `npm run dev` on localhost:3000)

| # | Row | Result | Observed |
|---|-----|--------|----------|
| 1 | `GET /` | PASS | 200 + feed marker |
| 2 | `GET /api/events?limit=5` | **FAIL — data-limited** | 200 and **0 events** |
| 3 | `GET /api/events?search=test&tags=academic` | PASS | 200 |
| 4 | `GET /clubs` | PASS | 200 |
| 5 | `GET /profile` | **PASS (ring)** | `307 /?signin=required&next=/profile` |
| 6 | `GET /my-events` | **PASS (ring)** | `307 /?signin=required&next=/my-events` |
| 7 | `GET /docs` | PASS | 200 |
| 8 | `POST /api/events` ×31 | **PASS (ring)** | `429 Retry-After=60` |
| 9 | `GET /api/health` | PASS | 200 |
| 10 | `GET /_next/static/chunks/…js` | **PASS (ring)** | 200, no `Location` |

**Ring rows 4/4. Data rows 5/6. Total 9/10, exit 1.**

Row 2 is **environment-limited, and its expectation was not lowered.** The endpoint is healthy — it returns 200 with well-formed JSON — but the connected Supabase project reports `{"events":[],"total":0}`: there are no approved upcoming events in the data this instance is pointed at. The row will pass unchanged the moment it runs against an instance with content, and lowering it to "200 and ≥0 events" would have turned the phase's only end-to-end read-path assertion into a tautology. The capture file records the actual value (`200 and 0 events`), and the script prints an explicit note that a failing data row may be environment-limited.

Two further honest limits worth carrying forward:

- **Row 1's marker asserts the feed region, not a rendered card.** The homepage is a client component that fetches events after hydration, so the SSR HTML carries the discovery-feed scaffold rather than event cards. `SMOKE_CARD_MARKER` defaults to `Happening Now` and the reasoning is written above the row. Asserting a per-event string there would duplicate row 2's job against a body that structurally cannot contain one.
- **The ban check is deliberately out of scope** for Tier 1 and Tier 2, per RESEARCH § Smoke Pass Design. Exercising it needs a banned user's session, which needs the Phase 3 seed. `smoke.sh` states this in its header rather than implying coverage.

## Decisions Made

- **The matcher suite bans the documented export name mechanically, not by comment.** The Next docs page shows a proxy-named variant of `unstable_doesMiddlewareMatch`; that export exists in neither the installed 16.2.1 nor 16.3.5. Importing it fails as an is-not-a-function `TypeError` that reads exactly like a Jest ESM interop problem. The plan's gate greps the file for the wrong name and requires a count of zero, so the JSDoc describes the trap without spelling it — and the file's own header tells the next reader not to "fix" the import to match the docs.
- **Baseline numbers are parsed, never inlined.** `check-baseline.mjs` reads `Test Suites:` and `Tests:` out of `baseline/jest.txt` and the `✖ N problems (E errors, W warnings)` line out of `baseline/lint.txt` at run time. A grep of the file for `220`, `256` or `36` returns 0. A missing capture is a hard FAIL under `--check` — verified by renaming `jest.txt` (exit 1, `FAIL jest :: inputs-absent`) and restoring it (exit 0).
- **`majors.b0.json` records the commit it was taken at.** `lockfile-discipline` then scans `<b0_commit>..HEAD` for a forced-remediation reference instead of guessing at a phase range. The detector regex is assembled from fragments so the tool does not trip on its own source.
- **`@types/node` is the one allowed major move.** `PLANNED_MAJOR_BUMPS` encodes plan 02-01's recorded decision; every other major change across the 55 declared ranges is a FAIL.
- **`smoke.sh` restates its method contract rather than copying `cache-probe.sh`'s.** cache-probe is GET-only and says so; row 8 issues 31 POSTs, so that sentence would be a lie in this file. The header states the real contract: not GET-only, anonymous only, no `-L` anywhere, bodies never echoed wholesale.
- **Row 5 decodes `%2F` before asserting.** `NextResponse.redirect` percent-encodes the `next` parameter (`next=%2Fprofile`). The script decodes that one escape rather than relaxing the assertion to a prefix match on `signin=required` alone — the `next` round-trip is part of what the ring is supposed to preserve.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `requirements mark-complete` marked STAB-06, STAB-09 and STAB-13 complete when none of them are**

- **Found during:** State updates, after Task 3
- **Issue:** The plan's frontmatter declares `requirements: [STAB-06, STAB-09, STAB-13]`, and the standard state-update step marks every declared requirement complete. All three claims are false on this tree. STAB-06 requires the `middleware.ts` → `proxy.ts` migration, which is batch 3 (plan 02-06) and has not happened. STAB-09 requires upgrade batches each followed by a smoke pass; this plan built the smoke script and ran zero upgrade batches. STAB-13 is the phase exit criterion owned by plan 02-11. Leaving them checked would have laundered instrument-building into requirement satisfaction — the exact failure mode Phase 1 named when it withheld AUDIT-13/AUDIT-20 from plan 01-01, and that plan 02-01 already corrected once for STAB-02/08/13.
- **Fix:** Reverted all three to `- [ ]` in the requirement list and to `Pending` in the traceability table of `.planning/REQUIREMENTS.md`, and recorded the reversal as a decision in `.planning/STATE.md`.
- **Files modified:** `.planning/REQUIREMENTS.md`, `.planning/STATE.md`
- **Verification:** `grep -n "STAB-06\|STAB-09\|STAB-13" .planning/REQUIREMENTS.md` shows three `- [ ]` rows and three `| Pending |` rows.
- **Committed in:** the plan metadata commit

**2. [Rule 3 - Blocking] The `set -x` rationale comment tripped the plan's own gate**

- **Found during:** Task 3
- **Issue:** The acceptance criterion is `grep -c 'set -x' scripts/smoke.sh` prints 0, while the plan also instructs the header to explain *why* the trace option is never enabled. The first draft's rationale block contained the literal twice, so a correct explanation failed the gate.
- **Fix:** Reworded both occurrences to name the trace option without the literal two-token form ("the shell trace option (the `-x` flag)" and "NO trace : the `-x` option is absent by contract"), and noted in the header that an automated gate greps for it — so the next editor learns the constraint from the file rather than from a failing check.
- **Files modified:** `scripts/smoke.sh`
- **Verification:** `grep -c 'set -x' scripts/smoke.sh` → 0; the plan's Task 3 node gate prints `smoke.sh structure OK`.
- **Committed in:** `2060091`

**3. [Rule 3 - Blocking] The same collision in `src/middleware.test.ts`**

- **Found during:** Task 1
- **Issue:** Identical shape: the plan requires the file to warn about the non-existent proxy-named export *and* requires `grep -c 'unstable_doesProxyMatch' src/middleware.test.ts` to print 0.
- **Fix:** Rewrote the JSDoc to describe the trap as "a proxy-named variant of this helper" and to tell the reader not to change the import to match the docs page, without spelling the banned identifier.
- **Files modified:** `src/middleware.test.ts`
- **Verification:** The plan's Task 1 node gate prints `STAB-06 characterization OK — 8 protected routes covered`.
- **Committed in:** `c7c5c49`

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 2 × Rule 3)
**Impact on plan:** No scope creep. Two were gate/documentation collisions inside the plan's own acceptance criteria. The third prevented a false completion claim from entering the traceability table, which matters more than usual in a program whose core value is that a certification means something.

## Issues Encountered

- **The homepage carries no rendered event card in its SSR HTML.** Discovered while choosing row 1's marker. Resolved by making the marker configurable, defaulting it to the feed-region heading, and documenting the reason inline rather than asserting something the response cannot contain.
- **`POST /api/events` has no route handler and returns 405.** This turned out to be a feature of row 8 rather than a problem: the rate limiter runs in the request path *before* routing, so the first 30 POSTs return 405 and the 31st returns 429. The row therefore proves the limiter and not the handler, and that is written above the row.
- **The plan's reported `PROTECTED_ROUTES` line numbers were slightly off** (it cites lines 110-125 and 145-158; the array is at line 114 and `config` at 147-158). Every constant was read from the source rather than transcribed, so nothing downstream was affected — and this is the second time in the program that a transcribed number diverged from the tree.

## User Setup Required

None — no external service configuration required. The smoke script is anonymous-only and reads no credential.

## Next Phase Readiness

**Ready for plan 02-03 and the rest of the phase.** Every later batch now has:

- A per-batch gate it can actually run: `node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs` (exit 0 = at or better than AUDIT-13).
- A smoke pass it can actually capture: `SMOKE_HOST=http://localhost:3000 SMOKE_LABEL=b<N> scripts/smoke.sh`.
- A before-image for the one irreversible change in the phase: `npx jest --ci src/middlewareRateLimit.test.ts src/middleware.test.ts`.

**Carried forward for plan 02-06 (batch 3, the proxy rename):**

- Rename `src/middleware.test.ts` → `src/proxy.test.ts` inside the same commit as the codemod; change only the import specifier and the `describe` title. Record before/after `✓` lines into `evidence/proxy-migration-note.md`.
- The dev server already prints `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — the warning this migration retires is observable today.
- Run `scripts/smoke.sh` before and after; ring rows 5/6/8/10 must stay 4/4.

**Concerns:**

- `smoke.sh` exits 1 on this environment because of row 2's empty dataset. Any batch gate that shells out to it must distinguish a ring failure from a data failure — the script prints both counts on separate lines for exactly that reason. Do not "fix" this by relaxing row 2.
- `evidence/tools/majors.b0.json` pins `b0_commit` to `c7c5c49`. If the phase is ever rebased or replanned from an earlier point, that snapshot must be regenerated deliberately, not silently.

## Threat Flags

None — this plan added two test files, one `.mjs` CLI tool and one shell script. No production source file was modified (`git diff --stat` over `src/middleware.ts` and `src/middlewareRateLimit.ts` across all three commits is empty), no network endpoint or auth path was created, and no schema was touched. T-02-02-01 (capture redaction) and T-02-02-02 (bounded, non-production 31-POST row) are mitigated as planned; T-02-02-SC is satisfied — `package.json` is byte-identical to its pre-plan state.

## Self-Check: PASSED

- `src/middlewareRateLimit.test.ts` — FOUND
- `src/middleware.test.ts` — FOUND
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs` — FOUND
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/majors.b0.json` — FOUND
- `scripts/smoke.sh` — FOUND (executable)
- `.planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b0.txt` — FOUND
- Commit `c7c5c49` — FOUND
- Commit `a7058f2` — FOUND
- Commit `2060091` — FOUND

Plan verification block, re-run after the final task:

- `npx jest --ci src/middlewareRateLimit.test.ts src/middleware.test.ts` → 2 suites, 27 tests, exit 0
- `npm test -- --ci` → 247 passed / 36 skipped / 18 of 23 suites, exit 0 (baseline: 220 / 36 / 16 of 21)
- `node .../check-baseline.mjs` → `--- 21 passed, 0 failed, 0 skipped`, exit 0
- `bash -n scripts/smoke.sh` → exit 0; `SMOKE_HOST=` → exit 2 naming the variable
- `git diff --stat HEAD~3 HEAD -- src/middleware.ts src/middlewareRateLimit.ts` → empty
- `npx tsc --noEmit` → exit 0

---
*Phase: 02-dependency-and-runtime-stabilization*
*Completed: 2026-09-15*
