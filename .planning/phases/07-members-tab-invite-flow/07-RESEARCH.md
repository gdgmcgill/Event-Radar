# Phase 7: Members Tab + Invite Flow - Research

**Researched:** 2026-02-25
**Domain:** Full-stack member management UI + invitation token flow (Next.js App Router, Supabase RLS, shadcn/ui)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEM-01 | `GET /api/clubs/[id]/members` — returns members with user info and roles, accessible by club members only | Supabase join query on `club_members` + `users`; authenticated client enforces existing RLS policies (owner cross-row SELECT already deployed in Phase 5) |
| MEM-02 | Member list UI with role badges (owner/organizer) and joined date | Client component pattern identical to `ClubEventsTab`; existing `Badge` + `Card` components; `formatDate()` from `@/lib/utils` |
| MEM-03 | Member removal by owner — confirmation dialog, self-removal guard, `DELETE /api/clubs/[id]/members` endpoint | Existing `Dialog` component for confirmation; `DELETE` handler; DB-level self-removal guard already in Phase 5 migration (`user_id != (select auth.uid())`) |
| MEM-04 | Direct organizer invitation by email — owner enters McGill email, generates invite with copy-link UX | `isMcGillEmail()` already in `@/lib/utils`; `navigator.clipboard.writeText()` for copy; token is UUID from DB `gen_random_uuid()` |
| MEM-05 | `POST /api/clubs/[id]/invites` — owner-only, hardcodes `role='organizer'` server-side, validates invitee email exists in `users` table | Server-side role assignment; `isMcGillEmail()` validation; `users` table lookup; `club_invitations` table insert |
| MEM-06 | Invitation acceptance flow — `/invites/[token]` page, validates token not expired, validates user email matches invitee_email, inserts into `club_members` as organizer | Server component page; Supabase token lookup; email comparison; `club_members` insert |
| MEM-07 | Pending invitations visible in Members tab — separate section showing pending invites with email and date | Fetched by same `GET /api/clubs/[id]/members` or a separate fetch within the tab; owner-only section |
| MEM-08 | Invitation revocation by owner — delete/revoke pending invitation from Members tab *(P2)* | `DELETE /api/clubs/[id]/invites/[inviteId]` or PATCH to set `status='revoked'`; owner-only; use existing Dialog for confirmation |

</phase_requirements>

---

## Summary

Phase 7 wires the Members tab placeholder (currently renders "Members management coming soon.") into a fully functional member management system. The DB foundation is complete from Phase 5: `club_members` has owner/organizer role distinction, RLS policies let owners see all members and delete any member except themselves, and `club_invitations` stores invite tokens. Phase 6 built the `ClubDashboard` shell with the tab stub. Phase 7's job is to fill in that stub with three coordinated pieces: member list UI, invite creation flow, and the `/invites/[token]` acceptance page.

The technical approach mirrors the `ClubEventsTab` pattern exactly: client component fetching from a new API route, with owner-only UI sections gated by the `role` prop already threaded through `ClubDashboard`. No new libraries are needed — the project already has `Dialog` for confirmation flows, `Badge` for role display, `Input`/`Button` for forms, and `isMcGillEmail()` for email validation. The invite link is built from `window.location.origin + '/invites/' + token` and copied with `navigator.clipboard.writeText()` — no email delivery (deferred to v1.2).

**CRITICAL schema mismatch to resolve:** The Phase 5 migration created `club_invitations` with column `inviter_id`, but `src/lib/supabase/types.ts` was hand-edited in Phase 6 with `invited_by` instead. The planner must reconcile these before writing any query. The SQL migration is authoritative — `inviter_id` is what the database has.

**Primary recommendation:** Build in this order: (1) `GET /api/clubs/[id]/members` + `ClubMembersTab` list view, (2) member removal with Dialog confirmation, (3) invite creation with copy-link, (4) `/invites/[token]` acceptance page, (5) pending invites section + revocation (P2).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | ^16.0.3 | Server component pages + API routes | Project framework |
| Supabase JS | ^2.49.0 | DB queries, auth, RLS enforcement | Project database |
| @supabase/ssr | ^0.7.0 | Server-side auth client | Cookie-based session management |
| TypeScript | ^5.4.0 (strict) | Type safety | Project requirement |
| Tailwind CSS | ^3.4.1 | Styling | Project standard |

