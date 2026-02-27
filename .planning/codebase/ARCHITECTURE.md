# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Next.js 16 full-stack application using App Router pattern with layered architecture consisting of client components, API route handlers, and server-side logic all in single codebase.

**Key Characteristics:**
- Hybrid client/server components (using "use client" directive for client-side interactivity)
- REST API endpoints with Next.js API routes in `src/app/api/`
- Supabase for database, auth, and real-time features
- Zustand for client-side state management
- Cursor-based pagination for efficient data fetching
- Role-based access control (user, club_organizer, admin)
- Type-safe database layer using generated Supabase types

## Layers

**Presentation Layer (Components & Pages):**
- Purpose: Render UI, collect user input, display data from server/API
- Location: `src/app/` (pages via App Router), `src/components/`
- Contains: Page components, layout components, UI primitives, event filters, forms
- Depends on: Custom hooks, stores (Zustand), utility functions, types
- Used by: Browser/user interaction

**Data Fetching & State Layer:**
- Purpose: Manage client-side data fetching, pagination, caching; server-side session management
- Location: `src/hooks/` (custom hooks), `src/store/` (Zustand stores), `src/lib/supabase/`
- Contains: `useEvents` (cursor pagination), `useSavedEvents`, `useUser`, `useAuthStore`
- Depends on: Supabase clients, API routes, types
- Used by: Presentation layer components

**API Layer (Route Handlers):**
- Purpose: Expose REST endpoints for CRUD operations, data aggregation, business logic
- Location: `src/app/api/`
- Contains: Route handler files organized by resource (events, clubs, admin, interactions, recommendations, etc.)
- Depends on: Supabase server client, auth verification, type transformations
- Used by: Client components (via fetch/hooks), external systems (webhooks)

**Server Integration Layer:**
- Purpose: Database access, authentication, session management, service operations
- Location: `src/lib/supabase/`, `src/middleware.ts`
- Contains: Supabase client factories (client/server), middleware for auth/rate limiting
- Depends on: Supabase SDK, Next.js server features
- Used by: API routes, page components, middleware

**Utilities & Helpers Layer:**
- Purpose: Reusable functions for formatting, validation, classification, image handling
- Location: `src/lib/`
- Contains: Utils (`cn`, formatting functions), constants, roles, tag mapping, ML classifier
- Depends on: Date libraries (date-fns), types
- Used by: All layers

**Type System:**
- Purpose: Define data structures matching Supabase schema + domain types
- Location: `src/types/index.ts`
- Contains: Event, Club, User, SavedEvent, RSVP, Notification, UserInteraction interfaces
- Depends on: None (defines contracts)
- Used by: All layers

## Data Flow

**Event Browsing Flow:**

1. User loads home page (`src/app/page.tsx`)
2. HomePageContent initializes `useEvents` hook with filters
3. Hook builds query params using `buildQueryParams` and calls `GET /api/events`
4. API route (`src/app/api/events/route.ts`) queries Supabase with cursor pagination
5. Database returns event batch + next cursor
6. Hook updates state; component renders EventGrid
7. User scrolls/filters; hook calls `loadMore()` with next cursor
8. New batch fetched and appended to events array

**Save Event Flow:**

1. User clicks save button on EventCard (`src/components/events/EventCard.tsx`)
2. Component calls `POST /api/events/{id}/save`
3. API route verifies auth, checks if event exists
4. If already saved, deletes from `saved_events` table; else inserts
5. Returns `{ saved: true/false }`
6. Hook `useSavedEvents` updates local saved IDs set
7. UI reflects toggle (button fills/empties)

**Recommendation Flow:**

1. User has 3+ saved events (meets `RECOMMENDATION_THRESHOLD`)
2. Home page renders `RecommendedEventsSection` instead of `PopularEventsSection`
3. Section fetches recommendations from `GET /api/recommendations`
4. API queries similarity clusters and returns scored events
5. Events displayed with personalized ranking

**Admin Moderation Flow:**

1. Admin navigates to `/moderation/events`
2. ModerationNav enforces role check via `isAdmin(user)` from `src/lib/roles.ts`
3. Page fetches pending events from `GET /api/admin/events`
4. Admin approves/rejects event via `PATCH /api/admin/events/{id}/status`
5. Status updates propagate to event lists and notifications

**State Management:**
- Global auth state: `useAuthStore` (Zustand) - holds user info, loading state
- Session management: Middleware at `src/middleware.ts` refreshes Supabase session on each request
- Local component state: React hooks (useState, useCallback, useMemo) for UI state
- Derived/cached queries: Custom hooks manage request state and caching

