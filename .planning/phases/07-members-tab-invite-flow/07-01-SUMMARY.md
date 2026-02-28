---
phase: 07-members-tab-invite-flow
plan: 01
subsystem: api
tags: [supabase, rls, club-members, invitations, nextjs, api-routes]

# Dependency graph
requires:
  - phase: 05-database-foundation
    provides: club_members table, club_invitations table, is_club_owner() function, RLS policies
  - phase: 06-dashboard-shell-read-only-tabs
    provides: established API route patterns, RouteParams interface, createClient server pattern
provides:
  - GET /api/clubs/:id/members — returns members with user info, pending invites for owners
  - DELETE /api/clubs/:id/members — owner-only member removal with self-removal guard
  - POST /api/clubs/:id/invites — owner-only invite creation with McGill email validation
  - Invitee RLS SELECT/UPDATE policies on club_invitations
  - Corrected club_invitations TypeScript type (inviter_id, no role, no updated_at)
affects:
  - 07-02-members-tab-ui
  - 07-03-invite-acceptance-page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RouteParams interface pattern (params: Promise<{ id: string }>) for Next.js App Router dynamic routes
    - Membership check before data access (club_members join as auth gate)
    - Role-conditional data (owners get pending invites, organizers do not)
    - Server-side email normalization (toLowerCase before insert/query)

key-files:
  created:
    - src/app/api/clubs/[id]/members/route.ts
    - src/app/api/clubs/[id]/invites/route.ts
    - supabase/migrations/20260226000001_invitee_select_update_policy.sql
  modified:
    - src/lib/supabase/types.ts

key-decisions:
  - "Return token only from POST /invites — URL construction is client-side, avoids hardcoding domain in API"
  - "Invitee SELECT policy uses email sub-select from users table (consistent with Phase 5 RLS patterns)"
  - "Owner revoke UPDATE policy added to migration (MEM-08) since it belongs with invitee policies"

patterns-established:
  - "Club membership check pattern: select role from club_members where user_id + club_id, check single()"
  - "Self-removal guard: explicit JS check before DB delete for better error message UX"
  - "Email normalization: always toLowerCase() before DB insert or query"

requirements-completed: [MEM-01, MEM-03, MEM-05]

# Metrics
duration: 8min
completed: 2026-02-26
---

# Phase 7 Plan 01: Members Backend API Summary

**Three club membership API routes (GET/DELETE members, POST invite) plus invitee RLS policies and corrected TypeScript types for club_invitations**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-26T04:53:45Z
- **Completed:** 2026-02-26T05:01:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Fixed club_invitations TypeScript type to match actual DB schema (inviter_id, no role, no updated_at)
- Created invitee SELECT/UPDATE RLS policies so invitation acceptance page can read and update invite rows
- Implemented GET /api/clubs/:id/members with role-conditional response (owners see all members + pending invites, organizers see only themselves per RLS)
- Implemented DELETE /api/clubs/:id/members with owner-only guard and explicit self-removal protection
- Implemented POST /api/clubs/:id/invites with full validation chain (owner check, McGill email, account exists, not already member, no duplicate pending invite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix types.ts schema mismatch and write invitee RLS migration** - `5359f98` (fix)
2. **Task 2: Create GET and DELETE /api/clubs/[id]/members routes** - `9a0a3d9` (feat)
3. **Task 3: Create POST /api/clubs/[id]/invites route** - `9fcbe97` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/supabase/types.ts` - Corrected club_invitations type: invited_by -> inviter_id, removed role and updated_at columns, fixed expires_at nullability
- `supabase/migrations/20260226000001_invitee_select_update_policy.sql` - 3 RLS policies: invitee SELECT, invitee UPDATE (accept), owner UPDATE (revoke)
- `src/app/api/clubs/[id]/members/route.ts` - GET (member list with user info) + DELETE (owner-only member removal)
- `src/app/api/clubs/[id]/invites/route.ts` - POST (invite creation with McGill email validation, duplicate checks, token return)

## Decisions Made
- Return only `token` from POST /invites — not a full URL. Client-side URL construction avoids hardcoding domain in the API layer.
- Added MEM-08 owner-revoke UPDATE policy to this migration since it logically belongs with invitee policies (all club_invitations UPDATE policies in one place).
- Used email sub-select pattern `(SELECT email FROM public.users WHERE id = (SELECT auth.uid()))` consistent with Phase 5 RLS patterns.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `demo-video/src/index.ts` — out of scope, not caused by our changes.

## User Setup Required
None - no external service configuration required. Migration file must be applied to Supabase (standard deployment step).

## Next Phase Readiness
- All three API endpoints ready for 07-02 (Members tab UI) and 07-03 (invite acceptance page)
- Invitee RLS policies deployed — acceptance page can read invite rows by email match
- types.ts corrected — no stale type errors in downstream consumers
- Blockers: None

## Self-Check: PASSED

- FOUND: src/lib/supabase/types.ts
- FOUND: supabase/migrations/20260226000001_invitee_select_update_policy.sql
- FOUND: src/app/api/clubs/[id]/members/route.ts
- FOUND: src/app/api/clubs/[id]/invites/route.ts
- FOUND: .planning/phases/07-members-tab-invite-flow/07-01-SUMMARY.md
- COMMIT 5359f98: fix(07-01): correct club_invitations type and add invitee RLS migration
- COMMIT 9a0a3d9: feat(07-01): add GET and DELETE /api/clubs/:id/members routes
- COMMIT 9fcbe97: feat(07-01): add POST /api/clubs/:id/invites route

---
*Phase: 07-members-tab-invite-flow*
*Completed: 2026-02-26*
