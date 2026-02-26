---
phase: 01-notification-database-foundation
plan: 02
subsystem: notifications
tags: [typescript, supabase, notifications, cron, types]

# Dependency graph
requires:
  - phase: 01-notification-database-foundation/01-01
    provides: initial notification component files (NotificationItem, NotificationList, page)
provides:
  - Centralized NotificationType union and Notification interface in src/types/index.ts
  - Consistent event_reminder_24h and event_reminder_1h type strings across all files
  - Atomic upsert-based deduplication in send-reminders cron route
affects: [phase-2-notifications, phase-3-notificationbell, phase-4-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notification types centralized in src/types/index.ts, imported everywhere via @/types"
    - "Upsert with ignoreDuplicates and onConflict for idempotent cron-based inserts"

key-files:
  created: []
  modified:
    - src/types/index.ts
    - src/components/notifications/NotificationItem.tsx
    - src/components/notifications/NotificationList.tsx
    - src/app/notifications/page.tsx
    - src/app/api/cron/send-reminders/route.ts

key-decisions:
  - "Notification interface centralized in src/types/index.ts — single source of truth, consistent with all other project types"
  - "event_ prefix is canonical for notification type strings (event_reminder_24h, event_reminder_1h, event_approved, event_rejected)"
  - "Upsert with ignoreDuplicates replaces SELECT-count-then-INSERT — atomic deduplication aligned with DB unique constraint on (user_id, event_id, type)"

patterns-established:
  - "Pattern 1: All notification-related types imported from @/types, not from component files"
  - "Pattern 2: Cron routes use upsert with ignoreDuplicates: true for idempotent notification insertion"

requirements-completed: [NINF-04, NINF-05]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 1 Plan 02: Fix Notification Type Consistency Summary

**NotificationType union and Notification interface centralized in src/types/index.ts; cron route migrated from incorrect reminder_24h/1h strings and SELECT-then-INSERT dedup to event_reminder_24h/1h with upsert ignoreDuplicates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T19:11:39Z
- **Completed:** 2026-02-23T19:13:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Centralized NotificationType union type and Notification interface into src/types/index.ts (previously declared locally in NotificationItem.tsx)
- Updated all four consumer files (NotificationItem, NotificationList, notifications/page, send-reminders route) to import Notification from @/types
- Fixed cron route type strings from reminder_24h/reminder_1h to event_reminder_24h/event_reminder_1h, matching NotificationItem.tsx typeConfig keys
- Replaced two-query SELECT-count-then-INSERT dedup pattern with single atomic upsert using ignoreDuplicates: true

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralize Notification types and update consumer imports** - `3dea9c5` (feat)
2. **Task 2: Fix type strings and dedup pattern in cron route** - `7a42bbf` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/types/index.ts` - Added NotificationType union and Notification interface at the end of the file
- `src/components/notifications/NotificationItem.tsx` - Removed local Notification interface; added import from @/types
- `src/components/notifications/NotificationList.tsx` - Split import: NotificationItem from component file, Notification type from @/types
- `src/app/notifications/page.tsx` - Changed Notification import source from NotificationItem component to @/types
- `src/app/api/cron/send-reminders/route.ts` - Fixed type strings to event_reminder_24h/1h; replaced SELECT-count-INSERT with upsert ignoreDuplicates

## Decisions Made
- Canonical notification type strings use the `event_` prefix throughout — consistent with event_approved and event_rejected already used in the admin route
- Upsert with `onConflict: "user_id,event_id,type"` requires a unique constraint at the database level (to be created in plan 03 when the notifications table is added via migration)
- No re-export of Notification from NotificationItem.tsx — consumers import directly from @/types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all changes straightforward. TypeScript strict mode compilation passed with zero errors after all changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All notification type strings are now consistent across the codebase before the database table exists
- The unique constraint `(user_id, event_id, type)` must be included in the notifications table migration (plan 03) for the upsert dedup to work correctly at the DB level
- NotificationBell caching strategy decision (Zustand vs SWR) still pending per STATE.md blocker

## Self-Check: PASSED

- FOUND: src/types/index.ts
- FOUND: src/components/notifications/NotificationItem.tsx
- FOUND: src/components/notifications/NotificationList.tsx
- FOUND: src/app/notifications/page.tsx
- FOUND: src/app/api/cron/send-reminders/route.ts
- FOUND: .planning/phases/01-notification-database-foundation/01-02-SUMMARY.md
- FOUND: commit 3dea9c5
- FOUND: commit 7a42bbf

---
*Phase: 01-notification-database-foundation*
*Completed: 2026-02-23*
