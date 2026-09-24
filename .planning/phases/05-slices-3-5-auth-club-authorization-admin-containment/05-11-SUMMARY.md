---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 11
subsystem: database
tags: [rls, pgtap, migration, F-008, F-016, F-087, REFAC-12, DEC-42, DEC-43, DEC-57, slice-close, playwright]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-09: the RLS before-probe (P1/P2 holes), the club authorization spec, the PRESERVE and DEFECT club suites; 05-10: requireClubRole at all 17 sites, F-087 through the elevated door"
provides:
  - "public.is_club_member(uuid) and the DEC-42 events INSERT policy (F-008), local-only until DI-23"
  - "pgTAP 060: 30 both-direction assertions over events, clubs, club_members and club_invitations, proven to bite both ways"
  - "the mutation check covers *_events_insert_club_scope.sql"
  - "regenerated types (the is_club_member entry only), CI drift diff empty"
  - "e2e F-016 proof: invite, open, accept, member, restored"
  - "slice-4 floor from a clean reset and the close note; F-087 Fixed; F-008/F-016 Open to 08; DI-49..DI-51; REFAC-12 Complete"
affects: [05-12, 05-13, 05-14, 05-15, 05-16, 05-19, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An allowed pgTAP insert whose row references auth.users is asserted as throws_ok 23503: RLS WITH CHECK runs before the FK trigger, so the FK error proves the policy admitted the row without writing the auth schema (D-21)"
    - "A policy's proof needs two mutations: removing it turns the allow rows red, and loosening it to WITH CHECK (true) turns the deny rows red"

key-files:
  created:
    - supabase/migrations/20260923120000_events_insert_club_scope.sql
    - supabase/tests/database/060-club-tenant-isolation.test.sql
    - e2e/specs/club-invitation-acceptance.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/schema-push-slice-4.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/floor.slice-4-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/playwright.slice-4-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-4-close.md
  modified:
    - scripts/pgtap-mutation-check.sh
    - src/lib/supabase/types.ts
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md

key-decisions:
  - "The mutation check ran after the fix commit, not before: it restores with git checkout and refuses to start while a listed migration is uncommitted"
  - "A second mutation (the policy re-created as WITH CHECK (true) on the live local DB) was added, because the harness's removal only denies everything and so cannot turn a deny row red"
  - "REFAC-12 is Complete (05-11). Every clause is evidenced; the RLS clause's events half is local-only until DI-23, the same local-proof rule DEC-57 applies to F-008"
  - "The F-016 spec does not assert the member's nested user: the owner's cookie client cannot read other users' rows. This was registered as DI-49 part 2, not worked around"

patterns-established:
  - "A pgTAP tenant-isolation file: helper hardening first (SECURITY DEFINER, search_path, EXECUTE grants), impersonation proof, then per-table deny/allow pairs labelled by research § D row and before-probe number"

requirements-completed: [REFAC-12]

# Metrics
duration: 20min
completed: 2026-09-24
---

# Phase 5 Plan 11: Slice 4 RLS Ring and Close Summary

**The events INSERT policy now binds `created_by` to the caller and allows `approved` only for a member of an approved club, with the admin arm kept (F-008, DEC-42). pgTAP 060 proves the club tables' tenant isolation in both directions. F-016 invite-and-accept passes end to end on the local stack. Slice 4 closes on a green floor from a clean reset: pgTAP 7 files and 116 tests, Playwright 76/0, Jest 1135/1135.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-09-24T20:46:40Z
- **Completed:** 2026-09-24T21:06:42Z
- **Tasks:** 3 of 3
- **Files:** 7 created, 6 modified

## Accomplishments

- **The F-008 migration.** `20260923120000_events_insert_club_scope.sql` is written in the fix-forward header form.
  - `public.is_club_member(uuid)` is `SECURITY DEFINER` with `SET search_path = ''`, and EXECUTE is revoked from PUBLIC and anon.
  - The policy is `DROP POLICY IF EXISTS` plus `CREATE POLICY … TO authenticated`, with DEC-42's WITH CHECK.
  - The four earlier migrations are untouched (`git diff --name-only 20137a4` on them prints nothing).
- **pgTAP 060**, 30 assertions:
  - Helper hardening: 2.
  - Impersonation proof: 1, first.
  - Events INSERT: 13. The rows are 42501 ×6, 23503 ×5 (allowed, reached the auth.users FK), and the admin `lives_ok` paired with an owner-side read.
  - Clubs UPDATE: attacker and owner both 0 rows, then an integrity read.
  - club_members: owner and attacker role changes and the attacker delete are all 0 rows, then an integrity read. The owner's delete is proven by `RETURNING user_id`.
  - club_invitations: attacker 42501; owner allowed, proven by `RETURNING club_id`.
  - Two attacker INSERT pins (clubs and club_members).
  - A final "no attacker event exists" read.
- **The local schema push** (`evidence/schema-push-slice-4.txt`):
  - CLI 2.115.0; the reset applies 5 migrations.
  - The generated types differ only by the `is_club_member` entry.
  - pgTAP passes unseeded and seeded: Files=7, Tests=116.
  - tsc exits 0 and Jest passes 1135/1135.
  - The post-commit CI drift diff is empty.
- **Mutation proof:**
  - `pgtap-mutation-check.sh` checks 5 policies. Each is RED_ASSERTION when removed and GREEN when restored, and the check exits 0. For the new policy, 060 fails 6 of 30, all allow rows.
  - Re-creating the policy as `WITH CHECK (true)` makes 060 fail tests 4-6 and 10-11, the deny rows.
- **The RLS after-matrix.** 05-09's P1 and P2 went from `INSERT 0 1` to 42501. P3 to P8 are unchanged. Three new allow probes insert: a member's approved event, the attacker's pending event, and the admin's event with no creator.
- **The F-016 spec** (`club-invitation-acceptance.spec.ts`, 4 tests):
  - The owner POSTs an invitation (201). The student opens `/invites/<token>` (200, the welcome heading, no error card).
  - The owner then sees the invitation accepted and the student listed as an organizer.
  - The membership is removed in `afterAll` and by a pre-check. Afterwards, 0 rows.
- **Slice-4 floor and close:**
  - `floor.slice-4-after.txt`: `head=9903671…`, every slice-3 block plus censuses 20-21. The `club_members` census went 42 → 24. There are 18 `requireClubRole(` call sites and 0 gate-site reads.
  - `playwright.slice-4-after.txt`, and `slice-4-close.md` (150 lines, 16 Validated rows).
- **Registers:**
  - F-087 is Fixed.
  - F-008 and F-016 stay Open, re-pointed to `"08"` with local-proof resolutions.
  - FOUNDATION_AUDIT.md was regenerated (Open 66 → 65, Fixed 25 → 26), and `validate --check findings` passes 8/8.
  - DI-49, DI-50 and DI-51 are registered; the next id is DI-52.
  - REFAC-12 is marked Complete (05-11).

## Task Commits

1. **Tasks 1+2: the F-008 migration, 060, the mutation glob and the regenerated types.** `5d9c22e` (fix, INTENTIONAL BEHAVIOUR CHANGE). This is one commit, as the plan requires.
2. **Task 2 evidence: the local schema push.** `e415431` (docs)
3. **Task 3: the F-016 spec.** `9903671` (test)
4. **Task 3: the slice-4 floor, close note, registers and REFAC-12.** `60dc541` (docs)

## Floor after this plan

| Gate | Before (05-10) | After |
|---|---|---|
| `npx jest --ci` | 1135, 65 suites | 1135 passed, 0 failed, 65 suites |
| pgTAP unseeded / seeded | Files=6 Tests=86 | Files=7 Tests=116 / Files=7 Tests=116 |
| Playwright | club spec 29/29 (targeted) | full suite 76/0, first run, clean reset |
| tag gate | ok 29 | ok 29 |
| ratchet | committed 25 / live 22 | committed 25 / live 22 |
| migration filenames | 4 | 5 |
| lint / tsc / audit | 0 errors / 0 / 2 moderate | the same |

## Decisions Made

See `key-decisions` in the frontmatter. REFAC-12 is Complete, measured clause by clause in `slice-4-close.md` § 7.
- The collapse clause: 18 guard call sites and 0 gate-site reads.
- The authz-ring clause: 12 e2e attacker 403s and the PRESERVE P2 and P4 rows.
- The RLS-ring clause: 060, plus both mutations. The events half reaches production with DI-23.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The mutation check needed the migration committed before it could run**
- **Found during:** Task 2
- **Issue:** The plan orders the mutation check before the commit. But `pgtap-mutation-check.sh` restores with `git checkout --`, and it stops with FATAL when a listed migration has uncommitted changes. The new migration was untracked.
- **Fix:** I committed `5d9c22e` first, with the four files together as the plan requires, then ran the check on the committed tree. It exited 0, so no follow-up commit was needed. The Task 2 evidence was committed separately (`e415431`).
- **Commit:** `5d9c22e`, `e415431`

**2. [Rule 2 - Missing proof] Removing the policy could not prove the deny rows**
- **Found during:** Task 2
- **Issue:** Removing the new policy leaves no INSERT policy at all, so every insert is denied. That turns 060's allow rows red but can never turn a deny row red. The F-008 regression is the opposite shape.
- **Fix:** I added mutation 10b, applied to the running local database only with no file edited: the policy re-created as `WITH CHECK (true)`. 060 failed tests 4-6 and 10-11. A reset restored it, and the suite passed again.
- **Files modified:** none (evidence only)

**3. [Rule 1 - Bug in my own spec] An over-assertion on the member's nested `user`**
- **Found during:** Task 3, targeted run 1 (13 passed, 1 failed)
- **Issue:** I asserted `row.user.email`. The plan asks only for `user_id`. The members route reads `users` on the owner's cookie client, and `users` SELECT is own-row or admin only, so `user` is null for every other member. That is a real product defect, not a spec problem.
- **Fix:** The assertion is now a comment explaining why it is not asserted. The defect is registered as DI-49 part 2. Run 2 passed 14/14 on the same stack, which also exercised the re-run path. `afterAll` removed the membership even after the failed run. Both runs are kept in `playwright.slice-4-after.txt` Part 1.
- **Commit:** `9903671`

**4. [Tooling] Pinning the CLI version for the mutation check**
- **Issue:** `npx supabase` resolves to 2.117.0 on this machine, and the pinned CLI is 2.115.0 on PATH.
- **Fix:** I ran the check as `SUPABASE_CMD=supabase bash scripts/pgtap-mutation-check.sh`, so every step used 2.115.0. The script supports this override.

### Rule-resolved choices

- **060 has 30 assertions**, not the plan's 15-row minimum. The extra rows are: helper hardening ×2; the attacker's pending event with a forged creator; the attacker's approved event in their own club; the organizer's approved event with no club; the owner's pending event in a pending club; the attacker's role change; post-delete and post-invite integrity reads; attacker INSERT pins for clubs and club_members; and a final no-attacker-event read. No plan row was dropped. Each plan row keeps its SQLSTATE or row-count shape.
- **Row 15 (the owner's invitation) uses `results_eq` on `RETURNING club_id`**, not 23503. I measured this: `club_invitations.inviter_id` references `public.users`, not `auth.users`, so the row lands. The shape is documented inline.
- **The Playwright count is 76, not the "at least 82" passed in.** 82 = 53 + 29 counts the 10 setup tests twice, because 29 is club-authorization's targeted run including setup. 76 = 53 + 19 + 4.
- **DI-51 was registered.** Research § D says to "register as a note" the handler/RLS mismatch for non-creator event members. No register held it, according to a grep of `deferred-items.md` and `findings.json`.

## Deferred items found

Registered in `evidence/deferred-items.md`:
- **DI-49:** the club member list is truncated for organizers and nameless for owners.
- **DI-50:** the transfer rollback leaves two owners.
- **DI-51:** non-creator club members pass the `events/[id]` PATCH and DELETE gates, but events UPDATE RLS is creator-only.

The next id is DI-52.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:
- **T-05-11-01:** 060 rows 4, 5 and 11 raise 42501, and mutation 10b proves they bite.
- **T-05-11-02:** the allow rows 7-9 and 12-14 pass, the after-probes insert, and the auto-approve PRESERVE rows are unedited.
- **T-05-11-03:** local only. The evidence files contain no push subcommand or linked-project flag (grep exit 1).
- **T-05-11-04:** the types were generated with `--local` on 2.115.0, and the post-commit diff is empty.
- **T-05-11-05:** after the run, the student has 0 memberships in approvedClub (floor block 13c).
- **T-05-11-06:** 060 tests 1 and 2 cover the SECURITY DEFINER setting, the empty search_path and the anon EXECUTE revoke.

## Issues Encountered

None beyond the deviations above. The full Playwright suite passed on its first run.

## Next Phase Readiness

- **Slice 5 (05-12 onward) may start.** The stack is reset and seeded, port 3000 is free, and the tree is clean apart from the three untracked files that must stay untracked.
- **05-16** adds the second local-only migration. Add it to `POLICY_MIGRATION_GLOBS` the same way, and pair removal with a loosening mutation for its deny rows.
- **05-19:** DI-51 names 05-19's final register pass as the place to register it as a finding, or to record creator-only editing as intended. F-008 and F-016 are already at `closes_in_phase: "08"`.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260923120000_events_insert_club_scope.sql, supabase/tests/database/060-club-tenant-isolation.test.sql, e2e/specs/club-invitation-acceptance.spec.ts, evidence/schema-push-slice-4.txt, evidence/floor.slice-4-after.txt, evidence/playwright.slice-4-after.txt, evidence/slice-4-close.md
- FOUND commits: 5d9c22e, e415431, 9903671, 60dc541
- `validate.mjs --check findings` exit 0; the F-087/F-008/F-016 acceptance node check exit 0; `floor.slice-4-after.txt` line 1 matches `^head=[0-9a-f]{40}$`; REFAC-12 row reads `Complete (05-11)`

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
