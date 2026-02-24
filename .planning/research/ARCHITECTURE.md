# Architecture Patterns: Cold Start Fix & Notification System

**Domain:** Recommendation cold start fallback + in-app notification system
**Researched:** 2026-02-23
**Overall confidence:** HIGH — based primarily on direct codebase inspection plus verified community patterns

---

## Recommended Architecture

This milestone adds two largely independent subsystems to the existing Next.js App Router + Supabase app. They share the database layer but are otherwise decoupled and can be built in parallel after the database table is created.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (Client Components)                                         │
│                                                                     │
│  Header.tsx                                                         │
│   └── NotificationBell.tsx ──── polls /api/notifications (60s)     │
│                                                                     │
│  /notifications page.tsx                                           │
│   ├── NotificationList.tsx                                          │
│   └── NotificationItem.tsx ── PATCH /api/notifications/[id]        │
│                                                                     │
│  Home page.tsx                                                      │
│   ├── canShowRecommendations = savedEventIds.size >= 3             │
│   ├── [gate passes] RecommendedEventsSection → /api/recommendations │
│   └── [gate fails]  PopularEventsSection → /api/events/popular     │
└───────────────────────┬────────────────────────┬────────────────────┘
                        │ fetch                  │ fetch
┌───────────────────────▼────────────────────────▼────────────────────┐
│ Next.js API Layer (Route Handlers — server-side)                    │
│                                                                     │
│  GET  /api/notifications        → Supabase: SELECT notifications    │
│  PATCH /api/notifications/[id]  → Supabase: UPDATE read=true        │
│  POST  /api/notifications?action=mark-all-read → bulk UPDATE        │
│                                                                     │
│  GET  /api/recommendations      → K-means engine OR popularity FB  │
│  GET  /api/events/popular       → event_popularity_scores JOIN      │
│                                                                     │
│  POST /api/cron/send-reminders  → bulk INSERT notifications         │
│  PATCH /api/admin/events/[id]/status → INSERT approval notification │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ Supabase SDK
┌───────────────────────▼─────────────────────────────────────────────┐
│ Supabase (PostgreSQL + Auth)                                        │
│                                                                     │
│  notifications table (user_id, type, title, message, event_id,     │
│                        read, created_at)                            │
│  saved_events table  (user_id, event_id) — drives threshold check  │
│  event_popularity_scores table — drives fallback feed               │
└─────────────────────────────────────────────────────────────────────┘
                        ▲
                        │ HTTP POST (CRON_SECRET bearer token)
┌───────────────────────┴─────────────────────────────────────────────┐
│ Supabase pg_cron (scheduled) OR external cron caller                │
│  Schedule: every hour → POST /api/cron/send-reminders               │
│  Auth: Authorization: Bearer $CRON_SECRET header                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Actual State of Implementation (Codebase Audit)

**Confidence:** HIGH — direct code inspection.

### Already Exists (Do Not Rebuild)

| Component | File | Status |
|-----------|------|--------|
| `NotificationBell` | `src/components/notifications/NotificationBell.tsx` | Complete — polls 60s, badge, link to /notifications |
| `NotificationItem` | `src/components/notifications/NotificationItem.tsx` | Complete — 4 types with color/icon config |
| `NotificationList` | `src/components/notifications/NotificationList.tsx` | Complete — empty state, maps NotificationItem |
| `/notifications` page | `src/app/notifications/page.tsx` | Complete — auth guard, skeleton, mark-all-read |
| `GET /api/notifications` | `src/app/api/notifications/route.ts` | Complete — returns notifications + unread_count |
| `POST /api/notifications?action=mark-all-read` | same file | Complete |
| `PATCH /api/notifications/[id]` | `src/app/api/notifications/[id]/route.ts` | Exists as file (content not read — verify it marks read) |
| Cron reminder endpoint | `src/app/api/cron/send-reminders/route.ts` | Complete — 24h/1h windows, dedup check, CRON_SECRET auth |
| Admin approval notification | `src/app/api/admin/events/[id]/status/route.ts` | Complete — inserts event_approved/event_rejected |
| Cold start gate (page.tsx) | `src/app/page.tsx` line 128 | Complete — `savedEventIds.size >= 3` |
| `RecommendedEventsSection` | `src/components/events/RecommendedEventsSection.tsx` | Complete — calls /api/recommendations, calls onEmpty on failure |
| `PopularEventsSection` | `src/components/events/PopularEventsSection.tsx` | Complete — calls /api/events/popular |
| `GET /api/events/popular` | `src/app/api/events/popular/route.ts` | Complete — sorts by popularity_score or trending_score |
| NotificationBell injected in Header | `src/components/layout/Header.tsx` line 122 | Complete |

