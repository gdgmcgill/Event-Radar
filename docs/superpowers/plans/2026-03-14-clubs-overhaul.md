# Clubs Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the clubs experience with Netflix-style discovery, full-bleed hero detail pages, social links, and admin-featured clubs.

**Architecture:** Server-rendered pages with client-side discovery sections that fetch independently. Shared `HeroSlide`/`DotIndicators` components extracted from events for reuse. New `featured_clubs` table mirrors `featured_events` pattern. New API routes for trending, friends, and featured clubs.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase, Tailwind CSS, shadcn/ui, Embla Carousel, Lucide React, SWR

**Spec:** `docs/superpowers/specs/2026-03-14-clubs-overhaul-design.md`

---

## Chunk 1: Foundation (DB, Types, Shared Components)

### Task 1: Database Migration — Social Links & Featured Clubs

**Files:**
- Create: Supabase migration (via MCP tool)

- [ ] **Step 1: Run the migration to add social link columns to clubs**

```sql
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS discord_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;
```

Run via Supabase MCP `apply_migration` tool with name `add_club_social_links_and_featured_clubs`.

- [ ] **Step 2: Create the featured_clubs table in the same migration**

```sql
CREATE TABLE IF NOT EXISTS featured_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sponsor_name text,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the common query: active featured clubs ordered by priority
CREATE INDEX IF NOT EXISTS idx_featured_clubs_active
  ON featured_clubs (starts_at, ends_at, priority DESC);
```

