# Event Editing & Re-Approval Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow club organizers to freely edit their events and standalone event creators to edit approved events with moderated fields (title, image) requiring admin re-approval.

**Architecture:** Add `pending_edits` JSONB column to events table. PATCH route splits updates: safe fields apply directly, moderated fields go to `pending_edits` for standalone approved events. New admin endpoint approves/rejects pending edits. Frontend shows edit buttons on approved events and pending edit indicators.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase, Tailwind CSS, shadcn/ui, SWR, Lucide React

---

## Task 1: Database Migration — Add `pending_edits` Column

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_pending_edits.sql` (use Supabase MCP)

- [ ] **Step 1: Apply migration via Supabase MCP**

Run the migration using `mcp__plugin_supabase_supabase__apply_migration`:

```sql
ALTER TABLE events ADD COLUMN pending_edits JSONB DEFAULT NULL;

COMMENT ON COLUMN events.pending_edits IS 'Stores proposed title/image_url changes awaiting admin approval. Shape: {title?: string, image_url?: string, submitted_at: string}. NULL = no pending edits.';
```

- [ ] **Step 2: Verify migration applied**

Use `mcp__plugin_supabase_supabase__execute_sql` to verify:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'pending_edits';
```

Expected: One row with `data_type = 'jsonb'`, `column_default = 'NULL'`.

- [ ] **Step 3: Regenerate TypeScript types**

Use `mcp__plugin_supabase_supabase__generate_typescript_types` to regenerate `src/lib/supabase/types.ts`. The generated types should now include `pending_edits` on the events table.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/lib/supabase/types.ts
git commit -m "feat(db): add pending_edits JSONB column to events table"
```

---

## Task 2: TypeScript Types — Add `pending_edits` to Event Interface

**Files:**
- Modify: `src/types/index.ts:34-62` (Event interface)

- [ ] **Step 1: Add `pending_edits` to the Event interface**

In `src/types/index.ts`, add the field to the `Event` interface after `appeal_count` (line 58):

```typescript
  pending_edits?: {
    title?: string;
    image_url?: string;
    submitted_at: string;
  } | null;
```

- [ ] **Step 2: Add `pending_edits` to MyEvent interface in my-events page**

In `src/app/my-events/page.tsx`, add to the `MyEvent` interface (after line 47):

```typescript
  pending_edits?: {
    title?: string;
    image_url?: string;
    submitted_at: string;
  } | null;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/app/my-events/page.tsx
git commit -m "feat(types): add pending_edits to Event and MyEvent interfaces"
```

---

## Task 3: PATCH API Route — Two-Tier Edit Logic

**Files:**
- Modify: `src/app/api/events/[id]/route.ts:118-264`

This is the core logic change. The PATCH handler needs to:
1. Allow creators to edit approved (not just pending) standalone events
2. For approved standalone events: split moderated fields into `pending_edits`
3. For club events: apply all edits directly
4. For admins: always apply directly + clear pending_edits if admin edits title/image

- [ ] **Step 1: Add moderated fields constant**

After the existing `EDITABLE_FIELDS` constant (line 130), add:

```typescript
const MODERATED_FIELDS = ["title", "image_url"] as const;
```

- [ ] **Step 2: Rewrite the permission check block**

Replace lines 177-206 (the permission check section) with updated logic that:
- Admins can always edit (existing)
- Creators can edit their own **pending and approved** events (was: only pending)
- Rejected events return 403 with message to use appeal flow
- Club members can edit their club's events (existing)

```typescript
    // Permission check: admin can edit any event
    const isAdmin = roles.includes("admin");
    let canEdit = isAdmin;

    // Original creator can edit their own pending or approved events
    if (!canEdit && event.created_by === user.id) {
      if (event.status === "pending" || event.status === "approved") {
        canEdit = true;
      } else if (event.status === "rejected") {
        return NextResponse.json(
          { error: "Rejected events cannot be edited. Please use the appeal process." },
          { status: 403 }
        );
      }
    }

    // Club member can edit their club's events
    let isClubMember = false;
    if (!canEdit && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();

      if (membership) {
        canEdit = true;
        isClubMember = true;
      }
    } else if (canEdit && event.club_id) {
      // Check if the editing user (who already has permission) is a club member
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();
      isClubMember = !!membership;
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to edit this event" },
        { status: 403 }
      );
    }
