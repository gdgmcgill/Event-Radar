---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 02
subsystem: auth
tags: [characterization, preserve-suite, jest, oauth-callback, mcgill-enforcement, refac-08]
status: complete
requires: []
provides:
  - "src/app/auth/callback/route.test.ts — the REFAC-08 PRESERVE contract for /auth/callback"
  - "A mutation-checked guarantee that every characterized branch turns the suite red when removed"
  - "The PRESERVE/DEFECT tagging of the callback's eight behaviours against F-004 and F-040"
affects:
  - "Phase 5 (F-004, F-040) — behaviours 7 and 8 are tagged DEFECT and will go red when the fix lands, by design"
  - "Phase 6 — any rewrite of the authorization ring around /auth/callback is now measurable"
  - "Plan 03-07 — the persona harness does NOT cover this route; this suite is the only Phase 3 coverage"
tech-stack:
  added: []
  patterns:
    - "Mock seams read off the subject's own import block, never copied from a neighbouring suite"
    - "jest.resetModules() + dynamic import for any module-load-time environment parse"
    - "Mutation-checking a PRESERVE suite as its own committed artifact"
key-files:
  created:
    - src/app/auth/callback/route.test.ts
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/callback-characterization.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/callback-mutation-check.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/callback-unmodified.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/callback-characterization-note.md
  modified: []
decisions:
  - "D-08 honoured: the three mock seams are @supabase/ssr, @supabase/supabase-js and @/lib/supabase/service — the route never imports the server factory every other route test mocks"
  - "Behaviours 7 and 8 tagged DEFECT against F-004/F-040 rather than PRESERVE, so Phase 5 removes them deliberately and sees which assertions go red"
  - "A ninth mutation cycle (M5b) added beyond the eight required, to prove the needs_onboarding cookie assertion bites independently of the upsert assertion"
  - "The worktree's /.claude/ Jest-discovery failure was worked around on the CLI and recorded verbatim, rather than by editing jest.config.js"
metrics:
  duration: "~17 min"
  completed: 2026-09-15
  tasks_completed: 2
  commits: 2
  tests_added: 8
  mutation_cycles: 9
---

# Phase 3 Plan 02: Auth Callback Characterization Summary

Eight behaviours of `/auth/callback` are now pinned by a suite that constructs a request, calls the exported `GET`, and asserts on the returned `NextResponse` — each one proven to go red when its branch is removed, against a route file that is byte-identical to where the plan started.

## What was built

`src/app/auth/callback/route.test.ts` (365 lines, 8 tests, `node` Jest project). REFAC-08 is an ordering obligation rather than a testing task: the requirement says characterization tests *before* the route is modified, and the route carries McGill email enforcement — the constraint PROJECT.md calls non-negotiable — plus profile upsert, admin auto-assignment and onboarding routing.

The eight behaviours, with their source lines:

| # | Behaviour | Source | Tag |
|---|-----------|--------|-----|
| 1 | Inbound provider `error` passes through *before* any exchange | `route.ts:42-47` | PRESERVE |
| 2 | Absent `code` → `?error=no_code` | `route.ts:49-54` | PRESERVE |
| 3 | Exchange failure → `?error=auth_failed&message=` | `route.ts:89-94` | PRESERVE |
| 4 | Non-McGill → signOut + `deleteUser(id)` + `?error=not_mcgill` | `route.ts:113-134` | PRESERVE |
| 5 | New McGill user → upsert payload + `/onboarding` + `needs_onboarding=1` | `route.ts:148-231` | PRESERVE |
| 6 | Onboarded user → the `next` destination, no cookie | `route.ts:183, 203-205` | PRESERVE |
| 7 | `ADMIN_EMAILS` address → `"admin"` appended to roles | `route.ts:22-29, 186-193` | **DEFECT — F-004** |
| 8 | Service key absent → profile sync skipped, user admitted | `route.ts:162, 197-199` | **DEFECT — F-004/F-040** |

## The two traps the plan predicted, both real

**The wrong mock seam.** Every other route test in this repo mocks `@/lib/supabase/server` — `src/__tests__/api/events/rsvp.test.ts:52` does exactly that, correctly, because that route imports it. **This route does not import it at all.** It imports `createServerClient` from `@supabase/ssr` directly, builds a *second* service-role client inline from `@supabase/supabase-js` purely for `auth.admin.deleteUser` on the rejection path, and reaches the `users` table through `@/lib/supabase/service`. Mocking the habitual module would have registered a mock nothing resolves and produced a suite that looked right in review and tested nothing.

