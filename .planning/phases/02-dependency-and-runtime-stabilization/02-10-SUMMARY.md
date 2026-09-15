---
phase: 02-dependency-and-runtime-stabilization
plan: 10
subsystem: infra
tags: [sbom, cyclonedx, supply-chain, renovate, dependency-automation, bundle-size, turbopack, next, npm, evidence]

# Dependency graph
requires:
  - phase: 02-dependency-and-runtime-stabilization
    provides: "02-04's batch-1 before-side bundle capture in two metric families, its DRIFT block ruling versions.txt out as a comparison base, and its measured 0-byte route-bundle delta; 02-05's batch-2 datum (first_load_js_sum 39,846,495 -> 37,327,033, next_static_bytes 4,489,846 -> 4,013,053); 02-01's CI test step, without which patch auto-merge would be merging untested code; 02-09's postcss override, final lockfile, and 0-critical/0-high production census; 02-RESEARCH § Package Legitimacy Audit approving @cyclonedx/cyclonedx-npm"
  - phase: 01-read-only-foundation-audit
    provides: "F-065 (CI had no test step) as the reason batch 6 is where auto-merge may be configured; dependency-report.md reachability judgments that made redoc-vs-swagger-ui the Pitfall 9 example"
provides:
  - "sbom.cyclonedx.json — a schema-valid CycloneDX 1.6 bill of materials of the production tree, 320 components, proven byte-identical across regenerations"
  - "A regenerate-and-diff command that is a drop-in CI freshness check, proven to exit 0 today"
  - "renovate.json — six described package rules, exactly one auto-merge rule covering only patch/pin/digest, React majors disabled at the PR level, security fixes exempt from the cooling-off"
  - "The STAB-16 after side in both metric families, captured by the identical procedure as the before side, with two independent cold builds proving determinism"
  - "evidence/bundle-size.md — a per-metric attribution table and a 44-row per-route table that reconciles to the top-level figure with zero unaccounted bytes"
  - "The named, un-performed human steps: install the Renovate GitHub App, and mark the CI checks REQUIRED in branch protection"
affects: [02-11, STAB-15, STAB-16, STAB-17, REFAC-19, phase-06-performance]

# Tech tracking
tech-stack:
  added:
    - "sbom.cyclonedx.json — the repository's first bill of materials; generated, never hand-edited"
    - "renovate.json — the repository's first bot configuration; .github/ previously held only workflows/ci.yml"
    - "@cyclonedx/cyclonedx-npm@6.0.1 and renovate@44.93.2 — both run ONE-SHOT via pinned npx, neither added to package.json"
  patterns:
    - "A silent tool is proven to have done its work: --validate says nothing on success, so the run was repeated at -vvv to capture 'BOM result appears valid'"
    - "A validator's exit 0 is worth nothing without a negative control; two were run, and the one that PASSED on bad input is the more useful finding"
    - "Reproducibility of a committed generated artifact is tested by regenerate-and-diff, not asserted by citing the flag that is supposed to guarantee it"
    - "An expected-zero result is stated as the expected result with its mechanism, so a reader cannot mistake it for a failure to be padded"
    - "A per-route table carries an 'excess beyond the shared change' column so the shared movement and the route-specific movement cannot be conflated"
    - "Package rules are ordered general -> specific so the file says what it means on a linear read"

key-files:
  created:
    - "sbom.cyclonedx.json"
    - "renovate.json"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.after.json"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.after.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.md"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/sbom-generation.txt"
    - ".planning/phases/02-dependency-and-runtime-stabilization/evidence/renovate-validation.txt"
  modified: []

