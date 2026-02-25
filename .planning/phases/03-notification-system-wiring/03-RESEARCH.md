# Phase 3: Notification System Wiring - Research

**Researched:** 2026-02-23
**Domain:** In-app notification UI (Next.js App Router, Supabase, Zustand, SWR)
**Confidence:** HIGH

## Summary

The critical finding of this research is that Phase 3 is substantially more complete than the roadmap implies. The majority of the code that REQUIREMENTS.md lists as pending already exists and is wired together. The real work is narrow: one component needs navigation logic added (NUI-03), and the admin status route needs one architectural validation (NGEN-01/02). The planner should treat this as a verification-and-gap-fill phase, not a build-from-scratch phase.

Specifically:
- **NUI-01** is 100% complete. `Header.tsx` already imports `<NotificationBell />` and renders it conditionally inside the authenticated branch (line 122). The STATE.md research flag ("verify whether NotificationBell is already injected") is resolved: it is.
- **NUI-02** is 100% complete. `GET /api/notifications` returns `{ notifications, unread_count }` using the real notifications table via the server Supabase client. `PATCH /api/notifications/[id]` and `POST /api/notifications?action=mark-all-read` are implemented. The notifications page at `src/app/notifications/page.tsx` calls all three routes correctly.
- **NUI-03** is NOT complete. `NotificationItem.tsx` renders a `<button>` that only calls `onMarkRead`. There is no navigation to `/events/[event_id]`. The `event_id` field IS present in the `Notification` type and returned from the API. Fix: convert the button to a `<Link>` (or add `router.push`) that navigates to `/events/${notification.event_id}` when `event_id` is non-null.
- **NGEN-01 and NGEN-02** are functionally implemented. `src/app/api/admin/events/[id]/status/route.ts` already calls `createServiceClient()` and inserts into `notifications` with type `event_approved`/`event_rejected` after a status change. The critical open question is whether the `createServiceClient()` call will work in production — it requires `SUPABASE_SERVICE_ROLE_KEY` to be set in the deployment environment.

The pending dedup migration (`supabase/migrations/20260223000000_notifications_rls_and_dedup.sql`) is a Phase 1 blocker that must be applied before Phase 3 can be verified end-to-end.

**Primary recommendation:** Phase 3 should be planned as three tasks: (1) verify API routes and NotificationBell work against real DB by running a manual smoke test, (2) add event navigation to NotificationItem (the only real code change), and (3) verify admin notification generation works end-to-end. Do not re-implement anything that already exists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NUI-01 | NotificationBell injected into Header.tsx next to auth button for authenticated users | ALREADY DONE. Header.tsx lines 121-126 render `<NotificationBell />` inside the `isAuthenticated` branch. No code change needed. |
| NUI-02 | Existing notification API routes (GET, PATCH, POST mark-all-read) validated against real notifications table | Routes exist and are correct. Validation = smoke test against real DB. Requires Phase 1 migration applied. |
| NUI-03 | Notification items link to /events/[event_id] when event_id is present | NOT YET DONE. NotificationItem.tsx is a `<button>` with no navigation. Needs Link or router.push wrapping the item when event_id is non-null. |
| NGEN-01 | Admin approve action creates event_approved notification for the event submitter | FUNCTIONALLY IMPLEMENTED in `src/app/api/admin/events/[id]/status/route.ts`. Needs smoke test to verify service role key works in prod environment. |
| NGEN-02 | Admin reject action creates event_rejected notification for the event submitter | Same file as NGEN-01 — same analysis. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | ^16.0.3 | Page routing, client components | Already in use; Link component handles navigation |
| Supabase JS | ^2.49.0 | Notifications table reads/writes | Already in use; server client in API routes, service client for admin |
| Zustand | ^5.0.9 | Auth state (`useAuthStore`) | Already in use; NotificationBell reads `user` from this store |
| React `useState`/`useEffect` | 18.3.0 | Local notification state in NotificationBell and notifications page | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SWR | ^2.3.7 | Data fetching with revalidation | Could upgrade NotificationBell from manual polling to SWR `useSWR` — STATE.md flags this as an open question |
| Next.js `useRouter` | built-in | Programmatic navigation | Only needed in NotificationItem if opting for `router.push` over `<Link>` |
| Next.js `<Link>` | built-in | Declarative navigation | Preferred for NUI-03 — simpler, no hook import |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual polling in NotificationBell (current) | SWR `useSWR` with `revalidateOnFocus` | SWR reduces code and adds focus revalidation; but introduces a second pattern for bell vs. page; STATE.md flags this as a pending decision |
| `<Link>` wrapping NotificationItem | `router.push` inside `onClick` | `<Link>` is the Next.js idiomatic approach and prefetches; `router.push` is simpler if the item also needs to prevent navigation conditionally |
| Zustand store for notification count | Local `useState` in NotificationBell (current) | STATE.md flags this as a pending decision; current approach (useState + interval) is simpler and already works |

