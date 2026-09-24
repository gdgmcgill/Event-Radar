---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 08
subsystem: auth
tags: [slice-close, playwright, ban, onboarding, endpoint-contract, findings, F-003, F-004, F-027, F-028, F-062, F-077, F-088, F-089, REFAC-11]
status: complete

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-04 guards and validated config; 05-05 fail-closed proxy and callback; 05-06/05-07 the handler ring on all 39 non-admin write arms"
provides:
  - "End-to-end proof of the ban, onboarding and no-profile-row rings against a production build and the seeded local stack (13 new Playwright tests)"
  - "endpoints.json agrees with slice 3: the four F-028 rows answer anonymous 401, and write-only rows answer mid_onboarding_student 403, derived by rule (R4)"
  - "The slice-3 floor from a clean reset: Jest 1013/0, Playwright 53/0, pgTAP 86/86, ratchet live=24, env and legacy-ban censuses 0"
  - "Seven slice-3 findings Fixed with validation evidence; F-028 re-pointed to 06; DI-44..DI-48 registered"
  - "REFAC-11 measured clause by clause: PARTIAL, one clause named (DI-48)"
affects: [05-09, 05-12, 05-13, phase-06, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A spec that needs a persona the seed cannot express creates and deletes its own local auth user with localStackEnv() and proves cleanup"
    - "Close-out findings edits are surgical string replacements in findings.json, then gen-foundation-audit.mjs and validate.mjs --check findings"

key-files:
  created:
    - e2e/specs/ban-and-onboarding-ring.spec.ts
    - e2e/specs/no-profile-row.spec.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/contract-regen-slice-3.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/playwright.slice-3-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/floor.slice-3-after.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-close.md
  modified:
    - .planning/audit/tools/classify-inventory.mjs
    - .planning/audit/inventory/classification-rules.md
    - .planning/audit/inventory/endpoints.json
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md

key-decisions:
  - "REFAC-11 is recorded PARTIAL, not Complete. 'Middleware is advisory-only' holds for every non-admin arm, but a banned user who holds admin is refused on /api/admin/* only by the proxy, because verifyAdmin() and requireRole read roles only (DI-48, owner slice 5)"
  - "F-077 is Fixed although its hostile cases live in route-defect.test.ts rather than the route.test.ts the criterion names. Tags are file-level, so a moved DEFECT pin cannot sit in a PRESERVE file. The resolution states this difference"
  - "The 05-03 feedback-impersonation candidate is registered as DI-44, not as a finding. The handler path is closed (05-06), and the anon-role RLS half has not been measured"
  - "The F-027 404 pin that the previous executor left uncommitted is kept and committed on its own. It proves the one F-027 clause a grep cannot"

patterns-established:
  - "Slice close: clean-reset floor, full Playwright appended to the slice's Playwright evidence, a 16-row Validated table, findings flipped only on a met criterion, the requirement measured against its own sentence"

requirements-completed: []

# Metrics
duration: "Tasks 1-2 by the previous executor (time not recorded; it stalled and was killed); Tasks 3 and the resume took 11 min on 2026-09-24"
completed: 2026-09-24
---

# Phase 5 Plan 08: Slice 3 close Summary

**Slice 3 closes on a green clean-reset floor: 53/0 Playwright, including 13 new ring tests; Jest 1013/0; pgTAP 86/86; a contract that agrees with the code; seven findings Fixed on met criteria; and REFAC-11 recorded PARTIAL on one named clause (the admin arms' ban, DI-48).**

## Performance

- **Duration:** Tasks 1 and 2 were done by the previous executor, whose time was not recorded. This continuation took about 11 min (20:03–20:14 UTC).
- **Completed:** 2026-09-24
- **Tasks:** 3 of 3
- **Files:** 2 specs created, 4 evidence files created, 7 planning/audit files modified. No `src/` file changed.

## Accomplishments

- **The rings, end to end** (Task 1, plus the F-027 pin). Against `next build && next start` and the seeded local stack:
  - banned: a JSON 403 `Account suspended` on an API write and an API read, and the page lands on `/banned`
  - suspended-active: the same 403
  - suspension-expired: reads 200
  - mid-onboarding: redirected to `/onboarding` even with the cookie deleted, gets 403 `Onboarding required` on a direct write, and both wizard calls still return 200
  - a no-profile-row account, which the spec creates and deletes itself: 403 `Profile not found` on the API, and signed out to `/?error=profile_sync_failed` on a page
  - `/api/auth-debug`: 404
- **Contract** (Task 2). `classify-inventory.mjs` VERDICTS and R4 were changed, and `classification-rules.md` updated in the same commit. The changed `expected_status` rows are exactly the allowed set (`contract-regen-slice-3.txt`), and `validate.mjs --check endpoints` exits 0.
- **Floor** (Task 3, `floor.slice-3-after.txt`, `head=6b9a721…`). Every row is at or above `floor.before.txt`:
  - Playwright 40 → 53, first run
  - Jest 744 → 1013
  - tag gate 18 → 27
  - env census 15 → 0, legacy-ban census 14 → 0
  - ratchet live=24, pgTAP 86 on both runs
  - lint, tsc and audit unchanged
- **Close note** (`slice-3-close.md`). It has the floor and Playwright tables and 16 Validated rows, each naming its re-confirming test or the diff that shows it untouched. It also covers the findings, eight INTENTIONAL BEHAVIOUR CHANGE commits, how "no visual change" was established, and REFAC-11 clause by clause.
- **Register.**
  - F-003, F-004, F-027, F-062, F-077, F-088 and F-089 are Fixed, each with a resolution citing commits and evidence.
  - F-028 stays Open, re-pointed to `"06"`.
  - F-040 gets a progress resolution.
  - `FOUNDATION_AUDIT.md` was regenerated, and `validate.mjs --check findings` exits 0.
- **Deferred items.** DI-44..DI-47 come from the 05-02..05-07 SUMMARYs, and DI-48 from this plan's REFAC-11 measurement. The next id is DI-49.

## Task Commits

1. **Task 1: Playwright specs for the ban, onboarding and no-profile-row rings.** `80f9533` (test). Previous executor.
2. **Task 2: endpoint contract agrees with slice 3.** `7bccf15` (docs). Previous executor.
3. **Resolution of the uncommitted spec edit: pin the deleted auth-debug route answers 404 (F-027).** `6b9a721` (test). This executor.
4. **Task 3: slice 3 close (floor, re-confirmation, register).** `3aabaff` (docs). This executor.

**Plan metadata:** the final docs commit, which covers this SUMMARY, STATE and ROADMAP.

## Floor after this plan

| Gate | Before (floor.before.txt) | After (floor.slice-3-after.txt) |
|---|---|---|
| `npx jest --ci` | 744 passed, 50 suites | 1013 passed, 0 failed, 63 suites |
| `npx playwright test` (clean reset) | 40 passed | 53 passed, 0 failed, first run |
| pgTAP unseeded / seeded | 86 / 86 | 86 / 86 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm audit --audit-level=high --omit=dev` | 0 high, 2 moderate | 0 high, 2 moderate |
| ratchet | committed=25 live=25 | committed=25 live=24 |
| tag gate | ok 18 | ok 27 |
| `validate.mjs --quick` | 118 / 2 by-design FAIL / 1 SKIP | the same |
| env `!` census / legacy ban census | 15 / 14 | 0 / 0 |

## Decisions Made

- **REFAC-11 is PARTIAL.** Measured against its own sentence, four clauses are met. "Middleware is advisory-only" is met for every non-admin arm, but not for the ban decision on admin arms. `verifyAdmin()` and `requireRole` read only `roles`, so a banned user who holds admin is stopped only by the proxy's fail-closed ban read. The checkbox stays unticked. The traceability row names the clause, and DI-48 routes it to slice 5 (05-12/05-13) or to an owner decision.
- **F-077 Fixed, with the location difference stated.** The resolution explains why the hostile cases live in the DEFECT sibling file. The anti-regression clause (test 6) is met in the file the criterion names.
- **F-003 Fixed.** "Asserts it throws" is met by the rows that assert the logged `MissingEnvError` and the fail-closed 500 (DEC-36). The unset variable makes the client construction throw, and the proxy catches the error rather than crashing the request.
- **DI-44, not a new finding,** for the feedback impersonation candidate. The handler path is closed, and the database half is unmeasured.

## Deviations from Plan

### Process deviation

**1. The previous executor stalled after Task 2, and this continuation resumed from Task 3.**
- Tasks 1 and 2 were committed (`80f9533`, `7bccf15`) and verified present with `git log`. They were not redone.
- The previous executor then added an F-027 describe block to `ban-and-onboarding-ring.spec.ts`: anonymous `GET /api/auth-debug` must return 404 in the production build. It never ran or committed the block, then produced no output for ten minutes and was killed.
- Resolution: the block was reviewed, kept and committed on its own as `6b9a721`. It passed in Task 3's full run (test 28), so no assertion needed changing, and no other test was touched.
- Effect on counts: Task 3's Playwright total is 53 (40 + 13) rather than 52, and the floor's `head=` is `6b9a721`.

### Previous executor's Task 2 deviations (recorded in `evidence/contract-regen-slice-3.txt`)

**2. [Rule 3 - Blocking] classify-inventory.mjs died with ENOENT on the deleted auth-debug handler.** A row whose handler file is gone is now retained byte-for-byte and reported, as DEC-55 requires.

**3. [Rule 1 - Bug] Rule V1 matched only an inline `status: 400`.** Without a fix, `api.events.id.rsvp` would have drifted `input_validation` from manual to none. The regex now also matches `badRequest(`, and that row is unchanged.

**4. R4 refined with an `/api/` clause.** Without it, `auth.signout` (POST only) would have been classified 403. `/auth/signout` has no onboarding guard, and the proxy exempts `/auth/`.

### Task 3 notes

**5. Block 20 was re-run under bash.** The Bash tool's shell is zsh, which has no `PIPESTATUS`, so the first final reset-and-seed printed empty exit codes. It was re-run under `bash -c`: reset exit 0, seed exit 0. Only the bash run is recorded. Both runs reset the local stack, and neither targeted anything else.

**6. CLAUDE.md was not edited.** The stale `PROTECTED_ROUTES` line reference (114 → 188) is registered as DI-46 for the owner. Executors do not change CLAUDE.md.

## Deferred items found

Registered in `evidence/deferred-items.md` Part 4:
- **DI-44:** the `recommendations/feedback` dead body-`user_id` fallback, and whether the anon role can write a foreign `user_id` (not yet probed)
- **DI-45:** auth-failure log lines removed by the context adoption (`user/engagement` POST)
- **DI-46:** the stale CLAUDE.md `PROTECTED_ROUTES` line reference
- **DI-47:** the unreachable `inferred-tags` 404 and stale PRESERVE prose
- **DI-48:** on the admin surface, the ban is still proxy-only (the reason REFAC-11 is PARTIAL)

## Known Stubs

None. Only specs, evidence and register files were changed.

## Threat Flags

None. No new endpoint, auth path or schema. Threat register:
- **T-05-08-01:** the temporary auth user was deleted in `afterAll`. A query proved 0 rows in Task 1, and the stack has since been reset twice.
- **T-05-08-02:** the evidence files were grepped for JWT-, `sb_secret_`- and `sb_publishable_`-shaped strings, with no matches. Reset and seed output was filtered.
- **T-05-08-03:** only the local stack (127.0.0.1:54321) was used, and no `--linked` flag.
- **T-05-08-04:** a finding was flipped only on a met criterion. F-028 and F-040 stay Open, each with the unmet clause named.
- **T-05-08-05:** `endpoints.json` was written only by the generator, and the changed-row set was proven equal to the allowed set.

## Issues Encountered

None beyond the deviations above. Playwright passed on the first run, so no flake re-run was needed.

## Next Phase Readiness

- The slice-3 floor is green, so **slice 4 (05-09) may start.**
- **05-12/05-13** should pick up DI-48: compose `requireActiveUser` before the admin role check, pin it, and then flip REFAC-11.
- The stack is left reset and seeded, and port 3000 is free.

## Self-Check: PASSED

- FOUND: e2e/specs/ban-and-onboarding-ring.spec.ts, e2e/specs/no-profile-row.spec.ts, evidence/contract-regen-slice-3.txt, evidence/playwright.slice-3-after.txt, evidence/floor.slice-3-after.txt, evidence/slice-3-close.md, evidence/deferred-items.md
- FOUND commits: 80f9533, 7bccf15, 6b9a721, 3aabaff
