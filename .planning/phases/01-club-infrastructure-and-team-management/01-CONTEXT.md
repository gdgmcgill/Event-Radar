# Phase 1: Club Infrastructure and Team Management - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Organizers have a complete, functional club presence -- they can view and edit their clubs, manage their team, and students can follow clubs. This covers public club pages, organizer management dashboard, team invites, and student follow/unfollow. Requirements: CLUB-01, CLUB-02, CLUB-03, CLUB-04, TEAM-01, TEAM-02, TEAM-03, TEAM-04, FLLW-01, FLLW-02, FLLW-03.

</domain>

<decisions>
## Implementation Decisions

### Rework Scope
- Full teardown and rebuild from scratch -- delete all existing club components, pages, and API routes
- Rebuild both frontend (React components/pages) AND backend (API routes) from zero
- Review and audit database schema (clubs, club_members, club_invitations, club_followers tables), RLS policies, and triggers -- create migrations for any changes needed
- Rationale: existing code is too fragmented, RLS patterns need to be correct from day one since all subsequent phases inherit them

### Page Architecture
- Claude's discretion on exact URL structure -- pick whatever is cleanest for a production-ready app serving 40k users
- Current structure (/my-clubs, /my-clubs/[id], /clubs/[id]) is a reasonable starting point but not locked

### Quick-Switch Dropdown
- Dropdown lives in the dashboard header area, next to the club name at top of the management page
- Shows logo + club name only (no role badge)
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

</decisions>

<specifics>
## Specific Ideas

- "Whatever is the cleanest for a prod ready app for 40k users" -- production quality is the bar, not MVP
- Single-club users should never see the intermediary "My Clubs" list page -- they go straight to their club dashboard

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None retained -- full teardown means all existing club components (ClubDashboard, ClubOverviewTab, ClubEventsTab, ClubMembersTab, FollowButton, OrganizerRequestDialog) will be deleted and rebuilt
- shadcn/ui primitives (Card, Badge, Button, Input, Dialog, Sheet, Tabs, Skeleton, Breadcrumb) remain available
- EmptyState component at src/components/ui/EmptyState.tsx
- AppBreadcrumb component at src/components/layout/AppBreadcrumb.tsx
- Lucide React icons throughout the codebase

### Established Patterns
- Supabase client/server split: createClient() from @/lib/supabase/client for browser, from @/lib/supabase/server for API routes
- TypeScript strict mode with types defined in src/types/index.ts (Club, ClubMember, User types exist)
- Tailwind CSS + shadcn/ui for styling
- McGill branding colors: Red #ED1B2F, Burgundy #561c24, Sage #c7c7a3, Cream #e8d8c4
- useAuthStore (Zustand) for client-side auth state

### Integration Points
- SideNavBar (src/components/layout/SideNavBar.tsx) -- needs "My Clubs" nav item
- Header (src/components/layout/Header.tsx) -- may need updates for club context
- EventCard component -- used on public club page to display events
- Notification system -- existing, will be used for team invites in Phase 2
- Existing database tables: clubs, club_members, club_invitations, club_followers

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-club-infrastructure-and-team-management*
*Context gathered: 2026-03-05*
