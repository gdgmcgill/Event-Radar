---
phase: 09-follow-system
plan: "01"
subsystem: follow-system-backend
tags: [follow, clubs, api, migration, rls, typescript]
dependency_graph:
  requires: []
  provides:
    - club_followers table (migration + RLS)
    - ClubFollower TypeScript types
    - GET/POST/DELETE /api/clubs/[id]/follow
    - GET /api/user/following
    - follower_count in GET /api/clubs/[id]
  affects:
    - src/app/api/clubs/[id]/route.ts (updated response shape)
    - src/lib/supabase/types.ts (new table type)
    - src/types/index.ts (new interface)
tech_stack:
  added: []
  patterns:
    - Promise.all parallel query pattern for club API
    - upsert with onConflict + ignoreDuplicates for idempotent follow
    - count: exact, head: true for efficient follower count
    - maybeSingle() for optional row checks
key_files:
  created:
    - supabase/migrations/20260227000001_club_followers.sql
    - src/app/api/clubs/[id]/follow/route.ts
    - src/app/api/user/following/route.ts
  modified:
    - src/lib/supabase/types.ts
    - src/types/index.ts
    - src/app/api/clubs/[id]/route.ts
decisions:
  - Public SELECT RLS policy on club_followers enables anonymous follower count without app-layer auth checks
  - Upsert with ignoreDuplicates makes follow idempotent without needing a prior check query
  - GET /api/clubs/[id]/follow returns public-safe defaults for unauthenticated users rather than 401
  - Promise.all refactor in club API reduces sequential round-trips from 2 to 1 (3 parallel queries)
metrics:
  duration: "~2 min"
  completed_date: "2026-02-27"
  tasks_completed: 3
  files_changed: 6
---

# Phase 9 Plan 01: Follow System Backend Summary

**One-liner:** club_followers table with RLS, 5 API handlers (GET/POST/DELETE follow, GET following, follower_count in club API) using Supabase server client and idempotent upsert pattern.

## What Was Built

Complete backend data layer for the follow system:

1. **Database migration** — `club_followers` table with composite UNIQUE constraint `(user_id, club_id)`, 2 performance indexes, and 3 RLS policies (public SELECT for count queries, authenticated INSERT/DELETE scoped to own rows).

2. **TypeScript types** — `club_followers` table type added to `src/lib/supabase/types.ts` with Row/Insert/Update shapes and FK relationship. `ClubFollower` interface added to `src/types/index.ts` with optional `club?` for join population.

3. **Follow/unfollow routes** (`/api/clubs/[id]/follow`):
   - GET: parallel `maybeSingle()` checks on `club_followers` and `club_members`; unauthenticated callers get `{ is_following: false, is_member: false }` instead of 401
   - POST: `upsert` with `{ onConflict: "user_id,club_id", ignoreDuplicates: true }` — idempotent, no duplicate-check round-trip
   - DELETE: scoped delete by `user_id` and `club_id`

4. **User following list** (`/api/user/following`): authenticated GET with Supabase join selecting `clubs(id, name, logo_url, description, category)`, ordered by `created_at DESC`.

5. **Club API follower count** (`/api/clubs/[id]`): refactored to `Promise.all` — club fetch, events fetch, and `count: exact, head: true` follower count run in parallel. Response now includes `follower_count: number`.

## Commits

| Hash | Description |
|------|-------------|
| 39a0655 | feat(09-01): create club_followers migration and TypeScript types |
| 271f1fb | feat(09-01): add follow/unfollow API routes and user following endpoint |
| 3fd9ec0 | feat(09-01): add follower_count to public club API response |

## Verification

- `npx tsc --noEmit` — source files compile clean (1 pre-existing `.next/types` stale validator error unrelated to this plan)
- `npm run build` — Compiled successfully, 60/60 static pages generated

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `supabase/migrations/20260227000001_club_followers.sql` — FOUND
- [x] `src/lib/supabase/types.ts` contains `club_followers` — FOUND
- [x] `src/types/index.ts` exports `ClubFollower` — FOUND
- [x] `src/app/api/clubs/[id]/follow/route.ts` — FOUND
- [x] `src/app/api/user/following/route.ts` — FOUND
- [x] `src/app/api/clubs/[id]/route.ts` returns `follower_count` — FOUND
- [x] Commits 39a0655, 271f1fb, 3fd9ec0 — FOUND
