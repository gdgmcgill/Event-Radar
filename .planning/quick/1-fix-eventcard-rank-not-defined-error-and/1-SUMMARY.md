---
phase: quick
plan: 1
subsystem: EventCard UI, Recommendations API
tags: [bugfix, runtime-error, api-resilience]
dependency_graph:
  requires: []
  provides: [BUGFIX-EVENTCARD-RANK, BUGFIX-RECOMMENDATIONS-500]
  affects: [src/components/events/EventCard.tsx, src/app/api/recommendations/route.ts]
tech_stack:
  added: []
  patterns: [connection-failure-fallback, destructuring-correctness]
key_files:
  created: []
  modified:
    - src/components/events/EventCard.tsx
    - src/app/api/recommendations/route.ts
decisions:
  - "GET /api/recommendations returns fallback JSON (200) on connection error — matches existing !response.ok fallback behavior"
  - "POST /api/recommendations returns 503 on connection error — distinguishes service unavailability from generic 500"
  - "Outer try-catch blocks retained in both handlers for non-network errors (Supabase, JSON parse)"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-04T08:01:23Z"
  tasks_completed: 2
  files_modified: 2
---

# Quick Fix 1: Fix EventCard rank-not-defined Error and Recommendations 500 Summary

**One-liner:** Fixed EventCard ReferenceError from underscore-prefixed destructured props and added connection-failure try-catch to both GET and POST recommendations API handlers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix EventCard destructured prop names | 3212734 | src/components/events/EventCard.tsx |
| 2 | Add connection-failure fallback to recommendations API | b595214 | src/app/api/recommendations/route.ts |

## Changes Made

### Task 1: EventCard.tsx

In the function parameter destructuring block (lines 59-61), three props were renamed with underscore prefixes (`_rank`, `_showPopularityStats`, `_popularity`) indicating "unused", but the JSX at line 207 referenced the original names `rank` and `popularity`:

```tsx
// Before (broken)
rank: _rank,
showPopularityStats: _showPopularityStats,
popularity: _popularity,

// After (fixed)
rank,
showPopularityStats,
popularity,
```

This eliminated the `ReferenceError: rank is not defined` crash on EventCard render when these props are passed.

### Task 2: recommendations/route.ts

**POST handler:** Wrapped the `fetch()` call in an inner try-catch. On `TypeError` (connection refused), returns 503 with `{ error: "Recommendation service unavailable", fallback: true }` instead of propagating to the outer catch which returns a misleading 500.

**GET handler:** Wrapped the `fetch()` call in an inner try-catch. On connection failure, returns the same fallback JSON already used for `!response.ok` cases: `{ recommendations: [], total_events: 0, source: "popular_fallback", fallback: true }` with a 200 status.

In both handlers, the outer `catch` blocks are preserved for non-network errors (Supabase failures, JSON parse errors, etc.).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` produces no new errors in modified files (one pre-existing unrelated error in `src/app/api/events/export/route.ts` for `rsvp_count` property was present before these changes and is out of scope).
- EventCard.tsx destructured names (`rank`, `showPopularityStats`, `popularity`) now match all JSX references.
- Both recommendations API handlers return graceful responses when the recommendation service is unreachable.
