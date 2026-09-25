# Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability - Research

**Researched:** 2026-09-25
**Domain:** Supabase pg_cron / SECURITY DEFINER hardening, a Deno edge function's authentication, zod request contracts at Next.js 16 Route Handlers, Vercel CDN cache semantics, structured logging across the Node proxy and handlers, Sentry on Next 16 / Turbopack, a health endpoint
**Confidence:** HIGH on the codebase inventories and the database measurements (read from source; probed on the local stack inside rolled-back transactions); MEDIUM on Sentry build behaviour without an auth token and on Vercel CDN behaviour (official docs, not measured); LOW only where tagged `[ASSUMED]`

## Summary

Phase 6 closes Stage 3 with two slices. Slice 6 covers the asynchronous edge, the recommendations surface, and contracts for its own families. Slice 7 covers contracts for everything else, caching, logging, Sentry and health. Most of CONTEXT holds, but the research found **twenty-six places where CONTEXT rests on a premise that the code or the database contradicts** (§ "Corrections to CONTEXT premises"). Six of them change what the plan must build:

1. **The webhook already has a credential, and the classifier pipeline it would share a schema with does not exist.**
   - `supabase/functions/events-webhook/index.ts:201-244` already verifies an HMAC-SHA256 over the raw body, keyed by `WEBHOOK_SECRET`. It answers 500 when the secret is unset and 401 on a bad signature.
   - An `x-webhook-secret` header would be a downgrade: the secret would travel on the wire. It would also break any existing sender.
   - `src/lib/classifier-pipeline.ts` was deleted in `5879268`, and nothing in the repository sends to the function.
   - F-039's real gaps are: a length-mismatched signature answers 500 instead of 401, a signed payload can be replayed, nothing is deduplicated, and the function was deployed from a laptop.
2. **Deriving the `get_friends` subject from `auth.uid()` breaks public profiles.**
   - `src/app/users/[id]/page.tsx:134` calls `get_friends(targetId)` through the elevated door. There `auth.uid()` is NULL.
   - The fix keeps the signature and admits either the caller's own id or `auth.role() = 'service_role'`. Both values were measured.
3. **pg_cron freshness cannot be read through the elevated door as CONTEXT describes.**
   - `service_role` has no USAGE on schema `cron`, and PostgREST does not expose that schema (measured).
   - The fix is a `SECURITY DEFINER public.cron_job_status()`, granted to `service_role` only.
   - It needs an explicit revoke from PUBLIC, anon and authenticated, because the baseline's `ALTER DEFAULT PRIVILEGES` grants every new function to anon and authenticated (`baseline.sql:2716-2719`).
4. **`GET /api/events/[id]` is not public-cacheable.**
   - RLS shows pending and rejected events to their creator and to admins, and the handler returns `pending_edits` to them (`route.ts:119-138`).
   - A shared cache would serve an admin's view of a pending event to anonymous visitors, and a cached 404 to the event's own creator.
   - It must be `private, no-store`.
   - Also, `Vary: Cookie` makes Vercel refuse to cache at all (cited). F-025's "add `Vary: Cookie` for defence in depth" is therefore incompatible with public caching and must not be added.
5. **Emptying the ratchet allow-list crashes ESLint.** Measured: flat config `files: []` throws `Key "files": Expected value to be a non-empty array`. The override block in `eslint.config.mjs:110-128` must be removed or guarded in the same commit that deletes the cron routes.
6. **`@sentry/nextjs` latest is 11.0.0, published 2026-09-23.**
   - v11 replaces `sendDefaultPii` with `dataCollection`, whose **defaults collect user info, cookies and HTTP bodies**. It also moves `withSentryConfig` to `@sentry/nextjs/config`.
   - CONTEXT's decided scrubbing posture is a v10 knob.
   - Pin **10.75.3**, the current v10 line, which supports Next 16 and Turbopack.

**Primary recommendation:** Run slice 6 then slice 7 as CONTEXT orders.

- **One wrapper.** Build a single route wrapper, `withRoute({ cache }, handler)` in `src/server/route.ts`. It carries the try/catch, the request id (read from a proxy-set `x-request-id` into AsyncLocalStorage), the `Cache-Control` class, the JSON logger and Sentry capture. That one census satisfies F-058, REFAC-19 and REFAC-20 together.
- **One migration.** Put the database half in one fix-forward migration, marked `[BLOCKING]` and local-only: the three cron schedules, the revokes, the search-path pins (by `ALTER FUNCTION`, with no body rewrite of the scoring formula), the friends predicates and `cron_job_status()`. pgTAP must pin each fix in both directions.
- **Pins.** Pin `zod@4.6.5` and `@sentry/nextjs@10.75.3` exactly. Both carry the legitimacy seam's `too-new` flag: it is a 30-day age rule on the latest release, not a provenance problem.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Area 1 — Slice 6: the asynchronous edge (REFAC-14)
- **Dead cron handlers are deleted, not credentialed.** Research must confirm from `vercel.json` (no `crons` key) and the pg_cron inventory that nothing calls `/api/cron/send-reminders` and `/api/cron/send-feedback-requests`; F-037 says they duplicate live pg_cron functions with divergences and F-038 says no email is sent anywhere. Default: delete both route files (closes F-002 and F-037, empties `eslint.elevated-allowlist.mjs` to zero — record the ratchet diff). If research finds a live caller, the fallback is the FO-04 fail-closed shape through a validated optional `CRON_SECRET` reader with a constant-time compare.
- **pg_cron schedules become repository truth.** A fix-forward migration declares the three production pg_cron jobs (F-042; local `supabase/config.toml` must enable `pg_cron`), revokes anon/authenticated EXECUTE on `compute_user_scores`, `send_event_reminders`, `send_feedback_requests` (F-075), pins `search_path` on the SECURITY DEFINER functions (F-076), and makes `get_friends`/`get_friends_going_to_event` derive the subject from `auth.uid()` (F-074). pgTAP proves each. `[BLOCKING]` local schema task as in Phase 5. Local-only until DI-23; the completion note lists them.
- **The events webhook edge function requires a credential.** `supabase/functions/events-webhook` runs with `verify_jwt` off (F-039), so it must verify its own shared secret: an `x-webhook-secret` header compared constant-time against a function secret, 401 otherwise, plus payload validation with the same zod schema the classifier pipeline uses (Area 2). Deno tests if `deno` is available locally (research checks); otherwise the handler's pure verification function is extracted and tested under Jest. Deploying the function is an owner action (recorded), never done here.
- **Recommendations are characterized, not changed.** Table-driven PRESERVE suites pin input → ranked output for `/api/recommendations` (and `batch`, `feedback`, `analytics`) through the fake, with the scoring weights (0.35/0.25/0.20/0.15/0.05) and MMR asserted unchanged; F-041 (empty `user_event_scores` → popularity fallback) is pinned as today's behaviour and its cause recorded for Phase 8's operational drill; F-017 (A/B assignment silently degrades for non-admins) is fixed by writing `experiment_assignments` through the elevated door with a REGISTRY row, so assignment works for every caller (INTENTIONAL BEHAVIOUR CHANGE).
- **F-028 remainder.** `notifications/count` → 401 for anonymous; `GET /api/events/[id]/rsvp` and `GET /api/clubs/[id]/events` stay 200 for anonymous but become `private, no-store` (Area 3). F-092 (`GET /api/admin/reports` PostgREST embed 500) is fixed here by correcting the select; slice 6 owns the admin-family adjacency.
- **Email.** No provider is added: the "email reminders" Validated bullet is contradicted by F-038 and stays a recorded product gap for the owner; in-app notifications are the delivered channel.

