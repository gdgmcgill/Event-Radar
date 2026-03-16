# Event Feedback Requests Design

## Overview

Automated system that prompts event attendees to leave feedback after events end. A cron job detects recently-ended events, identifies "going" RSVP users, and sends in-app notifications linking them to the existing review form on the event detail page.

## Goals

- Increase post-event feedback rates by proactively prompting attendees
- Zero manual effort from organizers — fully automated
- Reuse existing review infrastructure (no new forms or pages)
- Clean extension points for future email, push, and reminder nudges

## Non-Goals

- Email or push notification delivery (future)
- Follow-up reminders for non-respondents (future)
- New feedback form or UI — existing star rating + comment review is sufficient
- Organizer-triggered manual feedback requests

## Database

### New Table: `feedback_request_log`

Deduplication log preventing duplicate feedback notifications per user per event.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users` ON DELETE CASCADE, NOT NULL |
| `event_id` | uuid | FK → `events` ON DELETE CASCADE, NOT NULL |
| `request_type` | text | NOT NULL, default `'post_event'`, CHECK IN (`'post_event'`, `'post_event_reminder'`) |
| `sent_at` | timestamptz | NOT NULL, default `now()` |

**Unique constraint:** `(user_id, event_id, request_type)`

**RLS:** Enabled. Policies mirror `email_reminder_log`:
- Users can SELECT their own rows (`user_id = auth.uid()`)
- Service role has full access (used by cron route)

**Indexes:**
- Primary key on `id`
- Unique index on `(user_id, event_id, request_type)` (enforces dedup)
- Index on `event_id` (for future aggregate queries like response rate)

### Existing Tables Used (No Changes)

- `events` — queried for recently-ended approved events
- `rsvps` — queried for users with `status = 'going'`
- `notifications` — new rows inserted with `type = 'feedback_request'`
- `reviews` — existing review form; no schema changes

## API Route

### `POST /api/cron/send-feedback-requests`

**Authentication:** `CRON_SECRET` Bearer token in Authorization header.

**Client:** `createServiceClient()` (bypasses RLS).

**Algorithm:**

1. **Find eligible events:**
   - `status = 'approved'`
   - `deleted_at IS NULL`
   - `start_date` is between 1 and 25 hours ago (using `start_date` for consistency with existing reviews route eligibility check)
   - The 1-hour floor avoids notifying during events still wrapping up
   - The 25-hour ceiling with hourly cron runs provides overlap for reliability

2. **For each eligible event, fetch attendees:**
   - Query `rsvps` where `event_id` matches and `status = 'going'`
   - Extract `user_id` list

3. **Deduplicate:**
   - Query `feedback_request_log` for entries matching `(user_id, event_id, request_type = 'post_event')`
   - Filter out already-notified users

4. **Insert notifications and log entries per-user** (mirrors `send-reminders` pattern):
   - For each eligible user, insert one notification and one `feedback_request_log` row
   - Per-row error isolation: if one user's insert fails, continue with remaining users
   - Duplicate guard: catch Postgres `23505` unique violation as fallback dedup
   - Notification fields:
     - `type`: `"feedback_request"`
     - `title`: `"How was {event.title}?"`
     - `message`: `"Share your experience — your feedback helps organizers improve future events."`
     - `event_id`: set (enables deep-link to event page)
     - `user_id`: the attendee
     - `read`: `false`
   - Log entry fields:
     - `user_id`, `event_id`, `request_type = 'post_event'`

5. **Return response:**
   ```json
   {
     "success": true,
     "events_processed": 4,
     "feedback_requests_sent": 12,
     "feedback_requests_skipped": 3
   }
   ```

**Error handling:** Per-user error isolation within each event. If a user's notification fails, log the error and continue with remaining users. Return counts of sent vs skipped vs errored.

**Scheduling:** Called every hour by external scheduler (Vercel cron). Idempotent due to dedup log.

## Frontend Changes

### Notification Rendering

The notification list component needs to handle the `"feedback_request"` type:

- **Icon:** `MessageSquare` from Lucide (or similar feedback-related icon)
- **Click behavior:** Navigate to the event detail page (using `event_id` from notification) — existing `event_id` link logic handles this
- **Implementation:** Add `feedback_request` entry to the `typeConfig` record in `NotificationItem.tsx` (icon, colors, label)
- **No other UI changes** — the event detail page already shows the review form for eligible users

### No New Pages or Components

The existing event detail page review section handles everything:
- Shows star rating + comment form when `can_review` is true
- `can_review` is true when: event ended + user RSVP'd going + no prior review
- After review submission, the form is replaced with the user's submitted review

## Type Definitions

### `src/types/index.ts`

Add interface:
```typescript
export interface FeedbackRequestLog {
  id: string;
  user_id: string;
  event_id: string;
  request_type: string;
  sent_at: string;
}
```

### `src/lib/supabase/types.ts`

Regenerate after migration to include `feedback_request_log` table types.

## Future Extension Points

### Reminder Nudge (Version B)

- Add `request_type = 'post_event_reminder'` to the cron logic
- Second pass: find users who got `'post_event'` 3+ days ago, haven't submitted a review, and haven't received `'post_event_reminder'`
- Same dedup pattern, no schema changes needed

### Email Delivery

- Add email service (Resend/SendGrid) call alongside notification insert in the cron route
- Optionally add `channel` column to `feedback_request_log` to track delivery method

### Mobile Push

- Same dispatch pattern as email — cron creates notification row + sends push
- `feedback_request_log` remains source of truth for what was sent

### Organizer Response Rate Dashboard

- Join `feedback_request_log` count against `reviews` count per event
- `ReviewAggregate` from existing `/api/events/[id]/reviews` GET already provides aggregate data

## Testing Strategy

- **Unit test for cron route:** Mock service client, verify correct event window query, RSVP filtering, dedup logic, and notification insertion
- **Edge cases:** Events with no "going" RSVPs, events with all attendees already notified, soft-deleted events excluded, duplicate `23505` violation handling
- **Integration:** Verify notification appears in feed and links to event page with review form visible
