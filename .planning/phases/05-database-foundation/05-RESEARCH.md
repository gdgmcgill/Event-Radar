# Phase 5: Database Foundation - Research

**Researched:** 2026-02-25
**Domain:** Supabase RLS, PostgreSQL DDL migrations, SECURITY DEFINER functions, role-enforcement patterns
**Confidence:** HIGH

---

## Summary

Phase 5 is a pure database migration phase — no new UI components, no new API routes. It establishes the security foundation that all v1.1 application code depends on. There are three distinct technical sub-problems: (1) hardening the existing `club_members` table with a role CHECK constraint and new RLS policies, (2) creating the `is_club_owner()` SECURITY DEFINER function to prevent RLS infinite recursion, and (3) creating the `club_invitations` table with owner-scoped policies. A fourth task patches the existing `POST /api/admin/clubs/[id]` route to insert `role='owner'` instead of `role='organizer'` on club approval.

The critical architectural insight is that the existing `009_user_roles.sql` migration created `club_members` with two RLS policies — "Users see own memberships" (own-row SELECT) and "Admins manage memberships" (ALL using an inline subquery against `public.users`). The inline subquery in "Admins manage memberships" is safe from infinite recursion today only because it queries `public.users`, not `club_members` itself. However, the new owner cross-row SELECT policy would create a self-referencing loop: evaluating the SELECT policy on `club_members` would require querying `club_members` to determine ownership. This is the textbook infinite recursion scenario that `is_club_owner()` SECURITY DEFINER eliminates.

All migrations must follow the established project pattern: idempotent SQL using `DROP POLICY IF EXISTS` before `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` (via DO block), and timestamped filenames for the v1.1 era.

**Primary recommendation:** Write a single migration file (`20260225000001_club_roles_and_invitations.sql`) that addresses all 7 DBROLE requirements atomically, plus a one-line code change to the admin clubs route. Follow the `is_admin()` pattern from `011_rls_audit.sql` exactly for the new `is_club_owner()` function.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DBROLE-01 | `CHECK (role IN ('owner', 'organizer'))` constraint on `club_members.role` column | PostgreSQL `ALTER TABLE ... ADD CONSTRAINT` with idempotent DO block; existing data has `role='organizer'` which satisfies constraint |
| DBROLE-02 | `is_club_owner(club_id UUID)` SECURITY DEFINER function — prevents RLS infinite recursion, follows `is_admin()` pattern from `011_rls_audit.sql` | SECURITY DEFINER with `SET search_path = public`, `STABLE`, same structure as `is_admin()`; verified pattern from Supabase official docs and boardshape.com example |
| DBROLE-03 | Owner cross-row SELECT policy on `club_members` — owners can view all members of their club (not just own row) | Uses `is_club_owner(club_id)` to avoid self-referencing recursion; permissive policies OR together with existing "Users see own memberships" — both SELECT policies will apply |
| DBROLE-04 | Owner DELETE policy on `club_members` — owners can remove organizers, with self-removal guard at DB level | `USING (is_club_owner(club_id) AND user_id != auth.uid())` — the `user_id != auth.uid()` clause is the self-removal guard |
| DBROLE-05 | Composite index on `club_members(club_id, role)` for `is_club_owner()` query performance | Standard `CREATE INDEX IF NOT EXISTS` on `(club_id, role)`; optimizes the `WHERE club_id = $1 AND role = 'owner' AND user_id = auth.uid()` query inside the function |
| DBROLE-06 | Auto-grant `'owner'` role (not `'organizer'`) to club creator on admin approval — change existing insert in `POST /api/admin/clubs/[id]` | One-line TypeScript change in `src/app/api/admin/clubs/[id]/route.ts` line 93: `role: "organizer"` → `role: "owner"` |
| DBROLE-07 | `club_invitations` table with id, club_id, inviter_id, invitee_email, token, status, expires_at, created_at — with RLS policies using `is_club_owner()` | New table with `gen_random_uuid()` token, TEXT status CHECK constraint, TIMESTAMPTZ expires_at; SELECT + INSERT policies scoped to `is_club_owner(club_id)` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (Supabase) | 15+ (Supabase-hosted) | DDL migrations, RLS, SECURITY DEFINER functions | Already in use; all existing migrations are plain SQL |
| Supabase migrations | project convention | Sequential numbered SQL files applied via Supabase MCP or dashboard | Established by migrations 001–011 + timestamped files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase MCP (`apply_migration`) | current | Apply SQL migrations to live Supabase project | All DDL changes in this phase |
| `createServiceClient()` from `@/lib/supabase/service` | project | Admin-only server-side Supabase client that bypasses RLS | Already used in `route.ts`; the `upsert` for `club_members` on approval uses service client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single migration file | Multiple files (one per requirement) | One file is atomic and keeps the migration log clean; multiple files risk partial-application state |
| SECURITY DEFINER function | Inline subquery in policy | Inline subquery against `club_members` itself causes infinite recursion — NOT viable |
| TEXT CHECK constraint on role | PostgreSQL ENUM type | CHECK constraint is simpler, doesn't require `ALTER TYPE` to add values, and follows existing project pattern (`status IN ('pending','approved','rejected')`) |

