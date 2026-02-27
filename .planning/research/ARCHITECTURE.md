# Architecture Research

**Domain:** Club organizer dashboard — tabbed UI, member management, invite flows, club settings editing
**Researched:** 2026-02-25
**Confidence:** HIGH — based on direct codebase inspection of existing routes, components, and schema

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Page Layer (App Router)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ /my-clubs/[id] │  │  /clubs/[id]     │  │ /create-event   │  │
│  │  (NEW)         │  │ (MODIFY CTAs)    │  │ (MODIFY)        │  │
│  └───────┬────────┘  └────────┬─────────┘  └────────┬────────┘  │
│          │                   │                      │           │
├──────────┴───────────────────┴──────────────────────┴───────────┤
│                    Client Component Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌───────────────┐  ┌───────────────────┐ │
│  │ ClubDashboard    │  │ MemberList    │  │ InviteOrganizer   │ │
│  │ Tabs (NEW)       │  │ (NEW)         │  │ Modal (NEW)       │ │
│  └──────────────────┘  └───────────────┘  └───────────────────┘ │
│  ┌──────────────────┐  ┌───────────────┐  ┌───────────────────┐ │
│  │ ClubSettings     │  │ ClubOverview  │  │ CreateEventForm   │ │
│  │ Form (NEW)       │  │ Tab (NEW)     │  │ (MODIFY — clubId) │ │
│  └──────────────────┘  └───────────────┘  └───────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       API Route Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │ /api/clubs/[id]/members  │  │ /api/clubs/[id]/invites      │  │
│  │ GET, DELETE (NEW)        │  │ POST, GET (NEW)              │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │ /api/clubs/[id] PATCH    │  │ /api/clubs/[id]/events GET   │  │
│  │ (ADD to existing route)  │  │ (EXISTS — use as-is)         │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────┐                                     │
│  │ /api/invites/[token] GET │                                     │
│  │ (NEW — accept invite)    │                                     │
│  └──────────────────────────┘                                     │
├─────────────────────────────────────────────────────────────────┤
│                       Supabase Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ club_members   │  │ clubs        │  │ organizer_invites    │  │
│  │ role: owner |  │  │ editable by  │  │ (NEW TABLE)          │  │
│  │ organizer      │  │ owners only  │  │ token, email,        │  │
│  │ (ADD constraint│  │              │  │ club_id, expires_at, │  │
│  │  via migration)│  │              │  │ status               │  │
│  └────────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `/my-clubs/[id]/page.tsx` | Dashboard shell — resolves user role in club server-side, renders tab container | NEW |
| `ClubDashboardTabs` | URL-param-driven tab switcher for Overview / Events / Members / Settings | NEW |
| `ClubOverviewTab` | Club info summary, upcoming event count, quick-action buttons | NEW |
| `ClubEventsTab` | Club event list with edit links; consumes existing `GET /api/clubs/[id]/events` | NEW |
| `ClubMembersTab` | Member list; remove-member for owners; trigger invite modal | NEW |
| `ClubSettingsTab` | Editable form for name, description, category, Instagram, logo; owner-only | NEW |
| `InviteOrganizerModal` | Email input form; calls `POST /api/clubs/[id]/invites`; returns copy-link URL | NEW |
| `CreateEventForm` | `clubId` prop already exists but is never passed — wire it up from club dashboard | MODIFY |
| `/clubs/[id]/page.tsx` | Add context-aware CTA: hide "Request Organizer Access" for existing members | MODIFY |
| `/create-event/page.tsx` | Add club selector dropdown for organizers with multiple clubs | MODIFY |
| `SideNavBar` / `Header` | Role-based nav items already in place; no change required | NO CHANGE |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── my-clubs/
│   │   ├── page.tsx                         # Existing listing — no change
│   │   └── [id]/
│   │       └── page.tsx                     # NEW — dashboard shell + role resolution
│   ├── clubs/
│   │   └── [id]/
│   │       └── page.tsx                     # MODIFY — context-aware CTAs
│   ├── create-event/
│   │   └── page.tsx                         # MODIFY — club selector for organizers
│   ├── invites/
│   │   └── [token]/
│   │       └── page.tsx                     # NEW — accept invite redirect page
│   └── api/
│       ├── clubs/
│       │   ├── route.ts                     # Existing POST — no change
│       │   └── [id]/
│       │       ├── route.ts                 # MODIFY — add PATCH for settings
│       │       ├── events/
│       │       │   └── route.ts             # EXISTS — no change needed
│       │       ├── members/
│       │       │   └── route.ts             # NEW — GET list, DELETE member
│       │       └── invites/
│       │           └── route.ts             # NEW — POST create, GET pending
│       └── invites/
│           └── [token]/
│               └── route.ts                 # NEW — GET accept invite token
├── components/
│   └── clubs/                               # NEW directory
│       ├── ClubDashboardTabs.tsx
│       ├── ClubOverviewTab.tsx
│       ├── ClubEventsTab.tsx
│       ├── ClubMembersTab.tsx
│       ├── ClubSettingsTab.tsx
│       └── InviteOrganizerModal.tsx
└── supabase/
    └── migrations/
        └── YYYYMMDD_club_organizer_v11.sql  # NEW — role constraint + invites table
