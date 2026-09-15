# Phase 3: Refactor Foundations — Schema Truth and the Seam Kit — Research

**Researched:** 2026-09-15
**Domain:** Supabase migration reconciliation · generated types · a Next.js 16 server seam · Playwright persona harness · deterministic seed · route characterization
**Confidence:** HIGH on the toolchain and the seam (verified live in this tree), MEDIUM on the migration-recovery path (one decisive unknown, named in § Open Questions Q1)

---

## Phase Constraints

**No `CONTEXT.md` exists for this phase — there was no discuss-phase.** There are therefore no locked user decisions to copy verbatim. What follows is the equivalent binding set, assembled from `PROJECT.md § Constraints`, `REQUIREMENTS.md § Stage 3` preamble, `ROADMAP.md` Phase 3, and the two inherited-obligation documents. **The planner must treat these with the same authority as locked decisions.** Anything not listed here is Claude's discretion.

### Locked (upstream, not negotiable in this phase)

| # | Constraint | Source |
|---|---|---|
| L1 | **Behavior preservation.** Every Validated workflow in `PROJECT.md` must still work. "If a foundation change breaks a workflow that worked before, the program has failed." | PROJECT.md § Core Value |
| L2 | **Characterize first.** Every REFAC item writes a test capturing current behavior *before* refactoring, tagged `PRESERVE` or `DEFECT` against an `F-nnn`. DEFECT tests are expected-to-fail until their fixing slice lands. | REQUIREMENTS.md § Stage 3 preamble |
| L3 | **The seam is applied to ZERO routes in this phase.** `src/server/` exists and is tested; not one handler under `src/app/api/**` is rewritten to use it. | REFAC-05, ROADMAP SC3 |
| L4 | **Never rename existing migration files.** Reconciliation is "baseline + `migration repair`". | REFAC-01 |
| L5 | **No production data injection.** The seed loads into local and staging only, and the loader hard-refuses any other Supabase URL. | PROJECT.md § Constraints, REFAC-07 |
| L6 | **Never modify `.env.local`.** McGill email enforcement stays in place. | CLAUDE.md, PROJECT.md |
| L7 | **Jest 30 + ts-jest is the only unit runner.** Two projects (`node`, `jsdom`); routing is not by extension. No Vitest. | .claude/CLAUDE.md, `jest.config.js` |
| L8 | **Node 24 / npm ≥11 pinned in three places that must agree**; React stays 18.3; lockfile reviewed as a diff, never regenerated; `npm audit fix --force` never used. | STAB-01/10/11, `check-baseline.mjs` |
| L9 | **Bottom-up order.** This phase is the schema → types → auth-seam → harness layer. Nothing from Phases 4–6 (route refactors, zod contracts, cache header, Sentry, distributed rate limiting) is in scope. | PROJECT.md § Constraints, ROADMAP |
| L10 | **AR-12 registration.** Every plan's `<threat_model>` must register (a) the Supabase MCP server as a privileged production transport and (b) the laptop service-role write path. Every production read must run through a server-enforced read-only transport **or** capture a `transaction_read_only = on` envelope. | 01-SECURITY.md AR-12 → 02-SECURITY.md § Residuals |
| L11 | **The deploy path is a boundary.** The Vercel project is not git-linked; a push does not deploy; previews sit behind Deployment Protection; `public/brand` broke every deploy from May 2026 until `d14456b`. | 02-SECURITY.md § Note for Phase 3 planning |

### Claude's discretion (no upstream decision exists)

- Which reconciliation mechanism inside "baseline + repair" (recover-from-history vs. squash-to-baseline) — **§ Open Questions Q1 decides this on evidence, not preference**.
- Whether production's `supabase_migrations.schema_migrations` is repaired in this phase or the repair is staged behind a human checkpoint (recommendation in § Pattern 2).
- Playwright directory layout, config shape, and the six happy-path spec subjects (recommendation in § Validation Architecture).
- Seed persona count and content beyond the required coverage matrix.
- Whether the inherited `tsconfig` test-file exclusion (F-066 half two) lands in this phase.

### Deferred / out of scope for this phase (do not plan)

