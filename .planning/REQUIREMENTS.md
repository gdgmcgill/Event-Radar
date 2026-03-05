# Requirements: Uni-Verse Club Organizer UX Overhaul

**Defined:** 2026-03-05
**Core Value:** Club organizers can effortlessly manage their clubs and post events, while students can discover and engage with campus events that matter to them

## v1 Requirements

Requirements for the club organizer rework milestone. Each maps to roadmap phases.

### Club Management

- [x] **CLUB-01**: User can view a public club page showing the club's logo, name, description, category, Instagram link, follower count, and upcoming/past events *(API ready: 01-01)*
- [x] **CLUB-02**: Club owner can edit their club's name, description, logo, category, and Instagram link from a dedicated management page, and see changes persist after reload *(API: 01-01, UI: 01-03)*
- [x] **CLUB-03**: Organizer can view a "My Clubs" list page showing all clubs they own or organize, with club name, logo, role, and member count *(API: 01-01, UI: 01-03)*
- [x] **CLUB-04**: Organizer can switch between clubs via a quick-switch dropdown in the club management view without navigating back to the list *(UI: 01-03)*

### Event Management

- [x] **EVNT-01**: Organizer can create an event for their club with title, description, date/time, location, tags, and image, with the club pre-selected via a club selector dropdown
- [x] **EVNT-02**: Organizer can view a list of their club's events showing title, date, status (pending/approved/rejected), and RSVP count
- [x] **EVNT-03**: Organizer can edit an existing event's details (title, description, date, location, tags, image) from the club management page
- [x] **EVNT-04**: An event created by a club owner or organizer for their own club is auto-approved (status set to 'approved' without admin intervention)
- [x] **EVNT-05**: Organizer can see RSVP counts (going/interested) for each of their events
- [x] **EVNT-06**: Organizer can duplicate an existing event to pre-fill the creation form with its details (title, description, location, tags) for quick recurring event creation
- [x] **EVNT-07**: When a club publishes a new event, all club followers receive an in-app notification

### Team Management

- [x] **TEAM-01**: Club owner can view all club members with their role (owner/organizer) and joined date *(API: 01-01, UI: 01-03)*
- [x] **TEAM-02**: Club owner can invite a McGill email address to join the club as an organizer, generating a shareable invitation link *(API: 01-01, UI: 01-03)*
- [x] **TEAM-03**: Club owner can remove an organizer from the club (but cannot remove themselves) *(API: 01-01, UI: 01-03)*
- [x] **TEAM-04**: A user who opens an invitation link while logged in with the matching email is added to the club as an organizer *(API ready: 01-01)*

### Student Engagement

- [x] **FLLW-01**: Student can follow a club from the public club page, and the club appears in their following list *(API ready: 01-01)*
- [x] **FLLW-02**: Student can unfollow a club, and it disappears from their following list *(API ready: 01-01)*
- [x] **FLLW-03**: Public club page displays a follower count visible to all visitors *(API ready: 01-01)*

### Analytics

- [ ] **ANLY-01**: Organizer can view event-level analytics for each event: total views, clicks, saves, and RSVP breakdown (going/interested)
- [ ] **ANLY-02**: Organizer can view club-level trends: follower growth over time, total attendees across all events, and most popular event tags
- [ ] **ANLY-03**: Analytics data is presented with charts (line/bar) on the club management page

### Reviews

- [ ] **REVW-01**: After an event ends, users who RSVP'd "going" are prompted to rate the event (1-5 stars) with optional text feedback
- [ ] **REVW-02**: Organizer can view aggregate review data for past events: average rating, rating distribution, and anonymized comments
- [ ] **REVW-03**: A user can only submit one review per event, and reviews cannot be submitted before the event date

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Social Features

- **SOCL-01**: User can follow/unfollow other users (friends)
- **SOCL-02**: User can see which friends are attending an event
- **SOCL-03**: User can set account privacy (public/private/close friends only)
- **SOCL-04**: Trending indicator shows events with high friend attendance

### Monetization

- **SPON-01**: Club organizer can pay to sponsor an event to the top of the front page
- **SPON-02**: Local businesses can purchase promoted spots on the front page
- **SPON-03**: Admin can manage and approve sponsored content

### Public Reviews

- **PREV-01**: Students can see public reviews and ratings for events on the event detail page
- **PREV-02**: Review moderation system for inappropriate content

### Advanced Analytics

- **ADVN-01**: Engagement comparison across events (side-by-side metrics)
- **ADVN-02**: Export analytics data to CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat / messaging | High complexity, tangential to event discovery, solved by Discord/GroupMe |
| Ticketing / payment processing | McGill events are overwhelmingly free; premature optimization |
| Complex role hierarchies (editor/viewer/moderator) | Owner + organizer is sufficient for campus clubs |
| Custom event registration forms | Overkill; Google Forms covers edge cases |
| Event templates system | Event duplication solves 90% of the use case at 10% of the complexity |
| Attendance check-in (QR scanning) | Significant mobile complexity; RSVP counts are sufficient proxy |
| Mobile app | Web-first approach; mobile is a separate milestone |
| User-to-user social features | Separate milestone after clubs are solid |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLUB-01 | Phase 1 | Complete (01-01) |
| CLUB-02 | Phase 1 | Complete (01-01) |
| CLUB-03 | Phase 1 | Complete (01-01) |
| CLUB-04 | Phase 1 | Complete (01-03) |
| EVNT-01 | Phase 2 | Complete |
| EVNT-02 | Phase 2 | Complete |
| EVNT-03 | Phase 2 | Complete |
| EVNT-04 | Phase 2 | Complete |
| EVNT-05 | Phase 2 | Complete |
| EVNT-06 | Phase 2 | Complete |
| EVNT-07 | Phase 2 | Complete |
| TEAM-01 | Phase 1 | Complete (01-01) |
| TEAM-02 | Phase 1 | Complete (01-01) |
| TEAM-03 | Phase 1 | Complete (01-01) |
| TEAM-04 | Phase 1 | Complete (01-01) |
| FLLW-01 | Phase 1 | Complete (01-01) |
| FLLW-02 | Phase 1 | Complete (01-01) |
| FLLW-03 | Phase 1 | Complete (01-01) |
| ANLY-01 | Phase 3 | Pending |
| ANLY-02 | Phase 3 | Pending |
| ANLY-03 | Phase 3 | Pending |
| REVW-01 | Phase 3 | Pending |
| REVW-02 | Phase 3 | Pending |
| REVW-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
