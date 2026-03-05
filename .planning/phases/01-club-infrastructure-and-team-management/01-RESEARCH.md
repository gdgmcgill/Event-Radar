# Phase 1: Club Infrastructure and Team Management - Research

**Researched:** 2026-03-05
**Domain:** Club management pages, team invitations, follow system (Next.js 16 + Supabase + shadcn/ui)
**Confidence:** HIGH

## Summary

Phase 1 is a full teardown and rebuild of all club infrastructure. The existing codebase already has the database tables (`clubs`, `club_members`, `club_invitations`, `club_followers`), RLS policies, helper functions (`is_club_owner()`), and some API routes in place from previous phases (05, 07, 09). The database layer is largely complete and battle-tested. The work is primarily frontend rebuilding, API route cleanup, and ensuring the full flow works end-to-end.

Key architectural decisions are already locked: URL-driven club context (`/my-clubs/[id]`), RLS as primary security boundary, owner/organizer role distinction via `club_members.role` CHECK constraint. The existing API routes for follow, invites, members, and club CRUD contain solid patterns that should be rebuilt with cleaner structure but the same security model. The clubs table currently restricts INSERT/UPDATE to admins only via RLS -- this needs a new policy allowing owners to update their own clubs (CLUB-02).

**Primary recommendation:** Audit and extend the existing database schema and RLS policies first (notably adding owner UPDATE policy on `clubs` table), then rebuild all frontend pages and components from scratch using the existing shadcn/ui primitives, with SWR for client-side data fetching.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full teardown and rebuild from scratch -- delete all existing club components, pages, and API routes
- Rebuild both frontend (React components/pages) AND backend (API routes) from zero
- Review and audit database schema (clubs, club_members, club_invitations, club_followers tables), RLS policies, and triggers -- create migrations for any changes needed
- Rationale: existing code is too fragmented, RLS patterns need to be correct from day one since all subsequent phases inherit them
- Quick-switch dropdown lives in the dashboard header area, next to the club name at top of the management page
- Dropdown shows logo + club name only (no role badge)
- No "View all clubs" footer link -- breadcrumb or back button handles navigation to full list
- Switching clubs always lands on Overview tab (does not preserve current tab)
- Single-club optimization: if an organizer only has one club, clicking "My Clubs" in navigation should redirect directly to their club dashboard, skipping the club list page entirely

