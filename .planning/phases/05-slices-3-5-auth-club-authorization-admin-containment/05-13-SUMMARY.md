---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 13
subsystem: auth
tags: [admin-guard, requireRole, requireActiveUser, request-context, F-061, DI-48, DEC-44, DEC-58, REFAC-13]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-12: 35-arm admin table, PRESERVE and DEFECT admin guard suites (FIXED_ARMS and BAN_GUARDED_ARMS empty), the admin-guard Playwright pin; floor Jest 1297/0, tag gate ok 34"
provides:
  - "All 33 former helper arms (25 route files) decide admin through createRequestContext() then requireActiveUser(ctx) then requireRole(ctx, \"admin\")"
  - "F-061 fixed at those arms: anonymous 401 Unauthorized, non-admin 403 Forbidden (recommendations/batch POST is the one non-admin status change)"
  - "DI-48 fixed at those 33 arms (DEC-58): a banned admin gets 403 Account suspended from the handler"
  - "The moderation reviews route and both admin page layouts decide admin through the request context and hasRole"
  - "src/lib/admin.ts deleted; nothing imports it"
  - "FIXED_ARMS and BAN_GUARDED_ARMS each hold all 33 helper arms, with a subset test; e2e admin-guard pin flipped to FIXED F-061"
affects: [05-14, 05-15, 05-17, 05-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin arm preamble: createRequestContext(), requireActiveUser(ctx), requireRole(ctx, \"admin\"), then `const user = auth.user; const supabase = ctx.supabase;` only where the arm reads them"
    - "Page layouts decide admin with getRequestContext() and `ctx.profile === null || !hasRole(ctx.profile, \"admin\")`"

key-files:
  created:
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/admin-guard-adoption.txt
  modified:
    - 25 admin route files under src/app/api/admin/** plus src/app/api/recommendations/analytics/route.ts and src/app/api/recommendations/batch/route.ts
    - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
    - src/app/admin/layout.tsx
    - src/app/moderation/layout.tsx
    - src/server/context.ts (comment only)
    - src/app/api/admin/analytics/users/route.test.ts
    - src/__tests__/api/admin/admin-guard-defect.test.ts
    - e2e/specs/admin-guard.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/phase-05-decisions.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md
  deleted:
    - src/lib/admin.ts

key-decisions:
  - "DEC-58: every admin arm runs requireActiveUser(ctx) before requireRole(ctx, \"admin\"), so a banned admin is refused by the handler and not only by the proxy. requireRole itself is unchanged. 05-14 applies the same to calculate-popularity"
  - "DI-48 is closed here for the 33 helper arms, because this plan touched every one of them anyway; the plan does not assign DI-48 to a later plan"
  - "The analytics/users suite was rewired to the @/lib/supabase/server seam with a caller-and-profile client; no expect( line changed"

patterns-established:
  - "The admin guard preamble above. It is the one admin decision for API routes; layouts use getRequestContext() plus hasRole"

requirements-completed: []  # REFAC-13 continues in 05-14..05-19; REFAC-11 flips in 05-19 once BAN_GUARDED_ARMS holds all 35

# Metrics
duration: 11min
completed: 2026-09-24
---

# Phase 5 Plan 13: Admin decisions through the seam Summary

**All 33 former admin-helper arms now decide admin with `createRequestContext()`, `requireActiveUser(ctx)` and `requireRole(ctx, "admin")`. Anonymous callers get 401 and non-admins get 403, which fixes F-061. A banned admin is refused by the handler, which fixes DI-48 for those 33 arms (DEC-58). The moderation reviews route and both admin layouts now decide admin from the request context. `src/lib/admin.ts` has been deleted.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-09-24T21:25Z
- **Completed:** 2026-09-24T21:36Z
- **Tasks:** 3 of 3
- **Files:** 1 created, 36 modified, 1 deleted

## Accomplishments

- **The swap (Tasks 1 and 2).** A script replaced the helper call and its deny branch(es) at all 33 arms in 25 files (17 arms in 12 files, then 16 in 13). Each arm now starts with the seam preamble. `ctx.supabase` stands in for the helper's `supabase`; it is the same cookie client, so every handler read stays on the same client. `auth.user` stands in for `user`.
  - No other line changed: service-client uses, `logAdminAction` calls (still passing `adminEmail`, which 05-14 changes) and bodies are untouched.
  - The script made one false positive, a `user` binding in `admin/organizer-requests` GET that matched `user:users(*)` inside a select string. It was removed by hand.
  - A string-aware check then confirmed that every remaining binding is read. This check stands in for ESLint, whose config does not flag unused locals.
- **The ledger protocol for both tasks.**
  - The unedited DEFECT suite went red against the fixed source: 33 rows for Task 1 (16 D1, 17 D4) and 31 for Task 2 (14 D1, 1 D2, 16 D4).
  - After the move it was green.
  - With the pre-fix sources put back, it went red on the same rows. The fixed sources were then restored, `cmp`-identical.
  - `admin-guard-characterization.test.ts` and `adminArmTable.ts` are byte-identical to eb62980 (`git diff | wc -c` = 0) and green throughout.
  - There are 25 ledger rows for the route files and 1 for the e2e flip.
- **`analytics/users/route.test.ts` rewired.** It now mocks `@/lib/supabase/server` with a client whose first `from()` call is the context's profile read. `git diff | grep -E '^[-+].*expect\('` prints nothing.
- **Task 3.**
  - Moderation reviews GET now uses `requireUser` for the 401 (same bytes) and `ctx.profile !== null && hasRole(ctx.profile, "admin")` in place of the inline service-client roles read. The creator path is unchanged.
  - Both layouts now use `getRequestContext()` and `hasRole`, with the same redirects.
  - The moderation layout keeps its display read on `ctx.supabase`, narrowed to `email, name, avatar_url`.
  - The helper was deleted after `grep -rn "@/lib/admin" src` exited 1.
  - The e2e pin is now `FIXED F-061: anonymous admin call answers 401`.
- **Playwright** after a clean `supabase db reset --local` and seed: admin-guard, admin-moderation-queue and admin-login-cookie-equivalence passed 17/17, exit=0. Admins still reach moderation, students are still kept out, and the admin sign-in cookie path is unchanged.

## Task Commits

1. **Task 1: analytics, audit-log, clubs, events and experiments through requireRole.** `90819ee` (refactor)
2. **Task 2: featured, organizer, report, stats, users and recommendations through requireRole.** `9f0e5b5` (refactor)
3. **Task 3: layouts and moderation reviews through the context; helper deleted; e2e pin flipped.** `b8e172e` (refactor)

## Floor after this plan

| Gate | Before (05-12) | After |
|---|---|---|
| `npx jest --ci` | 1297 passed, 70 suites | 1298 passed, 0 failed, 70 suites (+1: the FIXED/BAN subset test) |
| `node scripts/check-characterization-tags.mjs --all` | ok 34 | ok 34 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 (19 warnings, all in files this plan did not touch) |
| `node scripts/check-elevated-ratchet.mjs` | committed 25 / live 22 | committed 25 / live 22, PASS |
| Playwright (3 admin specs, clean reset) | n/a | 17/17 |
| `git grep 'requireRole(ctx, "admin")' -- src/app/api` | 0 | 33 arms in 25 files |

## Decisions Made

- **DEC-58 (recorded in `evidence/phase-05-decisions.md`).** `requireActiveUser(ctx)` runs before `requireRole(ctx, "admin")` at every admin arm. The deny bytes, in order:
  - anonymous: 401 `Unauthorized`
  - no profile: 403 `Profile not found`
  - banned: 403 `Account suspended`
  - non-admin: 403 `Forbidden`

  I did not make `requireRole` read the ban columns. That would give the role guard a second job, and it would change the guard for layouts that redirect instead.
- **DI-48 is closed here.** The orchestrator's note said to close it if this plan touched every admin arm, which it does, and no later plan owns it. `BAN_GUARDED_ARMS` holds 33 of 35 arms. The two calculate-popularity arms have no user gate until 05-14.

## Deviations from Plan

### Rule-resolved choices

**1. The "three routes move from 401 to 403" must-have: only one does.**
- `admin/clubs` GET and `admin/organizer-requests` GET already answered a non-admin 403 Forbidden (05-12 measured this, PRESERVE P1). They still do.
- Only `recommendations/batch` POST moved, from 401 to 403 (D2 row flipped).
- Both commit bodies say so. The candidate correction is for 05-19 (DI-52 per 05-12).

**2. Addition beyond the plan: DI-48 closed in the same commits (DEC-58).**
- Every arm also composes `requireActiveUser(ctx)`, and the 33 ids joined `BAN_GUARDED_ARMS`.
- Side effect at the handler: a signed-in caller with no profile row gets 403 `Profile not found` instead of `Forbidden`.
- On the real stack the proxy already answers both callers on `/api/*` with these exact bytes (F-062, 05-05 row d-api). The browser-visible bytes do not change.

**3. One extra test in the DEFECT file.** All 33 helper arms must be in both sets. It is a subset check, so 05-14 can add the calculate-popularity ids without editing it.

**4. `src/server/context.ts` got a comment-only edit.** Its docblock described the deleted file in the present tense.

**5. The moderation layout's display read no longer selects `roles`.** The admin decision moved to the context, so the column is unused. The plan names the display read as "email, name and avatar_url".

**6. Moderation reviews anonymous branch.** This uses `requireUser(ctx)`, which returns the same 401 bytes as the inline branch it replaces.

### Auto-fixed Issues

**1. [Rule 1 - Bug, my own script] An unused `user` binding in admin/organizer-requests GET**
- **Found during:** Task 2
- **Issue:** the swap script's usage check matched `user:users(*)` inside a select string.
- **Fix:** removed the binding, then ran a string-aware check that every binding in all 25 files is read.
- **Commit:** `9f0e5b5`

## Deferred items found

These are candidates for 05-19 to register (the next DI id is DI-52, and 05-12 already proposed DI-52 for the legacy-401 correction):
- **CLAUDE.md is stale.** `CLAUDE.md:67` says admin verification goes through `verifyAdmin()` in `lib/admin.ts`, and `.claude/CLAUDE.md:327` names `src/lib/admin.ts`. Both are now wrong. This plan does not edit CLAUDE.md.
- **Three admin decisions still read only the role.** The two admin layouts and the admin path of `GET /api/moderation/reviews/...` do not read the ban. For pages the proxy enforces the ban. The moderation route is a read. DI-48's wording covers `/api/admin/*`, and its status note in `deferred-items.md` records this.
- **`adminArmTable.ts` line 8 is stale.** It still names `src/lib/admin.ts` as the helper file. By rule this file is not edited in a fix commit.

## Observations for later plans

- **05-14:**
  - calculate-popularity should also compose `requireActiveUser(ctx)` before `requireRole` (DEC-58). Then add both ids to `BAN_GUARDED_ARMS` as well as `FIXED_ARMS`. Otherwise their D4 rows stay open and REFAC-11 cannot flip.
  - 05-14's plan text shows only the `requireRole` lines.
- **05-19:**
  - REFAC-11 flips once `BAN_GUARDED_ARMS` holds all 35 arms.
  - The INTENTIONAL BEHAVIOUR CHANGE list should say that only one route's non-admins moved from 401 to 403. It should also list DEC-58's banned-admin and no-profile bytes at the handler.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. The threat register's mitigations were applied:
- **T-05-13-01:** `FIXED_ARMS` holds all 33 arms, PRESERVE is unedited and green, and the helper grep exits 1.
- **T-05-13-02:** `requireRole` is unchanged and fails closed on a null profile. The layouts treat a null profile as not admin.
- **T-05-13-03:** the moderation-queue and cookie-equivalence specs are green after a clean reset.

## Issues Encountered

None beyond the deviations above.

## Next Phase Readiness

- 05-14 can start. The stack is reset and seeded, and port 3000 is free. The tree is clean apart from the three untracked files that must stay untracked.

## Self-Check: PASSED

- FOUND: evidence/admin-guard-adoption.txt
- FOUND: every one of the 25 route files holds `requireRole(ctx, "admin")` once per exported verb
- ABSENT (as intended): src/lib/admin.ts
- FOUND: commits 90819ee, 9f0e5b5, b8e172e
- Jest 1298/1298, tsc exit 0, lint exit 0, tag gate ok 34, ratchet PASS, Playwright 17/17

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
