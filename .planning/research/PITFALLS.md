# Pitfalls Research

**Domain:** Role-based club management + member invitations + organizer dashboard on existing Next.js/Supabase platform
**Researched:** 2026-02-25
**Confidence:** HIGH (based on direct codebase inspection of migrations 009 and 011, confirmed against Supabase RLS behavior)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken features at launch.

---

### Pitfall 1: RLS Policy Gap — Owner Cannot Read Cross-Row Club Members

**What goes wrong:**
The existing `"Users see own memberships"` policy on `club_members` only allows a user to read the single row where `user_id = auth.uid()`. When an owner opens the Members tab of the dashboard, the query fetches all members of a club — rows belonging to other users. Every row except the owner's own row is denied. The result is an empty member list with no error, not a permission denied message. This is extremely hard to debug because the route returns 200 with an empty array.

**Why it happens:**
The original policies in `009_user_roles.sql` were designed for a two-actor model: a user seeing their own row, and admins seeing everything. The owner role adds a third actor that needs cross-row SELECT on a specific club's membership. Developers add the `role = 'owner'` column but do not revisit the RLS policies because "club_members already has RLS."

**How to avoid:**
Add a `SECURITY DEFINER` helper function `is_club_owner(club_id UUID)` following the exact pattern of the existing `is_admin()` function in `011_rls_audit.sql`. Then add two new policies:
- SELECT: `"Owners can view all club members"` — `EXISTS (SELECT 1 FROM is_club_owner(club_members.club_id))`
- DELETE: `"Owners can remove club members"` — same EXISTS check, with a guard preventing self-removal

Both policies must be in the same migration that adds the owner role distinction to the `role` column.

**Warning signs:**
- Members tab shows zero rows despite rows existing in the DB when queried as service_role.
- No error thrown — Supabase client returns `{ data: [], error: null }`.
- `SELECT * FROM club_members` in the Supabase SQL editor (as authenticated user) returns only the user's own row.

**Phase to address:** Phase 1 — database migration (owner role + RLS policies). Must be done before any dashboard UI.

---

### Pitfall 2: Infinite Recursion in RLS Policies for club_members Self-Reference

**What goes wrong:**
Adding an RLS policy on `club_members` that contains a subquery `FROM club_members` (to check if the current user is an owner) causes PostgreSQL to recursively evaluate the policy while already processing a query on the same table. PostgreSQL raises `ERROR: infinite recursion detected in policy for relation "club_members"`. All queries on `club_members` fail until the policy is dropped.

**Why it happens:**
The natural way to write "only owners of this club can see all members" is:
```sql
EXISTS (SELECT 1 FROM club_members WHERE user_id = auth.uid() AND club_id = club_members.club_id AND role = 'owner')
```
This self-referential subquery triggers the policy again recursively during evaluation.

**How to avoid:**
Create a `SECURITY DEFINER` function that bypasses RLS when checking ownership — identical to how `is_admin()` works in `011_rls_audit.sql`:
```sql
CREATE OR REPLACE FUNCTION public.is_club_owner(target_club_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = target_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;
```
Use `public.is_club_owner(club_members.club_id)` in policies, never a raw subquery `FROM club_members`.

**Warning signs:**
- Any RLS policy on `club_members` with `FROM club_members` in the USING or WITH CHECK clause without a SECURITY DEFINER wrapper.
- `ERROR: infinite recursion detected` in Supabase logs after deploying a migration.
- All member list API calls return 500 after a migration deploy.

**Phase to address:** Phase 1 — design the `is_club_owner()` function before writing any `club_members` policies. This is the foundation for everything else.

---

### Pitfall 3: clubs Table UPDATE Locked to Admins — Settings Tab Silently Fails

**What goes wrong:**
Migration `011_rls_audit.sql` deliberately locked `clubs` UPDATE to admins only (`"Admins can update clubs"`). The v1.1 milestone requires owners to edit club name, description, category, Instagram, and logo from the Settings tab. Without a new RLS policy, every save silently returns `0 rows updated` — PostgREST does not throw an error when RLS blocks an UPDATE, it just reports no rows matched. The UI may show an optimistic success toast while the database has not changed.

