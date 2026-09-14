# AUDIT-11 — Cron and webhook inventory

**Requirement:** AUDIT-11 &nbsp;·&nbsp; **Plan:** 01-10 &nbsp;·&nbsp; **Phase:** 01-read-only-foundation-audit
**Evidence:** [`cron-job.json`](./cron-job.json) (3 rows), [`cron-job-run-details.json`](./cron-job-run-details.json) (100 rows), [`extensions.json`](./extensions.json) (77 rows), [`vercel-crons.md`](./vercel-crons.md), and the Vercel envelopes under [`../raw/vercel/`](../raw/vercel/). Database rows were captured 2026-09-14T18:31–18:32Z through the SELECT-only Management API transport; the deployment-platform state was captured 2026-09-14T19:13Z through the read-only Vercel REST API.
**Read-only:** **no production HTTP endpoint was contacted.** Neither cron handler was probed, because probing an authorization gate to see whether it is open is itself an unauthenticated write attempt against production. Every statement below about a handler's credential behaviour is read from source and cross-referenced to `../authz/fail-open-register.md`.

---

## 0. How to read this inventory

Six sources were named in the requirement. Each gets its own section below and each ends with an explicit **Verdict** line. Nothing is left as "probably" — where an answer genuinely cannot be reached from a read-only position, the section says so and names the single command that would close it, so a later pass fills a stated gap instead of re-deriving the work.

One result reframes the whole document, so it is stated at the top rather than buried:

> **The premise the plan was written on is wrong, and the truth is more interesting.**
>
> `01-10-PLAN.md` expected to find that nothing triggers the reminder handlers, making a Validated workflow silently broken. Nothing does trigger them — that part holds, and § 2 proves it three independent ways. But the workflow is **not** broken, because the work those handlers were written to do is **also implemented as two PL/pgSQL functions that `pg_cron` has been running successfully every 15 and 30 minutes** (§ 1). The reminder pipeline is live.
>
> What the audit actually found is worse than a dead feature and different in kind: **two divergent implementations of the same behaviour, one live and one dead**, where the dead one is an anonymously reachable service-role write surface whose credential check is open in production (§ 2.4), and where the live one silently disagrees with the dead one on four points that would produce duplicate user-visible notifications the moment anyone "fixes" the trigger (§ 2.5). And neither of them sends an email, despite the Validated requirement being *"In-app notifications and email reminders"* (§ 2.6).

---

## 1. Source one — database scheduled jobs (`pg_cron`)

`pg_cron` **1.6.4 is installed**, in schema `pg_catalog` (`extensions.json`). Three jobs exist, all `active`, all owned by `postgres`, all running against the `postgres` database on `localhost:5432` — that is, inside the database, with no network hop.

| jobid | jobname | schedule | command | active | runs in the captured window | outcome |
|---|---|---|---|---|---|---|
| 1 | `send-event-reminders` | `*/15 * * * *` | `select public.send_event_reminders()` | yes | 65 | **65 succeeded, 0 failed** |
| 2 | `compute-user-scores` | `0 */6 * * *` | `SELECT compute_user_scores()` | yes | 3 | **3 succeeded, 0 failed** |
| 4 | `send-feedback-requests` | `*/30 * * * *` | `SELECT public.send_feedback_requests()` | yes | 32 | **32 succeeded, 0 failed** |

The run capture is the most recent 100 rows, spanning 2026-09-14 02:30Z to 18:30Z — a 16-hour window. The three run counts are exactly what those three schedules produce over 16 hours (64–65, 3, 32), so the window is complete rather than sampled, and no run is missing. Every row carries `status = "succeeded"` and the `return_message` `1 row`. **There is not a single failure in the capture.**

Three observations that only the run history can give, which is why the plan insisted on capturing it rather than the schedule alone:

- **`jobid` 3 is absent.** The ids run 1, 2, 4. A fourth job was created and dropped at some point. Nothing records what it was — consistent with the rest of § 1.4.
- **None of the three commands issues an HTTP request.** All three are bare, zero-argument function calls. This is not merely observed, it is *structural*: **`pg_net` is present in the extension catalog but is not installed**, so this database cannot make an outbound HTTP call at all. No `pg_cron` job can be what triggers a Next.js route handler, now or by accident.
- **The work is done in-database, not by the application.** `send_event_reminders()` and `send_feedback_requests()` are `SECURITY DEFINER` PL/pgSQL functions that loop over `saved_events`/`rsvps` joined to `events`, deduplicate, and insert rows into `notifications` (and, for feedback, into `feedback_request_log`). They are complete reimplementations of the two `/api/cron/*` handlers. This is the fact § 2 turns on.