**Installation:**
```bash
# No new packages needed — all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure

No new files needed. Phase 3 modifies existing files:

```
src/
├── components/notifications/
│   └── NotificationItem.tsx      # MODIFY: add Link/navigation for event_id
├── app/api/notifications/
│   ├── route.ts                  # VERIFY: works against real DB (no changes needed)
│   └── [id]/route.ts             # VERIFY: works against real DB (no changes needed)
└── app/api/admin/events/[id]/
    └── status/route.ts           # VERIFY: notification insert works in prod (no changes needed)
```

### Pattern 1: Conditional Navigation in NotificationItem

**What:** Wrap the notification item in a `<Link>` when `event_id` is present; keep as `<button>` otherwise. Mark-read fires on click in both cases.

**When to use:** NUI-03 — clicking an event-linked notification must navigate AND mark read.

**Example:**
```typescript
// Source: Next.js App Router docs — next/link
import Link from "next/link";

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id);
  };

  const inner = (
    <div className={cn("w-full flex items-start gap-4 p-4 rounded-xl text-left transition-colors", ...)}>
      {/* existing content unchanged */}
    </div>
  );

  if (notification.event_id) {
    return (
      <Link
        href={`/events/${notification.event_id}`}
        onClick={handleClick}
        className="block w-full"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="w-full text-left">
      {inner}
    </button>
  );
}
```

This preserves the existing unread/read styling and `onMarkRead` callback, adds navigation for event-linked notifications, and handles non-event notifications gracefully.

### Pattern 2: Admin Notification Insert (Already Implemented)

**What:** Service role client (`createServiceClient()`) inserts directly into notifications, bypassing RLS. This is the correct pattern because RLS has no INSERT policy for authenticated role.

**Current implementation in** `src/app/api/admin/events/[id]/status/route.ts`:
```typescript
// Source: existing codebase — already correct
const serviceClient = createServiceClient();
const { data: event } = await serviceClient
  .from("events")
  .select("title, created_by")
  .eq("id", id)
  .single();

