---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
reviewed: 2026-09-27T18:46:59Z
depth: standard
files_reviewed: 191
files_reviewed_list:
  - .github/workflows/ci.yml
  - docs/health.md
  - docs/observability.md
  - e2e/helpers/sharedCacheProxy.ts
  - e2e/specs/admin-page-gates.spec.ts
  - e2e/specs/async-edge.spec.ts
  - e2e/specs/cache-headers.spec.ts
  - e2e/specs/cross-user-cache.spec.ts
  - e2e/specs/csp.spec.ts
  - e2e/specs/health.spec.ts
  - scripts/check-contracts.mjs
  - scripts/check-elevated-ratchet.mjs
  - scripts/check-server-console.mjs
  - scripts/contracts-allowlist.json
  - scripts/server-console-allowlist.json
  - src/__tests__/api/admin/admin-arm-tree-defect.test.ts
  - src/__tests__/api/admin/admin-guard-characterization.test.ts
  - src/__tests__/api/admin/admin-reports-defect.test.ts
  - src/__tests__/api/auth-ring/write-arm-tree-defect.test.ts
  - src/__tests__/api/auth-ring/write-handlers-characterization.test.ts
  - src/__tests__/api/cache-headers-census.test.ts
  - src/__tests__/api/cache-headers-defect.test.ts
  - src/__tests__/api/error-text-defect.test.ts
  - src/__tests__/api/events/saved-events-time-floor-defect.test.ts
  - src/__tests__/api/health/health-defect.test.ts
  - src/__tests__/api/health/health.test.ts
  - src/__tests__/api/interactions/interactions-feedback-characterization.test.ts
  - src/__tests__/api/notifications/notifications-characterization.test.ts
  - src/__tests__/api/notifications/notifications-count-defect.test.ts
  - src/__tests__/api/recommendations/batch-error-text-defect.test.ts
  - src/__tests__/api/recommendations/experiment-assignment-defect.test.ts
  - src/__tests__/api/recommendations/recommendationFixtures.ts
  - src/__tests__/api/recommendations/recommendations-characterization.test.ts
  - src/__tests__/api/recommendations/recommendations-family-characterization.test.ts
  - src/__tests__/api/review05/admin-event-notification.test.ts
  - src/__tests__/api/review05/club-links-defect.test.ts
  - src/__tests__/api/review05/club-links.test.ts
  - src/__tests__/api/review05/club-transfer.test.ts
  - src/__tests__/api/review05/fanout-after.test.ts
  - src/__tests__/api/service-role-routing.test.ts
  - src/__tests__/api/slice6-malformed-input-defect.test.ts
  - src/__tests__/api/uncaught-throw-defect.test.ts
  - src/__tests__/config/csp-defect.test.ts
  - src/__tests__/config/vercel-json-defect.test.ts
  - src/__tests__/contracts/bad-request-characterization.test.ts
  - src/__tests__/contracts/badRequestTable.ts
  - src/__tests__/contracts/malformed-input-defect.test.ts
  - src/__tests__/moderation/audit-shape.test.ts
  - src/__tests__/pages/docs-gate-defect.test.ts
  - src/__tests__/scripts/check-contracts.test.ts
  - src/__tests__/scripts/check-server-console.test.ts
  - src/__tests__/webhook/content-hash-parity.test.ts
  - src/__tests__/webhook/verify-signature.test.ts
  - src/__tests__/webhook/webhook-contract.test.ts
  - src/__tests__/webhook/webhook-handler.test.ts
  - src/app/admin/layout.tsx
  - src/app/api/admin/audit-log/route.ts
  - src/app/api/admin/calculate-popularity/route.ts
  - src/app/api/admin/clubs/[id]/route.ts
  - src/app/api/admin/clubs/route.ts
  - src/app/api/admin/events/[id]/edits/route.ts
  - src/app/api/admin/events/[id]/route.ts
  - src/app/api/admin/events/[id]/status/route.ts
  - src/app/api/admin/events/route.ts
  - src/app/api/admin/experiments/[id]/route.ts
  - src/app/api/admin/experiments/route.ts
  - src/app/api/admin/featured/[id]/route.ts
  - src/app/api/admin/featured/route.ts
  - src/app/api/admin/organizer-requests/[id]/route.ts
  - src/app/api/admin/organizer-requests/route.ts
  - src/app/api/admin/organizers/route.ts
  - src/app/api/admin/reports/[id]/route.ts
  - src/app/api/admin/reports/route.ts
  - src/app/api/admin/users/[id]/ban/route.ts
  - src/app/api/admin/users/[id]/route.ts
  - src/app/api/calendar/events/route.ts
  - src/app/api/clubs/[id]/appeal/route.ts
  - src/app/api/clubs/[id]/invites/route.ts
  - src/app/api/clubs/[id]/members/role/route.ts
  - src/app/api/clubs/[id]/members/route.ts
  - src/app/api/clubs/[id]/route.ts
  - src/app/api/clubs/[id]/transfer/route.ts
  - src/app/api/clubs/banner/route.ts
  - src/app/api/clubs/logo/route.ts
  - src/app/api/clubs/route.ts
  - src/app/api/clubs/trending/route.ts
  - src/app/api/events/[id]/appeal/route.ts
  - src/app/api/events/[id]/invite/route.ts
  - src/app/api/events/[id]/report/route.ts
  - src/app/api/events/[id]/reviews/route.ts
  - src/app/api/events/[id]/route.ts
  - src/app/api/events/[id]/rsvp/route.ts
  - src/app/api/events/create/route.ts
  - src/app/api/events/export/route.ts
  - src/app/api/events/popular/route.ts
  - src/app/api/events/route.ts
  - src/app/api/events/upload-image/route.ts
  - src/app/api/feedback/route.ts
  - src/app/api/health/route.ts
  - src/app/api/interactions/route.ts
  - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
  - src/app/api/my-clubs/route.ts
  - src/app/api/notifications/count/route.ts
  - src/app/api/notifications/route.ts
  - src/app/api/organizer-requests/route.ts
  - src/app/api/profile/avatar/route.ts
  - src/app/api/profile/banner/route.ts
  - src/app/api/profile/inferred-tags/route.ts
  - src/app/api/profile/interests/route.ts
  - src/app/api/recommendations/analytics/route.ts
  - src/app/api/recommendations/feedback/route.ts
  - src/app/api/recommendations/route.ts
  - src/app/api/users/[id]/route.ts
  - src/app/api/users/saved-events/route.ts
  - src/app/api/users/search/route.ts
  - src/app/docs/layout.tsx
  - src/app/health/layout.tsx
  - src/app/health/page.tsx
  - src/app/moderation/layout.tsx
  - src/components/layout/SideNavBar.tsx
  - src/contracts/__tests__/admin.test.ts
  - src/contracts/__tests__/clubs.test.ts
  - src/contracts/__tests__/events.test.ts
  - src/contracts/__tests__/slice-6-contracts.test.ts
  - src/contracts/__tests__/users.test.ts
  - src/contracts/admin.ts
  - src/contracts/clubs.ts
  - src/contracts/common.ts
  - src/contracts/events.ts
  - src/contracts/feedback.ts
  - src/contracts/health.ts
  - src/contracts/interactions.ts
  - src/contracts/notifications.ts
  - src/contracts/recommendations.ts
  - src/contracts/users.ts
  - src/contracts/webhook.ts
  - src/hooks/contract-dev-check.test.ts
  - src/hooks/useAnalytics.ts
  - src/hooks/useAvatarUpload.ts
  - src/hooks/useClubs.ts
  - src/hooks/useEvents.ts
  - src/hooks/useFeaturedClubs.ts
  - src/hooks/useFeaturedEvents.ts
  - src/hooks/useNotificationCount.ts
  - src/hooks/useTracking.ts
  - src/instrumentation-client.ts
  - src/instrumentation.test.ts
  - src/instrumentation.ts
  - src/lib/audit.ts
  - src/lib/classifier.ts
  - src/lib/contractCheck.ts
  - src/lib/env.test.ts
  - src/lib/env.ts
  - src/lib/observability/scrub.test.ts
  - src/lib/observability/scrub.ts
  - src/lib/supabase/types.ts
  - src/proxy-defect.test.ts
  - src/proxy-request-id.test.ts
  - src/proxy.ts
  - src/sentry.server.config.ts
  - src/server/__tests__/body.test.ts
  - src/server/__tests__/context.test.ts
  - src/server/__tests__/getsession-gate.test.ts
  - src/server/__tests__/http.test.ts
  - src/server/__tests__/log.test.ts
  - src/server/__tests__/requireAdminPage.test.ts
  - src/server/__tests__/route.test.ts
  - src/server/__tests__/sentry.test.ts
  - src/server/afterResponse.ts
  - src/server/authz/requireAdminPage.ts
  - src/server/body.ts
  - src/server/context.ts
  - src/server/db/elevated/REGISTRY.md
  - src/server/http.ts
  - src/server/log.ts
  - src/server/observability/sentry.ts
  - src/server/ratelimit/index.ts
  - src/server/ratelimit/selection.test.ts
  - src/server/ratelimit/upstashStore.test.ts
  - src/server/ratelimit/upstashStore.ts
  - src/server/route.ts
  - supabase/functions/_shared/contentHash.ts
  - supabase/functions/_shared/webhook-contract.ts
  - supabase/functions/_shared/webhook-handler.ts
  - supabase/functions/_shared/webhook-signature.ts
  - supabase/functions/events-webhook/deno.json
  - supabase/functions/events-webhook/index.ts
  - supabase/functions/tests/webhook.test.ts
  - supabase/migrations/20260926120000_async_edge_definer_hardening.sql
  - supabase/tests/database/031-cron-jobs.test.sql
  - supabase/tests/database/070-definer-functions.test.sql
