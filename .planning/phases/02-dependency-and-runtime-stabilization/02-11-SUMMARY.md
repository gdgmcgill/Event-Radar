---
phase: 02-dependency-and-runtime-stabilization
plan: 11
subsystem: infra
tags: [npm, lockfile, clean-room, cyclonedx, audit-register, documentation, exit-gate, jest, next]

requires:
  - phase: 01-read-only-foundation-audit
    provides: "the finding register (findings.json + FOUNDATION_AUDIT.md + its generator and validator), the AUDIT-13 baseline captures, SEVERITY_SLA.md, and quality/dead-code.md § 4's stale-documentation rows"
  - phase: 02-dependency-and-runtime-stabilization
    provides: "plans 02-01..02-10 — the final commit the clean room clones (01c7394), the final production census, the two-family bundle delta, the exception register, and every per-batch capture the completion note quotes"
provides:
  - "STAB-12 reproducible-install evidence: a fresh clone at the final commit installing from the lockfile alone and building and testing green on the pinned runtime, 20 exit codes all 0"
  - "STAB-11 lockfile review log: eight batch rows with diff line counts and structural entry deltas, plus three command-backed attestations"
  - "STAB-17 Stage 2 completion note: all eleven exit-gate clauses answerable from committed artifacts alone, 37 artifact paths cited, all seventeen requirements dispositioned"
  - "a finding register that agrees with the roadmap about which findings Phase 2 closes, regenerated through its generator"
  - "an optional `resolution` field on the finding schema, so the register can record HOW a finding closed and which clause did not"
  - "documentation that describes the tree that exists: eight protected routes, Next 16, Zustand + SWR, Node 24, the real Jest harness"
affects: [phase-03-refactor-foundations, phase-04-slices-1-2, phase-06-async-edge-and-caching, phase-07-certification-datasets]

tech-stack:
  added: []
  patterns:
    - "Optional schema extension over hand-edit: the generated register gains a field rather than the generated document gaining a paragraph"
    - "Honest search: when a negative attestation's naive grep has a hit, print the hit in full and then print the discriminating search, rather than showing only the search that produces the wanted answer"
    - "Withhold on unmet clauses, twelve times over: five requirements held Pending with a named unblock condition each"

key-files:
  created:
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/cleanroom-npm-ci.txt
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/lockfile-review-log.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/STAGE-2-COMPLETION.md
  modified:
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/audit/findings.schema.json
    - .planning/audit/tools/gen-foundation-audit.mjs
    - CLAUDE.md
    - README.md
    - .planning/phases/02-dependency-and-runtime-stabilization/evidence/deferred-items.md
    - .planning/REQUIREMENTS.md
    - .claude/CLAUDE.md  # corrected ON DISK ONLY — gitignored, never tracked, deliberately not force-added

key-decisions:
  - "The roadmap is the phase contract. Five findings whose closes_in_phase disagreed with it (F-051/052/053 at 03, F-056/057 at null) were reassigned to 02 and marked Fixed."
  - "Five adjacent rows were corrected in the same direction rather than left inconsistent: F-063 and F-064 to Fixed, F-065 held Open because its criterion names an unobserved CI run, F-066 to 03 as partially closed, F-025 from 05 to 06 and still Critical/Open."
  - "findings.schema.json gained an OPTIONAL `resolution` string and gen-foundation-audit.mjs renders it. The register could record THAT a finding closed and had nowhere to record HOW, in which commit, or which clause did not."
  - ".claude/CLAUDE.md was corrected on disk and deliberately NOT force-added: .claude/ is gitignored at .gitignore:43 and has never been tracked. Overriding a deliberate gitignore is not the executor's call."
  - "Twelve STAB requirements marked complete; five held Pending with a named unblock condition each. Three of the five are blocked on a single act: a push."
  - "The Stage 2 exit gate is MET on all five of its clauses, and the note says so in a blockquote on line one rather than making a reader infer it."

patterns-established:
  - "Secret-name withholding in evidence: the clean-room capture asserts the local secrets file is ABSENT without writing its filename, so a future grep for that name across .planning/ cannot produce a false positive in an artifact whose whole point is that the file was never touched"
  - "Read npm's post-install vulnerability line as the full tree, not the production census — and leave it unedited rather than trimming output to make a document read better"
  - "Deferred-items as the scope boundary's output: three cache findings with the same roadmap disagreement and one false parenthetical were filed rather than fixed, each with the reason it was left"

