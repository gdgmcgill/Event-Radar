# Architecture Patterns

**Domain:** Campus event platform -- club management, analytics, reviews
**Researched:** 2026-03-05
**Confidence:** HIGH (based on existing codebase analysis + established Next.js/Supabase patterns)

## Current Architecture (As-Is)

The existing system follows a standard Next.js App Router monolith with Supabase as the backend:

```
Browser (Client Components)
    |
    v
Next.js App Router (API Routes + Server Components)
    |
    v
Supabase (PostgreSQL + Auth + Storage + RLS)
    |
    v
External: FastAPI Recommendation Service (Two-Tower model)
External: Apify Instagram Scraper Pipeline
```

### Existing Component Map

| Component | Location | Status |
|-----------|----------|--------|
| Event discovery (home feed) | `src/app/page.tsx` | Working |
| Event CRUD | `src/app/api/events/` | Working |
| Club public pages | `src/app/clubs/[id]/page.tsx` | Working |
| Club dashboard (organizer) | `src/app/my-clubs/[id]/page.tsx` | Skeleton -- tabs exist but settings/analytics empty |
| Club list (organizer) | `src/app/my-clubs/page.tsx` | Working -- shows clubs with basic stats |
| Interaction tracking | `src/app/api/interactions/route.ts` | Working -- tracks view/click/save/share/calendar_add |
| Popularity scoring | `src/app/api/admin/calculate-popularity/` | Working -- batch RPC via `update_event_popularity` |
| Follow/unfollow clubs | `src/app/api/clubs/[id]/follow/` | Working |
| Member management | `src/app/api/clubs/[id]/members/` | Working -- owner can add/remove |
| Invitation system | `src/app/api/clubs/[id]/invites/` | Working |
| Admin moderation | `src/app/moderation/` | Working |
| Notifications | `src/app/api/notifications/` | Working |
| Recommendations | `src/app/api/recommendations/` | Working -- external FastAPI service |

### Existing Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `events` | Core event data with status workflow | Yes |
| `clubs` | Club profiles | Yes |
| `users` | User profiles with roles array | Yes |
| `saved_events` | User-event bookmarks | Yes |
| `club_members` | Organizer membership (owner/organizer roles) | Yes |
| `club_invitations` | Pending invites with tokens | Yes |
| `club_followers` | Student-club follow relationships | Yes |
| `user_interactions` | Event interaction tracking (views, clicks, saves) | Yes |
| `event_popularity_scores` | Precomputed popularity/trending scores | Yes |
| `notifications` | User notification queue | Yes |

## Recommended Architecture (To-Be)

The new features (club management rework, analytics, reviews, multi-org) fit cleanly into the existing monolith. No new services needed -- extend the existing patterns.

### High-Level Component Diagram

