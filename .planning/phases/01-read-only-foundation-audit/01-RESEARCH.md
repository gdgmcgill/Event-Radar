# Phase 1: Read-Only Foundation Audit - Research

**Researched:** 2026-09-14
**Domain:** Read-only evidence-gathering audit of a Next.js 16 App Router + Supabase + Vercel monolith — schema drift, RLS, authorization, CDN cache exposure, dependency reachability, dead code, threat modeling
**Confidence:** HIGH (all tool invocations, counts, and CLI flags were executed against this repo and this machine on 2026-09-14; the two remote-access procedures are CITED from vendor docs and marked)

## Summary

This phase is not a build; it is an **evidence-production pipeline**. Every one of the 21 AUDIT requirements resolves to "run a specific read command, capture its raw output as a committed artifact, then classify." The planning risk is therefore not technical difficulty — it is (a) artifacts that are prose instead of machine-readable, which silently degrades three later deliverables (CERT-06, CERT-09, CERT-11); (b) commands that mutate the working tree and break the phase's own exit criterion; and (c) **secrets leaking into committed artifacts**, because `commit_docs: true` means everything written under `.planning/audit/` gets committed, and the raw evidence for AUDIT-01/05/08 naturally contains session cookies, connection strings, and schema-level grants.

The read-only invariant is achievable and was verified empirically today. `npm audit`, `npm ls`, `npm outdated`, `npx knip`, `npx dependency-cruiser`, and a **full `npm run build`** all completed with `git status --porcelain` byte-identical before and after. `.next/`, `next-env.d.ts`, `*.tsbuildinfo`, and `supabase/.temp/` are all gitignored, and `tsconfig.json` is already in its Next-normalized form so the build does not rewrite it. The one real hazard is npm's lockfile-metadata repair, which only fires when `node_modules` has drifted from the lockfile — so the guard is a per-command lockfile hash check, not avoidance of npm.

Three counts in the upstream documents are stale and must be corrected before planning, because they become validation thresholds: there are **94** `route.ts` files (not 92), **44** migrations (not 45), and the `internal/` and `backend/` directories **no longer exist** (`backend/` was deleted in commit `5e7bf27`; `internal/` is gitignored and absent) — which closes one of SUMMARY.md's "Open Questions the Audit Must Answer" before the phase even starts.

**Primary recommendation:** Structure the phase as **Wave 0 (guard + validator) → Wave 1 (three parallel pure-static-analysis plans, no credentials) → Wave 2 (two parallel credentialed plans: remote-database and production-HTTP) → Wave 3 (synthesis: threat models, `FOUNDATION_AUDIT.md`, severity SLA)**. Make `endpoints.json` and `pages.json` the canonical machine-readable artifacts with a committed JSON Schema and a zero-dependency validator under `.planning/audit/tools/`, and gate every wave on that validator plus a baseline-diffed read-only guard.

---

## Phase Constraints (binding — from ROADMAP.md + orchestrator brief)

No `CONTEXT.md` exists for this phase (`.planning/phases/01-read-only-foundation-audit/` is empty). These constraints come from ROADMAP.md Phase 1 success criteria, PROJECT.md Constraints, and the orchestrator's phase brief, and are binding on the planner exactly as locked decisions would be.

### Locked

- **Strictly read-only.** Artifacts are written only to `.planning/audit/` and `.planning/phases/01-read-only-foundation-audit/`. No change to `src/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `next.config.js`, `.github/`, or any database. `git diff` for the phase touches nothing outside `.planning/`.
- **Forbidden commands:** `npm install` / `npm uninstall` / `npm ci` / `npm audit fix` (any form) in the repo, `supabase db push`, `supabase db reset` against a linked project, `supabase migration repair`, `supabase gen types > src/...`, `npx knip --fix`, `supabase db diff -f <name>` (the `-f` flag *writes a migration file*).
- **Fixing anything is out of scope** — including one-line fixes to the two fail-open endpoints and the `getSession()` call. File the finding; the fix is a Stage 3 slice.
- **Never modify `.env.local` or `.env`.** Env var *names* may be inventoried; values are never printed, echoed, or written to an artifact.
- **Severity model:** four-level (Critical/High/Medium/Low) with a written exposure rationale. **No CVSS vectors** on application-logic findings.
- **Finding IDs are `F-nnn`, stable, never renumbered.**
- **Test runner decision is already resolved: keep Jest.** AUDIT-13 records it with the 14-`jest.*`-vs-0-`vi.*` evidence; it is not re-litigated.

### Claude's Discretion

- Artifact directory layout under `.planning/audit/` and file naming.
- CSV-vs-JSON choice per artifact (AUDIT-03/04 say "CSV or JSON").
- How the inventory skeleton is generated (grep vs AST vs TypeScript compiler API).
- Wave/plan decomposition and parallelization.
- Which read-only SQL transport is used (Management API vs out-of-repo `pg` client vs `psql`).

### Deferred / Out of Scope (do not research, do not do)

- Commercial SAST/DAST sweep. Line-by-line manual read of all 43 pages. Auditing archived v1/v2 planning docs. Benchmarking or perf-tuning. Assigning CVSS vectors. Any fix, however small.

---

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md` that the plan must honor:

| Directive | Source | Effect on this phase |
|---|---|---|
| Three distinct Supabase client factories; using the wrong one is "a common mistake" | CLAUDE.md § Architecture | The endpoint inventory MUST record *which* factory each handler uses — this is the primary AUDIT-07 signal |
| `createServiceClient()` bypasses RLS, "admin/cron routes only" | CLAUDE.md § Three Supabase Clients | Every deviation from that stated rule is a finding |
| Protected routes listed as 6: `/my-events`, `/create-event`, `/notifications`, `/profile`, `/my-clubs`, `/invites` | CLAUDE.md § Auth Flow | **STALE — `src/middleware.ts` actually lists 8** (adds `/settings`, `/friends`). This documentation drift is itself an AUDIT-04/AUDIT-15 finding. Use the source, not CLAUDE.md. |
| `@/` maps to `src/` | CLAUDE.md § Key Patterns | knip/dependency-cruiser configs must resolve the alias via `tsconfig.json` paths |
| Use the `EventTag` enum, not raw strings; `EVENT_CATEGORIES` theming in `lib/constants.ts` | CLAUDE.md § Key Patterns | Context for the tag-mapping finding; not audited directly in Phase 1 |
| Never modify `.env.local` | CLAUDE.md § Important Notes | Reinforces the locked constraint above |
| `.claude/CLAUDE.md` § Technology Stack lists **Vitest** as a framework and `swagger-ui-react ^5.30.2` | .claude/CLAUDE.md (GSD-generated from stale codebase/STACK.md) | **STALE on both counts** — Vitest is not installed; `package.json` pins `swagger-ui-react ^5.17.10`. Record as a stale-docs finding; do not edit the file during this phase. |

---

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| AUDIT-01 | Live schema snapshots (prod, staging, local) committed under `.planning/audit/` | `supabase db dump` flags verified against installed CLI 2.115.0 (§ Code Examples 1). **Blocked on:** project refs + DB passwords + Docker daemon. |
| AUDIT-02 | Three-way drift table (prod vs migrations vs types.ts) via `db diff` + `migration list` | `supabase db diff` verified to build a shadow DB from `supabase/migrations` and compare to a live DB (§ Code Examples 1). **`-f` must never be passed.** |
| AUDIT-03 | Machine-readable inventory of every API route handler | Generator prototyped today; emits **94** rows with 22 derived signal columns (§ Code Examples 3). Canonical schema in § Architecture Patterns. |
| AUDIT-04 | Page inventory cross-checked against middleware protected list | Generator prototyped today; emits **43** rows (§ Code Examples 4). Must also inventory the 16 App-Router special files — **layout guards are a second auth ring the middleware list misses**. |
| AUDIT-05 | RLS review from live `pg_policies` | Read-only SQL transport determined (§ Code Examples 2); query set in § Code Examples 5. |
| AUDIT-06 | RLS coverage heatmap (table × command × role) | Derived from AUDIT-05 output by a pivot script; 32 distinct tables referenced by handlers gives the expected row order of magnitude. |
| AUDIT-07 | `createServiceClient()` callsite register with per-callsite justification | Verified counts today: 22 `route.ts` + 1 `page.tsx` (`src/app/users/[id]/page.tsx`) + `src/lib/audit.ts` + the factory itself = **25 files**. Register schema in § Architecture Patterns. |
| AUDIT-08 | Cache/personalization exposure matrix + empirical two-session production curl | Full procedure in § Code Examples 6, grounded in Vercel CDN docs (`x-vercel-cache` value table, `x-vercel-cache-reason` **not** curl-visible). **Blocked on:** production hostname + two real session cookies. |
| AUDIT-09 | Every `getSession()` call classified gating vs non-gating | Verified today: exactly **1** callsite, `src/app/api/health/route.ts:160`. The March "getSession for auth checks" concern is largely already fixed — record the *negative* finding with evidence. |
| AUDIT-10 | Env-var-conditional (fail-open) authorization checks | Verified today: `src/app/api/admin/calculate-popularity/route.ts` **GET and POST both** use `if (expectedKey && ...)` — fail-open on a service-role client. `/api/cron/send-reminders` compares to `` `Bearer ${undefined}` `` when `CRON_SECRET` is unset (guessable-open); `/api/cron/send-feedback-requests` fails closed with 500. |
| AUDIT-11 | Cron + webhook inventory | `vercel.json` verified to have **no `crons` key**; 2 `/api/cron/*` handlers exist; pg_cron schedule exists only as a commented line in `20260313000002_recommendation_engine.sql`; edge function `supabase/functions/events-webhook/` reads `WEBHOOK_SECRET`. |
| AUDIT-12 | Dependency report with reachability judgment | `npm audit`/`ls`/`outdated` verified lockfile-safe today. **knip answers the Swagger/Redoc question: `swagger-ui-react` is an UNUSED dependency; `redoc` IS reachable** via `/docs` → `RedocUI.tsx` → `redoc`. |
| AUDIT-13 | Test/build/lint/type-check baseline as captured output | `npx jest --listTests` verified 21 files today; `npm run build` verified exit 0 today. Runner decision pre-resolved. |
| AUDIT-14 | Error handling / observability quantification | Verified today: **162** `console.*` calls across **60** files; **5** `catch (error: any)`; **22 of 94** route files have no `try {`. |
| AUDIT-15 | Dead-code report via knip | knip 6.35.1 executed today via `npx` with an ad-hoc config — results in § Code Examples 7. **`API_ENDPOINTS` in `src/lib/constants.ts` is confirmed an unused export.** `internal/`/`backend/` disposition is already resolved: both are gone. |
| AUDIT-16 | Client-bundle secret sweep | `next build` verified read-only-safe and `.next/` verified gitignored today. Procedure + the "build must carry the real env or the grep proves nothing" caveat in § Code Examples 8. |
| AUDIT-17 | Three one-page threat models | Format + STRIDE mapping in § Security Domain. |
| AUDIT-18 | Storage bucket policy review (`avatars`, `banners`) | `supabase/config.toml` `[storage.buckets.*]` is entirely commented out; migrations only reference an `event-images` bucket — so `avatars`/`banners` exist in production but in no migration. Query set in § Code Examples 5. |
| AUDIT-19 | Authoritative `events` date columns from `information_schema.columns` | Verified today: `event_date`/`event_time` appear **nowhere** in `types.ts` or `supabase/migrations/` — only in 3 stale Jest fixtures and a comment in `tagMapping.ts` reading "no more event_date/event_time split". Production must still be queried; the concern may be already-resolved-in-code but not-yet-dropped-in-DB. |
| AUDIT-20 | `FOUNDATION_AUDIT.md` finding register | Finding Record Anatomy transcribed in § Architecture Patterns, plus a machine-readable `findings.json` mirror that CERT-11 consumes. |
| AUDIT-21 | Severity SLA policy | Template in § Architecture Patterns. |

---

## Architectural Responsibility Map

This phase produces artifacts, so "tier" means *where the evidence comes from* — which determines credentials, parallelizability, and failure modes.

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Endpoint / page / special-file inventory (AUDIT-03, 04) | Local filesystem (static analysis) | Build output (`next build` route table) | Filenames give the surface; the build table gives the *reachable* surface, including `/robots.txt`, `/sitemap.xml`, `/_not-found` that a `find` misses |
| Service-role register, `getSession`, fail-open (AUDIT-07, 09, 10) | Local filesystem (static analysis) | — | Pure grep + human judgment; no credentials |
| Dependency + dead code (AUDIT-12, 15) | Local `node_modules` + npm registry | Network | `npm audit`/`outdated` need registry; knip needs only the tree |
| Baseline commands (AUDIT-13) | Local toolchain | — | Must run on the *current* machine and record versions alongside output |
| Client-bundle sweep (AUDIT-16) | Local build output (`.next/static`) | Real env file | Requires the build to carry real secrets, or a null result is unfalsifiable |
| Schema, drift, RLS, storage, pg_cron, date columns (AUDIT-01, 02, 05, 06, 11-partial, 18, 19) | **Remote Postgres (prod + staging)** | Local Postgres via Docker | Cannot be answered from the repo — the repo is the artifact under suspicion |
| Cache exposure proof (AUDIT-08) | **Production HTTP edge (Vercel CDN)** | Endpoint inventory (for the route list) | Only the production CDN can produce `x-vercel-cache: HIT`; local and preview deployments have different cache pools |
| Threat models, finding register, SLA (AUDIT-17, 20, 21) | Synthesis (consumes every tier) | — | Cannot start until its inputs exist; must be the last wave |

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Supabase CLI | **2.115.0 installed** (`/opt/homebrew/bin/supabase`; 2.117.0 available) [VERIFIED: `supabase --version` 2026-09-14] | `db dump`, `db diff`, `migration list`, `inspect db` | The only tool that can answer "does `supabase/migrations/` match production?" — `db diff` builds a shadow DB from the migrations folder and compares it to a live database |
| Node.js | **24.16.0** [VERIFIED: `node --version`] | Runs the inventory generators and the validator | Satisfies knip's `^20.19.0 \|\| >=22.12.0` and dependency-cruiser's `^22\|\|^24\|\|>=26`; note **CI's Node 20 would fail dependency-cruiser** |
| npm | **11.13.0** [VERIFIED: `npm --version`] | `audit`, `ls`, `outdated` — all verified lockfile-safe today | Already the project's package manager; changing it is explicitly out of scope |
| `git` | — | The read-only guard itself | `git status --porcelain` baseline-diff is the phase's exit criterion |