- Applying the seam to any route (`REFAC-09`…`REFAC-14`, Phases 4–6).
- `zod` and `src/contracts/` (`REFAC-15`/`16`, Phase 6). **`zod` is not a production dependency today** — it appears only transitively under `eslint-plugin-react-hooks`.
- Deleting the blanket `s-maxage=60` (`REFAC-19`, Phase 6). `F-025` stays Open at Critical through this phase.
- Distributed rate limiting, CSRF, Sentry, structured logging, `/api/health` (Phases 5–6).
- The adversarial and scale datasets, the 13-persona × endpoint matrix, and per-table RLS coverage (`CERT-*`, Phase 7). Phase 3 ships a **minimal** functional seed and **six** happy-path specs, not certification coverage.
- Fixing the 41-vs-24 policy divergence in full (`F-012`, `closes_in_phase: 05`). Phase 3 fixes only the audit-identified **gaps and missing FK indexes** that REFAC-02 names.

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md`. The planner must verify compliance, not re-derive them.

| Directive | Consequence for this phase |
|---|---|
| Three Supabase client factories; using the wrong one is "a common mistake" | The seam must not become a fourth factory. `src/server/db/elevated/` **wraps** `lib/supabase/service.ts`; it does not re-implement `createClient`. |
| The proxy file is `src/proxy.ts`, not `middleware.ts`; do not re-create `middleware.ts` | Any harness or test that references the auth ring imports `./proxy`. |
| `PROTECTED_ROUTES` at `src/proxy.ts:114` is the only authority — re-derive, do not trust the list | Re-derive with the one-liner in CLAUDE.md before writing any Playwright redirect assertion. |
| Types in `src/types/index.ts` define all data structures — keep in sync with the DB schema | `src/types/index.ts` is **hand-written** and separate from the **generated** `src/lib/supabase/types.ts`. REFAC-04 regenerates the latter; the former is not in scope and must not be conflated. |
| Use the `EventTag` enum, not raw strings | Seed data must use `EventTag` values, not string literals. |
| Test files are excluded from the main tsconfig and run via Jest separately | See § Open Questions Q4 — this exclusion is the unclosed half of `F-066`, inherited by this phase. |
| "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing code | Done. Route-handler `params` is already `Promise<{…}>` in this tree; `cookies()` is async; the DAL pattern is Next's own recommendation (§ Pattern 3). |
| GSD workflow enforcement: no direct repo edits outside a GSD command | Research made **zero** repo edits. Every live experiment ran in an out-of-repo scratch copy with `node_modules` symlinked. |

---

## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| **REFAC-01** | Migration history reconciled with production (baseline + `migration repair`, never renaming files) so `supabase db reset` diffs clean against production | § Migration State Table, § Pattern 1, § Pattern 2, § Open Questions Q1 |
| **REFAC-02** | Missing FK indexes and RLS policy gaps fixed by new migrations, each with a pgTAP allow/deny test | § Pattern 4, § Code Examples 4, § Standard Stack (pgTAP), audit `rls/rls-review.md` §5 and `20260316000004_fk_indexes_and_cleanup.sql` |
| **REFAC-03** | `compute_user_scores` pg_cron schedule codified as an idempotent migration | § Code Examples 5, audit `async/cron-job.json` |
| **REFAC-04** | Types generated via `supabase gen types`; CI fails on drift; `(supabase as any)` = 0 | § Pattern 5, § Code Examples 6, **§ Code Examples 7 — the 9 real errors measured live** |
| **REFAC-05** | `src/server/` seam kit, applied to zero routes, with an ESLint import-boundary rule that fails the build | § Pattern 3, § Code Examples 8 (**rule verified firing live: 46 errors today**), § Pitfall 4 |
| **REFAC-06** | Playwright persona harness: setup project, one storage state per persona, ≥6 happy-path specs against local Supabase | § Pattern 6, § Code Examples 9–10, § Validation Architecture |
| **REFAC-07** | Deterministic seed (fixed UUIDs, pinned `now`, fixed PRNG seed) covering every role/ban/club/event status; loader hard-refuses non-local/staging URLs | § Pattern 7, § Code Examples 11–12 |
| **REFAC-08** | Auth callback characterization tests before anything modifies it | § Pattern 8, **§ Code Examples 13 — four probes executed green against unmodified source** |

---

## Summary

This phase has one hard problem and four tractable ones, and the plan should be shaped around that asymmetry.

**The hard problem is REFAC-01.** The repository and production do not disagree at the margin; they describe two different databases. Production reports **45 applied versions**; the folder holds **44 files** that collapse to **39 distinct versions** because of **four collision groups covering nine files**; the two sets **overlap in only 27 versions**. **Eighteen versions are applied in production with no file in the repository** — bare timestamps with no recorded name, seventeen of them inside a 36-hour burst on 2026-03-15/16, the shape the dashboard SQL editor writes. **Twelve local files were never applied.** One file (`008b_add_is_admin_to_users.sql`) does not parse as `<version>_<name>.sql` and the CLI *skips it with exit status 0* — a silent skip, not a failure. On top of that, **41 of production's 101 RLS policies are declared by no migration and 24 declared policies are absent from production**. `supabase db reset` aborts at the **12th of 44 files** on a duplicate `schema_migrations` primary key, and that same abort is why `supabase db diff` was blocked in Phase 1: `db diff` builds its shadow by replaying exactly these files. Nothing downstream — not the type drift check, not pgTAP, not the seed, not Playwright — can run until a `db reset` completes. **This is the phase's critical path and everything else queues behind it.**

**The four tractable problems turned out to be much smaller than their requirement text implies, and this research measured each of them rather than estimating.** (1) `src/lib/supabase/types.ts` is **already generator output** — it opens with `__InternalSupabase.PostgrestVersion: "13.0.5"`, which only `supabase gen types` emits — and the audit found **zero `type-mismatch` rows across 288 reconciled rows**. REFAC-04 is not "replace hand-written types"; it is "nothing regenerates or verifies the generated file." (2) Stripping all **47** `(supabase as any)` casts from a scratch copy of `src/` and running `npx tsc --noEmit` produces **exactly 9 errors across 5 files**, two of which are genuine latent defects the casts were hiding — the whole of REFAC-04's cast clause is a day of work, not a week. (3) The ESLint import-boundary rule was written and run live: it fires **46 errors on 23 files under `src/app/**`** today, which means it *cannot* ship at `error` severity without a ratchet allow-list — and the allow-list has a trap that cost this research a false result (§ Pitfall 4). (4) All four REFAC-08 characterization probes were written and **executed green against the unmodified callback route**; the exact mock seams are in § Code Examples 13, including the one that is not obvious (`ADMIN_EMAILS` is read at module load, so the test needs `jest.resetModules()` + dynamic `import()`).

**Two environmental facts change the plan's shape.** First, **there is no staging environment.** The Phase 1 capture states it plainly: "no staging project exists under this account," and `migration-list.staging.txt` is a deferred-with-reason stub. REFAC-07's "local and staging only" therefore reduces to "local only, with a staging path that is written and untested." Say so; do not plan against an environment that does not exist. Second, **`supabase start` cannot run on this machine today**: ports 54321–54324 and 54327 are held by an unrelated running stack (`supabase_*_PassiveIncomeInvestingDEMO`), the same conflict Phase 1 hit and worked around with an out-of-repo copy. That is a Wave 0 preflight item with a one-command human fix, not a discovery to make mid-execution.

**Primary recommendation:** Sequence the phase as **one critical-path spine plus three independent tributaries**. The spine is Wave 1 preflight (ports, `supabase start`, AR-12-compliant MCP re-scoping) → Wave 2 migration reconciliation to a green `db reset` and a clean `db diff` → Wave 3 REFAC-02/03 migrations with their pgTAP tests → Wave 4 generated types + CI drift gate + the 47 casts → Wave 5 seed + Playwright harness. The tributaries — REFAC-08 (auth callback characterization) and the `src/server/` seam kit — depend on **nothing** in the spine and should start in Wave 1 in parallel, because they are the two items most likely to be squeezed if the migration work overruns, and REFAC-08 is explicitly a *write-the-test-before-anything-touches-it* obligation. Seven plans, five waves.

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Migration history reconciliation | **Database / Storage** | CI | The authority is `supabase_migrations.schema_migrations` and the production catalog; no application code participates. |
| FK indexes, RLS policy gaps | **Database / Storage** | — | Policy and index objects live only in Postgres. The authz ring (`verifyAdmin`, `requireClubRole`) is a *second* ring, not a substitute (`rls-review.md` § 0 fact 3). |
| `compute_user_scores` schedule | **Database / Storage** | — | pg_cron job in production; the repository's only trace is a commented-out `cron.schedule` line in a never-applied file. |
| Generated Supabase types | **Build / CI** | API | Types are produced from the database and consumed by every tier; the *gate* belongs in CI because nothing else can notice drift. |
| Request context, http/error helpers, authz guards | **API / Backend** | — | Next 16 route handlers and Server Components. Not the browser: the proxy is advisory (`F-025` era code comments say so) and the real check must sit next to the data. |
| Service-role containment (`src/server/db/elevated/`) | **API / Backend** | Build / CI (the lint boundary) | The credential is server-only by definition; the *boundary* is enforced at build time because runtime enforcement would require the refactor this phase forbids. |
| Persona storage states | **Browser / Client** | API | `@supabase/ssr` sessions are cookies on the browser context; storage state is a browser artifact. |
| Deterministic seed | **Database / Storage** | API (GoTrue admin) | Public-schema rows are SQL; `auth.users` rows must go through GoTrue's admin API, which owns the auth schema. |
| Auth callback characterization | **API / Backend** | — | The subject is a Route Handler; the test invokes it directly with mocked module seams. |

---

## Production Transport (AR-12) — REQUIRED

Phase 1 accepted the MCP production transport **on condition** that Stage 2+ register it in the threat model and that every production read runs through a server-enforced read-only transport or captures a `transaction_read_only = on` envelope. Phase 2 issued no production reads, so the second clause never fired; the **first clause was not met** and stands carried to this phase. Phase 3 is the first phase that touches a database.

### The current transport is NOT read-only, and there is captured proof

`.planning/audit/raw/prod/transport-identity.json` records the Phase 1 MCP session:

```json
{ "transport": "supabase-mcp execute_sql (Management API)",
  "rows": [{ "role": "postgres", "db": "postgres", "server_version": "17.6",
             "txn_read_only": "off", "captured_at": "2026-09-14 18:23:56.895714+00" }] }
```

`role = postgres`, `txn_read_only = off`. The repository's `.mcp.json` (untracked) is:

```json
{ "mcpServers": { "supabase": { "type": "http", "url": "https://mcp.supabase.com/mcp" } } }
```

— **no scoping parameters at all.** That is exactly why the envelope reads `off`.

### The fix is one URL, and it is documented

The hosted Supabase MCP server accepts three query parameters `[CITED: supabase.com/docs/guides/getting-started/mcp.md]`:

| Parameter | Effect (quoted) |
|---|---|
| `read_only=true` | "Execute all queries as a read-only Postgres user" — applies to `execute_sql` **and** `apply_migration` |
| `project_ref=<id>` | Scopes access to a single project, disabling account-level management tools |
| `features=<groups>` | Enables only the named tool groups, e.g. `database,docs` |

They stack: `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true`.

### Mandated transport policy for every Phase 3 plan

| Read | Transport | AR-12 clause satisfied |
|---|---|---|
| Any production catalog census (columns, policies, indexes, cron jobs, `schema_migrations`) | `node .planning/audit/tools/sql-readonly.mjs` — Management API with `read_only: true` **enforced server-side, outside the client's reach** | Clause 2 by construction |
| Any production read issued through MCP | `.mcp.json` re-scoped to `?project_ref=<PROD-PROJECT-REF>&read_only=true`, **and** a fresh `transport-identity` envelope captured into the phase's `evidence/` asserting `transaction_read_only = on` before any other read | Clause 2 by capture |
| Production `supabase_migrations.schema_migrations` recovery (§ Open Questions Q1) | **`sql-readonly.mjs` with a new named query**, not `supabase migration fetch --linked` — `migration fetch` opens a direct libpq connection whose read-only-ness is the author's good intention, not a server control | Clause 2 by construction |
| Production **write** — `supabase migration repair --linked` | **Not in the default plan.** If planned, it is one gated task with a `checkpoint:human-verify`, an exact version list captured beforehand, and its own threat-model row | — |

**Required `<threat_model>` rows in every Phase 3 plan** (this is the unmet Phase 1 obligation, stated so an executor cannot miss it):

| Threat | Category | Mitigation |
|---|---|---|
| Supabase MCP `execute_sql` is a privileged production transport authenticated by an OAuth grant held by the agent runtime | Elevation of Privilege | `.mcp.json` carries `read_only=true&project_ref=<ref>`; a `transaction_read_only = on` envelope is captured per plan before any read |
| The laptop holds `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and can write to production, bypassing RLS | Tampering | The seed loader refuses any URL whose project ref matches the one in `.env.local` (§ Code Examples 12); `.env.local` is never modified or read for values, only for the deny key |
| "How a tree reaches Vercel" — the project is not git-linked; a push does not deploy; previews sit behind Deployment Protection | Repudiation | Any Phase 3 claim about deployed behavior names the deployment id, or says explicitly that it was measured locally |

**Note for the planner:** a production read is only needed **once** in this phase — the migration-recovery census in Q1, and the final `db diff` verification. Design the plans so that number stays at one or two, each with its own captured envelope.

---

## Migration State Table

Derived from `.planning/audit/schema/migration-list.prod.txt` (production history, 45 versions, captured 2026-09-14 via the Management API) and `ls supabase/migrations/*.sql` (44 files, re-derived live 2026-09-15). **Action column is the recommendation from § Pattern 1 (Strategy B).**

### Counts

| | Count |
|---|---|
| Files in `supabase/migrations/` | **44** |
| Distinct versions those files declare | **39** (4 collision groups, 9 files) |
| Versions applied in production | **45** |
| Applied **and** declared | **27** |
| Declared but never applied (local-only) | **12** |
| Applied with no file (remote-only) | **18** |
| Files the CLI silently **skips** | **1** (`008b_…` — filename does not match `<version>_<name>.sql`; exit status stays 0) |
| File at which `db reset` **aborts** | the **12th** (`011_rls_audit.sql`, duplicate key `(version)=(011)`) |

### The 44 files

| # | File | Version | Applied on prod? | In a replayable local history? | Collision | Action |
|---|---|---|---|---|---|---|
| 1 | `001_initial_schema.sql` | 001 | yes | yes (applies) | — | archive under baseline |
| 2 | `002_rls_policies.sql` | 002 | yes | yes | — | archive under baseline |
| 3 | `003_user_interactions.sql` | 003 | yes | yes | — | archive under baseline |
| 4 | `004_event_popularity.sql` | 004 | yes | yes | — | archive under baseline |
| 5 | `005_user_engagement.sql` | 005 | yes | yes | — | **archive; creates `user_engagement_summary`, which production does not have (F-048) — 11 of the 22 `migrations-only` drift rows** |
| 6 | `006_tracking_rls_policies.sql` | 006 | yes | yes | — | archive under baseline |
| 7 | `007_add_created_by_and_notifications.sql` | 007 | yes | yes | — | archive under baseline |
| 8 | `008_event_source_tracking.sql` | 008 | yes | yes | **YES** (2 files @ 008) | archive under baseline |
| 9 | `008b_add_is_admin_to_users.sql` | *unparseable* | yes | **NO — silently skipped** | **YES** | **archive; F-047. Its `users.is_admin` column is absent from production, and `009` guards `DROP COLUMN is_admin` behind `IF EXISTS` precisely because of this** |
| 10 | `009_user_roles.sql` | 009 | yes | yes | — | archive under baseline |
| 11 | `010_feedback_table.sql` | 010 | yes | yes | — | archive under baseline |
| 12 | `011_event_images_bucket.sql` | 011 | yes | yes | **YES** (2 files @ 011) | archive under baseline |
| 13 | `011_rls_audit.sql` | 011 | yes | **NO — aborts the run** | **YES** | **archive; F-043's abort point. Writes policies for `rsvps`, a table no migration creates (F-044)** |
| 14 | `012_add_my_events_to_interaction_source.sql` | 012 | yes | never reached | — | archive under baseline |
| 15 | `013_users_name_avatar_columns.sql` | 013 | yes | never reached | — | archive under baseline |
| 16 | `020_reviews_table.sql` | 020 | yes | never reached | — | archive under baseline |
| 17 | `20250210000000_create_recommendation_feedback.sql` | 20250210000000 | yes | never reached | — | archive under baseline |
| 18 | `20250210100000_create_recommendation_explicit_feedback.sql` | 20250210100000 | yes | never reached | — | archive under baseline |
| 19 | `20251128053245_remote_schema.sql` | 20251128053245 | yes | never reached | — | archive — **this is itself a prior baseline dump** |
| 20 | `20251128060836_events_add_status_column.sql` | 20251128060836 | yes | never reached | — | archive under baseline |
| 21 | `20260223000000_notifications_rls_and_dedup.sql` | 20260223000000 | yes | never reached | — | archive under baseline |
| 22 | `20260223193741_remote_schema.sql` | 20260223193741 | yes | never reached | — | archive — **second prior baseline dump** |
| 23 | `20260223_add_clubs_status_category.sql` | 20260223 | yes | never reached | — | archive (note: sorts *after* #21/#22 lexically — a second ordering hazard) |
| 24 | `20260225000001_club_roles_and_invitations.sql` | 20260225000001 | yes | never reached | — | archive under baseline |
| 25 | `20260226000001_invitee_select_update_policy.sql` | 20260226000001 | yes | never reached | — | **archive; F-016 — its invitee policies are NOT live in production, so club-invitation acceptance is broken there. The baseline captures production, so the baseline will NOT contain them; REFAC-02 must re-add them as a new migration if the policy gap is in scope** |
| 26 | `20260227000001_club_followers.sql` | 20260227000001 | yes | never reached | — | archive under baseline |
| 27 | `20260305000001_experiments.sql` | 20260305000001 | yes | never reached | — | archive under baseline |
| 28 | `20260305000002_email_reminder_log.sql` | 20260305000002 | yes | never reached | **YES** (2 files) | archive under baseline |
| 29 | `20260305000002_phase1_club_rls_and_schema.sql` | 20260305000002 | yes | never reached | **YES** | archive under baseline |
| 30 | `20260306_add_user_profile_fields.sql` | 20260306 | yes | never reached | **YES** (3 files) | archive under baseline |
| 31 | `20260306_create_event_invites.sql` | 20260306 | yes | never reached | **YES** | archive under baseline |
| 32 | `20260306_create_user_follows.sql` | 20260306 | yes | never reached | **YES** | archive under baseline |
| 33 | `20260308000001_fuzzy_search.sql` | 20260308000001 | **no** | never reached | — | **decide: apply or drop.** Production has `pg_trgm` installed and a `search_events_fuzzy` function in `types.ts`, so the *effect* may be live from an out-of-band run |
| 34 | `20260308000002_admin_audit_log.sql` | 20260308000002 | **no** | never reached | — | decide; `admin_audit_log` exists in production (0 rows) so the effect is live |
| 35 | `20260308000003_time_of_day_filter.sql` | 20260308000003 | **no** | never reached | — | decide; `get_event_ids_by_time_filter` is in `types.ts`, so live |
| 36 | `20260308000004_content_hash_dedup.sql` | 20260308000004 | **no** | never reached | — | decide; `events.content_hash` is indexed in production, so live |
| 37 | `20260313000001_featured_events.sql` | 20260313000001 | **no** | never reached | — | decide; `featured_events` exists in production (1 row) |
| 38 | `20260313000002_recommendation_engine.sql` | 20260313000002 | **no** | never reached | — | **decide; contains the commented-out `cron.schedule(...)` line that is the repository's ONLY trace of the three live pg_cron jobs (F-042). REFAC-03's raw material** |
| 39 | `20260315000001_moderation_reviews.sql` | 20260315000001 | **no** | never reached | — | decide; `moderation_reviews` exists in production |
| 40 | `20260315000002_soft_delete.sql` | 20260315000002 | **no** | never reached | — | decide; the partial index `id WHERE deleted_at IS NULL` exists in production |
| 41 | `20260316000001_feedback_request_log.sql` | 20260316000001 | **no** | never reached | — | decide; table exists in production (6 rows) |
| 42 | `20260316000002_event_reports.sql` | 20260316000002 | **no** | never reached | — | decide; table exists in production |
| 43 | `20260316000003_audit_fixes.sql` | 20260316000003 | **no** | never reached | — | decide |
| 44 | `20260316000004_fk_indexes_and_cleanup.sql` | 20260316000004 | **no** | never reached | — | **REFAC-02's starting point.** 9 `CREATE INDEX IF NOT EXISTS` on FK columns + `DROP TABLE IF EXISTS public.events_tests`. Re-issue its content as a NEW post-baseline migration; do not resurrect the file |

**Reading the "decide" rows (33–44).** Every one of these twelve files declares objects that the production census shows *do exist*. The 18 remote-only versions are almost certainly the dashboard runs that applied this same SQL by hand. **After the baseline, all twelve are already inside it** and re-applying them would be a no-op at best and a conflict at worst — except for #44, whose indexes and `DROP TABLE` are precisely what REFAC-02 must land as new work, and #38, whose `cron.schedule` line is REFAC-03's raw material. **Recommendation: archive all twelve with the rest; re-issue #44's content and #38's cron line as two new post-baseline migrations with pgTAP tests.**

### The 18 remote-only versions

`20260307000001`, `20260315041343`, `20260315045155`, `20260315103436`, `20260315231016`, `20260316002951`, `20260316034955`, `20260316042746`, `20260316050743`, `20260316051022`, `20260316061922`, `20260316090343`, `20260316091121`, `20260316091643`, `20260316093431`, `20260316094048`, `20260316101601`, `20260324061310`.

All bare timestamps with no recorded name. **Whether their SQL is recoverable is § Open Questions Q1 and is the single highest-value first experiment in the phase.** Under Strategy B they do not need to be recovered — the baseline captures their *effect* from the production catalog — but recovering them would let the phase explain what happened to production in March, which is a genuine audit value and costs one read-only query.

---

## Standard Stack

### Core — packages to ADD

| Package | Version | Purpose | Why standard |
|---|---|---|---|
| `@playwright/test` | **1.63.0** (pin exact) | The e2e runner and the persona harness | Required by REFAC-06 by name. `engines.node >= 20` — compatible with the Node 24 pin. `[VERIFIED: npm view @playwright/test version` → `1.63.0`, published 2026-09-04, 45.8M weekly downloads, `github.com/microsoft/playwright`] |

**That is the entire list.** Every other capability this phase needs already exists.

### Supporting — already installed, no action

| Tool | Where it is | Used for |
|---|---|---|
| `tsx` ^4.21.0 (devDependency) | `package.json` | Running the TypeScript seed loader without a build step |
| `dotenv` ^17.3.1 (devDependency) | `package.json` | Loading local Supabase credentials into the seed loader |
| `@supabase/supabase-js` 2.81.1 | `package.json` | `auth.admin.createUser` for the seed; the service client |
| `@supabase/ssr` ^0.7.0 | `package.json` | Cookie serialization for the persona storage states (§ Code Examples 10) |
| Jest 30.2.0 + ts-jest 29.4.6 | `jest.config.js` | REFAC-08 characterization and every unit test. **Unchanged.** |

### Supporting — one-shot / not installed into `package.json`

| Tool | Invocation | Purpose |
|---|---|---|
| Supabase CLI | **`supabase` 2.115.0 installed globally**; 2.117.0 is latest | `db reset`, `db diff`, `db pull`, `migration repair`, `gen types`, `test db`, `db advisors`, `status -o env` |
| pgTAP | `create extension pgtap with schema extensions` **inside the test setup file** | RLS allow/deny tests. **Not an npm package and not installed in production** (`extensions.json`: `pgtap` available at 1.2.0, `installed: false`). It only needs to exist in the local test database. |
| Playwright browsers | `npx playwright install --with-deps chromium` | Downloaded to a cache, not into `node_modules` |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Hand-written pgTAP setup helpers | `dbdev` + `basejump-supabase_test_helpers` (`tests.authenticate_as()`, `tests.get_supabase_uid()`) | Rejected. It is a **database** dependency fetched from database.dev at install time — a network dependency inside `supabase test db`, a non-deterministic CI input, and an object that will never exist in production. Two `set local` statements in a `000-setup` file do the same job with zero dependencies (§ Code Examples 4). |
| A seeded PRNG package | `seedrandom`, `@faker-js/faker` | Rejected per the phase brief. A 20-line mulberry32 in `scripts/seed/prng.ts` is deterministic, auditable, and adds no package (§ Code Examples 11). |
| `server-only` (npm, v0.0.1) to mark `src/server/**` | — | **Not recommended for this phase.** It is a real Vercel-published package and it would give a build-time error on accidental client import, but the ESLint boundary already covers the case REFAC-05 names, and adding a package to satisfy a convention is not worth a legitimacy gate. Revisit in Phase 4 when the seam is actually consumed. |
| `eslint-plugin-import` / `eslint-plugin-boundaries` for the import rule | core `no-restricted-imports` | **Core rule wins.** Verified live: it fires correctly on all 23 violating files and on `@supabase/supabase-js`, with zero new packages (§ Code Examples 8). |
| Playwright installed via `npm init playwright@latest` | `npm install -D @playwright/test@1.63.0` + hand-written config | **Hand-write the config.** `npm init playwright` scaffolds a `tests/` directory, an `.github/workflows/playwright.yml` that would collide with the existing single `ci.yml`, and an `e2e` example spec — three unreviewed additions in a phase whose lockfile discipline requires every change to be a reviewed diff. |
| Bumping `@supabase/supabase-js` 2.81.1 → 2.116.0 in this phase | defer again | **See § Open Questions Q3.** Phase 2 deferred it with a written decision naming Phase 3 as the inheritor. The six `TS2345` sites it fails on overlap the nine this research measured. Recommendation: do **not** bundle it into REFAC-04; make it its own optional plan after the casts are gone, or defer to Phase 4 with the decision re-recorded. |

### Installation

```bash
# Batch 1 — the only package this phase adds.
npm install --package-lock-only --save-exact --save-dev @playwright/test@1.63.0
git diff package-lock.json          # review as a diff — STAB-11 discipline continues
npm ci
npx playwright install --with-deps chromium

# Re-assert the Phase 2 floor after the install.
node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
```

**Version verification performed 2026-09-15:** `npm view @playwright/test version` → `1.63.0`; `dist-tags.latest` → `1.63.0`; `engines` → `{"node":">=20"}`; `repository.url` → `git+https://github.com/microsoft/playwright.git`. `npx playwright --version` on this machine resolved `1.63.0`.

---

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm` on 2026-09-15.

| Package | Registry | Latest published | Weekly downloads | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `@playwright/test` | npm | 2026-09-04 | 45,794,389 | github.com/microsoft/playwright | SUS (`too-new`) | **Approved** — see note |
| `playwright` | npm | 2026-09-04 | 69,183,328 | github.com/microsoft/playwright | SUS (`too-new`) | **Not installed.** `@playwright/test` depends on it; it must not be a direct declaration |
| `dotenv` | npm | 2026-04-12 | 130,311,146 | github.com/motdotla/dotenv | OK | Approved — **already a direct devDependency** |
| `tsx` | npm | 2026-08-30 | 64,533,630 | github.com/privatenumber/tsx | SUS (`too-new`) | Approved — **already a direct devDependency** |

**Note on the `too-new` verdicts.** The seam's `too-new` signal measures the recency of the *latest published version*, not the age of the package. `@playwright/test` has a first-party Microsoft source repository, eight-figure weekly downloads, and is named **by the requirement text itself** (REFAC-06 says "Playwright"). It is not a slopsquat candidate. **No `checkpoint:human-verify` is warranted on the `too-new` reason alone**, exactly as Phase 2 ruled for the identical signal on eight packages.

**Provenance.** `@playwright/test` and the `setup`-project / `storageState` / `dependencies` API surface came from **playwright.dev's own documentation** (`/docs/auth`, `/docs/test-webserver`, `/docs/ci-intro`), not from search → `[VERIFIED]`. `postinstall` is `null` for both Playwright packages per the seam signals; the browser download is an explicit `npx playwright install` step, not an install hook.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages genuinely suspicious:** none.
**Packages this phase deliberately does NOT add:** `zod` (Phase 6, REFAC-15), `server-only`, `seedrandom`, `@faker-js/faker`, `@snaplet/seed`, `basejump-supabase_test_helpers` (a Postgres extension, not npm), `eslint-plugin-import`, `eslint-plugin-boundaries`.

---

## Architecture Patterns

### System Architecture Diagram

```
                         PRODUCTION (read-only in this phase)
                         ┌──────────────────────────────────┐
                         │ Postgres 17.6 · 30 tables        │
                         │ 101 RLS policies · 3 pg_cron jobs│
                         │ schema_migrations: 45 versions   │
                         └──────────────┬───────────────────┘
                                        │ SELECT only
                        ┌───────────────┴────────────────┐
                        │ sql-readonly.mjs (read_only:true)│  ← AR-12 compliant
                        │  or MCP ?read_only=true          │
                        └───────────────┬────────────────┘
                                        │ catalog census
                                        ▼
  supabase/migrations/  ──archive──▶ ┌─────────────────────┐
  (44 files, 39 versions,            │ <ts>_baseline.sql   │  REFAC-01
   4 collisions, 1 skip)             │  (production truth) │
                                     └──────────┬──────────┘
                                                │ + new migrations
                                                ▼
                        ┌───────────────────────────────────────┐
                        │  <ts>_fk_indexes_and_policy_gaps.sql  │ REFAC-02
                        │  <ts>_cron_compute_user_scores.sql    │ REFAC-03
                        └──────────┬────────────────┬───────────┘
                                   │                │
                    supabase db reset          supabase test db
                                   │                │
                                   ▼                ▼
                        ┌──────────────────┐   ┌──────────────────────┐
                        │ LOCAL Postgres   │   │ supabase/tests/      │
                        │ (:54322)         │◀──│  database/*.sql      │
                        └───┬──────────┬───┘   │  pgTAP allow/deny    │
                            │          │       └──────────────────────┘
          supabase gen types│          │ auth.admin.createUser(id:…)
                   --local  │          │ + public rows (fixed UUIDs,
                            ▼          │   pinned now, seeded PRNG)
             ┌──────────────────────┐  │      REFAC-07
             │ src/lib/supabase/    │  │            │
             │   types.ts (gen'd)   │  ▼            ▼
             └──────────┬───────────┘  ┌────────────────────────────┐
                        │ CI drift gate│ scripts/seed/load.ts       │
                        │ fail on diff │  └─ URL allow-list guard   │
                        ▼  REFAC-04    └──────────┬─────────────────┘
             ┌──────────────────────┐             │
             │ src/ — 47 casts → 0  │             ▼
             └──────────────────────┘   ┌──────────────────────────┐
                                        │ e2e/auth.setup.ts        │ REFAC-06
   ┌────────────────────────────┐       │  ↓ storageState per      │
   │ src/server/        REFAC-05│       │    persona               │
   │  context.ts  (once/request)│       │ playwright/.auth/*.json  │
   │  http.ts   errors.ts       │       └──────────┬───────────────┘
   │  authz/ requireUser        │                  │ dependencies:['setup']
   │         requireRole        │                  ▼
   │         requireClubRole    │       ┌──────────────────────────┐
   │  db/elevated/  ← ONLY door │       │ e2e/specs/*.spec.ts × 6  │
   │     to service.ts          │       │  against `next dev`      │
   └────────────┬───────────────┘       └──────────────────────────┘
                │ enforced at build time
                ▼
   ┌────────────────────────────────────────────────┐
   │ eslint.config.mjs · no-restricted-imports      │
   │  scoped to src/app/** + ratchet allow-list (23)│
   └────────────────────────────────────────────────┘

   INDEPENDENT TRIBUTARY (depends on nothing above):
   ┌────────────────────────────────────────────────┐
   │ src/app/auth/callback/route.test.ts   REFAC-08 │
   │  mocks: @supabase/ssr, @supabase/supabase-js,  │
   │         @/lib/supabase/service                 │
   │  5 behaviors, written BEFORE any modification  │
   └────────────────────────────────────────────────┘
```

### Recommended project structure

```
supabase/
├── migrations/
│   ├── _archive_pre_baseline/        # the 44 files, MOVED not renamed (L4)
│   │   └── README.md                 # why, and the git sha that held them at top level
│   ├── 2026<ts>_baseline.sql         # REFAC-01 — production truth
│   ├── 2026<ts>_fk_indexes_and_policy_gaps.sql   # REFAC-02
│   └── 2026<ts>_cron_compute_user_scores.sql     # REFAC-03
├── tests/database/
│   ├── 000-setup.sql                 # pgtap extension + impersonation helpers (alphabetical first)
│   ├── 010-fk-indexes.test.sql       # REFAC-02 index assertions
│   ├── 020-rls-<table>.test.sql      # REFAC-02 allow/deny per fixed policy
│   └── 030-cron-schedule.test.sql    # REFAC-03 idempotence + schedule assertion
src/server/                           # REFAC-05 — applied to ZERO routes
├── context.ts                        # createRequestContext() — once per request
├── http.ts                           # ok/created/noContent + NextResponse shapes
├── errors.ts                         # badRequest/unauthorized/forbidden/notFound/serverError
├── authz/
│   ├── requireUser.ts
│   ├── requireRole.ts
│   └── requireClubRole.ts
├── db/elevated/
│   ├── index.ts                      # the ONLY module importing @/lib/supabase/service
│   └── REGISTRY.md                   # one row per future elevated operation + justification
└── __tests__/                        # unit tests for the seam itself
scripts/seed/                         # REFAC-07
├── load.ts                           # entry — tsx scripts/seed/load.ts
├── guard.ts                          # URL allow-list, hard refuse
├── prng.ts                           # mulberry32, fixed seed
├── clock.ts                          # PINNED_NOW
└── personas.ts                       # fixed UUIDs, 11 seeded personas
e2e/                                  # REFAC-06 — outside src/, so Jest never sees it
├── auth.setup.ts
├── fixtures.ts
└── specs/*.spec.ts                   # 6 happy paths
playwright.config.ts
playwright/.auth/                     # gitignored
```

**Why `e2e/` and not `src/e2e/` or `tests/`:** Jest's `testMatch` is `<rootDir>/src/**/*.test.ts(x)` and `<rootDir>/src/hooks/**/*.test.ts` — **a directory outside `src/` is already invisible to Jest with no config change.** Putting specs in `src/` would require editing `testMatch`, which is the one file in this repo whose routing rule is documented as *"NOT by file extension"* and which two CLAUDE.md files warn about. Do not touch it. (Naming specs `*.spec.ts` rather than `*.test.ts` is belt-and-braces, not the mechanism.)

### Pattern 1: Baseline from production, archive by moving — never rename

**What:** REFAC-01's "never renaming existing files" and "`supabase db reset` replays cleanly" cannot both hold while the four collision groups sit at the top level of `supabase/migrations/`. The resolution is that they stop being *migrations* without being *renamed*: **move all 44 files, byte-identical and name-identical, into `supabase/migrations/_archive_pre_baseline/`.** The CLI reads only the top level of `supabase/migrations/`, so the collisions become inert historical record. Then write one baseline migration that *is* the production schema.

**When to use:** whenever remote history and the folder have diverged past the point where a diff can be built — which is exactly this tree, because `db diff` needs a shadow and the shadow is what aborts.

**Why this and not the alternatives:**

| Candidate | Verdict |
|---|---|
| Renumber the 9 colliding files + fix `008b` | **Forbidden by REFAC-01** and by the audit's own recommendation (`rls-review.md` § 8: *"REFAC-01 — § 6's reconciliation (do not replay; baseline from production)"*). It also cannot fix the 18 remote-only versions or the 41 undeclared policies. |
| `supabase migration squash --linked` | Squashes *remote* history into one file. It needs a working connection **and** a replayable local set to compare; the abort makes it unusable today. Revisit only if Q1 recovers the missing files. |
| `supabase db pull baseline --linked` with the folder emptied | **This is the mechanism for step 2 below** — with an empty top-level migrations directory the shadow is empty, so the "difference" it writes *is* the entire production schema. Preferred over hand-assembling `db dump` output. |

**Sequence (the critical path):**

```bash
# 0. PREFLIGHT — ports must be free (see § Environment Availability)
supabase start && supabase status

