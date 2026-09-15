# Phase 2: Dependency and Runtime Stabilization — Research

**Researched:** 2026-09-14
**Domain:** npm dependency remediation, Node/npm runtime pinning, Next.js 16 patch + `middleware.ts` → `proxy.ts` migration, Jest-as-single-runner consolidation, CI gating, SBOM and update automation
**Confidence:** HIGH (every version, advisory, export name, and byte count below was re-derived by a command in this working tree or fetched from a first-party source on 2026-09-14)

---

## Phase Constraints

> No `CONTEXT.md` exists for this phase — `/gsd-discuss-phase` was not run. The constraints below are transcribed
> verbatim from `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` and are
> **locked with the same authority as a CONTEXT.md decision**. Nothing in this research may be planned against them.

### Locked (from PROJECT.md § Constraints and REQUIREMENTS.md § Out of Scope)

- **Ordering.** Stage 2 may not start until the Stage 1 gate is evidenced. Phase 1 is verified `passed` (`01-VERIFICATION.md`), so the gate is open.
- **Behavior preservation.** Every Validated workflow in `PROJECT.md` must still work after each batch. *That is the core value.* If a foundation change breaks a workflow that worked before, the program has failed.
- **Tech stack.** Stay on Next.js App Router, Supabase, Vercel. The program stabilizes the stack; it does not replace it.
- **Security.** Never modify `.env.local`. McGill email enforcement stays in place.
- **`npm audit fix --force` is forbidden** (REQUIREMENTS.md § Out of Scope — "installs breaking majors indiscriminately, the exact failure mode Stage 2 prevents").
- **`package-lock.json` changes are reviewed as diffs, never regenerated wholesale** (STAB-11).
- **React 18 → 19 is deferred.** `react` and `react-dom` must be untouched by the `next` upgrade (STAB-05, STAB-10, STATE.md Deferred Items).
- **Package manager change (pnpm/bun) is out of scope** — "changes resolution semantics mid-program, invalidates dependency findings."
- **Chasing zero devDependency vulnerabilities is out of scope** — "mostly unreachable from production; tracked without deadline."
- **No new product features, no intentional visual changes.**

### Claude's discretion (no upstream decision exists)

- Whether `vercel` is deleted outright or moved to `devDependencies` (STAB-04 requires only that *the decision is recorded*). See § Recommendation D-1.
- The exact Node major to pin (STAB-01 says "matched to the Vercel runtime"). See § Recommendation N-1 — the evidence makes this near-forced.
- Batch boundaries and commit granularity within STAB-09.
- The concrete shape of the "smoke pass" before Phase 3's Playwright harness exists. See § Smoke Pass Design.
- Renovate vs Dependabot (STAB-15 says "Renovate (or Dependabot)"). See § Recommendation R-1.

### Deferred / out of scope for this phase (do not plan)

- Every REFAC-* and CERT-* item. In particular: the `s-maxage=60` removal (REFAC-19, Phase 6), the `getSession()`/fail-open/ban-check *behaviour* fixes (REFAC-11, Phase 5), gating `/docs` behind auth (F-054, Phase 5), the nonce CSP (F-055, Phase 5), migration-history repair (REFAC-01, Phase 3).
- All non-security major upgrades: `@supabase/ssr` 0.7 → 0.12, `typescript` 5 → 7, `tailwindcss` 3 → 4, `eslint` 9 → 10, `lucide-react` 0.344 → 1.46, `date-fns` 3 → 4, `tailwind-merge` 2 → 3, `react-easy-crop` 5 → 6, `next-swagger-doc` 0.4 → 0.5.

---

## Phase Requirements

| ID | Description | Research support |
|----|-------------|------------------|
| STAB-01 | Pin Node/npm in `engines` + `.nvmrc`, matched to Vercel, CI same major | § Recommendation N-1; Vercel disables Node 20 on **2026-10-01** [CITED]; neither `engines` nor `.nvmrc` exists today [VERIFIED] |
| STAB-02 | Resolve the npm `devdir` warning or document its source | § Pitfall 7 — **does not reproduce on this tree**; exact emitter and the 4-scope probe are reproduced live [VERIFIED] |
| STAB-03 | Written vulnerability policy before any scan-driven change | § Vulnerability Policy Skeleton; must be consistent with `audit/SEVERITY_SLA.md` (90-day exception cap, no Critical may be risk-accepted) |
| STAB-04 | `vercel` out of production deps, decision recorded | § Recommendation D-1; F-052; retires 7 of 24 High/Critical rows + the `tar` critical |
| STAB-05 | Next.js on the patched release, own commit, react/react-dom untouched | § The Next.js Upgrade — **the stated "July-2026 batch" target is superseded**; minimum patched is **16.3.3**, current **16.3.5** [VERIFIED] |
| STAB-06 | `middleware.ts` → `proxy.ts`, own gated change, rate-limit + ban-check smoke-tested before/after | § The Proxy Migration + § Smoke Pass Design; codemod verified, `unstable_doesMiddlewareMatch` verified, coexistence **throws** [VERIFIED] |
| STAB-07 | Swagger/Redoc upgraded, isolated, or removed per AUDIT-12 | § Recommendation D-2; `swagger-ui-react` unreachable → remove; `redoc`/`next-swagger-doc` reachable → patch-bump `redoc` 2.5.2 → 2.5.4 |
| STAB-08 | Jest the single runner; Vitest orphans deleted; jsdom + testing-library installed; `test` script; CI runs it | § Jest Consolidation; exact package set and `projects` config verified against installed jest 30.2.0 |
| STAB-09 | Patch/minor upgrades in small labeled batches | § Upgrade Batching Order — 6 batches, each with its own gate |
| STAB-10 | Majors isolated with a migration note | § Upgrade Batching Order; only `@types/node` 20 → 24 is proposed as a major, and only because STAB-01 forces it |
| STAB-11 | Lockfile reviewed as diffs; no `npm audit fix --force` | § Pitfall 1, § Pitfall 2; `npm audit`'s own advice for `vercel` is a **27-major** jump |
| STAB-12 | Clean-room `rm -rf node_modules && npm ci` succeeds and builds | § Clean-Room Protocol |
| STAB-13 | Build/lint/type-check/tests green at or better than AUDIT-13 | § Validation Architecture — baseline is 220 passed / 36 skipped / 16 of 21 suites, tsc 0, eslint 12 warnings 0 errors |
| STAB-14 | CI runs `npm audit --audit-level=high --omit=dev` on every PR | § CI Workflow; exit code today is **1** [VERIFIED] — so this step must land *after* the remediation batches or it red-lights every PR |
| STAB-15 | CycloneDX SBOM committed; Renovate/Dependabot configured | § Recommendation S-1 and R-1; exact commands verified from `--help` |
| STAB-16 | Bundle size recorded before and after | § Bundle Size Measurement — `.next/diagnostics/route-bundle-stats.json` is the Next 16 machine-readable artifact [VERIFIED] |
| STAB-17 | Exit gate evidenced in a Stage 2 completion note | § Exit Gate Evidence Checklist |

---

## Summary