```

### Structure Rationale

- **`components/clubs/`:** Mirrors existing `components/events/` directory. All club dashboard components grouped together. Keeps dashboard concerns isolated from shared UI primitives in `components/ui/`.
- **`app/api/clubs/[id]/members/` and `invites/`:** Follows established sub-route pattern — `/api/clubs/[id]/events/` already exists. Avoids query-param-based routing on the base `[id]/route.ts` handler.
- **`app/api/invites/[token]/`:** Separate from clubs API because the token route is accessed by the invitee (not the club owner) and does not fit the owner-scoped `/api/clubs/[id]/...` namespace.
- **Single migration file:** All schema changes (role check constraint, organizer_invites table, auto-grant role update) are atomic and reviewable together.

---

## Architectural Patterns

### Pattern 1: URL-Param Driven Tabs (No useState)

**What:** Active tab stored in URL search param (`?tab=members`), not React state. The page shell reads `searchParams.tab` and passes it to the tab component. Switching tabs is a shallow router push.

**When to use:** Dashboard tabs where bookmarkability and back-button behavior matter. Always prefer this over `useState` for primary navigation structures.

**Trade-offs:** Slightly more boilerplate than useState. Gains shareable URLs, correct browser back behavior, and server-readable initial state.

**Example:**
```typescript
// app/my-clubs/[id]/page.tsx
export default async function ClubDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/my-clubs"); // not a member of this club

  const activeTab = searchParams.tab ?? "overview";
  return <ClubDashboardTabs clubId={params.id} userRole={membership.role} activeTab={activeTab} />;
}
```

### Pattern 2: Role Resolution in Page Shell — One Query, Passed as Prop

**What:** The dashboard page resolves the user's role (owner / organizer / null) server-side via a single membership query. `userRole` is passed as a prop to every tab. Tabs read the prop to conditionally render controls — they do NOT make independent membership checks.

**When to use:** Any route with role-differentiated views. Centralizes authorization in one place per request cycle.

**Trade-offs:** One additional DB query on page load, but eliminates N redundant client-side permission queries across tabs.

**Example:**
```typescript
// ClubMembersTab.tsx — reads prop, does not query membership
export function ClubMembersTab({ clubId, userRole }: { clubId: string; userRole: "owner" | "organizer" }) {
  return (
    <div>
      <MemberList clubId={clubId} />
      {userRole === "owner" && (
        <Button onClick={() => setShowInviteModal(true)}>Invite Organizer</Button>
      )}
    </div>
  );
}
```

### Pattern 3: Session Client for Reads, Service Client for Privileged Writes

**What:** Member list and club event fetches use the session Supabase client (RLS enforced). Invite creation, member removal, and club settings updates use the service client after an explicit ownership check in the API route handler.

**When to use:** Same split already established in this codebase: `createClient()` from `@/lib/supabase/server` for user-scoped reads, `createServiceClient()` for cross-user writes or admin operations.

**Trade-offs:** Service client bypasses RLS entirely — explicit ownership verification in route code is mandatory. This is the correct tradeoff because the API route is the enforcement point.

**Example:**
```typescript
// POST /api/clubs/[id]/invites/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();                          // session client
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership check via RLS-enforced session client
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", params.id)
    .eq("user_id", user.id)
    .single();
  if (membership?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Privileged write via service client
  const serviceClient = createServiceClient();
  const token = crypto.randomUUID();
  const { error } = await serviceClient.from("organizer_invites").insert({
    club_id: params.id,
    email: body.email,
    token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });

  return NextResponse.json({ inviteUrl: `/invites/${token}` });
}
```

### Pattern 4: Token-Based Invite — No Email Infrastructure Required for MVP

**What:** Owner submits an invitee's email. API creates an `organizer_invites` row with a UUID token and returns the invite URL. Owner copies and shares the link manually. Invitee visits `/invites/[token]`, which validates the token and auto-adds them as `organizer` in `club_members`.

**When to use:** Any invite flow where email infrastructure (Resend, SendGrid) is not yet configured. Token link approach works immediately and can be upgraded to email-delivered links in a later milestone.

**Trade-offs:** Owner must copy-paste the invite link for v1.1. Acceptable for the current milestone scope.

---

## Data Flow

### Dashboard Load Flow

```
User visits /my-clubs/[id]
    ↓
