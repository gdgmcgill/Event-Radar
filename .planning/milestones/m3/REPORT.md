# M3 implementation report

Execution: September 29, 2026. Branch: `codex/m3-useful-discovery`, based on `c5c1bc6` (the M1–M2 commit).

Scope: P1-06 through P1-09 of the expanded Phase 1 plan, the M3 "Make discovery useful" milestone. The owner authorized M3 after M1–M2; see [DECISIONS.md](DECISIONS.md). No push, deployment, production migration, hosted configuration change or external send was performed. The only external call was the owner-authorized Apify run for P1-07, and its output went to the local stack only.

## Delivered

| Package | Commits | Result |
|---|---|---|
| P1-08 Authored resources | `036fd22`, `0f58ca6` | `resources` and `resource_actions` tables, an audited `curate_resource` RPC (create/edit/publish/archive with stale-version checks), and a small in-repo Markdown renderer that emits React elements only and refuses raw HTML and non-http(s)/mailto links. Public `/resources` and `/resources/[slug]` pages. Templates are served through a short-lived signed URL from a private `resource-files` bucket. An admin editor with preview. The baseline storage policies were narrowed so no browser role can read or write the private bucket. |
| P1-06 Homepage and details | `5dfd25a`, `0ccde0f` | A switch-aware homepage: the legacy home with the switch off, and with it on an editorial home with This week, Ady's Picks, Browse by type and Resources. Each section fails independently with an honest notice. Shared listing facts: occurrence, deadline with date-only and time-zone notes, eligibility, relevance, location, provenance, last checked. Closed listings show no action. `FallbackImage` replaces expired external images. A switch-aware About whose founder slot stays empty until the owner supplies copy. Also the `/landing` cutover, a metadata base, and sitemap and robots updates. |
| P1-09 Intake | `75f23b5`, `f0d3a88` | `/submit`, `/for-companies` and "Report a problem" on listings, all usable anonymously. Strict contracts: unknown keys such as `status` or `is_pick` are a 400. Abuse controls: a honeypot, a 5-per-minute route budget, and database quotas keyed by a salted client hash (never the raw IP). `/moderation/submissions` shows private contacts to admins only. Submissions convert to **draft** opportunities or resources, idempotently on retry. Listing reports can be resolved or dismissed. A company request becomes a `partner` job draft and never grants a role. |
| P1-07 McGill supply | `1ff6c1b` | A webhook delivery log (`ingestion_deliveries`) with run, heartbeat and failure records. Freshness fields in `/api/health` and on the health page. `/moderation/ingestion` shows deliveries and stale pending events, with "Reject as expired". Admin image persistence hardened against SSRF. The repo producer (`scripts/ingest/instagram.ts`) with a loopback-only runner and a [runbook](../../../docs/runbooks/ingestion.md). A real local run ingested six McGill events, a replay added none, and a forced failure was recorded. |
| Verification | this commit | The M3 acceptance browser suite (`e2e/specs/m3-acceptance.spec.ts`, run by `playwright.m3.config.ts`), one product fix it exposed, two baseline-harness classifications the new intake routes needed, the full local gate below, and this report. |

All new public pages and APIs sit behind the existing `discovery_ui` switch. The computer-use walkthrough of the milestone demo is [recorded separately by the controller](COMPUTER-USE-VERIFICATION.md).

## Compatibility and security

- **Switch off = old product.** With every `FEATURE_*` unset, `/` renders the legacy homepage, `/about` the legacy About and `/landing` the landing page. Every new page and API answers 404. The baseline browser suite runs with all switches off and passed (below). Admin moderation navigation (Resources, Submissions, Ingestion) follows the M2 precedent and is visible to admins regardless of the switch.
- **Private data stays private.** Column grants, admin-only RLS and explicit projections exclude:
  - submitter and company contacts;
  - client hashes;
  - reporter details;
  - duplicate-review notes;
  - draft resources.

  The acceptance suite searches public HTML, the `RSC: 1` payload, `/api/discovery`, `/api/opportunities/<id>`, `/api/resources` and `/sitemap.xml` for seeded sentinel values.
