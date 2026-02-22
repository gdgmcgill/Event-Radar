# Admin Interface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully functional admin interface with shared email/password login, event management (CRUD + approve/reject), user management, and club management.

**Architecture:** Separate admin login via Supabase email/password auth. `is_admin` boolean on `public.users` gates access. Admin pages live under `/admin/*` using the existing app layout with conditional admin nav items. All admin API routes verify `is_admin` server-side before processing.

**Tech Stack:** Next.js App Router, Supabase (auth + DB), Tailwind CSS, shadcn/ui, Zustand (auth store), Lucide icons.

---

### Task 1: DB Migration — Add `is_admin` column

**Files:**
- Supabase migration (via MCP)
- Modify: `src/types/index.ts`

**Step 1: Run migration**

Apply via Supabase MCP `apply_migration`:
```sql
ALTER TABLE public.users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
UPDATE public.users SET is_admin = true WHERE email = 'admin@mcgill.ca';
```
Migration name: `add_is_admin_to_users`

**Step 2: Update TypeScript User interface**

In `src/types/index.ts`, add `is_admin` to the `User` interface:
```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: string[];
  is_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
}
```

**Step 3: Update auth store to include is_admin**

In `src/store/useAuthStore.ts`, update `fetchAndSetUser` to include `is_admin`. Since we skip the DB fetch currently, default it to `false` from auth data, then fetch from DB for admin status:

```typescript
const fetchAndSetUser = async (authUser: { ... }) => {
  // Fetch is_admin from public.users
  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", authUser.id)
    .single();

  const finalUser: AppUser = {
    id: authUser.id,
    email: authUser.email ?? "",
    name: (authUser.user_metadata?.name as string) ?? (authUser.user_metadata?.full_name as string) ?? null,
    avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
    interest_tags: [],
    is_admin: profile?.is_admin ?? false,
    created_at: authUser.created_at,
    updated_at: authUser.updated_at ?? authUser.created_at,
  };
  set({ user: finalUser, loading: false });
};
```

**Step 4: Regenerate Supabase types**

Run Supabase MCP `generate_typescript_types` and update `src/lib/supabase/types.ts` if needed.

**Step 5: Commit**
```bash
git add src/types/index.ts src/store/useAuthStore.ts
git commit -m "feat: add is_admin column to users table and update types"
```

---

### Task 2: Admin Login Page

**Files:**
- Replace: `src/app/admin/test-login/page.tsx` → delete
- Create: `src/app/admin/login/page.tsx`

**Step 1: Delete test login page**
```bash
rm -rf src/app/admin/test-login
```

**Step 2: Create admin login page**

Create `src/app/admin/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Verify is_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Authentication failed");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      setError("This account does not have admin privileges.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with your admin credentials
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                placeholder="admin@mcgill.ca"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add -A src/app/admin/login src/app/admin/test-login
git commit -m "feat: add admin login page, remove test login"
```

---

### Task 3: Admin Layout Guard

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Step 1: Rewrite admin layout with auth guard**

Replace `src/app/admin/layout.tsx` entirely:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow unauthenticated access to login page only
  // (check is done via pathname workaround — login page has no guard)

  if (!user) {
    redirect("/admin/login");
  }

  // Check admin status
  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return <>{children}</>;
}
```

**Important:** The `/admin/login` page needs its own layout that does NOT check auth. Move it outside the admin layout or create a route group.

Create `src/app/admin/login/layout.tsx` to bypass the admin guard:
```tsx
export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

Actually, Next.js nested layouts don't bypass parent layouts. Better approach: move login outside `/admin` or use a route group.

**Revised approach:** Create `src/app/(admin-login)/admin/login/page.tsx` as a route group, OR simpler — in the admin layout, detect the login path and skip the guard. Simplest: check if the current path is `/admin/login` by accepting a prop.

**Simplest solution:** In the admin layout, import `headers` to detect the path:
```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-next-pathname") || "";

  // Skip auth check for login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return <>{children}</>;
}
```

Note: `x-next-pathname` may not be available. A more reliable approach is to use middleware. Add to `src/middleware.ts` matcher config:
- For `/admin/login`, skip admin check
- For `/admin/*` (not login), check `is_admin`

