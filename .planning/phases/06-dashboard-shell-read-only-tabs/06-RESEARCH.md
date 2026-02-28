# Phase 6: Dashboard Shell + Read-Only Tabs - Research

**Researched:** 2026-02-25
**Domain:** Next.js App Router dynamic routes, shadcn/ui Tabs, Supabase server-side auth, URL search param state
**Confidence:** HIGH

---

## Summary

Phase 6 creates the `/my-clubs/[id]` club organizer dashboard — turning a dead link into a functional read-only page. The core work is: (1) a dynamic App Router page with server-side role resolution, (2) a client component with tabbed navigation whose active tab is reflected in `?tab=<name>` URL params, (3) an Overview tab pulling club metadata from the DB, and (4) an Events tab consuming the already-built `GET /api/clubs/[id]/events` endpoint.

The primary technical challenge is installing and wiring shadcn/ui Tabs (not yet in the project — `@radix-ui/react-tabs` is absent from `node_modules`) and correctly using Next.js `useSearchParams`/`useRouter` inside a client component wrapped in `<Suspense>` for URL-based tab state. The server component half of the page should resolve the user's club role in a single Supabase query and pass it down to avoid redundant fetches.

The existing codebase already provides all supporting infrastructure: `GET /api/clubs/[id]/events` works and enforces membership auth, `createClient()` from `@/lib/supabase/server` is the correct server-side pattern, the `Club` and `ClubMember` types exist in `src/types/index.ts`, and `/my-clubs/layout.tsx` already gate-keeps the `club_organizer` role at the layout level so the page itself can focus on per-club membership lookup.

**Primary recommendation:** Server component page (`page.tsx`) resolves role via single `club_members` query and passes `{ club, role }` as props to a `"use client"` dashboard shell. Tabs use shadcn Tabs + `useSearchParams`/`useRouter` for URL state. Install `@radix-ui/react-tabs` via `npx shadcn@latest add tabs`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | `/my-clubs/[id]` page with server-side role resolution — resolves user's club role in a single DB query, passes as prop to client components | Server component `page.tsx` with `searchParams` + `params` props; single `club_members` select query; pass `role` prop to client shell |
| DASH-02 | Tabbed navigation — Overview, Events, Members, Settings — using shadcn Tabs component | Install `@radix-ui/react-tabs` + shadcn Tabs; `npx shadcn@latest add tabs` adds `src/components/ui/tabs.tsx` |
| DASH-03 | URL-param tab state (`?tab=members`) for bookmarkable URLs and correct back-button behavior | `useSearchParams()` in client component wrapped in `<Suspense>`; `router.replace` or `router.push` to update tab param |
| DASH-04 | Overview tab — club info summary (name, description, category, member count, pending invites count for owners) | Member count via `club_members` count query (or passed from server); pending invites from `club_invitations` — both fetchable server-side |
| DASH-05 | Events tab consuming existing `GET /api/clubs/[id]/events` — list view with event title, date, status | Fetch `/api/clubs/${id}/events` client-side in Events tab; existing endpoint already enforces membership auth |
| DASH-06 | Club-context event creation link from Events tab — navigates to `/create-event` with `clubId` pre-filled | `CreateEventForm` already accepts `clubId` prop; link to `/create-event?clubId=${id}` OR render `CreateEventForm` inline; reading `useSearchParams` in `create-event/page.tsx` |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.0.3 (project) | Dynamic route `[id]`, server components, searchParams | Already the project framework |
| @radix-ui/react-tabs | ^1.1.x (latest) | Accessible tab primitives underlying shadcn Tabs | shadcn Tabs wraps this; not yet installed |
| shadcn/ui Tabs | via `npx shadcn@latest add tabs` | Styled tab component with Radix accessibility | Project uses shadcn — components.json present, style: "default" |
| @/lib/supabase/server `createClient()` | @supabase/ssr ^0.7.0 | Server-side DB queries in page.tsx | Established project pattern; used in moderation/layout.tsx, events/[id]/page.tsx |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useSearchParams` / `useRouter` | Next.js 16 built-in | Reading/writing `?tab=` URL param in client component | Tab navigation in ClubDashboardClient |
| `Suspense` (React 18) | built-in | Required wrapper when using `useSearchParams` in Next.js app router | Wrap any component using `useSearchParams` |
| Lucide React | ^0.344.0 (project) | Icons in tab headers and overview stats | Already installed |
| Tailwind CSS | ^3.4.1 (project) | Layout and spacing | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL param tab state (`?tab=`) | React state only (`useState`) | URL state is required by DASH-03 for bookmarkability + back-button; useState doesn't persist on nav |
| shadcn Tabs component | Custom tab implementation (like ModerationNav) | ModerationNav pattern uses pathname routing (separate pages); DASH-03 explicitly requires `?tab=` — single page, URL params. shadcn Tabs handles ARIA roles automatically |
| Server-side data passing | Client-side fetch for all data | Role fetch server-side avoids waterfall; club data can be co-fetched; events tab lazy-loads client-side since it needs auth cookie in fetch |

**Installation:**
```bash
npx shadcn@latest add tabs
```
This installs `@radix-ui/react-tabs` as a dep and creates `src/components/ui/tabs.tsx`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   └── my-clubs/
│       ├── layout.tsx               # EXISTS — gates club_organizer role
│       ├── page.tsx                 # EXISTS — club list
│       └── [id]/
│           └── page.tsx             # NEW — server component, resolves role, fetches club
├── components/
│   └── clubs/
│       ├── ClubDashboard.tsx        # NEW — "use client" shell, tabs + URL state
│       ├── ClubOverviewTab.tsx      # NEW — static display of club fields
│       └── ClubEventsTab.tsx        # NEW — fetches /api/clubs/[id]/events
└── components/
    └── ui/
        └── tabs.tsx                 # NEW via `npx shadcn@latest add tabs`
```