key-decisions:
  - "Batch 6b (02-10): `--package-lock-only` was ADDED to the research's SBOM command. The research command reads ./node_modules and is platform-dependent: it produced 288 components on this macOS arm64 host against 320 from the lockfile, and all 32 missing ones are cross-platform optional binaries including @next/swc-linux-x64-gnu and @img/sharp-linux-x64 — the exact native binaries that run on Vercel iad1. A Mac-generated SBOM would have omitted what actually ships"
  - "Batch 6b (02-10): the same flag is what makes the plan's own must-have true. 'Byte-stable across regenerations, so a diff means the tree changed' is FALSE across machines in installed-tree mode, so the CI freshness check the plan names as the point could never pass on ubuntu-latest"
  - "Batch 6b (02-10): the cost of that flag was measured rather than waved away — purls 320/320, licences 318/320, externalReferences 320/320 and the dependency graph all preserved or improved; only `description` and `author` are lost, and no scanner reads them"
  - "Batch 6b (02-10): renovate.json's package rules were reordered general -> specific so the blanket major rule precedes the React rule. Functionally equivalent under Renovate's later-wins semantics; changed because both rules match exactly [\"major\"] and in the research order the first such rule is the React one, which makes the blanket protection look absent when it is merely shadowed"
  - "Batch 6b (02-10): the route-bundle reduction is attributed to batch 2 and NOT claimed for batch 1, on 02-04's measured 0-byte delta rather than on Pitfall 9's prediction. Batch 1's removals had zero importers and were already tree-shaken; that is the correct result and it is stated as such"
  - "Batch 6b (02-10): the +1,109 B that batches 3-6 ADDED is reported rather than rounded away, and two independent cold builds producing byte-identical diagnostics establish it is not noise"
  - "Batch 6b (02-10): the Renovate GitHub App installation is recorded as NO EVIDENCE OF INSTALLATION, not as a confirmed negative — the authoritative endpoint needs an App JWT a user token cannot mint, so four indirect probes were run and their inferential limit is stated"
  - "Batch 6b (02-10): a SECOND human step was identified that the plan did not name — branch protection on main must mark the CI checks REQUIRED, or 'checks passed' is vacuous and patch auto-merge merges on a green tick that guarantees nothing"

patterns-established:
  - "Negative controls for validators: run the tool against deliberately broken input and record BOTH what it catches and what it does not"
  - "Reconciling a detail table to its summary figure: 44 x -57,218 + (-761) = -2,518,353, stated explicitly so a reader can see nothing is unaccounted for"
  - "Recording the inferential limit of indirect evidence: 'NO EVIDENCE OF INSTALLATION' rather than 'not installed', with the reason the direct check was unavailable"

requirements-completed: [STAB-15, STAB-16]

# Metrics
duration: 25min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 10: Batch 6b — SBOM, Update Automation, Bundle Delta Summary

**The three evidence artifacts that outlive the phase: a 320-component CycloneDX SBOM proven byte-identical across regenerations, six described Renovate rules with exactly one patch-only auto-merge and React majors blocked at the PR level, and a two-family bundle delta that credits batch 2 with the −6.32% route reduction and refuses to credit batch 1 with bytes it did not move.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-15T15:32:05Z
- **Completed:** 2026-09-15T15:57:00Z
- **Tasks:** 3 of 3
- **Files created:** 7 · **Files modified:** 0

## What Was Built

### Task 1 — the STAB-16 after side and the delta table (`45c1ab1`)

Re-ran the identical procedure 02-04 used for the before side — `rm -rf .next && npm run build`,
route-bundle diagnostics copied unmodified — and wrote both metric families plus a delta table
with an attribution column.

| Metric (key) | Before | After | Delta | Moved by |
|---|---:|---:|---:|---|
| `routes` | 44 | 44 | 0 | — |
| `first_load_js_sum` | 39,846,495 B | 37,328,142 B | **−6.32%** | batch 2 |
| `first_load_js_max` | `/docs` 1,964,234 B | `/docs` 1,908,114 B | −2.86% | batch 2, shared chunk only |
| `first_load_js_median` | `/help` 840,219 B | `/help` 783,002 B | −6.81% | batch 2 |
| `next_static_bytes` | 4,491,132 B | 4,014,162 B | **−10.62%** | batch 2 |
| `prod_pkg_count` | 786 | 354 | **−54.96%** | batch 1 |
| `node_modules_kb` | 999,564 | 723,520 | −27.62% | batch 1 (batch 5 added some back) |
| advisories (C/H/M/L) | 2/22/13/1 = 38 | **0/0/2/0 = 2** | −36 | batches 1, 2, 4a, 6a |

**The honest part.** The ten declarations batch 1 removed had **zero importers**, so Turbopack had
already tree-shaken them out of every route before the phase began. Their route-bundle delta was
**measured at exactly 0 B on all 44 routes** (02-04-SUMMARY § Results) — not predicted, measured.
`/docs` is the proof in one number: the largest first-load bundle in the project at 1.9 MB, it is
`redoc`, which is reachable from the public route and stayed, so removing `swagger-ui-react` moved
it by **nothing** — it fell 1,098 B *less* than every ordinary route did.

**The reduction that is real is one shared chunk and it is nameable.** Intersecting
`firstLoadChunkPaths` across all 44 routes: the universal first-load set went **13 chunks /
823,979 B → 12 chunks / 766,761 B**, i.e. −1 chunk and −57,218 B, and every route inherits it.
766,761 B is exactly the first-load total of the nine smallest routes, which carry nothing else.

