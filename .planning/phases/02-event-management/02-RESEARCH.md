# Phase 2: Event Management - Research

**Researched:** 2026-03-05
**Domain:** Event CRUD, RSVP visibility, notification fanout (Next.js + Supabase)
**Confidence:** HIGH

## Summary

Phase 2 builds event management features on top of the club infrastructure from Phase 1. The good news: most of the backend APIs already exist. The existing `POST /api/events/create` route already handles auto-approval for club organizers (EVNT-04), `PATCH /api/events/[id]` already handles edit with permission checks (EVNT-03), and `GET /api/events/[id]/rsvp` already returns going/interested counts (EVNT-05). The `CreateEventForm` component already exists with image upload, tag selection, and date/time validation.

The primary work is therefore: (1) adding an "Events" tab to the existing `ClubDashboard` component with a list view showing event status and RSVP counts, (2) wiring the existing `CreateEventForm`/`CreateEventModal` into that tab with club pre-selection, (3) adding an "Edit Event" modal that reuses the form in edit mode, (4) implementing event duplication (pre-filling the create form from an existing event), and (5) creating a notification fanout when events are published (inserting into the existing `notifications` table for each club follower).

**Primary recommendation:** Reuse existing API routes and form components extensively. The new code is primarily UI (ClubEventsTab) and one new API endpoint for notification fanout on event creation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVNT-01 | Create event with club pre-selected via selector | Existing `CreateEventForm` accepts `clubId` prop; existing `POST /api/events/create` accepts `club_id`; `CreateEventModal` wraps form with dialog. Need club selector dropdown for multi-club organizers |
| EVNT-02 | View list of club events with title, date, status, RSVP count | Need new `ClubEventsTab` component; existing `GET /api/clubs/[id]/events` returns events but only approved ones -- needs modification to return all statuses for organizers. RSVP counts require per-event fetch or API enhancement |
| EVNT-03 | Edit event details from club management page | Existing `PATCH /api/events/[id]` handles permission checks and field validation. Need `EditEventModal` or reuse `CreateEventForm` in edit mode |
| EVNT-04 | Auto-approve events created by organizers for their own club | Already implemented in `POST /api/events/create` -- checks `club_members` table membership and sets status to 'approved' |
| EVNT-05 | See RSVP counts (going/interested) for each event | Existing `GET /api/events/[id]/rsvp` returns counts. For list view efficiency, consider batch query or inline RSVP count in events list API |
| EVNT-06 | Duplicate existing event to pre-fill creation form | UI-only feature: read event data, populate `CreateEventForm` with it (minus date/time). No new API needed |
| EVNT-07 | Club followers receive in-app notification on new event publish | Existing `notifications` table with type/title/message/event_id fields. Need fanout logic: query `club_followers`, batch insert notifications. Can be done in event creation API or separate endpoint |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.0.3 | App Router, API routes | Project framework |
| Supabase | (client) | DB queries, auth, storage | Project DB/auth layer |
| SWR | (installed) | Client-side data fetching with caching | Used in all existing hooks (useClub, useMyClubs, etc.) |
| shadcn/ui | (installed) | UI primitives (Dialog, Tabs, Card, Input, Button, Badge, Skeleton) | Project component library |
| Lucide React | (installed) | Icons | Project icon library |
| Tailwind CSS | (installed) | Styling | Project styling |

### Supporting (already available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/dateValidation | local | ISO 8601 date validation, future-date checks | Event create/edit date fields |
| @/lib/classifier | local | Auto-suggest tags from title/description text | Tag suggestion in event form |
| @/lib/upload-utils | local | Upload event image to Supabase storage | Image upload in event form |

### No New Dependencies Needed
All required functionality can be built with existing project dependencies. No new npm packages are required.

## Architecture Patterns

### Recommended Project Structure (new files only)
```
src/
├── components/
│   └── clubs/
│       └── ClubEventsTab.tsx          # Events list + create/edit/duplicate actions
├── hooks/
│   └── useClubs.ts                    # Add useClubEventsManagement hook (all statuses)
```

