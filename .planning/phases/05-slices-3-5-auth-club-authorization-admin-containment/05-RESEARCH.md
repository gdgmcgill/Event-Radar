# Phase 5: Slices 3–5 — Auth, Club Authorization, Admin Containment - Research

**Researched:** 2026-09-23
**Domain:** Server-side authorization (Next.js 16 proxy + Route Handlers), Supabase RLS / column grants, service-role containment, distributed rate limiting, CSRF
**Confidence:** HIGH on the codebase inventory and the RLS measurements (read from source and probed on the local stack); MEDIUM on Upstash provisioning details; LOW only where tagged `[ASSUMED]`

## Summary

Phase 5 moves every authorization decision into the Phase 3 seam (`src/server/`), proves cross-tenant and escalation denials at the RLS ring with pgTAP, puts the service-role client behind one registered door, and adds a distributed rate limiter and a CSRF origin check to the proxy. The seam kit already has the right shape: `requireUser`, `requireRole` (fails closed on a missing profile) and `requireClubRole` (no admin bypass, takes a custom 403 message). Most of the work is mechanical adoption at about 60 call sites. Every call site must keep its response bytes, and this document lists them.

The research found **seventeen places where CONTEXT.md rests on a premise the code or the database contradicts** (§ "Corrections to CONTEXT premises"). Five of them would break a Validated workflow if the plan followed CONTEXT literally:
1. The F-006 column grant as written breaks **event saving**. A `SECURITY INVOKER` trigger updates `users.saved_events_count`. The grant also breaks `/api/profile/inferred-tags`. Both failures were measured.
2. The onboarding wizard writes through `PATCH /api/users/[id]` and `POST /api/onboarding/complete`. A blanket `requireOnboarded` would make onboarding impossible to finish.
3. Moving the F-005 profile page to the cookie client makes every public profile 404. RLS lets a user read only their own `users` row.
4. Returning 401 from all eight F-028 routes blanks the RSVP counts and the club event lists that anonymous visitors see today.
5. An import-time throw in `src/lib/env.ts` breaks `next build` in CI, which has no service key. Keying "production" on `NODE_ENV` breaks the Playwright harness, which runs `next start` under `NODE_ENV=production`.

At the RLS ring, three holes were measured live on the local stack, each inside a rolled-back transaction:
- An anonymous caller can forge `admin_audit_log` rows (F-007).
- Any user can set their own `roles` to admin (F-006).
- `cross_club_attacker` can insert an **approved** event into another club with a forged `created_by` (F-008). `findings.json` already assigns F-008 to Phase 5, but CONTEXT does not name it. Success criterion 2 ("independently denied at the RLS ring") cannot be met without fixing it.

Club owners also **cannot edit their own club today**. `clubs` has no owner UPDATE policy, so `PATCH /api/clubs/[id]` on the cookie client matches 0 rows and returns 500. `DELETE` silently does nothing but still returns `{ success: true }`.

**Primary recommendation:** Run slices 3 → 4 → 5 as CONTEXT orders, with these adjustments:
- Adopt the corrections table as planner inputs.
- Make every code change correct against **both** the migrated local schema and the unmigrated production schema, because migrations stay local until Phase 8.
- Route owner and admin writes that RLS cannot express through `getElevatedClient()`, each with a REGISTRY row. Do not widen policies.
- Pin `@upstash/ratelimit@2.1.0` and `@upstash/redis@1.38.4` exactly, behind a `checkpoint:human-verify`.
- Keep the in-memory limiter's synchronous `applyApiRateLimit` byte-identical, so its PRESERVE suite passes unedited.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Area 1 — Slice 3: auth ring, ban, onboarding, validated config (REFAC-11)
- **Validated config replaces every `process.env.X!` assertion.** A hand-rolled `src/lib/env.ts` (no new dependency; zod arrives with `src/contracts/` in Phase 6) exports typed readers that throw a named error at first import when a required variable is absent or empty: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only). `ADMIN_API_KEY` and `ADMIN_EMAILS` are deleted from the code rather than validated (F-040's "delete the code that reads it" branch, see below). `CRON_SECRET` is Phase 6's and is not touched. The browser client keeps literal `process.env.NEXT_PUBLIC_*` reads (Next inlines them at build) wrapped in the same non-empty check. Closes F-003's config half and the `!` half of REFAC-11.
- **The proxy becomes advisory for authorization and fails closed on its own errors.** It keeps session refresh, cookie cleanup, rate limiting, the CSRF origin check (Area 3) and UX redirects (anonymous on a protected page → sign-in; banned on a page → `/banned`; un-onboarded on a page → `/onboarding`). The env-conditional pass-through at `src/proxy.ts:14-16` is removed (config validation makes it unreachable). The outer `catch` no longer returns `NextResponse.next()`: on any thrown error it returns 500 — JSON `{ error: "Failed to process request" }` under `/api/`, a plain 500 response otherwise. A failed ban read is an error, never "not banned". Authorization for every API handler is re-made inside the handler by the seam; nothing in the proxy is load-bearing for authz.
- **Ban enforcement moves into the seam and fails closed.** `RequestProfile` re-adds `banned_at` and `ban_expires_at` (DEC-24 anticipated this), and a new guard `requireActiveUser(ctx)` (401 when anonymous, 403 `{ error: "Account suspended" }` when banned — the exact bytes `checkBanStatus()` emits today, so the ten callsites migrate without a wire change). Fail closed: an authenticated user with no readable profile row is denied, not waved through. `src/lib/ban.ts` keeps `isBanned()` as the one predicate and `checkBanStatus()` is deleted once its ten callers are migrated. The proxy answers a banned user's `/api/*` request with the same 403 JSON instead of a 307 to HTML (F-062); page requests still redirect to `/banned`. Which handlers gain ban enforcement they lack today (for example the DELETE arms of save and rsvp, whose asymmetry the Phase 4 PRESERVE suites pin) is decided per handler by the characterization step: the default is "every state-changing authenticated handler", the PRESERVE pins that encode the asymmetry are retagged DEFECT against F-062/F-069 with the finding named, never silently edited.
- **The onboarding guard reads database truth and holds at the API ring.** The proxy reads `onboarding_completed` in the same single `users` query as the ban columns (no new round-trip) and stops trusting the deletable `needs_onboarding` cookie as the source of truth (the cookie may remain as a hint; the callback keeps setting it). A new seam guard `requireOnboarded(ctx)` (403 `{ error: "Onboarding required" }`) is applied to every state-changing (non-GET) authenticated API handler. GET handlers stay readable for an un-onboarded user. Exemptions: `/auth/signout` and nothing else — the onboarding wizard writes `users` through the browser client under RLS, not through an API route, so no API exemption is needed; the planner re-verifies this by grep before the guard lands. `mid_onboarding_student` gets a Playwright spec: page → redirect to `/onboarding`, direct POST → 403.
- **The auth callback fails closed, stops granting roles, and validates `next`.** (a) `ADMIN_EMAILS` and the sign-in-time admin grant are deleted (F-004); production has never had the variable (F-040), so nothing changes there. Admin role changes happen only through `PATCH /api/admin/users/[id]` by an existing admin, on another user, with an `admin_audit_log` row — that route's "strip admin" special case is removed and the change is logged as INTENTIONAL BEHAVIOUR CHANGE. (b) The profile upsert is no longer optional: a failed upsert or profile read signs the user out and redirects with `?error=profile_sync_failed` (FO-05's fail-open onboarding half). (c) `next` is accepted only when it starts with `/` and not `//` (F-077), with the unit case asserting an absolute and a protocol-relative value both land on `/`. (d) The inline `createClient(url, serviceKey)` for deleting a non-McGill `auth.users` row and the `createServiceClient()` upsert both go through `getElevatedClient()` with REGISTRY.md rows. (e) The three `as any` casts named by research are removed if present.
- **Dependency moves in this phase.** The `@supabase/supabase-js` minor (2.81.1 → 2.116.0, DEC-28) is taken at the END of slice 5 as its own commit, after the eight blocking sites (six admin/club routes, `audit.ts:38`, `events/[id]/route.ts` PATCH) have been rewritten by the slices that own them, with the site list in the commit body. The `@supabase/ssr` major (0.7 → 0.12) is NOT taken in Phase 5: it changes cookie and session handling under the exact surface this phase refactors, and the harness cannot separate its effects from the slice's. It moves to Phase 6 close-out at the earliest, Phase 8 by default.

