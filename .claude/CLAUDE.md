<!-- GSD:project-start source:PROJECT.md -->

## Project

**Uni-Verse — Foundation Program**

Uni-Verse is a campus event discovery platform for McGill University. Students browse, filter, save, and RSVP to campus events; club organizers manage club pages, post events, invite members, and see analytics; admins moderate content and users. The product already exists and has shipped two milestones. This project is not a feature milestone. It is a four-stage foundation program that audits, stabilizes, refactors, and certifies the existing codebase so that the next product work (the ingestion platform and new features) is built on a base that is known to be correct, secure, and tested.

**Core Value:** Every critical workflow in the existing app is verified correct, secure, and reproducible across all user roles before any new product feature is started. If a foundation change breaks a workflow that worked before, the program has failed.

### Constraints

- **Ordering**: Stages run 1 → 2 → 3 → 4 and each gate must pass before the next stage starts — the audit is read-only and precedes any dependency change or refactor
- **Behavior preservation**: Every Validated requirement above must still work after each stage — that is the core value
- **No production data injection**: Synthetic datasets go to local and staging only
- **Tech stack**: Stay on Next.js App Router, Supabase, Vercel — the program stabilizes the stack, it does not replace it
- **Security**: Never modify `.env.local`; McGill email enforcement stays in place
- **Refactor style**: Tested vertical slices, bottom-up (schema → types → auth → services → validation → endpoints → routing → pages → performance → observability)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.4.0 - All application code (`src/`), strict mode enabled in `tsconfig.json`
- SQL - Supabase migrations (`supabase/migrations/`)
- TypeScript (Deno) - Supabase Edge Functions (`supabase/functions/events-webhook/index.ts`)

## Runtime

- Node.js 24 - pinned in three places that must agree: `package.json` `engines.node` (`24.x`), `.nvmrc` (`24`), and `.github/workflows/ci.yml`, which reads `node-version-file: '.nvmrc'` rather than declaring a literal. `engines.npm` is `>=11`. Re-derive: `node -p "require('./package.json').engines"`
- Deno runtime for Supabase Edge Functions
- npm 11+
- Lockfile: `package-lock.json` (present, `lockfileVersion` 3) - reviewed as diffs and never regenerated wholesale; `npm ci` in CI and in the clean room

## Frameworks

- Next.js ^16.3.5 (`next`) - Full-stack React framework, App Router
- React 18.3.0 (`react`, `react-dom`) - UI rendering. React 19 is explicitly out of scope for the foundation program
- **Jest ^30.2.0 (`jest.config.js`) - the single test runner. There is no Vitest in this project; `vitest.config.ts` and `vitest.setup.ts` were deleted and neither `vitest` nor `@vitejs/plugin-react` is installed. Do not write Vitest-style tests — they will not run.**
- `ts-jest` ^29.4.6 - the TypeScript transformer, declared via `preset: 'ts-jest'`
- Jest runs **two projects** from one config, and the routing rule is NOT by file extension:
- `node` project - `testEnvironment: 'node'`, matches `src/**/*.test.ts`, ignores `src/hooks/`
- `jsdom` project - `testEnvironment: 'jsdom'`, matches `src/**/*.test.tsx` **and** `src/hooks/**/*.test.ts`, because `src/hooks/useEvents.test.ts` is a `.ts` file that renders React hooks and needs a DOM
- `jest.setup.ts` - one line, `import "@testing-library/jest-dom";`, loaded by the jsdom project via `setupFilesAfterEnv`
- `jest-environment-jsdom` ^30.2.0, `@testing-library/react` ^16.3.3, `@testing-library/dom` ^10.4.2, `@testing-library/jest-dom` ^7.0.1 - the jsdom harness
- Test commands: `npm test` (all suites), `npm run test:ci` (`jest --ci`, what CI runs), `npx jest <path>` (one suite)
- PostCSS ^8.5.28 (`postcss.config.js`) - CSS processing. Also pinned through a root `overrides` entry in `package.json`, which collapses nested duplicate copies onto the patched version
- Autoprefixer 10.4.17 - CSS vendor prefixes
- ESLint 9.39.1 (`eslint.config.mjs`) - Linting, uses `eslint-config-next/core-web-vitals`
- Prettier 3.2.5 - Code formatting (no config file detected; uses defaults)

## Styling

