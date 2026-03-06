# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Club Organizer UX Overhaul

**Shipped:** 2026-03-06
**Phases:** 3 | **Plans:** 7 | **Execution time:** 42 min

### What Was Built
- Complete club management dashboard (settings, members, events, analytics tabs)
- Public club pages with follow/unfollow system
- Event creation, editing, duplication with auto-approval for organizers
- Notification fanout to club followers on event publish
- Event-level and club-level analytics with Recharts charts
- Post-event star rating review system with aggregate organizer views

### What Worked
- Tearing down broken club code and rebuilding from scratch avoided endless patching
- URL-driven club context (`/my-clubs/[id]`) kept state management simple
- SWR hooks for all data fetching gave consistent cache/revalidation patterns
- RLS as primary security boundary meant API routes stayed thin
- Coarse granularity kept plans at the right abstraction level (7 plans for 24 requirements)

### What Was Inefficient
- Some Supabase type mismatches required workarounds (FK joins, reviews table cast)
- Multi-mode form pattern in 02-02 took longest (14min) due to state complexity

### Patterns Established
- Fire-and-forget for non-critical side effects (notifications)
- Multi-mode form pattern with `mode` prop and `initialData` for CRUD forms
- Idempotent migrations with IF NOT EXISTS / DO $$ blocks
- Bulk queries to avoid N+1 for analytics aggregation

### Key Lessons
1. Rebuild > patch when existing code is fundamentally fragmented
2. Live COUNT vs denormalized counters: simpler code wins when scale isn't a concern yet
3. Supabase type generation should happen after each migration to avoid `as any` casts

### Cost Observations
- Model mix: balanced profile (sonnet for research/checking, inherit for planning)
- Total execution: 42 minutes across 7 plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Execution Time | Phases | Key Change |
|-----------|---------------|--------|------------|
| v2.0 | 42 min | 3 | First GSD milestone — established patterns |

### Top Lessons (Verified Across Milestones)

1. (Will populate after next milestone)
