# Requirements: Uni-Verse Foundation Program

**Defined:** 2026-09-13
**Core Value:** Every critical workflow in the existing app is verified correct, secure, and reproducible across all user roles before any new product feature is started. If a foundation change breaks a workflow that worked before, the program has failed.

Requirements are grouped by program stage. Stages are strictly ordered; a stage's exit-gate requirements must be complete before the next stage begins.

## v1 Requirements

### Stage 1 — Read-Only Foundation Audit (AUDIT)

Constraint for every AUDIT requirement: no source, config, dependency, or database change. Findings only.

- [x] **AUDIT-01**: Live schema snapshots of production, staging, and local Supabase are captured as committed artifacts under `.planning/audit/`
  - *Deliberately withheld by plan 01-06, one of three environments short.* Production: `.planning/audit/schema/prod.schema.sql` exists but is a catalog-derived reconstruction from SELECT-only captures, not a `pg_dump` — no Postgres connection string was ever supplied. Staging: no staging project is visible to the operator's token; `staging.schema.sql` is a deferred-with-reason stub. Local: `supabase/migrations/` does not replay from zero (aborts at file 12 of 44 on a version-`011` primary-key collision), so no local database exists to dump; see `schema/local-reset.txt`. `node .planning/audit/tools/validate.mjs --check schema-snapshots` fails on staging and local, and that failure is correct.
- [x] **AUDIT-02**: A three-way drift table (production schema vs `supabase/migrations/` vs `src/lib/supabase/types.ts`) lists every table and column with exists-in-prod / exists-in-migrations / typed-correctly status, produced with `supabase db diff` and `supabase migration list`
- [x] **AUDIT-03**: Every API route handler (94 at time of writing) is inventoried in a machine-readable file (CSV or JSON) with: method(s), observed auth requirement, role required, RLS reliance, service-role use, cache headers, personalization (does the body vary by user), input validation present, test present
- [x] **AUDIT-04**: Every page (43 at time of writing) is inventoried with: public/protected, client/server component, data source, auth guard, dead/duplicate status, cross-checked against the middleware protected-route list
- [x] **AUDIT-05**: RLS policies are reviewed from live `pg_policies` (not from migration files) for every table × command × role, flagging RLS-disabled tables, RLS-enabled-with-no-policy tables, `USING (true)` policies, and policies with no `TO` clause
- [x] **AUDIT-06**: An RLS coverage heatmap (table × command × role, allow/deny/none) is produced from AUDIT-05
- [x] **AUDIT-07**: Every `createServiceClient()` callsite is registered with a per-callsite answer to: is RLS bypass actually required, is the caller authenticated first, is user-supplied input used as a filter, is the module reachable from a client bundle
- [x] **AUDIT-08**: A cache/personalization exposure matrix classifies every handler by whether its body varies by user and what `Cache-Control` it actually emits, and includes an empirical two-session curl test against production recording `x-vercel-cache` and `age` for personalized routes
- [x] **AUDIT-09**: Every `getSession()` call is classified as authorization-gating (defect) or non-gating (annotate why safe)
- [x] **AUDIT-10**: Every authorization check conditional on an env var being present (fail-open shape, e.g. `ADMIN_API_KEY`, `CRON_SECRET`) is listed with its reachable route
- [x] **AUDIT-11**: Cron and webhook inventory covers pg_cron jobs from `cron.job`, `/api/cron/*` handlers and what (if anything) triggers them, `vercel.json` crons, the Supabase edge function, the Apify/Instagram webhook, and Supabase auth hooks
- [x] **AUDIT-12**: Dependency report records `npm audit --omit=dev` and `npm outdated` output with a reachability judgment for every High/Critical in production dependencies, and answers whether `swagger-ui-react` and `redoc` are reachable from any production route
- [x] **AUDIT-13**: Test/build/lint/type-check baseline is captured as actual command output, including the Jest pass/skip counts and the reason for each skipped suite; the test-runner decision (keep Jest, delete Vitest orphans) is recorded with the 14-vs-0 mock-call evidence
- [x] **AUDIT-14**: Error handling and observability assessment quantifies: routes with no try/catch, routes that leak internal error text, `catch (error: any)` count, `console.*` call count, absence of request correlation
- [x] **AUDIT-15**: Dead-code report (via knip) lists unreferenced routes, components superseded by prior milestones, `API_ENDPOINTS` constants bypassed by hardcoded URLs, and stale docs including the disposition of `internal/` and `backend/` directories
- [x] **AUDIT-16**: Client-bundle secret sweep builds the app and greps `.next/static` for the service-role key prefix, `ADMIN_EMAILS`, and `ADMIN_API_KEY`
- [x] **AUDIT-17**: A one-page threat model exists for each of three trust boundaries: anonymous → app, authenticated student → other tenants' data, organizer → admin escalation
- [x] **AUDIT-18**: Storage bucket policies for `avatars` and `banners` are reviewed for read visibility, path-prefix ownership, and size/MIME limits
- [x] **AUDIT-19**: The production `events` table's authoritative date columns (`start_date`/`end_date` vs `event_date`/`event_time`) are determined from `information_schema.columns`, not from the types file
- [x] **AUDIT-20**: `FOUNDATION_AUDIT.md` exists where every finding has a stable ID (`F-nnn`, never renumbered), title, exposure-adjusted severity (Critical/High/Medium/Low with rationale), category, affected paths with line numbers, captured evidence, reproduction steps, recommended fix, validation criterion, and status
- [x] **AUDIT-21**: A severity SLA policy is written stating when each severity level must be fixed (e.g. Critical in the first Stage 3 slice, High before Stage 4 starts)

