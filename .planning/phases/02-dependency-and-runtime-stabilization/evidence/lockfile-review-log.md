# Lockfile review log — STAB-11

**Plan:** 02-11 (batch 6c) · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Range reviewed:** `c7c5c49..01c7394` — the whole of Phase 2, from the commit `evidence/tools/majors.b0.json` recorded as `b0_commit` to the phase's last build-input commit.

> **STAB-11 reads: "`package-lock.json` changes are reviewed as diffs, never regenerated wholesale; `npm audit fix --force` is never used."** <!-- planner-discipline-allow: audit fix -->
> Three claims, three attestations, each below backed by a command and its actual output rather than asserted. Every figure was re-derived in this working tree on 2026-09-15; nothing is transcribed from a planning document or from a prior summary.

---

## 1. Per-batch record

Six commits in this phase touched `package-lock.json`. Two batches touched it not at all and are listed anyway, because a gap in a row sequence reads as an omission and these two are deliberate.

The **diff lines** column is `git diff --numstat <sha>^ <sha> -- package-lock.json` as insertions + deletions. The **entries** columns are the *structural* comparison established in `evidence/lock.b1.diff-review.md` § 1 — lock-entry keys added, removed and re-resolved — because a line count cannot distinguish "one very large dead subtree left the tree" from "npm quietly upgraded forty packages," and the second is the thing STAB-11 exists to forbid.

| Batch | Commit | Diff lines (`+`/`−`) | Entries before → after | Removed / added | What moved |
|---|---|---:|---:|---:|---|
| **b0** — toolchain pin | `1e2647e` | 46 (12 / 34) | 1270 → 1270 | 0 / 0 | `@types/node` 20 → 24, forced by the Node 24 `engines` pin. Version-changed only: not one entry was added or removed, which is the shape a single in-place range change is supposed to have. |
| **b1** — removals | `5fd6745` | **8,842** (2,591 / 6,251) | 1270 → 971 | **299 / 0** | Ten dead declarations, dominated by the `vercel` CLI and the `swagger-ui-react` / apidom stack. The largest diff in the phase and the cleanest: 299 entries left, **0 arrived, 0 re-resolved**. Reviewed entry-by-entry in `evidence/lock.b1.diff-review.md`. |
| **b2** — framework patch | `cf6b3c9` | 533 (303 / 230) | 971 → 972 | 1 / 2 | `next` 16.2.1 → 16.3.5 alone, which re-pins `postcss` and `sharp` underneath it. `react` and `react-dom` byte-identical on all four values (declared range and resolved version, both packages). |
| **b3** — proxy rename | `0d66a1d` | **0** | 972, untouched | — | `src/middleware.ts` → `src/proxy.ts`. A file rename touches no dependency; the lockfile was not opened. Listed so the absence is visible. |
| **b4a** — patch/minor | `77f6e63` | 412 (302 / 110) | 972 → 984 | 1 / 13 | Patch bumps, in-range transitive lifts, and a browserslist refresh whose own two lockfile writes (`caniuse-lite`, `baseline-browser-mapping`) were isolated and reviewed separately — the refresher shells out to install/uninstall internally, so verifying `package.json` was untouched by it was not optional. |
| **b4b** — Supabase SDK | `695ec1e` | **0 net** | unchanged | — | The `@supabase/supabase-js` 2.81.1 → 2.116.0 minor was applied, reconciled, installed, gated, and **reverted** when `npx tsc --noEmit` exited non-zero with six `TS2345` errors. `package.json` and `package-lock.json` end byte-identical to b4a. Decision recorded in `evidence/supabase-js-decision.md`; deferred to Phase 3. |
| **b5** — test harness | `0556444` | 1,392 (1,304 / 88) | 984 → 1071 | 0 / 87 | `jest-environment-jsdom` and three `@testing-library/*` packages, all **devDependencies**. 87 entries arrived and **0 left**, which is the shape an install is supposed to have — nothing was displaced to make room. |
| **b6a** — postcss override | `445f7dc` | **57** (0 / 57) | 1071 → 1069 | **2 / 0** | `overrides: { postcss: "^8.5.28" }`, collapsing the nested duplicate copies under `styled-components` into the single patched root copy, closing the phase's last production High. **0 insertions.** Reviewed in `evidence/lock.b6.diff-review.md`. This is a manifest change the phase had forbidden itself; see § 5. |

