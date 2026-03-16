# Create-Event Flow: Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken functionality in the `/create-event` flow (both standalone and club event streams), add soft delete, build `/my-events`, and integrate the rejection/appeal system.

**Architecture:** The create-event flow spans two entry paths (standalone `/create-event` and club `/create-event?clubId=xxx`) that share one form component (`CreateEventForm`) and one create API (`POST /api/events/create`). The DB uses `start_date`/`end_date` columns but frontend types incorrectly reference `event_date`/`event_time` — a translation layer (`transformEventFromDB`) exists but is inconsistently applied. The existing `notifications` table, API, and UI components handle all notification needs.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (PostgREST + Storage), SWR, Tailwind CSS, shadcn/ui

---

## Corrections From Codebase Audit + Live DB Verification

The rough draft contained several factual errors. This plan corrects them based on both codebase research and **live Supabase schema verification** (queried via MCP on 2026-03-15).

| Draft Claim | Reality (verified against live DB) | Impact |
|---|---|---|
| Proposes new `user_notifications` table | `notifications` table already exists with full API (`/api/notifications/*`), UI (`NotificationBell`, `NotificationList`, `NotificationItem`), hook (`useNotificationCount`), and page (`/notifications`) | **Remove entire Section 2.4 and most of Feature 4.5** — no new table, no new API, no new UI needed |
| Feature 4.5 "Build notification API endpoints" | `GET /api/notifications`, `PATCH /api/notifications/[id]`, `POST /api/notifications?action=mark-all-read`, `GET /api/notifications/count` all exist and work | **Skip** — only wire rejection reason into existing notification message |
| `/my-events` "currently 404s" | `src/app/my-events/page.tsx` exists but redirects to `/calendar?view=Saved` | **Replace redirect** with proper page component |
| Feature 4.3 "Build DELETE endpoint" | `DELETE /api/admin/events/[id]` already exists (hard delete, admin-only) | **Convert existing endpoint** from hard delete to soft delete + add user-facing endpoint |
| Bug list has 10 items | Main `/api/events` route has **no status filter** — pending/rejected events appear in public feed | **Add as Bug #0 (CRITICAL)** |
| "18 locations need deleted_at filter" not specified | Full list identified: 18 query locations across 14 files | **Exhaustive list provided below** |
| Proposes `moderation_reviews` table as "already specced" | No such table exists in DB. No reviews/appeal code exists anywhere | **This is net-new work** |
| Approval notifications "need to be built" | `PATCH /api/admin/events/[id]/status` already sends `event_approved`/`event_rejected` notifications via the existing `notifications` table | **Only enhancement needed:** add rejection reason to the notification message |
| CLAUDE.md says RSVP table is `event_rsvps` | **Live DB table is `rsvps`** (verified). Columns: `id`, `user_id`, `event_id`, `status`, `created_at`, `updated_at`. RLS: open reads, user-scoped writes. Has 9 rows. | **Bug #3 from original audit is INVALID** — the code `.from("rsvps")` is correct. CLAUDE.md is wrong. |
| Draft Bug #3 "Fix rsvps → event_rsvps" | The `rsvps` table exists, has data (5 going, 1 interested, 3 cancelled), and RLS allows reads. The club events API query is correct. | **Remove Bug #3 from fix list. Update CLAUDE.md instead.** |
| Notification upsert uses `onConflict: "user_id,event_id,type"` | **No unique constraint exists** on notifications for `(user_id, event_id, type)` — only PK on `id`. The upsert will silently insert duplicates instead of updating. | **New bug: add unique constraint or switch to insert** |
| Events `approved_by` / `approved_at` in TS types | **Columns do not exist in DB** (verified). The `Event` interface lists phantom fields. | Confirmed: remove from type |

### Live DB Schema Summary (events table)

Verified columns on the `events` table (19 columns):

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` |
| `title` | text | NO | — |
| `description` | text | YES | — |
| `start_date` | timestamptz | NO | — |
| `end_date` | timestamptz | NO | — |
| `location` | text | YES | — |
| `category` | text | YES | — |
| `tags` | text[] | YES | — |
| `image_url` | text | YES | — |
| `organizer` | text | YES | — |
| `rsvp_count` | integer | YES | `0` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |
| `status` | text | NO | `'pending'` |
| `created_by` | uuid | YES | — |
| `club_id` | uuid | YES | — |
| `source` | text | NO | `'manual'` |
| `source_url` | text | YES | — |
| `content_hash` | text | YES | — |

**Constraints:**
- `events_status_check`: status IN (`pending`, `approved`, `rejected`)
- `events_source_check`: source IN (`manual`, `instagram`, `admin`)
- `events_club_id_fkey`: FK → clubs(id) ON DELETE SET NULL
- `events_created_by_fkey`: FK → auth.users(id) ON DELETE SET NULL

**Tables referencing events (CASCADE risk for soft delete):**

| Table | Column | On Delete |
|---|---|---|
| `saved_events` | event_id | CASCADE |
| `rsvps` | event_id | CASCADE |
| `user_interactions` | event_id | CASCADE |
| `event_popularity_scores` | event_id | CASCADE |
| `email_reminder_log` | event_id | CASCADE |
| `event_invites` | event_id | CASCADE |
| `featured_events` | event_id | CASCADE |
| `user_event_scores` | event_id | CASCADE |
| `notifications` | event_id | SET NULL |

**Critical:** All 8 child tables use `ON DELETE CASCADE`. If the old admin hard-delete endpoint (`DELETE /api/admin/events/[id]`) is ever called, it wipes RSVPs, saved events, interactions, popularity scores, invites, reminders, and featured status. This is another strong reason to switch to soft delete — hard delete destroys audit trail data.

---

## Product Decisions (Locked)

| Decision | Outcome |
|---|---|
| Two streams (user + club) | Keep both. Standalone = always pending. Club = auto-approve if club approved + user is member. |
| Moderator | Ady is sole moderator. Auto-moderation deferred. |
| Recurring events | Punted. Duplicate feature is workaround. |
| Club event creation permissions | Any `club_members` row holder can create. Role restriction deferred. |
| Standalone → club conversion | Punted. Workaround: duplicate + delete. |
| Visual distinction | No extra badges. Club name/logo is sufficient differentiation. |
| Club-specific form fields | Identical form for both streams. |
| Rejection/appeal | Rejection includes category + reason. Creator can appeal (edit + message). |

---

## Important Notes

- **Line numbers are approximate** — based on the file state before any changes. As earlier tasks modify files, line numbers in later tasks for the same files will drift. Use surrounding code context, not line numbers, to locate edit points.
- **Appeal count cap** — The appeal endpoint (Task 14) should enforce a maximum of 3 appeals per event. After 3 rejections, the event is permanently rejected and must be recreated.
- **Soft delete UX for notifications** — When a user clicks a notification for a soft-deleted event, the event detail page should show a "This event has been removed" message, not a 404. The `GET /api/events/[id]` endpoint should distinguish between "not found" and "deleted" in its response.
- **REST consistency** — Task 10 creates a user-facing delete as `POST /api/events/[id]/delete`. Prefer adding a `DELETE` export to the existing `src/app/api/events/[id]/route.ts` instead, for API consistency with the admin DELETE endpoint.

---

## Database Schema Changes

### Migration 1: `deleted_at` column on `events`

```sql
-- Add soft delete support
ALTER TABLE events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering (partial index on non-deleted rows)
CREATE INDEX idx_events_not_deleted ON events (id) WHERE deleted_at IS NULL;
```

### Migration 2: `moderation_reviews` table

```sql
CREATE TABLE moderation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'club')),
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('rejection', 'appeal')),
  category TEXT CHECK (category IN (
    'inappropriate_content', 'missing_information', 'duplicate',
    'policy_violation', 'incorrect_details', 'other'
  )),
  message TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups by target
