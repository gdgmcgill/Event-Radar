# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```
src/
├── app/                           # Next.js App Router (pages, layouts, API routes)
│   ├── (public pages)/            # Public routes (about, help, privacy, terms, feedback, etc.)
│   ├── api/                       # REST API endpoints
│   │   ├── admin/                 # Admin operations (events, clubs, users, stats)
│   │   ├── events/                # Event CRUD and operations (save, RSVP, popular, happening-now)
│   │   ├── clubs/                 # Club management
│   │   ├── interactions/          # User interaction tracking (views, clicks, saves)
│   │   ├── recommendations/       # Event recommendations engine
│   │   ├── profile/               # User profile operations
│   │   ├── notifications/         # Notification delivery
│   │   ├── auth/                  # OAuth callback, sign out
│   │   └── cron/                  # Scheduled tasks (send reminders)
│   ├── admin-login/               # Admin login page
│   ├── calendar/                  # Calendar view page
│   ├── categories/                # Category browsing page
│   ├── clubs/                     # Club discovery and management pages
│   ├── create-event/              # Event creation form page
│   ├── events/[id]/               # Event detail page (dynamic route)
│   ├── my-clubs/                  # User's clubs dashboard
│   ├── my-events/                 # Saved events page
│   ├── notifications/             # Notifications page
│   ├── onboarding/                # Onboarding flow page
│   ├── moderation/                # Admin moderation pages
│   ├── profile/                   # User profile page
│   ├── user-profile/              # User profile editing page
│   ├── layout.tsx                 # Root layout with AuthProvider, Header, SideNavBar
│   ├── page.tsx                   # Home page (main feed)
│   ├── robots.ts                  # SEO robots.txt
│   └── sitemap.ts                 # SEO sitemap
│
├── components/                    # Reusable React components
│   ├── ui/                        # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── layout/                    # Header, SideNavBar, Footer, ThemeToggle
│   ├── events/                    # Event-specific components (Card, Grid, Filters, Modal, etc.)
│   ├── auth/                      # Auth components (SignInButton, SignOutButton)
│   ├── clubs/                     # Club components (OrganizerRequestDialog)
│   ├── profile/                   # Profile components (EditProfileModal, AvatarCropModal, etc.)
│   ├── notifications/             # Notification UI (NotificationBell, NotificationList)
│   ├── providers/                 # Context providers (AuthProvider)
│   ├── redoc/                     # API documentation UI
│   ├── shared/                    # Shared modals (EditEventModal)
│   └── ErrorBoundary.tsx          # Error boundary wrapper
│
├── hooks/                         # Custom React hooks
│   ├── useEvents.ts               # Fetch events with cursor pagination
│   ├── useSavedEvents.ts          # Manage saved event IDs
│   ├── useUser.ts                 # Fetch user profile
│   ├── useTracking.ts             # Track user interactions
│   └── *.test.ts                  # Hook tests
│
├── lib/                           # Utility functions and helpers
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client factory
│   │   ├── server.ts              # Server Supabase client factory
│   │   ├── service.ts             # Service role client (admin operations)
│   │   └── types.ts               # Generated Supabase database types
│   ├── utils.ts                   # General utilities (cn, formatDate, formatTime, isMcGillEmail)
│   ├── constants.ts               # Constants (EVENT_TAGS, EVENT_CATEGORIES, COLORS, API endpoints)
│   ├── roles.ts                   # Role checking functions (isAdmin, isOrganizer)
│   ├── classifier.ts              # Instagram event classifier (NLP)
│   ├── classifier-pipeline.ts     # Classification pipeline with webhook integration
│   ├── kmeans.ts                  # K-means clustering for recommendations
│   ├── tagMapping.ts              # Event tag normalization
│   ├── image-upload.ts            # Image download/upload to Supabase storage
│   ├── admin.ts                   # Admin verification utilities
│   ├── swagger.ts                 # OpenAPI/Swagger documentation generator
│   └── *.test.ts                  # Utility tests
│
├── store/                         # Zustand state management
│   └── useAuthStore.ts            # Global auth state (user, loading, initialize)
│
├── types/                         # TypeScript type definitions
│   └── index.ts                   # Event, Club, User, SavedEvent, RSVP, Notification types
│
├── middleware.ts                  # Next.js middleware (auth, rate limiting, route protection)
├── middlewareRateLimit.ts         # Rate limiting logic
│
└── __tests__/                     # Integration tests
    └── api/
        └── events/
            └── rsvp.test.ts       # RSVP endpoint tests
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router pages, layouts, and API routes
- Contains: Page components (.tsx), layout components, dynamic segments [id], API route handlers
- Organized: By feature/domain (events, clubs, admin, etc.)

**src/app/api/:**
- Purpose: REST API endpoints
- Contains: Route handlers returning JSON responses
- Pattern: File-based routing (folder/route.ts); folders with [id] for dynamic segments

**src/components/:**
- Purpose: Reusable React UI components
- Contains: Functional components using hooks, Tailwind CSS, shadcn/ui
- Organized: By feature/domain; `ui/` for primitive components

**src/hooks/:**
- Purpose: Custom React hooks encapsulating logic
- Contains: Data fetching, state management, side effects
- Pattern: Returns hooks that can be called from components; includes test files

**src/lib/:**
- Purpose: Utility functions, integrations, constants
- Contains: Formatting, validation, database clients, classification logic
- Organized: By concern (supabase/, constants, classifiers)

**src/store/:**
- Purpose: Global client-side state management
- Contains: Zustand stores (currently just auth)
- Pattern: `useAuthStore` provides user, loading, initialize, signOut

