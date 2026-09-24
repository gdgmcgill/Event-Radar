---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 01
subsystem: testing
tags: [playwright, findings-register, decisions, pgtap, rls, supabase]

# Dependency graph
requires:
  - phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
    provides: DI-36 and DI-38 carried to Phase 5, the Phase 4 register/ledger/decision formats, the 744-test Jest floor
provides:
  - DI-38 harness race fixed and proven 10/10 (save-and-rsvp.spec.ts re-reads through page.request)
  - Phase 5 before-floor on 4a9e272, with six censuses Phase 5 drives down
  - Findings F-086..F-091 registered (evidence in .planning/audit/quality/phase-05-slice-defects.md)
  - C16 re-pointing, 41 findings moved to 06/07/08; 22 findings are Phase 5's
  - Decisions DEC-33..DEC-57; deferred register with DI-41..DI-43; defect ledger skeleton
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12, 05-13, 05-14, 05-15, 05-16, 05-17, 05-18, 05-19, phase-06, phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Surgical findings.json edits: tail insertion plus single-line closes_in_phase edits, proven by numstat (191/41)"
    - "Evidence blocks as command line, verbatim output tail, exit=<code>, run under bash so PIPESTATUS is real"

key-files:
  created:
    - .planning/audit/quality/phase-05-slice-defects.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/di-38-fix.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/floor.before.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/findings-registration.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/phase-05-decisions.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md
  modified:
    - e2e/specs/save-and-rsvp.spec.ts
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md

key-decisions:
  - "DEC-33..DEC-57 recorded as rule-resolved defaults (no phase owner present); each is overridable by a signed paragraph before its executing plan runs"
  - "DEC-51: the Upstash pins go through a BLOCKING package-legitimacy checkpoint in 05-18, overriding CONTEXT's rule-resolved 'not blocking'"
  - "C16 re-pointing applied exactly per the plan's map; F-060 and F-068 (null, not in the map) left null rather than re-pointed by guess"
  - "requirements-completed left empty: this plan registers, measures and decides; it delivers no clause of REFAC-11/12/13/17/18 (04-01 and 01-01 precedent)"

patterns-established:
  - "Phase 5 DEFECT suites cite F-086..F-091; the tag gate accepts them because they are registered first"
  - "Pins moved out of PRESERVE files get a ledger row marked 'moved out of PRESERVE'"

requirements-completed: []  # plan lists REFAC-11, REFAC-12, REFAC-13, REFAC-17, REFAC-18; none is delivered here, deliberately not marked (see Deviations 2)

# Metrics
duration: 14min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 01: Register, Measure, Decide Summary

**DI-38's reload race is fixed (10 of 10 repeats pass). The before-floor was measured on that commit: Jest 744/0, pgTAP 86, Playwright 40/0. F-086..F-091 are registered, with local-stack RLS probes behind F-087 and F-091. The register is re-pointed so 22 findings are Phase 5's. DEC-33..DEC-57 are written down before any plan executes them.**

## Performance

- **Duration:** ~14 min wall clock between STATE's start mark and the last task commit. That excludes the background build and test runs overlapping the writing.
- **Started:** 2026-09-24T04:22Z
- **Completed:** 2026-09-24T04:36Z
- **Tasks:** 3 of 3
- **Files modified:** 10 (1 spec, 2 register files, 7 evidence documents)

## Accomplishments

- **DI-38 closed by measurement.** In the saves-an-event test only, the `Promise.all([waitForResponse, reload])` pair is replaced by `await page.reload()` and then `page.request.get("/api/users/saved-events")`. Result: `--repeat-each=10` gave **10 passed, 0 failed**. Phase 4 measured 5 of 10 failing.
- **Before-floor on 4a9e272** (the DI-38 commit), 26 exit-coded blocks:
  - Jest 744 passed / 0 skipped / 50 suites; lint 0 errors / 19 warnings; tsc 0; audit 0 high.
  - Ratchet 25/25; migration filenames 4; tag gate ok 18; validate --quick 118/2/1 (the same two by-design FAILs).
  - pgTAP Files=6 Tests=86, both UNSEEDED and SEEDED.
  - Playwright **40 passed / 0 failed in a single run**.
  - Six censuses: env `!` 15, `getSession(` 1, admin-verify callsites 33, legacy ban-helper callsites 10, `club_members` reads 42, `(supabase as any)` 1 code site.
  - Every value equals the research value (delta 0). The stack was left reset and seeded, and port 3000 is free.
- **Six findings registered**, all Open and `"05"`:
  - F-086 Low: pending edits never reach their creator.
  - F-087 Medium: owner club writes are denied by RLS. PATCH 500, DELETE false success plus a false audit row, role change 500. Re-probed: three `UPDATE 0` as `club_owner`.
  - F-088 Medium: the auth ring fails open on its own errors. 30 of 40 write arms have no ban check.
  - F-089 Low: the onboarding guard is a deletable cookie.
  - F-090 Low: no Origin or Sec-Fetch-Site check anywhere, and two state-changing GETs exist.
  - F-091 Medium: admin role change. Re-probed: `UPDATE 0` on another user, `UPDATE 1` on self; the route strips admin and writes no audit row.
- **C16 re-pointing, single-field edits only:** 18 findings to 06, 14 to 07, 9 to 08. numstat is 191 insertions / 41 deletions (the 41 re-pointed lines and 0 tail lines). FOUNDATION_AUDIT.md was regenerated, and `validate.mjs --check findings` passes 8/0 at 91 findings.
- **Decision record DEC-33..DEC-57** (25 sections, each with Decision, Evidence, Alternative rejected and Executed by). **Deferred register** disposes every inherited item and A1-A6, and adds DI-41, DI-42 and DI-43; next id is DI-44. The **defect ledger** has its header, the five-step protocol and an empty table.

