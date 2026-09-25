---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
reviewed: 2026-09-25T06:34:50Z
depth: standard
files_reviewed: 88
files_reviewed_list:
  - scripts/pgtap-mutation-check.sh
  - src/app/admin/layout.tsx
  - src/app/api/admin/calculate-popularity/route.ts
  - src/app/api/admin/clubs/[id]/route.ts
  - src/app/api/admin/events/[id]/edits/route.ts
  - src/app/api/admin/events/[id]/status/route.ts
  - src/app/api/admin/organizer-requests/[id]/route.ts
  - src/app/api/admin/organizers/route.ts
  - src/app/api/admin/reports/[id]/route.ts
  - src/app/api/admin/reports/route.ts
  - src/app/api/admin/users/[id]/ban/route.ts
  - src/app/api/admin/users/[id]/route.ts
  - src/app/api/clubs/[id]/analytics/route.ts
  - src/app/api/clubs/[id]/appeal/route.ts
  - src/app/api/clubs/[id]/events/route.ts
  - src/app/api/clubs/[id]/follow/route.ts
  - src/app/api/clubs/[id]/invites/route.ts
  - src/app/api/clubs/[id]/members/role/route.ts
  - src/app/api/clubs/[id]/members/route.ts
  - src/app/api/clubs/[id]/route.ts
  - src/app/api/clubs/[id]/transfer/route.ts
  - src/app/api/clubs/banner/route.ts
  - src/app/api/clubs/logo/route.ts
  - src/app/api/clubs/route.ts
  - src/app/api/events/[id]/analytics/route.ts
  - src/app/api/events/[id]/appeal/route.ts
  - src/app/api/events/[id]/friends/route.ts
  - src/app/api/events/[id]/invite/route.ts
  - src/app/api/events/[id]/report/route.ts
  - src/app/api/events/[id]/reviews/route.ts
  - src/app/api/events/[id]/route.ts
  - src/app/api/events/[id]/rsvp/route.ts
  - src/app/api/events/[id]/save/route.ts
  - src/app/api/events/create/route.ts
  - src/app/api/events/following/route.ts
  - src/app/api/events/friends-activity/route.ts
  - src/app/api/events/friends-organizing/route.ts
  - src/app/api/events/upload-image/route.ts
  - src/app/api/feedback/route.ts
  - src/app/api/interactions/route.ts
  - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
  - src/app/api/notifications/[id]/route.ts
  - src/app/api/notifications/route.ts
  - src/app/api/onboarding/complete/route.ts
  - src/app/api/organizer-requests/route.ts
  - src/app/api/profile/avatar/route.ts
  - src/app/api/profile/banner/route.ts
  - src/app/api/profile/inferred-tags/route.ts
  - src/app/api/profile/interests/route.ts
  - src/app/api/recommendations/batch/route.ts
  - src/app/api/recommendations/feedback/route.ts
  - src/app/api/user/engagement/route.ts
  - src/app/api/users/[id]/follow/route.ts
  - src/app/api/users/[id]/route.ts
  - src/app/api/users/me/suggestions/route.ts
  - src/app/auth/callback/route.ts
  - src/app/auth/signout/route.ts
  - src/app/moderation/audit-log/page.tsx
  - src/app/moderation/layout.tsx
  - src/app/moderation/page.tsx
  - src/app/users/[id]/page.tsx
  - src/instrumentation.ts
  - src/lib/audit.ts
  - src/lib/ban.ts
  - src/lib/env.ts
  - src/lib/roles.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/service.ts
  - src/lib/supabase/types.ts
  - src/middlewareRateLimit.ts
  - src/proxy.ts
  - src/server/authz/requireActiveUser.ts
  - src/server/authz/requireClubRole.ts
  - src/server/authz/requireOnboarded.ts
  - src/server/context.ts
  - src/server/csrf.ts
  - src/server/db/elevated/index.ts
  - src/server/ratelimit/index.ts
  - src/server/ratelimit/memoryStore.ts
  - src/server/ratelimit/policy.ts
  - src/server/ratelimit/types.ts
  - src/server/ratelimit/upstashStore.ts
  - supabase/migrations/20260923120000_events_insert_club_scope.sql
  - supabase/migrations/20260923130000_users_grants_audit_log_insert.sql
  - supabase/tests/database/050-users-privilege-escalation.test.sql
  - supabase/tests/database/055-admin-audit-log-insert.test.sql
  - supabase/tests/database/060-club-tenant-isolation.test.sql
