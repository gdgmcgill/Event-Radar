---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 02
subsystem: testing
status: complete
tags: [jest, characterization, recommendations, notifications, interactions, feedback, webhook, mutation-testing, F-017, F-028, F-041, F-092, F-094, REFAC-14, REFAC-15, REFAC-23]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-01: before-floor (Jest 1651+1 skipped, tag gate ok 34), F-093/F-094 registered, DEC-60..DEC-81"
provides:
  - "recommendationFixtures.ts: five approved future events whose MMR order at λ 0.7 differs from raw score order, pending/past score rows, a running 50/50 λ experiment, and RLS modelled by what each fake holds (cookie vs elevated)"
  - "PRESERVE recommendations: 13-row input→ranked-output table (ids, source, λ, variant, total_events, score pool, Cache-Control private, no-store), response shapes, 500 body; F-041 pinned as today's behaviour"
  - "PRESERVE recommendations family: batch and analytics guards, analytics 400 and metrics, feedback shape-400s in today's order, DI-44 caller-attribution rows, feedback GET"
  - "PRESERVE notifications (list/cursor/POST/PATCH/count) and interactions + feedback (every shape-400 in check order, DEC-34 anonymous acceptance)"
  - "DEFECT F-017 (non-admin never assigned), F-028 (anonymous count 200), F-094 (3x3 malformed matrix plus null and numeric-subject rows), F-092 (PGRST200 modelled on the broken embed only)"
  - "evidence/slice-6-characterization.txt: measurements, mutations M1/M2, 17-row events-webhook table from source, cron caller census, suite runs"
affects: [06-03, 06-04, 06-05, 06-06, 06-12]
tech-stack:
  added: []
  patterns:
    - "Test-local client wrappers instead of changing the shared fake: withUpsertAsInsert (fake has no upsert) and withSchemaCacheCheck (PGRST200 only when the select names the broken embed hint), so a fix flips the DEFECT row without a fixture edit"
    - "RLS as fixture content across two fakes: the cookie fake holds admin-only rows only for an admin, the elevated fake holds every row, so a move to the elevated door changes the outcome naturally"
key-files:
  created:
    - src/__tests__/api/recommendations/recommendationFixtures.ts
    - src/__tests__/api/recommendations/recommendations-characterization.test.ts
    - src/__tests__/api/recommendations/recommendations-family-characterization.test.ts
    - src/__tests__/api/recommendations/experiment-assignment-defect.test.ts
    - src/__tests__/api/notifications/notifications-characterization.test.ts
    - src/__tests__/api/notifications/notifications-count-defect.test.ts
    - src/__tests__/api/interactions/interactions-feedback-characterization.test.ts
    - src/__tests__/api/slice6-malformed-input-defect.test.ts
    - src/__tests__/api/admin/admin-reports-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/slice-6-characterization.txt
  modified: []
decisions:
  - "The shared fakeSupabase.ts is not extended: the two missing shapes (upsert, a hint-conditional PGRST200) are test-local wrappers, so no existing suite's outcome can shift"
  - "PRESERVE files do not pin the 500 bodies that echo error.message (F-059, slice 7) or response headers on 500s (06-12's wrapper); they pin only bytes slice 6 must keep"
  - "The F-094 number column uses required fields the handlers check without a DB read; interactions event_id=5 is not pinned because the fake answers 404 where PostgREST answers 22P02 → 500"
  - "F-017's fix shape for the student fixture is known in advance: pickVariant puts the student in control (λ 1) and the admin in diverse (λ 0)"
metrics:
  duration: "11 min"
  completed: "2026-09-25"
  tasks: 3
  files: 10
---

# Phase 6 Plan 02: Slice 6 Characterization Summary

**Slice 6 now has a characterization net: 8 new Jest suites (118 tests) pin the recommendations surface's input-to-ranked output, the family's guards and 400s, notifications, interactions and feedback bytes. F-017, F-028, F-092 and F-094 are pinned as DEFECTs. Two source mutations each turned PRESERVE rows red and were restored byte-identical. The webhook and cron behaviour is written down from source. No production file changed.**

## What was done

