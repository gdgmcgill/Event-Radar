---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 03
subsystem: security-controls
tags: [eslint, elevated-boundary, ratchet, ci, seam-kit, service-role, di-34, di-31, di-35]

# Dependency graph
requires:
  - phase: 04-01
    provides: "DEC-24 (narrow the profile, add no ban guard), the tag gate scripts/check-characterization-tags.mjs, the before-floor"
  - phase: 03-03
    provides: "the elevated seam src/server/db/elevated/, the src/app-only boundary and the 24-entry shrink-only allow-list"
provides:
  - "An elevated census and a lint boundary that both cover src/** (exempting only src/lib/supabase/ and src/server/db/elevated/), skip type-only imports, and agree on the same 25 files"
  - "A no-restricted-syntax companion rule that fails a bare read of SUPABASE_SERVICE_ROLE_KEY (dot, bracket, destructured) and a dynamic import() of the service module"
  - "CI steps 'Elevated-callsite ratchet' and 'Characterization tag gate' in the ci job"
  - "RequestProfile / PROFILE_COLUMNS narrowed to id, roles, onboarding_completed, with a docblock that names the ban checks that actually exist"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The boundary is @typescript-eslint/no-restricted-imports with allowTypeImports per pattern group; the plugin is the one eslint-config-next already registers"
    - "The ratchet census is an import-statement census (value import/re-export of the service module or SDK, or dynamic import of the service module) that mirrors what the lint rules report"
    - "Lint-rule red fixtures can be run with ESLint#lintText at a virtual filePath, so no throwaway file touches src/"

key-files:
  created:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/boundary-widening.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/di-35-narrowing.txt
  modified:
    - scripts/check-elevated-ratchet.mjs
    - eslint.config.mjs
    - eslint.elevated-allowlist.mjs
    - src/server/db/elevated/REGISTRY.md
    - src/server/db/elevated/index.ts
    - .github/workflows/ci.yml
    - src/server/context.ts
    - src/server/__tests__/context.test.ts
    - src/server/__tests__/requireRole.test.ts

key-decisions:
  - "Branch taken: @typescript-eslint/no-restricted-imports with allowTypeImports, because eslint-config-next registers @typescript-eslint/eslint-plugin@8.47.0 for src/**/*.ts. The fallback ignores entry for the two type-only importers was not needed"
  - "The allow-list grew 24 -> 25 by exactly +src/lib/audit.ts in one regeneration; no legacy entry vanished under the stricter census"
  - "src/app/api/clubs/[id]/route.ts reaches the service module only through a dynamic import (line 202). DI-31 had said no file did this. The census counts it, and the new dynamic-import selector makes lint count it too"
  - "The companion rule adds a destructuring selector ({ SUPABASE_SERVICE_ROLE_KEY } = process.env) to the plan's two, because it is the same read spelled differently"
  - "No shrink is available in Phase 4, measured: none of the 13 Slice 1-2 handlers is on the allow-list. DI-31 closes on its companion-rule and CI-wiring clauses"
  - "REFAC-09 is NOT marked complete. This plan delivers the seam kit's control integrity; handler adoption of the seam is 04-05 (the 04-01/04-02 precedent)"

patterns-established:
  - "Sanctioned homes of the service-role credential: src/lib/supabase/ and src/server/db/elevated/. Both controls exempt exactly these two prefixes"
  - "When a later plan migrates a route to getElevatedClient(), it deletes the allow-list entry by hand-running --write and must show an entry diff that only removes"

requirements-completed: []  # REFAC-09 listed; only its control-integrity part is delivered here

# Metrics
duration: 10min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 03: Elevated Boundary Widening, CI Gates and Profile Narrowing Summary

**Both elevated-access controls (the ESLint boundary and the ratchet census) now cover all of `src/`, skip type-only imports and agree on the same 25 files. The only addition is `src/lib/audit.ts`, which already existed. A companion rule fails a bare read of the service-role key and a dynamic import of the service module. CI now runs the ratchet and the tag gate. The seam reads three profile columns instead of five, under a docblock that no longer implies a ban check.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-09-23T05:10:05Z
- **Completed:** 2026-09-23T05:19:38Z
- **Tasks:** 3 of 3
- **Files:** 2 created, 9 modified

## Accomplishments

