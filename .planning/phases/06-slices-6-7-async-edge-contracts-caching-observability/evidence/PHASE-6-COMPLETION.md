# Phase 6 completion: Slices 6 and 7, with evidence

**Plan:** 06-18 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-27
**Tree:** `main` @ `f4c59e4` (the after-floor's line 1; the supabase-js bump, the last code change of the phase) + this plan's Task 2 and Task 3 documentation commits · **Phase range:** `f186621..HEAD` (`f186621` is `docs(06): begin phase 6 execution`; 70 phase commits before this plan's Task 2 commit; 38 of them are code, test or package commits, the rest documentation and evidence)

> **Success criteria 1 and 5 are MET. Criteria 2, 3 and 4 are PARTIAL, each on a clause that is owner-dependent or deferred by rule.**
>
> - **MET:**
>   - The cron routes are deleted (nothing called them) and the webhook refuses every bad signature and every replay in the repository.
>   - The recommendation surface is characterized input → ranked output, with the formula's md5 pinned.
>   - Both slices closed on a green floor from a clean reset, with the Validated list re-confirmed row by row.
>   - Every intentional behaviour change is logged in its commit and in the slice close.
> - **Criterion 2 is PARTIAL:** every route handler parses through a zod contract (census 0/0) and answers 400 on malformed input, and the client reuses the contracts by type. The events-webhook edge function still answers 500 to three malformed payload shapes (DI-83, Phase 8 with its redeploy).
> - **Criterion 3 is PARTIAL:** the `vercel.json` rule is gone, personalized routes are `private, no-store`, public routes opt in by name, and the cross-user test passes through a stand-in that applies Vercel's rules. It is **MET locally; the real-CDN probe is owed as DI-81**.
> - **Criterion 4 is PARTIAL:** JSON logs with levels and request ids run in the proxy and every handler, and `/api/health` is done. Sentry is wired, scrubbed and tagged, and the correlation id is proven through the real SDK with an in-memory transport. **A live event in a Sentry project and the source-map upload need the owner's DSN and token (DI-81).**
>
> **Requirements:**
>
> - **REFAC-14, REFAC-16, REFAC-19, REFAC-20, REFAC-22 and REFAC-23 are Complete.**
> - **REFAC-15 is PARTIAL**, on "returns a consistent 400 shape on malformed input" at the webhook handler (DI-83).
> - **REFAC-21 is PARTIAL**, on "source maps" and "a deliberately triggered error appears in Sentry with the correlation id" (DI-81).
>
> **DI-53 / DI-25 is CLOSED:** `@supabase/supabase-js` is on exactly 2.116.0 (`f4c59e4`), after a throwaway-worktree tsc with 0 errors.
>
> **No production access, no push.** One local-only migration (`20260926120000`) and four findings wait for DI-23. **Before any push to `main`, the owner has actions to take (§ 8).** CI on this phase's head is UNOBSERVED (§ 11).

---

## 1. How to read this note

Every claim cites a committed path. `evidence/<file>` means
`.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/<file>`. The command in
§ 12 extracts every backticked path, resolves `evidence/` against the phase directory, and checks each one
against `git ls-files`. A path it cannot find counts as missing, and the count must be 0. Deleted files are
named without backticks so the check stays honest. Commit hashes are cited by their short form and can be
checked with `git show`.

The floors: `evidence/floor.before.txt` (base `f186621`), `evidence/floor.slice-6-after.txt` (`71bfd55`) and
`evidence/floor.phase-after.txt` (`f4c59e4`). The slice closes are `evidence/slice-6-close.md` and
`evidence/slice-7-close.md`. The decisions are `evidence/phase-06-decisions.md`; the deferred register is
`evidence/deferred-items.md`; the defect ledger is `evidence/defect-ledger.md`. Nothing here is taken from a
planning document alone.

A verdict is **MET** when committed evidence proves the clause, and **PARTIAL** when a named part is unproven or
undone. A met success criterion does not round a requirement up; each requirement is measured against its own
sentence (§ 3).

---

## 2. The five success criteria, clause by clause

### Criterion 1

> "Cron and webhook routes require credentials and fail closed when they are absent, and the recommendation API surface is characterized input → ranked output with the scoring formula left unchanged."

| Clause | Verdict | Evidence |
|---|---|---|
| Cron routes require credentials and fail closed when absent | MET, by deletion | Nothing called them: no `crons` key in `vercel.json`, pg_cron runs the SQL functions directly, no caller in `src`, `e2e`, `scripts` or `.github` (`evidence/cron-deletion.txt` § 1). Deleted by `ffd973e` (DEC-63); both paths answer 404 to GET and POST on a production build (`evidence/floor.slice-6-after.txt` block 8e). No reader of `CRON_SECRET` remains, and the elevated ratchet is `committed=0 live=0` at the phase close (`evidence/floor.phase-after.txt` block 5). The work they duplicated runs in pg_cron (block 16b) |
| Webhook routes require credentials and fail closed when absent | MET in the repository; the stricter behaviour is live after the owner's redeploy (DI-81) | HMAC over the raw body (DEC-64). `src/__tests__/webhook/webhook-handler.test.ts`: a missing URL, key or secret answers 500 `Server configuration error`; a missing or wrong signature 401; a **wrong-length signature 401** (was 500); a **replay reports each event `duplicate`** and inserts nothing (`239b7cd`; `evidence/webhook.txt`). The deployed function already refused unsigned and wrongly signed requests; its 500 on a wrong length and its re-insert of a replay end with the CI redeploy and a confirmed `WEBHOOK_SECRET` (§ 8) |
| The recommendation API surface is characterized input → ranked output | MET | `src/__tests__/api/recommendations/recommendations-characterization.test.ts` (13 PRESERVE rows: status, ordered ids, `source`, λ, the variant, `total_events`, the pool limit, `private, no-store`); a λ mutation turned 3 rows red (`evidence/slice-6-characterization.txt` § 2). Unedited through both slices and green in the phase after-floor (block 1). The real-stack signed-in path: `e2e/specs/async-edge.spec.ts` 'FIXED F-017' (`evidence/playwright.phase-after.txt`) |
| … with the scoring formula left unchanged | MET | pgTAP 070 row 1 pins `md5(prosrc)` of `compute_user_scores()` (DEC-68) and row 4 the sum of the five breakdown parts; green unseeded and seeded at the phase close (`evidence/floor.phase-after.txt` blocks 11, 13). 06-05 changed the function only by `SET search_path` and `REVOKE` (`evidence/schema-push-slice-6.txt`) |

**Criterion 1: MET.** The webhook's two intentional changes reach production with the redeploy (DI-81); that is
F-039's deployment-record clause, not a clause of this criterion.

### Criterion 2

> "Every handler validates input with a zod schema from `src/contracts/` at its boundary and returns a consistent 400 shape on malformed input, with the same schemas exported and reused by client hooks so client and handler cannot drift."

| Clause | Verdict | Evidence |
|---|---|---|
| Every handler validates input with a zod schema from `src/contracts/` at its boundary | MET for every route handler; the webhook's schema is re-exported from `src/contracts/webhook.ts` | `node scripts/check-contracts.mjs`: `committed=0 live=0`, empty `scripts/contracts-allowlist.json` (`edb5eef`; `evidence/floor.phase-after.txt` block 7b). No route file reads `request.json()`, `.formData()` or `searchParams` outside `src/server/body.ts` (census C2, C3, C5 at 0). **Exemption by rule:** the auth callback's four OAuth query parameters, excepted by name (DEC-65; census C4 = those four); `next` is validated by the callback's own redirect check. The owner may read that exemption as a gap |
| … and returns a consistent 400 shape on malformed input | **PARTIAL** | Every route handler: a body that is not JSON answers 400 `Invalid JSON body`, a non-object body 400 `Request body must be a JSON object`, a wrongly typed field the route's 400 text; `{ error }` everywhere, with `field` only at the named sites (DEC-65; `FIELD_SITES` in `src/__tests__/contracts/bad-request-characterization.test.ts`). The DEFECT suites moved to 400 (`src/__tests__/api/slice6-malformed-input-defect.test.ts`, `src/__tests__/contracts/malformed-input-defect.test.ts`, whose site lists are now empty; ledger rows in `evidence/defect-ledger.md`). **Not met at one handler:** the events-webhook edge function answers 500 to a JSON `null` payload, a `null` element and a non-string tag (PRESERVE rows 7, 11, 12 of `src/__tests__/webhook/webhook-handler.test.ts`; DI-83, Phase 8 with the redeploy) |
| … with the same schemas exported and reused by client hooks so client and handler cannot drift | MET | 06-11 (`e2771b7`, `54da7b5`): the eight hooks type their requests and check responses in development against the contracts; every client mutation body is typed from its handler's contract; `node scripts/check-contracts.mjs --client` reports `client files=38 violations=0` and runs in CI (`evidence/client-contracts.txt`; `evidence/floor.phase-after.txt` block 7d). A breaking contract change fails `tsc` at the caller (`evidence/client-contracts.txt` § 2.5); zod stays out of the production client chunks (§ 2.7-2.8) |

**Criterion 2: PARTIAL**, on the webhook's three malformed shapes (DI-83).

### Criterion 3

> "The blanket `s-maxage=60` is gone from `vercel.json`, personalized routes return `private, no-store`, public routes opt in to caching explicitly, and a cross-user cache regression test passes."

| Clause | Verdict | Evidence |
|---|---|---|
| The blanket `s-maxage=60` is gone from `vercel.json` | MET in the repository; effective on the owner's next deploy | `6221669` removed the `headers` rule; `vercel.json` has no `headers` (census C8, `evidence/floor.phase-after.txt`); `src/__tests__/config/vercel-json-defect.test.ts` moved |
| Personalized routes return `private, no-store` | MET | Every route file on `withRoute` with a named class (`src/__tests__/api/cache-headers-census.test.ts`); the live sweep over every personalized and auth-gated row, signed in and anonymous, answers `private, no-store` (`e2e/specs/cache-headers.spec.ts`, `64939b2`; `evidence/cache-e2e.txt` § 3.3); green in the phase after-floor |
| Public routes opt in to caching explicitly | MET | Eleven public GET rows carry a named class (`public-30-60`, `public-60-120`, `public-60-300`) checked against an independent target in `inventory/endpoints.json` (`83e2f7e`); each answers 200 anonymously with its own value (`e2e/specs/cache-headers.spec.ts`) |
| A cross-user cache regression test passes | **MET locally, with the real-CDN probe owed as DI-81** | `e2e/specs/cross-user-cache.spec.ts` (`eaed119`) through `e2e/helpers/sharedCacheProxy.ts`, a stand-in that applies Vercel's caching rules: positive and negative controls pass, and nine personalized GETs filled by one persona are never served to another or to an anonymous caller; 23 of 23 in `evidence/playwright.phase-after.txt`. The same probe against Vercel's real CDN is F-025's own criterion and has not been run (the commands are in `evidence/cache-e2e.txt` § 5) |

**Criterion 3: PARTIAL**, on the real-CDN run of the cross-user test only. F-025 stays Open at "08".

### Criterion 4

> "Server code emits structured JSON logs with levels and a request correlation id on both Node and middleware runtimes, a deliberately triggered error appears in Sentry carrying that correlation id (Turbopack-aware setup, source maps, environment and release tagging, PII scrubbing decided before install), and `/api/health` reports DB, auth, storage, pg_cron freshness, and last webhook receipt in a documented shape without using `getSession()` for access control."

| Clause | Verdict | Evidence |
|---|---|---|
| Structured JSON logs with levels and a request correlation id, Node and middleware runtimes | MET | `src/server/log.ts` writes one redacted JSON line `{ ts, level, msg, requestId, route, scope, … }` (`d790b21`; `src/server/__tests__/log.test.ts`). The proxy (middleware runtime) mints `x-request-id` and logs through the same logger; every wrapped handler (Node) runs inside the request store (`4ad1fae`, `f044f02`, `217593b`, `2c12a61`, `29ced7e`, `6221669`; `src/proxy-request-id.test.ts`). The server console census allows exactly two entries, neither a log call in server-only code: `src/lib/tagMapping.ts` (shared with client components) and the callback's redirect text (`evidence/floor.phase-after.txt` blocks 7e, 7f; census C1 = 1 line) |
| A deliberately triggered error appears in Sentry carrying that correlation id | **PARTIAL: proven through the real SDK in Jest; the live event is a human-check** | `src/server/__tests__/sentry.test.ts` initializes `@sentry/nextjs` 10.75.3 with an in-memory transport built by `Sentry.createTransport`; a throw inside `withRoute` and inside the proxy ring produces an event whose `tags.request_id` equals the response's `x-request-id` (`848034e`; `evidence/sentry.txt` §§ 1, 7). No Sentry project exists yet, so no event has reached one (DI-81) |
| Turbopack-aware setup | MET | `src/instrumentation.ts` inits Sentry in `register()` and exports `onRequestError`; `src/instrumentation-client.ts` for the browser; `next.config.js` wraps with `withSentryConfig`; the Turbopack production build passes (`evidence/sentry.txt`; `evidence/floor.phase-after.txt` block 8d) |
| Source maps | **PARTIAL** | Upload is configured to run only when `SENTRY_AUTH_TOKEN` is set; the token-less build exits 0 with "No auth token provided. Will not create release." (`evidence/build-ci-env.txt`). No upload has run (DI-81) |
| Environment and release tagging | MET in the code | `src/sentry.server.config.ts`: `environment` from `VERCEL_ENV`, `release` from `VERCEL_GIT_COMMIT_SHA`; observed on a real event only with the DSN (DI-81) |
| PII scrubbing decided before install | MET | DEC-76 (`evidence/phase-06-decisions.md`) and the legitimacy bundle (`evidence/sentry-legitimacy.txt`) precede the install (`0013c08`); `sendDefaultPii: false`, no request bodies or cookies, emails redacted, user ids hashed (`src/lib/observability/scrub.test.ts`, `src/server/__tests__/sentry.test.ts`; `docs/observability.md`) |
| `/api/health` reports DB, auth, storage, pg_cron freshness and last webhook receipt in a documented shape | MET | `747ef77`: the report `{ status, version, ts, checks: { db, auth, storage, pg_cron, webhook } }` (`src/contracts/health.ts`, `docs/health.md`); `src/__tests__/api/health/health.test.ts`; `e2e/specs/health.spec.ts` in `evidence/playwright.phase-after.txt`. pg_cron reports `unknown` in production until DI-23 creates `cron_job_status()` (documented) |
| … without using `getSession()` for access control | MET | Census C6 = 0 non-test `getSession(` calls in `src` (`evidence/floor.phase-after.txt`); `src/server/__tests__/getsession-gate.test.ts` asserts the empty list |

**Criterion 4: PARTIAL**, on the live Sentry event and the source-map upload, both needing the owner's DSN and
token.

### Criterion 5

> "After the final slice the Playwright happy-path specs pass and every Validated workflow in PROJECT.md is re-confirmed, with each slice landing as one reviewable change naming the finding IDs it closes and any intentional behavior change logged."

| Clause | Verdict | Evidence |
|---|---|---|
| After the final slice the Playwright happy-path specs pass | MET | 269 passed, 0 failed, from a clean reset with the CSP enforced (`bypassCSP: false`), first run of each half (`evidence/playwright.phase-after.txt`). After slice 6: 100 passed (`evidence/playwright.slice-6-after.txt`) |
| Every Validated workflow in PROJECT.md is re-confirmed | MET | 16 of 16 rows after slice 6 (`evidence/slice-6-close.md` § 2) and after slice 7 and the phase (`evidence/slice-7-close.md` § 2; § 4 below) |
| Each slice landing as one reviewable change naming the finding IDs it closes | MET, as a commit range with its close note | Slice 6 is `f186621..71bfd55`, reviewed through `evidence/slice-6-close.md` §§ 4, 8; slice 7 is `f550de9..f4c59e4`, reviewed through `evidence/slice-7-close.md` §§ 3, 5. Every code commit's subject names its requirement and finding ids. The ranges are not squashed; the owner may squash on push |
| Any intentional behaviour change logged | MET | Every behaviour-changing commit carries `INTENTIONAL BEHAVIOUR CHANGE` in its body, and each is tabled in the slice closes and § 5 below; every moved pin has a ledger row (`evidence/defect-ledger.md`) |

**Criterion 5: MET.**

---

## 3. Requirements, measured against their own sentences

**REFAC-14**: "Slice 6 (recommendations/interactions/notifications/cron/webhook): cron and webhook routes require
credentials and fail closed when absent, the recommendation API surface is characterized (input → ranked output)
with the scoring formula left unchanged"

| Clause | Verdict | Evidence |
|---|---|---|
| cron routes require credentials and fail closed when absent | MET | § 2, criterion 1 row 1 |
| webhook routes require credentials and fail closed when absent | MET | § 2, criterion 1 row 2 |
| the recommendation API surface is characterized (input → ranked output) | MET | § 2, criterion 1 row 3 |
| with the scoring formula left unchanged | MET | § 2, criterion 1 row 4 |

**REFAC-14: Complete** (recorded at 06-06, re-confirmed on the phase after-floor).

**REFAC-15**: "Every handler validates input with a zod schema at its boundary and returns a consistent 400 shape
on malformed input; schemas live in `src/contracts/`"

| Clause | Verdict | Evidence |
|---|---|---|
| Every handler validates input with a zod schema at its boundary | MET for every route handler, with the callback's OAuth parameters exempt by rule (DEC-65) | § 2, criterion 2 row 1 |
| returns a consistent 400 shape on malformed input | **PARTIAL** | § 2, criterion 2 row 2: every route handler does; the events-webhook edge function answers 500 to three malformed shapes (DI-83) |
| schemas live in `src/contracts/` | MET | Ten contract modules plus `src/contracts/webhook.ts`, which re-exports the Deno-shared webhook schema (`src/contracts/common.ts`, `src/contracts/events.ts`, `src/contracts/clubs.ts`, `src/contracts/users.ts`, `src/contracts/admin.ts`, `src/contracts/health.ts`, …; census C9 in `evidence/floor.phase-after.txt`) |

**REFAC-15: PARTIAL.** Unmet clause: "returns a consistent 400 shape on malformed input", at the events-webhook
handler only (DI-83). It closes when the three PRESERVE rows move to 400 in the change that redeploys the
function from CI (Phase 8).

**REFAC-16**: "zod contracts are exported and reused by client hooks so client and handler cannot drift"

| Clause | Verdict | Evidence |
|---|---|---|
| zod contracts are exported and reused by client hooks | MET | § 2, criterion 2 row 3 |
| so client and handler cannot drift | MET | `tsc` fails at the caller on a breaking contract change, and CI's `--client` census refuses an untyped mutation (`evidence/client-contracts.txt` § 2.5) |

**REFAC-16: Complete** (recorded at 06-11).

**REFAC-19**: "Slice 7 (close-out): the blanket `s-maxage=60` on `/api/*` is removed from `vercel.json`,
personalized routes return `private, no-store`, public routes opt in explicitly, and a cross-user cache
regression test passes"

| Clause | Verdict | Evidence |
|---|---|---|
| the blanket `s-maxage=60` on `/api/*` is removed from `vercel.json` | MET | § 2, criterion 3 row 1 |
| personalized routes return `private, no-store` | MET | § 2, criterion 3 row 2 |
| public routes opt in explicitly | MET | § 2, criterion 3 row 3 |
| a cross-user cache regression test passes | MET | `e2e/specs/cross-user-cache.spec.ts` passes (§ 2, criterion 3 row 4). The requirement asks for a regression test that passes; the real-CDN probe is F-025's criterion, tracked there and in § 8 |

**REFAC-19: Complete** (recorded at 06-15, re-confirmed on the phase after-floor).

**REFAC-20**: "A structured JSON logger with levels and a request correlation id replaces `console.*` calls in
server code, working on both Node and middleware runtimes"

| Clause | Verdict | Evidence |
|---|---|---|
| a structured JSON logger with levels and a request correlation id | MET | § 2, criterion 4 row 1 |
| replaces `console.*` calls in server code | MET | Census C1: 160 lines in 56 files before, 1 line at the close, `src/lib/tagMapping.ts`, a module shared with client components and allow-listed with that reason (`evidence/floor.phase-after.txt`) |
| working on both Node and middleware runtimes | MET | The proxy and instrumentation (`4ad1fae`) and every handler (06-13, 06-14) |

**REFAC-20: Complete** (recorded at 06-14).

**REFAC-21**: "Sentry is installed with a Turbopack-aware setup, source maps, environment and release tagging,
and PII scrubbing rules decided before install; a deliberately triggered error appears in Sentry with the
correlation id"

| Clause | Verdict | Evidence |
|---|---|---|
| Sentry is installed with a Turbopack-aware setup | MET | § 2, criterion 4 row 3; `@sentry/nextjs` 10.75.3 exact (`0013c08`, `evidence/sentry-install.txt`) |
| source maps | **PARTIAL** | § 2, criterion 4 row 4: configured, never uploaded (no token) |
| environment and release tagging | MET in the code | § 2, criterion 4 row 5 |
| PII scrubbing rules decided before install | MET | § 2, criterion 4 row 6 |
| a deliberately triggered error appears in Sentry with the correlation id | **PARTIAL** | § 2, criterion 4 row 2: proven through the SDK's own transport in Jest; no Sentry project exists |

**REFAC-21: PARTIAL.** Unmet clauses: "source maps" (upload) and "appears in Sentry". Both close when the owner
sets the DSN and token on a preview deploy and triggers the error in § 8 step 6.

**REFAC-22**: "`/api/health` checks DB, auth, storage, pg_cron freshness, and last webhook receipt, returns a
documented shape, and does not use `getSession()` for access control"

| Clause | Verdict | Evidence |
|---|---|---|
| checks DB, auth, storage, pg_cron freshness, and last webhook receipt | MET | § 2, criterion 4 row 7. `webhook.last_ingest_at` is the newest scraper-sourced insert by any path (C23, documented in `docs/health.md`) |
| returns a documented shape | MET | `docs/health.md`; `src/contracts/health.ts` |
| does not use `getSession()` for access control | MET | § 2, criterion 4 row 8 |

**REFAC-22: Complete** (recorded at 06-17).

**REFAC-23**: "After each slice, the Playwright happy-path specs pass and the Validated workflow list in PROJECT.md
is re-confirmed"

| Clause | Verdict | Evidence |
|---|---|---|
| After each slice, the Playwright happy-path specs pass | MET | Slice 6: 100/0 (`evidence/playwright.slice-6-after.txt`). Slice 7 and the phase: 269/0 with the CSP enforced (`evidence/playwright.phase-after.txt`). Slices 1-5 closed the same way in Phases 4 and 5 |
| the Validated workflow list in PROJECT.md is re-confirmed | MET | 16 of 16 after each slice (`evidence/slice-6-close.md` § 2, `evidence/slice-7-close.md` § 2) |

**REFAC-23: Complete** (this plan).

---

## 4. Validated-workflow re-confirmation, after both slices

The row-by-row tables with every spec and suite are `evidence/slice-6-close.md` § 2 and `evidence/slice-7-close.md`
§ 2. Every test named there is green on the phase after-floor from a clean reset. The re-confirmation of each
bullet, after both slices:

| # | Validated workflow (PROJECT.md) | Re-confirmed at the phase close by | Caveat carried |
|---|-------------------------------|------------------------------------|----------------|
| 1 | Sign in with Google OAuth; non-McGill emails rejected | `e2e/auth.setup.ts` 10 of 10 in each half; `src/app/auth/callback/route.test.ts` (PRESERVE, unedited) | — |
| 2 | Anonymous visitors browse public event and club content | `e2e/specs/anonymous-browse.spec.ts`, `e2e/specs/event-read-path.spec.ts`, `e2e/specs/public-profile-privacy.spec.ts`; the public rows of `e2e/specs/cache-headers.spec.ts`; `e2e/specs/csp.spec.ts` | — |
| 3 | Onboarding interest tags; guard on unfinished onboarding | `e2e/specs/ban-and-onboarding-ring.spec.ts`, `e2e/specs/protected-route-redirect.spec.ts` | — |
| 4 | Browse, search, filter events by tag, date, time of day | `e2e/specs/event-read-path.spec.ts`; the events-list and events-detail characterization suites, unedited | F-078 (search on the ILIKE fallback) |
| 5 | Save/unsave events and RSVP | `e2e/specs/save-and-rsvp.spec.ts`, `e2e/specs/csrf-origin.spec.ts`; the saved-events PRESERVE suite unedited through F-085's fix | DI-96 (one flake in 06-08) |
| 6 | Personalized recommendations with popularity fallback | `recommendations-characterization.test.ts` (PRESERVE); `e2e/specs/async-edge.spec.ts` 'FIXED F-017'; pgTAP 070 rows 1 and 4 | F-041; DI-82 (the admin batch trigger) |
| 7 | Organizers create/edit clubs, post events, invite, manage roles, switch clubs | `e2e/specs/club-owner-surfaces.spec.ts`, `e2e/specs/club-authorization.spec.ts`, `e2e/specs/club-invitation-acceptance.spec.ts` | F-016 |
| 8 | Organizer events auto-approved; others moderated | `e2e/specs/admin-moderation-queue.spec.ts`; `club-gates-characterization.test.ts`; pgTAP 060 | — |
| 9 | Follow/unfollow clubs; public club pages | `e2e/specs/anonymous-browse.spec.ts`; the follow rows of `write-handlers-characterization.test.ts` | DI-88 (a failed club read caches a 404) |
| 10 | Organizer event-level and club-level analytics | `e2e/specs/club-authorization.spec.ts` analytics rows; `src/__tests__/api/events/analytics.test.ts`, `src/__tests__/api/clubs/analytics.test.ts` | DI-92 |
| 11 | Attendees review past events; aggregate feedback | `src/__tests__/api/events/reviews.test.ts` | — |
| 12 | Admins moderate, ban/suspend, reports and appeals, audit log | `e2e/specs/admin-guard.spec.ts`, `admin-write-paths.spec.ts`, `admin-audit-row.spec.ts`, `admin-moderation-queue.spec.ts`, `banned-redirect.spec.ts`, `event-moderation-notifications.spec.ts`, `e2e/specs/admin-page-gates.spec.ts` | F-007 (local-only, DI-23); DI-87 (admin clubs and organizer requests 500 on the reset schema) |
| 13 | In-app notifications and email reminders | `notifications-characterization.test.ts` (PRESERVE); `e2e/specs/event-moderation-notifications.spec.ts`; the reminder and feedback pg_cron jobs (`evidence/floor.phase-after.txt` block 16b) | F-038 (no email is sent; owner decision) |
| 14 | Instagram scraper pipeline, classify and ingest with dedup | `src/lib/classifier.test.ts`; the four `src/__tests__/webhook/` suites | Live after DI-81's redeploy; DI-83, DI-84 |
| 15 | A/B experiment framework | `e2e/specs/async-edge.spec.ts` 'FIXED F-017'; `src/lib/experiments.test.ts` | F-017 resolved in slice 6 |
| 16 | Interaction tracking feeds popularity and interaction signals | `interactions-feedback-characterization.test.ts` (PRESERVE); pgTAP 070 rows 3-4 | No e2e test of the signal pipeline, as at every close |

---

## 5. Every intentional behaviour change the phase shipped, with its authority

Every commit below carries `INTENTIONAL BEHAVIOUR CHANGE` in its body. "On deploy" marks a change the repository
holds that production gets only when the owner deploys (the local stack runs it now).

| # | Change | Finding | Commit | Decision |
|---|--------|---------|--------|----------|
| 1 | `/api/cron/send-reminders` and `/api/cron/send-feedback-requests` answer 404 (deleted; nothing called them) | F-002, F-037 | `ffd973e` | DEC-63 |
| 2 | **On redeploy.** The webhook answers 401 to a wrong-length signature and reports a replay `duplicate` | F-039 | `239b7cd` | DEC-64 |
| 3 | Malformed slice-6 bodies answer 400 instead of 500 (interactions, feedback, recommendations/feedback) | F-094 | `2617b7b` | DEC-65 |
| 4 | An anonymous `GET /api/notifications/count` answers 401 | F-028 | `2617b7b` | DEC-69 |
| 5 | Non-admins are assigned A/B variants through the door; the reports list answers 200 with reporters | F-017, F-092 | `376bf37` | DEC-68 |
| 6 | **Local only until DI-23.** Definer functions revoked from anon/authenticated, friends RPCs subject-bound, reminders skip deleted and unapproved events, `cron_job_status()` | F-074, F-075, F-076, F-093 | `0ba575a` | DEC-70 |
| 7 | The local stack schedules the reminder and feedback jobs as production does | F-042 | `0ba575a` | DEC-71 |
| 8 | Malformed events, club, user, profile and admin bodies answer 400 instead of 500 | F-094 | `4caf196`, `4f918ae`, `a543979`, `f869323` | DEC-65 |
| 9 | Scheme-less club links stored with `https://`; non-http(s) schemes refused on create and edit | F-094 (DI-66) | `4f918ae` | DEC-66 |
| 10 | An admin's own id in another case is refused at ban and role change | F-094 (DI-64) | `f869323` | DEC-66 |
| 11 | Proxy, boot, rate-limit, after-response, audit and route log lines are JSON; every response carries `x-request-id` | F-058 | `4ad1fae`, `f044f02`, `217593b`, `2c12a61`, `29ced7e`, `6221669` | DEC-74 |
| 12 | An uncaught throw answers `{"error":"Failed to <action>"}` 500 | F-058 | `217593b`, `2c12a61`, `29ced7e`, `6221669` | DEC-73 |
| 13 | A caught database error answers generic text, never its message | F-059 | `217593b`, `2c12a61`, `29ced7e`, `6221669`, `747ef77` | DEC-75 |
| 14 | **On deploy.** Personalized and auth-gated responses carry `private, no-store`; `vercel.json` adds no `s-maxage` | F-025, F-026 | `217593b`, `2c12a61`, `29ced7e`, `6221669` | DEC-73 |
| 15 | `/api/events/[id]` and the rsvp GET answer `private, no-store` | C7, F-028 | `29ced7e` | DEC-69 |
| 16 | **On deploy.** Production pages no longer permit `eval` | F-055 | `d6e8489` | DEC-77 |
| 17 | Anonymous `/api/health` answers `{ status, version }` only | F-029 | `747ef77` | DEC-78 |
| 18 | `/docs` and `/health` are admin-only; banned admins are redirected from admin and moderation pages and refused by the reviews API | F-054, DI-55 | `00aa06d` | DEC-79 |
| 19 | Saved events' "upcoming" is the feed's Eastern floor | F-085 | `b8e20f4` | DEC-80 |

`f4c59e4` (the SDK bump), `097e928` and `0013c08` (the zod and Sentry installs), `848034e` (Sentry sends nothing
until a DSN is set) and the characterization and test commits carry no wire change of their own.

---

## 6. Checkpoints and decisions resolved by rule

**No phase owner was present at any point in Phase 6.** Every decision below is a rule-resolved default under the
mechanism in `evidence/phase-06-decisions.md` (the owner may override any decision by appending a signed
paragraph). No decision carries a signed owner paragraph. No plan had a blocking checkpoint (DEC-81); the
human-checks are carried to § 8.

| Decision | What it decided | Executed by |
|---|---|---|
| **DEC-60** | zod pinned exactly at 4.6.5, resolved by rule on its legitimacy bundle (`evidence/zod-legitimacy.txt`); the owner's countersignature is a human-check | 06-03 |
| **DEC-61** | `@sentry/nextjs` pinned exactly at 10.75.3, not 11.0.0, installed with the CLI download skipped (`evidence/sentry-legitimacy.txt`) | 06-16 |
| DEC-62 | Plan map: slice 6 is 06-02..06-06, slice 7 is 06-07..06-18 | 06-01 |
| DEC-63 | The cron routes are deleted with their ESLint override; F-002 and F-037 close by deletion | 06-03 |
| **DEC-64** | The webhook keeps HMAC; wrong-length signatures answer 401; replays refused by `content_hash` | 06-03 |
| DEC-65 | The contract boundary (`parseBody`, `parseQuery`, `parseForm`), today's texts, `field` only where named; the callback's OAuth params exempt | 06-04, 06-08..06-10 |
| **DEC-66** | F-094 absorbs DI-64 and DI-66: canonical UUIDs and one club-link rule | 06-09, 06-10 |
| DEC-67 | Client reuse: typed mutation bodies, development-only checks in the eight hooks | 06-11 |
| DEC-68 | Recommendations characterized, not changed; F-017 through the door; the formula pinned by md5 | 06-02, 06-04, 06-05 |
| **DEC-69** | F-028's remainder: the rsvp GET and club events GET stay 200 for public pages, made `private, no-store`; F-092 | 06-04, 06-14 |
| **DEC-70** | The definer-hardening migration `20260926120000` | 06-05 |
| DEC-71 | The local reminder jobs run; tests never depend on them | 06-05 |
| DEC-72 | The findings rule: owner-dependent and local-only closures stay Open at "08" | 06-06, 06-18 |
| **DEC-73** | `withRoute` and the named cache classes; `vercel.json` loses its rule | 06-12..06-14 |
| DEC-74 | The request id and the hand-rolled JSON logger | 06-12 |
| DEC-75 | F-059: one error vocabulary | 06-13, 06-14, 06-17 |
| DEC-76 | The Sentry posture, decided before install | 06-16 |
| DEC-77 | The CSP: no `'unsafe-eval'` outside `next dev`; `'unsafe-inline'` deferred (DI-80) | 06-16 |
| **DEC-78** | Health: liveness for all; the report for an admin or a `HEALTH_TOKEN` bearer | 06-17 |
| **DEC-79** | The admin page gate `requireAdminPage` | 06-17 |
| DEC-80 | Close-out code: F-085, then supabase-js 2.116.0 last | 06-10, 06-18 |
| DEC-81 | No blocking checkpoint; human-checks carried as DI-81; CLAUDE.md only by signed authorization | 06-01..06-18 |

**Review these first:** DEC-60 and DEC-61 (the two package installs, § 8 step 1), DEC-64 (the webhook's contract
with its sender), DEC-66 (club links rewritten on save), DEC-69 (two personalized routes still 200 to anonymous
callers), DEC-70 (the migration waiting for DI-23), DEC-73 (what every route's cache header is), DEC-78 (the
`HEALTH_TOKEN` bearer is a second way to read the report) and DEC-79 (who can open `/docs` and `/health`).

**Decisions taken by the orchestrator or executors during the phase (each accepted by the orchestrator, none
owner-signed):**

- `57cb55f` (orchestrator, after 06-04; the phase's only between-plan code commit): the two 06-03 webhook suites
  tagged PRESERVE citing F-039 after CI's tag gate went red on HEAD (DI-86, closed).
- 06-13 moved the source-form tree scans out of two PRESERVE suites into `src/__tests__/api/admin/admin-arm-tree-defect.test.ts`
  and `src/__tests__/api/auth-ring/write-arm-tree-defect.test.ts`, and 06-14 moved one error-text row into
  `src/__tests__/api/recommendations/batch-error-text-defect.test.ts`, each with ledger rows, because the wrapped
  export form and F-059's fix contradict a pin that read source text. The plan's "PRESERVE unedited" acceptance
  line failed as written; the behaviour rows are unedited.
- 06-14 kept the auth callback's server-console allow-list entry: its failed-sign-in redirect carries the
  provider's text, pinned by the PRESERVE callback suite (F-059 residue, Phase 7 decision, DI-98).
- 06-17 tightened `src/server/__tests__/getsession-gate.test.ts` to an empty list, the change the suite's own
  header anticipated.
- 06-18 recorded DI-83 as F-094's stated residue instead of changing the webhook after the SDK bump (§ 9), and
  marked F-029 Fixed with the `HEALTH_TOKEN` bearer stated in its resolution.

**Human-checks (the owner performs them; none was performed in this phase):** the DEC-60 and DEC-61
countersignatures; the first real Sentry event with its `request_id` tag and the source-map upload; the two-session
probe on the real CDN; the `events-webhook` redeploy from CI with `WEBHOOK_SECRET` confirmed; `HEALTH_TOKEN`
provisioning; the `.env.local.example` update; A5 and A6 on the first deploy. All are in § 8.

---

## 7. Local-only closures, pending DI-23

Nothing in Phase 6 wrote to production: no push subcommand, no linked-project flag, no deploy, and `.env.local` was
not read by any executor command.

- **Migration `supabase/migrations/20260926120000_async_edge_definer_hardening.sql`** (06-05, `0ba575a`): applied on
  every local reset (`evidence/floor.phase-after.txt` block 10); pgTAP 031 and 070 green unseeded and seeded.
  Production gets it only through the DI-23 repair.
- **F-074** (High): friends RPCs subject-bound; any anonymous caller can still read any user's friend graph in
  production until the repair.
- **F-075** (High): definer functions revoked from anon and authenticated; the anon key can still trigger a full
  recompute or a reminder run in production until the repair.
- **F-076** (Medium): every SECURITY DEFINER function in `public` carries a `search_path`.
- **F-093** (Medium): reminders skip deleted and unapproved events; production keeps sending them every 15 minutes
  until the repair.
- `public.cron_job_status()` does not exist in production until the repair, so the health report's `pg_cron` check
  answers `unknown` there (`docs/health.md`).

Each of the four findings is Open at "08" in `.planning/audit/findings.json` with its resolution text (DEC-72).

---

## 8. Phase 8 deploy prerequisites

These are the actions only the owner can take. The phase performed none of them, because production is never
touched. **Vercel deploys `main` automatically, so steps 1-5 come BEFORE any push to `main`.** Steps 6-10 need a
preview or production deploy.

1. **Countersign DEC-60 and DEC-61** from their bundles, before any push to `main`: `zod` 4.6.5
   (`evidence/zod-legitimacy.txt`: GitHub Actions publisher with SLSA provenance, integrity recorded) and
   `@sentry/nextjs` 10.75.3 (`evidence/sentry-legitimacy.txt`). The supabase-js 2.116.0 registry facts are recorded
   in `evidence/di-53-bump.txt` block 0 for the same review.
2. **The Phase 5 Upstash actions still open (DI-42):** countersign DEC-59's pins, provision Upstash on Vercel and
   set `RATE_LIMIT_REQUIRE_DISTRIBUTED` as `.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/PHASE-5-COMPLETION.md`
   § 8 (a) and (b) describe.
3. **Set the Sentry and health variables in Vercel:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` (needed at build time
   for the browser and for the CSP's `connect-src`), `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and
   `HEALTH_TOKEN` (at least 32 characters; shorter disables token access with one warn line) for the uptime
   monitor. Setup steps: `docs/observability.md`, `docs/health.md`.
4. **Update `.env.local.example`** with those six names. This session was denied from reading the file, so the
   owner makes the edit.
5. **Apply the CLAUDE.md fact corrections if you agree** (`evidence/claude-md-corrections.patch`,
   `git apply` from the repository root; see DI-46 in `evidence/deferred-items.md`).
6. **On a preview deploy with a real DSN: trigger an error through a wrapped route** and confirm the Sentry event's
   `request_id` tag equals the response's `x-request-id`, and that its stack trace resolves through uploaded source
   maps. These are REFAC-21's two open clauses (`docs/observability.md` § owner setup, step 4).
7. **Redeploy `events-webhook` from CI and confirm `WEBHOOK_SECRET`** (F-039's deployment-record clause; A5, the
   `_shared` bundling and `npm:zod` resolution). In the same change, run the Deno suite first (DI-84) and move the
   three malformed-payload rows to 400 (DI-83, which closes REFAC-15).
8. **Apply the Phase 5 and Phase 6 migrations through the DI-23 repair:** the migration-history repair, then the
   pending migrations, including `20260926120000` (pg_cron parity, the revokes, the subject-bound friends RPCs, the
   reminder filters, `cron_job_status()`). This closes F-074, F-075, F-076 and F-093 in production.
9. **Run the two-session CDN probe on a preview (or production) deploy** (DI-81, F-025): the commands are in
   `evidence/cache-e2e.txt` § 5 — set `PROD_HOST`, `COOKIE_A` and `COOKIE_B`, then run
   `bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs`. Expected: the
   controls HIT, and no personalized route is a HIT or STALE for session B. Also confirm that production
   `/auth/v1/health` and `/storage/v1/status` answer like the local stack's (A6), since the health report reads
   them.
10. **Owner decisions:** F-028 (accept the rsvp GET and club events GET as a risk in `risk_acceptance`, or decide they
    answer 401) and F-038 (email reminders: build them or drop "email" from the Validated bullet).

---

## 9. Deferred items and assumptions, final state at the phase close

The full table is `evidence/deferred-items.md` Part 7. In short:

- **Closed in Phase 6:** DI-21 (`d6e8489`), DI-25/DI-53 (`f869323`, `f4c59e4`), DI-26 (`6221669`, `eaed119`,
  `64939b2`), DI-33's cron half (06-06), DI-44's code half (06-04), DI-45 and DI-70 (`4ad1fae`), DI-55 (`00aa06d`),
  DI-58 (`83e2f7e`), DI-86 (`57cb55f`); DI-64, DI-66 and DI-73 retired into F-094 and F-059, both now Fixed.
- **Re-dispositioned at this close:** DI-83 (the webhook's three malformed shapes) is F-094's stated residue, owner
  Phase 8 with the redeploy. 06-18's plan makes the SDK bump the last code change of the phase, so the handler
  change is not made here.
- **Registered at this close from the 06-07..06-17 SUMMARYs:** DI-89 (events PATCH `rsvp_link`/`price` unvalidated),
  DI-90 (avatar and banner URL schemes), DI-91 (`users.visibility` unconstrained), DI-92 (`rsvp_cancelled` declared,
  never sent), DI-93 (unlogged 500s on database errors), DI-94 (client IP in rate-limit log keys), DI-95 (cached
  request ids on public routes), DI-96 (the save flake), DI-97 (admin events dates checked for presence only), DI-98
  (the callback's redirect text), DI-99 (the banned-admin reviews refusal has no real-stack test). Next id: DI-100.
- **Carried with their owners:** DI-23 and DI-43 (Phase 8), DI-42 and DI-81 (owner actions, § 8), DI-47 and DI-59
  (Phase 7), DI-82, DI-85, DI-87, DI-88 (Phase 7), DI-84 (Phase 8), DI-78, DI-79, DI-80, and the Phase 5 items
  DI-61..DI-77 as Part 2 of the register disposed them.
- **DI-46:** no owner-signed authorization exists, so neither CLAUDE.md file was edited; the fact corrections are
  `evidence/claude-md-corrections.patch`, which awaits the owner (§ 8 step 5).
- **Assumptions:** A1 (06-12), A2 (06-16, re-run at the close), A3 (06-16), A4 (06-11), A7 (06-16) and A9 (06-01)
  closed; A8 moot (the OAuth check is deleted); **A5 and A6 open**, each proven only by the owner's first deploy
  (§ 8 steps 7 and 9).

---

## 10. The phase floor, at close

From `evidence/floor.phase-after.txt`, on `f4c59e4`, from a clean reset:

- **Jest:** 3439 passed, 0 failed, 1 skipped (the Upstash live contract; the JSON check proves it is the only one),
  130 suites. Before-floor: 1651.
- **Playwright:** 269 passed, 0 failed, first run of each half, with the CSP enforced. Before-floor: 97.
- **pgTAP:** Files=13, Tests=260, unseeded and seeded. Before-floor: 11 files, 200 tests.
- **Lint / tsc / audit:** 0 errors (17 warnings) / exit 0 / 0 high, 0 critical, 2 moderate, 1 low.
- **CI-env build:** exit 0 with every Sentry variable blank. **Types drift:** none.
- **Ratchet:** `committed=0 live=0` (before-floor 2/2). **Migrations:** 9 parse. **Tag gate:** ok 57 (before 34).
- **Contracts census:** `committed=0 live=0` (before: the gate did not exist; 86 sites at the slice-6 close);
  `--client` violations=0. **Server console census:** `committed=2 live=2`.
- **validate --quick:** 118/2/1, the two by-design snapshot FAILs. **--check endpoints:** 5/5.
  **--check findings:** 8/8.
- **Censuses:** C1 1 line (from 160); C2, C3, C5, C6, C8 at 0; C4 the callback's four OAuth params; C7 the callback's
  one redirect line; C9 19 zod importers, `zod@4.6.5`.
- **Cron:** `cron.job` equals production's list field for field (block 16c); the run history is block 16b.
- **Stack state:** left reset and seeded (block 18). Port 3000 free. The DI-53 throwaway worktree is removed and
  `git worktree list` shows one line (`evidence/di-53-bump.txt` block 7).

---

## 11. CI observation

CI run UNOBSERVED — no push was authorized in this phase.

The phase's commits are local on `main`. Whether `ci`, `types` and `e2e` pass on this head is unknown until the
owner pushes. No claim is made without a run. The push itself is gated on § 8 steps 1-5.

---

## 12. Citation count

Command, run from the repository root after this note was staged (Phase 5's § 12 command, adapted to this phase
directory and extended to `docs/` paths):

```
node -e 'const fs=require("fs"),cp=require("child_process");const D=".planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/";const t=fs.readFileSync(D+"evidence/PHASE-6-COMPLETION.md","utf8");const tr=new Set(cp.execSync("git ls-files").toString().split("\n"));const ps=new Set([...t.matchAll(/`((?:\.planning|src|e2e|scripts|supabase|evidence|docs)\/[^`\s*<]+?)(?::\d+(?:-\d+)?)?`/g)].map(m=>m[1].startsWith("evidence/")?D+m[1]:m[1]).map(p=>p.replace(/\/$/,"")));const miss=[...ps].filter(p=>!tr.has(p)&&![...tr].some(f=>f.startsWith(p+"/")));console.log("distinct="+ps.size+" missing="+miss.length);miss.forEach(m=>console.log("MISSING "+m))'
```

Result: **`distinct=87 missing=0`**. 87 distinct committed paths are cited, and 0 are missing.

*Phase: 06-slices-6-7-async-edge-contracts-caching-observability*
*Plan: 06-18, Task 3*
