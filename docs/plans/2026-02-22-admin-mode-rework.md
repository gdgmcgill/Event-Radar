# Admin Mode Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken, inconsistent admin/moderation system — remove legacy code, fix schema mismatches, eliminate the misleading AdminModeToggle, and make the nav + data display robust.

**Architecture:** Remove the cosmetic `adminMode` state from Zustand entirely. Admin access is already properly enforced server-side in `moderation/layout.tsx`. The sidebar/header just need a simple link to `/moderation` for admin users. Delete all legacy `/admin` and `/admin-login` routes. Fix the `Event` TypeScript interface to match the actual database schema (`start_date`/`end_date` instead of `event_date`/`event_time`).

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Zustand, Tailwind/shadcn

---

## Task 1: Delete legacy `/admin` and `/admin-login` routes

**Files:**
- Delete: `src/app/admin/page.tsx`
- Delete: `src/app/admin/pending/page.tsx`
- Delete: `src/app/admin/clubs/page.tsx`
- Delete: `src/app/admin/events/page.tsx`
- Delete: `src/app/admin/layout.tsx`
- Delete: `src/app/admin/users/page.tsx`
- Delete: `src/app/admin-login/page.tsx`

**Step 1: Delete all legacy admin files**

```bash
rm -rf src/app/admin src/app/admin-login
```

**Step 2: Verify no imports reference deleted paths**

```bash
grep -r "admin-login\|/admin\"" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|/api/admin\|/moderation"
```

Expected: No results (or only the moderation layout redirect which we fix in Task 2).

**Step 3: Fix moderation layout redirect**

In `src/app/moderation/layout.tsx`, change the unauthenticated redirect from `/admin-login` to `/` (the home page — users should log in through normal flow).

```typescript
// Before:
if (!user) {
  redirect("/admin-login");
}

// After:
if (!user) {
  redirect("/");
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy /admin and /admin-login routes"
```

---

## Task 2: Remove AdminModeToggle and `adminMode` from Zustand

The `adminMode` state is purely cosmetic — real admin access is enforced server-side. Remove it entirely.

**Files:**
- Delete: `src/components/layout/AdminModeToggle.tsx`
- Modify: `src/store/useAuthStore.ts` — remove `adminMode`, `setAdminMode`, localStorage logic
- Modify: `src/app/profile/page.tsx` — remove AdminModeToggle import and usage, replace with a simple "Go to Moderation" link

**Step 1: Delete AdminModeToggle component**

```bash
rm src/components/layout/AdminModeToggle.tsx
```

**Step 2: Simplify useAuthStore.ts**

Remove from the interface:
- `adminMode: boolean`
- `setAdminMode: (value: boolean) => void`

Remove from the store:
- `adminMode: false` initial state
- The entire localStorage restore block in `initialize` (lines 33-40)
- The `adminMode` update logic in `fetchAndSetUser` (lines 91-95)
- The entire `setAdminMode` method (lines 171-180)
- The `adminMode` reset in `signOut` (lines 184-185)

The simplified store should only manage: `user`, `loading`, `initialized`, `initialize()`, `signOut()`.

**Step 3: Update profile page**

In `src/app/profile/page.tsx`:
- Remove `import { AdminModeToggle }` (line 10)
- Replace the AdminModeToggle section (lines 131-136) with a simple link:

```tsx
{isAdmin && (
  <div className="p-3 rounded-xl border border-border/60 bg-muted/30">
    <Link href="/moderation" className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Moderation Dashboard</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  </div>
)}
```

**Step 4: Verify no remaining references to AdminModeToggle or adminMode**

```bash
grep -r "AdminModeToggle\|adminMode\|admin_mode\|setAdminMode" src/ --include="*.ts" --include="*.tsx"
```

Expected: No results.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove cosmetic adminMode state and AdminModeToggle"
```

---

## Task 3: Fix Event TypeScript interface to match database schema

The `Event` interface uses `event_date`/`event_time` but the actual database uses `start_date`/`end_date`. The rest of the codebase already uses the correct column names.

**Files:**
- Modify: `src/types/index.ts` — fix Event interface

**Step 1: Update Event interface**

Replace:
```typescript
event_date: string; // ISO date string
event_time: string; // HH:mm format
```

With:
```typescript
start_date: string; // ISO datetime string
end_date: string | null; // ISO datetime string
organizer: string | null; // organizer name
```

Also remove `club_id` from required (make nullable) since admin-created events may not have one, and add the `category` field used in the admin events API:

```typescript
club_id: string | null;
category: string | null;
```

**Step 2: Fix any TypeScript errors from the interface change**

Search for `event_date` and `event_time` usage:

```bash
grep -r "event_date\|event_time" src/ --include="*.ts" --include="*.tsx"
```

Update any files that reference the old field names.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: align Event type with actual database schema (start_date/end_date)"
```

