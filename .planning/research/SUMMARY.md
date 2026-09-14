# Project Research Summary

**Project:** Uni-Verse Foundation Program
**Domain:** Foundation audit / stabilize / refactor / certify program on an existing Next.js 16 App Router + Supabase + Vercel campus event-discovery app
**Researched:** 2026-09-13
**Confidence:** HIGH — nearly every load-bearing claim across all four documents is grounded in direct repo execution (`npm audit`, `npx jest`, `grep`, file reads) or first-party vendor documentation, not inference.

## Executive Summary

Uni-Verse is a working, shipped Next.js 16 + Supabase + Vercel monolith (94 route handlers, 43 pages, 45 migrations, ~28 tables) that has accumulated the debt typical of two milestones built under deadline: hand-rolled authorization repeated 19+ times, a service-role client used in 22+ places (including a page component) with no register of why, a blanket CDN cache header that plausibly leaks personalized data across users, an untracked test suite that already works but gates nothing, and 45 migrations across three naming schemes with unknown drift from production. None of this is exotic — it is the standard shape of "shipped fast, never circled back," and the research is consistent that the fix is not a rewrite but disciplined, evidence-first stabilization: audit read-only first, remove/patch the dependencies that cause the vulnerability count, then refactor bottom-up in small tested vertical slices, then certify with real personas and real data before the next milestone starts.

The single most important correction the research makes to the program's working assumptions is that several premises handed into research were simply wrong, and the orchestrator's verified facts confirm the correction: there is no Jest/ts-jest version mismatch, Vitest is not installed (its config files are dead orphans), and 220 tests already pass under Jest today — nobody has been running them because there's no `test` script and CI never calls one. The Stage 1 "choose a test runner" task is not a real decision to make; it's a one-line confirmation plus cheap cleanup (delete orphans, add the script, un-skip four self-documenting component-test suites once `jest-environment-jsdom` and testing-library are installed). The other headline risk is the `vercel.json` blanket `s-maxage=60` on all `/api/*` routes, which — combined with Next.js's fetch-cache-confusion CVEs patched in 16.2.11 and the fact that `@supabase/ssr` only emits `Set-Cookie` when it actually refreshes a session — is a plausible, intermittent, devtools-invisible cross-user data leak on personalized endpoints (recommendations, saved events, notifications, invites). This must be proven with an empirical curl test in Stage 1, not assumed, and fixed by inverting the cache default to `private, no-store` with explicit per-route opt-in.

