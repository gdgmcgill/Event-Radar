# Technology Stack

**Project:** Uni-Verse — Cold Start Fix & Notification System (Milestone)
**Researched:** 2026-02-23
**Scope:** Additive — only technologies NEW to the project. Existing stack (Next.js 16, Supabase, shadcn/ui, Zustand, SWR, date-fns) is already locked in.

---

## What This Milestone Adds

Two distinct capabilities need new patterns, not new npm packages:

1. **Cold Start Recommendation Fallback** — SQL scoring logic inside existing Postgres/Supabase
2. **In-App Notification System** — database table + API routes + cron Edge Function + React components

Neither requires adding major new dependencies. The work is configuration, SQL, and new API/component patterns built on the existing stack.

---

## Cold Start Fallback: No New Libraries Required

### Recommended Approach: Pure SQL Scoring in Supabase

**Confidence: HIGH** — Verified against existing codebase patterns and Supabase Postgres capabilities.

The project already has:
- `event_popularity` table with save counts and view counts
- `user_interactions` table for save tracking
- K-means recommendation API at `src/app/api/recommendations/route.ts`

The cold start fix is a **SQL query change in the recommendations API route**, not a new library. The scoring formula defined in PROJECT.md maps cleanly to a Postgres expression:

```sql
-- Cold start popularity score query
SELECT
  e.*,
  (
    COALESCE(ep.save_count, 0) / NULLIF(COALESCE(ep.save_count, 0) + 10, 0) * 2
    -- Simplified: > 10 saves → approaches +2 boost
    + CASE WHEN e.start_time > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END
    -- Recency boost: within 7 days → +1
  ) AS cold_start_score
FROM events e
LEFT JOIN event_popularity ep ON ep.event_id = e.id
WHERE e.status = 'approved'
  AND e.start_time > NOW()
ORDER BY cold_start_score DESC, e.start_time ASC
LIMIT 20;
```

This runs as a Supabase RPC call or a `.from('events').select(...)` with a computed column — no external library needed.

**Why not a recommendation library?**
- Libraries like `ml-matrix` or `brain.js` are for training models, not scoring queries
- Existing K-means cluster logic already handles personalized recommendations
- The cold start path is a simple fallback — adding a library for integer addition and date comparison would be pure overhead

**Why not a caching layer (Redis/Upstash)?**
- Popularity scores are cheap Postgres reads against an indexed table
- Adding Upstash or Redis for a campus app with <1000 concurrent users is premature optimization
- SWR client-side caching + Next.js route-level caching handles the load

**Threshold gate:** The `canShowRecommendations` logic lives in `src/app/page.tsx`. Change the condition to `savedEventIds.size >= 3` (not a library — a one-line fix). The recommendations API needs a corresponding `savedCount < 3` branch that calls the popularity query instead of the K-means path.

---

## Notification System Stack

### 1. Database Layer: Supabase Postgres (existing)

**Confidence: HIGH**

New `notifications` table — created via Supabase MCP tooling per project constraints. Schema:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK to `auth.users`, NOT NULL |
| `type` | `text` | Enum: `event_reminder_24h`, `event_reminder_1h`, `event_approved`, `event_rejected` |
| `title` | `text` | Display title |
| `message` | `text` | Notification body |
| `event_id` | `uuid` | FK to `events`, nullable (not all notifications relate to an event) |
| `is_read` | `boolean` | Default `false` |
| `created_at` | `timestamptz` | Default `now()` |

RLS policies required:
- `SELECT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id` (for marking read)
- No `INSERT` policy for users — insertions happen via service role only (admin approvals, Edge Function cron)

### 2. Cron Scheduling: Supabase pg_cron + pg_net (existing Supabase extensions)

