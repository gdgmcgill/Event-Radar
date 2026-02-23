# Roadmap: Uni-Verse Beta Launch — Cold Start Fix & Notifications

## Overview

This milestone wires two independent capabilities into the existing Uni-Verse platform: a cold start fix that ensures new users see a useful, populated feed from their first visit, and a full in-app notification system that alerts users about event reminders and admin approval decisions. The majority of application code already exists in the codebase — the critical work is creating the notifications database table (which unblocks all notification features), fixing the recommendations API fallback path, activating existing components against real infrastructure, and scheduling the cron job that drives reminders.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Notification Database Foundation** - Create and configure the notifications table with RLS, UNIQUE constraint, and aligned type strings
- [ ] **Phase 2: Cold Start Fix** - Fix the recommendations API fallback and update the UI to serve new users a useful feed
- [ ] **Phase 3: Notification System Wiring** - Activate existing notification components and API routes against the real database table
- [ ] **Phase 4: Cron Scheduler Configuration** - Configure pg_cron to automatically generate event reminder notifications hourly

## Phase Details

### Phase 1: Notification Database Foundation
**Goal**: The notifications table exists in Supabase with correct schema, RLS policies, and type string alignment — enabling all downstream notification code to operate correctly from the first write
**Depends on**: Nothing (first phase)
**Requirements**: NINF-01, NINF-02, NINF-03, NINF-04, NINF-05
**Success Criteria** (what must be TRUE):
  1. A `notifications` table exists in Supabase with columns: id, user_id, event_id, type, title, message, is_read, created_at
  2. An authenticated user can only read their own notification rows (RLS SELECT policy enforced)
  3. A duplicate INSERT with the same (user_id, event_id, type) silently does nothing (UNIQUE constraint + ON CONFLICT DO NOTHING)
  4. The codebase and database use the same notification type strings: event_reminder_24h, event_reminder_1h, event_approved, event_rejected
  5. TypeScript interfaces in src/types/index.ts compile without errors and reflect the notifications table schema
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Apply notifications table DDL migration (RLS + UNIQUE indexes) via Supabase MCP
- [x] 01-02-PLAN.md — Fix cron type strings (event_reminder_*) and centralize Notification TypeScript interface

### Phase 2: Cold Start Fix
**Goal**: New users with fewer than 3 saved events see a popularity-ranked feed of upcoming campus events instead of an empty or broken recommendations section, and understand what action unlocks personalized picks
**Depends on**: Nothing (independent of Phase 1)
**Requirements**: COLD-01, COLD-02, COLD-03, COLD-04, COLD-05, COLD-06, COLD-07, COLD-08
**Success Criteria** (what must be TRUE):
  1. A new user with 0 saved events sees a populated "Popular on Campus" section on the home page, not an empty recommendations area
  2. Every event shown in the fallback feed has a start time in the future (no past events surfaced)
  3. Events the user has already saved do not appear in the fallback feed
  4. An onboarding nudge tells the user exactly how many more saves are needed to unlock personalized recommendations
  5. A user with 3 or more saved events sees their personalized recommendations (not the fallback feed)
**Plans**: TBD

### Phase 3: Notification System Wiring
**Goal**: Authenticated users see a live notification bell in the header with an unread count badge, admin approve/reject actions create notifications for club organizers, and the full notification inbox is functional
**Depends on**: Phase 1
**Requirements**: NUI-01, NUI-02, NUI-03, NGEN-01, NGEN-02
**Success Criteria** (what must be TRUE):
  1. An authenticated user sees a notification bell icon in the header; unauthenticated users do not
  2. When a user has unread notifications, a badge with the count appears on the bell icon
  3. A club organizer whose event is approved receives a green notification in their inbox
  4. A club organizer whose event is rejected receives a red notification in their inbox
  5. Clicking a notification that has an associated event navigates the user to /events/[event_id]
**Plans**: TBD

### Phase 4: Cron Scheduler Configuration
**Goal**: The Supabase pg_cron job runs hourly and automatically generates 24h and 1h reminder notifications for users with upcoming saved events — with no manual triggering required
**Depends on**: Phase 1, Phase 3
**Requirements**: NGEN-03, NGEN-04, NGEN-05, NGEN-06
**Success Criteria** (what must be TRUE):
  1. A user who saved an event receives a notification approximately 24 hours before the event starts
  2. A user who saved an event receives a notification approximately 1 hour before the event starts
  3. Saving an event and then triggering the cron manually creates at most one reminder per type — re-triggering does not create duplicates
  4. The CRON_SECRET is stored in Supabase Vault (not in source code or environment variables exposed to client)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4
Note: Phase 2 is independent of Phase 1 and can be developed in parallel if needed.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Notification Database Foundation | 1/2 | In Progress | - |
| 2. Cold Start Fix | 0/TBD | Not started | - |
| 3. Notification System Wiring | 0/TBD | Not started | - |
| 4. Cron Scheduler Configuration | 0/TBD | Not started | - |
