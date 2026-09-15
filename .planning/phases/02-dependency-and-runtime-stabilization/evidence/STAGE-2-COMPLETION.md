# Stage 2 Completion Note — the exit gate, evidenced

**Plan:** 02-11 (batch 6c) · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Tree:** `main` @ `14894f8` · **Last build-input commit:** `01c7394` · **Phase range:** `c7c5c49..HEAD`

> **The Stage 2 exit gate is MET, on all five of its clauses, and Stage 3 may start.**
>
> Zero unexplained Critical production vulnerabilities. Zero reachable High, closed by fixing rather than by excepting, so the exception register is examined-and-empty rather than unfilled. A reproducible install proven from a fresh clone on the pinned runtime. Checks green and strictly better than the AUDIT-13 baseline on both of the numbers that matter. A lockfile reviewed as diffs on every batch, never regenerated wholesale, with no forced remediation anywhere in the commit range.
>
> **Four requirements are partially met and are NOT claimed as complete: STAB-02, STAB-06, STAB-09 and STAB-14.** None of them is a clause of the exit gate. Each is named in § 13 with exactly what is missing and the single act that closes it. Three of the four are waiting on one thing: **a push.**

---

## How to read this note

The standard this note has to meet is not "the work is done." It is **"a reader can confirm the work is done from committed artifacts alone, without re-running anything."** That is a higher bar and it is the bar that lets Phase 3 start.

So: **every figure below is quoted from a committed file, cited by path.** A number that is not in one of those files does not appear here. Where a figure is a count, the command that re-derives it is given rather than the number being asserted. This follows the Phase 1 rule that `.planning/audit/baseline/versions.txt` is the only count authority and a planning document is never the authority for a count about the code.

Where the artifacts contradict a claim, the claim is **withheld**. That is also Phase 1 precedent (AUDIT-13 and AUDIT-20 were withheld from plan 01-01 for the same reason), and it has now been applied eight times in this phase — by plans 02-01, 02-02, 02-04, 02-05, 02-06, 02-07, 02-08 and 02-09 — each reverting a requirement that `requirements mark-complete` had optimistically ticked. Withholding is not reflexive here. Twelve of seventeen requirements **are** claimed complete. The five that are not, are not, for reasons a reader can check.

---

## 1. No unexplained Critical production vulnerabilities — MET

| | Critical | High | Moderate | Low | Total | Prod deps |
|---|---:|---:|---:|---:|---:|---:|
| **Before** — `evidence/audit.phase-start.json` | **2** | **22** | 13 | 1 | 38 | 680 |
| **After** — `evidence/audit.after.json` | **0** | **0** | 2 | 0 | **2** | 298 |

Both files are `npm audit --omit=dev --json` output, committed unmodified and never hand-edited. Re-derive either side:

```bash
node -e "console.log(require('./.planning/phases/02-dependency-and-runtime-stabilization/evidence/audit.after.json').metadata.vulnerabilities)"
# -> { info: 0, low: 0, moderate: 2, high: 0, critical: 0, total: 2 }
```

The two Criticals were retired by two different mechanisms, which is worth keeping separate: **batch 1** removed `tar`, reachable only through the `vercel` CLI's `@mapbox/node-pre-gyp` subtree, by deleting the CLI (`5fd6745`); **batch 2** retired the `next` Critical by version (`cf6b3c9`). Neither was risk-accepted — clause 2 of `evidence/VULNERABILITY-POLICY.md` forbids it, inheriting the sentence verbatim from `.planning/audit/SEVERITY_SLA.md`.

**The two surviving Moderates are named, not aggregated.** From `evidence/audit-gate-local.txt`, which is the verbatim gate command output:

| Package | Severity | Path | Disposition |
|---|---|---|---|
| `dompurify` `<=3.4.12` | moderate | via `redoc` | Fourteen advisories, one family. Below the gate threshold; clause 4 — tracked, not blocking. |
| `yaml` `2.0.0 - 2.8.2` | moderate | direct, plus four nested copies under the `oas-*` / `swagger2openapi` chain | **`yaml` stays, and it is not dead code.** `redoc@2.5.4`'s prebuilt bundle `require()`s it while declaring it in neither `dependencies` nor `peerDependencies`. Phase 1's dead-code register listed it as removable; batch 1 discovered by **build failure** that it is not, and batch 4 re-verified that on the new redoc version rather than assuming the finding still held. |

