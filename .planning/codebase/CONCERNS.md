# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Hand-written Supabase types instead of auto-generated:**
- Issue: Database types in `src/lib/supabase/types.ts` are manually maintained. The file itself contains a TODO to generate them via CLI. Many API routes cast `supabase as any` to bypass type mismatches, indicating the types have drifted from the actual schema.
- Files: `src/lib/supabase/types.ts`, `src/app/auth/callback/route.ts` (lines 149, 165, 178), `src/app/api/feedback/route.ts` (line 30), `src/app/api/profile/avatar/route.ts` (lines 61, 78, 91), `src/app/api/clubs/logo/route.ts` (lines 54, 69), `src/app/api/users/[id]/route.ts` (line 106), `src/app/api/users/saved-events/route.ts` (lines 64, 92, 108), `src/app/api/profile/interests/route.ts` (line 54)
- Impact: `as any` casts silence type errors, meaning schema changes break at runtime not compile time. At least 18 occurrences of `(supabase as any)` in production code (not tests).
- Fix approach: Run `npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` and remove all `as any` casts. Add this to CI as a pre-build step.

**Pervasive `error: any` in catch blocks:**
- Issue: The health route and other files use `catch (error: any)` instead of narrowing error types.
- Files: `src/app/api/health/route.ts` (lines 139, 177, 243, 319, 375), `src/app/api/events/popular/route.ts` (line 158)
- Impact: Bypasses TypeScript strict mode guarantees. Accessing `error.message` on a non-Error value will return undefined silently.
- Fix approach: Use `catch (error: unknown)` and narrow with `error instanceof Error ? error.message : String(error)`.

**Unsanitized search input in ilike queries:**
- Issue: `src/app/api/events/route.ts` line 197 interpolates user `search` input directly into an `ilike` filter string without escaping Supabase/PostgREST special characters (`%`, `_`). The export route sanitizes this (line 175) but the main events route does not.
- Files: `src/app/api/events/route.ts` (line 197), `src/app/api/admin/events/route.ts` (line 28)
- Impact: Users can craft search queries with `%` or `_` wildcards to perform broader-than-intended searches. Not a SQL injection risk (Supabase parameterizes), but a logic bug.
- Fix approach: Strip or escape `%` and `_` characters from search input before interpolation, matching the pattern in `src/app/api/events/export/route.ts` line 175.

**Hardcoded fallback values in recommendation payload:**
- Issue: The recommendations GET handler always sends `major: "General Studies"` and `year_of_study: "Student"` because user profile data for these fields is never fetched or stored.
- Files: `src/app/api/recommendations/route.ts` (lines 238-243)
- Impact: The recommendation AI service receives no real user demographic data, reducing personalization quality.
- Fix approach: Add `major` and `year_of_study` fields to the user profile schema and onboarding flow, then read them here.

**179 console.log/error/warn calls across 62 files with no structured logging:**
- Issue: All logging is done via bare `console.error()` and `console.warn()`. No log levels, no structured output, no correlation IDs.
- Files: Across all `src/app/api/` routes and many component files
- Impact: In production, logs lack context for debugging. Cannot filter by severity or trace requests across middleware and route handlers.
- Fix approach: Introduce a lightweight logger utility (e.g., pino or a custom wrapper) that outputs structured JSON with request IDs.

## Known Bugs

**`getSession()` used for auth checks instead of `getUser()`:**
- Symptoms: Two API routes use `supabase.auth.getSession()` for authentication. Supabase documentation warns that `getSession()` reads from local storage/cookies without server-side verification, making it spoofable.
- Files: `src/app/api/recommendations/analytics/route.ts` (line 19), `src/app/api/health/route.ts` (line 160)
- Trigger: A user could craft session cookies to pass the `getSession()` check without a valid token.
- Workaround: The analytics route has RLS as a secondary guard. The health route uses it only to check if auth service is operational (not for access control), so the risk is lower there.

## Security Considerations

**Admin analytics endpoint lacks authorization:**
- Risk: `GET /api/recommendations/analytics` requires only any authenticated session. The TODO on line 25 notes admin restriction should be added but is not implemented.
- Files: `src/app/api/recommendations/analytics/route.ts` (lines 14-28)
- Current mitigation: RLS limits returned data to the requesting user's own feedback rows.
- Recommendations: Implement the `isAdmin()` check as noted in the TODO. Use the same `verifyAdmin()` pattern from `src/lib/admin.ts` used by other admin routes.

