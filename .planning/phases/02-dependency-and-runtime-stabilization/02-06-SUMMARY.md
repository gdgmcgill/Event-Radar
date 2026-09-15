---
phase: 02-dependency-and-runtime-stabilization
plan: 06
subsystem: infra
tags: [nextjs, proxy, middleware, codemod, jscodeshift, auth, rate-limiting, characterization-testing]

# Dependency graph
requires:
  - phase: 02-dependency-and-runtime-stabilization
    provides: "plan 02-02's two PRESERVE characterization suites (src/middleware.test.ts, src/middlewareRateLimit.test.ts) and scripts/smoke.sh — the instruments this batch reads before and after"
  - phase: 02-dependency-and-runtime-stabilization
    provides: "plan 02-05's next 16.3.5 install — the codemod is pinned to that exact version, and batch-02-build.txt supplies the before-side deprecation marker"
provides:
  - "src/proxy.ts — the request boundary under the Next 16 file convention, renamed from src/middleware.ts with one changed line"
  - "src/proxy.test.ts — the matcher characterization suite, import specifier repointed"
  - "evidence/proxy.rename-diff.txt — git diff -M proof the change reads as a rename plus one identifier per file"
  - "evidence/proxy-migration-note.md — the STAB-06 record, including the ban-check coverage limitation stated rather than glossed"
  - "evidence/proxy.before.txt / proxy.after.txt — 27 assertions, identical either side of the rename"
  - "evidence/smoke.b3.before.txt / smoke.b3.after.txt — ten HTTP rows, byte-identical either side"
  - "evidence/batch-03-{lint,tsc,jest,build}.txt — the batch-3 gate, with deprecation_warning_lines_after=0"
