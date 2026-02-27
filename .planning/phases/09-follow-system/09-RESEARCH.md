# Phase 9: Follow System - Research

**Researched:** 2026-02-27
**Domain:** Supabase RLS + Next.js App Router API routes + React client state
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Database Schema:** `club_followers` table: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. UNIQUE constraint on `(user_id, club_id)`. Indexes on `club_id` and `user_id`.
- **RLS policies:** authenticated users can INSERT/DELETE their own rows, anyone can SELECT count, club organizers can read follower data for their clubs.
- **API endpoints (4 total):**
  - `POST /api/clubs/[id]/follow` — follow a club (authenticated, idempotent)
  - `DELETE /api/clubs/[id]/follow` — unfollow a club (authenticated)
  - `GET /api/clubs/[id]/follow` — check if current user follows this club
  - `GET /api/user/following` — list clubs current user follows
- **UI — Club Profile (`/clubs/[id]`):** Follow/Unfollow toggle button. Visible to authenticated non-members. Follower count displayed publicly.
- **UI — User Following List:** Accessible from user profile or navigation. Shows all followed clubs with club name, logo, unfollow action.
- **UI — Organizer Dashboard:** Follower count displayed in Overview tab of `/my-clubs/[id]`. Integrates into existing `ClubOverviewTab`.

### Claude's Discretion

- Exact button styling and placement on club profile page (follow existing shadcn/ui patterns)
- Whether to show follow button to unauthenticated users (with redirect to login)
- How to handle the following list page — could be a new page or a section in profile
- RLS policy specifics for organizer read access (reuse `is_club_owner()` pattern or club_members membership check)
- Whether follower count uses a real-time query or a cached/materialized count
- API response shapes and error handling patterns

### Deferred Ideas (OUT OF SCOPE)

- Blended home feed (Following + For You interleaved feed)
- Analytics tracking (`event_analytics` table and tracking endpoints)
- Organizer analytics dashboard (full analytics visualizations beyond follower count)
- Club profile editing (Settings tab with edit form — Phase 8 / SURF requirements)
- Recommendation engine enhancement (engagement_score + follow_affinity signals)
- Trending section (engagement velocity ranking)
- Follow button on event cards (in-feed follow action)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOLLOW-01 | `club_followers` table with `user_id`, `club_id`, `created_at` — UNIQUE constraint on `(user_id, club_id)`, indexes on `club_id` and `user_id`, RLS policies for authenticated follow/unfollow and organizer read access | Migration pattern from `20260225000001_club_roles_and_invitations.sql` — `is_club_owner()` SECURITY DEFINER + idempotent CREATE TABLE IF NOT EXISTS |
| FOLLOW-02 | `POST /api/clubs/[id]/follow` endpoint — authenticated users can follow an approved club, idempotent (no error on duplicate) | Supabase upsert with `onConflict` option handles idempotency; matches pattern in `invites/route.ts` |
| FOLLOW-03 | `DELETE /api/clubs/[id]/follow` endpoint — authenticated users can unfollow a club | Pattern from `members/route.ts` DELETE handler — auth check, then targeted delete |
| FOLLOW-04 | `GET /api/clubs/[id]/follow` endpoint — returns whether the current user follows this club | Simple `.maybeSingle()` check; pattern mirrors engagement route |
| FOLLOW-05 | `GET /api/user/following` endpoint — returns list of clubs the current user follows | New route at `src/app/api/user/following/route.ts`; joins `club_followers` to `clubs` table |
| FOLLOW-06 | Follow/Unfollow button on club profile page (`/clubs/[id]`) — visible to authenticated users who are not members of the club | Club profile page is a client component with `useAuthStore`; needs membership check API or co-fetch |
| FOLLOW-07 | Follower count displayed on public club profile page | GET `/api/clubs/[id]` can include follower count in response; or club profile fetches it separately |
| FOLLOW-08 | Follower count and follow data visible in organizer analytics dashboard (Overview tab) | `ClubOverviewTab` already has a stats grid; follower count props thread from `my-clubs/[id]/page.tsx` server component — same pattern as `memberCount` |
</phase_requirements>

---

## Summary

