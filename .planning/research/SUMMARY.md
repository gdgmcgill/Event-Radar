# Project Research Summary

**Project:** Uni-Verse — Club Organizer Dashboard (v1.1)
**Domain:** Role-based club management, member invitations, organizer dashboard on existing Next.js/Supabase platform
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Uni-Verse v1.1 is a subsequent milestone on a production Next.js 16 / Supabase / shadcn/ui platform. The milestone's core deliverable is a functional club organizer dashboard at `/my-clubs/[id]` — a dead link that already exists in the codebase. The scope is tightly bounded: add a tabbed dashboard, establish an owner vs organizer role distinction, build a member management system with email invitations, add club settings editing, and fix several surface-level UX gaps (context-aware public club page, club selector on event creation). The base infrastructure (auth, DB, API patterns, component library) is already in production and well-understood.

The recommended approach is database-first: all implementation must begin with a single SQL migration that adds a `CHECK (role IN ('owner', 'organizer'))` constraint on `club_members.role` and creates the `organizer_invites` table. Every other feature depends on this foundation. The dashboard should be built as a URL-param-driven tabbed shell that resolves user role server-side once and passes it as a prop — this eliminates redundant permission queries and centralizes authorization. The invite flow should launch as a copy-link mechanism (no email infrastructure required) and upgrade to Resend-delivered emails in v1.2.

The highest risks are all database-layer: specifically, RLS policy infinite recursion when self-referencing `club_members`, silent UPDATE failures on the `clubs` table (locked to admins by the security audit migration `011_rls_audit.sql`), and role escalation via the Supabase PostgREST endpoint. All three are avoidable by following the `is_club_owner()` SECURITY DEFINER function pattern already established in `011_rls_audit.sql` and by never using the service role client in organizer-facing routes. These are not speculative risks — they are confirmed gaps from direct inspection of the existing migration files.

## Key Findings

### Recommended Stack

The base stack requires no new major dependencies. Six missing shadcn/ui components must be added (`tabs`, `textarea`, `avatar`, `alert`, `tooltip`, `form`) via the shadcn CLI. Two new npm packages are required: `react-hook-form` with `@hookform/resolvers` for the settings form, and `resend` for email invitations (deferred to v1.2 in the architecture recommendation, but the package is scoped and ready). Zod is likely already a transitive dependency — verify with `npm ls zod` before installing.

**Core new additions:**
- `shadcn/ui Tabs`: Primary dashboard navigation — Radix UI primitive, zero version conflicts with existing Radix packages
- `react-hook-form@^7.54.0` + `@hookform/resolvers@^3.9.0`: Settings form state management — shadcn Form component is a thin wrapper around it; they are a matched pair
- `zod@^3.23.0`: Schema validation for forms — already the project standard; verify if already installed as transitive dep
- `resend@^4.0.0`: Transactional email for invitations — Next.js Route Handler native, no SMTP config; defer to v1.2 while copy-link invite ships first

Everything else (SWR, Zustand, Dialog, Badge, Card, Select, Input, Lucide, date-fns, react-easy-crop) is already installed and reusable without modification.

### Expected Features

**Must have (table stakes — launch blockers):**
- DB migration: `club_members.role` CHECK constraint (`'owner'`, `'organizer'`) — foundational prerequisite for all role-based logic
- Auto-grant `owner` role to club creator on admin approval (one-line change in existing admin route)
- `/my-clubs/[id]` tabbed dashboard — Overview, Events, Members, Settings tabs
- Member list with roles visible and pending invitations visible
- Owner vs organizer role distinction enforced at DB level
- Direct organizer invitation by email (owner-only, copy-link UX for v1.1)
- Club settings editing — owner-only: name, description, category, Instagram, logo
- Club-context event creation from dashboard (pre-fills `clubId`, auto-approves for own club)
- Context-aware public club page (three CTA states: visitor / organizer / owner)

