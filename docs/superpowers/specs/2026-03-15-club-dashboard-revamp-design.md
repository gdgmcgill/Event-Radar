# Club Dashboard Revamp — Design Spec

## Problem

The current `/my-clubs/[id]` dashboard has critical UX issues:

1. **Double navigation** — Dashboard renders its own full-screen sidebar+header while AppShell still renders the main nav and footer around it
2. **Footer pinned on top** — Footer is hardcoded above content, constraining the dashboard into a non-scrollable container
3. **No visual identity** — Overview tab shows plain stat cards with no hero section, unlike the polished public `/clubs/[id]` page
4. **Incomplete settings** — Missing banner upload, social links (Discord, Twitter, LinkedIn, Website), and contact email
5. **Basic analytics** — No engagement rate, no activity insights, no peak timing data

## Solution

Revamp the entire `/my-clubs/[id]` page with a hybrid layout, full hero reuse, enhanced analytics, better member management, and complete settings.

## Layout Architecture

### Navigation Model: Hybrid Collapsed Sidebar

- **Desktop**: Main AppShell `SideNavBar` collapses to icon-only rail (72px, matching existing collapsed width). The icon rail shows **AppShell nav items** (Home, Events, Clubs, etc.) — not the dashboard tabs. Dashboard tabs (Overview, Events, Members, Analytics, Settings) render as a **horizontal tab bar** below the hero section. Sidebar expands on hover to show labels (existing behavior).
- **Mobile**: No sidebar. Scrollable horizontal tab bar below a compact hero. FAB button for "Create Event."
- **AppShell changes**: Add `/my-clubs/[id]` (dashboard routes only, not `/my-clubs` listing) to footer-suppressed routes. Pass `collapsed` prop to `SideNavBar` when on dashboard routes.

### Page Structure (Desktop)

```
┌─────────────────────────────────────────────────┐
│ [Icon Rail 72px] │ [Main Dashboard Content]      │
│                  │                               │
│  U (logo)        │ ┌─────────────────────────┐   │
│  🏠              │ │  HERO BANNER (160px)     │   │
│  📅              │ │  gradient / image        │   │
│  👥              │ │         [Edit Banner]    │   │
│  🏢 (active)     │ ├─────────────────────────┤   │
│  🔔              │ │ [Logo] Club Name  Status │   │
│                  │ │ 1,247 followers · 12 mem │   │
│                  │ │          [Public] [+Event]│   │
│  ⚙️              │ ├─────────────────────────┤   │
│  [avatar]        │ │ Overview Events Members  │   │
│                  │ │ Analytics Settings       │   │
│                  │ ├─────────────────────────┤   │
│                  │ │                          │   │
│                  │ │   [Tab Content Area]     │   │
│                  │ │                          │   │
│                  │ └─────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Page Structure (Mobile)

```
┌─────────────────────┐
│ ← Back    Club Name │
├─────────────────────┤
│  HERO (100px)       │
├─────────────────────┤
│ [Logo] Name · Stats │
├─────────────────────┤
│ Overview│Events│... │ (scrollable tabs)
├─────────────────────┤
│                     │
│  [Tab Content]      │
│                     │
│              [FAB+] │
└─────────────────────┘
```

## Color System

All colors use existing CSS variables from `globals.css`. No custom colors.

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--background` | `#09090B` | `#FFFFFF` | Page background |
| `--card` | `#18181B` | `#FFFFFF` | Stat cards, content sections |
| `--border` | `#27272A` | `#E5E5E5` | Card borders, dividers |
| `--primary` | `#ED1B2F` | `#ED1B2F` | CTAs, active tab indicator, brand accents |
| `--foreground` | `#FAFAFA` | `#171717` | Primary text |
| `--muted-foreground` | `#71717A` | `#737373` | Secondary text, labels |
| `--secondary` | `#27272A` | `#F5F5F5` | Secondary buttons, badges |

### Hero Gradient (no banner image fallback)

Uses the same gradient as `/clubs/[id]`:

- **Light**: `bg-gradient-to-br from-slate-900 via-primary/80 to-slate-800`
- **Dark**: `bg-gradient-to-br from-slate-950 via-primary/40 to-slate-900`
- **Overlay**: `bg-gradient-to-t from-black/80 via-black/30 to-black/20`
- **Bottom fade**: `bg-gradient-to-t from-background to-transparent` (32px height)

## Tab Specifications

### 1. Overview Tab

**Hero Section** (reuses `/clubs/[id]` visual pattern — same gradient, overlay, and logo overlap — but with reduced height for dashboard context):
- Banner: 160px height (desktop), 100px (mobile). Shows uploaded banner or gradient fallback. (Public page uses 40vh/320-420px; dashboard is intentionally more compact.)
- "Edit Banner" button overlay (top-right, glass-morphism pill)
- Overlapping club logo: 80px (desktop), 56px (mobile), rounded-2xl, 3px border matching background
- Club name + status badge (approved/pending/rejected) + category badge
- Stats: followers | members | events (inline)
- Actions: "View Public Page ↗" (secondary button), "+ Create Event" (primary button)

