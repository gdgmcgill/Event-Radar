# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
Event-Radar/
├── src/
│   ├── app/                           # Next.js App Router (pages & API routes)
│   │   ├── api/                       # Server-side API endpoints
│   │   │   ├── events/
│   │   │   │   ├── route.ts           # GET /api/events (paginated events list)
│   │   │   │   ├── popular/
│   │   │   │   │   └── route.ts       # GET /api/events/popular
│   │   │   │   └── [id]/
│   │   │   │       └── save/
│   │   │   │           └── route.ts   # POST /api/events/{id}/save
│   │   │   ├── clubs/                 # Club endpoints
│   │   │   ├── admin/                 # Admin panel endpoints
│   │   │   │   ├── events/            # Admin event management
│   │   │   │   ├── clubs/             # Admin club management
│   │   │   │   ├── users/             # Admin user management
│   │   │   │   ├── organizer-requests/# Organizer approval requests
│   │   │   │   ├── stats/             # Admin analytics
│   │   │   │   └── calculate-popularity/ # Recalculate popularity scores
│   │   │   ├── interactions/          # POST /api/interactions (track user actions)
│   │   │   ├── recommendations/       # GET /api/recommendations
│   │   │   ├── user/
│   │   │   │   └── engagement/        # User engagement stats
│   │   │   ├── auth/                  # Auth endpoints
│   │   │   │   ├── callback/          # GET /auth/callback (OAuth handler)
│   │   │   │   └── signout/           # POST /auth/signout
│   │   │   ├── health/                # GET /api/health (uptime check)
│   │   │   ├── users/                 # User data endpoints
│   │   │   │   └── saved-events/      # GET /api/users/saved-events
│   │   │   └── my-clubs/              # User's owned clubs
│   │   │
│   │   ├── (pages)/                   # User-facing pages
│   │   │   ├── page.tsx               # / (Home - event discovery)
│   │   │   ├── events/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx       # /events/{id} (event detail)
│   │   │   ├── my-events/
│   │   │   │   └── page.tsx           # /my-events (saved events)
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx           # /calendar (calendar view)
│   │   │   ├── my-clubs/              # Organizer club management
│   │   │   │   └── page.tsx
│   │   │   ├── create-event/
│   │   │   │   └── page.tsx           # Event creation form
│   │   │   ├── admin/                 # Admin dashboard
│   │   │   │   ├── page.tsx           # /admin (overview)
│   │   │   │   ├── events/            # /admin/events
│   │   │   │   ├── clubs/             # /admin/clubs
│   │   │   │   ├── users/             # /admin/users
│   │   │   │   ├── pending/           # /admin/pending (event approval)
│   │   │   │   └── layout.tsx         # Admin layout wrapper
│   │   │   ├── profile/               # /profile (user profile)
│   │   │   ├── user-profile/          # /user-profile
│   │   │   ├── onboarding/            # /onboarding (interest tags setup)
│   │   │   ├── about/                 # /about
│   │   │   └── docs/                  # /docs
│   │   │
│   │   ├── layout.tsx                 # Root layout (wraps all pages)
│   │   ├── globals.css                # Global styles
│   │   ├── robots.ts                  # SEO: robots.txt
│   │   └── sitemap.ts                 # SEO: sitemap.xml
│   │
│   ├── components/                    # React components (organized by feature)
│   │   ├── ui/                        # shadcn/ui primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx              # Mobile sidebar
│   │   │   └── ... (other ui primitives)
│   │   │
│   │   ├── layout/                    # Global layout components
│   │   │   ├── Header.tsx             # Top navigation bar
│   │   │   ├── SideNavBar.tsx         # Desktop left sidebar
│   │   │   ├── Footer.tsx
│   │   │   ├── ThemeToggle.tsx        # Dark mode toggle
│   │   │   └── navItems.ts            # Navigation items config
│   │   │
│   │   ├── events/                    # Event-related components
│   │   │   ├── EventCard.tsx          # Single event card
│   │   │   ├── EventCardSkeleton.tsx  # Loading skeleton
│   │   │   ├── EventGrid.tsx          # Grid of event cards
│   │   │   ├── EventGridSkeleton.tsx  # Grid loading skeleton
│   │   │   ├── EventFilters.tsx       # Filter panel (desktop)
│   │   │   ├── FilterSidebar.tsx      # Collapsible sidebar filters
│   │   │   ├── EventSearch.tsx        # Search input component
│   │   │   ├── EventDetailsModal.tsx  # Detailed event view modal
│   │   │   ├── EventBadge.tsx         # Category/popularity badge
│   │   │   ├── PopularEventsSection.tsx # Trending events section
│   │   │   ├── RecommendedEventsSection.tsx # Personalized recommendations
│   │   │   ├── HappeningNowSection.tsx # Current events
│   │   │   ├── HorizontalEventScroll.tsx # Horizontal scrolling list
│   │   │   ├── CategorySection.tsx
│   │   │   ├── RsvpButton.tsx         # RSVP interaction
│   │   │   ├── CreateEventForm.tsx    # Event creation form
│   │   │   ├── CreateEventModal.tsx
│   │   │   ├── RelatedEventCard.tsx
│   │   │   ├── EventFilters.test.tsx  # Component tests
│   │   │   └── FilterSidebar.test.tsx
│   │   │
│   │   ├── auth/                      # Authentication components
│   │   │   ├── SignInButton.tsx       # OAuth sign-in button
│   │   │   └── SignOutButton.tsx
│   │   │
│   │   ├── clubs/                     # Club-related components
│   │   │   ├── ClubCard.tsx
│   │   │   └── ... (club management UI)
│   │   │
│   │   ├── profile/                   # User profile components
│   │   │   └── ... (profile editing UI)
│   │   │
│   │   ├── admin/                     # Admin panel components
│   │   │   └── ... (admin dashboard UI)
│   │   │
│   │   ├── notifications/             # Notification components
│   │   │   └── NotificationBell.tsx   # Notification indicator
│   │   │
│   │   ├── providers/                 # Context providers
│   │   │   └── AuthProvider.tsx       # Initializes Zustand auth store
│   │   │
│   │   ├── shared/                    # Shared utility components
│   │   │   ├── ErrorBoundary.tsx      # React error boundary
│   │   │   └── ... (other utilities)
│   │   │
│   │   └── redoc/                     # API documentation components
│   │       └── ... (Redoc wrapper)
│   │
│   ├── hooks/                         # Custom React hooks
│   │   ├── useEvents.ts               # Event fetching with pagination
│   │   ├── useEvents.test.ts          # Hook tests
│   │   ├── useSavedEvents.ts          # Fetch user's saved event IDs
│   │   ├── useUser.ts                 # User profile hook
│   │   ├── useTracking.ts             # Track user interactions
│   │   └── index.ts                   # Hook exports
│   │
│   ├── lib/                           # Utility functions & config
│   │   ├── supabase/                  # Supabase clients & types
│   │   │   ├── client.ts              # Browser Supabase client
│   │   │   ├── server.ts              # Server Supabase client
│   │   │   ├── service.ts             # Database query helpers
│   │   │   └── types.ts               # Auto-generated DB types
│   │   │
│   │   ├── utils.ts                   # General utilities (cn, formatDate, etc)
│   │   ├── constants.ts               # Event categories, API endpoints, colors
│   │   ├── roles.ts                   # isAdmin(), isOrganizer() helpers
│   │   ├── tagMapping.ts              # Event tag transformations
│   │   ├── admin.ts                   # Admin utility functions
│   │   ├── classifier.ts              # ML: Event tag classification
│   │   ├── classifier.test.ts
│   │   ├── classifier-pipeline.ts     # ML: Classification pipeline
│   │   ├── kmeans.ts                  # ML: K-means clustering for recommendations
│   │   ├── kmeans.test.ts
│   │   ├── swagger.ts                 # API documentation generation
│   │   └── middlewareRateLimit.ts     # Request rate limiting
│   │
│   ├── store/                         # Global state management
│   │   └── useAuthStore.ts            # Zustand auth store (singleton)
│   │
│   ├── types/                         # TypeScript definitions
│   │   └── index.ts                   # All app type definitions (Event, User, etc)
│   │
│   └── middleware.ts                  # Next.js middleware (runs on every request)
│
├── public/                            # Static assets
│   └── ... (images, fonts, etc)
│
├── .planning/                         # GSD planning documents
│   └── codebase/                      # Architecture & design docs (generated)
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
└── Configuration files
    ├── next.config.ts                 # Next.js configuration
    ├── tsconfig.json                  # TypeScript configuration
    ├── package.json                   # Dependencies
    ├── package-lock.json              # Lock file
    ├── tailwind.config.ts             # Tailwind CSS config
    ├── postcss.config.mjs             # PostCSS config
    ├── eslint.config.mjs              # ESLint rules
    └── .env.local                     # Environment variables (not committed)