findings:
  critical: 0
  warning: 7
  info: 9
  total: 16
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-27T18:46:59Z
**Depth:** standard
**Files Reviewed:** 191 (the 122 non-test files were read in full; the test files were used to understand what the code is meant to do)
**Status:** issues_found

## Summary

The seam holds up well. All 91 route files use `withRoute` and declare a cache class. `applyCachePolicy` only makes GET/HEAD 200/404 responses shareable, so every 401, 403 and 500 is `private, no-store`. Every public-class handler reads viewer-independent data: the RLS on `clubs`, `club_followers` and `event_popularity_scores` is `USING (true)`, and the events reads filter on `status = 'approved'`.

The following security controls were verified and have not regressed:
- `HEALTH_TOKEN` is compared with SHA-256 digests and `timingSafeEqual`, and access is refused when the token is unset or shorter than 32 characters.
- The webhook HMAC is checked for length before `timingSafeEqual`.
- No service-role import exists outside `src/server/db/elevated/`. The ratchet census is empty and the allow-list is `[]`.
- The migration revokes the three definer writers from PUBLIC, anon and authenticated, and pins their `search_path`.
- `cron_job_status()` can only be executed by `service_role`.
- The clubs PATCH whitelist strips unknown keys before the elevated write.

The main concerns:
1. The new `/docs` admin gate lives only in a layout, and a layout-only check can be bypassed.
2. Most handled failures never reach Sentry, and many never reach the logs.
3. Three public-cached routes answer a database failure with a cacheable empty 200.
4. The Sentry scrubber keeps the `Referer` header, so query strings still reach Sentry.
5. `GET /api/recommendations` selects a column that does not exist and accepts an unbounded `top_k`.
6. Callers choose which A/B variant their feedback is credited to. Experiment assignment now works for every user (F-017), so this corrupts real results.

