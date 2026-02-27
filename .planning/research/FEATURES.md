# Feature Research

**Domain:** Club organizer dashboard — member management, roles, invitations, club settings
**Project:** Uni-Verse — campus event discovery platform (McGill University)
**Milestone:** v1.1 Club Organizer UX Overhaul
**Researched:** 2026-02-25
**Confidence:** HIGH (patterns verified against Slack, GitHub Orgs, Discord; Uni-Verse constraints well-defined from PROJECT.md)

---

## Codebase Context (What Already Exists)

Before categorizing new features, audit what the codebase already provides:

**Already built — do not rebuild:**
- Club creation flow with admin approval (`/clubs/create`, `/api/admin/clubs/[id]`)
- Organizer request flow (non-creator path to become an organizer)
- Club browsing and public detail pages (`/clubs`, `/clubs/[id]`)
- Admin club moderation page
- `/my-clubs` listing page (links to `/my-clubs/[id]` — dead link)
- `GET /api/clubs/[id]/events` returns all events for a club (organizer-only)
- `PATCH /api/events/[id]` supports editing by club organizers (membership check exists)
- `CreateEventForm` accepts optional `clubId` prop (never passed from UI)
- `POST /api/admin/clubs/[id]` auto-grants `club_organizer` role + `club_members` insert on approval — but uses generic `role = 'organizer'` with no owner distinction
- `club_members` table with `role TEXT` column (no CHECK constraint — accepts any string)

