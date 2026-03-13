# Featured Events System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a featured/sponsored events system with a hero carousel, public + admin APIs, and admin management UI.

**Architecture:** New `featured_events` Supabase table with RLS. Public API returns active promotions; admin CRUD API behind `verifyAdmin()`. HeroSection rewritten as an Embla carousel with branded fallback. Admin UI: quick "Feature" action on pending page + dedicated `/moderation/featured` management page.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (RLS + service client), Embla Carousel (`embla-carousel-react` + `embla-carousel-autoplay`), Tailwind CSS, shadcn/ui components, SWR-style fetch hooks.

**Spec:** `docs/superpowers/specs/2026-03-13-featured-events-design.md`

---

## Chunk 1: Data Layer & API Routes

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260313000001_featured_events.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Featured events / sponsored promotions
CREATE TABLE featured_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_name text,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_events_date_order CHECK (ends_at > starts_at)
);

-- Only one active/upcoming featured entry per event
CREATE UNIQUE INDEX featured_events_active_event
  ON featured_events (event_id) WHERE ends_at > now();

-- RLS
ALTER TABLE featured_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active featured events"
  ON featured_events FOR SELECT
  USING (starts_at <= now() AND ends_at > now());

CREATE POLICY "Admins can manage featured events"
  ON featured_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );
```

- [ ] **Step 2: Apply the migration to Supabase**

Run the migration via the Supabase dashboard SQL editor or CLI. Verify the table, index, and policies exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260313000001_featured_events.sql
git commit -m "feat: add featured_events table migration"
```

---

### Task 2: Types & Audit Extension

**Files:**
- Modify: `src/types/index.ts` (add `FeaturedEvent` interface after `Review` types, ~line 298)
- Modify: `src/lib/audit.ts` (extend `AuditTargetType` at line 12)
- Modify: `src/lib/constants.ts` (add `HERO_FALLBACK_IMAGE` and `API_ENDPOINTS` entries)

- [ ] **Step 1: Add `FeaturedEvent` type to `src/types/index.ts`**

Add after the `ReviewAggregate` interface (after line 298):

```typescript
// ── Featured Events Types ─────────────────────────────────────────────

export interface FeaturedEvent {
  id: string;
  event_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  event: Event;
}
```

- [ ] **Step 2: Extend `AuditTargetType` in `src/lib/audit.ts`**

Change line 12 from:
```typescript
export type AuditTargetType = "event" | "user" | "club";
```
To:
```typescript
export type AuditTargetType = "event" | "user" | "club" | "featured_event";
```

- [ ] **Step 3: Add constants to `src/lib/constants.ts`**

Add before the closing of the file:

```typescript
export const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1576495199011-eb94736d05d6?q=80&w=2872&auto=format&fit=crop";

export const FEATURED_DURATION_PRESETS = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const;
```

Also add to the `API_ENDPOINTS` object:

```typescript
FEATURED_EVENTS: "/api/events/featured",
ADMIN_FEATURED: "/api/admin/featured",
ADMIN_FEATURED_DETAIL: (id: string) => `/api/admin/featured/${id}`,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/audit.ts src/lib/constants.ts
git commit -m "feat: add FeaturedEvent type, extend audit types, add constants"
```

---

### Task 3: Public Featured Events API

**Files:**
- Create: `src/app/api/events/featured/route.ts`