**Installation:** No new npm packages required. Pure SQL migration + one TypeScript line change.

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
└── 20260225000001_club_roles_and_invitations.sql   # all DBROLE-01 through DBROLE-07

src/app/api/admin/clubs/[id]/
└── route.ts    # DBROLE-06: change role: "organizer" → role: "owner" (line 93)
```

TypeScript types update (src/types/index.ts and src/lib/supabase/types.ts) are **not** part of Phase 5 — those belong to Phase 6 when application code consumes the new structures. However, the `ClubMember.role` type in `types/index.ts` currently has `role: string` which already accepts both values without a TypeScript change.

### Pattern 1: SECURITY DEFINER function — the `is_admin()` template

**What:** A `STABLE SECURITY DEFINER` SQL function that runs as its definer's role, bypassing RLS on the queried table. Required whenever an RLS policy on Table A needs to query Table A itself (infinite recursion risk) or needs to bypass RLS on Table B to check membership.

**When to use:** Any RLS policy that requires a cross-row query on the same table, or a privileged lookup that should not itself be subject to RLS.

**Exact template from `011_rls_audit.sql` (HIGH confidence — in the codebase):**
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  );
$$;
```

**Adapted for `is_club_owner(club_id UUID)`:**
```sql
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;
```

**Key properties that must all be present:**
- `LANGUAGE sql` (not plpgsql) — allows the Postgres optimizer to inline/cache
- `STABLE` — tells the planner the function does not modify the database and returns the same result for the same arguments within a single statement (enabling initPlan caching)
- `SECURITY DEFINER` — executes as the function owner (postgres role), bypassing RLS on `club_members`
- `SET search_path = public` — security hardening; prevents search_path injection attacks (required by Supabase security advisor)

### Pattern 2: Wrapping function calls in SELECT for initPlan caching

**What:** Wrapping `auth.uid()` and SECURITY DEFINER function calls in `(select ...)` triggers Postgres's initPlan mechanism, which evaluates the subquery once per statement rather than once per row.

**Source:** Supabase official RLS performance docs (verified via WebFetch)

```sql
-- Without caching (evaluated per row — slow):
USING (is_club_owner(club_id))

-- With initPlan caching (evaluated once per statement — fast):
USING ((select is_club_owner(club_id)))
```

**Important caveat:** This optimization only applies when the function result does NOT change based on row data. `is_club_owner(club_id)` takes the `club_id` from each row, so the result DOES vary per row. The `select` wrapper still prevents raw per-row `auth.uid()` overhead but does NOT eliminate per-row function execution for row-dependent arguments.

**For the self-removal guard in DELETE policy**, `auth.uid()` should be wrapped:
```sql
USING (is_club_owner(club_id) AND user_id != (select auth.uid()))
```

### Pattern 3: Idempotent migration — DROP IF EXISTS before CREATE

**What:** Every policy drop must use `DROP POLICY IF EXISTS` before `CREATE POLICY`. Every function uses `CREATE OR REPLACE FUNCTION`. Constraints use a DO block with exception handling.

**Source:** Established project convention in `011_rls_audit.sql` and `20260223000000_notifications_rls_and_dedup.sql` (both in codebase — HIGH confidence).