- **Double actions.** Converting a submission twice returns the same target and creates nothing (pgTAP and the browser suite). A replayed ingestion batch is recorded as `duplicate` and inserts nothing (real local replay and edge tests).
- **Hostile intake.** HTML and `javascript:` links in listing copy or guides are refused (contract, route and browser tests). A filled honeypot answers 202 and stores nothing. Forged editorial keys are a 400.
- **No fabricated content.** No resource, founder copy, endorsement, employer relationship, pick or listing was invented. No provenance label says "Verified".
- Every new route is wrapped in `withRoute` with `cache: "private"` and reads input only through contracts. Routes log only through `log` and reach the database with elevated rights only through the elevated door, with registry rows under `### M3` sections.
- **Hosted deploy without an intake secret.** With `VERCEL` set and no `INTAKE_HASH_SECRET`, intake routes fail closed with a 503 rather than using the local salt.

## Found and fixed during verification

1. **Product defect: broken event hero image.** The event detail hero rendered `event.image_url` through a plain `next/image`. An expired Instagram CDN URL therefore left a broken hero, although cards and the moderation queue already fell back (review focus 4). The hero now uses `FallbackImage` (`src/components/events/EventDetailView.tsx`). A new unit case in `EventDetailView.test.tsx` failed before the change and passes after it. The browser case "an unreachable event image on an allowed host falls back to the placeholder" also passes.
2. **Baseline harness: intake routes were not classified.** P1-09 added `POST /api/submissions`, `/api/company-requests` and `/api/listing-reports` to the probe manifest as 404 but never ran the baseline suite. The first baseline run failed 23 of about 2,400 cases, [kept as a diagnostic](evidence/browser-baseline-diagnostic-run1.log). Every failure was one of two cases:
   - The authorization matrix applied its generic rule (anonymous → 401, incomplete profile → 403) to routes that are anonymous by design. With the switch off, those routes correctly answer 404 to every non-banned caller.
   - Thirteen personas probing from one loopback address exhausted the intake budget of 5 per minute per address and path, so later probes read 429. That is the intended limiter behavior.

   `e2e/helpers/authorizationProbes.ts` now marks these three routes `anonymousCapable`. Non-banned personas expect the route's 404, and banned personas still expect 403. Each persona probes an intake route as its own documentation-range client address (`x-real-ip`). `e2e/specs/cache-headers.spec.ts` records the 404 as a documented exception with its reason, and probes the three routes from its own client address. No product code changed for this item.
3. **Spec-side corrections in the first M3 run.** That run is kept as a [diagnostic](evidence/browser-m3-diagnostic-run1.log) and is not claimed as green. Three corrections:
   - Wait for the submit POST instead of matching copy that the page intro also contains.
   - Accept Next's streamed `notFound()` status (200 once the shell has flushed, as the page-smoke harness already does) while asserting the draft's content is absent.
   - Wait for the moderation layout's streamed redirect.

## Verification

Earlier diagnostic logs are kept separately and are not claimed as green. Files ending in `-final.log` record the final runs. The database runs started from `supabase db reset --local` and the guarded seed loader. The final browser runs used a second reset and seed, taken after the harness fix.

| Gate | Result | Evidence |
|---|---|---|
| Migration replay | 25 migrations, 4 of them M3, applied cleanly | [reset](evidence/db-reset-final.log), [seed](evidence/seed-final.log) |
| Database suite (seeded) | **861 assertions across 29 files, PASS** | [log](evidence/database-seeded-final.log) |
| Unit/UI suite (`npm run test:ci -- --runInBand`) | **4,380 passed, 1 skipped** (the credential-dependent Upstash suite); 181 suites passed, 1 skipped | [log](evidence/unit-tests-final.log) |
| TypeScript (`tsc --noEmit`, includes e2e) | clean | [log](evidence/typecheck-final.log) |
| ESLint | 0 errors, 15 warnings (all pre-existing) | [log](evidence/lint-final.log) |
| Type drift (CLI 2.115.0) | generated public-schema types equal the committed file byte-for-byte | [log](evidence/type-drift-final.log) |
| Static guards | all seven pass: 25 migration filenames; empty elevated ratchet; empty contracts census and 43 client senders with 0 violations; server console census; 57 characterization-tagged files; RLS coverage of 41 tables and 164 client-role read cases | [log](evidence/guards-final.log) |
| Baseline browser suite (all switches off) | **2,251 passed, 151 skipped, 0 failed** | [log](evidence/browser-baseline-final.log) |
| M1/M2 enabled browser suite | **15 passed** | [log](evidence/browser-m1-m2-final.log) |
| M3 enabled browser suite | **21 passed**: 10 persona setups and 11 acceptance cases | [log](evidence/browser-m3-final.log) |
| Local edge functions (`scripts/test-edge-local.ts`) | **21 passed**, 0 failed | [log](evidence/edge-local-final.log) |
| Production build (`npm run build`) | exit 0 | [log](evidence/build-final.log) |