### Supporting (already installed — no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Confirmation dialogs, invite modal | Member removal confirmation; invite-by-email modal |
| lucide-react | ^0.344.0 | Icons | Users, Mail, Copy, Trash2, Check icons |
| shadcn Badge | already in `src/components/ui/badge.tsx` | Role display (owner/organizer) | Member list role badges |
| shadcn Input | already in `src/components/ui/input.tsx` | Email input field | Invite-by-email form |
| shadcn Button | already in `src/components/ui/button.tsx` | Actions | Remove, invite, copy-link, revoke |
| shadcn Card | already in `src/components/ui/card.tsx` | Section containers | Member list cards |

**Installation:** No new packages required. All dependencies are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `Dialog` for confirmation | Add `AlertDialog` (separate shadcn component) | AlertDialog is semantically correct for destructive confirmation, but Dialog already works and is already installed; avoids new dependency |
| `navigator.clipboard.writeText()` | Clipboard.js library | Native API covers all modern browsers; no library needed |
| UUID token from DB `gen_random_uuid()` | Server-generated `crypto.randomUUID()` | DB default is already set in the migration; no additional token generation needed in API code |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/clubs/[id]/
│   │   ├── members/route.ts        # GET + DELETE (MEM-01, MEM-03)
│   │   └── invites/route.ts        # POST (MEM-05)
│   └── invites/[token]/
│       └── page.tsx                # Invite acceptance (MEM-06)
└── components/clubs/
    └── ClubMembersTab.tsx          # Members tab component (MEM-02, MEM-03, MEM-04, MEM-07, MEM-08)
```

The `ClubDashboard.tsx` `members` tab content block replaces the placeholder with `<ClubMembersTab clubId={club.id} role={role} />`.

### Pattern 1: Client Tab Component (mirrors ClubEventsTab exactly)

**What:** Client component that fetches from API on mount using `useCallback` + `useEffect`, with loading/error/empty states.
**When to use:** All Members tab data fetching.

```typescript
// Source: src/components/clubs/ClubEventsTab.tsx (established pattern)
"use client";
import { useState, useEffect, useCallback } from "react";

interface ClubMembersTabProps {
  clubId: string;
  role: "owner" | "organizer";
}