```sql
-- Policy idempotence:
DROP POLICY IF EXISTS "Policy name" ON public.table_name;
CREATE POLICY "Policy name" ON public.table_name ...;

-- Function idempotence:
CREATE OR REPLACE FUNCTION public.func_name() ...;

-- Constraint idempotence (CHECK constraints have no IF NOT EXISTS in PG):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'club_members'
      AND constraint_name = 'club_members_role_check'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_role_check
      CHECK (role IN ('owner', 'organizer'));
  END IF;
END $$;
```

### Pattern 4: Owner cross-row SELECT on club_members

**What:** An additional permissive SELECT policy. Postgres evaluates multiple permissive policies with OR logic — a row is visible if ANY policy returns true. The existing "Users see own memberships" policy remains; the new owner policy adds cross-club visibility.

```sql
DROP POLICY IF EXISTS "Club owners can view all club members" ON public.club_members;
CREATE POLICY "Club owners can view all club members"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));
```

Combined effect:
- Organizer (non-owner): sees only their own row (existing "Users see own memberships")
- Owner: sees their own row (existing policy) PLUS all members of their club (new policy)
- Admin: sees all rows (existing "Admins manage memberships")

### Pattern 5: Owner DELETE with self-removal guard

```sql
DROP POLICY IF EXISTS "Club owners can remove members" ON public.club_members;
CREATE POLICY "Club owners can remove members"
  ON public.club_members
  FOR DELETE
  TO authenticated
  USING (is_club_owner(club_id) AND user_id != (select auth.uid()));
```

The `user_id != (select auth.uid())` clause is the DB-level self-removal guard. An owner attempting to DELETE their own row will find `user_id = auth.uid()`, making the USING condition false, silently preventing the operation.

### Pattern 6: club_invitations table with owner-scoped RLS

```sql
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- Owners can SELECT invitations for their club
DROP POLICY IF EXISTS "Club owners can view club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can view club invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));

-- Owners can INSERT invitations for their club (server enforces club_id match)
DROP POLICY IF EXISTS "Club owners can create club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can create club invitations"
  ON public.club_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_club_owner(club_id));
```

**Note on token-based invitation lookup (Phase 7 concern):** When a user follows an invite link (`/invites/[token]`), the invitation must be read by the invitee — who is NOT an owner. This means the SELECT policy above will block the invitee from reading their own invitation. Phase 7 will need to handle this via a SECURITY DEFINER function or a service client lookup. This is OUT OF SCOPE for Phase 5 — Phase 5 only needs the table + owner policies to exist.

### Anti-Patterns to Avoid

