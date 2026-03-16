# Admin Enforcement — Suspensions, Bans & Organizer Directory

**Date:** 2026-03-16
**Status:** Draft
**Approach:** Extend existing moderation pages (Approach A)

## Problem

Admins can approve or reject pending content but cannot take action on already-approved events/clubs. There is no mechanism to ban users, view organizer contact information, or suspend live content with an appeal pathway.

## Scope

1. **Suspend approved events/clubs** — reversible takedown that hides content from public view
2. **Ban users** — temporary (7/30/90 days) or permanent, with optional auto-suspension of user's content
3. **View organizer contact emails** — on clubs page and a dedicated organizer directory
4. **Appeal flow for suspensions** — reuse existing appeal system; suspended items follow same path as rejected items
5. **Flat admin permissions** — all admins can perform all actions (tiering deferred to future work)

## Data Model Changes

### Events & Clubs — new `suspended` status

Add `"suspended"` to the status enum: `pending | approved | rejected | suspended`.

Note: The `Club` interface already has a `"deleted"` status value, so clubs will have 5 possible statuses: `pending | approved | rejected | suspended | deleted`.

**TypeScript type updates required:**
- `Event.status` in `src/types/index.ts` — add `"suspended"`
- `Club.status` in `src/types/index.ts` — add `"suspended"`
- Regenerate `src/lib/supabase/types.ts` after DB migration

Behavior:
- Suspended items are hidden from public queries (same as rejected)
- Suspension creates a `moderation_reviews` record with action `"suspension"` and includes category and reason message
- Users can appeal suspensions the same way they appeal rejections — status returns to `pending`

**`ModerationAction` type update:** Add `"suspension"` and `"unsuspension"` to the `ModerationAction` union type in `src/types/index.ts` (currently `"rejection" | "appeal" | "approval"`).

### Users table — ban fields

New columns on the `users` table:

| Column | Type | Description |
|--------|------|-------------|
| `banned_at` | `timestamp \| null` | When the ban was applied; null = not banned |
| `ban_expires_at` | `timestamp \| null` | When the ban expires; null = permanent |
| `ban_reason` | `text \| null` | Admin-provided reason shown to the user |
| `banned_by` | `uuid \| null` | Admin who applied the ban (FK to users) |

A user is actively banned when `banned_at IS NOT NULL` and either `ban_expires_at IS NULL` (permanent) or `ban_expires_at > now()` (temporary, not yet expired).

On unban, only `banned_at` and `ban_expires_at` are cleared. `ban_reason` and `banned_by` are preserved for historical reference. The audit log remains the primary source of truth for ban history.

### Audit log — new action types

Extend the `AuditAction` type in `src/lib/audit.ts` (currently `"approved" | "rejected" | "created" | "updated" | "deleted" | "bulk_approved" | "bulk_rejected"`) with:
- `suspended` — event or club suspended
- `unsuspended` — admin restores a suspended item without appeal
- `banned` — user banned
- `unbanned` — admin lifts a ban

### Notifications — new types

- `event_suspended` / `club_suspended` — sent to creator with reason
- `user_banned` — sent to banned user with reason and duration
- `user_unbanned` — sent when ban is lifted

## API Routes

### Event/Club Suspension

Extend existing routes:

**`PATCH /api/admin/events/[id]/status`** — accept `status: "suspended"` alongside existing `approved`/`rejected`:
- Requires `reason` (text) and `category` (RejectionCategory)
- Creates `moderation_reviews` record with action `"suspension"`
- Sends `event_suspended` notification to creator
- Logs `suspended` audit action

**`PATCH /api/admin/clubs/[id]`** — same pattern for clubs.
- **Important:** The existing club route has a `pending`-only guard (`if (club.status !== "pending") return 409`). This must be relaxed to allow `approved → suspended` and `suspended → approved` transitions. Update the guard to validate allowed state transitions instead of requiring `pending` status.

**Unsuspending:** Admin sets status back to `approved` via the same route. Creates `moderation_reviews` record with action `"unsuspension"`. Logs `unsuspended` audit action.

### User Bans

**`POST /api/admin/users/[id]/ban`**
```typescript
{
  reason: string;            // required — shown to user
  duration_days?: number;    // omit for permanent; must be positive integer, validated server-side
  suspend_content?: boolean; // true = also suspend user's approved events/clubs
}
```
- Validates `duration_days` is a positive integer if provided (rejects 0, negative, or fractional values)
- Sets `banned_at`, `ban_expires_at`, `ban_reason`, `banned_by` on users table
- If `suspend_content: true`, runs in a single Postgres transaction: batch-updates all user's approved events and clubs to `suspended` status, creating `moderation_reviews` records for each. If the transaction fails, the entire operation (including the ban itself) rolls back.
- Sends `user_banned` notification
- Logs `banned` audit action with metadata including duration and content suspension flag