findings:
  critical: 2
  warning: 10
  info: 15
  total: 27
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-09-25T06:34:50Z
**Depth:** standard
**Files Reviewed:** 88
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed every file in scope against the intended behaviour changes in `evidence/PHASE-5-COMPLETION.md`, and did not report any of them as regressions. The guard seam holds up well. `requireUser`, `requireActiveUser`, `requireOnboarded`, `requireRole` and `requireClubRole` all fail closed. Every admin arm in scope opens with `requireActiveUser` and then `requireRole(ctx, "admin")`. Every elevated write I traced runs after its gate. No handler takes identity from the request body where it matters: `rsvp` compares the body id to `ctx.user`, and the recommendation-feedback fallback is dead code, as DI-44 already records.

The two blockers are both in areas this phase claims to have closed:

1. **CR-01.** The events INSERT policy (F-008) can be bypassed through the untouched `events` UPDATE policy. A creator inserts a pending event, then PATCHes `status` and `club_id` directly through PostgREST. The same hole lets a creator reverse admin suspensions and rejections, and skip the title/image moderation. No pgTAP row covers it.
2. **CR-02.** Building the Upstash store can throw before the proxy's `try` block. One malformed or whitespace-padded Upstash URL then makes every request, pages included, answer 500. The boot check still passes, because it only checks that the variables are present. This contradicts the "availability over limiting" contract the store documents.

The warnings cover:

- admin approval of pending edits copying arbitrary keys onto the event
- the club ownership transfer, which a self-transfer can leave with no owner
- unscoped elevated writes
- per-path rate-limit keys, which do not bound a stolen admin session
- the pgTAP mutation harness leaving migrations mutated if interrupted
- notification writes that silently fail on the cookie client

## Critical Issues

### CR-01: F-008 is still bypassable at the RLS ring via the unchanged `events` UPDATE policy (and admin moderation is reversible by the creator)

**File:** `supabase/migrations/20260923120000_events_insert_club_scope.sql:111-135` (no UPDATE counterpart); baseline policy `supabase/migrations/20260915214553_baseline.sql:2157`; missing coverage in `supabase/tests/database/060-club-tenant-isolation.test.sql`

**Issue:** The migration restricts INSERT so that only a member of an approved club can insert `status = 'approved'`. But the baseline policy `"Organizers can update own events" FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by)` has no column or transition limit. `events` also still has `GRANT ALL … TO authenticated`. Any signed-in user can therefore, with their own anon-key JWT:

1. `POST /rest/v1/events {"title":…,"created_by":"<me>","status":"pending","club_id":"<victim club>"}`. DEC-42 allows this, and 060 test 7 pins it as allowed.
2. `PATCH /rest/v1/events?id=eq.<that id> {"status":"approved"}`. USING and WITH CHECK only compare `created_by`, so the update passes.

The result is exactly what F-008 describes: an approved event published under a club the caller does not belong to, with no moderation.

The same policy also lets a creator:

- set `status` from `suspended` or `rejected` back to `approved`, undoing admin moderation done through `admin/events/[id]/status`;
- clear `deleted_at` on an event an admin or club member soft-deleted;
- write `title` and `image_url` directly, skipping the `MODERATED_FIELDS` / `pending_edits` flow in `src/app/api/events/[id]/route.ts:258-268`;
- move an approved event into another club with `club_id`.

The completion note's "a forged or cross-club approved event is refused by the database" is therefore not true of the ring as built. Nothing in 060 exercises UPDATE on `events`.

**Fix:** Add a fix-forward migration with a BEFORE UPDATE trigger that stops non-admin callers from changing moderated columns. The one transition the appeal route needs (rejected or suspended → pending) stays allowed. Then add 060 rows for each denied transition (42501) and for the permitted appeal reset.

