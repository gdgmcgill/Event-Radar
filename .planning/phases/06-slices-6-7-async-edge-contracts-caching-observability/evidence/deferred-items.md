# Deferred Items — Phase 06

**Plan:** 06-01 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-25

This is Phase 6's deferred-item register, opened by plan 06-01. It follows the format of the Phase 5
register (`.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/deferred-items.md`),
which followed Phases 3 and 4. It continues the `DI-` sequence. Phase 5's register ended at "Next new
item id: DI-60", but the Phase 5 code-review fixer then proposed DI-61..DI-77 in
`05-REVIEW-FIX.md` § "Carried Info findings" without registering them. CONTEXT Area 5 requires those
proposals to be registered or dropped before new numbering starts, so Part 2 disposes every one of
them, DI-60 is recorded vacant, and **the first new item this phase defers is DI-78.** Decisions carry
the `DEC-` prefix and live in `evidence/phase-06-decisions.md` (DEC-60 through DEC-81).

The rule is unchanged: **deferring silently is forbidden, and there is no row below without an
owner.** Later Phase 6 plans append to this file. They do not start a second one.

---

# Part 1 — Every inherited item, disposed

Each item Phase 5's Part 5 table left open gets a row. "Unchanged" means Phase 6 neither advances nor
re-plans the item, and its existing owner stands.

| Item | What it is | Disposition in Phase 6 | Owner |
|---|---|---|---|
| **DI-21** | The CSP has no local Supabase origin; the harness runs with `bypassCSP` | **To 06-16** (C13, DEC-77): the origin of `NEXT_PUBLIC_SUPABASE_URL` is admitted at config evaluation, and the harness sets `bypassCSP: false` | 06-16 |
| **DI-22** | `/moderation?status=pending` deep link ignored by the events queue | **Unchanged.** A moderation-page behaviour fix outside REFAC-14..23 | the phase owner |
| **DI-23** | The production migration-history repair is not performed | **Unchanged and binding on every Phase 6 plan:** no `supabase db push`, no `--linked`. 06-05's migration is local-only until it closes; DEC-72 keeps F-074, F-075, F-076, F-093 Open at "08" | Phase 8 |
| **DI-25 / DI-53** | The `@supabase/supabase-js` 2.116.0 minor; four admin payloads still fail `tsc` on it | **To 06-10** (the four sites retyped through the admin contracts) and **06-18** (the bump as the last code change after a throwaway-worktree proof; DEC-80) | 06-10, 06-18 |
| **DI-26** | The blanket shared-cache directive (`vercel.json` `s-maxage=60`), and `/api/events`' own `s-maxage=30` | **To 06-14 and 06-15** (DEC-73): `vercel.json` loses `headers` in 06-14; `/api/events`' value is kept, now explicit as `public-30-60`; 06-15's cross-user spec and header sweep close it | 06-14, 06-15 |
| **DI-27** | The five signed-in Tier 3 manual acceptance steps | **Unchanged** | the phase owner; CERT-05, Phase 7 |
| **DI-29** | No staging Supabase project | **Unchanged** | the phase owner to provision; CERT-01, Phase 7 |
| **DI-33** | Three storage buckets and three pg_cron jobs exist only in production | **Split.** The cron half goes **to 06-05** (the two missing jobs declared byte-identical, DEC-70). The bucket half is unchanged. **Cron half CLOSED at the slice-6 close (06-06):** `0ba575a` declares both jobs; after a fresh reset `cron.job` equals production's list field for field (`evidence/floor.slice-6-after.txt` block 16c; F-042 Fixed, `evidence/slice-6-close.md` § 4) | ~~06-05 (cron)~~ closed; Phase 8 (buckets) |
| **DI-39** | F-080's visual half | **Unchanged.** Owner-decision item | the phase owner |
| **DI-40** | F-081's six identity mappings | **Unchanged.** Owner-decision item | the phase owner |
| **DI-41** | `/invites/[token]` auto-accepts an invitation on GET (a Low CSRF residual) | **Unchanged** | the phase owner |
| **DI-42** | Owner actions required before any push to `main` (Upstash provisioning and `RATE_LIMIT_REQUIRE_DISTRIBUTED`) | **Unchanged.** Travels with DI-81's deploy prerequisites in the completion note | the phase owner |
| **DI-43** | `@supabase/ssr` 0.7 → 0.12, the major | **Phase 8** (CONTEXT out of scope; DEC-80) | Phase 8 |
| **DI-44** | `recommendations/feedback` keeps an unreachable body-`user_id` fallback; the anon-role write is unprobed | **Split.** The code half goes **to 06-04** (the feedback contract has no user id, so the fallback is deleted; DEC-68). The anon-role RLS probe stays with Phase 7. **Code half CLOSED at the slice-6 close (06-06):** `2617b7b` removed both `authUser?.id ?? body.user_id` fallbacks and their dead 401s; the four remaining `user_id` lines all use the caller's id (`evidence/contracts-slice-6.txt` [2.9]), and the DI-44 rows of `recommendations-family-characterization.test.ts` pass unedited | ~~06-04 (code)~~ closed; Phase 7 (probe) |
| **DI-45** | Auth-failure log lines removed by the context adoption | **To 06-12** (DEC-74): a warn line when the user lookup errors with anything but a missing session | 06-12 |
| **DI-46** | CLAUDE.md cites stale lines and a deleted helper | **Unchanged in ownership.** 06-18 prepares a fact-only patch; it is applied only if the owner signs an authorization here (DEC-81). **06-18: no owner-signed authorization is present in this register, so neither `CLAUDE.md` nor `.claude/CLAUDE.md` was edited. The fact-only corrections are `evidence/claude-md-corrections.patch` (`git apply --check` exit 0 at `3902768`); the patch awaits the owner. To authorize, append a signed paragraph below this table naming the patch, then run `git apply` on it** | the phase owner |
| **DI-47** | Branches and prose left behind by the handler ring | **To 06-14's comment-only sweep**, with DI-59, under ledger rows where a characterization file is touched | 06-14 |
| **DI-49** | The club member list is shaped by RLS | **Unchanged** | the phase owner |
| **DI-50** | The ownership-transfer rollback does not restore the target's previous role | **CLOSED by record.** Fixed by `9daa291` (REVIEW-05 WR-02): `src/app/api/clubs/[id]/transfer/route.ts` rolls back with `.update({ role: targetMember.role })` and logs a failed rollback (06-RESEARCH.md C16). No code | — |
| **DI-51** | Non-creator club members pass the events/[id] PATCH and DELETE gates that RLS then refuses | **Unchanged** | the phase owner |
| **DI-54** | `users` still grants DELETE and TRUNCATE to anon and authenticated; one policy is inert | **Phase 7** (the per-table RLS and grant sweep) | Phase 7 |
| **DI-55** | The admin page layouts and the moderation reviews admin path decide by role only | **To 06-17** (DEC-79): `requireAdminPage` and `requireActiveUser` before the role | 06-17 |
| **DI-56** | `/users/[id]` can only soft-404 | **Re-owned to the phase owner.** A hard 404 needs a proxy read, which CONTEXT keeps out of the proxy ("keep … the proxy matcher … untouched"), or removing the root loading boundary, which is a visual change | the phase owner |
| **DI-57** | The public profile title repeats the site suffix | **Unchanged** (a visual change) | the phase owner |
| **DI-58** | Stale generated contract text for two admin surfaces | **To 06-15's regeneration** of `endpoints.json` | 06-15 |
| **DI-59** | Stale prose and line references left by slice 5 | **To 06-14's comment-only sweep**, with DI-47(b) | 06-14 |
| Phase 2 residuals | Renovate not installed; the two Moderate production advisories (`dompurify`, `yaml`) | **Unchanged.** Measured on the base commit: 0 critical, 0 high, 2 moderate (`evidence/floor.before.txt` block 4). The zod and Sentry installs re-measure it | the phase owner (Renovate); 06-03, 06-16 (re-measure) |