### Supporting

| Tool | Version | Purpose | Invocation (never added to `package.json`) |
|---|---|---|---|
| `knip` | 6.35.1 [VERIFIED: `npm view knip version`; executed successfully today] | AUDIT-15 unused files/exports/dependencies | `npx --yes knip@6.35.1 -c .planning/audit/quality/knip.config.json --reporter json --no-exit-code --no-progress` |
| `dependency-cruiser` | 18.3.0 [VERIFIED: `npx --yes dependency-cruiser@18.3.0 --version` → `18.3.0`] | AUDIT-12 reachability (`--reaches`), AUDIT-15 orphans, module graph | `npx --yes dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs -T json src` |
| `pg` | 8.23.0 [VERIFIED: installed into an out-of-repo prefix and loaded successfully today] | Read-only SQL for `pg_policies`, `cron.job`, `information_schema`, `storage.*` | `npm install --prefix "$AUDIT_TMP/deps" pg@8` then `NODE_PATH="$AUDIT_TMP/deps/node_modules" node ...` — **`--prefix` outside the repo leaves `package.json`/lockfile untouched (verified)** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| out-of-repo `pg` client | `psql` | **`psql` and `pg_dump` are NOT installed on this machine** [VERIFIED: `which psql` → not found]. Installing `libpq` is a machine-level change, allowed but avoidable. |
| out-of-repo `pg` client | **Supabase Management API** `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `{"query": "...", "read_only": true}` [CITED: supabase.com/docs/reference/api/v1-run-a-query] | **Structurally superior for this phase** — `read_only: true` makes a write *impossible*, which is a machine-enforced version of the phase's core constraint. Needs a `SUPABASE_ACCESS_TOKEN` PAT instead of a DB password, and returns JSON directly. Recommend as primary; keep `pg` as fallback if the token is unavailable. |
| `npx knip@X` | `npm install -D knip` (what STACK.md recommends for Stage 1) | STACK.md's advice **conflicts with this phase's read-only constraint** — installing it mutates `package.json` and the lockfile, and STACK.md itself then says "preserve the current lockfile untouched." `npx` resolves the conflict; verified today that `npx --yes knip@6.35.1` leaves both files byte-identical. |
| grep-based inventory generator | TypeScript compiler API / ts-morph | AST is more precise but adds a dependency and 5-10× the build cost for marginal gain on a per-file *boolean signal* extraction. Grep-derived booleans are inputs to human classification, not the classification itself. |
| `.next/static` grep | `@next/bundle-analyzer` | Bundle analysis answers a size question, not a secret question, and requires a `next.config.js` change. |

**Installation:** None. This phase installs nothing into the repository. The only filesystem writes outside `.planning/` are to gitignored paths (`.next/`, `supabase/.temp/`, `~/.npm/_npx`) and to an out-of-repo scratch directory.

---

## Package Legitimacy Audit

Run 2026-09-14 via `gsd-tools query package-legitimacy check --ecosystem npm knip dependency-cruiser pg`.

| Package | Registry | Latest published | Weekly downloads | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `knip` | npm | 2026-09-09 | 10,663,805 | github.com/webpro-nl/knip | **[SUS]** (`too-new`) | Keep, flagged — see note |
| `dependency-cruiser` | npm | 2026-09-13 | 2,822,805 | github.com/sverweij/dependency-cruiser | **[SUS]** (`too-new`) | Keep, flagged — see note |
| `pg` | npm | 2026-08-08 | 39,325,332 | github.com/brianc/node-postgres | **[OK]** | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `knip`, `dependency-cruiser`.

**Note on the two [SUS] verdicts.** The `too-new` reason refers to the *latest release date*, not to package age — both are long-established projects with 8-figure and 7-figure weekly download counts and real, matching source repositories, and both report `postinstall: null` (no install-time script). Both were additionally **executed successfully in this session** at the pinned versions (`knip@6.35.1 --help` and a full `knip` run; `dependency-cruiser@18.3.0 --version`), with `package.json` and `package-lock.json` verified byte-identical afterward. Mitigating factors specific to this phase: neither is installed into the project, neither enters the lockfile, and both are invoked at an exact pinned version via `npx --yes <pkg>@<exact>`.

**Planner action:** insert one `checkpoint:human-verify` task before the first `npx knip@6.35.1` / `npx dependency-cruiser@18.3.0` invocation, asking the user to confirm the pinned versions. Do **not** insert an install task — there is no install.

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── WAVE 0 (serial, blocking) ────────────────────────┐
                    │  git status --porcelain  ──▶ baseline/git-status.before.txt              │
                    │  shasum package-lock.json ──▶ baseline/lock.sha256                       │
                    │  write .planning/audit/tools/{validate.mjs, readonly-guard.sh}           │
                    │  BLOCKING-INPUTS.md  ◀── user supplies refs / passwords / host / cookies │
                    └──────────────────────────────────┬───────────────────────────────────────┘
                                                       │
        ┌──────────────────────────────────────────────┼──────────────────────────────────────────────┐
        │                                              │                                              │
   ── WAVE 1 (parallel, no credentials) ──────────────────────────────────────────────────────────────
        │                                              │                                              │
  ┌─────▼──────────────┐              ┌────────────────▼──────────┐            ┌────────────────▼───────────┐
  │ 1A  SURFACE        │              │ 1B  TOOLCHAIN             │            │ 1C  CODE-QUALITY           │
  │ find + node gen    │              │ npm audit/ls/outdated     │            │ grep + human read          │
  │ next build (routes)│              │ npx knip / depcruise      │            │                            │
  ├────────────────────┤              │ jest/tsc/lint/build logs  │            ├────────────────────────────┤
  │ endpoints.json 94  │              │ .next/static secret grep  │            │ getsession-register  A-09  │
  │ pages.json     43  │              ├───────────────────────────┤            │ fail-open-register   A-10  │
  │ build-routes.txt   │              │ dependency-report   A-12  │            │ error-observability  A-14  │
  │        A-03 / A-04 │              │ baseline/*          A-13  │            └────────────────────────────┘
  └─────┬──────────────┘              │ dead-code           A-15  │
        │                             │ client-bundle-sweep A-16  │
        │ endpoints.json              └───────────────────────────┘
        │ is the keystone
        ▼
  ┌───────────────────────┐
  │ 1A′ (depends on 1A)   │
  │ service-role register │ A-07
  │ cache-matrix (static) │ A-08a  ── does the body vary by user? what header does the handler emit?
  └───────────┬───────────┘
              │
   ── WAVE 2 (parallel, credentialed) ───────────────────────────────────────────────────────────────
              │
  ┌───────────▼──────────────────────────────┐        ┌──────────────────────────────────────────────┐
  │ 2A  REMOTE DATABASE                      │        │ 2B  PRODUCTION HTTP EDGE                     │
  │ supabase db dump / diff / migration list │        │ curl -sSI  ×  {session A, session B}  × 3    │
  │ read-only SQL (Management API)           │        │ GET only, never a mutating verb              │
  ├──────────────────────────────────────────┤        ├──────────────────────────────────────────────┤
  │ schema/{prod,staging,local}.sql     A-01 │        │ cache/curl/*.headers.txt (REDACTED)          │
  │ schema/drift.{json,md}              A-02 │        │ cache/cache-matrix.csv          A-08b        │
  │ rls/pg_policies.json → rls-review   A-05 │        │  ▲ needs endpoints.json for the route list   │
  │ rls/rls-heatmap.csv                 A-06 │        └──────────────────────────────────────────────┘
  │ async/cron-job.json                 A-11 │
  │ storage/{buckets,policies}.json     A-18 │
  │ schema/events-date-columns.md       A-19 │
  └───────────┬──────────────────────────────┘
              │
   ── WAVE 3 (synthesis, serial) ─────────────────────────────────────────────────────────────────────
              ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
  │ ALL artifacts ──▶ threat-model-{anonymous,tenant,escalation}.md            A-17                │
  │              ──▶ findings.json  +  FOUNDATION_AUDIT.md   (F-nnn register)  A-20                │
  │              ──▶ SEVERITY_SLA.md                                          A-21                │
  │              ──▶ .planning/audit/README.md  (artifact ▸ requirement ▸ regenerating command)    │
  └───────────────────────────────────────────────────────────────────────────────────────────────┘
              │
              ▼   readonly-guard.sh  (git status diff vs baseline, lockfile hash)  ─── PHASE GATE
```

### Recommended Artifact Structure

```
.planning/audit/
├── README.md                        # index: artifact ▸ requirement ▸ command that regenerates it
├── FOUNDATION_AUDIT.md              # AUDIT-20 — human-readable finding register
├── findings.json                    # AUDIT-20 — machine mirror; CERT-11 iterates this
├── findings.schema.json
├── SEVERITY_SLA.md                  # AUDIT-21
├── BLOCKING-INPUTS.md               # what the user must supply, and which artifact is blocked
├── REDACTION.md                     # what was scrubbed from each artifact and why
├── baseline/                        # AUDIT-13
│   ├── git-status.before.txt        #   read-only guard baseline (NOT empty — see pitfall 2)
│   ├── lock.sha256
│   ├── versions.txt                 #   node, npm, supabase, next resolved, os
│   ├── jest.txt  tsc.txt  lint.txt  build.txt
│   └── test-runner-decision.md      #   14 jest.* / 0 vi.* evidence
├── inventory/                       # AUDIT-03, AUDIT-04
│   ├── endpoints.json               #   94 rows — CANONICAL, CERT-06 data source
│   ├── endpoints.schema.json
│   ├── endpoints.csv                #   derived view for human review only
│   ├── pages.json                   #   43 rows
│   ├── pages.schema.json
│   ├── special-files.json           #   16 layout/loading/error/robots/sitemap entries
│   └── build-routes.txt             #   139-row `next build` route table (○ static / ƒ dynamic)
├── schema/                          # AUDIT-01, 02, 19
│   ├── prod.schema.sql  staging.schema.sql  local.schema.sql
│   ├── migration-list.{prod,staging,local}.txt
│   ├── db-diff.{prod,staging}.sql
│   ├── information-schema-columns.json
│   ├── drift.json  drift.md
│   └── events-date-columns.md
├── rls/                             # AUDIT-05, 06
│   ├── pg_policies.json  rls-enabled.json  policy-column-indexes.json
│   ├── rls-review.md
│   └── rls-heatmap.csv
├── authz/                           # AUDIT-07, 09, 10
│   ├── service-role-register.json + .md
│   ├── getsession-register.md
│   └── fail-open-register.md
├── cache/                           # AUDIT-08
│   ├── cache-matrix.csv  cache-matrix.json
│   ├── curl/<slug>.<session>.<n>.headers.txt      # REDACTED raw evidence
│   └── curl-summary.json
├── async/                           # AUDIT-11
│   ├── cron-job.json  cron-webhook-inventory.md
├── storage/                         # AUDIT-18
│   ├── buckets.json  storage-policies.json  storage-review.md
├── quality/                         # AUDIT-12, 14, 15
│   ├── npm-audit.{prod,all}.json  npm-outdated.json  npm-ls-prod.json
│   ├── dependency-report.md
│   ├── knip.config.json  knip.out.json  depcruise.config.cjs  depcruise.out.json
│   ├── dead-code.md
│   └── error-observability.md
├── security/                        # AUDIT-16, 17
│   ├── client-bundle-sweep.md
│   └── threat-model-{anonymous,tenant,escalation}.md
└── tools/                           # generators + validator — NOT in scripts/ or src/
    ├── gen-endpoint-inventory.mjs
    ├── gen-page-inventory.mjs
    ├── sql-readonly.mjs
    ├── pivot-rls-heatmap.mjs
    ├── validate.mjs                 # zero-dependency artifact + schema validator
    └── readonly-guard.sh
```

> **Why generators live in `.planning/audit/tools/` and not `scripts/`:** `scripts/` is repository source. Writing there violates the phase's exit criterion. This also makes the artifacts reproducible by later phases without touching the app.

### Pattern 1: `endpoints.json` is the keystone — design it for CERT-06, not for reading

FEATURES.md calls the endpoint inventory "the program's keystone," consumed by the cache matrix, the service-role register, the Stage 3 slice plan, **and both Stage 4 coverage gates**. CERT-06 requires "a generated persona × endpoint authorization matrix test, data-driven from the AUDIT-03 inventory, [that] fails on any unclassified endpoint." That last clause is a hard schema requirement: every row needs an explicit per-persona expectation, and "unknown" must be a representable value that fails the gate.

**Canonical row shape** (one object per `route.ts` file; 94 objects):