```sql
CREATE OR REPLACE FUNCTION public.events_guard_moderated_update()
  RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.role()) = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status IN ('rejected','suspended') AND NEW.status = 'pending') THEN
      RAISE EXCEPTION 'events.status is moderated' USING ERRCODE = '42501';
    END IF;
    IF NEW.club_id IS DISTINCT FROM OLD.club_id
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'events.club_id / undelete is moderated' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_guard_moderated_update BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_guard_moderated_update();
```

Also decide whether direct `title` and `image_url` writes on an approved event should be refused unless the caller is a member of the event's club, to match the handler's `needsModeration` rule. Record the decision.

### CR-02: A malformed Upstash URL makes the proxy throw outside its `try`, so every request (pages included) answers 500 while the boot check passes

**File:** `src/proxy.ts:64`; `src/server/ratelimit/index.ts:34-47`; `src/server/ratelimit/upstashStore.ts:43-45`; `src/lib/env.ts:114-145`; `src/instrumentation.ts:76-80`

**Issue:** The proxy's first statement, `applyRateLimit(request, getRateLimitStore())`, sits outside the `try/catch`. `getRateLimitStore()` builds `new UpstashRateLimitStore(config)`, which calls `new Redis({ url, token })`. `@upstash/redis` throws `UrlError` synchronously when the URL does not match `/^https?:\/\/[^\s#$./?].\S*$/` (`node_modules/@upstash/redis/nodejs.js:136-138`). Two things make that likely:

- `upstashConfig()` checks the variables with `present()`, which trims, but returns the untrimmed values.
- The boot check only asks whether a pair is present.

So any of the following passes `register()`:

- a value with a trailing space or newline, a common paste artefact;
- a `rediss://…` TCP URL copied instead of the REST URL;
- the Marketplace's `KV_URL` value pasted into `KV_REST_API_URL`.

Once one of those is set:

- every proxy invocation throws;
- `selected` is never assigned, so the throw repeats on every request;
- Next answers every matched route with a 500, including `/` and the landing page.

The module's own contract says the opposite: "A store outage therefore slows no request by more than a second and fails none" (`upstashStore.ts:16-21`). Owner action (a)(2) walks the owner directly onto this path before the first push.

**Fix:** Trim and validate in `upstashConfig()`, refuse at boot, and make selection unable to throw at request time:

```ts
// env.ts
const url = upstashUrl?.trim(); const token = upstashToken?.trim();
if (url && token) {
  if (!/^https:\/\/\S+$/.test(url)) throw new InvalidEnvError("UPSTASH_REDIS_REST_URL", "an https REST URL");
  return { url, token };
}
// index.ts select()
try { selected = { kind: "upstash", store: new UpstashRateLimitStore(config) }; }
catch (err) {
  console.error("[RateLimit] Upstash store construction failed; using memory store", err);
  selected = { kind: "memory", store: memoryStore };
}
```

Also move the rate-limit call inside the proxy's `try`, or give it its own fail-open `try`, so that no rate-limit fault can ever answer 500.

## Warnings

### WR-01: Approving pending edits copies every key the creator stored in `pending_edits` onto the event, with admin privileges

**File:** `src/app/api/admin/events/[id]/edits/route.ts:64-79`

**Issue:** `liveUpdates` is built from every key in `pending_edits` except `submitted_at`. The handler only writes `title` and `image_url` into `pending_edits`, but the creator can write the column directly through PostgREST under the same UPDATE policy as CR-01. An example payload is `{"title":"x","created_by":"<victim>","club_id":"<other club>","status":"approved"}`. When an admin clicks "approve edits", the update runs on the admin's cookie client under "Admins can update any event". Every key is applied, including a `created_by` reassignment that the creator's own WITH CHECK would refuse. The audit row's `approved_fields` would list the forged keys, but the moderation UI may not show them.

**Fix:** Whitelist the moderated fields:

```ts
const MODERATED = ["title", "image_url"] as const;
for (const key of MODERATED) if (key in pendingEdits) liveUpdates[key] = pendingEdits[key];
```

