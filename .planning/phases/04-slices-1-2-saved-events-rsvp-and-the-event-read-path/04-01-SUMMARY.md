---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 01
subsystem: testing
tags: [audit-register, characterization, pgtap, playwright, supabase-js, postgrest, decisions]

# Dependency graph
requires:
  - phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
    provides: "the finding register and its validator/generator, the deterministic seed, the pgTAP suite, the 27-test Playwright harness, the DI- register ending at DI-35, the DEC- sequence ending at DEC-22"
provides:
  - "a before-floor measured on base 794556a, with pgTAP split into UNSEEDED and SEEDED runs and Playwright measured rather than cited"
  - "F-079..F-085 registered with anchored evidence; F-050 owned by Phase 4; 85 findings, validate --check findings 8/8"
  - "scripts/check-characterization-tags.mjs, the PRESERVE/DEFECT tag gate (ok 5 files on this tree; red on unknown id, missing id, untagged, missing path)"
  - "DEC-23..DEC-32, the Phase 4 decision record, including DEC-32's written rule exempting F-082 from the owner checkpoint"
  - "DI-25's blocking sites enumerated (research A5 closed); the Phase 4 deferred register with every inherited DI and A1..A8 owned"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "characterization suites declare PRESERVE or DEFECT in their leading docblock; a machine gate rejects untagged suites and citations to ids the register does not hold"
    - "per-assertion pgTAP probe (install pgTAP, psql the file, drop pgTAP) wherever SKIP versus executed matters, because supabase test db counts a SKIP as a test"
    - "dependency blast radius measured in a detached throwaway worktree outside the repository, removed afterwards"

key-files:
  created:
    - scripts/check-characterization-tags.mjs
    - .planning/audit/quality/phase-04-slice-defects.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/floor.before.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/findings-registration.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/phase-04-decisions.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/di-25-enumeration.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md
  modified:
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md

key-decisions:
  - "DEC-23: RSVP counts use two parallel head-count queries, not a DB function (a function needs a migration; orchestrator decision 2)"
  - "DEC-24: DI-35 — RequestProfile narrows to id/roles/onboarding_completed; no ban guard added; checkBanStatus() stays on save POST and rsvp POST only, pinned by PRESERVE tests"
  - "DEC-25 (planner's call, overridable before 04-09): keyset cursor on (start_date, id) asc, base64 {sortValue,id}, page/limit kept, total unchanged, invalid cursor 400"
  - "DEC-26: tag surfacing ships non-visually in 04-07; the six identity mappings go to the 04-11 checkpoint with deferral as default"
  - "DEC-27: club fabrication — the non-visual half ships in 04-10; the visual half conflicts with orchestrator decision 1 while ROADMAP criterion 2 requires it, so it goes to the 04-11 checkpoint"
  - "DEC-28: DI-25 measured — no blocking site in a Phase 4 handler; supabase-js minor to Phase 5, ssr major to Phase 5 at the earliest; no dependency moves in Phase 4"
  - "DEC-29: seam adoption drops three auth-error console.warn lines before a 401; response bytes identical"
  - "DEC-30: no seed change in Phase 4 — the seed already has 2 RSVPs (research Pitfall 3 corrected); A3 moot"
  - "DEC-31: events.rsvp_count registered (F-084), neither adopted nor dropped"
  - "DEC-32 (planner's call, overridable before 04-08): F-082's escaping ships unconditionally in 04-08; a seeded-visible fix goes to the checkpoint only when its clause has a non-visual delivery, and criterion 3's escaping has none"
  - "REFAC-09 and REFAC-10 are NOT marked complete by this plan: it builds their preconditions only (the 01-01 AUDIT-13/20 precedent)"

patterns-established:
  - "Tag gate: node scripts/check-characterization-tags.mjs --all before any characterization suite is committed; 04-03 wires it into CI"
  - "Planner decisions carry an override clause the executing plan reads before changing any file"

requirements-completed: []  # plan lists REFAC-09, REFAC-10; neither is delivered here — deliberately not marked (see Deviations 6)

# Metrics
duration: 15min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 01: Floor, Register, Tag Gate and Decision Record Summary

**Before-floor re-measured on base 794556a (jest 358/5, pgTAP 86 unseeded with 21 SKIPs and 86 seeded with 0, Playwright 27). F-079..F-085 registered with live reproductions. A PRESERVE/DEFECT tag gate that fails on an F-999 citation. DEC-23..DEC-32 written. The supabase-js bump's blocking sites enumerated: none is in a Phase 4 handler.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-23T04:34:34Z
- **Completed:** 2026-09-23T04:49:18Z
- **Tasks:** 3 of 3
- **Files:** 7 created, 2 modified (one of them generated)

## Accomplishments

