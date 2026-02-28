# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `EventCard.tsx`, `EventFilters.tsx`)
- TypeScript utilities/logic: camelCase with `.ts` extension (e.g., `useEvents.ts`, `utils.ts`)
- API routes: lowercase with `/` structure matching Next.js routing (e.g., `/api/events/route.ts`)
- Test files: match source file name with `.test.ts` or `.test.tsx` suffix (e.g., `useEvents.test.ts`, `EventCard.test.tsx`)
- Constants files: `constants.ts`, `tagMapping.ts`, `roles.ts` (lowercase with descriptive name)

**Functions:**
- camelCase for all function names
- Hooks start with `use` prefix (e.g., `useEvents`, `useTracking`, `useUser`)
- Private/internal functions use `_` prefix or are defined locally in scope
- API route handlers: `GET`, `POST`, `PATCH`, `DELETE` (uppercase - Next.js convention)

**Variables:**
- camelCase for all variable names
- State variables: `const [isLoading, setIsLoading] = useState(false)` pattern
- Ref variables: camelCase with `Ref` suffix (e.g., `sessionIdRef`, `viewTimersRef`)
- Constants/enums: UPPER_SNAKE_CASE (e.g., `MAX_LIMIT = 100`, `UUID_RE`)

**Types:**
- Interface names: PascalCase starting with capital letter (e.g., `Event`, `EventFilter`, `UseEventsResult`)
- Enum names: PascalCase (e.g., `EventTag`, `NotificationType`)
- Type aliases: PascalCase when they represent object types (e.g., `SortField`, `InteractionType`)
- Database row types: `{TableName}Row` (e.g., `EventRow`)

## Code Style

**Formatting:**
- Prettier configured with:
  - `semi: true` - Semicolons required
  - `singleQuote: false` - Double quotes
  - `printWidth: 80` - Line width limit
  - `tabWidth: 2` - 2-space indentation
  - `trailingComma: "es5"` - Trailing commas in objects/arrays
  - `useTabs: false` - Spaces, not tabs

**Linting:**
- ESLint with `eslint-config-next/core-web-vitals` extends
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- No JavaScript allowed in TypeScript files unless explicitly allowed

**File Structure Pattern:**
```typescript
"use client";  // If needed for client components
/**
 * JSDoc comment describing the module/component
 */

// Imports (organized by type)
import { external, libraries } from "package-name";
import { internal, modules } from "@/path";

// Type/Interface definitions
interface ComponentProps {}
type CustomType = "value1" | "value2";

// Component/Function export
export function ComponentName() {
  // Implementation
}
```

## Import Organization

