# PRD: Club Organizer Experience & Follow-Based Discovery

**Date:** 2026-02-26
**Author:** Adyan Ullah
**Status:** Draft
**Epic:** Club Organizer Experience

---

## 1. Problem Statement

Uni-Verse currently treats clubs as static event publishers — organizers create a club, post events, and manage a small member list. There's no reason for organizers to prefer Uni-Verse over an Instagram post. Meanwhile, students browse events in a flat list with no connection to the clubs they care about.

**For organizers:** No analytics, no audience insights, no feedback loop. They publish into a void and have no idea what's working.

**For students:** No way to follow clubs. The feed is the same whether you've been using the app for a day or a semester.

## 2. Vision

Make the organizer dashboard the **event operations command center** that no other campus platform offers. The killer feature is **analytics** — Instagram can give you followers, but it can't tell you which event tags drive saves, whether your reach extends beyond your base, or how loyal your audience is.

For students, introduce a **follow system** that creates a personalized, blended feed — clubs you follow mixed with algorithmic recommendations — making the home page feel like a curated Instagram-style scroll for campus events.

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Club follow adoption | 60% of active users follow at least 1 club within 30 days |
| Organizer dashboard usage | Organizers check analytics at least 2x/week |
| Feed engagement | 20% increase in event detail page views from home feed |
| Non-follower reach | Events average 30%+ views from non-followers |

## 4. User Stories

### 4.1 Student User Stories

**US-1:** As a student, I want to follow clubs I'm interested in so their events show up in my feed.

**US-2:** As a student, I want a blended home feed that mixes events from clubs I follow with recommendations, so I can scroll and discover events like I do on Instagram.

**US-3:** As a student, I want to see which clubs I follow and unfollow from their profile page or my profile.

### 4.2 Club Organizer User Stories (Phase 1 — Build Now)

**US-4:** As a club owner, I want to see a dashboard overview of my club's performance — follower count, event views, saves, follower growth — so I can report to my exec team.

**US-5:** As an organizer, I want to create and publish events directly (no admin approval needed for approved clubs) so I can move fast. *(Already implemented.)*

**US-6:** As an organizer, I want to see per-event analytics (views, saves, discovery source, follower vs non-follower breakdown) so I know which events resonate.

**US-7:** As a club owner, I want aggregate analytics (reach trends, top tags, audience growth, returning user rate, event comparisons) for data-driven planning.

**US-8:** As a club owner, I want to edit my club's profile (name, description, logo, Instagram handle) without needing an admin.

**US-9:** As a club owner, I want to manage my exec team (invite, remove, view) from the dashboard. *(Partially implemented.)*

**US-10:** As the platform, events with high engagement signals (saves, click-throughs, follower conversion) should be boosted in discoverability — appearing in trending sections and ranked higher in recommendations.

### 4.3 Future User Stories (Phase 2 — Documented, Not Built)

**US-11:** As an organizer, I want to group events into programs (e.g., "AI Workshop Series Week 1–4") so students can discover and follow the whole series.

**US-12:** As a club owner, I want to co-host events with partner clubs so both clubs get visibility and shared analytics.

**US-13:** As an organizer, I want RSVP tracking, attendee lists, and check-in tools. *(Scaling phase — ticketing system.)*

---

## 5. Feature Design

### 5.1 Follow System

**Model:** Lightweight, one-tap follow. No approval needed. Similar to Instagram's public follow.

**Database:**

```sql
CREATE TABLE club_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, club_id)
);

CREATE INDEX idx_club_followers_club ON club_followers(club_id);
CREATE INDEX idx_club_followers_user ON club_followers(user_id);
```

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/clubs/:id/follow` | Follow a club |
| DELETE | `/api/clubs/:id/follow` | Unfollow a club |
| GET | `/api/clubs/:id/follow` | Check if current user follows this club |
| GET | `/api/user/following` | List clubs current user follows |

**UI Touchpoints:**
- Follow/Unfollow button on club profile page (`/clubs/:id`)
- Follower count displayed on club profile (public)
- "Following" list accessible from user profile or sidebar
- Follow button on event cards when source is "Suggested for you" (follow the club directly from the feed)

**RLS Policies:**
- Any authenticated user can follow/unfollow
- Follower list is readable by club owners/organizers (for analytics)
- Users can read their own follows

### 5.2 Blended Home Feed

The home page becomes a single scrollable feed blending two sources:

| Source | Proportion | Content |
|--------|------------|---------|
| **Following** | ~60% | Upcoming events from followed clubs, ordered by event start date |
| **For You** | ~40% | Recommendation engine output, boosted by popularity signals |

**Behavior:**
- Events are interleaved in a single scroll — not separate tabs
- Each event card has a subtle source label: "From [Club Name]" (following) or "Suggested for you" (recommendation) or "Trending" (high engagement)
- Users who follow zero clubs get 100% recommendations (cold start)
- As users follow more clubs, the ratio shifts to prioritize followed content
- De-duplicate: an event from a followed club that also scores high in recommendations appears once, labeled as "Following"

**Feed API:**

```
GET /api/feed
  ?cursor=...       // pagination
  &limit=20         // events per page