**Stats Grid** (below tabs):
- 4 columns (desktop), 2x2 (mobile)
- Cards: `bg-card`, `border`, `rounded-xl`, padding 16px
- Each card: uppercase label, large number, trend indicator (green ↑ / red ↓ / muted neutral)
- Metrics:
  - **Total Followers** — count + % change this month
  - **Avg RSVPs** — average per event + % change vs previous event
  - **Engagement Rate** — (total interactions on club events in last 30 days / follower count) as % + monthly trend
  - **Events This Month** — count + semester total

**Next Event Spotlight**:
- Card with inner highlight card (`bg-secondary`, `rounded-xl`)
- Event title, date/time, RSVP counts (going + interested), countdown ("7 days away →")
- Only shows if an upcoming event exists

**Recent Events Table**:
- Columns: Event name, Date, RSVPs, Views
- Max 5 rows, sorted by date descending
- Link each row to event detail

**Completion Nudge** (existing `ClubCompletionNudge` component):
- Only renders if profile is incomplete
- Checklist: logo, description, contact email, Instagram, co-organizer, first event

### 2. Events Tab

Existing functionality with current UI. No changes needed beyond ensuring it works within the new layout container.

### 3. Members Tab

**Member List**:
- Avatar (from user profile or initials fallback) + name + email + role badge (Owner/Organizer)
- Search/filter bar at top
- Each row has actions dropdown: Change Role, Remove (with confirmation dialog)
- Owner cannot be removed; only owner can change roles

**Invite Section**:
- Single invite: email input + role selector + send button
- Bulk invite: textarea for pasting multiple emails (one per line, max 20), shared role selector. Client iterates over emails calling `POST /api/clubs/[id]/invites` per email. Partial failures shown inline (e.g., "3 of 5 sent, 2 failed: already members").
- Pending invites list with cancel/resend actions

**Member Activity** (new):
- Per-member: events attended count, last active date
- Sortable by activity level

### 4. Analytics Tab

**Summary Cards** (top row, same style as Overview):
- Total event views (all-time)
- Total RSVPs (all-time)
- Follower-to-RSVP conversion rate
- Most popular event type (tag)

**Follower Growth Chart**:
- Line chart (Recharts), 30-day window
- X-axis: dates, Y-axis: cumulative follower count
- Tooltip on hover with exact date + count

**Engagement Rate Trend** (new):
- Line chart showing (interactions / impressions) over time
- Overlay with event markers showing when events were posted

**Per-Event Performance Table**:
- Columns: Event title, Date, Views, Clicks, Saves, Unique Viewers, Going, Interested, Cancelled, Churn %
- Sortable columns
- Expandable rows for detailed breakdown

**Popular Tags Distribution**:
- Bar chart, top 5 tags used by the club
- Shows count per tag

**Peak Activity Times** (new):
- Heatmap or simple bar chart showing when followers are most active (hour of day / day of week)
- Derived from `user_interactions` timestamps
- Helps organizers pick optimal event posting times

**Best-Performing Event Type** (new):
- Insight card: "Your [Technology] events get 2.3x more RSVPs than average"
- Derived from comparing per-tag RSVP averages

### 5. Settings Tab (Owner Only)

**Club Identity Section**:
- Logo upload (256x256 recommended, 2MB max) — preview + upload/change/remove
- Banner upload (1200x400 recommended, 2MB max) — preview + upload/change/remove
- Club name (required, 3-50 chars, character counter)
- Description (optional, 500 chars max, character counter)
- Category (dropdown, 15 options from existing enum)

**Contact Section**:
- Contact email (required, validated) — new field, must be added to `clubs` table
- Purpose: moderation contact, partnership inquiries, student outreach

**Social Links Section**:
- Instagram handle (auto-strips @)
- Twitter/X URL (URL validated)
- Discord URL (URL validated)
- LinkedIn URL (URL validated)
- Website URL (URL validated)

**Danger Zone**:
- Red-bordered section at bottom
- **Transfer Ownership**: Select another club member from dropdown → confirmation dialog → immediate transfer (no acceptance required). Atomically: sets new owner's role to `"owner"`, sets old owner's role to `"organizer"`. Audited in `admin_audit_log`. Endpoint: `POST /api/clubs/[id]/transfer` with `{ newOwnerId: string }`.
- **Delete Club**: Requires typing club name to confirm → soft-delete (sets `status` to `"deleted"`). Events, followers, and members are preserved but club is hidden from all public queries. Endpoint: `DELETE /api/clubs/[id]` (owner-only). Audited in `admin_audit_log`.

## Data Model Changes

### New Column: `clubs.contact_email`

```sql
ALTER TABLE clubs ADD COLUMN contact_email TEXT;
-- Column is nullable at DB level to support existing clubs without backfill.
-- Application-level enforcement: required for new clubs (POST validation),
-- nudged for existing clubs via ClubCompletionNudge.
```

- Required at club creation (enforced in `POST /api/clubs` validation, not DB constraint)
- Existing clubs: nullable, surfaced in `ClubCompletionNudge` checklist to encourage backfill
- Validated as email format on both client and API (`PATCH /api/clubs/[id]`)
- Add `contact_email` to `allowedFields` in PATCH route with email format validation
- Displayed on public club page behind a "Contact" button
- Add to `Club` TypeScript interface: `contact_email: string | null;`

