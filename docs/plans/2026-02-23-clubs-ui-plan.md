# Clubs UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the user-facing clubs pages: browse clubs, club detail, create club, and admin club moderation.

**Architecture:** Add `status` and `category` columns to clubs table via Supabase migration. Build 4 new pages (`/clubs`, `/clubs/[id]`, `/clubs/create`, `/moderation/clubs`) and 3 new API routes (`POST /api/clubs`, `GET /api/admin/clubs`, `PATCH /api/admin/clubs/[id]`). Update existing `GET /api/clubs` to filter by approved status. Add navigation entries.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Lucide icons

---

### Task 1: Database Migration — Add `status` and `category` to clubs

**Files:**
- Create: `supabase/migrations/20260223_add_clubs_status_category.sql`

**Step 1: Write the migration SQL**

```sql
-- Add status column (default 'approved' so existing clubs remain visible)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Add category column (nullable)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS category text;

-- Add created_by column to track who created the club (for granting organizer on approval)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
```

**Step 2: Run the migration via Supabase dashboard**

Apply the SQL in the Supabase SQL Editor. Verify with:
```sql
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'clubs' AND column_name IN ('status', 'category', 'created_by');
```

**Step 3: Update TypeScript types**

Modify: `src/types/index.ts`

Update the `Club` interface to add the new fields:

```typescript
export interface Club {
  id: string;
  name: string;
  instagram_handle: string | null;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260223_add_clubs_status_category.sql src/types/index.ts
git commit -m "feat: add status, category, created_by columns to clubs table"
```

---

### Task 2: Update `GET /api/clubs` to filter by approved status

**Files:**
- Modify: `src/app/api/clubs/route.ts`

**Step 1: Add approved filter**

Update the existing query to only return approved clubs:

```typescript
const { data: clubs, error } = await supabase
  .from("clubs")
  .select("*")
  .eq("status", "approved")
  .order("name", { ascending: true });
```

**Step 2: Verify the dev server still works**

Run: `npm run dev`
Visit: `http://localhost:3000/api/clubs`
Expected: JSON with `{ clubs: [...] }` containing only approved clubs.

**Step 3: Commit**

```bash
git add src/app/api/clubs/route.ts
git commit -m "feat: filter GET /api/clubs to approved clubs only"
```

---

### Task 3: Add `POST /api/clubs` — Create club endpoint

**Files:**
- Modify: `src/app/api/clubs/route.ts` (add POST handler to existing file)

**Step 1: Add POST handler**

Add to the existing `src/app/api/clubs/route.ts`:

```typescript
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, instagram_handle, logo_url } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Club name is required" },
        { status: 400 }
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    const { data: club, error } = await supabase
      .from("clubs")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        instagram_handle: instagram_handle?.trim() || null,
        logo_url: logo_url?.trim() || null,
        status: "pending",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating club:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ club }, { status: 201 });
  } catch (error) {
    console.error("Error in club creation:", error);
    return NextResponse.json(
      { error: "Failed to create club" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/clubs/route.ts
git commit -m "feat: add POST /api/clubs for club creation"
```

---

### Task 4: Add admin club APIs — `GET /api/admin/clubs` and `PATCH /api/admin/clubs/[id]`

**Files:**
- Create: `src/app/api/admin/clubs/route.ts`
- Create: `src/app/api/admin/clubs/[id]/route.ts`

**Step 1: Create `GET /api/admin/clubs`**

Follow the exact pattern from `src/app/api/admin/organizer-requests/route.ts`:

```typescript
// src/app/api/admin/clubs/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";

  let query = supabase
    .from("clubs")
    .select("*, creator:users!clubs_created_by_fkey(id, email, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching admin clubs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clubs: data ?? [], total: count ?? 0 });
}
```

**Step 2: Create `PATCH /api/admin/clubs/[id]`**

Follow the pattern from `src/app/api/admin/organizer-requests/[id]/route.ts`:

```typescript
// src/app/api/admin/clubs/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("admin")) {
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

  // Fetch the club to get created_by
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

  // Update club status
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

  // If approved and club has a creator, make them an organizer
  if (status === "approved" && club.created_by) {
    // Add club_organizer role if not present
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

    // Add to club_members as organizer
    await serviceClient.from("club_members").upsert(
      {
        user_id: club.created_by,
        club_id: id,
        role: "organizer",
      },
      { onConflict: "user_id,club_id" }
    );

    // Notify the creator
    try {
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_approved",
        title: "Club Approved!",
        message: `Your club "${club.name}" has been approved. You are now an organizer and can create events.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  // Notify creator of rejection
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

**Step 3: Commit**

```bash
git add src/app/api/admin/clubs/route.ts src/app/api/admin/clubs/[id]/route.ts
git commit -m "feat: add admin club moderation APIs (list + approve/reject)"
```

---

### Task 5: Add "Clubs" to navigation

**Files:**
- Modify: `src/components/layout/navItems.ts`
- Modify: `src/app/moderation/ModerationNav.tsx`

