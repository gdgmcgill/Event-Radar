# Club Dashboard Revamp Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the `/my-clubs/[id]` club organizer dashboard with a hybrid collapsed-sidebar layout, full hero section, enhanced analytics, improved member management, complete settings, and responsive design.

**Architecture:** The AppShell `SideNavBar` gains a `collapsed` prop for dashboard routes, collapsing to a 72px icon rail. The dashboard removes its custom sidebar/header in favor of a hero section (reusing the public `/clubs/[id]` visual pattern) and horizontal tab bar. New API endpoints support role changes, ownership transfer, and club deletion.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Recharts, SWR, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-15-club-dashboard-revamp-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/clubs/ClubDashboardHero.tsx` | Hero section: banner, logo overlap, stats, actions, edit banner overlay |
| `src/app/api/clubs/[id]/members/role/route.ts` | PATCH endpoint for changing member roles |
| `src/app/api/clubs/[id]/transfer/route.ts` | POST endpoint for ownership transfer |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `contact_email` to `Club`, extend `ClubAnalytics` with new fields |
| `src/components/layout/SideNavBar.tsx` | Accept `collapsed` prop to force icon-only mode |
| `src/components/layout/AppShell.tsx` | Detect dashboard routes, suppress footer, pass `collapsed` to sidebar |
| `src/components/clubs/ClubDashboard.tsx` | Remove custom sidebar/header, use hero + horizontal tabs, pass collapsed layout |
| `src/components/clubs/ClubOverviewTab.tsx` | Add engagement rate stat card, trend indicators |
| `src/components/clubs/ClubSettingsTab.tsx` | Add banner upload, contact email, all social links, danger zone |
| `src/components/clubs/ClubAnalyticsTab.tsx` | Add engagement trend chart, peak activity, best event type insight |
| `src/components/clubs/ClubMembersTab.tsx` | Add role changing, bulk invite, member activity, search |
| `src/components/clubs/ClubCompletionNudge.tsx` | Add contact_email to checklist |
| `src/app/api/clubs/[id]/route.ts` | Add `contact_email` to allowed PATCH fields, add DELETE handler |
| `src/app/api/clubs/[id]/analytics/route.ts` | Add engagement trend, peak hours/days, best event type queries |

---

## Chunk 1: Foundation — Types, Layout, and Hero

### Task 1: Add `contact_email` to Club type and extend ClubAnalytics

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `contact_email` to Club interface**

In `src/types/index.ts`, add `contact_email` after `linkedin_url`:

```typescript
// In the Club interface, after linkedin_url: string | null;
contact_email: string | null;
```

Also update the `status` union to include `"deleted"` for soft-delete support:

```typescript
// Change: status: "pending" | "approved" | "rejected";
// To:
status: "pending" | "approved" | "rejected" | "deleted";
```

- [ ] **Step 2: Extend ClubAnalytics interface**

In `src/types/index.ts`, add new fields to `ClubAnalytics`:

```typescript
export interface ClubAnalytics {
  follower_growth: { date: string; count: number }[];
  total_attendees: number;
  popular_tags: { tag: string; count: number }[];
  events: EventAnalytics[];
  // New fields
  engagement_trend: { date: string; rate: number }[];
  peak_hours: { hour: number; count: number }[];
  peak_days: { day: string; count: number }[];
  best_event_type: { tag: string; avg_rsvps: number; comparison: number } | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add contact_email to Club and extend ClubAnalytics"
```

---

### Task 2: Add `collapsed` prop to SideNavBar

**Files:**
- Modify: `src/components/layout/SideNavBar.tsx`

- [ ] **Step 1: Add `collapsed` prop to SideNavBar**

Update the component signature to accept an optional `forceCollapsed` prop:

```typescript
// Change: export function SideNavBar() {
// To:
export function SideNavBar({ forceCollapsed = false }: { forceCollapsed?: boolean } = {}) {
```

- [ ] **Step 2: Use `forceCollapsed` in collapsed logic**

Update the collapsed state derivation (currently `const collapsed = !hovered`):

```typescript
// Change: const collapsed = !hovered;
// To:
const collapsed = forceCollapsed ? !hovered : !hovered;
```

Wait — the sidebar should still expand on hover even in `forceCollapsed` mode. The `forceCollapsed` prop controls the **default/resting** state only (starts collapsed instead of starting based on user interaction). Since the existing code already uses `const collapsed = !hovered` (collapsed when not hovered), and `forceCollapsed` should make it start collapsed but still allow hover, the actual change needed is: prevent the sidebar from ever being in "expanded by default" mode when `forceCollapsed` is true.

Looking at the existing code, the sidebar is already collapsed by default and expands on hover — so `forceCollapsed` needs to ensure it doesn't change that behavior. The real change is in `onMouseEnter`/`onMouseLeave` — when `forceCollapsed`, the sidebar should still hover-expand but snap back when the mouse leaves.

Since the existing `collapsed = !hovered` already does this (collapsed when not hovered, expanded when hovered), the `forceCollapsed` prop's actual purpose is to signal to AppShell that the sidebar is in icon-only mode. No change needed to the collapse logic itself — the existing behavior is correct.

Simply add the prop to the component signature so AppShell can detect and style accordingly:

```typescript
// No change to collapsed logic needed — existing behavior is correct
// The forceCollapsed prop is used by AppShell to adjust layout (padding, footer)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SideNavBar.tsx
git commit -m "feat(sidebar): add forceCollapsed prop to SideNavBar"
```

---

### Task 3: Update AppShell for dashboard routes

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add dashboard route detection**

After the existing route checks (line ~16), add:

```typescript
const isClubDashboard = pathname.startsWith("/my-clubs/") && pathname !== "/my-clubs";
```

- [ ] **Step 2: Suppress footer for dashboard routes**

Update the footer condition. Currently (line ~54):
```typescript
{!isEventDetail && <Footer />}
```
Change to:
```typescript
{!isEventDetail && !isClubDashboard && <Footer />}
```

- [ ] **Step 3: Pass `forceCollapsed` to SideNavBar**

Update the `<SideNavBar />` call to pass the prop:

```typescript
<SideNavBar forceCollapsed={isClubDashboard} />
```

- [ ] **Step 4: Remove padding for dashboard routes**

Add `isClubDashboard` to the no-padding condition (line ~50). The dashboard manages its own padding:

```typescript
// Add isClubDashboard to the condition that removes p-6:
className={`flex-1 ${isHomepage || isEventDetail || isClubs || isAbout || isFriends || isClubDashboard ? "" : "p-6"}`}
```

- [ ] **Step 5: Verify build compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors related to AppShell or SideNavBar.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat(layout): suppress footer and collapse sidebar for club dashboard routes"
```

---

### Task 4: Create ClubDashboardHero component

**Files:**
- Create: `src/components/clubs/ClubDashboardHero.tsx`

- [ ] **Step 1: Create the hero component**

Create `src/components/clubs/ClubDashboardHero.tsx`:

```typescript
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, ExternalLink, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClubInitials } from "@/components/clubs/ClubInitials";
import type { Club } from "@/types";

interface ClubDashboardHeroProps {
  club: Club;
  followerCount: number;
  memberCount: number;
  eventCount: number;
  onEditBanner?: () => void;
}

const STATUS_CONFIG = {
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-500 border-red-500/20" },
} as const;

export function ClubDashboardHero({ club, followerCount, memberCount, eventCount, onEditBanner }: ClubDashboardHeroProps) {
  const status = STATUS_CONFIG[club.status];
  const StatusIcon = status.icon;

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-[160px] sm:h-[100px] lg:h-[160px] overflow-hidden">
        {club.banner_url ? (
          <Image
            src={club.banner_url}
            alt={`${club.name} banner`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/80 to-slate-800 dark:from-slate-950 dark:via-primary/40 dark:to-slate-900" />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />

        {/* Edit Banner Button */}
        {onEditBanner && (
          <button
            onClick={onEditBanner}
            className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
            Edit Banner
          </button>
        )}

        {/* Pending Overlay */}
        {club.status === "pending" && (
          <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center">
            <span className="bg-amber-500/20 backdrop-blur-sm text-amber-500 px-4 py-2 rounded-full text-sm font-medium border border-amber-500/30">
              Pending Approval
            </span>
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="px-4 lg:px-6 -mt-10 relative z-10">
        <div className="flex items-end gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {club.logo_url ? (
              <div className="relative w-[56px] h-[56px] lg:w-[80px] lg:h-[80px] rounded-2xl border-[3px] border-background overflow-hidden bg-card">
                <Image src={club.logo_url} alt={club.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-[56px] h-[56px] lg:w-[80px] lg:h-[80px] rounded-2xl border-[3px] border-background">
                <ClubInitials name={club.name} size="full" />
              </div>
            )}
          </div>

          {/* Club Info */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-foreground truncate">{club.name}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${status.className}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              {club.category && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                  {club.category}
                </span>
              )}
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{followerCount.toLocaleString()}</strong> followers</span>
              <span><strong className="text-foreground">{memberCount}</strong> members</span>
              <span><strong className="text-foreground">{eventCount}</strong> events</span>
            </div>
          </div>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-2 pb-1">
            <Link href={`/clubs/${club.id}`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                View Public Page
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
            <Link href={`/create-event?clubId=${club.id}`}>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create Event
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubDashboardHero.tsx
git commit -m "feat(clubs): create ClubDashboardHero component"
```

---

### Task 5: Revamp ClubDashboard layout — remove custom sidebar, add hero + horizontal tabs

**Files:**
- Modify: `src/components/clubs/ClubDashboard.tsx`

- [ ] **Step 1: Rewrite ClubDashboard**

Replace the entire `ClubDashboard` component. The new version:
- Removes the custom sidebar and header
- Renders `ClubDashboardHero` at the top
- Uses horizontal tabs below the hero
- Keeps the same tab content components
- Adds a mobile FAB for "Create Event"

Key structural changes:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClub, useMyClubs, useClubMembers } from "@/hooks/useClubs";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubDashboardHero } from "@/components/clubs/ClubDashboardHero";
import { ClubOverviewTab } from "@/components/clubs/ClubOverviewTab";
import { ClubSettingsTab } from "@/components/clubs/ClubSettingsTab";
import { ClubMembersTab } from "@/components/clubs/ClubMembersTab";
import { ClubEventsTab } from "@/components/clubs/ClubEventsTab";
import { ClubAnalyticsTab } from "@/components/clubs/ClubAnalyticsTab";
import { Rocket, Calendar, Users, BarChart3, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Club } from "@/types";

