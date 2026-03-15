# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
Event-Radar/
├── src/                        # Main application source
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── layout.tsx          # Root layout (AuthProvider, SideNavBar, Header, Footer)
│   │   ├── page.tsx            # Home page (event discovery)
│   │   ├── globals.css         # Global CSS / Tailwind imports
│   │   ├── api/                # API route handlers
│   │   │   ├── events/         # Event CRUD and queries
│   │   │   ├── clubs/          # Club management
│   │   │   ├── admin/          # Admin-only routes
│   │   │   ├── recommendations/# Recommendation engine proxy
│   │   │   ├── interactions/   # User interaction tracking
│   │   │   ├── notifications/  # Notification management
│   │   │   ├── user/           # User engagement/following
│   │   │   ├── users/          # User profiles and saved events
│   │   │   ├── profile/        # Profile avatar/interests
│   │   │   ├── feedback/       # App feedback
│   │   │   ├── cron/           # Scheduled jobs (send-reminders)
│   │   │   ├── health/         # Health check
│   │   │   ├── my-clubs/       # User's club memberships
│   │   │   ├── onboarding/     # Onboarding completion
│   │   │   └── organizer-requests/ # Club organizer applications
│   │   ├── auth/               # Auth callback and signout routes
│   │   ├── events/[id]/        # Event detail page
│   │   ├── calendar/           # Calendar view
│   │   ├── my-events/          # Saved events page
│   │   ├── clubs/              # Club listing and detail pages
│   │   ├── my-clubs/           # User's managed clubs
│   │   ├── moderation/         # Admin moderation dashboard
│   │   ├── create-event/       # Event creation page
│   │   ├── profile/            # User profile page
│   │   ├── user-profile/       # Public user profile
│   │   ├── onboarding/         # New user onboarding
│   │   ├── notifications/      # Notifications page
│   │   ├── categories/         # Category browsing
│   │   ├── invites/[token]/    # Club invite acceptance
│   │   ├── admin-login/        # Admin login page
│   │   ├── about/              # About page
│   │   ├── help/               # Help page
│   │   ├── feedback/           # Feedback submission page
│   │   ├── docs/               # API documentation (Redoc)
│   │   ├── privacy/            # Privacy policy
│   │   ├── terms/              # Terms of service
│   │   └── health/             # Health check page
│   ├── components/             # Reusable React components
│   │   ├── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── events/             # Event-specific components
│   │   ├── clubs/              # Club-specific components
│   │   ├── layout/             # Layout components (Header, SideNavBar, Footer)
│   │   ├── auth/               # Auth components (SignInButton, SignOutButton)
│   │   ├── notifications/      # Notification components
│   │   ├── profile/            # Profile components
│   │   ├── providers/          # Context providers (AuthProvider)
│   │   ├── shared/             # Shared feature components
│   │   ├── redoc/              # API doc rendering
│   │   └── ErrorBoundary.tsx   # Error boundary component
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities, constants, Supabase clients, classifier
│   │   └── supabase/           # Supabase client factories and DB types
│   ├── store/                  # Zustand state stores
│   ├── types/                  # TypeScript type definitions
│   └── __tests__/              # Test files (API route tests)
├── backend/                    # Legacy Python similarity backend
├── internal/                   # Internal team dashboard (Vite app)
├── supabase/                   # Supabase config, migrations, edge functions
│   ├── migrations/             # SQL migration files (001-013 + dated)
│   ├── functions/              # Supabase Edge Functions
│   └── config.toml             # Supabase project config
├── scripts/                    # Utility/testing scripts
├── docs/                       # Documentation files
├── public/                     # Static assets
├── .github/                    # GitHub Actions workflows
├── .vercel/                    # Vercel deployment config
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── eslint.config.mjs           # ESLint configuration
├── vitest.config.ts            # Vitest test configuration
├── vercel.json                 # Vercel deployment settings
├── package.json                # Dependencies and scripts
└── CLAUDE.md                   # Claude Code instructions
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: `page.tsx` files for each route, `route.ts` files for API endpoints
- Key files: `layout.tsx` (root layout), `page.tsx` (home), `globals.css`

**`src/app/api/`:**
- Purpose: Server-side API route handlers
- Contains: Route handlers organized by resource (events, clubs, users, admin, etc.)
- Key files: `events/route.ts` (main event listing), `recommendations/route.ts` (Postgres-native scoring engine), `interactions/route.ts` (tracking)

**`src/app/api/admin/`:**
- Purpose: Admin-only management endpoints
- Contains: CRUD for events, clubs, users, organizer requests, stats, popularity calculation
- Pattern: Each route calls `verifyAdmin()` before processing

