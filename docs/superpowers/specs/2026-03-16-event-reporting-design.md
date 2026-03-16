# Event Reporting Feature Design

## Summary

Allow any authenticated user to report an event for moderation review. Reports appear in a new "Reports" tab on the moderation dashboard where admins can review and take action.

## Database

### New table: `event_reports`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `event_id` | uuid (FK → events.id) | Required |
| `reporter_id` | uuid (FK → auth.users.id) | Required |
| `category` | text | One of REJECTION_CATEGORIES keys |
| `message` | text | Optional free-text elaboration |
| `status` | text | `pending` / `reviewed` / `dismissed`, default `pending` |
| `reviewed_by` | uuid (FK → auth.users.id) | Nullable, set when admin acts |
| `reviewed_at` | timestamptz | Nullable, set when admin acts |
| `created_at` | timestamptz | Default `now()` |

- Unique constraint on `(event_id, reporter_id)` — one report per user per event
- RLS: authenticated users can INSERT their own reports, admins can SELECT/UPDATE all

## API Routes

### `POST /api/events/[id]/report`

- Auth: any authenticated user
- Body: `{ category: string, message?: string }`
- Validates event exists and has `status = 'approved'` — returns 404 otherwise
- Prevents self-reporting (reporter cannot be event organizer) — returns 403
- Validates category against REJECTION_CATEGORIES keys
- Returns 409 if user already reported this event
- Returns 201 on success
- Sanitizes message text (reuse existing `sanitizeText`)

### `GET /api/admin/reports`

- Auth: admin only (via `verifyAdmin()`)
- Query params: `status` (pending/reviewed/dismissed), `event_id`, `limit`, `offset`
- Returns reports joined with event data (title, id) and reporter info (display_name)
- Includes `report_count` per event (computed via subquery/group)
- Excludes reports for soft-deleted events by default
- Ordered by `created_at` DESC

### `PATCH /api/admin/reports/[id]`

- Auth: admin only
- Body: `{ status: "reviewed" | "dismissed" }`
- Sets `reviewed_by` and `reviewed_at`
- Logs to `admin_audit_log` via `logAdminAction()`

## User-Facing UI

### Report button in EventDetailView

- Placement: below the existing share/save actions area
- Style: small, muted — `text-muted-foreground text-xs` with a `Flag` icon from Lucide
- Text: "Report" (or "Reported" with check icon if already submitted)
- Only visible to authenticated users

### Report dialog

- Opens on click of the report button
- Category selector: radio group or select using REJECTION_CATEGORIES (with human-readable labels)
- Optional message textarea (max 500 chars)
- Submit button
- Shows success toast on submission

## Moderation Dashboard

### New "Reports" tab

- Added to `ModerationNav` under the Content group (after Appeals)
- Route: `/moderation/reports`
- Nav item shows pending report count badge

### Reports page (`/moderation/reports/page.tsx`)

- Status filter tabs: All / Pending / Reviewed / Dismissed
- Each report card shows:
  - Event title (linked to event)
  - Report category (badge)
  - Reporter name
  - Message (if provided)
  - Timestamp
  - Number of total reports for that event
- Actions per report:
  - "Dismiss" — marks report as dismissed
  - "Review" — marks as reviewed (admin then navigates to event to take action if needed)
- Groups or highlights events with multiple reports

## Types

Add to `src/types/index.ts`:

```typescript
export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface EventReport {
  id: string;
  event_id: string;
  reporter_id: string;
  category: RejectionCategory;
  message: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
```

## Integration with Existing Patterns

- Reuses `REJECTION_CATEGORIES` from `src/types/index.ts` — no new category enum
- Reuses `verifyAdmin()` from `src/lib/admin.ts` for admin routes
- Reuses `logAdminAction()` from `src/lib/audit.ts` for audit trail
- Reuses `sanitizeText()` for user-submitted message content
- Follows existing moderation page patterns (layout, styling, filtering)
- Extends `AuditAction` with `"report_reviewed"` and `"report_dismissed"`
- Extends `AuditTargetType` with `"event_report"`
- Regenerate `lib/supabase/types.ts` after migration

## Out of Scope

- Reporting clubs (can be added later with same pattern)
- Auto-hiding events after N reports (manual moderator review only)
- Email notifications to moderators on new reports
- Notifying event organizer when their event is reported