Response: {
  events: [
    { ...event, feedSource: "following" | "for_you" | "trending" }
  ],
  nextCursor: "..."
}
```

**Implementation approach:**
1. Fetch followed clubs' upcoming events (sorted by start_date)
2. Fetch recommendation engine results (existing `/api/recommendations`)
3. Interleave: pick from following pool ~60%, for_you ~40%, de-duplicate by event ID
4. Tag trending events (engagement velocity above threshold)
5. Return merged list with `feedSource` annotation

### 5.3 Organizer Analytics Dashboard

The dashboard lives in the existing `/my-clubs/:id` page. The **Overview** tab (currently basic club info) becomes the analytics hub.

#### 5.3.1 Club-Level Analytics (Overview Tab)

| Metric | Description | Visualization |
|--------|-------------|---------------|
| **Followers** | Total count + net change (last 7d / 30d) | Number with trend arrow + sparkline |
| **Follower Growth** | New followers per week | Line chart (last 8 weeks) |
| **Total Event Views** | Aggregate views across all club events | Number with trend arrow |
| **Total Saves** | Aggregate saves across all club events | Number with trend arrow |
| **Events Published** | Count by status: live / past / pending | Number breakdown |
| **Returning Users** | % of users who engaged with 2+ club events | Percentage with trend |
| **Follower vs Non-Follower Reach** | Views and saves split by follower status | Stacked bar or donut chart |
| **Top Performing Events** | Ranked by engagement score (views + saves) | Sorted list with horizontal bars |
| **Best Performing Tags** | Which event tags drive the most engagement | Ranked tag list with counts |
| **Audience Interest Tags** | What interest tags the club's followers have | Bar chart of top tags |

#### 5.3.2 Per-Event Analytics (Events Tab)

Each event in the organizer's event list can expand to show:

| Metric | Description |
|--------|-------------|
| **Views** | Total event detail page views |
| **Saves** | Total saves |
| **Save Rate** | Saves / Views — conversion metric |
| **Follower vs Non-Follower** | Views and saves split: "198 followers (58%) / 144 non-followers (42%)" |
| **Discovery Source** | How users found it: Following feed, For You, Search, Trending, Club Page, Direct |
| **Follower Conversion** | Users who viewed this event → then followed the club |
| **Trending Status** | Whether the event is/was in the trending section |

#### 5.3.3 Analytics Data Collection

**New table — `event_analytics`:**

```sql
CREATE TABLE event_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('view', 'save', 'unsave', 'click_club', 'share')),
  source TEXT CHECK (source IN ('following_feed', 'for_you', 'search', 'trending', 'direct', 'club_page')),
  is_follower BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_analytics_event ON event_analytics(event_id);
CREATE INDEX idx_event_analytics_event_action ON event_analytics(event_id, action_type);
CREATE INDEX idx_event_analytics_created ON event_analytics(created_at);
```

**Collection points:**
- **View:** Logged when a user opens the event detail page. Source is passed from the feed context.
- **Save/Unsave:** Logged when a user saves or unsaves an event. `is_follower` is checked at write time against `club_followers`.
- **Click Club:** Logged when a user clicks through from an event to the club's profile page.

**Aggregation strategy:**
- Analytics are computed at query time with SQL aggregations (COUNT, GROUP BY)
- Cache aggregated results with `s-maxage=300` (5 min) for the dashboard
- No real-time streaming — organizers see data refreshed every 5 minutes
- For expensive queries (trends over time), pre-aggregate daily via a scheduled function

**API Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/clubs/:id/analytics` | Club-level aggregate metrics | Owner/Organizer |
| GET | `/api/clubs/:id/analytics/events` | Per-event metrics for all club events | Owner/Organizer |
| GET | `/api/events/:id/analytics` | Single event detailed analytics | Owner/Organizer |
| POST | `/api/analytics/track` | Log an analytics event (view, click_club) | Authenticated |

**Note:** Save/unsave tracking piggybacks on the existing save endpoint — no separate track call needed.

### 5.4 Club Profile Editing

**Current state:** Only admins can modify club details. The Settings tab says "coming soon."

**New behavior:** Club owners AND organizers can edit their club's profile.