### 1.1 The scoring job — answered from the live capture, not from the migration comment

`01-RESEARCH.md` flags this as the question to get right, and the answer is the opposite of what the repository suggests.

**The job exists in production.** `cron-job.json` jobid 2, `compute-user-scores`, schedule `0 */6 * * *`, command `SELECT compute_user_scores()`, `active: true`, with three successful runs in the captured window — the most recent at 2026-09-14 18:00:00Z. That is read from the live `cron.job` capture. It is **not** inferred from `supabase/migrations/20260313000002_recommendation_engine.sql`, where the only trace of it is line 253:

```sql
-- Run this manually in SQL editor after enabling pg_cron:
-- SELECT cron.schedule('compute-user-scores', '0 */6 * * *', 'SELECT compute_user_scores()');
```

**A commented-out statement is not a migration.** Consequence, stated plainly because it is a Stage 4 correctness issue rather than a tidiness one: a freshly reset local or staging database has `pg_cron` possibly not even enabled, certainly no such job, an empty `user_event_scores` table, and therefore a recommendation feed that silently falls through to the popularity path documented in `CLAUDE.md`. **Certifying the recommendation flow against a rebuilt database would certify a code path that is not production's.** Cross-referenced to `../schema/drift.md` § `cron.job`, row `compute-user-scores`, class `prod-only`.

### 1.2 An open question the capture raises and cannot close

`compute_user_scores()` has run successfully three times in 16 hours, and `../raw/prod/row-counts.json` reports **`user_event_scores` at 0 rows**.

Those two facts are hard to reconcile. `user_event_scores` is the table the scoring engine writes and the recommendation query reads. If it is genuinely empty, then production is *also* falling back to the popularity path, and the five-signal engine described in `CLAUDE.md` is not what any user is being served — which would make § 1.1's staging concern a production concern too.

**This is recorded as an open question, not as a finding**, because the number is not strong enough to carry a finding on its own: `row-counts.json` reports `n_live_tup` from `pg_stat_user_tables`, which is an estimate maintained by autovacuum and can read 0 for a table that is truncated and refilled on a cycle — which is precisely what a batch scoring job does. One read-only query settles it and is named in § 8. Flagging an estimate as a defect would be the kind of finding that gets contested and deprioritised, which is the failure mode `FEATURES.md` warns about.

### 1.3 Behaviour of the two live reminder functions, as it differs from the handlers

Described rather than quoted — no function body is copied into any artifact, per `../redaction/01-10.md` § 7.

`send_feedback_requests()` filters on `status = 'approved'` and `deleted_at is null`, deduplicates against `feedback_request_log`, inserts the notification `on conflict do nothing`, and logs the send. It is careful.

`send_event_reminders()` is not. It joins `saved_events` to `events` on a start-date window **with no `deleted_at is null` filter and no `status` filter at all**. The handler it duplicates has `.is("deleted_at", null)`. So the live implementation sends "Event Tomorrow" reminders for **soft-deleted events and for events still pending moderation**. With `notifications` at 19 rows and `events` at 229, the current blast radius is small; the defect is not.

### 1.4 Drift

All three jobs exist in production and in **no migration file** — `../schema/drift.md` § `cron.job` classes all three `prod-only`, and the grep behind that is `command grep -rn "cron.schedule" supabase/migrations/`, which returns one commented line. Three live scheduled jobs mutating production data on a 15-minute cycle, none of them schema-as-code, plus one (`jobid` 3) that was created and removed without trace.

**Verdict — source one: three scheduled jobs exist, all active, all succeeding, none of them schema-as-code, and none of them capable of triggering an HTTP handler.** They are the only thing in this project that actually runs on a schedule, and they are invisible to anyone reading the repository.

---

## 2. Source two — the two `/api/cron/*` route handlers

Two handlers, `src/app/api/cron/send-reminders/route.ts` and `src/app/api/cron/send-feedback-requests/route.ts`. Both export **`POST` and nothing else** — verified by `grep -oE "export async function [A-Z]+"` on each file — so no `GET` exists and no browser visit, uptime pinger, or link preview can reach either.

### 2.1 `/api/cron/send-reminders`

