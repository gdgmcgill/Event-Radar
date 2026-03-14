# Club Organizer Experience — Tier 1 Design

## Context

Club organizers are the backbone of Uni-Verse. Without them posting events, the platform has no content and no viral loop on campus. Their experience must be exceptional. Today, the backend for clubs exists (CRUD, members, invites, analytics, RSVPs) but the UI is either basic or missing entirely.

### Organizer Pain Points (McGill-specific)

1. **No reliable headcount** — RSVPs on Facebook/Instagram are meaningless. Organizers can't order food, book rooms, or plan speakers without knowing if 5 or 50 people are coming.
2. **Member reach is fragmented** — Some members are on Instagram, some Discord, some email. No single channel, no way to know who saw the announcement.
3. **No engagement visibility** — Can't tell the difference between someone who attended 10 events vs. someone who followed but never came.
4. **Broken feedback loop** — No structured way to collect post-event feedback or demonstrate impact for funding applications.
5. **Institutional memory dies annually** — Every exec turnover loses knowledge of what worked, who's active, and what partnerships exist.

### Scope

**Tier 1 (this spec):** UI on top of existing backend data — club creation, polished dashboard, RSVP visibility, member engagement stats, "My Clubs" tab.

**Tier 2 (future):** Segmented announcements, funding/impact export, event feedback collection, ownership transfer, RSVP accuracy tracking.

**Cut:** Club Knowledge Base — only revisit if organizers explicitly request it.

---

## 1. Navigation & Entry Points

### `/clubs` Page

- **"My Clubs" tab** — Only renders when `hasClubs === true` from auth store. Regular users (95%) see only the discovery view.
- **Hero button logic:**
  - Not authenticated → hidden
  - Authenticated, no clubs (`hasClubs === false`) → hidden
  - Authenticated, has clubs (`hasClubs === true`) → "My Clubs" button, navigates to My Clubs tab
- **"Don't see your club?" CTA** — Stays as-is. "Register Your Club" button links to `/clubs/create`.

### Sidebar Navigation

- "My Clubs" link (existing) continues to show under "Organizer" section when `hasClubs === true`
- Single club: sidebar link navigates directly to `/my-clubs/[clubId]` (dashboard)
- Multiple clubs: sidebar link navigates to `/clubs` with My Clubs tab active
- Implementation: the existing `/my-clubs/page.tsx` server component handles this redirect logic already (single club → dashboard, multiple → list). Update it to redirect multi-club users to `/clubs?tab=my-clubs` instead of rendering its own list.

---

## 2. Club Creation Flow (`/clubs/create`)

### Approach: Minimal + Completion Nudge

Low friction to get started. Club goes to `pending` status for admin approval, giving organizers time to polish during the review period.

### Form (single page)

| Field | Required | Notes |
|-------|----------|-------|
| Club name | Yes | Text input, max 100 chars |
| Description | Yes | Textarea, max 500 chars |
| Category | Yes | Dropdown from existing club categories |
| Logo | No | Image upload via existing `POST /api/clubs/logo` endpoint, with placeholder preview |
| Instagram handle | No | Text input with @ prefix |

### On Submit

1. Upload logo if provided (via `POST /api/clubs/logo`)
2. Create club with `status: pending` (via new `POST /api/clubs`)
3. Backend handles: insert `club_members` row with `role: owner`, add `club_organizer` to user's `roles` array using service client (bypasses RLS since users cannot modify their own roles)
4. Client-side: call `updateUser({ roles: [...roles, 'club_organizer'] })` and set `hasClubs: true` in auth store
5. Redirect to confirmation view:
   - "Your club is under review! We'll notify you when it's approved."
   - Link back to `/clubs`

### Post-Creation

The dashboard becomes accessible immediately (even while pending). Organizer can complete their club profile, invite co-organizers, and draft events while waiting for approval.

---

## 3. My Clubs Tab (within `/clubs`)

### Single Club

Auto-redirect to `/my-clubs/[clubId]` (dashboard). No intermediate list.

### Multiple Clubs

Card grid layout. Each card shows:
- Club logo (or letter placeholder)
- Club name
- Role badge: "President" (db value: `owner`) or "Organizer" (db value: `organizer`)
- Quick stats: follower count, upcoming event count (requires enhancing `GET /api/my-clubs` — see Section 7)
- Status badge if pending/rejected
- Click → navigates to `/my-clubs/[clubId]`

