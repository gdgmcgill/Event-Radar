---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 10
subsystem: auth
tags: [club-authorization, requireClubRole, elevated-door, rls, REFAC-12, REFAC-13, F-087, DEC-40, DEC-41, DI-25]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-09: the 107-test club-gate PRESERVE table, the F-087 DEFECT pins (unit and e2e), the RLS before-probe; floor Jest 1133, tag gate ok 29, ratchet committed 25 / live 24"
provides:
  - "CLUB_ROLES and a ClubRole narrowed to the schema's two roles, with isClubRole making an unexpected stored role a deny"
  - "requireClubRole at all 17 § C sites (18 call sites: the PATCH composite has two arms), each with its old role set and 403 message, and no admin bypass"
  - "hasRole(ctx.profile, \"admin\") at the four inline admin decisions in events/[id] (GET, PATCH, DELETE) and events/create"
  - "Owner club edit, soft-delete, role change and transfer through getElevatedClient() behind the owner gate, with the column whitelist keeping status, created_by and id unwritable"
  - "Three REGISTRY rows; ratchet live census 24 -> 22"
  - "DI-25 cleared at clubs/[id] PATCH (TablesUpdate<\"clubs\">) and events/[id] PATCH (TablesUpdate<\"events\">)"
  - "F-087 pins flipped: unit D1, D2, D4, D5 and the e2e FIXED F-087 test"
