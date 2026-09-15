---
phase: 02-dependency-and-runtime-stabilization
verified: 2026-09-15T16:19:29Z
status: human_needed
score: 5/5 roadmap success criteria present-and-wired; 2 items routed to human verification (CI-run observation, Tier 3 preview smoke)
behavior_unverified: 1
overrides_applied: 0
deferred:
  - truth: "middleware.ts to proxy.ts migration's ban-check behaviour is smoke-tested before and after (STAB-06 clause 2)"
    addressed_in: "Phase 3 (seed dataset) and Phase 7 (CERT-05 persona matrix, includes 'permanently banned' persona)"
    evidence: "ROADMAP.md line 22: Phase 3 'build[s] the server seam, the persona harness, and the seed'; REQUIREMENTS.md CERT-05: 'persona × workflow matrix ... for all 13 personas (... permanently banned, actively suspended, expired suspension ...)'. proxy-migration-note.md § 8 and § 11 name CERT-05 explicitly as the clause's landing point."
  - truth: "Batch 5 (jsdom test-harness install) followed by a captured smoke pass, per the 'every upgrade batch gets a smoke pass' success criterion"
    addressed_in: "Not a future phase — a documented scope judgment within this phase"
    evidence: "skipped-suite-disposition.md and STAGE-2-COMPLETION.md §13 (STAB-09 row): batch 5 is a dev-only test-harness install, not a patch/minor production upgrade, so it was not smoke-tested; the four-command gate (lint/typecheck/test/build) was still run and captured (evidence/batch-05-*.txt). Recorded as a stricter-than-literal reading applied, not silently skipped."
behavior_unverified_items:
  - truth: "CI runs the Jest suite and the `npm audit --audit-level=high --omit=dev` gate on every pull request (roadmap SC2, STAB-14)"
    test: "Push the 123 unpushed local commits (or an equivalent branch) to GitHub and open/observe a pull request run of `.github/workflows/ci.yml`"
    expected: "The workflow run completes with the 'Run tests' and 'Production vulnerability gate' steps both green, in the order recorded in `.github/workflows/ci.yml`"
    why_human: "GitHub Actions execution cannot be observed from a local working tree. The workflow file is correctly wired and was rehearsed locally (npm test, npm audit --audit-level=high --omit=dev, npm run build all independently re-run and confirmed exit 0 during this verification), but no actual CI run exists yet because `git status -sb` shows `main` 123 commits ahead of `origin/main`. evidence/ci-green-run.md states this honestly rather than implying a pass."
human_verification:
  - test: "Tier 3 preview-deployment check for the middleware.ts → proxy.ts rename (5 steps: McGill sign-in, non-McGill sign-in rejection, mid-onboarding redirect, non-banned user NOT redirected to /banned, save/unsave/RSVP)"
    expected: "All five steps behave identically to the pre-rename application, observed against an actual Vercel preview deployment (not just `npm run dev`), per plan 02-06's own deferred human-check block"
    why_human: "Next compiles the file-convention into a platform function at build time; the local dev-server smoke pass (which already passed, before and after, byte-identical) cannot exercise the CDN/platform path. proxy-migration-note.md § 9 lists this as OUTSTANDING with an empty preview-deployment URL and date, explicitly deferred per `workflow.human_verify_mode: end-of-phase`."
  - test: "CI run observation (see behavior_unverified_items above — also listed here because status is human_needed)"
    expected: "A real, green GitHub Actions run of the full workflow on a pushed pull request"
    why_human: "Requires pushing commits, which this verification pass does not do"
---

# Phase 2: Dependency and Runtime Stabilization Verification Report

