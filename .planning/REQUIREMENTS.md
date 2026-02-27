# Requirements: Uni-Verse

**Core Value:** Club organizers must have a seamless, unified experience from club creation through event management — no broken flows, no dead ends, no unnecessary admin bottlenecks.

## v1.0 Requirements (Cold Start Fix & Notifications)

*Defined: 2026-02-23 — Phases 1-3 complete, Phase 4 deferred*

### Notification Infrastructure

- [x] **NINF-01**: Notifications table created in Supabase with columns: id, user_id, event_id, type, title, message, read, created_at
- [x] **NINF-02**: RLS enabled on notifications table with policies: SELECT own rows (authenticated), UPDATE own rows (authenticated); INSERT has no policy for authenticated role — service role bypasses RLS by design, blocking any direct browser client INSERT
- [x] **NINF-03**: UNIQUE constraint on (user_id, event_id, type) to prevent duplicate notifications
- [x] **NINF-04**: Notification type strings aligned across codebase — cron route and NotificationItem both use event_reminder_24h, event_reminder_1h, event_approved, event_rejected
- [x] **NINF-05**: TypeScript types updated in src/types/index.ts to reflect notifications table schema

### Notification UI

- [x] **NUI-01**: NotificationBell injected into Header.tsx next to auth button for authenticated users
- [x] **NUI-02**: Existing notification API routes (GET, PATCH, POST mark-all-read) validated against real notifications table
- [x] **NUI-03**: Notification items link to /events/[event_id] when event_id is present

### Notification Generation

- [x] **NGEN-01**: Admin approve action creates event_approved notification for the event submitter
- [x] **NGEN-02**: Admin reject action creates event_rejected notification for the event submitter
- [ ] **NGEN-03**: pg_cron job configured in Supabase to call reminder endpoint hourly
- [ ] **NGEN-04**: CRON_SECRET stored securely in Supabase Vault for pg_cron auth
- [ ] **NGEN-05**: Cron generates event_reminder_24h notifications for users with saved events starting in ~24 hours
- [ ] **NGEN-06**: Cron generates event_reminder_1h notifications for users with saved events starting in ~1 hour

### Cold Start

- [x] **COLD-01**: /api/recommendations returns popularity-ranked fallback feed when user has <3 saved events
- [x] **COLD-02**: Fallback query filters start_time > NOW() to exclude past events
- [x] **COLD-03**: Fallback scoring applies popularity boost (>10 saves → +2) and recency boost (within 7 days → +1)
- [x] **COLD-04**: API response includes source field ("personalized" or "popular_fallback") so UI can label appropriately
- [x] **COLD-05**: RecommendedEventsSection shows "Popular on Campus" label when source is popular_fallback
- [x] **COLD-06**: Already-saved events excluded from fallback feed
- [x] **COLD-07**: RECOMMENDATION_THRESHOLD constant centralized in src/lib/constants.ts and used by both page.tsx and API
- [x] **COLD-08**: Onboarding nudge displayed in cold-start state ("Save N more events to unlock personalized recommendations")

---

## v1.1 Requirements (Club Organizer UX Overhaul)

*Defined: 2026-02-25 — All pending*

### Database & Roles

- [x] **DBROLE-01**: `CHECK (role IN ('owner', 'organizer'))` constraint on `club_members.role` column
- [x] **DBROLE-02**: `is_club_owner(club_id UUID)` SECURITY DEFINER function — prevents RLS infinite recursion, follows existing `is_admin()` pattern from `011_rls_audit.sql`
- [x] **DBROLE-03**: Owner cross-row SELECT policy on `club_members` — owners can view all members of their club (not just own row)
- [x] **DBROLE-04**: Owner DELETE policy on `club_members` — owners can remove organizers, with self-removal guard at DB level
- [x] **DBROLE-05**: Composite index on `club_members(club_id, role)` for `is_club_owner()` query performance
- [x] **DBROLE-06**: Auto-grant `'owner'` role (not generic `'organizer'`) to club creator on admin approval — change existing insert in `POST /api/admin/clubs/[id]`
- [x] **DBROLE-07**: `club_invitations` table with columns: id, club_id, inviter_id, invitee_email, token, status (pending/accepted/expired/revoked), expires_at, created_at — with RLS policies using `is_club_owner()`

### Dashboard