#### Area 2 — Slice 4: club authorization and the RLS ring (REFAC-12)
- **One guard, no widening.** Every hand-rolled `club_members` check in an API handler collapses into `requireClubRole(supabase, clubId, user.id, acceptedRoles)`, and each call passes exactly the role set that site accepts today (`club_members.role` is `string` in the schema; the seed and handlers use `owner`, `admin`, `member` — the planner enumerates the literal set per site from the code, never from memory). No site-wide admin bypass is added (the guard's docblock, persona rule R9). Pages that read `club_members` server-side (`/clubs/[id]`, `/my-clubs`, `/invites/[token]`, `/profile`, `/users/[id]`) use `getRequestContext()` plus the same guard where they gate an owner surface; read-only membership listings are not authorization decisions and may keep a plain select.
- **Status contract.** Anonymous → 401 `{ error: "Unauthorized" }`; authenticated non-member → 403; member with the wrong role → 403. Where a route today returns something else for one of those personas, the PRESERVE test pins today's bytes and the change is tagged DEFECT against F-028 or F-061 with the finding named; routes among F-028's eight that belong to recommendations/notifications go to Phase 6.
- **The RLS ring is proven, not assumed.** For every club-scoped table a handler writes (`clubs`, `club_members`, `club_invitations`, `events` with `club_id`, and any other the planner finds), a pgTAP test impersonates `cross_club_attacker` with `set local role authenticated` plus the persona's `request.jwt.claims`, and asserts the cross-club write affects zero rows or raises `42501`, and that the same write by `club_owner` on their own club succeeds (both directions, never `lives_ok` alone). Missing or too-wide policies are fixed by fix-forward migrations (new files only; `20260915230000` and `20260916000000` are never edited), `src/lib/supabase/types.ts` is regenerated in the same commit so the CI type-drift gate stays empty, and the local `supabase db reset` plus `supabase test db --local` must pass after every slice.
- **F-016 (invitation acceptance).** The Phase 3 migration `20260916000000_invitation_policy_fixes.sql` already holds the invitee policies locally. Slice 4 adds the integration test the finding asks for (A invites B, B lists and accepts, B is a member) against the local stack, and F-016 moves to Fixed-locally with a note that production stays broken until the Phase 8 migration repair (DI-23). No production write.
- **Storage policies (F-030) are not in this phase.** The buckets exist only in production (DI-33). The cross-tenant storage path is recorded in the completion note as open, owned by Phase 8 with DI-33.

#### Area 3 — Slice 5: admin containment, service role, rate limiting, CSRF (REFAC-13, REFAC-17, REFAC-18)
- **`verifyAdmin()` becomes the seam's `requireRole(ctx, "admin")`.** Anonymous callers get 401 (F-061; today 403), authenticated non-admins keep 403. `src/lib/admin.ts` is deleted once its 25 callers are migrated (24 under `/api/admin/**` minus `calculate-popularity` which never called it, plus `recommendations/analytics` and `recommendations/batch`). The `expected_status` column in `.planning/audit/inventory/endpoints.json` is updated in the same change through the generator, never by hand, so contract and code agree. Inline `roles.includes("admin")` checks in handlers are removed in favour of the guard.
- **Fail-open endpoints fail closed.** FO-01 `calculate-popularity`: the `ADMIN_API_KEY` gate and `createAdminClient()` are deleted; both verbs use `requireRole(ctx, "admin")`; the RPC runs on `getElevatedClient()` with a REGISTRY row (F-010 says writes to `event_popularity_scores` are service-role only by design). `recommendations/analytics` (research: no role check) gets the same guard. FO-02/FO-04 (cron) are Phase 6 and are not touched.
- **Every non-cron service-role callsite goes through the door.** The 23 non-cron entries in `eslint.elevated-allowlist.mjs` (21 route files, `src/app/users/[id]/page.tsx`, `src/lib/audit.ts`, and the auth callback) migrate to `getElevatedClient()` or to the cookie client, one commit each or grouped by route family, each with a REGISTRY.md row whose justification is honest ("`users` has no admin UPDATE policy; adding one is a policy change deferred to …" is acceptable, "it was easier" is not). The allowlist is regenerated to exactly the two cron routes at phase exit — that is the Phase 5 target state, and Phase 6 empties it. The ratchet stays green throughout (it only shrinks).
- **F-005 public profile page.** Reads move to the cookie client; the select drops `email`; `generateMetadata()` gets the same gate as the page; a target whose `visibility` is not public is `notFound()` for anonymous callers. Logged as INTENTIONAL BEHAVIOUR CHANGE (private profiles stop leaking to anonymous readers). The planner confirms the current `visibility` values from the seed and the profile settings UI before choosing the predicate.
- **`logAdminAction` (F-073, F-072): attribute by `admin_user_id`, make failure loud.** Option (b) of the finding: `admin_email` is dropped from the insert (the live and local schemas have no such column, and this is what makes DEC-28's `audit.ts:38` type error disappear), the insert result is inspected and a rejected write is logged with `console.error` and the request id (the structured logger is Phase 6), and both moderation pages stop selecting `admin_email` and join `users(name, email)` through `admin_user_id` instead. Chosen over the "restore the column by migration" option because it works in production on deploy without waiting for the Phase 8 migration repair. The integration test asserts exactly one audit row per moderation action (F-007's test, which cannot pass today).
- **F-006 and F-007 close at the RLS ring locally, by fix-forward migration with pgTAP.** F-007: drop both `admin_audit_log` INSERT policies and `REVOKE INSERT ... FROM anon, authenticated`; the only writer is the elevated door. F-006: revoke the table-level UPDATE grant on `users` from `authenticated` and re-grant it column-scoped to the profile columns (`name`, `avatar_url`, `pronouns`, `year`, `faculty`, `visibility`, `interest_tags`, `banner_url`, `onboarding_completed`, plus `updated_at`), with pgTAP asserting a non-admin cannot set `roles` or clear `banned_at` while a bio-style update succeeds. RISK, stated for the owner: both are Critical and both stay open in production until the Phase 8 migration repair. The owner may authorize an earlier targeted production apply of these two migrations; the phase does not do so on its own (orchestrator decision 3: production is never touched).
- **`/api/admin/*` joins rate limiting, from a distributed store.** The limiter is refactored behind a small `RateLimitStore` interface with two implementations: the existing in-memory map (tests, local dev, CI) and an Upstash Redis REST implementation (`@upstash/ratelimit` + `@upstash/redis`, the platform-native Vercel Marketplace integration, configured by `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Store selection is by validated config: in production the Upstash variables are required (fail at boot), elsewhere absence falls back to memory with a logged warning. Admin routes get a generous per-IP-per-path budget stated with rationale in the plan (planner default: 600 GET/min, 120 mutation/min) and a test asserting 429 after the budget. Provisioning the Upstash store on Vercel is an owner action recorded as a Phase 8 deploy prerequisite; the phase must not create billable resources. The Redis implementation has a contract test that runs only when the variables are present and is reported as skipped, not passed, otherwise.
- **CSRF: assess, then add one origin check.** A written assessment (`evidence/csrf-assessment.md`) establishes that `@supabase/ssr` sets the auth cookies `SameSite=Lax`, so cross-site form POST and cross-origin `fetch` do not carry the session; residual exposure is (1) any state-changing GET handler, (2) the `needs_onboarding` cookie, (3) legacy browsers. The planner enumerates state-changing GETs from the inventory (expected: none). Defence in depth: the proxy rejects a non-GET `/api/*` request with 403 JSON when `Sec-Fetch-Site` is `cross-site`, or when an `Origin` header is present and does not match the request host. Requests with neither header (curl, cron callers, server-to-server) are allowed — the check must not break the Phase 6 machine routes. Same-origin browser fetches are unaffected. A Playwright or route test proves both arms.
- **DI-36 (`pending_edits` never returned).** Fixed in slice 5 as a visibility restoration: `GET /api/events/[id]` attaches `pending_edits` for the creator and for admins only, after the shared transform (the shared transform is not changed, so list routes are unaffected). Registered as F-086 through the generator-backed findings edit. Logged as INTENTIONAL BEHAVIOUR CHANGE; no seeded event carries `pending_edits`, so no seeded-visible change.

#### Area 4 — Slice discipline, harness, evidence
- **Three slices, each one reviewable change.** Slice order is 3 → 4 → 5. Each slice: characterization tests first (PRESERVE/DEFECT tagged with the `F-nnn`, gate `scripts/check-characterization-tags.mjs --all` green), refactor, then the full floor: `npx jest --ci` at or above the Phase 4 floor (744 passed, 0 skipped), `supabase test db --local`, and the Playwright suite at 40/0 plus the specs this phase adds. A slice-close note under `evidence/` names the finding IDs it closes and every intentional behaviour change; the Validated workflow list in PROJECT.md is re-confirmed after each slice, in particular: every persona signs in, non-McGill sign-in is rejected, banned users are blocked, organizers reach their club surfaces.
- **Harness additions.** New Playwright specs for: banned persona → 403 JSON on `/api/*` and `/banned` on pages; `mid_onboarding_student` direct POST → 403; `cross_club_attacker` → 403 on every club mutation route; anonymous admin route → 401 and `onboarded_student` → 403; an admin moderation action producing exactly one `admin_audit_log` row; the CSRF arms. DI-38's `save-and-rsvp.spec.ts:53` race is fixed in slice 3 (re-read saved state after `page.reload()` through `page.request.get`), because a flaky harness in the auth slice is unacceptable.
- **Seed changes are permitted, additively.** New rows or personas required by a Phase 5 test are added under fixed UUIDs, idempotently, with `040-seed-coverage.test.sql` extended; no existing seeded value changes, so every Phase 4 pin remains valid. A pending invitation for the F-016 test and a user profile with `visibility` not public for F-005 are the expected additions.
- **Registers and numbering.** Decisions continue at DEC-33, deferred items at DI-41, findings at F-086; `findings.json` is edited only through the generator (Phase 4 method). Production is never touched; the completion note lists every closure that is local-only pending DI-23.
- **Owner checkpoints resolved by rule.** Where a plan needs an owner answer and none arrives, the behaviour-preserving option is taken, the deviation is logged in the plan summary, and the completion note lists it — the Phase 4 04-11 precedent.

### Claude's Discretion
- Exact role literals per `requireClubRole` call site, derived from code.
- Whether ban and onboarding guards are composed into `createRequestContext()` helpers or stay as separate guards, provided the response bytes above hold.
- Grouping of the 23 service-role migrations into commits.
- The Redis key schema and window for the Upstash limiter, provided the existing GET/POST budgets and headers are preserved for non-admin routes.
- File and test naming, following the Phase 3–4 conventions.

### Deferred Ideas (OUT OF SCOPE)
- `@supabase/ssr` 0.7 → 0.12 major: Phase 6 close-out at the earliest, Phase 8 by default (cookie/session handling; not under the auth slice).
- F-030 and the storage bucket policy family (F-024, F-031–F-035): Phase 8 with DI-33 (buckets are production-only, declared by no migration).
- F-078 (`search_events_fuzzy` STABLE + GUC): making fuzzy search live changes public search results; owner decision, carried with DI-39/DI-40.
- DI-22 (`/moderation?status=pending` ignored): a moderation-page behaviour fix outside REFAC-11/12/13; carried to the phase owner.
- Storage of a per-user (rather than per-IP) rate-limit key for authenticated admin callers: possible once the proxy trusts a verified user id; not needed for REFAC-13's clause.
- A dedicated "grant admin" administrative endpoint with two-person approval: the existing admin PATCH with an audit row satisfies F-004; anything richer is product work for a later milestone.
- Wrapping every handler in a shared route wrapper (F-058's full recommendation: try/catch + request id + limiter): the request-id and logger halves are Phase 6 (REFAC-20); Phase 5 delivers only the rate-limit clause for `/api/admin/*`.
- Column-scoped grants for tables other than `users` and TO-clause hygiene across all 61 policies (F-018): only policies rewritten by a Phase 5 migration gain a `TO` clause; the sweep is Phase 7's pgTAP-per-table work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFAC-11 | Slice 3: `getUser()` at every authorization decision, middleware advisory-only, the ban check fails closed, onboarding guard not bypassable by direct API calls, env non-null assertions replaced by validated config | § Slice 3 inventory. There is exactly one `getSession()` in `src/`: `api/health:160`. It is non-gating and out of scope, so clause 1 is a grep gate. The ten `checkBanStatus` callers are listed with line numbers. Onboarding exemptions are corrected (C2). The `!` inventory covers 7 files. The env-module constraints are C8/C9. Proxy wire bytes are in § Wire bytes |
| REFAC-12 | Slice 4: the 19 hand-rolled club-membership checks collapse into `requireClubRole`; a cross-club attempt returns 403 at the authz ring and is denied at the RLS ring | § Club authorization call-site table: 17 gate or flag sites with exact role sets and messages, plus reads that stay plain selects. § RLS ring matrix: measured allow/deny per table. F-008 must be fixed (C10). Owner writes are broken (C11) |
| REFAC-13 | Slice 5: fail-open endpoints fail closed, `verifyAdmin()` guards every admin route, every service-role use through `src/server/db/elevated/` with a justification, `/api/admin/*` rate limited | § Admin handler table: 33 callsites in 25 files, with each site's deny body (3 routes answer 401 to non-admins). § Service-role table: 25 files, per operation, whether RLS permits it on the cookie client. § Rate limiter design |
| REFAC-17 | CSRF exposure assessed (SameSite on Supabase cookies), protection on state-changing routes where exposure remains | § CSRF assessment inputs, verified in `node_modules/@supabase/ssr/dist/main/utils/constants.js`: `sameSite: "lax"`, `httpOnly: false`, no `secure`. State-changing GETs: the `/invites/[token]` page and `recommendations` GET (experiment assignment insert) |
| REFAC-18 | Rate limiting on a distributed store across serverless instances | § Rate limiter design. The Upstash API was read from the 2.1.0 / 1.38.4 tarballs. There is a store interface and a test plan. The env-name mismatch with the Vercel Marketplace integration is C13 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Effect on this phase |
|---|---|---|
| Next.js 16; the file is `src/proxy.ts`, never `middleware.ts`; read `node_modules/next/dist/docs/` before asserting API behaviour | CLAUDE.md | Proxy runs on the **Node.js runtime by default and the `runtime` config option throws in proxy files** [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:253-255] |
| `PROTECTED_ROUTES` at `src/proxy.ts:114` is the only authority for the eight routes; `e2e/fixtures.ts` re-derives it by regex | CLAUDE.md, fixtures.ts:43-60 | Keep the array literal on one line with the same identifier, or the fixture parser throws |
| Three Supabase clients; `createServiceClient()` only for admin/cron | CLAUDE.md | Only `src/server/db/elevated/` may wrap it (ESLint boundary) |
| Jest is the only unit runner, with two projects (node: `src/**/*.test.ts` minus hooks; jsdom: `*.test.tsx` + `src/hooks/**`). Test files are type-checked. Route handlers in tests are typed as `(typeof import(".../route"))["GET"]`; never widen a route signature | CLAUDE.md, .claude/CLAUDE.md | New handler tests follow the Phase 4 `createFakeSupabase` pattern |
| Never modify `.env.local`; McGill email enforcement stays | CLAUDE.md | The callback rewrite keeps `isMcGillEmail` and the not_mcgill path byte-identical |
| API errors: `NextResponse.json({ error }, { status })`, 400/401/403/404/500, `console.error` before error returns | .claude/CLAUDE.md | Seam `errors.ts` already emits these bytes |
| Behaviour preservation is the core value; refactor style is tested vertical slices | .claude/CLAUDE.md | Every change is a PRESERVE pin or a DEFECT retag naming an F-nnn |
| Use `EventTag` enum, `@/` alias, named exports, `"use client"` only on client files | CLAUDE.md | — |
| Executors stage explicit paths (untracked `.agents/`, `docs/product-master-plan.md`, `skills-lock.json`); `use_worktrees=false`; no `timeout` binary on macOS | CONTEXT code_context, memory | Plans must list `git add <paths>` explicitly |
| Production Supabase is never touched; local stack only | orchestrator / CONTEXT | pgTAP and probes use `supabase test db --local` / `docker exec supabase_db_Event-Radar psql` |

---

## Corrections to CONTEXT premises (planner inputs — read first)

Each row is something CONTEXT asserts or assumes that the code or the database contradicts. **The planner should treat each "Recommended handling" as the default, logged as a rule-resolved deviation (Area 4 last bullet), unless the owner signs otherwise.**

| # | CONTEXT premise | What is actually true (evidence) | Recommended handling |
|---|---|---|---|
| C1 | "the seed and handlers use `owner`, `admin`, `member`" | `club_members_role_check` allows **only `'owner'` and `'organizer'`** (`supabase/migrations/20260915214553_baseline.sql:688`); the column defaults to `'organizer'` (:686); `scripts/seed/personas.ts` SeedMembership says the same. No handler gates on `admin`/`member`. `src/app/users/[id]/page.tsx:159-161` filters for `"organizer" \| "admin" \| "president"` for display only | Two literals exist: `["owner"]` and `["owner","organizer"]`. Add `export const CLUB_ROLES = ["owner","organizer"] as const` next to the guard so call sites cannot pass a typo; `ClubRole` is `string` today (`requireClubRole.ts:29`) [VERIFIED: codebase] |
| C2 | "the onboarding wizard writes `users` through the browser client under RLS, not through an API route, so no API exemption is needed" | `src/components/onboarding/OnboardingWizard.tsx:61` calls **`PATCH /api/users/${userId}`** (with `onboarding_completed: true`), then `:79` calls **`POST /api/onboarding/complete`**, which clears the cookie. A blanket `requireOnboarded` on non-GET handlers would 403 both, and onboarding could never complete | `requireOnboarded` exemptions: `POST /api/onboarding/complete` and `PATCH /api/users/[id]` (self-update only; that route already 403s `user.id !== id`). Keep `/auth/signout` (not under `/api`). Also decide the anonymous-tolerant telemetry writers (`/api/interactions`, `/api/feedback`). Recommended: apply the guard only when `ctx.user` is present, so anonymous behaviour is unchanged [VERIFIED: codebase] |
| C3 | F-006 column grant = `name, avatar_url, pronouns, year, faculty, visibility, interest_tags, banner_url, onboarding_completed, updated_at` | **Measured on the local stack** (rolled-back txn, grant exactly as listed). `UPDATE users SET roles` → `permission denied` ✓. Profile update ✓. **`INSERT INTO saved_events` → `ERROR: permission denied for table users`, CONTEXT: `update_saved_events_count()`**: the trigger is `SECURITY INVOKER` (baseline:593-613) and updates `saved_events_count` as the caller. **`UPDATE users SET inferred_tags` → permission denied**, and `src/app/api/profile/inferred-tags/route.ts:41-43` does exactly that on the cookie client | Add `inferred_tags` to the grant. For `saved_events_count`, either (a) make `update_saved_events_count()` `SECURITY DEFINER SET search_path = ''` with a schema-qualified body (recommended: users cannot set their own counter), or (b) add the column to the grant. pgTAP must assert "authenticated user can save an event" after the migration. Also revoke UPDATE from `anon` (baseline:2700 grants ALL to anon) [VERIFIED: local stack probe] |
| C4 | "`recommendations/analytics` (research: no role check)" | `src/app/api/recommendations/analytics/route.ts:16-18` already calls `verifyAdmin()` and 403s `{ error: "Forbidden" }` | Mechanical `requireRole` migration only; not a fail-open closure. FO-01 (`calculate-popularity`) is the only fail-open admin route [VERIFIED: codebase] |
| C5 | "both moderation pages … join `users(name, email)` through `admin_user_id`" | `admin_audit_log.admin_user_id` references **`auth.users(id)`** (baseline:1705), not `public.users`. PostgREST cannot embed `users(...)` across that FK (auth schema is not exposed) | Two-query enrichment: read audit rows, then `users.select("id, name, email").in("id", ids)` on the **cookie** client. The `Admins can view all profiles` policy permits it. Or add an FK to `public.users` by migration (schema change, local-only until Phase 8, rejected on the same reasoning CONTEXT used for F-073) [VERIFIED: baseline] |
| C6 | F-005: "Reads move to the cookie client" | `users` SELECT policies are `Users can read own profile` (`auth.uid() = id`) and `Admins can view all profiles` only. On the cookie client, **every non-admin viewer, including anonymous, reads zero rows for another user**, so `notFound()` for every public profile. The page also reads the target's `saved_events`, `club_members`, `rsvps` and `get_friends` (page.tsx:102-138), which own-row policies also deny | Keep the privileged read, but through `getElevatedClient()` with a REGISTRY row ("public profile of another user; `users` has no public-read policy and adding one would expose `email`/`roles`/ban columns at row level"). Select `id, name, avatar_url, banner_url, pronouns, year, faculty, visibility, interest_tags, created_at` (no `email`). Apply one shared gate in `generateMetadata()` and the page: anonymous + `visibility === "private"` → `notFound()`. That matches the page's existing `isPublic = target.visibility !== "private"` (:143); the values are `public`/`private` (`api/users/[id]/route.ts:157`). F-005's validation grep ("no `createServiceClient()` in the page") is still met [VERIFIED: pg_policies + codebase] |
| C7 | F-028: anonymous → 401 on the eight routes (minus notifications/recommendations) | Two of the eight feed **public** UI. `GET /api/events/[id]/rsvp` returns public counts to anonymous visitors and `RsvpButton.tsx:36-39` renders them. `GET /api/clubs/[id]/events` is the public club event list (`src/hooks/useClubs.ts:28,39`). A 401 blanks both, breaking the Validated "anonymous browse" and "public club pages show upcoming and past events" | 401 for `events/following`, `events/friends-activity`, `events/friends-organizing` and `events/[id]/friends`. Each client caller is already `user`-gated and ignores `!res.ok` (FollowedClubsEventsSection:23,28; FriendsActivitySection:34 via `page.tsx:543 {user && …}`; FriendsOrganizingSection:33 on the protected `/friends`; FriendsGoing:15 via `EventDetailClient:309 {user && …}`). Send `rsvp` GET and `clubs/[id]/events` to Phase 6 (REFAC-19 `private, no-store`, F-028's own alternative). `auth-debug`: delete (F-027) — needed anyway for the `!` clause. `notifications/count`: Phase 6 [VERIFIED: codebase] |
| C8 | env readers "throw a named error at first import"; "in production the Upstash variables are required (fail at boot)" | (1) CI `ci` job runs `npm run build` with only placeholder `NEXT_PUBLIC_*` and **no `SUPABASE_SERVICE_ROLE_KEY`** (`.github/workflows/ci.yml:24-26`), and `next build` evaluates route modules while collecting page data. (2) `src/proxy.test.ts` imports `./proxy` with no Supabase env set locally. (3) The Playwright harness runs `npm run build && npm run start` (`playwright.config.ts:126`), i.e. **`NODE_ENV=production`**, as does the CI build | Readers validate **lazily, at first read** (throwing `MissingEnvError`), never at module evaluation. "Production" = `process.env.VERCEL_ENV === "production"`, never `NODE_ENV`. A boot-time check can live in `src/instrumentation.ts` `register()`, which runs once per server start [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md:18], guarded so it does not run in the build phase [ASSUMED: `NEXT_PHASE === "phase-production-build"` guard needed]. The harness `webServer.env` should set `UPSTASH_REDIS_REST_URL: ""` and `UPSTASH_REDIS_REST_TOKEN: ""`. `@next/env` never overrides a defined (even empty) process var [VERIFIED: node_modules/@next/env/dist/index.js processEnv `typeof p[t]==="undefined"`], so a developer's `.env` cannot point the harness at a real store |
| C9 | `src/lib/env.ts` exports a reader for `SUPABASE_SERVICE_ROLE_KEY` | `eslint.config.mjs:82-107` fails any `process.env.SUPABASE_SERVICE_ROLE_KEY` read **outside `src/lib/supabase/**` and `src/server/db/elevated/**`**. `src/lib/env.ts` is outside both | Put the service-key read in `src/lib/supabase/service.ts` (literal member access, wrapped in the shared `requireEnvValue(name, value)` helper exported by `src/lib/env.ts`). Or place the whole module at `src/lib/supabase/env.ts`. Do **not** read by computed key (`process.env[name]`): it evades the lint rule, and Next only inlines literal `process.env.NEXT_PUBLIC_*` in the browser bundle [VERIFIED: eslint.config.mjs] |
| C10 | RLS ring tables: `clubs`, `club_members`, `club_invitations`, `events` | **Measured:** as `cross_club_attacker`, `INSERT INTO events (…, created_by = club_owner, club_id = approvedClub, status = 'approved')` **succeeds** (policy `Authenticated users can insert events` WITH CHECK `true`) — F-008, `closes_in_phase: "05"` in findings.json. SC2's "independently denied at the RLS ring" is false for events until fixed | Fix-forward the events INSERT policy in slice 4. It **must keep an `is_admin()` arm**, because `POST /api/admin/events` inserts with **no `created_by`** (`src/app/api/admin/events/route.ts:150-163`). Shape: `WITH CHECK (is_admin() OR (created_by = (select auth.uid()) AND (status = 'pending' OR (status = 'approved' AND club_id IS NOT NULL AND <caller is a member of club_id> AND <club is approved>))))`, matching `events/create/route.ts:137-165`'s auto-approve rule. Add `TO authenticated` (F-018 hygiene for rewritten policies) [VERIFIED: local stack probe] |
| C11 | "the same write by `club_owner` on their own club succeeds" (pgTAP both directions) | **Measured:** as `club_owner`, `UPDATE clubs … WHERE id = approvedClub` → **0 rows**; `UPDATE club_members` → **0 rows**. `clubs` has no owner UPDATE policy; `club_members` UPDATE is admin-only. So `PATCH /api/clubs/[id]` (cookie client, `route.ts:127-138`) returns **500 "Failed to update club"** to the real owner today. `DELETE /api/clubs/[id]` (`:192-196`) updates 0 rows **with no error**, returns `{ success: true }`, and writes a `club_deleted` audit row for a club that was not deleted. `PATCH /members/role` (`:54-63`) → 500. The rls-review §6b note "masked by service-role handlers" is wrong for these three | New finding (register F-087 through the generator): owner club writes are denied by RLS and surface as 500 or false success. Recommended: after `requireClubRole([...,"owner"])`, perform the owner write on `getElevatedClient()` with a REGISTRY row ("`clubs` has no owner UPDATE policy; an owner policy needs status immutability, deferred to Phase 7"). This works in production on deploy. A policy fix would stay local until Phase 8. INTENTIONAL BEHAVIOUR CHANGE (owner edit starts working). pgTAP then asserts the RLS ring denies **both** attacker and owner direct PostgREST writes to `clubs` (the owner path is the elevated door) [VERIFIED: local stack probe] |
| C12 | `PATCH /api/admin/users/[id]` is where admin role changes happen | It uses the **cookie** client (`route.ts:31-36`). `users` has no admin UPDATE policy (rls-review §4c), so for any target other than the caller it updates 0 rows, `.single()` errors, and it returns **500 `{ error: "Internal server error" }`**. The `/moderation/users` organizer toggle (`page.tsx:53-57`) therefore silently fails today. The UI sends the target's whole role array, including `"admin"` for an admin target | Move the write to `getElevatedClient()` (REGISTRY: "`users` has no admin UPDATE policy; F-006's grant withholds `roles` from authenticated"). Validate `roles` against the `user_role` enum (`user`, `admin`, `club_organizer`), else 400. Refuse `id === ctx.user.id` (self-modification). Write `logAdminAction({ action: "updated", targetType: "user", metadata: { roles } })`. INTENTIONAL BEHAVIOUR CHANGE ×2: the route starts working, and it stops stripping `admin` [VERIFIED: codebase + rls-review] |
| C13 | Upstash configured by `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | The Vercel Marketplace Upstash integration injects **`KV_REST_API_URL` / `KV_REST_API_TOKEN`** [CITED: vercel.com/marketplace/upstash/upstash-kv via web search, MEDIUM]. `Redis.fromEnv()` reads `UPSTASH_*` and falls back to `KV_*` [VERIFIED: @upstash/redis 1.38.4 nodejs.js `fromEnv`] | Validated config reads `UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL` (and the token likewise), then constructs `new Redis({ url, token, enableTelemetry: false })` explicitly rather than `fromEnv()`. Record both names in the Phase 8 deploy prerequisite |
| C14 | State-changing GETs "expected: none" | Two exist. (1) **`/invites/[token]` page** auto-accepts on GET: it inserts `club_members` and updates `club_invitations` (`src/app/invites/[token]/page.tsx:138-147`). A Lax cookie is sent on top-level cross-site navigation, so a cross-site link can make a signed-in invitee join a club they were invited to (they must hold the token; RLS pins the invitee email). (2) `GET /api/recommendations` inserts `experiment_assignments` (`route.ts:230`), which is benign. `GET /api/admin/calculate-popularity` is read-only; its POST writes | Record both in `evidence/csrf-assessment.md`. Risk is Low: the token is the secret and the only effect is joining an invited club. Recommended: note it, no code change in Phase 5 (a confirm-button change is UX work). Or make acceptance a POST behind the origin check if the owner wants it closed [VERIFIED: codebase] |
| C15 | "the PRESERVE pins that encode the asymmetry are retagged DEFECT" | `scripts/check-characterization-tags.mjs` reads **only the file's leading docblock**, so tags are per file, not per test. `save-characterization.test.ts:344` and `rsvp-characterization.test.ts` hold their "ban asymmetry — pinned for Phase 5" blocks **inside PRESERVE files**. The same applies to the callback PRESERVE suite's tests "appends admin … ADMIN_EMAILS" (`route.test.ts:331`) and "skips profile sync … when the service key is absent" (`:350`) | Move each pin that must change into a new `<name>-defect.test.ts` whose docblock says `DEFECT` and cites the F-nnn (F-062/F-069 for the ban asymmetry, F-004 for the two callback tests), in the same commit as the fix. Record the move in `evidence/defect-ledger.md` (Phase 4 method). The PRESERVE files lose those blocks and otherwise stay unedited |
| C16 | Phase 5 owns F-001, F-003…F-007, F-016, F-028, F-058, F-061, F-062, F-067, F-069, F-072, F-073, F-077, DI-36 | `findings.json` has **~50 findings with `closes_in_phase: "05"`**: also F-002, F-008–F-015, F-017, F-018, F-026, F-027, F-029–F-035, F-037–F-042, F-054, F-055, F-059, F-070, F-074–F-076, F-078 | The generator-backed findings edit (the one registering F-086/F-087) must re-point every `"05"` finding that CONTEXT defers (cron/webhook → 06, storage → 08, and so on). Otherwise the completion note will list them as open against Phase 5. F-008 (C10) and F-027 (C7) are recommended *into* Phase 5 |
| C17 | "The three `as any` casts named by research" in the callback | `src/app/auth/callback/route.ts` has **zero** `as any` today (Phase 3 removed them). Casts remaining in the phase's scope: `src/app/moderation/page.tsx:77` `(supabase as any)` + `as Promise<…>` (F-072, D-22); `admin/calculate-popularity/route.ts` `"update_event_popularity" as never`; `users/me/suggestions/route.ts:50` `(m: any)`; `users/[id]/page.tsx` several `(m: any)` / `(r: any)` | Remove the F-072 pair in slice 5 when the select changes (they then delete cleanly, per F-072). The `(x: any)` callbacks are lint-level and optional |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session refresh, cookie cleanup | Frontend Server (proxy, Node runtime) | — | `@supabase/ssr` `setAll` on the response; only the proxy sees every request |
| Rate limiting (all `/api/*` incl. admin) | Frontend Server (proxy) | Upstash Redis (external) | Must run before handler work; the distributed store makes the budget span instances |
| CSRF origin check | Frontend Server (proxy) | — | One place for every non-GET `/api/*`; route handlers have no built-in origin check (Server Actions do, and this app has none: `grep "use server"` finds nothing) |
| UX redirects (anon→sign-in, banned→/banned, un-onboarded→/onboarding) | Frontend Server (proxy) | Page layouts (14 layout guards, F-069) | Advisory only; never the authz authority |
| Authentication + authorization decisions | API / Backend (Route Handlers via `src/server/` seam) | — | `createRequestContext()` → `requireUser`/`requireActiveUser`/`requireOnboarded`/`requireRole`/`requireClubRole` |
| Tenant isolation (club-scoped writes), self-escalation denial | Database (RLS + column grants) | API (seam) | The second ring must hold with the app bypassed (direct PostgREST) |
| Privileged cross-user writes (notifications, admin user edits, owner club edits, audit log) | API → `src/server/db/elevated/` | Database (policies deny everyone else) | Operations RLS cannot or does not yet express, each registered |
| Public profile page (F-005) | Frontend Server (Server Component) | API elevated door | Gate in both `generateMetadata` and the page |
| Validated config | Frontend Server + API (shared module) | Browser (inlined `NEXT_PUBLIC_*`) | Lazy readers; the service key read stays under `src/lib/supabase/` |

---

## Standard Stack

### Core (already installed; versions from `node_modules`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.5 | Proxy (Node runtime), Route Handlers | Project framework [VERIFIED: node_modules] |
| @supabase/ssr | 0.7.0 | Cookie session on server/browser; cookie defaults `path "/"`, `sameSite "lax"`, `httpOnly false`, `maxAge 400d`, **no `secure`** | Stay on 0.7 (CONTEXT defers 0.12) [VERIFIED: node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11] |
| @supabase/supabase-js | 2.81.1 → **2.116.0** at end of slice 5 | DB client | DEC-28 measured 2.116.0; `latest` is now 2.117.1 (2026-09-23). Stay on 2.116.0, the measured version [VERIFIED: npm registry] |
| pgTAP (via Supabase CLI 2.115.0) | CLI 2.115.0 | RLS allow/deny tests | CI pins 2.115.0 because the type generator output differs across versions (ci.yml:98-100) [VERIFIED: codebase] |
| @playwright/test | 1.63.0 | Persona e2e | Existing harness |
| jest / ts-jest | 30.2 / 29.4.6 | Unit tests | The only runner |

### New (slice 5)
| Library | Version (pin exactly) | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/ratelimit | **2.1.0** (2026-09-14) — not 2.2.0 (published 2026-09-23, 1 day old) | Fixed/sliding window limiter over Redis | Production store only [VERIFIED: npm registry; API read from shipped `dist/index.d.ts`] |
| @upstash/redis | **1.38.4** (2026-09-04) — not 1.39.0 (2 days old) | REST Redis client (fetch-based, works on the Node proxy) | Peer of ratelimit 2.1.0 (`^1.38.2`) [VERIFIED: npm registry] |

Transitive: `@upstash/core-analytics@0.0.10` (2024-07-19; flagged `no-repository` by the gate, published by Upstash), `uncrypto@0.1.3` (OK). No `postinstall` script on any of the four [VERIFIED: `npm view … scripts.postinstall` empty].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @upstash/ratelimit | Hand-written INCR+EXPIRE over @upstash/redis | Loses the atomic Lua script, ephemeral cache and timeout semantics. Don't hand-roll |
| Upstash | Vercel Runtime Cache / Edge Config | Not a counter store; wrong primitive |
| `@vercel/functions` `ipAddress()` | Existing `x-forwarded-for` first-hop parse | Vercel overwrites `X-Forwarded-For` to prevent spoofing [CITED: vercel.com/docs/headers/request-headers via web search], so the existing `getIp()` is sound on Vercel. No new dependency |
| Ratelimit 2.0.8 (2026-01-12) | — | Also acceptable if the owner wants a version older than 30 days. 2.1.0 adds OIDC-published releases and telemetry (which we disable) |

**Installation (slice 5, behind a checkpoint):**
```bash
npm install --save-exact @upstash/ratelimit@2.1.0 @upstash/redis@1.38.4
npm audit --audit-level=high --omit=dev   # the CI gate must stay green
```

## Package Legitimacy Audit

| Package | Registry | Age (created) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @upstash/ratelimit | npm | 4 yrs (2022-05-06) | ~1.59M/wk | github.com/upstash/ratelimit-js | [SUS] "too-new" (latest 2.2.0 is 1 day old) | Flagged: pin **2.1.0**; planner adds `checkpoint:human-verify` before install |
| @upstash/redis | npm | 5 yrs (2021-10-22) | ~3.55M/wk | github.com/upstash/redis-js | [SUS] "too-new" (latest 1.39.0 is 2 days old) | Flagged: pin **1.38.4**; same checkpoint |
| @upstash/core-analytics | npm | 2024-07-19 | ~1.56M/wk | none listed | [SUS] "no-repository" | Transitive of ratelimit; covered by the same checkpoint; analytics stays disabled (default `false`) |
| uncrypto | npm | 2023-06-06 | ~11M/wk | github.com/unjs/uncrypto | [OK] | Approved (transitive) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** @upstash/ratelimit, @upstash/redis, @upstash/core-analytics. The "too-new" signal is about the *latest* tags; the recommended pins are older. The planner inserts one `checkpoint:human-verify` before the install task.

*`@upstash/ratelimit` and `@upstash/redis` were named in CONTEXT (a locked decision) and verified here from the registry and the packages' own shipped type definitions (Context7 was not available in this session).*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / curl / cron
      │  (cookies: sb-<ref>-auth-token[.N]  SameSite=Lax, not HttpOnly, not Secure;  needs_onboarding hint)
      ▼
┌───────────────────────── src/proxy.ts (Node runtime) ─────────────────────────┐
│ 1 rate limit  ── policy(req) → key/limit ── RateLimitStore ──► Upstash (prod)  │
│      429 JSON ◄── over budget                     └── memory map (dev/CI/test) │
│ 2 CSRF (non-GET /api/*): Sec-Fetch-Site=cross-site OR Origin≠host → 403 JSON   │
│ 3 createServerClient + getUser()  (session refresh, cookie cleanup)            │
│ 4 if user && path not exempt: ONE users read (banned_at, ban_expires_at,       │
│      onboarding_completed)  ── read error ⇒ 500 (fail closed)                  │
│      banned: /api/* → 403 {"error":"Account suspended"}; page → 307 /banned    │
│ 5 anon on PROTECTED_ROUTES page → 307 /?signin=required&next=…                 │
│ 6 !onboarding_completed on page (not /onboarding, /api, /auth) → 307 /onboarding│
│ catch(any) → 500 ({"error":"Failed to process request"} under /api/)           │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   ▼  (proxy is advisory: handlers re-decide)
┌──────────────── Route Handler ────────────────┐
│ ctx = createRequestContext()   // getUser + profile slice (id, roles,          │
│                                //  onboarding_completed, banned_at, ban_expires_at)
│ requireUser | requireActiveUser | requireOnboarded | requireRole(ctx,"admin")  │
│ requireClubRole(ctx.supabase, clubId, user.id, ["owner"] | CLUB_ROLES, msg)    │
│   ├─ cookie client write ──────────────► Postgres RLS + column grants (ring 2) │
│   └─ getElevatedClient() (REGISTRY row) ─► service_role (bypasses RLS)         │
│        └─ logAdminAction → admin_audit_log (only writer after F-007)           │
└────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)
```
src/
├── lib/env.ts                      # requireEnvValue(), MissingEnvError, public + Upstash readers (lazy)
├── lib/supabase/service.ts         # service-key read stays here (lint home), via requireEnvValue
├── instrumentation.ts              # optional boot check (guarded; see C8)
├── server/
│   ├── context.ts                  # PROFILE_COLUMNS += banned_at, ban_expires_at
│   ├── authz/requireActiveUser.ts  # 401 / 403 "Account suspended" / fail-closed on null profile
│   ├── authz/requireOnboarded.ts   # 403 "Onboarding required"
│   ├── authz/requireClubRole.ts    # + CLUB_ROLES const
│   ├── ratelimit/{policy,memoryStore,upstashStore,index}.ts
│   ├── csrf.ts                     # isCrossSiteMutation(req) pure predicate
│   └── db/elevated/{index.ts,REGISTRY.md}
├── middlewareRateLimit.ts          # keep applyApiRateLimit (sync, memory, public policy) byte-identical
supabase/migrations/
├── 2026092xxxxxxx_users_column_grants_audit_log_insert.sql   # F-006 + F-007 (+ saved_events_count trigger)
├── 2026092xxxxxxx_events_insert_policy.sql                   # F-008 (club-scoped RLS ring)
supabase/tests/database/
├── 050-users-privilege-escalation.test.sql
├── 055-admin-audit-log-insert.test.sql
├── 060-club-tenant-isolation.test.sql
```

### Pattern 1: Guard composition, errors returned, never thrown
**What:** New guards follow `requireUser`'s discriminated-union shape so handlers keep `if (!g.ok) return g.response`.
**When:** Every state-changing authenticated handler (ban); every non-GET authenticated handler except the two C2 exemptions (onboarding).
```typescript
// src/server/authz/requireActiveUser.ts — shape mirrors requireRole.ts:31-56
import { isBanned } from "@/lib/ban";
import type { RequestContext } from "../context";
import { forbidden } from "../errors";
import { requireUser, type AuthGuardResult } from "./requireUser";

export function requireActiveUser(
  ctx: Pick<RequestContext, "user" | "profile">
): AuthGuardResult {
  const authenticated = requireUser(ctx);           // 401 {"error":"Unauthorized"}
  if (!authenticated.ok) return authenticated;
  if (!ctx.profile) return { ok: false, response: forbidden("Account suspended") }; // fail closed
  if (isBanned(ctx.profile)) return { ok: false, response: forbidden("Account suspended") };
  return authenticated;
}
```
Note the order. Today `checkBanStatus()` runs **before** the 401 in every caller (e.g. `events/create/route.ts:11` then `:20`). For an anonymous caller it returns `null`, so the result is still 401. For a banned caller the handler 403s before reading anything. `requireActiveUser` gives the same outputs. The Phase 4 PRESERVE suites pin "ban check runs first, before any event is read" (`save-characterization.test.ts:196-226`). The guard must run before the first data read.

What status should the null-profile deny return? Pick 403 `"Account suspended"` or a distinct body, and pin whichever you pick with a test. The recommended choice is a distinct `forbidden("Forbidden")`, so a missing profile is distinguishable in logs from a ban. Record it as a DEC.

### Pattern 2: `requireClubRole` with the site's own 403 bytes
```typescript
// src/app/api/clubs/[id]/invites/route.ts GET — today :29-42
const ctx = await createRequestContext();
const auth = requireUser(ctx);
if (!auth.ok) return auth.response;                      // 401 {"error":"Unauthorized"}
const club = await requireClubRole(
  ctx.supabase, clubId, auth.user.id, ["owner"],
  "Only the club owner can view invitations"             // byte-identical 403 body
);
if (!club.ok) return club.response;
```
For **flag** sites (not gates), use `.ok` as the boolean and ignore `.response`. Flag sites are `clubs/[id]/events`, `events/[id]/reviews`, `events/create`, and the `isClubMember` computation in `events/[id]` PATCH.

### Pattern 3: The elevated door, one REGISTRY row per operation family
```typescript
import { getElevatedClient } from "@/server/db/elevated";
// REGISTRY: notifications has only "Service role can insert notifications" (TO service_role);
// notifying another user cannot be expressed as a caller-scoped policy.
const elevated = getElevatedClient();
await elevated.from("notifications").insert({ user_id: event.created_by, … });
```
Keep the cookie client (`ctx.supabase`) for every operation a policy already permits (see the service-role table). Pitfall 10 (PITFALLS.md) forbids widening a policy to unblock a swap.

### Pattern 4: RateLimitStore — async store, sync memory path preserved
```typescript
// src/server/ratelimit/types.ts
export type RateDecision = { allowed: boolean; limit: number; resetAtMs: number };
export interface RateLimitStore { consume(key: string, limit: number, windowMs: number): Promise<RateDecision>; }

// policy(): the ONE place budgets live
//   public:  GET 300, non-GET 30, HIGH_FREQUENCY_POST_PREFIXES 300   (unchanged, middlewareRateLimit.ts:26-39)
//   admin:   GET 600, non-GET 120  (CONTEXT default)                  key `${method}:${pathname}:${ip}`
// response(): the existing 429 body + Retry-After / X-RateLimit-* headers (middlewareRateLimit.ts:110-126)
```
- `applyApiRateLimit(req)` stays **synchronous and public-only**, exactly as today. The PRESERVE suite (`src/middlewareRateLimit.test.ts`) calls it without `await` and asserts `toBeNull()`, and its "exempts /api/admin/* from the public budget" case stays true because the admin budget is a separate policy.
- The proxy calls a new `async applyRateLimit(req, store)` covering public and admin.
- `MemoryRateLimitStore.consume` reuses the same `globalThis` bucket map and fixed-window-from-first-hit semantics.
- `UpstashRateLimitStore` uses `Ratelimit.fixedWindow(limit, "60 s")`. That is the closest to today's algorithm, though Upstash windows are epoch-aligned, so `Retry-After` differs slightly [VERIFIED: ratelimit 2.1.0 dist/index.js fixedWindow `bucket = Math.floor(Date.now()/windowDuration)`].
- Create one `Ratelimit` instance per (limit) at module scope, so `ephemeralCache` works.

### Pattern 5: CSRF predicate (pure, unit-testable)
```typescript
export function isCrossSiteMutation(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return false;
  if (!req.nextUrl.pathname.startsWith("/api/")) return false;
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (origin === null) return false;                       // curl / cron / server-to-server
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  try { return new URL(origin).host !== host; } catch { return true; }   // "null" / garbage → block
}
```
- This mirrors Next's own Server Action check, which compares `Origin` with `Host` / `X-Forwarded-Host` [CITED: node_modules/next/dist/docs/01-app/02-guides/data-security.md:550].
- In Jest, `new NextRequest(url, { headers: { "sec-fetch-site": "cross-site", origin } })` keeps both headers.
- `host` is `null` unless set, so the fallback to `nextUrl.host` is required [VERIFIED: node probe].

### Anti-Patterns to Avoid
- **Import-time env throws** (C8): they break `next build` in CI and `proxy.test.ts`.
- **Widening a policy to make a cookie-client swap work** (PITFALLS #10).
- **Blanket 401 on F-028 routes** (C7).
- **Editing a PRESERVE suite to make it pass.** Move the pin to a `-defect` file (C15).
- **`Redis.fromEnv()`**: it silently falls back to `KV_*` and warns instead of failing. Construct `new Redis()` from validated config.
- **Leaving Upstash `timeout` at 5000 ms**: the proxy would stall up to 5 s per `/api/*` request on an outage. Set it to 1000 ms and log `reason === "timeout"`. On timeout the request is **allowed** (fail-open by library design [VERIFIED: ratelimit d.ts "allow requests to pass after this many milliseconds"]). Record this as a DEC: availability over limiting, since rate limiting is not an authz control.

---

## Inventories the plan executes against

### A. Slice 3 — auth ring

**Env non-null assertions (the `!` clause), every occurrence** [VERIFIED: `grep -rnoE "process\.env\.[A-Z_]+!" src`]:
| File | Variables with `!` |
|---|---|
| `src/lib/supabase/server.ts:14-15` | URL, ANON |
| `src/lib/supabase/client.ts:11-12` | URL, ANON (browser; keep literal reads) |
| `src/lib/supabase/service.ts:11-12` | URL, SERVICE_ROLE_KEY |
| `src/app/auth/callback/route.ts:61-62, 123-124` | URL, ANON, URL, SERVICE_ROLE_KEY |
| `src/app/auth/signout/route.ts:11-12` | URL, ANON |
| `src/app/api/auth-debug/route.ts:11,21-22` | URL, ANON → **delete route** (F-027, C7) |
Non-`!` conditional reads that also go: `src/proxy.ts:10-16` (the F-003 pass-through), `admin/calculate-popularity/route.ts:16-17,58,168` (FO-01 plus `ADMIN_API_KEY`), `auth/callback/route.ts:22,162` (`ADMIN_EMAILS`, the key-presence branch). Out of scope: `api/health` (REFAC-22), `api/cron/*` (Phase 6).

**`checkBanStatus()` callers (10), all POST** [VERIFIED]: `clubs/route.ts:42`, `clubs/[id]/appeal:11`, `user/engagement:120`, `recommendations/feedback:89`, `users/[id]/follow:14`, `events/[id]/invite:15`, `events/[id]/appeal:11`, `events/[id]/rsvp:202`, `events/create:11`, `events/[id]/save:53`. Each becomes `requireActiveUser(ctx)`.

**State-changing authenticated handlers without a ban check today** (candidates for the "every state-changing handler" default; each one is a DEFECT retag or a new pin):
- DELETE arms: `save`, `rsvp`, `users/[id]/follow`.
- `clubs/[id]/follow` POST/DELETE, `clubs/[id]/invites` POST, `clubs/[id]/members` DELETE, `members/role` PATCH, `clubs/[id]` PATCH/DELETE, `transfer`, `clubs/banner`, `clubs/logo`.
- `events/[id]/report`, `events/[id]/reviews` POST, `events/[id]` PATCH/DELETE, `events/upload-image`.
- `notifications/[id]` PATCH, `notifications` POST, `organizer-requests` POST.
- `profile/avatar`, `profile/banner`, `profile/inferred-tags` DELETE, `profile/interests` PUT, `users/[id]` PATCH, `onboarding/complete` POST.
- Admin routes: rely on `requireRole` (a banned admin is an edge case; the proxy blocks at `/api/*`).

**`getSession()` clause:** the single server call is `src/app/api/health/route.ts:160`, which is non-gating and owned by REFAC-22 [VERIFIED: grep; `.planning/audit/authz/getsession-register.md`]. Add a grep gate test asserting no `getSession(` in `src/` outside `api/health`, so the clause is checked, not reasoned.

**Callback characterization impact:** `src/app/auth/callback/route.test.ts` mocks exactly three seams: `@supabase/ssr`, `@supabase/supabase-js`, `@/lib/supabase/service` (docblock :20-30). After (d), the inline `@supabase/supabase-js` client and the service factory both come from `@/server/db/elevated`, so the mock seam moves. Tests 7 (`:331`, ADMIN_EMAILS) and 8 (`:350`, key absent → admit) are F-004/FO-05 DEFECT pins (C15). The remaining six PRESERVE tests must pass unedited, and new F-077 cases are added.

### B. Wire bytes today (PRESERVE targets and DEFECT names)

| Surface | Today (exact) | After Phase 5 | Finding |
|---|---|---|---|
| `checkBanStatus()` banned | `403` `{"error":"Account suspended"}` (ban.ts:34); anonymous → `null` (the caller then 401s) | `requireActiveUser` → same bytes | — (PRESERVE) |
| `checkBanStatus()` profile read fails / no row | returns `null` (fail-open, ban.ts:33) | 403 (fail closed) | F-062/FO shape; DEFECT |
| Proxy, banned, any non-exempt path incl. `/api/*` | `307`, `Location: /banned` (**query string preserved**: `nextUrl.clone()` then pathname only, proxy.ts:107-109) | pages: same; `/api/*`: `403` `{"error":"Account suspended"}` | F-062 DEFECT |
| Proxy, anonymous on `PROTECTED_ROUTES` | `307` `Location: /?signin=required&next=<path>`. `searchParams.set` encodes `/` as `%2F`, and `e2e/fixtures.ts:63` expects `encodeURIComponent(path)` | same | PRESERVE |
| Proxy, onboarding | `307` → `/onboarding` iff cookie `needs_onboarding=1` && user && path ∉ {`/onboarding`, `/api/*`, `/auth/*`} (proxy.ts:124-136) | same exemptions, predicate = DB `onboarding_completed !== true` | F-069/REFAC-11; DEFECT for "cookie deleted → free browsing" |
| Proxy env unbound | `NextResponse.next()` (F-003) | unreachable | F-003 |
| Proxy catch | `NextResponse.next()` (proxy.ts:140-144) | `500` JSON under `/api/`, plain 500 otherwise | F-003/REFAC-11 DEFECT |
| `verifyAdmin` deny, 30 callsites | `403` `{"error":"Forbidden"}` for both anonymous and non-admin | anonymous `401 {"error":"Unauthorized"}`, non-admin same 403 | F-061 DEFECT (anonymous half) |
| `verifyAdmin` deny, 3 callsites: `admin/clubs` GET :6-8, `admin/organizer-requests` GET :6-8, `recommendations/batch` POST :8-10 | `401` `{"error":"Unauthorized"}` for **both** anonymous and non-admin | non-admin → `403` | F-061 DEFECT (contract row: `onboarded_student: 403`) |
| `calculate-popularity` (no `ADMIN_API_KEY`) | GET/POST `200` to anyone | anonymous 401, non-admin 403, admin 200 | F-001 DEFECT; `endpoints.json` row today says stud=401/admin=401, regenerate |
| F-028 anonymous 200s | `events/following` `{"events":[]}` (:20-21); `friends-activity` `{"events":[]}` (:14-15); `friends-organizing` `{"events":[]}` (:15-16); `events/[id]/friends` `{"friends":[],"count":0}` (:17-18); `notifications/count` `{"unread_count":0}` (Phase 6); `rsvp` GET `{counts, user_rsvp:null}` (public, keep); `clubs/[id]/events` approved list (public, keep) | 401 on the first four only (C7) | F-028 DEFECT |
| Callback `next` | any value, incl. `https://evil.test` (route.ts:37,205) | `/`-prefixed and not `//`, else `/` | F-077 DEFECT |
| Admin route rate limit | never (middlewareRateLimit.ts:85) | 429 after budget | F-058 clause |

### C. Club authorization call sites (REFAC-12) — exact role sets [VERIFIED: every `from("club_members")` read with context]

Gate and flag sites (the "19 hand-rolled checks" collapse to these 17 guard uses; the remaining `club_members` hits are data reads or writes):

| # | Site | Kind | Accepted roles | Deny bytes (keep) | Notes |
|---|---|---|---|---|---|
| 1 | `api/clubs/[id]/analytics/route.ts:29-40` GET | gate | owner, organizer | 403 `You must be a club member to view analytics` | anon 401 at :24-25 |
| 2 | `api/clubs/[id]/events/route.ts:30-39` GET | **flag** (`isOrganizer`) | owner, organizer | — | anonymous allowed; public route (C7) |
| 3 | `api/clubs/[id]/invites/route.ts:29-42` GET | gate | owner | 403 `Only the club owner can view invitations` | |
| 4 | `api/clubs/[id]/invites/route.ts:83-95` POST | gate | owner | 403 `Only the club owner can send invitations` | `:126` is a target read (a dead check: RLS hides other users' `users` rows at `:60`, so `existingUser` is always null) |
| 5 | `api/clubs/[id]/members/role/route.ts:17-26` PATCH | gate | owner (`.single()` + `role !== "owner"`) | 403 `Only the club owner can change roles` | `:36` target read; the `:55` update is RLS-denied (C11) |
| 6 | `api/clubs/[id]/members/route.ts:25-37` GET | gate | owner, organizer | 403 `You must be a member of this club to view members` | `:42` listing |
| 7 | `api/clubs/[id]/members/route.ts:98-111` DELETE | gate | owner | 403 `Only the club owner can remove members` | `:125` target read, `:153` delete (RLS permits the owner) |
| 8 | `api/clubs/[id]/route.ts:58-70` PATCH | gate | owner | 403 `Only the club owner can update club details` | the update is RLS-denied (C11) |
| 9 | `api/clubs/[id]/route.ts:168-177` DELETE | gate | owner | 403 `Only the club owner can delete the club` | the soft-delete silently no-ops (C11) |
| 10 | `api/clubs/[id]/transfer/route.ts:18-27` POST | gate | owner | 403 `Only the club owner can transfer ownership` | **needs the membership `id`** (`:64` demotes by id). The guard returns only `role`: demote by `(club_id, user_id)` or add a second read. Do not change the guard's contract casually |
| 11 | `api/clubs/banner/route.ts:35-47` POST | gate | owner | 403 `Only the club owner can upload a banner` | clubId comes from the form body, validated 400 first |
| 12 | `api/clubs/logo/route.ts:35-47` POST | gate | owner | 403 `Only the club owner can upload a logo` | same |
| 13 | `api/events/[id]/analytics/route.ts:52-63` GET | gate | owner, organizer | 403 `You must be a club member to view analytics` | clubId comes from the event; 400 if no club |
| 14 | `api/events/[id]/reviews/route.ts:148-154` GET | **flag** (`isOrganizer`) | owner, organizer | — | |
| 15 | `api/events/[id]/route.ts:220-240` PATCH | composite arm | owner, organizer | composite 403 `You do not have permission to edit this event` | also the inline admin check `:193-203` → `hasRole` via `ctx.profile`. `isClubMember` changes moderation (`:257-261`) |
| 16 | `api/events/[id]/route.ts:391-399` DELETE | composite arm | owner, organizer | composite 403 `You do not have permission to delete this event` | inline admin check `:376-384` |
| 17 | `api/events/create/route.ts:154-163` POST | **flag** (auto-approve) | owner, organizer | — | inline `roles.includes("admin")` `:142` |

Not authorization decisions (keep plain selects or writes; some move to the elevated door):
- Reads: `api/my-clubs:21,45`; `api/users/me/suggestions:46,90` (elevated); `api/admin/organizers:60`.
- Writes: `api/admin/clubs/[id]:175`, `api/admin/organizer-requests/[id]:94`, `api/clubs/route.ts:134`, `api/clubs/[id]/transfer:52,62,69`, `members/role:55`, `members:153`.
- Pages: `clubs/[id]/page.tsx:58` (count), `invites/[token]/page.tsx:103` (existence), `:138` (insert), `my-clubs/page.tsx:18`, `profile/page.tsx:29`, `users/[id]/page.tsx:115`; `store/useAuthStore.ts:65`.
- `/my-clubs/[id]` is a client page (`ClubDashboard`) with no server gate; its data APIs are the gates. Leave it, and add a Playwright assertion that `cross_club_attacker` on `/my-clubs/<approvedClub>` gets no member list or analytics.

### D. RLS ring matrix (measured on the local stack, rolled back) [VERIFIED: docker exec psql probes 2026-09-23]

| Table · op | Policy today (local = prod set) | `cross_club_attacker` on approvedClub | `club_owner` on own club | Phase 5 action |
|---|---|---|---|---|
| events INSERT | `Authenticated users can insert events` CHECK `true` | **succeeds** (forged `created_by`, `status approved`) ✗ | succeeds | fix-forward (C10); pgTAP 42501 for attacker; owner-member approved insert passes; admin arm passes |
| events UPDATE | own `created_by` / `is_admin()` | 0 rows ✓ | 0 rows unless creator (a handler/RLS mismatch for non-creator members → 500) | pin; register as a note (not widened) |
| clubs UPDATE | `Admins can update clubs` only | 0 rows ✓ | **0 rows** (C11) | owner writes via the elevated door; pgTAP asserts both are denied direct |
| clubs INSERT | `Admins can insert clubs` | 42501 ✓ | 42501 (`POST /api/clubs` uses elevated) | pin |
| club_members UPDATE | admin ALL only | 0 rows ✓ | **0 rows** | transfer already elevated; members/role → elevated or leave dead |
| club_members DELETE | owner, not self | 0 rows ✓ | allowed ✓ | pgTAP both directions |
| club_members INSERT | invitee-with-open-invite (`organizer` only) + admin | 42501 ✓ (self-insert as owner) | 42501 (elevated in `POST /api/clubs`) | pin |
| club_invitations INSERT | `is_club_owner(club_id)` | 42501 ✓ | allowed ✓ | pgTAP both directions |
| club_invitations UPDATE | owner revoke-only; invitee accept-only | 0 rows | allowed (revoke) | covered by 020/025 |
| users UPDATE (self `roles`) | own row, no WITH CHECK, table grant | **`{user,admin}` succeeds** ✗ | — | F-006 migration (with the C3 corrections) |
| admin_audit_log INSERT (anon, no RETURNING) | two `{public}` CHECK `true` | **forged row persists** ✗ | — | F-007 migration |

Note on assertion shape: with `INSERT … RETURNING`, a row the caller cannot SELECT raises `new row violates row-level security policy` even when the INSERT policy passes, because PostgREST's `return=representation` behaves that way. The anonymous forge above **succeeds without RETURNING** (PostgREST `Prefer: return=minimal`). pgTAP deny tests must use a statement **without** `RETURNING`, then check persistence as owner (`tests.act_as_owner()`), as 020 does.

### E. Admin handlers (REFAC-13) — `verifyAdmin` → `requireRole(ctx, "admin", msg)`

33 callsites in 25 files [VERIFIED: grep]. Deny body `{"error":"Forbidden"}` 403 except the three 401 sites in table B. Inline admin checks to remove:
- `api/events/[id]/route.ts:113-126` (GET pending gate), `:193-203` (PATCH), `:376-384` (DELETE)
- `api/events/create/route.ts:142`
- `api/moderation/reviews/.../route.ts:27-33`

Also migrate the **pages** that decide admin inline: `moderation/layout.tsx` (`roles.includes("admin")`), `admin/layout.tsx`, `admin-login/page.tsx`. `getRequestContext()` + `hasRole` for the two server layouts; `admin-login` is a client page (leave it).

`endpoints.json` `expected_status` already encodes the target contract (anonymous 401, students 403, banned 403) for 26 of 27 admin-family rows. Only `calculate-popularity` (anonymous 401 / stud 401 / admin 401, from the API-key model) must be regenerated through `.planning/audit/tools/classify-inventory.mjs` (row `api.admin.calculate-popularity` at :145 and `EXPECTED_OVERRIDES` :283).

### F. Service-role callsites (the 23 non-cron entries) — can the cookie client do it?

Policies are from `pg_policies` (local = production set) [VERIFIED].

| File | Elevated operations today | RLS permits on cookie client? | Recommendation + REGISTRY reason |
|---|---|---|---|
| `admin/clubs/[id]` PATCH | clubs select/update; moderation_reviews insert; users select/update(roles); club_members upsert; notifications insert | clubs update ✓ (admin), reviews ✓ (admin ALL), club_members ✓ (admin ALL), **users update ✗**, **notifications insert ✗ (service_role only)** | elevated for users.roles and notifications; the rest may move to the cookie client |
| `admin/events/[id]/edits` | events select/update; notifications insert | events ✓ admin; notifications ✗ | elevated (notifications) |
| `admin/events/[id]/status` | events; moderation_reviews; notifications upsert/insert | events ✓, reviews ✓, notifications ✗ | elevated (notifications) |
| `admin/organizer-requests/[id]` | organizer_requests; users roles; club_members upsert; clubs select; notifications | org_requests ✓ admin ALL; users update ✗; notifications ✗ | elevated |
| `admin/organizers` GET | users/club_members/events select | ✓ all (admin select policies; `club_members` admin ALL) | **cookie client** (no elevated need) |
| `admin/reports/[id]` PATCH | event_reports select/update | ✓ admin policies | **cookie client** |
| `admin/reports` GET | event_reports select | ✓ | **cookie client** |
| `admin/users/[id]/ban` | users ban columns; events/clubs update; reviews; notifications | users ✗ (no admin UPDATE; F-006 withholds ban columns) | elevated |
| `admin/calculate-popularity` | inline `createClient(url, key)`; rpc `update_event_popularity` | writes `event_popularity_scores` (F-010: service-role by design) | elevated |
| `admin/users/[id]` (not on the list; cookie today) | users update roles | ✗ (C12) | **add** elevated + row |
| `clubs/[id]/appeal` | clubs select/update; reviews insert; users select; notifications | reviews insert ✓ (creator appeal policy); clubs update ✗ (no owner policy); users cross-read ✗; notifications ✗ | elevated for clubs/users/notifications |
| `events/[id]/appeal` | events; reviews; users; notifications | events update ✓ (creator); reviews ✓; users ✗; notifications ✗ | elevated for users/notifications |
| `clubs/route.ts` POST | clubs insert; club_members insert owner; users roles | ✗ all three (admin-only insert; no self owner insert; F-006) | elevated |
| `clubs/[id]` DELETE (dynamic import) | admin_audit_log insert | ✗ after F-007 | elevated; plus owner soft-delete (C11) |
| `clubs/[id]/transfer` | club_members updates; audit insert | ✗ (admin-only UPDATE; F-007) | elevated |
| `moderation/reviews/[t]/[id]` GET | users roles; events/clubs created_by; reviews select; users name/email | reviews ✓ (creator/admin policies); target read ✓; **author names ✗** (cross-user) | cookie for reviews + gate; elevated only for the author-name enrichment |
| `profile/avatar`, `profile/banner` | users update avatar_url/banner_url (self) | ✓ own-row policy; columns in the F-006 grant | **cookie client** (works in prod today and locally after F-006) |
| `recommendations/batch` | rpc `compute_user_scores` | EXECUTE is granted to anon/authenticated today (F-075), but it is a privileged batch write | elevated (F-075 will revoke) |
| `users/[id]` PATCH | users self-update | ✓ own row; every payload column is in the grant (with `updated_at`) | **cookie client** |
| `users/me/suggestions` | users/follows/club_members/rsvps of **other** users | ✗ (users own-row only) | elevated ("friend suggestions read other users' names; `users` has no cross-user read policy") |
| `users/[id]/page.tsx` | users, saved_events, events, get_friends, club_members, rsvps of target | ✗ (C6) | elevated, narrowed select, visibility gate |
| `lib/audit.ts` | admin_audit_log insert | ✗ after F-007 (by design) | elevated; inspect `{ error }` |
| `auth/callback` | `auth.admin.deleteUser`; users upsert (writes `email`) + select | deleteUser ✗ (auth admin); upsert ✗ after F-006 (`email` not granted) | elevated ×2 |

At phase exit, `node scripts/check-elevated-ratchet.mjs --write` regenerates the allowlist to exactly `src/app/api/cron/send-feedback-requests/route.ts` and `src/app/api/cron/send-reminders/route.ts`. This is a sanctioned shrink; record the diff in evidence.

### G. DI-36 (`pending_edits`)
- **Written:** `PATCH /api/events/[id]` (`route.ts:312-318`, merged into `directUpdates.pending_edits`); cleared by `admin/events/[id]` (`:36`) and `admin/events/[id]/edits` (`:58`, `:110`).
- **Read:** `EventDetailView.tsx:207-213` (creator notice) and `EventDetailClient.tsx:394` (edit-form `initialData`). Both come from `GET /api/events/[id]` (`EventDetailClient.tsx:78`).
- **Unaffected:** `/my-events` (`page.tsx:430,522`) reads `GET /api/events/my-events`, which returns raw `select("*")` rows (`my-events/route.ts:16-21`) and already includes `pending_edits`. `moderation/pending/page.tsx:63-65` reads directly.
- **Fix:** in `GET /api/events/[id]`, after `transformEventFromDB`, when `ctx.user?.id === data.created_by || hasRole(profile, "admin")`, return `{ event: { ...event, pending_edits: data.pending_edits } }`. The existing detail PRESERVE suite pins non-owner stripping through the delegating transform wrapper (`events-detail-characterization.test.ts` layer b), and that must stay green.

### H. DI-25 (supabase-js 2.116.0) blocking sites and who clears them
| Site | Cleared by | How |
|---|---|---|
| `admin/events/[id]/edits/route.ts:67` | slice 5 | type `liveUpdates` as `TablesUpdate<"events">` |
| `admin/events/[id]/route.ts:41` | slice 5 | type `updateData` |
| `admin/experiments/[id]/route.ts:103` | slice 5 | type the payload |
| `admin/featured/[id]/route.ts:43` | slice 5 | type as `TablesUpdate<"featured_events">` (Json values) |
| `admin/users/[id]/route.ts:33` | slice 5 (C12 rewrite) | typed `{ roles, updated_at }` |
| `clubs/[id]/route.ts:129` | slice 4 | `TablesUpdate<"clubs">` |
| `events/[id]/route.ts:318` PATCH | slice 4 (composite arms) or slice 5 | `TablesUpdate<"events">` for `directUpdates` |
| `lib/audit.ts:38` | slice 5 (F-073) | disappears when `admin_email` is dropped |

Verification method (DEC-28's): a throwaway worktree in the scratchpad, `npm ci`, `npm install --no-save @supabase/supabase-js@2.116.0`, `npx tsc --noEmit` → 0 errors, before the real bump commit. `@supabase/ssr@0.7.0` peer range is `^2.43.4`, which 2.116.0 satisfies [VERIFIED: node_modules/@supabase/ssr/package.json].

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed counter window | INCR/EXPIRE Lua | `@upstash/ratelimit` `fixedWindow` | Atomic script, ephemeral cache, timeout semantics |
| Ban predicate | a new expiry comparison | `isBanned()` (`src/lib/ban.ts:9-13`) | One predicate; the seed's truth table (`suspension_expired`) already exercises it |
| Role predicate | `roles.includes("admin")` | `requireRole` → `hasRole` | The inline copies are what REFAC-13 removes |
| Club membership check | per-route select | `requireClubRole` | No admin bypass by construction |
| RLS impersonation in tests | a Supabase client in tests | `tests.act_as()/act_as_anon()/act_as_owner()` (`000-setup.sql`) | Service keys bypass RLS; the helpers prove impersonation first |
| Origin parsing | regex on the Origin header | `new URL(origin).host` | Handles ports, IPv6, the `"null"` origin |
| Column immutability in a policy | a WITH CHECK subquery on `roles` | a column-scoped GRANT (F-006) or a SECURITY DEFINER compare helper (the `club_invitation_unchanged_except_status` pattern in `20260916000000`) | rls-review §4c: "a policy predicate cannot express 'this column may not change' without a trigger" |

**Key insight:** every one of these already has a working in-repo implementation or a vendor primitive. Phase 5's risk is drift between copies, not a missing capability.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Production** `admin_audit_log` holds 0 rows (F-007 evidence); after F-073 ships, rows start appearing, and the `/moderation` Recent Activity panel renders them. Production `users` rows with `onboarding_completed` false/null: **count unknown**. DB-truth onboarding (replacing the 1-hour cookie) will force any such user into `/onboarding` on deploy. Production auth users with **no** `public.users` row: unknown. The fail-closed proxy and seam would deny them | No data migration in Phase 5 (production is never touched). Record both unknowns as owner questions and a Phase 8 pre-deploy read-only count |
| Live service config | Vercel production env has exactly 3 vars (F-040); `ADMIN_API_KEY`/`ADMIN_EMAILS` are absent, so deleting their readers changes nothing live. **New:** the Upstash store and `UPSTASH_REDIS_REST_*` (or Marketplace `KV_REST_API_*`, C13) must be provisioned before a production deploy, or the limiter falls back to memory | Owner action, recorded as a Phase 8 deploy prerequisite; no billable resource is created in Phase 5 |
| Live service config | The Supabase Auth redirect allow-list decides whether F-077's route defect is reachable; it is not captured in git | Note in the completion note; no change |
| OS-registered state | None: no cron/launchd/pm2 registrations reference the touched code (the two Vercel/pg_cron jobs are Phase 6) | None, verified against `vercel.json` and `.planning/audit/async/` |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY`: name unchanged, read moves to the validated reader in `src/lib/supabase/`. A developer `.env` (not `.env.local`, per memory) may hold the service key and could later hold Upstash tokens, which Next loads. The Playwright `webServer.env` must blank the Upstash names (C8) | Code edit only |
| Build artifacts | `playwright/.auth/*.json` storage states carry `needs_onboarding=1` for `mid_onboarding_student` (auth.setup.ts:101-104); still valid. `src/lib/supabase/types.ts` must be regenerated when a migration adds a function (e.g. an `is_club_member` helper); grants and policies do not change generated types [ASSUMED: postgres-meta ignores privileges] and the CI drift gate proves it | Regenerate with CLI 2.115.0 in the same commit |

---

## Common Pitfalls

### Pitfall 1: A fix that works locally and fails in production (or the reverse)
**What goes wrong:** migrations reach production only in Phase 8, but code deploys immediately.
**How to avoid:** every code change must be correct against the **unmigrated production schema and the migrated local schema**. Examples:
- `users/[id]` PATCH on the cookie client works in both.
- Owner club edits must go through the elevated door, because an owner policy would be local-only.
- `logAdminAction` must not depend on a new column.

**Warning sign:** a handler change that only passes after `supabase db reset`.

### Pitfall 2: The column grant breaks a trigger (measured, C3)
**What goes wrong:** `REVOKE UPDATE ON users FROM authenticated` breaks every **SECURITY INVOKER** function that updates `users` for the caller. `update_saved_events_count()` is one, so saving an event fails with `permission denied for table users`.
**How to avoid:** a pgTAP case "authenticated user inserts into saved_events → succeeds, and `saved_events_count` increments" in the same file as the F-006 denials. Include the Playwright save spec in the slice floor.

### Pitfall 3: RLS deny tests that pass for the wrong reason
- UPDATE/DELETE denials are **silent 0-row** outcomes. Assert with `is_empty`/`results_eq` plus an owner-context integrity check.
- INSERT denials raise `42501` (`throws_ok`).
- `RETURNING` changes INSERT outcomes (see matrix note).
- The first assertion must prove `auth.uid()` moved (020's pattern).

### Pitfall 4: pgTAP tests addressing seed UUIDs run in the unseeded CI `types` job
**What goes wrong:** the `types` job runs `supabase test db` right after a bare `db reset` (ci.yml:120-133), so the `5eed…` rows do not exist.
**How to avoid:** either insert your own `00000000-0000-4000-8000-…` fixture rows inside the test transaction (020's pattern, with comments mapping them to personas), or guard each assertion with 040's `pg_temp.seeded()` sentinel + `skip()`. Recommended: own fixtures for RLS files (always executes), seed sentinel only for seed-coverage additions.

### Pitfall 5: Changing `applyApiRateLimit`'s signature
The PRESERVE suite calls it synchronously (`middlewareRateLimit.test.ts:85-140`). Making it `async` turns every `toBeNull()` into a Promise comparison. Keep it sync and add a new async entry (Pattern 4).

### Pitfall 6: Env validation at import time (C8)
It breaks CI `next build` (no service key), local `npx jest` (`proxy.test.ts` imports `./proxy`), and treats the Playwright `next start` as production if keyed on `NODE_ENV`.

### Pitfall 7: The proxy's single users read now gates everything
**What goes wrong:** a transient PostgREST error on that read now 500s the whole page (fail closed), where it used to pass through. That is intended, but a missing `users` row for a real account locks that account out (Runtime State).
**How to avoid:** distinguish `PGRST116` (no row) from other errors in the evidence and the tests, and decide the no-row UX explicitly (Open Question 3).

### Pitfall 8: `requireOnboarded` locks onboarding (C2)
**How to avoid:** a Playwright spec that runs the real wizard as `mid_onboarding_student` end to end would catch it. At minimum, a Jest case on `PATCH /api/users/[id]` and `POST /api/onboarding/complete` with `onboarding_completed: false` asserting 200.

### Pitfall 9: Upstash on the hot path
**What goes wrong:** each `/api/*` request adds one REST round trip. The default `timeout` is 5000 ms and fails open; `enableTelemetry` defaults to true.
**How to avoid:** `timeout: 1000`, `enableTelemetry: false`, a module-scope instance (ephemeral cache), region co-located with Vercel `iad1` (owner provisioning note).

### Pitfall 10: Shared mutable seed in Playwright
**What goes wrong:** one worker, shared seed. The F-016 acceptance spec and the admin moderation-action spec **mutate** state (membership, event status, audit rows).
**How to avoid:** each such spec restores state through the product's own API (owner `DELETE /api/clubs/[id]/members`; admin status revert) or targets rows added by this phase's additive seed. Assert "exactly one new audit row" by counting before and after, filtered on `target_id`, not by absolute count.

### Pitfall 11: Tag gate is file-level (C15)
Moving pins without a ledger entry reads as silent editing. Record each move in `evidence/defect-ledger.md`.

### Pitfall 12: `PROTECTED_ROUTES` must stay regex-parseable
`e2e/fixtures.ts:49` parses `PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]`. Refactoring the proxy into helpers must keep that literal, or the harness throws at load.

---

## Code Examples

### Lazy validated env (satisfies C8/C9)
```typescript
// src/lib/env.ts — no SUPABASE_SERVICE_ROLE_KEY read here (lint home is src/lib/supabase/)
export class MissingEnvError extends Error {
  constructor(name: string) { super(`Missing required environment variable: ${name}`); this.name = "MissingEnvError"; }
}
export function requireEnvValue(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") throw new MissingEnvError(name);
  return value;
}
// Literal member access so Next inlines NEXT_PUBLIC_* in the browser bundle.
export const supabaseUrl = () => requireEnvValue("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () => requireEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const isVercelProduction = () => process.env.VERCEL_ENV === "production";
export function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  if (isVercelProduction()) throw new MissingEnvError("UPSTASH_REDIS_REST_URL/TOKEN");
  return null; // caller logs one warning and uses the memory store
}

// src/lib/supabase/service.ts
import { requireEnvValue, supabaseUrl } from "@/lib/env";
export function createServiceClient() {
  return createClient<Database>(supabaseUrl(),
    requireEnvValue("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY));
}
```

### Upstash store
```typescript
// Source: @upstash/ratelimit 2.1.0 dist/index.d.ts (RatelimitConfig, limit(), RatelimitResponse)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const redis = new Redis({ url, token, enableTelemetry: false });
const limiters = new Map<number, Ratelimit>();            // module scope → ephemeralCache works
function limiterFor(limit: number) {
  let l = limiters.get(limit);
  if (!l) { l = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(limit, "60 s"),
                                prefix: "uv:rl", timeout: 1000, analytics: false });
            limiters.set(limit, l); }
  return l;
}
export const upstashStore: RateLimitStore = {
  async consume(key, limit) {
    const r = await limiterFor(limit).limit(key);           // { success, limit, remaining, reset(ms), reason }
    if (r.reason === "timeout") console.error("[RateLimit] store timeout; request allowed", { key });
    return { allowed: r.success, limit: r.limit, resetAtMs: r.reset };
  },
};
```
Unit-test the Redis path **without a live store** by `jest.mock("@upstash/ratelimit", …)` returning scripted `{ success, reset, reason }`. The contract test (`describe.skip` / `it.skip` with a reason when `upstashConfig()` is null) runs only with real variables, and the evidence reports "skipped", never "passed".

### F-006 / F-007 migration skeleton (idempotent, fix-forward)
```sql
-- F-007: the only writer is the elevated door
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;
REVOKE INSERT ON public.admin_audit_log FROM anon, authenticated;

-- F-006: column-scoped UPDATE (C3: + inferred_tags); saved_events_count via SECURITY DEFINER trigger
REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (name, avatar_url, banner_url, pronouns, year, faculty, visibility,
              interest_tags, inferred_tags, onboarding_completed, updated_at)
  ON public.users TO authenticated;
CREATE OR REPLACE FUNCTION public.update_saved_events_count() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET saved_events_count = saved_events_count + 1 WHERE id = NEW.user_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET saved_events_count = saved_events_count - 1 WHERE id = OLD.user_id; RETURN OLD;
  END IF; RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.update_saved_events_count() FROM PUBLIC, anon, authenticated;
-- Also consider: DROP POLICY + CREATE POLICY "Users can update own profile" ... TO authenticated
--   USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id)   -- F-018 hygiene for the rewritten policy
```
**Open point for the planner:** `INSERT` on `users` is still table-level for `authenticated` (`Users can insert own profile`). A user whose profile row does not exist could `INSERT` their own row with `roles = '{admin}'`. The callback creates the row at first sign-in and will fail closed, but the path remains. Recommended: `REVOKE INSERT ON public.users FROM anon, authenticated` in the same migration, since the only writer is the callback via the elevated door. Assert the denial in pgTAP.

### pgTAP deny/allow pair (house style)
```sql
BEGIN; SELECT plan(4);
INSERT INTO public.users (id, email) VALUES ('00000000-0000-4000-8000-00000000a005','p5-attacker@mail.mcgill.ca'); -- ≙ cross_club_attacker
-- … club + membership fixtures …
SELECT tests.act_as('00000000-0000-4000-8000-00000000a005');
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-00000000a005'::uuid, 'impersonation is real');
SELECT throws_ok($$ INSERT INTO public.events (title,start_date,end_date,created_by,club_id,status)
                    VALUES ('x', now()+'1 day', now()+'2 day', '<victim>', '<victim club>', 'approved') $$,
                 '42501', NULL, 'attacker cannot insert an approved event into another club');
-- allow direction for the real member, then integrity as owner …
SELECT * FROM finish(); ROLLBACK;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts`, Edge runtime default | `proxy.ts`, **Node runtime default**, `runtime` option throws | Next 16.0.0 | `@upstash/redis` (fetch) works; no `waitUntil` needed with analytics off [CITED: proxy.md:806] |
| Proxy as the auth ring | "Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone" | Next 16 docs | Matches CONTEXT's advisory proxy [CITED: proxy.md:251] |
| `getSession()` server-side | `getUser()` (revalidating) | Supabase guidance | Already true everywhere but `api/health` |
| Cookie `SameSite` implicit → Chrome "Lax+POST" 2-minute exception | Explicit `sameSite: "lax"` in @supabase/ssr defaults | ssr 0.x | No 2-minute POST window applies, because the attribute is explicit [ASSUMED: Chrome Lax-by-default exception covers only cookies without a SameSite attribute] |

**Deprecated/outdated:**
- `ADMIN_EMAILS` sign-in admin grant (F-004): delete.
- `ADMIN_API_KEY` gate (FO-01): delete.
- The `needs_onboarding` cookie as the source of truth: keep it as a hint only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `instrumentation.ts` `register()` may also run in the build's prerender workers, so a boot env check needs a `NEXT_PHASE !== "phase-production-build"` guard | C8, Structure | CI build fails if unguarded. Verify by running `npm run build` with CI's env (no service key) in the task that adds it |
| A2 | `supabase gen types` output is unaffected by GRANT/REVOKE/POLICY changes (only by tables, columns, functions, enums) | Runtime State | Type-drift gate red. Caught immediately by `diff -u` in the `types` job |
| A3 | Chrome's "Lax-by-default + 2-minute POST" exception does not apply to cookies with an explicit `SameSite=Lax` | State of the Art, CSRF | CSRF assessment overstates protection for a 2-minute window. The origin check covers it regardless |
| A4 | The Vercel Marketplace Upstash integration injects `KV_REST_API_*` rather than `UPSTASH_REDIS_REST_*` (web search, MEDIUM; classify-confidence LOW) | C13 | Wrong names mean a production boot failure or a memory fallback. Mitigated by reading both names |
| A5 | Vercel overwrites `X-Forwarded-For` on non-Enterprise plans (web search) | Alternatives | IP-keyed limits spoofable. Mitigation: prefer `x-real-ip` when present |
| A6 | Production has few or no users with `onboarding_completed` false/null and none without a `public.users` row | Runtime State, Pitfall 7 | Users are forced into onboarding or locked out on deploy. Needs an owner-authorized read-only count before the Phase 8 deploy |

## Open Questions

1. **Owner club writes: elevated door vs owner UPDATE policy (C11).**
   - What we know: owner edit and delete are broken today in both environments. A policy fix is local-only until Phase 8 and needs status immutability.
   - Recommendation: elevated door (works on deploy), register F-087, INTENTIONAL BEHAVIOUR CHANGE. Rule-resolved if no owner answer.
2. **May a non-member's pending event carry another club's `club_id`?** Today both the handler and RLS allow it (only approval requires membership).
   - Recommendation: preserve it (the F-008 policy keeps the `status = 'pending'` arm open to any `club_id`). Record it as a DEC. The cross-club denial is defined as "approved into a club I'm not in" plus "forged `created_by`".
3. **No-profile-row UX.** When the fail-closed proxy meets an authenticated user without a `users` row, it can 500, 403, or sign out and redirect to `/?error=profile_sync_failed`.
   - Recommendation: for pages, sign out and redirect with the same error code the callback uses; for `/api/*`, 403. Pin with tests.
4. **F-028 split (C7).** Owner confirmation that `rsvp` GET and `clubs/[id]/events` go to Phase 6 as a cache-header fix rather than 401.
5. **`/invites/[token]` auto-accept on GET (C14).** Accept as Low residual (recommended), or convert to POST (UX change).
6. **Upstash pins.** 2.1.0/1.38.4 (recommended) vs 2.0.8 for >30-day age. Resolved at the human-verify checkpoint.
7. **Production counts (A6).** Blocked by the "production is never touched" rule. List as an owner action.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | 24.16.0 | — |
| Supabase CLI | pgTAP, db reset, gen types | ✓ | 2.115.0 (CI-pinned; 2.117.0 available, do not upgrade) | — |
| Docker + local stack | pgTAP, Playwright, probes | ✓ running (`supabase_db_Event-Radar`), seeded (10 users) | — | — |
| `psql` on host | ad-hoc probes | ✗ | — | `docker exec supabase_db_Event-Radar psql -U postgres` (used in this research) |
| Playwright Chromium | e2e | ✓ (harness green at 40/0 per Phase 4) | 1.63.0 | — |
| Upstash Redis | production limiter | ✗ (not provisioned; must not be created) | — | memory store locally/CI; contract test **skipped** |
| `timeout` binary | — | ✗ (macOS) | — | none needed |

**Missing dependencies with no fallback:** none for Phase 5 execution.
**Missing dependencies with fallback:** Upstash (memory store), host `psql` (docker exec).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2 + ts-jest 29.4.6 (node + jsdom projects); pgTAP via `supabase test db` (CLI 2.115.0); Playwright 1.63.0 |
| Config file | `jest.config.js`, `supabase/tests/database/000-setup.sql`, `playwright.config.ts` |
| Quick run command | `npx jest --ci <path>` (single suite, < 5 s) |
| Full suite command | `npx jest --ci && supabase test db --local && npx playwright test` |
| Measured floors (2026-09-23) | Jest **744 passed / 50 suites / 0 skipped**; pgTAP **86 tests / 6 files PASS** (seeded); Playwright **40** (10 setup + 30 spec `test()`); ratchet `committed=25 live=25 delta=0`; tag gate `ok 18 files` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFAC-11 | `getSession(` only in `api/health` | unit (grep) | `npx jest --ci src/server/__tests__/no-getsession.test.ts` | ❌ Wave 0 |
| REFAC-11 | env readers throw `MissingEnvError` lazily; no throw at import | unit | `npx jest --ci src/lib/env.test.ts` | ❌ Wave 0 |
| REFAC-11 | `requireActiveUser` 401 / 403 "Account suspended" / fail-closed null profile; `requireOnboarded` 403 "Onboarding required" | unit | `npx jest --ci src/server/__tests__/requireActiveUser.test.ts src/server/__tests__/requireOnboarded.test.ts` | ❌ Wave 0 |
| REFAC-11 | context selects `banned_at, ban_expires_at` | unit (existing, edited as a DEFECT-free extension) | `npx jest --ci src/server/__tests__/context.test.ts` | ✅ (the column-list assertion at :88-99 changes; DI-35 closure note) |
| REFAC-11 | proxy: banned `/api/*` → 403 JSON; page → 307 `/banned`; catch → 500; env pass-through gone; onboarding from DB | unit (proxy with mocked `@supabase/ssr`) | `npx jest --ci src/proxy.behaviour.test.ts` | ❌ Wave 0 (`src/proxy.test.ts` is matcher-only; keep it unedited) |
| REFAC-11 | ten former `checkBanStatus` routes keep their 403 bytes | unit (existing PRESERVE + new) | `npx jest --ci src/__tests__/api/events/save-characterization.test.ts …rsvp-characterization…` | ✅ partial |
| REFAC-11 | callback: no role write regardless of `ADMIN_EMAILS`; upsert failure → sign-out + `?error=profile_sync_failed`; `next` absolute/protocol-relative → `/` | unit | `npx jest --ci src/app/auth/callback` | ✅ PRESERVE + ❌ `route-defect.test.ts` |
| REFAC-11 | banned persona 403 JSON on `/api/*`; `mid_onboarding_student` page → `/onboarding`, POST → 403 | e2e | `npx playwright test e2e/specs/ban-and-onboarding-ring.spec.ts` | ❌ Wave 0 |
| REFAC-11 | wizard completes for `mid_onboarding_student` (C2 exemptions) | unit + e2e | `npx jest --ci src/__tests__/api/onboarding-exemptions.test.ts` | ❌ Wave 0 |
| REFAC-12 | each of the 17 sites: anonymous 401, non-member 403 (exact message), wrong role 403, right role 2xx | unit (fakeSupabase) | `npx jest --ci src/__tests__/api/clubs/` | ❌ Wave 0 (only `analytics.test.ts` exists) |
| REFAC-12 | `cross_club_attacker` → 403 on every club mutation route | e2e | `npx playwright test e2e/specs/cross-club-denial.spec.ts` | ❌ Wave 0 |
| REFAC-12 | RLS ring: attacker denied, owner allowed (or both direct-denied where the owner path is elevated) per table | pgTAP | `supabase test db --local` (060-club-tenant-isolation) | ❌ Wave 0 |
| REFAC-12 | F-016 A invites B, B accepts, B is a member (then cleanup) | e2e | `npx playwright test e2e/specs/club-invitation-acceptance.spec.ts` | ❌ Wave 0 |
| REFAC-13 | every admin route: anonymous 401, `onboarded_student` 403 | unit (table-driven over the 25 files) + e2e sample | `npx jest --ci src/__tests__/api/admin/admin-guard.test.ts`; `npx playwright test e2e/specs/admin-guard.spec.ts` | ❌ Wave 0 |
| REFAC-13 | `calculate-popularity` fails closed (F-001) | unit | same file | ❌ |
| REFAC-13 | `logAdminAction` surfaces a rejected insert; payload has no `admin_email` | unit (flip `audit-shape.test.ts` DEFECT F-072/F-073) | `npx jest --ci src/__tests__/moderation/audit-shape.test.ts` | ✅ (moves) |
| REFAC-13 | one moderation action → exactly one new audit row | e2e | `npx playwright test e2e/specs/admin-audit-row.spec.ts` | ❌ |
| REFAC-13 | F-006/F-007 at the RLS ring (+ save still works, C3) | pgTAP | `supabase test db --local` (050, 055) | ❌ |
| REFAC-13 | service-role only via the door; allowlist = 2 cron routes | gate | `node scripts/check-elevated-ratchet.mjs && npm run lint` | ✅ |
| REFAC-13 | F-005: anonymous on private profile → 404; select has no `email`; metadata gated | unit (page with mocked elevated) + e2e | `npx jest --ci src/__tests__/pages/public-profile.test.ts` | ❌ |
| REFAC-13 | DI-36: creator/admin receive `pending_edits`, others do not | unit | `npx jest --ci src/__tests__/api/events/events-detail-characterization.test.ts` + new DEFECT F-086 | ✅ + ❌ |
| REFAC-18 | admin 429 after budget; public budgets and headers unchanged; memory vs Upstash selection by config | unit | `npx jest --ci src/middlewareRateLimit.test.ts src/server/ratelimit/` | ✅ PRESERVE + ❌ |
| REFAC-18 | Upstash contract (**skipped without vars**) | integration | `npx jest --ci src/server/ratelimit/upstash.contract.test.ts` | ❌ |
| REFAC-17 | cross-site / mismatched Origin → 403 JSON; no-header and same-origin pass | unit + e2e (`page.request.post` with explicit `Origin`/`Sec-Fetch-Site` headers) | `npx jest --ci src/server/__tests__/csrf.test.ts`; `npx playwright test e2e/specs/csrf-origin.spec.ts` | ❌ |
| REFAC-17 | written assessment | doc | `test -f evidence/csrf-assessment.md` | ❌ |
| all | PRESERVE/DEFECT tagging | gate | `node scripts/check-characterization-tags.mjs --all` | ✅ |

### Sampling Rate
- **Per task commit:** `npx jest --ci <touched suites>` plus `node scripts/check-characterization-tags.mjs --all`. Add `npm run lint` when imports change and `supabase test db --local` when SQL changes.
- **Per slice close:** `supabase db reset --local && npx tsx scripts/seed/load.ts && supabase test db --local && npx jest --ci && npx tsc --noEmit && npm run lint && node scripts/check-elevated-ratchet.mjs && npx playwright test`. Record the output in `evidence/floor.slice-N-after.txt` and `evidence/playwright.slice-N-after.txt`.
- **Phase gate:** the full suite green, plus `supabase gen types typescript --local --schema public | diff -u src/lib/supabase/types.ts -`, plus `npm run build` with the CI env (placeholder `NEXT_PUBLIC_*`, **no** service key) to prove C8.

### Wave 0 Gaps
- [ ] `src/server/__tests__/requireActiveUser.test.ts`, `requireOnboarded.test.ts`, `csrf.test.ts`, `no-getsession.test.ts`
- [ ] `src/lib/env.test.ts`
- [ ] `src/proxy.behaviour.test.ts`: mock `@supabase/ssr` `createServerClient` (`auth.getUser`, `from("users")`); build `NextRequest`s
- [ ] `src/server/ratelimit/*.test.ts` + skipped-by-default Upstash contract test
- [ ] `src/__tests__/api/clubs/*-characterization.test.ts` (PRESERVE, before refactor) + `*-defect.test.ts` where bytes change
- [ ] `src/__tests__/api/admin/admin-guard.test.ts` (table-driven: route module × method × persona → status)
- [ ] `src/app/auth/callback/route-defect.test.ts` (moved tests 7–8 + F-077 cases)
- [ ] pgTAP `050-users-privilege-escalation.test.sql`, `055-admin-audit-log-insert.test.sql`, `060-club-tenant-isolation.test.sql`; extend `040-seed-coverage.test.sql` for the additive seed rows
- [ ] Playwright: `ban-and-onboarding-ring`, `cross-club-denial`, `club-invitation-acceptance`, `admin-guard`, `admin-audit-row`, `csrf-origin`, public-profile privacy; fix DI-38 in the test at `save-and-rsvp.spec.ts:53` (the `Promise.all([page.waitForResponse(… saved-events …), page.reload()])` race; replace with `await page.reload()` then `page.request.get("/api/users/saved-events")`)
- [ ] Seed (additive, fixed `5eed…` ids): one `visibility: "private"` user (needs an auth user via the loader's admin API path), one pending invitation or a dedicated invitee persona. If a new persona is added, update `PERSONA_KEYS` and `auth.setup.ts`; that adds one setup test to the Playwright count

## Security Domain

### Applicable ASVS Categories (Level 1, `security_enforcement: true`, block on high)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (`getUser()` revalidation), McGill domain check in the callback, fail-closed profile sync |
| V3 Session Management | yes | `@supabase/ssr` cookies. SameSite=Lax, **not HttpOnly** (the browser client reads `document.cookie`, auth.setup.ts:91-94), **no `Secure` attribute** (HSTS in `next.config.js` mitigates downgrade). Record in the CSRF assessment; changing cookie options is the deferred ssr work |
| V4 Access Control | yes | `src/server/authz/*` guards (deny by default), RLS + column grants, elevated door with register |
| V5 Input Validation | partial | Minimal in Phase 5 (zod is Phase 6). **Must** validate `roles` against the `user_role` enum in the admin PATCH, `next` in the callback, the route `params` types |
| V6 Cryptography | no | nothing hand-rolled; no new crypto |
| V7 Error Handling & Logging | yes | Errors returned, generic 500s; `logAdminAction` inspects and `console.error`s rejected writes |
| V13 API | yes | Rate limiting on all `/api/*` including admin; CSRF origin check on non-GET `/api/*` |

### Known Threat Patterns for Next.js 16 + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-escalation via direct PostgREST `PATCH users` (F-006) | Elevation of Privilege | Column-scoped UPDATE grant; revoke INSERT; pgTAP |
| Forged audit rows (F-007) | Repudiation / Tampering | Drop INSERT policies, revoke INSERT; elevated-only writer |
| Cross-club approved event with forged `created_by` (F-008) | Tampering / EoP | WITH CHECK binding `created_by` and membership |
| Fail-open env gate (F-001, F-003) | EoP | Presence checks fail closed; delete env-gated authz |
| Open redirect via `next` (F-077) | Spoofing | `/`-prefix and not `//` |
| Private profile disclosure (F-005) | Information Disclosure | Visibility gate in page and metadata; no `email` in select |
| Cross-site state change | Spoofing (CSRF) | SameSite=Lax + origin/Sec-Fetch-Site check |
| Distributed brute force / scraping of admin API | DoS | Upstash-backed limiter including `/api/admin/*` |
| Rate-limit key spoofing via `X-Forwarded-For` | Spoofing | Vercel overwrites XFF [CITED: vercel.com/docs/headers/request-headers] |

## Sources

### Primary (HIGH confidence)
- Codebase reads (every `file:line` cited above), `.planning/audit/*` registers, `findings.json`, `endpoints.json`, `pg_policies.json`
- Local stack probes via `docker exec supabase_db_Event-Radar psql` (rolled-back transactions): F-006, F-007, F-008, the owner-write denials, and the column-grant breakage of the save trigger and `inferred_tags`
- `node_modules/@supabase/ssr/dist/main/utils/constants.js` (cookie defaults), `…/cookies.js` (setAll options)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (Node runtime, proxy-not-sufficient warning), `…/instrumentation.md` (register), `…/02-guides/data-security.md` (Server Action origin check)
- `node_modules/@next/env/dist/index.js` (env override semantics)
- `@upstash/ratelimit@2.1.0` and `@upstash/redis@1.38.4` tarballs (shipped `dist/index.d.ts`, `dist/index.js`, `nodejs.js`)
- npm registry (`npm view`), `gsd-tools query package-legitimacy check`
- Measured floors: `npx jest --ci` 744/744; `supabase test db --local` 86 PASS; ratchet 25/25; tag gate ok 18

### Secondary (MEDIUM confidence)
- github.com/upstash/ratelimit-js/releases (2.2.0 / 2.1.0 / 2.0.8 notes)
- [Upstash for Redis – Vercel Marketplace](https://vercel.com/marketplace/upstash/upstash-kv), [Vercel request headers](https://vercel.com/docs/headers/request-headers), [x-forwarded-for overwritten on Vercel discussion](https://github.com/vercel/community/discussions/2484), [Marketplace KV_REST_API_* env PR example](https://github.com/JMihailcs/Portafolio/pull/3)

### Tertiary (LOW confidence)
- Chrome Lax-by-default exception scope (A3), build-phase `register()` behaviour (A1): training knowledge, flagged

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for existing deps (installed versions read); MEDIUM for Upstash (registry and package verified, provisioning names from web search)
- Architecture: HIGH. Seam, guards and door exist and were read; the RLS matrix was measured
- Pitfalls: HIGH for C1–C12 and C14–C17 (source or probe evidence); MEDIUM for C13; the A-items are flagged

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 for Upstash versions (fast-moving); 2026-10-23 for the codebase inventory, or until any slice lands