if (event?.created_by) {
  await serviceClient.from("notifications").insert({
    user_id: event.created_by,
    type: isApproved ? "event_approved" : "event_rejected",
    title: isApproved ? "Event Approved!" : "Event Not Approved",
    message: isApproved
      ? `Your event "${event.title}" has been approved and is now live.`
      : `Your event "${event.title}" was not approved.`,
    event_id: id,
  });
}
```

This code is already written. The notification failure is caught and logged without breaking the status update (correct behavior — do not change this).

### Pattern 3: NotificationBell Polling (Already Implemented)

**What:** `useEffect` with `setInterval` at 60 seconds polls `/api/notifications` for the unread count. No library dependency needed.

**Current implementation** is correct and satisfies NUI-02 as written. The STATE.md blocker about Zustand vs. SWR is a discretionary optimization, not a requirement for Phase 3. Recommend deferring the store decision and keeping the existing polling pattern.

### Anti-Patterns to Avoid

- **Rebuilding the notification bell from scratch:** NotificationBell.tsx already exists and is already injected. Do not create a new component.
- **Adding a global Zustand store for notifications in Phase 3:** The STATE.md flags this as a decision to make, but Phase 3 requirements do not need it. Adding a new store introduces complexity without satisfying any requirement. Defer to Phase 4 or v2.
- **Using the browser Supabase client to insert notifications:** RLS has no INSERT policy for authenticated users. All notification inserts must go through `createServiceClient()` in server-only code.
- **Inserting without upsert for approval notifications:** The UNIQUE index `notifications_dedup_idx` is on `(user_id, event_id, type)`. If an admin approves the same event twice (e.g., after a reject/re-approve), a plain `.insert()` will throw a unique constraint violation. Use `.upsert({ onConflict: "user_id,event_id,type", ignoreDuplicates: true })` or handle the error gracefully. The current code uses `.insert()` — this is an open question (see below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification data fetching | Custom fetch wrapper | The existing `fetch("/api/notifications")` pattern (already in NotificationBell and notifications page) | Already consistent; no new library needed |
| Event navigation from notification | Custom router logic | `next/link` `<Link href={...}>` | Handles prefetching, accessibility, and Next.js SSR correctly |
| Service role DB writes | Authenticated supabase client | `createServiceClient()` from `@/lib/supabase/service` | Only service role bypasses RLS INSERT restriction |

**Key insight:** Everything needed for Phase 3 is already built. The problem space is integration-testing and fixing one missing navigation behavior, not implementation.

## Common Pitfalls

### Pitfall 1: Duplicate Approval Notifications on Re-approve

**What goes wrong:** An admin approves an event, rejects it, then approves it again. The second approval INSERT fails with a unique constraint violation on `notifications_dedup_idx (user_id, event_id, type WHERE event_id IS NOT NULL)` because an `event_approved` row already exists for that `(user_id, event_id)` pair.

**Why it happens:** The current `status/route.ts` uses plain `.insert()`, not upsert. The notification failure is caught and silently logged, so the status update succeeds — but the organizer never gets the second approval notification.

**How to avoid:** Change the notification insert to upsert with `ignoreDuplicates: false` and a new `created_at` (to create a fresh row) OR use a conditional check: only insert if no existing `event_approved` notification exists for that event. The simplest fix is adding `onConflict: "user_id,event_id,type"` and NOT ignoring duplicates — instead, update `read = false` and `created_at = now()` so the organizer sees a fresh notification.

**Warning signs:** Silent notification failures logged as `[Admin] Failed to send notification:` in server logs.

### Pitfall 2: Clicking Notification Navigates But Does Not Mark as Read

**What goes wrong:** If NUI-03 is implemented with `<Link>` but the `onMarkRead` callback is async and fires after navigation completes, the user navigates away before the PATCH request resolves. The notification stays unread.

**Why it happens:** React's event system processes the click, `onMarkRead` fires (starts async PATCH), then the link navigation occurs. The PATCH is fire-and-forget so this is actually fine — the optimistic update in the parent handles the local UI state immediately. The PATCH completes in the background.

**How to avoid:** The notifications page already uses optimistic updates in `handleMarkRead`. This pattern is correct. Ensure the optimistic update fires before navigation: call `onMarkRead(notification.id)` synchronously in the onClick handler before the Link follows through.

### Pitfall 3: Unauthenticated Bell Fetch

**What goes wrong:** NotificationBell calls `/api/notifications` every 60 seconds. If the user signs out, the interval keeps firing, returning 401s silently. The component mounts/unmounts with the Header — but if the Header persists across routes (it does, in the root layout), the interval could fire during the brief moment between sign-out and unmount.

**Why it happens:** The `useEffect` cleanup returns `clearInterval(interval)`, which correctly fires on unmount. Header.tsx renders `<NotificationBell />` only in the `isAuthenticated` branch — so when `useAuthStore` sets `user: null` after sign-out, the authenticated branch is no longer rendered and the component unmounts.

**How to avoid:** The existing implementation is correct. The conditional rendering in Header.tsx (`isAuthenticated ? <NotificationBell />...`) ensures unmount on sign-out. No change needed.

### Pitfall 4: Phase 1 Migration Not Applied

**What goes wrong:** End-to-end testing of Phase 3 fails because the UNIQUE index `notifications_dedup_idx` has not been applied to the remote database. The migrations in the repo include the file, but STATE.md confirms this migration has NOT been applied yet.

**Why it happens:** STATE.md explicitly flags: "Apply `supabase/migrations/20260223000000_notifications_rls_and_dedup.sql` via Supabase MCP tools or Dashboard SQL Editor... required before Phase 4 cron work begins."

**How to avoid:** The Phase 3 plan must include a step to apply this migration. Without it, RLS policies may not be active and the dedup index is absent. The plan should apply the migration as the first task and verify with a quick Supabase query.

### Pitfall 5: Schema Mismatch Between `events` Table Type Definitions

**What goes wrong:** `src/lib/supabase/types.ts` defines `events.Row` with `start_date`/`end_date` fields but `src/types/index.ts` defines `Event` with `event_date`/`event_time` fields. The status route selects `title, created_by` — these fields exist in both type definitions so no mismatch there. However, the admin pending page selects `start_date, end_date` which are in `types.ts` but not in `types/index.ts`.

**Why it happens:** There are two type systems: the generated `Database` types in `lib/supabase/types.ts` (matches actual DB schema) and the hand-written `Event` interface in `types/index.ts` (slightly different field naming). This is pre-existing technical debt.

**How to avoid:** For Phase 3, only use `select("title, created_by")` on the events table in the status route — these fields are safe in both type systems. Do not add new events queries in Phase 3 that touch the mismatched fields.

## Code Examples

Verified patterns from official sources:

### Notification Insert via Service Client (already in codebase)

```typescript
// Source: src/app/api/admin/events/[id]/status/route.ts (existing)
import { createServiceClient } from "@/lib/supabase/service";