- [x] **DASH-01**: `/my-clubs/[id]` page with server-side role resolution — resolves user's club role in a single DB query, passes as prop to client components
- [x] **DASH-02**: Tabbed navigation — Overview, Events, Members, Settings — using shadcn Tabs component
- [x] **DASH-03**: URL-param tab state (`?tab=members`) for bookmarkable URLs and correct back-button behavior
- [x] **DASH-04**: Overview tab — club info summary (name, description, category, member count, pending invites count for owners)
- [x] **DASH-05**: Events tab consuming existing `GET /api/clubs/[id]/events` — list view with event title, date, status
- [x] **DASH-06**: Club-context event creation link from Events tab — navigates to `/create-event` with `clubId` pre-filled

### Members & Invitations

- [x] **MEM-01**: `GET /api/clubs/[id]/members` endpoint — returns members with user info and roles, accessible by club members only
- [x] **MEM-02**: Member list UI with role badges (owner/organizer) and joined date
- [x] **MEM-03**: Member removal by owner — confirmation dialog, self-removal guard (owner cannot remove themselves), `DELETE /api/clubs/[id]/members` endpoint
- [x] **MEM-04**: Direct organizer invitation by email — owner enters McGill email, generates invite with copy-link UX (no email delivery in v1.1)
- [x] **MEM-05**: `POST /api/clubs/[id]/invites` endpoint — owner-only, hardcodes `role='organizer'` server-side (never from client payload), validates invitee email exists in users table
- [x] **MEM-06**: Invitation acceptance flow — `/invites/[token]` page, validates token not expired, validates authenticated user email matches invitee_email, inserts into `club_members` as organizer
- [x] **MEM-07**: Pending invitations visible in Members tab — separate section showing pending invites with email and date
- [x] **MEM-08**: Invitation revocation by owner — delete/revoke pending invitation from Members tab *(P2)*

### Settings & Surface Fixes

- [ ] **SURF-01**: Owner UPDATE RLS policy on `clubs` table — scoped to own club via `is_club_owner()`, does NOT allow updating `status` column
- [ ] **SURF-02**: `PATCH /api/clubs/[id]` handler — owner-only, explicitly excludes `status` from updatable columns, uses authenticated client (not service role)
- [ ] **SURF-03**: Club settings form — react-hook-form + Zod validation for name, description, category, Instagram link, logo — owner-only, save button disabled until field changes detected
- [ ] **SURF-04**: Context-aware public club page (`/clubs/[id]`) — 3 CTA states: visitor sees "Request Organizer Access", organizer sees "Manage Club" link, owner sees "Manage Club" link
- [ ] **SURF-05**: Club selector dropdown on `/create-event` page — populated from user's `club_members` memberships, shown only if user is organizer of at least one club
- [ ] **SURF-06**: Auto-approval for events created by organizers for their own club — requires BOTH `club_organizer` role AND membership row in `club_members` for the specific `club_id`
- [ ] **SURF-07**: Updated post-creation messaging on `/clubs/create` success screen — explains pending review and auto-granted owner status upon approval

---

## v1.2 Requirements (Club Organizer Experience & Follow-Based Discovery)

*Defined: 2026-02-27 — PRD: docs/plans/2026-02-26-club-organizer-experience-prd.md*

### Follow System

- [x] **FOLLOW-01**: `club_followers` table with `user_id`, `club_id`, `created_at` — UNIQUE constraint on `(user_id, club_id)`, indexes on `club_id` and `user_id`, RLS policies for authenticated follow/unfollow and organizer read access
- [x] **FOLLOW-02**: `POST /api/clubs/[id]/follow` endpoint — authenticated users can follow an approved club, idempotent (no error on duplicate)
- [x] **FOLLOW-03**: `DELETE /api/clubs/[id]/follow` endpoint — authenticated users can unfollow a club
- [x] **FOLLOW-04**: `GET /api/clubs/[id]/follow` endpoint — returns whether the current user follows this club
- [x] **FOLLOW-05**: `GET /api/user/following` endpoint — returns list of clubs the current user follows
- [ ] **FOLLOW-06**: Follow/Unfollow button on club profile page (`/clubs/[id]`) — visible to authenticated users who are not members of the club
- [ ] **FOLLOW-07**: Follower count displayed on public club profile page
- [ ] **FOLLOW-08**: Follower count and follow data visible in organizer analytics dashboard (Overview tab)

## Deferred Requirements

### v1.2

- **DEFER-01**: Email-delivered invitations via Resend (ship copy-link first in v1.1, upgrade to email in v1.2)
- **DEFER-02**: Invitation expiry enforcement and re-send UI
- **DEFER-03**: Club analytics dashboard (event views, member growth) — interaction data already captured in `user_interactions` and `event_popularity_scores`
- **NGEN-03 through NGEN-06**: pg_cron scheduler configuration (carried from v1.0 Phase 4)

### v2+