**Why it happens:**
The security audit was correct at the time. The organizer settings feature is additive. Developers building the settings form test it with a service role client (which bypasses RLS) during development, so everything works locally. It fails silently in production where the authenticated client is used.

**How to avoid:**
Add a migration with a scoped UPDATE policy for owners before the settings tab ships:
```sql
CREATE POLICY "Owners can update own club"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (public.is_club_owner(clubs.id))
  WITH CHECK (public.is_club_owner(clubs.id));
```
The API route must also explicitly exclude `status` from the updatable columns — owners cannot self-approve a pending club by including `status: 'approved'` in the PATCH body.

**Warning signs:**
- Settings form saves without error but data does not change on page reload.
- Supabase logs show `UPDATE clubs SET ... 0 rows` for authenticated (non-admin) requests.
- No migration adding an owner UPDATE policy for `clubs` exists before the settings UI PR is merged.

**Phase to address:** Phase 3 — club settings tab. The migration must be in the same PR as the settings form.

---

### Pitfall 4: Invite Flow Exposes Role Escalation via Direct PostgREST Call

**What goes wrong:**
The invite feature requires a new INSERT path on `club_members`. If the INSERT policy is written as `WITH CHECK (true)` or `WITH CHECK (auth.uid() IS NOT NULL)`, any authenticated user can POST directly to the Supabase PostgREST endpoint (bypassing the Next.js API route entirely) and insert themselves as an `owner` of any club. The application layer checks role, but the database layer does not — and PostgREST is always reachable with a valid JWT.

**Why it happens:**
Developers write the API route with role guards and assume that is sufficient. They forget that Supabase exposes every table via REST, and any user with a valid JWT can call it directly. The service role client pattern used in admin routes gives a false sense that "the DB is protected by the API."

**How to avoid:**
The INSERT policy on `club_members` for invites must enforce two constraints at the database layer:
1. The inserting user is an owner of the target club: `public.is_club_owner(NEW.club_id)` must be true.
2. The inserted role cannot be `'owner'`: `WITH CHECK (role = 'organizer')` — hardcoded, never from the client payload.

Additionally, add a CHECK constraint on the `role` column itself: `CHECK (role IN ('owner', 'organizer'))`. This is a schema-level guard that no policy can bypass.

**Warning signs:**
- Any INSERT policy on `club_members` that does not call `is_club_owner()` in WITH CHECK.
- `role` column has no CHECK constraint — `role = 'superadmin'` would succeed silently.
- The invite API route uses the service role client (which means RLS is bypassed and the DB-layer guard does not exist).

**Phase to address:** Phase 1 (CHECK constraint on role column) + Phase 2 (invite API route RLS policy).

---

### Pitfall 5: Service Role Client Used in Organizer Routes — No DB-Layer Backstop

**What goes wrong:**
The existing `POST /api/admin/clubs/[id]` approval route uses the service role client and bypasses RLS. This is correct for admin-only operations. The pitfall is applying this pattern to organizer-facing routes (dashboard settings PATCH, member removal DELETE, invite INSERT) "because it's simpler than writing RLS policies." If any of these routes has a bug, injection, or authorization bypass, the service role key gives full unrestricted access to the entire database.

**Why it happens:**
The service role client is already imported and working in the codebase. Writing RLS policies requires more upfront work. The pattern is established for admin routes and tempting to reuse for organizer routes that also need elevated access.

**How to avoid:**
Use the service role client only in routes protected by a server-side `is_admin()` check. All organizer-facing routes must use the regular authenticated Supabase client (`createClient()` with the anon key) and rely on RLS for authorization. Add an explicit comment on every service role client import: `// SERVICE ROLE: admin routes only — never use in organizer-facing routes`.

**Warning signs:**
- `SUPABASE_SERVICE_ROLE_KEY` referenced in a route that does not first verify the requesting user is an admin.
- Organizer dashboard API routes that skip row-level checks because "the middleware already confirmed they have the club_organizer role" — middleware checks the role type, not club membership.

**Phase to address:** Phase 2 — all organizer API routes. Enforce in PR review checklist for this milestone.

---

### Pitfall 6: Auto-Approval Scope Too Broad — Any club_organizer Can Trigger It