### Gaps to Investigate Before Building

Based on the codebase audit, the primary remaining work is likely:

| Area | Gap | Location to Check |
|------|-----|-------------------|
| `notifications` DB table | May not exist in Supabase yet — code references it but table creation via MCP not confirmed | Supabase dashboard / types.ts |
| Cron scheduling | `POST /api/cron/send-reminders` exists but needs a caller (pg_cron job or external scheduler) | No pg_cron config found in codebase |
| Notification type naming mismatch | Cron inserts `reminder_24h` / `reminder_1h` but PROJECT.md specifies `event_reminder_24h` / `event_reminder_1h` | `src/app/api/cron/send-reminders/route.ts` lines 44, 74 vs NotificationItem.tsx lines 19-27 |
| `GET /api/events/popular` popularity boost | PROJECT.md specifies scoring: >10 saves → +2, recency within 7 days → +1. Current endpoint queries pre-computed scores | `src/app/api/events/popular/route.ts` — verify scoring matches spec |
| Recommendation API threshold enforcement | API itself does not enforce the 3-save threshold — the gate is client-side only in page.tsx | `src/app/api/recommendations/route.ts` — API returns results for any authenticated user |

---

## Component Boundaries

### Notification System

| Component | Responsibility | Inputs | Outputs / Side Effects |
|-----------|---------------|--------|----------------------|
| `NotificationBell` (client) | Display unread count badge; link to /notifications page | Polls `GET /api/notifications` every 60s | Renders badge with count |
| `/notifications page.tsx` (client) | Full notification history, mark-read interactions | `GET /api/notifications` on mount | User-initiated `PATCH /[id]` and `POST ?action=mark-all-read` |
| `NotificationList` (client) | Render ordered list of notifications | `Notification[]` prop, `onMarkRead` callback | Delegates to `NotificationItem` |
| `NotificationItem` (client) | Render single notification with type-specific icon/color | `Notification` object, `onMarkRead` callback | Click → calls `onMarkRead(id)` |
| `GET /api/notifications` (server) | Fetch user's notifications + unread count | Supabase auth session | `{ notifications[], unread_count }` |
| `PATCH /api/notifications/[id]` (server) | Mark single notification read | Path param `id`, auth session | `{ success: true }` |
| `POST /api/notifications?mark-all-read` (server) | Bulk mark-read | Auth session | `{ success: true }` |
| `POST /api/cron/send-reminders` (server) | Generate 24h and 1h reminders for saved events | `CRON_SECRET` bearer auth | Inserts rows into `notifications` table |
| `PATCH /api/admin/events/[id]/status` (server) | Approve/reject event, then notify creator | Admin role, event id, status | Updates `events.status`, inserts notification |
| `notifications` table (Supabase) | Persist notification records | Server-side inserts (cron, admin action) | SELECT via API, RLS: user_id = auth.uid() |

### Cold Start / Recommendation System