# 1. ARCHIVE — a move, not a rename. Names are byte-identical; git records the move.
mkdir -p supabase/migrations/_archive_pre_baseline
git mv supabase/migrations/*.sql supabase/migrations/_archive_pre_baseline/
# commit this alone, so the diff reads as 44 pure renames

# 2. BASELINE — with an empty top level, the "difference" is the whole production schema.
#    AR-12: this is a READ of production. Capture the transport envelope first.
supabase db pull baseline --linked --schema public,storage
#    → supabase/migrations/<ts>_baseline.sql
#    Review it by eye: it must contain rsvps (F-044), must NOT contain
#    user_engagement_summary (F-048) or events_tests (F-049), and must NOT
#    contain users.is_admin (F-047).

# 3. PROVE IT REPLAYS — the F-043 validation criterion, verbatim
supabase db reset          # must exit 0, applying every file
supabase migration list --local

# 4. PROVE IT MATCHES — the REFAC-01 success criterion
supabase db diff --linked --schema public,storage   # must print nothing
```

**Anti-pattern this pattern exists to prevent:** running `supabase db push` at any point. `push` writes to production. The success criterion is a *diff*, not a *push*.

### Pattern 2: Repair local history in this phase; gate the production repair

`supabase migration repair --status applied|reverted [versions…]` accepts `--local`, `--linked`, `--db-url` and `--project-ref` `[VERIFIED: supabase 2.115.0 --help]`. The official guidance is: `--status applied` "marks a migration as applied in the tracking table when a migration shows as missing in the remote history table but the schema change is already there"; `--status reverted` is for "a migration recorded as applied but never run" `[CITED: supabase.com/docs/guides/deployment/database-migrations]`.

**Two different repairs, and the plan must not conflate them:**

| Repair | Target | Needed for | Recommendation |
|---|---|---|---|
| Local | `--local` | `db reset` and `migration list --local` to agree after the archive | **In scope.** `db reset` rebuilds the local history table from scratch, so in practice no explicit repair is needed — but assert `migration list --local` shows exactly the post-baseline files and nothing else. |
| Production | `--linked` | Any *future* `supabase db push` to work, because the baseline version is new to production | **Gate it.** This is the phase's only production **write**. It is one call — `supabase migration repair --status applied <baseline-version>` — and nothing in the Phase 3 success criteria requires it. Plan it as a single task behind `checkpoint:human-verify`, with the exact version captured beforehand and its own threat-model row, **or** defer it with a written note to Phase 8's deployment certification. |

**Do not** mark the 45 historical production versions `reverted`. They are true statements about what happened; erasing them destroys the only record of the March out-of-band burst, and `db push` ignores them anyway once the baseline is marked applied.

### Pattern 3: The seam is a Data Access Layer, and Next.js documents it

Next's own authentication guide prescribes exactly the shape REFAC-05 asks for: a DAL with `import 'server-only'`, a `verifySession()` memoized with React's `cache()`, and per-call helpers built on it `[CITED: node_modules/next/dist/docs/01-app/02-guides/authentication.md:1131-1233]`:

```ts
export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  …
})
```

**But `cache()` memoizes per React render pass**, and a Route Handler is not a render pass. Next's docs say to invoke the DAL "in your data requests, Server Actions, Route Handlers", and in practice Next provides a request-scoped store for handlers too — but this is exactly the kind of claim that should not be load-bearing for a seam the whole program will be built on.

**Recommendation — belt and braces, no reliance on undocumented scoping:**

```ts
// src/server/context.ts
export type RequestContext = {
  supabase: SupabaseClient<Database>;
  user: User | null;
  profile: Pick<Tables<'users'>, 'id'|'roles'|'banned_at'|'ban_expires_at'|'onboarding_completed'> | null;
  requestId: string;
};

/** Computed ONCE per request. Route handlers call this at the top and pass ctx down. */
export async function createRequestContext(): Promise<RequestContext> { … }

