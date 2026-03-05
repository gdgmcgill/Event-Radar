# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- React components: PascalCase (`EventCard.tsx`, `ErrorBoundary.tsx`, `FilterSidebar.tsx`)
- Hooks: camelCase with `use` prefix (`useEvents.ts`, `useUser.ts`, `useSavedEvents.ts`)
- Utility modules: camelCase (`utils.ts`, `constants.ts`, `dateValidation.ts`, `exportUtils.ts`, `classifier.ts`)
- API routes: `route.ts` inside directory-based paths (`src/app/api/events/route.ts`, `src/app/api/events/[id]/rsvp/route.ts`)
- Test files: co-located with source as `*.test.ts` / `*.test.tsx` (e.g., `src/lib/dateValidation.test.ts`, `src/components/ErrorBoundary.test.tsx`)
- Zustand stores: camelCase with `use` prefix (`useAuthStore.ts`)

**Functions:**
- Use camelCase for all functions and methods: `formatDate()`, `handleSave()`, `buildQueryParams()`
- React components use PascalCase: `EventCard()`, `ErrorBoundary`
- Event handlers use `handle` prefix: `handleSave`, `handleCardClick`, `handleDismiss`, `handleThumbs`
- Boolean-returning functions use `is` prefix: `isMcGillEmail()`, `isValidISODate()`, `isDateInFuture()`
- Factory/builder functions use `make`/`create` prefix: `makeEvent()`, `createClient()`, `createMockEvent()`

**Variables:**
- Use camelCase: `eventsData`, `mockSupabase`, `queryResult`
- Boolean state: `isSaved`, `isExportingCal`, `initialSessionHandled`
- Constants: SCREAMING_SNAKE_CASE for module-level constants: `EVENT_TAGS`, `API_ENDPOINTS`, `MCGILL_COLORS`, `RECOMMENDATION_THRESHOLD`
- Supabase column names use snake_case: `start_date`, `club_id`, `image_url`

**Types:**
- Interfaces: PascalCase (`Event`, `Club`, `User`, `EventFilter`, `SavedEvent`)
- Type aliases: PascalCase (`UserRole`, `RsvpStatus`, `InteractionSource`)
- Enums: PascalCase with PascalCase members (`EventTag.ACADEMIC`, `EventTag.SOCIAL`)
- Props interfaces: Component name + `Props` suffix (`EventCardProps`)
- State interfaces: Component name + `State` suffix (`ErrorBoundaryState`)
- Inline type definitions for local use: PascalCase (`EventRow`, `MockEvent`, `QueryResult`)

## Code Style

**Formatting:**
- Prettier with config at `.prettierrc`
- Semicolons: always
- Trailing commas: `es5`
- Single quotes: no (double quotes for strings)
- Print width: 80 characters
- Tab width: 2 spaces
- Tabs: no (spaces)

**Linting:**
- ESLint 9 with flat config at `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals`
- Ignores: `.claude/**`, `.next/**`, `AI/**`, `node_modules/**`, `demo-video/**`
- Run with `npm run lint`

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- Target: ES2020
- Module resolution: bundler
- JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

## Import Organization

**Order:**
1. External framework imports (`next`, `react`)
2. External library imports (`@supabase/ssr`, `lucide-react`, `zustand`)
3. Internal absolute imports using `@/` alias (`@/lib/supabase/server`, `@/components/ui/card`, `@/types`)
4. Relative imports (used sparingly, mainly in test files: `./dateValidation`, `./classifier`)

**Path Aliases:**
- `@/*` maps to `src/*` -- use this for all non-relative imports
- Relative imports (`./`) are acceptable within the same directory (e.g., test files importing their subject)

**Import Style:**
- Named imports preferred: `import { createClient } from "@/lib/supabase/server"`
- Type-only imports when importing only types: `import type { Event } from "@/types"`, `import type { NextRequest } from "next/server"`
- Mixed imports separate value and type: `import { type Event, EventTag } from "@/types"`

## Error Handling

**API Routes:**
- Wrap entire handler in try/catch
- Return `NextResponse.json({ error: message }, { status: code })` for errors
- Use specific HTTP status codes: 400 for validation, 401 for auth, 403 for authorization, 404 for not found, 500 for server errors
- Include `field` property in validation errors: `{ error: "message", field: "start_date" }`
- Log errors with `console.error()` before returning error responses
- Outer catch returns generic message: `{ error: "Failed to [action]" }`