**`DELETE /api/admin/users/[id]/ban`**
- Clears `banned_at` and `ban_expires_at` (preserves `ban_reason` and `banned_by` for history)
- Sends `user_unbanned` notification
- Logs `unbanned` audit action
- Does NOT auto-unsuspend content — admin decides separately

### Organizer Directory

**`GET /api/admin/organizers`**
- Primary filter: users where `users.roles` array contains `'club_organizer'`
- Club join: via `club_members` table where `club_members.role = 'owner'` to find which clubs each organizer manages (note: `users.roles` and `club_members.role` are separate role systems)
- Includes user email from the `users` table
- Supports `?search=` query param for name/email filtering
- Supports `?status=active|banned` filtering

### Appeal Routes

The existing appeal routes (`POST /api/events/[id]/appeal` and `POST /api/clubs/[id]/appeal`) currently have a hard check: `if (event.status !== "rejected") return 409`. **This must be updated** to also allow `suspended` status: `if (!["rejected", "suspended"].includes(event.status)) return 409`. Same change for clubs.

## Middleware & Ban Enforcement

### middleware.ts changes

**Performance approach:** To avoid adding a database query to every request, use a short-TTL cookie (`x-ban-status`) to cache ban state:

1. On each request, check for the `x-ban-status` cookie
2. If cookie exists and is not expired (60-second TTL), use its value
3. If cookie is missing or expired, query `banned_at` and `ban_expires_at` from the `users` table, set the cookie with the result
4. If actively banned, redirect to `/banned`
5. Skip ban check for `/banned`, `/auth/signout`, and static assets

This limits the DB query to once per 60 seconds per user instead of every request.

### /banned page

Server component that reads ban fields (`ban_reason`, `ban_expires_at`) directly from the `users` table server-side (no API call needed — uses the server Supabase client). Displays:
- "Account Suspended" heading
- Ban reason
- Expiry date (or "Permanent") with countdown
- Sign-out button
- No sidebar/header/footer (minimal layout like `/landing`)

No appeal mechanism from this page — appeals handled through separate support channel.

### API protection

All content-creating/modifying API routes should check ban status to prevent direct API usage by banned users. Add a `checkBanStatus()` utility in `src/lib/ban.ts` that returns 403 if the user is banned.

### Auto-expiry

No cron job needed. The middleware check uses `ban_expires_at > now()` so temporary bans expire naturally on next access. Optionally, a periodic cleanup query can clear stale `banned_at`/`ban_expires_at` fields for hygiene.

## UI Changes

### Existing pages — modifications

**`/moderation/events` and `/moderation/clubs`:**
- Add "Suspended" filter tab (amber/yellow themed)
- Add "Suspend" button on approved event/club rows
- Add "Restore" button on suspended event/club rows
- Suspended rows highlighted with amber background

**`/moderation/clubs`:**
- Add organizer email column to the table
- Email displayed as clickable mailto link

**`/moderation/users`:**
- Add "Ban" button per user row
- Show ban status badge (active ban with remaining time, or permanent)
- Add "Unban" button for banned users

**`/moderation/appeals`:**
- No changes needed — suspended items that are appealed return to pending status and appear automatically

### New components

**`SuspensionModal.tsx`** (reuses RejectionModal pattern):
- Category dropdown (same rejection categories)
- Reason text area
- Confirm/cancel buttons
- Amber/yellow themed

**`BanUserModal.tsx`:**
- Duration picker: 7 days, 30 days, 90 days, Permanent (pill buttons)
- Reason text area
- Checkbox: "Also suspend all of this user's approved events and clubs"
- Confirm/cancel buttons
- Red themed

### New pages

**`/moderation/organizers`:**
- Search bar (name/email)
- Filter tabs: All Organizers, Active, Banned
- Card-based layout per organizer showing:
  - Avatar (initials), name, email
  - Clubs they manage (as badges)
  - Activity stats (joined date, events created, last active)
  - Ban/Unban action button
  - Ban info for banned organizers (ban date, reason, expiry)

**`/banned`:**
- Server component reading ban fields directly from DB
- Centered layout with ban icon
- "Account Suspended" heading
- Reason and expiry info card
- Sign-out button
- No sidebar/header/footer (minimal layout like `/landing`)

### Sidebar navigation

Add "Organizers" link to the moderation sidebar between "Users" and "Featured".

## Testing Strategy

- Unit tests for ban status checking utility (`isBanned()` helper)
- API route tests for suspend/unsuspend, ban/unban endpoints
- API route test for `duration_days` validation (rejects 0, negative, fractional)
- Middleware test for ban enforcement redirect and cookie caching
- Integration test for appeal flow on suspended items (verify appeal routes accept `suspended` status)
- Transaction test for batch content suspension on ban (verify rollback on failure)