export function ClubMembersTab({ clubId, role }: ClubMembersTabProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvites(data.pendingInvites ?? []);  // owner-only, empty array for organizers
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // ...
}
```

### Pattern 2: API Route with Supabase Join (GET members + user info)

**What:** Server-side API route that joins `club_members` with `users` to return member details.
**When to use:** `GET /api/clubs/[id]/members`

```typescript
// Source: established pattern from src/app/api/clubs/[id]/events/route.ts
const { data: members, error } = await supabase
  .from("club_members")
  .select(`
    id,
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
// RLS "Club owners can view all club members" policy (Phase 5) enforces access
```

Note: The authenticated Supabase client (not service role) must be used so RLS policies apply. An organizer calling this route will only see their own row (per the existing "Users see own memberships" policy). An owner will see all rows (per the Phase 5 "Club owners can view all club members" policy).

### Pattern 3: DELETE Member Endpoint

**What:** API route that deletes a `club_members` row. Self-removal guard is enforced at the DB level (Phase 5 migration), but the API should also validate ownership.
**When to use:** `DELETE /api/clubs/[id]/members` with `userId` in request body.

```typescript
// Pattern: auth check first, then RLS-delegated delete
const { error: deleteError } = await supabase
  .from("club_members")
  .delete()
  .eq("club_id", clubId)
  .eq("user_id", targetUserId);
// If targetUserId === auth.uid(), the DB RLS DELETE policy rejects it silently
// API should return 403 explicitly before hitting DB for better UX
```

### Pattern 4: Invite Creation (POST) with Server-Side Role Hardcoding

**What:** API route that creates a `club_invitations` row. Role is hardcoded server-side — never from client payload.
**When to use:** `POST /api/clubs/[id]/invites`

```typescript
// MEM-05: role MUST be hardcoded server-side
const { data: invite, error } = await supabase
  .from("club_invitations")
  .insert({
    club_id: clubId,
    inviter_id: user.id,        // CRITICAL: use 'inviter_id' not 'invited_by' (see schema mismatch below)
    invitee_email: validatedEmail,
    // role and status have DB defaults; token is gen_random_uuid() default
    // expires_at defaults to now() + 7 days
  })
  .select("token")
  .single();

// Return invite link (not the token directly — construct the URL)
const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invites/${invite.token}`;
return NextResponse.json({ inviteLink, token: invite.token });
```

### Pattern 5: Invite Acceptance Page (Server Component)

**What:** Server-component page at `/invites/[token]` that validates the token and inserts the user into `club_members`.
**When to use:** MEM-06

```typescript
// src/app/invites/[token]/page.tsx — server component
export default async function InviteAcceptancePage({ params }) {
  const { token } = await params;
  const supabase = await createClient();

  // Must be logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/?signin=required&next=/invites/${token}`);

  // Look up invitation — needs a migration to add invitee-access SELECT policy
  // OR use service client for the lookup + validate email server-side
  const { data: invite } = await supabase
    .from("club_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  // Validate: exists, not expired, email matches authenticated user
  if (!invite) return <InviteError reason="not_found" />;
  if (new Date(invite.expires_at) < new Date()) return <InviteError reason="expired" />;
  if (invite.invitee_email.toLowerCase() !== user.email!.toLowerCase())
    return <InviteError reason="email_mismatch" />;

  // Insert member + mark invite accepted
  await supabase.from("club_members").insert({
    club_id: invite.club_id,
    user_id: user.id,
    role: "organizer",
  });
  await supabase.from("club_invitations")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  redirect(`/my-clubs/${invite.club_id}?tab=overview`);
}
```

**CRITICAL:** The Phase 5 migration intentionally left no invitee-access SELECT policy on `club_invitations` (see STATE.md decision: "No invitee-access SELECT policy on club_invitations — deferred to Phase 7"). This means the invitation lookup at `/invites/[token]` will fail with the authenticated client (invitee cannot select their own invite row). **A new migration is required** to add a SELECT policy: `USING (invitee_email = (SELECT email FROM users WHERE id = auth.uid()))`. Alternatively, a service-role client could be used for the token lookup — but the migration is cleaner and more secure.

### Pattern 6: Copy-Link UX (Clipboard API)

**What:** After invite is created, show the link in a readonly input and provide a "Copy" button using `navigator.clipboard.writeText()`.
**When to use:** MEM-04 — no email delivery, just copy-link.

```typescript
// In ClubMembersTab client component
const [copied, setCopied] = useState(false);

async function handleCopy(link: string) {
  await navigator.clipboard.writeText(link);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

// UI: show generated link in readonly Input + Button with Copy/Check icon
```

### Pattern 7: Confirmation Dialog (member removal)

**What:** Use existing `Dialog` component for a two-step confirmation before removing a member. No AlertDialog install needed.
**When to use:** MEM-03 — owner removes organizer.

```typescript
// Pattern from src/components/ui/dialog.tsx (already installed)
<Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Remove member?</DialogTitle>
      <DialogDescription>
        This will remove {selectedMember?.name} from your club. They will lose organizer access.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleRemove} disabled={removing}>
        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Pattern 8: Owner-Only UI Gating

**What:** `role` prop is passed down from `ClubDashboard` (already threaded). Use it to conditionally show invite form, remove buttons, pending invites section.
**When to use:** Throughout `ClubMembersTab`.

```typescript
// role is already available as a prop: "owner" | "organizer"
{role === "owner" && (
  <InviteByEmailSection clubId={clubId} onInviteSent={fetchData} />
)}
{role === "owner" && invites.length > 0 && (
  <PendingInvitesSection invites={invites} onRevoke={handleRevoke} />
)}
// Remove button on each member row — owner only
{role === "owner" && member.role !== "owner" && (
  <Button variant="ghost" size="sm" onClick={() => openRemoveDialog(member)}>
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

### Anti-Patterns to Avoid

- **Using service-role client for member fetching in ClubMembersTab API:** The authenticated client is correct — RLS enforces that organizers only see themselves, owners see all. Service role would bypass this.
- **Sending role from client in POST /invites payload:** Role MUST be hardcoded as `'organizer'` server-side. Never trust client input for role assignment.
- **Building token generation logic:** The DB already generates UUID tokens via `gen_random_uuid()` default. Just read the token back with `.select("token")`.
- **Redirecting unauthenticated users to `/` without preserving invite URL:** The redirect should include `?next=/invites/[token]` so users can complete the flow after signing in.
- **Skipping the Phase 7 migration for invitee SELECT policy:** Without this policy, the `/invites/[token]` page cannot read the invitation row with the authenticated client. This is a known deferred gap from Phase 5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email validation | Custom regex | `isMcGillEmail()` from `@/lib/utils` | Already exists, covers `@mcgill.ca` and `@mail.mcgill.ca` |
| Copy to clipboard | Custom fallback logic | `navigator.clipboard.writeText()` | Sufficient for modern browsers; no library needed |
| UUID token for invite link | Custom token generation | `gen_random_uuid()` DB default | Already set in `club_invitations` table from Phase 5 migration |
| Role authorization check in UI | Re-fetch membership on client | Use `role` prop already passed through `ClubDashboard` | Avoids waterfall; role is resolved server-side in `page.tsx` |
| Confirmation dialog | Custom modal | Existing `Dialog` from `src/components/ui/dialog.tsx` | Already installed, same pattern used in `OrganizerRequestDialog.tsx` |

**Key insight:** The Phase 5 migration did all the hard work — DB constraints, RLS policies, index, and the invitations table. Phase 7 is pure UI + API wiring on top of a solid foundation. Resist the urge to add DB complexity.

---

## Common Pitfalls

### Pitfall 1: Schema Mismatch — `inviter_id` vs `invited_by`

**What goes wrong:** Code uses `invited_by` (the column name in `src/lib/supabase/types.ts`) but the actual DB column is `inviter_id` (from the Phase 5 migration SQL). Queries return null or TypeScript errors.
**Why it happens:** Phase 6 hand-wrote the `club_invitations` type in `types.ts` without running `supabase gen types` — the column was named differently from the migration.
**How to avoid:** Before writing any query against `club_invitations`, verify the actual column name in the migration file (`supabase/migrations/20260225000001_club_roles_and_invitations.sql`). **The SQL is authoritative.** The migration uses `inviter_id`. Update `types.ts` to match: change `invited_by` → `inviter_id`.
**Warning signs:** TypeScript error "Property 'inviter_id' does not exist" or Supabase returning `null` for insert.

### Pitfall 2: Missing Invitee SELECT Policy on `club_invitations`

**What goes wrong:** `/invites/[token]` page cannot read the invitation because the invitee has no SELECT access on `club_invitations` — only owners have SELECT (Phase 5 migration only added owner policies).
**Why it happens:** Documented deferred decision from Phase 5 (STATE.md: "No invitee-access SELECT policy on club_invitations — deferred to Phase 7").
**How to avoid:** Phase 7 MUST add a new migration with:
```sql
DROP POLICY IF EXISTS "Invitees can view their own invitation" ON public.club_invitations;
CREATE POLICY "Invitees can view their own invitation"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM public.users WHERE id = (SELECT auth.uid()))
  );
