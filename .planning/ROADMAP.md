# Roadmap: Uni-Verse Foundation Program

## Overview

This is not a feature milestone. Uni-Verse already works; what is unknown is whether it works *correctly* — and nothing new should be built on a base nobody has verified. The program runs in four strictly-ordered stages, and the roadmap's eight phases are cuts of those stages, never across them. First the codebase is inventoried read-only, producing a finding register with a reproduction and a validation criterion for every defect (Phase 1). Then the dependency tree is pinned, patched, and made reproducible, and the 220 tests that already pass are wired up to actually gate changes (Phase 2). Then the refactor: schema truth, generated types, a server seam, and a persona test harness land first (Phase 3), because a vertical slice cannot refactor a layer that does not exist; then the seam is proven on the two highest-traffic workflows (Phase 4), then applied to the authorization core where the blast radius is highest (Phase 5), then to the asynchronous edge and the close-out that finally deletes the blanket cache header (Phase 6). Finally, three datasets and a thirteen-persona test matrix prove what the app allows and denies (Phase 7), and load, rollback, restore, alerting, and chaos drills prove the system operates — ending in a written certification that the foundation is ready for the next milestone (Phase 8).

The through-line is behavior preservation. Every phase after Phase 1 re-confirms the Validated workflow list in PROJECT.md. If a foundation change breaks a workflow that worked before, the program has failed.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Stage gates:** Phases 2–8 may not start until the prior stage's exit gate is evidenced. Phase 1 is the Stage 1 gate, Phase 2 is the Stage 2 gate (STAB-17), Phases 3–6 are Stage 3, Phases 7–8 are Stage 4 (ending at CERT-20).

- [x] **Phase 1: Read-Only Foundation Audit** - Inventory and assess everything with evidence; change nothing (completed 2026-09-14)
- [x] **Phase 2: Dependency and Runtime Stabilization** - Pin, patch, and make the tree reproducible; make the test suite gate changes (completed 2026-09-15)
- [x] **Phase 3: Refactor Foundations — Schema Truth and the Seam Kit** - Reconcile schema, generate types, build the server seam, the persona harness, and the seed (completed 2026-09-16)
- [ ] **Phase 4: Slices 1–2 — Saved Events/RSVP and the Event Read Path** - Prove the seam on the two highest-traffic workflows and settle the event data shape
- [ ] **Phase 5: Slices 3–5 — Auth, Club Authorization, Admin Containment** - One fails-closed authorization ring; cross-tenant and escalation paths denied twice
- [ ] **Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability** - Credential the edge, validate every input, kill the shared cache on personalized routes, make failures visible
- [ ] **Phase 7: Certification Datasets and Persona Coverage** - Three datasets and a 13-persona matrix proving what is allowed and what is denied
- [ ] **Phase 8: Operational Certification and Sign-Off** - Load, rollback, restore, alerting, chaos — then the written certification

## Phase Details

### Phase 1: Read-Only Foundation Audit

