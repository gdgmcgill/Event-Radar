# Rejection Handling & Appeals System

## Overview

Add rejection feedback and appeal workflows to the moderation pipeline for both events and clubs. Moderators must provide a categorized reason when rejecting, organizers can see the reason and appeal by editing and resubmitting with an appeal message, and both sides have full visibility into the review history thread.

## Database Schema

### New table: `moderation_reviews`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK (gen_random_uuid) | Primary key |
| `target_type` | TEXT NOT NULL | `'event'` or `'club'` |
| `target_id` | UUID NOT NULL | References an event or club (polymorphic — no FK constraint, validated by application) |
| `action` | TEXT NOT NULL | `'rejection'`, `'appeal'`, or `'approval'` |
| `category` | TEXT | Rejection category (null for appeals). CHECK constraint against allowed values |
| `message` | TEXT NOT NULL | Rejection reason or appeal message |
| `author_id` | UUID NOT NULL | The moderator (rejection) or organizer (appeal) |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

**CHECK constraints:**
- `action IN ('rejection', 'appeal', 'approval')`
- `target_type IN ('event', 'club')`
- `category` must be one of: `inappropriate_content`, `missing_information`, `duplicate`, `policy_violation`, `incorrect_details`, `other` — or NULL (for appeals/approvals)
- When `action = 'rejection'`, `category` must NOT be NULL
- When `action IN ('appeal', 'approval')`, `category` must be NULL

**Note on `target_id`:** This is a polymorphic reference — no database FK constraint is used since it can point to either `events` or `clubs`. Referential integrity is enforced at the application layer.

**Indexes:**
- `(target_type, target_id, created_at)` — for fetching review threads ordered chronologically

**RLS:**
- Admins can read/write all rows
- Non-admin users can read rows where they are the creator of the referenced target. Because `target_id` is polymorphic, the RLS policy uses a conditional subquery:
  ```sql
  -- Read policy for non-admins
  CREATE POLICY "Creators can view reviews of their items" ON moderation_reviews
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM auth.users u
        JOIN users prof ON prof.id = u.id
        WHERE u.id = auth.uid()
        AND 'admin' = ANY(prof.roles)
      )
      OR (
        (target_type = 'event' AND EXISTS (
          SELECT 1 FROM events WHERE id = target_id AND created_by = auth.uid()
        ))
        OR
        (target_type = 'club' AND EXISTS (
          SELECT 1 FROM clubs WHERE id = target_id AND created_by = auth.uid()
        ))
      )
    );
  ```
- Non-admin users can insert rows where `action = 'appeal'` and they are the creator of the target (similar conditional check)

### Modified tables

**`events`** — add column:
- `appeal_count` INT NOT NULL DEFAULT 0

**`clubs`** — add column:
- `appeal_count` INT NOT NULL DEFAULT 0

**`notifications`** — add column:
- `club_id` UUID REFERENCES clubs(id) ON DELETE CASCADE (nullable) — currently missing, needed for club-related notifications to link to the relevant club

**Note on `appeal_count`:** This is intentionally denormalized for query performance (filtering/sorting in moderation queues). It is maintained exclusively by the appeal API endpoints. The authoritative count can always be derived from `SELECT COUNT(*) FROM moderation_reviews WHERE target_id = X AND action = 'appeal'`.

## Rejection Categories

| Value | Display Label |
|-------|--------------|
| `inappropriate_content` | Inappropriate Content |
| `missing_information` | Missing Information |
| `duplicate` | Duplicate |
| `policy_violation` | Policy Violation |
| `incorrect_details` | Incorrect Details |
| `other` | Other |

## API Routes

### Modified: `PATCH /api/admin/events/[id]/status`

When `status = 'rejected'`:
- **New required fields:** `category` (string), `message` (string)
- Validates `category` is one of the 6 allowed values
- Validates `message` is non-empty
- Inserts a `rejection` row into `moderation_reviews` with the admin as `author_id`
- Enhanced notification includes category and reason (see Notifications section)
- Existing audit logging continues unchanged

