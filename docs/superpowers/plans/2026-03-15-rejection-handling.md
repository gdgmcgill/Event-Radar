# Rejection Handling & Appeals System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rejection feedback (categorized reasons) and appeal workflows to the moderation pipeline for both events and clubs, with full bidirectional review history.

**Architecture:** New `moderation_reviews` table stores a chronological thread of rejections/appeals/approvals per item. Modified API routes require category + reason on rejection. New appeal endpoints let organizers resubmit. Shared UI components (RejectionModal, ReviewThread, AppealBadge, AppealForm) are used across moderation and organizer pages.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service client for admin ops), Tailwind CSS, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-15-rejection-handling-design.md`

---

## Chunk 1: Database & Types Foundation

### Task 1: Create Supabase migration

**Files:**
- Create: `supabase/migrations/20260315000001_moderation_reviews.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add appeal_count to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS appeal_count integer NOT NULL DEFAULT 0;

-- Add appeal_count to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS appeal_count integer NOT NULL DEFAULT 0;

-- Add club_id to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE;

-- Create moderation_reviews table
CREATE TABLE moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event', 'club')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('rejection', 'appeal', 'approval')),
  category text CHECK (
    category IN ('inappropriate_content', 'missing_information', 'duplicate', 'policy_violation', 'incorrect_details', 'other')
  ),
  message text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Enforce: rejections must have category, appeals/approvals must not
  CONSTRAINT category_required_for_rejection CHECK (
    (action = 'rejection' AND category IS NOT NULL) OR
    (action IN ('appeal', 'approval') AND category IS NULL)
  )
);

-- Index for fetching review threads
CREATE INDEX idx_moderation_reviews_target ON moderation_reviews (target_type, target_id, created_at);

-- RLS policies
ALTER TABLE moderation_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access" ON moderation_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );

-- Creators can view reviews of their items
CREATE POLICY "Creators can view reviews of their items" ON moderation_reviews
  FOR SELECT USING (
    (target_type = 'event' AND EXISTS (
      SELECT 1 FROM events WHERE id = target_id AND created_by = auth.uid()
    ))
    OR
    (target_type = 'club' AND EXISTS (
      SELECT 1 FROM clubs WHERE id = target_id AND created_by = auth.uid()
    ))
  );