---

## 2. No reachable High without a dated, owner-signed exception — MET, with zero rows

**The High count is zero, so the exception register in `evidence/VULNERABILITY-POLICY.md` § Exception register is empty. It is empty because the Highs were FIXED, not because they were excepted, and not because nobody filled the table in.** The policy says so in its own words, precisely so a reader can tell an examined-and-empty register from an unfilled one.

**The one High that reached the last batch, and how it closed.** After batch 4 exactly one production High survived: `postcss` 8.4.49 at lockfile node `node_modules/styled-components/node_modules/postcss` — `GHSA-6g55-p6wh-862q` and `GHSA-r28c-9q8g-f849`, reached by `redoc` → `styled-components@6.3.8` (an auto-installed **peer**) → `postcss`. It was fixed by a root `overrides: { postcss: "^8.5.28" }` entry, collapsing the nested duplicates onto the patched root copy. Lockfile effect: **2 entries removed, 0 added, 0 re-resolved, 0 flag flips**, reviewed entry-by-entry in `evidence/lock.b6.diff-review.md`.

**This required a manifest change that plan 02-09 had forbidden itself, and the deviation is carried forward here rather than left in one summary.** `phase_locked_constraints` #7 and threat `T-02-09-SC` both said no manifest change. The constraint was set aside on a **recorded user decision (Adyan Ullah, 2026-09-15)** taken at a checkpoint, once the contradiction was surfaced: an exception-register row cannot change an exit code, so with a High present the CI gate could not be both added and green. `02-09-SUMMARY.md` § Deviations is the authoritative record. The compensating controls granted alongside it were the entry-by-entry lockfile review and smoke row 7. The rejected alternative — pinning `styled-components` to `^6.5.3` as plan 02-07 recommended — is **infeasible on this tree**: every release that drops the `postcss` dependency adds `react-native` as an optional peer, which peer-requires `react@^19`, colliding with the phase's first locked constraint. The override also moves `next`'s own pinned `postcss` 8.5.23 → 8.5.28, stated so it is not discovered later as a surprise.

---

## 3. Reproducible install — MET

`evidence/cleanroom-npm-ci.txt`, the seven-step protocol at **`01c7394`**, run in a clone outside the working tree. **Twenty `exit_code=` lines, every one of them 0:**

| Step | Result |
|---|---|
| 1 fresh clone of `main` at `01c7394` | exit 0; the untracked local secrets file asserted **ABSENT**, never created or copied |
| 2 runtime asserted against `engines` **before** installing | node 24.16.0 vs `engines.node 24.x` SATISFIED · npm 11.13.0 vs `>=11` SATISFIED · `.nvmrc` 24 agreeing with both |
| 3 lockfile hash, `shasum -a 256` | `842ed8a7…` in the clone **and** in the working tree — MATCH |
| 4 `rm -rf node_modules .next` then `npm ci` | 989 packages, exit 0 |
| 5 build with the two CI placeholder values | 140 route rows, exit 0 |
| 6 `npx jest --ci` | **278 passed / 5 skipped / 0 failed**, exit 0 |
| 7 post-install assertions | `git status --porcelain` empty; lockfile re-hash byte-identical to step 3 |

`npm ci` is used and the non-deterministic installer is not, because failing loudly when the manifest and the lockfile disagree **is** the property under test. Step 7's empty `git status` and unchanged re-hash are the proof that the install rewrote nothing.

Compared against the interim run at `695ec1e` (`evidence/cleanroom-interim.txt`): +85 packages and +31 passing / −31 skipped, both attributable to batch 5's dev-only jsdom harness. What must not differ does not — every step still exits 0, the build still emits 140 route rows, the install still rewrites nothing.

**One line in that capture must be read correctly.** `npm ci` printed *"9 vulnerabilities (3 low, 3 moderate, 2 high, 1 critical)"*. **That is the full tree, dev included** — npm's post-install summary has no `--omit=dev` equivalent. It is not the production census and it is not what § 1 measures. The line was left unedited rather than trimmed to make the document read better.

---

## 4. Checks green at or better than the AUDIT-13 baseline — MET