### Pattern 1: Server Component Page with Role Resolution

**What:** `page.tsx` is a Server Component. It uses `params` to get the club ID, creates a server Supabase client, fetches the club row and the user's `club_members` row in parallel (or a join), then renders the client dashboard with resolved data as props.

**When to use:** Whenever auth-gated per-resource data is needed before any rendering — avoids client-side waterfalls.

**Example:**
```typescript
// src/app/my-clubs/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClubDashboard } from "@/components/clubs/ClubDashboard";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClubDashboardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Single query: fetch club + membership in parallel
  const [{ data: club }, { data: membership }] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", id)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!club || !membership) notFound();

  return (
    <ClubDashboard
      club={club}
      role={membership.role as "owner" | "organizer"}
      initialTab={tab ?? "overview"}
    />
  );
}
```

**Key insight:** The layout (`/my-clubs/layout.tsx`) already confirms `club_organizer` role exists in `users.roles`. The page only needs to check `club_members` membership for the specific club, not re-check roles from `users`.

### Pattern 2: URL-Param Tab State with useSearchParams + Suspense

**What:** Client component reads `?tab=` from URL via `useSearchParams()`. On tab change, calls `router.replace` to update the URL without a full page reload. The component must be wrapped in `<Suspense>` because `useSearchParams` triggers dynamic rendering.

**When to use:** DASH-03 requires bookmarkable URL tab state.

**Example:**
```typescript
// src/components/clubs/ClubDashboard.tsx
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Club } from "@/types";

interface ClubDashboardProps {
  club: Club;
  role: "owner" | "organizer";
  initialTab: string;
}

const VALID_TABS = ["overview", "events", "members", "settings"] as const;
type TabValue = (typeof VALID_TABS)[number];

function ClubDashboardInner({ club, role, initialTab }: ClubDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") ?? initialTab) as TabValue;
  const validTab = VALID_TABS.includes(activeTab as TabValue) ? activeTab : "overview";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={validTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        {/* ClubOverviewTab */}
      </TabsContent>
      <TabsContent value="events">
        {/* ClubEventsTab */}
      </TabsContent>
      {/* members and settings: read-only stubs for Phase 6 */}
    </Tabs>
  );
}

export function ClubDashboard(props: ClubDashboardProps) {
  return (
    <Suspense>
      <ClubDashboardInner {...props} />
    </Suspense>
  );
}
```

### Pattern 3: Events Tab Client-Side Fetch

**What:** The Events tab fetches `GET /api/clubs/[id]/events` client-side using `useEffect` or SWR. The endpoint enforces auth; the cookie is sent automatically from the browser.

