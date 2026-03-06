# Phase 3: Analytics and Reviews - Research

**Researched:** 2026-03-05
**Domain:** Analytics dashboards, charting, review/rating systems
**Confidence:** HIGH

## Summary

Phase 3 adds two feature areas to the existing club management dashboard: (1) analytics for organizers to understand event and club performance, and (2) a post-event review system for attendees. The project already has extensive infrastructure in place -- `user_interactions` table tracks views/clicks/saves, `event_popularity_scores` stores aggregated metrics, `rsvps` table tracks going/interested/cancelled, `club_followers` tracks follower relationships with timestamps, and `saved_events` tracks saves. The primary new work is building API endpoints to aggregate this existing data for organizer consumption, adding a `reviews` table to Supabase, and building the UI components including charts.

The charting requirement (ANLY-03) needs a new dependency. Recharts is the standard choice for this project: it is React-native, composable, SVG-based, and handles the small dataset sizes typical of campus events with ease. The review system requires a new `reviews` table with constraints (one review per user per event, only after event date), new API endpoints, and UI for both submission (star rating component) and organizer viewing (aggregate display).

**Primary recommendation:** Use Recharts for charts, add a new "Analytics" tab to ClubDashboard, create a `reviews` table with DB-level constraints, and surface review prompts on the event detail page for eligible users.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLY-01 | Event-level analytics: views, clicks, saves, RSVP breakdown | Data already exists in `user_interactions`, `event_popularity_scores`, `rsvps`, `saved_events` tables. Need API aggregation endpoints and UI cards. |
| ANLY-02 | Club-level trends: follower growth, total attendees, popular tags | `club_followers.created_at` enables growth over time. `rsvps` with event join gives attendees. `events.tags` gives tag popularity. Need aggregation API. |
| ANLY-03 | Charts (line/bar) on club management page | Recharts library for React-native charting. New "Analytics" tab in ClubDashboard. |
| REVW-01 | Post-event review prompt for "going" RSVP users (1-5 stars + optional text) | New `reviews` table. Check RSVP status + event date to determine eligibility. Star rating component. |
| REVW-02 | Organizer views aggregate review data: avg rating, distribution, anonymized comments | API endpoint aggregates reviews per event. No user identity exposed to organizer. |
| REVW-03 | One review per event, only after event date | DB unique constraint on (user_id, event_id). API-level date check against event's `start_date`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^2.15 | Charts (line, bar) | React-native composable components, SVG-based, great for small-medium datasets, 23M+ weekly npm downloads |
| Supabase | ^2.49 (existing) | Database queries | Already in use; aggregation via `.select()` with count/group or raw SQL via `.rpc()` |
| SWR | ^2.3.7 (existing) | Client data fetching | Already used throughout for hooks pattern |
| shadcn/ui | (existing) | UI primitives | Already installed: Card, Tabs, Badge, Dialog, Button, Skeleton |
| Lucide React | ^0.344 (existing) | Icons | Star icon for ratings, chart icons for analytics |
| date-fns | ^3.3.1 (existing) | Date manipulation | Already used; needed for "event has ended" checks and date grouping |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | Star rating | Build with Lucide Star icons + Tailwind. Simple enough to not need a library. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js (react-chartjs-2) | Chart.js is canvas-based, better for huge datasets but worse React integration. Recharts is component-based, matches project patterns better. |
| Recharts | Tremor | Tremor provides pre-built dashboard components but adds heavy dependency for just 2-3 charts. |
| Custom star rating | react-rating-stars-component | Overkill for a 5-star rating. 15 lines of Tailwind + Lucide Star handles it. |

**Installation:**
```bash
npm install recharts
```

## Architecture Patterns

