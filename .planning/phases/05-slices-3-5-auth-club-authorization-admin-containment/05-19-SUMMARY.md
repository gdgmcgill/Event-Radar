---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 19
subsystem: testing
tags: [phase-close, di-25, supabase-js, floor, register, requirements, REFAC-11, REFAC-12, REFAC-13, REFAC-17, REFAC-18, DEC-59]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-18: the Upstash store, DEC-59; floor Jest 1438 + 1 skipped, Playwright 91/91, pgTAP 156, ratchet 2/2"
provides:
  - "evidence/di-25-bump.txt: the throwaway-worktree proof. On supabase-js 2.116.0 there are 4 TS2345 errors in admin payloads, so the bump was not taken (DI-25 PARTIAL, carried as DI-53)"
  - "evidence/floor.phase-after.txt and evidence/playwright.phase-after.txt: the phase after-floor from a clean reset, all green"
  - "evidence/slice-5-close.md: slice 5 floor, the Validated table, findings, behaviour changes, local-only closures"
  - "evidence/PHASE-5-COMPLETION.md: the five criteria and five requirements clause by clause; owner actions; citations distinct=80 missing=0"
  - "Register: 8 findings Fixed, F-072 re-pointed to 07, F-006 and F-007 at 08, F-058 and F-040 progress recorded, F-092 registered; DI-52..DI-59 registered"
  - "REQUIREMENTS.md, the ROADMAP Requirement states block, and PROJECT.md Key Decisions rows"
