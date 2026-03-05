# Project Research Summary

**Project:** Uni-Verse -- Club Management, Analytics, Reviews Milestone
**Domain:** Campus event platform (organizer-facing tools)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Uni-Verse is an existing campus event discovery platform for McGill University that needs organizer-facing tools: club management dashboards, event analytics, post-event reviews, and multi-club support. The critical insight from research is that most of the data infrastructure already exists. The `user_interactions`, `event_popularity_scores`, `club_members`, `club_followers`, and `notifications` tables are all in place. This milestone is primarily a **presentation and workflow layer** on top of existing data, not a greenfield build. The recommended approach is to extend the current Next.js App Router monolith with Supabase RPC functions for analytics aggregation, add two new tables (event_reviews, review_responses), and build dashboard UI components using the existing shadcn/ui stack plus Recharts for charts.

The biggest risk is security, not complexity. Supabase's anon key is public, meaning RLS policies are the real security boundary. If RLS policies on club-scoped data are too broad, organizers of one club can read another club's analytics, members, or reviews. The existing codebase already has application-level auth checks, but these are bypassed by direct client-side Supabase calls. Every new table and view must have RLS policies that join through `club_members` to verify the requesting user's membership. This must be established in the first phase and tested from the client SDK, not the SQL editor.

The second key risk is over-engineering analytics. The `user_interactions` table already tracks everything needed (views, clicks, saves, shares, calendar adds). The temptation is to build dashboards for all metrics at once. Research strongly recommends starting with exactly three metrics -- views, saves, and follower count change -- and adding more only when organizers ask for them. Compute aggregations in PostgreSQL (via RPC functions or views), not in JavaScript API routes.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, TypeScript, Tailwind, shadcn/ui, Supabase, SWR, Zustand) stays unchanged. Three new libraries are needed, all officially supported by shadcn/ui. See [STACK.md](./STACK.md) for full details.

**New dependencies:**
- **Recharts** (via `shadcn add chart`): Charting for analytics dashboards. shadcn/ui's Chart component wraps Recharts natively.
- **React Hook Form + Zod 3.x** (via `shadcn add form`): Form validation for club settings, event creation, review submission. Do NOT use Zod 4.x (breaking changes, ecosystem not ready).
- **TanStack Table** (via `shadcn add table`): Headless data tables for member lists and event management grids.

**Not adding:** Tremor (redundant with shadcn), Chart.js/D3 (not React-native), Formik (controlled inputs, no shadcn integration), React Query (SWR already in codebase), Prisma/Drizzle (Supabase client is the ORM).

**Database patterns (no new dependencies):** PostgreSQL views and RPC functions for analytics aggregation. Materialized views for expensive time-series queries (note: materialized views do not support RLS -- enforce access in API routes or via SECURITY DEFINER functions).

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis including dependency graph.

**Must have (table stakes):**
- Club profile page (public) + editing -- foundation everything else builds on
- Event creation flow with club selector for multi-club organizers
- Auto-approval for own-club events -- organizers expect instant publishing
- My clubs list with basic stats
- Event list with status filtering + RSVP counts visible to organizers
- Member/team management with invite flow
- Follow/unfollow with follower count visibility

**Should have (differentiators):**
- Event-level analytics dashboard (views, saves, RSVPs per event)
- Club-level analytics trends (follower growth, engagement over time)
- Post-event review system (organizer-facing only)
- Multi-club quick-switcher (Slack/Discord workspace-switcher pattern)
- Event duplication ("create similar event")
- Follower notifications on new event publish

**Defer (later in milestone or v2):**
- Club-level analytics trends (build after event analytics is solid)
- Engagement comparison across events (power-user feature)
- Public-facing reviews (moderation burden, defer until organizer reviews prove useful)
- Ticketing/payments, real-time chat, custom registration forms, attendance check-in

### Architecture Approach

The architecture extends the existing monolith. No new services needed. The pattern is: Server Components for initial data loading and auth checks, Client Components for interactive tabs, API routes as thin pass-throughs to Supabase RPC functions for analytics. Club context is URL-driven (`/my-clubs/[id]`), not global state. See [ARCHITECTURE.md](./ARCHITECTURE.md) for component diagram and data flows.