- **DI-34 closed.** A throwaway `src/lib/probe-elevated.ts` imported by a throwaway route was caught in the RED run. Lint failed on the library file and not on the route. The ratchet exited 1 naming both the probe and `src/lib/audit.ts`. After one `--write`, the entry-level diff is exactly `+  "src/lib/audit.ts",` and the ratchet reports `committed=25 live=25 delta=0`.
- **The two controls agree, and this was measured.** With the allow-list block removed, the import rule reports 24 files and the syntax rule reports 3. Their union is 25, identical to the census, with nothing in one set that is missing from the other (evidence § 8c).
- **DI-31's evasions closed.** Each of `src/lib/probe-key.ts` and `src/lib/probe-dynamic.ts` failed lint with exactly one error. The `NEXT_PUBLIC_SUPABASE_URL` read in the key probe was not reported. 13 in-memory spellings behave as expected: dot, bracket, `process["env"]`, destructured, a non-null `!`, a `.tsx` page, a relative dynamic path and an extension dynamic path are all caught. Public env reads, the server factory, test files and both sanctioned homes are not.
- **CI wiring.** Two steps sit in the `ci` job after "Migration filename parse check". The diff adds lines only, and the workflow-level env block is untouched. **CI run UNOBSERVED** (no push in this plan).
- **DI-35 closed (DEC-24).** `PROFILE_COLUMNS = "id, roles, onboarding_completed"`. The docblock now says the seam performs no ban check. It names the proxy ring (fail-open: F-003, the outer catch, and an errored read counting as "not banned"; F-062) and `checkBanStatus()` on individual write handlers. It hands the fail-closed guard to REFAC-11 in Phase 5. The seam suites ran 46/46 both before and after.

## Task Commits

1. **Task 1: widen census and boundary to src/, absorb src/lib/audit.ts once**: `c85cf71` (feat)
2. **Task 2: companion rule for the two evasions; CI steps**: `59a4975` (feat)
3. **Task 3 RED: pin the three-column profile read**: `4ed3530` (test)
4. **Task 3 GREEN: narrow RequestProfile and PROFILE_COLUMNS**: `29c354b` (feat)

## Files Created/Modified

- `scripts/check-elevated-ratchet.mjs`: scans `src/` and exempts the two homes. The census counts static value imports, re-exports, import-equals and dynamic imports of the service module. The test-file skip block is byte-identical to before. PURPOSE, INVOCATION and the generated header were updated.
- `eslint.config.mjs`: the boundary widened to `src/**/*.ts(x)` and moved to the typescript-eslint rule with `allowTypeImports`. A new `no-restricted-syntax` block covers the key read and the dynamic import. The allow-list block turns both rules off.
- `eslint.elevated-allowlist.mjs`: 25 entries (24 legacy plus `src/lib/audit.ts`), with a regenerated header.
- `src/server/db/elevated/REGISTRY.md`: the "neither control can see" section now reads "counted by both controls since 04-03". The migration is Phase 5's (REFAC-13).
- `src/server/db/elevated/index.ts`: one docblock line, changing `src/app/**` to `src/**` (see Deviations).
- `.github/workflows/ci.yml`: 12 added lines, 0 deleted.
- `src/server/context.ts`: the narrowed type, the narrowed select and the rewritten docblock.
- `src/server/__tests__/context.test.ts`, `requireRole.test.ts`: the column assertion now lists exactly the three columns, and the fixtures drop the two ban fields. Nothing else changed.
- `evidence/boundary-widening.txt` (sections 1-9) and `evidence/di-35-narrowing.txt` (sections 1-4).

## Decisions Made

See `key-decisions` in the frontmatter. For later plans, the most important is that the ratchet and the lint rules now define "reach" identically. A future change to either needs the matching change in the other, and evidence § 8c's agreement check is the way to prove it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Acceptance] The first regeneration was discarded because its header named src/lib/audit.ts**
- **Found during:** Task 1
- **Issue:** The generated header's prose named `src/lib/audit.ts`, so `grep -c "src/lib/audit.ts" eslint.elevated-allowlist.mjs` returned 2 instead of 1. That first output had also been re-run once with `--write` as a determinism check, and the sha256 was unchanged.
- **Fix:** `git checkout -- eslint.elevated-allowlist.mjs` (sha back to `3df51af2…`). The template now refers to "the module that defines logAdminAction", and the regeneration was done again. The entry-level diff was `+src/lib/audit.ts` in every run. No discarded output was committed. The full account is in evidence § 6.
- **Commit:** `c85cf71`

**2. [Rule 2 - Coverage] A destructuring selector added to the companion rule**
- **Found during:** Task 2
- **Issue:** `const { SUPABASE_SERVICE_ROLE_KEY } = process.env` reads the same credential, and neither of the plan's two selectors sees it.
- **Fix:** Added a third selector with the same message. No file in the tree matches it, and lint stays at 0 errors.
- **Commit:** `59a4975`