### Claude's Discretion
- Public club page visual design and layout (must show: logo, name, description, category, Instagram link, follower count, upcoming/past events)
- Club edit form UX (inline, settings tab, or modal)
- Empty states for all pages
- Loading states and skeletons
- Exact component architecture and data fetching patterns
- Whether to use server components vs client components for each page
- URL structure (current /my-clubs, /my-clubs/[id], /clubs/[id] is reasonable starting point but not locked)
- "Whatever is the cleanest for a prod ready app for 40k users" -- production quality is the bar, not MVP

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLUB-01 | Public club page showing logo, name, description, category, Instagram link, follower count, upcoming/past events | Existing `/api/clubs/[id]` route pattern fetches club + events + follower count in parallel. Rebuild with past events split. |
| CLUB-02 | Club owner can edit club details from management page, changes persist | **RLS gap identified**: current `clubs` table only allows admin INSERT/UPDATE. Need new policy for owners. Existing logo upload API at `/api/clubs/logo` is reusable pattern. |
| CLUB-03 | Organizer can view "My Clubs" list with name, logo, role, member count | Existing `/api/my-clubs` route fetches memberships with club details. Needs member count added. Single-club redirect logic is new. |
| CLUB-04 | Quick-switch dropdown in club management view | Pure frontend component. Reuse data from my-clubs fetch. Lands on Overview tab always. |
| TEAM-01 | Club owner can view all club members with role and joined date | Existing `/api/clubs/[id]/members` route with RLS `is_club_owner()` cross-row SELECT. `club_members` lacks `created_at` -- **schema gap** needs migration. |
| TEAM-02 | Club owner can invite McGill email, generating shareable link | Existing `/api/clubs/[id]/invites` POST route with full validation. Token-based system with 7-day expiry. |
| TEAM-03 | Club owner can remove organizer (not self) | Existing `/api/clubs/[id]/members` DELETE with self-removal guard. RLS policy enforces at DB level. |
| TEAM-04 | User opening invite link while logged in with matching email is added to club | Existing `/invites/[token]` server component page handles full flow. Needs rebuild but logic is proven. |
| FLLW-01 | Student can follow a club from public page | Existing `/api/clubs/[id]/follow` POST with upsert pattern. RLS policies in place. |
| FLLW-02 | Student can unfollow a club | Existing `/api/clubs/[id]/follow` DELETE. RLS policies in place. |
| FLLW-03 | Public club page displays follower count | Existing route uses `count: "exact", head: true` query pattern. Works for anon users. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.0.3 | App Router framework | Already in use; pages, API routes, server components |
| TypeScript | 5.4.0 | Type safety | Already in use; strict mode enabled |
| Supabase JS | 2.49.0 | Database + Auth client | Already in use; typed with Database generic |
| @supabase/ssr | 0.7.0 | Server/browser Supabase clients | Already in use; cookie-based auth |
| Tailwind CSS | 3.4.1 | Styling | Already in use |
| shadcn/ui | (radix primitives) | UI components | Already in use; Card, Badge, Button, Input, Dialog, Sheet, Tabs, Skeleton, Breadcrumb available |
| Zustand | 5.0.9 | Client-side auth state | Already in use via useAuthStore |
| SWR | 2.3.7 | Client-side data fetching | Already installed; use for club data fetching with revalidation |
| Lucide React | 0.344.0 | Icons | Already in use throughout |
| date-fns | 3.3.1 | Date formatting | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-easy-crop | 5.5.6 | Image cropping for logo upload | Already installed; use for club logo editing |
| class-variance-authority | 0.7.1 | Component variants | Already installed; use for button/badge variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWR | React Query / TanStack Query | SWR already installed and used; no reason to switch |
| Zustand | React Context | Zustand already established for auth; keep consistent |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Page Structure
```
src/
├── app/
│   ├── clubs/
│   │   └── [id]/
│   │       └── page.tsx          # Public club page (server component)
│   ├── my-clubs/
│   │   ├── page.tsx              # Club list OR redirect (server component)
│   │   └── [id]/
│   │       └── page.tsx          # Club management dashboard (client component)
│   ├── invites/
│   │   └── [token]/
│   │       └── page.tsx          # Invite acceptance (server component)
│   └── api/
│       └── clubs/
│           ├── route.ts          # GET all clubs, POST create club
│           ├── logo/
│           │   └── route.ts      # POST upload logo
│           └── [id]/
│               ├── route.ts      # GET club detail, PATCH update club
│               ├── events/
│               │   └── route.ts  # GET club events
│               ├── follow/
│               │   └── route.ts  # GET status, POST follow, DELETE unfollow
│               ├── members/
│               │   └── route.ts  # GET members, DELETE remove member
│               └── invites/
│                   └── route.ts  # POST create invite, DELETE revoke
├── components/
│   └── clubs/
│       ├── ClubDashboard.tsx     # Tabs container with quick-switch header
│       ├── ClubOverviewTab.tsx   # Club details display
│       ├── ClubSettingsTab.tsx   # Edit form for club details
│       ├── ClubMembersTab.tsx    # Member list + invite flow
│       ├── ClubQuickSwitch.tsx   # Dropdown for switching between clubs
│       ├── FollowButton.tsx      # Follow/unfollow with optimistic update
│       └── ClubCard.tsx          # Card for my-clubs list
└── api/
    └── my-clubs/
        └── route.ts              # GET user's clubs with stats
```