**When to use:** Tab-gated data that should only load when the tab is visited (lazy loading via conditional render or always-mount).

**Example:**
```typescript
// src/components/clubs/ClubEventsTab.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types";

interface ClubEventsTabProps {
  clubId: string;
}

export function ClubEventsTab({ clubId }: ClubEventsTabProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/events`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, [clubId]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Events</h2>
        <Link href={`/create-event?clubId=${clubId}`}>
          <Button>Create Event</Button>
        </Link>
      </div>
      {events.map(event => (
        <div key={event.id}>
          <span>{event.title}</span>
          <span>{event.event_date}</span>
          <Badge>{event.status}</Badge>
        </div>
      ))}
    </div>
  );
}
```

**Note on DASH-06 "Create Event" link:** The `CreateEventForm` already accepts a `clubId` prop (confirmed at `src/components/events/CreateEventForm.tsx:54`). The simplest approach for DASH-06 is a link to `/create-event?clubId=${clubId}`. However, `create-event/page.tsx` does not currently read `searchParams` to pass `clubId` to the form. The page will need updating to read `?clubId=` and pass it as prop to `<CreateEventForm clubId={clubId} />`. Alternatively, link navigates to the create-event page and the form handles club pre-selection from URL params internally.

### Pattern 4: Members/Settings Tabs as Read-Only Stubs

**What:** Members and Settings tabs exist in Phase 6 as empty/stub content (e.g., "Coming soon" or a simple message). They are included in the tab navigation to satisfy DASH-02 (four tabs visible) but have no functional content until Phase 7 (Members) and Phase 8 (Settings).

**When to use:** Required by DASH-02: four tabs must be present. Full implementation is Phase 7/8 scope.

### Anti-Patterns to Avoid

- **`useSearchParams` without Suspense:** Next.js App Router requires `useSearchParams()` callers to be wrapped in `<Suspense>`. Missing this causes a build error or runtime crash.
- **Two separate `getUser()` calls (layout + page):** The layout already validates `club_organizer` role. The page only needs `getUser()` once to get the user ID for the `club_members` lookup. Don't re-fetch the `users.roles` array.
- **Passing `router.push` for tab changes:** Use `router.replace` (not `push`) to avoid polluting the browser history stack with every tab click.
- **Fetching events in the server component:** The events tab should lazy-load via client fetch. Fetching all tabs' data server-side creates unnecessary DB load for content the user may never view.
- **Using the existing ModerationNav routing pattern for tabs:** ModerationNav uses pathname-based separate pages. DASH-03 specifically requires `?tab=` on the same URL — use shadcn Tabs, not separate sub-routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab accessible markup | `<div role="tablist">` + manual ARIA | shadcn Tabs (`@radix-ui/react-tabs`) | ARIA attributes, keyboard nav (arrow keys), focus management — complex to get right |
| Tab URL state | Custom history API manipulation | `useSearchParams` + `router.replace` | Next.js handles scroll restoration, SSR serialization, concurrent features |
| Status badge colors | Custom CSS per status | `Badge` from `@/components/ui/badge` | Already in project; pending=yellow, approved=green, rejected=red via variant or className |

**Key insight:** The Radix Tabs primitive handles all ARIA and keyboard interactions. Shadcn wraps it with the project's design system. There is zero reason to build custom tabs.

---

## Common Pitfalls

### Pitfall 1: Missing Suspense Boundary Around useSearchParams

**What goes wrong:** Build succeeds but runtime throws "useSearchParams() should be wrapped in a suspense boundary" error, OR Next.js opts the entire route out of static generation unexpectedly.

**Why it happens:** `useSearchParams()` in Next.js App Router requires access to the request-time URL, which forces dynamic rendering. The framework requires an explicit `<Suspense>` boundary to isolate this.

**How to avoid:** Always wrap the component using `useSearchParams` in a `<Suspense>` (even empty fallback). Pattern shown in Code Examples section. The home page (`src/app/page.tsx`) demonstrates this — line 44: `<Suspense><HomePageContent /></Suspense>`.

**Warning signs:** Next.js console warning "No Suspense boundary found" or TypeScript error about `useSearchParams`.

### Pitfall 2: Invalid Tab Value in URL

**What goes wrong:** User manually edits URL to `?tab=foo` — the Tabs component receives an unknown value and renders nothing or crashes.

**Why it happens:** shadcn Tabs `value` must match one of the `TabsTrigger` values exactly.

**How to avoid:** Validate the `tab` param against `VALID_TABS` constant. Fall back to `"overview"` if the value is not in the allowed list (see Pattern 2 example).

### Pitfall 3: Membership Check Misaligned with Layout Check

**What goes wrong:** Layout confirms user is `club_organizer` globally, but page does NOT confirm they have a `club_members` row for this specific club. A `club_organizer` who is a member of club A visiting `/my-clubs/club-B` would see the dashboard.

**Why it happens:** The layout only checks `users.roles` (global `club_organizer`), not per-club membership.

**How to avoid:** The page MUST query `club_members` where `club_id = id AND user_id = auth.uid()`. If no row found, call `notFound()`. This is shown in Pattern 1.

### Pitfall 4: `start_date` vs `event_date` Field Name

**What goes wrong:** Events tab displays undefined dates.

**Why it happens:** The `Event` type in `src/types/index.ts` has `event_date: string` and `event_time: string`. However, the `GET /api/clubs/[id]/events` route orders by `start_date` (line 77: `.order("start_date", { ascending: false })`). The DB column and type may use different names.

**How to avoid:** When rendering event rows in the Events tab, use `event.event_date` (the TypeScript type field), not `event.start_date`. Verify against actual API response in development.

### Pitfall 5: params is a Promise in Next.js 16

**What goes wrong:** TypeScript error or runtime error accessing `params.id` directly.

**Why it happens:** Next.js 16 (used by this project) made `params` and `searchParams` async Promises in App Router page components.

**How to avoid:** Always `await params` and `await searchParams` in server components. Pattern shown in Pattern 1 example. This project already follows this pattern — see `src/app/api/clubs/[id]/events/route.ts` line 22: `const { id: clubId } = await params;`.

---

## Code Examples

### shadcn Tabs Component (after installation)

```typescript
// Source: shadcn/ui official docs — https://ui.shadcn.com/docs/components/tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account" className="w-[400px]">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Make changes to your account here.</TabsContent>
  <TabsContent value="password">Change your password here.</TabsContent>
