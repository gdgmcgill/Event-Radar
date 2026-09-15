---
phase: 02-dependency-and-runtime-stabilization
plan: 04
subsystem: infra
tags: [npm, dependencies, supply-chain, npm-audit, lockfile, bundle-size, tailwind, radix, redoc, vercel-cli]

requires:
  - phase: 01-read-only-foundation-audit
    provides: "dependency-report.md per-row reachability, dead-code.md's 13 confirmed/refuted unused-dependency rows, npm-audit.prod.json census, baseline/versions.txt counts"
  - phase: 02-dependency-and-runtime-stabilization
    provides: "02-01 Node 24 toolchain floor + characterization suites; 02-02 check-baseline.mjs comparator and scripts/smoke.sh; 02-03 VULNERABILITY-POLICY.md committed pre-remediation"
provides:
  - "Vercel CLI out of production dependencies with the removal-not-relocation decision recorded (STAB-04)"
  - "Ten dead declarations deleted and tailwindcss-animate relocated to devDependencies"
  - "src/components/ui/dropdown-menu.tsx pair-deleted with @radix-ui/react-dropdown-menu"
  - "Production advisory rows 38 -> 15 (23 retired, 0 new), prod dependencies 680 -> 293"
  - "STAB-16 before side captured in two metric families with the install-tree/route-bundle split made explicit"
  - "Structural lockfile-diff review method that answers 'did npm change anything I did not ask for' directly instead of via a line count"
  - "Corrected reachability rule for batches 2-5: a src/-only grep cannot see a require() inside another dependency's prebuilt bundle"
affects: [02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, phase-05, phase-06]

tech-stack:
  added: []
  patterns:
    - "Structural lockfile diff review (entries added/removed/re-resolved) as the STAB-11 gate, with the raw line count demoted to a heuristic"
    - "Two-family bundle measurement: install-tree metrics and route-bundle metrics recorded side by side and labelled with which one a change is expected to move"
    - "Advisory deltas proven by diffing two committed JSON censuses rather than asserted from a summary line"

key-files:
  created:
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/vercel-removal-decision.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b1.diff-review.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.before.json
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/bundle-size.before.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.b1.before.json
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.b1.after.json
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b1.before.sha256
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-01-lint.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-01-tsc.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-01-jest.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/batch-01-build.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.b1.txt
  modified:
    - package.json
    - package-lock.json
  deleted:
    - src/components/ui/dropdown-menu.tsx

key-decisions:
  - "Remove the vercel CLI outright rather than relocate it to devDependencies: relocation retains the whole subtree including the tar critical and buys nothing, because no lifecycle point invokes the CLI (four negative checks) and deployment is Vercel's git integration with buildCommand npm run build"
  - "yaml is NOT dead and was withdrawn from the batch: redoc@2.5.2's prebuilt bundles require('yaml') while declaring it in neither dependencies nor peerDependencies, and redoc is reachable from the public /docs route. Batch 1 removes ten declarations, not eleven, and yaml's moderate advisory row stays"
  - "Phase 1's reachability rule is insufficient as written: a src/-only grep cannot see a require() inside another dependency's prebuilt bundle. Batches 2-5 must also search node_modules/*/bundles and node_modules/*/dist before removing a non-application-facing package"
  - "The ~2,000-line lockfile-diff threshold is a proxy, not the property. At 8,842 lines the underlying property was checked directly — 299 entries removed, 0 added, 0 re-resolved — and the diff passed on that evidence rather than on the count"
  - "next_static_bytes does not reproduce the Phase 1 baseline (4491132 vs 4490961, +171 B). The measurement is sound and deterministic; the figure is recorded with the delta named rather than adjusted, and 02-11 must compare its after side against this plan's before file, never against versions.txt"
  - "An earlier reconciliation re-resolved yaml 2.8.2 -> 2.9.1 as a delete/re-add side effect; package-lock.json was restored from HEAD and reconciled once more so batch 1 is removals only and version-changed is 0"
  - "STAB-07, STAB-09, STAB-11 and STAB-16 are NOT marked complete — each has clauses this plan does not deliver (see Requirements)"

patterns-established:
  - "Structural lockfile diff: compare packages{} entry-by-entry for added/removed/version-changed/flag-flipped before trusting or distrusting a diffstat"
  - "Plugin-move verification beyond exit code: a Tailwind plugin can fail to load without failing the build, so the built CSS is grepped for the plugin's utilities"
  - "Pitfall predictions are tested, not assumed: Pitfall 9 predicted a ~zero route-bundle delta and the measured delta was exactly 0 on all 44 routes"