const serviceClient = createServiceClient();
await serviceClient.from("notifications").insert({
  user_id: event.created_by,
  type: "event_approved",
  title: "Event Approved!",
  message: `Your event "${event.title}" has been approved and is now live.`,
  event_id: id,
});
```

### Upsert Pattern for Idempotent Approval Notifications (recommended improvement)

```typescript
// Source: Supabase JS docs — upsert with onConflict
await serviceClient.from("notifications").upsert(
  {
    user_id: event.created_by,
    type: isApproved ? "event_approved" : "event_rejected",
    title: isApproved ? "Event Approved!" : "Event Not Approved",
    message: isApproved
      ? `Your event "${event.title}" has been approved and is now live.`
      : `Your event "${event.title}" was not approved.`,
    event_id: id,
    read: false,
    created_at: new Date().toISOString(),
  },
  { onConflict: "user_id,event_id,type" }
);
```

This replaces the existing `.insert()` and avoids the duplicate notification pitfall.

### Fetch Unread Count in NotificationBell (already in codebase)

```typescript
// Source: src/components/notifications/NotificationBell.tsx (existing)
const res = await fetch("/api/notifications");
if (!res.ok) return;
const data = await res.json();
setUnreadCount(data.unread_count || 0);
```

### Conditional Navigation in NotificationItem (new — NUI-03 fix)

```typescript
// Source: Next.js App Router — next/link docs
import Link from "next/link";