type DashboardTab = "overview" | "events" | "members" | "analytics" | "settings";

interface ClubDashboardProps {
  clubId: string;
}

const TAB_ITEMS: { id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: Rocket },
  { id: "events", label: "Events", icon: Calendar },
  { id: "members", label: "Members", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
];

export function ClubDashboard({ clubId }: ClubDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: club, mutate: mutateClub } = useClub(clubId);
  const { data: members } = useClubMembers(clubId);
  const { data: myClubs } = useMyClubs();

  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isOwner = currentMember?.role === "owner";
  const followerCount = 0; // Will be fetched from club API
  const memberCount = members?.length ?? 0;

  const handleClubUpdate = useCallback((updatedClub: Club) => {
    mutateClub(updatedClub, false);
  }, [mutateClub]);

  // Loading state
  if (!club) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-[160px] w-full" />
        <div className="px-6 mt-4 space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  // Auth guard — use useEffect to avoid side effects during render
  useEffect(() => {
    if (club && members && !members.find((m) => m.user_id === user?.id)) {
      router.push("/clubs");
    }
  }, [club, members, user?.id, router]);

  if (!currentMember) {
    return null;
  }

  const visibleTabs = TAB_ITEMS.filter((t) => !t.ownerOnly || isOwner);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <ClubDashboardHero
        club={club}
        followerCount={followerCount}
        memberCount={memberCount}
        eventCount={0}
        onEditBanner={() => setActiveTab("settings")}
      />

      {/* Tab Bar */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex overflow-x-auto scrollbar-hide px-4 lg:px-6">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 lg:p-6">
        {activeTab === "overview" && (
          <ClubOverviewTab
            club={club}
            followerCount={followerCount}
            memberCount={memberCount}
            clubId={clubId}
            onEditClick={() => setActiveTab("settings")}
            onNavigate={(tab) => setActiveTab(tab as DashboardTab)}
          />
        )}
        {activeTab === "events" && (
          <ClubEventsTab clubId={clubId} clubName={club.name} />
        )}
        {activeTab === "members" && (
          <ClubMembersTab clubId={clubId} clubName={club.name} isOwner={isOwner} />
        )}
        {activeTab === "analytics" && (
          <ClubAnalyticsTab clubId={clubId} />
        )}
        {activeTab === "settings" && isOwner && (
          <ClubSettingsTab club={club} onUpdate={handleClubUpdate} />
        )}
      </div>

      {/* Mobile FAB */}
      <Link
        href={`/create-event?clubId=${clubId}`}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-shadow z-30"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
```

Note: The `followerCount` and `eventCount` are placeholders — they should be derived from the club API response or existing hooks. Check how `useClub` returns data and use `club.follower_count` or fetch it separately. The existing `ClubOverviewTab` already receives `followerCount` as a prop, so ensure the parent passes it correctly.

- [ ] **Step 2: Verify the page loads without errors**

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: 200

- [ ] **Step 3: Commit**

```bash
git add src/components/clubs/ClubDashboard.tsx
git commit -m "feat(clubs): revamp ClubDashboard with hero and horizontal tabs"
```

---

## Chunk 2: Database, API Endpoints, and Settings

### Task 6: Add `contact_email` column to clubs table

**Files:**
- Supabase migration

- [ ] **Step 1: Run the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` to add the column:

```sql
ALTER TABLE clubs ADD COLUMN contact_email TEXT;
```

- [ ] **Step 2: Commit**

No local file to commit — this is a remote migration. Note it in the next commit message.

---

### Task 7: Update PATCH /api/clubs/[id] — add `contact_email` and email validation

**Files:**
- Modify: `src/app/api/clubs/[id]/route.ts`

- [ ] **Step 1: Add `contact_email` to allowedFields**

In `src/app/api/clubs/[id]/route.ts`, find the `allowedFields` array (line ~74) and add `"contact_email"`:

```typescript
const allowedFields = [
  "name", "description", "category", "instagram_handle",
  "logo_url", "banner_url", "website_url", "discord_url",
  "twitter_url", "linkedin_url", "contact_email",
];
```

- [ ] **Step 2: Add email validation**

After the URL validation block (line ~109), add email validation:

```typescript
// Validate contact_email format
if (updates.contact_email !== undefined && updates.contact_email !== null) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(updates.contact_email)) {
    return NextResponse.json({ error: "Invalid email format for contact_email" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clubs/[id]/route.ts
git commit -m "feat(api): add contact_email to club PATCH endpoint with email validation"
```

---

### Task 8: Add DELETE handler for club soft-deletion

**Files:**
- Modify: `src/app/api/clubs/[id]/route.ts`

- [ ] **Step 1: Add DELETE handler**

Add a new `DELETE` export to the route file:

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify owner
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can delete the club" }, { status: 403 });
  }

  // Verify confirmation name
  const body = await request.json();
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  if (!club || body.confirmName !== club.name) {
    return NextResponse.json({ error: "Club name confirmation does not match" }, { status: 400 });
  }

  // Soft delete
  const { error } = await supabase
    .from("clubs")
    .update({ status: "deleted" as const })
    .eq("id", clubId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete club" }, { status: 500 });
  }

  // Audit log
  const { createServiceClient } = await import("@/lib/supabase/service");
  const serviceClient = createServiceClient();
  await serviceClient.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "club_deleted",
    target_type: "club",
    target_id: clubId,
    details: { club_name: club.name },
  });

  return NextResponse.json({ success: true });
}
```

Note: The `status` column currently has type `"pending" | "approved" | "rejected"`. You may need to handle `"deleted"` as an additional status at the DB level. If the column uses a CHECK constraint, update it. If it's a plain text column, it will work as-is. Check by attempting the update — if it fails with a constraint error, add a migration to update the constraint.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/route.ts
git commit -m "feat(api): add DELETE handler for club soft-deletion with audit logging"
```

