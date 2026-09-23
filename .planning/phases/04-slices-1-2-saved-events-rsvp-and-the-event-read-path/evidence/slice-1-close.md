# Slice 1 close-out: saved events, RSVP, and the friends read

**Plan:** 04-06 · **Phase:** 04 · **Recorded:** 2026-09-23 · **Measured on:** `9530d35` (04-06 Task 2), phase base `794556a` · **Author:** executor, local stack only

Slice 1 covered the save, RSVP, saved-events, calendar and friends handlers. Its 04-02 characterization net was laid down first; 04-03 narrowed the seam; 04-05 did the refactor (`a5ee4fc`, `fe4e9f9`, `d40dee4`, `1351480`); 04-06 did the close-out (`a037d95`, `9530d35`). Every claim below cites a command output in an evidence file or a commit. Nothing is taken from a planning document.

## 1. Floor, before and after

Source: `evidence/floor.before.txt` (base `794556a`) and `evidence/floor.slice-1-after.txt` (line 1 `head=9530d35…`). The commands were the same and ran in the same order.

| # | Command | Before | After | Verdict |
|---|---------|--------|-------|---------|
| 1 | `npx jest --ci` | 358 passed / 5 skipped / 363; 34+1 of 35 suites | 512 passed / 5 skipped / 517; 46+1 of 47 suites | at or above |
| 2 | `npx jest --ci src/__tests__/api/events src/hooks/useEvents.test.ts` | 7 suites; 101 passed, 1 skipped | 18 suites; 244 passed, 1 skipped | at or above |
| 3 | `npm run lint` | 0 errors, 19 warnings | 0 errors, 19 warnings | equal |
| 4 | `npx tsc --noEmit` | exit 0, test files excluded | exit 0, test files included | equal exit, wider scope (DI-24) |
| 5 | `npm audit --audit-level=high --omit=dev` | 0 high, 0 critical, 2 moderate | 0 high, 0 critical, 2 moderate (same dompurify, yaml) | equal |
| 6 | `node scripts/check-elevated-ratchet.mjs` | committed=24 live=24 delta=0 | committed=25 live=25 delta=0 | as required (04-03's one-time widening) |
| 7 | `node scripts/check-migration-filenames.mjs` | 4 parse | 4 parse | equal; no migration added |
| 8 | `node .planning/audit/tools/validate.mjs --quick` | 118 / 2 failed / 1 skipped | 118 / 2 failed / 1 skipped | equal; the same two by-design snapshot FAILs |
| 9 | `supabase db reset --local` | exit 0 | exit 0 | equal |
| 10 | pgTAP, unseeded | Files=6 Tests=86 PASS; 040: 21 SKIP | Files=6 Tests=86 PASS; 040: 21 SKIP | equal |
| 11 | seed load | 10 personas, 5 clubs, 6 memberships, 5 events, 2 rsvps, 0 saved | identical | equal |
| 12 | pgTAP, seeded | Files=6 Tests=86 PASS; 040: 21 ok, 0 SKIP | Files=6 Tests=86 PASS; 040: 21 ok, 0 SKIP | equal |
| 13 | `npx playwright test` | 27 passed, exit 0 | 37 passed, 0 failed, exit 0 | at or above |
| 14 | stale event-date census | 8 lines, 4 files | 1 line, 1 file (`src/lib/tagMapping.ts:98`, owned by 04-07) | lower, as required |
| 15 | `(supabase as any)` census over `src/` | 4 lines (2 code sites) | 3 lines (1 code site, `src/app/moderation/page.tsx:78`, F-072, Phase 5) | lower, as required |

Every row is at or above its before value. The two censuses are lower, as the plan requires, and the ratchet reads `committed=25 live=25 delta=0`.

## 2. Playwright, before and after

| Run | File | Count | Exit |
|-----|------|-------|------|
| Phase before-floor (27 specs + setup) | `evidence/floor.before.txt` block 13 | 27 passed | 0 |
| Slice 1 before (04-02, adds the cancelled-RSVP test) | `evidence/playwright.slice-1-before.txt` | 28 passed | 0 |
| Most recent (04-04, adds `event-read-path.spec.ts`, 9 tests) | `evidence/playwright.slice-2-before.txt` | 37 passed | 0 |
| **Slice 1 after (this plan)** | `evidence/playwright.slice-1-after.txt` | **37 passed, 0 failed, 0 skipped** | **0** |

The after run started from a clean state. Port 3000 was free (`lsof` exit=1), then `supabase db reset --local`, then the seed, then a fresh `npm run build && npm run start` through Playwright's webServer, which never reuses a server. It is the first Playwright run since the 04-05 refactor, which ran Jest only by design. `git diff --stat 350fda3 HEAD -- e2e playwright.config.ts` is empty, so no spec changed between the 04-04 run and this one.

## 3. Validated-workflow re-confirmation

Slice 1's production footprint is the output of `git diff --name-only 794556a HEAD -- src/app src/lib src/server src/components src/hooks src/store src/proxy.ts src/types supabase/migrations`:

- five route files: `src/app/api/events/[id]/save/route.ts`, `…/[id]/rsvp/route.ts`, `…/[id]/friends/route.ts`, `src/app/api/users/saved-events/route.ts`, `src/app/api/calendar/events/route.ts`
- `src/server/context.ts` (04-03). Its only non-test importers are those five routes, per `grep -rln '@/server/context\|@/server/authz\|@/server/errors\|@/server/http' src`
- `src/server/db/elevated/index.ts`, comment only, and `REGISTRY.md`, documentation

No page, component, hook, store, proxy, type or migration file appears in that diff. The one other file Slice 1 touched outside `src/` and `supabase/migrations` is a comment in `supabase/functions/events-webhook/index.ts` (`a037d95`), and its non-comment diff is empty.

A workflow is **touched** only if it reaches one of those five routes. Every row in the table below therefore names either the test that re-confirms it after Slice 1 or the diff that shows it is untouched. All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed.

| # | Validated workflow (PROJECT.md) | Touched by Slice 1? | Re-confirmed after Slice 1 by (all green in the runs above) |
|---|-------------------------------|---------------------|--------------------------------------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | No: `src/app/auth/**` and `src/proxy.ts` are absent from the diff | `src/app/auth/callback/route.test.ts` (8 passed); Playwright `auth.setup.ts`, 10 persona sign-ins |
| 2 | Anonymous visitors browse public event and club content | No: the anonymous routes and pages are absent from the diff. RSVP GET and friends GET are anonymous-readable and are covered in row 5 | Playwright `anonymous-browse.spec.ts` (3 tests); `event-read-path.spec.ts` 4 PRESERVE tests |
| 3 | Onboarding interest tags; middleware guards unfinished onboarding | No: `src/proxy.ts` and `src/app/onboarding/**` are absent from the diff | `src/proxy.test.ts` (20 passed); Playwright `protected-route-redirect.spec.ts` (2 tests) and the mid-onboarding persona sign-in |
| 4 | Browse, search, filter events by tag, date, time of day | No: `src/app/api/events/route.ts`, `[id]/route.ts`, `src/hooks/useEvents.ts` and the filter components are absent from the diff | `events-list-characterization.test.ts` (33), `events-detail-characterization.test.ts` (16), `get-events.test.ts` (23 + 1 skipped), `useEvents.test.ts` (20), `EventFilters.test.tsx` (5), `FilterSidebar.test.tsx` (4); Playwright `anonymous-browse.spec.ts` search test, `event-read-path.spec.ts` (9) |
| 5 | **Save/unsave events and RSVP (going/interested/cancelled)** | **Yes, the slice's own workflow.** save, rsvp, saved-events and calendar routes (`a5ee4fc`), RSVP counts (`d40dee4`), and the friends-going read (`fe4e9f9`, `1351480`) | Playwright `save-and-rsvp.spec.ts`: "a student saves an event and it appears on their profile", "a student RSVPs going to an event", "a cancelled RSVP is not counted as going". PRESERVE suites: `rsvp-characterization.test.ts` (20), `save-characterization.test.ts` (21), `saved-events-characterization.test.ts` (14), `calendar-events-characterization.test.ts` (12), all with an empty diff against `f5b07fa` per 04-05. `rsvp.test.ts` (14). DEFECT suites now pinning the fixes: `rsvp-count-defect.test.ts` (4), `friends-defect.test.ts` (6) |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | No: recommendation routes, `src/lib/recommendations*` and `src/lib/diversity.ts` are absent from the diff | `src/lib/__tests__/recommendations.test.ts` (13), `src/lib/diversity.test.ts` (12) |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | No: club and event-create routes and pages are absent from the diff | Playwright `club-owner-surfaces.spec.ts` (3 tests); `date-validation.test.ts` (22, create and PATCH) |
| 8 | Organizer events auto-approved; others go through moderation | No: `src/app/api/events/create/**` and the moderation routes are absent from the diff | `date-validation.test.ts` (22, admin-role create returns 201); Playwright `admin-moderation-queue.spec.ts` (3 tests: pending event and club in the queue, Pending filter, student excluded) |
| 9 | Follow/unfollow clubs; public club pages | No: club follow routes and `src/app/clubs/**` are absent from the diff | Playwright `anonymous-browse.spec.ts` "an anonymous visitor browses public club content" |
| 10 | Organizer event-level and club-level analytics | No: both analytics routes are absent from the diff. Their suites' fixtures now use `start_date` (`a037d95`, tests only) | `src/__tests__/api/events/analytics.test.ts` (4), `src/__tests__/api/clubs/analytics.test.ts` (5), `src/app/api/admin/analytics/users/route.test.ts` (3) |
| 11 | Attendees review past events; organizers see aggregate feedback | No: `src/app/api/events/[id]/reviews/route.ts` is absent from the diff. Its suite was only typed (`9530d35`) | `src/__tests__/api/events/reviews.test.ts` (13) |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | No: moderation, admin and ban code is absent from the diff | Playwright `admin-moderation-queue.spec.ts` (3), `banned-redirect.spec.ts` (3), `admin-login-cookie-equivalence.spec.ts` (1); `src/lib/__tests__/ban.test.ts` (4); `audit-shape.test.ts` (6) |
| 13 | In-app notifications and email reminders (F-038 caveat) | No: `src/app/api/notifications/**`, `src/app/api/cron/**` and `src/app/notifications/**` are absent from the diff | Untouched per the diff. No automated test covers this workflow either before or after; it is not re-confirmed by a test |
| 14 | Instagram scraper pipeline classifies and ingests with dedup | No: `src/lib/classifier*.ts` is absent from the diff. The edge function changed one comment and no code (`a037d95`) | `src/lib/classifier.test.ts` (39) |
| 15 | A/B experiment framework (F-017 caveat) | No: `src/lib/experiments.ts` and `src/app/api/admin/experiments/**` are absent from the diff | `src/lib/experiments.test.ts` (11) |
| 16 | Interaction tracking feeds popularity and interaction signals | No: `src/app/api/interactions/**` and `src/hooks/useTracking.ts` are absent from the diff | Untouched per the diff. No dedicated suite exists; it is not re-confirmed by a test |

Rows 13 and 16 are the only rows without a named test. The coverage gap is stated here rather than filled with a test that does not exist. Neither workflow shares a file with Slice 1.

## 4. Findings

**Closed (status set to `Fixed` in `.planning/audit/findings.json` by this plan):**

- **F-079**: RSVP counts loaded every row and counted in JavaScript. Fixed by `d40dee4`, which uses two parallel `{ count: "exact", head: true }` reads. `rsvp-count-defect.test.ts` moved in the same commit (four ledger rows in `evidence/defect-ledger.md`). `rsvp-characterization.test.ts` passed unedited across the fix, and Playwright's two RSVP count tests pass here.
- **F-071**: the friends fallback passed a builder to `.in()`. Fixed by `1351480`: an array of followed ids is passed, and the last `(supabase as any)` under `src/app/api/` is gone (row 15). `friends-defect.test.ts` moved in the same commit (four ledger rows).

**Partially closed:**

- **F-066**: the clause "`npx tsc --noEmit` type-checks the test files with zero diagnostics" is met by `9530d35`. The census went from 71 errors in 7 files to 0 (`evidence/tsc-tests-included.txt`). The clause "`npx jest --ci` reports zero skipped suites" is **not** met: `src/app/api/events/route.test.ts` is still skipped (4 pending), and that clause belongs to 04-09. Status stays `Open`. The record had two `resolution` keys (Phase 3's, then Phase 2's). JSON parsers keep only the last one, so Phase 3's paragraph had never reached `FOUNDATION_AUDIT.md`. This plan merged them into one key, in the order Phase 2, Phase 3, Phase 4. That merge is the one extra deleted line in `git diff --numstat` (5 added, 4 deleted).

**Residue removed, status unchanged:**

- **F-050**: stale date fixtures in the two analytics suites and the webhook comment (`a037d95`). One reference remains, in `src/lib/tagMapping.ts:98`. It is 04-07's, and the status flip is 04-11's.

## 5. How "no intentional visual change" was established

1. **The UI assertions did not move and they pass.** `git diff --stat 350fda3 HEAD -- e2e playwright.config.ts` is empty, and all 37 Playwright tests pass from a clean reset. These include the three `save-and-rsvp.spec.ts` tests that read the saved state on the profile and the RSVP counts after a reload.
2. **No rendering file changed.** The Slice 1 diff in section 3 contains no page, component, hook or store.
3. **Count values are identical below 1000 rows.** Before `d40dee4`, the counts were `.filter().length` over a row select capped at `max_rows = 1000`. After it, they are server-side `COUNT(*)`. The two are equal whenever an event has at most 1000 non-cancelled RSVPs, which covers every seeded event (2 RSVPs) and every fixture in `rsvp-characterization.test.ts`. That suite pins the response counts regardless of how they are computed, and it passed unedited across `d40dee4` (04-05 SUMMARY).
4. **The friends fallback does not run on any deployed schema.** `get_friends_going_to_event` is created in `supabase/migrations/20260915214553_baseline.sql:295` and granted to `anon` at `:2460`. The fallback `1351480` fixed runs only when that RPC errors, so the primary path's output, and therefore the "friends going" UI, is unchanged.

## 6. The DEC-29 log-line difference

Adopting `createRequestContext()` + `requireUser()` in `a5ee4fc` removed exactly **three** server-side `console.warn` lines that fired when `getUser()` returned an auth error just before a 401: rsvp POST, rsvp DELETE, and saved-events GET. `git show a5ee4fc -- src/app | grep -E '^[-+].*console\.(warn|error|log)'` prints three `-` lines and no `+` line. None of the other three Slice 1 commits changed a log line. The 401 response is byte-identical (`{ "error": "Unauthorized" }`), as the unedited PRESERVE suites show. DEC-29 records this as intended, and auth-failure logging moves to Phase 6's structured logging. The 04-05 SUMMARY calls these "four … 401 paths"; the diff counts three lines, and the diff is authoritative.
