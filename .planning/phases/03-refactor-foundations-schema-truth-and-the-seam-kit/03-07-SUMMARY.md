---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 07
subsystem: testing
tags: [playwright, e2e, personas, seed, determinism, supabase-ssr, cookies, rls, ci, refac-06, refac-07, d-21, d-22]

requires:
  - phase: 03-06
    provides: "src/lib/supabase/types.ts regenerated from the migrations. The seed loader imports it, so every insert is typed against the schema the database is actually built from rather than against production plus hand edits"
  - phase: 03-05
    provides: "supabase/tests/database/000-setup.sql and its impersonation helpers, plus the convention that the pgTAP directory's files sort into a run order. 040-seed-coverage.test.sql is a sibling of that suite and inherits the setup file's objects — and the 00000000-0000-4000-8000 fixture block it already owns is what forced the seed into its own namespace"
  - phase: 03-04
    provides: "The reconciled three-migration local database. Every command in this plan begins `supabase db reset --local`, and what it rebuilds is that"
  - phase: 03-02
    provides: "The auth-callback unit characterization. It is what covers McGill enforcement and admin auto-assignment, which no persona in this harness ever traverses — the coverage boundary is stated in evidence/harness-note.md § 4a rather than left to be discovered"
  - phase: 02
    provides: "STAB-11's lockfile discipline and evidence/lockfile-review-log.md's review format, evidence/tools/check-baseline.mjs (22 checks), 02-SECURITY.md § Residuals (the un-assertable ban check), 02-REVIEW.md WR-04 (the untested redirect), and 02-UAT.md's five signed-in manual steps"
  - phase: 01
    provides: ".planning/audit/inventory/classification-rules.md § 2 — the thirteen-persona taxonomy this seed uses verbatim as its keys, and the environment capture recording that no staging project exists"
provides:
  - "scripts/seed/{clock,prng,personas,guard,load}.ts — a deterministic functional seed with a fail-closed target guard. Two loads produce byte-identical data (sha256 964ac785…, re-derived three times across resets)"
  - "scripts/seed/guard.ts — the URL allow-list. Loopback-on-a-Supabase-port passes; production is refused by ref read from the ignored env file; a hosted project needs two independent staging signals; and a target whose deny key cannot be established is refused fail-closed, which OUTRANKS the acknowledgement"
  - "src/__tests__/seed/guard.test.ts — five Jest cases, four of them refusals, hermetic against throwaway env fixtures so they run in CI where no .env.local exists"
  - "supabase/tests/database/040-seed-coverage.test.sql — 21 assertions turning REFAC-07's coverage sentence into a regression test, which SKIP with their reason when the seed is absent so the unseeded type-drift job stays honest"
  - "playwright.config.ts + e2e/{env,fixtures,auth.setup}.ts — one setup project, ten storage states, a persona-dependent browser project, and a webServer bound to the local stack through the seed loader's own guard"
  - "Seven spec files, 27 tests: six happy paths over Validated workflows plus the cookie-equivalence cross-check"
  - "An `e2e` job in .github/workflows/ci.yml — a third sibling that starts the stack, resets, seeds, runs the database tests, installs chromium and runs the harness, uploading the report on failure"
  - "evidence/harness-note.md — the coverage map against QUOTED workflow text, and four sections on what the harness deliberately does not do"
  - "Deferred items D-21 (the CSP blocks the local stack for every developer, not just this harness) and D-22 (the moderation deep-link is ignored)"
affects:
  - "03-08 (close-out): inherits REFAC-07 as a PARTIAL on its staging clause with the reason written, REFAC-06 as met, and two new deferred items D-21/D-22 on the register whose D- numbering collision it already owns"
  - "Phases 4, 5 and 6 (every refactor slice): this is the net. `supabase db reset && npx tsx scripts/seed/load.ts && npx playwright test` is the command that says whether a slice preserved behaviour — and evidence/harness-note.md § 4 is the list of what it will NOT tell them"
  - "Phase 7 (certification): CERT-01 grows this dataset. It inherits the audit's persona keys, the reserved 5eed id namespace, the two-clock design, and the DST constants in scripts/seed/clock.ts rather than re-deriving any of them"
  - "The Stage 3 slice that owns headers/routing: D-21's CSP fix. Doing it lets bypassCSP come out of playwright.config.ts and lets the specs exercise the real policy"

