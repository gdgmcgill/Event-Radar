# Phase 9: Follow System - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning
**Source:** PRD Express Path (docs/plans/2026-02-26-club-organizer-experience-prd.md)

<domain>
## Phase Boundary

This phase delivers the **follow system** — the data layer and UI that lets students follow clubs and see follower counts. It is the foundation for the blended feed (future phase) and analytics dashboard (future phase).

**Delivers:**
- `club_followers` database table with RLS policies
- Follow/unfollow API endpoints
- Follow button on club profile page
- Follower count on club profile (public)
- Following list for users
- Follower data visible in organizer dashboard

**Does NOT deliver:**
- Blended home feed (separate phase)
- Analytics tracking/dashboard (separate phase)
- Recommendation engine changes (separate phase)
- Trending section (separate phase)

</domain>

<decisions>
## Implementation Decisions

### Database Schema
- `club_followers` table: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- UNIQUE constraint on `(user_id, club_id)`
- Indexes on `club_id` and `user_id`
- RLS policies: authenticated users can INSERT/DELETE their own rows, anyone can SELECT count, club organizers can read follower data for their clubs

### API Endpoints
- `POST /api/clubs/[id]/follow` — follow a club (authenticated, idempotent)
- `DELETE /api/clubs/[id]/follow` — unfollow a club (authenticated)
- `GET /api/clubs/[id]/follow` — check if current user follows this club
- `GET /api/user/following` — list clubs current user follows

### UI — Club Profile Page
- Follow/Unfollow toggle button on `/clubs/[id]` page
- Visible to authenticated users who are NOT members of the club (members don't need to follow)
- Follower count displayed publicly on the club profile page

### UI — User Following List
- Accessible from user profile or navigation
- Shows all clubs the user follows with club name, logo, and unfollow action

### UI — Organizer Dashboard
- Follower count displayed in Overview tab of `/my-clubs/[id]`
- Integrates into existing `ClubOverviewTab` component

### Claude's Discretion
- Exact button styling and placement on club profile page (follow existing shadcn/ui patterns)
- Whether to show follow button to unauthenticated users (with redirect to login)
- How to handle the following list page — could be a new page or a section in profile
- RLS policy specifics for organizer read access (reuse `is_club_owner()` pattern or club_members membership check)
- Whether follower count uses a real-time query or a cached/materialized count
- API response shapes and error handling patterns

</decisions>

<specifics>
## Specific Ideas

- Follow model is lightweight, one-tap, no approval needed (like Instagram public follow)
- Follow button on event cards in the feed is a future phase feature (when blended feed ships)
- Follower list is organizer-only (count is public, list is private to club organizers)
- The `club_followers` table is the foundation for `follow_affinity` signal in the enhanced recommendation algorithm (Phase 2 of PRD)
- Existing `is_club_owner()` SECURITY DEFINER function can be extended or a similar `is_club_member()` function can be created for RLS policies

</specifics>

<deferred>
## Deferred Ideas

- **Blended home feed** — Following + For You interleaved feed (PRD Section 5.2)
- **Analytics tracking** — `event_analytics` table and tracking endpoints (PRD Section 5.3)
- **Organizer analytics dashboard** — full analytics visualizations beyond follower count (PRD Section 5.3)
- **Club profile editing** — Settings tab with edit form (PRD Section 5.4, also covered by Phase 8 SURF requirements)
- **Recommendation engine enhancement** — engagement_score + follow_affinity signals (PRD Section 6)
- **Trending section** — engagement velocity ranking (PRD Section 5.5)
- **Follow button on event cards** — in-feed follow action (PRD Section 5.1 future touchpoint)

</deferred>

---

*Phase: 09-follow-system*
*Context gathered: 2026-02-27 via PRD Express Path*