### Pattern 1: Server Component for Public Pages
**What:** Use Next.js server components for pages that are primarily read-only and benefit from SSR (public club page, invite acceptance).
**When to use:** Public-facing pages, pages that need SEO, pages with no interactive state.
**Example:**
```typescript
// src/app/clubs/[id]/page.tsx — Server Component
import { createClient } from "@/lib/supabase/server";

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [clubResult, eventsResult, followerResult] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase.from("events").select("*").eq("club_id", id).eq("status", "approved").order("start_date"),
    supabase.from("club_followers").select("*", { count: "exact", head: true }).eq("club_id", id),
  ]);

  // Render with data...
}
```

### Pattern 2: Client Component for Dashboard with SWR
**What:** Use client components with SWR for interactive dashboard pages that need real-time updates.
**When to use:** Club management dashboard, my-clubs list (when not redirecting).
**Example:**
```typescript
// Custom hook for club data
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useClub(clubId: string) {
  return useSWR(`/api/clubs/${clubId}`, fetcher);
}

export function useMyClubs() {
  return useSWR("/api/my-clubs", fetcher);
}
```

### Pattern 3: Single-Club Redirect in Server Component
**What:** The my-clubs list page checks club count server-side and redirects if only one club exists.
**When to use:** CLUB-03 single-club optimization.
**Example:**
```typescript
// src/app/my-clubs/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MyClubsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?signin=required&next=/my-clubs");

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id);

  if (memberships?.length === 1) {
    redirect(`/my-clubs/${memberships[0].club_id}`);
  }

  // Render club list...
}
```

### Pattern 4: Optimistic Updates for Follow/Unfollow
**What:** Update UI immediately before API response, revert on error.
**When to use:** Follow button interactions for instant feedback.
**Example:**
```typescript
const [isFollowing, setIsFollowing] = useState(false);
const [followerCount, setFollowerCount] = useState(initialCount);

async function handleFollow() {
  setIsFollowing(true);
  setFollowerCount(prev => prev + 1);
  try {
    await fetch(`/api/clubs/${clubId}/follow`, { method: "POST" });
  } catch {
    setIsFollowing(false);
    setFollowerCount(prev => prev - 1);
  }
}
```

### Pattern 5: API Route Auth Pattern
**What:** Consistent authentication and authorization pattern for all API routes.
**When to use:** Every protected API route.
**Example:**
```typescript
// Established pattern from existing codebase
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
  }

  // Authorization: check club_members role
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can edit club details" }, { status: 403 });
  }

  // ... proceed with update
}
```

### Anti-Patterns to Avoid
- **Using service client for user-initiated writes:** RLS should enforce authorization; only use `createServiceClient()` for admin/cron operations. The existing `POST /api/clubs` route incorrectly uses service client for club creation -- fix in rebuild.
- **Fetching user roles in every API route:** The existing pattern of querying `users.roles` table is redundant when RLS policies on `club_members` already enforce access. Check membership directly instead of role arrays.
- **Client-side auth checks as security:** Use middleware and server-side auth; client-side checks are UX-only.
- **Exposing raw Supabase error messages:** Return generic error messages to users; log detailed errors server-side only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation for invites | Custom UUID/crypto | Database `DEFAULT gen_random_uuid()` | DB-level uniqueness guarantee, no race conditions |
| Cookie-based auth | Manual cookie management | `@supabase/ssr` middleware + createClient | Handles token refresh, cookie chunking, PKCE |
| Image upload validation | Custom file parsing | FormData API + size/type checks (existing pattern) | Standard web API, already proven in codebase |
| Row-level authorization | Application-level checks only | Supabase RLS policies + API-level checks (defense in depth) | RLS cannot be bypassed even if API has bugs |
| Date/time formatting | Manual string manipulation | `date-fns` format/parseISO | Timezone handling, locale support |
| Component styling system | Custom CSS classes | `cn()` utility + Tailwind + shadcn/ui | Consistent with codebase, handles class merging |

**Key insight:** The database layer (RLS policies, triggers, constraints) is the security boundary. API routes are the second line of defense. Frontend checks are UX convenience only.

## Common Pitfalls