Server component: query club_members for user+club (session client, RLS)
    ↓
If no membership → redirect /my-clubs
If membership found → resolve role ("owner" | "organizer")
    ↓
Render ClubDashboardTabs with { clubId, userRole, activeTab }
    ↓
Active tab component mounts → fetches its own data via client-side fetch
```

### Club Settings Edit Flow

```
Owner edits name/description in ClubSettingsTab
    ↓
PATCH /api/clubs/[id]
    ↓ session client: verify caller is owner (RLS membership check)
    ↓ service client: UPDATE clubs SET name=..., description=... WHERE id=...
    ↓
Return updated club row
    ↓
ClubSettingsTab updates local state, shows success toast (shadcn/ui)
```

### Organizer Invitation Flow

```
Owner enters email in InviteOrganizerModal
    ↓
POST /api/clubs/[id]/invites
    ↓ verify caller is owner (session client, RLS)
    ↓ insert into organizer_invites (service client)
    ↓
API returns { inviteUrl: "/invites/[token]" }
    ↓
Modal shows link for owner to copy and share
    ↓
Invitee opens link → GET /api/invites/[token]
    ↓ validate: token exists, not expired, status=pending, email matches user
    ↓ insert into club_members (role: "organizer") via service client
    ↓ update organizer_invites.status = "accepted"
    ↓
Redirect to /my-clubs/[clubId]?tab=overview
```

### Member Removal Flow

```
Owner clicks Remove in ClubMembersTab
    ↓
DELETE /api/clubs/[id]/members/[userId]
    ↓ verify caller is owner (session client, RLS)
    ↓ verify target is not caller (cannot remove yourself)
    ↓ verify target is not another owner (cannot demote owners)
    ↓ delete from club_members (service client)
    ↓
ClubMembersTab: optimistic remove row, re-fetch on error
```

### Auto-Grant Owner on Club Approval (Existing Route, One-Line Fix)

```
Admin approves club → POST /api/admin/clubs/[id] (existing route)
    ↓ CURRENT: club_members.insert({ role: "organizer" })
    ↓ CHANGE TO: club_members.insert({ role: "owner" })
    ↓