| | |
|---|---|
| Exported method | `POST` only |
| Credential required | `Authorization: Bearer ${process.env.CRON_SECRET}` |
| Behaviour when `CRON_SECRET` is unset | **the comparison becomes `authHeader !== "Bearer undefined"`** — a caller sending exactly that string is admitted. There is no presence guard. |
| Client constructed after the gate | `createServiceClient()` — service role, bypasses RLS |
| Register cross-reference | `../authz/fail-open-register.md` **FO-02**, proposed severity **High**, threat T-01-07-02 |
| Anything that invokes it | **nothing** — see § 2.4 |

### 2.2 `/api/cron/send-feedback-requests`

| | |
|---|---|
| Exported method | `POST` only |
| Credential required | `Authorization: Bearer ${process.env.CRON_SECRET}`, preceded by a separate presence guard |
| Behaviour when `CRON_SECRET` is unset | **fails closed** — HTTP 500 `"Server misconfiguration"` is returned before the comparison is reached |
| Client constructed after the gate | `createServiceClient()` — service role, bypasses RLS |
| Register cross-reference | `../authz/fail-open-register.md` **FO-04**, registered deliberately as the **positive control**, no severity |
| Anything that invokes it | **nothing** — see § 2.4 |

### 2.3 The env-name capture turns both register rows from hypothetical into observed

`../raw/vercel/env-names.json` lists **exactly three** environment variables on the production project: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **`CRON_SECRET` is not among them.**

`fail-open-register.md` had to hedge on this — *"Whether the variable is actually set in production is not knowable from this artifact"*. It is knowable now, and the answer resolves in the unfavourable direction for both rows:

- **FO-02 is live.** `/api/cron/send-reminders` in production compares the incoming header against the literal string `Bearer undefined`. Any anonymous caller sending `Authorization: Bearer undefined` passes the gate and reaches a service-role client. This is no longer a conditional defect awaiting a configuration check; it is the current state of a deployed endpoint. The register's severity of High stands, and its evidence is now empirical rather than conditional.
- **FO-04's fail-closed behaviour is also live, with a consequence the register did not need to draw.** `/api/cron/send-feedback-requests` returns HTTP 500 to **every** caller in production, unconditionally, because its presence guard trips on every request. The handler is not merely untriggered — **it cannot execute at all.** Failing closed is the correct behaviour and remains the right pattern; the point here is that it makes the route provably dead code rather than dormant code.

### 2.4 What invokes them: nothing, established three independent ways

| # | Line of evidence | Result |
|---|---|---|
| 1 | **Deployment platform.** `vercel.json` has no `crons` key, and the Vercel project's `crons.definitions` is `[]`, recomputed at the current production deployment (`vercel-crons.md`). | no trigger |
| 2 | **Database.** All three `pg_cron` commands are bare SQL function calls, and `pg_net` is not installed, so the database cannot issue an HTTP request at all (§ 1). | no trigger, structurally |
| 3 | **Repository.** `git grep -n "api/cron" -- ':(exclude).planning' ':(exclude)docs'` returns **no matches**; `.github/workflows/ci.yml` is the only workflow, triggers on `push` and `pull_request` only — **no `schedule:` key** — and contains no `curl` and no `wget`. | no trigger |

And an external scheduler outside all three is bounded to near-zero by three further facts, of which the last is direct database-side proof: an external caller would need a `CRON_SECRET` value that was never configured; the feedback handler has been returning 500 to any such caller for its whole life; and **`email_reminder_log` has 0 rows in production** (`../raw/prod/row-counts.json`), while `/api/cron/send-reminders` writes a row to that table on every reminder it sends. A zero row count is empirical evidence that **this handler has never completed a send in production, from any caller, ever.**

### 2.5 The divergence — why "just add the Vercel cron" would be a user-visible defect

Because the pg_cron functions and the route handlers implement the same behaviour twice, the obvious remediation ("nothing triggers these, so schedule them") would put both implementations in flight at once. They disagree on four points, and three of the four produce duplicate notifications to real users:

| # | Live `pg_cron` function | Dead route handler | Effect if both ran |
|---|---|---|---|
| 1 | writes notification `type` `reminder_24h` / `reminder_1h` | writes `event_reminder_24h` / `event_reminder_1h` | The two dedup on different type strings, so **neither can see the other's sends.** |
| 2 | deduplicates against `notifications` | deduplicates against `email_reminder_log` | `email_reminder_log` is **empty**, so the handler's first run would treat every in-window saved event as unsent and **re-notify every user pg_cron already notified.** |
| 3 | `send_event_reminders()` applies no `deleted_at` and no `status` filter | filters `deleted_at is null` | The live path already notifies about deleted and unapproved events (§ 1.3); the two paths would also disagree about which events exist. |
| 4 | inserts `notifications` rows only | inserts `notifications` rows only | Neither sends an email — see § 2.6. |