**Admin calculate-popularity endpoint falls open without ADMIN_API_KEY:**
- Risk: If `ADMIN_API_KEY` env var is not set, the endpoint accepts any request (line 61: `if (expectedKey && ...)`). This is intended for dev but dangerous if the env var is accidentally omitted in production.
- Files: `src/app/api/admin/calculate-popularity/route.ts` (lines 57-66)
- Current mitigation: The endpoint only recalculates scores, not destructive. But it uses a service role client with full DB access.
- Recommendations: Fail closed: if `ADMIN_API_KEY` is not set, return 503 instead of allowing unauthenticated access.

**Non-null assertions on environment variables:**
- Risk: Multiple Supabase client files use `process.env.NEXT_PUBLIC_SUPABASE_URL!` with TypeScript non-null assertion. If the env var is missing, this creates a client with `undefined` as the URL, causing cryptic runtime errors.
- Files: `src/lib/supabase/client.ts` (line 11), `src/lib/supabase/server.ts` (line 14), `src/lib/supabase/service.ts` (line 11), `src/app/auth/callback/route.ts` (lines 59, 117)
- Current mitigation: The middleware checks for these vars and passes through if missing (line 14 of `src/middleware.ts`). The health endpoint also validates them.
- Recommendations: Add runtime validation at the Supabase client creation points, or use a validated config module that throws at startup.

**Rate limiting is in-memory only:**
- Risk: The rate limiter in `src/middlewareRateLimit.ts` uses an in-memory `Map` on `globalThis`. In a multi-instance deployment (Vercel serverless), each instance has its own store, so limits are not shared.
- Files: `src/middlewareRateLimit.ts` (lines 1-18)
- Current mitigation: Comment on line 6 acknowledges this and suggests Vercel KV / Upstash Redis.
- Recommendations: For production with multiple instances, replace with a distributed rate limiter. For a single-instance Vercel deployment, current approach is adequate.

**Admin endpoints excluded from rate limiting:**
- Risk: All `/api/admin/*` paths bypass the rate limiter entirely (line 76 of `src/middlewareRateLimit.ts`). If admin auth is bypassed, there is no secondary defense.
- Files: `src/middlewareRateLimit.ts` (line 76)
- Current mitigation: Admin routes use `verifyAdmin()` from `src/lib/admin.ts`.
- Recommendations: Apply rate limiting to admin routes as well, with a more generous limit.

## Performance Bottlenecks

**RSVP counts fetched by loading all rows and filtering in JS:**
- Problem: The RSVP GET endpoint fetches all non-cancelled RSVP rows for an event, then counts "going" and "interested" in JavaScript using `.filter().length`.
- Files: `src/app/api/events/[id]/rsvp/route.ts` (lines 91-103)
- Cause: Using `select("id, status")` without aggregation. For popular events with many RSVPs, this loads unnecessary data.
- Improvement path: Use Supabase `.select('*', { count: 'exact', head: true })` with filters for each status, or create a database view/function that returns counts directly.

**Events GET route fetches `select('*')` without club join, then fabricates club objects:**
- Problem: The events list endpoint fetches all columns, then constructs synthetic `club` objects from the `organizer` string field (lines 253-261). This is a workaround for a missing join.
- Files: `src/app/api/events/route.ts` (lines 177-264)
- Cause: Comment on line 83 of `src/app/api/events/[id]/route.ts` says "Clubs table does not exist" but `clubs` table is referenced in types and other routes. The data model appears inconsistent.
- Improvement path: Use a proper join (`select('*, club:clubs(*)')`) and remove the synthetic club fabrication.

**Popularity calculation processes events sequentially in batches of 10:**
- Problem: The admin endpoint calls `update_event_popularity` RPC individually for each event, batched by 10 with `Promise.all`. For large event counts this is slow.
- Files: `src/app/api/admin/calculate-popularity/route.ts` (lines 104-139)
- Cause: Individual RPC calls per event rather than a single bulk database function.
- Improvement path: Create a single Postgres function `recalculate_all_popularity()` that processes all events in one transaction.

## Fragile Areas

**Tag mapping between DB and frontend:**
- Files: `src/app/api/events/route.ts` (lines 30-41), `src/lib/tagMapping.ts`
- Why fragile: Two separate tag mapping implementations exist. The events route has a hardcoded `tagMapping` Record that maps strings to `EventTag` enum values with a silent fallback to `EventTag.SOCIAL` for unknown tags. The `tagMapping.ts` module is used by other routes. Adding a new tag requires updating multiple files.
- Safe modification: Centralize all tag mapping in `src/lib/tagMapping.ts` and import it in `src/app/api/events/route.ts`.
- Test coverage: `src/__tests__/api/events/get-events.test.ts` tests the events route but does not verify tag mapping for unknown tags.

