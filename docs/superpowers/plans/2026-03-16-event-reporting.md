# Event Reporting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to report events, with reports surfacing in a new moderation dashboard tab for admin review.

**Architecture:** New `event_reports` Supabase table with RLS, three API routes (POST report, GET admin list, PATCH admin action), a report dialog in EventDetailView, and a new `/moderation/reports` page following existing moderation patterns.

**Tech Stack:** Next.js App Router, Supabase (server client + service client), TypeScript, Tailwind CSS, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-16-event-reporting-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/audit.ts` | Add `report_reviewed`, `report_dismissed` to AuditAction; `event_report` to AuditTargetType |
| Modify | `src/types/index.ts` | Add `ReportStatus` type and `EventReport` interface |
| Create | `src/app/api/events/[id]/report/route.ts` | POST endpoint for user report submission |
| Create | `src/app/api/admin/reports/route.ts` | GET endpoint for admin report listing |
| Create | `src/app/api/admin/reports/[id]/route.ts` | PATCH endpoint for admin report action |
| Create | `src/components/events/ReportEventDialog.tsx` | Report dialog component (category select + message) |
| Modify | `src/components/events/EventDetailView.tsx` | Add report button + dialog integration |
| Create | `src/app/moderation/reports/page.tsx` | Moderation reports page |
| Modify | `src/app/moderation/ModerationNav.tsx` | Add Reports nav item |

---

## Chunk 1: Types and Audit Extensions

### Task 1: Extend audit types

**Files:**
- Modify: `src/lib/audit.ts:3-12`

- [ ] **Step 1: Add new audit action and target types**

In `src/lib/audit.ts`, extend the two type unions:

```typescript
export type AuditAction =
  | "approved"
  | "rejected"
  | "created"
  | "updated"
  | "deleted"
  | "bulk_approved"
  | "bulk_rejected"
  | "report_reviewed"
  | "report_dismissed";

export type AuditTargetType = "event" | "user" | "club" | "featured_event" | "organizer_request" | "event_report";
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add report_reviewed, report_dismissed actions and event_report target type"
```

### Task 2: Add EventReport type

**Files:**
- Modify: `src/types/index.ts` (append after ModerationReview interface, around line 389)

- [ ] **Step 1: Add ReportStatus and EventReport types**

Append after the `ModerationReview` interface block:

```typescript
// ── Event Report Types ──────────────────────────────────────────────

export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface EventReport {
  id: string;
  event_id: string;
  reporter_id: string;
  category: RejectionCategory;
  message: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ReportStatus and EventReport types"
```

---

## Chunk 2: Database Migration

### Task 3: Create event_reports table migration

**Files:**
- Create: Supabase migration via MCP tool

- [ ] **Step 1: Apply migration**

Use the Supabase MCP tool (`mcp__plugin_supabase_supabase__apply_migration`) to create the `event_reports` table:

```sql
-- Create event_reports table
CREATE TABLE event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reports_unique_per_user UNIQUE (event_id, reporter_id),
  CONSTRAINT event_reports_status_check CHECK (status IN ('pending', 'reviewed', 'dismissed'))
);

-- Index for admin queries (filter by status, order by created_at)
CREATE INDEX idx_event_reports_status_created ON event_reports(status, created_at DESC);

-- RLS policies
-- Note: unique constraint on (event_id, reporter_id) already creates an implicit index
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own reports
CREATE POLICY "Users can insert own reports"
  ON event_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can read their own reports (to show "Reported" state)
CREATE POLICY "Users can read own reports"
  ON event_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Admins can read all reports
CREATE POLICY "Admins can read all reports"
  ON event_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );

-- Admins can update reports (review/dismiss)
CREATE POLICY "Admins can update reports"
  ON event_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );
```

- [ ] **Step 2: Regenerate Supabase types**

Use `mcp__plugin_supabase_supabase__generate_typescript_types` and update `src/lib/supabase/types.ts` with the output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(db): add event_reports table with RLS policies"
```

---

## Chunk 3: API Routes

### Task 4: POST /api/events/[id]/report

**Files:**
- Create: `src/app/api/events/[id]/report/route.ts`

