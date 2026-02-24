---
phase: 02-cold-start-fix
plan: 02
subsystem: ui
tags: [recommendations, cold-start, onboarding, react, typescript, constants]

# Dependency graph
requires:
  - "02-01 (RECOMMENDATION_THRESHOLD constant + source field on API responses)"
provides:
  - "Source-aware heading in RecommendedEventsSection: Popular on Campus vs Recommended For You"
  - "Onboarding nudge showing saves remaining to unlock personalized recommendations"
  - "RECOMMENDATION_THRESHOLD used in page.tsx replacing magic number 3"
  - "Authenticated cold-start users routed to RecommendedEventsSection (not PopularEventsSection)"
affects:
  - src/components/events/RecommendedEventsSection.tsx
  - src/app/page.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source discriminator consumption: component reads data.source from API response to conditionally render heading/nudge"
    - "IIFE nudge pattern: inline (() => { ... })() for conditional nudge math without extra state"
    - "isLoading gate on nudge: prevents showing inaccurate saved count during useSavedEvents fetch"

key-files:
  created: []
  modified:
    - src/components/events/RecommendedEventsSection.tsx
    - src/app/page.tsx

key-decisions:
  - "Authenticated cold-start users now see RecommendedEventsSection (API handles fallback) — removes the save-count gate from page.tsx conditional"
  - "Nudge gated on !isLoading from useSavedEvents to avoid showing incorrect remaining count during initial fetch"
  - "canShowRecommendations variable retained in page.tsx (costs nothing, may be referenced elsewhere) but no longer gates the Popular/Recommended section render"

patterns-established:
  - "Pattern 3: Source-aware UI — component reads API source discriminator field to toggle heading, subtitle, and nudge rendering"

requirements-completed: [COLD-05, COLD-07, COLD-08]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 2 Plan 02: Source-Aware UI and Cold-Start Onboarding Nudge Summary

**Source-discriminator-driven heading toggle (Popular on Campus / Recommended For You) plus onboarding nudge showing exact remaining saves needed, with authenticated cold-start users routed to RecommendedEventsSection in page.tsx**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T21:35:00Z
- **Completed:** 2026-02-23T21:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Updated `RecommendedEventsSection` to read `data.source` from API response and store in `source` state
- Added `RecommendationsResponse` interface for TypeScript strict mode compliance
- Heading now shows "Popular on Campus" when source is `popular_fallback`, "Recommended For You" (with "New" badge) when personalized
- Subtitle changes to "Trending events from across campus" for fallback, "Based on your interests and saved events" for personalized
- Onboarding nudge shows "Save N more event(s) to unlock personalized recommendations" — gated on `!isLoading` to avoid inaccurate counts
- Updated `useSavedEvents` destructure in component to include `isLoading`
- Added `RECOMMENDATION_THRESHOLD` and `BookmarkPlus` imports to component
- Replaced magic number `3` in `page.tsx` with `RECOMMENDATION_THRESHOLD` constant import
- Fixed `page.tsx` conditional: authenticated users always see `RecommendedEventsSection`; only unauthenticated users and failed cases see `PopularEventsSection`

## Task Commits

Each task was committed atomically:

1. **Task 1: Make RecommendedEventsSection source-aware with conditional heading and onboarding nudge** - `c7bc8ab` (feat)
2. **Task 2: Replace magic number with RECOMMENDATION_THRESHOLD in page.tsx and fix authenticated cold-start rendering** - `8372cd5` (feat)

## Files Created/Modified
- `src/components/events/RecommendedEventsSection.tsx` - Added source state, RecommendationsResponse interface, dynamic heading/subtitle, onboarding nudge, RECOMMENDATION_THRESHOLD + BookmarkPlus imports, isLoading destructure
- `src/app/page.tsx` - Added RECOMMENDATION_THRESHOLD import, replaced magic number, fixed Popular/Recommended conditional rendering

## Decisions Made
- Authenticated cold-start users now routed to `RecommendedEventsSection` (which returns the popularity fallback from the API) — removes the `canShowRecommendations` gate from the page.tsx conditional, simplifying the rendering logic
- `canShowRecommendations` variable retained in `page.tsx` to avoid breaking any potential future references, but the section conditional no longer depends on it
- Nudge uses IIFE pattern `(() => { ... })()` to compute `remaining` inline without adding extra component state

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript strict mode satisfied on first attempt, build succeeded without errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Cold-start UX is now complete end-to-end: API returns `source` field, UI renders source-appropriate heading and nudge
- Phase 2 is complete (both plans 01 and 02 done)
- Phase 3 (NotificationBell) can begin; decision needed on Zustand vs SWR caching strategy (see STATE.md blockers)

## Self-Check: PASSED

All files modified exist on disk. Task commits `c7bc8ab` and `8372cd5` verified in git log.

---
*Phase: 02-cold-start-fix*
*Completed: 2026-02-23*
