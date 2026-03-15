# Clubs Overhaul Design

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Club discovery page, club detail page, club cards, social links, bug fixes

## Problem

The `/clubs` page has a single paginated grid with no discovery sections, unlike the homepage which uses Netflix-style horizontal scroll rows. Club detail pages use a plain card layout instead of the premium full-bleed hero used by event detail pages. Several bugs exist: club cards don't show profile pictures in discovery, the follow button always shows "Follow Club" regardless of state, and GDG McGill events don't appear tied to their club.

## Design Decisions

- **Reuse homepage discovery architecture** — same `ScrollRow`, `HeroSlide`, Embla carousel patterns, just fed with club data
- **Minimal discovery cards** — logo, name, follower count, upcoming event count only; click through for details
- **Full-bleed hero on club detail** — mirrors `EventDetailView` hero pattern (Option A from brainstorm)
- **Add social links to DB** — website, Discord, Twitter/X, LinkedIn alongside existing Instagram

## Database Migration

### New columns on `clubs` table

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `website_url` | `text` | yes | `null` |
| `discord_url` | `text` | yes | `null` |
| `twitter_url` | `text` | yes | `null` |
| `linkedin_url` | `text` | yes | `null` |

All social fields are stored as full URLs for consistency (including Twitter/X — store `https://x.com/handle`, not just the handle). The PATCH endpoint validates these are valid URLs.

### New `featured_clubs` table

Mirrors the existing `featured_events` table pattern. Admin-controlled — clubs are featured by admin action (e.g. a club requests/pays to be featured), not by popularity.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | `uuid` | no | `gen_random_uuid()` |
| `club_id` | `uuid` | no | FK → `clubs.id` |
| `sponsor_name` | `text` | yes | `null` |
| `priority` | `integer` | no | `0` |
| `starts_at` | `timestamptz` | no | — |
| `ends_at` | `timestamptz` | no | — |
| `created_by` | `uuid` | no | FK → `auth.users.id` |
| `created_at` | `timestamptz` | no | `now()` |

Update `Club` interface in `src/types/index.ts` with the 4 social link fields.
Add `FeaturedClub` interface (mirrors `FeaturedEvent`).
Update `PATCH /api/clubs/[id]` to allow the new social link fields.
Regenerate Supabase types (`lib/supabase/types.ts`) after migration to keep TypeScript in sync.

## New Components

### ClubDiscoveryCard

`src/components/clubs/ClubDiscoveryCard.tsx`

Minimal card for horizontal scroll rows:
- Circular logo (~56px), fallback: `Building2` icon on muted bg
- Club name (bold, line-clamp-1)
- Follower count (small, muted)
- Calendar icon + upcoming event count (small, muted)
- Wrapped in `<Link to="/clubs/{id}">`
- Same sizing as event cards: `min-w-[260px] sm:min-w-[280px] md:min-w-[320px]`
- Hover: subtle scale + shadow, name shifts to primary color

### ClubsHeroSection

`src/components/clubs/ClubsHeroSection.tsx`

Carousel of admin-featured clubs reusing `HeroSlide` + `DotIndicators` + Embla autoplay pattern from `src/components/events/HeroSection.tsx`.

- Fetches from `/api/clubs/featured` — queries `featured_clubs` table (same pattern as `/api/events/featured` with `featured_events`)
- Only shows clubs where `starts_at <= now < ends_at` and the joined club has `status = "approved"`
- Each slide: club banner/logo as background, club name, description, sponsor badge if `sponsor_name` set, "View Club" + "Explore Clubs" buttons
- Fallback (no featured clubs): static banner with "Find Your Community" text, same as current clubs hero
- Uses `useFeaturedClubs` hook (mirrors `useFeaturedEvents`)

### TrendingClubsSection

`src/components/clubs/TrendingClubsSection.tsx`

- Fetches from `/api/clubs/trending` (top 10-15 by follower count)
- Renders `ScrollRow` of `ClubDiscoveryCard`s
- Section title: "Trending Clubs"
- Loading skeleton: 3 placeholder cards (same pattern as `PopularEventsSection`)

### PopularWithFriendsClubsSection

`src/components/clubs/PopularWithFriendsClubsSection.tsx`