requirements-completed: [STAB-04]

duration: 35min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 04: Batch 1 — Remove the Root, Not the Leaves Summary

**Deleting two lines from `package.json` retired thirteen advisory rows, and deleting eleven retired twenty-three of thirty-eight — while the build refuted one of the eleven and proved Phase 1's dead-code rule had a blind spot.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-15T04:25Z
- **Completed:** 2026-09-15T05:00Z
- **Tasks:** 3 of 3
- **Files:** 12 created, 2 modified, 1 deleted

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `136f229` | docs(02-04): capture the batch-1 before side in two metric families |
| 2 | `5fd6745` | chore(02-04): batch 1 — remove ten dead declarations, pair-delete the dead Radix wrapper |
| 3 | `e33d116` | docs(02-04): record the STAB-04 decision and the batch-1 gate |

## What Changed

### Manifest

**Removed from `dependencies` (8):** `vercel` ^32.3.0, `swagger-ui-react` ^5.17.10,
`@swagger-api/apidom-ns-openapi-3-1` ^1.0.0-rc.3, `chart.js` ^4.5.1, `react-chartjs-2` ^5.3.1,
`@radix-ui/react-switch` ^1.2.6, `@radix-ui/react-tabs` ^1.1.13, `@radix-ui/react-dropdown-menu` ^2.1.16

**Removed from `devDependencies` (2):** `@types/swagger-ui-react` ^5.18.0, `baseline-browser-mapping` ^2.10.10

**Relocated (1):** `tailwindcss-animate` ^1.0.7, `dependencies` → `devDependencies`

**Deleted (1 source file):** `src/components/ui/dropdown-menu.tsx` — a pair removal. The Radix
dropdown package's only importer was that file, and that file had zero importers of its own.

**Survived by assertion:** `@vercel/analytics` and `@vercel/speed-insights` (imported by
`src/app/layout.tsx:3-4`, different packages from the CLI); `prettier` and `tsx` (knip hits
Phase 1 refuted by grep); `react` / `react-dom` byte-identical at `^18.3.0`.

### Results

| Metric | Before | After | Delta |
|---|---|---|---|
| Production advisory rows | 38 | 15 | **−23, 0 new** |
| — critical / high / moderate / low | 2 / 22 / 13 / 1 | 1 / 8 / 6 / 0 | |
| Production dependencies audited | 680 | 293 | −387 |
| Lockfile entries | 1,270 | 971 | −299 |
| `node_modules` | 999,564 KB | 710,644 KB | **−29%** |
| Route first-load JS (sum, 44 routes) | 39,846,495 B | 39,846,495 B | **0** |
| `.next/static` | 4,491,132 B | 4,489,846 B | −1,286 B |

The retired Critical is `tar`, which reached the production tree only through the CLI's
`@mapbox/node-pre-gyp` subtree. The surviving Critical is `next`, which batch 2 closes by version.

### Gate — all four exit 0

`npm run lint` 0 errors / 12 warnings (identical to the AUDIT-13 baseline) · `npx tsc --noEmit`
0 diagnostics · `npm test -- --ci` 247 passed / 36 skipped / 0 failed across 18 of 23 suites ·
`npm run build` exit 0 from a deleted `.next`. Smoke `9/10` with ring rows 5/6/8/10 at 4/4,
byte-for-byte the same verdicts as batch 0. `check-baseline.mjs` exits 0 with 21 passed / 0 failed.

## Deviations from Plan

### 1. [Rule 3 — Blocking] `yaml` is not dead; withdrawn from the batch

- **Found during:** Task 2, at the `npm run build` gate
- **Issue:** Removing `yaml` broke the build — `Module not found: Can't resolve 'yaml'` from
  `node_modules/redoc/bundles/redoc.browser.lib.js`, on the path
  `redoc → src/components/redoc/RedocUI.tsx → src/app/docs/page.tsx`. `redoc@2.5.2` ships
  prebuilt bundles that `require("yaml")` at runtime and declares it in **neither**
  `dependencies` **nor** `peerDependencies`. The root `yaml` declaration had been silently
  satisfying an undeclared dependency of `redoc`, and `redoc` is reachable and staying.
- **Fix:** Restored `yaml` to `dependencies` at its original `^2.8.2`. Build green; smoke row 7
  (`/docs` → 200) confirms the route works at runtime, not just at build time.
