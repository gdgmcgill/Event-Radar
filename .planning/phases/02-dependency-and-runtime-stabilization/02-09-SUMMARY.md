---
phase: 02-dependency-and-runtime-stabilization
plan: 09
subsystem: security
tags: [npm, npm-audit, overrides, postcss, styled-components, redoc, github-actions, ci, vulnerability-policy, lockfile]

# Dependency graph
requires:
  - phase: 02-dependency-and-runtime-stabilization
    provides: "02-03's VULNERABILITY-POLICY.md with its eight pre-committed clauses and empty register; 02-01's ci.yml shape (checkout, setup-node via node-version-file, install, lint, type-check, test, build) and the unobserved CI half of STAB-02; 02-04's structural lockfile-diff method; 02-07's post-remediation census naming the surviving postcss High and recommending the styled-components override; 02-08's 278/5/22-of-23 jest position"
  - phase: 01-read-only-foundation-audit
    provides: "SEVERITY_SLA.md's four exception attributes and the no-risk-accepted-Critical rule; dependency-report.md sections 2-3 reachability judgments; F-025 and cache-matrix.csv; F-057; F-065"
provides:
  - "The final production advisory census: 0 critical, 0 high, 2 moderate, 0 low across 298 production dependencies"
  - "A local rehearsal of the exact CI gate command with exit_code=0, run against the tree npm ci installed"
  - "The exception register closed EMPTY, with the emptiness stated in prose so it reads as examined rather than unfilled"
  - "The named-open-items table converted from batch-0 forecasts to 2026-09-15 measurements, each with the command that produced it"
  - "The CI step `Production vulnerability gate`, unsuppressed, between the test step and the build step"
  - "A run record that states plainly the run is UNOBSERVED and names the single action (a push) that unblocks it"
  - "A structural lockfile review of the phase's only manifest change: 0 insertions / 57 deletions, 2 entries removed, 0 added, 0 re-resolved"
affects: [02-10, 02-11, STAB-03, STAB-09, STAB-14, STAB-17, STAB-02, F-065, F-057, F-025, REFAC-19]

# Tech tracking
tech-stack:
  added:
    - "package.json `overrides` — the project's first, a single entry: postcss ^8.5.28"
  patterns:
    - "A gate is added only after the identical command exits 0 locally, and its evidence is a run, not the YAML line"
    - "An empty exception register carries a sentence saying why it is empty, so examined-and-empty is distinguishable from unfilled"
    - "A forecast column is replaced by a measurement column, with the forecast preserved in parentheses so the reader can see whether it held"
    - "When a recommended remediation proves infeasible, record the attempt and the resolver output — never drop the recommendation silently"
    - "Unobserved evidence is labelled UNOBSERVED in the first line of the artifact, not buried in a caveat"

key-files:
  created:
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.after.json"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/audit-gate-local.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/ci-green-run.md"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b6.diff-review.md"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b6.before.sha256"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-06-lint.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-06-tsc.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-06-jest.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-06-build.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b6.txt"
  modified:
    - ".github/workflows/ci.yml"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/VULNERABILITY-POLICY.md"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/devdir-investigation.md"
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "Batch 6 (02-09): the plan's no-manifest-change constraint was SET ASIDE on a recorded user decision (Adyan Ullah, 2026-09-15), because the plan required two things that could not both hold — a green gate and no manifest change — while one production High survived. An exception-register row does not change an exit code"
  - "Batch 6 (02-09): 02-07's recommended `styled-components: ^6.5.3` override is INFEASIBLE on this tree and the attempt is recorded rather than the recommendation quietly dropped. Every styled-components release that drops the postcss dependency (>= 6.4.0) adds react-native as an optional peer; npm 11 resolves react-native@0.87.1, which peer-requires react ^19.2.3, colliding with react 18.3.1 and phase-locked constraint 1"
  - "Batch 6 (02-09): the fix shipped is `overrides: { postcss: ^8.5.28 }` instead — same advisory, strictly smaller intervention, redoc's declared peer contract left unrewritten, styled-components still 6.3.8 and still a peer"
  - "Batch 6 (02-09): the override collapses next's exact 8.5.23 postcss pin into the single root 8.5.28 copy. 02-07 declined exactly this and accepted the duplicate; that acceptance is reversed, and the compensating evidence is a cold build whose route table is identical to batch 5's as a set"
  - "Batch 6 (02-09): the exception register closes EMPTY — the High was fixed, not excepted. Zero rows is the intended exit-gate outcome, and the prose saying so is what distinguishes it from an unfilled table"
  - "Batch 6 (02-09): the cache-poisoning row was NOT softened when the counts came back clean. F-025 stays a live Critical, the precondition is still on this deployment (vercel.json untouched across the whole phase, blanket s-maxage=60 still present, no Vary), and REFAC-19 in Phase 6 still owns it"
  - "Batch 6 (02-09): STAB-14 is delivered IN PART. The step exists, is unsuppressed, is positioned correctly and is green locally — but the requirement's evidence clause asks for a passing RUN, and all 113 Phase 2 commits are unpushed. Recorded as UNOBSERVED in the first line of ci-green-run.md rather than implied"
  - "Batch 6 (02-09): no requirement is marked complete by this plan. STAB-03 was already Complete; STAB-09 cannot be claimed because batch 5 ran no smoke pass; STAB-14 is partial; STAB-17 is the exit gate and belongs to 02-11"

