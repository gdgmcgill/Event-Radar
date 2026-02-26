# Uni-Verse

## What This Is

Uni-Verse is a campus event discovery platform for McGill University. Students discover, filter, and save events happening on campus. Club organizers manage their clubs, create events, and collaborate with co-organizers through a unified dashboard experience.

## Core Value

Club organizers must have a seamless, unified experience from club creation through event management — no broken flows, no dead ends, no unnecessary admin bottlenecks.

## Current Milestone: v1.1 Club Organizer UX Overhaul

**Goal:** Fix the fragmented club organizer flow so that creating a club, becoming its organizer, managing members, and creating events is one cohesive, intuitive experience.

**Target features:**
- Auto-grant organizer status to club creator upon admin approval
- Club dashboard (`/my-clubs/[id]`) with tabs: Overview, Events, Members, Settings
- Owner/organizer role distinction for member management
- Direct organizer invitations (no admin approval needed)
- Club-context event creation for organizers
- Context-aware public club page (different CTAs for organizers vs regular users)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Event discovery with search and tag filtering — v1.0
- ✓ Cursor-based event pagination — v1.0
- ✓ Event saving/unsaving with heart button — v1.0
- ✓ OAuth authentication (McGill-only, Azure/Google) — v1.0
- ✓ User onboarding with interest tag selection — v1.0
- ✓ Event detail pages — v1.0
- ✓ Saved events page (My Events) — v1.0
- ✓ Admin dashboard (event/club/user CRUD) — v1.0
- ✓ Personalized recommendations via K-means clustering — v1.0
- ✓ Popular events section with popularity scoring — v1.0
- ✓ "Happening Now" events section — v1.0
- ✓ User interaction tracking (views, clicks, saves, shares) — v1.0
- ✓ Dark/light mode — v1.0
- ✓ Calendar view — v1.0
- ✓ Role-based access control (user, club_organizer, admin) — v1.0
- ✓ Middleware route protection and session refresh — v1.0
- ✓ Cold start fallback feed for new users — v1.0
- ✓ In-app notification system (bell, inbox, admin triggers) — v1.0
- ✓ Club creation with admin approval — v1.0
- ✓ Organizer request flow — v1.0
- ✓ Club browsing and detail pages — v1.0
- ✓ Admin club moderation page — v1.0
- ✓ Admin organizer request moderation — v1.0
- ✓ My Clubs listing page — v1.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Club creator auto-granted organizer (owner) status upon admin approval
- [ ] Club dashboard at `/my-clubs/[id]` with tabbed UI (Overview, Events, Members, Settings)
- [ ] Owner vs organizer role distinction in `club_members` table
- [ ] Organizer invitation system (owner invites by email, no admin approval)
- [ ] Club settings editing (name, description, category, Instagram, logo) for owners
- [ ] Club-context event creation from dashboard (pre-fills club_id, auto-approved)
- [ ] Event management for organizers (view, edit events from dashboard)
- [ ] Member list view for all organizers, management for owners
- [ ] Context-aware public club page (different CTAs based on user's relationship to club)
- [ ] Club selector on `/create-event` page for organizers
- [ ] Updated post-creation messaging on `/clubs/create`

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Club deletion by organizers — admin-only destructive action for now
- Event deletion by organizers — admin-only, organizers can edit but not delete
- Club analytics/stats dashboard — deferred to future milestone
- Club following/favoriting by regular users — deferred
- Multi-level role hierarchy beyond owner/organizer — unnecessary complexity
- Organizer request flow changes — existing admin-mediated flow remains for non-creators

## Context

- `POST /api/admin/clubs/[id]` already auto-grants organizer + club_member on approval — but `club_members.role` uses generic "organizer" with no owner distinction
- `club_members` table has `role TEXT` column with no CHECK constraint — needs owner/organizer distinction
- `PATCH /api/events/[id]` supports editing by club organizers (checks membership) but no frontend exists
- `GET /api/clubs/[id]/events` returns all events for a club (organizer-only) — ready for dashboard use
- `CreateEventForm` accepts optional `clubId` prop but it's never passed from the UI
- `/my-clubs` page links to `/my-clubs/[id]` but that page doesn't exist — dead link
- Public club detail page shows "Request Organizer Access" to everyone including existing organizers

## Constraints

- **Stack**: Next.js App Router, Supabase, TypeScript strict mode, shadcn/ui, Tailwind CSS
- **Auth**: All organizer endpoints require authenticated user with club_organizer role
- **Database**: Changes via SQL migrations in `supabase/migrations/`
- **Branding**: McGill color palette (Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4)
- **Existing patterns**: Follow established API route patterns (service client for admin ops, RLS for user ops)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-grant organizer on club approval | Absurd to require creators to request access to their own club | — Pending |
| Owner/organizer role distinction | Owners manage club settings + members; organizers create/edit events only | — Pending |
| Direct invitations (no admin approval) | Owner's invitation is trusted — reduces admin bottleneck | — Pending |
| Tabbed dashboard layout | Single hub for all club management — Overview/Events/Members/Settings | — Pending |
| No event deletion for organizers | Prevents data loss; organizers edit, only admins delete | — Pending |

---
*Last updated: 2026-02-25 after milestone v1.1 initialization*