**Phase net:** 1,270 → **1,069** lock entries, −201. Reproduce:

```bash
node -e '
const {execSync}=require("child_process");
const B=JSON.parse(execSync("git show c7c5c49:package-lock.json",{maxBuffer:1e9})).packages;
const A=JSON.parse(require("fs").readFileSync("package-lock.json")).packages;
console.log(Object.keys(B).length, "->", Object.keys(A).length);'
# -> 1270 -> 1069
```

---

## 2. Attestation 1 — the lockfile was never regenerated wholesale

Every change above came from reconciling the lockfile against a **hand-edited `package.json`** with `npm install --package-lock-only`, which rewrites only what the manifest edit forces. The lockfile was never deleted and rebuilt, and `npm ci` was the only command that ever consumed it.

**The version field never moved.** A wholesale regeneration on npm 11 is the single most likely way for `lockfileVersion` to change:

```bash
node -p "require('./package-lock.json').lockfileVersion"
# -> 3
git show c7c5c49:package-lock.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).lockfileVersion))'
# -> 3
```

`3 → 3`, unchanged across the whole phase. This is also asserted mechanically on every comparator run — `check-baseline.mjs --check lockfile-discipline` reads `lockfileVersion` out of `evidence/tools/majors.b0.json` and compares:

```bash
node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs --check lockfile-discipline
# -> PASS lockfile-discipline :: lockfile-version-unchanged :: 3 -> 3
# -> PASS lockfile-discipline :: no-forced-remediation-in-commit-range ::
#      c7c5c496d0ca1061932a884bce997a9382d4cbba..HEAD clean
# -> --- 2 passed, 0 failed, 0 skipped
```

**The stronger evidence is arithmetic, not a field.** A regeneration rewrites every entry it touches; it cannot produce a diff with **zero insertions**. Batch 6a's diff is `0 / 57` — 57 lines deleted, not one line added — and batch 1's is `299 removed / 0 added / 0 re-resolved`. Neither shape is reachable by regeneration. Batch b0's is `0 removed / 0 added` across 1,270 entries, from a 46-line diff: a regeneration of a 1,270-entry lockfile that changed 46 lines and no entry keys does not exist.

---

## 3. Attestation 2 — no forced remediation command was ever run

Searched across **every commit message in the phase range**, body included. The honest version of this search has two parts, because the naive one has a hit.

**The naive search — one hit:**

```bash
git log --format=%B c7c5c49..HEAD | command grep -icE 'npm[[:space:]]+audit[[:space:]]+fix'
# -> 1
```

**The hit, quoted in full:**

```bash
git log --format='%h %B' c7c5c49..HEAD | command grep -inE 'npm[[:space:]]+audit[[:space:]]+fix'
# -> 342:npm audit fix was not run. check-baseline's no-forced-remediation-in-commit-
```

It is a **denial**, in the body of batch 6a's commit, recording that the command was not used. A search that counts a sentence saying "X was not run" as evidence that X was run is measuring the wrong thing — but suppressing the hit silently would be worse, so both are printed.

**The discriminating search — zero hits.** Negations are excluded and nothing remains:

```bash
git log --format=%B c7c5c49..HEAD \
  | command grep -iE 'npm[[:space:]]+audit[[:space:]]+fix' \
  | command grep -ivE 'never|forbidden|not run|was not|detect' \
  | wc -l
# -> 0
```

