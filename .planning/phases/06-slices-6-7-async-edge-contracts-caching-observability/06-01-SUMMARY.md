---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 01
subsystem: audit-registers
status: complete
tags: [floor, findings, decisions, deferred-register, package-legitimacy, zod, sentry]
requires: []
provides:
  - "Phase 6 before-floor on f186621 (Jest 1651+1 skipped, pgTAP 11/200, Playwright 97/0, ratchet 2/2, tag gate ok 34) and censuses C1-C9"
  - "F-093 and F-094 registered (94 findings); F-084 -> 07, F-078/F-038/F-041 -> 08"
  - "zod@4.6.5 and @sentry/nextjs@10.75.3 legitimacy bundles with INTEGRITY lines"
  - "DEC-60..DEC-81; the Phase 6 deferred register (DI-60 vacant, DI-61..DI-77 disposed, DI-78..DI-81 new, next DI-82); the defect-ledger skeleton"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09, 06-10, 06-11, 06-12, 06-13, 06-14, 06-15, 06-16, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "register, measure, decide before any Phase 6 code change"
    - "surgical findings.json edits (single-line re-points, array-tail insertion) + regenerated FOUNDATION_AUDIT.md"
    - "legitimacy bundle ending in a greppable INTEGRITY line the install task compares against"
key-files:
  created:
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/floor.before.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/findings-registration.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/zod-legitimacy.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/sentry-legitimacy.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/phase-06-decisions.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/deferred-items.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
    - .planning/audit/quality/phase-06-slice-defects.md
  modified:
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
decisions:
  - "DEC-60: zod pinned exactly at 4.6.5, installed in 06-03 only if the live integrity equals the bundle's INTEGRITY line"
  - "DEC-61: @sentry/nextjs pinned exactly at 10.75.3 (not 11.0.0), installed in 06-16 with SENTRYCLI_SKIP_DOWNLOAD=1, CI sets it at workflow level"
  - "DEC-63: the two cron routes are deleted with the ESLint override block; F-002/F-037 close by deletion"
  - "DEC-70: one fix-forward migration 20260926120000_async_edge_definer_hardening.sql, including the F-093 filters"
  - "DEC-73: withRoute + CACHE_CLASSES (private, public-60-300, public-30-60, public-60-120); vercel.json loses headers"
  - "DEC-81: no blocking checkpoint in the phase; owner human-checks carried as DI-81"
metrics:
  duration: "14 min"
  completed: "2026-09-25"
  tasks: 3
  files: 10
---

# Phase 6 Plan 01: Register, measure, decide Summary

This plan wrote the measured before-floor on f186621 (Playwright is 97, not 91). It registered F-093 (the reminder function reminds users about deleted and pending events; reproduced 24h: 3, correct 1) and F-094 (no input schema), and re-pointed four findings Phase 6 does not own. It also recorded integrity-matched legitimacy bundles for zod@4.6.5 and @sentry/nextjs@10.75.3, 22 rule-resolved decisions DEC-60..DEC-81, a deferred register that places every carried item and every fixer proposal, and an empty defect ledger.

## What was done

**Task 1: before-floor** (`b457f48`). One script ran every block on f186621, and each block records its own exit code (32 of them). Measured: Jest 1651 passed, 1 skipped (only `src/server/ratelimit/upstash.contract.test.ts`), 88 suites. Lint had 0 errors and 18 warnings, tsc exited 0, and audit found 0 high and 2 moderate. Ratchet committed=2 live=2, migrations 8, tag gate ok 34. validate --quick gave 118/2/1 with the two by-design snapshot FAILs. pgTAP was Files=11 Tests=200 both UNSEEDED and SEEDED. Playwright passed **97, 0 failed**, on the first run. The nine censuses: C1 160 console lines in 56 files; C2 21 raw JSON parses in 20 files; C3 5 formData; C4 59 query reads in 19 files; C5 15 readJsonObject; C6 1 getSession (health:160); C7 40 `.message` hits, which are 33 response-body sites in 19 files, 1 redirect-query site and 6 non-response lines; C8 4 route files plus vercel.json's blanket `/api/(.*)` rule; C9 0 zod importers and zod@4.1.13 transitive in the dev tree. Port 3000 was free before, during and after the run.