- **The floor is a measurement, not a citation.** Every row equals 04-RESEARCH.md's number, and every delta is stated as 0 rather than omitted. Research assumption A8 is closed. pgTAP reports `Tests=86` on both runs because a TAP SKIP still counts as a test, so the plan's "SKIP count" was taken per assertion: 21 of 21 SKIP unseeded, 21 executed and 0 SKIP seeded. This is Pitfall 4, measured.
- **Seven findings registered by surgical insertion** (180 insertions, 1 deletion, the deletion being F-050's `closes_in_phase`). `validate --check findings` passes 8/8 at 85 findings, and FOUNDATION_AUDIT.md was regenerated by its generator. The seven evidence anchors were verified to resolve by slugifying the headings, a check the validator does not make.
- **The tag gate works in both directions.** `--all` finds exactly the five expected suites, and every cited id resolves (F-004, F-040, F-007, F-071, F-072, F-073). It exits 1 on a DEFECT fixture citing F-999, on a DEFECT with no id, on an untagged characterization docblock, and on a missing path. `--all` that discovers nothing also exits 1, because a gate that matches nothing must not report green.
- **DI-25 was decided on measurement, not assumption.** In a throwaway worktree, supabase-js 2.116.0 raises 7 TS2345 and 1 TS2322 (Phase 2 saw 6). None is in a Phase 4 handler. The worktree was removed, and the main tree's manifests are untouched and still on 2.81.1.
- **Ten decisions and the full deferred register.** Every inherited DI (including the closed DI-19/20/28/32) and every assumption A1..A8 has a disposition and an owner. The next new item is DI-36.

## Task Commits

1. **Task 1: re-measure the before-floor**: `ad6dbc4` (docs)
2. **Task 2: register F-079..F-085, move F-050, add the tag gate**: `27472b6` (feat)
3. **Task 3: decision record, DI-25 enumeration, deferred register**: `56b1cb8` (docs)

## Planner decisions the phase owner may override

No discuss-phase ran, so two design calls were taken by the planner on the research's evidence. Each has an override clause that the executing plan reads before touching a file.

- **DEC-25, the pagination contract. Override before 04-09 executes.** An override would replace the keyset cursor with the simpler alternative: make `useEvents` speak `page`/`limit` and delete the cursor code and the skipped suite's cursor contract. That changes 04-09's scope from implementing cursors in the route to removing them from the client. It also keeps OFFSET paging, which the project's Postgres skill advises against.
- **DEC-32, F-082 exempt from the 04-11 checkpoint. Override before 04-08 executes.** An override would route the search escaping to the owner checkpoint, where the no-answer default is deferral. In that case 04-08 stops before changing any file. ROADMAP success criterion 3's `%`/`_` clause would then ship only if the owner says yes, and an injection-class finding could stay open by default.

Mechanism for both: append an owner-signed paragraph to that DEC's section in `evidence/phase-04-decisions.md`.

## Files Created/Modified

- `evidence/floor.before.txt`: base sha on line 1, summary table (measured, research, delta), 15 raw command blocks plus 3 supplementary pgTAP/seed blocks, and the probe script as an appendix.
- `.planning/audit/findings.json`: F-079..F-085 appended; F-050 `closes_in_phase` null to "04".
- `.planning/audit/FOUNDATION_AUDIT.md`: regenerated, 85 findings.
- `.planning/audit/quality/phase-04-slice-defects.md`: one anchored section per finding, with reproductions re-run on 2026-09-23.
- `scripts/check-characterization-tags.mjs`: the tag gate, Node built-ins only.
- `evidence/findings-registration.txt`: generator, validator, diffstat, gate green and five reds.
- `evidence/phase-04-decisions.md`: DEC-23..DEC-32.
- `evidence/di-25-enumeration.txt`: per-site classification and the raw worktree session.
- `evidence/deferred-items.md`: the Phase 4 register.

## Decisions Made

See `key-decisions` above and `evidence/phase-04-decisions.md`. The two with the widest reach:

- **DEC-27** states the one conflict the plan set cannot resolve by itself, in those words: the visual half of the club fix conflicts with orchestrator decision 1 while ROADMAP criterion 2 requires it.
- **DEC-32** turns F-082's different treatment into a rule. A seeded-visible fix goes to the checkpoint when its ROADMAP clause can be delivered without the visible change. Criterion 3's escaping cannot be.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - evidence completeness] Per-assertion pgTAP probe added to get the SKIP counts**
- **Found during:** Task 1.
- **Issue:** The plan asks for "the assertion count and the SKIP count" of each pgTAP run. `supabase test db` has no verbose flag and prints `Tests=86` on both runs, so the SKIP count is not in its output.
- **Fix:** Blocks 10b and 12b run `040-seed-coverage.test.sql` through psql in the local DB container, mirroring the CLI's own sequence: install pgTAP into `extensions`, run the file (BEGIN…ROLLBACK), drop pgTAP. That needed a second `db reset --local` and a seed reload (block 11b) before Playwright. The probe script is reproduced verbatim in the file's appendix. The local container only was used.
- **Commit:** `ad6dbc4`.

