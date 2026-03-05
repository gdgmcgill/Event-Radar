# Uni-Verse

## What This Is

Uni-Verse is a campus event discovery platform for McGill University — the "Luma for McGill" with a recommendation system. Club organizers create and manage their club pages, post events, and track analytics. Students discover events, follow clubs, and (in the future) connect with friends to see who's attending. The platform bridges the gap between event organizers who need visibility and students who want to find relevant campus events.

## Core Value

Club organizers can effortlessly manage their clubs and post events, while students can discover and engage with campus events that matter to them — if organizers can't use the platform smoothly, there are no events, and without events, there are no students.

## Requirements

### Validated

- User can sign in via Google OAuth with McGill email enforcement — existing
- User sees personalized event recommendations via Two-Tower model — existing
- User can save/unsave events — existing
- User can browse and filter events by tags, search, and date — existing
- Admin can approve/reject pending events and clubs — existing
- User receives notifications for event reminders and admin actions — existing
- New users with <3 saved events see popularity-ranked fallback feed — existing
- Instagram scraper pipeline classifies and ingests events — existing
- User can select interest tags during onboarding — existing

### Active

- [ ] Club organizers have a dedicated, functional club management experience (create, edit, post events, invite members, view analytics)
- [ ] Public club pages show logo, name, description, follower count, upcoming/past events
- [ ] Students can follow/unfollow clubs
- [ ] Club organizers see event-level analytics (RSVPs, attendance, clicks) and club-level trends (follower growth, total attendees)
- [ ] Post-event review system where attendees rate events and organizers see aggregate feedback
- [ ] Multi-club support for organizers who run multiple clubs, with easy switching
- [ ] Smooth event creation flow with club selector for multi-club organizers
- [ ] Auto-approval for events posted by club organizers for their own clubs

### Out of Scope

- User-to-user social features (friends, following users, attendance visibility, FOMO mechanics) — separate milestone after clubs are solid
- Sponsored events and paid promotions — separate monetization milestone
- Public-facing event reviews (student-visible review section) — defer until organizer-facing reviews are validated
- Real-time chat or messaging — high complexity, not core to event discovery
- Mobile app — web-first approach

## Context

This is a brownfield project with an existing Next.js 16 / Supabase / TypeScript codebase. The current club functionality is broken and incomplete — there is no dedicated club management page, no analytics, and the organizer UX is fragmented across scattered pages. The decision is to rework clubs from scratch rather than salvage the existing broken implementation.

The platform has two user types:
1. **Club organizers** — create clubs, post events, invite co-owners, track analytics. They are the supply side and the platform's backbone.
2. **Students** — discover events, follow clubs, save events, provide feedback. They are the demand side.

The recommendation system (external Python/FastAPI Two-Tower model) is already functional. The event ingestion pipeline (Apify Instagram scraper) is also working. The core gap is the organizer experience.

Existing database has: events, clubs, users, saved_events, notifications, club_members, club_invitations, club_followers, user_interactions tables. Many have RLS policies but the application layer doesn't properly leverage them.

## Constraints

- **Tech stack**: Next.js 16 (App Router), TypeScript strict mode, Tailwind CSS + shadcn/ui, Supabase (auth, DB, RLS) — must stay on existing stack
- **Auth**: McGill email domain enforcement via Google OAuth — non-negotiable
- **Branding**: McGill color palette (Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4)
- **Deployment**: Vercel (US East) — existing infrastructure
- **Database**: Supabase with RLS — security policies must be maintained

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rework clubs from scratch | Current code is too messy and fragmented to salvage | — Pending |
| Fix clubs before social features | Organizer UX is the foundation — no events without organizers | — Pending |
| Simple single-page club management | Organizers want simplicity, not a complex dashboard | — Pending |
| Club list + quick-switch dropdown for multi-club | Best of both worlds — overview + fast navigation | — Pending |
| Post-event reviews (organizer-facing first) | Validates the review concept before building public reviews | — Pending |
| Sponsorships as separate milestone | Get core functionality right before adding monetization | — Pending |

---
*Last updated: 2026-03-05 after initialization*
