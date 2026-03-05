# Roadmap: Uni-Verse Club Organizer UX Overhaul

## Overview

This milestone transforms Uni-Verse from a student-only event discovery tool into a two-sided platform where club organizers can manage clubs, post events, and understand engagement. The work moves in three waves: first establish the club infrastructure and team management foundation (the skeleton everything hangs on), then build the complete event management workflow for organizers, and finally add analytics dashboards and post-event reviews so organizers can learn from their data.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Club Infrastructure and Team Management** - Public club pages, organizer management dashboard, team invites, and student follow/unfollow
- [x] **Phase 2: Event Management** - Event creation with club selector, event listing/editing, auto-approval, duplication, RSVP counts, and follower notifications
- [ ] **Phase 3: Analytics and Reviews** - Event-level and club-level analytics dashboards with charts, plus post-event review submission and organizer-facing review aggregation

## Phase Details

### Phase 1: Club Infrastructure and Team Management
**Goal**: Organizers have a complete, functional club presence -- they can view and edit their clubs, manage their team, and students can follow clubs
**Depends on**: Nothing (first phase)
**Requirements**: CLUB-01, CLUB-02, CLUB-03, CLUB-04, TEAM-01, TEAM-02, TEAM-03, TEAM-04, FLLW-01, FLLW-02, FLLW-03
**Success Criteria** (what must be TRUE):
  1. A visitor can open a public club page and see the club's logo, name, description, category, Instagram link, follower count, and upcoming/past events
  2. A club owner can edit their club's details from a dedicated management page, and changes persist after reload
  3. An organizer can view their "My Clubs" list, see all clubs they own or organize, and switch between clubs via a quick-switch dropdown without navigating back to the list
  4. A club owner can view members, invite new organizers via email link, and remove organizers -- and an invited user who opens the link is added to the club
  5. A student can follow and unfollow a club from its public page, and the follower count updates visibly
**Plans**: 3 plans

Plans:
- [x] 01-01: Club API Foundation (teardown, migration, API routes, SWR hooks)
- [x] 01-02: Public Club Pages & Invite Acceptance
- [x] 01-03: Organizer Management Pages (My Clubs list, dashboard, settings, members, quick-switch)

### Phase 2: Event Management
**Goal**: Organizers can create, edit, list, and duplicate events for their clubs, with auto-approval for their own clubs, RSVP visibility, and follower notifications on publish
**Depends on**: Phase 1
**Requirements**: EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05, EVNT-06, EVNT-07
**Success Criteria** (what must be TRUE):
  1. An organizer can create an event for their club with the club pre-selected, and the event appears as approved without admin intervention
  2. An organizer can view a list of their club's events with title, date, status, and RSVP counts, and can edit any event's details
  3. An organizer can duplicate an existing event to pre-fill a new event creation form for recurring events
  4. When a club publishes a new event, all followers of that club receive an in-app notification
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Events tab with create flow, API enhancements for organizer view + RSVP counts, notification fanout
- [x] 02-02-PLAN.md — Edit and duplicate event capabilities with full flow verification

### Phase 3: Analytics and Reviews
**Goal**: Organizers can understand their event performance through analytics dashboards and receive structured feedback from attendees via post-event reviews
**Depends on**: Phase 2
**Requirements**: ANLY-01, ANLY-02, ANLY-03, REVW-01, REVW-02, REVW-03
**Success Criteria** (what must be TRUE):
  1. An organizer can view event-level analytics (views, clicks, saves, RSVP breakdown) for each event, presented with charts
  2. An organizer can view club-level trends (follower growth over time, total attendees, most popular tags) on the club management page
  3. After an event ends, a user who RSVP'd "going" is prompted to rate the event (1-5 stars) with optional text feedback, limited to one review per event and only after the event date
  4. An organizer can view aggregate review data for past events: average rating, rating distribution, and anonymized comments
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Club Infrastructure and Team Management | 3/3 | Complete | 2026-03-05 |
| 2. Event Management | 2/2 | Complete | 2026-03-05 |
| 3. Analytics and Reviews | 0/2 | Not started | - |