Phase 2 looks like a version-bump phase and is not one. Phase 1 already did the reachability work, and its arithmetic is the plan: of the 24 High/Critical packages in the production tree, **7 are rooted in `vercel` — a CLI in `dependencies` that no source file imports — and 6 are rooted in `swagger-ui-react`, a package with zero importers**. Thirteen of twenty-four rows are retired by deleting two lines from `package.json`. Three more (`redoc`'s subtree) fall to a patch bump. Four are build-time-only, one needs a Realtime channel that does not exist, and exactly one — `next` — is genuinely reachable on every request. So the sequencing is: remove first, patch second, upgrade last. Starting at `npm audit` and working down the list, or reaching for `npm audit fix --force`, produces an unreviewable lockfile and a 27-major jump of a CLI nobody calls.

Three things the requirements say have moved since they were written, and the plan must absorb the correction. **First, STAB-05's target is stale.** The requirement names "the patched release closing the July-2026 CVE batch," which is `next@16.2.11`. Since then the August 2026 security release disclosed two criticals — an unauthenticated RCE via AVIF in the Image Optimization API and `CVE-2026-75604`, an unauthenticated RCE on Windows-hosted servers — patched only in **16.3.3**. `npm audit` on this tree reports the vulnerable range as `9.3.4-canary.0 - 16.3.2`. The correct target is **`next@16.3.5`** (published 2026-09-11, the newest release and the newest advisory being 2026-09-08), which stays inside the declared `^16.0.3` range, keeps the `react`/`react-dom` peer at `^18.2.0 || ^19.0.0`, and as a side effect pins `postcss 8.5.23` and `sharp ^0.35.4`, closing three more nested rows. **Second, STAB-01 has a deadline.** Vercel disables Node 20 on **2026-10-01** — seventeen days from today. CI is pinned to Node 20, the local toolchain is 24.16.0, and there is no `engines` field, no `.nvmrc` and no `.npmrc` anywhere in the tree. The pin is Node 24. **Third, STAB-02 does not reproduce.** There is no `.npmrc` in any of npm's four config scopes on this machine, `npm config get devdir` returns `undefined`, and a full `npm install --dry-run` emits no warning; the warning was reproduced synthetically to identify its emitter, so STAB-02 is satisfied by documentation, not by a change.

The riskiest single change is not a dependency at all — it is STAB-06. `src/middleware.ts` is this application's *only* page-level authentication ring, and the audit found it also carries the ban check, the onboarding guard, and the rate limiter. Next 16 will hard-**throw** at build time if `middleware.*` and `proxy.*` both exist, so there is no incremental path: it is one atomic commit. The good news is that the migration is mechanically safe and genuinely testable. The official codemod (`middleware-to-proxy`, present in stable `@next/codemod@16.3.5`) matches `src/middleware.ts`, renames only the function and the file, leaves `export const config = { matcher }` semantically untouched, and touches nothing else in this repo — this project has none of the `next.config` keys or type imports the codemod also rewrites. And the two behaviours STAB-06 names are both unit-testable under the *existing* Jest setup: `applyApiRateLimit` is a pure function that was verified live to return 429 after the 30-request POST budget, and `unstable_doesMiddlewareMatch` from `next/experimental/testing/server` asserts the matcher. One documentation trap: the Next docs call that helper `unstable_doesProxyMatch`; **that export does not exist** in either 16.2.1 or 16.3.5 — the real name is still `unstable_doesMiddlewareMatch`, verified against both tarballs.

**Primary recommendation:** Six gated batches in this order — (0) pin Node 24 + add the `test` script + delete the Vitest/Playwright orphans and put CI on Node 24 with a test step; (1) removals (`vercel`, `swagger-ui-react` + 2 companions, `yaml`, `chart.js` + `react-chartjs-2`, 3 unused Radix packages + their one dead wrapper file, `tailwindcss-animate` → devDeps); (2) `next` + `eslint-config-next` → 16.3.5 alone; (3) the `proxy.ts` migration alone, behind its own before/after characterization test; (4) patch/minor remediation (`redoc` 2.5.4, `sanitize-html` 2.17.7, `postcss` 8.5.28, transitive `ws`/`picomatch`, browserslist refresh); (5) the jsdom/testing-library install that un-skips four suites; (6) evidence — SBOM, Renovate, bundle-size delta, `npm audit --audit-level=high` in CI, and the Stage 2 completion note. **Add the CI audit step last**, because `npm audit --audit-level=high --omit=dev` exits `1` on this tree today and would red-light every intermediate PR.

---

## Architectural Responsibility Map

This phase has no application tiers. The capabilities map onto toolchain and platform tiers instead.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Node/npm version pinning (STAB-01) | Repo manifest (`package.json` `engines`) | Vercel project settings, CI workflow, `.nvmrc` | `engines.node` **overrides** the Vercel project setting [CITED: vercel.com] — the repo is the single source of truth, the dashboard is the fallback |
| npm config warning (STAB-02) | Developer machine (`~/.npmrc` / env) | — | npm names the offending scope in the warning text; there is no repo-side artifact to change |
| Dependency removal (STAB-04, -07) | Repo manifest + lockfile | Source tree (one dead wrapper file must go with `@radix-ui/react-dropdown-menu`) | Removal is a manifest edit; the coupled source deletions are what make it safe |
| Next.js patch (STAB-05) | Repo manifest + lockfile | Build (Turbopack), runtime (every request) | The framework serves every route; the fix is in-range so it is a lockfile change, not a migration |
| Proxy migration (STAB-06) | Runtime request boundary (`src/proxy.ts`) | Build (file-convention detection) | Next resolves the convention by filesystem position at build; the rename *is* the change |
| Test runner consolidation (STAB-08) | Test harness (`jest.config.js`) | CI workflow, repo manifest | Two environments in one runner is a `projects` concern, not a per-file concern |
| Vulnerability gating (STAB-14) | CI workflow | Repo manifest (`npm audit` reads the lockfile) | A gate that does not run in CI gates nothing — F-065 is exactly this failure |
| SBOM + update automation (STAB-15) | Repo (committed artifact + bot config) | CI workflow (regeneration check) | An SBOM that drifts from the lockfile is worse than none |
| Bundle size (STAB-16) | Build artifact (`.next/diagnostics/`) | — | Next 16 no longer prints sizes; the JSON diagnostic is the only first-party source |

---

## Standard Stack

### Core — packages to ADD

| Package | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `jest-environment-jsdom` | `^30.2.0` (latest 30.5.1) | DOM environment for the 4 component/hook suites | Jest 30 extracted jsdom into this package; major must match `jest` 30.2.0 [VERIFIED: npm registry] |
| `@testing-library/react` | `^16.3.3` | `render`/`screen`/`renderHook` for the 4 skipped suites — the package the suites name in their own skip comments | Peers `react ^18.0.0 \|\| ^19.0.0`, so React 18.3.1 is satisfied [VERIFIED: npm registry] |
| `@testing-library/dom` | `^10.4.2` | **Required non-optional peer** of both RTL 16 and jest-dom 7 | Only `@types/react`/`@types/react-dom` are marked optional in RTL's `peerDependenciesMeta`; omitting this produces an unmet-peer install [VERIFIED: npm registry] |
| `@testing-library/jest-dom` | `^7.0.1` | `toBeInTheDocument` / `toHaveClass` / `toHaveTextContent` — the matchers the 3 `.tsx` suites already call | Named explicitly in `FilterSidebar.test.tsx`'s own comment. **Engines `node >=22`** [VERIFIED: npm registry] |
| `@types/node` | `^24.13.4` | Align Node types with the pinned Node 24 runtime | Types-only devDependency; a major bump forced by STAB-01, not chosen |

### Supporting — one-shot tooling (do NOT install)

| Tool | Version | Purpose | When to use |
|------|---------|---------|-------------|
| `@next/codemod` | `16.3.5` | `middleware-to-proxy` transform | `npx @next/codemod@16.3.5 middleware-to-proxy .` — pin the version, do **not** use `@canary` as the docs suggest; the transform is in the stable release [VERIFIED: tarball inspection] |
| `@cyclonedx/cyclonedx-npm` | `6.0.1` | CycloneDX SBOM (STAB-15) | One-shot `npx`; adding it to devDependencies enlarges the very tree it measures |
| `update-browserslist-db` | `1.3.3` | Refresh `caniuse-lite` (the build prints a "10 months old" warning) | One-shot `npx`; writes to the lockfile — review the diff |

### Packages to REMOVE

| Package | Current | Why | Rows retired |
|---------|---------|-----|--------------|
| `vercel` | `^32.3.0` (dep) | Zero imports in `src/`; CI never invokes it; `vercel.json` only sets `buildCommand` [VERIFIED: grep] | 7 High/Critical **+ the `tar` critical** |
| `swagger-ui-react` | `^5.17.10` (dep) | Zero imports; absent from the `/docs` module closure | 6 High |
| `@types/swagger-ui-react` | `^5.18.0` (devDep) | Types for the above | — |
| `@swagger-api/apidom-ns-openapi-3-1` | `^1.0.0-rc.3` (dep) | Zero imports; a Swagger-UI companion | — |
| `yaml` | `^2.8.2` (dep) | Zero imports; carries a moderate advisory | 1 moderate |
| `chart.js` + `react-chartjs-2` | `^4.5.1` / `^5.3.1` (deps) | Project charts with `recharts`; zero Chart.js imports | — |
| `@radix-ui/react-switch`, `@radix-ui/react-tabs` | (deps) | No wrapper file, no import; the `Tabs` matches in `src/` are hand-rolled | — |
| `@radix-ui/react-dropdown-menu` | (dep) | **Pair-remove with `src/components/ui/dropdown-menu.tsx`** — its only importer is itself dead | — |
| `baseline-browser-mapping` | `^2.10.10` (devDep) | Direct declaration is a leftover pin; `next` already depends on it transitively | — |

### Packages to MOVE

| Package | From | To | Why |
|---------|------|----|-----|
| `tailwindcss-animate` | `dependencies` | `devDependencies` | Build-time only; it drags the whole Tailwind toolchain into the prod tree (F-056). `tailwindcss`, `postcss` and `autoprefixer` are already devDeps and the Vercel build works, which proves devDependencies are installed at build time |

### Packages to UPGRADE (all in-range except where noted)

| Package | Current | Target | Kind | Why |
|---------|---------|--------|------|-----|
| `next` | `^16.0.3` / 16.2.1 | `^16.3.5` | minor, **own commit** | Minimum patched 16.3.3; also pins `postcss 8.5.23` + `sharp ^0.35.4` |
| `eslint-config-next` | `^16.0.3` | `^16.3.5` | minor | Versioned in lockstep with `next`; 16.3.5 published [VERIFIED] |
| `redoc` | `^2.5.2` | `^2.5.4` | patch | Closes `brace-expansion`, `fast-uri`, `fast-xml-builder` (3 High) + the `dompurify` moderate |
| `sanitize-html` | `^2.17.1` | `^2.17.7` | patch | The only moderate on a first-party import path (`src/lib/sanitize.ts`) |
| `postcss` (devDep) | `^8.4.35` / 8.5.6 | `^8.5.28` | patch | Vulnerable ceiling is `<=8.5.22`; also lifts `nanoid` past `<=3.3.17` |
| `@supabase/supabase-js` | `^2.49.0` / 2.81.1 | `^2.116.0` | minor, **own commit** | 35 minors behind. Not security-driven — isolate it because the blast radius is every data call |
| `ws` (transitive) | 8.18.3 | ≥ 8.21.0 | transitive | `@supabase/realtime-js` declares `ws ^8.18.2`, so `npm update ws` reaches 8.21.3 in-range [VERIFIED] |
| `picomatch` (transitive) | 2.3.1 | 2.3.2 | transitive | `micromatch@4.0.8` declares `picomatch ^2.3.1` and **2.3.2 exists and is the patched 2.x** [VERIFIED] — no `overrides` needed |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Removing `vercel` | `vercel@59.16.0` (npm's own `fixAvailable`) | A **27-major** jump of a CLI nothing imports. Strictly more risk for strictly less benefit; also forbidden in spirit by the `audit fix --force` exclusion |
| `@cyclonedx/cyclonedx-npm` | `@cyclonedx/cdxgen` (12.8.4) | cdxgen is polyglot and heavier; `cyclonedx-npm` is the npm-specific tool CycloneDX itself lists in its Tool Center [CITED: cyclonedx.org/tool-center] |
| Renovate | Dependabot (`.github/dependabot.yml`) | Dependabot is zero-install on GitHub but has **no patch-only auto-merge and no grouping-with-automerge** primitive — STAB-15 names both. Renovate's `:automergePatch` + `packageRules[].groupName` express the requirement directly |
| Jest `projects` for jsdom | Per-file `@jest-environment jsdom` docblock | Docblocks work, but `src/hooks/useEvents.test.ts` is a `.ts` file that needs jsdom, so the routing rule is not "by extension" either way. `projects` puts the rule in one reviewable place and tags output with a `displayName` |
| Upgrading `swagger-ui-react` to 5.32.15 | — | Wasted: the package is unreachable and is being deleted. `npm outdated` lists it; do not spend the upgrade |

### Installation

```bash
# Batch 5 — test harness (see § Upgrade Batching Order for ordering)
npm install --save-dev \
  jest-environment-jsdom@^30.2.0 \
  @testing-library/react@^16.3.3 \
  @testing-library/dom@^10.4.2 \
  @testing-library/jest-dom@^7.0.1

# Batch 0 — Node types follow the Node pin
npm install --save-dev @types/node@^24.13.4
```

**Version verification (re-run before writing the plan — these were checked 2026-09-14):**

```bash
npm view next version                      # 16.3.5  (published 2026-09-11)
npm view eslint-config-next version        # 16.3.5
npm view jest-environment-jsdom version    # 30.5.1
npm view @testing-library/react version    # 16.3.3
npm view @testing-library/dom version      # 10.4.2
npm view @testing-library/jest-dom version # 7.0.1
npm view redoc version                     # 2.5.4
npm view sanitize-html version             # 2.17.7
npm view postcss version                   # 8.5.28
npm view @supabase/supabase-js version     # 2.116.0
npm view @cyclonedx/cyclonedx-npm version  # 6.0.1
npm view @types/node@24 version            # 24.13.4
```

---

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm ...` on 2026-09-14.

| Package | Registry | Latest published | Weekly downloads | Source repo | Verdict | Disposition |
|---------|----------|------------------|------------------|-------------|---------|-------------|
| `jest-environment-jsdom` | npm | 2026-09-01 | 17,448,485 | github.com/jestjs/jest | SUS (`too-new`) | **Approved** — see note |
| `@testing-library/react` | npm | 2026-08-27 | 42,965,024 | github.com/testing-library/react-testing-library | SUS (`too-new`) | **Approved** — see note |
| `@testing-library/dom` | npm | 2026-09-13 | 51,902,196 | github.com/testing-library/dom-testing-library | SUS (`too-new`) | **Approved** — see note |
| `@testing-library/jest-dom` | npm | 2026-08-09 | 46,157,706 | github.com/testing-library/jest-dom | OK | Approved |
| `@cyclonedx/cyclonedx-npm` | npm | 2026-08-11 | 370,187 | github.com/CycloneDX/cyclonedx-node-npm | OK | Approved |
| `@next/codemod` | npm | 2026-09-11 | 30,218 | github.com/vercel/next.js | SUS (`too-new`) | **Approved** — see note |
| `next` | npm | 2026-09-11 | 43,416,095 | github.com/vercel/next.js | SUS (`too-new`) | **Approved** — already a direct dependency |
| `postcss` | npm | 2026-09-03 | 208,038,028 | github.com/postcss/postcss | SUS (`too-new`) | **Approved** — already a direct devDependency |
| `sanitize-html` | npm | 2026-08-13 | 7,631,946 | github.com/apostrophecms/apostrophe | OK | Approved — already a direct dependency |
| `redoc` | npm | 2026-09-10 | 961,082 | github.com/Redocly/redoc | SUS (`too-new`) | **Approved** — already a direct dependency |
| `@supabase/supabase-js` | npm | 2026-09-07 | 20,147,886 | github.com/supabase/supabase-js | SUS (`too-new`) | **Approved** — already a direct dependency |

**Note on the `too-new` verdicts.** The seam's `too-new` signal measures the recency of the *latest published version*, not the age of the package. Every SUS row above has a first-party source repository, seven-to-nine-figure weekly download counts, and is either already in `package.json` or is named by first-party documentation. None is a slopsquat candidate. **No `checkpoint:human-verify` task is warranted for any of them**, and the planner should not insert one on the strength of the `too-new` reason alone.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages genuinely suspicious:** none.

**Provenance.** `@next/codemod` and the `middleware-to-proxy` transform name came from the official Next.js documentation and were then confirmed by extracting `package/transforms/middleware-to-proxy.js` from the 16.3.5 tarball → `[VERIFIED]`. `@cyclonedx/cyclonedx-npm` is listed by CycloneDX's own Tool Center → `[VERIFIED]`. The four testing-library / jsdom packages are named *by this repository's own test files and by Phase 1's `test-runner-decision.md`*, not discovered by search → `[VERIFIED: codebase grep]`.

---

## Architecture Patterns

### The change pipeline

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │ GATE: Phase 1 baseline (immutable reference)                        │
 │  audit/baseline/{jest,tsc,lint,build,versions}.txt  ·  lock.sha256  │
 └───────────────────────────────┬─────────────────────────────────────┘
                                 │  every batch is measured against this
                                 ▼
   ┌─── B0 Toolchain floor ───────────────────────────────────────┐
   │ engines+.nvmrc(24) · npm "test" script · delete vitest.* ·   │
   │ delete test-results/ · drop check:feedback · CI node 24 +    │
   │ jest step   →  CI now gates the 220 passing tests            │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B1 Removals ──────────────────────────────────────────────┐
   │ vercel · swagger-ui-react(+2) · yaml · chart.js(+1) ·        │
   │ 3 radix (+1 source file) · tailwindcss-animate→devDeps       │
   │   →  13 of 24 High/Critical rows retired                     │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B2 next@16.3.5 (alone) ───────────────────────────────────┐
   │ next + eslint-config-next.  react/react-dom UNTOUCHED.       │
   │   →  25 advisories incl. 2 criticals; postcss+sharp nested   │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B3 proxy migration (alone, atomic) ───────────────────────┐
   │ characterization test FIRST → codemod → same test → smoke    │
   │   ⚠ build THROWS if middleware.* and proxy.* coexist         │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B4 patch/minor remediation ───────────────────────────────┐
   │ redoc 2.5.4 · sanitize-html 2.17.7 · postcss 8.5.28 ·        │
   │ npm update ws picomatch · browserslist refresh               │
   │ (supabase-js 2.116.0 as its own sub-commit)                  │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B5 jsdom + testing-library ───────────────────────────────┐
   │ install 4 pkgs · jest projects{node,jsdom} · jest.setup.ts · │
   │ un-skip 4 suites (5th is contract drift — decide, not fix)   │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
   ┌─── B6 Evidence ──────────────────────────────────────────────┐
   │ clean-room npm ci+build · SBOM · renovate.json ·             │
   │ bundle before/after · CI npm audit step (LAST) ·             │
   │ STAGE-2-COMPLETION.md                                        │
   └───────────────────────────────┬──────────────────────────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │ Per-batch gate, run identically every time:      │
        │  npm run lint → npx tsc --noEmit → npm test →    │
        │  npm run build → smoke pass → git diff the lock  │
        └──────────────────────────────────────────────────┘
```

### Recommended artifact layout

```
.planning/phases/02-dependency-and-runtime-stabilization/
└── evidence/                      # all Stage 2 captures live here, committed
    ├── VULNERABILITY-POLICY.md    # STAB-03 — written BEFORE batch 1
    ├── STAGE-2-COMPLETION.md      # STAB-17
    ├── devdir-investigation.md    # STAB-02
    ├── vercel-removal-decision.md # STAB-04
    ├── proxy-migration-note.md    # STAB-06 before/after
    ├── bundle-size.before.json    # STAB-16 (route-bundle-stats.json copy)
    ├── bundle-size.after.json
    ├── bundle-size.md             # the delta table
    ├── cleanroom-npm-ci.txt       # STAB-12
    ├── audit.before.json / audit.after.json
    └── batch-NN-{lint,tsc,jest,build}.txt
sbom.cyclonedx.json                # STAB-15, repo root, committed
renovate.json                      # STAB-15, repo root
.nvmrc                             # STAB-01
```

### Pattern 1: One reviewable commit per batch, with the lockfile diff as the artifact

**What:** Each batch is exactly one commit. The commit body records: the manifest lines changed, the *line count* of the `package-lock.json` diff, the `npm audit --omit=dev` counts before and after, and the four gate results.
**When to use:** Every batch. STAB-09 and STAB-11 require it jointly.
**Example:**

```bash
# BEFORE the edit — capture the reference
npm audit --omit=dev --json --package-lock-only > evidence/audit.b1.before.json
sha256sum package-lock.json                      > evidence/lock.b1.before.sha256

# Edit package.json by hand (never `npm audit fix`, never `npm install <pkg>@latest` blind)
npm pkg delete dependencies.vercel
npm pkg delete dependencies.swagger-ui-react
npm pkg delete devDependencies.'@types/swagger-ui-react'
npm pkg delete dependencies.'@swagger-api/apidom-ns-openapi-3-1'
npm pkg delete dependencies.yaml

# Let npm reconcile the lockfile WITHOUT touching anything else
npm install --package-lock-only

# Review the diff as a diff — this is the STAB-11 gate, and it is a human act
git --no-pager diff --stat package-lock.json
git --no-pager diff package.json

# Only then materialise node_modules
npm ci
```

> `npm install --package-lock-only` reconciles the lockfile from the manifest without writing `node_modules`, so the diff can be read before anything is installed. Pair it with `npm ci` (never a bare `npm install`) so the installed tree is provably the lockfile's tree.

### Pattern 2: Characterize before you migrate (STAB-06)

**What:** Write the assertion against today's behaviour, watch it pass on today's code, then change the code, then watch the *same* assertion pass. This is the Stage 3 discipline (REFAC-23) pulled forward for the one Phase 2 change that touches the request path.
**When to use:** STAB-06 only. The dependency batches are covered by the existing 220 tests plus the smoke pass.
**Example:** see § Code Examples 1 and 2 — both were executed live in this tree.

### Pattern 3: Remove the root, not the leaves

**What:** When an advisory's path runs through a package with zero importers, the fix is deletion of the root, not an upgrade of the leaf. Phase 1 already produced the reachability judgment per row; do not re-derive it.
**When to use:** Batch 1. Thirteen of twenty-four High/Critical rows.
**Anti-example:** `npm audit`'s `fixAvailable` for seven of those rows is literally `{"name":"vercel","version":"59.16.0","isSemVerMajor":true}`.

### Anti-patterns to avoid

- **`npm audit fix` / `npm audit fix --force`.** Explicitly out of scope. It will propose the 27-major `vercel` jump and rewrite the lockfile wholesale, destroying STAB-11.
- **`rm package-lock.json && npm install`.** The single fastest way to fail STAB-11. Use `npm install --package-lock-only` to reconcile.
- **Adding the CI `npm audit --audit-level=high` step in batch 0.** It exits `1` on this tree today; every PR from batch 0 to batch 5 would be red, and the team would learn to ignore a red gate. Add it in batch 6.
- **Un-excluding test files from `tsconfig.json` as part of STAB-08.** F-066's validation criterion asks for it; it produces **86 errors across 10 files** today. See Pitfall 5.
- **Letting `react`/`react-dom` ride along.** `npm update` with no arguments will move them within `^18.3.0`; that is fine. `npm install next@latest` will not touch them. But **never** run `npm update --save` broadly or accept a Renovate PR that bundles React.
- **Treating "tests pass" as the STAB-13 gate.** The gate is a quoted pass count *and* a separately quoted skip count, compared against 220/36.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Renaming `middleware` → `proxy` | A manual `git mv` plus find-and-replace | `npx @next/codemod@16.3.5 middleware-to-proxy .` | The codemod also strips `runtime` from the config export, renames four `next.config` keys and two `next/server` type imports, and handles the `export { middleware }` / default-export / name-collision forms. A hand rename silently misses whichever of those your file happens to use next time |
| Asserting the proxy matcher covers the right paths | Re-implementing `path-to-regexp` against the matcher string in a test | `unstable_doesMiddlewareMatch` from `next/experimental/testing/server` | It runs Next's own matcher compiler, including the `_next/data` special case. A hand-rolled regex test asserts your regex, not Next's |
| Generating an SBOM | Walking `package-lock.json` into a JSON document | `@cyclonedx/cyclonedx-npm` | PURL construction, license evidence, dependency-graph nesting and CycloneDX schema validation are all solved and all easy to get subtly wrong |
| Measuring bundle size | Parsing the `next build` stdout | `.next/diagnostics/route-bundle-stats.json` | Next 16's Turbopack build **no longer prints a size table at all** — there is nothing to parse. The JSON diagnostic is the first-party replacement |
| Grouped, patch-only dependency automation | A cron job running `npm update` and opening a PR | Renovate presets `:automergePatch` + `packageRules[].groupName` | Renovate already models update-type classification, grouping, `minimumReleaseAge`, and re-basing against a moving `main` |
| Deciding which advisories are reachable | Re-running the audit and re-judging | `.planning/audit/quality/dependency-report.md` §§ 1–3 | Phase 1 dispositioned all 24 rows with a module-graph path or a config line per row. Re-deriving it is the work Phase 1 already paid for |

**Key insight:** every hand-rolled option in this table is *cheap to write and expensive to be wrong about*, and in each case being wrong is silent — a matcher test that passes against the wrong regex, an SBOM that validates against nothing, a size number that measures a different thing before and after.

---

## Runtime State Inventory

> STAB-06 is a rename, so this section is required. "Nothing found" is stated explicitly where it applies.

| Category | Items found | Action required |
|----------|-------------|------------------|
| **Stored data** | **None — verified.** No database, cache, or datastore key in this project contains the string `middleware`. `grep -rn "middleware" supabase/` returns nothing relevant; the rename touches no column, collection, policy, or row. The dependency removals touch no stored data either. | none |
| **Live service config** | **Two items.** (1) **Vercel project setting → Node.js Version.** `engines.node` overrides it [CITED: vercel.com], so adding `engines` is sufficient — but the dashboard value is separate state that will silently disagree. Record the dashboard value in the evidence note; optionally align it. (2) **Vercel's deployed proxy/middleware function.** Next compiles the file convention into a platform function at build; after the rename the *next* production deploy regenerates it. There is no manual registration to update, but the first post-rename deploy is the only place the rename is actually exercised against the CDN — so the smoke pass must run against a preview deployment, not only locally. | (1) record/align dashboard Node version; (2) smoke the preview deploy |
| **OS-registered state** | **None — verified.** No Task Scheduler, launchd, systemd, or pm2 registration exists in or for this repository. Scheduling is pg_cron inside Supabase (`audit/async/cron-job.json`) and is untouched by Phase 2. | none |
| **Secrets and env vars** | **None changed.** No env var name contains `middleware`. `.env.local` is never modified (hard constraint). CI's `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` placeholders in `ci.yml` stay as-is. ⚠ Note but do **not** act: F-040 records that `ADMIN_API_KEY`, `CRON_SECRET` and `ADMIN_EMAILS` are absent from the production project — that is Phase 5 work, and touching it here would change behaviour. | none |
| **Build artifacts / installed packages** | **Four items.** (1) `node_modules/` — 979 MB, must be deleted for the STAB-12 clean-room. (2) `.next/` — gitignored, must be deleted before each bundle-size capture or the diagnostics JSON is stale. (3) `tsconfig.json` sets `"incremental": true`, so a `.tsbuildinfo` exists locally; it is **not tracked** (`git ls-files` finds none) but must be cleared in the clean room. (4) **`test-results/.last-run.json` IS tracked** (`git ls-files test-results` → one file) and asserts `{"status":"failed"}` from a Playwright install that does not exist — delete it and add `test-results/` to `.gitignore` (F-064). | (1)(2)(3) clean-room hygiene; (4) delete + gitignore |

**The canonical question — after every file in the repo is updated, what still holds the old string?** Only the Vercel dashboard's Node.js Version setting (which `engines` overrides but does not erase) and the currently-deployed production function (which the next deploy replaces). Both are covered above.

---

## Common Pitfalls

### Pitfall 1: Starting from `npm audit` output instead of from the reachability report

**What goes wrong:** The exit gate is phrased in vulnerability counts, so work begins at the top of `npm audit --omit=dev` and proceeds down. Weeks of churn produce a lockfile nobody can review, and the two lines that would have retired thirteen rows are still there.
**Why it happens:** `npm audit` sorts by severity, not by leverage. Its own `fixAvailable` for the `vercel` subtree is a 27-major CLI jump.
**How to avoid:** Batch 1 is removals, driven by `audit/quality/dependency-report.md` § 2's per-row reachability column, not by audit output order. Re-run `npm audit` *after* each batch to measure, never to plan.
**Warning signs:** a lockfile diff over ~2,000 lines in a single batch; a commit message that cites a GHSA id instead of a package removal; `vercel` still in `dependencies` after batch 1.

### Pitfall 2: Regenerating the lockfile instead of reconciling it

**What goes wrong:** `rm package-lock.json && npm install` produces a diff that is 100 % of the file, which cannot be reviewed, which means STAB-11 silently fails and the "reproducible install" in STAB-12 is proving a tree nobody chose.
**Why it happens:** It is the reflex when `npm ci` complains that the lockfile and manifest disagree after a hand edit of `package.json`.
**How to avoid:** `npm install --package-lock-only` after every manifest edit. It updates only the affected subtrees. Then `git diff --stat package-lock.json` before `npm ci`.
**Warning signs:** `git diff --stat package-lock.json` reporting a change count close to the file's line count; `lockfileVersion` changing; unrelated packages moving in the same diff.

### Pitfall 3: `next build` throws when `middleware.*` and `proxy.*` both exist

**What goes wrong:** An incremental migration — create `src/proxy.ts`, verify it, then delete `src/middleware.ts` — fails at the first build with a hard error, not a warning.
**Why it happens:** Verified in the installed source at `node_modules/next/dist/build/index.js:644`:

> ``Both ${MIDDLEWARE_FILENAME} file "./…" and ${PROXY_FILENAME} file "./…" are detected. Please use "./…" only.``

Line 650 is the warn-only path, taken when only `middleware.*` exists — which is the `⚠ The "middleware" file convention is deprecated` line already in `audit/baseline/build.txt`.
**How to avoid:** The migration is one atomic commit. Let the codemod do the rename (it `writeFileSync`s the new file and `unlinkSync`s the old one in the same pass), and never stage a state where both exist.
**Warning signs:** a build error containing "are detected"; a `git status` showing both `src/middleware.ts` and `src/proxy.ts` as present.

### Pitfall 4: `unstable_doesProxyMatch` does not exist

**What goes wrong:** The official proxy docs show `unstable_doesProxyMatch` from `next/experimental/testing/server`. Writing the STAB-06 matcher test against that name fails with `TypeError: (0 , server_1.unstable_doesProxyMatch) is not a function` — which reads like a Jest/ESM interop problem and sends the executor down the wrong road.
**Why it happens:** The docs page is ahead of the shipped code. Verified by enumerating the module's exports in the installed 16.2.1 *and* by extracting `dist/experimental/testing/server/index.d.ts` from the **16.3.5** tarball — both export `unstable_doesMiddlewareMatch`, `unstable_getResponseFromNextConfig`, `getRedirectUrl`, `getRewrittenUrl`, `isRewrite`. There is no `proxy-testing-utils` file in either tarball.
**How to avoid:** Use `unstable_doesMiddlewareMatch`. Its signature is `{ config: { matcher? }, url, headers?, cookies?, nextConfig? } => boolean`.
**Warning signs:** `is not a function` on an `unstable_*` import; a plan step that cites the docs page rather than the `.d.ts`.

### Pitfall 5: Un-excluding test files from `tsconfig.json` breaks `tsc --noEmit`

**What goes wrong:** F-066's validation criterion says "`npx tsc --noEmit` type-checks the test files with zero diagnostics." Removing `"**/*.test.ts"` / `"**/*.test.tsx"` from `tsconfig.json`'s `exclude` produces **86 errors across 10 files**, measured today:

| Code | Count | Nature |
|---|---|---|
| TS2451 Cannot redeclare block-scoped variable | 26 | cross-file collision — the API test files share a global scope |
| TS2352 unsafe conversion | 15 | `NextRequest` handler cast to a `Request` handler |
| TS2554 wrong argument count | 14 | route handlers now take 2 args |
| TS2339 property does not exist | 14 | `toBeInTheDocument` / `toHaveClass` before jest-dom types load |
| TS2393 duplicate function implementation | 12 | same cross-file collision |
| TS2820/TS2740/TS2353/TS2322/TS7031 | 5 | genuine fixture drift (`"Academic"` vs `EventTag.ACADEMIC`, incomplete `Club` fixture, `"academic"` not an `EventTag`) |

**Why it happens:** `tsc` compiles all included files as one program, so test files that declare `const mockUser` at top level with no `import`/`export` collide. `ts-jest` compiles each file in isolation, which is why all 16 executing suites pass today despite 71 whole-program errors — verified live: `npx jest --ci src/__tests__/api/events/rsvp.test.ts` passes 14/14 while the whole-program probe reports 18 errors in that same file.
**How to avoid:** Treat the `tsconfig` exclude removal as **its own scoped item**, not a side effect of STAB-08. If it is in scope, expect real work: 38 of the 86 are fixed by adding `export {}` to the colliding test files, ~14 by importing `@testing-library/jest-dom` into a setup file that is inside the tsc program, and the rest are genuine fixture repairs. If it is out of scope, say so in the completion note — do not let F-066 read as closed.
**Warning signs:** an executor "fixing" the type errors by widening handler signatures in `src/app/api/**` — that is a behaviour change smuggled in as a type fix.

### Pitfall 6: `@testing-library/jest-dom@7` requires Node ≥ 22, and `@testing-library/dom` is a required peer

**What goes wrong:** Installing only `@testing-library/react` + `jest-environment-jsdom` leaves `@testing-library/dom` as an unmet peer (RTL 16 lists it under `peerDependencies` with **no** `peerDependenciesMeta.optional` entry — only `@types/react` and `@types/react-dom` are optional). Separately, `@testing-library/jest-dom@7.0.1` declares `engines.node >= 22`; so does `6.10.0`, so there is no v6 escape hatch. On CI's current Node 20 the install warns (npm does not enforce `engines` unless `engine-strict`), and the divergence becomes a real failure the moment anyone turns strict engines on.
**Why it happens:** RTL moved `@testing-library/dom` from a dependency to a peer in v13; the testing-library packages moved their Node floor to 22 in 2026.
**How to avoid:** Install all four packages together, and land the Node 24 pin (batch 0) **before** the testing-library install (batch 5). The ordering is not cosmetic.
**Warning signs:** `npm ls @testing-library/dom` reporting `(empty)` or `UNMET PEER DEPENDENCY`; `npm warn EBADENGINE` in CI logs.

### Pitfall 7: The `devdir` warning does not reproduce, and chasing it in the repo wastes the task

**What goes wrong:** STAB-02 reads as a repo defect, so the executor greps `package.json`, `.npmrc`, CI, and `vercel.json` for `devdir` and finds nothing — then either invents a fix or marks the requirement blocked.
**Why it happens:** `devdir` is a node-gyp config key that npm removed from its schema. npm 11 emits it as an *unknown config* warning naming the scope it came from. It is machine state, not repo state.
**How to avoid:** Run the four-scope probe, record the output verbatim, and close STAB-02 as documentation. Measured on this tree 2026-09-14:

```bash
npm config get devdir          # -> undefined
npm config ls -l | grep -E '^(userconfig|globalconfig) '
#   globalconfig = "/Users/adyan/.local/share/fnm/node-versions/v24.16.0/installation/etc/npmrc"
#   userconfig   = "/Users/adyan/.npmrc"        <- does not exist
ls -la ~/.npmrc /usr/local/etc/npmrc            # both: No such file or directory
find . -name .npmrc -not -path './node_modules/*'   # no results
env | grep -i npm_config_devdir                     # no results
npm install --dry-run                                # "up to date", no warning
```

The emitter was confirmed synthetically in a scratch directory on the same npm 11.13.0:

```
$ printf 'devdir=/tmp/foo\n' > .npmrc && npm ls
npm warn Unknown project config "devdir". This will stop working in the next major version of npm.
      See `npm help npmrc` for supported config options.

$ npm_config_devdir=/tmp/foo npm ls
npm warn Unknown env config "devdir". ...
npm warn Unknown project config "devdir". ...
```

**The scope word in the message — `project` / `user` / `global` / `env` — names the file or variable to fix.** Whoever saw the warning saw it from one of those four, on their machine. Record that, add a repo `.npmrc` only if the team wants to *assert* config (it is not required), and close.
**Warning signs:** a plan task that edits `package.json` or CI to "fix devdir"; a completion note claiming the warning was resolved without showing the probe output.

### Pitfall 8: Adding the CI audit gate too early

**What goes wrong:** `npm audit --audit-level=high --omit=dev` **exits 1 on this tree today** (verified). Adding it in batch 0 makes every PR red for the next five batches; the team learns to merge past a red check, and the gate is dead on arrival.
**How to avoid:** Batch 6. Land it only after the remediation batches have driven the count to the policy threshold, and capture the passing run as STAB-14 evidence in the same commit.
**Warning signs:** a red `audit` job with an "expected, will fix later" comment.

### Pitfall 9: Measuring "bundle size before/after" for dependencies that were never bundled

**What goes wrong:** The batch-1 removals (`swagger-ui-react`, `chart.js`, `yaml`, three Radix packages) have **zero importers**, so Turbopack already tree-shook them out. The before/after route-bundle delta for batch 1 will be approximately **zero**, and an executor expecting a win will either doubt the measurement or pad the numbers.
**Why it happens:** "remove unused dependencies" and "shrink the bundle" sound like the same thing and are not.
**How to avoid:** Record **two** metrics side by side and say which one each removal moves. Install-tree metrics (production dependency count from `npm ls --omit=dev --all --json`, `node_modules` size, advisory counts) move a lot on batch 1. Route-bundle metrics move on batch 2 (`next` 16.2.1 → 16.3.5 changes the framework chunks) and essentially nowhere else. `@radix-ui/react-dropdown-menu` is the one removal that *can* move a route bundle, and only because its dead wrapper file goes with it.
**Warning signs:** a bundle-size table with a single column; a claimed reduction with no chunk-path evidence.

### Pitfall 10: The `vercel` removal looks like it might break deployment

**What goes wrong:** Hesitation, or a decision to keep it in `devDependencies` "to be safe," which leaves the `tar` critical in the dev tree for no reason.
**Why it happens:** The package is named after the deployment platform.
**How to avoid:** Three checks, all run and all negative on this tree: `.github/workflows/ci.yml` never invokes `vercel`; `package.json` `scripts` never invokes it; `git grep "from ['\"]vercel\|require('vercel'" -- src scripts` returns zero. Deployment is Vercel's git integration with `vercel.json` setting `buildCommand: "npm run build"` — no CLI. **Note the near-miss:** `@vercel/analytics` and `@vercel/speed-insights` *are* imported (`src/app/layout.tsx:3-4`) and are different packages. Do not remove those.
**Warning signs:** a plan step that removes `@vercel/*` packages as a group.

---

## Code Examples

### 1. Rate-limit characterization — **executed live in this tree, passed**

`src/middlewareRateLimit.ts` is a pure module; it needs no jsdom, no Supabase mock, and no proxy. This is the "rate-limiting behavior smoke-tested before and after" half of STAB-06, and it works on today's config unchanged.

```ts
// src/middlewareRateLimit.test.ts  (new — Wave 0)
import { applyApiRateLimit } from "@/middlewareRateLimit";
import { NextRequest } from "next/server";

const req = (path: string, method: string, ip: string) =>
  new NextRequest(`https://x.test${path}`, {
    method,
    headers: { "x-forwarded-for": ip },
  });