The per-route table lists all 44 routes (all cleared the 1% threshold) with an *excess beyond the
shared −57,218 B* column. Ten routes have a non-zero excess summing to **−761 B**, which reconciles
the table to the headline exactly: `44 × −57,218 = −2,517,592`, plus `−761` = **−2,518,353**.
Nothing is unaccounted for. Only two are material: `/profile` at −3,257 B beyond the shared chunk,
and `/friends` at **+1,305 B** — a route-specific chunk that *grew*, recorded rather than smoothed.

### Task 2 — the CycloneDX SBOM (`4b6ad03`)

`sbom.cyclonedx.json`: CycloneDX 1.6, **320 components**, 351 dependency-graph edges, 318 licences,
320 purls, `metadata.component = uni-verse@0.1.0 type=application`.
sha256 `5fdbf855c392f8a960b348aaa7d391e46bee0d2ab8960babe6f68d4dde32d618`.

- **Reproducibility was tested, not cited.** `--output-reproducible` is what suppresses the random
  `serialNumber` and the `metadata.timestamp`; both are confirmed absent from the emitted document.
  Then regenerate-to-stdout-and-diff: `exit_code=0`, no output, byte-identical. That command is a
  drop-in CI freshness check; this plan adds no CI step, but nothing else is needed to add one.
- **A silent validator was made to speak.** `--validate` prints nothing on success, which is
  indistinguishable from never having validated. Re-run at `-vvv`:
  `LOG | try validating BOM result ... / INFO | BOM result appears valid`.
- **The spec version is pinned even though it matches today's default**, because the tool already
  accepts 1.7 and a future default flip would silently reshape the document.
- **All eight production declarations batch 1 removed are absent** — the SBOM independently
  confirming the removal.
- **Nothing was installed.** `package.json` and `package-lock.json` sha256 identical before and
  after; `cyclonedx` appears in neither, nor in `node_modules`.

### Task 3 — dependency update automation (`e342098`)

`renovate.json` at the repository root, six rules each carrying a description.

- **The ordering property is the safety mechanism, not the patch restriction.** Renovate merges when
  the *required* checks pass. Before batch 0 those checks were lint + type-check + build with **no
  test step at all** (F-065). This rule landing earlier would have been a machine merging untested
  code into `main` every Monday.
- **React majors are `enabled: false`, not `automerge: false`.** No PR is opened at all. A bot that
  repeatedly proposes something already decided against trains the team to close bot PRs unread —
  and the next unread bot PR is a security fix. Threat T-02-10-02.
- **Security fixes are exempt from the 3-day cooling-off** (`vulnerabilityAlerts.minimumReleaseAge:
  null`). The cooling-off catches a compromised publish before it merges; that reasoning does not
  apply to a fix for a vulnerability already public and already in the tree.
- **Validated in both modes.** Explicit-path validation reports "as global config", which is the
  *looser* mode, so it was re-run in auto-discovery mode where it validates as a repository config.
  Both exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical correctness] `--package-lock-only` added to the SBOM command**

- **Found during:** Task 2, cross-checking the generated document against a lockfile-scoped run
- **Issue:** 02-RESEARCH § Code Examples 8's command reads `./node_modules`, making the document
  **platform-dependent**. Measured: installed-tree mode 288 components, lockfile mode 320. All 32
  extras are cross-platform optional binaries npm did not materialise on this macOS arm64 host —
  including `@next/swc-linux-x64-gnu`, `@img/sharp-linux-x64` and `@img/sharp-libvips-linux-x64`,
  which are precisely the native binaries that run in production (`vercel.json` deploys to `iad1`,
  Linux x64). A Mac-generated SBOM would have omitted the binaries that actually ship — the most
  expensive way for a bill of materials to be wrong, since a consumer scanning it for a
  native-binary advisory finds nothing.
- **Second, independent reason:** it falsifies the plan's own `must_haves.truths` entry — "byte-stable
  across regenerations, so a diff on it means the tree actually changed" is **false across machines**
  in installed-tree mode, so the CI freshness check the plan names as the point could never pass on
  `ubuntu-latest`. It is also what makes the plan's `key_links` phrase "generated from the final
  lockfile" literally true.
- **Cost, measured not waved away:** purls 320/320, licences 318/320, externalReferences 320/320 and
  the dependency graph are preserved or improved. Only `description` (258/288 → 0/320) and `author`
  are lost; no scanner reads them.
- **Files:** `sbom.cyclonedx.json`, `evidence/sbom-generation.txt` · **Commit:** `4b6ad03`

