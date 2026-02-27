# PR: Bulk Select + Approve/Reject for Admin Pending Queue

**Branch:** `128-bulk-actions-admin`  
**Date:** 2026-02-26  
**Closes:** #128

---

## Summary

The admin pending queue previously handled events one at a time. This PR adds bulk selection with shared approve/reject actions to reduce the time admins spend processing a backlog of pending events.

---

## Files Changed

| File                                            | Change                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/app/api/admin/events/bulk-status/route.ts` | **New** — `POST /api/admin/events/bulk-status` endpoint                         |
| `src/app/admin/pending/page.tsx`                | **Modified** — bulk selection UI, toolbar, shared reject dialog, error feedback |

---

## Feature Breakdown

### 1. `POST /api/admin/events/bulk-status`

Accepts an array of event IDs and a target status, performs a single batched Supabase `.update().in().eq()` query, then fires individual notifications to each event creator (best-effort).

**Request body**

```json
{
  "ids": ["uuid-1", "uuid-2"],
  "status": "approved" | "rejected",
  "reason": "string (required when status = rejected)"
}
```

**Responses**
| Status | Body | Condition |
|---|---|---|
| `200` | `{ success: true, count: N }` | All matching events updated |
| `400` | `{ error: "Invalid JSON body" }` | Malformed request body |
| `400` | `{ error: "ids must be a non-empty array" }` | `ids` missing, not an array, or empty |
| `400` | `{ error: "Invalid status" }` | `status` not `approved` or `rejected` |
| `400` | `{ error: "A rejection reason is required" }` | `status = rejected` with no/whitespace reason |
| `403` | `{ error: "Forbidden" }` | Caller is not an admin |
| `500` | `{ error: "..." }` | Supabase error |

### 2. Checkboxes on each pending event card

- Native `<input type="checkbox">` rendered at the top-left of each card header
- `aria-label="Select {event.title}"` for screen-reader accessibility
- Selected cards are highlighted with `ring-2 ring-primary`
- Card body content is offset with `pl-10` so text alignment is unchanged regardless of checkbox presence

### 3. Select All checkbox in the toolbar

- Renders an indeterminate state (`el.indeterminate = true`) via a `ref` callback when some — but not all — events are checked
- Clicking while indeterminate selects all
- Clicking while all are selected deselects all

### 4. Selection count display

- `{n} selected` text appears in the toolbar whenever at least one event is checked
- Count updates immediately on every individual toggle or Select All toggle

### 5. Bulk Approve

- **Approve Selected** button is disabled when `selectedIds.size === 0` or a request is in flight
- Takes a snapshot of `selectedIds` at call time to avoid any closure staleness if state changes mid-request
- Calls `POST /api/admin/events/bulk-status` with `status: "approved"`
- On success: removes all approved events from the local list and clears `selectedIds`
- On failure (non-2xx or network error): shows an error banner; list is unchanged

### 6. Bulk Reject with shared reason dialog

- **Reject Selected** button opens a modal dialog
- Dialog title shows `Reject N event(s)` for bulk, or `Reject event` for single-card reject
- **Confirm Rejection** button is disabled until the reason textarea contains at least one non-whitespace character
- Pressing Cancel or closing via the backdrop/ESC correctly resets `rejectReason` to `""` (fixed via `onOpenChange`)
- On submit: reason is passed to `POST /api/admin/events/bulk-status`
- The same dialog is reused for single-card reject (routes to the existing `PATCH /api/admin/events/[id]/status`)
- `rejectReason` and `rejectTarget` are captured into local variables before closing the dialog, preventing closure stale-state issues during the async request

### 7. Error feedback

- `actionError` state holds the most recent error string
- Displayed in a dismissible banner between the page header and the toolbar
- Set on both non-OK responses (parses `error` field from JSON body) and `catch` blocks (network errors)
- Cleared at the start of every new action attempt

---

## Edge Cases Addressed

### API layer

| Scenario                                             | Handling                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Malformed JSON body                                  | `request.json()` wrapped in try/catch → `400 Invalid JSON body`                                         |
| `ids` is not an array                                | `!Array.isArray(ids)` check → `400`                                                                     |
| `ids` is an empty array                              | `ids.length === 0` check → `400`                                                                        |
| `status` is any arbitrary string                     | allowlist check → `400`                                                                                 |
| `status = "rejected"` with whitespace-only reason    | `reason?.trim()` falsy check → `400`                                                                    |
| IDs that have already been actioned by another admin | `.eq("status", "pending")` filter prevents double-processing; Supabase silently skips non-matching rows |
| Some IDs do not exist in the database                | Supabase `.in()` with non-existent IDs is a no-op; no error thrown                                      |
| Notification failure                                 | Wrapped in its own `try/catch`; a notification error does not roll back the status update               |
| Non-admin caller                                     | `verifyAdmin()` guard → `403`                                                                           |

### Frontend — selection

| Scenario                                                                                            | Handling                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Select All then single-card approve                                                                 | Event is removed from both `events` and `selectedIds`; `allSelected` and `someSelected` recompute correctly       |
| Single-card approve while others are selected                                                       | Only that event is removed from `events` and `selectedIds`; other selections preserved                            |
| All remaining events approved/rejected individually                                                 | `events` becomes empty → empty state renders; toolbar and cards unmount; `selectedIds` is cleared in each handler |
| `selectedIds` contains IDs no longer in `events` (stale list from another admin acting in parallel) | API silently ignores them (`.eq("status", "pending")` guard); local filter removes them from the view on success  |
| Clicking Select All when indeterminate                                                              | Selects all (matches expected UX convention)                                                                      |

### Frontend — bulk actions

| Scenario                                                     | Handling                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleBulkApprove` called with 0 selections                 | Early return guard; buttons also disabled at the UI level                                                                                                 |
| User changes selection while request is in flight            | `snapshot` captures `selectedIds` at call time; subsequent state changes don't affect which IDs are cleared                                               |
| Bulk action returns non-2xx                                  | Error banner shown; list unchanged; loading spinner dismissed                                                                                             |
| Network error during bulk action                             | `catch` block sets error banner; `finally` resets `bulkActionLoading`                                                                                     |
| Clicking Approve Selected and Reject Selected simultaneously | `bulkActionLoading = true` disables both buttons for the duration of the request; single-card buttons are also disabled while `bulkActionLoading` is true |