CREATE INDEX idx_moderation_reviews_target
  ON moderation_reviews (target_type, target_id, created_at DESC);

-- RLS
ALTER TABLE moderation_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "admins_read_all" ON moderation_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(roles))
  );

-- Users can read reviews for their own events/clubs
CREATE POLICY "creators_read_own" ON moderation_reviews
  FOR SELECT USING (
    (target_type = 'event' AND target_id IN (
      SELECT id FROM events WHERE created_by = auth.uid()
    ))
    OR
    (target_type = 'club' AND target_id IN (
      SELECT id FROM clubs WHERE created_by = auth.uid()
    ))
  );

-- Admins can insert rejections, creators can insert appeals for their own events
CREATE POLICY "admins_insert" ON moderation_reviews
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(roles))
    OR (
      action = 'appeal'
      AND target_type = 'event'
      AND target_id IN (SELECT id FROM events WHERE created_by = auth.uid())
    )
    OR (
      action = 'appeal'
      AND target_type = 'club'
      AND target_id IN (SELECT id FROM clubs WHERE created_by = auth.uid())
    )
  );
```

### Migration 3: `appeal_count` on `events` and `clubs`

```sql
ALTER TABLE events ADD COLUMN appeal_count INTEGER DEFAULT 0;
ALTER TABLE clubs ADD COLUMN appeal_count INTEGER DEFAULT 0;
```

### NO migration needed for notifications

The existing `notifications` table already supports all required types. The `type` column accepts any string. Existing supported types include: `event_approved`, `event_rejected`, `club_approved`, `club_rejected`, `new_event`, `event_reminder_24h`, `event_reminder_1h`, `event_invite`, `new_follower`, `new_friend`.

---

## TypeScript Type Update

**File:** `src/types/index.ts`

Replace the `Event` interface to match the actual DB schema:

```typescript
export interface Event {
  id: string;
  title: string;
  description: string | null; // nullable in DB
  start_date: string;       // ISO timestamp (was: event_date)
  end_date: string;          // ISO timestamp (was: missing)
  location: string | null;   // nullable in DB
  organizer: string | null;  // was: missing
  club_id: string | null;    // was: required string
  tags: EventTag[];
  image_url: string | null;
  category: string | null;   // was: missing
  source: string;            // was: missing
  source_url: string | null;
  content_hash: string | null; // was: missing
  rsvp_count: number | null;   // was: missing
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  status: "pending" | "approved" | "rejected";
  deleted_at: string | null;    // NEW
  appeal_count: number;         // NEW
  // Relations (populated by joins, not stored)
  club?: Club;
  saved_by_users?: string[];
}
```

**Fields removed:** `event_date`, `event_time`, `approved_by`, `approved_at` (none exist in DB).

After updating, `transformEventFromDB()` in `lib/tagMapping.ts` must be updated to return the new shape, and all `as unknown as` casts removed.

---

## File Map

### Files to Modify

| File | Changes |
|---|---|
| `src/types/index.ts` | Update `Event` interface |
| `src/lib/tagMapping.ts` | Update `transformEventFromDB()` return type, remove `event_date`/`event_time` derivation |
| `src/app/api/clubs/[id]/events/route.ts` | Fix `event_date` → `start_date` ordering, fix `rsvps` → `event_rsvps` table |
| `src/components/clubs/ClubEventsTab.tsx` | Fix `EventWithRsvp` interface, all `event_date` refs, wire delete button |
| `src/components/events/CreateEventForm.tsx` | Fix end date restore in edit, fix image upload failure handling |
| `src/app/api/events/[id]/route.ts` | Add `created_by` ownership check to PATCH |
| `src/app/api/events/route.ts` | Add `eq("status", "approved")` + `is("deleted_at", null)` |
| `src/app/api/admin/events/[id]/route.ts` | Convert hard DELETE to soft delete |
| `src/app/api/admin/events/[id]/status/route.ts` | Add rejection reason + category to request, store in `moderation_reviews`, include reason in notification message |
| `src/app/create-event/page.tsx` | Fix breadcrumb for club context |
| `src/lib/classifier.ts` | Fix `classifyTags()` to return `EventTag[]` |
| `src/app/my-events/page.tsx` | Replace redirect with full page component |
| **14 additional API files** | Add `deleted_at IS NULL` filter (see exhaustive list below) |

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/YYYYMMDD_soft_delete_and_reviews.sql` | Schema migration |
| `src/app/api/events/my-events/route.ts` | GET endpoint for user's own events |
| `src/app/api/events/[id]/appeal/route.ts` | POST endpoint for appeal submission |
| `src/app/api/events/[id]/reviews/route.ts` | Already exists — extend or create separate moderation reviews endpoint |

---

## Exhaustive `deleted_at IS NULL` Filter Locations

Every query below needs `.is("deleted_at", null)` added after the soft delete migration. Organized by priority:

**PUBLIC-FACING (users see wrong data without fix):**

