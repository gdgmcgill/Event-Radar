# Feature Research

**Domain:** Foundation audit / stabilize / refactor / certify program for an existing Next.js 16 App Router + Supabase + Vercel application (Uni-Verse, campus event discovery)
**Researched:** 2026-09-13
**Confidence:** MEDIUM-HIGH (Supabase/Vercel/Playwright mechanics HIGH; program-shape and severity-policy conventions MEDIUM — synthesized from security-audit and legacy-refactor practice, not a single authority)

## How To Read This Document

"Features" here are **deliverables and checks of each program stage**, not product features.

- **Table stakes** — omit it and the stage's exit gate is not credible. A reviewer would say "you didn't actually audit/stabilize/certify this."
- **Differentiators** — extra rigor. Real value, but the gate can pass without them. Candidates for "do it if the stage has room."
- **Anti-features** — look rigorous, cost a lot, and either waste effort or add risk. Deliberately out of scope.

Complexity is effort for *this* codebase: 92 API route handlers, 43 pages, 45 migrations across 3 naming schemes, ~28 tables, 2 storage buckets, 2 test runner configs, 0 Sentry, 0 `test` script.

Concrete anchors used throughout: tables `events`, `clubs`, `users`, `club_members`, `club_followers`, `club_invitations`, `event_invites`, `saved_events`, `rsvps`, `user_follows`, `notifications`, `user_interactions`, `reviews`, `moderation_reviews`, `event_reports`, `organizer_requests`, `admin_audit_log`, `experiments` / `experiment_variants` / `experiment_assignments`, `event_popularity_scores`, `recommendation_feedback`, `recommendation_explicit_feedback`, `email_reminder_log`, `feedback_request_log`, `featured_events`, `featured_clubs`; buckets `avatars`, `banners`.

---

## Stage 1 — Read-Only Foundation Audit

### Table Stakes (Gate Not Credible Without These)

| Deliverable | Why Required | Complexity | Notes |
|---|---|---|---|
| **Live schema snapshot** (`supabase db dump --linked` of prod + staging + local) | You cannot claim drift findings without the actual schema in hand. The codebase map is 6 months old. | LOW | Read-only. Produces the artifact every later stage diffs against. |
| **Three-way drift table: prod schema vs `supabase/migrations/` vs `src/lib/supabase/types.ts`** | The core Stage 1 question. Drift is *expected* given 2 `remote_schema` dumps and 3 naming schemes. | MEDIUM | Use `supabase db diff --linked` (migra against a shadow DB built from the migrations folder) plus `supabase migration list` for history mismatch. Per-table: exists-in-prod / exists-in-migrations / typed-correctly. |
| **Endpoint inventory: all 92 handlers × {method, auth requirement observed, role required, RLS reliance, service-role use, cache headers, personalization, validation present, test present}** | Classification is the deliverable that makes Stages 3 and 4 plannable. Without it, "every endpoint reviewed" in Stage 4 has no denominator. | HIGH | Machine-generate the skeleton (AST or grep for `createClient`/`createServiceClient`/`verifyAdmin`/`getUser`/`getSession`), then hand-classify. Expect 1-2 days. |
| **Page inventory: all 43 pages × {public/protected, client/server, data source, auth guard, dead?}** | Same reason; also feeds the Stage 4 smoke matrix. | MEDIUM | Cross-check against `src/middleware.ts` protected list: `/my-events`, `/create-event`, `/notifications`, `/profile`, `/my-clubs`, `/invites`. |
| **RLS policy review: every table × every command (SELECT/INSERT/UPDATE/DELETE) × every role** | An app that routes 30+ tables through a BaaS is *primarily* secured by RLS. A "foundation audit" that skips it audits nothing. | HIGH | Query `pg_policies` directly; do not trust the migration files (`002_rls_policies.sql`, `011_rls_audit.sql`, `20260223000000_notifications_rls_and_dedup`, `20260305000002_phase1_club_rls_and_schema`, `20260226000001_invitee_select_update_policy` overlap). Flag: RLS-enabled-with-no-policy (deny-all), RLS-disabled tables, `USING (true)` policies, policies with no `TO` clause. |
| **Service-role callsite register: every `createServiceClient()` use, with per-callsite justification** | Service role bypasses RLS entirely; this is the single highest-blast-radius pattern in the stack. | MEDIUM | For each: is RLS bypass actually required, is the caller authenticated first, is the user-supplied id used as a filter, is the module reachable from any client bundle. |
| **Cache/personalization exposure matrix** | `vercel.json` sets `s-maxage=60, stale-while-revalidate=300` on **all** `/api/*`. Vercel's shared CDN keys by URL — a personalized response cached there can be served to a different user. This is a confirmed-pattern data-leak class, not a theoretical one. | MEDIUM | For each handler: does the response body vary by user? Does it set its own `Cache-Control`? Does the request carry an `Authorization` header (which suppresses Vercel caching) or only cookies (which does not)? Treat `/api/recommendations`, `/api/users/saved-events`, `/api/notifications`, `/api/invites`, anything under `/api/admin` as prime suspects. |
| **Auth mechanism audit: `getSession()` vs `getUser()` at every auth decision point** | `getSession()` does not verify the token server-side; using it as an authorization gate is spoofable. Already suspected in `api/recommendations/analytics` and `api/health`. | LOW | Grep is sufficient for discovery; each hit needs a judgment on whether it gates access or merely reports liveness. |
| **Fail-open audit: every authorization check that is conditional on an env var being present** | `api/admin/calculate-popularity` accepts any request when `ADMIN_API_KEY` is unset, on a service-role client. Any other `if (expectedKey && ...)` shape is the same bug. | LOW | Also check the cron route (`api/cron/send-reminders`) for a `CRON_SECRET` equivalent. |
| **Cron and webhook inventory** | Scheduled/unauthenticated entry points are the ones nobody tests. | LOW | pg_cron jobs (`SELECT * FROM cron.job` — `compute_user_scores` every 6h is known), `vercel.json` crons, `supabase/functions/events-webhook/`, the Apify/Instagram ingestion webhook, Supabase auth hooks. |
| **Test/build/lint/type-check baseline with actual command output captured** | Stage 2 and 3 gates are "still green." Green relative to *what* must be recorded now, including which tests currently fail or are excluded. | LOW | Note: `vitest.config.ts` excludes `src/lib/kmeans.test.ts`; `tsconfig.json` excludes `**/*.test.ts` from type-checking. Both are pre-existing holes that must be in the baseline. |
| **Test runner decision with evidence** | Both `jest.config.js` and `vitest.config.ts` exist; `jest@^30` + `ts-jest@^29` are installed but the documented pattern and every test file are Vitest-flavored. Decide on file counts and pass rates, not preference. | LOW | Run both runners, record what each collects and passes. |
| **Dependency reachability + outdated report** | Input to the Stage 2 gate. | LOW | `npm ci` then `npm audit --omit=dev`, `npm outdated`, plus a reachability judgment per high/critical. Flag `vercel@^32` in **production** dependencies, `swagger-ui-react`, `redoc`. |
| **Error handling / logging / observability assessment** | 179 unstructured console calls across 62 files and no Sentry means production failures are currently uninvestigable. | LOW | Quantify: routes with no try/catch, routes that leak internal error text to the client, `catch (error: any)` count, absent request correlation. |
| **Dead code, duplicate components, stale docs list** | Cheap, and it shrinks the Stage 3 and 4 surface area. | MEDIUM | Unreferenced routes, components superseded by v2.0 UX work, `API_ENDPOINTS` constants bypassed by hardcoded fetch URLs, docs pages (`/docs` Redoc) describing endpoints that changed. |
| **`FOUNDATION_AUDIT.md` where every finding has: stable ID, severity, evidence, affected paths, reproduction, recommended fix, validation criterion** | This is the literal exit gate. See anatomy below. | MEDIUM | |

