# Slice 6 close-out: the async edge (cron, webhook, recommendations, interactions, notifications)

**Plan:** 06-06 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-27 · **Measured on:** `71bfd55` (06-05's metadata commit; its code is `0ba575a`, the last code-bearing slice-6 commit, plus `e55e1c9`'s evidence), before-floor base `f186621` · **Author:** executor, local stack only

Slice 6 covered the asynchronous edge and the recommendation family. The order was: register, measure and decide (06-01: the before-floor, F-093 and F-094, DEC-60..DEC-81, the deferred register and the defect ledger); characterization (06-02: eight suites, F-017/F-028/F-092/F-094 pinned as DEFECT, the webhook's behaviour table and the cron caller census); the cron deletion, zod and the webhook (06-03); the slice-6 contracts and three route fixes (06-04); the characterization-tag fix `57cb55f`, which the orchestrator added after 06-04 when CI's tag gate found the two webhook suites untagged; the definer-hardening migration (06-05); and this close (06-06). Every claim below cites a command output in an evidence file or a commit. `evidence/` means `.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/`.

## 1. Floor, before and slice-6 after

Source: `evidence/floor.before.txt` (base `f186621`) and `evidence/floor.slice-6-after.txt` (line 1 `head=71bfd55…`). The after-floor ran from a clean `supabase db reset --local`, twice (blocks 10 and 14a), on 2026-09-27 between 01:46Z and 02:02Z. Rows 7b, 7c, 8c-8f and 16a-16c are new at this floor.

| # | Command | Before (f186621) | Slice 6 after (71bfd55) | Verdict |
|---|---------|------------------|-------------------------|---------|
| 1 | `npx jest --ci --json` | 1651 passed, 1 skipped; 88 suites | **1995 passed, 0 failed, 1 skipped**; 103 suites (102 run, 1 skipped) | +344 tests, +15 suites (06-02: 8, 06-03: 4, 06-04: 3). The one pending test is the Upstash live-store contract (block 1b) |
| 2 | `npm run lint` | 0 errors, 18 warnings | 0 errors, 18 warnings | equal |
| 3 | `npx tsc --noEmit` | exit 0 | exit 0 | equal |
| 4 | `npm audit --audit-level=high --omit=dev` | 0 critical, 0 high, 2 moderate | the same | equal (zod 4.6.5 added none) |
| 5 | `node scripts/check-elevated-ratchet.mjs` | committed=2 live=2 | **committed=0 live=0 delta=0** | the two cron routes, the last entries, are deleted (06-03) |
| 6 | `node scripts/check-migration-filenames.mjs` | 8 parse | 9 parse | +1, `20260926120000_async_edge_definer_hardening.sql` |
| 7 | `node scripts/check-characterization-tags.mjs --all` | ok 34 | ok 44 | +10: 06-02's eight suites and the two webhook suites (`57cb55f`) |
| 7b | `node scripts/check-contracts.mjs` (new gate, 06-04) | — | committed=86 live=86 delta=0; exit 0 | passing |
| 7c | the contracts allow-list, slice-6 families | — | 0 entries under recommendations, interactions, feedback, notifications | no slice-6 contract file is listed; the two `admin/reports` entries are the admin family's (06-10) |
| 8 | `validate.mjs --quick` | 118 / 2 failed / 1 skipped | the same | equal; the two by-design snapshot FAILs |
| 8c | types drift (`supabase gen types … \| diff -u`) | — (Phase 5 after: empty) | empty; exit 0 | no drift |
| 8d | CI-env `npm run build` | — (Phase 5 after: exit 0) | exit 0; 98 static pages | builds with CI's env; 98 against Phase 5's 100 is the two deleted cron routes |
| 8e | the deleted cron paths on a production build | — | GET and POST on both paths: 404; control `/api/events` 200 | F-002's route answers 404 |
| 8f | non-test readers of `CRON_SECRET`, `ADMIN_API_KEY`, `ADMIN_EMAILS`; `src/app/api/cron` | — | none (grep exit 1); the directory is absent | F-040's last reader is gone |
| 9 | port 3000 before the DB blocks | free | free | equal |
| 10 | `supabase db reset --local` | 8 migrations | 9 migrations | rebuilds from zero |
| 11 | pgTAP, UNSEEDED | Files=11 Tests=200 PASS | **Files=13 Tests=260 PASS** | +031 (13), +070 (47) |
| 12 | seed | 10 personas, 5 clubs, 6 memberships, 5 events, 2 rsvps, 0 saved | identical | equal |
| 13 | pgTAP, SEEDED | Files=11 Tests=200 PASS | **Files=13 Tests=260 PASS** | as row 11 |
| 14 | second reset + seed | exit 0 / exit 0 | exit 0 / exit 0 | equal |
| 15 | `npx playwright test` | 97 passed, 0 failed | **100 passed, 0 failed**, first run | +3: `e2e/specs/async-edge.spec.ts` |
| 16a | cron run history right after Playwright | — | 0 runs for each job (the run ended 1 minute after the reset) | recorded as zero, not omitted |
| 16b | cron run history after the 02:00 UTC window | — | `send-event-reminders` 1 run, succeeded; `send-feedback-requests` 1 run, succeeded (both 02:00:00Z); `compute-user-scores` 0 runs (no six-hour boundary in the window); 0 runs in any other status | the reminder and feedback jobs run without failure (F-037's run-history clause) |
| 16c | `cron.job` after the fresh reset vs production | 1 job locally (031 red 9/13 before the migration, `evidence/definer-hardening-red.txt` § 2) | 3 jobs, **EQUAL** field for field to `.planning/audit/async/cron-job.json` | F-042's criterion |
| 17 | residue after Playwright | saved_events=1, the rest the seed | saved_events=1 admin_audit_log=0 club_members=6 events=5 users=10 notifications=0 user_event_scores=0 | equal; the one saved row is `save-and-rsvp.spec.ts`'s own |
| C1 | server `console.*` calls | 160 lines in 56 files | 158 in 54 | −2: the deleted cron routes' two lines |
| C2 | raw `request.json()` in route files | 21 in 20 files | 18 in 17 | −3: interactions, feedback, recommendations/feedback read through `parseBody` |
| C3 | `.formData()` in route files | 5 in 5 | 5 in 5 | equal (06-08, 06-09) |
| C4 | `searchParams` reads in route files | 59 in 19 files | 53 in 15 | −6: recommendations (2), recommendations/analytics (1), recommendations/feedback (1), notifications (2) through `parseQuery` |
| C5 | `readJsonObject(` in route files | 15 in 15 | 15 in 15 | equal (slice 7's contracts) |
| C6 | `getSession(` outside tests | 1 (health:160) | the same one | equal (06-17) |
| C7 | caught-error `.message` in route files | 40 hits in 22 files | 40 in 22, the same text | equal (F-059, 06-13/06-14) |
| C8 | route files setting Cache-Control; `vercel.json` headers | 4 files; the blanket `/api/(.*)` rule | the same | equal (06-14, 06-15) |
| C9 | zod importers; installed zod | 0; 4.1.13 transitive, dev tree | 10 files (7 non-test: `src/server/body.ts`, five `src/contracts/*.ts`, `supabase/functions/_shared/webhook-contract.ts`); `zod@4.6.5` exact at the root, the dev copies deduped onto it | zod adopted (06-03, 06-04) |

Every required row is green: Playwright 0 failed from a clean reset; Jest 0 failed with the only pending test in the Upstash contract suite; pgTAP Files=13 PASS unseeded and seeded; ratchet committed=0 live=0; contracts census exit 0 with no slice-6 file listed; types diff empty; the CI-env build exit 0. The stack was left reset and seeded, and port 3000 was free before the DB blocks, after Playwright, after the 404 probe and at the end (blocks 9, 15a, 15b, 8e, 19); block 18 is the final reset and seed.

### Playwright, across the slice

| Run | File | Count | Exit |
|-----|------|-------|------|
| Before-floor (full, clean reset) | `evidence/floor.before.txt` block 15 | 97 passed | 0 |
| 06-04 targeted, fresh reset | `evidence/async-edge-fixes.txt` § 6 | `async-edge.spec.ts` 3 passed; `admin-moderation-queue` + `event-read-path` 15 passed | 0 |
| 06-05 targeted, after the mutation check | `evidence/schema-push-slice-6.txt` § 12 | `public-profile-privacy`, `async-edge`, `event-read-path`: 26 passed | 0 |
| **Slice 6 after (full suite, clean reset, head `71bfd55`)** | `evidence/playwright.slice-6-after.txt` | **100 passed, 0 failed** | **0** |

100 = 97 + the 3 tests of `async-edge.spec.ts`. It was the first run with no retry. `git diff --stat f186621 HEAD -- e2e playwright.config.ts` lists only that new spec, so the eighteen earlier spec files and `e2e/auth.setup.ts` passed unedited.

## 2. Validated-workflow re-confirmation, after slice 6

Slice 6's production footprint is `git diff --name-only f186621 71bfd55` with tests excluded:

- routes: `recommendations`, `recommendations/feedback`, `recommendations/analytics`, `interactions`, `feedback`, `notifications`, `notifications/count`, `admin/reports`; the two `cron/*` routes deleted
- `src/server/body.ts`, `src/contracts/{common,recommendations,interactions,notifications,feedback,webhook}.ts`, `src/server/db/elevated/REGISTRY.md`, `src/lib/supabase/types.ts` (the `cron_job_status` entry), `src/lib/classifier.ts` (a comment)
- one client pair: `src/hooks/useNotificationCount.ts` and `src/components/layout/SideNavBar.tsx` (the count is requested only when signed in)
- the edge function: `supabase/functions/_shared/{webhook-handler,webhook-signature,webhook-contract,contentHash}.ts`, `events-webhook/index.ts`, `events-webhook/deno.json`
- `supabase/migrations/20260926120000_async_edge_definer_hardening.sql`
- tooling: `eslint.config.mjs`, `eslint.elevated-allowlist.mjs`, `scripts/check-elevated-ratchet.mjs`, `scripts/check-contracts.mjs`, `scripts/contracts-allowlist.json`, `.github/workflows/ci.yml`, `package.json` and the lockfile (zod), `tsconfig.json` (`allowImportingTsExtensions`)

No test file that existed before slice 6 was edited: `git diff --name-status f186621 71bfd55` lists every test, spec and pgTAP path under `src/`, `e2e/` and `supabase/tests/` as `A` (added). So every earlier PRESERVE suite, every earlier spec and every earlier pgTAP file re-confirmed its workflow unedited. The 06-02 PRESERVE suites also passed unedited through 06-04's adoption (`evidence/contracts-slice-6.txt` [2.8]; `git diff f7bffbf 71bfd55` on the four files is empty).

All 16 PROJECT.md Validated bullets (`grep -c '^- ✓' .planning/PROJECT.md` = 16) are listed below. Every named test is green in the slice-6 after runs (`evidence/floor.slice-6-after.txt` blocks 1, 11, 13; `evidence/playwright.slice-6-after.txt`).

| # | Validated workflow (PROJECT.md) | Touched by slice 6? | Re-confirmed after slice 6 by |
|---|-------------------------------|---------------------|-------------------------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | No: the callback, the proxy and the sign-in pages are absent from the diff | **Every persona signs in:** `e2e/auth.setup.ts`, 10 of 10. **Non-McGill rejected:** `src/app/auth/callback/route.test.ts`, unedited, in Jest block 1. `src/proxy.test.ts` and `src/proxy-characterization.test.ts` unedited |
| 2 | Anonymous visitors browse public event and club content | Only the side navigation: it no longer requests the unread count for a signed-out visitor (06-04 measured 0 anonymous polls before and after) | `e2e/specs/anonymous-browse.spec.ts` (3); `e2e/specs/event-read-path.spec.ts` (12); `e2e/specs/public-profile-privacy.spec.ts` (a public profile renders to an anonymous reader); `async-edge.spec.ts` 'FIXED F-028' (the count answers an anonymous caller 401, which no page requests) |
| 3 | Onboarding interest tags; guard on unfinished onboarding | Only the onboarding guard's reach: the slice-6 write routes keep `requireOnboarded` before `parseBody` (06-04, same point in the flow) | `e2e/specs/ban-and-onboarding-ring.spec.ts` (11, including 'can still complete onboarding' and the direct-POST 403); `e2e/specs/protected-route-redirect.spec.ts` (2); the 403 Onboarding required rows of `recommendations-family-characterization.test.ts` and `interactions-feedback-characterization.test.ts` |
| 4 | Browse, search, filter events by tag, date, time of day | No: `events/*` routes are absent from the diff | `e2e/specs/event-read-path.spec.ts` (12); `events-list-characterization.test.ts` and `events-detail-characterization.test.ts`, unedited. The search still runs on the ILIKE fallback (F-078, 9 lines in the server log, pre-existing) |
| 5 | Save/unsave events and RSVP | No | `e2e/specs/save-and-rsvp.spec.ts` (3), unedited; `e2e/specs/csrf-origin.spec.ts` PRESERVE rows; residue block 17 shows the spec's own saved row |
| 6 | Personalized recommendations with popularity fallback (F-041 caveat) | **Yes, this is slice 6's workflow.** `recommendations` (contracts, F-017 through the door), `recommendations/feedback` (contracts, DI-44), `recommendations/analytics` (contracts); `compute_user_scores()` gained a `search_path` and lost its public EXECUTE grant, with no body change | **Input → ranked output:** `recommendations-characterization.test.ts` (13 PRESERVE rows: anonymous, the F-041 fallback, λ default/0/1/clamped/NaN, `top_k`, session boost, the admin variant), unedited since 06-02. **The signed-in path on the real stack:** `async-edge.spec.ts` 'FIXED F-017' (200, `source: "personalized"`). **Formula unchanged:** 070 row 1 (md5 of the body), row 4 (score = sum of the five breakdown parts). **Scores still refresh:** `cron.job` holds `compute-user-scores` unchanged (block 16c); its six-hourly window did not fall inside this observation. **Caveats, pre-existing:** F-041 (Open at "08"); the admin's manual batch trigger answers 500 on the real stack (DI-82) while the Jest row passes on a fake without safeupdate |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs (F-016 caveat) | No: the club routes are absent from the diff. The friends RPCs the invite modal and `events/[id]/invite` read are now subject-bound, and every caller passes its own id or reads through the service role | `e2e/specs/club-owner-surfaces.spec.ts` (3), `club-authorization.spec.ts` (19), `club-invitation-acceptance.spec.ts` (4), unedited; 070's A-for-A and service_role-for-B rows (the own-id and door reads still answer) |
| 8 | Organizer events auto-approved; others moderated | No | `club-gates-characterization.test.ts` P6 rows and 060 tests 7-14, unedited; `e2e/specs/admin-moderation-queue.spec.ts` (3) |
| 9 | Follow/unfollow clubs; public club pages | No | `e2e/specs/anonymous-browse.spec.ts` public club content; the follow rows of `write-handlers-characterization.test.ts`, unedited |
| 10 | Organizer event-level and club-level analytics | No (`recommendations/analytics` is the admin's surface) | `club-authorization.spec.ts` owner and organizer analytics rows; `src/__tests__/api/events/analytics.test.ts`, `src/__tests__/api/clubs/analytics.test.ts` |
| 11 | Attendees review past events; aggregate feedback | No: `events/[id]/reviews` is absent from the diff (its contract is 06-08's) | `src/__tests__/api/events/reviews.test.ts`, unedited |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log (F-007 caveat) | `admin/reports` GET (F-092) | **The reports queue now lists:** `async-edge.spec.ts` 'FIXED F-092' (a student's report reaches the admin's list with the reporter's name), which removes the Phase 5 close's caveat. **Unchanged surfaces:** `admin-guard.spec.ts` (3), `admin-write-paths.spec.ts` (5, including 'resolving a report'), `admin-audit-row.spec.ts` (2), `admin-moderation-queue.spec.ts` (3), `banned-redirect.spec.ts` (3), `event-moderation-notifications.spec.ts` (6), unedited. The F-007 caveat still reads "fixed locally, production with DI-23" |
| 13 | In-app notifications and email reminders (F-038 caveat) | `notifications` (contracts), `notifications/count` (401 for anonymous), the count hook; `send_event_reminders()` gains the F-093 filters; the reminder and feedback jobs are now declared locally | **In-app notifications:** `notifications-characterization.test.ts` (PRESERVE, unedited since 06-02); `admin-write-paths.spec.ts` and `event-moderation-notifications.spec.ts` assert notifications on the real stack. **Reminders:** in-app reminders are what pg_cron delivers — `send-event-reminders` every 15 minutes and `send-feedback-requests` every 30 write `notifications` rows; on the reset local stack both ran at 02:00:00Z and succeeded, with no failed run (block 16b); 070 rows 5-7 prove the reminder writes one `reminder_24h` for an approved event and none for a deleted or pending one. **Email:** this bullet's "email reminders" is contradicted by F-038 — nothing in the project sends email, and `email_reminder_log` is never written. That stays an owner decision for Phase 8 (F-038, Open at "08"); what is confirmed here is the in-app half |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | The ingestion endpoint (`events-webhook`, 06-03) and a comment in `classifier.ts` | `src/lib/classifier.test.ts`, unedited; `src/__tests__/webhook/*` (4 suites, 118 tests at 06-03, in Jest block 1): the 17-row behaviour table reproduced, rows now carry `content_hash`, and a replay is reported `duplicate` (the dedup the bullet asserts, which the deployed function never applied: 06-02 § 3 row 16). **Live only after DI-81's redeploy.** The Deno suite has not run (DI-84) |
| 15 | A/B experiment framework (F-017 caveat) | **Yes.** Non-admins are now assigned variants through the door (F-017, 06-04) | `async-edge.spec.ts` 'FIXED F-017' (exactly one assignment row keyed by the student, and the reported variant is that row's) on the real stack; `experiment-assignment-defect.test.ts` D1/D2 moved (ledger); `src/lib/experiments.test.ts`; the experiments rows of `admin-guard-characterization.test.ts`. The F-017 caveat is resolved |
| 16 | Interaction tracking feeds popularity and interaction signals | `interactions` (contracts); `compute_user_scores()` (grant and search_path only) | `interactions-feedback-characterization.test.ts` (10 shape-400 rows, the 403, the 404s, anonymous acceptance and the written payloads), unedited through the adoption; F-094's moved rows for malformed bodies; 070 rows 3-4 (the recompute writes scores and they equal their breakdown). No e2e test covers the signal pipeline, as at every earlier close |

Row 13's email half and row 16's signal pipeline still have no end-to-end test, as at every earlier close. Rows 6, 12 and 15 gained real-stack coverage in this slice. Row 13's reminders are now observed running on the local stack for the first time in the program.

## 3. REFAC-14, clause by clause

REFAC-14 (`.planning/REQUIREMENTS.md`): "Slice 6 (recommendations/interactions/notifications/cron/webhook): cron and webhook routes require credentials and fail closed when absent, the recommendation API surface is characterized (input → ranked output) with the scoring formula left unchanged."

| Clause | Verdict | Evidence |
|--------|---------|----------|
| Cron routes require credentials and fail closed when absent | **MET, by deletion** | Nothing called them: no `crons` key in `vercel.json`, pg_cron runs the SQL functions directly, no caller in `src`, `e2e`, `scripts` or `.github` (`evidence/cron-deletion.txt` § 1; 06-02 § 4). Deleted by `ffd973e` (DEC-63). Both paths answer 404 to GET and POST on a production build (block 8e). No reader of `CRON_SECRET` remains (block 8f), and the ratchet is committed=0 live=0 (block 5), so no uncredentialed service-role entry exists. The work they duplicated runs in pg_cron: `send-event-reminders` and `send-feedback-requests` each ran at 02:00:00Z on the reset local stack and succeeded, with no failed run (block 16b) |
| Webhook routes require credentials and fail closed when absent | **MET in the repository; the stricter behaviour is live after DI-81** | HMAC over the raw body is kept (DEC-64). `src/__tests__/webhook/webhook-handler.test.ts` reproduces all 17 rows: missing URL, key or secret answers 500 Server configuration error (row 2, 3 cases); a missing signature 401 (row 3); a wrong signature 401 (row 4); a **wrong-length signature now 401** instead of 500 (row 5, 8 cases); a **replay reports each event `duplicate`** and inserts nothing (row 16, 4 cases). Mutations M1 (length check) and M2 (`content_hash`) each turned 6 rows red (`evidence/webhook.txt`; ledger rows `239b7cd`). The deployed function already refused every unsigned or wrongly signed request (rows 2-4 "same" before and after, `evidence/webhook.txt` § 7); its 500 on a wrong length and its re-insert of a replay end when the owner redeploys from CI with `WEBHOOK_SECRET` confirmed (DI-81). The two suites carry PRESERVE tags citing F-039 (`57cb55f`) |
| The recommendation API surface is characterized (input → ranked output) | **MET** | `src/__tests__/api/recommendations/recommendations-characterization.test.ts`: 13 PRESERVE rows, each asserting status, the ordered ids, `source`, the reported λ, `experiment_variant_id`, `total_events`, the score-pool limit and `Cache-Control: private, no-store`; the MMR orders equal hand-computed ones (`evidence/slice-6-characterization.txt` § 1). `recommendations-family-characterization.test.ts` covers batch, analytics and feedback. Mutation M1 (default λ 0.7 → 0.6) turned 3 rows red, restored with `cmp` (§ 2). The suites passed unedited through 06-04's adoption (`evidence/contracts-slice-6.txt` [2.8]) and in Jest block 1. The real-stack signed-in path: `async-edge.spec.ts` 'FIXED F-017'. The batch trigger's real-stack 500 (DI-82) is a registered defect of the trigger, not of the ranked output |
| … with the scoring formula left unchanged | **MET** | 070 row 1: `md5(prosrc)` of `compute_user_scores()` equals `ed64959b44c9329a1212cde928810010` (DEC-68), green unseeded and seeded on the post-migration schema (blocks 11, 13). 070 row 4: every computed score equals the sum of its five breakdown parts. 06-05 changed the function only with `ALTER FUNCTION … SET search_path` and `REVOKE` (`evidence/schema-push-slice-6.txt`); the λ rules are pinned in Jest and unedited |

**REFAC-14 is Complete.** Every clause is met by committed evidence. The deploy of the webhook's two intentional changes is F-039's deployment-record clause (DI-81), not a clause of REFAC-14: the deployed function already requires credentials and fails closed when they are absent, and the repository's function does so on every bad signature.

## 4. Findings

**Closed (status set to `Fixed` in `.planning/audit/findings.json` by this plan, each with a resolution citing its commits and this note):**

- **F-002** (High): the cron route is deleted (`ffd973e`). The criterion's test clause described a guard on a route that no longer exists; its grep over `src/app/api/cron/` is vacuously satisfied, because the directory is absent, and the path answers 404 (blocks 8e, 8f).
- **F-017** (Medium): non-admins are assigned variants and `experiment_assignments` records it (`376bf37`; `async-edge.spec.ts` on the real stack; D1/D2 moved).
- **F-040** (High): no non-test reader of `ADMIN_API_KEY`, `ADMIN_EMAILS` or `CRON_SECRET` remains (block 8f). The boot check in `src/instrumentation.ts` refuses to start on a missing required variable, and `src/instrumentation.test.ts` asserts that it fires (Jest block 1).
- **F-042** (Medium): after a fresh reset, `cron.job` equals production's list field for field (block 16c; `0ba575a`; 031).
- **F-092** (Medium): the reports list answers 200 with each reporter's name (`376bf37`; D1 moved; `async-edge.spec.ts`).
- **F-037** (Medium): both dead handlers are deleted (`ffd973e`), so the pg_cron functions are the only implementation. `src/app/api/cron/` does not exist (block 8f), and on the reset local stack the reminder and feedback jobs each ran at 02:00:00Z and succeeded, with 0 runs in any other status (block 16b). The compute job's six-hour boundary did not fall in the window; the plan's condition names the two jobs the deleted handlers duplicated. Production was not read.

**Kept Open, with the unmet clause named:**

- **F-074, F-075, F-076, F-093** (two High, two Medium): fixed and proven locally (migration `20260926120000`, pgTAP 070 and 031, the mutation check). Production closes with the DI-23 repair. `closes_in_phase: "08"` (DEC-72). See § 6.
- **F-039** (High): the code half is done (401 on every bad signature, replay dedupe by `content_hash`, the payload contract; `db839a7`, `239b7cd`). The unmet clause is "a deployment record showing the function was built by CI from a named commit" (DI-81). `closes_in_phase: "08"`.
- **F-028** (Medium): `/api/notifications/count` now answers anonymous callers 401 (`2617b7b`), so five of the eight routes answer 401 and one (`/api/auth-debug`) is deleted. The rsvp GET and `clubs/[id]/events` stay 200 for the public pages they feed. REFAC-19 gives them `private, no-store` in 06-14 (DEC-69). Stays at `"06"`.

`node .planning/audit/tools/validate.mjs --check findings` passes 8 of 8 and exits 0 after the edits. `FOUNDATION_AUDIT.md` was regenerated with `gen-foundation-audit.mjs`. It references 94 ids for 94 findings. Fixed went from 34 to 40 and Open from 60 to 54; the Open records at `"06"` went from 21 to 10 (F-025, F-026, F-028, F-029, F-054, F-055, F-058, F-059, F-085, F-094, all owned by slice 7).

## 5. INTENTIONAL BEHAVIOUR CHANGEs shipped in slice 6

| Commit | Change | Pinned by |
|--------|--------|-----------|
| `ffd973e` (06-03) | `GET`/`POST /api/cron/send-reminders` and `/api/cron/send-feedback-requests` answer 404. Nothing called them; pg_cron runs the live implementations (F-002, F-037) | block 8e; `evidence/cron-deletion.txt` |
| `239b7cd` (06-03) | **On redeploy (DI-81).** The webhook answers 401 `Invalid signature` to a wrong-length signature instead of 500, and a replayed signed payload reports each event `duplicate` instead of inserting it again; rows carry `content_hash` (F-039, DEC-64) | `webhook-handler.test.ts` rows 5 and 16; ledger |
| `2617b7b` (06-04) | Malformed slice-6 bodies answer 400 instead of 500: at `interactions`, `feedback` and `recommendations/feedback`, a body that is not JSON answers `Invalid JSON body`, an array or `null` answers `Request body must be a JSON object`, a numeric feedback `subject` answers `Subject must be a string`, and a truthy non-string `event_id` answers the route's presence 400 (F-094, DEC-65) | `slice6-malformed-input-defect.test.ts` (ledger, 10 rows); `slice-6-contracts.test.ts` |
| `2617b7b` (06-04) | An anonymous `GET /api/notifications/count` answers 401 `Unauthorized` instead of `200 {"unread_count":0}`; the side navigation asks only when signed in, so no page polls into the 401 (F-028, DEC-69) | `notifications-count-defect.test.ts` D1/D2; `async-edge.spec.ts` 'FIXED F-028' |
| `376bf37` (06-04) | Non-admin callers are assigned A/B variants, and their assignment is recorded, through the elevated door (F-017, DEC-68) | `experiment-assignment-defect.test.ts` D1/D2; `async-edge.spec.ts` 'FIXED F-017' |
| `376bf37` (06-04) | `GET /api/admin/reports` answers 200 with each report's reporter `{ id, display_name, avatar_url }` instead of 500 (F-092) | `admin-reports-defect.test.ts` D1; `async-edge.spec.ts` 'FIXED F-092' |
| `0ba575a` (06-05) | **Local only until DI-23.** anon and authenticated can no longer execute `compute_user_scores`, `send_event_reminders` or `send_feedback_requests` (PostgREST answers 42501); `get_friends` and `get_friends_going_to_event` answer only for the caller or the service role; reminders skip deleted and unapproved events; `public.cron_job_status()` exists for the service role only (F-074, F-075, F-076, F-093, DEC-70) | 070 (47) and 031 (13); M1-M4 (`evidence/slice-6-mutation-check.txt`); `evidence/schema-push-slice-6.txt` § 10 |
| `0ba575a` (06-05) | The local stack now schedules `send-event-reminders` (every 15 minutes) and `send-feedback-requests` (every 30) as production does (F-042, DEC-71). Tests never depend on them; no seeded event is in a reminder window | 031; blocks 16b, 16c |

`635db3f` (the `parseBody`/`parseQuery` boundary and the contracts census), `097e928` (zod 4.6.5), `db839a7` (the shared webhook contract and `verifySignature`), the DI-44 fallback deletion inside `2617b7b` (dead code) and `57cb55f` (docblock tags) carry no wire change of their own. The 06-02 PRESERVE suites and every earlier suite pin that.

## 6. Local-only closures, pending DI-23

Nothing in slice 6 wrote to production. No push subcommand was run, no linked-project flag was used, nothing was deployed, and `.env.local` was not read.

- **F-074** (High): fixed and proven locally by `0ba575a`. 070 asserts `NOT has_function_privilege('anon', …)` for both friends functions, real anon calls raising 42501, A asking for B getting 0 rows, A for A getting A's friends and the service role for B answering; red before (`evidence/definer-hardening-red.txt` § 2), green unseeded and seeded (blocks 11, 13), and M2 turns rows 35 and 37 red. In production, any anonymous caller can still read any user's friend graph until the repair.
- **F-075** (High): fixed and proven locally by `0ba575a`. 070's privilege rows for PUBLIC, anon, authenticated and service_role on all three functions, and real anon calls raising 42501; M1 turns rows 10-12, 18-20, 22 and 24 red. The criterion's re-run clause holds: 030 is green in blocks 11 and 13, and the scheduled writers still run after the revoke: the reminder and feedback jobs each succeeded at 02:00:00Z (block 16b). In production, the anon key can still trigger a full recompute or a reminder run until the repair.
- **F-076** (Medium): fixed and proven locally by `0ba575a`. 070's one catalog invariant (no SECURITY DEFINER function in `public` without a `search_path` entry) plus its non-vacuity row, green in blocks 11 and 13.
- **F-093** (Medium): fixed and proven locally by `0ba575a`. 070 rows 5-7 run the three-event fixture inside a transaction: exactly one `reminder_24h` for the approved event, none for the soft-deleted or pending one; M3 turns rows 6 and 7 red. In production, reminders for deleted and unapproved events continue every 15 minutes until the repair.
- `public.cron_job_status()` does not exist in production until the repair; 06-17's health check reads it through the door and must tolerate its absence there.
- F-042 needs no repair: production already runs the three jobs, and the migration makes the repository say so.

## 7. Deferred items at this close

Recorded in `evidence/deferred-items.md`: DI-33's cron half CLOSED (F-042) and DI-44's code half CLOSED (06-04), in Part 1; DI-82 dispositioned to Phase 7 with a target (a fix-forward migration writing the two unqualified deletes as `DELETE … WHERE true`, 070 row 1's md5 re-derived under a signed DEC-68 amendment, a DEFECT row moved on the real stack, and the e2e workaround removed); and Part 5, registered from the 06-02..06-05 SUMMARYs: DI-83 (three malformed webhook payloads still answer 500; 06-18, with F-094), DI-84 (the Deno suite has never run; Phase 8 with DI-81), DI-85 (Playwright leaves a wall-clock stamp that reddens 040 row 20 until the next reset; Phase 7), DI-86 (the red tag gate after 06-03, CLOSED by `57cb55f`) and DI-67 extended (the mutation harness covers only `CREATE POLICY`). Owner actions carried unchanged: DI-78 (the signed-timestamp window) and DI-81 (redeploy `events-webhook` from CI, confirm `WEBHOOK_SECRET`). The next id is DI-87.

## 8. What landed in slice 6

`git log --oneline f186621..71bfd55`, the code and evidence commits (plan metadata commits omitted):

| Plan | Commits |
|------|---------|
| 06-01 | `b457f48` before-floor; `c4daccb` F-093, F-094, re-pointing, legitimacy bundles; `bd97ea7` DEC-60..DEC-81, deferred register, defect ledger |
| 06-02 | `6c38659` recommendations characterization, F-017 DEFECT; `f7bffbf` notifications, interactions, feedback, F-028/F-092/F-094 DEFECT; `93ce6db` evidence and mutation check |
| 06-03 | `ffd973e` the cron handlers deleted; `097e928` zod 4.6.5; `db839a7` the shared webhook contract and `verifySignature`; `239b7cd` 401 on any bad signature, replays refused |
| 06-04 | `635db3f` `parseBody`/`parseQuery` and the contracts census; `2617b7b` slice-6 contracts, the count's 401; `376bf37` F-017 and F-092 |
| orchestrator, after 06-04 | `57cb55f` the two webhook suites tagged PRESERVE (F-039) for CI's tag gate |
| 06-05 | `0ba575a` the definer-hardening migration; `e55e1c9` the mutation check and Playwright evidence |
| 06-06 | `docs(06-06): slice 6 after-floor` and `docs(06-06): slice 6 close, Validated re-confirmation, register` |

The slice-6 floor is green from a clean reset, and slice 7 (06-07) may start.
