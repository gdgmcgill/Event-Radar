# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Cold Start Fix & Notifications

**Shipped:** 2026-02-26 (dev completed 2026-02-23)
**Phases:** 3 (Phase 4 deferred) | **Plans:** 6

### What Was Built
- Popularity-ranked cold-start fallback feed with boost scoring for new users
- Source-aware UI with "Popular on Campus" heading and onboarding nudge
- Notifications table with RLS, dedup index, and idempotent migration DDL
- Centralized NotificationType system across all consumers
- NotificationBell with unread count badge, notification navigation to events
- Hardened admin approve/reject notification upsert

### What Worked
- All 6 plans executed with zero deviations from plan — planning quality was high
- TypeScript strict mode caught issues at compile time; zero runtime surprises
- Upsert with ignoreDuplicates pattern eliminated race conditions in notification creation
- Cold-start early return before Promise.all/k-means — efficient resource use for cold users

### What Was Inefficient
- Phase 1 Plan 01 hit Supabase MCP tooling limitation in GSD executor subprocess — migration file created but couldn't be applied remotely, requiring a manual step later
- Phase 4 (pg_cron) deferred entirely due to pg_cron → pg_net → Next.js API auth friction — should have researched this blocker earlier

### Patterns Established
- Partial UNIQUE index pattern for nullable FK dedup in PostgreSQL
- Idempotent DO block migrations for safe re-application
- Source discriminator field on API responses for UI branching
- Cold-start early return pattern (gate check before expensive operations)

### Key Lessons
1. Supabase MCP tools are only available in parent Claude Code session, not subprocesses — plan around this for database operations
2. Infrastructure blockers (like pg_cron auth) should be spiked during research, not discovered during planning
3. Single-day milestone execution is achievable when plans are specific and actionable

### Cost Observations
- Model mix: Primarily sonnet for research/verification, inherit for planning
- Notable: Average plan execution ~6 minutes — very efficient

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 3 (+1 deferred) | 6 | First GSD milestone; established planning patterns |

### Top Lessons (Verified Across Milestones)

1. Plan specificity directly correlates with execution speed — zero-deviation plans average 5 min
2. Supabase MCP access is a subprocess limitation — always plan a manual fallback for DB operations
