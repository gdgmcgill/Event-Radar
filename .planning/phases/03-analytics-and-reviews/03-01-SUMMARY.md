---
phase: 03-analytics-and-reviews
plan: 01
subsystem: api, ui
tags: [recharts, swr, analytics, supabase, charts]

# Dependency graph
requires:
  - phase: 01-club-management
    provides: Club members/followers tables, club dashboard tabs pattern
  - phase: 02-event-management
    provides: Events, RSVPs, saved_events, event_popularity_scores tables
provides:
  - Event-level analytics API (views, clicks, saves, RSVPs)
  - Club-level analytics API (follower growth, attendees, popular tags, per-event metrics)
  - ClubAnalyticsTab with Recharts line/bar charts
  - useEventAnalytics and useClubAnalytics SWR hooks
affects: [03-02-reviews]

# Tech tracking
tech-stack:
  added: [recharts]
  patterns: [thenable mock query builder for Supabase tests, bulk query pattern avoiding N+1]

key-files:
  created:
    - src/app/api/events/[id]/analytics/route.ts
    - src/app/api/clubs/[id]/analytics/route.ts
    - src/components/clubs/ClubAnalyticsTab.tsx
    - src/hooks/useAnalytics.ts
    - src/__tests__/api/events/analytics.test.ts
    - src/__tests__/api/clubs/analytics.test.ts
  modified:
    - src/types/index.ts
    - src/components/clubs/ClubDashboard.tsx

key-decisions:
  - "Use saved_events count instead of popularity_scores.save_count for more accurate save metrics"
  - "Cumulative follower growth chart over 30-day window with pre-window baseline"
  - "Bulk queries for per-event analytics to avoid N+1 (event_popularity_scores + rsvps + saved_events)"
  - "Thenable mock query builder pattern for testing non-terminal Supabase chains"

patterns-established:
  - "Analytics endpoint pattern: auth check -> club membership check -> bulk data fetch -> aggregate"
  - "Recharts integration: ResponsiveContainer wrapping LineChart/BarChart with McGill brand colors"

requirements-completed: [ANLY-01, ANLY-02, ANLY-03]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 3 Plan 1: Analytics Dashboards Summary

**Club analytics with Recharts line/bar charts for follower growth, popular tags, and per-event performance metrics**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T22:06:57Z
- **Completed:** 2026-03-05T22:11:58Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Event-level analytics endpoint returning views, clicks, saves, RSVP breakdown with club membership authorization
- Club-level analytics endpoint with follower growth (30-day cumulative), total attendees, popular tags (top 5), per-event metrics
- ClubAnalyticsTab with summary cards, follower growth line chart, popular tags bar chart, and events performance table
- Analytics tab visible to all club members in ClubDashboard (not owner-gated)
- 9 unit tests covering auth, authorization, empty data, and correct aggregation scenarios

## Task Commits

Each task was committed atomically:

1. **Task 0: Create test stubs for analytics endpoints** - `a4bcb65` (test)
2. **Task 1: Analytics types, API endpoints, and SWR hooks** - `651e9d5` (feat)
3. **Task 2: ClubAnalyticsTab with Recharts charts and dashboard wiring** - `bdef9a3` (feat)

## Files Created/Modified
- `src/types/index.ts` - Added EventAnalytics and ClubAnalytics interfaces
- `src/app/api/events/[id]/analytics/route.ts` - Event-level analytics GET endpoint
- `src/app/api/clubs/[id]/analytics/route.ts` - Club-level analytics GET endpoint
- `src/hooks/useAnalytics.ts` - SWR hooks for event and club analytics
- `src/components/clubs/ClubAnalyticsTab.tsx` - Analytics tab with Recharts charts and performance table
- `src/components/clubs/ClubDashboard.tsx` - Wired analytics tab into dashboard tabs
- `src/__tests__/api/events/analytics.test.ts` - Event analytics endpoint tests
- `src/__tests__/api/clubs/analytics.test.ts` - Club analytics endpoint tests

## Decisions Made
- Used saved_events count instead of popularity_scores.save_count for saves metric (more accurate real-time count)
- Cumulative follower growth over 30-day window includes pre-window followers as baseline
- Bulk queries for per-event analytics to avoid N+1 queries (single query per data type across all club events)
- Made mock query builders thenable to support non-terminal Supabase chain patterns in tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added null check for event.club_id in event analytics endpoint**
- **Found during:** Task 1
- **Issue:** TypeScript error -- event.club_id can be null in the Event type, but was passed directly to .eq()
- **Fix:** Added explicit null check with 400 response before authorization query
- **Files modified:** src/app/api/events/[id]/analytics/route.ts
- **Committed in:** 651e9d5

**2. [Rule 3 - Blocking] Made mock query builders thenable for non-terminal chains**
- **Found during:** Task 1 (test verification)
- **Issue:** Tests for saved_events/rsvps queries that don't use .maybeSingle() failed because mock builder wasn't thenable
- **Fix:** Added .then() method to mock builders so await resolves to {data, error}
- **Files modified:** src/__tests__/api/events/analytics.test.ts, src/__tests__/api/clubs/analytics.test.ts
- **Committed in:** 651e9d5

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analytics foundation complete, ready for Phase 3 Plan 2 (Reviews)
- Recharts library available for any future chart needs
- SWR hooks pattern established for analytics data fetching

---
*Phase: 03-analytics-and-reviews*
*Completed: 2026-03-05*