- **Inline subquery against `club_members` in club_members policy:** `USING (EXISTS (SELECT 1 FROM club_members WHERE ...))` inside a `club_members` policy causes Postgres to infinitely recurse. This is why `is_club_owner()` MUST be SECURITY DEFINER.
- **Using `FOR ALL` instead of separate policies:** The `009_user_roles.sql` "Admins manage memberships" policy uses `FOR ALL` — this is legacy. New policies should be operation-specific per Supabase best practices. However, do NOT touch the existing admin policy to avoid regression risk.
- **Using service role to test RLS:** The success criteria explicitly require testing via authenticated client. Always use `createClient()` (anon key + user session) not `createServiceClient()` to verify RLS enforcement.
- **Omitting `SET search_path = public` on SECURITY DEFINER:** Supabase's security advisor flags this as a vulnerability. Always include it.
- **Forgetting `STABLE`:** Without `STABLE`, the Postgres planner cannot cache the function call, degrading query performance.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite recursion prevention | Complex view indirection or application-layer role checks | SECURITY DEFINER SQL function | Standard Postgres pattern; function executes as definer, bypassing RLS on queried table |
| Idempotent constraint creation | Migration rollback + replay | DO block with `information_schema.table_constraints` check | PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS` — the DO block is the idiomatic solution |
| Self-removal guard | Application-layer check before DELETE | `user_id != auth.uid()` in the DELETE policy USING clause | DB-level enforcement cannot be bypassed by client bugs |
| Token generation | Custom token string | `gen_random_uuid()` as default | Built-in PostgreSQL 13+ function; collision-resistant, no extension needed |

**Key insight:** The entire phase is SQL DDL — resist the temptation to add application-layer workarounds. Every enforcement mechanism must live at the database level so downstream API routes in Phase 7 can trust the data layer.

---

## Common Pitfalls

### Pitfall 1: RLS Infinite Recursion on club_members SELECT Policy
**What goes wrong:** Writing the owner SELECT policy as `USING (EXISTS (SELECT 1 FROM club_members WHERE club_id = club_members.club_id AND user_id = auth.uid() AND role = 'owner'))` causes Postgres to recursively evaluate the SELECT policy when reading from `club_members` inside the policy.
**Why it happens:** Postgres evaluates RLS policies by running them as part of the query plan. A policy on Table A that queries Table A triggers the same policies, creating an infinite loop.
**How to avoid:** The `is_club_owner()` SECURITY DEFINER function bypasses RLS when it queries `club_members`, breaking the recursion. This is exactly why the `is_admin()` pattern exists in `011_rls_audit.sql`.
**Warning signs:** Error message "infinite recursion detected in policy for relation 'club_members'" when testing the owner SELECT path.

### Pitfall 2: Existing Data Violates the New CHECK Constraint
**What goes wrong:** Running `ALTER TABLE club_members ADD CONSTRAINT ... CHECK (role IN ('owner', 'organizer'))` fails if any existing rows have `role` values other than 'owner' or 'organizer'.
**Why it happens:** PostgreSQL validates all existing rows when adding a CHECK constraint (unless `NOT VALID` is used).
**How to avoid:** Audit the remote `club_members` table before running the migration. The current codebase only ever inserts `role='organizer'` (line 93 of `route.ts`) — so all existing rows should satisfy the constraint. Verify via `SELECT DISTINCT role FROM club_members;` before migrating. If any unexpected values exist, they must be corrected first.
**Warning signs:** `ERROR: check constraint "club_members_role_check" is violated by some row`

### Pitfall 3: The "Admins manage memberships" Policy Uses an Inline Subquery Against `public.users`
**What goes wrong:** The existing policy in `009_user_roles.sql` uses `EXISTS (SELECT 1 FROM public.users WHERE ...)` — this is fine because it queries `users`, not `club_members`. However, if someone naively tries to migrate it to use `is_admin()` during this phase, they might accidentally DROP it and create a regression.
**Why it happens:** Phase 5 only touches `club_members` RLS to ADD new policies, not to modify the existing ones. The admin policy should be left untouched.
**How to avoid:** Only DROP/CREATE the three new policies: "Club owners can view all club members", "Club owners can remove members", and the invitations policies. Do NOT touch "Users see own memberships" or "Admins manage memberships".
**Warning signs:** Admin dashboard losing ability to manage club members after migration.

### Pitfall 4: Testing RLS with Service Role Instead of Authenticated Client
**What goes wrong:** Verifying that owners can see all members by running a query with the service role client. Service role bypasses RLS entirely — the test always passes, masking policy gaps.
**Why it happens:** `createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses all RLS. The success criterion explicitly says "via an authenticated client — not service role."
**How to avoid:** All RLS verification must use `createClient()` (the anon key + JWT session). Use the Supabase Dashboard "Table Editor with auth user" or write test queries via the SQL editor with `SET LOCAL role TO authenticated; SET LOCAL request.jwt.claims TO '{"sub":"<user_uuid>"}'`.
**Warning signs:** Tests pass but authenticated API routes fail with permission errors.

### Pitfall 5: Invitee Cannot Read Their Own Invitation Token Row
**What goes wrong:** The Phase 7 invitation acceptance flow (`/invites/[token]`) needs to read the invitation by token. But the Phase 5 RLS policy only allows club OWNERS to SELECT invitation rows. An invitee (who is just an authenticated user, not an owner) will get 0 rows when querying by token.
**Why it happens:** The Phase 5 SELECT policy uses `is_club_owner(club_id)`, which only passes for owners.
**How to avoid:** This is a known, intentional limitation of Phase 5. Phase 7 will add either: (a) a SECURITY DEFINER function `get_invitation_by_token(token UUID)` that bypasses RLS, or (b) an additional RLS policy `USING (invitee_email = (SELECT email FROM users WHERE id = auth.uid()))`. Document this as a Phase 7 dependency. Do NOT prematurely add invitee-access policies in Phase 5.
**Warning signs:** Phase 7 invitation acceptance returns 404 on valid tokens.