- [ ] **Step 3: Verify migration applied**

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'clubs' AND column_name IN ('website_url', 'discord_url', 'twitter_url', 'linkedin_url');`

Expected: 4 rows returned.

Run: `SELECT table_name FROM information_schema.tables WHERE table_name = 'featured_clubs';`

Expected: 1 row returned.

---

### Task 1b: Regenerate Supabase Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Regenerate types**

Use Supabase MCP `generate_typescript_types` tool to regenerate `src/lib/supabase/types.ts` after the migration. This ensures the auto-generated `Database` type includes the new `clubs` columns and the `featured_clubs` table.

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "chore: regenerate Supabase types after clubs migration"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add social link fields to Club interface**

In `src/types/index.ts`, find the `Club` interface (around line 56) and add the 4 new fields after `instagram_handle`:

```typescript
export interface Club {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  website_url: string | null;
  discord_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add FeaturedClub interface**

Add after the `FeaturedEvent` interface (around line 320):

```typescript
// ── Featured Clubs Types ──────────────────────────────────────────────

export interface FeaturedClub {
  id: string;
  club_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  club: Club;
}
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`

Expected: Build succeeds (the new fields are all optional/nullable, so existing code won't break).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add social link fields to Club and FeaturedClub interface"
```

---

### Task 3: Extract HeroSlide and DotIndicators into Shared Components

**Files:**
- Create: `src/components/ui/HeroSlide.tsx`
- Create: `src/components/ui/DotIndicators.tsx`
- Modify: `src/components/events/HeroSection.tsx`

- [ ] **Step 1: Create `src/components/ui/HeroSlide.tsx`**

Extract the `HeroSlide` function from `src/components/events/HeroSection.tsx` (lines 12-78) into its own file. Add the `"use client"` directive and export it:

```typescript
"use client";

import { type ReactNode } from "react";
import { UserCheck, Info, ChevronDown } from "lucide-react";

interface HeroSlideProps {
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  onPrimary?: () => void;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onSecondary?: () => void;
  secondaryLabel: string;
}

export function HeroSlide({
  title,
  description,
  imageUrl,
  badge,
  onPrimary,
  primaryLabel,
  primaryIcon,
  onSecondary,
  secondaryLabel,
}: HeroSlideProps) {
  return (
    <div className="relative w-full h-[85vh] min-h-[500px] flex-[0_0_100%]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background from-10% via-background/40 via-50% to-transparent" />

      <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-36">
        <span className="inline-block px-5 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-white/30 dark:border-white/15 shadow-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
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
            className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center gap-3 cursor-pointer"
          >
            {primaryIcon || <UserCheck className="h-5 w-5 md:h-6 md:w-6" />}
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="px-6 md:px-8 py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer shadow-lg"
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
```

- [ ] **Step 2: Create `src/components/ui/DotIndicators.tsx`**

Extract `DotIndicators` from `src/components/events/HeroSection.tsx` (lines 80-107):

```typescript
"use client";

interface DotIndicatorsProps {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}

export function DotIndicators({ count, selected, onSelect }: DotIndicatorsProps) {
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
```

- [ ] **Step 3: Update `src/components/events/HeroSection.tsx` to import shared components**

Remove the local `HeroSlide` and `DotIndicators` function definitions (lines 12-107). Add imports at the top:

```typescript
import { HeroSlide } from "@/components/ui/HeroSlide";
import { DotIndicators } from "@/components/ui/DotIndicators";
```

Remove the `UserCheck`, `Info`, `ChevronDown` imports from lucide since they're now in `HeroSlide.tsx`.

- [ ] **Step 4: Verify the homepage still renders correctly**

Run: `npm run build`

Expected: Build succeeds. The events `HeroSection` should function identically — same props, same rendering.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/HeroSlide.tsx src/components/ui/DotIndicators.tsx src/components/events/HeroSection.tsx
git commit -m "refactor: extract HeroSlide and DotIndicators to shared ui components"
```

---

### Task 4: Update PATCH /api/clubs/[id] for Social Links

**Files:**
- Modify: `src/app/api/clubs/[id]/route.ts`

- [ ] **Step 1: Add new fields to allowedFields array**

In `src/app/api/clubs/[id]/route.ts`, find the `allowedFields` array (line 74) and add the 4 new social link fields:

```typescript
const allowedFields = [
  "name",
  "description",
  "category",
  "instagram_handle",
  "logo_url",
  "website_url",
  "discord_url",
  "twitter_url",
  "linkedin_url",
] as const;
```

- [ ] **Step 2: Add URL validation for social link fields**

After building the `updates` object (after line 89), add validation:

```typescript
// Validate URL fields
const urlFields = ["website_url", "discord_url", "twitter_url", "linkedin_url"] as const;
for (const field of urlFields) {
  if (updates[field] && typeof updates[field] === "string") {
    try {
      new URL(updates[field] as string);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL for ${field}` },
        { status: 400 }
      );
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clubs/[id]/route.ts
git commit -m "feat(api): add social link fields to club PATCH endpoint with URL validation"
```

---

## Chunk 2: API Routes

### Task 5: GET /api/clubs/trending

**Files:**
- Create: `src/app/api/clubs/trending/route.ts`

- [ ] **Step 1: Create the trending clubs API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "15", 10) || 15, 100);

    const supabase = await createClient();

    // Fetch all approved clubs
    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved");

    if (clubsError || !clubs) {
      return NextResponse.json({ clubs: [] });
    }

    const clubIds = clubs.map((c) => c.id);
    if (clubIds.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    // Parallel fetch: follower counts + upcoming event counts
    const today = new Date().toISOString().split("T")[0];

    const [followersResult, eventsResult] = await Promise.all([
      supabase
        .from("club_followers")
        .select("club_id")
        .in("club_id", clubIds),
      supabase
        .from("events")
        .select("club_id")
        .in("club_id", clubIds)
        .eq("status", "approved")
        .gte("event_date", today),
    ]);

    // Aggregate follower counts
    const followerCounts: Record<string, number> = {};
    for (const f of followersResult.data ?? []) {
      followerCounts[f.club_id] = (followerCounts[f.club_id] ?? 0) + 1;
    }

    // Aggregate upcoming event counts
    const upcomingCounts: Record<string, number> = {};
    for (const e of eventsResult.data ?? []) {
      if (e.club_id) {
        upcomingCounts[e.club_id] = (upcomingCounts[e.club_id] ?? 0) + 1;
      }
    }

    // Enrich clubs and sort by follower count
    const enriched = clubs
      .map((club) => ({
        ...club,
        follower_count: followerCounts[club.id] ?? 0,
        upcoming_event_count: upcomingCounts[club.id] ?? 0,
      }))
      .sort((a, b) => b.follower_count - a.follower_count)
      .slice(0, limit);

    return NextResponse.json({ clubs: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch trending clubs" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the route works**

Run: `npm run dev` and test `curl http://localhost:3000/api/clubs/trending`

Expected: JSON response with `{ clubs: [...] }` sorted by follower count.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clubs/trending/route.ts
git commit -m "feat(api): add GET /api/clubs/trending endpoint"
```

---

### Task 6: GET /api/clubs/featured

**Files:**
- Create: `src/app/api/clubs/featured/route.ts`

- [ ] **Step 1: Create the featured clubs API route**

Mirror the pattern from `src/app/api/events/featured/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("featured_clubs")
      .select("*, club:clubs(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out entries where the joined club is missing or not approved
    const featured = (data ?? []).filter(
      (row: any) => row.club && row.club.status === "approved"
    );

    return NextResponse.json({ featured });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured clubs" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/featured/route.ts
git commit -m "feat(api): add GET /api/clubs/featured endpoint"
```

---

### Task 7: GET /api/clubs/friends

**Files:**
- Create: `src/app/api/clubs/friends/route.ts`

- [ ] **Step 1: Create the friends clubs API route**

Reference `src/app/api/events/friends-activity/route.ts` for the friends query pattern (uses `get_friends` RPC):

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get friend IDs using the existing get_friends RPC
    const { data: friends, error: friendsError } = await (supabase as any).rpc(
      "get_friends",
      { target_user_id: user.id }
    );

    if (friendsError || !friends || friends.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const friendIds = friends.map((f: any) => f.id);

    // Get clubs followed by friends
    const { data: friendFollows, error: followError } = await supabase
      .from("club_followers")
      .select("club_id, user_id")
      .in("user_id", friendIds);

    if (followError || !friendFollows || friendFollows.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    // Count how many friends follow each club
    const clubFriendCounts: Record<string, number> = {};
    for (const f of friendFollows) {
      clubFriendCounts[f.club_id] = (clubFriendCounts[f.club_id] ?? 0) + 1;
    }

    const clubIds = Object.keys(clubFriendCounts);

    // Fetch approved club details
    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .in("id", clubIds)
      .eq("status", "approved");

    if (clubsError || !clubs || clubs.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    // Parallel fetch: follower counts + upcoming event counts
    const today = new Date().toISOString().split("T")[0];
    const approvedClubIds = clubs.map((c) => c.id);

    const [followersResult, eventsResult] = await Promise.all([
      supabase
        .from("club_followers")
        .select("club_id")
        .in("club_id", approvedClubIds),
      supabase
        .from("events")
        .select("club_id")
        .in("club_id", approvedClubIds)
        .eq("status", "approved")
        .gte("event_date", today),
    ]);

    const followerCounts: Record<string, number> = {};
    for (const f of followersResult.data ?? []) {
      followerCounts[f.club_id] = (followerCounts[f.club_id] ?? 0) + 1;
    }

    const upcomingCounts: Record<string, number> = {};
    for (const e of eventsResult.data ?? []) {
      if (e.club_id) {
        upcomingCounts[e.club_id] = (upcomingCounts[e.club_id] ?? 0) + 1;
      }
    }

    // Enrich and sort by friend count
    const enriched = clubs
      .map((club) => ({
        ...club,
        follower_count: followerCounts[club.id] ?? 0,
        upcoming_event_count: upcomingCounts[club.id] ?? 0,
        friends_following: clubFriendCounts[club.id] ?? 0,
      }))
      .sort((a, b) => b.friends_following - a.friends_following)
      .slice(0, 15);

    return NextResponse.json({ clubs: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch friends' clubs" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/friends/route.ts
git commit -m "feat(api): add GET /api/clubs/friends endpoint"
```

---

### Task 8: Create useFeaturedClubs Hook

**Files:**
- Create: `src/hooks/useFeaturedClubs.ts`

- [ ] **Step 1: Create the hook**

Mirror `src/hooks/useFeaturedEvents.ts` exactly:

```typescript
"use client";

import { useState, useEffect } from "react";
import type { FeaturedClub } from "@/types";

export function useFeaturedClubs() {
  const [featured, setFeatured] = useState<FeaturedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/clubs/featured");
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
git add src/hooks/useFeaturedClubs.ts
git commit -m "feat: add useFeaturedClubs hook"
```

---

## Chunk 3: Discovery Components

### Task 9: ClubDiscoveryCard Component

**Files:**
- Create: `src/components/clubs/ClubDiscoveryCard.tsx`

- [ ] **Step 1: Create the minimal club card**

```typescript
"use client";

import Link from "next/link";
import Image from "next/image";
import { Building2, Calendar, Users } from "lucide-react";

interface ClubDiscoveryCardProps {
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    follower_count: number;
    upcoming_event_count: number;
  };
}

export function ClubDiscoveryCard({ club }: ClubDiscoveryCardProps) {
  return (
    <Link href={`/clubs/${club.id}`} className="block cursor-pointer">
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden group bg-card border border-border">
        {/* Background: club logo blurred or gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/30 to-primary/10" />

        {/* Content centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-2">
          {/* Club Logo */}
          <div className="w-14 h-14 rounded-full border-2 border-border/50 shadow-sm overflow-hidden bg-secondary flex items-center justify-center shrink-0">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>

          {/* Club Name */}
          <h4 className="text-foreground font-bold text-sm leading-tight text-center line-clamp-1 group-hover:text-primary transition-colors">
            {club.name}
          </h4>

          {/* Stats */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {club.follower_count}
            </span>
            {club.upcoming_event_count > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {club.upcoming_event_count}
              </span>
            )}
          </div>
        </div>

        {/* Hover effect */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubDiscoveryCard.tsx
git commit -m "feat: add ClubDiscoveryCard component for discovery rows"
```

---

### Task 10: ClubsHeroSection Component

**Files:**
- Create: `src/components/clubs/ClubsHeroSection.tsx`

- [ ] **Step 1: Create the hero carousel**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Building2 } from "lucide-react";
import { useFeaturedClubs } from "@/hooks/useFeaturedClubs";
import { HeroSlide } from "@/components/ui/HeroSlide";
import { DotIndicators } from "@/components/ui/DotIndicators";
import { HERO_FALLBACK_IMAGE } from "@/lib/constants";
import type { FeaturedClub } from "@/types";

export function ClubsHeroSection() {
  const router = useRouter();
  const { featured, isLoading } = useFeaturedClubs();
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

  // Branded fallback when no featured clubs
  if (isLoading || featured.length === 0) {
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title="Find Your Community"
          description="Discover student clubs and organizations at McGill. Join a community that matches your passions."
          imageUrl="/club_hero.jpeg"
          badge="Clubs Directory"
          primaryLabel="Explore Clubs"
          primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          onPrimary={() => {
            document
              .getElementById("clubs-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          secondaryLabel="Learn More"
          onSecondary={() => router.push("/about")}
        />
      </section>
    );
  }

  // Single featured club — no carousel
  if (featured.length === 1) {
    const f = featured[0];
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title={f.club.name}
          description={f.club.description ?? `Discover ${f.club.name} on UNI-VERSE`}
          imageUrl={f.club.logo_url || "/club_hero.jpeg"}
          badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Featured Club"}
          primaryLabel="View Club"
          primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          onPrimary={() => router.push(`/clubs/${f.club.id}`)}
          secondaryLabel="Explore Clubs"
          onSecondary={() => {
            document
              .getElementById("clubs-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>
    );
  }

  // Multiple featured clubs — carousel
  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {featured.map((f: FeaturedClub) => (
            <HeroSlide
              key={f.id}
              title={f.club.name}
              description={f.club.description ?? `Discover ${f.club.name} on UNI-VERSE`}
              imageUrl={f.club.logo_url || "/club_hero.jpeg"}
              badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Featured Club"}
              primaryLabel="View Club"
              primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
              onPrimary={() => router.push(`/clubs/${f.club.id}`)}
              secondaryLabel="Explore Clubs"
              onSecondary={() => {
                document
                  .getElementById("clubs-feed")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubsHeroSection.tsx
git commit -m "feat: add ClubsHeroSection carousel component"
```

---

### Task 11: TrendingClubsSection Component

**Files:**
- Create: `src/components/clubs/TrendingClubsSection.tsx`

- [ ] **Step 1: Create the trending clubs section**

Mirror `src/components/events/PopularEventsSection.tsx` pattern:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Flame, AlertCircle, RefreshCcw } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { Button } from "@/components/ui/button";

type TrendingClub = {
  id: string;
  name: string;
  logo_url: string | null;
  follower_count: number;
  upcoming_event_count: number;
};

export function TrendingClubsSection() {
  const [clubs, setClubs] = useState<TrendingClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clubs/trending");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setClubs(data.clubs ?? []);
    } catch {
      setError("Failed to load trending clubs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  if (loading && clubs.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Trending Clubs
          </h3>
        </div>
        <div className="flex px-6 md:px-10 lg:px-12 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] aspect-[16/10] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 md:px-10 lg:px-12">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchTrending} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <RefreshCcw className="h-3 w-3" />
            Try Again
          </Button>
        </div>
      </section>
    );
  }

  if (clubs.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Trending Clubs
        </h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
        {clubs.map((club) => (
          <div key={club.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
            <ClubDiscoveryCard club={club} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/TrendingClubsSection.tsx
git commit -m "feat: add TrendingClubsSection component"
```

---

### Task 12: PopularWithFriendsClubsSection Component

**Files:**
- Create: `src/components/clubs/PopularWithFriendsClubsSection.tsx`

- [ ] **Step 1: Create the friends clubs section**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { useAuthStore } from "@/store/useAuthStore";

type FriendClub = {
  id: string;
  name: string;
  logo_url: string | null;
  follower_count: number;
  upcoming_event_count: number;
  friends_following: number;
};

export function PopularWithFriendsClubsSection() {
  const user = useAuthStore((s) => s.user);
  const [clubs, setClubs] = useState<FriendClub[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchFriendsClubs = async () => {
      try {
        const res = await fetch("/api/clubs/friends");
        if (!res.ok) return;
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch {
        // Non-critical — silently fail
      }
    };
    fetchFriendsClubs();
  }, [user]);

  if (!user || clubs.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Popular with Friends
        </h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
        {clubs.map((club) => (
          <div key={club.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
            <ClubDiscoveryCard club={club} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/PopularWithFriendsClubsSection.tsx
git commit -m "feat: add PopularWithFriendsClubsSection component"
```

---

### Task 13: ClubCategoryRowsSection Component

**Files:**
- Create: `src/components/clubs/ClubCategoryRowsSection.tsx`

- [ ] **Step 1: Create the category rows section**

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";

type ClubWithCounts = {
  id: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  follower_count: number;
  upcoming_event_count: number;
};

export function ClubCategoryRowsSection() {
  const [clubs, setClubs] = useState<ClubWithCounts[]>([]);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const res = await fetch("/api/clubs/trending?limit=100");
        if (!res.ok) return;
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchClubs();
  }, []);

  const clubsByCategory = useMemo(() => {
    const map = new Map<string, ClubWithCounts[]>();
    for (const club of clubs) {
      if (!club.category) continue;
      const list = map.get(club.category) ?? [];
      list.push(club);
      map.set(club.category, list);
    }
    // Sort categories alphabetically
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [clubs]);

  if (clubsByCategory.size === 0) return null;

  return (
    <>
      {Array.from(clubsByCategory.entries()).map(([category, categoryClubs]) => (
        <section key={category}>
          <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              {category}
              <span className="text-sm font-medium text-muted-foreground ml-3">
                {categoryClubs.length} club{categoryClubs.length !== 1 ? "s" : ""}
              </span>
            </h3>
          </div>
          <ScrollRow className="px-6 md:px-10 lg:px-12">
            {categoryClubs.map((club) => (
              <div key={club.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
                <ClubDiscoveryCard club={club} />
              </div>
            ))}
          </ScrollRow>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubCategoryRowsSection.tsx
git commit -m "feat: add ClubCategoryRowsSection component"
```

---

## Chunk 4: Page Overhauls

### Task 14: Overhaul /clubs Discovery Page

**Files:**
- Modify: `src/app/clubs/page.tsx`

- [ ] **Step 1: Add discovery section imports**

At the top of `src/app/clubs/page.tsx`, add imports for the new discovery components:

```typescript
import { ClubsHeroSection } from "@/components/clubs/ClubsHeroSection";
import { TrendingClubsSection } from "@/components/clubs/TrendingClubsSection";
import { PopularWithFriendsClubsSection } from "@/components/clubs/PopularWithFriendsClubsSection";
import { ClubCategoryRowsSection } from "@/components/clubs/ClubCategoryRowsSection";
```

- [ ] **Step 2: Replace the static hero with ClubsHeroSection**

Remove the entire hero `<section>` block (lines 152-186, the one with `club_hero.jpeg` background). Replace it with:

```tsx
{!q && !category && currentPage === 1 && (
  <ClubsHeroSection />
)}
```

- [ ] **Step 3: Add discovery sections for the unfiltered view**

After the `ClubSearch` component and before the existing grid, add the discovery sections. These should only render when NOT filtering (no `q`, no `category`, page 1):

Inside the `<ClubsPageTabs>` component, before the `<main>` tag, add:

Note: The existing `ClubSearch` wrapper already uses `id="clubs-feed"`. Keep that as the scroll target. Place the discovery sections in a new div without an `id`:

```tsx
{/* Discovery sections — only on unfiltered default view */}
{!q && !category && currentPage === 1 && (
  <div className="space-y-10 py-6">
    <TrendingClubsSection />
    <PopularWithFriendsClubsSection />
    <ClubCategoryRowsSection />
  </div>
)}
```

- [ ] **Step 4: Wrap the existing grid in a conditional**

The existing `<main>` block with the grid, pagination, and CTA should only show when filtering OR when not on page 1. Wrap it:

```tsx
{(q || category || currentPage > 1) && (
  <main className="px-6 lg:px-10 py-6 lg:py-8">
    {/* ... existing grid, pagination, CTA ... */}
  </main>
)}

{/* Always show CTA at bottom */}
{!q && !category && currentPage === 1 && (
  <div className="px-6 lg:px-10 py-6">
    <div className="mt-8 mb-4 rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
      <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
        Don&apos;t see your club?
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        If your club isn&apos;t listed yet, register it in under a minute and start reaching students across campus.
      </p>
      <Link
        href="/clubs/create"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
      >
        Register Your Club
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify the page renders**

Run: `npm run dev` and visit `http://localhost:3000/clubs`

Expected: Hero carousel (or fallback), trending clubs row, category rows. When searching, the grid view appears instead.

- [ ] **Step 6: Commit**

```bash
git add src/app/clubs/page.tsx
git commit -m "feat(clubs): add Netflix-style discovery sections to clubs page"
```

---

### Task 15: Redesign /clubs/[id] Detail Page with Full-Bleed Hero

**Files:**
- Modify: `src/app/clubs/[id]/page.tsx`

- [ ] **Step 1: Update imports**

Replace the current imports with what we need for the hero layout:

```typescript
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Instagram,
  Globe,
  Users,
  CalendarX,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowButton } from "@/components/clubs/FollowButton";
import { EventCard } from "@/components/events/EventCard";
import type { Event } from "@/types";
import type { Metadata } from "next";
```

- [ ] **Step 2: Update data fetching to include member count and total events**

In the `ClubDetailPage` function, update the parallel fetch to also get member count and total event count:

```typescript
const [clubResult, followerResult, memberResult, eventsResult, userResult] = await Promise.all([
  supabase.from("clubs").select("*").eq("id", id).single(),
  supabase
    .from("club_followers")
    .select("*", { count: "exact", head: true })
    .eq("club_id", id),
  supabase
    .from("club_members")
    .select("*", { count: "exact", head: true })
    .eq("club_id", id),
  supabase
    .from("events")
    .select("*")
    .eq("club_id", id)
    .eq("status", "approved")
    .order("event_date", { ascending: true }),
  supabase.auth.getUser(),
]);

const memberCount = memberResult.count ?? 0;
```

- [ ] **Step 3: Replace the return JSX with the full-bleed hero layout**

Replace the entire `return (...)` block with the new design:

```tsx
return (
  <div className="w-full min-h-screen bg-gradient-to-b from-white via-white to-primary/10 dark:from-black dark:via-background dark:to-primary/10">
    {/* ─── Full-Bleed Hero ─── */}
    <div className="relative w-full h-[55vh] min-h-[450px]">
      <div className="absolute inset-0">
        {club.logo_url ? (
          <Image
            src={club.logo_url}
            alt={club.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/60 to-primary/80 dark:from-primary/20 dark:via-secondary/30 dark:to-primary/10" />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white dark:from-black/40 dark:via-transparent dark:to-black" />

      {/* Top bar */}
      <div className="absolute top-0 w-full px-6 py-8 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/clubs"
            className="group flex items-center gap-2 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-semibold tracking-wide">Back to Clubs</span>
          </Link>
          <button
            aria-label="Share"
            className="flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Club info overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 z-10">
        <div className="max-w-7xl mx-auto flex items-end gap-5">
          <div className="w-20 h-20 rounded-xl bg-white border-[3px] border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <Users className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
          <div>
            {club.category && (
              <Badge variant="secondary" className="mb-2 bg-white/20 text-white border-white/30 backdrop-blur-md">
                {club.category}
              </Badge>
            )}
            <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg">
              {club.name}
            </h1>
          </div>
        </div>
      </div>
    </div>

    {/* ─── Main Content (overlaps hero) ─── */}
    <main className="w-full max-w-7xl mx-auto px-6 pb-24 -mt-24 relative z-10">
      {/* Info Card */}
      <div className="bg-card rounded-2xl border border-border shadow-lg p-6 sm:p-8 mb-10">
        {/* Description */}
        {club.description && (
          <p className="text-muted-foreground leading-relaxed mb-6">
            {club.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex flex-wrap items-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{followerCount}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{memberCount}</div>
            <div className="text-xs text-muted-foreground">Members</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{allEvents.length}</div>
            <div className="text-xs text-muted-foreground">Events</div>
          </div>
          <div className="ml-auto">
            <FollowButton
              clubId={id}
              initialFollowing={isFollowing}
              initialCount={followerCount}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="flex flex-wrap items-center gap-3">
          {club.instagram_handle && (
            <Link
              href={`https://instagram.com/${club.instagram_handle.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </Link>
          )}
          {club.twitter_url && (
            <Link
              href={club.twitter_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              X / Twitter
            </Link>
          )}
          {club.discord_url && (
            <Link
              href={club.discord_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Discord
            </Link>
          )}
          {club.linkedin_url && (
            <Link
              href={club.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              LinkedIn
            </Link>
          )}
          {club.website_url && (
            <Link
              href={club.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Globe className="h-4 w-4" />
              Website
            </Link>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">Upcoming Events</h2>
        {upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarX}
            title="No upcoming events"
            description={`${club.name} hasn't posted any upcoming events yet. Follow them to get notified when they do!`}
          />
        )}
      </section>

      {/* Past Events — capped at 6 */}
      {pastEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Past Events</h2>
            {pastEvents.length > 6 && (
              <span className="text-sm text-muted-foreground">
                Showing 6 of {pastEvents.length}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastEvents.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {/* TODO: "View all past events" could expand the list client-side or link to a filtered view in a future iteration */}
        </section>
      )}
    </main>
  </div>
);
```

- [ ] **Step 4: Verify the page renders**

Run: `npm run dev` and visit a club detail page.

Expected: Full-bleed hero with club logo, gradient overlay, back button, info card with stats and social links, event grids.

- [ ] **Step 5: Commit**

```bash
git add src/app/clubs/[id]/page.tsx
git commit -m "feat(clubs): redesign club detail page with full-bleed hero"
```

---

## Chunk 5: Bug Fixes & Investigation

### Task 16: Fix Follow Button on Club Grid Cards

**Files:**
- Modify: `src/app/clubs/page.tsx`
- Modify: `src/components/clubs/FollowButton.tsx`

- [ ] **Step 1: Add `e.stopPropagation()` to FollowButton**

In `src/components/clubs/FollowButton.tsx`, update `handleToggle` to accept and stop propagation from the event, so it works when nested inside a `<Link>`:

```typescript
const handleToggle = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (!user) {
    window.location.href = `/?signin=required&next=/clubs/${clubId}`;
    return;
  }
  // ... rest of the handler stays the same
```

Update the `Button`'s `onClick` to pass the event:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={handleToggle}
  // ... rest stays the same
```

(The existing `onClick={handleToggle}` already passes the event implicitly since `handleToggle` now accepts it.)

- [ ] **Step 2: Replace static "Follow Club" span in grid cards**

In `src/app/clubs/page.tsx`, the grid cards currently have a static `<span>` at line ~281. Since the page is server-rendered and `FollowButton` is a client component that needs `initialFollowing`, the simplest fix is to replace the static span with `FollowButton` passing `initialFollowing={false}` and `initialCount={followers}`. The button will show the correct count, and when clicked it will check auth and toggle.

Replace:
```tsx
<span className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 hover:border-primary transition-colors py-2 rounded-lg font-semibold text-sm text-center block mt-auto">
  Follow Club
</span>
```

With:
```tsx
<div className="mt-auto" onClick={(e) => e.stopPropagation()}>
  <FollowButton
    clubId={club.id}
    initialFollowing={false}
    initialCount={followers}
  />
</div>
```

Add the import at the top of the file:
```typescript
import { FollowButton } from "@/components/clubs/FollowButton";
```

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/page.tsx src/components/clubs/FollowButton.tsx
git commit -m "fix(clubs): replace static Follow Club span with interactive FollowButton"
```

---

### Task 17: Investigate GDG McGill Events Bug

**Files:**
- No file changes expected — this is a data investigation

- [ ] **Step 1: Query the database to find GDG McGill's club ID**

Run SQL via Supabase MCP:
```sql
SELECT id, name, status FROM clubs WHERE name ILIKE '%gdg%' OR name ILIKE '%google developer%';
```

- [ ] **Step 2: Check if any events reference that club_id**

Using the club ID from step 1:
```sql
SELECT id, title, club_id, status, event_date FROM events WHERE club_id = '<CLUB_ID>';
```

- [ ] **Step 3: Check if there are events that should be linked**

```sql
SELECT id, title, club_id, status, event_date FROM events WHERE title ILIKE '%gdg%' OR title ILIKE '%google developer%';
```

- [ ] **Step 4: Fix the data if needed**

If events exist but have `club_id = NULL`, update them:
```sql
UPDATE events SET club_id = '<CLUB_ID>' WHERE id IN ('<EVENT_IDS>');
```

If events have wrong `status`, approve them:
```sql
UPDATE events SET status = 'approved' WHERE id IN ('<EVENT_IDS>') AND status != 'approved';
```

- [ ] **Step 5: Document findings**

Note what was found and fixed in the commit message.

```bash
git commit --allow-empty -m "fix(data): link GDG McGill events to club (data fix via Supabase)"
```

---

### Task 18: Final Verification

- [ ] **Step 1: Run the build**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual smoke test**

Visit the following pages and verify:
1. `/clubs` — Hero carousel (fallback if no featured), trending row, category rows
2. `/clubs` with search — Grid view with pagination
3. `/clubs/<id>` — Full-bleed hero, stats, social links, follow button, events
4. Follow button — Toggles state correctly, shows "Following" when followed
5. Past events — Capped at 6 with "View all" link

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup for clubs overhaul"
```