Every baseline figure is parsed at run time out of the Phase 1 captures by `evidence/tools/check-baseline.mjs`; not one reference number is a literal in that file. Baselines below come from `.planning/audit/baseline/jest.txt`, `lint.txt`, `tsc.txt` and `build.txt`.

| # | Check | AUDIT-13 baseline | Measured, final tree | Verdict |
|---|---|---:|---:|---|
| 1 | **Passing tests** | **220** | **278** | **+58** |
| 2 | **Skipped tests** | **36** | **5** | **−31** |
| 3 | Executing suites | 16 of 21 | 22 of 23 | +6 executing |
| 4 | `tsc --noEmit` diagnostics | 0 | 0, zero bytes on stdout and stderr | held |
| 5 | eslint warnings / errors | 12 / 0 | 19 / 0 | see below |
| 6 | `npm run build` exit | 0 | 0 | held |

```bash
node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
# -> --- 22 passed, 0 failed, 0 skipped   (exit 0)
```

**Both the pass count and the skip count are quoted, because quoting only the first would be dishonest.** The baseline's **220** passing was already satisfied by a tree in which **five suites never executed** — 16 of 21 — which is exactly why the requirement names two numbers and why `evidence/tools/check-baseline.mjs` asserts three separate jest rules rather than one. A tree that kept 220 passing and 36 skipped would have passed a single-number gate while changing nothing.

**Row 5 is the one that needs an argument, and it makes the gate stricter rather than looser.** 19 warnings against a baseline of 12 looks like a regression and is not one. Batch 2 moved `eslint-config-next` 16.0.3 → 16.3.5, which ships rules that did not exist when the baseline was captured. The comparator was changed from an aggregate threshold to a **per-rule tally**:

```
PASS lint :: zero-eslint-errors :: 0 errors
PASS lint :: no-baseline-rule-regressed :: 4 baseline rule(s) compared, none above baseline
PASS lint :: warning-delta-fully-attributed :: 19 warnings vs baseline 12 (delta +7);
     7 from rule(s) absent at baseline: @next/next/no-location-assign-relative-destination x7
```

All twelve baseline warnings are unchanged; all seven new ones come from a single rule that did not exist at baseline; the arithmetic reconciles exactly. **A single extra warning on any rule that existed at baseline now fails**, where under the old aggregate threshold it could have hidden under an unchanged total. The seven new warnings are a real finding about `window.location` assignment and were **deliberately not fixed** — they are behaviour-adjacent source changes, triaged to Phases 5–6 by plan 02-05.

Per-batch captures for all four commands are committed: `evidence/batch-06-jest.txt`, `evidence/batch-06-lint.txt`, `evidence/batch-06-tsc.txt`, `evidence/batch-06-build.txt`, and the same set for batches 00 through 05.

---

## 5. Reviewed lockfile — MET

`evidence/lockfile-review-log.md` is the full record. Per-batch diff line counts, with the structural entry delta beside each, because a line count cannot distinguish a dead subtree leaving from forty quiet upgrades:

| Batch | Commit | Diff lines | Entries removed / added |
|---|---|---:|---:|
| b0 toolchain pin | `1e2647e` | 46 | 0 / 0 |
| b1 removals | `5fd6745` | **8,842** | **299 / 0** |
| b2 framework patch | `cf6b3c9` | 533 | 1 / 2 |
| b3 proxy rename | `0d66a1d` | **0** | — |
| b4a patch/minor | `77f6e63` | 412 | 1 / 13 |
| b4b Supabase SDK | `695ec1e` | **0 net** (reverted) | — |
| b5 test harness | `0556444` | 1,392 | 0 / 87 |
| b6a postcss override | `445f7dc` | **57** (0 insertions) | 2 / 0 |

Phase net: **1,270 → 1,069** lock entries.

**Never regenerated wholesale.** `lockfileVersion` is 3 at `c7c5c49` and 3 at HEAD. The stronger evidence is arithmetic: a regeneration rewrites every entry it touches and cannot produce a diff with **zero insertions**, which b6a's is.

**No forced remediation, anywhere in the range.** The naive commit-message search has exactly one hit and the log quotes it in full — it is a *denial* in b6a's own commit body. The discriminating search, with negations excluded, returns 0, and `check-baseline.mjs --check lockfile-discipline` agrees. Worth knowing: `git log` on this repository contains a pre-phase commit titled *"changes after I ran npm audit fix --force"* (`0ff21db`, 2026-01-31). The command has been run on this tree before, by a human. It was not run in Phase 2.