**Closed before Phase 6, not re-planned:** DI-19, DI-20, DI-24, DI-28, DI-30, DI-31, DI-32, DI-34,
DI-35, DI-36 (retired into F-086), DI-37, DI-38, DI-48, DI-52 (Phase 5 register, Part 5).

---

# Part 2 — The Phase 5 fixer's proposals DI-60..DI-77, each disposed

Source: `.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/05-REVIEW-FIX.md`
§ "Carried Info findings" (IN-01..IN-26) and its DI-65 note. The fixer proposed owners; none was
registered. Each is now registered with an owner or retired into a finding. "Phase 6, 06-nn" means a
Phase 6 plan executes it; every other owner is outside this phase and says why.

## DI-60 — vacant

- **What it is.** Nothing. The fixer's proposals began at DI-61, and Phase 5's register ended at "Next
  new item id: DI-60". The id is left unused so that every `DI-61..DI-77` citation already in
  `05-REVIEW-FIX.md` stays valid.
- **Owner:** none (vacant by record).

## DI-61 — Rate-limit key design and store-selection residuals

- **Source:** 05-REVIEW-FIX IN-01 (per-path keys; `x-real-ip` trusted unconditionally), IN-05 (a broken
  Upstash pair shadows KV; the fallback ignores `REQUIRE_DISTRIBUTED`; token whitespace), IN-15
  (`ADMIN_PREFIX` has no trailing slash).
- **Why not Phase 6.** Each is a rate-limit design change; CONTEXT § Specific Ideas keeps the limiter,
  the proxy matcher and `PROTECTED_ROUTES` untouched in this phase.
- **Owner:** Phase 8, with DI-42 (provisioning is where the store selection is exercised for real).

## DI-62 — Multi-write flows are not one SQL transaction

- **Source:** IN-08 (organizer-request approval side effects are unchecked after the status commits),
  IN-11 (two concurrent transfers by the same owner can produce two owners).
- **Why not Phase 6.** Fixing either means moving a flow into one SQL function, a schema change that
  wants Phase 7's concurrency datasets to prove it.
- **Owner:** Phase 7.

## DI-63 — `PATCH /api/clubs/[id]/members/role` can only rewrite organizer to organizer

- **Source:** IN-10.
- **Why not Phase 6.** What roles an owner may assign is a product decision.
- **Owner:** the phase owner.

## DI-64 — Input validation: non-string fields, malformed bodies, string-compared UUIDs

- **Source:** IN-02, IN-03, IN-09.
- **Disposition: RETIRED into F-094** (`.planning/audit/quality/phase-06-slice-defects.md#f-094--handlers-parse-input-without-a-schema`),
  executed by DEC-65 and DEC-66 (06-04, 06-08..06-10). This DI id is retired in favour of the finding.
- **Owner:** F-094 (Phase 6).

## DI-65 — The follow notification's name read (the open half)

- **Source:** 05-REVIEW-FIX "DI-65 (from iteration 1) is partly resolved". The 42P10 half was fixed by
  iteration-3 WR-07. Still open: `users/[id]/follow` reads the target's name on the cookie client,
  where only admins can see another user's row, so friend notifications say "someone".
- **Why not Phase 6.** The fix is a read-scope decision on `users` (which columns another user may
  see), which Phase 7's per-table RLS sweep owns.
- **Owner:** Phase 7 (the open half).

## DI-66 — Club links: POST accepts values PATCH refuses

- **Source:** IN-04.
- **Disposition: RETIRED into F-094**, executed by DEC-66's `ClubLinkFields` rule (06-09).
- **Owner:** F-094 (Phase 6).

## DI-67 — pgTAP tooling and coverage

- **Source:** IN-06 (the mutation harness defers its trap during `db reset`; SIGTERM exits 130, not
  143), IN-19 (pgTAP 050 does not pin the full UPDATE column set on `users`).