---

## 4. Club Dashboard (`/my-clubs/[id]`)

### Layout

Sidebar navigation with tabs. Polished UI matching the quality of homepage/calendar.

### Completion Nudge (persistent, shown on Overview)

A progress indicator that is specific and compelling, not generic:

- **Progress ring/bar** showing % complete (e.g., "Your club is 40% complete")
- **Each missing item has a specific benefit statement:**
  - "Add a logo — clubs with logos get 3x more followers"
  - "Write a description — help students understand what you're about"
  - "Link your Instagram — let members find you on social"
  - "Invite a co-organizer — teams that share the load post 2x more events"
  - "Create your first event — start building your audience"
- **Each item is clickable** — links directly to the action (settings tab for logo, create event modal, etc.)
- **Disappears at 100%** or can be manually dismissed
- **Persists across sessions** until completed — not a one-time toast

### Completion Criteria

| Item | Check |
|------|-------|
| Logo uploaded | `club.logo_url` is not null |
| Description filled | `club.description` length > 50 chars |
| Instagram linked | `club.instagram_handle` is not null |
| Co-organizer invited | `club_members` count > 1 OR at least 1 pending invitation (fetched via new `GET /api/clubs/[id]/invites`) |
| First event created | At least 1 event exists for this club |

### Overview Tab (default landing)

Adapts to club maturity:

**New club (no events yet):**
- Welcome message: "Welcome to [Club Name]'s dashboard"
- Completion nudge (prominent placement)
- Quick action buttons: Create Event, Invite Organizer, Edit Settings

**Established club:**
- **Completion nudge** (if not 100%, shown at top but less prominent)
- **Next upcoming event card** — Event name, date/time (uses `event_date` field), countdown ("in 3 days"), RSVP breakdown:
  - Going (green) / Interested (amber) / Cancelled (muted)
  - Total headcount number displayed prominently
  - If cancellations > 0, show subtle churn indicator (e.g., "3 dropped")
- **Quick stats row** — 3-4 metric cards:
  - Total followers
  - Events hosted (all time)
  - Avg RSVPs per event (computed client-side from events data)
  - New followers this month (computed from `follower_growth` in analytics endpoint)
- **Recent activity feed** — Last 5-10 items:
  - "X started following your club"
  - "X RSVP'd Going to [Event]"
  - "X joined as organizer"
  - Sourced from existing `user_interactions` + `rsvps` + `club_followers` data
- **Quick actions** — "Create Event" and "Invite Organizer" buttons

### Events Tab

- **Create Event button** — Opens event creation with `clubId` pre-filled
- **Upcoming events** — Card list:
  - Event name, `event_date`, time, location
  - Status badge (pending / approved / rejected) with color coding
  - RSVP breakdown: going / interested / cancelled counts
  - Actions: Edit, Duplicate, Delete
- **Past events** — Collapsed section, expandable:
  - Same card format but with final attendance numbers
  - "X people attended" summary
- **Empty state** — "No events yet. Create your first event to start building your audience." with CTA button

### Members Tab

Visible to all club members (owners and organizers can both view). Management actions are owner-only.

- **Member list:**
  - Avatar, name, email
  - Role badge: "President" (`owner`) / "Organizer" (`organizer`)
  - Date joined
  - Owner can remove organizers (not self) — remove button only shown for owner
- **Invite section (owner-only):**
  - McGill email input
  - Generates invitation token link (7-day expiry) via `POST /api/clubs/[id]/invites`
  - Show pending invitations with status and ability to revoke (requires new `GET /api/clubs/[id]/invites`)
- **Empty state** — "You're running this solo! Invite a co-organizer to share the workload."

### Analytics Tab

- **Follower growth** — Line chart showing followers over time (from analytics endpoint `follower_growth`)
- **Event performance table** — Per-event breakdown:
  - Event name, date
  - RSVPs: going / interested / cancelled (from analytics endpoint `events` array)
  - Churn rate per event: cancelled / (going + interested + cancelled) as percentage
  - Engagement score (from `user_interactions`)
