---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 07
subsystem: auth
tags: [handler-ring, seam-guards, ban, onboarding, F-088, F-089, DEC-34, DEC-35, REFAC-11]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-03: WRITE_ARMS table, the PRESERVE and DEFECT handler-ring suites; 05-04: requireActiveUser and requireOnboarded; 05-06: the events-family adoption shape and 14 GUARDED ids"
provides:
  - "All 39 non-admin write arms fail closed on ban, missing profile and (except DEC-34's two exemptions) onboarding, on the handler ring itself"
  - "GUARDED equals the set of WRITE_ARMS ids, and a completeness test enforces it"
  - "The legacy ban helper is deleted; src/lib/ban.ts exports only isBanned"
  - "The onboarding wizard's two calls and anonymous telemetry/feedback still admit"
affects: [05-08, 05-09, 05-10, 05-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anonymous-tolerant writer prologue: createRequestContext(), then `if (ctx.user) { requireActiveUser; requireOnboarded }`, then `const user = ctx.user`"
    - "Onboarding exemption at the call site: requireActiveUser only, with a comment naming DEC-34 / research C2"

key-files:
  created:
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/handler-adoption-rest.txt
  modified:
    - src/app/api/clubs/route.ts
    - src/app/api/clubs/[id]/appeal/route.ts
    - src/app/api/clubs/[id]/follow/route.ts
    - src/app/api/clubs/[id]/invites/route.ts
    - src/app/api/clubs/[id]/members/role/route.ts
    - src/app/api/clubs/[id]/members/route.ts
    - src/app/api/clubs/[id]/route.ts
    - src/app/api/clubs/[id]/transfer/route.ts
    - src/app/api/clubs/banner/route.ts
    - src/app/api/clubs/logo/route.ts
    - src/app/api/users/[id]/follow/route.ts
    - src/app/api/users/[id]/route.ts
    - src/app/api/profile/avatar/route.ts
    - src/app/api/profile/banner/route.ts
    - src/app/api/profile/inferred-tags/route.ts
    - src/app/api/profile/interests/route.ts
    - src/app/api/notifications/[id]/route.ts
    - src/app/api/notifications/route.ts
    - src/app/api/organizer-requests/route.ts
    - src/app/api/onboarding/complete/route.ts
    - src/app/api/interactions/route.ts
    - src/app/api/feedback/route.ts
    - src/lib/ban.ts
    - src/server/context.ts
    - src/server/authz/requireActiveUser.ts
    - src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts
    - src/__tests__/api/events/save-characterization.test.ts
    - src/__tests__/api/events/rsvp-characterization.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-fixture-completions.md

key-decisions:
  - "Anonymous-tolerant arms keep `user?.id || null` through a `const user = ctx.user` binding rather than switching to `??`, so the handler's own falsy semantics are unchanged (the plan's instruction)"
  - "The guard prologue sits first in interactions and feedback, ahead of body validation. Anonymous responses are unchanged; a banned or un-onboarded signed-in caller with an invalid body now gets the 403 rather than the 400"
  - "The helper's name was removed from two Phase 4 PRESERVE docblocks with comment-only edits so `grep -rn checkBanStatus src` prints nothing; no assertion, fixture or tag word changed"

patterns-established:
  - "Completeness assertion: the DEFECT file's GUARDED set must equal the table's ids, so an unguarded new arm turns the net red"

requirements-completed: []  # REFAC-11's handler ring is complete; 05-08 (slice-3 close, Playwright) also claims REFAC-11, so the checkbox is left for it

# Metrics
duration: 7min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 07: Remaining Write-Arm Guards and Legacy Ban Helper Deletion Summary

**The last 25 non-admin write arms now open with `requireActiveUser(ctx)` and `requireOnboarded(ctx)`. The two onboarding-wizard calls get only the first guard, and anonymous interactions/feedback get both only when a user is present. `GUARDED` holds all 39 arms, with a completeness test, and `checkBanStatus` no longer exists anywhere under `src/`.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-09-24T05:53:38Z
- **Completed:** 2026-09-24T06:00:10Z
- **Tasks:** 2 of 2
- **Files:** 1 created, 30 modified

## Accomplishments

### Task 1: clubs-family write arms (12 arms, 10 files)

- **Every arm now opens with the guards.** The arms are clubs POST, `clubs/[id]/appeal` POST, `clubs/[id]/follow` POST and DELETE, `clubs/[id]/invites` POST, `clubs/[id]/members/role` PATCH, `clubs/[id]/members` DELETE, `clubs/[id]` PATCH and DELETE, `clubs/[id]/transfer` POST, `clubs/banner` POST and `clubs/logo` POST. Each opens with `createRequestContext()`, `requireActiveUser(ctx)` and `requireOnboarded(ctx)`.
- **All twelve answered an anonymous caller with the plain `401 {"error":"Unauthorized"}`,** so none needed an explicit anonymous branch.
- **The legacy helper calls are gone** from clubs POST and appeal. Their PRESERVE P2 bytes (`403 Account suspended`) now come from `requireActiveUser`.
- **Club logic untouched.** `git diff c1ed6ba -- src/app/api/clubs | grep '^[-+].*from("club_members")'` prints nothing, and no service-client line moved. That includes the `clubs/[id]` DELETE dynamic import. GET arms are untouched.
- **GUARDED went from 14 to 26.** The ledger protocol ran three states:
  - unedited: red, 34 failures (10 D1 + 12 D2 + 12 D3);
  - ids added: green;
  - pre-fix sources restored: red, 34 failures. The fixed sources were then restored and all ten were `cmp`-identical.

### Task 2: the remaining 13 arms; helper deleted (12 files + ban.ts)

- **Both guards** on `users/[id]/follow` POST and DELETE, `profile/avatar`, `profile/banner`, `profile/inferred-tags`, `profile/interests`, `notifications/[id]` PATCH, `notifications` POST and `organizer-requests` POST.
- **`requireActiveUser` only** on `users/[id]` PATCH and `onboarding/complete` POST: these are the DEC-34 exemptions. `users/[id]` keeps its self-only 403 right after the guard. The exemptions are what PRESERVE P3 checks, and it passes unedited.
- **`if (ctx.user) { … }` guards** on `interactions` and `feedback`. PRESERVE P1 (anonymous 201 / 200) and P5 pass unedited.
- **GUARDED now holds all 39 ids.** A new test asserts that GUARDED equals the set of `WRITE_ARMS` ids, and the Status line reads `FIXED in 05-06 and 05-07`. Removing one id turns the completeness test red (§3b).
- **Ledger protocol:**
  - unedited: red, 36 failures (12 D1 + 13 D2 + 11 D3);
  - ids added: green;
  - pre-fix sources restored: red, 36 failures. All twelve fixed files were then restored `cmp`-identical.
- **`checkBanStatus` is deleted** along with its `createClient` and `NextResponse` imports. `src/lib/ban.ts` now exports only `isBanned`, and `grep -rn checkBanStatus src` has exit 1.

## Task Commits

1. **Task 1: clubs-family write arms fail closed.** `aa2191e` (fix, INTENTIONAL BEHAVIOUR CHANGE)
2. **Task 2: remaining write arms guarded; legacy ban helper deleted.** `c620d16` (fix, INTENTIONAL BEHAVIOUR CHANGE)

**Plan metadata:** the final docs commit. It covers the SUMMARY, STATE and ROADMAP, and the ledger backfill of `c620d16`. REQUIREMENTS.md was not changed: REFAC-11 stays unchecked because 05-08, the slice-3 close, also claims it.

## Floor after this plan

| Gate | Before (05-06) | After |
|---|---|---|
| `npx jest --ci` | 1012 passed, 63 suites | 1013 passed, 0 failed, 63 suites (+1: the completeness test) |
| `node scripts/check-characterization-tags.mjs --all` | ok 27 | ok 27 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings; eslint over every touched source file exits 0 |
| `node scripts/check-elevated-ratchet.mjs` | committed=25 live=24 | committed=25 live=24 |
| CI-env `npm run build` | exit 0 | exit 0 |
| `git diff c1ed6ba -- write-handlers-characterization.test.ts writeHandlerTable.ts` | n/a | empty |

## Decisions Made

- **The `||` falsy semantics are kept** in interactions and feedback through a `const user = ctx.user` binding. The plan offered both `??` and "keep the handler's own falsy semantics", and the second is the non-changing reading.
- **The guard prologue comes first** in the anonymous-tolerant arms, as DEC-34's "first statements" requires, so it now runs ahead of body validation. Anonymous bytes are unchanged, including malformed-body anonymous requests. Only a signed-in banned, profile-less or un-onboarded caller sees a different response, which is the intended change.

## Deviations from Plan

### Rule-resolved choices

**1. Comment-only edits to two PRESERVE docblocks.** The acceptance check `grep -rn "checkBanStatus" src` must print nothing, but `save-characterization.test.ts` and `rsvp-characterization.test.ts` named the helper in their leading docblocks. The prohibition "No PRESERVE suite is edited" conflicts with that check. I resolved it this way:
- Only ` *` docblock lines changed. The `-U0` diff check prints no non-comment line.
- No assertion, fixture, import, tag word or F-id changed, and the tag gate still reports ok 27.
- The same edit dropped the stale "ban asymmetry, pinned for Phase 5" bullet that 05-06 flagged.

This is recorded in `evidence/handler-adoption-rest.txt` Task 2 §6.

**2. `src/server/authz/requireActiveUser.ts` docblock updated.** The file is not in the plan's list. Its prose described the helper in the present tense, and it now uses the past tense. This was a comment-only change.

**3. No fixture completions were needed.** `slice-3-fixture-completions.md` gained a "05-07 — none needed" section with the evidence pointer instead of table rows.

**4. `authError || !user` branches collapsed.** Six arms (clubs POST, the profile routes, the notifications routes and organizer-requests) also refused a caller when `getUser()` returned an error alongside a user. The context treats only a null user as anonymous. supabase-js returns `user: null` whenever it returns an error, so no reachable response changes. 05-06 made the same collapse on the events family.

### Auto-fixed Issues

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file-access pattern or schema. Threat register:
- **T-05-07-01:** the completeness test passes and was shown red with one id removed.
- **T-05-07-02:** P3 passes unedited, and the exemptions call `requireActiveUser` only.
- **T-05-07-03:** P1 and P5 for interactions and feedback pass unedited.
- **T-05-07-04:** the helper is deleted and the grep has exit 1.

## Observations for later plans

- **05-08 Playwright.** Direct API writes by the un-onboarded seed persona now get 403 `Onboarding required` on the clubs, follows, profile, notifications and organizer-request arms too, not just the events family. The two wizard calls must still pass, as the wizard-call check does.
- **`recommendations/feedback` dead fallback.** The unreachable body-`user_id` fallback is still in the source. That file was outside this plan's list, so removing it and registering or closing the candidate impersonation DI is left to 05-08.
- **`profile/inferred-tags` DELETE.** The handler's own `404 {"error":"Profile not found"}` branch is now unreachable for a caller with no users row, because the guard answers 403 first. It remains for a row that disappears between the two reads.
- **Prose in unedited test files.** `write-handlers-characterization.test.ts` and `writeHandlerTable.ts` still describe "the legacy ban helper" without naming it. Both are required to stay unedited. The `legacyBan` flag now records which arms called the helper before 05-06/05-07.

## Issues Encountered

- The appeal route had a blank line between `getUser()` and its `if (!user)`, so the first scripted replacement stopped with a count mismatch before touching that file. I finished it with a dedicated replacement.
- zsh has no `PIPESTATUS`, so three evidence exit codes printed empty. I re-ran them standalone (all 0), and the evidence lines say so.

## Self-Check: PASSED

- FOUND: evidence/handler-adoption-rest.txt, 05-07-SUMMARY.md
- FOUND commits: aa2191e, c620d16
- `grep -rn checkBanStatus src` exit 1; GUARDED ids 39; Jest 1013/1013; tsc exit 0; tag gate ok 27; CI-env build exit 0