### New Analytics Queries

**Engagement Rate**: `(total interactions on club events in last 30 days) / (follower count)` as percentage, computed per-day for trend chart. Uses `user_interactions` table filtered by the club's event IDs.

**Peak Activity**: Aggregate `user_interactions.created_at` by hour-of-day and day-of-week for the club's events. 30-day window. First fetches all club event IDs in one query, then filters interactions with `IN` clause (no N+1).

**Best Event Type**: Compare average RSVPs per tag across the club's events using the `rsvps` table (note: CLAUDE.md says `event_rsvps` but codebase queries `rsvps`).

## Component Architecture

### New Components

| Component | Purpose |
|-----------|---------|
| `ClubDashboardLayout` | Hybrid layout wrapper — collapsed sidebar + hero + tabs |
| `ClubDashboardHero` | Hero section with banner, logo, stats, actions (shared pattern with public page) |
| `CollapsedSidebar` | Icon-only sidebar rail, expands on hover |

### Modified Components

| Component | Changes |
|-----------|---------|
| `AppShell` | Add `/my-clubs` to footer-suppressed routes; pass collapsed sidebar prop |
| `SideNavBar` | Support `collapsed` mode (icon-only, expand on hover) |
| `ClubDashboard` | Remove custom sidebar/header; use new layout wrapper + existing tab components |
| `ClubSettingsTab` | Add banner upload, contact email (required), all social links, danger zone |
| `ClubOverviewTab` | Add engagement rate stat, use new hero above tabs |
| `ClubAnalyticsTab` | Add engagement trend, peak times, best event type insight |
| `ClubMembersTab` | Add role changing, remove member, bulk invite, activity stats, search |
| `ClubCompletionNudge` | Add contact_email to checklist items |

### Preserved Components (no changes)

| Component | Reason |
|-----------|--------|
| `ClubEventsTab` | Already functional, works in new layout |
| `ClubHeroSocialLinks` | Reused for public page; dashboard hero uses edit mode instead |
| `FollowButton` | Public page only, not shown in dashboard |

## API Changes

### `PATCH /api/clubs/[id]`

Add fields to accepted body:
- `contact_email` (string, email format)
- `banner_url` (string, URL format) — already supported but not in settings UI

### `POST /api/clubs/banner`

Already exists — just needs to be wired into settings UI.

### `PATCH /api/clubs/[id]/members`

New endpoint for role changes. Owner-only.
- Body: `{ memberId: string, role: "organizer" }`
- Cannot change own role. Cannot set role to "owner" (use transfer endpoint instead).
- Returns updated member record.

### `POST /api/clubs/[id]/transfer`

New endpoint for ownership transfer. Owner-only.
- Body: `{ newOwnerId: string }`
- Validates target is an existing club member.
- Atomically: sets target's role to `"owner"`, sets current owner's role to `"organizer"`.
- Logs to `admin_audit_log`.

### `DELETE /api/clubs/[id]`

New endpoint for club soft-deletion. Owner-only.
- Sets `status` to `"deleted"`. Does not cascade-delete data.
- Requires body: `{ confirmName: string }` matching the club name.
- Logs to `admin_audit_log`.

### `GET /api/clubs/[id]/analytics`

Extend response with:
- `engagement_trend`: `{ date: string; rate: number }[]` — 30-day engagement rate
- `peak_hours`: `{ hour: number; count: number }[]` — interaction distribution by hour
- `peak_days`: `{ day: string; count: number }[]` — interaction distribution by weekday
- `best_event_type`: `{ tag: string; avg_rsvps: number; comparison: number }` — top-performing tag with multiplier

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `≥1024px` (lg) | Collapsed sidebar (72px, matching existing SideNavBar collapsed width) + full dashboard |
| `768-1023px` (md) | No sidebar, full-width dashboard, horizontal tabs |
| `<768px` (sm) | No sidebar, compact hero, scrollable tabs, 2x2 stat grid, FAB |

## Error States

- **No events**: Empty state with "Create your first event" CTA
- **No followers**: Stats show 0 with encouraging copy ("Share your club page to get followers")
- **No analytics data**: Show empty charts with "Host events to see analytics" message
- **Settings save failure**: Inline error message with retry, form stays populated
- **Pending club**: Banner shows "Pending Approval" overlay; limited actions available
- **Loading states**: All new analytics widgets (engagement trend, peak activity, best event type) get skeleton placeholders matching existing analytics tab pattern

## Success Criteria

1. No double navigation — single collapsed sidebar integrates with AppShell
2. No footer on dashboard pages
3. Hero section matches public `/clubs/[id]` visual identity (same gradient, same layout pattern)
4. All club fields editable in Settings (logo, banner, name, description, category, contact email, 5 social links)
5. Contact email required at club creation
6. Analytics show engagement rate, peak times, and best event type insights
7. Members tab supports role changes, removal, bulk invite, and activity stats
8. Responsive across all breakpoints with mobile FAB
9. All colors use existing CSS variables — no custom color values