```
+--------------------------------------------------+
|                    BROWSER                         |
|                                                    |
|  Student Views          Organizer Views            |
|  +-------------+       +-------------------+      |
|  | Home Feed   |       | My Clubs List     |      |
|  | Club Profile|       | Club Dashboard    |      |
|  | Event Detail|       |  - Overview       |      |
|  | Calendar    |       |  - Events         |      |
|  | My Events   |       |  - Analytics  NEW |      |
|  +------+------+       |  - Reviews    NEW |      |
|         |              |  - Members        |      |
|         |              |  - Settings   NEW |      |
|         |              +--------+----------+      |
|         |                       |                  |
|  +------+------+       +-------+--------+         |
|  | Review Form |       | Club Switcher  | NEW     |
|  |    NEW      |       +-------+--------+         |
|  +------+------+               |                  |
+--------+-------------------+---+------------------+
         |                   |
         v                   v
+--------------------------------------------------+
|              NEXT.JS API LAYER                    |
|                                                    |
|  Existing Routes              New Routes           |
|  /api/events/*               /api/clubs/[id]/      |
|  /api/clubs/*                  analytics    NEW    |
|  /api/interactions           /api/clubs/[id]/      |
|  /api/recommendations          settings    NEW    |
|  /api/notifications          /api/events/[id]/     |
|  /api/admin/*                  reviews     NEW    |
|                              /api/clubs/switch NEW |
+--------+-----------------------------------------+
         |
         v
+--------------------------------------------------+
|              SUPABASE                             |
|                                                    |
|  Existing Tables        New Tables                 |
|  events                 event_reviews       NEW   |
|  clubs                  review_responses    NEW   |
|  users                  (analytics via views       |
|  saved_events            on user_interactions)     |
|  club_members                                      |
|  club_followers         New Functions              |
|  club_invitations       get_club_analytics  NEW   |
|  user_interactions      get_event_analytics NEW   |
|  event_popularity       aggregate_reviews   NEW   |
|  notifications                                     |
+--------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Auth Requirement |
|-----------|---------------|-------------------|------------------|
| **Club Switcher** | Quick-switch dropdown for multi-club organizers | My Clubs API, Club Dashboard | Authenticated + club_organizer role |
| **Club Dashboard (reworked)** | Single-page management hub with tabs | Club API, Analytics API, Events API, Reviews API, Members API | Club member (owner or organizer) |
| **Analytics Tab** | Display event-level and club-level metrics | Analytics API (reads user_interactions + event_popularity_scores) | Club member |
| **Reviews Tab** | Show aggregate review feedback, respond to reviews | Reviews API | Club member |
| **Review Form (student)** | Post-event rating + optional text | Reviews API | Authenticated + attended/saved event |
| **Club Settings Tab** | Edit club profile, logo, description, category | Club Settings API, Supabase Storage | Club owner only |
| **Event Creation (enhanced)** | Club selector for multi-club organizers | Events Create API, My Clubs API | Club member for selected club |

### Data Flow

#### 1. Club Management Flow

```
Organizer visits /my-clubs
    -> GET /api/my-clubs (fetches clubs where user is member)
    -> Displays club cards with stats

Organizer clicks club card -> /my-clubs/[id]
    -> Server Component fetches club + membership + counts
    -> Renders ClubDashboard with tabs

Tab: Overview  -> Shows follower count, member count, quick stats
Tab: Events    -> GET /api/clubs/[id]/events (filterable by status)
Tab: Analytics -> GET /api/clubs/[id]/analytics (aggregated metrics)
Tab: Reviews   -> GET /api/clubs/[id]/reviews (post-event feedback)
Tab: Members   -> GET /api/clubs/[id]/members (existing)
Tab: Settings  -> GET + PUT /api/clubs/[id]/settings (club profile editing)
```

#### 2. Analytics Data Flow

Analytics are derived from **existing** `user_interactions` data. No new tracking instrumentation needed -- the interaction tracking system already captures views, clicks, saves, shares, and calendar_adds per event.

```
user_interactions (existing raw data)
    |
    v
Supabase SQL View or RPC Function: get_club_analytics(club_id, date_range)
    |
    +-> Event-level: views, clicks, saves, conversion rates per event
    +-> Club-level:  total views across events, follower growth (from club_followers),
    |                top-performing events, engagement trends
    +-> Time series: daily/weekly aggregation for charts
    |
    v
GET /api/clubs/[id]/analytics?range=7d|30d|all
    |
    v
Analytics Tab renders charts (use recharts -- already common in Next.js projects)
```

**Key architectural decision:** Compute analytics server-side in Supabase via SQL views or RPC functions, not in the API route. PostgreSQL is excellent at aggregation. The API route is a thin pass-through.

#### 3. Review System Data Flow

```
Event ends (event_date in the past)
    |
    v
Student who saved/RSVPd sees "Leave a review" prompt on Event Detail page
    |
    v
POST /api/events/[id]/reviews
    Body: { rating: 1-5, text?: string, tags?: string[] }
    Validation: user saved the event, event is past, one review per user per event
    |
    v
event_reviews table (new)
    |
    v
Organizer views Reviews tab in Club Dashboard
    GET /api/clubs/[id]/reviews -> aggregated across all club events
    Shows: average rating, rating distribution, recent text reviews
    |
    v
