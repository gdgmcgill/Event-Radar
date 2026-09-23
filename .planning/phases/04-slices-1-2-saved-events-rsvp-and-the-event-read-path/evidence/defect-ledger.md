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
| F-079 | `src/__tests__/api/events/rsvp-count-defect.test.ts` | Anonymous GET issues exactly **one** rsvps read, and it is the count read | Anonymous GET issues exactly **two** rsvps reads, and both are count reads | `d40dee4` `fix(04-05): count RSVPs with head-count queries (F-079)` | 04-05 |
| F-079 | same | The count read selects `id, status`; `options === null`; no `count`, no `head`; terminal `then` | Both count reads select `id` with `options` equal to `{ count: "exact", head: true }`; terminal `then` | `d40dee4` | 04-05 |
| F-079 | same | The count read's filters are exactly `[eq event_id, neq status cancelled]` | The two count reads' filters are `[eq event_id, eq status going]` and `[eq event_id, eq status interested]`, and there are exactly two | `d40dee4` | 04-05 |
| F-079 | same | A signed-in GET counts through exactly one unscoped row-returning `id, status` read with `options === null`, and no rsvps read carries a `count` or `head` option | A signed-in GET counts through the same two head reads. Its only row-returning rsvps read is the `user_id`-scoped `user_rsvp` lookup | `d40dee4` | 04-05 |
| F-071 | `src/__tests__/api/events/friends-defect.test.ts` | The fallback's `.in()` receives a builder: `Array.isArray(passed) === false`, and `passed.select` and `passed.eq` are functions | The fallback's `.in()` receives an array equal to the caller's followed ids (`["friend-1", "friend-2"]`), read from `user_follows` with `follower_id = caller` | `fix(04-05): pass follower ids to .in() in the friends fallback (F-071)` | 04-05 |
| F-071 | same | The fallback throws. The handler answers 200 `{ friends: [], count: 0 }` even with saved_events rows ready | The fallback answers 200 `{ friends: [<mutual follow>], count: 1 }`: of two followed users who saved the event, only the one who follows back | same | 04-05 |
| F-071 | same | `from()` calls are exactly `users, saved_events, user_follows`. The reverse-follow query is never issued | `from()` calls are `users, user_follows, saved_events, user_follows`. The reverse-follow read (`following_id = caller`) and the saved_events read (`event_id`) are both issued | same | 04-05 |
| F-071 | same | (new pin, no predecessor) | A caller who follows nobody passes `.in()` an empty array and gets `{ friends: [], count: 0 }` | same | 04-05 |

## Evidence per row

### F-079: RSVP counts loaded every row and counted in JavaScript

- **Fix.** `src/app/api/events/[id]/rsvp/route.ts` GET. The row select plus two `.filter().length` calls became two `select("id", { count: "exact", head: true })` reads in `Promise.all`, one filtered by `status = going` and one by `status = interested`. Either read's error logs `Error fetching RSVPs:` and returns the unchanged `serverError("fetch RSVPs")` bytes. Same cookie-bound client, same table, no service role (DEC-23). No migration. `events.rsvp_count` is neither adopted nor dropped.
- **Step 2, the old assertions against the fixed route:** 4 failed / 4 (`rsvp-count-defect`).
- **Step 3, the moved assertions against the fixed route:** 4 passed / 4. `npx jest --ci --selectProjects node --testPathPatterns "rsvp"` gives 38/38 across `rsvp.test.ts`, `rsvp-characterization.test.ts` and `rsvp-count-defect.test.ts`.
- **Step 4 control, the moved assertions against the pre-fix route:** 4 failed / 4. The restored route matched the fixed file under `cmp`.
- **Step 5:** `git diff --stat f5b07fa -- src/__tests__/api/events/rsvp-characterization.test.ts src/__tests__/api/events/rsvp.test.ts` is empty. The implementation-blind count test passed before and after the fix.
- **Type-check.** The throwaway tsconfig `tsc-slice1-rsvp` (the 04-02 DI-24 recipe) over both RSVP suites gives exit 0. `--listFilesOnly` lists both suites and the fake.

### F-071: the friends fallback passed a query builder where an array of ids is required

- **Fix.** `src/app/api/events/[id]/friends/route.ts`, the fallback taken when `get_friends_going_to_event` errors. The route first awaits `user_follows.select("following_id").eq("follower_id", user.id)`, maps the result to an array (empty when the read returns nothing), and passes that array to `.in("user_id", …)`. The `(supabase as any)` cast and its DEFECT comment block are gone, replaced by one line. The reverse-follow read, the mutual filter, the response shape and the outer catch are unchanged. F-074 (the RPC's grants) is Phase 5's and was not touched.
- **Step 2, the old assertions against the fixed route:** 2 failed / 5. The two defect-path tests ("receives a query builder" and "throws and answers with an empty list") went red. The mechanism, happy-path and unauthenticated tests stayed green.
- **Step 3, the moved assertions against the fixed route:** 6 passed / 6.
- **Step 4 control, the moved assertions against the pre-fix route:** 3 failed / 6. All three fallback tests went red. The restored route matched the fixed file under `cmp`.
- **Cast census.** `command grep -rn "(supabase as any)" src/app/api/` prints nothing. `command grep -rn "(supabase as any)" src/app/ | wc -l` returns 1 (`src/app/moderation/page.tsx`, F-072, Phase 5).
- **Type-check (DI-24 recipe).** A throwaway tsconfig that includes only `next-env.d.ts` and the moved suite gives exit 0, with 0 errors. `--listFilesOnly` shows the suite and the friends route in the program. The suite no longer uses `any` in code: `GET` is typed as the route's real `GET` and called with a real `NextRequest` and the two-argument route context, and the mock's `rpc` has a typed signature. For comparison, the pre-move file also reported 0 errors under the same recipe, because `let GET: any` and `{} as any` erased the calls it made.
- **Mock change.** The two `user_follows` reads (forward, then reverse) hit the same table. The builder now resolves lazily, keyed by `table.firstEqColumn`, so each read can answer differently. `postgrestIn` still runs on every `.in()` argument.

Note on the F-071 rows: the "old assertion" column quotes the suite as it stood after `fe4e9f9`, the friends seam-adoption commit. That commit added the mock builder's `.single()` and a leading `"users"` in the `from()` log, and moved nothing about the defect.
