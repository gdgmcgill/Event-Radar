# Phase 6 decision record — DEC-60 through DEC-81

**Plan:** 06-01 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-25

These are the design calls every later Phase 6 plan executes against. The binding inputs are
`06-CONTEXT.md` (its decisions and its "Amendments after research" section, which supersedes the
bullets it names) and `06-RESEARCH.md` (§ Corrections C1-C26, § Inventories A-I, § Open Questions,
§ Assumptions A1-A9). The measured floor they are compared against is `evidence/floor.before.txt`
(base `f186621`).

**No phase owner was present.** CONTEXT was gathered in autonomous smart-discuss mode, and every
answer in it was accepted by rule. Every decision below is therefore a **rule-resolved default**,
not an owner verdict. The owner may override any decision by appending a signed paragraph
(name, date, the option chosen) under its section **before the plan named in "Executed by" runs**.
When the executing plan finds such a paragraph, it stops before changing a file and re-plans against
it. This is the Phase 4 DEC-25/DEC-32 and Phase 5 DEC-33/DEC-59 mechanism. A decision with no signed
paragraph under it when its plan starts is executed as written, and the phase completion note lists
it as rule-resolved.

**Numbering.** `DEC-` continues from DEC-59, the highest in use before this plan. Confirmed on
2026-09-25 by
`command grep -rhoE 'DEC-[0-9]+' .planning --exclude-dir=06-slices-6-7-async-edge-contracts-caching-observability --exclude=ROADMAP.md --exclude=FOUNDATION_AUDIT.md --exclude=findings.json --exclude=phase-06-slice-defects.md | sort -V | tail -1`,
whose result is `DEC-59`. (Without the last three exclusions the grep returns DEC-72, because this
plan's own Task 2 evidence already cites DEC-65, DEC-66 and DEC-72; the unfiltered grep returns DEC-81
because the eighteen Phase 6 plans cite the ids this file defines.) `DEC-` ids are decisions and `DI-`
ids are deferred items (Phase 3's prefix rule).

**Shape.** Each section has four parts: **Decision**, **Evidence**, **Alternative rejected**,
**Executed by**. A decision that changes wire bytes says `INTENTIONAL BEHAVIOUR CHANGE`, and the
executing commit carries the same words in its body.

---

## DEC-60 — zod is pinned exactly at 4.6.5 and installed in 06-03, resolved by rule on its bundle

**Decision.** Install `zod@4.6.5` with `--save-exact` in 06-03 (slice 6), because the webhook contract
and slice 6's route families need it and CONTEXT Area 5 puts slice-6 contracts in slice 6. Before the
install, 06-03 reads the live `npm view zod@4.6.5 dist.integrity` and compares it byte-for-byte with
the bundle's last line, `INTEGRITY zod@4.6.5 sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q==`;
if they differ, it refuses to install and stops. The owner's countersignature on the bundle is carried
to the completion note as an end-of-phase human-check (DI-81), not a blocking checkpoint (CONTEXT
amendments).

**Evidence.** `evidence/zod-legitimacy.txt`: published by "GitHub Actions <npm-oidc-no-reply@github.com>"
with an SLSA v1 provenance attestation; repository github.com/colinhacks/zod; package age 6.5 years;
274 M downloads in the week to 2026-09-24 (research recorded 216 M the week before); no install
scripts, no dependencies; the tarball's sha512 matches `dist.integrity`. The seam's `SUS` has the
single reason `too-new`: 4.6.5 is 12 days old against a 30-day rule, which is release cadence, not
identity.

**Alternative rejected.** zod 4.4.3 (2026-05-04), which clears the 30-day rule, at the cost of four
months of fixes to the library every contract depends on; and a blocking checkpoint, which CONTEXT's
amendments replace with the DEC-59 pattern for a package with signed provenance.

**Executed by:** 06-03 Task 2.

## DEC-61 — @sentry/nextjs is pinned exactly at 10.75.3, not 11.0.0, and installed with the CLI download skipped

**Decision.** Install `@sentry/nextjs@10.75.3` with `--save-exact` in 06-16, as
`SENTRYCLI_SKIP_DOWNLOAD=1 npm install --save-exact @sentry/nextjs@10.75.3`. CI sets
`SENTRYCLI_SKIP_DOWNLOAD: "1"` at workflow level so `npm ci` never runs the binary download either.
The same integrity refusal applies against
`INTEGRITY @sentry/nextjs@10.75.3 sha512-gqLutcMvwWUBmEotwcPprG9SoFmC1sjgVxYdoJcsJot/8ojgHtA2XAgImJ+5xcq+cSiO8SGg+ujYz+qDoLd7BA==`,
and the same countersignature rule (DI-81). v11 is DI-79.

**Evidence.** `evidence/sentry-legitimacy.txt`: publisher `sentry-bot`; repository
getsentry/sentry-javascript; no provenance attestation on 10.75.3; tarball sha512 matches; no install
script in @sentry/nextjs itself. The transitive `@sentry/cli@2.58.6` runs
`postinstall: node ./scripts/install.js`, which downloads a platform binary when the optional platform
package is absent (A7). `@sentry/react@10.75.3` peers React `18.x` (A9 holds). 06-RESEARCH.md C15:
v11's unset `dataCollection` collects user info, cookies and request bodies; v10 keeps
`sendDefaultPii` with its restrictive default, which is the posture DEC-76 decides.

**Alternative rejected.** `@sentry/nextjs@11.0.0` (latest, two days old, inverted PII defaults, config
entry moved); `10.71.0` (clears the 30-day rule, four weeks older, same API) — rejected because the
integrity comparison and the skipped download address the supply-chain risk the age rule stands for.

**Executed by:** 06-16 Task 1.

## DEC-62 — Plan map: slice 6 is 06-02..06-06, slice 7 is 06-07..06-18; the wrapper pass carries caching, logging and F-059

**Decision.** Slice 6 (the asynchronous edge, REFAC-14, plus contracts for its own families) is
06-02 (characterize), 06-03 (cron deletion, zod, webhook), 06-04 (the boundary helpers and slice-6
contracts), 06-05 (the definer-hardening migration), 06-06 (slice-6 close). Slice 7 is 06-07
(characterize), 06-08..06-10 (contracts by family), 06-11 (client reuse), 06-12 (logger, wrapper and
cache classes), 06-13 and 06-14 (route adoption), 06-15 (endpoint regeneration and the cache e2e),
06-16 (Sentry and CSP), 06-17 (health and admin page gates), 06-18 (close-out). The wrapper adoption
in 06-13 and 06-14 carries the cache class, the logger sweep and the F-059 generic bodies in one pass
per route family, instead of separate caching and logging sweeps over the same 90 route files.

**Evidence.** 06-RESEARCH.md § Suggested plan decomposition and § Alternatives ("one census covers
four requirements"); `evidence/floor.before.txt` C1 (160 console lines in 56 files), C7 (33 body
sites), C8 (4 files that set Cache-Control) all live in the same route files.

**Alternative rejected.** Three sweeps (cache, logger, error text), each touching every route file:
three times the diff review and three chances to change a byte by accident. Fewer, larger plans:
each route sweep already exceeds one plan's context budget, hence eighteen plans.

**Executed by:** every Phase 6 plan; the orchestrator's wave order.

## DEC-63 — The cron routes are deleted; the ESLint override goes with them; F-002 and F-037 close by deletion

**Decision.** Delete `src/app/api/cron/send-reminders/route.ts` and
`src/app/api/cron/send-feedback-requests/route.ts`. In the same commit remove the ESLint override block
that spreads `LEGACY_ELEVATED_CALLSITES` into `files` and its import (C14), keep
`eslint.elevated-allowlist.mjs` with an empty array, and make `scripts/check-elevated-ratchet.mjs`
report `committed=0 live=0`. F-002 and F-037 close by deletion; F-037's run-history clause is
observed on the local stack at the slice-6 close (06-06). F-040 closes by record: after the deletion no
reader of `ADMIN_API_KEY`, `ADMIN_EMAILS` or `CRON_SECRET` remains, proven by grep, the boot check and
`src/instrumentation.test.ts`. The endpoints.json rows for the deleted handlers are retained, as DEC-55
retained `api.auth-debug`, and flagged in 06-15's regeneration.

**Evidence.** 06-RESEARCH.md § Inventory A (no caller: `vercel.json` has no `crons` key; pg_cron runs
the SQL functions directly); C14 (ESLint 9 throws on `files: []`); `evidence/floor.before.txt` block 5
(committed=2 live=2, the two cron routes).

**Alternative rejected.** Credentialing the routes with a `CRON_SECRET` compare (CONTEXT's fallback):
it keeps two code paths that diverge from the live SQL functions (F-037) for a caller that does not
exist.

**Executed by:** 06-03 Task 1; 06-06 (F-037 clause); 06-15 (endpoints.json flag).

## DEC-64 — The webhook keeps HMAC; wrong-length signatures answer 401; replays are refused by content_hash

**Decision.** (C1, C2.) The HMAC over the raw body stays, with its three accepted headers
(`x-signature`, `x-hub-signature-256`, `x-webhook-signature`). `verifySignature` returns false on a
length mismatch, so a wrong-length signature answers 401 instead of 500 (INTENTIONAL BEHAVIOUR CHANGE,
F-039). The request logic moves to `supabase/functions/_shared/webhook-handler.ts` with the insert
injected, so Jest proves it. `content_hash` is populated from a parity-tested copy of
`src/lib/contentHash.ts` at `_shared/contentHash.ts`, and a 23505 from the unique index is reported per
event as `duplicate`. The payload schema lives in `_shared/webhook-contract.ts` with today's messages
and is re-exported by `src/contracts/webhook.ts`; `ExtractedEvent` drift is guarded by a type-level
assertion. No plain shared-secret header is added. The signed-timestamp window is DI-78; the CI
deploy is DI-81. F-039 stays Open at "08" for its deployment-record clause.

**Evidence.** 06-RESEARCH.md C1 (`classifier-pipeline.ts` deleted in `5879268`; no sender in the
tree), C2 (`timingSafeEqual` throws on unequal lengths; `idx_events_content_hash` is unique and never
populated), Pattern 6.

**Alternative rejected.** An `x-webhook-secret` header compared constant-time (CONTEXT's original
bullet): the secret would travel on every request and never expire, and it would break the deployed
function's existing senders.

**Executed by:** 06-03 Tasks 2 and 3.

## DEC-65 — The contract boundary: parseBody, parseQuery, parseForm; today's texts; field only where named

**Decision.** (C10, C11, C12.) `parseWith`, `parseBody` and `parseQuery` (06-04) and `parseForm` (06-08)
live in `src/server/body.ts`. The first issue in schema key order decides the 400; each rule carries
today's text through zod 4's `error` parameter; `field` is emitted only where the call site names it
via `fieldFor` (the four sites of C10). Business-rule 400s stay in the handlers through `badRequest()`.
Parsing runs after the guards, where `readJsonObject` sits today. At the 21 raw sites an invalid body
answers 400 `Invalid JSON body` and a non-object body 400 `Request body must be a JSON object`; a
non-string field answers 400 instead of 500. Each moved byte is a DEFECT move citing F-094 with a
ledger row (INTENTIONAL BEHAVIOUR CHANGE). `scripts/check-contracts.mjs` fails on raw JSON reads and
multipart reads outside `src/server/body.ts` and on query reads in route files, exempting
`src/app/auth/callback/route.ts`'s four OAuth params by name; its allow-list only shrinks and is empty
after 06-10.

**Evidence.** 06-RESEARCH.md § Inventory C; `evidence/floor.before.txt` C2 (21 sites, 20 files), C3 (5),
C4 (59 reads, 19 files), C5 (15); F-094 (`.planning/audit/quality/phase-06-slice-defects.md`).

**Alternative rejected.** Emitting `{ error, field }` on every 400 (CONTEXT's first wording): it
changes bytes at about 130 sites and breaks the PRESERVE suites that pin `toEqual({ error })`.

**Executed by:** 06-04 Task 1 (helpers, gate); 06-04 Task 2, 06-08, 06-09, 06-10 (adoption).

## DEC-66 — F-094 absorbs DI-64 and DI-66: canonical UUIDs and one club-link rule

**Decision.** Route UUID params are parsed by one `Uuid` schema that lower-cases, so the admin
self-checks compare canonical ids (06-10, INTENTIONAL BEHAVIOUR CHANGE). Club link fields use one
`ClubLinkFields` rule on POST and PATCH: an absolute http(s) URL is kept, a scheme-less host path gets
`https://` prefixed, and any other scheme answers 400 `Invalid URL for ${field}` (06-09, INTENTIONAL
BEHAVIOUR CHANGE).

**Evidence.** 05-REVIEW-FIX.md IN-02, IN-03, IN-09 (DI-64) and IN-04 (DI-66); F-094 shape 3
(`src/app/api/clubs/route.ts:77-86` against `src/app/api/clubs/[id]/route.ts:132-136`).

**Alternative rejected.** Making POST as strict as PATCH: it would refuse values the create form
accepts today and leave already-stored scheme-less links unsavable. Making PATCH as loose as POST:
it re-opens the relative-link hazard REVIEW-05 WR-09 closed.

**Executed by:** 06-09 Task 1 (club links); 06-10 Task 1 (UUIDs).

## DEC-67 — Client reuse: typed mutation bodies, development-only checks in the 8 hooks

**Decision.** (REFAC-16, research Open Question 5.) Every client-built mutation body is typed
`z.input<>` of its contract. The 8 hooks run a development-only `safeParse` that warns with the first
issue and never throws. `node scripts/check-contracts.mjs --client` asserts that every non-route file
sending a mutation to `/api/` imports from `@/contracts/`. The production client bundle is checked for
zod (A4), with the dynamic-import fallback if it is present.

**Evidence.** 06-RESEARCH.md § Inventory D (182 URL literals in 73 non-route files), Pattern 2b, A4.

**Alternative rejected.** A development parse at all 182 call sites: noise without a type benefit
the contracts do not already give.

**Executed by:** 06-11.

## DEC-68 — Recommendations are characterized, not changed; F-017 is fixed through the door

**Decision.** The weights 0.35/0.25/0.20/0.15/0.05 live in `compute_user_scores()` and are pinned by
`md5(prosrc)` and a score-equals-breakdown invariant in pgTAP 070; the MMR lambda rules are pinned in
Jest. F-041 stays today's behaviour (re-pointed to "08" by 06-01). F-017 is fixed by reading
experiments and variants and writing the caller's own assignment through `getElevatedClient()` keyed
by `ctx.user.id`, with a REGISTRY row (INTENTIONAL BEHAVIOUR CHANGE). DI-44's dead fallback is removed,
because the feedback contract has no user id.

**Evidence.** 06-RESEARCH.md § Inventory H, C6 (md5 `ed64959b44c9329a1212cde928810010` for compute);
DI-44 (Phase 5 register).

**Alternative rejected.** Qualifying every relation in `compute_user_scores`' 150-line body: it risks
the formula REFAC-14 says must not change, for a search_path pin `ALTER FUNCTION` gives without a body
change.

**Executed by:** 06-02 (pins); 06-04 Task 3 (F-017, DI-44 code half); 06-05 (pgTAP 070).

## DEC-69 — F-028's remainder and F-092

**Decision.** `notifications/count` answers anonymous callers 401 `{"error":"Unauthorized"}` through
`requireUser` (INTENTIONAL BEHAVIOUR CHANGE). The side navigation requests the count only for a
signed-in user, so anonymous pages add no 401 polling (no visual change). `events/[id]/rsvp` GET and
`clubs/[id]/events` stay 200 for anonymous with `private, no-store` (06-14). F-028 stays Open at "08"
for the owner to risk-accept those two routes, because its criterion requires 401. F-092 is fixed by
dropping the embed and mapping a second `users` read (id, name, avatar_url) to
`reporter: { id, display_name, avatar_url }`.

**Evidence.** CONTEXT Area 1 "F-028 remainder"; F-092's reproduction
(`.planning/audit/quality/phase-05-close-defects.md`); PROJECT.md key decision "Split F-028".

**Alternative rejected.** 401 on the two anonymous reads: it changes a public event page and a club
page for signed-out visitors, which is a Validated surface.

**Executed by:** 06-04 Tasks 2 and 3; 06-14 (cache class).

## DEC-70 — The definer-hardening migration 20260926120000_async_edge_definer_hardening.sql

**Decision.** (C3-C6, C21, C24, C25.) One fix-forward migration,
`supabase/migrations/20260926120000_async_edge_definer_hardening.sql`:
- the two production pg_cron jobs, byte-identical to `.planning/audit/async/cron-job.json`, with an
  idempotent unschedule-if-exists; no `config.toml` change;
- EXECUTE revoked from PUBLIC, anon and authenticated on `compute_user_scores`, `send_event_reminders`
  and `send_feedback_requests`; service_role kept;
- `ALTER FUNCTION … SET search_path = public, pg_temp` on compute and feedback with no body change
  (md5 pins `ed64959b44c9329a1212cde928810010` and `c69a62ad437efb7e875517f6b94c3b4b`);
- `send_event_reminders` rewritten with the two F-093 filters and the same search_path (INTENTIONAL
  BEHAVIOUR CHANGE; its md5 pin becomes a behaviour pin);
- the friends functions keep their signatures, gain `SET search_path = ''`, schema-qualified relations
  and the predicate caller-is-subject-or-service_role, with EXECUTE revoked from PUBLIC and anon (C5);
- `public.cron_job_status()` SECURITY DEFINER, EXECUTE for service_role only after an explicit revoke
  from PUBLIC, anon and authenticated (C4);
- `src/lib/supabase/types.ts` regenerated with `--local` in the migration commit.

**Evidence.** 06-RESEARCH.md C3-C6, C21, C24, C25 and § Inventory B; F-093's reproduction
(`.planning/audit/quality/phase-06-slice-defects.md`); `baseline.sql:2716-2719` (default privileges
grant every new function to anon and authenticated).

**Alternative rejected.** Re-pointing F-093 (research's alternative): it is the same function in the
same migration and REFAC-14 is the async-edge requirement. `search_path = ''` with a qualified body for
compute: see DEC-68.

**Executed by:** 06-05.

## DEC-71 — The local reminder jobs run; tests never depend on them

**Decision.** (Pitfall 5.) The declared jobs run locally every 15 and 30 minutes. pgTAP calls the
functions only inside `BEGIN … ROLLBACK`; specs that count notifications scope by event id; no seed
change.

**Evidence.** 06-RESEARCH.md Pitfall 5; the seed pins "now" at 2026-06-01, so no seeded event is in a
reminder window (`evidence/floor.before.txt` block 12).

**Alternative rejected.** Declaring the jobs inactive locally: the local stack would then disagree
with the repository truth F-042 asks for.

**Executed by:** 06-05; every later spec that counts notifications.

## DEC-72 — The findings rule for Phase 6 (extends DEC-57)

**Decision.** A code-only closure is Fixed only on its met criterion. Production-schema fixes proven
locally (F-074, F-075, F-076, F-093) stay Open at "08" with local-proof resolutions (DI-23). F-042 is
Fixed (its criterion is repository truth after a fresh reset). F-025 stays Open at "08" (its criterion
is the real CDN two-session probe, DI-81). F-039 goes to "08" (deployment record). F-055 goes to "08"
('unsafe-inline' remains, DI-80). F-028 goes to "08" (owner, DEC-69).

**Evidence.** DEC-57 (Phase 5), DI-23 (Phase 8); each finding's validation criterion in
`.planning/audit/findings.json`.

**Alternative rejected.** Marking a migration-dependent finding Fixed on local proof: production would
still carry the defect, and the register would say otherwise.

**Executed by:** 06-06 and 06-18 (register edits at each slice close).

## DEC-73 — The route wrapper and the cache classes

**Decision.** (C7, C8, C9, Patterns 1 and 3.) `withRoute({ cache, action? }, handler)` in
`src/server/route.ts` returns the handler's own parameter list. `CACHE_CLASSES` lives in
`src/server/http.ts` (CONTEXT names http.ts): `private` sets `private, no-store` on every status;
`public-60-300`, `public-30-60` and `public-60-120` set `public, s-maxage=…, stale-while-revalidate=…`
only on GET or HEAD with status 200 or 404, and `private, no-store` otherwise. The public set is
research § E exactly: 8 routes at `public-60-300`, `/api/events` at `public-30-60`, the two featured
routes at `public-60-120`. `events/[id]`, `clubs/[id]/events`, `events/[id]/rsvp` and `health` are
private. No response carries a cookie-varying `Vary` header. Route files stop setting Cache-Control
themselves; `vercel.json` loses `headers`. An uncaught throw answers `{ "error": "Failed to <action>" }`
500 (F-058, INTENTIONAL BEHAVIOUR CHANGE).

**Evidence.** 06-RESEARCH.md C7-C9, § Inventory E; `evidence/floor.before.txt` C8 (four route files
set the header today, and vercel.json's blanket `/api/(.*)` rule).

**Alternative rejected.** One `public, s-maxage=60, stale-while-revalidate=300` for every public route
(CONTEXT's first wording): it changes the bytes of the three routes that set their own values today.
`Vary: Cookie`: Vercel then refuses to cache at all.

**Executed by:** 06-12 Task 1 (helpers); 06-13, 06-14 (adoption); 06-15 (e2e).

## DEC-74 — The request id and the logger

**Decision.** (C19, C26, Pattern 4.) The proxy overwrites `x-request-id` on the request headers first
thing in `proxy()` and sets it on every response it builds itself. The wrapper accepts only a
UUID-shaped id and otherwise mints one; `runWithRequest` stores it in AsyncLocalStorage and
`createRequestContext()` reads it. A line is one JSON object `{ ts, level, msg, requestId, route,
scope, …fields }`; error and warn go through `console.error`, info and debug through `console.log`.
Keys named cookie, authorization, password, token, access_token, refresh_token, email or body are
replaced by `[redacted]`, and email-shaped substrings by `[email]`. Bracket prefixes become `scope`.
Exact-argument console assertions in PRESERVE suites move to DEFECT files citing F-058; in plain tests
they are edited in place. DI-45 adds a warn line when the user lookup errors with anything but a
missing session. `src/lib/tagMapping.ts` keeps console as a module shared with the client
(allow-listed with the reason); client components keep console.

**Evidence.** 06-RESEARCH.md C19, C26 (42 test files spy on console), Pattern 4, A1;
`evidence/floor.before.txt` C1 (160 lines in 56 files).

**Alternative rejected.** Writing the JSON through `process.stdout`: it breaks every
`not.toHaveBeenCalled()` console assertion. Trusting a client-supplied id: a log-forging vector.

**Executed by:** 06-12 (foundation, proxy, non-route modules); 06-13, 06-14 (routes).

## DEC-75 — F-059: one error vocabulary

**Decision.** Every response body built from a caught error's text becomes the route's generic body
(`serverError(action)` or its existing generic text), and the error goes to `log.error`. DI-73 is
retired into F-059. Health's sites close in 06-17. `scripts/check-server-console.mjs` enforces.

**Evidence.** `evidence/floor.before.txt` C7: 33 response-body sites in 19 files plus the callback's
redirect query (`auth/callback:129`), 9 of them in `health/route.ts`; 05-REVIEW-FIX IN-18 (DI-73).

**Alternative rejected.** Keeping the text behind a development flag: production is where the text
leaks table and constraint names.

**Executed by:** 06-13, 06-14 (routes); 06-17 (health).

## DEC-76 — The Sentry posture

**Decision.** (CONTEXT Area 4, C15, Pattern 5.) `sendDefaultPii: false`. `beforeSend` removes the
request's cookies, data and query string and the cookie and authorization headers; redacts emails in
messages, exception values and breadcrumbs; and keeps only a SHA-256 of the user id. `environment`
comes from `VERCEL_ENV` (default "development"), `release` from `VERCEL_GIT_COMMIT_SHA`. Every
captured server event carries the tag `request_id`. `tracesSampleRate: 0`. A DSN that is absent or
unparseable disables Sentry with one log line and never fails boot. No tunnel route. `withSentryConfig`
with source maps disabled when `SENTRY_AUTH_TOKEN` is absent. No edge config (the proxy runs on Node).
The client init reads `NEXT_PUBLIC_SENTRY_DSN`. The CSP `connect-src` admits the DSN's origin only when
it is set. The first live event is a human-check (DI-81).

**Evidence.** 06-RESEARCH.md Pattern 5, Pitfalls 7 and 8, A2, A3; `evidence/sentry-legitimacy.txt`.

**Alternative rejected.** Tracing on (a sample rate above 0): work on the request path and a data
category CONTEXT did not decide.

**Executed by:** 06-16 Task 2.

## DEC-77 — The CSP

**Decision.** (F-055, DI-21, C13.) `'unsafe-eval'` only when `NODE_ENV` is "development".
`'unsafe-inline'` is kept (the inline theme script and Next's inline bootstrap). The origin of
`NEXT_PUBLIC_SUPABASE_URL` (and its ws twin for `connect-src`) is added to `connect-src` and `img-src`
when `next.config.js` is evaluated. The harness sets `bypassCSP: false`. The nonce policy is DI-80.

**Evidence.** 06-RESEARCH.md C13 (the harness runs a production build with `bypassCSP: true` because
the local origin is missing), § Alternatives (nonce CSP needs dynamic rendering of every page).

**Alternative rejected.** A development-only local origin (CONTEXT's DI-21 wording): the harness runs
a production build, so it could never test the CSP.

**Executed by:** 06-16 Task 3.

## DEC-78 — Health

**Decision.** (C4, C8, C18, C23, Inventory G.) Anonymous and non-admin callers get 200
`{ status: "ok", version }`. An admin (`requireActiveUser`, then the admin role) or a bearer equal to
`HEALTH_TOKEN` (SHA-256 digests compared with `timingSafeEqual`) gets
`{ status, version, ts, checks: { db, auth, storage, pg_cron, webhook } }`. A `HEALTH_TOKEN` shorter
than 32 characters disables token access with one warn line and never throws. `pg_cron` comes from
`cron_job_status()` through the door, stale at twice the schedule (compute 12 h, reminders 30 min,
feedback 60 min), `unknown` on PGRST202 or a job that never ran. `webhook.last_ingest_at` is the
newest `created_at` of an `instagram`-sourced event, read through the door. Overall `down` when db is
down, `degraded` when any other check is down or stale; 200 for ok and 503 otherwise. No error text or
dependency detail beyond the documented shape; always `private, no-store`. The OAuth-provider,
environment and memory checks are removed. `/health` is admin-gated in place (INTENTIONAL BEHAVIOUR
CHANGE).

**Evidence.** 06-RESEARCH.md C4, C8, C18, C23, § Inventory G; `evidence/floor.before.txt` C6 (the one
`getSession()` call, `health/route.ts:160`) and C7 (9 error-text sites in health).

**Alternative rejected.** Public-cacheable liveness (CONTEXT Area 3): a CDN-cached "ok" masks an
origin outage for up to six minutes. Moving the page under `/admin`: it changes the URL.

**Executed by:** 06-17 Task 1.

## DEC-79 — The admin page gate

**Decision.** (F-054, DI-55.) `requireAdminPage(redirectTo)` refuses anonymous, banned and non-admin
callers with `redirect(redirectTo)`. The admin and moderation layouts keep their targets; new `/docs`
and `/health` layouts redirect to "/". The moderation reviews route's admin path runs
`requireActiveUser` before the role (INTENTIONAL BEHAVIOUR CHANGE). Both new pages become dynamic
(Pitfall 11).

**Evidence.** DI-55 (Phase 5 register); F-054; 06-RESEARCH.md C18, Pitfall 11.

**Alternative rejected.** Giving `requireRole` a ban responsibility (DEC-58 rejected it in Phase 5).

**Executed by:** 06-17 Task 2.

## DEC-80 — Close-out code

**Decision.** F-085 is fixed through `getESTNowISO()` in `users/saved-events` (INTENTIONAL BEHAVIOUR
CHANGE). F-084 is re-pointed to "07" (done by 06-01). DI-53's four sites are retyped through the admin
contracts in 06-10. `@supabase/supabase-js` is bumped to exactly `2.116.0` as the last code change,
after a throwaway-worktree `tsc` proof; not 2.117.x (Pitfall 12). `@supabase/ssr` stays on 0.7
(DI-43, Phase 8).

**Evidence.** 06-RESEARCH.md C22, Pitfall 12 (2.117.2 published on the research date); DI-53
(`evidence/di-25-bump.txt` in Phase 5).

**Alternative rejected.** Taking the bump earlier: every later plan would type-check against a moving
client.

**Executed by:** 06-10 (retypes); 06-18 Task 1.

## DEC-81 — Owner-facing items: no blocking checkpoint; human-checks carried as DI-81

**Decision.** No plan in the phase has a blocking checkpoint. The human-checks are carried to the
completion note as DI-81: the DEC-60 and DEC-61 countersignatures; the first real Sentry event
carrying the correlation id; the two-session CDN probe on a preview deploy; the edge function
redeployed from CI with `WEBHOOK_SECRET` confirmed; `HEALTH_TOKEN` provisioning; and the
`.env.local.example` update this session cannot read. CLAUDE.md fact corrections are prepared as a
patch in 06-18 and applied only if the owner signs an authorization under DI-46.

**Evidence.** CONTEXT "Mode" line and amendments; DI-46 (executors do not edit CLAUDE.md); the session
denies reading `.env.local.example`.

**Alternative rejected.** Stopping the autonomous run at each owner-facing step: every one of them is
either a deploy action (outside this phase) or a signature on facts already recorded.

**Executed by:** 06-18 Task 3 (completion note).

---

*Phase: 06-slices-6-7-async-edge-contracts-caching-observability*
*Plan: 06-01*