</Tabs>
```

### Controlled Tabs with URL State

```typescript
// Pattern verified from Next.js App Router docs (useSearchParams pattern)
// Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params
"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// Reading current tab:
const searchParams = useSearchParams();
const activeTab = searchParams.get("tab") ?? "overview";

// Writing tab change (replace to avoid history pollution):
const router = useRouter();
const pathname = usePathname();
const handleTabChange = (value: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", value);
  router.replace(`${pathname}?${params.toString()}`);
};
```

### Server Component Role Resolution

```typescript
// Pattern from existing codebase: src/app/moderation/layout.tsx + src/app/events/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

// Parallel queries to avoid waterfall:
const [{ data: club }, { data: membership }] = await Promise.all([
  supabase.from("clubs").select("*").eq("id", id).single(),
  supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .single(),
]);

if (!club || !membership) notFound();
const role = membership.role as "owner" | "organizer";
```

### Events Tab API Call

```typescript
// Consumes existing GET /api/clubs/[id]/events (src/app/api/clubs/[id]/events/route.ts)
// Returns: { events: Event[] }
const res = await fetch(`/api/clubs/${clubId}/events`);
const { events } = await res.json();
// Event fields available: id, title, event_date, event_time, status, location, tags
```

### Create Event Link with clubId Pre-fill (DASH-06)

```typescript
// CreateEventForm already accepts clubId prop (src/components/events/CreateEventForm.tsx:54-58)
// Option A: Navigation link from Events tab
<Link href={`/create-event?clubId=${clubId}`}>
  <Button>Create Event</Button>
</Link>