| Component | Responsibility | Inputs | Outputs |
|-----------|---------------|--------|---------|
| `page.tsx` gate logic | Decide which feed section to show | `savedEventIds.size` (from `useSavedEvents` hook) | Renders `RecommendedEventsSection` or `PopularEventsSection` |
| `RecommendedEventsSection` (client) | Fetch personalized events; emit `onEmpty` if API returns 0 results | Mount effect | Calls `GET /api/recommendations` |
| `PopularEventsSection` (client) | Fetch popularity-sorted events | Mount effect | Calls `GET /api/events/popular?sort=popularity&limit=3` |
| `GET /api/recommendations` (server) | K-means hybrid engine; tag-based fallback if no scored candidates | Auth session, `interest_tags`, `saved_events` | `{ recommendations: Event[] }` |
| `GET /api/events/popular` (server) | Return events sorted by pre-computed popularity/trending score | Query params: sort, limit, offset, min_score | `{ events: Event[], total, sort }` |
| `event_popularity_scores` table | Denormalized popularity data for efficient sorting | Written by `/api/admin/calculate-popularity` | Read by `/api/events/popular` |
| `saved_events` table | Count used for cold start threshold check | Written by save/unsave actions | Read by `useSavedEvents()` hook |

---

## Data Flow

### Notification Creation Flow (Two Sources)

**Source 1: Admin Approve/Reject**

```
Admin clicks approve/reject in admin dashboard
  → PATCH /api/admin/events/[id]/status
  → verifyAdmin() checks role
  → UPDATE events.status
  → createServiceClient().from("notifications").insert({
      user_id: event.created_by,
      type: "event_approved" | "event_rejected",
      title: ..., message: ..., event_id: id
    })
  → Returns { success: true }
```

**Source 2: Scheduled Reminders**

```
pg_cron (hourly) or external scheduler
  → POST /api/cron/send-reminders
  → Validates Authorization: Bearer $CRON_SECRET
  → Queries saved_events JOIN events WHERE start_date in [now+23h, now+25h]
  → For each saved event: check dedup (notifications WHERE type=reminder_24h AND event_id=X)
  → Insert { user_id, type: "reminder_24h", title, message, event_id }
  → Repeat for 1h window [now+55min, now+65min]
  → Returns { success, reminders_sent: { "24h": N, "1h": N } }
```

### Notification Read Flow

```
User opens /notifications
  → NotificationsPage mounts → fetchNotifications()
  → GET /api/notifications
  → supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", desc).limit(50)
  → supabase.from("notifications").select("*", count).eq("user_id", uid).eq("read", false)
  → Returns { notifications[], unread_count }
  → User clicks unread notification → optimistic update → PATCH /api/notifications/[id]
  → supabase.from("notifications").update({ read: true }).eq("id", id)
```

### NotificationBell Poll Flow

```
NotificationBell mounts in Header (authenticated users only)
  → fetchCount() immediately on mount
  → GET /api/notifications → extract unread_count
  → setInterval(fetchCount, 60000) — poll every 60 seconds
  → Updates badge in Header
```

### Cold Start Gate Flow

```
User loads / (home page)
  → useSavedEvents(!!user) → GET /api/users/saved-events
  → savedEventIds: Set<string>

  if savedEventIds.size < 3:
    → render <PopularEventsSection>
    → GET /api/events/popular?sort=popularity&limit=3
    → Joins event_popularity_scores, sorts by popularity_score DESC
    → Shows "Popular This Week" with rank badges

  if savedEventIds.size >= 3:
    → render <RecommendedEventsSection>
    → GET /api/recommendations
    → K-means clustering + content scoring + popularity weighting
    → if recommendations.length === 0: calls onEmpty() → falls back to <PopularEventsSection>
    → Shows "Recommended For You" horizontal scroll
```

### Popularity Score Flow (Existing, Referenced by Cold Start Fallback)

```
Admin triggers /api/admin/calculate-popularity (manual or scheduled)
  → Aggregates user_interactions (views, clicks, saves, shares)
  → Calculates popularity_score and trending_score per event
  → Upserts into event_popularity_scores table
  → Used by /api/events/popular in the cold start fallback feed
```