tech-stack:
  added:
    - "@playwright/test 1.63.0 (devDependency, exact pin) — the only package name this phase adds. 3 lock entries arrived, 0 left, 0 were re-resolved"
  patterns:
    - "A pinned `now` is not enough on its own. Any seeded row whose meaning is defined against the WALL clock — an unexpired suspension, an upcoming event — needs a pinned HORIZON far enough out that the clock cannot cross it. Two clocks, both literal: determinism survives, and meaning does too"
    - "Prove the session through the running APPLICATION, not through the client. Each persona is asserted to land where the app's own ring would put it; an anonymous caller would land somewhere else. A getUser() check proves only that the client is happy"
    - "Cross-check a shim against the real surface once, on the one persona that can. Driving /admin-login and comparing cookie NAMES turns 'the shim is equivalent' from an assumption into an assertion, and costs exactly one test"
    - "A coverage test that cannot run should SKIP with its reason, not fail and not silently pass. 040 emits 21 TAP skips naming the command to run, so the same file is honest in the seeded job and in the unseeded one"
    - "Purge by every key the database enforces uniqueness on, not just the one you index by. GoTrue's unique key is the ADDRESS; purging only by id wedges the loader the first time a fixed id changes"
    - "Never assert on optimistic UI. A label that flips before the request proves only that React re-rendered. Wait on the response"
    - "A test-harness workaround must state its cost. bypassCSP is written down three times — config, note, deferred register — with the sentence 'the harness does not exercise the CSP' attached to each"
    - "Re-derive a list from its authority at load time rather than transcribing it. e2e/fixtures.ts parses PROTECTED_ROUTES out of src/proxy.ts, so a path added to the ring tomorrow is asserted without anyone editing a spec"

key-files:
  created:
    - "scripts/seed/guard.ts"
    - "scripts/seed/load.ts"
    - "scripts/seed/personas.ts"
    - "scripts/seed/clock.ts"
    - "scripts/seed/prng.ts"
    - "src/__tests__/seed/guard.test.ts"
    - "supabase/tests/database/040-seed-coverage.test.sql"
    - "playwright.config.ts"
    - "e2e/env.ts"
    - "e2e/fixtures.ts"
    - "e2e/auth.setup.ts"
    - "e2e/specs/banned-redirect.spec.ts"
    - "e2e/specs/protected-route-redirect.spec.ts"
    - "e2e/specs/anonymous-browse.spec.ts"
    - "e2e/specs/save-and-rsvp.spec.ts"
    - "e2e/specs/club-owner-surfaces.spec.ts"
    - "e2e/specs/admin-moderation-queue.spec.ts"
    - "e2e/specs/admin-login-cookie-equivalence.spec.ts"
    - ".planning/phases/03-.../evidence/harness-note.md"
    - ".planning/phases/03-.../evidence/seed-determinism.txt"
    - ".planning/phases/03-.../evidence/seed-guard-refusals.txt"
    - ".planning/phases/03-.../evidence/playwright-run.txt"
    - ".planning/phases/03-.../evidence/playwright-install.txt"
    - ".planning/phases/03-.../evidence/lock.03-07.diff-review.md"
  modified:
    - "package.json — one devDependency, exact pin"
    - "package-lock.json — 3 entries added, 0 removed, 0 re-resolved, 0 deletions"
    - ".gitignore — playwright-report/ and playwright/.auth/ added to the testing block"
    - ".github/workflows/ci.yml — one new `e2e` job; the fast job and the types job untouched"
    - ".planning/phases/03-.../deferred-items.md — D-21 and D-22 opened"

key-decisions:
  - "The seed lives in a RESERVED 5eed… id namespace, not in the 00000000-0000-4000-8000 block the pgTAP fixtures already own. Found by running the suite, not by reading it: 020-rls-policy-gaps died on a duplicate primary key before a single RLS assertion ran"
  - "Two pinned clocks, not one. PINNED_NOW for stored metadata; HORIZON_FUTURE/HORIZON_PAST (±10 years) for rows the application compares to the wall clock. Ten years is 'longer than this codebase will run without the seed being revisited', and crossing it turns a spec red rather than going quiet"
  - "No seeded saved_events row. Its AFTER INSERT trigger updates public.users, whose BEFORE UPDATE trigger stamps updated_at = now() unconditionally, which unpins a timestamp the determinism proof depends on and cannot be re-pinned afterwards. Dropping the column from the proof would weaken it where it is load-bearing, so the row went instead"
  - "All FOUR event statuses the check constraint permits are seeded and asserted, not the three the plan named. One extra row closes the gap rather than deferring it"
  - "club_members.role is 'organizer' for the non-owning member persona, because club_members_role_check permits only 'owner' and 'organizer'. There is no 'member' value in this schema"
  - "The harness runs against a PRODUCTION BUILD. Under next dev the pages never finish hydrating in Playwright's Chromium, and the symptom reads like a cookie bug because the proxy sees the session perfectly"
  - "bypassCSP: true, with the cost stated three times rather than hidden. Fixing the policy is an application source change this plan prohibits by name; registered as D-21"
  - "REFAC-07's staging clause is recorded a PARTIAL. The branch is implemented, double-gated and unit-tested including refusals; there is no staging project to load into. The guard was NOT widened to make an untestable path look tested"
  - "The moderation deep-link defect is registered (D-22), not asserted. A spec that froze the current behaviour would make the eventual fix look like a regression"