- Tailwind CSS 3.4.1 - Utility-first CSS (`tailwind.config.ts`)
- `tailwindcss-animate` 1.0.7 - Animation utilities
- `@tailwindcss/typography` 0.5.10 - Prose styling plugin
- shadcn/ui primitives in `src/components/ui/` (uses Radix UI underneath)
- `@radix-ui/react-dialog` ^1.1.15
- `@radix-ui/react-slider` ^1.3.6
- `@radix-ui/react-slot` ^1.2.4
- (`@radix-ui/react-dropdown-menu`, `@radix-ui/react-switch` and `@radix-ui/react-tabs` were declared and imported by nothing; removed, along with the dead `src/components/ui/dropdown-menu.tsx` wrapper)
- `tailwindcss-animate` is a **devDependency**, not a production dependency
- `class-variance-authority` 0.7.1 - Component variant styling
- `clsx` 2.1.0 - Conditional class merging
- `tailwind-merge` 2.2.1 - Tailwind class deduplication
- `cn()` helper at `src/lib/utils.ts` combines clsx + tailwind-merge
- Tailwind `darkMode: ["class"]` in `tailwind.config.ts`
- McGill brand palette defined under `theme.extend.colors.mcgill`

## Key Dependencies

- `@supabase/supabase-js` ^2.49.0 - Supabase client SDK (database, auth, storage)
- `@supabase/ssr` ^0.7.0 - SSR-compatible Supabase client (cookie-based auth)
- `swr` ^2.3.7 - Data fetching/caching for client components
- `zustand` ^5.0.9 - Client-side state management; the single store is `src/store/useAuthStore.ts` (auth state), initialized once by `AuthProvider`
- `lucide-react` ^0.344.0 - Icon library
- `embla-carousel-react` ^8.6.0 - Carousel/slider component
- `react-easy-crop` ^5.5.6 - Image cropping for avatars/uploads
- `date-fns` ^3.3.1 - Date formatting and parsing
- `next-swagger-doc` ^0.4.1 - OpenAPI spec generation from JSDoc annotations
- `redoc` ^2.5.4 - the API docs viewer actually reached from `/docs`
- (`swagger-ui-react`, `@types/swagger-ui-react` and `@swagger-api/apidom-ns-openapi-3-1` were installed and imported by nothing; removed. The `/docs` module closure reaches `redoc` and `next-swagger-doc` only)

## Configuration

- Config: `tsconfig.json`
- Target: ES2020
- Module: ESNext with bundler resolution
- Strict mode: enabled
- Path alias: `@/*` maps to `./src/*`
- JSX: react-jsx
- Config: `tailwind.config.ts`
- Content paths: `./src/pages/**`, `./src/components/**`, `./src/app/**`, `./src/lib/**`
- Custom McGill brand colors defined in theme
- CSS variable-based design tokens for shadcn/ui
- Config: `eslint.config.mjs` (flat config format)
- Extends: `eslint-config-next/core-web-vitals`
- Ignores: `.claude/**`, `.next/**`, `AI/**`, `node_modules/**`, `demo-video/**`
- Config: `next.config.js`
- Remote image patterns: `**.supabase.co`, `**.supabase.in`, `images.unsplash.com`
- Security headers: X-Frame-Options DENY, HSTS, X-Content-Type-Options nosniff, X-XSS-Protection, strict Referrer-Policy
- `.env.local` - Local secrets (not committed)
- `.env.local.example` - Template with required var names
- Required vars:
- Optional vars:

## Platform Requirements

