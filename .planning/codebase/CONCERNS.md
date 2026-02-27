# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

### Unfinished Recommendation Sync Route
- **Issue:** Route stub with no external service integration
- **Files:** `src/app/api/recommendations/sync/route.ts:1`
- **Impact:** POST endpoint to sync events to recommendation service is not wired up. Currently accepts payloads but notes that integration is incomplete (TODO AS-6). If this route is called by a pipeline, events may not actually sync to the recommendation index.
- **Fix approach:** Either implement full integration to external recommendation API service (Python backend on port 8000 expected), or remove the route entirely and handle syncing differently (e.g., triggers on event create/update in Supabase).

### EventGrid Component Not Fully Implemented
- **Issue:** Component has incomplete features
- **Files:** `src/components/events/EventGrid.tsx:6`
- **Impact:** Grid component lacks proper responsive behavior, loading state skeleton refinements, and empty state animations. Currently uses basic Tailwind grid that may not adapt well to all screen sizes.
- **Fix approach:** Implement media query-aware grid columns, enhance loading state UX, and improve empty state messaging.

## Performance Bottlenecks

### Recommendations Endpoint Loads Entire Datasets
- **Problem:** `/api/recommendations` fetches ALL users, ALL events, and ALL saved events into memory for k-means clustering
- **Files:** `src/app/api/recommendations/route.ts:188-205`
- **Cause:** Uses `.select("*")` on `events` table (line 203) and loads all users regardless of whether they have meaningful data. At scale (1000+ users, 10000+ events), this becomes prohibitively slow and memory-intensive.
- **Improvement path:**
  - Add `.limit()` to query only active users (those with recent activity)
  - Query only future/upcoming events: `.gt("start_date", now.toISOString())`
  - Consider pagination for clustering if user base grows beyond ~500 users
  - Move k-means to a separate background job rather than request-time computation

### K-Means Clustering on Request Path
- **Problem:** k-means algorithm runs synchronously during recommendation request
- **Files:** `src/app/api/recommendations/route.ts:307-326`
- **Cause:** Clustering 500+ users is computationally expensive (50 iterations max per user). With 6-dimensional vectors, this adds latency directly to user-facing API.
- **Improvement path:** Pre-compute clusters on a schedule (daily/hourly). Store cluster assignments in DB. Fetch pre-computed clusters at request time rather than computing on demand.

### SELECT * on Large Events Table
- **Problem:** Line 203 and 406 use `.select("*")` without field specification
- **Files:** `src/app/api/recommendations/route.ts:203, 406`
- **Cause:** Fetches all event columns (including description, image_url, etc.) but only uses tags, id, start_date. Each unused column increases network payload.
- **Improvement path:** Specify only needed columns: `.select("id, tags, start_date, status")` at minimum. Same pattern in fallback query line 406.

### Full User Enrichment in Recommendations
- **Problem:** Code enriches every user vector with saved event tags, even users not in current cluster
- **Files:** `src/app/api/recommendations/route.ts:282-289`
- **Cause:** Loops through ALL saved_events and enriches ALL user vectors before filtering to current user's cluster. This is wasteful—only cluster-mates matter.
- **Improvement path:** After cluster assignment, only enrich vectors for users in the current cluster.

## Scaling Limits

### In-Memory Data Structures for Clustering
- **Current capacity:** Works efficiently for ~500-1000 users with ~10000 events
- **Limit:** At 5000+ users or 50000+ events, memory usage for `Map<string, Vector>` and `Map<string, Set<string>>` becomes problematic
- **Scaling path:**
  - Move clustering to a separate Node.js worker process or serverless function with higher memory limits
  - Cache user vectors in Redis instead of computing them request-time
  - Pre-compute and store cluster assignments in `user_clusters` table

### Concurrent Requests to Recommendation Endpoint
- **Current capacity:** Supabase free tier handles ~5-10 concurrent requests
- **Limit:** Each request triggers 5 parallel Supabase queries fetching full datasets. At 20+ concurrent requests, Supabase rate limits or connection pool exhaustion occurs
- **Scaling path:**
  - Implement caching layer (SWR on frontend with 5-minute TTL)
  - Cache recommendation results in Redis keyed by `user_id` with 10-minute TTL
  - Add rate limiting to `/api/recommendations` endpoint

## TypeScript Safety Issues

### Excessive `as unknown as` Type Casts
- **Issue:** Frequent unsafe type assertions bypass type checking
- **Files:**
  - `src/app/api/recommendations/route.ts:132, 239-243` (lines 132, 239, 240, 241, 242, 243)
  - `src/app/api/clubs/logo/route.ts:54, 69`
  - `src/app/api/feedback/route.ts:31`
  - `src/app/auth/callback/route.ts:149, 165, 178`