Two batches produced standalone reviews because their diffs needed argument rather than inspection: `evidence/lock.b1.diff-review.md` and `evidence/lock.b6.diff-review.md`.

---

## 6. CycloneDX SBOM — MET

`sbom.cyclonedx.json`, committed at the repository root. Provenance in `evidence/sbom-generation.txt`.

| Property | Value |
|---|---|
| Format / spec | CycloneDX, spec version **1.6**, pinned explicitly rather than accepting the tool's default |
| Components | **320** |
| Scope | production tree only (`--omit dev`) — the same scope as the vulnerability policy and the CI gate |
| Source | **`--package-lock-only`: generated from the lockfile, not from `node_modules`** |
| Schema validation | `--validate` → `INFO BOM result appears valid`, exit 0 |
| Byte stability | `--output-reproducible`: `serialNumber` and `metadata.timestamp` are both **absent** from the emitted document, so a re-run produces a byte-identical file and any diff is a real dependency change |
| Manifest side effects | `package.json` and `package-lock.json` SHA-256 taken before and after the run, identical on both sides. Nothing was installed; the generator is a one-shot pinned `npx` invocation and is not added to `package.json` |

`--package-lock-only` is the load-bearing flag. Reading `node_modules` would make the document a description of one machine's disk — platform-dependent optional dependencies included — and the byte-stability guarantee would be false.

---

## 7. Update automation configured — CONFIGURED; THE BOT IS NOT INSTALLED

`renovate.json` at the repository root, validated in `evidence/renovate-validation.txt`:

- `renovate-config-validator --strict` exit 0 in **both** modes — with an explicit path (global-config validation, the looser mode) and in auto-discovery mode, which validates it as a **repository** config and is the mode that actually matters.
- Two **negative controls** were run, because a validator that exits 0 on everything proves nothing. A bogus top-level key is rejected with exit 1.
- Three update groups (supabase, test harness, next), and exactly one auto-merge rule covering `patch` / `pin` / `digest` only — majors are never auto-merged, asserted structurally rather than read.

> **`renovate_github_app_installed = NO EVIDENCE OF INSTALLATION — treat as NOT INSTALLED.`**

**A configuration file with no bot behind it configures nothing, and this note does not imply otherwise.** The authoritative endpoint requires a GitHub App JWT that a user token cannot mint (`gh api /user/installations` → 403). Four indirect probes were run instead; the strongest is that Renovate opens a "Configure Renovate" onboarding PR within minutes of installation and thereafter maintains a Dependency Dashboard issue, and this repository has **zero** PRs or issues ever authored by `app/renovate`. That is strong evidence the app has never been installed. It is **not proof** — an installation made minutes ago, or one scoped to exclude this repository, would look identical.

**The human step, unambiguously:** install the app at `https://github.com/apps/renovate` on the owning organisation, grant it this repository, and confirm the Dependency Dashboard issue appears.

---

## 8. Bundle size before and after — MET

`evidence/bundle-size.md`, with `evidence/bundle-size.before.txt` (captured by plan 02-04 at `3a2bee6`, `next@16.2.1`) and `evidence/bundle-size.after.txt` (plan 02-10 at `e95714b`, `next@16.3.5`) as the two sides. The after side compares against the **before capture**, never against `.planning/audit/baseline/versions.txt`: the Phase 1 baseline was measured on a different day and a different manifest, and folding its **+171 B of unattributable drift** into this phase's delta would credit a dependency removal with bytes it did not move.

**Two metric families, deliberately, because one column would have made one of them look like a failure.**

| Family | Metric | Before | After | Delta |
|---|---|---:|---:|---:|
| Route-bundle | `first_load_js_sum` | 39,846,495 B | 37,328,142 B | **−2,518,353 B (−6.32%)** |
| Route-bundle | `next_static_bytes` | 4,491,132 B | 4,014,162 B | **−476,970 B (−10.62%)** |
| Route-bundle | `routes` | 44 | 44 | 0 |
| Install-tree | `prod_pkg_count` | 786 | 354 | **−432 (−54.96%)** |
| Install-tree | `node_modules_kb` | 999,564 KB | 723,520 KB | −276,044 KB (−27.62%) |
| Install-tree | `audit_prod_total` | 38 | **2** | −36 |