### New Files Structure
```
src/
├── app/
│   └── api/
│       ├── clubs/[id]/analytics/
│       │   └── route.ts          # GET club-level analytics (ANLY-02)
│       ├── events/[id]/analytics/
│       │   └── route.ts          # GET event-level analytics (ANLY-01)
│       └── events/[id]/reviews/
│           └── route.ts          # GET (list/aggregate) + POST (submit) reviews
├── components/
│   ├── clubs/
│   │   └── ClubAnalyticsTab.tsx  # New tab in ClubDashboard (ANLY-02, ANLY-03)
│   └── events/
│       ├── EventAnalyticsCard.tsx # Per-event analytics display (ANLY-01, ANLY-03)
│       ├── StarRating.tsx         # Reusable star rating input/display (REVW-01)
│       └── ReviewPrompt.tsx       # Post-event review form (REVW-01)
├── hooks/
│   └── useAnalytics.ts           # SWR hooks for analytics + reviews data
└── types/
    └── index.ts                  # Add Review, EventAnalytics, ClubAnalytics types
```

### Pattern 1: New Tab in Existing Dashboard
**What:** Add "Analytics" tab to ClubDashboard alongside existing Overview/Events/Settings/Members tabs
**When to use:** This is the only pattern -- analytics lives in the club management dashboard
**Example:**
```typescript
// ClubDashboard.tsx -- add new tab
import { ClubAnalyticsTab } from "@/components/clubs/ClubAnalyticsTab";

// In TabsList:
<TabsTrigger value="analytics">Analytics</TabsTrigger>

// In TabsContent:
<TabsContent value="analytics">
  <ClubAnalyticsTab clubId={clubId} />
</TabsContent>
```

### Pattern 2: Aggregation API with Supabase
**What:** API routes that aggregate data from existing tables using Supabase queries
**When to use:** All analytics endpoints follow this pattern
**Example:**
```typescript
// GET /api/events/[id]/analytics
// Aggregate from user_interactions + event_popularity_scores + rsvps + saved_events
const { data: popularity } = await supabase
  .from("event_popularity_scores")
  .select("view_count, click_count, save_count, unique_viewers")
  .eq("event_id", eventId)
  .single();

const { data: rsvps } = await supabase
  .from("rsvps")
  .select("status")
  .eq("event_id", eventId)
  .neq("status", "cancelled");

// Return combined analytics object
```

### Pattern 3: Recharts Composable Components
**What:** Build charts from composable Recharts primitives
**When to use:** ANLY-03 chart rendering
**Example:**
```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Follower growth over time
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={followerData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="count" stroke="#ED1B2F" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

### Pattern 4: Review Eligibility Check
**What:** Server-side validation that user can review (RSVP'd going + event ended + no existing review)
**When to use:** POST /api/events/[id]/reviews and client-side prompt display
**Example:**
```typescript
// Check eligibility before showing review prompt
const now = new Date();
const eventDate = new Date(event.start_date);
const hasEnded = eventDate < now;

// Check if user RSVP'd "going"
const { data: rsvp } = await supabase
  .from("rsvps")
  .select("status")
  .eq("user_id", userId)
  .eq("event_id", eventId)
  .eq("status", "going")
  .maybeSingle();

// Check for existing review
const { data: existingReview } = await supabase
  .from("reviews")
  .select("id")
  .eq("user_id", userId)
  .eq("event_id", eventId)
  .maybeSingle();

const canReview = hasEnded && rsvp && !existingReview;
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Do NOT fetch raw interaction rows to the client and aggregate there. Always aggregate server-side in API routes.
- **Exposing reviewer identity:** REVW-02 specifies "anonymized comments". Never return user_id or user name with review data to organizers.
- **Polling for analytics:** Use SWR with reasonable `refreshInterval` (or none -- analytics are not real-time). Do not use WebSocket or polling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Charts | Custom SVG/Canvas rendering | Recharts | Axes, tooltips, responsive sizing, animations are deceptively complex |
| Date grouping for time series | Manual date bucketing logic | date-fns `eachDayOfInterval`, `eachWeekOfInterval`, `format` | Edge cases around timezones, month boundaries, empty buckets |
| Responsive chart containers | Manual resize listeners | Recharts `ResponsiveContainer` | Handles ResizeObserver, debouncing, SSR edge cases |

**Key insight:** The analytics data already exists in the database. This phase is primarily about aggregation and presentation, not data collection.