**Additional change:** Add a status guard — reject the request if the event is already in the target status (e.g., rejecting an already-rejected event). This aligns with the existing guard on the clubs route and prevents duplicate moderation actions.

When `status = 'approved'`:
- If the item has `appeal_count > 0`, insert an `approval` row into `moderation_reviews` to close the thread
- Existing approval flow otherwise unchanged

### Modified: `PATCH /api/admin/clubs/[id]`

Same changes as event rejection above, applied to club rejections. The existing status guard (`club.status !== 'pending'` → 409) is already compatible with the appeal flow — after an appeal sets status back to `pending`, the moderator can review again normally.

### New: `POST /api/events/[id]/appeal`

**Auth:** Authenticated user who is the event creator
**Body:** `{ message: string }` (required, non-empty)
**Flow:**
1. Fetch event, verify caller is `created_by`
2. Verify event status is `rejected`
3. Insert `appeal` row into `moderation_reviews`
4. Update event: `status = 'pending'`, `appeal_count = appeal_count + 1`
5. Send `event_appeal` notification to all admin users
6. Return 200 with updated event

**Errors:**
- 403: Not the event creator
- 409: Event is not in `rejected` status
- 400: Missing or empty message

### New: `POST /api/clubs/[id]/appeal`

Same flow as event appeal, adapted for clubs:
- Verify caller is club `created_by`
- Verify club status is `rejected`
- Notification type: `club_appeal`

### New: `GET /api/moderation/reviews/[targetType]/[targetId]`

**Auth:** Admin users OR the creator of the target event/club
**Params:**
- `targetType`: `'event'` or `'club'`
- `targetId`: UUID
**Response:** Array of `moderation_reviews` rows ordered by `created_at` ASC, each enriched with `author_name` (joined from `users` table)

## Notifications

### Enhanced existing types

**`event_rejected`** (to event creator):
- Title: "Event Not Approved"
- Message: `Your event "{title}" was not approved. Reason: {display_category} — {message}`
- `event_id` set to the event

**`club_rejected`** (to club creator):
- Title: "Club Not Approved"
- Message: `Your club "{name}" was not approved. Reason: {display_category} — {message}`
- `club_id` set to the club (uses the new `club_id` column on `notifications`)

### New notification types

**`event_appeal`** (to all admin users):
- Title: "Event Appeal Submitted"
- Message: `An appeal was submitted for event "{title}"`
- `event_id` set to the event

**`club_appeal`** (to all admin users):
- Title: "Club Appeal Submitted"
- Message: `An appeal was submitted for club "{name}"`
- `club_id` set to the club

### Notification insert strategy

Existing event rejection notifications use `upsert` with `onConflict: "user_id,event_id,type"`, which would overwrite previous rejection notifications on re-rejection. Change to `insert` for rejection notifications so each rejection appears as a distinct notification entry. Appeal and approval notifications also use `insert`.

## UI Changes

### Moderator Side

#### Rejection Modal (replaces simple confirm dialog)

Used on `/moderation/pending`, `/moderation/events`, `/moderation/clubs`:
- Category dropdown (required) — 6 predefined options with display labels
- Free-text reason textarea (required)
- Character guidance (no hard limit, but suggest keeping under 500 chars)
- "Reject" button submits both fields

#### Appeal Badge

On pending items in moderation queues:
- Visual badge when `appeal_count > 0` (e.g., "Appeal" or "Appeal #2")
- Clicking opens the full review thread in a side panel or expandable section

#### Appeals Filter

On `/moderation/pending` and `/moderation/events`:
- New filter option: "Appeals only" — filters to items where `appeal_count > 0` and `status = 'pending'`

#### Dedicated Appeals Page: `/moderation/appeals`