- **Why Phase 1 missed it, and why that matters more than the row itself:** `dead-code.md` row 9
  justified the removal with `git grep "from ['\"]yaml['\"]" -- src` → 0 matches. That grep is
  correct and the conclusion still does not follow, because a `src/`-only search cannot see a
  `require()` inside another dependency's prebuilt bundle. Phase 1's rule — "no dependency enters
  the dead list on knip alone; each hit carries the grep that confirmed or refuted it" — was
  followed to the letter and still produced a false positive, because the confirming grep had the
  wrong search domain.
- **Rule strengthened for batches 2-5** (written up in `lock.b1.diff-review.md` § 6): before
  removing a package that is not obviously application-facing, also search the installed tree —
  `command grep -rl "require(\"<pkg>\")\|from \"<pkg>\"" node_modules/*/bundles node_modules/*/dist`.
- **Net effect:** batch 1 removes **ten** declarations, not eleven; `yaml`'s moderate advisory row
  is one of the 15 that remain. The count is corrected rather than the requirement reinterpreted.
- **Commit:** `5fd6745`

### 2. [Rule 1 — Bug] Lockfile reconciliation silently bumped `yaml` 2.8.2 → 2.9.1

- **Found during:** Task 2, immediately after restoring `yaml`
- **Issue:** Deleting `yaml` and re-adding it made npm re-resolve it fresh against `^2.8.2`,
  landing on 2.9.1. Batch 1 is removals only; an unrequested minor bump is exactly the churn
  STAB-11 exists to catch.
- **Fix:** `git checkout -- package-lock.json` (single-file restore, not a blanket reset), then
  one `npm install --package-lock-only` from the corrected manifest. npm preserves an existing
  resolution that still satisfies its range, so `yaml` held at 2.8.2 and `version-changed` returned
  to 0.
- **Commit:** `5fd6745`

### 3. [Deviation from acceptance criterion] Lockfile diff is 8,842 lines, over the ~2,000 threshold

- **Found during:** Task 2, at the STAB-11 review gate
- **Assessment:** The threshold is a **proxy** for "did npm change anything I did not ask for". At
  this size the proxy is uninformative — removing the Vercel CLI and the Swagger/apidom stack was
  always going to produce a large diff. The underlying property was therefore checked directly,
  entry by entry: **299 removed, 0 added, 0 re-resolved, `lockfileVersion` 3 → 3**, plus 167
  `dev`-flag flips (165 of them prod → dev, which is the same fact as prod deps 680 → 293 seen from
  the lockfile side). The 2,591 "insertions" are flag-flip rewrites — git scores a rewritten entry
  as delete+insert — and not one is a new package.
- **Action:** Passed the gate on the structural evidence, not the count, and committed the method as
  `evidence/lock.b1.diff-review.md` so the claim is auditable. The threshold was **not** lowered.
- **Commit:** `5fd6745`

### 4. [Deviation from acceptance criterion] `next_static_bytes` does not reproduce the Phase 1 baseline

- **Found during:** Task 1
- **Issue:** Measured 4,491,132 B against `versions.txt`'s 4,490,961 B — **+171 B, +0.0038%**. The
  plan's task-1 acceptance asserts exact equality.
- **What was established** (all in `bundle-size.before.txt` § DRIFT): the two byte-count commands
  (macOS `stat -f%z` sum and the portable `cat | wc -c` pipeline) return the **same** integer on the
  same tree, so it is not a measurement artifact; two independent cold builds are byte-identical, so
  it is not build noise; the delta is uniformly +171 on **every** one of the 44 routes (sum delta
  7,524 = 44 × 171), localising it to one shared chunk; and no committed build input that Next reads
  changed between the baseline commit and HEAD. The two remaining candidates are `.env.local`
  (uncommitted, and phase-locked constraint 3 forbids reading it) and browserslist's date-relative
  `not dead` term.
- **Action:** The figure is recorded as measured with the delta named, **not** adjusted to match.
  Carried forward as a note for 02-11 (below).
- **Commit:** `136f229`

### 5. [Rule 2 — Missing evidence] Added `evidence/lock.b1.diff-review.md`

Not in the plan's file list. The STAB-11 gate is described as "a human read" of the diff, which
leaves no artifact; with the diff over threshold, the claim that it is nonetheless clean needed its
evidence on disk rather than in a commit message.

## Verification

| Check | Result |
|---|---|
| Task 1 verifier | 1 gap — `static-bytes-mismatch` (deviation 4), all other assertions pass |
| Task 2 verifier | 1 gap — `still-prod-dep:yaml` (deviation 1), all other assertions pass |
| Task 3 verifier | **Pass** — `batch-1 gate OK — high 22 -> 8` |
| `check-baseline.mjs` | **exit 0**, 21 passed / 0 failed |
| Repo-wide grep `ui/dropdown-menu` under `src/` | 0 matches |
| Built CSS carries animate utilities | `animate-in`, `fade-in-`, `zoom-in-`, `slide-in-from-`, `animate-out` all present |
| No `@vercel/*` row survives in the after census | confirmed |
| New advisory rows introduced | 0 |

