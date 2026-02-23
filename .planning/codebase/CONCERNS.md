# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Widespread use of `any` type annotations:**
- Issue: Over 30 instances of `any` casts bypass TypeScript strict mode, creating type safety gaps
- Files: `src/app/auth/callback/route.ts`, `src/app/api/health/route.ts`, `src/app/api/users/saved-events/route.ts`, `src/app/api/profile/interests/route.ts`, `src/app/api/profile/avatar/route.ts`, `src/app/api/events/popular/route.ts`, `src/__tests__/api/events/rsvp.test.ts`, `src/hooks/useEvents.test.ts`, `src/components/profile/InterestsCard.tsx`, `src/components/events/FilterSidebar.test.tsx`
- Impact: Type errors slip through during development, potential runtime crashes in production
- Fix approach: Replace all `any` casts with proper types from `Database` schema or create specific interfaces

**Incomplete console.log debugging left in production code:**
- Issue: 135 console.log calls across 44 files, many with debug-level information
- Files: `src/store/useAuthStore.ts` (15 logs), `src/app/auth/callback/route.ts` (8 logs), `src/app/api/health/route.ts` (10 logs), `src/app/api/recommendations/route.ts` (6 logs), `src/app/api/events/route.ts`, `src/components/events/RsvpButton.tsx`, `src/components/events/CreateEventForm.tsx`
- Impact: Leaks sensitive information to client browsers, clutters production logs, impacts performance
- Fix approach: Replace console.log calls with proper logging service (e.g., Winston, Pino) with environment-based log levels

**Incomplete Footer component:**
- Issue: Footer is stubbed with placeholder TODOs, missing core functionality
- Files: `src/components/layout/Footer.tsx` (lines 3, 42, 50)
- Impact: Footer doesn't provide links, social media, or contact information
- Fix approach: Implement footer with proper links, social media icons, and copyright

**Incomplete EventGrid component:**
- Issue: Grid lacks responsive layout, loading states, and empty states
- Files: `src/components/events/EventGrid.tsx` (line 6)
- Impact: Grid doesn't gracefully handle loading or empty states
- Fix approach: Add Skeleton loaders for loading state, empty state messaging, responsive breakpoints

**Unimplemented recommendation sync route:**
- Issue: `/api/recommendations/sync` endpoint hardcoded as no-op, awaiting external AI service integration
- Files: `src/app/api/recommendations/sync/route.ts` (line 1, marked AS-6)
- Impact: Recommendation sync feature doesn't work, blocking real-time syncing with AI models
- Fix approach: Wire up to external recommendation service or remove if not needed

## Performance Bottlenecks

**Large classifier module without memoization:**
- Problem: `src/lib/classifier.ts` is 565 lines of complex classification logic without optimization
- Files: `src/lib/classifier.ts`
- Cause: Classification functions recalculated for every Instagram post during scraping
- Improvement path: Add memoization for repeated tag patterns, batch process posts, use lazy evaluation

**Recommendation engine processes all events per user:**
- Problem: `/api/recommendations` route calculates k-means clustering on all events for every request
- Files: `src/app/api/recommendations/route.ts` (365 lines)
- Cause: No caching of cluster results, recalculates user vector on every request
- Improvement path: Cache cluster results in database with TTL, batch user updates, add background job

**Full data reload on every filter/pagination:**
- Problem: `useEvents` hook fetches fresh data on every filter change, no delta caching
- Files: `src/hooks/useEvents.ts` (275 lines)
- Cause: No local cache layer between hook and API, no stale-while-revalidate pattern
- Improvement path: Add SWR pattern, client-side deduplication of requests, implement request coalescing

**Missing database indexes:**
- Problem: Multiple `.eq()` queries on unindexed columns likely cause table scans
- Files: All API routes using Supabase queries (40+ files)
- Cause: No indication of database indexes on `user_id`, `event_id`, `club_id`, `status`
- Improvement path: Add indexes on frequently filtered columns, verify query plans in Supabase console

**N+1 query pattern in popularity calculation:**
- Problem: `/api/admin/calculate-popularity` queries event popularity row by row
- Files: `src/app/api/admin/calculate-popularity/route.ts` (239 lines)
- Cause: No batch query of all event popularity scores
- Improvement path: Fetch all scores in single query, batch update events

