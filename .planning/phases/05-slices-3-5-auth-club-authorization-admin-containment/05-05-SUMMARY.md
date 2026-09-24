---
phase: 05-slices-3-5-auth-club-authorization-admin-containment
plan: 05
subsystem: auth
tags: [proxy, auth-callback, fail-closed, open-redirect, elevated-door, F-003, F-004, F-062, F-077, F-088, F-089, FO-05, DEC-35, DEC-36, DEC-38]

# Dependency graph
requires:
  - phase: 05-slices-3-5-auth-club-authorization-admin-containment
    provides: "05-02: the proxy nets (PRESERVE and DEFECT), the F-077 pins, and the env census; 05-04: src/lib/env.ts readers, getElevatedClient/assertElevatedConfigured, the seam guards (floor Jest 1008, tag gate ok 26)"
provides:
  - "src/proxy.ts is advisory and fails closed: one users read (banned_at, ban_expires_at, onboarding_completed); a JSON 403 for banned or no-row /api/* callers; a sign-out plus /?error=profile_sync_failed for no-row pages; a 500 on its own errors"
  - "The onboarding redirect is read from the database. The needs_onboarding cookie is a hint only"
  - "The callback grants no role, fails closed on profile sync, accepts only same-origin next values, and reaches the service role only through getElevatedClient()"
  - "The F-003 env census is empty"
  - "The first two REGISTRY.md rows; ratchet committed=25 live=24"
