# Admin Enforcement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event/club suspension, user banning, organizer directory, and appeal flow for suspensions to the existing moderation system.

**Architecture:** Extend existing moderation pages and API routes with new `suspended` status for events/clubs, ban fields on users table, middleware ban enforcement with cookie caching, and a new organizer directory page. Reuses existing rejection/appeal patterns throughout.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres), Tailwind CSS, shadcn/ui, SWR, Zustand

**Spec:** `docs/superpowers/specs/2026-03-16-admin-enforcement-design.md`

---

## Chunk 1: Data Model & Type Updates

### Task 1: Database Migration — Add `suspended` status and ban fields

**Files:**
- Create: `supabase/migrations/<timestamp>_admin_enforcement.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add 'suspended' to event status
-- (Supabase uses text columns with app-level validation, not Postgres enums for these tables)

-- Add ban fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banned_by uuid DEFAULT NULL REFERENCES auth.users(id);

-- Index for middleware ban checks (used on every authenticated request via cookie refresh)
CREATE INDEX IF NOT EXISTS idx_users_banned_at ON users (banned_at) WHERE banned_at IS NOT NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the migration using `mcp__plugin_supabase_supabase__apply_migration`.

- [ ] **Step 3: Regenerate Supabase types**

Run: `mcp__plugin_supabase_supabase__generate_typescript_types` and update `src/lib/supabase/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/lib/supabase/types.ts
git commit -m "feat(db): add ban fields to users table and index for ban checks"
```

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts:56` (Event.status)
- Modify: `src/types/index.ts:77` (Club.status)
- Modify: `src/types/index.ts:369` (ModerationAction)
- Modify: `src/lib/audit.ts:3-10` (AuditAction)

- [ ] **Step 1: Add `suspended` to Event.status**

In `src/types/index.ts`, line 56, change:
```typescript
status: "pending" | "approved" | "rejected";
```
to:
```typescript
status: "pending" | "approved" | "rejected" | "suspended";
```

- [ ] **Step 2: Add `suspended` to Club.status**

In `src/types/index.ts`, line 77, change:
```typescript
status: "pending" | "approved" | "rejected" | "deleted";
```
to:
```typescript
status: "pending" | "approved" | "rejected" | "suspended" | "deleted";
```

- [ ] **Step 3: Add `suspension` and `unsuspension` to ModerationAction**

In `src/types/index.ts`, line 369, change:
```typescript
export type ModerationAction = "rejection" | "appeal" | "approval";
```
to:
```typescript
export type ModerationAction = "rejection" | "appeal" | "approval" | "suspension" | "unsuspension";
```

- [ ] **Step 4: Add ban fields to User interface**

In `src/types/index.ts`, add to the User interface:
```typescript
banned_at?: string | null;
ban_expires_at?: string | null;
ban_reason?: string | null;
banned_by?: string | null;
```

- [ ] **Step 5: Add new audit action types**

In `src/lib/audit.ts`, lines 3-10, extend the AuditAction type to include:
```typescript
| "suspended"
| "unsuspended"
| "banned"
| "unbanned"
```

- [ ] **Step 6: Document new notification types**

Notification `type` values are untyped strings in this codebase (stored as `text` in the `notifications` table). No TypeScript type needs updating. The new notification types used by this feature are: `"event_suspended"`, `"club_suspended"`, `"user_banned"`, `"user_unbanned"`. These are passed as string literals when inserting into the `notifications` table.

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/lib/audit.ts
git commit -m "feat(types): add suspended status, ban fields, and new audit/notification types"
```

### Task 3: Create ban utility

**Files:**
- Create: `src/lib/ban.ts`
- Create: `src/lib/__tests__/ban.test.ts`

- [ ] **Step 1: Write failing test for isBanned()**

Create `src/lib/__tests__/ban.test.ts`:
```typescript
import { isBanned } from "../ban";