The recommended path threads three real constraints simultaneously: (1) behavior preservation — every Validated workflow must survive every stage, enforced by characterization tests written *before* any refactor touches a layer; (2) small reviewable batches — dependency upgrades, schema reconciliation, and slice refactors all proceed in bisectable, individually-gated commits, never a "fix everything" sweep; (3) evidence over assumption — the six-month-old codebase map is demonstrably stale in places (it says types are hand-written; they carry a CLI-generated marker; it implies a live Jest/Vitest split; Vitest isn't even installed) so every stage re-verifies rather than trusts prior documentation, including this research where it touches version numbers now superseded by the orchestrator's direct verification (Next 16.2.1 pinned, CVE-2026-64642 not exploitable here since no i18n config exists, `vercel@32.3.0` confirmed as the dependency root-cause).

## Key Findings

### Recommended Stack

Keep the existing stack; the program stabilizes it, it does not replace it. **Keep Jest** (verified: 220 passing tests, `ts-jest@29.4.x` is the correct Jest-30-compatible line, no mismatch exists) and delete the dead `vitest.config.ts`/`vitest.setup.ts` orphans. Add `jest-environment-jsdom` + `@testing-library/react`/`jest-dom`/`user-event` to un-skip four component/hook suites that are blocked only on a missing package, not a real failure. Add `zod` for input validation/API contracts (Stage 3), `@sentry/nextjs` for error tracking with a Turbopack-aware setup and PII scrubbing rules decided before install (Stage 3), `knip` + `dependency-cruiser` for dead-code detection and enforceable architectural boundaries (Stage 1/3), the Supabase CLI for schema drift detection and generated types (all stages), and Playwright + pgTAP for Stage 4 certification (persona-based E2E and in-database RLS allow/deny proofs — an app-level test cannot prove what the database permits, only what the app does).

**Core technologies:**
- Jest (already installed, already green) — keep; do not migrate to Vitest, which isn't installed and would be pure unforced risk during a stabilization program
- Supabase CLI — schema drift detection (`db diff`, `migration repair`), type generation, pgTAP runner; the only tool that can answer "does the migrations folder match production?"
- Playwright — the sanctioned Next.js peer dependency; `storageState` per persona is the native primitive for the 13-persona certification matrix
- pgTAP — proves what the database permits (RLS), which app-level tests structurally cannot
- zod — one schema is both the runtime guard and the inferred TypeScript type across 92 handlers
- Immediate action, verified by the orchestrator directly: `npm uninstall vercel` from production dependencies (root of most `npm audit` findings) and upgrade `next` off `16.2.1` to the version that patches July-2026 CVEs — mandatory regardless of the i18n non-exploitability, since 8 of 9 CVEs are unrelated to i18n.

### Expected Features (Deliverables, not product features — this is an audit/stabilize/refactor/certify program)

**Must have (table stakes) per stage:**
- Stage 1: live schema snapshot + three-way drift table (prod vs migrations vs types); full endpoint (94) and page (43) inventory classified by auth/role/cache/personalization; RLS policy review from live `pg_policies`; service-role callsite register with justification; cache/personalization exposure matrix; fail-open and `getSession()`-as-authorization audit; cron/webhook inventory; test/build/lint baseline with actual command output; `FOUNDATION_AUDIT.md` with severity/evidence/repro/fix/validation-criterion per finding
- Stage 2: written vulnerability policy before scanning; `vercel` removed from prod deps; Next.js patched; one test runner with the other's config removed; batched upgrades each gated by lint+typecheck+test+build+smoke; reproducible clean install; reviewed lockfile diff
- Stage 3: schema/migrations/RLS reconciled with production; generated Supabase types (zero `as any`); `getUser()` not `getSession()` at every auth decision; shared service/data-access boundaries; Zod contracts per handler; middleware/routing corrected; dual-date-schema and tag-mapping consolidated; caching fixed (no personalized data under shared cache); structured logging + Sentry + health check
- Stage 4: deterministic, adversarial, and scale datasets covering every role/status/edge case; full persona × workflow matrix (13 personas including expired-suspension, mid-onboarding, and machine callers with absent credentials); RLS allow/deny pgTAP per table; every endpoint classified and reviewed, every page smoke-tested; rehearsed rollback + measured-RTO restore drill with an alert observed firing

**Should have (differentiators, add if room):**
- A generated persona × endpoint authorization matrix test — data-driven from the Stage 1 inventory, the single highest-leverage regression guard in the program if the inventory lands machine-readable
- CI job running the audit/RLS/E2E gates on every PR
- Client-bundle secret sweep (grep `.next/static` for service keys) — hours, not days, very high value
- SBOM + Renovate/Dependabot configuration

**Defer (explicitly out of scope for this program):**
- React 19 / Next.js major version upgrades (no forcing function on the current Next 16 line; defer until the certified test suite exists to catch regressions)
- Declarative schema migration to `supabase/schemas/` (real payoff, but a rewrite of the migration story mid-program)
- Visual regression / accessibility suites (additive quality, not certification credibility)
- ORM adoption, package manager change, recommendation-engine rework — all explicitly excluded stack changes

### Architecture Approach

The target architecture is a three-ring defense-in-depth model layered under the existing App Router structure, introduced incrementally through the Stage 3 slices rather than built up front: **Ring 1 (middleware)** is advisory-only and fails open by design — session refresh, UX redirects, rate limiting, never the authorization boundary (today it *is* treated as one in places, and its `catch { next() }` wrapper means a thrown ban-check error currently lets a banned user through); **Ring 2 (`src/server/authz/`)** is the single, fails-closed place authorization decisions are made, invoked through a `withRoute` transport wrapper so every route declares its auth mode as a required field rather than an easily-forgotten call; **Ring 3 (Postgres RLS)** is the last line and must hold even if Rings 1 and 2 are removed. A new `src/server/` directory (context, http, errors, authz, services, db/elevated, obs) sits alongside `src/app/`, with `src/contracts/` (zod schemas) above both so client and server share one validation source, and ESLint import-boundary rules make the `app/**` → service-role-client prohibition mechanically enforced rather than a convention that decays.

**Major components:**
1. `src/server/context.ts` — computes identity (user, profile, roles, ban state) exactly once per request, replacing today's pattern where a single admin request can trigger three separate `auth.getUser()` round-trips across middleware, `checkBanStatus()`, and `verifyAdmin()`
2. `src/server/authz/` — Ring 2; pure predicates and throwing guards (`requireUser`, `requireRole`, `requireClubRole`) that collapse the 19 files currently reimplementing club-membership checks and the split between `verifyAdmin()` (26 files) and inline `roles.includes("admin")` (5 files)
3. `src/server/db/elevated/` — the only door to the service-role client; each export is one named, justified, audited operation, replacing 22 unregistered `createServiceClient()` callsites (including inside a page component)
4. `src/contracts/` — zod schemas shared by client forms, route handlers, and the OpenAPI doc generator, replacing 34 handlers that currently parse unvalidated JSON and the hand-maintained Swagger/Redoc annotations that can drift silently

**Recommended Stage 3 slice order** (the architecture researcher's most consequential judgment call): two horizontal foundations first — F0a (schema truth: migration reconciliation, generated types, RLS inventory) and F0b (the seam kit: context/http/errors/authz scaffolding, applied to zero routes yet, plus the test harness) — because a vertical slice cannot refactor a layer that doesn't exist. Then vertical slices in dependency/blast-radius order: **(1) saved events + RSVP** — smallest true end-to-end workflow, user-owned rows only, already has characterization tests, proves the seam cheaply; **(2) event read path** — highest traffic, settles the dual-date schema and tag-mapping mess that blocks everything downstream; **(3) auth/session/ban/onboarding** — deliberately *not* first despite being the lowest layer, because it is the highest blast-radius change in the program (a mistake here locks out every user) and slices 1–2 exist first to provide the working test harness that would catch such a mistake; **(4) club authorization/membership** — the largest cross-tenant risk surface, built on `requireUser` from slice 3; **(5) admin/moderation/service-role containment** — depends on 3 and 4 defining the authorization model it acts within; **(6) recommendations/interactions/notifications/cron/webhook** — the asynchronous edge, certified last because correctness there is hardest to assert; **(7) close-out** — only now is every route classified, so the blanket cache header can be safely deleted.

### Critical Pitfalls

1. **A working test suite nobody runs, silently skipping its highest-value cases** — 220 tests pass under Jest today but gate nothing (no `test` script, no CI step), and 5 of 21 suites are skipped, covering exactly the UI surface Stage 3 will touch last and trust most. Avoid by adding the `test` script and CI step in Stage 2 *before* Stage 3 starts, deleting the Vitest orphans, and installing the missing jsdom/testing-library packages to un-skip the self-documenting suites.
2. **The blanket `s-maxage=60` on `/api/*` is an intermittent, devtools-invisible cross-user data leak** — the Cookie *request* header doesn't affect the CDN cache key, and `Set-Cookie` is only emitted on session-refresh requests, so the same personalized endpoint is cacheable on most requests and uncacheable on refresh requests — a bug that looks like a random glitch, not a leak. Avoid by proving it with a two-session curl test against production in Stage 1 (read-only), then inverting the default to `private, no-store` with explicit per-route opt-in in Stage 3, never by blanket-deleting all caching (which trades the leak for a latency regression on the highest-traffic anonymous browse path).
3. **"Upgrade Next.js" is three differently-sized changes wearing one checkbox** — the security patch is mandatory and separate from the `middleware.ts`→`proxy.ts` migration (Node-only runtime, changes cold-start and rate-limiter lifetime) and separate again from a React 18→19 major that is *not* forced by the Next 16 patch. Avoid by splitting into three independently gated roadmap items so a single commit never touches `next`, `react`, and `react-dom` together.
4. **Chasing every `npm audit` advisory instead of removing the one dependency causing most of them** — `vercel@^32.3.0` in production dependencies is the root of one critical (`tar`) plus at least four highs; `npm audit`'s own suggested fix is a 27-major-version jump that should be rejected in favor of outright removal. Avoid by ordering Stage 2 work by blast radius: remove `vercel`, patch `next`, then triage the remainder by reachability — never `npm audit fix --force`.
5. **RLS tests that pass no matter what the policies say** — if any test harness attaches the service-role client, `bypassrls` makes every assertion pass regardless of policy; a harness that inconsistently attaches a user JWT will produce flaky results that get "fixed" by removing the JWT, silently converting the whole suite into a bypass. Avoid by using pgTAP with `set local role` impersonation exclusively, asserting both allow *and* deny per role, and adding a CI guard that fails if any RLS test file references the service-role client.
6. **Characterization tests that freeze known defects as the contract** — several "current behaviors" Stage 3 will characterize are known bugs (unknown tags silently coerced to SOCIAL, `%`/`_` unescaped in search, fail-open admin endpoints). A naive characterization test asserts the bug as the spec, and the later fix "breaks the tests." Avoid by tagging every characterization test PRESERVE or DEFECT from the Stage 1 findings list at the moment it's written, with DEFECT tests marked expected-to-fail until the fixing slice lands.

## Implications for Roadmap

Based on combined research, the four PROJECT.md stages should be treated as the roadmap's phase spine, with the following internal structure and sequencing guidance:

### Phase / Stage 1: Read-Only Foundation Audit
**Rationale:** Every other stage consumes this stage's inventories as their denominator (the endpoint/page classification feeds Stage 3's slice plan and both of Stage 4's coverage gates). It must be strictly read-only so the "before" baseline used to prove behavior preservation is never contaminated by an in-flight fix.
**Delivers:** `FOUNDATION_AUDIT.md` with every finding carrying a stable ID, exposure-adjusted severity, evidence, affected paths, reproduction, recommended fix, and validation criterion; the three-way schema/migration/type drift table; the 94-endpoint and 43-page classification; the RLS policy heatmap; the service-role callsite register; the cache/personalization exposure matrix *with the empirical curl proof against production*; the test-runner decision (already resolved by evidence: keep Jest); the cron/webhook inventory (including whether `/api/cron/*` actually fires, since `vercel.json` has no `crons` key).
**Addresses:** All Stage 1 table-stakes deliverables from FEATURES.md.
**Avoids:** Pitfall 13 (read-only audit starts fixing things — enforce with a pre-commit hook rejecting any change outside `.planning/`); Pitfall 2 (re-deciding the test runner from the stale codebase map instead of the running suite).

### Phase / Stage 2: Dependency and Runtime Stabilization
**Rationale:** A refactor (Stage 3) on a shifting, unpinned, unreproducible dependency tree is unbisectable; this stage must complete and prove reproducibility before any refactor slice begins.
**Delivers:** Pinned Node/npm (`engines`, `.nvmrc`, CI alignment); `vercel` removed from production dependencies; Next.js patched to the version that closes the July-2026 CVE batch (mandatory regardless of the i18n non-exploitability finding, since most of the 9 CVEs are unrelated to i18n); one consolidated test runner (Jest) with a real `test` script and CI step wired in — closing Pitfall 1 before Stage 3 needs the safety net; Swagger/Redoc resolved; small, individually-gated upgrade batches; a reproducible clean install.
**Uses:** `npm-check-updates`, `ncu -t minor` batching, `jest-environment-jsdom` + testing-library packages.
**Avoids:** Pitfall 4 (Next.js upgrade treated as one checkbox instead of three gated changes), Pitfall 5 (chasing every advisory instead of removing `vercel` first), Pitfall 6 (unpinned toolchain making reproducibility unachievable), Pitfall 18 (exceptions register never actually written — make it a required, mechanically-checked file, not a verbal "we looked at those").

### Phase / Stage 3: Targeted Foundation Refactor (bottom-up, tested vertical slices)
**Rationale:** This is where the architecture researcher's slice order applies directly. Two horizontal foundations (F0a schema/types truth, F0b the seam kit + Playwright persona harness + a minimal deterministic seed) must land before any vertical slice, because a slice cannot refactor a layer that doesn't exist yet. Per the architecture and features research, **pull the Playwright persona harness and a minimal deterministic seed forward to the start of this stage rather than treating them as Stage 4 deliverables** — Stage 3's own requirement to "smoke the Validated workflows after each layer" is otherwise manual, expensive, and easy to skip under time pressure. Auth is deliberately **slice #3, not slice #1**, despite being architecturally the lowest layer: it is the highest blast-radius change in the program, and slices 1–2 (saved events/RSVP, then event read path) exist first specifically to build the working characterization-test harness that would catch an auth mistake before it locks out every user.
**Delivers, per the architecture researcher's recommended order:** F0a (schema/RLS/types reconciliation) → F0b (seam kit + harness + seed) → Slice 1 (saved events + RSVP) → Slice 2 (event read path — settles dual-date schema, tag mapping, fabricated club objects) → Slice 3 (auth/session/ban/onboarding) → Slice 4 (club authorization/membership — collapses 19 hand-rolled checks) → Slice 5 (admin/moderation/service-role containment — closes the two known fail-open endpoints) → Slice 6 (recommendations/interactions/notifications/cron/webhook) → Slice 7 (close-out: delete the blanket cache header now that every route is classified; wire Sentry; sweep remaining console calls).
**Implements:** The three-ring defense-in-depth architecture (`middleware.ts` advisory-only, `src/server/authz/` as Ring 2, RLS as Ring 3), `src/server/` + `src/contracts/` structure, ESLint import-boundary enforcement.
**Avoids:** Pitfall 8 (type generation surfacing 18+ errors and re-adding casts under deadline — gate on a strictly-decreasing `as any` count), Pitfall 9/10 (RLS tests or policy widening that make bypass look like hardening), Pitfall 11 (characterization tests freezing known defects), Pitfall 15 (certifying the timezone fiction instead of deciding the storage contract first), Pitfall 17 (observability added in a form that leaks PII, loses log lines, or checks the wrong things — Sentry needs a Turbopack-aware setup, not a webpack-era guide).

### Phase / Stage 4: Test-Data Certification
**Rationale:** Certification is only credible once Stage 3 has produced a stable, classified, characterized codebase to certify against; this stage extends the Playwright/seed work pulled forward into Stage 3 rather than starting it cold.
**Delivers:** Three seeded datasets (deterministic/functional, adversarial, scale — all local + staging only, never production); the 13-persona × workflow authorization matrix; pgTAP RLS allow/deny per table; E2E coverage of critical workflows; a rehearsed rollback and measured-RTO restore drill with an alert actually observed firing; a written certification report.
**Addresses:** All Stage 4 table-stakes from FEATURES.md, especially the personas most often skipped (expired suspension, mid-onboarding, machine callers with absent credentials).
**Avoids:** Pitfall 14 (synthetic data reaching production via credential ambiguity, moderation-history contamination, or `ADMIN_EMAILS` auto-promotion — require an explicit `--project-ref` and a sentinel-row check the loader refuses to run without), Pitfall 16 (a uniformly-random scale dataset that never exercises the recommendation engine's fallback path or the known `select('*')`-then-filter and load-all-RSVP-rows performance traps).

### Phase Ordering Rationale

- The endpoint/page inventory (Stage 1) is the program's keystone: it is consumed by the cache matrix, the service-role register, the Stage 3 slice plan, and both Stage 4 coverage gates — if done shallowly, three later deliverables degrade silently.
- Generated types gate almost all of Stage 3's layers, since layers 3–9 all touch Supabase queries; doing them before types exist means writing against a type file known to be wrong.
- Stage 2 must not add new runtime dependencies (Zod, logger, Sentry) that Stage 3 will need — that couples "prove the tree is stable" to new surface area; the dependency runs the other way.
- The cache-exposure fix cannot land until every route is classified in Stage 1/early Stage 3 — hence it is deliberately the last vertical slice (Slice 7 / close-out), not an early quick win.

### Research Flags

Needs deeper research during planning (`--research-phase`):
- **Stage 1 cache-exposure proof / Stage 3 cache-policy slice** — the precedence between Next.js's own dynamic-route `no-store` header and `vercel.json`'s config-level header is genuinely ambiguous per the architecture research and flagged MUST-VERIFY-EMPIRICALLY; the roadmap should treat the Stage 1 curl test as a blocking, evidence-producing task before any Stage 3 caching decision.
- **Stage 3 schema/migration reconciliation slice** — 45 migrations across 3 naming schemes, 2 `remote_schema` dumps, and a pg_cron schedule that exists only as a SQL comment mean the reconciliation approach (baseline + repair, never rename) needs careful sequencing against a linked Supabase project; this is inherently a "confirm CLI syntax against the installed version" exercise, not a templated task.
- **Stage 3 auth/session slice (#3)** — the `middleware.ts` → `proxy.ts` migration interacts with the rate limiter's per-instance lifetime and the ban-check fail-open behavior; this is the highest blast-radius slice in the program and should get focused research/discussion before planning.
- **Stage 4 observability/monitoring validation** — "alert actually fired" and "restore drill with measured RTO" are the deliverables most likely to be falsely marked complete; needs explicit acceptance-criteria research per pitfall 17/18.

Phases/slices with standard, well-documented patterns (skip deep research-phase):
- **Stage 2 dependency stabilization** — mechanical: remove `vercel`, patch `next`, batch remaining upgrades; the research already supplies the exact command sequence and package versions.
- **Stage 3 Slice 1 (saved events/RSVP) and Slice 2 (event read path)** — smallest, best-characterized workflows with existing tests to build from; the architecture research already specifies the target shape.
- **Stage 4 dataset generation mechanics** — faker with fixed seeds, pgTAP scaffolding via `supabase test new` — standard patterns, well documented by the Supabase CLI itself.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Nearly every claim (test results, vulnerability counts, version constraints) was produced by running the actual tools against this repo and the npm registry, not inferred from vendor docs; the orchestrator's independently-verified facts (Next 16.2.1 pinned, no i18n config, `vercel@32.3.0` as root cause) align with and reinforce the STACK.md findings without contradiction. |
| Features | MEDIUM-HIGH | Mechanics (Supabase/Vercel/Playwright behavior) are HIGH confidence; the overall program-shape and severity-policy conventions are synthesized from security-audit and legacy-refactor practice rather than a single authoritative source for "how to run a foundation-hardening program," so treat the prioritization matrix as a strong starting point, not gospel. |
| Architecture | HIGH | Every recommendation is anchored to a measurement taken directly from this repo on 2026-09-13 (grep counts, file reads); external framework/platform claims are from official Next.js/Vercel/Supabase docs. One specific caching-precedence question is explicitly flagged as unverified and must be resolved empirically in Stage 1. |
| Pitfalls | HIGH | Explicitly cross-checked against direct repo execution and marked per-claim as repo-verified vs. vendor-doc; no claim relies on the stale six-month-old codebase map without a caveat. |

**Overall confidence:** HIGH, with one explicitly-flagged open empirical question (cache-header precedence) that Stage 1 must resolve by direct production testing rather than reasoning from documentation alone.

### Open Questions the Audit Must Answer

These recur across the research files as items that cannot be resolved without direct evidence-gathering and must be Stage 1 deliverables, not assumptions carried into Stage 3:

- **Does `s-maxage=60` on `/api/*` actually reach personalized responses in production?** Requires a two-session curl test against production (`curl -sI ... -H "Cookie: session A"` then session B, reading `x-vercel-cache` and `age`) — the architecture research explicitly flags this as MUST-VERIFY-EMPIRICALLY; severity is critical-if-confirmed, latent-hazard-if-not.
- **Are the two `/api/cron/*` handlers (`send-reminders`, `send-feedback-requests`) actually triggered?** `vercel.json` has no `crons` key, confirmed by the orchestrator's environment and by grep in both ARCHITECTURE.md and PITFALLS.md. Email reminders are a Validated requirement, so determining whether they are externally scheduled or simply dead is a blocking Stage 1 question.
- **Is `pg_cron`'s `compute_user_scores` schedule actually active anywhere outside production?** The schedule exists only as a commented-out SQL line in a migration ("run this manually in SQL editor"), so any freshly-reset local or staging database silently falls back to the popularity path — Stage 4 could certify a recommendation flow that isn't the production flow unless this is fixed as an idempotent migration in Stage 3.
- **How many of the 92-94 service-role client usages genuinely require RLS bypass?** 22-24 files (plus one page component) use `createServiceClient()`; each needs a yes/no justification recorded in Stage 1's register, since the count is the headline metric for Stage 3's admin/moderation slice.
- **Are Swagger UI and Redoc (both shipped) actually reachable from any production route, or dead weight?** `knip` can answer this mechanically in Stage 1; it determines whether Stage 2 removes one, both, or neither.
- **Does the `events` table's production schema actually use the dual `start_date`/`end_date` vs `event_date`/`event_time` fields, and which is authoritative?** Must be resolved by querying `information_schema.columns` on production directly — not by trusting the types file, which is the artifact under suspicion — before Stage 3's event-read-path slice can settle the schema.
- **Do the `internal/` (separate Vite app) and `backend/` (legacy Python) directories stay in the repo?** Both are committed, excluded from `tsconfig`, and absent from CI. Stage 1 must decide: own them (add to CI) or archive them — leaving them half-present is exactly how stale documentation accumulates.

## Sources

### Primary (HIGH confidence)
- Direct repository execution 2026-09-13 (npm audit, npx jest, npm ls, grep/find across `src/`, direct reads of `package.json`, `jest.config.js`, `vitest.config.ts`, `vercel.json`, `next.config.js`, `src/middleware.ts`, migrations) — the basis for nearly every quantitative claim in STACK.md, ARCHITECTURE.md, and PITFALLS.md
- Orchestrator-verified facts (2026-09-13): `npx jest` passes 220/256 tests across 16/21 suites; no `i18n` config in `next.config.js`; `next@16.2.1` pinned in lockfile; `vercel@32.3.0` in production dependencies as the primary audit-finding root cause
- nextjs.org official docs and blog (CVE advisories, `route.js` reference, upgrade guide, React version policy) — HIGH per vendor-doc classification
- vercel.com official docs (CDN caching criteria, header precedence, instant rollback) — HIGH
- supabase.com official docs (RLS, migrations, pgTAP testing, production checklist) — HIGH
- npm registry metadata (`npm view` for ~35 packages: versions, engines, peerDependencies) — HIGH

### Secondary (MEDIUM confidence)
- Community pgTAP/RLS-testing guides (Blair Jordan, Basejump) — corroborated by official Supabase docs
- `.planning/codebase/{ARCHITECTURE,CONCERNS,TESTING,STRUCTURE,INTEGRATIONS}.md` (dated 2026-03-05) — treated throughout as leads to re-verify, not facts; several claims are demonstrably stale (hand-written types, a live Jest/Vitest split) and this is itself a key finding, not just a caveat

### Tertiary (LOW confidence, flagged for re-verification)
- Secondary-source coverage of the August 2026 Next.js release (AVIF RCE, CVE-2026-75604) — should be confirmed against the official advisory before citing in `FOUNDATION_AUDIT.md`
- Sentry/Supabase CLI setup and flag-syntax detail sourced from vendor docs via WebFetch — version numbers are HIGH confidence (registry-verified) but exact CLI flags should be re-checked with `--help` at install time

---
*Research completed: 2026-09-13*
*Ready for roadmap: yes*
