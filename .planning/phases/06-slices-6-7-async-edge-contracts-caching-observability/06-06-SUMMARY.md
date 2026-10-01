---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 06
subsystem: slice-close
status: complete
tags: [slice-close, after-floor, playwright, pgtap, pg_cron, register, validated-reconfirmation, REFAC-14, REFAC-23, F-002, F-017, F-028, F-037, F-039, F-040, F-042, F-074, F-075, F-076, F-092, F-093, DEC-72, DI-82]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-01: floor.before.txt, DEC-60..DEC-81, the deferred register; 06-02..06-05: slice 6's characterization, cron deletion, webhook, contracts, route fixes and definer-hardening migration"
provides:
  - "evidence/floor.slice-6-after.txt: the slice-6 after-floor from a clean reset (43 blocks with exit codes, summary table against floor.before.txt, C1-C9 re-measured, the local cron run history)"
  - "evidence/playwright.slice-6-after.txt: the full suite, 100 passed, 0 failed, first run"
  - "evidence/slice-6-close.md: floor, 16-row Validated re-confirmation, REFAC-14 clause table, closures, intentional behaviour changes, local-only closures, commits"
  - "Register: F-002, F-017, F-037, F-040, F-042, F-092 Fixed; F-074, F-075, F-076, F-093, F-039 Open at 08; F-028 progress at 06; FOUNDATION_AUDIT.md regenerated"
  - "Deferred register: DI-33 cron half and DI-44 code half CLOSED; DI-82 dispositioned to Phase 7; DI-83..DI-86 new; DI-67 extended; next id DI-87"
affects: [06-07, 06-17, 06-18]
tech-stack:
  added: []
  patterns:
    - "A time-boxed block runner (label, displayed command, filtered output, exit=) writes each floor block from the command's own exit code"
    - "Cron run history read in a BEGIN … ROLLBACK probe joined to cron.job, grouped by job and status, with zero-run rows kept; a second probe after the next */15 and */30 boundary when the first window is empty"
    - "Register edits by a text-surgical script: per record only the status, closes_in_phase and resolution lines change, and the file is re-parsed before it is written"
key-files:
  created:
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/floor.slice-6-after.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/playwright.slice-6-after.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/slice-6-close.md
  modified:
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/deferred-items.md
decisions:
  - "F-037 is Fixed: the local run history after the cron routes' deletion shows send-event-reminders and send-feedback-requests each ran once at 02:00:00Z and succeeded, with 0 runs in any other status (floor block 16b). The first probe, immediately after the 33-second Playwright run, found 0 runs because no boundary had passed; it is recorded, not omitted"
  - "REFAC-14 is Complete: all four clauses are MET by committed evidence. The webhook's redeploy (DI-81) is F-039's deployment-record clause, not a REFAC-14 clause; the deployed function already requires credentials and fails closed"
  - "DI-82 is dispositioned to Phase 7 with a target, not fixed here: this plan forbids source changes and 06-05's text never directs a change to compute_user_scores(). Target: a fix-forward migration writing the two unqualified deletes as DELETE … WHERE true, 070 row 1's md5 re-derived under a signed DEC-68 amendment, a DEFECT row moved on the real stack, the e2e workaround removed"
  - "The contracts gate's 'no slice-6 file' means the four slice-6 contract families (recommendations, interactions, feedback, notifications). The two admin/reports allow-list entries belong to the admin family, which 06-10 adopts; admin/reports was touched in slice 6 only for F-092"
metrics:
  duration: "18 min"
  completed: "2026-09-27"
  tasks: 2
  files: 6
---

# Phase 6 Plan 06: Slice 6 Close Summary

**Slice 6 closed on a green floor from a clean reset. Playwright passed 100 of 100 and pgTAP 13 files / 260 tests, both unseeded and seeded. Jest ran 1995 tests with 0 failed, and the ratchet is committed=0 live=0. The declared pg_cron reminder and feedback jobs were observed running without failure. All 16 Validated workflows were re-confirmed, and REFAC-14 is met clause by clause. The register now records six Fixed findings and five kept Open at "08" (four waiting on DI-23, one on the webhook deploy record).**

## What was done

