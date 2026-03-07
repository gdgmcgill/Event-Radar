---
phase: 02-event-management
plan: 01
subsystem: api, ui
tags: [supabase, swr, next.js, notifications, rsvp, shadcn/ui]

# Dependency graph
requires:
  - phase: 01-club-infrastructure
    provides: ClubDashboard tabs, club_members table, club_followers table, useClubs hooks
provides:
  - Club events API with organizer view (all statuses + RSVP counts)
  - ClubEventsTab component with event list and create button
  - Notification fanout to club followers on approved event creation
  - useClubEventsManagement SWR hook
  - Dynamic success message for auto-approved vs pending events
affects: [02-event-management, event-detail, notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget notification fanout, role-based API response shaping, dynamic success messaging]

key-files:
  created:
    - src/components/clubs/ClubEventsTab.tsx
  modified:
    - src/app/api/clubs/[id]/events/route.ts
    - src/app/api/events/create/route.ts
    - src/hooks/useClubs.ts
    - src/components/clubs/ClubDashboard.tsx
    - src/components/events/CreateEventForm.tsx

key-decisions:
  - "Fire-and-forget pattern for notification fanout (non-blocking, error-logged)"
  - "Same endpoint returns different data based on membership (organizer vs public)"

patterns-established:
  - "Role-based API response: same endpoint, different payloads based on auth context"
  - "Fire-and-forget async operations: wrap in async IIFE, catch and log errors"

requirements-completed: [EVNT-01, EVNT-02, EVNT-04, EVNT-05, EVNT-07]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 2 Plan 1: Event Listing & Creation Summary

**Club events API with organizer view (all statuses + RSVP counts), ClubEventsTab in dashboard, notification fanout to followers, and dynamic auto-approval success messaging**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T21:06:43Z
- **Completed:** 2026-03-05T21:09:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Club events API returns all statuses with RSVP counts for organizers, approved-only for public visitors
- ClubEventsTab component with event list (title, date, status badges, RSVP counts) and Create Event button
- Events tab visible in ClubDashboard for all club members (owners and organizers)
- Notification fanout inserts records for all club followers when an approved event is created
- Success message dynamically shows "Event Published!" for auto-approved events vs "Event Submitted!" for pending

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance club events API with organizer view, RSVP counts, notification fanout, and management hook** - `52b491b` (feat)
2. **Task 2: Create ClubEventsTab, wire into ClubDashboard, and fix auto-approval success message** - `5e40d1e` (feat)

## Files Created/Modified
- `src/app/api/clubs/[id]/events/route.ts` - Enhanced with auth check, all-status returns for organizers, RSVP count aggregation
- `src/app/api/events/create/route.ts` - Added notification fanout for approved events with club_id
- `src/hooks/useClubs.ts` - Added useClubEventsManagement hook with events, isOrganizer, mutate
- `src/components/clubs/ClubEventsTab.tsx` - New component: event list with status badges, RSVP counts, create button, empty state
- `src/components/clubs/ClubDashboard.tsx` - Added Events tab (visible to all organizers, not just owners)
- `src/components/events/CreateEventForm.tsx` - Dynamic success message based on API response, updated button text

## Decisions Made
- Fire-and-forget pattern for notification fanout: async IIFE that doesn't block the API response, errors caught and logged
- Same endpoint (`/api/clubs/[id]/events`) returns different data based on membership -- avoids need for a separate organizer endpoint
- RsvpRow interface defined locally since Supabase types don't have rsvps table FK join

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TS errors in `events/export/route.ts` and `docs/page.tsx` cause `npm run build` to fail -- these are documented in STATE.md as out of scope and not related to this plan's changes. TypeScript compilation of all modified files passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Events tab is functional in club dashboard, ready for event detail/edit features
- Notification fanout pattern established, can be extended for other notification types
- RSVP counts pattern available for reuse in event detail pages

---
*Phase: 02-event-management*
*Completed: 2026-03-05*
