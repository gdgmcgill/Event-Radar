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
| F-071 | `src/__tests__/api/events/friends-defect.test.ts` | The fallback's `.in()` receives a builder: `Array.isArray(passed) === false`, and `passed.select` and `passed.eq` are functions | The fallback's `.in()` receives an array equal to the caller's followed ids (`["friend-1", "friend-2"]`), read from `user_follows` with `follower_id = caller` | `1351480` `fix(04-05): pass follower ids to .in() in the friends fallback (F-071)` | 04-05 |
| F-071 | same | The fallback throws. The handler answers 200 `{ friends: [], count: 0 }` even with saved_events rows ready | The fallback answers 200 `{ friends: [<mutual follow>], count: 1 }`: of two followed users who saved the event, only the one who follows back | `1351480` | 04-05 |
| F-071 | same | `from()` calls are exactly `users, saved_events, user_follows`. The reverse-follow query is never issued | `from()` calls are `users, user_follows, saved_events, user_follows`. The reverse-follow read (`following_id = caller`) and the saved_events read (`event_id`) are both issued | `1351480` | 04-05 |
| F-071 | same | (new pin, no predecessor) | A caller who follows nobody passes `.in()` an empty array and gets `{ friends: [], count: 0 }` | `1351480` | 04-05 |
| F-066 | none: no DEFECT suite moved. The clause is closed by a configuration change | `tsconfig.json` `exclude` held `**/*.test.ts` and `**/*.test.tsx`, so `npx tsc --noEmit` never saw a test file (71 errors hidden in 7 suites) | The two globs are gone, and `npx tsc --noEmit` type-checks every test file with 0 errors. All 71 fixes are test-local (`evidence/tsc-tests-included.txt`). Only the type-check clause closes; the skipped-suite clause is 04-09's | `9530d35` `chore(04-06): type-check test files; …` | 04-06 |
| F-082 | `src/__tests__/api/events/search-escaping-defect.test.ts` | `search=a,b` hands `.or()` exactly `title.ilike.%a,b%,description.ilike.%a,b%` | `search=a,b` hands `.or()` exactly `title.ilike."%a,b%",description.ilike."%a,b%"` | `c20d59b` `fix(04-08): escape search input before the PostgREST or() filter (F-082)`; shipped under **DEC-32** | 04-08 |
| F-082 | same | `search=%` hands `.or()` exactly `title.ilike.%%%,description.ilike.%%%` | `search=%` hands `.or()` exactly `title.ilike."%\\%%",description.ilike."%\\%%"` (two backslashes at runtime) | `c20d59b` (DEC-32) | 04-08 |
| F-082 | same | `search=_` hands `.or()` exactly `title.ilike.%_%,description.ilike.%_%` | `search=_` hands `.or()` exactly `title.ilike."%\\_%",description.ilike."%\\_%"` | `c20d59b` (DEC-32) | 04-08 |
| F-082 | same | The comma is unquoted: the expression splits into four pieces `title.ilike.%a`, `b%`, `description.ilike.%a`, `b%` and contains no `"` | The comma is quoted: the expression is two quoted conditions, splits on `",` into exactly two, and contains `"` | `c20d59b` (DEC-32) | 04-08 |
| F-082 | `src/__tests__/api/events/get-events.test.ts` ("calls or() with ilike when search parameter is provided") | `or` called with `title.ilike.%hackathon%,description.ilike.%hackathon%` | `or` called with `title.ilike."%hackathon%",description.ilike."%hackathon%"` | `c20d59b` (DEC-32) | 04-08 |
| F-082 | `e2e/specs/event-read-path.spec.ts` test 6 | `DEFECT F-082`: `search=a,b` → 500 whose `error` contains "failed to parse logic tree" | `FIXED F-082`: `search=a,b` → 200, `events` is `[]`, `total` is 0 | `c20d59b` (DEC-32) | 04-08 |
| F-082 | `e2e/specs/event-read-path.spec.ts` test 7 | `DEFECT F-082`: `search=%` → 200, `total` 2, both approved event ids | `FIXED F-082`: `search=%` → 200, `total` 0, `events` is `[]` | `c20d59b` (DEC-32) | 04-08 |

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

### F-082: search input reached the PostgREST or() logic tree unescaped

