# Moderation Dashboard Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all audit, security, consistency, and UX issues identified in the moderation dashboard audit.

**Architecture:** Backend-first — fix API route security/audit gaps, then add frontend UX improvements (confirmation dialogs, nav fix). Each task is independent and can be parallelized.

**Tech Stack:** Next.js App Router API routes, TypeScript, Supabase, React (client components), Tailwind CSS, Lucide icons, shadcn/ui Dialog.

---

## Chunk 1: Backend Security & Audit Fixes

### Task 1: Add `organizer_request` to audit target types

**Files:**
- Modify: `src/lib/audit.ts:12`

- [ ] **Step 1: Update the AuditTargetType union**

In `src/lib/audit.ts`, add `"organizer_request"` to the `AuditTargetType` union:

```typescript
export type AuditTargetType = "event" | "user" | "club" | "featured_event" | "organizer_request";
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors related to AuditTargetType

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add organizer_request to audit target types"
```

---

### Task 2: Refactor clubs GET route to use `verifyAdmin()`

**Files:**
- Modify: `src/app/api/admin/clubs/route.ts`

- [ ] **Step 1: Replace inline admin check with `verifyAdmin()`**

Replace the entire file content. The key changes:
- Import `verifyAdmin` from `@/lib/admin` instead of `createClient`
- Use `const { supabase, isAdmin } = await verifyAdmin()`
- Remove the manual user fetch + roles check (lines 6-24)
- Keep the rest of the query logic identical

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";

  let query = supabase
    .from("clubs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching admin clubs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clubs: data ?? [], total: count ?? 0 });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/clubs/route.ts
git commit -m "refactor(admin): use verifyAdmin() in clubs GET route"
```

---

### Task 3: Refactor clubs PATCH route to use `verifyAdmin()` + add audit logging

**Files:**
- Modify: `src/app/api/admin/clubs/[id]/route.ts`

- [ ] **Step 1: Refactor to use `verifyAdmin()` and add `logAdminAction()`**

Replace the file. Key changes:
- Import `verifyAdmin` from `@/lib/admin` and `logAdminAction` from `@/lib/audit`
- Remove manual auth check (lines 10-28)
- Use `const { user, isAdmin } = await verifyAdmin()`
- Add `logAdminAction()` call after successful status update (before notifications)
- Keep all existing business logic (role granting, club_members upsert, notifications) identical

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: club, error: fetchError } = await serviceClient
    .from("clubs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  if (club.status !== "pending") {
    return NextResponse.json(
      { error: "This club has already been reviewed" },
      { status: 409 }
    );
  }

  const { error: updateError } = await serviceClient
    .from("clubs")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status as "approved" | "rejected",
      targetType: "club",
      targetId: id,
      metadata: { club_name: club.name },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  if (status === "approved" && club.created_by) {
    const { data: targetUser } = await serviceClient
      .from("users")
      .select("roles")
      .eq("id", club.created_by)
      .single();

    if (targetUser && !targetUser.roles?.includes("club_organizer")) {
      const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
      await serviceClient
        .from("users")
        .update({
          roles: updatedRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", club.created_by);
    }

    await serviceClient.from("club_members").upsert(
      {
        user_id: club.created_by,
        club_id: id,
        role: "owner",              // DBROLE-06: creator becomes owner, not organizer
      },
      { onConflict: "user_id,club_id" }
    );

    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_approved",
        title: "Club Approved!",
        message: `Your club "${club.name}" has been approved. You are now the owner and can create events.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  if (status === "rejected" && club.created_by) {
    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_rejected",
        title: "Club Not Approved",
        message: `Your club "${club.name}" was not approved.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/clubs/[id]/route.ts
git commit -m "feat(admin): add verifyAdmin and audit logging to club moderation"
```

---

### Task 4: Refactor organizer-requests GET route to use `verifyAdmin()`

**Files:**
- Modify: `src/app/api/admin/organizer-requests/route.ts`

- [ ] **Step 1: Replace inline admin check with `verifyAdmin()`**

Replace the file. Key changes:
- Import `verifyAdmin` from `@/lib/admin` instead of `createClient`
- Use `const { supabase, isAdmin } = await verifyAdmin()`
- Remove manual user fetch + roles check (lines 6-25)
- Keep query logic identical

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("organizer_requests")
    .select("*, club:clubs(*), user:users(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data, total: count ?? 0 });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/organizer-requests/route.ts
git commit -m "refactor(admin): use verifyAdmin() in organizer-requests GET route"
```

---

### Task 5: Refactor organizer-requests PATCH route to use `verifyAdmin()` + add audit logging

**Files:**
- Modify: `src/app/api/admin/organizer-requests/[id]/route.ts`

- [ ] **Step 1: Refactor to use `verifyAdmin()` and add `logAdminAction()`**

Replace the file. Key changes:
- Import `verifyAdmin` from `@/lib/admin` and `logAdminAction` from `@/lib/audit`
- Remove manual auth check (lines 10-29)
- Use `const { user, isAdmin } = await verifyAdmin()`
- Add `logAdminAction()` call after successful status update
- Keep all existing business logic (role granting, club_members upsert, notifications) identical

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // Fetch the request to get user_id and club_id
  const serviceClient = createServiceClient();

  const { data: orgRequest, error: fetchError } = await serviceClient
    .from("organizer_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !orgRequest) {
    return NextResponse.json(
      { error: "Organizer request not found" },
      { status: 404 }
    );
  }

  if (orgRequest.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been reviewed" },
      { status: 409 }
    );
  }

  // Update the request status
  const { error: updateError } = await serviceClient
    .from("organizer_requests")
    .update({
      status,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status as "approved" | "rejected",
      targetType: "organizer_request",
      targetId: id,
      metadata: { user_id: orgRequest.user_id, club_id: orgRequest.club_id },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  // If approved, grant the club_organizer role and add to club_members
  if (status === "approved") {
    // Add 'club_organizer' to user's roles if not already present
    const { data: targetUser } = await serviceClient
      .from("users")
      .select("roles")
      .eq("id", orgRequest.user_id)
      .single();

    if (targetUser && !targetUser.roles?.includes("club_organizer")) {
      const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
      await serviceClient
        .from("users")
        .update({
          roles: updatedRoles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgRequest.user_id);
    }

    // Insert into club_members (ignore if already exists)
    await serviceClient.from("club_members").upsert(
      {
        user_id: orgRequest.user_id,
        club_id: orgRequest.club_id,
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );
  }

  // Send notification to the requester
  try {
    const { data: club } = await serviceClient
      .from("clubs")
      .select("name")
      .eq("id", orgRequest.club_id)
      .single();

    const clubName = club?.name || "the club";
    const isApproved = status === "approved";

    await serviceClient.from("notifications").insert({
      user_id: orgRequest.user_id,
      type: isApproved ? "organizer_approved" : "organizer_rejected",
      title: isApproved
        ? "Organizer Request Approved!"
        : "Organizer Request Not Approved",
      message: isApproved
        ? `Your request to become an organizer for ${clubName} has been approved. You can now create events for this club.`
        : `Your request to become an organizer for ${clubName} was not approved.`,
    });
  } catch (notifErr) {
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/organizer-requests/[id]/route.ts
git commit -m "feat(admin): add verifyAdmin and audit logging to organizer request moderation"
```

---

## Chunk 2: Frontend UX Fixes

### Task 6: Add Pending Review link to ModerationNav

**Files:**
- Modify: `src/app/moderation/ModerationNav.tsx:18-23`

- [ ] **Step 1: Add the Pending Review nav item**

Add `ClipboardCheck` to the lucide-react import, then add "Pending Review" to `contentItems` array between "Dashboard" and "Event Queue":

```typescript
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarClock,
  Building2,
  UserCheck,
  Users,
  Star,
  ScrollText,
  BarChart3,
} from "lucide-react";

const contentItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Pending Review", path: "/moderation/pending", icon: ClipboardCheck },
  { name: "Event Queue", path: "/moderation/events", icon: CalendarClock },
  { name: "Club Approvals", path: "/moderation/clubs", icon: Building2 },
  { name: "Featured Events", path: "/moderation/featured", icon: Star },
];
```

- [ ] **Step 2: Verify the page renders**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/ModerationNav.tsx
git commit -m "feat(moderation): add Pending Review link to sidebar nav"
```

---

### Task 7: Add confirmation dialogs to club moderation actions

**Files:**
- Modify: `src/app/moderation/clubs/page.tsx`

- [ ] **Step 1: Add confirmation state and dialog**

Add a `confirmAction` state to track which club is pending confirmation and whether it's approve or reject. Replace the inline approve/reject buttons with a two-step pattern (matching the existing delete confirmation in the events page).

In the component, add after the existing state declarations (after line 40):

```typescript
const [confirmAction, setConfirmAction] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
```

Replace the `handleAction` function (lines 57-72) with:

```typescript
const handleAction = async (clubId: string, status: "approved" | "rejected") => {
  setActionLoading(clubId);
  setConfirmAction(null);
  try {
    const res = await fetch(`/api/admin/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setClubs((prev) => prev.filter((c) => c.id !== clubId));
    }
  } finally {
    setActionLoading(null);
  }
};
```

Replace the actions cell (lines 221-245) with:

```tsx
<td className="px-6 py-4 text-right">
  {club.status === "pending" && (
    <div className="flex items-center justify-end gap-1">
      {confirmAction?.id === club.id ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 mr-1">
            {confirmAction.status === "approved" ? "Approve?" : "Reject?"}
          </span>
          <button
            onClick={() => handleAction(club.id, confirmAction.status)}
            disabled={actionLoading === club.id}
            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {actionLoading === club.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Yes"
            )}
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setConfirmAction({ id: club.id, status: "approved" })}
            disabled={actionLoading === club.id}
            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50 transition-colors"
            title="Approve"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmAction({ id: club.id, status: "rejected" })}
            disabled={actionLoading === club.id}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
            title="Reject"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )}
</td>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/clubs/page.tsx
git commit -m "feat(moderation): add confirmation dialogs to club approve/reject actions"
```

---

### Task 8: Add confirmation dialogs to organizer request actions

**Files:**
- Modify: `src/app/moderation/organizer-requests/page.tsx`

- [ ] **Step 1: Add confirmation state and dialog**

Same pattern as Task 7. Add after existing state declarations (after line 42):

```typescript
const [confirmAction, setConfirmAction] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
```

Replace the `handleAction` function (lines 59-74) with:

```typescript
const handleAction = async (requestId: string, status: "approved" | "rejected") => {
  setActionLoading(requestId);
  setConfirmAction(null);
  try {
    const res = await fetch(`/api/admin/organizer-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  } finally {
    setActionLoading(null);
  }
};
```

Replace the actions cell (lines 227-249) with:

```tsx
<td className="px-6 py-4 text-right">
  {request.status === "pending" && (
    <div className="flex items-center justify-end gap-1">
      {confirmAction?.id === request.id ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 mr-1">
            {confirmAction.status === "approved" ? "Approve?" : "Reject?"}
          </span>
          <button
            onClick={() => handleAction(request.id, confirmAction.status)}
            disabled={actionLoading === request.id}
            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {actionLoading === request.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Yes"
            )}
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setConfirmAction({ id: request.id, status: "approved" })}
            disabled={actionLoading === request.id}
            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50 transition-colors"
            title="Approve"
          >
            {actionLoading === request.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setConfirmAction({ id: request.id, status: "rejected" })}
            disabled={actionLoading === request.id}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
            title="Reject"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )}
</td>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/organizer-requests/page.tsx
git commit -m "feat(moderation): add confirmation dialogs to organizer request actions"
```

---

### Task 9: Add confirmation dialogs to pending events page (approve/reject)

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Add confirmation state**

Add after the existing state declarations (after line 41):

```typescript
const [confirmAction, setConfirmAction] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
```

Import `AlertTriangle` from lucide-react (add to existing import).

Replace the `handleAction` function (lines 59-74) — add `setConfirmAction(null)` at the start:

```typescript
const handleAction = async (eventId: string, status: "approved" | "rejected") => {
  setConfirmAction(null);
  setActionLoading(eventId);
  try {
    const res = await fetch(`/api/admin/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  } finally {
    setActionLoading(null);
  }
};
```

Replace the Approve and Reject buttons (lines 269-284) — wrap in confirmation pattern:

```tsx
{confirmAction?.id === event.id ? (
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-zinc-600 dark:text-zinc-400">
      {confirmAction.status === "approved" ? "Approve?" : "Reject?"}
    </span>
    <button
      onClick={() => handleAction(event.id, confirmAction.status)}
      disabled={actionLoading === event.id}
      className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
    >
      Yes
    </button>
    <button
      onClick={() => setConfirmAction(null)}
      className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
    >
      No
    </button>
  </div>
) : (
  <>
    <button
      onClick={() => setConfirmAction({ id: event.id, status: "approved" })}
      disabled={actionLoading === event.id}
      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
    >
      <CheckCircle className="h-3.5 w-3.5" />
      Approve
    </button>
    <button
      onClick={() => setConfirmAction({ id: event.id, status: "rejected" })}
      disabled={actionLoading === event.id}
      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
    >
      <XCircle className="h-3.5 w-3.5" />
      Reject
    </button>
  </>
)}
```

Keep the Edit and Feature buttons after this block unchanged.

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/pending/page.tsx
git commit -m "feat(moderation): add confirmation dialogs to pending event actions"
```