patterns-established:
  - "Pattern: determinism is proven by loading twice and hashing, not by describing the design. It caught a real trigger interaction on its first run"
  - "Pattern: a security control's evidence file is a transcript of it refusing, with the production ref redacted inside the writing pipeline"
  - "Pattern: one sign-in per persona per run, in a setup project, because the local stack rate-limits sign-ins and a re-authenticating suite fails in a way that reads like an outage"
  - "Pattern: an evidence note about a safety net is mostly limits. Four sections here say what the harness does not cover"

requirements-completed: [REFAC-06]

duration: 4h 10m
completed: 2026-09-16
status: complete
---

# Phase 3 Plan 07: The Deterministic Seed and the Persona Harness — Summary

**Ten synthetic McGill personas now reach the running application as signed-in users with no application change and no real OAuth, against data whose every row is byte-reproducible — and a banned one is demonstrably turned away from a protected path, which is the assertion Phase 2 recorded as impossible.**

## Performance

- **Duration:** ~4h 10m
- **Tasks:** 3 (one TDD, so four commits)
- **Files created/modified:** 29 files, +3,724 lines
- **Packages added:** 1

## Accomplishments

- **A deterministic seed that is proven, not described.** `supabase db reset` → load → dump → load again → dump produces two byte-identical JSON views (`sha256 964ac785…`), and the same hash was re-derived a third time on a database that had been reset, seeded, poked at and re-seeded in between. Fixed UUIDs, a pinned instant, an in-repo twenty-line mulberry32, zero new packages for any of it.
- **REFAC-07's coverage sentence turned into 21 database assertions.** All three `user_role` values, the complete four-row ban truth table including the expired suspension that *looks* banned, both onboarding states, all three club statuses, and all **four** event statuses `events_status_check` permits. They SKIP with their reason when the seed is absent, so the unseeded type-drift job stays green for the right reason.
- **A guard that fails closed, watched refusing five different wrong targets.** Production by ref, an arbitrary hosted project, a named staging project without its acknowledgement, a loopback host on a non-Supabase port, and a string that is not a URL — each exiting 1 at the command line, plus five unit cases written *before* the guard existed.
- **Ten persona sessions from the library's own cookie serializer**, each verified through the running application rather than through the client, and cross-checked once against the app's real password sign-in page to prove the cookie names match.
- **Twenty-seven end-to-end tests green from a clean database**, including the ban-enforcement assertion Phase 2 carried as a residual and the protected-route redirect that `02-REVIEW.md` WR-04 recorded as untested at any tier.
- **One package name into the tree**, exactly pinned, behind a lockfile diff reviewed structurally before `npm ci` ran: 3 entries added, 0 removed, 0 re-resolved, 46 insertions and **0 deletions**.

## Task Commits

1. **RED — the guard's refusals, before the guard** — `06f0665` (test)
2. **Task 1: the deterministic seed and the fail-closed guard** — `3fc00bc` (feat)
3. **Task 2: Playwright, the persona setup project, and the cookie cross-check** — `b49e4f1` (feat)
4. **Task 3: six happy-path specs, the e2e CI job, and the harness note** — `3db8a07` (test)

## Files Created/Modified