// Option B: create-event/page.tsx reads searchParams (requires updating that page)
// src/app/create-event/page.tsx currently uses "use client" + useAuthStore
// Must add: searchParams prop read or useSearchParams() to extract clubId
// Then pass: <CreateEventForm clubId={clubId} />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `router.query` for URL state | App Router `useSearchParams()` + `router.replace` | Next.js 13+ | Different import; requires Suspense boundary |
| `params.id` synchronous access | `await params` (Promise) | Next.js 15/16 | Must await in server components; already used in this codebase |
| Static shadcn tab install via `npx shadcn-ui@latest` | `npx shadcn@latest add tabs` | shadcn v2+ | CLI changed from `shadcn-ui` to `shadcn`; `components.json` already configured |

**Deprecated/outdated:**
- `npx shadcn-ui@latest`: Old CLI name. Current project uses `shadcn` (no `-ui`). `components.json` confirms project is set up correctly.

---

## Open Questions

1. **Does `create-event/page.tsx` need to be updated for DASH-06?**
   - What we know: `CreateEventForm` accepts `clubId` prop and already uses it in the insert payload. `create-event/page.tsx` is a client component using `useAuthStore` — it does NOT currently read `?clubId=` from URL.
   - What's unclear: DASH-06 says "navigates to `/create-event` with the club pre-selected." Does "pre-selected" mean the URL pre-populates the club, or just that the form shows a club selector with that club selected?
   - Recommendation: Update `create-event/page.tsx` to read `useSearchParams().get("clubId")` and pass to `<CreateEventForm clubId={clubId} />`. The link from the Events tab uses `href={/create-event?clubId=${id}}`. This satisfies DASH-06 without structural changes to `CreateEventForm`.

2. **Member count for Overview tab (DASH-04): server-side or client-side?**
   - What we know: DASH-04 requires member count in the Overview tab. The server component already fetches `club_members` (for the single-user membership check). Member count needs a COUNT query.
   - What's unclear: Whether to fetch count server-side (add to the `Promise.all`) or client-side in the Overview tab component.
   - Recommendation: Add member count to the server-side `Promise.all` using `.count()` modifier: `supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", id)`. Pass `memberCount` as prop. Avoids an extra client-side fetch.

3. **Pending invites count (DASH-04, owner-only): same question**
   - What we know: DASH-04 says owners see "pending invites count." `club_invitations` table exists from Phase 5.
   - What's unclear: Should this be fetched server-side alongside club data, or lazy-loaded in the Overview tab?
   - Recommendation: Fetch server-side only if `role === "owner"` using an additional `Promise.all` branch. Pass `pendingInvitesCount` prop (null for organizers). This avoids exposing invitation data to organizers who lack the SELECT policy.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection:
  - `src/app/my-clubs/layout.tsx` — existing auth gate pattern
  - `src/app/moderation/layout.tsx` + `ModerationNav.tsx` — server component auth + client nav pattern
  - `src/app/api/clubs/[id]/events/route.ts` — existing events endpoint (confirmed working)
  - `src/components/events/CreateEventForm.tsx` — confirmed `clubId` prop at line 54
  - `src/app/events/[id]/page.tsx` — server component with `await params` pattern
  - `src/app/page.tsx` — `useSearchParams` + `<Suspense>` pattern in use
  - `src/types/index.ts` — `Club`, `ClubMember` type definitions
  - `package.json` — confirms `@radix-ui/react-tabs` NOT installed
  - `components.json` — confirms shadcn config, style: "default", rsc: true
- `node_modules/@radix-ui/` listing — confirmed `react-tabs` absent
- `src/components/ui/` listing — confirmed `tabs.tsx` absent

### Secondary (MEDIUM confidence)

- shadcn/ui documentation pattern for Tabs component (https://ui.shadcn.com/docs/components/tabs) — CLI install command verified against project's `components.json` setup
- Next.js App Router `useSearchParams` Suspense requirement — consistent with project's own use in `src/app/page.tsx:44`

### Tertiary (LOW confidence)

- None — all critical claims verified against the codebase directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed packages and project files
- Architecture: HIGH — patterns derived directly from existing codebase conventions
- Pitfalls: HIGH — `params` async pattern already in use; `useSearchParams`/Suspense confirmed in `page.tsx`
- DASH-06 create-event pre-fill: MEDIUM — requires updating `create-event/page.tsx` which currently doesn't read `searchParams`; CreateEventForm prop confirmed

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable stack; Next.js/shadcn patterns unlikely to change in 30 days)