- Node.js 24 (`.nvmrc`)
- npm 11+
- Supabase CLI (for local Supabase development and migrations)
- Optional: Deno (for edge function development)
- Vercel (see `vercel.json`)
- Region: `iad1` (US East)
- Framework: `nextjs`
- API cache headers: `s-maxage=60, stale-while-revalidate=300`
- GitHub Actions (`.github/workflows/ci.yml`)
- Runs on: push to `main`, PRs to `main`
- Node comes from `node-version-file: '.nvmrc'`; there is no competing `node-version` literal
- Steps, in order: `npm ci`, lint, TypeScript type-check (`tsc --noEmit`), **`npm test`**, **`npm audit --audit-level=high --omit=dev`**, build
- The production vulnerability gate is unsuppressed - no `continue-on-error`, no `|| true`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (`EventCard.tsx`, `ErrorBoundary.tsx`, `FilterSidebar.tsx`)
- Hooks: camelCase with `use` prefix (`useEvents.ts`, `useUser.ts`, `useSavedEvents.ts`)
- Utility modules: camelCase (`utils.ts`, `constants.ts`, `dateValidation.ts`, `exportUtils.ts`, `classifier.ts`)
- API routes: `route.ts` inside directory-based paths (`src/app/api/events/route.ts`, `src/app/api/events/[id]/rsvp/route.ts`)
- Test files: co-located with source as `*.test.ts` / `*.test.tsx` (e.g., `src/lib/dateValidation.test.ts`, `src/components/ErrorBoundary.test.tsx`)
- Zustand stores: camelCase with `use` prefix (`useAuthStore.ts`)
- Use camelCase for all functions and methods: `formatDate()`, `handleSave()`, `buildQueryParams()`
- React components use PascalCase: `EventCard()`, `ErrorBoundary`
- Event handlers use `handle` prefix: `handleSave`, `handleCardClick`, `handleDismiss`, `handleThumbs`
- Boolean-returning functions use `is` prefix: `isMcGillEmail()`, `isValidISODate()`, `isDateInFuture()`
- Factory/builder functions use `make`/`create` prefix: `makeEvent()`, `createClient()`, `createMockEvent()`
- Use camelCase: `eventsData`, `mockSupabase`, `queryResult`
- Boolean state: `isSaved`, `isExportingCal`, `initialSessionHandled`
- Constants: SCREAMING_SNAKE_CASE for module-level constants: `EVENT_TAGS`, `API_ENDPOINTS`, `MCGILL_COLORS`, `RECOMMENDATION_THRESHOLD`
- Supabase column names use snake_case: `start_date`, `club_id`, `image_url`
- Interfaces: PascalCase (`Event`, `Club`, `User`, `EventFilter`, `SavedEvent`)
- Type aliases: PascalCase (`UserRole`, `RsvpStatus`, `InteractionSource`)
- Enums: PascalCase with PascalCase members (`EventTag.ACADEMIC`, `EventTag.SOCIAL`)
- Props interfaces: Component name + `Props` suffix (`EventCardProps`)
- State interfaces: Component name + `State` suffix (`ErrorBoundaryState`)
- Inline type definitions for local use: PascalCase (`EventRow`, `MockEvent`, `QueryResult`)

## Code Style

- Prettier with config at `.prettierrc`
- Semicolons: always
- Trailing commas: `es5`
- Single quotes: no (double quotes for strings)
- Print width: 80 characters
- Tab width: 2 spaces
- Tabs: no (spaces)
- ESLint 9 with flat config at `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals`
- Ignores: `.claude/**`, `.next/**`, `AI/**`, `node_modules/**`, `demo-video/**`
- Run with `npm run lint`
- Strict mode enabled in `tsconfig.json`
- Target: ES2020
- Module resolution: bundler
- JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

## Import Organization

- `@/*` maps to `src/*` -- use this for all non-relative imports
- Relative imports (`./`) are acceptable within the same directory (e.g., test files importing their subject)
- Named imports preferred: `import { createClient } from "@/lib/supabase/server"`
- Type-only imports when importing only types: `import type { Event } from "@/types"`, `import type { NextRequest } from "next/server"`
- Mixed imports separate value and type: `import { type Event, EventTag } from "@/types"`

## Error Handling

- Wrap entire handler in try/catch
- Return `NextResponse.json({ error: message }, { status: code })` for errors
- Use specific HTTP status codes: 400 for validation, 401 for auth, 403 for authorization, 404 for not found, 500 for server errors
- Include `field` property in validation errors: `{ error: "message", field: "start_date" }`
- Log errors with `console.error()` before returning error responses
- Outer catch returns generic message: `{ error: "Failed to [action]" }`
- Try/catch around async operations (fetch calls)
- Log errors with `console.error()`
- Silently handle non-critical errors (e.g., tracking failures)
- Use `ErrorBoundary` component for React error boundaries (`src/components/ErrorBoundary.tsx`)
- Return the input unchanged on parse failure rather than throwing (e.g., `formatDate()` returns the raw string on error)
- Return null for "not found" cases (`extractDate()`, `extractLocation()`)

## Logging

- API routes: `console.error("Error context:", error)` before returning error responses
- Auth store: prefixed with `[Auth]` tag: `console.log("[Auth] Initializing...")`
- Middleware: prefixed with `[Middleware]`: `console.error("[Middleware] Error:", e)`
- No structured logging library in use

## Comments