Creator is now "owner" — full dashboard access from day one
```

### State Management

No global state store required. Each tab component manages its own fetch-on-mount data lifecycle. The page shell provides `clubId` and `userRole` as props (server-resolved). Tab-level mutations trigger local state re-fetches, matching the existing pattern in `my-clubs/page.tsx`.

---

## New vs Modified — Explicit Inventory

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/app/my-clubs/[id]/page.tsx` | Page (Server Component) | Dashboard shell, role resolution |
| `src/components/clubs/ClubDashboardTabs.tsx` | Component | URL-param tab switcher |
| `src/components/clubs/ClubOverviewTab.tsx` | Component | Overview tab content |
| `src/components/clubs/ClubEventsTab.tsx` | Component | Events tab — wraps existing events API |
| `src/components/clubs/ClubMembersTab.tsx` | Component | Members tab, remove member |
| `src/components/clubs/ClubSettingsTab.tsx` | Component | Settings form, owner-only |
| `src/components/clubs/InviteOrganizerModal.tsx` | Component | Invite modal, returns copy-link |
| `src/app/api/clubs/[id]/members/route.ts` | API Route | GET member list, DELETE member |
| `src/app/api/clubs/[id]/invites/route.ts` | API Route | POST create invite, GET pending invites |
| `src/app/api/invites/[token]/route.ts` | API Route | GET accept invite token |
| `src/app/invites/[token]/page.tsx` | Page | Accept invite — validates token, redirects |
| `supabase/migrations/YYYYMMDD_club_organizer_v11.sql` | Migration | role check constraint, organizer_invites table |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/clubs/[id]/route.ts` | Add PATCH handler for club settings (name, description, category, instagram, logo_url) |
| `src/app/api/admin/clubs/[id]/route.ts` | Change auto-grant role from `"organizer"` to `"owner"` on club approval |
| `src/app/clubs/[id]/page.tsx` | Add context-aware CTA: hide "Request Organizer Access" for existing organizers/owners |
| `src/app/create-event/page.tsx` | Add club selector dropdown for organizers with multiple clubs |
| `src/components/events/CreateEventForm.tsx` | Wire existing `clubId` prop: pre-fill club_id, auto-approve if organizer |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/app/api/clubs/[id]/events/route.ts` | Returns club events for organizers already — no change needed |
| `src/app/my-clubs/page.tsx` | Listing page links to `[id]` already; no change needed |
| `src/components/layout/SideNavBar.tsx` | Role-based nav items already wired |
| `src/lib/supabase/client.ts` + `server.ts` | Client/server split unchanged |

---

## Build Order (Dependency-First)

```
Phase 1 — Database Foundation (everything depends on this)
  1. SQL migration:
     - Add CHECK constraint on club_members.role: ('owner', 'organizer')
     - Create organizer_invites table (id, club_id, email, token, status, expires_at)
     - Add RLS: only club owners can read/write their club's invites
  2. Modify /api/admin/clubs/[id]: role "organizer" → "owner" in auto-grant insert

Phase 2 — Dashboard Shell (other tabs depend on this existing)
  3. /my-clubs/[id]/page.tsx — role resolution + redirect guard
  4. ClubDashboardTabs.tsx — URL-param tab switcher

Phase 3 — Overview + Events Tabs (lowest risk — read-only, existing APIs)
  5. ClubOverviewTab.tsx — static club info display
  6. ClubEventsTab.tsx — wraps existing GET /api/clubs/[id]/events (no new API)

Phase 4 — Members API + Tab
  7. GET + DELETE /api/clubs/[id]/members/route.ts
  8. ClubMembersTab.tsx + InviteOrganizerModal.tsx

Phase 5 — Invite Flow
  9. POST /api/clubs/[id]/invites/route.ts
 10. GET /api/invites/[token]/route.ts
 11. /invites/[token]/page.tsx

Phase 6 — Settings
 12. PATCH /api/clubs/[id]/route.ts
 13. ClubSettingsTab.tsx

Phase 7 — Surface Fixes (isolated, can be done any time after Phase 1)
 14. /clubs/[id] public page — context-aware CTA
 15. /create-event — club selector for organizers
 16. Wire CreateEventForm clubId prop
```

**Rationale:** Database migration is the hard dependency for all role-based logic. Dashboard shell must exist before tabs can be rendered. Events tab uses an existing API (lowest-risk, early confidence win). Members API before invite UI (invite is inside the members tab). Settings last (no upstream dependencies). Surface fixes are isolated and can slip to the end without blocking the core dashboard.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (campus app, ~1K users) | Direct Supabase queries per request — appropriate, no caching layer needed |
| 10K users | Add column pruning to member list queries; paginate ClubEventsTab if clubs have >50 events |
| 100K+ users | Move invite token validation to Supabase Edge Function; cache club membership checks |

### Scaling Priorities

1. **First bottleneck:** Member list and events list both fetched on tab mount. Add `stale-while-revalidate` headers on GET endpoints or adopt React Query with a short TTL.
2. **Second bottleneck:** Logo upload (if added to settings). Use Supabase Storage presigned upload URLs server-side — do not stream large files through Next.js API routes.

---

## Anti-Patterns

### Anti-Pattern 1: Permission Checks Inside Tab Components

**What people do:** Each tab component independently queries `club_members` to check if the current user is an owner before rendering admin controls.