describe("applyApiRateLimit (PRESERVE — must behave identically after the proxy rename)", () => {
  it("returns 429 once the POST budget of 30/min/IP/path is exceeded", () => {
    let last: Response | null = null;
    for (let i = 0; i < 35; i++) last = applyApiRateLimit(req("/api/events", "POST", "9.9.9.9"));
    expect(last?.status).toBe(429);          // verified: passes today
    expect(last?.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not rate-limit /api/admin/*", () => { /* ADMIN_PREFIX bypass */ });
  it("gives /api/interactions the 300/min high-frequency budget", () => { /* ... */ });
  it("returns null for a non-/api path", () => {
    expect(applyApiRateLimit(req("/profile", "GET", "9.9.9.9"))).toBeNull();
  });
});
```

> The store lives on `globalThis` under `__uni_verse_mw_rate_limit__` and buckets are keyed by IP **and** path, so use a distinct IP or path per test to avoid cross-test bleed. Jest's default `testEnvironment` isolation gives a fresh module registry per file, not per test.

### 2. Matcher characterization — the STAB-06 before/after assertion

```ts
// src/proxy.test.ts  (write it as src/middleware.test.ts in the "before" commit,
//                     rename the import in the same commit as the codemod)
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
//     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ NOT `unstable_doesProxyMatch` — see Pitfall 4
import { config } from "./proxy";

const matches = (url: string) =>
  unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

describe("proxy matcher (PRESERVE — identical to the middleware matcher)", () => {
  it.each(["/profile", "/my-events", "/create-event", "/notifications",
           "/settings", "/my-clubs", "/invites", "/friends",
           "/", "/api/events", "/docs", "/banned", "/onboarding"])(
    "runs on %s", (url) => expect(matches(url)).toBe(true));

  it.each(["/_next/static/chunk.js", "/_next/image", "/favicon.ico",
           "/auth/callback", "/logo.png", "/icon.svg"])(
    "skips %s", (url) => expect(matches(url)).toBe(false));
});
```

Run this on the pre-rename tree (importing `./middleware`) and record the output into `evidence/proxy-migration-note.md`; run it again on the post-rename tree. Identical results are the STAB-06 "before and after" evidence.

### 3. The proxy migration, in full

```bash
# 0. Pre-state: only src/middleware.ts exists; `next build` warns (baseline/build.txt line 8)
git status --short          # must be clean
npx jest --ci src/middlewareRateLimit.test.ts src/middleware.test.ts \
  > .planning/phases/02-*/evidence/proxy.before.txt

# 1. Codemod — pinned, not @canary. The transform is in the stable release.
npx --yes @next/codemod@16.3.5 middleware-to-proxy .

# 2. Verify exactly what moved
git status --short
#   D  src/middleware.ts
#   ?? src/proxy.ts
git add -A && git --no-pager diff --cached -M --stat   # -M surfaces it as a rename
```

What the codemod does to *this* file, read from `package/transforms/middleware-to-proxy.js`:

```diff
  // src/middleware.ts  ->  src/proxy.ts
- export async function middleware(request: NextRequest) {
+ export async function proxy(request: NextRequest) {

  export const config = {
    matcher: [ "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)" ],
  };            // ^ UNCHANGED — only a `runtime` key would have been stripped
```

Everything else the transform can do is a no-op here, and each no-op is worth asserting rather than assuming:

| Transform capability | Applies to this repo? |
|---|---|
| `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` (+ 3 sibling `next.config` keys) | **No** — `next.config.js` declares none of them |
| `NextMiddleware` → `NextProxy`, `MiddlewareConfig` → `ProxyConfig` type imports | **No** — the file imports `NextResponse` and `type NextRequest` only |
| Strip `export const runtime` / `config.runtime` | **No** — neither exists |
| Name-collision aliasing (`_proxy1`) | **No** — no `proxy` identifier in scope |
| `import { applyApiRateLimit } from "./middlewareRateLimit"` | **Untouched** — same directory, relative path still resolves. Renaming that module is optional and out of scope |

```bash
# 3. Same assertions, post-rename
npx jest --ci src/middlewareRateLimit.test.ts src/proxy.test.ts \
  > .planning/phases/02-*/evidence/proxy.after.txt
diff <(grep -E '✓|✕' evidence/proxy.before.txt) <(grep -E '✓|✕' evidence/proxy.after.txt)

# 4. Full gate + the deprecation warning must be GONE from the build log
npm run lint && npx tsc --noEmit && npm test && npm run build 2>&1 | tee evidence/build.b3.txt
grep -c 'middleware.*deprecated' evidence/build.b3.txt    # must be 0
```

### 4. Node/npm pinning (STAB-01)

```jsonc
// package.json
{
  "engines": {
    "node": "24.x",          // Vercel maps "24.x" to the latest 24.x; overrides the dashboard setting
    "npm":  ">=11"           // local is 11.13.0; a floor, not a pin — npm ships with Node
  }
}
```

```
# .nvmrc  (also read by fnm, which is the local version manager here)
24
```

```yaml
# .github/workflows/ci.yml
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'   # one source of truth; cannot drift from the repo
          cache: npm
```

> `node-version-file: '.nvmrc'` is preferable to `node-version: 24` — it makes `.nvmrc` authoritative and removes the third place the version can disagree. The three places today are: local 24.16.0, CI 20, and nothing in the repo.

### 5. CI workflow, final shape (batch 6)

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: TypeScript type-check
        run: npx tsc --noEmit

      - name: Run tests                      # STAB-08 / STAB-13 — add in batch 0
        run: npm test

      - name: Production vulnerability gate  # STAB-14 — add LAST, in batch 6
        run: npm audit --audit-level=high --omit=dev

      - name: Run build
        run: npm run build
```

```jsonc
// package.json scripts — STAB-08
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --ci"
    // and DELETE "check:feedback" — scripts/check-feedback-loop.mjs does not exist (F-064)
  }
}
```

> `npm test` on Jest 30 **exits 1 when no tests are found**. That is the behaviour you want — do not add `--passWithNoTests`, because a config error that makes Jest match nothing would otherwise pass CI green.

### 6. Jest two-environment config (STAB-08)

```js
// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
const common = {
  preset: "ts-jest",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/.claude/", "/supabase/functions/tests/"],
};

module.exports = {
  projects: [
    {
      ...common,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      testPathIgnorePatterns: [...common.testPathIgnorePatterns, "<rootDir>/src/hooks/"],
    },
    {
      ...common,
      displayName: "jsdom",
      testEnvironment: "jsdom",
      // NOTE: useEvents.test.ts is a .ts file that needs jsdom — extension is not the rule
      testMatch: ["<rootDir>/src/**/*.test.tsx", "<rootDir>/src/hooks/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};
```

```ts
// jest.setup.ts
import "@testing-library/jest-dom";
```

Then, per un-skipped suite, remove the stub and restore the real import:

```diff
- // @testing-library/react is not installed — all tests in this file are skipped
- const { render, screen, fireEvent, waitFor } = {} as any;
+ import { render, screen, fireEvent, waitFor } from "@testing-library/react";

- describe.skip("EventFilters Component (@testing-library/react not installed)", () => {
+ describe("EventFilters Component", () => {
```

**Per-suite reality check** (from `audit/baseline/test-runner-decision.md` § 5, cross-checked against the whole-program `tsc` probe):

| Suite | Skipped tests | Install alone revives it? | Extra work |
|---|---|---|---|
| `src/components/ErrorBoundary.test.tsx` | 2 | yes | remove stub; it also carries a stray `"use client"` at line 1 |
| `src/components/events/EventFilters.test.tsx` | 5 | yes | remove stub |
| `src/components/events/FilterSidebar.test.tsx` | 4 | **no** | remove stub **+** fix `"academic"` → an `EventTag` member (line 52) |
| `src/hooks/useEvents.test.ts` | 20 | **no** | remove stub **+** fix `"Academic"` → `EventTag.ACADEMIC`, complete the `Club` fixture (8 missing fields), type the `{ filters }` binding. The fixture also carries `event_date`/`event_time`, which F-050/AUDIT-19 proved do not exist on `events` |
| `src/app/api/events/route.test.ts` | 4 | **no — install is irrelevant** | Contract drift: the route has zero occurrences of `cursor`. **Decide, do not fix**: rewrite against the current contract, or delete and file the loss of coverage. STAB-08 does not require reviving it, and reviving it wrongly would freeze a defect as a contract |

**STAB-13 arithmetic if the four revivable suites land:** suites 16 → 20 executing of 21 (or 20 of 20 if suite 5 is deleted); skipped tests 36 → 5 (the 31 in the four suites revive; `get-events.test.ts`'s single `it.skip` and suite 5's 4 remain, or just the 1 if suite 5 is deleted); passing tests 220 → ~251. **Quote both numbers in the completion note.**

### 7. Bundle size, before and after (STAB-16)

Next 16's Turbopack build prints **no** Size / First Load JS table — `audit/baseline/build.txt` line 26 onward is route names only. The machine-readable artifact is `.next/diagnostics/route-bundle-stats.json`, written by `next/dist/build/route-bundle-stats.js`.

```bash
measure () {                       # $1 = "before" | "after"
  local OUT=".planning/phases/02-dependency-and-runtime-stabilization/evidence"
  rm -rf .next
  npm run build > "$OUT/build.$1.txt" 2>&1
  cp .next/diagnostics/route-bundle-stats.json "$OUT/bundle-size.$1.json"

  # portable — matches the macOS `stat -f%z` figure in audit/baseline/versions.txt exactly
  echo -n "next_static_bytes=" ; find .next/static -type f -print0 | xargs -0 cat | wc -c

  node -e '
    const a = Object.values(require(process.argv[1]));
    a.sort((x,y) => y.firstLoadUncompressedJsBytes - x.firstLoadUncompressedJsBytes);
    const sum = a.reduce((s,x) => s + x.firstLoadUncompressedJsBytes, 0);
    console.log("routes=" + a.length, "sum=" + sum,
                "max=" + a[0].route + ":" + a[0].firstLoadUncompressedJsBytes,
                "median=" + a[a.length>>1].firstLoadUncompressedJsBytes);
  ' "$OUT/bundle-size.$1.json"

  # install-tree metrics — this is where the removals actually show up
  npm ls --omit=dev --all --json --package-lock-only \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const seen=new Set();(function w(n){for(const [k,v] of Object.entries(n.dependencies||{})){
          seen.add(k+"@"+v.version);w(v);}})(JSON.parse(s));
        console.log("prod_pkg_count="+seen.size);})'
  du -sk node_modules | awk '{print "node_modules_kb=" $1}'
  npm audit --omit=dev --json --package-lock-only \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>
        console.log("audit_prod="+JSON.stringify(JSON.parse(s).metadata.vulnerabilities)))'
}
```

**Baseline measured on this tree at `next@16.2.1`, 2026-09-14** (the executor must re-derive; these are the reference values):

| Metric | Value |
|---|---|
| Routes in `route-bundle-stats.json` | 44 |
| Max first-load JS | `/docs` — 1,964,063 B |
| Median first-load JS | `/help` — 840,048 B |
| Sum of first-load JS | 39,838,971 B |
| `.next/static` total | 4,490,961 B (identical to `audit/baseline/versions.txt` `next_static_bytes`) |
| `node_modules` | 979,784 KB |
| Production dependencies audited | 680 (`audit/quality/npm-audit.prod.json` `metadata.dependencies`) |
| Production vulnerabilities | 2 critical / 22 high / 13 moderate / 1 low = 38 |

Note `/docs` at 1.96 MB is `redoc`, and it is **reachable and staying** — removing `swagger-ui-react` will not move it. That is Pitfall 9 in one number.

### 8. CycloneDX SBOM (STAB-15)

```bash
npx --yes @cyclonedx/cyclonedx-npm@6.0.1 \
  --omit dev \
  --spec-version 1.6 \
  --output-format JSON \
  --output-file sbom.cyclonedx.json \
  --output-reproducible \
  --validate \
  --mc-type application \
  package.json
```

`--output-reproducible` is not optional for a **committed** SBOM: without it the serial number and timestamps change on every run, so the file shows a diff on every regeneration and stops being a meaningful artifact. `--validate` fails the command if the document does not satisfy the CycloneDX 1.6 schema. Regenerate it in the same commit as any lockfile change, and add a CI freshness check later if wanted:

```bash
npx --yes @cyclonedx/cyclonedx-npm@6.0.1 --omit dev --spec-version 1.6 \
  --output-format JSON --output-reproducible --output-file - package.json \
  | diff -q - sbom.cyclonedx.json
```

### 9. Renovate (STAB-15)

```jsonc
// renovate.json  (repo root — first match in Renovate's search order wins)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":automergePatch",
    ":semanticCommits",
    ":maintainLockFilesWeekly"
  ],
  "timezone": "America/Toronto",
  "schedule": ["before 6am on monday"],
  "prConcurrentLimit": 3,
  "minimumReleaseAge": "3 days",
  "packageRules": [
    {
      "description": "STAB-15 — patch-only auto-merge, and only after CI is green",
      "matchUpdateTypes": ["patch", "pin", "digest"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "description": "Group the Supabase SDK — its packages move in lockstep",
      "matchPackageNames": ["@supabase/supabase-js", "@supabase/ssr"],
      "groupName": "supabase",
      "automerge": false
    },
    {
      "description": "Group the test harness",
      "matchPackageNames": [
        "jest", "ts-jest", "jest-environment-jsdom", "@types/jest",
        "@testing-library/react", "@testing-library/dom", "@testing-library/jest-dom"
      ],
      "groupName": "test harness",
      "automerge": false
    },
    {
      "description": "Group Next + its eslint config; NEVER auto-merge the framework",
      "matchPackageNames": ["next", "eslint-config-next"],
      "groupName": "next",
      "automerge": false
    },
    {
      "description": "PROJECT.md defers React 19 — do not open the PR at all",
      "matchPackageNames": ["react", "react-dom", "@types/react", "@types/react-dom"],
      "matchUpdateTypes": ["major"],
      "enabled": false
    },
    {
      "description": "Majors are never auto-merged; STAB-10 requires an isolated change with a migration note",
      "matchUpdateTypes": ["major"],
      "automerge": false
    }
  ],
  "vulnerabilityAlerts": { "labels": ["security"], "minimumReleaseAge": null }
}
```

> **Auto-merge only means something once CI runs the tests.** Renovate's `:automergePatch` merges when the required status checks pass; today those checks are lint + tsc + build with **no test step** (F-065). Land batch 0 before batch 6, or patch auto-merge is merging untested code.
> `vulnerabilityAlerts.minimumReleaseAge: null` deliberately overrides the global 3-day cooling-off for security fixes.
> Renovate also needs the GitHub App installed on the repo — that is a human step, not a file. Record it in the completion note.

### 10. Clean-room install (STAB-12)

```bash
# In a FRESH clone — not the working tree, so nothing local can mask a missing dep
TMP=$(mktemp -d)
git clone --branch "$BRANCH" --depth 1 "$(git -C . remote get-url origin)" "$TMP/uni-verse"
cd "$TMP/uni-verse"

node -v && npm -v            # must satisfy engines; expect v24.x / 11.x
sha256sum package-lock.json  # must equal the sha in the working tree

rm -rf node_modules .next
npm ci                       2>&1 | tee /tmp/cleanroom-npm-ci.txt
echo "npm ci exit=$?"        | tee -a /tmp/cleanroom-npm-ci.txt

NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key" \
  npm run build              2>&1 | tee -a /tmp/cleanroom-npm-ci.txt
echo "build exit=$?"         | tee -a /tmp/cleanroom-npm-ci.txt

npm test -- --ci             2>&1 | tee -a /tmp/cleanroom-npm-ci.txt
```

Copy `/tmp/cleanroom-npm-ci.txt` into `evidence/cleanroom-npm-ci.txt`. The placeholder env values are the same ones `ci.yml` already uses, so the clean-room run and the CI run are measuring the same thing. `.env.local` is never copied and never created — the hard constraint holds.

---

## Upgrade Batching Order

Each row is exactly one commit. The gate after **every** row is: `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` → smoke pass → `git diff --stat package-lock.json` reviewed.

| # | Batch | Changes | Kind | Requirements | Expected audit delta (prod) |
|---|-------|---------|------|--------------|------------------------------|
| **0** | Toolchain floor | `engines` + `.nvmrc` (24) · `@types/node@^24` · `"test": "jest"` · delete `check:feedback` · delete `vitest.config.ts`, `vitest.setup.ts`, `test-results/.last-run.json` · `.gitignore += test-results/` · CI `node-version-file: .nvmrc` + test step | config + 1 types major | STAB-01, -02, -08(part), -13 | none |
| **1** | Removals | `vercel`, `swagger-ui-react`, `@types/swagger-ui-react`, `@swagger-api/apidom-ns-openapi-3-1`, `yaml`, `chart.js`, `react-chartjs-2`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu` + `src/components/ui/dropdown-menu.tsx`, `baseline-browser-mapping` (direct) · move `tailwindcss-animate` → devDeps | removal | STAB-04, -07(part), -11 | **2 crit → 1 · 22 high → ~9** |
| **2** | `next` | `next` ^16.0.3 → ^16.3.5 · `eslint-config-next` → ^16.3.5. **`react`/`react-dom` untouched** | minor | STAB-05, -10 | **1 crit → 0 · high → ~4** |
| **3** | Proxy | `src/middleware.ts` → `src/proxy.ts` via pinned codemod, behind the § Code Examples 2 test | file convention | STAB-06 | none |
| **4** | Patch/minor remediation | `redoc` → ^2.5.4 · `sanitize-html` → ^2.17.7 · `postcss` → ^8.5.28 · `npm update ws picomatch` · `npx update-browserslist-db@latest`. **Sub-commit 4b:** `@supabase/supabase-js` → ^2.116.0 alone | patch + 2 minors | STAB-07, -09, -11 | **high → 0 (target)** |
| **5** | Test harness | install the 4 test packages · `jest.config.js` `projects` · `jest.setup.ts` · un-skip 4 suites · decide suite 5 | additive | STAB-08, -13 | none |
| **6** | Evidence | clean-room `npm ci` + build · SBOM · `renovate.json` · bundle before/after table · **CI `npm audit --audit-level=high --omit=dev` step** · `STAGE-2-COMPLETION.md` | evidence | STAB-12, -14, -15, -16, -17 | gate must exit 0 |

**Why this order and not another:**
- Batch 0 first, because CI must run the 220 tests before any dependency moves, or batches 1–5 have no automated net. It also lands Node 24 before batch 5, whose `@testing-library/jest-dom` requires Node ≥ 22.
- Batch 1 before batch 2, because removals shrink the tree the `next` upgrade has to resolve against, making the batch-2 lockfile diff small enough to actually read.
- Batch 3 after batch 2, because the proxy convention should be exercised on the version you are shipping, not on a version you are about to replace.
- Batch 4 after batch 2, because `next@16.3.5` pins `postcss 8.5.23` and the root `postcss` devDependency bump should be reconciled against that, not before it.
- Batch 6 last, because the audit gate exits 1 until batches 1–4 have run, and the bundle "after" number is meaningless until every removal and upgrade has landed.

**Majors explicitly NOT in this phase** (STAB-10 — each would need its own change and migration note; none is security-driven): `@supabase/ssr` 0.7 → 0.12.7, `typescript` 5.9 → 7.0, `tailwindcss` 3.4 → 4.3, `eslint` 9 → 10, `lucide-react` 0.344 → 1.46, `date-fns` 3.6 → 4.4, `tailwind-merge` 2.6 → 3.7, `react-easy-crop` 5 → 6, `next-swagger-doc` 0.4 → 0.5, `@types/node` 24 → 26. `react`/`react-dom` 18 → 19 is out of scope by project constraint.

---

## Vulnerability Policy Skeleton (STAB-03)

Write this **before** batch 1 — STAB-03 says "before any scan-driven change" for the same reason `SEVERITY_SLA.md` was written in Wave 1 of Phase 1: so severity is graded against a pre-committed policy rather than argued after the fact. It must be *consistent with* `audit/SEVERITY_SLA.md`, not a second competing policy. Required clauses, from STAB-03 and STAB-17:

| Clause | Content | Inherited from |
|---|---|---|
| Scope | Applies to the **production** dependency tree, defined as `npm audit --omit=dev --package-lock-only`. | STAB-03 |
| Critical | **Zero unexplained Criticals.** A Critical is fixed or the program stops — it may **not** be risk-accepted. | SEVERITY_SLA.md, verbatim |
| High | Fix, **or** a dated, owner-signed exception carrying a *reachability argument*. `owner` is a named human, not a team. `expiry` at most **90 days** after `date`. An expired acceptance reverts to Open automatically. "Low priority" / "unlikely" are not rationales. | SEVERITY_SLA.md exception register |
| Moderate / Low | Tracked in the completion note, not blocking. | STAB-03 |
| Dev-only | Recorded and re-checked; **never blocking** — unless the package also appears in the production tree (the `baseline-browser-mapping` case). | dependency-report.md § 5 |
| Reachability basis | Reachability judgments are inherited from `audit/quality/dependency-report.md` § 2–3 and are re-derived only when a batch changes the module graph. | AUDIT-12 |
| Enforcement | `npm audit --audit-level=high --omit=dev` in CI (batch 6) is the mechanical enforcement; the exception register is the only documented bypass. | STAB-14, -17 |
| No CVSS on app-logic findings | Dependency advisories carry their published severity verbatim as *evidence*; the finding's severity is set by the reachability judgment. | SEVERITY_SLA.md |

**Open items the policy must dispose of by name, because they will still be non-zero at the gate:**

| Item | Status after batch 4 | Suggested disposition |
|---|---|---|
| `picomatch` 2.3.1 → 2.3.2 (build-only ReDoS, via `tailwindcss-animate` → `tailwindcss` → `micromatch`) | Fixed in-range by `npm update picomatch`; the *path* also leaves the prod tree when `tailwindcss-animate` moves to devDeps | Fixed — verify both |
| `ws` 8.18.3 (needs a Realtime channel; `grep -rn "\.channel(\|realtime" src` → 0 matches) | Fixed in-range by `npm update ws` (8.21.3 ≥ patched 8.21.0) | Fixed |
| `sharp` (Image Optimization only; `next.config.js` sets `images.unoptimized: true`) | `next@16.3.5` pins `sharp ^0.35.4`, past the `<=0.35.4-rc.0` ceiling | Fixed. **Add a source comment on `images.unoptimized: true`** — it is one config line away from re-arming an RCE, and nothing in the file says so |
| The 5 `next` cache-poisoning advisories (`GHSA-3g8h-86w9-wvmq`, `-vfv6-92ff-j949`, `-wfc6-r584-vfw7`, `-68g3-v927-f742`, `-4633-3j49-mh5q`) | Resolved by version (all `< 16.3.3`), **but F-025 proved the shared cache does store personalized responses**, so the precondition they need is present in this deployment | Close by version, and **cite F-025 / `cache/cache-matrix.csv` in the closure note**, because REFAC-19 (Phase 6) is what actually removes the precondition |
| `GHSA-p293-qw3h-jr36` Windows RCE, dispositioned on an unverified OS assumption (F-057) | Resolved by version at 16.3.3 | Closed by version — F-057's evidence gap becomes moot. Say so explicitly rather than leaving F-057 Open |
| Dev-only: `handlebars`, `browserslist`, `@babel/core`, `@humanfs/node` | Unchanged | Tracked, not blocking |

---

## Smoke Pass Design

Phase 3 brings the Playwright persona harness (REFAC-06). Until then "smoke pass" needs a concrete, capturable meaning, or STAB-09's "followed by … a smoke pass" degrades into a checkbox. Three tiers, cheapest first.

**Tier 1 — automated, runs in the per-batch gate (no new infrastructure):**

| Check | Command | Covers |
|---|---|---|
| Unit suite | `npm test -- --ci` | 220 → ~251 assertions across 16 → 20 suites |
| Type surface | `npx tsc --noEmit` | zero diagnostics, matching the AUDIT-13 baseline |
| Lint surface | `npm run lint` | ≤ 12 warnings, 0 errors |
| Build surface | `npm run build` | exit 0 **and** the route table still lists 140 rows (`audit/baseline/versions.txt` `build_route_row_count`) |
| Rate limiter | `npx jest --ci src/middlewareRateLimit.test.ts` | STAB-06 half 1 — verified working today |
| Proxy matcher | `npx jest --ci src/proxy.test.ts` | STAB-06 half 2 |

**Tier 2 — scripted HTTP smoke against `npm run dev` or a preview deploy.** Anonymous only, so no credential is needed and nothing is blocked on a human. Ten requests, one line of expected output each:

| # | Request | Expect | Validated workflow it stands for |
|---|---|---|---|
| 1 | `GET /` | 200, HTML contains an event card | Browse events |
| 2 | `GET /api/events?limit=5` | 200, JSON array length ≥ 1 | Event read path |
| 3 | `GET /api/events?search=test&tags=academic` | 200 | Search + filter |
| 4 | `GET /clubs` | 200 | Public club browse |
| 5 | `GET /profile` | **307 → `/?signin=required&next=/profile`** | Protected-route ring — *the proxy rename's blast radius* |
| 6 | `GET /my-events` | 307 → `/?signin=required` | Protected-route ring |
| 7 | `GET /docs` | 200 | Redoc still renders after the `redoc` bump (and confirms `swagger-ui-react`'s removal changed nothing) |
| 8 | `POST /api/events` ×31 from one IP | last response **429** with `Retry-After` | Rate limiter, end-to-end through the real proxy |
| 9 | `GET /api/health` | 200 | Nothing in the dependency tree broke the Supabase client |
| 10 | `GET /_next/static/<any chunk>` | 200, **no** redirect | Matcher exclusion — proves the negative lookahead survived the rename |

Row 5 is the single most important line in this table. `src/middleware.ts` is this app's only page-level auth ring; if the rename silently disables it, row 5 turns 200 and every protected page becomes public. Capture rows 1–10 verbatim into `evidence/smoke.<batch>.txt`.

**Tier 3 — human-verified, once, after batch 3 only.** Sign in with a real McGill Google account against a preview deployment and confirm: sign-in completes; a non-McGill account is still rejected; onboarding redirect still fires for a mid-onboarding cookie; save/unsave and RSVP still work. This is the only part that needs a human and it needs them exactly once, on the one change that touches the request path. Everything else is Tier 1 + Tier 2.

**The ban check is deliberately *not* in Tier 1 or 2.** Exercising it requires a banned user's session, which needs the Phase 3 seed. For STAB-06 the honest evidence is: (a) a `git diff -M` of `src/middleware.ts` → `src/proxy.ts` showing the ban block is byte-identical apart from the function name, and (b) Tier 3's session test confirming a *non*-banned user is not redirected to `/banned`. Record that limitation in `evidence/proxy-migration-note.md` rather than claiming coverage the phase does not have — Phase 7's CERT-05 persona matrix is where the banned-user assertion actually lands.

---

## Clean-Room Protocol (STAB-12)

1. Run it in a **fresh clone**, not the working tree. A local `node_modules` can mask a dependency that was removed from the manifest but is still resolvable on disk.
2. Assert `node -v` / `npm -v` satisfy `engines` before installing — the point of the exercise is to prove the pinned toolchain builds it.
3. `npm ci`, never `npm install`. `npm ci` fails loudly when the manifest and lockfile disagree, which is the reproducibility property being tested.
4. Compare `sha256sum package-lock.json` against the working tree (`audit/baseline/lock.sha256` is the Phase 1 reference format).
5. Build with the same placeholder env vars CI uses, so the clean-room and CI runs are comparable.
6. Capture stdout, stderr and **the exit code of every step** — `audit/baseline/build.txt` is the format precedent.
7. Run it twice: once after batch 4 (the "does the remediated tree still install" check) and once in batch 6 as the STAB-12 evidence.

---

## Exit Gate Evidence Checklist (STAB-17)

`evidence/STAGE-2-COMPLETION.md` must be answerable from artifacts alone, without re-running anything:

- [ ] **No unexplained Critical production vulnerabilities** — `evidence/audit.after.json` `metadata.vulnerabilities.critical == 0`, with the before/after pair committed.
- [ ] **No reachable High without a dated, owner-signed exception** — the exception register from `VULNERABILITY-POLICY.md`, one row per remaining High, each with a named human, an ISO date, an expiry ≤ 90 days out, and a reachability argument.
- [ ] **Reproducible install** — `evidence/cleanroom-npm-ci.txt` showing `npm ci` exit 0 and `npm run build` exit 0 from a fresh clone on the pinned Node.
- [ ] **Checks green at or better than AUDIT-13** — a table quoting: passing tests (baseline 220), skipped tests (baseline 36), executing suites (baseline 16 of 21), `tsc` diagnostics (baseline 0), eslint warnings/errors (baseline 12/0), build exit (baseline 0). **Both the pass count and the skip count**, per the Phase 1 warning that "tests pass" is satisfied today by a suite nobody runs.
- [ ] **Reviewed lockfile** — per batch: the `git diff --stat package-lock.json` line count and a one-line statement of what moved. Plus an explicit statement that `npm audit fix --force` was never run and the lockfile was never regenerated wholesale.
- [ ] **CycloneDX SBOM** — `sbom.cyclonedx.json` committed, `--validate` clean, generated from the final lockfile.
- [ ] **Renovate/Dependabot configured** — `renovate.json` committed **and** a note recording whether the GitHub App is actually installed (a config file with no bot behind it configures nothing).
- [ ] **Bundle size before and after** — the two-column table from § Code Examples 7, with the honest note that batch-1 removals move install-tree metrics and not route bundles.
- [ ] **STAB-02 documented** — the four-scope probe output and the emitter identification.
- [ ] **STAB-04 decision recorded** — remove vs devDependency, with the reasoning.
- [ ] **STAB-06 before/after** — the two Jest captures, the `git diff -M` rename, the Tier 2 smoke capture, the Tier 3 human confirmation, and the stated ban-check coverage limitation.
- [ ] **Finding-register update** — `closes_in_phase` for F-051, F-052, F-053, F-056, F-057 currently reads `03` or `null`; the ROADMAP puts all five in Phase 2. See § Open Questions 1.

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| `middleware.ts` file convention | `proxy.ts` file convention; single function exported as default or named `proxy` | Next **16.0.0** (2025-10-22) | STAB-06. Coexistence is a hard build error, not a warning |
| Middleware runs on the Edge runtime by default | **Proxy defaults to the Node.js runtime**; the `runtime` segment config is forbidden and throws | Next **16.0.0** | The runtime already changed when this project moved to Next 16 — the *rename* changes nothing further. Do not attribute runtime behaviour to the rename |
| `next build` prints a Size / First Load JS table | Turbopack build prints route names only; sizes go to `.next/diagnostics/route-bundle-stats.json` | Next 16 (Turbopack default) | STAB-16 must read the JSON; there is no stdout table to parse |
| `skipMiddlewareUrlNormalize`, `middlewarePrefetch`, `middlewareClientMaxBodySize`, `externalMiddlewareRewritesResolve` | `skipProxyUrlNormalize`, `proxyPrefetch`, `proxyClientMaxBodySize`, `externalProxyRewritesResolve` | Next 16.0.0 | No-ops here — `next.config.js` declares none of them |
| `NextMiddleware`, `MiddlewareConfig` types | `NextProxy`, `ProxyConfig` | Next 16.0.0 | No-op here — the file imports only `NextResponse` and `type NextRequest` |
| jsdom bundled inside `jest` | `jest-environment-jsdom` is a separate install | Jest 28 | STAB-08 |
| `@testing-library/dom` a dependency of RTL | A required peer of RTL | RTL 13 | Must be installed explicitly |
| Node 20 available on Vercel | Node 20 **disabled 2026-10-01**; 24.x is the default | Vercel changelog | STAB-01 has a 17-day deadline |
| `next@16.2.11` closes the current advisory set (the July-2026 batch, per STAB-01's wording) | **`16.3.3` is the minimum patched version**; two criticals were disclosed on 2026-09-08 | Next.js August 2026 security release, 2026-08-25 | **STAB-05's stated target is stale.** Ship 16.3.5 |

**Deprecated / stale in this repository:**
- `vitest.config.ts` + `vitest.setup.ts` — reference three packages that are in neither `package.json` nor `package-lock.json` nor `node_modules`. `tsconfig.json` already excludes `vitest.config.ts` to keep `tsc` green, which is itself evidence the orphan status was worked around rather than fixed.
- `test-results/.last-run.json` — tracked, asserts `{"status":"failed"}`, from a Playwright install that does not exist.
- `"check:feedback": "node scripts/check-feedback-loop.mjs"` — the file is absent; `scripts/` holds exactly three `.ts` files.
- `.claude/CLAUDE.md` lists **Vitest** as the test framework and never mentions Jest; `README.md` says **Next.js 14** and "State Management: React Hooks"; `CLAUDE.md` documents **6** protected routes where the source has 8 (F-063). Correcting these is Stage 2 work per `quality/dead-code.md` § 4 and should ride along with the batch that makes each claim false.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The Vercel production project's **Node.js Version** project setting is not currently pinned in a way that conflicts with `engines`. Not observed — no Vercel dashboard read was performed this session. | Runtime State Inventory | Low. Vercel documents `engines` as the override, so the repo wins either way; but a stale dashboard value is confusing state and should be recorded |
| A2 | Vercel installs `devDependencies` during the build, so moving `tailwindcss-animate` there is safe. Inferred from `tailwindcss`, `postcss` and `autoprefixer` already being devDeps in a working deployment — not read from Vercel docs this session. | Standard Stack → Packages to MOVE | Medium. If wrong, the production build loses Tailwind's animation utilities — caught immediately by batch 1's `npm run build` gate |
| A3 | `next@16.3.5` introduces no behavioural change affecting this app beyond the advisory fixes. Only advisory data and the dependency manifest were read; the 16.2.x→16.3.x changelogs were not. | Upgrade Batching Order | Medium. 16.3.0 is a minor within the declared range; the batch-2 gate (build + 220 tests + Tier 2 smoke) is what catches it |
| A4 | The 5 `next` cache-poisoning advisories are fully closed by 16.3.3+. The dependency report deliberately held them open pending the cache matrix; F-025 then proved the precondition is present, so "closed by version" is a judgment about the advisory, not about F-025. | Vulnerability Policy Skeleton | Medium. Under-stating it would let the completion note imply the caching exposure is fixed. It is not — REFAC-19 (Phase 6) fixes it. Cite F-025 explicitly |
| A5 | The four revivable suites produce ~251 passing tests. Arithmetic from the per-suite skip counts (2+5+4+20 = 31), not an executed run. | Code Examples 6 | Low. STAB-13 requires the *measured* numbers; this is a sizing estimate only |
| A6 | `@supabase/supabase-js` 2.81.1 → 2.116.0 is behaviour-preserving across 35 minors. Semver-minor by declaration; no changelog was read. | Upgrade Batching Order batch 4b | **Highest residual risk in the phase.** It touches every data call. This is why it is its own sub-commit with its own gate. If the gate is ambiguous, defer it to Phase 3 — it closes no advisory of its own |
| A7 | Removing `@radix-ui/react-dropdown-menu` together with `src/components/ui/dropdown-menu.tsx` breaks nothing. From `knip` + `dependency-cruiser` agreeing on `dependents: []`, cross-checked by grep — strong, but it is a source deletion in a dependency batch. | Standard Stack → Packages to REMOVE | Low. The `tsc` + build gate catches any surviving importer |
| A8 | No `.npmrc` exists anywhere relevant to CI or Vercel. Probed locally and in the repo; the GitHub Actions runner's and Vercel's build-image npm configs were not inspected. | Pitfall 7 | Low. STAB-02 is documentation either way, but the CI log is the place to confirm the warning is absent there too |

---

## Open Questions

1. **F-051, F-052, F-053, F-056 and F-057 carry `closes_in_phase: "03"` or `null` in `findings.json`, but the ROADMAP assigns their remediation (STAB-04/05/07) to Phase 2.**
   - What we know: `findings.json` records `03` for F-051/F-052/F-053 and `null` for F-056/F-057, while F-063/F-064/F-065/F-066 correctly record `02`. Phase 2's success criteria name the `vercel` removal, the `next` patch and the Swagger/Redoc disposition explicitly.
   - What is unclear: whether `03` was a deliberate deferral or a transcription slip during the Phase 1 register generation.
   - Recommendation: treat the ROADMAP as authoritative (it is the phase contract), fix `closes_in_phase` to `02` for all five as part of batch 6, and regenerate `FOUNDATION_AUDIT.md` with `gen-foundation-audit.mjs`. **Note the register is generated** — hand-editing the Markdown will fail `--check`.

2. **Does `src/app/api/events/route.test.ts` (4 skipped tests) get rewritten, deleted, or left skipped?**
   - What we know: the route has zero occurrences of `cursor`; the tests assert a cursor-pagination contract that no longer exists. No install revives it. Phase 1 explicitly declined to decide.
   - What is unclear: whether the route *regressed* (pagination was lost) or the tests are simply obsolete.
   - Recommendation: do not answer it here. STAB-08 requires Jest to be the single runner and the *installable* skips to be cleared; it does not require this suite. Leave it skipped with its self-documenting title, record the decision in the completion note, and hand the contract question to Phase 4 (REFAC-10, the event read path slice), which owns that route. Reviving it against the current behaviour would freeze a possible defect as the contract — exactly the T-01-11-04 trap Phase 1 named.

3. **Is the `tsconfig.json` test-file exclusion removed in this phase?**
   - What we know: 86 errors across 10 files today, 38 of them cross-file scope collisions and ~14 fixed by loading jest-dom types. F-066's validation criterion asks for zero diagnostics.
   - What is unclear: whether STAB-08 owns it. The requirement text does not mention `tsconfig`.
   - Recommendation: **out of scope for Phase 2.** State it explicitly in the completion note so F-066 is recorded as partially closed (skips cleared, type-check hole remaining) rather than silently claimed. The cleanest home is Phase 3, alongside REFAC-04's generated types and the type-drift CI step.

4. **Should `src/middlewareRateLimit.ts` be renamed to `src/proxyRateLimit.ts`?**
   - What we know: the relative import survives the rename unchanged; nothing forces it. REFAC-18 moves rate limiting to a distributed store in Phase 5 anyway.
   - Recommendation: **no.** Renaming it adds diff noise to the one commit that must be readable line-by-line, and the module is being rewritten in Phase 5. Leave it.

5. **Does the CI runner or the Vercel build image emit the `devdir` warning?**
   - What we know: it does not reproduce locally; no `.npmrc` exists in the repo or in any local npm scope.
   - Recommendation: grep the batch-0 CI run's `npm ci` log for `Unknown .* config` and record the result (present or absent) in `evidence/devdir-investigation.md`. That closes STAB-02 for both environments at zero cost.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | everything | ✓ | 24.16.0 (via fnm) | — |
| npm | everything | ✓ | 11.13.0 | — |
| npm registry (network) | `npm view`, `npm ci`, `npx` | ✓ | reachable — `npm view next version` → 16.3.5 | — |
| `git` | rename detection, diffs | ✓ | 2.50.1 (Apple Git-155) | — |
| `gh` CLI (authenticated) | GHSA advisory lookups | ✓ | `/advisories` queries returned data | GitHub Advisory web UI |
| `npx @next/codemod@16.3.5` | STAB-06 | ✓ | tarball fetched and inspected | Manual rename per § Code Examples 3 diff — but see Don't-Hand-Roll |
| `npx @cyclonedx/cyclonedx-npm@6.0.1` | STAB-15 | ✓ | `--help` executed | `@cyclonedx/cdxgen` |
| `npx update-browserslist-db@1.3.3` | batch 4 | ✓ | 1.3.3 on registry | Skip; the warning is cosmetic |
| Supabase project credentials | Tier 2/3 smoke against real data | **✗ not needed** | — | CI's placeholder env vars build and test fine; Tier 2 runs anonymous-only |
| Vercel CLI | — | ✗ | — | **Not needed** — deployment is the git integration; this is the package being removed |
| Vercel dashboard access | A1 (Node.js Version setting) | ? unknown | — | `engines.node` overrides it, so this is a recording task, not a blocker |
| Playwright | — | ✗ | — | **Not needed in Phase 2** — arrives in Phase 3 (REFAC-06). Tier 2 curl smoke is the interim |
| Docker | — | ✗ (`docker_daemon_reachable=false`) | — | Not needed; the clean room is a fresh `git clone`, not a container |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Vercel dashboard read (A1) — record as unknown if unavailable; it does not block any batch.

---

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | Jest **30.2.0** + ts-jest **29.4.6** (decision recorded, not re-litigated — `audit/baseline/test-runner-decision.md`: 14 of 21 files call `jest.*`, 0 call `vi.*`) |
| Config file | `jest.config.js` — `preset: 'ts-jest'`, `testEnvironment: 'node'`, `^@/(.*)$ → <rootDir>/src/$1`, ignores `/node_modules/`, `/.claude/`, `/supabase/functions/tests/` |
| Quick run command | `npx jest --ci <path>` (single suite; full suite is 2.65 s wall, so "quick" and "full" are nearly the same cost) |
| Full suite command | `npm test -- --ci` — **the `test` script does not exist yet; Wave 0 creates it** |
| Project test_command (`.planning/config.json`) | `npx jest --ci` |
| AUDIT-13 baseline (the STAB-13 target) | 220 passed / 36 skipped / 256 total · 16 passed + 5 skipped of 21 suites · `tsc --noEmit` 0 diagnostics · `eslint .` 12 warnings 0 errors · `next build` exit 0 |

### Phase requirements → test map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| STAB-01 | `engines`, `.nvmrc` and CI agree on Node 24 | smoke | `node -e "const e=require('./package.json').engines; const n=require('fs').readFileSync('.nvmrc','utf8').trim(); if(!e?.node?.startsWith('24')||n!=='24') process.exit(1)"` and `grep -q "node-version-file: '.nvmrc'" .github/workflows/ci.yml` | ❌ Wave 0 |
| STAB-02 | The `devdir` warning is absent or its source documented | manual-only | `npm config get devdir` → `undefined`; `npm install --dry-run 2>&1 \| grep -c 'Unknown .* config'` → `0`. Machine state, not repo state — cannot be asserted in CI | ❌ Wave 0 (evidence doc) |
| STAB-03 | A written vulnerability policy exists before batch 1 | smoke | `test -f .planning/phases/02-*/evidence/VULNERABILITY-POLICY.md` **and** `git log --diff-filter=A --format=%H -- <policy>` predates the batch-1 commit | ❌ Wave 0 |
| STAB-04 | `vercel` is not in production deps and roots no advisory | integration | `node -e "const p=require('./package.json'); if(p.dependencies.vercel) process.exit(1)"` and `npm audit --omit=dev --json --package-lock-only \| grep -c '"vercel"'` → `0` | ❌ Wave 0 |
| STAB-05 | `next` ≥ 16.3.3 with `react`/`react-dom` unchanged | integration | `node -e "const s=require('semver'); s.gte(require('next/package.json').version,'16.3.3')\|\|process.exit(1)"` plus `git diff <base>..HEAD -- package.json \| grep -E '^[+-].*\"react(-dom)?\"'` → empty | ❌ Wave 0 |
| STAB-06 | Matcher coverage and rate-limit budgets are identical before and after | unit | `npx jest --ci src/proxy.test.ts src/middlewareRateLimit.test.ts` | ❌ Wave 0 — **both files** |
| STAB-06 | Only one of `middleware.*` / `proxy.*` exists and the deprecation warning is gone | smoke | `test ! -f src/middleware.ts && test -f src/proxy.ts` and `npm run build 2>&1 \| grep -c 'middleware.*deprecated'` → `0` | ❌ Wave 0 |
| STAB-07 | `swagger-ui-react` gone; `redoc` ≥ 2.5.4; `/docs` still renders | integration | `npm ls swagger-ui-react --omit=dev` → not found; `npm view` / `npm ls redoc`; smoke row 7 | ❌ Wave 0 |
| STAB-08 | Jest is the only runner and `npm test` exists | smoke | `test ! -f vitest.config.ts && test ! -f vitest.setup.ts && npm run \| grep -q '^  test$'` and `npx jest --ci --listTests \| wc -l` | ❌ Wave 0 |
| STAB-08 | The 4 installable suites execute | unit | `npx jest --ci --json \| node -e '…assert numPendingTestSuites <= 1'` | ❌ Wave 0 |
| STAB-09 | Every batch commit is followed by a green gate | smoke | per-batch: `npm run lint && npx tsc --noEmit && npm test -- --ci && npm run build` | uses existing |
| STAB-10 | No unplanned major landed | integration | diff `package.json` dependency majors against the batch-0 snapshot; assert the only change is `@types/node` | ❌ Wave 0 |
| STAB-11 | Lockfile reconciled, never regenerated | smoke | per batch, `git diff --numstat <prev>..HEAD -- package-lock.json` recorded; `git log --all --format=%B \| grep -ci 'audit fix'` → `0` | ❌ Wave 0 |
| STAB-12 | Clean-room `npm ci` + build succeed | e2e | § Code Examples 10 script, exit 0 at every step | ❌ Wave 0 |
| STAB-13 | Checks at or better than the AUDIT-13 baseline | integration | `npx jest --ci --json` compared against `passed >= 220`, `skipped <= 36`, `failed == 0`; `npx tsc --noEmit` exit 0; `npm run lint` errors 0 | ❌ Wave 0 (comparator script) |
| STAB-14 | CI runs the production audit gate on every PR | smoke | `grep -q 'npm audit --audit-level=high --omit=dev' .github/workflows/ci.yml` and a green CI run URL | ❌ Wave 0 |
| STAB-15 | SBOM is committed and current; Renovate configured | integration | SBOM freshness diff (§ Code Examples 8) and `npx --yes renovate-config-validator renovate.json` | ❌ Wave 0 |
| STAB-16 | Bundle size recorded before and after | smoke | both `evidence/bundle-size.{before,after}.json` exist and the delta table cites `firstLoadUncompressedJsBytes` per route | ❌ Wave 0 |
| STAB-17 | The completion note evidences every gate clause | manual-only | checklist review against § Exit Gate Evidence Checklist — a human reads it; it is the gate | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** `npx jest --ci <touched suite>` — sub-second for a single suite.
- **Per batch commit (the STAB-09 gate, non-negotiable):** `npm run lint && npx tsc --noEmit && npm test -- --ci && npm run build`, then the Tier 2 smoke, then the lockfile diff review. Full suite wall time is 2.65 s; there is no cost argument for sampling less.
- **Per wave merge:** the batch gate plus `npm audit --omit=dev --json --package-lock-only` captured to `evidence/audit.b<N>.after.json`.
- **Phase gate:** clean-room `npm ci` + build + full suite green from a fresh clone, plus the § Exit Gate Evidence Checklist complete, before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `package.json` → add `"test": "jest"` and `"test:ci": "jest --ci"`; **delete `"check:feedback"`** — covers STAB-08, F-064, and unblocks every other row in the map (nothing can run `npm test` today; it errors `Missing script: "test"`).
- [ ] `src/middlewareRateLimit.test.ts` — covers STAB-06 (rate-limit half). Shape verified live in this tree; the 429 assertion passes on today's code.
- [ ] `src/middleware.test.ts` → renamed to `src/proxy.test.ts` in the batch-3 commit — covers STAB-06 (matcher half). Must use `unstable_doesMiddlewareMatch`, not the documented `unstable_doesProxyMatch`.
- [ ] `jest.setup.ts` — one line, `import "@testing-library/jest-dom";`. Covers STAB-08's jsdom project.
- [ ] `jest.config.js` → `projects: [node, jsdom]` per § Code Examples 6. **`src/hooks/useEvents.test.ts` is a `.ts` file that must route to jsdom** — the rule is not "by extension."
- [ ] `.planning/phases/02-dependency-and-runtime-stabilization/evidence/` — the directory itself, plus `VULNERABILITY-POLICY.md` written **before** batch 1 (STAB-03 is explicit about the ordering).
- [ ] A baseline comparator — a small script asserting `jest --json` output against 220 passed / ≤ 36 skipped / 0 failed, so STAB-13 is mechanical rather than eyeballed. Phase 1's `.planning/audit/tools/validate.mjs` is the precedent and the style to copy: zero-dependency, `--check <name>`, exit non-zero on failure.
- [ ] `scripts/smoke.sh` (or equivalent) implementing the § Smoke Pass Design Tier 2 table, so "a smoke pass" is a command with captured output rather than a claim.
- [ ] Framework install: **none** — Jest 30.2.0 and ts-jest 29.4.6 are already installed and green.

---

## Security Domain

`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | **yes, indirectly** | STAB-06 moves the file that *is* this app's only page-level auth ring. The control is the before/after matcher + protected-route assertion, not a new mechanism. Behaviour fixes (`getUser()` vs `getSession()`, fail-closed ban check) are REFAC-11, Phase 5 — **do not fix them here**; changing auth behaviour inside a dependency phase makes "same as before" unprovable |
| V3 Session Management | no | Supabase cookie handling is untouched. The `setAll`/cookie-cleanup block moves byte-identical with the file |
| V4 Access Control | **yes, indirectly** | Same as V2: the 8-entry `PROTECTED_ROUTES` array and the onboarding guard move with the rename. Smoke rows 5, 6 and 10 are the assertion |
| V5 Input Validation | no | REFAC-15 (zod contracts) is Phase 6 |
| V6 Cryptography | no | Nothing in this phase touches crypto |
| **V14 Configuration** | **yes — this is the phase's ASVS home** | Dependency hygiene, pinned runtime, reproducible build, SBOM, and a written vulnerability policy with an exception register are all V14 controls. `@cyclonedx/cyclonedx-npm` + `npm ci` + `engines` + `renovate.json` are the implementations |

### Known threat patterns for this change set

| Pattern | STRIDE | Standard mitigation | Status in this phase |
|---|---|---|---|
| Malicious or compromised package enters the tree during remediation | Tampering | `npm ci` from a reviewed lockfile; never `npm install <pkg>` without reading the resulting diff; `minimumReleaseAge` in Renovate | Batch protocol § Pattern 1 |
| Typosquat / slopsquat on a newly added package | Spoofing | Package legitimacy gate | § Package Legitimacy Audit — 0 SLOP, 0 genuine SUS |
| `npm audit fix --force` silently installs breaking majors | Tampering | Forbidden by project constraint; asserted by `git log \| grep -ci 'audit fix'` → 0 | STAB-11 test row |
| **Auth ring silently disabled by the proxy rename** | Elevation of Privilege | Matcher characterization test + smoke rows 5/6/10 run before and after | **The single highest-risk item in the phase** — § Smoke Pass Design |
| Unauthenticated RCE via AVIF image optimization (`GHSA-2xp9-vwfh-vxw4`) | Elevation of Privilege | `next ≥ 16.3.3` (the patch disables AVIF optimization upstream); *additionally* `next.config.js` sets `images.unoptimized: true`, which already disables the endpoint | Closed by batch 2. **Add a source comment on that config line** — it is load-bearing for security and nothing says so |
| Unauthenticated RCE on Windows hosts (`CVE-2026-75604`) | Elevation of Privilege | `next ≥ 16.3.3` | Closed by batch 2; also retires F-057's unverified-assumption evidence gap |
| RSC cache poisoning / cache confusion (5 advisories) | Tampering / Information Disclosure | `next ≥ 16.3.3` closes them by version | Closed by version — **but F-025 proved the shared-cache precondition is live on this deployment.** Cite F-025 in the closure; REFAC-19 (Phase 6) is the real fix |
| Supply-chain drift between manifest, lockfile and deployed tree | Tampering | `npm ci` only, clean-room verification, committed SBOM generated from the final lockfile | STAB-12, STAB-15 |
| Dev-tool advisory promoted to production by a transitive path | Tampering | Policy clause: a dev-only finding becomes blocking if the package also appears in `npm audit --omit=dev` (the `baseline-browser-mapping` case) | § Vulnerability Policy Skeleton |
| Vulnerability gate present in config but never green | Repudiation | STAB-14 requires a *green* CI run URL in the completion note, not just the YAML line | § Exit Gate Evidence Checklist |

**Explicitly deferred, and the deferral is the safe choice:** F-003 (env-conditional middleware fails open), F-054 (`/docs` anonymous), F-055 (CSP `unsafe-inline`/`unsafe-eval`), F-025 (shared cache of personalized responses), F-040 (absent production env vars). Every one is a real finding; every one is a *behaviour* change; all are assigned to Phase 5 or 6. Fixing any of them inside a dependency phase would break the one property Phase 2 exists to preserve — that the before/after smoke pass means something.

---

## Sources

### Primary (HIGH confidence)

- **This working tree**, 2026-09-14 — `package.json`, `package-lock.json`, `jest.config.js`, `tsconfig.json`, `eslint.config.mjs`, `next.config.js`, `vercel.json`, `.github/workflows/ci.yml`, `src/middleware.ts`, `src/middlewareRateLimit.ts`, the 5 skipped suites, `.next/diagnostics/route-bundle-stats.json`, `node_modules/next/dist/lib/constants.js`, `node_modules/next/dist/build/index.js:644,650`, `node_modules/next/experimental/testing/server`
- **Live command execution in this tree** — `npx jest --ci` on a probe suite (rate limiter 429 confirmed, `unstable_doesProxyMatch` confirmed absent), `npx tsc -p <probe>` with test files un-excluded (86 errors), `npm audit --audit-level=high --omit=dev` (exit 1), `npm config get devdir` (undefined), synthetic `.npmrc` reproduction of the npm warning, `find .next/static … | wc -c` (4,490,961)
- **npm registry** via `npm view` — `next` 16.3.5 + `time` + `peerDependencies` + `dependencies`, `@next/codemod` 16.3.5, `eslint-config-next` 16.3.5, `jest-environment-jsdom` 30.5.1, `@testing-library/{react,dom,jest-dom}`, `@cyclonedx/cyclonedx-npm` 6.0.1, `postcss` 8.5.28, `redoc` 2.5.4, `sanitize-html` 2.17.7, `@supabase/supabase-js` 2.116.0, `picomatch` 2.3.2, `micromatch` 4.0.8, `@types/node` 24.13.4
- **Tarball inspection** — `@next/codemod@16.3.5` → `package/transforms/middleware-to-proxy.js` (full source read); `next@16.3.5` → `package/dist/experimental/testing/server/*.d.ts`
- **GitHub Advisory Database** via `gh api /advisories` — `GHSA-2xp9-vwfh-vxw4`, `GHSA-p293-qw3h-jr36` (CVE-2026-75604), `GHSA-6gpp-xcg3-4w24`, `GHSA-26hh-7cqf-hhc6`, `GHSA-492v-c6pp-mqqv`, plus the full `affects=next` and `affects=picomatch` / `affects=ws` listings
- **Phase 1 artifacts** — `.planning/audit/FOUNDATION_AUDIT.md` (F-003, F-025, F-040, F-050…F-057, F-063…F-066), `findings.json`, `SEVERITY_SLA.md`, `quality/dependency-report.md`, `quality/dead-code.md`, `quality/npm-audit.prod.json`, `baseline/{versions,jest,lint,build}.txt`, `baseline/test-runner-decision.md`, `phases/01-*/01-VERIFICATION.md`
- **`nextjs.org/docs/messages/middleware-to-proxy`** — codemod command and the rename contract
- **`nextjs.org/docs/app/api-reference/file-conventions/proxy`** (page version 16.3.5, lastUpdated 2026-09-07) — export contract, matcher semantics, Node.js runtime default, `runtime` prohibition, version history, testing utilities *(note: this page's `unstable_doesProxyMatch` is contradicted by the shipped code — see Pitfall 4)*
- **`nextjs.org/blog/august-2026-security-release`** (2026-08-25) — the two criticals and the 16.3.3 / 15.5.24 patch targets
- **`vercel.com/docs/functions/runtimes/node-js/node-js-versions`** — 24.x default, `engines.node` override semantics
- **`vercel.com/changelog/node-js-20-is-being-deprecated`** — Node 20 disabled 2026-10-01
- **`cyclonedx.org/tool-center`** — confirms `cyclonedx-npm` as the official npm generator

### Secondary (MEDIUM confidence)

- `docs.renovatebot.com/presets-default/` and `/configuration-options/` — preset names, `packageRules` keys, config file search order *(vendor docs, fetched this session; the produced `renovate.json` should still be run through `renovate-config-validator`)*
- WebSearch summary of the Next.js July 2026 security release (9 issues, 16.2.11 / 15.5.21) — corroborated by the GHSA records dated 2026-07-22, which is what makes it HIGH for the version numbers and MEDIUM for the narrative
- `.planning/research/PITFALLS.md` and `FEATURES.md` (2026-09-13) — project-level research; independently consistent with everything measured here

### Tertiary (LOW confidence)

- Third-party blog coverage of the August 2026 Next.js release surfaced by WebSearch (netlify.com changelog, aicybr.com, teramont.net) — **not relied on**; every figure taken from them was re-confirmed against `nextjs.org` and the GHSA records before it was written down

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack (versions, peers, engines) | **HIGH** | Every version came from `npm view` against the live registry on 2026-09-14; peer and engine constraints were read from the registry metadata, not inferred |
| Next.js advisory targets | **HIGH** | Patched versions read from the GHSA records themselves, cross-checked against the vendor security blog and against `npm audit`'s own vulnerable range (`… - 16.3.2`) on this tree |
| Proxy migration contract | **HIGH** | Vendor docs *plus* the codemod source read line-by-line from the pinned tarball *plus* the coexistence error read from the installed `next/dist/build/index.js` |
| `unstable_doesMiddlewareMatch` naming | **HIGH** | Failed live under Jest with the documented name, then confirmed by enumerating exports in 16.2.1 and extracting the `.d.ts` from the 16.3.5 tarball. Two independent confirmations against a contradicting vendor doc |
| Jest consolidation scope | **HIGH** | Per-suite skip reasons from Phase 1's captured evidence; the 86-error `tsc` probe and the passing `rsvp.test.ts` run were both executed this session |
| `devdir` (STAB-02) | **HIGH** for the local finding, **MEDIUM** for CI/Vercel | Four-scope probe run locally and the emitter reproduced synthetically; the GitHub runner's and Vercel build image's npm configs were not inspected (A8, Open Question 5) |
| Bundle-size method | **HIGH** | `route-bundle-stats.json` read directly and its emitter located in `next/dist/build/route-bundle-stats.js`; the portable `.next/static` total reproduces Phase 1's macOS figure byte-for-byte |
| Node pinning target | **HIGH** | Vercel's own docs and changelog; `engines` override semantics quoted from the docs |
| Upgrade batching order | **MEDIUM** | The dispositions are HIGH (Phase 1 reachability + verified versions); the *ordering* is a judgment about risk sequencing, and A3/A6 are its open assumptions |
| Smoke-pass design | **MEDIUM** | Tier 1 is verified executable; Tiers 2 and 3 are designed here and not yet run. Tier 3 requires a human with a McGill account |

**Research date:** 2026-09-14
**Valid until:** **2026-09-28** (14 days). Short deliberately: Next.js is on a monthly security-release cadence and shipped two criticals five weeks ago; `next@16.3.5` is three days old. **Re-run `npm view next version` and `gh api "/advisories?ecosystem=npm&affects=next&sort=published&direction=desc"` immediately before batch 2** — if a newer patched 16.3.x exists, that is the target, not 16.3.5. The Vercel Node 20 shutdown on **2026-10-01** is a hard external deadline inside this window.