#### Area 2 — Contracts (REFAC-15, REFAC-16)
- **zod is installed** (exact pin, latest stable, legitimacy bundle recorded non-blocking — it is the ecosystem standard; DEC-59's rule-resolution pattern applies). Schemas live in `src/contracts/<family>.ts` (events, clubs, users, admin, notifications, recommendations, interactions, feedback, webhook), exported with `z.infer` types.
- **One boundary helper.** `readJsonObject()` from Phase 5 gains a `parseBody(request, schema)` sibling in `src/server/body.ts` that returns the seam's discriminated result; the 400 shape stays the existing vocabulary `{ error: <message>, field: <first invalid path> }` so PRESERVE pins hold; a handler whose 400 text changes gets a DEFECT test citing REFAC-15 and a ledger row. Query-string parsing uses the same schemas (`z.coerce`). No handler parses raw JSON after this phase — a census gate (`scripts/check-contracts.mjs`) fails on `request.json()` outside `src/server/body.ts`.
- **Client reuse.** Hooks under `src/hooks/` and the fetch call sites in components import the request/response schemas from `src/contracts/` for typing (`z.infer`) and parse responses in development only (a `safeParse` that logs, never throws in production), so client and handler cannot drift without a type error.

#### Area 3 — Slice 7 caching (REFAC-19)
- **The blanket header goes.** `vercel.json` loses the `/api/(.*)` `Cache-Control`. A `cachePolicy` helper in `src/server/http.ts` sets `Cache-Control: private, no-store` on every response of a personalized or auth-gated route and `public, s-maxage=60, stale-while-revalidate=300` explicitly on the routes the endpoint contract classifies public-cacheable (events list/detail/popular/happening-now/featured, public club pages' data, `/api/health` liveness only). The classification is data-driven from `.planning/audit/inventory/endpoints.json` (`personalization`/auth columns) and a census test asserts every route file calls the helper.
- **Cross-user cache regression test.** Playwright: user A fetches a personalized route, user B fetches the same URL, assert B never receives A's data and every personalized response carries `private, no-store`; a header sweep across all routes from the endpoint table. Closes F-025, F-026, DI-26.

#### Area 4 — Observability (REFAC-20, REFAC-21, REFAC-22)
- **Logger: hand-rolled, no dependency.** `src/server/log.ts` emits one JSON line per event (`level`, `msg`, `requestId`, `route`, `ts`, extra fields), works on Node and in the proxy, and replaces every `console.*` in server code (routes, `src/server/`, `src/lib/` server modules, the proxy, the callback) mechanically; the request id comes from `createRequestContext()` and is echoed as an `x-request-id` response header. Client components keep `console` (out of scope). `logAdminAction`'s error line moves to the logger.
- **Sentry.** `@sentry/nextjs` exact pin (legitimacy bundle, rule-resolved). Decided BEFORE install: `sendDefaultPii: false`; `beforeSend` strips emails, cookies, request bodies and query strings, keeps a hashed user id; `environment` from `VERCEL_ENV`, `release` from `VERCEL_GIT_COMMIT_SHA`; the request correlation id attached as a tag on every event; DSN absent → Sentry disabled with one log line (never fails boot); Turbopack-aware setup per `node_modules/next/dist/docs/` (`instrumentation.ts` `register()` + `onRequestError`, `instrumentation-client.ts`); source-map upload needs `SENTRY_AUTH_TOKEN` — configured as an owner action, the build must succeed without it. The "deliberately triggered error appears in Sentry with the correlation id" clause is proven locally with the SDK's transport mocked (event payload asserted) and recorded as a human-verify item for the first real DSN.
- **Health.** `/api/health` returns a documented shape (`docs/health.md`): anonymous callers get liveness only `{ status, version }`; the full report (`checks.db`, `checks.auth`, `checks.storage`, `checks.pg_cron` last-run age, `checks.webhook` last receipt) requires `requireRole(ctx, "admin")` or a validated optional `HEALTH_TOKEN` bearer for uptime monitors; `getSession()` is removed (the one remaining call). pg_cron freshness comes from `cron.job_run_details` through the elevated door with a REGISTRY row; last webhook receipt from the newest event whose source is the scraper (no new table). Closes F-029. Always `private, no-store`.

#### Area 5 — Close-out and discipline
- **Slice order:** 6 (async edge + contracts for its families) → 7 (contracts for everything else, caching, logger, Sentry, health). Each slice: characterize → refactor → floor (Jest, pgTAP, Playwright, ratchet, tag gate, `scripts/check-contracts.mjs`) → close note; the phase completion note re-confirms all 16 Validated workflows.
- **F-054 `/docs` public** is gated behind `requireRole admin` (INTENTIONAL, low risk); **F-055 CSP** gets `'unsafe-eval'` removed if the build allows it and a nonce-based script policy only if Next 16 supports it without breaking hydration (research decides; otherwise DI to Phase 8); **DI-21** adds the local Supabase origin to `connect-src` only in development builds. **F-058/F-059:** the shared error vocabulary from the seam replaces internal error text at the forty sites; every handler wrapped by the seam's try/catch with the logger.
- **F-084/F-085** (Low): fix if a one-place change exists, otherwise re-point to Phase 7 with a note. **DI-53** (supabase-js minor): retype the four admin payload sites in slice 7, then take the bump as the last code change after a throwaway-worktree tsc proof.
- **Numbering:** DEC-60+, DI continues after the register's highest (the Phase 5 fixer proposals DI-61..77 are registered or dropped first), F-093+. `findings.json` edited surgically. Owner checkpoints resolved by rule with the completion note listing them. No production write; the deploy-facing prerequisites (Sentry DSN and auth token, webhook secret, Upstash) are Phase 8 owner actions.

### Claude's Discretion
- File names and family split under `src/contracts/`; the exact logger field set; commit grouping of the `console.*` sweep; how the cache classification is encoded (a generated map versus per-route calls), provided the census test exists.

### Deferred Ideas (OUT OF SCOPE)
- An email provider (F-038): owner/product decision; not part of the foundation program.
- Nonce-based CSP if Next 16 hydration cannot carry it without regressions (DI to Phase 8).
- `@supabase/ssr` major (Phase 8), storage bucket policies (Phase 8), DI-39/DI-40/F-078/DI-41 (owner).
- Replacing the hand-rolled logger with pino/OpenTelemetry (later milestone).

Also from the CONTEXT phase boundary, out of scope: production writes of any kind (migration repair is Phase 8, DI-23), the certification datasets and persona matrix (Phase 7), storage bucket policies (Phase 8, DI-33 bucket half).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFAC-14 | Cron and webhook routes require credentials and fail closed when absent; recommendation API characterized with the scoring formula unchanged | § Inventory A (no caller of either cron route, three independent lines of evidence plus `email_reminder_log` = 0 rows in production); § Inventory B (definer functions, grants, measured anon reach); C1/C2 (the webhook already has HMAC; what is actually missing); C5/C6 (friends predicate; the formula is pinned by `md5(prosrc)`); § Inventory H (recommendations, F-017 measured) |
| REFAC-15 | Every handler validates input with a zod schema at its boundary; consistent 400 shape; schemas in `src/contracts/` | § Inventory C (21 raw `request.json()` sites in 19 files, 15 `readJsonObject` sites, 5 `formData()` sites, 59 `searchParams` reads, and every 400 message by file:line); C10/C11/C12 (field emission, business-rule 400s stay, census scope); Pattern 2 |
| REFAC-16 | Contracts exported and reused by client hooks | § Inventory D (URL → caller map, 73 files, 8 hooks); Pattern 2b (type-level reuse, response parse in development only) |
| REFAC-19 | Blanket `s-maxage=60` removed; personalized `private, no-store`; public opt in; cross-user cache test | § Inventory E (94-row classification with corrections C7/C8/C9); Vercel CDN cacheability rules [CITED]; Pattern 3; Validation § cross-user test design |
| REFAC-20 | Structured JSON logger with levels and request correlation id on Node and proxy runtimes | § Inventory F (≈160 server `console.*` calls in 55 files; 42 test files spy on console); proxy is Node by default [VERIFIED docs]; C19 (the request id is minted in two places today); Pattern 4 |
| REFAC-21 | Sentry, Turbopack-aware, source maps, env/release tags, PII scrubbing decided before install; triggered error visible with correlation id | § Standard Stack (10.75.3 vs 11.0.0, C15); Pattern 5; the Package Legitimacy Audit (the `@sentry/cli` postinstall); the transport-mock test design |
| REFAC-22 | `/api/health` checks DB, auth, storage, pg_cron freshness, last webhook receipt; documented shape; no `getSession()` | § Inventory G (389-line route taken apart); C4 (`cron_job_status()`), C18 (the `/health` page consumer), C23 (what "webhook receipt" can honestly mean); local `/auth/v1/health` and `/storage/v1/status` answer 200 [VERIFIED] |
| REFAC-23 | Playwright happy-path specs pass after each slice; Validated list re-confirmed | § Validation Architecture (floor commands, new specs, the `bypassCSP` removal that C13 makes possible) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Effect on this phase |
|---|---|---|
| Next.js 16; the file is `src/proxy.ts`, never `middleware.ts`; read `node_modules/next/dist/docs/` before asserting an API | CLAUDE.md | The proxy runs on the **Node.js runtime by default** and a `runtime` export throws [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:255`]. So a Node logger with `AsyncLocalStorage` works in the proxy |
| `PROTECTED_ROUTES` is the only authority; `e2e/fixtures.ts` re-derives it by regex | CLAUDE.md | The array is at **`src/proxy.ts:207`**, not `:114` (a stale CLAUDE.md fact, DI-46 family). Keep it on one line; the logger adds nothing between `createServerClient` and `getUser` (CONTEXT § Specific Ideas) |
| Three Supabase clients; `createServiceClient()` only through `src/server/db/elevated/` (ESLint boundary) | CLAUDE.md, `eslint.config.mjs` | New elevated reads (F-017 experiments, health `cron_job_status`) go through `getElevatedClient()`, each with a REGISTRY row |
| Jest only, two projects (node: `src/**/*.test.ts` minus hooks; jsdom: `*.test.tsx` + `src/hooks/**`); test files are type-checked; route handlers typed as `(typeof import(".../route"))["GET"]`; never widen a route signature | CLAUDE.md, `jest.config.js` | The wrapper must preserve each handler's exact parameter types (Pattern 1). Wrapped exports must satisfy `.next/types/validator.ts` `RouteHandlerConfig` [VERIFIED] |
| Never modify `.env.local`; McGill email enforcement stays | CLAUDE.md | New variables (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `HEALTH_TOKEN`) are documented in `.env.local.example` and as Phase 8 owner actions |
| API errors: `NextResponse.json({ error }, { status })`, 400/401/403/404/500; log before error returns | .claude/CLAUDE.md | The seam's `errors.ts` already emits these bytes; the logger replaces `console.error` |
| Behaviour preservation; tested vertical slices; INTENTIONAL BEHAVIOUR CHANGE in commit bodies; wire bytes change only under a DEFECT naming an F-nnn | .claude/CLAUDE.md, CONTEXT | Every 400-text change, every 500-body change (F-059) and the JSON-500-for-uncaught-throws change (F-058) needs a DEFECT pin and a ledger row |
| Migrations fix-forward and local-only; production never touched; no interactive DB sessions | CONTEXT, orchestrator | pgTAP via `supabase test db --local`; probes via `docker exec -i supabase_db_Event-Radar psql -U postgres -v ON_ERROR_STOP=1 -f` |
| Explicit `git add` paths (untracked `.agents/`, `docs/product-master-plan.md`, `skills-lock.json`); `use_worktrees=false`; no `timeout` binary on macOS | memory, CONTEXT | Plans list paths; long commands use Playwright/Jest timeouts rather than `timeout` |
| React 18.3 pinned; React 19 out of scope | .claude/CLAUDE.md | `@sentry/react` (a dependency of `@sentry/nextjs`) accepts React 18 [ASSUMED from its peer range; verify at install] |

---

## Corrections to CONTEXT premises (planner inputs — read first)

Each row is something CONTEXT asserts or assumes that the code, the database or the vendor documentation contradicts. **The planner should treat each "Recommended handling" as the default, logged as a rule-resolved deviation (DEC-60+), unless the owner signs otherwise.**

| # | CONTEXT premise | What is actually true (evidence) | Recommended handling |
|---|---|---|---|
| C1 | "payload validation with the same zod schema the classifier pipeline uses" | `src/lib/classifier-pipeline.ts` **does not exist**. It was deleted in `5879268` ("chore: remove dead lib code (kmeans, classifier-pipeline, image-upload)"). `git grep` finds no sender of `events-webhook` anywhere in the tree. The only related type is `ExtractedEvent` in `src/lib/classifier.ts:28-40` ("compatible with the events-webhook WebhookEvent"), which the manual create/edit UI uses. Production ingestion on 2026-09-16 inserted rows directly, not through the webhook (memory note) | Put the schema in `supabase/functions/_shared/webhook-contract.ts`, which Deno and Jest can both import (Pattern 6). `src/contracts/webhook.ts` re-exports it, and `ExtractedEvent` becomes its `z.infer` [VERIFIED: git log, git grep] |
| C2 | "it must verify its own shared secret: an `x-webhook-secret` header compared constant-time" | The function **already authenticates**. It reads `WEBHOOK_SECRET` and answers 500 if unset (`index.ts:201-213`). It requires one of `x-signature`, `x-hub-signature-256`, `x-webhook-signature`, else 401 (`:216-229`). It computes an HMAC-SHA256 over the **raw** body and compares with `crypto.timingSafeEqual`, else 401 (`:232-244`). A plain shared-secret header would be weaker: the secret travels on every request and never expires. It would also break any sender the deployed function has. F-039 is registered against the missing **replay protection and dedupe** plus the laptop deploy, not a missing credential. Measured defects: (a) `timingSafeEqual` throws on unequal lengths, so a wrong-length signature answers **500**, not 401 (a length oracle); (b) a replayed valid payload inserts again; (c) `events.content_hash` has a UNIQUE partial index (`idx_events_content_hash`, measured) that the function never populates | Keep HMAC. Extract `verifySignature(rawBody, header, secret)` as a pure function that checks the length first and returns 401 on mismatch. Compute `content_hash` with `src/lib/contentHash.ts`, which is portable Web Crypto, so a replay hits the unique index and is refused. That meets F-039's "replay … rejected" criterion with no new table. Validate each event with the shared zod schema. A signed-timestamp window changes the signing contract for an external sender; register it as a DI for the owner. The CI deploy is an owner action (Phase 8) [VERIFIED: source + `pg_indexes` probe] |
| C3 | "local `supabase/config.toml` must enable `pg_cron`" | No config key exists or is needed. `pg_cron` is in the local image's `shared_preload_libraries` (measured). Extension 1.6.4 is already installed in `pg_catalog` by `20260915230100_cron_compute_user_scores.sql`. `cron.database_name = postgres`, and the launcher backend is running. `supabase db reset --local` applies the migration that creates the extension and the jobs | Declare the two missing jobs in a new migration, following the idempotent unschedule-if-exists pattern at `20260915230100:39-51`. No `config.toml` change [VERIFIED: local probe] |
| C4 | "pg_cron freshness comes from `cron.job_run_details` through the elevated door" | `has_schema_privilege('service_role','cron','USAGE')` = **false** (measured), and PostgREST exposes only the configured API schemas. So `getElevatedClient().schema("cron")` cannot read it. Also, `baseline.sql:2716-2719` `ALTER DEFAULT PRIVILEGES … GRANT ALL ON FUNCTIONS TO anon, authenticated`: **every new function in `public` is anon-executable unless revoked** | Add `public.cron_job_status()`, `SECURITY DEFINER SET search_path = ''`, returning `jobname, schedule, active, last_start, last_status`. `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`. Health calls it through the door (REGISTRY row). In production the function is absent until DI-23, so a `PGRST202` must map to `pg_cron: { status: "unknown" }`, never 500. Regenerate `src/lib/supabase/types.ts` in the same commit, because the RPC appears in the types [VERIFIED: probe] |
| C5 | "`get_friends`/`get_friends_going_to_event` derive the subject from `auth.uid()`" | Seven callsites pass the subject. Six pass the caller's own id on the cookie client: `clubs/friends/route.ts:17`, `events/[id]/invite/route.ts:35`, `events/friends-activity/route.ts:18`, `events/friends-organizing/route.ts:19`, `users/me/friends/route.ts:18`, `profile/page.tsx:55`, plus `events/[id]/friends/route.ts:25` for the event variant. **`src/app/users/[id]/page.tsx:134` calls `elevated.rpc("get_friends", { target_user_id: targetId })`** for another user's public profile. Under service_role `auth.uid()` is NULL (measured), so a pure `auth.uid()` subject empties every public profile's friend list, which is a Validated surface. Measured: `auth.role()` returns `service_role` for the door and `authenticated` for users | **Keep both signatures** (no call-site or types change). Rewrite the bodies with `SET search_path = ''` and schema-qualified relations, adding the predicate `(target_user_id = (SELECT auth.uid()) OR (SELECT auth.role()) = 'service_role')`. `REVOKE EXECUTE … FROM PUBLIC, anon`. pgTAP: anon denied; A asking for B gets 0 rows; A asking for A gets A's friends; service_role asking for B gets B's friends [VERIFIED: probe] |
| C6 | F-076: pin `search_path` "on the SECURITY DEFINER functions" (F-076's fix text: `''` plus schema-qualify every body) | Rewriting `compute_user_scores`'s 150-line body to qualify ten relations risks the formula REFAC-14 says must stay unchanged. `anon`, `authenticated` and `service_role` all lack CREATE on `public` (measured), and the in-tree precedent `is_admin`/`is_club_owner` uses `search_path=public`. F-076's own validation criterion is "proconfig contains a search_path entry for every definer function" | Use `ALTER FUNCTION public.compute_user_scores() SET search_path = public, pg_temp` (same for the two reminder functions). **No body change.** pgTAP pins `md5(prosrc)` = `ed64959b44c9329a1212cde928810010` (compute), `483c628528e964ff01887a9ab91ac0d4` (reminders), `c69a62ad437efb7e875517f6b94c3b4b` (feedback), measured today. Only the two friends functions are rewritten (C5). One pgTAP assertion iterates every `prosecdef` function in `public` and requires a `search_path` entry [VERIFIED: probe] |
| C7 | Public-cacheable: "events list/**detail**/…" | `GET /api/events/[id]` is **viewer-dependent**. events SELECT policies `Admins can view all events` and `Organizers can view own events` (measured) let an admin or the creator read pending and rejected rows through the cookie client, and `route.ts:119-138` returns `pending_edits` to the creator and admins only (F-086). Vercel keys the cache on the URL, not the cookie [CITED: vercel.com/docs/caching/cdn-cache], and caches 404s. The consequences: an admin's 200 on a pending event is served to anonymous visitors, and an anonymous 404 is served to the creator. `GET /api/clubs/[id]/events` has the same shape: members see pending events (`route.ts` "Any club member … sees the full listing") | `events/[id]` GET → `private, no-store`. So are `clubs/[id]/events` and `events/[id]/rsvp` GET (CONTEXT already has these two). The public set is the viewer-independent reads that filter `status = 'approved'` explicitly (§ Inventory E) [VERIFIED: pg_policies + source] |
| C8 | Area 3 lists "`/api/health` liveness only" as public-cacheable; Area 4 says "Always `private, no-store`" | CONTEXT contradicts itself. A CDN-cached liveness answer masks an origin outage for up to 60 s plus 300 s of stale-while-revalidate | `private, no-store` on every health response (Area 4 wins) |
| C9 | Public routes get "`public, s-maxage=60, stale-while-revalidate=300`" | Three routes set their own values today. `/api/events` sets `public, s-maxage=30, stale-while-revalidate=60` (`route.ts:526`). `/api/events/featured` (`:29`) and `/api/clubs/featured` (`:28`) set `public, s-maxage=60, stale-while-revalidate=120`. A function header overrides `vercel.json` [CITED], so these are the values production serves today | Use named policies: `public-60-300` (the eight routes that inherited the `vercel.json` value), `public-30-60` (`/api/events`), `public-60-120` (the two featured routes). The bytes do not change. DI-26's "`/api/events`' own `s-maxage=30`" closes as "kept, now explicit" |
| C10 | "the 400 shape stays … `{ error, field: <first invalid path> }` so PRESERVE pins hold" | About **130** 400 sites exist (§ Inventory C); **four** emit `field` today: `events/create:49` (`start_date`), `events/create:82` and `events/[id]:296` (`dateError.field`), `admin/users/[id]:51,80` (`roles`, `name`). **9** tests assert an exact `toEqual({ error })` 400 body (for example `events-list-characterization.test.ts:315`, `club-links.test.ts:106,170`), and the table-driven PRESERVE suites pin more. Emitting `field` everywhere changes bytes on every one | `parseBody`/`parseQuery` emit `field` **only** where the call site names it (`{ fieldFor: ["start_date"] }`). Everywhere else the body stays `{ error }`. The first issue's `message` must equal today's text, which works through zod 4 per-schema `error` strings, and key order in the schema must follow today's check order (zod reports issues in shape order) |
| C11 | "every handler validates input with a zod schema" (implied: all 400s move) | About a third of today's 400s are **business rules evaluated after a database read or a guard**, for example "You already own this club" (`clubs/[id]/transfer:48,72`), "This event has no pending edits" (`admin/events/[id]/edits:69`), "Cannot ban your own account" (`admin/users/[id]/ban:67`), "Reviews can only be submitted after the event has ended" (`events/[id]/reviews:62`). Guards run **before** the body is read in the write handlers (401/403 precede 400) | Schemas carry shape and format only. Business-rule 400s stay in the handler, using `badRequest()`. `parseBody` is called after the guards, where `readJsonObject` sits today |
| C12 | The census gate fails on "`request.json()` outside `src/server/body.ts`" | Raw input also enters through **5** `request.formData()` routes (`clubs/banner`, `clubs/logo`, `events/upload-image`, `profile/avatar`, `profile/banner`) and **59** `searchParams.get/getAll/has` reads in 29 route files. A `request.json()`-only gate would pass with most query input unvalidated | `scripts/check-contracts.mjs` fails on: `request.json()`/`req.json()` outside `src/server/body.ts`; `.formData()` outside `src/server/body.ts` (`parseForm`, which validates non-file fields with zod and keeps the per-route file type and size checks); and `searchParams.get(` in `src/app/**/route.ts` (query input goes through `parseQuery`). `auth/callback`'s four OAuth params are exempted by name, with a reason |
| C13 | "DI-21 adds the local Supabase origin to `connect-src` only in development builds" | The Playwright harness runs **`npm run build && npm run start`** (`playwright.config.ts:126`), i.e. `NODE_ENV=production`, and sets `bypassCSP: true` (`:110`) *because* the local origin is missing (`:58-61`). A development-only entry leaves the harness unable to test the CSP, and so unable to prove that removing `'unsafe-eval'` breaks nothing | Derive the Supabase origin from `NEXT_PUBLIC_SUPABASE_URL` when `next.config.js` is evaluated (build time): `new URL(url).origin` plus its `ws(s):` twin. Production builds get the project's own `*.supabase.co` origin, which is already admitted, so nothing changes. The harness build gets `http://127.0.0.1:54321`. Then set `bypassCSP: false`, and the 91 specs become a CSP regression suite [VERIFIED: playwright.config.ts] |
| C14 | "empties `eslint.elevated-allowlist.mjs` to zero" | Measured with ESLint 9.39.1: a flat-config object with `files: []` makes ESLint **throw** `TypeError: Key "files": Expected value to be a non-empty array`. `eslint.config.mjs:119` spreads `LEGACY_ELEVATED_CALLSITES` into `files`. Deleting the two cron routes plus regenerating the list would break `npm run lint` and CI | In the deletion commit: remove the override block (`eslint.config.mjs:110-128`), or guard it with `...(LEGACY_ELEVATED_CALLSITES.length ? [{…}] : [])`. Keep the generated file with an empty array so `check-elevated-ratchet.mjs` still reports `committed=0 live=0` [VERIFIED: scratch ESLint run] |
| C15 | "`@sentry/nextjs` exact pin … `sendDefaultPii: false`" | `npm view`: latest is **11.0.0, published 2026-09-23**. v11's migration guide says: `sendDefaultPii` is replaced by `dataCollection`; "an unset `dataCollection` collects everything by default" (userInfo, cookies, httpBodies all on); `withSentryConfig` moves to `@sentry/nextjs/config`; Node ≥ 20.19. 10.75.3 (2026-09-23, v10 maintenance) keeps `sendDefaultPii` (default restrictive) and peers `next ^16.0.0-0` [CITED: docs.sentry.io migration v10-to-v11] | Pin **`@sentry/nextjs@10.75.3`**. CONTEXT's decided posture maps one-to-one onto v10. Taking v11 two days after release, with inverted PII defaults, is the risk "PII scrubbing decided before install" exists to avoid. Record v11 as a Phase 8+ upgrade DI |
| C16 | DI-50 (the transfer rollback does not restore the target's role) is open, Phase 6 | **Already fixed** by `9daa291` (REVIEW-05 WR-02): `src/app/api/clubs/[id]/transfer/route.ts:116-124` rolls back with `.update({ role: targetMember.role })` and logs a failed rollback | Close DI-50 by record in the DI register, citing `9daa291`. No code |
| C17 | The carried DI list is DI-21, 25/53, 26, 33, 43, 44, 45, 47, 50, 59 | `PHASE-5-COMPLETION.md` § 9 also assigns **DI-55** (layouts decide admin by role only), **DI-56** (`/users/[id]` soft 404) and **DI-58** (stale generated contract text in `endpoints.json`) to Phase 6. The fixer proposals DI-61..77 (`05-REVIEW-FIX.md:224-249`) propose Phase 6 for DI-61, 62, 64, 66, 68, 69, 71, 72, 73, 74, 75, 76, 77 | The first plan registers or drops DI-61..77 (CONTEXT says so) **and** dispositions DI-55/56/58. Several fold in naturally: DI-64 and DI-66 (input validation) go to the contracts work; DI-73 (raw DB error text) is F-059; DI-58 is the `endpoints.json` regeneration the cache census needs anyway |
| C18 | Anonymous callers get `{ status, version }` only | **`src/app/health/page.tsx`** (350 lines, public, no layout guard) fetches `/api/health` every 30 s and renders `healthData.checks.*` including `azure_oauth` and `memory` (`:44-46,:123-141,:259`). After the change, an anonymous visitor's page would crash on `Object.values(undefined)` | Gate `/health` with an admin layout (the shape of `src/app/admin/layout.tsx`) and rewrite its type to the documented shape. That is INTENTIONAL (the page becomes admin-only). Not a Validated workflow; `scripts/smoke.sh:270` only checks 200 on the API |
| C19 | "the request id comes from `createRequestContext()` and is echoed as an `x-request-id` response header" | `createRequestContext()` mints `crypto.randomUUID()` itself (`src/server/context.ts:78`), and the proxy has no id. A proxy log line and a handler log line for the same request would carry different ids, and routes that never call the context (public reads) would have none | The proxy sets `x-request-id` **on the request headers** before `createServerClient` (it always overwrites, and never trusts a client-supplied value). `NextResponse.next({ request })` forwards request headers as `x-middleware-request-*` [VERIFIED: `next/dist/server/web/spec-extension/response.js:24-40`]. The proxy also sets the header on every response it builds itself (429, 403, 500, redirects). The route wrapper reads it, falls back to a fresh UUID (the matcher skips `auth/callback` and image-suffixed paths), and runs the handler inside `AsyncLocalStorage`. `createRequestContext()` reads the id from that store |
| C20 | F-059 "the forty sites" | Measured today: **32 sites in 19 route files** return a caught error's text, 9 of them in `health/route.ts`. Phase 5 removed the rest | The F-059 grep gate is the validation. Each changed 500 body is a DEFECT citing F-059 (at least `search-escaping-defect.test.ts:176` pins `PGRST100.message`) |
| C21 | F-075: revoke "anon/authenticated" | The finding's fix text says "service_role retains EXECUTE for the cron routes that call them over HTTP". No cron route calls them (the HTTP handlers reimplement the logic in JS). But `recommendations/batch/route.ts:20` calls `compute_user_scores` through the **elevated** door (REGISTRY row). pg_cron runs jobs as `username = postgres` (measured), so revokes cannot stop it | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on all three. Keep `service_role`. Measured today: `SET ROLE anon; SELECT public.send_event_reminders()` **succeeds** |
| C22 | F-084/F-085: "fix if a one-place change exists" | **F-085 has one:** `src/app/api/users/saved-events/route.ts:90` `gte("start_date", new Date().toISOString())` → `getESTNowISO()`, the floor `/api/events` uses (`route.ts:379`). Its DEFECT suite `saved-events-time-floor-defect.test.ts` moves. **F-084 has none that meets its criterion**, which requires a pgTAP case on `events.rsvp_count` (drop or trigger). The column's only reader is the CSV export (`export/route.ts:12,32,231`) | Fix F-085 in slice 7 (INTENTIONAL: saved-events "upcoming" agrees with the feed). Re-point F-084 to Phase 7 (schema half) with a note |
| C23 | "last webhook receipt from the newest event whose source is the scraper" | Nothing sends to the webhook (C1). `events.source` is constrained to `manual`, `instagram`, `admin` (`events_source_check`, measured); the webhook writes `instagram` only when `source_url` is present (`index.ts:179`). Locally every event is `manual`, so the value is `null` | Name the field honestly, `checks.webhook = { last_ingest_at: <max(created_at) where source = 'instagram'> | null }`. `docs/health.md` says it measures the last scraper-sourced insert by any path, not delivery through the edge function. No status threshold (informational) |
| C24 | "F-037 … closed by deleting the handlers" | Deleting the handlers leaves divergence #3 of F-037 **live in production**: `send_event_reminders()` has no `deleted_at IS NULL` and no `status = 'approved'` filter (`baseline.sql:379-445`; inventory § 1.3), so it reminds users about soft-deleted and unapproved events | Register **F-093** (Medium). The planner decides whether slice 6's migration fixes it with `CREATE OR REPLACE` and the two filters, as a DEFECT pgTAP then fix, INTENTIONAL. That would retire C6's md5 pin for this one function. The alternative is to re-point it. Recommendation: fix it, because it is the same function in the same migration and REFAC-14 is the async-edge requirement |
| C25 | "the pg_cron inventory" shows what to declare | The production commands are **not** uniformly cased: `select public.send_event_reminders()` (lower) and `SELECT public.send_feedback_requests()` (upper) [VERIFIED: `.planning/audit/async/cron-job.json`]. `030-cron-schedule.test.sql` asserts literals byte-for-byte | Copy both commands and schedules (`*/15 * * * *`, `*/30 * * * *`) byte-identically from `cron-job.json`, and extend the 030 pattern to the two new jobs |
| C26 | `logAdminAction` and every server `console.*` "moves to the logger mechanically" | **42 test files spy on `console`** (68 `spyOn(console` sites), and several assert exact arguments that are PRESERVE pins of log lines: `proxy-defect.test.ts:213,241` (`"[Middleware] Error:", failure`), `instrumentation.test.ts:113,220,248`, `audit-shape.test.ts:327`, the callback route suites. A JSON line written as `console.error(JSON.stringify(...))` breaks every `toHaveBeenCalledWith("[X] …", obj)` | The logger writes through `console.error` (error, warn) and `console.log` (info, debug), so `not.toHaveBeenCalled()` assertions keep working. Each exact-argument assertion becomes a logger-shape assertion (parse the JSON, match `msg` and fields) in the sweep commit, recorded in the defect ledger as INTENTIONAL (REFAC-20) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheduled reminders and scoring | Database (pg_cron → SECURITY DEFINER functions) | — | Already the live implementation. The Next.js cron handlers are dead duplicates (deleted) |
| RPC privilege and subject binding (friends, cron functions) | Database (grants, `auth.uid()`/`auth.role()` predicates) | API (seam guards) | Must hold with the app bypassed (direct PostgREST) |
| Webhook authentication, validation and dedupe | Edge function (Deno) | Database (`content_hash` unique index) | `verify_jwt = false` by design; HMAC is the only gate; the unique index makes a replay idempotent |
| Request validation (zod) | API (Route Handlers via `src/server/body.ts`) | Browser (types only; parse in development only) | The server is the authority; the client reuses types so the two cannot drift |
| Cache policy | API (per-handler `Cache-Control` via the wrapper) | CDN (Vercel honours function headers over `vercel.json`) | A path rule applies to the 401 as well as the 200 (F-025's note), so the handler decides |
| Request correlation id | Frontend Server (proxy sets it) | API (wrapper reads it; ALS; response header) | Only the proxy sees every request first |
| Structured logs | API + proxy (shared `src/server/log.ts`, Node runtime) | — | Vercel captures stdout/stderr lines; one JSON object per line |
| Error reporting (Sentry) | API/SSR (`instrumentation.ts`, wrapper `captureException`) | Browser (`instrumentation-client.ts`) | `onRequestError` covers uncaught SSR errors; the wrapper catches route errors itself, so it must capture them explicitly |
| Health | API (`/api/health`) | Database (`cron_job_status()`), Auth/Storage HTTP health endpoints | Liveness is public; diagnostics need an admin session or `HEALTH_TOKEN` |
| `/docs` gating, `/health` page gating | Frontend Server (Server Component layout guard) | Proxy (advisory) | The proxy is advisory (DEC-36); the layout decides |
| CSP | Frontend Server (`next.config.js` headers, build time) | — | A static policy; a nonce needs dynamic rendering of every page (deferred) |

---

## Standard Stack

### Core (already installed; versions from `node_modules` and `npm ls`)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| next | 16.3.5 | App Router, proxy (Node runtime), `instrumentation.ts` with `register`/`onRequestError` | [VERIFIED: node_modules/next/package.json] |
| @supabase/supabase-js | 2.81.1 installed (declared `^2.49.0`) | Clients | DI-53 bump target **2.116.0** (the version the Phase 5 tsc proof ran against; published 2026-09-07). The latest is 2.117.2, published **today**, so it is too new for the 30-day rule [VERIFIED: npm view] |
| @supabase/ssr | 0.7.0 | Cookie sessions | Major deferred to Phase 8 (DI-43) |
| jest / ts-jest | ^30.2 / ^29.4.6 | Unit + characterization | Two projects |
| @playwright/test | 1.63.0 | Persona harness (91 specs) | [VERIFIED: `npx playwright --version`] |
| pgTAP via `supabase test db --local` | CLI 2.115.0 | Database assertions (11 files incl. setup; floor 200) | [VERIFIED: `supabase --version`] |
| zod (transitive only) | 4.1.13 | Pulled in by `eslint-plugin-react-hooks` → `zod-validation-error` (dev tree) | Installing a direct 4.6.5 changes the dev tree's dedupe; review the lockfile diff |

### New (this phase)
| Library | Version (exact pin) | Purpose | Why this version |
|---------|---------|---------|--------------|
| zod | **4.6.5** | Request/response contracts, `z.infer` types, `z.coerce` for query strings | Latest stable (2026-09-13); published by GitHub Actions OIDC **with SLSA provenance**; 216 M weekly downloads [VERIFIED: npm view; seam] |
| @sentry/nextjs | **10.75.3** | Server/edge/client error capture, `captureRequestError`, source-map upload via `withSentryConfig` | Latest v10 (2026-09-23), peer `next ^13.2.0 \|\| … \|\| ^16.0.0-0`, `engines.node >=18`; keeps `sendDefaultPii` (C15). v10 supports Turbopack source-map upload through Next's `runAfterProductionCompile` hook (≥10.13.0, Next ≥15.4.1) [CITED: docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build, via web search, MEDIUM] |

No logging library (CONTEXT: hand-rolled). No new database extension.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @sentry/nextjs 10.75.3 | 11.0.0 | v11 has `dataCollection` per category, but its defaults collect everything and it is 2 days old. Use it only with an explicit all-false `dataCollection` baseline, as an owner decision |
| zod 4.6.5 | 4.4.3 (2026-05-04) or @sentry 10.71.0 (2026-08-24) | These clear the seam's 30-day `too-new` rule at the cost of five months (zod) or four weeks (Sentry) of fixes. Take them only if the owner-absent rule resolution prefers the cooldown |
| A per-route `cachePolicy()` call | One wrapper `withRoute({ cache })` | The wrapper also carries try/catch (F-058), the request id and Sentry. One census covers four requirements |
| A shared-secret header on the webhook | Keep HMAC over the raw body | HMAC never puts the secret on the wire; the existing senders' contract is preserved |
| Nonce CSP now | Remove `'unsafe-eval'` in production only; keep `'unsafe-inline'` | A nonce needs dynamic rendering of every page, plus a nonce on the root layout's inline theme script and the landing JSON-LD. That is a rendering-mode change to every page; deferred as a DI to Phase 8 per CONTEXT |

**Installation** (behind the legitimacy checkpoint, in a throwaway worktree first; `npm audit --omit=dev` before and after):
```bash
npm install --save-exact zod@4.6.5
SENTRYCLI_SKIP_DOWNLOAD=1 npm install --save-exact @sentry/nextjs@10.75.3   # see the @sentry/cli postinstall row below
```

---

## Package Legitimacy Audit

Seam: `gsd-tools query package-legitimacy check --ecosystem npm @sentry/nextjs zod` (run 2026-09-25). The seam evaluates the **latest** published version against a 30-day minimum age (`package-legitimacy.cjs:58`).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod (pin 4.6.5) | npm | package 6.5 yrs (2020-03-07); 4.6.5 published 2026-09-13 (12 days) | 216,515,483/wk | github.com/colinhacks/zod; 4.6.5 published by GitHub Actions OIDC with SLSA v1 provenance | [SUS] reason `too-new` (version age only); postinstall none | Flagged. Planner adds `checkpoint:human-verify`, resolved by rule per CONTEXT (DEC-59 pattern) with the evidence bundle |
| @sentry/nextjs (pin 10.75.3) | npm | package 5.5 yrs (2021-03-03); 10.75.3 published 2026-09-23 (2 days); latest 11.0.0 also 2026-09-23 | 7,541,071/wk | github.com/getsentry/sentry-javascript; publisher `sentry-bot`; no attestation on 10.75.3 | [SUS] reason `too-new`; own postinstall none | Flagged. `checkpoint:human-verify`. Record the tarball integrity against the registry (the Phase 5 upstash-legitimacy method) |
| @sentry/cli (transitive via `@sentry/bundler-plugin-core` ^5.3 → `@sentry/cli` ^2.58.5; resolves 2.58.6) | npm | — | — | github.com/getsentry/sentry-cli | **postinstall `node ./scripts/install.js`**, which fetches the platform binary when the optional `@sentry/cli-<platform>` package is absent [ASSUMED behaviour] | Flag per the protocol (a network-capable postinstall). Install with `SENTRYCLI_SKIP_DOWNLOAD=1` or confirm the optional platform package is present, and record it. The binary is used only for source-map upload, which is skipped without `SENTRY_AUTH_TOKEN` |
| sentry (unscoped, transitive of v11 `@sentry/bundler-plugins` only) | npm | — | — | github.com/getsentry/cli; maintainers `zeeg`, `sentry-bot` | not installed with the v10 pin | n/a (v11 not recommended) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** zod, @sentry/nextjs. Both are flagged for the release-cadence rule, not for identity. The planner inserts a `checkpoint:human-verify` before each install. With no owner present, CONTEXT rule-resolves them (DEC-51 made Upstash BLOCKING; CONTEXT says zod is non-blocking, and this research recommends the same treatment for Sentry with the postinstall note recorded).

---

## Architecture Patterns

### System Architecture Diagram

```
                       Browser (hooks/components: types from src/contracts, dev-only response parse)
                                  │  fetch /api/*            ▲  x-request-id, Cache-Control
                                  ▼                          │
 ┌──────────────── Vercel CDN (cache key = URL; caches only s-maxage responses w/o private/no-store/set-cookie/Authorization) ─┐
 └───────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┘
                                  ▼
 proxy.ts (Node runtime) ── rate limit ─(429+id)─► │ CSRF ─(403+id)─► │ set x-request-id on REQUEST headers │ getUser │ ban/onboarding │ log.json
                                  │ NextResponse.next({ request })  (forwards x-middleware-request-x-request-id)
                                  ▼
 withRoute({ cache }, handler) ── ALS.run({ requestId, route }) ──► handler
      │  try { guards → parseBody/parseQuery(zod, src/contracts) → cookie client / elevated door → response }
      │  catch → log.error + Sentry.captureException(tags.request_id) → serverError()
      └─ finally: set Cache-Control (private,no-store | named public policy) + x-request-id on the response
                                  │
                                  ▼
 Supabase: PostgREST (RLS) ─ elevated door (REGISTRY) ─ RPC: get_friends* (subject-bound), cron_job_status() (service_role only)
                                  ▲
 pg_cron (runs as postgres) ──► compute_user_scores / send_event_reminders / send_feedback_requests (search_path pinned; EXECUTE revoked from PUBLIC/anon/authenticated)
 External sender ──HMAC(raw body)──► events-webhook (Deno): verifySignature → zod (shared contract) → content_hash → insert pending (unique index refuses a replay)
 /api/health: anon → {status, version}; admin | HEALTH_TOKEN → db, auth (/auth/v1/health), storage (/storage/v1/status), pg_cron (cron_job_status), webhook (last_ingest_at)
 Sentry: instrumentation.ts register() → sentry.server.config (DSN absent → disabled + one log line); onRequestError = captureRequestError; instrumentation-client.ts
```

### Recommended Project Structure (additions only)
```
src/
├── contracts/                    # zod schemas + z.infer types, one file per family
│   ├── common.ts                 #   uuid, isoDate, pagination, the error-body schema
│   ├── events.ts clubs.ts users.ts admin.ts notifications.ts
│   ├── recommendations.ts interactions.ts feedback.ts health.ts
│   └── webhook.ts                #   re-export of supabase/functions/_shared/webhook-contract.ts
├── server/
│   ├── body.ts                   #   + parseBody, parseQuery, parseForm (readJsonObject stays)
│   ├── route.ts                  #   withRoute({ cache }, handler): ALS, try/catch, headers, Sentry
│   ├── log.ts                    #   JSON logger + AsyncLocalStorage request store
│   ├── cachePolicy.ts            #   named policies ("private" | "public-60-300" | "public-30-60" | "public-60-120")
│   └── observability/sentry.ts   #   scrub(), hashUserId(), captureServerError()
├── sentry.server.config.ts       # Sentry.init for Node (imported by register())
├── instrumentation-client.ts     # Sentry.init for the browser + onRouterTransitionStart
└── app/docs/layout.tsx, app/health/layout.tsx   # admin gates (F-054, C18)
supabase/
├── functions/_shared/webhook-contract.ts   # zod schema + verifySignature (pure; Deno + Jest)
├── migrations/2026092x…_async_edge_definer_hardening.sql
└── tests/database/070-definer-functions.test.sql, 031-cron-jobs.test.sql
scripts/check-contracts.mjs, scripts/check-server-console.mjs (or one census script with two modes)
docs/health.md
e2e/specs/cache-headers.spec.ts, e2e/specs/cross-user-cache.spec.ts, e2e/helpers/sharedCacheProxy.ts
```

### Pattern 1: One route wrapper that preserves the handler's type
**What:** `export const GET = withRoute({ cache: "private" }, async (request: NextRequest, { params }: RouteParams) => { … })`.
**When:** Every exported handler in `src/app/api/**/route.ts`, `auth/callback`, `auth/signout`.
**Why it type-checks:** Next 16 validates route exports against `(request: NextRequest, context: { params: Promise<…> }) => Promise<Response | void>` (`.next/types/validator.ts`, `RouteHandlerConfig`). A generic wrapper `withRoute<A extends unknown[]>(opts, fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response>` returns the handler's own parameter list, so a handler that takes `()` stays `()` and tests keep calling `GET(request, { params })`.
```typescript
// src/server/route.ts — sketch
import { NextResponse } from "next/server";
import { runWithRequest, log } from "@/server/log";
import { applyCachePolicy, type CacheClass } from "@/server/cachePolicy";
import { captureServerError } from "@/server/observability/sentry";

const ID_RE = /^[0-9a-f-]{36}$/i; // only the proxy's own UUIDs are accepted

export function withRoute<A extends unknown[]>(
  opts: { cache: CacheClass; action?: string },
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const req = args[0] instanceof Request ? args[0] : undefined;
    const incoming = req?.headers.get("x-request-id") ?? "";
    const requestId = ID_RE.test(incoming) ? incoming : crypto.randomUUID();
    const route = req ? new URL(req.url).pathname : undefined;
    return runWithRequest({ requestId, route }, async () => {
      let res: Response;
      try {
        res = await fn(...args);
      } catch (error) {
        log.error("unhandled route error", { error });
        captureServerError(error, { requestId, route });
        res = NextResponse.json({ error: `Failed to ${opts.action ?? "process request"}` }, { status: 500 });
      }
      applyCachePolicy(res, opts.cache);          // sets Cache-Control on EVERY status, 401/500 included
      res.headers.set("x-request-id", requestId);
      return res;
    });
  };
}
```
Note: an uncaught throw today answers Next's default 500. The wrapper turns it into the seam's JSON 500. That is INTENTIONAL (F-058) and needs a DEFECT/ledger row for any suite that pins the old behaviour.

### Pattern 2: `parseBody` / `parseQuery`, bytes-preserving
```typescript
// src/server/body.ts additions — zod 4 API [CITED: zod.dev/error-customization]
import type { z } from "zod";
export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export function parseWith<S extends z.ZodType>(
  schema: S, input: unknown, opts: { fieldFor?: readonly string[] } = {}
): Parsed<z.output<S>> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const issue = r.error.issues[0];                         // first issue, in shape order
  const top = typeof issue.path[0] === "string" ? issue.path[0] : undefined;
  const field = top && opts.fieldFor?.includes(top) ? top : undefined;
  return { ok: false, response: badRequest(issue.message, field) };   // { error } unless named (C10)
}
export async function parseBody<S extends z.ZodType>(request: Request, schema: S, opts?: { fieldFor?: readonly string[] }) {
  const read = await readJsonObject(request);              // keeps "Invalid JSON body" / "Request body must be a JSON object"
  return read.ok ? parseWith(schema, read.body, opts) : read;
}
export function parseQuery<S extends z.ZodType>(params: URLSearchParams, schema: S, opts?: { fieldFor?: readonly string[] }) {
  return parseWith(schema, Object.fromEntries(params), opts); // schema uses z.coerce / z.string().transform
}
```
Schemas reproduce today's text: `z.string({ error: (iss) => iss.input === undefined ? "Title is required" : "Title is required" }).trim().min(1, "Title is required")`. Put object keys in the order the handler checks them today (for `events/create`: title, description, start_date, location, tags, price, registration_url).

### Pattern 2b: Client reuse without a production cost
- Request bodies: `const body: CreateEventInput = {...}` where `CreateEventInput = z.input<typeof CreateEventBody>`. The type import is erased.
- Responses: in hooks only, run a guarded dev-only check, `if (process.env.NODE_ENV !== "production") { const r = EventsPage.safeParse(json); if (!r.success) console.warn("[contract]", r.error.issues[0]); }`. Next inlines `NODE_ENV`, so the branch is dead code in production. Whether zod itself is then tree-shaken from the client bundle is `[ASSUMED]`: verify with the build output size before and after on the heaviest page.

### Pattern 3: Cache classes (data-driven)
- `private` → `Cache-Control: private, no-store` on every status.
- `public-60-300`, `public-30-60` and `public-60-120` → set **only on GET 200/404**. The mutation arms of the same file (`clubs/[id]` PATCH/DELETE, `clubs` POST) get `private`.
- The census reads `endpoints.json` and asserts that each route file's declared class matches its `cache_policy_target` after applying C7/C8 (a checked-in override list, reasons inline).
- `vercel.json` keeps `buildCommand`, `framework` and `regions`, and loses `headers`.
- Never add `Vary: Cookie`: Vercel then refuses to cache the response [CITED], which would silently make a "public" route uncached.

### Pattern 4: Logger + AsyncLocalStorage
```typescript
// src/server/log.ts — Node runtime only (proxy is Node by default)
import { AsyncLocalStorage } from "node:async_hooks";
type Level = "debug" | "info" | "warn" | "error";
type Store = { requestId: string; route?: string };
const als = new AsyncLocalStorage<Store>();
export const runWithRequest = <T>(s: Store, fn: () => T) => als.run(s, fn);
export const currentRequestId = () => als.getStore()?.requestId;

function ser(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, code: (v as { code?: string }).code };
  return v;
}
function emit(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const s = als.getStore();
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg,
    requestId: fields.requestId ?? s?.requestId, route: s?.route,
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, ser(v)])) });
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}
export const log = { debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f) };
```
Rules: never log emails, tokens, cookies, request bodies or full query strings (the same list as the Sentry scrubber). `JSON.stringify` escapes newlines, which closes log-injection by construction. DI-45: `createRequestContext` logs `warn "auth user lookup failed"` with `{ code, status }` when `getUser()` errors with anything other than a missing session.

### Pattern 5: Sentry v10 on Next 16 (Turbopack)
```typescript
// src/instrumentation.ts (extend register(); keep the boot checks)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  await import("./sentry.server.config");      // init first; DSN absent → disabled + one log line
  /* …existing boot checks unchanged… */
}
export { captureRequestError as onRequestError } from "@sentry/nextjs";

// src/sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/server/observability/sentry";
const dsn = process.env.SENTRY_DSN;             // validated optional reader in src/lib/env.ts
if (!dsn) console.log(JSON.stringify({ level: "info", msg: "[Sentry] disabled: SENTRY_DSN is not set" }));
Sentry.init({ dsn, enabled: Boolean(dsn), sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA, tracesSampleRate: 0, beforeSend: scrubEvent });

// next.config.js
const { withSentryConfig } = require("@sentry/nextjs");   // v10 path (v11 moves it to /config)
module.exports = withSentryConfig(nextConfig, { org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN, silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } });  // build must pass without the token
```
- `scrubEvent` deletes `event.request.cookies`, `data`, `query_string` and the `headers.cookie`/`authorization` headers. It replaces email-shaped substrings in `message` and `exception.values[].value` with `[email]`, and sets `event.user = { id: <sha256(userId) computed server-side> }` only.
- The request id is attached with `Sentry.withScope(s => { s.setTag("request_id", id); Sentry.captureException(err) })` in `captureServerError`. Hash user ids synchronously with `node:crypto` so `beforeSend` never has to be async.
- Client: `instrumentation-client.ts` reads `process.env.NEXT_PUBLIC_SENTRY_DSN` (a literal access, so Next inlines it) and uses the same scrubber minus the Node hash.
- The CSP `connect-src` must admit the ingest host when the DSN is set: `https://*.ingest.sentry.io https://*.ingest.us.sentry.io`. Do **not** use `tunnelRoute`: it adds a same-origin route the proxy would run `getUser()` and a users read on for every client event, and the fix (a matcher exclusion) touches the matcher CONTEXT keeps untouched.

### Pattern 6: The webhook contract shared by Deno and Jest
`supabase/functions/_shared/webhook-contract.ts` imports only `zod` and `node:crypto`:
- `deno.json` maps `"zod": "npm:zod@4.6.5"`.
- Jest and Next resolve `zod` from `node_modules`.
- `tsc` type-checks the file through the test's import graph, so it must be strict-clean with no Deno globals.

It exports `WebhookPayload` (`event_count` equals `events.length`, via `superRefine` with today's message) and `verifySignature(raw, header, secret): boolean`. `verifySignature` returns false on a length mismatch before calling `timingSafeEqual`. `index.ts` keeps the three accepted headers and the status codes, adds `content_hash` (from a copy of `src/lib/contentHash.ts` placed in `_shared`, or an import of it) and reports a `23505` as a per-event `"duplicate"` error. Deno is **not installed** locally (`command -v deno` → none) and the `supabase_edge_runtime` container is not running, so the proof is Jest over the pure module. `supabase/functions/tests/webhook.test.ts` stays as the Deno integration suite for the owner.

### Anti-Patterns to Avoid
- **Header by path for caching.** It hits 401s and 500s too; the wrapper sets it per class on every status.
- **`Vary: Cookie` on a public route.** Vercel then refuses to cache the response [CITED].
- **Rewriting `compute_user_scores` to pin its search_path.** Use `ALTER FUNCTION … SET` (C6).
- **Creating a function in `public` without `REVOKE … FROM PUBLIC, anon, authenticated`.** The default privileges re-grant it (C4).
- **Trusting a client-supplied `x-request-id`.** The proxy always overwrites it.
- **Emitting `field` on every 400.** That breaks PRESERVE bytes (C10).
- **`tunnelRoute` for Sentry.** See Pattern 5.
- **Leaving `files: LEGACY_ELEVATED_CALLSITES` with an empty list.** ESLint crashes (C14).

---

## Inventories the plan executes against

### A. The async edge — callers and jobs [VERIFIED]
| Item | Fact | Source |
|---|---|---|
| `/api/cron/send-reminders` (164 lines), `/api/cron/send-feedback-requests` (109 lines) | POST only. Called by **nothing**: no `crons` key in `vercel.json`, and the Vercel project's `crons.definitions` is `[]`; `pg_net` is not installed, so pg_cron cannot call HTTP; no `schedule:` in CI and no `curl` in the tree; `CRON_SECRET` has never been set in production; `email_reminder_log` has **0 rows** in production | `.planning/audit/async/vercel-crons.md` § 1; `cron-webhook-inventory.md` § 2.3-2.4; `git grep api/cron` (only docs, the allow-list, a CSRF unit test) |
| References to update on deletion | `eslint.elevated-allowlist.mjs:45-46`; the `eslint.config.mjs:110-128` override (C14); `src/server/__tests__/csrf.test.ts:219` (uses the path as a fixture string only, so it is kept); `endpoints.json` rows `api.cron.*` (regenerate); `.claude/CLAUDE.md:353` (stale; owner, DI-46) | grep |
| Production pg_cron | `send-event-reminders` `*/15 * * * *` `select public.send_event_reminders()`; `compute-user-scores` `0 */6 * * *` `SELECT compute_user_scores()`; `send-feedback-requests` `*/30 * * * *` `SELECT public.send_feedback_requests()`; all run as `postgres`; jobid 3 missing | `.planning/audit/async/cron-job.json` |
| Local pg_cron | Extension 1.6.4 in `pg_catalog`; one job (`compute-user-scores`); `cron.job_run_details` 0 rows (fresh reset) | probe |
| Local side effect of declaring the reminder jobs | They run every 15/30 minutes against the dev database. The seed uses `PINNED_NOW`/horizon dates (`scripts/seed/clock.ts`), so the 23-25 h window rarely matches. A reminder insert during a Playwright run is still possible in principle | Pitfall 5 |

### B. SECURITY DEFINER functions in `public` (measured 2026-09-25)
| Function | volatility | proconfig | anon | auth | svc | Phase 6 action |
|---|---|---|---|---|---|---|
| `compute_user_scores()` (baseline:72) | v | — | **t** | **t** | t | revoke PUBLIC/anon/auth; `ALTER … SET search_path = public, pg_temp`; md5 pin |
| `send_event_reminders()` (:379) | v | — | **t** | **t** | t | same, plus the F-093 decision (C24) |
| `send_feedback_requests()` (:448) | v | — | **t** | **t** | t | same |
| `get_friends(uuid)` (:282) | s | — | **t** | t | t | rewrite: `search_path = ''`, subject predicate (C5), revoke PUBLIC/anon |
| `get_friends_going_to_event(uuid,uuid)` (:295) | s | — | **t** | t | t | same |
| `is_admin()` (:309), `is_club_owner(uuid)` (:323) | s | `search_path=public` | t | t | t | none (used by RLS for anon too; `is_admin()` returns false for anon) |
| `update_saved_events_count()`, `club_invitation_unchanged_except_status(…)`, `has_open_club_invitation(uuid)`, `is_club_member(uuid)` | — | `search_path=""` | f | f/t | t | none (Phase 3/5 shape) |

Measured reach today, as `anon` in a rolled-back transaction: `SELECT public.send_event_reminders()` **succeeds**. `compute_user_scores()` wrote 14 rows on the seed, and every row's `score` equals the sum of its breakdown parts (max residual 0.000000), which is a usable PRESERVE invariant.

### C. Input parse sites and today's 400 messages (the input to `src/contracts/`) [VERIFIED: script over 93 route files]
- **Raw `request.json()`** (21 sites, 19 files): `admin/events/[id]:21`, `admin/events:124`, `admin/experiments/[id]:86`, `admin/experiments:79`, `admin/featured/[id]:24`, `admin/featured:54`, `clubs/[id]/invites:86`, `clubs/[id]/members:102`, `clubs/[id]:82` (DELETE confirmation), `events/[id]/invite:27`, `events/[id]/reviews:33`, `events/[id]:248`, `events/[id]/rsvp:215,379`, `events/create:33`, `feedback:20`, `interactions:69`, `profile/inferred-tags:17`, `profile/interests:24`, `recommendations/feedback:111`, `users/[id]:31`.
- **`readJsonObject`** (15): `admin/clubs/[id]`, `admin/events/[id]/edits`, `admin/events/[id]/status`, `admin/organizer-requests/[id]`, `admin/reports/[id]`, `admin/users/[id]/ban`, `admin/users/[id]`, `clubs/[id]/appeal`, `clubs/[id]/members/role`, `clubs/[id]` (PATCH), `clubs/[id]/transfer`, `clubs` (POST), `events/[id]/appeal`, `events/[id]/report`, `organizer-requests`.
- **`formData()`** (5): `clubs/banner:25`, `clubs/logo:25`, `events/upload-image:18`, `profile/avatar:25`, `profile/banner:25`.
- **Query params** (59 reads, 29 files). The largest are `events` (tags, search, dateFrom, dateTo, ids, timeOfDay, dayType, page, limit, cursor), `events/export` (format, tags, search, dateFrom, dateTo, clubId, eventId, eventIds), `admin/events` (status, search, sort, direction, limit, offset, includeDeleted), `admin/reports`, `admin/organizer-requests`, `events/popular`, `recommendations` (top_k, diversity), `recommendations/feedback` (event_ids), `recommendations/analytics` (period), `notifications` (cursor, action), `users/saved-events` (sort, include_past), `users/search` (q), `calendar/events` (from, to), `clubs/trending` (limit), `admin/audit-log`, `admin/clubs`, `admin/organizers`, `admin/calculate-popularity` (event_id), `auth/callback` (code, next, error, error_description).

**Today's 400 texts by route** (line:text; `@field` where emitted). Shape rules → schema; business rules → handler (C11):
- `admin/clubs/[id]` 31 "Status must be 'approved', 'rejected', or 'suspended'" · 39 "Rejection requires category and message" · 45 "Invalid rejection category" · 54 "Suspension requires category and message" · 60 "Invalid suspension category"
- `admin/events/[id]/edits` 37 "action must be 'approve' or 'reject'" · 44 "reason is required when rejecting edits" · 69 *rule* "This event has no pending edits"
- `admin/events/[id]/status` 29 "Invalid status" · 71/77/87/93 (as admin/clubs)
- `admin/events` 135 "title, start_date, and end_date are required"
- `admin/experiments/[id]` 147 *rule* "Only draft experiments can be deleted" · `admin/experiments` 86 "name is required" · 93 "At least 2 variants are required"
- `admin/featured/[id]` 42 "No fields to update" · `admin/featured` 60 "event_id, starts_at, and ends_at are required"
- `admin/organizer-requests/[id]` 30 "Status must be 'approved' or 'rejected'" · `admin/reports/[id]` 27 "Invalid status"
- `admin/users/[id]/ban` 43 "Reason is required" · 55 "duration_days must be a positive integer" · 67 *rule* "Cannot ban your own account"
- `admin/users/[id]` 51 "Invalid role"@roles · 80 `Name must be between ${NAME_MIN} and ${NAME_MAX} characters long`@name
- `clubs/[id]/appeal` 29 "Appeal message is required" · `clubs/[id]/invites` 92 "Email is required" · 101 "Must be a McGill email"
- `clubs/[id]/members/role` 41 "Invalid request. Role must be 'organizer'." · 57/61 *rules* · `clubs/[id]/members` 108 "memberId is required" · 130/137 *rules*
- `clubs/[id]` 108 `Invalid value for ${field}` · 135 `Invalid URL for ${field}` · 144 "Invalid email format for contact_email" · 151 "No valid fields to update" · 225 *rule* "Club name confirmation does not match"
- `clubs/[id]/transfer` 38 "newOwnerId is required" · 48/61/72 *rules*
- `clubs/banner`, `clubs/logo` 32 "File and clubId are required" · 49 "File must be JPEG, PNG, or WebP" · 56 "File must be under 5MB" / "…2MB"
- `clubs` 74 `Invalid value for ${field}` · 84 `Invalid URL for ${field}` · 98 "Name, description, and category are required" · 105 "Contact email is required" · 113 "Please provide a valid email address" · 120 "Name max 100 chars, description max 500 chars"
- `events/[id]/analytics` 45 *rule* · `events/[id]/appeal` 29 "Appeal message is required" · `events/[id]/invite` 31 "No invitees provided" · 43 *rule* · `events/[id]/report` 30 "Invalid category"
- `events/[id]/reviews` 35 "Invalid JSON body" · 44 "Rating must be an integer between 1 and 5" · 62 *rule*
- `events/[id]` 284 "No valid fields to update" · 297 `dateError.message`@field (from `src/lib/dateValidation.ts`)
- `events/[id]/rsvp` 217 "Invalid JSON body" · 227 "user_id is required" · 236 "status is required" · 240 `Invalid status. Must be one of: …` · 387 "user_id is required"
- `events/create` 43 "Title is required" · 46 "Description is required" · 49 "Start date is required"@start_date · 52 "Location is required" · 57 "At least one tag is required" · 63 "Price must be 20 characters or less" · 67 "Registration link is too long" · 72 "Registration link must use http or https" · 75 "Registration link must be a valid URL" · 82 `dateError.message`@field
- `events/export` 138 "format parameter must be 'csv' or 'ical'" · 153 "eventId must be a valid UUID" · 157 "eventIds must be a comma-separated list of valid UUIDs" · 161 "Provide either eventId or eventIds, not both"
- `events/popular` 69 "sort must be 'popularity' or 'trending'"
- `events` 283/290/321 (cursor, limit, date messages; pinned by `pagination-contract-defect.test.ts:225` "Invalid cursor") · 301 `Invalid timeOfDay value. Must be one of: …` · 308 `Invalid dayType value. Must be one of: weekday, weekend` (pinned, `events-list-characterization.test.ts:315`)
- `events/upload-image` 22 "No file provided" · 26 "File too large. Maximum size is 5MB" · 39 `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF.`
- `feedback` 25 "Message is required" · 33 "Invalid feedback type" · `interactions` 75 "event_id and interaction_type are required" · 84 `Invalid interaction_type. Must be one of: …` · 93 `Invalid source. Must be one of: …`
- `moderation/reviews/[targetType]/[targetId]` 20 "Invalid target type" · `notifications` 101 "Invalid action" · `organizer-requests` 26 "club_id is required"
- `profile/avatar` 31/38/45 · `profile/banner` 29/35/42 (file checks) · `profile/inferred-tags` 22 "tag is required and must be a string" · `profile/interests` 29 "interest_tags must be an array" · 39 "Invalid tag values provided"
- `recommendations/analytics` 30 "Invalid period. Use 7d or 30d" · `recommendations/feedback` 119 "Invalid feedback. Must be 'positive' or 'negative'" · 126 "Missing event_id" · 164 "Missing required fields: event_id, recommendation_rank, action" · 171 `Invalid action. Must be one of: …` · 178 "recommendation_rank must be >= 1"
- `users/[id]/follow` 27 *rule* "Cannot follow yourself" · `users/[id]` 43 "Name must be between 2 and 50 characters long" · 54/65/78/88 avatar/banner URL · 101/110 interest_tags · 121/132/143 pronouns/year/faculty · 154 "Visibility must be 'public' or 'private'" · 165 "onboarding_completed must be a boolean" · 174 "No fields to update"

Adopting `parseBody` at the 21 raw sites changes an invalid-JSON body from Next's 500 (or a caught 500) to the 400 `Invalid JSON body`. That is INTENTIONAL, per DI-64 and REFAC-15 (a DEFECT row per suite that pins the 500). DI-44 folds in: `RecommendationFeedbackBody` has no `user_id`, so the dead `authUser?.id ?? body.user_id` fallbacks (`recommendations/feedback/route.ts:129,182`) go.

### D. Client fetch sites (REFAC-16) [VERIFIED: URL-literal scan, 182 literals in 73 non-route files]
- Hooks (8): `useEvents` (/api/events), `useClubs` (clubs/:id, clubs/:id/events, follow, invites, members, my-clubs, user/following), `useAnalytics` (clubs/:id/analytics, events/:id/analytics, events/:id/reviews), `useFeaturedClubs`, `useFeaturedEvents`, `useNotificationCount`, `useTracking` (interactions, recommendations/feedback), `useAvatarUpload` (profile/avatar).
- Components/pages with direct fetches: 65 files. The heaviest are `app/friends/page.tsx` (5 routes), `app/events/[id]/EventDetailClient.tsx` (6), `components/clubs/ClubSettingsTab.tsx`, `ClubMembersTab.tsx`, `CreateClubForm.tsx`, `CreateEventForm.tsx`, `EditEventModal.tsx`, and the 12 moderation pages.
- `src/lib/constants.ts` `API_ENDPOINTS` is used by 5 routes only (a known inconsistency).
- Scope recommendation: type every **request body the client builds** from `z.input<>` of the contract (all ~30 mutation call sites), and add the dev-only response parse to the 8 hooks. The census asserts that each mutation call site's file imports from `@/contracts/`.

### E. Cache classification (from `endpoints.json`, 94 rows; corrected)
- **public-60-300** (GET only): `/api/clubs`, `/api/clubs/[id]`, `/api/clubs/new`, `/api/clubs/trending`, `/api/events/export`, `/api/events/happening-now`, `/api/events/new`, `/api/events/popular`. Each filters `status='approved'` explicitly or reads a world-readable table (`clubs`: `Anyone can read clubs`).
- **public-30-60**: `/api/events`. **public-60-120**: `/api/events/featured`, `/api/clubs/featured`.
- **private, no-store**: every other handler. That is the 48 `private, no-store` rows, the 33 `no-store` rows (mutations; `private, no-store` is a superset), plus the corrections `/api/events/[id]` (C7) and `/api/health` (C8). `/api/recommendations` already sends it (`route.ts:67,140,312`).
- Stale rows to regenerate: `api.auth-debug` (deleted in Phase 5), `api.cron.*` (deleted here), and DI-58's calculate-popularity signals.
- **Local observability limit:** `next start` does not apply `vercel.json` headers and has no CDN. After the change, the headers a local server emits **are** the production headers (a function header overrides `vercel.json` [CITED]), so a local sweep is a faithful test of the header. HIT/MISS is not observable locally; see the Validation Architecture for the honest proxy.

### F. `console.*` in server code (REFAC-20) [VERIFIED: scan]
- Route files: **144 calls in 48 files**. Top: `auth/callback` 13, `events/[id]/rsvp` 11, `admin/users/[id]/ban` 10, `events/[id]/save` 7, `admin/calculate-popularity` 6, `user/engagement` 6, `events/[id]/friends` 5, `events/[id]` 5.
- `src/server/`: 6 (ratelimit/index 3, upstashStore 2, afterResponse 1). `src/lib/` server modules: `audit.ts` 1 (`logAdminAction`), `tagMapping.ts` 1 (shared; check each caller's tier). `src/proxy.ts` 2, `src/instrumentation.ts` 3. Server Component `src/app/clubs/page.tsx` 3.
- Client (kept): 22 calls in 14 files, including `src/lib/upload-utils.ts` (a client fetch helper).
- **Tests coupled to console:** 42 files, 68 `spyOn(console` sites (C26).

### G. `/api/health` today (389 lines)
- `checkDatabase` does a head-count on `events`, `users` and `saved_events` through the **cookie** client. Its message interpolates `error.message` (`:118,:143`).
- `checkSupabaseAuth` calls **`supabase.auth.getSession()`** (`:160`, the census's single remaining call).
- `checkAzureOAuth` calls `signInWithOAuth({ provider: "azure", skipBrowserRedirect: true })` on the server cookie client (`:198`). It leaks provider configuration state and error text, and may write a PKCE verifier cookie into the response [ASSUMED].
- `checkEnvironment` names missing variables (`details.missing`). `checkMemory` exposes heap/RSS figures.
- The response carries `uptime`, `version` (`npm_package_version`) and 503 when anything is unhealthy. The outer catch returns `Health check failed: ${error.message}`.
- **F-029 leak surface:** dependency names, configuration state, provider errors, memory figures, all anonymous.
- **Replacement checks** (all measured locally, anon apikey): `GET {SUPABASE_URL}/auth/v1/health` → 200 `{"version":"v2.195.0","name":"GoTrue",…}`; `GET {SUPABASE_URL}/storage/v1/status` → 200; DB → a `head` count on `events` through the cookie client, or `cron_job_status()` success. pg_cron → `cron_job_status()` with per-job staleness thresholds of 2× the schedule (compute 12 h, reminders 30 min, feedback 60 min); `unknown` when the RPC is missing (production before DI-23) or a job has never run (fresh local reset). Webhook → `last_ingest_at` (C23).

### H. Recommendations and findings (slice 6)
- `/api/recommendations` (321 lines) uses `createClient()` + `getUser()` directly (not the seam).
  - An anonymous caller gets popularity (`:42-67`).
  - A signed-in caller with no rows in `user_event_scores` gets `popular_fallback` (`:111-140`). That is F-041: locally `user_event_scores` has 0 rows (measured) until `compute_user_scores()` runs.
  - Then the experiment block (`:185-242`) runs, then MMR with `lambda = experimentLambda ?? clamp(diversity ?? 0.7)` (`:245-261`).
- **F-017 measured:** `experiments` and `experiment_variants` have **only** `Admins can manage …` policies, and `experiment_assignments` has admin-ALL plus own-row SELECT (probe). A non-admin reads `activeExperiments = []`, so no variant is assigned and nothing is written. The fix moves the three reads and the insert to `getElevatedClient()` (REGISTRY: "experiments/variants have admin-only policies; assignment is a server decision keyed by the caller's id"). The DEFECT pin comes first.
- Batch (`batch/route.ts`, 42 lines) is admin-gated and calls `compute_user_scores` through the door. Feedback (219 lines): DI-44. Analytics (127 lines): admin.
- **F-092:** `admin/reports/route.ts:28-35` embeds `reporter:users!event_reports_reporter_id_fkey(id, display_name, avatar_url)`. `reporter_id` references **`auth.users`** (`baseline.sql:1780`) and `public.users` has no `display_name`, so the query fails with `PGRST200` and the route answers 500 (`:48-50`). Fix: drop the embed; `ctx.supabase.from("users").select("id, name, avatar_url").in("id", reporterIds)` (the `Admins can view all profiles` policy permits it); map to `reporter: { id, display_name: name, avatar_url }` so `src/app/moderation/reports/page.tsx:25,160` renders unchanged.
- **F-054:** `src/app/docs/page.tsx` has no layout. Add `src/app/docs/layout.tsx` with the `src/app/admin/layout.tsx` shape (`getRequestContext` → `hasRole(profile, "admin")` else `redirect("/")`). This also makes `/docs` dynamic (it reads cookies), so the spec is no longer prerendered at build.
- **F-055:** Remove `'unsafe-eval'` when `NODE_ENV !== "development"` (the Next docs: needed only in development, "Neither React nor Next.js use `eval` in production by default" [VERIFIED: `content-security-policy.md:42`]). Keep `'unsafe-inline'`: the root layout injects an inline theme script (`src/app/layout.tsx:75`) and Next's own bootstrap scripts are inline. A hash cannot cover per-page Next scripts, and a nonce requires dynamic rendering of every page (`:38,:181`). Partial close: the unsafe-eval half closes, and the nonce becomes a DI to Phase 8.

### I. DI-53 — the four payload sites (retype through the contracts)
| Site | Today | Retype |
|---|---|---|
| `src/app/api/admin/events/[id]/edits/route.ts:~81` | `const liveUpdates: Record<string, unknown> = { pending_edits: null }` then `liveUpdates[key] = pendingEdits[key]` over `MODERATED_FIELDS` | `const liveUpdates: TablesUpdate<"events"> = { pending_edits: null }`; make `MODERATED_FIELDS` `as const` (`"title" \| "image_url"`) and assign per key (`if (key === "title") liveUpdates.title = …`) |
| `src/app/api/admin/events/[id]/route.ts:~30` | `updateData: Record<string, unknown>` copied from `body[field]` for 10 allowed fields | `AdminEventUpdateBody = z.object({...}).partial()` in `src/contracts/admin.ts`; `const updateData: TablesUpdate<"events"> = { ...parsed.data, updated_at }` |
| `src/app/api/admin/experiments/[id]/route.ts:~88` | `Record<string, unknown>` with status/description/end_date | `ExperimentUpdateBody` (status enum) → `TablesUpdate<"experiments">` |
| `src/app/api/admin/featured/[id]/route.ts:31` | `Record<string, Json>` (also used as audit metadata) | `FeaturedUpdateBody` → `TablesUpdate<"featured_events">`; pass the same object to the audit as `Json` via a narrow cast only at the metadata site |

Then, as the last code change: a throwaway-worktree `npm i --save-exact @supabase/supabase-js@2.116.0 && npx tsc --noEmit` proof, followed by the bump. The `@supabase/ssr` 0.7 peer range (`^2.43.4`) admits it (DI-43 note).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Per-field `if (!body.x)` ladders | zod 4 schemas + `parseWith` | Types flow to client and handler; one place fixes non-string `.trim()` crashes (DI-64) |
| Constant-time compare | `===` on secrets | `crypto.timingSafeEqual` **after** a length check (or compare SHA-256 digests of both) | The existing webhook shows the length pitfall (C2) |
| Error reporting transport | A custom fetch to an error API | `@sentry/nextjs` `captureRequestError` + `captureException` | Source maps, release and environment tagging, and the Turbopack build hook |
| Request-scoped state | Module-level variables | `AsyncLocalStorage` | Module state leaks across concurrent requests (the context.ts docblock warns about the same failure) |
| Webhook dedupe | A new delivery table | The existing `idx_events_content_hash` UNIQUE partial index + `src/lib/contentHash.ts` | Already the dedupe key for `events/create` and `admin/events` |
| pg_cron reads | `service_role` grants on schema `cron` | One definer function returning five columns | Least privilege; nothing else in `cron` becomes reachable |
| Cross-user cache test on Vercel | Guessing from headers | `.planning/audit/tools/cache-probe.sh` with `COOKIE_A`/`COOKIE_B` against a preview deploy (owner) + the local simulator | The audit already built the real probe and its control route |

**Key insight:** every hazard in this phase (cache poisoning, subject spoofing, replay, PII leakage) already has a correct primitive either in the tree or in the platform. The work is wiring and pinning, not inventing.

---

## Runtime State Inventory

This phase deletes routes, changes database grants and changes deploy configuration, so each category is answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Production `cron.job` holds 3 jobs that no migration declares (F-042); production `user_event_scores` has 0 rows (F-041); `email_reminder_log` has 0 rows (its only writer is the deleted handler) | Migration declares the jobs (local-only until DI-23). The F-041 cause is recorded for Phase 8. `email_reminder_log` is left as is: a table drop is out of scope (F-038 is an owner decision) |
| Live service config | **Vercel:** `vercel.json` headers are deployed configuration; removing the rule takes effect on the next deploy. Production env has only 3 variables (F-040). **Supabase:** `events-webhook` is deployed ACTIVE with `verify_jwt=false`, built from a laptop (F-039), and `WEBHOOK_SECRET` presence is unknown. **Sentry:** no project exists yet | Owner actions in the completion note (Phase 8): set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `HEALTH_TOKEN`; redeploy the edge function from CI after the change; confirm `WEBHOOK_SECRET` |
| OS-registered state | None. No launchd, pm2 or cron on a developer machine references the routes (verified by the absence of any scheduler in the tree; the only schedulers are pg_cron and the empty Vercel crons) | None |
| Secrets/env vars | `CRON_SECRET` is read only by the two deleted routes, so after deletion no reader remains (F-040's last clause closes by record). New optional readers: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `HEALTH_TOKEN` (validated in `src/lib/env.ts`; absent is valid) | Update `.env.local.example` (never `.env.local`) |
| Build artifacts | `.next/types/validator.ts` references deleted route files until the next build/typegen; `endpoints.json` rows for deleted routes; `src/lib/supabase/types.ts` gains `cron_job_status` | Run `next build` (or `next typegen`) in the floor; regenerate the endpoints inventory; regenerate the types in the migration commit and assert that the diff is exactly the new RPC |

---

## Common Pitfalls

### Pitfall 1: Correct locally, wrong in production (the DI-23 gap)
**What goes wrong:** Code calls `cron_job_status()` or relies on the revoked grants, but production has neither until the Phase 8 migration repair.
**How to avoid:** Every code change must be correct against both schemas. Health maps `PGRST202` to `unknown`. Nothing in the app *depends* on the revokes; they only remove anon reach. The get_friends predicate is additive, and callers already pass their own id.
**Warning signs:** A test that passes only after `supabase db reset`.

### Pitfall 2: Default privileges re-grant new functions
**What goes wrong:** `cron_job_status()` becomes anon-callable and leaks job names and failure states.
**How to avoid:** `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated` explicitly. pgTAP asserts `NOT has_function_privilege('anon', …)` and `NOT … 'authenticated'`.

### Pitfall 3: The ESLint allow-list goes empty (C14)
**Warning signs:** `npm run lint` prints "Oops! Something went wrong!" with `Key "files"`.

### Pitfall 4: The wrapper changes bytes silently
**What goes wrong:** Adding `Cache-Control` and `x-request-id` is intended, but also turning HTML 500s into JSON 500s, or reordering guards before parsing, moves PRESERVE pins.
**How to avoid:** Adopt the wrapper file by file with the suite green. Every byte change goes through a DEFECT file (the tag gate is file-level, Phase 5 C15), with ledger rows.

### Pitfall 5: The local reminder jobs mutate test data
**What goes wrong:** A `*/15` job inserts `reminder_24h` notifications mid-run for a seeded saved event 23-25 h out.
**How to avoid:** Keep seed dates pinned away from `now() ± 25 h`. Specs that count notifications scope by event id, as `admin-write-paths.spec.ts` does. pgTAP calls the functions only inside `BEGIN … ROLLBACK`.

### Pitfall 6: zod issue order and messages
**What goes wrong:** zod reports issues in schema key order. Default messages ("Invalid input: expected string, received undefined") replace today's text.
**How to avoid:** One custom `error` per rule; keys in today's check order; a PRESERVE table per route asserting the exact first 400 for each malformed input the old ladder handled.

### Pitfall 7: Sentry adds work or noise on the request path
**What goes wrong:** Tracing enabled by default adds OpenTelemetry spans to every request. `tunnelRoute` adds proxy work.
**How to avoid:** `tracesSampleRate: 0` (errors only; performance is out of scope). No tunnel. `enabled: Boolean(dsn)`.

### Pitfall 8: The build fails without `SENTRY_AUTH_TOKEN`
**What goes wrong:** CI (`ci.yml` builds with placeholders) or the harness build hard-fails, or prints errors that a strict policy treats as failures.
**How to avoid:** Set `sourcemaps.disable` when the token is absent. Prove it with the Phase 5 CI-env build method (`evidence/build-ci-env.txt`) [the warning-not-failure behaviour is CITED, MEDIUM].

### Pitfall 9: Request id propagation through `setAll`
**What goes wrong:** The proxy rebuilds `supabaseResponse = NextResponse.next({ request })` inside `setAll` (`proxy.ts:109`). A header set on a *cloned* `Headers` would be lost on refresh.
**How to avoid:** Set `request.headers.set("x-request-id", id)` on the NextRequest itself at the top (before the rate limiter), so every `NextResponse.next({ request })` carries it. A proxy unit test asserts `x-middleware-request-x-request-id` on both the refreshed and the non-refreshed response [ASSUMED mutability; verify first].

### Pitfall 10: The cache test proves nothing locally
**What goes wrong:** "B never receives A's data" passes trivially on `next start`, because there is no shared cache.
**How to avoid:** Put a shared-cache simulator in front of the server (Validation § REFAC-19), with a **positive control**: a public route must HIT on its second request. Record the real two-session CDN probe as a human-verify on a preview deploy.

### Pitfall 11: `/health` page and `/docs` become dynamic
Adding layout guards that read cookies turns prerendered pages dynamic. That is intended, but check the build output's route table in the floor evidence.

### Pitfall 12: supabase-js latest is too new
2.117.2 was published on the day of this research. Bump to the version the tsc proof ran against (2.116.0), not `@latest`.

---

## Code Examples

### Migration skeleton (fix-forward, idempotent, local-only)
```sql
-- supabase/migrations/2026092xxxxxxx_async_edge_definer_hardening.sql
-- CLOSES (local, pending DI-23): F-042, F-074, F-075, F-076 (+ F-093 if taken)

-- F-042: declare the two production-only jobs, literals byte-identical to .planning/audit/async/cron-job.json
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-event-reminders') THEN PERFORM cron.unschedule('send-event-reminders'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-feedback-requests') THEN PERFORM cron.unschedule('send-feedback-requests'); END IF;
END $$;
SELECT cron.schedule('send-event-reminders',   '*/15 * * * *', $job$select public.send_event_reminders()$job$);
SELECT cron.schedule('send-feedback-requests', '*/30 * * * *', $job$SELECT public.send_feedback_requests()$job$);

-- F-075 + F-076: privileged writes off the public surface; path pinned WITHOUT a body rewrite (C6)
REVOKE EXECUTE ON FUNCTION public.compute_user_scores(), public.send_event_reminders(), public.send_feedback_requests()
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.compute_user_scores()   SET search_path = public, pg_temp;
ALTER FUNCTION public.send_event_reminders()  SET search_path = public, pg_temp;
ALTER FUNCTION public.send_feedback_requests() SET search_path = public, pg_temp;

-- F-074: subject bound to the session; the elevated door (service_role) keeps the public-profile read (C5)
CREATE OR REPLACE FUNCTION public.get_friends(target_user_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM public.users u
  JOIN public.user_follows f1 ON f1.following_id = u.id AND f1.follower_id = target_user_id
  JOIN public.user_follows f2 ON f2.follower_id = u.id AND f2.following_id = target_user_id
  WHERE target_user_id = (SELECT auth.uid()) OR (SELECT auth.role()) = 'service_role';
$$;
REVOKE EXECUTE ON FUNCTION public.get_friends(uuid) FROM PUBLIC, anon;
-- get_friends_going_to_event: same shape, predicate on current_user_id

-- REFAC-22: cron freshness for /api/health (service_role only; C4)
CREATE OR REPLACE FUNCTION public.cron_job_status()
RETURNS TABLE(jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT j.jobname, j.schedule, j.active, r.start_time, r.status
  FROM cron.job j
  LEFT JOIN LATERAL (SELECT d.start_time, d.status FROM cron.job_run_details d
                     WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) r ON true;
$$;
REVOKE ALL ON FUNCTION public.cron_job_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_job_status() TO service_role;
```
The `OWNER` of a `CREATE OR REPLACE` stays `postgres`. pg_cron jobs keep running as `postgres`, whom the revokes do not affect.

### pgTAP, both directions (house style; `tests.act_as` exists in `000-setup.sql:53`)
```sql
BEGIN; SELECT plan(N);
SELECT ok(NOT has_function_privilege('anon', 'public.send_event_reminders()', 'EXECUTE'), 'anon cannot run reminders');
SELECT ok(NOT has_function_privilege('authenticated', 'public.compute_user_scores()', 'EXECUTE'), 'users cannot rescore everyone');
SELECT ok(has_function_privilege('service_role', 'public.compute_user_scores()', 'EXECUTE'), 'the batch door still can');
SELECT is(md5(prosrc), 'ed64959b44c9329a1212cde928810010', 'scoring formula body unchanged (REFAC-14)')
  FROM pg_proc WHERE oid = 'public.compute_user_scores()'::regprocedure;
SELECT is((SELECT count(*)::int FROM pg_proc p WHERE p.prosecdef AND p.pronamespace = 'public'::regnamespace
           AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')),
          0, 'every definer function in public pins search_path (F-076)');
SELECT tests.act_as('<A>'); SELECT is((SELECT count(*)::int FROM public.get_friends('<B>')), 0, 'A cannot read B''s friends');
SELECT tests.act_as('<A>'); SELECT ok((SELECT count(*) FROM public.get_friends('<A>')) > 0, 'A reads own friends');
SELECT * FROM finish(); ROLLBACK;
```
Seeded UUIDs must come from `scripts/seed/personas.ts` `IDS`, and the file must tolerate the unseeded CI `types` job (Phase 5 Pitfall 4). Create the follow rows inside the transaction.

### The shared-cache simulator (Playwright helper; Vercel's documented rules)
```typescript
// e2e/helpers/sharedCacheProxy.ts — cache only what Vercel would: GET/HEAD, no Authorization,
// 200/404, no set-cookie, s-maxage>0, no private/no-cache/no-store, Vary not naming Cookie. Key = URL.
// Returns x-sim-cache: HIT|MISS so specs can assert. Positive control: /api/events/popular HITs on 2nd call.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (edge) | `proxy.ts`, Node runtime default | Next 16.0 [VERIFIED: proxy.md:806] | `AsyncLocalStorage` and `node:crypto` usable in the proxy |
| `sentry.client.config.ts` | `instrumentation-client.ts` + `onRouterTransitionStart` | Next 15.3+ / Sentry 9-10 [CITED] | Client init goes in the Next convention file |
| `sendDefaultPii` | `dataCollection` (v11) | @sentry/nextjs 11.0.0, 2026-09-23 [CITED] | Stay on v10 now; the v11 migration needs an explicit baseline |
| Source maps via the webpack plugin only | Turbopack post-build upload (`runAfterProductionCompile`) | @sentry/nextjs 10.13 + Next 15.4.1 [CITED, MEDIUM] | Works with `next build` defaulting to Turbopack |
| GET route handlers static by default | Dynamic by default | Next 15.0 [VERIFIED: route.md:669] | Routes are not build-cached; only `Cache-Control` decides CDN caching |
| zod 3 `message` param | zod 4 `error` param / function | zod 4 [CITED: zod.dev] | Use `{ error: … }` in schemas |

**Deprecated/outdated in this tree:**
- `src/lib/classifier.ts:9` ("Apify output -> classifier -> webhook (pending_events)"): no such pipeline or table exists (inventory § 5). Correct the comment when touching the file.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `request.headers.set("x-request-id", …)` on the proxy's `NextRequest` is permitted and is forwarded by `NextResponse.next({ request })` | Pitfall 9, C19 | Correlation breaks between proxy and handler; fallback: clone the headers once at the top and pass `{ request: { headers } }` in both `NextResponse.next` calls |
| A2 | `next build` with `withSentryConfig` and no `SENTRY_AUTH_TOKEN` exits 0 (warning only), especially with `sourcemaps.disable` | Pitfall 8 | CI build red; mitigated by proving it with the CI-env build before merging |
| A3 | `@sentry/node`/`@sentry/core` (hoisted with @sentry/nextjs 10) can be initialized in Jest's node project with a custom in-memory transport, and the envelope carries `tags.request_id` | Validation (REFAC-21) | Fallback: `jest.mock("@sentry/nextjs")` and assert `captureException`/`setTag` arguments. That proves the wiring, not the transport |
| A4 | The dev-only `safeParse` in hooks lets zod be tree-shaken from production client chunks | Pattern 2b | Client bundle grows (zod 4 core); mitigation: import schemas only inside the dev branch via dynamic `import()` |
| A5 | `supabase functions deploy` bundles `../_shared/*.ts` and resolves the `npm:zod` import-map entry | Pattern 6 | The owner's deploy fails; `_shared` is the documented Supabase convention, so the risk is low |
| A6 | Production `/auth/v1/health` and `/storage/v1/status` answer like the local stack's | Inventory G | Health reports auth/storage as unhealthy in production; check on the first owner deploy |
| A7 | The `@sentry/cli` postinstall does not reach the network when the optional platform package installs | Package audit | A network call at install time; mitigated by `SENTRYCLI_SKIP_DOWNLOAD=1` |
| A8 | `checkAzureOAuth`'s `signInWithOAuth` writes a PKCE cookie on the health response | Inventory G | None (the check is removed either way) |
| A9 | `@sentry/react` 10.x's peer range admits React 18.3 | Project constraints | The install warns or fails; verify with `npm view @sentry/react@10.75.3 peerDependencies` at the checkpoint |

---

## Open Questions

1. **Webhook signed-timestamp window.** Replay by re-inserting is closed by `content_hash` (C2). A timestamp window changes the signing contract for an external sender nobody in the repository controls. Recommendation: register it as a DI for the owner, recorded with the CI-deploy action.
2. **F-093 (reminders for deleted or unapproved events).** Fixing it rewrites `send_event_reminders()`'s body, and so replaces C6's md5 pin for that function with a behaviour pin. Recommendation: fix it in slice 6 (C24). The owner can defer it by signature.
3. **`@sentry/nextjs` major.** Recommendation: 10.75.3. Revisit v11 in Phase 8 with an explicit `dataCollection` baseline.
4. **`/health` page.** Admin-gate it in place (recommended), or move it under `/admin`. Either is INTENTIONAL; in-place keeps the URL.
5. **REFAC-16's scope for component call sites.** Recommendation: type every client-built request body from the contracts and add dev-only response parsing in the 8 hooks. A dev-parse at all 182 URL literals is noise.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | 24.16.0 (`.nvmrc` 24) | — |
| npm | installs | ✓ | ≥11 | — |
| Docker + local Supabase stack | pgTAP, probes, Playwright | ✓ | `supabase_db_Event-Radar` healthy | — |
| Supabase CLI | `supabase test db --local`, `db reset`, `gen types` | ✓ | 2.115.0 | — |
| pg_cron (local) | F-042 jobs, `cron_job_status()` | ✓ | 1.6.4, preloaded, launcher running | — |
| Supabase edge runtime container | Serving `events-webhook` locally | ✗ (container not running; `[edge_runtime] enabled = true`) | — | Jest over the pure `_shared` module; `supabase functions serve` is optional |
| Deno | `supabase/functions/tests/webhook.test.ts` | ✗ | — | Jest (CONTEXT fallback) |
| Playwright | REFAC-19/23 specs | ✓ | 1.63.0 | — |
| Sentry DSN / auth token / org / project | REFAC-21 live proof, source-map upload | ✗ | — | Transport-mock test; human-verify on the first DSN (owner, Phase 8) |
| Vercel preview deploy | Real CDN two-session probe (F-025 criterion) | ✗ (no push authorized) | — | Local simulator + `cache-probe.sh` recorded as human-verify |
| Port 3000 free | Playwright `webServer` | ✓ at the Phase 5 close | — | — |

**Missing dependencies with no fallback:** none block execution. The live Sentry and CDN proofs are human-verify items by design.
**Missing dependencies with fallback:** Deno and the edge runtime (use Jest); Sentry and Vercel (use the mocks and the simulator).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 (node + jsdom projects), pgTAP (`supabase test db --local`), Playwright 1.63 persona harness |
| Config file | `jest.config.js`, `playwright.config.ts`, `supabase/tests/database/` |
| Quick run command | `npx jest --ci <changed suite paths>` |
| Full suite command | `npx jest --ci && supabase test db --local && npx playwright test && node scripts/check-elevated-ratchet.mjs && node scripts/check-characterization-tags.mjs --all && node scripts/check-contracts.mjs && npm run lint && npx tsc --noEmit` |
| Current floor (orchestrator, 2026-09-25) | Jest 1651 passed + 1 skipped (88 suites listed); pgTAP 200 (11 files); Playwright 91/91 (18 specs); ratchet allow-list = the two cron routes; tag gate ok 34 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFAC-14 | Cron routes gone; ratchet 0/0; ESLint still runs | census | `test ! -e src/app/api/cron && node scripts/check-elevated-ratchet.mjs && npm run lint` | ✅ (scripts) |
| REFAC-14 | Three jobs declared, literals byte-identical, idempotent | pgTAP | `supabase test db --local` (`031-cron-jobs.test.sql`, extends 030) | ❌ Wave 0 |
| REFAC-14 | Definer grants, search_path invariant, md5 formula pin, friends subject both directions, `cron_job_status` service-only | pgTAP | `supabase test db --local` (`070-definer-functions.test.sql`); mutation check with `scripts/pgtap-mutation-check.sh` on the grants | ❌ Wave 0 |
| REFAC-14 | Webhook: valid sig 200/207; missing 401; wrong 401; **wrong length 401** (DEFECT from 500); replay → duplicate; schema 400 texts | unit (Jest) | `npx jest src/__tests__/webhook` | ❌ Wave 0 |
| REFAC-14 | Recommendations input → ranked output; weights 0.35/0.25/0.20/0.15/0.05 and MMR λ rules pinned; F-041 fallback pinned; F-017 DEFECT → fixed (non-admin gets a variant, assignment written via the door) | characterization (PRESERVE + DEFECT) | `npx jest src/__tests__/api/recommendations` | ❌ Wave 0 |
| REFAC-14 | `notifications/count` anonymous 401 (F-028); F-092 reports 200 with the reporter name | unit DEFECT → fixed; e2e | `npx jest src/__tests__/api/notifications src/__tests__/api/admin`; `npx playwright test admin-moderation-queue` (extend) | partial |
| REFAC-15 | Every route parses through `src/server/body.ts`; no raw `request.json()`/`formData()`/`searchParams.get` in route files | census | `node scripts/check-contracts.mjs` (plus its own Jest red/green fixture) | ❌ Wave 0 |
| REFAC-15 | Per-family schema tables: each malformed input yields today's exact 400 (or a DEFECT naming REFAC-15/DI-64) | unit | `npx jest src/contracts src/server/__tests__/body.test.ts` | ❌ Wave 0 |
| REFAC-16 | Hooks and mutation call sites typed from contracts | tsc + census | `npx tsc --noEmit && node scripts/check-contracts.mjs --client` | ❌ Wave 0 |
| REFAC-19 | `vercel.json` has no `/api` Cache-Control | unit | `npx jest src/__tests__/config/vercel-json.test.ts` | ❌ Wave 0 |
| REFAC-19 | Every exported handler is wrapped and its class matches the corrected classification, on success **and** 401/500 paths | unit census (imports every route module; drives through the fake) | `npx jest src/__tests__/api/cache-headers-census.test.ts` | ❌ Wave 0 |
| REFAC-19 | Live header sweep across the endpoint table as anon + persona | e2e | `npx playwright test cache-headers` | ❌ Wave 0 |
| REFAC-19 | Cross-user: A then B through the shared-cache simulator; B never sees A's body; personalized MISS; positive control HIT | e2e | `npx playwright test cross-user-cache` | ❌ Wave 0 |
| REFAC-20 | Logger JSON shape, levels, requestId from ALS, Error serialization, no PII keys | unit | `npx jest src/server/__tests__/log.test.ts` | ❌ Wave 0 |
| REFAC-20 | Proxy sets and forwards `x-request-id` (refreshed and non-refreshed; 429/403/500 paths); wrapper echoes it; handler logs carry the same id | unit | `npx jest src/proxy src/server/__tests__/route.test.ts` | partial (proxy tests exist) |
| REFAC-20 | No `console.*` in server files | census | `node scripts/check-server-console.mjs` | ❌ Wave 0 |
| REFAC-21 | DSN absent → disabled + one log line; `scrubEvent` strips email/cookies/body/query and hashes the user; the thrown error in a wrapped route reaches the (mocked) transport with `tags.request_id` | unit | `npx jest src/server/__tests__/sentry.test.ts` | ❌ Wave 0 |
| REFAC-21 | Build passes without `SENTRY_AUTH_TOKEN` (CI env) | build | `env -i PATH=$PATH HOME=$HOME NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run build` | ✅ method (Phase 5 `build-ci-env.txt`) |
| REFAC-22 | Anonymous → `{status, version}` only (no dependency names, no error text); admin/`HEALTH_TOKEN` → documented shape; missing RPC → `unknown`; `getSession(` census = 0; `private, no-store` | unit + e2e | `npx jest src/__tests__/api/health`; `git grep -c "getSession(" -- src ':!*.test.*'` → 0; `npx playwright test health` | ❌ Wave 0 |
| REFAC-23 | All persona specs pass after each slice; the Validated list is re-confirmed; CSP enforced (`bypassCSP: false`) | e2e | `npx playwright test` | ✅ (91) + new |

### Sampling Rate
- **Per task commit:** `npx jest --ci <touched suites>` (feedback < 10 s) plus the relevant census script.
- **Per wave merge:** the full suite command above.
- **Per slice close:** full suite from a clean `supabase db reset --local` + seed, the CI-env build, `validate.mjs --check findings`, and the Playwright full run recorded to evidence.
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/__tests__/helpers/fakeSupabase.ts`: script `rpc:cron_job_status`, the elevated `experiments`/`experiment_variants`/`experiment_assignments` reads, and a `PGRST202` error.
- [ ] `scripts/check-contracts.mjs` and `scripts/check-server-console.mjs`, each with a red fixture.
- [ ] `e2e/helpers/sharedCacheProxy.ts` (the simulator) and its control assertion.
- [ ] `supabase/tests/database/031-cron-jobs.test.sql`, `070-definer-functions.test.sql`.
- [ ] `src/__tests__/webhook/*.test.ts` over `supabase/functions/_shared/webhook-contract.ts`.
- [ ] `playwright.config.ts`: `bypassCSP: false` once C13 lands (the same commit as the CSP change).
- [ ] Framework install: `zod`, `@sentry/nextjs` (checkpointed).

---

## Security Domain

### Applicable ASVS Categories (Level 1; `security_enforcement: true`, block on high)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | One wrapper and one door; REGISTRY rows for every new elevated read |
| V2 Authentication | yes | `HEALTH_TOKEN` bearer: compare SHA-256 digests with `timingSafeEqual`; webhook HMAC with a length check |
| V3 Session Management | no change | `@supabase/ssr` cookies unchanged (major deferred) |
| V4 Access Control | yes | RPC grants and subject predicates (pgTAP both directions); `/docs` and `/health` admin layouts; `notifications/count` 401 |
| V5 Validation, Sanitization, Encoding | yes | zod 4 at every boundary; `sanitizeText` stays where used |
| V6 Cryptography | yes | `node:crypto` HMAC-SHA256 and SHA-256 only; never hand-rolled |
| V7 Error Handling and Logging | yes | Generic 500 bodies (F-059); JSON logs with request id; no PII in logs or Sentry |
| V8 Data Protection | yes | `private, no-store` on personalized and auth-gated responses; Sentry scrubbing decided before install |
| V13 API and Web Service | yes | Webhook contract validation + replay dedupe; consistent 400 shape |
| V14 Configuration | yes | CSP without `unsafe-eval` in production; HSTS and friends unchanged |

### Known Threat Patterns for Next.js 16 + Supabase + Vercel
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shared-cache cross-user disclosure (F-025/F-026) | Information disclosure | `private, no-store` per handler; no path-level cache rule; never `Vary: Cookie` on a public route |
| RPC IDOR via a caller-supplied subject (F-074) | Information disclosure | Subject predicate `= auth.uid()` or `service_role`; revoke anon |
| Anonymous invocation of privileged definer writes (F-075) | Tampering / DoS | Revoke EXECUTE from PUBLIC, anon, authenticated |
| search_path hijack in a definer function (F-076) | Elevation | `SET search_path` on every definer (pgTAP invariant) |
| Webhook forgery / replay (F-039) | Spoofing / Tampering | HMAC over the raw body (existing), length check, `content_hash` unique index |
| PII in error telemetry | Information disclosure | `sendDefaultPii: false` (v10), `beforeSend` scrubber, hashed user id |
| Log injection / request-id spoofing | Tampering / Repudiation | `JSON.stringify` lines; the proxy overwrites `x-request-id`; the wrapper accepts only UUID-shaped ids |
| Health endpoint reconnaissance (F-029) | Information disclosure | Liveness-only for anonymous callers; diagnostics behind admin or token |
| Timing attack on the token compare | Spoofing | Digest compare with `timingSafeEqual` |

---

## Suggested plan decomposition (for the planner; not binding)

**Slice 6:**
1. DI registration (DI-61..77, DI-55/56/58) and the zod install checkpoint.
2. Cron route deletion, ESLint override and ratchet (C14).
3. `[BLOCKING]` migration, pgTAP and types regeneration (F-042/074/075/076, F-093 decision, `cron_job_status`).
4. Webhook `_shared` contract, verifier and dedupe (F-039 partial: the deploy is the owner's).
5. Recommendations characterization, F-017 door, contracts for recommendations/interactions/notifications/feedback, F-028 notifications/count, DI-44, F-092.
6. Slice-6 close and floor.

**Slice 7:**
7. Wrapper, logger, proxy request id and the `console.*` sweep (F-058, DI-45).
8. Remaining contracts, `parseBody`/`parseQuery`/`parseForm` adoption, census and client typing (REFAC-15/16), DI-64/66, F-059, the DI-53 retypes.
9. Caching: `vercel.json`, classes, the census, the header sweep, the cross-user simulator spec (REFAC-19).
10. Sentry (checkpoint), CSP (F-055, DI-21 via C13, `bypassCSP: false`), `/docs` gate (F-054).
11. Health, `docs/health.md` and the `/health` page gate (REFAC-22, F-029).
12. F-085, then the supabase-js bump as the last code change.
13. Phase completion note (the Validated list, owner actions for Phase 8).

---

## Sources

### Primary (HIGH confidence)
- Codebase reads with file:line citations throughout: `src/proxy.ts`, `src/server/{context,body,errors,http,afterResponse}.ts`, `src/instrumentation.ts`, `next.config.js`, `vercel.json`, `eslint.config.mjs`, `eslint.elevated-allowlist.mjs`, `supabase/functions/events-webhook/index.ts`, `supabase/config.toml`, `supabase/migrations/20260915214553_baseline.sql`, `20260915230100_cron_compute_user_scores.sql`, and all route files by scripted census.
- Local stack probes (rolled back; `docker exec -i supabase_db_Event-Radar psql -f`): definer functions, grants and proconfig; `cron.job`; `shared_preload_libraries`; `cron` schema privileges; events/clubs/experiments policies; `auth.role()`/`auth.uid()` under impersonation; the `compute_user_scores` run; `content_hash` index; `events.source` constraint; `md5(prosrc)`. Also `curl` of `/auth/v1/health` and `/storage/v1/status`.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{proxy,instrumentation,route}.md`, `01-app/02-guides/content-security-policy.md`; `next/dist/server/web/spec-extension/response.js`; `.next/types/validator.ts`.
- `.planning/audit/async/{cron-job.json,vercel-crons.md,cron-webhook-inventory.md}`, `.planning/audit/inventory/endpoints.json`, `.planning/audit/findings.json` (the 23 `closes_in_phase: "06"` records), `.planning/audit/cache/curl-summary.json`.
- npm registry (`npm view`) and `gsd-tools query package-legitimacy check` for zod, @sentry/nextjs, @sentry/cli, sentry, @supabase/supabase-js.
- ESLint 9.39.1 scratch run (the empty `files` array).

### Secondary (MEDIUM confidence)
- [Vercel CDN Cache docs](https://vercel.com/docs/caching/cdn-cache): cacheability criteria, `Vary: Cookie` refusal, function headers override `vercel.json`.
- [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) and [Migrate from 10.x to 11.x](https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v10-to-v11/): v11 `dataCollection` defaults, the import path, `instrumentation-client.ts`, `captureRequestError`.
- [Sentry build options](https://docs.sentry.dev/platforms/javascript/guides/nextjs/configuration/build/) and [sentry-javascript issue #9171](https://github.com/getsentry/sentry-javascript/issues/9171): Turbopack post-build upload; a missing token warns (via web search).
- [Zod error customization](https://zod.dev/error-customization): the zod 4 `error` param and the issue shape.

### Tertiary (LOW confidence)
- The `@sentry/cli` postinstall's download behaviour (A7); the Supabase `_shared` bundling of `npm:` specifiers (A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for versions and publishers (registry); MEDIUM for Sentry build behaviour without a token.
- Architecture: HIGH. Every pattern is grounded in measured code or database behaviour; the wrapper typing is checked against Next's generated validator.
- Pitfalls: HIGH for C14 (measured), C4/C5/C6 (measured) and C7 (policies + docs); MEDIUM for the local simulator's fidelity to Vercel (documented rules, not a real CDN).

**Research date:** 2026-09-25
**Valid until:** 2026-10-09 for the package versions (fast-moving: Sentry v11 just shipped, supabase-js publishes weekly); 30 days for the codebase and database findings.