## Fragile Areas

**OAuth callback cookie handling complexity:**
- Files: `src/app/auth/callback/route.ts` (196 lines)
- Why fragile: Manual cookie accumulation across multiple `setAll` calls due to Azure token chunking. Hard to debug, easy to accidentally break token refresh
- Safe modification: Add comprehensive cookie handling tests, document the chunking behavior, consider using Supabase session management utility
- Test coverage: No dedicated tests for multi-chunk cookie scenarios

**Rate limiting middleware with global state:**
- Files: `src/middlewareRateLimit.ts`
- Why fragile: In-memory rate limit tracking (Map) lost on server restart, not distributed across replicas
- Safe modification: Document limitations clearly, add tests for edge cases, migrate to Supabase or Redis
- Test coverage: Minimal to none

**Authentication state synchronization:**
- Files: `src/store/useAuthStore.ts`, `src/middleware.ts`
- Why fragile: Multiple auth sources (onAuthStateChange, getUser, session cookies) could diverge. 3-second fallback timeout arbitrary
- Safe modification: Consolidate to single auth source, add tests for desync scenarios, make timeout configurable
- Test coverage: No tests for race conditions between middleware and Zustand store

**Database schema mismatch risk:**
- Files: `src/lib/supabase/types.ts` (generated types), 40+ API routes assuming schema structure
- Why fragile: Generated types can become stale if schema changes without regeneration. No schema validation at runtime
- Safe modification: Add pre-commit hook to regenerate types, validate unknown data shapes at API boundaries
- Test coverage: No integration tests verifying schema matches types

## Scaling Limits

**In-memory rate limiting:**
- Current capacity: Single server instance with Map-based tracking
- Limit: Lost on restart, not shared across multiple server instances
- Scaling path: Migrate to Redis-backed rate limiting (ioredis + rate-limit-redis), or use Supabase tables for distributed tracking

**Hardcoded admin role assignment:**
- Current capacity: ADMIN_EMAILS environment variable supports N emails
- Limit: No dynamic admin role management, no audit trail of privilege changes
- Scaling path: Add admin management UI in moderation dashboard, implement role-based access control (RBAC) with granular permissions, add audit logging

**Zustand auth store in browser only:**
- Current capacity: Single browser instance
- Limit: No synchronization across browser tabs/windows, no persistence beyond session
- Scaling path: Add localStorage persistence with hydration, implement cross-tab communication via BroadcastChannel API

## Test Coverage Gaps

**API routes lack comprehensive tests:**
- What's not tested: Error handling paths, edge cases in data validation, SQL injection scenarios, rate limiting behavior
- Files: `src/app/api/events/[id]/rsvp/route.ts` (446 lines) - only 1 test file exists for subset of routes
- Risk: Critical business logic (RSVP, event creation) could break silently in production
- Priority: HIGH - RSVP is core feature affecting user engagement

**Component state management untested:**
- What's not tested: Filter state changes, pagination edge cases, async loading transitions
- Files: `src/app/page.tsx` (411 lines with complex filtering), `src/components/events/CreateEventForm.tsx` (421 lines)
- Risk: UI could render in broken states, form submissions could fail silently
- Priority: HIGH - Home page and event creation are user-facing features

**Hook integration tests missing:**
- What's not tested: `useEvents` pagination cursor logic, recommendation scoring algorithm edge cases
- Files: `src/hooks/useEvents.ts` (275 lines), `src/app/api/recommendations/route.ts` (365 lines)
- Risk: Pagination could skip events, recommendations could be incorrect
- Priority: MEDIUM - Would benefit from integration tests with mock Supabase

**Authentication flow untested:**
- What's not tested: McGill email validation, Azure OAuth callback flow, admin role assignment
- Files: `src/app/auth/callback/route.ts` (196 lines), `src/middleware.ts` (137 lines)
- Risk: Users could bypass email restrictions, auth tokens could be invalidated
- Priority: HIGH - Security-critical