**The honest part: the batch-1 removals moved install-tree metrics and not route bundles.** The ten declarations batch 1 removed had **zero importers**, so Turbopack had already tree-shaken every one of them out of every route bundle before this phase began. Their measured route-bundle delta was **exactly 0 B on all 44 routes.** That is the *correct* result, not a disappointing one, and it is why this document has two families instead of one: a reader looking only at `first_load_js_sum` would conclude that removing 432 packages achieved nothing. The route-bundle movement is **batch 2's**, almost in full — `next` 16.2.1 → 16.3.5 rewriting the framework chunks. Batches 3–6 account for **+1,109 B** of it, and `node_modules_kb` grew back **+12,876 KB** across batches 2–6, almost all of it batch 5's dev-only jsdom harness — a key that is prod + dev and therefore *understates* the production removal.

---

## 9. The npm configuration warning — MET as documentation; the CI side is unobserved

`evidence/devdir-investigation.md`.

- **Four-scope probe: `devdir` is unset in all four of npm's configuration scopes** — project, user, global, env — and no npm command on this tree emits an unknown-config warning.
- **Emitter identified:** `devdir` is a **node-gyp** configuration key that npm removed from its schema. npm 11 emits it as an *unknown config* warning naming the scope it came from. It is **machine state, not repository state.** No repository file was edited to chase it, and that is the deliberate outcome rather than an omission.
- The probe deliberately captures only the `userconfig` / `globalconfig` path lines and the single `devdir` result. A full `npm config ls -l` dump is **not** committed: it can contain `//registry.npmjs.org/:_authToken`, and `.planning/` is the wrong place for a credential.
- **CI side: `ci_npm_unknown_config = unobserved`**, for two verified reasons rather than for lack of trying — no pushed batch-0 run exists, and the most recent completed run's logs return **HTTP 410**, GitHub having expired them. What would close it is one readable CI `Install dependencies` log, grepped for `Unknown .* config`.

---

## 10. The CLI removal decision — MET

`evidence/vercel-removal-decision.md`.

> **Decision: remove `vercel` outright. Do not relocate it to `devDependencies`.**

The CLI was a production dependency at `^32.3.0`, is invoked by nothing in this repository at any lifecycle point, and rooted the single Critical advisory in the production tree. **Relocating it would have preserved that subtree — `tar` Critical included — in the dev tree, in exchange for no capability the project uses.** Three negative checks back the "invoked by nothing" claim, each re-runnable and each annotated with the result it produced: the CI workflow never invokes it, no npm script invokes it, and no source file imports it. This one line retired **7 of the 24** High/Critical rows in the Phase 1 census.

---

## 11. The file-convention migration, before and after — the rename is evidenced; TWO CLAUSES ARE NOT

`evidence/proxy-migration-note.md` is the record. `src/middleware.ts` → `src/proxy.ts` landed as one atomic commit (`0d66a1d`) touching nothing else.

**Delivered and evidenced:**

- **Characterization before and after:** `evidence/proxy.before.txt` and `evidence/proxy.after.txt` — 27 assertions written against **unmodified production source** before the rename, so the migration had a real before to diff against, and re-run identically after.
- **The rename diff:** `evidence/proxy.rename-diff.txt`, captured with `git diff -M` so it reads as a rename rather than a delete-plus-add.
- **Tier 2 smoke either side:** `evidence/smoke.b3.before.txt` and `evidence/smoke.b3.after.txt`. **The rate limiter is smoke-tested on both sides** — row 8, 31 POSTs to `/api/events`, `429` with `Retry-After: 60`, identical before and after. Rows 5 and 6 confirm the protected-route redirect ring (`307` → `/?signin=required&next=…`) survived the rename.

**NOT delivered, and stated plainly rather than glossed:**

