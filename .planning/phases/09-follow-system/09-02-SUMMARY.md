---
phase: 09-follow-system
plan: "02"
subsystem: follow-system-ui
tags: [follow, clubs, ui, profile, dashboard, typescript]
dependency_graph:
  requires:
    - 09-01 (club_followers table, follow API routes, follower_count in club API)
  provides:
    - FollowButton component (Follow/Following toggle with optimistic UI)
    - Club profile page with public follower count display
    - Follower count stat card in organizer dashboard Overview tab
    - Profile page Following section listing followed clubs
  affects:
    - src/app/clubs/[id]/page.tsx (follow state, follower count, FollowButton integration)
    - src/components/clubs/ClubDashboard.tsx (followerCount prop threading)
    - src/components/clubs/ClubOverviewTab.tsx (Followers stat card)
    - src/app/my-clubs/[id]/page.tsx (followerCount query in Promise.all)
    - src/app/profile/page.tsx (Following clubs card)
tech_stack:
  added: []
  patterns:
    - Optimistic UI update with revert on error for follow toggle
    - Hover state transition (Following → Unfollow) for intuitive UX
    - followerCount prop threading from server page through dashboard shell to tab component
    - Server-side Supabase relational join (club_followers + clubs) in server component
    - as unknown as cast pattern for Supabase join shape in TypeScript strict mode
key_files:
  created:
    - src/components/clubs/FollowButton.tsx
  modified:
    - src/app/clubs/[id]/page.tsx
    - src/app/my-clubs/[id]/page.tsx
    - src/components/clubs/ClubDashboard.tsx
    - src/components/clubs/ClubOverviewTab.tsx
    - src/app/profile/page.tsx
decisions:
  - FollowButton performs optimistic state update then reverts silently on API error (no toast — consistent with existing pattern)
  - Hover state on Following button shows Unfollow text and UserMinus icon (Instagram-style toggle affordance)
  - Unauthenticated users see Follow button; clicking redirects to /auth/signin via router.push
  - Members do not see Follow button (isMember gate from GET /api/clubs/[id]/follow response)
  - Profile page Following section queries club_followers directly with Supabase server client (not via API route) — server component can query DB directly
metrics:
  duration: "~3 min"
  completed_date: "2026-02-27"
  tasks_completed: 2
  files_changed: 6
---

# Phase 9 Plan 02: Follow System UI Summary

**One-liner:** FollowButton component with optimistic toggle and hover state, follower count on club profile page, Followers stat card in organizer dashboard, and Following section on profile page — all connected to Plan 01's backend API.

## What Was Built

Complete student-facing and organizer-facing UI layer for the follow system:

1. **FollowButton component** (`src/components/clubs/FollowButton.tsx`) — "use client" component with:
   - Optimistic UI: state updates immediately, reverts silently on API error
   - Hover state: Following button changes to Unfollow on hover (Instagram-style affordance)
   - Loading state: disabled button with Loader2 spinner during API call
   - Unauthenticated guard: redirects to `/auth/signin` via `useRouter` when no user
   - Double-click guard via `loading` state check

2. **Club profile page** (`src/app/clubs/[id]/page.tsx`) — Updated to:
   - Display public follower count (always visible, updates optimistically on follow/unfollow)
   - Fetch follow status for authenticated users via GET `/api/clubs/[id]/follow`
   - Show FollowButton for non-members (both authenticated and unauthenticated)
   - Hide FollowButton for members (`isMember` flag from API)
   - Show Request Organizer Access button only for authenticated non-members

3. **Organizer dashboard follower count** — Threaded across 3 files:
   - `src/app/my-clubs/[id]/page.tsx`: Added 4th query in `Promise.all` counting `club_followers` rows
   - `src/components/clubs/ClubDashboard.tsx`: Added `followerCount: number` prop, destructured and passed to `ClubOverviewTab`
   - `src/components/clubs/ClubOverviewTab.tsx`: Added Followers stat card with `Heart` icon, visible to all dashboard users (owners and organizers)

4. **Profile page Following section** (`src/app/profile/page.tsx`) — Added:
   - Server-side fetch of `club_followers` with Supabase relational join to `clubs` table
   - Following card below InterestsCard listing all followed clubs with logo, name, category
   - Fallback avatar (Building2 icon) for clubs without `logo_url`
   - Each club entry links to `/clubs/[id]`
   - Empty state shows prompt with link to discover clubs at `/clubs`

## Commits

| Hash | Description |
|------|-------------|
| b1a20f8 | feat(09-02): create FollowButton component and integrate into club profile page |
| 897ace1 | feat(09-02): add follower count to organizer dashboard and Following section to profile |

## Verification

- `npx tsc --noEmit` — zero errors (both tasks verified)
- `npm run build` — Compiled successfully, 60/60 static pages generated

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/components/clubs/FollowButton.tsx` — FOUND (87 lines, >30 min)
- [x] `src/app/clubs/[id]/page.tsx` contains `FollowButton` — FOUND
- [x] `src/components/clubs/ClubOverviewTab.tsx` contains `followerCount` — FOUND
- [x] `src/components/clubs/ClubDashboard.tsx` contains `followerCount` — FOUND
- [x] `src/app/my-clubs/[id]/page.tsx` contains `club_followers` — FOUND
- [x] `src/app/profile/page.tsx` contains `following` — FOUND
- [x] Commits b1a20f8, 897ace1 — FOUND

## Self-Check: PASSED
