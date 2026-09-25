---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
reviewed: 2026-09-25T20:31:56Z
depth: standard
iteration: 2
files_reviewed: 28
files_reviewed_list:
  - scripts/pgtap-mutation-check.sh
  - src/app/api/admin/clubs/[id]/route.ts
  - src/app/api/admin/events/[id]/edits/route.ts
  - src/app/api/admin/events/[id]/status/route.ts
  - src/app/api/admin/organizer-requests/[id]/route.ts
  - src/app/api/admin/reports/[id]/route.ts
  - src/app/api/admin/users/[id]/ban/route.ts
  - src/app/api/admin/users/[id]/route.ts
  - src/app/api/clubs/[id]/appeal/route.ts
  - src/app/api/clubs/[id]/members/role/route.ts
  - src/app/api/clubs/[id]/route.ts
  - src/app/api/clubs/[id]/transfer/route.ts
  - src/app/api/clubs/route.ts
  - src/app/api/events/[id]/appeal/route.ts
  - src/app/api/events/[id]/invite/route.ts
  - src/app/api/events/[id]/report/route.ts
  - src/app/api/events/create/route.ts
  - src/app/api/organizer-requests/route.ts
  - src/app/api/users/[id]/follow/route.ts
  - src/instrumentation.ts
  - src/lib/env.ts
  - src/lib/sanitize.ts
  - src/proxy.ts
  - src/server/body.ts
  - src/server/db/elevated/REGISTRY.md
  - src/server/ratelimit/index.ts
  - supabase/migrations/20260925120000_events_guard_moderated_update.sql
  - supabase/tests/database/065-events-moderated-update.test.sql
findings:
  critical: 0
  warning: 8
  info: 26
  total: 34
status: issues_found
---

# Phase 5: Code Review Report (iteration 2, re-review of the REVIEW-05 fixes)

**Reviewed:** 2026-09-25T20:31:56Z
**Depth:** standard
**Files Reviewed:** 28 (the files commits `21d01a6..HEAD` changed)
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I checked every original finding against the code as it is now, not against `05-REVIEW-FIX.md`. For each one I asked two things: is it actually fixed, and did the fix add a new bug or a fail-open path. Two facts were checked on the local stack, each inside a rolled-back transaction: Postgres cannot infer a partial unique index in `ON CONFLICT`, and uuid comparison ignores case.

**Verdict on the original findings**

| ID | Verdict | Notes |
|---|---|---|
| CR-01 | **Fixed** | `SECURITY INVOKER` plus `current_user` is the right discriminator. PostgREST runs `SET LOCAL ROLE authenticated` (or `anon`, or `service_role`) for each request, so `current_user` is the API role, and under DEFINER it would always be `postgres`. No SECURITY DEFINER function updates `events`, so no caller slips past the guard through an owner-run path. `is_admin()` and `is_club_member()` are both SECURITY DEFINER, granted to authenticated and anon, and keyed on `auth.uid()`. The appeal route's write (`status: pending`, `appeal_count + 1`) passes, and so do the PATCH, the soft DELETE and every admin write. `EDITABLE_FIELDS` carries no guarded column. `appeal_count` is `NOT NULL`, so there is no NULL bypass of the `<`/`<>` checks. One residual: the appeal arm does not *require* the increment (WR-02). |
| CR-02 | **Fixed** | Values are trimmed. `upstashConfigProblem()` mirrors the client's URL regex and also requires `https:`. `select()` cannot throw, since both the problem arm and the constructor `catch` fall back to memory. The proxy's limiter call has its own fail-open `try`, and a 429 still passes through. The boot check throws `InvalidEnvError` under `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` and names the variables, not the value, and `register()` rethrows it. Minor residuals are in IN-05. |
| WR-01 | **Fixed** | Only `title` and `image_url` are copied, via `hasOwnProperty`. A residual TOCTOU is in IN-07. |
| WR-02 | **Partially fixed** | The self-transfer guard compares strings. A non-canonical encoding of the caller's own UUID gets past it, and the promotion's row count is not checked (WR-01 below). The rollback and audit parts are fixed. |
| WR-03 | **Fixed** | `.eq("club_id").neq("role","owner")` plus `.single()`, and PGRST116 maps to 409. |
| WR-04 | **Accepted skip** | Listed as IN-01, owner DI-61. |
| WR-05 | **Fixed** | `isBanned()` is used, with `ban_expires_at` selected. |
| WR-06 | **Fixed** | Both traps are installed after the clean check, and the EXIT trap keeps the original status. A minor SIGTERM residual is in IN-06. |
| WR-07 | **Fixed** | The conditional `UPDATE … WHERE status = 'pending'` is race-safe under READ COMMITTED: the second writer re-checks the updated row and matches nothing. 409 is returned before any side effect. |
| WR-08 | **Mostly fixed** | `readJsonObject()` rejects nothing a handler previously accepted with a success, apart from a top-level array body. That was previously a no-op 200 at most, for example `admin/users/[id]` with `[]`. `admin/users/[id]/ban` was not converted and still throws an HTML 500 on a `null` body (WR-08 below). Field-level typing (DI-64) is IN-02. |
| WR-09 | **Fixed** | PATCH requires an absolute http(s) URL on all six link fields and a string or null on every field. POST refuses non-http(s) schemes. The asymmetry that remains is IN-04. |
| WR-10 | **Fixed, with new defects** | All three inserts use the elevated door, and each runs after that handler's own authorization decision. But delivering notifications for real exposed four problems: invite batches fail wholesale on the dedup index (WR-03), invite has no event-visibility gate (WR-04), follow notifies on every repeat call (WR-05), and the club fanout is fire-and-forget on serverless (WR-06). The same dedup index also breaks the admin approval notification in a file in scope (WR-07). |