### Pitfall 1: RLS Policy Gap on Clubs UPDATE
**What goes wrong:** Club owners cannot edit their own club details because the current RLS policy only allows admins to UPDATE clubs.
**Why it happens:** Migration `011_rls_audit.sql` intentionally restricted clubs INSERT/UPDATE to admins only, but CLUB-02 requires owners to edit their clubs.
**How to avoid:** Create a new migration adding an owner UPDATE policy on `clubs` table:
```sql
CREATE POLICY "Club owners can update own club"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (is_club_owner(id))
  WITH CHECK (is_club_owner(id));
```
**Warning signs:** PATCH requests to update club details return empty results or 403 errors.

### Pitfall 2: Missing created_at on club_members
**What goes wrong:** TEAM-01 requires showing "joined date" for each member, but `club_members` table may not have a `created_at` column.
**Why it happens:** The DB types show `club_members` has `id`, `user_id`, `club_id`, `role` -- no `created_at`. However, the members API route already selects `created_at`, suggesting it exists in the actual DB but may not be in the type definition.
**How to avoid:** Verify the actual database schema and update `src/lib/supabase/types.ts` to include `created_at` if it exists, or add it via migration if it does not.
**Warning signs:** TypeScript errors when selecting `created_at` from `club_members`, or null values returned.

### Pitfall 3: Middleware Route Protection
**What goes wrong:** The `/my-clubs` route is not in the middleware's `PROTECTED_ROUTES` array, so unauthenticated users can access it and see confusing empty states or errors.
**Why it happens:** Middleware only protects `/my-events`, `/create-event`, `/notifications`, `/profile` currently.
**How to avoid:** Add `/my-clubs` to the `PROTECTED_ROUTES` array in `src/middleware.ts`.
**Warning signs:** Unauthenticated users see "My Clubs" page content instead of being redirected.

### Pitfall 4: Follow Upsert Unique Constraint
**What goes wrong:** Following a club twice causes a unique constraint violation.
**Why it happens:** The `club_followers_unique` constraint on `(user_id, club_id)` prevents duplicate rows.
**How to avoid:** The existing code already uses `upsert` with `onConflict: "user_id,club_id", ignoreDuplicates: true`. Keep this pattern.
**Warning signs:** 500 errors when rapidly clicking the follow button.

### Pitfall 5: Next.js 16 Async Params
**What goes wrong:** Route handlers crash with "params is not iterable" or similar errors.
**Why it happens:** Next.js 16 changed `params` to be a Promise that must be awaited: `const { id } = await params;`
**How to avoid:** Always define `params: Promise<{ id: string }>` and await it. The existing codebase already uses this pattern correctly.
**Warning signs:** Runtime errors on any dynamic route page or API.

### Pitfall 6: Stale SWR Data After Mutations
**What goes wrong:** After editing club details or following/unfollowing, the UI shows old data.
**Why it happens:** SWR cache is not invalidated after mutations.
**How to avoid:** Call `mutate()` from SWR after successful mutations:
```typescript
import { mutate } from "swr";
// After follow
mutate(`/api/clubs/${clubId}`);
mutate(`/api/clubs/${clubId}/follow`);
```
**Warning signs:** User has to refresh the page to see updated data.

### Pitfall 7: Follower Count Denormalization Decision
**What goes wrong:** Live COUNT queries become slow at scale with many followers.
**Why it happens:** `SELECT count(*)` on `club_followers` scans the index for each page load.
**How to avoid:** For Phase 1, use live COUNT (current pattern with `count: "exact", head: true`). This is fine for 40K users. If performance degrades later, add a `follower_count` column to `clubs` with a trigger. Do not prematurely optimize.
**Warning signs:** Slow club page loads as follower counts grow past 10K per club (unlikely for a campus app).

## Code Examples

### Verified: Server-side Supabase Client Pattern
```typescript
// Source: src/lib/supabase/server.ts (existing)
import { createClient } from "@/lib/supabase/server";

export default async function ServerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ...
}
```

### Verified: Client-side Supabase Client Pattern
```typescript
// Source: src/lib/supabase/client.ts (existing)
import { createClient } from "@/lib/supabase/client";

function ClientComponent() {
  const supabase = createClient(); // No await needed
  // ...
}
```