### WR-02: Transferring ownership to yourself leaves the club with no owner; the rollback restores the wrong role; the audit write is unchecked

**File:** `src/app/api/clubs/[id]/transfer/route.ts:32-91`

**Issue:** A self-transfer runs as follows:

1. With `newOwnerId === user.id`, `targetMember` is the caller's own owner row.
2. Line 58 sets it to `owner`, which changes nothing.
3. Lines 69-73 demote `(clubId, user.id)`, the same row, to `organizer`.
4. The club now has no owner, so every owner-gated route (PATCH, DELETE, invites, members, role, transfer) answers 403. Only an admin can recover it.

The elevated door made this reachable: F-087 and DEC-41 now route the write through it, and it used to 500. Two smaller problems:

- The rollback on line 77-80 sets the target back to `owner` rather than to its original `targetMember.role`. A failed demotion therefore leaves two owners.
- The audit insert on lines 85-91 ignores its error, unlike the DELETE arm. That contradicts F-073's "never silent".

**Fix:** Refuse `newOwnerId === user.id` with a 400 before any write. Roll back to `targetMember.role`. Check and log the audit `error` as `clubs/[id]` DELETE does. Better still, do the swap in a single SQL function inside one transaction.

### WR-03: Elevated role write in `members/role` is not scoped to the club or to non-owner rows, and the endpoint is a functional no-op

**File:** `src/app/api/clubs/[id]/members/role/route.ts:32-68`

**Issue:** The service-role update filters only on `.eq("id", memberId)`. The club scope and the "not the owner" rule rest on an earlier read on the cookie client, which is a check-then-act on an RLS-bypassing write. For example, a transfer that lands between the read and the write gets its new owner demoted to organizer, and the club ends up ownerless. Separately, the guard admits only `role === "organizer"`, and `CLUB_ROLES` is `owner | organizer`. Since the target can never be the owner, it is always already an organizer, so the route can only perform a no-op.

**Fix:** Scope the elevated write so it cannot touch an owner or another club's row:

```ts
.update({ role }).eq("id", memberId).eq("club_id", clubId).neq("role", "owner")
```

Then check that exactly one row changed. Decide whether this route should exist at all while there is only one non-owner role.

### WR-04: Rate-limit keys include the full pathname, so the admin budget does not bound a stolen admin session or script, and `x-real-ip` is trusted unconditionally

**File:** `src/server/ratelimit/policy.ts:45-56, 81-92, 123`

**Issue:** The key is `${method}:${pathname}:${ip}`, so every id-bearing path gets its own bucket. A script holding an admin cookie can call `POST /api/admin/users/<id>/ban` at 120 per minute for each user id, with no cap across ids. That contradicts the ADMIN_BUDGETS rationale ("bounds a stolen admin session or a runaway script"). The same applies to public writes such as `/api/events/<id>/report` and `/api/users/<id>/follow`.

`clientIp` also prefers `x-real-ip` on every deployment. Off Vercel (local `next start`, the Playwright harness, any self-host), that header is client-supplied, so a caller can rotate it and get a fresh bucket on every request.

**Fix:** Add a second, coarser bucket per IP and scope (for example `admin-mutation:${ip}`, 300 per minute) checked alongside the per-path bucket. Read `x-real-ip` only when `process.env.VERCEL === "1"`, and otherwise fall back to the socket or first-hop address.

### WR-05: An admin cannot re-ban a user whose temporary ban has expired

**File:** `src/app/api/admin/users/[id]/ban/route.ts:84-90`

**Issue:** The "already banned" check is `if (targetUser.banned_at)`. Expiry never clears `banned_at`, since only the DELETE arm does. After a 7-day ban lapses, `isBanned()` is false and the user is active again, but a new ban returns 409 "User is already banned" until an admin first "unbans" a user who is not banned.

**Fix:** Select `ban_expires_at` too and test `isBanned(targetUser)` from `@/lib/ban` instead of the raw column.

### WR-06: The pgTAP mutation harness has no signal trap, so an interrupted run leaves a security policy commented out in a migration

