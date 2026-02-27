---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Club Organizer UX Overhaul
status: unknown
last_updated: "2026-02-27T05:33:00Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 16
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Club organizers must have a seamless, unified experience from club creation through event management
**Current focus:** Phase 9 — Follow System

## Current Position

Phase: 9 of 9 (Follow System) — In Progress
Plan: 1 of 2 complete
Status: Plan 01 Complete
Last activity: 2026-02-27 — Completed 09-01: club_followers migration, TypeScript types, follow/unfollow API routes, follower count in club API

Progress: [################....] 75%
(v1.0 Phases 1-3 complete, Phase 4 deferred; v1.1 Phases 5-7 complete, Phase 8 pending; Phase 9 Plan 1 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v1.0)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Notification DB | 2 | — | — |
| 2. Cold Start Fix | 2 | — | — |
| 3. Notification Wiring | 2 | — | — |
| 5. Database Foundation | 2 | ~13min | ~6.5min |
| 6. Dashboard Shell | 3/3 | ~6min | ~2min |
| 7. Members Tab | 3/3 | ~13min | ~4min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v1.0]: 3+ saved events threshold for recommendations
- [v1.0]: Supabase Edge Function for reminder cron
- [v1.0]: Notification polling every 60s for bell updates
- [v1.1]: Auto-grant owner (not organizer) on club approval
- [v1.1]: Owner/organizer role distinction in club_members table
- [v1.1]: Direct invitations from owners — no admin approval needed
- [v1.1]: Copy-link invite UX for v1.1; email delivery deferred to v1.2
- [v1.1]: is_club_owner() SECURITY DEFINER pattern — prevents RLS infinite recursion
- [v1.1 05-01]: Backfill runs before CHECK constraint to normalize existing organizer rows for creators
- [v1.1 05-01]: Self-removal guard uses (select auth.uid()) wrapper for PostgreSQL initPlan caching
- [v1.1 05-01]: No invitee-access SELECT policy on club_invitations — deferred to Phase 7
- [v1.1 06-01]: Member count and pending invites fetched server-side in page.tsx to avoid client-side waterfall
- [v1.1 06-01]: Pending invites passed as null for organizers — prevents RLS exposure, keeps Overview clean
- [v1.1 06-01]: router.replace (not push) for tab changes — avoids polluting browser history stack
- [v1.1 06-01]: club_invitations added to supabase/types.ts (Phase 5 table was missing from local types)
- [v1.1 06-02]: useCallback wrapping fetchEvents so retry button and useEffect share same fetcher without re-creation
- [v1.1 06-02]: Suspense wraps CreateEventPageContent (useSearchParams caller) — required by Next.js App Router
- [v1.1 06-02]: Badge className override for status colors (green/amber) rather than new variants on shared component
- [v1.1 06-03]: transformEventFromDB cast pattern (event as Parameters<typeof transformEventFromDB>[0]) bridges Supabase row type to DBEvent — all event API routes must use this pattern
- [v1.1 07-01]: POST /invites returns token only — URL construction is client-side, avoids hardcoding domain in API
- [v1.1 07-01]: Invitee SELECT policy uses email sub-select from users table (consistent with Phase 5 RLS patterns)
- [v1.1 07-01]: Owner revoke UPDATE policy added to invitee migration (MEM-08) — all club_invitations UPDATE policies co-located
- [v1.1 07-02]: userId prop threads from server page (user.id from auth.getUser) through ClubDashboard to ClubMembersTab — avoids client-side auth call in component
- [v1.1 07-02]: Invite revocation uses status update ('revoked') not hard delete — preserves invitation history
- [v1.1 07-03]: RLS handles email match implicitly on invite lookup — query returns null for mismatched email, no explicit app-layer email comparison needed
- [v1.1 07-03]: Success page shown (not immediate redirect) on invite acceptance — user sees "You're in!" confirmation
- [v1.1 07-03]: Existing member silently redirects to club dashboard — idempotent, not an error condition
- [v1.1 09-01]: Public SELECT RLS policy on club_followers enables anonymous follower count without app-layer auth checks
- [v1.1 09-01]: Upsert with ignoreDuplicates makes follow idempotent — no prior check query needed
- [v1.1 09-01]: GET /api/clubs/[id]/follow returns { is_following: false, is_member: false } for unauthenticated (not 401)
- [v1.1 09-01]: Promise.all refactor in club API reduces sequential round-trips (3 parallel queries)

### Pending Todos

- Phase 4 from v1.0 (Cron Scheduler Configuration) deferred to v1.2

### Blockers/Concerns

- Phase 5: is_club_owner() deployed with SECURITY DEFINER — verified callable in production, returns false without auth context (expected behavior)
- Phase 8: clubs UPDATE is locked by 011_rls_audit.sql — owner UPDATE policy required before settings tab works

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 09-01-PLAN.md — club_followers backend (migration, types, follow API routes, follower count); Phase 9 Plan 01 complete.
Resume file: None