### Frontend — reject dialog

| Scenario                                                        | Handling                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Closing dialog via backdrop or ESC key                          | `onOpenChange(false)` triggers `setRejectReason("")`; stale reason cannot leak into next open                      |
| Clicking Cancel button                                          | Explicitly resets both `rejectDialogOpen` and `rejectReason`                                                       |
| Submitting with only whitespace in reason                       | **Confirm** button is disabled (`!rejectReason.trim()`); also enforced server-side                                 |
| Opening single-card reject while bulk reject dialog is building | Impossible — modal overlay blocks card interactions while dialog is open                                           |
| Rejection request fails after dialog is closed                  | Error banner appears on the page; dialog does not reopen (admin can retry via the card button)                     |
| Very long rejection reason                                      | `textarea` is `resize-none`; no server-side character limit currently enforced (future: add max-length validation) |

---

## Testing Checklist

### Bulk approve

- [ ] Select 2+ events → **Approve Selected** removes all from list and clears checkboxes
- [ ] **Approve Selected** is disabled with 0 selections
- [ ] Creators receive `event_approved` notifications

### Bulk reject

- [ ] Select 2+ events → **Reject Selected** opens dialog with correct count in title
- [ ] **Confirm Rejection** disabled until at least one non-whitespace character is typed
- [ ] Submitting rejects all selected events and clears the list
- [ ] Creators receive `event_rejected` notifications containing the shared reason
- [ ] Closing dialog via ESC/backdrop clears the textarea; reopening shows an empty reason field

### Single-card actions

- [ ] Per-card **Approve** still works with no selections active
- [ ] Per-card **Reject** opens the same dialog; submission rejects only that event
- [ ] Single-card buttons are disabled during an in-flight bulk request (`bulkActionLoading`)

### Select All

- [ ] Checking Select All selects every card (ring visible on all)
- [ ] Unchecking Select All deselects all cards
- [ ] Partially selected state shows indeterminate checkbox
- [ ] Approving/rejecting individual events while all are selected correctly updates the Select All state

### Error handling

- [ ] Simulate 500 from API (e.g., kill DB connection) → error banner appears; list unchanged
- [ ] Simulate offline → error banner shows network error message
- [ ] Dismissing the banner clears it; running the same action again resets it

### Accessibility

- [ ] Each per-card checkbox has a descriptive `aria-label`
- [ ] Reject reason `<textarea>` is associated with its `<label>` via `htmlFor`/`id`
- [ ] All buttons have visible focus rings

---

## Known Limitations

- The `count` field in the bulk-status response reflects `ids.length`, not the number of DB rows actually updated (Supabase does not return update counts by default). If some IDs were already non-pending, the true count will be lower than reported.
- No per-event character limit is enforced on rejection reasons.
- The pending list is not auto-refreshed; if two admins are reviewing simultaneously, one may see stale cards until they reload. The `.eq("status", "pending")` API guard prevents double-processing, but the UI will show a silent no-op rather than a meaningful conflict message.