patterns-established:
  - "Rehearse the gate with the gate's own command: not a --json variant, not a --package-lock-only variant, and against the node_modules that npm ci installed, because a rehearsal of a different command is not a rehearsal"
  - "Override blast radius is stated by measurement, not by intent — a table of claims, each with the check that produced it and its result"
  - "When an override changes nothing the lockfile records (npm 11 does not mirror `overrides`), say so and prove both install paths converge rather than leaving a reader to find two entries vanishing with no recorded cause"
  - "Byte-level supplementary checks on a smoke row: row 7 is PASS at 82,679 bytes and 16 redoc references, identical to the pre-override capture — the page did not merely 200, it rendered the same bytes"

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 09: Batch 6a — The Vulnerability Gate Gets Teeth Summary

**The production advisory census reaches 0 critical / 0 high across 298 production dependencies, the CI gate that enforces it is added last so its first run is green, and the exception register closes empty because the last High was fixed rather than excepted — at the cost of the one manifest change this plan had forbidden itself, made on a recorded user decision and documented as the deviation it is.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-15T15:12:40Z
- **Completed:** 2026-09-15T15:26:07Z
- **Tasks:** 2
- **Files modified:** 15 (10 created, 5 modified)
- **Commits:** 2

## Accomplishments

- **The census is clean and the gate proves it mechanically.** `evidence/audit.after.json` reports **0 critical, 0 high, 2 moderate, 0 low** across **298** production dependencies. Phase start was 2 / 22 / 13 / 1 across 680. The exact CI command — `npm audit --audit-level=high --omit=dev`, not a variant — exits **0** against the tree `npm ci` installed, captured in `evidence/audit-gate-local.txt`.
- **The last High was fixed, not excepted.** The register closes **empty**, with a sentence stating why, so a reader can tell an examined-and-empty table from an unfilled one. A row here would have been a documented bypass of the gate; there is nothing to bypass.
- **The gate step is in CI, unsuppressed, and positioned last.** `Production vulnerability gate` sits between `Run tests` and `Run build`. Zero `continue-on-error` in the file, no `|| true`, no wrapper, and deliberately no comment saying failures are expected. The workflow parses as the eight steps it should, and `node-version-file` plus batch 0's `npm test` step are intact.
- **The forecast column became a measurement column.** All six named open items now carry their 2026-09-15 status with the command that produced it, and **all six forecasts held.** `picomatch` was verified *both* ways as the batch-0 disposition demanded — version in-range at 2.3.2 *and* all five lockfile copies carrying `dev: true`, because `tailwindcss-animate` moved to `devDependencies`. A version bump alone would have fixed the advisory and left the packaging defect.
- **The good news did not soften the bad.** The cache-poisoning row still cites F-025 and still points at REFAC-19. The five `next` advisories are closed by version; **the exposure is not.** Verified rather than asserted: `git log` shows `vercel.json` untouched across the entire phase commit range, the blanket `s-maxage=60, stale-while-revalidate=300` is still there, and no `Vary` exists.
- **F-057 closes as *moot*, and says so.** `next` is past 16.3.3, so the unverified Linux assumption stops carrying weight. It does **not** close as "verified" — nothing verified it.
- **The batch gate re-ran green on the changed tree.** lint 0 (19 warnings, an *identical set* to batch 5, diffed line by line), tsc 0 (zero bytes), jest 0 (**278 passed / 5 skipped / 22 of 23 suites — the batch-5 figures exactly**), cold build 0 with a route table identical to batch 5 as a set, and `check-baseline.mjs` **22 passed / 0 failed / 0 skipped** including `react-range-byte-identical`.
- **Smoke row 7 is the load-bearing row, and it passed byte-for-byte.** `GET /docs` mounts redoc, redoc renders through styled-components, and styled-components is the package whose `postcss` copy this batch removed. The response is **82,679 bytes with 16 redoc references** — identical to the pre-override batch-4 capture.

