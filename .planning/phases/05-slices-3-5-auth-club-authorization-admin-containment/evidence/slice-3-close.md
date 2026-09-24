# Slice 3 close-out: auth ring, ban, onboarding, validated config

**Plan:** 05-08 · **Phase:** 05 · **Recorded:** 2026-09-24 · **Measured on:** `6b9a721` (the last code-bearing slice-3 commit), phase base `4a9e272` · **Author:** executor, local stack only

Slice 3 covered the proxy, the auth callback, env validation, the ban and onboarding guards, and every state-changing non-admin write arm. The order was: characterization (05-02 ring, 05-03 handlers), then the seam guards and validated config (05-04), the proxy and callback (05-05), the handler ring (05-06 events family, 05-07 everything else), and this close-out (05-08). Every claim below cites a command output in an evidence file or a commit. Nothing is taken from a planning document.

## 1. Floor, before and after

Source: `evidence/floor.before.txt` (base `4a9e272`) and `evidence/floor.slice-3-after.txt` (line 1 `head=6b9a721…`). The commands and their order were the same.

| # | Command | Before | After | Verdict |
|---|---------|--------|-------|---------|
| 1 | `npx jest --ci` | 744 passed / 0 skipped; 50 suites | 1013 passed / 0 failed / 0 skipped; 63 suites | at or above |
| 2 | `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings | equal |
| 3 | `npx tsc --noEmit` | exit 0 | exit 0 (both new specs type-checked) | equal |
| 4 | `npm audit --audit-level=high --omit=dev` | 0 high, 0 critical, 2 moderate | the same 2 moderate (dompurify, yaml) | equal |
| 5 | `node scripts/check-elevated-ratchet.mjs` | committed=25 live=25 | committed=25 live=24 delta=-1 (the callback retired) | as required |
| 6 | `node scripts/check-migration-filenames.mjs` | 4 parse | 4 parse | equal; no migration in slice 3 |
| 7 | `node scripts/check-characterization-tags.mjs --all` | ok 18 | ok 27 | at or above |
| 8 | `validate.mjs --quick` | 118 / 2 failed / 1 skipped | 118 / 2 failed / 1 skipped | equal; the same by-design snapshot FAILs |
| 8b | `validate.mjs --check endpoints` | — | 5 passed, exit 0 | the Task 2 contract validates |
| 9 | `supabase db reset --local` | exit 0 | exit 0 | equal |
| 10 | pgTAP, unseeded | Files=6 Tests=86 PASS | Files=6 Tests=86 PASS | equal |
| 11 | seed load | 10 personas, 5 clubs, 6 memberships, 5 events, 2 rsvps, 0 saved | identical | equal (DEC-54) |
| 12 | pgTAP, seeded | Files=6 Tests=86 PASS | Files=6 Tests=86 PASS | equal |
| 13 | `npx playwright test` | 40 passed, 0 failed | 53 passed, 0 failed, first run | at or above |
| 14 | env non-null assertion census | 15 in 6 files | 0 | driven to 0 |
| 15 | `getSession(` census | 1 production call (`api/health:160`) | the same one call | unchanged, as required |
| 16 | `verifyAdmin()` census | 34 lines | 34 lines | equal (slice 5's) |
| 17 | legacy ban helper census | 14 lines, 10 callsites | 0 | driven to 0 |
| 18 | `from("club_members")` census | 42 | 42 | equal (slice 4's) |
| 19 | `(supabase as any)` census | 3 lines, 1 code site | the same | equal (slice 5's, F-072) |

Every row is at or above its before value. Every census that slice 3 had to drive down is at 0. The stack was left reset and seeded (block 20), and port 3000 was free before the run, after it, and at the end.

## 2. Playwright, before and after

| Run | File | Count | Exit |
|-----|------|-------|------|
| Phase before-floor | `evidence/floor.before.txt` block 13 | 40 passed (10 setup + 30) | 0 |
| Task 1 targeted run (the two new specs, over `f750240`) | `evidence/playwright.slice-3-after.txt` Part 1 | 22 passed (10 setup + 12) | 0 |
| **Slice 3 after (full suite, clean reset, head `6b9a721`)** | `evidence/playwright.slice-3-after.txt` Part 2 | **53 passed, 0 failed** | **0** |

53 is 40 + 13 new tests. Ten are ring tests and one is the F-027 404, all in `ban-and-onboarding-ring.spec.ts`. The other two are in `no-profile-row.spec.ts`. It was the first run with no retry. `git diff --stat 4a9e272 HEAD -- e2e playwright.config.ts` lists only the two new spec files, so the eight existing specs (`banned-redirect`, `protected-route-redirect`, `club-owner-surfaces`, `admin-moderation-queue`, `save-and-rsvp`, `event-read-path`, `anonymous-browse`, `admin-login-cookie-equivalence`) passed unedited.

## 3. Validated-workflow re-confirmation

Slice 3's production footprint is the output of `git diff --name-only 4a9e272 6b9a721 -- src supabase/migrations`, with tests excluded:

- 38 route files under `src/app/api/` (every state-changing non-admin arm, the four F-028 routes, and the deleted `auth-debug`), plus `src/app/auth/callback/route.ts` and `src/app/auth/signout/route.ts`
- `src/proxy.ts`, `src/instrumentation.ts`, `src/lib/env.ts`, `src/lib/ban.ts`, `src/lib/supabase/{client,server,service}.ts`
- `src/server/context.ts`, `src/server/authz/requireActiveUser.ts`, `src/server/authz/requireOnboarded.ts`, and `src/server/db/elevated/{index.ts,REGISTRY.md}`

No page, layout, component, hook, store, type or migration file is in that diff. `git diff --name-only 4a9e272 6b9a721 -- src/components src/hooks src/store src/types supabase/migrations 'src/app/**/page.tsx' 'src/app/**/layout.tsx'` prints nothing.

All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed below. Every named test is green in the runs in section 1.

| # | Validated workflow (PROJECT.md) | Touched by slice 3? | Re-confirmed after slice 3 by |
|---|-------------------------------|---------------------|-------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | **Yes.** Callback (`077a081`) and proxy (`e2d6d3a`) | **Every persona signs in:** Playwright `auth.setup.ts`, 10 persona sign-ins through the library's own cookie serializer. **Non-McGill rejected:** callback PRESERVE test 4, `route.test.ts` 'rejects a non-McGill address, signs it out, and deletes the orphaned auth user', unedited. `route-defect.test.ts` pins the new fail-closed sync |
| 2 | Anonymous visitors browse public event and club content | Partly. Only the four personalized routes changed (anonymous 401, DEC-39). Their client callers are user-gated. The rsvp GET and the club events GET were deliberately left alone | Playwright `anonymous-browse.spec.ts` (3) and the `event-read-path.spec.ts` PRESERVE tests, unedited |
| 3 | Onboarding interest tags; guard on unfinished onboarding | **Yes.** The guard now reads the database (`e2d6d3a`) and holds at the API ring (`aa50ff6`, `aa2191e`, `c620d16`) | **Onboarding still completes:** `ban-and-onboarding-ring.spec.ts` 'can still make the wizard's self-update' (PATCH `/api/users/<id>` 200) and 'can still complete onboarding' (POST `/api/onboarding/complete` 200 `{ success: true }`). Guard: 'is sent to onboarding from the home page', 'is still sent to onboarding with the needs_onboarding cookie deleted', and the direct-POST 403. `protected-route-redirect.spec.ts` (2), `src/proxy.test.ts`, `proxy-characterization.test.ts` |
| 4 | Browse, search, filter events by tag, date, time of day | No. `api/events/route.ts`, `useEvents` and the filter components are absent from the diff. `events/[id]/route.ts` changed only in its PATCH and DELETE arms | `events-list-characterization.test.ts`, `events-detail-characterization.test.ts`, `useEvents.test.ts`, `EventFilters.test.tsx`, `FilterSidebar.test.tsx`; Playwright `event-read-path.spec.ts` (12), `anonymous-browse.spec.ts` search test |
| 5 | Save/unsave events and RSVP | **Yes.** Guard prologue on save and rsvp POST and DELETE (`aa50ff6`) | Playwright `save-and-rsvp.spec.ts` (3), unedited. PRESERVE `save-characterization.test.ts`, `rsvp-characterization.test.ts`, `saved-events-characterization.test.ts`; 05-06 removed the two ban-asymmetry blocks with deletions only, and 05-07 made comment-only docblock edits. `ban-asymmetry-defect.test.ts` pins the intended change |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | Only `recommendations/feedback` POST (guard) and `user/engagement` POST changed. The recommendation read path and `src/lib/recommendations*` are absent from the diff | `src/lib/__tests__/recommendations.test.ts`, `src/lib/diversity.test.ts`; the write-handler PRESERVE file P1/P5 rows pin the anonymous feedback bytes |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | **Yes.** Guard prologue on 12 clubs-family arms (`aa2191e`) and on event create and invite (`aa50ff6`) | **Organizers reach their club surfaces:** Playwright `club-owner-surfaces.spec.ts` (3), unedited. `date-validation.test.ts`, `write-handlers-characterization.test.ts` P2/P3 rows, `club-owner` personas signed in by `auth.setup.ts` |
| 8 | Organizer events auto-approved; others moderated | Only the guard prologue on `events/create` (`aa50ff6`). The approval logic is unchanged | `date-validation.test.ts` (admin-role create 201); Playwright `admin-moderation-queue.spec.ts` (3), unedited |
| 9 | Follow/unfollow clubs; public club pages | Guard prologue on `clubs/[id]/follow` POST and DELETE (`aa2191e`). Public club pages are absent from the diff | Playwright `anonymous-browse.spec.ts` 'an anonymous visitor browses public club content'; the write-handler PRESERVE rows for the follow arms |
| 10 | Organizer event-level and club-level analytics | No. Both analytics routes are absent from the diff | `src/__tests__/api/events/analytics.test.ts`, `src/__tests__/api/clubs/analytics.test.ts`, `src/app/api/admin/analytics/users/route.test.ts` |
| 11 | Attendees review past events; aggregate feedback | Guard prologue on reviews POST only (`aa50ff6`) | `src/__tests__/api/events/reviews.test.ts` (its fixtures gained the context's `users` columns, with no assertion changed); the write-handler D rows for reviews POST |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | **Yes, the ban half.** Proxy (`e2d6d3a`) and every non-admin write arm. The admin routes are absent from the diff (slice 5) | **Banned users blocked:** Playwright `banned-redirect.spec.ts` (3), unedited, and `ban-and-onboarding-ring.spec.ts`: banned API write and read get 403 JSON, the banned page lands on `/banned`, suspended-active gets 403, and suspension-expired reads 200. Admin: `admin-moderation-queue.spec.ts` (3), `admin-login-cookie-equivalence.spec.ts` (1), `audit-shape.test.ts`, `src/lib/__tests__/ban.test.ts` |
| 13 | In-app notifications and email reminders (F-038 caveat) | Guard prologue on `notifications` POST and `notifications/[id]` PATCH (`c620d16`). Cron and the pages are absent from the diff | No e2e test covers this workflow, before or after. The two write arms are pinned at the handler ring by `write-handlers-characterization.test.ts` (their anonymous 401 rows, unedited) and `write-handlers-ring-defect.test.ts` (the banned, profile-less and un-onboarded refusals). The read path is untouched per the diff |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | No. `src/lib/classifier*.ts` and the edge function are absent from the diff | `src/lib/classifier.test.ts` |
| 15 | A/B experiment framework (F-017 caveat) | No. `src/lib/experiments.ts` and the admin experiments routes are absent from the diff | `src/lib/experiments.test.ts` |
| 16 | Interaction tracking feeds popularity and interaction signals | Guard prologue on `interactions` POST when a user is present (`c620d16`). Anonymous bytes are unchanged | `write-handlers-characterization.test.ts` P1/P5 (anonymous-tolerant arms, unedited) and the D rows. No e2e test covers the signal pipeline; the scoring SQL is untouched (no migration) |

Row 13 still has no end-to-end test, and row 16 has none for its signal pipeline. That coverage gap is stated here rather than filled with a test that does not exist, the same as at the slice 1 close. Both workflows' slice-3 changes are pinned at the handler ring.

## 4. Findings

**Closed (status set to `Fixed` in `.planning/audit/findings.json` by this plan, each with a `resolution`):**

- **F-003** (Medium): the proxy passed traffic through when the env vars were unset. Fixed by `7bef995` (validated config) and by `e2d6d3a` + `077a081`. Criterion clause 1: `proxy-defect.test.ts` rows a and a2. With the URL unset, the client construction throws `MissingEnvError`, which the proxy logs and answers with a fail-closed 500. `env.test.ts` asserts the readers throw. Criterion clause 2: `proxy-characterization.test.ts` (every protected route plus `/profile/edit`) and Playwright `protected-route-redirect.spec.ts`. Census 14 is at 0.
- **F-004** (Low): the callback granted admin from `ADMIN_EMAILS`. Fixed by `077a081`. Clause 1: `route-defect.test.ts` 'F-004: with the allowlist variable naming the signing-in address, no users update is issued'. Clause 2: `route.test.ts` test 5 upserts with `ADMIN_EMAILS` deleted in `beforeEach` (line 205).
- **F-027** (High): `/api/auth-debug` echoed identity. Deleted by `7bef995`. Clause 1: the Playwright test 'the deleted debug route (F-027) › answers 404 in the production build' (`6b9a721`), test 28 of the full run. Clause 2: `find src/app/api -path '*auth-debug*'` prints nothing.
- **F-062** (Medium): banned `/api/*` callers got a 307 to HTML. Fixed by `e2d6d3a`. Covered by `proxy-defect.test.ts` row e and by Playwright 'a permanently banned user': 403, `application/json`, `{ error: "Account suspended" }` on a write and a read, and `/banned` on a page.
- **F-077** (Medium): the callback's `next` was unvalidated. Fixed by `077a081`. The hostile absolute, protocol-relative and slash-backslash cases are in `route-defect.test.ts`. The criterion names `route.test.ts`, but tags are file-level, so a moved DEFECT pin cannot live in a PRESERVE file. The resolution records this location difference. `route.test.ts` test 6 (relative `next` honoured) passes unedited.
- **F-088** (Medium): the ring failed open on its own errors. Fixed by `e2d6d3a`, `aa50ff6`, `aa2191e` and `c620d16`. The proxy-defect rows b, c, d-api and d-page and the ring-defect D1/D2 rows moved (`defect-ledger.md` lines 40-43, 57-60, 67-68, 70-71). `ban-and-onboarding-ring.spec.ts` is green. `no-profile-row.spec.ts` proves DEC-35 end to end. Census 17 is at 0.
- **F-089** (Low): the onboarding guard was a deletable cookie. Fixed by the same four commits. The proxy-defect rows f and g and the D3 rows moved (`defect-ledger.md` lines 45-46, 61, 69, 72). The e2e direct POST returns 403 `{ error: "Onboarding required" }`.

**Kept Open, re-pointed:**

- **F-028** (Medium): `closes_in_phase` moves from `"05"` to `"06"`. Four of eight routes answer 401 in Phase 5 (05-06, DEC-39). The rsvp GET, `clubs/[id]/events` and `notifications/count` move with REFAC-19, and the eighth route (`auth-debug`) is deleted. The criterion's "each of the eight routes" is not met yet.

**Progress recorded, status unchanged:**

- **F-040** (High, Phase 6): the `ADMIN_EMAILS` reader is deleted (05-05, `077a081`), and the `ADMIN_API_KEY` reader goes in 05-14. The boot check in `register()` (`6e716fb`) covers the Supabase variables. `CRON_SECRET` remains.

`node .planning/audit/tools/validate.mjs --check findings` passes 8 of 8 and exits 0 after the edits. `FOUNDATION_AUDIT.md` was regenerated with `gen-foundation-audit.mjs` (91 findings, 91 ids referenced).

## 5. INTENTIONAL BEHAVIOUR CHANGEs shipped in slice 3

| Commit | Change | Pinned by |
|--------|--------|-----------|
| `7bef995` (05-04) | `/api/auth-debug` is deleted, so it answers 404 (F-027) | Playwright F-027 test; `env-assertions-defect.test.ts` census |
| `6e716fb` (05-04) | A production boot with a required Supabase variable missing fails in `register()` rather than serving (DEC-37) | `src/instrumentation.test.ts`; `evidence/boot-check.txt` |
| `e2d6d3a` (05-05) | The proxy fails closed. Env unset gives 500. A thrown error gives 500 (JSON under `/api/`). A failed ban read gives 500. A banned `/api/*` caller gets 403 `Account suspended` JSON instead of a 307. A caller with no profile row gets 403 `Profile not found` on `/api/*` and is signed out to `/?error=profile_sync_failed` on a page. Onboarding is read from the database, and the cookie is a hint only | `proxy-defect.test.ts` rows a–g; Playwright ring specs |
| `077a081` (05-05) | The callback grants no role. A profile-sync failure signs the user out to `/?error=profile_sync_failed` instead of admitting them with no row. A hostile `next` lands on `/` | `route-defect.test.ts` |
| `aa50ff6` (05-06) | 14 events-family write arms refuse banned, profile-less and un-onboarded callers, **DELETE arms included** (this closes the DEC-24 ban asymmetry). An anonymous `recommendations/feedback` POST with a malformed body now gets 401 instead of 400/500 | `write-handlers-ring-defect.test.ts`, `ban-asymmetry-defect.test.ts` |
| `7ff08c1` (05-06) | Four personalized routes answer anonymous callers 401 instead of a degraded 200 (F-028, DEC-39) | `anonymous-personalized-defect.test.ts`; `endpoints.json` via `7bccf15` |
| `aa2191e` (05-07) | 12 clubs-family arms get the same three refusals | `write-handlers-ring-defect.test.ts` |
| `c620d16` (05-07) | The remaining 13 arms are guarded. `onboarding/complete` and `users/[id]` PATCH are exempt from the onboarding guard only. The legacy ban helper is deleted. In `interactions` and `feedback`, a banned, profile-less or un-onboarded **signed-in** caller with an invalid body now gets the 403 before the 400. Anonymous bytes are unchanged | `write-handlers-ring-defect.test.ts` and its completeness test |

Two log lines changed that are not response bytes: `user/engagement` POST's `Unauthenticated request` warn (DI-45), and the proxy now logs `[Middleware] Error:` on the new 500 paths.

## 6. No intentional visual change on seeded data

1. **The UI assertions did not move, and they pass.** `git diff --stat 4a9e272 HEAD -- e2e playwright.config.ts` adds two spec files and edits none. All 53 tests pass from a clean reset.
2. **No rendering file changed.** The slice-3 diff in section 3 contains no page, layout, component, hook, store or type.
3. **Seeded personas see what they saw before.** The one persona whose pages changed is `mid_onboarding_student` (`onboarding_completed: false`). It was already redirected to `/onboarding` by the cookie that `auth.setup.ts` carries. It is now redirected even without the cookie, which is F-089's fix and not a visual change. The banned personas already landed on `/banned` (`banned-redirect.spec.ts`, unedited).

## 7. REFAC-11, measured clause by clause

REFAC-11: "Slice 3 (auth/session/ban/onboarding): `getUser()` at every authorization decision, middleware is advisory-only and the ban check fails closed, the onboarding guard cannot be bypassed by direct API calls, env-var non-null assertions are replaced with validated config."

| Clause | Evidence | Verdict |
|--------|----------|---------|
| `getUser()` at every authorization decision | Census 15: the only production `getSession(` is `api/health:160`, which gates nothing. `src/server/__tests__/getsession-gate.test.ts` (05-02, PRESERVE) fails if another appears. The context (`src/server/context.ts:81`), the proxy and `verifyAdmin()` all call `getUser()` | **Met** |
| the ban check fails closed | Proxy: a failed ban read gives 500, never "not banned" (`proxy-defect.test.ts` row c). No profile row gives 403 or a sign-out (rows d-api, d-page; `no-profile-row.spec.ts`). Handler ring: `requireActiveUser` denies a missing row (D2 rows). The legacy helper that admitted a missing row is deleted (census 17 = 0) | **Met** |
| middleware is advisory-only | For every state-changing non-admin arm (39 arms, completeness-tested in `write-handlers-ring-defect.test.ts`), the handler makes the ban, profile and onboarding decision itself. So a request that never passed the proxy is still refused (the D1–D3 unit rows call handlers directly with no proxy). GET arms carry no ban guard by DEC-34, so a banned user reading their own data is a policy the proxy adds on top, not an authorization gap. **Not yet met on the admin and moderation surface:** `verifyAdmin()` and the seam's `requireRole` read `roles` only, so a banned user who holds `admin` is refused on `/api/admin/*` only by the proxy's (fail-closed) ban read. Registered as **DI-48**, owner slice 5 (05-12/05-13) | **Partial** |
| the onboarding guard cannot be bypassed by direct API calls | `requireOnboarded` on every state-changing arm except DEC-34's two wizard exemptions (D3 rows, 14 + 12 + 11). e2e: the direct POST gets 403 `Onboarding required`, and deleting the cookie does not help (database truth) | **Met** |
| env-var non-null assertions replaced with validated config | Census 14 = 0; `src/lib/env.ts` validated readers; `env-assertions-defect.test.ts` census empty; boot check `6e716fb` | **Met** |

**Verdict: PARTIAL.** Four clauses are met with committed evidence. The clause "middleware is advisory-only" is met for the whole non-admin API surface but not for the admin arms' ban decision (DI-48). REFAC-11 stays unchecked in `.planning/REQUIREMENTS.md`, and its traceability row names that clause. It can flip to Complete when slice 5 composes `requireActiveUser` into the admin guard and pins it, or when the phase owner records that a banned admin is out of REFAC-11's scope.

## 8. Deferred items registered at this close

From the 05-02..05-07 SUMMARYs, in `evidence/deferred-items.md` Part 4: **DI-44** (the `recommendations/feedback` dead body-`user_id` fallback and the unprobed anon-role RLS write), **DI-45** (auth-failure log lines removed by the context adoption), **DI-46** (the stale CLAUDE.md `PROTECTED_ROUTES` line reference: 114 → 188), and **DI-47** (the unreachable `inferred-tags` 404 and stale PRESERVE prose). This plan's own measurement adds **DI-48** (the admin arms' ban decision). The next id is DI-49. Observations already acted on (the `context.ts` docblock, the PRESERVE "ban asymmetry" bullets) are listed there with where they closed.

Slice 3's floor is green, so slice 4 may start.