## Common Pitfalls

### Pitfall 1: Missing Authorization on Analytics Endpoints
**What goes wrong:** Any user can view any club's analytics
**Why it happens:** Forgetting to verify club membership before returning analytics
**How to avoid:** Every analytics API must verify the requesting user is a member of the club (via `club_members` table). Follow the same pattern used in `/api/clubs/[id]/events`.
**Warning signs:** No auth check in the API route

### Pitfall 2: Empty State for New Events
**What goes wrong:** Charts crash or look broken when event has zero interactions
**Why it happens:** Recharts can handle empty data but shows a blank chart with no helpful message
**How to avoid:** Check if data arrays are empty before rendering charts. Show an EmptyState component (already exists at `src/components/ui/EmptyState.tsx`) when no data.
**Warning signs:** Charts rendering with just axes and no data points

### Pitfall 3: Review Date Validation Only Client-Side
**What goes wrong:** User submits review for future event by manipulating requests
**Why it happens:** Only checking event date in the UI, not in the API
**How to avoid:** Validate event date in the API route AND add a DB check constraint if possible. Double validation (client + server).
**Warning signs:** `created_at` on a review is before the event's `start_date`

### Pitfall 4: N+1 Queries for Event Analytics List
**What goes wrong:** Club analytics tab fetches analytics for each event individually, causing N+1 queries
**Why it happens:** Iterating over events and calling individual analytics endpoints
**How to avoid:** Build a single club-level analytics endpoint that joins events with their metrics in one query.
**Warning signs:** Multiple sequential API calls when loading analytics tab

### Pitfall 5: Recharts SSR Hydration Mismatch
**What goes wrong:** Next.js SSR renders chart differently than client, causing hydration errors
**Why it happens:** Recharts uses browser APIs (DOM measurements) not available during SSR
**How to avoid:** Wrap chart components with `"use client"` directive (already the pattern for club dashboard). Optionally use `dynamic(() => import(...), { ssr: false })` if charts are in a server component page.
**Warning signs:** Hydration mismatch warnings in console

## Code Examples

### New Database Table: reviews
```sql
-- Migration for reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- RLS policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reviews
CREATE POLICY "Users can create own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own reviews
CREATE POLICY "Users can read own reviews" ON reviews
  FOR SELECT USING (auth.uid() = user_id);

-- Club organizers can read reviews for their events (anonymized at API level)
CREATE POLICY "Organizers can read event reviews" ON reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN club_members cm ON cm.club_id = e.club_id
      WHERE e.id = reviews.event_id AND cm.user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_reviews_event_id ON reviews(event_id);
CREATE INDEX idx_reviews_user_event ON reviews(user_id, event_id);
```

### TypeScript Types
```typescript
// Add to src/types/index.ts
export interface Review {
  id: string;
  user_id: string;
  event_id: string;
  rating: number;  // 1-5
  comment: string | null;
  created_at: string;
}

export interface EventAnalytics {
  event_id: string;
  title: string;
  event_date: string;
  views: number;
  clicks: number;
  saves: number;
  unique_viewers: number;
  rsvp_going: number;
  rsvp_interested: number;
  avg_rating: number | null;
  review_count: number;
}

export interface ClubAnalytics {
  follower_growth: { date: string; count: number }[];
  total_attendees: number;
  popular_tags: { tag: string; count: number }[];
  events: EventAnalytics[];
}
```

### Star Rating Component Pattern
```typescript
// Simple interactive star rating with Lucide icons
"use client";
import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export function StarRating({ value, onChange, readonly, size = "md" }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const iconSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <div className="flex gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`${readonly ? "" : "cursor-pointer"} transition-colors`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={`${iconSize} ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
```

### Follower Growth Time Series Query
```typescript
// Aggregate club_followers by date for growth chart
const { data: followers } = await supabase
  .from("club_followers")
  .select("created_at")
  .eq("club_id", clubId)
  .order("created_at", { ascending: true });

// Group by day using date-fns
import { format, eachDayOfInterval, parseISO } from "date-fns";

