# Defect ledger — Phase 4

Opened by plan 04-05 on 2026-09-23. One row per DEFECT assertion that moved because the defect it pinned was deliberately fixed. Each row's assertions moved in the same commit as the fix. The finding's status in `.planning/audit/findings.json` is flipped in 04-06, not here.

Protocol followed for every row:

1. Apply the fix to the route.
2. Run the DEFECT suite unedited. It must go red (the before-assertions fail against the fixed route).
3. Move the assertions to the fixed shape. The suite must go green.
4. Put the pre-fix route back temporarily and run the moved suite. It must go red (the after-assertions fail against the defect). Then restore the fixed route and check it is byte-identical (`cmp`).
5. The response-level suites (PRESERVE, `rsvp.test.ts`) must pass unedited throughout.

Commit hashes are filled in by the commit that follows each fix, because a commit cannot name its own hash.

## Ledger

| F-nnn | Suite | Old assertion (pinned the defect) | New assertion (pins the fix) | Commit | Plan |
|-------|-------|-----------------------------------|------------------------------|--------|------|
| F-079 | `src/__tests__/api/events/rsvp-count-defect.test.ts` | Anonymous GET issues exactly **one** rsvps read, and it is the count read | Anonymous GET issues exactly **two** rsvps reads, and both are count reads | `fix(04-05): count RSVPs with head-count queries (F-079)` | 04-05 |
| F-079 | same | The count read selects `id, status`; `options === null`; no `count`, no `head`; terminal `then` | Both count reads select `id` with `options` equal to `{ count: "exact", head: true }`; terminal `then` | same | 04-05 |
| F-079 | same | The count read's filters are exactly `[eq event_id, neq status cancelled]` | The two count reads' filters are `[eq event_id, eq status going]` and `[eq event_id, eq status interested]`, and there are exactly two | same | 04-05 |
| F-079 | same | A signed-in GET counts through exactly one unscoped row-returning `id, status` read with `options === null`, and no rsvps read carries a `count` or `head` option | A signed-in GET counts through the same two head reads. Its only row-returning rsvps read is the `user_id`-scoped `user_rsvp` lookup | same | 04-05 |

## Evidence per row

### F-079: RSVP counts loaded every row and counted in JavaScript

- **Fix.** `src/app/api/events/[id]/rsvp/route.ts` GET. The row select plus two `.filter().length` calls became two `select("id", { count: "exact", head: true })` reads in `Promise.all`, one filtered by `status = going` and one by `status = interested`. Either read's error logs `Error fetching RSVPs:` and returns the unchanged `serverError("fetch RSVPs")` bytes. Same cookie-bound client, same table, no service role (DEC-23). No migration. `events.rsvp_count` is neither adopted nor dropped.
- **Step 2, the old assertions against the fixed route:** 4 failed / 4 (`rsvp-count-defect`).
- **Step 3, the moved assertions against the fixed route:** 4 passed / 4. `npx jest --ci --selectProjects node --testPathPatterns "rsvp"` gives 38/38 across `rsvp.test.ts`, `rsvp-characterization.test.ts` and `rsvp-count-defect.test.ts`.
- **Step 4 control, the moved assertions against the pre-fix route:** 4 failed / 4. The restored route matched the fixed file under `cmp`.
- **Step 5:** `git diff --stat f5b07fa -- src/__tests__/api/events/rsvp-characterization.test.ts src/__tests__/api/events/rsvp.test.ts` is empty. The implementation-blind count test passed before and after the fix.
- **Type-check.** The throwaway tsconfig `tsc-slice1-rsvp` (the 04-02 DI-24 recipe) over both RSVP suites gives exit 0. `--listFilesOnly` lists both suites and the fake.