- **The ban-check clause is not covered by automated evidence in this phase.** STAB-06 asks for the rate limiter *and* the ban-check behaviour smoke-tested before and after. Exercising the ban check requires a session belonging to a banned user; that requires the deterministic seed, which is **Phase 3**. Tier 2 is anonymous by contract and no tier available in this phase can produce it. The honest evidence for the ban check after this rename is two things, neither of which is a behavioural test: the rename diff showing the block moved byte-identically, and Tier 3 step 4 once run. **The assertion that a banned user is redirected and a non-banned user is not lands in `CERT-05`, the Phase 7 persona matrix, against the Phase 3 seed.** Threat `T-02-06-03` is dispositioned against that, not against this phase.
- **Tier 3 human verification against a preview deployment is OUTSTANDING.** The note's § 9 carries an empty preview-deployment URL and an empty date, awaiting the run. It is blocked on the same thing three other items are blocked on: nothing has been pushed.

Rollback, if it is ever wanted, is `git revert 0d66a1d`.

---

## 12. What this phase did **not** close

Four items, each stated so that nothing downstream reads a silence as a pass.

**12.1 — The tsconfig test-file exclusion remains, so `F-066` is PARTIALLY closed.** The installable skips are cleared: four suites blocked by an uninstalled `@testing-library/react` now execute, and the suite count moved 16-of-21 to 22-of-23. The whole-program type-check hole did not close — `tsconfig.json` still excludes all test files, which is what made `F-050`'s excess-property error invisible in the first place. **Phase 3 is its natural home**, alongside the generated Supabase types and the type-drift check, because all three are the same problem: the type system is not currently looking at everything it should. The register now records `F-066` as `Open`, `closes_in_phase: 03`, with the split written into its resolution note.

**12.2 — The contract-drift suite stays skipped, and its contract question goes to Phase 4.** `src/app/api/events/route.test.ts` is the fifth suite and **no install revives it**: it asserts a cursor-pagination contract and the handler has no cursor concept at all. Which of the two is wrong is genuinely unknown, so reviving it against the handler's current behaviour would **freeze a possible defect as the specification.** The suite is not rewritten, not deleted, and the route handler is not edited. The contract question belongs to **`REFAC-10`** — the event read path slice in Phase 4. Full per-suite reasoning in `evidence/skipped-suite-disposition.md`.

**12.3 — The shared-cache exposure is NOT fixed, and the distinction matters.** `F-025` remains **Open at Critical**. Phase 2 closed the `next` cache-poisoning **advisories** by version. It did not touch the **precondition** those advisories need, and Phase 1 proved that precondition is live on this deployment by measurement rather than inference: eight personalized routes returned `x-vercel-cache` HIT or STALE with non-zero age under the blanket `s-maxage=60` directive, and **not one response in the entire run varied on `Cookie` or `Authorization`** — every `vary` read `accept-encoding` and nothing else. A cache entry is therefore keyed by URL alone. **A closed advisory is not a removed precondition.** The fix is a behaviour change, and making it inside a dependency phase would have destroyed the one property this phase exists to preserve — that the before/after smoke pass means something. It lands in **`REFAC-19`**, Phase 6, which deletes the blanket rule from `vercel.json`, returns `private, no-store` on personalized routes, and adds the cross-user cache regression test. This plan corrected `F-025`'s `closes_in_phase` from 05 to **06** to agree with the roadmap. `F-026`, `F-027` and `F-028` carry the same disagreement and were deliberately left alone as outside this plan's scope — filed in `evidence/deferred-items.md` for whoever plans Phase 5.

**12.4 — The Supabase SDK is DEFERRED, not shipped.** `evidence/supabase-js-decision.md`. The `@supabase/supabase-js` 2.81.1 → 2.116.0 minor — 35 minors — was applied, reconciled, installed and gated. It **failed the second gate command outright**: `npx tsc --noEmit` exited 2 with six `TS2345` errors across six data-mutation API routes, every one silenceable only by a cast or by widening an update payload's type, which is the exact warning sign the plan had named in advance as disqualifying. The sub-commit was reverted; `package.json` and `package-lock.json` are byte-identical to the batch-4a commit, and step 7 of the clean room independently confirms `2.81.1` resolves in a fresh install. The bump **closes no advisory**, so nothing security-relevant is being deferred. **Phase 3 inherits:** 35 minors of drift, six typed call sites that need real fixes rather than casts, and `@supabase/ssr`'s separate 0.7 → 0.12 **major**, which was never in scope for Phase 2.