**Task 2: register and bundles** (`c4daccb`). `.planning/audit/quality/phase-06-slice-defects.md` holds F-093's rolled-back reproduction verbatim (three saved events, all three reminded) and F-094's three cited shapes (invites:86 JSON 500, appeal:26 HTML 500, clubs POST vs PATCH link rules). Two records were appended after F-092. Four `closes_in_phase` values changed by single-line edits (numstat 70/4, where the four deletions are exactly the re-pointed lines). FOUNDATION_AUDIT.md was regenerated, and validate --check findings passes 8/8 at 94 findings. The records at "06" are exactly the expected 21, and the tag gate is still ok 34. For both bundles the `npm pack` tarball sha512 equals `dist.integrity`, and `git status` on package.json and the lockfile is empty.

**Task 3: decisions, deferred register, ledger** (`bd97ea7`). The decision file holds 22 `## DEC-` sections (DEC-60..DEC-81), each with Decision, Evidence, Alternative rejected and Executed by. The deferred register has 22 `## DI-6x/7x/8x` sections (DI-60 vacant, DI-61..DI-77 disposed, DI-78..DI-81 new) and ends at `Next new item id: DI-82`. The ledger has its header, the five-step protocol, the Phase 6 citation rules (F-094 for 400 moves, F-058 for console and uncaught-throw moves, F-059 for error text) and an empty table.

After the tasks: `supabase db reset --local` and the seed ran, the residue check shows saved_events=0 with everything else at the seed's counts, and port 3000 is free.

## Decisions the phase owner may override

To override one, append a signed paragraph under the decision's section in `evidence/phase-06-decisions.md` before its executing plan runs.
- **DEC-60 (zod 4.6.5):** an override could require a >30-day version (4.4.3) or a blocking countersignature before 06-03 installs.
- **DEC-61 (@sentry/nextjs 10.75.3):** an override could choose v11 with an explicit all-false `dataCollection`, or an older v10 that clears the 30-day rule, before 06-16 installs.
- **DEC-64 (webhook):** an override could add a signed-timestamp window now (DI-78) or keep the 500 on a wrong-length signature, which changes 06-03's handler and its tests.
- **DEC-65 (contract boundary):** an override could emit `field` on every 400, or keep today's 500 on a malformed body, which changes every DEFECT move 06-04 and 06-08..06-10 make.
- **DEC-66 (UUIDs and club links):** an override could make POST as strict as PATCH instead of prefixing `https://`, or leave UUID comparison as it is.
- **DEC-69 (F-028 remainder, F-092):** an override could make the rsvp GET and club events answer anonymous callers 401, or keep notifications/count at 200.
- **DEC-70 (migration):** an override could defer F-093's filters (re-point it) or schema-qualify the compute function's body, which changes 06-05's migration and pgTAP pins.
- **DEC-73 (wrapper and cache classes):** an override could change the public set or collapse the three public classes to one value, which changes 06-12..06-15 and the bytes of three public routes.
- **DEC-78 (health):** an override could keep a richer anonymous response, drop HEALTH_TOKEN, or move `/health` under `/admin` instead of gating it in place.
- **DEC-79 (admin page gate):** an override could record the page-layer exception instead of reading the ban in layouts, or leave `/docs` public.

## Deviations from Plan

### Measured values that differ from the plan's expectations (recorded, not rounded away)

**1. Playwright floor is 97, not 91.**
- **Found during:** Task 1.
- **Issue:** the orchestrator's floor line says Playwright 91/91. The measured count on f186621 is 97 passed, 0 failed.
- **Cause:** `e2e/specs/event-moderation-notifications.spec.ts` (6 tests) was added by review-fix commit 86fd2a2 (iter3 WR-07), after 8c0cf58, the commit the Phase 5 after-floor measured. 97 = 10 setup + 87 spec tests.
- **Resolution:** 97 is the floor for every later plan (floor.before.txt row 15).

