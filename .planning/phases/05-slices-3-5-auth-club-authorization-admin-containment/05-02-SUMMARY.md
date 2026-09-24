---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 02
subsystem: testing
tags: [jest, characterization, proxy, auth-callback, mutation-testing, open-redirect]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-01: F-086..F-091 registered (the tag gate accepts F-088/F-089), DEC-33..DEC-57, before-floor (Jest 744, tag gate ok 18, env ! census 15, getSession( census 1)"
provides:
  - "PRESERVE net for the proxy ring (24 tests), mocked at @supabase/ssr, PROTECTED_ROUTES re-derived from the source literal"
  - "DEFECT pins F-003/F-062/F-088/F-089 for the proxy (8 tests), Status OPEN until 05-05's proxy commit"
  - "DEFECT pins F-077 for the callback next target: absolute, protocol-relative and slash-backslash all measured off-origin; same-origin control"
  - "Machine census of the 15 process.env non-null assertions (F-003 config half), shrinks in 05-04 and empties in 05-05"
  - "PRESERVE gate: the only production getSession( call is api/health; context.ts and proxy.ts call auth.getUser("
  - "17 mutation cycles proving every new pin bites, plus two controls showing the fix shapes move no PRESERVE assertion"
affects: [05-04, 05-05, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proxy characterization mocks @supabase/ssr with a scripted client whose users read returns the full persona row regardless of the column string, so the suite survives 05-05 changing the select"
    - "Census tests walk src/ with fs (skip *.test.ts(x) and __tests__/) and pin an exact sorted list, duplicates kept"
    - "Mutation driver with CONTROL cycles: apply the fix shape and show only DEFECT assertions go red"

key-files:
  created:
    - src/proxy-characterization.test.ts
    - src/proxy-defect.test.ts
    - src/app/auth/callback/route-defect.test.ts
    - src/lib/__tests__/env-assertions-defect.test.ts
    - src/server/__tests__/getsession-gate.test.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-characterization-ring.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-3-mutation-check-ring.txt
  modified: []

key-decisions:
  - "Kept capitalized tag words out of cross-references so each file's gate tag is exactly its role (PRESERVE files never read as PRESERVE+DEFECT, DEFECT files never as PRESERVE+DEFECT)"
  - "Env census pins file:VARIABLE pairs with duplicates, not line numbers, so reformatting does not redden it but adding or removing an assertion does"
  - "The plan's diff-stat pathspec (src/app, src/lib) necessarily lists this plan's own new test files; the no-production-change claim is proven with the same pathspec excluding *.test.ts(x), plus name-status showing only A lines under src/ and supabase/"

patterns-established:
  - "Every ring pin is mutation-checked against a SOURCE edit, never a test edit, restored with git checkout -- and git diff --exit-code 0"
  - "Fix-shape CONTROL cycles (5c, 6b) show which assertions a fix may move before the fix is written"

requirements-completed: []  # REFAC-11 is characterized here, not delivered; 05-05 closes the ring clauses

# Metrics
duration: 9min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 02: Auth Ring Characterization Summary

**The proxy, the callback redirect target, the env assertions and the session accessor are now pinned by five Jest suites (41 tests) written against unmodified source. Seventeen source-mutation cycles show every pin goes red when its behaviour is removed. Two control cycles show the planned fix shapes move only DEFECT assertions.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-09-24T04:38:50Z
- **Completed:** 2026-09-24T04:47:30Z
- **Tasks:** 3 of 3
- **Files created:** 7 (5 test suites, 2 evidence files); no file modified

## Accomplishments

- **Proxy PRESERVE net** (`src/proxy-characterization.test.ts`, 24 tests):
  - Anonymous 307 to `/?signin=required&next=<encodeURIComponent(path)>` on all eight `PROTECTED_ROUTES`, which are parsed from the `src/proxy.ts` literal with the `e2e/fixtures.ts` regex, and on `/profile/edit`. `/profiles` is not redirected.
  - Public pass-through on `/` and `/api/events`.
  - An active user gets exactly one `users` read, keyed on `("id", id)`.
  - Permanent and active suspensions get a 307 to `/banned` with `?x=1` preserved. An expired suspension is admitted.
  - `/banned` and `/auth/signout` do no `users` read.
  - The onboarding redirect is pinned with its three exemptions.
  - The 31st POST gets a 429 before any Supabase client is constructed.
- **Proxy DEFECT pins** (`src/proxy-defect.test.ts`, 8 tests). Each title starts with its finding id:
  - F-003: env unset means pass-through, and no client is built.
  - F-088: the catch passes through and logs `[Middleware] Error:`. A users read failing with XX000 is admitted. A PGRST116 no-row result is admitted on both the API and page paths, with no sign-out.
  - F-062: a banned `/api/*` POST gets a 307 to `/banned`.
  - F-089: removing the cookie means pass-through, and a stale cookie on an onboarded user still redirects.
- **Callback F-077 pins** (`route-defect.test.ts`, 4 tests). The three hostile values were measured with a node probe first, and all resolve to `https://evil.test/x`. The same-origin control is `/my-events` on `callback.test`. `route.test.ts` is untouched and still 8/8.
- **Env census** (`env-assertions-defect.test.ts`): 15 `file:VARIABLE` pairs across six files, derived from `command grep -rnoE`. This matches the research and the before-floor exactly.
- **getSession gate** (`getsession-gate.test.ts`): the only caller set is `["src/app/api/health/route.ts"]`, and both `context.ts` and `proxy.ts` call `auth.getUser(`.
- **Floor after:** Jest 785/785 in 55 suites (744 + 41), tag gate ok 23 (18 + 5), tsc 0, lint 0 errors / 19 warnings (unchanged).

## Task Commits

1. **Task 1: proxy ring PRESERVE and DEFECT suites.** `e75cb27` (test)
2. **Task 2: callback F-077, env census, getSession gate.** `c163b2c` (test)
3. **Task 3: mutation evidence, unmodified proof, tag gate.** `d5c116e` (docs)

**Plan metadata:** the final docs commit (SUMMARY, STATE, ROADMAP)

## Files Created/Modified

- `src/proxy-characterization.test.ts`: the proxy PRESERVE suite
- `src/proxy-defect.test.ts`: the proxy DEFECT suite for F-003/F-062/F-088/F-089
- `src/app/auth/callback/route-defect.test.ts`: the DEFECT suite for F-077. It receives the moved F-004 tests in 05-05
- `src/lib/__tests__/env-assertions-defect.test.ts`: the DEFECT census for F-003's config half
- `src/server/__tests__/getsession-gate.test.ts`: the PRESERVE gate for REFAC-11 clause 1
- `evidence/slice-3-characterization-ring.txt`: the Task 1-3 runs, the node probe, the grep census next to the pinned list, and the no-change proof
- `evidence/slice-3-mutation-check-ring.txt`: 17 cycles, verbatim

## Mutation cycles (evidence/slice-3-mutation-check-ring.txt)

| Cycle | Source mutation | Went red |
|---|---|---|
| 1 | proxy: delete `searchParams.set("next", path)` | PRESERVE 1, all 9 routes |
| 2 | proxy: banned pathname becomes `/` | PRESERVE 4, both personas |
| 2b | proxy: expiry comparison inverted | PRESERVE 4 (suspended) and 5 |
| 2c | proxy: `/auth/signout` removed from ban exemptions | PRESERVE 6 (signout) |
| 3 | proxy: `path !== "/onboarding"` inverted | PRESERVE 7 (`/` redirect, `/onboarding` exemption) |
| 3b | proxy: limiter moved after client construction | PRESERVE 8 |
| 4 | proxy: env pass-through becomes a throw | DEFECT a (F-003) |
| 5 | proxy: catch rethrows | DEFECT b (F-088) |
| 5b | proxy: null profile counted as banned | DEFECT c, d×2 (F-088) |
| 5c | CONTROL: banned `/api/*` answered 403 JSON | DEFECT e only; all 24 PRESERVE stay green |
| 5d | proxy: onboarding predicate ignores cookie | DEFECT g (F-089) |
| 5e | proxy: onboarding predicate always true | DEFECT f (F-089), plus c and d-GET as explained in the file |
| 6 | callback: `next` becomes the constant `/` | F-077, all four cases |
| 6b | CONTROL: a fixed next rule (`/`-prefixed, not `//`, not `/\`) | the 3 hostile cases only; control and 8 PRESERVE stay green |
| 6c | MEASUREMENT: F-077's register fix exactly as worded | absolute and protocol-relative only. The slash-backslash case stays off-origin |
| 7 | server.ts: one `!` removed | env census |
| 8 | new `src/tmp-getsession-probe.ts` with `getSession(` | getSession gate. The file was deleted and `git status --porcelain -- src/` is empty |

Every edit cycle ends with `git_diff_exit=0`, and the final check over the three mutated files is also 0.

## Decisions Made

- **Tag words in cross-references.** The first drafts made the gate report `PRESERVE+DEFECT` for both proxy files, because each docblock named the other file's tag in capitals. The prose was reworded so the PRESERVE file tags only PRESERVE and the DEFECT file only DEFECT. The gate passes either way; the change keeps each file's tag equal to its role.
- **The census pins pairs, not lines.** `file:VARIABLE`, sorted, with duplicates kept, because the callback and auth-debug each assert the URL twice.
- **Persona ids are synthetic** (`…0a01`–`…0a05`, `…0b01`–`…0b05`). They are not seed ids, so no test depends on the seed.

## Deviations from Plan

### Rule-resolved choices

**1. The plan's diff command cannot print nothing.** The slice outcome and Task 3 action ask that `git diff --stat <05-01 head> -- src/proxy.ts src/proxy.test.ts src/app src/lib src/server/context.ts` print nothing. But the plan's own files_modified puts `route-defect.test.ts` under `src/app` and `env-assertions-defect.test.ts` under `src/lib`, so that pathspec lists those two added test files. The evidence records the command verbatim with its two-line output. It also records the same pathspec excluding `*.test.ts(x)`, which is empty (exit 0). `git diff --name-status a7b02a5 -- src/ supabase/` shows only five `A` lines. No production file under `src/` and nothing under `supabase/` was modified. The intent of the criterion (source unmodified) is met; its literal wording was not satisfiable.

**2. Nine cycles beyond the plan's eight.** Cycles 2b, 2c, 3b, 5b, 5d and 5e each cover a pin that the named eight leave unexercised: expired suspension, the signout exemption, limiter order, the fail-open read, the stale cookie and the deleted cookie. Controls 5c and 6b and measurement 6c were added so 05-05 can see what its fix may and may not move. This adds evidence only; no test or source changed.

**3. The DEFECT suite's F-088 case b uses `/profile`.** The plan does not name a path for that case. `/profile` is a protected path, so the pass-through is visible as the missing sign-in redirect.

### Auto-fixed Issues

**1. [Rule 1 - Bug] An ESC byte in the mutation evidence header**
- **Found during:** Task 3
- **Issue:** the shell's `echo` interpreted `\e` in the text `next=/\evil.test/x` as an escape, which wrote a raw 0x1B byte into the 6c paragraph.
- **Fix:** replaced it with the literal text, then scanned both evidence files for control characters (none left). The driver's own output was never affected.
- **Files modified:** `evidence/slice-3-mutation-check-ring.txt` (before its commit)
- **Commit:** `d5c116e`

## Observations for later plans

- **The F-077 `recommended_fix` in findings.json is incomplete.** Cycle 6c applied it exactly as worded (`raw.startsWith("/") && !raw.startsWith("//")`). `next=/\evil.test/x` still redirected to `https://evil.test/x`, because WHATWG URL parsing treats `\` as `/` for special schemes. 05-05's plan already covers this: its line 150 rejects a backslash as the second character, requires a same-origin result, and T-05-05-03 names slash-backslash. So this is not a deferred item. The `route-defect.test.ts` slash-backslash case is the pin that would catch a fix that followed the register text alone.
- **05-05 flips:** the F-062 fix shape (cycle 5c) moves DEFECT e and no PRESERVE proxy assertion. A correct F-077 rule (cycle 6b) moves only the three hostile cases.
- **PRESERVE case 6 pins "no users read" on `/banned`.** If 05-05's single users read (DEC-36) runs for the onboarding predicate on `/banned`, that case goes red. `/banned` is not in the onboarding exemptions today. 05-05 should keep `/banned` read-free, or record the move in the defect ledger.

## Deferred items found

None. The 05-08 register needs no new DI entry from this plan.

## Known Stubs

None. Only test files and evidence were created.

## Threat Flags

None. No endpoint, auth path, file-access pattern or schema changed. The threat-register mitigations were applied:
- T-05-02-01: every cycle restores with `git diff --exit-code`, and the final check covers all three mutated files.
- T-05-02-02: the hostile `next` values live only in the DEFECT file.
- T-05-02-03: the tag gate passes per file and with `--all`.
- T-05-02-04: only `placeholder-project.supabase.co` and placeholder keys are used, and `.env.local` was never read.

## Issues Encountered

None beyond the auto-fix above.

## Next Phase Readiness

- 05-03 (wave 2 sibling) is independent of these files.
- 05-04 shrinks the env census (it deletes auth-debug), and it must edit `EXPECTED_TODAY` with a ledger row.
- 05-05 flips `src/proxy-defect.test.ts` and the F-077 rows in `route-defect.test.ts`, moves callback tests 7 and 8 into `route-defect.test.ts`, and empties the env census. `src/proxy-characterization.test.ts`, `src/proxy.test.ts` and the six other callback PRESERVE tests must pass unedited.

## Self-Check: PASSED

- FOUND: src/proxy-characterization.test.ts, src/proxy-defect.test.ts, src/app/auth/callback/route-defect.test.ts, src/lib/__tests__/env-assertions-defect.test.ts, src/server/__tests__/getsession-gate.test.ts, evidence/slice-3-characterization-ring.txt, evidence/slice-3-mutation-check-ring.txt
- FOUND: commits e75cb27, c163b2c, d5c116e
- Tag gate `--all` ok 23; tsc exit 0; Jest 785/785; `git status --porcelain -- src/ supabase/` empty

---
*Phase: 05-slices-3-5-auth-club-authorization-admin-containment*
*Completed: 2026-09-24*