### Pattern 1: Tab Extension in ClubDashboard
**What:** Add an "Events" tab to the existing `ClubDashboard` Tabs component, visible to all organizers (not just owners).
**When to use:** This follows the established pattern from Phase 1 where Overview, Settings, and Members are tabs.
**Example:**
```typescript
// In ClubDashboard.tsx -- add Events tab visible to all organizers (owners + organizers)
<TabsTrigger value="events">Events</TabsTrigger>
// ...
<TabsContent value="events">
  <ClubEventsTab clubId={clubId} clubName={club.name} />
</TabsContent>
```

### Pattern 2: Reuse CreateEventForm in Edit Mode
**What:** The existing `CreateEventForm` can be extended to accept optional `initialData` prop for edit/duplicate modes. This avoids duplicating the entire form.
**When to use:** For EVNT-03 (edit) and EVNT-06 (duplicate).
**Example:**
```typescript
// CreateEventForm already accepts clubId. Add:
interface CreateEventFormProps {
  clubId?: string;
  initialData?: Partial<Event>;  // Pre-fill for edit/duplicate
  eventId?: string;              // If set, PATCH instead of POST
  onSuccess?: () => void;
}
```

### Pattern 3: API Route for Organizer Event List (All Statuses)
**What:** The existing `GET /api/clubs/[id]/events` only returns approved events (public view). Organizers need to see all statuses. Modify the endpoint to check membership and return all events for organizers, or add a query parameter.
**When to use:** EVNT-02 requires showing pending/approved/rejected events.
**Example:**
```typescript
// In GET /api/clubs/[id]/events, add organizer check:
// If user is authenticated and is a club member, return all events
// Otherwise, return only approved events (public behavior unchanged)
```

### Pattern 4: Notification Fanout on Event Publish
**What:** When an event is created with status='approved', query all club followers and batch-insert notifications.
**When to use:** EVNT-07 -- triggered inside the existing `POST /api/events/create` route after successful event insertion.
**Example:**
```typescript
// After event is inserted with status='approved':
if (status === "approved" && data.club_id) {
  const { data: followers } = await supabase
    .from("club_followers")
    .select("user_id")
    .eq("club_id", data.club_id);

  if (followers?.length) {
    const notifications = followers.map(f => ({
      user_id: f.user_id,
      type: "new_event",
      title: "New Event",
      message: `${clubName} published a new event: ${data.title}`,
      event_id: data.id,
      read: false,
    }));
    await supabase.from("notifications").insert(notifications);
  }
}
```

### Pattern 5: RSVP Count Aggregation for List View
**What:** For the events list (EVNT-02/EVNT-05), fetching RSVP counts per-event via separate API calls is inefficient. Use a single query with aggregation.
**When to use:** When building the ClubEventsTab list view.
**Example:**
```typescript
// Option A: Fetch all RSVPs for club events in one query
const { data: rsvps } = await supabase
  .from("rsvps")
  .select("event_id, status")
  .in("event_id", eventIds)
  .neq("status", "cancelled");
// Then group counts client-side

// Option B: Enhance the events API to include RSVP counts
// This is cleaner but requires modifying the API response
```

### Anti-Patterns to Avoid
- **Separate event management page:** Do NOT create a new `/my-clubs/[id]/events` route. Keep everything inside the existing ClubDashboard tab structure (URL-driven club context pattern from Phase 1).
- **Separate create/edit forms:** Do NOT duplicate CreateEventForm for editing. Extend the existing form with `initialData` and `eventId` props.
- **N+1 RSVP queries:** Do NOT fetch RSVP counts one-by-one in the events list. Batch fetch all RSVPs for the club's event IDs.
- **Synchronous notification fanout blocking response:** The notification insertion should not block the event creation response. Use a fire-and-forget pattern (no await, or catch errors silently) so the user gets immediate feedback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date validation | Custom date parsing | `@/lib/dateValidation` (validateEventDates, isValidISODate) | Already handles ISO 8601, future checks, leap years |
| Image upload | Custom file handling | `@/lib/upload-utils` + `EventImageUpload` component | Already handles Supabase storage, 5MB limit |
| Tag suggestions | Custom classifier | `@/lib/classifier` (classifyTags) | Already used in CreateEventForm with debounce |
| Event form UI | New form from scratch | Extend existing `CreateEventForm` | All fields, validation, tag picker, image upload already built |
| Dialog/Modal UI | Custom modal | shadcn/ui `Dialog` via `CreateEventModal` pattern | Already established in codebase |
| Data fetching/caching | Manual fetch + state | SWR hooks pattern from `useClubs.ts` | Consistent with project patterns, handles revalidation |

