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
entries fewer. `src/lib/audit.ts`, below, is still a legacy caller.

### One pre-existing elevated caller, counted by both controls since plan 04-03

`src/lib/audit.ts` calls `createServiceClient()` and exports `logAdminAction`,
which **ten** route files under `src/app/api/admin/**` import, across fourteen
callsites (`grep -rl 'from "@/lib/audit"' src/app | wc -l`, and F-073 for the
callsite count). It is an RLS-bypassing write reachable from admin routes on
every moderation action.

Until plan 04-03 **neither** control could see it: the ESLint boundary covered
`src/app/**` only and `scripts/check-elevated-ratchet.mjs` walked `src/app`
only, so an *indirect* reach through `src/lib/` was invisible to both (DI-34,
raised by 03-REVIEW.md CR-03). Since plan 04-03 both controls cover `src/**`,
exempting only the credential's two sanctioned homes — `src/lib/supabase/`
(where the factory is defined) and `src/server/db/elevated/` (this door) — and
both count `src/lib/audit.ts`. The allow-list was regenerated once, inside that
plan, to absorb it; that is the one sanctioned growth of a shrink-only list,
and its diff is recorded in
`.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/boundary-widening.txt`.
The one-move bypass the old scope allowed — put `createServiceClient()` in a new
`src/lib/foo.ts` and import `foo` from a route — now fails lint on `foo.ts` and
fails the ratchet. The two evasions the static import rule cannot see — a
dynamic `import()` of the service module and a bare read of
`SUPABASE_SERVICE_ROLE_KEY` — fail lint through a companion
`no-restricted-syntax` rule (DI-31), and CI runs the ratchet on every pull
request.

This is still a **note, not a row**: a row would imply the operation goes
through `getElevatedClient()`, which it does not. Migrating it to this door —
and adding its row — is Phase 5's (REFAC-13).

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