**Task 1: the after-floor** (`3bbc503`). Each block was run by a time-boxed runner against the local stack, starting from `supabase db reset --local`. The order was:
- port check;
- reset, then pgTAP unseeded;
- seed, then pgTAP seeded;
- a second reset and seed;
- Playwright, then the residue check and cron probe 1;
- Jest with its JSON pending-test check, lint, tsc and audit;
- the ratchet, the filename check, the tag gate, the contracts census and the allow-list family check;
- `validate --quick`, the types diff and the CI-env build;
- the 404 probe of the deleted cron paths;
- the C1-C9 censuses;
- the F-040 grep, the `cron.job` versus production comparison, and cron probe 2;
- a final reset, seed and residue check, then the port check.

Results against `floor.before.txt`:

| Row | Before | After |
|---|---|---|
| Jest | 1651 | 1995 passed, 1 skipped (the Upstash contract only) |
| pgTAP | 11 files / 200 tests | 13 / 260, both runs |
| Playwright | 97 | 100 (+3, `async-edge.spec.ts`) |
| Ratchet | 2/2 | 0/0 |
| Migrations | 8 | 9 |
| Tag gate | 34 | 44 |
| Contracts census | — | 86/86 |
| Types diff | — | empty |
| CI-env build | — | exit 0, 98 pages; the two cron routes are gone |
| C1 | 160 | 158 |
| C2 | 21 | 18 |
| C4 | 59 | 53 |
| Other censuses | — | unchanged |
| C9 | — | zod 4.6.5 with 7 non-test importers |

New facts measured at this floor:
- Both deleted cron paths answer 404 to GET and POST on a production build against the local stack (block 8e).
- No non-test file reads `CRON_SECRET`, `ADMIN_API_KEY` or `ADMIN_EMAILS` (block 8f).
- `cron.job` after a fresh reset equals production's list field for field (block 16c).
- Cron probe 1 (block 16a) found 0 runs: the Playwright run took 33 s, so no boundary had passed. Probe 2 (block 16b, 02:01Z) found one succeeded run each for reminders and feedback at 02:00:00Z, and 0 failed runs.

The stack was left reset and seeded, with residue at the seed's counts, and port 3000 is free.

**Task 2: the close note and the register** (`17f9e8a`).

`evidence/slice-6-close.md` (173 lines) contains:
- the floor table;
- the Playwright history across the slice;
- the 16-row Validated table. Its row count equals `grep -c '^- ✓' .planning/PROJECT.md`. Row 13 states that the "email reminders" half is contradicted by F-038 and that pg_cron delivers the in-app reminders;
- the REFAC-14 clause table, with all four clauses MET;
- the closures;
- slice 6's intentional behaviour changes, with their commits;
- the local-only closures pending DI-23;
- the deferred items;
- the commit list, which includes `57cb55f`.

The register edits are single-field and surgical: numstat 23/16, and only status, `closes_in_phase` and resolution lines changed. Each resolution cites its commits and `slice-6-close.md`. `FOUNDATION_AUDIT.md` was regenerated (94 ids for 94 findings). `validate.mjs --check findings` passes 8/8 and exits 0, and the plan's verify one-liner exits 0.

## Register outcome

| Finding | Status | Why |
|---|---|---|
| F-002 | Fixed "06" | Route deleted; path answers 404; the grep clause is vacuous |
| F-017 | Fixed "06" | Non-admins are assigned variants; the assignment is recorded on the real stack |
| F-037 | Fixed "06" | Handlers deleted; reminder and feedback jobs ran with 0 failures (block 16b) |
| F-040 | Fixed "06" | No reader of the three variables remains; the boot check and its test |
| F-042 | Fixed "06" | The reset census equals production's list |
| F-092 | Fixed "06" | The reports list answers 200 with the reporter's name on the real stack |
| F-074, F-075, F-076, F-093 | Open "08" | Fixed and proven locally (migration 20260926120000, pgTAP 070 and 031, mutation check); production closes with the DI-23 repair |
| F-039 | Open "08" | Code half done; the CI deployment record is DI-81 |
| F-028 | Open "06" | 5 of 8 routes answer 401 and 1 is deleted; the rsvp GET and club events are handled by REFAC-19 in 06-14 |

Totals: Fixed went from 34 to 40, and Open from 60 to 54. Open findings at "06" went from 21 to 10, all owned by slice 7.

## Deferred register