## Task Commits

| Task | Name | Commit | Key files |
|---|---|---|---|
| 1 | Measure the final census and fill the exception register against it | `445f7dc` | `package.json`, `package-lock.json`, `evidence/audit.after.json`, `evidence/audit-gate-local.txt`, `evidence/VULNERABILITY-POLICY.md`, `evidence/lock.b6.diff-review.md`, `evidence/batch-06-*.txt`, `evidence/smoke.b6.txt` |
| 2 | Add the CI production vulnerability gate and record a green run | `b554d8f` | `.github/workflows/ci.yml`, `evidence/ci-green-run.md`, `evidence/devdir-investigation.md` |

## Deviations from Plan

### 1. [Rule 4 — Architectural, user-decided] The no-manifest-change constraint was set aside

**This is the significant one. Read it before reading anything else in this summary.**

- **Found during:** Task 1, by the previous executor agent, which surfaced it as a checkpoint and committed nothing.
- **The contradiction.** The plan required three things that could not all hold. It required the local rehearsal to exit 0 before the CI step could be added (Task 1 acceptance criteria). It forbade any change to `package.json` or `package-lock.json` (acceptance criteria, `phase_locked_constraints` #7, threat **T-02-09-SC**). And it inherited exactly one surviving production High from batch 4. **An exception-register row does not change an exit code.** With a High present and the manifest frozen, the gate could be added *or* be green, not both.
- **What was set aside:** `phase_locked_constraints` #7 — *"This plan makes no change to `package.json` or `package-lock.json`"* — and threat **T-02-09-SC**'s mitigation claim, *"No package is installed and no manifest file is touched."* Both are now false for this plan and the threat register entry should be read as superseded by this section.
- **Who decided:** **Adyan Ullah, 2026-09-15**, presented with the contradiction and the option set, choosing to land the fix and take the gate green rather than add a red gate or defer the step.
- **Commit:** `445f7dc`.

**The compensating controls, both run rather than promised:**

1. **Structural lockfile review** — `evidence/lock.b6.diff-review.md`, by the method 02-04 established. **0 insertions / 57 deletions. 2 entries removed, 0 added, 0 re-resolved to a different version, 0 flag flips, `lockfileVersion` 3 → 3, root entry unchanged.** Both removed entries are duplicate nested `postcss` copies, each traced to the parent that pinned it. This is the smallest lockfile diff in the phase.
2. **Smoke row 7** — `GET /docs` PASS, at byte-identical size and redoc-reference count to the pre-override capture.

### 2. [Rule 3 — Blocking] The approved mechanism was infeasible; a smaller one was substituted

**The user's decision named `overrides: { "styled-components": "^6.5.3" }`, following 02-07's recommendation. That pin cannot be installed on this tree, and the attempt is recorded here rather than the recommendation being quietly dropped.**

- **What happened:** `npm install --package-lock-only` aborted with `ERESOLVE`:

  ```
  npm error peer overridden styled-components@"^6.5.3" (was "^4.1.1 || ^5.1.1 || ^6.0.5") from redoc@2.5.4
  npm error Conflicting peer dependency: react@19.3.0
  npm error   peer react@"^19.2.3" from react-native@0.87.1
  npm error     peerOptional react-native@">= 0.68.0" from styled-components@6.5.3
  ```

- **Why, and why no 6.x version escapes it.** `styled-components` dropped its `postcss` dependency at **6.4.0** — and the same release added `react-native` as an optional peer. Every stable version that fixes the advisory therefore carries it, `6.4.0` was tested and fails identically, and npm 11.13.0's resolver attempts to place `react-native@0.87.1`, which peer-requires `react@^19.2.3`. That collides with `react@18.3.1` and **phase-locked constraint 1, which the user did not waive.**
- **What shipped instead:** `overrides: { "postcss": "^8.5.28" }`. Same advisories (`GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`), strictly smaller intervention. `styled-components` is untouched at 6.3.8 and still `peer: true`; **`redoc`'s declared peer range is not rewritten**, which the approved pin would have done — npm printed that rewrite as a `peer overridden` line, and it is a contract change the `postcss` override avoids entirely.
- **Neither `--force` nor `--legacy-peer-deps` was used**, in keeping with `phase_locked_constraints` #2. `npm audit fix` was not run anywhere in this phase, and `check-baseline.mjs --check lockfile-discipline` still reports the whole commit range clean.

**The blast radius this substitutes in, stated plainly rather than buried:** `next@16.3.5` declares `"postcss": "8.5.23"` as an **exact** pin, and the override moves the copy it resolves to up to **8.5.28** — five patch releases forward inside the same minor. 02-07 deliberately declined this and accepted the duplicate; that acceptance is now reversed. `postcss` is the CSS pipeline Next builds through, so a **cold** `rm -rf .next && npm run build` is the direct test of it, and the route table came back identical to batch 5's as a set.

### 3. [Rule 2 — Missing critical documentation] One thing the lockfile does not record

**npm 11.13.0 did not mirror the `overrides` block into `package-lock.json`** (`command grep -c '"overrides"' package-lock.json` → 0). A reader diffing the lockfile alone sees two `postcss` entries vanish with no recorded cause, so this is named in `lock.b6.diff-review.md` § 4 rather than left to be discovered.

It does not threaten reproducibility, and **both install paths were checked rather than reasoned about**: `npm ci` installs the tree as written in the lockfile and **did not report a package.json / lockfile sync error** — which mattered, because an unmirrored `overrides` block was a plausible way for the two files to disagree and `npm ci` aborts when they do. `npm install` re-resolves and reads `overrides` from `package.json` directly. Both converge.

## Authentication Gates

None. No credential was read or sent by any command in this plan. The smoke pass is anonymous by contract and `.env.local` was never read.

## Requirements

**No requirement is marked complete by this plan.** Each is left where the evidence puts it, following the phase precedent that a requirement is claimed only when every clause is delivered.

| ID | Status | Why |
|---|---|---|
| **STAB-03** | **Already Complete** (marked by 02-03) | This plan delivers its final clause — the register closed against the exit census — but the requirement was satisfied when the policy was written before the first scan-driven change, which is the property it actually asserts. Nothing to re-mark. |
| **STAB-09** | **Pending** | Batch 6 ran the full five-part gate including a smoke pass. But the requirement covers *every* batch, and **batch 5 (02-08) ran no smoke pass and said so**. The clause is not satisfied across the sequence, so it is not claimed. 02-11 owns the reckoning. |
| **STAB-14** | **Pending — delivered in part** | The step exists, is unsuppressed, is correctly positioned, and is green against this tree. The requirement's evidence clause asks for a **passing run**, and none exists: all 113 Phase 2 commits are unpushed. **02-11 must record STAB-14 as partial, not complete.** |
| **STAB-17** | **Pending** | The exit gate. This plan supplies three of its five inputs — no unexplained Critical, no reachable High without an exception, a reviewed lockfile. Reproducible install (02-10) and an observed green check (a push) are outstanding. 02-11 owns it. |
| **STAB-02** | **Pending** | Its CI half is still unobserved. Re-checked, not carried forward on faith — see below. |

## Known Gaps and Unobserved Evidence

**These are recorded as gaps, in the artifacts themselves, in their first lines. None is implied to be covered.**

1. **The CI run is UNOBSERVED.** `evidence/ci-green-run.md` § 1 opens with this. All 113 Phase 2 commits are local (`git rev-list --count origin/main..HEAD` → 113), so GitHub Actions has never seen this workflow; and run `26121379844`, the only one on the remote, returns **HTTP 410** on both the run-log and job-log API paths — **both re-tried in this session, not assumed from 02-03's note.** The unblock condition is named as exactly one action: **a push**, followed by confirming six step conclusions. The file records the full local rehearsal of all six workflow steps in workflow order, each exit 0, labelled as a rehearsal, with the two honest caveats on how far a macOS rehearsal transfers to `ubuntu-latest`.

2. **STAB-02's CI half is still unobserved**, and was re-derived rather than transcribed. The local probe was re-run on the batch-6 tree — `npm ci --dry-run 2>&1 | command grep -ciE 'unknown .* config|npm warn'` → **0** — six batches and 382 fewer production dependencies after the original measurement, and it still says zero. `ci_npm_unknown_config=unobserved` stands. The check is one grep for the scope word (`project` / `user` / `global` / `env`) once a run exists. Authoritative record: `ci-green-run.md` § 6, cross-referenced from `devdir-investigation.md` § 6a.

3. **Smoke row 2 fails, as designed, on an empty local dataset.** `GET /api/events` returns 200 with 0 events because the local Supabase has no event rows. It failed identically in batch 4 for the same reason. **The expectation was not lowered** — the row still demands ≥ 1 event. Ring rows 5, 6, 8, 10 are the signal for a dependency change and they are **4/4**.

## For Plans 02-10 and 02-11

**Both inherit a tree this plan changed. Neither was planned against it.**

- **02-10's clean-room install now installs a manifest with an `overrides` entry in it.** That entry was not present when 02-07 wrote its recommendation or when `cleanroom-interim.txt` was captured. The clean room is the independent third check that `npm ci` and `npm install` converge (`lock.b6.diff-review.md` § 4), and it should be read as such.
- **02-10's bundle-size "after" side moves.** The `postcss` dedupe removes two lockfile entries and one production dependency (299 → 298). Compare against `evidence/bundle-size.before.txt`, never against `versions.txt` — the standing rule from 02-05 — and note that this batch, not batch 5, is the tree being measured.
- **02-11's Stage 2 completion note MUST carry the § Deviations record above**, specifically that `phase_locked_constraints` #7 and threat T-02-09-SC were knowingly set aside on a user decision, with the two compensating controls named. It must also record **STAB-14 as partial** and quote the final Moderate and Low counts: **2 moderate (`dompurify` via redoc, `yaml` direct), 0 low.**
- **02-10 must not touch** `sbom.cyclonedx.json`, `renovate.json`, or the bundle-size evidence files from this plan's side — this plan did not.

## Self-Check: PASSED

All ten created files exist on disk; both commits resolve in `git log`.

```
FOUND: evidence/audit.after.json          FOUND: evidence/batch-06-tsc.txt
FOUND: evidence/audit-gate-local.txt      FOUND: evidence/batch-06-jest.txt
FOUND: evidence/ci-green-run.md           FOUND: evidence/batch-06-build.txt
FOUND: evidence/lock.b6.diff-review.md    FOUND: evidence/smoke.b6.txt
FOUND: evidence/lock.b6.before.sha256     FOUND: evidence/batch-06-lint.txt
FOUND: 445f7dc   FOUND: b554d8f
```

Both plan `<verify>` blocks were run and both passed:

- Task 1 → `register OK — critical 0, high 0, moderate 2, low 0`
- Task 2 → `STAB-14 OK (run recorded as unobserved, honestly)`

**The final docs commit for this plan did not happen, and the cause is environmental.** Partway through this plan the `git` binary stopped running on this machine: `/usr/bin/git` now exits **69** with *"You have not agreed to the Xcode license agreements."* Both task commits landed **before** it broke — `refs/heads/main` reads `b554d8f66eccc856a0cd3c69df3161bb0ac961ed` and `.git/logs/HEAD` shows both, which is how the commit half of the self-check above was verified without invoking `git`. This is a macOS licence gate, not a repository problem, and it is not something this session can clear.

**Unblock, then commit — three files, one command each way:**

```bash
sudo xcodebuild -license          # accept, in a Terminal
git add .planning/phases/02-dependency-and-runtime-stabilization/02-09-SUMMARY.md \
        .planning/STATE.md .planning/ROADMAP.md
git commit -m "docs(02-09): complete batch 6a — vulnerability gate green, register closed empty"
```

`STATE.md` and `ROADMAP.md` are already updated on disk — plan counter advanced to 10, progress recalculated to 92%, the five key decisions recorded, and two blockers filed (this one, and STAB-14's unobserved run). **Plan 02-10 cannot commit until the licence gate is cleared.**

**One acceptance criterion in each task is knowingly unmet, and it is the same one:** `git status --porcelain -- package.json package-lock.json` printing nothing. It prints two modified files. That is the deviation in § 1, not an oversight. Every other criterion in both tasks passes, including `continue-on-error` count 0, correct step order, `node-version-file` retained, no exit-code suppression in the audit step's run line, and `git status --porcelain -- src/` empty.