/** RSC/page side only: memoized for the render pass. */
export const getRequestContext = cache(createRequestContext);
```

Route handlers call `createRequestContext()` once at the top and thread `ctx` explicitly. Server Components call `getRequestContext()`. "Computed once per request" is then a property of the call site, not of a framework internal.

**Three non-negotiables for the seam, all grounded in this tree:**

1. **`getUser()`, never `getSession()`.** `F-002`-adjacent findings and `REFAC-11` turn on this. `verifyAdmin()` in `lib/admin.ts` already does it correctly — copy that, do not invent.
2. **The guards return a discriminated result, not a thrown response.** The existing convention is `NextResponse.json({ error, field }, { status })` with try/catch per handler (`.claude/CLAUDE.md § Error Handling`). `requireUser` should return `{ ok: true, user } | { ok: false, response: NextResponse }` so Phase 4's slices adopt it without changing control flow.
3. **`requireClubRole` reads `club_members.role`, and admin is NOT a bypass.** The audit's persona rule R9 is explicit and was *recorded rather than assumed*: "Admin is **not** a club-role bypass anywhere in this tree — `/api/clubs/[id]` DELETE says so in as many words." Encoding an admin bypass would be a behavior change (L1).

### Pattern 4: pgTAP allow/deny — assert the right *kind* of denial

Supabase's own RLS testing guidance draws a distinction most pgTAP suites get wrong, and REFAC-02 requires one allow/deny test per new migration `[CITED: supabase.com/docs/guides/database/postgres/row-level-security.md]`:

| Denial type | Postgres response | Assertion |
|---|---|---|
| Missing grant | raises `42501` | `throws_ok` |
| `WITH CHECK` violation | raises `42501` | `throws_ok` |
| `USING` clause filters the row | **no error, zero rows** | `is_empty` **plus** an integrity check |

And the rule that makes a suite meaningful: **"Never prove an allowed write with `lives_ok`. It passes when the write matched zero rows."** Use `RETURNING` and assert the returned value.

This maps directly onto `02-REVIEW.md` WR-04's complaint about Phase 2's `proxy.test.ts` — *"a PRESERVE suite whose assertions cannot fail when the preserved behavior is removed is a false sense of coverage."* The same failure mode, one tier down. **Every REFAC-02 pgTAP test must be mutation-checked: comment out the policy, confirm the test goes red, restore it.**

### Pattern 5: The type drift gate reads the reconciled schema, not production

The audit's finding is precise and it changes REFAC-04's shape: *"regenerating types would **hide** drift rather than reveal it, because the generator reads production, not the migrations folder."* There are **zero `type-mismatch` rows** across 288 — `types.ts` already describes production faithfully; it describes a schema no migration can build.

Therefore the CI gate must generate from **`--local` after `db reset`**, not from `--linked`:

```bash
supabase db reset                                   # migrations → local
supabase gen types typescript --local --schema public > /tmp/types.gen.ts
diff -u src/lib/supabase/types.ts /tmp/types.gen.ts # exit non-zero on any difference
```

A gate reading `--linked` would pass on day one and prove nothing. A gate reading `--local` fails the moment a migration and the committed types disagree, which is the property REFAC-04 actually wants. **This also makes the gate runnable in CI without any production credential** — a significant security property worth stating in the plan.

### Pattern 6: One setup project, one storage state per persona

Playwright's documented multi-role pattern `[CITED: playwright.dev/docs/auth]`: a `setup` project with `testMatch: /.*\.setup\.ts/` signs each persona in once and writes `playwright/.auth/<persona>.json`; real projects declare `dependencies: ['setup']`; specs override with `test.use({ storageState: … })` inside a `describe`. `playwright/.auth` is gitignored.

**The project-specific problem:** the app signs in with **Google OAuth only** (`SignInButton.tsx` → `signInWithOAuth`), which cannot run against local Supabase. Three options were evaluated:

| Option | Verdict |
|---|---|
| Drive `/admin-login` | **`src/app/admin-login/page.tsx` exists and already calls `signInWithPassword`** — real, shipped, uses the app's own browser client. But it **signs out any account whose `roles` lacks `admin`**, so it works for exactly one persona. |
| Add a test-only sign-in route | Rejected. A new route is a behavior change and an attack surface, in the phase whose core value is behavior preservation. |
| **Construct the session cookies with `@supabase/ssr`'s own serializer, then `context.addCookies()`** | **Recommended.** Uses the library's own `setAll` emission — no cookie-format guessing, no app change, uniform across all personas. It is the same trick `src/app/auth/callback/route.ts` already uses to accumulate cookies. See § Code Examples 10. |

**Cross-check worth one test:** sign the admin persona in *both* ways — through `/admin-login` in the real UI and through the cookie shim — and assert the resulting cookie **names** match. That converts "the shim is equivalent to the app" from an assumption into an assertion.

**Stated limitation, which the plan must record rather than let a reader assume otherwise:** personas authenticated this way **never traverse `/auth/callback`**. McGill enforcement and admin auto-assignment live in that route and are covered by REFAC-08's unit characterization, not by the harness. The five signed-in Tier 3 steps carried over in `02-UAT.md` remain a human item.

### Pattern 7: Deterministic seed — GoTrue owns `auth`, SQL owns `public`

`public.users.id` references `auth.users(id)`, so auth rows must exist first — which rules out a pure `supabase/seed.sql` (it runs during `db reset`, before anything can call the admin API). **`supabase/seed.sql` does not exist in this repo today**, though `config.toml` `[db.seed] sql_paths = ["./seed.sql"]` points at it. Leave that alone.

The decisive capability, verified in this tree's own `node_modules`:

```
// @supabase/auth-js AdminUserAttributes
/** The `id` for the user. Allows you to overwrite the default `id` set for the user. */
id?: string;
```

So `auth.admin.createUser({ id: FIXED_UUID, email, password, email_confirm: true })` gives **fixed UUIDs without hand-writing into the `auth` schema** — no bcrypt, no `auth.identities` row to guess, no GoTrue schema drift risk. This single fact removes the biggest technical risk in REFAC-07.

**Determinism contract (all three clauses are required by REFAC-07):**

| Clause | Mechanism |
|---|---|
| Fixed UUIDs | `scripts/seed/personas.ts` — literal UUIDs, one per persona and per club/event |
| Fixed timestamps against a pinned now | `PINNED_NOW = new Date('2026-06-01T12:00:00.000Z')`; every date is `PINNED_NOW ± offset`. **Use `America/Toronto` offsets deliberately** — the app is McGill and CERT-02 will test DST |
| Fixed PRNG seed | mulberry32 in `scripts/seed/prng.ts`, seeded `0x554e4956` |

**Idempotence:** the loader must be re-runnable. `auth.admin.createUser` on an existing id returns an error — delete-then-create (`auth.admin.deleteUser` first, ignoring not-found) or upsert public rows and tolerate the auth conflict. Assert idempotence with a test: run the loader twice, diff row counts.

**Coverage the requirement names**, mapped to the audit's own 13-persona taxonomy (`inventory/classification-rules.md § 2`) so Phase 7's CERT matrix inherits it instead of re-inventing it:

| Persona key | Seeded? | How |
|---|---|---|
| `anonymous` | n/a | no storage state |
| `onboarded_student` | yes | `onboarding_completed = true`, `roles = ['user']`, no club |
| `mid_onboarding_student` | yes | `onboarding_completed = false` + the `needs_onboarding` cookie in its storage state |
| `club_member` | yes | `club_members.role = 'member'` of the approved club |
| `club_owner` | yes | `club_members.role = 'owner'` of the approved club |
| `multi_club_organizer` | yes | owner of the approved club **and** a second approved club |
| `cross_club_attacker` | yes | member of a **different** club only |
| `admin` | yes | `roles` includes `'admin'` — also the `/admin-login` cross-check persona |
| `banned_permanent` | yes | `banned_at` set, `ban_expires_at` null |
| `suspended_active` | yes | `ban_expires_at` = `PINNED_NOW + 7d` |
| `suspension_expired` | yes | `ban_expires_at` = `PINNED_NOW - 1d` |
| `non_mcgill_signin` | **no row** | an auth-flow case; covered by REFAC-08 |
| `machine_no_credential` | **no row** | absence of a bearer secret |

Plus the status axes REFAC-07 names explicitly: clubs in `pending` / `approved` / `rejected`, and events in `pending` / `approved` / `rejected`, each owned by the approved club so the club-scoped personas have something to act on.

### Pattern 8: Characterize the callback by invoking it, not by reading it

`02-REVIEW.md` WR-04 is the pattern's negative example and its fix in one: Phase 2's `proxy.test.ts` asserts only `config.matcher`, so "deleting the redirect block at `proxy.ts:115-121` entirely leaves this suite green." The review's prescribed remedy — mock `@supabase/ssr`, construct a `NextRequest`, **call the exported handler**, assert the response — is exactly what REFAC-08 needs, and the review notes that `next/experimental/testing/server` works under the `node` Jest project.

**The three mock seams, read from the source (not guessed):**

| Import in `src/app/auth/callback/route.ts` | Mock | Why it is not the obvious one |
|---|---|---|
| `createServerClient` from **`@supabase/ssr`** (line 13) | `jest.mock("@supabase/ssr", …)` | The route does **not** use `@/lib/supabase/server`. Mocking that module — the Phase 2 habit — mocks nothing. |
| `createClient` from **`@supabase/supabase-js`** (line 14) | `jest.mock("@supabase/supabase-js", …)` | A *second*, separate service-role client built inline for `auth.admin.deleteUser` on the non-McGill path. |
| `createServiceClient` from `@/lib/supabase/service` (line 18) | `jest.mock("@/lib/supabase/service", …)` | Used for the upsert, the profile read, and the admin role update. |

**And the one that will waste an afternoon if it is not written down:** `ADMIN_EMAILS` is parsed at **module load**:

```ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",")…
```

Setting `process.env.ADMIN_EMAILS` inside a `beforeEach` has no effect on an already-imported module. The admin-auto-assignment test **must** `jest.resetModules()` and then `await import("./route")`. This was verified live — see § Code Examples 13, where all four probes pass.

### Anti-patterns to avoid

- **Renaming or renumbering a migration file.** Forbidden by REFAC-01 and by the audit's own § 8 guidance. Moving a file into an archive directory is not renaming; changing `008b_` to `0085_` is.
- **Running `supabase db push`.** The success criterion is a clean `db diff`. `push` writes to production.
- **Silencing the nine post-cast type errors with `as never` or a widened `Record<string, unknown>`.** `supabase-js-decision.md` § 5 already ruled on the identical temptation: "The first hides whatever the new type is actually objecting to." Two of the nine are real defects (§ Code Examples 7).
- **Applying the seam to "just one easy route" to prove it works.** L3/REFAC-05 say zero. Prove it with unit tests on the seam itself.
- **Turning on the ESLint boundary rule without a ratchet.** It produces **46 errors** today; `check-baseline.mjs` asserts `zero-eslint-errors`, so the phase gate fails.
- **Putting Playwright specs under `src/`.** Jest's `testMatch` would pick them up and `ts-jest` would fail on `@playwright/test` imports.
- **Letting `supabase/seed.sql` come into existence by accident.** `[db.seed]` is enabled and points at it; a stray file would run on every `db reset` and make the seed non-deterministic with respect to the loader.
- **Treating the absence of a staging environment as a detail.** REFAC-07 says "local and staging"; there is no staging. Write the staging path, guard it, and record that it is untested.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Producing a schema baseline that matches production | A hand-assembled `.sql` from the audit's catalog JSON | `supabase db pull baseline --linked` against an empty top-level migrations dir | The catalog census has no DDL — no defaults, no constraints, no function bodies, no policy expressions in applyable form. `db pull` emits real DDL. |
| Recovering the 18 remote-only migrations | Reconstructing SQL by reading the production catalog | `select version, name, statements from supabase_migrations.schema_migrations` through `sql-readonly.mjs` (§ Q1) | If `statements` is populated the SQL is already there, verbatim. |
| RLS role impersonation in tests | A bespoke `SET ROLE` + JWT-minting helper | `set local role authenticated; set local request.jwt.claim.sub = '<uuid>'` in a `000-setup.sql` | Two statements, zero dependencies, and it is what Supabase documents. |
| Per-persona browser sessions | Logging in inside every spec | Playwright `setup` project + `storageState` + `dependencies` | Login once per persona per run instead of once per test; also avoids tripping `[auth.rate_limit] sign_in_sign_ups = 30`. |
| Supabase session cookies for a test browser | Hand-building `sb-<ref>-auth-token` base64 chunks | `createServerClient` from `@supabase/ssr` with a capturing `setAll` adapter | The chunking threshold and the `base64-` prefix are internal and have changed between `@supabase/ssr` minors. |
| Deterministic `auth.users` rows | `INSERT INTO auth.users` with `crypt(…, gen_salt('bf'))` and a matching `auth.identities` row | `auth.admin.createUser({ id, email, password, email_confirm: true })` | GoTrue owns that schema and it changes. The admin API accepts an explicit `id` — verified in this tree's types. |
| TypeScript types from the schema | Editing `src/lib/supabase/types.ts` by hand | `supabase gen types typescript --local` | The file is **already** generator output; hand-editing it is what created `events_tests` (F-049). |
| An import boundary | A custom AST script | core ESLint `no-restricted-imports` with `files`-scoped config | Verified firing on all 23 violating files plus the raw-SDK import, zero new packages. |
| Local Supabase credentials for CI and the seed loader | Hard-coding the well-known demo anon/service keys | `supabase status -o env --override-name api.url=… --override-name auth.service_role_key=…` | Survives a CLI change to the demo keys and reads as a credential-handling decision rather than a copy-paste. |
| A seeded PRNG | `Math.random()` with a comment promising determinism | 20-line mulberry32 in-repo | `Math.random()` is not seedable in Node; adding a package for 20 lines fails the phase's own package discipline. |

**Key insight:** every hand-rolled candidate above is hand-rolled *around a schema Supabase owns and changes* — the `auth` schema, the cookie format, the migration history table, the generated type shape. This codebase already carries two scars from exactly that: `types.ts` contains a table (`events_tests`) that exists nowhere, and eighteen production migrations exist with no file. Reaching for the owning tool is not tidiness here; it is the specific defence against the specific failure this phase is cleaning up.

---

## Runtime State Inventory

This phase rebuilds a database and introduces a test harness, so runtime state that no grep will find is the main risk.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | Production Postgres: 30 tables, `events` 229 rows, `clubs` 222, `users` 37, `rsvps` 10, `saved_events` 8, `user_follows` 24, `notifications` 19 (`raw/prod/row-counts.json`). **Local:** no database exists — the replay aborts at file 12. **Local Docker volumes** for the `PassiveIncomeInvestingDEMO` stack occupy the Supabase ports. | Production: **read-only, never seeded** (L5). Local: created fresh by `db reset`. The other stack: stop it or re-port (§ Environment Availability). |
| **Live service config** | **41 RLS policies exist only in production**, declared by no migration (F-012). **3 of 4 storage buckets** (`avatars`, `banners`, `club-logos`) exist only in production — `config.toml`'s `[storage.buckets.*]` block is entirely commented out (F-035). **All 3 pg_cron jobs** exist only in production: `send-event-reminders` `*/15 * * * *`, `compute-user-scores` `0 */6 * * *`, `send-feedback-requests` `*/30 * * * *`, all `active: true`, all succeeding (F-042). **Vercel:** only 3 env vars configured in production — `ADMIN_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS` are all **absent** (F-040). **The Vercel project is not git-linked**; a push does not deploy. | Policies and buckets: captured by the `db pull` baseline — **verify by eye that all 41 came through**. pg_cron: REFAC-03 codifies `compute-user-scores`; the other two are Phase 5/6. Missing env vars: not this phase's fix, but they mean the REFAC-08 admin-auto-assignment characterization is testing a path that **does not fire in production today** — record that. |
| **OS-registered state** | Docker containers `supabase_{db,kong,auth,rest,storage,studio,realtime,inbucket,analytics,vector,pg_meta}_PassiveIncomeInvestingDEMO` holding 54321/54322/54323/54324/54327. No launchd/systemd/pm2/Task Scheduler entries for this project. | One preflight command; see § Environment Availability. |
| **Secrets and env vars** | `.env.local` holds the three production values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). `.mcp.json` (untracked) holds an unscoped MCP endpoint. `.env*.local` and `.env` are gitignored. **`.claude/CLAUDE.md` is gitignored and its Phase 2 corrections are absent from git** (F-063 residual). | **Never modify `.env.local`** (L6). The seed loader reads it **only** to extract the production project ref for its deny rule, never for values. `.mcp.json` **must** be re-scoped (§ Production Transport). The gitignored-CLAUDE.md gap is inherited and should be dispositioned in this phase's completion note, not silently carried again. |
| **Build artifacts / installed packages** | `.next/` build cache. `test-results/` — **an empty, gitignored directory left by a Playwright run that never existed in this tree** (no `playwright` in `package.json`, no `node_modules/@playwright`). Playwright browser binaries will land in `~/Library/Caches/ms-playwright`, outside the repo. | `test-results/` is already gitignored and will be re-used by Playwright legitimately — no action, but note that its pre-existence is misleading evidence, not a leftover from this project's own tooling. |

**The canonical question — after every file in the repo is updated, what still holds the old state?** Production's `supabase_migrations.schema_migrations` (45 rows, unchanged by anything in the repo), production's 41 undeclared policies, production's 3 pg_cron jobs, and the three storage buckets created in the dashboard. **The baseline captures all of them as DDL; none of them is changed.** That is the correct outcome for a read-only-toward-production phase, and it should be stated in the completion note so a later reader does not mistake "the baseline contains them" for "the repository now controls them."

---

## Common Pitfalls

### Pitfall 1: `supabase start` cannot bind its ports, and the failure looks like a Docker problem

**What goes wrong:** `supabase start` fails or hangs. Ports 54321, 54322, 54323, 54324 and 54327 are held by `supabase_*_PassiveIncomeInvestingDEMO` — **verified running on this machine 2026-09-15**. This is the identical conflict Phase 1 hit; it worked around it with an out-of-repo copy of `supabase/` with changed ports, and that scratch stack no longer exists.
**Why it happens:** the Supabase CLI uses fixed host ports per `config.toml`, and two projects on one machine collide by default.
**How to avoid:** make it Wave 0, task 1, with the port probe as the verification. The fix is one command against someone else's demo stack:

```bash
for p in 54320 54321 54322 54323 54324 54327 54329; do
  nc -z 127.0.0.1 $p && echo "$p BUSY" || echo "$p free"
