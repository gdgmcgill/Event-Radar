# Phase 1: Notification Database Foundation - Research

**Researched:** 2026-02-23
**Domain:** Supabase PostgreSQL — DDL migrations, RLS policies, UNIQUE constraints, TypeScript type alignment
**Confidence:** HIGH

## Summary

This phase creates the `notifications` table in Supabase, establishes RLS policies, adds a UNIQUE constraint for deduplication, resolves the notification type string mismatch between the cron route and the UI component, and updates TypeScript types in `src/types/index.ts`. It is the prerequisite for all downstream notification work.

The critical finding from codebase inspection is that the infrastructure is almost completely written but blocked on a missing database table. `src/lib/supabase/types.ts` already contains a `notifications` table definition (with `read` as the boolean column name — not `is_read`). `NotificationItem.tsx` uses `event_reminder_24h` and `event_reminder_1h` as type string keys, but `src/app/api/cron/send-reminders/route.ts` inserts `reminder_24h` and `reminder_1h`. This naming mismatch must be corrected in the cron route to match the component (since `event_approved` and `event_rejected` in the admin route already use the correct prefix pattern). All application code that reads the `read` column (not `is_read`) is consistent — the REQUIREMENTS.md uses `is_read` in its description but the actual column across types.ts, NotificationItem.tsx, and the API route is `read`. The table must be created with `read` (not `is_read`) to match the existing codebase.

The table must be created using the Supabase MCP `apply_migration` tool, which is available in this environment. This tool applies DDL operations as tracked migrations and is the correct mechanism for schema changes. The `execute_sql` tool exists but is for non-DDL queries — DDL operations must use `apply_migration`.

**Primary recommendation:** Use `mcp__plugin_supabase_supabase__apply_migration` to create the table with RLS, UNIQUE constraint, and indexes in a single migration. Then update the cron route type strings and add the `Notification` interface to `src/types/index.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NINF-01 | Notifications table created in Supabase with columns: id, user_id, event_id, type, title, message, is_read, created_at | Use `apply_migration` with full CREATE TABLE DDL. Note: existing code uses column name `read` not `is_read` — the column must be named `read` to match existing application code. |
| NINF-02 | RLS enabled on notifications table with policies: SELECT own rows, INSERT service-role only, UPDATE own is_read only | Supabase RLS: `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`. Four policies: SELECT `auth.uid() = user_id`, INSERT `false` (service role bypasses RLS), UPDATE `auth.uid() = user_id`. |
| NINF-03 | UNIQUE constraint on (user_id, event_id, type) to prevent duplicate notifications | `UNIQUE (user_id, event_id, type)` in CREATE TABLE DDL. Requires `event_id` to be NOT NULL or a partial constraint for nullable event_id (see Architecture Patterns). |
| NINF-04 | Notification type strings aligned — cron route and NotificationItem both use event_reminder_24h, event_reminder_1h, event_approved, event_rejected | The cron route inserts `reminder_24h` and `reminder_1h`. Update `send-reminders/route.ts` lines 38, 44, 74, 80 to use `event_reminder_24h` and `event_reminder_1h`. |
| NINF-05 | TypeScript interfaces in src/types/index.ts compile without errors and reflect the notifications table schema | Add `Notification` interface to `src/types/index.ts` matching the `notifications` table Row type already defined in `src/lib/supabase/types.ts`. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase MCP `apply_migration` | Current (MCP tool) | DDL table creation with migration tracking | Official MCP tool for DDL; tracks schema changes; correct tool per tool description ("Use this when executing DDL operations") |
| Supabase PostgreSQL | 15.6+ (project version) | Underlying database; RLS, UNIQUE constraints, indexes | Already in use by all other tables |
| `@supabase/supabase-js` | Existing in project | SDK for RLS policy enforcement in application code | Already installed; all notification API routes use it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase MCP `execute_sql` | Current (MCP tool) | Non-DDL queries (verify table exists, check policies) | Verification only — NOT for table creation |
| Supabase MCP `list_migrations` | Current (MCP tool) | Check migration history | Use before applying to confirm no prior attempt |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `apply_migration` MCP tool | Supabase Dashboard SQL editor (manual) | MCP tool tracks migration in `supabase_migrations` table, reproducible; manual SQL editor does not create tracked migrations |
| `apply_migration` MCP tool | `execute_sql` MCP tool for DDL | `execute_sql` description explicitly says "Use `apply_migration` instead for DDL operations" — wrong tool for table creation |

**Installation:** No new packages required. Supabase MCP tools are already available in this environment (confirmed via ToolSearch).

## Architecture Patterns

### Recommended Project Structure

No new files needed beyond:
```
src/
├── types/
│   └── index.ts              # Add Notification interface here (NINF-05)
└── app/api/cron/
    └── send-reminders/
        └── route.ts          # Fix type strings: reminder_24h → event_reminder_24h (NINF-04)
