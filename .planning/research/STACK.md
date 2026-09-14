# Stack Research

**Domain:** Audit / stabilization / refactor / certification tooling for an existing Next.js 16 App Router + Supabase + Vercel application
**Researched:** 2026-09-13
**Confidence:** HIGH for everything verified against the live repo and the npm registry; LOW-to-MEDIUM for vendor-doc-derived setup detail (flagged per item)

> **Read this first.** Two premises handed to this research were wrong, and both change the roadmap. They are corrected in [Premise Corrections](#premise-corrections) below. Everything else in this document assumes those corrections.

---

## Premise Corrections

| Premise given | Reality (verified on this machine, 2026-09-13) | Impact |
|---|---|---|
| "Jest 30 / ts-jest 29 mismatch" | **Not a mismatch.** `ts-jest@29.4.12` declares `peerDependencies.jest: "^29.0.0 \|\| ^30.0.0"`. There is no ts-jest 30 and never has been — 29.4.x *is* the Jest 30 line. `npm view ts-jest versions` tops out at 29.4.12. | Nothing to fix. Delete this from the Stage 2 backlog. |
| "both `jest.config.js` and `vitest.config.ts` present" → implied a live two-runner split | **Vitest is not installed and is not in `package-lock.json`** (`grep -c '"node_modules/vitest"' package-lock.json` → `0`). `vitest.config.ts` and `vitest.setup.ts` are orphaned files referencing a dependency that does not exist. No test file imports `vitest` (`grep -rl 'from "vitest"' src` → 0 files). | The runner decision is already made by fact, not by preference. See below. |

**The actual test-suite state** (from `npx jest` in the repo root):

```
Test Suites: 5 skipped, 16 passed, 16 of 21 total
Tests:       36 skipped, 220 passed, 256 total
Time:        2.176 s
```

Jest already works and 220 tests already pass. Nobody knew, because there is no `test` script in `package.json` and no test step in CI. The 5 skipped suites are skipped for two explicit, documented reasons found in the source:

- 4 suites: `describe.skip("... (@testing-library/react not installed)")` — `ErrorBoundary.test.tsx`, `EventFilters.test.tsx`, `FilterSidebar.test.tsx`, `useEvents.test.ts`
- 1 suite: `describe.skip("GET /api/events cursor pagination — tests written for cursor-based route that no longer exists")` — a dead test for a deleted route

So `.planning/codebase/TESTING.md` (dated 2026-03-05) is materially wrong: it describes a Vitest suite with `vi.mock` patterns that no longer exists. Someone migrated the suite to Jest globals and left the Vitest configs behind. **Treat TESTING.md as stale and rewrite it in Stage 1.**

**Runner decision: keep Jest. Delete Vitest.** This is not a close call — Jest is installed, configured, and green; Vitest is a config file pointing at nothing. Stage 1 does not need to "evaluate which runner to keep"; it needs to record that the evaluation is moot and move on.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Stage | Confidence |
|---|---|---|---|---|---|
| **Jest** | `30.5.1` (have `30.2.0`) | Unit + API-handler test runner | Already installed, already green at 220 tests, `ts-jest` preset already wired with the `@/` path alias. Switching to Vitest would mean re-validating 256 tests to gain nothing. Keep. | 2 | HIGH — ran it |
| **ts-jest** | `29.4.12` (have `29.4.6`) | TS transform for Jest | Correct and current for Jest 30. Bump to 29.4.12 to clear the **critical** `handlebars` advisory it pulls in (see audit table). | 2 | HIGH — registry + `npm ls` |
| **Supabase CLI** | `2.117.0` | Schema drift detection, type generation, pgTAP runner, local stack | The only tool that can answer "does `supabase/migrations/` match production?" — the central Stage 1 unknown given 44 migrations across 3 naming schemes. Also generates the types that replace the 1,508-line hand-written `src/lib/supabase/types.ts`. | 1, 3, 4 | HIGH (version) / LOW (flag syntax) |
| **Playwright** | `@playwright/test@1.63.0` | Role-based E2E certification | The only realistic way to execute the 7-persona matrix in Stage 4 against real Supabase auth cookies. `storageState` per role is the native primitive for exactly this. Next.js declares it as a peer (`@playwright/test: ^1.51.1`), so it is the sanctioned choice. | 4 | HIGH (version) / LOW (fixture detail) |
| **pgTAP** | Postgres extension (via Supabase CLI) | RLS allow/deny proofs | Runs *inside* Postgres as the actual `anon`/`authenticated` role. An app-level test can only prove what the app does; pgTAP proves what the database permits, which is what "RLS allow/deny tests passing for every table" actually requires. | 4 | LOW — vendor docs |
| **zod** | `4.6.5` | Input validation + API contracts | Stage 3 requires "input validation and API contracts defined for every handler" across 92 handlers. Zod gives one schema that is both the runtime guard and the inferred TS type, which kills a class of the `any` casts the audit is chasing. | 3 | HIGH (version) |
| **@sentry/nextjs** | `10.74.0` | Error tracking + tracing | Peer range is `^13.2 \|\| ^14 \|\| ^15 \|\| ^16.0.0-0` — Next 16 explicitly supported. Replaces 179 unstructured `console` calls across 62 files as the error path. | 3 | MEDIUM (peer verified) / LOW (setup) |
| **knip** | `6.35.1` | Dead file / export / dependency detection | Directly produces three Stage 1 deliverables at once: dead routes, unused exports, and unused dependencies. Understands Next.js App Router conventions (`page.tsx`/`route.ts` are entry points, not dead code) — a generic tool flags all 43 pages as unreachable. | 1 | HIGH (version) |
| **dependency-cruiser** | `18.3.0` | Architectural boundary rules | Lets Stage 3's "shared service/data-access boundaries" be *enforced* as a lint rule (e.g. "no `src/app/**` may import `lib/supabase/service`") rather than documented and re-violated. Also finds import cycles. | 1, 3 | HIGH (version) |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Stage |
|---|---|---|---|---|
| `jest-environment-jsdom` | `30.5.1` | DOM env for component tests | **Required to un-skip 4 suites.** `jest.config.js` sets `testEnvironment: 'node'`; the `.tsx` tests need jsdom via a per-file `@jest-environment jsdom` docblock or a projects split. | 2 |
| `@testing-library/react` | `16.3.3` | Component/hook rendering | The literal stated reason 4 suites are skipped. Installing it is the cheapest test-coverage win in the whole program. | 2 |
| `@testing-library/jest-dom` | `7.0.1` | DOM matchers | `toBeInTheDocument()` etc. Import `@testing-library/jest-dom` (not the `/vitest` entry point the stale setup file uses). | 2 |
| `@testing-library/user-event` | `14.6.7` | Realistic interaction simulation | Prefer over `fireEvent` for new component tests. | 2, 4 |
| `@faker-js/faker` | `10.6.0` | Seeded synthetic data | Stage 4's scale dataset (thousands of rows). Call `faker.seed(N)` for the **deterministic** dataset — same seed, same rows, every run. | 4 |
| `msw` | `2.15.0` | Network interception | Only if Stage 4 needs to stub Apify/Instagram or email providers during E2E. Do not use it for Supabase — mock at the client boundary as the existing tests already do. | 4 |
| `npm-check-updates` | `23.1.0` | Batched upgrade planning | Stage 2 requires "safe patch/minor upgrades in small batches". `ncu -t minor` proposes a batch; you review, apply, run the gate, commit. | 2 |
| `typescript-eslint` | `8.70.0` | Typed lint rules | Enables `no-explicit-any`, `no-unsafe-assignment`, `no-floating-promises`. Pairs with the tsconfig flag below for catch blocks. | 1, 3 |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `npm audit --json` | Vulnerability inventory + reachability | Already ran it — results below. Pipe through a script that joins `isDirect` + `fixAvailable.isSemVerMajor` to separate "free fix" from "major upgrade". **Never run `npm audit fix --force`** during this program; it silently applies majors. |
| `npm ls <pkg> --all` | Reachability proof | The tool that turns "42 vulnerabilities" into "one dependency causes most of them". Use it per-advisory before writing any Stage 1 finding. |
| `tsconfig: useUnknownInCatchVariables` | `any` in catch blocks | **This is a compiler flag, not an ESLint rule.** It is already on — it is implied by `strict: true`, which this project has. So `catch (e)` is already `unknown`; any `any` in a catch block is an *explicit* annotation. Grep for `catch (\w+: any)` rather than adding a lint plugin. |
| `supabase db diff` / `db pull` | Migration drift | The Stage 1 answer to "45 migrations, 3 naming schemes, 2 `remote_schema` dumps". |
| `k6` | Load testing | **Already present** (`load-tests/k6-online-users.js`, `k6-onboarding.js`, plus `load:*` npm scripts). Leave alone; reuse in Stage 4. |
| GitHub Actions | CI gate | Already exists but has **no test step** and pins **Node 20** while local dev is Node 24.16. Both are Stage 2 fixes. |

---

## Verified Audit Findings (evidence, not inference)

These were produced by running the tools against this repo today. They belong in `FOUNDATION_AUDIT.md` and they set Stage 2's scope.

### Vulnerability inventory — `npm audit`

```
critical: 3   high: 23   moderate: 14   low: 2   total: 42
prod deps: 680   dev deps: 462   total: 1269
```

### Reachability — traced with `npm ls`

| Vulnerable package | Severity | Reached via | Verdict |
|---|---|---|---|
| `tar` | **CRITICAL** | `vercel@32.3.0 → @vercel/next → @vercel/nft → @mapbox/node-pre-gyp → tar@6.2.1` | Disappears when `vercel` is removed |
| `undici@5.23.0` | HIGH | `vercel@32.3.0 → @vercel/node@3.0.6` | Disappears when `vercel` is removed |
| `path-to-regexp` | HIGH | `vercel@32.3.0 → @vercel/node` **and** `→ @vercel/redwood → @vercel/routing-utils` | Disappears when `vercel` is removed |
| `esbuild@0.14.47` | HIGH | `vercel@32.3.0 → @vercel/node` | Disappears when `vercel` is removed |
| `handlebars` | **CRITICAL** | `ts-jest@29.4.6 → handlebars@4.7.8` | Dev-only; fixed by non-major `ts-jest` bump |
| `sharp` | HIGH | `next@16.2.1 → sharp@0.34.5` | Fixed by the Next.js upgrade |
| `next` | **CRITICAL** | direct — "DoS with Server Components" | Fixed by the Next.js upgrade |
| `swagger-ui-react@5.17.10` | HIGH | direct → `immutable`, `js-yaml` | Fixed by non-major bump to 5.32.15 |
| `postcss` | HIGH | direct | Fixed by non-major bump |

**The single highest-leverage action in Stage 2 is deleting `vercel` from `dependencies`.** It is a CLI. It is never imported at runtime. Vercel builds on their own platform and does not need it in the project. It is the root of one critical and at least four highs, and `npm audit` reports its only fix as `vercel@59.16.0 (MAJOR)` — a 27-major-version jump you should not take when the correct answer is removal. Remove it from `dependencies` and do **not** re-add it to `devDependencies`; if a human needs it, `npx vercel` or a global install works and keeps it out of the lockfile entirely.

### Next.js version exposure — this is the most urgent finding

The lockfile pins **`next@16.2.1`** (confirmed: `node_modules/next/package.json` → `16.2.1`), even though `package.json` says `^16.0.3`. Against the published advisory timeline:

| Release | Fixes | Is 16.2.1 exposed? |
|---|---|---|
| 16.0.7 | CVE-2025-66478 "React2Shell", CVSS **10.0** RCE | No — 16.2.1 > 16.0.7 |
| **16.2.11** (July 2026) | **9 CVEs.** CVE-2026-64641 Server Actions DoS (High), 64642 middleware/proxy bypass (High), 64645 SSRF via rewrites (High), 64649 SSRF in Server Actions (High), 64643 Server Function endpoint disclosure, 64648 + 64647 **fetch cache confusion** | **YES — fully exposed to all 9** |
| 16.3.3 (Aug 2026) | AVIF image-opt RCE (CVSS 9.5), CVE-2026-75604 Windows RCE (CVSS 9.0) | Yes, but Vercel states managed-platform apps were not affected by this pair |

Two of the July CVEs deserve special attention given this codebase:

- **CVE-2026-64643** (Server Function endpoint ID disclosure) and **CVE-2026-64648/64647** (fetch cache confusion, where a `fetch` with a body can return another request's cached response) land directly on top of the already-suspected blanket `s-maxage=60, stale-while-revalidate=300` on `/api/*` in `vercel.json`. Framework-level cache confusion plus a CDN-level shared cache over personalized endpoints is a compounding exposure, not two separate ones. Stage 1 should assess them together.

**Recommendation: upgrade to `next@16.3.5` and treat it as a Stage 2 gating item, not a batched minor.** It is within the existing `^16.0.3` range, so it is a lockfile change, not a semver decision.

### Toolchain gaps confirmed

| Gap | Evidence |
|---|---|
| No `.nvmrc` | File does not exist |
| No `engines` in `package.json` | Confirmed by inspection |
| CI/local Node split | `.github/workflows/ci.yml` → `node-version: 20`; local → Node 24.16 |
| No `test` script | `package.json` scripts: `dev`, `build`, `start`, `lint`, `check:feedback`, `load:online`, `load:onboarding` |
| CI never runs tests | CI steps are lint → `tsc --noEmit` → build only |
| Hand-written Supabase types | `src/lib/supabase/types.ts` is 1,508 lines |
| No DB test infrastructure | No `supabase/tests/`, no `supabase/seed.sql` |
| Duplicate API-doc stacks | Both `swagger-ui-react@5.17.10` **and** `redoc@2.5.2` in `dependencies` |

---

## Installation

Grouped by stage. Do not install Stage 3/4 tooling during Stage 1 — the audit is read-only and a clean `npm ls` is part of its evidence.

```bash
# ── Stage 1: audit (dev-only, additive, no runtime impact) ──
npm install -D knip@6.35.1 dependency-cruiser@18.3.0
npm install -g supabase@2.117.0          # or: brew install supabase/tap/supabase

# ── Stage 2: stabilize ──
npm uninstall vercel                      # removes 1 critical + 4 highs; do NOT re-add as devDep
npm install next@16.3.5                   # fixes 9 July-2026 CVEs incl. 4 High
npm install swagger-ui-react@5.32.15      # clears immutable + js-yaml highs
npm install -D ts-jest@29.4.12            # clears the critical handlebars advisory
npm install -D jest@30.5.1 jest-environment-jsdom@30.5.1
npm install -D @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.7
npm install -D npm-check-updates@23.1.0
rm vitest.config.ts vitest.setup.ts       # orphaned: vitest is not installed

# ── Stage 3: refactor ──
npm install zod@4.6.5
npx @sentry/wizard@latest -i nextjs        # installs + configures @sentry/nextjs@10.74.0
npm install -D typescript-eslint@8.70.0

# ── Stage 4: certify ──
npm install -D @playwright/test@1.63.0 && npx playwright install --with-deps
npm install -D @faker-js/faker@10.6.0
supabase test new rls_events.test          # scaffolds supabase/tests/
```

Add to `package.json` in Stage 2 — the missing `test` script is why 220 passing tests went unnoticed:

```json
{
  "engines": { "node": ">=24.0.0 <25", "npm": ">=11" },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage",
    "typecheck": "tsc --noEmit",
    "knip": "knip",
    "depcruise": "depcruise src --config .dependency-cruiser.js",
    "db:types": "supabase gen types typescript --project-id \"$SUPABASE_PROJECT_ID\" --schema public > src/lib/supabase/types.ts",
    "db:diff": "supabase db diff --schema public",
    "db:test": "supabase test db"
  }
}
```

And `.nvmrc`:

```
24
```

---

## Node version: pick 24, and move CI to match

Every tool in this stack constrains Node, and the intersection is narrower than it looks:

| Tool | `engines.node` |
|---|---|
| `next@16.3.5` | `>=20.9.0` |
| `knip@6.35.1` | `^20.19.0 \|\| >=22.12.0` |
| `@playwright/test@1.63.0` | `>=20` |
| `@sentry/nextjs@10.74.0` | `>=18` |
| `vitest@5` (if it had been kept) | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |

Local dev is already on **24.16**, and CI is on **20** — so CI has been validating a runtime nobody develops on. Pin **Node 24** in `.nvmrc`, `engines`, and `.github/workflows/ci.yml` simultaneously. Note this is a real (if low) risk item: bumping CI 20 → 24 changes the build runtime, so it should be its own commit with a full gate run, not folded into a dependency batch.

---

## Structured logging: use a thin in-house wrapper, not Pino

This is the one place where the obvious answer is wrong for this codebase.

**Do not reach for `pino@10.3.1` first.** Pino is a Node-runtime logger. This app runs `src/middleware.ts` on the Edge runtime, where Pino's transport layer and `process.stdout` assumptions do not apply. Adopting Pino means either excluding middleware from structured logging — the single most security-relevant file in the app, since it owns auth redirects, the onboarding guard, and rate limiting — or maintaining two logger implementations.

**Recommended:** a ~40-line `src/lib/logger.ts` that emits single-line JSON via `console`, with a level, a message, a request-correlation id, and a redaction allowlist. Vercel's log drains parse JSON from `console` on both runtimes, so one implementation covers Edge middleware, Node API routes, and Fluid Compute uniformly. Pair it with Sentry for errors and traces — Sentry is the observability product; the logger is just the structured-emit primitive. This also gives Stage 3 a mechanical target: replace 179 `console` calls across 62 files with one import, which is a codemod rather than a judgement call per site.

**Choose Pino instead if** Stage 3 concludes that middleware should stop doing meaningful work (moving auth checks into route handlers), leaving everything log-worthy on the Node runtime. That is a legitimate architectural outcome — just don't presuppose it.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative is right |
|---|---|---|
| Jest | Vitest 5 | If the team wanted ESM-native speed and browser-mode component tests. **Not now** — Vitest isn't installed, Jest is green at 220 tests, and a runner migration during a *stabilization* program is exactly the unforced change this program exists to avoid. Revisit after Stage 4 certification. |
| knip | `ts-prune` | Never, for this project. `ts-prune` was last published **2022-05-22** — over four years stale, predates the App Router entirely, and has no concept of `page.tsx`/`route.ts` entry points. It is explicitly listed in the research prompt; it should be explicitly rejected. |
| dependency-cruiser | `madge@8.0.0` | Madge is lighter and good for a quick cycle graph. Use it if you only want a picture. Use dependency-cruiser when you want the boundary to *fail CI*, which Stage 3 does. |
| In-house JSON logger | `pino@10.3.1` | See the logging section — if all logging moves to the Node runtime. |
| `@faker-js/faker` | `@snaplet/copycat@6.0.0` | Copycat gives deterministic *value-preserving* transforms (same input → same fake output), which is ideal for anonymizing a production dump. But Stage 4 forbids production data, so you're generating from scratch — faker with a fixed seed is the better fit. Last Copycat publish was 2025-01-14. |
| Playwright | Cypress | Cypress is fine, but Playwright is a declared Next.js peer dependency, has first-class multi-`storageState` project fixtures for the 7-persona matrix, and runs the three browser engines. No reason to diverge. |
| pgTAP | App-level RLS tests only | App-level tests prove the *app* behaves; they cannot prove the *database* denies a direct client using a leaked anon key. Stage 4 says "RLS allow/deny tests passing for every table" — that requires in-database assertions. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| **`vercel` as a dependency** (currently `^32.3.0` in `dependencies`) | A build CLI shipped in the production dependency tree. Root cause of critical `tar` plus high `undici`, `path-to-regexp`, `esbuild`. `npm audit` offers only `vercel@59.16.0` — a 27-major jump. | `npm uninstall vercel`. Not a devDependency either — use `npx vercel` ad hoc. |
| **`npm audit fix --force`** | Applies semver-major upgrades silently. Against 42 advisories spanning `next`, `vercel`, `postcss`, and `swagger-ui-react`, it would rewrite the stack in one unreviewable commit — the opposite of Stage 2's "small batches, gate after each". | `ncu -t minor` → review → apply → run gate → commit. Handle each major separately. |
| **TypeScript 7.x** (`7.0.2` is released) | **Hard blocker:** `ts-jest@29.4.12` declares `typescript: ">=4.3 <7"`. Installing TS 7 breaks the entire test suite — the one asset this program is trying to protect. | Stay on TypeScript `5.9.3` (already installed) for the whole program. Re-evaluate after Stage 4. |
| **React 19** (`19.3.0` is released) | `next@16.3.5` peer is `react: "^18.2.0 \|\| ^19.0.0"` — React 18.3.1 is fully supported, so there is **no forcing function**. A React major during a behavior-preservation program risks every one of the Validated requirements. | Stay on React `18.3.1`. Defer to a dedicated future milestone. |
| **ESLint 10** (`10.10.0` is released) | `eslint-config-next@16.3.5` declares `eslint: ">=9.0.0"` so it is *technically* permitted, but a lint-engine major mid-audit produces a wave of new violations that are indistinguishable from real findings. | Stay on ESLint `9.39.1`. Add `typescript-eslint` rules instead — new rules, stable engine. |
| **`ts-prune`** | Unmaintained since 2022; no App Router awareness. | `knip@6.35.1` |
| **Shipping both `swagger-ui-react` and `redoc`** | Two full OpenAPI renderers (~MBs) in `dependencies` for one spec, on a Vercel bundle. `swagger-ui-react` also carries the `immutable`/`js-yaml` highs. | Pick one — Redoc for read-only docs, Swagger UI if "try it out" is actually used. Move it behind `next/dynamic` with `ssr: false` so it never enters the main bundle. Drop the other, plus `@types/swagger-ui-react` and `@swagger-api/apidom-ns-openapi-3-1`. |
| **Hand-written `types.ts`** | 1,508 lines that can silently drift from 44 migrations' worth of schema. | `supabase gen types typescript`, committed, with a CI drift check. |
| **Keeping `vitest.config.ts` / `vitest.setup.ts`** | Reference an uninstalled dependency; actively misled the existing codebase map into documenting a test suite that does not exist. | Delete both in Stage 2. |

---

## Stack Patterns by Stage

**Stage 1 — Audit (read-only).** Add only `knip` and `dependency-cruiser` as devDependencies, plus the Supabase CLI globally. Everything else is a read: `npm audit --json`, `npm ls <pkg> --all` for reachability, `supabase db diff` for drift, `npx jest` for the real test baseline. The deliverable is evidence, so preserve the current lockfile untouched — Stage 2 needs it as the before-picture.

**Stage 2 — Stabilize.** Order matters, because each step changes what `npm audit` reports:
1. `npm uninstall vercel` — biggest advisory reduction, zero runtime risk
2. `next@16.3.5` — the 4 High CVEs; own commit, full gate
3. Node pin (`.nvmrc` + `engines` + CI 20→24) — own commit, full gate
4. Delete Vitest configs; install the 4 testing-library packages; un-skip the 4 component suites; add `test` script; add the CI test step
5. Remaining non-major bumps in batches via `ncu -t minor`
6. Sweep **all** skip markers rather than deleting only the one known suite. Test decay against changed routes happened in at least two places: `src/app/api/events/route.test.ts:19` (`describe.skip`, cursor-pagination route deleted) and `src/__tests__/api/events/get-events.test.ts:420` (`it.skip`, "route no longer uses `eq()` for status filtering"). Run `grep -rn "describe.skip\|it.skip\|test.skip\|xdescribe\|xit" src` and triage every hit into *un-skip* (blocked only by a missing dependency) or *delete* (asserts behavior that no longer exists). The second kind is worse than no test — it inflates the suite count while asserting nothing.
7. `rm -rf node_modules package-lock.json && npm install` → verify reproducibility, then review the lockfile diff

**Stage 3 — Refactor.** `supabase gen types` first (schema → types is the bottom of the stated bottom-up order), then zod contracts per handler, then the logger wrapper + Sentry, then a `/api/health` endpoint. Add dependency-cruiser boundary rules to CI as each service boundary is established — that is what keeps the refactor from regressing.

**Stage 4 — Certify.** pgTAP for RLS allow/deny per table; Playwright with one `storageState` per persona (anonymous, student, member, organizer, owner, admin, banned) plus a non-McGill sign-in rejection spec; faker with fixed seeds for the three datasets; existing k6 scripts for load.

---

## Version Compatibility

| Package | Constraint | Source | Notes |
|---|---|---|---|
| `ts-jest@29.4.12` | `jest: ^29 \|\| ^30` | registry peerDeps | **Refutes the "mismatch" premise** |
| `ts-jest@29.4.12` | `typescript: >=4.3 <7` | registry peerDeps | **Blocks TypeScript 7** |
| `next@16.3.5` | `react: ^18.2.0 \|\| ^19.0.0` | registry peerDeps | React 18.3.1 is fine — no forced upgrade |
| `next@16.3.5` | `node: >=20.9.0` | registry engines | Node 24 satisfies |
| `next@16.3.5` | `@playwright/test: ^1.51.1` (peer) | registry peerDeps | 1.63.0 satisfies |
| `@sentry/nextjs@10.74.0` | `next: ^13.2 \|\| ^14 \|\| ^15 \|\| ^16.0.0-0` | registry peerDeps | Next 16 supported |
| `knip@6.35.1` | `node: ^20.19.0 \|\| >=22.12.0` | registry engines | Node 24 satisfies; Node 20.9 (CI today) would **fail** |
| `eslint-config-next@16.3.5` | `eslint: >=9.0.0` | registry peerDeps | ESLint 10 permitted but deferred by choice |
| `@supabase/ssr@0.12.7` | `@supabase/supabase-js: ^2.114.0` | registry peerDeps | Current `^0.7.0`/`^2.49.0` pair is behind; treat `@supabase/ssr` 0.7→0.12 as a **major-equivalent** (0.x) upgrade with its own migration test |

---

## Open Questions for Stage 1

- Does `s-maxage=60` on `/api/*` currently cache authenticated responses? Needs a header/`Vary`/`Set-Cookie` inspection per handler, now compounded by CVE-2026-64648/64647.
- How far has `supabase/migrations/` drifted from production? Unanswerable without linked credentials — `supabase db diff --linked` is the first Stage 1 command to run once they're available.
- Are `swagger-ui-react`/`redoc` reachable from any shipped route, or dead weight? `knip` answers this.
- Does the app use `config.i18n.locales` with a single entry and Turbopack? If so, CVE-2026-64642 (middleware/proxy bypass) is directly exploitable against the auth guard — escalate the Next.js upgrade above everything else.

---

## Sources

- **Local verification (HIGH)** — `npm audit --json`, `npm ls <pkg> --all`, `npx jest`, `npx jest --listTests`, `grep`/`find` over `src/`, and direct reads of `package.json`, `package-lock.json`, `jest.config.js`, `vitest.config.ts`, `vercel.json`, `.github/workflows/ci.yml`, `node_modules/*/package.json`. All quantitative claims above (220 passing tests, 42 advisories, `next@16.2.1`, 1,508-line types file, absent `.nvmrc`) come from this.
- **npm registry metadata (HIGH)** — `npm view <pkg> version|engines|peerDependencies|time.modified` for all ~35 packages named. All version numbers and every compatibility constraint in the table above.
- **nextjs.org/blog/CVE-2025-66478 (LOW — vendor advisory via WebFetch)** — React2Shell, CVSS 10.0, fixed in 16.0.7.
- **nextjs.org/blog/july-2026-security-release (LOW — vendor advisory via WebFetch)** — the 9 CVEs fixed in 16.2.11, with severities.
- **Next.js August 2026 release coverage (LOW — secondary source via WebFetch)** — AVIF RCE + CVE-2026-75604, fixed in 16.3.3, Vercel-managed apps unaffected. *Secondary source; confirm against the official advisory before citing in FOUNDATION_AUDIT.md.*
- **docs.sentry.io Next.js guide (LOW — vendor docs via WebFetch)** — wizard, config file set, `withSentryConfig`.
- **supabase.com/docs local-development + testing + generating-types (LOW — vendor docs via WebFetch)** — CLI command syntax, pgTAP workflow. *Flag syntax should be re-verified with `supabase --help` at the installed version; the docs did not confirm `--linked` for `gen types`.*
- **WebSearch (LOW)** — pgTAP/basejump `supabase-test-helpers` patterns for RLS allow/deny.

**Confidence note:** the GSD `classify-confidence` seam rates `webfetch`/`websearch` as LOW and `context7` as MEDIUM. Context7 MCP was unavailable in this environment (`mcp__context7__*` not registered) and the `ctx7` CLI fallback is not installed, so no MEDIUM-tier documentation source was reachable. I compensated by grounding every load-bearing claim in direct local execution and npm registry metadata, which is first-party and stronger than any of the three tiers. **Treat the version numbers and audit findings as HIGH; treat the setup/flag syntax for Sentry, Supabase CLI, and pgTAP as LOW and re-verify at install time.**

---
*Stack research for: foundation audit/stabilize/refactor/certify of Next.js 16 + Supabase + Vercel*
*Researched: 2026-09-13*