**Goal**: The true current state of the codebase is known with captured evidence — every endpoint, page, policy, dependency, and risk inventoried, and every finding recorded with a reproduction and a validation criterion — without a single source, config, dependency, or database change.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06, AUDIT-07, AUDIT-08, AUDIT-09, AUDIT-10, AUDIT-11, AUDIT-12, AUDIT-13, AUDIT-14, AUDIT-15, AUDIT-16, AUDIT-17, AUDIT-18, AUDIT-19, AUDIT-20, AUDIT-21
**Success Criteria** (what must be TRUE):

  1. `.planning/audit/` holds committed live schema snapshots (production, staging, local), the three-way prod-vs-migrations-vs-types drift table, machine-readable inventories of all 94 handlers and 43 pages, the RLS policy review and coverage heatmap from live `pg_policies`, the `createServiceClient()` callsite register with a per-callsite bypass justification, the cron/webhook inventory, the storage bucket policy review, the dependency and dead-code reports, and the client-bundle secret sweep.
  2. The cache/personalization exposure matrix classifies every handler by whether its body varies by user and what `Cache-Control` it actually emits, and includes the empirical two-session curl test against production recording `x-vercel-cache` and `age` — so the `s-maxage=60` question is answered by evidence, not reasoning.
  3. A reviewer can answer, from the artifacts alone without reading source: which authorization checks fail open, which `getSession()` calls gate authorization, which cron and webhook triggers actually fire, which `events` date columns are authoritative per `information_schema.columns`, and which trust boundaries are exposed (three one-page threat models: anonymous → app, student → other tenants, organizer → admin).
  4. `FOUNDATION_AUDIT.md` exists where every finding carries a stable `F-nnn` id, exposure-adjusted severity with rationale, category, affected paths with line numbers, captured evidence, reproduction steps, recommended fix, validation criterion, and status — accompanied by a written severity SLA policy stating when each level must be fixed.
  5. The test/build/lint/type-check baseline is actual captured command output (including Jest pass/skip counts and a reason per skipped suite, and the test-runner decision with its mock-call evidence), and `git diff` for the phase touches nothing outside `.planning/`.

**Plans**: 13/13 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Audit harness: read-only guard, baseline captures, zero-dependency validator, three JSON schemas, blocking-input request, severity SLA

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Endpoint inventory: merging generator, 94 signal rows, derived CSV review view
- [x] 01-03-PLAN.md — Build-derived surface: reachable-route table, 43-row page inventory with both auth rings, client-bundle secret sweep
- [x] 01-04-PLAN.md — Toolchain baseline: verbatim test/type-check/lint capture, test-runner decision with mock-call evidence
- [x] 01-05-PLAN.md — Dependency reachability and dead code: pinned one-shot tools, per-advisory reachability, API-doc reachability answer, disposition report
- [x] 01-06-PLAN.md — Read-only SQL transport, three schema snapshots, authoritative events date columns

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-07-PLAN.md — Static authorization registers: service-role, session-reading, fail-open, plus quantified observability
- [x] 01-08-PLAN.md — Three-way schema drift table from migration history and the shadow-database diff
- [x] 01-09-PLAN.md — RLS policy review from live policies and the table-by-command-by-role coverage heatmap
- [x] 01-10-PLAN.md — Storage bucket policy review and the six-source cron and webhook inventory

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-11-PLAN.md — Endpoint and page classification, including the 13-persona expectation matrix

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-12-PLAN.md — Production two-session cache exposure probe with a positive control

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-13-PLAN.md — Three threat models, the F-nnn finding register in both representations, and the phase gate

### Phase 2: Dependency and Runtime Stabilization

**Goal**: The toolchain and dependency tree are pinned, patched, and reproducible, and the test suite that already passes is wired to actually gate changes — so Stage 3 refactors land on a bisectable base.
**Depends on**: Phase 1 (Stage 1 gate — no dependency change may start before the audit baseline is captured)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06, STAB-07, STAB-08, STAB-09, STAB-10, STAB-11, STAB-12, STAB-13, STAB-14, STAB-15, STAB-16, STAB-17
**Success Criteria** (what must be TRUE):

  1. A clean-room install (`rm -rf node_modules && npm ci` in a fresh checkout) succeeds and builds on the pinned Node/npm from `engines` and `.nvmrc`, with the output captured as evidence; `package-lock.json` changes were reviewed as diffs, never regenerated wholesale, and `npm audit fix --force` was never used.
  2. `npm test` exists and runs Jest as the single test runner — Vitest orphans deleted, `jest-environment-jsdom` and testing-library installed so the previously-skipped `.tsx` suites actually run — and CI runs it plus `npm audit --audit-level=high --omit=dev` on every pull request.
  3. `vercel` is gone from production dependencies with the devDependency decision recorded; Next.js is on the patched release as its own commit with `react` and `react-dom` untouched; `middleware.ts` → `proxy.ts` landed as its own gated change with rate-limiting and ban-check behavior smoke-tested before and after; Swagger/Redoc disposition matches the AUDIT-12 reachability answer.
  4. Every Validated workflow in PROJECT.md still works: each upgrade batch is one labeled commit followed by lint, type-check, test, build, and a smoke pass, with any major upgrade isolated behind its own migration note.
  5. A Stage 2 completion note evidences the exit gate — no unexplained Critical production vulnerabilities, no reachable High without a dated owner-signed exception against the written vulnerability policy, reproducible install, checks green at or better than the AUDIT-13 baseline, reviewed lockfile — alongside a committed CycloneDX SBOM, Renovate/Dependabot configuration, and before/after bundle size.