describe("isBanned", () => {
  it("returns false when banned_at is null", () => {
    expect(isBanned({ banned_at: null, ban_expires_at: null })).toBe(false);
  });

  it("returns true for permanent ban (no expiry)", () => {
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: null })
    ).toBe(true);
  });

  it("returns true for active temporary ban", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: future })
    ).toBe(true);
  });

  it("returns false for expired temporary ban", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: past })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/ban.test.ts --verbose`
Expected: FAIL — `Cannot find module "../ban"`

- [ ] **Step 3: Write isBanned() implementation**

Create `src/lib/ban.ts`:
```typescript
interface BanStatus {
  banned_at: string | null;
  ban_expires_at: string | null;
}

export function isBanned(user: BanStatus): boolean {
  if (!user.banned_at) return false;
  if (!user.ban_expires_at) return true; // permanent
  return new Date(user.ban_expires_at) > new Date();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/ban.test.ts --verbose`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ban.ts src/lib/__tests__/ban.test.ts
git commit -m "feat(lib): add isBanned utility with tests"
```

---

## Chunk 2: Event/Club Suspension API

### Task 4: Extend event status route to support suspension

**Files:**
- Modify: `src/app/api/admin/events/[id]/status/route.ts:21-23` (status validation)

- [ ] **Step 1: Update status validation**

In `src/app/api/admin/events/[id]/status/route.ts`, find the status validation (around line 21-23) and add `"suspended"` to the allowed values.

- [ ] **Step 2: Add suspension-specific logic**

After the existing rejection logic block, add a similar block for suspension:
- When `status === "suspended"`, require `reason` and `category` (same validation as rejection)
- Insert `moderation_reviews` row with action `"suspension"`
- Send `event_suspended` notification to the event creator
- Log `"suspended"` audit action

- [ ] **Step 3: Add unsuspension logic**

When status changes from `suspended` to `approved`:
- Insert `moderation_reviews` row with action `"unsuspension"`
- Log `"unsuspended"` audit action

- [ ] **Step 4: Replace the status guard with a transition map**

The existing guard (around line 39) only prevents setting the same status (`event.status === status`). This allows invalid transitions like `pending → suspended`. Replace with an explicit transition map (same pattern as Task 5 for clubs):

```typescript
const allowedTransitions: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved", "rejected"],
  rejected: [], // appeals handle rejected → pending
};

const allowed = allowedTransitions[event.status] || [];
if (!allowed.includes(status)) {
  return NextResponse.json(
    { error: `Cannot transition from '${event.status}' to '${status}'` },
    { status: 409 }
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/events/[id]/status/route.ts
git commit -m "feat(api): support event suspension and unsuspension in status route"
```

### Task 5: Extend club admin route to support suspension

**Files:**
- Modify: `src/app/api/admin/clubs/[id]/route.ts:43-60` (pending-only guard)

- [ ] **Step 1: Relax the pending-only guard**

In `src/app/api/admin/clubs/[id]/route.ts`, line 55, the check is `if (club.status !== "pending") return 409`. Replace this with a transition validation map:

```typescript
const allowedTransitions: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved", "rejected"],
  rejected: [], // appeals handle rejected → pending
};

const allowed = allowedTransitions[club.status] || [];
if (!allowed.includes(status)) {
  return NextResponse.json(
    { error: `Cannot transition from '${club.status}' to '${status}'` },
    { status: 409 }
  );
}
```

- [ ] **Step 2: Add suspension logic**

After the existing rejection block, add suspension handling (same pattern as events):
- When `status === "suspended"`, require `reason` and `category`
- Insert `moderation_reviews` row with action `"suspension"`
- Send `club_suspended` notification to the club creator
- Log `"suspended"` audit action

- [ ] **Step 3: Add unsuspension logic**

When transitioning from `suspended` to `approved`:
- Insert `moderation_reviews` row with action `"unsuspension"`
- Log `"unsuspended"` audit action
- Skip the organizer role assignment (user already has it from original approval)

- [ ] **Step 4: Verify manually**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/clubs/[id]/route.ts
git commit -m "feat(api): support club suspension with transition validation"
```

### Task 6: Update appeal routes to accept suspended status

**Files:**
- Modify: `src/app/api/events/[id]/appeal/route.ts:46`
- Modify: `src/app/api/clubs/[id]/appeal/route.ts:46`

- [ ] **Step 1: Update event appeal status check**

In `src/app/api/events/[id]/appeal/route.ts`, line 46, change:
```typescript
if (event.status !== "rejected")
```
to:
```typescript
if (!["rejected", "suspended"].includes(event.status))
```

- [ ] **Step 2: Update club appeal status check**

In `src/app/api/clubs/[id]/appeal/route.ts`, line 46, change:
```typescript
if (club.status !== "rejected")
```
to:
```typescript
if (!["rejected", "suspended"].includes(club.status))
```

- [ ] **Step 3: Verify manually**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/[id]/appeal/route.ts src/app/api/clubs/[id]/appeal/route.ts
git commit -m "feat(api): allow appeals on suspended events and clubs"
```

---

## Chunk 3: User Ban API & Middleware

### Task 7: Create ban/unban API routes

**Files:**
- Create: `src/app/api/admin/users/[id]/ban/route.ts`

- [ ] **Step 1: Create the ban route file**

Create `src/app/api/admin/users/[id]/ban/route.ts` with POST and DELETE handlers:

**POST handler (ban user):**
```typescript
import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, user: adminUser } = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { reason, duration_days, suspend_content } = await request.json();

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  if (duration_days !== undefined) {
    if (!Number.isInteger(duration_days) || duration_days <= 0) {
      return NextResponse.json(
        { error: "duration_days must be a positive integer" },
        { status: 400 }
      );
    }
  }

  const supabase = createServiceClient();

  // Check target user exists
  const { data: targetUser, error: userError } = await supabase
    .from("users")
    .select("id, name, banned_at")
    .eq("id", id)
    .single();

  if (userError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.banned_at) {
    return NextResponse.json({ error: "User is already banned" }, { status: 409 });
  }

  const ban_expires_at = duration_days
    ? new Date(Date.now() + duration_days * 86400000).toISOString()
    : null;

  // Ban the user
  const { error: banError } = await supabase
    .from("users")
    .update({
      banned_at: new Date().toISOString(),
      ban_expires_at,
      ban_reason: reason.trim(),
      banned_by: adminUser!.id,
    })
    .eq("id", id);

  if (banError) {
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }

  // Optionally suspend all user's approved content (in a single transaction via RPC)
  if (suspend_content) {
    // Use supabase.rpc or sequential calls — Supabase JS doesn't support multi-statement
    // transactions natively. For atomicity, create a Postgres function `ban_user_content(user_id uuid)`
    // that suspends events + clubs in a single transaction. If that's too heavy, sequential calls
    // are acceptable at current scale since partial failure is recoverable (admin can manually
    // suspend remaining content). The ban itself has already been applied above.
    await supabase
      .from("events")
      .update({ status: "suspended" })
      .eq("created_by", id)
      .eq("status", "approved");

    await supabase
      .from("clubs")
      .update({ status: "suspended" })
      .eq("created_by", id)
      .eq("status", "approved");
  }

  // Send notification to banned user
  await supabase.from("notifications").insert({
    user_id: id,
    type: "user_banned",
    title: "Account Suspended",
    message: `Your account has been suspended${duration_days ? ` for ${duration_days} days` : " permanently"}. Reason: ${reason.trim()}`,
  });

  // Log audit action
  await logAdminAction({
    adminUserId: adminUser!.id,
    action: "banned",
    targetType: "user",
    targetId: id,
    metadata: {
      user_name: targetUser.name,
      reason: reason.trim(),
      duration_days: duration_days || "permanent",
      suspend_content: !!suspend_content,
    },
  });

  return NextResponse.json({ success: true });
}
```

**DELETE handler (unban user):**
```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, user: adminUser } = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: targetUser, error: userError } = await supabase
    .from("users")
    .select("id, name, banned_at")
    .eq("id", id)
    .single();

  if (userError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!targetUser.banned_at) {
    return NextResponse.json({ error: "User is not banned" }, { status: 409 });
  }

  // Clear ban (preserve ban_reason and banned_by for history)
  const { error: unbanError } = await supabase
    .from("users")
    .update({ banned_at: null, ban_expires_at: null })
    .eq("id", id);

  if (unbanError) {
    return NextResponse.json({ error: "Failed to unban user" }, { status: 500 });
  }

  // Send notification
  await supabase.from("notifications").insert({
    user_id: id,
    type: "user_unbanned",
    title: "Account Restored",
    message: "Your account suspension has been lifted. You can now use the platform again.",
  });

  // Log audit action
  await logAdminAction({
    adminUserId: adminUser!.id,
    action: "unbanned",
    targetType: "user",
    targetId: id,
    metadata: { user_name: targetUser.name },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/[id]/ban/route.ts
git commit -m "feat(api): add ban and unban user endpoints"
```

### Task 8: Add ban enforcement to middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add ban check after session refresh**

In `src/middleware.ts`, after the session refresh logic (around line 87) and before the protected routes check, add ban enforcement:

```typescript
// Ban enforcement with cookie caching
const banCookie = request.cookies.get("x-ban-status");
const now = Date.now();

if (user) {
  const pathname = request.nextUrl.pathname;
  const banExemptPaths = ["/banned", "/auth/signout", "/auth/callback"];
  const isBanExempt = banExemptPaths.some((p) => pathname.startsWith(p));

  if (!isBanExempt) {
    let isBanned = false;

    if (banCookie) {
      try {
        const cached = JSON.parse(banCookie.value);
        if (cached.checkedAt && now - cached.checkedAt < 60000) {
          isBanned = cached.banned === true;
        }
      } catch {
        // Invalid cookie, will re-check
      }
    }

    // Re-check if cookie was missing, invalid, or stale (isBanned still default false)
    const cacheValid = (() => {
      if (!banCookie) return false;
      try {
        const cached = JSON.parse(banCookie.value);
        return cached.checkedAt && now - cached.checkedAt < 60000;
      } catch { return false; }
    })();

    if (!cacheValid) {
      // Query ban status from DB
      const { data: banData } = await supabase
        .from("users")
        .select("banned_at, ban_expires_at")
        .eq("id", user.id)
        .single();

      if (banData?.banned_at) {
        isBanned = !banData.ban_expires_at || new Date(banData.ban_expires_at) > new Date();
      }

      // Cache result in cookie (60s TTL)
      response.cookies.set("x-ban-status", JSON.stringify({
        banned: isBanned,
        checkedAt: now,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
    }

    if (isBanned) {
      return NextResponse.redirect(new URL("/banned", request.url));
    }
  }
}
```

Note: This is a pattern guide — adapt to the exact middleware structure. The key points are:
1. Check cookie first (avoid DB query)
2. Query DB if cache miss
3. Set cookie with 60s TTL
4. Redirect to `/banned` if actively banned
5. Exempt `/banned`, `/auth/signout`, and `/auth/callback`

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): add ban enforcement with cookie-cached checks"
```

### Task 9: Create /banned page

**Files:**
- Create: `src/app/banned/page.tsx`

- [ ] **Step 1: Create the banned page**

Create `src/app/banned/page.tsx` as a server component. Note: Since this is a server component and Lucide icons are client components, use an inline SVG or the `Ban` icon from lucide-react wrapped in a small client component, or just use a simple text/CSS approach for the icon.

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BannedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/landing");

  const { data: profile } = await supabase
    .from("users")
    .select("banned_at, ban_expires_at, ban_reason")
    .eq("id", user.id)
    .single();

  // If not actually banned, redirect to home
  if (!profile?.banned_at) redirect("/");
  if (profile.ban_expires_at && new Date(profile.ban_expires_at) <= new Date()) {
    redirect("/");
  }

  const isPermanent = !profile.ban_expires_at;
  const expiryDate = profile.ban_expires_at
    ? new Date(profile.ban_expires_at)
    : null;
  const daysRemaining = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-white mb-2">Account Suspended</h1>
        <p className="text-zinc-400 mb-6">
          Your account has been suspended for violating community guidelines.
        </p>

        <div className="bg-zinc-900 rounded-lg p-4 text-left mb-6 border border-zinc-800">
          {profile.ban_reason && (
            <div className="mb-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Reason</div>
              <div className="text-sm text-zinc-300">{profile.ban_reason}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              {isPermanent ? "Duration" : "Expires"}
            </div>
            <div className="text-sm text-amber-400">
              {isPermanent
                ? "Permanent"
                : `${expiryDate!.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })} (${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining)`}
            </div>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-6 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm hover:bg-zinc-700 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add /banned to AppShell exclusion list**

In `src/components/layout/AppShell.tsx`, find where `/landing` and `/moderation` paths exclude the nav/footer and add `/banned` to that list.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/banned/page.tsx src/components/layout/AppShell.tsx
git commit -m "feat(ui): add /banned page for suspended users"
```

---

## Chunk 4: Organizer Directory API & Page

### Task 10: Create organizer directory API

**Files:**
- Create: `src/app/api/admin/organizers/route.ts`

- [ ] **Step 1: Create the organizers API route**

Create `src/app/api/admin/organizers/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all"; // all | active | banned

  const supabase = createServiceClient();

  // Get users with club_organizer role
  let query = supabase
    .from("users")
    .select("id, name, email, avatar_url, roles, banned_at, ban_expires_at, ban_reason, created_at")
    .contains("roles", ["club_organizer"]);

  if (search) {
    // Sanitize search to prevent PostgREST operator injection
    const sanitized = search.replace(/[,()]/g, "");
    query = query.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
  }

  if (status === "banned") {
    // Active bans only: banned_at is set AND (no expiry OR expiry in future)
    query = query
      .not("banned_at", "is", null)
      .or(`ban_expires_at.is.null,ban_expires_at.gt.${new Date().toISOString()}`);
  } else if (status === "active") {
    query = query.is("banned_at", null);
  }

  const { data: organizers, error } = await query.order("name");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch organizers" }, { status: 500 });
  }

  // Get clubs for each organizer via club_members (role = 'owner')
  const organizerIds = organizers.map((o) => o.id);
  const { data: memberships } = await supabase
    .from("club_members")
    .select("user_id, club_id, clubs(id, name, status)")
    .in("user_id", organizerIds)
    .eq("role", "owner");

  // Get event counts per organizer
  const { data: eventCounts } = await supabase
    .from("events")
    .select("created_by")
    .in("created_by", organizerIds);

  // Merge data
  const result = organizers.map((org) => ({
    ...org,
    clubs: (memberships || [])
      .filter((m) => m.user_id === org.id)
      .map((m) => m.clubs)
      .filter(Boolean),
    event_count: (eventCounts || []).filter((e) => e.created_by === org.id).length,
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/organizers/route.ts
git commit -m "feat(api): add organizer directory endpoint"
```

### Task 11: Create organizer directory page

**Files:**
- Create: `src/app/moderation/organizers/page.tsx`

- [ ] **Step 1: Create the organizers page**

Create `src/app/moderation/organizers/page.tsx`. Follow the pattern from `/moderation/users/page.tsx` (which uses `useEffect` + `fetch` + `useState`, not SWR — match this pattern for consistency).

Key elements:
- Search bar for name/email filtering
- Filter tabs: All Organizers, Active, Banned
- Card-based layout per organizer showing:
  - Avatar (initials fallback), name, email (clickable mailto)
  - Clubs they manage as badges
  - Activity stats (joined date, events created)
  - Ban status badge and Ban/Unban button
  - Ban info for banned organizers
- Uses SWR to fetch from `/api/admin/organizers`
- Ban/Unban buttons open BanUserModal or call unban endpoint (these will be wired up in Task 14)

For now, implement the page with the display and search/filter functionality. Ban/Unban actions will be added after the modals are created in Chunk 5.

- [ ] **Step 2: Add organizers link to ModerationNav**

In `src/app/moderation/ModerationNav.tsx`, the nav uses grouped arrays (`contentItems`, `userItems`, `systemItems`) rendered through `NavSection` components. Add a new entry to the `userItems` array (around lines 29-32) after "User Management":

```typescript
{ name: "Organizers", path: "/moderation/organizers", icon: ContactRound },
```

Also add `ContactRound` to the lucide-react import at the top of the file.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/moderation/organizers/page.tsx src/app/moderation/ModerationNav.tsx
git commit -m "feat(ui): add organizer directory page with search and filtering"
```

---

## Chunk 5: UI Components & Page Updates

### Task 12: Create SuspensionModal component

**Files:**
- Create: `src/components/moderation/SuspensionModal.tsx`

- [ ] **Step 1: Create the SuspensionModal**

Create `src/components/moderation/SuspensionModal.tsx`, following the exact pattern from `RejectionModal.tsx` (lines 1-123). Differences:
- Title: "Suspend [Event/Club]" instead of "Reject"
- Description: "This will hide the [event/club] from public view. The creator will be notified and can submit an appeal."
- Amber/yellow themed submit button instead of red
- Same category dropdown using `REJECTION_CATEGORIES`
- Same reason text area

**Important:** Match `RejectionModal`'s actual prop names exactly:
```typescript
interface SuspensionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: "event" | "club";
  onSubmit: (category: RejectionCategory, message: string) => Promise<void>;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/SuspensionModal.tsx
git commit -m "feat(ui): add SuspensionModal component"
```

### Task 13: Create BanUserModal component

**Files:**
- Create: `src/components/moderation/BanUserModal.tsx`

- [ ] **Step 1: Create the BanUserModal**

Create `src/components/moderation/BanUserModal.tsx`:

Props interface:
```typescript
interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; duration_days?: number; suspend_content: boolean }) => void;
  userName: string;
}
```

Component features:
- Duration picker: 4 pill buttons — "7 days", "30 days", "90 days", "Permanent"
- `Permanent` pre-selected by default, stored as `undefined` for duration_days
- Reason text area (required)
- Checkbox: "Also suspend all of this user's approved events and clubs"
- Red themed submit button ("Ban User")
- Uses shadcn/ui Dialog component (same as RejectionModal)
- Submit disabled until reason is filled

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/BanUserModal.tsx
git commit -m "feat(ui): add BanUserModal component with duration picker"
```

