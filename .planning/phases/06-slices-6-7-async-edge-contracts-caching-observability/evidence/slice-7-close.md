# Slice 7 close-out: contracts, caching, logging, Sentry, health, and the phase's last code

**Plan:** 06-18 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-27 · **Measured on:** `f4c59e4` (the supabase-js 2.116.0 bump, the last code change of the phase; `evidence/floor.phase-after.txt` line 1) · **Slice range:** `f550de9..f4c59e4` (06-07..06-18) · **Author:** executor, local stack only

Slice 7 covered every route handler's input, cache and error surface, the server's logging, error reporting,
the health endpoint, the CSP and the admin page gates. The order was:

- characterization (06-07: every slice-7 400 pinned, F-025/F-026/F-029/F-054/F-055/F-058/F-059/F-094 pinned as DEFECT, the console-coupled test inventory);
- the contracts (06-08 events and calendar, 06-09 clubs, users and profile, 06-10 admin and moderation, which took the contracts census to zero);
- client reuse (06-11);
- the logger, `withRoute` and the cache classes (06-12);
- the two route sweeps (06-13, 06-14, which removed the `vercel.json` rule);
- the endpoint contract regeneration and the cache tests (06-15);
- Sentry and the CSP (06-16);
- health and the admin page gates (06-17);
- this plan's F-085 fix and the supabase-js bump (06-18).

Every claim below cites a command output in an evidence file or a commit. `evidence/` means
`.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/`.

## 1. Floor: before, slice-6 after, phase after

Sources: `evidence/floor.before.txt` (base `f186621`), `evidence/floor.slice-6-after.txt` (`71bfd55`) and
`evidence/floor.phase-after.txt` (line 1 `head=f4c59e4…`). The phase after-floor ran from a clean
`supabase db reset --local`, twice (blocks 10 and 14a), on 2026-09-27 from 18:08Z.

