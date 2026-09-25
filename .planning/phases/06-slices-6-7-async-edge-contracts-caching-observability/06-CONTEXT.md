# Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning
**Mode:** Smart discuss, autonomous. No owner present; every bullet is a planner default accepted by rule, overridable by an owner-signed paragraph before the executing plan runs (Phase 4/5 mechanism). Rule-resolved checkpoints are listed in the completion note.

<domain>
## Phase Boundary

Stage 3, slices 6 and 7 (close-out). Requirements REFAC-14 (cron/webhook credentials, recommendations characterized), REFAC-15/16 (zod contracts at every handler boundary, reused by client hooks), REFAC-19 (blanket `s-maxage=60` removed; personalized routes `private, no-store`; public routes opt in; cross-user cache test), REFAC-20 (structured JSON logger with request correlation id, Node + proxy runtimes), REFAC-21 (Sentry, Turbopack-aware, source maps, env/release tags, PII scrubbing decided before install), REFAC-22 (`/api/health` documented shape, no `getSession()`), REFAC-23 (Playwright happy-path re-confirmation after each slice and the full Validated list at the end).

Findings owned (`closes_in_phase: "06"`): F-002, F-017, F-025, F-026, F-028 (remaining routes), F-029, F-037, F-038, F-039, F-040, F-041, F-042, F-054, F-055, F-058, F-059, F-074, F-075, F-076, F-078, F-084, F-085, F-092. Carried DIs: DI-21, DI-25/DI-53, DI-26, DI-33 (cron half), DI-43, DI-44, DI-45, DI-47, DI-50, DI-59.

Out of scope: production writes of any kind (migration repair is Phase 8, DI-23), the certification datasets and persona matrix (Phase 7), the `@supabase/ssr` major (Phase 8), storage bucket policies (Phase 8, DI-33 bucket half), DI-39/DI-40/F-078 product decisions (owner), an email provider (see Area 1).

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Slice 6: the asynchronous edge (REFAC-14)
- **Dead cron handlers are deleted, not credentialed.** Research must confirm from `vercel.json` (no `crons` key) and the pg_cron inventory that nothing calls `/api/cron/send-reminders` and `/api/cron/send-feedback-requests`; F-037 says they duplicate live pg_cron functions with divergences and F-038 says no email is sent anywhere. Default: delete both route files (closes F-002 and F-037, empties `eslint.elevated-allowlist.mjs` to zero — record the ratchet diff). If research finds a live caller, the fallback is the FO-04 fail-closed shape through a validated optional `CRON_SECRET` reader with a constant-time compare.
- **pg_cron schedules become repository truth.** A fix-forward migration declares the three production pg_cron jobs (F-042; local `supabase/config.toml` must enable `pg_cron`), revokes anon/authenticated EXECUTE on `compute_user_scores`, `send_event_reminders`, `send_feedback_requests` (F-075), pins `search_path` on the SECURITY DEFINER functions (F-076), and makes `get_friends`/`get_friends_going_to_event` derive the subject from `auth.uid()` (F-074). pgTAP proves each. `[BLOCKING]` local schema task as in Phase 5. Local-only until DI-23; the completion note lists them.
- **The events webhook edge function requires a credential.** `supabase/functions/events-webhook` runs with `verify_jwt` off (F-039), so it must verify its own shared secret: an `x-webhook-secret` header compared constant-time against a function secret, 401 otherwise, plus payload validation with the same zod schema the classifier pipeline uses (Area 2). Deno tests if `deno` is available locally (research checks); otherwise the handler's pure verification function is extracted and tested under Jest. Deploying the function is an owner action (recorded), never done here.
- **Recommendations are characterized, not changed.** Table-driven PRESERVE suites pin input → ranked output for `/api/recommendations` (and `batch`, `feedback`, `analytics`) through the fake, with the scoring weights (0.35/0.25/0.20/0.15/0.05) and MMR asserted unchanged; F-041 (empty `user_event_scores` → popularity fallback) is pinned as today's behaviour and its cause recorded for Phase 8's operational drill; F-017 (A/B assignment silently degrades for non-admins) is fixed by writing `experiment_assignments` through the elevated door with a REGISTRY row, so assignment works for every caller (INTENTIONAL BEHAVIOUR CHANGE).
- **F-028 remainder.** `notifications/count` → 401 for anonymous; `GET /api/events/[id]/rsvp` and `GET /api/clubs/[id]/events` stay 200 for anonymous but become `private, no-store` (Area 3). F-092 (`GET /api/admin/reports` PostgREST embed 500) is fixed here by correcting the select; slice 6 owns the admin-family adjacency.
- **Email.** No provider is added: the "email reminders" Validated bullet is contradicted by F-038 and stays a recorded product gap for the owner; in-app notifications are the delivered channel.