**Plans**: 11/11 plans complete

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Toolchain floor: Node 24 pin across engines/.nvmrc/CI, `npm test` script, CI test step, Vitest and Playwright residue deleted
- [x] 02-02-PLAN.md — Wave 0 instruments: rate-limit and matcher characterization suites, zero-dependency baseline comparator, Tier 2 smoke script
- [x] 02-03-PLAN.md — Written vulnerability policy (before any scan-driven change) and the npm devdir four-scope probe

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — Batch 1 removals: Vercel CLI, Swagger UI and companions, 8 further dead declarations, dead Radix wrapper, tailwindcss-animate relocated; STAB-16 before capture

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — Batch 2: Next.js to the re-verified patched release alone, react/react-dom untouched, image-optimization config comment

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-06-PLAN.md — Batch 3: atomic `middleware.ts` → `proxy.ts` migration behind before/after characterization and the protected-route smoke

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-07-PLAN.md — Batch 4: patch/minor remediation, Redoc patched, Supabase SDK as its own sub-commit with a defer rule, interim clean room

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-08-PLAN.md — Batch 5: jsdom and testing-library installed, two-project Jest config, 4 suites un-skipped, 5th dispositioned

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-09-PLAN.md — Batch 6a: CI production vulnerability gate added last, final census, exception register filled
- [x] 02-10-PLAN.md — Batch 6b: CycloneDX SBOM, Renovate configuration, two-family bundle-size delta

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 02-11-PLAN.md — Batch 6c: clean-room reproducible install, finding register reconciled to the roadmap, stale docs corrected, Stage 2 completion note

### Phase 3: Refactor Foundations — Schema Truth and the Seam Kit

**Goal**: The schema, the generated types, the server seam, the persona test harness, and the deterministic seed all exist and agree with production — so a vertical slice has a layer to refactor into and a net to fall into.
**Mode:** mvp
**Depends on**: Phase 2 (Stage 2 exit gate STAB-17 must be evidenced before any refactor begins)
**Requirements**: REFAC-01, REFAC-02, REFAC-03, REFAC-04, REFAC-05, REFAC-06, REFAC-07, REFAC-08
**Requirement states** *(recorded 2026-09-16 by plan 03-08; these must agree with `.planning/REQUIREMENTS.md` and they do)*: **REFAC-02, REFAC-03, REFAC-05, REFAC-06 and REFAC-08 are Complete.** **REFAC-01, REFAC-04 and REFAC-07 are PARTIAL**, each naming its unmet clause — REFAC-01's `migration repair` against production (deferred, Phase 8), REFAC-04's cast count at 45 of 47 (Phase 4 / Phase 5), and REFAC-07's "and staging" clause (no staging project exists). **None of those three clauses is a clause of the five success criteria below, all of which are MET** — see `evidence/FOUNDATION-READINESS.md` section 11 for why a met criterion does not round a requirement up.
**Success Criteria** (what must be TRUE):

  1. `supabase db reset` from the migrations folder produces a schema that diffs clean against production (reconciled by baseline plus `migration repair`, never by renaming existing files), with audit-identified missing FK indexes and RLS policy gaps fixed by new migrations that each carry a pgTAP allow/deny test, and the `compute_user_scores` pg_cron schedule codified as an idempotent migration so local and staging match production instead of silently falling back to popularity.
  2. Supabase types are generated by `supabase gen types` from the reconciled schema, a CI step fails on type drift, and `(supabase as any)` casts in `src/` count zero.
  3. `src/server/` exists with request context computed once per request, http/error helpers, `requireUser`/`requireRole`/`requireClubRole`, and `src/server/db/elevated/` as the only door to the service-role client — applied to zero routes so far — with an ESLint import-boundary rule that fails the build when `src/app/**` imports the service-role client directly.
  4. A Playwright persona harness runs against local Supabase with one storage state per persona from a setup project and at least six happy-path specs covering Validated workflows, backed by a deterministic seed (fixed UUIDs, fixed timestamps against a pinned now, fixed PRNG seed) covering every user role, ban state, club status, and event status — whose loader hard-refuses any Supabase URL outside local and staging.
  5. The auth callback route has passing characterization tests (OAuth exchange, McGill enforcement, user upsert, admin auto-assignment, onboarding routing) written before anything modifies it.