-- Creators can insert appeal rows for their items
CREATE POLICY "Creators can appeal their items" ON moderation_reviews
  FOR INSERT WITH CHECK (
    action = 'appeal'
    AND author_id = auth.uid()
    AND (
      (target_type = 'event' AND EXISTS (
        SELECT 1 FROM events WHERE id = target_id AND created_by = auth.uid()
      ))
      OR
      (target_type = 'club' AND EXISTS (
        SELECT 1 FROM clubs WHERE id = target_id AND created_by = auth.uid()
      ))
    )
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run: Use the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` with the SQL above and name `moderation_reviews`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260315000001_moderation_reviews.sql
git commit -m "feat: add moderation_reviews table, appeal_count columns, club_id on notifications"
```

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add rejection category type and moderation review interface to `src/types/index.ts`**

After the `FeaturedClub` interface (around line 344), add:

```typescript
// ── Moderation Review Types ──────────────────────────────────────────

export const REJECTION_CATEGORIES = {
  inappropriate_content: "Inappropriate Content",
  missing_information: "Missing Information",
  duplicate: "Duplicate",
  policy_violation: "Policy Violation",
  incorrect_details: "Incorrect Details",
  other: "Other",
} as const;

export type RejectionCategory = keyof typeof REJECTION_CATEGORIES;

export type ModerationAction = "rejection" | "appeal" | "approval";

export interface ModerationReview {
  id: string;
  target_type: "event" | "club";
  target_id: string;
  action: ModerationAction;
  category: RejectionCategory | null;
  message: string;
  author_id: string;
  created_at: string;
  // Joined field
  author_name?: string;
}
```

- [ ] **Step 2: Add `appeal_count` to Event and Club interfaces in `src/types/index.ts`**

In the `Event` interface (line 34), add after the `approved_at` field:
```typescript
  appeal_count?: number;
```

In the `Club` interface (line 56), add after `updated_at`:
```typescript
  appeal_count?: number;
```

In the `Notification` interface (line 146), add after `event_id`:
```typescript
  club_id?: string | null;
```

- [ ] **Step 3: Add `moderation_reviews` table type to `src/lib/supabase/types.ts`**

Inside `public.Tables`, add the `moderation_reviews` table definition following the existing pattern (Row, Insert, Update, Relationships). Also add `appeal_count` to the `events` and `clubs` table Row/Insert/Update types, and `club_id` to the `notifications` table types.

Note: This file is auto-generated. Add the types manually following the exact pattern of existing table definitions. The key additions:

In the `events` table types:
- Row: `appeal_count: number`
- Insert: `appeal_count?: number`
- Update: `appeal_count?: number`

In the `clubs` table types:
- Row: `appeal_count: number`
- Insert: `appeal_count?: number`
- Update: `appeal_count?: number`

In the `notifications` table types:
- Row: `club_id: string | null`
- Insert: `club_id?: string | null`
- Update: `club_id?: string | null`

New `moderation_reviews` table:
```typescript
moderation_reviews: {
  Row: {
    id: string
    target_type: string
    target_id: string
    action: string
    category: string | null
    message: string
    author_id: string
    created_at: string | null
  }
  Insert: {
    id?: string
    target_type: string
    target_id: string
    action: string
    category?: string | null
    message: string
    author_id: string
    created_at?: string | null
  }
  Update: {
    id?: string
    target_type?: string
    target_id?: string
    action?: string
    category?: string | null
    message?: string
    author_id?: string
    created_at?: string | null
  }
  Relationships: []
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/supabase/types.ts
git commit -m "feat: add moderation review types and update Event/Club/Notification interfaces"
```

---

## Chunk 2: API Routes — Backend

### Task 3: Modify event status API to require rejection reason

**Files:**
- Modify: `src/app/api/admin/events/[id]/status/route.ts`

- [ ] **Step 1: Update the PATCH handler**

The current file is at `src/app/api/admin/events/[id]/status/route.ts`. Replace the entire file content with:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

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
  const { status, category, message } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch current event
  const { data: event, error: fetchError } = await serviceClient
    .from("events")
    .select("title, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Status guard: prevent duplicate actions
  if (event.status === status) {
    return NextResponse.json(
      { error: `Event is already ${status}` },
      { status: 409 }
    );
  }

  // Validate rejection fields
  if (status === "rejected") {
    if (!category || !message?.trim()) {
      return NextResponse.json(
        { error: "Rejection requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid rejection category" },
        { status: 400 }
      );
    }
  }

  // Update event status
  const { error: updateError } = await serviceClient
    .from("events")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Insert moderation review row
  if (status === "rejected") {
    await serviceClient.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "rejection",
      category: category as RejectionCategory,
      message: message.trim(),
      author_id: user.id,
    });
  } else if (status === "approved" && (event.appeal_count ?? 0) > 0) {
    // Close the review thread on approval after appeal
    await serviceClient.from("moderation_reviews").insert({
      target_type: "event",
      target_id: id,
      action: "approval",
      category: null,
      message: "Event approved.",
      author_id: user.id,
    });
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status as "approved" | "rejected",
      targetType: "event",
      targetId: id,
      metadata: { event_title: event.title },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  // Send notification to event creator
  try {
    if (event.created_by) {
      if (status === "approved") {
        await serviceClient.from("notifications").upsert(
          {
            user_id: event.created_by,
            type: "event_approved",
            title: "Event Approved!",
            message: `Your event "${event.title}" has been approved and is now live.`,
            event_id: id,
            read: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,event_id,type" }
        );
      } else {
        // Use insert (not upsert) so each rejection is a distinct notification
        const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
        await serviceClient.from("notifications").insert({
          user_id: event.created_by,
          type: "event_rejected",
          title: "Event Not Approved",
          message: `Your event "${event.title}" was not approved. Reason: ${categoryLabel} — ${message.trim()}`,
          event_id: id,
          read: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (notifErr) {
    console.error("[Admin] Failed to send notification:", notifErr);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/events/[id]/status/route.ts
git commit -m "feat: require rejection category+message on event status change"
```

### Task 4: Modify club admin API to require rejection reason

**Files:**
- Modify: `src/app/api/admin/clubs/[id]/route.ts`

- [ ] **Step 1: Update the PATCH handler**

In `src/app/api/admin/clubs/[id]/route.ts`, add the import at the top:
```typescript
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
```

After the line `const { status } = body;` (line 18), add extraction of new fields:
```typescript
const { status, category, message: rejectionMessage } = body;
```
(Replace the existing `const { status } = body;` line)

The existing `.select("*")` query already fetches all columns, so `club.appeal_count` will be available after the migration adds the column.

After the existing validation `if (!["approved", "rejected"].includes(status))` block, add rejection validation:
```typescript
  if (status === "rejected") {
    if (!category || !rejectionMessage?.trim()) {
      return NextResponse.json(
        { error: "Rejection requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid rejection category" },
        { status: 400 }
      );
    }
  }
```

After the status update succeeds (after the `if (updateError)` block), add the moderation review insert:
```typescript
  // Insert moderation review row
  if (status === "rejected") {
    await serviceClient.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "rejection",
      category: category as RejectionCategory,
      message: rejectionMessage.trim(),
      author_id: user.id,
    });
  } else if (status === "approved" && (club.appeal_count ?? 0) > 0) {
    await serviceClient.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "approval",
      category: null,
      message: "Club approved.",
      author_id: user.id,
    });
  }
```

In the existing rejection notification block (line 111-121), update to include rejection details:
```typescript
  if (status === "rejected" && club.created_by) {
    try {
      const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
      await serviceClient.from("notifications").insert({
        user_id: club.created_by,
        type: "club_rejected",
        title: "Club Not Approved",
        message: `Your club "${club.name}" was not approved. Reason: ${categoryLabel} — ${rejectionMessage.trim()}`,
        club_id: id,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/clubs/[id]/route.ts
git commit -m "feat: require rejection category+message on club status change"
```

### Task 5: Create event appeal API endpoint

**Files:**
- Create: `src/app/api/events/[id]/appeal/route.ts`

- [ ] **Step 1: Create the appeal route**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
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

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Fetch event
  const { data: event, error: fetchError } = await serviceClient
    .from("events")
    .select("id, title, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify caller is the event creator
  if (event.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify event is rejected
  if (event.status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected events can be appealed" },
      { status: 409 }
    );
  }

  // Insert appeal review
  const { error: reviewError } = await serviceClient
    .from("moderation_reviews")
    .insert({
      target_type: "event",
      target_id: id,
      action: "appeal",
      category: null,
      message: message.trim(),
      author_id: user.id,
    });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  // Update event status back to pending and increment appeal_count
  const { error: updateError } = await serviceClient
    .from("events")
    .update({
      status: "pending",
      appeal_count: (event.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify all admins
  try {
    const { data: admins } = await serviceClient
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      await serviceClient.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "event_appeal",
          title: "Event Appeal Submitted",
          message: `An appeal was submitted for event "${event.title}"`,
          event_id: id,
          read: false,
        }))
      );
    }
  } catch (notifErr) {
    console.error("[Appeal] Failed to send admin notifications:", notifErr);
  }

  // Return the updated event
  const { data: updatedEvent } = await serviceClient
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, event: updatedEvent });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/[id]/appeal/route.ts
git commit -m "feat: add event appeal API endpoint"
```

### Task 6: Create club appeal API endpoint

**Files:**
- Create: `src/app/api/clubs/[id]/appeal/route.ts`

- [ ] **Step 1: Create the appeal route**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
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

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Fetch club
  const { data: club, error: fetchError } = await serviceClient
    .from("clubs")
    .select("id, name, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  if (club.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (club.status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected clubs can be appealed" },
      { status: 409 }
    );
  }

  // Insert appeal review
  const { error: reviewError } = await serviceClient
    .from("moderation_reviews")
    .insert({
      target_type: "club",
      target_id: id,
      action: "appeal",
      category: null,
      message: message.trim(),
      author_id: user.id,
    });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  // Update club status back to pending and increment appeal_count
  const { error: updateError } = await serviceClient
    .from("clubs")
    .update({
      status: "pending",
      appeal_count: (club.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify all admins
  try {
    const { data: admins } = await serviceClient
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      await serviceClient.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "club_appeal",
          title: "Club Appeal Submitted",
          message: `An appeal was submitted for club "${club.name}"`,
          club_id: id,
          read: false,
        }))
      );
    }
  } catch (notifErr) {
    console.error("[Appeal] Failed to send admin notifications:", notifErr);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/appeal/route.ts
git commit -m "feat: add club appeal API endpoint"
```

### Task 7: Create review thread API endpoint

**Files:**
- Create: `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts`

- [ ] **Step 1: Create the review thread route**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetType, targetId } = await params;

  if (!["event", "club"].includes(targetType)) {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Check authorization: must be admin or item creator
  const { data: profile } = await serviceClient
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.roles?.includes("admin");

  if (!isAdmin) {
    // Check if user is the creator
    const table = targetType === "event" ? "events" : "clubs";
    const { data: item } = await serviceClient
      .from(table)
      .select("created_by")
      .eq("id", targetId)
      .single();

    if (!item || item.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch reviews with author names
  const { data: reviews, error } = await serviceClient
    .from("moderation_reviews")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with author names
  const authorIds = [...new Set((reviews ?? []).map((r) => r.author_id))];
  let authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: authors } = await serviceClient
      .from("users")
      .select("id, name, email")
      .in("id", authorIds);

    if (authors) {
      authorMap = Object.fromEntries(
        authors.map((a) => [a.id, a.name || a.email?.split("@")[0] || "Unknown"])
      );
    }
  }

  const enrichedReviews = (reviews ?? []).map((r) => ({
    ...r,
    author_name: authorMap[r.author_id] ?? "Unknown",
  }));

  return NextResponse.json({ reviews: enrichedReviews });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
git commit -m "feat: add review thread API endpoint"
```

---

## Chunk 3: Shared UI Components

### Task 8: Create RejectionModal component

**Files:**
- Create: `src/components/moderation/RejectionModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { XCircle, Loader2 } from "lucide-react";

interface RejectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: "event" | "club";
  onSubmit: (category: RejectionCategory, message: string) => Promise<void>;
}

export function RejectionModal({
  open,
  onOpenChange,
  itemName,
  itemType,
  onSubmit,
}: RejectionModalProps) {
  const [category, setCategory] = useState<RejectionCategory | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(category as RejectionCategory, message.trim());
      setCategory("");
      setMessage("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = category !== "" && message.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <XCircle className="h-5 w-5 text-red-500" />
            Reject {itemType === "event" ? "Event" : "Club"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Rejecting <span className="font-medium text-zinc-700 dark:text-zinc-300">&quot;{itemName}&quot;</span>.
            Please provide a reason so the organizer understands what needs to change.
          </p>

          {/* Category select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RejectionCategory)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Select a reason...</option>
              {Object.entries(REJECTION_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Details <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what needs to change..."
              rows={4}
              className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              This message will be visible to the organizer. Keep it under 500 characters.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-4 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/RejectionModal.tsx
git commit -m "feat: add RejectionModal shared component"
```

### Task 9: Create AppealBadge component

**Files:**
- Create: `src/components/moderation/AppealBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface AppealBadgeProps {
  appealCount: number;
}

export function AppealBadge({ appealCount }: AppealBadgeProps) {
  if (appealCount <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
      Appeal{appealCount > 1 ? ` #${appealCount}` : ""}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/AppealBadge.tsx
git commit -m "feat: add AppealBadge component"
```

### Task 10: Create ReviewThread component

**Files:**
- Create: `src/components/moderation/ReviewThread.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { REJECTION_CATEGORIES, type ModerationReview, type RejectionCategory } from "@/types";
import { MessageSquare, ShieldCheck, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface ReviewThreadProps {
  targetType: "event" | "club";
  targetId: string;
  currentUserId?: string;
}

export function ReviewThread({ targetType, targetId, currentUserId }: ReviewThreadProps) {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/moderation/reviews/${targetType}/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [targetType, targetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Review History
      </h4>
      <div className="space-y-2">
        {reviews.map((review) => {
          const isCurrentUser = review.author_id === currentUserId;
          const roleLabel =
            review.action === "appeal" ? "You" :
            review.action === "approval" ? "Moderator" : "Moderator";

          return (
            <div
              key={review.id}
              className={`rounded-lg border p-3 text-sm ${
                review.action === "rejection"
                  ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                  : review.action === "appeal"
                  ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
                  : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {review.action === "rejection" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : review.action === "appeal" ? (
                  <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {isCurrentUser ? "You" : roleLabel}
                </span>
                {review.action === "rejection" && review.category && (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                    {REJECTION_CATEGORIES[review.category as RejectionCategory]}
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                  {review.created_at ? new Date(review.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : ""}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {review.message}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/ReviewThread.tsx
git commit -m "feat: add ReviewThread component"
```

### Task 11: Create AppealForm component

**Files:**
- Create: `src/components/AppealForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";

interface AppealFormProps {
  itemType: "event" | "club";
  itemId: string;
  onSuccess: () => void;
}

export function AppealForm({ itemType, itemId, onSuccess }: AppealFormProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const endpoint =
        itemType === "event"
          ? `/api/events/${itemId}/appeal`
          : `/api/clubs/${itemId}/appeal`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit appeal");
        return;
      }

      setMessage("");
      onSuccess();
    } catch {
      setError("Failed to submit appeal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-orange-500" />
        Submit an Appeal
      </h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Explain what you&apos;ve changed and why this {itemType} should be reconsidered.
      </p>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe the changes you've made..."
        rows={3}
        className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          Submit Appeal
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppealForm.tsx
git commit -m "feat: add AppealForm organizer component"
```

---

## Chunk 4: Moderation UI Integration

### Task 12: Update pending events page with RejectionModal and AppealBadge

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Add imports and update interface**

At the top of the file, add imports:
```typescript
import { RejectionModal } from "@/components/moderation/RejectionModal";
import { AppealBadge } from "@/components/moderation/AppealBadge";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import type { RejectionCategory } from "@/types";
```

Add `appeal_count` to the `PendingEvent` interface:
```typescript
  appeal_count: number;
```

Update the `fetchPending` query to also select `appeal_count`.

- [ ] **Step 2: Add rejection modal state and handler**

Add state for the rejection modal:
```typescript
const [rejectingEvent, setRejectingEvent] = useState<PendingEvent | null>(null);
const [expandedThread, setExpandedThread] = useState<string | null>(null);
```

Replace the existing `handleAction` function. When `status === "rejected"`, instead of calling the API directly, open the rejection modal by calling `setRejectingEvent(event)`. Keep the approve action as-is.

Add a new handler for the rejection modal submission:
```typescript
const handleReject = async (category: RejectionCategory, message: string) => {
  if (!rejectingEvent) return;
  setActionLoading(rejectingEvent.id);
  try {
    const res = await fetch(`/api/admin/events/${rejectingEvent.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", category, message }),
    });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== rejectingEvent.id));
    }
  } finally {
    setActionLoading(null);
  }
};
```

- [ ] **Step 3: Update the reject button to open modal**

Change the reject button's `onClick` from `setConfirmAction({ id: event.id, status: "rejected" })` to `setRejectingEvent(event)`. Keep the approve button using the confirm action flow.

- [ ] **Step 4: Add AppealBadge next to the pending badge**

After the "Pending" badge in the image overlay area, add:
```tsx
{event.appeal_count > 0 && (
  <div className="absolute top-2.5 left-2.5">
    <button onClick={() => setExpandedThread(expandedThread === event.id ? null : event.id)}>
      <AppealBadge appealCount={event.appeal_count} />
    </button>
  </div>
)}
```

- [ ] **Step 5: Add ReviewThread expandable section**

After the event card's content div, add a conditionally rendered review thread:
```tsx
{expandedThread === event.id && (
  <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
    <ReviewThread targetType="event" targetId={event.id} />
  </div>
)}
```

- [ ] **Step 6: Render the RejectionModal**

At the end of the component (after the edit Dialog), add:
```tsx
{rejectingEvent && (
  <RejectionModal
    open={!!rejectingEvent}
    onOpenChange={(open) => !open && setRejectingEvent(null)}
    itemName={rejectingEvent.title}
    itemType="event"
    onSubmit={handleReject}
  />
)}
```

- [ ] **Step 7: Verify build**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 8: Commit**

```bash
git add src/app/moderation/pending/page.tsx
git commit -m "feat: integrate RejectionModal and AppealBadge into pending events page"
```

### Task 13: Update events queue page with RejectionModal and AppealBadge

**Files:**
- Modify: `src/app/moderation/events/page.tsx`

- [ ] **Step 1: Add imports, update interface, add rejection modal state**

Add the same imports as Task 12. Add `appeal_count: number` to the `AdminEvent` interface. Add state for `rejectingEvent` and `expandedThread`.

- [ ] **Step 2: Replace the reject button click handler**

In the current `handleStatusChange` function, when called with `"rejected"`, it sends the request without category/message. Change the reject button's `onClick` to instead find the event and set `rejectingEvent`. Create a `handleReject` callback similar to Task 12.

- [ ] **Step 3: Add AppealBadge in the status column**

Next to the status badge, conditionally render `<AppealBadge appealCount={event.appeal_count} />` when `appeal_count > 0`.

- [ ] **Step 4: Add appeals filter option**

In the status filter dropdown, add a new option:
```html
<option value="appeals">Appeals Only</option>
```

When `statusFilter === "appeals"`, filter events client-side to those with `appeal_count > 0 && status === "pending"`.

- [ ] **Step 5: Add ReviewThread toggle and render RejectionModal**

Same pattern as Task 12 — clicking the AppealBadge toggles the review thread, and the RejectionModal is rendered at the end.

- [ ] **Step 6: Commit**

```bash
git add src/app/moderation/events/page.tsx
git commit -m "feat: integrate RejectionModal, AppealBadge, and appeals filter into events queue"
```

### Task 14: Update clubs moderation page with RejectionModal and AppealBadge

**Files:**
- Modify: `src/app/moderation/clubs/page.tsx`

- [ ] **Step 1: Add imports and update interface**

Add imports for `RejectionModal`, `AppealBadge`, `ReviewThread`, and `RejectionCategory`. Add `appeal_count: number` to the `ClubWithCreator` interface.

- [ ] **Step 2: Replace reject button to open modal**

Instead of the simple confirm flow for rejection, open the `RejectionModal`. Create a `handleReject` callback that sends `category` and `message` to the existing PATCH endpoint.

- [ ] **Step 3: Add AppealBadge in the status column**

In the status `<td>`, after `{statusBadge(club.status)}`, add the AppealBadge.

- [ ] **Step 4: Add appeals filter**

Add an "Appeals" option to the FILTERS array and filter for `appeal_count > 0 && status === "pending"`.

- [ ] **Step 5: Render RejectionModal and ReviewThread**

Same patterns as previous tasks.

- [ ] **Step 6: Commit**

```bash
git add src/app/moderation/clubs/page.tsx
git commit -m "feat: integrate RejectionModal, AppealBadge into clubs moderation"
```

### Task 15: Add Appeals nav item and dedicated appeals page

**Files:**
- Modify: `src/app/moderation/ModerationNav.tsx`
- Create: `src/app/moderation/appeals/page.tsx`

- [ ] **Step 1: Add Appeals to ModerationNav**

In `src/app/moderation/ModerationNav.tsx`, import `MessageSquare` from lucide-react. Add a new entry to `contentItems` after "Club Approvals":
```typescript
{ name: "Appeals", path: "/moderation/appeals", icon: MessageSquare },
```

- [ ] **Step 2: Create the appeals page**

Create `src/app/moderation/appeals/page.tsx` — a client component that fetches pending events and clubs with `appeal_count > 0`, displaying them in a combined table. Each row shows: item name, type (event/club), appeal count, latest appeal message preview, submitted date. Clicking expands the full ReviewThread.

The page should:
- Fetch events via `/api/admin/events?status=pending` and filter client-side for `appeal_count > 0`
- Fetch clubs via `/api/admin/clubs?status=pending` and filter client-side for `appeal_count > 0`
- Combine into a single sorted list
- Each item has approve/reject actions (reject opens RejectionModal)
- Review thread expandable per item

Follow the existing moderation page styling patterns (zinc/dark mode, rounded-xl cards, table with hover states).

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/ModerationNav.tsx src/app/moderation/appeals/page.tsx
git commit -m "feat: add dedicated appeals page and nav item"
```

### Task 16: Add appeals count to moderation dashboard

**Files:**
- Modify: `src/app/moderation/page.tsx`

- [ ] **Step 1: Add appeals count query**

In the `Promise.all` block, add a query for pending appeals:
```typescript
supabase
  .from("events")
  .select("id", { count: "exact", head: true })
  .eq("status", "pending")
  .gt("appeal_count", 0),
supabase
  .from("clubs")
  .select("id", { count: "exact", head: true })
  .eq("status", "pending")
  .gt("appeal_count", 0),
```

- [ ] **Step 2: Display appeals count in the stats or as a link**

Add a subtle "X appeals pending" link below the "Items Need Review" stat card, or add it as a new stat card. Link to `/moderation/appeals`.

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/page.tsx
git commit -m "feat: show appeals count on moderation dashboard"
```

---

## Chunk 5: Organizer-Side UI

### Task 17: Add rejection banner and appeal form to EventDetailClient

**Files:**
- Modify: `src/app/events/[id]/EventDetailClient.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { AppealForm } from "@/components/AppealForm";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { AlertTriangle } from "lucide-react";
```

- [ ] **Step 2: Fetch latest rejection for the event**

After the event is loaded, if `event.status === "rejected"` and the current user is the creator, fetch the review thread to get the latest rejection:
```typescript
const [latestRejection, setLatestRejection] = useState<{
  category: string;
  message: string;
  created_at: string;
} | null>(null);

// Inside the useEffect that fetches the event, after setEvent(data.event):
if (data.event.status === "rejected" && user?.id === data.event.created_by) {
  const reviewRes = await fetch(`/api/moderation/reviews/event/${id}`);
  if (reviewRes.ok) {
    const reviewData = await reviewRes.json();
    const rejections = reviewData.reviews?.filter((r: any) => r.action === "rejection") ?? [];
    if (rejections.length > 0) {
      setLatestRejection(rejections[rejections.length - 1]);
    }
  }
}
```

- [ ] **Step 3: Render rejection banner**

When `event.status === "rejected"` and the user is the creator, render a banner above the event content:

```tsx
{event.status === "rejected" && user?.id === event.created_by && (
  <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-red-500" />
      <h3 className="font-semibold text-red-700 dark:text-red-400">
        This event was not approved
      </h3>
    </div>
    {latestRejection && (
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400 mr-2">
          {REJECTION_CATEGORIES[latestRejection.category as RejectionCategory]}
        </span>
        {latestRejection.message}
      </div>
    )}
    <ReviewThread targetType="event" targetId={event.id} currentUserId={user?.id} />
    <AppealForm itemType="event" itemId={event.id} onSuccess={() => window.location.reload()} />
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/events/[id]/EventDetailClient.tsx
git commit -m "feat: add rejection banner, review thread, and appeal form to event detail"
```

### Task 18: Add rejection banner and appeal form to ClubDashboard

**Files:**
- Modify: `src/components/clubs/ClubDashboard.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { AppealForm } from "@/components/AppealForm";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { AlertTriangle } from "lucide-react";
```

- [ ] **Step 2: Fetch latest rejection when club is rejected**

Add state and fetch logic similar to Task 17, but for the club.

- [ ] **Step 3: Render rejection banner**

When `club.status === "rejected"` and the user is the club creator, render a banner at the top of the dashboard (above the tab navigation) with:
- Rejection category and message
- Full review thread
- Appeal form

Follow the same pattern as Task 17 but adapted for club data.

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/ClubDashboard.tsx
git commit -m "feat: add rejection banner, review thread, and appeal form to club dashboard"
```

### Task 19: Show rejection status on public club page for creator

**Files:**
- Modify: `src/app/clubs/[id]/page.tsx`

- [ ] **Step 1: Read the current public club page**

Read `src/app/clubs/[id]/page.tsx` to understand the structure.

- [ ] **Step 2: Add rejection banner for club creator**

If the current user is the club creator and the club status is `rejected`, render a rejection banner similar to Task 18 but simpler — show the rejection status with a link to the club dashboard (`/my-clubs/{id}`) where they can appeal. This page is public-facing so the full appeal form should live on the dashboard, not here.

Add imports for `AlertTriangle` from lucide-react and a link to the dashboard:

```tsx
{club.status === "rejected" && user?.id === club.created_by && (
  <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-4 flex items-center gap-3">
    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        This club was not approved.
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
        Visit your club dashboard to see the rejection reason and submit an appeal.
      </p>
    </div>
    <Link
      href={`/my-clubs/${club.id}`}
      className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400"
    >
      View Details
    </Link>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/[id]/page.tsx
git commit -m "feat: show rejection banner on public club page for creator"
```

### Task 20: Final build verification and cleanup

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npx tsc --noEmit --pretty`

Fix any type errors.

- [ ] **Step 2: Run ESLint**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npm run lint`

Fix any lint errors.

- [ ] **Step 3: Run dev server smoke test**

Run: `cd /Users/adyanullah/Documents/GitHub/Event-Radar && npm run build`

Verify the build succeeds without errors.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type and lint errors from rejection handling feature"
```