```

The `src/lib/supabase/types.ts` `notifications` table Row definition already exists and does NOT need to change — it is the ground truth for column names.

### Pattern 1: Single Migration with Full Table DDL

**What:** Create the table, enable RLS, add policies, add indexes, and add UNIQUE constraint in one `apply_migration` call.

**When to use:** New table creation. Atomic — all constraints exist from the first row.

**Example:**
```sql
-- Migration name: create_notifications_table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS immediately (before any data can exist)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own notifications only
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: No direct INSERT for authenticated users (service role bypasses RLS)
-- Service role (used by cron and admin routes) bypasses RLS entirely.
-- authenticated role INSERT is blocked by omitting an INSERT policy.

-- Policy 3: Users can UPDATE only is_read on their own rows
-- (In practice: UPDATE policy scoped to own rows; column-level restriction
--  is enforced in the API route by only updating the `read` column)
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- UNIQUE constraint: prevent duplicate notifications from cron retries
-- NOTE: event_id is nullable (event_approved/rejected have event_id, but
-- system notifications might not). For nullable columns, standard UNIQUE
-- allows multiple NULLs. Use a partial unique index instead:
CREATE UNIQUE INDEX notifications_dedup_idx
  ON public.notifications (user_id, event_id, type)
  WHERE event_id IS NOT NULL;

-- For notifications where event_id IS NULL (no event context):
-- dedup on (user_id, type) — separate partial index
CREATE UNIQUE INDEX notifications_dedup_no_event_idx
  ON public.notifications (user_id, type)
  WHERE event_id IS NULL;

-- Performance indexes
CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read) WHERE read = FALSE;
```

**Source:** Supabase RLS docs (official), existing project patterns in `src/lib/supabase/types.ts`

### Pattern 2: Service Role Bypasses RLS — No INSERT Policy Needed

**What:** The `createServiceClient()` (service role key) bypasses all RLS policies. The cron route (`send-reminders`) and admin route (`status`) both use `createServiceClient()` for notification inserts. An authenticated user INSERT policy is therefore not needed — omitting it blocks direct INSERT attempts from the browser client, which is the desired behavior.

**When to use:** Any table where writes should only come from trusted server-side code.

**Example (from existing `status/route.ts`):**
```typescript
// Source: /Users/adyanullah/Documents/GitHub/Event-Radar/src/app/api/admin/events/[id]/status/route.ts
const serviceClient = createServiceClient();
await serviceClient.from("notifications").insert({
  user_id: event.created_by,
  type: "event_approved",  // correct — already uses right prefix
  title: "Event Approved!",
  message: `Your event "${event.title}" has been approved and is now live.`,
  event_id: id,
});
```

### Pattern 3: ON CONFLICT DO NOTHING for Cron Idempotency

**What:** The cron route currently does a manual SELECT-then-INSERT dedup check. Once the UNIQUE index exists, replace with `upsert({ onConflict: 'user_id,event_id,type', ignoreDuplicates: true })` or add `ON CONFLICT DO NOTHING` to the SQL.

**When to use:** Any insert that might be retried (cron jobs, webhook handlers).

**Example (upgrade to use UNIQUE constraint):**
```typescript
// Source: pattern from existing dedup logic in send-reminders/route.ts
// Replace the SELECT count + conditional insert with:
await supabase.from("notifications").upsert(
  {
    user_id: row.user_id,
    type: "event_reminder_24h",  // FIXED: was "reminder_24h"
    title: "Event Tomorrow",
    message: `"${event.title}" starts in about 24 hours.`,
    event_id: event.id,
  },
  { onConflict: "user_id,event_id,type", ignoreDuplicates: true }
);
```

### Pattern 4: TypeScript Interface in src/types/index.ts

**What:** The `Notification` interface is currently defined locally in `NotificationItem.tsx` (line 7-16). NINF-05 requires it to be in `src/types/index.ts`.

**Current state in NotificationItem.tsx:**
```typescript
// Source: /Users/adyanullah/Documents/GitHub/Event-Radar/src/components/notifications/NotificationItem.tsx
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  event_id: string | null;
  read: boolean;       // column is "read", not "is_read"
  created_at: string;
}
```

**What to add to src/types/index.ts:**
```typescript
// Add to src/types/index.ts
export type NotificationType =
  | "event_reminder_24h"
  | "event_reminder_1h"
  | "event_approved"
  | "event_rejected";

