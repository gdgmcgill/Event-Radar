# Technology Stack

**Project:** Uni-Verse -- Club Management, Analytics, Reviews Milestone
**Researched:** 2026-03-05

## Existing Stack (Do Not Change)

These are already in the codebase and stay as-is:

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | ^16.0.3 | Framework (App Router) |
| TypeScript | ^5.4.0 | Language (strict mode) |
| Tailwind CSS | ^3.4.1 | Styling |
| shadcn/ui (Radix primitives) | various | UI components |
| Supabase (@supabase/supabase-js) | ^2.49.0 | Database, Auth, RLS |
| @supabase/ssr | ^0.7.0 | Server-side Supabase client |
| SWR | ^2.3.7 | Client-side data fetching/caching |
| Zustand | ^5.0.9 | Client state management |
| date-fns | ^3.3.1 | Date formatting/manipulation |
| Lucide React | ^0.344.0 | Icons |

## New Libraries to Add

### Charts: shadcn/ui Chart + Recharts

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| recharts | ^3.7.0 | Charting engine for analytics dashboards | shadcn/ui's official Chart component is built on Recharts. Using Recharts means charts inherit shadcn theming (dark mode, CSS variables) automatically. No wrapper abstraction -- you compose with raw Recharts components. 3.6M+ weekly npm downloads, actively maintained. |

**Confidence:** HIGH -- shadcn/ui officially documents this at ui.shadcn.com/docs/components/radix/chart

**Installation:**
```bash
npx shadcn@latest add chart
# This installs recharts as a dependency automatically
```

**Why not Tremor:** Tremor is built on Recharts + Radix anyway, adding an unnecessary abstraction layer. The project already uses shadcn/ui which provides the same Recharts integration natively. Adding Tremor would mean two competing component systems.

**Why not Chart.js / D3:** Recharts is React-native (declarative JSX components). Chart.js requires imperative DOM manipulation. D3 is too low-level for dashboard charts. The analytics needs here are standard (line, bar, area, pie) -- no exotic visualizations needed.

### Form Validation: React Hook Form + Zod

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-hook-form | ^7.71.0 | Form state management | Club creation, event creation, review submission, profile editing -- this milestone adds many forms. RHF is the official recommendation from shadcn/ui's Form component. Uncontrolled inputs = minimal re-renders. |
| @hookform/resolvers | ^5.0.0 | Schema resolver bridge | Connects Zod schemas to RHF validation. Required for the RHF + Zod pattern. |
| zod | ^3.24.0 | Schema validation + TypeScript inference | Type-safe validation that infers TS types from schemas. Use Zod 3.x (not 4.x) because shadcn/ui Form and @hookform/resolvers are tested against Zod 3. Zod 4 has breaking API changes. |

**Confidence:** HIGH -- shadcn/ui Form docs explicitly use this stack (ui.shadcn.com/docs/forms/react-hook-form)

**Installation:**
```bash
npx shadcn@latest add form
# Then manually:
npm install zod @hookform/resolvers
```

**Why not Formik:** Formik uses controlled inputs causing re-renders on every keystroke. RHF's uncontrolled approach is measurably faster for complex forms. shadcn/ui has no Formik integration.

**Why not Zod 4.x:** Zod 4 (released as 4.3.6) introduced breaking changes. The shadcn/ui Form component and @hookform/resolvers are built and tested against Zod 3.x. Upgrading would require waiting for ecosystem compatibility. Stick with 3.x for stability.

### Data Tables: TanStack Table

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @tanstack/react-table | ^8.21.0 | Headless table logic for member lists, event management, analytics tables | Club member management, event lists with sorting/filtering, analytics data grids. shadcn/ui's DataTable component is built on TanStack Table. Headless = full control over rendering with Tailwind. |

**Confidence:** HIGH -- shadcn/ui DataTable docs use this (ui.shadcn.com/docs/components/radix/data-table)

**Installation:**
```bash
npx shadcn@latest add table
npm install @tanstack/react-table
```

**Why not AG Grid / MUI DataGrid:** Overkill for this use case. We need sorting, filtering, and pagination on small-to-medium datasets (a club has dozens of members, not millions of rows). TanStack Table is headless and integrates with shadcn/ui natively.

### Rating Component: Custom Build with Lucide Icons

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| (none -- custom component) | -- | Star rating for post-event reviews | The review system needs a simple 1-5 star rating input. Building this with Lucide's `Star` icon + Tailwind is ~30 lines of code. Adding @smastrom/react-rating (last updated 2+ years ago, only v1.5.0) for a single component is unnecessary dependency bloat. |

**Confidence:** HIGH -- straightforward UI pattern, no library needed