**Database schema validation untested:**
- What's not tested: Type mismatches between generated types and actual data, null handling
- Files: All API routes, 40+ files
- Risk: Runtime errors from unexpected data shapes could crash endpoints
- Priority: MEDIUM - Would catch integration bugs early

## Known Bugs

**Console logging exposes sensitive user data:**
- Symptoms: Browser console shows full user objects with email, avatar URLs, interest tags on every auth state change
- Files: `src/store/useAuthStore.ts` (lines 22, 27, 38, 56, 76, etc.)
- Trigger: Any page load after authentication
- Workaround: Open DevTools, filter out "Auth" logs; disable in production via logging service

**Cursor pagination vulnerable to integer overflow:**
- Symptoms: Sorting by `popularity_score` or `trending_score` could produce wrong sort order for large numbers
- Files: `src/app/api/events/route.ts` (lines 40-57)
- Trigger: Create events with popularity_score > 2^53 (JavaScript number limit)
- Workaround: Use string-based sorting, convert large numbers to ISO strings

**Race condition in auth initialization:**
- Symptoms: Auth state loading inconsistently from 0-3 seconds depending on network
- Files: `src/store/useAuthStore.ts` (lines 142-147)
- Trigger: Rapid page reload during auth initialization
- Workaround: None; requires fixing 3-second timeout and race condition handling

## Security Considerations

**Admin role hardcoded via environment variable:**
- Risk: No audit trail of who has admin access, no revocation mechanism, env var leakage grants permanent admin
- Files: `src/app/auth/callback/route.ts` (lines 22-32)
- Current mitigation: Protected by `.env.local` in .gitignore, Vercel dashboard access control
- Recommendations: Implement database-backed admin role with timestamp-based expiration, add admin audit log table, implement dynamic admin revocation

**McGill email domain validation regex only checks domain suffix:**
- Risk: Custom email domain ending in `@mcgill.ca` could bypass validation (e.g., `attacker@evil.com@mcgill.ca`)
- Files: `src/app/auth/callback/route.ts` (lines 27-28)
- Current mitigation: Supabase email verification, Azure OAuth enforces McGill tenant
- Recommendations: Use strict domain validation, whitelist known good domains, add email verification with McGill mail servers

**JSON.parse without schema validation:**
- Risk: Cursor payload could contain unexpected fields, integer overflow attacks
- Files: `src/app/api/events/route.ts` (line 43)
- Current mitigation: Basic payload structure check (id, sortValue types)
- Recommendations: Use `zod` or `joi` for schema validation, validate sortValue range, add fuzz testing

**Service role key exposed in client-side code:**
- Risk: If exposed, allows direct database access bypassing all security checks
- Files: `src/app/api/admin/calculate-popularity/route.ts` (line 119)
- Current mitigation: Kept in environment variable, never in client code
- Recommendations: Audit all uses of service role key, implement audit logging for service key operations, rotate keys regularly

**Missing CSRF protection on state-changing operations:**
- Risk: Cross-site forgery attacks could modify user RSVP, saved events, profile
- Files: `src/app/api/events/[id]/rsvp/route.ts`, `src/app/api/events/[id]/save/route.ts`, `src/app/api/profile/interests/route.ts`
- Current mitigation: None detected; relies on Supabase auth tokens only
- Recommendations: Add CSRF tokens to forms, validate Origin/Referer headers, use SameSite cookies

## Missing Critical Features

**No real-time event updates:**
- Problem: Users don't see new events or RSVP count changes without page refresh
- Blocks: Live event notifications, collaborative features
- Workaround: Manual refresh button visible, but poor UX

**No event moderation audit trail:**
- Problem: Admin status changes (approve/reject) don't log who changed it or why
- Blocks: Compliance audits, accountability for moderation decisions
- Workaround: None; admins must manually track changes

**No data retention/deletion policy:**
- Problem: Deleted events and users not actually deleted, just marked inactive
- Blocks: GDPR right-to-be-forgotten compliance
- Workaround: None; requires manual database cleanup

**No rate limiting per-user across requests:**
- Problem: Users can spam API with multiple concurrent requests
- Blocks: Preventing abuse, protecting database from overload
- Workaround: Middleware has basic IP-based limiting, but incomplete

---

*Concerns audit: 2026-02-23*