**Confidence: HIGH** — Verified via [Supabase official docs](https://supabase.com/docs/guides/cron) and [Scheduling Edge Functions docs](https://supabase.com/docs/guides/functions/schedule-functions).

**No new npm package.** Supabase projects have `pg_cron` and `pg_net` available as Postgres extensions. The cron job is created via SQL in the Supabase Dashboard:

```sql
-- Enable extensions (if not already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the reminder Edge Function every hour
select cron.schedule(
  'event-reminders-hourly',
  '0 * * * *',  -- top of every hour
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Why Supabase Cron over Vercel Cron?**
- Project constraint: `CRON_SECRET` env var exists but PROJECT.md explicitly states "Supabase Edge Function for reminders (not Vercel Cron)"
- Keeps scheduled work inside Supabase ecosystem — the Edge Function has direct Supabase DB access without network hops
- Supabase Cron module has a dashboard UI for monitoring job history (released 2024, stable in 2025)

**Why not a job queue (BullMQ, Inngest)?**
- Reminder notifications are lightweight, low-volume (campus event app)
- BullMQ requires Redis; Inngest requires a separate service — unnecessary for hourly batch inserts
- pg_cron runs inside Postgres — zero new infrastructure

### 3. Edge Function Runtime: Deno (Supabase standard)

**Confidence: HIGH** — Supabase Edge Functions exclusively use Deno. No choice needed.

**Version:** Supabase runs Deno 2.1+ as of late 2024 ([blog announcement](https://supabase.com/blog/supabase-edge-functions-deploy-dashboard-deno-2-1)). Write functions with standard Deno 2 import syntax.

**Deployment:**
```bash
supabase functions deploy send-event-reminders
```

**Function structure:** `supabase/functions/send-event-reminders/index.ts`

The function:
1. Queries `saved_events` JOIN `events` WHERE `start_time` is within 25 hours (24h window) or 65 minutes (1h window) AND no existing notification exists for that event+user+type
2. Batch inserts into `notifications` using the service role client
3. Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables (automatically available inside Supabase Edge Functions)

```typescript
// supabase/functions/send-event-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  // ... query and insert logic
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Why import via `esm.sh`?** Deno doesn't use npm. `https://esm.sh/@supabase/supabase-js@2` is the standard import path for Supabase in Edge Functions. Do not use `npm:@supabase/supabase-js` — it works in Deno 2 but `esm.sh` is the documented pattern for Supabase Edge Functions.

### 4. Notification API Routes: Next.js Route Handlers (existing pattern)

**Confidence: HIGH**

No new libraries. Three route handlers following the existing `src/app/api/` pattern:

| Route | Method | Purpose |
|-------|--------|---------|
| `src/app/api/notifications/route.ts` | `GET` | Paginated list for `/notifications` page |
| `src/app/api/notifications/[id]/route.ts` | `PATCH` | Mark single notification as read |
| `src/app/api/notifications/route.ts` | `POST` | Mark all as read (action query param) |

**Client pattern:** Use `createClient()` from `@/lib/supabase/server` (already exists). For insertions from admin actions, use the service role client pattern already established in the codebase.

**Why not Supabase Realtime for the notification bell?**

MEDIUM confidence recommendation: **Use SWR polling, not Supabase Realtime, for beta.**

Rationale from community patterns (makerkit.dev) and Supabase docs:
- Most notification reads happen on page load — Realtime's persistent WebSocket connection is wasted for notifications checked every few minutes
- Realtime requires enabling the `supabase_realtime` publication on the `notifications` table, which adds operational surface area
- Realtime + RLS has known friction (GitHub issues #265, #26980) — polling avoids this class of bug entirely
- SWR `refreshInterval` achieves "good enough" freshness (30s polling) with zero complexity overhead

```typescript
// NotificationBell — polling pattern
const { data } = useSWR('/api/notifications?limit=5&unread_only=true', fetcher, {
  refreshInterval: 30_000,         // poll every 30s
  revalidateOnFocus: true,         // re-fetch when user returns to tab
  revalidateOnReconnect: true,
})
const unreadCount = data?.total_unread ?? 0
```

If real-time delivery becomes a requirement post-beta, add Supabase Realtime then — it's a one-line channel subscription addition to the existing component. Do not add it now.

### 5. Notification UI Components: shadcn/ui (existing)

**Confidence: HIGH**

Use existing shadcn/ui primitives — no new component library needed:

| Component | shadcn primitive used | Notes |
|-----------|-----------------------|-------|
| `NotificationBell` | `Button` (ghost, icon variant) + `Badge` | Bell icon from Lucide React (`Bell`), badge overlaid with absolute position |
| Notification dropdown | `DropdownMenu` | Already in project (`@radix-ui/react-dropdown-menu ^2.1.16`) |
| `/notifications` page list | `Card`, `Badge` | Existing primitives |

**Badge positioning pattern (from shadcn.io patterns):**
```tsx
<div className="relative">
  <Button variant="ghost" size="icon">
    <Bell className="h-5 w-5" />
  </Button>
  {unreadCount > 0 && (
    <Badge
      variant="destructive"
      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  )}
</div>
```

**Notification type color mapping** (from PROJECT.md spec):
```typescript
const TYPE_STYLES = {
  event_reminder_24h: 'bg-blue-50 border-blue-200 text-blue-800',
  event_reminder_1h:  'bg-orange-50 border-orange-200 text-orange-800',
  event_approved:     'bg-green-50 border-green-200 text-green-800',
  event_rejected:     'bg-red-50 border-red-200 text-red-800',
} as const
```

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| `node-cron` / `cron` npm package | Vercel serverless = no persistent Node process. Use Supabase pg_cron instead. |
| `bull` / `bullmq` | Requires Redis. Overkill for hourly notification batch on a campus app. |
| `firebase-admin` / `web-push` | PROJECT.md explicitly defers push/email notifications. In-app only for beta. |
| `novu` / `engagespot` / `knock` | SaaS notification platforms. Adds cost, external dependency, and data egress for a feature that's 3 API routes and a table. |
| `@supabase/realtime-js` (standalone) | Already bundled in `@supabase/supabase-js`. Do not add separately. |
| `react-query` / `tanstack-query` | SWR is already in the project (`swr 2.3.7`). Don't introduce a competing data-fetching library. |
| `upstash/redis` | No caching layer needed at campus-app scale for popularity queries. |

---

## Installation

No new npm packages required. All capabilities come from:
- Existing `@supabase/supabase-js` (notifications DB queries)
- Existing `swr` (polling)
- Existing `@radix-ui/react-dropdown-menu` (notification dropdown)
- Existing Lucide React (Bell icon)
- Supabase pg_cron + pg_net (enabled via SQL in Supabase Dashboard, not npm)
- Supabase Edge Functions (deployed via `supabase functions deploy`, not npm)

```bash
# No npm install needed for this milestone
# Supabase CLI (if not already installed globally):
npm install -g supabase
```

---

## Confidence Assessment

| Decision | Confidence | Source |
|----------|------------|--------|
| Pure SQL for cold start scoring | HIGH | Supabase Postgres docs, existing codebase patterns |
| pg_cron + pg_net for cron | HIGH | [Supabase official docs](https://supabase.com/docs/guides/cron), [schedule-functions docs](https://supabase.com/docs/guides/functions/schedule-functions) |
| Deno + esm.sh import for Edge Function | HIGH | [Edge Functions docs](https://supabase.com/docs/guides/functions), Deno 2.1 blog post |
| Vault for cron auth secrets | HIGH | [Securing Edge Functions docs](https://supabase.com/docs/guides/functions/auth), community pattern |
| SWR polling over Supabase Realtime | MEDIUM | makerkit.dev tutorial, Supabase Realtime docs; real-world preference, not official guidance |
| shadcn/ui Badge overlay pattern | HIGH | [shadcn.io patterns](https://www.shadcn.io/patterns/button-group-badges-1), existing shadcn in project |
| Service role for notification inserts | HIGH | [Supabase service role docs](https://github.com/orgs/supabase/discussions/30739), existing codebase pattern |

---

## Sources

- [Supabase Cron Docs](https://supabase.com/docs/guides/cron) — pg_cron scheduling guide
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net pattern
- [Supabase Edge Functions Deno 2.1 Blog](https://supabase.com/blog/supabase-edge-functions-deploy-dashboard-deno-2-1) — current Deno runtime version
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — postgres_changes pattern
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth) — auth header / Vault pattern
- [makerkit.dev: Real-time Notifications with Supabase + Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — polling vs realtime analysis, notification schema
- [shadcn.io Notification Button Pattern](https://www.shadcn.io/patterns/button-group-badges-1) — Bell + Badge overlay
- [SWR Documentation](https://swr.vercel.app/) — refreshInterval polling API
- [pg_net Docs](https://supabase.com/docs/guides/database/extensions/pg_net) — HTTP from Postgres
- [Supabase Realtime: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API
