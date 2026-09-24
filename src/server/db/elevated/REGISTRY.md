# Elevated Operations Register

**Phase:** 03 · **Plan:** 03-03 · **Requirement:** REFAC-05

Every operation that reaches for the service-role client gets a row here. The
service-role key bypasses every row-level security policy, so an elevated
operation is a standing exception to the database's own access control. An
exception that nobody wrote down is indistinguishable from an oversight.

## The register

| Operation | Calling module | Why RLS cannot express it | Phase added |
| --------- | -------------- | ------------------------- | ----------- |
| Delete the orphaned auth.users row of a rejected non-McGill sign-in (auth.admin.deleteUser) | `src/app/auth/callback/route.ts` | auth.users is owned by GoTrue; its admin API needs the service role and no RLS policy can grant it | 05 |
| Upsert and read the signing-in user's own public.users row at sign-in | `src/app/auth/callback/route.ts` | The row may not exist yet, the upsert writes email (withheld from authenticated by the F-006 column grant) and INSERT on users is revoked from authenticated by DEC-47; the callback is the only writer | 05 |
| Owner edits club details or soft-deletes the club | `src/app/api/clubs/[id]/route.ts` | clubs has no owner UPDATE policy; an owner policy needs status immutability and is deferred to Phase 7's per-table RLS work (DEC-41); the handler's column whitelist keeps status, created_by and id unwritable | 05 |
| Owner changes a member's role or transfers ownership | `src/app/api/clubs/[id]/members/role/route.ts`, `src/app/api/clubs/[id]/transfer/route.ts` | club_members UPDATE is admin-only; an owner UPDATE policy is deferred with the clubs policy (DEC-41) | 05 |
| Record a club deletion or ownership transfer in admin_audit_log | `src/app/api/clubs/[id]/route.ts`, `src/app/api/clubs/[id]/transfer/route.ts` | after F-007 no client role may insert audit rows; the door is the only writer | 05 |
| Recompute event popularity scores (rpc update_event_popularity) | `src/app/api/admin/calculate-popularity/route.ts` | writes event_popularity_scores, which are service-role-only by design (F-010); invoked on behalf of an admin, not a row owner | 05 |
| Change another user's roles or name as an admin | `src/app/api/admin/users/[id]/route.ts` | users has no admin UPDATE policy and the F-006 column grant withholds roles from authenticated; the change is an audited admin action (F-004, F-091) | 05 |
| Insert admin_audit_log rows for every moderation action | `src/lib/audit.ts` (logAdminAction) | after F-007 no client role may insert; the door is the only writer, so the record cannot be forged by the actor it records | 05 |
| Notify another user (notifications insert) | `src/app/api/admin/clubs/[id]/route.ts`, `src/app/api/admin/events/[id]/edits/route.ts`, `src/app/api/admin/events/[id]/status/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts`, `src/app/api/admin/users/[id]/ban/route.ts`, `src/app/api/clubs/[id]/appeal/route.ts`, `src/app/api/events/[id]/appeal/route.ts` | notifications INSERT is granted to service_role only; a notification for another user cannot be a caller-scoped policy | 05 |
| Set another user's roles on approval (club_organizer) | `src/app/api/admin/clubs/[id]/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts` | users has no admin UPDATE policy and the F-006 grant withholds roles | 05 |
| Ban or unban a user (banned_at, ban_expires_at, ban_reason) | `src/app/api/admin/users/[id]/ban/route.ts` | users has no admin UPDATE policy; the ban columns are withheld from authenticated by the F-006 grant | 05 |
| Club appeal: reset a rejected club to pending | `src/app/api/clubs/[id]/appeal/route.ts` | clubs has no owner UPDATE policy (DEC-41) | 05 |
| Read another user's name for appeals and review listings (the admins to notify of an appeal; review authors' names) | `src/app/api/clubs/[id]/appeal/route.ts`, `src/app/api/events/[id]/appeal/route.ts`, `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` | users has own-row and admin SELECT policies only; a cross-user name read would need a public-read policy that also exposes email and ban columns | 05 |
| Read an appealed event before the creator check | `src/app/api/events/[id]/appeal/route.ts` | events SELECT shows a rejected or suspended event only to its creator and admins; the route answers a non-creator 403 Forbidden, which needs the row whatever its status (on the cookie client that answer would become 404). Retired if Phase 7's per-table RLS review accepts 404 for non-creators; only the creator/non-creator decision uses the row | 05 |
| Create a club with its owner membership and the creator's organizer role | `src/app/api/clubs/route.ts` (POST) | clubs INSERT is admin-only, club_members has no self-owner insert, and roles is withheld by the F-006 grant | 05 |
| Batch score computation (rpc compute_user_scores) | `src/app/api/recommendations/batch/route.ts` | a privileged batch write over every user (F-075 revokes its public EXECUTE in Phase 6) | 05 |
| Friend suggestions read other users' profiles, memberships and RSVPs | `src/app/api/users/me/suggestions/route.ts` | users has own-row and admin reads only, and club_members shows another user's membership only to that club's owner; the RSVP-mates read stays with them because its events(title) embed names events the events SELECT policy hides from non-creators. The caller's own rows and the world-readable follow tables are read on the cookie client | 05 |
| Public profile of another user | `src/app/users/[id]/page.tsx` | users has no public-read policy; adding one would expose email, roles and ban columns at row level; the select is narrowed and anonymous viewers of private profiles get 404 (DEC-48). The target's saved events, created events, friends, memberships and RSVPs are read through the same door, because each is readable under RLS only by the target | 05 |

