# Middleware, Hooks & Auth Store

**middleware.ts** — Applies rate limiting (via `middlewareRateLimit.ts`), refreshes Supabase sessions, cleans stale auth cookies, redirects unauthenticated users from protected routes, and enforces the onboarding flow. `middlewareRateLimit.ts` is actively imported and live.

**useEvents.ts** — Cursor-paginated event fetching with filter-aware reset, load-more, and load-all support. Removed 3 `console.error` debug calls.

**useUser.ts** — Deleted. Was a standalone auth hook that fully duplicated `useAuthStore` and was never imported anywhere.

**useSavedEvents.ts** — Fetches saved event IDs for heart-state initialisation. No changes needed.

**useTracking.ts** — Fires recommendation feedback and interaction events. Used by EventCard, EventDetailsModal, and the calendar page. No changes needed.

**useAuthStore.ts** — Zustand store managing auth state with optimistic user-set + background profile hydration and a 3 s fallback fetch. Removed all 12 `console.log`/`console.error` debug calls; both actions (`initialize`, `signOut`) are externally used and kept.