**`src/app/moderation/`:**
- Purpose: Admin moderation dashboard pages
- Contains: Sub-pages for pending events, all events, users, clubs, organizer requests, stats

**`src/components/events/`:**
- Purpose: All event-related UI components
- Contains: `EventCard.tsx`, `EventGrid.tsx`, `EventFilters.tsx`, `EventDetailsModal.tsx`, `EventSearch.tsx`, `CreateEventForm.tsx`, `PopularEventsSection.tsx`, `RecommendedEventsSection.tsx`, `HappeningNowSection.tsx`, `RsvpButton.tsx`, and more
- Key files: `EventCard.tsx` (core card component), `EventGrid.tsx` (grid layout with skeleton loading)

**`src/components/ui/`:**
- Purpose: shadcn/ui primitive components
- Contains: `button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `carousel.tsx`, `slider.tsx`, `switch.tsx`, `skeleton.tsx`, `breadcrumb.tsx`, `EmptyState.tsx`
- Note: Generated by shadcn CLI, do not manually edit (except `EmptyState.tsx` which is custom)

**`src/components/layout/`:**
- Purpose: App shell layout components
- Contains: `Header.tsx` (top bar with mobile menu), `SideNavBar.tsx` (desktop sidebar navigation), `Footer.tsx`, `AppBreadcrumb.tsx`, `ThemeToggle.tsx`

**`src/components/clubs/`:**
- Purpose: Club-related UI components
- Contains: `ClubDashboard.tsx`, `ClubOverviewTab.tsx`, `ClubEventsTab.tsx`, `ClubMembersTab.tsx`, `FollowButton.tsx`, `OrganizerRequestDialog.tsx`

**`src/components/profile/`:**
- Purpose: User profile UI components
- Contains: `ProfileHeader.tsx`, `EditProfileButton.tsx`, `EditProfileModal.tsx`, `InterestTagSelector.tsx`, `InterestsCard.tsx`, `AvatarCropModal.tsx`

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching and side effects
- Contains: `useEvents.ts` (paginated event fetching), `useUser.ts` (Supabase auth user), `useSavedEvents.ts` (saved event IDs), `useTracking.ts` (interaction tracking)

**`src/lib/`:**
- Purpose: Shared utilities, constants, and domain logic
- Contains: Supabase client factories, utility functions, constants, event classifier, role helpers, admin verification, tag mapping, date validation, export utilities, image upload
- Key files: `utils.ts` (cn, formatDate, formatTime, isMcGillEmail), `constants.ts` (EVENT_TAGS, EVENT_CATEGORIES, API_ENDPOINTS, MCGILL_COLORS), `classifier.ts` (Instagram post classifier), `admin.ts` (verifyAdmin)

**`src/lib/supabase/`:**
- Purpose: Supabase client factories for different execution contexts
- Contains: `client.ts` (browser), `server.ts` (server components/API routes), `service.ts` (service role, bypasses RLS), `types.ts` (generated DB types)

**`src/store/`:**
- Purpose: Global state management (Zustand)
- Contains: `useAuthStore.ts` - auth state with user profile, initialization, and sign-out

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: `index.ts` with all interfaces (Event, Club, User, SavedEvent, Notification, EventFilter, etc.)

**`backend/`:**
- Purpose: Legacy Python similarity computation backend
- Contains: `app.py`, `similarity.py`, `test_similarity.py`

**`internal/`:**
- Purpose: Internal team dashboard (separate Vite app)
- Contains: Vite + TypeScript app for team admin tasks, data collection

**`supabase/`:**
- Purpose: Supabase project configuration and database migrations
- Contains: `config.toml`, `migrations/` (19 SQL files), `functions/` (edge functions), `seed-beta-events.sql`

**`scripts/`:**
- Purpose: Utility and testing scripts
- Contains: `check-feedback-loop.mjs`, `test-real-scrape.ts`, `test-scrape-pipeline.ts`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout wrapping all pages
- `src/app/page.tsx`: Home page / event discovery
- `src/app/auth/callback/route.ts`: OAuth callback handler

**Configuration:**
- `next.config.js`: Next.js config
- `tailwind.config.ts`: Tailwind theme with McGill brand colors
- `tsconfig.json`: TypeScript config (strict mode, `@/` path alias)
- `eslint.config.mjs`: ESLint config
- `vitest.config.ts`: Test runner config
- `vercel.json`: Vercel deployment config
- `components.json`: shadcn/ui component config
- `.prettierrc`: Prettier formatting config

**Core Logic:**
- `src/app/api/events/route.ts`: Main events API endpoint
- `src/app/api/recommendations/route.ts`: Recommendation engine proxy
- `src/app/api/interactions/route.ts`: User interaction tracking
- `src/lib/classifier.ts`: Instagram post event classifier
- `src/lib/classifier-pipeline.ts`: Full classification pipeline
- `src/store/useAuthStore.ts`: Global auth state management

**Testing:**
- `src/__tests__/api/events/`: API route tests
- `src/lib/classifier.test.ts`: Classifier unit tests
- `src/lib/classifier-pipeline.test.ts`: Pipeline tests
- `src/lib/dateValidation.test.ts`: Date validation tests
- `src/lib/exportUtils.test.ts`: Export utility tests
- `src/lib/image-upload.test.ts`: Image upload tests
- `src/lib/kmeans.test.ts`: K-means tests
- `src/hooks/useEvents.test.ts`: Events hook tests
- `src/components/events/EventFilters.test.tsx`: Component tests
- `src/components/events/FilterSidebar.test.tsx`: Component tests
- `src/components/ErrorBoundary.test.tsx`: Component tests

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: `PascalCase.tsx` (e.g., `EventCard.tsx`, `SignInButton.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useEvents.ts`, `useTracking.ts`)
- Utilities: `camelCase.ts` (e.g., `utils.ts`, `tagMapping.ts`, `dateValidation.ts`)
- Tests: `*.test.ts` or `*.test.tsx` co-located with source
- Store: `camelCase.ts` with `use` prefix (e.g., `useAuthStore.ts`)

**Directories:**
- App routes: `kebab-case` (e.g., `my-events`, `create-event`, `admin-login`)
- API routes: `kebab-case` (e.g., `saved-events`, `happening-now`, `upload-image`)
- Dynamic segments: `[param]` (e.g., `[id]`, `[token]`)
- Component groups: `kebab-case` (e.g., `ui`, `events`, `layout`)

## Where to Add New Code

**New Page:**
- Create `src/app/{route-name}/page.tsx`
- Mark as `"use client"` if it needs interactivity (most pages do)
- Import components from `@/components/`, hooks from `@/hooks/`

**New API Endpoint:**
- Create `src/app/api/{resource}/{action}/route.ts`
- Export named functions: `GET`, `POST`, `PATCH`, `DELETE`
- Use `createClient()` from `@/lib/supabase/server` for authenticated queries
- Use `verifyAdmin()` from `@/lib/admin` for admin-only routes
- Return `NextResponse.json()` with appropriate status codes
- Add Swagger JSDoc annotations for API documentation

**New Feature Component:**
- Place in appropriate group: `src/components/events/`, `src/components/clubs/`, `src/components/profile/`, etc.
- Use PascalCase file naming: `MyComponent.tsx`
- For cross-cutting components: `src/components/shared/`

**New UI Primitive:**
- Use `npx shadcn@latest add {component}` to add shadcn/ui components
- They go to `src/components/ui/`
- Custom UI primitives: `src/components/ui/` with PascalCase (e.g., `EmptyState.tsx`)

**New Hook:**
- Create `src/hooks/use{Name}.ts`
- Mark as `"use client"` at the top
- Follow pattern of existing hooks (state + effect + callbacks)

**New Utility Function:**
- Add to `src/lib/utils.ts` for general utilities
- Create a new file in `src/lib/` for domain-specific logic (e.g., `src/lib/dateValidation.ts`)

**New Type Definition:**
- Add to `src/types/index.ts` (all types in single barrel file)

**New Store:**
- Create `src/store/use{Name}Store.ts`
- Use Zustand `create<State>()()` pattern matching `useAuthStore.ts`

**New Database Migration:**
- Create `supabase/migrations/{sequence}_{description}.sql`
- Follow existing naming: numbered prefix (e.g., `014_...`) or timestamped (e.g., `20260305...`)

**New Test:**
- Co-locate with source file: `MyComponent.test.tsx` next to `MyComponent.tsx`
- API tests: `src/__tests__/api/{resource}/`

## Special Directories

**`backend/`:**
- Purpose: Legacy Python similarity backend
- Generated: No
- Committed: Yes
- Note: Appears to be superseded by the `AI/` service

**`internal/`:**
- Purpose: Internal team dashboard (separate Vite + TypeScript app)
- Generated: No
- Committed: Yes (has its own `node_modules/`, `package.json`, `vite.config.ts`)
- Note: Completely separate from the main Next.js app

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build` or `npm run dev`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`supabase/migrations/`:**
- Purpose: Database schema migrations
- Generated: No (manually authored SQL)
- Committed: Yes
- Note: Applied via Supabase CLI or dashboard

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-05*