- [ ] **Step 1: Create the report submission endpoint**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { REJECTION_CATEGORIES } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const body = await request.json();
  const { category, message } = body;

  // Validate category
  if (!category || !(category in REJECTION_CATEGORIES)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Validate event exists and is approved
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status, created_by")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "approved") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Prevent self-reporting
  if (event.created_by === user.id) {
    return NextResponse.json(
      { error: "Cannot report your own event" },
      { status: 403 }
    );
  }

  // Insert report (unique constraint handles duplicate prevention)
  const { error: insertError } = await supabase
    .from("event_reports")
    .insert({
      event_id: eventId,
      reporter_id: user.id,
      category,
      message: message ? sanitizeText(message).slice(0, 500) : null,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this event" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/\[id\]/report/route.ts
git commit -m "feat(api): add POST /api/events/[id]/report endpoint"
```

### Task 5: GET /api/admin/reports

**Files:**
- Create: `src/app/api/admin/reports/route.ts`

- [ ] **Step 1: Create the admin reports listing endpoint**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const eventId = url.searchParams.get("event_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const supabase = createServiceClient();

  // Note: after Task 3 regenerates types, event_reports will be in the Database type
  // and these queries will be fully typed without `as any`.
  let query = (supabase as any)
    .from("event_reports")
    .select(`
      *,
      event:events!inner(id, title, status, deleted_at),
      reporter:users!event_reports_reporter_id_fkey(id, display_name, avatar_url)
    `)
    .is("event.deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data: reports, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute accurate report_count per event via a separate query
  // (not limited by pagination or status filter)
  const eventIds = [...new Set((reports || []).map((r: any) => r.event_id))];
  const eventCounts: Record<string, number> = {};

  if (eventIds.length > 0) {
    const { data: countRows } = await (supabase as any)
      .from("event_reports")
      .select("event_id")
      .in("event_id", eventIds);

    if (countRows) {
      for (const row of countRows) {
        eventCounts[row.event_id] = (eventCounts[row.event_id] || 0) + 1;
      }
    }
  }

  const enriched = (reports || []).map((r: any) => ({
    ...r,
    report_count: eventCounts[r.event_id] || 1,
  }));

  return NextResponse.json({ reports: enriched });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/route.ts
git commit -m "feat(api): add GET /api/admin/reports endpoint"
```

### Task 6: PATCH /api/admin/reports/[id]

**Files:**
- Create: `src/app/api/admin/reports/[id]/route.ts`

- [ ] **Step 1: Create the admin report action endpoint**

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

  if (!["reviewed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: report, error: fetchError } = await (supabase as any)
    .from("event_reports")
    .select("id, event_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "pending") {
    return NextResponse.json(
      { error: "Report has already been actioned" },
      { status: 409 }
    );
  }

  const { error: updateError } = await (supabase as any)
    .from("event_reports")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
      action: status === "reviewed" ? "report_reviewed" : "report_dismissed",
      targetType: "event_report",
      targetId: id,
      metadata: { event_id: report.event_id },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/reports/\[id\]/route.ts
git commit -m "feat(api): add PATCH /api/admin/reports/[id] endpoint"
```

---

## Chunk 4: User-Facing UI

### Task 7: Create ReportEventDialog component

**Files:**
- Create: `src/components/events/ReportEventDialog.tsx`

- [ ] **Step 1: Create the report dialog component**

This component uses the shadcn/ui `Dialog` primitives (same pattern as `src/components/moderation/RejectionModal.tsx`) for focus trapping, escape key handling, and accessibility. Resets form state when dialog opens.

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { Flag, Loader2 } from "lucide-react";

interface ReportEventDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}

export function ReportEventDialog({
  eventId,
  open,
  onOpenChange,
  onReported,
}: ReportEventDialogProps) {
  const [category, setCategory] = useState<RejectionCategory | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setCategory("");
      setMessage("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        setError("You have already reported this event.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit report.");
        return;
      }

      onReported();
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Flag className="h-5 w-5 text-red-500" />
            Report Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Why are you reporting this event?
          </p>

          {/* Category selection */}
          <div className="space-y-2">
            {(Object.entries(REJECTION_CATEGORIES) as [RejectionCategory, string][]).map(
              ([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    category === key
                      ? "border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={key}
                    checked={category === key}
                    onChange={() => setCategory(key)}
                    className="accent-red-500"
                  />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {label}
                  </span>
                </label>
              )
            )}
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Additional details (optional)"
              rows={3}
              className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right">
              {message.length}/500
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
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
            disabled={!category || submitting}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-4 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            Submit Report
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/events/ReportEventDialog.tsx
git commit -m "feat(ui): add ReportEventDialog component"
```

### Task 8: Add report button to EventDetailView

**Files:**
- Modify: `src/components/events/EventDetailView.tsx`

- [ ] **Step 1: Add report state, imports, and check for existing report**

At the top of `EventDetailView.tsx`:
- Add imports: `Flag, CheckCircle` from lucide-react, `ReportEventDialog` from `./ReportEventDialog`, `useAuthStore` from `@/store/useAuthStore`
- Add state variables inside the component: `reportDialogOpen`, `hasReported`
- Add a `useEffect` that checks if the current user has already reported this event by calling `GET /api/events/${event.id}/report/check` — actually simpler: just fetch reports on mount isn't needed. Instead, just track local state and let the 409 handle duplicates.

Add to imports:

```typescript
import { Flag, CheckCircle } from "lucide-react";  // add Flag, CheckCircle to existing lucide import
import { ReportEventDialog } from "@/components/events/ReportEventDialog";
import { useAuthStore } from "@/store/useAuthStore";
```

Add state inside the component (after the `liked` state):

```typescript
const [reportDialogOpen, setReportDialogOpen] = useState(false);
const [hasReported, setHasReported] = useState(false);
const { user } = useAuthStore();
```

- [ ] **Step 2: Add report button in the sidebar**

After the `{event.rsvp_link && (<p>...</p>)}` block (around line 437), before the closing `</div>` of the sticky sidebar, add:

```tsx
{/* Report link */}
{user && (
  <div className="mt-6 flex justify-center">
    <button
      onClick={() => hasReported ? undefined : setReportDialogOpen(true)}
      disabled={hasReported}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:cursor-default disabled:hover:text-muted-foreground"
    >
      {hasReported ? (
        <>
          <CheckCircle className="h-3 w-3" />
          <span>Reported</span>
        </>
      ) : (
        <>
          <Flag className="h-3 w-3" />
          <span>Report</span>
        </>
      )}
    </button>
  </div>
)}
```

- [ ] **Step 3: Add the ReportEventDialog at the end of the component**

Before the final closing `</div>` of the component (line 468), add:

```tsx
<ReportEventDialog
  eventId={event.id}
  open={reportDialogOpen}
  onOpenChange={setReportDialogOpen}
  onReported={() => setHasReported(true)}
/>
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/events/EventDetailView.tsx
git commit -m "feat(ui): add report button and dialog to EventDetailView"
```

---

## Chunk 5: Moderation Dashboard

### Task 9: Create /moderation/reports page

**Files:**
- Create: `src/app/moderation/reports/page.tsx`

- [ ] **Step 1: Create the reports moderation page**

Follow the pattern from `src/app/moderation/appeals/page.tsx` — client component with fetch, status filter, action buttons.

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Flag,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

interface ReportItem {
  id: string;
  event_id: string;
  reporter_id: string;
  category: RejectionCategory;
  message: string | null;
  status: string;
  created_at: string;
  report_count: number;
  event: { id: string; title: string; status: string };
  reporter: { id: string; display_name: string; avatar_url: string | null };
}

type StatusFilter = "all" | "pending" | "reviewed" | "dismissed";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/admin/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (reportId: string, status: "reviewed" | "dismissed") => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        // Re-fetch to get accurate list (works correctly regardless of filter)
        await fetchReports();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "Pending", value: "pending" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Dismissed", value: "dismissed" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Reported Events
        </h2>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {reports.length}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab.value
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <Flag className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No reports</p>
            <p className="text-xs mt-1">
              {filter === "pending"
                ? "No pending reports to review."
                : "No reports match this filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {reports.map((report) => (
              <div
                key={report.id}
                className="px-5 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Flag className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/events/${report.event_id}`}
                        className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary truncate"
                      >
                        {report.event?.title ?? "Unknown Event"}
                      </Link>
                      {report.report_count > 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          {report.report_count} reports
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {REJECTION_CATEGORIES[report.category] ?? report.category}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        by {report.reporter?.display_name ?? "Unknown"}
                      </span>
                    </div>

                    {report.message && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 whitespace-pre-wrap">
                        {report.message}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  {report.status === "pending" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAction(report.id, "reviewed")}
                        disabled={actionLoading === report.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === report.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Review
                      </button>
                      <button
                        onClick={() => handleAction(report.id, "dismissed")}
                        disabled={actionLoading === report.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-500 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                      <Link
                        href={`/events/${report.event_id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="View event"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/reports/page.tsx
git commit -m "feat(moderation): add /moderation/reports page"
```

### Task 10: Add Reports to ModerationNav

**Files:**
- Modify: `src/app/moderation/ModerationNav.tsx`

- [ ] **Step 1: Add Flag import and Reports nav item**

Add `Flag` to the lucide-react import in `ModerationNav.tsx`.

Add a new entry to the `contentItems` array after the Appeals entry (index 4):

```typescript
{ name: "Reports", path: "/moderation/reports", icon: Flag },
```

The full `contentItems` array should be:

```typescript
const contentItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Pending Review", path: "/moderation/pending", icon: ClipboardCheck },
  { name: "Event Queue", path: "/moderation/events", icon: CalendarClock },
  { name: "Club Approvals", path: "/moderation/clubs", icon: Building2 },
  { name: "Appeals", path: "/moderation/appeals", icon: MessageSquare },
  { name: "Reports", path: "/moderation/reports", icon: Flag },
  { name: "Featured Events", path: "/moderation/featured", icon: Star },
];
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/ModerationNav.tsx
git commit -m "feat(moderation): add Reports tab to ModerationNav"
```

---

## Chunk 6: Final Verification

### Task 11: End-to-end verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No lint errors in new/modified files

- [ ] **Step 3: Final commit if any fixes needed**

Fix any build/lint issues and commit.