```
**Warning signs:** Supabase returns empty result for token lookup even when invite exists.

### Pitfall 3: Organizer Viewing Other Members' Data

**What goes wrong:** An organizer (non-owner) calls `GET /api/clubs/[id]/members` and sees all members' data.
**Why it happens:** If the API route uses service-role client or doesn't let RLS enforce access.
**How to avoid:** Use `createClient()` (authenticated client, not service role) for all member queries. The existing "Users see own memberships" RLS policy will filter results correctly. Alternatively, check `membership.role` server-side and only return full list for owners.
**Warning signs:** Organizer sees full member list instead of just themselves.

### Pitfall 4: `NEXT_PUBLIC_APP_URL` Not Configured

**What goes wrong:** Invite link is `undefined/invites/[token]` because `process.env.NEXT_PUBLIC_APP_URL` is not set in `.env.local`.
**Why it happens:** Standard practice to have an app URL env var but it may not be configured.
**How to avoid:** Use `request.headers.get('origin') ?? request.headers.get('x-forwarded-host')` in the API route to derive the base URL, or use `process.env.NEXT_PUBLIC_SUPABASE_URL` to infer environment (dev vs prod). Alternatively, return just the token and construct the URL client-side with `window.location.origin`.
**Warning signs:** Invite links don't work or show `undefined` in the URL.

### Pitfall 5: Double Club Membership on Invite Acceptance

**What goes wrong:** Accepting an invite for a club where the user is already a member triggers a duplicate key constraint.
**Why it happens:** User already has a `club_members` row (e.g., applied as organizer separately).
**How to avoid:** Before inserting into `club_members`, check if a row already exists. Use `upsert` with `onConflict: 'user_id,club_id'` or check first and redirect with a "you're already a member" message.
**Warning signs:** 500 error on invite acceptance for existing members.

### Pitfall 6: Self-Removal UI Guard Not Matching DB Guard

**What goes wrong:** Owner sees a Remove button for themselves and the DB rejects the delete, resulting in a confusing error.
**Why it happens:** The DB has a guard but the UI doesn't pre-filter.
**How to avoid:** In the member list, never render the Remove button for the owner's own row. Identify the owner's row by checking `member.user_id === currentUserId`. Pass `currentUserId` to `ClubMembersTab` as a prop (available in `page.tsx` from `user.id`).

---

## Code Examples

Verified patterns from this codebase:

### Supabase Join Query (club_members + users)

```typescript
// Pattern: select with embedded relation (Supabase PostgREST syntax)
const { data: members, error } = await supabase
  .from("club_members")
  .select(`
    id,
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

### API Route Auth + Role Check (established pattern)

```typescript
// Source: src/app/api/clubs/[id]/events/route.ts
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: "You must be signed in" }, { status: 401 });
}
// Check membership for this specific club
const { data: membership } = await supabase
  .from("club_members")
  .select("role")
  .eq("user_id", user.id)
  .eq("club_id", clubId)
  .single();