**`ADMIN_EMAILS` is parsed at module load** (`route.ts:22-25`), so setting it in a `beforeEach` does nothing to an already-imported module. The suite's `loadRoute()` helper calls `jest.resetModules()` and re-imports. By contrast `SUPABASE_SERVICE_ROLE_KEY` is read *per request* (`route.ts:162`). That asymmetry — one privilege input frozen at boot, one re-read every request, in the same block — is itself a characterized fact and part of why F-004 registers the block.

## Proving the suite is a contract, not decoration

This plan's deliverable is exactly the shape `02-REVIEW.md` **WR-04** criticised: *"A PRESERVE suite whose assertions cannot fail when the preserved behavior is removed is a false sense of coverage."* So it was answered mechanically. Each characterized branch was removed from the route in turn, the suite run, and the red recorded:

```
Mutation cycles run:                       9
Cycles that turned the suite red:          9
Cycles that left the suite GREEN:          0  (none — every branch is load-bearing)
Cycles whose red named the expected test:  9 of 9

Route hash before first mutation:  ade670847466dac9ee2fd1af226f07f8e02000d207e33e25758c30a14a8be273
Route hash after last restoration: ade670847466dac9ee2fd1af226f07f8e02000d207e33e25758c30a14a8be273
MATCH: yes — the route is byte-identical to where this check started
```

Every cycle restored via `git checkout -- src/app/auth/callback/route.ts`, never by hand, with a byte-identity assertion after each restoration that aborts the whole run on divergence. Eight hand-restorations is how a stray character survives into a commit.

## What this suite does NOT cover — stated, not inferred

1. **Behaviour 7 does not fire in production.** `ADMIN_EMAILS` is absent from production's configured environment (F-040); F-004's severity rationale turns on it. The test pins *code* behaviour, not *observed production* behaviour. Anyone citing this suite as evidence that admin assignment "works in production" would be citing it wrongly.
2. **The 03-07 Playwright personas authenticate by cookie injection and never traverse this route.** This suite is therefore the only coverage McGill enforcement and admin auto-assignment receive anywhere in Phase 3. Six end-to-end specs add zero assertions here.
3. **The five signed-in Tier 3 steps (`02-UAT.md` test 1, STAB-06) remain a human item.** Behaviour 4 pins the handler's response with every collaborator mocked; it says nothing about whether the real `auth.admin.deleteUser` succeeds, or whether the session cookies Supabase chunks across several `Set-Cookie` headers survive the accumulator at `route.ts:56-80`. That accumulator is deliberately **not** characterized — the `createServerClient` mock never invokes the `cookies` adapter, so `allCookies` is empty in every test. Cookie chunking is an integration property.

## Verification

| Check | Result |
|-------|--------|
| `npx jest … --testPathPatterns "auth/callback"` | 1 suite passed, **8 tests passed**, exit 0 |
| Full suite | **286 passed, 5 skipped**, 23 of 24 suites — the 278 floor plus this suite's 8 |
| `npm run lint` | exit 0, **0 errors, 19 warnings** |
| `npx tsc --noEmit` | exit 0, **zero bytes** of output |
| `git diff -- src/app/auth/callback/route.ts` | empty; porcelain empty; `shasum -a 256` matches plan start |
| `git diff --name-only HEAD~2 HEAD -- src/` | exactly one path: `src/app/auth/callback/route.test.ts` |
| `git status --porcelain package.json package-lock.json jest.config.js supabase/` | empty |
| `check-baseline.mjs` | **17 passed, 1 failed** — see Deviations |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Jest discovers zero test files inside the execution worktree**

- **Found during:** Task 1, first run of the plan's canonical command
- **Issue:** This plan executed in a parallel-execution worktree rooted at `<repo>/.claude/worktrees/agent-aa53fcb9550c81688`. `jest.config.js` carries `testPathIgnorePatterns: ['/node_modules/', '/.claude/', …]`, so every path in the worktree contains `/.claude/` and Jest discovers **nothing** — not this suite, and not the 20 pre-existing ones. `npx jest --listTests` returned zero files.
- **Fix:** Overridden on the CLI (`--testPathIgnorePatterns` without the `/.claude/` entry) for the targeted runs, and via a scratchpad-only mirror config for the full-suite run. **`jest.config.js` was not modified** — `git status --porcelain jest.config.js` is empty. Both the canonical invocation and its worktree-local result are recorded verbatim in `evidence/callback-characterization.txt § COMMAND A`, with a corroborating `--listTests` probe, so the discovery failure is on the record rather than quietly worked around.
- **Why this is not a defect in the deliverable:** the committed file lives at `src/app/auth/callback/route.test.ts`, which contains no `/.claude/` segment in a normal checkout and is matched by the existing `node` project with no config change.
- **Commit:** 2bd955c