```jsonc
{
  // ── identity (machine-generated) ──
  "id": "api.recommendations",                 // stable slug, derived from route path
  "file": "src/app/api/recommendations/route.ts",
  "route": "/api/recommendations",
  "methods": ["GET"],
  "dynamic_segments": [],

  // ── machine-generated signals (grep-derived booleans; inputs to classification) ──
  "signals": {
    "uses_cookie_client": true,                // imports @/lib/supabase/server
    "uses_service_client": false,              // imports createServiceClient
    "calls_verify_admin": false,
    "calls_get_user": true,
    "calls_get_session": false,
    "calls_check_ban": false,
    "inline_role_check": false,                // roles.includes(
    "references_club_members": false,
    "parses_body": false,
    "has_zod": false,
    "sets_cache_control": false,
    "cache_control_values": [],
    "env_vars_referenced": [],
    "has_try_catch": true,
    "catch_any_count": 0,
    "console_count": 3,
    "as_any_count": 1,
    "tables_referenced": ["user_scores", "events"],
    "loc": 212
  },

  // ── human classification (AUDIT-03's required columns) ──
  "auth_requirement": "authenticated",         // anonymous | authenticated | admin | machine | unknown
  "role_required": null,                       // null | "admin" | "club_owner" | "club_member" | ...
  "rls_reliance": "primary",                   // primary | partial | none | bypassed
  "service_role_justified": null,              // null | true | false  (AUDIT-07 cross-link)
  "personalized": true,                        // does the response body vary by user?
  "cache_policy_today": "vercel.json s-maxage=60, stale-while-revalidate=300",
  "cache_policy_target": "personalized",       // maps to ARCHITECTURE.md Pattern 4 policy set
  "input_validation": "none",                  // none | manual | zod
  "test_present": false,
  "dead_or_duplicate": false,

  // ── CERT-06 contract: 13 personas from CERT-05, explicit expected status ──
  "expected_status": {
    "anonymous": 401, "onboarded_student": 200, "mid_onboarding_student": 200,
    "club_member": 200, "club_owner": 200, "multi_club_organizer": 200,
    "cross_club_attacker": 200, "admin": 200, "banned_permanent": 403,
    "suspended_active": 403, "suspension_expired": 200,
    "non_mcgill_signin": "n/a", "machine_no_credential": 401
  },

  // ── traceability ──
  "findings": ["F-014"]                        // F-nnn ids raised against this endpoint
}
```

**Rules the planner must encode:**
- `auth_requirement`, `rls_reliance`, `cache_policy_target`, and every `expected_status` value default to the literal string `"unknown"`, and the validator fails while any `"unknown"` remains. A missing key is a schema error, not an implicit unknown.
- `signals.*` is regenerable at any time; the human fields are never overwritten by the generator. **The generator must merge into the existing file by `id`, not replace it** — otherwise a re-run silently discards a day of classification.
- `endpoints.csv` is a derived view generated *from* the JSON for human review; never hand-edited.

### Pattern 2: Pages have two auth rings, and the middleware list only shows one

Verified today: `src/app/admin/layout.tsx` and `src/app/moderation/layout.tsx` each perform a **server-side guard** — `auth.getUser()`, then `roles.includes("admin")`, then `redirect()`. Meanwhile `src/middleware.ts` `PROTECTED_ROUTES` contains 8 entries and **none of them is `/admin` or `/moderation`**. A page inventory that only cross-checks against the middleware list would report 12 moderation pages + 2 admin pages as unguarded, which is wrong.

`pages.json` therefore needs both columns, plus the inherited-guard chain:

| Field | Value |
|---|---|
| `middleware_protected` | boolean — computed from the 8-entry `PROTECTED_ROUTES` array |
| `layout_guard` | `null` or the path of the nearest ancestor `layout.tsx` that calls `getUser()` + a role check |
| `page_guard` | `null` or `"getUser"` / `"useAuthStore"` / `"inline_role_check"` |
| `effective_protection` | human verdict: `public` / `auth` / `admin` / `club_role` / `unprotected_but_should_be` |
| `render_mode` | `static` (○) or `dynamic` (ƒ) — **read from `build-routes.txt`, not inferred** |
| `dead_or_duplicate` | from the knip unused-files list |

Cross-check invariant to assert: **every route in `build-routes.txt` appears in `endpoints.json` ∪ `pages.json` ∪ `special-files.json`.** Today's build table has 139 rows; `find` gives 94 + 43 = 137, plus `/robots.txt`, `/sitemap.xml`, `/_not-found`. A route present in the build table but absent from the inventories means the inventory generator has a hole.

### Pattern 3: The finding record (AUDIT-20) — two representations, one source

`FOUNDATION_AUDIT.md` is the human artifact; `findings.json` is what CERT-11 ("every Critical and High is closed by its own validation criterion passing, or carries a dated risk acceptance") iterates. Generate the Markdown *from* the JSON so they cannot drift.

```jsonc
{
  "id": "F-017",                               // stable; NEVER renumbered, even if withdrawn
  "title": "GET /api/admin/calculate-popularity accepts any request when ADMIN_API_KEY is unset",
  "severity": "Critical",
  "severity_rationale": "Anonymous-reachable; executes on a service-role client that bypasses RLS; no compensating control. Exposure-adjusted, not CVSS.",
  "category": "authz",                         // schema-drift|authn|authz|cache-exposure|injection|validation|performance|observability|dead-code|dependency|config
  "affected_paths": [
    { "path": "src/app/api/admin/calculate-popularity/route.ts", "lines": "168-175" },
    { "path": "src/app/api/admin/calculate-popularity/route.ts", "lines": "58-65" }
  ],
  "evidence": "quality/fail-open-register.md#f-017",   // path into .planning/audit/ — NEVER inline a secret
  "reproduction": [
    "Ensure ADMIN_API_KEY is unset in the target environment",
    "curl -sS -o /dev/null -w '%{http_code}' https://<host>/api/admin/calculate-popularity",
    "Observe 200 rather than 401"
  ],
  "recommended_fix": "Invert to fail-closed: return 401 when ADMIN_API_KEY is absent; route through verifyAdmin() + src/server/db/elevated/ per REFAC-13.",
  "validation_criterion": "Integration test: with ADMIN_API_KEY unset, GET and POST both return 401. CERT-06 matrix row api.admin.calculate-popularity expects 401 for machine_no_credential.",
  "status": "Open",                            // Open | Fixed | Risk-accepted
  "risk_acceptance": null,                     // { owner, date, expiry, rationale } when status is Risk-accepted
  "closes_in_phase": null,                     // filled by the planner of the fixing phase
  "related": ["F-018"]
}
```

**Validator rules (enforced in Wave 3):** ids unique and matching `^F-\d{3}$`; no gaps introduced by deletion; every finding has non-empty `evidence`, `reproduction`, `recommended_fix`, `validation_criterion`; every `Critical`/`High` has at least one `affected_paths` entry **with line numbers**; `evidence` is a path that exists.

### Pattern 4: Severity SLA (AUDIT-21) — make the Stage 4 gate mechanical

```markdown
| Severity | Definition (exposure-adjusted) | Must be fixed by | Enforcement |
|---|---|---|---|
| Critical | Anonymous-reachable OR crosses tenants OR exposes credentials, with no compensating control | First Stage 3 slice that owns the affected layer; no Critical may remain Open when Phase 5 starts | CERT-11; blocks the Stage 4 gate |
| High | Requires authentication but crosses a trust boundary, OR fail-open on an admin/machine path, OR a reachable High CVE in a production dependency | Before Phase 7 (Stage 4) begins | CERT-11; a dated, owner-signed risk acceptance with a reachability argument is the only alternative |
| Medium | Correctness/consistency defect with a compensating control, or a latent hazard that becomes High after a plausible future change | Within Stage 3, in the slice that touches the file | Tracked in findings.json; not a gate |
| Low | Hygiene, dead code, stale docs, dev-only dependency advisories | Opportunistically; no deadline | Tracked, never blocking |

**Exception register:** a finding may move to `Risk-accepted` only with `{owner, date, expiry <= 90 days, rationale}`. An expired acceptance reverts to Open automatically (asserted by validate.mjs).
```

### Anti-Patterns to Avoid

- **Prose-only inventories.** A Markdown table of 94 endpoints cannot be consumed by CERT-06. Markdown is a *derived view*; JSON is the artifact.
- **Regenerating the inventory over hand classification.** Merge by `id`; never overwrite human fields.
- **Writing configs to the repo root.** `knip.json` / `.dependency-cruiser.cjs` at the root are repo changes. Use `-c .planning/audit/quality/...`.
- **Asserting `git status --porcelain` is empty.** There is a pre-existing untracked file (`docs/product-master-plan.md`). Diff against a captured baseline instead.
- **Inlining evidence that contains a cookie, token, connection string, or env value.** Evidence goes into `.planning/audit/` *redacted*, and findings reference it by path.
- **Treating a curl `MISS` as proof of safety without a positive control.** If no route in the run ever returns `HIT`, the harness proves nothing about caching.

---

## Runtime State Inventory

This is not a rename phase, but it *is* a phase whose entire subject is runtime state the repository does not contain. The five categories reframed as "what evidence exists only outside git":