### Verified: Follower Count Query Pattern
```typescript
// Source: src/app/api/clubs/[id]/route.ts (existing)
const { count: followerCount } = await supabase
  .from("club_followers")
  .select("*", { count: "exact", head: true })
  .eq("club_id", clubId);
// Returns count without fetching rows
```

### Verified: Invite Token Insert Pattern
```typescript
// Source: src/app/api/clubs/[id]/invites/route.ts (existing)
// token and expires_at have DB defaults (gen_random_uuid() and now() + 7 days)
const { data: invite, error } = await supabase
  .from("club_invitations")
  .insert({
    club_id: clubId,
    inviter_id: user.id,
    invitee_email: normalizedEmail,
  })
  .select("token")
  .single();
```

### Verified: RLS-Aware Member Query with Join
```typescript
// Source: src/app/api/clubs/[id]/members/route.ts (existing)
const { data: members } = await supabase
  .from("club_members")
  .select(`
    id,
    user_id,
    role,
    created_at,
    users (
      id,
      email,
      name,
      avatar_url
    )
  `)
  .eq("club_id", clubId)
  .order("created_at", { ascending: true });
```

### Recommended: Club Update API with Owner Check
```typescript
// New for Phase 1 — PATCH /api/clubs/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: clubId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
  }

  // RLS is_club_owner() will enforce at DB level too, but API check provides better error message
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can edit club details" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, category, instagram_handle, logo_url } = body;

  const { data: club, error } = await supabase
    .from("clubs")
    .update({
      name: name?.trim(),
      description: description?.trim() || null,
      category: category || null,
      instagram_handle: instagram_handle?.trim() || null,
      logo_url: logo_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update club" }, { status: 500 });
  }

  return NextResponse.json({ club });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params.id` direct access | `const { id } = await params` | Next.js 15+ | All dynamic routes must await params |
| `getServerSideProps` | Server Components with async | Next.js 13+ App Router | Data fetching is in the component body |
| Service role for all writes | RLS with anon key client | Supabase SSR pattern | Security enforcement at DB level |
| `useEffect` + `useState` for data | SWR hooks | Already adopted | Caching, deduplication, revalidation |

**Deprecated/outdated:**
- `organizer_requests` table: Legacy approach for joining clubs. Replaced by `club_invitations` token system. Can be ignored in Phase 1.
- `OrganizerRequestDialog` component: Delete as part of teardown.
- Service role usage in `POST /api/clubs`: Anti-pattern. Rebuild to use RLS-compatible client.

## Open Questions

1. **club_members.created_at existence**
   - What we know: The API route selects `created_at`, and the DB types file does NOT list it. The actual DB schema may differ from the types file.
   - What's unclear: Whether the column exists in production DB.
   - Recommendation: Check actual DB schema during implementation. If missing, add via migration. Either way, update `types.ts`.

2. **Clubs table UPDATE RLS policy scope**
   - What we know: Current policy allows only admin updates. Phase 1 needs owner updates.
   - What's unclear: Whether the owner update policy should restrict which columns can be changed (e.g., prevent changing `status` or `created_by`).
   - Recommendation: The RLS policy should allow full row UPDATE for owners. Column-level restrictions should be enforced at the API layer (only accept name, description, category, instagram_handle, logo_url).

3. **club_members INSERT policy for invite acceptance**
   - What we know: The invite acceptance page (`/invites/[token]`) inserts into `club_members`. Current RLS policies may not have an explicit INSERT policy for the invitee.
   - What's unclear: Whether the existing "Admins manage memberships" policy or another policy covers this case.
   - Recommendation: Verify and add an INSERT policy if needed: users can insert a row where `user_id = auth.uid()` (self-insertion only, after invite validation at API/page level).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 + ts-jest 29.4.6 |