requirements-completed: [STAB-11, STAB-12, STAB-13, STAB-17]

duration: 38min
completed: 2026-09-15
status: complete
---

# Phase 02 Plan 11: Batch 6c — Clean Room, Register Reconciliation, and the Stage 2 Exit Gate Summary

**A fresh clone of the final commit installs from the lockfile alone and builds and tests green on the pinned Node with twenty exit codes all zero; the finding register now agrees with the roadmap about what Phase 2 closed; the documentation describes the tree that exists; and the Stage 2 exit gate is evidenced in one note a reader can check clause by clause without re-running anything — including the four things this phase deliberately did not close.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-15T15:47Z
- **Completed:** 2026-09-15T16:12Z
- **Tasks:** 3 of 3
- **Files created:** 3 · **Files modified:** 8 committed, 1 on disk only

## Commits

| Task | Commit | What landed |
|---|---|---|
| 1 | `2a669cc` | `evidence/cleanroom-npm-ci.txt` (524 lines) and `evidence/lockfile-review-log.md` |
| 2 | `14894f8` | `findings.json` + regenerated `FOUNDATION_AUDIT.md` + `findings.schema.json` + `gen-foundation-audit.mjs` + `CLAUDE.md` + `README.md` + `deferred-items.md` |
| 3 | `ee17a8e` | `evidence/STAGE-2-COMPLETION.md` (293 lines) |

## Results

### Task 1 — the clean room, and the lockfile's reviewed history

The seven-step protocol ran at **`01c7394`** in a clone outside the working tree. **Twenty `exit_code=` lines, every one 0.** The runtime was asserted against `engines` *before* installing (node 24.16.0 vs `24.x`, npm 11.13.0 vs `>=11`, `.nvmrc` 24 agreeing with both); the lockfile hash `842ed8a7…` matched between clone and working tree and matched again after the install; `npm ci` placed 989 packages; the build emitted 140 route rows; `npx jest --ci` reported **278 passed / 5 skipped / 0 failed**; and `git status --porcelain` in the clone was empty afterwards.

Against the interim run at `695ec1e`: +85 packages and +31 passing / −31 skipped, both attributable to batch 5's dev-only jsdom harness. What must not differ does not.

**Two things in that capture are deliberate and easy to misread.** First, `npm ci` printed *"9 vulnerabilities (3 low, 3 moderate, 2 high, 1 critical)"* — **that is the full tree, dev included**, not the production census of 0/0/2/0 across 298 deps. The provenance block says so at length and the line was left unedited. Second, the local secrets file was asserted **ABSENT without its filename being written into the capture**, because the plan's own acceptance criteria grep this file for that name; naming it would have made the artifact fail the check it exists to pass.

`evidence/lockfile-review-log.md` records eight batch rows — six commits that touched `package-lock.json` and two batches that deliberately did not — each with its diff line count *and* its structural entry delta, because a line count cannot distinguish a dead subtree leaving from forty quiet upgrades. Phase net: **1,270 → 1,069** entries. Three attestations, each backed by a command with its real output:

1. **Never regenerated wholesale.** `lockfileVersion` 3 → 3. The stronger argument is arithmetic: a regeneration cannot produce a diff with **zero insertions**, and batch 6a's is `0 / 57`.
2. **No forced remediation.** The naive commit-message search has **one hit** — and the log quotes it in full, because it is a *denial* in batch 6a's own commit body. The discriminating search returns 0, and `check-baseline.mjs --check lockfile-discipline` agrees. The log also names the pre-phase counter-example (`0ff21db`, 2026-01-31, *"changes after I ran npm audit fix --force"*), so the attestation is not read as a formality.
3. **Every diff was read as a diff.** Six committed `lock.b*.before.sha256` hashes, reconcile-then-read-then-install-then-gate, and two standalone review documents for the batches whose diffs needed argument rather than inspection.

### Task 2 — the register, and the documents