**This is the whole value of doing source one and source two in the same document.** Either section alone produces a plausible and wrong recommendation: source two alone says "schedule these handlers", source one alone says "the reminders work, move on".

### 2.6 Neither implementation sends an email

PROJECT.md § Validated, line 29, reads *"✓ In-app notifications and email reminders — existing"*. The table is named `email_reminder_log`. The handler is named `send-reminders`. Every one of those names promises email.

**No email is sent by anything in this project.** `git grep -lE "resend|sendgrid|nodemailer|postmark|mailgun"` over `src/`, `package.json` and `supabase/` returns exactly one file — `supabase/config.toml`, whose SMTP block configures the **local** Inbucket test server. There is no email provider dependency, no transactional-mail client, and no SMTP call anywhere in the application. Both implementations of the reminder logic insert rows into `notifications` and stop.

So the Validated requirement is half-met in a way no one reading the code would notice, because the naming asserts the missing half. **This, rather than "nothing triggers the handlers", is the AUDIT-11 finding against a Validated workflow.**

**Verdict — source two: both handlers exist, both are reachable anonymously over HTTP, and nothing whatsoever invokes either one.** `/api/cron/send-reminders` is a dead route with a credential check that is open in production (`Bearer undefined`) in front of a service-role client; `/api/cron/send-feedback-requests` is a dead route that fails closed and returns 500 to every caller. Both are **redundant** — the behaviour they implement is already running as `pg_cron` jobs — and the two implementations diverge. The correct remediation is to delete the handlers or fail them closed, **not** to schedule them.

---

## 3. Source three — the deployment platform's cron configuration

Transcribed from [`vercel-crons.md`](./vercel-crons.md), which carries the full provenance and the transport deviation behind it.

- **The repository's deployment configuration declares no cron.** `vercel.json` has five top-level keys — `$schema`, `buildCommand`, `framework`, `regions`, `headers` — and **no `crons` key**. This was verified in plan 01-01 and re-verified here by parsing the file rather than grepping it.
- **The Vercel project has zero cron definitions.** `../raw/vercel/project.json` → `data.crons.definitions` is `[]`, with `enabledAt` set (the feature is available and has never been disabled, so this is not a plan limitation) and `disabledAt` `null`.
- **The empty list is current and causal, not stale.** `crons.updatedAt` equals the creation time of the current production deployment and `crons.deploymentId` names that same deployment. Vercel derives cron definitions from `vercel.json` at deploy time; the empty list is what it computed from the deployed configuration on 2026-03-27, from a `vercel.json` with no `crons` key.
- **Provenance deviation, recorded:** the plan's checkpoint asked a human to read the dashboard. The answer came instead from the Vercel REST API (`GET /v9/projects/{id}`), read-only, captured 2026-09-14T19:13Z and committed as an envelope. The API field and the settings page render the same state; the capture additionally carries the timestamps above, which the page does not surface.

**Verdict — source three: zero cron jobs are configured on the deployment platform, the repository declares none, and the empty definitions list was recomputed at the current production deployment — so the negative is current, causal, and machine-verifiable rather than a human's reading of a screen.**

---

## 4. Source four — the Supabase edge function `events-webhook`

One edge function exists: `supabase/functions/events-webhook/index.ts`, declared in `supabase/config.toml` at `[functions.events-webhook]`.