**Should have (add within milestone if scope allows):**
- Member removal by owner (with confirmation dialog, self-removal guard)
- Invitation status tracking (pending / revoke)
- Club selector on `/create-event` for organizers with multiple clubs
- Updated post-creation messaging on `/clubs/create` success screen

**Defer to v1.2+:**
- Email-delivered invitations via Resend (ship copy-link first, upgrade later)
- Invitation expiry enforcement and re-send
- Club analytics (event views, member growth) — interaction data already captured, analysis deferred

**Defer to v2+:**
- Owner transfer flow — admin handles manually until graduation cycle data justifies the feature
- Club archiving / soft-delete
- Granular sub-organizer roles

### Architecture Approach

The dashboard follows a server-shell / client-tab pattern: the page at `/my-clubs/[id]` is a Server Component that resolves the user's club role in a single DB query and passes it as a prop to a client-side `ClubDashboardTabs` component. Tab state lives in the URL search param (`?tab=members`), not React state, giving bookmarkable URLs and correct back-button behavior. Each tab component fetches its own data via client-side SWR calls. A new `components/clubs/` directory mirrors the existing `components/events/` structure. Three new API routes are needed (`/api/clubs/[id]/members`, `/api/clubs/[id]/invites`, `/api/invites/[token]`), plus a PATCH addition to the existing `/api/clubs/[id]` route.

**Major components:**
1. `/my-clubs/[id]/page.tsx` (Server Component) — role resolution, redirect guard, dashboard shell; passes `clubId` and `userRole` to all tabs as props
2. `ClubDashboardTabs` — URL-param tab switcher; renders Overview / Events / Members / Settings tabs
3. `ClubMembersTab` + `InviteOrganizerModal` — member list, remove-member (with confirmation dialog), invite-by-email with copy-link return
4. `ClubSettingsTab` — react-hook-form + Zod settings form, owner-only, excludes `status` from updatable fields
5. `organizer_invites` table + `is_club_owner()` SECURITY DEFINER function — DB foundation that prevents RLS infinite recursion
6. Modified: `/api/admin/clubs/[id]` (role: organizer → owner), `/clubs/[id]` public page (context-aware CTA), `CreateEventForm` (wire `clubId` prop)

### Critical Pitfalls

1. **RLS infinite recursion on `club_members` self-reference** — Never use a raw `FROM club_members` subquery inside a `club_members` RLS policy. Create a `SECURITY DEFINER` function `is_club_owner(club_id UUID)` following the existing `is_admin()` pattern in `011_rls_audit.sql`. Must be designed in Phase 1 before any policy is written.

2. **Owner cross-row SELECT blocked by existing RLS** — The existing `"Users see own memberships"` policy only returns the user's own row. An owner querying the member list gets an empty array with no error — extremely hard to debug (returns `{ data: [], error: null }`). Add `"Owners can view all club members"` policy using `is_club_owner()` in the Phase 1 migration.

3. **`clubs` UPDATE silently fails for owners** — `011_rls_audit.sql` locked clubs UPDATE to admins only. Settings form saves will return 0 rows updated with no error. Add a scoped owner UPDATE policy in the same PR as the Settings tab. Never test with the service role client during development — it bypasses RLS and masks this problem.

4. **Role escalation via PostgREST direct endpoint** — Any authenticated user can POST directly to Supabase's REST endpoint, bypassing the Next.js API route. The invite endpoint must harden at the DB layer: `WITH CHECK (role = 'organizer')` hardcoded, never from client payload. The `CHECK (role IN ('owner', 'organizer'))` constraint is the schema-level backstop.

5. **Service role client in organizer routes** — The admin route pattern uses the service role client. Reusing it for organizer routes bypasses RLS entirely. All organizer-facing API routes must use the session client (`createClient()`) and rely on RLS. Service role is for admin routes only.

## Implications for Roadmap

Based on research, the dependency chain from FEATURES.md and the build order from ARCHITECTURE.md converge on a clear 4-phase structure.