- **Impact:** Loses type safety. If Supabase schema changes, these casts will silently accept wrong types and cause runtime errors downstream
- **Fix approach:**
  - Define proper type guards for database row types
  - Use `type Database` from supabase/types correctly instead of asserting `as any`
  - Create utility function `assertEventRow()` instead of inline casts

### Any Types in Error Handling
- **Issue:** Catch blocks use `error: any` instead of proper error typing
- **Files:** `src/app/api/health/route.ts:139, 177, 243, 319, 375`
- **Impact:** Cannot safely access error properties. `error.message` may not exist, causing secondary errors
- **Fix approach:** Use `error: unknown` and add proper type guards: `if (error instanceof Error) { error.message }`

### Missing Type Guard for Supabase Response
- **Issue:** `supabase.storage.getPublicUrl()` returns untyped object with possible undefined fields
- **Files:** `src/app/api/clubs/logo/route.ts:69`
- **Impact:** Code assumes `urlData` has the expected structure without validation. If Supabase changes response format, storage URLs break silently
- **Fix approach:** Add explicit type checking before using `urlData.publicUrl`

## Fragile Areas

### Recommendation Engine Collapse Without Data
- **Files:** `src/app/api/recommendations/route.ts:294-299, 338`
- **Why fragile:**
  - If `currentUserVector` is zero (no interest tags + no saved events) and no `interestTags`, engine returns empty array
  - If all candidates are filtered out (e.g., no upcoming events), returns empty array
  - No graceful degradation—ends with `[]` instead of fallback to popular events
- **Safe modification:** Always have fallback path. Check test coverage for zero-vector and no-candidates scenarios
- **Test coverage:** Untested edge cases around line 297-299 and 338-339

### Classifier Heuristics Drift Over Time
- **Files:** `src/lib/classifier.ts:200-332` (signals, confidence thresholds)
- **Why fragile:**
  - Confidence thresholds (0.7, 0.4) are hardcoded and tuned for current Instagram post distribution
  - If Instagram format changes (e.g., less structured captions, more emojis) or McGill clubs post differently next semester, thresholds may misclassify 30%+ of posts
  - Date/time regex patterns are brittle to variations (handles "Jan 15" but not "January15" without space)
- **Safe modification:** Log confidence scores to database for every post. Monitor misclassification rate. Adjust thresholds monthly based on actual data
- **Test coverage:** Good coverage in `src/lib/classifier.test.ts` but tests use fixed, well-formatted captions. Real data likely messier.

### EventGrid Score Display Without Normalization
- **Files:** `src/components/events/EventGrid.tsx:14`
- **Why fragile:**
  - Component accepts `score?: number` on events but doesn't normalize/validate it
  - Scores from recommendations (0.0-1.0) displayed raw could show as "0.345" if displayed as-is
  - If recommendation algorithm changes score scale (e.g., becomes 0-100), display breaks
- **Safe modification:**
  - Add explicit prop for score display format: `scoreFormat?: 'percentage' | 'hidden'`
  - Validate score is in valid range before rendering
  - Always display as percentage (score * 100) if shown
- **Test coverage:** Component not tested

### Auth Callback Logic Complexity
- **Files:** `src/app/auth/callback/route.ts:40-185`
- **Why fragile:**
  - McGill email validation (`isMcGillEmail()`) depends on `@mcgill.ca` or `@mail.mcgill.ca` domains
  - If McGill changes email domains or adds institutional SSO with different domain, auth breaks
  - Orphaned user cleanup (delete non-McGill users) happens inline with profile creation—if deletion fails, profile still created and user stuck
  - Auto-admin assignment hardcoded to `ADMIN_EMAILS` env var without validation of email format
- **Safe modification:**
  - Store McGill domain list in database, not hardcoded
  - Separate user cleanup into async job with retry logic
  - Add logging for every auth state transition
- **Test coverage:** Untested callback flow

## Validation Gaps

### Insufficient Input Validation on API Endpoints
- **Issue:** Minimal validation on request bodies
- **Files:**
  - `src/app/api/recommendations/sync/route.ts:32-37` (only checks `event_id` presence)
  - `src/app/api/events/[id]/rsvp/route.ts:24-26` (status validation is weak)
  - `src/app/api/feedback/route.ts` (assumes request.json() succeeds, no field validation)
- **Impact:** Malformed requests bypass checks and could insert bad data into database
- **Fix approach:**
  - Use Zod or similar validation library for all request payloads
  - Validate UUIDs, email formats, date ranges before DB operations
  - Return clear 400 errors with validation details

### Cursor Validation in Pagination
- **Issue:** Cursor is base64-decoded but schema validation is loose
- **Files:** `src/app/api/events/route.ts:40-58`
- **Impact:** Malicious cursor like `eyJzcm9ydFZhbHVlIjp9` (empty sortValue) passes validation but could cause query errors
- **Fix approach:** Stricter bounds checking on numeric sortValues, regex validation on string sortValues

