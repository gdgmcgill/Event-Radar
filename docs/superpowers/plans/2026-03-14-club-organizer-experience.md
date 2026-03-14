# Club Organizer Experience — Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished club organizer experience — club creation, dashboard UI overhaul, RSVP/churn visibility, completion nudge, and "My Clubs" tab on the clubs page.

**Architecture:** Backend-first for new endpoints (club creation POST, invites GET, RSVP cancelled counts), then UI work top-down: clubs page entry points → creation flow → dashboard tabs. Each dashboard tab is an independent unit that can be polished in parallel.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, SWR, Recharts, Supabase (service client for role mutations)

**Spec:** `docs/superpowers/specs/2026-03-13-club-organizer-experience-design.md`

---

## Chunk 1: Backend — New Endpoints, Type Fixes & Enhancements

### Task 1: Update TypeScript Types for New Response Fields

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `rsvp_cancelled` to `EventAnalytics` type**

In `src/types/index.ts`, find the `EventAnalytics` interface (around lines 269-279). Add `rsvp_cancelled: number` alongside the existing `rsvp_going` and `rsvp_interested` fields.

- [ ] **Step 2: Fix `ClubInvitation` type to match DB schema**

The `ClubInvitation` interface (around lines 96-105) has `accepted_at` but no `status` field. The DB table has `status` but no `accepted_at`. Update the type to match the actual DB schema:

```typescript
export interface ClubInvitation {
  id: string;
  club_id: string;
  inviter_id: string;
  invitee_email: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "fix(types): align ClubInvitation and EventAnalytics types with DB schema"
```

---

### Task 2: POST /api/clubs — Club Creation Endpoint

**Files:**
- Modify: `src/app/api/clubs/route.ts` (add POST handler alongside existing GET)

- [ ] **Step 1: Add imports**

At the top of the file, add `NextRequest` to the `next/server` import, and add `import { createServiceClient } from "@/lib/supabase/service"`.

- [ ] **Step 2: Write the POST handler**