---

### Task 9: Create member role change endpoint

**Files:**
- Create: `src/app/api/clubs/[id]/members/role/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/clubs/[id]/members/role/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only owner can change roles
  const { data: currentMember } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!currentMember || currentMember.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can change roles" }, { status: 403 });
  }

  const { memberId, role } = await request.json();

  if (!memberId || role !== "organizer") {
    return NextResponse.json({ error: "Invalid request. Role must be 'organizer'." }, { status: 400 });
  }

  // Cannot change own role
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role. Use transfer ownership instead." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("club_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/members/role/route.ts
git commit -m "feat(api): add member role change endpoint"
```

---

### Task 10: Create ownership transfer endpoint

**Files:**
- Create: `src/app/api/clubs/[id]/transfer/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/clubs/[id]/transfer/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify current user is owner
  const { data: currentMember } = await supabase
    .from("club_members")
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!currentMember || currentMember.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can transfer ownership" }, { status: 403 });
  }

  const { newOwnerId } = await request.json();

  if (!newOwnerId) {
    return NextResponse.json({ error: "newOwnerId is required" }, { status: 400 });
  }

  // Verify target is a club member
  const { data: targetMember } = await supabase
    .from("club_members")
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", newOwnerId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this club" }, { status: 400 });
  }

  // Use service client for atomic update (bypass RLS)
  const serviceClient = createServiceClient();

  // Set new owner
  const { error: newOwnerError } = await serviceClient
    .from("club_members")
    .update({ role: "owner" })
    .eq("id", targetMember.id);

  if (newOwnerError) {
    return NextResponse.json({ error: "Failed to set new owner" }, { status: 500 });
  }

  // Demote current owner to organizer
  const { error: demoteError } = await serviceClient
    .from("club_members")
    .update({ role: "organizer" })
    .eq("id", currentMember.id);

  if (demoteError) {
    // Rollback: restore original owner
    await serviceClient
      .from("club_members")
      .update({ role: "owner" })
      .eq("id", targetMember.id);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }

  // Audit log
  await serviceClient.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "club_ownership_transferred",
    target_type: "club",
    target_id: clubId,
    details: { new_owner_id: newOwnerId, previous_owner_id: user.id },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/transfer/route.ts
git commit -m "feat(api): add ownership transfer endpoint with rollback"
```