Nothing reaches BLOCKER. The new warnings are all in the paths the fixes turned on or narrowed.

## Warnings

### WR-01: The self-transfer guard can be bypassed with a non-canonical UUID, and the promotion's row count is never checked; both still leave the club with no owner

**File:** `src/app/api/clubs/[id]/transfer/route.ts:43, 51-56, 70-85`
**Issue:**

*The guard.* `newOwnerId === user.id` is a JavaScript string comparison. The lookup `.eq("user_id", newOwnerId)` casts to `uuid` in Postgres, and that cast ignores case and formatting. I verified on the local stack that `'ABCDEF00-…'::uuid = 'abcdef00-…'::uuid` is true. Postgres also accepts brace-wrapped and unhyphenated forms. So `{"newOwnerId": "<caller id in upper case>"}` passes the WR-02 guard, and the rest runs exactly as the original finding described:

1. `targetMember` is the caller's own owner row.
2. The promotion does nothing.
3. The demotion turns that same row into `organizer`.
4. The club has no owner, and only an admin can recover it.

*The promotion.* The promotion `.update({role:"owner"}).eq("id", targetMember.id)` never checks whether it matched a row. Suppose the target leaves between the cookie-client read and the elevated write (`DELETE /api/clubs/[id]/members` exists). The promotion then matches 0 rows with no error, the demotion runs anyway, and the club again has no owner.

**Fix:** Compare identities the database returned, and require that the promotion changed exactly one row:

```ts
const { data: targetMember } = await supabase
  .from("club_members").select("id, role, user_id")
  .eq("club_id", clubId).eq("user_id", newOwnerId).single();
if (!targetMember) return /* 400 */;
if (targetMember.user_id === user.id || targetMember.role === "owner") {
  return NextResponse.json({ error: "You already own this club" }, { status: 400 });
}
const { data: promoted, error: newOwnerError } = await serviceClient
  .from("club_members").update({ role: "owner" })
  .eq("id", targetMember.id).eq("club_id", clubId).neq("role", "owner")
  .select("id");
if (newOwnerError) return /* 500 */;
if (!promoted || promoted.length !== 1) return /* 409, before the demotion */;
```

The single-transaction SQL function (DI-62) remains the durable fix.

### WR-02: The trigger's appeal arm does not require `appeal_count` to rise, so a creator can send a rejected event back to the ordinary pending queue with no appeal on record

**File:** `supabase/migrations/20260925120000_events_guard_moderated_update.sql:111-125`
**Issue:** `v_is_appeal` admits any `rejected|suspended → pending` update, and the counter check only refuses a *decrease*, or a change outside an appeal. A creator can therefore skip `POST /api/events/[id]/appeal` and send `PATCH /rest/v1/events?id=eq.<id> {"status":"pending"}` directly. In one statement they can also rewrite `title`, `image_url` and `description`, since the title guard only covers `OLD.status = 'approved'`. The result:

- no `moderation_reviews` appeal row is written;
- `appeal_count` is unchanged;
- no admin notification is sent;
- the moderation dashboard sorts appeals with `.gt("appeal_count", 0)` (`src/app/moderation/page.tsx:69,74`), so a previously rejected event reappears as a first-time pending submission, with its rejection history out of view;
- this can be repeated without limit.

pgTAP 065 pins only the `+1` case (rows 22 and 23), and no row covers the unchanged-counter appeal.

**Fix:** Make the increment part of the permitted transition, and add a 065 row that asserts `SET status = 'pending'` alone throws 42501:

```sql
IF v_is_appeal AND NEW.appeal_count <> OLD.appeal_count + 1 THEN
  RAISE EXCEPTION 'events: an appeal must raise appeal_count by exactly one'
    USING ERRCODE = '42501';
END IF;
```

Optionally, also forbid moderated-field changes inside the appeal statement, so the content an admin rejected is the content they re-review.

### WR-03: The invite notification batch fails as a whole whenever one invitee already has an `event_invite` notification for that event

**File:** `src/app/api/events/[id]/invite/route.ts:86-107`
**Issue:** The fix notifies "only the newly inserted invites", on the grounds that `notifications_dedup_idx` would refuse a repeat. But that index is `(user_id, event_id, type)`. It does not include the inviter, while `event_invites` is unique on `(inviter_id, invitee_id, event_id)`. Two cases produce a new invite row whose notification collides with an existing one:

- inviter B invites X after inviter A already invited X to the same event;
- A re-invites X after X deleted the invite ("Users can delete invites sent to them") but kept the notification.

A multi-row `INSERT` is atomic, so a single 23505 drops every notification in the batch. If B invites `[X, Y]`, Y is never notified either. The route still answers `{ sent: 2 }`, and only a log line records the failure.

**Fix:** Do not let one row fail the batch. Either:

- insert through a SQL function that uses `ON CONFLICT DO NOTHING`, since PostgREST's `on_conflict` cannot target the partial index (see WR-07); or
- insert per invitee with `Promise.allSettled`; or
- first read the existing `event_invite` notifications for `(event_id, user_id IN newlyInvited)` on the elevated client, and insert only the remainder.

### WR-04: The invite route's elevated notification has no event-visibility gate: it delivers unmoderated pending titles and notifications for events the caller cannot see

**File:** `src/app/api/events/[id]/invite/route.ts:46-61, 91-107`
**Issue:** The only authorization before the elevated insert is "invitee is a mutual friend". The event read (line 47) does not check `status` or `deleted_at`, and its result is used only for the title. Now that the insert goes through the service role, two things are newly possible:

- A creator can invite friends to their own **pending or rejected** event. The notification text `${inviterName} invited you to "${eventTitle}"` then carries a title no admin has approved. That bypasses moderation through the notification channel, which is the same class of problem CR-01 closed on the event row.
- Any user can post an arbitrary `eventId`: someone else's pending event, or a soft-deleted one. The FK is satisfied, the invite row is written, and friends get an "an event" notification pointing at an event they cannot open.

**Fix:** Before inserting invites, require a visible, live, approved event, and answer 404 otherwise:

```ts
const { data: event } = await supabase.from("events").select("title")
  .eq("id", eventId).eq("status", "approved").is("deleted_at", null).maybeSingle();
if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
```

### WR-05: Every repeated `POST /api/users/[id]/follow` now delivers another notification to the target

**File:** `src/app/api/users/[id]/follow/route.ts:31-36, 67-102`
**Issue:** The follow write is an upsert with `ignoreDuplicates: true`, so a repeat call succeeds whether or not a row was inserted. The notification insert then runs unconditionally. Rows without an `event_id` fall outside `notifications_dedup_idx`, so nothing dedups them. Before WR-10 these inserts always failed silently. Now they go through the service role and are delivered. A caller who is already following someone can therefore send "X started following you" (or, once friends, two "New Friend!" rows) on every call, up to the per-path rate limit. The per-path key (WR-04 / DI-61) means that limit is not a meaningful cap per target.

**Fix:** Notify only when the follow row is new:

```ts
const { data: inserted, error } = await supabase.from("user_follows")
  .upsert({ follower_id: user.id, following_id: targetId },
          { onConflict: "follower_id,following_id", ignoreDuplicates: true })
  .select("id");
if (error) return /* 500 */;
const isNewFollow = (inserted?.length ?? 0) > 0;
// … build notifications only when isNewFollow
```

### WR-06: The club-follower fanout is fire-and-forget and can be dropped on serverless

**File:** `src/app/api/events/create/route.ts:198-245` (`fanout();` with no `await`)
**Issue:** The fanout now does real work: two cookie reads and an elevated insert. But it runs as a detached promise after the handler has returned its response. On Vercel, the function instance can be frozen or reclaimed once the response is sent, so the elevated insert may never run and nothing is logged. The WR-10 fix claims the fanout now delivers, but it does so only when the instance stays warm long enough. The gate itself is correct: the fanout runs only when `status === "approved"`, which requires admin or membership of an approved club.

**Fix:** Schedule it with Next's post-response API, which the platform keeps alive (`node_modules/next/server.d.ts` exports `after`):

```ts
import { after } from "next/server";
// …
after(fanout);
```

### WR-07: Every admin "Event Approved!" notification fails with 42P10, and a re-rejection or re-suspension after an appeal is silently deduplicated away

**File:** `src/app/api/admin/events/[id]/status/route.ts:170-208`
**Issue:**

*Approvals.* The approval arm runs `.upsert(…, { onConflict: "user_id,event_id,type" })`. The only matching index, `notifications_dedup_idx`, is partial (`WHERE event_id IS NOT NULL`). PostgREST emits `ON CONFLICT (user_id, event_id, type)` with no predicate, so Postgres cannot infer the index. I verified this on the local stack in a rolled-back transaction: the statement fails with `there is no unique or exclusion constraint matching the ON CONFLICT specification`. supabase-js returns that error rather than throwing it, and nothing reads it, so no approval notification has ever been delivered and nothing is logged. `05-REVIEW-FIX.md` raised this as DI-65 "not verified". It is now verified.

*Re-rejections and re-suspensions.* The `insert` arms for `event_rejected` and `event_suspended` collide with the same index when an event goes rejected → appeal → pending → rejected again, or through a second suspension. That second notification is refused (23505) and also goes unread. The CR-01 fix deliberately keeps this appeal cycle.

This file is in scope (WR-08 touched it). The club arm in `src/app/api/admin/clubs/[id]/route.ts` should be checked for the same pattern.

**Fix:** Read the `error` of every notification write and `console.error` it. Then choose one:

- replace the partial index with a non-partial unique index or constraint, so `onConflict` can infer it (NULL `event_id` values do not collide in a plain unique index anyway);
- drop `type` uniqueness for the moderation types;
- write these notifications through a SQL function that uses `ON CONFLICT (user_id, event_id, type) WHERE event_id IS NOT NULL DO UPDATE …`.

Add a local-stack or pgTAP check that an approval notification is actually written.

### WR-08: `POST /api/admin/users/[id]/ban` still answers an HTML 500 on a `null` body

**File:** `src/app/api/admin/users/[id]/ban/route.ts:25-36`
**Issue:** This handler was not converted to `readJsonObject()`. Its own `try` only catches a parse failure, and `JSON.parse("null")` succeeds. `const { reason, duration_days, suspend_content } = body` then throws `TypeError` outside any `try`, and the framework answers an HTML 500 with no context. That is exactly the class WR-08 set out to close, and this file was edited in this iteration (WR-05).

**Fix:**

```ts
const parsedBody = await readJsonObject(request);
if (!parsedBody.ok) return parsedBody.response;
const { reason, duration_days, suspend_content } = parsedBody.body;
```

## Info

### IN-01: WR-04 (per-path rate-limit keys; `x-real-ip` trusted unconditionally) — accepted skip

**File:** `src/server/ratelimit/policy.ts:45-56, 81-92, 123`
**Issue:** This is still open by design. It is deferred to **DI-61** (proposed: Phase 6 rate-limit hardening), pending a decision on per-scope budgets and the trusted-proxy model. WR-05 above shows one concrete way the per-path key weakens a cap.
**Fix:** Register DI-61 and resolve it in Phase 6.

