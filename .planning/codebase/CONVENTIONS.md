# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `EventCard.tsx`, `ErrorBoundary.tsx`)
- Pages/routes: kebab-case (e.g., `my-events/page.tsx`, `create-event/page.tsx`)
- Utilities/hooks: camelCase (e.g., `useEvents.ts`, `constants.ts`, `utils.ts`)
- Test files: Component name + `.test.ts(x)` suffix (e.g., `EventFilters.test.tsx`)

**Functions:**
- camelCase for all functions (e.g., `formatDate()`, `buildQueryParams()`, `createMockEvent()`)
- Async functions use same convention as synchronous
- Factory/helper functions follow common pattern: `createMock*` (e.g., `createMockEvent`, `createMockRequest`)

**Variables:**
- camelCase for all variables: local vars, component props, state variables (e.g., `eventId`, `selectedTags`, `loadingMore`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `MAX_LIMIT`, `SORT_FIELDS`, `UUID_RE`, `VALID_STATUSES`)
- Array identifiers use plural form (e.g., `events`, `tags`, `cursorStackRef`)
- Boolean flags use `is*` or `should*` prefix (e.g., `isSaved`, `shouldThrow`, `showSaveButton`)

**Types:**
- Interface names: PascalCase, prefixed with `I` is NOT used (e.g., `EventFiltersProps`, `UseEventsOptions`, `RouteContext`)
- Type aliases: PascalCase (e.g., `SortField`, `SortDirection`, `RsvpStatus`)
- Enum members: UPPER_SNAKE_CASE (e.g., `EventTag.ACADEMIC`, `EventTag.SOCIAL`)

## Code Style

**Formatting:**
- Prettier configuration enforced via `.prettierrc`:
  - `semi: true` - Always include semicolons
  - `singleQuote: false` - Use double quotes
  - `printWidth: 80` - Line length limit
  - `tabWidth: 2` - Two-space indentation
  - `useTabs: false` - Spaces, not tabs
  - `trailingComma: "es5"` - Trailing commas where valid in ES5

**Linting:**
- ESLint via `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals`
- Ignores `.claude/` directory
- Run with `npm run lint`

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- No implicit `any` allowed
- All types must be explicitly declared
- Use `type` imports for types: `import type { Event } from "@/types"`
- Use `import` for values

## Import Organization

**Order:**
1. React and framework imports (e.g., `import { useState } from "react"`)
2. Next.js imports (e.g., `import Link from "next/link"`)
3. Third-party libraries (e.g., `import clsx from "clsx"`)
4. UI component imports (e.g., `import { Button } from "@/components/ui/button"`)
5. Feature/domain imports (e.g., `import { useEvents } from "@/hooks/useEvents"`)
6. Type imports (e.g., `import type { Event } from "@/types"`)
7. Same-directory relative imports last (e.g., `import { EventBadge } from "./EventBadge"`)

**Path Aliases:**
- All imports use `@/` path alias mapping to `src/`
- Never use relative paths like `../../../`
- Example: `import { cn } from "@/lib/utils"` instead of `import { cn } from "../../../lib/utils"`

## Error Handling

**Patterns:**
- API routes (server-side): Catch errors and return `NextResponse.json({ error: string }, { status: number })`
- Always log errors to console with `console.error()` for debugging
- Use specific HTTP status codes:
  - `400` for validation/input errors (malformed JSON, missing fields, invalid values)
  - `401` for authentication failures (not authenticated)
  - `403` for authorization failures (authenticated but forbidden)
  - `404` for resource not found
  - `500` for unexpected errors
- Example from `src/app/api/events/[id]/rsvp/route.ts`:
  ```typescript
  if (eventError) {
    console.error("Error looking up event:", eventError);
    return NextResponse.json({ error: "Failed to verify event" }, { status: 500 });
  }
  if (!eventExists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  ```

- Client-side hooks: Store errors in state, catch with `try/catch`, log with `console.error()`
- Example from `src/hooks/useEvents.ts`:
  ```typescript
  catch (err) {
    console.error("Error fetching events:", err);
    setError(err instanceof Error ? err : new Error("Failed to fetch events"));
  }
  ```

- Type guards for validation (e.g., `isValidStatus()` in `src/app/api/events/[id]/rsvp/route.ts`):
  ```typescript
  function isValidStatus(status: unknown): status is RsvpStatus {
    return typeof status === "string" && VALID_STATUSES.includes(status as RsvpStatus);
  }
  ```

## Logging

**Framework:** `console` (native, no external logger)

**Patterns:**
- `console.error()` for error logging (used in all API routes and hooks)
- Log before returning error responses for debuggability
- Prefix logs with context when helpful (e.g., `"[Admin]"` in `src/app/api/admin/organizer-requests/[id]/route.ts`)
- Only log errors, not info/debug statements (keep logs clean)

## Comments

**When to Comment:**
- JSDoc comments on exported functions and types (required for public APIs)
- Explain WHY, not WHAT the code does
- Section dividers for logical groupings (e.g., `// ─── GET /api/events/:id/rsvp ───────────────────────────`)

**JSDoc/TSDoc:**
- All exported functions have JSDoc headers with `@param` and `@returns`
- Example from `src/lib/utils.ts`:
  ```typescript
  /**
   * Format an ISO date string to a readable format
   * @param dateString - ISO date string (e.g., "2024-01-15")
   * @returns Formatted date string (e.g., "January 15, 2024")
   */
  export function formatDate(dateString: string): string {
    ...
  }
  ```

- Components document props in JSDoc:
  ```typescript
  /**
   * Props for the EventFilters component.
   */
  interface EventFiltersProps {
    /**
     * Callback fired when the active filters change.
     */
    onFilterChange?: (...) => void;
  }
  ```

## Function Design

**Size:** Keep functions focused and under 50 lines where possible; complex logic split into helper functions

**Parameters:**
- Prefer object parameters for functions with multiple arguments
- Example: `fetchPage(options?: FetchPageOptions)` instead of `fetchPage(cursor, limit, sort, direction)`
- Use type-safe options interfaces

**Return Values:**
- Functions return relevant data types, not generic objects
- Use `null` for optional/missing values, not `undefined`
- Callbacks use function types defined in interfaces (e.g., `onFilterChange?: (filters: {...}) => void`)

## Module Design

**Exports:**
- Named exports preferred: `export function useEvents() {}`
- Default exports only for pages
- Export types separately: `export type UseEventsOptions = { ... }`
- All hooks exported as named exports from `src/hooks/`
- All types exported from centralized `src/types/index.ts`

**Barrel Files:**
- Use for organizing types: `src/types/index.ts` exports all type interfaces
- Do NOT use barrel files for components (import directly from component files)

## Client vs Server Components

**"use client" Directive:**
- Required on all interactive components (hooks, event handlers, state)
- Examples: `src/components/events/EventFilters.tsx`, `src/hooks/useEvents.ts`

**Server Components:**
- Pages in `src/app/` are server components by default
- API routes are server-only

**Supabase Client Usage:**
- Client-side: `import { createClient } from "@/lib/supabase/client"`
- Server-side (API routes): `import { createClient } from "@/lib/supabase/server"`

---

*Convention analysis: 2026-02-23*