**Editable fields:**
- Club name
- Description
- Instagram handle
- Logo (upload via existing `/api/clubs/logo` endpoint)
- Category

**Admin-only (unchanged):**
- Club status (approved / rejected / pending)
- Deleting a club

**New endpoint:**

```
PATCH /api/clubs/:id
Body: { name?, description?, instagram_handle?, logo_url?, category? }
Auth: Must be a member of the club (owner or organizer role)
```

**Implementation:** The Settings tab in `ClubDashboard` renders an edit form pre-filled with current club data. Save triggers `PATCH /api/clubs/:id`. RLS policy allows updates only from `club_members` of that club.

### 5.5 Popularity Signal Feedback Loop

Events with high engagement should be algorithmically boosted. This creates the organizer value loop:

```
Organizer creates quality event
  → Students engage (save, view, follow)
    → Algorithm detects high engagement
      → Event gets boosted in recommendations + trending
        → More students discover it
          → Organizer sees growth in analytics dashboard
            → Organizer creates more quality events
```

**Trending criteria:**
An event qualifies for "Trending" when its engagement velocity (saves + views in the last 7 days, normalized by hours since posted) exceeds the 85th percentile of all active events.

**Boost mechanism:**
Events that meet trending criteria get a multiplier applied to their popularity score in the recommendation engine (see Section 6).

---

## 6. Recommendation Engine Evolution

### 6.1 Current Algorithm

The existing recommendation engine (`/api/recommendations/route.ts`) uses a three-signal weighted formula:

```
score = 0.45 × content_score + 0.40 × collaborative_score + 0.15 × popularity_score
```

| Signal | Method | Weight |
|--------|--------|--------|
| **Content** | Cosine similarity between user tag vector and event tag vector | 0.45 |
| **Collaborative** | k-means clustering — events saved by users in the same cluster | 0.40 |
| **Popularity** | Normalized `event_popularity_scores` table value | 0.15 |

Cold-start fallback (users with < threshold saves): popularity-ranked events with recency boost.

### 6.2 Enhanced Algorithm (With Follow + Analytics Signals)

The enhanced engine adds two new signal dimensions without replacing the existing ones. The goal is a cost-effective algorithm that learns from user behavior without requiring ML infrastructure (no model training, no GPU, no vector databases).

#### New Scoring Formula

```
score = 0.30 × content_score
      + 0.25 × collaborative_score
      + 0.20 × engagement_score     ← NEW
      + 0.15 × follow_affinity      ← NEW
      + 0.10 × popularity_score
```

#### New Signal: Engagement Score (0.20)

Measures real-time engagement velocity rather than static popularity counts.

```
engagement_score = normalize(
  (saves_7d × 3) + (views_7d × 1) + (club_follows_from_event × 5)
) / hours_since_posted
```

**Why this matters:** A new event with 20 saves in 2 hours is hotter than an old event with 50 saves over 2 weeks. Velocity rewards quality content that resonates quickly.

**Data source:** `event_analytics` table, aggregated with a 5-minute cache.

**Normalization:** Min-max normalization across all candidate events in the current query.

#### New Signal: Follow Affinity (0.15)

Incorporates the user's follow graph to personalize beyond tag similarity.

```
follow_affinity = weighted_sum(
  0.6 × is_followed_club,          // binary: user follows this event's club
  0.25 × similar_followers_saved,   // users who follow the same clubs also saved this
  0.15 × club_tag_overlap           // event's club publishes events matching user's interests
)
```

**Breakdown:**

| Sub-signal | Weight | Description |
|------------|--------|-------------|
| `is_followed_club` | 0.6 | 1 if the user follows this event's club, 0 otherwise. Direct signal — if you follow GDG, you probably want GDG events. |
| `similar_followers_saved` | 0.25 | Of users who follow the same clubs as you, what fraction saved this event? Collaborative signal scoped to follow graph instead of k-means. |
| `club_tag_overlap` | 0.15 | Cosine similarity between the event's club's historical tag distribution and the user's interest tags. "This club usually posts events you'd like." |

**Why not just put followed events at the top?** Because that would make the feed a boring chronological list. Follow affinity is a *signal*, not a filter — it boosts followed clubs' events but still lets a highly-engaging non-followed event rank above a mediocre followed one.

#### Cold-Start Improvements