**Task 1: the recommendations surface** (`6c38659`)
- `recommendationFixtures.ts` builds the scenarios. Raw score order is E1 > E2 > E3 > E4 > E5. E1 and E2 share identical tags, so at λ 0.7 MMR ranks E3 ahead of E2. Start dates are in yet another order, so the popularity paths can be told apart from the scored path.
- The PRESERVE table has 13 rows:
  - anonymous, and anonymous with `top_k`;
  - the F-041 fallback (zero score rows, and only pending/past rows);
  - λ 0.7 default, 0, 1, clamping from 5 and -1, NaN falling back to 0.7;
  - `top_k=2` (a pool of 6 in which the pending and past rows take two places);
  - a session boost;
  - an admin whose variant λ overrides `diversity`.
- Every row asserts status, ordered ids, `source`, reported λ, `experiment_variant_id`, `total_events`, the score-pool limit and `Cache-Control: private, no-store`.
- The family suite pins:
  - batch: 401, 403, admin 200 with the rpc on the elevated client, and the rpc-error 500;
  - analytics: 401, 403, `Invalid period. Use 7d or 30d`, and the 7d metrics;
  - feedback POST: the anonymous 401 (DEC-34), 403 Onboarding required, and 15 shape-400 rows in today's check order;
  - DI-44: a body naming another user's id does not change whose row is written, on both the thumbs and analytics branches;
  - feedback GET.
- DEFECT F-017:
  - D1: a non-admin with scores and a running experiment gets a null variant, the diversity λ, and zero assignment inserts.
  - D2: an existing own assignment is not honoured.
  - Controls: an admin is assigned `pickVariant`'s variant with exactly one insert carrying the admin's id (C1), and an existing admin assignment is reused (C2).

**Task 2: notifications, interactions, feedback and three defects** (`f7bffbf`)
- PRESERVE notifications:
  - the list's 401s, 20-per-page paging, `next_cursor` and `cursor`, and the caller-only `unread_count`;
  - POST: the guards run before the action is read, then `Invalid action` 400 (4 rows), then mark-all-read scoped to the caller;
  - PATCH: the `user_id` filter makes another user's id a silent no-op;
  - the signed-in count.
- PRESERVE interactions/feedback: 10 and 6 shape-400 rows in today's order, plus the 403, the 404s, anonymous acceptance and the written payloads.
- DEFECT F-028: anonymous and auth-error count both answer `200 {"unread_count":0}` with no read.
- DEFECT F-094:
  - the 3 × 3 matrix: not-JSON gives the route's generic 500, an array gives the first "missing" 400, and a numeric required field gives a 400;
  - also pinned: a JSON `null` body answers 500 at all three sites, and feedback's numeric `subject` answers 500.
- DEFECT F-092:
  - PGRST200 is returned only when the select names `users!event_reports_reporter_id_fkey`, using the reproduction's exact error;
  - the admin gets `500 Internal server error` and the count query never runs;
  - anonymous 401 and non-admin 403 do not move.

**Task 3: evidence** (`93ce6db`). `evidence/slice-6-characterization.txt` (514 lines) contains:
- § 1: both measurement harness outputs, verbatim.
- § 2: the mutation cycles.
  - M1 changes the default λ from 0.7 to 0.6. 3 rows went red, cmp and git diff exit 0.
  - M2 removes the interaction_type check. 4 rows went red, cmp and git diff exit 0.
  - `git status --porcelain -- src/app` was empty afterwards.
- § 3: a 17-row events-webhook table read from source, with index.ts line numbers. Rows #5 (a wrong-length signature throws in timingSafeEqual and answers 500) and #16 (a replay inserts again because `content_hash` is never set) are named as DEC-64's two changes. Rows 7, 11 and 12 (500s on a structurally malformed payload) are flagged for 06-03.
- § 4: the cron caller census. There are no callers, `vercel.json` has no `crons` key, and `CRON_SECRET` is read only by the two cron routes.
- §§ 5–7: the new suites (118/118), the tag gate (ok 42) and the full Jest run.

## Floor after this plan

| Gate | Before (06-01) | After |
|---|---|---|
| `npx jest --ci` | 1651 passed, 1 skipped, 88 suites | 1769 passed, 1 skipped, 96 suites, 0 failed |
| `node scripts/check-characterization-tags.mjs --all` | ok 34 | ok 42 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `git diff --stat f215fb7 HEAD -- src/app src/server src/lib supabase` | — | empty |

## Deviations from Plan

### Plan arithmetic corrected by measurement

