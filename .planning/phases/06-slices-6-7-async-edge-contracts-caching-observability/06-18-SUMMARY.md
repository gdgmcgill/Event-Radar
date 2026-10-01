---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 18
subsystem: phase-close
status: complete
tags: [F-085, DI-53, DI-25, supabase-js, after-floor, playwright, csp, slice-7-close, register, completion-note, REFAC-14, REFAC-15, REFAC-16, REFAC-19, REFAC-20, REFAC-21, REFAC-22, REFAC-23, DEC-80, DEC-81]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-10's four DI-53 retypes (f869323) and early 2.116.0 signal; 06-17's health and admin page gates; every 06-01..06-17 SUMMARY, evidence file and register entry"
provides:
  - "F-085 fixed: saved-events 'upcoming' floors on getESTNowISO(), the feed's Eastern floor (b8e20f4), pin moved under the five-step ledger protocol"
  - "@supabase/supabase-js 2.116.0 exact (f4c59e4), the last code change of Phase 6, after a throwaway-worktree tsc with 0 errors; @supabase/ssr stays 0.7.0"
  - "evidence/floor.phase-after.txt and evidence/playwright.phase-after.txt: the phase after-floor from a clean reset (Jest 3439 + 1 skipped, pgTAP 13/260 both runs, Playwright 269/0 with the CSP enforced, every census at target)"
  - "evidence/slice-7-close.md: floor table, 16 Validated rows, closures, slice 7's intentional behaviour changes"
  - "findings.json: F-026, F-029, F-054, F-058, F-059, F-085, F-094 Fixed; F-025, F-055, F-028 Open at 08; FOUNDATION_AUDIT.md regenerated"
  - "deferred-items.md: DI-83 re-dispositioned, DI-89..DI-99 registered, Part 7 final states, DI-46 awaiting the owner"
  - "evidence/PHASE-6-COMPLETION.md: criteria and requirements clause by clause, Phase 8 deploy prerequisites, citations distinct=87 missing=0"
  - "evidence/claude-md-corrections.patch: fact-only CLAUDE.md corrections, not applied"
  - "REQUIREMENTS.md, ROADMAP.md (Requirement states), PROJECT.md (six Key Decisions rows)"
affects: [phase-6-verification, phase-7, phase-8]
tech-stack:
  added: []
  patterns:
    - "Registry facts for a package with no legitimacy bundle recorded in the bump's evidence before install, then compared with the lockfile's resolved integrities"
    - "A lockfile diff reviewed entry by entry, each non-scope entry traced to the dependency map of an in-scope package"
    - "Findings registers edited by a span-bounded string script (status, closes_in_phase, resolution only) because the JSON layout is not a standard stringify"
key-files:
  created:
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/f-085-fix.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/di-53-bump.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/floor.phase-after.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/playwright.phase-after.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/slice-7-close.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/PHASE-6-COMPLETION.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/claude-md-corrections.patch
  modified:
    - src/app/api/users/saved-events/route.ts
    - src/__tests__/api/events/saved-events-time-floor-defect.test.ts
    - package.json
    - package-lock.json
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/deferred-items.md
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "DI-83 (three malformed webhook payloads still answer 500) is recorded as F-094's stated residue, owner Phase 8 with the CI redeploy, instead of changing the edge function after the SDK bump. F-094 is Fixed (its criterion names route handlers and DEFECT suites); REFAC-15 is PARTIAL on 'returns a consistent 400 shape on malformed input' at that handler"
  - "F-029 is Fixed with the HEALTH_TOKEN bearer written into its resolution: the report needs an admin session or DEC-78's machine credential, which no environment sets until the owner provisions it"
  - "F-059 is Fixed: no route puts a caught error's message in a response body; the one S2 residue is the callback's redirect query (DI-98). The generic-body rows script code XX000, and no handler reads .message any more, so a constraint violation's code cannot change the body"
  - "REFAC-21 stays PARTIAL on 'source maps' and 'appears in Sentry'; REFAC-23 is Complete; REFAC-14, 16, 19, 20, 22 re-confirmed Complete"
  - "CLAUDE.md and .claude/CLAUDE.md are untouched: DI-46 holds no owner-signed authorization, so the corrections are a patch (git apply --check exit 0)"
metrics:
  duration: "34min"
  completed: "2026-09-27"
  tasks: 3
  files: 18
---

# Phase 6 Plan 18: Phase close (F-085, supabase-js 2.116.0, after-floor, slice 7 close, completion note) Summary

**Phase 6 closes with a green after-floor from a clean reset.**
- **F-085:** saved events use the feed's Eastern "upcoming" floor.
- **supabase-js:** 2.116.0, exact, is the last code change.
- **Register:** the findings file says exactly what closed and what waits for Phase 8.
- **Completion note:** it answers every criterion and requirement against its own words and lists the owner's pre-deploy actions in order.