**src/types/:**
- Purpose: TypeScript interfaces matching database schema
- Contains: Event, Club, User, SavedEvent, RSVP, Notification, UserInteraction
- Single file: `index.ts` (currently 237 lines)

**src/__tests__/:**
- Purpose: Integration/unit tests
- Contains: Test files mirroring src/ structure
- Current coverage: Limited (rsvp.test.ts, some hook tests)

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Home feed page (main entry point for users)
- `src/app/auth/callback/route.ts`: OAuth redirect handler
- `src/middleware.ts`: Request-level auth, rate limiting, route protection
- `src/app/layout.tsx`: Root layout with AuthProvider, Header, Footer

**Configuration:**
- `.env.local`: Supabase credentials (DO NOT COMMIT)
- `next.config.js`: Next.js build configuration
- `tsconfig.json`: TypeScript strict mode enabled
- `tailwind.config.ts`: Tailwind CSS theming

**Core Logic:**
- `src/lib/supabase/client.ts`: Browser Supabase client for client components
- `src/lib/supabase/server.ts`: Server Supabase client for API routes
- `src/store/useAuthStore.ts`: Global auth state management
- `src/hooks/useEvents.ts`: Main event fetching hook with cursor pagination

**Data Models:**
- `src/types/index.ts`: All TypeScript interfaces for domain entities

**API Routes (by resource):**
- `src/app/api/events/route.ts`: GET events with filtering/pagination
- `src/app/api/events/[id]/save/route.ts`: POST/DELETE to save/unsave
- `src/app/api/events/[id]/rsvp/route.ts`: GET/POST/DELETE RSVP
- `src/app/api/events/popular/route.ts`: GET trending events
- `src/app/api/recommendations/route.ts`: GET personalized recommendations
- `src/app/api/admin/events/route.ts`: Admin event listing
- `src/app/api/admin/events/[id]/status/route.ts`: Admin event approval

**Testing:**
- `src/hooks/useEvents.test.ts`: Hook unit tests
- `src/__tests__/api/events/rsvp.test.ts`: Integration test for RSVP endpoint

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `EventCard.tsx`, `Header.tsx`)
- Utilities: camelCase (e.g., `utils.ts`, `tagMapping.ts`)
- API routes: lowercase with dashes in folders (e.g., `route.ts` inside `src/app/api/admin/events/[id]/`)
- Tests: Same name as file with `.test.ts` suffix (e.g., `useEvents.test.ts`)

**Directories:**
- Feature/domain folders: lowercase (e.g., `events`, `clubs`, `admin`)
- Dynamic segments: [brackets] (e.g., `[id]` for dynamic routes)
- Utility groups: lowercase (e.g., `supabase`, `ui`, `layout`)

**Components:**
- Page components: Named by feature (e.g., `HomePage`, `EventDetailPage`)
- Modal/Dialog components: End with "Modal" or "Dialog" (e.g., `EventDetailsModal`, `EditProfileModal`)
- Button/Action components: Verb-based (e.g., `SignInButton`, `SaveButton`, `RsvpButton`)
- Section components: Named by content (e.g., `PopularEventsSection`, `HappeningNowSection`)

**Hooks:**
- Prefix "use" (e.g., `useEvents`, `useSavedEvents`, `useUser`)
- Naming describes what they manage (e.g., `useAuthStore`, `useTracking`)

## Where to Add New Code

**New Feature (Event Search Enhancement):**
- Primary code: `src/app/events/` or new route like `src/app/search/`
- Component: `src/components/events/SearchFilters.tsx`
- Hook: `src/hooks/useSearch.ts`
- API endpoint: `src/app/api/search/route.ts`
- Tests: `src/hooks/useSearch.test.ts`, `src/__tests__/api/search/route.test.ts`
- Types: Add to `src/types/index.ts`

**New Component (Reusable UI):**
- Implementation: `src/components/{feature}/{ComponentName}.tsx`
- If generic: `src/components/ui/{componentName}.tsx`
- Tests: Alongside component if complex (`ComponentName.test.tsx`)

**New Page/Route:**
- Create folder in `src/app/` matching route path
- Add `page.tsx` for page or `route.ts` for API endpoint
- Use existing layout if inheriting from parent

**Utilities:**
- General helper: Add to `src/lib/utils.ts`
- Domain-specific: Create new file in `src/lib/` (e.g., `src/lib/recommendations.ts`)
- Feature-specific classification: `src/lib/classifier.ts`

**Global State:**
- Store in `src/store/` with Zustand (e.g., `src/store/useNotificationStore.ts`)

**API Endpoints:**
- CRUD for resource: `src/app/api/{resource}/route.ts` (list/create), `src/app/api/{resource}/[id]/route.ts` (read/update/delete)
- Sub-resource actions: `src/app/api/{resource}/[id]/{action}/route.ts` (e.g., `/api/events/[id]/save/route.ts`)
- Paginated lists: Use cursor pagination (see `useEvents` hook pattern)

## Special Directories

**src/__tests__/:**
- Purpose: Integration and unit tests
- Generated: No (manually written)
- Committed: Yes
- Pattern: Mirrors src/ structure for organization

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (in .gitignore)

**src/lib/supabase/types.ts:**
- Purpose: Auto-generated Supabase database types
- Generated: Yes (via `npx supabase gen types`)
- Committed: Yes (should be regenerated when schema changes)
- Note: Do not manually edit; regenerate from Supabase CLI

**public/:**
- Purpose: Static assets
- Generated: No (manually added)
- Committed: Yes

---

*Structure analysis: 2026-02-25*