Phase 9 adds a lightweight follow system — one new DB table (`club_followers`), four API routes, and UI changes across two pages. The work is entirely additive with no breaking changes to existing tables or components.

The project has a strong, consistent pattern established across Phases 5–7: SECURITY DEFINER helper functions for RLS (`is_admin()`, `is_club_owner()`), idempotent SQL migrations using `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS`, and Next.js App Router API routes with explicit `auth.getUser()` checks. This phase follows those same patterns without deviation.

The largest design decision at discretion is where to surface the "following list" for users. The `/profile` page already exists as a server component and is the natural home for a following section. The alternative is a standalone `/following` page linked from the nav. Given that `baseNavItems` already has many entries, adding a section to `/profile` avoids nav clutter.

**Primary recommendation:** Use the `is_club_owner()` SECURITY DEFINER pattern for organizer-read RLS. Use Supabase `upsert` with `onConflict: 'user_id, club_id'` for idempotent follow. Add follower count as a prop threaded from the server component, same as `memberCount` in the existing dashboard.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase (server client) | existing | DB queries, auth, RLS | All API routes already use `@/lib/supabase/server` |
| Next.js App Router | 16.0.3 | API routes + pages | Project framework |
| shadcn/ui (Button, Badge, Card) | existing | Follow button + follower count UI | All existing UI uses shadcn/ui primitives |
| Lucide React | existing | Icons (Heart, Users, UserCheck, UserMinus) | Project-wide icon library |
| TypeScript (strict) | 5.4.0 | Type safety | Mandatory per CLAUDE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand (`useAuthStore`) | existing | Client-side user + auth state | Club profile page needs `user` to decide whether to show button |
| `useCallback` / `useEffect` | React built-in | Follow state management in client component | Same pattern as club profile's `fetchClub` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct count query per page load | Materialized/cached follower count column on `clubs` table | Cached column adds eventual consistency complexity; direct count is simpler and fast enough at campus scale |
| Separate `/following` page | Section on existing `/profile` page | New page requires nav entry; profile page section is zero nav overhead |
| Client-side membership check (extra API call) | Server-side membership check in club profile GET route | Server-side avoids client waterfall; club profile page is currently client-only so an extra fetch is the practical path |

**Installation:** No new packages required. Everything uses existing project dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── clubs/[id]/follow/
│   │   │   └── route.ts          # GET (check), POST (follow), DELETE (unfollow)
│   │   └── user/
│   │       └── following/
│   │           └── route.ts      # GET — list clubs current user follows
│   └── clubs/[id]/
│       └── page.tsx              # Add FollowButton + follower count (existing file)
├── components/
│   └── clubs/
│       ├── FollowButton.tsx      # New: follow/unfollow toggle button component
│       └── ClubOverviewTab.tsx   # Existing: add followerCount prop + stat card
supabase/
└── migrations/
    └── 20260227000001_club_followers.sql   # New migration
```

### Pattern 1: Idempotent Migration (matches Phase 5 exactly)

**What:** Each migration section uses `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY`, `CREATE INDEX IF NOT EXISTS`. The file is safe to re-run.

**When to use:** Every new DB object in this project.

**Example (from `20260225000001_club_roles_and_invitations.sql`):**
```sql
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ...
);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_club_invitations_club_id
  ON public.club_invitations(club_id);

DROP POLICY IF EXISTS "Club owners can view club invitations" ON public.club_invitations;

CREATE POLICY "Club owners can view club invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));
```

**Applied to Phase 9:**
```sql
CREATE TABLE IF NOT EXISTS public.club_followers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_followers_unique UNIQUE (user_id, club_id)
);