done
supabase stop --project-id PassiveIncomeInvestingDEMO   # or: docker stop $(docker ps -q --filter name=PassiveIncomeInvestingDEMO)
```

**Do not** change `[db].port`/`[api].port` in `supabase/config.toml` as the first move: those ports are also what CI, the seed loader, and `playwright.config.ts` will target, and changing them makes every one of those artifacts machine-specific. If the other stack genuinely cannot be stopped, change the ports *and* thread them through `supabase status -o env` everywhere — never hard-code the new numbers twice.
**Warning signs:** `failed to start docker container`, `port is already allocated`, or a `supabase status` that reports a stack you did not start.

### Pitfall 2: `supabase db diff` is blocked by the very defect it is meant to measure

**What goes wrong:** an executor tries `supabase db diff --linked` to *scope* the reconciliation and gets nothing useful.
**Why it happens:** `db diff` "compares a **shadow** built from `supabase/migrations`" `[VERIFIED: supabase 2.115.0 db diff --help]`. Building that shadow replays the 44 files — and the replay aborts at the 12th on `duplicate key value violates unique constraint "schema_migrations_pkey" … Key (version)=(011)`. Phase 1 recorded this: *"The missing diff is not a tooling gap — it is this defect, observed through a second command."*
**How to avoid:** `db diff` is a **verification step at the end of Pattern 1**, not a discovery step at the start. The discovery inputs already exist, captured and committed: `schema/drift.json`, `schema/drift.md`, `rls/pg_policies.json`, `raw/prod/information-schema-columns.json`.
**Warning signs:** a plan task that reads "run `supabase db diff` to determine what changed."

### Pitfall 3: a migration filename that *almost* parses is skipped with exit status 0

**What goes wrong:** `008b_add_is_admin_to_users.sql` prints `Skipping migration 008b_add_is_admin_to_users.sql... (file name must match pattern "<timestamp>_name.sql")` **and the run continues with status 0.** The column it declares is applied in no environment built from the folder, and `009_user_roles.sql` guards `DROP COLUMN is_admin` behind `DO $$ … IF EXISTS` precisely because of it.
**Why it happens:** the CLI derives the version from the **leading digits** and requires the whole name to match `<version>_<name>.sql`. The trailing `b` breaks the match. A skip is worse than a failure: it is silent.
**How to avoid:** F-047's own recommended fix — a CI check asserting every file in `supabase/migrations/*.sql` parses — survives the baseline and is worth ~10 lines:

```bash
node -e '
const fs=require("fs"); const bad=fs.readdirSync("supabase/migrations")
  .filter(f=>f.endsWith(".sql") && !/^[0-9]+_[^\/]*\.sql$/.test(f));
if (bad.length) { console.error("unparseable migration filename(s):", bad); process.exit(1); }'
```

**Warning signs:** the word `Skipping` anywhere in a `db reset` transcript.

### Pitfall 4: an ESLint `files` allow-list silently misses every Next.js dynamic route

**What goes wrong — measured live, and it produced a false result before it was caught.** The ratchet allow-list for `no-restricted-imports` was generated with `grep -rl … src/app/` and pasted into a `files:` array. Result: **12 errors remained** and the run looked like the rule was broken.
**Why it happens:** ESLint `files` entries are **globs**. `src/app/users/[id]/page.tsx` contains `[id]`, which a glob reads as a **character class** matching one of `i` or `d` — so the entry matches nothing and the file stays under the rule. Thirteen of the 23 legacy callsites are dynamic routes.
**How to avoid:** escape the brackets when generating the list.

```bash
grep -rl "supabase/service\|@supabase/supabase-js" src/app/ | sed 's|\[|\\\[|g; s|\]|\\\]|g'
```

Verified: **unescaped → 12 errors; escaped → 0 errors**, on the same tree with the same rule.
**Warning signs:** a ratchet that "doesn't work" on exactly the dynamic routes; an executor about to widen the rule or drop it to `warn` to make lint pass.

### Pitfall 5: the boundary rule cannot ship at `error` without a ratchet, and `check-baseline.mjs` will say so

**What goes wrong:** the rule is added, `npm run lint` goes from 0 errors to **46**, and `check-baseline.mjs`'s `lint :: zero-eslint-errors` check fails the phase gate.
**Why it happens:** REFAC-05 requires a rule that *fails the build*, and REFAC-05 also requires the seam be applied to **zero** routes — so the 23 existing violations cannot be fixed in this phase. Both are true at once; the plan must reconcile them.
**How to avoid:** ship the rule **with** a generated, committed allow-list that may only shrink, plus a check that asserts it only shrinks. Verified working (§ Code Examples 8). Also use **only** `patterns` or **only** `paths`, not both: when both match you get **two identical reports per import**, which makes the error count meaningless.
**Warning signs:** `Tests: … 46 problems`; an executor adding `// eslint-disable-next-line` to 23 files instead of one allow-list.

### Pitfall 6: stripping the casts reveals two real bugs, and they are easy to "fix" by hiding them

**What goes wrong:** of the 9 `tsc` errors produced by removing all 47 `(supabase as any)` casts, two are not type noise:

- `src/app/api/events/[id]/friends/route.ts:38` — `.in("user_id", <PostgrestFilterBuilder>)`. A **query builder is passed where an array is required.** The cast made this compile; at runtime the builder is serialized as a value. It sits in the fallback path taken when the `get_friends_going_to_event` RPC errors.
- `src/app/moderation/page.tsx:67` — a builder is `as Promise<{data: AuditEntry[]|null}>` inside a `Promise.all`. This one *works* (a PostgREST builder is a thenable) but the cast hides that the awaited shape is unchecked.

**Why it happens:** `(supabase as any)` erases the whole client type, including the argument types of `.in()`.
**How to avoid:** treat each of the nine as a **characterization question first**, exactly as L2 requires. For the `.in()` site: write a test that pins current behavior, tag it `DEFECT` against a new `F-nnn`, and let the fixing slice (Phase 4's event/friends work) close it — do **not** "fix" it inside REFAC-04, which would be a behavior change smuggled in as a type fix.
**Warning signs:** a diff that adds `await` to line 38 of `friends/route.ts` alongside 46 cast removals.

### Pitfall 7: `lives_ok` makes an RLS suite green while proving nothing

**What goes wrong:** `select lives_ok($$insert into events …$$)` passes when the insert is silently filtered to zero rows by a `USING` clause, so a broken policy reads as a working one.
**Why it happens:** RLS denial has two distinct shapes — a raised `42501` and a silent zero-row filter — and only one of them throws.
**How to avoid:** the three-way table in § Pattern 4. Allowed writes use `RETURNING` + `results_eq`. Denied reads use `is_empty` **plus** an integrity check that the row is still there. And every test is mutation-checked: comment out the policy, watch it go red.
**Warning signs:** a pgTAP file where every assertion is `lives_ok` or `policies_are`. `policies_are` proves a policy *exists*, not that it *does anything*.

### Pitfall 8: seeding through `supabase/seed.sql` deadlocks on the FK to `auth.users`

**What goes wrong:** a `supabase/seed.sql` that inserts into `public.users` fails on the foreign key to `auth.users`, because `[db.seed]` runs during `db reset` before any process can call the admin API.
**Why it happens:** seed files execute "the first time you run `supabase start` and every time you run `supabase db reset`" `[CITED: supabase.com/docs/guides/local-development/seeding-your-database]` — inside the reset, not after it.
**How to avoid:** put **everything** in the Node loader, run after `db reset`, and leave `supabase/seed.sql` non-existent. `config.toml` already points `sql_paths` at a file that is not there; that is currently harmless and should stay that way.
**Warning signs:** `insert or update on table "users" violates foreign key constraint "users_id_fkey"` during `db reset`.

### Pitfall 9: `[auth.rate_limit]` throttles the setup project before the specs even start

**What goes wrong:** the setup project signs in 11 personas; retries or a re-run within five minutes trip `sign_in_sign_ups = 30` per 5 minutes per IP, and setup fails with a 429 that reads like a Supabase outage.
**Why it happens:** `supabase/config.toml` `[auth.rate_limit]` applies to the local stack. `src/middlewareRateLimit.ts` adds a second, independent limiter in front of `/api/*`.
**How to avoid:** sign in **once per persona per run** — which is what the `setup` project + `storageState` pattern buys. Do not re-authenticate inside specs. If a CI job needs repeated runs, raise `sign_in_sign_ups` in `config.toml` deliberately and say why in a comment.
**Warning signs:** 429s from `/auth/v1/token` during setup; intermittent setup failures that clear after a few minutes.

### Pitfall 10: `supabase migration fetch --linked` is a production connection that AR-12 does not sanction

**What goes wrong:** the obvious way to recover the 18 missing migrations is `supabase migration fetch --linked`. It opens a direct libpq connection to production whose read-only-ness is nobody's guarantee, and `supabase link` writes project state into `supabase/.temp/`.
**Why it happens:** the CLI is built for a world where you own the database; AR-12's posture is narrower.
**How to avoid:** issue the same read through `sql-readonly.mjs`, where `read_only: true` is enforced by the Management API server-side and outside the client's reach, and write the files locally from the returned rows (§ Q1).
**Warning signs:** `supabase link --project-ref` appearing in a plan task; a new untracked `supabase/.temp/` directory.

### Pitfall 11: `--testPathPattern` no longer exists in Jest 30

**What goes wrong:** `npx jest --testPathPattern route.probe` silently matches nothing or errors.
**Why it happens:** Jest 30 renamed the flag to **`--testPathPatterns`** (plural). Verified on this tree: `--testPathPatterns "route.probe"` selects the one suite; passing a bare path as a positional argument ran **all 20 node suites**.
**How to avoid:** `npx jest --ci --selectProjects node --testPathPatterns "<regex>"` in every per-task verify command.
**Warning signs:** a "quick" verify command whose wall time matches the full suite.

---

## Code Examples

### 1. The AR-12-compliant production read (`sql-readonly.mjs`, extended)

Add one named query to the existing catalog at `.planning/audit/tools/sql-readonly.mjs`. The transport, credential handling, scrubbing and retry logic are already written and were used for every Phase 1 capture.

```js
// .planning/audit/tools/sql-readonly.mjs → QUERIES
'migration-history': {
  requirement: 'REFAC-01 — recover the 18 remote-only versions (Q1)',
  sql: `SELECT version, name, statements
        FROM supabase_migrations.schema_migrations
        ORDER BY version`,
},
'transport-identity': {
  requirement: 'AR-12 — the read-only envelope every Phase 3 production read must carry',
  sql: `SELECT current_user AS role,
               current_setting('transaction_read_only') AS txn_read_only,
               now() AS captured_at`,
},
```

```bash
# Envelope FIRST, every time. It must read "on".
node .planning/audit/tools/sql-readonly.mjs --query transport-identity \
  --out .planning/phases/03-*/evidence/transport-identity.json

node .planning/audit/tools/sql-readonly.mjs --query migration-history \
  --out .planning/phases/03-*/evidence/migration-history.json
```

### 2. The archive move — 44 renames, zero content changes

```bash
mkdir -p supabase/migrations/_archive_pre_baseline
git mv supabase/migrations/*.sql supabase/migrations/_archive_pre_baseline/
git status --porcelain | grep -c '^R'     # expect 44
git diff --cached --stat -M --summary | grep -c 'rename'   # expect 44
```

The verification that matters: `git diff -M` must show **44 renames and 0 content changes**. If any file shows a content change, L4 has been violated.

### 3. `db reset` → `db diff` — the REFAC-01 gate as one script

```bash
set -euo pipefail
supabase db reset                                   # exit 0, every file applied
supabase migration list --local | tee evidence/migration-list.local.txt
! grep -qi 'skipping' evidence/migration-list.local.txt      # Pitfall 3

supabase db diff --linked --schema public,storage > evidence/db-diff.prod.sql
test ! -s evidence/db-diff.prod.sql                 # empty file == clean diff
```

### 4. pgTAP setup file and one allow/deny pair (REFAC-02)

```sql
-- supabase/tests/database/000-setup.sql   (alphabetically first — loads for every file)
create extension if not exists pgtap with schema extensions;

-- Impersonation helper. Supabase's auth.uid() reads BOTH forms depending on version,
-- so set both and assert the result rather than trusting either.
create or replace function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
```

```sql
-- supabase/tests/database/020-rls-saved-events.test.sql
begin;
select plan(4);

-- sanity: the helper actually changes auth.uid()
select tests.act_as('00000000-0000-4000-8000-000000000001');
select is( (select auth.uid()), '00000000-0000-4000-8000-000000000001'::uuid,
           'act_as sets auth.uid()' );

-- ALLOW: prove the write with RETURNING, never lives_ok
select results_eq(
  $$insert into public.saved_events (user_id, event_id)
    values ('00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-0000000000e1')
    returning user_id$$,
  array['00000000-0000-4000-8000-000000000001'::uuid],
  'owner can save an event'
);

-- DENY (USING filters → no error, zero rows)
select tests.act_as('00000000-0000-4000-8000-000000000002');
select is_empty(
  $$select * from public.saved_events
    where user_id = '00000000-0000-4000-8000-000000000001'$$,
  'another user sees none of the owner''s saves'
);

-- integrity: the denied read did not delete anything
select tests.act_as('00000000-0000-4000-8000-000000000001');
select isnt_empty(
  $$select * from public.saved_events
    where user_id = '00000000-0000-4000-8000-000000000001'$$,
  'the owner still sees the row'
);

select * from finish();
rollback;
```

```bash
supabase test db --local
```

### 5. The `compute_user_scores` schedule as an idempotent migration (REFAC-03)

Production truth, from `.planning/audit/async/cron-job.json`: `jobname = compute-user-scores`, `schedule = 0 */6 * * *`, `command = SELECT compute_user_scores()`, `active: true`, 3 successful runs in the captured window.

```sql
-- supabase/migrations/<ts>_cron_compute_user_scores.sql
create extension if not exists pg_cron with schema pg_catalog;

-- Idempotent: unschedule by name first. cron.unschedule(name) raises if absent,
-- so guard on the catalog rather than swallowing the exception.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'compute-user-scores') then
    perform cron.unschedule('compute-user-scores');
  end if;
end $$;

select cron.schedule(
  'compute-user-scores',
  '0 */6 * * *',                  -- byte-identical to production
  $$SELECT compute_user_scores()$$
);
```

```sql
-- supabase/tests/database/030-cron-schedule.test.sql
begin;
select plan(2);
select is( (select schedule from cron.job where jobname = 'compute-user-scores'),
           '0 */6 * * *', 'compute-user-scores runs every six hours' );
select is( (select count(*)::int from cron.job where jobname = 'compute-user-scores'),
           1, 'exactly one schedule exists — the migration is idempotent' );
select * from finish();
rollback;
```

**Note for the plan:** `pg_cron` is installed in production (`1.6.4`) and is available locally. The other two jobs (`send-event-reminders`, `send-feedback-requests`) are **out of scope** — REFAC-03 names only `compute_user_scores`, and F-037 ("two dead cron handlers duplicate live pg_cron functions with four behavioural divergences") belongs to Phase 5.

### 6. The type drift gate (REFAC-04) — reads `--local`, needs no production credential

```yaml
# .github/workflows/ci.yml — a new job, NOT a new step in the existing `ci` job
  types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: npm }
      - uses: supabase/setup-cli@v3
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset
      - name: Regenerate types from the reconciled schema
        run: supabase gen types typescript --local --schema public > /tmp/types.gen.ts
      - name: Fail on type drift
        run: diff -u src/lib/supabase/types.ts /tmp/types.gen.ts
      - name: RLS and schema tests
        run: supabase test db --local
```

**Why a separate job:** the existing `ci` job runs `npm ci`, lint, `tsc`, `npm test`, the audit gate and `npm run build` in ~minutes without Docker. Adding `supabase start` to it would put a Docker stack on the critical path of every lint failure. A parallel job keeps the fast feedback fast. `supabase/setup-cli@v3` is the current action `[CITED: github.com/supabase/setup-cli]`.

### 7. What removing all 47 `(supabase as any)` casts actually costs — measured, not estimated

Executed 2026-09-15 in an out-of-repo copy of `src/` with the repo's `node_modules` symlinked and the repo's `tsconfig.json`. Baseline: `npx tsc --noEmit` exit **0**. After `s/(supabase as any)/supabase/g` across all 23 files:

```
src/app/api/events/[id]/friends/route.ts(38,11)   TS2345  PostgrestFilterBuilder passed where readonly (string|null)[] expected
src/app/api/events/friends-activity/route.ts(51,25) TS2345  string | null → string
src/app/api/events/friends-activity/route.ts(52,22) TS2345  string | null → string
src/app/api/events/friends-activity/route.ts(57,34) TS2345  string | null → string
src/app/api/events/friends-activity/route.ts(60,9)  TS2322  string | null → string
src/app/api/events/route.ts(255,9)                TS2322  string | null → string | undefined
src/app/api/events/route.ts(256,9)                TS2322  string | null → string | undefined
src/app/moderation/page.tsx(67,7)                 TS2352  builder → Promise<{data: AuditEntry[]|null}>
src/lib/audit.ts(31,42)                           TS2769  Record<string, unknown> → Json
```

**Nine errors, five files.** Triage for the plan:

| Site | Class | Fix |
|---|---|---|
| `friends/route.ts:38` | **latent defect** | Characterize, tag `DEFECT`, new `F-nnn`. Do not fix here. |
| `moderation/page.tsx:67` | type noise (thenable works at runtime) | Type the `Promise.all` tuple properly. |
| `friends-activity` ×4, `events/route.ts` ×2 | genuine nullability from nested joins | Handle `null` explicitly. Each is a behavior decision — write the characterization first. |
| `lib/audit.ts:31` | `Record<string, unknown>` vs `Json` | **Same shape as 5 of the 6 errors that blocked the supabase-js bump.** Fixing it here retires part of Q3. |

**`grep -c "as any" src/` is 61; `(supabase as any)` is 47.** REFAC-04's clause is the 47. The other 14 are `any` in mock factories and local casts and are **not** in scope.

### 8. The ESLint import boundary with a ratchet — verified firing

```js
// eslint.config.mjs
import coreWebVitals from "eslint-config-next/core-web-vitals";
import { LEGACY_ELEVATED_CALLSITES } from "./eslint.elevated-allowlist.mjs";

const eslintConfig = [
  { ignores: [".claude/**", ".next/**", "AI/**", "node_modules/**", "demo-video/**"] },
  ...coreWebVitals,
  {
    // REFAC-05: src/server/db/elevated/ is the only door to the service-role client.
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      // patterns ONLY — using `paths` as well double-reports every import.
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/lib/supabase/service", "@/lib/supabase/service"],
            message: "Service-role access must go through src/server/db/elevated/." },
          { group: ["@supabase/supabase-js"],
            message: "Import the typed factories; do not construct a raw SDK client in src/app/**." },
        ],
      }],
    },
  },
  // THE RATCHET. This list may only shrink. Phases 4-6 delete rows from it.
  { files: LEGACY_ELEVATED_CALLSITES, rules: { "no-restricted-imports": "off" } },
];