**Step 1: Add Clubs to side nav**

In `src/components/layout/navItems.ts`:

Add to `guestNavItems` (after Calendar):
```typescript
{ name: "Clubs", path: "/clubs", icon: Building2 },
```

Add to `baseNavItems` (after Categories):
```typescript
{ name: "Clubs", path: "/clubs", icon: Building2 },
```

Add to `adminNavItems` (after Organizer Requests):
```typescript
{ name: "Clubs", path: "/moderation/clubs", icon: Building2 },
```

`Building2` is already imported.

**Step 2: Add Clubs to ModerationNav**

In `src/app/moderation/ModerationNav.tsx`, add `Building2` to imports and add to `navItems`:

```typescript
{ name: "Clubs", path: "/moderation/clubs", icon: Building2 },
```

**Step 3: Commit**

```bash
git add src/components/layout/navItems.ts src/app/moderation/ModerationNav.tsx
git commit -m "feat: add Clubs to side nav and moderation nav"
```

---

### Task 6: Browse Clubs page (`/clubs`)

**Files:**
- Create: `src/app/clubs/page.tsx`

**Step 1: Build the browse clubs page**

This is a client component that fetches from `GET /api/clubs` and renders a filterable grid.

```typescript
// src/app/clubs/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Instagram, Loader2, Search, Plus } from "lucide-react";
import Link from "next/link";
import type { Club } from "@/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";

const CLUB_CATEGORIES = Object.entries(EVENT_CATEGORIES).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export default function BrowseClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch("/api/clubs");
        if (res.ok) {
          const data = await res.json();
          setClubs(data.clubs ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchClubs();
  }, []);

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const matchesSearch =
        !searchQuery ||
        club.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || club.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [clubs, searchQuery, selectedCategory]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Clubs
          </h1>
          <p className="text-muted-foreground">
            Discover student clubs and organizations at McGill
          </p>
        </div>
        {user && (
          <Link href="/clubs/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Club
            </Button>
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {CLUB_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.value ? null : cat.value
                )
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mb-6" />
          <p className="text-xl font-semibold mb-2 text-foreground">
            No clubs found
          </p>
          <p className="text-base text-muted-foreground max-w-md">
            {searchQuery || selectedCategory
              ? "Try adjusting your search or filters."
              : "No clubs have been added yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border/60 hover:border-primary/30 h-full">
                <div className="flex items-start gap-3 mb-3">
                  {club.logo_url ? (
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {club.name}
                    </h3>
                    {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {EVENT_CATEGORIES[club.category as EventTag].label}
                      </Badge>
                    )}
                  </div>
                </div>

                {club.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {club.description}
                  </p>
                )}

                {club.instagram_handle && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Instagram className="h-3.5 w-3.5" />
                    <span>@{club.instagram_handle.replace("@", "")}</span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

Run: `npm run dev`
Visit: `http://localhost:3000/clubs`
Expected: Page loads, shows clubs grid, search and category filters work.

**Step 3: Commit**

```bash
git add src/app/clubs/page.tsx
git commit -m "feat: add browse clubs page with search and category filters"
```

---

### Task 7: Club Detail page (`/clubs/[id]`)

**Files:**
- Create: `src/app/clubs/[id]/page.tsx`

**Step 1: Build the club detail page**