**The register.** Five findings recorded a closing phase that disagreed with where the roadmap assigns their remediation. All five now record **02** with status **Fixed**, each with a `resolution` note naming the commit and the evidence. Two needed care and got it: **F-057**, the Windows RCE, is closed **by version** — which is what retires its unverified-operating-system evidence gap, because the *dependency on the assumption* was removed rather than the assumption confirmed. And **F-025**, the shared cache, is **not** closed by this phase: it stays `Open` at `Critical` and its `closes_in_phase` moved 05 → **06** to agree with the roadmap's Phase 6 criterion 3.

Five adjacent rows were corrected in the same direction. **F-063** and **F-064** to Fixed; **F-065** held `Open` because its criterion names a CI *run* and none has been observed; **F-066** to 03 as **partially** closed, with both unclosed halves spelled out.

`findings.json` was edited, `FOUNDATION_AUDIT.md` was **regenerated** through `gen-foundation-audit.mjs`, and both gates ran clean: the generator's staleness check (`up to date (70 findings)`) and `validate.mjs --check findings` (`8 passed, 0 failed`).

**The documents.** Every corrected claim was re-derived from the working tree. `CLAUDE.md` now lists **all eight** protected routes read from `src/proxy.ts:114`, with the command that re-derives them and the prefix-match rule, and the stale middleware file path is gone. `README.md` moved Next.js 14 → 16, "State Management: React Hooks" → Zustand + SWR + local React state, Node 18+ → Node 24 / npm 11+, and its scripts list now names `npm test` and `npm run test:ci`. `.claude/CLAUDE.md` had Vitest replaced by the real two-project Jest harness, Node 20 → 24, PostCSS 8.4.35 → `^8.5.28`, the removed swagger and Radix packages delisted, and "No test step in CI pipeline" replaced by the real six-step order — **on disk only; see Deviations.**

### Task 3 — the exit gate note

`evidence/STAGE-2-COMPLETION.md`, 293 lines, **37 distinct artifact paths cited and every one asserted to exist on disk.** All eleven checklist clauses, then a mandatory *what this phase did not close* section, then all seventeen requirements.

**The gate is MET on all five clauses**, stated in a blockquote on line one:

| Gate clause | Verdict |
|---|---|
| No unexplained Critical production vulnerabilities | **MET** — 2 → 0, with the two surviving Moderates named rather than aggregated |
| No reachable High without a dated, owner-signed exception | **MET** — 22 → 0; the register is examined-and-empty because they were *fixed*, not excepted |
| Reproducible install | **MET** — 20 exit codes, all 0 |
| Checks green at or better than AUDIT-13 | **MET** — **278 vs 220** passing **and 5 vs 36** skipped |
| Reviewed lockfile | **MET** — eight batch rows, three attestations |

The checks table quotes **both** numbers, because the baseline's 220 passing was already satisfied by a tree in which **five suites never executed**. The lint row's 19-against-12 is explained rather than hidden: the delta is fully attributed to a rule that did not exist at baseline, and the per-rule comparator that replaced the aggregate threshold makes the gate **stricter**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The finding register had nowhere to record how a finding closed**

- **Found during:** Task 2
- **Issue:** The plan asks for "per-finding resolution notes" in `findings.json`. The schema declares `additionalProperties: false`, so no such field could be added, and the generator rendered none — meaning closure provenance had nowhere to live that was not a misuse of an existing field (`recommended_fix` is historical for a closed finding; `severity_rationale` is about exposure).
- **Fix:** Added an **optional** `resolution` string to `findings.schema.json` and a `**Resolution.**` render block to `gen-foundation-audit.mjs`, with a header comment explaining why. Optional, so all 70 rows stay schema-valid and every untouched row renders byte-identically.
- **Files modified:** `.planning/audit/findings.schema.json`, `.planning/audit/tools/gen-foundation-audit.mjs`
- **Commit:** `14894f8`

**2. [Rule 2 - Missing critical functionality] Five adjacent register rows disagreed with the tree in the same way the named five did**