| Category | Items found (verified 2026-09-14) | Action required |
|---|---|---|
| **Stored data / live schema** | Production and staging Postgres schemas exist in no artifact. `supabase/config.toml` declares `[storage.buckets.*]` **entirely commented out**, and migrations reference only an `event-images` bucket — so `avatars` and `banners` (AUDIT-18's subjects) exist in production and in **no migration**. `pg_cron`'s `compute_user_scores` schedule exists only as a commented SQL line in `20260313000002_recommendation_engine.sql`. | Read-only capture: `db dump` (AUDIT-01), `db diff` (AUDIT-02), SQL against `storage.buckets`/`storage.objects` policies (AUDIT-18), `cron.job` (AUDIT-11). **No writes.** |
| **Live service config** | Vercel project settings (env vars, Node version, cron jobs) live in the Vercel dashboard, not git. `vercel.json` has **no `crons` key** — so whether `/api/cron/send-reminders` and `/api/cron/send-feedback-requests` fire at all is unanswerable from the repo. Supabase Auth provider config, auth hooks, and any dashboard-edited RLS policy are likewise invisible. | AUDIT-11 must be answered from the Vercel dashboard / `vercel` CLI and the Supabase dashboard, and the answer recorded as an artifact. If neither schedules them, that is a **finding** (email reminders are a Validated requirement). |
| **OS-registered state** | None. No launchd/systemd/Task Scheduler registration for this project. Verified: no `crontab` dependency, no pm2. | None — state explicitly in the artifact. |
| **Secrets / env vars** | Repo-referenced names only (values never read): `NEXT_PUBLIC_SUPABASE_URL` (14), `SUPABASE_SERVICE_ROLE_KEY` (7), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (6), `CRON_SECRET` (3), `ADMIN_API_KEY` (2), `ADMIN_EMAILS` (1). Edge function (Deno): `SUPABASE_URL`, `SUPABASE_SERVICE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`. **`.env.local` does not exist on this machine; a 182-byte `.env` does** (gitignored) — CLAUDE.md's `.env.local` reference is stale. CI injects only the two `NEXT_PUBLIC_*` vars, as placeholders. | Inventory names only. AUDIT-16 needs the build to carry real values or its null result is meaningless (§ Code Examples 8). |
| **Build artifacts** | `.next/` (gitignored, rebuilt today, 4.4 MB `.next/static`, 69 JS chunks), `next-env.d.ts` (gitignored), `tsconfig.tsbuildinfo` (gitignored), `test-results/.last-run.json` (tracked, stale Playwright marker from a run that no longer exists — a dead-artifact finding), `supabase/.temp/cli-latest` (gitignored). | `next build` verified to leave `git status` unchanged. `test-results/` is a stale-artifact finding for AUDIT-15. |

**Canonical question for this phase:** *After every file in the repo has been read, what is still only knowable by asking production?* Answer: the schema, the policies, the cron schedule, the storage buckets, the cache behavior, and whether the two cron handlers are ever invoked. Those six are the credentialed waves.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| "Which packages are unused / which files are orphaned?" | A custom import-graph walker | `npx knip@6.35.1` | Handles `tsconfig` path aliases, dynamic imports, Next.js conventions, and re-exports. A hand-rolled walker reports false orphans on every `page.tsx` (no file imports them). |
| "Is `swagger-ui-react` reachable from a production route?" | Reading imports by hand | `npx dependency-cruiser -R 'swagger-ui-react'` / knip's `dependencies` bucket | Transitive reachability through a `'use client'` boundary is exactly where hand-tracing fails. knip already answered it today. |
| "Does the migrations folder match production?" | Diffing `.sql` files against a dump by eye | `supabase db diff --linked` | It builds a real shadow Postgres from `supabase/migrations/` and runs `migra`. 44 files across 3 naming schemes with 2 `remote_schema` re-baselines cannot be diffed textually. |
| "Which migrations are applied where?" | Parsing filenames | `supabase migration list --linked` | Reads `supabase_migrations.schema_migrations` and buckets local-only / remote-only / both. |
| Running read-only SQL against production | Writing a psql wrapper, or a service-role Supabase client + hand-written guards | Management API `POST /v1/projects/{ref}/database/query` with `"read_only": true` | The API *enforces* read-only server-side. A service-role client enforces nothing — it is precisely the RLS-bypassing credential this phase is auditing. |
| "Is this response served from a shared cache?" | Reasoning from `Cache-Control` in devtools | Two-session `curl -sSI` reading `x-vercel-cache` + `age` | Vercel strips `s-maxage`/`stale-while-revalidate` from the browser-facing response when no `CDN-Cache-Control` is set, so devtools shows nothing alarming. Only `x-vercel-cache` and `age` are evidence. |
| "Which routes are static vs dynamic?" | Grepping for `export const dynamic` | The `next build` route table (○ / ƒ) | The build resolves the actual rendering mode after all Next.js heuristics. |
| Enforcing the read-only invariant | Discipline and code review | A scripted `git status --porcelain` baseline-diff + lockfile hash, run after **every** task | PITFALLS.md #13 names "the read-only audit starts fixing things" as a top pitfall precisely because discipline does not scale past hour three. |

**Key insight:** in an audit, the tool is not a convenience — it *is* the evidence. A hand-rolled equivalent produces a number nobody can reproduce, and an audit finding that cannot be reproduced gets contested and deprioritized (FEATURES.md, Finding Record Anatomy).

---

## Common Pitfalls

### Pitfall 1: npm quietly repairs lockfile metadata and breaks the phase's exit criterion

**What goes wrong:** An earlier session observed `npm ls`/`npm audit` rewriting 26 `"dev": true` flags in `package-lock.json`. That is a working-tree change outside `.planning/`, which fails ROADMAP success criterion 5.

**Why it happens:** npm reifies lockfile metadata when the installed `node_modules` tree disagrees with the lockfile (e.g. after a partial install, a different npm major, or a stale tree). It is a *repair*, not a bug, and it fires on read commands.

**Verified today:** with `node_modules` in sync, `npm audit --omit=dev --json`, `npm audit --json`, `npm outdated --json`, `npm ls --all --json`, and `npm ls vercel --all` **all left `package-lock.json` byte-identical** (SHA-256 compared before/after each). So the hazard is state-dependent, not command-dependent — which means avoidance by flag is not sufficient.

**How to avoid:** belt and braces.
1. Prefer `--package-lock-only` where it exists — **verified available on `npm audit` and `npm ls`; NOT available on `npm outdated`** (`npm outdated --help` lists no such flag).
2. Assert after every npm invocation: `git diff --exit-code --quiet -- package-lock.json package.json || { git checkout -- package-lock.json package.json; echo "LOCKFILE REPAIRED — investigate"; }`.
3. Capture `shasum -a 256 package-lock.json` into `baseline/lock.sha256` in Wave 0 and re-check at every wave boundary.

**Warning signs:** a `dev: true`/`dev: false` churn diff; `npm outdated` taking unusually long (it is resolving, which precedes repair).

### Pitfall 2: The read-only guard trips on a pre-existing untracked file

**What goes wrong:** The obvious guard — "`git status --porcelain` must be empty outside `.planning/`" — **fails on this repo today**, because `docs/product-master-plan.md` is already untracked. A guard that cries wolf on task 1 gets disabled by task 4.

**Verified today:** `git status --porcelain -- . ':(exclude).planning'` returns `?? docs/product-master-plan.md`; the naive emptiness check prints `READ-ONLY VIOLATION` on a clean tree.

**How to avoid:** capture the baseline in Wave 0 and diff against it (§ Code Examples 9). Also note the pathspec `':(exclude).planning'` works with both `git status` and `git diff` — verified.

**Warning signs:** the guard passing when you know you edited something (means the pathspec is wrong), or failing identically at every checkpoint (means it is comparing to the wrong baseline).

### Pitfall 3: The cache test produces `MISS` everywhere and is mistaken for an all-clear

**What goes wrong:** You curl five personalized routes with two sessions, see `x-vercel-cache: MISS` on all ten, and conclude the `s-maxage=60` glob is harmless. But PITFALLS.md #3 establishes the bug is **intermittent by construction** — `@supabase/ssr` middleware emits `Set-Cookie` only on the requests where it actually refreshes the session, and a response carrying `Set-Cookie` is not cacheable [CITED: vercel.com/docs/caching/cdn-cache]. So the *steady-state* request is the cacheable one, and a burst of ten requests inside one 60-second window is exactly the sample most likely to miss it.

**How to avoid:**
- Include a **positive control**: a route you expect to cache (e.g. `/api/events` anonymous, or any `.next/static` asset). If the control never returns `HIT`, the harness is broken and *no* conclusion about personalized routes is licensed. Record the control result in `curl-summary.json` as a first-class field.
- Repeat each (route, session) pair **at least 3 times spaced ~10 s**, inside one 60-second `s-maxage` window, and interleave sessions A,B,A,B — a cross-session `HIT` is the proof, and it can only appear on the second session's request.
- Record `set-cookie` presence per request. A `MISS` accompanied by `set-cookie` is *expected* and is not evidence of safety; a `MISS` with **no** `set-cookie` and a `Cache-Control` still carrying `s-maxage` is a latent hazard that must still be filed.
- Do **not** expect `x-vercel-cache-reason` from curl — it is internal-only and not returned to clients [CITED: Vercel CDN caching reference]. If a reason is needed, pull it with `vercel logs --request-id <id> --json`.

**Warning signs:** zero `HIT`s across the entire run including the control; an `age` header present but `x-vercel-cache: MISS` (inconsistent — re-run).

### Pitfall 4: Committed audit artifacts leak the secrets the audit exists to protect

**What goes wrong:** `commit_docs: true`, and AUDIT-01 explicitly requires the schema snapshots to be **committed artifacts**. The natural raw outputs contain, unredacted: the full request `Cookie:` header and every `set-cookie` response header from the AUDIT-08 curls (these *are* live session tokens); connection strings with the DB password if a `--db-url` is echoed into a log; `auth` schema grants and any function body containing an inline key; and the project refs and hostnames of production and staging. Once committed, they are in git history permanently.

**How to avoid:**
- **Redaction is a task, not a habit.** Every credentialed task ends with a redaction step and appends to `REDACTION.md`.
- Never `set -x` in a script that receives a password. Pass secrets by environment variable only; never as a CLI argument that lands in shell history or a captured log.
- Scope `supabase db dump` with `--schema public,storage,extensions` — **omit `auth`** unless a specific finding requires it, and never run `--role-only` into a committed file (cluster roles may carry credentials).
- For curl evidence, capture **response headers only** (`-sSI`), and post-process to replace any `set-cookie` value with `<REDACTED>` and any `sb-<ref>-auth-token` fragment with `<SESSION-A>` / `<SESSION-B>`.
- Add a scripted secret sweep over `.planning/audit/` itself before the phase's final commit, using the same patterns as AUDIT-16 (§ Code Examples 8) plus the two project refs.

**Warning signs:** any artifact matching `eyJ[A-Za-z0-9_-]{10,}\.` (a JWT), `postgres(ql)?://[^ ]*:[^@]*@`, or `sb_secret_`.

### Pitfall 5: `supabase db diff` and `db dump` silently need Docker, which is not running

**What goes wrong:** `db diff` builds a *shadow* Postgres from `supabase/migrations/` to compare against the live database, and the CLI runs Postgres tooling in containers. **Verified today: the Docker daemon is not reachable** (`docker info` → `dial unix /Users/adyan/.orbstack/run/docker.sock: no such file or directory`), and `supabase status` returns `LegacyStatusDbInspectError` for the same reason. Separately, **`psql` and `pg_dump` are not installed** on this machine.

**How to avoid:** make "OrbStack/Docker Desktop is running" an explicit precondition task in the credentialed wave, verified by `docker info --format '{{.ServerVersion}}'` before any `supabase db *` command. The pure-SQL work (AUDIT-05/06/11/18/19) does **not** need Docker if it goes through the Management API — so sequence the SQL tasks first and the dump/diff tasks behind the Docker check, and let the wave degrade gracefully rather than block entirely.

**Warning signs:** `db diff` hanging on "Creating shadow database"; `supabase status` returning a JSON error object rather than a table.

### Pitfall 6: `-f` on `supabase db diff` writes a migration file

**What goes wrong:** The muscle-memory invocation is `supabase db diff --linked -f drift`. The CLI's own help says: *"in normal mode, `-f` names and saves the complete schema diff as a new migration."* That creates `supabase/migrations/<timestamp>_drift.sql` — a repo change, in the exact directory the phase is auditing, and one that would later be *applied*.

**How to avoid:** the help also says *"Output is printed by default."* Always redirect stdout: `supabase db diff --linked --schema public > .planning/audit/schema/db-diff.prod.sql`. Add `-f` to the plan's forbidden-flags list alongside `--fix` and `push`. Use `-o/--output` only if the flattened explicit-diff form is wanted, and point it inside `.planning/audit/`.

### Pitfall 7: The client-bundle sweep is run against a build with no secrets in the env

**What goes wrong:** CI builds with placeholder env values (`NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"`). If AUDIT-16 greps a build produced without `SUPABASE_SERVICE_ROLE_KEY` in the environment, a clean result proves only that the key was absent — not that it would not be inlined.

**Verified today:** a real `npm run build` produced 0 hits for `sb_secret_`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `ADMIN_EMAILS`, `CRON_SECRET`, and 0 JWT-shaped strings in `.next/static`, while `.next/server` contains 56 files referencing `SUPABASE_SERVICE_ROLE_KEY` **by name** (correct — a non-`NEXT_PUBLIC_` var is a runtime `process.env` read on the server, not an inlined literal).

**How to avoid:** the task must first assert the secret is present in the build environment *without printing it* — `node -e "process.exit(process.env.SUPABASE_SERVICE_ROLE_KEY ? 0 : 1)"` — and record that assertion in the artifact. If the key is absent, the artifact records "INCONCLUSIVE — key not present in build env," not "clean."

### Pitfall 8: Trusting the upstream counts as validation thresholds

**What goes wrong:** REQUIREMENTS.md says 92 handlers; ARCHITECTURE.md says 94; PROJECT.md says 45 migrations; the orchestrator brief says 92 routes and 45 migrations. If the validator asserts 92, it fails on a correct inventory.

**Verified today:** `find src/app -name route.ts | wc -l` → **94**. `find src/app -name page.tsx | wc -l` → **43**. `ls supabase/migrations | wc -l` → **44** (all `.sql`, all tracked).

**How to avoid:** Wave 0 re-derives all three counts and writes them to `baseline/versions.txt`; the validator asserts against *that file*, not against a literal from a planning document. Record the 92-vs-94 and 45-vs-44 discrepancies as Low-severity stale-documentation findings so REQUIREMENTS.md gets corrected.

---

## Code Examples

All commands below were executed or flag-verified on this machine on 2026-09-14 unless annotated otherwise.

### 1. Supabase CLI — AUDIT-01, AUDIT-02 (flags verified against installed 2.115.0)

```bash
# --- preconditions (fail fast) ---
supabase --version                                   # → 2.115.0  [VERIFIED]
docker info --format '{{.ServerVersion}}'            # MUST succeed — not running today  [VERIFIED FAILING]
cat supabase/.temp/project-ref 2>/dev/null || echo "NOT LINKED"   # → NOT LINKED today  [VERIFIED]

# --- link (writes ONLY to supabase/.temp/, which is gitignored — verified) ---
# Requires: PROD_REF supplied by user; password prompted or via SUPABASE_DB_PASSWORD
supabase link --project-ref "$PROD_REF"

# --- AUDIT-01: schema snapshots. NEVER include `auth` unless a finding needs it. ---
supabase db dump --linked --schema public,storage,extensions \
  -f .planning/audit/schema/prod.schema.sql
supabase db dump --project-ref "$STAGING_REF" --schema public,storage,extensions \
  -f .planning/audit/schema/staging.schema.sql
supabase db dump --local  --schema public,storage,extensions \
  -f .planning/audit/schema/local.schema.sql        # needs `supabase start` (Docker)

# --- AUDIT-02: history + shadow-DB diff. `-f` is FORBIDDEN here (it writes a migration). ---
supabase migration list --linked   > .planning/audit/schema/migration-list.prod.txt
supabase migration list --project-ref "$STAGING_REF" > .planning/audit/schema/migration-list.staging.txt
supabase migration list --local    > .planning/audit/schema/migration-list.local.txt

supabase db diff --linked --schema public \
  > .planning/audit/schema/db-diff.prod.sql         # stdout by default — DO NOT pass -f
supabase db diff --project-ref "$STAGING_REF" --schema public \
  > .planning/audit/schema/db-diff.staging.sql

# --- read-only extras (all `supabase inspect db <sub>` subcommands are SELECT-only) ---
supabase inspect db table-stats  --db-url "$PROD_DB_URL" --output json > .planning/audit/schema/table-stats.json
supabase inspect db index-stats  --db-url "$PROD_DB_URL" --output json > .planning/audit/rls/index-stats.json

# --- guard, after EVERY block above ---
git diff --exit-code --quiet -- . ':(exclude).planning' || echo "READ-ONLY VIOLATION"
```

Verified flag surface (from `supabase <cmd> --help`, CLI 2.115.0):
- `db dump`: `--linked`, `--local`, `--db-url`, `--project-ref`, `--password/-p`, `--schema/-s`, `--file/-f`, `--role-only`, `--data-only`, `--dry-run`, `--keep-comments`, `--exclude/-x`
- `db diff`: `--linked`, `--local`, `--db-url`, `--project-ref`, `--schema/-s`, `--from`, `--to`, `--output/-o`, `--file/-f` *(writes a migration — forbidden)*, `--use-migra` (default), `--use-pg-delta`
- `migration list`: `--linked`, `--local`, `--db-url`, `--project-ref`, `--password/-p`
- Global: `--output-format text|json|stream-json`, `--output/-o env|pretty|json|toml|yaml|table|csv`, `--yes`, `--debug`, `--workdir`

### 2. Read-only SQL transport — the one decision that de-risks AUDIT-05/11/18/19

**Primary (recommended): Supabase Management API with server-enforced read-only.**
[CITED: supabase.com/docs/reference/api/v1-run-a-query — `POST /v1/projects/{ref}/database/query`, body `{query, parameters?, read_only?}`, `read_only: true` prevents modification; requires `SUPABASE_ACCESS_TOKEN` PAT with `database_read`]

```javascript
// .planning/audit/tools/sql-readonly.mjs   (zero dependencies — uses global fetch)
const ref   = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;      // PAT; never logged
if (!ref || !token) { console.error("missing SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN"); process.exit(2); }

export async function q(sql, parameters = []) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, parameters, read_only: true }),   // ← enforced server-side
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);     // body may contain SQL, not secrets
  return res.json();
}
```

**Fallback (if no PAT): `pg` installed outside the repo.** Verified today — `npm install --prefix <scratch> pg@8` added 14 packages in 134 ms and left `package-lock.json` byte-identical.

```bash
export AUDIT_TMP="$(mktemp -d)"                      # OUTSIDE the repo
npm install --prefix "$AUDIT_TMP/deps" --no-audit --no-fund pg@8
NODE_PATH="$AUDIT_TMP/deps/node_modules" node .planning/audit/tools/sql-readonly-pg.mjs
# In the script: `await client.query("BEGIN TRANSACTION READ ONLY")` before any statement.
```

**Rejected:** a `createServiceClient()`-based path. It is the RLS-bypassing credential under audit, it enforces nothing, and there is no generic SQL RPC — it would require adding one, which is a schema change.

### 3. Endpoint inventory generator — AUDIT-03 (prototyped today; emits 94 rows)

```javascript
// .planning/audit/tools/gen-endpoint-inventory.mjs  (zero deps; MERGES into existing JSON by id)
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OUT = ".planning/audit/inventory/endpoints.json";
const prior = existsSync(OUT) ? Object.fromEntries(JSON.parse(readFileSync(OUT,"utf8")).map(r=>[r.id,r])) : {};

const files = execSync("find src/app -name route.ts").toString().trim().split("\n").sort();
const rows = files.map((file) => {
  const s = readFileSync(file, "utf8");
  const route = "/" + file.replace(/^src\/app\//,"").replace(/\/route\.ts$/,"");
  const id = route.replace(/^\//,"").replace(/\//g,".").replace(/\[|\]/g,"");
  const signals = {
    uses_cookie_client:       /@\/lib\/supabase\/server/.test(s),
    uses_service_client:      /createServiceClient/.test(s),
    calls_verify_admin:       /verifyAdmin\s*\(/.test(s),
    calls_get_user:           /auth\.getUser\s*\(/.test(s),
    calls_get_session:        /auth\.getSession\s*\(/.test(s),
    calls_check_ban:          /checkBanStatus\s*\(/.test(s),
    inline_role_check:        /roles\s*\.\s*includes\s*\(/.test(s),
    references_club_members:  /club_members/.test(s),
    parses_body:              /\b(?:request|req)\.json\s*\(/.test(s),
    has_zod:                  /from\s+["']zod["']/.test(s),
    sets_cache_control:       /["']Cache-Control["']/i.test(s),
    cache_control_values:     [...s.matchAll(/["']Cache-Control["']\s*[,:]\s*["']([^"']+)["']/gi)].map(m=>m[1]),
    env_vars_referenced:      [...new Set([...s.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m=>m[1]))],
    has_try_catch:            /\btry\s*\{/.test(s),
    catch_any_count:          (s.match(/catch\s*\(\s*[A-Za-z_]+\s*:\s*any\s*\)/g)||[]).length,
    console_count:            (s.match(/console\.(log|error|warn|info|debug)/g)||[]).length,
    as_any_count:             (s.match(/\bas any\b/g)||[]).length,
    tables_referenced:        [...new Set([...s.matchAll(/\.from\(\s*["']([a-z_0-9.]+)["']/g)].map(m=>m[1]))],
    loc: s.split("\n").length,
  };
  const base = prior[id] ?? {
    auth_requirement:"unknown", role_required:"unknown", rls_reliance:"unknown",
    service_role_justified:null, personalized:"unknown", cache_policy_today:"unknown",
    cache_policy_target:"unknown", input_validation:"unknown", test_present:"unknown",
    dead_or_duplicate:"unknown", expected_status:{}, findings:[],
  };
  return { ...base, id, file, route,
    methods: [...s.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(m=>m[1]),
    dynamic_segments: route.match(/\[[^\]]+\]/g) ?? [],
    signals };
});
writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");
console.error(`wrote ${rows.length} rows`);          // expect 94
```

**Aggregates this produced today (use as sanity checks, and as AUDIT-14 inputs):**

| Signal | Count (of 94) |
|---|---|
| rows emitted | **94** |
| `uses_service_client` | **22** |
| no `try {` anywhere in the file | **22** |
| sets its own `Cache-Control` | **4** |
| no auth signal at all (`getUser`/`verifyAdmin`/`getSession` all false) | **13** |
| distinct tables referenced across all handlers | **32** |
| method exports | GET 60, POST 34, PATCH 13, DELETE 12, PUT 2 |
| env vars referenced from handlers | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS` |

The **13 routes with no auth signal at all** are the highest-value hand-review queue in the phase — start AUDIT-03 classification there.

### 4. Page + special-file inventory — AUDIT-04 (prototyped today; emits 43 rows)

```javascript
// key fields; full generator mirrors gen-endpoint-inventory.mjs
const PROTECTED = ["/my-events","/create-event","/notifications","/profile",
                   "/settings","/my-clubs","/invites","/friends"];   // 8 — READ FROM src/middleware.ts, not CLAUDE.md
// per page.tsx:
//   is_client_component   /^\s*["']use client["']/m
//   uses_cookie_client | uses_browser_client | uses_service_client | uses_auth_store | uses_swr
//   fetches_api           [...s.matchAll(/fetch\(\s*[`"'](\/api\/[^`"'?]+)/g)]
//   middleware_protected  PROTECTED.some(p => r===p || r.startsWith(p+"/"))
//   layout_guard          nearest ancestor layout.tsx containing auth.getUser() AND a role check
//   render_mode           parsed from .planning/audit/inventory/build-routes.txt  (○ static | ƒ dynamic)
```

```bash
# Capture the authoritative reachable-route table (139 rows today) — read-only, verified
npm run build 2>&1 | tee .planning/audit/baseline/build.txt
sed -n '/^Route (app)/,/^ƒ  (Dynamic)/p' .planning/audit/baseline/build.txt \
  > .planning/audit/inventory/build-routes.txt

# The 16 App Router special files that neither `page.tsx` nor `route.ts` finds:
find src/app \( -name 'layout.tsx' -o -name 'loading.tsx' -o -name 'error.tsx' \
  -o -name 'not-found.tsx' -o -name 'robots.ts' -o -name 'sitemap.ts' \
  -o -name 'template.tsx' -o -name 'default.tsx' \) | sort
```

Verified results today — `middleware_protected` is true for **9 of 43** pages (`/create-event`, `/friends`, `/invites/[token]`, `/my-clubs`, `/my-clubs/[id]`, `/my-events`, `/notifications`, `/profile`, `/settings`); 26 of 43 are client components; `src/app/users/[id]/page.tsx` is the **one page using `createServiceClient()`**. `grep -rl '"use server"' src/` returns **nothing** — there are **no Server Actions**, so every mutation flows through the 94 route handlers (a useful negative finding for REFAC-17's CSRF assessment).

### 5. Read-only SQL query set — AUDIT-05, 06, 11, 18, 19

```sql
-- AUDIT-05: every policy, every table, every command, every role
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname, tablename, cmd, policyname;

-- AUDIT-05: RLS-disabled and RLS-enabled-with-no-policy tables (the two silent extremes)
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       COALESCE(p.n, 0) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (SELECT tablename, count(*) n FROM pg_policies WHERE schemaname='public' GROUP BY 1) p
       ON p.tablename = c.relname
WHERE n.nspname='public' AND c.relkind='r' ORDER BY rls_enabled, policy_count, table_name;

-- AUDIT-05 flags: USING (true) and policies with no TO clause
SELECT tablename, policyname, cmd, roles, qual FROM pg_policies
WHERE schemaname='public' AND (btrim(qual) = 'true' OR roles = '{public}');

-- AUDIT-06 input: is every column referenced by a policy indexed?
SELECT t.relname AS table_name, a.attname AS column_name,
       EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=t.oid AND a.attnum = ANY(i.indkey)) AS indexed
FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE n.nspname='public' AND t.relkind='r'
  AND a.attname IN ('user_id','club_id','event_id','owner_id','id');

-- AUDIT-11: pg_cron schedule reality (expected: compute_user_scores may be MISSING outside prod)
SELECT jobid, schedule, command, nodename, database, username, active, jobname FROM cron.job ORDER BY jobid;
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- AUDIT-18: buckets + storage.objects policies
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at FROM storage.buckets ORDER BY id;
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' ORDER BY cmd, policyname;

-- AUDIT-19: the authoritative events date columns — THE question, answered by the DB, not types.ts
SELECT column_name, data_type, is_nullable, column_default, ordinal_position
FROM information_schema.columns
WHERE table_schema='public' AND table_name='events' ORDER BY ordinal_position;

-- AUDIT-02 input: full column census for the three-way drift table
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;
```

> **AUDIT-18 context verified today:** `supabase/config.toml`'s `[storage.buckets.*]` block is entirely commented out, and `supabase/migrations/*.sql` reference only an `event-images` bucket via `storage.buckets (id, name, public)`. If `avatars` and `banners` come back from `storage.buckets` in production, they exist in no migration — a schema-drift finding in its own right, and a REFAC-01 input.
>
> **AUDIT-19 context verified today:** `event_date` / `event_time` appear in **zero** migrations and **zero** lines of `src/lib/supabase/types.ts`. They survive only in 3 Jest fixtures (`analytics.test.ts` ×2, `useEvents.test.ts`) and a comment in `src/lib/tagMapping.ts` reading *"no more event_date/event_time split."* The remaining question is whether the **columns still exist in production**. Expect one of: (a) columns dropped → the concern is resolved, record the negative finding and mark the test fixtures stale; (b) columns still present but unused → a Low/Medium dead-column finding for REFAC-10.

### 6. AUDIT-08 — the two-session production cache probe (GET only)

**Obtaining two session cookies without modifying anything.** Sign in to production as two *existing, distinct* McGill accounts in two separate browser profiles (or one normal + one private window), open DevTools → Application → Cookies, and copy every cookie whose name starts with `sb-<projectRef>-auth-token` — **including the chunked `.0` / `.1` suffixes**, which `src/middleware.ts` explicitly handles. The project ref is the first hostname label of `NEXT_PUBLIC_SUPABASE_URL`. No API call, no password, no write. Store them in shell variables in the operator's terminal — **never in a file under `.planning/`**.

```bash
HOST="https://<PRODUCTION_HOST>"        # user-supplied; not present anywhere in the repo (verified)
OUT=.planning/audit/cache/curl

# Route list is DERIVED from endpoints.json, not hand-typed:
#   jq -r '.[] | select(.personalized==true) | .route' inventory/endpoints.json
# Priority order (highest suspicion first), per ARCHITECTURE.md Pattern 4:
ROUTES=(/api/recommendations /api/users/saved-events /api/notifications /api/my-clubs
        /api/invites /api/events/my-events /api/health)
CONTROL=/api/events                     # POSITIVE CONTROL — must eventually show HIT, else harness is broken

probe () {  # $1 route  $2 session-label  $3 cookie  $4 iteration
  slug=$(echo "$1" | tr '/' '_' | sed 's/^_//')
  curl -sSI -X GET "$HOST$1" -H "Cookie: $3" \
    | grep -iE 'HTTP/|x-vercel-cache|x-matched-path|cache-control|cdn-cache-control|vary|age|set-cookie|x-vercel-id' \
    | sed -E 's/^([Ss]et-[Cc]ookie:).*/\1 <REDACTED>/' \
    > "$OUT/${slug}.${2}.${4}.headers.txt"
}

mkdir -p "$OUT"
for r in "${ROUTES[@]}" "$CONTROL"; do
  for i in 1 2 3; do                    # interleave A,B,A,B inside one 60s s-maxage window
    probe "$r" A "$COOKIE_A" "$i"; sleep 2
    probe "$r" B "$COOKIE_B" "$i"; sleep 8
  done
done

grep -rc 'x-vercel-cache: HIT' "$OUT" | grep -v ':0$' || echo "NO HITS ANYWHERE — check the control before concluding"
```

**Grounding** [CITED: Vercel CDN caching reference]: `x-vercel-cache` takes `HIT | MISS | STALE | PRERENDER | REVALIDATED | BYPASS`. `set-cookie` on the response forces `BYPASS`. A request `Cookie` header is **not** part of the cache key unless the route names it in `Vary`. `x-vercel-cache-reason` and `x-vercel-ppr-state` are internal-only and **not visible via curl** — obtain them via `vercel logs --request-id <id> --json` if a reason is needed. `x-matched-path` reveals rewrites.

**Recording.** `cache-matrix.csv` — one row per route × method:

| route | method | personalized | handler_cache_control | vercel_json_applies | observed_cache_control | observed_x_vercel_cache (A1,B1,A2,B2,A3,B3) | max_age_seen | set_cookie_seen | cross_session_HIT | verdict |
|---|---|---|---|---|---|---|---|---|---|---|

`verdict` ∈ `{leak-confirmed, latent-hazard, safe-by-accident, safe-by-design, not-probed}`. **`leak-confirmed` ⇒ a Critical `F-nnn`. `latent-hazard` (no HIT but `s-maxage` present on a personalized response) ⇒ High.** Both must still be filed; PITFALLS.md is explicit that absence of a HIT in a short window is not evidence of safety.

### 7. knip + dependency-cruiser — AUDIT-12, AUDIT-15 (executed today)

```jsonc
// .planning/audit/quality/knip.config.json  — ad-hoc, NOT at the repo root
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "src/app/**/{page,layout,template,loading,error,not-found,global-error,default,route,robots,sitemap}.{ts,tsx}",
    "src/middleware.ts", "src/middlewareRateLimit.ts",
    "next.config.js", "tailwind.config.ts", "postcss.config.js", "eslint.config.mjs", "jest.config.js",
    "scripts/**/*.{ts,mjs,js}", "load-tests/**/*.js", "src/**/*.test.{ts,tsx}"
  ],
  "project": ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs,js}"],
  "ignore": ["supabase/functions/**", "src/lib/supabase/types.ts"],
  "ignoreBinaries": ["k6", "supabase"],
  "ignoreDependencies": ["k6"]
}
```

```bash
npx --yes knip@6.35.1 -c .planning/audit/quality/knip.config.json \
  --reporter json --no-exit-code --no-progress \
  > .planning/audit/quality/knip.out.json