**2. Census deltas against research.**
- **C2:** 20 files, not 19. Research's own list names 20 (rsvp carries two sites).
- **C4:** 59 reads, as research says, but in 19 files, not 29. The per-file counts are in NOTES.
- **C7:** the plan's regex gives 40 hits. By reading each line, 33 are response-body sites in the same 19 files as research's 32 (happening-now:51 adds one), 1 puts the text in a redirect query (auth/callback:129) and 6 are not response text.
- **C8:** 4 files, not 3. recommendations/route.ts sets `private, no-store` itself.
- **C1:** 56 files, not about 55.
- All are stated in floor.before.txt's delta column.

**3. [Rule 1 - Accuracy] F-094's affected_paths list 20 raw-parse files, not "the 19 files".**
- **Found during:** Task 2.
- **Issue:** the plan's count came from research's arithmetic slip (deviation 2).
- **Fix:** the record lists the 20 measured files with line numbers.
- **Commit:** c4daccb.

**4. [Rule 2 - Missing critical information] The Sentry bundle records a transitive chain research did not.**
- **Found during:** Task 2.
- **Issue:** `@sentry/webpack-plugin@^5.3.0` now resolves to 5.4.0 (2026-07-10). That version depends on `@sentry/bundler-plugins@^10.64.0`, and `@sentry/bundler-plugins@10.75.3` depends on `@sentry/cli@^2.58.6`.
- **What holds:** both chains still end at `@sentry/cli@2.58.6` and its postinstall. The unscoped `sentry` package is pulled in only by bundler-plugins 11.x.
- **Fix:** the bundle records the chain, so 06-16 knows which resolution to verify in the lockfile.
- **Commit:** c4daccb.

**5. zod's weekly downloads measured 274 M, where research recorded 216 M.**
- DEC-60 cites the measured figure and names research's.

**6. The DEC numbering check needed three extra exclusions.**
- The plan's grep would return DEC-72, because this plan's own Task 2 evidence cites DEC-65, DEC-66 and DEC-72.
- With FOUNDATION_AUDIT.md, findings.json and phase-06-slice-defects.md excluded it returns DEC-59, as expected. The command is recorded in the decision file's header.

**7. Floor block 17 (residue) added.**
- Measured rather than asserted: saved_events=1 after Playwright, which is save-and-rsvp's own row, as at the Phase 5 close.
- The plan's final reset and seed returned it to 0.

**8. The requirements REFAC-14..23 were not marked complete.**
- The state protocol's `requirements.mark-complete`, fed the plan's `requirements:` list, ticked all eight Phase 6 requirements in REQUIREMENTS.md.
- This plan delivers none of them: it only registers and measures, and 17 plans remain.
- The change was reverted (`git checkout -- .planning/REQUIREMENTS.md`) before the metadata commit. The requirements stay Pending until the plans that deliver them close (06-06 and 06-18).

**Total deviations:** 2 auto-fixed (Rules 1 and 2), 5 measured differences recorded as deltas, and 1 state-tool correction. **Impact:** the floor, the register and the decisions describe the tree as it measures. No code, package or schema changed.

## Authentication Gates

None.

## Known Stubs

None. This plan changes documentation and registers only.

## Threat Flags

None. No new network endpoint, auth path or schema change. The only probe was a read-and-rollback on the local stack. No key reached an evidence file: a grep for key-shaped strings over the plan's evidence printed nothing.

## Verification

- `node .planning/audit/tools/validate.mjs --check findings`: 8 passed, 0 failed, at 94 findings.
- `node scripts/check-characterization-tags.mjs --all`: ok 34 files.
- `evidence/floor.before.txt`:
  - line 1 is `base=f1866218084d96b6e77b7308896c2afc919e7c21`;
  - 32 `exit=` lines;
  - UNSEEDED and SEEDED both present;
  - Playwright 0 failed.
- `git diff --name-only f186621 HEAD -- src/ supabase/ e2e/ package.json package-lock.json` prints nothing.
- Local stack: reset and seeded, and port 3000 is free (lsof exit 1).

## Self-Check: PASSED

- All 10 created or modified files exist (FOUND).
- Commits b457f48, c4daccb and bd97ea7 are in `git log`.
- No task commit deletes a file.
