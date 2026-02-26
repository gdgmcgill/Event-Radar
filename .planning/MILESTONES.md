# Milestones

## v1.0 Cold Start Fix & Notifications (Shipped: 2026-02-26)

**Phases completed:** 3 of 4 phases (Phase 4 deferred), 6 plans, 11 tasks
**Timeline:** 1 day (2026-02-23)
**Changes:** 58 files, +4,894 / -1,446 lines

**Key accomplishments:**
- Created notifications table with RLS policies and UNIQUE dedup index applied to production Supabase
- Centralized NotificationType union and Notification interface in src/types/index.ts
- Built popularity-ranked cold-start fallback feed with boost scoring and source discriminator
- Wired source-aware UI with "Popular on Campus" heading toggle and onboarding nudge
- Added event navigation to NotificationItem and hardened admin notification upsert
- Verified full notification system builds and operates end-to-end

**Known Gaps:**
- NGEN-03: pg_cron job not configured (deferred to v1.2)
- NGEN-04: CRON_SECRET not stored in Vault (deferred to v1.2)
- NGEN-05: event_reminder_24h notifications not auto-generated (deferred to v1.2)
- NGEN-06: event_reminder_1h notifications not auto-generated (deferred to v1.2)

---