---

## Patterns to Follow

### Pattern 1: Server Client for Writes, Standard Client for User-Scoped Reads

**What:** Use `createServiceClient()` (bypasses RLS) for notification creation from admin actions and cron jobs. Use `createClient()` (respects RLS) for user-fetching their own notifications.

**When:** Any server-side write that is not user-initiated (admin action, scheduled job).

**Example:**
```typescript
// Admin status route — service client bypasses RLS for cross-user write
const serviceClient = createServiceClient();
await serviceClient.from("notifications").insert({
  user_id: event.created_by, // different user than admin
  type: "event_approved",
  ...
});

// User reads their own notifications — standard server client, RLS enforced
const supabase = await createClient();
const { data } = await supabase
  .from("notifications")
  .select("*")
  .eq("user_id", user.id); // RLS policy also enforces this
```

### Pattern 2: Optimistic Updates with Revert on Failure

**What:** For mark-read interactions, update client state immediately then confirm server-side. Revert by re-fetching if server errors.

**When:** Low-stakes user interactions where latency would degrade UX.

**Example:**
```typescript
// In notifications/page.tsx
const handleMarkRead = async (id: string) => {
  // Optimistic update first
  setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  setUnreadCount(prev => Math.max(0, prev - 1));

  try {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  } catch {
    fetchNotifications(); // revert by re-fetching
  }
};
```

### Pattern 3: Client-Side Gate, API-Side Graceful Degradation

**What:** The 3-save threshold is enforced client-side in `page.tsx`. The recommendations API does not enforce the gate — it returns tag-based fallback results for users with no save history. The `onEmpty` callback on `RecommendedEventsSection` handles the case where the API returns 0 results.

**When:** Two-layered resilience: the gate prevents unnecessary API calls, and the API's own fallback catches edge cases.

**Example:**
```typescript
// page.tsx — client gate
const canShowRecommendations = savedEventIds.size >= 3;

// RecommendedEventsSection — API fallback
if (fetchedEvents.length === 0) {
  onEmpty?.(); // triggers PopularEventsSection to show instead
  return;
}
```

### Pattern 4: CRON_SECRET Bearer Auth for Internal Cron Endpoints

**What:** Protect the cron endpoint from public access using a shared secret in `Authorization: Bearer $CRON_SECRET` header.

**When:** Any Next.js API route intended to be called only by a scheduler, not users.

**Example:**
```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... proceed with cron work
}
```

### Pattern 5: Deduplication Check Before Notification Insert

**What:** Before inserting a reminder notification, query whether an identical notification already exists. Prevents duplicate reminders if the cron runs more than once in the same window.

**When:** Any scheduled job that might run near its window boundary or be retried.

