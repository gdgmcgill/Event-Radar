---
phase: 06-dashboard-shell-read-only-tabs
plan: 02
subsystem: ui
tags: [next.js, react, client-component, fetch, supabase, url-params, suspense, useSearchParams]

# Dependency graph
requires:
  - phase: 06-01
    provides: ClubDashboard shell with Events tab stub, /my-clubs/[id] server page
  - phase: 05-database-foundation
    provides: /api/clubs/[id]/events route returning Event[]
provides:
  - ClubEventsTab component with fetch, loading/error/empty states, and status badge rendering
  - Events tab wired into ClubDashboard (stub replaced)
  - create-event page reads ?clubId= URL param and passes to CreateEventForm
affects: [06-03, 07-members]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCallback wrapping fetch function so retry button and useEffect share the same fetcher"
    - "useSearchParams + Suspense boundary for URL param reading in Next.js App Router client pages"
    - "Conditional Badge variant with className override for status colors (approved=green, pending=amber, rejected=destructive)"

key-files:
  created:
    - src/components/clubs/ClubEventsTab.tsx
  modified:
    - src/components/clubs/ClubDashboard.tsx
    - src/app/create-event/page.tsx

key-decisions:
  - "useCallback for fetchEvents so both useEffect and the retry button call the same extracted function"
  - "Suspense wraps CreateEventPageContent (which calls useSearchParams) — required by Next.js App Router rules"
  - "Badge className override (bg-green-100 / bg-amber-100) used instead of new variants — avoids touching the shared Badge component"

patterns-established:
  - "ClubEventsTab pattern: fetch on mount via useCallback, loading/error/empty/list states with retry support"
  - "URL param pre-fill pattern: useSearchParams().get() ?? undefined passed as optional prop to form components"

requirements-completed: [DASH-05, DASH-06]

# Metrics
duration: 1min
completed: 2026-02-26
---

# Phase 6 Plan 02: Events Tab + Create Event clubId Pre-fill Summary

**ClubEventsTab component with fetch/loading/error/empty/list states wired into the dashboard shell; create-event page updated to read ?clubId= from URL and pre-fill the club association in CreateEventForm**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-26T04:01:31Z
- **Completed:** 2026-02-26T04:02:51Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Created `ClubEventsTab` client component that fetches `GET /api/clubs/${clubId}/events`, shows a spinner while loading, an error message with retry button on failure, an empty-state illustration when no events exist, and a list of event rows with title link, formatted date/time, location, and status badge (green=approved, amber=pending, red=rejected)
- Replaced the Events tab stub in `ClubDashboard.tsx` with `<ClubEventsTab clubId={club.id} />` — stub text "Events tab content will appear here" is gone
- Updated `create-event/page.tsx` to extract inner `CreateEventPageContent` component that reads `?clubId=` via `useSearchParams`, passes `clubId` as prop to `CreateEventForm`, and wraps the whole page in a `Suspense` boundary as required by Next.js App Router

## Task Commits

1. **Task 1: Create ClubEventsTab, wire into dashboard, update create-event for clubId pre-fill** - `78c71e5` (feat)

## Files Created/Modified

- `src/components/clubs/ClubEventsTab.tsx` - New client component: fetch events from API, loading/error/empty/list states, status badges with Tailwind color overrides, Create Event link with clubId param
- `src/components/clubs/ClubDashboard.tsx` - Added ClubEventsTab import; replaced Events stub with `<ClubEventsTab clubId={club.id} />`
- `src/app/create-event/page.tsx` - Extracted CreateEventPageContent, added useSearchParams to read ?clubId=, passes clubId to CreateEventForm, wrapped in Suspense

## Decisions Made

- Used `useCallback` to extract `fetchEvents` so both the `useEffect` (on mount) and the retry button call the same function without re-creating it
- Wrapped `CreateEventPageContent` in `Suspense` at the top-level default export — required by Next.js App Router for any component that calls `useSearchParams`
- Used Tailwind `className` overrides on Badge (`bg-green-100 text-green-800`) for status colors rather than adding new variants to the shared Badge component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing build failure in `demo-video/src/index.ts` (Remotion React type mismatch) was present before this plan and is out of scope. All `src/` project files compile cleanly with zero TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Events tab is fully functional — organizers can see their club's events with status badges
- "Create Event" button in Events tab pre-fills club association via `?clubId=` URL param
- Members and Settings tabs remain stubs, ready for Phase 7 and Phase 8

## Self-Check: PASSED

All files confirmed present:
- FOUND: src/components/clubs/ClubEventsTab.tsx
- FOUND: src/components/clubs/ClubDashboard.tsx (modified)
- FOUND: src/app/create-event/page.tsx (modified)
- FOUND: .planning/phases/06-dashboard-shell-read-only-tabs/06-02-SUMMARY.md

All commits confirmed:
- FOUND: 78c71e5 feat(06-02): create ClubEventsTab, wire into dashboard, update create-event for clubId pre-fill

---
*Phase: 06-dashboard-shell-read-only-tabs*
*Completed: 2026-02-26*