---

### Task 11: Revamp ClubSettingsTab — add banner, contact email, social links, danger zone

**Files:**
- Modify: `src/components/clubs/ClubSettingsTab.tsx`

- [ ] **Step 1: Add new state fields**

Add state for the new fields. After the existing state declarations (line ~36), add:

```typescript
const [bannerUrl, setBannerUrl] = useState(club.banner_url || "");
const [bannerFile, setBannerFile] = useState<File | null>(null);
const [uploadingBanner, setUploadingBanner] = useState(false);
const [contactEmail, setContactEmail] = useState(club.contact_email || "");
const [websiteUrl, setWebsiteUrl] = useState(club.website_url || "");
const [discordUrl, setDiscordUrl] = useState(club.discord_url || "");
const [twitterUrl, setTwitterUrl] = useState(club.twitter_url || "");
const [linkedinUrl, setLinkedinUrl] = useState(club.linkedin_url || "");

// Danger zone state
const [showTransferDialog, setShowTransferDialog] = useState(false);
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [transferTargetId, setTransferTargetId] = useState("");
const [deleteConfirmName, setDeleteConfirmName] = useState("");
const [dangerLoading, setDangerLoading] = useState(false);
```

- [ ] **Step 2: Add banner upload handler**

Add a banner file handler similar to the existing logo handler:

```typescript
function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
  if (file.size > 2 * 1024 * 1024) { setError("Banner must be under 2 MB"); return; }
  setBannerFile(file);
  setBannerUrl(URL.createObjectURL(file));
}
```

- [ ] **Step 3: Update form submit to include new fields**

In the `handleSubmit` function, add the new fields to the PATCH body:

```typescript
const updateBody: Record<string, string | null> = {
  name: name.trim(),
  description: description.trim() || null,
  category: category || null,
  instagram_handle: instagramHandle.trim() || null,
  contact_email: contactEmail.trim() || null,
  website_url: websiteUrl.trim() || null,
  discord_url: discordUrl.trim() || null,
  twitter_url: twitterUrl.trim() || null,
  linkedin_url: linkedinUrl.trim() || null,
};
```

Add banner upload before the PATCH call (same pattern as logo upload):

```typescript
if (bannerFile) {
  setUploadingBanner(true);
  const formData = new FormData();
  formData.append("file", bannerFile);
  formData.append("clubId", club.id);
  const uploadRes = await fetch("/api/clubs/banner", { method: "POST", body: formData });
  setUploadingBanner(false);
  if (!uploadRes.ok) { setError("Failed to upload banner"); return; }
  const { url } = await uploadRes.json();
  updateBody.banner_url = url;
}
```

- [ ] **Step 4: Add email validation to client-side**

Before submitting, validate contact email format:

```typescript
if (contactEmail.trim()) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contactEmail.trim())) {
    setError("Invalid contact email format");
    return;
  }
}
```

- [ ] **Step 5: Add UI sections for banner, contact email, social links, and danger zone**

Add the following sections to the form JSX, after the existing Instagram section:

**Banner Upload** (after logo upload section):
```tsx
{/* Banner Upload */}
<div className="space-y-2">
  <label className="text-sm font-medium">Banner Image</label>
  <p className="text-xs text-muted-foreground">Recommended: 1200×400px, max 2 MB</p>
  {bannerUrl ? (
    <div className="relative w-full h-32 rounded-lg overflow-hidden border">
      <Image src={bannerUrl} alt="Banner preview" fill className="object-cover" />
      <button type="button" onClick={() => { setBannerUrl(""); setBannerFile(null); }}
        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : (
    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <Upload className="h-6 w-6" />
        <span className="text-xs">Upload banner</span>
      </div>
      <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
    </label>
  )}
</div>
```

**Contact Email** (new section after category):
```tsx
{/* Contact Email */}
<div className="space-y-2">
  <label className="text-sm font-medium">Contact Email <span className="text-destructive">*</span></label>
  <p className="text-xs text-muted-foreground">For moderation, partnerships, and student outreach</p>
  <Input
    type="email"
    value={contactEmail}
    onChange={(e) => setContactEmail(e.target.value)}
    placeholder="club@mail.mcgill.ca"
  />
</div>
```

**Social Links** (section with all 5 links):
```tsx
{/* Social Links */}
<div className="space-y-4">
  <h3 className="text-sm font-medium">Social Links</h3>
  {/* Instagram (already exists — keep as-is) */}
  {/* Twitter/X */}
  <div className="space-y-1">
    <label className="text-xs text-muted-foreground">Twitter / X</label>
    <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/yourclub" />
  </div>
  {/* Discord */}
  <div className="space-y-1">
    <label className="text-xs text-muted-foreground">Discord</label>
    <Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.gg/invite" />
  </div>
  {/* LinkedIn */}
  <div className="space-y-1">
    <label className="text-xs text-muted-foreground">LinkedIn</label>
    <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/yourclub" />
  </div>
  {/* Website */}
  <div className="space-y-1">
    <label className="text-xs text-muted-foreground">Website</label>
    <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourclub.com" />
  </div>
</div>
```

**Danger Zone** (at the bottom, outside the main form):
```tsx
{/* Danger Zone */}
<div className="mt-8 rounded-xl border border-destructive/30 p-6 space-y-4">
  <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>

  {/* Transfer Ownership */}
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium">Transfer Ownership</p>
      <p className="text-xs text-muted-foreground">Transfer this club to another member</p>
    </div>
    <Button variant="outline" size="sm" onClick={() => setShowTransferDialog(true)}>
      Transfer
    </Button>
  </div>

  <div className="border-t border-destructive/20" />

  {/* Delete Club */}
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium">Delete Club</p>
      <p className="text-xs text-muted-foreground">Permanently hide this club. This action cannot be undone.</p>
    </div>
    <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
      Delete
    </Button>
  </div>
</div>
```

Add `Dialog` imports from shadcn and implement the transfer/delete confirmation dialogs. The transfer dialog should list club members in a select dropdown. The delete dialog requires typing the club name to confirm.

- [ ] **Step 6: Add necessary imports**

Add to imports:
```typescript
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, Twitter, MessageSquare, Linkedin, Mail } from "lucide-react";
```

- [ ] **Step 7: Commit**

```bash
git add src/components/clubs/ClubSettingsTab.tsx
git commit -m "feat(clubs): revamp settings with banner, contact email, social links, danger zone"
```

---

### Task 12: Update ClubCompletionNudge — add contact_email check