### Phase 1: Database Foundation
**Rationale:** Every role-based feature — member list, invite flow, settings editing, context-aware CTAs — depends on the `club_members.role` CHECK constraint and the `is_club_owner()` function. Pitfalls 1, 2, 3, and 4 are all prevented at this layer. This must land before any application code.
**Delivers:** Migrations deployed; `role` column constrained; `is_club_owner()` SECURITY DEFINER function live; owner cross-row SELECT and DELETE RLS policies; `organizer_invites` table with RLS; composite index on `club_members(club_id, role)`; auto-grant changed from `organizer` to `owner` in admin approval route.
**Addresses:** DB migration (P1), auto-grant owner on approval (P1)
**Avoids:** Infinite recursion (Pitfall 2), cross-row SELECT gap (Pitfall 1), role escalation (Pitfall 4)

### Phase 2: Dashboard Shell + Read-Only Tabs
**Rationale:** The page shell and URL-param tab navigation must exist before any tab content can be built. Events and Overview tabs are read-only and consume existing APIs — lowest risk, earliest confidence win. Resolves the dead link without shipping a broken or incomplete experience.
**Delivers:** `/my-clubs/[id]` page with server-side role resolution and redirect guard; `ClubDashboardTabs` with URL-param routing; `ClubOverviewTab` (club info summary); `ClubEventsTab` consuming existing `GET /api/clubs/[id]/events` with no new API work.
**Uses:** shadcn Tabs (new install), Next.js `useSearchParams`, SWR
**Avoids:** Dead link going live before dashboard is complete (Pitfall 7 from PITFALLS.md)

### Phase 3: Members Tab + Invite Flow
**Rationale:** Member management is the core differentiator of the milestone. The invite flow lives inside the Members tab, so both must ship together. Both require Phase 1 RLS to be in place before testing is meaningful.
**Delivers:** `GET + DELETE /api/clubs/[id]/members`; `ClubMembersTab` with role display, remove-member (confirmation dialog, self-removal guard); `InviteOrganizerModal` with copy-link UX; `POST /api/clubs/[id]/invites` + `GET /api/invites/[token]`; `/invites/[token]` accept page; pending invite list in Members tab.
**Uses:** shadcn Avatar, Tooltip, Alert (new installs); react-hook-form for invite email input
**Avoids:** Role escalation via invite payload (Pitfall 4), owner self-removal (Architecture anti-pattern 5), wrong CTAs visible to organizers (UX pitfall from PITFALLS.md)

### Phase 4: Settings Tab + Surface Fixes
**Rationale:** Club settings editing requires a new RLS policy on the `clubs` table — it should not block the critical dashboard path. Surface fixes (context-aware public page, create-event club selector, post-creation messaging) are isolated and low-risk; they can be parallelized across this phase.
**Delivers:** `PATCH /api/clubs/[id]` handler (explicitly excludes `status` from updatable columns); `ClubSettingsTab` with react-hook-form + Zod validation; owner UPDATE RLS policy on `clubs`; context-aware CTA on public club page (3 states: visitor / organizer / owner); club selector on `/create-event`; wired `CreateEventForm` `clubId` prop with auto-approval for own-club events; updated post-creation messaging.
**Uses:** react-hook-form, @hookform/resolvers, Zod, shadcn Form, Textarea (new installs)
**Avoids:** Silent UPDATE failure on clubs (Pitfall 3), wrong CTAs on public page (UX pitfall from PITFALLS.md), auto-approval scope too broad (Pitfall 6 from PITFALLS.md)

### Phase Ordering Rationale