## Common Pitfalls

### Pitfall 1: Dual Date Fields in Events Table
**What goes wrong:** The `events` table has BOTH `event_date`/`event_time` (legacy) AND `start_date`/`end_date` (new). The `CreateEventForm` sends `start_date`/`end_date`, but the TypeScript `Event` interface uses `event_date`/`event_time`.
**Why it happens:** Schema evolution -- old fields weren't removed when new ones were added.
**How to avoid:** Use `start_date`/`end_date` consistently in new code (matches what `CreateEventForm` and the create API already use). The `PATCH /api/events/[id]` route also uses `start_date`/`end_date` in its `EDITABLE_FIELDS`. When displaying dates in the events list, use `start_date` as the primary date field.
**Warning signs:** If you see `event_date` in new code, it's likely wrong.

### Pitfall 2: Events API Returns Only Approved Events
**What goes wrong:** The existing `GET /api/clubs/[id]/events` endpoint filters `.eq("status", "approved")`. Organizers need to see all statuses.
**Why it happens:** The endpoint was built for the public club page, not the management view.
**How to avoid:** Modify the endpoint to check if the current user is a club member. If yes, return all events (with status field). If no, keep the approved-only filter. This preserves backward compatibility.
**Warning signs:** Organizer creates an event but can't see it in the list because it's pending.

### Pitfall 3: Supabase Types Lack FK Joins
**What goes wrong:** Supabase generated types have `Relationships: []` for most tables, causing TypeScript errors when using `.select("*, club:clubs(...)")` joins.
**Why it happens:** Types were manually written and don't reflect actual DB foreign keys.
**How to avoid:** Follow the Phase 1 decision: use separate queries and manual attachment, or use `as unknown as` type casts for join results. This is documented in STATE.md decisions.
**Warning signs:** TypeScript errors on `.select()` calls with joined tables.

### Pitfall 4: Notification Fanout for Large Follower Counts
**What goes wrong:** If a club has 1000+ followers, inserting 1000 rows in a single batch could be slow or hit Supabase limits.
**Why it happens:** Supabase bulk insert has practical limits.
**How to avoid:** For this campus app, follower counts are unlikely to exceed a few hundred. A single batch insert is fine. If needed later, chunk into batches of 500. Do NOT over-engineer this with queues or background jobs.
**Warning signs:** Event creation becomes slow after a club gets many followers.

### Pitfall 5: Success Message Still Says "Submitted for Review"
**What goes wrong:** The existing `CreateEventForm` shows "Event Submitted! Your event has been submitted for review." even when auto-approved.
**Why it happens:** The form doesn't check the API response to see if it was auto-approved.
**How to avoid:** Check the `message` field in the API response (`"Event created and approved"` vs `"Event submitted for review"`) and show appropriate success message.
**Warning signs:** Organizer sees "submitted for review" message but event is actually already approved.

## Code Examples

### Existing Event Creation API (auto-approval already works)
```typescript
// Source: src/app/api/events/create/route.ts (lines 62-79)
// Already checks club_members table and sets status='approved' for organizers
if (roles.includes("club_organizer") && body.club_id) {
  const { data: membership } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", body.club_id)
    .single();
  if (membership) {
    status = "approved";
  }
}
```

### Existing RSVP Count API
```typescript
// Source: src/app/api/events/[id]/rsvp/route.ts
// GET returns: { counts: { going, interested, total }, user_rsvp }
```

