# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** New users see a useful feed from first visit; existing users receive timely notifications about events they care about
**Current focus:** Phase 2 — Cold Start Fix

## Current Position

Phase: 2 of 4 (Cold Start Fix)
Plan: 1 of 1 in current phase (02-01 complete)
Status: Phase 2 Plan 1 Complete
Last activity: 2026-02-23 — Completed 02-01 cold-start fallback and source field in recommendations API

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 10 min
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-notification-database-foundation | 2 | 24 min | 12 min |
| 02-cold-start-fix | 1 | 8 min | 8 min |

**Recent Trend:**
- Last 5 plans: 01-01 (22 min), 01-02 (2 min), 02-01 (8 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phase 2 (Cold Start Fix) is independent of Phase 1 and can be executed in parallel
- [Roadmap]: Phase 4 (Cron) depends on both Phase 1 (table exists) and Phase 3 (cron route validated)
- [01-02]: Canonical notification type strings use event_ prefix: event_reminder_24h, event_reminder_1h, event_approved, event_rejected
- [01-02]: Notification interface centralized in src/types/index.ts — single source of truth for all consumers
- [01-02]: Upsert with onConflict: "user_id,event_id,type" and ignoreDuplicates: true is the dedup pattern; requires unique constraint at DB level (plan 03)
- [01-01]: UNIQUE dedup index (notifications_dedup_idx) not yet applied to remote database — migration file at supabase/migrations/20260223000000_notifications_rls_and_dedup.sql must be applied via Supabase MCP apply_migration or Dashboard SQL Editor
- [01-01]: Column named `read` (not `is_read`) confirmed correct; RLS enabled and verified in production
- [02-01]: RECOMMENDATION_THRESHOLD = 3 centralized in constants.ts; both page.tsx (replace magic number) and RecommendedEventsSection (nudge math) must import it
- [02-01]: Cold-start early return placed before Promise.all/k-means; uses targeted single-user saved_events fetch for gate check
- [02-01]: source field added to all 200-response return sites: "popular_fallback" for cold-start path, "personalized" for all personalized paths

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 - Pending]: Apply `supabase/migrations/20260223000000_notifications_rls_and_dedup.sql` via Supabase MCP tools or Dashboard SQL Editor to add the notifications_dedup_idx UNIQUE index — required before Phase 4 cron work begins (upsert dedup relies on this index).
- [Phase 4]: pg_cron → pg_net → Next.js API auth has a documented friction point (Supabase issue #4287). Validate before Phase 4 begins; fallback is GitHub Actions or Vercel Cron.
- [Phase 3]: Decision needed on NotificationBell caching strategy: Zustand global store vs SWR revalidateOnFocus. Pick one approach before implementation to avoid two patterns in the codebase.
- [Research flag]: Verify whether NotificationBell is already injected at Header.tsx line 122 before Phase 3 begins — may already be done.

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 02-01-PLAN.md — Cold-start fallback + source field in recommendations API; RecommendedEventsSection UI update still needed (COLD-05, COLD-08)
Resume file: None