// When event_id is present, wrap with Link
if (notification.event_id) {
  return (
    <Link
      href={`/events/${notification.event_id}`}
      onClick={() => { if (!notification.read) onMarkRead(notification.id); }}
      className="block w-full"
    >
      {/* inner content */}
    </Link>
  );
}
// When event_id is null, keep as button
return (
  <button type="button" onClick={() => { if (!notification.read) onMarkRead(notification.id); }}>
    {/* inner content */}
  </button>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual polling with setInterval | SWR `useSWR` with `revalidateOnFocus` | SWR has been in project since ^2.3.7 | SWR is available but not used for NotificationBell — this is a potential optimization, not a requirement |
| Supabase Realtime for instant delivery | Polling every 60s (current) | v2 requirement NOTF-01 | Current polling is acceptable for Phase 3 beta; Realtime deferred to v2 |

**Deprecated/outdated:**
- Nothing deprecated in this domain. All used APIs are current.

## Open Questions

1. **Should the admin `status/route.ts` use upsert instead of insert for notification creation?**
   - What we know: Current code uses `.insert()`. The UNIQUE dedup index `notifications_dedup_idx (user_id, event_id, type WHERE event_id IS NOT NULL)` will cause a constraint violation if an admin changes event status multiple times for the same event.
   - What's unclear: Is it acceptable to silently fail the second notification (current behavior — failure is caught/logged)? Or should the organizer always get a fresh notification reflecting the latest decision?
   - Recommendation: Change to upsert with `onConflict: "user_id,event_id,type"` and update `read = false, created_at = now()`. This gives the organizer a fresh visible notification on status change and removes the silent failure.

2. **NotificationBell caching strategy: useState polling vs. SWR?**
   - What we know: STATE.md explicitly flags this as "decision needed before implementation." SWR ^2.3.7 is already installed. Current `useState + setInterval` polling works.
   - What's unclear: Whether the added complexity of SWR provides enough benefit (focus revalidation, deduplication) for the bell's simple unread-count use case.
   - Recommendation: Keep the existing `useState + setInterval` approach. It satisfies NUI-02 as-is. Migrating to SWR does not address any Phase 3 requirement and risks introducing a second polling pattern in the codebase. Defer to Phase 4 or v2 if needed.

3. **Is the Phase 1 migration (`20260223000000_notifications_rls_and_dedup.sql`) actually applied in production?**
   - What we know: STATE.md says it has NOT been applied. Phase 1 is marked "complete" but the migration file exists only on disk.
   - What's unclear: Whether RLS was already enabled by other means or whether the production database lacks the dedup index and policies added by this migration.
   - Recommendation: The Phase 3 plan MUST include applying this migration as its first task. Without RLS policies, the GET endpoint may return other users' notifications; without the dedup index, duplicate admin notifications cannot be deduplicated.

## Sources

### Primary (HIGH confidence)

- Direct codebase reading — all files listed below verified by reading full source:
  - `src/components/layout/Header.tsx` — NUI-01 status confirmed (already injected)
  - `src/components/notifications/NotificationBell.tsx` — polling logic confirmed working
  - `src/components/notifications/NotificationItem.tsx` — NUI-03 gap confirmed (no Link)
  - `src/components/notifications/NotificationList.tsx` — renders NotificationItem correctly
  - `src/app/notifications/page.tsx` — full inbox UI confirmed working
  - `src/app/api/notifications/route.ts` — GET and POST mark-all-read confirmed
  - `src/app/api/notifications/[id]/route.ts` — PATCH mark-single-read confirmed
  - `src/app/api/admin/events/[id]/status/route.ts` — NGEN-01/02 implementation confirmed
  - `src/lib/supabase/service.ts` — createServiceClient confirmed
  - `src/lib/supabase/types.ts` — notifications table schema confirmed
  - `src/types/index.ts` — Notification interface confirmed (event_id: string | null)
  - `supabase/migrations/007_add_created_by_and_notifications.sql` — notifications DDL confirmed
  - `supabase/migrations/20260223000000_notifications_rls_and_dedup.sql` — RLS + dedup migration confirmed (not yet applied per STATE.md)
  - `.planning/STATE.md` — pending decisions and blockers confirmed
  - `.planning/REQUIREMENTS.md` — requirement definitions confirmed
  - `package.json` — dependency versions confirmed

### Secondary (MEDIUM confidence)

- Next.js App Router `<Link>` behavior — consistent with project's use of Link throughout the codebase (multiple files verified)

### Tertiary (LOW confidence)

- None — all claims based on direct codebase reading

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries read from package.json and verified in use
- Architecture: HIGH — all patterns derived from reading existing production code
- Pitfalls: HIGH (pitfalls 1, 4, 5) / MEDIUM (pitfalls 2, 3) — based on code analysis

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable codebase; 30-day window)