**Phase Goal:** The toolchain and dependency tree are pinned, patched, and reproducible, and the test suite that already passes is wired to actually gate changes — so Stage 3 refactors land on a bisectable base.
**Verified:** 2026-09-15T16:19:29Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A clean-room install succeeds and builds on the pinned Node/npm, with output captured; `package-lock.json` changes were reviewed as diffs, never regenerated wholesale; `npm audit fix --force` was never used | ✓ VERIFIED | `evidence/cleanroom-npm-ci.txt` (7-step protocol, 20 exit codes all 0, run at commit `01c7394` outside the working tree); `.nvmrc`=24, `package.json` `engines.node`="24.x" confirmed on disk; `git log --oneline c7c5c49..HEAD \| grep -i "audit fix --force"` returns no match (re-run during this verification, exit 1/no-match); `evidence/lockfile-review-log.md` gives per-batch diff line counts and structural entry deltas for all 8 batches |
| 2 | `npm test` exists and runs Jest as the single test runner — Vitest orphans deleted, `jest-environment-jsdom` and testing-library installed so previously-skipped `.tsx` suites run — and CI runs it plus `npm audit --audit-level=high --omit=dev` on every pull request | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `package.json.scripts.test` = `"jest"` (confirmed); `vitest.config.ts`/`vitest.setup.ts` confirmed absent from disk; `jest-environment-jsdom ^30.2.0`, `@testing-library/react ^16.3.3`, `@testing-library/jest-dom ^7.0.1` present in `package.json`; re-ran `npx jest --ci` live during this verification → **278 passed, 5 skipped, 0 failed, 22 of 23 suites** (matches orchestrator gate exactly); `.github/workflows/ci.yml` contains both `run: npm test` and `run: npm audit --audit-level=high --omit=dev` steps, correctly ordered, unsuppressed. **The "CI runs it on every pull request" clause is unexercised**: `git status -sb` shows `main...origin/main [ahead 123]` — every phase commit is local and unpushed, so no GitHub Actions run of this workflow has ever occurred. `evidence/ci-green-run.md` states this as its own headline rather than implying a pass. |
| 3 | `vercel` is gone from production dependencies with the devDependency decision recorded; Next.js is on the patched release as its own commit with `react`/`react-dom` untouched; `middleware.ts` → `proxy.ts` landed as its own gated change with rate-limiting and ban-check behavior smoke-tested before and after; Swagger/Redoc disposition matches the AUDIT-12 reachability answer | ✓ VERIFIED (with one clause deferred — see Deferred Items) | `node -e "require('./package.json')"` confirms `vercel` absent from both `dependencies` and `devDependencies`; `evidence/vercel-removal-decision.md` records "remove outright, do not relocate to devDependencies" with 4 negative checks; `next@16.3.5` confirmed installed (`node_modules/next/package.json`), `react`/`react-dom` at `^18.3.0` manifest / `18.3.1` resolved unchanged per `evidence/next-upgrade-note.md` §2 (4 values, all identical before/after); `src/middleware.ts` confirmed absent, `src/proxy.ts` (158 lines) present and imports `./middlewareRateLimit` (grep-confirmed); rate-limiter and redirect-ring smoke-tested before/after in `evidence/smoke.b3.before.txt`/`smoke.b3.after.txt` (byte-identical, 0 diff); `swagger-ui-react` confirmed absent from `package.json`, `redoc@^2.5.4` present and still imported at `src/components/redoc/RedocUI.tsx`. **Ban-check clause not smoke-tested** — see Deferred Items below; this is the one sub-clause not delivered in this phase. |
| 4 | Every Validated workflow in PROJECT.md still works: each upgrade batch is one labeled commit followed by lint, type-check, test, build, and a smoke pass, with any major upgrade isolated behind its own migration note | ✓ VERIFIED (one scope judgment noted) | Per-batch evidence captures confirmed on disk: `batch-00` through `batch-06` each have `-lint.txt`, `-tsc.txt`, `-jest.txt`, `-build.txt`; smoke captures `smoke.b0`–`smoke.b6` present for all batches except batch 5; `evidence/types-node-major-note.md` documents the one major that moved (`@types/node` 20→24, forced by the runtime pin) as its own change. **Batch 5 (jsdom harness install) ran the four-command gate but no smoke pass** — documented in `skipped-suite-disposition.md`/`STAGE-2-COMPLETION.md` §13 as a dev-only, non-runtime-affecting install outside a literal "upgrade batch" reading; see Deferred Items. |
| 5 | A Stage 2 completion note evidences the exit gate — no unexplained Critical vulnerabilities, no reachable High without a dated owner-signed exception, reproducible install, checks green at or better than AUDIT-13 baseline, reviewed lockfile — alongside a committed CycloneDX SBOM, Renovate/Dependabot configuration, and before/after bundle size | ✓ VERIFIED | `evidence/STAGE-2-COMPLETION.md` (293 lines) states all 5 gate clauses MET with cited artifacts. Independently re-verified during this pass: live `npm audit --audit-level=high --omit=dev` → exit 0, `{critical:0, high:0, moderate:2, low:0}` (dompurify, yaml — both named and dispositioned in the completion note as tracked-not-blocking); `sbom.cyclonedx.json` exists, 320 components, specVersion 1.6, `serialNumber`/`metadata.timestamp` both absent (byte-stability property confirmed); `renovate.json` exists with 3 named packageRules groups (supabase, test harness, next) plus a patch/pin/digest-only automerge rule and an explicit React-major `enabled: false` block; `evidence/bundle-size.md`/`.before.json`/`.after.json` all present with two metric families. |