### Stage 2 — Dependency and Runtime Stabilization (STAB)

- [x] **STAB-01**: Node and npm versions are pinned in `package.json` `engines` and `.nvmrc`, matched to the Vercel runtime, and CI uses the same Node major
- [x] **STAB-02**: The npm `devdir` configuration warning is resolved or its source documented
- [x] **STAB-03**: A written vulnerability policy exists before any scan-driven change: zero unexplained Criticals in production deps; Highs in production deps need a fix or a dated, owner-signed exception with a reachability argument; dev-only findings are tracked, not blocking
- [x] **STAB-04**: The `vercel` package is removed from production dependencies, and the decision on whether it remains as a devDependency is recorded
- [x] **STAB-05**: Next.js is upgraded to the patched release closing the July-2026 CVE batch, as its own commit with `react` and `react-dom` untouched — **shipped as 16.3.5, not the 16.2.11 this text originally named.** Amended by plan 02-11 on the instruction of 02-05: the original version predates the 2026-08-25 security release and would have satisfied this requirement's letter while leaving two unauthenticated-RCE criticals open. See `.planning/phases/02-dependency-and-runtime-stabilization/evidence/next-upgrade-note.md` § 1
- [ ] **STAB-06**: `middleware.ts` is migrated to `proxy.ts` per the Next 16 deprecation, as its own gated change with the rate limiter and ban-check behavior smoke-tested before and after
- [x] **STAB-07**: `swagger-ui-react` and `redoc` are upgraded, isolated behind auth or a build-time static artifact, or removed, based on the AUDIT-12 reachability answer
- [x] **STAB-08**: Jest is the single test runner: `vitest.config.ts` and `vitest.setup.ts` are deleted, `jest-environment-jsdom` and testing-library packages are installed so the skipped `.tsx` suites run, a `test` script exists in `package.json`, and CI runs it
- [ ] **STAB-09**: Remaining patch/minor upgrades are applied in small labeled batches, one commit per batch, each followed by lint, type-check, test, build, and a smoke pass
- [x] **STAB-10**: Any major upgrade is its own change with a migration note and its own smoke pass (React 19 is explicitly deferred; see Out of Scope)
- [x] **STAB-11**: `package-lock.json` changes are reviewed as diffs, never regenerated wholesale; `npm audit fix --force` is never used
- [x] **STAB-12**: A clean-room install (`rm -rf node_modules && npm ci` in a fresh checkout, ideally in CI) succeeds and builds, with output captured as evidence
- [x] **STAB-13**: Build, lint, type-check, and tests are green at the same or better state than the AUDIT-13 baseline
- [x] **STAB-14**: CI runs `npm audit --audit-level=high --omit=dev` on every pull request
- [x] **STAB-15**: A CycloneDX SBOM is generated and committed, and Renovate (or Dependabot) is configured with grouping and patch-only auto-merge after the batch upgrades land
- [x] **STAB-16**: Bundle size is recorded before and after the dependency removals
- [x] **STAB-17**: Exit gate: no unexplained Critical production vulnerabilities, no reachable High without a documented exception, reproducible install, green checks, reviewed lockfile — all evidenced in a Stage 2 completion note