| # | File | Line | Current Filter |
|---|---|---|---|
| 1 | `src/app/api/events/route.ts` | 199 | **NONE** (also missing `status = approved`) |
| 2 | `src/app/api/events/[id]/route.ts` | 85 | None |
| 3 | `src/app/api/events/popular/route.ts` | 97 | Has `status = approved` |
| 4 | `src/app/api/events/happening-now/route.ts` | 20 | Has `status = approved` |
| 5 | `src/app/api/events/new/route.ts` | 15 | Has `status = approved` |
| 6 | `src/app/api/events/following/route.ts` | 37 | Has `status = approved` |
| 7 | `src/app/api/events/friends-organizing/route.ts` | 34 | Has `status = approved` |
| 8 | `src/app/api/events/export/route.ts` | 165 | Has `status = approved` |
| 9 | `src/app/api/events/featured/route.ts` | 9 | Filters in JS |
| 10 | `src/app/api/calendar/events/route.ts` | 52 | Has `status = approved` |
| 11 | `src/app/api/users/saved-events/route.ts` | 93 | Has `status = approved` |
| 12 | `src/app/api/recommendations/route.ts` | 41, 112 | **NONE** on anonymous fallback |
| 13 | `src/app/api/clubs/[id]/events/route.ts` | 44 | Conditional (organizers see all) |

**INTERACTION ENDPOINTS (allow acting on deleted events without fix):**

| # | File | Line | Current Filter |
|---|---|---|---|
| 14 | `src/app/api/events/[id]/save/route.ts` | 68 | None |
| 15 | `src/app/api/events/[id]/rsvp/route.ts` | 76 | None |
| 16 | `src/app/api/interactions/route.ts` | 91 | None |

**ADMIN/ANALYTICS (show deleted events in reports without fix):**

| # | File | Line | Current Filter |
|---|---|---|---|
| 17 | `src/app/api/admin/events/route.ts` | 38 | Optional status param |
| 18 | `src/app/api/cron/send-reminders/route.ts` | 23 | None |

