# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Next.js App Router monolith with Supabase BaaS + Postgres-native recommendation scoring engine

**Key Characteristics:**
- Client-heavy SPA pattern: most pages are `"use client"` components that fetch data via internal API routes
- API routes serve as a thin server-side layer between the React frontend and Supabase
- Zustand global store for auth state; React hooks for data fetching
- Recommendations computed entirely in Postgres via `compute_user_scores()` (pg_cron every 6h) — no external service
- Instagram scraper pipeline (Apify) feeds events through a classifier into the database

## Layers

**Presentation Layer (Client Components):**
- Purpose: Render UI, handle user interactions, manage local/global state
- Location: `src/app/*/page.tsx`, `src/components/`
- Contains: React components marked `"use client"`, Tailwind styling, shadcn/ui primitives
- Depends on: Hooks layer, Zustand store, API layer (via fetch)
- Used by: End users in the browser

**Hooks Layer:**
- Purpose: Encapsulate data fetching logic and side effects for client components
- Location: `src/hooks/`
- Contains: `useEvents.ts` (cursor-paginated event fetching), `useUser.ts` (Supabase auth user), `useSavedEvents.ts` (saved event IDs), `useTracking.ts` (interaction/recommendation feedback tracking)
- Depends on: API routes (via fetch), Supabase browser client
- Used by: Page components and feature components

**State Management Layer:**
- Purpose: Global auth state shared across the entire client app
- Location: `src/store/useAuthStore.ts`
- Contains: Zustand store with user profile, loading state, initialization logic
- Depends on: `src/lib/supabase/client.ts` (browser Supabase client)
- Used by: All client components needing auth context
- Pattern: Single store initialized once by `AuthProvider`, listens to `onAuthStateChange`

**API Route Layer:**
- Purpose: Server-side data access, auth verification, external service orchestration
- Location: `src/app/api/`
- Contains: Next.js Route Handlers exporting `GET`, `POST`, `PATCH`, `DELETE` functions
- Depends on: Supabase server client (`src/lib/supabase/server.ts`), service client (`src/lib/supabase/service.ts`)
- Used by: Client hooks and components (via `fetch`)

**Library/Utility Layer:**
- Purpose: Shared helpers, constants, Supabase client factories, domain logic
- Location: `src/lib/`
- Contains: Supabase client factories, utility functions, constants, classifier logic, role helpers, admin verification
- Depends on: Supabase SDK, external packages (clsx, date-fns)
- Used by: API routes, hooks, components

**Type Definitions Layer:**
- Purpose: TypeScript interfaces matching the Supabase database schema
- Location: `src/types/index.ts`
- Contains: All shared interfaces (`Event`, `Club`, `User`, `SavedEvent`, `Notification`, `EventFilter`, etc.)
- Depends on: Nothing
- Used by: All other layers

**Data Ingestion Layer (Classifier Pipeline):**
- Purpose: Classify Instagram posts as events and extract structured data
- Location: `src/lib/classifier.ts`, `src/lib/classifier-pipeline.ts`
- Contains: Heuristic event classifier, Apify output normalizer, webhook sender
- Depends on: Nothing (pure functions + fetch for webhook)
- Used by: Scripts in `scripts/`, potentially cron jobs

## Data Flow

**Event Discovery (Main Page):**

1. `src/app/page.tsx` renders `HomePageContent` (client component)
2. `useEvents` hook calls `GET /api/events` with filter params and cursor pagination
3. `src/app/api/events/route.ts` queries Supabase `events` table, transforms rows (maps DB tags to `EventTag` enum, normalizes date fields)
4. Response returned as `{ events, total, page, limit, totalPages }`
5. Client filters results locally (search query, tag selection) via `applyFilters`
6. `HappeningNowSection`, `PopularEventsSection`, `RecommendedEventsSection` each make independent API calls

**Personalized Recommendations:**

1. `RecommendedEventsSection` calls `GET /api/recommendations`
2. API route authenticates user, reads pre-computed scores from Supabase (produced by `compute_user_scores()`)
3. Scores are computed using a 5-signal formula: tag affinity (0.35), interaction (0.25), popularity (0.20), recency (0.15), social (0.05)
4. Tag hierarchy enables partial affinity matching; session boost applied for within-session reactivity
5. MMR diversity re-ranking applied before returning results
6. Generates human-readable explanation for each recommendation
7. Returns ranked recommendations with explanations to client
8. Falls back to popularity-ranked results if no personalized scores exist yet for the user

**User Interaction Tracking:**

1. Client components call `useTracking` hook methods (trackClick, trackShare, etc.)
2. Hook fires `POST /api/interactions` with event_id, interaction_type, source, session_id
3. API route validates payload, verifies event exists, inserts into `user_interactions` table
4. Recommendation feedback goes to `POST /api/recommendations/feedback` separately

**Authentication Flow:**

