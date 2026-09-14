---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 01
current_phase_name: Read-Only Foundation Audit
status: executing
stopped_at: Completed 01-11-PLAN.md
last_updated: "2026-09-14T22:53:34.235Z"
last_activity: 2026-09-14
last_activity_desc: Phase 01 execution started
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 13
  completed_plans: 11
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** Every critical workflow in the existing app is verified correct, secure, and reproducible across all user roles before any new product feature is started. If a foundation change breaks a workflow that worked before, the program has failed.
**Current focus:** Phase 01 — Read-Only Foundation Audit

## Current Position

Phase: 01 (Read-Only Foundation Audit) — EXECUTING
Plan: 12 of 13
Status: Ready to execute
Last activity: 2026-09-14 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 13 min | 3 tasks | 13 files |
| Phase 01 P02 | 20 min | 2 tasks | 4 files |
| Phase 01 P03 | 15 min | 3 tasks | 7 files |
| Phase 01 P04 | 9 min | 2 tasks | 5 files |
| Phase 01 P05 | 11 min | 3 tasks | 12 files |
| Phase 01 P06 | 45 min | 3 tasks | 33 files |
| Phase 01-read-only-foundation-audit P07 | 21min | 3 tasks | 6 files |
| Phase 01 P08 | 52 min | 2 tasks | 9 files |
| Phase 01 P09 | 27 min | 3 tasks | 8 files |
| Phase 01 P10 | 22 min | 3 tasks | 9 files |
| Phase 01 P11 | ~50 min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Four stages become eight phases; no phase crosses a stage boundary. Stage 1 = Phase 1, Stage 2 = Phase 2, Stage 3 = Phases 3-6, Stage 4 = Phases 7-8.
- [Roadmap]: Stage 3 splits into foundations (schema/types/seam/harness/seed) → prove-the-seam slices (saved events, event read path) → authorization core (auth, clubs, admin) → async edge + close-out, per the research slice order.
- [Roadmap]: Auth is deliberately slice 3, not slice 1 — highest blast radius in the program, so the characterization harness from slices 1-2 must exist first.
- [Roadmap]: The Playwright persona harness and deterministic seed are pulled forward from Stage 4 into Phase 3, so "smoke the Validated workflows after each slice" is automated rather than manual.
- [Roadmap]: The blanket `s-maxage=60` removal is last (Phase 6), because it cannot land safely until every route is classified and refactored.
- [Phase 01]: Expected counts are re-derived into .planning/audit/baseline/versions.txt and read from there; no route/page/migration numeric literal exists in validate.mjs. Upstream docs say 92 routes / 45 migrations; the tree has 94 / 44.
- [Phase 01]: The read-only guard diffs against a captured baseline rather than asserting git status is empty, because docs/product-master-plan.md is already untracked.
- [Phase 01]: An absent input artifact is a FAIL under --check and a SKIP under --quick, never a silent pass.
- [Phase 01]: JSON Schemas are hand-written draft-2020-12 subsets checked inside validate.mjs; installing a schema library would mutate package.json and fail the phase exit criterion.
- [Phase 01]: Severity is exposure-adjusted with a written rationale; CVSS is not assigned to application-logic findings and a Critical may not be risk-accepted.
- [Phase 01]: AUDIT-13 and AUDIT-20 are NOT marked complete by plan 01-01 — it stands up their enforcement only; plans 01-04 and 01-13 deliver them.
- [Phase 01]: expected_status seeds all 13 CERT-05 persona keys with the 'unknown' sentinel, not an empty object — endpoints.schema.json declares the 13 keys required with additionalProperties false and validate.mjs treats a missing key as a hard schema error, so an empty object fails --check endpoints-signals on all 94 rows while still needing to fail --check endpoints before classification
- [Phase 01]: Audit generators merge into their artifact by id and overwrite only machine-derived keys; idempotence is the acceptance proof — A replace-semantics regeneration silently discards a day of hand classification (threat T-01-02-03); a byte-identical second run plus a mutate-regenerate-assert test proves the merge rather than asserting it
- [Phase 01]: signals.env_gated_auth is emitted by plan 01-02 even though its task signal list omits it — Plan 01-01 recorded it as a contract owed to --check authz-registers, and plan 01-07's AUDIT-10 fail-open register has no other data source; without it 01-07 would re-scan src/ with a divergent second regex
- [Phase 01]: pages.json seeds effective_protection and dead_or_duplicate with derived values, not the 'unknown' placeholder — validate.mjs has no pages-signals pre-classification check, so --check pages runs no-residual-placeholders unconditionally; a placeholder seed makes plan 01-03's own gate unpassable. Merge-by-id preserves plan 01-11's hand overrides.
- [Phase 01]: Per-page grep signals are folded into component_type and data_source instead of being emitted as top-level row keys — pages.schema.json sets additionalProperties:false over a fixed 12-key list with no signals object, unlike endpoints.schema.json; emitting is_client_component/uses_service_client fails schema-valid on all 43 rows.
- [Phase 01]: build_route_row_count is the measured 140, not the 139 the plan and RESEARCH state — 140 = 94 endpoints + 43 pages + 3 build-only routes, which is RESEARCH's own arithmetic; 139 was a transcription slip. Phase rule: counts are re-derived, never transcribed.
- [Phase 01]: The two page authorization rings are disjoint: 0 of 43 pages carry both middleware_protected and layout_guard — Every page depends on a single control; for the 14 admin/moderation pages that control is one layout.tsx file apiece. Input to AUDIT-17 threat models.
- [Phase 01]: AUDIT-13 baseline captured: 220 passing tests across 16 of 21 Jest suites (5 suites / 36 tests skipped), tsc --noEmit clean, eslint 12 warnings and 0 errors, all exit 0. This is the STAB-13 green target.
- [Phase 01]: Keep Jest, recorded not re-litigated: 14 of 21 test files call the jest.* mock API and 0 call vi.*; vitest is absent from package.json, package-lock.json and node_modules while vitest.config.ts and vitest.setup.ts remain as orphans; ts-jest 29.4.6 peers jest ^29 or ^30 against the installed jest 30.2.0, so no version skew argues for a switch.
- [Phase 01]: Jest 30 prints no reporter line for a fully-skipped suite and --verbose does not change that, so the five skipped suites are DERIVED as a set difference against jest-listtests.txt, with the derivation command embedded in baseline/jest.txt rather than the list merely asserted.
- [Phase 01]: AUDIT-13 marked complete, departing from the 01-01 and 01-03 withholding precedent, because every clause of the requirement maps to an artifact on disk and validate.mjs --check baseline exits 0 with 9 passing rules. The precedent is to withhold when artifacts contradict the claim, not to withhold reflexively.
- [Phase 01]: redoc and next-swagger-doc are reachable from the public /docs route; swagger-ui-react is absent from the module graph — The dependency-cruiser command from RESEARCH returns an empty graph on 18.3.0 (a bare directory argument cruises 0 modules, and --reaches cannot reach an excluded module); the corrected glob plus node_modules-as-leaves form cruises 308 modules and yields the real reachability path
- [Phase 01]: vercel ^32.3.0 sits in production dependencies, is imported by nothing, and roots 7 of the 24 High/Critical advisories including the tar critical — Removal (or a move to devDependencies) retires 7 rows at once; npm audit fix would instead jump the CLI 27 major versions to 59.16.0
- [Phase 01]: No dependency enters the dead list on knip alone: each of the 13 unused-dependency hits carries the grep that confirmed or refuted it — prettier and tsx were refuted as tooling false-positives and held back; removing them would have broken the formatter and the three scripts maintenance files
- [Phase 01]: Production capture ran over the Supabase MCP server (Management API), not the plan's sql-readonly.mjs transport: the operator authenticated MCP instead of supplying a PAT or connection string. Role postgres, transaction_read_only=off, so the safeguard in force was SELECT-only discipline with all 20 statements recorded verbatim in .planning/audit/raw/prod/.
- [Phase 01]: AUDIT-19 resolved as a negative finding: event_date/event_time exist on no production table; start_date and end_date (timestamptz, NOT NULL) are authoritative. Five stale references survive in three Jest fixtures and two comments.
- [Phase 01]: AUDIT-01 withheld, not claimed. prod.schema.sql is catalog-derived rather than a pg_dump, staging is unreachable, and the local snapshot is blocked by the repository's own migration history. validate.mjs --check schema-snapshots fails on staging and local by design.
- [Phase 01]: Raw capture envelopes under .planning/audit/raw/prod/ are committed as evidence and are the shared input for plans 01-08, 01-09, and 01-10.
- [Phase 01]: AUDIT-07 register is 25 rows including the factory module; validate.mjs NON_ROUTE_SERVICE_CLIENT_CALLSITES corrected 2 -> 3 and cross-checked against baseline/versions.txt service_client_file_count
- [Phase 01]: Service-role verdicts: 10 justified / 14 needs-decision / 1 unjustified; needs-decision marks rows blocked on a policy fact (plan 01-09 RLS) or a product decision, not on more reading
- [Phase 01]: src/app/users/[id]/page.tsx generateMetadata line 35 is the sole unjustified service-role callsite: no authentication before construction, attacker-supplied path param as filter
- [Phase 01]: AUDIT-10 found four env-conditional authorization checks, not two; the PATTERNS.md detector finds only calculate-popularity, so three further detectors were required
- [Phase 01]: Mark AUDIT-02 complete despite neither named tool having run — The drift table's substance is delivered at higher fidelity than supabase db diff would give; the tool failed because the migrations folder cannot build a shadow database, which is itself a Stage 3 finding
- [Phase 01]: Derive the migrations column of the drift table by static SQL parsing, not by replay — supabase/migrations/ aborts at the 12th of 44 files, so replay cannot answer the question; static parsing answers the weaker but useful 'does a migration declare this'
- [Phase 01]: Do not replay supabase/migrations/ against any environment: 41 of 101 live policies are declared by no migration, so a reset would drop them. Baseline from production first (REFAC-01 blocking input).
- [Phase 01]: Emit AUDIT-06 heatmap traceability as rls-heatmap-notes.csv rather than trailing columns, because validate.mjs --check heatmap rejects any non-empty cell outside table/command that is not allow|deny|none.
- [Phase 01]: Extend the AUDIT-05 flag set from four classes to six, adding WITH CHECK (true) and unindexed-policy-column, because the write-side unconditional expressions carry the Critical and High findings a read-side-only review would miss.
- [Phase 01]: The two /api/cron/* handlers are redundant dead code, not a broken schedule: pg_cron runs in-database reimplementations of both every 15 and 30 minutes — cron.job shows send_event_reminders and send_feedback_requests active and succeeding; the handlers have no trigger from any of the six sources and email_reminder_log has 0 rows. Remediation is deletion or a fail-closed guard, never scheduling them - the two implementations diverge on notification type strings and dedup store, so activating both would duplicate user-visible notifications.
- [Phase 01]: The Vercel env-name capture converts two hedged fail-open rows into observed production state — CRON_SECRET and ADMIN_API_KEY are not configured on the production project, so FO-02 compares against the literal Bearer undefined and FO-01's admin gate is skipped entirely - both in front of service-role clients. 01-07 had to record these as conditional; they are now empirical.
- [Phase 01]: club-logos is the highest-severity storage finding, and it is a bucket no requirement named — Its INSERT and UPDATE policies test only bucket_id and auth.role(), with no path-prefix ownership, so any authenticated user can overwrite any club's logo or banner - bypassing the route-level club-owner check by addressing the Storage REST API directly. It also has neither a size limit nor a MIME allow-list. Reviewing only the two buckets AUDIT-18 named would have missed it.
- [Phase 01]: The email half of the Validated 'in-app notifications and email reminders' workflow does not exist in any implementation — No email provider dependency exists anywhere in the project; both the live pg_cron function and the dead route handler only insert in-app notifications rows, while the table name email_reminder_log and the route name send-reminders assert otherwise.
- [Phase 01]: expected_status records what a route should return, never what it returns today — The divergence between the contract and current behaviour is the finding; recording broken behaviour as the contract would launder a defect into a specification (T-01-11-04)
- [Phase 01]: The aborted run's 33 hand-edited endpoint rows were discarded and the classification re-derived by a committed script — A hand edit is not reproducible: nobody downstream can re-derive it and nobody can tell which cells came from a rule and which from fatigue

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 is strictly read-only. Any source, config, dependency, or database change during Phase 1 contaminates the baseline that Stage 3 proves behavior against.
- Cache-header precedence between Next.js dynamic-route headers and `vercel.json` is an open empirical question (research flag). AUDIT-08's two-session production curl test is blocking for any Stage 3 caching decision.
- `/api/cron/*` trigger status is unknown (`vercel.json` has no `crons` key) while email reminders are a Validated requirement — AUDIT-11 must resolve this.
- `compute_user_scores` pg_cron exists only as a commented SQL line, so local/staging silently fall back to popularity. REFAC-03 must fix this before Stage 4 certifies a recommendation flow that is not production's.
- The `.planning/codebase/` map is dated 2026-03-05 and is demonstrably stale in places. Treat it as leads to re-verify, not facts.
- Shell 'grep' in the execution environment is a ugrep shim honouring .gitignore and rejecting some BRE patterns; cross-check count-derivation greps with 'command grep' in later Phase 1 plans.
- AUDIT-16 is INCONCLUSIVE: the client-bundle sweep ran against a build whose environment had no SUPABASE_SERVICE_ROLE_KEY, so its zeros prove absence of the key, not absence of leakage. Closing it needs one credentialed re-build — procedure in .planning/audit/security/client-bundle-sweep.md section 7.
- AUDIT-01 is incomplete. No staging Supabase project is visible to the operator's token (staging.schema.sql is a deferred-with-reason stub), the local snapshot is blocked because supabase/migrations does not replay from zero (aborts at file 12 of 44 on a version-011 primary-key collision), and prod.schema.sql is a catalog-derived reconstruction rather than a pg_dump because no Postgres connection string was supplied. Unblocked by: a PROD_DB_URL/STAGING_DB_URL, or by REFAC-01 repairing the migration history.
- Club-invitation acceptance is broken in production: the invitee SELECT/UPDATE policies exist in 20260226000001_invitee_select_update_policy.sql but not in the database, and /api/clubs/[id]/invites is RLS-reliant so nothing masks it.
- AUDIT-11 leaves two closable gaps needing one credentialed read each: whether the events-webhook edge function is deployed (supabase functions list), and whether any GoTrue auth hook is configured in the dashboard (Management API GET /v1/projects/{ref}/config/auth). A third open question: user_event_scores reports 0 rows while compute_user_scores succeeds every 6 hours.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Upgrades | React 18 → 19, Next.js major beyond 16, declarative schema (UPG-01..03) | Deferred to post-certification | 2026-09-13 |
| Quality | Visual regression, axe accessibility smoke, scheduled staging refresh (QUAL-01..03) | Deferred to post-certification | 2026-09-13 |

## Session Continuity

Last session: 2026-09-14T22:53:34.232Z
Stopped at: Completed 01-11-PLAN.md
Resume file: None
