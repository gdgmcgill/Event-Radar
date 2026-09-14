---
phase: 01-read-only-foundation-audit
plan: 10
subsystem: infra
tags: [supabase-storage, rls, pg_cron, vercel, edge-functions, webhooks, hmac, audit, read-only]

# Dependency graph
requires:
  - phase: 01-06
    provides: "the SELECT-only production capture envelopes under .planning/audit/raw/prod/ — storage-buckets, storage-policies, cron-job, cron-job-run-details, extensions, functions, row-counts, tables, auth-config-tables"
  - phase: 01-07
    provides: "authz/fail-open-register.md — FO-01 through FO-05, the env-conditional authorization population this plan resolves against production configuration"
  - phase: 01-08
    provides: "schema/drift.md — the prod-only classification for 3 buckets and 3 pg_cron jobs that this plan extends"
  - phase: 01-01
    provides: "BLOCKING-INPUTS.md § 4, REDACTION.md, SEVERITY_SLA.md, tools/validate.mjs and tools/readonly-guard.sh"
provides:
  - "AUDIT-18: live capture and review of all 4 storage buckets and all 15 storage.objects policies, each bucket answered on read visibility, path-prefix ownership, and size/MIME limits"
  - "AUDIT-11: live pg_cron job and run-history capture, plus an inventory reaching an explicit verdict on all six named asynchronous entry points"
  - "ST-01: club-logos cross-tenant overwrite — any authenticated user can replace any club's logo or banner (High)"
  - "CW-01: /api/cron/send-reminders has no trigger and an open credential check in production (High)"
  - "CW-02: the email half of a Validated workflow does not exist in any implementation (High)"
  - "An environment-variable name census cross-referenced against the three names actually configured on the production Vercel project"
  - "Confirmation that FO-01 (Critical) and FO-02 (High) are live in production rather than conditional"
