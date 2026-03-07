# Uni-Verse

## What This Is

Uni-Verse is a campus event discovery platform for McGill University — the "Luma for McGill" with a recommendation system. Club organizers create and manage their club pages, post events, invite team members, track analytics, and receive structured feedback from attendees. Students discover events, follow clubs, save events, and rate past events. The platform bridges the gap between event organizers who need visibility and students who want to find relevant campus events.

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
- Club organizers have a dedicated, functional club management experience (create, edit, post events, invite members, view analytics) — v2.0
- Public club pages show logo, name, description, follower count, upcoming/past events — v2.0
- Students can follow/unfollow clubs — v2.0
- Club organizers see event-level analytics (RSVPs, saves, clicks) and club-level trends (follower growth, total attendees) — v2.0
- Post-event review system where attendees rate events and organizers see aggregate feedback — v2.0
- Multi-club support for organizers who run multiple clubs, with easy switching — v2.0
- Smooth event creation flow with club selector for multi-club organizers — v2.0
- Auto-approval for events posted by club organizers for their own clubs — v2.0

### Active

(None yet — define with next milestone)

### Out of Scope

- User-to-user social features (friends, following users, attendance visibility, FOMO mechanics) — separate milestone after clubs are solid
- Sponsored events and paid promotions — separate monetization milestone
- Public-facing event reviews (student-visible review section) — defer until organizer-facing reviews are validated
- Real-time chat or messaging — high complexity, not core to event discovery
- Mobile app — web-first approach

## Context

Shipped v2.0 with 29,454 LOC TypeScript across Next.js 16 / Supabase / Tailwind + shadcn/ui.

The club organizer experience is now fully functional: club management dashboard with settings, members, events, and analytics tabs. Public club pages with follow system. Event creation/editing/duplication with auto-approval. Post-event star rating reviews with aggregate data for organizers.

Database tables: events, clubs, users, saved_events, notifications, club_members, club_invitations, club_followers, user_interactions, reviews. RLS policies enforce owner-only mutations.

Key technical patterns: URL-driven club context (/my-clubs/[id]), SWR hooks for all data fetching, fire-and-forget notification fanout, multi-mode form pattern (create/edit/duplicate), Recharts for analytics charts.

## Constraints

- **Tech stack**: Next.js 16 (App Router), TypeScript strict mode, Tailwind CSS + shadcn/ui, Supabase (auth, DB, RLS) — must stay on existing stack
- **Auth**: McGill email domain enforcement via Google OAuth — non-negotiable
- **Branding**: McGill color palette (Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4)
- **Deployment**: Vercel (US East) — existing infrastructure
- **Database**: Supabase with RLS — security policies must be maintained

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rework clubs from scratch | Current code is too messy and fragmented to salvage | Good |
| Fix clubs before social features | Organizer UX is the foundation — no events without organizers | Good |
| Simple single-page club management | Organizers want simplicity, not a complex dashboard | Good |
| Club list + quick-switch dropdown for multi-club | Best of both worlds — overview + fast navigation | Good |
| Post-event reviews (organizer-facing first) | Validates the review concept before building public reviews | Good |
| Sponsorships as separate milestone | Get core functionality right before adding monetization | Good |
| URL-driven club context (/my-clubs/[id]) | No global state needed, deep-linkable, SSR-friendly | Good |
| RLS as primary security boundary | Database-level enforcement, not just API checks | Good |
| Live COUNT for follower/member counts | Avoids trigger complexity, always accurate | Good |
| Fire-and-forget notification fanout | Non-blocking, keeps event creation fast | Good |
| Multi-mode form pattern (create/edit/duplicate) | Single component, less code, consistent UX | Good |

---
*Last updated: 2026-03-06 after v2.0 milestone*
