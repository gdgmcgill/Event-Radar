# Slice 3 fixture completions — legacy untagged suites

**Plan:** 05-06 (05-07 appends) · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-24

When a write arm adopts the seam guards (DEC-34), the request context reads the caller's `users` row
and the guards refuse a missing row (403 `Profile not found`, DEC-35), a banned row (403
`Account suspended`) and a row whose `onboarding_completed` is not `true` (403 `Onboarding required`).
The untagged legacy suites below mock the Supabase client with authenticated fixtures that had no
usable `users` row, because nothing read one on these arms before. Their only failures after the
guards landed were those 403s (`evidence/handler-adoption-events.txt` Task 1 §4).

The rule applied: add a `users` row with `onboarding_completed: true`, `banned_at: null`,
`ban_expires_at: null` to the fixture, change no assertion. Proof that no assertion moved:
`git diff 9c33617 -- <the three files> | grep -E '^[-+].*expect\('` prints nothing (exit 1).

| File | Fixture | Edit | Reason |
|------|---------|------|--------|
| `src/__tests__/api/events/rsvp.test.ts` | `beforeEach` defaults in `mockQueryResults` | Added `mockQueryResults.set("users", { data: { onboarding_completed: true, banned_at: null, ban_expires_at: null }, error: null })`. The mock's `from()` ignores filters, so this is the row every `users` read receives. | The mock returned `{ data: null }` for `users`, so the context's profile was null and the rsvp POST and DELETE guards answered 403 `Profile not found` on every authenticated test. Before 05-06 the legacy helper read a null profile as "not banned". |
| `src/__tests__/api/events/reviews.test.ts` | `beforeEach` defaults in `mockQueryResults` | Same `users` entry as above. | Same cause on reviews POST. The GET arm is unguarded and does not read `users` through the context, so its tests were unaffected. |
| `src/__tests__/api/events/date-validation.test.ts` | the `mockSupabase.from.mockImplementation(...)` in `beforeEach` | The implementation now takes the table name. For `users` only, it spreads `onboarding_completed: true, banned_at: null, ban_expires_at: null` into the same row it already returned (`id`, `club_id: null`, `roles: ["admin"]`, `name`). Every other table gets the unchanged row. | The single table-agnostic row had no `onboarding_completed`, so `requireOnboarded` answered 403 `Onboarding required` on events/create POST and events/[id] PATCH. The `roles: ["admin"]` and `name` the create and PATCH handlers read from `users` are unchanged. |

## 05-07 — none needed

Neither task needed a fixture completion. After Task 1 (the twelve clubs-family arms) the plan's
verify `npx jest --ci src/__tests__/api src/app/api` passed 456/456 with no untagged suite touched,
`src/__tests__/api/clubs/analytics.test.ts` included (it exercises the unguarded analytics GET).
After Task 2 the full `npx jest --ci` passed 1013/1013 with no fixture edit. No legacy mock suite
exercises the Task 2 arms directly: the only suites that invoke them are the two auth-ring suites,
whose personas already carry a complete `users` row. Evidence: `evidence/handler-adoption-rest.txt`
Task 1 §4 and Task 2 §4.

## Slice 4 (05-10)

### Task 1 — none needed

After the nine club-route files adopted `requireClubRole`, `src/__tests__/api/clubs/analytics.test.ts`
(untagged, mock-chain style) passed with no edit: its `club_members` result already carries
`role: "owner"`, which the guard's `CLUB_ROLES` set admits, and its `users` result defaults to
`null`, which `createRequestContext` tolerates (the GET arm reads only `requireUser`). Full
`npx jest --ci` 1135/1135 with no fixture edit. Evidence: `evidence/club-guard-adoption.txt` §1f.

### Task 2 — one fixture line

`src/__tests__/api/events/reviews.test.ts` (untagged, mock-chain style): the "includes anonymized
comments for organizer" case's `club_members` mock row was `{ id, user_id, club_id }` with no `role`.
`requireClubRole` admits a row only when its role is in the accepted set, so the row read as a
non-member. A real row always carries `role` (NOT NULL, `club_members_role_check`). The row gained
`role: "organizer"`; no assertion changed. Diff in `evidence/club-guard-adoption.txt` §2f.