| File | What it does |
|---|---|
| `scripts/seed/guard.ts` | The URL allow-list. Loopback-on-a-Supabase-port passes without reading anything; every other target must clear three checks, and an unestablishable deny key refuses outright |
| `scripts/seed/load.ts` | Asserts the target before a client exists, purges by id **and** by address, inserts with every timestamp pinned. `--dump` emits the canonical view the determinism proof hashes |
| `scripts/seed/personas.ts` | Ten personas under the audit's own taxonomy keys, five clubs, five events, six memberships, two RSVPs. Names the three taxonomy entries it deliberately does not seed |
| `scripts/seed/clock.ts` | Two pinned clocks and the 2026 Toronto DST transitions, with the reason the second clock exists |
| `scripts/seed/prng.ts` | mulberry32, twenty lines, zero packages |
| `src/__tests__/seed/guard.test.ts` | Five cases, four refusals, hermetic against temp-dir env fixtures |
| `supabase/tests/database/040-seed-coverage.test.sql` | 21 coverage assertions that skip honestly when unseeded |
| `playwright.config.ts` | Setup project, persona-dependent browser project, single worker, production-build webServer guarded by the seed loader's own control |
| `e2e/env.ts` | Local credentials from `supabase status -o env`. Never `.env.local` |
| `e2e/fixtures.ts` | Storage-state paths, the seed's fixed ids, and `PROTECTED_ROUTES` **re-derived from `src/proxy.ts` at load time** |
| `e2e/auth.setup.ts` | Ten sign-ins, all cookie emissions accumulated, each session proven through the app |
| `e2e/specs/*.spec.ts` (7) | Six happy paths plus the cookie-equivalence cross-check |
| `.github/workflows/ci.yml` | One new `e2e` job. The fast job and the `types` job are byte-unchanged |
| `evidence/harness-note.md` | The coverage map against quoted workflow text, and four sections of limits |

## Decisions Made

Recorded in frontmatter `key-decisions`. The three worth repeating here:

**The seed needed its own id namespace.** The pgTAP suite already owns `00000000-0000-4000-8000-…` and plan 03-05's RLS file inserts users `…0001`/`…0002`/`…0003` and club `…00c1` inside its transaction. Seeding the same literals killed `020-rls-policy-gaps` on a duplicate primary key *before* a single RLS assertion ran. The seed moved rather than the tests, to a `5eed…` prefix that is both outside that block and readable as "seed" at a glance — which also makes the loader's purge step able to be exact.

**A pinned `now` is not sufficient on its own.** `/api/events` filters `start_date >= now()` and `src/proxy.ts` compares `ban_expires_at` to `new Date()`, both against the **wall** clock. With every offset taken from `PINNED_NOW` (2026-06-01), the "active suspension" had silently expired in real time and every "upcoming" event had become a past one. Nothing errored — the seed just started meaning something else. Two pinned clocks resolve it without giving up a single literal.

**REFAC-07's staging clause is a stated partial.** Determinism, idempotence, coverage and the refusals are all met and evidenced. The staging branch is implemented, gated behind two independent signals, and unit-tested including its refusals — and there is no staging project to load into, which the Phase 1 capture already records. Enabling it is exporting two variables. The guard was not widened to make an untestable path look tested, and plan 03-08 carries this as a partial rather than a pass. **REFAC-06 is complete; REFAC-07 is not ticked.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `events.source = "seed"` violates `events_source_check`**
- **Found during:** Task 1
- **Issue:** The constraint permits only `manual` / `instagram` / `admin`. The loader failed on its first run.
- **Fix:** `source: "manual"`.
- **Files modified:** `scripts/seed/load.ts`
- **Verification:** loader exits 0
- **Committed in:** `3fc00bc`

**2. [Rule 1 — Bug] The seeded `saved_events` row unpinned a timestamp and broke determinism**
- **Found during:** Task 1, by the determinism proof on its first run
- **Issue:** `saved_events_count_trigger` UPDATEs `public.users`, which fires `update_users_updated_at`, which stamps `updated_at = now()` unconditionally. Two loads produced two different values for one user. It cannot be re-pinned — every fixing UPDATE re-fires the trigger — and the row cannot precede the user it references.
- **Fix:** the seeded row was removed, with a long note in `personas.ts` recording the mechanism and the rejected alternative (dropping the column from the proof). The loader still purges `saved_events` for every persona, so a save a spec makes cannot leak into the next run, and `save-and-rsvp.spec.ts` creates one at run time — which is the behaviour that actually needs asserting.
- **Verification:** two dumps byte-identical
- **Committed in:** `3fc00bc`

**3. [Rule 3 — Blocking] The seed collided with the pgTAP fixture id block**
- **Found during:** Task 1, `supabase test db --local`
- **Issue:** `duplicate key value violates unique constraint "users_pkey"` — `020-rls-policy-gaps.test.sql` reports `Failed 15/15 subtests`, having run none of them.
- **Fix:** the seed moved to the reserved `5eed…` namespace.
- **Files modified:** `scripts/seed/personas.ts`, `supabase/tests/database/040-seed-coverage.test.sql`
- **Verification:** 5 files, 68 tests, PASS
- **Committed in:** `3fc00bc`