**3. [Rule 1 - Accuracy] Stale scope claim in src/server/db/elevated/index.ts**
- **Found during:** Task 1
- **Issue:** Its docblock said the boundary is enforced "for everything under `src/app/**`". After the widening that is false. The file is not in the plan's `files_modified`.
- **Fix:** A one-line comment edit to `src/**`. No code changed.
- **Commit:** `c85cf71`

**4. [Rule 1 - Accuracy] The ban-check docblock is broader than DEC-24's phase-scoped wording**
- **Found during:** Task 3
- **Issue:** The plan's docblock text said `checkBanStatus()` runs "on the save and rsvp POST handlers". The census shows ten route files calling it. The plan's reading list also implied `requireClubRole` reads the profile, but it reads `club_members`. And F-003 is the environment-conditional ring, not the outer catch.
- **Fix:** The docblock now says "individual write handlers — among them save POST and rsvp POST, but not their DELETE arms". It says `requireClubRole` reads no profile column, and it attributes each fail-open path correctly.
- **Commit:** `29c354b`

**5. [Project precedent] REFAC-09 not marked complete**
- The plan lists REFAC-09. This plan delivers control integrity for the seam kit, not handler adoption, which is 04-05. This follows the 04-01 and 04-02 precedent.

### Measured, not a deviation

- `src/app/api/clubs/[id]/route.ts` reaches the service module only through a dynamic `import()` on line 202. That is the evasion DI-31 said "no file does". It is allow-listed, so nothing broke. Now both controls count it.

---

**Total deviations:** 5 (2 accuracy fixes, 1 acceptance fix, 1 coverage strengthening, 1 precedent-driven state choice).
**Impact on plan:** No scope creep. `git diff --name-only aa66a66 -- src/app src/lib` is empty. No handler changed, no rule was downgraded, no inline disable was added, `supabase/migrations/` was not touched and the local stack was not used.

## TDD Gate Compliance

Task 3 (`tdd="true"`): the RED commit `4ed3530` (`test(04-03)`) failed 1 of 46 because the select still carried the ban columns. It was followed by the GREEN commit `29c354b` (`feat(04-03)`), with 46/46 passing. No refactor commit was needed.

## Issues Encountered

- Proving that lint and census agree required linting with the allow-list block removed. That was done through the ESLint Node API, with a driver copied into the repo root for the run and then deleted, so the config's relative globs resolve. No file under `src/` was written for the variant checks (`lintText` with a virtual `filePath`).

## Next Phase Readiness

- **04-05 (Slice 1 refactor):** a handler that adopts `createRequestContext()` gets `profile: { id, roles, onboarding_completed }` and **no ban check**. The save and rsvp POST handlers must keep calling `checkBanStatus()` exactly as they do today (DEC-24; the 04-02 PRESERVE suites pin the asymmetry). A new file under `src/` that imports `@/lib/supabase/service` or `@supabase/supabase-js` as a value, dynamically imports the service module, or reads `SUPABASE_SERVICE_ROLE_KEY` now fails lint. A type-only SDK import is fine.
- **Any plan that migrates a route to `getElevatedClient()`:** delete its allow-list entry with `--write` and show an entry diff that only removes. The ratchet runs in CI.
- **Floors after this plan (unchanged from 04-02):** jest 433 passed / 5 skipped / 438 (40 passed, 1 skipped of 41 suites); lint 0 errors / 19 warnings; tsc clean; ratchet `committed=25 live=25 delta=0`; tag gate `ok 11 files`.
- **Still open:** the CI run for the two new steps is unobserved until a push. DI-32 (the red e2e job) belongs to 04-04. The workflow env block was not touched.

## Self-Check: PASSED

- All 11 files in the plan's list and key-files are on disk. None of the 4 throwaway probes remain (`src/lib/probe-*`, `src/app/api/probe-elevated`).
- Commits `c85cf71`, `59a4975`, `4ed3530` and `29c354b` are in `git log`.
- `node scripts/check-elevated-ratchet.mjs` reports `committed=25 live=25 delta=0` (exit 0). `npm run lint` reports 0 errors and 19 warnings. `npx jest --ci` gives 433/5. `npx tsc --noEmit` exits 0. `grep -c "src/lib/audit.ts" eslint.elevated-allowlist.mjs` returns 1.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Completed: 2026-09-23*