**Plans**: 8/8 plans complete

Plans:
**Wave 1** *(three independent tributaries — none touches a database)*

- [x] 03-01-PLAN.md — Preflight and production transport: free the Supabase ports, re-scope the MCP endpoint read-only, capture the AR-12 envelope, answer Q1, write the migration-filename checker captured RED
- [x] 03-02-PLAN.md — Auth callback characterization: eight behaviours against unmodified source, each mutation-checked, route file provably untouched
- [x] 03-03-PLAN.md — The seam kit: `src/server/` context, http/errors, three authz guards, the single elevated door, plus the ESLint import boundary with an escaped-bracket shrink-only ratchet — applied to zero routes

**Wave 2** *(the critical path, alone — blocked on 03-01)*

- [x] 03-04-PLAN.md — Migration reconciliation: 44 files archived as 44 pure renames, baseline pulled from production, policy census cross-checked by name, `db reset` green and `db diff` empty

**Wave 3** *(blocked on 03-04)*

- [x] 03-05-PLAN.md — Schema fixes with tests that bite: FK indexes, the audit-named RLS policy gaps, the idempotent scoring schedule, pgTAP allow/deny pairs, and an automated mutation-check harness

**Wave 4** *(blocked on 03-05)*

- [x] 03-06-PLAN.md — Generated types and cast retirement: regenerated from the reconciled schema, a CI drift gate proven red-then-green, **45 of 47 casts removed (D-22, not zero)**, three latent defects characterized and registered. REFAC-04 is PARTIAL: the cast clause closes in Phase 4 (F-071) and Phase 5 (F-072/F-073)

**Wave 5** *(blocked on 03-05 and 03-06)*

- [x] 03-07-PLAN.md — Deterministic seed and persona harness: two loads byte-identical (sha256 `964ac785…`, re-derived three times), a fail-closed guard watched refusing five wrong targets, 21 pgTAP coverage assertions that SKIP honestly when unseeded, ten storage states verified **through the running application**, and 27 end-to-end tests green from a clean database. **REFAC-06 met; REFAC-07 is PARTIAL** — only its "and staging" clause is outstanding, because no staging project exists to load into. Two application-source defects registered rather than fixed: D-21 (the CSP has no local-development entry, so client-side sign-in is broken against a local stack for every developer) and D-22 (the moderation deep-link is ignored)

**Wave 6** *(blocked on all)*

- [x] 03-08-PLAN.md — The gated production-repair decision, resolved to **`defer-to-phase-8`** with production provably unwritten (45 rows, baseline absent, sha256 identical to the 03-01 census), and the Stage 3 readiness note: all five success criteria answered clause by clause across **107 distinct committed citations, 0 missing**, all eight requirement states with every partial naming its unmet clause, a consolidated deferred register disambiguating the two colliding `D-` sequences (`DI-` items, `DEC-` decisions), five findings closed and two reassigned. Two things it found rather than inherited: `DI-19`'s ratchet false positive **fixed** as a census-only change with the allow-list byte-identical, and `DI-32` — **the CI `e2e` job is RED on a real runner**, diagnosed to the line and reproduced, so the persona harness has never been observed outside one machine

