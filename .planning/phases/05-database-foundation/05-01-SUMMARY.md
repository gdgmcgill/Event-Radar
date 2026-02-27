---
phase: 05-database-foundation
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, security-definer, migrations, club-roles]

# Dependency graph
requires:
  - phase: 09_user_roles migration
    provides: club_members table with organizer role and existing RLS policies
  - phase: 011_rls_audit migration
    provides: is_admin() SECURITY DEFINER pattern to mirror

provides:
  - club_members CHECK constraint (owner | organizer roles only)
  - is_club_owner(p_club_id) SECURITY DEFINER function
  - Owner cross-row SELECT policy on club_members
  - Owner DELETE policy with self-removal guard on club_members
  - Composite index on club_members(club_id, role)
  - club_invitations table with RLS (SELECT/INSERT for owners)
  - Backfill of existing club creators to role='owner'

affects:
  - 05-database-foundation plan 02+ (invite flow, member management)
  - Phase 6 (club member UI — depends on is_club_owner() for gating)
  - Phase 8 (club settings — owner UPDATE policy depends on this function)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER function pattern for RLS permission checks (mirrors is_admin())"
    - "DROP POLICY IF EXISTS before CREATE POLICY for idempotent migrations"
    - "DO block with information_schema check for idempotent ALTER TABLE ADD CONSTRAINT"
    - "(select auth.uid()) wrapper in policy USING clauses for initPlan caching"

key-files:
  created:
    - supabase/migrations/20260225000001_club_roles_and_invitations.sql
  modified:
    - src/app/api/admin/clubs/[id]/route.ts

key-decisions:
  - "Backfill runs BEFORE CHECK constraint to normalize existing 'organizer' rows for club creators before validation fires"
  - "is_club_owner() uses LANGUAGE sql (not plpgsql) to match is_admin() pattern and avoid unnecessary overhead"
  - "Self-removal guard uses (select auth.uid()) wrapper for PostgreSQL initPlan optimization"
  - "No invitee-access SELECT policy on club_invitations — deferred to Phase 7"

patterns-established:
  - "SECURITY DEFINER function pattern: LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public"
  - "Idempotent constraint addition: DO block checking information_schema.table_constraints"

requirements-completed: [DBROLE-01, DBROLE-02, DBROLE-03, DBROLE-04, DBROLE-05, DBROLE-06, DBROLE-07]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 5 Plan 01: Club Roles and Invitations Database Foundation Summary

**Atomic migration adding owner/organizer role constraint, is_club_owner() SECURITY DEFINER function, owner-scoped RLS policies, composite index, and club_invitations table — plus admin route patched to grant 'owner' on approval**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-26T03:00:40Z
- **Completed:** 2026-02-26T03:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created complete idempotent migration covering all 7 DBROLE requirements (DBROLE-01 through DBROLE-07)
- Established is_club_owner() SECURITY DEFINER function mirroring is_admin() pattern — prevents RLS infinite recursion on club_members cross-row queries
- Patched admin clubs approval route to grant role='owner' (not 'organizer') with matching notification message

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the club_roles_and_invitations migration file** - `b57f03b` (feat)
2. **Task 2: Patch admin clubs route to grant owner role on approval** - `770f69e` (feat)

**Plan metadata:** (pending — final commit)

## Files Created/Modified

- `supabase/migrations/20260225000001_club_roles_and_invitations.sql` - Complete migration: backfill, CHECK constraint, is_club_owner() function, composite index, 4 RLS policies, club_invitations table
- `src/app/api/admin/clubs/[id]/route.ts` - Changed upsert role from "organizer" to "owner" on club approval; updated notification message

## Decisions Made

- Backfill UPDATE runs first, before the CHECK constraint DO block, so existing 'organizer' rows for club creators are normalized to 'owner' before the constraint validates existing rows on ADD
- Used LANGUAGE sql (not plpgsql) for is_club_owner() to match the is_admin() template pattern exactly
- Self-removal guard in DELETE policy uses `(select auth.uid())` wrapper per PostgreSQL initPlan caching requirement
- No invitee-access SELECT policy added to club_invitations — that is Phase 7 scope per plan instructions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `.next/types/validator.ts` (references to unbuilt phase 6+ pages) and `demo-video/src/index.ts` (React version type mismatch) — both out of scope and unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required. Migration will be applied in Phase 5 Plan 02 (or later when Supabase migration is run).

## Next Phase Readiness

- Migration file is complete and ready to apply to Supabase in Phase 5 Plan 02
- is_club_owner() function is defined and referenced in 4 RLS policies
- club_invitations table is ready for invite flow implementation
- Admin route correctly grants 'owner' role for all future club approvals

## Self-Check: PASSED

- FOUND: supabase/migrations/20260225000001_club_roles_and_invitations.sql
- FOUND: src/app/api/admin/clubs/[id]/route.ts
- FOUND: .planning/phases/05-database-foundation/05-01-SUMMARY.md
- FOUND: commit b57f03b (Task 1 — migration)
- FOUND: commit 770f69e (Task 2 — admin route)

---
*Phase: 05-database-foundation*
*Completed: 2026-02-25*