Organizer can respond (optional):
    POST /api/events/[id]/reviews/[review_id]/response
    -> review_responses table (new)
```

#### 4. Multi-Club Switching Flow

```
Organizer with multiple clubs visits /my-clubs
    -> Sees all clubs in card grid (existing)

From within /my-clubs/[id] dashboard:
    -> Club Switcher dropdown in dashboard header
    -> Shows other clubs the user manages
    -> Clicking switches to /my-clubs/[other-id]
    -> No separate API needed -- reuses GET /api/my-clubs data

From event creation (/create-event):
    -> Club selector dropdown (if user manages multiple clubs)
    -> GET /api/my-clubs provides the list
    -> Selected club_id is sent with event creation payload (existing field)
```

#### 5. Auto-Approval Flow (Enhancement to Existing)

Already partially implemented in `src/app/api/events/create/route.ts`:

```typescript
// Current code already does this:
if (roles.includes("club_organizer") && body.club_id) {
  const { data: membership } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", body.club_id)
    .single();
  if (membership) {
    status = "approved";  // Auto-approve
  }
}
```

This pattern is correct and already working. No architectural change needed -- just ensure the event creation UI properly sends `club_id` when an organizer creates for their club.

## New Database Objects

### Tables

```sql
-- Post-event reviews from students
CREATE TABLE event_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  tags TEXT[] DEFAULT '{}',  -- e.g., ['well-organized', 'great-speakers']
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)  -- one review per user per event
);

-- Organizer responses to reviews (optional, one per review)
CREATE TABLE review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES event_reviews(id) ON DELETE CASCADE UNIQUE,
  responder_id UUID NOT NULL REFERENCES auth.users(id),
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Views / Functions

```sql
-- Club-level analytics view (materializable later if needed)
CREATE OR REPLACE FUNCTION get_club_analytics(
  p_club_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON AS $$
  -- Aggregates from user_interactions for all events belonging to club
  -- Returns: total_views, total_clicks, total_saves, top_events,
  --          daily_breakdown, follower_count, follower_growth
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Event-level analytics (extends existing popularity pattern)
CREATE OR REPLACE FUNCTION get_event_analytics(
  p_event_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days'
)
RETURNS JSON AS $$
  -- Returns: views, clicks, saves, shares, calendar_adds,
  --          unique_viewers, daily_breakdown, source_breakdown
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review aggregation for a club
CREATE OR REPLACE FUNCTION get_club_review_summary(p_club_id UUID)
RETURNS JSON AS $$
  -- Returns: avg_rating, total_reviews, rating_distribution,
  --          recent_reviews with text, common_tags
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies

```sql
-- event_reviews: anyone can read, only the reviewer can insert/update/delete their own
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON event_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON event_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON event_reviews FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON event_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- review_responses: readable by all, writable by club members
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read responses" ON review_responses FOR SELECT USING (true);
CREATE POLICY "Club members can respond" ON review_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN event_reviews er ON er.id = review_id
      JOIN events e ON e.id = er.event_id
      WHERE cm.user_id = auth.uid() AND cm.club_id = e.club_id
    )
  );
```

## Patterns to Follow

### Pattern 1: Server Component Data Loading + Client Component Interactivity

The existing `my-clubs/[id]/page.tsx` (Server Component) + `ClubDashboard.tsx` (Client Component) pattern is the correct approach. Continue it.

**What:** Server Component fetches initial data and authorization checks. Client Component handles tabs, state, and subsequent API calls within tabs.

**When:** Every dashboard-style page.

**Example (existing, follow this pattern for new tabs):**
```typescript
// Server Component: src/app/my-clubs/[id]/page.tsx
// - Authenticates user
// - Checks club membership
// - Fetches initial data in parallel
// - Passes to Client Component

