---
phase: 01-club-infrastructure-and-team-management
plan: 01
subsystem: api
tags: [supabase, rls, swr, next-api-routes, club-management, team-invites, follow]

# Dependency graph
requires: []
provides:
  - "All club CRUD API routes (GET/PATCH /api/clubs/[id])"
  - "Club events listing (GET /api/clubs/[id]/events)"
  - "Follow/unfollow system (GET/POST/DELETE /api/clubs/[id]/follow)"
  - "My-clubs endpoint with role and member counts (GET /api/my-clubs)"
  - "Members list and removal (GET/DELETE /api/clubs/[id]/members)"
  - "Invitation creation with McGill email validation (POST /api/clubs/[id]/invites)"
  - "Logo upload with ownership verification (POST /api/clubs/logo)"
  - "SWR hooks for all club data fetching (useClub, useClubEvents, useClubMembers, useMyClubs, useFollowStatus)"
  - "RLS owner-only UPDATE policy on clubs table"
  - "ClubInvitation and ClubFollower TypeScript types"
  - "Middleware protection for /my-clubs and /invites routes"
affects: [01-02, 01-03, 02-01, 02-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async params destructuring for Next.js 16 routes: const { id } = await params"
    - "Owner verification pattern: check club_members for role=owner before mutation"
    - "Upsert with ignoreDuplicates for idempotent follow operations"
    - "Parallel count fetching with Promise.all for member/follower stats"
    - "Separate user lookup for member details (no FK join on club_members->users)"

key-files:
  created:
    - "supabase/migrations/20260305000001_phase1_club_rls_and_schema.sql"
    - "src/app/api/clubs/[id]/route.ts"
    - "src/app/api/clubs/[id]/events/route.ts"
    - "src/app/api/clubs/[id]/follow/route.ts"
    - "src/app/api/clubs/[id]/members/route.ts"
    - "src/app/api/clubs/[id]/invites/route.ts"
    - "src/app/api/clubs/logo/route.ts"
    - "src/app/api/my-clubs/route.ts"
    - "src/hooks/useClubs.ts"
  modified:
    - "src/types/index.ts"
    - "src/middleware.ts"

key-decisions:
  - "Separate user query for member details instead of FK join (Supabase generated types lack the relationship)"
  - "Live COUNT queries for follower/member counts instead of denormalized columns (simpler, avoids trigger complexity)"
  - "Idempotent migration using IF NOT EXISTS and DO $$ blocks for safe re-runs"

patterns-established:
  - "API route auth pattern: getUser() -> check membership -> perform action -> generic error messages"
  - "Owner-only mutation pattern: verify club_members.role=owner before any write operation"
  - "SWR conditional fetching: pass null key when clubId is falsy to skip fetch"

requirements-completed: [CLUB-01, CLUB-02, CLUB-03, TEAM-01, TEAM-02, TEAM-03, TEAM-04, FLLW-01, FLLW-02, FLLW-03]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 1 Plan 1: Club API Foundation Summary

**Complete club API layer with 8 route files, RLS owner-update migration, SWR hooks, and middleware route protection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T09:45:24Z
- **Completed:** 2026-03-05T09:49:51Z
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments
- Tore down all 6 legacy club components and rebuilt API routes from scratch
- Built 8 API route files covering club CRUD, follow/unfollow, members, invites, logo upload, and my-clubs
- Created RLS migration replacing permissive club UPDATE with owner-only policy, added club_members.created_at and self-insertion policy
- Added SWR hooks (useClub, useClubEvents, useClubMembers, useMyClubs, useFollowStatus) for client-side data fetching
- Updated types with ClubInvitation and ClubFollower interfaces
- Protected /my-clubs and /invites routes in middleware

## Task Commits

Each task was committed atomically:

1. **Task 1: Teardown old code + DB migration + types update + middleware** - `3c6a690` (feat)
2. **Task 2: Rebuild all club and follow API routes** - `b4a3440` (feat)
3. **Task 3: Rebuild team API routes + SWR hooks** - `2435d33` (feat)

## Files Created/Modified
- `supabase/migrations/20260305000001_phase1_club_rls_and_schema.sql` - Owner-only UPDATE RLS, created_at column, self-insert policy
- `src/app/api/clubs/[id]/route.ts` - GET club detail with follower count, PATCH for owner updates
- `src/app/api/clubs/[id]/events/route.ts` - GET approved events for a club
- `src/app/api/clubs/[id]/follow/route.ts` - GET/POST/DELETE follow status and toggle
- `src/app/api/clubs/[id]/members/route.ts` - GET members with user details, DELETE to remove organizer
- `src/app/api/clubs/[id]/invites/route.ts` - POST invite with McGill email validation and duplicate checks
- `src/app/api/clubs/logo/route.ts` - POST logo upload with type/size validation and ownership check
- `src/app/api/clubs/route.ts` - GET all approved clubs
- `src/app/api/my-clubs/route.ts` - GET user's clubs with role and member count
- `src/hooks/useClubs.ts` - SWR hooks for all club endpoints
- `src/types/index.ts` - Added ClubInvitation and ClubFollower types
- `src/middleware.ts` - Added /my-clubs and /invites to PROTECTED_ROUTES
- `src/app/clubs/[id]/page.tsx` - Placeholder stub
- `src/app/clubs/create/page.tsx` - Placeholder stub
- `src/app/clubs/page.tsx` - Placeholder stub (clubs directory)
- `src/app/my-clubs/page.tsx` - Placeholder stub
- `src/app/my-clubs/[id]/page.tsx` - Placeholder stub
- `src/app/my-clubs/layout.tsx` - Passthrough layout
- `src/app/invites/[token]/page.tsx` - Placeholder stub

## Decisions Made
- Used separate user query for member details instead of FK join (Supabase generated types lack the club_members->users relationship definition)
- Used live COUNT queries for follower/member counts instead of denormalized columns (avoids trigger complexity at this stage)
- Idempotent migration using IF NOT EXISTS and DO $$ blocks for safe re-runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Two pre-existing TypeScript errors exist in unrelated files (events/export/route.ts and docs/page.tsx) -- not caused by this plan's changes, not in scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All API routes ready for frontend consumption in plans 01-02 and 01-03
- SWR hooks provide typed data fetching layer for all club UI components
- Placeholder pages ready to be replaced with full implementations
- RLS policies secure club mutations at the database level

## Self-Check: PASSED

All 11 key files verified present. All 3 task commits verified in git log.

---
*Phase: 01-club-infrastructure-and-team-management*
*Completed: 2026-03-05*