# also capture the human view:
npx --yes knip@6.35.1 -c .planning/audit/quality/knip.config.json --reporter markdown --no-exit-code \
  > .planning/audit/quality/knip.md

# AUDIT-12 reachability, per package — the mechanical answer to "is redoc/swagger reachable?"
npx --yes dependency-cruiser@18.3.0 --no-config -T json -x 'node_modules' \
  -R 'swagger-ui-react|redoc|next-swagger-doc' src \
  > .planning/audit/quality/depcruise.reaches-apidocs.json

git diff --exit-code --quiet -- package.json package-lock.json || echo "LOCKFILE VIOLATION"
```

**Executed today; results the plan can treat as a starting register (re-run and confirm):**

| knip bucket | Findings |
|---|---|
| Unused **production** dependencies (9) | `@radix-ui/react-dropdown-menu`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@swagger-api/apidom-ns-openapi-3-1`, `chart.js`, `react-chartjs-2`, **`swagger-ui-react`**, **`vercel`**, `yaml` |
| Unused devDependencies (4) | `@types/swagger-ui-react`, `baseline-browser-mapping`, `prettier`, `tsx` |
| Unused files (5) | `src/components/clubs/ClubCard.tsx`, `src/components/events/EventImageUpload.tsx`, `src/components/shared/EditEventModal.tsx`, `src/components/ui/breadcrumb.tsx`, `src/components/ui/dropdown-menu.tsx` |
| Unused exports (notable) | **`API_ENDPOINTS`** and `TAG_CHILDREN` in `src/lib/constants.ts` — confirms AUDIT-15's "`API_ENDPOINTS` bypassed by hardcoded URLs"; plus `buttonVariants`, `badgeVariants`, `formatTime`, `formatDateTime`, `downloadExportFile`, `mapTags`, `hasRole`, `isOrganizer`, `useClubEvents`, `useFollowStatus`, `useEventAnalytics`, `timeAgo` |
| Duplicate export | `src/store/useAuthStore.ts` exports `useAuthStore` and `default` for the same binding |

**The AUDIT-12 Swagger/Redoc answer, verified from source today:** `/docs` is a **public page with no middleware or layout guard** (`src/app/docs/page.tsx` → `@/components/redoc/RedocUI` → `import { RedocStandalone } from 'redoc'`). So **`redoc` IS reachable from a production route**; **`swagger-ui-react` is NOT imported anywhere in `src/`** and knip flags it unused. STAB-07's disposition therefore differs per package: `swagger-ui-react` + `@types/swagger-ui-react` + `@swagger-api/apidom-ns-openapi-3-1` are removable; `redoc` + `next-swagger-doc` need an upgrade-or-gate decision.

Caveat to record: knip's `chart.js` / `react-chartjs-2` / three `@radix-ui/*` hits need hand-confirmation for dynamic-import or shadcn-generated usage before being called dead.

### 8. AUDIT-16 — client-bundle secret sweep (executed today, read-only confirmed)

```bash
# 0. Confirm .next/ is gitignored (verified: .gitignore:12 → /.next/)
git check-ignore -v .next/static >/dev/null || { echo "ABORT: .next is NOT ignored"; exit 1; }

# 1. The build MUST carry real secrets, or a clean result is INCONCLUSIVE (see Pitfall 7)
node -e "process.exit(process.env.SUPABASE_SERVICE_ROLE_KEY ? 0 : 1)" \
  && ENVSTATE="real-secrets-present" || ENVSTATE="INCONCLUSIVE-key-absent-from-build-env"

npm run build > .planning/audit/baseline/build.txt 2>&1

# 2. Prefix / name sweep — file NAMES and COUNTS only; never -o, never print a matching line
for pat in 'sb_secret_' 'service_role' 'SUPABASE_SERVICE_ROLE_KEY' 'ADMIN_API_KEY' 'ADMIN_EMAILS' 'CRON_SECRET'; do
  printf '%-32s %s\n' "$pat" "$(grep -rlF "$pat" .next/static 2>/dev/null | wc -l | tr -d ' ')"
done

# 3. Literal-value sweep (value read from env, never echoed)
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && \
  echo "literal service-role key: $(grep -rlF "$SUPABASE_SERVICE_ROLE_KEY" .next/static 2>/dev/null | wc -l) file(s)"

# 4. Shape sweep — any JWT-looking string at all in the client bundle
grep -rhoE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}' .next/static | sort -u | wc -l

# 5. Same sweep over public/ (served verbatim) and over .planning/audit/ itself (Pitfall 4)
grep -rlE 'eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_|postgres(ql)?://[^ ]*:[^@]*@' public .planning/audit 2>/dev/null

# 6. Read-only guard
git status --porcelain -- . ':(exclude).planning' | diff .planning/audit/baseline/git-status.before.txt -
```

**Result today (build exit 0, `git status` byte-identical before/after):** 0 hits for all six patterns in `.next/static`; 0 JWT-shaped strings; `.next/server` contains 56 files referencing `SUPABASE_SERVICE_ROLE_KEY` **by name only** (correct server-side `process.env` behavior, not an inline literal). Record `ENVSTATE` in the artifact — with only a 182-byte `.env` on this machine, the run may be `INCONCLUSIVE` until the real key is present.

### 9. The read-only guard — run after every task

```bash
# .planning/audit/tools/readonly-guard.sh
set -u
BASE=.planning/audit/baseline
mkdir -p "$BASE"

if [ ! -f "$BASE/git-status.before.txt" ]; then          # Wave 0 only
  git status --porcelain -- . ':(exclude).planning' > "$BASE/git-status.before.txt"
  shasum -a 256 package-lock.json package.json          > "$BASE/lock.sha256"
  echo "baseline captured"; exit 0
fi

fail=0
if ! git status --porcelain -- . ':(exclude).planning' | diff -q "$BASE/git-status.before.txt" - >/dev/null; then
  echo "READ-ONLY VIOLATION — files changed outside .planning/:"
  git status --porcelain -- . ':(exclude).planning' | diff "$BASE/git-status.before.txt" -
  fail=1
fi
if ! shasum -a 256 -c "$BASE/lock.sha256" --status; then
  echo "LOCKFILE/MANIFEST MUTATED — restore with: git checkout -- package-lock.json package.json"; fail=1
fi
git diff --exit-code --quiet -- . ':(exclude).planning' || { echo "TRACKED FILE MODIFIED"; fail=1; }
exit $fail
```

Verified today: `git status --porcelain -- . ':(exclude).planning'` and `git diff --stat -- . ':(exclude).planning'` both accept the pathspec-exclude magic; the baseline on this repo is **not empty** (`?? docs/product-master-plan.md`), which is exactly why the diff-against-baseline form is required.

---

## State of the Art

Corrections to upstream planning documents. Each was verified in this session; each should be filed as a Low-severity stale-documentation finding so the source document gets fixed.

| Stale claim | Source | Verified reality (2026-09-14) | Impact |
|---|---|---|---|
| "92 route handlers" | REQUIREMENTS.md AUDIT-03, PROJECT.md, orchestrator brief | **94** (`find src/app -name route.ts \| wc -l`) | Validator threshold; AUDIT-03 row count |
| "45 migration files" | PROJECT.md Context, orchestrator brief, PITFALLS.md ("44") | **44**, all `.sql`, all tracked | AUDIT-02 scope |
| "`internal/` (Vite app) and `backend/` (legacy Python) are committed; Stage 1 must decide their disposition" | SUMMARY.md Open Questions, ARCHITECTURE.md, FEATURES.md AUDIT-15 | **Both are gone.** `backend/` removed in commit `5e7bf27` ("chore: remove legacy backend directory (superseded by AI/)"); `internal/` has zero tracked files ever and is gitignored (`.gitignore:63`). Neither directory exists in the working tree. | One SUMMARY.md open question is already closed — record the negative finding with the commit sha, do not spend a task on it |
| "Protected routes: 6 entries" | CLAUDE.md § Auth Flow | **8** — adds `/settings` and `/friends` | AUDIT-04 cross-check would be wrong if CLAUDE.md were trusted |
| "`getSession()` used for auth checks" (plural) | codebase/CONCERNS.md (2026-03-05) | **Exactly 1 callsite**, `src/app/api/health/route.ts:160`, a liveness probe | AUDIT-09 is a 30-minute task confirming a negative, not a sweep |
| "Hand-written Supabase types" | codebase/CONCERNS.md | `src/lib/supabase/types.ts` is 1,508 lines and begins with `__InternalSupabase: { PostgrestVersion }` — **CLI-generated output** | Changes REFAC-04's shape; AUDIT-02's third column is "does the generated file match the live schema," not "is it hand-written" |
| "Dual event date schema (`event_date`/`event_time`)" | PROJECT.md Known Concerns, REQUIREMENTS.md AUDIT-19 | Absent from all migrations and all of `types.ts`; survives in 3 Jest fixtures and a `tagMapping.ts` comment reading *"no more event_date/event_time split"* | AUDIT-19 likely confirms resolution-in-code; the live question is whether the **columns** still exist |
| "Vitest is a framework in this project; `swagger-ui-react ^5.30.2`" | `.claude/CLAUDE.md` § Technology Stack (generated from codebase/STACK.md) | Vitest is not installed; `package.json` pins `^5.17.10` and knip reports it **unused** | Stale-docs finding; AUDIT-12/13 |
| "Node.js 20" as the project runtime | `.claude/CLAUDE.md`, `.github/workflows/ci.yml` | Local is **Node 24.16.0**. CI's Node 20 **cannot run `dependency-cruiser@18.3.0`** (`engines: ^22\|\|^24\|\|>=26`) and is borderline for `knip@6.35.1` (`^20.19.0 \|\| >=22.12.0`) | STAB-01 input; also means Stage 1 tooling must run locally, not in CI |
| "Install `knip` and `dependency-cruiser` as devDependencies in Stage 1" | research/STACK.md § Installation | **Contradicts the phase's read-only constraint** (and STACK.md's own "preserve the current lockfile untouched" two sections later) | Use `npx --yes <pkg>@<exact>` — verified lockfile-safe today |
| "`.env.local` contains the credentials" | CLAUDE.md § Environment Variables | `.env.local` does not exist; a gitignored `.env` (182 B) does | Affects how AUDIT-16's build env is arranged |

**Deprecated / superseded:**
- `README.md` describes "Next.js 14 (App Router)" and "State Management: React Hooks" — the project is on Next 16 with Zustand. Stale-docs finding.
- `test-results/.last-run.json` is a tracked Playwright run marker with no Playwright installed. Dead-artifact finding.
- `vitest.config.ts` and `vitest.setup.ts` are orphans (already slated for deletion in STAB-08); Phase 1 records them, does not delete them.
- The `next build` output labels middleware as **`ƒ Proxy (Middleware)`** — Next 16 has already renamed the concept, corroborating STAB-06's `middleware.ts` → `proxy.ts` migration.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The Supabase Management API `POST /v1/projects/{ref}/database/query` with `read_only: true` is available to this account's PAT and returns row JSON | § Code Examples 2 | Falls back to the verified out-of-repo `pg` client with `BEGIN TRANSACTION READ ONLY`; costs one extra task, no requirement is blocked. Source is vendor docs via WebFetch (LOW per the confidence seam), not executed against this project. |
| A2 | Session cookies for two production accounts can be copied from browser DevTools without any write to the app | § Code Examples 6 | If the deployment sets `HttpOnly` such that DevTools still shows them (it does — DevTools shows HttpOnly cookies), this holds. If a cookie is `__Host-` prefixed and chunked unexpectedly, the probe may 401; symptom is an all-401 run, detectable from the captured `HTTP/` status line. |
| A3 | `supabase inspect db <subcommand>` accepts `--db-url` and is SELECT-only | § Code Examples 1 | Flags not individually verified per subcommand (only the subcommand list was). If a flag differs, the data is obtainable from the SQL query set instead; nothing is blocked. |
| A4 | A staging Supabase project exists and its ref/password will be supplied | § Environment Availability | AUDIT-01's staging snapshot and AUDIT-02's staging drift row cannot be produced; the phase would need to record them as deferred-with-reason rather than complete. PROJECT.md asserts staging exists; it was not verified in this session. |
| A5 | The production deployment is on Vercel at a hostname the user can supply | § Code Examples 6 | **No production URL exists anywhere in the repo** (verified by grep). AUDIT-08's empirical half is blocked without it. |
| A6 | knip's `chart.js` / `react-chartjs-2` / `@radix-ui/react-{dropdown-menu,switch,tabs}` unused-dependency hits are true positives | § Code Examples 7 | Dynamic imports and shadcn-generated wrappers are knip's classic false-positive sources. Each must be hand-confirmed before entering the dead-code report, or STAB-09 removes a dependency the UI needs. |
| A7 | `npm run build` on the audit machine reproduces the production build closely enough for the `.next/static` sweep to be meaningful | § Code Examples 8 | If Vercel builds with a different env set, a local clean result does not generalize. Mitigation: record the exact env var *names* present at build time in the artifact. |
| A8 | Docker/OrbStack can be started by the operator when the credentialed wave runs | § Environment Availability | `supabase db dump/diff` and the local snapshot are blocked; the SQL-only requirements (05, 06, 11, 18, 19) still complete via the Management API. |