**File:** `scripts/pgtap-mutation-check.sh:84, 240-281`

**Issue:** The script rewrites migrations in place, for example commenting out `"Users can update own profile"` or `"Authenticated users can insert events"`. It restores them only in the normal loop body, via `git checkout --` at line 281. `set -e` is off by design and no `trap` exists. A Ctrl-C, a terminal close, or a CI timeout during the roughly 2N+1 `db reset` rounds therefore leaves a migration with its policy removed, and the end-of-run clean check (lines 313-319) never runs. Any later `db push` or commit of that tree ships the table without its policy.

**Fix:**

```bash
restore() { git checkout -- "${MIGRATIONS[@]}"; }
trap 'restore; exit 130' INT TERM
trap 'restore' EXIT
```

Install this right after `MIGRATIONS` is built and before the first mutation.

### WR-07: Check-then-update without a conditional filter in admin review routes allows double processing

**File:** `src/app/api/admin/organizer-requests/[id]/route.ts:51-65`; `src/app/api/admin/reports/[id]/route.ts:42-56`

**Issue:** Both routes read `status === "pending"` and then update with only `.eq("id", id)`. Two moderators, or a double click, both pass the read. For organizer requests, that duplicates the elevated roles write (a read-modify-write that can drop a concurrently granted role), the membership upsert, the notification and the audit row. The edits route (`.not("pending_edits","is",null)` plus a row count) and the appeal routes (`.eq("status", …)`) already do this correctly.

**Fix:** Add `.eq("status", "pending").select("id")` to the update and answer 409 when no row changed, before any side effect.

### WR-08: Guarded handlers throw on malformed or non-object bodies and return Next's HTML 500 instead of a JSON 400

**File:** `src/app/api/admin/users/[id]/route.ts:29-36, 59-61`; `src/app/api/admin/clubs/[id]/route.ts:22`; `src/app/api/admin/events/[id]/status/route.ts:22`; `src/app/api/admin/events/[id]/edits/route.ts:22`; `src/app/api/admin/organizer-requests/[id]/route.ts:21`; `src/app/api/admin/reports/[id]/route.ts:20`; `src/app/api/clubs/[id]/route.ts:195`; `src/app/api/clubs/[id]/transfer/route.ts:32`; `src/app/api/clubs/[id]/members/role/route.ts:32`; `src/app/api/clubs/route.ts:51, 121-125`; `src/app/api/organizer-requests/route.ts:17`; `src/app/api/events/[id]/appeal/route.ts:20`; `src/app/api/clubs/[id]/appeal/route.ts:20`; `src/app/api/events/[id]/report/route.ts:22`

**Issue:** These arms have no surrounding `try`. Either of the following throws to the framework, which answers with an HTML 500 and no `console.error` context:

- `await request.json()` on an invalid body;
- `"roles" in body` or `body.x?.trim()` on `null`, a string, or a number.

In `admin/users/[id]`, `updateData.name = body.name` also writes any JSON type through the elevated door, and name changes are not audited.

**Fix:** Parse bodies with `try { body = await request.json() } catch { return badRequest("Invalid JSON body") }` and reject anything that is not a plain object. `rsvp` and `reviews` already do this. Validate `name` as a trimmed string of 2-50 characters and include it in the audit metadata.

### WR-09: Club link fields accept `javascript:` and non-string values on the elevated write path

**File:** `src/app/api/clubs/[id]/route.ts:96-118`; `src/app/api/clubs/route.ts:113-128`

**Issue:** `new URL(value)` accepts `javascript:alert(1)`, so `website_url`, `discord_url`, `twitter_url` and `linkedin_url` pass validation. `src/app/clubs/[id]/page.tsx:247-280` renders them as `href`. `logo_url` and `banner_url` are not validated at all. Non-string values of any JSON type pass straight through `updates[field] = value` to a service-role write, and the handler's own comment calls the whitelist "the control that replaces RLS". React 19's `javascript:` URL blocking in the App Router probably stops script execution, but the server should not rely on the renderer. `events/create` already enforces `http:`/`https:` for `rsvp_link`.