### Task 14: Update moderation/events page with suspension

**Files:**
- Modify: `src/app/moderation/events/page.tsx`

- [ ] **Step 1: Add Suspended filter tab**

Find the existing status filter tabs (pending/approved/rejected) and add a "Suspended" tab with amber styling.

- [ ] **Step 2: Add Suspend button on approved events**

For rows where `event.status === "approved"`, add a "Suspend" button (amber themed).

- [ ] **Step 3: Add Restore button on suspended events**

For rows where `event.status === "suspended"`, add a "Restore" button (green themed) that calls the status API with `status: "approved"`.

- [ ] **Step 4: Wire up SuspensionModal**

Import `SuspensionModal`. When "Suspend" is clicked:
1. Open SuspensionModal
2. On submit, call `PATCH /api/admin/events/[id]/status` with `{ status: "suspended", category, message }`
3. Refresh the event list via SWR mutate

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/moderation/events/page.tsx
git commit -m "feat(ui): add event suspension and restore to moderation events page"
```

### Task 15: Update moderation/clubs page with suspension and emails

**Files:**
- Modify: `src/app/moderation/clubs/page.tsx`

- [ ] **Step 1: Add organizer email to club data fetch**

The clubs moderation page fetches clubs via the admin clubs API (`/api/admin/clubs`). Update the Supabase query in `src/app/api/admin/clubs/route.ts` to join the creator's info:

Change the select from `"*"` (or current fields) to include:
```typescript
.select("*, users!created_by(name, email)")
```

Then in the clubs page UI, display the creator email from `club.users.email` as a clickable `mailto:` link in a new column.

- [ ] **Step 2: Add Suspended filter tab**

Same as events — add "Suspended" filter tab with amber styling.

- [ ] **Step 3: Add Suspend/Restore buttons**

For approved clubs, show "Suspend" button. For suspended clubs, show "Restore" button. Wire to `PATCH /api/admin/clubs/[id]` with appropriate status.

- [ ] **Step 4: Wire up SuspensionModal**

Same pattern as events page — import and use SuspensionModal for club suspension.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/moderation/clubs/page.tsx
git commit -m "feat(ui): add club suspension, restore, and organizer email to moderation clubs page"
```