```

- [ ] **Step 3: Rewrite the update logic to split moderated vs safe fields**

Replace lines 208-264 (from `const body = await request.json()` through the end of the try block) with logic that splits fields:

```typescript
    // Build update payload from allowed fields only
    const body = await request.json();
    const directUpdates: Record<string, unknown> = {};
    const pendingEdits: Record<string, string> = {};

    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;

      // Determine if this field needs moderation
      const needsModeration =
        !isAdmin &&
        !isClubMember &&
        event.status === "approved" &&
        (MODERATED_FIELDS as readonly string[]).includes(field);

      if (needsModeration) {
        pendingEdits[field] = body[field];
      } else {
        directUpdates[field] = body[field];
      }
    }

    // If admin directly edits title or image_url, clear pending_edits
    if (isAdmin) {
      const adminEditedModeratedField = MODERATED_FIELDS.some(
        (f) => f in body
      );
      if (adminEditedModeratedField) {
        directUpdates.pending_edits = null;
      }
    }

    if (Object.keys(directUpdates).length === 0 && Object.keys(pendingEdits).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate date fields when present in the direct update payload
    if ("start_date" in directUpdates) {
      const dateError = validateEventDates(
        directUpdates.start_date,
        "end_date" in directUpdates ? directUpdates.end_date : undefined
      );
      if (dateError) {
        return NextResponse.json(
          { error: dateError.message, field: dateError.field },
          { status: 400 }
        );
      }
    } else if ("end_date" in directUpdates) {
      if (!isValidISODate(directUpdates.end_date)) {
        return NextResponse.json(
          {
            error: 'end_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T11:00:00Z")',
            field: "end_date",
          },
          { status: 400 }
        );
      }
    }

    // Write pending edits if any
    if (Object.keys(pendingEdits).length > 0) {
      pendingEdits.submitted_at = new Date().toISOString();
      directUpdates.pending_edits = pendingEdits;
    }

    const { data, error } = await supabase
      .from("events")
      .update(directUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasPendingEdits = Object.keys(pendingEdits).length > 0;
    return NextResponse.json({
      event: data,
      message: hasPendingEdits
        ? "Some changes require admin approval before going live"
        : "Event updated successfully",
      pending_fields: hasPendingEdits ? Object.keys(pendingEdits).filter(k => k !== "submitted_at") : [],
    });
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors in `src/app/api/events/[id]/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/events/[id]/route.ts
git commit -m "feat(api): two-tier edit logic with pending_edits for moderated fields"
```

---

## Task 4: Admin Pending Edits Endpoint

**Files:**
- Create: `src/app/api/admin/events/[id]/edits/route.ts`

- [ ] **Step 1: Extend AuditAction type**

In `src/lib/audit.ts`, add `"approved_edits"` and `"rejected_edits"` to the `AuditAction` type:

```typescript
export type AuditAction =
  | "approved"
  | "rejected"
  | "created"
  | "updated"
  | "deleted"
  | "bulk_approved"
  | "bulk_rejected"
  | "approved_edits"
  | "rejected_edits";
```

- [ ] **Step 2: Create the admin edits route**

Create `src/app/api/admin/events/[id]/edits/route.ts`.

**Important patterns from existing codebase:**
- `verifyAdmin()` returns `{ supabase, user, isAdmin }` — destructure and check `!isAdmin || !user`
- `logAdminAction()` takes a single object param: `{ adminUserId, action, targetType, targetId, metadata }`
- Notification inserts must include `read: false` and `created_at`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, reason } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "reason is required when rejecting edits" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Fetch the event and its pending edits
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id, title, pending_edits, created_by")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.pending_edits) {
    return NextResponse.json(
      { error: "This event has no pending edits" },
      { status: 400 }
    );
  }

  const pendingEdits = event.pending_edits as Record<string, string>;

  if (action === "approve") {
    // Copy pending edit fields into live columns
    const liveUpdates: Record<string, unknown> = { pending_edits: null };
    for (const [key, value] of Object.entries(pendingEdits)) {
      if (key !== "submitted_at") {
        liveUpdates[key] = value;
      }
    }

    const { error: updateError } = await supabase
      .from("events")
      .update(liveUpdates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notify creator
    if (event.created_by) {
      await supabase.from("notifications").insert({
        user_id: event.created_by,
        type: "edit_approved",
        title: "Edits Approved",
        message: `Your edits to "${event.title}" have been approved and are now live.`,
        event_id: id,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: "approved_edits",
      targetType: "event",
      targetId: id,
      metadata: { approved_fields: Object.keys(pendingEdits).filter(k => k !== "submitted_at") },
    });

    return NextResponse.json({ success: true, message: "Edits approved" });
  }

  // Reject
  const { error: updateError } = await supabase
    .from("events")
    .update({ pending_edits: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (event.created_by) {
    await supabase.from("notifications").insert({
      user_id: event.created_by,
      type: "edit_rejected",
      title: "Edits Rejected",
      message: `Your edits to "${event.title}" were rejected: ${reason}`,
      event_id: id,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email,
    action: "rejected_edits",
    targetType: "event",
    targetId: id,
    metadata: { reason, rejected_fields: Object.keys(pendingEdits).filter(k => k !== "submitted_at") },
  });

  return NextResponse.json({ success: true, message: "Edits rejected" });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/events/[id]/edits/route.ts
git commit -m "feat(api): add admin endpoint to approve/reject pending event edits"
```

---

## Task 5: Admin PUT Route — Clear Pending Edits on Direct Admin Edit

**Files:**
- Modify: `src/app/api/admin/events/[id]/route.ts`

- [ ] **Step 1: Read the admin events route**

Read `src/app/api/admin/events/[id]/route.ts` to see the current PUT handler.

- [ ] **Step 2: Add pending_edits clearing to the PUT handler**

In the PUT handler, after building the `updates` object from allowed fields, add logic to clear `pending_edits` when admin edits title or image_url:

```typescript
    // If admin directly edits title or image_url, clear any pending user edits
    if ("title" in updates || "image_url" in updates) {
      updates.pending_edits = null;
    }
```

Add this right before the Supabase `.update(updates)` call.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/events/[id]/route.ts
git commit -m "feat(api): clear pending_edits when admin directly edits title/image"
```

---

## Task 6: My Events Page — Edit Button on Approved Events + Pending Badge

**Files:**
- Modify: `src/app/my-events/page.tsx:289-326`

- [ ] **Step 1: Update the Actions column to show Edit on approved events**

Replace the actions `<td>` block (lines 298-325) with logic that shows:
- Edit button for both `pending` AND `approved` events
- "Pending review" badge when `pending_edits` is non-null
- View link alongside Edit for approved events
- Appeal link stays for rejected events

```tsx
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {event.pending_edits && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              Edits pending review
                            </span>
                          )}
                          {(event.status === "pending" || event.status === "approved") && (
                            <button
                              onClick={() => setEditingEvent(event)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10 transition-colors duration-150"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}
                          {event.status === "approved" && (
                            <Link
                              href={`/events/${event.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10 transition-colors duration-150"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                          )}
                          {event.status === "rejected" && (
                            <Link
                              href={`/events/${event.id}/appeal`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors duration-150"
                            >
                              <MessageSquareWarning className="h-3.5 w-3.5" />
                              Appeal
                            </Link>
                          )}
                        </div>
                      </td>
```

- [ ] **Step 2: Update the dialog description for approved events**

Replace the static `DialogDescription` (line 363) to be dynamic:

```tsx
            <DialogDescription>
              {editingEvent?.status === "approved"
                ? "Changes to title and image will require admin approval. Other changes apply immediately."
                : "Update the details of your pending event."}
            </DialogDescription>
```

- [ ] **Step 3: Update CreateEventForm success handling for pending edits**

In `src/components/events/CreateEventForm.tsx`, update the success message logic and success screen to handle the "pending review" case.

**3a.** Update `handleSubmit` success message (around line 350-352). Replace the `setSuccessMessage` line:

```typescript
      setSuccessMessage(
        data.message || (mode === "edit" ? "Event updated!" : "Event submitted!")
      );
```

**3b.** Update the success screen (lines 410-434) to use the message from the response for all cases. Replace the heading and paragraph:

```tsx
        <h3 className="text-2xl font-bold text-foreground">
          {successMessage.toLowerCase().includes("approval")
            ? "Changes Submitted"
            : isEdit
              ? "Event Updated!"
              : isApproved
                ? "Event Published!"
                : "Event Submitted!"}
        </h3>
        <p className="text-muted-foreground max-w-md">
          {successMessage}
        </p>
```

This ensures that when the API returns `"Some changes require admin approval before going live"`, the success screen shows a "Changes Submitted" heading with the descriptive message below.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/my-events/page.tsx src/components/events/CreateEventForm.tsx
git commit -m "feat(ui): show edit button on approved events with pending edits badge"
```

---

## Task 7: EventDetailView — Edit Button for Event Creator

**Files:**
- Modify: `src/components/events/EventDetailView.tsx:27-38` (props), `94-134` (hero section)
- Modify: `src/app/events/[id]/page.tsx` (or the client component it renders)

- [ ] **Step 1: Add edit-related props to EventDetailView**

Add to the `EventDetailViewProps` interface (after line 36):

```typescript
  isCreator?: boolean;
  onEdit?: () => void;
```

Add to the component destructuring:

```typescript
  isCreator = false,
  onEdit,
```

- [ ] **Step 2: Add edit button and pending edits banner to the hero top bar**

In the top bar section (around line 112-133), add an Edit button next to the Share button when `isCreator` is true:

```tsx
              {isCreator && onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full transition-all duration-300 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="text-sm font-semibold tracking-wide">Edit</span>
                </button>
              )}
```

Import `Pencil` from lucide-react at the top of the file.

- [ ] **Step 3: Add pending edits banner below the title block**

After the title block (after line 157, inside the left column), add a banner when there are pending edits:

```tsx
            {/* Pending edits notice */}
            {isCreator && event.pending_edits && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 text-sm flex items-start gap-3">
                <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">You have edits awaiting approval</p>
                  <p className="text-blue-700 dark:text-blue-400 text-xs mt-0.5">
                    Your changes to {Object.keys(event.pending_edits).filter(k => k !== "submitted_at").join(" and ")} will be reviewed by an admin.
                  </p>
                </div>
              </div>
            )}
```

Import `Clock` from lucide-react (add to existing import).

- [ ] **Step 4: Wire up the EventDetailClient to pass isCreator and onEdit**

Find the EventDetailClient component (likely in `src/app/events/[id]/page.tsx` or a separate client file). Read it, then:
- Import `useAuthStore` to get the current user
- Compare `user.id` with `event.created_by` to determine `isCreator`
- Add state for an edit modal (Dialog with CreateEventForm in edit mode)
- Pass `isCreator` and `onEdit` to `EventDetailView`

This step requires reading the client component first to understand its structure.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/events/EventDetailView.tsx src/app/events/[id]/
git commit -m "feat(ui): add edit button and pending edits banner to event detail view"
```

---

## Task 8: Moderation Queue — Show Pending Edits for Review

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Update the query to include events with pending edits**

The current query filters `status = 'pending'`. Change it to also fetch approved events with `pending_edits IS NOT NULL`. Use Supabase's `.or()` filter:

```typescript
      .or('status.eq.pending,pending_edits.not.is.null')
```

Also add `pending_edits` to the select fields.

- [ ] **Step 2: Add visual distinction for edit review items**

In the event card rendering, check if the item has `pending_edits` and `status === 'approved'`. If so:
- Show an "Edit Review" label/badge instead of the regular "Pending" status badge
- Show a diff view: display current live title alongside proposed title from `pending_edits`
- If `pending_edits.image_url` exists, show current image alongside proposed image

Add above the title display:

```tsx
{event.pending_edits && event.status === "approved" && (
  <div className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-sm">
    <span className="font-bold text-blue-700 dark:text-blue-400 text-xs uppercase tracking-wider">Edit Review</span>
    <div className="mt-2 space-y-1">
      {event.pending_edits.title && (
        <div>
          <span className="text-muted-foreground">Title:</span>{" "}
          <span className="line-through text-muted-foreground">{event.title}</span>{" "}
          <span className="font-semibold text-foreground">{event.pending_edits.title}</span>
        </div>
      )}
      {event.pending_edits.image_url && (
        <div>
          <span className="text-muted-foreground">Image changed</span>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add approve/reject edit buttons**

For events with `pending_edits`, the approve/reject buttons should call `PATCH /api/admin/events/${eventId}/edits` instead of the status endpoint. Add conditional logic:

```typescript
    // For edit reviews
    const handleApproveEdits = async (eventId: string) => {
      const res = await fetch(`/api/admin/events/${eventId}/edits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        // Remove from list or refresh
        fetchPendingEvents();
      }
    };

    const handleRejectEdits = async (eventId: string, reason: string) => {
      const res = await fetch(`/api/admin/events/${eventId}/edits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      if (res.ok) {
        fetchPendingEvents();
      }
    };
```

Wire these to the approve/reject buttons when `event.pending_edits` is present.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/moderation/pending/page.tsx
git commit -m "feat(moderation): show pending edits in moderation queue with diff view"
```

---

## Task 9: GET Event Route — Strip `pending_edits` from Public Responses

**Files:**
- Modify: `src/app/api/events/[id]/route.ts:71-116` (GET handler)

Note: The my-events API already uses `select("*")` so `pending_edits` is automatically included after the migration — no changes needed there.

- [ ] **Step 1: Strip `pending_edits` from public responses**

The GET handler returns `*` from the events table, which will now include `pending_edits`. Strip it for non-creator, non-admin users. The supabase client already has the auth session from cookies, so we can check auth without an extra query.

After the event is fetched and transformed (after line 106, before the return), add:

```typescript
    // Strip pending_edits from public responses — only show to creator or admins
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || data.created_by !== currentUser.id) {
      // Check if admin
      let isAdmin = false;
      if (currentUser) {
        const { data: profile } = await supabase
          .from("users")
          .select("roles")
          .eq("id", currentUser.id)
          .single();
        isAdmin = (profile?.roles ?? []).includes("admin");
      }
      if (!isAdmin) {
        const { pending_edits: _, ...eventWithoutPending } = event as Record<string, unknown>;
        return NextResponse.json({ event: eventWithoutPending });
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/events/[id]/route.ts
git commit -m "feat(api): only expose pending_edits to event creator and admins"
```

---

## Task 10: CreateEventForm — Pre-fill with Pending Edits

**Files:**
- Modify: `src/components/events/CreateEventForm.tsx`

When editing an approved event that has pending edits, the form should pre-fill moderated fields with the pending values (so the user sees what they last submitted) and show a notice.

- [ ] **Step 1: Add `pendingEdits` to the form props**

Add to `CreateEventFormProps.initialData`:

```typescript
    pending_edits?: {
      title?: string;
      image_url?: string;
      submitted_at: string;
    } | null;
```

- [ ] **Step 2: Pre-fill moderated fields with pending values**

In the initial state setup (around line 130-143), use pending edit values for title and image when they exist:

```typescript
  const [formData, setFormData] = useState<FormData>({
    title: initialData?.pending_edits?.title ?? initialData?.title ?? "",
    // ... rest stays the same
  });
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.pending_edits?.image_url ?? initialData?.image_url ?? null
  );
```

- [ ] **Step 3: Show per-field notice when pending edits exist**

Below the title input (after line 550), add a notice if there's a pending title edit:

```tsx
{mode === "edit" && initialData?.pending_edits?.title && (
  <p className="text-xs text-blue-600 dark:text-blue-400">
    Your previous title change is awaiting review
  </p>
)}
```

Similarly, below the image upload section, show a notice if there's a pending image edit.

- [ ] **Step 4: Pass `pending_edits` from callers**

In `src/app/my-events/page.tsx`, when constructing `initialData` for the edit modal, include `pending_edits`:

```tsx
initialData={{
  // ... existing fields
  pending_edits: editingEvent.pending_edits,
}}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/events/CreateEventForm.tsx src/app/my-events/page.tsx
git commit -m "feat(ui): pre-fill edit form with pending edit values and show review notices"
```

---

## Task 11: Moderation Queue Ordering — Sort by `submitted_at`

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Add ordering for edit review items**

After applying the `.or()` filter (from Task 8), add ordering that handles both new pending events and edit reviews. Use `created_at` as the primary sort (which covers both), but for edit reviews the `submitted_at` in `pending_edits` provides additional context.

Add to the query chain:

```typescript
      .order("created_at", { ascending: false })
```

This is likely already present. The key change is ensuring the query returns both types in a unified sorted list. If more granular ordering is needed, sort client-side after fetching.

- [ ] **Step 2: Commit**

```bash
git add src/app/moderation/pending/page.tsx
git commit -m "feat(moderation): ensure edit reviews appear in chronological order"
```

---

## Task 12: Build Verification & Manual Testing

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Run existing tests**

Run: `npx jest`
Expected: All existing tests pass.

- [ ] **Step 4: Manual test checklist**

Verify the following flows work correctly:

1. **Standalone approved event — safe field edit**: Edit description/location on an approved standalone event → changes apply immediately, no `pending_edits` created
2. **Standalone approved event — title edit**: Edit title on an approved standalone event → title goes to `pending_edits`, live title unchanged
3. **Standalone approved event — mixed edit**: Edit both title and location → location applied directly, title goes to `pending_edits`
4. **Club event — any edit**: Edit any field on a club event as a club member → all changes applied directly
5. **Admin approve pending edits**: As admin, approve pending edits → live columns updated, `pending_edits` cleared, notification sent
6. **Admin reject pending edits**: As admin, reject pending edits → `pending_edits` cleared, notification with reason sent
7. **My Events page**: Edit button visible on approved events, pending badge shows when edits are pending
8. **Event detail page**: Edit button and pending banner appear for creator
9. **Moderation queue**: Events with pending edits appear with "Edit Review" label and diff view
10. **Rejected event edit blocked**: Attempting to edit a rejected event returns 403

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