**Score:** 5/5 roadmap success criteria have their supporting artifacts present, substantive, and wired. 1 truth (#2) is present-and-wired but has a runtime-observation component (an actual GitHub Actions PR run) that cannot be exercised locally — routed to human verification rather than counted as fully verified.

### Deferred Items

Items not fully met in this phase but explicitly addressed by later phases in the milestone, or judged as legitimate in-phase scope calls with clear written reasoning.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | STAB-06 ban-check behaviour smoke-tested before/after the proxy rename | Phase 3 (seed dataset) → Phase 7 (`CERT-05` persona matrix, "permanently banned" / "actively suspended" / "expired suspension" personas) | ROADMAP.md line 22 ("Phase 3 ... build[s] the server seam, the persona harness, and the seed"); REQUIREMENTS.md CERT-05 text; `evidence/proxy-migration-note.md` §8 and §11 name CERT-05 explicitly |
| 2 | STAB-09 batch 5 (test-harness install) smoke pass | Not deferred to a later phase — an in-phase scope judgment | `evidence/skipped-suite-disposition.md`, `STAGE-2-COMPLETION.md` §13: batch 5 is dev-only and does not touch a runtime path a smoke test would exercise; the four-command gate (lint/typecheck/test/build) still ran and is captured |

### Required Artifacts (spot-checked across all 11 plans)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.nvmrc` | Contains `24` | ✓ VERIFIED | Confirmed on disk: `24` |
| `package.json` | `engines.node: "24.x"`, `scripts.test: "jest"`, no `vercel` dep | ✓ VERIFIED | All three confirmed via `node -e` inspection |
| `.github/workflows/ci.yml` | `node-version-file: '.nvmrc'`, `run: npm test`, `run: npm audit --audit-level=high --omit=dev` | ✓ VERIFIED | All three lines present, in correct order; `gsd-tools query verify.key-links` false-negatived this pair (regex escaping artifact in the tool) — resolved by direct file read |
| `src/proxy.ts` | Renamed from `middleware.ts`, imports `middlewareRateLimit` | ✓ VERIFIED | 158 lines, `src/middleware.ts` confirmed absent, import confirmed |
| `src/proxy.test.ts` | Matcher characterization, imports from `src/proxy.ts` | ✓ VERIFIED | 91 lines, present (supersedes the `src/middleware.test.ts` path named in plan 02-02, per that plan's own annotation) |
| `jest.config.js` / `jest.setup.ts` | Two-project (node/jsdom) config | ✓ VERIFIED | Live `npx jest --ci` run shows both `node` and `jsdom` project labels executing |
| `sbom.cyclonedx.json` | CycloneDX SBOM of production tree | ✓ VERIFIED | 320 components, spec 1.6, byte-stable |
| `renovate.json` | Grouping + patch-only automerge | ✓ VERIFIED | 3 groups, 1 automerge rule, React-major disabled |
| `evidence/STAGE-2-COMPLETION.md` | Exit-gate note, ≥120 lines | ✓ VERIFIED | 293 lines, all 5 gate clauses independently re-confirmed |
| `evidence/VULNERABILITY-POLICY.md` | Policy with exception register | ✓ VERIFIED | 177 lines, exception register present with 4-attribute schema (owner/date/expiry/rationale) |

### Key Link Verification

The automated `gsd-tools query verify.key-links` regex probe reported several false negatives (its literal-pattern search does not always match across markdown prose or across multi-line source); each was manually re-verified against the actual file content:

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `.github/workflows/ci.yml` | `.nvmrc` | `node-version-file` input | ✓ WIRED | Manually confirmed: `node-version-file: '.nvmrc'` present (tool false-negative) |
| `.github/workflows/ci.yml` | `package.json` | `run: npm test` step | ✓ WIRED | Manually confirmed present (tool false-negative) |
| `src/proxy.ts` | `src/middlewareRateLimit.ts` | relative import, rate-limit-first | ✓ WIRED | `import { applyApiRateLimit } from "./middlewareRateLimit";` at line 3, confirmed by grep (tool false-negative) |
| `.github/workflows/ci.yml` | `package-lock.json` | audit step reads job-installed lockfile | ✓ WIRED | Tool-confirmed |
| `sbom.cyclonedx.json` | `package-lock.json` | generated from lockfile, byte-stable | ✓ WIRED | Tool-confirmed |
| `jest.config.js` | `jest.setup.ts` / `src/hooks/useEvents.test.ts` | jsdom project wiring | ✓ WIRED | Tool-confirmed, and live jest run shows `useEvents.test.ts` executing under the `jsdom` project |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm test` / Jest suite passes | `npx jest --ci` (single full run, not repeated per truth) | `Test Suites: 1 skipped, 22 passed, 22 of 23 total`; `Tests: 5 skipped, 278 passed, 283 total` | ✓ PASS — matches orchestrator gate and `evidence/cleanroom-npm-ci.txt` exactly |
| Production vulnerability gate is green | `npm audit --audit-level=high --omit=dev` | exit 0, `{critical:0, high:0, moderate:2, low:0}` | ✓ PASS — matches `evidence/audit.after.json` and `evidence/audit-gate-local.txt` |
| Application builds | `npm run build` (with CI placeholder env vars) | exit 0, full route table printed, `ƒ Proxy (Middleware)` line confirms proxy convention live | ✓ PASS |
| No file-convention deprecation warning in build output | `grep -i deprecat` on fresh build log | Only an unrelated Node.js `url.parse()` deprecation notice; zero occurrences of "file convention is deprecated" | ✓ PASS |
| `vercel` absent from both prod and dev dependencies | `node -e` inspection of `package.json` | `dependencies.vercel: undefined`, `devDependencies.vercel: undefined` | ✓ PASS |
| `swagger-ui-react` removed, `redoc` upgraded and still reachable | `node -e` + `grep -rn` | `swagger-ui-react` absent; `redoc: ^2.5.4` present and imported at `src/components/redoc/RedocUI.tsx` | ✓ PASS |
| Phase commit range contains no `npm audit fix --force` | `git log --oneline c7c5c49..HEAD \| grep -i "audit fix --force"` | No match (exit 1) | ✓ PASS |
| HEAD matches the orchestrator's cited gate commit | `git rev-parse HEAD` | `e4bcea8579d5bea7491f7e2986b2dc38d6eaa7b2` | ✓ PASS — matches `e4bcea8` cited in the task brief |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe declarations found in any of the 11 plans or summaries for this phase. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

All 17 requirement IDs (STAB-01 through STAB-17) are declared across the 11 plans' `requirements:` frontmatter, with no orphans in either direction (every ID in REQUIREMENTS.md's Phase 2 table appears in at least one plan's `requirements:` list, and no plan declares an ID absent from REQUIREMENTS.md).

| Requirement | Source Plan(s) | REQUIREMENTS.md Status | Verifier Judgment |
|---|---|---|---|
| STAB-01 | 02-01 | Complete | ✓ SATISFIED — Node 24 pinned in 3 places, confirmed on disk |
| STAB-02 | 02-01, 02-03 | Pending | Legitimate partial — local probe complete (`devdir-investigation.md`), CI half `unobserved` because nothing is pushed. Evidence-blocked-on-push, not a codebase gap. |
| STAB-03 | 02-03 | Complete | ✓ SATISFIED — `VULNERABILITY-POLICY.md` committed before batch 1, git-ancestry confirmed by commit ordering |
| STAB-04 | 02-04 | Complete | ✓ SATISFIED — `vercel` absent from manifest, decision recorded |
| STAB-05 | 02-05 | Complete | ✓ SATISFIED — next@16.3.5 confirmed installed, react/react-dom untouched, requirement text amended with reason in 02-11 |
| STAB-06 | 02-06 | Pending | Legitimate partial — rate-limiter/matcher/redirect-ring smoke-tested; ban-check requires Phase 3 seed data, deferred to CERT-05 (Phase 7). Genuinely blocked on a forward dependency, not glossed over. |
| STAB-07 | 02-04, 02-07 | Complete | ✓ SATISFIED — swagger-ui-react removed, redoc upgraded and still reachable at `/docs` |
| STAB-08 | 02-01, 02-08 | Complete | ✓ SATISFIED — live jest run confirms jsdom suites execute, `test` script exists, CI runs it |
| STAB-09 | 02-02, 02-04→02-09 | Pending | Legitimate partial for batch 5 only (dev-tooling, not a runtime upgrade); all other batches have captured smoke passes |
| STAB-10 | 02-01, 02-11 | Complete | ✓ SATISFIED — `@types/node` major documented as its own change |
| STAB-11 | 02-04, 02-05, 02-07, 02-08, 02-11 | Complete | ✓ SATISFIED — `lockfile-review-log.md` per-batch diffs, no wholesale regen, no forced remediation in phase range (independently re-confirmed) |
| STAB-12 | 02-07, 02-11 | Complete | ✓ SATISFIED — `cleanroom-npm-ci.txt`, 20/20 exit codes 0 |
| STAB-13 | 02-02, 02-08, 02-11 | Complete | ✓ SATISFIED — `check-baseline.mjs` and live jest run both show 278/5 vs AUDIT-13's 220/36 |
| STAB-14 | 02-09 | Pending | Legitimate partial — step exists, correctly ordered, unsuppressed, green locally (independently re-confirmed); no observed GitHub Actions run because nothing is pushed |
| STAB-15 | 02-10 | Complete | ✓ SATISFIED — SBOM + renovate.json both confirmed on disk and schema-appropriate; Renovate GitHub App install itself is out of scope for a codebase check (correctly caveated in STAGE-2-COMPLETION.md §7) |
| STAB-16 | 02-04, 02-10 | Complete | ✓ SATISFIED — bundle-size evidence files confirmed present with two metric families |
| STAB-17 | 02-11 | Complete | ✓ SATISFIED — `STAGE-2-COMPLETION.md` exit gate note, all 5 clauses independently re-confirmed against live commands in this verification pass |

No orphaned requirements found — REQUIREMENTS.md's Phase 2 table and the plans' declared `requirements:` lists agree exactly on the set {STAB-01..STAB-17}.

### Anti-Patterns Found

Scanned key files modified by this phase (`src/proxy.ts`, `src/proxy.test.ts`, `src/middlewareRateLimit.test.ts`, `jest.config.js`, `jest.setup.ts`, `package.json`, `next.config.js`, `.github/workflows/ci.yml`, `renovate.json`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`: **zero matches**. No debt markers found in phase-modified source/config files.

One informational item, not a blocker: `.claude/CLAUDE.md` was corrected on disk by plan 02-11 but is gitignored (`.gitignore` line 43: `.claude`) and confirmed untracked (`git ls-files .claude/CLAUDE.md` returns empty). This is honestly recorded in `STAGE-2-COMPLETION.md` §12 as "a real gap in F-063's closure" rather than hidden — ℹ️ INFO, already self-disclosed by the phase's own evidence.

### Human Verification Required

#### 1. CI run observation

**Test:** Push the phase's 123 local commits (or the equivalent final tree) to GitHub and observe an actual pull-request run of `.github/workflows/ci.yml`.
**Expected:** The `Run tests` step (Jest) and the `Production vulnerability gate` step (`npm audit --audit-level=high --omit=dev`) both complete green, in the order the file declares, on a real GitHub Actions runner.
**Why human:** This verification pass can only confirm the workflow is correctly wired and rehearse every command locally (all confirmed green). It cannot fabricate a GitHub Actions execution. `git status -sb` at HEAD shows `main...origin/main [ahead 123]` — nothing in this phase has ever reached the remote, so no run object exists to inspect. Both STAB-02's CI-observability clause and STAB-14 depend on this single act.

#### 2. Tier 3 preview-deployment smoke pass for the proxy rename

**Test:** Against an actual Vercel preview deployment of the post-rename commit (not `npm run dev`): (1) sign in with a real McGill Google account, (2) attempt sign-in with a non-McGill account, (3) with a mid-onboarding session navigate to a non-onboarding page, (4) as a signed-in non-banned user navigate to any page, (5) save/unsave an event and RSVP to one.
**Expected:** (1) completes and lands signed in, (2) is rejected with unchanged error behavior, (3) redirects to `/onboarding`, (4) is NOT redirected to `/banned`, (5) both actions work exactly as before.
**Why human:** Next.js compiles the file-convention (`middleware`/`proxy`) into a platform function at build/deploy time; the local dev-server smoke pass already run (byte-identical before/after) cannot exercise the CDN/platform boundary. This is plan 02-06's own deferred `<human-check>` block, explicitly harvested here per `workflow.human_verify_mode: end-of-phase`, and is recorded as OUTSTANDING with an empty preview URL/date in `evidence/proxy-migration-note.md` §9.

Note: this Tier 3 check's step 4 (non-banned user, negative case) is the only ban-check evidence available in Phase 2. It does **not** cover the positive case (a banned user IS redirected) — that assertion is deferred to Phase 7's CERT-05, on the Phase 3 seed dataset, as documented above.

### Gaps Summary

No fabricated or hollow work was found. Every artifact this phase's plans claimed to produce exists, is substantive (none are stub files or empty scaffolding), and is wired into the systems it needs to affect — independently re-confirmed by re-running the exact commands the evidence files cite (`npx jest --ci`, `npm run build`, `npm audit --audit-level=high --omit=dev`, `git log` searches) rather than trusting the SUMMARY/evidence prose. The dependency tree is measurably smaller (786→354 prod packages), the critical/high vulnerability count is measurably zero, the test suite runs measurably more (278 vs 220 passing, 5 vs 36 skipped) than the AUDIT-13 baseline, and the lockfile discipline claims (no wholesale regeneration, no forced remediation) hold up under independent git-log inspection.

The four "Pending" requirements in REQUIREMENTS.md (STAB-02, STAB-06, STAB-09, STAB-14) are not evidence of incomplete or stubbed work — each is a narrowly-scoped, honestly-disclosed limitation with a stated closure path:
- STAB-02 and STAB-14 are blocked on a single external act (pushing the branch) that this verification pass cannot itself perform, and the code/config they gate is confirmed correct and green locally.
- STAB-06's remaining clause (ban-check) is blocked on a genuine forward dependency (the Phase 3 seed dataset) and has a specific, roadmap-confirmed landing point (CERT-05, Phase 7).
- STAB-09's remaining clause (batch 5 smoke pass) is a defensible, disclosed scope judgment about what counts as an "upgrade batch" for a dev-only tooling install.

Because two items genuinely require a human/external action to close (pushing the branch to observe a CI run; running the Tier 3 preview-deployment checklist), this phase routes to **human_needed** rather than **passed**, per the verification decision tree — not because any artifact is missing, stubbed, or unwired, but because the phase's own evidence honestly declares two runtime observations as outstanding. Neither item blocks Stage 3 from starting on the toolchain/dependency side; both are explicitly named as outstanding in the phase's own STAGE-2-COMPLETION.md rather than being a discovery of this verification.

---

*Verified: 2026-09-15T16:19:29Z*
*Verifier: Claude (gsd-verifier)*