**What goes wrong:**
The v1.1 milestone adds club-context event creation from the dashboard with auto-approval for organizers. If the auto-approval logic checks only `'club_organizer' = ANY(users.roles)` without verifying club membership, a user with the `club_organizer` role can create an event with any `club_id` (including clubs they do not belong to) and have it auto-approved — bypassing the moderation queue entirely.

**Why it happens:**
The `users.roles` array check is already established in middleware and API routes. It is the natural first-pass authorization check. The secondary check — is this user a member of the specific club they are posting on behalf of? — is easy to omit.

**How to avoid:**
Auto-approval must require both conditions:
1. `'club_organizer' = ANY(users.roles)` — user has the organizer role.
2. `EXISTS (SELECT 1 FROM club_members WHERE club_id = NEW.club_id AND user_id = auth.uid())` — user is a member of the specific club.

Implement this check in the API route, not just in the RLS policy (which governs row access, not business logic like approval status).

**Warning signs:**
- Auto-approval logic references only `users.roles` without a `club_members` join.
- An organizer can create an event with a `club_id` for a club they are not listed in and have it auto-approved.
- Test: create event via API with a valid organizer JWT but a `club_id` the user has no membership row for — it should be pending, not auto-approved.

**Phase to address:** Phase 2 — event creation from dashboard.

---

### Pitfall 7: Dead Link `/my-clubs/[id]` Goes Live Before Dashboard Is Complete

**What goes wrong:**
The `/my-clubs` listing page already links to `/my-clubs/[id]` — confirmed as a dead link in PROJECT.md. If the dashboard page file is merged to fix the dead link before all tabs are functional, organizers reach a partially broken experience from a link they can already click. The Members tab might show an empty state due to missing RLS policies (Pitfall 1). The Settings tab might silently fail on save (Pitfall 3). All four tabs are visible at once on a tabbed UI — there is no hiding an incomplete tab.

**Why it happens:**
Dashboard pages are built incrementally, tab by tab. Developers merge the page stub to resolve the dead link, intending to "add the other tabs later." The dead link feels like a bug to fix; a live broken page feels like a feature to build.

**How to avoid:**
Treat the `/my-clubs/[id]` page as a single atomic deliverable. All four tabs (Overview, Events, Members, Settings) must be functional before merging the page file. Define tab completeness criteria before starting implementation: each tab must render correct data, handle empty states explicitly, and not silently fail on mutations.

**Warning signs:**
- PR merges `app/my-clubs/[id]/page.tsx` without all tab components implemented and tested.
- Members tab renders with no loading/error state — just silently returns an empty array.
- Settings save button has no error handling.

**Phase to address:** Phase 2 — dashboard foundation. Set the completeness bar before the first line of code is written.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Service role client in organizer API routes | Skip writing RLS policies | Any route compromise = full DB access; no audit trail for organizer actions | Never |
| No CHECK constraint on `club_members.role` | Faster migration | Arbitrary role strings silently accepted; `role = 'superadmin'` works | Never — add CHECK on role column in Phase 1 |
| Inline `FROM club_members` subquery in `club_members` RLS policy | Avoids writing a helper function | Infinite recursion crash in production | Never — use SECURITY DEFINER function |
| Allow owner to PATCH `clubs.status` from settings form | Simpler API — one endpoint updates all fields | Owners self-approve pending clubs; bypasses admin moderation | Never — exclude status from owner-updatable columns |
| Merge dashboard page stub before all tabs are functional | Fixes dead link immediately | Users reach a live but broken experience | Never — ship all tabs together or keep the dead link |
| Accept `role` field from client payload in invite endpoint | Flexible invite system | Any user can escalate to owner via direct API call | Never — hardcode `role = 'organizer'` server-side |

---

## Integration Gotchas