1. User clicks sign-in (Google OAuth via Supabase)
2. Supabase redirects to `GET /auth/callback` after OAuth
3. `src/app/auth/callback/route.ts` exchanges code for session, enforces McGill email domain
4. Upserts user profile into `public.users` table, auto-assigns admin role if email matches `ADMIN_EMAILS`
5. Checks if user needs onboarding (no interest_tags), redirects to `/onboarding` if needed
6. Client-side: `AuthProvider` initializes `useAuthStore` which listens to `onAuthStateChange`
7. Store sets basic user immediately, then background-fetches roles/interest_tags from `users` table

**State Management:**
- Auth state: Zustand store (`useAuthStore`) initialized once by `AuthProvider` in root layout
- Event data: Local React state in hooks (`useEvents`, `useSavedEvents`)
- UI state: Local component state (filters, search, modals)
- No server-side state caching or Redis; each request hits Supabase directly

## Key Abstractions

**Supabase Client Factory (3 variants):**
- Purpose: Create typed Supabase clients for different contexts
- Browser client: `src/lib/supabase/client.ts` - `createClient()` using `createBrowserClient`
- Server client: `src/lib/supabase/server.ts` - `createClient()` using `createServerClient` with cookie access
- Service client: `src/lib/supabase/service.ts` - `createServiceClient()` using service role key (bypasses RLS)
- Pattern: All return `SupabaseClient<Database>` typed with `src/lib/supabase/types.ts`

**Event Classifier:**
- Purpose: Classify Instagram posts as events using weighted heuristic signals
- Files: `src/lib/classifier.ts`, `src/lib/classifier-pipeline.ts`
- Pattern: Pure functions with confidence scoring (0-1), partitioned into auto_pending/manual_review/auto_discard
- Pipeline: Apify output -> normalize -> classifyBatch -> partitionByAction -> webhook

**Admin Verification:**
- Purpose: Guard admin-only API routes
- File: `src/lib/admin.ts`
- Pattern: `verifyAdmin()` returns `{ supabase, user, isAdmin }` - caller checks `isAdmin`

**Role System:**
- Purpose: Check user roles (user, admin, club_organizer)
- File: `src/lib/roles.ts`
- Pattern: Pure helper functions `hasRole()`, `isAdmin()`, `isOrganizer()` operating on `User` type

**API Endpoint Constants:**
- Purpose: Centralized URL constants for all API routes
- File: `src/lib/constants.ts` (`API_ENDPOINTS` object)
- Note: Not consistently used - many components hardcode fetch URLs

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page load
- Responsibilities: Wraps app in `AuthProvider`, renders `SideNavBar`, `Header`, `Footer`, applies Inter font and theme script

**Home Page:**
- Location: `src/app/page.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Event discovery hub - search, filters, happening now, popular/recommended events, paginated event grid

**Auth Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Supabase/Azure
- Responsibilities: Session exchange, McGill email enforcement, user profile upsert, admin auto-assignment, onboarding redirect

**Sign Out:**
- Location: `src/app/auth/signout/route.ts`
- Triggers: POST from `useAuthStore.signOut()`
- Responsibilities: Server-side sign out to properly clear cookies

**Events API:**
- Location: `src/app/api/events/route.ts`
- Triggers: GET requests from `useEvents` hook
- Responsibilities: Paginated event query with tag/search/date filters, DB-to-frontend field transformation

**Cron Job:**
- Location: `src/app/api/cron/send-reminders/route.ts`
- Triggers: Scheduled (likely Vercel cron)
- Responsibilities: Send event reminders to users

## Error Handling

**Strategy:** Per-route try/catch with `NextResponse.json({ error }, { status })` pattern

**Patterns:**
- API routes wrap entire handler in try/catch, return 500 with error message
- Client hooks store `Error | null` in state, expose to components
- `ErrorBoundary` component (`src/components/ErrorBoundary.tsx`) wraps page sections
- Recommendation service failures fall back gracefully: returns empty recommendations, client falls back to `PopularEventsSection`
- Auth callback handles multiple error scenarios with specific error codes redirected as query params

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error`/`console.warn` throughout. Auth store uses `[Auth]` prefix. No structured logging framework.

**Validation:** Manual validation in API routes (check required fields, validate enum values). No validation library (no Zod/Yup). McGill email validation via regex in `src/lib/utils.ts` and `src/app/auth/callback/route.ts`.

**Authentication:** Supabase Auth with Google OAuth (Azure AD). McGill email domain enforced at callback. Session managed via cookies (SSR-compatible). Three-tier client pattern (browser/server/service). Admin emails hardcoded via `ADMIN_EMAILS` env var.

**Authorization:** Role-based (`user`, `admin`, `club_organizer`). Admin routes use `verifyAdmin()` from `src/lib/admin.ts`. Supabase RLS policies enforced at database level (see `supabase/migrations/002_rls_policies.sql`, `011_rls_audit.sql`).

**API Documentation:** Swagger/JSDoc annotations on some API routes (events, interactions, popular). Served via `src/app/docs/page.tsx` with RedocUI component.

---

*Architecture analysis: 2026-03-05*