Rows added from Phase 5 (05-05 onward).

**Rows are now added per migration.** Plan 03-03 built the seam and applied it
to **zero** routes (REFAC-05, ROADMAP SC3), so the register was empty through
Phases 3 and 4, by design. From Phase 5 each legacy service-role callsite that
moves to `getElevatedClient()` adds its row above in the same commit, and the
callsites not yet migrated stay held by the generated allow-list in
`eslint.elevated-allowlist.mjs`, which may only shrink. Plan 05-05 migrated the
auth callback (both of its service-role uses), so the ratchet counts one legacy
entry fewer than the committed list; the list itself is regenerated once, in
05-15 (DEC-49). Plan 05-10 moved the club owner writes onto the door (F-087,
DEC-41), retiring `src/app/api/clubs/[id]/route.ts` (its dynamic import of the
service module) and `src/app/api/clubs/[id]/transfer/route.ts` from the live
census, so the ratchet counts three entries fewer than the committed list. Plan
05-14 moved `src/app/api/admin/calculate-popularity/route.ts` onto the door
(its inline service-key client is deleted, F-001), so the ratchet counts four
entries fewer; the same plan moved `src/lib/audit.ts` onto the door (F-073),
so it counts five fewer. Plan 05-15 split the eight admin write and read
routes between the caller's cookie client (every operation an admin policy
already permits) and the door (notifications, another user's roles, the ban
columns); `admin/organizers`, `admin/reports` and `admin/reports/[id]` need no
door at all. The same plan moved the non-admin sites: `profile/avatar`,
`profile/banner` and the `users/[id]` self-update run on the cookie client
only, and the appeals, club creation, review listing, batch scoring and friend
suggestions keep only the rows above on the door. The public profile page
reads through the door with a narrowed column list and one visibility gate
(F-005). The allow-list was then regenerated once (DEC-49) to exactly the two
cron routes Phase 6 owns.

### The audit writer

`src/lib/audit.ts` (`logAdminAction`), counted by both controls as a legacy
caller from plan 04-03 until plan 05-14, now writes through the door and has
its row above.

An empty register with a stated reason is a control. An absent register is an
omission. The distinction is the whole point of writing this file now rather
than when the first row arrives.

## Adding a row

1. Establish that the operation genuinely cannot be expressed as an RLS policy.
   "It was easier" is not a reason; "the operation must read rows belonging to a
   user other than the caller, on behalf of a cron job with no caller at all" is.
2. Call `getElevatedClient()` from `@/server/db/elevated`. Do not import the
   service-role factory from `src/lib/supabase/` directly — the boundary rule
   rejects that anywhere under `src/**` outside the two sanctioned homes, and
   this module exists so that there is
   exactly one place to audit.
3. Add the row, naming the calling module and the reason.
4. Delete the corresponding entry from `eslint.elevated-allowlist.mjs` when the
   migration retires a legacy callsite. The list may only shrink;
   `scripts/check-elevated-ratchet.mjs` enforces that.
