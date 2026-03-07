---
phase: 01-club-infrastructure-and-team-management
plan: 02
subsystem: ui
tags: [next-app-router, supabase-ssr, follow, invite, server-components, optimistic-updates]

# Dependency graph
requires:
  - "01-01: Club API Foundation (API routes, SWR hooks, types, middleware)"
provides:
  - "Public club profile page at /clubs/[id] with SSR and SEO metadata"
  - "FollowButton client component with optimistic follow/unfollow"
  - "Invite acceptance page at /invites/[token] with full validation"
affects: [01-03, 02-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component with parallel Supabase queries via Promise.all for SSR"
    - "Client island pattern: server page with embedded client FollowButton"
    - "Optimistic state update with revert-on-error for follow toggle"
    - "Auth-gated redirect: guest users sent to /?signin=required&next=..."
    - "Auto-accept invite pattern: validate then insert+update in single page load"

key-files:
  created:
    - "src/components/clubs/FollowButton.tsx"
  modified:
    - "src/app/clubs/[id]/page.tsx"
    - "src/app/invites/[token]/page.tsx"

key-decisions:
  - "Used status field instead of accepted_at for invite acceptance (matches actual DB schema)"
  - "Direct Supabase queries in server component instead of fetching through API routes (better SSR performance)"
  - "Attached club info to events manually instead of FK join (Supabase types lack events-clubs relationship)"

patterns-established:
  - "Public page SSR pattern: parallel fetch club + followers + events + auth in Promise.all"
  - "Optimistic UI pattern: update state immediately, revert on fetch error"
  - "Invite validation cascade: auth -> token lookup -> expiry -> email match -> membership check"

requirements-completed: [CLUB-01, FLLW-01, FLLW-02, FLLW-03, TEAM-04]

# Metrics
duration: 10min
completed: 2026-03-05
---

# Phase 1 Plan 2: Public Club Pages & Invite Acceptance Summary

**SSR club profile page with optimistic follow/unfollow and server-side invite acceptance with 4-step validation cascade**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-05T20:23:08Z
- **Completed:** 2026-03-05T20:33:08Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 3

## Accomplishments
- Built server-rendered public club page at /clubs/[id] with parallel data fetching, SEO metadata, McGill branding, and responsive layout
- Created FollowButton client component with optimistic updates, auth-gated redirect for guests, and visual feedback (filled heart + count)
- Built invite acceptance page with 4-step validation (token, expiry, email match, existing membership) and auto-accept on valid invite

## Task Commits

Each task was committed atomically:

1. **Task 1: Public club page + FollowButton component** - `7aa2b20` (feat)
2. **Task 2: Invite acceptance page** - `9958e4a` (feat)
3. **Task 3: Verify public club page and invite flow** - checkpoint:human-verify (approved)

## Files Created/Modified
- `src/app/clubs/[id]/page.tsx` - Server-rendered public club profile with logo, info, events grid, follow button, SEO metadata
- `src/components/clubs/FollowButton.tsx` - Client component for follow/unfollow with optimistic state and auth redirect
- `src/app/invites/[token]/page.tsx` - Invite acceptance with validation cascade, auto-accept, success/error views

## Decisions Made
- Used `status` field (pending/accepted) instead of `accepted_at` timestamp for invite acceptance -- matches actual Supabase schema which has `status` column, not `accepted_at`
- Direct Supabase server queries in page component instead of calling API routes -- avoids unnecessary HTTP round-trip for SSR
- Manual club info attachment to events instead of FK join -- Supabase generated types don't define the events-to-clubs relationship

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used status column instead of accepted_at for invite tracking**
- **Found during:** Task 2 (Invite acceptance page)
- **Issue:** Plan specified `accepted_at` column but Supabase schema uses `status` field (pending/accepted)
- **Fix:** Changed invite lookup to filter `status = 'pending'` and acceptance to set `status = 'accepted'`
- **Files modified:** src/app/invites/[token]/page.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 9958e4a (Task 2 commit)

**2. [Rule 1 - Bug] Removed FK join for events query to fix type error**
- **Found during:** Task 1 (Public club page)
- **Issue:** `select("*, club:clubs(id, name, logo_url)")` produced SelectQueryError type because Supabase types lack events-clubs relationship
- **Fix:** Query events with `select("*")` and manually attach club info from already-fetched club data
- **Files modified:** src/app/clubs/[id]/page.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 7aa2b20 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for TypeScript strict mode compliance. No scope creep.

## Issues Encountered
- Two pre-existing TypeScript errors in unrelated files (events/export/route.ts and docs/page.tsx) -- not caused by this plan's changes, not in scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Public club page ready for student-facing use
- FollowButton pattern available for reuse in other contexts
- Invite flow complete end-to-end (creation in 01-01 API, acceptance in 01-02 UI)
- Club profile serves as landing page for organizer management pages (01-03)

## Self-Check: PASSED

All 3 key files verified present. All 2 task commits verified in git log. Line counts meet minimums (page: 195, FollowButton: 81, invite: 202).

---
*Phase: 01-club-infrastructure-and-team-management*
*Completed: 2026-03-05*