// Client Component: src/components/clubs/ClubDashboard.tsx
// - Manages tab state via URL search params
// - Each tab is a lazy-loaded component
// - Tab components fetch their own data via API routes
```

### Pattern 2: Parallel Data Fetching with Promise.all

Already used consistently throughout the codebase. Continue using this pattern for all new routes.

**What:** Fetch independent data in parallel using `Promise.all`.

**When:** Any API route or Server Component that needs multiple independent queries.

```typescript
const [clubResult, eventsResult, followerResult] = await Promise.all([
  supabase.from("clubs").select("*").eq("id", clubId).single(),
  supabase.from("events").select("*").eq("club_id", clubId),
  supabase.from("club_followers").select("*", { count: "exact", head: true }).eq("club_id", clubId),
]);
```

### Pattern 3: Authorization at API + RLS Layers

The codebase uses a belt-and-suspenders approach: API routes check membership/role explicitly, and RLS policies provide a safety net. Continue this.

**What:** Validate user role/membership in the API route handler before querying. RLS is the fallback, not the primary check.

**When:** Every protected API route.

```typescript
// 1. Authenticate
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 2. Authorize (check membership/role)
const { data: membership } = await supabase
  .from("club_members").select("role")
  .eq("user_id", user.id).eq("club_id", clubId).single();
if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// 3. Proceed with query (RLS also enforces)
```

### Pattern 4: Heavy Computation in Supabase, Thin API Routes

The existing `update_event_popularity` RPC function pattern is correct. Analytics aggregation belongs in PostgreSQL, not in Node.js API routes.

**What:** Use Supabase RPC functions (`supabase.rpc()`) for any aggregation, scoring, or complex queries. API routes validate input, call the function, and return results.

**When:** Analytics dashboards, review summaries, popularity calculations.

### Pattern 5: URL-Driven Tab State

The ClubDashboard uses URL search params (`?tab=events`) for tab state. This enables deep linking and browser back/forward. Continue this.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching All Data in the Server Component

**What:** Loading analytics/reviews/member data for ALL tabs in the Server Component's initial render.

**Why bad:** Wastes bandwidth and time. Most tabs won't be viewed.

**Instead:** Server Component loads only the header data (club info, counts). Each tab component fetches its own data client-side when activated.

### Anti-Pattern 2: Client-Side Analytics Aggregation

**What:** Fetching raw `user_interactions` rows and aggregating in JavaScript.

**Why bad:** Will not scale. Even with 1000 events, the raw interaction table could have millions of rows.

**Instead:** Use Supabase RPC functions or SQL views for aggregation. Return pre-computed summaries to the client.

### Anti-Pattern 3: Separate Analytics Service

**What:** Building a separate microservice for analytics.

**Why bad:** Over-engineering for the current scale (university campus). Adds deployment complexity, latency, and maintenance burden.

**Instead:** PostgreSQL aggregation queries handle this perfectly at campus scale (< 100K interactions/month). Revisit if the platform expands to multi-university.

### Anti-Pattern 4: Storing Computed Metrics in the Events Table

**What:** Adding `view_count`, `save_count` columns directly to the `events` table and incrementing them on each interaction.

**Why bad:** Race conditions, stale data, tight coupling. The existing codebase correctly uses a separate `event_popularity_scores` table with batch recomputation.

**Instead:** Continue the existing pattern -- `user_interactions` for raw data, computed views/functions for aggregation, `event_popularity_scores` for cached results.

### Anti-Pattern 5: Global State for Club Context

**What:** Using React Context or Zustand to store "current club" globally for multi-club switching.

**Why bad:** The club context is route-driven (`/my-clubs/[id]`). Global state creates sync issues with URL and makes deep linking unreliable.

**Instead:** Club ID comes from the URL param. The switcher navigates to a new URL. Components read club ID from route params.

## New API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/clubs/[id]/analytics` | GET | Club-level + event-level metrics | Club member |
| `GET /api/clubs/[id]/analytics/events/[eventId]` | GET | Single event detailed analytics | Club member |
| `PUT /api/clubs/[id]/settings` | PUT | Update club profile/description/logo | Club owner |
| `GET /api/events/[id]/reviews` | GET | List reviews for an event | Public |
| `POST /api/events/[id]/reviews` | POST | Submit a review | Authenticated + past event |
| `PUT /api/events/[id]/reviews/[reviewId]` | PUT | Edit own review | Review author |
| `DELETE /api/events/[id]/reviews/[reviewId]` | DELETE | Delete own review | Review author |
| `POST /api/events/[id]/reviews/[reviewId]/response` | POST | Organizer responds to review | Club member |
| `GET /api/clubs/[id]/reviews` | GET | Aggregated reviews across club events | Club member |