| # | Command | Before (f186621) | Slice 6 after (71bfd55) | Phase after (f4c59e4) |
|---|---------|------------------|-------------------------|-----------------------|
| 1 | `npx jest --ci --json` | 1651 passed, 1 skipped; 88 suites | 1995 passed, 1 skipped; 103 suites | **3439 passed, 0 failed, 1 skipped; 130 suites (129 run, 1 skipped)**; the only pending test is the Upstash live-store contract (block 1b) |
| 2 | `npm run lint` | 0 errors, 18 warnings | 0 errors, 18 warnings | 0 errors, 17 warnings |
| 3 | `npx tsc --noEmit` | exit 0 | exit 0 | exit 0 |
| 4 | `npm audit --audit-level=high --omit=dev` | 0 high, 2 moderate | the same | exit 0: 0 high, 0 critical, 2 moderate, 1 low (`@babel/core`, published during the phase; no Phase 6 install touched it) |
| 5 | elevated ratchet | committed=2 live=2 | committed=0 live=0 | **committed=0 live=0** |
| 6 | migration filenames | 8 parse | 9 parse | 9 parse |
| 7 | characterization tag gate | ok 34 | ok 44 | ok 57 |
| 7b | `node scripts/check-contracts.mjs` | — | committed=86 live=86 | **committed=0 live=0**, empty allow-list |
| 7d | `node scripts/check-contracts.mjs --client` | — | — | client files=38 violations=0 |
| 7e | `node scripts/check-server-console.mjs` | — | — | committed=2 live=2 (`src/lib/tagMapping.ts` S1, the auth callback's redirect S2) |
| 8 | `validate.mjs --quick` | 118/2/1 | 118/2/1 | 118/2/1, the same two by-design snapshot FAILs |
| 8b | `validate.mjs --check endpoints` | — | — | 5 passed, exit 0 |
| 8c | types drift | — | empty | empty |
| 8d | CI-env build (06-16's command, every Sentry variable blank) | — | exit 0, 98 pages | exit 0, 98 pages |
| 10-13 | reset; pgTAP unseeded; seed; pgTAP seeded | 8 migrations; Files=11 Tests=200 | 9; Files=13 Tests=260 | **9; Files=13 Tests=260 PASS both runs** |
| 15 | `npx playwright test` (production build, CSP enforced from 06-16) | 97 passed | 100 passed | **269 passed, 0 failed** (two halves, 189 + 80, first run each) |
| 16a/16b | cron run history | — | 0 runs, then 1 succeeded run per job at 02:00Z | 0 runs at 18:13Z; after the 18:30Z boundary reminders 2 runs and feedback 1 run, all succeeded, 0 failed |
| 16c | `cron.job` vs production | — | EQUAL | EQUAL |
| 17 | residue after Playwright | saved_events=1 | saved_events=1 | saved_events=1 (the save spec's own row), the rest the seed |
| C1 | server `console.*` (the before-floor's scope list) | 160 lines in 56 files | 158 in 54 | **1 line in 1 file: `src/lib/tagMapping.ts`** |
| C2 | raw `request.json()` in route files | 21 in 20 | 18 in 17 | **0** |
| C3 | `.formData()` in route files | 5 in 5 | 5 in 5 | **0** |
| C4 | `searchParams` reads in route files | 59 in 19 | 53 in 15 | 4 in 1: the auth callback's four OAuth parameters, excepted by name |
| C5 | `readJsonObject(` in route files | 15 in 15 | 15 in 15 | **0** |
| C6 | `getSession(` outside tests | 1 (health) | 1 | **0** |
| C7 | caught-error `.message` in route files | 40 in 22 | 40 in 22 | 1 in 1: the callback's redirect (DI-98) |
| C8 | route files setting Cache-Control; `vercel.json` headers | 4 files; the blanket rule | the same | **0 files; `vercel.json` has no `headers`** |
| C9 | zod importers | 0 | 10 (7 non-test) | 19 (12 non-test: `src/server/body.ts`, ten `src/contracts/*.ts`, the webhook contract); `zod@4.6.5` at the root, the dev copies deduped |

Every required row is green: Playwright 0 failed with `bypassCSP: false`; Jest 0 failed with the one pending
test in the Upstash suite; pgTAP Files=13 PASS unseeded and seeded; ratchet `committed=0 live=0`; both
contract censuses and the console census exit 0; types diff empty; build exit 0. Port 3000 was free before the
database blocks and before and after each Playwright half, with no server process left behind.

### Playwright, across the slice

| Run | File | Count | Exit |
|-----|------|-------|------|
| Slice 6 after (full) | `evidence/playwright.slice-6-after.txt` | 100 passed | 0 |
| 06-14 full, three parts, after the vercel.json removal | `evidence/route-adoption-b.txt` | 0 failed | 0 |
| 06-15 full, after the cache specs | `evidence/cache-e2e.txt` | 243 passed | 0 |
| 06-16 full, first run with the CSP enforced | `evidence/playwright.csp.txt` | 259 passed | 0 |
| 06-17 targeted (health, gates, admin guard, moderation queue) | `evidence/admin-page-gates.txt` | 56 passed | 0 |
| **Phase after (full, clean reset, head `f4c59e4`)** | `evidence/playwright.phase-after.txt` | **269 passed, 0 failed** | **0** |

269 = 06-16's 259 + `e2e/specs/health.spec.ts` (4) + `e2e/specs/admin-page-gates.spec.ts` (6). Slice 7 added five
spec files and one helper and edited no earlier spec (`git diff --name-status f550de9 HEAD -- e2e` lists only
`A` rows; `playwright.config.ts` changed for `bypassCSP: false` and the blanked Sentry variables).

## 2. Validated-workflow re-confirmation, after slice 7 and the phase

Slice 7's production footprint is 172 non-test files under `src/`, `supabase/`, `next.config.js`,
`vercel.json`, `playwright.config.ts` and `package.json` (`git diff --name-only f550de9 f4c59e4`): every route
file (91, on `withRoute`), the `src/server/` modules `body.ts`, `route.ts`, `log.ts`, `http.ts` and `context.ts`, `src/contracts/*`, the proxy and
instrumentation, the Sentry modules, the admin page layouts, the client hooks and mutation callers, the
health page, and the two packages.

Four PRESERVE-tagged suites were edited in slice 7, each under a recorded rule and each still green:
`admin-guard-characterization.test.ts` and `write-handlers-characterization.test.ts` lost only their
source-form tree scans, which moved into the DEFECT suites `admin-arm-tree-defect.test.ts` and
`write-arm-tree-defect.test.ts` (06-13, ledger rows); `recommendations-family-characterization.test.ts` lost one
error-text row to `batch-error-text-defect.test.ts` (06-14, ledger rows); `getsession-gate.test.ts` tightened
from the health route to an empty list, the change its own header anticipated (06-17). Every behaviour row of
every PRESERVE suite is unedited, including the auth callback suite and the three proxy suites.

All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed. Every named test is
green in the phase after-floor (`evidence/floor.phase-after.txt` block 1; `evidence/playwright.phase-after.txt`).

| # | Validated workflow (PROJECT.md) | Touched by slice 7? | Re-confirmed at the phase close by |
|---|-------------------------------|---------------------|-------------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | The callback moved onto `withRoute` and the logger only (06-14); its redirect bytes are unchanged | **Every persona signs in:** `e2e/auth.setup.ts`, 10 of 10 in each half (20 sign-ins). **Non-McGill rejected:** `src/app/auth/callback/route.test.ts`, PRESERVE, unedited. The proxy PRESERVE suites (`src/proxy.test.ts`, `src/proxy-characterization.test.ts`) unedited |
| 2 | Anonymous visitors browse public event and club content | Yes: the public reads now send their class from the origin (`public-30-60`, `public-60-120`, `public-60-300`) instead of `vercel.json`; event detail is private (C7) | `e2e/specs/anonymous-browse.spec.ts` (3); `e2e/specs/event-read-path.spec.ts` (12); `e2e/specs/public-profile-privacy.spec.ts` (1); `e2e/specs/cache-headers.spec.ts` (all 11 public rows answer 200 anonymously with their class); `e2e/specs/csp.spec.ts` (no CSP report on the public pages) |
| 3 | Onboarding interest tags; guard on unfinished onboarding | The onboarding and profile/interests routes read through contracts (06-09) | `e2e/specs/ban-and-onboarding-ring.spec.ts` (11, including the wizard and the direct-POST 403); `e2e/specs/protected-route-redirect.spec.ts` (2); `src/__tests__/contracts/bad-request-characterization.test.ts` rows for profile/interests, unedited |
| 4 | Browse, search, filter events by tag, date, time of day | Yes: `/api/events` reads through `EventsListQuery` (06-08) and is `public-30-60` (06-14) | `e2e/specs/event-read-path.spec.ts` (12); `events-list-characterization.test.ts` and `events-detail-characterization.test.ts`, unedited. The search still falls back to ILIKE (F-078, pre-existing) |
| 5 | Save/unsave events and RSVP | Yes: RSVP bodies through contracts (06-08); the rsvp GET private (06-14); the saved-events upcoming floor is the feed's (F-085, `b8e20f4`) | `e2e/specs/save-and-rsvp.spec.ts` (3), unedited; `e2e/specs/csrf-origin.spec.ts` (4); `saved-events-characterization.test.ts` PRESERVE, unedited through the F-085 fix; the saved row in residue block 17 |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | The recommendation routes moved onto `withRoute` (06-14); their own `private, no-store` lines became the class | `recommendations-characterization.test.ts` (13 PRESERVE rows), unedited; `e2e/specs/async-edge.spec.ts` 'FIXED F-017' (signed-in 200, `source: "personalized"`); pgTAP 070 row 1 (the formula's md5) in blocks 11 and 13. Caveats unchanged: F-041; DI-82 |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | Yes: club bodies through contracts with one link rule (06-09); club routes on `withRoute` (06-13); `my-clubs` hooks typed (06-11) | `e2e/specs/club-owner-surfaces.spec.ts` (3), `club-authorization.spec.ts` (19), `club-invitation-acceptance.spec.ts` (4), unedited; `club-gates-characterization.test.ts` unedited |
| 8 | Organizer events auto-approved; others moderated | Events create through `CreateEventBody` (06-08) | `e2e/specs/admin-moderation-queue.spec.ts` (3); `club-gates-characterization.test.ts` P6 rows; pgTAP 060 |
| 9 | Follow/unfollow clubs; public club pages | The club detail read is `public-60-300` (06-13) | `e2e/specs/anonymous-browse.spec.ts` (the public club page); the follow rows of `write-handlers-characterization.test.ts` (behaviour rows unedited); `cache-headers.spec.ts` club rows |
| 10 | Organizer event-level and club-level analytics | Wrapped private (06-13, 06-14); response schemas checked in development (06-11) | `club-authorization.spec.ts` owner and organizer analytics rows; `src/__tests__/api/events/analytics.test.ts`, `src/__tests__/api/clubs/analytics.test.ts` |
| 11 | Attendees review past events; aggregate feedback | `ReviewBody` (06-08) | `src/__tests__/api/events/reviews.test.ts`; the reviews rows of `bad-request-characterization.test.ts` |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | Yes: admin contracts and canonical ids (06-10); admin routes on `withRoute` (06-13); banned admins refused on admin pages (06-17) | `e2e/specs/admin-guard.spec.ts` (3), `admin-write-paths.spec.ts` (5), `admin-audit-row.spec.ts` (2), `admin-moderation-queue.spec.ts` (3), `banned-redirect.spec.ts` (3), `event-moderation-notifications.spec.ts` (6), unedited; `admin-page-gates.spec.ts` (6, new); `admin-guard-characterization.test.ts` behaviour rows unedited. Caveats: F-007 local-only with DI-23; the admin club list and organizer-request queue still 500 on the reset schema (DI-87) |
| 13 | In-app notifications and email reminders (F-038 caveat) | The notifications routes on `withRoute` (06-14); the count hook typed (06-11) | `notifications-characterization.test.ts` PRESERVE, unedited; `event-moderation-notifications.spec.ts` (6). **Reminders:** the pg_cron jobs after the fresh reset, block 16b (§ 3). Email half: F-038, owner decision, Open at "08" |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | No slice-7 change to the webhook | `src/lib/classifier.test.ts`; `src/__tests__/webhook/*` (4 suites) unedited since 06-03 and `57cb55f`. Live only after DI-81's redeploy; the Deno suite has not run (DI-84); three malformed payloads still 500 (DI-83) |
| 15 | A/B experiment framework (F-017 caveat resolved in slice 6) | Experiment bodies through `ExperimentCreateBody`/`ExperimentUpdateBody` (06-10) | `e2e/specs/async-edge.spec.ts` 'FIXED F-017'; `src/lib/experiments.test.ts`; `experiment-assignment-defect.test.ts` |
| 16 | Interaction tracking feeds popularity and interaction signals | The interactions route on `withRoute` (06-14) | `interactions-feedback-characterization.test.ts` PRESERVE, unedited; pgTAP 070 rows 3-4. No e2e test covers the signal pipeline, as at every earlier close |

## 3. Closures

**Findings closed at this slice close** (status `Fixed` in `.planning/audit/findings.json`, each with a resolution
citing its commits and `evidence/PHASE-6-COMPLETION.md`):

- **F-026** (High): every admin and authenticated row answers `private, no-store` on its success and 401 paths
  (`e2e/specs/cache-headers.spec.ts`, `64939b2`); `vercel.json`'s rule deleted (`6221669`).
- **F-029** (Medium): anonymous `/api/health` answers `{ status, version }` only; the report needs an admin
  session or the `HEALTH_TOKEN` bearer (`747ef77`, DEC-78).
- **F-054** (Medium): `/docs` redirects anonymous and non-admin callers (`00aa06d`, DEC-79).
- **F-058** (Medium): every route file on `withRoute` (census, `PENDING_WRAP` empty), request ids through the
  proxy and wrapper; the 429 clause from Phase 5.
- **F-059** (Medium): no route handler puts a caught error's message in a response body; the one residue is the
  callback's redirect query (DI-98).
- **F-085** (Low): the saved-events floor is the feed's (`b8e20f4`).
- **F-094** (Medium): contracts census `committed=0 live=0`; the malformed-input DEFECT suites moved to 400; the
  webhook's three rows are its stated residue (DI-83).

**Kept Open at "08", with the unmet clause named:** F-025 (the real-CDN two-session probe, DI-81), F-055
('unsafe-inline', DI-80), F-028 (the rsvp GET and club events GET stay 200 by DEC-69; owner risk-acceptance or a 401
decision). **F-037** was closed at the slice-6 close and is re-observed here: on the final code, after the 18:09:22Z reset, `send-event-reminders` ran at 18:15:00Z and 18:30:00Z and `send-feedback-requests` at 18:30:00Z, each succeeding, with 0 runs in any other status (`evidence/floor.phase-after.txt` block 16b). Its status is unchanged.

`node .planning/audit/tools/validate.mjs --check findings` passes 8 of 8 and exits 0 after the edits.
`FOUNDATION_AUDIT.md` was regenerated with `gen-foundation-audit.mjs` (94 ids for 94 findings). Fixed went from 40
to 47 and Open from 54 to 47; no finding is left Open at `"06"`.

**Deferred items:** DI-21, DI-25/DI-53, DI-26, DI-45, DI-55, DI-58 and DI-70 closed in slice 7; DI-83
re-dispositioned to Phase 8; DI-89..DI-99 registered from the 06-07..06-17 SUMMARYs
(`evidence/deferred-items.md` Parts 6 and 7).

## 4. INTENTIONAL BEHAVIOUR CHANGEs shipped in slice 7

Each commit below carries the words `INTENTIONAL BEHAVIOUR CHANGE` in its body.

| Change | Commits | Finding / decision | Pinned by |
|--------|---------|--------------------|-----------|
| **400s for malformed input.** A body that is not JSON, an array or `null`, or a wrongly typed field answers a 400 with the route's text (or `Invalid JSON body`, `Request body must be a JSON object`, `<field> must be a string`) instead of a 500 or a silent write | `4caf196`, `4f918ae`, `a543979`, `f869323` | F-094, DEC-65 | `src/__tests__/contracts/malformed-input-defect.test.ts` (ledger rows); `src/contracts/__tests__/*.test.ts` |
| **Club link normalization.** A scheme-less club link is stored with `https://` on create and accepted on edit; `javascript:`, `data:`, `ftp:` and bare words are refused with `Invalid URL for <field>` on both | `4f918ae` | F-094, DEC-66 (DI-66) | `src/__tests__/api/review05/club-links-defect.test.ts`; `src/contracts/__tests__/clubs.test.ts` |
| **Canonical admin ids.** An admin addressing their own account with a differently cased id is refused at ban and role change like the canonical form | `f869323` | F-094, DI-64 | `src/contracts/__tests__/admin.test.ts` |
| **JSON logs and `x-request-id`.** Proxy, boot, rate-limit, after-response, audit and route log lines are one JSON object each; every proxied and wrapped response carries `x-request-id` | `4ad1fae`, `f044f02`, `217593b`, `2c12a61`, `29ced7e`, `6221669` | F-058, REFAC-20, DEC-74 | `src/server/__tests__/log.test.ts`, `src/proxy-request-id.test.ts`, `src/server/__tests__/route.test.ts` |
| **JSON 500s.** An uncaught throw in a handler answers `{"error":"Failed to <action>"}` 500 instead of an HTML error | `217593b`, `2c12a61`, `29ced7e`, `6221669` | F-058, DEC-73 | `src/__tests__/api/uncaught-throw-defect.test.ts` U3 |
| **Generic error bodies.** A caught database error answers the route's generic text, never the error's message | `217593b`, `2c12a61`, `29ced7e`, `6221669`, `747ef77` | F-059, DEC-75 | `src/__tests__/api/error-text-defect.test.ts` E2 |
| **Private cache classes and the `vercel.json` removal.** Every personalized and auth-gated response carries `private, no-store`; `vercel.json` no longer adds `s-maxage=60` to `/api/*` (effective on the owner's next deploy) | `217593b`, `2c12a61`, `29ced7e`, `6221669` | F-025, F-026, DEC-73 | `src/__tests__/api/cache-headers-census.test.ts`; `src/__tests__/config/vercel-json-defect.test.ts`; `e2e/specs/cache-headers.spec.ts` |
| **Event detail private.** `/api/events/[id]` and the rsvp GET answer `private, no-store` (a pending event's organizer view must not be shared) | `29ced7e` | C7, DEC-69 | `src/__tests__/api/cache-headers-defect.test.ts` C4/C5; `e2e/specs/cross-user-cache.spec.ts` |
| **CSP without eval.** Production pages no longer permit `eval`; local builds admit the local Supabase origin | `d6e8489` | F-055, DI-21, DEC-77 | `src/__tests__/config/csp-defect.test.ts`; `e2e/specs/csp.spec.ts` |
| **Admin-only /docs and /health pages** | `00aa06d` | F-054, DEC-79 | `src/__tests__/pages/docs-gate-defect.test.ts`; `e2e/specs/admin-page-gates.spec.ts` |
| **Banned admins refused on admin pages** and by the moderation reviews API's admin path | `00aa06d` | DI-55, DEC-79 | `src/server/__tests__/requireAdminPage.test.ts`; `src/__tests__/api/service-role-routing.test.ts` (the real-stack gap is DI-99) |
| **Liveness-only anonymous health.** `/api/health` answers `{ status, version }` to anyone but an admin or the `HEALTH_TOKEN` bearer | `747ef77` | F-029, DEC-78 | `src/__tests__/api/health/health.test.ts`; `e2e/specs/health.spec.ts` |
| **Saved-events floor.** An event is upcoming in saved events exactly when it is upcoming in the feed | `b8e20f4` | F-085, DEC-80 | `src/__tests__/api/events/saved-events-time-floor-defect.test.ts` |

`ee69dda`, `830c0ba` (pins), `c8645cf` and `edb5eef` (query contracts that keep every coercion), `e2771b7` and
`54da7b5` (client typing, no production bundle change), `d790b21` (the seam pieces before adoption), `83e2f7e`,
`eaed119`, `64939b2` (contract and tests), `0013c08` and `848034e` (Sentry: nothing is sent until the owner sets a
DSN) and `f4c59e4` (the SDK bump) carry no wire change of their own.

## 5. What landed in slice 7

`git log --oneline f550de9..f4c59e4`, the code and evidence commits (plan metadata commits omitted):

| Plan | Commits |
|------|---------|
| 06-07 | `ee69dda` the 400 table and F-094 pins; `830c0ba` seven defect suites; `22cdde4` evidence and the console inventory |
| 06-08 | `4caf196` events body contracts and `parseForm`; `c8645cf` events query contracts |
| 06-09 | `4f918ae` club contracts and one link rule; `a543979` user and profile contracts |
| 06-10 | `f869323` admin contracts, the DI-53 retypes, canonical ids; `edb5eef` admin query contracts, census at zero |
| 06-11 | `e2771b7` hooks typed from contracts; `54da7b5` client mutation bodies, the `--client` census |
| 06-12 | `d790b21` logger, `withRoute`, cache classes; `4ad1fae` the request id; `f044f02` server modules, the censuses |
| 06-13 | `217593b` admin and moderation routes; `2c12a61` club routes |
| 06-14 | `29ced7e` events routes; `6221669` every remaining route, `vercel.json` |
| 06-15 | `83e2f7e` the endpoint contract; `eaed119` the cross-user cache test; `64939b2` the live sweep |
| 06-16 | `0013c08` @sentry/nextjs 10.75.3; `848034e` Sentry wiring; `d6e8489` the CSP |
| 06-17 | `747ef77` health; `00aa06d` the admin page gates |
| 06-18 | `b8e20f4` F-085; `f4c59e4` @supabase/supabase-js 2.116.0 (the last code change) |

No code commit landed between plans in slice 7; the only between-plan code commit of the phase is `57cb55f`
(slice 6, the orchestrator's tag fix). Slice 7 is closed on a green floor from a clean reset.