### Pitfall 6: Missing `(select auth.uid())` Wrapper on DELETE Policy
**What goes wrong:** Writing `user_id != auth.uid()` without the `select` wrapper causes `auth.uid()` to be called once per row, rather than being cached once per statement.
**Why it happens:** Supabase RLS performance best practice — `auth.uid()` is a stable function but the optimizer only caches it if wrapped in a `select`.
**How to avoid:** Always write `(select auth.uid())` in policy bodies, not bare `auth.uid()`.

---

## Code Examples

Verified patterns from the codebase and official sources:

### Complete migration file skeleton
```sql
-- =============================================
-- Migration: club_roles_and_invitations
-- Phase 5 v1.1 — DBROLE-01 through DBROLE-07
-- Idempotent: DROP IF EXISTS before CREATE; DO blocks for constraints
-- =============================================

-- DBROLE-01: CHECK constraint on club_members.role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'club_members'
      AND constraint_name = 'club_members_role_check'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_role_check
      CHECK (role IN ('owner', 'organizer'));
  END IF;
END $$;

-- DBROLE-02: is_club_owner() SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id  = p_club_id
      AND user_id  = auth.uid()
      AND role     = 'owner'
  );
$$;

-- DBROLE-05: Composite index for is_club_owner() performance
CREATE INDEX IF NOT EXISTS idx_club_members_club_role
  ON public.club_members(club_id, role);

-- DBROLE-03: Owner cross-row SELECT policy
DROP POLICY IF EXISTS "Club owners can view all club members" ON public.club_members;
CREATE POLICY "Club owners can view all club members"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));

-- DBROLE-04: Owner DELETE policy with self-removal guard
DROP POLICY IF EXISTS "Club owners can remove members" ON public.club_members;
CREATE POLICY "Club owners can remove members"
  ON public.club_members
  FOR DELETE
  TO authenticated
  USING (is_club_owner(club_id) AND user_id != (select auth.uid()));

-- DBROLE-07: club_invitations table
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_club_invitations_club_id ON public.club_invitations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_token   ON public.club_invitations(token);
CREATE INDEX IF NOT EXISTS idx_club_invitations_email   ON public.club_invitations(invitee_email);

DROP POLICY IF EXISTS "Club owners can view club invitations"   ON public.club_invitations;
CREATE POLICY "Club owners can view club invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (is_club_owner(club_id));

DROP POLICY IF EXISTS "Club owners can create club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can create club invitations"
  ON public.club_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_club_owner(club_id));

COMMENT ON TABLE public.club_invitations IS 'Pending invitations for club organizer access; token used for accept-link flow';
COMMENT ON COLUMN public.club_invitations.token IS 'UUID used as the invite URL token (/invites/[token]); unique per invitation';
```

### DBROLE-06: TypeScript route change (src/app/api/admin/clubs/[id]/route.ts)

Current code (line 90–96):
```typescript
await serviceClient.from("club_members").upsert(
  {
    user_id: club.created_by,
    club_id: id,
    role: "organizer",          // <-- WRONG: should be "owner"
  },
  { onConflict: "user_id,club_id" }
);
```