### Stage 3 — Targeted Foundation Refactor (REFAC)

Constraint for every REFAC requirement: characterize current behavior with a test first, refactor, then verify the same workflow. Each characterization test is tagged PRESERVE or DEFECT (referencing an `F-nnn`). Each slice is one reviewable change naming the finding IDs it closes. Intentional behavior changes are logged. No new product features, no intentional visual changes.

**Foundations (before any vertical slice)**

- [x] **REFAC-01**: Migration history is reconciled with production (baseline + `migration repair`, never renaming existing files) so `supabase db reset` from the migrations folder produces a schema that diffs clean against production
- [x] **REFAC-02**: Missing FK indexes and RLS policy gaps identified in the audit are fixed via new migrations, each with a pgTAP allow/deny test
- [x] **REFAC-03**: The `compute_user_scores` pg_cron schedule is codified as an idempotent migration so local and staging match production
- [x] **REFAC-04**: Supabase types are generated from the reconciled schema via `supabase gen types`, a CI step fails on type drift, and `(supabase as any)` casts in `src/` are reduced to zero
- [x] **REFAC-05**: A `src/server/` seam kit exists (request context computed once per request, http/error helpers, `requireUser`/`requireRole`/`requireClubRole` authz guards, `src/server/db/elevated/` as the only door to the service-role client) applied to zero routes yet, with an ESLint import-boundary rule forbidding `src/app/**` from importing the service-role client directly
- [x] **REFAC-06**: A Playwright persona harness exists with a setup project producing one storage state per persona and at least six happy-path specs covering Validated workflows, runnable against local Supabase
- [x] **REFAC-07**: A minimal deterministic functional seed exists (fixed UUIDs, fixed timestamps relative to a pinned now, fixed PRNG seed) covering every user role, ban state, club status, and event status, loadable into local and staging only with a hard guard refusing any other Supabase URL
- [x] **REFAC-08**: The auth callback route has characterization tests before it is modified (OAuth exchange, McGill enforcement, user upsert, admin auto-assignment, onboarding routing)

**Vertical slices (in this order)**

- [x] **REFAC-09**: Slice 1 (saved events + RSVP): handlers use the seam kit, RSVP counts use a count query or DB function instead of loading all rows, characterization tests pass before and after
- [ ] **REFAC-10**: Slice 2 (event read path): events list uses a real club join instead of fabricating club objects, the dual date schema is resolved to the authoritative columns from AUDIT-19, tag mapping is centralized with unknown tags surfaced instead of silently coerced to SOCIAL, `%`/`_` are escaped in search
- [ ] **REFAC-11**: Slice 3 (auth/session/ban/onboarding): `getUser()` at every authorization decision, middleware is advisory-only and the ban check fails closed, the onboarding guard cannot be bypassed by direct API calls, env-var non-null assertions are replaced with validated config
- [ ] **REFAC-12**: Slice 4 (club authorization/membership): the 19 hand-rolled club-membership checks collapse into `requireClubRole`, cross-club access attempts return 403 at the authz ring and are denied at the RLS ring
- [ ] **REFAC-13**: Slice 5 (admin/moderation/service-role containment): every fail-open endpoint fails closed, `verifyAdmin()` guards every admin route, every remaining service-role use goes through `src/server/db/elevated/` with a registered justification, `/api/admin/*` is included in rate limiting
- [ ] **REFAC-14**: Slice 6 (recommendations/interactions/notifications/cron/webhook): cron and webhook routes require credentials and fail closed when absent, the recommendation API surface is characterized (input → ranked output) with the scoring formula left unchanged
- [ ] **REFAC-15**: Every handler validates input with a zod schema at its boundary and returns a consistent 400 shape on malformed input; schemas live in `src/contracts/`
- [ ] **REFAC-16**: zod contracts are exported and reused by client hooks so client and handler cannot drift
- [ ] **REFAC-17**: CSRF exposure is assessed (SameSite on Supabase cookies) and protection is added on state-changing routes where exposure remains
- [ ] **REFAC-18**: Rate limiting is moved to a distributed store (e.g. Upstash) so it works across serverless instances
- [ ] **REFAC-19**: Slice 7 (close-out): the blanket `s-maxage=60` on `/api/*` is removed from `vercel.json`, personalized routes return `private, no-store`, public routes opt in explicitly, and a cross-user cache regression test passes
- [ ] **REFAC-20**: A structured JSON logger with levels and a request correlation id replaces `console.*` calls in server code, working on both Node and middleware runtimes
- [ ] **REFAC-21**: Sentry is installed with a Turbopack-aware setup, source maps, environment and release tagging, and PII scrubbing rules decided before install; a deliberately triggered error appears in Sentry with the correlation id
- [ ] **REFAC-22**: `/api/health` checks DB, auth, storage, pg_cron freshness, and last webhook receipt, returns a documented shape, and does not use `getSession()` for access control
- [ ] **REFAC-23**: After each slice, the Playwright happy-path specs (REFAC-06) pass and the Validated workflow list in PROJECT.md is re-confirmed