| User State | Current Behavior | New Behavior |
|------------|-----------------|--------------|
| No saves, no follows, has interest_tags | Popularity fallback | Popularity fallback + events from most-followed clubs matching interest_tags |
| No saves, follows 1+ clubs | Popularity fallback | Following feed (100%) + trending events as backfill |
| Has saves, no follows | Full algorithm (content + collaborative + popularity) | Full algorithm with engagement_score replacing some popularity weight |
| Has saves + follows | N/A (follows didn't exist) | Full enhanced algorithm with all 5 signals |

#### Trending Feed Section

A dedicated "Trending This Week" section on the home page (alongside existing "Happening Now"):

```
trending_score = (saves_7d × 3 + views_7d × 1 + follows_from_event × 5) / hours_since_posted
```

Events scoring above the 85th percentile of all active events qualify. Display top 10, refreshed every 15 minutes via cached query.

#### Why This Is Cost-Effective

| What we do | What we don't do |
|------------|-----------------|
| SQL aggregations on `event_analytics` | No ML model training |
| In-memory cosine similarity (6-dimension vectors) | No vector database |
| Cached query results (5-min TTL) | No real-time streaming |
| k-means on user vectors (existing, lightweight) | No neural collaborative filtering |
| Simple engagement velocity formula | No complex feature engineering |
| Follow graph as a signal dimension | No social graph analysis |

The entire algorithm runs in a single API request with SQL queries + in-memory math. No external services, no GPU, no additional infrastructure cost beyond the existing Supabase plan.

#### Implementation Approach

1. **Keep existing algorithm intact** — the current `/api/recommendations` stays as the "For You" engine
2. **Add engagement scoring** by querying `event_analytics` with 7-day window, cache results
3. **Add follow affinity** by joining `club_followers` into the scoring pipeline
4. **Re-weight** the formula from 3 signals to 5 signals
5. **New `/api/feed` endpoint** handles interleaving following + for_you + trending
6. **`event_popularity_scores`** continues to exist for baseline popularity; `event_analytics` provides the real-time engagement layer on top

---

## 7. Data Model Changes Summary

| Change | Type | Purpose |
|--------|------|---------|
| `club_followers` | New table | Follow/unfollow relationships |
| `event_analytics` | New table | View, save, click tracking with source + follower status |
| `PATCH /api/clubs/:id` | New endpoint | Club profile editing by organizers |
| `POST/DELETE /api/clubs/:id/follow` | New endpoints | Follow/unfollow a club |
| `GET /api/clubs/:id/analytics` | New endpoint | Club-level analytics dashboard data |
| `GET /api/events/:id/analytics` | New endpoint | Per-event analytics |
| `POST /api/analytics/track` | New endpoint | Log view/click analytics events |
| `GET /api/feed` | New endpoint | Blended following + for_you home feed |
| Home page | Modified | Blended feed with source labels |
| Recommendation engine | Modified | Add engagement_score + follow_affinity signals |
| ClubDashboard Overview tab | Modified | Analytics visualizations |
| ClubDashboard Settings tab | Modified | Club profile edit form |
| Club profile page | Modified | Follow button + follower count |
| Event detail page | Modified | Track view analytics |

## 8. Phasing

### Phase 1 — Core (This PRD, Build Now)

1. **Follow system** — DB, API, UI (follow button, following list)
2. **Event analytics tracking** — DB, track endpoint, integrate into event detail + save flows
3. **Blended feed** — `/api/feed` endpoint, home page redesign
4. **Club profile editing** — Settings tab, `PATCH` endpoint
5. **Organizer analytics dashboard** — Overview tab with club + per-event metrics
6. **Algorithm enhancement** — Add engagement_score + follow_affinity to recommendation engine
7. **Trending section** — "Trending This Week" on home page

### Phase 2 — Future (Documented, Not Built)

8. **Multi-event programs** — Group events into series (workshop weeks, hackathon tracks) with shared branding and sequential discovery
9. **Cross-club co-hosting** — Shared event ownership between partner clubs, co-branded event cards, split analytics visibility
10. **Ticketing & RSVPs** — RSVP tracking, capacity limits, waitlists, attendee export, check-in tools *(Scaling phase)*

## 9. Out of Scope

- Community engagement features (posts, polls, announcements) — clubs use Instagram/Discord for this
- Granular executive roles (President, VP, Director) — keep existing owner/organizer model
- Real-time notifications for analytics — dashboard is pull-based, not push
- Payment/ticketing integration
- Chat or messaging between organizers and students

## 10. Open Questions

1. **Analytics retention:** How long do we keep raw `event_analytics` rows? Suggest 90 days raw, then aggregate into daily rollups.
2. **Follow privacy:** Should followers be visible to other students, or only to organizers? Suggest organizer-only (count is public, list is private).
3. **Trending algorithm tuning:** The 85th percentile threshold may need adjustment based on actual event volume. Start conservative, tune with real data.
4. **Rate limiting on analytics track:** Need to debounce view tracking to prevent inflation (e.g., max 1 view per user per event per hour).