---

## Task 4: Fix moderation dashboard to use service client consistently

The dashboard mixes regular client (which respects RLS) and service client. Admin pages should use the service client to bypass RLS and ensure data is always visible.

**Files:**
- Modify: `src/app/moderation/page.tsx` — use service client for all queries

**Step 1: Update moderation dashboard**

Replace the mixed client usage. Change all queries to use `serviceClient` instead of the regular `supabase` client:

```typescript
import { createServiceClient } from "@/lib/supabase/service";

export default async function ModerationDashboardPage() {
  const serviceClient = createServiceClient();

  const [events, pending, approved, users, organizerRequests, recentEvents] =
    await Promise.all([
      serviceClient.from("events").select("id", { count: "exact", head: true }),
      serviceClient.from("events").select("id", { count: "exact", head: true }).eq("status", "pending"),
      serviceClient.from("events").select("id", { count: "exact", head: true }).eq("status", "approved"),
      serviceClient.from("users").select("id", { count: "exact", head: true }),
      serviceClient.from("organizer_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      serviceClient.from("events")
        .select("id, title, status, created_at, organizer")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  // ... rest stays the same
}
```

Remove the regular `createClient` import since it's no longer used.

Note: This is safe because the moderation layout already verifies admin role server-side before rendering any children.

**Step 2: Commit**

```bash
git add -A
git commit -m "fix: use service client in moderation dashboard for reliable data access"
```

---

## Task 5: Simplify auth store initialization

Remove the fragile 3-second fallback timeout. The `onAuthStateChange` with `INITIAL_SESSION` is reliable and sufficient.

**Files:**
- Modify: `src/store/useAuthStore.ts`

**Step 1: Remove the fallback timeout and `initialFetch`**

Delete:
- The `initialFetch` function (lines 105-130)
- The `initialSessionHandled` variable (line 134)
- The `setTimeout` fallback (lines 162-168)

Simplify `onAuthStateChange` to:

```typescript
const supabase = createClient();

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    set({ user: null, loading: false });
    return;
  }

  if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    await fetchAndSetUser(session.user);
  }
});
```

Also remove all `console.log("[Auth]...")` debug statements — they clutter the browser console in production.

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: simplify auth initialization, remove fallback timeout"
```

---

## Task 6: Add error feedback to moderation action handlers

Currently, approve/reject/delete actions silently fail. Add toast or inline error feedback.

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`
- Modify: `src/app/moderation/events/page.tsx`
- Modify: `src/app/moderation/organizer-requests/page.tsx`
- Modify: `src/app/moderation/users/page.tsx`

**Step 1: Add error state and feedback to each page**

For each page, add an `error` state and display it. Example for pending page:

```typescript
const [error, setError] = useState<string | null>(null);

const handleAction = async (eventId: string, status: "approved" | "rejected") => {
  setActionLoading(eventId);
  setError(null);
  try {
    const res = await fetch(`/api/admin/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Failed to ${status === "approved" ? "approve" : "reject"} event`);
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  } catch {
    setError("Network error. Please try again.");
  } finally {
    setActionLoading(null);
  }
};
```

Add error display at the top of each page content:

```tsx
{error && (
  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
    <AlertCircle className="h-4 w-4 flex-shrink-0" />
    {error}
    <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
  </div>
)}
```

Apply the same pattern to all four moderation pages.

**Step 2: Commit**

```bash
git add -A
git commit -m "fix: add error feedback to moderation action handlers"
```

---

## Task 7: Verify build and cleanup

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any errors.

**Step 2: Run linter**

```bash
npm run lint
```

Fix any errors.

**Step 3: Test dev server**

```bash
npm run dev
```

Manually verify:
- Home page loads (no regressions)
- `/moderation` redirects to `/` if not logged in
- Nav shows "Moderation" link only for admin users
- Profile page shows "Moderation Dashboard" link for admins
- No references to old `/admin` routes

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build and lint errors from admin rework"
```