**Fix:** For each URL field, require `typeof value === "string"` and `["http:", "https:"].includes(new URL(value).protocol)`. Reject non-string values for every whitelisted field.

### WR-10: Notifications inserted on the cookie client always fail silently

**File:** `src/app/api/events/create/route.ts:213-229`; `src/app/api/events/[id]/invite/route.ts:69-87`; `src/app/api/users/[id]/follow/route.ts:66-90`

**Issue:** `notifications` INSERT is `TO service_role` only (baseline line 2173, which other handlers' comments in this phase restate). These three handlers insert on `ctx.supabase` and ignore the returned `error`:

- `invite` reports `{ sent: N }` even when both the invite upsert and the notifications fail;
- the club follower fanout never delivers;
- friend and new-follower notifications never deliver.

DEC-49 moved every other cross-user notification to the elevated door and missed these three. That leaves Validated workflow 13 partially broken with nothing in the logs.

**Fix:** Route these inserts through `getElevatedClient()` with a REGISTRY row, the same "Notify another user" row the admin routes use. Check `error` on both the invite upsert and the notification insert, and do not report `sent` for rows that were not written.

## Info

### IN-01: The proxy matcher skips any path ending in an image extension, including `/api/**`

**File:** `src/proxy.ts:241`
**Issue:** `.*\.(?:svg|png|jpg|jpeg|gif|webp)$` is not anchored away from `/api/`, so a request like `POST /api/<segment>.png` skips both the CSRF check and the rate limiter. No state-changing route in scope takes a free-form final segment today, so this is latent.
**Fix:** Prefix the exclusion with a negative lookahead for `api/`, or exclude only static folders.

### IN-02: The `getRequestContext` rationale is factually wrong under the App Router

**File:** `src/server/context.ts:97-122`
**Issue:** The App Router resolves `react` to Next's vendored canary, and `node_modules/next/dist/compiled/react/cjs/react.react-server.production.js` does export `cache`. So memoization is active in layouts, pages and `generateMetadata`. That is safe, but the comment says it never happens.
**Fix:** Correct the comment so nobody later "fixes" behaviour on the basis of it.

### IN-03: Dead production exports

**File:** `src/middlewareRateLimit.ts:37`; `src/server/ratelimit/index.ts:55`
**Issue:** Only tests call `applyApiRateLimit`, and nothing calls `rateLimitStoreKind()`.
**Fix:** Mark both as test and health scaffolding, or remove them.

### IN-04: `ADMIN_PREFIX` has no trailing slash

**File:** `src/server/ratelimit/policy.ts:36, 107`
**Issue:** `/api/adminfoo` would be budgeted as admin.
**Fix:** Test `pathname === "/api/admin" || pathname.startsWith("/api/admin/")`.

### IN-05: The CSRF origin comparison ignores the scheme and does not normalize default ports in `Host`

**File:** `src/server/csrf.ts:40-60`
**Issue:** `http://host` passes against an https request. A `Host: example.com:443` header would not match the browser's `example.com` Origin, which would be a false 403.
**Fix:** Compare `new URL(origin).origin` against `${proto}://${host}`, using `x-forwarded-proto`, after normalizing default ports.

### IN-06: The onboarding guard can be satisfied by the user with one direct call

**File:** `src/app/api/users/[id]/route.ts:160-169`; `supabase/migrations/20260923130000_users_grants_audit_log_insert.sql:105`
**Issue:** `PATCH /api/users/<me> {"onboarding_completed":true}` is exempt from the guard and sets the flag. So does PostgREST under the F-006 grant. "Cannot be bypassed by direct API calls" is true only in a narrow sense.
**Fix:** Treat onboarding as UX, not a control, and say so in the evidence. Alternatively, set the flag only in `POST /api/onboarding/complete` after validating that interests exist, and remove the column from the grant.

### IN-07: Raw database error messages are returned to clients

**File:** `src/app/api/events/[id]/route.ts:106, 331, 401`; `src/app/api/events/create/route.ts:194`; `src/app/api/clubs/[id]/appeal/route.ts:69, 86`; `src/app/api/events/[id]/appeal/route.ts:74, 89`; `src/app/api/events/[id]/report/route.ts:70`; `src/app/api/organizer-requests/route.ts:56, 81`; `src/app/api/notifications/route.ts:44, 95`; `src/app/api/notifications/[id]/route.ts:32`; `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts:55`
**Issue:** These responses leak schema and policy detail, contrary to the convention in `src/server/errors.ts`.
**Fix:** Log the error, then return `serverError("<action>")`.

### IN-08: 050 does not pin the complete UPDATE column set

**File:** `supabase/tests/database/050-users-privilege-escalation.test.sql:63-83`
**Issue:** Only `roles`, `email`, `saved_events_count`, `banned_at` and `ban_expires_at` are asserted as denied. A later GRANT that widens to `ban_reason`, `banned_by` or `pinned_contracts` would stay green.
**Fix:** Assert exact equality of `information_schema.column_privileges` for `grantee = 'authenticated' AND privilege_type = 'UPDATE' AND table_name = 'users'` against the eleven granted columns.

### IN-09: The proxy's header comment misstates how `getUser()` fails

**File:** `src/proxy.ts:21-22, 112-114`; `src/server/context.ts:80-82`
**Issue:** `auth.getUser()` returns `{ user: null, error }` on network or auth errors. It does not reject, so an auth outage takes the anonymous path. The outcome still fails closed, because handlers return 401 and protected pages redirect, but the comment describes a throw that does not happen.
**Fix:** Correct the comment, or check `error` and throw deliberately.

### IN-10: The events appeal elevated pre-read is an existence oracle and ignores `deleted_at`

**File:** `src/app/api/events/[id]/appeal/route.ts:37-53`
**Issue:** Any onboarded user can tell whether a rejected or suspended event id exists (403) or not (404). Soft-deleted events can also be appealed.
**Fix:** Add `.is("deleted_at", null)`, and return 404 for both non-creator and missing.

### IN-11: The moderation reviews listing exposes admins' email local parts to creators

**File:** `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts:64-72`
**Issue:** When an admin's `name` is null, the fallback `a.email?.split("@")[0]` is sent to a non-admin creator.
**Fix:** Fall back to "Moderator" for admin authors.

### IN-12: `POST /auth/signout` is outside `/api/`, so the CSRF check does not cover it

**File:** `src/app/auth/signout/route.ts:6`; `src/server/csrf.ts:49`
**Issue:** Logout CSRF is guarded only by SameSite=Lax.
**Fix:** Add `/auth/signout` to the origin-checked set, or record it as a Low residual next to DI-41.

### IN-13: Private profiles still expose header data and counts to any signed-in non-friend

**File:** `src/app/users/[id]/page.tsx:81-178, 288-350`
**Issue:** The elevated reads run before `canSeeDetails`. Faculty, year, pronouns, event, club and friend counts, and the Organizer badge are rendered for a private profile to any signed-in viewer. F-005 closed only the anonymous case.
**Fix:** Confirm this matches product intent. If not, skip the elevated activity reads and the stats when `!canSeeDetails`.

### IN-14: `isBanned` treats an unparseable `ban_expires_at` as not banned

**File:** `src/lib/ban.ts:9`
**Issue:** `new Date("garbage") > new Date()` is false, which is fail-open. It is only reachable through a direct database write.
**Fix:** Return `true` when `Number.isNaN(Date.parse(user.ban_expires_at))`.

### IN-15: Non-admin club owners write `admin_audit_log` rows with actions outside `AuditAction`

**File:** `src/app/api/clubs/[id]/route.ts:220-226`; `src/app/api/clubs/[id]/transfer/route.ts:85-91`
**Issue:** `club_deleted` and `club_ownership_transferred` bypass the typed writer `logAdminAction`. Their `admin_user_id` is a club owner, so Recent Activity presents owners as moderation actors.
**Fix:** Either extend `AuditAction` and `logAdminAction` with an actor-kind field, or log owner actions to a separate table.

---

_Reviewed: 2026-09-25T06:34:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