I found no Critical-tier defect. The deferred items listed in the brief (DI-82, DI-83, DI-87, DI-88, the `rsvp_link`/`price`/avatar-URL validation, IP in rate-limit keys, cached request ids, `'unsafe-inline'`) were seen and are not reported again.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The `/docs` admin gate runs only in the layout; the page renders the spec with no check of its own

**File:** `src/app/docs/layout.tsx:14`, `src/app/docs/page.tsx:4-5`
**Issue:** `DocsLayout` calls `requireAdminPage("/")`. `IndexPage` is an async Server Component that calls `getApiDocs()` and renders the full OpenAPI spec, with no authorization check of its own.

The Next 16 guide shipped in this repo warns against exactly this. `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1352-1356` says: "be cautious when doing checks in Layouts as these don't re-render on navigation… A layout also does not control whether the rest of the route renders… do the checks close to your data source".

How the bypass works: an RSC request (`RSC: 1` plus a crafted `Next-Router-State-Tree` claiming the client already holds the `docs` layout segment, e.g. navigating `/docs?a=1` → `/docs?a=2`) asks the server to render only the `__PAGE__` segment, so the layout's redirect never runs. `/docs` is not in the proxy's `PROTECTED_ROUTES` (`src/proxy.ts:256`), so an anonymous caller can reach it. This is the F-054 gate this phase added.

