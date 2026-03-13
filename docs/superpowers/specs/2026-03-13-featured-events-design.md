# Featured Events System — Design Spec

## Problem

The homepage hero currently displays the most popular event labeled as "Featured Experience," but there is no actual featured/promoted events concept. The platform needs a way for the admin to promote paid sponsor events in the hero slot, with a clean fallback when no promotions are active.

## Decision Log

- Hero carousel at the top (not a separate row) — low volume initially, hero is prime real estate
- Branded Uni-Verse fallback when no featured events exist — intentional, not "we picked whatever"
- Auto-rotating carousel when multiple featured events overlap — fair visibility for sponsors
- Admin-controlled via moderation panel + dedicated management page
- Separate `featured_events` table (not a flag on `events`) — cleaner separation, supports sponsor metadata

## Data Layer

### New Table: `featured_events`

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | Row ID |
| `event_id` | uuid | FK → `events.id`, NOT NULL | The promoted event |
| `sponsor_name` | text | nullable | Who is paying for the promotion |
| `priority` | integer | NOT NULL, default 0 | Higher = appears first in carousel |
| `starts_at` | timestamptz | NOT NULL | Promotion start |
| `ends_at` | timestamptz | NOT NULL | Promotion expiry |
| `created_by` | uuid | FK → `users.id`, NOT NULL | Admin who created the entry |
| `created_at` | timestamptz | default `now()` | Audit timestamp |

**Constraints:**
- Partial unique index on `event_id` where `ends_at > now()` — one active/upcoming featured entry per event. Note: this is evaluated at INSERT/UPDATE time, not continuously; an expired row frees up automatically once its `ends_at` passes `now()` at the time of the next insert.
- Check constraint: `ends_at > starts_at`

**Migration SQL:**

```sql
CREATE TABLE featured_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_name text,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_events_date_order CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX featured_events_active_event
  ON featured_events (event_id) WHERE ends_at > now();

-- RLS
ALTER TABLE featured_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active featured events"
  ON featured_events FOR SELECT
  USING (starts_at <= now() AND ends_at > now());

CREATE POLICY "Admins can manage featured events"
  ON featured_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );
```

**RLS Policies:**
- Public SELECT for rows where `starts_at <= now()` and `ends_at > now()` (active promotions only)
- INSERT/UPDATE/DELETE restricted to users with `admin` role

### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/events/featured` | GET | Public | Returns active featured events (joined with event data), ordered by `priority` DESC, `starts_at` ASC |
| `/api/admin/featured` | GET | Admin | Returns all featured events: active, upcoming, and expired |
| `/api/admin/featured` | POST | Admin | Create a featured entry |
| `/api/admin/featured/[id]` | PATCH | Admin | Update priority, dates, sponsor name |
| `/api/admin/featured/[id]` | DELETE | Admin | Remove a featured entry |

All admin routes use `verifyAdmin()` and log via `logAdminAction()`, consistent with existing moderation patterns. The `AuditTargetType` in `lib/audit.ts` must be extended to include `"featured_event"`.

Text inputs (`sponsor_name`) must be sanitized with `sanitizeText()` from `lib/sanitize.ts` before writing to the database.

## Hero Component

### Featured Mode (active promotions exist)

Replaces the current `HeroSection` with a carousel-capable version.

- Full-bleed hero, same visual treatment as current (background image, gradient overlay, text content)
- Auto-rotates every 6 seconds
- Pauses on hover and touch
- Dot indicators at the bottom for position + manual navigation
- Swipe support on mobile
- Each slide displays: event image, title, description, "Register Now" CTA, "More Info" CTA
- "Sponsored" pill badge replaces the current "Featured Experience" badge for transparency
- Events ordered by `priority` DESC, then `starts_at` ASC

### Fallback Mode (no active promotions)

- Static branded Uni-Verse hero
- McGill campus background image (admin-swappable later)
- Branding + tagline: "Discover what's happening on campus"
- Single CTA: "Explore Events" that scrolls to the feed below
- No carousel controls (single static view)

### Carousel Implementation

Uses `embla-carousel-react` (already installed) with autoplay plugin. This is consistent with the project's existing dependency.

### Loading Strategy

- Renders the branded fallback immediately on mount
- Fetches via a new `useFeaturedEvents()` SWR hook (consistent with existing data fetching patterns)
- If response contains events, crossfades into the carousel (smooth transition, no jarring swap)
- If response is empty or errors, stays on the branded fallback

### Fallback Image

The branded fallback hero background image URL is stored as `HERO_FALLBACK_IMAGE` in `lib/constants.ts`, alongside the existing `EVENT_CATEGORIES` constants.

## Admin UI

### Quick Action — Moderation Panel (`/moderation`)

- "Feature" button on each approved event row/detail view
- Opens a modal with:
  - Sponsor name (optional text input)
  - Duration picker: preset buttons (3 days, 7 days, 14 days, 30 days) + custom date range
  - Priority (number input, default 0)
- Submit creates a `featured_events` row with `starts_at = now()`
- If the event is already featured: button changes to "Edit Feature" / "Remove Feature"

### Dedicated Management Page (`/moderation/featured`)

- Three sections/tabs: **Active**, **Upcoming** (`starts_at` in the future), **Expired**
- Table view per section: event title, sponsor name, priority, start date, end date, status
- Row actions: Edit (opens same modal), Remove (confirmation dialog)
- "Add Featured Event" button: search/select approved events, then opens the feature modal

## Homepage Section Order

No changes to existing section order. The hero is updated in-place:

1. **Hero** (featured carousel OR branded fallback) — updated
2. Happening Now
3. Trending Now
4. Recommended For You (authenticated)
5. Friends Activity (authenticated)
6. Upcoming This Week
7. Category Rows

## Types

Add to `src/types/index.ts`:

```typescript
interface FeaturedEvent {
  id: string;
  event_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  event: Event; // joined event data
}
```

## Files to Create / Modify

### New files
- `supabase/migrations/<timestamp>_create_featured_events.sql` — migration
- `src/hooks/useFeaturedEvents.ts` — SWR hook for client-side fetching
- `src/app/api/events/featured/route.ts` — public GET endpoint
- `src/app/api/admin/featured/route.ts` — admin GET + POST
- `src/app/api/admin/featured/[id]/route.ts` — admin PATCH + DELETE
- `src/app/moderation/featured/page.tsx` — dedicated management page
- `src/components/moderation/FeatureEventModal.tsx` — shared modal for create/edit

### Modified files
- `src/components/events/HeroSection.tsx` — replace with carousel-capable version
- `src/types/index.ts` — add `FeaturedEvent` interface
- `src/lib/audit.ts` — extend `AuditTargetType` to include `"featured_event"`
- `src/lib/constants.ts` — add `HERO_FALLBACK_IMAGE` constant
- `src/app/moderation/ModerationNav.tsx` — add "Featured" nav entry (using `Star` icon from lucide-react)
- `src/app/moderation/pending/page.tsx` (or equivalent event detail) — add "Feature" quick action button

### Date Fields Note
The `Event` type uses `event_date` (ISO date string) and `event_time` (HH:mm format). The hero carousel and admin table should display these fields, not `start_date`/`end_date` (which exist only on the `CalendarEvent` type).

## Out of Scope

- Analytics/impressions tracking for featured events (future)
- Self-service sponsor portal (admin-only for now)
- Payment integration
- Featured event custom hero images (uses the event's existing `image_url`)