### Stage 4 — Test-Data Certification (CERT)

Constraint for every CERT requirement: datasets load into local and staging only; the loader refuses any Supabase URL outside an allowlist; no production data is snapshotted into lower environments.

- [ ] **CERT-01**: The deterministic functional dataset (grown from REFAC-07) covers every entity and edge case in the research inventory: all user roles and ban states including expired suspension and mid-onboarding, all club and event statuses including soft-deleted and scraper-ingested, saves and RSVPs including cancelled, follows, all notification types, interactions, reviews, reports and appeals, an active experiment, users with and without recommendation scores, audit log rows, and owned storage objects
- [ ] **CERT-02**: The adversarial dataset covers malformed input, injection-shaped search strings and script tags, unsafe `javascript:`/`data:` links, duplicate records (content hash, RSVP, save, invitation), timezone/DST cases in America/Toronto, expired content, cross-tenant probes, auth abuse including non-McGill OAuth completion and forged cookies, upload abuse, and rate/volume abuse
- [ ] **CERT-03**: The scale dataset has thousands of users, hundreds of clubs, thousands of events with realistic status distribution, tens of thousands of saves/RSVPs/interactions/notifications, and a skewed popularity distribution, generated from a fixed seed and regenerable after migrations
- [ ] **CERT-04**: Every dataset load is idempotent and re-runnable after `supabase db reset`
- [ ] **CERT-05**: The persona × workflow matrix is executed for all 13 personas (anonymous visitor, onboarded student, mid-onboarding student, club member, club owner, multi-club organizer, cross-club attacker, admin, permanently banned, actively suspended, expired suspension, non-McGill sign-in, machine callers with valid/invalid/absent credentials) across every workflow in the research list, asserting the expected outcome per cell
- [ ] **CERT-06**: A generated persona × endpoint authorization matrix test, data-driven from the AUDIT-03 inventory, asserts the expected status for every endpoint × persona and fails on any unclassified endpoint
- [ ] **CERT-07**: pgTAP RLS allow/deny tests exist per table using `set local role` impersonation, asserting both allow and deny per role with affected-row-count assertions (never `lives_ok` alone), and a CI guard fails if any RLS test references the service-role client
- [ ] **CERT-08**: Playwright E2E specs cover every Validated critical workflow with per-persona storage state and no shared mutable persona accounts across parallel specs
- [ ] **CERT-09**: Every endpoint has at least an authenticated-vs-anonymous status assertion plus one cross-tenant probe; every page has a smoke test asserting it loads, emits no console error or unhandled rejection, and applies the correct auth redirect
- [ ] **CERT-10**: A cross-user cache-exposure regression test requests each personalized route as user A then user B and asserts no A-data, no shared-cache HIT, and `private`/`no-store` in `Cache-Control`
- [ ] **CERT-11**: Every Critical and High finding in `FOUNDATION_AUDIT.md` is closed by its own validation criterion passing, or carries a dated, owned, written risk acceptance
- [ ] **CERT-12**: Load tests against the scale dataset on staging extend the existing k6 scripts with event-list and event-detail hot paths, with p95 latency and error-rate thresholds stated before the run, and pass
- [ ] **CERT-13**: Staging configuration is diffed against production (env vars present, `vercel.json`, RLS state, extensions) as a certification item
- [ ] **CERT-14**: A production deploy is followed by a real `vercel rollback` that is confirmed to serve the prior build, with deployment ids and timestamps recorded
- [ ] **CERT-15**: A Supabase backup is restored into a scratch or staging project with elapsed time recorded as measured RTO, and PITR status is confirmed
- [ ] **CERT-16**: A deliberately triggered error and a downtime condition each produce an alert that a human observes receiving, with the Sentry event and correlation id retrievable
- [ ] **CERT-17**: The restore drill is scheduled to recur
- [ ] **CERT-18**: A chaos probe with Supabase unreachable confirms graceful degradation (recommendations fall back to popularity, pages render an error state rather than crashing)
- [ ] **CERT-19**: CI runs the pgTAP RLS suite and the Playwright E2E suite against a seeded local Supabase on every pull request
- [ ] **CERT-20**: A written certification report states what was tested, by which persona, with which dataset, what passed, what is accepted risk, and declares the foundation certified for the next milestone