`check-baseline.mjs` applies exactly this filter (`FORCED_REMEDIATION` matched against the phase commit range, negations excluded) and reports `no-forced-remediation-in-commit-range :: c7c5c49…..HEAD clean` (it prints the full 40-character SHA). It is worth noting that the comparator builds its own pattern from fragments rather than as one literal, precisely so the detector cannot become its own first false positive.

**The pre-phase counter-example, which is why this attestation is not a formality.** `git log` on this repository contains a commit from 2026-01-31 titled *"changes after I ran npm audit fix --force"* (`0ff21db`). The command has been run on this tree before, by a human, with the lockfile consequences that implies. It was not run in Phase 2.

---

## 4. Attestation 3 — every batch's diff was read as a diff

The line counts in § 1 exist to be quoted because someone read them at the time. The mechanism was the same in every batch:

1. **Hash the lockfile before the batch opens.** Six `evidence/lock.b*.before.sha256` files are committed, one per batch, each written before that batch's manifest edit:

   ```bash
   ls .planning/phases/02-dependency-and-runtime-stabilization/evidence/lock.b*.before.sha256
   # -> lock.b0.before.sha256  lock.b1.before.sha256  lock.b2.before.sha256
   #    lock.b4.before.sha256  lock.b5.before.sha256  lock.b6.before.sha256
   ```

2. **Hand-edit `package.json`, then reconcile** with `npm install --package-lock-only`. Never a delete-and-rebuild.

3. **Read the resulting diff** — as a line diff first, and then structurally when the line count was large enough that a line diff stopped being informative. Two batches produced standalone review documents because their diffs needed argument rather than inspection: `evidence/lock.b1.diff-review.md` (8,842 lines, reduced to `299 / 0 / 0`) and `evidence/lock.b6.diff-review.md` (57 lines, `2 / 0 / 0 / 0 flag flips`). The remaining four were reviewed inline and their figures recorded in their plans' summaries.

4. **Then install, then run the five-part gate**, and only then commit.

The structural method was introduced in batch 1 for a specific reason worth preserving: the plan carried a "~2,000 changed lines" warning threshold, batch 1 blew through it at 8,842, and the threshold turned out to be a **proxy** for the property that mattered — *did npm change anything I did not ask it to?* That property was then checked directly, and the proxy was retired rather than loosened. The same substitution happened twice more in this phase, to the lint gate (aggregate warning count → per-rule tally, plan 02-05) and to the bundle-size comparison (one column → two metric families, plan 02-10).

---

## 5. The one thing this log must not let a reader miss

**Batch 6a changed `package.json`, and plan 02-09 had forbidden itself from doing that.** `phase_locked_constraints` #7 and threat `T-02-09-SC` both said no manifest change. The `overrides: { postcss: "^8.5.28" }` entry was shipped anyway, on a **recorded user decision (Adyan Ullah, 2026-09-15)** taken at a checkpoint after the contradiction was surfaced: the phase's last production High could not be closed by an exception-register row, because a register row cannot change an exit code, and the CI vulnerability gate could not be both added and green while it stood.

The authoritative record is **`02-09-SUMMARY.md` § Deviations**. The compensating controls granted alongside the decision were the entry-by-entry review in `evidence/lock.b6.diff-review.md` and smoke row 7. The alternative that was rejected — pinning `styled-components` to `^6.5.3`, as plan 02-07 had recommended — is **infeasible on this tree**: every release that drops the `postcss` dependency also adds `react-native` as an optional peer, which peer-requires `react@^19`, which collides with phase-locked constraint 1 (`react` / `react-dom` untouched). The attempt is recorded in `evidence/VULNERABILITY-POLICY.md` § Exception register rather than the recommendation being quietly dropped.

The override also moves `next`'s own pinned `postcss` 8.5.23 → 8.5.28. That is a transitive consequence of a root override and is stated here so it is not discovered later as a surprise.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-11 (batch 6c) — task 1*