export default eslintConfig;
```

```js
// eslint.elevated-allowlist.mjs — GENERATED. 23 rows on 2026-09-15.
// Brackets MUST be escaped: ESLint `files` entries are globs and `[id]` is a
// character class. Unescaped, 12 of these 23 entries match nothing. (Pitfall 4)
export const LEGACY_ELEVATED_CALLSITES = [
  "src/app/auth/callback/route.ts",
  "src/app/users/\\[id\\]/page.tsx",
  "src/app/api/clubs/route.ts",
  "src/app/api/clubs/\\[id\\]/route.ts",
  // … 19 more, generated by the command below
];
```

```bash
# Regenerate (and prove the list only shrinks) — this is the CI check:
grep -rl "supabase/service\|@supabase/supabase-js" src/app/ \
  | sed 's|\[|\\\\[|g; s|\]|\\\\]|g' | sort
```

**Measured on this tree, 2026-09-15:**

| Configuration | `eslint src/app` result |
|---|---|
| Rule on, no allow-list | **46 errors** across 23 files (`@/lib/supabase/service` ×45 with both `paths`+`patterns`; `@supabase/supabase-js` ×1) |
| Rule on, allow-list **unescaped** | **12 errors** — every dynamic-route file leaked through |
| Rule on, allow-list **escaped** | **0 errors**, 9 pre-existing warnings unchanged |
| Rule on, escaped allow-list, **+ a new violating fixture** | **1 error** — the rule still bites |

The last row is REFAC-05's proof obligation: add the fixture, capture the failing `npm run lint`, remove the fixture, capture the passing one.

**One thing the rule cannot catch, and the plan should say so:** `src/app/api/admin/calculate-popularity/route.ts` builds a service-role client from `process.env.SUPABASE_SERVICE_ROLE_KEY` inline — the `@supabase/supabase-js` pattern catches *that* file, but a future file could read the env var without importing the SDK at the top level. If belt-and-braces is wanted, add a second rule:

```js
"no-restricted-properties": ["error", {
  object: "process", property: "env",
  message: "Read SUPABASE_SERVICE_ROLE_KEY only inside src/server/db/elevated/.",
}],
```
— but scope it narrowly; blanket-banning `process.env` in `src/app/**` would fire on the two `NEXT_PUBLIC_*` reads that legitimately live there.

### 9. `playwright.config.ts` — personas, webServer, and coexistence with Jest

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const PERSONAS = [
  "onboarded_student", "mid_onboarding_student", "club_member", "club_owner",
  "multi_club_organizer", "cross_club_attacker", "admin",
  "banned_permanent", "suspended_active", "suspension_expired",
] as const;

export default defineConfig({
  testDir: "./e2e",                       // outside src/ — Jest's testMatch never sees it
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,  // 1 worker: the seed is shared mutable state
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /specs\/.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
```

**Three coexistence facts, each verified against this tree:**

1. **Jest never matches `e2e/`.** `testMatch` is `<rootDir>/src/**/*.test.ts(x)` plus `<rootDir>/src/hooks/**/*.test.ts`. **No `jest.config.js` change is required.** Add `'<rootDir>/e2e/'` to `testPathIgnorePatterns` anyway as a declaration of intent — it is a no-op that documents the boundary.
2. **`tsconfig.json` DOES include `e2e/`.** Its `include` is `**/*.ts` and its `exclude` lists only `**/*.test.ts` / `**/*.test.tsx`. So `e2e/**/*.spec.ts` lands inside `npx tsc --noEmit`, which runs in CI. **That is desirable** — the specs get type-checked — and it works because `@playwright/test` ships its own types. But it means a spec with a type error **fails the existing CI type-check job**, which is a good property to have chosen deliberately rather than discovered.
3. **`test-results/` is already in `.gitignore:10`**; add `playwright-report/` and `playwright/.auth/`.

### 10. Persona sign-in without OAuth — the library serializes its own cookies

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { PERSONA_CREDENTIALS } from "../scripts/seed/personas";

const SUPABASE_URL = process.env.SUPABASE_URL!;        // from `supabase status -o env`
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

for (const [name, { email, password }] of Object.entries(PERSONA_CREDENTIALS)) {
  setup(`authenticate as ${name}`, async ({ browser }) => {
    // Let @supabase/ssr serialize the session. Never hand-build sb-<ref>-auth-token.
    const emitted: { name: string; value: string; options: CookieOptions }[] = [];
    const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => [],
        setAll: (toSet) => emitted.push(...toSet),
      },
    });

    const { error } = await client.auth.signInWithPassword({ email, password });
    expect(error, `${name} must sign in`).toBeNull();
    expect(emitted.length).toBeGreaterThan(0);

    const context = await browser.newContext();
    await context.addCookies(
      emitted.map((c) => ({
        name: c.name,
        value: c.value,
        url: "http://127.0.0.1:3000",
        httpOnly: false,          // @supabase/ssr browser cookies are readable by JS
        sameSite: "Lax" as const,
      })),
    );

    // mid_onboarding is the one persona whose state includes the guard cookie
    if (name === "mid_onboarding_student") {
      await context.addCookies([
        { name: "needs_onboarding", value: "1", url: "http://127.0.0.1:3000" },
      ]);
    }

    // Prove the session is live through the app, not just through the client.
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("body")).not.toContainText("Sign in with Google");

    await context.storageState({ path: `playwright/.auth/${name}.json` });
    await context.close();
  });
}
```

```ts
// e2e/specs/save-event.spec.ts — per-persona override
import { test, expect } from "@playwright/test";
test.use({ storageState: "playwright/.auth/onboarded_student.json" });

test("a student saves an event and it appears in My Events", async ({ page }) => {
  await page.goto("/events/00000000-0000-4000-8000-0000000000e1");
  await page.getByRole("button", { name: /save/i }).click();
  await page.goto("/my-events");
  await expect(page.getByText("Seeded Approved Event")).toBeVisible();
});
```

### 11. Deterministic primitives (REFAC-07)

```ts
// scripts/seed/clock.ts
export const PINNED_NOW = new Date("2026-06-01T12:00:00.000Z");
export const days = (n: number) => new Date(PINNED_NOW.getTime() + n * 86_400_000);
```

```ts
// scripts/seed/prng.ts — mulberry32. No package; Math.random() is not seedable in Node.
export function prng(seed = 0x554e4956) {
  return function next() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// scripts/seed/personas.ts (excerpt)
export const IDS = {
  admin:            "00000000-0000-4000-8000-000000000001",
  onboardedStudent: "00000000-0000-4000-8000-000000000002",
  clubOwner:        "00000000-0000-4000-8000-000000000003",
  // …
  approvedClub:     "00000000-0000-4000-8000-0000000000c1",
  approvedEvent:    "00000000-0000-4000-8000-0000000000e1",
} as const;

// Every address satisfies isMcGillEmail(): /^[^@]+@(mail\.)?mcgill\.ca$/i
export const PERSONA_CREDENTIALS = {
  admin:            { email: "seed.admin@mail.mcgill.ca",   password: "seed-local-only-1" },
  onboarded_student:{ email: "seed.student@mail.mcgill.ca", password: "seed-local-only-1" },
  // … minimum_password_length is 6 in config.toml
} as const;
```

```ts
// scripts/seed/load.ts (shape)
import { assertSeedTargetAllowed } from "./guard";
const url = assertSeedTargetAllowed(process.env.SUPABASE_URL);      // throws on production
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

for (const p of PERSONAS) {
  await admin.auth.admin.deleteUser(p.id).catch(() => {});          // idempotence
  const { error } = await admin.auth.admin.createUser({
    id: p.id,                       // ← the fixed UUID; verified supported
    email: p.email,
    password: p.password,
    email_confirm: true,
    user_metadata: { name: p.name },
  });
  if (error) throw error;
}
// …then upsert public.users / clubs / club_members / events / rsvps / saved_events
```

### 12. The seed loader's hard refusal (REFAC-07)

```ts
// scripts/seed/guard.ts
import fs from "node:fs";

const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

/** Reads .env.local for the production project ref ONLY. Never for a value. */
function productionRef(): string | null {
  try {
    const line = fs.readFileSync(".env.local", "utf8")
      .split("\n").find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
    return line?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  } catch { return null; }
}

export function assertSeedTargetAllowed(raw: string | undefined): string {
  if (!raw) throw new Error("SUPABASE_URL is not set. Run: supabase status -o env");

  if (LOCAL.test(raw)) return raw;

  // The only non-local target is an explicitly named staging project.
  const ref = raw.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const staging = process.env.SEED_STAGING_PROJECT_REF;
  const prod = productionRef();

  if (ref && prod && ref === prod) {
    throw new Error("REFUSED: target matches the project ref in .env.local (production).");
  }
  if (!staging || ref !== staging || process.env.SEED_I_UNDERSTAND_TARGET !== "staging") {
    throw new Error(
      "REFUSED: seed targets local only. For staging set SEED_STAGING_PROJECT_REF " +
      "and SEED_I_UNDERSTAND_TARGET=staging.",
    );
  }
  return raw;
}
```

**Why the deny rule reads `.env.local` rather than hard-coding a ref:** the Phase 1 redaction ledger substitutes `<PROD-PROJECT-REF>` in every committed artifact — **the production ref may not be committed.** Reading it from the gitignored file at run time gives a self-configuring guard on any developer machine with nothing sensitive in git. `.env.local` is read, never written (L6).

**Required negative tests** (these are the requirement, not extras): the loader must exit non-zero for (a) the production URL from `.env.local`, (b) an arbitrary `https://<other>.supabase.co`, (c) staging without `SEED_I_UNDERSTAND_TARGET`, and must succeed only for `http://127.0.0.1:54321`.

### 13. Auth callback characterization — **executed green against unmodified source**

Written and run 2026-09-15 in an out-of-repo copy of `src/` with the repo's `jest.config.js`. Result: **`Test Suites: 1 passed` · `Tests: 4 passed`**, with `src/app/auth/callback/route.ts` byte-unmodified.

```ts
// src/app/auth/callback/route.test.ts   (PRESERVE — REFAC-08)
import { NextRequest } from "next/server";

const exchangeCodeForSession = jest.fn();
const getUser = jest.fn();
const signOut = jest.fn();
const upsert = jest.fn().mockResolvedValue({ error: null });
const single = jest.fn();
const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
const deleteUser = jest.fn().mockResolvedValue({ error: null });

// The route imports createServerClient from @supabase/ssr DIRECTLY — not from
// @/lib/supabase/server. Mocking @/lib/supabase/server mocks nothing here.
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession, getUser, signOut } }),
}));
// A SECOND service-role client is built inline for auth.admin.deleteUser.
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { deleteUser } } }),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({ upsert, update, select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

describe("GET /auth/callback (PRESERVE)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    single.mockResolvedValue({ data: { onboarding_completed: false, roles: ["user"] } });
  });

  it("redirects with error=no_code when code is absent", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("https://x.test/auth/callback"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("no_code");
  });

  it("rejects a non-McGill email and deletes the orphaned auth user", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@gmail.com", user_metadata: {} } }, error: null });
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("https://x.test/auth/callback?code=abc"));
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("not_mcgill");
    expect(signOut).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("upserts the profile and routes a new McGill user to /onboarding", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: "u2", email: "s@mail.mcgill.ca", user_metadata: { name: "S" } } },
      error: null });
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("https://x.test/auth/callback?code=abc"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
    expect(upsert).toHaveBeenCalled();
    expect(res.cookies.get("needs_onboarding")?.value).toBe("1");
  });

  // ADMIN_EMAILS is parsed at MODULE LOAD (route.ts:21). Setting it in beforeEach
  // does nothing to an already-imported module.
  it("auto-assigns admin for an ADMIN_EMAILS address", async () => {
    jest.resetModules();
    process.env.ADMIN_EMAILS = "boss@mcgill.ca";
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: "u3", email: "boss@mcgill.ca", user_metadata: {} } }, error: null });
    single.mockResolvedValue({ data: { onboarding_completed: true, roles: ["user"] } });
    const { GET } = await import("./route");
    await GET(new NextRequest("https://x.test/auth/callback?code=abc"));
    expect(update).toHaveBeenCalledWith({ roles: ["user", "admin"] });
  });
});
```

**REFAC-08 names five behaviors; the probe covers four.** The fifth — **OAuth exchange failure** — is a one-liner on the same seams (`exchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } })` → `?error=auth_failed`). Two further behaviors worth adding, both reachable with these mocks and both recording facts a later phase will want: the `errorParam` branch (`?error=access_denied` → passthrough) and the **`SUPABASE_SERVICE_ROLE_KEY`-absent** branch, which skips profile sync entirely and lets the user in — a live production condition, since the audit shows only three env vars configured.

---

## Recommended Vertical-Slice Decomposition (MVP mode)

Phase 3's mode is `mvp`, but its deliverable is a *foundation*, not a user-visible feature. The honest reading of "vertical slice" here is: **each plan ends with a command that runs and a green result, not a layer that merely exists.** Every plan below names that command.

**Seven plans, five waves.**

### Wave 1 — three plans in parallel, no interdependency

| Plan | Subject | Requirements | Ends green when |
|---|---|---|---|
| **03-01** | **Preflight and production transport.** Free the Supabase ports; `supabase start`; re-scope `.mcp.json` to `?project_ref=…&read_only=true`; capture the `transaction_read_only = on` envelope; add the two named queries to `sql-readonly.mjs`; run the Q1 experiment and record the answer; add the migration-filename parse check. | REFAC-01 (prep), AR-12 | `supabase status` reports a running stack **and** `evidence/transport-identity.json` reads `txn_read_only: "on"` |
| **03-02** | **Auth callback characterization.** The 5–7 behaviors of § Code Examples 13, written against unmodified source. `git diff -- src/app/auth/callback/route.ts` must be empty. | **REFAC-08** | `npx jest --ci --selectProjects node --testPathPatterns "auth/callback"` green, and the route file unchanged |
| **03-03** | **The seam kit.** `src/server/{context,http,errors}.ts`, `authz/require{User,Role,ClubRole}.ts`, `db/elevated/{index.ts,REGISTRY.md}`, unit tests for each; the ESLint rule + generated ratchet allow-list + the fixture proof. **Zero routes touched.** | **REFAC-05** | `npm run lint` exits 0 with the rule active; the fixture proof is captured before/after; `npx jest src/server` green; `grep -rl "supabase/service" src/app \| wc -l` still **23** |

*Why REFAC-08 and REFAC-05 go first:* neither depends on the database, both are the items most likely to be squeezed if REFAC-01 overruns, and REFAC-08 is contractually a *before* obligation.

### Wave 2 — the critical path, alone

| Plan | Subject | Requirements | Ends green when |
|---|---|---|---|
| **03-04** | **Migration reconciliation.** Archive the 44 files as 44 pure renames; `supabase db pull baseline --linked`; review the baseline against F-044/F-047/F-048/F-049 by eye; `db reset` exit 0; `db diff --linked` empty. Record the production-history-repair decision (do it behind a checkpoint, or defer it in writing). | **REFAC-01** | `supabase db reset` exit 0 with no `Skipping` line, **and** `supabase db diff --linked` produces an empty file |

### Wave 3 — blocked on 03-04

| Plan | Subject | Requirements | Ends green when |
|---|---|---|---|
| **03-05** | **Schema fixes with their tests.** `<ts>_fk_indexes_and_policy_gaps.sql` (the 9 FK indexes from the never-applied `20260316000004`, the `events (status, start_date) WHERE deleted_at IS NULL` composite from `rls-review.md` §5, the `DROP TABLE events_tests`, and the audit-named policy gaps); `<ts>_cron_compute_user_scores.sql`; `supabase/tests/database/000-setup.sql` + one pgTAP allow/deny file per fixed policy + the index and cron assertions; every test mutation-checked. | **REFAC-02, REFAC-03** | `supabase test db --local` green; `supabase db reset && supabase db diff --linked` **still** empty except for the deliberate additions, each named |

### Wave 4 — blocked on 03-05

| Plan | Subject | Requirements | Ends green when |
|---|---|---|---|
| **03-06** | **Generated types and the cast retirement.** `supabase gen types --local` → `src/lib/supabase/types.ts`; the CI `types` job; remove all 47 `(supabase as any)` casts; fix the 7 type-noise errors; characterize + tag `DEFECT` the 2 latent defects. | **REFAC-04** | `grep -c "(supabase as any)" src/` → **0**; `npx tsc --noEmit` exit 0; the CI drift diff empty; `check-baseline.mjs` still 22/0 |

### Wave 5 — blocked on 03-05 (not on 03-06)