**Note:** Admin routes (#17) should filter `deleted_at IS NULL` by default but accept a `?includeDeleted=true` query param for audit purposes. The moderation pending page (`/moderation/pending/page.tsx`) queries client-side with `eq("status", "pending")` — this also needs the filter.

---

## Phase 1: Critical Bug Fixes

These fix broken core functionality. Ship first.

### Task 1: Fix main events API — missing status filter (NEW BUG)

**Files:**
- Modify: `src/app/api/events/route.ts:198-201`

This is the most critical bug — pending and rejected events appear in the public feed.

- [ ] **Step 1: Add status filter to the main events query**

In `src/app/api/events/route.ts`, after the `.order('start_date', ...)` line (~201), add:

```typescript
// Only return approved events in the public feed
eventsQuery = eventsQuery.eq('status', 'approved');
```

- [ ] **Step 2: Verify the recommendation anonymous fallback also filters**

In `src/app/api/recommendations/route.ts`, find the anonymous fallback query (~line 41) and the popular fallback (~line 112). Add `.eq('status', 'approved')` to both.

- [ ] **Step 3: Test manually**

```bash
# Start dev server and verify /api/events only returns approved events
curl "http://localhost:3000/api/events?limit=5" | jq '.events[].status'
# Should only show "approved", never "pending" or "rejected"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts src/app/api/recommendations/route.ts
git commit -m "fix(events): add missing status filter to public events feed

Pending and rejected events were visible in the public feed and
recommendation fallbacks. Add eq('status', 'approved') filter."
```

### Task 2: Fix club events API — wrong column name in ORDER BY

**Files:**
- Modify: `src/app/api/clubs/[id]/events/route.ts:47`

- [ ] **Step 1: Fix the ordering column**

In `src/app/api/clubs/[id]/events/route.ts`, line 47, change:

```typescript
// Before
.order("event_date", { ascending: false });
// After
.order("start_date", { ascending: false });
```

**Note:** The `.from("rsvps")` query on line 69 is CORRECT — verified against live DB. The table is `rsvps` (not `event_rsvps` as CLAUDE.md incorrectly states). CLAUDE.md should be updated separately.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/events/route.ts
git commit -m "fix(clubs): use correct column name in club events API ORDER BY

event_date does not exist in DB (correct: start_date)."
```

### Task 3: Fix ClubEventsTab — wrong field names throughout

**Files:**
- Modify: `src/components/clubs/ClubEventsTab.tsx`

- [ ] **Step 1: Update the `EventWithRsvp` interface**

Replace `event_date: string` with `start_date: string` in the interface (line 39):

```typescript
interface EventWithRsvp {
  id: string;
  title: string;
  description: string;
  start_date: string;      // was: event_date
  end_date?: string | null; // add this
  location: string;
  tags: EventTag[];
  image_url?: string | null;
  category?: string | null;
  status: "pending" | "approved" | "rejected";
  rsvp_counts?: {
    going: number;
    interested: number;
    cancelled: number;
  };
}
```

- [ ] **Step 2: Update `getDisplayStatus`**

Line 55, change `event.event_date` → `event.start_date`:

```typescript
const getDisplayStatus = (event: EventWithRsvp): DisplayStatus => {
  const eventDate = new Date(event.start_date);
  const now = new Date();
  if (eventDate < now) return "past";
  // ... rest unchanged
};
```

- [ ] **Step 3: Update `formatDate` call**

Line 208, change:

```typescript
// Before
{formatDate(event.event_date)}
// After
{formatDate(event.start_date)}
```

- [ ] **Step 4: Update edit modal `initialData`**

Line 300, change:

```typescript
// Before
start_date: editingEvent.event_date,
// After
start_date: editingEvent.start_date,
```

- [ ] **Step 5: Commit**

```bash
git add src/components/clubs/ClubEventsTab.tsx
git commit -m "fix(clubs): use start_date instead of event_date in ClubEventsTab

event_date doesn't exist in the API response. Fixes date display,
status detection, and edit mode pre-fill."
```

### Task 4: Fix edit mode — end date not restored

**Files:**
- Modify: `src/components/events/CreateEventForm.tsx:102-124`

- [ ] **Step 1: Extend `CreateEventFormProps` to accept `end_date`**

Update the `initialData` type in the interface (line ~82):

```typescript
initialData?: {
  title: string;
  description: string;
  start_date?: string;
  end_date?: string | null;  // ADD THIS
  location: string;
  tags: EventTag[];
  image_url?: string | null;
  category?: string | null;
};
```

- [ ] **Step 2: Parse end date in `getInitialDateParts`**

Replace the existing function (lines 102-110):

```typescript
const getInitialDateParts = () => {
  const parts = { date: "", time: "", endDate: "", endTime: "" };
  if (mode === "edit" && initialData?.start_date) {
    const dt = new Date(initialData.start_date);
    parts.date = dt.toISOString().split("T")[0];
    parts.time = dt.toTimeString().slice(0, 5);
  }
  if (mode === "edit" && initialData?.end_date) {
    const dt = new Date(initialData.end_date);
    parts.endDate = dt.toISOString().split("T")[0];
    parts.endTime = dt.toTimeString().slice(0, 5);
  }
  return parts;
};
```

- [ ] **Step 3: Use the parsed end date in initial state**

Update the `useState` initializer (~line 114):

```typescript
const [formData, setFormData] = useState<FormData>({
  title: initialData?.title ?? "",
  description: initialData?.description ?? "",
  date: initialDateParts.date,
  endDate: initialDateParts.endDate,      // was: ""
  time: initialDateParts.time,
  endTime: initialDateParts.endTime,      // was: ""
  location: initialData?.location ?? "",
  tags: initialData?.tags ?? [],
  imageFile: null,
});
```

- [ ] **Step 4: Pass `end_date` from ClubEventsTab edit modal**

In `src/components/clubs/ClubEventsTab.tsx`, update the edit modal's `initialData` (~line 297):

```typescript
initialData={{
  title: editingEvent.title,
  description: editingEvent.description,
  start_date: editingEvent.start_date,
  end_date: editingEvent.end_date,  // ADD THIS
  location: editingEvent.location,
  tags: editingEvent.tags,
  image_url: editingEvent.image_url,
  category: editingEvent.category,
}}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/events/CreateEventForm.tsx src/components/clubs/ClubEventsTab.tsx
git commit -m "fix(events): restore end date/time when editing events

getInitialDateParts only parsed start_date. End date fields were
always blank in edit mode."
```

### Task 5: Fix image upload failure — silent data loss

**Files:**
- Modify: `src/components/events/CreateEventForm.tsx:240-260`

- [ ] **Step 1: Replace the image upload + fallback logic**

Replace the image handling block in `handleSubmit` (~lines 240-260):

```typescript
// Upload image if provided
let imageUrl: string | null = null;
if (formData.imageFile) {
  imageUrl = await uploadEventImage(formData.imageFile);
  if (!imageUrl) {
    // Show error to user instead of silently continuing
    setSubmitError("Image upload failed. Please try again or remove the image.");
    setSubmitting(false);
    return; // Stop submission — don't silently lose the image
  }
}

// Determine the image URL to send:
// - If new image uploaded successfully: use new URL
// - If no new image selected: keep existing preview (original URL for edits, null for creates)
const finalImageUrl = imageUrl ?? (formData.imageFile ? imageUrl : imagePreview);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/CreateEventForm.tsx
git commit -m "fix(events): block submission on image upload failure

Previously, a failed upload silently removed the existing image.
Now shows an error and stops submission so the user can retry."
```

### Task 6: Fix PATCH permissions — add `created_by` ownership check

**Files:**
- Modify: `src/app/api/events/[id]/route.ts:154-191`

- [ ] **Step 1: Fetch `created_by` along with `club_id`**

Change the event select query (~line 155):

```typescript
// Before
.select("id, club_id")
// After
.select("id, club_id, created_by, status")
```

- [ ] **Step 2: Add ownership check to permission logic**

Replace the permission block (~lines 177-191):

```typescript
// Permission check: admin can edit any event
let canEdit = roles.includes("admin");

// Original creator can edit their own pending events
if (!canEdit && event.created_by === user.id) {
  // Only pending events are editable by creator (approved events
  // have passed moderation — edits would bypass review)
  if (event.status === "pending") {
    canEdit = true;
  }
}

// Club member can edit their club's events
if (!canEdit && event.club_id) {
  const { data: membership } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", event.club_id)
    .single();

  if (membership) {
    canEdit = true;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/[id]/route.ts
git commit -m "fix(events): add created_by ownership check to PATCH endpoint

Creators can now edit their own pending events. Club members (not just
club_organizer role) can edit their club's events. Approved events are
locked for non-admin users to preserve moderation integrity."
```

---

## Phase 2: Schema Migration + Type Sync

Depends on Phase 1 being merged. All subsequent features build on these changes.

### Task 7: Run schema migrations

**Files:**
- Create: `supabase/migrations/20260315000001_soft_delete_and_reviews.sql`

- [ ] **Step 1: Write the migration file**

Create the migration with all three schema changes (see "Database Schema Changes" section above for full SQL). Combine `deleted_at`, `moderation_reviews`, and `appeal_count` into one migration.

- [ ] **Step 2: Apply the migration**

```bash
# If using Supabase CLI:
npx supabase db push
# Or apply via the Supabase MCP tool
```

- [ ] **Step 3: Regenerate TypeScript types**

```bash
npx supabase gen types typescript --project-id xgfetrzyjroiqpwhksjw > src/lib/supabase/types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/lib/supabase/types.ts
git commit -m "feat(schema): add soft delete, moderation_reviews, appeal_count

- events.deleted_at (nullable TIMESTAMPTZ) for soft delete
- moderation_reviews table for rejection reasons + appeal messages
- events.appeal_count and clubs.appeal_count for appeal tracking"
```

### Task 8: Update TypeScript `Event` interface

**Files:**
- Modify: `src/types/index.ts:34-54`

- [ ] **Step 1: Replace the `Event` interface**

See the "TypeScript Type Update" section above for the full replacement. Key changes:
- `event_date` → `start_date`
- `event_time` → removed (derived, not stored)
- Add: `end_date`, `organizer`, `category`, `source`, `content_hash`, `rsvp_count`, `deleted_at`, `appeal_count`
- Remove: `approved_by`, `approved_at` (don't exist in DB)

- [ ] **Step 2: Update `transformEventFromDB` in `lib/tagMapping.ts`**

The function currently converts `start_date` → `event_date` + `event_time`. Update it to pass through `start_date`/`end_date` directly:

```typescript
export function transformEventFromDB(dbEvent: DBEvent): Event {
  // ... club building logic unchanged ...

  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    start_date: dbEvent.start_date,         // pass through directly
    end_date: dbEvent.end_date ?? dbEvent.start_date, // fallback
    location: dbEvent.location,
    organizer: dbEvent.organizer ?? null,
    club_id: dbEvent.club_id ?? null,
    tags: mapTags(dbEvent.tags),
    image_url: dbEvent.image_url || null,
    category: null, // not in DBEvent interface yet
    source: "manual",
    source_url: null,
    content_hash: null,
    rsvp_count: null,
    created_by: dbEvent.created_by || null,
    created_at: dbEvent.created_at,
    updated_at: dbEvent.updated_at,
    status: (dbEvent.status as Event["status"]) || "approved",
    deleted_at: null,
    appeal_count: 0,
    club,
    saved_by_users: [],
  };
}
```

- [ ] **Step 3: Fix all compile errors from the type change**

Search for all references to `event_date` and `event_time` across the codebase and update them to use `start_date`/`end_date`. Key files:

```bash
# Find all references
grep -rn "event_date\|event_time" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

Known locations (from audit — **do not rely on line numbers, use code context**):
- `src/components/shared/EditEventModal.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/DiscoveryCard.tsx`
- `src/components/events/EventDetailView.tsx`
- `src/components/events/EventDetailsModal.tsx`
- `src/components/events/RelatedEventCard.tsx`
- `src/components/events/EventSearch.tsx`
- `src/components/events/UpcomingThisWeekSection.tsx`
- `src/components/events/FriendsActivitySection.tsx`
- `src/components/events/FriendsOrganizingSection.tsx`
- `src/components/events/HomeFeed.tsx`
- `src/components/events/CategoryBrowser.tsx`
- `src/components/clubs/ClubOverviewTab.tsx`
- `src/components/clubs/ClubAnalyticsTab.tsx`
- `src/app/calendar/page.tsx`
- `src/app/profile/ProfileClient.tsx`
- `src/app/profile/page.tsx`
- `src/app/users/[id]/page.tsx`

Each of these renders dates from events — update every `event.event_date` to `event.start_date` and remove any `event.event_time` usage (extract time from `start_date` inline where needed).

- [ ] **Step 4: Remove all `as unknown as` casts**

```bash
grep -rn "as unknown as" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Each cast should be removable now that the types align with the DB.

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Fix any remaining type errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/tagMapping.ts src/components/ src/app/
git commit -m "refactor(types): align Event interface with actual DB schema

- start_date/end_date replace event_date/event_time
- Add missing fields: organizer, category, source, content_hash, etc.
- Remove phantom fields: approved_by, approved_at
- Update transformEventFromDB and all component references
- Remove all 'as unknown as' casts"
```

### Task 9: Add `deleted_at IS NULL` filter to all event queries

**Files:**
- Modify: All 18 files listed in the exhaustive filter table above

- [ ] **Step 1: Add filter to all public-facing queries (items 1-13)**

For each file, add `.is("deleted_at", null)` to the Supabase query chain. Example pattern:

```typescript
// Before
.from("events")
.select("*")
.eq("status", "approved")

// After
.from("events")
.select("*")
.eq("status", "approved")
.is("deleted_at", null)
```

- [ ] **Step 2: Add filter to interaction endpoints (items 14-16)**

These are existence checks — add the filter so users can't RSVP/save/interact with deleted events.

- [ ] **Step 3: Add conditional filter to admin routes (items 17-18)**

For `src/app/api/admin/events/route.ts`, add the filter by default but respect a `?includeDeleted=true` query param:

```typescript
if (searchParams.get("includeDeleted") !== "true") {
  query = query.is("deleted_at", null);
}
```

For `src/app/api/cron/send-reminders/route.ts`, always filter — never send reminders for deleted events.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat(events): add deleted_at IS NULL filter to all event queries

18 query locations across 14 files now exclude soft-deleted events.
Admin routes accept ?includeDeleted=true for audit purposes."
```

---

## Phase 3: Core Features

### Task 10: Soft delete — convert existing hard delete + add user endpoint

**Files:**
- Modify: `src/app/api/admin/events/[id]/route.ts:64-97` (convert hard delete)
- Create: `src/app/api/events/[id]/delete/route.ts` (user-facing soft delete)
- Modify: `src/components/clubs/ClubEventsTab.tsx:81-99` (wire up button)

- [ ] **Step 1: Convert admin DELETE from hard to soft**

In `src/app/api/admin/events/[id]/route.ts`, replace the delete query:

```typescript
// Before
const { error } = await supabase.from("events").delete().eq("id", id);

// After
const { error } = await supabase
  .from("events")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", id)
  .is("deleted_at", null); // prevent double-delete
```

- [ ] **Step 2: Create user-facing delete endpoint**

Create `src/app/api/events/[id]/delete/route.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch event to check ownership
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, created_by, club_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Permission: creator OR admin OR club member
  let canDelete = event.created_by === user.id;

  if (!canDelete) {
    const { data: profile } = await supabase
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();
    canDelete = (profile?.roles ?? []).includes("admin");
  }

  if (!canDelete && event.club_id) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("club_id", event.club_id)
      .single();
    canDelete = !!membership;
  }

  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Wire up the delete button in ClubEventsTab**

Replace the stubbed `handleDelete` function:

```typescript
const handleDelete = async (eventId: string) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this event? This action cannot be undone."
  );
  if (!confirmed) return;

  setDeletingId(eventId);
  try {
    const res = await fetch(`/api/events/${eventId}/delete`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete event");
    }
    mutate(); // refresh the events list
  } catch (err) {
    console.error("Delete failed:", err);
    // Could add toast notification here
  } finally {
    setDeletingId(null);
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/events/[id]/route.ts src/app/api/events/[id]/delete/route.ts src/components/clubs/ClubEventsTab.tsx
git commit -m "feat(events): implement soft delete with user-facing endpoint

- Convert admin hard delete to soft delete (sets deleted_at)
- Add POST /api/events/[id]/delete for creators and club members
- Wire up delete button in ClubEventsTab"
```

### Task 11: Build `/my-events` page

**Files:**
- Create: `src/app/api/events/my-events/route.ts`
- Modify: `src/app/my-events/page.tsx` (replace redirect)

- [ ] **Step 1: Create the API endpoint**

Create `src/app/api/events/my-events/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("*, club:clubs(id, name, logo_url)")
    .eq("created_by", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
}
```

- [ ] **Step 2: Replace the redirect with a full page component**

Replace `src/app/my-events/page.tsx` entirely. The page should:

- Use SWR to fetch from `/api/events/my-events`
- Show tab filters: All | Pending | Approved | Rejected
- Each event row: title, `start_date` formatted, status badge (amber/green/red)
- Pending events: "Edit" button → opens `CreateEventForm` in `mode="edit"` inside a Dialog
- Rejected events: show latest rejection message (if `moderation_reviews` integration is done) + "Appeal" button
- Approved events: "View" link to `/events/[id]`
- Empty state: "You haven't created any events yet" with CTA to `/create-event`

Implementation is a standard SWR + filter tabs pattern — follow the structure of `ClubEventsTab.tsx` for the table layout and modal edit pattern.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/my-events/route.ts src/app/my-events/page.tsx
git commit -m "feat(events): build /my-events page with edit capability

- API endpoint returns user's own events (all statuses)
- Tab filters for All/Pending/Approved/Rejected
- Edit modal for pending events reuses CreateEventForm
- Replaces old redirect to /calendar?view=Saved"
```

### Task 12: Add rejection reason to moderation flow

**Files:**
- Modify: `src/app/api/admin/events/[id]/status/route.ts`
- Modify: `src/app/moderation/pending/page.tsx` (or events page — add rejection reason UI)

- [ ] **Step 1: Extend the status endpoint to accept rejection details**

In `src/app/api/admin/events/[id]/status/route.ts`, after the status update succeeds, insert a `moderation_reviews` record for rejections:

```typescript
const body = await request.json();
const { status, rejection_category, rejection_message } = body;

// ... existing status update code ...

// For rejections, store the reason in moderation_reviews
if (status === "rejected" && rejection_message) {
  await serviceClient.from("moderation_reviews").insert({
    target_type: "event",
    target_id: id,
    action: "rejection",
    category: rejection_category || null,
    message: rejection_message,
    author_id: user!.id,
  });
}

// Update the notification to include the rejection reason
// The existing notification insert (~line 64) becomes:
await serviceClient.from("notifications").upsert(
  {
    user_id: event.created_by,
    type: isApproved ? "event_approved" : "event_rejected",
    title: isApproved ? "Event Approved!" : "Event Not Approved",
    message: isApproved
      ? `Your event "${event.title}" has been approved and is now live.`
      : `Your event "${event.title}" was not approved. Reason: ${rejection_message || "No reason provided."}`,
    event_id: id,
    read: false,
    created_at: new Date().toISOString(),
  },
  { onConflict: "user_id,event_id,type" }
);
```

- [ ] **Step 2: Add rejection reason UI to moderation dashboard**

In the moderation pending page, when the admin clicks "Reject", show a modal/dialog with:
- Dropdown: rejection category (inappropriate_content, missing_information, duplicate, policy_violation, incorrect_details, other)
- Textarea: rejection message (required)
- Submit sends both to the status endpoint

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/events/[id]/status/route.ts src/app/moderation/
git commit -m "feat(moderation): add rejection reasons with categories

- Status endpoint accepts rejection_category + rejection_message
- Stores in moderation_reviews table for audit trail
- Notification message now includes the rejection reason"
```

### Task 13: Pending event auto-expiry (filter on read)

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`
- Modify: `src/app/api/admin/events/route.ts` (if moderation uses this)

- [ ] **Step 1: Add past-date filter to moderation pending query**

Add a filter to exclude pending events whose `start_date` has passed:

```typescript
// In the pending events query, add:
.gte("start_date", new Date().toISOString())
```

Or if filtering client-side, add a visual indicator:

```typescript
const isPast = new Date(event.start_date) < new Date();
// Show "Expired" badge and sort to bottom
```

Recommendation: filter on the query level to keep the moderator queue clean. Past pending events remain visible in `/my-events` with a "This event's date has passed" note.

- [ ] **Step 2: Commit**

```bash
git add src/app/moderation/
git commit -m "feat(moderation): filter past-date pending events from review queue

Pending events whose start_date has passed are hidden from the
moderator queue. Users can still see them in /my-events."
```

---

## Phase 4: Appeal Integration

Depends on Phase 3 (moderation_reviews table, /my-events page).

### Task 14: Build appeal submission endpoint

**Files:**
- Create: `src/app/api/events/[id]/appeal/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify event exists, is rejected, belongs to user, and is not deleted
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status, created_by, appeal_count, deleted_at")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.deleted_at) {
    return NextResponse.json({ error: "Cannot appeal a deleted event" }, { status: 400 });
  }

  if (event.status !== "rejected") {
    return NextResponse.json({ error: "Only rejected events can be appealed" }, { status: 400 });
  }

  if (event.created_by !== user.id) {
    return NextResponse.json({ error: "You can only appeal your own events" }, { status: 403 });
  }

  if ((event.appeal_count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Maximum appeal limit reached (3). Please create a new event." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string" || message.trim().length < 10) {
    return NextResponse.json(
      { error: "Appeal message must be at least 10 characters" },
      { status: 400 }
    );
  }

  // Insert appeal into moderation_reviews
  const { error: reviewError } = await supabase.from("moderation_reviews").insert({
    target_type: "event",
    target_id: id,
    action: "appeal",
    message: message.trim(),
    author_id: user.id,
  });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  // Reset event status to pending + atomically increment appeal_count
  // Use RPC to avoid read-then-write race condition on appeal_count
  const { error: updateError } = await supabase.rpc("increment_appeal_count", {
    event_id: id,
  });
  // Fallback if RPC doesn't exist: use raw update (acceptable for low-traffic)
  // const { error: updateError } = await supabase
  //   .from("events")
  //   .update({
  //     status: "pending",
  //     appeal_count: (event.appeal_count ?? 0) + 1,
  //     updated_at: new Date().toISOString(),
  //   })
  //   .eq("id", id);
  //
  // The RPC function should be:
  // CREATE OR REPLACE FUNCTION increment_appeal_count(event_id UUID)
  // RETURNS VOID AS $$
  //   UPDATE events
  //   SET appeal_count = appeal_count + 1,
  //       status = 'pending',
  //       updated_at = now()
  //   WHERE id = event_id;
  // $$ LANGUAGE sql SECURITY DEFINER;

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Appeal submitted. Your event is back in the review queue." });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/events/[id]/appeal/route.ts
git commit -m "feat(events): add appeal endpoint for rejected events

POST /api/events/[id]/appeal accepts a message, inserts into
moderation_reviews, resets status to pending, increments appeal_count."
```

### Task 15: Add appeal UI to `/my-events`

**Files:**
- Modify: `src/app/my-events/page.tsx`

- [ ] **Step 1: For rejected events, fetch latest rejection reason**

After fetching events from `/api/events/my-events`, for each rejected event, fetch its latest rejection from moderation_reviews:

```typescript
// Fetch rejection reasons for rejected events
const rejectedIds = events.filter(e => e.status === "rejected").map(e => e.id);
if (rejectedIds.length > 0) {
  const { data: reviews } = await supabase
    .from("moderation_reviews")
    .select("*")
    .in("target_id", rejectedIds)
    .eq("target_type", "event")
    .order("created_at", { ascending: false });
  // Group by target_id, take latest per event
}
```

Or add this to the `/api/events/my-events` endpoint to return reviews alongside events.

- [ ] **Step 2: Show rejection reason + appeal button**

For rejected events in the table:
- Display the rejection category badge and message below the event title
- "Appeal" button opens a dialog with:
  - Read-only display of rejection reason
  - Textarea for appeal message (min 10 chars)
  - Optional: edit form fields inline (reuse `CreateEventForm` in edit mode)
  - Submit button calls `POST /api/events/[id]/appeal`

- [ ] **Step 3: Commit**

```bash
git add src/app/my-events/page.tsx
git commit -m "feat(events): add appeal flow for rejected events in /my-events

Shows rejection reason with category. Appeal button opens dialog
with message textarea. Submits to /api/events/[id]/appeal."
```

### Task 16: Add appeal badge to moderation queue

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Show "Appeal" badge on events with `appeal_count > 0`**

In the pending events list, check `event.appeal_count`:

```tsx
{event.appeal_count > 0 && (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
    Appeal #{event.appeal_count}
  </span>
)}
```

- [ ] **Step 2: Add moderation thread viewer**

When the moderator clicks on an appealed event, show the full history from `moderation_reviews`:

```typescript
// Fetch review thread
const { data: reviews } = await supabase
  .from("moderation_reviews")
  .select("*, author:users(name, email)")
  .eq("target_type", "event")
  .eq("target_id", eventId)
  .order("created_at", { ascending: true });
```

Display as a timeline: rejection → appeal → rejection → appeal...

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/
git commit -m "feat(moderation): show appeal badges and review thread history

Pending events with appeal_count > 0 display an Appeal badge.
Moderators can view the full rejection/appeal thread timeline."
```

---

## Phase 5: Polish

### Task 17: Fix breadcrumb for club context

**Files:**
- Modify: `src/app/create-event/page.tsx:20-26`

- [ ] **Step 1: Update breadcrumb to show club context**

```tsx
<nav className="flex items-center gap-2 mb-6 text-sm">
  <a className="text-slate-500 hover:text-primary transition-colors" href="/">
    Dashboard
  </a>
  <ChevronRight className="h-3 w-3 text-slate-400" />
  {clubId && (
    <>
      <a
        className="text-slate-500 hover:text-primary transition-colors"
        href={`/clubs/${clubId}`}
      >
        Club Dashboard
      </a>
      <ChevronRight className="h-3 w-3 text-slate-400" />
    </>
  )}
  <span className="text-primary font-semibold">Create Event</span>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/create-event/page.tsx
git commit -m "fix(ui): breadcrumb links back to club dashboard when clubId present"
```

### Task 18: Fix `classifyTags()` return type

**Files:**
- Modify: `src/lib/classifier.ts:550-567`

- [ ] **Step 1: Update `classifyTags` to return `EventTag[]`**

```typescript
import { EventTag } from "@/types";

const TAG_KEYWORD_MAP: Record<EventTag, string[]> = {
  [EventTag.ACADEMIC]: ["lecture", "seminar", "workshop", /* ... existing keywords ... */],
  [EventTag.SOCIAL]: ["party", "mixer", "social", /* ... */],
  [EventTag.SPORTS]: ["game", "match", "tournament", /* ... */],
  [EventTag.CAREER]: ["career", "job", "internship", /* ... */],
  [EventTag.CULTURAL]: ["art", "music", "dance", /* ... */],
  [EventTag.WELLNESS]: ["wellness", "mental health", /* ... */],
};

export function classifyTags(caption: string): EventTag[] {
  const captionLower = caption.toLowerCase();
  const matchedTags: EventTag[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORD_MAP) as [EventTag, string[]][]) {
    if (keywords.some(kw => captionLower.includes(kw))) {
      matchedTags.push(tag);
    }
  }

  if (matchedTags.length === 0) {
    matchedTags.push(EventTag.SOCIAL);
  }

  return matchedTags;
}
```

**Note:** The existing `TAG_KEYWORDS` (used by `classifyPost`) should remain as-is for the Instagram pipeline. Add `TAG_KEYWORD_MAP` as a separate constant, or refactor to share keywords while returning proper types. Don't break the `classifyPost` pipeline.

- [ ] **Step 2: Remove the `as EventTag[]` cast in `CreateEventForm.tsx:143`**

```typescript
// Before
const suggestions = classifyTags(textToClassify) as EventTag[];
// After
const suggestions = classifyTags(textToClassify);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/classifier.ts src/components/events/CreateEventForm.tsx
git commit -m "fix(classifier): classifyTags returns EventTag[] directly

Removes unsafe 'as EventTag[]' cast from CreateEventForm."
```

### Task 19: Add server-side image MIME validation

**Files:**
- Modify: `src/app/api/events/upload-image/route.ts`

- [ ] **Step 1: Add MIME type allowlist**

After the file size check (~line 27), add:

```typescript
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

if (!ALLOWED_MIME_TYPES.includes(file.type)) {
  return NextResponse.json(
    { error: `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF.` },
    { status: 400 }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/events/upload-image/route.ts
git commit -m "fix(upload): validate image MIME type server-side

Rejects non-image uploads. Allows JPEG, PNG, WebP, GIF."
```

### Task 20: Fix notification upsert — missing unique constraint

**Files:**
- Migration: `supabase/migrations/20260315000001_soft_delete_and_reviews.sql` (add to existing migration)

The admin status endpoint uses `.upsert({...}, { onConflict: "user_id,event_id,type" })` but **no unique constraint exists** on `notifications(user_id, event_id, type)`. The only constraint is the PK on `id`. This means every approval/rejection creates a duplicate notification instead of updating the existing one.

- [ ] **Step 1: Add unique constraint to notifications**

Add to the migration file:

```sql
-- Fix: notification upsert requires a unique constraint
CREATE UNIQUE INDEX idx_notifications_user_event_type
  ON notifications (user_id, event_id, type)
  WHERE event_id IS NOT NULL;
```

This is a partial unique index (only applies when `event_id` is not null) to avoid conflicts with non-event notifications.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "fix(notifications): add unique constraint for upsert support

The admin status endpoint uses upsert with onConflict user_id,event_id,type
but no such constraint existed. Duplicate notifications were created."
```

### Task 21: Update CLAUDE.md — fix incorrect table name

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix `event_rsvps` → `rsvps` in CLAUDE.md**

The Database Schema section lists `event_rsvps` but the live DB table is `rsvps`. Update:

```markdown
- `rsvps` — going/interested/cancelled (was incorrectly documented as event_rsvps)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix incorrect table name in CLAUDE.md (event_rsvps → rsvps)"
```

### Task 22: QA pass — verify both streams end-to-end

- [ ] **Step 1: Test standalone event creation**

1. Navigate to `/create-event` (no clubId)
2. Fill all fields, submit
3. Verify event status is "pending"
4. Verify event appears in `/my-events` with pending badge
5. Approve in moderation dashboard
6. Verify notification received
7. Verify event now appears in public feed

- [ ] **Step 2: Test club event creation**

1. Navigate to club dashboard → Events tab → Create Event
2. Verify URL is `/create-event?clubId=xxx`
3. Verify breadcrumb shows "Dashboard > Club Dashboard > Create Event"
4. Fill all fields, submit
5. Verify event status is "approved" (auto-approved)
6. Verify event appears in club events table with correct date, RSVP counts
7. Edit the event → verify end date is pre-filled
8. Delete the event → verify it disappears from all feeds

- [ ] **Step 3: Test rejection/appeal flow**

1. Create standalone event
2. Reject it from moderation with category + reason
3. Verify creator gets notification with reason text
4. View in `/my-events` → verify rejection reason displayed
5. Submit appeal with message
6. Verify event reappears in moderation queue with "Appeal" badge
7. Verify moderator can see full thread (rejection → appeal)

---

## What's Already Done (Rejection/Appeals Merge — 2026-03-15)

The rejection handling and appeals system was implemented and merged before this plan's execution began. The following tasks from this plan are **COMPLETE** and should be skipped:

| Plan Task | Status | Notes |
|---|---|---|
| **Migration 2** (moderation_reviews table) | DONE | `20260315000001_moderation_reviews.sql` — includes table, indexes, RLS with ownership-scoped appeal policy |
| **Migration 3** (appeal_count) | DONE | Added to events + clubs |
| **Task 12** (rejection reason in moderation flow) | DONE | Status endpoint requires category + message; inserts into moderation_reviews; notification includes reason |
| **Task 14** (appeal endpoint) | DONE | `POST /api/events/[id]/appeal` + `POST /api/clubs/[id]/appeal` |
| **Task 15** (appeal UI in organizer views) | DONE | Rejection banner, ReviewThread, AppealForm on event detail + club dashboard |
| **Task 16** (appeal badge in moderation) | DONE | AppealBadge component, appeals filter, dedicated `/moderation/appeals` page, dashboard stat card |

### What the merge did NOT address (still needed):

| Plan Task | Status | Why |
|---|---|---|
| **Task 1** (main events API missing status filter) | NOT DONE | Public feed still shows pending/rejected events |
| **Task 2** (club events API wrong ORDER BY column) | NOT DONE | Still orders by `event_date` |
| **Task 3** (ClubEventsTab wrong field names) | NOT DONE | Still uses `event_date` everywhere |
| **Task 4** (edit mode end date not restored) | NOT DONE | End date still blank in edit |
| **Task 5** (image upload failure silent data loss) | NOT DONE | Still silently removes image |
| **Task 6** (PATCH permissions) | NOT DONE | Creators still can't edit own events |
| **Migration 1** (deleted_at column) | NOT DONE | No soft delete column yet |
| **Task 7** (schema migration for deleted_at) | NOT DONE | Only appeal_count + moderation_reviews were migrated |
| **Task 8** (Event type alignment) | PARTIALLY DONE | `appeal_count` added but `event_date`/`event_time` still wrong, phantom fields remain |
| **Task 9** (deleted_at filters on 18 queries) | NOT DONE | Depends on migration |
| **Task 10** (soft delete) | NOT DONE | No endpoint, no button wiring |
| **Task 11** (/my-events page) | NOT DONE | Still redirects to calendar |
| **Task 13** (pending auto-expiry filter) | NOT DONE | Moderation queue still shows past events |
| **Tasks 17-22** (polish) | NOT DONE | Breadcrumb, classifyTags, MIME validation, notification constraint, CLAUDE.md |

### Design decisions from the merge that differ from this plan:

| This Plan | Merge Implementation | Resolution |
|---|---|---|
| 3-appeal cap | Unlimited appeals | Keep unlimited per Ady's decision — remove cap from Task 14 |
| Atomic RPC for appeal_count | Direct update `appeal_count: event.appeal_count + 1` | Acceptable for current traffic — race condition is theoretical at single-moderator scale |
| `insert` for notifications | Uses `insert` (not upsert) — each rejection = distinct notification | Correct. The plan's Task 20 (unique constraint) should be reconsidered — upsert may not be desired |

---

## Revised Implementation Order

With the appeals system already merged, the remaining work is:

| Phase | Tasks | Est. Time | Dependencies |
|---|---|---|---|
| **1 — Critical Bugs** | Tasks 1-6 | 1-2 days | None |
| **2 — Schema + Types** | Tasks 7-9 (deleted_at + Event type fix only) | 1 day | Phase 1 merged |
| **3 — Core Features** | Tasks 10, 11, 13 | 2-3 days | Phase 2 |
| **4 — Polish** | Tasks 17-19, 21-22 | 1 day | Phase 3 |
| **Total** | | **~5-7 dev days** | |

Task 20 (notification unique constraint) is **deprioritized** — the merge chose `insert` over `upsert`, so duplicate prevention is no longer needed. If the admin status endpoint is later changed back to upsert, add the constraint then.

Phases 3-4 can be parallelized: soft delete (Task 10) and my-events (Task 11) are independent of each other and of moderation auto-expiry (Task 13).