The baseline run had `net.ipv4.tcp_tw_reuse=1` set inside the local auth container's network namespace; see the M1–M2 report for why.

The M3 acceptance cases, each an independent test with disposable rows in the `ad070300-…` namespace that `afterAll` removes:

1. Guest home: the hero reaches `/discover` without sign-in, with no Talent, "Apply with" or Weekly Drop copy.
2. Discover type and university filters survive a reload and browser back from a listing.
3. A date-only deadline shows "(end of day, America/Toronto)", "Check eligibility with organizer" and the provenance label. A closed listing has no action link.
4. The student persona saves a listing; `/saved` shows it next to a legacy saved event.
5. An admin publishes a guide through the API; it has no horizontal scroll at 360×800. A draft stays out of `/api/resources`, `/sitemap.xml` and its own page. A guide containing `[x](javascript:alert(1))` is a 400.
6. A guest submits a hackathon on `/submit`, and the receipt shows no ID. An admin converts it in the UI, opens the draft, completes it, checks the source and publishes it, and a guest then finds it on `/discover`. A stale retried convert returns the same target with one opportunity. A honeypot POST answers 202 and stores nothing.
7. A guest report appears in the Listing reports tab with its reason. Its details never appear on the public page or in the API.
8. A company request converts to a `partner` job draft. After publication its contact email is absent from `/`, `/discover`, the public page and both APIs. The submitter's roles are unchanged.
9. A `duplicate_review_note` sentinel and the contact emails are absent from HTML and `RSC: 1` payloads of `/`, `/discover` and opportunity pages.
10. An admin sees `/moderation/ingestion` with a delivery row; a student is redirected to `/`.
11. An event whose image is unreachable on an allowed host renders `/placeholder-event.png`.

The real ingestion evidence from P1-07 (Task 16) is in [ingestion-real-run.log](evidence/ingestion-real-run.log), [ingestion-replay.log](evidence/ingestion-replay.log) and [ingestion-failure.log](evidence/ingestion-failure.log).

**Local demo data.** The six real ingested pending events and their three delivery rows were exported before the gate's reset. They were restored with `COPY` after all browser suites finished, because the baseline health spec expects no ingestion in the seed state. Row checksums match the export. The local database also keeps 16 synthetic delivery rows written by the edge-function test run (producer `unknown`), so the ingestion summary's latest timestamps reflect that test run rather than the real producer run.

## Reproduce locally

```sh
supabase db reset --local
npx tsx scripts/seed/load.ts
supabase test db --local
npm run test:ci -- --runInBand
npx tsc --noEmit
npm run lint
supabase gen types typescript --local --schema public > /tmp/types.gen.ts && diff -u src/lib/supabase/types.ts /tmp/types.gen.ts   # CLI 2.115.0
# Local-only: let the auth container reuse TIME_WAIT ports (see the M1–M2 report).
docker run --rm --privileged --net container:supabase_auth_Event-Radar alpine sysctl -w net.ipv4.tcp_tw_reuse=1
npx playwright test --config=playwright.config.ts        # baseline, switches off
npx playwright test --config=playwright.m1-m2.config.ts  # M1/M2 enabled
npx playwright test --config=playwright.m3.config.ts     # M3 enabled
npx tsx scripts/test-edge-local.ts
npm run build
```

Run the browser configurations one after another: each builds and starts its own production server on port 3000. Generate types with Supabase CLI 2.115.0; 2.118.0 emits a different format.

## Not done in M3