## Task Commits

1. **Task 1: DI-38 fix, then the before-floor.** `4a9e272` (test: DI-38 fix + `di-38-fix.txt`) and `73a046a` (docs: `floor.before.txt`)
2. **Task 2: register F-086..F-091, re-point, regenerate.** `b0c6f05` (docs)
3. **Task 3: DEC-33..DEC-57, deferred register, defect ledger.** `dd0a19a` (docs)

**Plan metadata:** the final docs commit (SUMMARY, STATE, ROADMAP)

## Files Created/Modified

- `e2e/specs/save-and-rsvp.spec.ts`: the DI-38 fix, inside one test only
- `.planning/audit/findings.json`: six records appended; 41 `closes_in_phase` lines edited
- `.planning/audit/FOUNDATION_AUDIT.md`: regenerated (91 findings)
- `.planning/audit/quality/phase-05-slice-defects.md`: evidence for F-086..F-091, re-run on the base commit
- `evidence/di-38-fix.txt`, `evidence/floor.before.txt`, `evidence/findings-registration.txt`: verbatim measurements
- `evidence/phase-05-decisions.md`, `evidence/deferred-items.md`, `evidence/defect-ledger.md`: the Phase 5 registers

## Decisions the phase owner may override

Each override is a signed paragraph appended under the decision in `evidence/phase-05-decisions.md` before the executing plan runs. That plan then stops before changing a file.

- **DEC-34 (write-guard contract, 05-06/05-07):** an override could keep banned users able to un-save and cancel RSVPs (the Phase 4 asymmetry), or narrow the onboarding exemptions. That would leave part of F-088/F-089 open.
- **DEC-41 (owner club writes through the door, 05-10):** an override choosing an owner UPDATE policy instead would keep club edit, delete and role change broken in production until the Phase 8 migration repair.
- **DEC-45 (admin role changes, 05-14):** an override could keep the admin strip, or allow self role changes. The first would leave no path to grant admin once F-004 removes the callback grant.
- **DEC-47 (F-006/F-007 migration, 05-16):** an override could choose to grant `saved_events_count` instead of making the counter trigger `SECURITY DEFINER`, which lets users set their own counter. It could also keep `users` INSERT open to authenticated.
- **DEC-50 (rate limiter, 05-17/05-18):** an override could change the admin budgets (600 GET / 120 mutations per minute), fail closed on an Upstash timeout, or drop the production boot requirement. Each changes availability against enforcement strength.
- **DEC-51 (blocking Upstash checkpoint, 05-18):** an override could pick the older fallback pins (ratelimit 2.0.8). It cannot remove the checkpoint, because package-legitimacy gates are never auto-approved.
- **DEC-52 (CSRF origin check, 05-17):** an override could convert `/invites/[token]` acceptance to a POST behind the check (closing DI-41), or drop the check and rely on SameSite=Lax alone. The second would leave F-090 open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Block 20's exit codes were empty on the first attempt**
- **Found during:** Task 1, the final reset and seed appended to the floor body
- **Issue:** The block ran in the tool's zsh shell, where `${PIPESTATUS[0]}` is empty, so `exit=` had no value.
- **Fix:** Removed the block and re-ran it under `bash -c`. It printed `exit=0` for both commands. No exit code in any committed evidence was written by hand.
- **Files modified:** `evidence/floor.before.txt` (before its commit)
- **Commit:** `73a046a`

### Rule-resolved choices

**2. `requirements-completed: []` and no `requirements.mark-complete` call.** The plan's frontmatter lists REFAC-11/12/13/17/18. This plan delivers no clause of any of them: it registers, measures and decides. This follows the 04-01 and 01-01 precedent, so the requirement states stay as they were.

**3. F-060 and F-068 stay `null`.** The plan's before list covers "05" or null. Both records are null, and neither appears in the plan's re-pointing map. The stop rule applies only to "05" records, and every "05" record matched exactly one set. So the two were recorded in `evidence/findings-registration.txt` for the Phase 6 planner rather than re-pointed by guess.

**4. The DI-38 evidence keeps the Playwright summary lines, not every per-test line.** `| tail -40` of the targeted runs was dominated by the production server's F-081 log lines. The summary lines (`13 passed`, `10 passed`) and the exit codes are the measurement, and the file says so. The full floor run (block 13) filters `[WebServer]` lines and keeps all 40 test lines.

**5. The spec's file-level docblock was not edited.** Its Phase 4 note still says the test "waits for GET /api/users/saved-events". The plan says to change no line outside the saves-an-event test. The in-test comment was updated, and it names DI-38.

## Known Stubs

None. No UI or source file was changed apart from the one e2e test.

## Threat Flags

None. No network endpoint, auth path or schema changed. All probes ran against the local stack inside rolled-back transactions. A key-shaped-string scan of every evidence file printed nothing.

## Issues Encountered

None beyond Deviation 1.

## Next Phase Readiness

- 05-02 and 05-03 can cite F-086..F-091 (the tag gate accepts registered ids) and compare against `evidence/floor.before.txt`.
- The stack is reset and seeded, and port 3000 is free.
- DI-42 (provision Upstash before any push to `main`) is an owner action that blocks deploy, not execution.

## Self-Check: PASSED

- FOUND: every created file listed in key-files (7 created, 3 modified)
- FOUND: commits 4a9e272, 73a046a, b0c6f05, dd0a19a
- `validate.mjs --check findings` 8/0 at 91; tag gate ok 18; `git diff --name-only 27adf51 HEAD -- src/ supabase/` is empty

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
