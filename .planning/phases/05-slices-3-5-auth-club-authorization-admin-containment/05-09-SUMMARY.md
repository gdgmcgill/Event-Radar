---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 09
subsystem: auth
tags: [characterization, club-authorization, rls, playwright, mutation-testing, REFAC-12, F-087, F-008]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-07: every clubs-family write arm opens with createRequestContext + requireActiveUser + requireOnboarded; 05-08: the slice-3 floor (Jest 1013, Playwright 53, tag gate ok 27)"
provides:
  - "PRESERVE net over research § C's 17 club sites: anonymous, non-member, wrong role, admin without membership and right role, plus the member/non-member difference at the three flag sites and the composite arms (107 tests)"
  - "DEFECT F-087 at the unit level: which client (cookie fake A or elevated fake B) performs each owner write; the whitelist and audit rows that must not move (13 tests)"
  - "DEFECT F-087 on the real stack: the club_owner's PATCH of their own club answers 500 today"
  - "12 cross_club_attacker 403s pinned through the real harness, byte-equal to § C"
  - "The RLS ring measured, not assumed: 8 rolled-back probes (F-008 forged insert succeeds; owner UPDATE on clubs and club_members affects 0 rows; attacker delete, attacker invite and anon insert are denied)"
  - "5 source mutations plus 1 control, each red on its named test (the control stays green), each restored byte-identical"