**Files:**
- Modify: `src/components/clubs/ClubCompletionNudge.tsx`

- [ ] **Step 1: Add contact_email to checklist items**

In the checklist array (line ~31), add a new item after the description check:

```typescript
{
  key: "contact_email",
  complete: !!club.contact_email,
  label: "Add a contact email",
  tab: "settings",
},
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubCompletionNudge.tsx
git commit -m "feat(clubs): add contact_email to completion nudge checklist"
```

---

## Chunk 3: Enhanced Analytics and Members

### Task 13: Extend analytics API with engagement, peaks, and best event type

**Files:**
- Modify: `src/app/api/clubs/[id]/analytics/route.ts`

- [ ] **Step 1: Add engagement trend query**

After the existing follower growth query, add:

```typescript
// Engagement trend: interactions per day / follower count
const thirtyDaysAgo = subDays(new Date(), 30);
const eventIds = clubEvents.map((e: { id: string }) => e.id);

let engagementTrend: { date: string; rate: number }[] = [];
let peakHours: { hour: number; count: number }[] = [];
let peakDays: { day: string; count: number }[] = [];
let bestEventType: { tag: string; avg_rsvps: number; comparison: number } | null = null;

if (eventIds.length > 0) {
  // Fetch interactions for club events in last 30 days
  const { data: interactions } = await supabase
    .from("user_interactions")
    .select("created_at")
    .in("event_id", eventIds)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (interactions && interactions.length > 0) {
    // Engagement trend: group by day
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: new Date() });
    const interactionsByDay = new Map<string, number>();
    for (const interaction of interactions) {
      const day = format(parseISO(interaction.created_at), "yyyy-MM-dd");
      interactionsByDay.set(day, (interactionsByDay.get(day) || 0) + 1);
    }

    const currentFollowerCount = followerGrowth.length > 0
      ? followerGrowth[followerGrowth.length - 1].count
      : 1;

    engagementTrend = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const count = interactionsByDay.get(dateStr) || 0;
      return {
        date: dateStr,
        rate: currentFollowerCount > 0 ? Math.round((count / currentFollowerCount) * 10000) / 100 : 0,
      };
    });

    // Peak hours
    const hourCounts = new Array(24).fill(0);
    for (const interaction of interactions) {
      const hour = parseISO(interaction.created_at).getHours();
      hourCounts[hour]++;
    }
    peakHours = hourCounts.map((count, hour) => ({ hour, count }));

    // Peak days
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = new Array(7).fill(0);
    for (const interaction of interactions) {
      const day = parseISO(interaction.created_at).getDay();
      dayCounts[day]++;
    }
    peakDays = dayCounts.map((count, i) => ({ day: dayNames[i], count }));
  }

  // Best event type: avg RSVPs per tag (single batch query, no N+1)
  const { data: allRsvps } = await supabase
    .from("rsvps")
    .select("event_id")
    .in("event_id", eventIds)
    .eq("status", "going");

  // Count RSVPs per event
  const rsvpsByEvent = new Map<string, number>();
  if (allRsvps) {
    for (const rsvp of allRsvps) {
      rsvpsByEvent.set(rsvp.event_id, (rsvpsByEvent.get(rsvp.event_id) || 0) + 1);
    }
  }

  const tagRsvps = new Map<string, { total: number; count: number }>();
  for (const event of clubEvents) {
    if (!event.tags || event.tags.length === 0) continue;
    const rsvpCount = rsvpsByEvent.get(event.id) || 0;

    for (const tag of event.tags) {
      const existing = tagRsvps.get(tag) || { total: 0, count: 0 };
      existing.total += rsvpCount;
      existing.count += 1;
      tagRsvps.set(tag, existing);
    }
  }

  if (tagRsvps.size > 0) {
    let bestTag = "";
    let bestAvg = 0;
    let overallAvg = 0;
    let totalEvents = 0;

    for (const [tag, data] of tagRsvps) {
      const avg = data.total / data.count;
      overallAvg += data.total;
      totalEvents += data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestTag = tag;
      }
    }

    overallAvg = totalEvents > 0 ? overallAvg / totalEvents : 1;
    bestEventType = {
      tag: bestTag,
      avg_rsvps: Math.round(bestAvg * 10) / 10,
      comparison: overallAvg > 0 ? Math.round((bestAvg / overallAvg) * 10) / 10 : 1,
    };
  }
}
```

- [ ] **Step 2: Update response to include new fields**

Update the response JSON to include the new data:

```typescript
return NextResponse.json({
  follower_growth: followerGrowth,
  total_attendees: totalAttendees,
  popular_tags: popularTags,
  events: eventAnalytics,
  engagement_trend: engagementTrend,
  peak_hours: peakHours,
  peak_days: peakDays,
  best_event_type: bestEventType,
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clubs/[id]/analytics/route.ts
git commit -m "feat(api): add engagement trend, peak activity, and best event type to analytics"
```

---

### Task 14: Enhance ClubAnalyticsTab with new charts and insights

**Files:**
- Modify: `src/components/clubs/ClubAnalyticsTab.tsx`

