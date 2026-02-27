---
phase: 07-members-tab-invite-flow
plan: 03
subsystem: ui
tags: [nextjs, supabase, rls, server-component, invitations, club-members]

# Dependency graph
requires:
  - phase: 07-members-tab-invite-flow
    plan: 01
    provides: club_invitations table, invitee RLS SELECT/UPDATE policies, club_members insert capability
provides:
  - /invites/[token] server component page — invite acceptance flow with full validation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RLS-implicit email verification: query returns null if email doesn't match (no explicit email check needed)
    - Server component invite flow: all DB operations server-side, no client JS required
    - Already-a-member guard before insert to prevent duplicate key errors

key-files:
  created:
    - src/app/invites/[token]/page.tsx
  modified: []

key-decisions:
  - "RLS handles email match implicitly — no need to compare user.email to invite.invitee_email in code; query returns null if RLS filters it out"
  - "Success page shown instead of immediate redirect — user sees 'You're in!' confirmation before navigating to dashboard"
  - "next=/invites/:token preserved in unauthenticated redirect — user lands back on acceptance page after sign-in"
  - "Existing member silently redirects to dashboard — not an error condition, idempotent flow"

patterns-established:
  - "Invite acceptance pattern: lookup by token (RLS does email check) -> validate status -> validate expiry -> check existing member -> insert -> mark accepted -> show success"

requirements-completed: [MEM-06]

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 7 Plan 03: Invite Acceptance Page Summary

**Server-side /invites/[token] page that validates token, enforces email match via RLS, inserts user as organizer, and shows success confirmation before redirecting to club dashboard**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-26T04:59:00Z
- **Completed:** 2026-02-26T05:04:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `/invites/[token]` as a pure server component with no client-side JavaScript
- All 5 error states handled: invalid/mismatched token, already accepted, revoked, expired, insert failure
- Unauthenticated users redirected to `/?next=/invites/:token` preserving invite link for post-login return
- Valid invite flow: inserts user as organizer in `club_members`, marks invitation `accepted`, shows "You're in!" page
- RLS on `club_invitations` implicitly verifies email match — no duplicate email check in app code

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /invites/[token] server component page with full acceptance flow** - `7fa933c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/invites/[token]/page.tsx` - Server component with 10-step validation and acceptance flow; inline `InviteErrorPage` helper component for consistent error UI

## Decisions Made
- RLS on `club_invitations` uses `WHERE email = (SELECT email FROM users WHERE id = auth.uid())` — this means the query silently returns null for mismatched emails, making the "not found" error message cover both invalid tokens and email mismatches. This is intentional and correct.
- Success page (not immediate redirect) — gives the user a moment to see they've been successfully added before navigating away.
- Idempotent already-a-member handling — silent redirect rather than error, since the desired end-state (being a member) is already achieved.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `demo-video/src/index.ts` — out of scope, pre-existing, not caused by this plan's changes.

## User Setup Required
None - no external service configuration required. The invitee RLS policies required by this page were deployed in Plan 07-01.

## Next Phase Readiness
- Invite acceptance flow complete — full invitation lifecycle is now functional: owner creates invite (07-01 API) -> organizer copies link (07-02 UI) -> invitee opens link and accepts (07-03)
- Phase 7 is complete (3/3 plans done)
- Phase 8 (club settings/edit) can proceed — no blockers from this plan

## Self-Check: PASSED

- FOUND: src/app/invites/[token]/page.tsx
- COMMIT 7fa933c: feat(07-03): add /invites/[token] invite acceptance server component

---
*Phase: 07-members-tab-invite-flow*
*Completed: 2026-02-26*