### Task 16: Update moderation/users page with ban/unban

**Files:**
- Modify: `src/app/moderation/users/page.tsx`

- [ ] **Step 1: Update user data fetch to include ban fields**

Update the Supabase query to select `banned_at, ban_expires_at, ban_reason`.

- [ ] **Step 2: Add ban status badge to user rows**

For each user, show ban status: "Banned (X days left)", "Banned (Permanent)", or nothing.

- [ ] **Step 3: Add Ban/Unban buttons**

- For non-banned users: show "Ban" button (red)
- For banned users: show "Unban" button (green)

- [ ] **Step 4: Wire up BanUserModal**

Import `BanUserModal`. When "Ban" is clicked:
1. Open BanUserModal
2. On submit, call `POST /api/admin/users/[id]/ban` with `{ reason, duration_days, suspend_content }`
3. Refresh user list via SWR mutate

Wire "Unban" button to call `DELETE /api/admin/users/[id]/ban` directly (no modal needed, but confirm with `window.confirm()`).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/moderation/users/page.tsx
git commit -m "feat(ui): add ban/unban functionality to moderation users page"
```

### Task 17: Wire ban/unban into organizer directory

**Files:**
- Modify: `src/app/moderation/organizers/page.tsx`

- [ ] **Step 1: Add ban/unban handlers**

Import `BanUserModal`. Wire "Ban" buttons to open BanUserModal and call the ban API. Wire "Unban" buttons to call the unban API with confirmation.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/organizers/page.tsx
git commit -m "feat(ui): wire ban/unban actions into organizer directory"
```