The same pattern exists in `src/app/moderation/page.tsx`, a server page that reads through the cookie client. The damage there is limited because RLS still scopes those reads. `/admin/*` and `/health` pages are client components whose data comes from guarded APIs, so they are not affected.
**Fix:** Run the gate in the page too. `getRequestContext` is memoized per render pass, so this costs nothing extra.
```tsx
// src/app/docs/page.tsx
import { requireAdminPage } from "@/server/authz/requireAdminPage";
export default async function IndexPage() {
  await requireAdminPage("/");
  const spec = await getApiDocs();
  ...
}
```
Do the same in `src/app/moderation/page.tsx`. Add a `docs-gate` test that calls the page function directly without its layout.

### WR-02: Most handled failures never reach Sentry, and many 500 paths log nothing

**File:** `src/server/route.ts:107-113` (the only capture point); examples: `src/app/api/admin/featured/route.ts:39-44,101-106`, `src/app/api/admin/featured/[id]/route.ts:61-66,106-111`, `src/app/api/clubs/[id]/route.ts:47-52,115-128`, `src/app/api/clubs/[id]/invites/route.ts:46-59,144-157`, `src/app/api/admin/audit-log/route.ts:37-39`, `src/app/api/admin/events/[id]/route.ts:51-56`, `src/app/api/notifications/count/route.ts:22-31`
**Issue:** `captureServerError` is called only when a handler throws out of `withRoute`, or from the proxy ring. 62 of the 91 wrapped route files wrap their body in their own `try { … } catch { return 500 }`, so their exceptions never reach the wrapper and never reach Sentry. Many of those catches are bare `catch {}` with no `log.error` either, for example the featured, clubs, club members, invites, users/search, my-clubs and reviews routes.

Separately, many `if (error) return 500` branches after a Supabase call log nothing, for example `admin/audit-log`, `admin/events/[id]` PUT/DELETE, `admin/experiments/*` and `admin/users/[id]/ban`. The phase intent says "the error is logged". As written, a database outage on these paths produces a 500 with no log line and no Sentry event, which defeats the request-id correlation the phase built.
**Fix:**
1. Add a helper in `src/server/`, e.g. `failed(action, error)`, that runs `log.error(...)`, then `captureServerError(error, { requestId: currentRequestId(), route })`, then returns `serverError(action)`.
2. Replace the bare `catch {}` and unlogged `if (error)` 500 branches with that helper.
3. Add an S3 rule to `scripts/check-server-console.mjs` that flags `status: 500` in a route file with no `log.`/`failed(` call nearby, so the gap cannot grow back.