affects: [05-06, 05-07, 05-08, 05-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed ring: the env reads sit inside the try, so a MissingEnvError reaches the same catch as any other ring error"
    - "A PGRST116 no-row result is its own branch (DEC-35). Every other read error throws"
    - "The pre-fix source is restored from git show <head>:<path> and the fixed copy is restored with cmp, for every DEFECT flip"

key-files:
  created:
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/proxy-refactor.txt
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/callback-refactor.txt
  modified:
    - src/proxy.ts
    - src/proxy-defect.test.ts
    - src/app/auth/callback/route.ts
    - src/app/auth/callback/route.test.ts
    - src/app/auth/callback/route-defect.test.ts
    - src/lib/__tests__/env-assertions-defect.test.ts
    - src/server/db/elevated/REGISTRY.md
    - src/server/db/elevated/index.ts
    - .planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/defect-ledger.md

key-decisions:
  - "The proxy imports the env readers as a namespace (import * as env) so the local names supabaseUrl/supabaseAnonKey that the byte-preserved client block uses stay unchanged, with no shadowing"
  - "BAN_EXEMPT_PATHS get no users read, so /banned stays read-free and the 05-02 PRESERVE case 6 holds. An un-onboarded user on an exempt path is therefore not redirected, which matches today"
  - "safeNextPath returns pathname+search+hash of the resolved URL, and the same-origin check is the final authority (it also catches tab-stripped forms the prefix rules miss)"
  - "The failed-sync redirect attaches the accumulated cookies after signOut, so it carries the clearing cookies and not the just-exchanged session. An extra DEFECT row pins this"

patterns-established:
  - "The DEFECT Status line names the fixing commit by its message, and the ledger carries the hash, backfilled by the next commit"

requirements-completed: []  # REFAC-11 is partly delivered here (the proxy and callback clauses and validated config). Its handler-ring clause ("the onboarding guard cannot be bypassed by direct API calls") closes in 05-06 and 05-07

# Metrics
duration: 9min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 05: Proxy and Callback Fail Closed Summary

**The proxy now fails closed on its own errors (500, JSON under `/api/`), answers banned and no-row API callers with a JSON 403, and reads onboarding from the same single `users` query. The OAuth callback no longer grants admin, signs the user out when the profile sync fails, and accepts only same-origin `next` values. Both of the callback's service-role uses go through `getElevatedClient()`. Every PRESERVE contract held: the proxy suites are unedited, and the six remaining callback tests are byte-identical.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-09-24T05:31:38Z
- **Completed:** 2026-09-24T05:40:30Z
- **Tasks:** 2 of 2
- **Files:** 2 created (evidence), 9 modified

## Accomplishments

### Proxy (Task 1, DEC-36)

- **Env reads.** The env pass-through is gone. `env.supabaseUrl()` and `env.supabaseAnonKey()` are read inside the try, so a missing variable produces a 500 (F-003).
- **Fails closed.** The catch logs `[Middleware] Error:` and returns `{"error":"Failed to process request"}` (500) under `/api/`, or plain-text `Internal Server Error` otherwise (F-088).
- **One `users` read, three decisions:**
  - **No row (PGRST116):** `/api/*` gets 403 `Profile not found`. A page is signed out and redirected to `/?error=profile_sync_failed`, carrying the sign-out's cookies (DEC-35).
  - **Banned:** `/api/*` gets 403 JSON `Account suspended` (F-062). A page is still redirected to `/banned` with its query string.
  - **Onboarding:** `onboarding_completed !== true` comes from the database. The cookie is never read (F-089).
- **Unchanged regions.** These are byte-identical to c14fdc8: `config.matcher`, the client creation, the no-logic-before-`getUser` comment, the cookie cleanup, and the `PROTECTED_ROUTES` one-line literal.
- **DEFECT flips.** All 8 `src/proxy-defect.test.ts` rows were red unedited. They were moved to 9 fixed-shape rows (row a gained its `/api/events` JSON variant, and row d split into its API and page cases). The moved rows went green, went red again with the pre-fix proxy restored, and the fixed proxy was restored `cmp`-identical.
- **Build.** `npm run build` exits 0, and the build output lists `ƒ Proxy (Middleware)`.

### Callback (Task 2, DEC-38)

- **Removed (F-004).** The allowlist parse, `isAdminEmail`, the role update, the `@supabase/supabase-js` import and every service-key read are gone.
- **Profile sync (FO-05).** It runs in its own try/catch through the door. An upsert error, a read error, a null profile or any throw leads to `signOut()`, then a 307 to `/?error=profile_sync_failed` with the accumulated cookies and no onboarding cookie.
- **`next` (F-077).** It must start with `/`, its second character cannot be `/` or `\`, and it must resolve to the request origin. Otherwise it becomes `/`.
- **PRESERVE suite (`route.test.ts`).** Tests 7 and 8 moved out, the two docblock bullets became one, and the service mock gained `auth.admin.deleteUser`. A scratchpad script shows the six remaining `it` blocks are byte-identical to c14fdc8.
- **DEFECT suite (`route-defect.test.ts`).** It now has 9 rows: three F-077 rows landing on `https://callback.test/`, the control, F-004 with no update, F-004/FO-05 with a `MissingEnvError` from the door, an upsert error, a null profile, and a cookie-carry row.
- **Env census.** It is empty, following the same red/green/restore protocol.
- **Registry and ratchet.** REGISTRY.md has two rows naming the callback, and its `_(none)_` row is gone. The ratchet reads `committed=25 live=24 delta=-1`.

## Task Commits

1. **Task 1, proxy fails closed:** `e2d6d3a` (fix, INTENTIONAL BEHAVIOUR CHANGE)
2. **Task 2, callback grants no roles, fails closed, validates next:** `077a081` (fix, INTENTIONAL BEHAVIOUR CHANGE)

**Plan metadata:** the final docs commit. It covers the SUMMARY, STATE and ROADMAP, and the ledger backfill of `077a081`.

## Floor after this plan

| Gate | Before (05-04) | After |
|---|---|---|
| `npx jest --ci` | 1008 passed, 62 suites | 1012 passed, 0 failed, 62 suites (+1 proxy row a2; callback −2 PRESERVE +5 DEFECT) |
| `node scripts/check-characterization-tags.mjs --all` | ok 26 | ok 26 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings (none in a touched file) |
| `node scripts/check-elevated-ratchet.mjs` | committed=25 live=25 | committed=25 live=24 |
| `npm run build` | exit 0 | exit 0 (after each task) |
| `git diff c14fdc8 -- src/proxy-characterization.test.ts src/proxy.test.ts` | n/a | empty |

## Decisions Made

- **`/banned` stays read-free.** The single `users` read is skipped on all three BAN_EXEMPT paths, as before, so 05-02's PRESERVE case 6 passes unedited and no ledger move was needed. The consequence: an un-onboarded user is not redirected to `/onboarding` while on `/banned` or `/auth/*`. That matches today, and `/auth/*` is exempt from the onboarding guard anyway.
- **Namespace import for the env readers.** The preserved client block uses the local names `supabaseUrl` and `supabaseAnonKey`. A named import of the same names would shadow them (a TDZ error), so the proxy uses `import * as env from "@/lib/env"`. The key-link pattern `supabaseUrl\(\)` still matches.
- **The failed-sync redirect carries the sign-out's cookies.** Cookies are attached after `signOut()`, so the browser receives the clearing cookies rather than the session the exchange had just minted. A dedicated DEFECT row pins this, and a mutation of the proxy's equivalent carry was shown to redden its row (proxy-refactor.txt §4).

## Deviations from Plan

### Rule-resolved choices

**1. Three rows beyond the plan's list, all fixed shapes of the named findings.**
- Proxy row d's page case also asserts that the sign-out's clearing cookie is on the redirect. The plan requires copying the cookies, and nothing else pinned that.
- The callback has a third FO-05 row: the failed-sync redirect carries the clearing cookie and not the session.
- The ledger has 9 proxy rows (the plan asked for at least 7) and 10 callback-side rows (F-004 ×2, F-077 ×3, FO-05 ×3, F-003 census, and the DEC-38 mock-seam row).

**2. Census file edit scope.** The plan says "the expected list becomes empty". The comment over the list, the first test's title ("today's 4" became "is empty"), the describe title and the Status line were also updated, because leaving them unchanged would make them false. 05-04 set this precedent, and the ledger row records the scope.

**3. The DEFECT Status lines cite the fixing commit by message, not by hash.** A commit cannot contain its own hash. The ledger carries both hashes: `e2d6d3a` was backfilled in the Task 2 commit, and `077a081` in the metadata commit.

**4. REFAC-11 is not marked complete.** The plan's frontmatter lists REFAC-11, and the state protocol marks listed requirements complete. The requirement also says "the onboarding guard cannot be bypassed by direct API calls", which is the handler ring that 05-06 and 05-07 deliver (their plans name REFAC-11 too). The `requirements.mark-complete` call was reverted. The REFAC-11 traceability row now reads Partial, naming what 05-04 and 05-05 delivered and what remains.

### Auto-fixed Issues

**1. [Rule 1 - Stale doc] The door's docblock said "The register is empty in this phase"**
- **Found during:** Task 2 (REGISTRY rows added)
- **Fix:** it now reads "Rows are added per migration from Phase 5 (05-05 onward)". The change is to a comment only.
- **Files modified:** `src/server/db/elevated/index.ts` (not in the plan's files_modified)
- **Commit:** `077a081`

## Observations for later plans

- **CLAUDE.md line reference.** CLAUDE.md cites `PROTECTED_ROUTES` at `src/proxy.ts:114`, but it is now at line 188. The literal and its regex re-derivation are unchanged and still work. The line number in CLAUDE.md is stale, and this executor does not edit CLAUDE.md. A docs pass (05-08 or the slice close) should update it.
- **Playwright (05-08).** Onboarding is now database truth. The seed has one persona with `onboarding_completed: false` (`scripts/seed/personas.ts:193`). A spec that signs that persona in and visits any page other than `/onboarding` will now be redirected, even without the cookie. That is the intended F-089 change, and it needs to be reflected in `ban-and-onboarding-ring.spec.ts`.
- **Banned API callers.** They now get a JSON 403 on every `/api/*` path, including GETs. The `/banned` page makes no `/api/*` fetch, so it is unaffected.
- **Proxy bundle.** The proxy imports `isBanned` from `@/lib/ban`. That module also imports the server client factory (`next/headers`), which the build bundles into the proxy without error. 05-07 deletes `checkBanStatus` from that module, which removes the import.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or schema. The threat register's mitigations were applied and tested:
- T-05-05-01: DEFECT rows b and c.
- T-05-05-02: PRESERVE rows 3-5 pass unedited.
- T-05-05-03: three hostile `next` cases, including slash-backslash.
- T-05-05-04: no `users` update even with the variable set.
- T-05-05-05: the callback fails closed, and the proxy answers 403 `Profile not found`.
- T-05-05-06: PRESERVE test 4 is byte-identical and green. `isMcGillEmail` and `not_mcgill` are present.
- T-05-05-07: the one-line literal regex check exits 0.

## Issues Encountered

None.

## Self-Check: PASSED

- FOUND: src/proxy.ts, src/proxy-defect.test.ts, src/app/auth/callback/route.ts, src/app/auth/callback/route.test.ts, src/app/auth/callback/route-defect.test.ts, src/lib/__tests__/env-assertions-defect.test.ts, src/server/db/elevated/REGISTRY.md, evidence/proxy-refactor.txt, evidence/callback-refactor.txt, evidence/defect-ledger.md
- FOUND commits: e2d6d3a, 077a081