**4. [Rule 1 — Bug] `format()` cannot inject a literal into a query containing a `LIKE` pattern**
- **Found during:** Task 1
- **Issue:** `ERROR: unrecognized format() type specifier "'"` — the `%` in `LIKE '…%'` is read as a specifier.
- **Fix:** the pinned instant is written as a literal in those four assertions, with the reason recorded above them.
- **Committed in:** `3fc00bc`

**5. [Rule 3 — Blocking] The loader wedged on "a user with this email address has already been registered"**
- **Found during:** Task 1, immediately after the id namespace change
- **Issue:** GoTrue's unique key is the address, not the id. Purging only by id leaves the old accounts in place under their old ids, and the create fails. Deleting them then fails again with "Database error deleting user", because `clubs.created_by` references `auth.users` with NO ACTION and the stale clubs still point at them.
- **Fix:** the purge now clears by address as well as by id, and clears what references a stale account first, children before parents. The loader is now idempotent across its own id changes, not only across its own runs.
- **Committed in:** `3fc00bc`

**6. [Rule 3 — Blocking] `next dev` does not hydrate under Playwright's Chromium**
- **Found during:** Task 2
- **Issue:** The Turbopack HMR websocket handshake fails with `ERR_INVALID_HTTP_RESPONSE`, `AuthProvider`'s effect never runs, and the auth store never sees the injected session — while the **proxy** sees it perfectly, so the symptom reads like a cookie bug.
- **Fix:** `webServer.command` is `npm run build && npm run start`. The plan sanctions either; the production build is also the artifact that deploys.
- **Committed in:** `b49e4f1`

**7. [Rule 3 — Blocking] The CSP refuses every client-side call to the local stack**
- **Found during:** Task 2, the cookie-equivalence spec
- **Issue:** `next.config.js` sets an unconditional `connect-src 'self' https://*.supabase.co …`, which does not admit `http://127.0.0.1:54321`. Surfaces in the UI as a bare "Failed to fetch".
- **Fix:** Playwright's `bypassCSP: true` — a harness setting, not an application change. **Cost stated three times:** the harness does not exercise the CSP. Fixing the policy is an application source change this plan prohibits by name, so it is registered as **deferred item D-21**, which also records the wider consequence: every developer running against a local stack has a broken client-side sign-in today.
- **Committed in:** `b49e4f1`

**8. [Rule 2 — Missing coverage] The fourth event status**
- **Found during:** Task 1
- **Issue:** the plan names three event statuses; `events_status_check` permits four.
- **Fix:** `suspended` is seeded and asserted. One row, gap closed rather than deferred.
- **Committed in:** `3fc00bc`

**9. [Rule 1 — Spec bug] Three specs asserted behaviour that had not been measured**
- **Found during:** Task 3, first full run (24 passed / 3 failed)
- **Issue:** (a) the save label flips **optimistically**, before the POST, so asserting it and navigating away raced the write; (b) `redirect()` from a streaming Server Component is a 200 with `NEXT_REDIRECT` in the RSC payload, performed after hydration, so `page.goto()` resolves on the pre-redirect URL; (c) `/moderation/events?status=pending` ignores the query parameter, and the status control is a `<select>` rather than buttons.
- **Fix:** wait on the response; `waitForURL`; drive the `<select>`. Each fix carries the explanation in the spec so the next reader does not repeat it. The deep-link defect is registered as **D-22** rather than asserted — a spec that froze the current behaviour would make the eventual fix look like a regression.
- **Committed in:** `3db8a07`

---

**Total deviations:** 9 auto-fixed — 4 × Rule 1 (bugs), 4 × Rule 3 (blocking), 1 × Rule 2 (missing coverage).
**Impact on plan:** No scope creep. Seven of the nine were found by a gate running rather than by review, which is the point of the gates. Two application-source defects were registered and deliberately not fixed (D-21, D-22), keeping `git status --porcelain src/` empty as the plan requires.

## Issues Encountered

**The plan's own "at(n, h)" event dates and "PINNED_NOW ± 7d" ban expiries were wrong in a way the plan could not have seen.** The research's determinism contract is correct as far as it goes, but it does not address the application's wall-clock comparisons. This is written up in `scripts/seed/clock.ts` and in `evidence/harness-note.md § 5` because it will apply again to CERT-01.