- [ ] **Step 1: Add engagement trend chart**

After the existing follower growth chart section, add a new section:

```tsx
{/* Engagement Rate Trend */}
{data.engagement_trend && data.engagement_trend.length > 0 && (
  <div className="rounded-xl border bg-card p-6">
    <h3 className="text-sm font-semibold mb-4">Engagement Rate Trend</h3>
    <p className="text-xs text-muted-foreground mb-4">Daily interactions as % of followers (last 30 days)</p>
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data.engagement_trend}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
          formatter={(value: number) => [`${value}%`, "Engagement"]}
        />
        <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

- [ ] **Step 2: Add peak activity chart**

```tsx
{/* Peak Activity Times */}
{data.peak_hours && data.peak_hours.length > 0 && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-sm font-semibold mb-4">Peak Hours</h3>
      <p className="text-xs text-muted-foreground mb-4">When your audience is most active</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.peak_hours}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-sm font-semibold mb-4">Peak Days</h3>
      <p className="text-xs text-muted-foreground mb-4">Best days to post events</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.peak_days}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add best event type insight card**

```tsx
{/* Best Performing Event Type */}
{data.best_event_type && (
  <div className="rounded-xl border bg-card p-6">
    <h3 className="text-sm font-semibold mb-2">Top Performing Category</h3>
    <p className="text-2xl font-bold text-foreground">{data.best_event_type.tag}</p>
    <p className="text-sm text-muted-foreground mt-1">
      Your <span className="text-foreground font-medium">{data.best_event_type.tag}</span> events
      average <span className="text-foreground font-medium">{data.best_event_type.avg_rsvps}</span> RSVPs
      {data.best_event_type.comparison > 1 && (
        <> — <span className="text-emerald-500 font-medium">{data.best_event_type.comparison}x</span> more than your other events</>
      )}
    </p>
  </div>
)}
```

- [ ] **Step 4: Add skeleton loading for new sections**

Update the loading state (lines ~32-44) to include placeholders for the new widgets:

```tsx
{/* Add after existing skeleton sections */}
<Skeleton className="h-[300px] w-full rounded-xl" />
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <Skeleton className="h-[250px] w-full rounded-xl" />
  <Skeleton className="h-[250px] w-full rounded-xl" />
</div>
<Skeleton className="h-24 w-full rounded-xl" />
```

- [ ] **Step 5: Add `format` and `parseISO` imports**

```typescript
import { format, parseISO } from "date-fns";
```

- [ ] **Step 6: Commit**

```bash
git add src/components/clubs/ClubAnalyticsTab.tsx
git commit -m "feat(clubs): add engagement trend, peak activity, and best event type to analytics tab"
```

---

### Task 15: Enhance ClubMembersTab — role changes, bulk invite, activity, search

**Files:**
- Modify: `src/components/clubs/ClubMembersTab.tsx`

- [ ] **Step 1: Add search state and role change handler**

Add new state and handlers:

```typescript
const [searchQuery, setSearchQuery] = useState("");
const [roleLoading, setRoleLoading] = useState<string | null>(null);

async function handleRoleChange(memberId: string, newRole: string) {
  setRoleLoading(memberId);
  try {
    const res = await fetch(`/api/clubs/${clubId}/members/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      alert(error || "Failed to change role");
      return;
    }
    mutateMembers(); // Refresh member list
  } finally {
    setRoleLoading(null);
  }
}
```

- [ ] **Step 2: Add bulk invite state and handler**

```typescript
const [bulkMode, setBulkMode] = useState(false);
const [bulkEmails, setBulkEmails] = useState("");
const [bulkResults, setBulkResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);
const [bulkLoading, setBulkLoading] = useState(false);

