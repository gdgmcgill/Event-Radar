# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Next.js App Router with client/server separation and state management via Zustand

**Key Characteristics:**
- Server-side rendering with selective client interactivity
- Cursor-based pagination for event feeds
- Supabase as primary backend with real-time capabilities
- Client-side state management using Zustand (auth) and React hooks (data)
- Component-driven UI with shadcn/ui and Tailwind CSS
- Role-based access control (user, club_organizer, admin)

## Layers

**Presentation Layer (Components):**
- Purpose: Render UI and handle user interactions
- Location: `src/components/`
- Contains: React components organized by feature (events, layout, auth, clubs, etc.)
- Depends on: Hooks, utils, types, UI components
- Used by: Next.js page routes

**State Management Layer:**
- Purpose: Manage application state and authentication
- Location: `src/store/useAuthStore.ts`
- Contains: Zustand store for authenticated user state, roles, and interest tags
- Depends on: Supabase client, types
- Used by: AuthProvider, Header, SideNavBar, and auth-gated features

**Hooks Layer (Data & Logic):**
- Purpose: Encapsulate data fetching, business logic, and side effects
- Location: `src/hooks/`
- Key hooks:
  - `useEvents()`: Cursor-based event pagination with filtering
  - `useSavedEvents()`: Fetch user's saved event IDs
  - `useUser()`: User profile data
  - `useTracking()`: Event interaction tracking (views, clicks, saves, shares)
- Depends on: API routes, Supabase clients, types
- Used by: Components and pages

**API Layer:**
- Purpose: Server-side logic, database queries, and external integrations
- Location: `src/app/api/`
- Contains: Next.js API routes organized by resource (events, clubs, admin, auth)
- Patterns:
  - Event queries with cursor pagination: `GET /api/events`
  - Admin endpoints for event/club/user management: `GET|POST|PUT /api/admin/*`
  - User interactions tracking: `POST /api/interactions`
  - Recommendations: `GET /api/recommendations`
- Depends on: Supabase server client, database types, business logic utilities
- Used by: Client-side hooks and browser fetch requests

**Data Access Layer:**
- Purpose: Encapsulate Supabase database access and queries
- Location: `src/lib/supabase/`
- Contains:
  - `client.ts`: Browser Supabase client for client components
  - `server.ts`: Server Supabase client for API routes
  - `types.ts`: Auto-generated TypeScript types from Supabase schema
  - `service.ts`: Database query helpers
- Depends on: Supabase SDK, environment variables
- Used by: API routes and client hooks

**Utilities & Constants:**
- Purpose: Shared functions and configuration
- Location: `src/lib/` and `src/types/`
- Key files:
  - `utils.ts`: Date formatting, class merging (cn), McGill email validation
  - `constants.ts`: Event categories, API endpoints, McGill colors
  - `roles.ts`: Role checking functions (isAdmin, isOrganizer)
  - `types/index.ts`: TypeScript interfaces for all domain models

## Data Flow

**Event Discovery Flow (Home Page):**

1. User loads `/` → `src/app/page.tsx` (client component)
2. Component initializes with `useEvents()` hook
3. Hook calls `/api/events?limit=20&sort=start_date&direction=asc`
4. API route validates query params and executes Supabase query
5. Response includes: `{ events: Event[], total: number, nextCursor: string }`
6. Hook updates state and provides refetch/loadMore functions
7. Component renders `<EventGrid>` with paginated results
8. User clicks "Load More" → hook fetches next cursor page
9. Results append to existing list (append mode in hook)

**Save Event Flow (Interactive):**

1. User clicks heart button on `<EventCard>`
2. Component calls `POST /api/events/{id}/save`
3. Middleware validates authentication (protected route)
4. API creates/deletes record in `saved_events` table
5. Returns `{ saved: boolean }` with interaction tracking
6. Component updates local `isSaved` state
7. `useTracking()` logs interaction to `user_interactions` table

**Authentication Flow:**