export interface Notification {
  id: string;
  user_id: string;
  event_id: string | null;
  type: NotificationType | string;  // string fallback for forward compatibility
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
```

Then update `NotificationItem.tsx` to import `Notification` from `@/types` rather than declaring it locally.

### Anti-Patterns to Avoid

- **Using `execute_sql` for table creation:** The MCP tool description explicitly states "Use `apply_migration` instead for DDL operations." Using `execute_sql` bypasses migration tracking.
- **Creating the table without RLS in the same migration:** If the table is created and RLS is added separately, a window exists where rows could be read/written without policy enforcement. Always `ENABLE ROW LEVEL SECURITY` in the same migration as `CREATE TABLE`.
- **Using a standard `UNIQUE(user_id, event_id, type)` constraint with nullable `event_id`:** PostgreSQL UNIQUE constraints treat NULLs as distinct values, so `UNIQUE(user_id, NULL, 'type')` would not prevent duplicates. Use partial UNIQUE indexes instead (see Pattern 1).
- **Naming the column `is_read` in the migration:** The existing `types.ts`, `NotificationItem.tsx`, and all API routes use `read` (boolean), not `is_read`. Creating the column as `is_read` would require changing 5+ files. The REQUIREMENTS.md description is misleading — match the existing code.
- **Updating `NotificationItem.tsx` type strings** to match the cron route: The correct direction is to fix the cron route to match the UI component. `event_reminder_24h` is the canonical form (consistent with `event_approved`, `event_rejected` prefix pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DDL migration tracking | Custom migration SQL script run manually | `apply_migration` MCP tool | Tracked in `supabase_migrations` table; reproducible |
| Duplicate notification prevention | Application-level SELECT-before-INSERT | PostgreSQL UNIQUE index + `ON CONFLICT DO NOTHING` | Database constraint is atomic; application check has TOCTOU race |
| RLS policy enforcement | Manual `WHERE user_id = $uid` in every query | Supabase RLS policies | Policies fire on every query regardless of how client is used |

**Key insight:** The database constraint approach for deduplication is strictly safer than the current application-level dedup check in the cron route — a database UNIQUE index prevents duplicates even if two concurrent cron invocations run simultaneously.

## Common Pitfalls

### Pitfall 1: Column Name `is_read` vs `read`

**What goes wrong:** REQUIREMENTS.md says `is_read` but the entire existing codebase uses `read`. Creating the column as `is_read` breaks `NotificationItem.tsx` (line 14: `read: boolean`), `src/lib/supabase/types.ts` (line 84: `read: boolean`), and both API routes which query `.eq("read", false)`.

**Why it happens:** REQUIREMENTS.md was written at the feature specification level without checking the existing implementation. The existing code is the ground truth.

**How to avoid:** Use `read` (not `is_read`) as the column name. The `types.ts` definition is the authoritative schema reference.

**Warning signs:** TypeScript errors on `Notification.read` property access.

### Pitfall 2: UNIQUE Constraint on Nullable Column

**What goes wrong:** PostgreSQL's standard `UNIQUE(user_id, event_id, type)` constraint does NOT prevent duplicate rows when `event_id IS NULL` — each NULL is considered distinct. Two rows with `(user_id='X', event_id=NULL, type='system_msg')` would both be allowed.

**Why it happens:** SQL standard behavior for NULLs in UNIQUE constraints.

**How to avoid:** Use two partial UNIQUE indexes:
- `WHERE event_id IS NOT NULL` — covers all reminder, approved, rejected notifications
- `WHERE event_id IS NULL` — covers system-level notifications without event context

**Warning signs:** Duplicate system notifications accumulating in the table despite the constraint appearing to be set.

### Pitfall 3: RLS Not Enabled Before First Data Write

**What goes wrong:** If RLS is enabled after the first notification row is written (e.g., during testing), a window existed where notifications were readable by any authenticated user. More practically: the table being created without policies means the admin status route's test insert would create data before access controls are in place.

**How to avoid:** Include `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY` in the same `apply_migration` call as `CREATE TABLE`, before any policy creation.

### Pitfall 4: Type String Fix Applied in Wrong Direction

**What goes wrong:** The cron route uses `reminder_24h`; the component uses `event_reminder_24h`. If the "fix" updates the component's `typeConfig` to match the cron route, the naming diverges from `event_approved` and `event_rejected` (which correctly use the `event_` prefix). This makes the type naming inconsistent.

**How to avoid:** Fix the cron route, not the component. `event_` prefix is the canonical form: `event_reminder_24h`, `event_reminder_1h`, `event_approved`, `event_rejected`. Four strings, one prefix pattern.

**Warning signs:** NotificationItem `typeConfig` keys no longer starting with `event_`.

### Pitfall 5: Missing `Notification` Type Export After Moving to types/index.ts

**What goes wrong:** `NotificationItem.tsx` exports its local `Notification` interface. If the interface moves to `src/types/index.ts` and `NotificationItem.tsx` switches to importing it, other files that imported `Notification` directly from `NotificationItem.tsx` will break.

**How to avoid:** Search for `from.*NotificationItem` imports before moving the interface. If any exist, update them to import from `@/types` instead.

**Warning signs:** TypeScript "Module has no exported member 'Notification'" errors.

## Code Examples

Verified patterns from codebase inspection:

### Existing Cron Route — Type Strings to Fix

```typescript
// Source: /Users/adyanullah/Documents/GitHub/Event-Radar/src/app/api/cron/send-reminders/route.ts
// BEFORE (incorrect):
.eq("type", "reminder_24h");           // line 38 — dedup check
type: "reminder_24h",                   // line 44 — insert
.eq("type", "reminder_1h");            // line 74 — dedup check
type: "reminder_1h",                   // line 80 — insert

// AFTER (correct — matches NotificationItem typeConfig keys):
.eq("type", "event_reminder_24h");
type: "event_reminder_24h",
.eq("type", "event_reminder_1h");
type: "event_reminder_1h",
```

### Admin Route — Already Correct (Reference Pattern)

```typescript
// Source: /Users/adyanullah/Documents/GitHub/Event-Radar/src/app/api/admin/events/[id]/status/route.ts line 48
type: isApproved ? "event_approved" : "event_rejected",
// Correct prefix. Cron route must match this pattern.
```

### Existing `types.ts` notifications Definition (Source of Truth)

```typescript
// Source: /Users/adyanullah/Documents/GitHub/Event-Radar/src/lib/supabase/types.ts line 76-116
notifications: {
  Row: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    event_id: string | null;
    read: boolean;           // ← column is "read", not "is_read"
    created_at: string;
  };
  // ...
  Relationships: [
    {
      foreignKeyName: "notifications_event_id_fkey";
      columns: ["event_id"];
      isOneToOne: false;
      referencedRelation: "events";
      referencedColumns: ["id"];
    },
  ];
};
```

This `types.ts` definition was presumably generated from or written to match the schema. The migration must produce columns that match these type definitions exactly.

### Supabase MCP Tool — apply_migration Usage Pattern

```
Tool: mcp__plugin_supabase_supabase__apply_migration
Parameters:
  project_id: [from list_projects]
  name: "create_notifications_table"   // snake_case
  query: [full DDL SQL as string]