**2. [Rule 1 - accuracy] F-081 names four disagreeing TAG_HIERARCHY keys, not three**
- **Found during:** Task 2, re-reading `src/lib/constants.ts:342-351`.
- **Issue:** The plan names hackathon, workshop and fitness. `competition` also disagrees: career in TAG_HIERARCHY, sports in tagMapping.
- **Fix:** Added to F-081's affected_paths, reproduction and recommended fix, and to the evidence table.
- **Commit:** `27472b6`.

**3. [Rule 2 - completeness] F-084 records a reader of the dead column that research missed**
- **Found during:** Task 2's `rsvp_count` census.
- **Issue:** `src/app/api/events/export/route.ts:32,231` writes the never-maintained column into the CSV export.
- **Fix:** Added to F-084's affected_paths, rationale and fix, and to DEC-31. The severity stays Low, with the reason stated in the rationale. F-084 also carries a `resolution` note recording why it closes in Phase 6 rather than 4, since the plan asked for that rationale and `resolution` is the schema's field for it.
- **Commit:** `27472b6`.

**4. [Rule 2 - gate strictness] The tag gate fails closed on an empty discovery, and proves more than one red**
- **Found during:** Task 2.
- **Fix:** `--all` finding zero suites exits 1. The evidence shows four red cases plus a mixed run (the green tree with one bad fixture), not only the required F-999 fixture. Leading-docblock-only parsing means a tag word buried in a test body cannot satisfy the gate.
- **Commit:** `27472b6`.

**5. [Measurement differs from inherited premise] DI-25 has 7 TS2345 sites, not 6, and one is adjacent to Phase 4**
- **Found during:** Task 3.
- **Details:** There is a new site since Phase 2, `admin/featured/[id]/route.ts:43`. There is also a TS2322 at `src/lib/audit.ts:38`, F-073's `admin_email`, visible because 2.116.0 rejects excess properties. `src/app/api/events/[id]/route.ts:318` is in that file's **PATCH** handler, and the file's GET is Phase 4's.
- **Classification:** Outside Phase 4 by the plan's handler test, so DEC-28 re-defers and no owner decision is opened. The adjacency is recorded in DEC-28 and the enumeration file: 04-10/04-11 edit that file's GET and must leave PATCH's `directUpdates` typing alone.
- **Commit:** `56b1cb8`.

**6. [Project precedent over the executor default] REFAC-09 and REFAC-10 were not marked complete**
- **Issue:** The executor's state step marks the plan frontmatter's requirements complete. This plan lists REFAC-09/REFAC-10 but delivers no clause of either. It registers, measures and decides so that later plans can deliver them.
- **Fix:** `requirements-completed: []` and `requirements.mark-complete` was not run, following the 01-01 precedent in STATE.md ("AUDIT-13 and AUDIT-20 are NOT marked complete by plan 01-01 — it stands up their enforcement only").

---

**Total deviations:** 6 (4 auto-fixed evidence or accuracy additions, 1 measured-premise correction, 1 precedent-driven state choice).
**Impact on plan:** No scope creep and no file outside the plan's `files_modified` list was touched. `git diff --name-only 794556a -- src/ e2e/ supabase/ package.json package-lock.json tsconfig.json` prints nothing.

## Issues Encountered

- `npm ci`'s exit code was lost on the first worktree run: the shell is zsh, and `PIPESTATUS` is a bash-ism. It was re-run with the exit code captured directly (exit 0) before the evidence was written.
- A line-splitting `sed` truncated the TS2345 type text in the first draft of the enumeration file. The file was rebuilt with verbatim site paths and an explicit inside/outside label per line.

## Known Stubs

None. `evidence/deferred-items.md` Part 4 is an intentionally empty append-point for later Phase 4 plans (DI-36 onward), labelled as such.

## Next Phase Readiness

- **04-02 and 04-03 (wave 2) can start.** Every id they cite exists: F-079, F-080, F-081, F-085, DEC-24, DEC-30. The tag gate is ready for 04-03 to wire into CI.
- **The before-floor numbers later plans compare against:**
  - jest 358 passed / 5 skipped / 363; 34 passed, 1 skipped, 35 suites
  - phase subset 101 passed / 1 skipped
  - lint 0 errors / 19 warnings; tsc clean; audit 0 high
  - ratchet 24/24; 4 migration filenames; validate --quick 118/2/1
  - pgTAP 86/86; Playwright 27
  - stale date residue 8 lines / 4 files; `(supabase as any)` 2 code sites
- **The DEC-25 and DEC-32 override windows** close when 04-09 and 04-08 start.
- **Local stack state at handoff:** reset and freshly seeded. Port 3000 is free.

## Self-Check: PASSED

- All 9 key files found on disk.
- Commits `ad6dbc4`, `27472b6`, `56b1cb8` found in `git log`.
- `floor.before.txt` line 1 is `base=794556af090ad39f55bb792143b1d2c880615ace`.
- `validate.mjs --check findings` 8/8 at 85; `check-characterization-tags.mjs --all` reports `ok 5 files`; `gen-foundation-audit.mjs --check` is up to date.
- `git worktree list` has 1 line; the main tree's manifests are unmodified.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Completed: 2026-09-23*