- File-level JSDoc block at top of utility files describing purpose: `/** Utility functions for Uni-Verse */`
- Function-level JSDoc with `@param` and `@returns` for utility functions in `src/lib/utils.ts`
- Swagger/OpenAPI annotations on API route handlers using `@swagger` JSDoc blocks
- Inline comments for non-obvious logic (cookie cleanup in middleware, Supabase query building)
- Section dividers using comment lines: `// ─── Section Name ───`
- Used on exported utility functions with `@param` and `@returns`
- Used on API route handlers for Swagger documentation
- Component props documented via TypeScript interface with inline `/** */` comments
- Not universally applied -- many components and hooks lack JSDoc

## Function Design

- Use options objects for hooks: `useEvents(options: UseEventsOptions = {})`
- Destructure props in component signatures
- Default parameter values provided inline: `showSaveButton = false`, `limit = 50`
- API routes always return `NextResponse.json()`
- Hooks return typed result objects with explicit interface definitions
- Utility functions return simple types (string, boolean, null)

## Module Design

- Named exports preferred: `export function EventCard()`, `export function createClient()`
- Default exports used only for Zustand stores: `export default useAuthStore`
- Types exported from barrel file: `src/types/index.ts`
- Constants exported individually from `src/lib/constants.ts`
- `src/types/index.ts` serves as the type barrel -- import all types from `@/types`
- No barrel files for components -- import each component directly from its file

## Component Patterns

- Client components marked with `"use client"` directive at top of file
- API routes (server-only) do NOT include `"use client"`
- Hooks always include `"use client"`
- Pages default to client components with state management
- Browser (client components/hooks): `import { createClient } from "@/lib/supabase/client"` -- synchronous
- Server (API routes/middleware): `import { createClient } from "@/lib/supabase/server"` -- async, `await createClient()`
- Service role (admin operations): `import { createServiceClient } from "@/lib/supabase/service"`
- Zustand for global auth state: `src/store/useAuthStore.ts`
- React useState/useEffect for component-local state
- SWR for data fetching (dependency present in package.json)
- Custom hooks for data fetching patterns: `useEvents`, `useSavedEvents`
- Tailwind CSS utility classes inline on JSX elements
- `cn()` helper from `src/lib/utils.ts` for conditional class merging
- shadcn/ui primitives in `src/components/ui/` -- do not modify these directly
- McGill brand colors defined in `src/lib/constants.ts` as `MCGILL_COLORS`
- Dark mode supported via Tailwind `dark:` variants

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- Client-heavy SPA pattern: most pages are `"use client"` components that fetch data via internal API routes
- API routes serve as a thin server-side layer between the React frontend and Supabase
- Zustand global store for auth state; React hooks for data fetching
- Recommendations computed entirely in Postgres via `compute_user_scores()` (pg_cron every 6h) — no external service
- Instagram scraper pipeline (Apify) feeds events through a classifier into the database

## Layers

- Purpose: Render UI, handle user interactions, manage local/global state
- Location: `src/app/*/page.tsx`, `src/components/`
- Contains: React components marked `"use client"`, Tailwind styling, shadcn/ui primitives
- Depends on: Hooks layer, Zustand store, API layer (via fetch)
- Used by: End users in the browser
- Purpose: Encapsulate data fetching logic and side effects for client components
- Location: `src/hooks/`
- Contains: `useEvents.ts` (cursor-paginated event fetching), `useUser.ts` (Supabase auth user), `useSavedEvents.ts` (saved event IDs), `useTracking.ts` (interaction/recommendation feedback tracking)
- Depends on: API routes (via fetch), Supabase browser client
- Used by: Page components and feature components
- Purpose: Global auth state shared across the entire client app
- Location: `src/store/useAuthStore.ts`
- Contains: Zustand store with user profile, loading state, initialization logic
- Depends on: `src/lib/supabase/client.ts` (browser Supabase client)
- Used by: All client components needing auth context
- Pattern: Single store initialized once by `AuthProvider`, listens to `onAuthStateChange`
- Purpose: Server-side data access, auth verification, external service orchestration
- Location: `src/app/api/`
- Contains: Next.js Route Handlers exporting `GET`, `POST`, `PATCH`, `DELETE` functions
- Depends on: Supabase server client (`src/lib/supabase/server.ts`), service client (`src/lib/supabase/service.ts`)
- Used by: Client hooks and components (via `fetch`)
- Purpose: Shared helpers, constants, Supabase client factories, domain logic
- Location: `src/lib/`
- Contains: Supabase client factories, utility functions, constants, classifier logic, role helpers, admin verification
- Depends on: Supabase SDK, external packages (clsx, date-fns)
- Used by: API routes, hooks, components
- Purpose: TypeScript interfaces matching the Supabase database schema
- Location: `src/types/index.ts`
- Contains: All shared interfaces (`Event`, `Club`, `User`, `SavedEvent`, `Notification`, `EventFilter`, etc.)
- Depends on: Nothing
- Used by: All other layers
- Purpose: Classify Instagram posts as events and extract structured data
- Location: `src/lib/classifier.ts`, `src/lib/classifier-pipeline.ts`
- Contains: Heuristic event classifier, Apify output normalizer, webhook sender
- Depends on: Nothing (pure functions + fetch for webhook)
- Used by: Scripts in `scripts/`, potentially cron jobs