const days = eachDayOfInterval({ start: parseISO(followers[0].created_at), end: new Date() });
let cumulative = 0;
const growthData = days.map((day) => {
  const dayStr = format(day, "yyyy-MM-dd");
  const newFollowers = followers.filter((f) => format(parseISO(f.created_at), "yyyy-MM-dd") === dayStr).length;
  cumulative += newFollowers;
  return { date: format(day, "MMM d"), count: cumulative };
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js with wrapper | Recharts composable components | 2023+ | Better React integration, no ref management |
| Custom star components | Lucide Star with fill prop | Current | Consistent with project icon set |
| Client-side data aggregation | Server-side aggregation via API | Best practice | Better performance, security |

**Deprecated/outdated:**
- Victory Charts: still maintained but Recharts has much larger community
- react-chartjs-2 v4: works but canvas-based approach is less React-idiomatic

## Open Questions

1. **Follower growth time range**
   - What we know: ANLY-02 says "follower growth over time" but doesn't specify default range
   - What's unclear: Show last 30 days? All time? User-selectable?
   - Recommendation: Default to last 30 days, simple enough to expand later

2. **Review rating UX decision** (noted in STATE.md blockers)
   - What we know: Requirements say "1-5 stars" explicitly (REVW-01)
   - What's unclear: STATE.md flagged "1-5 stars vs alternatives" as needing decision
   - Recommendation: Requirements are explicit -- use 1-5 stars as specified

3. **Where to surface review prompt**
   - What we know: REVW-01 says "users who RSVP'd going are prompted"
   - What's unclear: Prompt on event detail page? Notification? Both?
   - Recommendation: Show on event detail page when user visits after event ends. Simpler than notification-based approach, fits existing UX.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern=<file> --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLY-01 | Event analytics API returns views/clicks/saves/RSVP | unit | `npx jest --testPathPattern=events/analytics --no-coverage` | No -- Wave 0 |
| ANLY-02 | Club analytics API returns follower growth/attendees/tags | unit | `npx jest --testPathPattern=clubs/analytics --no-coverage` | No -- Wave 0 |
| ANLY-03 | Charts render with data | manual-only | Visual verification | N/A (Recharts components) |
| REVW-01 | Review submission with rating + eligibility checks | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | No -- Wave 0 |
| REVW-02 | Aggregate review endpoint returns anonymized data | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | No -- Wave 0 |
| REVW-03 | One review per event constraint + date validation | unit | `npx jest --testPathPattern=events/reviews --no-coverage` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=<changed_file> --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/api/events/analytics.test.ts` -- covers ANLY-01
- [ ] `src/__tests__/api/clubs/analytics.test.ts` -- covers ANLY-02
- [ ] `src/__tests__/api/events/reviews.test.ts` -- covers REVW-01, REVW-02, REVW-03

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: `src/lib/supabase/types.ts` -- confirmed existing tables: `user_interactions`, `event_popularity_scores`, `rsvps`, `saved_events`, `club_followers`
- Project codebase analysis: `src/app/api/interactions/route.ts` -- confirmed interaction tracking is already live
- Project codebase analysis: `src/components/clubs/ClubDashboard.tsx` -- confirmed tab-based dashboard structure
- Project skills: `ui-ux-pro-max` chart domain search -- confirmed Bar Chart and Line Chart recommendations

### Secondary (MEDIUM confidence)
- [Recharts vs Chart.js comparison](https://stackshare.io/stackups/js-chart-vs-recharts) -- Recharts better React integration, Chart.js better for large datasets
- [Best React chart libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) -- Recharts recommended for simple dashboards
- [Top React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) -- Recharts noted for composability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Recharts is well-established, all other libraries already in project
- Architecture: HIGH - Extending existing dashboard pattern with new tab, following established API patterns
- Pitfalls: HIGH - Based on direct codebase analysis and common Next.js/Supabase patterns
- Database schema: HIGH - `reviews` table design follows existing project conventions (UUID PKs, RLS, timestamps)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, no fast-moving dependencies)