- **Popular tags** — Which event categories perform best (from analytics endpoint `popular_tags`)
- **RSVP churn trend** — Average drop-off rate across all events over time, so organizers can spot if churn is improving or worsening
- **Member engagement summary** — Aggregate stats only, not per-user tracking:
  - Total interactions this month
  - Most popular event types
  - (Note: per-member engagement ranking requires analytics API enhancement — Tier 2)
- **Empty state** — "Host your first event to start seeing analytics."

### Settings Tab (owner-only)

- **Edit club details:**
  - Name, description, category
  - Logo upload/change (via `POST /api/clubs/logo`)
  - Instagram handle
- **Danger zone (future, Tier 2):**
  - Transfer ownership
  - Delete club

---

## 5. RSVP Visibility

The #1 organizer pain point — headcount must be impossible to miss:

- **Every event card** (in Events tab, Overview, Analytics) shows RSVP breakdown with color-coded counts
- **Overview tab** highlights next event's RSVP count as the most prominent number on the page
- **Color coding consistent:**
  - Going → green
  - Interested → amber
  - Cancelled → muted/gray
- **Backend change required:** The existing events endpoint (`GET /api/clubs/[id]/events`) and analytics endpoint currently exclude cancelled RSVPs from counts. Both need to be updated to also return `cancelled_count` so organizers can see churn.

---

## 6. UI Standards

All components must match the polish level of homepage/calendar/notifications:

- Glass morphism cards consistent with app design system
- Smooth tab transitions
- Loading skeletons for all async data
- Empty states with helpful illustrations and CTAs
- Dark mode support throughout
- Responsive: works on mobile (organizers check their phone between classes)
- Subtle animations on interactions (hover states, button presses)

---

## 7. Backend Changes Required

### New Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/clubs` | Create a new club. Accepts name, description, category, logo_url, instagram_handle. Uses **service client** to: insert club with `status: pending`, insert `club_members` with `role: owner`, add `club_organizer` to user's `roles` array. |
| `GET /api/clubs/[id]/invites` | List pending invitations for a club. Owner-only. Returns invitation records with status, invitee email, created date, expiry. Needed for: completion criteria check, Members tab pending invites list. |

### Endpoint Enhancements

| Endpoint | Change |
|----------|--------|
| `GET /api/my-clubs` | Add `follower_count` and `upcoming_event_count` to response. Currently returns only member count. Needed for My Clubs card grid. |
| `GET /api/clubs/[id]/events` | Add `cancelled_count` to RSVP data in response. Currently only counts `going` and `interested`. Needed for churn visibility. |
| `GET /api/clubs/[id]/analytics` | Include cancelled RSVPs in per-event metrics (currently filtered out with `.neq("status", "cancelled")`). Add aggregate churn rate across events. |

### Known Schema Notes

- The RSVP table is named `rsvps` in the database (not `event_rsvps` as referenced in CLAUDE.md). All API routes already use the correct name.
- Event date field is `event_date` in the `Event` type (`src/types/index.ts`). The existing clubs events route sorts by `start_date` which may need to be corrected to `event_date`.

---

## 8. Files to Create/Modify

### New Files
- `src/app/clubs/create/CreateClubForm.tsx` — Club creation form component
- `src/app/api/clubs/route.ts` — Add POST handler (GET already exists in this file)
- `src/app/api/clubs/[id]/invites/route.ts` — Add GET handler (POST already exists)

### Modified Files
- `src/app/clubs/create/page.tsx` — Replace placeholder, import and render `CreateClubForm`
- `src/app/clubs/page.tsx` or clubs client component — Add "My Clubs" tab (conditional on `hasClubs`), hero button logic
- `src/app/my-clubs/page.tsx` — Update multi-club redirect to `/clubs?tab=my-clubs`
- `src/app/api/my-clubs/route.ts` — Add follower_count and upcoming_event_count to response
- `src/components/clubs/ClubDashboard.tsx` — Full UI polish, add completion nudge logic
- `src/components/clubs/ClubOverviewTab.tsx` — Smart overview with completion nudge, activity feed
- `src/components/clubs/ClubEventsTab.tsx` — Polish + RSVP visibility, wire up delete handler
- `src/components/clubs/ClubMembersTab.tsx` — Polish, show to all members, restrict actions to owner
- `src/components/clubs/ClubAnalyticsTab.tsx` — Polish with existing analytics data
- `src/components/clubs/ClubSettingsTab.tsx` — Polish
