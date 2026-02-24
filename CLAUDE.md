# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Uni-Verse** is a campus event discovery platform for McGill University. Students can discover, filter, and save events happening on campus.

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router)
- **Language**: TypeScript 5.4.0 (strict mode)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database & Auth**: Supabase
- **Icons**: Lucide React

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints (events, recommendations, admin)
│   ├── events/[id]/       # Event detail page
│   ├── calendar/          # Calendar view
│   ├── my-events/         # Saved events
│   └── admin/             # Admin dashboard
├── components/
│   ├── ui/                # shadcn/ui primitives
│   ├── layout/            # Header, SideNavBar, Footer
│   └── events/            # EventCard, EventGrid, EventFilters, EventDetailsModal
├── lib/
│   ├── supabase/          # Supabase clients (client.ts for browser, server.ts for API)
│   ├── utils.ts           # cn(), formatDate(), formatTime(), isMcGillEmail()
│   └── constants.ts       # EVENT_TAGS, EVENT_CATEGORIES, MCGILL_COLORS
├── types/                 # TypeScript interfaces (Event, Club, User, SavedEvent)
└── hooks/                 # useEvents, useUser
```

### Key Patterns

- **Path alias**: Use `@/` for imports (maps to `src/`)
- **Client vs Server Components**: Home page is client component with state; API routes are server-only
- **Supabase clients**: Use `createClient()` from `@/lib/supabase/client` for browser, from `@/lib/supabase/server` for API routes
- **Component styling**: Use Tailwind classes and shadcn/ui components
- **API routes**: Return `NextResponse`, handle errors explicitly

### McGill Branding Colors

- Primary Red: `#ED1B2F`
- Burgundy: `#561c24`
- Sage: `#c7c7a3`
- Cream: `#e8d8c4`

## Database Schema

Main tables in Supabase:
- `events` - Event data with status (pending/approved/rejected), club_id, tags
- `clubs` - Organization information
- `users` - User profiles with interest_tags
- `saved_events` - User-event relationship for saved events

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Important Notes

- Never modify `.env.local` - contains actual Supabase credentials
- All code must satisfy TypeScript strict mode
- McGill email validation is required for authentication
- Types in `src/types/index.ts` define the data structures