After change:
```typescript
await serviceClient.from("club_members").upsert(
  {
    user_id: club.created_by,
    club_id: id,
    role: "owner",              // DBROLE-06: creator becomes owner, not organizer
  },
  { onConflict: "user_id,club_id" }
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline admin check in `club_members` policy: `EXISTS (SELECT 1 FROM users WHERE ... 'admin' = ANY(roles))` | `public.is_admin()` SECURITY DEFINER function | `011_rls_audit.sql` (v1.0) | Eliminated recursion risk on users table; performance improvement |
| `FOR ALL` admin policy | Operation-specific policies | Supabase best practice (2024+) | Reduces over-granting; new policies should be operation-specific |
| `uuid_generate_v4()` (requires uuid-ossp extension) | `gen_random_uuid()` | PostgreSQL 13+ (Supabase PG 15) | Built-in function; no extension needed. Project uses both: `001_initial_schema.sql` uses `uuid_generate_v4()`, `009_user_roles.sql` uses `gen_random_uuid()` — either is fine, prefer `gen_random_uuid()` for new tables |

**Deprecated/outdated:**
- `auth.uid()` bare (without `select` wrapper) in USING clauses: still functional but not cache-friendly. New policies should use `(select auth.uid())`.
- Inline subqueries against the same table in policies: always causes or risks infinite recursion when the table has RLS enabled.

---

## Open Questions

1. **Existing club_members data with unexpected role values**
   - What we know: The only insert path in the codebase writes `role: "organizer"` — but the remote DB has been running and may have been modified manually or via other paths.
   - What's unclear: Whether any rows have role values other than 'organizer'.
   - Recommendation: First task in the migration plan should be a verification step: check `SELECT DISTINCT role FROM club_members;` before applying the constraint. If unexpected values exist, include a cleanup UPDATE in the migration before the ADD CONSTRAINT.

2. **Existing club_members rows with role='organizer' for club creators**
   - What we know: Any club approved before Phase 5 will have the creator in `club_members` with `role='organizer'` (the current code). After DBROLE-06 goes live, new approvals will get `role='owner'`, but existing creators remain 'organizer'.
   - What's unclear: Whether Phase 5 should backfill existing rows (e.g., first approved member of each club → promote to 'owner').
   - Recommendation: Include a backfill migration: `UPDATE club_members SET role = 'owner' WHERE (user_id, club_id) IN (SELECT created_by, id FROM clubs WHERE status = 'approved' AND created_by IS NOT NULL)`. This is safe and idempotent. Mark it as a required task.

3. **`club_invitations` invitee SELECT access (Phase 7 concern)**
   - What we know: Phase 5 RLS only allows owners to SELECT invitations. Phase 7 needs invitees to read their invitation by token.
   - What's unclear: Whether to add an invitee-access policy now or defer to Phase 7.
   - Recommendation: Defer to Phase 7. Document in Phase 5 plan as a known dependency gap.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — the `workflow` object only contains `research`, `plan_check`, and `verifier` keys. Nyquist validation is not configured. Skipping this section.

---

## Sources

### Primary (HIGH confidence)
- `/Users/adyanullah/Documents/GitHub/Event-Radar/supabase/migrations/011_rls_audit.sql` — exact `is_admin()` SECURITY DEFINER pattern used as template for `is_club_owner()`
- `/Users/adyanullah/Documents/GitHub/Event-Radar/supabase/migrations/009_user_roles.sql` — existing `club_members` table schema, existing RLS policies, existing indexes
- `/Users/adyanullah/Documents/GitHub/Event-Radar/src/app/api/admin/clubs/[id]/route.ts` — exact code location and line for DBROLE-06 change
- Supabase official RLS performance docs (WebFetch verified) — initPlan caching, SECURITY DEFINER patterns, `search_path` requirement
- Supabase official RLS guide (WebFetch verified) — owner-based cross-row policy structure, DELETE policy with guards
- `/Users/adyanullah/Documents/GitHub/Event-Radar/supabase/migrations/20260223000000_notifications_rls_and_dedup.sql` — idempotent DO block pattern for policy creation

### Secondary (MEDIUM confidence)
- boardshape.com team invite RLS article (WebFetch verified) — invitation table schema, `get_teams_with_owner_privilege_for_authenticated_user()` SECURITY DEFINER pattern; adapted for `is_club_owner()`
- Supabase troubleshooting guide on SECURITY DEFINER functions in RLS — confirmed no API exposure needed when used in policies only
- GitHub discussion supabase/supabase #1138, #3328 — infinite recursion root cause confirmation

### Tertiary (LOW confidence)
- General PostgreSQL docs on `gen_random_uuid()` and `ALTER TABLE ADD CONSTRAINT` idempotence — well-known standard behavior, but not specifically cross-verified against Supabase's PG version in this session.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling already in use; no new dependencies
- Architecture: HIGH — `is_club_owner()` pattern directly derived from `is_admin()` in codebase; verified against Supabase official docs
- Pitfalls: HIGH — infinite recursion risk and testing-with-service-role pitfalls verified from multiple sources; data migration concern (open question 2) derived from code inspection

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (Supabase RLS API is stable; no fast-moving risk)