**Implementation sketch:**
```typescript
// Use Lucide's Star icon with fill toggle
import { Star } from 'lucide-react';
// onClick sets rating, hover previews, filled vs outline stars
```

**Why not @smastrom/react-rating:** Last published 2+ years ago (v1.5.0). Stale maintenance for a trivial component. The project already has Lucide React for icons.

## Database Layer (Supabase -- No New Dependencies)

These are patterns to implement within the existing Supabase setup, not new libraries:

### Analytics Aggregation: PostgreSQL Views + Materialized Views

| Pattern | Purpose | Why |
|---------|---------|-----|
| Regular SQL views | Real-time counts (follower count, RSVP count) | Supabase exposes views via the API just like tables. RLS works on regular views. Good for live counts that must be current. |
| Materialized views | Pre-computed analytics (weekly trends, historical metrics) | Expensive aggregations (event performance over time, club growth trends) should be pre-computed. Refresh on a schedule via Supabase cron (pg_cron). Reduces dashboard load time from seconds to milliseconds. |
| Database functions (RPC) | Complex analytics queries with parameters | `supabase.rpc('get_club_analytics', { club_id, date_range })` keeps analytics logic in PostgreSQL, not in API routes. Faster, more secure, and testable. |

**Confidence:** HIGH -- standard PostgreSQL patterns, well-documented by Supabase

**Important caveat:** Materialized views do NOT support RLS in PostgreSQL. Access control for materialized view data must be enforced at the API route level or via database functions that check permissions before returning data.

### Multi-Club Organization: RLS Policies on club_members

| Pattern | Purpose | Why |
|---------|---------|-----|
| `club_members` table with role column | Maps users to clubs with roles (owner, admin, member) | Already exists in the schema. RLS policies should check `auth.uid()` against `club_members.user_id` for the target `club_id`. |
| JWT custom claims (optional) | Embed active club_id in session for fast RLS checks | Not needed initially -- query `club_members` in RLS policies. Only add custom claims if RLS performance becomes an issue with many clubs. |

**Confidence:** HIGH -- existing table structure supports this pattern

## Libraries Explicitly NOT Adding

| Library | Why Not |
|---------|---------|
| Tremor | Redundant with shadcn/ui Chart. Adds competing component system. |
| Chart.js / react-chartjs-2 | Imperative API, poor React integration compared to Recharts. |
| D3 | Too low-level for dashboard charts. Use Recharts which wraps D3 internals. |
| Formik | Controlled inputs cause performance issues. shadcn/ui doesn't support it. |
| Zod 4.x | Breaking changes, ecosystem not ready. Use Zod 3.x. |
| @smastrom/react-rating | Stale (2+ years), trivial to build custom. |
| AG Grid | Massive bundle for simple tables. TanStack Table is sufficient. |
| React Query / TanStack Query | SWR is already in the project for data fetching. Don't add a competing library. |
| Prisma / Drizzle ORM | Supabase JS client is the ORM. Adding another creates confusion about which to use. |
| NextAuth / Auth.js | Supabase Auth is already configured. Don't add a second auth system. |

## Full Installation Script

```bash
# Charts (via shadcn CLI)
npx shadcn@latest add chart

# Forms (via shadcn CLI + manual)
npx shadcn@latest add form
npm install zod@^3.24.0 @hookform/resolvers@^5.0.0

# Data Tables
npx shadcn@latest add table
npm install @tanstack/react-table@^8.21.0

# That's it. No other new dependencies needed.
```

## State Management Strategy

The project already uses Zustand (^5.0.9) for auth state. Extend this pattern for club management:

| Store | Purpose |
|-------|---------|
| `useAuthStore` | Existing -- user auth state |
| `useActiveClubStore` | NEW -- tracks which club the organizer is currently managing (for multi-club switching) |

For server data (club details, analytics, members), continue using SWR with API routes. Zustand is for UI state only (active club selection, modal states, form step tracking).

## Sources

- [shadcn/ui Chart documentation](https://ui.shadcn.com/docs/components/radix/chart)
- [shadcn/ui Form documentation](https://ui.shadcn.com/docs/forms/react-hook-form)
- [shadcn/ui DataTable documentation](https://ui.shadcn.com/docs/components/radix/data-table)
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0, actively maintained
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) -- v7.71.2
- [Zod npm](https://www.npmjs.com/package/zod) -- v3.24.x (use 3.x, not 4.x)
- [@tanstack/react-table npm](https://www.npmjs.com/package/@tanstack/react-table)
- [Supabase Materialized Views](https://supabase.com/blog/postgresql-views)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime documentation](https://supabase.com/docs/guides/realtime)
- [@smastrom/react-rating npm](https://www.npmjs.com/package/@smastrom/react-rating) -- v1.5.0, last published 2+ years ago