### Phase 4: Slices 1–2 — Saved Events/RSVP and the Event Read Path

**Goal**: The seam kit is proven end-to-end on the two highest-traffic user workflows, and the data-shape confusion sitting under the event read path is settled before anything downstream depends on it.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: REFAC-09, REFAC-10
**Success Criteria** (what must be TRUE):

  1. Saved-events and RSVP handlers run through the seam kit, RSVP counts come from a count query or DB function instead of loading all rows, and characterization tests tagged PRESERVE or DEFECT (referencing their `F-nnn`) pass before and after the refactor.
  2. The events list returns clubs from a real join instead of fabricating club objects, and the dual date schema is resolved to the authoritative columns determined in AUDIT-19.
  3. Tag mapping is centralized with unknown tags surfaced rather than silently coerced to SOCIAL, and `%` and `_` are escaped in search input.
  4. After each slice the Playwright happy-path specs pass and the Validated workflow list in PROJECT.md is re-confirmed — browse, search, filter, save, and RSVP behave exactly as before, with no intentional visual change shipped alongside either slice.

**Plans**: 1/11 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Re-measured floor, F-079..F-085 registered (F-050 moved to Phase 4), PRESERVE/DEFECT tag gate, DEC-23..DEC-32 decision record (DEC-32: F-082 exempt from the owner checkpoint, argued), DI-25 sites enumerated

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02-PLAN.md — Slice 1 characterization: in-memory Supabase fake, save/saved-events/calendar/RSVP PRESERVE suites, F-079 and F-085 DEFECT pins, harness additions for the API path and reload-time counts
- [ ] 04-03-PLAN.md — Seam controls: elevated boundary and ratchet widened to src/ (DI-34), dynamic-import and bare-key evasions closed plus CI wiring (DI-31), request profile narrowed (DI-35)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-04-PLAN.md — Slice 2 characterization: list and detail PRESERVE suites, F-080/F-081/F-082/F-083 DEFECT pins, read-path Playwright spec against the real PostgREST
- [ ] 04-05-PLAN.md — Slice 1 refactor: seam adoption in five handlers (byte-preserving), head-count RSVP queries (F-079), friends fallback fixed and uncast (F-071) — three commits

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-06-PLAN.md — Slice 1 close: stale date fixtures (F-050), test files type-checked (DI-24, F-066), after-floor, harness, Validated-list re-confirmation

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 04-07-PLAN.md — Tag mapping centralized in src/lib/eventTags.ts, unknown tags surfaced non-visually, completeness test
- [ ] 04-08-PLAN.md — Search input escaped via src/lib/searchFilter.ts (F-082), proven by a local-only live probe (A2)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 04-09-PLAN.md — Cursor pagination contract in the route (F-083), skipped suite rewritten and running (F-066), Playwright traversal

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 04-10-PLAN.md — Club fabrication, non-visual half: shared club embed with real link columns, saved-events real join, join latency measured (A4)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 04-11-PLAN.md — Owner checkpoint on the two seeded-visible fixes (F-080 detail host, F-081 badges; default defer), then phase close-out and the completion note

**UI hint**: yes

### Phase 5: Slices 3–5 — Auth, Club Authorization, Admin Containment

**Goal**: Authorization decisions happen in exactly one fails-closed place, cross-tenant and privilege-escalation paths are denied at both the authz ring and the RLS ring, and the service-role client has exactly one registered door.
**Mode:** mvp
**Depends on**: Phase 4 (the characterization harness from Slices 1–2 must exist before the highest-blast-radius change in the program)
**Requirements**: REFAC-11, REFAC-12, REFAC-13, REFAC-17, REFAC-18
**Success Criteria** (what must be TRUE):

  1. Every authorization decision uses `getUser()` rather than `getSession()`, middleware is advisory-only, the ban check fails closed instead of letting a thrown error through, the onboarding guard cannot be bypassed by direct API calls, and env-var non-null assertions are replaced with validated config.
  2. The 19 hand-rolled club-membership checks collapse into `requireClubRole`, and a cross-club access attempt returns 403 at the authz ring and is independently denied at the RLS ring.
  3. Every fail-open endpoint fails closed, `verifyAdmin()` guards every admin route, and every remaining service-role use goes through `src/server/db/elevated/` with a registered justification.
  4. Rate limiting runs from a distributed store so it holds across serverless instances and now covers `/api/admin/*`; CSRF exposure is assessed against Supabase cookie SameSite behavior and protection added on state-changing routes wherever exposure remains.
  5. After each of the three slices the Playwright specs pass and the Validated workflow list is re-confirmed — in particular every persona can still sign in, non-McGill sign-in is still rejected, banned users are still blocked, and organizers still reach their club surfaces.