### IN-02: A non-string value in a field a handler `.trim()`s still throws an HTML 500 (DI-64 residual)

**File:** `src/app/api/events/[id]/appeal/route.ts:26`; `src/app/api/clubs/[id]/appeal/route.ts:26`; `src/app/api/admin/events/[id]/status/route.ts:68, 84`; `src/app/api/admin/clubs/[id]/route.ts:36, 51`
**Issue:** `{"message": 5}` makes `message?.trim()` throw outside any `try`. `readJsonObject()` deliberately leaves field typing to the handlers (`src/server/body.ts:10-12`).
**Fix:** Check `typeof message === "string"` in each handler, or add a small `readString(body, key)` helper. Track this under DI-64.

### IN-03: `clubs/[id]` PATCH and the invite route still answer a JSON 500, not a 400, for malformed or non-object bodies

**File:** `src/app/api/clubs/[id]/route.ts:81` (`"name" in null` or `"name" in "str"` throws inside the `try`); `src/app/api/events/[id]/invite/route.ts:27-28`
**Issue:** The response is JSON, so this is not a regression. But it reports a 500 ("Failed to update club" or "Failed to send invites") for what is a client error, which is inconsistent with the other 14 handlers.
**Fix:** Adopt `readJsonObject()` in both.

### IN-04: Club links: POST accepts values PATCH refuses, so the settings form cannot save

**File:** `src/app/api/clubs/route.ts:57-87`; `src/app/api/clubs/[id]/route.ts:119-137`; `src/components/clubs/ClubSettingsTab.tsx:170-181`
**Issue:** POST keeps any unparseable link, such as `myclub.com`. PATCH requires an absolute http(s) URL, and `ClubSettingsTab` resends every link on each save. An owner who created a club with `myclub.com` therefore cannot save *any* setting until they rewrite that link. The asymmetry predates this iteration for the four social links, and WR-09 kept it deliberately.
**Fix:** Normalize at the input, by prefixing `https://` when there is no scheme, in the form or in both handlers. Then apply `isHttpUrl` in POST too.

### IN-05: CR-02 residuals in store selection

**File:** `src/lib/env.ts:139-150`; `src/server/ratelimit/index.ts:44-65`; `src/instrumentation.ts:92-113`
**Issue:**

1. A broken `UPSTASH_*` pair shadows a valid `KV_REST_API_*` pair, so both boot and runtime drop to memory instead of using KV.
2. The constructor-failure fallback in `select()` ignores `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`. It is not reachable with today's URL check, but it would degrade silently.
3. The token is only trimmed. Interior whitespace or newlines would surface at request time, where the failure is open.

**Fix:** Try the KV pair when the Upstash pair has a problem. Validate the token as a single header-safe token. Document that the runtime fallback is best-effort.

### IN-06: WR-06 residual: the trap is deferred while `supabase db reset` runs

**File:** `scripts/pgtap-mutation-check.sh:151-161, 171`
**Issue:** Bash runs a trap only after the foreground child (the `$(...)` reset) exits. A SIGTERM sent only to the bash PID, as a CI timeout does, therefore waits for the reset to finish, and a later SIGKILL skips the restore. Also, SIGTERM exits with 130 instead of 143.
**Fix:** Run the reset in the background and `wait` for it, so the trap fires at once and can kill the child. Exit `128 + signal number`.

### IN-07: Approving pending edits is not bound to the version the admin reviewed

**File:** `src/app/api/admin/events/[id]/edits/route.ts:55-94`
**Issue:** `pending_edits` stays creator-writable, and the CR-01 trigger allows that on purpose. The approval copies whatever the column holds at request time. A creator who swaps it after an admin opened the queue gets the new values applied.
**Fix:** Have the client send the `submitted_at` it displayed, and add `.eq("pending_edits->>submitted_at", submittedAt)` to the update. Answer 409 on no match.

### IN-08: Organizer-request approval side effects are unchecked after the status commits

**File:** `src/app/api/admin/organizer-requests/[id]/route.ts:101-130`
**Issue:** The elevated roles write and the `club_members` upsert ignore their `error`. After WR-07 the request is already marked `approved`, so a failed side effect cannot be retried through the route (it returns 409). The user is left approved but has neither the role nor the membership.
**Fix:** Check both errors and log them. Consider a SQL function that does all three writes in one transaction.