## What was done

**Task 1: F-085, then the DI-53 bump** (`b8e20f4`, `f4c59e4`)
- **F-085.** `src/app/api/users/saved-events/route.ts` now floors on `getESTNowISO()`. The pin went through the ledger protocol:
  - with the fix and the unedited pin, it went red (3/4);
  - after the move, it passed (4/4);
  - against the pre-fix source, it went red (3/4);
  - `cmp` exited 0;
  - the PRESERVE saved-events suite was unedited, and `src/__tests__/api/events` passed (20 suites).
- **Bump, legitimacy facts.** No evidence file held a supabase-js integrity bundle. I recorded the registry facts in `di-53-bump.txt` block 0 before installing: the integrity of 2.116.0 and its five sub-packages, the maintainers and the publish date.
- **Bump, throwaway worktree** at `b8e20f4`: after `npm ci` and `npm install --no-save`, tsc exited 0 with 0 errors and Jest passed 3439 plus 1 skipped. I then removed the worktree; `git worktree list` shows one line.
- **Bump, main tree.** I ran `npm install --save-exact @supabase/supabase-js@2.116.0`.
  - The lockfile keeps `lockfileVersion` 3, and 12 entries moved.
  - Four of those entries are outside `@supabase/*`. Each one is a dependency that a `@supabase` package added or dropped:
    - `@supabase/phoenix` and `iceberg-js` were added;
    - `@types/phoenix` and `@types/ws` were removed;
    - `ws` is now dev-only.
  - The resolved integrities equal the registry facts from block 0.
- **Gates after the bump:**
  - audit gate: exit 0;
  - tsc: exit 0;
  - lint: 0 errors;
  - Jest: 129 suites passed;
  - the CI-env build: exit 0.

**Task 2: the after-floor, the slice-7 close and the register** (`3902768`)
- **After-floor** on `f4c59e4`, from a clean reset:
  - pgTAP: 13 files, 260 tests, unseeded and seeded.
  - Playwright: 269 passed, 0 failed, with `bypassCSP: false`. It ran in two halves of 12 files; each half was a first run and exited 0.
  - Jest: 3439 passed. The one skipped test is the Upstash suite.
  - The elevated ratchet is 0/0 and the contracts census is 0/0. The `--client` census found 0 violations, and the console census is 2/2.
  - The types diff is empty, and the CI-env build exited 0.
  - `cron.job` matches production. After the 18:30Z boundary, the reminder and feedback jobs had run 3 times, all succeeded.
  - Censuses C1..C9 were re-measured against the before-floor and slice-6 columns.
- **Slice-7 close note:** the floor table, 16 Validated rows, the closures and 13 intentional behaviour changes, each with its commits.
- **Findings register:**
  - Fixed: F-026, F-029, F-054, F-058, F-059, F-085 and F-094.
  - Open at "08", each with its unmet clause named: F-025, F-055 and F-028.
  - `FOUNDATION_AUDIT.md` was regenerated. Findings now stand at 47 Fixed and 47 Open, with none Open at "06". `validate --check findings` passes 8/8.
- **Deferred register:**
  - DI-83 is re-dispositioned.
  - DI-89..DI-99 are registered from the 06-07..06-17 SUMMARYs.
  - Part 7 gives every item's final state.
  - The ledger's F-085 hash is filled in.

**Task 3: the completion note and the records** (`6ef7e51`)
- **`PHASE-6-COMPLETION.md`**, 476 lines:
  - Criteria 1 and 5 are MET. Criteria 2, 3 and 4 are PARTIAL on DI-83 and DI-81.
  - All eight requirements are measured clause by clause.
  - The 16 Validated rows, 19 intentional behaviour changes and DEC-60..81 are listed, with the orchestrator's decisions.
  - It lists the local-only closures that wait for DI-23.
  - It gives ten ordered Phase 8 deploy prerequisites.
  - It records `CI run UNOBSERVED`.
  - The citation count is `distinct=87 missing=0`.
- **`claude-md-corrections.patch`**, 127 lines, not applied. It is fact-only: the supabase-js, zod and Sentry pins; the removed Vercel cache-header line; the deleted cron entry point; `withRoute`, the contracts and the logger; the CSP; `/api/health`; the CI steps; the optional variables.
- **Requirement records:**
  - `REQUIREMENTS.md`: all eight traceability rows now read `Complete (06-18)` or `PARTIAL (06-18)` and name the clause. REFAC-23 is checked.
  - ROADMAP: a Phase 6 "Requirement states (recorded by plan 06-18)" block was added.
  - PROJECT: six Key Decisions rows were added.

## Requirement states