- Lists all pending events and clubs that are appeals (`appeal_count > 0`, `status = 'pending'`)
- Combined view (events + clubs) with type indicator
- Each row shows: item name, type (event/club), appeal count, latest appeal message preview, submitted date
- Clicking opens the item with full review thread visible

### Organizer Side

#### Rejection Banner

On the organizer's view of their rejected event/club:
- Prominent banner showing rejection status
- Displays: category label, rejection reason message, moderator name, timestamp
- "Appeal" button

#### Appeal Form

Triggered by the "Appeal" button on a rejected item:
- Text area for appeal message (required)
- Guidance text: "Explain what you've changed and why the item should be reconsidered"
- Submit sends the appeal API request
- On success: redirects/refreshes to show the item is now pending again

#### Review History Thread

Visible on the event/club detail page (for the creator):
- Chronological thread of all rejections and appeals
- Each entry shows:
  - Role label: "Moderator" or "You"
  - Action type: rejection (with category tag), appeal, or approval
  - Message text
  - Timestamp
- Most recent entry at the bottom
- Approval entries show as a resolution record closing the thread

### Note on edit enforcement

The appeal flow does not enforce that the organizer actually edited the event/club before appealing — only the appeal message is required. This is an honor-system approach. Server-side edit detection (comparing field snapshots) would add significant complexity for marginal benefit. The appeal message guidance ("Explain what you've changed") sets the expectation.

## Data Flow

```
1. Organizer submits event/club → status: pending
2. Moderator reviews → approves (done) OR rejects:
   - Picks category + writes reason
   - moderation_reviews row inserted (action: 'rejection')
   - Status → rejected
   - Notification sent to creator with reason
3. Organizer sees rejection with reason → appeals:
   - Edits the item as needed
   - Writes appeal message
   - moderation_reviews row inserted (action: 'appeal')
   - Status → pending, appeal_count++
   - Notification sent to admins
4. Moderator sees item in queue with "Appeal #N" badge
   - Can view full review thread (all rejections + appeals)
   - Approves → moderation_reviews row inserted (action: 'approval'), thread closed
   - OR rejects again (back to step 2)
5. Cycle repeats unlimited times
```

## Files to Create/Modify

### New files:
- `supabase/migrations/XXX_add_moderation_reviews.sql` — migration for new table + altered columns
- `src/app/api/events/[id]/appeal/route.ts` — event appeal endpoint
- `src/app/api/clubs/[id]/appeal/route.ts` — club appeal endpoint
- `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` — review thread endpoint
- `src/app/moderation/appeals/page.tsx` — dedicated appeals page
- `src/components/moderation/RejectionModal.tsx` — shared rejection modal component
- `src/components/moderation/ReviewThread.tsx` — shared review history thread component
- `src/components/moderation/AppealBadge.tsx` — appeal badge component
- `src/components/AppealForm.tsx` — organizer-facing appeal form

### Modified files:
- `src/lib/supabase/types.ts` — add `moderation_reviews` table types, update `events`/`clubs` with `appeal_count`
- `src/app/api/admin/events/[id]/status/route.ts` — require category + message on rejection
- `src/app/api/admin/clubs/[id]/route.ts` — require category + message on rejection
- `src/app/moderation/pending/page.tsx` — use RejectionModal, show AppealBadge, add appeals filter
- `src/app/moderation/events/page.tsx` — use RejectionModal, show AppealBadge, add appeals filter
- `src/app/moderation/clubs/page.tsx` — use RejectionModal, show AppealBadge
- `src/app/moderation/page.tsx` — add appeals count/link to dashboard
- `src/types/index.ts` — add rejection category type, moderation review type
- `src/app/events/[id]/EventDetailClient.tsx` — add rejection banner, appeal button, review thread (for event creator)
- `src/app/my-clubs/[id]/page.tsx` — add rejection banner, appeal button, review thread (for club owner)
- `src/app/clubs/[id]/page.tsx` — show rejection status on public club page (for club creator only)
