# Roadmap: Uni-Verse

## Milestones

- [x] **v1.0 Cold Start Fix & Notifications** - Phases 1-4 (Phases 1-3 shipped 2026-02-23, Phase 4 deferred)
- [ ] **v1.1 Club Organizer UX Overhaul** - Phases 5-8 (in progress)

## Phases

<details>
<summary>v1.0 Cold Start Fix & Notifications (Phases 1-4)</summary>

### Phase 1: Notification Database Foundation
**Goal**: The notifications table exists in Supabase with correct schema, RLS policies, and type string alignment
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
- [x] 01-01-PLAN.md — Apply notifications table DDL migration (RLS + UNIQUE indexes) via Supabase MCP
- [x] 01-02-PLAN.md — Fix cron type strings (event_reminder_*) and centralize Notification TypeScript interface

### Phase 2: Cold Start Fix
**Goal**: New users with fewer than 3 saved events see a popularity-ranked feed of upcoming campus events instead of an empty or broken recommendations section
**Depends on**: Nothing (independent of Phase 1)
**Requirements**: COLD-01, COLD-02, COLD-03, COLD-04, COLD-05, COLD-06, COLD-07, COLD-08
**Success Criteria** (what must be TRUE):
  1. A new user with 0 saved events sees a populated "Popular on Campus" section on the home page
  2. Every event shown in the fallback feed has a start time in the future
  3. Events the user has already saved do not appear in the fallback feed
  4. An onboarding nudge tells the user exactly how many more saves are needed to unlock personalized recommendations
  5. A user with 3 or more saved events sees their personalized recommendations (not the fallback feed)
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Add cold-start fallback and source field to recommendations API
- [x] 02-02-PLAN.md — Make RecommendedEventsSection source-aware with nudge UI

### Phase 3: Notification System Wiring
**Goal**: Authenticated users see a live notification bell in the header with an unread count badge, admin actions create notifications for club organizers
**Depends on**: Phase 1
**Requirements**: NUI-01, NUI-02, NUI-03, NGEN-01, NGEN-02
**Success Criteria** (what must be TRUE):
  1. An authenticated user sees a notification bell icon in the header; unauthenticated users do not
  2. When a user has unread notifications, a badge with the count appears on the bell icon
  3. A club organizer whose event is approved receives a green notification in their inbox
  4. A club organizer whose event is rejected receives a red notification in their inbox
  5. Clicking a notification that has an associated event navigates the user to /events/[event_id]
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Add event navigation to NotificationItem and harden admin notification upsert
- [x] 03-02-PLAN.md — Apply Phase 1 migration and verify notification system end-to-end

### Phase 4: Cron Scheduler Configuration
**Goal**: The Supabase pg_cron job runs hourly and automatically generates reminder notifications
**Depends on**: Phase 1, Phase 3
**Requirements**: NGEN-03, NGEN-04, NGEN-05, NGEN-06
**Status**: Deferred to v1.2
**Plans**: TBD

</details>

## v1.1 Club Organizer UX Overhaul

**Milestone Goal:** Club organizers have a seamless, unified experience from club creation through event management — no broken flows, no dead ends, no unnecessary admin bottlenecks.

**Phase Numbering:**
- Integer phases (5, 6, 7, 8): Planned milestone work
- Decimal phases (e.g., 6.1): Urgent insertions if needed (marked with INSERTED)

- [x] **Phase 5: Database Foundation** - Role constraints, security functions, RLS policies, invitations table, and auto-grant owner on approval
- [x] **Phase 6: Dashboard Shell + Read-Only Tabs** - /my-clubs/[id] page with server-side role resolution, tabbed navigation, Overview and Events tabs (completed 2026-02-26)
- [ ] **Phase 7: Members Tab + Invite Flow** - Member list API, member management UI, invitation system with copy-link UX, acceptance flow
- [ ] **Phase 8: Settings Tab + Surface Fixes** - Club settings editing, context-aware public club page, club selector on create-event, auto-approval

## Phase Details