#### Finding Record Anatomy (table stakes for every finding)

| Field | Requirement |
|---|---|
| ID | Stable, e.g. `F-017`. Never renumbered. Stage 3/4 work items reference these IDs. |
| Title | One line, states the defect, not the area. |
| Severity | Critical / High / Medium / Low, with a stated rationale. CVSS base is optional; **exposure-adjusted** severity is what matters (is it reachable by an anonymous request? does it cross tenants? is there a compensating control like RLS?). |
| Category | schema-drift / authz / authn / cache-exposure / injection / validation / performance / observability / dead-code / dependency. |
| Affected paths | Exact file paths and line numbers, or table/policy names. |
| Evidence | Captured output: the `curl` response, the `pg_policies` row, the diff hunk, the failing assertion. A finding with no evidence gets contested and deprioritized. |
| Reproduction | Steps another engineer can follow to see it themselves. |
| Recommended fix | Specific enough to be turned into a Stage 3 slice. |
| Validation criterion | The test or check that will *prove* it fixed. This is what Stage 3/4 will run. Findings with no validation criterion cannot be closed. |
| Status | Open / Fixed / Risk-accepted (with owner + expiry). No closure without retest or formal acceptance. |

### Differentiators (Extra Rigor Worth Considering)

| Deliverable | Value | Complexity | Notes |
|---|---|---|---|
| **Threat model of the three trust boundaries** (anonymous→app, authenticated student→other tenants' data, organizer→admin escalation) | Turns a findings list into a coverage argument: "we looked for X class of bug and found none." | MEDIUM | Supabase's own production checklist lists threat modeling as an item. Keep it to one page per boundary. |
| **Client-bundle secret sweep** | Catches the catastrophic case (service key or admin logic shipped to the browser) in one command. | LOW | Build, then grep `.next/static` for the service key prefix, `ADMIN_EMAILS`, `ADMIN_API_KEY`. Very high value per minute spent. |
| **RLS policy coverage heatmap** (table × command × role, colored allow/deny/none) | Makes the Stage 4 RLS test matrix a direct transcription instead of a new design task. | MEDIUM | Depends on the RLS review above. |
| **Query-cost profile from `pg_stat_statements`** | Converts "performance hotspots" from opinion to ranked evidence; catches missing indexes on `club_members`, `user_interactions`, `saved_events` FKs. | MEDIUM | Migration `20260316000004_fk_indexes_and_cleanup.sql` claims to address some of this — verify against prod. |
| **Storage bucket policy review (`avatars`, `banners`)** | Upload abuse and cross-user overwrite are easy to miss because buckets aren't tables. | LOW | Public vs authenticated read, path-prefix ownership policy, size/MIME limits. |
| **Route-handler dependency graph** (which handlers touch which tables) | Lets Stage 3 slices be scoped by blast radius rather than by folder. | MEDIUM | Falls out of the endpoint inventory if you record table names. |
| **Severity SLA policy** (Critical fixed in Stage 3 wave 1, High before Stage 4 starts, etc.) | Makes the Stage 4 "no unresolved critical or high" gate mechanical rather than argued. | LOW | |

### Anti-Features (Deliberately Not Doing)

| Anti-feature | Why It's Tempting | Why It's A Problem | Do Instead |
|---|---|---|---|
| **Fixing anything during Stage 1** | Findings are obvious and small; "while I'm here." | Destroys the baseline. If the pre-fix behavior isn't captured, Stage 3 cannot prove it preserved behavior, and the audit's own reproduction steps stop reproducing. The project constraint already says read-only — hold it even for one-liners. | File the finding with an exact fix recommendation. Fix it in a Stage 3 slice with a test. |
| **Running a commercial SAST/DAST suite over the whole repo** | Looks thorough, produces a big number. | Hundreds of low-signal findings on a 92-route Next.js app; triage cost exceeds the value, and it crowds out the hand-audit of RLS and service-role usage where the real risk lives. | Targeted `npm audit --omit=dev` + the manual authz/cache/service-role review. Add a linter rule later if a class repeats. |
| **A full manual line-by-line read of all 43 pages** | "Complete coverage." | Pages are the lowest-risk layer (no secrets, no RLS bypass) and the highest churn. Days spent here buy little. | Classify pages by auth/data-source; deep-read only pages that render data from multiple tenants or admin data. |
| **Auditing the archived v1/v2 planning docs for accuracy** | They're stale and it itches. | They're in git history and nothing reads them. Zero risk reduction. | One line in the stale-docs list: "superseded, ignore." |
| **Assigning CVSS vectors to application logic findings** | Feels official. | CVSS is calibrated for shipped-software CVEs and flattens exactly the context that matters here (is it anonymous-reachable, does it cross tenants). Produces arguments about vectors instead of fixes. | Four-level severity with a written exposure rationale. Reserve CVSS for actual CVEs in Stage 2. |
| **Benchmarking/perf-tuning during the audit** | Hotspots are visible. | Numbers taken before Stage 2 dependency upgrades and Stage 3 query fixes are invalid by the time anyone acts on them. | Record the hotspot and the mechanism (e.g. "RSVP counts load all rows"); measure in Stage 4 against the scale dataset. |

---

## Stage 2 — Dependency and Runtime Stabilization

### Table Stakes

| Deliverable | Why Required | Complexity | Notes |
|---|---|---|---|
| **Runtime pinned: `engines` in `package.json` + `.nvmrc` + Vercel Node version matched** | Three places currently disagree by omission (local Node 24.16 / npm 11.13, no pin, Vercel default). "Reproducible" is meaningless without it. | LOW | Pin to the Node major Vercel actually runs; verify in a deployment log, not in docs. |
| **Written vulnerability policy before running any scan** | Otherwise the gate is "whatever `npm audit` says today," which is unstable and invites `npm audit fix --force`. | LOW | Recommended policy: CI runs `npm audit --audit-level=high --omit=dev`; zero unexplained criticals in prod deps; high severity in prod deps needs either a fix or a written, dated, owner-signed exception with a reachability argument; dev-only findings are tracked, not blocking. This matches the PROJECT.md gate wording. |
| **Reachability judgment on every High/Critical in prod deps** | Severity alone over-reports. The policy hinges on "reachable." | MEDIUM | For each: is the vulnerable function on a path from a route handler or a page? Record the answer in the exception. |
| **`vercel` removed from production dependencies** | A deploy CLI in `dependencies` is shipped into the serverless bundle: dead weight plus a large transitive attack surface for zero runtime benefit. | LOW | Decide separately whether it stays as a devDependency at all (Vercel's git integration doesn't need it). |
| **Swagger UI / Redoc upgraded, isolated, or removed** | Two heavyweight doc renderers in `dependencies` that render into a public page (`/docs`); historically a source of client-side vulns. | MEDIUM | Cheapest credible outcome: move docs to a build-time static artifact or gate `/docs` behind auth, and drop the runtime deps. |
| **One test runner; the other config and its packages removed** | Two runners means "tests pass" is ambiguous for the rest of the program. | LOW | Execute the Stage 1 decision. Remove `jest.config.js` + `jest`/`ts-jest` (or the inverse). Add a real `test` script — its absence is why the baseline was unclear. |
| **Upgrades applied in small labeled batches, with lint + type-check + test + build + smoke after each** | A single "upgrade everything" commit makes bisecting a behavior regression impossible, which violates the program's core value. | MEDIUM | One commit per batch, batch contents in the message. |
| **Every major upgrade isolated to its own change, with a migration note** | Next.js majors and Supabase SDK majors carry breaking behavior (cookie handling, caching semantics). | MEDIUM-HIGH | Next.js patch/minor upgrade is in scope; a Next.js major is a separate decision with its own smoke pass. |
| **Clean-room reproducible install proof** | The literal gate. | LOW | `rm -rf node_modules && npm ci` from the committed lockfile in a fresh checkout (ideally in CI, not just locally), then build. Capture output as evidence. |
| **Lockfile reviewed as a diff, not regenerated** | `npm audit fix` and stray `npm install` rewrite unrelated trees and silently change resolutions. | LOW | Review `package-lock.json` diffs the way you'd review code: unexpected new top-level packages, registry/integrity changes, version jumps not in the batch. |
| **npm `devdir` warning resolved** | An unexplained config warning means the install environment isn't understood, which undercuts "reproducible." | LOW | Likely a stray `.npmrc` key; either remove it or document why it's there. |
| **Green build, lint, type-check, tests at the same or better state than the Stage 1 baseline** | The gate. | LOW | "Same or better" — do not let a pre-existing failing test quietly become the new normal. |

### Differentiators

| Deliverable | Value | Complexity | Notes |
|---|---|---|---|
| **CI job that runs the audit gate on every PR** | Turns a one-time cleanup into a property that holds. | LOW | `npm ci && npm audit --audit-level=high --omit=dev`. |
| **Lockfile integrity check in CI** (`npm ci` fails on mismatch, plus a "lockfile changed without package.json changing" flag) | Catches supply-chain-shaped changes and accidental resolution drift. | LOW | |
| **`overrides` for transitive-only fixes instead of forced major bumps** | Fixes a CVE without dragging a breaking major through the tree. | LOW | Document each override with the CVE it addresses and a removal condition. |
| **SBOM generated and committed** | Makes "is this app affected by tomorrow's CVE?" a lookup rather than an investigation. | LOW | `npm sbom --sbom-format cyclonedx`. Low effort, real ongoing value. |
| **Dependabot/Renovate configured with grouping + auto-merge for patch-only** | Prevents the same debt re-accumulating during the ingestion milestone. | LOW | Configure *after* the batch upgrades, or it fights them. |
| **Bundle-size before/after record** | Removing `vercel`, Swagger, and Redoc should show a measurable win; makes the stage's value legible. | LOW | |

### Anti-Features

| Anti-feature | Why It's Tempting | Why It's A Problem | Do Instead |
|---|---|---|---|
| **`npm audit fix --force`** | One command, number goes to zero. | Installs semver-major changes indiscriminately, rewrites the lockfile, and introduces regressions unrelated to any real risk — precisely the failure mode this stage exists to prevent. | Targeted upgrades per finding, or `overrides`, in labeled batches. |
| **Chasing zero vulnerabilities including devDependencies** | "Clean" output. | Dev-tool CVEs are mostly unreachable from production; pursuing them consumes the stage and can force breaking toolchain upgrades. | `--omit=dev` for the gate; track dev findings on a list with no deadline. |
| **Upgrading React 18 → 19 and/or a Next.js major inside this stage** | "While we're upgrading." | Cross-cutting rendering/caching behavior change during a program whose core value is behavior preservation — and before Stage 3 has built any characterization tests to detect the breakage. | Stabilize on the current majors. Re-evaluate majors after Stage 4 certification, when tests can prove it. |
| **Switching package managers (npm → pnpm/bun)** | Faster, stricter. | Changes hoisting and resolution semantics mid-program; every Stage 1 finding about the dependency tree becomes unverifiable. | Stay on npm. Revisit post-certification. |
| **Adding new runtime dependencies (validation lib, logger, Sentry) in Stage 2** | They're needed soon anyway. | Stage 2's gate is "the tree is stable and reproducible." Adding surface area while proving stability confuses the signal. | Add them in Stage 3, inside the slice that uses them, with tests. |
| **Deleting the second test runner's tests along with its config** | Tidy. | Some tests may only exist under the losing runner; deleting them silently reduces the baseline. | Port first, then delete config. Any test dropped must be listed with a reason. |

---

## Stage 3 — Targeted Foundation Refactor (Bottom-Up, Tested Vertical Slices)

The organizing rule for the whole stage: **characterize, then change, then re-verify.** Before touching a layer, write a test that asserts what it does *today* (including behavior you think is wrong), refactor, then prove the same test — or a deliberately, explicitly updated version of it — still passes. Record any intentional behavior change as a decision, not as a silent diff.

### Table Stakes — Per Layer

| Layer | Characterization (before) | Change | Verification (after) | Complexity |
|---|---|---|---|---|
| **1. Schema / migrations / RLS** | Prod schema dump + `pg_policies` snapshot committed as the baseline artifact | Reconcile migrations with prod: a squashed baseline migration or repaired history; add missing FK indexes; fix policy gaps from Stage 1 | `supabase db reset` from migrations produces a schema that diffs clean against prod; pgTAP allow/deny tests per fixed policy | HIGH |
| **2. Generated types** | Current `as any` callsite list (18+ known) as the work queue | `supabase gen types typescript` replaces the hand-written file; remove casts callsite by callsite | Type-check passes with zero `(supabase as any)` in `src/`; a CI step regenerates types and fails on drift | MEDIUM |
| **3. Auth / authz** | Tests asserting the *current* response for each persona against each sensitive endpoint (including the ones that wrongly return 200) | `getUser()` at every auth decision; `verifyAdmin()` on `api/recommendations/analytics`; fail-closed on missing `ADMIN_API_KEY`/`CRON_SECRET`; env var validation replacing `!` assertions | Same persona tests now assert the *correct* codes; the change from 200→403 is the recorded, intended delta | MEDIUM |
| **4. Service/data-access boundaries** | Tests on the handlers that will be refactored, asserting current response shape | Extract shared query logic (events with club join, RSVP counts, club membership checks, ban checks) into `src/lib/services/` or `src/lib/data/`; handlers become thin | Handler tests unchanged and still green; duplicated Supabase query blocks measurably reduced | HIGH |
| **5. Validation / contracts** | Record current behavior on malformed input per handler (many will be 500s or silent coercions) | One schema library (Zod) at every handler boundary; typed request/response contracts; escape `%`/`_` in `ilike` search on `api/events` and `api/admin/events` | Malformed input returns a consistent 400 shape everywhere; the adversarial dataset in Stage 4 re-runs these | HIGH |
| **6. Endpoints** | Per-handler characterization test (response shape + status per persona) | Fix per Stage 1 finding IDs | Every Critical/High finding's validation criterion passes | HIGH |
| **7. Routing / middleware** | Tests for the protected-route redirect, onboarding guard, ban check, and rate limiter as they behave today | Include `/api/admin/*` in rate limiting (generous limit); move the limiter off in-memory `globalThis` **or** document the single-instance assumption as an accepted risk with an expiry; verify the onboarding guard cannot be bypassed by direct API calls | Middleware tests green for every persona incl. banned and mid-onboarding | MEDIUM |
| **8. Pages / state** | Snapshot/behavior tests on the pages that read the dual date schema | Resolve `start_date`/`end_date` vs `event_date`/`event_time` to one schema (Stage 1 says which prod uses); centralize tag mapping into `lib/tagMapping.ts` and delete the inline `Record` with its silent `SOCIAL` fallback; remove `any` casts | Event dates render identically before/after on the same fixtures; unknown tags now surface explicitly rather than silently becoming SOCIAL | MEDIUM |
| **9. Caching / performance** | Record current `Cache-Control` per route and current response times on known hotspots | Remove the blanket `/api/*` `s-maxage=60` from `vercel.json`; personalized routes return `private, no-store`; public routes opt in explicitly; RSVP counts via `count: 'exact', head: true` or a DB function; events list uses a real `club:clubs(*)` join instead of fabricating club objects | A cache-exposure test: authenticate as user A, request a personalized route, then request it as user B and assert no A-data and no CDN `HIT` on a personalized path | MEDIUM |
| **10. Observability** | Count and location of `console.*` calls as the baseline | Structured logger with levels + request correlation id; Sentry with environment and release tagging; a real `/api/health` that checks DB, auth, and storage and does not use `getSession()` for access control | Health endpoint returns a documented shape; a deliberately triggered error appears in Sentry with the correlation id and a readable stack trace | MEDIUM |

#### Cross-Cutting Table Stakes for Stage 3

| Deliverable | Why Required | Complexity |
|---|---|---|
| **Each slice is one reviewable commit/PR: characterization test → refactor → verification** | The program's core value is "if a foundation change breaks a workflow that worked before, the program has failed." Bisectability is the only mechanical defense. | LOW (discipline) |
| **Finding-ID traceability: every slice names the `F-xxx` it closes** | Makes the Stage 4 "no unresolved critical or high" gate a query, not a debate. | LOW |
| **Smoke pass of the 16 Validated workflows after each layer completes** | Catches regressions at layer granularity instead of at the end. | MEDIUM (automate as soon as Stage 4's E2E harness exists — see dependency note) |
| **Intentional behavior changes logged** (e.g. analytics endpoint 200→403, unknown tags no longer coerced to SOCIAL) | Some fixes *must* change behavior; the program forbids *accidental* change, not deliberate change. Undocumented, they look like regressions in Stage 4. | LOW |
| **Auth callback covered by tests before it is touched** | It's the highest-risk untested file in the repo: OAuth exchange, McGill enforcement, user upsert, admin auto-assignment, onboarding routing — with three `as any` casts. | MEDIUM |

### Differentiators

| Deliverable | Value | Complexity | Notes |
|---|---|---|---|
| **CSRF protection on state-changing routes** | Cookie-only auth with no CSRF token is a real, standard browser attack. Listed as a missing critical feature already. | MEDIUM | Genuinely worth it, but it's an *addition*, not a correction — hence differentiator rather than table stakes for a behavior-preservation program. Verify `SameSite` on the Supabase cookies first; that may already mitigate most of it and downgrade the urgency. |
| **Distributed rate limiting (Upstash/Vercel KV)** | The in-memory limiter genuinely doesn't work across serverless instances. | MEDIUM | Adds an external dependency. The cheaper honest alternative is to document the limitation as an accepted risk with an expiry date. |
| **Declarative schema (`supabase/schemas/`) instead of an append-only migration pile** | Ends the 3-naming-scheme problem permanently. | MEDIUM-HIGH | Real payoff, real migration cost. Only if Stage 3 has room after the Critical/High queue. |
| **Coverage threshold on the refactored modules only** | Prevents the new service layer from decaying, without a repo-wide number that nobody can hit. | LOW | Per-directory thresholds, not global. |
| **Typed API contract shared between client and handler** (Zod schema exported and reused by hooks) | Kills the class of bug where the client expects a field the handler renamed. | MEDIUM | Depends on layer 5. |
| **Query performance budget asserted in tests** (e.g. events list issues ≤ N queries) | Stops the `select('*')`-then-fabricate pattern from returning. | MEDIUM | |
| **`pg_cron` job inventory codified as a migration** | The 6h `compute_user_scores` schedule currently exists only in prod. | LOW | |

### Anti-Features

| Anti-feature | Why It's Tempting | Why It's A Problem | Do Instead |
|---|---|---|---|
| **Big-bang rewrite of the API layer** | 92 handlers with duplicated Supabase logic beg for it. | Explicitly excluded by project constraints, and it makes behavior preservation unprovable. | Bottom-up slices; the service layer grows by extraction from the handlers being fixed, not by up-front design. |
| **Introducing an ORM (Prisma/Drizzle) over Supabase** | Would "solve" the type drift. | Replaces the stack mid-program, breaks RLS-in-the-request-context (which the app depends on), and invalidates every RLS finding. | Generated Supabase types + a thin data-access layer. |
| **Refactoring for architectural beauty beyond the findings list** | The layering is genuinely muddled. | Unbounded scope with no exit gate; every extra changed line is regression risk against 16 Validated workflows. | Change only what a finding ID or a layer table-stake requires. Park the rest as backlog. |
| **Chasing 80% (or any) global coverage number** | Looks like rigor. | Drives tests toward trivial, easy-to-cover modules and away from the auth callback, admin routes, and RLS — the places with actual risk. | Cover by risk: the persona × endpoint matrix and the Validated workflows. |
| **Rewriting the recommendation scoring engine** | It's the most complex thing in the repo and the fallbacks are opaque. | It's Postgres-native, working, and out of the audit's risk hot zone; touching a 5-signal scoring formula makes "same behavior" impossible to assert. | Characterize its API surface (input → ranked output) and leave the formula alone. Fix only the hardcoded `major`/`year_of_study` payload if a finding calls for it. |
| **Redesigning UI while touching pages in layer 8** | Pages are open in the editor anyway. | Visual change destroys the ability to smoke-test "same as before," and the program explicitly excludes new product work. | Logic and types only. Zero intentional visual diffs. |
| **Deleting `getSession()` everywhere by grep** | Fast. | `getSession()` is legitimate for non-authorization purposes (e.g. liveness in `/api/health`). A blind sweep changes behavior needlessly. | Replace only where it gates access; annotate the remaining uses with why they're safe. |

---

## Stage 4 — Test-Data Certification

### Table Stakes — Datasets

Concrete to this schema. All three load into local Supabase and the existing staging project; never production.

**A. Deterministic functional dataset** (fixed UUIDs, fixed timestamps relative to a pinned "now", fixed PRNG seed — same rows on every machine and every CI run) — **Complexity: HIGH**

| Entity | Must include |
|---|---|
| `users` | admin; club_organizer who owns one club; club_organizer who owns two clubs (multi-club switcher); plain onboarded student (has `interest_tags`); student mid-onboarding (`interest_tags` null, must hit the guard); permanently banned (`banned_at` set, `ban_expires_at` null); temporarily suspended (`ban_expires_at` in the future); **expired suspension** (`ban_expires_at` in the past → must behave as normal); user with `roles` containing both `admin` and `club_organizer` |
| `clubs` | pending, approved, rejected, and appealed; one club with zero events; one club with many; one club whose owner is also an admin |
| `club_members` | owner, admin/officer, plain member for the same club; a user who is a member of club A only (the cross-club probe); a pending `club_invitations` row and an accepted one |
| `events` | pending, approved, rejected; soft-deleted (`deleted_at` set — must disappear from every list); auto-approved organizer-posted event; admin-approved event; past event (enables reviews); happening-now event (enables the "Happening Now" rail); future event; event with no club; event ingested by the Instagram scraper (source + `content_hash`); `featured_events` row |
| `saved_events` / `rsvps` | saves by several users on one event; `going`, `interested`, and `cancelled` on the same event (cancelled must not count); RSVP by a banned user |
| `club_followers` / `user_follows` | follower counts > 0 for at least one club; a reciprocal user follow and a one-way follow |
| `notifications` | read and unread; one per notification type the app emits; a deduplicated pair (per the dedup migration) |
| `user_interactions` | view/click/save/share rows across several sources, enough to make popularity non-uniform |
| `reviews` / `moderation_reviews` | a review on a past event by an attendee; an attempted review on a future event; aggregate feedback visible to the organizer; moderation review records for approve and reject |
| `event_reports` + appeals | open report, resolved report, event appeal (`/api/events/[id]/appeal`), club appeal (`/api/clubs/[id]/appeal`) |
| `experiments` | one active experiment with ≥2 `experiment_variants` and assignments covering both arms |
| `event_popularity_scores` + recommendation scores | scores present for one user (personalized path) and **absent** for another (popularity-fallback path) — both branches must be exercised |
| `admin_audit_log` | at least one row per moderation action type, to assert new actions append |
| Storage | an `avatars` object and a `banners` object owned by a specific user/club, to test ownership policies |

**B. Adversarial dataset** — **Complexity: MEDIUM-HIGH**

| Class | Concrete cases for this app |
|---|---|
| Malformed input | Missing required fields; wrong types; oversized strings in event title/description; emoji and RTL text; null vs empty string; unknown `EventTag` value (must not silently become `SOCIAL`) |
| Injection-shaped | Search strings containing `%`, `_`, `,`, `)` and PostgREST operator syntax against `/api/events` and `/api/admin/events`; `<script>` in club description and event title (assert escaped on render) |
| Unsafe links | `javascript:` and `data:` URLs in event link / club website fields |
| Duplicates | Two scraped Instagram posts with the same `content_hash`; duplicate RSVP for the same user+event; duplicate save; duplicate club invitation to the same email |
| Time / timezone | Event spanning midnight America/Toronto; event during a DST transition; end before start; all-day event; event in a different timezone than the viewer; the dual date schema's ambiguous rows |
| Expired content | Expired club invitation; expired suspension; past event reachable by direct URL; soft-deleted event reachable by direct URL |
| Cross-tenant | Organizer of club A POSTing an event with `club_id` = club B; member of club A calling club B's member-management and analytics endpoints; user A reading user B's saved events, RSVPs, notifications, and invites by id |
| Auth abuse | Non-McGill Google account completing OAuth (must be rejected at the callback with no `users` row created); banned user attempting every state-changing route; forged/expired session cookie against a `getSession()`-era route |
| Upload abuse | Non-image MIME with an image extension; oversized file; path traversal in the object key; uploading to another user's avatar path |
| Rate/volume | Burst beyond the limiter on a public route and on `/api/admin/*`; pagination cursor tampering; `limit=100000` |

**C. Scale dataset** — **Complexity: MEDIUM**

Thousands of users, hundreds of clubs, thousands of events with realistic status distribution, tens of thousands of `saved_events` / `rsvps` / `user_interactions` / `notifications`, and a skewed popularity distribution (a few events with thousands of RSVPs — the case that breaks "load all rows then filter in JS"). Generated from a fixed seed; regenerable after migrations. Loaded into staging only.

### Table Stakes — Persona × Workflow Matrix

Personas (each gets its own Playwright `storageState` file produced by a setup project, plus an API-level client for non-UI assertions):

| # | Persona | How represented |
|---|---|---|
| P1 | Anonymous public visitor | no storage state |
| P2 | Verified McGill student, onboarded | seeded student |
| P3 | Student mid-onboarding | `interest_tags` null |
| P4 | Club member (non-organizer) | `club_members` role=member, club A |
| P5 | Club organizer / owner, own club | owner of club A |
| P6 | Multi-club organizer | owner of clubs A and C |
| P7 | Cross-club attacker | organizer of club A acting on club B |
| P8 | Moderator / admin | `roles` contains admin |
| P9 | Banned (permanent) | `banned_at` set |
| P10 | Suspended (temporary, active) | `ban_expires_at` future |
| P11 | Expired suspension | `ban_expires_at` past — must be treated as normal |
| P12 | Non-McGill sign-in | rejection case, asserted at the auth callback |
| P13 | Machine callers | cron (`CRON_SECRET`), `ADMIN_API_KEY` route, Instagram/Apify webhook — each tested with valid, invalid, and **absent** credentials (the fail-open case) |

Workflows × personas (assert the *expected* outcome for each cell — allowed, redirected, 401, 403, 404-not-500, or "not visible"):

browse/search/filter events · view event detail · save/unsave · RSVP going/interested/cancel · view recommendations (personalized and fallback) · follow/unfollow club · view club page · create event · edit/delete own event · edit another club's event · view club analytics · invite member by McGill email · accept/decline invite · change member role · submit review on past event · report an event · appeal a rejection · moderate event/club · ban/suspend user · read notifications · read/patch profile · upload avatar/banner · access `/docs` · access every `/api/admin/*` route.

### Table Stakes — Test Execution

| Deliverable | Why Required | Complexity | Notes |
|---|---|---|---|
| **RLS allow/deny tests per table via pgTAP** | The PROJECT gate says so, and RLS is the primary authorization mechanism. | HIGH | `supabase/tests/<table>_rls.test.sql`, run by `supabase test db`. Switch identity with `set local role` + `set local request.jwt.claim.sub`. **Critical correctness trap:** denied INSERT/DELETE raise errors, but denied UPDATE and SELECT return zero rows silently — never prove an allowed write with `lives_ok`; assert affected row counts, or a test suite that passes proves nothing. |
| **E2E coverage of the critical workflows** | The Validated list is the contract. | HIGH | Playwright with a setup project writing one `.auth/<persona>.json` per persona; specs declare their persona via `test.use({ storageState })`. Never mutate a shared persona account from parallel specs — give write-heavy specs their own seeded user. |
| **Every one of the 92 endpoints classified and reviewed; every one of the 43 pages smoke-tested** | Explicit gate wording; the Stage 1 inventory supplies the denominator. | HIGH | "Reviewed" ≠ "E2E tested." Endpoints get at least: authenticated-vs-anonymous status assertion + one cross-tenant probe. Pages get: loads, no console error, no unhandled rejection, correct auth redirect. |
| **Cache-exposure regression test** | The single highest-severity suspected issue. | MEDIUM | For each personalized route: request as A, request as B, assert no A-data and no shared-cache `HIT`; assert `Cache-Control` contains `private`/`no-store`. |
| **Zero unresolved Critical or High findings, evidenced by each finding's own validation criterion passing** | The gate. | LOW (if Stage 1/3 traceability held) | Any remaining item must be a dated, owned, written risk acceptance — not silence. |
| **Load test against the scale dataset with a stated pass threshold** | "Acceptable performance" needs a number. | MEDIUM | Extend the existing `load-tests/k6-onboarding.js` and `k6-online-users.js`; add the event-list and event-detail hot paths. State p95 latency and error-rate thresholds *before* running. |
| **Deployment / rollback / backup / monitoring validated — by rehearsal, not by configuration** | This is the phrase most likely to be signed off on falsely. Concretely: (1) deploy to production and record the deployment id; (2) execute a real `vercel rollback` to the prior alias and confirm the app serves the old build; (3) confirm Supabase daily backups exist and PITR is enabled if applicable, then **restore a backup into a scratch/staging project and record the elapsed time as the measured RTO**; (4) deliberately trigger an error and a downtime condition and confirm the alert actually fires to a human, with the Sentry event and correlation id retrievable. | MEDIUM | A screenshot of a settings page is not validation. The artifact is a runbook with timestamps and measured RTO/RPO. |
| **Every dataset load is idempotent and re-runnable after `supabase db reset`** | Otherwise certification isn't reproducible, which is the whole point. | MEDIUM | Seed once, wrap each test in a transaction and roll back — fastest reliable isolation pattern. |
| **A written certification report** stating what was tested, by which persona, with which dataset, what passed, and what is accepted risk | The deliverable that lets the next milestone start. | LOW | |

### Differentiators

| Deliverable | Value | Complexity | Notes |
|---|---|---|---|
| **Generated persona × endpoint authorization matrix test** (data-driven from the Stage 1 inventory: every endpoint × every persona → expected status) | Turns 92 × 13 from a manual slog into a table. New endpoints added later fail the test until classified — the strongest single anti-regression mechanism available here. | MEDIUM-HIGH | Highest-leverage differentiator in the whole program. Strongly consider promoting to table stakes. |
| **Auto-generated pgTAP RLS tests from `pg_policies`** | Guarantees no table is silently skipped. | MEDIUM | Community tooling exists (e.g. rlsautotest); or generate from the Stage 1 heatmap. |
| **CI job running RLS + E2E on every PR against a seeded local Supabase** | Certification becomes continuous instead of a point-in-time claim that decays during the ingestion milestone. | MEDIUM | |
| **Seeded staging refreshed on a schedule** | Keeps staging usable for manual QA without hand-built data. | LOW | |
| **Visual regression on the top ~10 pages** | Cheap guard against the Stage 3 page-layer refactor breaking rendering. | MEDIUM | Only worthwhile if Stage 3 actually touched those pages. |
| **Accessibility smoke (axe) on the same ~10 pages** | Student-facing university product; likely an institutional expectation later. | LOW | Out of the certification gate's stated scope — additive. |
| **Chaos probe: Supabase unreachable** | Verifies graceful degradation paths (recommendations → popularity fallback) rather than assuming them. | MEDIUM | |
| **Restore drill scheduled to repeat** (not just done once) | A one-time restore proves capability; a repeating drill proves it stays true. | LOW | |

### Anti-Features

| Anti-feature | Why It's Tempting | Why It's A Problem | Do Instead |
|---|---|---|---|
| **Any synthetic data path that can reach production** | One seed script with an env switch is simpler than two. | Explicit project constraint, and the failure mode (test users with admin roles in the real `users` table, fake events shown to real students) is unrecoverable reputationally. | Separate scripts with a hard guard: refuse to run unless the Supabase URL matches a local/staging allowlist. No prod env var path at all. |
| **Snapshotting production data into staging** | Realistic data for free. | Real McGill student PII into a lower-trust environment. | Synthetic generation from a fixed seed, shaped to match production's *distribution*, not its rows. |
| **E2E tests for every one of the 43 pages** | "Complete coverage." | E2E is the slowest, flakiest layer; 43 full journeys will be flaky enough that people start ignoring failures — which is worse than not having them. | E2E only for the Validated critical workflows; smoke (loads + no error + correct redirect) for the rest; push authorization assertions down to the fast API-level matrix. |
| **Load-testing to find the breaking point** | Interesting number. | This is a campus app; peak is a few thousand students. Time spent finding the knee of the curve doesn't change any decision. | Test at ~3× realistic peak against a pre-stated threshold. Pass/fail, then stop. |
| **Testing Supabase's own behavior** (does RLS work? does auth issue valid JWTs?) | It's in the request path. | Testing the vendor, not your configuration; burns time and produces tests that break on vendor upgrades. | Test *your policies* and *your* callback logic. |
| **Random/property-based data generation without a fixed seed** | More coverage per line. | Non-deterministic failures in a certification suite are unreproducible, and the gate becomes unfalsifiable. | Fixed seed always. Property-based testing only for pure functions (the classifier, date validation) where a failing case can be minimized and pinned. |
| **A staging environment that drifts from production config** | Staging is "just for tests." | Certification on a differently-configured environment certifies nothing — especially for cache headers and RLS, the two areas under suspicion. | Diff staging vs production config (env vars present, `vercel.json`, RLS state, extensions) as a certification item. |
| **Treating "monitoring is configured" as "monitoring is validated"** | It's on the checklist and the dashboard is green. | The most common false gate. An alert nobody has ever seen fire is an untested code path. | Force an incident; confirm a human receives it; record the timestamp. |

---

## Cross-Stage Dependencies

```
Stage 1: live schema snapshot
    └──enables──> Stage 1: three-way drift table
                      └──enables──> Stage 3 layer 1 (schema/RLS reconcile)
                                        └──enables──> Stage 3 layer 2 (generated types)
                                                          └──enables──> Stage 3 layers 3-9
                                                                            └──enables──> Stage 4 RLS tests

Stage 1: endpoint inventory (92) + page inventory (43)
    └──enables──> Stage 1: cache exposure matrix ──> Stage 3 layer 9 ──> Stage 4 cache regression test
    └──enables──> Stage 1: service-role register ──> Stage 3 layer 3
    └──enables──> Stage 4: persona x endpoint authorization matrix   [strongest dependency in the program]
    └──enables──> Stage 4: "every endpoint classified" gate (supplies the denominator)

Stage 1: RLS policy review (heatmap)
    └──enables──> Stage 4: per-table pgTAP allow/deny tests

Stage 1: test runner decision
    └──enables──> Stage 2: runner consolidation ──> Stage 3: every characterization test

Stage 1: test/build/lint baseline
    └──enables──> Stage 2 exit gate ("green" needs a referent)
    └──enables──> Stage 3 per-slice verification

Stage 1: severity + finding IDs
    └──enables──> Stage 3 slice scoping ──> Stage 4 "no unresolved critical/high" gate

Stage 2: pinned runtime + reproducible install
    └──enables──> Stage 3 (refactors on a shifting dep tree are unbisectable)
    └──enables──> Stage 4 (certifying a non-reproducible build certifies nothing)

Stage 3 layer 2 (generated types)
    └──enables──> Stage 4 deterministic dataset (seed scripts need types that match prod)

Stage 3 layer 10 (Sentry + structured logging)
    └──enables──> Stage 4 monitoring validation (nothing to fire an alert from otherwise)

Stage 4 Playwright persona setup project
    └──enhances──> Stage 3 per-layer smoke pass    [see note]

Stage 1 read-only constraint ──conflicts──> any Stage 1 fix, however small
Stage 3 behavior preservation ──conflicts──> Stage 2 major framework upgrades
Stage 4 determinism ──conflicts──> unseeded random data generation
```

### Dependency Notes

- **Endpoint inventory is the program's keystone.** Stage 1's classification is consumed by the cache matrix, the service-role register, the Stage 3 slice plan, and both Stage 4 coverage gates. If it is done shallowly, three later deliverables degrade silently. Budget for it accordingly.
- **Generated types gate almost all of Stage 3.** Layers 3-9 all touch Supabase queries; doing them before types are generated means writing code against a type file known to be wrong, then re-touching it. Keep the strict bottom-up order.
- **Pull the Playwright persona harness earlier than Stage 4.** It is listed under Stage 4, but Stage 3's "smoke the Validated workflows after each layer" is manual and expensive without it. Building the setup project and ~6 happy-path specs at the start of Stage 3 (before layer 1) pays for itself by layer 4 and makes every subsequent slice cheaper to verify. This is the one place where strict stage ordering costs more than it protects.
- **A minimal deterministic seed is also a Stage 3 prerequisite**, for the same reason: characterization tests against layer 1 (schema/RLS) need real rows. Build the *functional* dataset early and grow it; defer the adversarial and scale datasets to Stage 4.
- **Stage 2 must not add dependencies** that Stage 3 will need (Zod, logger, Sentry) — that couples a "prove the tree is stable" gate to new surface area. The dependency runs the other way: Stage 2 proves stability, then Stage 3 adds.
- **Monitoring validation can't precede instrumentation.** Stage 4's "alert actually fired" item is untestable unless Stage 3 layer 10 shipped Sentry and the health endpoint.

---

## Minimum Credible Certification

### Must Be In The Program (non-negotiable)

- [ ] Three-way schema/migration/type drift table with evidence — everything downstream depends on knowing the real schema
- [ ] 92-endpoint and 43-page inventory with auth/role/cache/personalization classification — the denominator for two Stage 4 gates
- [ ] RLS policy review from live `pg_policies`, and pgTAP allow/deny tests per table — the app's primary authorization mechanism
- [ ] Service-role callsite register with per-callsite justification — highest blast radius
- [ ] Cache/personalization exposure matrix, the `vercel.json` blanket `s-maxage` fix, and a cross-user cache regression test — highest-severity suspected live issue
- [ ] Fail-open and `getSession()` authorization fixes — known, cheap, exploitable
- [ ] Findings with ID, severity, evidence, repro, fix, and validation criterion; no closure without retest — makes every later gate mechanical
- [ ] Vulnerability policy written before scanning; reproducible `npm ci`; reviewed lockfile; single test runner; `engines` pinned
- [ ] Generated Supabase types, zero `(supabase as any)` in `src/`, with a CI drift check
- [ ] Characterization test before every Stage 3 slice, and auth-callback tests before the callback is touched
- [ ] Deterministic functional dataset covering every role/status/edge case listed above
- [ ] Persona × workflow matrix executed for all 13 personas, including the three that get skipped most often: expired suspension, mid-onboarding, and machine callers with *absent* credentials
- [ ] Rehearsed rollback and a measured-RTO restore drill; an alert observed firing

### Add If The Program Has Room

- [ ] Generated persona × endpoint authorization matrix test — trigger: if Stage 1's inventory lands clean and machine-readable, this becomes nearly free and is the best regression insurance in the program
- [ ] CI job running RLS + E2E per PR — trigger: once the harness is stable, before the ingestion milestone starts
- [ ] CSRF protection — trigger: if the `SameSite` review shows real exposure
- [ ] Distributed rate limiting — trigger: if Vercel telemetry shows >1 concurrent instance in normal operation
- [ ] SBOM + Renovate — trigger: end of Stage 2, ~an hour of work
- [ ] Threat model and client-bundle secret sweep — trigger: Stage 1, both are hours not days

### Explicitly Defer Past This Program

- [ ] React 19 / Next.js major upgrades — needs the certified test suite to exist first; that's the point of the program
- [ ] Declarative schema migration to `supabase/schemas/` — real payoff, but it is a rewrite of the migration story during a behavior-preservation program
- [ ] Visual regression and a11y suites — additive quality, not certification credibility
- [ ] Package manager change, ORM adoption, recommendation engine rework — stack changes, out of scope by constraint

---

## Prioritization Matrix

| Deliverable | Risk Reduction | Effort | Priority |
|---|---|---|---|
| Cache/personalization exposure matrix + `vercel.json` fix | HIGH | LOW | P1 |
| Fail-open auth fixes (`ADMIN_API_KEY`, missing admin check) | HIGH | LOW | P1 |
| Service-role callsite register | HIGH | MEDIUM | P1 |
| RLS review + pgTAP allow/deny per table | HIGH | HIGH | P1 |
| Endpoint + page inventory with classification | HIGH (enabling) | HIGH | P1 |
| Three-way schema drift table | HIGH (enabling) | MEDIUM | P1 |
| Generated Supabase types + remove `as any` | HIGH | MEDIUM | P1 |
| Finding record discipline (ID/evidence/validation) | HIGH (enabling) | MEDIUM | P1 |
| Deterministic functional dataset | HIGH (enabling) | HIGH | P1 |
| Persona × workflow matrix execution | HIGH | HIGH | P1 |
| Auth-callback test coverage | HIGH | MEDIUM | P1 |
| Runtime pin + reproducible install + one test runner | MEDIUM | LOW | P1 |
| `vercel`/Swagger/Redoc removed from prod deps | MEDIUM | LOW | P1 |
| Rollback + restore drill + alert-fired proof | HIGH | MEDIUM | P1 |
| Generated persona × endpoint authorization matrix test | HIGH | MEDIUM-HIGH | P1/P2 (promote if inventory is machine-readable) |
| Structured logging + Sentry + health endpoint | MEDIUM | MEDIUM | P2 |
| Zod validation at every handler boundary | MEDIUM | HIGH | P2 |
| Service/data-access layer extraction | MEDIUM | HIGH | P2 |
| Adversarial dataset | MEDIUM | MEDIUM-HIGH | P2 |
| Dual date schema + tag mapping consolidation | MEDIUM | MEDIUM | P2 |
| RSVP count + events-join performance fixes | MEDIUM | LOW | P2 |
| Scale dataset + k6 thresholds | MEDIUM | MEDIUM | P2 |
| Rate limiting on `/api/admin/*` | MEDIUM | LOW | P2 |
| CSRF protection | MEDIUM | MEDIUM | P2 |
| SBOM, Renovate, CI audit gate | LOW-MEDIUM | LOW | P2 |
| Distributed rate limiter | LOW-MEDIUM | MEDIUM | P3 |
| Declarative schema migration | LOW (now) | MEDIUM-HIGH | P3 |
| Visual regression / a11y | LOW | MEDIUM | P3 |
| Chaos probe (Supabase down) | LOW | MEDIUM | P3 |

---

## Reference Program Comparison

| Practice area | Supabase production checklist | Security-audit convention (ASVS/SOC2-shaped) | Legacy-refactor convention (Feathers) | This program's approach |
|---|---|---|---|---|
| Authorization | RLS on every table, explicit policies, network restrictions, MFA, SSL enforcement | Verify per-role, per-object access; deny by default | — | Stage 1 RLS heatmap → Stage 3 policy fixes → Stage 4 pgTAP allow/deny per table + persona matrix |
| Finding handling | — | Stable ID, exposure-adjusted severity, evidence, repro, remediation, retest-before-closure | — | Adopted verbatim as the Stage 1 finding schema; drives Stage 3 slice scoping and the Stage 4 gate |
| Dependency risk | — | Prod-vs-dev split, reachability, documented exceptions with expiry | — | Stage 2 policy written before scanning; `--omit=dev` CI gate; reachability per High/Critical |
| Change safety | DB branching to test migrations | — | Characterize behavior first, introduce seams, change in small steps | Stage 3 = characterize → refactor → verify, one slice per commit, bottom-up |
| Data for tests | Load test on staging, never prod data | — | Golden-master inputs recorded from real behavior | Three seeded datasets (functional/adversarial/scale), fixed seeds, local + staging only |
| Resilience | Daily backups, PITR, read replicas, upgrade path | Recovery tested, not merely configured | — | Stage 4 measures RTO by an actual restore and observes an actual alert |

## Sources

- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — HIGH (official)
- [Supabase Testing Overview / pgTAP](https://supabase.com/docs/guides/local-development/testing/overview) — HIGH (official)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH (official)
- [Supabase CLI `db diff`](https://supabase.com/docs/reference/cli/supabase-db-diff) and [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — HIGH (official)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups) / [PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery) — HIGH (official)
- [Vercel Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers) and [Edge Network caching](https://vercel.com/docs/edge-network/caching) — HIGH (official)
- [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) / [`vercel rollback`](https://vercel.com/docs/cli/rollback) — HIGH (official)
- [Playwright Authentication](https://playwright.dev/docs/auth) — HIGH (official)
- [Testing RLS Policies with pgTAP — Blair Jordan](https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602) and [Basejump pgTAP guide](https://usebasejump.com/blog/testing-on-supabase-with-pgtap) — MEDIUM (community, corroborated by official docs)
- [Playwright storageState multiple roles pattern](https://qaskills.sh/blog/playwright-storage-state-multiple-roles-setup) — MEDIUM
- [npm audit triage: which to fix vs ignore](https://www.decryptiondigest.com/blog/npm-audit-which-vulnerabilities-to-fix-vs-ignore) and [JavaScript dependency scanning beyond npm audit](https://safeguard.sh/resources/blog/javascript-dependency-vulnerability-scanning) — MEDIUM
- [Characterization test (Feathers)](https://en.wikipedia.org/wiki/Characterization_test) and [Golden master testing](https://www.fabrizioduroni.it/blog/post/2018/03/20/golden-master-test-characterization-test-legacy-code) — HIGH (established practice)
- [Security vulnerability report template](https://www.vulnsy.com/blog/security-vulnerability-report-template) and [SOC 2 CC7.1 vulnerability management evidence](https://dev.to/patchvex/soc-2-cc71-what-auditors-actually-ask-for-in-vulnerability-management-15lg) — MEDIUM
- [Deterministic fake data for PostgreSQL](https://mortenson.coffee/blog/deterministic-fake-data-postgresql-ripoff/) and [Prisma/Postgres test isolation via transactions](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/) — MEDIUM
- [Supabase service_role key security checklist](https://checkvibe.dev/blog/secure-nextjs-supabase-app) — MEDIUM
- Repository evidence gathered 2026-09-13: 92 `route.ts` handlers, 43 `page.tsx` files, 45 migrations in 3 naming schemes, ~28 tables referenced from `src/`, buckets `avatars`/`banners`, `load-tests/k6-onboarding.js` + `k6-online-users.js`, `src/lib/ban.ts` permanent-vs-expiring semantics, `20260315000002_soft_delete.sql` (`events.deleted_at`) — HIGH (direct observation)
- `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,CONCERNS,TESTING}.md`, `CLAUDE.md` — HIGH for stated intent, MEDIUM for codebase claims (map dated 2026-03-05, to be re-verified by Stage 1)

---
*Feature research for: foundation audit/stabilize/refactor/certify program, Next.js 16 + Supabase + Vercel*
*Researched: 2026-09-13*