async function handleBulkInvite() {
  const emails = bulkEmails
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (emails.length === 0) return;
  if (emails.length > 20) {
    alert("Maximum 20 emails at a time");
    return;
  }

  setBulkLoading(true);
  const results: typeof bulkResults = [];

  for (const email of emails) {
    try {
      const res = await fetch(`/api/clubs/${clubId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        results.push({ email, success: true });
      } else {
        const { error } = await res.json();
        results.push({ email, success: false, error: error || "Failed" });
      }
    } catch {
      results.push({ email, success: false, error: "Network error" });
    }
  }

  setBulkResults(results);
  setBulkLoading(false);
  mutateInvites();
}
```

- [ ] **Step 3: Add search filter to member list**

Filter the members by search query:

```typescript
const filteredMembers = members?.filter((m) => {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  const name = m.users?.name?.toLowerCase() || "";
  const email = m.users?.email?.toLowerCase() || "";
  return name.includes(q) || email.includes(q);
}) ?? [];
```

- [ ] **Step 4: Add search input UI**

At the top of the member list card, add:

```tsx
<div className="flex items-center gap-2 mb-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search members..."
      className="pl-9"
    />
  </div>
</div>
```

Import `Search` from lucide-react.

- [ ] **Step 5: Add role change dropdown to member rows**

For each member row (non-owner), add an actions menu:

```tsx
{isOwner && member.role !== "owner" && (
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="sm"
      disabled={roleLoading === member.id}
      onClick={() => handleRoleChange(member.id, "organizer")}
    >
      {roleLoading === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Organizer"}
    </Button>
  </div>
)}
```

- [ ] **Step 6: Add bulk invite UI**

In the invite section, add a toggle for bulk mode and the bulk invite textarea:

```tsx
{isOwner && (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Button
        variant={bulkMode ? "default" : "outline"}
        size="sm"
        onClick={() => setBulkMode(!bulkMode)}
      >
        {bulkMode ? "Single Invite" : "Bulk Invite"}
      </Button>
    </div>

    {bulkMode ? (
      <div className="space-y-2">
        <Textarea
          value={bulkEmails}
          onChange={(e) => setBulkEmails(e.target.value)}
          placeholder="Paste emails, one per line (max 20)"
          rows={5}
        />
        <Button onClick={handleBulkInvite} disabled={bulkLoading || !bulkEmails.trim()}>
          {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send {bulkEmails.split("\n").filter((e) => e.trim()).length} Invites
        </Button>
        {bulkResults.length > 0 && (
          <div className="space-y-1 text-xs">
            {bulkResults.map((r, i) => (
              <div key={i} className={r.success ? "text-emerald-500" : "text-destructive"}>
                {r.email}: {r.success ? "Sent" : r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : (
      /* existing single invite form */
    )}
  </div>
)}
```

Import `Textarea` from `@/components/ui/textarea` and `Search` from lucide-react.

- [ ] **Step 7: Commit**

```bash
git add src/components/clubs/ClubMembersTab.tsx
git commit -m "feat(clubs): add search, role changes, and bulk invite to members tab"
```

---

### Task 15b: Add member removal with confirmation dialog

**Files:**
- Modify: `src/components/clubs/ClubMembersTab.tsx`

The existing `ClubMembersTab` already has a `handleRemove` function and a remove confirmation dialog. Verify it works within the new layout and that the `filteredMembers` list (from Task 15 Step 3) is used for rendering instead of the raw `members` array. No new code needed — just ensure the existing removal flow is preserved and uses `filteredMembers`.

- [ ] **Step 1: Verify existing remove functionality**

Confirm the existing `handleRemove()` and `Dialog` for removal are intact after the Task 15 modifications. The member rows should show both role change and remove actions for non-owner members.

- [ ] **Step 2: Commit (if any fixes needed)**

```bash
git add src/components/clubs/ClubMembersTab.tsx
git commit -m "fix(clubs): verify member removal works with new search and role features"
```

---

### Task 16: Update ClubOverviewTab — add trend indicators to stat cards

**Files:**
- Modify: `src/components/clubs/ClubOverviewTab.tsx`

- [ ] **Step 1: Update StatCard to support trend indicators**

Update the `StatCard` sub-component to accept a `trend` prop:

```typescript
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  trend?: { value: string; positive: boolean } | null;
}

function StatCard({ icon: Icon, value, label, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {trend && (
        <div className={`text-xs mt-1 ${trend.positive ? "text-emerald-500" : "text-red-500"}`}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Compute engagement rate and pass trends to StatCards**

In the main component, compute the engagement rate using analytics data:

```typescript
const analytics = useClubAnalytics(clubId);
const engagementRate = analytics.data?.engagement_trend
  ? Math.round(analytics.data.engagement_trend.reduce((sum, d) => sum + d.rate, 0) / analytics.data.engagement_trend.length * 10) / 10
  : 0;
```

Update the StatCard usage to include trends (the exact trend values depend on available comparison data — use available follower growth data for the followers trend).

- [ ] **Step 3: Verify existing sections are preserved**

The current `ClubOverviewTab` already has:
- **Next Event Spotlight** (lines 159-228) — conditionally rendered with countdown and RSVP counts
- **Recent Events Table** (lines 232-368) — 5 rows, sorted by date

Confirm these sections still render correctly within the new dashboard layout (no custom sidebar eating their space). They should now have more horizontal room since the dashboard sidebar was removed.

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/ClubOverviewTab.tsx
git commit -m "feat(clubs): add trend indicators to overview stat cards"
```

---

### Task 17: Final integration verification

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: No TypeScript errors. Build succeeds.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 3: Run existing tests**

```bash
npx jest
```

Expected: All existing tests pass.

- [ ] **Step 4: Manual smoke test checklist**

Open `http://localhost:3000` and verify:
1. Navigate to `/my-clubs/[id]` — hero renders with gradient, no double nav, no footer
2. Collapsed sidebar shows AppShell nav items at 72px width
3. Tabs switch correctly: Overview, Events, Members, Analytics, Settings
4. Settings tab shows all fields: logo, banner, name, description, category, contact email, social links
5. Danger zone visible at bottom of Settings
6. Analytics tab shows new charts (engagement trend, peak hours/days, best event type)
7. Members tab has search, bulk invite toggle
8. Mobile: no sidebar, scrollable tabs, FAB visible
9. Light/dark mode both render correctly with proper colors

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from club dashboard revamp"
```