```typescript
// Pattern from src/app/api/events/create/route.ts
export async function POST(request: NextRequest) {
  try {
    // ... validation and business logic
    if (authError || !user) {
      return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
    }
    // ... more logic
    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    console.error("Error in create event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
```

**Client-Side Components:**
- Try/catch around async operations (fetch calls)
- Log errors with `console.error()`
- Silently handle non-critical errors (e.g., tracking failures)
- Use `ErrorBoundary` component for React error boundaries (`src/components/ErrorBoundary.tsx`)

```typescript
// Pattern from src/components/events/EventCard.tsx
const handleSave = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  try {
    const response = await fetch(`/api/events/${event.id}/save`, { method: "POST" });
    if (!response.ok) throw new Error("Failed to save event");
    const data = await response.json();
    setIsSaved(data.saved);
  } catch (error) {
    console.error("Error saving event:", error);
  }
};
```

**Utility Functions:**
- Return the input unchanged on parse failure rather than throwing (e.g., `formatDate()` returns the raw string on error)
- Return null for "not found" cases (`extractDate()`, `extractLocation()`)

## Logging

**Framework:** `console` (console.error, console.log)

**Patterns:**
- API routes: `console.error("Error context:", error)` before returning error responses
- Auth store: prefixed with `[Auth]` tag: `console.log("[Auth] Initializing...")`
- Middleware: prefixed with `[Middleware]`: `console.error("[Middleware] Error:", e)`
- No structured logging library in use

## Comments

**When to Comment:**
- File-level JSDoc block at top of utility files describing purpose: `/** Utility functions for Uni-Verse */`
- Function-level JSDoc with `@param` and `@returns` for utility functions in `src/lib/utils.ts`
- Swagger/OpenAPI annotations on API route handlers using `@swagger` JSDoc blocks
- Inline comments for non-obvious logic (cookie cleanup in middleware, Supabase query building)
- Section dividers using comment lines: `// ─── Section Name ───`

**JSDoc/TSDoc:**
- Used on exported utility functions with `@param` and `@returns`
- Used on API route handlers for Swagger documentation
- Component props documented via TypeScript interface with inline `/** */` comments
- Not universally applied -- many components and hooks lack JSDoc

## Function Design

**Size:** No enforced limit. Components range from small (50 lines) to large (`EventCard.tsx` at 362 lines). Utility functions are generally short (5-20 lines).

**Parameters:**
- Use options objects for hooks: `useEvents(options: UseEventsOptions = {})`
- Destructure props in component signatures
- Default parameter values provided inline: `showSaveButton = false`, `limit = 50`

**Return Values:**
- API routes always return `NextResponse.json()`
- Hooks return typed result objects with explicit interface definitions
- Utility functions return simple types (string, boolean, null)

## Module Design

**Exports:**
- Named exports preferred: `export function EventCard()`, `export function createClient()`
- Default exports used only for Zustand stores: `export default useAuthStore`
- Types exported from barrel file: `src/types/index.ts`
- Constants exported individually from `src/lib/constants.ts`

**Barrel Files:**
- `src/types/index.ts` serves as the type barrel -- import all types from `@/types`
- No barrel files for components -- import each component directly from its file

## Component Patterns

**Client vs Server:**
- Client components marked with `"use client"` directive at top of file
- API routes (server-only) do NOT include `"use client"`
- Hooks always include `"use client"`
- Pages default to client components with state management

**Supabase Client Usage:**
- Browser (client components/hooks): `import { createClient } from "@/lib/supabase/client"` -- synchronous
- Server (API routes/middleware): `import { createClient } from "@/lib/supabase/server"` -- async, `await createClient()`
- Service role (admin operations): `import { createServiceClient } from "@/lib/supabase/service"`

**State Management:**
- Zustand for global auth state: `src/store/useAuthStore.ts`
- React useState/useEffect for component-local state
- SWR for data fetching (dependency present in package.json)
- Custom hooks for data fetching patterns: `useEvents`, `useSavedEvents`

**Styling:**
- Tailwind CSS utility classes inline on JSX elements
- `cn()` helper from `src/lib/utils.ts` for conditional class merging
- shadcn/ui primitives in `src/components/ui/` -- do not modify these directly
- McGill brand colors defined in `src/lib/constants.ts` as `MCGILL_COLORS`
- Dark mode supported via Tailwind `dark:` variants

---

*Convention analysis: 2026-03-05*