### Phase 5: Database Foundation
**Goal**: The database layer enforces owner/organizer role distinction, prevents RLS infinite recursion via SECURITY DEFINER functions, and provides the invitations table — so all downstream application code can rely on correct, secure data access from the first query
**Depends on**: Nothing (first phase of v1.1; v1.0 Phases 1-3 complete)
**Requirements**: DBROLE-01, DBROLE-02, DBROLE-03, DBROLE-04, DBROLE-05, DBROLE-06, DBROLE-07
**Success Criteria** (what must be TRUE):
  1. A club_members row with role not in ('owner', 'organizer') is rejected by the database (CHECK constraint active)
  2. An owner querying the members API for their club sees ALL members of that club (not just their own row) via an authenticated client — not service role
  3. An owner can remove an organizer from their club, but cannot remove themselves (DELETE policy with self-removal guard)
  4. When an admin approves a club, the creator is automatically inserted into club_members with role='owner' (not 'organizer')
  5. The club_invitations table exists with RLS policies that allow only club owners to create and view invitations for their club
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Write migration SQL (role constraint, is_club_owner(), RLS policies, invitations table) and patch admin route
- [x] 05-02-PLAN.md — Apply migration to Supabase and verify all DBROLE requirements end-to-end

### Phase 6: Dashboard Shell + Read-Only Tabs
**Goal**: Club organizers can navigate to /my-clubs/[id] and see a tabbed dashboard with Overview and Events information for their club — resolving the current dead link with a functional, read-only experience
**Depends on**: Phase 5 (role resolution requires owner/organizer distinction in DB)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Navigating to /my-clubs/[id] loads a dashboard page that shows the club name and the user's role (owner or organizer)
  2. The dashboard has four tabs (Overview, Events, Members, Settings) and clicking a tab updates the URL to ?tab=<name> without a full page reload
  3. The Overview tab displays the club's name, description, category, and member count
  4. The Events tab lists the club's events with title, date, and approval status (consuming the existing GET /api/clubs/[id]/events endpoint)
  5. The Events tab contains a "Create Event" link that navigates to /create-event with the club pre-selected
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Install shadcn Tabs, create server page with role resolution, build client dashboard shell with URL-param tabs, and implement Overview tab
- [ ] 06-02-PLAN.md — Create Events tab consuming existing API, wire into dashboard, and update create-event page for clubId pre-fill

### Phase 7: Members Tab + Invite Flow
**Goal**: Club owners can view all members, remove organizers, invite new organizers by email with a copy-link mechanism, and see pending invitations — completing the member management loop
**Depends on**: Phase 5 (RLS policies for member access), Phase 6 (dashboard shell with tabs)
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07, MEM-08
**Success Criteria** (what must be TRUE):
  1. The Members tab displays all club members with their role (owner/organizer badge) and joined date
  2. An owner can remove an organizer from the Members tab via a confirmation dialog, and the removed member disappears from the list
  3. An owner can enter a McGill email address and generate an invitation link that can be copied to clipboard
  4. A user who opens an invitation link while logged in with the matching email is added to the club as an organizer
  5. Pending invitations appear in a separate section of the Members tab showing the invitee email and invitation date
**Plans**: TBD

### Phase 8: Settings Tab + Surface Fixes
**Goal**: Club owners can edit their club's details from the dashboard, and organizers experience a polished end-to-end flow from club creation through event publishing with no dead ends or confusing CTAs
**Depends on**: Phase 5 (owner UPDATE RLS policy on clubs), Phase 6 (dashboard shell with Settings tab)
**Requirements**: SURF-01, SURF-02, SURF-03, SURF-04, SURF-05, SURF-06, SURF-07
**Success Criteria** (what must be TRUE):
  1. An owner can edit their club's name, description, category, and Instagram link from the Settings tab and see changes persist after page reload
  2. The public club page (/clubs/[id]) shows "Request Organizer Access" to visitors, and "Manage Club" to existing organizers/owners
  3. An organizer creating an event from /create-event sees a club selector dropdown populated with their clubs, and selecting a club pre-fills the club_id
  4. An event created by an organizer for their own club is auto-approved (status set to 'approved' without admin intervention) — verified by the event appearing immediately without pending status
  5. The /clubs/create success screen explains that the club is pending admin review and that the creator will be granted owner status upon approval

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Notification Database Foundation | v1.0 | 2/2 | Complete | 2026-02-23 |
| 2. Cold Start Fix | v1.0 | 2/2 | Complete | 2026-02-23 |
| 3. Notification System Wiring | v1.0 | 2/2 | Complete | 2026-02-23 |
| 4. Cron Scheduler Configuration | v1.0 | 0/TBD | Deferred | - |
| 5. Database Foundation | v1.1 | 2/2 | Complete | 2026-02-25 |
| 6. Dashboard Shell + Read-Only Tabs | 3/3 | Complete   | 2026-02-26 | - |
| 7. Members Tab + Invite Flow | v1.1 | 0/TBD | Not started | - |
| 8. Settings Tab + Surface Fixes | v1.1 | 0/TBD | Not started | - |