affects: [05-10, 05-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two separate fakes, cookie and elevated, each with its own call log, so a suite can say which client performed a write"
    - "Every attacker body in an e2e authz spec is one that would fail validation even if the gate were open, so a regressed gate goes red without writing a row"
    - "One psql invocation per RLS probe, so each probe's stderr stays attributable to it"

key-files:
  created:
    - src/__tests__/api/clubs/club-gates-characterization.test.ts
    - src/__tests__/api/clubs/club-owner-writes-defect.test.ts
    - e2e/specs/club-authorization.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-4-characterization.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/rls-ring-before.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-4-mutation-check.txt
  modified: []

key-decisions:
  - "PRESERVE pins only the observable at each site: status and body for refusals, and the status class for admissions. It never pins query shape or which client performs a write. So 05-10 can move the membership read into requireClubRole and the owner writes onto the elevated door without editing it (control 3b proves the second)"
  - "The composite arms (events/[id] PATCH and DELETE) admit an admin through the handler's own inline admin read. They are pinned separately from the 12 gates, where an admin without membership gets the site's 403 (R9)"
  - "The transfer demotion's filter (the caller's membership id) sits in the DEFECT file rather than the PRESERVE file, because DEC-40 changes it to (club_id, user_id) in 05-10"

patterns-established:
  - "Slice characterization: measure with a temporary, never-committed harness; pin; prove each pin with a source mutation; and add a control that applies the next plan's intended change and stays green"

requirements-completed: []  # REFAC-12 is characterized here, not delivered; 05-10 delivers it

# Metrics
duration: 12min
completed: 2026-09-24
---

# Phase 5 Plan 09: Slice 4 Characterization Summary

**Every club-membership decision is now pinned, before slice 4 rewrites it: all 17 sites of research § C, as five callers, with 403 bytes byte-equal to § C. F-087 is pinned twice: which client performs each owner write, and the owner's real-stack PATCH 500. The RLS ring is measured, including both F-008 forged-insert holes.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-09-24T20:16:32Z
- **Completed:** 2026-09-24T20:28:46Z
- **Tasks:** 3 of 3
- **Files created:** 6 (2 Jest suites, 1 Playwright spec, 3 evidence files). No production file was modified.

## Accomplishments

- **The PRESERVE table** (`club-gates-characterization.test.ts`, 107 tests):
  - P0: 17 rows in § C's order (12 gates, 3 flags, 2 composite arms). Two accepted sets exist. Every deny string equals § C's.
  - P1: each site's anonymous bytes. `#2` is public and answers 200. `#15` and `#17` keep their own 401 texts.
  - P2: the non-member (the attacker, owner of a different club) gets each refusing site's exact 403, and neither client records a write.
  - P3: the organizer gets the same 403 at the nine owner-only gates.
  - P4: an admin with no membership gets the same 403 at all 12 gates (R9). The composite arms admit the admin through their own admin arm.
  - P5: every accepted role proceeds, meaning neither 401 nor 403.
  - P6, the flag sites:
    - `#2`: `isOrganizer`, with pending rows and RSVP counts for members only.
    - `#14`: comments for members only.
    - `#17`: the auto-approve rule, with six outcomes. Members of an approved club get approved. A non-member of the target club, a member of a pending club, and a creator with no club get pending. An admin gets approved.
    - `#15`: the composite member arm and the `isClubMember` moderation branch.
    - `#16`: the member arm and the creator arm.
- **DEFECT F-087** (`club-owner-writes-defect.test.ts`, 13 tests).
  - What moves in 05-10:
    - The `clubs` PATCH update is on the cookie client today.
    - The `status: "deleted"` soft-delete is on the cookie client today.
    - The `club_members` role update is on the cookie client today.
    - The transfer demotion is filtered by the caller's membership `id` today (DEC-40 changes it).
  - What stays:
    - The whitelist drops `status` from `{ description: "x", status: "rejected" }`.
    - The `club_deleted` and `club_ownership_transferred` audit inserts are on the elevated client.
    - The caller's membership is read on the cookie client.
- **Playwright** (`e2e/specs/club-authorization.spec.ts`): 29/29 on the first run after a clean reset and seed (10 setup + 19 spec tests).
  - 12 `cross_club_attacker` 403s, above the plan's minimum of 9.
  - The organizer is refused the owner-only PATCH, and reads members and analytics.
  - The owner reads invitations, members and analytics.
  - **DEFECT F-087:** the owner PATCHes the club's current description, gets `500 {"error":"Failed to update club"}`, and the description is unchanged afterwards.
- **The RLS before-probe** (`evidence/rls-ring-before.txt`): 8 probes, each `BEGIN … ROLLBACK` with `auth.uid()` proven, and no `RETURNING`.
  - The F-008 holes are P1 and P2, `INSERT 0 1` ×2 (a forged `created_by`, and a non-member self-approving).
  - The F-087 cause is P3 and P4: the owner's `UPDATE clubs` and `UPDATE club_members` each affect 0 rows.
  - These denials hold: P5 (attacker `DELETE 0`), P7 (attacker invitation `42501`) and P8 (anon events insert `42501`).
  - P6 is allowed, as the policy intends: the owner removing a member gets `DELETE 1`.
  - Counts afterwards: events 5→5, club_members 6→6, invitations 0→0, and the description md5 is unchanged.
- **Mutation evidence** (`evidence/slice-4-mutation-check.txt`): five source mutations, each red on its named test. Each was restored with `git diff --exit-code` 0.
  - 1: the widened invites POST role set.
  - 2: the changed members GET deny text.
  - 3: the owner PATCH write moved to the service factory.
  - 4: the forced auto-approve.
  - 5: the admin bypass on members DELETE.
  - Control 3b applies 05-10's elevated-write direction to PRESERVE, and it stays 107/107 green.

## Task Commits

1. **Task 1: PRESERVE table and F-087 DEFECT pins.** `d0ba354` (test)
2. **Task 2: club authorization spec and RLS-ring before-probe.** `64a9361` (test)
3. **Task 3: mutation evidence.** `a566410` (docs)

## Floor after this plan

| Gate | Before (05-08) | After |
|---|---|---|
| `npx jest --ci` | 1013 passed, 63 suites | 1133 passed, 0 failed, 65 suites (+107 PRESERVE, +13 DEFECT) |
| `node scripts/check-characterization-tags.mjs --all` | ok 27 | ok 29 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| Playwright | 53/0 (full) | the new spec: 29/0 (10 setup + 19). The full suite was not re-run in this plan; the slice-4 close runs it |
| `git diff --stat f1ab6a1 -- src/app src/lib src/server` | n/a | empty |

## Decisions Made

- **Only observables are pinned in PRESERVE.** Query shape, the `.single()`/`.maybeSingle()` choice and the writing client are left free, because 05-10 changes all three. The P4 composite rows originally also counted membership reads. That was dropped before commit: the order in which the composite arm consults creator, admin and membership is not a membership decision.
- **Measured before pinned.** `zz-measure-temp.test.ts` drove the 17 sites × 5 callers plus the flag extras. It was deleted after its run and never committed, and its output is in `slice-4-characterization.txt` §1 verbatim. All 14 measured deny strings equal § C's, with no mismatch.

## Deviations from Plan

### Rule-resolved choices

**1. Attacker bodies chosen so a regressed gate cannot write.** The plan lists `DELETE members { memberId: IDS.memberOfApproved }` for the attacker, but its prohibitions say "no mutation route is called with a body that would succeed for the attacker". If that gate regressed, the listed body would delete club_member's seeded row.
- The spec therefore targets `IDS.ownerOfApproved` for both the members DELETE and the members/role PATCH. If either gate were open, the handler would answer 400 "Cannot remove the club owner" or "Cannot change owner role".
- The other attacker bodies follow the same rule: `{}` for PATCH, invites POST and transfer, and a text file for banner and logo.
- The 403 assertion is unchanged, and the prohibition wins.

**2. Twelve attacker assertions, not nine.** Event analytics (#13), banner (#11) and logo (#12) were added. The acceptance criterion is "at least 9", and no plan-required assertion changed.

**3. The RLS probe output was captured twice.** The first run was one psql invocation, and its stderr ERROR lines interleaved out of order with stdout through the docker pipe. The recorded run uses one psql invocation per probe, with stderr labelled. Every probe is a rolled-back transaction, and both runs showed the same eight outcomes. Only the second run is in the evidence.

**4. Control cycle 3b added** beyond the plan's five cycles. It changes no plan-required assertion.

### Auto-fixed Issues

None.

## Deferred items found

For 05-11 to register:
- **Candidate DI: a non-owner member's `GET /api/clubs/[id]/members` is truncated by RLS.**
  - The organizer passes gate #6, but the listing runs on the cookie client. `club_members` SELECT allows only the owner (`is_club_owner`) or one's own row, so club_member sees 1 of the approved club's 3 memberships.
  - Evidence: `slice-4-characterization.txt` §4, read-only and rolled back.
  - It is the same family as research § D's events-UPDATE handler/RLS mismatch for non-creator members. It is not F-087.
- **Observed, already in research § D (no new item):** the composite `events/[id]` PATCH and DELETE admit a non-creator member at the authz ring. `events` UPDATE RLS is `created_by`-only, so on the real stack the PATCH would 500 and the DELETE would report success without deleting. This plan pins only the authz-ring half, in the fake.

## Known Stubs

None. Only tests, a spec and evidence were created.

## Threat Flags

None. No endpoint, auth path or schema changed. Threat register:
- **T-05-09-01 (admin bypass):** 12 P4 gate rows. Cycle 5 proves they bite.
- **T-05-09-02 (probe rows):** every probe is in BEGIN … ROLLBACK. The counts afterwards are unchanged (events 5, club_members 6, invitations 0), and 0 probe rows remain.
- **T-05-09-03 (seed values):** the owner PATCH sends the current description, and the re-read proves it unchanged. Every attacker body is one that would fail validation.
- **T-05-09-04 (transcribed messages):** every 403 was measured in the fake (§1) and on the real stack (§3), then compared with § C. There was no mismatch.
- Only the local stack was used: no `--linked` and no production. The evidence files were grepped for key- and token-shaped strings, with no matches.

## Issues Encountered

None. Playwright passed on the first run.

## Next Phase Readiness

- **05-10 (club guard adoption, F-087 fix):**
  - Adopt `requireClubRole` with the literal sets `["owner"]` at #3, 4, 5, 7, 8, 9, 10, 11, 12 and `["owner","organizer"]` at #1, 2, 6, 13, 14, 15, 16, 17. `club-gates-characterization.test.ts` must stay unedited and green.
  - F-087 moves D1, D2 and D4's "today" rows from fake A to fake B. The transfer demotion row moves to a `(club_id, user_id)` filter.
  - The e2e "DEFECT F-087" test flips to 200.
- **05-11 (F-008 policy):** P1 and P2 in `rls-ring-before.txt` must both become `42501`. Register the candidate DI above.
- The stack is left reset and seeded; this plan's spec and probes wrote nothing. Port 3000 is free.

## Self-Check: PASSED

- FOUND: src/__tests__/api/clubs/club-gates-characterization.test.ts, src/__tests__/api/clubs/club-owner-writes-defect.test.ts, e2e/specs/club-authorization.spec.ts, evidence/slice-4-characterization.txt, evidence/rls-ring-before.txt, evidence/slice-4-mutation-check.txt
- FOUND commits: d0ba354, 64a9361, a566410
- Tag gate `--all` ok 29; tsc exit 0; Jest 1133/1133; `git status --porcelain -- src/app src/lib src/server supabase/` empty

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