1. User visits site → `src/app/layout.tsx` wraps with `<AuthProvider>`
2. Provider calls `useAuthStore.initialize()`
3. Store fetches user from Supabase: `supabase.auth.getUser()`
4. If auth session exists, fetches user profile from `public.users` table
5. Stores in Zustand: `{ user, loading, initialized }`
6. Middleware checks protected routes, redirects to `/` with `?signin=required`
7. User clicks Sign In → redirects to OAuth provider (Azure/Google)
8. Provider calls OAuth callback → `/auth/callback?code=...`
9. Callback validates McGill email, upserts profile, checks onboarding status
10. Redirects to `/onboarding` if needed, else to home
11. Onboarding captures `interest_tags` for recommendations

**Recommendations Flow (Post-Onboarding):**

1. Home page renders `<RecommendedEventsSection>` (requires 3+ saved events)
2. Component calls `/api/recommendations`
3. API uses user's `interest_tags` to fetch matching events
4. Implements K-means clustering to diversify results
5. Returns scored events ordered by personalization score
6. Component displays in horizontal scroll

**Popular/Trending Events:**

1. Home page shows `<PopularEventsSection>` for unauthenticated users
2. Component calls `/api/events/popular?limit=10`
3. API queries events sorted by `popularity_score` or `trending_score`
4. Popularity scores calculated by `/api/admin/calculate-popularity`
5. Admin job aggregates `user_interactions` data hourly
6. Scores based on: view_count, click_count, save_count, share_count, unique_viewers

**State Management:**

- **Auth State:** Zustand store (singleton, persists in browser memory for session)
- **Event Data:** React hook state (fetched from API, accumulated via pagination)
- **Saved Events:** Hook state (Set<string> of saved event IDs for quick lookup)
- **Filter State:** Component-level state (search query, selected tags)
- **Theme State:** localStorage (light/dark mode preference)

## Key Abstractions

**Event (Domain Model):**
- Purpose: Core entity representing a campus event
- Examples: `src/types/index.ts` (Event interface)
- Pattern: Immutable data passed from API → components
- Structure: `{ id, title, description, event_date, event_time, location, tags, club_id, status, ... }`

**EventFilter (Query Filter):**
- Purpose: Encapsulate filtering parameters for event queries
- Examples: `src/types/index.ts` (EventFilter interface)
- Pattern: Built by components, passed to `useEvents()`, serialized to query params
- Structure: `{ tags?, dateRange?, searchQuery?, clubId? }`

**User (Domain Model):**
- Purpose: Represents authenticated user with roles and preferences
- Examples: `src/types/index.ts` (User interface)
- Pattern: Stored in Zustand, fetched from Supabase `public.users` table
- Structure: `{ id, email, name, avatar_url, interest_tags, roles, ... }`

**UserInteraction (Analytics Event):**
- Purpose: Track user actions for analytics and recommendations
- Examples: `src/types/index.ts` (UserInteraction interface)
- Pattern: Sent to `/api/interactions` via `useTracking()` hook
- Types: 'view' | 'click' | 'save' | 'unsave' | 'share' | 'calendar_add'

**EventPopularityScore (Derived Data):**
- Purpose: Denormalized popularity metrics for efficient sorting
- Examples: `src/types/index.ts` (EventPopularityScore interface)
- Pattern: Calculated async via admin endpoint, stored in `event_popularity` table
- Structure: view_count, click_count, save_count, share_count, unique_viewers, popularity_score, trending_score

**Cursor (Pagination):**
- Purpose: Encode page position in opaque base64 token
- Pattern: Used in `useEvents()` for stateless cursor-based pagination
- Validation: UUID format check, finite number check, no PostgREST injection chars

## Entry Points

**Web Application Root:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to any route
- Responsibilities:
  - Set up AuthProvider (initializes Zustand store)
  - Render root HTML structure (dark mode detection via script)
  - Load global fonts (Inter from Google Fonts)
  - Set up SEO metadata

**Home Page:**
- Location: `src/app/page.tsx`
- Triggers: User navigates to `/` or follows default route
- Responsibilities:
  - Display hero section with search
  - Manage filter state (search query, selected tags)
  - Fetch events via `useEvents()` hook with pagination
  - Show "Happening Now", "Recommended", or "Popular" sections
  - Render EventGrid with load-more capability
  - Handle auth error messages from query params