**Genuinely missing — active milestone scope:**
- `/my-clubs/[id]` dashboard page (dead link exists, page doesn't)
- `owner` vs `organizer` distinction in `club_members.role` (no DB constraint)
- Auto-grant of `owner` (not just `organizer`) to club creator on admin approval
- Organizer invitation system (club_invitations table, invite flow, acceptance)
- Club settings editing UI for owners
- Club-context event creation wired from dashboard
- Context-aware CTAs on public club page (3 states: visitor / organizer / owner)
- Club selector on `/create-event` for organizers belonging to multiple clubs
- Updated post-creation messaging on `/clubs/create` success screen

---

## Table Stakes (Users Expect These)

Features organizers assume exist. Missing these makes the dashboard feel broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tabbed dashboard at `/my-clubs/[id]` | Every org management tool (Slack, GitHub, Discord, Luma) uses a single hub with tabs. Organizers expect one place to manage everything. Dead link already exists — this is the primary gap. | MEDIUM | Four tabs: Overview, Events, Members, Settings. Needs new page at `src/app/my-clubs/[id]/page.tsx`. |
| Member list with roles visible | Organizers need to see who is in their club and at what role. Without this, inviting and removing is blind. | LOW | `club_members` table exists. Join with `users` to show name/email. Display `owner` vs `organizer` role per row. |
| Owner vs organizer role distinction | Every mature platform (Slack, GitHub Orgs, Discord) separates who *owns* the entity from who *operates* it. Owners manage club identity and members; organizers create events. Without this distinction the system is a flat room with no accountability structure. | MEDIUM | `club_members.role TEXT` exists but has no constraint. Migration: add CHECK constraint (`'owner'`, `'organizer'`). One club should have exactly one owner at this stage. |
| Auto-grant owner status on club approval | Club creator having to separately request access to their own club is a broken flow. Admin approval is the trust event; organizer/owner status must follow automatically. | LOW | One-line change: in `POST /api/admin/clubs/[id]`, change the `club_members` insert from `role = 'organizer'` to `role = 'owner'`. Migration must land first to accept the string. |
| Event list in club context (Events tab) | Organizers need to see all events tied to their club without hunting through the global feed. | LOW | `GET /api/clubs/[id]/events` already exists and is ready to consume. Wire into Events tab. |
| Club-context event creation from dashboard | Creating an event from a club dashboard should pre-fill the club. Requiring organizers to manually select from a dropdown every time is unnecessary friction. | LOW | `CreateEventForm` already accepts `clubId` prop — pass it from the dashboard. Events created by club organizers for their own club should be auto-approved. |
| Club settings editing (name, description, category, links, logo) | Organizers expect to control their club's public presence without filing an admin ticket for a typo fix. Every platform separates settings-editing from initial creation approval. | MEDIUM | Owner-only. Edits to name/description/logo go live immediately (no re-approval needed). Admin approved the club's existence; day-to-day settings are the owner's domain. |
| Context-aware public club page CTAs | Showing "Request Organizer Access" to someone who is already an organizer is a broken experience. The CTA must reflect the viewer's actual relationship to the club. | MEDIUM | Three states: (1) visitor — show "Request Organizer Access"; (2) organizer — show "Manage Club" link to dashboard; (3) owner — show "Manage Club" link. Requires RLS-safe read of `club_members` for current user. |
| Updated post-creation messaging on `/clubs/create` | After submitting a club, the success screen should explain what happens next: pending review, then auto-granted owner status. Currently this is a dead end with no guidance. | LOW | Copy/UI change only. No backend work. High trust impact for minimal effort. |

---

## Differentiators (Competitive Advantage)

Features beyond the baseline that make the organizer experience genuinely good for a university context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Direct organizer invitations by email (no admin approval) | Owner invites a co-organizer by McGill email — no admin ticket, no waiting. This is the GitHub Org invitation model: the trusted owner's invitation is itself the trust event. Removes a bottleneck that would otherwise kill adoption of multi-organizer clubs. | MEDIUM | Owner sends invite → creates `club_invitations` record (pending) → invited user accepts from notification or link → inserted into `club_members` as organizer. Standard 7-day expiry. Requires new `club_invitations` table. |
| Invitation status tracking (pending / accepted / expired / revoked) | Owner can see pending invitations, revoke them, and re-send. Prevents the "did they get it?" confusion that kills async collaboration. | LOW | `club_invitations` table with `status` enum. Render pending invites in Members tab under "Pending Invitations" section. Revoke = delete the record. |
| Member removal by owner | Owners need to remove organizers who are inactive or no longer affiliated. Standard for any org management tool. | LOW | Delete from `club_members` where `user_id = target AND club_id = club`. Guard: owner cannot remove themselves (would leave club ownerless). |
| Club selector on `/create-event` for multi-club organizers | Organizers managing multiple clubs need to pick which club an event belongs to. Currently `clubId` is never passed from the event creation UI — the form accepts it but nothing connects it. | LOW | Dropdown on `/create-event` page populated from the current user's `club_members` memberships. Show only if user has organizer role in at least one club. |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Club deletion by organizers | "I created it, I should be able to delete it" | Cascading data loss: events, saved_events, interactions, notifications all reference the club. Irreversible. Admin must verify intent and handle cleanup. | Admin-only. Owner can request deletion via admin. Future: soft-delete/archive status. |
| Event deletion by organizers | Organizers want to clean up mistakes | Deletes interaction history and breaks saved-event lists for students who saved the event. Data integrity outweighs convenience. | Organizers edit events (set status to cancelled, correct details). Only admins delete. |
| Multi-level role hierarchy (moderator, event manager, treasurer) | Large clubs want granular control | Complexity far exceeds campus club needs. Permissions become unmaintainable. Role confusion increases for users. Three roles is already a lot for a university club. | Two roles (owner, organizer) cover all real use cases at this scale. Re-evaluate if a specific club explicitly needs more. |
| Open membership / self-serve organizer join | "Reduce friction — let anyone request to join as organizer directly" | Club identity and event credibility depend on organizer trust. Open join enables spam, fake clubs, and event abuse. | Invitation-only. Owner invites; no self-service organizer escalation. The existing admin-mediated request flow remains for non-creator paths. |
| Owner transfer UI | "What if the creator graduates?" | Edge case with low frequency. Requires ownership validation, confirmation step, notification on both sides. Complex for a rare need. | Admin handles ownership transfer manually for now. Flag for v2 after graduation cycle data shows how often it's needed. |
| Real-time member presence / activity feed | Feels modern | Supabase Realtime adds complexity; university club activity is low-frequency. No meaningful UX improvement at this scale. | Show static joined date and role on member list. |
| Club analytics dashboard (event views, member growth charts) | Organizers want data | Right feature, wrong milestone. Building analytics before the dashboard itself is stable wastes effort if schema changes. | Defer to v1.2+. Interaction data is already being captured in `user_interactions` and `event_popularity_scores` — analysis can come later without any new data collection. |

---

## Feature Dependencies

```
[DB migration: club_members.role CHECK constraint]  (must be first)
    └──enables──> [Auto-grant owner on approval] (can insert 'owner' without violating constraint)
    └──enables──> [Owner vs organizer role distinction everywhere]
                      └──enables──> [Tabbed dashboard /my-clubs/[id]]
                                        ├──requires──> [Member list with roles]
                                        │                  └──enables──> [Member removal by owner]
                                        │                  └──enables──> [Invitation status tracking]
                                        ├──requires──> [Direct organizer invitations]
                                        │                  └──requires──> [club_invitations table migration]
                                        ├──requires──> [Event list in club context]
                                        │                  └──enables──> [Club-context event creation]
                                        └──requires──> [Club settings editing (owner-only)]

[Owner vs organizer role distinction]
    └──enables──> [Context-aware public club page] (three CTA states require knowing role)

[Direct organizer invitations]
    └──requires──> [club_invitations table]
    └──requires──> [Owner vs organizer role distinction] (must write role='organizer' on acceptance)

[Club selector on /create-event]
    └──requires──> [club_members readable by current user via RLS]
    └──enhances──> [Club-context event creation] (both solve the clubId gap)
```

### Dependency Notes

- **DB migration must land first:** The `club_members.role` CHECK constraint migration is the prerequisite for everything. Without it, inserting `'owner'` either fails (if constraint already blocks it) or is silently ambiguous (if no constraint). Run migration, then update all role-writing code.
- **Dashboard requires auto-grant:** Without auto-grant, the club creator navigates to `/my-clubs/[id]` and is treated as a non-member — a completely broken state since `/my-clubs` already links there.
- **Invitations require role distinction:** The invitation acceptance flow must write `role = 'organizer'` to `club_members`; this only works correctly once the two-role model is in place.
- **Context-aware public page requires role distinction:** The three CTA states depend on reading `club_members.role` for the current user against a specific club. Without the `owner` / `organizer` distinction, all existing members look the same.

---

## MVP Definition

This milestone (v1.1) has a well-defined scope from PROJECT.md. Mapping to launch vs defer:

### Launch With (v1.1 — this milestone)

- [ ] DB migration: `club_members.role` CHECK constraint (`'owner'`, `'organizer'`) — foundational, everything depends on it
- [ ] Auto-grant `'owner'` role to club creator on admin approval (change one insert in admin API)
- [ ] `/my-clubs/[id]` tabbed dashboard (Overview, Events, Members, Settings tabs)
- [ ] Member list tab with roles visible, pending invitations visible
- [ ] Member removal (owner removes organizer, cannot remove self)
- [ ] Direct organizer invitation by email (owner-only, creates `club_invitations` record)
- [ ] Invitation acceptance flow (invited user sees invite, accepts, becomes organizer)
- [ ] Club settings editing — owner-only: name, description, category, Instagram, logo
- [ ] Club-context event creation from dashboard (pre-fills `clubId`, auto-approve for own club)
- [ ] Event management tab (view and link to edit club events via existing `PATCH /api/events/[id]`)
- [ ] Context-aware public club page (three CTA states: visitor / organizer / owner)
- [ ] Club selector on `/create-event` for organizers with multiple clubs
- [ ] Updated post-creation messaging on `/clubs/create` success screen

### Add After Validation (v1.2)

- [ ] Invitation expiry enforcement and re-send — add once invitations are in production and edge cases surface
- [ ] Club analytics (event views, member growth over time) — defer until dashboard is stable; `user_interactions` and `event_popularity_scores` already collect the data

### Future Consideration (v2+)

- [ ] Owner transfer flow — rare (graduation turnover); admin can handle manually until frequency justifies the feature
- [ ] Club archiving / soft-delete — useful but requires cascading status changes across events, notifications, saved events
- [ ] Granular sub-organizer roles — only if specific clubs demonstrate the need

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DB migration: role CHECK constraint | HIGH | LOW | P1 |
| Auto-grant owner on approval | HIGH | LOW | P1 |
| `/my-clubs/[id]` tabbed dashboard scaffold | HIGH | MEDIUM | P1 |
| Member list with roles visible | HIGH | LOW | P1 |
| Context-aware public club page | HIGH | MEDIUM | P1 |
| Club-context event creation | HIGH | LOW | P1 |
| Direct organizer invitations | HIGH | MEDIUM | P1 |
| Club settings editing | MEDIUM | MEDIUM | P1 |
| Event list / edit in dashboard (Events tab) | MEDIUM | LOW | P1 |
| Club selector on `/create-event` | MEDIUM | LOW | P1 |
| Updated post-creation messaging | LOW | LOW | P1 (copy-only) |
| Member removal by owner | MEDIUM | LOW | P2 |
| Invitation status tracking (revoke / resend) | LOW | LOW | P2 |
| Club analytics | MEDIUM | HIGH | P3 |
| Owner transfer UI | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible within milestone
- P3: Future milestone

---

## Competitor Feature Analysis

Platforms analyzed for pattern reference: Slack workspaces, GitHub Organizations, Discord servers, Luma (event org management), Wild Apricot (club membership software).

| Feature | Slack / GitHub Orgs | Discord | Our Approach |
|---------|---------------------|---------|--------------|
| Role tiers | Owner > Admin > Member | Owner > Admin > Moderator > Member | Owner > Organizer (two roles; campus clubs do not need more hierarchy) |
| Invite mechanism | Email invite (trusted link) | Invite link (public or time-limited) | Email invite by owner only — no public join links for organizers. McGill email required. |
| Invite approval required? | No — the invitation is the trust event | No | No — owner's invitation is trusted. Admin not involved in co-organizer onboarding. |
| Settings editing | Owner / Admin can edit workspace settings | Owner / Admin | Owner-only for club metadata. Edits are live (no re-approval). |
| Member removal | Owner or Admin removes members | Owner / Admin / Moderator | Owner removes organizers. Owner cannot remove themselves. |
| Event creation in org context | Luma: org pre-selected when creating from org dashboard | N/A | Pre-fill `clubId` from dashboard; auto-approve events created by club organizers for their own club |
| Public page context-awareness | GitHub shows "Member" badge when you belong to the org. Luma shows "Manage" link for org admins. | Discord shows "Joined" state | Three CTA states: visitor (request access), organizer ("Manage Club"), owner ("Manage Club") |
| Analytics | GitHub Insights, Slack analytics (paid) | Server Insights (premium) | Deferred to v1.2. Interaction data already captured. |

---

## Sources

- [Types of roles in Slack](https://slack.com/help/articles/360018112273-Types-of-roles-in-Slack) — role hierarchy and invite permission patterns (HIGH confidence)
- [Role Management at Slack Engineering](https://slack.engineering/role-management-at-slack/) — permission/role design principles (HIGH confidence)
- [14 Best Club Management Software Tools — Wild Apricot](https://www.wildapricot.com/blog/club-management-software) — member management table stakes survey (MEDIUM confidence)
- [9 Top Membership Management Software for 2025 — Gradnet](https://gradnet.io/blog/top-membership-management-software/) — invite and role patterns in club tools (MEDIUM confidence)
- [15 Best Club Management Software Tools for 2026 — Join It](https://joinit.com/blog/best-club-management-software) — feature landscape and admin delegation patterns (MEDIUM confidence)
- PROJECT.md — Uni-Verse v1.1 target features, constraints, existing API context (HIGH confidence)
- CLAUDE.md — tech stack, database schema, existing patterns (HIGH confidence)

---

*Feature research for: Club organizer dashboard, member management, invite system (Uni-Verse v1.1)*
*Researched: 2026-02-25*
