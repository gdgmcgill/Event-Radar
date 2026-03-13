# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Uni-Verse** is a campus event discovery platform for McGill University. Students can discover, filter, and save events happening on campus.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database & Auth**: Supabase (with `@supabase/ssr` for cookie-based sessions)
- **State Management**: Zustand (`src/store/useAuthStore.ts`)
- **Data Fetching**: SWR for client-side hooks
- **Icons**: Lucide React
- **Testing**: Jest with ts-jest

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npx jest                        # Run all tests
npx jest src/lib/sanitize.test  # Run a single test file
```

## Architecture

### Three Supabase Clients

The project has three distinct Supabase client factories — using the wrong one is a common mistake:

| Client | File | Use when |
|--------|------|----------|
| `createClient()` | `lib/supabase/client.ts` | Client components, React hooks (browser) |
| `createClient()` | `lib/supabase/server.ts` | Server Components, API routes (async, reads cookies) |
| `createServiceClient()` | `lib/supabase/service.ts` | Admin/cron routes that bypass RLS (uses service role key) |

All three are typed with `Database` from `lib/supabase/types.ts`.

### Auth Flow

- **Middleware** (`src/middleware.ts`) handles session refresh, protected route redirects, onboarding guard, and rate limiting
- **AuthProvider** wraps the app and calls `useAuthStore.initialize()` once
- **useAuthStore** (Zustand) is the single source of truth for current user state client-side — it listens to `onAuthStateChange` and enriches with profile data from the `users` table
- Sign-out goes through `/auth/signout` (server route) to properly clear cookies
- Protected routes: `/my-events`, `/create-event`, `/notifications`, `/profile`, `/my-clubs`, `/invites`

### Layout Architecture

- `RootLayout` → `AuthProvider` → `AppShell`
- `AppShell` conditionally renders `SideNavBar` + `Header` + `Footer` based on pathname
- Landing (`/landing`) and moderation (`/moderation/*`) pages get a minimal layout without nav/footer
- The app supports light and dark mode via `ThemeToggle` component (localStorage + system preference detection)

### Admin & Moderation

- Admin verification via `verifyAdmin()` in `lib/admin.ts` — checks `roles` array in the `users` table
- Audit logging via `logAdminAction()` in `lib/audit.ts` — writes to `admin_audit_log` table using service client
- Role helpers in `lib/roles.ts`: `isAdmin()`, `isOrganizer()`, `hasRole()`
- User roles: `"user"`, `"admin"`, `"club_organizer"`

### Recommendations & Experiments

- Content-based recommendation engine at `/api/recommendations` with tag matching and popularity fallback
- `RECOMMENDATION_THRESHOLD` (3 saved events) determines when personalized recs activate vs popularity fallback
- A/B testing system for recommendation algorithms (`/api/admin/experiments`)
- Interaction tracking (`/api/interactions`) feeds popularity scores

### Supabase Edge Functions

- `supabase/functions/events-webhook/` — Deno-based edge function (excluded from tsconfig)

## Key Patterns

- **Path alias**: `@/` maps to `src/`
- **API routes**: Return `NextResponse`, use `verifyAdmin()` for admin endpoints
- **Event status flow**: `pending` → `approved` | `rejected` (moderation pipeline)
- **Club status flow**: Same as events — clubs must be approved before becoming visible
- **Tags**: Use the `EventTag` enum from `src/types/index.ts`, not raw strings
- **Category theming**: Each `EventTag` has a full theme object in `EVENT_CATEGORIES` (colors, icons, gradients) in `lib/constants.ts`

## Database Schema

Main tables in Supabase:
- `events` — status (pending/approved/rejected), club_id, tags array
- `clubs` — organization info with approval status
- `users` — profiles with `roles` array and `interest_tags`
- `saved_events` — user↔event bookmarks
- `club_members` — user↔club membership with role
- `club_followers` — user↔club follow relationship
- `user_follows` — user↔user social graph
- `event_rsvps` — going/interested/cancelled
- `user_interactions` — view/click/save/share tracking for analytics
- `admin_audit_log` — moderation action history
- `notifications` — in-app notification system
- `experiments` / `experiment_variants` / `experiment_assignments` — A/B testing

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Important Notes

- Never modify `.env.local` — contains actual Supabase credentials
- McGill email validation is required for authentication
- Types in `src/types/index.ts` define all data structures — keep them in sync with the DB schema
- Test files (`*.test.ts`) are excluded from the main tsconfig and run via Jest separately
