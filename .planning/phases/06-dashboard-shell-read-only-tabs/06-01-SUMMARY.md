---
phase: 06-dashboard-shell-read-only-tabs
plan: 01
subsystem: ui
tags: [next.js, shadcn, radix-ui, tabs, supabase, server-component, client-component, url-state]

# Dependency graph
requires:
  - phase: 05-database-foundation
    provides: club_members table with owner/organizer roles, club_invitations table
  - phase: 01-notification-db
    provides: Supabase client patterns (server.ts, types.ts)
provides:
  - /my-clubs/[id] server component page with role resolution
  - ClubDashboard client shell with 4-tab navigation and URL-param state
  - ClubOverviewTab showing club info, member count, and owner-only pending invites
  - shadcn Tabs component (src/components/ui/tabs.tsx)
affects: [06-02, 06-03, 07-members, 08-settings]

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-tabs ^1.1.x (via shadcn)"
    - "shadcn Tabs component (src/components/ui/tabs.tsx)"
  patterns:
    - "Server component page resolves auth + role in parallel queries, passes as props to client shell"
    - "useSearchParams + router.replace for URL-param tab state with Suspense boundary"
    - "VALID_TABS const array for tab value validation and TypeScript narrowing"
    - "Conditional owner-only UI: pendingInvitesCount passed as null for organizers"

key-files:
  created:
    - src/components/ui/tabs.tsx
    - src/app/my-clubs/[id]/page.tsx
    - src/components/clubs/ClubDashboard.tsx
    - src/components/clubs/ClubOverviewTab.tsx
  modified:
    - src/lib/supabase/types.ts (added club_invitations table type)
    - package.json / package-lock.json (@radix-ui/react-tabs dependency)

key-decisions:
  - "Member count fetched server-side in page.tsx Promise.all to avoid client-side waterfall"
  - "Pending invites fetched server-side only when role === owner; passed as null to organizers (avoids RLS exposure)"
  - "Tab state uses router.replace (not push) to avoid polluting browser history stack on each tab click"
  - "Added club_invitations to supabase/types.ts since Phase 5 migration created table but types were not updated"

patterns-established:
  - "ClubDashboard pattern: server page resolves data, client shell handles interactivity"
  - "URL tab state pattern: useSearchParams + VALID_TABS validation + router.replace"
  - "Suspense wrapper pattern for useSearchParams callers (matches existing src/app/page.tsx pattern)"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 6 Plan 01: Dashboard Shell + Overview Tab Summary

**shadcn Tabs-based club dashboard shell at /my-clubs/[id] with server-side role resolution, URL-param tab state, and Overview tab showing club info plus owner-only pending invites count**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T03:52:21Z
- **Completed:** 2026-02-26T03:56:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created server component page that resolves club, membership role, member count, and pending invites in parallel Supabase queries — non-members get notFound() 404
- Built client dashboard shell with 4 tabs (Overview, Events stub, Members stub, Settings stub), URL-param state via useSearchParams + router.replace, and Suspense boundary
- Implemented Overview tab with club info card, stats grid (members, pending invites owner-only, club status with color-coded icons)

## Task Commits

1. **Task 1: Install shadcn Tabs, create server page and client dashboard shell** - `4248642` (feat)
2. **Task 2: Create Overview tab component** - `faddf19` (feat)

## Files Created/Modified

- `src/components/ui/tabs.tsx` - shadcn Tabs component wrapping @radix-ui/react-tabs
- `src/app/my-clubs/[id]/page.tsx` - Server component: resolves club + role + memberCount + pendingInvitesCount, renders ClubDashboard
- `src/components/clubs/ClubDashboard.tsx` - Client shell: 4-tab navigation with URL-param state (useSearchParams + router.replace) and Suspense boundary
- `src/components/clubs/ClubOverviewTab.tsx` - Overview tab: club info card + stats grid with conditional owner-only pending invites
- `src/lib/supabase/types.ts` - Added club_invitations table type (was missing from Phase 5 migration)
- `package.json` / `package-lock.json` - Added @radix-ui/react-tabs dependency

## Decisions Made

- Member count and pending invites fetched server-side (in page.tsx Promise.all) to avoid client-side data waterfalls
- Pending invites fetched only when `role === "owner"` and passed as `null` for organizers — prevents RLS exposure and keeps Overview clean
- Used `router.replace` (not `push`) for tab changes to avoid polluting the browser history stack
- Added `club_invitations` type to `supabase/types.ts` — Phase 5 migration created this table but the local types file was not updated, causing TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added club_invitations to Supabase type definitions**
- **Found during:** Task 1 (server page creation)
- **Issue:** Phase 5 migration created `club_invitations` table in Supabase but `src/lib/supabase/types.ts` was not updated, causing TypeScript error: "Argument of type 'club_invitations' is not assignable to parameter of type '...'"
- **Fix:** Added `club_invitations` Row/Insert/Update/Relationships type to the Database type in `src/lib/supabase/types.ts`
- **Files modified:** `src/lib/supabase/types.ts`
- **Verification:** `npx tsc --noEmit` shows zero errors in `src/` files
- **Committed in:** `4248642` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical type definition)
**Impact on plan:** Auto-fix was required for TypeScript correctness. No scope creep — type definition matches the table schema created in Phase 5.

## Issues Encountered

Pre-existing build failures in `demo-video/src/index.ts` and `.next/types/validator.ts` exist before this plan and are out of scope. All `src/` files compile cleanly with zero TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/my-clubs/[id]` dashboard shell is fully functional — club links from My Clubs list now navigate to a real page
- Events tab stub ready to be replaced with ClubEventsTab in Plan 02
- Members and Settings tabs are placeholder stubs for Phase 7 and Phase 8
- Overview tab is read-only and complete for Phase 6 scope

---
*Phase: 06-dashboard-shell-read-only-tabs*
*Completed: 2026-02-26*