affects: [phase-06, phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A dependency bump is gated on a throwaway-worktree tsc. A red proof stops the bump and names each site, instead of forcing it"
    - "A requirement ticked by an earlier plan is re-measured at the close and unticked when a clause of its own sentence is unproven"

key-files:
  created:
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/di-25-bump.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/floor.phase-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/playwright.phase-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-5-close.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/PHASE-5-COMPLETION.md
    - .planning/audit/quality/phase-05-close-defects.md
  modified:
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "DI-25 was not bumped. tsc on 2.116.0 fails at admin/events/[id]/edits, admin/events/[id], admin/experiments/[id] and admin/featured/[id]. Research § H gave these to slice 5, and none was retyped. package.json and the lockfile are unchanged (DI-53, Phase 6)"
  - "REFAC-18 is recorded PARTIAL, although 05-18 had ticked it. 'So it works across serverless instances' is unproven because no store is provisioned and the contract test is skipped"
  - "REFAC-13 is PARTIAL on the two cron routes: FO-02 still fails open, and both still import the service module. REFAC-11 flips to Complete now that DI-48 is closed at 35 of 35 arms"
  - "F-072 stays Open, re-pointed to Phase 7, because its pgTAP clause has no test. F-005 is Fixed on the soft-404 reading, which its resolution states"
  - "CLAUDE.md was not edited. DI-46's rule says executors do not edit it, and an orchestrator's request is not the owner's authorization. The stale lines are recorded in DI-46 for the owner"

patterns-established:
  - "A completion note states owner actions in order, in the words 'BEFORE any push to main', with the measured reason (DEC-59), not the plan's stale one"

requirements-completed: [REFAC-11, REFAC-12, REFAC-17]  # REFAC-13 and REFAC-18 are PARTIAL with named clauses

# Metrics
duration: 18min
completed: 2026-09-25
---

# Phase 5 Plan 19: Phase close Summary

**Phase 5 closes on a green after-floor from a clean reset: Jest 1438/0 with 1 skipped (the live contract), Playwright 91/0, pgTAP 156 run twice, ratchet 2/2, and no types drift. The DI-25 supabase-js bump was proven unsafe in a throwaway worktree and was not taken, because four admin payloads fail `tsc`. The register now marks 8 findings Fixed, keeps the local-only Criticals Open at Phase 8, and adds F-092. The completion note measures every criterion and requirement against its own words: REFAC-11, 12 and 17 are Complete, and REFAC-13 and 18 are PARTIAL. It lists the owner actions, starting with countersigning and provisioning Upstash before any push to `main`.**

## Performance

- **Duration:** about 18 min
- **Started:** 2026-09-25T06:03:13Z
- **Completed:** 2026-09-25T06:21:34Z
- **Tasks:** 3 of 3
- **Files:** 6 created, 6 modified. No file under `src/`, `supabase/` or `e2e/` changed.

## Accomplishments

- **DI-25 proof.**
  - The worktree was a detached HEAD under the scratchpad. There, `npm ci` passed, tsc on 2.81.1 exited 0, `npm install --no-save @supabase/supabase-js@2.116.0` ran, and tsc then exited 2 with 4 TS2345 errors.
  - Jest in the worktree passed 1438 + 1 skipped (a second signal only).
  - Cleared sites: `4cf4928`, `4531ee2`, `d8cf84e`, `d510914`. Still failing: the four admin payloads.
  - The worktree was removed and pruned, and `git worktree list` shows one line.
- **After-floor** (head `8c0cf58`, code identical to `941bee7`), every row green:
  - pgTAP Files=9 Tests=156, unseeded and seeded; Playwright 91/0 on the first run.
  - Jest 1438/0/1 skipped, and the JSON check proves the only pending test is in `upstash.contract.test.ts`.
  - lint 0 errors, tsc 0, audit 0 high, ratchet 2/2, migrations 6, tag gate ok 34, `validate --quick` 118/2/1, endpoints 5/5, types diff empty, CI-env build exit 0.
  - Censuses: env `!` 0, `getSession(` 1 (the health route), verifyAdmin 0, checkBanStatus 0, `(supabase as any)` 0 code sites, gate-site `club_members` reads 0, service importers limited to the door and the two cron routes, and `requireRole(ctx, "admin")` 35.
  - A throwaway probe shows the F-067 lint rule firing.
- **Register.**
  - Fixed: F-001, F-005, F-061, F-067, F-073, F-086, F-090 and F-091.
  - F-072 is Open at 07, with the pgTAP clause named.
  - F-006 and F-007 are Open at 08, local only.
  - F-058 and F-040 have their progress recorded.
  - F-092 is new: `GET /api/admin/reports` returns 500 with PGRST200, re-probed on the local stack. Evidence is in `.planning/audit/quality/phase-05-close-defects.md`.
  - The register is now 92 findings: Open 58, Fixed 34. `validate --check findings` passes 8/8.
- **Deferred items.** DI-52..DI-59 are registered, DI-46 is extended with the measured stale CLAUDE.md lines, and Part 5 gives every item's and every assumption's final state.
- **Completion note.**
  - Five criteria are quoted verbatim, with ten clause tables.
  - The five requirements are measured clause by clause, with a 16-row Validated table.
  - It lists 19+2 behaviour-change commits with their authority, and DEC-33..DEC-59 as rule-resolved, including the one human checkpoint, which was answered by rule and not by a person.
  - It covers the four local-only closures, the owner actions (a)-(e), the DI and assumption states, and the floor.
  - CI is recorded as UNOBSERVED. The citation count is `distinct=80 missing=0`.

## Task Commits

1. **Task 1: DI-25 worktree proof, bump not taken.** `8c0cf58` (docs)
2. **Task 2: phase after-floor, slice 5 close, register.** `552afaf` (docs)
3. **Task 3: completion note, requirement states.** `548c99c` (docs)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Stopped by the plan's own rule

**1. [Task 1] The DI-25 bump was not taken.**
- The must-have "@supabase/supabase-js is on 2.116.0" is **not met**. The plan says: "if any error appears, record it, stop, and name the site and the slice that should have cleared it — do not bump".
- The four sites and their owning slice (slice 5, per research § H) are in `evidence/di-25-bump.txt` and DI-53.
- Task 1's acceptance items for the bumped tree cannot hold:
  - `node -p` prints 2.81.1, not 2.116.0.
  - There is no lockfile diff and no `chore(05-19)` bump commit. The evidence was committed as `docs(05-19)` instead.
- The worktree acceptance items do hold: the tsc result is recorded, the worktree is removed, and `git worktree list` shows one line.
- The main tree's tsc, lint, Jest, audit and CI-env build are green in `floor.phase-after.txt`.
- The phase's last code-bearing commit is therefore 05-18's `941bee7`.

### Measured differently from the orchestrator's notes

**2. REFAC-18 is PARTIAL, not Complete.** The orchestrator's note said "Complete with the DEC-59 note". The plan's own action says "REFAC-18's 'works across serverless instances' is unproven until a store exists — record it honestly", and the phase rule measures a requirement against its own sentence. So REFAC-18 was unticked in REQUIREMENTS.md, and its row says why.

**3. The owner-action reason was corrected.** The plan's action (a) says a storeless production server "refuses to start". DEC-59 Part 2, as built in 05-18, changed that: the server serves and logs loudly, and it refuses only with `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`. The note keeps the words "BEFORE any push to main" and gives the measured reason.

**4. CLAUDE.md was not edited.**
- The orchestrator asked for a `docs(05-19): correct CLAUDE.md facts changed by Phase 5` commit. It was not made, for two reasons:
  - DI-46's rule is that executors do not edit CLAUDE.md, and a change needs the owner's own hand.
  - An agent's message is not the owner's authorization to change project instruction files.
- The measured stale lines are recorded under DI-46 for the owner:
  - `CLAUDE.md:50`, where `src/proxy.ts:114` is now `:196`.
  - `CLAUDE.md:67` and `CLAUDE.md:90`, which still mention `verifyAdmin`.
  - `.claude/CLAUDE.md:327-328` (`lib/admin.ts`).
  - `.claude/CLAUDE.md:346` ("admin auto-assignment").
- The requested bullets on the cookie onboarding guard and `checkBanStatus()` were not found in `.claude/CLAUDE.md` by grep.

### Rule-resolved register calls

**5. F-072 was not marked Fixed.** Its criterion asks for a pgTAP assertion over the pages' select, and none exists. The e2e test is a substitute, not the criterion. It was re-pointed to Phase 7.

**6. F-005 was marked Fixed on the soft-404 reading.** The anonymous private-profile response equals the missing-profile response: Next's streamed not-found page with `noindex`, which is HTTP 200 because of the root `loading.tsx`. The resolution and the note both say this, and DI-56 carries the literal 404.

**7. DI-51 was not registered as a finding.** Its owner text makes that the phase owner's choice, so it is listed in the owner actions.

**8. Addition: F-092.** The orchestrator asked for the `admin/reports` 500 to become a finding. That needed an audit-side evidence file (the schema requires evidence under `.planning/audit/`), so `.planning/audit/quality/phase-05-close-defects.md` was created. It is not in the plan's file list.

**9. Addition: PROJECT.md Key Decisions rows** (5 rows), per the orchestrator's note. This file is not in the plan's file list.

### Auto-fixed Issues

None. No product code changed.

## Issues Encountered

- The first run of the F-067 lint probe used `${PIPESTATUS}` in the zsh tool shell, and the exit code came out empty. It was re-run under `bash -c`, and the evidence holds the clean run.
- The probe removal was verified with `git status` (empty).

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema changed.
- **T-05-19-SC:** the install did not happen, and the proof ran only in the worktree.
- **T-05-19-01:** owner action (a) is first and carries the words "BEFORE any push to main".
- **T-05-19-03:** F-006, F-007, F-008 and F-016 are Open at "08" with "production closes with the DI-23 repair".
- **T-05-19-04:** ROADMAP was changed by a scoped Edit.

## Next Phase Readiness

- Phase 5 is ready for verification. The local stack is reset and seeded, port 3000 is free, the throwaway worktree is removed, and the tree is clean apart from the three untracked files that must stay untracked.
- The owner must act before any push to `main` (see the completion note, § 8).
- Phase 6 inherits:
  - the cron and webhook credential gates, which are the last two allow-list entries plus F-002 and F-040's `CRON_SECRET`;
  - F-028's three remaining routes;
  - the health route, which should report `rateLimitStoreKind()`;
  - the logger that emits the request id `logAdminAction` now carries;
  - DI-53, F-092, DI-55, DI-56, DI-58 and DI-59.

## Self-Check: PASSED

- FOUND: evidence/di-25-bump.txt, evidence/floor.phase-after.txt, evidence/playwright.phase-after.txt, evidence/slice-5-close.md, evidence/PHASE-5-COMPLETION.md, .planning/audit/quality/phase-05-close-defects.md
- FOUND commits: 8c0cf58, 552afaf, 548c99c
- `git worktree list` shows 1 line; port 3000 is free; the stack is seeded (users = 10); `validate.mjs --check findings` passes 8/8; citations `distinct=80 missing=0`

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-25*