---

## Chunk 6: Final Integration & Testing

### Task 18: Add API ban protection utility

**Files:**
- Modify: `src/lib/ban.ts`

- [ ] **Step 1: Add checkBanStatus() for API routes**

Add to `src/lib/ban.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function checkBanStatus(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // Not authenticated, let other middleware handle

  const { data: profile } = await supabase
    .from("users")
    .select("banned_at, ban_expires_at")
    .eq("id", user.id)
    .single();

  if (profile && isBanned(profile)) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  return null; // Not banned, proceed
}
```

- [ ] **Step 2: Add checkBanStatus to content-creating routes**

Add `checkBanStatus()` calls to:
- `POST /api/events/create/route.ts` (event creation)
- `POST /api/clubs/route.ts` (club creation)
- `POST /api/events/[id]/appeal/route.ts` (appeal submission)
- `POST /api/clubs/[id]/appeal/route.ts` (appeal submission)

Pattern at top of each handler:
```typescript
const banResponse = await checkBanStatus();
if (banResponse) return banResponse;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ban.ts src/app/api/events/create/route.ts src/app/api/clubs/route.ts src/app/api/events/[id]/appeal/route.ts src/app/api/clubs/[id]/appeal/route.ts
git commit -m "feat(api): add ban status checks to content-creating routes"
```

### Task 19: Update public queries to hide suspended content

**Files:**
- Modify: Public event/club query files (search for `.eq("status", "approved")` patterns)

- [ ] **Step 1: Verify existing queries already filter**

Check that public-facing event and club queries already filter by `status = "approved"`. Since suspended items have a different status, they should already be excluded. Verify this in:
- `src/app/api/events/route.ts` (public event list)
- `src/app/api/clubs/route.ts` (public club list)
- Any other public-facing queries

If any queries do NOT filter by status, add `.eq("status", "approved")` or `.in("status", ["approved"])`.

- [ ] **Step 2: Commit if changes were needed**

```bash
git add src/app/api/events/route.ts src/app/api/clubs/route.ts
git commit -m "fix: ensure suspended content is hidden from public queries"
```

(Only stage the specific files that were modified.)

### Task 20: Run full build and lint

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Successful build with no errors.

- [ ] **Step 3: Run existing tests**

Run: `npx jest`
Expected: All existing tests pass.

- [ ] **Step 4: Final commit if any fixes needed**

Stage only the specific files that needed fixes, then commit:
```bash
git commit -m "fix: resolve lint and build issues from admin enforcement feature"
```