| | |
|---|---|
| Trigger | An inbound HTTP `POST` to `/functions/v1/events-webhook`. Nothing in this project calls it; it exists to receive calls from an external sender. |
| Platform JWT gate | **off by design** — `verify_jwt = false`, with the in-file comment *"Disabled - using HMAC signature verification instead"*. The function is therefore reachable without a Supabase session, and its HMAC check is the **only** authentication in front of it. |
| Secret it reads | `WEBHOOK_SECRET`, used as the key for an HMAC-SHA256 over the raw request body. Also reads `SUPABASE_URL` (falling back to `SUPABASE_SERVICE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`. |
| Behaviour when the secret is unset | **fails closed** — HTTP 500 `"Server configuration error"` before any header or body is touched. |
| Client constructed after verification | `createClient(url, serviceRoleKey)` — service role, bypasses RLS. |

### 4.1 Is the secret verified before the body is processed? **Yes — and the ordering is correct.**

The sequence in the handler is: read the three environment values and 500 if any is missing → require one of three accepted signature headers (`x-signature`, `x-hub-signature-256`, `x-webhook-signature`) and 401 if none is present → read the raw body as **text** → compute the HMAC and compare → 401 if invalid → and only *then* `JSON.parse`, validate the payload shape, and insert.

The body is never parsed, never validated, and never persisted before the signature is checked, and the HMAC is computed over the **raw** text rather than over a re-serialised object — which is the detail that most implementations of this pattern get wrong, because re-serialising changes the bytes and makes the signature unverifiable. **Recorded as a positive.** It is the best-constructed authentication boundary this phase has examined.

### 4.2 Three defects that do not undo that

- **Length-mismatched signatures return 500, not 401.** `crypto.timingSafeEqual` throws when its two buffers differ in length, and any signature that is not exactly the expected length triggers that throw, which the outer `catch` converts into HTTP 500 `"Internal server error"`. It still **fails closed** — no insert occurs — so this is not an authentication bypass. It is two smaller things: the function's failure mode becomes indistinguishable from a real outage in any monitoring, and the status code becomes a length oracle (401 = correct length, wrong signature; 500 = wrong length). **Low.**
- **No replay protection.** The signed payload carries no timestamp, no nonce and no idempotency key, and the handler enforces no freshness window. Anyone who observes one valid request can replay it indefinitely, and each replay is a fresh, fully authenticated insert.
- **No deduplication of any kind.** The insert loop is a plain `.insert(dbEvent)` per event — no upsert, no conflict target, no lookup on `source_url` or on `(title, start_date)`. Replay and duplicate delivery both produce duplicate `events` rows.

The compensating control that keeps the pair off the High line is real and deliberate: every inserted row is written with `status: "pending"`, so nothing reaches the public feed without passing the moderation gate. The exposure is moderation-queue flooding, not content injection. **Medium.**

### 4.3 Two bounded gaps, stated rather than assumed

- **Whether the function is deployed is not knowable from this phase's captures.** `config.toml` declares it, but no capture enumerates deployed edge functions — there is no such envelope in `../raw/prod/`. If it is not deployed, every item in § 4.2 is latent rather than live. The command that closes it is in § 8.
- **Whether `WEBHOOK_SECRET` is configured is likewise unknown.** Edge function secrets live in Supabase, not Vercel, so `../raw/vercel/env-names.json` is silent on it *by construction* and its silence is **not** evidence of absence — a distinction that matters, because for `CRON_SECRET` in § 2.3 the same file's silence *is* evidence. If the secret is unset the function 500s on every request, which is fail-closed.

**Verdict — source four: one edge function exists, reachable without a Supabase JWT by explicit configuration, guarded only by an HMAC over the raw body — which it verifies correctly and before processing the body, and which fails closed when the secret is absent. It has no replay protection and no deduplication, and whether it is deployed at all is an open, closable question.**

---

## 5. Source five — the Apify / Instagram ingestion pipeline

The requirement names an *"Apify/Instagram webhook"*. **No such webhook exists.** There is no `/api/webhooks/*` route anywhere in the App Router (verified against the 96-entry `../inventory/endpoints.json` and against the directory tree), and `git grep -il apify` over tracked non-planning files returns exactly two: a design document and one source comment.

**What actually ingests scraped data** is documented in `docs/superpowers/specs/2026-03-17-instagram-scrape-pipeline-design.md` and is a **human-operated script pipeline**, not a network endpoint:

```
Instagram handles (typed by an operator)
  → Claude Code, via the Apify MCP server → apify/instagram-profile-scraper
  → scripts/upload-images.ts  (stdin JSON → download from the Instagram CDN → upload to Supabase Storage)
  → Claude Code, via the Supabase MCP server → parse captions → INSERT clubs and events
```

| Aspect | Finding |
|---|---|
| Entry point | None over the network. Two Node scripts run manually from a developer laptop: `scripts/upload-images.ts` and `scripts/fix-instagram-images.ts`. |
| Authentication | Both scripts read `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the operator's own environment — i.e. the pipeline runs on the **RLS-bypassing credential**, outside the application, outside CI, and outside any audit trail. `admin_audit_log` has 0 rows. |
| Deduplication | Images: `upsert: true` keyed on `{handle}.jpg` and `{slug}.jpg`, so re-runs overwrite rather than duplicate. Clubs and events: **none automated** — dedup is whatever the operator does by eye at insert time. `LAST_SCRAPE.md` (tracked, last dated 2026-03-24) is the only record, and it is a hand-maintained log. |
| Scale reached | 222 clubs and 229 events in production (`../raw/prod/row-counts.json`), the great majority of the dataset. |
| Scheduling | None. It runs when a person runs it. |

**One stale comment worth correcting, because it is the reason the requirement expected a webhook.** `src/lib/classifier.ts:9` reads *"Pipeline position: Apify output -> classifier -> webhook (pending_events)"*. Both halves are wrong today: there is **no `pending_events` table** in production (the catalog capture returns 40 relations and none is named that), and `classifyTags` is imported by `CreateEventForm.tsx` and `EditEventModal.tsx` — it serves the **manual create and edit UI**, not any ingestion path. The comment describes an architecture that was either never built or was removed, and it is the only in-source evidence for a webhook that does not exist. Low, documentation.

The nearest thing to an ingestion webhook is the edge function in § 4, which maps `source: "instagram"` onto any payload carrying a `source_url`. Whether that path has ever been used is the deployment question in § 4.3.

**Verdict — source five: no Apify or Instagram webhook exists. Ingestion is a manually-run, operator-driven script pipeline executing on the service-role key from a developer laptop, with no automated deduplication for clubs or events and no audit trail. It is not an unauthenticated entry point — it is an unaudited privileged one, which is a different risk and belongs in a different register.**

---

## 6. Source six — Supabase auth hooks

**No auth hook is configured, and the negative is recorded with its evidence.**

| # | Evidence | Result |
|---|---|---|
| 1 | `supabase/config.toml` lines 230–238 | Both hook blocks are **commented out** in full: `# [auth.hook.before_user_created]` and `# [auth.hook.custom_access_token]`, together with their `uri` lines. No hook is declared. |
| 2 | `../raw/prod/functions.json` — 45 functions | **None** is a hook target. The `SECURITY DEFINER` functions are `is_admin`, `is_club_owner`, the three scheduled-job functions, `update_event_popularity` and the trigger helpers. A `pg-functions://` hook would require a function in an accessible schema with the GoTrue hook signature; there is none. |
| 3 | `../raw/prod/auth-config-tables.json` — 23 `auth` tables | All stock GoTrue relations (`users`, `sessions`, `identities`, `mfa_*`, `oauth_*`, `saml_*`, `one_time_tokens`, …). Nothing project-specific, and no hook registration table. |

**Bounded gap:** the GoTrue runtime hook configuration is dashboard state, not database state, and was not captured. A hook could in principle be configured there pointing at an HTTP endpoint — but item 2 rules out the `pg-functions://` form entirely, and no HTTP endpoint in `../inventory/endpoints.json` has a hook-shaped signature. The closing command is in § 8.

**Why the negative matters rather than being a shrug.** A `custom_access_token` hook is the designed home for role and claim assignment. This project has no such hook, so that logic lives instead in `src/app/auth/callback/route.ts`, where an `ADMIN_EMAILS` allowlist promotes users to `admin` by writing to `public.users` **on a service-role client** — registered as **FO-05** in `../authz/fail-open-register.md`. The absence of a hook is therefore not "one less thing to audit"; it is the explanation for why a privilege grant sits in a request handler. `ADMIN_EMAILS` is also **not configured in production** (§ 7), so that allowlist is empty and promotes nobody — the one place in this inventory where an unset variable produces the safe outcome.

**Verdict — source six: no auth hook is configured in the repository and none exists as a database function; the dashboard-side GoTrue configuration is an open, closable gap, and the role-assignment logic a hook would normally own is instead in `/auth/callback` on a service-role client.**

---

## 7. Environment-name census — what the code reads against what production configures

The requirement's six sources all turn on credentials, so the cross-reference is done once, here, rather than repeated per section. Left column: every distinct `process.env.<NAME>` and `Deno.env.get("<NAME>")` in `src/`, `scripts/`, `next.config.js` and `supabase/functions/`. Right column: the three names configured on the Vercel project, from `../raw/vercel/env-names.json`. **Names only — no value was captured, and none exists in any artifact.**

| Name | Read by | Configured on Vercel? | Consequence of the mismatch |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 11 reads across 9 files in `src/` + 3 in `scripts/` | **yes** — development, preview, production | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 6 reads across 6 files | **yes** — development, preview, production | — |
| `SUPABASE_SERVICE_ROLE_KEY` | 4 reads in `src/` + 3 in `scripts/` + the edge function | **yes — production only** | Not set for **preview** or **development**. On a preview deployment, `/auth/callback`'s entire profile-sync block is skipped (FO-05), so a user signing in on a preview URL completes login with no `public.users` row and no onboarding redirect. Preview environments therefore do not reproduce production auth behaviour — which matters for any Stage 4 test run against a preview URL. **Medium.** |
| `CRON_SECRET` | 2 files, 3 reads — both `/api/cron/*` handlers | **NO** | **The finding of § 2.3.** `/api/cron/send-reminders` compares against `Bearer undefined` and admits anyone who sends it (FO-02, High, now observed rather than conditional). `/api/cron/send-feedback-requests` returns 500 to every caller (FO-04, fail-closed, provably dead). |
| `ADMIN_API_KEY` | 1 file, 2 reads — `/api/admin/calculate-popularity`, both verbs | **NO** | **FO-01 is live.** The gate is `if (expectedKey && authHeader !== …)`, so with the variable unset the entire conditional is false and the 401 is never returned. The next statement builds a service-role client. An anonymous, unauthenticated write to ranking data is open in production right now. `fail-open-register.md` rates this **Critical** and had to hedge on whether the variable was set; it is not. |
| `ADMIN_EMAILS` | 1 file, 1 read — `/auth/callback` | **NO** | Fails closed. `?? ""` then `.filter(Boolean)` yields an empty allowlist, so nobody is auto-promoted to `admin` (FO-05). The only benign row in this table. |
| `npm_package_version` | 1 read — `/api/health` | n/a — injected by npm at script time, absent in the deployed runtime | `/api/health` reports an undefined version in production. **Low**, hygiene. |
| `WEBHOOK_SECRET` | the edge function (Deno) | **not applicable** — edge function secrets live in Supabase, not Vercel | Silence here is **not** evidence of absence, unlike the `CRON_SECRET` row. See § 4.3. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_URL` | the edge function (Deno) | **not applicable** — same | Supabase injects `SUPABASE_URL` into edge functions automatically; `SUPABASE_SERVICE_URL` is a fallback that appears nowhere else in the project. |

**Three of the six application-level names the code reads are not configured in production**, and in two of those three cases the code's response to absence is to weaken or remove an authorization check rather than to fail. That is the single highest-value sentence this capture produced, and it converts two hedged rows in `../authz/fail-open-register.md` into observed production state.

---

## 8. Consolidated verdict table

One row per asynchronous entry point. "Fails closed without its credential" answers: with the required credential absent, does the entry point refuse the request?

| Entry point | What triggers it | Trigger confirmed? | Credential required | Fails closed without it? | Proposed severity |
|---|---|---|---|---|---|
| `/api/cron/send-reminders` | nothing — all three sources negative, and `email_reminder_log` is empty | **no — nothing invokes it** | `CRON_SECRET` (**not configured**) | **no** — compares against `Bearer undefined`; any anonymous caller sending that string reaches a service-role client | **High** (FO-02) |
| `/api/cron/send-feedback-requests` | nothing — same three negatives | **no — nothing invokes it** | `CRON_SECRET` (**not configured**) | **yes** — HTTP 500 before the comparison, so it 500s on every request in production | Low (dead route) |
| `/api/admin/calculate-popularity` | nothing schedules it; anonymous HTTP reaches it | n/a — not a scheduled entry point, included because the census proves its gate open | `ADMIN_API_KEY` (**not configured**) | **no** — the gate is skipped entirely | **Critical** (FO-01, confirmed live) |
| `cron.job` → `public.send_event_reminders()` | `pg_cron`, `*/15 * * * *`, 65/65 succeeded | **yes — live and succeeding** | none — runs in-database as `postgres` | n/a — no network boundary to cross | Medium (no `deleted_at`/`status` filter; prod-only drift) |
| `cron.job` → `public.send_feedback_requests()` | `pg_cron`, `*/30 * * * *`, 32/32 succeeded | **yes — live and succeeding** | none — runs in-database as `postgres` | n/a | Low (prod-only drift) |
| `cron.job` → `public.compute_user_scores()` | `pg_cron`, `0 */6 * * *`, 3/3 succeeded | **yes — exists in the database, per `cron-job.json`, not per the migration comment** | none — runs in-database as `postgres` | n/a | Medium (exists in no migration; `user_event_scores` at 0 rows is an open question) |
| `supabase/functions/events-webhook` | an external HTTP `POST`; nothing in this project calls it | **unknown — deployment status not captured** | `WEBHOOK_SECRET`, as an HMAC over the raw body, verified **before** the body is processed | **yes** — 500 when the secret is absent, 401 when the signature is absent or wrong | Medium (no replay protection, no dedup) |
| `vercel.json` crons | — | **none exist** — `definitions: []`, recomputed at the current production deployment | n/a | n/a | — (the negative is the result) |
| `scripts/upload-images.ts` (Apify / Instagram ingestion) | a human, manually | **yes — operator-driven, last run 2026-03-24** | `SUPABASE_SERVICE_ROLE_KEY` from the operator's shell | n/a — not network-reachable | Medium (unaudited privileged write path, no club/event dedup) |
| Supabase auth hooks | — | **none configured** — both `config.toml` blocks commented out, no hook-shaped database function | n/a | n/a | — (the negative is the result) |
| `.github/workflows/ci.yml` | `push` and `pull_request` to `main` | **yes — but it invokes no cron path**; there is no `schedule:` trigger | repository secrets (none used; the two `NEXT_PUBLIC_*` values are literal placeholders) | n/a | — |

### The High finding candidate the requirement asks for, stated precisely

The plan's instruction is: *"If a handler implementing a Validated workflow has no confirmed trigger from any of the six sources, record it as a High finding candidate with the workflow it breaks named explicitly."*

Two handlers qualify on the letter of that test, and the honest record splits into two findings rather than one, because the workflow is **not** broken:

- **CW-01 — High.** `/api/cron/send-reminders` has no confirmed trigger from any of the six sources **and** its credential check is open in production. The Validated workflow it nominally implements — PROJECT.md line 29, *"In-app notifications and email reminders"* — is **not** broken by the absence of a trigger, because `pg_cron` runs an in-database reimplementation every 15 minutes (§ 1). The severity therefore comes from the register, not from the dead trigger: an anonymously reachable service-role write surface behind the guessable literal `Bearer undefined` (FO-02). The remediation is **deletion or a fail-closed guard, not a schedule** — scheduling it would activate the four divergences in § 2.5 and produce duplicate notifications to real users.
- **CW-02 — High.** The *"email reminders"* half of that same Validated requirement **does not exist in any implementation**. No email provider dependency exists in the project; both the live pg_cron function and the dead handler insert in-app `notifications` rows and nothing else, while the table name `email_reminder_log`, the route name `send-reminders`, and the requirement's own wording all assert otherwise (§ 2.6). This is the finding the requirement was reaching for, and it is only visible because both sources were inventoried together.

**Not filed as a finding, filed as an open question:** `user_event_scores` at 0 rows against a scoring job that succeeds every six hours (§ 1.2). One query settles it.

---

## 9. Reproduction

```bash
# the live captures this inventory is derived from (already committed; do not re-query)
node -e "JSON.parse(require('fs').readFileSync('.planning/audit/async/cron-job.json','utf8')).forEach(j=>console.log(j.jobid,j.jobname,j.schedule,j.active,j.runs_in_captured_window,JSON.stringify(j.run_status_counts)))"
node -e "const r=JSON.parse(require('fs').readFileSync('.planning/audit/async/cron-job-run-details.json','utf8'));console.log(r.length,'runs |',[...new Set(r.map(x=>x.status))],'|',[...new Set(r.map(x=>String(x.return_message)))])"
node -e "console.log(JSON.parse(require('fs').readFileSync('.planning/audit/async/extensions.json','utf8')).filter(e=>e.installed).map(e=>e.name+'@'+e.installed_version).join(' '))"

# the three negatives behind section 2.4
node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('vercel.json','utf8'))))"   # no 'crons'
git grep -n "api/cron" -- ':(exclude).planning' ':(exclude)docs'                                   # no matches
command grep -nE "curl|wget|schedule|api/cron" .github/workflows/ci.yml                            # no matches

# the env-name cross-reference behind section 7
command grep -rhoE 'process\.env\.[A-Za-z_][A-Za-z0-9_]*' src/ | sed 's/process\.env\.//' | sort | uniq -c
node -e "console.log(JSON.parse(require('fs').readFileSync('.planning/audit/raw/vercel/env-names.json','utf8')).rows.map(r=>r.key+' '+JSON.stringify(r.target)).join('\n'))"

# the two gaps this inventory could not close, and the exact read-only commands that would
#   1. is the edge function deployed?      supabase functions list --project-ref "$PROD_PROJECT_REF"
#   2. is any GoTrue auth hook configured? GET /v1/projects/{ref}/config/auth  (Management API, read-only)
#   3. the open question in 1.2:           SELECT count(*) FROM public.user_event_scores;
# None was run: this phase holds no credential, and all three require one.

# the gate
node .planning/audit/tools/validate.mjs --check cron
bash .planning/audit/tools/readonly-guard.sh
```

---

*Requirement AUDIT-11 · phase 01-read-only-foundation-audit · plan 01-10 · verified 2026-09-14*