**Example:**
```typescript
const { count } = await supabase
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("user_id", row.user_id)
  .eq("event_id", event.id)
  .eq("type", "reminder_24h");

if (count && count > 0) continue; // skip — already sent
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Real-Time WebSocket Subscription for Notification Bell

**What:** Using Supabase Realtime `channel().on("postgres_changes")` to push new notifications instantly to the bell.

**Why bad:** WebSocket connections per user add infrastructure load. For a beta with low concurrent users, polling every 60 seconds provides acceptable freshness with zero additional infrastructure. The existing implementation already uses polling — do not replace it.

**Instead:** Keep the 60-second polling interval. If real-time delivery becomes a product requirement post-beta, add Supabase Realtime as an enhancement then.

### Anti-Pattern 2: Enforcing the 3-Save Gate in the API Route

**What:** Adding `savedEventIds.size >= 3` check to `GET /api/recommendations` and returning 403 or empty when threshold not met.

**Why bad:** The client-side gate already prevents the request from being made. Adding it to the API creates a confusing double-gate and could break `RecommendedEventsSection` in edge cases where the client-side count is stale.

**Instead:** Let the API's existing tag-based fallback handle users below threshold. The client-side gate does the real gating work. The API gracefully returns content (tag-matched events) regardless.

### Anti-Pattern 3: Notification Creation in a Postgres Trigger Instead of Application Code

**What:** Using a Supabase database trigger on `events.status` to automatically insert notifications.

**Why bad:** Harder to debug, not visible in application code, harder to test, and the existing admin status route already creates notifications in application code. Database triggers are appropriate for simple data integrity but add complexity here.

**Instead:** Notification creation stays in `src/app/api/admin/events/[id]/status/route.ts` where it already lives and is isolated with a try/catch that does not break the primary status update on notification failure.

### Anti-Pattern 4: Pagination for Notifications API

**What:** Adding cursor-based pagination to `GET /api/notifications` to match the events API pattern.

**Why bad:** The existing implementation fetches the 50 most recent notifications with `.limit(50)` — appropriate for the notification history page. Cursor pagination adds complexity for no user benefit at beta scale.

**Instead:** Keep `.limit(50).order("created_at", { ascending: false })`. If the notification volume grows, revisit.

### Anti-Pattern 5: Type Naming Inconsistency Between Cron and Component

**What:** The cron route inserts `type: "reminder_24h"` and `type: "reminder_1h"`, but `NotificationItem.tsx` and PROJECT.md specify `event_reminder_24h` and `event_reminder_1h`.

**Why bad:** Notifications inserted by cron will not match the `typeConfig` in NotificationItem — they will fall back to the generic Bell icon and `text-muted-foreground` color, losing the blue/orange distinction.

**Instead:** Align type names across all sources. Either update the cron to insert `event_reminder_24h` / `event_reminder_1h`, or update NotificationItem's typeConfig to match `reminder_24h` / `reminder_1h`. Pick one and apply consistently.

---

## Component Boundary Summary

```
Notification System:
  DB (notifications table)
    ← inserts from:
        /api/admin/events/[id]/status (admin action, service client)
        /api/cron/send-reminders (scheduled, service client)
    → reads from:
        /api/notifications (user-scoped, standard client, RLS)
        /api/notifications/[id] (PATCH — mark read)
  Components:
    Header.tsx
      └── NotificationBell.tsx (polls /api/notifications)
    /notifications page
      ├── NotificationList.tsx
      └── NotificationItem.tsx

Cold Start System:
  DB (saved_events, event_popularity_scores)
    → read from:
        useSavedEvents() hook → gate logic in page.tsx
        /api/recommendations → K-means engine
        /api/events/popular → fallback feed
  Components:
    page.tsx (gate logic)
      ├── RecommendedEventsSection.tsx → /api/recommendations
      └── PopularEventsSection.tsx → /api/events/popular
```

---

## Suggested Build Order

Dependencies flow from database to API to components. Both systems share the database step.

```
Step 1: Database (PREREQUISITE for both systems)
  - Create notifications table in Supabase via MCP tooling
  - Schema: id (uuid), user_id (uuid FK auth.users), type (text),
            title (text), message (text), event_id (uuid FK events nullable),
            read (bool default false), created_at (timestamptz default now())
  - Enable RLS: SELECT/UPDATE policy: auth.uid() = user_id
  - Index: user_id (for fetch), (user_id, read) composite (for unread_count)
  - Resolve type name inconsistency: decide event_reminder_24h vs reminder_24h
  - Add notification to src/lib/supabase/types.ts (regenerate or add manually)

Step 2: Fix Notification Type Names (PREREQUISITE for cron and components to match)
  - Align src/app/api/cron/send-reminders/route.ts type strings
    with src/components/notifications/NotificationItem.tsx typeConfig keys
  - Update src/types/index.ts if Notification interface defined there