| Config file | `jest.config.js` (exists, configured with path aliases) |
| Quick run command | `npx jest --testPathPattern=clubs --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLUB-01 | Public club page returns club + events + follower count | unit | `npx jest tests/api/clubs/get-club.test.ts -x` | No -- Wave 0 |
| CLUB-02 | PATCH club updates persist for owner, reject for non-owner | unit | `npx jest tests/api/clubs/patch-club.test.ts -x` | No -- Wave 0 |
| CLUB-03 | My-clubs returns user's clubs with stats | unit | `npx jest tests/api/my-clubs.test.ts -x` | No -- Wave 0 |
| CLUB-04 | Quick-switch dropdown | manual-only | N/A -- UI component, no backend logic | N/A |
| TEAM-01 | Members list returns members with roles and dates | unit | `npx jest tests/api/clubs/members.test.ts -x` | No -- Wave 0 |
| TEAM-02 | Invite creation validates email, checks duplicates | unit | `npx jest tests/api/clubs/invites.test.ts -x` | No -- Wave 0 |
| TEAM-03 | Member removal works for owner, blocks self-removal | unit | `npx jest tests/api/clubs/remove-member.test.ts -x` | No -- Wave 0 |
| TEAM-04 | Invite acceptance adds user to club | unit | `npx jest tests/api/invites/accept.test.ts -x` | No -- Wave 0 |
| FLLW-01 | Follow inserts follower row | unit | `npx jest tests/api/clubs/follow.test.ts -x` | No -- Wave 0 |
| FLLW-02 | Unfollow deletes follower row | unit | `npx jest tests/api/clubs/follow.test.ts -x` | No -- Wave 0 |
| FLLW-03 | Follower count returned in club detail | unit | `npx jest tests/api/clubs/get-club.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=clubs --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/clubs/get-club.test.ts` -- covers CLUB-01, FLLW-03
- [ ] `tests/api/clubs/patch-club.test.ts` -- covers CLUB-02
- [ ] `tests/api/my-clubs.test.ts` -- covers CLUB-03
- [ ] `tests/api/clubs/members.test.ts` -- covers TEAM-01
- [ ] `tests/api/clubs/invites.test.ts` -- covers TEAM-02
- [ ] `tests/api/clubs/remove-member.test.ts` -- covers TEAM-03
- [ ] `tests/api/invites/accept.test.ts` -- covers TEAM-04
- [ ] `tests/api/clubs/follow.test.ts` -- covers FLLW-01, FLLW-02
- [ ] Test infrastructure: Supabase client mock helper for unit tests

Note: These are API-layer unit tests that mock the Supabase client. They verify request validation, authorization checks, and response shapes without requiring a live database. Full integration tests against Supabase would require a test project or local Supabase instance, which is outside Phase 1 scope.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/supabase/types.ts` -- complete database schema types
- Codebase analysis: `supabase/migrations/20260225000001_club_roles_and_invitations.sql` -- RLS policies and club_invitations schema
- Codebase analysis: `supabase/migrations/20260227000001_club_followers.sql` -- club_followers RLS policies
- Codebase analysis: `supabase/migrations/011_rls_audit.sql` -- current clubs INSERT/UPDATE restricted to admins
- Codebase analysis: `supabase/migrations/20260226000001_invitee_select_update_policy.sql` -- invite acceptance RLS
- Codebase analysis: All existing API routes under `src/app/api/clubs/`
- Codebase analysis: `src/app/invites/[token]/page.tsx` -- invite acceptance flow
- Codebase analysis: `src/middleware.ts` -- route protection patterns
- Codebase analysis: `package.json` -- installed dependencies and versions

### Secondary (MEDIUM confidence)
- `src/store/useAuthStore.ts` -- auth state management patterns
- `src/components/layout/navItems.ts` -- navigation structure for organizers

### Tertiary (LOW confidence)
- `club_members.created_at` existence -- types file omits it but API code uses it; needs DB verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use; no new dependencies needed
- Architecture: HIGH -- patterns directly derived from existing codebase; page structure follows established conventions
- Pitfalls: HIGH -- identified from direct code analysis of existing migrations, RLS policies, and API routes
- Database schema gaps: MEDIUM -- types file may be stale relative to actual DB schema; verify `club_members.created_at`

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack, all dependencies pinned)