- **Owner content.** No real resources, founder story, picks or launch listings were supplied. The [launch-content checklist](../m1-m2/DECISIONS.md#launch-content-checklist) is therefore unchanged, and the editorial sections show honest empty states. The owner adds content through the admin editors before M4.
- **Hosted producer schedule.** The producer is run by an operator. A scheduled hosted run needs a hosted secret and an owner decision (M4).
- **CDN/shared caching.** Every new API answers `private, no-store`; shared caching of public reads is M4 work.
- **Production migration and deployment.** The four M3 migrations exist only in local databases.
- **Deno offline test and `npm audit`.** These CI steps were not in this gate's required list. The Deno handler test passed in P1-07.

## Remaining owner actions

- Add `INTAKE_HASH_SECRET=` to `.env.local.example`; agents cannot read that file here. Set a real secret in every hosted environment before enabling intake; without it, a hosted deploy answers 503 on intake.
- Supply the launch content through the editors: 3–5 genuine resources, founder copy, picks and checked listings.
- Decide the hosted producer schedule, and store `APIFY_API_TOKEN` and the webhook secret as hosted secrets.
- The M1–M2 release inputs are unchanged: curator UUID, Google and email-provider setup, and operational requirements.

## Residual limitations

These are deferred review minors and execution rulings from the M3 ledger. None blocks local acceptance.

**Resources (P1-08)**
- The Markdown parser's inline scan is quadratic in the worst case: 50,000 `[` characters take about 870 ms.
- `_x_` inside a word is treated as italics.
- The editor's upload discards unsaved edits.
- A 23514 constraint error says "Listing".
- The create path accepts file keys into `changed_fields`.
- The resources page uses `safeParse` rather than `parseWith`.
- Upload-rejection tests do not assert that storage was never called.
- The open-resource GET counts link prefetches.
- "Cannot save yet" is announced on a blank new form.
- An upload path built from an uppercase caller id fails the CHECK. The error is contained as a 400.
- The pgTAP student UPDATE/DELETE storage assertions target a fixture outside the student's own folder, so they are weak.
- Best-effort file cleanup can leave an orphaned object.

**Homepage and details (P1-06)**
- `FallbackImage` never resets `failed` when `src` changes. Callers key the component, so there is no live bug.
- There is no scheduled publishing. The sitemap applies `published_at <= now` for parity with picks.

**Intake (P1-09)**
- Every intake 23514 error maps to "too long".
- The report dialog ignores a server `field`.
- The submit form can map a server field to a key it does not render.
- The per-user quota is serialized only per client hash, so parallel requests from several addresses can slightly exceed 20 per day.
- A banned signed-in caller is recorded as anonymous. The proxy ban ring is the primary block.

**Ingestion (P1-07)**
- A batch in which every mapping fails is recorded as `failed` with a null `error_code`.
- The newest-first persist limit can starve older rows after repeated non-404 failures.
- The DNS lookup is not bounded by the 10 s timeout, and the images route has no `maxDuration`.
- `isPrivateAddress` misses `::/96`, `2002::/16`, `64:ff9b:1::/48` and Teredo; the host allow-list mitigates this.
- There is a DNS-rebinding window between the check and the fetch.
- Runbook: its `internal_error` advice does not match `run-local`, which discards serve output, and it says `--dry-run` sends nothing although `--dry-run` still calls Apify.
- A failed health-summary read blanks `last_ingest_at`.
- The producer's post-timestamp window admits past-dated events (5 of the 6 real ones).
- The IngestionPanel "Review" link for past items goes to `/moderation/pending`, which hides them.
- The summary type is duplicated between `IngestionSummaryRecord` and `HealthWebhook`.
- The inventory tool has boilerplate ingestion rows.
- A Deno test file lacks its final newline.
- Ingested times are read as UTC, as before M3.

**Rulings recorded during execution**
- Work ran on the branch in the main tree, with no worktree.
- There is one package per dispatch, and review fixes landed as separate `fix(m3)` commits.
- Titles with no Latin letters or digits get the slug `listing-…`.
- The `.env.local.example` line is an owner action; a hosted deploy fails closed.
- The plan-mandated convert-retry route test is a pass-through check; pgTAP proves idempotency.
- Admin ingestion surfaces are not behind `discovery_ui`.
- The baseline suite ran on the reset and seeded state before the real ingested rows were restored.
- The computer-use demo, and with it the live check of the reject route on past-dated pending events and of `GET /api/admin/ingestion`, is performed by the controller.