## New/Modified Components

| Component | Location | New/Modified |
|-----------|----------|-------------|
| `ClubDashboard` | `src/components/clubs/ClubDashboard.tsx` | Modified -- add Analytics, Reviews, Settings tabs |
| `ClubAnalyticsTab` | `src/components/clubs/ClubAnalyticsTab.tsx` | New |
| `ClubReviewsTab` | `src/components/clubs/ClubReviewsTab.tsx` | New |
| `ClubSettingsTab` | `src/components/clubs/ClubSettingsTab.tsx` | New |
| `ClubSwitcher` | `src/components/clubs/ClubSwitcher.tsx` | New -- dropdown in dashboard header |
| `ReviewForm` | `src/components/events/ReviewForm.tsx` | New -- on event detail page |
| `ReviewCard` | `src/components/events/ReviewCard.tsx` | New -- displays a single review |
| `AnalyticsChart` | `src/components/clubs/AnalyticsChart.tsx` | New -- reusable chart wrapper |
| `EventCreateForm` (enhanced) | `src/components/events/EventCreateForm.tsx` | Modified -- add club selector |

## Suggested Build Order (Dependencies)

The build order is driven by data dependencies and user value. Each layer builds on the previous:

```
Phase 1: Club Settings + Profile Editing
    |  (Foundation -- organizers can fully manage their club profile)
    |  No dependencies on new tables.
    |  Unblocks: public club pages look complete
    v
Phase 2: Analytics Dashboard
    |  (High value -- organizers can see engagement)
    |  Depends on: existing user_interactions table (no new tables)
    |  Requires: new Supabase RPC functions + Analytics Tab component
    |  Unblocks: organizer motivation to post more events
    v
Phase 3: Review System
    |  (New tables: event_reviews, review_responses)
    |  Depends on: events existing and being in the past
    |  Requires: new tables, RLS policies, Review Form + Review Tab
    |  Unblocks: feedback loop between students and organizers
    v
Phase 4: Multi-Club Polish + Club Switcher
    (UX enhancement -- no new tables or APIs)
    Depends on: dashboard tabs all working
    Requires: ClubSwitcher component, enhanced event creation form
```

**Rationale for this order:**
1. Settings first because organizers need to set up their club before analytics/reviews matter.
2. Analytics before reviews because analytics use existing data (zero migration risk) and provide immediate value.
3. Reviews after analytics because reviews require new tables and a more complex validation flow (checking event dates, preventing duplicate reviews).
4. Multi-club switching last because it is a UX convenience layer that benefits from all tabs being complete.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 100K users |
|---------|--------------|--------------|---------------|
| Analytics queries | Direct SQL aggregation per request | Add database indexes on (club_id, created_at) for user_interactions | Materialized views refreshed on schedule |
| Review volume | Direct queries fine | Index on (event_id, created_at) | Paginate reviews, cache aggregates |
| Club switcher | Fetch all clubs per user | Same (organizers manage < 10 clubs) | Same |
| Interaction tracking | Insert per interaction | Same (Supabase handles this) | Batch inserts, consider queueing |
| Popularity scores | Batch recompute via cron | Same pattern, increase frequency | Incremental updates instead of full recompute |

**At McGill scale (30K students, ~200 clubs, ~1K events/semester), all patterns described above will perform well without optimization. The existing architecture handles this comfortably.**

## Sources

- Existing codebase analysis (PRIMARY -- all patterns derived from current implementation)
- Next.js App Router conventions (Server/Client Component boundaries)
- Supabase RLS and RPC documentation patterns
- PostgreSQL aggregation best practices for analytics workloads