## Key Abstractions

**Supabase Client Factories:**
- Purpose: Separate browser (client-side) and server (API/middleware) Supabase client creation
- Examples: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Pattern: Factory functions returning configured Supabase client with auth state management

**Event Cursor Pagination System:**
- Purpose: Efficiently paginate large event lists without offset (which is O(n) on large datasets)
- Examples: `useEvents` hook, `buildQueryParams`, `decodeCursor`/`encodeCursor` in route.ts
- Pattern: Base64-encoded cursors containing sort field value + ID; client requests next/prev page

**Hook-Based Data Fetching:**
- Purpose: Encapsulate API calls and state management in reusable custom hooks
- Examples: `useEvents`, `useSavedEvents`, `useUser`, `useTracking`
- Pattern: Hook returns `{ data, loading, error, refetch, loadMore }` interface

**Role-Based Access Control (RBAC):**
- Purpose: Gate features and routes by user role (user, club_organizer, admin)
- Examples: `isAdmin()`, `isOrganizer()` in `src/lib/roles.ts`; route protection in middleware
- Pattern: User has `roles: UserRole[]` array; check membership before exposing UI/endpoints

**Component Composition with Error Boundaries:**
- Purpose: Gracefully handle rendering errors in subtrees
- Examples: `ErrorBoundary` component wrapping sections in pages
- Pattern: Class-based boundary catches errors, renders fallback UI, allows reset

**Event Tag Classification Pipeline:**
- Purpose: Normalize and classify events across multiple data sources (manual, Instagram, admin)
- Examples: `src/lib/classifier.ts`, `src/lib/tagMapping.ts`, `transformEventFromDB`
- Pattern: Transform DB tags → EventTag enum; classify Instagram posts → database events

## Entry Points

**Web Application:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Render home feed, manage filter/search state, display event sections

**Authentication Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Supabase Auth
- Responsibilities: Exchange auth code for session, set cookies, redirect to app

**API Events List:**
- Location: `src/app/api/events/route.ts`
- Triggers: GET request with optional filters, cursor, sort parameters
- Responsibilities: Query events with pagination, apply filters, return JSON response

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request (configured via matcher)
- Responsibilities: Refresh auth session, verify McGill email, protect routes, rate limit

**Event Detail Page:**
- Location: `src/app/events/[id]/page.tsx`
- Triggers: Browser navigation to `/events/{id}`
- Responsibilities: Fetch single event, render details, show RSVP/save buttons

## Error Handling

**Strategy:** Explicit try-catch blocks in API routes with status codes; fallback error states in components

**Patterns:**

- API routes wrap all logic in try-catch, return `NextResponse.json({ error: message }, { status: code })`
  - 401 Unauthorized: Missing/invalid auth
  - 404 Not Found: Resource doesn't exist
  - 500 Internal Server Error: Database/unexpected failures
  - Example: `src/app/api/events/[id]/save/route.ts` lines 17-44

- Client components use ErrorBoundary wrapper for React rendering errors
  - Example: `src/app/page.tsx` wraps content in `<ErrorBoundary>`
  - Displays user-friendly fallback message with retry button

- Hooks return error object in state: `const { error, loading } = useEvents()`
  - Component conditionally renders error UI or data
  - Example: `src/app/page.tsx` lines 369-391 checks `if (errorMessage)`

- Async operations log errors to console for debugging
  - Example: `console.error("[Auth] Failed to fetch profile:", err)` in `useAuthStore`

## Cross-Cutting Concerns

**Logging:** Console.log throughout codebase with `[Context]` prefix (e.g., `[Auth]`, `[Middleware]`). No centralized logger configured.

**Validation:**
- Input validation in API routes (cursor format, sort fields, limits)
  - Example: `decodeCursor` validates UUID format, sort values in `src/app/api/events/route.ts` lines 40-58
- Supabase RLS (Row Level Security) provides database-level access control

**Authentication:**
- Supabase Auth (OAuth via McGill login)
- Session stored in HTTP-only cookies managed by middleware
- `useAuthStore` syncs auth state to client on load
- Protected routes redirect unauthenticated users to `/` with `signin=required` param

**Rate Limiting:** Custom middleware in `src/middlewareRateLimit.ts` applied at request level before auth

**Interactions Tracking:** `POST /api/interactions` records user actions (view, click, save, share) for popularity/recommendation algorithms

---

*Architecture analysis: 2026-02-25*