- **Found during:** Task 2
- **Issue:** The plan names five findings to reassign. Grouping the register by `closes_in_phase` showed four more already at 02 — F-063, F-064, F-065, F-066 — all still `Open`, and F-025 pointed at Phase 5 where the roadmap puts the fix in Phase 6. Reassigning only the named five would have left the register asserting that Phase 2 ended with four findings open at its own phase number, two of which are demonstrably closed.
- **Fix:** F-063 and F-064 → `Fixed`. F-065 → held `Open` (its criterion names a CI run; none observed). F-066 → `closes_in_phase: 03`, still `Open`, partially closed. F-025 → `closes_in_phase: 06`, still `Critical`/`Open`. Each with a resolution note.
- **Files modified:** `.planning/audit/findings.json`, `.planning/audit/FOUNDATION_AUDIT.md`
- **Commit:** `14894f8`

**3. [Rule 2 - Missing critical functionality] STAB-05's requirement text still named a superseded version**

- **Found during:** Task 3 (carried forward from 02-05's summary, which explicitly handed this to 02-11)
- **Issue:** `REQUIREMENTS.md` STAB-05 named 16.2.11. The shipped version is 16.3.5, because 16.2.11 predates the 2026-08-25 security release and would have satisfied the requirement's letter while leaving two unauthenticated-RCE criticals open. `REQUIREMENTS.md` is not in this plan's `files_modified`.
- **Fix:** Amended the requirement text in place, naming the shipped version, the reason, and the evidence path.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Commit:** final metadata commit

**4. [Rule 2 - Missing critical functionality] Two README claims this phase falsified were outside F-063's enumerated rows**

- **Found during:** Task 2
- **Issue:** `README.md` said Node 18+ and listed `npm run test`. STAB-01 pinned Node 24 in `engines`, and STAB-08 added `test` and `test:ci`. Both claims are false *because of this phase*, and the Phase 1 convention is that a correction rides along with the change that made the claim false.
- **Fix:** Corrected both, with the re-derivation command for the engines block.
- **Files modified:** `README.md`
- **Commit:** `14894f8`

### The one deviation that is not a fix — `.claude/CLAUDE.md` cannot be committed

**[Blocked by repository configuration, not auto-fixable]**

- **Found during:** Task 2, at staging time.
- **Issue:** The plan lists `.claude/CLAUDE.md` in `files_modified`. **`.claude/` is gitignored at `.gitignore:43` and the file has never been tracked** (`git ls-files .claude/CLAUDE.md` → 0). `git add` refuses it without `-f`.
- **What was done:** The corrections were applied **on disk** — which is what makes the agent-facing document correct for every agent that reads it — and the file was **not** force-added. Overriding a deliberate gitignore is not the executor's call, and the same reasoning the workflow applies to gitignored `.planning/` content applies here.
- **Consequence, stated rather than buried:** a fresh clone does **not** carry these corrections. That is a real gap in F-063's closure. It is recorded in three places — the Task 2 commit body, `STAGE-2-COMPLETION.md` § 12, and here — so it is found rather than discovered.
- **What would close it:** a decision by the user to either un-ignore `.claude/CLAUDE.md` specifically (`!.claude/CLAUDE.md` in `.gitignore`) or accept that the agent-instruction file is machine-local. Not the executor's decision to take.

### Out-of-scope discoveries, filed not fixed

Logged to `evidence/deferred-items.md` under the scope boundary:

1. **F-026, F-027 and F-028 carry the same 05-vs-06 roadmap disagreement F-025 had.** Outside this plan's named set, and the call is a real judgment — F-027 in particular is an authorization defect that the cache rule makes worse, so 05 may well be right for it. Owner: whoever plans Phase 5.
2. **`.claude/CLAUDE.md` says Zustand has "no stores directory found"**, and `src/store/useAuthStore.ts` exists. False — but not a claim *this phase* falsified, and not one of F-063's seven. The plan says "do not rewrite these documents beyond the false claims."

## Requirements

**Marked complete: STAB-11, STAB-12, STAB-13, STAB-17.** The plan's frontmatter also lists STAB-10, which was already Complete from plan 02-01 and is re-confirmed here by the comparator's `no-unplanned-majors :: 55 declared ranges compared, 0 planned major(s) moved` on the final tree.

| ID | Verdict | Why |
|---|---|---|
| **STAB-10** | Already Complete | Re-checked on the final tree rather than carried on faith, as 02-01 required |
| **STAB-11** | **Complete** | All three clauses delivered and each backed by a command: reviewed as diffs, never regenerated, `--force` never used |
| **STAB-12** | **Complete** | The clean room at the final commit. The requirement's *"ideally in CI"* is an ideal, not a clause — the CI-side run is STAB-14's problem and is not double-counted as a second gap here |
| **STAB-13** | **Complete** | `check-baseline.mjs` exits 0: 22 passed, 0 failed, 0 skipped, better than baseline on both numbers |
| **STAB-17** | **Complete** | The note exists and every clause of the requirement's own text is evidenced. It does **not** certify the four requirements below, and says so |

**Held Pending, with the unblock condition named — this is the phase's eighth application of the withhold precedent:**

| ID | Why not complete | Unblocked by |
|---|---|---|
| **STAB-02** | Local half closed conclusively; the CI half is `unobserved` (no pushed run; last run's logs HTTP 410) | One readable CI `Install dependencies` log |
| **STAB-06** | Rename atomic and gated, rate limiter smoked both sides — but the **ban-check clause** is not smoke-tested and cannot be until the Phase 3 seed, and **Tier 3 human verification is outstanding** | The Phase 3 seed (CERT-05 owns the assertion) + one Tier 3 run against a preview deployment |
| **STAB-09** | Every *upgrade* batch was one labeled commit followed by lint + type-check + test + build + a captured smoke. **Batch 5 ran the four-command gate and no smoke pass, and said so.** Batch 5 is a dev-only install rather than a patch/minor upgrade, so a literal reading puts it outside the clause — the phase's own stricter precedent is applied instead | One smoke run attributable to the batch-5 tree, or an explicit scope ruling |
| **STAB-14** | Step exists, correctly positioned, unsuppressed, green locally. The evidence clause asks for a passing **run** and none exists | A push |

**Three of the four are blocked on the same single act: a push.**

## Known Stubs

None. This plan wrote three evidence documents and edited four register/documentation files; no source file, component, or data path was created or modified.

## Verification

| Check | Result |
|---|---|
| Task 1 automated verify | PASS — `STAB-12 clean room OK, STAB-11 log OK — 11 batch rows` |
| Task 2 automated verify | PASS — `register reconciled and docs corrected — 8 protected routes documented` |
| Task 3 automated verify | PASS — `STAB-17 OK — 17 requirements, 37 artifacts cited, baseline 220/36 quoted` |
| `gen-foundation-audit.mjs --check` | exit 0 — `up to date (70 findings)` |
| `validate.mjs --check findings` | exit 0 — 8 passed, 0 failed |
| `check-baseline.mjs` (all checks) | exit 0 — 22 passed, 0 failed, 0 skipped |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm test -- --ci` | exit 0 |
| `npm run build` | exit 0 |
| `git status --porcelain -- package.json package-lock.json src/` | empty — the phase-locked constraint held |

## Notes for Future Phases

- **Phase 3** inherits the `tsconfig.json` test-file exclusion (F-066's unclosed half, now pointed at 03), the Supabase SDK's 35 minors and six `TS2345` call sites, and `@supabase/ssr`'s separate 0.7 → 0.12 major.
- **Phase 4** inherits the event read path's pagination contract question — `REFAC-10`, the fifth Jest suite, deliberately left skipped rather than rewritten against current behaviour.
- **Phase 6** inherits the live shared-cache exposure — `REFAC-19`, F-025, still Critical and Open, with the precondition measured rather than inferred.
- **Phase 7** inherits the ban-check assertion — `CERT-05`, against the Phase 3 seed.
- **Before any of them:** push. It closes STAB-02, STAB-14 and half of STAB-06 at once, and it is the only thing standing between this phase and four fully-evidenced requirements.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-11 (batch 6c)*

## Self-Check: PASSED

All four created files exist on disk and all three task commits resolve in `git log`:

```
FOUND: evidence/cleanroom-npm-ci.txt      FOUND: 2a669cc
FOUND: evidence/lockfile-review-log.md    FOUND: 14894f8
FOUND: evidence/STAGE-2-COMPLETION.md     FOUND: ee17a8e
FOUND: 02-11-SUMMARY.md
```
