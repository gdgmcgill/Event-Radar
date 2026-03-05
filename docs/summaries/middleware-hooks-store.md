# Middleware, Hooks & Auth Store

**middleware.ts** — Rate limiting, Supabase session refresh, auth cookie cleanup, protected-route redirects, onboarding enforcement. `middlewareRateLimit.ts` is actively imported.

**useEvents.ts** — Cursor-paginated event fetching with filter-aware reset and load-more. Removed 3 debug `console.error` calls.

**useUser.ts** — Deleted. Duplicated `useAuthStore` and had zero imports.

**useSavedEvents.ts** — Fetches saved event IDs for UI state. No changes.

**useTracking.ts** — Fires interaction and recommendation feedback events. No changes.

**useAuthStore.ts** — Zustand auth store with optimistic user-set and profile hydration. Removed 12 debug console calls.