**1. The plan counts 8 suites as 9, and 42 tag-gate files as 43.**
- **What the plan says:** the objective and slice outcome say "nine suites (five PRESERVE, four DEFECT)", and Task 3 accepts "at least 43".
- **What was measured:** the plan's own file list has 8 test files plus one helper module (`recommendationFixtures.ts`, which is not a test). That is 4 PRESERVE and 4 DEFECT, and the tag gate reports ok 42 = 34 + 8.
- **Resolution:** no suite was added to reach the number. This is recorded in the evidence header.

**2. The notifications routes have no delete arm.**
- The plan's behaviour line names "list, mark-read and delete arms". The three route files export GET/POST, PATCH and GET only, so no delete row exists. This is stated in the suite's docblock.

**3. Mutation M1 left the `diversity=abc` row green.**
- A NaN diversity takes the separate 0.7 at `route.ts:249`, not the default at `:246`.
- The two constants are therefore pinned by different rows. This is a finding about the source, recorded in evidence § 2.

### Additions (Rule 2: needed for the pins to be faithful)

**4. Test-local wrappers instead of changes to the fake.**
- `withUpsertAsInsert` exists because the thumbs branch upserts and the fake has no `upsert`.
- `withSchemaCacheCheck` makes F-092's DEFECT flip on the fix instead of on a blanket table error.
- `fakeSupabase.ts` is unchanged, so no existing suite's "fake gap" outcomes (05-12, writeHandlerTable) can shift.

**5. F-094 rows beyond the 3 × 3 matrix.**
- A JSON `null` body (×3) and feedback's numeric `subject` were measured at 500, which is the same defect.
- They sit in a separate describe block, so the matrix stays at the 9 rows the acceptance criterion counts.

### Requirements not marked complete

**6. REFAC-14, REFAC-15 and REFAC-23 stay Pending.** This plan characterizes them and does not deliver them. It follows 06-01's precedent (deviation 8 there), so `requirements.mark-complete` was not run.

**Total deviations:** 3 measured corrections of plan text, 2 Rule-2 additions, 1 state-protocol omission. **Impact:** none on production code. Every pin is today's measured behaviour.

## Observations for later plans

- **06-03:**
  - The webhook table in evidence § 3 is the contract, and the two CHANGE rows are the intended moves.
  - Rows 7, 11 and 12 (500 on a null payload, a null event element, or a non-string tag) are the webhook's share of F-094. Record whether the contract makes them 400s.
- **06-04:**
  - F-017's fix must read `experiments`, `experiment_variants` and `experiment_assignments` and insert through `getElevatedClient()`. The elevated fake already holds those rows, so D1 and D2 flip to control (λ 1) with one insert.
  - The recommendations PRESERVE admin row survives because `pickVariant` is deterministic.
  - The F-094 array rows move to `Request body must be a JSON object`. The not-JSON rows move to `Invalid JSON body`.
- **06-04 / DEC-69:** notifications/count D1 and D2 become `401 {"error":"Unauthorized"}`. F-092's D1 becomes 200 with `reporter.display_name` mapped from `users.name`.
- **06-12:** the PRESERVE files pin no header on 500 responses, so a cache policy applied by the wrapper does not touch them.

## Known Stubs

None. Only test files, a test helper and evidence were created.

## Threat Flags

None. No endpoint, auth path or schema was changed. The threat register's mitigations were applied:
- **T-06-02-01:** F-017, F-028, F-092 and F-094 appear only in DEFECT docblocks. The PRESERVE docblocks name DEFECT siblings by filename only, and the tag gate reads one tag per file.
- **T-06-02-02:** M1 and M2 were red and cmp exited 0.
- **T-06-02-03:** the cookie fake hides experiments from non-admins, and the admin control shows the difference.
- **T-06-02-04:** only synthetic `06000000-…` ids and names are used.

## Environment

- Docker and the local stack were not used by this plan; they were left as 06-01 left them (reset and seeded).
- Port 3000 is free (`lsof` exit 1).
- The two temporary measurement harnesses were deleted before any commit.

## Self-Check: PASSED

- FOUND: all 10 created files (the 9 under `src/__tests__/` and the evidence file).
- FOUND: commits 6c38659, f7bffbf, 93ce6db.
- `git diff --name-only f215fb7 HEAD -- src/app src/server src/lib supabase`: 0 files. No commit deletes a file.
- Jest 1769 passed, 1 skipped, 0 failed. Tag gate ok 42. tsc exit 0.