- **Why not Phase 6.** Test-tooling and coverage work on surfaces Phase 6 does not change.
- **Owner:** Phase 7 (certification coverage).
- **Extended at the slice-6 close (06-06), from 06-05's SUMMARY.** `scripts/pgtap-mutation-check.sh` mutates
  only `CREATE POLICY` statements in the four migrations it lists. The slice-6 migration creates no policy,
  so its revokes, the friends predicate, the F-093 filters and the `cron_job_status` revoke were proven by
  four manual clause mutations (M1-M4, `evidence/slice-6-mutation-check.txt` § 3). A mutation harness that
  can remove a named clause (REVOKE, a WHERE predicate) from any migration belongs with this item. Same
  owner.

## DI-68 — Approving pending edits is not bound to the version the admin reviewed

- **Source:** IN-07.
- **Why not Phase 6.** It needs a version column or an optimistic-concurrency check on `events`, a
  schema change whose proof is a concurrency dataset.
- **Owner:** Phase 7.

## DI-69 — Proxy matcher and CSRF hardening

- **Source:** IN-12 (the matcher skips `/api/**` paths that end in an image extension, bypassing CSRF
  and the rate limit), IN-16 (the origin check ignores the scheme and default ports), IN-23
  (`POST /auth/signout` is not covered by the CSRF check).
- **Why not Phase 6.** CONTEXT keeps the proxy matcher untouched; the three belong together.
- **Owner:** Phase 8.

## DI-70 — Comment corrections in the seam

- **Source:** IN-13 (the `getRequestContext` rationale misstates `cache` availability), IN-20 (the
  proxy comment misstates how `getUser()` fails).
- **Owner:** Phase 6, 06-12 (it rewrites both files for the request id and the logger).

## DI-71 — Dead production exports: `applyApiRateLimit`, `rateLimitStoreKind`

- **Source:** IN-14.
- **Why not Phase 6.** CONTEXT names `applyApiRateLimit` among the things kept untouched this phase.
- **Owner:** Phase 8, with DI-61.

## DI-72 — The onboarding flag can be set by the user directly

- **Source:** IN-17.
- **Why not Phase 6.** A `users` column-grant change, which travels with DI-54's grant sweep.
- **Owner:** Phase 7, with DI-54.

## DI-73 — Raw DB error messages returned to clients

- **Source:** IN-18.
- **Disposition: RETIRED into F-059**, executed by DEC-75 (06-13, 06-14, 06-17).
- **Owner:** F-059 (Phase 6).

## DI-74 — The events appeal pre-read is an existence oracle and ignores `deleted_at`

- **Source:** IN-21.
- **Why not Phase 6.** The route check is small, but the complete fix (optionally a trigger rule) and
  its proof sit with the RLS and trigger sweep.
- **Owner:** Phase 7.

## DI-75 — Privacy: admin email local parts and private-profile header data