**Event Details:**
- Location: `src/app/events/[id]/page.tsx`
- Triggers: User clicks event card or navigates to `/events/{id}`
- Responsibilities: Show full event details with RSVP/save options

**My Events (Saved):**
- Location: `src/app/my-events/page.tsx`
- Triggers: Authenticated user navigates to `/my-events`
- Responsibilities: Display user's saved events with remove option

**Admin Dashboard:**
- Location: `src/app/admin/page.tsx` and child routes
- Triggers: Admin user navigates to `/admin`
- Responsibilities: Manage events, clubs, users, view analytics

**OAuth Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth provider redirects with `code` parameter
- Responsibilities:
  - Exchange code for Supabase session
  - Validate McGill email domain
  - Upsert user profile to `public.users`
  - Check onboarding status and set cookie
  - Redirect to `/onboarding` or original destination

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request to application
- Responsibilities:
  - Refresh Supabase session if expired
  - Enforce route protection (redirect unauthenticated users from protected routes)
  - Enforce onboarding flow (redirect incomplete profiles)
  - Apply rate limiting to public API endpoints

## Error Handling

**Strategy:** Graceful degradation with user feedback

**Patterns:**

**API Error Handling (Server):**
- Try-catch blocks wrap Supabase calls
- Return NextResponse with appropriate status code (400, 401, 403, 500)
- Log error details server-side for debugging
- Return minimal error info to client (no stack traces)
- Example: `GET /api/events` returns `{ error: "Failed to fetch events" }` on DB error

**Hook Error Handling (Client):**
- `useEvents()` catches fetch errors, stores in state
- `useSavedEvents()` silently fails (no user feedback for non-critical)
- Components check error state and render error UI (AlertCircle icon with retry button)
- Example: EventGrid shows error message with "Try Again" button

**Component Error Handling (Client):**
- `<ErrorBoundary>` catches React render errors in subtrees
- Fallback UI displayed instead of blank screen
- Logs error boundary catches for monitoring
- Example: HomePage wrapped with ErrorBoundary showing fallback message

**Auth Error Handling:**
- Callback route validates McGill email; rejects non-McGill users
- Returns `?error=not_mcgill` query param to home page
- AuthProvider shows banner alert with error message
- User can retry sign-in

**Network Resilience:**
- Cursor-based pagination allows resuming from last position
- No exponential backoff implemented (would need retry library)
- Failed loads show retry button in UI

## Cross-Cutting Concerns

**Logging:**
- Browser console logs: `[Auth]`, `[Middleware]`, `[Callback]` prefixes
- Server logs: Includes error context and user info for debugging
- Structured logging not implemented (could use Pino or Winston)
- useTracking hook sends interaction events to API (for analytics, not logging)

**Validation:**

**Email Validation:**
- McGill domain check: `isMcGillEmail()` checks @mcgill.ca or @mail.mcgill.ca
- Used in auth callback to enforce McGill-only access

**Query Param Validation:**
- useEvents builds safe query params via URLSearchParams API
- API route validates sort field against whitelist: [start_date, created_at, popularity_score, trending_score]
- Cursor decoding validates UUID format and checks for injection characters

**Type Validation:**
- TypeScript strict mode enabled (all any types forbidden)
- Supabase auto-generated types in `src/lib/supabase/types.ts`
- Interface definitions prevent data shape mismatches

**Authentication:**

**Session Management:**
- Supabase handles OAuth session tokens (stored in cookies)
- Middleware refreshes expired tokens automatically
- AuthProvider initializes session on app load
- Zustand persists user data in memory for session duration

**Authorization:**

**Route Protection:**
- Middleware redirects unauthenticated users from protected routes
- Protected routes: `/my-events`, `/create-event`, `/notifications`, `/profile`

**Role-Based Access:**
- Functions `isAdmin()` and `isOrganizer()` check user.roles array
- Header and SideNavBar conditionally show organizer/admin nav items
- Admin routes protected at middleware level (checked in API routes via user.id lookup)

**Data Access Control:**
- API routes check auth (via supabase.auth.getUser())
- Saved events endpoint returns only current user's saves
- User profile endpoint returns only current user's data
- Admin endpoints check for "admin" role

---

*Architecture analysis: 2026-02-23*