affects: [05-11, 05-12, 05-13, 05-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A closed role vocabulary lives beside its guard as an `as const` tuple, and the guard narrows the DB value with a type guard, so a row the schema should not admit is a deny"
    - "Owner writes that RLS cannot express go through the elevated door after the authz gate, and the handler's column whitelist is the control that replaces the missing policy"

key-files:
  created:
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/club-guard-adoption.txt
  modified:
    - src/server/authz/requireClubRole.ts
    - src/server/__tests__/requireClubRole.test.ts
    - src/lib/roles.ts
    - src/app/api/clubs/[id]/analytics/route.ts
    - src/app/api/clubs/[id]/events/route.ts
    - src/app/api/clubs/[id]/invites/route.ts
    - src/app/api/clubs/[id]/members/role/route.ts
    - src/app/api/clubs/[id]/members/route.ts
    - src/app/api/clubs/[id]/route.ts
    - src/app/api/clubs/[id]/transfer/route.ts
    - src/app/api/clubs/banner/route.ts
    - src/app/api/clubs/logo/route.ts
    - src/app/api/events/[id]/analytics/route.ts
    - src/app/api/events/[id]/reviews/route.ts
    - src/app/api/events/[id]/route.ts
    - src/app/api/events/create/route.ts
    - src/__tests__/api/clubs/club-owner-writes-defect.test.ts
    - src/__tests__/api/events/reviews.test.ts
    - e2e/specs/club-authorization.spec.ts
    - src/server/db/elevated/REGISTRY.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-fixture-completions.md

key-decisions:
  - "The D5 transfer-demotion pin moved in Task 1, not Task 3. Task 1 adopts the guard at transfer, and the guard returns only the role, so the demotion has to filter by (club_id, user_id) in the same commit. The ledger protocol requires a pin to move with its fix, so the D5 row moved there with its own ledger row"
  - "hasRole's parameter widened from User to Pick<User, \"roles\">. It is type-only: the predicate reads nothing else. It lets the plan's literal hasRole(ctx.profile, \"admin\") type-check against the context's profile slice"
  - "events/[id] GET moved its pending_edits admin check onto createRequestContext + hasRole, because events-detail-characterization.test.ts passed unedited afterwards (the plan's condition)"
  - "reviews GET keeps its own createClient and its authError-or-no-user 401. Only its isOrganizer flag moved to the guard, so its bytes cannot shift through the context's auth handling"
  - "The ratchet's committed list is not regenerated. The live census shrank 24 -> 22, and DEC-49 regenerates the list once, in 05-15"

patterns-established:
  - "Owner-only elevated write: requireClubRole(..., [\"owner\"], msg), then build the payload from a whitelist typed TablesUpdate<T>, then getElevatedClient(). Add a REGISTRY row in the same commit, and add an e2e check that a smuggled non-whitelisted column is dropped"

requirements-completed: []  # REFAC-12's authz-ring half is delivered here; its RLS-ring clause (F-008) lands in 05-11, which also carries REFAC-12, so the checkbox stays Pending until then

# Metrics
duration: 10min
completed: 2026-09-24
---

# Phase 5 Plan 10: Club Guard Adoption and Owner Writes Summary

**Every club-membership decision now goes through `requireClubRole`, using `CLUB_ROLES` or `["owner"]` and each site's own 403 message. The events-side admin checks go through `hasRole(ctx.profile, "admin")`. Club owners can edit, soft-delete, change member roles and transfer ownership again: the write goes through the registered elevated door behind the owner gate and a column whitelist (F-087).**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-09-24T20:31:37Z
- **Completed:** 2026-09-24T20:42:05Z
- **Tasks:** 3 of 3
- **Files modified:** 22, plus 1 evidence file created

## Accomplishments

- **The guard** (`src/server/authz/requireClubRole.ts`):
  - It now exports `CLUB_ROLES = ["owner", "organizer"] as const`, `ClubRole = (typeof CLUB_ROLES)[number]` and `isClubRole`.
  - A stored role outside the set is refused, and the refusal reports that role, even if a caller forces it into the accepted set. A new seam unit test covers this.
  - The result shape and the no-bypass property are unchanged. The executable-code check for `admin` or `.roles` exits 0.
- **17 sites adopted** (research § C). 12 of them are in the nine club-route files:
  - Membership reads that made a decision about the caller dropped from 12 to 0 in those files. The 10 remaining reads are target reads, listings and writes.
  - The four GET arms moved onto `createRequestContext`. The analytics, invites and members GETs use `requireUser`, which returns the same 401 body. The events listing stays anonymous.
  - The remaining 5 sites are on the events side: event analytics, the reviews flag, both arms of the PATCH composite, the DELETE composite and the auto-approve flag.
- **Admin decisions:** all four inline `roles.includes("admin")` checks in events/[id] (GET, PATCH, DELETE) and events/create are now `ctx.profile !== null && hasRole(ctx.profile, "admin")`.
- **F-087 fixed:**
  - clubs/[id] PATCH and DELETE, members/role PATCH and transfer POST now write on `getElevatedClient()`, after the owner gate.
  - The PATCH payload is built only from `allowedFields` and typed `TablesUpdate<"clubs">`.
  - The DELETE audit insert no longer uses the dynamic service import. Its error is now logged with the request id.
  - No service-module import remains in these three files. The ratchet reads committed 25, live 22, exit 0.
- **DI-25:** `TablesUpdate<"clubs">` (clubs/[id] PATCH) and `TablesUpdate<"events">` (events/[id] PATCH `directUpdates`). No carried value changed.
- **REGISTRY.md:** three rows (owner club edit and soft-delete; owner role change and transfer; club deletion and transfer audit record), plus a ratchet note.
- **E2E:** `DEFECT F-087` is now `FIXED F-087`. The owner's PATCH answers 200. A PATCH with a smuggled `status: "rejected"` also answers 200, and the club stays `approved`. After a clean reset and seed the spec passed 29/29 on the first run. The stack was then reset and seeded again.

## Task Commits

1. **Task 1: CLUB_ROLES, and requireClubRole at the nine club-route files.** `a6fd637` (refactor)
2. **Task 2: event-side club decisions and `hasRole` admin checks, DI-25 for events/[id] PATCH.** `d8cf84e` (refactor)
3. **Task 3: owner club writes through the elevated door (F-087), REGISTRY rows, DEFECT pins moved.** `4531ee2` (fix, INTENTIONAL BEHAVIOUR CHANGE)

## Floor after this plan

| Gate | Before (05-09) | After |
|---|---|---|
| `npx jest --ci` | 1133 passed, 65 suites | 1135 passed, 0 failed, 65 suites (+2 seam rows) |
| `node scripts/check-characterization-tags.mjs --all` | ok 29 | ok 29 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors | 0 errors (all 19 warnings are in untouched files) |
| `node scripts/check-elevated-ratchet.mjs` | committed 25 / live 24 | committed 25 / live 22, exit 0 |
| Playwright `club-authorization.spec.ts` | 29/0 (with DEFECT F-087) | 29/0 (with FIXED F-087), clean reset and seed |
| PRESERVE files (`club-gates-characterization`, `events/*-characterization`) | n/a | `git diff c407515` empty, all green |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `hasRole` could not accept the context profile**
- **Found during:** Task 2
- **Issue:** `hasRole(user: User, ...)` requires a full `User`. `ctx.profile` is the five-column `RequestProfile`, so the plan's literal `hasRole(ctx.profile, "admin")` did not type-check.
- **Fix:** The parameter type is now `Pick<User, "roles">`. This is type-only, the predicate reads only `roles`, and every existing caller still satisfies it. `src/lib/roles.ts` is not in the plan's files list.
- **Files modified:** `src/lib/roles.ts`
- **Commit:** `d8cf84e`

**2. [Rule 3 - Blocking] The D5 transfer-demotion pin moved in Task 1**
- **Found during:** Task 1
- **Issue:** The plan puts the demotion change (DEC-40) in Task 1 but moves the D5 pin in Task 3. Task 1's own verification (`npx jest --ci src/__tests__/api/clubs`) would have been red on D5.
- **Fix:** D5 moved in the Task 1 commit, with the full ledger protocol and its own ledger row (`evidence/club-guard-adoption.txt` §1e). Task 3 moved D1, D2 and D4 and set the Status line to `FIXED in 05-10`.
- **Files modified:** `src/__tests__/api/clubs/club-owner-writes-defect.test.ts`, `evidence/defect-ledger.md`
- **Commit:** `a6fd637`

**3. [Rule 3 - Blocking] Two seam unit rows used roles the schema does not admit**
- **Found during:** Task 1
- **Issue:** `requireClubRole.test.ts` used `"member"` and `"officer"`. With `ClubRole` narrowed, those rows no longer type-check.
- **Fix:** They now use `"organizer"` and `CLUB_ROLES`, with the same assertions. `"member"` moved into the new unexpected-role deny row. The file is a seam unit test, not a characterization suite.
- **Commit:** `a6fd637`

**4. [Mock wiring] One untagged suite fixture line**
- **Found during:** Task 2
- **Issue:** In `src/__tests__/api/events/reviews.test.ts`, the organizer case's `club_members` mock row had no `role`, so the guard correctly treated it as a non-member.
- **Fix:** The row gained `role: "organizer"`. No assertion changed. This is recorded in `evidence/slice-3-fixture-completions.md` under the slice-4 heading.
- **Commit:** `d8cf84e`

### Rule-resolved choices

- **Two D5 test titles** changed from "today:" to "stays:" in Task 3, with no assertion change, because those rows now describe preserved behaviour. The ledger's D4 row records this.
- **The club_deleted audit insert's error is now logged** with `ctx.requestId`, as the plan asked. A failed audit write does not undo the deletion, and the response bytes are unchanged.

## Deferred items found

Candidate for 05-11 to register, alongside 05-09's member-list item:
- **`POST /api/clubs/[id]/transfer`'s rollback is a no-op.** If the demotion fails, the "rollback" sets the new owner's role to `owner` again, which it already is. It does not restore the target's original role. So a failed demotion leaves the club with two owners. This is pre-existing and was preserved byte for byte here: the plan moved only its client and its demotion filter.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. The new elevated surface is exactly the three REGISTRY rows:
- **T-05-10-01 (role set widened):** the 107 PRESERVE rows, including the organizer on owner-only gates, pass unedited.
- **T-05-10-02 (admin bypass):** the guard's executable code references no `admin` or `.roles`, and the P4 admin-without-membership rows pass.
- **T-05-10-03 (self-approval):** the whitelist excludes `status`. The unit whitelist row and the e2e smuggled-status assertion both prove this.
- **T-05-10-04 (repudiation):** the REGISTRY rows are in the same commit, and audit insert errors are now logged.
- **T-05-10-05 (event edit and create broken):** the events PRESERVE suites pass unedited, and the auto-approve flag rows pass.

Only the local stack was used. There was no `db push`, no `--linked` and no `git push`, and `.env*` was not read.

## Issues Encountered

None. Playwright passed on the first run.

## Requirement status

REFAC-12 reads: "the 19 hand-rolled club-membership checks collapse into `requireClubRole`, cross-club access attempts return 403 at the authz ring and are denied at the RLS ring".
- **Delivered here:** the collapse, and the authz-ring 403s. The e2e spec pins 12 attacker 403s.
- **Not delivered here:** the RLS-ring clause. It needs 05-11's F-008 events INSERT policy, because `rls-ring-before.txt` P1 and P2 still succeed.
- `requirements.mark-complete REFAC-12` was run and then reverted. `.planning/REQUIREMENTS.md` keeps REFAC-12 Pending, and 05-11 (which also lists REFAC-12) should mark it complete.

## Next Phase Readiness

- **05-11 (F-008 policy, pgTAP 060):**
  - A direct owner `UPDATE clubs` must still affect 0 rows. No policy was widened here.
  - Register the two deferred candidates: the member-list truncation (from 05-09) and the no-op transfer rollback.
- **05-13 and 05-15:** `hasRole` now accepts `ctx.profile` directly, which the layout migrations can use. Ratchet live is 22 going into 05-15's regeneration.
- The stack is left reset and seeded, and port 3000 is free.

## Self-Check: PASSED

- FOUND: evidence/club-guard-adoption.txt, and all 22 modified files are present
- FOUND commits: a6fd637, d8cf84e, 4531ee2
- `requireClubRole.ts` contains `export const CLUB_ROLES = ["owner", "organizer"] as const` and `(typeof CLUB_ROLES)[number]`
- `REGISTRY.md` names `src/app/api/clubs/[id]/route.ts` and `src/app/api/clubs/[id]/transfer/route.ts`
- `club-owner-writes-defect.test.ts` Status: `FIXED in 05-10`

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