**Final approach for robustness:** Handle admin auth in middleware AND layout. But simplest working solution: the admin layout always runs auth check, and the login page uses a route group `(auth)` outside of `/admin`.

**Decision:** Move login page to `src/app/admin-login/page.tsx` route (outside admin layout). Simple, no hacks.

**Step 2: Commit**
```bash
git add src/app/admin/layout.tsx src/app/admin-login/page.tsx
git commit -m "feat: add admin layout auth guard"
```

---

### Task 4: Admin Nav Items in SideNavBar

**Files:**
- Modify: `src/components/layout/navItems.ts`
- Modify: `src/components/layout/SideNavBar.tsx`

**Step 1: Add admin nav items to navItems.ts**

Add to `src/components/layout/navItems.ts`:
```typescript
import {
  Home, Search, Calendar, Tag, Bookmark, Bell, Plus, Info, User,
  LayoutDashboard, FileQuestion, List, Users, Building2,
} from "lucide-react";

// ... existing items ...

export const adminNavItems: NavItem[] = [
  { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { name: "Pending", path: "/admin/pending", icon: FileQuestion },
  { name: "All Events", path: "/admin/events", icon: List },
  { name: "Users", path: "/admin/users", icon: Users },
  { name: "Clubs", path: "/admin/clubs", icon: Building2 },
];
```

**Step 2: Update SideNavBar to show admin items**

In `src/components/layout/SideNavBar.tsx`, import `adminNavItems` and conditionally render them when `user?.is_admin` is true. Add a divider label "Admin" above the admin nav section.

**Step 3: Commit**
```bash
git add src/components/layout/navItems.ts src/components/layout/SideNavBar.tsx
git commit -m "feat: add admin navigation items to sidebar"
```

---

### Task 5: Admin Stats API

**Files:**
- Create: `src/app/api/admin/stats/route.ts`

**Step 1: Create stats endpoint**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch counts in parallel
  const [events, pending, approved, users, clubs] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    totalEvents: events.count ?? 0,
    pendingEvents: pending.count ?? 0,
    approvedEvents: approved.count ?? 0,
    totalUsers: users.count ?? 0,
    totalClubs: clubs.count ?? 0,
  });
}
```

**Step 2: Commit**
```bash
git add src/app/api/admin/stats/route.ts
git commit -m "feat: add admin stats API endpoint"
```

---

### Task 6: Admin Dashboard Page (live stats)

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Rewrite dashboard with live data**

Convert to server component that fetches stats, or client component that calls the stats API. Server component is simpler:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CheckCircle, FileQuestion, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [events, pending, approved, users, clubs, recentEvents] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id, title, status, created_at, club:clubs(name)").order("created_at", { ascending: false }).limit(10),
  ]);

  const stats = [
    { label: "Total Events", value: events.count ?? 0, icon: Calendar },
    { label: "Pending", value: pending.count ?? 0, icon: FileQuestion },
    { label: "Approved", value: approved.count ?? 0, icon: CheckCircle },
    { label: "Users", value: users.count ?? 0, icon: Users },
    { label: "Clubs", value: clubs.count ?? 0, icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/admin/pending">
          <Button variant="outline">Review Pending ({pending.count ?? 0})</Button>
        </Link>
        <Link href="/admin/events">
          <Button variant="outline">Manage Events</Button>
        </Link>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(recentEvents.data ?? []).map((event: any) => (
              <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.club?.name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  event.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                  event.status === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>{event.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add src/app/admin/page.tsx
git commit -m "feat: admin dashboard with live stats and recent activity"
```

---

### Task 7: Event Status API (approve/reject)

**Files:**
- Create: `src/app/api/admin/events/[id]/status/route.ts`
- Create: `src/lib/admin.ts` (shared admin verification helper)

**Step 1: Create admin verification helper**

Create `src/lib/admin.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";

export async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { supabase, user, isAdmin: profile?.is_admin ?? false };
}
```

**Step 2: Create status endpoint**

