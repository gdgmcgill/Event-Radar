# Uni-Verse

## What This Is

Uni-Verse is a campus event discovery platform for McGill University. Students discover, filter, and save events happening on campus. The platform includes personalized recommendations with a cold-start fallback, an in-app notification system, and a club organizer dashboard with member management and invitation flows.

## Core Value

Students discover relevant campus events effortlessly, and club organizers manage their clubs end-to-end without friction.

## Requirements

### Validated

- ✓ Event discovery with search and tag filtering — existing
- ✓ Cursor-based event pagination — existing
- ✓ Event saving/unsaving with heart button — existing
- ✓ OAuth authentication (McGill-only, Azure/Google) — existing
- ✓ User onboarding with interest tag selection — existing
- ✓ Event detail pages — existing
- ✓ Saved events page (My Events) — existing
- ✓ Admin dashboard (event/club/user CRUD) — existing
- ✓ Personalized recommendations via K-means clustering — existing
- ✓ Popular events section with popularity scoring — existing
- ✓ "Happening Now" events section — existing
- ✓ User interaction tracking (views, clicks, saves, shares) — existing
- ✓ Dark/light mode — existing
- ✓ Calendar view — existing
- ✓ Role-based access control (user, club_organizer, admin) — existing
- ✓ Middleware route protection and session refresh — existing
- ✓ Cold-start fallback feed with popularity scoring for new users — v1.0
- ✓ Onboarding nudge showing saves needed for personalized recommendations — v1.0
- ✓ Notifications table with RLS and dedup index — v1.0
- ✓ NotificationBell with unread count badge in Header — v1.0
- ✓ Admin approve/reject creates notifications for club organizers — v1.0
- ✓ Notification items link to /events/[event_id] — v1.0
- ✓ Club creation with admin approval — existing
- ✓ Club browsing and detail pages — existing
- ✓ Admin club moderation page — existing
- ✓ My Clubs listing page — existing
- ✓ Owner/organizer role distinction with DB constraints — v1.1
- ✓ is_club_owner() SECURITY DEFINER function — v1.1
- ✓ Auto-grant owner role on club approval — v1.1
- ✓ Club invitations table with RLS — v1.1
- ✓ Club dashboard at /my-clubs/[id] with tabbed navigation — v1.1
- ✓ Overview tab (name, description, category, member count) — v1.1
- ✓ Events tab consuming GET /api/clubs/[id]/events — v1.1
- ✓ Club-context event creation link from dashboard — v1.1
- ✓ Member list with role badges and removal by owner — v1.1
- ✓ Invitation system with copy-link UX — v1.1
- ✓ Invitation acceptance flow at /invites/[token] — v1.1
- ✓ Pending invitations visible in Members tab — v1.1

### Active

- [ ] Club settings editing from dashboard (name, description, category, Instagram)
- [ ] Context-aware public club page (visitor/organizer/owner CTAs)
- [ ] Club selector dropdown on /create-event
- [ ] Auto-approval for organizer-created events in their own club
- [ ] Updated post-creation messaging on /clubs/create

### Out of Scope

- Email/push notifications — in-app only, external channels deferred
- Notification preferences/settings — all on by default
- Real-time chat or messaging — unrelated
- Recommendation algorithm changes beyond cold start fix
- Club deletion by organizers — admin-only destructive action
- Event deletion by organizers — admin-only, organizers can edit
- Multi-level role hierarchy — two roles cover all use cases
- Open membership / self-serve organizer join — invitation-only
- Club analytics/stats dashboard — deferred

## Context

Shipped v1.0 (Cold Start Fix & Notifications) on 2026-02-23 and v1.1 Phases 5-7 (Database Foundation, Dashboard Shell, Members Tab) on 2026-02-26. Tech stack: Next.js 16, TypeScript strict, Supabase, Tailwind/shadcn/ui. Notification polling (60s) chosen over Realtime for simplicity. pg_cron reminder generation deferred to v1.2. Phase 8 (Settings Tab + Surface Fixes) is the remaining v1.1 work.

## Constraints

- **Database**: Supabase with RLS on all tables; SECURITY DEFINER functions for cross-row policies
- **Auth**: McGill email validation required; all API endpoints require authenticated user
- **Branding**: McGill color palette (Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4)
- **Stack**: Next.js App Router, Supabase client/server split, TypeScript strict mode, shadcn/ui

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 3+ saved events threshold for recommendations | Users need meaningful signal before personalization works | ✓ Good — v1.0 |
| Popularity scoring: >10 saves +2, 7-day recency +1 | Balances all-time popularity with temporal relevance | ✓ Good — v1.0 |
| Polling (60s) for notification bell | Simpler than Realtime for beta; adequate for low-volume | ✓ Good — v1.0 |
| Upsert with ignoreDuplicates for notification dedup | Atomic dedup aligned with DB unique constraint | ✓ Good — v1.0 |
| pg_cron deferred to v1.2 | pg_cron → pg_net auth friction; cron route exists but scheduling deferred | ⚠️ Revisit |
| Auto-grant owner on club approval | Absurd to require creators to request access to own club | ✓ Good — v1.1 |
| Owner/organizer role distinction | Owners manage settings + members; organizers create/edit events | ✓ Good — v1.1 |
| is_club_owner() SECURITY DEFINER | Prevents RLS infinite recursion for cross-row policies | ✓ Good — v1.1 |
| Direct invitations (no admin approval) | Owner's invitation is trusted — reduces admin bottleneck | ✓ Good — v1.1 |
| Copy-link invite UX (no email delivery) | Ship faster; email deferred to v1.2 | ✓ Good — v1.1 |
| Invite revocation via status update (not DELETE) | Preserves invitation history | ✓ Good — v1.1 |
| No event deletion for organizers | Prevents data loss; organizers edit, only admins delete | ✓ Good — v1.1 |

---
*Last updated: 2026-02-26 after v1.0 milestone completion*