**Why it's wrong:** N redundant DB queries per page load. Permission logic scattered across multiple files. Easy to miss one check and create a privilege escalation path.

**Do this instead:** Resolve role once in the page shell server-side. Pass `userRole` as a prop to all tabs. Tabs only read the prop.

### Anti-Pattern 2: Using Service Client for All Club API Operations

**What people do:** Since some club API routes already use the service client for admin ops, developers reuse it for all operations including reads.

**Why it's wrong:** Bypasses RLS entirely. A bug in ownership validation exposes all clubs' data to any authenticated user.

**Do this instead:** Session client for reads (RLS enforces membership). Service client only for privileged writes — and only after explicit ownership verification in route code.

### Anti-Pattern 3: useState for Tab Navigation

**What people do:** `const [activeTab, setActiveTab] = useState("overview")` — tab state held in React.

**Why it's wrong:** Refreshing the page resets to the default tab. Tabs are not bookmarkable. Back button does not restore the tab the user was on.

**Do this instead:** Store active tab in URL search param (`?tab=members`). Use `router.push` or `<Link>` with shallow routing for tab switches.

### Anti-Pattern 4: Blocking the Invite Feature on Email Infrastructure

**What people do:** Defer the invite feature entirely until a transactional email provider (Resend, SendGrid) is configured and tested.

**Why it's wrong:** Blocks a core v1.1 feature on an infrastructure dependency that can be added progressively.

**Do this instead:** Implement token-based invite with a copy-link UX first. Return the invite URL from the API. Owner copies and shares it. Email delivery is a progressive enhancement for v1.2.

### Anti-Pattern 5: Allowing Owners to Remove Themselves

**What people do:** DELETE `/api/clubs/[id]/members/[userId]` removes any member including the requesting owner.

**Why it's wrong:** Creates clubs with no owner — settings become inaccessible, members cannot be managed, and the club is in an unrecoverable state without admin intervention.

**Do this instead:** API route must check `targetUserId !== requestingUserId` and also verify the target's role is not `"owner"` (or alternatively: only allow one owner removal path via admin). Return 400 with a clear error message.

---

## Integration Points

### Existing APIs Already Ready to Use

| API | Current State | Integration |
|-----|--------------|-------------|
| `GET /api/clubs/[id]/events` | Exists, returns club events for organizers | ClubEventsTab fetches this directly — no changes |
| `PATCH /api/events/[id]` | Exists, checks club membership | ClubEventsTab edit links point to existing edit form |
| `GET /api/my-clubs` | Exists, returns clubs with stats | /my-clubs page listing — no change |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dashboard page shell → Tab components | Props: `clubId`, `userRole`, `club` | Server-resolved role flows down as props; tabs own their own data fetches |
| ClubMembersTab → InviteOrganizerModal | Callback prop `onInviteCreated` | Modal signals parent to refresh pending invite list |
| ClubDashboardTabs → URL | `router.push("?tab=members")` | Shallow push; page shell re-renders with new searchParams.tab |
| CreateEventForm ↔ Club dashboard | `clubId` prop (already defined, not wired) | Wire from ClubEventsTab "Create Event" button — no interface change to the form component |
| Admin approval route → club_members | Direct DB insert with `role: "owner"` | One-line change to existing `/api/admin/clubs/[id]` route |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Session client in API routes — unchanged | No new auth surface |
| Supabase Storage | Logo upload via presigned URL | Defer to v1.2 if logo upload is risky; ship settings without logo field first |
| Email (Resend) | Not required for v1.1 — token URL returned from API | Progressive enhancement for v1.2 |

---

## Sources

- Direct codebase inspection — HIGH confidence (primary source)
  - `src/app/api/clubs/` (existing routes)
  - `src/app/my-clubs/page.tsx` (existing listing, dead `[id]` link confirmed)
  - `src/components/events/CreateEventForm.tsx` (clubId prop confirmed present, not wired)
  - `src/app/api/admin/clubs/` (auto-grant insert confirmed)
  - `.planning/PROJECT.md` v1.1 milestone context
- Next.js App Router `searchParams` pattern for tab state — HIGH confidence (official Next.js docs)
- Supabase RLS + service role client split — HIGH confidence (established pattern in this codebase)

---

*Architecture research for: Club organizer dashboard — Uni-Verse v1.1*
*Researched: 2026-02-25*
