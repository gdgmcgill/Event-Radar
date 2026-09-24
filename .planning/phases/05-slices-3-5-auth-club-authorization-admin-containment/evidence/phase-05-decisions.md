# Phase 5 decision record — DEC-33 through DEC-58

**Plan:** 05-01 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-24

These are the design calls every later Phase 5 plan executes against. The binding inputs are
`05-CONTEXT.md` (its decisions and its "Amendments after research" section, which supersedes the
bullets it names) and `05-RESEARCH.md` (§ Corrections C1-C17, § Inventories A-H, § Open Questions,
§ Assumptions Log).

**No phase owner was present.** CONTEXT was gathered in autonomous smart-discuss mode, and every
answer in it was accepted by rule. Every decision below is therefore a **rule-resolved default**,
not an owner verdict. The owner may override any decision by appending a signed paragraph
(name, date, the option chosen) under its section **before the plan named in "Executed by" runs**.
When the executing plan finds such a paragraph, it stops before changing a file and re-plans against
it. This is the Phase 4 DEC-25/DEC-32 mechanism. A decision with no signed paragraph under it when its
plan starts is executed as written, and the phase completion note lists it as rule-resolved.

**Numbering.** `DEC-` continues from DEC-32, the highest in use outside this phase's own plans. That
was confirmed on 2026-09-24 by
`command grep -rhoE 'DEC-[0-9]+' .planning --exclude-dir=05-slices-3-5-auth-club-authorization-admin-containment --exclude=ROADMAP.md | sort -V | tail -1`,
whose result is `DEC-32`. (The unfiltered grep returns DEC-57, because the nineteen Phase 5 plans
and the ROADMAP's plan list already cite the ids this file defines.) `DEC-` ids are decisions and
`DI-` ids are deferred items, per the prefix rule in
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/deferred-items.md`
§ "The two D- sequences, disambiguated".

**Shape.** Each section has four parts: **Decision**, **Evidence**, **Alternative rejected**,
**Executed by**. A decision that changes wire bytes says `INTENTIONAL BEHAVIOUR CHANGE`, and the
executing commit carries the same words in its body.

---

## DEC-33 — Slice order and plan map

**Decision.** Slices run 3 → 4 → 5, and each closes before the next starts. Slice 3 (auth ring, ban,
onboarding, validated config; REFAC-11) is 05-02..05-08. Slice 4 (club authorization and the RLS
ring; REFAC-12) is 05-09..05-11. Slice 5 (admin containment, service role, rate limiting, CSRF;
REFAC-13, REFAC-17, REFAC-18) is 05-12..05-19. The CSRF origin check lands in **slice 5**, beside
the limiter (05-17), not in slice 3, even though it lives in the proxy that slice 3 rewrites.

**Evidence.** CONTEXT Area 4 fixes the order 3 → 4 → 5. REFAC-17 (CSRF) and REFAC-18 (distributed
limiter) both edit the proxy's pre-auth prologue (`src/proxy.ts:6-8` today), and CONTEXT Specifics
place the origin check "in the proxy next to the rate limiter and runs before session work". One
plan owning that prologue avoids two rewrites of the same lines in two slices.

**Alternative rejected.** Putting the origin check in slice 3 with the rest of the proxy rewrite.
That would edit the prologue twice (slice 3 for CSRF, slice 5 for the store), and slice 3's
characterization would have to pin a CSRF surface whose test design (05-12's `csrf-origin.spec.ts`)
belongs to slice 5.

**Executed by:** every Phase 5 plan; the ROADMAP Phase 5 plan list is the map.

## DEC-34 — The write-guard contract

**Decision.** Every state-changing (POST, PUT, PATCH, DELETE), non-admin, authenticated arm under
`src/app/api` calls `requireActiveUser(ctx)` and then `requireOnboarded(ctx)` as its first statements
after `createRequestContext()`. Exactly two arms are exempt from `requireOnboarded`:
`POST /api/onboarding/complete` and `PATCH /api/users/[id]` (self-update; that route already
refuses another id). `POST /api/interactions` and `POST /api/feedback` accept anonymous callers,
so they apply both guards only when `ctx.user` is present. GET arms gain neither guard. Where an
arm's anonymous response today is not `401 {"error":"Unauthorized"}`, it keeps its own anonymous
branch first, so its anonymous bytes do not change.

INTENTIONAL BEHAVIOUR CHANGE: banned callers are refused on the DELETE arms too. This closes the
Phase 4 ban asymmetry, where a banned user can un-save and cancel an RSVP but cannot create either
(DEC-24; `src/app/api/events/[id]/save/route.ts:24` DELETE and
`src/app/api/events/[id]/rsvp/route.ts:366` DELETE carry no ban check).

**Evidence.** Research C2: `src/components/onboarding/OnboardingWizard.tsx:61` calls
`PATCH /api/users/${userId}` and `:79` calls `POST /api/onboarding/complete`, so a blanket
`requireOnboarded` would lock onboarding (Pitfall 8). Measured on the base commit: 40 exported
POST/PUT/PATCH/DELETE arms under `src/app/api` outside `admin/` and `cron/`, and 10 files calling
`checkBanStatus()`. So 30 arms carry no ban check (F-088). CONTEXT Area 1 sets the default to
"every state-changing authenticated handler".

**Alternative rejected.** (a) Adding the guards only to the ten arms that call `checkBanStatus()`
today. That keeps F-088's handler-ring gap, and the proxy is advisory after 05-05. (b) Applying
`requireOnboarded` to GET arms. That would blank read surfaces for an un-onboarded user in the
middle of the wizard, which CONTEXT keeps readable.

**Executed by:** 05-04 (the guards), 05-06 (events-family arms), 05-07 (every other arm), pinned
beforehand by 05-03.

## DEC-35 — A signed-in user with no profile row

**Decision.** When the seam or the proxy meets an authenticated user with no `users` row, a
`/api/*` request gets `403 {"error":"Profile not found"}`. A page request signs the user out and
redirects to `/?error=profile_sync_failed`, the error code the callback already uses.

**Evidence.** Research Open Question 3 and CONTEXT Area 1 amendment "No-profile-row handling". The
legacy helper admits such a caller today: `src/lib/ban.ts:33` returns `null` when `profile` is
null, which the caller reads as "not banned". The proxy does the same at `src/proxy.ts:96-104`.

**Alternative rejected.** (a) 500. That makes a data condition look like an outage and cannot be
told apart from DEC-36's fault path. (b) Admitting the caller (today's behaviour). That is the
fail-open shape F-088 registers.

**Executed by:** 05-04 (seam), 05-05 (proxy), 05-08 (`e2e/specs/no-profile-row.spec.ts`).

## DEC-36 — The proxy's fail-closed shape

**Decision.** For an authenticated request, the proxy does one `users` read selecting `banned_at`,
`ban_expires_at` and `onboarding_completed`. PostgREST error `PGRST116` (no row) takes the DEC-35
branch. Any other read error throws. The outer `catch` returns `500 {"error":"Failed to process request"}`
(JSON) under `/api/`, and a plain-text 500 `Internal Server Error` otherwise. It logs with the kept
`[Middleware]` prefix. The onboarding redirect reads the database value. The `needs_onboarding`
cookie remains a hint only: the callback keeps setting it, and nothing trusts it.

**Evidence.** `src/proxy.ts:140-144` (the catch passes the request through), `:96-104` (a failed ban
read leaves `isBanned` false), `:124-136` (onboarding predicate is the cookie). CONTEXT Area 1
bullets two and four and Specifics ("one query, three decisions, no extra round-trip"). Research
Pitfall 7.

**Alternative rejected.** (a) Two reads, one for ban and one for onboarding. That doubles the
per-request round-trips. (b) A redirect to an error page from the catch. That turns a JSON API
failure into HTML, which is F-062's shape.

**Executed by:** 05-05, pinned beforehand by 05-02 (`src/proxy-characterization.test.ts`,
`src/proxy-defect.test.ts`).

## DEC-37 — Validated config

**Decision.** `src/lib/env.ts` exports lazy readers. Each throws `MissingEnvError` at first **read**
when its variable is absent or empty, and never at module evaluation. "Production" means
`process.env.VERCEL_ENV === "production"`, never `NODE_ENV`. The service-key read stays in
`src/lib/supabase/service.ts` as `serviceRoleKey()` (a literal member access wrapped in the shared
`requireEnvValue` helper). The elevated door exports `assertElevatedConfigured()`.
`src/instrumentation.ts` `register()` runs the boot check only when `NEXT_RUNTIME === "nodejs"` and
`NEXT_PHASE !== "phase-production-build"`.

**Evidence.** Research C8: the CI `ci` job builds with placeholder `NEXT_PUBLIC_*` and no service key
(`.github/workflows/ci.yml:24-26`), and `next build` evaluates route modules. The Playwright harness
runs `npm run build && npm run start`, so `NODE_ENV` is `production` locally. `src/proxy.test.ts`
imports the proxy with no Supabase env. Research C9: `eslint.config.mjs:82-107` fails a
`SUPABASE_SERVICE_ROLE_KEY` read outside `src/lib/supabase/**` and `src/server/db/elevated/**`.
Research A1 (the build-phase guard) is closed by 05-04's build proof.

**Alternative rejected.** (a) Throwing at import. That breaks the CI build and the proxy unit test.
(b) Reading env by computed key (`process.env[name]`). That evades the lint rule, and Next inlines
only literal `process.env.NEXT_PUBLIC_*` reads into the browser bundle.

**Executed by:** 05-04.

## DEC-38 — The auth callback (F-004, F-077, FO-05)

**Decision.** (a) The sign-in-time admin grant and its `ADMIN_EMAILS` allowlist are deleted.
(b) A failed profile sync (upsert or read) signs the user out and redirects with
`error=profile_sync_failed`. (c) `next` is accepted only when it starts with `/`, its second
character is neither `/` nor a backslash, and it resolves to the request origin. Otherwise it is
`/`. (d) Both service-role uses (the non-McGill `auth.admin.deleteUser` and the profile upsert) go
through the elevated door. (e) The profile read keeps the column list
`onboarding_completed, roles`, so PRESERVE test 5 passes unedited.

The callback PRESERVE suite's service mock gains an `auth.admin.deleteUser` member because the seam
it mocks moved to `@/server/db/elevated`. That changes zero assertions. It is a rule-resolved
deviation from "PRESERVE files otherwise stay unedited", and it gets a row in
`evidence/defect-ledger.md`.

**Evidence.** Research § A "Callback characterization impact" (the suite mocks exactly three seams,
and after (d) two of them come from the door). Research § B row "Callback `next`": any value,
including `https://evil.test`, reaches the redirect today (F-077). CONTEXT Area 1 bullet five. F-040:
production has never had `ADMIN_EMAILS`, so (a) changes nothing there. The backslash clause covers
`/\evil.test`, which browsers normalise to a protocol-relative URL. The same-origin resolution is the
final check.

**Alternative rejected.** (a) An allowlist of `next` paths. It would need maintenance on every new
page, and the same-origin rule already closes the redirect. (b) Keeping the upsert optional when the
service key is absent (today's FO-05 shape). That admits a user whose profile was never written.

**Executed by:** 05-05, pinned beforehand by 05-02 (`src/app/auth/callback/route-defect.test.ts`).

## DEC-39 — F-028 split and F-027

**Decision.** Anonymous callers get `401 {"error":"Unauthorized"}` on four routes in slice 3:
`/api/events/following`, `/api/events/friends-activity`, `/api/events/friends-organizing` and
`/api/events/[id]/friends`. `GET /api/events/[id]/rsvp`, `GET /api/clubs/[id]/events` and
`/api/notifications/count` go to Phase 6 (REFAC-19). `/api/auth-debug` is deleted (F-027). At
slice-3 close, F-028 is re-pointed to `"06"` with a resolution naming the four routes fixed.

**Evidence.** Research C7: the rsvp GET feeds public counts (`RsvpButton.tsx:36-39`) and the club
events GET is the public club event list (`src/hooks/useClubs.ts:28,39`). A 401 would break the
Validated "anonymous browse" and "public club pages" workflows. Every client caller of the four
routes is already user-gated and ignores `!res.ok`.

**Alternative rejected.** 401 on all eight routes (F-028's literal recommendation). That blanks
public UI, which the program's core value forbids.

**Executed by:** 05-04 (auth-debug deletion), 05-06 (the four 401s), 05-08 (the re-point), pinned
by 05-03 (`anonymous-personalized-defect.test.ts`).

## DEC-40 — The club guard

**Decision.** `export const CLUB_ROLES = ["owner", "organizer"] as const` sits beside
`requireClubRole`, and `ClubRole` is typed from it. Each call site passes exactly the accepted set in
research § C: `["owner"]` or `["owner", "organizer"]`. No site-wide admin bypass is added. The
ownership transfer demotes the old owner by `(club_id, user_id)` rather than widening the guard's
result to include the membership id.

**Evidence.** Research C1: `club_members_role_check` admits only `owner` and `organizer`
(`supabase/migrations/20260915214553_baseline.sql:688`). `ClubRole` is `string` today
(`src/server/authz/requireClubRole.ts:29`). Research § C row 10: the transfer demotes by membership
id (`src/app/api/clubs/[id]/transfer/route.ts:64`). The guard's docblock and persona rule R9 forbid
the bypass.

**Alternative rejected.** (a) Returning the membership row from the guard. That widens a contract
seventeen sites depend on for one caller. (b) An admin bypass in the guard. That silently grants
admins every club owner surface, and REFAC-12 is about removing implicit grants.

**Executed by:** 05-10, pinned beforehand by 05-09.

## DEC-41 — Owner club writes (F-087)

**Decision.** `PATCH /api/clubs/[id]`, the `DELETE /api/clubs/[id]` soft-delete and
`PATCH /api/clubs/[id]/members/role` perform their write on `getElevatedClient()`, after
`requireClubRole(…, ["owner"])`. Each keeps the handler's existing column whitelist, so `status`,
`created_by` and `id` are never writable through the owner path (the soft-delete writes exactly
`status = 'deleted'`). Each operation family has a REGISTRY row. The RLS ring keeps denying direct
owner writes. INTENTIONAL BEHAVIOUR CHANGE: owner edit, delete and role change start working.

**Evidence.** Research C11, measured on the local stack and re-probed for F-087
(`.planning/audit/quality/phase-05-slice-defects.md#f-087--owner-club-writes-are-denied-by-rls`):
as `club_owner`, `UPDATE clubs` and `UPDATE club_members` affect 0 rows. `clubs` has no owner UPDATE
policy, and `club_members` UPDATE is admin-only. Research Open Question 1 recommends the door because
it works in production on deploy.

**Alternative rejected.** An owner UPDATE policy on `clubs` and `club_members`. It needs
status-column immutability (a trigger or a column grant), and it stays local-only until the Phase 8
migration repair (DI-23), so owners stay broken in production for three more phases.

**Executed by:** 05-10 (door writes and REGISTRY rows), 05-11 (pgTAP 060 asserts a direct owner
`UPDATE clubs` still affects 0 rows), pinned beforehand by 05-09.

## DEC-42 — The F-008 events INSERT policy

**Decision.** The fix-forward policy is `TO authenticated` with
`WITH CHECK (is_admin() OR (created_by = (select auth.uid()) AND (status = 'pending' OR (status = 'approved' AND club_id IS NOT NULL AND <caller is a member of club_id> AND <the club is approved>))))`.
A pending event may name another club.

**Evidence.** Research C10: as `cross_club_attacker`, an approved event with a forged `created_by`
inserts into another club (policy `Authenticated users can insert events`, `WITH CHECK (true)`). The
admin arm is required because `POST /api/admin/events` inserts with no `created_by`
(`src/app/api/admin/events/route.ts:150-163`). The approval arm mirrors
`src/app/api/events/create/route.ts:137-165`. Research Open Question 2 recommends preserving the
pending-into-any-club behaviour, which both the handler and RLS allow today.

**Alternative rejected.** Requiring membership for pending events as well. That is a product
behaviour change (a student proposing an event for a club they do not belong to), and no finding
asks for it.

**Executed by:** 05-11.

## DEC-43 — F-016 is proven locally, not closed

**Decision.** An e2e spec mints an invitation through `POST /api/clubs/[id]/invites`, accepts it
through `/invites/[token]`, and restores membership through `DELETE /api/clubs/[id]/members`. F-016
stays `Open`, with a local-proof resolution and `closes_in_phase: "08"` (DI-23).

**Evidence.** CONTEXT Area 2 bullet four. The invitee policies are in
`supabase/migrations/20260916000000_invitation_policy_fixes.sql`, which production has not applied.
Production is not written in Phase 5.

**Alternative rejected.** Marking F-016 `Fixed`. Production acceptance is still broken, and a
`Fixed` status would claim a production state nobody measured.

**Executed by:** 05-11 (`e2e/specs/club-invitation-acceptance.spec.ts`), 05-19 (register edit).

## DEC-44 — The admin guard (F-061)

**Decision.** `requireRole(ctx, "admin")` replaces the admin-verify helper at every callsite.
Anonymous callers get `401 {"error":"Unauthorized"}`. Authenticated non-admins get
`403 {"error":"Forbidden"}`. The three routes that answer 401 to non-admins today move to 403. The
admin and moderation layouts use `getRequestContext()` and `hasRole`, with their redirects unchanged.

**Evidence.** Research § B: 30 callsites answer 403 to both anonymous and non-admin callers, and
three (`admin/clubs` GET, `admin/organizer-requests` GET, `recommendations/batch` POST) answer 401 to
both. `endpoints.json` `expected_status` already encodes anonymous 401 / student 403 for 26 of 27
admin-family rows (research § E). The before-floor census counts the callsites (floor block 16).

**Alternative rejected.** Keeping 403 for anonymous callers. That contradicts the contract and
F-061.

**Executed by:** 05-13, pinned beforehand by 05-12.

## DEC-45 — Admin role changes (F-091)

**Decision.** `PATCH /api/admin/users/[id]` writes through the elevated door. `roles` is validated
against `user_role` (`user`, `admin`, `club_organizer`), else
`400 {"error":"Invalid role","field":"roles"}`. `user` is still always included. A roles change
whose target id equals the caller's id gets `403 {"error":"You cannot change your own roles"}`. A
name-only edit on oneself is unchanged. The `admin` role is no longer stripped. The route writes
`logAdminAction` with action `updated`, targetType `user`, metadata `{ roles }`.
INTENTIONAL BEHAVIOUR CHANGE ×2: the route starts working, and it stops stripping `admin`.

**Evidence.** Research C12 and F-091 (`quality/phase-05-slice-defects.md#f-091--admin-role-changes-cannot-land-and-strip-admin`):
the cookie-client update (`route.ts:31-36`) affects 0 rows for any other target, because `users` has
no admin UPDATE policy. `.single()` then errors and the route returns 500. `route.ts:21-26` filters
`admin` out of every submitted array. The `/moderation/users` organizer toggle
(`src/app/moderation/users/page.tsx:53-57`) sends the target's whole array.

**Alternative rejected.** (a) An admin UPDATE policy on `users`. It is local-only until Phase 8 and
would re-open the F-006 surface at the RLS ring. (b) Keeping the `admin` strip. After F-004 deletes
the callback grant, this route becomes the only admin grant path, so the strip would leave no way to
grant admin at all.

**Executed by:** 05-14, pinned beforehand by 05-12 (`admin-users-patch-defect.test.ts`).

## DEC-46 — The audit writer (F-072, F-073)

**Decision.** `logAdminAction` writes through the door without the absent `admin_email` column. It
gains an optional `requestId`, inspects the insert result, and logs a rejection with
`console.error`. Both moderation pages read the audit rows, then read `users` `id, name, email` by
id on the cookie client.

**Evidence.** Research C5: `admin_audit_log.admin_user_id` references `auth.users(id)` (baseline
:1705), so PostgREST cannot embed `users(...)`. The `Admins can view all profiles` policy permits the
second read. F-073: every insert is rejected today because `admin_email` does not exist. DI-25 site
`src/lib/audit.ts:38` disappears with the column.

**Alternative rejected.** Restoring `admin_email` by migration, or adding an FK to `public.users`.
Both are schema changes that stay local until Phase 8, so audit writes would stay broken in
production.

**Executed by:** 05-14 (writer and pages), 05-16 (F-007 makes the door the only writer).

## DEC-47 — The F-006/F-007 migration

**Decision.** One fix-forward migration:
- `users`: a column-scoped UPDATE grant to `authenticated` on `name, avatar_url, banner_url, pronouns,
  year, faculty, visibility, interest_tags, inferred_tags, onboarding_completed, updated_at`. The
  table-level UPDATE is revoked from `anon` and `authenticated`. INSERT on `users` is revoked from
  `anon` and `authenticated` (research open point: the only writer is the callback's elevated
  upsert).
- `update_saved_events_count()` becomes `SECURITY DEFINER SET search_path = ''`, with a
  schema-qualified body.
- The `users` own-row UPDATE policy is rewritten with `TO authenticated`.
- Both `admin_audit_log` INSERT policies are dropped, and INSERT, UPDATE and DELETE are revoked from
  `anon` and `authenticated`.

**Evidence.** Research C3, measured on the local stack: the grant alone breaks
`INSERT INTO saved_events`, because the trigger is `SECURITY INVOKER` (baseline:593-613) and writes
`saved_events_count` as the caller. `src/app/api/profile/inferred-tags/route.ts:41-43` updates
`inferred_tags` on the cookie client. Baseline :2700 grants ALL to `anon`. Research § D: a self
`roles` update succeeds today, and an anonymous forged audit row persists.

**Alternative rejected.** Adding `saved_events_count` to the grant (C3 option b). That lets users
set their own counter.

**Executed by:** 05-16.

## DEC-48 — The public profile page (F-005)

**Decision.** `src/app/users/[id]/page.tsx` reads through the door, with the select narrowed to
`id, name, avatar_url, banner_url, pronouns, year, faculty, visibility, interest_tags, created_at`
(no `email`). One shared gate serves `generateMetadata()` and the page: an anonymous viewer and
`visibility === "private"` gives `notFound()`. INTENTIONAL BEHAVIOUR CHANGE: private profiles stop
rendering for anonymous readers.

**Evidence.** Research C6: `users` has only own-row and admin SELECT policies, so the cookie client
would 404 every public profile. The page's own `isPublic = target.visibility !== "private"`
(`:143`), and the values are `public`/`private` (`src/app/api/users/[id]/route.ts:157`).

**Alternative rejected.** Moving the reads to the cookie client (CONTEXT's original wording). That
404s every profile for every non-admin viewer. A public-read policy on `users` was also rejected,
because it would expose `email`, `roles` and the ban columns at row level.

**Executed by:** 05-15, pinned beforehand by 05-12 (`public-profile-defect.test.tsx`).

## DEC-49 — Service-role containment

**Decision.** An operation that an existing policy already permits moves to the cookie client.
Every other operation goes through the door, with one REGISTRY row per operation family. The
allowlist is regenerated once, in 05-15, to exactly the two cron routes
(`src/app/api/cron/send-feedback-requests/route.ts`, `src/app/api/cron/send-reminders/route.ts`).

**Evidence.** Research § F classifies all 23 non-cron entries against `pg_policies`. The ratchet
reads `committed=25 live=25 delta=0` on the base commit (floor block 5).

**Alternative rejected.** Shrinking the allowlist in every commit that removes a callsite. The
ratchet is shrink-only and passes on any subset, so one regeneration with a recorded diff is easier
to review than eleven.

**Executed by:** 05-05 (callback), 05-10 (club owner writes), 05-14, 05-15.

## DEC-50 — The rate limiter

**Decision.**
- A `RateLimitStore` interface sits behind the limiter. `applyApiRateLimit` stays synchronous and
  byte-identical for the memory path.
- Public budgets are unchanged.
- `/api/admin/*` gets 600 GET and 120 mutation requests per IP, per path, per 60 s. Rationale: a
  `/moderation` load fans out GETs and moderators batch-approve, so 2x/4x the public budgets clears
  interactive use while bounding scripted abuse to 2 writes/s per path per IP.
- Upstash uses `fixedWindow` of 60 s with a 1000 ms timeout. A timeout allows the request and is
  logged: availability wins over limiting, because rate limiting is not an authz control.
- The client IP prefers `x-real-ip`.
- Configuration reads `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` and falls back to
  `KV_REST_API_URL`/`KV_REST_API_TOKEN`. The store is required at boot only when `VERCEL_ENV` is
  `production`.
- The Playwright webServer blanks all four names.
- The Upstash contract test is skipped, never passed, when no store is configured.

**Evidence.** `src/middlewareRateLimit.ts:85` excludes the admin prefix today (F-058's rate-limit
clause). Research C13 and A4 (the Marketplace integration injects `KV_REST_API_*`). Research A5
(Vercel overwrites `X-Forwarded-For` on non-Enterprise plans). Research Pitfalls 5 and 9. `@next/env`
never overrides a defined but empty variable (C8), so blanking the names keeps a developer's `.env`
from pointing the harness at a real store.

**Alternative rejected.** (a) Making `applyApiRateLimit` async. That changes a signature the proxy
and its PRESERVE test depend on (Pitfall 5). (b) Failing closed on an Upstash timeout. A store outage
would take down every API route.

**Executed by:** 05-17 (interface, memory store, admin budgets), 05-18 (Upstash store, boot
requirement, harness guard).

## DEC-51 — The Upstash pins go through a blocking legitimacy checkpoint

**Decision.** `@upstash/ratelimit@2.1.0` and `@upstash/redis@1.38.4` are installed only after a
**BLOCKING** package-legitimacy checkpoint in 05-18 (`gate="blocking-human"`), which is never
auto-approved. Fallback, if the human prefers a release older than 30 days: `@upstash/ratelimit`
2.0.8 with a compatible `@upstash/redis` pin.

**Evidence.** Research § Package Legitimacy Audit flags both packages (and the transitive
`@upstash/core-analytics`) as [SUS] "too-new" on their latest tags. The executor's supply-chain rule
says legitimacy checkpoints are never auto-approvable. CONTEXT's Area 3 amendment resolved this as
"a human-verify item is recorded, not blocking". That answer was taken by rule with no owner present,
and a rule cannot stand in for human verification.

**Alternative rejected.** Installing without the checkpoint, as CONTEXT's rule-resolved wording
allows. That would make the only human-verification gate in the phase a formality.

**Executed by:** 05-18.

## DEC-52 — The CSRF origin check (F-090)

**Decision.** The proxy rejects a `/api/*` request whose method is not GET, HEAD or OPTIONS when
`Sec-Fetch-Site` is `cross-site`, or when an `Origin` header is present and its host differs from
`x-forwarded-host ?? host`. The response is `403 {"error":"Cross-site request blocked"}`. Requests
carrying neither header pass (curl, cron callers, server-to-server). The two state-changing GETs are
Low residuals with no code change (DI-41).

**Evidence.** F-090 (`quality/phase-05-slice-defects.md#f-090--no-origin-check-on-state-changing-api-routes`):
no route checks either header today (grep exit 1 on the base commit), and the only barrier is the
`SameSite=Lax` default of `@supabase/ssr`'s `DEFAULT_COOKIE_OPTIONS`. Research C14 names the two GETs.
Research A3 (the Chrome Lax-by-default two-minute POST exception) is carried into the assessment; the
origin check covers that window regardless.

**Alternative rejected.** (a) CSRF tokens. They need a client change on every form and fetch, for a
risk that `SameSite=Lax` plus the origin check already bound. (b) Rejecting requests that carry
neither header. That breaks the Phase 6 machine routes.

**Executed by:** 05-17 (check and `evidence/csrf-assessment.md`), pinned beforehand by 05-12
(`e2e/specs/csrf-origin.spec.ts`).

## DEC-53 — DI-36 becomes F-086

**Decision.** `GET /api/events/[id]` attaches `pending_edits` for the creator and for admins, after
the unchanged shared transform. INTENTIONAL BEHAVIOUR CHANGE. No seeded row carries
`pending_edits`, so no seeded-visible change.

**Evidence.** F-086 (`quality/phase-05-slice-defects.md#f-086--pending-edits-never-reach-their-creator`)
and research § G. `transformEventFromDB` (`src/lib/tagMapping.ts:94`) never copies the column. The
detail PRESERVE suite (`events-detail-characterization.test.ts` layer b) pins non-owner stripping,
and it must stay green.

**Alternative rejected.** Copying `pending_edits` in the shared transform. That changes every list
route that uses the transform, which needs its own visibility decision (Phase 4 DI-36 entry).

**Executed by:** 05-14, pinned beforehand by 05-12 (`pending-edits-defect.test.ts`).

## DEC-54 — No seed change in Phase 5

**Decision.** Specs create and restore their own state through the product API. For fixtures the
API cannot create, specs use the local service-role client from `e2e/env.ts`, under the config's
`assertSeedTargetAllowed`. The seed's determinism proof and `PERSONA_KEYS`
(`scripts/seed/personas.ts:57`) are untouched.

**Evidence.** CONTEXT Area 4 permits additive seed rows but does not require them. The two expected
additions (a pending invitation for F-016, a private profile for F-005) can both be made by the spec
that needs them: DEC-43 mints its invitation through the API, and a private profile is one
`visibility` update. Every Phase 4 PRESERVE pin reads the seed, and `040-seed-coverage.test.sql`
counts it.

**Alternative rejected.** Adding seed rows. That re-opens the determinism proof and the seed-coverage
counts for fixtures one spec each can make and undo.

**Executed by:** 05-08, 05-09, 05-11, 05-12, 05-14, 05-15 (every plan adding a spec).

## DEC-55 — Contract regeneration

**Decision.** `endpoints.json` `expected_status` changes only through
`.planning/audit/tools/classify-inventory.mjs`, with `classification-rules.md` updated in the same
commit. Slice 3 regenerates for rule R4 (mid-onboarding on write-only rows) and the four F-028
verdicts. Slice 5 regenerates for the admin-mechanism text and the calculate-popularity verdict. The
`api.auth-debug` row stays after the route is deleted, because `versions.txt` `route_ts_count=94` is
the audit-time baseline.

**Evidence.** Phase-locked constraint 10. Research § E: only `calculate-popularity` must change among
the admin rows (`classify-inventory.mjs` `EXPECTED_OVERRIDES`).
`.planning/audit/baseline/versions.txt:12` reads `route_ts_count=94`.

**Alternative rejected.** Editing `endpoints.json` by hand, or dropping the auth-debug row. The first
breaks the generator's idempotence proof. The second makes the inventory disagree with its own
baseline count.

**Executed by:** 05-08 (slice 3), 05-14 (slice 5).

## DEC-56 — DI-25: the supabase-js minor, last

**Decision.** `@supabase/supabase-js` moves to exactly `2.116.0` as the last code change of the
phase, after a throwaway-worktree `tsc` proof. `@supabase/ssr` stays on 0.7 (DI-43).

**Evidence.** Research § H lists the eight blocking sites and the slice that clears each. DEC-28's
verification method applies. `@supabase/ssr@0.7.0`'s peer range `^2.43.4` admits 2.116.0. CONTEXT
Area 1 bullet six keeps the `ssr` major out of this phase.

**Alternative rejected.** Bumping first and fixing the type errors inside each slice. That mixes a
dependency move into behaviour-preserving refactors, so a regression could not be attributed.

**Executed by:** 05-19.

## DEC-57 — The findings register

**Decision.** F-086..F-091 are registered and the C16 re-pointing map is applied (05-01 Task 2).
Migration-dependent closures (F-006, F-007, F-008, F-016) stay `Open`, with a local-proof resolution
and `closes_in_phase: "08"`, because production closes only with the DI-23 repair. Code-only
closures become `Fixed`.

**Evidence.** `evidence/findings-registration.txt` (the before list, the map, `validate.mjs --check findings`
at 91 findings, the numstat). CONTEXT Area 3 bullet six: F-006 and F-007 "stay open in production
until the Phase 8 migration repair".

**Alternative rejected.** Marking migration-dependent findings `Fixed` on local proof. The register
would then claim a production state that was never measured, and the Critical gate in
`SEVERITY_SLA.md` would read green while production is still exposed.

**Executed by:** 05-01 (registration and re-pointing), each fixing plan (resolution text), 05-19
(final states).

## DEC-58 — A banned admin is refused at the handler (DI-48)

*Appended by 05-13, which executes it. Not one of the 05-01 defaults: it is a rule-resolved
decision taken during execution, under DI-48's owner note.*

**Decision.** Every admin arm composes `requireActiveUser(ctx)` ahead of `requireRole(ctx, "admin")`,
as its first statements after `createRequestContext()`. The deny bytes, in order: anonymous
`401 {"error":"Unauthorized"}`; no profile row `403 {"error":"Profile not found"}`; banned
`403 {"error":"Account suspended"}`; not an admin `403 {"error":"Forbidden"}`. `requireRole` itself is
unchanged: it stays a pure role check, and the ban is read by the one guard that already reads it.
INTENTIONAL BEHAVIOUR CHANGE: a banned admin is refused by the handler, not only by the proxy; a
signed-in caller with no profile row gets `Profile not found` instead of `Forbidden` at the handler.
On the real stack the proxy already answers both callers on `/api/*` with the same bytes (F-062,
05-05 row d-api), so the change is where the refusal is decided, not what a browser sees.

**Evidence.** DI-48 (`deferred-items.md`, registered by 05-08): REFAC-11's clause "middleware is
advisory-only" is unmet only on the admin arms, because the helper and `requireRole` read `roles`
alone. 05-12 pinned it at all 35 arms (`admin-guard-defect.test.ts` D4) through `BAN_GUARDED_ARMS`.
DEC-34 already puts `requireActiveUser` in front of every non-admin write arm; this extends the same
guard, not a new one, to the admin surface. 05-13 touches all 33 helper arms anyway, so composing it
there avoids a second pass over 25 files.

**Alternative rejected.** (a) Making `requireRole` read the ban columns. That gives the role guard a
second responsibility and changes it for every future caller, including page layouts that redirect
rather than answer JSON. (b) Leaving the admin ban to the proxy. That keeps REFAC-11 PARTIAL and the
proxy load-bearing for authz, which CONTEXT Area 1 rules out.

**Executed by:** 05-13 (the 33 helper arms). 05-14 applies it to the two calculate-popularity arms
when they adopt `requireRole` (their D4 rows move through `BAN_GUARDED_ARMS` then). 05-19 flips
REFAC-11 once `BAN_GUARDED_ARMS` holds all 35.