- [ ] **Step 1: Create the public GET endpoint**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("featured_events")
      .select("*, event:events(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out entries where the joined event is missing or not approved
    const featured = (data ?? []).filter(
      (row: any) => row.event && row.event.status === "approved"
    );

    return NextResponse.json({ featured });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify route loads**

Run: `npm run dev` and hit `http://localhost:3000/api/events/featured`
Expected: `{ "featured": [] }` (empty array since no featured events exist yet)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/featured/route.ts
git commit -m "feat: add public featured events API endpoint"
```

---

### Task 4: Admin Featured Events CRUD API

**Files:**
- Create: `src/app/api/admin/featured/route.ts`
- Create: `src/app/api/admin/featured/[id]/route.ts`

- [ ] **Step 1: Create admin GET + POST route at `src/app/api/admin/featured/route.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sanitizeText } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from("featured_events")
      .select("*, event:events(id, title, image_url, event_date, event_time, status)")
      .order("ends_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const active = (data ?? []).filter(
      (r: any) => r.starts_at <= now && r.ends_at > now
    );
    const upcoming = (data ?? []).filter((r: any) => r.starts_at > now);
    const expired = (data ?? []).filter((r: any) => r.ends_at <= now);

    return NextResponse.json({ active, upcoming, expired });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { event_id, priority, starts_at, ends_at } = body;

    if (!event_id || !starts_at || !ends_at) {
      return NextResponse.json(
        { error: "event_id, starts_at, and ends_at are required" },
        { status: 400 }
      );
    }

    const sponsor_name = body.sponsor_name
      ? sanitizeText(body.sponsor_name)
      : null;

    const { data, error } = await supabase
      .from("featured_events")
      .insert({
        event_id,
        sponsor_name,
        priority: priority ?? 0,
        starts_at,
        ends_at,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This event already has an active or upcoming featured entry" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "created",
        targetType: "featured_event",
        targetId: data.id,
        metadata: { event_id, sponsor_name, starts_at, ends_at },
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ featured: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create featured event" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create admin PATCH + DELETE route at `src/app/api/admin/featured/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sanitizeText } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.sponsor_name !== undefined) {
      updates.sponsor_name = body.sponsor_name
        ? sanitizeText(body.sponsor_name)
        : null;
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.starts_at !== undefined) updates.starts_at = body.starts_at;
    if (body.ends_at !== undefined) updates.ends_at = body.ends_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("featured_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "updated",
        targetType: "featured_event",
        targetId: id,
        metadata: updates,
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ featured: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to update featured event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { error } = await supabase
      .from("featured_events")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "deleted",
        targetType: "featured_event",
        targetId: id,
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete featured event" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/featured/route.ts src/app/api/admin/featured/\[id\]/route.ts
git commit -m "feat: add admin CRUD API for featured events"
```

---

## Chunk 2: Client Hook & Hero Carousel

### Task 5: Install Embla Autoplay Plugin

**Files:** None (package install only)

- [ ] **Step 1: Install the autoplay plugin**

```bash
npm install embla-carousel-autoplay
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add embla-carousel-autoplay dependency"
```

---

### Task 6: Featured Events Client Hook

**Files:**
- Create: `src/hooks/useFeaturedEvents.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { FeaturedEvent } from "@/types";

export function useFeaturedEvents() {
  const [featured, setFeatured] = useState<FeaturedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/events/featured");
        if (!res.ok) return;
        const data = await res.json();
        setFeatured(data.featured ?? []);
      } catch {
        // Silently fail — hero shows branded fallback
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return { featured, isLoading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFeaturedEvents.ts
git commit -m "feat: add useFeaturedEvents client hook"
```

---

### Task 7: Rewrite HeroSection with Carousel + Fallback

**Files:**
- Modify: `src/components/events/HeroSection.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `src/components/events/HeroSection.tsx`**

Replace the entire file with:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { UserCheck, Info, ChevronDown } from "lucide-react";
import { useFeaturedEvents } from "@/hooks/useFeaturedEvents";
import { HERO_FALLBACK_IMAGE } from "@/lib/constants";
import type { FeaturedEvent } from "@/types";

function HeroSlide({
  title,
  description,
  imageUrl,
  badge,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
}: {
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  onPrimary?: () => void;
  primaryLabel: string;
  onSecondary?: () => void;
  secondaryLabel: string;
}) {
  return (
    <div className="relative w-full h-[85vh] min-h-[500px] flex-[0_0_100%]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-36">
        <span className="inline-block px-5 py-2 bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-white/20 shadow-xl">
          {badge}
        </span>

        <h2 className="text-white text-5xl sm:text-6xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 drop-shadow-2xl">
          {title}
        </h2>

        <p className="text-white/90 text-lg lg:text-2xl font-medium max-w-2xl mb-10 leading-relaxed drop-shadow-lg line-clamp-3">
          {description}
        </p>

        <div className="flex items-center gap-5">
          <button
            onClick={onPrimary}
            className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-primary/40 flex items-center gap-3 cursor-pointer"
          >
            <UserCheck className="h-5 w-5 md:h-6 md:w-6" />
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="px-6 md:px-8 py-4 md:py-5 bg-white/10 backdrop-blur-md text-white font-bold border border-white/20 rounded-2xl hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer"
          >
            {secondaryLabel === "More Info" ? (
              <Info className="h-5 w-5 md:h-6 md:w-6" />
            ) : (
              <ChevronDown className="h-5 w-5 md:h-6 md:w-6" />
            )}
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DotIndicators({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (count <= 1) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
            i === selected
              ? "w-8 bg-white"
              : "w-2 bg-white/40 hover:bg-white/60"
          }`}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

export function HeroSection() {
  const router = useRouter();
  const { featured, isLoading } = useFeaturedEvents();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  // Branded fallback when no featured events
  if (isLoading || featured.length === 0) {
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title="Discover What's Happening on Campus"
          description="Your one-stop hub for McGill events. Find clubs, workshops, parties, career fairs, and everything in between."
          imageUrl={HERO_FALLBACK_IMAGE}
          badge="Uni-Verse"
          primaryLabel="Explore Events"
          onPrimary={() => {
            document
              .getElementById("discovery-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          secondaryLabel="Learn More"
          onSecondary={() => {
            document
              .getElementById("discovery-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>
    );
  }

  // Single featured event — no carousel needed
  if (featured.length === 1) {
    const f = featured[0];
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title={f.event.title}
          description={f.event.description}
          imageUrl={
            f.event.image_url || HERO_FALLBACK_IMAGE
          }
          badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Sponsored"}
          primaryLabel="Register Now"
          onPrimary={() => router.push(`/events/${f.event.id}`)}
          secondaryLabel="More Info"
          onSecondary={() => router.push(`/events/${f.event.id}`)}
        />
      </section>
    );
  }

  // Multiple featured events — carousel
  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {featured.map((f: FeaturedEvent) => (
            <HeroSlide
              key={f.id}
              title={f.event.title}
              description={f.event.description}
              imageUrl={
                f.event.image_url || HERO_FALLBACK_IMAGE
              }
              badge={
                f.sponsor_name
                  ? `Sponsored by ${f.sponsor_name}`
                  : "Sponsored"
              }
              primaryLabel="Register Now"
              onPrimary={() => router.push(`/events/${f.event.id}`)}
              secondaryLabel="More Info"
              onSecondary={() => router.push(`/events/${f.event.id}`)}
            />
          ))}
        </div>
      </div>
      <DotIndicators
        count={featured.length}
        selected={selectedIndex}
        onSelect={scrollTo}
      />
    </section>
  );
}
```

- [ ] **Step 2: Add scroll target ID to the homepage discovery feed**

In `src/app/page.tsx`, add `id="discovery-feed"` to the discovery feed wrapper div (line 100):

Change:
```typescript
<div className="pb-32 relative z-20 space-y-14">
```
To:
```typescript
<div id="discovery-feed" className="pb-32 relative z-20 space-y-14">
```

- [ ] **Step 3: Verify the hero renders**

Run: `npm run dev` and visit `http://localhost:3000`
Expected: Branded Uni-Verse fallback hero displays (since no featured events exist yet). "Explore Events" button should smooth-scroll to the feed below.

- [ ] **Step 4: Commit**

```bash
git add src/components/events/HeroSection.tsx src/app/page.tsx
git commit -m "feat: rewrite HeroSection with carousel and branded fallback"
```

---

## Chunk 3: Admin UI

### Task 8: Feature Event Modal Component

**Files:**
- Create: `src/components/moderation/FeatureEventModal.tsx`

- [ ] **Step 1: Create the shared modal component**

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEATURED_DURATION_PRESETS } from "@/lib/constants";
import { Star } from "lucide-react";

interface FeatureEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  /** If provided, modal is in "edit" mode with pre-filled values */
  existing?: {
    id: string;
    sponsor_name: string | null;
    priority: number;
    starts_at: string;
    ends_at: string;
  };
  onSubmit: () => void;
}

export function FeatureEventModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  existing,
  onSubmit,
}: FeatureEventModalProps) {
  const [sponsorName, setSponsorName] = useState(existing?.sponsor_name ?? "");
  const [priority, setPriority] = useState(existing?.priority ?? 0);
  const [startsAt, setStartsAt] = useState(
    existing?.starts_at
      ? new Date(existing.starts_at).toISOString().slice(0, 16)
      : ""
  );
  const [endsAt, setEndsAt] = useState(
    existing?.ends_at
      ? new Date(existing.ends_at).toISOString().slice(0, 16)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (days: number) => {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    if (!startsAt || !endsAt) {
      setError("Start and end dates are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        event_id: eventId,
        sponsor_name: sponsorName || null,
        priority,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      };

      const url = existing
        ? `/api/admin/featured/${existing.id}`
        : "/api/admin/featured";
      const method = existing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      onSubmit();
      onOpenChange(false);
    } catch {
      setError("Failed to save featured event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {existing ? "Edit Featured Event" : "Feature Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {existing ? "Editing promotion for" : "Promoting"}{" "}
            <strong>{eventTitle}</strong>
          </p>

          <div>
            <label className="text-sm font-medium">
              Sponsor Name (optional)
            </label>
            <Input
              placeholder="e.g. Joe's Coffee"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Duration Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {FEATURED_DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start</label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End</label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Higher priority = appears first in the carousel
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Star className="mr-2 h-4 w-4" />
            {loading
              ? "Saving..."
              : existing
                ? "Update"
                : "Feature Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/FeatureEventModal.tsx
git commit -m "feat: add FeatureEventModal component"
```

---

### Task 9: Add "Feature" Quick Action to Pending Events Page

**Files:**
- Modify: `src/app/moderation/pending/page.tsx`

- [ ] **Step 1: Add feature button and modal integration**

Add these imports at the top of the file (after existing imports):

```typescript
import { Star } from "lucide-react";
import { FeatureEventModal } from "@/components/moderation/FeatureEventModal";
```

Add state for the feature modal (after the `editForm` state declaration at line 31):

```typescript
const [featuringEvent, setFeaturingEvent] = useState<PendingEvent | null>(null);
```

Add a "Feature" button alongside the existing Approve/Reject/Edit buttons. In the button group (after the Edit button, around line 210), add:

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setFeaturingEvent(event)}
  disabled={actionLoading === event.id || event.status !== "approved"}
  title={event.status !== "approved" ? "Approve the event first" : "Feature this event"}
>
  <Star className="mr-2 h-4 w-4" />
  Feature
</Button>
```

Note: The pending page only shows pending events, so the Feature button will be disabled here. This is correct — you must approve first. The button becomes useful if this page is later extended to show approved events, or on other moderation views.

Add the modal before the closing `</div>` of the component (before the existing edit `<Dialog>`):

```typescript
{featuringEvent && (
  <FeatureEventModal
    open={!!featuringEvent}
    onOpenChange={(open) => !open && setFeaturingEvent(null)}
    eventId={featuringEvent.id}
    eventTitle={featuringEvent.title}
    onSubmit={() => setFeaturingEvent(null)}
  />
)}
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev` and visit `http://localhost:3000/moderation/pending`
Expected: Feature button appears (disabled since events are pending). No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/moderation/pending/page.tsx
git commit -m "feat: add Feature quick action to moderation pending page"
```

---

### Task 10: Update Moderation Nav

**Files:**
- Modify: `src/app/moderation/ModerationNav.tsx`

- [ ] **Step 1: Add Featured nav entry**

Add `Star` to the lucide-react import (line 12):

```typescript
import {
  LayoutDashboard,
  FileQuestion,
  AlertTriangle,
  Users,
  History,
  Star,
} from "lucide-react";
```

Add the Featured entry to the `navItems` array (after the "Mod Logs" entry, before the closing `]`):

```typescript
{ name: "Featured", path: "/moderation/featured", icon: Star },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/moderation/ModerationNav.tsx
git commit -m "feat: add Featured entry to moderation nav"
```

---

### Task 11: Featured Events Management Page

**Files:**
- Create: `src/app/moderation/featured/page.tsx`

- [ ] **Step 1: Create the management page**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Pencil, Plus } from "lucide-react";
import { FeatureEventModal } from "@/components/moderation/FeatureEventModal";

interface FeaturedRow {
  id: string;
  event_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    image_url: string | null;
    event_date: string;
    event_time: string;
    status: string;
  } | null;
}

type Tab = "active" | "upcoming" | "expired";

export default function FeaturedManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [data, setData] = useState<{
    active: FeaturedRow[];
    upcoming: FeaturedRow[];
    expired: FeaturedRow[];
  }>({ active: [], upcoming: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<FeaturedRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEventId, setAddEventId] = useState("");
  const [addEventTitle, setAddEventTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/featured");
      if (!res.ok) return;
      const json = await res.json();
      setData({
        active: json.active ?? [],
        upcoming: json.upcoming ?? [],
        expired: json.expired ?? [],
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this featured event?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/featured/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const searchEvents = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/events?status=approved&search=${encodeURIComponent(query)}&limit=10`
      );
      if (res.ok) {
        const json = await res.json();
        setSearchResults(
          (json.events ?? []).map((e: any) => ({
            id: e.id,
            title: e.title,
          }))
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const selectEventForAdd = (id: string, title: string) => {
    setAddEventId(id);
    setAddEventTitle(title);
    setSearchResults([]);
    setSearchQuery("");
  };

  const rows = data[activeTab];

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: data.active.length },
    { key: "upcoming", label: "Upcoming", count: data.upcoming.length },
    { key: "expired", label: "Expired", count: data.expired.length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Featured Events</h2>
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Star className="h-6 w-6 text-yellow-500" />
          Featured Events
        </h2>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Featured Event
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-2">
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No {activeTab} featured events.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {row.event?.title ?? "Unknown event"}
                    </CardTitle>
                    {row.sponsor_name && (
                      <p className="text-sm text-muted-foreground">
                        Sponsored by {row.sponsor_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">Priority: {row.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                  <span>
                    Start:{" "}
                    {new Date(row.starts_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    End:{" "}
                    {new Date(row.ends_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {row.event?.event_date && (
                    <span>
                      Event date:{" "}
                      {new Date(row.event.event_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRow(row)}
                    disabled={actionLoading === row.id}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(row.id)}
                    disabled={actionLoading === row.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingRow && editingRow.event && (
        <FeatureEventModal
          open={!!editingRow}
          onOpenChange={(open) => !open && setEditingRow(null)}
          eventId={editingRow.event_id}
          eventTitle={editingRow.event.title}
          existing={{
            id: editingRow.id,
            sponsor_name: editingRow.sponsor_name,
            priority: editingRow.priority,
            starts_at: editingRow.starts_at,
            ends_at: editingRow.ends_at,
          }}
          onSubmit={() => {
            setEditingRow(null);
            fetchData();
          }}
        />
      )}

      {/* Add modal — event search + feature modal */}
      {showAddModal && !addEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl border">
            <h3 className="text-lg font-semibold mb-4">
              Select an Approved Event
            </h3>
            <input
              type="text"
              placeholder="Search events..."
              className="w-full px-3 py-2 border rounded-lg mb-3 text-sm bg-background"
              value={searchQuery}
              onChange={(e) => searchEvents(e.target.value)}
              autoFocus
            />
            {searching && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((event) => (
                <button
                  key={event.id}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm cursor-pointer"
                  onClick={() => selectEventForAdd(event.id, event.title)}
                >
                  {event.title}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && addEventId && (
        <FeatureEventModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddModal(false);
              setAddEventId("");
              setAddEventTitle("");
            }
          }}
          eventId={addEventId}
          eventTitle={addEventTitle}
          onSubmit={() => {
            setShowAddModal(false);
            setAddEventId("");
            setAddEventTitle("");
            fetchData();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev` and visit `http://localhost:3000/moderation/featured`
Expected: Page shows "Featured Events" heading with tabs (Active/Upcoming/Expired), all showing 0. "Add Featured Event" button opens search overlay.

- [ ] **Step 3: Verify full build**

Run: `npm run build`
Expected: No type errors, no build failures

- [ ] **Step 4: Commit**

```bash
git add src/app/moderation/featured/page.tsx
git commit -m "feat: add featured events management page"
```

---

## Chunk 4: Final Verification

### Task 12: End-to-End Verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Ensure clean build with no errors.

- [ ] **Step 3: Manual smoke test**

1. Visit homepage — branded fallback hero should show with "Uni-Verse" badge and "Discover What's Happening on Campus"
2. Visit `/moderation/featured` — empty state should show
3. Click "Add Featured Event" — search modal should appear
4. Search for an approved event, select it, fill in duration (use 7-day preset), submit
5. Verify the featured event appears in the "Active" tab
6. Go back to homepage — featured event should now display in the hero with "Sponsored" badge
7. If you add a second featured event, the hero should carousel between them with dot indicators

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address lint and smoke test issues"
```