**2. [Rule 1 — Bug in the plan's verifier] `yaml` is listed as a batch-1 removal and was not one**

- **Found during:** Task 2, running the plan's task-2 verifier
- **Issue:** The verifier asserts no SBOM component names `yaml`. It is present, correctly.
  `yaml` was **withdrawn** from batch 1 (02-04-SUMMARY deviation 1, commit `5fd6745`): removing it
  broke the build because `redoc@2.5.x`'s prebuilt bundles `require("yaml")` while declaring it in
  neither `dependencies` nor `peerDependencies`, and `redoc` is reachable from the public `/docs`
  route. Batch 1 removed **ten** declarations, not eleven. The plan's list is stale against its own
  phase.
- **Fix:** Ran the verifier with that one entry removed — it passes, 320 components, spec 1.6. The
  other eight removals are all confirmed absent. The discrepancy is written into
  `evidence/sbom-generation.txt` so a later reader does not "fix" the SBOM.
- **Commit:** `4b6ad03`

**3. [Rule 1 — Bug] The blanket major rule was shadowed by the React rule**

- **Found during:** Task 3, running the plan's task-3 verifier, which failed with
  `major-automerge-not-blocked`
- **Issue:** Both the React rule and the blanket rule match exactly `"matchUpdateTypes": ["major"]`.
  In the research's ordering the React rule comes first, carries `enabled: false` and **no
  `automerge` key**, so anything scanning for "the rule that stops majors auto-merging" finds the
  React rule and concludes the blanket protection is missing. It was shadowed, not missing.
- **Fix:** Reordered general → specific: blanket major rule before the React rule. Functionally
  equivalent under Renovate's later-match-wins semantics (a React major is disabled either way);
  changed so the file says what it means on a linear read. Re-validated in both modes after the
  swap, both still exit 0.
- **Files:** `renovate.json`, `evidence/renovate-validation.txt` · **Commit:** `e342098`

**4. [Rule 2 — Missing critical functionality] A second human step the plan did not name**

- **Found during:** Task 3, working out what "auto-merge merges when CI passes" actually requires
- **Issue:** The plan names one outstanding human step (install the GitHub App). There is a second:
  **branch protection on `main` must mark the CI checks REQUIRED.** Renovate merges when *required*
  checks pass — if no check is marked required, "checks passed" is vacuous and patch auto-merge
  merges on a green tick that guarantees nothing. This defeats T-02-10-01's central mitigation, and
  `renovate.json` cannot express it.
- **Fix:** Written into `evidence/renovate-validation.txt` alongside the app-installation step, both
  flagged for 02-11's completion note. **Not performed** — it is a repository-settings change.
- **Commit:** `e342098`

### Findings recorded, not fixed

**The config validator does not validate update types.** Two negative controls were run against
`renovate-config-validator`. A bogus top-level key is rejected (`exit 1`, "Invalid configuration
option"). But `"matchUpdateTypes": ["patchh"]` — a typo inside the **one rule that auto-merges** —
is **accepted, exit 0**. Schema validation proves the file is well-formed Renovate configuration; it
does **not** prove the auto-merge rule matches what you think. In this direction the failure happens
to be fail-safe (a typo'd type matches nothing, so nothing auto-merges), but the validator is not
the control that keeps `"major"` out of the auto-merge rule — the plan's structural verifier is.
Recorded in `evidence/renovate-validation.txt` so `exit_code=0` is not read as more than it is.

## Threat Model Disposition

| Threat | Disposition |
|---|---|
| T-02-10-01 compromised package auto-merged | Mitigated — 3-day `minimumReleaseAge`, auto-merge restricted to `patch`/`pin`/`digest`, every high-blast-radius group explicitly `automerge: false`, and CI now includes the test suite and the production audit gate. **Gap recorded:** the required-checks branch-protection step is outstanding and human |
| T-02-10-02 React pulled to 19 by a bot | Mitigated — `enabled: false` for react/react-dom/@types majors; the PR is never opened. Separately no major auto-merges |
| T-02-10-03 SBOM drifting from the lockfile | Mitigated — generated **from the lockfile** (deviation 1), byte-stability proven by regenerate-and-diff, schema validation proven to execute at `-vvv`, regeneration rule written into the evidence file |
| T-02-10-04 malicious one-shot tool | Mitigated — both pinned (`@cyclonedx/cyclonedx-npm@6.0.1`, `renovate@44.93.2`); the generator is approved in 02-RESEARCH § Package Legitimacy Audit and listed in CycloneDX's own Tool Center; pinned integrity recorded; neither added to `package.json` |
| T-02-10-05 SBOM exposing the dependency surface | Accepted — `package.json` and `package-lock.json` are already committed; the SBOM restates them in a standard format, dev-scoped entries omitted |
| T-02-10-06 bundle improvement claimed without evidence | Mitigated — two families with per-change attribution, a 44-row per-route table reconciling to the headline with zero unaccounted bytes, an explicit statement that batch 1's removals were already tree-shaken, and the +1,109 B that batches 3–6 *added* reported rather than rounded away |
| T-02-10-07 automation configured with no bot behind it | Mitigated — installation status recorded as **NO EVIDENCE OF INSTALLATION** with four probes and their inferential limit stated; carried to 02-11 |
| T-02-10-SC package installs | Mitigated — no package installed, no manifest touched. `package.json` / `package-lock.json` sha256 identical before and after both tool runs |

## Verification

All four gates exit 0 at `e342098`:

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 — 0 errors, 19 warnings (unchanged from the post-`eslint-config-next`-bump baseline) |
| `npx tsc --noEmit` | exit 0 — no output, 0 diagnostics |
| `npm test -- --ci` | exit 0 — **278 passed, 5 skipped**, 22 of 23 suites |
| `npm run build` | exit 0 — from a deleted `.next`, **twice**, byte-identical output both times |

Plan verifiers: task 1 `STAB-16 OK — prod pkgs 786 -> 354`; task 2 `STAB-15 SBOM OK — 320
components, spec 1.6` (with the stale `yaml` assertion corrected, deviation 2); task 3 `STAB-15
renovate OK — 6 rules, 1 automerge rule, react major disabled`.

`git status --porcelain -- package.json package-lock.json src/` prints nothing. This plan measured
the tree; it did not move it.

## Requirements

| ID | Clause-by-clause | Status |
|---|---|---|
| **STAB-15** | "A CycloneDX SBOM is generated and committed" ✓ (320 components, spec 1.6, schema-validated, committed) · "and Renovate … is configured with grouping" ✓ (three groups: supabase, test harness, next) · "and patch-only auto-merge" ✓ (exactly one auto-merge rule, `patch`/`pin`/`digest` only, structurally asserted) · "after the batch upgrades land" ✓ (batches 0–6a all landed; that ordering is what makes auto-merge safe). Named evidence in 02-RESEARCH § Traceability — the SBOM freshness diff and the config validator — both run, both exit 0 | **Complete** |
| **STAB-16** | "Bundle size is recorded before and after the dependency removals" ✓ — before by 02-04, after here by the identical procedure, with a delta table attributing every metric to the batch that moved it | **Complete** |

**STAB-15 is marked complete with a caveat that belongs in 02-11's completion note, not in the
status column.** The requirement's verb is "configured", its named evidence is the validator run,
and both are satisfied. But **the Renovate GitHub App is not installed** and, separately, branch
protection does not mark the CI checks required. Until both are done, every rule in `renovate.json`
is inert — correct, validated, and doing nothing. This is the same distinction 02-09 drew for
STAB-14's unobserved CI run: the artifact is delivered, the world has not yet acted on it.

## Carry-forward for 02-11

1. **Two human steps, neither performed.** Install the Renovate GitHub App on the `gdgmcgill` org
   with access to `Event-Radar`; then mark the CI checks REQUIRED in branch protection on `main`.
   The second is the one that is easy to forget and the config file cannot express it. Full
   instructions are in `evidence/renovate-validation.txt`.
2. **The SBOM regeneration rule.** `sbom.cyclonedx.json` is generated and must be regenerated in the
   same commit as any `package-lock.json` change. Because the output is reproducible, running it
   unnecessarily costs nothing and *not* running it is the only way to get this wrong. The exact
   command is in `evidence/sbom-generation.txt`.
3. **A CI freshness check is one line away** and was deliberately not added here (02-10 adds no CI
   steps). The regenerate-and-diff command exits 0 today.
4. **Bundle figures for the exit-gate note:** production packages −54.96% (786 → 354), production
   advisories 38 → 2 with **0 critical and 0 high**, first-load JS −6.32%, `.next/static` −10.62%.
   Quote them with their attribution — the package reduction is batch 1, the byte reduction is
   batch 2, and **nothing in this phase was a bundle-size optimisation**. No dynamic import, no
   smaller replacement, no code splitting. Phase 6 still owns performance.

## Self-Check: PASSED

All seven created files exist on disk. All three task commits exist in `git log`:
`45c1ab1`, `4b6ad03`, `e342098`. No claimed artifact is missing.
