# Event Editing & Re-Approval Design

## Problem

Events need to be editable after creation, but unmoderated edits on standalone user events create a content moderation gap — users could change titles to offensive content or swap images for inappropriate material after approval.

Club events don't have this concern because club organizers are trusted (their clubs went through approval).

## Solution

Two-tier editing system:

1. **Club events**: Club members edit freely, all changes apply immediately
2. **Standalone user events**: Safe fields apply immediately; moderated fields (title, image) are stored as pending edits that require admin approval before going live

## Data Model

### New column: `events.pending_edits`

- Type: JSONB, nullable, default `null`
- Shape: `{ title?: string, image_url?: string, submitted_at: string }`
- `null` = no pending edits; non-null = awaiting admin review
- `submitted_at` is an ISO 8601 timestamp for ordering in the moderation queue

### TypeScript updates

Add `pending_edits` to:
- `Event` interface in `src/types/index.ts`: `pending_edits?: { title?: string; image_url?: string; submitted_at: string } | null`
- Regenerate `src/lib/supabase/types.ts` to include the new column

### Field classification

| Field | Moderated? | Notes |
|-------|-----------|-------|
| `title` | Yes | Visible publicly, primary abuse vector |
| `image_url` | Yes | Visible publicly, primary abuse vector |
| `description` | No | Applied directly — less prominent than title; moderation can be added later if needed |
| `start_date` | No | Applied directly |
| `end_date` | No | Applied directly |
| `location` | No | Applied directly |
| `tags` | No | Applied directly |
| `category` | No | Applied directly |
| `is_free` | No | Applied directly |
| `price` | No | Applied directly |
| `rsvp_link` | No | Applied directly |

### Behavior by event type and status

| Event Type | Status | Moderated fields | Safe fields |
|-----------|--------|-------------------|-------------|
| Club event | Any | Applied directly | Applied directly |
| Standalone | Pending | Applied directly | Applied directly |
| Standalone | Approved | Written to `pending_edits` | Applied directly |
| Standalone | Rejected | Not editable (use appeal flow) | Not editable (use appeal flow) |

## API Changes

### `PATCH /api/events/[id]` — Updated logic

Current: Only allows editing pending events owned by the user.

New: Creators can edit **pending and approved** standalone events. Club members can edit any of their club's events.

1. **Auth check**: User must be the creator OR a member of the event's club OR an admin
2. **Rejected events**: Return 403 — rejected events must go through the appeal flow, not direct editing
3. **Club events**: If event has `club_id` and user is a member of that club → apply all edits directly to live columns
4. **Standalone approved events**: Split the request:
   - `title`, `image_url` → merge into `pending_edits` JSONB column (with `submitted_at` timestamp)
   - All other fields → apply directly to live columns
5. **Standalone pending events**: All edits applied directly (already awaiting review)
6. **Admin edits**: Always applied directly regardless of field or event type. If admin directly edits `title` or `image_url`, also clear `pending_edits` to prevent stale pending edits from overwriting the admin's change later

**Important**: `pending_edits` must NOT be in the `EDITABLE_FIELDS` list — it is only written programmatically, never directly by users.

Response includes `pending_edits` field and message `"Some changes require admin approval"` when moderated fields are queued.

### New: `PATCH /api/admin/events/[id]/edits`

Admin-only endpoint to approve or reject pending edits.

**Request body:**
```json
{
  "action": "approve" | "reject",
  "reason": "string (required for reject)"
}
```

**On approve:**
1. Copy each field from `pending_edits` into the live columns
2. Set `pending_edits` to `null`
3. Notify creator (type: `edit_approved`): "Your edits to [title] have been approved"
4. Log to `admin_audit_log`

**On reject:**
1. Set `pending_edits` to `null`
2. Notify creator (type: `edit_rejected`) with rejection reason
3. Log to `admin_audit_log`

## Frontend Changes

### My Events page (`/my-events`)

- Show edit button on **approved** events (currently only on pending)
- Show "Pending review" badge on events with non-null `pending_edits`

### EventDetailView

- Show "Edit" button if current user is the event creator
- Show banner "You have edits awaiting approval" if `pending_edits` is non-null

### CreateEventForm (edit mode)

- Pre-fill moderated fields with `pending_edits` values if they exist (so user sees what they last submitted), safe fields with live values
- Show notice on moderated fields if pending edits exist: "Your previous change is awaiting review"
- After submit on approved standalone events: toast message distinguishing immediately-applied changes vs. pending review changes

### Moderation queue (`/moderation/pending`)

- **Query change**: Fetch events where `status = 'pending' OR pending_edits IS NOT NULL`
- Events with `pending_edits` appear with an "Edit Review" label to distinguish from new pending events
- Show diff view: current live title/image alongside proposed title/image
- Approve/reject buttons act on the edit only (event stays approved) — these hit `PATCH /api/admin/events/[id]/edits`, NOT the existing status endpoint
- Order by `pending_edits->>'submitted_at'` for edit reviews

### Club event editing

- ClubEventsTab: ensure edit buttons are present for all club members
- All edits apply immediately with no pending state

## Edge Cases

- **Overwriting pending edits**: If user submits new edits while previous ones are pending, `pending_edits` is overwritten with new values and a fresh `submitted_at` (last write wins)
- **Mixed request**: Safe fields applied immediately, moderated fields go to `pending_edits` — single request handles both
- **Event deleted while edits pending**: `pending_edits` cleared as part of deletion
- **Admin directly edits title/image via existing admin route**: Clear `pending_edits` to prevent stale user edits from overwriting admin's change
- **Viewing event with pending edits**: Public sees live (old) title/image; creator sees indication that edits are pending
- **Orphaned images**: If a user uploads a new image that goes to `pending_edits` and the edit is rejected, the uploaded image remains in storage. Accepted as minor storage waste — no cleanup mechanism needed for now.

## Notifications

| Trigger | Type | Recipient | Message |
|---------|------|-----------|---------|
| Admin approves edits | `edit_approved` | Event creator | "Your edits to [title] have been approved" |
| Admin rejects edits | `edit_rejected` | Event creator | "Your edits to [title] were rejected: [reason]" |

## Migration

```sql
ALTER TABLE events ADD COLUMN pending_edits JSONB DEFAULT NULL;

-- RLS: pending_edits is part of the events row, so existing RLS policies apply.
-- Ensure select policies do NOT expose pending_edits to non-creator, non-admin users.
-- The API layer handles this by stripping pending_edits from public responses.
```