**Major components:**
1. **Club Dashboard (reworked)** -- Tab-based management hub (Overview, Events, Analytics, Reviews, Members, Settings). Server Component loads header data; each tab fetches its own data client-side.
2. **Analytics system** -- Supabase RPC functions (`get_club_analytics`, `get_event_analytics`) aggregate existing `user_interactions` data. API routes are thin wrappers. Recharts renders charts in the Analytics tab.
3. **Review system** -- Two new tables (`event_reviews`, `review_responses`). Students review past events they attended. Organizers see aggregated feedback in the Reviews tab. Reviews are organizer-facing only in this milestone.
4. **Club Switcher** -- Dropdown navigation component that redirects to `/my-clubs/[other-id]`. No global state -- pure URL navigation.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for full analysis with 11 identified pitfalls.

1. **RLS policies that don't isolate club data** -- The anon key is public. If RLS is misconfigured, any authenticated user can query any club's data directly. Prevention: write RLS policies that join through `club_members`, test from client SDK before every release.
2. **Authorization only at the API route level** -- Next.js App Router has many entry points (Server Components, Server Actions, direct client calls). Prevention: treat RLS as the primary security boundary, create a shared `verifyClubMembership()` utility, treat API checks as UX guardrails.
3. **Over-engineering analytics** -- Building 15 charts nobody uses. Prevention: start with exactly 3 metrics (views, saves, follower change), pre-aggregate in PostgreSQL, add only on demand.
4. **Multi-club state corruption** -- Switching clubs while editing can submit data to the wrong club. Prevention: club ID comes from URL params only, forms embed `club_id` at render time, no global "current club" state.
5. **N+1 queries in club listing** -- Current `my-clubs/route.ts` runs 2 queries per club. Adding analytics multiplies this. Prevention: batch queries using Postgres views or relational selects from day one.

## Implications for Roadmap

### Phase 1: Club Management Foundation

**Rationale:** Everything depends on the club profile and management infrastructure. The public club page, editing flow, and member management are prerequisites for analytics, reviews, and multi-club features. Also the phase where RLS patterns must be established correctly.
**Delivers:** Complete club profile pages (public and organizer-facing), club settings editing, member management with invites, my-clubs list, auto-approval for organizer events, follower count display.
**Addresses:** All table-stakes features from FEATURES.md except analytics and reviews.
**Avoids:** Pitfalls 1 (RLS isolation), 2 (auth at data layer), 4 (multi-club state -- establish URL-based pattern here), 6 (N+1 queries), 7 (auto-approval edge cases), 9 (invitation token exposure), 11 (orphaned clubs).

### Phase 2: Event Analytics Dashboard

**Rationale:** Uses entirely existing data (`user_interactions`, `event_popularity_scores`). Zero migration risk. High organizer value -- this is the primary differentiator over competing campus platforms.
**Delivers:** Event-level analytics (views, saves, RSVPs per event), club-level summary stats, Recharts-powered charts in the dashboard Analytics tab.
**Uses:** Recharts (from STACK.md), Supabase RPC functions (from ARCHITECTURE.md).
**Implements:** Analytics data flow -- RPC functions for aggregation, thin API routes, Analytics tab component.
**Avoids:** Pitfall 3 (over-engineering -- start with 3 metrics), Pitfall 6 (pre-aggregate instead of N+1).

### Phase 3: Post-Event Review System

**Rationale:** Requires new database tables (`event_reviews`, `review_responses`) and a more complex validation flow (date checks, RSVP eligibility, uniqueness constraints). Best built after the dashboard shell is stable.
**Delivers:** Student review submission form on past events, organizer-facing review aggregation in the Reviews tab, optional organizer responses.
**Uses:** React Hook Form + Zod (from STACK.md), custom star rating component with Lucide icons.
**Implements:** Review data flow from ARCHITECTURE.md -- new tables with RLS, review form, review aggregation RPC.
**Avoids:** Pitfall 5 (pre-event/duplicate reviews -- enforce via CHECK + UNIQUE constraints in the migration), Pitfall 10 (unanchored ratings -- use attribute-based or simple anchored scale).