---

## Open Questions

1. **Which Supabase projects are production and staging, and what credentials will be supplied?**
   - What we know: the repo is **not linked** (`supabase/.temp/` contains only `cli-latest`); `supabase status` reports `linked_project: null`. No project ref appears anywhere in tracked files. PROJECT.md asserts a staging project exists.
   - What's unclear: the two refs, and whether a `SUPABASE_ACCESS_TOKEN` PAT (preferred) or DB passwords (fallback) will be provided.
   - Recommendation: Wave 0 writes `.planning/audit/BLOCKING-INPUTS.md` and the plan places a single `checkpoint:human-verify` gate before Wave 2A. Env var **names** the plan should request: `SUPABASE_ACCESS_TOKEN`, `PROD_PROJECT_REF`, `STAGING_PROJECT_REF`, and (fallback only) `PROD_DB_PASSWORD` / `STAGING_DB_PASSWORD` or `PROD_DB_URL` / `STAGING_DB_URL`. Never write any of these into `.planning/`.

2. **What is the production hostname, and which two accounts provide the session cookies?**
   - What we know: zero production URLs in the repo; no `metadataBase`, no `NEXT_PUBLIC_SITE_URL`, no `VERCEL_URL` reference in `src/`.
   - Recommendation: same blocking-input gate, before Wave 2B. Requires: hostname, plus two distinct signed-in McGill accounts. Cookie extraction is a human step by design.

3. **Are `/api/cron/send-reminders` and `/api/cron/send-feedback-requests` triggered at all?**
   - What we know: `vercel.json` has no `crons` key (verified); both handlers export only `POST`; neither is referenced from any other route.
   - What's unclear: whether an external scheduler (GitHub Actions, cron-job.org, Supabase pg_cron `http` call, Zapier) invokes them. Email reminders are a **Validated** requirement in PROJECT.md, so "nothing triggers them" is a High finding, not a note.
   - Recommendation: AUDIT-11 must check three places outside the repo — Vercel project → Cron Jobs, `cron.job` rows whose `command` contains an HTTP call, and `.github/workflows/` (verified: only `ci.yml` exists, which does not call them). If all three are empty, file the finding.

4. **Does `supabase db diff` need a running local Postgres in addition to Docker?**
   - What we know: the CLI help says it "compares a shadow built from `supabase/migrations`" — the shadow is created on demand.
   - What's unclear: whether `--linked` alone suffices or whether `supabase start` must have run first.
   - Recommendation: the task tries `db diff --linked` first; on failure, runs `supabase start` (local-only, no repo writes) and retries. Budget one retry; this is the "confirm CLI syntax against the installed version" exercise SUMMARY.md flagged.

5. **Is the AUDIT-01 "local" snapshot meaningful before REFAC-01?**
   - What we know: a `supabase db reset` from 44 migrations across 3 naming schemes with 2 `remote_schema` re-baselines may not even apply cleanly, and `[db.seed]` is enabled with no `supabase/seed.sql`.
   - Recommendation: attempt it; if it fails, **the failure output is the artifact** — "migrations do not replay from zero" is one of the highest-value findings the phase can produce, and it directly scopes REFAC-01. Do not treat a failed local reset as a blocked task.

---

## Environment Availability

Probed on this machine, 2026-09-14.

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | all generators, validator | ✓ | 24.16.0 | — |
| npm | AUDIT-12, AUDIT-13 | ✓ | 11.13.0 | — |
| git | read-only guard (AUDIT exit gate) | ✓ | — | — |
| Supabase CLI | AUDIT-01, 02 | ✓ | 2.115.0 (2.117.0 available) | — |
| `npx` network access | knip, dependency-cruiser, pg | ✓ | verified by successful downloads | — |
| `next build` | AUDIT-13, 16, page render modes | ✓ | exit 0 today, 4.4 MB `.next/static` | — |
| **Docker daemon** | `supabase db dump/diff`, `supabase start` | **✗** | daemon not reachable (`/Users/adyan/.orbstack/run/docker.sock` missing) | Operator starts OrbStack/Docker Desktop. SQL-only requirements route around it via the Management API. |
| **`psql` / `pg_dump`** | ad-hoc SQL | **✗** | not installed | Management API (primary) or out-of-repo `npm install --prefix <tmp> pg@8` (verified working) |
| **Supabase project link** | `--linked` flag | **✗** | `linked_project: null`; no `supabase/.temp/project-ref` | `supabase link --project-ref <ref>` (writes only to gitignored `supabase/.temp/`) or pass `--project-ref` per command |
| **Production hostname** | AUDIT-08 | **✗** | absent from the entire repo | User-supplied — blocking |
| **Two production session cookies** | AUDIT-08 | **✗** | — | User-supplied — blocking |
| **`SUPABASE_ACCESS_TOKEN` / project refs / DB passwords** | AUDIT-01, 02, 05, 06, 11, 18, 19 | **✗** | not in `src/`, CI, or any tracked file | User-supplied — blocking |
| `SUPABASE_SERVICE_ROLE_KEY` in the local build env | AUDIT-16 (meaningful result) | **?** | only a 182-byte gitignored `.env` exists; `.env.local` absent | If absent, AUDIT-16 records `INCONCLUSIVE`, not `clean` |
| `vercel` CLI | AUDIT-11 (Vercel cron check), optional `vercel logs` | **?** | `vercel@32.3.0` is in `dependencies` but never imported; a global install was not probed | Vercel dashboard, manually, with a screenshot or copied config as the artifact |

**Missing dependencies with no fallback (blocking — planner must gate on them):**
- Production hostname + two session cookies → **AUDIT-08's empirical half**
- Supabase PAT or project refs + DB credentials → **AUDIT-01, AUDIT-02, AUDIT-05, AUDIT-06, AUDIT-18, AUDIT-19, and the `cron.job` half of AUDIT-11**

**Missing dependencies with a fallback:**
- Docker → Management API covers all pure-SQL requirements; only AUDIT-01's dumps and AUDIT-02's `db diff` truly need it
- `psql` → Management API or out-of-repo `pg` (both verified/cited)
- Project link → `--project-ref` per command

**Planner guidance:** Wave 1 (AUDIT-03, 04, 07, 09, 10, 12, 13, 14, 15, 16 — **10 of 21 requirements**) has **zero blocking inputs** and should be planned to run to completion regardless of credential availability. Do not serialize the whole phase behind the credential gate.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is required.

**Critical framing:** the normal answer — "add a Jest test" — is **forbidden here**. Jest tests live in `src/`, and writing to `src/` fails the phase's own exit criterion. The validation harness is a **zero-dependency Node validator plus a shell guard, both under `.planning/audit/tools/`**, run directly. `jest.config.js`, `package.json`, and every file under `src/` remain untouched.

### Test Framework

| Property | Value |
|---|---|
| Framework | **None (deliberate).** Node 24 built-ins only — `node .planning/audit/tools/validate.mjs` — plus `bash .planning/audit/tools/readonly-guard.sh`. Zero dependencies, zero repo writes. |
| Config file | `.planning/audit/tools/validate.mjs` (self-contained; expectations table is a top-level const) — **does not exist yet → Wave 0** |
| Quick run command | `node .planning/audit/tools/validate.mjs --quick && bash .planning/audit/tools/readonly-guard.sh` (< 2 s) |
| Full suite command | `node .planning/audit/tools/validate.mjs && bash .planning/audit/tools/readonly-guard.sh` (< 10 s) |
| App test suite | `npx jest` is run **once**, as AUDIT-13 evidence capture, not as a gate. Its output is an artifact (`baseline/jest.txt`). |

### Phase Requirements → Test Map

| Req ID | Behavior to validate | Type | Automated command | Exists? |
|---|---|---|---|---|
| AUDIT-01 | 3 schema dumps exist and are non-trivial | artifact | `validate.mjs --check schema-snapshots` (`test -s`, > 1 KB, contains `CREATE TABLE`) | ❌ Wave 0 |
| AUDIT-02 | Drift table exists; every table in `information-schema-columns.json` has a row in `drift.json` with all three status columns set | schema + cross-ref | `validate.mjs --check drift` | ❌ Wave 0 |
| AUDIT-03 | `endpoints.json` has **exactly the count in `baseline/versions.txt`** (94 today), validates against `endpoints.schema.json`, and contains zero `"unknown"` values | schema + count | `validate.mjs --check endpoints` | ❌ Wave 0 |
| AUDIT-04 | `pages.json` has exactly 43 rows, schema-valid, zero `"unknown"`; **every route in `build-routes.txt` appears in `endpoints.json ∪ pages.json ∪ special-files.json`** | schema + cross-ref | `validate.mjs --check pages` | ❌ Wave 0 |
| AUDIT-05 | `pg_policies.json` is non-empty; `rls-review.md` explicitly addresses each of the four flag classes | artifact + content | `validate.mjs --check rls` | ❌ Wave 0 |
| AUDIT-06 | Heatmap CSV row count == distinct tables × 4 commands; every cell ∈ {allow, deny, none} | schema | `validate.mjs --check heatmap` | ❌ Wave 0 |
| AUDIT-07 | Register row count == count of files where `signals.uses_service_client` is true (**22 route files today**, + the page + `lib/audit.ts`); every row has all four justification answers non-null | cross-ref | `validate.mjs --check service-role` | ❌ Wave 0 |
| AUDIT-08 | Every `personalized: true` endpoint has a `cache-matrix.csv` row with a non-`not-probed` verdict; **the positive-control row exists and shows at least one `HIT`** | cross-ref | `validate.mjs --check cache` | ❌ Wave 0 |
| AUDIT-09/10 | Every `signals.calls_get_session` / env-gated-auth endpoint appears in its register with a classification | cross-ref | `validate.mjs --check authz-registers` | ❌ Wave 0 |
| AUDIT-11 | Inventory answers all six named sources (pg_cron, `/api/cron/*`, `vercel.json`, edge function, Apify webhook, auth hooks) with an explicit verdict each | content | `validate.mjs --check cron` | ❌ Wave 0 |
| AUDIT-12 | `npm-audit.prod.json` parses; every High/Critical advisory id has a reachability row; the Swagger/Redoc question has an explicit answer | schema + content | `validate.mjs --check deps` | ❌ Wave 0 |
| AUDIT-13 | All five baseline files exist and are non-empty; `jest.txt` contains pass **and** skip counts; a reason exists per skipped suite | artifact + content | `validate.mjs --check baseline` | ❌ Wave 0 |
| AUDIT-14 | Report contains all five quantities as integers | content | `validate.mjs --check observability` | ❌ Wave 0 |
| AUDIT-15 | `knip.out.json` parses; `dead-code.md` explicitly dispositions `internal/`, `backend/`, `API_ENDPOINTS`, and the stale-docs list | content | `validate.mjs --check dead-code` | ❌ Wave 0 |
| AUDIT-16 | Sweep artifact records `ENVSTATE` and a count per pattern | content | `validate.mjs --check bundle-sweep` | ❌ Wave 0 |
| AUDIT-17 | Exactly 3 threat-model files, each ≤ ~1 page, each with the STRIDE table populated | artifact | `validate.mjs --check threat-models` | ❌ Wave 0 |
| AUDIT-18 | `buckets.json` non-empty; review answers read-visibility, path-prefix ownership, and size/MIME limits for every bucket returned | cross-ref | `validate.mjs --check storage` | ❌ Wave 0 |
| AUDIT-19 | `events-date-columns.md` names the authoritative columns and cites `information-schema-columns.json` | content | `validate.mjs --check dates` | ❌ Wave 0 |
| AUDIT-20 | `findings.json` schema-valid; ids unique, `^F-\d{3}$`, no duplicates; every finding has all 10 fields; every Critical/High has line numbers; every `evidence` path exists; `FOUNDATION_AUDIT.md` finding count == `findings.json` length | schema + cross-ref | `validate.mjs --check findings` | ❌ Wave 0 |
| AUDIT-21 | `SEVERITY_SLA.md` names a deadline for all four levels and the exception-register rule | content | `validate.mjs --check sla` | ❌ Wave 0 |
| **Phase exit** | `git status --porcelain` outside `.planning/` is identical to the Wave-0 baseline; `package-lock.json` + `package.json` hashes unchanged | guard | `bash .planning/audit/tools/readonly-guard.sh` | ❌ Wave 0 |

### Sampling Rate

- **Per task (every commit):** `bash .planning/audit/tools/readonly-guard.sh && node .planning/audit/tools/validate.mjs --check <the-check-this-task-owns>` — under 2 s. The guard runs on *every* task, including pure-analysis ones, because the read-only invariant is the one thing a single careless edit destroys irrecoverably.
- **Per wave merge:** `node .planning/audit/tools/validate.mjs && bash .planning/audit/tools/readonly-guard.sh` — full artifact + schema + cross-reference sweep.
- **Phase gate (before `/gsd-verify-work`):** full validator green, guard green, plus the secret sweep over `.planning/audit/` itself (§ Code Examples 8, step 5), plus `git log --stat` for the phase showing only `.planning/` paths.