### Area 2 — Contracts (REFAC-15, REFAC-16)
- **zod is installed** (exact pin, latest stable, legitimacy bundle recorded non-blocking — it is the ecosystem standard; DEC-59's rule-resolution pattern applies). Schemas live in `src/contracts/<family>.ts` (events, clubs, users, admin, notifications, recommendations, interactions, feedback, webhook), exported with `z.infer` types.
- **One boundary helper.** `readJsonObject()` from Phase 5 gains a `parseBody(request, schema)` sibling in `src/server/body.ts` that returns the seam's discriminated result; the 400 shape stays the existing vocabulary `{ error: <message>, field: <first invalid path> }` so PRESERVE pins hold; a handler whose 400 text changes gets a DEFECT test citing REFAC-15 and a ledger row. Query-string parsing uses the same schemas (`z.coerce`). No handler parses raw JSON after this phase — a census gate (`scripts/check-contracts.mjs`) fails on `request.json()` outside `src/server/body.ts`.
- **Client reuse.** Hooks under `src/hooks/` and the fetch call sites in components import the request/response schemas from `src/contracts/` for typing (`z.infer`) and parse responses in development only (a `safeParse` that logs, never throws in production), so client and handler cannot drift without a type error.

### Area 3 — Slice 7 caching (REFAC-19)
- **The blanket header goes.** `vercel.json` loses the `/api/(.*)` `Cache-Control`. A `cachePolicy` helper in `src/server/http.ts` sets `Cache-Control: private, no-store` on every response of a personalized or auth-gated route and `public, s-maxage=60, stale-while-revalidate=300` explicitly on the routes the endpoint contract classifies public-cacheable (events list/detail/popular/happening-now/featured, public club pages' data, `/api/health` liveness only). The classification is data-driven from `.planning/audit/inventory/endpoints.json` (`personalization`/auth columns) and a census test asserts every route file calls the helper.
- **Cross-user cache regression test.** Playwright: user A fetches a personalized route, user B fetches the same URL, assert B never receives A's data and every personalized response carries `private, no-store`; a header sweep across all routes from the endpoint table. Closes F-025, F-026, DI-26.

### Area 4 — Observability (REFAC-20, REFAC-21, REFAC-22)
- **Logger: hand-rolled, no dependency.** `src/server/log.ts` emits one JSON line per event (`level`, `msg`, `requestId`, `route`, `ts`, extra fields), works on Node and in the proxy, and replaces every `console.*` in server code (routes, `src/server/`, `src/lib/` server modules, the proxy, the callback) mechanically; the request id comes from `createRequestContext()` and is echoed as an `x-request-id` response header. Client components keep `console` (out of scope). `logAdminAction`'s error line moves to the logger.
- **Sentry.** `@sentry/nextjs` exact pin (legitimacy bundle, rule-resolved). Decided BEFORE install: `sendDefaultPii: false`; `beforeSend` strips emails, cookies, request bodies and query strings, keeps a hashed user id; `environment` from `VERCEL_ENV`, `release` from `VERCEL_GIT_COMMIT_SHA`; the request correlation id attached as a tag on every event; DSN absent → Sentry disabled with one log line (never fails boot); Turbopack-aware setup per `node_modules/next/dist/docs/` (`instrumentation.ts` `register()` + `onRequestError`, `instrumentation-client.ts`); source-map upload needs `SENTRY_AUTH_TOKEN` — configured as an owner action, the build must succeed without it. The "deliberately triggered error appears in Sentry with the correlation id" clause is proven locally with the SDK's transport mocked (event payload asserted) and recorded as a human-verify item for the first real DSN.
- **Health.** `/api/health` returns a documented shape (`docs/health.md`): anonymous callers get liveness only `{ status, version }`; the full report (`checks.db`, `checks.auth`, `checks.storage`, `checks.pg_cron` last-run age, `checks.webhook` last receipt) requires `requireRole(ctx, "admin")` or a validated optional `HEALTH_TOKEN` bearer for uptime monitors; `getSession()` is removed (the one remaining call). pg_cron freshness comes from `cron.job_run_details` through the elevated door with a REGISTRY row; last webhook receipt from the newest event whose source is the scraper (no new table). Closes F-029. Always `private, no-store`.

### Area 5 — Close-out and discipline
- **Slice order:** 6 (async edge + contracts for its families) → 7 (contracts for everything else, caching, logger, Sentry, health). Each slice: characterize → refactor → floor (Jest, pgTAP, Playwright, ratchet, tag gate, `scripts/check-contracts.mjs`) → close note; the phase completion note re-confirms all 16 Validated workflows.
- **F-054 `/docs` public** is gated behind `requireRole admin` (INTENTIONAL, low risk); **F-055 CSP** gets `'unsafe-eval'` removed if the build allows it and a nonce-based script policy only if Next 16 supports it without breaking hydration (research decides; otherwise DI to Phase 8); **DI-21** adds the local Supabase origin to `connect-src` only in development builds. **F-058/F-059:** the shared error vocabulary from the seam replaces internal error text at the forty sites; every handler wrapped by the seam's try/catch with the logger.
- **F-084/F-085** (Low): fix if a one-place change exists, otherwise re-point to Phase 7 with a note. **DI-53** (supabase-js minor): retype the four admin payload sites in slice 7, then take the bump as the last code change after a throwaway-worktree tsc proof.
- **Numbering:** DEC-60+, DI continues after the register's highest (the Phase 5 fixer proposals DI-61..77 are registered or dropped first), F-093+. `findings.json` edited surgically. Owner checkpoints resolved by rule with the completion note listing them. No production write; the deploy-facing prerequisites (Sentry DSN and auth token, webhook secret, Upstash) are Phase 8 owner actions.

### Claude's Discretion
- File names and family split under `src/contracts/`; the exact logger field set; commit grouping of the `console.*` sweep; how the cache classification is encoded (a generated map versus per-route calls), provided the census test exists.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- The seam (`src/server/context.ts`, `authz/*`, `errors.ts`, `http.ts`, `body.ts` with `readJsonObject()`, `db/elevated/` + REGISTRY.md, `ratelimit/`, `csrf.ts`), `src/lib/env.ts` validated readers, `src/instrumentation.ts` boot check.
- Characterization method: table-driven PRESERVE/DEFECT suites with `createFakeSupabase`, file-level tags, the defect ledger; Phase 5's `writeHandlerTable.ts` / `adminArmTable.ts` shape.
- Harness: Playwright persona specs (91 passing), pgTAP (200), the ratchet, the tag gate, `scripts/pgtap-mutation-check.sh` (now with a trap).
- Audit registers: `.planning/audit/inventory/endpoints.json` (personalization/auth per route), `.planning/audit/cache/`, `.planning/audit/async/`, `.planning/audit/authz/fail-open-register.md` (FO-02/FO-04), `.planning/audit/quality/error-observability.md`.

### Established Patterns
- Errors returned not thrown; wire bytes preserved unless a DEFECT names the finding; INTENTIONAL BEHAVIOUR CHANGE in commit bodies; migrations fix-forward and local-only; explicit `git add` paths; sequential executors on the main tree; stall-avoidance rules (no interactive DB sessions, time-boxed commands, one DB client at a time).

### Integration Points
- `vercel.json` headers; `next.config.js` CSP; `src/app/api/cron/*`, `src/app/api/health/route.ts`, `src/app/api/recommendations/*`, `src/app/api/notifications/*`, `src/app/api/interactions`, `supabase/functions/events-webhook/index.ts`, `src/lib/classifier-pipeline.ts`, `supabase/config.toml`, `src/hooks/*`, `src/app/docs`.

</code_context>

<specifics>
## Specific Ideas
- Keep `applyApiRateLimit`, the proxy matcher and `PROTECTED_ROUTES` untouched; the logger integrates into the proxy without adding work between `createServerClient` and `getUser`.
- Every new dependency (zod, @sentry/nextjs) gets a legitimacy bundle in evidence and an exact pin; the lockfile changes only by those installs and the DI-53 bump.
- Completion note mirrors Phase 5's, plus a "deploy prerequisites for Phase 8" section (Sentry DSN/auth token, webhook secret, Upstash, pg_cron parity, production migrations pending DI-23).

</specifics>

<deferred>
## Deferred Ideas
- An email provider (F-038): owner/product decision; not part of the foundation program.
- Nonce-based CSP if Next 16 hydration cannot carry it without regressions (DI to Phase 8).
- `@supabase/ssr` major (Phase 8), storage bucket policies (Phase 8), DI-39/DI-40/F-078/DI-41 (owner).
- Replacing the hand-rolled logger with pino/OpenTelemetry (later milestone).
</deferred>