| Plan | Subject | Requirements | Ends green when |
|---|---|---|---|
| **03-07** | **Seed and persona harness.** `scripts/seed/*` with its guard and negative tests; install `@playwright/test@1.63.0` (its own reviewed lockfile diff); `playwright.config.ts`; `e2e/auth.setup.ts` producing 10 storage states; six happy-path specs; the `/admin-login` cookie-equivalence cross-check; the Playwright CI job. | **REFAC-06, REFAC-07** | `supabase db reset && npx tsx scripts/seed/load.ts && npx playwright test` → 10 setup + 6 specs green; the loader's 3 refusal tests exit non-zero as designed |

**Dependency graph:**

```
03-01 ─┐
03-02  ├─ (independent)
03-03 ─┘
03-01 ──▶ 03-04 ──▶ 03-05 ──┬──▶ 03-06
                            └──▶ 03-07
```

**Two sequencing notes for the planner.** (1) 03-07 depends on 03-05, **not** on 03-06 — the seed and the harness need a replayable schema, not regenerated types. Running them in parallel shortens the phase by a wave. (2) If Q1 (§ Open Questions) returns "`statements` is populated," 03-04 gains an optional, *additive* task — write the 18 recovered files into `_archive_pre_baseline/recovered/` as documentation of the March burst. It must not change the baseline strategy; the baseline is still production truth.

---

## State of the Art

| Old approach | Current approach | When changed | What it means here |
|---|---|---|---|
| Hand-written Supabase types, or `gen types` run ad hoc | `gen types --local` from the reconciled schema, gated in CI | — | The audit disproved the "hand-written types" premise in `codebase/CONCERNS.md`; REFAC-04's real content is the gate, not the generation |
| `auth.role() = 'authenticated'` inside a policy | `TO authenticated` on the policy | Supabase deprecation | **61 of 101 live policies carry no `TO` clause** (F-018); 3 tables use the deprecated `auth.role()` form. Not this phase's fix, but do not write new policies that way |
| `using (auth.uid() = user_id)` | `using ((select auth.uid()) = user_id)` | Supabase RLS performance guidance | **68 unwrapped occurrences across 59 policies** (F-019). Every policy REFAC-02 *writes* must use the wrapped form |
| `supabase db diff --use-pg-schema` | `--use-pg-delta` or the default `migra` | CLI 2.x | `--use-pg-schema` is marked **Deprecated** in `db diff --help` on 2.115.0 |
| `src/middleware.ts` | `src/proxy.ts` | Next.js 16 | Already migrated (commit `0d66a1d`). Do not re-create `middleware.ts` |
| Route handler `params: { id: string }` | `params: Promise<{ id: string }>` | Next.js 15/16 | Already adopted throughout this tree |
| `supabase/setup-cli@v1` | **`supabase/setup-cli@v3`** | — | v3 is current; it can read the declared version from a lockfile |
| Jest `--testPathPattern` | **`--testPathPatterns`** (plural) | Jest 30 | Verified live on this tree |
| `cookies()` synchronous | `cookies()` **async** | Next.js 15 | `lib/supabase/server.ts` already awaits it; the seam must too |

**Deprecated / outdated in this tree:**

- `008b_add_is_admin_to_users.sql` — a filename the CLI cannot parse, skipped silently since it was written.
- `20251128053245_remote_schema.sql` and `20260223193741_remote_schema.sql` — two prior baseline attempts that did not hold. **That is evidence this is the third attempt**, and a reason to write down *why* this one is different (the archive + the `db diff` gate, neither of which existed before).
- `test-results/` — an empty gitignored directory from a Playwright run that never happened in this tree.

---

## Environment Availability

Probed on this machine 2026-09-15.

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | ✓ | **24.16.0** (matches `engines: 24.x`) | — |
| npm | everything | ✓ | **11.13.0** (matches `>=11`) | — |
| Docker | `supabase start`, `db reset`, `test db` | ✓ | **29.4.0** (OrbStack context), daemon reachable | none — REFAC-01/02/03/06/07 all require it |
| **Supabase host ports 54321–54324, 54327** | `supabase start` | **✗ BUSY** | held by `supabase_*_PassiveIncomeInvestingDEMO` | `supabase stop --project-id PassiveIncomeInvestingDEMO`, or re-port `config.toml` (see Pitfall 1) |
| Supabase CLI | all database work | ✓ | **2.115.0** installed globally (2.117.0 is latest) | `npx supabase@2.117.0` resolves |
| `supabase db advisors` | REFAC-02 discovery | ✓ | needs ≥2.81.3; have 2.115.0 | MCP `get_advisors` |
| `psql` | — | ✗ | not on PATH | **Not needed.** `supabase test db` and `db reset` run inside containers |
| Playwright browsers | REFAC-06 | ✗ not installed | `npx playwright --version` resolved 1.63.0 from the registry | `npx playwright install --with-deps chromium` |
| npm registry | the one install | ✓ | `npm view @playwright/test version` → 1.63.0 | — |
| Production Supabase (read) | REFAC-01 baseline + final diff | ✓ via MCP / `sql-readonly.mjs` | Postgres 17.6, `pg_cron` 1.6.4 installed | none — the baseline is production truth |
| `SUPABASE_ACCESS_TOKEN` + project ref in the shell | `sql-readonly.mjs`, `db pull --linked` | **? unknown** | never supplied in Phase 1 (`BLOCKING-INPUTS.md § 1`); Phase 1 used the agent runtime's OAuth MCP grant instead | MCP `execute_sql` with `read_only=true` |
| **Staging Supabase project** | REFAC-07's "and staging" | **✗ DOES NOT EXIST** | `events-date-columns.md`: *"the only project visible to the operator's token; no staging project exists under this account"* | Write the staging code path, guard it, mark it untested |
| Vercel deploy path | any deployed verification | ✗ not git-linked | previews need an explicit `vercel deploy` and sit behind Deployment Protection | Verify locally; name the limitation |
| `gh` CLI | CI run observation | ✓ (used in Phase 2) | — | GitHub web UI |

**Missing dependencies with no fallback:**
- **Supabase host ports.** Wave 0, task 1. One command.
- **A staging environment.** REFAC-07 cannot be fully satisfied as written. **Recommended honest disposition:** implement and unit-test the loader's staging branch (including its refusal cases), mark REFAC-07 *partially met* with "staging path implemented and guarded; no staging project exists to load into — see `events-date-columns.md`," and file the absence as a finding, exactly as `migration-list.staging.txt` itself suggests: *"If it turns out no staging project exists at all, that is itself an AUDIT-02 finding — a two-environment promotion story documented as a three-environment one."*

**Missing dependencies with fallback:** Playwright browsers (install step); `SUPABASE_ACCESS_TOKEN` (MCP grant).

---

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Unit framework | **Jest 30.2.0 + ts-jest 29.4.6**, two projects (`node`, `jsdom`). Unchanged. |
| E2E framework | **`@playwright/test` 1.63.0** — introduced by this phase, `playwright.config.ts` at the root, specs in `e2e/` |
| DB framework | **pgTAP** via `supabase test db --local`, tests in `supabase/tests/database/` |
| Quick run command | `npx jest --ci --selectProjects node --testPathPatterns "<regex>"` — **note the plural** (Pitfall 11) |
| Full unit suite | `npm test -- --ci` — **278 passed / 5 skipped / 22 of 23 suites** at the Phase 2 exit |
| Phase floor | `node .planning/phases/02-*/evidence/tools/check-baseline.mjs` — **22 passed, 0 failed** on this tree, re-verified 2026-09-15 |
| Full DB suite | `supabase db reset && supabase test db --local` |
| Full E2E suite | `npx tsx scripts/seed/load.ts && npx playwright test` |

**Baseline numbers this phase must not regress** (all re-measured live 2026-09-15):

| Metric | Value | Asserted by |
|---|---|---|
| Jest passing | **278** | `check-baseline.mjs` (≥ 220) |
| Jest skipped | **5** | `check-baseline.mjs` (≤ 36) |
| Executing suites | **22 of 23** | `check-baseline.mjs` (≥ 16 of 21) |
| `tsc --noEmit` | exit 0, zero bytes | `check-baseline.mjs` |
| `eslint .` | **0 errors, 19 warnings** | `check-baseline.mjs` — **the boundary rule must not move this** |
| `(supabase as any)` in `src/` | **47 → target 0** | REFAC-04 |
| Files under `src/app/**` importing the service client | **23 → must stay 23** | REFAC-05 (zero routes) |

### Phase requirements → test map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| REFAC-01 | `db reset` replays every file with no skip | integration | `supabase db reset && ! grep -qi skipping evidence/db-reset.txt` | ❌ Wave 0 |
| REFAC-01 | The reset result matches production | integration | `supabase db diff --linked --schema public,storage > d.sql && test ! -s d.sql` | ❌ Wave 0 |
| REFAC-01 | No existing migration file was renamed | smoke | `git diff -M --summary <base>..HEAD -- supabase/migrations \| grep -c '^ rename' ` → **44**, and `git diff -M --numstat` shows 0 content changes | ❌ Wave 0 |
| REFAC-01 | Every migration filename parses | smoke | the 4-line node check in Pitfall 3 | ❌ Wave 0 |
| REFAC-02 | Each new FK index exists | db | `supabase test db --local` → `010-fk-indexes.test.sql` using `has_index()` | ❌ Wave 0 |
| REFAC-02 | Each fixed policy allows the owner and denies the stranger | db | `supabase test db --local` → `020-rls-*.test.sql`, `results_eq` + `is_empty` + integrity | ❌ Wave 0 |
| REFAC-02 | Each allow/deny test actually bites | manual-only | mutation check: comment the policy out, confirm red, restore. **A human observes the red.** | ❌ Wave 0 |
| REFAC-03 | `compute-user-scores` is scheduled at `0 */6 * * *`, exactly once | db | `supabase test db --local` → `030-cron-schedule.test.sql` | ❌ Wave 0 |
| REFAC-03 | The migration is idempotent | integration | `supabase db reset` twice; job count stays 1 | ❌ Wave 0 |
| REFAC-04 | Types match the reconciled schema | integration | `supabase gen types typescript --local --schema public > /tmp/t.ts && diff -u src/lib/supabase/types.ts /tmp/t.ts` | ❌ Wave 0 (CI job) |
| REFAC-04 | Zero `(supabase as any)` casts | smoke | `test "$(grep -rc '(supabase as any)' src/ \| awk -F: '{s+=$2} END{print s}')" = 0` | ❌ Wave 0 |
| REFAC-04 | The tree still type-checks | integration | `npx tsc --noEmit` exit 0 | uses existing |
| REFAC-05 | The boundary rule fails the build on a violation | smoke | add fixture → `npm run lint` exit ≠ 0 (captured); remove → exit 0 (captured) | ❌ Wave 0 |
| REFAC-05 | The ratchet only shrinks | smoke | regenerate the list; assert it is a subset of the committed one | ❌ Wave 0 |
| REFAC-05 | The seam is applied to zero routes | smoke | `git diff --name-only <base>..HEAD -- src/app/ \| grep -c 'route\.ts$'` → **0** | ❌ Wave 0 |
| REFAC-05 | `requireUser`/`requireRole`/`requireClubRole` behave | unit | `npx jest --ci --selectProjects node --testPathPatterns "src/server"` | ❌ Wave 0 |
| REFAC-06 | Every persona gets a storage state | e2e | `npx playwright test --project=setup` → 10 passed; 10 files in `playwright/.auth/` | ❌ Wave 0 |
| REFAC-06 | Six happy paths pass | e2e | `npx playwright test --project=chromium` | ❌ Wave 0 |
| REFAC-06 | The shim's cookies equal the app's | e2e | the `/admin-login` cross-check spec | ❌ Wave 0 |
| REFAC-07 | The seed is deterministic | integration | run twice; `pg_dump --data-only` of the seeded tables is byte-identical | ❌ Wave 0 |
| REFAC-07 | Every role/ban/club/event status is present | db | a pgTAP `040-seed-coverage.test.sql` counting one row per required state | ❌ Wave 0 |
| REFAC-07 | The loader refuses production | unit | 3 negative cases in `scripts/seed/__tests__/guard.test.ts`, each asserting a throw | ❌ Wave 0 |
| REFAC-08 | Callback behaviors are pinned before modification | unit | `npx jest --ci --selectProjects node --testPathPatterns "auth/callback"` **and** `git diff <base>..HEAD -- src/app/auth/callback/route.ts` empty | ❌ Wave 0 — **shape verified live, passes today** |
| Phase floor | Nothing regressed | integration | `node .planning/phases/02-*/evidence/tools/check-baseline.mjs` → 22/0 | uses existing |

### Sampling rate

- **Per task commit:** `npx jest --ci --selectProjects node --testPathPatterns "<touched>"` — the full node project is ~1 s on this tree, so there is no cost argument for sampling less.
- **Per plan completion:** `npm run lint && npx tsc --noEmit && npm test -- --ci && node .planning/phases/02-*/evidence/tools/check-baseline.mjs`. Plans 03-04 onward add `supabase db reset && supabase test db --local`. Plan 03-07 adds `npx playwright test`.
- **Per wave merge:** the plan gate plus `npm run build`.
- **Phase gate:** from a clean `supabase db reset` — DB tests green, seed loaded, all 6 specs green, type drift diff empty, `(supabase as any)` count 0, `check-baseline.mjs` 22/0, and `git diff --name-only -- src/app/**/route.ts` empty.

### Wave 0 gaps

- [ ] **Free the Supabase ports.** Nothing below runs until this is done.
- [ ] `.mcp.json` re-scoped to `?project_ref=…&read_only=true` + `evidence/transport-identity.json`.
- [ ] Two named queries added to `.planning/audit/tools/sql-readonly.mjs`.
- [ ] `src/app/auth/callback/route.test.ts` — **shape verified live; transcribe § Code Examples 13 and add the 3 remaining behaviors.**
- [ ] `eslint.elevated-allowlist.mjs` — generated with **escaped brackets** (Pitfall 4).
- [ ] The migration-filename parse check (a script + a CI step).
- [ ] `supabase/tests/database/000-setup.sql` — pgtap + `tests.act_as` / `tests.act_as_anon`.
- [ ] `scripts/seed/{guard,prng,clock,personas,load}.ts` + `scripts/seed/__tests__/guard.test.ts`.
- [ ] `playwright.config.ts`, `e2e/auth.setup.ts`, `e2e/specs/*.spec.ts` ×6.
- [ ] `.gitignore` += `playwright-report/`, `playwright/.auth/`.
- [ ] CI: one new `types` job (Docker + Supabase) and one new `e2e` job. **Do not add Docker steps to the existing fast `ci` job.**
- [ ] Framework install: **`@playwright/test@1.63.0` only.** Jest, ts-jest, tsx and dotenv are already present.

### The six happy-path specs (REFAC-06) mapped to `PROJECT.md` Validated workflows

| # | Spec | Persona | Validated workflow it re-confirms |
|---|---|---|---|
| 1 | Anonymous browse, search, and tag/date filter on `/` | `anonymous` | "Anonymous visitors can browse public event and club content"; "browse, search, and filter events by tag, date, and time of day" |
| 2 | Save an event, then see it on `/my-events`; RSVP `going` on the event page | `onboarded_student` | "User can save/unsave events and RSVP (going/interested/cancelled)" |
| 3 | Protected-route redirect: `GET /my-events` anonymous → `/?signin=required&next=/my-events`; signed in → 200 | `anonymous` + `onboarded_student` | The auth ring — **and it closes `02-REVIEW.md` WR-04's gap at the e2e tier**, which no Jest test covers |
| 4 | Club owner opens `/my-clubs`, sees the approved club, opens its event list | `club_owner` | "Club organizers create and edit clubs, post events… and switch between multiple clubs" |
| 5 | Admin reaches `/moderation` and sees the pending event and pending club in the queue | `admin` | "Admins approve/reject events and clubs" |
| 6 | A banned user on any protected path is redirected to `/banned` | `banned_permanent` | **Closes the `STAB-06` / `T-02-06-03` residual** — "the ban-check positive case needs a banned session from the Phase 3 seed" |

