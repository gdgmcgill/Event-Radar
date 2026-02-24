---
phase: 02-cold-start-fix
plan: 01
subsystem: api
tags: [recommendations, cold-start, popularity, supabase, nextjs, typescript]

# Dependency graph
requires: []
provides:
  - "RECOMMENDATION_THRESHOLD = 3 constant in src/lib/constants.ts"
  - "buildPopularityFallback function in recommendations API route"
  - "Cold-start early return path (before k-means) returning source: popular_fallback"
  - "source field on all 200-response return sites in recommendations API"
affects:
  - 02-cold-start-fix
  - page.tsx (consuming RECOMMENDATION_THRESHOLD)
  - RecommendedEventsSection (consuming source field from API response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cold-start early return: targeted single-user DB fetch before expensive parallel Promise.all"
    - "In-memory popularity boost scoring: +2 for save_count > 10, +1 for start within 7 days"
    - "source field discriminator on all API 200-response paths: personalized | popular_fallback"

key-files:
  created: []
  modified:
    - src/lib/constants.ts
    - src/app/api/recommendations/route.ts

key-decisions:
  - "Cold-start threshold set at 3 saved events (RECOMMENDATION_THRESHOLD = 3); centralized in constants.ts as single source of truth"
  - "Fallback uses .gt('start_date') not .gte() per COLD-02 — strictly future events only"
  - "buildPopularityFallback placed BEFORE Promise.all/k-means path to avoid paying full DB cost for cold-start users"
  - "source field added to all three existing 200-response return sites plus the new cold-start return; error (500) paths excluded"

patterns-established:
  - "Pattern 1: Cold-start gate — fetch user's own saved events first, return fallback immediately if below threshold, skip all clustering"
  - "Pattern 2: Popularity fallback joins event_popularity_scores inline and scores in-memory to support composite boost rules"

requirements-completed: [COLD-01, COLD-02, COLD-03, COLD-04, COLD-06, COLD-07]

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 2 Plan 01: Cold-Start Fallback and Source Field Summary

**Popularity-ranked fallback feed with in-memory boost scoring (+2/>10 saves, +1/7-day window) wired into recommendations API via early-exit cold-start detection, plus source discriminator field on all response paths**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-23T21:31:17Z
- **Completed:** 2026-02-23T21:39:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `RECOMMENDATION_THRESHOLD = 3` constant to `src/lib/constants.ts` — single source of truth for the cold-start threshold used by both the API and UI
- Added `buildPopularityFallback` function that fetches upcoming approved events joined with `event_popularity_scores`, excludes already-saved events, applies +2/+1 boost scoring in-memory, and returns top 20
- Added cold-start early return path at the top of the GET handler (before the expensive `Promise.all` + k-means) — cold users now skip all collaborative filtering
- Added `source: "popular_fallback"` to the cold-start response and `source: "personalized"` to all three existing 200-response return sites

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RECOMMENDATION_THRESHOLD constant and cold-start fallback with source field to recommendations API** - `1e89a9d` (feat)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified
- `src/lib/constants.ts` - Added `RECOMMENDATION_THRESHOLD = 3` export after `MCGILL_COLORS` block
- `src/app/api/recommendations/route.ts` - Added RECOMMENDATION_THRESHOLD import, buildPopularityFallback function, cold-start early return before Promise.all, source field on all 200-response paths

## Decisions Made
- Used `.gt("start_date", now.toISOString())` (not `.gte()`) per COLD-02 requirement for strictly future events
- Cold-start check uses a separate targeted `saved_events` fetch for the current user before the full parallel fetch — avoids paying k-means DB costs for cold users while keeping the existing personalized path unchanged
- `source` field added only to 200 response paths; error (500) responses are excluded as the UI only reads source from successful responses
- `buildPopularityFallback` typed with `Awaited<ReturnType<typeof createClient>>` to match the async server client pattern used in the route

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript strict mode satisfied on first attempt, build succeeded without errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- API now returns `source: "popular_fallback"` for cold-start users and `source: "personalized"` for established users
- `RECOMMENDATION_THRESHOLD` is exported from `src/lib/constants.ts` and ready to be imported by `page.tsx` (replace magic number `3`) and `RecommendedEventsSection` (for nudge math)
- `RecommendedEventsSection` component needs to be updated (Phase 2 plan 02 or subsequent) to read the `source` field and render "Popular on Campus" heading plus onboarding nudge (COLD-05, COLD-08)

## Self-Check: PASSED

All files created/modified exist on disk. Task commit `1e89a9d` verified in git log.

---
*Phase: 02-cold-start-fix*
*Completed: 2026-02-23*