**Plans**: TBD

### Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability

**Goal**: The asynchronous edge is credentialed and characterized, every handler validates its input, personalized responses stop being shareable by the CDN, and a failure in production becomes visible — closing Stage 3 with the behavior it started with.
**Mode:** mvp
**Depends on**: Phase 5 (the cache default cannot be inverted until every route is classified and refactored)
**Requirements**: REFAC-14, REFAC-15, REFAC-16, REFAC-19, REFAC-20, REFAC-21, REFAC-22, REFAC-23
**Success Criteria** (what must be TRUE):

  1. Cron and webhook routes require credentials and fail closed when they are absent, and the recommendation API surface is characterized input → ranked output with the scoring formula left unchanged.
  2. Every handler validates input with a zod schema from `src/contracts/` at its boundary and returns a consistent 400 shape on malformed input, with the same schemas exported and reused by client hooks so client and handler cannot drift.
  3. The blanket `s-maxage=60` is gone from `vercel.json`, personalized routes return `private, no-store`, public routes opt in to caching explicitly, and a cross-user cache regression test passes.
  4. Server code emits structured JSON logs with levels and a request correlation id on both Node and middleware runtimes, a deliberately triggered error appears in Sentry carrying that correlation id (Turbopack-aware setup, source maps, environment and release tagging, PII scrubbing decided before install), and `/api/health` reports DB, auth, storage, pg_cron freshness, and last webhook receipt in a documented shape without using `getSession()` for access control.
  5. After the final slice the Playwright happy-path specs pass and every Validated workflow in PROJECT.md is re-confirmed, with each slice landing as one reviewable change naming the finding IDs it closes and any intentional behavior change logged.

**Plans**: TBD

### Phase 7: Certification Datasets and Persona Coverage

**Goal**: Three datasets and a persona-driven test suite exist that prove, for every role and every workflow, that the app allows exactly what it should and denies everything else.
**Mode:** mvp
**Depends on**: Phase 6 (Stage 3 must be complete — certification is only credible against a stable, classified, characterized codebase)
**Requirements**: CERT-01, CERT-02, CERT-03, CERT-04, CERT-05, CERT-06, CERT-07, CERT-08, CERT-09, CERT-10, CERT-19
**Success Criteria** (what must be TRUE):

  1. Deterministic, adversarial, and scale datasets load idempotently into local and staging and re-run cleanly after `supabase db reset` — the functional set covering every entity, role, ban state, status, and edge case; the adversarial set covering malformed input, injection-shaped strings, unsafe links, duplicates, America/Toronto timezone and DST cases, expired content, cross-tenant probes, auth and upload abuse; the scale set generated from a fixed seed with a skewed popularity distribution — and the loader refuses any Supabase URL outside the allowlist.
  2. The 13-persona × workflow matrix executes with an asserted expected outcome per cell, including the personas usually skipped (mid-onboarding, expired suspension, machine callers with absent credentials, non-McGill sign-in).
  3. A generated persona × endpoint authorization matrix, data-driven from the AUDIT-03 inventory, asserts the expected status for every endpoint × persona and fails on any unclassified endpoint.
  4. pgTAP RLS allow/deny tests exist per table using `set local role` impersonation, asserting affected row counts in both directions rather than `lives_ok` alone, with a CI guard that fails if any RLS test file references the service-role client.
  5. Playwright E2E specs cover every Validated critical workflow with per-persona storage state and no shared mutable accounts, every endpoint has an authenticated-vs-anonymous assertion plus a cross-tenant probe, every page has a smoke test asserting load, no console error or unhandled rejection, and correct auth redirect, a cross-user cache-exposure test proves no A-data and no shared-cache HIT — and CI runs the pgTAP and Playwright suites against a seeded local Supabase on every pull request.