### WR-03: Three public-cached routes answer a database error as a cacheable empty 200

**File:** `src/app/api/clubs/trending/route.ts:22-24`, `src/app/api/clubs/new/route.ts:20-22`, `src/app/api/events/new/route.ts:24-26`
**Issue:** All three declare `public-60-300`, and all three answer a failed Supabase read with `NextResponse.json({ clubs: [] })` or `{ events: [] }` at status 200, with no log. Because the status is 200, `applyCachePolicy` makes it `public, s-maxage=60, stale-while-revalidate=300`. One transient database failure is then served from the CDN to every visitor as "no clubs" or "no events" for up to six minutes.

This works against the rule `http.ts` was written to guarantee, that a failure is never shared (lines 69-80). The sibling public routes (`clubs/featured`, `events/featured`, `happening-now`, `popular`) correctly answer 500.
**Fix:**
```ts
if (clubsError) {
  log.error("Failed to fetch trending clubs", { error: clubsError });
  return NextResponse.json({ error: "Failed to fetch trending clubs" }, { status: 500 });
}
if (!clubs || clubs.length === 0) return NextResponse.json({ clubs: [] });
```
Apply the same change to `clubs/new` and `events/new`. If the empty-200 bytes must be kept for compatibility, return them with `Cache-Control: private, no-store` on the error arm.

### WR-04: The Sentry scrubber keeps the `Referer` header, so query strings still reach Sentry

**File:** `src/lib/observability/scrub.ts:41-55, 96-107`
**Issue:** The scrubber's stated contract (lines 12-27, and `docs/observability.md`) is that query strings are removed from events. It cuts them from `request.url`, `contexts.nextjs.request_path` and breadcrumbs. But `DROPPED_HEADERS` does not include `referer`, and nothing strips a query from header values.

On the server, `@sentry/nextjs`'s RequestData integration and `captureRequestError` attach the request headers. The browser SDK's HttpContext integration attaches `Referer` from `document.referrer`. So the previous page's full URL, query included, is sent. Examples: `/?signin=required&next=…`, search terms from `/?search=…`, and the auth callback's `/?error=auth_failed&message=<provider text>`.

No test covers this: `grep -i referer` over `scrub.ts`, `scrub.test.ts`, `sentry.test.ts` and `docs/observability.md` finds nothing.
**Fix:** In `scrubRequest`, run `withoutQuery` over the `referer`/`referrer` header values (case-insensitive). Add a `scrub.test.ts` case for both the server shape (`headers.referer`) and the browser shape (`headers.Referer`).

### WR-05: `GET /api/recommendations` selects the nonexistent column `users.full_name`, so the profile read always fails silently

**File:** `src/app/api/recommendations/route.ts:81-97`
**Issue:** The query is `.select("interest_tags, inferred_tags, full_name")`. `users` has no `full_name` column: the generated `Row` type has `name`, and the column appears nowhere in `supabase/migrations/`. PostgREST therefore answers 42703. The code ignores the error, so `userProfileData` is `null` for every personalized request.

As a result, `allUserTags` and `expandedTags` are always empty and `matchingTags` is always `[]`. Every personalized explanation loses its tag-affinity wording, and the tag-hierarchy expansion described in CLAUDE.md never runs on this path. The characterization suites mock the client and do not catch this.
**Fix:**
```ts
const { data: userProfileData, error: profileError } = await supabase
  .from("users")
  .select("interest_tags, inferred_tags")
  .eq("id", user.id)
  .single();
if (profileError) log.warn("profile read failed", { code: profileError.code });
```
Also remove `full_name` from `UserProfileRow`. A narrow typed select (dropping the `as` cast) would have caught this at compile time.

### WR-06: `top_k` on the anonymous-reachable recommendations route has no upper bound