### IN-09: The other self-checks also compare UUIDs as strings

**File:** `src/app/api/admin/users/[id]/route.ts:56`; `src/app/api/admin/users/[id]/ban/route.ts:65`
**Issue:** This has the same root cause as WR-01. An upper-cased own id gets past "You cannot change your own roles". The impact is limited to the admin changing their own roles. The ban self-check is also bypassed, but the admin-target 403 still holds.
**Fix:** Canonicalize route UUIDs once (`id.toLowerCase()` after a UUID format check) in a shared helper, or compare against the row the database returned.

### IN-10: `PATCH /api/clubs/[id]/members/role` can only rewrite organizer to organizer (DI-63)

**File:** `src/app/api/clubs/[id]/members/role/route.ts:40`
**Issue:** The write is now correctly scoped (WR-03), but the endpoint still performs no real change.
**Fix:** Decide under DI-63.

### IN-11: Two concurrent transfers by the same owner can produce two owners (DI-62)

**File:** `src/app/api/clubs/[id]/transfer/route.ts:69-102`
**Issue:** The promotion and the demotion are separate statements with no transaction and no row-count checks.
**Fix:** Use the DI-62 single-transaction function.

### Carried forward from iteration 1 (out of the fixer's scope, still open)

Each of these was re-checked where its file is in this iteration's scope, and all are unchanged.

| New ID | Iter-1 ID | Summary | Where |
|---|---|---|---|
| IN-12 | IN-01 | The proxy matcher skips `/api/**` paths that end in an image extension, which bypasses both CSRF and the rate limit | `src/proxy.ts:252` |
| IN-13 | IN-02 | The `getRequestContext` rationale misstates `cache` availability | `src/server/context.ts:97-122` |
| IN-14 | IN-03 | Dead production exports: `applyApiRateLimit`, `rateLimitStoreKind` | `src/middlewareRateLimit.ts:37`; `src/server/ratelimit/index.ts:80` |
| IN-15 | IN-04 | `ADMIN_PREFIX` has no trailing slash | `src/server/ratelimit/policy.ts:36, 107` |
| IN-16 | IN-05 | The CSRF origin check ignores the scheme and default ports | `src/server/csrf.ts:40-60` |
| IN-17 | IN-06 | The onboarding flag can be set by the user directly | `src/app/api/users/[id]/route.ts:160-169` |
| IN-18 | IN-07 | Raw DB error messages are returned to clients. CR-01's trigger messages now reach these paths too, for example the events PATCH 500 | `src/app/api/events/[id]/report/route.ts:73`; `src/app/api/clubs/[id]/appeal/route.ts:72, 89`; `src/app/api/events/[id]/appeal/route.ts:77, 92`; `src/app/api/organizer-requests/route.ts:59, 84`; `src/app/api/events/create/route.ts:195`; and the others listed in iteration 1 |
| IN-19 | IN-08 | 050 does not pin the full UPDATE column set on `users` | `supabase/tests/database/050-users-privilege-escalation.test.sql:63-83` |
| IN-20 | IN-09 | The proxy comment misstates how `getUser()` fails | `src/proxy.ts:21-22` |
| IN-21 | IN-10 | The events appeal elevated pre-read is an existence oracle and ignores `deleted_at`. CR-01's trigger does not stop appealing a soft-deleted event either, because the appeal leaves `deleted_at` untouched | `src/app/api/events/[id]/appeal/route.ts:44-56` |
| IN-22 | IN-11 | The moderation reviews listing exposes admins' email local parts | `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts:64-72` |
| IN-23 | IN-12 | `POST /auth/signout` is not covered by the CSRF check | `src/app/auth/signout/route.ts:6` |
| IN-24 | IN-13 | Private profiles still expose header data and counts to signed-in non-friends | `src/app/users/[id]/page.tsx:81-178` |
| IN-25 | IN-14 | `isBanned` treats an unparseable `ban_expires_at` as not banned. WR-05 now depends on it for the 409 | `src/lib/ban.ts:9` |
| IN-26 | IN-15 | Club owners write `admin_audit_log` rows with actions outside `AuditAction` | `src/app/api/clubs/[id]/route.ts:241-247`; `src/app/api/clubs/[id]/transfer/route.ts:106-112` |

---

_Reviewed: 2026-09-25T20:31:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