**Plans**: TBD

### Phase 8: Operational Certification and Sign-Off

**Goal**: The system is proven to hold under load, to fail visibly, and to be recoverable — and the foundation is declared certified so the next milestone can start.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: CERT-11, CERT-12, CERT-13, CERT-14, CERT-15, CERT-16, CERT-17, CERT-18, CERT-20
**Success Criteria** (what must be TRUE):

  1. Every Critical and High finding in `FOUNDATION_AUDIT.md` is closed by its own validation criterion passing, or carries a dated, owned, written risk acceptance.
  2. k6 load tests against the scale dataset on staging — extended from the existing scripts with event-list and event-detail hot paths — pass p95 latency and error-rate thresholds that were stated before the run, and staging configuration is diffed against production (env vars, `vercel.json`, RLS state, extensions).
  3. A production deploy followed by a real `vercel rollback` is confirmed serving the prior build with deployment ids and timestamps recorded, and a Supabase backup restored into a scratch or staging project yields a measured RTO with PITR status confirmed and the restore drill scheduled to recur.
  4. A deliberately triggered error and a downtime condition each produce an alert a human observes receiving with the Sentry event and correlation id retrievable, and a chaos probe with Supabase unreachable shows recommendations falling back to popularity and pages rendering an error state rather than crashing.
  5. A written certification report states what was tested, by which persona, with which dataset, what passed, what is accepted risk, and declares the foundation certified for the next milestone.

**Plans**: TBD

## Cross-Cutting Disciplines

These apply inside every Stage 3 phase (4, 5, 6) even though each requirement maps to a single phase for traceability:

- **Characterize first (REFAC-23 discipline).** Every slice writes characterization tests before it refactors, tags each PRESERVE or DEFECT against an `F-nnn`, refactors, then verifies the same workflow. DEFECT tests are expected-to-fail until the fixing slice lands, so a known bug is never frozen as the contract.
- **Harness after every slice.** The Playwright happy-path specs (REFAC-06) run and the Validated workflow list in PROJECT.md is re-confirmed at the end of each slice, not only at the end of the phase. REFAC-23 is mapped to Phase 6 because that is where the full across-all-slices re-confirmation is evidenced.
- **Contracts as you go.** `src/contracts/` schemas are written for each slice's handlers as that slice lands. REFAC-15/REFAC-16 are mapped to Phase 6 because "every handler" is only verifiable once the last slice is done.
- **One reviewable change per slice**, naming the finding IDs it closes, with intentional behavior changes logged. No new product features, no intentional visual changes.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Stage boundaries are hard gates: 1 (Stage 1) → 2 (Stage 2, exit STAB-17) → 3–6 (Stage 3) → 7–8 (Stage 4, exit CERT-20).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Read-Only Foundation Audit | 13/13 | Complete    | 2026-09-14 |
| 2. Dependency and Runtime Stabilization | 11/11 | Complete   | 2026-09-15 |
| 3. Refactor Foundations — Schema Truth and the Seam Kit | 8/8 | Complete    | 2026-09-16 |
| 4. Slices 1–2 — Saved Events/RSVP and the Event Read Path | 1/11 | In Progress|  |
| 5. Slices 3–5 — Auth, Club Authorization, Admin Containment | 0/TBD | Not started | - |
| 6. Slices 6–7 — Async Edge, Contracts, Caching, Observability | 0/TBD | Not started | - |
| 7. Certification Datasets and Persona Coverage | 0/TBD | Not started | - |
| 8. Operational Certification and Sign-Off | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-13*
*Coverage: 81/81 v1 requirements mapped*