Common mistakes when connecting to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS + PostgREST | Writing guards only in Next.js API routes, assuming PostgREST is internal | PostgREST is reachable with any valid user JWT — all table policies must be safe as the last line of defense |
| Supabase permissive policies (OR logic) | Adding a new permissive policy assuming it narrows existing access | Permissive policies expand access with OR. To narrow access, drop the broad policy and replace with a scoped one |
| club_members self-referential RLS | `FROM club_members` subquery in a `club_members` policy | Use `is_club_owner()` SECURITY DEFINER function — never a raw subquery on the same table |
| Service role client | Reusing admin route pattern for organizer routes | Service role bypasses RLS entirely; use authenticated client for all organizer-facing routes |
| Next.js middleware route protection | Middleware checks `club_organizer` role but not club membership | Middleware handles role type; API routes must also verify the user is a member of the specific club being accessed |
| clubs table RLS after audit | Assuming clubs has "enough" RLS from the security audit | `011_rls_audit.sql` locked UPDATE to admins only; owner settings require a new migration to add a scoped UPDATE policy |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No composite index on `club_members(club_id, role)` | `is_club_owner()` function does a full scan on every RLS policy evaluation (called once per returned row) | Add `CREATE INDEX idx_club_members_club_role ON club_members(club_id, role)` in Phase 1 migration | At ~200+ club_members rows — policies are evaluated per-row on every query |
| Dashboard fetches members, events, and club details in three sequential awaits | Tab switches feel slow; visible waterfall in DevTools network panel | Use `Promise.all()` for parallel fetches or a single Supabase RPC | From day one — visible on any >50ms network |
| Fetching full event objects for the dashboard events list tab | Over-fetches unused columns (description, tags, image_url) for a list view | SELECT only `id, title, date, status` for list; fetch full event only on edit | Noticeable at ~30+ events per club |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting `role` from client in invite payload | Role escalation — any user inserts themselves as owner | Hardcode `role = 'organizer'` in invite API route; never read it from request body |
| No expiry on invite tokens | Stale invite links usable indefinitely; club membership granted after member leaves | Add `expires_at TIMESTAMPTZ` column to invite table; reject inserts if `expires_at < NOW()` |
| Invite accepted without verifying invitee email matches authenticated user | Anyone with the link can accept on behalf of any email | Validate `auth.user().email === invite.invitee_email` before inserting `club_members` row |
| Owner can update `clubs.status` via settings PATCH | Owner self-approves a pending club, bypassing admin moderation | Explicitly exclude `status` from the list of columns the owner PATCH endpoint accepts |
| Event auto-approval checks role only, not club membership | Organizer creates event under any club_id and bypasses moderation | Require both: `club_organizer` role in `users.roles` AND membership row in `club_members` for the specific `club_id` |
| `users.roles` readable by all authenticated users | Attacker enumerates admin and organizer accounts | Confirmed fixed in `011_rls_audit.sql` — verify no new migration re-introduces a permissive users SELECT policy |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Public club page shows "Request Organizer Access" to existing organizers | Organizer clicks it, goes through the request flow, gets a confusing error | Context-aware CTA: check `club_members` on page load — show "Manage Club" for owners, "Club Dashboard" for organizers, "Request Access" for everyone else |
| No feedback after inviting a member when the email is not in the users table | Owner thinks invite succeeded; invitee never gets access | Show explicit error: "No account found for this email. They must sign in with their McGill account first." |
| Settings save with no field-change detection | Unnecessary API calls on every tab visit; misleading affordance | Disable save button until a field value diverges from the originally loaded club data |
| Member removal with no confirmation dialog | Owner accidentally removes a co-organizer with one mis-click | Require confirm dialog for member removal; no undo exists |
| Dashboard accessible by role type but not scoped to club — any organizer sees any club dashboard | Organizer A can view organizer B's club member list | Dashboard page must verify membership in the specific club, not just presence of `club_organizer` in roles |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Owner role migration:** `club_members.role` column has `CHECK (role IN ('owner', 'organizer'))` constraint — verify in migration SQL, not just application code
- [ ] **is_club_owner() function:** SECURITY DEFINER function exists and is used in all club_members policies — verify no raw `FROM club_members` subquery exists in any RLS policy
- [ ] **Owner cross-row SELECT:** Owner can see all club members, not just their own row — test via authenticated Supabase client with owner JWT (not service role)
- [ ] **clubs UPDATE policy:** Owner can save club settings via authenticated client — test fails without the new migration; test succeeds only after it lands
- [ ] **Auto-grant on approval:** Club creator gets `role = 'owner'` in `club_members` AND `club_organizer` in `users.roles` on admin approval — verify both, not just one
- [ ] **Invite role lock:** Sending `role: 'owner'` in invite request body is ignored — verify by POSTing directly to the API with owner payload
- [ ] **Auto-approval scope:** Organizer creating event with a `club_id` they have no membership row for gets pending status, not auto-approved
- [ ] **Dashboard route protection:** `/my-clubs/[id]` returns an error (not empty data) when accessed by a user who is not a member of that club — test at both middleware and API layer
- [ ] **Public club page CTAs:** All three membership states tested — owner, organizer, and unaffiliated user each see the correct CTA

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Infinite recursion in club_members policy deployed to production | HIGH | Drop offending policy immediately via Supabase SQL editor using service role; all club_members queries fail until fixed; deploy corrected migration with SECURITY DEFINER function |
| Role escalation — unauthorized owner row inserted | HIGH | Revoke the club_members row and downgrade users.roles; audit Supabase logs for other inserts from the same session; add missing CHECK constraint and RLS WITH CHECK in emergency migration |
| Service role used in organizer route — scope of exposure discovered | HIGH | Audit all requests via that route in Supabase logs; rotate service role key immediately; redeploy route using authenticated client + RLS |
| Owner accidentally self-removed — club has no owner | MEDIUM | Admin reassigns owner via admin dashboard or direct SQL; club management is locked until fixed; add application guard preventing self-removal |
| clubs UPDATE policy missing — settings saves silently failing | LOW | Add missing RLS policy migration; no data loss occurred; users see stale data until deployment |
| Dead link page merged incomplete — users reach broken tabs | LOW | Revert to 404 or add "coming soon" redirect for incomplete tabs; document tab completeness criteria before next PR |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Owner cross-row SELECT blocked by existing RLS | Phase 1: DB migration (owner role + policies) | Query club_members as owner JWT via supabase-js — confirm all club members returned |
| Infinite recursion in club_members policies | Phase 1: DB migration (is_club_owner function) | Deploy migration to staging, run authenticated query — confirm no recursion error |
| Role escalation via invite payload | Phase 2: Invite API route + RLS INSERT policy | POST directly to PostgREST with `role: 'owner'` — confirm rejected |
| Service role in organizer routes | Phase 2: All organizer API routes | Grep for SERVICE_ROLE_KEY in non-admin route files during PR review |
| Auto-approval too broad | Phase 2: Event creation from dashboard | Create event with valid organizer JWT + foreign club_id — confirm pending status |
| Dead link goes live before dashboard complete | Phase 2: Dashboard foundation | All four tabs render correct data before merging the page file |
| clubs UPDATE blocked for owners after audit | Phase 3: Club settings tab | Save settings as owner JWT via supabase-js — confirm row updated in DB |
| Public club page shows wrong CTAs | Phase 4: Context-aware public page | Test all three membership states against the public club page |

---

## Sources

- Direct inspection of `/supabase/migrations/009_user_roles.sql` — confirmed `club_members.role TEXT` has no CHECK constraint; confirmed existing RLS policies cover only own-row SELECT and admin ALL; HIGH confidence (first-party codebase)
- Direct inspection of `/supabase/migrations/011_rls_audit.sql` — confirmed `clubs` UPDATE locked to admins only; confirmed `is_admin()` SECURITY DEFINER pattern available to reuse for `is_club_owner()`; HIGH confidence (first-party codebase)
- `.planning/PROJECT.md` — confirmed dead link on `/my-clubs/[id]`, confirmed auto-grant uses service role, confirmed role column needs owner/organizer distinction; HIGH confidence (first-party)
- Supabase RLS documentation on permissive policy OR logic — HIGH confidence (official Supabase docs)
- PostgreSQL documentation on SECURITY DEFINER functions to break recursive RLS evaluation — HIGH confidence (official PostgreSQL docs, well-established pattern)
- Supabase PostgREST direct endpoint exposure — HIGH confidence (Supabase architecture is documented; any table is reachable via REST with a valid JWT)

---
*Pitfalls research for: Role-based club management + member invitations + organizer dashboard (v1.1 milestone)*
*Researched: 2026-02-25*