### Existing Notification Schema
```typescript
// Source: src/lib/supabase/types.ts (notifications table)
// Fields: id, user_id, type, title, message, event_id, read, created_at
// Existing API: GET /api/notifications, POST ?action=mark-all-read, PATCH /api/notifications/[id]
```

### SWR Hook Pattern (from useClubs.ts)
```typescript
// Source: src/hooks/useClubs.ts
const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

export function useClubEvents(clubId: string | null | undefined) {
  return useSWR(
    clubId ? `/api/clubs/${clubId}/events` : null,
    fetcher
  );
}
```

### ClubDashboard Tab Structure
```typescript
// Source: src/components/clubs/ClubDashboard.tsx
// Uses shadcn Tabs component with Overview, Settings (owner), Members (owner)
// Events tab should be visible to ALL organizers (owners + organizers), not just owners
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event_date` + `event_time` fields | `start_date` + `end_date` ISO fields | Already in codebase | Use `start_date`/`end_date` in all new code |
| Admin-only event approval | Auto-approval for club organizers | Already in create API | EVNT-04 already done at API level |
| Separate pages per management feature | Tabbed dashboard at `/my-clubs/[id]` | Phase 1 | Events should be a new tab, not a new page |

## Open Questions

1. **Club name in notification message**
   - What we know: The `POST /api/events/create` route has access to `club_id` but not `club_name`
   - What's unclear: Whether to fetch club name for the notification or use a generic message
   - Recommendation: Fetch club name with a single query since we already have the `club_id`. Small cost, much better UX.

2. **Event list sorting and filtering**
   - What we know: Organizers need to see events by status
   - What's unclear: Whether to add status filter tabs (All/Upcoming/Past/Pending) or simple sorted list
   - Recommendation: Simple list sorted by date descending with status badges. Status filter tabs can be added later if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via Next.js) |
| Config file | Built into Next.js config |
| Quick run command | `npm run lint` |
| Full suite command | `npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVNT-01 | Create event with club pre-selected | manual | Visual verification in browser | N/A |
| EVNT-02 | View events list with status + RSVP | manual | Visual verification in browser | N/A |
| EVNT-03 | Edit event details | manual | Visual verification in browser | N/A |
| EVNT-04 | Auto-approve for organizers | unit (existing) | Verify via API response `message` field | Partially (create route logic exists) |
| EVNT-05 | RSVP counts visible | manual | Visual verification in browser | N/A |
| EVNT-06 | Duplicate event pre-fills form | manual | Visual verification in browser | N/A |
| EVNT-07 | Follower notification on publish | manual | Check notifications API after event creation | N/A |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run build`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing build infrastructure covers phase requirements. Tests are primarily manual/visual for UI features.

## Sources

### Primary (HIGH confidence)
- `src/app/api/events/create/route.ts` -- Existing event creation with auto-approval logic
- `src/app/api/events/[id]/route.ts` -- Existing event GET/PATCH with permission checks
- `src/app/api/events/[id]/rsvp/route.ts` -- Existing RSVP count API
- `src/app/api/clubs/[id]/events/route.ts` -- Existing club events list (approved only)
- `src/app/api/notifications/route.ts` -- Existing notification CRUD
- `src/components/events/CreateEventForm.tsx` -- Existing event creation form
- `src/components/events/CreateEventModal.tsx` -- Existing modal wrapper
- `src/components/clubs/ClubDashboard.tsx` -- Existing tab-based dashboard
- `src/lib/supabase/types.ts` -- Database schema (notifications, club_followers, events, rsvps)
- `src/hooks/useClubs.ts` -- SWR fetching patterns
- `src/types/index.ts` -- TypeScript interfaces

### Secondary (MEDIUM confidence)
- STATE.md decisions -- URL-driven club context, Supabase types FK join workaround, live COUNT pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - Extending existing tab pattern, reusing existing components and APIs
- Pitfalls: HIGH - Identified from direct code reading of existing implementation

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no external dependencies changing)