### Phase 4: Multi-Club Polish and UX Enhancements

**Rationale:** UX convenience layer that benefits from all dashboard tabs being complete. Low complexity, high daily-use value for organizers managing multiple clubs.
**Delivers:** Club switcher dropdown, enhanced event creation with club selector, event duplication, follower notification on publish.
**Implements:** ClubSwitcher component, enhanced EventCreateForm from ARCHITECTURE.md.
**Avoids:** Pitfall 4 (state corruption -- pure URL navigation, no global club state).

### Phase Ordering Rationale

- Phases follow a strict dependency chain: club management must exist before analytics can display data about clubs, reviews need the dashboard shell, and multi-club polish needs all tabs working.
- Security patterns (RLS, auth utilities) are established in Phase 1 and inherited by all subsequent phases. Getting this wrong early means rewriting RLS for every new table.
- Analytics before reviews because analytics has zero schema migration risk (uses existing tables only), while reviews require new tables and more complex validation.
- Multi-club UX last because it is a convenience layer -- a nice dropdown that navigates between complete dashboards, not a foundation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Analytics):** The specific RPC function implementations need careful design. Which exact aggregation queries perform well at McGill scale? Start minimal but validate query performance against realistic data volumes.
- **Phase 3 (Reviews):** Rating UX design needs user input. Should it be 1-5 stars, thumbs up/down, or attribute-based? Research suggests attribute-based but the choice affects schema design.

Phases with standard patterns (skip deep research):
- **Phase 1 (Club Management):** CRUD operations, RLS policies, tab-based dashboards -- all well-documented patterns in Next.js + Supabase. Existing codebase already demonstrates the pattern.
- **Phase 4 (Multi-Club Polish):** Simple navigation component and form pre-filling. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations are officially supported by shadcn/ui. Versions verified against npm. Existing stack unchanged. |
| Features | MEDIUM-HIGH | Feature landscape validated against Luma, Eventbrite, CampusGroups. Anti-features clearly scoped. Minor uncertainty on review system UX (rating scale design). |
| Architecture | HIGH | All patterns derived from existing codebase analysis. No new services or paradigms. Extends proven patterns already in production. |
| Pitfalls | HIGH | Critical pitfalls verified against Supabase docs and existing code inspection. N+1 pattern confirmed in current `my-clubs/route.ts`. RLS risks documented by Supabase themselves. |

**Overall confidence:** HIGH

### Gaps to Address

- **Review rating UX:** Research identifies that bare 1-5 star ratings produce biased data, but the optimal alternative (attribute-based, binary, anchored scale) requires organizer input. Decide during Phase 3 planning.
- **Materialized view refresh strategy:** If analytics queries become slow, materialized views are the solution, but they do not support RLS. The access control pattern for materialized view data (SECURITY DEFINER functions vs. API-level checks) needs to be decided before implementation.
- **Follower count denormalization:** Research recommends a `follower_count` column with a Postgres trigger instead of live COUNT queries. This is a schema change that should be done early but is not in the existing codebase. Decide timing during Phase 1 planning.
- **Event audit after member removal:** When an organizer is removed from a club, their auto-approved future events should be flagged for review. The trigger/mechanism for this is not designed yet.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis -- all architecture patterns, database schema, current component structure
- [shadcn/ui documentation](https://ui.shadcn.com/) -- Chart, Form, DataTable component recommendations
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- security patterns
- [Next.js App Router authentication guide](https://nextjs.org/docs/app/guides/authentication) -- auth boundary warnings

### Secondary (MEDIUM confidence)
- [Luma](https://help.luma.com/), [Eventbrite](https://www.eventbrite.com/organizer/features/event-management-software/), [CampusGroups](https://www.readyeducation.com/en-us/campusgroups) -- feature landscape benchmarking
- [Supabase blog on PostgreSQL views](https://supabase.com/blog/postgresql-views) -- analytics aggregation patterns
- [Multi-tenant RLS patterns](https://dev.to/blackie360/) -- club data isolation strategies
- [Rating systems UX research](https://uxdesign.cc/the-ux-of-rating-systems-bc4f9d424b90) -- review system design

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