```

The `project_id` must be obtained by calling `mcp__plugin_supabase_supabase__list_projects` first.

### Verification SQL After Migration

```sql
-- Verify table exists and RLS is enabled:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Verify policies:
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications';

-- Verify UNIQUE indexes:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications';
```

Run via `mcp__plugin_supabase_supabase__execute_sql` after migration.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual dedup check (SELECT count, then INSERT if 0) | UNIQUE index + `ON CONFLICT DO NOTHING` | Since PostgreSQL 9.5 (ON CONFLICT syntax) | Atomic, race-condition-free deduplication |
| Table-level UNIQUE constraint on nullable columns | Partial UNIQUE indexes (WHERE col IS NOT NULL) | Established PostgreSQL practice | Correctly handles nullable FK columns |
| RLS added post-hoc after table creation | RLS enabled in same migration as CREATE TABLE | Supabase best practice | Zero window of unprotected access |

**Note on existing manual dedup in `send-reminders/route.ts`:** The current SELECT-before-INSERT dedup check in the cron route will still work after the table is created, but it is vulnerable to race conditions if two cron instances overlap. The UNIQUE index makes it redundant (and the `ON CONFLICT DO NOTHING` pattern makes it unnecessary). The planner should decide whether to clean up the redundant check in Phase 1 or defer to Phase 4 (cron wiring).

## Open Questions

1. **Column name: `read` vs `is_read`**
   - What we know: ALL existing code uses `read`. REQUIREMENTS.md says `is_read`.
   - What's unclear: Whether REQUIREMENTS.md `is_read` was intentional (to rename the column) or a documentation oversight.
   - Recommendation: Use `read` (matching existing code). If `is_read` was intentional, the planner should flag it as a decision that requires updating 5+ files. HIGH confidence that `read` is correct based on direct code inspection.

2. **UNIQUE constraint scope for nullable `event_id`**
   - What we know: Standard `UNIQUE(user_id, event_id, type)` fails for NULLs in PostgreSQL.
   - What's unclear: Whether the project will ever have system notifications without an `event_id`. All current notification types (`event_reminder_24h`, `event_reminder_1h`, `event_approved`, `event_rejected`) have an `event_id`.
   - Recommendation: Use a single partial UNIQUE index `WHERE event_id IS NOT NULL` for now. If system notifications (no event_id) are added in a future phase, add the second partial index then.

3. **Whether to remove the redundant manual dedup check in the cron route**
   - What we know: The manual SELECT count + conditional insert in `send-reminders/route.ts` becomes redundant once the UNIQUE index exists.
   - What's unclear: Phase boundary — is this cleanup work for Phase 1 (touching the cron route for type strings anyway) or Phase 4 (cron-specific work)?
   - Recommendation: Clean it up in Phase 1 since the cron route must be touched anyway to fix type strings. Remove the `count` query + `if (count && count > 0) continue;` blocks. Replace with `upsert({ ignoreDuplicates: true })`.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/lib/supabase/types.ts` (notifications table Row definition), `src/components/notifications/NotificationItem.tsx` (Notification interface, typeConfig keys), `src/app/api/cron/send-reminders/route.ts` (type strings used), `src/app/api/admin/events/[id]/status/route.ts` (correct type strings), `src/app/api/notifications/route.ts` (column name `read` usage)
- Supabase MCP `apply_migration` tool description: "Applies a migration to the database. Use this when executing DDL operations."
- Supabase MCP `execute_sql` tool description: "Use `apply_migration` instead for DDL operations."
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS enable + policy syntax
- `.planning/research/PITFALLS.md` — Pitfall 1 (UNIQUE constraint), Pitfall 2 (RLS), Pitfall 5 (type string mismatch)
- `.planning/research/ARCHITECTURE.md` — Anti-Pattern 5 (type naming), suggested build order Step 1-2

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — architecture overview, phase rationale, type string mismatch documented
- [Building a Real-time Notification System with Supabase and Next.js (makerkit.dev)](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — RLS pattern for notifications, column naming convention

### Tertiary (LOW confidence)
- None required — all claims verified from primary sources.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — MCP tools confirmed available via ToolSearch; Supabase patterns verified from official docs and direct code inspection
- Architecture: HIGH — based entirely on direct codebase inspection of all relevant files
- Pitfalls: HIGH — column name mismatch verified by reading actual source files; UNIQUE/NULL behavior is documented PostgreSQL behavior; type string mismatch confirmed by reading both files

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — Supabase DDL patterns, PostgreSQL UNIQUE index behavior)