**File:** `src/contracts/recommendations.ts:60-64`; `src/app/api/recommendations/route.ts:43, 61, 105, 133, 275`
**Issue:** `RecommendationsQuery.top_k` is `parseInt(value || "10")` with no cap and no lower bound, and `readQuery`/`parseQuery` never refuse it.
- An anonymous caller can send `?top_k=1000000`, which pulls every approved future event with `clubs(*)` into one response. That path is covered only by the 300/min GET budget.
- A signed-in caller gets `.limit(topK * 3)` rows of `user_event_scores` with embedded `events(*, clubs(*))`, which then go through `rerankWithMMR`. Its pairwise work grows quadratically with the input size, so a handful of requests can pin a function instance.
- A negative value or `NaN` produces an invalid PostgREST `limit`. The error is ignored and the caller gets an empty list.

Every other list contract in this phase caps its limit: events at 100, popular at 50, organizer requests at 100.
**Fix:** In the contract, clamp the value, e.g. `.transform((v) => { const n = parseInt(v || "10", 10); return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 10; })`. This keeps today's "never a 400" behaviour and bounds the work.

### WR-07: A/B results trust the variant id the client sends with feedback

**File:** `src/app/api/recommendations/feedback/route.ts:124-137`; `src/contracts/recommendations.ts:131-132`
**Issue:** The analytics arm writes `experiment_variant_id: body.experiment_variant_id ?? null` from the request body. The contract passes it through as `z.unknown()`. `GET /api/admin/experiments/[id]/results` aggregates `recommendation_feedback` by that column (`results/route.ts:63-87`), and the foreign key only checks that the variant exists.

Before this phase no non-admin was ever assigned a variant (F-017), so this was harmless. Plan 06-04 made assignment work for every user. Now any authenticated user can post `click`/`save` rows credited to any variant and change which arm "wins". The server already knows the caller's true assignment in `experiment_assignments`.
**Fix:** Ignore the body value. Before the insert, resolve the caller's assignment on the server (elevated read of `experiment_assignments` by `user_id` for the running experiment) and use it, or `null` when there is none. At minimum, confirm that the supplied id matches the caller's assignment row and refuse it otherwise.

## Info

### IN-01: `withRoute` catches Next's control-flow errors

**File:** `src/server/route.ts:107-113`
**Issue:** The wrapper catches everything. A future `redirect()`, `notFound()` or `forbidden()` from `next/navigation` inside a wrapped handler would become a JSON 500 and a Sentry event instead of the intended response. No wrapped route uses them today (verified with grep).
**Fix:** Call `unstable_rethrow(error)` (from `next/navigation`) as the first statement in the catch.

### IN-02: A client-sent `x-request-id` is trusted on paths the proxy skips

**File:** `src/server/route.ts:12-16, 64-67`; `src/proxy.ts:306`
**Issue:** The docblock says requests on paths the matcher skips (including `auth/callback`) "arrive with no id and get a fresh one". In fact `requestIdFrom` accepts any UUID-shaped `x-request-id` the client sends. On `/auth/callback` that means an attacker can choose the id written to the logs and the Sentry `request_id` tag, which lets them forge or collide correlation ids.
**Fix:** Make the proxy prove the id's origin, e.g. by also setting a private `x-uv-request-id-origin: proxy` header or an HMAC. Otherwise, mint a fresh id when the path is one the matcher excludes. At minimum, correct the comment.

### IN-03: The Sentry `route` tag and `request.url` carry raw path ids, including user ids

**File:** `src/server/observability/sentry.ts:59-64`; `src/server/route.ts:103`; `src/proxy.ts:286-289`
**Issue:** `route` is the concrete pathname, for example `/api/users/<uuid>` or `/api/admin/users/<uuid>/ban`. `scrubEvent` hashes `event.user.id` so the raw user id is not sent, but the same id then goes out in plain text in the tag and in `request.url` for every per-user route. It also gives the `route` tag unbounded cardinality.
**Fix:** Tag the route pattern instead, e.g. by replacing UUID-shaped segments with `[id]`, and apply the same replacement to `request.url` in `scrubRequest`.