**One more thing this note must not let pass silently.** `.claude/CLAUDE.md` — the agent-facing instruction file — was corrected on disk by this plan (Vitest → the real two-project Jest harness, Node 20 → 24, the removed swagger and Radix packages delisted, the "no test step in CI" claim replaced). **It is not in git history: `.claude/` is gitignored at `.gitignore:43` and the file has never been tracked.** It was not force-added; overriding a deliberate gitignore is not this plan's call. So the correction is live for every agent that reads the file and **absent from any commit**, which means a fresh clone does not carry it. That is a real gap in `F-063`'s closure and it is recorded here rather than left to be discovered.

---

## 13. Requirements — all seventeen

**Complete** means every clause of the requirement's own text is delivered and evidenced. **Partially met** means at least one clause is not, and says which. Nothing is quietly marked complete.

| ID | Status | Evidence | Plan |
|---|---|---|---|
| **STAB-01** | **Complete** | Node 24 and npm >=11 in `engines`, `.nvmrc` = 24, CI reads `node-version-file: '.nvmrc'` with no competing literal. `check-baseline.mjs --check node-pin` → `one-declared-node-major :: engines=24 nvmrc=24 ci=24` | 02-01 |
| **STAB-02** | **Partially met** | Local half closed conclusively: `evidence/devdir-investigation.md`, four scopes empty, emitter identified as a node-gyp key npm dropped, machine state not repository state. **CI half `unobserved`** — no pushed batch-0 run, last run's logs HTTP 410. *Closes on: one readable CI install log.* | 02-01, 02-03 |
| **STAB-03** | **Complete** | `evidence/VULNERABILITY-POLICY.md`, eight clauses, subordinate to `.planning/audit/SEVERITY_SLA.md`, written **before** the first scan-driven change — a git-ancestry fact, not a claim | 02-03 |
| **STAB-04** | **Complete** | `evidence/vercel-removal-decision.md` — removed outright, devDependency alternative recorded and rejected, three negative checks re-run | 02-04 |
| **STAB-05** | **Complete** | `evidence/next-upgrade-note.md` — 16.2.1 → **16.3.5** in its own commit `cf6b3c9`, `react`/`react-dom` byte-identical on all four values. **The requirement text named 16.2.11 and was amended by this plan:** 16.2.11 predates the 2026-08-25 security release and would have satisfied the requirement's letter while leaving two unauthenticated-RCE criticals open | 02-05 |
| **STAB-06** | **Partially met** | `evidence/proxy-migration-note.md` + `evidence/proxy.before.txt` / `evidence/proxy.after.txt` / `evidence/proxy.rename-diff.txt` / `evidence/smoke.b3.before.txt` / `evidence/smoke.b3.after.txt`. Rename atomic and gated; rate limiter smoked both sides. **The ban-check clause is not smoke-tested and cannot be until the Phase 3 seed; Tier 3 human verification is outstanding.** *Closes on: the seed (`CERT-05` owns the assertion) plus one Tier 3 run against a preview deployment.* | 02-06 |
| **STAB-07** | **Complete** | Both halves, both driven by the AUDIT-12 reachability answer: `swagger-ui-react` **removed** (nothing imports it); `redoc` **upgraded** 2.5.2 → 2.5.4 (reachable from public `/docs`), with smoke row 7 proving the route still renders the same 82,679 bytes | 02-04, 02-07 |
| **STAB-08** | **Complete** | Vitest files deleted, `jest-environment-jsdom` + testing-library installed, four `.tsx`/hook suites now execute, `"test": "jest"` exists, CI runs it. `evidence/skipped-suite-disposition.md` records the fifth suite, which was never an installable skip | 02-01, 02-08 |
| **STAB-09** | **Partially met** | Every **upgrade** batch is one labeled commit followed by lint + type-check + test + build + a captured smoke: b1 (`evidence/smoke.b1.txt`), b2 (`evidence/smoke.b2.txt`), b4a (`evidence/smoke.b4.txt`), b6a (`evidence/smoke.b6.txt`), with b0 and b3 likewise. **Batch 5 ran the four-command gate and no smoke pass, and said so.** Batch 5 is a dev-only test-harness install rather than a patch/minor upgrade, so a literal reading puts it outside the clause — the phase's own stricter precedent is applied instead and the requirement is not claimed. *Closes on: one smoke run attributable to the batch-5 tree, or an explicit scope ruling.* | 02-04 → 02-09 |
| **STAB-10** | **Complete** | One major moved in the phase — `@types/node` 20 → 24, forced by the runtime pin — as its own change with `evidence/types-node-major-note.md` and its own gate. `check-baseline.mjs --check no-unplanned-majors` → `55 declared ranges compared, 0 planned major(s) moved` on the final tree | 02-01 |
| **STAB-11** | **Complete** | `evidence/lockfile-review-log.md` — per-batch diff line counts with structural entry deltas, plus three attestations each backed by a command and its output: never regenerated (`lockfileVersion` 3 → 3, and b6a's zero-insertion diff), no forced remediation (discriminating search returns 0), every diff read before installation (six `lock.b*.before.sha256` hashes, two standalone reviews) | 02-11 |
| **STAB-12** | **Complete** | `evidence/cleanroom-npm-ci.txt` — fresh clone at `01c7394`, runtime asserted against `engines` before installing, lockfile hash matched, `npm ci` + build + suite, twenty exit codes all 0. The requirement's parenthetical *"ideally in CI"* is an ideal, not a clause; the CI-side run is `STAB-14`'s unobserved-run problem, not a second gap | 02-11 |
| **STAB-13** | **Complete** | `evidence/tools/check-baseline.mjs` exits 0 on the final tree — 22 passed, 0 failed, 0 skipped — with every baseline figure parsed from `.planning/audit/baseline/jest.txt` and `lint.txt` rather than inlined. Better than baseline on both numbers: **278 vs 220** passing, **5 vs 36** skipped | 02-11 |
| **STAB-14** | **Partially met** | The step exists, is correctly positioned **after** the remediation batches, is unsuppressed (no `continue-on-error`, no `|| true`), and is green against this tree — `evidence/audit-gate-local.txt`, exit 0. **The requirement's evidence clause asks for a passing RUN and none has been observed:** every Phase 2 commit is local and unpushed. `evidence/ci-green-run.md` states that in its first line rather than implying a pass, and carries the full local rehearsal in the workflow's own step order. *Closes on: a push.* | 02-09 |
| **STAB-15** | **Complete** | `sbom.cyclonedx.json` (320 components, spec 1.6, schema-validated, byte-stable, from the lockfile) + `renovate.json` (three groups, one patch-only auto-merge rule), both validated: `evidence/sbom-generation.txt`, `evidence/renovate-validation.txt`. **Carried caveat, not a withholding:** the requirement says *configured*, and it is — but the GitHub App is **not installed** (§ 7), so nothing will act on the configuration until a human installs it | 02-10 |
| **STAB-16** | **Complete** | `evidence/bundle-size.md` with `evidence/bundle-size.before.txt` and `evidence/bundle-size.after.txt`, two metric families, every delta attributed to the batch that moved it, including the honest zero | 02-04, 02-10 |
| **STAB-17** | **Complete** | This note. All five gate clauses evidenced from committed artifacts, with the four partial requirements and the four unclosed items named rather than omitted | 02-11 |

**Twelve complete, five partially met, zero withheld without a reason. Three of the five partials — STAB-02, STAB-14, and half of STAB-06 — are blocked on the same single act: a push.**

---

## 14. The gate, restated

| Gate clause | Verdict | Where a reader checks it |
|---|---|---|
| No unexplained Critical production vulnerabilities | **MET** | `evidence/audit.after.json` → `critical: 0` |
| No reachable High without a dated, owner-signed exception | **MET** | `evidence/VULNERABILITY-POLICY.md` § Exception register — zero rows, because zero Highs |
| Reproducible install | **MET** | `evidence/cleanroom-npm-ci.txt` — twenty exit codes, all 0 |
| Checks green at or better than AUDIT-13 | **MET** | `evidence/tools/check-baseline.mjs` → exit 0; 278/5 against 220/36 |
| Reviewed lockfile | **MET** | `evidence/lockfile-review-log.md` — eight batch rows, three attestations |

**Stage 3 may start.** What it inherits is written down: the tsconfig exclusion and the generated types (Phase 3), the Supabase SDK's 35 minors and six typed call sites (Phase 3), the event read path's pagination contract (`REFAC-10`, Phase 4), the live shared-cache exposure (`REFAC-19`, Phase 6), and the ban-check assertion (`CERT-05`, Phase 7).

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-11 (batch 6c) — task 3*