- The dependency chain from FEATURES.md is unambiguous: DB constraint enables role distinction, which enables the dashboard, which enables member management, which enables invite flow.
- ARCHITECTURE.md's 7-step build order maps cleanly onto 4 roadmap phases by grouping: DB work together, shell + low-risk tabs together, members + invites together (both need members API), settings + surface fixes together (both are isolated from the critical path).
- Each phase produces a shippable increment. Phase 2 resolves the dead link. Phase 3 delivers the full member management loop. Phase 4 completes the organizer experience.
- Pitfalls are front-loaded: the most dangerous issues (RLS infinite recursion, cross-row SELECT, role escalation) are all addressed in Phase 1 before any UI is built.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Invite Token Flow):** The acceptance flow has several edge cases that must be specified before implementation: email verification match (invitee email must match authenticated user), expired token handling, already-accepted token guard, invitee not yet registered (no account for that email). Define the UX for each state before writing a line of code.
- **Phase 1 (RLS Policies):** The exact policy SQL should be reviewed by someone familiar with Supabase's SECURITY DEFINER behavior before the migration is run in production. Rollback from an infinite-recursion policy in production is high-cost (all `club_members` queries fail until the policy is manually dropped).

Phases with standard patterns (skip additional research):
- **Phase 2 (Dashboard Shell):** URL-param tab state is a documented Next.js App Router pattern with official examples. No unknowns.
- **Phase 4 (Settings Form):** react-hook-form + Zod + shadcn Form is a fully documented, stable integration. Official shadcn docs provide complete examples.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Decisions based on direct `package.json` and `src/components/ui/` inspection; shadcn + react-hook-form integration is official and documented |
| Features | HIGH | Feature scope derived from PROJECT.md (first-party); competitor analysis (Slack, GitHub Orgs, Discord) cross-validates table stakes vs differentiators |
| Architecture | HIGH | Based on direct codebase inspection of existing routes, components, schema; patterns traced from working code not documentation |
| Pitfalls | HIGH | Pitfalls confirmed from direct inspection of `009_user_roles.sql` and `011_rls_audit.sql`; not speculative; recovery costs explicitly documented |

**Overall confidence:** HIGH

### Gaps to Address

- **Resend free tier limits:** Confirmed as 3,000 emails/month from training data; verify current limit at resend.com before v1.2 email delivery feature. Not blocking for v1.1 copy-link approach.
- **Logo upload in Settings tab:** ARCHITECTURE.md recommends deferring logo upload to v1.2 if it adds risk (Supabase Storage presigned URLs). PROJECT.md includes it in scope. Resolve during Phase 4 planning — ship text / category / Instagram fields first, add logo as a separate task within Phase 4.
- **Invitee must have existing account:** A McGill email invite only works if the invitee has already signed up. The invite acceptance flow must surface a clear error to the owner: "No account found for this email. They must sign in with their McGill account first." Define this UX before Phase 3 implementation to avoid a confusing dead-end flow.

## Sources

### Primary (HIGH confidence)
- `package.json` — confirmed installed dependencies and which shadcn components are missing
- `src/components/ui/` directory — confirmed which shadcn components are absent
- `supabase/migrations/009_user_roles.sql` — confirmed `club_members.role TEXT` has no CHECK constraint; confirmed existing RLS policies cover only own-row SELECT and admin ALL
- `supabase/migrations/011_rls_audit.sql` — confirmed `clubs` UPDATE locked to admins only; confirmed `is_admin()` SECURITY DEFINER pattern available to reuse as `is_club_owner()`
- `.planning/PROJECT.md` — v1.1 milestone scope, existing API capabilities, confirmed dead link
- `CLAUDE.md` — tech stack, directory structure, database schema
- Next.js App Router `useSearchParams` docs — URL-param tab state pattern (official)
- Supabase RLS documentation — permissive policy OR logic behavior (official)
- PostgreSQL SECURITY DEFINER docs — breaking recursive RLS evaluation (official)

### Secondary (MEDIUM confidence)
- shadcn/ui docs (ui.shadcn.com) — Form + react-hook-form + Zod integration pattern
- Resend Next.js guide (resend.com/docs) — Route Handler integration; free tier limits
- Slack, GitHub Orgs, Discord role hierarchy patterns — competitor analysis for feature table stakes

### Tertiary (LOW confidence)
- Club management software surveys (Wild Apricot, Join It, Gradnet) — feature landscape validation; used to confirm table stakes, not for implementation decisions

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
