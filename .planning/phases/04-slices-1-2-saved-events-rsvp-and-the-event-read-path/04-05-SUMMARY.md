---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
plan: 05
subsystem: api
tags: [refactor, seam-kit, rsvp, saved-events, friends, head-count, postgrest, defect-fix]

# Dependency graph
requires:
  - phase: 04-02
    provides: "the in-memory fake, four PRESERVE suites (save, saved-events, calendar, rsvp) and the F-079 DEFECT suite that this plan had to keep green or move"
  - phase: 04-03
    provides: "createRequestContext() narrowed to id, roles, onboarding_completed with no ban check; the widened lint boundary and ratchet"
  - phase: 03
    provides: "the seam kit (src/server/context.ts, authz/requireUser.ts, errors.ts, http.ts)"
provides:
  - "save, rsvp, saved-events, calendar/events and events/[id]/friends run through createRequestContext(); the four authenticated handlers deny through requireUser(ctx)"
  - "RSVP GET counts via two parallel { count: \"exact\", head: true } reads (F-079 fixed)"
  - "friends fallback passes an array of followed ids to .in() and returns mutual follows (F-071 fixed); zero (supabase as any) casts under src/app/api/"
  - "evidence/defect-ledger.md: the Phase 4 register of moved DEFECT assertions (F-079 x4, F-071 x4 rows)"
  - "friends-defect.test.ts is type-clean with no `any` (ahead of 04-06's DI-24 un-exclusion)"