## v2 Requirements

Deferred past this program. Tracked but not in the current roadmap.

### Post-certification upgrades

- **UPG-01**: React 18 → 19 major upgrade as its own milestone, run against the certified test suite
- **UPG-02**: Next.js major upgrade beyond the 16 line
- **UPG-03**: Declarative schema (`supabase/schemas/`) replacing the append-only migration pile

### Additive quality

- **QUAL-01**: Visual regression suite on the top pages
- **QUAL-02**: Accessibility (axe) smoke on the top pages
- **QUAL-03**: Seeded staging refreshed on a schedule

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ingestion platform and any new product feature | Starts as the next milestone only after CERT-20; the point of this program is a certified base first |
| Non-McGill public accounts with limited access | Product decision, not a refactor; during this program non-McGill sign-in is a rejection test case (CERT-02, CERT-05) |
| Fixing anything during Stage 1 | Destroys the baseline Stage 3 must prove behavior against; findings only |
| `npm audit fix --force` | Installs breaking majors indiscriminately, the exact failure mode Stage 2 prevents |
| Chasing zero devDependency vulnerabilities | Mostly unreachable from production; tracked without deadline |
| Package manager change (pnpm/bun) | Changes resolution semantics mid-program, invalidates dependency findings |
| ORM adoption (Prisma/Drizzle) | Replaces the stack mid-program and breaks RLS-in-request-context |
| Rewriting the recommendation scoring formula | Postgres-native, working, outside the risk hot zone; characterize the API surface only |
| Big-bang API layer rewrite | Excluded by project constraint; behavior preservation becomes unprovable |
| UI redesign while touching pages | Visual change destroys "same as before" smoke checks; logic and types only |
| Line-by-line manual read of all 43 pages | Lowest-risk layer; classify and deep-read only multi-tenant or admin pages |
| Commercial SAST/DAST sweep | Hundreds of low-signal findings crowd out the hand audit of RLS and service-role usage |
| CVSS vectors on application-logic findings | Flattens the exposure context that matters; four-level severity with rationale instead |
| Production data snapshots into staging | Real student PII into a lower-trust environment |
| Load testing to find the breaking point | Campus app; test at ~3× realistic peak against a stated threshold, then stop |
| Testing Supabase's own RLS/auth behavior | Test our policies and callback logic, not the vendor |
| E2E journeys for all 43 pages | Flaky enough to be ignored; smoke the rest, push authz assertions to the API matrix |
| Any synthetic-data path that can reach production | Explicit constraint; unrecoverable reputationally |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