- **Source:** IN-22 (the moderation-reviews listing exposes the local part of admins' emails), IN-24
  (private profiles still expose header data and counts to signed-in non-friends).
- **Why not Phase 6.** Both change what a Validated page shows, which is a product decision (IN-24
  follows F-005 / DEC-48).
- **Owner:** the phase owner.

## DI-76 — `isBanned` treats an unparseable `ban_expires_at` as not banned

- **Source:** IN-25.
- **Why not Phase 6.** The fail-closed change belongs with the ban persona datasets that prove it.
- **Owner:** Phase 7.

## DI-77 — Club owners write `admin_audit_log` rows with actions outside `AuditAction`

- **Source:** IN-26.
- **Why not Phase 6.** An audit-taxonomy decision (widen the enum or stop the writes) with a data
  check over existing rows.
- **Owner:** Phase 7.

---

# Part 3 — Every research assumption, disposed

Source: 06-RESEARCH.md § Assumptions Log.

| Assumption | Claim | Closed by |
|---|---|---|
| A1 | `request.headers.set("x-request-id", …)` in the proxy is forwarded by `NextResponse.next({ request })` | 06-12 (`src/proxy-request-id.test.ts`) |
| A2 | `next build` with `withSentryConfig` and no `SENTRY_AUTH_TOKEN` exits 0 | 06-16 (the token-less CI-env build) |
| A3 | Sentry can run in Jest's node project with an in-memory transport carrying `tags.request_id` | 06-16 (fallback: mock and assert the call arguments) |
| A4 | The development-only `safeParse` keeps zod out of production client chunks | 06-11 (bundle check; fallback: dynamic import) |
| A5 | `supabase functions deploy` bundles `../_shared/*.ts` and resolves `npm:zod` | DI-81 (the owner's first deploy) |
| A6 | Production `/auth/v1/health` and `/storage/v1/status` answer like the local stack's | DI-81 (the owner's first deploy) |
| A7 | The `@sentry/cli` postinstall does not reach the network when the platform package installs | 06-16, installing with `SENTRYCLI_SKIP_DOWNLOAD=1` (06-01's bundle records the postinstall and the platform packages) |
| A8 | `checkAzureOAuth`'s `signInWithOAuth` writes a PKCE cookie on the health response | Moot after 06-17 (the check is removed) |
| A9 | `@sentry/react` 10.x admits React 18.3 | **CLOSED by this plan's bundle:** `@sentry/react@10.75.3` peers `react` "^16.14.0 \|\| 17.x \|\| 18.x \|\| 19.x" (`evidence/sentry-legitimacy.txt` § 7) |

---

# Part 4 — Items plan 06-01 defers

## DI-78 — The webhook has no signed-timestamp replay window

- **Found by:** 06-RESEARCH.md C2 and Open Question 1.
- **What it is.** After 06-03, a replayed valid payload is refused by the `content_hash` unique index
  (reported as `duplicate`), but a signature stays valid forever. A timestamp inside the signed
  material, checked against a window, would bound it.
- **Why deferred.** It changes the signing contract of an external sender nobody in the repository
  controls.
- **Why not cosmetic.** Without it, a captured request for an event that was later deleted can
  re-create it.
- **Owner:** the phase owner (with the sender's operator), recorded beside DI-81's CI deploy.

## DI-79 — @sentry/nextjs v11

- **Found by:** 06-RESEARCH.md C15 (DEC-61).
- **What it is.** v11 replaces `sendDefaultPii` with per-category `dataCollection`, and an unset
  `dataCollection` collects user info, cookies and request bodies. 10.75.3 is the v10 maintenance line.
- **Why deferred.** Taking v11 two days after release with inverted PII defaults is the risk DEC-76's
  "decided before install" posture exists to avoid.
- **Why not cosmetic.** v10 will stop receiving fixes; the upgrade needs an explicit all-false
  `dataCollection` baseline mapped from DEC-76.
- **Owner:** Phase 8.

## DI-80 — A nonce CSP that removes 'unsafe-inline'

- **Found by:** 06-RESEARCH.md § Alternatives; CONTEXT § Deferred Ideas (DEC-77).
- **What it is.** After 06-16 the production CSP has no `'unsafe-eval'` but keeps `'unsafe-inline'`
  for the inline theme script and Next's inline bootstrap. F-055 stays Open at "08" for it (DEC-72).
- **Why deferred.** A nonce needs dynamic rendering of every page and a nonce on the root layout's
  inline script and the landing JSON-LD: a rendering-mode change to every page.
- **Why not cosmetic.** `'unsafe-inline'` is what makes an injected script executable.
- **Owner:** Phase 8.

## DI-81 — Phase 6 deploy prerequisites and human-checks

- **Found by:** 06-01 (DEC-81).
- **What it is.** Every Phase 6 item that needs an owner or a deployment:
  1. the owner's countersignature on `evidence/zod-legitimacy.txt` (DEC-60) and
     `evidence/sentry-legitimacy.txt` (DEC-61);
  2. the first real Sentry event carrying the request correlation id (needs a DSN);
  3. the two-session CDN probe on a preview deploy (F-025's criterion);
  4. the `events-webhook` edge function redeployed from CI, with `WEBHOOK_SECRET` confirmed (F-039's
     deployment-record clause; A5);
  5. `HEALTH_TOKEN` provisioning for uptime monitors, and A6 checked on the first deploy;
  6. the `.env.local.example` update for the variables 06-16 and 06-17 introduce (the server and
     client Sentry DSNs, including `NEXT_PUBLIC_SENTRY_DSN`; `SENTRY_AUTH_TOKEN`; `HEALTH_TOKEN`), which
     this session is denied from reading.
- **Why deferred.** Each is a production or deploy action, or a signature, outside what an executor may
  do in this phase.
- **Why not cosmetic.** Without them the Sentry, CDN and webhook guarantees are proven locally only.
- **Owner:** the phase owner, before Phase 8's deploy.

## DI-82 — The admin batch-scoring route always answers 500 through PostgREST

- **Found by:** 06-04 Task 3 (the async-edge e2e spec, on the reset and seeded local stack).
- **What it is.** `POST /api/recommendations/batch` calls `compute_user_scores()` through the elevated
  door. The function's body begins with `DELETE FROM user_event_scores;` (no WHERE,
  `baseline.sql:159`, and `DELETE FROM tag_interaction_counts;` at `:108`). The `authenticator` role
  that every PostgREST request runs under has `session_preload_libraries=safeupdate` (measured:
  `pg_roles.rolconfig`), so the call fails with `21000 DELETE requires a WHERE clause` and the route
  answers `500 {"error":"Batch scoring failed","details":"DELETE requires a WHERE clause"}`. The
  pg_cron job runs as `postgres` without safeupdate and is unaffected, so scores still refresh every
  6 hours; only the admin's manual trigger is broken. The Jest PRESERVE row (admin → 200) passes
  because the fake rpc has no safeupdate.
- **Why deferred.** The fix changes `compute_user_scores`' body (for example `DELETE … WHERE true`),
  which DEC-68 pins by `md5(prosrc)` and 06-05's pgTAP 070 asserts; it belongs to the plan that owns
  that function, as a DEFECT-then-fix with the md5 pin re-derived, not to a route plan.
- **Why not cosmetic.** An admin-facing control that always fails, with the database error text in the
  body (F-059 territory).
- **Owner:** Phase 6 (06-05 or the slice-6 close, 06-06) to disposition; 06-04 worked around it in the
  e2e fixture only (a service-client score row), with no product-code change.
- **Dispositioned at the slice-6 close (06-06).** Neither 06-05 nor 06-06 changes the function: 06-05's
  text pins its body by md5 and never directs a change, and 06-06 forbids source, test and configuration
  changes. **Owner: Phase 7**, beside the other function-body changes that want its datasets (DI-62,
  DI-68). **Target:** a fix-forward migration that re-creates `compute_user_scores()` with its two
  unqualified deletes written as `DELETE … WHERE true` and nothing else changed; in the same commit,
  070 row 1's md5 is re-derived under a signed amendment to DEC-68 (the breakdown invariant, row 4, keeps
  proving the formula); a DEFECT row first pins today's 500 on the real stack, then moves to 200; and
  `e2e/specs/async-edge.spec.ts` drops its service-client score workaround and calls the admin route.
  Production is the same (PostgREST's `authenticator` preloads safeupdate there too), so the live fix
  travels with DI-23. Until then the 500's `details` text is F-059's to remove (06-13/06-14), and the
  six-hourly pg_cron job, which runs as `postgres`, keeps scores fresh.

---

# Part 5 — Items found by 06-02..06-05, registered at the slice-6 close (06-06)

Source: the Issues, Deviations and Observations sections of `06-02-SUMMARY.md` .. `06-05-SUMMARY.md`
and the evidence they cite, read at the slice-6 close. DI-82 (above) is the first of them. Each new
item has an owner. Items the SUMMARYs name that are not deferrals are listed at the end with the
reason.

## DI-83 — Three malformed webhook payload shapes still answer 500

- **Found by:** 06-02 (`evidence/slice-6-characterization.txt` § 3, rows 7, 11 and 12) and kept by
  06-03 as a recorded decision (`evidence/webhook.txt` § 7: "rows 7, 11 and 12 stay 500").
- **What it is.** A JSON `null` payload, a `null` element in `events`, and a non-string tag each answer
  `500 Internal server error` from `handleWebhook`, where the zod contract could answer 400. The sender
  must already hold the secret, so the reachable effect is a wrong status to an authenticated caller.
- **Why deferred.** 06-03's plan named exactly two intentional webhook changes; this is the webhook's
  share of F-094, and no slice-7 plan lists the webhook among its adoptions.
- **Why not cosmetic.** F-094's criterion is that suites pinning a 500 on malformed input move to 400;
  these three rows are such pins.
- **Owner:** Phase 6, 06-18, which decides F-094's status: either the one-line handler change with a
  ledger row, or these three rows recorded as F-094's stated residue. The live effect travels with
  DI-81's redeploy.
- **Dispositioned at the phase close (06-18): recorded as F-094's stated residue, owner Phase 8.** 06-18's
  plan makes the supabase-js bump (`f4c59e4`) the last code change of the phase, and its tasks do not name
  the webhook, so the handler change is not made here. F-094's criterion is met without it: the criterion
  names route handlers and DEFECT suites, and these three rows are PRESERVE rows of an edge-function suite
  (`src/__tests__/webhook/webhook-handler.test.ts` rows 7, 11, 12). F-094 is Fixed with this residue
  written into its resolution. **Owner: Phase 8**, in the change that deploys `events-webhook` from CI
  (DI-81, DI-84): move the three rows out of PRESERVE into a DEFECT file, let the contract answer 400, and
  ship it with the redeploy, since the handler change is live only then.

## DI-84 — The owner's Deno integration suite for events-webhook has never run in this program

- **Found by:** 06-03 (`evidence/webhook.txt` § 1: `command -v deno` exit 1).
- **What it is.** `supabase/functions/tests/webhook.test.ts` was updated for the two changed rows (a
  wrong-length test, a right-length test, a replay test, `content_hash` on the success row) but not run:
  Deno is absent locally and no CI job runs it. Its pre-existing "Invalid signature returns 401" test
  sent a 23-character signature and was already failing (500) against the deployed function.
- **Why deferred.** Running it needs Deno and a served edge runtime, which neither the executor host nor
  CI provides; the Jest suites prove the Deno-free handler instead.
- **Why not cosmetic.** The adapter (`index.ts`, `deno.json`'s `npm:zod@4.6.5` mapping, `_shared`
  bundling, research A5) is proven only by the owner's first deploy.
- **Owner:** Phase 8, with DI-81: the CI job that deploys `events-webhook` runs this suite first.

## DI-85 — The Playwright suite leaves a wall-clock `updated_at` on a seeded user, so pgTAP 040 row 20 fails until the next reset

- **Found by:** 06-05 (`evidence/schema-push-slice-6.txt` § 13). Phase 5 met the same residue and reset
  it without registering it (`schema-push-slice-5.txt` row 20).
- **What it is.** The specs write to seeded users, `update_users_updated_at` stamps `now()`, and
  `040-seed-coverage` row 20 ("every seeded user carries the pinned stamp, not a wall-clock one") then
  fails. Every floor resets and re-seeds before pgTAP, so no gate is affected.
- **Why deferred.** The fix is harness hygiene (per-spec cleanup, or a seed-coverage pin that tolerates
  harness writes), which is Phase 7's dataset work.
- **Why not cosmetic.** A developer who runs pgTAP after Playwright sees a red seed pin that is not a
  regression.
- **Owner:** Phase 7 (datasets and the harness reset discipline).

## DI-86 — CLOSED by record: the characterization tag gate was red on HEAD after 06-03

- **Found by:** 06-04 (`06-04-SUMMARY.md` Issues): `src/__tests__/webhook/verify-signature.test.ts` and
  `webhook-handler.test.ts` named neither PRESERVE nor DEFECT, so the CI step "Characterization tag gate"
  failed.
- **Closed by:** the orchestrator's `57cb55f` (docblock-only; both suites PRESERVE, citing F-039). The
  gate reads `ok 44 files` at the slice-6 close (`evidence/floor.slice-6-after.txt` block 7).
- **Owner:** none (closed).

## DI-87 — Three GET routes always answer 500 on the reset schema

- **Found by:** 06-15 Task 3 (the live header sweep, `evidence/cache-e2e.txt` § 3.3). Their headers are
  correct (`private, no-store`, a request id); the bodies are the defect.
- **What it is.**
  (a) `GET /api/admin/clubs` selects `*, users!created_by(name, email)`; `clubs.created_by` has no
  foreign key to `users`, so PostgREST answers `PGRST200` and the admin gets 500.
  (b) `GET /api/admin/organizer-requests` selects `*, club:clubs(*), user:users(*)`;
  `organizer_requests` has two foreign keys to `users` (`user_id`, `reviewed_by`), so the embed is
  ambiguous (`PGRST201`). The route logs nothing: a silent 500.
  (c) `GET /api/user/engagement` reads `user_engagement_summary`, which no migration declares since
  03-04 retired its migration (F-048 closed on that disjunct), so it answers `PGRST205` and 500.
  (a) and (b) are the embed class F-092 fixed on `/api/admin/reports`. Reproduced on the local stack with
  the routes' own select strings (the evidence quotes both probes).
- **Why deferred.** A select or schema change on three handlers, outside 06-15's allowed files; no
  earlier spec drove these reads as their authorized persona.
- **Why not cosmetic.** The admin club list, the organizer-request queue and the engagement read are
  broken for every caller whose request reaches the query; production has the same schema.
- **Owner:** Phase 7 (the persona matrix drives every GET as its authorized persona), or the phase owner
  if registered as findings first.

## DI-88 — A failed club-detail read answers a shareable 404

- **Found by:** 06-13 (threat flag `cached-404`), observed in shape by 06-15
  (`evidence/cache-e2e.txt` § 4).
- **What it is.** `GET /api/clubs/[id]` is `public-60-300`, and a public class shares a 404 (06-12:
  Vercel caches 404s). The route answers 404 both for an unknown id and when its database read errors,
  so a transient database error on a real club is cached by the CDN for up to 60 s plus
  stale-while-revalidate. 06-15's stand-in shows the class behaviour (an unknown id: MISS, then HIT);
  the error trigger needs a fault the local stack cannot inject without editing the route.
- **Why deferred.** The fix is a status change on an error path (a read error answering 500, which the
  wrapper makes private), a behaviour change outside 06-15's files.
- **Why not cosmetic.** A 60-second club-page outage from one failed read, served to every visitor.
- **Owner:** Phase 7 (error-path sweep), or the phase owner.

**Also extended:** DI-67 (the mutation harness covers only `CREATE POLICY`; see its section).

**Named in the SUMMARYs and not deferrals:** F-078's fuzzy-search 0A000 in the Playwright server log
(already a finding, Open at "08"); the two λ 0.7 constants in `recommendations/route.ts` pinned by
different rows (06-02 § 2, a note on the source, both pinned); the census's R3 total 54 against C4's 59
(itemized in `evidence/contracts-slice-6.txt` [1.4]); `allowImportingTsExtensions` in `tsconfig.json`
(06-03, a recorded Rule 3 fix); the `ExtractedEvent` drift guard firing under `tsc` rather than Jest
(CI runs `tsc`); and `state.add-decision` refusing scratchpad paths (GSD tooling, not this project).

---

~~**Next new item id: DI-89.** (DI-87 and DI-88 added by 06-15.)~~ Superseded by Part 6.

---

# Part 6 — Items found by 06-07..06-17, registered at the phase close (06-18)

Source: the Issues, Deviations, Observations and Threat Flags sections of `06-07-SUMMARY.md` ..
`06-17-SUMMARY.md`, read at the phase close. DI-87 and DI-88 were registered by 06-15 (Part 5). Every
item below has an owner. Items those SUMMARYs name that are not deferrals are listed at the end with the
reason.

## DI-89 — `events/[id]` PATCH stores `rsvp_link` and `price` as sent

- **Found by:** 06-08 (`06-08-SUMMARY.md` § Observations, "Not in scope, noticed").
- **What it is.** The create route length-checks `price` and refuses a non-http(s) `rsvp_link`; the PATCH
  route writes both as sent. A PATCH can store a `javascript:` link that create would refuse, and the
  event page renders it as a link.
- **Why deferred.** A new refusal on a write route is a behaviour change no Phase 6 plan named; 06-08
  preserved the handler's rules byte for byte (DEC-65).
- **Why not cosmetic.** A stored script URL on a public page.
- **Owner:** Phase 7 (register as a finding at the start, then fix with a DEFECT pin), or the phase owner.

## DI-90 — `users/[id]` PATCH accepts any URL scheme for `avatar_url` and `banner_url`

- **Found by:** 06-09 (`06-09-SUMMARY.md` § Observations).
- **What it is.** `UserUpdateBody` checks these with `new URL()`, as the handler did, so `javascript:x`
  and `data:` values are stored. They render as image sources, not links.
- **Why deferred.** Same reason as DI-89: a new refusal on a write route.
- **Why not cosmetic.** Arbitrary-scheme URLs stored on every profile; the rendering context is what keeps
  them inert today.
- **Owner:** Phase 7, with DI-89.

## DI-91 — `users.visibility` is an unconstrained text column

- **Found by:** 06-11 (`06-11-SUMMARY.md` § Issues).
- **What it is.** `users.visibility` is `text DEFAULT 'public'` with no CHECK constraint
  (`supabase/migrations/20260915214553_baseline.sql`), while the PATCH contract accepts only `"public"` or
  `"private"`. A stored value outside the two is sent back by the profile form and answered 400, as before
  the contract.
- **Why deferred.** A CHECK constraint is a schema change that needs a data check over existing rows.
- **Why not cosmetic.** A profile holding such a value cannot save any edit.
- **Owner:** Phase 7 (schema and datasets).

## DI-92 — `EventAnalytics.rsvp_cancelled` is declared but never sent

- **Found by:** 06-11 (`06-11-SUMMARY.md` § Issues).
- **What it is.** `src/types/index.ts` declares `rsvp_cancelled` on `EventAnalytics`, but
  `GET /api/events/[id]/analytics` never sends it (the club analytics route does). `useEventAnalytics` has
  no consumer today; `EventAnalyticsResponse` lists what is sent.
- **Why deferred.** Either the type or the route changes; neither is a Phase 6 requirement.
- **Why not cosmetic.** A consumer written against the type would read `undefined`.
- **Owner:** Phase 7 (types kept in sync with the wire, per CLAUDE.md).

## DI-93 — Database errors answered as a 500 without a log line

- **Found by:** 06-13 (threat flag `silent-500s`).
- **What it is.** Many handlers answer `{"error":"Internal server error"}` or `Failed to …` on a database
  error without logging it. The wrapper logs and captures only an uncaught throw, so these failures are
  invisible in logs and in Sentry. 06-13 and 06-14 converted the existing console calls; they did not add
  a log line where none existed.
- **Why deferred.** A logging sweep across every handler's error branch, outside the plans' allowed edits.
- **Why not cosmetic.** REFAC-21's purpose is that a production failure becomes visible; a caught database
  error is the common one.
- **Owner:** Phase 7 (the error-path sweep, with DI-88), or Phase 8 (operational certification).

## DI-94 — Client IP addresses in the rate-limit store's log lines

- **Found by:** 06-12 (threat flag `pii-in-logs`).
- **What it is.** `src/server/ratelimit/upstashStore.ts`'s store-timeout and store-error lines keep the
  `key` field, `METHOD:path:client-ip`. The logger redacts named secrets and email-shaped text, not IP
  addresses. 06-16's `docs/observability.md` does not record a decision.
- **Why deferred.** The key's shape belongs to the rate-limit design (DI-61), which CONTEXT kept untouched.
- **Why not cosmetic.** An IP address is personal data in the logs.
- **Owner:** Phase 8, with DI-61 (log only the method and path, or hash the address), or the owner's
  explicit acceptance.

## DI-95 — A CDN-cached public response replays the first request's `x-request-id`

- **Found by:** 06-12 (threat flag `cached-correlation-id`).
- **What it is.** The eleven public GET classes are shareable, so on a CDN hit a later client receives the
  `x-request-id` of the request that filled the cache. It is not a secret, but a correlation id read from
  a cache hit points at another request's log lines. `docs/observability.md` does not say so.
- **Why deferred.** Only observable on the real CDN (DI-81's probe host); the fix is a documentation line
  or a CDN-side header rule.
- **Why not cosmetic.** An operator correlating a user's report through a cached response reads the wrong
  lines.
- **Owner:** Phase 8 (record it in `docs/observability.md` when the real CDN is probed).

## DI-96 — `save-and-rsvp.spec.ts:53` failed once in 06-08

- **Found by:** 06-08 (`06-08-SUMMARY.md` § Issues, Playwright run 1 of 2).
- **What it is.** The awaited save answered and the row landed, but the control still read "Save". The
  likely cause is `EventDetailClient`'s mount-time `checkSaved` GET resolving after the toggle and setting
  the state back. It passed on the second fresh reset and in every floor since, including this phase's
  after-floor (`evidence/playwright.phase-after.txt`).
- **Why deferred.** A client race outside every Phase 6 plan's files, seen once.
- **Why not cosmetic.** A user who saves an event right after the page loads can see it flip back.
- **Owner:** Phase 7 (harness flake triage, and the component's request ordering).

## DI-97 — `admin/events` POST checks `start_date` and `end_date` for presence only

- **Found by:** 06-10 (`06-10-SUMMARY.md` § Observations).
- **What it is.** A number passes the presence check and reaches the insert, as it did before the contract,
  which kept the handler's rule.
- **Why deferred.** A new 400 on an admin write, outside 06-10's byte-preserving scope.
- **Why not cosmetic.** A malformed date reaches the database as a 500.
- **Owner:** Phase 7, with DI-89.

## DI-98 — The failed-sign-in redirect carries the provider's error text

- **Found by:** 06-14 (`06-14-SUMMARY.md` § Measured differences; threat flag `redirect-error-text`).
- **What it is.** `src/app/auth/callback/route.ts` redirects a failed code exchange to
  `/?error=auth_failed&message=<exchangeError.message>`. The PRESERVE callback suite pins it, and the
  callback plan could change only logging and the wrapper, so it stays as the one reasoned S2 entry in
  `scripts/server-console-allowlist.json`. It goes to the browser that started the sign-in, not to a
  response body, so F-059's criterion is met without it (F-059 resolution).
- **Why deferred.** Changing it moves a PRESERVE pin on the sign-in path, a Validated workflow.
- **Why not cosmetic.** Provider error text in a URL reaches browser history and referrers.
- **Owner:** Phase 7 (the decision, and a DEFECT move if the text goes).

## DI-99 — The moderation-reviews banned-admin refusal has no real-stack test

- **Found by:** 06-17 (`06-17-SUMMARY.md` § Issues and notes).
- **What it is.** The reviews route's admin path now runs `requireActiveUser`, pinned by a unit row in
  `src/__tests__/api/service-role-routing.test.ts`. The seed has no banned-admin persona, so no spec drives
  it end to end; adding one would move rows other specs read.
- **Why deferred.** A new persona is dataset work.
- **Why not cosmetic.** The refusal is proven only against the fake.
- **Owner:** Phase 7 (persona datasets).

**Named in the 06-07..06-17 SUMMARYs and not deferrals:** the two PRESERVE tree scans moved into DEFECT
suites by 06-13 (`admin-arm-tree-defect.test.ts`, `write-arm-tree-defect.test.ts`) and the batch
error-text row moved by 06-14 (`batch-error-text-defect.test.ts`), each with ledger rows and accepted by the
orchestrator (decisions, recorded in `evidence/PHASE-6-COMPLETION.md` § 6); 06-17's `getsession-gate`
tightening to an empty list (the suite's anticipated change); `with-timeout.sh`'s orphaned watcher (session
tooling, since fixed, not this project); the Supabase CLI update notice; F-078's fuzzy-search 0A000 and
F-081's unmapped-tags line in the Playwright server log (findings already, Open at "08"); zsh
word-splitting and bash 3.2 `mapfile` (executor scripting); the Sentry event's `server_name` (a function
host, not personal data, 06-16).

---

# Part 7 — Final state of every item at the phase close (06-18)

| Item | Final state | Evidence | Owner after Phase 6 |
|---|---|---|---|
| DI-21 | **CLOSED** by `d6e8489` (06-16): the CSP admits the local Supabase origin at config evaluation and the harness runs with `bypassCSP: false` | `evidence/csp.txt`; the full suite under the enforced CSP in `evidence/playwright.phase-after.txt` | — |
| DI-22 | Unchanged | — | the phase owner |
| DI-23 | **Open**, binding: nothing was pushed. 06-05's migration and F-074, F-075, F-076, F-093 wait for it | `evidence/PHASE-6-COMPLETION.md` § 7 | Phase 8 |
| DI-25 / DI-53 | **CLOSED**: the four admin payloads retyped by `f869323` (06-10); `@supabase/supabase-js` 2.116.0 exact by `f4c59e4` (06-18), after a throwaway-worktree tsc with 0 errors | `evidence/di-53-bump.txt` | — |
| DI-26 | **CLOSED**: `vercel.json` has no `headers` (`6221669`); `/api/events` is `public-30-60` explicitly; the cross-user spec and the live sweep pass (`eaed119`, `64939b2`) | `evidence/cache-e2e.txt` § 3.3 | — |
| DI-27, DI-29 | Unchanged | — | the phase owner; Phase 7 |
| DI-33 | Cron half CLOSED (06-06); bucket half unchanged | `evidence/slice-6-close.md` § 7 | Phase 8 (buckets) |
| DI-39, DI-40, DI-41 | Unchanged (owner decisions) | — | the phase owner |
| DI-42 | **Open**, owner action before any push to `main` (Upstash) | `evidence/PHASE-6-COMPLETION.md` § 8 | the phase owner |
| DI-43 | Unchanged: `@supabase/ssr` stays 0.7.0; its peer range admits 2.116.0 | `evidence/di-53-bump.txt` block 11 | Phase 8 |
| DI-44 | Code half CLOSED (06-04); the anon-role probe stays | `evidence/slice-6-close.md` § 7 | Phase 7 (probe) |
| DI-45 | **CLOSED** by `4ad1fae` (06-12): a warn line when the user lookup fails with anything but a missing session | `evidence/logger-foundation.txt` | — |
| DI-46 | **Open, awaiting the owner**: the patch is prepared and not applied; no signed authorization exists (see its Part 1 row) | `evidence/claude-md-corrections.patch` | the phase owner |
| DI-47 | **Partly done** by 06-14's comment sweep. (a), the inferred-tags 404, is reachable and stays with a comment; (b) names files 06-14 did not touch | `06-14-SUMMARY.md` § Measured differences | Phase 7 |
| DI-49, DI-51 | Unchanged | — | the phase owner |
| DI-50 | CLOSED by record (06-01) | — | — |
| DI-54 | Unchanged | — | Phase 7 |
| DI-55 | **CLOSED** by `00aa06d` (06-17): `requireAdminPage` in the admin, moderation, docs and health layouts; the reviews route's admin path runs `requireActiveUser` | `evidence/admin-page-gates.txt` | — (real-stack gap is DI-99) |
| DI-56, DI-57 | Unchanged (visual changes) | — | the phase owner |
| DI-58 | **CLOSED** by `83e2f7e` (06-15): (a) and (b) regenerated through the classifier | `evidence/contract-regen-slice-7.txt` | — |
| DI-59 | **Carried**: (a)-(c) name files 06-14 did not touch | `06-14-SUMMARY.md` | Phase 7, with DI-47(b) |
| Phase 2 residuals | Renovate unchanged. The production audit gate exits 0 at the phase close: 0 critical, 0 high, 2 moderate (`dompurify`, `yaml`) and 1 low (`@babel/core`, an advisory published during the phase on a package no Phase 6 install touched) | `evidence/floor.phase-after.txt` block 4 | the phase owner |
| DI-60 | Vacant by record | — | — |
| DI-61, DI-69, DI-71 | Unchanged | — | Phase 8 |
| DI-62, DI-65, DI-67, DI-68, DI-72, DI-74, DI-76, DI-77 | Unchanged | — | Phase 7 |
| DI-63, DI-75 | Unchanged | — | the phase owner |
| DI-64 | Retired into F-094; executed by `f869323` (canonical ids at ban and role change); **F-094 Fixed** | findings.json F-094 | — |
| DI-66 | Retired into F-094; executed by `4f918ae` (`ClubLinkFields`); **F-094 Fixed** | findings.json F-094 | — |
| DI-70 | **CLOSED** by `4ad1fae` (06-12): both comments corrected | `evidence/logger-foundation.txt` | — |
| DI-73 | Retired into F-059; **F-059 Fixed** | findings.json F-059 | — |
| DI-78 | Unchanged (the sender's signing contract) | — | the phase owner |
| DI-79 | Unchanged (Sentry v11) | — | Phase 8 |
| DI-80 | Unchanged; F-055 Open at "08" for it | findings.json F-055 | Phase 8 |
| DI-81 | **Open**: every item is an owner action, listed in order as the Phase 8 deploy prerequisites | `evidence/PHASE-6-COMPLETION.md` § 8 | the phase owner, before Phase 8 deploys |
| DI-82 | Unchanged since 06-06 (Phase 7 with a target); the batch 500 no longer carries the error text (`6221669`, F-059) | `src/__tests__/api/recommendations/batch-error-text-defect.test.ts` | Phase 7 |
| DI-83 | **Re-dispositioned**: F-094's stated residue, owner Phase 8 with the webhook redeploy (see its section) | findings.json F-094 | Phase 8 |
| DI-84 | Unchanged | — | Phase 8, with DI-81 |
| DI-85 | Unchanged; the phase after-floor ran pgTAP before Playwright and reset afterwards | `evidence/floor.phase-after.txt` | Phase 7 |
| DI-86 | CLOSED by `57cb55f` | — | — |
| DI-87, DI-88 | Unchanged since 06-15; DI-87's three 500s appear, as recorded, in the phase after-floor's header sweep | `evidence/playwright.phase-after.txt` | Phase 7 |
| DI-89..DI-99 | New (Part 6) | Part 6 | as listed |
| A1 | **CLOSED** (06-12): a proxy `request.headers.set` is forwarded | `evidence/logger-foundation.txt` [2.1] | — |
| A2 | **CLOSED** (06-16): the build with `withSentryConfig` and no token exits 0; re-run at the phase close | `evidence/build-ci-env.txt`; `evidence/floor.phase-after.txt` block 8d | — |
| A3 | **CLOSED** (06-16): the real SDK runs in Jest with an in-memory transport built by `Sentry.createTransport` and the event carries `tags.request_id` | `evidence/sentry.txt` §§ 1, 7 | — |
| A4 | **CLOSED** (06-11): no zod symbol in the production client chunks, with a positive control | `evidence/client-contracts.txt` [2.7]-[2.8] | — |
| A5, A6 | **Open**: proven only by the owner's first deploy | — | DI-81 |
| A7 | **CLOSED** (06-16): installed with `SENTRYCLI_SKIP_DOWNLOAD=1`, no binary fetched | `evidence/sentry-install.txt` | — |
| A8 | Moot: the OAuth check is deleted (06-17) | `evidence/health.txt` | — |
| A9 | CLOSED by 06-01's bundle | `evidence/sentry-legitimacy.txt` § 7 | — |

**Next new item id: DI-100.** (DI-89..DI-99 added by 06-18.)


*Phase: 06-slices-6-7-async-edge-contracts-caching-observability*
*Plans: 06-01 (opened), 06-06 (Part 5), 06-15 (DI-87, DI-88), 06-18 (Parts 6 and 7)*