## Security Considerations

### Console Logging in Production
- **Risk:** Sensitive data may be logged to stdout in production
- **Files:** Many API routes use `console.error()` and `console.log()` (28+ instances found)
- **Current mitigation:** Next.js logs to stderr which isn't typically exposed, but errors could leak into client-side logs if caught and re-logged
- **Recommendations:**
  - Use structured logging (e.g., `pino`, `winston`) with log levels
  - Never log full error objects or database query results
  - Scrub sensitive fields before logging (email, token fragments)

### Admin Email Hardcoding
- **Risk:** Admin email list in `process.env.ADMIN_EMAILS` could be leaked if .env is exposed
- **Files:** `src/app/auth/callback/route.ts:20`
- **Current mitigation:** Stored in .env.local (not committed)
- **Recommendations:**
  - Consider storing admin roles in database with audit trail
  - Limit admin assignment to explicit migrations or admin panel, not auto-assign on signup

### Service Role Key in Client-Visible Code
- **Risk:** `SUPABASE_SERVICE_ROLE_KEY` used in auth callback (server-side only) but could be exposed
- **Files:** `src/app/auth/callback/route.ts:117-118`
- **Current mitigation:** Only used in server routes, `process.env` access is server-only
- **Recommendations:** Double-check that build doesn't accidentally include SUPABASE_SERVICE_ROLE_KEY in browser bundles (use Next.js strict env validation)

## Missing Critical Features

### Event Recurrence Not Supported
- **Problem:** No database structure for recurring events (weekly club meetings, monthly mixers)
- **Blocks:** Users can't easily find "every Tuesday event" without manual re-posting each week
- **Impact:** Event creation friction increases, incomplete event data

### Event Reminders Not Implemented
- **Problem:** Platform has no reminder/notification system for saved events
- **Blocks:** Users can't be notified before an event they saved, reducing attendance
- **Impact:** Reduced user engagement, saved events become stale bookmarks

### Recommendation Feedback Loop Missing
- **Problem:** No way to capture "not interested" feedback to improve recommendations
- **Blocks:** Recommendation engine has no signal for false positives, only implicit signal from saves
- **Impact:** Recommendations may degrade if user interests change

## Dependencies at Risk

### No Outdated Dependencies Found
- Stack uses modern, actively maintained libraries (Next.js 16, React 18, Supabase JS 2.49)
- However, consider:
  - `@swagger-api/apidom-ns-openapi-3-1`: Pre-release version (`1.0.0-rc.3`). May not be stable for production Swagger docs
  - `next-swagger-doc`: Low-maintenance project. Alternatives: `tsoa`, `tRPC` for better type safety

## Test Coverage Gaps

### API Recommendation Endpoint Lacks Tests
- **What's not tested:** `/api/recommendations` endpoint (main complexity)
- **Files:** `src/app/api/recommendations/route.ts` (437 lines, 0 tests)
- **Risk:** k-means clustering logic, cold-start detection, fallback paths untested. Changes could break silently.
- **Priority:** High—core business logic

### EventGrid Component Not Tested
- **What's not tested:** EventGrid rendering, animation, empty state, loading state
- **Files:** `src/components/events/EventGrid.tsx`
- **Risk:** UI breaks without warning
- **Priority:** Medium—can be caught by E2E tests, but unit coverage would be faster feedback

### Auth Callback Not Tested
- **What's not tested:** McGill email validation, non-McGill user deletion, admin assignment, profile creation
- **Files:** `src/app/auth/callback/route.ts`
- **Risk:** Auth flow regressions on code changes
- **Priority:** High—authentication is critical path

### Classifier Pipeline Integration Untested
- **What's not tested:** Full pipeline from Apify output → classification → webhook
- **Files:** `src/lib/classifier-pipeline.ts`
- **Risk:** Events stuck in pipeline or sent to wrong status if webhook fails
- **Priority:** High—event ingestion is core feature

### Error Handling in useEvents Hook Not Tested
- **What's not tested:** Error scenarios, retry logic, pagination edge cases
- **Files:** `src/hooks/useEvents.ts` (275 lines, 0 tests)
- **Risk:** Silent failures when API returns errors, infinite loading states
- **Priority:** Medium—affects all event listing pages

## Known Issues

### EventGrid TODO Not Tracked
- **Issue:** Responsive grid, loading states incomplete per TODO comment
- **Status:** Acknowledged but not in issue tracker. May be forgotten.
- **Recommendation:** Create GitHub issue or move to backlog

### Recommendation Sync TODO Not Tracked
- **Issue:** TODO AS-6 references external system integration. Unclear if this is linked to actual task board or just inline comment.
- **Status:** Unresolved. Route may be called by pipeline but does nothing.
- **Recommendation:** Either complete integration or remove route. Verify nothing calls it first.

---

*Concerns audit: 2026-02-25*
