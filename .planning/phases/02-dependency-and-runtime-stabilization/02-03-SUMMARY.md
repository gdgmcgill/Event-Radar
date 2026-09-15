---
phase: 02-dependency-and-runtime-stabilization
plan: 03
subsystem: dependency-governance
tags: [vulnerability-policy, npm-audit, stab-02, stab-03, evidence, batch-0c]
status: complete

requires:
  - .planning/audit/SEVERITY_SLA.md
  - .planning/audit/quality/dependency-report.md
  - .planning/audit/quality/npm-audit.prod.json
  - .planning/audit/findings.json
  - .planning/audit/baseline/versions.txt
  - .planning/audit/baseline/test-runner-decision.md
  - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-00-jest.txt
provides:
  - evidence/VULNERABILITY-POLICY.md
  - evidence/devdir-investigation.md
  - evidence/audit.phase-start.json
affects:
  - plan 02-09 (fills the exception register; writes audit.after.json against this census)
  - plan 02-11 (quotes both documents in STAGE-2-COMPLETION.md; owns STAB-02's residual CI observation)
  - batches 1-4 (governed by the policy's clauses 1-8 and its re-derivation corollary)

tech-stack:
  added: []
  patterns:
    - "Policy-before-measurement: the grading rule is committed before the first scan-driven change, proved by git ancestry rather than asserted"
    - "Re-derive, never transcribe: probe output is regenerated per plan, which is what caught the research error in this one"

key-files:
  created:
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/VULNERABILITY-POLICY.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/devdir-investigation.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.phase-start.json
  modified: []

decisions:
  - "STAB-03 marked complete; STAB-02 held Pending on one unobservable CI datum, not on missing work"
  - "The policy is subordinate to SEVERITY_SLA.md, not a second competing policy: where they overlap, the SLA governs"
  - "Reachability is inherited from Phase 1 except in batches 1 and 2, which change the module graph and must re-derive"
  - "02-RESEARCH.md Pitfall 7 is factually wrong about the repo-wide .npmrc search; corrected in evidence rather than propagated"

metrics:
  duration: 9 min
  tasks: 2
  files: 3
  completed: 2026-09-15
---

# Phase 02 Plan 03: Batch 0c — Vulnerability Policy and the devdir Probe Summary

The rule that grades the rest of Phase 2 is now on disk and provably predates the first scan-driven dependency change, and STAB-02 is closed as documentation by a re-run four-scope probe that also caught a factual error in the phase research.

## What Was Built

**`evidence/VULNERABILITY-POLICY.md` (135 lines, STAB-03).** Eight clauses — scope, Critical, High, Moderate/Low, dev-only, reachability basis, enforcement, no-CVSS — written against a census captured in the same task and cited per figure. It opens by declaring itself **subordinate to `.planning/audit/SEVERITY_SLA.md`**: five clauses are inherited verbatim (a Critical may not be risk-accepted; the four exception attributes with the 90-day cap and automatic revert; published advisory severity is evidence while reachability sets the finding's severity), and where the two overlap the SLA governs. That framing was the point of the task — a second document asserting its own standard would have given the exit gate two rules to choose between.

Two clauses do work beyond inheritance. **Reachability basis** inherits Phase 1's 24 per-row judgments rather than re-deriving them, and then states the corollary that matters more than the rule: batches 1 and 2 *do* change the module graph — removals delete whole subtrees, and the `next` bump re-pins `postcss` and `sharp` underneath it — so those two batches re-derive while 0, 3, 4, 5 and 6 inherit. **Enforcement** records that the CI audit step lands in batch 6 *and why*, so the deferral cannot later read as an oversight: the command exits 1 on this tree today, and five batches of a red check the team is expected to merge past teaches merging past red checks.

The **Named open items** table disposes, by name and in advance, of the six advisories that will still be visible at the gate. Three carry a requirement the version bump alone does not satisfy: `picomatch` must be verified *two ways* (version in-range **and** the path leaving the prod tree when `tailwindcss-animate` moves to devDeps); the `sharp`/AVIF closure requires a source comment on `next.config.js:4`, because `images.unoptimized: true` is the single line keeping an unauthenticated RCE unreachable and nothing in the file says so; and the five cache-poisoning advisories close by version **while citing F-025 and `cache/cache-matrix.csv`**, because Phase 1 proved by measurement that the shared-cache precondition is live on this deployment. The framework advisories close; the exposure does not, and REFAC-19 in Phase 6 is what removes it. F-057 is dispositioned as closed-by-version-so-the-evidence-gap-is-moot rather than left Open against a fixed advisory.

**`evidence/audit.phase-start.json`.** Raw `npm audit --omit=dev --json --package-lock-only` output, committed unmodified. 2 critical / 22 high / 13 moderate / 1 low = 38, across 680 production dependencies, with 24 distinct High/Critical packages — every bucket identical to Phase 1's `npm-audit.prod.json`, which is what makes the inherited reachability work current rather than stale.

**`evidence/devdir-investigation.md` (220 lines, STAB-02).** The four-scope probe re-run live: `npm config get devdir` → `undefined`; both named config file paths absent; zero `npm_config_*` variables exported; `npm config ls` printing no `key=value` line from any scope at all; and both `npm install --dry-run` and `npm ci --dry-run` emitting no warning line. The emitter was reproduced synthetically **in a scratch directory outside the repository** to confirm that the scope word in npm's message — `project`/`user`/`global`/`env` — is itself the diagnostic. The note states explicitly that no repository file was edited and names that as the deliberate outcome, since inventing a `package.json` or CI edit to silence a warning emitted by an absent file on someone else's machine is the documented failure mode for this requirement.

## Key Decisions

**The policy is subordinate, not parallel.** `SEVERITY_SLA.md` already governs severity program-wide. This document narrows the same rules to Stage 2 dependency advisories and says so in its second paragraph, with an explicit tie-break. The alternative — a free-standing Stage 2 standard — would have let the exit gate pick whichever document read more favourably.

**Batches 1 and 2 re-derive reachability; the rest inherit.** Inheriting saves a day of work already paid for. But an inherited judgment about a subtree that no longer exists is a stale judgment, not an inherited one, so the two graph-changing batches are named in the clause itself rather than left to the executor's discretion.

**The three-way disposition split in Named open items.** Items are not uniformly "fixed by version". Three require verification the version bump does not provide on its own (`picomatch`'s dual path, the `next.config.js` source comment, the F-025 citation). Writing those requirements *before* the batches run is what makes 02-11 a form to fill rather than a standard to invent.

**STAB-02 closes as documentation, and the residual unknown is named rather than papered over.** The CI-side answer is carried in from 02-01 as `unobserved` and kept that way. It is unobserved for two verified reasons — no pushed batch-0 run exists, and the last completed run's logs return HTTP 410 — not for lack of trying, and the note says what bounds it (a fresh GitHub-hosted image with no user `.npmrc`) without recording that inference as an observation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `02-RESEARCH.md` § Pitfall 7 records a false measurement; corrected in evidence rather than propagated**

- **Found during:** Task 2, running the repo-wide `.npmrc` search.
- **Issue:** Research states `find . -name .npmrc -not -path './node_modules/*'` returns no results. It returns `./supabase/functions/events-webhook/.npmrc`. The plan's acceptance criterion and its automated verifier both encoded the research's figure, so the verifier would have reported `npmrc-created:` — accusing this plan of creating a file it did not touch.
- **Fix:** Investigated rather than suppressed, and recorded as § 5 of the note with four independently checked reasons it changes no conclusion: the file is three comment lines with no `key=value` (so it cannot emit an unknown-config warning); npm's project config resolves at the local prefix, which `npm config ls` reports as the repository root, so npm never reads a file four directories down; it belongs to the Deno edge function, which is excluded from `tsconfig.json` and not built by npm; and `git log --diff-filter=A` dates it to commit `9c33891`, 2025-11-27 — roughly ten months before this program began.
- **Why this matters beyond the file:** the plan's own instruction was to re-derive the probe rather than transcribe the research, and re-deriving is precisely what caught this. The same Phase 1 rule that produced the `build_route_row_count` 139→140 correction produced this one.
- **Files modified:** `evidence/devdir-investigation.md` § 5. **No** research or plan file was edited — those are committed artifacts, and the correction belongs in evidence.
- **Commit:** `5915b25`

**2. [Rule 3 — Blocking] Acceptance criterion re-asserted at its intent, with the literal form recorded**

- **Found during:** Task 2 verification.
- **Issue:** The criterion "`find . -name .npmrc` returns nothing — no `.npmrc` was created in this repository" states an intent (*this plan created none*) and a literal test that, given deviation 1, can never pass regardless of what the executor does.
- **Fix:** Ran the intent-preserving assertion — `git status --porcelain` shows no added or modified `.npmrc` — which passed, **and** ran the literal command anyway, recording its single hit and its 2025 provenance. Both are in the note and in the Task 2 verification output. The threat this criterion guards (T-02-03 / Pitfall 7: an executor inventing a repository fix) is satisfied by the git-ancestry proof, which is stronger evidence than the absence of a filename.
- **Commit:** `5915b25`

### Ordering note (not a deviation)

STAB-03's git-ancestry criterion asks that the policy commit precede every later batch commit editing `package.json`. Two phase-02 commits edit `package.json` *before* it — `1e2647e` and `3eeaa2a`, both batch 0a. Neither is a scan-driven change, which is the condition STAB-03 actually names: the full diff across both is the `test`/`test:ci` scripts, the removal of the dead `check:feedback` script, the `engines` block, and `@types/node` `^20.11.0` → `^24.13.4` — a types-only devDependency bump forced by the Node 24 runtime pin, and one that appears nowhere in the production census. No advisory-driven dependency change exists on this tree, and `git log 50e9e26..HEAD -- package.json` is empty.

## Verification

| Check | Result |
|---|---|
| Task 1 automated verifier | PASS — all 12 required strings, both footers, the Critical clause regex, census shape valid (`critical=2 high=22`) |
| Task 2 automated verifier | PASS — metadata line, blockquoted decision, 25 annotated `# ->` commands (≥5 required), CI answer present, both footers, no `.npmrc` added or modified |
| `min_lines` | PASS — policy 135 (≥90), devdir note 220 (≥40) |
| STAB-03 ordering | PASS — policy added in `50e9e26`; `git log 50e9e26..HEAD -- package.json` empty |
| `npx tsc --noEmit` | exit 0, zero diagnostics |
| `npm run lint` | exit 0, 12 warnings / 0 errors — identical to the AUDIT-13 baseline |
| `npm test -- --ci` | exit 0, 247 passed / 36 skipped, 18 of 23 suites — at or better than the 220/36/16-of-21 baseline |
| `npm run build` | exit 0 |
| Scope containment | PASS — `git status --porcelain` shows zero tracked changes; the only untracked entries (`.agents/`, `.mcp.json`, `docs/product-master-plan.md`, `skills-lock.json`) are byte-for-byte the four present at session start |

Not one file outside `.planning/` changed, which was this plan's own success criterion.

## Requirements

| ID | Disposition | Reasoning |
|---|---|---|
| **STAB-03** | **Complete** | Every clause of the requirement text maps to a section on disk: the policy exists (135 lines), it states zero unexplained Criticals with no risk-acceptance, it requires a fix or a dated owner-signed exception with a reachability argument for Highs, and it records dev-only findings as tracked-not-blocking with `baseline-browser-mapping` as the named production-tree exception. The "before any scan-driven change" clause is a git-ancestry fact, not a claim. Follows the AUDIT-13 precedent: withhold when artifacts contradict the claim, not reflexively. |
| **STAB-02** | **Pending** (held) | The local half is closed conclusively and the source is documented. The CI half remains `unobserved` and this plan could not close it — no pushed batch-0 run exists, and the last completed run's logs are expired (HTTP 410). Per the phase precedent set by 02-01 and 02-02, a requirement is not marked complete while one clause rests on an unobserved environment. **Unblocked by:** one readable CI `Install dependencies` log — grep it for `Unknown .* config`. Plan 02-11 owns the close; no work is scheduled for it. |

## Follow-Ups / Deferred

- **STAB-02 residual:** the CI runner's npm unknown-config status. Zero-cost to close on the next readable CI run; carried into 02-11.
- **Vercel build image:** not inspected, recorded as a bounded known-unknown. `engines.node` governs the runtime regardless, and an advisory warning cannot change a lockfile-resolved tree. No action.
- **`02-RESEARCH.md` § Pitfall 7** now has a known factual error. It is corrected in `devdir-investigation.md` § 5; a reader who consults the research directly will still see the wrong figure.
- **For plan 02-09:** fill the exception register, or record explicitly that it is empty. An empty register is the intended outcome; an empty register is not the same as an unexamined one.
- **For batches 1 and 2:** the policy obliges you to re-derive reachability. Batches 3-6 inherit.

## Known Stubs

None. The exception register's empty rows table is a deliberate contract with plan 02-09, documented as such in the policy itself, not an unwired placeholder.

## Threat Flags

None. This plan introduced no network endpoint, auth path, file-access pattern, or schema change. T-02-03-01 (credential leakage via `npm config ls -l`) was mitigated as planned: only the `userconfig`/`globalconfig` path lines and the single `devdir` result were captured, never the full dump — and no `.npmrc` exists in any scope, so no token could have been present to capture. T-02-03-SC holds: no package was installed, `--package-lock-only` wrote nothing to `node_modules`, and no manifest file was touched.

## Self-Check: PASSED

All three created files exist on disk. Both commits (`50e9e26`, `5915b25`) are present in `git log`.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-03*