ALTER TABLE public.club_followers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_club_followers_club_id  ON public.club_followers(club_id);
CREATE INDEX IF NOT EXISTS idx_club_followers_user_id  ON public.club_followers(user_id);
```

### Pattern 2: SECURITY DEFINER Helper for RLS (matches `is_club_owner()`)

**What:** A `STABLE SECURITY DEFINER` function wraps the membership check to prevent RLS infinite recursion when the policy references the same table being secured.

**When to use:** Any RLS policy that needs to join another table to make its decision (e.g., checking if a user is a member/owner before granting access to `club_followers` rows).

**Example (from `20260225000001_club_roles_and_invitations.sql`):**
```sql
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;
```

**Applied to Phase 9 — organizer read access:**

Option A (recommended): Reuse `is_club_owner()` directly for organizer read policy.

```sql
-- Organizers (owners) can read follower list for their club
DROP POLICY IF EXISTS "Club owners can view follower list" ON public.club_followers;
CREATE POLICY "Club owners can view follower list"
  ON public.club_followers
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));
```

Option B: Create `is_club_member()` helper. Adds complexity with no gain for this phase — the dashboard only shows follower count to owners, and organizer-read is only needed for the full follower list. Not recommended.

**Recommendation:** Use Option A — `is_club_owner()` is already deployed and covers the organizer read case since the dashboard follower count is shown only in the organizer dashboard which only owners can access anyway.

### Pattern 3: API Route with Auth Guard (matches all existing `/api/clubs/[id]/` routes)

**What:** Every protected API route in this project follows the same 4-step pattern:
1. Resolve params
2. Create Supabase server client
3. Call `supabase.auth.getUser()` — return 401 if unauthenticated
4. Execute business logic — return `NextResponse.json()`

**When to use:** All authenticated API routes.

**Example (condensed from `members/route.ts`):**
```typescript
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
    }

    // ... business logic ...

    return NextResponse.json({ message: "..." }, { status: 201 });
  } catch (error) {
    console.error("Error in POST:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### Pattern 4: Idempotent Follow via Supabase Upsert

**What:** `POST /api/clubs/[id]/follow` should be idempotent — calling it twice has the same effect as calling it once (no error on duplicate).

**How:** Use Supabase `.upsert()` with `onConflict` targeting the UNIQUE constraint, or use `.insert()` and handle the unique-constraint error code `23505`.

**Recommended approach — upsert:**
```typescript
const { error } = await supabase
  .from("club_followers")
  .upsert(
    { user_id: user.id, club_id: clubId },
    { onConflict: "user_id, club_id", ignoreDuplicates: true }
  );
```

`ignoreDuplicates: true` means the upsert does nothing on conflict (no update, no error). This is the cleanest idempotency pattern in Supabase. Confidence: HIGH (verified in Supabase PostgREST docs — `ignoreDuplicates` maps to `ON CONFLICT DO NOTHING`).

### Pattern 5: Server-Side Count Prop Threading (matches `memberCount` in dashboard)

**What:** The `/my-clubs/[id]/page.tsx` server component fetches `memberCount` in a `Promise.all()` and passes it as a prop to `<ClubDashboard>`, which passes it to `<ClubOverviewTab>`. Follower count follows the exact same pattern.

**Current code in `src/app/my-clubs/[id]/page.tsx`:**
```typescript
const [
  { data: club },
  { data: membership },
  { count: memberCount },
] = await Promise.all([
  supabase.from("clubs").select("*").eq("id", id).single(),
  supabase.from("club_members").select("role").eq("club_id", id).eq("user_id", user.id).single(),
  supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", id),
]);
```

**Extended for Phase 9 — add follower count to the same `Promise.all()`:**
```typescript
const [
  { data: club },
  { data: membership },
  { count: memberCount },
  { count: followerCount },
] = await Promise.all([
  supabase.from("clubs").select("*").eq("id", id).single(),
  supabase.from("club_members").select("role").eq("club_id", id).eq("user_id", user.id).single(),
  supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", id),
  supabase.from("club_followers").select("*", { count: "exact", head: true }).eq("club_id", id),
]);
```

Then pass `followerCount ?? 0` as a new prop to `<ClubDashboard>` and down to `<ClubOverviewTab>`.

### Pattern 6: Club Profile Follow Button — Client Component State

**What:** `src/app/clubs/[id]/page.tsx` is already a `"use client"` component that uses `useState`, `useEffect`, `useCallback`, and `useAuthStore`. The follow button fits naturally into this component.

**Current state management in `page.tsx`:**
```typescript
const [club, setClub] = useState<Club | null>(null);
const [loading, setLoading] = useState(true);
const { user } = useAuthStore();
```

**Extended for Phase 9:**
```typescript
const [isFollowing, setIsFollowing] = useState(false);
const [followerCount, setFollowerCount] = useState(0);
const [isMember, setIsMember] = useState(false);
const [followLoading, setFollowLoading] = useState(false);
```

The `fetchClub` callback already runs `useEffect`. A separate `checkFollowStatus` callback runs after user is confirmed — fetches `GET /api/clubs/[id]/follow` and club follower count.

**For membership check:** The existing `GET /api/clubs/${id}` response does not return membership status. Two options:
- Option A: Add an additional `GET /api/clubs/[id]/membership` check (new fetch)
- Option B: Try fetching membership via the existing members endpoint (returns 403 for non-members)
- Option C: Check membership client-side via a dedicated check in `GET /api/clubs/[id]/follow` response — return both `is_following` and `is_member`

**Recommendation:** Option C — extend the `GET /api/clubs/[id]/follow` response to include both `is_following: boolean` and `is_member: boolean`. This is one fetch vs two and keeps the logic server-side where RLS enforces correctness. The `is_member` check queries `club_members` where `user_id = auth.uid()` and `club_id = ?`.

### Anti-Patterns to Avoid

- **Calling `supabase` from the browser client directly for follow/unfollow**: This phase uses API routes consistently. Don't bypass the route layer to write directly via the browser Supabase client — RLS alone is not the only validation layer (e.g., checking club is approved before allowing follow).
- **Using service role for follow/unfollow operations**: These are user-scoped actions. Use the authenticated server client (`createClient()` from `@/lib/supabase/server`), not the service role.
- **Real-time subscriptions for follower count**: Unnecessary complexity at campus scale. A simple count query on page load is sufficient.
- **Storing follower count as a denormalized column on `clubs`**: Creates update synchronization complexity. Direct count from `club_followers` is correct and fast with the `idx_club_followers_club_id` index.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent insert | Custom duplicate check + conditional insert | Supabase `.upsert()` with `ignoreDuplicates: true` | Race condition-safe, single round-trip |
| Auth check in API routes | Custom token parsing | `supabase.auth.getUser()` | Already the project standard; session-cookie-aware with `@supabase/ssr` |
| RLS access control | App-layer membership check before every query | `is_club_owner()` in RLS policy | DB-enforced, consistent across all clients |
| Optimistic UI updates | Manual state reconciliation | Set state immediately then confirm/revert on error | Simple and matches UX expectations for follow toggles |

**Key insight:** The project's established patterns (SECURITY DEFINER functions, idempotent migrations, auth-guarded API routes) handle all the hard parts. Phase 9 is configuration and wiring, not novel engineering.

---

## Common Pitfalls

### Pitfall 1: `auth.users` vs `public.users` in Foreign Key Reference

**What goes wrong:** The CONTEXT.md specifies `user_id UUID NOT NULL REFERENCES auth.users(id)`. This is intentional — it references Supabase's internal `auth.users` table, not `public.users`. However, PostgREST/Supabase JS client `.select()` with join syntax can't join to `auth.users` (it's a different schema).

**Why it happens:** Confusion between the two `users` tables. `auth.users` is the auth system table; `public.users` is the app profile table.

**How to avoid:** The FK reference to `auth.users(id)` is correct for cascade-on-delete behavior. However, when joining follower data to user profile info (e.g., for the organizer's follower list), join through `public.users` via a sub-select or join `club_followers` to `public.users` on `user_id = public.users.id`. The `public.users.id` column is a foreign key to `auth.users(id)`, so the values are identical.

**Warning signs:** PostgREST error `"referenced relation 'users' is not in the search path"` when trying to join `club_followers.user_id` to `auth.users`.

### Pitfall 2: Missing RLS SELECT Policy for Anonymous Follower Count

**What goes wrong:** The CONTEXT.md specifies "anyone can SELECT count" — meaning unauthenticated visitors should see the follower count on the public club profile page. Without an `anon` SELECT policy, the count query returns 0 or an error for unauthenticated users.

**Why it happens:** RLS default-denies all roles. A policy granting only `TO authenticated` excludes the `anon` role.

**How to avoid:** Add a public SELECT policy with no role restriction (applies to both `anon` and `authenticated`):
```sql
-- Public follower count: anyone can read follower count (no role restriction)
DROP POLICY IF EXISTS "Anyone can view follower count" ON public.club_followers;
CREATE POLICY "Anyone can view follower count"
  ON public.club_followers
  FOR SELECT
  USING (true);
```

Note: This exposes `user_id` values in the follower rows to anonymous users if they query without `head: true`. To prevent this, the API route for follower count should only return the count (using `{ count: "exact", head: true }`) and never return the raw row data publicly. The organizer read policy (using `is_club_owner()`) for full row access is separate.

**Warning signs:** Follower count shows as 0 for logged-out users but correct count for logged-in users.

### Pitfall 3: Club Profile Page — Follow Button Shown to Members

**What goes wrong:** Club members who are also following the club (hypothetically) or members who visit the page see the follow button when they shouldn't (per FOLLOW-06: visible to authenticated non-members only).

**Why it happens:** The club profile page currently has no membership awareness — it doesn't know if the visiting user is a club member.

**How to avoid:** The `GET /api/clubs/[id]/follow` route (FOLLOW-04) should return `{ is_following: boolean, is_member: boolean }` when authenticated. The `FollowButton` component or the page-level state uses `is_member` to conditionally render. If `is_member === true`, show neither the follow button nor the follower count button — possibly show a "Manage Club" link instead (consistent with SURF-04 requirements in Phase 8).

**Warning signs:** Club owners see a follow button on their own club profile.

### Pitfall 4: TypeScript Types Not Updated for `club_followers`

**What goes wrong:** `src/lib/supabase/types.ts` defines the `Database` type used by the Supabase client. If `club_followers` is not added, TypeScript will error when querying `.from("club_followers")` in strict mode.

**Why it happens:** The types file is manually maintained (not auto-generated from the live DB in this project).

**How to avoid:** Add the `club_followers` table to `src/lib/supabase/types.ts` following the exact same pattern as `club_invitations` was added in Phase 6. Also add a `ClubFollower` interface to `src/types/index.ts`.

**Warning signs:** TypeScript error `"Argument of type '"club_followers"' is not assignable to parameter"` in API routes.

### Pitfall 5: `onConflict` Syntax in Supabase Upsert

**What goes wrong:** Supabase JS client `upsert()` requires the `onConflict` value to exactly match the column names in the UNIQUE constraint. If the constraint is named but the column names don't match exactly, the upsert fails.

**Why it happens:** The UNIQUE constraint is on `(user_id, club_id)`. The `onConflict` string must be `"user_id,club_id"` (comma-separated, no spaces, matching column names).

**How to avoid:** Test the upsert path in development. Alternatively, use the simpler pattern of `.insert()` and check for error code `23505` (unique violation) and treat it as success.

---

## Code Examples

Verified patterns from existing codebase:

### Count Query with `head: true` (from `my-clubs/[id]/page.tsx`)

```typescript
// Source: src/app/my-clubs/[id]/page.tsx
const { count: memberCount } = await supabase
  .from("club_members")
  .select("*", { count: "exact", head: true })
  .eq("club_id", id);
```

Applied to follower count:
```typescript
const { count: followerCount } = await supabase
  .from("club_followers")
  .select("*", { count: "exact", head: true })
  .eq("club_id", clubId);
```

### `maybeSingle()` for Optional Row Check (from `api/user/engagement/route.ts`)

```typescript
// Source: src/app/api/user/engagement/route.ts
const { data: engagement } = await supabase
  .from("user_engagement_summary")
  .select("*")
  .eq("user_id", user.id)
  .maybeSingle();
```

Applied to follow status check:
```typescript
const { data: follow } = await supabase
  .from("club_followers")
  .select("id")
  .eq("user_id", user.id)
  .eq("club_id", clubId)
  .maybeSingle();

const isFollowing = follow !== null;
```

### Upsert with `ignoreDuplicates` (Supabase standard pattern)

```typescript
// POST /api/clubs/[id]/follow
const { error } = await supabase
  .from("club_followers")
  .upsert(
    { user_id: user.id, club_id: clubId },
    { onConflict: "user_id,club_id", ignoreDuplicates: true }
  );
```

### Targeted Delete (from `members/route.ts`)

```typescript
// Source: src/app/api/clubs/[id]/members/route.ts (DELETE handler)
const { error: deleteError } = await supabase
  .from("club_members")
  .delete()
  .eq("club_id", clubId)
  .eq("user_id", targetUserId);
```

Applied to unfollow:
```typescript
// DELETE /api/clubs/[id]/follow
const { error } = await supabase
  .from("club_followers")
  .delete()
  .eq("user_id", user.id)
  .eq("club_id", clubId);
```

### Join to `clubs` for Following List (new pattern)

```typescript
// GET /api/user/following
const { data: following, error } = await supabase
  .from("club_followers")
  .select(`
    id,
    created_at,
    clubs (
      id,
      name,
      logo_url,
      description,
      category
    )
  `)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
```

### ClubOverviewTab Extension Pattern

**Current props (from `src/components/clubs/ClubOverviewTab.tsx`):**
```typescript
interface ClubOverviewTabProps {
  club: Club;
  memberCount: number;
  pendingInvitesCount: number | null;
  role: "owner" | "organizer";
}
```

**Extended for Phase 9:**
```typescript
interface ClubOverviewTabProps {
  club: Club;
  memberCount: number;
  pendingInvitesCount: number | null;
  role: "owner" | "organizer";
  followerCount: number; // NEW
}
```

New stat card to add alongside existing Members and Status cards:
```typescript
{/* Followers stat */}
<div className="p-4 rounded-lg border bg-card">
  <div className="flex items-center gap-3 mb-2">
    <Heart className="h-5 w-5 text-primary" />
    <span className="text-sm font-medium text-muted-foreground">
      Followers
    </span>
  </div>
  <p className="text-2xl font-bold text-foreground">{followerCount}</p>
</div>
```

---

## Codebase Findings

### Existing Club Profile Page (`src/app/clubs/[id]/page.tsx`)

- Already a `"use client"` component — follow button state fits naturally
- Uses `useAuthStore` for `user` — auth awareness already present
- Has a CTA section (`{user && <div className="mb-8">...Request Organizer Access button...</div>}`)
- The follow button should go in this same CTA section, conditionally rendered based on `!isMember`
- The `OrganizerRequestDialog` is shown to all authenticated users currently — this will need to coexist with the follow button

**Key observation:** The current "Request Organizer Access" button is shown to ALL authenticated users (`{user && ...}`), including club members. Phase 8 (SURF-04) is supposed to change this to a 3-state CTA (visitor / organizer / owner). Phase 9 adds a 4th consideration (follower/non-follower). When integrating the follow button, keep the logic independent — if `isMember` is true, show the dashboard link; if `!isMember`, show the follow button and the request access button.

### Existing API Route Pattern (`src/app/api/clubs/[id]/route.ts`)

- `GET /api/clubs/[id]` returns `{ club, events }` — does not return follower count or membership status
- Adding follower count to this response is the cleanest path for public display (one fetch from the club profile page instead of two)
- If the user is authenticated, the route could also return `is_following` and `is_member` — but this requires auth context in what is currently a public route. Options:
  - Keep the public route public, add `GET /api/clubs/[id]/follow` for auth-specific data
  - Modify the public route to conditionally include auth data if a session exists

**Recommendation:** Keep public route public. Have the club profile page make two fetches in parallel: `fetchClub()` (public, gets club + events + follower count) and `fetchFollowStatus()` (authenticated, gets `is_following` + `is_member`). The `followerCount` can be included in the public `GET /api/clubs/[id]` response by adding a count query.

### Existing User Navigation

- `/profile` page exists as a server component at `src/app/profile/page.tsx`
- Profile page shows: name/avatar, interests, account info — no club following data yet
- `baseNavItems` in `navItems.ts` already includes "Profile" at `/profile`
- Adding a "Following Clubs" section to the profile page is the path of least resistance — no new nav entries needed

**Recommendation for FOLLOW-05 UI:** Add a "Following" section card to `src/app/profile/page.tsx` below the interests card. For API, the `GET /api/user/following` route is standalone and returns the clubs list. The profile page (server component) fetches it server-side.

### Supabase Types Pattern

`src/lib/supabase/types.ts` is manually maintained. The `club_invitations` entry was added in Phase 6 (per STATE.md decision `[v1.1 06-01]`). The new `club_followers` table needs:

```typescript
club_followers: {
  Row: {
    id: string;
    user_id: string;
    club_id: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    club_id: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    club_id?: string;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "club_followers_club_id_fkey";
      columns: ["club_id"];
      isOneToOne: false;
      referencedRelation: "clubs";
      referencedColumns: ["id"];
    },
  ];
};
```

Also add to `src/types/index.ts`:
```typescript
export interface ClubFollower {
  id: string;
  user_id: string;
  club_id: string;
  created_at: string;
  club?: Club;
}
```

### Migration Naming Convention

The last two Phase migrations use the timestamp format: `20260225000001_club_roles_and_invitations.sql` and `20260226000001_invitee_select_update_policy.sql`. Phase 9 migration should be named: `20260227000001_club_followers.sql`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side Supabase direct writes | API routes with server-side auth | Established Phase 5+ | Follow/unfollow go through API routes, not browser client |
| Manual count via `count()` aggregate | `{ count: "exact", head: true }` | Existing pattern | Use `head: true` for all count-only queries — avoids data transfer |

---

## Open Questions

1. **Should `GET /api/clubs/[id]` include `follower_count` in its response?**
   - What we know: Currently returns `{ club, events }`. Adding a count query is trivial.
   - What's unclear: Whether the public route should be extended vs keeping it minimal.
   - Recommendation: Yes — add `follower_count` to the response of `GET /api/clubs/[id]`. This is one DB query at the server level and avoids a second round-trip from the browser for the follower count display.

2. **Is the "Request Organizer Access" button shown to club members a pre-existing bug?**
   - What we know: `src/app/clubs/[id]/page.tsx` shows the button to ALL authenticated users (`{user && ...}`), with no membership check.
   - What's unclear: Whether Phase 8 (SURF-04) will fix this or Phase 9 should handle it.
   - Recommendation: Phase 9 adds the membership check (needed for FOLLOW-06 anyway). The follow button and organizer request button can both be guarded by `!isMember`. Note this is technically a Phase 8 concern but the `is_member` data will be fetched by Phase 9 regardless.

3. **Should unauthenticated users see the follow button with a redirect-to-login prompt?**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: UX preference.
   - Recommendation: Show the button to unauthenticated users — clicking it redirects to `/auth/signin` (or shows a toast). This is common UX (Instagram-style). Implementation: `if (!user) { router.push('/auth/signin'); return; }` in the button's onClick handler.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/app/my-clubs/[id]/page.tsx` — server-side count prop threading pattern
- Codebase: `supabase/migrations/20260225000001_club_roles_and_invitations.sql` — idempotent migration + SECURITY DEFINER pattern
- Codebase: `supabase/migrations/011_rls_audit.sql` — RLS policy structure, `is_admin()` SECURITY DEFINER template
- Codebase: `supabase/migrations/20260226000001_invitee_select_update_policy.sql` — sub-select email match RLS pattern
- Codebase: `src/app/api/clubs/[id]/members/route.ts` — auth-guarded API route pattern (GET + DELETE)
- Codebase: `src/app/api/clubs/[id]/invites/route.ts` — auth-guarded API route pattern (POST + DELETE)
- Codebase: `src/components/clubs/ClubOverviewTab.tsx` — existing stats grid to extend with follower count
- Codebase: `src/lib/supabase/types.ts` — manual type maintenance pattern
- Codebase: `src/types/index.ts` — application interface patterns
- Codebase: `src/components/layout/navItems.ts` — nav structure; profile page is already linked

### Secondary (MEDIUM confidence)

- Supabase PostgREST docs (from training knowledge, cross-referenced with project patterns): `upsert()` with `ignoreDuplicates: true` maps to `ON CONFLICT DO NOTHING`
- Supabase PostgREST docs: `{ count: "exact", head: true }` pattern confirmed by existing project usage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies
- Architecture: HIGH — patterns directly verified from existing migration files and API routes
- Pitfalls: HIGH (RLS/auth pitfalls) / MEDIUM (upsert syntax) — auth/RLS pitfalls verified from existing code; upsert syntax from project patterns + Supabase documentation conventions
- DB schema: HIGH — directly specified in CONTEXT.md locked decisions

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days — stable stack, no fast-moving dependencies)