affects: [04-06, 04-10, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seam adoption shape: `const ctx = await createRequestContext(); const auth = requireUser(ctx); if (!auth.ok) return auth.response;` inside the existing try, outer catch keeps its literal body"
    - "Defect-fix protocol: fix -> old DEFECT assertions red -> move -> green -> control run of moved assertions against the pre-fix route (red) -> restore + cmp"
    - "A mock builder that resolves lazily keyed by table.firstEqColumn, so two reads of one table can answer differently"

key-files:
  created:
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/slice-1-seam-adoption.txt
    - .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/defect-ledger.md
  modified:
    - src/app/api/events/[id]/save/route.ts
    - src/app/api/events/[id]/rsvp/route.ts
    - src/app/api/users/saved-events/route.ts
    - src/app/api/calendar/events/route.ts
    - src/app/api/events/[id]/friends/route.ts
    - src/__tests__/api/events/rsvp-count-defect.test.ts
    - src/__tests__/api/events/friends-defect.test.ts

key-decisions:
  - "The friends seam adoption is its own commit (fe4e9f9), not part of the four-handler adoption (a5ee4fc). friends-defect's hand-rolled mock has no .single(), so the context's profile read could not be answered without a harness change, and the adoption commit had to have an empty src/__tests__ diff"
  - "Count reads select \"id\" with head: true; errors from either read log once under the existing \"Error fetching RSVPs:\" context and return the unchanged serverError(\"fetch RSVPs\") body"
  - "REFAC-09 is NOT marked complete: its 'characterization tests pass before and after' clause includes 04-06's Playwright after-run and Slice 1 close-out (the 04-01..04-04 precedent)"

patterns-established:
  - "Every moved DEFECT assertion gets a ledger row (old, new, F-nnn, commit, plan) in evidence/defect-ledger.md; hashes are filled by the following commit"

requirements-completed: []  # REFAC-09 listed; seam + count-query clauses delivered, the 'after' close-out is 04-06

# Metrics
duration: 7min
completed: 2026-09-23
status: complete
---

# Phase 4 Plan 05: Slice 1 Refactor (Seam Adoption, F-079, F-071) Summary

**The five Slice 1 handlers now run through `createRequestContext()`. The four authenticated ones deny through `requireUser`, and no response byte changed: the 04-02 PRESERVE suites and `rsvp.test.ts` passed unedited. RSVP counts are two server-side head-counts that `max_rows` cannot truncate. The friends fallback now passes an array of ids and returns real mutual follows, and the last `(supabase as any)` under `src/app/api/` is gone. Each of these landed as its own commit, and each fix moved its DEFECT suite in the same commit.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-09-23T05:43:24Z
- **Completed:** 2026-09-23T05:50:14Z
- **Tasks:** 3 of 3, in 4 commits (Task 1 split in two; see Deviation 1)
- **Files:** 2 created, 7 modified

## Accomplishments

- **The adoption is proven byte-preserving.** In the four-handler commit, `git diff --stat f5b07fa -- src/__tests__` was empty and the Slice 1 run was 94/94, the same as before. Outer catches keep their literal `"Internal server error"` body. Helpers (`serverError`, `notFound`, `badRequest`, `forbidden`, `ok`, `created`) replaced literals only where the output strings are identical. `checkBanStatus()` is still the first statement of save POST and rsvp POST, and still absent from both DELETEs (DEC-24). RSVP GET and friends GET gained no guard.
- **F-079 is fixed with no schema change.** Two parallel `select("id", { count: "exact", head: true })` reads, one for `status = going` and one for `status = interested`. `rsvp-characterization.test.ts` pinned the response counts blind to how they are computed, and passed unedited across the change. The DEFECT suite went 4/4 red against the fix unedited, 4/4 green once moved, and 4/4 red against the pre-fix route as a control.
- **F-071 is fixed and DI-30's cast is gone.** The fallback awaits the caller's `user_follows` first and passes `.in()` an array, empty when the caller follows nobody. `command grep -rn "(supabase as any)" src/app/api/` prints nothing, and `src/app/` has exactly 1 left (moderation/page.tsx, F-072, Phase 5). The DEFECT suite went 2/5 red unedited, 6/6 green once moved, and 3/6 red against the pre-fix route.
- **friends-defect.test.ts is ready for 04-06.** `GET` is typed as the real handler and called with a real `NextRequest` and the two-argument context. There is no `any` in its code, and the DI-24 throwaway tsconfig reports 0 errors.

## Task Commits

1. **Task 1: seam adoption in save, rsvp, saved-events, calendar**: `a5ee4fc` (refactor)
2. **Task 1b: seam adoption in friends (split out)**: `fe4e9f9` (refactor)
3. **Task 2: RSVP head-count queries, F-079 DEFECT moved, ledger opened**: `d40dee4` (fix)
4. **Task 3: friends fallback array, cast removed, F-071 DEFECT moved, evidence**: `1351480` (fix)

## Files Created/Modified

- `src/app/api/events/[id]/save/route.ts`: context plus `requireUser` in both handlers; ban check first in POST only.
- `src/app/api/events/[id]/rsvp/route.ts`: GET uses the anonymous-tolerant context, with `user_rsvp` keyed on `ctx.user` and counts from the two head reads. POST and DELETE use context plus `requireUser` and the seam helpers.
- `src/app/api/users/saved-events/route.ts`, `src/app/api/calendar/events/route.ts`: context plus `requireUser`. F-085's floor, F-080's `select("*")` and F-059's `error.message` body are untouched.
- `src/app/api/events/[id]/friends/route.ts`: context with an `if (!ctx.user)` empty answer. The fallback is fixed and the cast removed.
- `src/__tests__/api/events/rsvp-count-defect.test.ts`: header kept, "Status: FIXED in 04-05" added, four assertions moved.
- `src/__tests__/api/events/friends-defect.test.ts`: header kept, status paragraph added, defect-path assertions moved, one new empty-follows pin, and a typed lazy-resolving mock.
- `evidence/slice-1-seam-adoption.txt`: the start commit, the before run, the Task 1/1b/2/3 runs, red/green/control logs, greps, and the full verification.
- `evidence/defect-ledger.md`: the protocol, 8 ledger rows, and per-finding evidence (49 lines).

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The friends seam adoption split into its own commit, with a harness-only edit to friends-defect.test.ts**
- **Found during:** Task 1.
- **Issue:** With all five handlers adopted and no test edited, `friends-defect.test.ts` went 3 failed / 2 passed. Its hand-rolled `createMockBuilder` has no `.single()`, so `createRequestContext()`'s `users` profile read threw inside the mock, and the handler's outer catch answered `{ friends: [], count: 0 }`. A real postgrest-js builder has `.single()` and returns `{ data, error }`, so no real response changed. But the plan required both an empty `src/__tests__` diff in the adoption commit and friends in that commit, and those two requirements could not both hold.
- **Fix:** `a5ee4fc` adopts the four PRESERVE-covered handlers with an empty test diff. `fe4e9f9` adopts friends and, in the suite, adds `builder.single` and a leading `"users"` in the `from()` call-log assertion. No status, body, count, friends or `.in()`-argument assertion moved there, and the F-071 pins still pinned the builder until `1351480`.
- **Consequence for acceptance wording:** `git log --format=%s -3` shows the friends adoption, F-079 and F-071. The four-handler adoption is the fourth commit back. `git log -1 --name-only` on `a5ee4fc` lists four route files, not five.
- **Commits:** `a5ee4fc`, `fe4e9f9`.

**2. [Rule 1 - Acceptance grep] A comment made `grep -c "head: true"` return 3**
- **Found during:** Task 2.
- **Fix:** The comment was reworded to "head-only COUNTs" and the local, unpushed Task 2 commit was amended (`b6c127b` became `d40dee4`). The count is now 2. This is recorded in the evidence.
- **Commit:** `d40dee4`.

**3. [Rule 2 - Proof strength] Control runs added to both fixes**
- After each DEFECT suite was moved, it was run against the pre-fix route (`git show HEAD:<route>`, restored and verified with `cmp`). F-079 went 4/4 red and F-071 went 3/6 red. The moved assertions are therefore shown to pin the fix, not just to pass. A new pin was also added for the empty-follow-list edge case.

### Measured, not a deviation

- The DI-24 recipe over the pre-move friends suite also reported 0 errors, because `let GET: any` / `{} as any` erased the calls. The plan's "give the narrowed mock type the `rpc` member it lacks" never showed up as an error. The moved file was made type-clean without `any` anyway: typed `GET`, a real `NextRequest`, and a typed `rpc` signature.
- Four RSVP/saved-events 401 paths lost their auth-error `console.warn`, as DEC-29 anticipated. The bytes are unchanged, and it is stated in `a5ee4fc`'s body.

---

**Total deviations:** 3 (1 blocking split, 1 acceptance-grep fix, 1 proof strengthening).
**Impact on plan:** No scope creep. No file under `supabase/migrations/` was touched, and neither was `events.rsvp_count`. No route signature changed, and no route outside the five was touched. No ban guard, cache header or zod was added. The local stack and port 3000 were not used.

## TDD Gate Compliance

The plan is `type: execute` with no `tdd="true"` tasks. Each fix still followed a red-first discipline on its DEFECT suite (old assertions red against the fix, then moved, then control red against the pre-fix route), as recorded in the ledger.

## Issues Encountered

- zsh's `PIPESTATUS` is lowercase, so the first before-run lost its exit code. It was re-run, `exit=0` was recorded, and the evidence notes this.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary. The fallback's new `user_follows` read uses the same cookie-bound client under RLS and is scoped to the caller.

## Next Phase Readiness

- **04-06 (Slice 1 close):** flip F-079 → `d40dee4` and F-071 → `1351480` in findings.json. The ledger rows and evidence are in `evidence/defect-ledger.md`, and 04-06 appends to it. `friends-defect.test.ts` and `rsvp-count-defect.test.ts` already type-check under the DI-24 recipe. `rsvp.test.ts` is untouched and still uses `let GET: any`, so it is 04-06's to type. The four 04-02 PRESERVE suites, `saved-events-time-floor-defect` and `fakeSupabase.ts` have an empty diff against `f5b07fa`. The Playwright after-run for Slice 1 is 04-06's. This plan didn't run it (Jest-only by design). `save-and-rsvp.spec.ts` exercises exactly these routes, so expect it at 37.
- **Header tag discipline:** both moved DEFECT headers avoid the capitalised other tag word. The tag gate reports `ok 17 files`.
- **Floors after this plan:** jest 512 passed / 5 skipped / 517 (46 passed, 1 skipped of 47 suites; +1 is the new friends pin); Playwright 37 (not re-run); lint 0 errors / 19 warnings; tsc clean; tag gate ok 17 files; ratchet committed=25 live=25 delta=0; `(supabase as any)` in `src/app/api/`: 0, in `src/app/`: 1.

## Self-Check: PASSED

- Both created evidence files and all 7 modified source/test files exist on disk.
- Commits `a5ee4fc`, `fe4e9f9`, `d40dee4` and `1351480` are in `git log`.
- Acceptance greps: `createRequestContext()` gives save 2, rsvp 3, and 1 each for saved-events, calendar and friends. `requireUser(ctx)` gives 2/2/1/1/0. `await createClient()` gives 0 in all five. `checkBanStatus()` appears once per file, in POST. `head: true` appears 2 times and `Promise.all` once in rsvp. `F-079` and `F-071` are both in the ledger.

---
*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Completed: 2026-09-23*