- Fetches from `/api/clubs/friends` (clubs followed by user's friends via `club_followers` + `user_follows`)
- Only renders if logged in and results exist (returns null otherwise)
- Section title: "Popular with Friends" with Users icon
- Same `ScrollRow` + `ClubDiscoveryCard` pattern

### ClubCategoryRowsSection

`src/components/clubs/ClubCategoryRowsSection.tsx`

- Fetches its own data from `/api/clubs/trending` (reuses the same endpoint, which returns all approved clubs with follower/event counts)
- Groups clubs by `category` field; clubs with `null` category are excluded from category rows
- One `ScrollRow` per category that has clubs
- Category name as section title
- No infinite loading — shows fixed set per category
- This is a client component that fetches independently, consistent with the pattern where `/clubs/page.tsx` stays server-rendered and each discovery section manages its own data

## New API Routes

### GET /api/clubs/trending

Returns approved clubs sorted by follower count (descending). Accepts `?limit=N` query param (default 15).
Each club includes: all club fields + `follower_count` + `upcoming_event_count`.

Query:
1. Fetch approved clubs
2. Aggregate follower counts from `club_followers`
3. Count upcoming events per club (`events` where `club_id` matches, `status = approved`, `event_date >= today`)
4. Sort by follower count desc, apply limit

### GET /api/clubs/friends

Requires auth. Returns 401 if not authenticated (client skips fetch for unauthenticated users). Returns clubs that the current user's friends follow, limited to 15.

Query:
1. Get user's friend IDs from `user_follows` where `follower_id = current_user`
2. Get clubs followed by those friends from `club_followers`
3. Fetch approved club details for those club IDs
4. Include follower counts and upcoming event counts
5. Sort by number of friends following (desc), limit 15

### GET /api/clubs/featured

Returns currently active featured clubs from the `featured_clubs` table. Mirrors `/api/events/featured` exactly.

Query:
1. Fetch from `featured_clubs` with joined `clubs` data (`select("*, club:clubs(*)")`)
2. Filter: `starts_at <= now` and `ends_at > now`
3. Order by `priority` desc, then `starts_at` asc
4. Filter out entries where joined club is missing or not approved
5. Return `{ featured: [...] }`

## Modified Pages

### /clubs/page.tsx

Keep as server component for SEO (`export const metadata` stays). The page renders client-side discovery section components that each fetch their own data independently. The page itself stays server-rendered — only the discovery sections are client components.

Structure:
1. `ClubsHeroSection` (carousel or fallback banner)
2. `ClubSearch` + `ClubsPageTabs` (keep existing)
3. **When not filtering:** Discovery sections — `TrendingClubsSection`, `PopularWithFriendsClubsSection`, `ClubCategoryRowsSection`
4. **When filtering (search or category selected):** Show filtered grid with pagination (current behavior preserved)
5. "Don't see your club?" CTA (keep existing)

### /clubs/[id]/page.tsx

Redesign with full-bleed hero (stays server-rendered for SEO).

Structure:
1. **Full-bleed hero** (`h-[55vh] min-h-[450px]`)
   - Background: `logo_url` scaled as cover, or category-colored gradient fallback
   - Gradient overlays matching `EventDetailView`
   - Top bar: Back to Clubs + Share (glassmorphic buttons)
   - Bottom-left overlay: logo (80px, rounded-xl), name, category badge, short description
2. **Main content** (`-mt-24 relative z-10`)
   - Info section: full bio, stats (followers, members count, total events hosted), `FollowButton`, social links (Instagram, Twitter, Discord, LinkedIn, Website — icon buttons, only if populated)
   - Upcoming Events: `EventCard` grid (`grid-cols-1 sm:2 lg:3`), empty state if none
   - Past Events: same grid, only if past events exist, sorted newest-first, capped at 6 with a "View all past events" link if more exist

### PATCH /api/clubs/[id]

Add `website_url`, `discord_url`, `twitter_url`, `linkedin_url` to allowed update fields.

## Bug Fixes

### Follow button always shows "Follow Club"

**Root cause:** `/clubs/page.tsx` line 281 uses a static `<span>Follow Club</span>` instead of the `FollowButton` component.

**Fix:** In the browse-all grid cards, replace the static span with the `FollowButton` component, passing `initialFollowing` and `initialCount`. The entire card is currently wrapped in a `<Link>` (line 235), so the `FollowButton` needs `e.stopPropagation()` to prevent navigation when clicking follow. Alternatively, restructure the card so the `<Link>` wraps only the logo/name area, not the follow button. This requires checking follow status for the current user on the grid cards. Since the discovery row cards are intentionally minimal (no follow button), this only applies to the grid view.

### GDG McGill events not showing

**Investigation required:** Query the database during implementation to check:
1. Whether events have `club_id` set to GDG McGill's club ID
2. Whether those events have `status: "approved"`
3. The query logic in `clubs/[id]/page.tsx` is correct — the issue is almost certainly a data linkage problem, not a code bug

This is a data investigation task — the fix will be either updating `club_id` on existing events or documenting that events were never linked.

### Club logo not showing on cards

The existing grid cards at `/clubs/page.tsx` lines 241-251 already render `logo_url` correctly when present. The new `ClubDiscoveryCard` will also render it. If clubs have `null` `logo_url` in the database, the fallback icon displays — this is working as designed, not a code bug.

## Files Changed Summary

| File | Action |
|------|--------|
| `src/types/index.ts` | Modify — add 4 social link fields to Club, add FeaturedClub interface |
| `src/components/clubs/ClubDiscoveryCard.tsx` | Create |
| `src/components/clubs/ClubsHeroSection.tsx` | Create |
| `src/components/clubs/TrendingClubsSection.tsx` | Create |
| `src/components/clubs/PopularWithFriendsClubsSection.tsx` | Create |
| `src/components/clubs/ClubCategoryRowsSection.tsx` | Create |
| `src/app/api/clubs/trending/route.ts` | Create |
| `src/app/api/clubs/friends/route.ts` | Create |
| `src/app/api/clubs/featured/route.ts` | Create |
| `src/hooks/useFeaturedClubs.ts` | Create |
| `src/app/clubs/page.tsx` | Modify — discovery sections + filtered grid fallback |
| `src/app/clubs/[id]/page.tsx` | Modify — full hero redesign |
| `src/app/api/clubs/[id]/route.ts` | Modify — allow new social link fields in PATCH |
| `src/lib/supabase/types.ts` | Regenerate — reflect new columns |
| Supabase migration | Create — add 4 columns to clubs table + create featured_clubs table |
