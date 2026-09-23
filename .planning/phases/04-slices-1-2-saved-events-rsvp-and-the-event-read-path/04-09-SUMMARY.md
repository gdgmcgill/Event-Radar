---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 09
subsystem: api
status: complete
tags: [pagination, keyset, cursor, postgrest, events, F-083, F-066, DEC-25, REFAC-10]

# Dependency graph
requires:
  - phase: 04-08
    provides: "src/lib/searchFilter.ts (postgrestQuotedValue, ilikeContainsFilter); escaped search fallback in the events list route"
  - phase: 04-04
    provides: "F-083 DEFECT suite and e2e test 5; events-list PRESERVE suite matched with toMatchObject on the five keys"
  - phase: 04-06
    provides: "test files type-checked (F-066's second clause)"
provides:
  - "src/lib/eventCursor.ts: EventCursor, encodeEventCursor, decodeEventCursor"
  - "GET /api/events: DEC-25 keyset cursor contract (nextCursor/prevCursor, (start_date, id) order, 400 Invalid cursor)"
  - "src/app/api/events/route.test.ts: a running PRESERVE contract suite (19 tests) with a check derived from the hook's source"
  - "Jest with zero skipped suites and zero skipped tests (F-066's first clause)"
  - "Playwright PRESERVE cursor traversals against the real PostgREST (tests 10-12)"