### IN-04: The contracts census misses raw body reads other than `.json()` and `.formData()`

**File:** `scripts/check-contracts.mjs:120-157`
**Issue:** R1 matches only `request.json()` and `req.json()`. Reads such as `JSON.parse(await request.text())`, `request.arrayBuffer()`, `request.body` or a request variable with another name (`r.json()`) get past the gate the phase relies on to keep every input behind a contract.
**Fix:** Widen R1 to `/\b\w+\.(json|text|arrayBuffer|blob)\(\)/` on objects typed or named as requests in route files, or simply flag `.text()` and `.arrayBuffer()` in `src/app/**/route.ts`.

### IN-05: The webhook echoes database error text and swallows its own failures without a trace

**File:** `supabase/functions/_shared/webhook-handler.ts:286-290, 328-330`
**Issue:** For a non-23505 insert error, the per-event `error` field is set to `insertError.message`, so raw Postgres text (column and constraint names) goes back to the sender. This is the only surface in the phase that still returns database text. The S2 census does not scan `supabase/functions/`. The outer `catch {}` returns 500 with no log, so the three preserved 500 rows (DI-83) and any real fault leave nothing in the function logs.
**Fix:** Report non-duplicate insert failures as `"insert_failed"` and log the full error. In the outer catch, log the error class before answering 500.

### IN-06: `/api/notifications/count` answers 200 `{unread_count: 0}` when the count read fails

**File:** `src/app/api/notifications/count/route.ts:22-31`
**Issue:** The count query's `error` is never read, and the catch answers a 200 with 0. A database fault looks like "no unread notifications", with no log and no Sentry event.
**Fix:** Check `error`, log it, and either return `serverError("fetch notification count")` or keep the 200 but log.

### IN-07: `GET /api/admin/audit-log?page=abc` (or `page=0`) answers an unlogged 500

**File:** `src/contracts/admin.ts:578-584`; `src/app/api/admin/audit-log/route.ts:22-39`
**Issue:** `page` is `parseInt(value || "1")` with no guard. `NaN` or a value of 0 or less produces `range(NaN, NaN)` or a negative offset, PostgREST refuses it, and the route answers 500 "Internal server error" without logging. Every other paged admin contract falls back to its default.
**Fix:** `.transform((v) => { const n = parseInt(v || "1", 10); return Number.isInteger(n) && n >= 1 ? n : 1; })`.

### IN-08: Anonymous interaction writes store arbitrary JSON unchecked

**File:** `src/contracts/interactions.ts:63-64`; `src/app/api/interactions/route.ts:105-118`
**Issue:** `session_id` and `metadata` are `z.unknown()` and are inserted as given. `interactions` is open to anonymous callers under the high-frequency budget (300/min per IP), so any caller can write large nested `metadata` blobs into `user_interactions`, and a non-string `session_id` turns into a 500.
**Fix:** Bound the shapes: `session_id: z.string().max(64).optional()`, and `metadata: z.record(z.string(), z.union([z.string().max(256), z.number(), z.boolean()])).optional()` with a key-count limit.

### IN-09: The Upstash store logs `err.message`, contrary to the rate limiter's own policy

**File:** `src/server/ratelimit/upstashStore.ts:77-81` vs `src/server/ratelimit/index.ts:36-42`
**Issue:** Store selection deliberately logs only the error's class, because `@upstash/redis` messages can echo the endpoint URL. `consume` logs `err.message` verbatim. With a valid https REST URL no secret is exposed, but the module does not follow its own documented rule.
**Fix:** Log `error: err instanceof Error ? err.name : typeof err`, matching `index.ts`.

---

_Reviewed: 2026-09-27T18:46:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