```

## Directory Purposes

**src/app/:**
Purpose: Next.js App Router - contains all routes and API endpoints. Exports page components and API handlers via file-based routing.
Contains: Page components (TSX), API route handlers, nested layouts, authentication routes.
Key files:
- `page.tsx` at root: Home page (event discovery)
- `api/` prefix: API endpoints (query handlers)
- Routes named by folder structure: `/my-events` = `src/app/my-events/page.tsx`

**src/components/:**
Purpose: Reusable React components organized by feature area. No page logic, only presentation and basic interactions.
Contains: Component files (TSX), component tests, UI primitives, layout shells.
Key files:
- `ui/`: shadcn/ui components (Button, Card, Dialog, etc)
- `events/`: EventCard, EventGrid, EventFilters, EventDetailsModal
- `layout/`: Global UI structure (Header, SideNavBar, Footer)
- `providers/`: Context providers (AuthProvider initializes Zustand)

**src/hooks/:**
Purpose: Custom React hooks for data fetching, state management, and side effects. Encapsulate API interactions.
Contains: Hook implementations with TypeScript interfaces for options and return types.
Key hooks:
- `useEvents()`: Cursor-based pagination, filtering, sorting
- `useSavedEvents()`: Fetch and cache user's saved event IDs
- `useTracking()`: Send interaction events to analytics API

**src/lib/supabase/:**
Purpose: Supabase integration layer. Separates client vs server clients, provides type safety.
Contains:
- `client.ts`: Browser-safe Supabase client (uses env.NEXT_PUBLIC_*)
- `server.ts`: Server-only Supabase client (async, handles cookies)
- `types.ts`: Auto-generated TypeScript types from DB schema
- `service.ts`: Query builder functions (optional, not always used)

**src/lib/:**
Purpose: Shared utility functions and configuration. Single responsibility per file.
Contains:
- `utils.ts`: General utilities (cn for class merging, formatDate, formatTime)
- `constants.ts`: Event categories, colors, API endpoints
- `roles.ts`: Role checking functions
- `classifier.ts`: ML model for auto-tagging events

**src/store/:**
Purpose: Global application state using Zustand. Currently only auth state.
Contains: Auth store with user, loading, initialized flags, initialize() and signOut() methods.
Pattern: Created with `create()` factory, used via `useAuthStore()` hook

**src/types/:**
Purpose: Central TypeScript definitions. All interfaces in one file for easy discovery.
Contains: Domain models (Event, User, Club, etc), enums, API response types.
Key types:
- `Event`: Core event with status, tags, relations
- `User`: Authenticated user with roles and preferences
- `UserInteraction`: Analytics event for tracking
- `EventFilter`: Query filter parameters

**src/middleware.ts:**
Purpose: Next.js middleware. Runs on every request before route handlers.
Responsibilities:
- Refresh Supabase session tokens
- Protect routes (redirect unauthenticated users)
- Enforce onboarding flow
- Apply rate limiting

## Key File Locations

**Entry Points:**

- `src/app/layout.tsx`: Root HTML structure, AuthProvider initialization, theme script
- `src/app/page.tsx`: Home page with event discovery, search, filters, pagination
- `src/app/auth/callback/route.ts`: OAuth callback handler (validates McGill email, upserts profile)
- `src/middleware.ts`: Request-level auth and routing logic

**Configuration:**

- `src/lib/constants.ts`: EVENT_CATEGORIES (colors, icons), API_ENDPOINTS, MCGILL_COLORS
- `src/components/layout/navItems.ts`: Navigation menu structure (guest, user, organizer, admin)
- `src/lib/supabase/types.ts`: Supabase DB type definitions (auto-generated)

**Core Logic:**

- `src/store/useAuthStore.ts`: Global auth state (Zustand)
- `src/hooks/useEvents.ts`: Event pagination and filtering logic
- `src/lib/supabase/client.ts`: Browser Supabase client factory
- `src/lib/supabase/server.ts`: Server Supabase client factory

**Testing:**

- `src/hooks/useEvents.test.ts`: Unit tests for event fetching hook
- `src/components/events/EventFilters.test.tsx`: Component tests
- `src/lib/classifier.test.ts`: ML classifier tests
- `src/lib/kmeans.test.ts`: K-means clustering tests

## Naming Conventions

**Files:**

- **Page components:** `page.tsx` (Next.js convention)
- **API routes:** `route.ts` (Next.js convention)
- **Components:** PascalCase, e.g., `EventCard.tsx`, `EventFilters.tsx`
- **Hooks:** camelCase with `use` prefix, e.g., `useEvents.ts`, `useSavedEvents.ts`
- **Utilities:** camelCase, e.g., `utils.ts`, `constants.ts`
- **Tests:** Same name as file + `.test.ts` or `.spec.ts`, e.g., `useEvents.test.ts`

**Directories:**

- **Pages:** kebab-case matching URL paths, e.g., `/my-events` = `my-events/`
- **API routes:** kebab-case matching URL paths, e.g., `/api/events` = `api/events/`
- **Components by feature:** kebab-case, e.g., `events/`, `layout/`, `auth/`, `admin/`
- **Dynamic segments:** [bracket-notation], e.g., `[id]/` for `events/{id}`

**Functions & Variables:**

- **Functions:** camelCase, e.g., `formatDate()`, `isMcGillEmail()`, `isAdmin()`
- **Constants:** UPPER_SNAKE_CASE, e.g., `MAX_LIMIT`, `PROTECTED_ROUTES`, `VALID_DOMAINS`
- **Type names:** PascalCase, e.g., `Event`, `User`, `EventFilter`
- **Enums:** PascalCase, e.g., `EventTag`, `RsvpStatus`, `InteractionType`

## Where to Add New Code

**New Feature (Full Page):**

1. **Page component:** `src/app/{feature}/page.tsx`
   - Import layout components (Header, Footer via root layout)
   - Use hooks for data fetching: `useEvents()`, `useUser()`, etc
   - Import components from `src/components/{feature}/`

2. **Feature components:** `src/components/{feature}/{ComponentName}.tsx`
   - Use shadcn/ui buttons, cards, dialogs
   - Mark as "use client" if interactive
   - Accept data via props, emit via callbacks

3. **Feature tests:** `src/components/{feature}/{ComponentName}.test.tsx`
   - Follow existing test patterns in `EventFilters.test.tsx`

4. **API endpoint:** `src/app/api/{feature}/route.ts` (if needed)
   - Use server Supabase client
   - Check auth with `supabase.auth.getUser()`
   - Return `NextResponse` with appropriate status

**New Component/Module:**

- **Reusable component:** `src/components/{category}/{ComponentName}.tsx`
  - Use "use client" only if interactive
  - Accept all data via props
  - Emit via callbacks (onSelect, onChange, etc)

- **UI primitive from shadcn:** `src/components/ui/{ComponentName}.tsx`
  - Copy from shadcn/ui component library
  - No modifications to primitives

- **Custom hook:** `src/hooks/use{Feature}.ts`
  - Follow pattern: `useState` + `useEffect` for side effects
  - Return object with data, loading, error, and functions
  - Use Supabase client from `src/lib/supabase/client.ts` or `server.ts`

**Utilities:**

- **Shared functions:** `src/lib/utils.ts` (small functions)
- **Constants:** `src/lib/constants.ts` (if event-related) or create new file
- **Feature-specific utils:** `src/lib/{feature}.ts`, e.g., `src/lib/roles.ts`

**Types:**

- **Always:** Add to `src/types/index.ts`
- **Export enum:** `export enum {Name} { ... }`
- **Export interface:** `export interface {Name} { ... }`
- **Never create separate type files** (keep in `index.ts` for discoverability)

## Special Directories

**Public Files:**
- Location: `/public`
- Purpose: Static assets (images, fonts, SVGs)
- Generated: No
- Committed: Yes
- Served at root: `/image.png` = `public/image.png`

**node_modules:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)
- Size: ~500MB (should not commit)

**.next:**
- Purpose: Next.js build output (compiled pages, server functions)
- Generated: Yes (via `npm run build` or dev server)
- Committed: No (in .gitignore)
- Size: ~300MB (should not commit)

**.env.local:**
- Purpose: Environment variables (Supabase credentials, admin emails)
- Generated: No (created manually)
- Committed: No (in .gitignore) — contains secrets!
- Required: Yes, for dev and production

---

*Structure analysis: 2026-02-23*