**Spec 6 is the one to write first.** It is the only item in this phase that closes a carried-forward Phase 2 residual, and the residual exists precisely because no seeded banned session existed. Spec 3 is second, for the same reason at the review tier. Two further candidates if a seventh and eighth are wanted: `cross_club_attacker` receiving a 403 on another club's settings (a Phase 5 preview), and `mid_onboarding_student` being redirected to `/onboarding` (which also exercises the storage-state cookie plumbing).

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | **yes** | McGill enforcement is pinned by REFAC-08's characterization before anything modifies it. Seeded personas use `auth.admin.createUser` with `email_confirm: true` and local-only passwords; **no seeded credential resembles a production one** and every seeded address is `@mail.mcgill.ca`. |
| V3 Session Management | **yes** | Persona storage states are per-persona files under a gitignored `playwright/.auth/`. Session cookies are produced by `@supabase/ssr`'s own serializer — no hand-built token. `getUser()`, never `getSession()`, in the seam. |
| V4 Access Control | **yes** | The phase's centre of gravity. `requireUser`/`requireRole`/`requireClubRole` fail closed by construction (`{ok:false, response}` is the default arm). `src/server/db/elevated/` + the ESLint boundary is a *build-time* access-control ring over the RLS-bypassing credential. RLS allow/deny tests assert the second ring. **Admin is not a club-role bypass** (persona rule R9) — encoding one would be both a behavior change and a privilege escalation. |
| V5 Input Validation | **yes (deferred)** | zod and `src/contracts/` are REFAC-15, Phase 6. This phase adds no new input surface — the seam is applied to zero routes. The one new input is the seed loader's `SUPABASE_URL`, validated by an allow-list that fails closed. |
| V6 Cryptography | **no** | Nothing in this phase hashes, signs, or encrypts. `auth.admin.createUser` delegates password hashing to GoTrue — **which is why hand-inserting into `auth.users` with `crypt()` was rejected** (§ Don't Hand-Roll). |
| V7 Error Handling & Logging | partial | `src/server/errors.ts` must not leak internals: the existing convention is a specific message on validation/authz failures and a generic `{ error: "Failed to [action]" }` from the outer catch. Preserve it. Structured logging is REFAC-20, Phase 6. |
| V9 Communications | **no** | No new network surface. Production is read over TLS through the Management API. |
| V12 Files & Resources | **no** | Storage buckets are captured by the baseline as DDL; no upload path changes. F-031/F-032/F-033/F-034 are Phase 5. |
| V14 Configuration | **yes** | `.mcp.json` re-scoping is a configuration security control (§ Production Transport). `.env.local` is read-only and only for a project ref. The seed loader's allow-list is configuration that fails closed. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation (and its Phase 3 form) |
|---|---|---|
| Synthetic data written to production | Tampering | `assertSeedTargetAllowed()` — local-only by URL shape; staging requires two env vars; **refuses any ref matching `.env.local`**. Three negative tests are part of the requirement, not extras. |
| The MCP `execute_sql` grant is a privileged production transport | Elevation of Privilege | `?read_only=true&project_ref=<ref>`; a `transaction_read_only = on` envelope captured per plan **before** any read. This is the unmet AR-12 clause. |
| The laptop's `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS against production | Tampering | The seed never reads it for production; no plan writes to production except the optional, checkpointed `migration repair`. |
| A migration is silently skipped and a control never lands | Repudiation | The filename parse check turns a silent skip into a build failure (F-047's own recommended fix). |
| An RLS test passes while the policy is broken | Repudiation | The `lives_ok` prohibition + mandatory mutation check (§ Pattern 4, Pitfall 7). `02-REVIEW.md` WR-04 is the precedent for taking this seriously. |
| A new route reaches the service-role client without review | Elevation of Privilege | The ESLint boundary, **verified firing**, with a ratchet that may only shrink. Residual: the rule cannot see a dynamic `import()` or a bare `process.env` read — stated, with an optional `no-restricted-properties` companion. |
| Persona storage states leak a real session into git | Information Disclosure | `playwright/.auth/` gitignored; every persona is a synthetic local-only account; the CI job regenerates them rather than restoring a cache. |
| The baseline silently drops a live production policy | Tampering | 41 of 101 policies exist only in production. The baseline must be reviewed against `rls/pg_policies.json` **by count and by name**, not merely eyeballed. This is a required verification step in 03-04, not an optional one. |
| Secrets reaching committed artifacts | Information Disclosure | Phase 1's redaction discipline continues: `sql-readonly.mjs` scrubs JWTs, `sbp_`/`sb_secret_` tokens, connection strings and bearer headers before anything is written; the production ref stays `<PROD-PROJECT-REF>`; `set -x` is never enabled. |

**Disposition against `security_block_on: high`:** no new High is introduced by this phase. `F-025` (personalized responses under a session-independent CDN key) remains **Open at Critical** and is explicitly **not** this phase's work — `REFAC-19`, Phase 6. The plan's completion note must say so, exactly as `STAGE-2-COMPLETION.md § 12.3` did, so silence is not read as closure.

---

## Assumptions Log

Claims tagged `[ASSUMED]` — training knowledge or inference, **not** verified in this session. The planner should treat each as needing confirmation before it becomes a locked decision.

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `supabase db pull baseline --linked` against an **empty** top-level migrations directory emits the complete production schema as one migration | Pattern 1 | **High.** The critical path's first step. Mitigation: it is cheap to try, and `db dump --linked --schema public,storage` is the documented fallback that produces the same DDL by a different route. Verify in 03-04 before building on it. |
| A2 | `supabase migration repair --status applied <baseline>` is sufficient to make a future `db push` work, without marking the 45 historical versions reverted | Pattern 2 | Medium. Only matters for post-phase deployment. The recommendation already gates this behind a checkpoint. |
| A3 | React `cache()` provides per-request memoization inside Route Handlers (not only render passes) | Pattern 3 | Low — **the recommendation explicitly does not rely on it.** Handlers call `createRequestContext()` explicitly. |
| A4 | `context.addCookies()` with `@supabase/ssr`'s emitted cookies produces a session the app accepts | Pattern 6, Code Examples 10 | **High.** The whole harness rests on it. Mitigation: the setup step asserts it through the app (`page.goto('/')` and a signed-in assertion), and the `/admin-login` cross-check proves equivalence against the real UI path. |
| A5 | `cron.unschedule(name)` raises when the job is absent, so the catalog guard is required | Code Examples 5 | Low. The `if exists` guard is correct either way. |
| A6 | The 18 remote-only versions are dashboard SQL-editor runs | Migration State Table | Low. Phase 1 inferred this from their shape (bare timestamps, no name). The baseline does not depend on the answer. |
| A7 | `httpOnly: false` is correct for the `@supabase/ssr` browser cookies added via `addCookies` | Code Examples 10 | Medium. If wrong the session is invisible to the browser client. Resolved by the same assertion as A4. |
| A8 | The `.in()` call at `friends/route.ts:38` is a live defect rather than an intentional PostgREST sub-select idiom | Pitfall 6 | Low. It is tagged `DEFECT` and characterized, not fixed, in this phase — so being wrong costs a test, not a behavior change. |
| A9 | Adding `@playwright/test` does not trip `check-baseline.mjs`'s `no-unplanned-majors` check | Standard Stack | Low. That check compares **existing** declared ranges for moved majors; a new name is not a moved major. Re-run it after the install and confirm 22/0. |
| A10 | The production project ref appears in `.env.local` as `https://<ref>.supabase.co` | Code Examples 12 | Medium. If the URL is a custom domain the regex misses and the deny rule silently does nothing. **Add an assertion that `productionRef()` returned non-null when `.env.local` exists**, and fail closed if it did not. |

---

## Open Questions

1. **Are the SQL `statements` of the 18 remote-only migrations recoverable from `supabase_migrations.schema_migrations`?**
   - *What we know:* Supabase's migration history table carries a `statements text[]` column, and `supabase migration fetch` exists precisely to "fetch migration files from history table" `[VERIFIED: CLI 2.115.0 --help]`. Phase 1 read the history through the Management API's `list_migrations`, which returned **only `version`** for these rows — but `list_migrations` is a management endpoint, not a read of the table's full row.
   - *What's unclear:* whether `statements` is populated for dashboard-editor runs. If it is, the March burst is fully explainable and the 18 files can be written back verbatim at their original versions — **no renaming, and the history becomes replayable without a baseline at all.**
   - *Recommendation:* **run this first, in 03-01.** One read-only query through `sql-readonly.mjs` (§ Code Examples 1) answers it. **The baseline strategy does not depend on the answer** — a positive answer only adds documentation value — so this experiment can never block the critical path. Do not use `migration fetch --linked` (Pitfall 10).

2. **Is production's `schema_migrations` repaired in this phase, or deferred?**
   - *What we know:* REFAC-01's text names `migration repair`; nothing in the five success criteria requires production to be touched; a clean `db diff` is achievable without it. It would be the phase's **only** production write.
   - *What's unclear:* whether the phase owner wants deployment continuity restored now or at Phase 8's certification.
   - *Recommendation:* plan it as **one task behind `checkpoint:human-verify`** with the version captured beforehand and its own threat-model row — and make the plan explicit that skipping it is an acceptable outcome that does not fail the phase. This is a decision for the phase owner, not the executor.

3. **Does the deferred `@supabase/supabase-js` 2.81.1 → 2.116.0 bump land in this phase?**
   - *What we know:* `supabase-js-decision.md` defers it to Phase 3 by name, lists the six `TS2345` sites it fails on, and states three prerequisites: the seed (so smoke row 2 can distinguish an SDK regression from an empty database), characterization over the six mutation routes, and **payload builders emitting typed object literals — not casts.** This research measured that **`lib/audit.ts:31` fails with the same `Record<string, unknown>` → `Json` shape at 2.81.1** once its cast is removed, so REFAC-04 retires part of the work regardless. It also warns that no changelog was read across 35 minors and that 2.116 replaces `ws` with native WebSocket — a runtime transport change `tsc` cannot see.
   - *What's unclear:* whether "characterization over six mutation routes" is compatible with L3 (zero routes touched). Fixing a payload builder inside `src/app/api/admin/users/[id]/route.ts` **is** touching a route.
   - *Recommendation:* **do not bundle it into REFAC-04.** Either make it an eighth, optional plan gated on 03-06 and 03-07 both being green, or re-record the deferral to Phase 4 — where the mutation routes are in scope anyway. Deferring again is defensible (it closes no advisory); **deferring silently is not**, and the drift grows either way.

4. **Does the `tsconfig` test-file exclusion (the unclosed half of `F-066`) close here?**
   - *What we know:* `STAGE-2-COMPLETION.md § 12.1` names **Phase 3 as its natural home** — "alongside the generated Supabase types and the type-drift check, because all three are the same problem: the type system is not currently looking at everything it should." `02-RESEARCH.md` Pitfall 5 measured the cost: removing the exclusion produces **86 errors across 10 files**, of which 38 are cross-file `const` collisions fixed by adding `export {}`, ~14 are jest-dom types, and the rest are genuine fixture drift.
   - *What's unclear:* whether ~86 mechanical fixes belong in a phase whose critical path is already the hardest item in the program.
   - *Recommendation:* **scope it out of Phase 3 and say so in writing.** It is a day of unrelated mechanical work that would sit on the same commits as the type regeneration and make the REFAC-04 diff unreviewable. If it is taken, it must be its own plan with its own commit, never folded into 03-06.

5. **How should REFAC-07's "and staging" be discharged, given no staging exists?**
   - *What we know:* `events-date-columns.md` records "no staging project exists under this account"; `migration-list.staging.txt` is a deferred-with-reason stub whose own note says an absent staging project "is itself an AUDIT-02 finding."
   - *What's unclear:* whether the phase owner will provision one.
   - *Recommendation:* implement and unit-test the staging branch **including its refusal cases**, mark REFAC-07 partially met with the clause named, and file the absence as a new finding. Do not quietly widen the guard to make an untestable path look tested.

---

## Sources

### Primary (HIGH confidence — verified by execution in this session)

- `supabase --version` → **2.115.0**; `supabase {migration,db,test,gen types} --help` — every CLI claim in § Pattern 1/2/4/5 and the Migration State Table
- `npx tsc --noEmit` on an out-of-repo copy of `src/` with all 47 `(supabase as any)` casts stripped → **9 errors, 5 files** (§ Code Examples 7)
- `npx eslint` with the boundary rule, three configurations → **46 / 12 / 0 errors** (§ Code Examples 8, Pitfall 4)
- `npx jest --ci --selectProjects node --testPathPatterns "route.probe"` → **4 passed** against the unmodified callback route (§ Code Examples 13)
- `node .planning/phases/02-*/evidence/tools/check-baseline.mjs` → **22 passed, 0 failed**
- `docker ps` + port probe 54320–54329 → the `PassiveIncomeInvestingDEMO` conflict
- `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` → `AdminUserAttributes.id?: string`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1131-1233` → the DAL / `cache()` pattern
- `npm view @playwright/test version|dist-tags|engines|repository.url`; `gsd-tools query package-legitimacy check`

### Primary (HIGH confidence — committed Phase 1/2 evidence, read this session)

- `.planning/audit/schema/{migration-list.prod.txt, migration-list.local.txt, migration-list.staging.txt, drift.md, events-date-columns.md}`
- `.planning/audit/rls/rls-review.md` §§ 0, 5, 6, 7, 8 · `.planning/audit/findings.json` (70 findings)
- `.planning/audit/async/{cron-job.json, extensions.json}` · `.planning/audit/raw/prod/{transport-identity.json, row-counts.json}` · `.planning/audit/raw/vercel/env-names.json`
- `.planning/audit/inventory/classification-rules.md` §§ 2–3 (the 13 personas) · `.planning/audit/REDACTION.md`
- `.planning/phases/02-*/{02-SECURITY.md, 02-REVIEW.md, 02-RESEARCH.md § Pitfall 5}` · `evidence/{STAGE-2-COMPLETION.md, deferred-items.md, supabase-js-decision.md, tools/check-baseline.mjs}`

### Secondary (MEDIUM confidence — official documentation, fetched this session)

- `supabase.com/docs/guides/getting-started/mcp.md` — the `read_only` / `project_ref` / `features` parameters
- `supabase.com/docs/guides/deployment/database-migrations.md` — `db pull`, `migration repair --status`
- `supabase.com/docs/guides/database/postgres/row-level-security.md` — impersonation, the three-way denial table, the `lives_ok` prohibition
- `supabase.com/docs/guides/database/{testing,extensions/pgtap}.md` · `supabase.com/docs/guides/local-development/{overview,seeding-your-database,testing/pgtap-extended}.md`
- `playwright.dev/docs/{auth,test-webserver,ci-intro}` · `github.com/supabase/setup-cli`
- `.agents/skills/supabase/SKILL.md` and `.agents/skills/supabase-postgres-best-practices/references/{schema-foreign-key-indexes,security-rls-performance}.md`

### Tertiary (LOW confidence — none load-bearing)

- None. Every recommendation in this document is grounded in an executed command, a committed artifact, or an official documentation page. The ten inferences that are not are enumerated in § Assumptions Log.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack | **HIGH** | One package. Version, downloads, repo and `engines` all verified against the registry; the requirement names it. |
| Migration reconciliation strategy | **MEDIUM-HIGH** | The CLI surface is verified from `--help`; the drift is verified from committed captures; the audit's own § 8 recommends this exact approach. A1 (the `db pull` baseline mechanic) is the one unverified step and has a documented fallback. |
| Seam kit architecture | **HIGH** | Next's own docs prescribe the DAL shape; the ESLint boundary was executed in four configurations; the 23-callsite ratchet is measured, not estimated. |
| Type generation and cast retirement | **HIGH** | The nine-error cost was measured, not estimated. The `--local`-not-`--linked` gate follows from the audit's own finding about what regeneration would hide. |
| Playwright harness | **MEDIUM-HIGH** | The config and setup-project pattern are from Playwright's own docs. A4/A7 (cookie injection) are the load-bearing assumptions and both are resolved by an assertion inside the setup step plus the `/admin-login` cross-check. |
| Deterministic seed | **HIGH** | `AdminUserAttributes.id` verified in this tree's own types — the one fact that removes the `auth`-schema risk entirely. |
| Auth callback characterization | **HIGH** | Four probes written and executed green against unmodified source; the module-load `ADMIN_EMAILS` trap found by running it, not by reading it. |
| Pitfalls | **HIGH** | Nine of eleven were reproduced or measured in this session. Pitfall 1 was observed live (`docker ps`); Pitfall 4 produced a false result before it was caught. |
| Environment | **HIGH** | Every row probed on this machine today. |

**Research date:** 2026-09-15
**Valid until:** 2026-10-15 for the architecture and the audit-derived facts; **2026-09-29** for the Supabase CLI surface (2.115.0 installed, 2.117.0 already published — the CLI moves weekly) and the `@playwright/test` version pin.