Create `src/app/api/admin/events/[id]/status/route.ts`:
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "approved") {
    updateData.approved_by = user.id;
    updateData.approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("events")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**
```bash
git add src/lib/admin.ts src/app/api/admin/events/[id]/status/route.ts
git commit -m "feat: add event approve/reject API and admin helper"
```

---

### Task 8: Pending Events Page (functional)

**Files:**
- Modify: `src/app/admin/pending/page.tsx`

**Step 1: Rewrite with data fetching and approve/reject**

Full rewrite of `src/app/admin/pending/page.tsx` as a client component that:
- Fetches pending events from `/api/admin/events?status=pending` (or directly via Supabase client)
- Shows event cards with title, description, club name, date, tags
- Approve/reject buttons that call `/api/admin/events/[id]/status`
- Optimistic UI update on approve/reject
- Empty state when no pending events

**Step 2: Commit**
```bash
git add src/app/admin/pending/page.tsx
git commit -m "feat: functional pending events page with approve/reject"
```

---

### Task 9: Admin Events CRUD API

**Files:**
- Modify: `src/app/api/admin/events/route.ts` (GET + POST)
- Create: `src/app/api/admin/events/[id]/route.ts` (PUT + DELETE)

**Step 1: Implement GET and POST on existing route**

Rewrite `src/app/api/admin/events/route.ts`:
- GET: List all events with optional `?status=` filter, includes club info, paginated
- POST: Create event with auto-approved status (uncomment existing stub)

**Step 2: Create [id] route for PUT and DELETE**

Create `src/app/api/admin/events/[id]/route.ts`:
- PUT: Update event fields
- DELETE: Delete event

Both verify admin via `verifyAdmin()`.

**Step 3: Commit**
```bash
git add src/app/api/admin/events/
git commit -m "feat: admin events CRUD API endpoints"
```

---

### Task 10: All Events Management Page

**Files:**
- Create: `src/app/admin/events/page.tsx`

**Step 1: Create events management page**

Client component with:
- Table showing all events (any status) with columns: title, club, date, status, actions
- Search input to filter by title
- Status filter dropdown (all/pending/approved/rejected)
- Edit button → opens inline edit or modal
- Delete button → confirmation dialog then DELETE API call
- Link to create new event

**Step 2: Commit**
```bash
git add src/app/admin/events/page.tsx
git commit -m "feat: admin events management page"
```

---

### Task 11: Users Management API + Page

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/admin/users/page.tsx`

**Step 1: Create users API**

`GET /api/admin/users` — returns all users with counts:
```sql
SELECT u.*,
  (SELECT count(*) FROM saved_events WHERE user_id = u.id) as saved_count
FROM users u ORDER BY created_at DESC
```

`PATCH /api/admin/users/[id]` — toggle `is_admin`, edit name

**Step 2: Create users management page**

Table with: name, email, joined date, is_admin toggle, saved events count.

**Step 3: Commit**
```bash
git add src/app/api/admin/users/ src/app/admin/users/
git commit -m "feat: admin users management page and API"
```

---

### Task 12: Clubs Management API + Page

**Files:**
- Create: `src/app/api/admin/clubs/route.ts`
- Create: `src/app/admin/clubs/page.tsx`

**Step 1: Create clubs API**

`GET /api/admin/clubs` — returns all clubs with event counts.

**Step 2: Create clubs management page**

Table with: name, description, instagram, event count, created date.

**Step 3: Commit**
```bash
git add src/app/api/admin/clubs/ src/app/admin/clubs/
git commit -m "feat: admin clubs management page and API"
```

---

### Task 13: Cleanup and Final Verification

**Step 1: Delete test login page if still present**
```bash
rm -rf src/app/admin/test-login
```

**Step 2: Type check**
```bash
npx tsc --noEmit
```

**Step 3: Lint**
```bash
npm run lint
```

**Step 4: Manual smoke test**
- Go to `/admin/login`, sign in with `admin@mcgill.ca` / `TestAdmin123!`
- Verify dashboard shows real stats
- Verify pending events page loads
- Approve/reject an event
- Check events management page
- Check users page, toggle admin on another user
- Check clubs page
- Sign out, verify redirect to login

**Step 5: Final commit**
```bash
git add -A
git commit -m "chore: cleanup admin interface implementation"
```
