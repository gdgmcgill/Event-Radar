---
phase: 07-members-tab-invite-flow
plan: 02
subsystem: ui
tags: [react, client-component, club-members, invite-flow, dialog, clipboard, nextjs]

# Dependency graph
requires:
  - phase: 07-01
    provides: GET/DELETE /api/clubs/:id/members, POST /api/clubs/:id/invites API routes
  - phase: 06-dashboard-shell-read-only-tabs
    provides: ClubDashboard shell, tab structure, ClubEventsTab pattern
provides:
  - ClubMembersTab component — full member management UI
  - DELETE /api/clubs/:id/invites handler — invite revocation
  - userId prop thread from page.tsx through ClubDashboard to ClubMembersTab
affects:
  - 07-03-invite-acceptance-page (uses same /invites/:token pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useCallback + useEffect data fetching pattern (mirrors ClubEventsTab)
    - Dialog component for destructive action confirmation
    - navigator.clipboard.writeText with Check/Copy icon toggle for copy-link UX
    - Role-gated UI rendering (owner vs organizer view)
    - userId prop thread from server page through client dashboard to child component

key-files:
  created:
    - src/components/clubs/ClubMembersTab.tsx
  modified:
    - src/components/clubs/ClubDashboard.tsx
    - src/app/my-clubs/[id]/page.tsx
    - src/app/api/clubs/[id]/invites/route.ts

key-decisions:
  - "userId prop added to ClubDashboardProps — passed from server page (user.id from auth.getUser) through dashboard to ClubMembersTab for own-row Remove button suppression"
  - "Revocation uses status update ('revoked') not hard delete — preserves invitation history; mirrors plan decision from 07-01 migration"
  - "DELETE added to invites/route.ts (not a new file) since 07-02 depends_on 07-01 — sequential execution makes shared file safe"

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 7 Plan 02: Members Tab UI Summary

**ClubMembersTab client component with member list (role badges, joined dates), owner-gated Remove dialog, invite-by-email with copy-link, and pending invitations with revocation — wired into ClubDashboard replacing placeholder stub**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Created `ClubMembersTab.tsx` (389 lines) following the same useCallback+useEffect pattern as `ClubEventsTab`
- Member list: avatar placeholder (first-letter circle), display name or email fallback, role badge (Owner/Organizer with red highlight for owner), joined date
- Owner-only Remove button — hidden on own row and on the owner row — opens confirmation Dialog with Cancel/Remove (destructive)
- Owner-only Invite form: email input + Submit, generates link via `/invites/${token}` pattern, shows copy-able readonly Input with Copy/Check icon toggle using `navigator.clipboard.writeText`
- Owner-only Pending Invitations section (only shown when count > 0) with X revoke button per invite
- Loading, error (with retry), and empty states for member list
- Added `userId: string` prop to `ClubDashboardProps` — passed from server page `user.id` through `ClubDashboard` into `ClubMembersTab`
- Replaced "Members management coming soon" placeholder in `ClubDashboard` with `<ClubMembersTab>`
- Added `DELETE` export to `/api/clubs/[id]/invites/route.ts` — owner-only invite revocation via status update to `'revoked'`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ClubMembersTab component** - `0bfa33f` (feat)
2. **Task 2: Wire dashboard + add DELETE revocation handler** - `a462a29` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/clubs/ClubMembersTab.tsx` — Full members tab UI (member list, removal dialog, invite form, pending invites, revocation)
- `src/components/clubs/ClubDashboard.tsx` — Added userId prop; imported and rendered ClubMembersTab in members TabsContent
- `src/app/my-clubs/[id]/page.tsx` — Passed userId={user.id} to ClubDashboard
- `src/app/api/clubs/[id]/invites/route.ts` — Added DELETE handler for invite revocation (status update to 'revoked')

## Decisions Made

- userId flows from server page (`user.id` from `supabase.auth.getUser()`) to ClubDashboard prop to ClubMembersTab — avoids client-side auth call in the component itself.
- Revocation updates status to `'revoked'` instead of hard-delete — consistent with 07-01 migration policy (owner UPDATE policy on club_invitations).
- Touching `invites/route.ts` from 07-02 is safe because plan depends_on 07-01 guarantees sequential execution with no file ownership conflict.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/components/clubs/ClubMembersTab.tsx
- FOUND: src/components/clubs/ClubDashboard.tsx (import ClubMembersTab on line 11)
- FOUND: src/app/my-clubs/[id]/page.tsx (userId prop on line 71)
- FOUND: src/app/api/clubs/[id]/invites/route.ts (DELETE export on line 151)
- COMMIT 0bfa33f: feat(07-02): create ClubMembersTab
- COMMIT a462a29: feat(07-02): wire ClubMembersTab into dashboard and add invite revocation DELETE handler
- TypeScript: 0 errors in project files (pre-existing demo-video/src/index.ts error is out of scope)

---
*Phase: 07-members-tab-invite-flow*
*Completed: 2026-02-26*