**`supabase test db` prints the pg_prove summary only,** so a green `040` does not distinguish an assertion from a skip. The raw TAP is captured in `evidence/seed-determinism.txt § 4` both ways — 21 assertions seeded, 21 skips unseeded — so the skip branch is visible rather than asserted.

**`ls src/**/*.spec.ts` under zsh errors rather than printing nothing** when there is no match. The criterion is satisfied (no spec lives under `src/`); the shell's report of it is a non-zero exit with "no matches found".

## Verification

| Gate | Result |
|---|---|
| `supabase db reset --local && npx tsx scripts/seed/load.ts` | exit 0 |
| Two loads, byte-identical dumps | `964ac785478b84ca1945cbde18e8537ed033dab80b73b6b91238c3d0552f2bcb` ×3 |
| `supabase test db --local` | 5 files, **68 tests**, PASS |
| `npx playwright test --list` | 1 setup project + **7 spec files**, 27 tests |
| `npx playwright test` from a clean database | **27 passed** |
| Storage states written / tracked by git | 10 / **0** |
| `npx jest … "seed/guard"` | 5 passed (4 refusals) |
| Guard refusals at the command line | 5 cases, each exit 1 |
| `npm test -- --ci` | **348 passed / 5 skipped** (floor 343/5) |
| `npm run lint` | 0 errors, 19 warnings |
| `npx tsc --noEmit` | 0, with `e2e/**` inside its coverage (D-14) |
| `npm audit --audit-level=high --omit=dev` | exit 0 |
| `check-baseline.mjs` | **22 passed, 0 failed** |
| `git status --porcelain src/ jest.config.js .env.local` | empty |
| `test ! -e supabase/seed.sql` | absent |

The known intermittent `src/hooks/useEvents.test.ts` failure (deferred register D-20) **was not seen** in any of the four full Jest runs this session.

## User Setup Required

None. Everything runs against the local stack; no external service was configured and no credential was added.

## Next Phase Readiness

**Ready.** The net exists and is green. `supabase db reset --local && npx tsx scripts/seed/load.ts && npx playwright test` is the command Phases 4–6 run after every slice to answer REFAC-23.

**What plan 03-08 inherits:**

- **REFAC-06 — complete**, ticked in REQUIREMENTS.md.
- **REFAC-07 — PARTIAL, not ticked.** Every clause but "and staging" is met and evidenced; the staging branch is implemented, double-gated and unit-tested with no project to load into. `evidence/harness-note.md § 3` is the disposition to carry into the completion note.
- **Two new deferred items on a register whose D- numbering collision 03-08 already owns:** D-21 (the CSP has no local-development entry — broader than this harness) and D-22 (the moderation deep-link is ignored).
- **One stated coverage limit that belongs in the completion note:** the five signed-in Tier 3 UAT steps from Phase 2 remain human, because no persona here traverses `/auth/callback` and none can supply a real McGill Google account.

**One concern worth naming:** the harness does not exercise the Content-Security-Policy, and nothing in `e2e/` would notice if that header were weakened. That is a real hole in a safety net, it is D-21's to close, and it is written in three places so it cannot be read as an oversight.

---
*Phase: 03-refactor-foundations-schema-truth-and-the-seam-kit*
*Completed: 2026-09-16*

## Self-Check: PASSED

Re-derived in the working tree on 2026-09-16, not transcribed.

- **24 of 24 claimed files exist on disk** — the five seed modules, the guard suite, the pgTAP coverage file, the Playwright config, three `e2e/` support files, seven specs, and six evidence artifacts.
- **4 of 4 claimed commits exist in `git log`** — `06f0665`, `3fc00bc`, `b49e4f1`, `3db8a07`.
- **Every `min_lines` contract in the plan's `must_haves.artifacts` is met**, with margin: `guard.ts` 211/40, `personas.ts` 603/80, `guard.test.ts` 119/40, `playwright.config.ts` 136/25, `auth.setup.ts` 141/45, `harness-note.md` 168/45.
- **Every `key_links` relationship holds** — `e2e/auth.setup.ts` imports `PERSONAS` from `scripts/seed/personas.ts`; `playwright.config.ts` declares `dependencies: ["setup"]`; `scripts/seed/load.ts` calls `assertSeedTargetAllowed` on the line before `createClient`.
- **Every prohibition holds** — no `supabase/seed.sql`, no bare `playwright` declaration, no spec under `src/`, `jest.config.js` untouched, `git status --porcelain src/ .env.local` empty, no storage state tracked by git, no route changed to use the `src/server/` seam.