Both verifier gaps are the two documented deviations, each with its evidence committed. Neither was
resolved by weakening an assertion.

## Threat Model Outcomes

| Threat | Outcome |
|---|---|
| T-02-04-01 tampering during reconciliation | **Closed by direct evidence** — 0 added, 0 re-resolved; the one bump that did occur (deviation 2) was caught and reverted |
| T-02-04-02 build losing Tailwind animation utilities | **Closed empirically** — build exit 0 *and* the utilities grepped out of the built CSS, because a plugin can fail to load without failing the build |
| T-02-04-03 surviving importer of the deleted wrapper | **Closed** — `tsc` clean, build clean, repo-wide grep 0 matches |
| T-02-04-04 `@vercel/*` group-removal | **Avoided and documented** — both packages asserted present; the near-miss written into the decision note so batches 2-5 inherit the warning |
| T-02-04-05 same-name replacement during re-resolution | **Closed** — 0 lock entries added; `npm ci` from the reviewed lockfile |
| T-02-04-06 unmeasured advisory claim | **Closed** — before and after censuses committed as JSON; the 23-row delta is derived from them |
| T-02-04-SC package installs | **N/A** — no package added; every manifest change is a removal or a section move |

## Requirements

**Marked complete: `STAB-04` only.**

| ID | Clauses | Verdict |
|---|---|---|
| **STAB-04** | `vercel` removed from production dependencies **and** the devDependency decision recorded | **Complete** — both clauses delivered (`5fd6745`, `evidence/vercel-removal-decision.md`) |
| STAB-07 | `swagger-ui-react` **and** `redoc` upgraded, isolated, or removed | **Pending** — `swagger-ui-react` removed; `redoc` is untouched at 2.5.2 and `/docs` is still anonymous (F-054, deferred to Phase 5/6). Half the requirement |
| STAB-09 | Remaining patch/minor upgrades in small labeled batches, each followed by the five checks | **Pending** — this was batch 1 of 5, and it was a *removal* batch, not a patch/minor upgrade batch. 02-11 closes it |
| STAB-11 | Lockfile reviewed as diffs, never regenerated; `--force` never used | **Pending** — satisfied for batch 1 and asserted across the commit range by the comparator, but it is a standing discipline through batch 5. 02-11 closes it |
| STAB-16 | Bundle size recorded before **and** after the dependency removals | **Pending** — the before side is delivered, and a batch-1 after-reading is recorded in `batch-01-build.txt`; the formal after side spans batches 2-5 and belongs to 02-11 |

This follows the phase precedent set at 02-01/02-03: a requirement is marked complete only when
every clause is delivered by the plan claiming it.

## Notes for Later Plans

1. **02-11 must compare its after side against `evidence/bundle-size.before.txt`, never against
   `.planning/audit/baseline/versions.txt`.** Phase 1's figure was measured on a different day and a
   different manifest; using it as the batch-1 before side would fold 171 unattributable bytes into
   whatever the batches get credited with.
2. **Batches 2-5: search the installed tree, not just `src/`, before removing a package.** Deviation 1
   is the worked example; the command is in `lock.b1.diff-review.md` § 6.
3. **Batch 2's `next` 16.2.1 → 16.3.5 retires the surviving Critical** and is the batch where
   route-bundle metrics are actually expected to move.
4. **`baseline-browser-mapping` still has a moderate row** and will keep it — it stays in the tree
   transitively via `browserslist` and `next`. Only the direct pin was removable, which is what the
   vulnerability policy's dev-promoted-to-prod clause already anticipated.
5. **The `/docs` route is now the last consumer of the Swagger/OpenAPI surface** (`redoc`,
   `next-swagger-doc`) and at 1.96 MB is by far the largest route bundle. Whatever Phase 5/6 decides
   about F-054 will move that number more than any dependency batch can.

## Known Stubs

None. No placeholder, mock, or empty-value path was introduced — every change in this plan is a
deletion, a section move, or an evidence capture.

## Self-Check: PASSED

All 12 created files verified present on disk; `src/components/ui/dropdown-menu.tsx` verified absent;
all three commit hashes (`136f229`, `5fd6745`, `e33d116`) verified present in `git log`.