```typescript
// src/app/clubs/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Instagram,
  Loader2,
  CalendarDays,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { Club, Event } from "@/types";
import { EventTag } from "@/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventCard } from "@/components/events/EventCard";
import { OrganizerRequestDialog } from "@/components/clubs/OrganizerRequestDialog";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const { user } = useAuthStore();

  const fetchClub = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Club not found" : "Failed to load club");
        return;
      }
      const data = await res.json();
      setClub(data.club);
      setEvents(data.events ?? []);
    } catch {
      setError("Failed to load club");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClub();
  }, [fetchClub]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
          <p className="text-xl font-semibold mb-2">{error || "Club not found"}</p>
          <Link href="/clubs">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clubs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All Clubs
      </Link>

      {/* Club Header */}
      <div className="flex items-start gap-4 mb-8">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="h-20 w-20 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground mb-1">
            {club.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
              <Badge variant="secondary">
                {EVENT_CATEGORIES[club.category as EventTag].label}
              </Badge>
            )}
            {club.instagram_handle && (
              <a
                href={`https://instagram.com/${club.instagram_handle.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-4 w-4" />
                @{club.instagram_handle.replace("@", "")}
              </a>
            )}
          </div>
          {club.description && (
            <p className="text-muted-foreground">{club.description}</p>
          )}
        </div>
      </div>

      {/* Request Organizer Access button */}
      {user && (
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => setRequestDialogOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Request Organizer Access
          </Button>
          <OrganizerRequestDialog
            open={requestDialogOpen}
            onOpenChange={setRequestDialogOpen}
            clubId={club.id}
            clubName={club.name}
          />
        </div>
      )}

      {/* Upcoming Events */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Upcoming Events
        </h2>
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No upcoming events for this club.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit: `http://localhost:3000/clubs/<some-club-id>`
Expected: Club header with info, events grid below, organizer request button visible when logged in.

**Step 3: Commit**

```bash
git add src/app/clubs/[id]/page.tsx
git commit -m "feat: add club detail page with events and organizer request"
```

---

### Task 8: Create Club page (`/clubs/create`)

**Files:**
- Create: `src/app/clubs/create/page.tsx`

**Step 1: Build the create club form**

```typescript
// src/app/clubs/create/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";

const CATEGORY_OPTIONS = Object.entries(EVENT_CATEGORIES).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export default function CreateClubPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          category,
          instagram_handle: instagramHandle || null,
          logo_url: logoUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create club");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center py-20">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Club Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your club has been submitted for admin review. You&apos;ll be notified
            once it&apos;s approved.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/clubs">
              <Button variant="outline">Browse Clubs</Button>
            </Link>
            <Button onClick={() => { setSuccess(false); setName(""); setDescription(""); setCategory(""); setInstagramHandle(""); setLogoUrl(""); }}>
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clubs
      </Link>

      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-7 w-7" />
          Create a Club
        </h1>
        <p className="text-muted-foreground mb-6">
          Register a new club or organization. An admin will review your
          submission before it goes live.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="club-name" className="text-sm font-semibold text-foreground">
                Club Name <span className="text-destructive">*</span>
              </label>
              <input
                id="club-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. McGill Robotics"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="club-category" className="text-sm font-semibold text-foreground">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                id="club-category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a category</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="club-description" className="text-sm font-semibold text-foreground">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="club-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your club does..."
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="club-instagram" className="text-sm font-semibold text-foreground">
                Instagram Handle{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="club-instagram"
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="e.g. mcgillrobotics"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="club-logo" className="text-sm font-semibold text-foreground">
                Logo URL{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="club-logo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Club for Review"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit: `http://localhost:3000/clubs/create` (must be logged in)
Expected: Form renders, submit creates pending club, shows success state.

**Step 3: Commit**

```bash
git add src/app/clubs/create/page.tsx
git commit -m "feat: add create club page with pending approval flow"
```

---

### Task 9: Club Moderation page (`/moderation/clubs`)

**Files:**
- Create: `src/app/moderation/clubs/page.tsx`

**Step 1: Build the moderation page**

Follow the exact pattern from `src/app/moderation/organizer-requests/page.tsx`:

```typescript
// src/app/moderation/clubs/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  Tag,
} from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";

interface ClubWithCreator {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
  creator: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export default function ClubModerationPage() {
  const [clubs, setClubs] = useState<ClubWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    const res = await fetch(`/api/admin/clubs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setClubs(data.clubs ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const handleAction = async (clubId: string, status: "approved" | "rejected") => {
    setActionLoading(clubId);
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

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Club Management</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve new club registrations
          </p>
        </div>
        <Badge variant="secondary">{clubs.length} {statusFilter}</Badge>
      </div>

      <div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : clubs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No {statusFilter === "all" ? "" : statusFilter} clubs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {club.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      {club.creator && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {club.creator.name || club.creator.email}
                        </span>
                      )}
                      {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          {EVENT_CATEGORIES[club.category as EventTag].label}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(club.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor(club.status)}`}>
                    {club.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {club.description && (
                  <div className="bg-muted/50 rounded-md p-3 mb-4">
                    <p className="text-sm">{club.description}</p>
                  </div>
                )}
                {club.instagram_handle && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Instagram: @{club.instagram_handle.replace("@", "")}
                  </p>
                )}
                {club.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(club.id, "approved")}
                      disabled={actionLoading === club.id}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction(club.id, "rejected")}
                      disabled={actionLoading === club.id}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit: `http://localhost:3000/moderation/clubs` (must be logged in as admin)
Expected: Lists pending clubs, approve/reject works.

**Step 3: Commit**

```bash
git add src/app/moderation/clubs/page.tsx
git commit -m "feat: add club moderation page for admin approve/reject"
```

---

### Task 10: Verify build and check for type errors

**Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors.

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: resolve any build/lint issues from clubs UI"
```

---

### Summary of all files

| Action | File |
|--------|------|
| Create | `supabase/migrations/20260223_add_clubs_status_category.sql` |
| Modify | `src/types/index.ts` |
| Modify | `src/app/api/clubs/route.ts` |
| Create | `src/app/api/admin/clubs/route.ts` |
| Create | `src/app/api/admin/clubs/[id]/route.ts` |
| Modify | `src/components/layout/navItems.ts` |
| Modify | `src/app/moderation/ModerationNav.tsx` |
| Create | `src/app/clubs/page.tsx` |
| Create | `src/app/clubs/[id]/page.tsx` |
| Create | `src/app/clubs/create/page.tsx` |
| Create | `src/app/moderation/clubs/page.tsx` |