affects: [batch 4 browserslist, batch 5 STAB-08 test infrastructure, Phase 5 REFAC-18 rate limiter rewrite, Phase 7 CERT-05 persona matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rename batches are measured, not trusted: capture the instruments green before the change, run the change, capture them again, and diff the result markers"
    - "Evidence-note prose must not quote the string its own gate greps for"
    - "Pinned one-shot codemods via npx; never added to package.json"

key-files:
  created:
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/proxy.before.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/proxy.after.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/proxy.rename-diff.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/proxy-migration-note.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b3.before.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b3.after.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-03-lint.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-03-tsc.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-03-jest.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-03-build.txt
  modified:
    - src/proxy.ts
    - src/proxy.test.ts

key-decisions:
  - "STAB-06 stays Pending. The requirement says the ban-check behaviour is smoke-tested before and after; it was not, and cannot be until the Phase 3 seed exists. Marking it complete would record coverage the phase does not have."
  - "STAB-09 stays Pending. Batches 4, 5 and 6 are the remaining patch/minor upgrades; batch 3 is a file rename that satisfies the one-commit-plus-full-gate-plus-smoke shape but not the requirement's scope."
  - "Staged the rename by explicit path instead of the plan's `git add -A`, because 47 pre-existing untracked files would otherwise have been swept into the STAB-06 evidence artifact."
  - "Ran the codemod with --force after proving the tracked tree empty, rather than stashing. git stash is shared across worktrees and is forbidden by the executor contract; nothing was set aside or discarded."
  - "Stripped the per-test `(N ms)` suffix before diffing the before/after assertion markers. The research recipe's raw grep reports six spurious differences on a provably unchanged tree."
  - "Refused to claim `ƒ Proxy (Middleware)` in the build route table as a rename receipt — batch 2's build already printed it on the pre-rename tree."
  - "Left the `[Middleware]` log prefix, src/middlewareRateLimit.ts and all three Phase 5 findings untouched, so `same behaviour as before` stays provable."

patterns-established:
  - "Before/after characterization capture: run the PRESERVE suites with --verbose so per-test names exist on disk, then compare the NAME SET, not the summary counts"
  - "Deprecation-warning line counts as batch markers: a non-zero before value is the control that makes a zero after value mean something"
  - "Coverage limitations get their own titled section naming the future requirement that closes them, not a footnote"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 06: Proxy Migration (Batch 3) Summary

**`src/middleware.ts` → `src/proxy.ts` via the pinned `@next/codemod@16.3.5` transform — two rename headers, two changed lines, 27 characterization assertions and all ten smoke rows identical either side, and the build's file-convention deprecation warning driven 1 → 0.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-15T05:30:00Z
- **Completed:** 2026-09-15T05:42:00Z
- **Tasks:** 3
- **Files modified:** 12 (2 renamed source files, 10 new evidence captures)

## Accomplishments

- **The authentication ring survived, and that is measured rather than asserted.** `src/proxy.ts` is this application's only page-level protection for eight routes. `GET /profile` returned `307 → /?signin=required&next=/profile` before the rename and returns exactly that after it. A 200 there would have made every protected page public and nothing else in the suite would have noticed.
- **The transformed body is byte-identical to the original apart from the exported function's name.** Verified mechanically: normalise the function name, then require whole-file string equality. The rate-limit-first ordering, the env-missing pass-through, the cookie `getAll`/`setAll` block, the ban check, the eight-entry `PROTECTED_ROUTES` array, the onboarding guard, the `catch` block and the exported matcher all compare equal.
- **27 assertions, zero differences.** Both PRESERVE suites green on the pre-rename tree and green again after, with an identical set of passing test names.
- **All ten smoke rows byte-identical**, down to row 10's run-time-discovered chunk filename. Ring rows 4/4 on both sides.
- **`deprecation_warning_lines_before=1` → `deprecation_warning_lines_after=0`**, and no coexistence error anywhere in the build log — the both-files-present hard throw never had a chance to fire, because the codemod writes and unlinks in one pass.
- **Full gate clean:** lint 0 errors / 19 warnings (rule-for-rule as batch 2), `tsc` 0 bytes of output, jest 247 passed / 36 skipped / 0 failed, cold build exit 0 with 139 route-table lines unchanged, `check-baseline.mjs` 22 passed / 0 failed.
- **The ban check's lack of coverage is recorded as a limitation, not claimed as coverage** — with the two things that *are* evidence for it named, and CERT-05 in Phase 7 named as where the real assertion lands.

## Task Commits

1. **Task 1: Capture the before side** — `ad884e1` (docs)
2. **Task 2: Run the pinned codemod and rename the matcher suite** — `0d66a1d` (refactor)
3. **Task 3: Capture the after side, run the batch-3 gate, write the migration note** — `bf2ce10` (docs)

## Files Created/Modified

**Renamed (the whole of the source change):**
- `src/middleware.ts` → `src/proxy.ts` — one line: `export async function middleware(` → `export async function proxy(`
- `src/middleware.test.ts` → `src/proxy.test.ts` — one line: `import { config } from "./middleware"` → `"./proxy"`

**Evidence created:**
- `evidence/proxy.before.txt` — both PRESERVE suites on the pre-rename tree, 27 passed, plus the `deprecation_warning_lines_before=1` marker
- `evidence/proxy.after.txt` — the same two suites post-rename, 27 passed, with the assertion-set comparison recorded
- `evidence/proxy.rename-diff.txt` — `git diff --cached -M` at both `--stat` and full-diff level; two rename headers at similarity index 98%, 2 insertions / 2 deletions total
- `evidence/smoke.b3.before.txt`, `evidence/smoke.b3.after.txt` — ten anonymous HTTP rows either side, with the row-by-row diff result recorded
- `evidence/batch-03-lint.txt`, `-tsc.txt`, `-jest.txt`, `-build.txt` — the batch-3 gate, each with a provenance block and `exit_code=0`
- `evidence/proxy-migration-note.md` — the STAB-06 record (310 lines): what moved, the three refused temptations, the six asserted codemod no-ops, both capture comparisons, the deprecation counts, the ban-check limitation, and the outstanding Tier 3 checklist

**Deliberately unchanged:** `src/middlewareRateLimit.ts`, the `[Middleware]` log prefix at `src/proxy.ts:142`, `package.json`, `package-lock.json`.

## Decisions Made

**1. Both requirements stay Pending.**

`STAB-06` reads: *"`middleware.ts` is migrated to `proxy.ts` per the Next 16 deprecation, as its own gated change with the rate limiter **and ban-check behavior** smoke-tested before and after."* The migration happened, it was its own gated change, and the rate limiter was smoke-tested before and after (row 8, 429 + `Retry-After: 60`, both sides). The ban-check clause was **not** satisfied and cannot be this phase: exercising it needs a banned user's session, which needs the Phase 3 deterministic seed, and Tier 2 is anonymous by contract. Following this phase's precedent — mark complete only when every clause is delivered — STAB-06 remains Pending.

`STAB-09` covers *"remaining patch/minor upgrades … in small labeled batches."* Batch 3 is a file rename, not an upgrade, and batches 4 through 6 are still ahead. It satisfies the requirement's *shape* (one labeled commit, then lint + type-check + test + build + smoke) but not its scope. Pending.

**2. Staged by explicit path, not `git add -A`.** See deviation 1.

**3. `--force` on the codemod rather than setting work aside.** See deviation 2.

**4. Stripped the timing suffix before diffing assertion markers.** See deviation 3.

**5. Refused a false receipt.** The build's route table prints `ƒ Proxy (Middleware)`. That looked like proof the rename took, until `evidence/batch-02-build.txt` line 175 turned out to say exactly the same thing on the pre-rename tree — Next 16.3.5 labels the request-boundary function that way regardless of which convention produced it. The note says so explicitly so nobody re-derives the wrong conclusion. The only receipt is the absent deprecation warning.

**6. Nothing else in the rename commit.** The `[Middleware]` log prefix is the project logging convention (`.claude/CLAUDE.md` § Logging) and renaming it would be a behaviour-visible line in the one commit that has to read as a rename. `src/middlewareRateLimit.ts` was not renamed — the relative import survives, and REFAC-18 rewrites that module in Phase 5. The fail-open env guard (F-003), the `getSession()` usage and the pass-through catch are real Phase 5 findings; fixing one here would have made "same behaviour as before" unprovable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Staged the rename by explicit path instead of `git add -A`**

- **Found during:** Task 2 (the codemod and the rename diff)
- **Issue:** The plan's action says `git add -A` before capturing the rename diff, and Task 1's precondition is an empty `git status --short`. Neither holds here: 47 untracked files predate this plan — `.agents/` (40 skill files), `.mcp.json`, five `.planning/research/.cache/*.json` blobs, `docs/product-master-plan.md`, `skills-lock.json`. `git add -A` would have swept all of them into the STAB-06 evidence artifact, and a rename diff buried under 47 unrelated additions does not read as a rename, which is the single property that artifact exists to demonstrate.
- **Fix:** Verified the property the precondition actually protects, then staged by name. `git status --porcelain --untracked-files=no` was **empty** (no tracked modification) and `git status --porcelain -u all -- src/` was **empty** (nothing stray in the source tree); both facts are recorded in the provenance blocks of `proxy.before.txt` and `proxy.rename-diff.txt`. Staging used `git add -- src/middleware.ts src/proxy.ts src/proxy.test.ts`.
- **Files modified:** none — this changed the method, not the content
- **Verification:** `git diff --cached -M --stat` reports exactly `2 files changed, 2 insertions(+), 2 deletions(-)` across two rename headers. `git diff --name-status -M 2a56084..HEAD` shows only the two renames and the plan's own evidence files. No untracked file was committed.
- **Committed in:** `0d66a1d`

**2. [Rule 3 - Blocking] Ran the codemod with `--force`**

- **Found during:** Task 2
- **Issue:** `npx @next/codemod@16.3.5 middleware-to-proxy .` refused to run: *"please stash or commit your git changes."* Its cleanliness check counts any untracked file as dirty, so the same 47 pre-existing files blocked it.
- **Fix:** `--force`, after proving the tracked tree clean. The two alternatives were both worse: committing or gitignoring 47 unrelated files violates `<batch_isolation>` outright, and `git stash -u` is forbidden by the executor contract — the stash ref lives in the parent `.git/` and is shared across worktrees, so popping it can apply a sibling session's WIP. Nothing was set aside, discarded, or cleaned.
- **Files modified:** none beyond the intended rename
- **Verification:** codemod reported `0 errors, 319 unmodified, 1 skipped`; `git status --porcelain --untracked-files=no` showed exactly `D src/middleware.ts` with `src/proxy.ts` present, matching the expected output in `02-RESEARCH.md` § Code Examples 3. The `--force` decision, the two `git status` readings that justified it, and the reason stash was not used are all recorded in `proxy.rename-diff.txt`'s provenance block.
- **Committed in:** `0d66a1d`

**3. [Rule 1 - Bug] Normalised the timing suffix before diffing assertion markers**

- **Found during:** Task 3
- **Issue:** `02-RESEARCH.md` § Code Examples 3 step 3 specifies `diff <(grep -E '✓|✕' before) <(grep -E '✓|✕' after)`. Run verbatim it reported **six differences** on a tree whose assertions are provably unchanged — every one a per-test wall-clock suffix moving between `(1 ms)` and nothing (`runs on /create-event (1 ms)` vs `runs on /create-event`). An evidence comparison whose clean state is six differences that must be eyeballed and waved away is an invitation to wave away the seventh.
- **Fix:** `sed -E 's/ \([0-9]+ ms\)$//'` on both sides before diffing. The strip is symmetric and touches only a trailing millisecond count, so it cannot conceal a renamed, added or removed assertion — those change the text before the suffix.
- **Files modified:** `evidence/proxy.after.txt` (the method and its rationale are in the provenance block), `evidence/proxy-migration-note.md` § 4
- **Verification:** normalised diff reports `IDENTICAL: 0 differences across 27 assertion lines`; 27 ✓ / 0 ✕ on both sides. The plan's own verify script performs the same normalisation independently and reports `27 assertions identical before and after`.
- **Committed in:** `bf2ce10`

**4. [Rule 1 - Bug] Evidence prose tripped the gate it was describing**

- **Found during:** Task 3 (first run of the verify block)
- **Issue:** The gate fails the batch if `evidence/batch-03-build.txt` contains the wording of Next's both-files-detected error. The build log was clean, but the provenance block I appended *quoted that wording* while explaining that it was absent — so the gate failed on a note about a clean log. A false AUTH-adjacent failure on the phase's highest-risk change is exactly the kind of noise that gets a real one dismissed.
- **Fix:** Rewrote the provenance note to describe the probe without reproducing it, and added a pointer to `check-baseline.mjs`'s `FORCED_REMEDIATION` regex — assembled from fragments for precisely this reason — so the next person writing an evidence note does not rediscover the hazard the same way. Same rewrite applied to § 6 of the migration note.
- **Files modified:** `evidence/batch-03-build.txt`, `evidence/proxy-migration-note.md`
- **Verification:** gate rerun reports `batch-3 gate OK — 27 assertions identical before and after`; `grep -n 'file convention is deprecated' evidence/batch-03-build.txt` still returns nothing, so the substantive claim is unweakened.
- **Committed in:** `bf2ce10`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** No scope creep. Deviations 1 and 2 are two faces of one pre-existing condition — 47 untracked files in the working tree — and both were resolved by verifying the property the plan's precondition actually protects rather than by weakening it or by touching the untracked files. Deviations 3 and 4 fixed measuring instruments that reported differences where there were none; both made the evidence stricter to read, not looser. Every source-level constraint in `<batch_isolation>` held: the commit is two renames and two lines.

## Issues Encountered

- **The codemod's `1 skipped` result line reads like a failure and is not.** `0 errors, 319 unmodified, 1 skipped` — the skip *is* the rename. `handleMiddlewareFileRename` writes the new path, unlinks the old one, and returns `null`; jscodeshift tallies a `null` return as a skip rather than an ok. Confirmed by reading the transform source out of the resolved package and by `git status`. Recorded in the rename-diff provenance so the next reader does not spend the same minutes on it.
- **`git add` aborts the whole invocation on one bad pathspec.** Passing the already-`git mv`'d `src/middleware.test.ts` produced `fatal: pathspec ... did not match any files` and staged *none* of the paths in that command. Re-ran without it. Worth knowing when staging by explicit path is the rule rather than the exception.
- **Row 2 of the smoke pass fails on both sides** — `200 and 0 events` against an empty local Supabase. Pre-existing and identical in `smoke.b0`, `b1`, `b2` and both b3 captures. The expectation was not lowered and the row was not removed; the observed value is printed in both captures.

## User Setup Required

None for this plan. **But one human step is outstanding for the phase.**

Tier 3 verification of this rename is recorded as **OUTSTANDING** in `evidence/proxy-migration-note.md` § 9, with unchecked boxes and blank fields for the deployment URL and date. It is deferred to end-of-phase verification (`workflow.human_verify_mode: end-of-phase`) and **must run against a preview deployment, not only a local server** — Next compiles the file convention into a platform function at build time, so the first post-rename deploy is the only place the rename meets the CDN. The five steps: McGill sign-in completes; a non-McGill account is still rejected; the onboarding redirect fires for a mid-onboarding session; a signed-in non-banned user is not sent to `/banned`; save/unsave and RSVP still work. If any fails, `git revert 0d66a1d` — the rename is reverted, not patched.

## Known Stubs

None. No placeholder, empty-value, or unwired-data pattern was introduced; the source change is a rename of two files.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change was introduced. The threat register's six `mitigate` dispositions were addressed as planned, with `T-02-06-03` remaining *mitigate (partial, stated)* — its ban-check half is the documented coverage limitation, recorded rather than papered over.

## Next Phase Readiness

**Ready.** The request boundary is on the Next 16 file convention, the deprecation warning is gone from the build, and the gate is green: lint 0 errors, tsc silent, 247 tests passing, cold build exit 0, `check-baseline.mjs` 22/0.

Carried forward:

- **STAB-06 and STAB-09 remain Pending** in `REQUIREMENTS.md`, for the reasons in Decisions Made. Neither is blocked; both are waiting on work that is already scheduled.
- **Tier 3 is outstanding** and belongs to end-of-phase verification, against a preview deployment.
- **Batch 4** owns the caniuse-lite/browserslist staleness warning, still the only warning in the build log.
- **Batch 5 (STAB-08)** owns the 5 skipped suites awaiting the jsdom + testing-library install.
- **Phase 5 (REFAC-18)** owns `src/middlewareRateLimit.ts`, deliberately not renamed here. The three findings in `src/proxy.ts` — the fail-open env guard (F-003), the `getSession()` usage, the pass-through catch — are also Phase 5's, and are untouched by design so that this batch's no-behaviour-change claim stays provable.
- **Phase 7 (CERT-05)** owns the banned-user assertion, against the Phase 3 seed.

## Self-Check: PASSED

Files verified present on disk:

- `src/proxy.ts` (158 lines), `src/proxy.test.ts` — FOUND; `src/middleware.ts`, `src/middleware.test.ts` — confirmed ABSENT
- `evidence/proxy.before.txt`, `proxy.after.txt`, `proxy.rename-diff.txt`, `proxy-migration-note.md` (310 lines), `smoke.b3.before.txt`, `smoke.b3.after.txt`, `batch-03-lint.txt`, `batch-03-tsc.txt`, `batch-03-jest.txt`, `batch-03-build.txt` — all FOUND

Commits verified in `git log`:

- `ad884e1` — FOUND
- `0d66a1d` — FOUND
- `bf2ce10` — FOUND

Verify blocks: Task 1 `before capture OK`; Task 2 `rename OK — body byte-identical apart from the function name` with `tsc --noEmit` exit 0; Task 3 `batch-3 gate OK — 27 assertions identical before and after` with `check-baseline.mjs` exit 0 (22 passed, 0 failed, 0 skipped).

---
*Phase: 02-dependency-and-runtime-stabilization*
*Completed: 2026-09-15*