| Requirement | State | Unmet clause, if any |
|---|---|---|
| REFAC-14, REFAC-16, REFAC-19, REFAC-20, REFAC-22 | Complete (re-confirmed) | none |
| REFAC-23 | Complete (this plan) | none |
| REFAC-15 | **PARTIAL** | "returns a consistent 400 shape on malformed input": the events-webhook still answers 500 to three shapes (DI-83, Phase 8) |
| REFAC-21 | **PARTIAL** | "source maps" (never uploaded) and "appears in Sentry" (proven with an in-memory transport only; no Sentry project exists) (DI-81) |

`requirements.mark-complete` ran for REFAC-14, 16, 19, 20, 22 and 23, and left the rows unchanged. REFAC-15 and REFAC-21 stay unchecked.

## Deviations from Plan

### Plan text vs measurement (recorded, not rounded)

**1. The server-console census holds two entries, not only `src/lib/tagMapping.ts`.**
- The plan's C1 target is met: C1 counts 1 line, in `tagMapping.ts`.
- `check-server-console.mjs` also counts rule S2. Its one S2 entry is the auth callback's redirect text, which 06-14 kept by rule (PRESERVE-pinned, Phase 7). It is registered as DI-98.

**2. DI-83 was re-dispositioned, not executed.**
- The DI-83 section itself leaves 06-18 two options: the handler change with a ledger row, or F-094's stated residue.
- The plan also makes the bump the last code change ("no code change follows it"), so I recorded the residue.

**3. REFAC-15 is PARTIAL, not Complete.**
- The orchestrator's brief said to mark it only if every clause is met. The webhook's three malformed shapes leave one clause unmet.

**4. The plan's "PROTECTED_ROUTES line number" correction needs no patch hunk.**
- CLAUDE.md already says the line moves and gives the command that re-derives the list. The patch header says so.

**5. The full audit report shows a new low-severity advisory (`@babel/core`) since the before-floor.**
- The gate exits 0, and the bump's lockfile diff does not touch that package. This is recorded in `di-53-bump.txt` and in floor row 4.

### Auto-fixed Issues

None. No code defect was found beyond the planned F-085 change.

## Issues

- `lockdiff.mjs`'s literal `@supabase/*` filter exits 1 because four entries fall outside that scope. The trace script then attributed each of them, and both outputs are in `di-53-bump.txt` blocks 10 and 10b. The plan's rule ("and their own dependencies") is met.
- One inline zsh loop in an acceptance check failed with a parse error. The check was moved into a `.sh` file and passed.
- The Playwright header sweep again prints DI-87's three 500s, as recorded. The Supabase CLI printed its update notice (v2.118.0); I did not act on it.

## Known Stubs

None.

## Threat Flags

None. The only production-code change is F-085's floor, which goes through a helper the events route already uses. The bump's supply-chain facts are in `di-53-bump.txt` (T-06-18-SC).

## Owner actions (for the orchestrator's hand-off; the full ordered list is PHASE-6-COMPLETION.md § 8)

1. Countersign DEC-60 (zod 4.6.5) and DEC-61 (@sentry/nextjs 10.75.3) before any push to main. The supabase-js registry facts are in `di-53-bump.txt` block 0.
2. Complete the Phase 5 Upstash actions (DI-42).
3. Set these variables in Vercel: SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT and HEALTH_TOKEN (32 or more characters). Add them to `.env.local.example`.
4. Optionally apply `claude-md-corrections.patch` after signing an authorization under DI-46.
5. On a preview deploy with a real DSN, trigger an error through a wrapped route. Confirm that `request_id` equals `x-request-id` and that source maps resolve.
6. Redeploy `events-webhook` from CI and confirm WEBHOOK_SECRET. In the same change, run the Deno suite (DI-84) and move the DI-83 rows.
7. Run the DI-23 migration repair. It closes F-074, F-075, F-076 and F-093.
8. Run the real-CDN probe (`cache-e2e.txt` § 5, `cache-probe.sh`) and the A6 check.
9. Decide F-028 and F-038.

## Self-Check: PASSED

- FOUND: all 18 created or modified files are tracked (`git ls-files`).
- FOUND: commits `b8e20f4`, `f4c59e4`, `3902768` and `6ef7e51`. None deletes a file.
- `git worktree list`: 1 line. Port 3000: free (lsof exit 1).
- The Docker stack is healthy and left reset and seeded (floor block 18).
- `node_modules`: supabase-js 2.116.0, ssr 0.7.0.
- `validate --check findings`: 8/8. Completion-note citations: `distinct=87 missing=0`. Slice-7 close citations: `distinct=60 missing=0`.
- `git diff --stat 02177c5 -- CLAUDE.md .claude/CLAUDE.md`: empty.
- `git status --porcelain -- src/ supabase/ e2e/ package.json package-lock.json`: empty.