**Order:**
1. External third-party packages (react, next, date-fns, etc.)
2. Radix UI and UI component libraries (@radix-ui/*, shadcn/ui)
3. Internal components and modules using `@/` alias
4. Type imports using `import type`

**Example from codebase:**
```typescript
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { type Event, type InteractionSource } from "@/types";
```

**Path Aliases:**
- `@/` maps to `src/` (defined in `tsconfig.json`)
- Always use `@/` for internal imports, never relative paths like `../../../`

## Error Handling

**Patterns:**
- Try-catch blocks in async functions with proper error logging
- Error messages logged with `console.error()` for debugging
- Non-critical errors (like tracking) logged with `console.warn()` and fail silently
- API routes return `NextResponse` with appropriate status codes and error objects

**Examples:**
```typescript
// In hooks/useTracking.ts - non-critical error, silent fail
try {
  const response = await fetch(API_ENDPOINTS.INTERACTIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.warn("Failed to track interaction:", await response.text());
  }
} catch (error) {
  // Silently fail - tracking should not break the app
  console.warn("Error tracking interaction:", error);
}
```

```typescript
// In hooks/useEvents.ts - critical error, user-facing
try {
  setLoading(true);
  setError(null);
  const result = await fetchPage({ cursor });
  applyPageResult(result);
} catch (err) {
  console.error("Error fetching events:", err);
  setError(err instanceof Error ? err : new Error("Failed to fetch events"));
} finally {
  setLoading(false);
}
```

**API Route Error Pattern:**
```typescript
// In src/app/api/events/[id]/route.ts
try {
  const { id } = await params;
  const supabase = await createClient();
  // ... logic
  return NextResponse.json({ event }, { status: 200 });
} catch (error) {
  console.error("Error fetching event:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

## Logging

**Framework:** Native `console` (no dedicated logging library)

**Patterns:**
- `console.error()` - For critical errors that need investigation
- `console.warn()` - For non-critical failures, warnings, and edge cases
- `console.log()` - Rarely used; prefer structured error/warning logging
- No logging in production-critical paths unless needed for monitoring

**Locations:** Logs appear in:
- Browser console (client components)
- Server logs (API routes, server components)

## Comments

**When to Comment:**
- Complex business logic requiring explanation (e.g., cursor pagination implementation)
- Non-obvious type manipulations or data transformations
- External API requirements or constraints
- Workarounds for known issues

**JSDoc/TSDoc:**
- Used extensively for functions, hooks, and exported types
- Includes `@param` for function parameters
- Includes `@returns` for return values
- Format: Multi-line block comments with `/**` opening

**Examples from codebase:**

```typescript
/**
 * Custom hook for fetching and managing events with cursor-based pagination
 */
export function useEvents(options: UseEventsOptions = {}): UseEventsResult

/**
 * Format an ISO date string to a readable format
 * @param dateString - ISO date string (e.g., "2024-01-15")
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
export function formatDate(dateString: string): string

/**
 * Track view with debouncing
 * Only tracks after user has been viewing for viewDebounceMs
 * Also deduplicates views within the same session
 */
const trackView = useCallback((eventId: string, trackOptions?: TrackOptions) => {
```

## Function Design

**Size:** Functions kept reasonably small; split complex logic into helpers
- Most utility functions: 10-50 lines
- Hooks with state management: 100-300 lines (acceptable for complex state)
- API handlers: 50-200 lines

**Parameters:**
- Named parameters preferred over positional when 2+ arguments
- Use interface/type for function option objects (e.g., `UseEventsOptions`)
- Optional parameters documented with `?` and defaults provided

```typescript
// Good: Options object with documented properties
interface UseEventsOptions {
  filters?: EventFilter;
  enabled?: boolean;
  limit?: number;
  sort?: SortField;
  direction?: SortDirection;
}

export function useEvents(options: UseEventsOptions = {}): UseEventsResult
```

**Return Values:**
- Explicitly typed return values using TypeScript return type annotations
- Objects returned from hooks include all state and methods needed
- Async functions return `Promise<T>`

## Module Design

**Exports:**
- Named exports preferred (`export function`, `export interface`)
- Default exports rarely used
- Re-exports from `index.ts` create barrel files for organized imports

**Barrel Files:**
- Used in `src/types/index.ts` to export all type definitions
- Allows `import { Event, User, Club } from "@/types"`
- Not used heavily elsewhere; modules export directly

**Example from `src/types/index.ts`:**
```typescript
export enum EventTag { ... }
export interface Event { ... }
export interface Club { ... }
export interface User { ... }
export type UserRole = 'user' | 'club_organizer' | 'admin';
```

## React-Specific Patterns

**Client Components:**
- Use `"use client"` directive at top of file
- State management: `useState` for local state, `useCallback` for memoized handlers
- Refs: `useRef` for stable references (not re-created on render)
- Side effects: `useEffect` with proper dependency arrays

**Server Components:**
- Default in Next.js 16; no directive needed
- API routes marked with `async` function handlers
- Use `async/await` for Supabase queries

**Props Pattern:**
```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
  showSaveButton?: boolean;
  /** Description of optional prop */
  trackingSource?: InteractionSource;
}

export function EventCard({
  event,
  onClick,
  showSaveButton = false,
  trackingSource,
}: EventCardProps) {
  // Implementation
}
```

---

*Convention analysis: 2026-02-25*