## Data Flow

- Auth state: Zustand store (`useAuthStore`) initialized once by `AuthProvider` in root layout
- Event data: Local React state in hooks (`useEvents`, `useSavedEvents`)
- UI state: Local component state (filters, search, modals)
- No server-side state caching or Redis; each request hits Supabase directly

## Key Abstractions

- Purpose: Create typed Supabase clients for different contexts
- Browser client: `src/lib/supabase/client.ts` - `createClient()` using `createBrowserClient`
- Server client: `src/lib/supabase/server.ts` - `createClient()` using `createServerClient` with cookie access
- Service client: `src/lib/supabase/service.ts` - `createServiceClient()` using service role key (bypasses RLS)
- Pattern: All return `SupabaseClient<Database>` typed with `src/lib/supabase/types.ts`
- Purpose: Classify Instagram posts as events using weighted heuristic signals
- Files: `src/lib/classifier.ts`, `src/lib/classifier-pipeline.ts`
- Pattern: Pure functions with confidence scoring (0-1), partitioned into auto_pending/manual_review/auto_discard
- Pipeline: Apify output -> normalize -> classifyBatch -> partitionByAction -> webhook
- Purpose: Guard admin-only API routes
- File: `src/server/authz/requireRole.ts` (with `requireActiveUser.ts`, `requireOnboarded.ts`, `requireClubRole.ts`)
- Pattern: `requireRole(ctx, "admin")` returns `{ ok: true, user }` or `{ ok: false, response }` - caller returns `response` on the deny arm; `src/lib/admin.ts` / `verifyAdmin()` were deleted in Phase 5
- Purpose: Check user roles (user, admin, club_organizer)
- File: `src/lib/roles.ts`
- Pattern: Pure helper functions `hasRole()`, `isAdmin()`, `isOrganizer()` operating on `User` type
- Purpose: Centralized URL constants for all API routes
- File: `src/lib/constants.ts` (`API_ENDPOINTS` object)
- Note: Not consistently used - many components hardcode fetch URLs

## Entry Points

- Location: `src/app/layout.tsx`
- Triggers: Every page load
- Responsibilities: Wraps app in `AuthProvider`, renders `SideNavBar`, `Header`, `Footer`, applies Inter font and theme script
- Location: `src/app/page.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Event discovery hub - search, filters, happening now, popular/recommended events, paginated event grid
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Supabase/Azure
- Responsibilities: Session exchange, McGill email enforcement, user profile upsert through the elevated door (fails closed), validated `next` redirect, onboarding redirect from database truth (no role assignment at sign-in since Phase 5)
- Location: `src/app/auth/signout/route.ts`
- Triggers: POST from `useAuthStore.signOut()`
- Responsibilities: Server-side sign out to properly clear cookies
- Location: `src/app/api/events/route.ts`
- Triggers: GET requests from `useEvents` hook
- Responsibilities: Paginated event query with tag/search/date filters, DB-to-frontend field transformation
- Location: `src/app/api/cron/send-reminders/route.ts`
- Triggers: Scheduled (likely Vercel cron)
- Responsibilities: Send event reminders to users

## Error Handling

- API routes wrap entire handler in try/catch, return 500 with error message
- Client hooks store `Error | null` in state, expose to components
- `ErrorBoundary` component (`src/components/ErrorBoundary.tsx`) wraps page sections
- Recommendation service failures fall back gracefully: returns empty recommendations, client falls back to `PopularEventsSection`
- Auth callback handles multiple error scenarios with specific error codes redirected as query params

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