- **Decision it shipped under: DEC-32, not the 04-11 owner checkpoint.** DEC-32's rule: a seeded-visible fix goes to the checkpoint when its ROADMAP clause can be delivered, fully or in part, without the visible change, and ships under a numbered decision only when no delivery of the clause leaves seeded output unchanged. ROADMAP criterion 3 says "`%` and `_` are escaped in search input", and every implementation of that changes what a `%` search returns. `evidence/phase-04-decisions.md` § DEC-32 carried no owner override paragraph when 04-08 started, so the plan ran.
- **Fix.** `src/app/api/events/route.ts`, the ILIKE fallback in the fuzzy RPC's error branch (the only live search path while F-078 makes the RPC fail). The raw interpolation became `[ilikeContainsFilter("title", search), ilikeContainsFilter("description", search)].join(",")`. `src/lib/searchFilter.ts` exports `escapeLikeLiteral` (backslash, `%`, `_` made LIKE-literal with a backslash; Postgres's default LIKE escape, since PostgREST exposes no `ESCAPE`), `postgrestQuotedValue` (backslash and `"` escaped, value wrapped in double quotes) and `ilikeContainsFilter`. 29 unit tests, one per character per export. The fuzzy-success path, the date floor, the tags filter, pagination, the Cache-Control header and the F-059 error branch are unchanged.
- **Special-character behaviour change, stated.** On seeded data, a search for `%` or `_` returned both approved events before and returns none after, because no seeded title or description contains either character. A search for `a,b` moves from an API 500 that echoed the internal filter to a 200 with an empty list; the feed renders the same "No events found" state both times (PRESERVE test 3 passed before and after). The terms whose results change are exactly those containing `%`, `_`, backslash, comma, a parenthesis or a double quote. **Plain-text search is unchanged:** `events-list-characterization.test.ts` passed unmodified (`git diff --stat HEAD~1` on it is empty), and the "Music Night" Playwright PRESERVE test passed in `evidence/playwright.escaping.txt`.
- **Step 2, the old assertions against the fixed route:** the pre-fix `search-escaping-defect.test.ts` and `get-events.test.ts`, run as temporary copies against the fixed route: 5 failed (the four F-082 assertions and the hackathon assertion). The F-059 echo test and every other test passed.
- **Step 3, the moved assertions against the fixed route:** `npx jest --ci --selectProjects node --testPathPatterns "searchFilter|search-escaping-defect|get-events|events-list-characterization"`: 90 passed, 1 skipped (the pre-existing skip in `get-events.test.ts`).
- **Step 4 control, the moved assertions against the pre-fix route:** 5 failed (the same five), `events-list-characterization.test.ts` passed. The restored route matched `HEAD` under `cmp`.
- **Step 5:** `events-list-characterization.test.ts` passed unedited against both routes. The F-059 echo assertion (a PGRST100 injected through the fake still comes back as a 500 with the message verbatim) did **not** move: the echo branch is F-059's and Phase 5's. 04-08 removes its trigger; it does not claim to fix it.
- **Playwright (real parser).** Tests 6 and 7 were retitled `FIXED F-082` and pass against local PostgREST; 37 passed / 0 failed, equal to 04-06's count. The whole server log in that run contains no "failed to parse logic tree".
- **Research assumption A2 closed by measurement.** `scripts/probes/search-escape-probe.ts` (local only, `assertSeedTargetAllowed` before any client) inserted five approved rows in the `e5ca9e00-…` namespace whose titles carry `100%`, `under_score`, a `"`, a backslash and `comma, paren (x)`. It then queried them through `ilikeContainsFilter` with the anon client. `100%`, bare `%`, `_`, `"`, backslash and `comma, paren (x)` each matched exactly their own row: 6 PASS, 0 request errors, and no seeded row matched any of them. The rows were deleted in a `finally`, and an anon read confirmed 0 remain (`evidence/search-escape-probe.txt`, `exit=0`, PostgREST `v16.1`).
- **`*` knowingly out of scope:** PostgREST rewrites `*` to `%` inside like/ilike values regardless of quoting or backslashes (PostgREST `src/library/PostgREST/Query/SqlFragment.hs`, the `star` mapping on OpLike/OpILike), so no ilike pattern can express a literal `*`. Behaviour for `*` is unchanged from before 04-08: `escapeLikeLiteral` leaves it untouched, and a unit test pins that. ROADMAP criterion 3 names only `%` and `_`. The probe's KNOWN row pins it: a bare `*` matched all five probe rows and both seeded approved events. The natural owner is F-078's Phase 5 fix of the fuzzy RPC, which takes the term as an RPC argument and bypasses the rewrite. Threat T-04-08-06 (accept) and DEC-32 § (e) record the same disposition.
- **Register.** F-082's status in `.planning/audit/findings.json` is not flipped here. Per the phase plan, 04-11 flips it and records it as shipped under DEC-32.

## Register flips (04-06)

Plan 04-06 applied the status changes that this ledger defers, citing `evidence/slice-1-close.md`:

- F-079: `Open` -> `Fixed`, with a resolution naming `d40dee4` and the moved `rsvp-count-defect.test.ts`.
- F-071: `Open` -> `Fixed`, with a resolution naming `1351480` and the moved `friends-defect.test.ts`.
- F-066: stays `Open`. Its resolution now records that the type-check clause was met by `9530d35`. The same edit merged the record's two duplicate `resolution` keys, which had hidden the Phase 3 paragraph from every JSON parser.

`node .planning/audit/tools/validate.mjs --check findings` passes 8/8, and `FOUNDATION_AUDIT.md` was regenerated by its generator (Open 73 -> 71, Fixed 12 -> 14).