affects: [01-11, 01-12, 01-13, REFAC-01, REFAC-13, Stage-3-club-authorization, Stage-4-certification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived audit artifacts are bare JSON arrays whose every row carries its own captured_at/transport/source/source_query stamp, so a row remains self-describing when quoted out of context"
    - "A redaction sweep result is only evidence if a positive control ran alongside it; a non-zero count is classified by shape and shown, never scrubbed into a zero"

key-files:
  created:
    - .planning/audit/storage/buckets.json
    - .planning/audit/storage/storage-policies.json
    - .planning/audit/storage/storage-review.md
    - .planning/audit/async/cron-job.json
    - .planning/audit/async/cron-job-run-details.json
    - .planning/audit/async/extensions.json
    - .planning/audit/async/vercel-crons.md
    - .planning/audit/async/cron-webhook-inventory.md
    - .planning/audit/redaction/01-10.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The two /api/cron/* handlers are redundant dead code, not a broken schedule — pg_cron runs in-database reimplementations of both, so the remediation is deletion or a fail-closed guard, never scheduling them"
  - "The Vercel env-name capture converts two hedged fail-open rows into observed production state: CRON_SECRET and ADMIN_API_KEY are not configured, so FO-02 and FO-01 are live"
  - "club-logos is the highest-severity storage finding and is a bucket no requirement named — reviewing only the two named buckets would have missed it"
  - "The email half of the Validated 'in-app notifications and email reminders' workflow does not exist in any implementation"
  - "The user_event_scores anomaly is filed as an open question, not a finding, because n_live_tup is an estimate and a batch job legitimately truncates and refills"
  - "Pattern 4 of the redaction sweep returned 3 and was classified rather than scrubbed, because the matching string IS the finding"

patterns-established:
  - "Verdict-per-source inventory: every named asynchronous entry point gets its own heading and an explicit Verdict line, and an unreachable answer is recorded as a bounded gap with the exact command that would close it"
  - "Negative findings are recorded with the same weight as positive ones — avatars' correct ownership and event-images' NULL-denied writes are stated so a reader can tell the findings were reached by examination rather than by assuming the worst"
  - "Cross-source inventorying: source one and source two had to be read together, because either alone produces a plausible and wrong recommendation"

requirements-completed: [AUDIT-11, AUDIT-18]

# Metrics
duration: 22 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 10: Storage and Asynchronous Edge Summary

**Four public storage buckets reviewed against their 15 live object policies — finding a cross-club overwrite path in a bucket no requirement named — and every asynchronous entry point given a verdict, proving the two cron handlers are untriggered dead duplicates of three `pg_cron` jobs that have been doing the work all along.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-14T19:53:00Z
- **Completed:** 2026-09-14T20:15:00Z
- **Tasks:** 3 (one of them a checkpoint, resolved by an API capture — see Deviations)
- **Files created:** 9 (all under `.planning/audit/`)

## Accomplishments

- **AUDIT-18 answered for four buckets, not the two the requirement named.** The live catalog returns `avatars`, `banners`, `club-logos` and `event-images`; each has a review section answering read visibility, path-prefix ownership and size/MIME limits, with a proposed severity and an exposure rationale.
- **Found ST-01 (High): any authenticated user can overwrite any club's logo or banner.** `club-logos`' INSERT and UPDATE policies test only `bucket_id` and `auth.role()`, with no ownership predicate. Both upload routes perform a genuine `club_members` owner check — which is bypassed simply by not using the route, because the caller holds a session token that addresses the Storage REST API directly. This is in the one bucket the requirement did not name.
- **AUDIT-11 answered with an explicit verdict on all six sources**, plus GitHub Actions, in an 11-row consolidated table giving every entry point a trigger status, a credential, a fail-closed answer and a severity.
- **Overturned the plan's premise with evidence.** The plan expected "nothing triggers the reminder handlers → the Validated workflow is silently broken." Nothing does trigger them (proved three independent ways), but the workflow is live: `pg_cron` runs `send_event_reminders()` every 15 minutes and `send_feedback_requests()` every 30, 97 successful runs and zero failures in the captured window.
- **Found the finding the requirement was actually reaching for (CW-02, High): no email is sent by anything.** No email-provider dependency exists in the project. Both implementations only insert in-app `notifications` rows, while the table name `email_reminder_log`, the route name `send-reminders`, and PROJECT.md's Validated line all assert otherwise.
- **Confirmed FO-01 (Critical) and FO-02 (High) are live, not conditional.** `../raw/vercel/env-names.json` shows exactly three variables configured in production. `CRON_SECRET` and `ADMIN_API_KEY` are not among them, so `/api/cron/send-reminders` really does compare against `Bearer undefined`, and `/api/admin/calculate-popularity`'s admin gate really is skipped entirely — both in front of service-role clients. Plan 01-07 had to hedge on exactly this.
- **Settled the `compute_user_scores` question from the live capture.** The job exists in the database (jobid 2, `0 */6 * * *`, active, 3/3 succeeded), *not* merely as the commented-out `cron.schedule(...)` line in `20260313000002_recommendation_engine.sql`.

## Task Commits

1. **Task 1: Capture and review the storage buckets and their object policies** — `c0b79d6` (feat)
2. **Task 2: Supply the deployment platform's scheduled-job list** — `c30425b` (docs)
3. **Task 3: Capture live scheduled jobs and reach a verdict on every asynchronous entry point** — `c1a0e05` (feat)

**Plan metadata:** see the `docs(01-10)` commit that carries this file.

## Files Created/Modified

- `.planning/audit/storage/buckets.json` — 4 live buckets with public flag, size limit, MIME allow-list, and a derived `declared_in_migration` flag
- `.planning/audit/storage/storage-policies.json` — 15 `storage.objects` policies with derived `bucket_scope`, `has_ownership_predicate`, `write_without_ownership_predicate`, and `with_check_defaulted_from_using`
- `.planning/audit/storage/storage-review.md` — the AUDIT-18 review: one section per bucket, a bucket-agnostic policy section, a drift table, and 7 finding candidates (ST-01…ST-07)
- `.planning/audit/async/cron-job.json` — 3 scheduled jobs with derived run counts, status tallies and last-run outcomes
- `.planning/audit/async/cron-job-run-details.json` — 100 runs over a complete 16-hour window, zero failures
- `.planning/audit/async/extensions.json` — 77 extensions, 7 installed; records that `pg_net` is **not** installed
- `.planning/audit/async/vercel-crons.md` — the deployment platform's cron state, its provenance, and the three mechanical negatives
- `.planning/audit/async/cron-webhook-inventory.md` — the AUDIT-11 inventory: six verdicts, the env-name census, the consolidated table, CW-01 and CW-02
- `.planning/audit/redaction/01-10.md` — the per-plan redaction ledger, including the one non-zero sweep count and its classification
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — position, decisions, blocker, progress, and AUDIT-11/AUDIT-18 marked complete

## Decisions Made

- **The remediation for the dead cron handlers is deletion or a fail-closed guard, never scheduling them.** The live `pg_cron` functions and the dead handlers diverge on four points; three produce duplicate user-visible notifications if both run. They write different notification `type` strings (`reminder_24h` vs `event_reminder_24h`) so neither dedup can see the other's sends, and the handler dedups against `email_reminder_log`, which has **0 rows** — so its first run would re-notify every user `pg_cron` already notified.
- **All four buckets were reviewed, not the two named.** The requirement was written from the repository, and the repository knows about one bucket. The most severe finding is in a bucket that appears in no migration.
- **`user_event_scores` at 0 rows is an open question, not a finding.** `row-counts.json` reports `n_live_tup`, an autovacuum estimate that legitimately reads 0 for a table a batch job truncates and refills. Filing it as a finding on that evidence would produce exactly the contested, deprioritised finding this audit's own research warns about. One query settles it, and the query is recorded.
- **Sweep pattern 4 returned 3 and was classified rather than scrubbed.** All three matches are in the inventory: one is the literal `Bearer undefined` and two are the unexpanded `Bearer ${process.env.CRON_SECRET}`. Redacting them would satisfy the sweep and delete the finding, since the attack string and the finding text are the same seven characters.
- **No production HTTP endpoint was contacted.** Probing a cron handler's gate to see whether it is open is itself an unauthenticated write attempt against production. Every credential claim is read from source and cross-referenced to `fail-open-register.md`.

## Deviations from Plan

### 1. [Resolved checkpoint] Task 2's human-action gate was satisfied by an API capture

- **Task:** 2 — "Supply the deployment platform's scheduled-job list"
- **Planned:** a `checkpoint:human-action` halting for an operator to read *Vercel Dashboard → Settings → Cron Jobs* and paste the list.
- **Actual:** the orchestrator had already captured the same state through the Vercel REST API (`GET /v9/projects/{id}`, read-only), committed as `.planning/audit/raw/vercel/project.json`. The checkpoint was treated as resolved and the plan ran to completion without halting.
- **Why this is an upgrade rather than a shortcut:** `data.crons` is the field the settings page renders. The capture additionally carries `enabledAt`, `disabledAt`, `updatedAt` and `deploymentId`, which the page does not surface — and those are what let the artifact say the empty list is *current and causal* (recomputed from the deployed `vercel.json` at the current production deployment) rather than merely unpopulated.
- **Recorded in:** `async/vercel-crons.md` § 2 and `redaction/01-10.md` § 3, both stating the substitution explicitly. Same class of deviation as 01-06's database transport.
- **Committed in:** `c30425b`

### 2. [Rule 2 — Missing critical] The env-name census was added to the AUDIT-11 inventory

- **Found during:** Task 3
- **Issue:** The plan asked whether each handler's credential check is "live", but the artifact that answers it — `raw/vercel/env-names.json` — is not in the plan's `read_first`. Without the cross-reference, the inventory would have repeated 01-07's hedge ("whether the variable is set in production is not knowable") when the answer was on disk.
- **Fix:** Added § 7, a full census of every `process.env` / `Deno.env.get` name in `src/`, `scripts/`, `next.config.js` and `supabase/functions/`, cross-referenced against the three names configured on the production project.
- **Result:** three of six application-level names are unconfigured, and in two of those three the code's response to absence is to weaken or remove an authorization check. This converted FO-01 from Critical-conditional to Critical-observed.
- **Committed in:** `c1a0e05`

### 3. [Rule 2 — Missing critical] The plan's stated premise was contradicted and the contradiction was documented

- **Found during:** Task 3
- **Issue:** The plan's objective asserts that if nothing triggers the reminder handlers, a Validated workflow is silently broken. Reading `raw/prod/functions.json` showed the two `pg_cron` jobs are complete reimplementations of those handlers, so the premise is false.
- **Fix:** Rather than quietly answering the narrower question, the inventory opens by stating the premise is wrong and why, then documents the four-point divergence between the two implementations and the naming-vs-behaviour gap (CW-02) that the original framing would have hidden.
- **Why this was not a Rule 4 escalation:** it changes no architecture and reverses no plan decision — it corrects a factual assumption using the evidence the plan itself directed the capture of. The plan's deliverable (a verdict per source) is unchanged; only the conclusion moved.
- **Committed in:** `c1a0e05`

---

**Total deviations:** 3 (1 resolved checkpoint, 2 Rule 2 additions)
**Impact on plan:** No scope creep. Every added element serves an acceptance criterion the plan already carried — the census answers "what credential it requires and how it behaves when unset", and the divergence analysis answers "whether anything actually fires each entry point". All `files_modified` are exactly as specified; nothing outside `.planning/` was created, modified, or read for write.

## Issues Encountered

- **The redaction sweep fired for the first time in this phase.** Pattern 4 returned 3 rather than 0. Resolved by mechanical classification (counts only, never printing a matching line): 1 × `Bearer undefined`, 2 × unexpanded `Bearer ${process.env.CRON_SECRET}`, 0 unclassified, and a residual check for `Bearer` followed by 16+ token characters returning 0 across all eight artifacts. Recorded in `redaction/01-10.md` § 6.1 with a proposed phase-gate rule, rather than the ledger being quietly amended to say "clean".
- **Two bounded gaps could not be closed read-only**, and are recorded with the exact commands that would close them rather than guessed at: whether the `events-webhook` edge function is deployed (no capture enumerates deployed functions), and whether any GoTrue auth hook is configured in the dashboard (the `pg-functions://` form is ruled out by the function catalog; the HTTP form is dashboard state).
- **Three pre-existing validator failures are out of scope and were not touched:** `schema-snapshots` on the staging and local dumps (blocked on Docker per `BLOCKING-INPUTS.md` § 3) and `endpoints :: no-residual-placeholders` (the classification pass is owned by plan 01-11, as `fail-open-register.md` FP-01 already states). `--check storage` and `--check cron` both pass with 13/13 and 7/7.

## Known Stubs

None. Every artifact is populated from a committed live capture; no placeholder, mock value, or "to be determined" row appears in any of the nine files.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: tampering | `src/app/api/clubs/logo/route.ts`, `src/app/api/clubs/banner/route.ts` | Route-level club-owner authorization with no corresponding storage-policy predicate — a trust boundary enforced in one layer only, and the bypass requires no exploit, just a different client. Not in the plan's threat model as a *route* surface; T-01-10-02 covered only the policy side. |
| threat_flag: spoofing | `supabase/functions/events-webhook/index.ts` | No replay protection and no deduplication on an HMAC-authenticated ingestion endpoint. T-01-10-05 covered whether the secret is verified before the body is processed (it is); replay of a validly-signed payload is a distinct surface the model did not name. |
| threat_flag: information-disclosure | `scripts/upload-images.ts`, `scripts/fix-instagram-images.ts` | A service-role write path executed from a developer laptop, outside CI and outside `admin_audit_log` (0 rows). Not a network surface, so not in the plan's boundary table, but it is the largest privileged write path in the project by row count. |

## User Setup Required

None. The plan's `user_setup` block named the Vercel Cron Jobs dashboard read; that input was obtained through the read-only REST API before execution began and is committed under `.planning/audit/raw/vercel/`. No environment variable needs to be set for this phase, and none should be — the phase is read-only.

## Next Phase Readiness

**Ready for plan 01-11.** Both requirements this plan owns are complete, and both verdicts are backed by artifacts on disk rather than by assertion:

- **AUDIT-11** — all six named sources have an explicitly headed section with a verdict: `pg_cron` jobs from `cron.job` (3, captured live), the two `/api/cron/*` handlers and what triggers them (nothing, proved three ways), `vercel.json` crons (none, and the project's definitions list is empty and causal), the Supabase edge function (trigger, secret, and verification order recorded), the Apify/Instagram webhook (does not exist; the real path is an operator-run script pipeline), and auth hooks (none configured, with the evidence for the negative).
- **AUDIT-18** — `avatars`, `banners`, and the two buckets the requirement did not name are each reviewed for read visibility, path-prefix ownership, and size/MIME limits.

**Feeds forward:**

- **Plan 01-11** inherits a correction it already owed: `fail-open-register.md` FP-01 asks for `env_gated_auth` to be recomputed. The census in § 7 of the inventory supplies which names are actually configured, so the recomputation can now include a production-reality column.
- **Plan 01-13** inherits 7 storage finding candidates (ST-01…ST-07) and 2 asynchronous ones (CW-01, CW-02), each with a proposed severity and an exposure rationale in `SEVERITY_SLA.md`'s vocabulary, plus a proposed promotion of three new sweep patterns and one classification rule into `REDACTION.md`.
- **Stage 3's club-authorization slice** inherits ST-01 as a concrete, reproducible bypass of the owner check it is scoped to defend.
- **Stage 4 certification** inherits a stated hazard: a database rebuilt from `supabase/migrations/` has one bucket instead of four, no bucket limits, two object policies instead of fifteen, and no scheduled jobs at all. Certifying against a rebuilt environment would certify a system that is not production's.

**Open, with the closing command recorded in each case:** the edge function's deployment status, the dashboard-side auth hook configuration, and the `user_event_scores` row count. All three need one credentialed read; none blocks the remaining plans in this phase.

## Self-Check: PASSED

- All 9 created files verified present on disk with `[ -f ]`.
- All 3 task commits verified present with `git log --oneline --all`.
- `node .planning/audit/tools/validate.mjs --check storage` — 13 passed, 0 failed.
- `node .planning/audit/tools/validate.mjs --check cron` — 7 passed, 0 failed.
- `bash .planning/audit/tools/readonly-guard.sh` — exit 0, run after every task.
- `git diff --name-only HEAD~3 HEAD` — 9 paths, **all under `.planning/`**; nothing outside it was created or modified.
- All 9 of Task 1's and all 11 of Task 3's acceptance criteria re-run and passing.
- Redaction sweep re-run over all 8 artifacts: 13 of 14 patterns at 0; pattern 4 at 3, fully classified as finding text with 0 unclassified and 0 token-shaped residuals. Positive controls non-zero (`bucket_id` 20, `auth.uid` 13, `jobname` 108, `send_event_reminders` 6).

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