- **DI-33:** cron half CLOSED.
- **DI-44:** code half CLOSED.
- **DI-82** is dispositioned to Phase 7 with a concrete target. No change was made to `compute_user_scores()`, as the plan's text requires.
- New items:
  - **DI-83:** three malformed webhook payloads still answer 500. Owner: 06-18, with F-094.
  - **DI-84:** the Deno suite has never run. Owner: Phase 8, with DI-81.
  - **DI-85:** Playwright leaves a wall-clock seed stamp that turns pgTAP 040 row 20 red until the next reset. Owner: Phase 7.
  - **DI-86:** the tag gate was red after 06-03. CLOSED by `57cb55f`.
- **DI-67** extended: the mutation harness covers only `CREATE POLICY`.
- Next id: DI-87.

## Requirements

- **REFAC-14 is marked complete.** Every clause is met by committed evidence (`slice-6-close.md` § 3):
  - The cron routes are deleted; nothing called them, and they answer 404.
  - The webhook requires the HMAC and fails closed: a missing secret or a missing, wrong or wrong-length signature answers 500 or 401 (rows 2-5), and a replay is refused (row 16).
  - The recommendation surface is characterized input → ranked output by the 13-row PRESERVE table plus mutation M1.
  - The formula is unchanged: 070 row 1 (md5) and row 4 (breakdown invariant).

  The webhook's redeploy is F-039's clause, not REFAC-14's.
- **REFAC-23 is not marked complete.** Its "after each slice" runs through slice 7's close in 06-18.

## Deviations from Plan

### Plan text vs measurement

- **"Immediately after Playwright (so at least one 15-minute window has passed since the reset)".** The whole Playwright run took 33 seconds, so no window had passed. Block 16a records the zero rows immediately after Playwright, as the plan orders. Block 16b re-read the history after the 02:00 UTC boundary, where both jobs had run. F-037 is decided on block 16b. Both blocks are in the floor.
- **Rows the before-floor did not measure.** These are the types diff, the CI-env build, the contracts census, the 404 probe and the F-040 grep. They say "—" in the before column and name the Phase 5 after-floor value where one exists.
- **Block 15b** (port 3000 after Playwright) ran inside the inspection command right after Playwright, not through the block runner. The block quotes that command's output and says so. Blocks 8e and 19 re-confirm the port through the runner.
- **Added blocks 8e, 8f and 16c.** Each is evidence a register resolution needed: the 404, no remaining reader, and the census comparison. None writes a row.

### Auto-fixed Issues

None. No source, test or configuration file changed. `git status --porcelain -- src/ supabase/ e2e/` prints nothing.

## Issues

- `gen-foundation-audit.mjs --help` is not a help flag: it regenerated `FOUNDATION_AUDIT.md` once before the edits. The output was byte-identical, and `git status` showed no change.
- A patch command run under an unquoted heredoc dropped one sentence ending in the first build of the F-075 resolution. The resolution was rebuilt and re-applied through the same surgical script, and the final text was checked by printing it.
- The Playwright server log again carries F-078's fuzzy-search 0A000 (9 times) and two "destination stream closed early" lines. Both are pre-existing and noted in the evidence.

## Known Stubs

None. This plan changes evidence and registers only.

## Threat Flags

None. No endpoint, auth path or schema changed. The T-06-06-01 mitigation holds: every Fixed status cites committed evidence, and F-037 is conditional on block 16b. T-06-06-02 holds: F-074, F-075, F-076 and F-093 stay Open at "08" with the DI-23 wording, and the verify one-liner exits 0. T-06-06-03 holds: Playwright passed with 0 failed on the first run, and no re-run was needed.

## Self-Check: PASSED

- FOUND: `evidence/floor.slice-6-after.txt` (891 lines, line 1 `head=71bfd55267e45c72185c850b7faa54208bcefff8`, contains `committed=0`), `evidence/playwright.slice-6-after.txt` (ends `0 failed` / `exit=0`), `evidence/slice-6-close.md` (173 lines), `evidence/deferred-items.md`, `.planning/audit/findings.json`, `.planning/audit/FOUNDATION_AUDIT.md`.
- FOUND: commits `3bbc503` and `17f9e8a`; neither deletes a file.
- The plan's Task 1 and Task 2 verify commands exit 0. Validated rows 16 = PROJECT.md's 16.
- Docker stack healthy; no `psql`, `docker exec`, `next` or Playwright process left; port 3000 free (lsof exit 1).