- **DEFER-04**: Owner transfer flow — admin handles manually until graduation cycle data justifies the feature
- **DEFER-05**: Club archiving / soft-delete — requires cascading status changes across events, notifications, saved_events
- **DEFER-06**: Granular sub-organizer roles — only if specific clubs demonstrate the need

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Club deletion by organizers | Cascading data loss; admin-only destructive action |
| Event deletion by organizers | Breaks saved-event lists and interaction history; organizers edit, admins delete |
| Multi-level role hierarchy (moderator, treasurer, etc.) | Two roles (owner/organizer) cover all real campus club use cases |
| Open membership / self-serve organizer join | Club credibility depends on organizer trust; invitation-only |
| Real-time member presence / activity feed | Low-frequency university club activity; unnecessary complexity |
| Email notifications | SPF/DKIM, unsubscribe compliance, deliverability monitoring — beta is in-app only |
| Push notifications (browser/mobile) | Service worker, push API keys, permission prompts — defer to dedicated milestone |
| Logo upload via Supabase Storage | Evaluate during Phase 8 planning — ship text fields first, add logo as follow-up if low-risk |

## Traceability

Updated during roadmap creation. Phases 1-4 are v1.0, phases 5+ are v1.1.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NINF-01 | Phase 1 | Complete |
| NINF-02 | Phase 1 | Complete |
| NINF-03 | Phase 1 | Complete |
| NINF-04 | Phase 1 | Complete |
| NINF-05 | Phase 1 | Complete |
| NUI-01 | Phase 3 | Complete |
| NUI-02 | Phase 3 | Complete |
| NUI-03 | Phase 3 | Complete |
| NGEN-01 | Phase 3 | Complete |
| NGEN-02 | Phase 3 | Complete |
| NGEN-03 | Phase 4 | Deferred |
| NGEN-04 | Phase 4 | Deferred |
| NGEN-05 | Phase 4 | Deferred |
| NGEN-06 | Phase 4 | Deferred |
| COLD-01 | Phase 2 | Complete |
| COLD-02 | Phase 2 | Complete |
| COLD-03 | Phase 2 | Complete |
| COLD-04 | Phase 2 | Complete |
| COLD-05 | Phase 2 | Complete |
| COLD-06 | Phase 2 | Complete |
| COLD-07 | Phase 2 | Complete |
| COLD-08 | Phase 2 | Complete |
| DBROLE-01 | Phase 5 | Complete |
| DBROLE-02 | Phase 5 | Complete |
| DBROLE-03 | Phase 5 | Complete |
| DBROLE-04 | Phase 5 | Complete |
| DBROLE-05 | Phase 5 | Complete |
| DBROLE-06 | Phase 5 | Complete |
| DBROLE-07 | Phase 5 | Complete |
| DASH-01 | Phase 6 | Complete |
| DASH-02 | Phase 6 | Complete |
| DASH-03 | Phase 6 | Complete |
| DASH-04 | Phase 6 | Complete |
| DASH-05 | Phase 6 | Complete |
| DASH-06 | Phase 6 | Complete |
| MEM-01 | Phase 7 | Complete |
| MEM-02 | Phase 7 | Complete |
| MEM-03 | Phase 7 | Complete |
| MEM-04 | Phase 7 | Complete |
| MEM-05 | Phase 7 | Complete |
| MEM-06 | Phase 7 | Complete |
| MEM-07 | Phase 7 | Complete |
| MEM-08 | Phase 7 | Complete |
| SURF-01 | Phase 8 | Pending |
| SURF-02 | Phase 8 | Pending |
| SURF-03 | Phase 8 | Pending |
| SURF-04 | Phase 8 | Pending |
| SURF-05 | Phase 8 | Pending |
| SURF-06 | Phase 8 | Pending |
| SURF-07 | Phase 8 | Pending |

| FOLLOW-01 | Phase 9 | Complete |
| FOLLOW-02 | Phase 9 | Complete |
| FOLLOW-03 | Phase 9 | Complete |
| FOLLOW-04 | Phase 9 | Complete |
| FOLLOW-05 | Phase 9 | Complete |
| FOLLOW-06 | Phase 9 | Pending |
| FOLLOW-07 | Phase 9 | Pending |
| FOLLOW-08 | Phase 9 | Pending |

**Coverage:**
- v1.0 requirements: 22 total (18 complete, 4 deferred)
- v1.1 requirements: 28 total (27 P1, 1 P2)
- v1.2 requirements: 8 total (8 pending)
- Unmapped to phases: 0

---
*Requirements defined: 2026-02-23 (v1.0), 2026-02-25 (v1.1), 2026-02-27 (v1.2)*
*Last updated: 2026-02-27 — v1.2 Follow System requirements added, mapped to Phase 9*
