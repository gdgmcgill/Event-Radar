---
phase: 03-notification-system-wiring
plan: "01"
subsystem: notifications
tags: [navigation, upsert, idempotency, notification-ui]
dependency_graph:
  requires: []
  provides: [notification-navigation, idempotent-admin-notifications]
  affects: [NotificationItem, admin-status-route]
tech_stack:
  added: []
  patterns: [conditional-link-button, upsert-on-conflict]
key_files:
  created: []
  modified:
    - src/components/notifications/NotificationItem.tsx
    - src/app/api/admin/events/[id]/status/route.ts
decisions:
  - "Conditional wrapper: Link for event_id-bearing notifications, button for others — no prop drilling needed"
  - "Upsert with onConflict user_id,event_id,type resets read=false and created_at on re-approve/re-reject"
metrics:
  duration: "1 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 01: Notification Navigation and Upsert Hardening Summary

**One-liner:** Conditional Link/button rendering in NotificationItem plus upsert-based idempotent admin notification creation.

## What Was Built

Added event navigation to `NotificationItem` and hardened the admin notification write path from `.insert()` to `.upsert()`.

### NotificationItem Navigation (NUI-03)

`src/components/notifications/NotificationItem.tsx` was refactored to conditionally render:

- A `<Link href={/events/${notification.event_id}}>` when `notification.event_id` is present — navigates the user to the event detail page on click
- A `<button type="button">` when `event_id` is null/undefined — marks the notification as read without navigating

The `handleClick` callback fires synchronously before navigation (default `onClick` behavior), ensuring the optimistic read update in the parent applies immediately. All styling, `typeConfig` map, `timeAgo` function, and class names are unchanged.

### Admin Upsert (NGEN-01, NGEN-02)

`src/app/api/admin/events/[id]/status/route.ts` changed from `.insert()` to `.upsert()` with:

- `onConflict: "user_id,event_id,type"` — matches the `notifications_dedup_idx` partial unique index
- `read: false` — re-approve/re-reject resurfaces as unread
- `created_at: new Date().toISOString()` — notification timestamp resets to now

This ensures re-approving or re-rejecting an event always delivers a fresh unread notification instead of silently failing due to the unique constraint.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add event navigation to NotificationItem | 5665ba6 | src/components/notifications/NotificationItem.tsx |
| 2 | Change admin notification insert to upsert | 673080c | src/app/api/admin/events/[id]/status/route.ts |

## Verification Results

- `npx tsc --noEmit` — PASSED (zero errors)
- `NotificationItem.tsx` contains `import Link from "next/link"` — VERIFIED
- `NotificationItem.tsx` renders `<Link href=...events/...event_id>` conditionally — VERIFIED
- `status/route.ts` contains `.upsert(` with `onConflict: "user_id,event_id,type"` — VERIFIED
- No other files modified — VERIFIED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/components/notifications/NotificationItem.tsx — FOUND
- src/app/api/admin/events/[id]/status/route.ts — FOUND
- .planning/phases/03-notification-system-wiring/03-01-SUMMARY.md — FOUND
- Commit 5665ba6 — FOUND
- Commit 673080c — FOUND