if (!membership) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### DELETE with Body Parsing (Next.js App Router pattern)

```typescript
// Pattern: DELETE with JSON body in Next.js App Router
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: clubId } = await params;
  const body = await request.json();
  const targetUserId: string = body.userId;
  // ...
}
```

### transformEventFromDB Cast Pattern (established in Phase 6-03)

```typescript
// Source: src/app/api/clubs/[id]/events/route.ts
// NOTE: Members don't need this — it's Event-specific. Shown for awareness.
transformEventFromDB(event as Parameters<typeof transformEventFromDB>[0])
```

### Badge for Role Display (established pattern)

```typescript
// Source: src/components/clubs/ClubDashboard.tsx
<Badge variant="secondary" className="capitalize">{role}</Badge>
// For owner badge (McGill red):
<Badge variant="secondary" className="bg-red-100 text-red-800">Owner</Badge>
// For organizer badge:
<Badge variant="secondary">Organizer</Badge>
```

### Dialog for Confirmation (pattern from dialog.tsx)

```typescript
// Source: src/components/ui/dialog.tsx (already installed)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
// Used exactly this way in OrganizerRequestDialog.tsx
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate SELECT policy per user type | SECURITY DEFINER function (`is_club_owner()`) | Phase 5 | Prevents RLS infinite recursion; same pattern as `is_admin()` |
| Flat organizer role (all organizers equal) | Owner/organizer distinction with CHECK constraint | Phase 5 | Phase 7 can conditionally show Remove and Invite UI based on `role === 'owner'` |
| Member count fetched client-side | Fetched server-side in `page.tsx` Promise.all | Phase 6 | Phase 7 inherits this pattern — DO NOT re-fetch member count client-side from ClubMembersTab |

**Deprecated/outdated:**
- Generic `'organizer'` role for club creators: replaced by `'owner'` (Phase 5 backfill + Phase 5 DBROLE-06 admin route patch). All new clubs get owner role on approval.

---

## Open Questions

1. **How should the GET /api/clubs/[id]/members response differ for owners vs organizers?**
   - What we know: RLS already limits non-owners to their own row
   - What's unclear: Should we return `pendingInvites` only for owners (same `null` pattern as `pendingInvitesCount` in Phase 6)?
   - Recommendation: Yes — return `pendingInvites: []` for organizers (empty array, not null) to simplify client code. Pending invites section is rendered only when `role === 'owner'`.

2. **What happens if the invited email doesn't have a Uni-Verse account yet?**
   - What we know: MEM-05 says "validates invitee email exists in users table" — so the API should reject invitations to emails not in the DB
   - What's unclear: What error UX to show ("This person hasn't created a Uni-Verse account yet")
   - Recommendation: Return a clear `400` with message "No Uni-Verse account found for this email address" so the invite form can display it inline.

3. **Should `NEXT_PUBLIC_APP_URL` be added to .env.local or should invite link be constructed differently?**
   - What we know: The env var may not exist; `window.location.origin` is available client-side
   - What's unclear: Server-side URL construction for the API response
   - Recommendation: Return just the `token` from the POST endpoint. Construct the invite link client-side: `${window.location.origin}/invites/${token}`. This avoids env var dependency entirely.

4. **MEM-08 (revocation) is marked P2 — include in Phase 7 or defer?**
   - What we know: The REQUIREMENTS.md marks it P2; the phase goal says "completing the member management loop" and lists MEM-08
   - What's unclear: Whether P2 means "lower priority within Phase 7" or "skip if time-constrained"
   - Recommendation: Implement MEM-08 as the final plan in Phase 7. It's trivial (PATCH `status='revoked'` or DELETE) and completes the loop. A separate plan ensures it doesn't block other tasks.

---

## Critical Pre-Work: Schema Fix Required

Before any Phase 7 implementation, the types.ts column name must be corrected:

**In `src/lib/supabase/types.ts`, `club_invitations` table:**
- Change: `invited_by: string` → `inviter_id: string` (in Row, Insert, Update interfaces)
- Also update the foreign key relationship name: `club_invitations_invited_by_fkey` → `club_invitations_inviter_id_fkey`

**Why:** The Phase 5 migration (authoritative source) uses `inviter_id`. The types.ts was hand-written in Phase 6 with the wrong column name `invited_by`. Any insert with `invited_by` will fail at runtime.

**Also required: New migration for Phase 7:**
Add invitee SELECT policy on `club_invitations` so the `/invites/[token]` page can look up the invitation using the authenticated client.

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/20260225000001_club_roles_and_invitations.sql` — authoritative source for `club_invitations` schema (column is `inviter_id`, not `invited_by`)
- `src/lib/supabase/types.ts` — TypeScript types (note discrepancy with migration, `invited_by` must be fixed)
- `src/components/clubs/ClubEventsTab.tsx` — establishes client tab component pattern to mirror
- `src/app/api/clubs/[id]/events/route.ts` — establishes API route auth + RLS pattern
- `src/components/ui/dialog.tsx` — available Dialog component for confirmation flows
- `src/lib/utils.ts` — `isMcGillEmail()` and `formatDate()` available
- `src/app/my-clubs/[id]/page.tsx` — shows `role` prop threading pattern
- `src/components/clubs/ClubDashboard.tsx` — Members tab placeholder to replace
- `.planning/STATE.md` — confirms "No invitee-access SELECT policy on club_invitations — deferred to Phase 7"
- `.planning/phases/05-database-foundation/05-01-SUMMARY.md` — full list of what Phase 5 delivered

### Secondary (MEDIUM confidence)

- Next.js App Router documentation patterns (server component + client component split) — aligns with existing codebase patterns
- Supabase PostgREST join query syntax — used throughout existing API routes

### Tertiary (LOW confidence)

- `navigator.clipboard.writeText()` browser support — generally HIGH for modern browsers but not verified against Supabase docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json` and `src/components/ui/`
- Architecture: HIGH — mirrors Phase 6 established patterns exactly; all component APIs verified by reading source
- Pitfalls: HIGH — schema mismatch confirmed by cross-referencing migration SQL vs types.ts; missing RLS policy confirmed by STATE.md decision log
- DB schema: HIGH — read directly from migration SQL file

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable stack; 30-day validity)