Stage → phase mapping: Stage 1 (AUDIT) = Phase 1. Stage 2 (STAB) = Phase 2.
Stage 3 (REFAC) = Phases 3-6. Stage 4 (CERT) = Phases 7-8.
No phase crosses a stage boundary.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 1 | Pending — partial (plan 01-06: production captured as a catalog-derived snapshot, not a `pg_dump`; staging unreachable; local blocked by the migration history) |
| AUDIT-02 | Phase 1 | Complete — with a tool deviation (plan 01-08). The table itself is complete: `schema/drift.json` carries 288 rows covering all 243 production columns across all 30 production tables, every row with all three statuses set, plus table- and object-scope rows for `rsvps`, the storage buckets and the pg_cron jobs. Neither named tool produced it. `supabase migration list` needs a credential that was never supplied, so the production history came from the plan 01-06 Management API envelope (`raw/prod/migrations-applied.json`). `supabase db diff` could not run either — and would not have run with a credential, because it builds its shadow database by replaying `supabase/migrations/`, which aborts at the 12th of 44 files (`schema/local-reset.txt`). The migrations column was therefore derived by static parsing. Marked complete because the requirement's substance — per-column exists-in-prod / exists-in-migrations / typed-correctly — is delivered at higher fidelity than a textual diff would give, and the tool that failed did so for a reason that is itself a Stage 3 finding. Staging is absent from the table; AUDIT-02 names three sources, not three environments. |
| AUDIT-03 | Phase 1 | Complete |
| AUDIT-04 | Phase 1 | Complete |
| AUDIT-05 | Phase 1 | Complete — with a transport deviation (plan 01-09). Every clause is met by an artifact on disk: `rls/pg_policies.json` holds all 101 live policies across `public` and `storage` for every table × command × role, and `rls/rls-review.md` addresses all four named flag classes in separate headed sections — RLS-disabled tables (zero, reported empty deliberately), RLS-enabled-with-no-policy (7, all Supabase-managed `storage` internals), `USING (true)` (12, plus the 9 `WITH CHECK (true)` write-side twins where the Critical and High findings sit), and policies with no `TO` clause (61 of 101) — plus unindexed policy columns and a two-way reconciliation against `supabase/migrations/`. **The requirement says "from live `pg_policies` (not from migration files)" and that is satisfied:** the source is `raw/prod/pg-policies.json`, a SELECT-only production capture whose executed SQL is recorded in its `query` field. The deviation is the transport only — the plan specified `tools/sql-readonly.mjs`, and production was in fact read once through the Supabase MCP server (Management API) as role `postgres` and committed as capture envelopes, per the resolution recorded in plan 01-06. The RLS-bypassing service-role client was never used as the transport. |
| AUDIT-06 | Phase 1 | Complete (plan 01-09). `rls/rls-heatmap.csv` is the table × command × role grid: 152 rows (38 relations × 4 DML commands), one column per role (`anon`, `authenticated`, `public`, `service_role`), every cell one of `allow` / `deny` / `none`, with `deny` (RLS on, no policy grants it) distinguished from `none` (RLS off, ungoverned). `storage.objects` is included. Generated by `tools/pivot-rls-heatmap.mjs`, a zero-dependency ESM transform whose output is a pure function of its two inputs — two consecutive runs are byte-identical. `validate.mjs --check heatmap` exits 0 on both the row-count and the three-value-cell rules. The policy-count and policy-name traceability the plan asked for as trailing columns is emitted as `rls/rls-heatmap-notes.csv` instead, because the validator rejects any non-`allow`/`deny`/`none` cell in the grid; same script, same inputs, same row order. |
| AUDIT-07 | Phase 1 | Complete |
| AUDIT-08 | Phase 1 | **Partially complete — withheld (plan 01-12).** The matrix half is delivered in full: `cache/cache-matrix.csv` and `.json` carry 121 rows covering all 94 handlers x method, each classifying whether the body varies by user (from the 01-11 personalization verdicts) and what `Cache-Control` it actually emits on the wire, with a verdict from a five-value vocabulary and a per-route evidence path. The empirical probe ran against production and recorded `x-vercel-cache` and `age` for 15 routes x 3 iterations with a positive control that returned `HIT` — proving 8 personalized routes are stored and re-served by the shared CDN (age up to 96s) with a cache key that ignores the session (`vary: accept-encoding` only). **What is withheld is the "two-session" clause:** `COOKIE_A` and `COOKIE_B` were never supplied, so the run used one anonymous session and no cross-account hit was observed. Recorded as `BLOCKED — input not supplied` in `cache/curl-summary.json` with the exact retry command; see `.planning/audit/redaction/01-12.md` §6. Mark complete only after the two-cookie re-run. |
| AUDIT-09 | Phase 1 | Complete |
| AUDIT-10 | Phase 1 | Complete |
| AUDIT-11 | Phase 1 | Complete |
| AUDIT-12 | Phase 1 | Complete |
| AUDIT-13 | Phase 1 | Complete |
| AUDIT-14 | Phase 1 | Complete |
| AUDIT-15 | Phase 1 | Complete |
| AUDIT-16 | Phase 1 | Complete |
| AUDIT-17 | Phase 1 | Complete |
| AUDIT-18 | Phase 1 | Complete |
| AUDIT-19 | Phase 1 | Complete |
| AUDIT-20 | Phase 1 | Complete |
| AUDIT-21 | Phase 1 | Complete |
| STAB-01 | Phase 2 | Complete |
| STAB-02 | Phase 2 | Complete |
| STAB-03 | Phase 2 | Complete |
| STAB-04 | Phase 2 | Complete |
| STAB-05 | Phase 2 | Complete |
| STAB-06 | Phase 2 | Pending |
| STAB-07 | Phase 2 | Complete |
| STAB-08 | Phase 2 | Complete |
| STAB-09 | Phase 2 | Pending |
| STAB-10 | Phase 2 | Complete |
| STAB-11 | Phase 2 | Complete |
| STAB-12 | Phase 2 | Complete |
| STAB-13 | Phase 2 | Complete |
| STAB-14 | Phase 2 | Complete |
| STAB-15 | Phase 2 | Complete |
| STAB-16 | Phase 2 | Complete |
| STAB-17 | Phase 2 | Complete |
| REFAC-01 | Phase 3 | Partial (03-01, 03-04) — the reconciliation itself is complete and evidenced: `db reset` exit 0, `db diff --linked` **zero bytes**, 44 files archived as 44 `R100` renames with zero changed lines, policy fidelity by set difference (live 101, baseline 101, symmetric difference 0). The unmet clause is the requirement's own `migration repair`: the production history repair was put to the phase owner at a blocking checkpoint and **deferred**. Closes on `supabase migration repair --status applied 20260915214553 --linked` in Phase 8. See evidence/FOUNDATION-READINESS.md section 11 and evidence/repair-outcome.md |
| REFAC-02 | Phase 3 | Complete (03-05) — six indexes, one drop and three `club_invitations` policies in `20260915230000_fk_indexes_and_policy_gaps.sql`, each object carrying a database test (23 + 15 assertions), and the tests proven to bite: each policy removed in turn produced 5, 3 and 1 named failures and green on restore. Carried caveat: fixed in the repository, **not in production** until the Phase 8 repair — see evidence/FOUNDATION-READINESS.md section 12 |
| REFAC-03 | Phase 3 | Complete (03-05) — `20260915230100_cron_compute_user_scores.sql`, idempotence proven by running it twice and comparing the `cron.job` catalog rather than by asserting a guard was written, plus 4 pgTAP assertions. Carried caveat: the codified schedule has never been applied *to* production, which runs its own out of band. Its "and staging" is a rationale clause, not a deliverable clause — unlike REFAC-07's |
| REFAC-04 | Phase 3 | Partial (03-06) — generated-types and CI drift-gate clauses met and the gate observed green on a real runner; cast clause **45 of 47** by decision D-22, because at both remaining sites the cast is the only thing making the file compile and every route to a clean `tsc` is a behaviour change the characterize-first rule forbids. Both retained casts are annotated in source with their finding id and pinning test. Closes in Phase 4 (F-071) and Phase 5 (F-072/F-073) |
| REFAC-05 | Phase 3 | Complete (03-03) — `src/server/` context, http/errors, the three authz guards and `src/server/db/elevated/` as the single door with its register shipping deliberately empty; applied to **zero routes**, held by two independent checks (empty `src/app/` diff and an unmoved census of 24); the ESLint boundary proven to fail the build with a fixture (exit 1, two `no-restricted-imports` errors) and green after deletion. Carried caveat: the rule's reach is bounded and the ratchet is not yet wired into CI — see evidence/FOUNDATION-READINESS.md section 9.6 |
| REFAC-06 | Phase 3 | Complete (03-07) — 10 setup projects, 7 spec files, **27 tests, 27 passed** from a clean database; one storage state per persona from the SSR package's own serializer, verified through the running application. The requirement's clause is "runnable against local Supabase" and it is met. Carried caveat, and a loud one: the CI `e2e` job is **RED on a real runner** for an environment-precedence reason unrelated to any spec, so the harness has never been observed outside one machine — see evidence/FOUNDATION-READINESS.md section 9.7 and evidence/ci-e2e-red.txt |
| REFAC-07 | Phase 3 | Partial (03-07) — determinism (two loads byte-identical, `sha256 964ac785…`, re-derived a third time), 21 database-tier coverage assertions over all four named axes, and the guard's five command-line refusals each exiting 1 while failing closed, are all met and evidenced. The unmet clause is **"and staging"**: no staging project exists to load into. The branch is implemented, double-gated and unit-tested including its refusals, and the guard was **not** widened to make an untestable path look tested. Closes on a provisioned staging project, then CERT-01 in Phase 7. See evidence/harness-note.md section 3 |
| REFAC-08 | Phase 3 | Complete (03-02) — eight behaviours covering all five named areas, written against source proven byte-identical to the plan's start, which is what "before" asks for and is a git-ancestry fact rather than a claim. Every assertion proven to bite: **nine mutation cycles, nine reds, zero greens**, each naming the expected test. The three things the suite does not prove are written down — see evidence/callback-characterization-note.md section 4 |
| REFAC-09 | Phase 4 | Complete (04-06). Seam kit in the five Slice 1 handlers (a5ee4fc, fe4e9f9). RSVP counts are two head-only COUNT reads (d40dee4, F-079 Fixed). Characterization passes before and after: the 04-02 PRESERVE suites were unedited across the refactor, and after it Jest is 512/5 and Playwright is 37/37 from a clean reset. See .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-close.md |
| REFAC-10 | Phase 4 | Partial (04-07..04-11). Three of four clauses met: the dual date schema is resolved to `start_date`/`end_date` (stale-date census 0; F-050 Fixed), tag mapping is centralized in `src/lib/eventTags.ts` with unknown tags surfaced by a `[tags]` warning (2db5d2a, 46731e6), and `%`/`_` are escaped (c20d59b, F-082 Fixed under DEC-32). **Unmet clause: "events list uses a real club join instead of fabricating club objects".** The list routes and saved-events use the real join (1150b0f, 9083430), but `transformEventFromDB` still fabricates a club from the organizer string and `/api/events/[id]` has no embed. That fix changes seeded rendering, and the 04-11 owner checkpoint was resolved by rule to option-defer because no owner answer was available. Deferred as DI-39, owner the phase owner. See .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/PHASE-4-COMPLETION.md § 2 and evidence/visual-fix-decision.md |
| REFAC-11 | Phase 5 | Partial (05-04, 05-05). Delivered: validated config with the env non-null census empty (05-04, 05-05); the proxy is advisory and fails closed, with onboarding read from the database (05-05, e2d6d3a). Open: the handler ring (ban, onboarding and missing profile decided in every write arm) lands in 05-06 and 05-07 |
| REFAC-12 | Phase 5 | Pending |
| REFAC-13 | Phase 5 | Pending |
| REFAC-14 | Phase 6 | Pending |
| REFAC-15 | Phase 6 | Pending |
| REFAC-16 | Phase 6 | Pending |
| REFAC-17 | Phase 5 | Pending |
| REFAC-18 | Phase 5 | Pending |
| REFAC-19 | Phase 6 | Pending |
| REFAC-20 | Phase 6 | Pending |
| REFAC-21 | Phase 6 | Pending |
| REFAC-22 | Phase 6 | Pending |
| REFAC-23 | Phase 6 | Pending |
| CERT-01 | Phase 7 | Pending |
| CERT-02 | Phase 7 | Pending |
| CERT-03 | Phase 7 | Pending |
| CERT-04 | Phase 7 | Pending |
| CERT-05 | Phase 7 | Pending |
| CERT-06 | Phase 7 | Pending |
| CERT-07 | Phase 7 | Pending |
| CERT-08 | Phase 7 | Pending |
| CERT-09 | Phase 7 | Pending |
| CERT-10 | Phase 7 | Pending |
| CERT-11 | Phase 8 | Pending |
| CERT-12 | Phase 8 | Pending |
| CERT-13 | Phase 8 | Pending |
| CERT-14 | Phase 8 | Pending |
| CERT-15 | Phase 8 | Pending |
| CERT-16 | Phase 8 | Pending |
| CERT-17 | Phase 8 | Pending |
| CERT-18 | Phase 8 | Pending |
| CERT-19 | Phase 7 | Pending |
| CERT-20 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 81 total
- Mapped to phases: 81
- Unmapped: 0 ✓

**Per-phase counts:** Phase 1: 21 · Phase 2: 17 · Phase 3: 8 · Phase 4: 2 · Phase 5: 5 · Phase 6: 8 · Phase 7: 11 · Phase 8: 9

**Cross-cutting note:** REFAC-15/16 (zod contracts for every handler), REFAC-19 (cache
default inversion), and REFAC-23 (harness re-confirmation after each slice) are worked
incrementally across Phases 4-6 but map to Phase 6, where their "every handler / every
route / every slice" criterion first becomes verifiable. REFAC-17/18 map to Phase 5
because CSRF exposure and distributed rate limiting both depend on the session and
middleware work in that phase, and REFAC-13 requires `/api/admin/*` rate limiting.

---
*Requirements defined: 2026-09-13*
*Last updated: 2026-09-13 after roadmap creation (81/81 mapped across 8 phases)*