**2. [Rule 2 — Missing coverage] Added a ninth mutation cycle**

- **Found during:** Task 2
- **Issue:** Behaviour 5's test carries three independent assertion clusters (upsert payload, destination, onboarding cookie). Removing the upsert reds it, but that alone does not prove the cookie assertion bites.
- **Fix:** Added cycle **M5b**, which deletes the `if (needsOnboarding)` cookie-set block. It reds behaviour 5 independently. Nine cycles recorded rather than the eight required.
- **Commit:** 1f2797b

**3. [Rule 1 — Criterion violation caught pre-commit] The suite header contained the literal `@/lib/supabase/server`**

- **Found during:** Task 1 acceptance-criteria sweep
- **Issue:** The `WHY THE MOCK SEAMS ARE THESE THREE` block explained the trap by naming the module, which tripped the criterion `grep -c "@/lib/supabase/server" … returns 0`.
- **Fix:** Rephrased to point at the file (`src/lib/supabase/server.ts`) instead of the alias. Clearer anyway — it names the thing a reader would open. Caught and fixed before the commit; grep now returns 0.
- **Commit:** 2bd955c

### Acceptance criterion that could not be met literally

**`check-baseline.mjs` returns 17 passed / 1 failed, not 22 / 0.**

The single failure is `jest :: jest-json-parsed :: no JSON object on stdout (exit 1)` — the tool shells out to `npx jest --ci --json` (check-baseline.mjs:311) and gets nothing back, for the identical `/.claude/` reason above. That check `return`s early, so the **four** assertions downstream of it in the same family never execute. One failed plus four never-run is exactly the five-assertion gap between 17 and 22; the arithmetic is closed, not hand-waved.

Those four were evaluated by hand against the same baseline the tool reads (`.planning/audit/baseline/jest.txt`: 220 passed, 36 skipped, 16 of 21 executing), using a `--json` run of the full suite:

```
PASS jest :: no-failing-tests                    :: 0 failing
PASS jest :: passing-count-not-below-baseline    :: 286 passing vs baseline 220
PASS jest :: skipped-count-not-above-baseline    :: 5 skipped vs baseline 36
PASS jest :: executing-suites-not-below-baseline :: 23 of 24 executing vs baseline 16 of 21
```

All four pass with margin, and every non-jest check in the tool passed. The tool will report 22/0 from the repo root — but that is **a prediction from four hand-checked assertions, not an observation**, and `evidence/callback-characterization-note.md § 6` says so in those words.

## Two things the merger should confirm

Neither can be asserted from inside this worktree. Both are named in the note:

1. `npx jest --ci --selectProjects node --testPathPatterns "auth/callback"` from the repo root → 1 suite passed, 8 tests passed.
2. `node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs` from the repo root → 22 passed, 0 failed.

## Shared artifacts deliberately untouched

`STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were **not** modified. Plans 03-01 and 03-03 run in their own worktrees against the same base commit; the orchestrator owns all post-wave shared writes. **REFAC-08 is complete and awaits marking in `REQUIREMENTS.md` by the orchestrator.**

## Security notes

- **No database, no network, no Supabase stack, no `.env.local` read.** Every credential-shaped value in the suite is a literal placeholder (`https://placeholder-project.supabase.co`, `placeholder-anon-key`, `placeholder-service-role-key`), set on `process.env` inside the test process only, with the real environment snapshotted in `beforeAll` and restored in `afterAll`. The suite and all four evidence files were grepped for JWT, `sb_secret_`, `sbp_`, Postgres-URL and bearer shapes before commit; no match.
- **No package installed** (T-03-02-SC). `npm ci` installed the committed lockfile in the worktree and left `package.json` and `package-lock.json` untouched.
- **No threat flags raised.** This plan adds no network endpoint, no auth path, no file access pattern and no schema change. It adds one test file.

## Known Stubs

None.

## Commits

| Commit | Task | Summary |
|--------|------|---------|
| `2bd955c` | 1 | `test(03-02)`: the 8-behaviour characterization suite + the passing-run capture |
| `1f2797b` | 2 | `docs(03-02)`: mutation check, non-modification proof, characterization note |