**Event data model dual-schema (start_date/end_date vs event_date/event_time):**
- Files: `src/app/api/events/route.ts` (lines 11-27, 224-226), `src/lib/supabase/types.ts`
- Why fragile: The `EventRow` type in the events route has both `start_date`/`end_date` and `event_date`/`event_time` as optional fields, with fallback logic (`event.start_date ?? event.event_date`). This suggests a schema migration that was not fully completed.
- Safe modification: Verify which columns the production DB actually uses, then remove the deprecated schema branch and update types.
- Test coverage: Tests mock the data, so they cannot catch column-name mismatches with the real DB.

**Auth callback with multiple `(supabase as any)` casts:**
- Files: `src/app/auth/callback/route.ts` (lines 149, 165, 178)
- Why fragile: The OAuth callback handles user creation, admin role assignment, and onboarding detection. Every DB call uses `as any`, so type changes silently break this critical flow. No test coverage exists for this route.
- Safe modification: Update types first, then remove casts. Add integration tests.
- Test coverage: No tests found for `src/app/auth/callback/route.ts`.

## Scaling Limits

**In-memory rate limiting:**
- Current capacity: Works for a single Node.js process.
- Limit: Breaks with multiple serverless function instances (each has its own store).
- Scaling path: Move to Redis/Upstash-based rate limiting as noted in `src/middlewareRateLimit.ts` comments.

**Recommendation scoring latency:**
- Current capacity: Pre-computed scores are read directly from Supabase; no external service dependency.
- Limit: Scores are refreshed by `compute_user_scores()` on a 6-hour pg_cron schedule, so recommendations may be up to 6 hours stale. Session boost partially compensates within a session.
- Scaling path: Reduce cron interval or trigger incremental score updates on significant user interactions.

## Dependencies at Risk

**None critical detected.** The project uses well-maintained packages (Next.js, Supabase SDK, Tailwind, shadcn/ui). No deprecated or unmaintained dependencies identified.

## Missing Critical Features

**No admin authorization on analytics endpoint:**
- Problem: `GET /api/recommendations/analytics` is accessible to any authenticated user (TODO comment acknowledges this).
- Blocks: Cannot safely expose recommendation analytics in production without leaking data across users (mitigated by RLS but not application-level).

**No CSRF protection on state-changing API routes:**
- Problem: POST/PATCH/DELETE routes rely solely on Supabase session cookies for auth. No CSRF token validation.
- Blocks: Standard browser-based CSRF attacks could trigger state changes if a user is logged in.

## Test Coverage Gaps

**Auth callback route (critical path, zero tests):**
- What's not tested: OAuth code exchange, McGill email validation, user upsert, admin role assignment, onboarding redirect logic.
- Files: `src/app/auth/callback/route.ts`
- Risk: Breaking changes to Supabase auth SDK or user metadata format go undetected.
- Priority: High

**Admin routes (limited coverage):**
- What's not tested: `src/app/api/admin/events/route.ts`, `src/app/api/admin/calculate-popularity/route.ts`, `src/app/api/admin/clubs/[id]/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts`
- Files: All routes under `src/app/api/admin/`
- Risk: Admin operations (event approval, club management, popularity calculation) have no automated verification.
- Priority: Medium

**Recommendation routes (no tests):**
- What's not tested: `src/app/api/recommendations/route.ts` GET/POST handlers, fallback behavior, explanation generation.
- Files: `src/app/api/recommendations/route.ts`, `src/app/api/recommendations/analytics/route.ts`, `src/app/api/recommendations/feedback/route.ts`, `src/app/api/recommendations/sync/route.ts`
- Risk: Recommendation logic changes (user payload construction, feedback aggregation) could silently break personalization.
- Priority: Medium

**Client components (no component tests):**
- What's not tested: `src/app/page.tsx` (home page), `src/components/events/EventCard.tsx`, `src/components/events/CreateEventForm.tsx`
- Files: All components under `src/components/events/` except `EventFilters.test.tsx` and `FilterSidebar.test.tsx`
- Risk: UI regressions in event display, filtering, and form submission go undetected.
- Priority: Low (existing filter tests cover key component logic)

---

*Concerns audit: 2026-03-05*