affects: [04-10, 04-11, phase-05, phase-06, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolve every filter to data first, then apply it through one generic applyEventListFilters<Q> so the main query and the head count cannot drift"
    - "Keyset or() over (start_date, id), with both values wrapped by postgrestQuotedValue; the total comes from a parallel head count without the keyset"
    - "A contract test that reads the client hook's source at test time and asserts every data.<field> it reads is a response key"
    - "An opaque-token decoder that returns null for anything its encoder could not produce (strict base64, canonical UUID, ISO timestamp, metacharacter deny-list)"

key-files:
  created:
    - src/lib/eventCursor.ts
    - src/lib/eventCursor.test.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/pagination-contract.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.pagination.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/playwright.pagination.run1-flake.txt
  modified:
    - src/app/api/events/route.ts
    - src/app/api/events/route.test.ts
    - src/__tests__/api/events/pagination-contract-defect.test.ts
    - src/__tests__/api/events/get-events.test.ts
    - e2e/specs/event-read-path.spec.ts
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/deferred-items.md
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md

key-decisions:
  - "DEC-25 executed as written. No owner override paragraph existed under DEC-25 when 04-09 started"
  - "In the fuzzy-rank path a supplied cursor is ignored (page mode) and both cursors are null, because a rank order has no (start_date, id) position"
  - "An empty cursor= is treated as absent (useEvents never sends one); any non-empty value the decoder rejects is 400"
  - "A head-count error in cursor mode is 500 { error: 'Failed to fetch events' }; the main query's error handling is unchanged"
  - "route.test.ts is tagged PRESERVE (citing F-083): it pins DEC-25 from here on, and the tag gate discovers it by content"
  - "The composite (start_date, id) index for approved, non-deleted events is recorded as an F-083 follow-up; no migration in Phase 4"

patterns-established:
  - "Contract suites use a recording mock when the in-memory fake cannot evaluate the operator under test (or()); the real-parser behaviour is proven in Playwright"
  - "Flaky e2e evidence is kept as its own file, and the flake is attributed by an A/B repeat against the pre-change code before it is logged"

requirements-completed: []  # REFAC-10 is not marked complete: 04-10 and 04-11 still carry its remaining clauses

# Metrics
duration: 15min
completed: 2026-09-23
---

# Phase 4 Plan 09: Keyset Cursor Pagination Contract (F-083, F-066) Summary

**`GET /api/events` now uses the keyset cursor that `useEvents` has always sent: base64 `{ sortValue, id }`, `(start_date, id)` ordering, quoted keyset `or()`, and a head-count `total`. The skipped contract suite is rewritten and running, so Jest reports zero skipped suites and tests.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-09-23T22:18:09Z
- **Completed:** 2026-09-23T22:32:36Z
- **Tasks:** 3
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments

- **The cursor codec.** `src/lib/eventCursor.ts` encodes base64 of JSON `{ sortValue, id }`, byte-compatible with the old suite's helpers. The decoder never throws. It returns null unless the token is standard base64 of at most 512 characters, `id` is a canonical UUID, and `sortValue` is an ISO date or timestamp that `Date.parse` accepts, with no `,`, `(`, `)`, `"` or `\`. V8's `Date.parse` accepts "Feb 2, 2026", so the parse alone is not enough; a test pins that. There are 33 unit tests.
- **The route speaks DEC-25.**
  - A cursor the decoder rejects gets 400 `{ error: "Invalid cursor" }` before any query or RPC.
  - Every request orders by `start_date`, then `id`.
  - Page mode is unchanged (same range, `total`, `page`, `limit`, `totalPages`). It also emits a `nextCursor` naming the last row while rows remain.
  - Cursor mode adds `start_date.gt."v",and(start_date.eq."v",id.gt."id")` with both values wrapped by `postgrestQuotedValue`, and asks for rows 0 through limit-1. `total` comes from a parallel `select("id", { count: "exact", head: true })` that carries every filter except the keyset.
  - Filters go through one `applyEventListFilters`, in the handler's historical order.
  - The fuzzy path, both early returns and the benign-error branch emit null cursors.
  - Cache-Control, the fuzzy re-sort, 04-08's search fallback and every error body are unchanged.
- **The contract suite runs.** `src/app/api/events/route.test.ts` was rewritten, not revived (T-01-11-04), and tagged PRESERVE. It has 19 tests. One of them reads `src/hooks/useEvents.ts` at test time and asserts that every `data.<field>` the hook reads is a response key. Four mutation cycles each turned it red: dropping the tie-break, taking the total from the keyset count, an unquoted keyset, and a missing `nextCursor`.
- **Proven against the real PostgREST.** Playwright tests 10-12 walk both seeded approved events by cursor, with and without `search=Seed`, which shows the search `or()` and the keyset `or()` AND together. They also get a 400 for a bad cursor. Result: 40 passed, 0 failed.
- **F-066's first clause is met.** `npx jest --ci`: 50 of 50 suites, 717 passed, 0 skipped. The floor was 48 + 1 skipped of 49 suites, and 664 passed / 5 skipped.

## Task Commits

1. **Task 1: cursor codec**: `38a7091` (feat). RED was observed first (module not found), then GREEN at 33 tests.
2. **Task 2: keyset route, rewritten suite, moved F-083 pins**: `ea71bb6` (fix): `fix(04-09): implement the cursor contract the client already speaks (F-083, F-066)`
3. **Task 3: Playwright traversal and the recorded fix**: `b237c14` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `src/lib/eventCursor.ts` / `.test.ts`: the codec and its 33 tests.
- `src/app/api/events/route.ts`: cursor validation, `(start_date, id)` order, `applyEventListFilters`, keyset and head count, cursor keys on every 200 body, swagger updated for `cursor`, `nextCursor`, `prevCursor` and 400.
- `src/app/api/events/route.test.ts`: rewritten as a running PRESERVE contract suite.
- `src/__tests__/api/events/pagination-contract-defect.test.ts`: all 7 assertions moved to the fixed contract. It keeps its DEFECT tag and F-083 citation, and gained a "Status: FIXED in 04-09" paragraph.
- `src/__tests__/api/events/get-events.test.ts`: the key set is now seven keys, and the skipped status test is revived.
- `e2e/specs/event-read-path.spec.ts`: test 5 is now `FIXED F-083`, and tests 10-12 (PRESERVE) were added.
- Evidence: `pagination-contract.txt`, `playwright.pagination.txt` (run 2, 40/0), `playwright.pagination.run1-flake.txt` (run 1, 39/1), and the ledger rows (9 for F-083, 2 for F-066).
- `deferred-items.md`: DI-24 is closed in full, and DI-38 was added.
- `findings.json`: F-066's single `resolution` key now records that the skipped-suite clause is met. Its status stays Open, because the flip is 04-11's. `FOUNDATION_AUDIT.md` was regenerated, and `validate --check findings` passes 8/8.

## Decisions Made

- DEC-25 was executed as written. Its section had no owner override.
- **Fuzzy path with a cursor.** The cursor is ignored (page mode), there is no keyset and no head count, and both cursors are null. A rank order has no `(start_date, id)` position. The path is dead today (F-078, Phase 5).
- **`cursor=` (empty) counts as absent**, mirroring the hook's own truthiness check.
- **Head-count failure** in cursor mode is a 500 with the generic "Failed to fetch events". The benign-error branch in cursor mode reports the head-count `total`.
- **`route.test.ts` is tagged PRESERVE (F-083).** Its docblock mentions "characterization", so the tag gate discovers it, and it does pin DEC-25 for every later refactor. The tag gate now reports 18 files instead of 17.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The tag gate failed on the rewritten suite**
- **Found during:** Task 2 verification (`check-characterization-tags.mjs --all` failed on 1 of 18 files).
- **Issue:** The new docblock names `events-list-characterization.test.ts`, so the gate discovers the file by content and requires a PRESERVE or DEFECT tag.
- **Fix:** The suite is tagged PRESERVE, citing F-083. The same edit reworded the docblock's literal `describe.skip` to "a skipped describe", so the plan's skip-grep reports 0.
- **Files modified:** `src/app/api/events/route.test.ts`
- **Commit:** `ea71bb6`

**2. [Rule 3 - Blocking] The Playwright run hit a pre-existing flake in an unrelated spec**
- **Found during:** Task 3. Run 1 gave 39 passed / 1 failed, in `save-and-rsvp.spec.ts:53`: `response.json` found no body because the page had navigated away.
- **Fix:** The failed run is kept as `playwright.pagination.run1-flake.txt`. After a fresh reset and seed, run 2 gave 40/0 (`playwright.pagination.txt`). The flake was attributed by repeating that one test 10 times: 5 of 10 hit the protocol error against the 04-09 route, and 3 of 10 against the pre-04-09 route (swapped in temporarily and restored under `cmp`). It is logged as **DI-38**. The spec was not changed, because it is out of this plan's scope.
- **Commit:** `b237c14`

**3. [Scope note] Two pre-fix DEFECT assertions stayed green against the fixed route**
- "The first rows come back" and "rows 0 through limit-1" still passed after the fix. The fake records an `or()` without evaluating it, and the cursor-mode window really is rows 0 through limit-1. Both moved to assertions on the keyset `or()` and the head count. The ledger records 5 of 7 red after the fix (Step 2) and 7 of 7 red for the moved suite against the pre-fix route (Step 4).

**4. [Evidence] `findings.json` was edited as text, not re-serialized**
- A first attempt re-serialized the file with `JSON.stringify` and reformatted 1,337 lines. That single file was reverted with `git checkout --`, and the resolution was appended at its unique closing anchor, for a 1-line diff.

---

**Total deviations:** 2 auto-fixed (both Rule 3) and 2 scope/evidence notes. **Impact:** none on the contract. The tag count rose to 18. DI-38 is new and pre-existing.

## Issues Encountered

- `get-events.test.ts`'s skipped test ("route no longer uses eq() for status filtering") had a false skip reason. The route has always called `.eq('status', 'approved')`, and the test passes. It was revived, and the commit body records why.

## Known Stubs

None. The `nextCursor: null` / `prevCursor: null` values in the early returns and the benign branch are the specified contract, not placeholders.

## Threat Flags

None. The new surface (the `cursor` query parameter reaching a PostgREST `or()`) is T-04-09-01 in the plan's threat model. It is mitigated by the decoder (canonical UUID, ISO timestamp, metacharacter deny-list, length cap), by `postgrestQuotedValue` on both values, and by the 400 before any query. The approved/deleted_at filters apply to the head count too (T-04-09-03).

## User Setup Required

None.

## Next Phase Readiness

- **04-10:** `src/app/api/events/route.ts` now filters through `applyEventListFilters` and builds cursors from raw rows before the transform. F-080's select-string change (DEC-27) goes in the main query's `.select(...)` only. The head count selects `id` and should stay that way. `events-list-characterization`, `pagination-contract-defect` and `route.test.ts` all match bodies on keys that 04-10 does not touch. `route.test.ts` mocks `@/lib/tagMapping` as identity.
- **04-11:**
  - Flip F-083 to Fixed (commit `ea71bb6`, DEC-25) and F-066 to Fixed. Both clauses are met: `9530d35` and `ea71bb6`. F-066's resolution already says so.
  - Carry the composite-index follow-up (`evidence/pagination-contract.txt` § 4) into F-083's resolution, with Phase 8 as owner.
  - DI-38 (the save-and-rsvp reload race) is assigned to 04-11 or Phase 5. It can fail the final Playwright floor on an unlucky run.
  - The tag gate floor is now **ok 18 files**.
- **Phase 5 (F-078):** once the fuzzy RPC works, a searched feed pages by `page`/`limit` with null cursors. The keyset for a rank order needs its own key.
- **Floors after this plan:**
  - Jest: **717 passed / 0 skipped / 717**, 50 of 50 suites (+53 tests, +1 suite, -1 skipped suite, -5 skipped tests)
  - tsc: clean, tests included
  - Lint: 0 errors / 19 warnings
  - Tag gate: `ok 18 files`
  - Ratchet: `committed=25 live=25 delta=0`
  - Playwright: **40** passed
- **Local stack:** reset and re-seeded after the last Playwright run (10 personas, 5 clubs, 5 events, 2 RSVPs, 0 saved events). Port 3000 is free (`lsof` exit=1).
- **Guards:** `git diff --name-only da13308 -- src/hooks src/app/page.tsx supabase/migrations` is empty.

## Self-Check: PASSED

- FOUND: src/lib/eventCursor.ts (111 lines, min 30), src/lib/eventCursor.test.ts, src/app/api/events/route.ts, src/app/api/events/route.test.ts (478 lines, min 120), evidence/pagination-contract.txt, evidence/playwright.pagination.txt, evidence/playwright.pagination.run1-flake.txt
- FOUND: commits 38a7091, ea71bb6, b237c14
- `playwright.pagination.txt` ends with `exit=0`, 40 passed, 0 failed (37 + 3). `pagination-contract.txt` contains the jest summary and "composite index". The ledger has 12 F-083 mentions and 7 F-066 mentions. No tracked file was deleted since `da13308`.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 09*
