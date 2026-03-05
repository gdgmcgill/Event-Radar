# Codebase Cleanup Index

March 2026 — subtraction-only pass across all source files.

| Summary | What changed |
|---------|-------------|
| [config.md](./config.md) | Removed dead `unsplash` and `supabase.in` image domains, dead Tailwind `src/pages/**` glob |
| [types-constants.md](./types-constants.md) | Deleted 3 unused interfaces and 2 unused constants |
| [lib-supabase.md](./lib-supabase.md) | Removed duplicate `isMcGillEmail` in auth callback; tightened bare catch bindings in utils |
| [middleware-hooks-store.md](./middleware-hooks-store.md) | Deleted dead `useUser` hook; removed 15 debug console calls from hooks and store |
| [lib-ml.md](./lib-ml.md) | Extracted k-means magic number to constant; removed debug `console.warn` from export utils |
| [layout-ui.md](./layout-ui.md) | Deleted 4 unused shadcn components; added `console.error` to ErrorBoundary |
| [event-components.md](./event-components.md) | Fixed double `onSuccess` call in CreateEventForm; added RSVP cancel rollback |
| [domain-components.md](./domain-components.md) | Removed debug console calls from auth buttons and EditEventModal; tightened `any` types |
| [api-routes.md](./api-routes.md) | Standardized error shapes to `{ error: string }`; removed debug logs from auth callback |
| [pages-tests.md](./pages-tests.md) | Migrated all tests from vitest to jest; replaced dead vitest config with `jest.config.ts` |

**Final state:** lint clean · 162 tests passing · build clean