Step 3: Cold Start Gate Verification (independent of notifications)
  - Verify page.tsx gate: savedEventIds.size >= 3 (ALREADY DONE)
  - Verify PopularEventsSection shows when gate fails (ALREADY DONE)
  - Verify /api/events/popular scoring matches PROJECT.md spec
    (>10 saves → +2 boost, recency within 7 days → +1 boost)
  - If popularity_scores don't apply the boosts at query time, the scoring
    is in calculate-popularity — verify it matches spec or update it

Step 4: Validate API Routes (verify existing code works end-to-end)
  - Test GET /api/notifications with authenticated user
  - Test PATCH /api/notifications/[id]
  - Test POST /api/notifications?action=mark-all-read
  - Test POST /api/cron/send-reminders with CRON_SECRET

Step 5: Schedule Cron
  - Configure pg_cron in Supabase to POST to /api/cron/send-reminders hourly
  - Store CRON_SECRET in Supabase Vault
  - Pattern: net.http_post(url, headers, body) from pg_cron via pg_net extension
  - Alternative: External cron caller (GitHub Actions, Vercel Cron) if pg_cron auth is complex
    (Note: pg_cron → Edge Function auth gap documented in Supabase GitHub issue #4287)

Step 6: End-to-End Verification
  - Create test event starting in ~24h, save it, trigger cron manually
  - Verify notification appears in NotificationBell badge
  - Verify notification displays with correct icon/color in /notifications page
  - Verify mark-read works (badge decrements)
  - Verify new user (0 saves) sees PopularEventsSection
  - Verify user with 3+ saves sees RecommendedEventsSection
```

---

## Scalability Considerations

| Concern | At 100 users (beta) | At 10K users | At 1M users |
|---------|---------------------|--------------|-------------|
| Notification polling (60s interval) | No issue — trivial load | Consider increasing interval to 120s or adding Realtime | Replace polling with Supabase Realtime or a dedicated notification service |
| Cron reminder query (saved_events JOIN events) | Runs in milliseconds | Add index on saved_events.user_id and events.start_date | Partition by date, pre-compute reminder queues |
| GET /api/notifications limit(50) | Fine for any user | Fine — per-user query with RLS index | Add cursor pagination if users accumulate >50 notifications |
| K-means recommendations (processes ALL events) | Acceptable (few events) | Becomes slow (documented in CONCERNS.md) | Pre-compute and cache cluster results with TTL |
| Notification dedup check (per row in cron) | Fine — N small queries | Batch dedup with IN clause | Pre-compute which users/events already have reminders |

---

## Sources

- Direct codebase inspection — HIGH confidence (primary source)
  - `src/app/api/notifications/route.ts`
  - `src/app/api/notifications/[id]/route.ts`
  - `src/app/api/cron/send-reminders/route.ts`
  - `src/app/api/admin/events/[id]/status/route.ts`
  - `src/app/api/events/popular/route.ts`
  - `src/app/api/recommendations/route.ts`
  - `src/app/page.tsx`
  - `src/components/notifications/NotificationBell.tsx`
  - `src/components/notifications/NotificationItem.tsx`
  - `src/components/notifications/NotificationList.tsx`
  - `src/app/notifications/page.tsx`
  - `src/components/events/RecommendedEventsSection.tsx`
  - `src/components/events/PopularEventsSection.tsx`
  - `.planning/codebase/ARCHITECTURE.md`
  - `.planning/PROJECT.md`
- [Building a Real-time Notification System with Supabase and Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — MEDIUM confidence (confirms patterns used)
- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions) — HIGH confidence (official)
- [Supabase Cron | Supabase Docs](https://supabase.com/docs/guides/cron) — HIGH confidence (official)
- [pg_cron → Edge Function auth gap](https://github.com/supabase/cli/issues/4287) — HIGH confidence (known documented gap)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence (official)
- [Cold Start Problem fallback patterns](https://web.tapereal.com/blog/6-strategies-to-solve-cold-start-problem-in-recommender-systems/) — MEDIUM confidence (confirms popularity-as-fallback is standard)

---

*Architecture research: 2026-02-23*