### Wave 0 Gaps

- [ ] `.planning/audit/tools/readonly-guard.sh` — the phase's exit criterion; must exist before task 1 of any other wave
- [ ] `.planning/audit/baseline/git-status.before.txt` + `baseline/lock.sha256` — the guard's referents (**baseline is not empty on this repo**)
- [ ] `.planning/audit/baseline/versions.txt` — re-derived counts (94 / 43 / 44) and tool versions; the validator asserts against this, never against a planning-doc literal
- [ ] `.planning/audit/tools/validate.mjs` — zero-dep validator with a `--check <name>` selector and a `--quick` mode
- [ ] `.planning/audit/inventory/{endpoints,pages}.schema.json` and `.planning/audit/findings.schema.json` — hand-written JSON Schema subsets validated by a ~60-line checker inside `validate.mjs` (no `ajv`, no install)
- [ ] `.planning/audit/BLOCKING-INPUTS.md` — the credential/host request, written before Wave 2 is attempted
- [ ] `.planning/audit/REDACTION.md` — created empty in Wave 0 so every credentialed task has somewhere to append

*Framework install: none required.*

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level` is `1`, `security_block_on` is `high`.

This phase has an unusual security posture: **it is itself a security activity**, and its own threat surface is the risk of leaking what it finds. Both halves are covered below.

### Applicable ASVS Categories — what the audit must look for

| ASVS category | Applies | What Phase 1 must produce |
|---|---|---|
| V1 Architecture & Threat Modeling | **yes** | AUDIT-17's three one-page models; the three-ring model from ARCHITECTURE.md is the reference architecture the audit measures against |
| V2 Authentication | yes | AUDIT-09 (`getSession` vs `getUser` at authorization decisions — 1 callsite, health probe); McGill-email enforcement in `src/app/auth/callback/route.ts` incl. `ADMIN_EMAILS` auto-promotion |
| V3 Session Management | yes | The `sb-<ref>-auth-token` cookie set, its chunking, the middleware's cookie-cleanup branch, and **whether a session token can be served from a shared CDN cache (AUDIT-08)** |
| V4 Access Control | **yes — the phase's centre of gravity** | AUDIT-05/06 (RLS as Ring 3), AUDIT-07 (25 service-role files bypassing it), AUDIT-10 (two fail-open endpoints), AUDIT-03's `expected_status` per persona; the 19 hand-rolled `club_members` checks; `verifyAdmin` in 27 files vs 24 admin-path routes vs inline `roles.includes` |
| V5 Input Validation | yes | 34 handlers calling `request.json()` with **zero** zod (verified: `grep -rl "from 'zod'" src/` → 0); `%`/`_` unescaped in `ilike` search |
| V6 Cryptography | no (as a control to build) | Nothing hand-rolls crypto; Supabase owns JWT signing. Audit only that no secret is hard-coded (AUDIT-16) |
| V7 Error Handling & Logging | yes | AUDIT-14: 162 `console.*` across 60 files, 5 `catch (error: any)`, **22 of 94 route files with no `try` at all**, no request correlation id, no Sentry |
| V8 Data Protection | yes | AUDIT-08 (personalized student data in a shared cache = PII disclosure); AUDIT-18 (storage bucket read visibility and path-prefix ownership) |
| V9 Communications | partial | HSTS/CSP verified present in `next.config.js`; record as a positive control |
| V13 API & Web Service | yes | AUDIT-03's full classification; the public `/docs` OpenAPI surface (`redoc`, unguarded) |
| V14 Configuration | yes | `vercel.json`'s blanket cache header; the CI env placeholders; the absent `crons` key; `supabase/config.toml` with no bucket definitions |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Phase-1 evidence task |
|---|---|---|---|
| Personalized JSON served from a shared CDN cache to another user | **Information Disclosure** | `private, no-store` default; per-route opt-in; `Vary` on any varying header | AUDIT-08 two-session curl |
| Service-role client reachable from a client bundle or an unauthenticated path | **Elevation of Privilege** | One narrow `db/elevated/` door; ESLint import boundary | AUDIT-07 register + AUDIT-16 sweep (`src/app/users/[id]/page.tsx` is the specific suspect) |
| Authorization check conditional on an env var being set | **Elevation of Privilege** | Fail closed; validated config at boot | AUDIT-10 (`calculate-popularity` GET+POST confirmed fail-open on a service-role client) |
| RLS disabled, or enabled with no policy, or `USING (true)` | **Tampering / Information Disclosure** | Per-table policy with an explicit `TO` clause; indexed policy columns | AUDIT-05 from live `pg_policies` — never from migration files |
| Cross-tenant read via a club id the caller does not belong to | **Information Disclosure** | `requireClubRole` at Ring 2 **and** RLS at Ring 3 | AUDIT-03 `expected_status.cross_club_attacker`; AUDIT-06 heatmap |
| Unauthenticated cron/webhook invocation | **Spoofing** | Bearer secret, fail closed when absent; HMAC on the webhook | AUDIT-10 + AUDIT-11 (`send-reminders` compares to `Bearer undefined` when `CRON_SECRET` is unset) |
| Middleware treated as the authorization boundary | **Elevation of Privilege** | Middleware advisory-only; authz at Ring 2 | AUDIT-04: middleware's whole body is wrapped in `try { ... } catch { NextResponse.next() }` — it **fails open** |
| Unvalidated JSON body reaching a Postgres query | **Tampering / Injection** | zod at the boundary | AUDIT-03 `input_validation`; 34 handlers affected |
| Storage object overwrite across users | **Tampering** | Path-prefix ownership policy on `storage.objects` | AUDIT-18 |

### The phase's own threat model (do not skip)

| Threat | STRIDE | Control the plan must encode |
|---|---|---|
| A live session token from the AUDIT-08 curls is committed in a `set-cookie` line | Information Disclosure | Header capture is `-sSI` + a `sed` redaction of every `set-cookie`; cookie values live only in shell variables |
| A DB password lands in a captured log because it was passed as a CLI argument | Information Disclosure | Secrets by env var only; never `set -x`; `--password` never inlined into a `tee`'d command |
| `supabase db dump` of the `auth` schema commits grants or an inline key | Information Disclosure | `--schema public,storage,extensions`; `--role-only` never written to a committed path |
| A finding's `evidence` field inlines the secret it is a finding about | Information Disclosure | `evidence` is always a **path** into `.planning/audit/`, never a literal |
| An "obvious one-liner" fix contaminates the baseline | Tampering (of the audit's own integrity) | `readonly-guard.sh` after every task; a "Tempting One-Liners" section in `FOUNDATION_AUDIT.md` that becomes the first Stage 3 slice |
| A read-only SQL task accidentally writes | Tampering | Management API `read_only: true` (server-enforced) or `BEGIN TRANSACTION READ ONLY`; **never** a service-role client |

---

## Sources

### Primary (HIGH confidence — executed in this session, 2026-09-14, against this repo and this machine)

- `find` / `grep` / `wc` over `src/`, `supabase/`, `.github/`: 94 `route.ts`, 43 `page.tsx`, 16 App-Router special files, 44 migrations, 25 `createServiceClient` files (22 route + 1 page + `lib/audit.ts` + the factory), 27 `verifyAdmin` files, 1 `getSession` callsite, 19 `club_members` files, 34 `request.json()` files, 0 zod imports, 162 `console.*` across 60 files, 5 `catch (error: any)`, 48 `as any` in route files, 0 `"use server"` files
- Prototype generators executed (`gen-endpoints.mjs`, `gen-pages.mjs`): 94 and 43 rows; 22 service-client routes, 22 routes with no `try`, 4 routes setting `Cache-Control`, 13 routes with no auth signal, 32 distinct tables, method distribution GET 60 / POST 34 / PATCH 13 / DELETE 12 / PUT 2; 9 of 43 pages middleware-protected
- `npm run build` → exit 0, 139-row route table, 4.4 MB `.next/static`, 69 chunks; `git status --porcelain` byte-identical before and after; `tsconfig.json` and `package-lock.json` hashes unchanged
- Lockfile-mutation experiment: `npm audit --omit=dev --json`, `npm audit --json`, `npm outdated --json`, `npm ls --all --json`, `npm ls vercel --all` — all left `package-lock.json` byte-identical (SHA-256 compared per command)
- `npx --yes knip@6.35.1` full run with an ad-hoc config → 9 unused prod deps, 4 unused devDeps, 5 unused files, `API_ENDPOINTS` unused; `package.json` + lockfile unchanged
- `npx --yes dependency-cruiser@18.3.0 --version` → `18.3.0`; `--help` flag surface (`-c/--config`, `-T/--output-type`, `-R/--reaches`, `--no-config`)
- `supabase --version` → 2.115.0; `--help` for `db dump`, `db diff`, `migration list`, `inspect db`, `link` (full flag surfaces transcribed in § Code Examples 1)
- `supabase status` → `linked_project: null`; `supabase/.temp/` contains only `cli-latest`; `git check-ignore -v` confirms `.next/`, `/internal`, `supabase/.temp` ignored and `.planning/` **not** ignored
- `docker info` → daemon unreachable; `which psql pg_dump` → not found; `node --version` → 24.16.0; `npm --version` → 11.13.0
- `npm install --prefix <tmp> pg@8` → 14 packages, 134 ms, repo unchanged; `require('pg')` via `NODE_PATH` → 8.23.0
- `.next/static` secret sweep → 0 hits across 6 patterns and 0 JWT-shaped strings; `.next/server` → 56 files referencing `SUPABASE_SERVICE_ROLE_KEY` by name
- Direct file reads: `src/middleware.ts` (8 protected routes; fail-open `catch`; matcher), `src/middlewareRateLimit.ts`, `src/lib/supabase/{server,service}.ts`, `src/lib/admin.ts`, `src/app/{admin,moderation}/layout.tsx` (server-side admin guards), `src/app/api/admin/calculate-popularity/route.ts` (fail-open GET+POST), `src/app/api/cron/*`, `src/app/docs/page.tsx`, `src/components/redoc/RedocUI.tsx`, `package.json`, `vercel.json`, `next.config.js`, `tsconfig.json`, `jest.config.js`, `.github/workflows/ci.yml`, `supabase/config.toml`
- `git log --all -- backend` → commit `5e7bf27` "chore: remove legacy backend directory (superseded by AI/)"; `git ls-files internal backend` → 0 files each
- `npm view knip|dependency-cruiser version engines`; `gsd-tools query package-legitimacy check`
- Read-only guard commands verified working with the `':(exclude).planning'` pathspec, including the pre-existing untracked `docs/product-master-plan.md` baseline

### Secondary (HIGH confidence — first-party vendor reference)

- Vercel CDN caching reference (via the `vercel:cdn-caching` curated skill): `x-vercel-cache` value table (`HIT|MISS|STALE|PRERENDER|REVALIDATED|BYPASS`); `set-cookie` forces `BYPASS`; request `Cookie` is not part of the cache key unless in `Vary`; `x-vercel-cache-reason` and `x-vercel-ppr-state` are **internal-only and not curl-visible**; the canonical single-path inspection command

### Tertiary (LOW confidence — vendor docs via WebFetch; re-verify at use)

- Supabase Management API `POST /v1/projects/{ref}/database/query` — body `{query, parameters?, read_only?}`, `read_only: true` prevents modification, 201 on success, requires `database:write` OAuth scope or a fine-grained token with `database_read` [CITED: supabase.com/docs/reference/api/v1-run-a-query]. Not executed against this project; see Assumption A1.

### Consumed planning inputs

`.planning/REQUIREMENTS.md`, `ROADMAP.md`, `PROJECT.md`, `STATE.md`, `config.json`; `.planning/research/{SUMMARY,STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`; `CLAUDE.md`, `.claude/CLAUDE.md`. `.planning/codebase/*` (dated 2026-03-05) treated throughout as **leads to re-verify**, never as facts — and several were verified stale (see § State of the Art). No `CONTEXT.md` exists for this phase. No project skills directory exists (`.claude/skills/` and `.agents/skills/` both absent).

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Tooling + commands | **HIGH** | Every CLI flag transcribed from `--help` on the installed version; knip, dependency-cruiser, npm read commands, `pg`, and a full `next build` were all executed here today with before/after integrity checks |
| Repo measurements | **HIGH** | All counts re-derived today; three upstream counts corrected with the derivation shown |
| Artifact schema / directory layout | **HIGH** | Derived from FEATURES.md's Finding Record Anatomy and CERT-06's explicit "data-driven from the AUDIT-03 inventory" requirement; both generators were prototyped and produced the exact expected row counts |
| Read-only invariant | **HIGH** | Empirically demonstrated across npm reads, npx tool runs, and a full production build |
| Pitfalls | **HIGH** | Each is grounded in a measurement from this repo (the non-empty git baseline, the absent Docker daemon, the `-f`-writes-a-migration help text, the placeholder CI env) plus PITFALLS.md corroboration |
| Remote-database procedure | **MEDIUM** | CLI flags verified; the Management API path is CITED but not executed; nothing was run against a real project |
| Cache-probe procedure | **MEDIUM-HIGH** | Header semantics are HIGH (first-party Vercel reference); the specific routes and the cookie-extraction step are untested against a host that has not been supplied |

**Research date:** 2026-09-14
**Valid until:** 2026-10-14 for the repo measurements (they drift the moment Phase 2 starts — re-derive in Wave 0 regardless); **7 days** for the npm registry state (`npm audit` output changes as advisories publish) and for the Supabase CLI flag surface (2.117.0 is already available).