Add to the existing `route.ts` file after the GET handler:

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, category, logo_url, instagram_handle } = body;

  // Name, description, and category are all required per spec
  if (!name || !description || !category) {
    return NextResponse.json(
      { error: "Name, description, and category are required" },
      { status: 400 }
    );
  }

  if (name.length > 100 || description.length > 500) {
    return NextResponse.json(
      { error: "Name max 100 chars, description max 500 chars" },
      { status: 400 }
    );
  }

  // Use service client to bypass RLS for role mutation
  const serviceClient = createServiceClient();

  // 1. Create the club
  const { data: club, error: clubError } = await serviceClient
    .from("clubs")
    .insert({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      logo_url: logo_url || null,
      instagram_handle: instagram_handle?.trim() || null,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (clubError) {
    return NextResponse.json({ error: "Failed to create club" }, { status: 500 });
  }

  // 2. Add creator as owner
  await serviceClient
    .from("club_members")
    .insert({ user_id: user.id, club_id: club.id, role: "owner" });

  // 3. Add club_organizer role if not already present
  const { data: profile } = await serviceClient
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const currentRoles = (profile?.roles as string[]) || ["user"];
  if (!currentRoles.includes("club_organizer")) {
    await serviceClient
      .from("users")
      .update({ roles: [...currentRoles, "club_organizer"] })
      .eq("id", user.id);
  }

  return NextResponse.json(club, { status: 201 });
}
```

- [ ] **Step 3: Test manually**

```bash
npm run build
```

Verify no type errors. Manual test: POST to `/api/clubs` with a valid body and auth token.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clubs/route.ts
git commit -m "feat(api): add POST /api/clubs for club creation"
```

---

### Task 3: GET /api/clubs/[id]/invites — List Pending Invitations

**Files:**
- Modify: `src/app/api/clubs/[id]/invites/route.ts` (add GET handler alongside existing POST)

- [ ] **Step 1: Write the GET handler**

Add before the existing POST handler:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check ownership
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const { data: invites, error } = await supabase
    .from("club_invitations")
    .select("id, invitee_email, status, created_at, expires_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }

  return NextResponse.json(invites);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/clubs/[id]/invites/route.ts
git commit -m "feat(api): add GET /api/clubs/[id]/invites for pending invitations"
```

---

### Task 4: Enhance GET /api/my-clubs — Add Follower & Event Counts

**Files:**
- Modify: `src/app/api/my-clubs/route.ts`

- [ ] **Step 1: Add follower_count and upcoming_event_count queries**

The existing code (lines 39-54) uses a pattern of bulk club fetch + parallel member count queries assembled via Maps. Extend this pattern by adding two more parallel count queries per club: `club_followers` count and upcoming `events` count (where `status = 'approved'` and `event_date >= now`).

Add `followerCount` and `upcomingEventCount` to each membership object in the response alongside the existing `memberCount`.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/my-clubs/route.ts
git commit -m "feat(api): add follower and upcoming event counts to my-clubs endpoint"
```

---

### Task 5: Enhance Club Events & Analytics — Add Cancelled RSVP Counts + Fix Sort Field

**Files:**
- Modify: `src/app/api/clubs/[id]/events/route.ts`
- Modify: `src/app/api/clubs/[id]/analytics/route.ts`

- [ ] **Step 1: Fix `start_date` → `event_date` sort in events endpoint**

In `src/app/api/clubs/[id]/events/route.ts` (around line 47), the query sorts by `start_date`. Change this to `event_date` to match the `Event` TypeScript type. Both columns exist in the DB but `event_date` is the canonical field exposed in the type system.

Note: The UI components (`ClubOverviewTab.tsx`, `ClubEventsTab.tsx`) also reference `start_date` via local `EventWithRsvp` interfaces. These will be fixed in the UI tasks (Tasks 10-11) to use `event_date` instead.

- [ ] **Step 2: Update events endpoint to include cancelled count**

In the RSVP aggregation section (around lines 74-86), add counting for `cancelled` status alongside `going` and `interested`. The current code groups RSVPs by status — add `cancelled` to the status counts returned in the response.

- [ ] **Step 3: Update analytics endpoint to include cancelled in per-event metrics**

In the analytics endpoint at line 169, remove the `.neq("status", "cancelled")` filter so cancelled RSVPs are included in per-event breakdowns. Add a `rsvp_cancelled` count field to each event's analytics object.

Note: Keep the `totalAttendees` query (line 101-105) as going-only — "total attendees" correctly represents people who actually committed to attend, not those who cancelled.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clubs/[id]/events/route.ts src/app/api/clubs/[id]/analytics/route.ts
git commit -m "feat(api): fix event sort field, include cancelled RSVP counts"
```

---

## Chunk 2: Club Creation Flow

### Task 6: Create Club Form Component

**Files:**
- Create: `src/app/clubs/create/CreateClubForm.tsx`
- Modify: `src/app/clubs/create/page.tsx`

- [ ] **Step 1: Create the CreateClubForm component**

Build a polished single-page form with:
- Club name input (required, max 100)
- Description textarea (required, max 500)
- Category dropdown using the existing club categories from the codebase
- Logo upload (optional) — use the existing `POST /api/clubs/logo` endpoint
- Instagram handle input with @ prefix
- Submit button with loading state
- Form validation with inline error messages

**Styling:** Match the polish of the existing clubs page — use the same card style, red-600 primary color, rounded-xl corners, shadows. Reference the existing `ClubSettingsTab.tsx` (lines 92-141) for the logo upload pattern and form field patterns.

**On submit:**
1. Upload logo if provided via `POST /api/clubs/logo`
2. POST to `/api/clubs` with form data
3. On success: update auth store (`updateUser` to add role, set `hasClubs: true`)
4. Show confirmation state: "Your club is under review!" with link back to `/clubs`

- [ ] **Step 2: Update page.tsx to render the form**

Replace the placeholder in `src/app/clubs/create/page.tsx` with:
- A hero/header section: "Register Your Club" title, subtitle about review process
- The `CreateClubForm` component
- Consistent page layout matching other app pages

- [ ] **Step 3: Test the flow manually**

```bash
npm run dev
```

Navigate to `/clubs/create`, fill out the form, submit. Verify:
- Club appears in database with status `pending`
- User gets `club_organizer` role
- Redirect to confirmation works

- [ ] **Step 4: Commit**

```bash
git add src/app/clubs/create/
git commit -m "feat(clubs): implement club creation form with logo upload"
```

---

## Chunk 3: Clubs Page — My Clubs Tab & Hero Logic

### Task 7: Add My Clubs Tab to /clubs Page

**Files:**
- Modify: `src/app/clubs/page.tsx` (lines 1-402)

- [ ] **Step 1: Add a client-side tab wrapper component**

The current `/clubs/page.tsx` is server-rendered with pagination, search, and data fetching. Do NOT convert the whole page to a client component — that would lose SSR benefits.

Instead, create a `src/components/clubs/ClubsPageTabs.tsx` client component that:
- Wraps the existing page content as the "Discover" tab (passed as `children`)
- Reads `hasClubs` from `useAuthStore` to conditionally show a "My Clubs" tab
- Reads `?tab=my-clubs` search param via `useSearchParams()` to default tab
- When "My Clubs" tab is active, hides children and renders the My Clubs content (see Step 2)
- When "Discover" is active, shows children (the existing server-rendered content)

In `src/app/clubs/page.tsx`, wrap the existing JSX body with `<ClubsPageTabs>...</ClubsPageTabs>`. The server component continues to fetch data as before — the tabs just control visibility.

- [ ] **Step 2: Build the My Clubs tab content**

When "My Clubs" tab is active:
- Fetch clubs via `useMyClubs()` hook
- Single club: auto-redirect to `/my-clubs/[clubId]`
- Multiple clubs: render card grid with:
  - Club logo (or letter placeholder with primary/10 bg)
  - Club name
  - Role badge: "President" (for `owner`) / "Organizer" (for `organizer`)
  - Stats: follower count, upcoming event count (from enhanced endpoint)
  - Status badge if pending/rejected
  - Click navigates to `/my-clubs/[clubId]`

Card styling: match existing club cards on the page but add the role badge and stats.

- [ ] **Step 3: Update hero button logic**

The hero section (around lines 148-188) currently has a "Start a Club" button. This needs client-side conditional rendering, so extract it into a small client component (e.g., `ClubsHeroButton.tsx`) or handle it within `ClubsPageTabs`:
- If not authenticated → hide the button
- If `hasClubs === false` → hide the button (the "Register Your Club" CTA further down the page handles discovery)
- If `hasClubs === true` → show "My Clubs" button that switches to the My Clubs tab

- [ ] **Step 4: Update sidebar redirect**

Modify `src/app/my-clubs/page.tsx`: for multiple clubs, redirect to `/clubs?tab=my-clubs` instead of rendering `MyClubsList`.

- [ ] **Step 5: Commit**

```bash
git add src/app/clubs/ src/app/my-clubs/page.tsx
git commit -m "feat(clubs): add conditional My Clubs tab and hero button logic"
```

---

**Important note for all UI tasks (Chunks 4-5):** Use semantic Tailwind colors from the start — `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, etc. — instead of hardcoded `bg-white`, `text-slate-500`, etc. This prevents dark mode issues and reduces the work needed in the final dark mode pass (Task 15).

## Chunk 4: Dashboard — Layout & Overview Tab

### Task 8: Polish Dashboard Layout & Completion Nudge

**Files:**
- Modify: `src/components/clubs/ClubDashboard.tsx` (lines 1-209)

- [ ] **Step 1: Polish the sidebar**

The current sidebar (lines 97-150) uses basic styling. Update to match the app's polished look:
- Glass morphism background on sidebar
- Smooth hover transitions on tab items
- Active tab indicator with primary color
- Club logo in sidebar header with subtle shadow
- Role display refined ("President" / "Organizer")

- [ ] **Step 2: Polish the header**

Update the header section (lines 155-179):
- Club name with gradient or bold styling
- Status badge (pending/approved) next to name
- Quick action buttons refined with proper icons

- [ ] **Step 3: Commit**

```bash
git add src/components/clubs/ClubDashboard.tsx
git commit -m "style(clubs): polish dashboard layout, sidebar, and header"
```

---

### Task 9: Completion Nudge Component & useClubInvites Hook

**Files:**
- Create: `src/components/clubs/ClubCompletionNudge.tsx`

- [ ] **Step 1: Build the completion nudge component**

Props: `club: Club`, `memberCount: number`, `eventCount: number`, `pendingInviteCount: number`, `onNavigate: (tab: string) => void`

Compute completion percentage from 5 criteria:
1. Logo uploaded (`club.logo_url !== null`) → 20%
2. Description filled (`club.description && club.description.length > 50`) → 20%
3. Instagram linked (`club.instagram_handle !== null`) → 20%
4. Co-organizer invited (`memberCount > 1 || pendingInviteCount > 0`) → 20%
5. First event created (`eventCount > 0`) → 20%

UI:
- Progress ring or bar showing percentage
- Headline: "Your club is X% complete"
- Subtitle with benefit: "Members who see a logo, description, and social link are 3× more likely to follow."
- Checklist of incomplete items, each with:
  - Icon (check for complete, circle for incomplete)
  - Item name
  - Specific benefit text
  - Click action (link to settings tab, create event, etc.)
- Completed items shown with green check and strikethrough
- Dismissible when 100% (or manually via X button)

Styling: Card with subtle gradient border, matches app design system.

- [ ] **Step 2: Add `useClubInvites` SWR hook**

Add to `src/hooks/useClubs.ts`:

```typescript
export function useClubInvites(clubId: string | undefined) {
  return useSWR(clubId ? `/api/clubs/${clubId}/invites` : null, fetcher);
}
```

This hook is created here (before Tasks 10-12) because both the completion nudge and the Members tab need it.

- [ ] **Step 3: Commit**

```bash
git add src/components/clubs/ClubCompletionNudge.tsx src/hooks/useClubs.ts
git commit -m "feat(clubs): add completion nudge component and useClubInvites hook"
```

---

### Task 10: Overhaul Overview Tab

**Files:**
- Modify: `src/components/clubs/ClubOverviewTab.tsx` (lines 1-315)

- [ ] **Step 1: Add completion nudge integration**

Import `ClubCompletionNudge` and render at top of overview. Pass club data, member count, and event count.

For new clubs (0 events): make the nudge the primary content with prominent placement and quick action buttons below.

- [ ] **Step 2: Build the "Next Upcoming Event" card**

Prominent card showing:
- Event name and date with countdown ("in 3 days")
- Large RSVP numbers: Going (green) / Interested (amber) / Cancelled (muted gray)
- Total headcount as the biggest number
- If cancellations > 0: subtle "X dropped" indicator
- Link to event detail

- [ ] **Step 3: Build the quick stats row**

4 metric cards in a responsive grid:
- Total followers (from club follower count)
- Events hosted (total event count)
- Avg RSVPs per event (computed from events data)
- New followers this month (from analytics `follower_growth`)

Each card: icon, value, label, optional trend indicator.

- [ ] **Step 4: Build the recent activity feed**

Last 5-10 items sourced from existing data:
- New followers (from `club_followers` sorted by created_at)
- Recent RSVPs (from `rsvps` for club events)
- New members (from `club_members` sorted by created_at)

Each item: avatar placeholder, action text, timestamp.

Note: This may require a new lightweight API call or composing from existing hooks. If data isn't easily available, show a simplified version with just the stats.

- [ ] **Step 5: Remove mock data and fix `start_date` references**

The current overview tab has hardcoded mock activity data at lines 81-85 (`recentActivities` array) rendered in the JSX at lines 209-241. Replace all mocks with real data from the hooks/API.

Also update any references to `start_date` in this file (lines 33, 61, 181) to use `event_date` instead, matching the `Event` TypeScript type.

- [ ] **Step 6: Commit**

```bash
git add src/components/clubs/ClubOverviewTab.tsx src/components/clubs/ClubCompletionNudge.tsx
git commit -m "feat(clubs): overhaul overview tab with completion nudge and live data"
```

---

## Chunk 5: Dashboard — Events, Members, Analytics, Settings Tabs

### Task 11: Polish Events Tab with RSVP/Churn Visibility

**Files:**
- Modify: `src/components/clubs/ClubEventsTab.tsx` (lines 1-251)

- [ ] **Step 1: Enhance event cards with RSVP breakdown**

Each event card/row should prominently display:
- Going count (green badge)
- Interested count (amber badge)
- Cancelled count (muted gray badge)
- If cancelled > 0: show churn indicator (e.g., "12% drop-off")

- [ ] **Step 2: Wire up the delete handler**

The current delete button (around line 139) has no handler. Wire it to `DELETE /api/clubs/[id]/events/[eventId]` (verify this endpoint exists, create if needed). Add a confirmation dialog before delete.

- [ ] **Step 3: Fix `start_date` references and polish card styling**

Update any references to `start_date` in `ClubEventsTab.tsx` (lines 38, 51, 135) to use `event_date` to match the `Event` TypeScript type.

Update cards to match app design system:
- Status badges with proper color coding (pending=amber, approved=green, rejected=red)
- Hover effects and transitions
- Empty state: "No events yet. Create your first event to start building your audience." with CTA

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/ClubEventsTab.tsx
git commit -m "feat(clubs): polish events tab with RSVP/churn visibility"
```

---

### Task 12: Polish Members Tab

**Files:**
- Modify: `src/components/clubs/ClubMembersTab.tsx` (lines 1-224)
- Modify: `src/components/clubs/ClubDashboard.tsx` (lines 87 and 201)

- [ ] **Step 1: Make visible to all club members**

The owner-only gate is in `ClubDashboard.tsx`, NOT in `ClubMembersTab.tsx`:
- Line 87: the members nav item has `ownerOnly: true` — change to `ownerOnly: false`
- Line 201: the render condition `isOwner && activeTab === "members"` — change to just `activeTab === "members"`

Keep management actions (invite, remove) as owner-only within the tab component itself.

- [ ] **Step 2: Add pending invitations section**

For owners, fetch pending invitations via `GET /api/clubs/[id]/invites` and display:
- Invitee email
- Status (pending/expired)
- Created date
- Revoke button (if pending)

- [ ] **Step 3: Polish member cards**

- Avatar with fallback initial
- Name and email
- Role badge: "President" (green) or "Organizer" (blue)
- Join date
- Remove button (owner-only, not for self)

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/ClubMembersTab.tsx src/components/clubs/ClubDashboard.tsx
git commit -m "feat(clubs): polish members tab, make visible to all members"
```

---

### Task 13: Polish Analytics Tab with Churn Metrics

**Files:**
- Modify: `src/components/clubs/ClubAnalyticsTab.tsx` (lines 1-160)

- [ ] **Step 1: Add churn rate metric**

Add a new summary card: "Avg Drop-off Rate" — computed from cancelled / total RSVPs across events.

- [ ] **Step 2: Add cancelled column to event performance table**

Add a "Cancelled" column alongside Going/Interested. Optionally add a "Churn %" column.

- [ ] **Step 3: Polish chart styling**

- Match chart colors to app theme (use primary red for main line, muted for secondary)
- Add proper tooltips on hover
- Responsive sizing for mobile
- Loading skeletons while data fetches

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/ClubAnalyticsTab.tsx
git commit -m "feat(clubs): add churn metrics and polish analytics tab"
```

---

### Task 14: Polish Settings Tab

**Files:**
- Modify: `src/components/clubs/ClubSettingsTab.tsx` (lines 1-160)

- [ ] **Step 1: Polish form styling**

- Consistent input styling with proper labels and help text
- Logo upload with preview and remove option
- Category as dropdown (using existing categories) instead of free text
- Instagram handle with @ prefix display
- Save button with loading state and success toast

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ClubSettingsTab.tsx
git commit -m "style(clubs): polish settings tab form styling"
```

---

## Chunk 6: Final Integration & Dark Mode

### Task 15: Dark Mode & Responsive Pass

**Files:**
- All club components created/modified above

- [ ] **Step 1: Dark mode audit**

Review all club components for dark mode support:
- Card backgrounds: use `bg-card` or `bg-background` instead of hardcoded whites
- Text colors: use `text-foreground` / `text-muted-foreground`
- Borders: use `border-border`
- Hover states: ensure they work in both modes

- [ ] **Step 2: Mobile responsive audit**

Check all dashboard tabs at mobile breakpoints:
- Sidebar should collapse or become a top nav on mobile
- Cards should stack vertically
- Charts should be scrollable or resize
- Forms should be full-width

- [ ] **Step 3: Loading states**

Ensure every tab has proper skeleton loaders while data fetches. Use shadcn's `Skeleton` component.

- [ ] **Step 4: Commit**

```bash
git add src/components/clubs/
git commit -m "style(clubs): dark mode, responsive, and loading state pass"
```

---

### Task 16: End-to-End Flow Verification

- [ ] **Step 1: Test complete organizer flow**

```bash
npm run dev
```

Walk through the full flow:
1. Go to `/clubs` — verify hero button logic (hidden when no clubs)
2. Click "Register Your Club" CTA → `/clubs/create`
3. Fill out form, submit → verify club created with `pending` status
4. Verify auth store updated (hasClubs, role)
5. Verify "My Clubs" tab now appears on `/clubs`
6. Navigate to dashboard → verify completion nudge shows
7. Check each dashboard tab renders with real data
8. Verify RSVP counts show on event cards
9. Test dark mode toggle across all pages
10. Test on mobile viewport

- [ ] **Step 2: Build check**

```bash
npm run build
npm run lint
```

Fix any type errors or lint warnings.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(clubs): complete club organizer experience Tier 1"
```
