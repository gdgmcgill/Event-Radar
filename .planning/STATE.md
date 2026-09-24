---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 05
current_phase_name: Slices 3–5 — Auth, Club Authorization, Admin Containment
status: executing
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-09-24T04:48:16.196Z"
last_activity: 2026-09-24
last_activity_desc: Phase 05 execution started
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 62
  completed_plans: 45
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** Every critical workflow in the existing app is verified correct, secure, and reproducible across all user roles before any new product feature is started. If a foundation change breaks a workflow that worked before, the program has failed.
**Current focus:** Phase 05 — Slices 3–5 — Auth, Club Authorization, Admin Containment

## Current Position

Phase: 05 (Slices 3–5 — Auth, Club Authorization, Admin Containment) — EXECUTING
Plan: 3 of 19
Status: Ready to execute
Last activity: 2026-09-24 — Phase 05 execution started

Progress: [███████░░░] 73%

## Performance Metrics

**Velocity:**

- Total plans completed: 25
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 13 | - | - |
| 3 | 8 | - | - |

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
| Phase 01 P12 | 45 min | 3 tasks | 7 files |
| Phase 01 P13 | 48 min | 3 tasks | 8 files |
| Phase 02 P01 | 14min | 3 tasks | 14 files |
| Phase 02 P02 | 22min | 3 tasks | 5 files |
| Phase 02 P03 | 9min | 2 tasks | 3 files |
| Phase 02 P04 | 35min | 3 tasks | 15 files |
| Phase 02 P05 | 21min | 3 tasks | 16 files |
| Phase 02 P06 | 12min | 3 tasks | 12 files |
| Phase 02 P07 | 20min | 3 tasks | 14 files |
| Phase 02 P08 | 13min | 3 tasks | 12 files |
| Phase 02 P09 | 14min | 2 tasks | 15 files |
| Phase 02 P10 | 25min | 3 tasks | 7 files |
| Phase 02 P11 | 38 min | 3 tasks | 10 files |
| Phase 03 P04 | 45 min | 3 tasks | 34 files |
| Phase 03 P05 | 78min | 3 tasks | 14 files |
| Phase 03 P06 | 45 min | 3 tasks | 40 files |
| Phase 03 P07 | 4h 10m | 3 tasks | 29 files |
| Phase 03 P08 | ~50 min | 3 tasks | 11 files |
| Phase 04 P01 | 15min | 3 tasks | 9 files |
| Phase 04 P02 | 14min | 3 tasks | 12 files |
| Phase 04 P03 | 10min | 3 tasks | 11 files |
| Phase 04 P04 | 15min | 3 tasks | 13 files |
| Phase 04 P05 | 7min | 3 tasks | 9 files |
| Phase 04 P06 | 12min | 3 tasks | 17 files |
| Phase 04 P07 | 5min | 2 tasks | 5 files |
| Phase 04 P08 | 7min | 2 tasks | 10 files |
| Phase 04 P09 | 15min | 3 tasks | 14 files |
| Phase 04 P10 | 8min | 2 tasks | 14 files |
| Phase 04 P11 | 11min | 3 tasks | 12 files |
| Phase 05 P01 | 14min | 3 tasks | 10 files |
| Phase 05 P02 | 9min | 3 tasks | 7 files |

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
- [Phase 01]: Shared caching of personalized API responses is PROVEN on production: 8 personalized routes returned x-vercel-cache HIT/STALE with age up to 96s under the blanket vercel.json s-maxage=60, and no response varies on Cookie or Authorization — The cache key is the URL alone, so a stored entry is served to every caller regardless of session. Held at latent-hazard/Critical rather than leak-confirmed only because the two-account observation was blocked.
- [Phase 02]: Node 24 pinned as engines.node '24.x' + .nvmrc '24' + CI node-version-file — one declared major, three consumers that read it rather than restate it
- [Phase 02]: @types/node 20 -> 24 is Phase 2's only major bump; forced by the runtime pin, zero new tsc diagnostics, zero source changes (evidence/types-node-major-note.md)
- [Phase 02]: npm test = plain 'jest', deliberately without --passWithNoTests, so a config error matching no tests cannot report green in CI
- [Phase 02]: The npm audit --audit-level=high CI gate is deferred to plan 02-09: it exits 1 on this tree today and would red-light every PR through batch 5
- [Phase 02]: tsconfig.json keeps excluding **/*.test.ts and **/*.test.tsx — F-066 is only partially closed by Phase 2 and 02-11 must record it as partial, not claimed
- [Phase 02]: STAB-02/08/13 reverted to Pending after mark-complete: batch 0a only partially satisfies each (STAB-08 still needs jsdom+testing-library in batch 5; STAB-13 is a phase exit criterion for 02-11; STAB-02's CI half is unobserved and 02-03 owns it)
- [Phase 02]: The vercel CLI is removed outright, not relocated to devDependencies — relocation retains the whole subtree including the tar critical and buys nothing, because four negative checks find no lifecycle point that invokes it and deployment is Vercel's git integration with buildCommand 'npm run build'
- [Phase 02]: yaml is NOT dead and was withdrawn from batch 1 — redoc@2.5.2's prebuilt bundles require('yaml') while declaring it in neither dependencies nor peerDependencies, and redoc is reachable from the public /docs route. Batch 1 removes ten declarations, not eleven
- [Phase 02]: Phase 1's reachability rule has a blind spot — a src/-only grep cannot see a require() inside another dependency's prebuilt bundle. Batches 2-5 must also search node_modules/*/bundles and node_modules/*/dist before removing a non-application-facing package
- [Phase 02]: The ~2,000-line lockfile-diff threshold is a proxy, not the property — at 8,842 lines batch 1 passed on a structural check (299 entries removed, 0 added, 0 re-resolved, lockfileVersion unchanged) rather than on the count; method committed as evidence/lock.b1.diff-review.md
- [Phase 02]: next_static_bytes does not reproduce the Phase 1 baseline (4491132 vs 4490961, +171 B uniform across all 44 routes). Measurement is sound and deterministic; the figure is recorded with the delta named, and 02-11 must compare its after side against evidence/bundle-size.before.txt, never versions.txt
- [Phase 02]: STAB-07, STAB-09, STAB-11 and STAB-16 left Pending by 02-04 — each has clauses this plan does not deliver (redoc untouched; batches 2-5 outstanding; lockfile discipline is a standing property; the formal after side belongs to 02-11). Only STAB-04 marked complete
- [Phase 02]: Batch 3 (02-06): STAB-06 stays Pending — the requirement's ban-check clause needs the Phase 3 seed, so the rename shipped but the requirement is not claimed
- [Phase 02]: Batch 3 (02-06): the proxy rename is one atomic commit of two renames and two changed lines; the [Middleware] log prefix, src/middlewareRateLimit.ts and the three Phase 5 findings in the file were left untouched so 'same behaviour as before' stays provable
- [Phase 02]: Batch 3 (02-06): 'Proxy (Middleware)' in the build route table is NOT a rename receipt — batch 2's build printed it on the pre-rename tree. The only receipt is deprecation_warning_lines 1 -> 0
- [Phase 02]: Batch 3 (02-06): 47 pre-existing untracked files mean the codemod needs --force and staging must be by explicit path, never 'git add -A' — the rename diff is the STAB-06 artifact and must read as a rename
- [Phase 02]: Batch 6 (02-09): the plan's no-manifest-change constraint (phase_locked_constraints #7, threat T-02-09-SC) was set aside on user decision (Adyan Ullah, 2026-09-15) — the plan required both a green audit gate and a frozen manifest while one production High survived batch 4, and an exception-register row cannot change an exit code. 02-11's completion note must carry this
- [Phase 02]: Batch 6 (02-09): 02-07's recommended styled-components ^6.5.3 override is INFEASIBLE — every release that drops the postcss dependency (>=6.4.0) adds react-native as an optional peer, and npm 11 resolves react-native@0.87.1 which peer-requires react ^19.2.3, colliding with react 18.3.1 and phase-locked constraint 1. Shipped overrides postcss ^8.5.28 instead — same advisory, smaller blast radius, redoc's peer contract unrewritten
- [Phase 02]: Batch 6 (02-09): final production census is 0 critical / 0 high / 2 moderate / 0 low across 298 prod deps (phase start: 2/22/13/1 across 680). The exception register closes EMPTY because the last High was fixed, not excepted
- [Phase 02]: Batch 6 (02-09): STAB-14 is delivered IN PART and 02-11 must record it as partial — the CI gate step exists unsuppressed between the test and build steps and is green locally, but all 113 Phase 2 commits are unpushed so no run has been observed. evidence/ci-green-run.md says UNOBSERVED in its first line
- [Phase 02]: Batch 6 (02-09): the postcss override collapses next's exact 8.5.23 pin into the single root 8.5.28 copy — 02-07 declined exactly this. Plans 02-10 and 02-11 now measure a tree with an overrides entry: the clean-room install and the bundle-size after side both moved (299 -> 298 prod deps)
- [Phase 02]: Batch 6b (02-10): the SBOM is generated with --package-lock-only, added to the research command, because the installed-tree variant is platform-dependent (288 components on macOS vs 320 from the lockfile) and omits @next/swc-linux-x64-gnu and the sharp Linux binaries that actually run on Vercel iad1 — and because byte-stability across regenerations, which the plan requires, is false across machines without it
- [Phase 02]: Batch 6b (02-10): renovate.json package rules are ordered general -> specific so the blanket major rule precedes the React rule; both match exactly [major], and in the research order the React rule shadows the blanket protection and makes it look absent
- [Phase 02]: Batch 6b (02-10): the -6.32% route-bundle reduction is attributed to batch 2 on 02-04's MEASURED 0-byte batch-1 delta, not on Pitfall 9's prediction; batch 1's removals had zero importers and were already tree-shaken, and the +1,109 B that batches 3-6 added is reported rather than rounded away
- [Phase 02]: The roadmap is the phase contract: five findings whose closes_in_phase disagreed with it were reassigned to 02 — F-051/052/053 read 03 and F-056/057 read null while the ROADMAP's Phase 2 success criteria name the CLI removal, the framework patch and the API-documentation disposition by name. Five adjacent rows were corrected in the same direction: F-063 and F-064 to Fixed, F-065 held Open on an unobserved CI run, F-066 to 03 as partially closed, F-025 05 -> 06 and still Critical/Open.
- [Phase 02]: findings.schema.json gained an OPTIONAL resolution field, rendered by gen-foundation-audit.mjs — The register could record THAT a finding closed, via status and closes_in_phase, and had nowhere to record HOW, in which commit, or which clause did NOT close. Optional, so all 70 rows stay schema-valid and every untouched row renders byte-identically.
- [Phase 02]: .claude/CLAUDE.md corrected on disk but deliberately NOT force-added to git — .claude/ is gitignored at .gitignore:43 and the file has never been tracked. Overriding a deliberate gitignore is not the executor's call. The correction is live for agents and absent from history; the split is recorded in the commit body, STAGE-2-COMPLETION.md section 12 and the plan summary rather than left to be discovered.
- [Phase 02]: Twelve STAB requirements marked complete; five held Pending with named unblock conditions — STAB-02, STAB-06, STAB-09 and STAB-14 each have at least one clause the artifacts do not support. Three of them — STAB-02's CI half, STAB-14's observed run, STAB-06's Tier 3 — are blocked on one act: a push.
- [Phase 02]: The Stage 2 exit gate is MET on all five clauses — 0 Critical and 0 High in the production tree; the exception register is examined-and-empty because the Highs were fixed rather than excepted; the clean room at 01c7394 records 20 exit codes all 0; 278 passing against a baseline of 220 AND 5 skipped against 36; the lockfile was reviewed as diffs on every batch and never regenerated.
- [Phase 03 / 03-04] D-15: the baseline is produced by `supabase db dump --linked`, NEVER `supabase db pull --linked`. The CLI documents that `db pull` may record the pulled migration in the REMOTE history table — the exact production write D-02 gates to plan 03-08 and T-03-04-04 prohibits by name. 03-RESEARCH.md § Assumptions Log A1 already named the dump as producing equivalent DDL by a different route, so A1 closes as routed-around rather than verified, and production's `schema_migrations` is provably untouched.
- [Phase 03 / 03-04] D-16: a migration declares storage POLICIES, never storage STRUCTURE. The plan's `--schema public,storage` baseline cannot replay — measured, not assumed: `has_schema_privilege('postgres','storage','CREATE')` is false, `storage.objects` is owned by `supabase_storage_admin`, and `CREATE TYPE storage.…` is denied while `CREATE POLICY … ON storage.objects` is permitted. Storage structure is service-created identically in every environment; the 15 `storage.objects` policies are application-owned. The `db diff` still covers both schemas, so the empty result is what PROVES the split safe rather than assuming it.
- [Phase 03 / 03-04] D-17: `supabase db dump` filters `CREATE EXTENSION` out of its output. The dumped baseline silently lacked `pg_trgm`, which `public.search_events_fuzzy` needs at CALL time — a reset cannot catch this because `CREATE FUNCTION` does not validate a GUC inside a function body. Only the `db diff` caught it. migra's own emitted DDL was pasted verbatim: a generated baseline gets a generated fix, so it stays a copy of production rather than a claim about it.
- [Phase 03 / 03-04] Fidelity is established by set difference, never by eye. 41 of production's 101 RLS policies are declared by no migration, so there is nothing local to read the baseline against. Both sides are reduced to `schema.table :: policyname` pairs and diffed programmatically — live 101, baseline 101, symmetric difference 0.
- [Phase 03 / 03-04] An evidence file cites its assertion patterns by reference rather than inlining them. `baseline-review.md` and `db-reset.txt` each first matched the very grep whose result they reported as zero; inlining a token whose absence you are asserting is how a tripwire starts lying about itself.
- [Phase 03 / 03-05] D-18: the nine archived FK indexes are NOT re-issued — all nine measured live in production and present in the baseline, so re-issuing would be dead SQL. REFAC-02's index half was re-aimed at six genuinely-missing indexes; the nine are asserted in 010-fk-indexes.test.sql instead, because REFAC-02's truth is about database STATE, not migration provenance.
- [Phase 03 / 03-05] D-19: both new club_invitations UPDATE policies carry a WITH CHECK stronger than the archived file's — ownership is re-asserted alongside the status transition, so an invitee cannot rewrite invitee_email while accepting and an owner cannot reassign club_id while revoking (T-03-05-07).
- [Phase 03 / 03-05] D-20: the pgTAP mutation check is AUTOMATED (scripts/pgtap-mutation-check.sh) rather than performed by hand as 03-RESEARCH.md classified it. It also rejects a red that is a parse error rather than an assertion failure.
- [Phase 03 / 03-05] D-21: no pgTAP test writes into the auth schema. clubs.created_by is a nullable FK into auth.users which GoTrue owns; club ownership is expressed in the club_members row that is_club_owner actually consults.
- [Phase 03 / 03-06] D-04 applied: the type drift gate generates from the LOCAL database the migrations build, never from the linked project. A production-reading gate would have passed before 03-04 landed and forever after, proving nothing, and would need a credential in CI. The workflow contains no remote-generation flag and an acceptance criterion asserts it.
- [Phase 03 / 03-06] The CI Supabase CLI is pinned at 2.115.0. Generator output is not byte-stable across versions (postgres-meta v0.99.0 parenthesises four generic constraints v0.98.0 leaves bare), so an unpinned byte-for-byte gate is a gate on the CLI's release cadence.
- [Phase 03 / 03-06] `__InternalSupabase.PostgrestVersion` is NOT hand-restored into types.ts. The generator emits it only for a remote project; `--local` omits it, confirmed on 2.115.0 and 2.117.0. The plan's must-have expected it to survive and it cannot. Hand-editing this file is what created the phantom events_tests table, and that prohibition outranks the block's presence; type-check impact is nil.
- [Phase 03 / 03-06] Three findings were registered, not the two the plan anticipated. The admin_audit_log read and write paths differ in severity, category and reproduction; one row would have buried the write path, which is the platform's only accountability record for every moderation action ever taken.
- [Phase 03 / 03-06] **D-22 (user decision, Adyan Ullah, 2026-09-15): accept REFAC-04's cast clause at 45 of 47.** Both retained casts sit on registered findings and are annotated in source with the finding id, the mechanism and the test that pins them. Removing either makes `npx tsc --noEmit` fail, and every route to a clean type-check is a behaviour change — prohibited by the plan by name, forbidden by the phase's characterize-first rule L2 inside a typing plan, and at the moderation site it would have meant deciding a schema question with production consequences. F-071 closes in Phase 4; F-072/F-073 close in Phase 5, where the admin_email column migration is a deliberate behaviour change carried through D-02's production gate. REFAC-04 is recorded PARTIAL and is not ticked: its generated-types and CI-drift-gate clauses ARE met.
- [Phase 03 / 03-06] BOOKKEEPING HAZARD: two independent `D-` sequences now collide. STATE/summary DECISIONS run D-01..D-22; phase `deferred-items.md` files run their own D-01..D-20 continuing from Phase 2's. So `D-19`/`D-20` mean the 03-05 policy and mutation-check decisions HERE, and the ratchet false positive and the flaky hook test in `03-.../deferred-items.md`. Always cite the register with the id. Disambiguating the two sequences is on plan 03-08.
- [Phase 03-07]: The seed occupies a RESERVED 5eed… id namespace, not the 00000000-0000-4000-8000 block the pgTAP fixtures already own. Found by running `supabase test db`, not by review: 020-rls-policy-gaps died on a duplicate primary key before a single RLS assertion ran.
- [Phase 03-07]: Two pinned clocks, not one. PINNED_NOW stamps stored metadata; HORIZON_FUTURE/HORIZON_PAST (±10 years) carry rows the application compares to the WALL clock — an unexpired suspension, an upcoming event. A single pinned now in the past silently inverts their meaning, which is exactly what happened on the harness's first run.
- [Phase 03-07]: No saved_events row is seeded. Its AFTER INSERT trigger updates public.users, whose BEFORE UPDATE trigger stamps updated_at = now() unconditionally, unpinning a timestamp the determinism proof depends on; it cannot be re-pinned and the row cannot precede the user it references. The proof keeps the column; the row goes.
- [Phase 03-07]: The persona harness runs against a PRODUCTION BUILD (npm run build && npm run start). Under next dev the pages never finish hydrating in Playwright's Chromium — the Turbopack HMR handshake fails — and the symptom reads like a cookie bug because the proxy sees the session perfectly.
- [Phase 03-07]: bypassCSP is ON and its cost is stated rather than hidden — THE HARNESS DOES NOT EXERCISE THE CSP. next.config.js allow-lists https://*.supabase.co only, so the local stack is refused and client-side sign-in is broken for every local developer. Fixing it is an application source change this plan prohibits; registered as deferred item D-21.
- [Phase 03-07]: REFAC-07 is recorded PARTIAL on its staging clause and is NOT ticked. The branch is implemented, double-gated and unit-tested including its refusals; there is no staging project to load into. The guard was NOT widened to make an untestable path look tested.
- [Phase 03 / 03-08] **The production migration-history repair is DEFERRED to Phase 8.** The phase owner was not present; the plan's own rule makes an undecided checkpoint the deferral, and it is recorded in writing rather than left as a silence (evidence/repair-outcome.md). Phase 3 therefore closes ENTIRELY READ-ONLY toward production — one read, zero writes, across eight plans, with the version-list sha256 byte-identical to the 03-01 census as proof.
- [Phase 03 / 03-08] **REFAC-01 is recorded PARTIAL, not Complete, and this was a contestable call taken deliberately.** Its own text says "baseline + `migration repair`" and the repair was not performed. Plan 03-04 argued "REFAC-01's criteria are a reset and a diff", which is right about the SUCCESS CRITERION — that reads MET — but a requirement is measured against its own sentence, per Phase 2's STAB-06/STAB-09 precedent. A requirement marked Complete stops being examined, which is the whole reason for the discipline.
- [Phase 03 / 03-08] The two colliding `D-` sequences are resolved BY PREFIX: **DI- for deferred items, DEC- for decisions**, with a mapping table in evidence/deferred-items.md. Prior-art citations in five committed notes are deliberately NOT rewritten — they are correct against the register they were citing, and the mapping is how a later reader resolves them.
- [Phase 03 / 03-08] DI-19's ratchet false positive is FIXED as a census-only change (skip `*.test.*` before applying the markers), with the committed allow-list BYTE-IDENTICAL (sha256 3df51af2… either side) and `--write` exercised only into a copy. The forbidden one-command fix — regenerating the list to make the check pass — was not taken. Proven in both directions: a non-test fixture still produces exit 1; a jest.mock-only .test.ts is correctly ignored. It is correct now and STILL NOT WIRED INTO CI (DI-31, Phase 4).
- [Phase 03 / 03-08] **DI-32, found by this plan: THE CI e2e JOB IS RED ON A REAL RUNNER.** Run 35049602081 on 7c1ca29 — `ci` success, `types` success, `e2e` FAILURE. A workflow-level env block exports a placeholder NEXT_PUBLIC_SUPABASE_URL to every job; e2e/env.ts prefers it over the running stack and `??` only falls through on null/undefined, so the real local URL is never consulted and the seed guard correctly refuses the placeholder. THE GUARD IS RIGHT; THE JOB'S ENVIRONMENT IS WRONG. It passes on a laptop because a shell does not export that variable. Consequence: the persona harness has NEVER been observed executing outside one machine. Not fixed here — a CI fix cannot be verified without a push, and an unverified fix inside a note whose standard is "every claim cites a committed artifact" is the one change it must not contain. Phase 4 owns it.
- [Phase 03 / 03-08] Four findings whose FIX SHIPPED are left Open — F-015, F-016, F-020, F-046 — because in each case the validation CRITERION did not close even though the change did (a missing EXPLAIN assertion, an integration test that needs the policies in production, a general policy-column query never written, a drift generator never re-run). Flipping the status anyway is what T-03-08-05 prohibits.
- [Phase 03 / 03-08] findings.json is edited SURGICALLY, never reserialized. The first attempt used JSON.stringify(…, null, 2) and produced a 912/231 whole-file reformat for seven record changes; it was reverted and redone as targeted per-record replacements (14 insertions / 7 deletions, formatting preserved). An unreviewable diff to a shared register is an unreviewed diff — T-03-08-08.
- [Phase 03 / 03-08] **.mcp.json carries the production project ref in cleartext and is untracked but NOT gitignored** — one `git add -A` from committing a value REDACTION.md forbids in artifacts. Its `read_only=true` query parameter is also the standing server-side control behind every production read in Phase 3 and must not be removed. Recorded as human step 4; adding it to .gitignore is a one-line repository decision this plan did not take unilaterally.
- [Phase 04]: [Phase 04 / 04-01] DEC-23..DEC-32 are recorded in 04-.../evidence/phase-04-decisions.md and every later Phase 4 plan executes against them. F-079..F-085 registered (85 findings, validate --check findings 8/8); F-050 now owned by Phase 4. The PRESERVE/DEFECT tag gate is scripts/check-characterization-tags.mjs (ok 5 files; red on an unknown or missing F-nnn). Before-floor on base 794556a: jest 358/5, pgTAP 86 unseeded (21 SKIP) and 86 seeded (0 SKIP), Playwright 27 — A8 closed by measurement.
- [Phase 04]: [Phase 04 / 04-01] DEC-27 states the conflict the plan set cannot resolve alone: the visual half of the club-fabrication fix (F-080) conflicts with orchestrator decision 1 while ROADMAP success criterion 2 requires it. The non-visual half ships in 04-10; the visual half and the six tag identity mappings (DEC-26, F-081) go to the 04-11 owner checkpoint, deferral by default.
- [Phase 04]: [Phase 04 / 04-01] PLANNER decisions the phase owner may override: DEC-25 (keyset cursor contract, before 04-09 executes) and DEC-32 (F-082 search escaping ships in 04-08 without the owner checkpoint, because criterion 3's escaping has no non-visual delivery). Override = an owner-signed paragraph appended to the DEC's section; 04-08 stops before changing any file if one exists.
- [Phase 04]: [Phase 04 / 04-01] DEC-28, DI-25 measured in a throwaway worktree: supabase-js 2.116.0 raises 7 TS2345 + 1 TS2322 (audit.ts:38, F-073); none in a Phase 4 handler — events/[id]/route.ts:318 is that file's PATCH, not the GET Phase 4 owns, so 04-10/04-11 must leave PATCH's directUpdates typing alone. Minor re-deferred to Phase 5, ssr major to Phase 5 at the earliest. DEC-30: no seed change — the seed already carries 2 RSVPs (research Pitfall 3 corrected).
- [Phase 04]: [Phase 04 / 04-01] REFAC-09 and REFAC-10 NOT marked complete by 04-01 — it registers, measures and decides only (the 01-01 AUDIT-13/20 precedent).
- [Phase 04]: [Phase 04 / 04-02] Slice 1 characterization net: createFakeSupabase (src/__tests__/helpers/fakeSupabase.ts) is the test seam; 4 PRESERVE + 2 DEFECT suites (F-079, F-085), 75 tests, against unmodified handlers. 04-05 must pass the four PRESERVE suites unedited and move only rsvp-count-defect; control cycle 5b/5c proved the 04-05 head-count shape leaves rsvp-characterization green. Floors now jest 433/5, Playwright 28.
- [Phase 04]: [Phase 04 / 04-02] REFAC-09 NOT marked complete by 04-02 — only its before-state characterization clause is delivered; seam adoption and the count query are 04-05.
- [Phase 04]: [Phase 04 / 04-03] DI-34 closed: the elevated census and the lint boundary both cover src/** (exempting src/lib/supabase/ and src/server/db/elevated/), skip type-only imports, and agree on 25 files; the one sanctioned regeneration added exactly +src/lib/audit.ts. The boundary is now @typescript-eslint/no-restricted-imports with allowTypeImports.
- [Phase 04]: [Phase 04 / 04-03] DI-31 closed on its companion-rule and CI clauses: no-restricted-syntax fails a bare SUPABASE_SERVICE_ROLE_KEY read (dot, bracket, destructured) and a dynamic import() of the service module; the ci job runs the ratchet and the tag gate (CI run UNOBSERVED, no push). No shrink is available in Phase 4. src/app/api/clubs/[id]/route.ts reaches the service module only by dynamic import (allow-listed).
- [Phase 04]: [Phase 04 / 04-03] DI-35 closed per DEC-24: RequestProfile/PROFILE_COLUMNS narrowed to id, roles, onboarding_completed; the seam performs NO ban check and its docblock says so. 04-05 handlers adopting the seam must keep checkBanStatus() where it is. REFAC-09 NOT marked complete (control integrity only; adoption is 04-05).
- [Phase 04]: [Phase 04 / 04-04] Slice 2 characterization net: 2 PRESERVE suites (list 33, detail 16) that three control mutation cycles prove survive 04-08's quoted or(), 04-09's nextCursor key and a changed tag default; 4 DEFECT suites (F-082 +F-059 echo, F-083, F-080 pins A-D, F-081); e2e/specs/event-read-path.spec.ts 4 PRESERVE + 5 DEFECT against real PostgREST. Playwright 37, jest 511/5, tag gate ok 17 files. REFAC-10 NOT marked complete (before-state clause only).
- [Phase 04]: [Phase 04 / 04-04] DI-36 found: transformEventFromDB never copies pending_edits, so GET /api/events/[id] returns it to nobody (creator and admin included); its stripping branch is dead and the creator's pending-edit notice cannot render. Owner Phase 5 (REFAC-13). The detail PRESERVE pins non-owner stripping (real transform) and the handler's gate (delegating transform wrapper). 04-10/04-11 must not fix it in passing.
- [Phase 04]: [Phase 04 / 04-04] F-080 pins: A (organizer fallback) and D (detail selects *) move only if the 04-11 decision ships the visual fix; B (five blanked URL columns) and C (saved-events selects *) move in 04-10. F-081's e2e pin is the home feed's category rows (DiscoveryCard renders no tag labels). 04-07 must put the DEC-26 warning in transformEventFromDB, not mapTags, or tag-coercion-defect's no-signal assertion moves.
- [Phase 04]: [Phase 04 / 04-04] DI-32 needed no work in 04-04: it was CLOSED before Phase 4 (855da7f + b9f9bcb, CI run 35055404669 green); the 04-03 summary's 'DI-32 belongs to 04-04' line was stale. The fake's overlaps() is now evaluated as Postgres && (additive; no 04-02 suite used it).
- [Phase 04]: 04-05: friends seam adoption is its own commit (fe4e9f9) because friends-defect's mock lacked .single(); the four-handler adoption (a5ee4fc) kept an empty src/__tests__ diff
- [Phase 04]: 04-05: RSVP counts are two parallel select('id', {count:'exact', head:true}) reads (F-079, d40dee4); friends fallback passes an id array (F-071, 1351480); zero (supabase as any) under src/app/api/
- [Phase 04]: 04-06: test files are type-checked (tsconfig exclude globs removed); handler refs in tests are typed as the handler's own type, never widened in src
- [Phase 04]: 04-06: F-079 and F-071 Fixed; F-066 type-check clause met (stays Open for 04-09); its duplicate resolution keys merged; REFAC-09 complete
- [Phase 04]: 04-07: the DEC-26 unmapped-tag warning lives in transformEventFromDB (payload eventId + unmapped), not mapTags, so the F-081 DEFECT suite's silence assertion passes unmodified
- [Phase 04]: 04-07: KNOWN_NON_ROUNDTRIP_TAGS in src/lib/eventTags.ts is the one place the six F-081 identity mappings land; the completeness test fails until TAG_ALIASES and the list change together
- [Phase 04]: 04-07: prototype-key tags (constructor, __proto__) registered as DI-37 for 04-11, since the Object.hasOwn fix changes mapped output
- [Phase 04]: 04-08: F-082 shipped under DEC-32 (no owner override); search input escaped via src/lib/searchFilter.ts (LIKE layer + PostgREST quoted-value layer)
- [Phase 04]: 04-08: * left untouched by escapeLikeLiteral (PostgREST star rewrite cannot be escaped); pinned by unit test and probe KNOWN row; owner F-078 Phase 5
- [Phase 04]: 04-09: DEC-25 executed — GET /api/events keyset cursor on (start_date, id), quoted keyset or(), total from a head count, 400 Invalid cursor; fuzzy path ignores cursors and emits null
- [Phase 04]: 04-09: src/app/api/events/route.test.ts rewritten (not revived) as a PRESERVE contract suite; tag gate floor is now ok 18 files
- [Phase 04]: 04-09: composite (start_date, id) index for approved non-deleted events recorded as F-083 follow-up for Phase 8 — no migration in Phase 4
- [Phase 04]: 04-10: DEC-27 non-visual half shipped — shared EVENT_WITH_CLUB_SELECT (15 club columns, no contact_email) on six list routes and saved-events; F-080 pins B and C FIXED (1150b0f, 9083430), pins A and D unmoved for the 04-11 owner checkpoint
- [Phase 04]: 04-10: A4 closed with numbers — club embed adds +0.34 ms median (star to embed) and +0.17 ms (ten to fifteen columns) on the local stack; one clubs_pkey probe per row
- [Phase 04]: 04-11: owner checkpoint resolved by rule to option-defer (no owner answer); F-080 visual half and F-081 identity mappings deferred as DI-39/DI-40, owner the phase owner
- [Phase 04]: 04-11: REFAC-10 PARTIAL on 'events list uses a real club join instead of fabricating club objects'; REFAC-09 Complete; criteria 1, 3, 4 MET, criterion 2 PARTIAL (evidence/PHASE-4-COMPLETION.md)
- [Phase 05]: DEC-33..DEC-57 recorded in evidence/phase-05-decisions.md as rule-resolved defaults (no owner present); each is overridable by a signed paragraph before its executing plan runs
- [Phase 05]: F-086..F-091 registered; the C16 re-pointing moved 41 findings to 06/07/08, leaving 22 owned by Phase 5; F-060/F-068 stay null (outside the map)
- [Phase 05]: DEC-51 makes the Upstash install a BLOCKING package-legitimacy checkpoint in 05-18, overriding CONTEXT's rule-resolved 'not blocking'
- [Phase 05]: DI-38 closed (4a9e272, 10/10 repeats); before-floor on 4a9e272 is Jest 744/0, pgTAP 86, Playwright 40/0
- [Phase 05]: 05-02: the plan's diff-stat pathspec (src/app, src/lib) necessarily lists this plan's own new test files; no-production-change is proven with the same pathspec excluding *.test.ts(x) plus name-status showing A lines only
- [Phase 05]: 05-02: F-077's register recommended_fix leaves a slash-backslash next off-origin (mutation cycle 6c); 05-05's plan already rejects a backslash second character and requires a same-origin result

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
- AUDIT-08 two-session cache probe BLOCKED: COOKIE_A/COOKIE_B not supplied. Retry: export PROD_HOST=https://universeapp.ca plus COOKIE_A/COOKIE_B, then bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs
- ENVIRONMENT, not repository: the git binary stopped running partway through plan 02-09 — /usr/bin/git now exits 69 with 'You have not agreed to the Xcode license agreements'. Both 02-09 task commits landed first (refs/heads/main = b554d8f66eccc856a0cd3c69df3161bb0ac961ed, confirmed in .git/logs/HEAD). The 02-09 docs commit (SUMMARY.md, STATE.md, ROADMAP.md) is UNCOMMITTED on disk. Unblock: run 'sudo xcodebuild -license' in a Terminal, accept, then commit those files. Plan 02-10 cannot commit until this is cleared
- STAB-14 is partial: the CI production vulnerability gate is in .github/workflows/ci.yml and exits 0 locally, but no CI run has been observed — all 113 Phase 2 commits are unpushed and the one run on the remote (26121379844) has GitHub-expired logs (HTTP 410). Unblock: push, then confirm six step conclusions and grep the Install step log for 'Unknown <scope> config' to also close STAB-02's CI half. Procedure in evidence/ci-green-run.md sections 3 and 6
- Renovate is inert until two human steps are done: install the Renovate GitHub App on gdgmcgill/Event-Radar (four indirect probes found no evidence it ever has been), and mark the CI checks REQUIRED in branch protection on main — without the second, 'checks passed' is vacuous and patch auto-merge merges on a green tick that guarantees nothing
- STAB-02 / STAB-14 / STAB-06 Tier 3 are blocked on ONE act: a git push. No Phase 2 commit has been pushed (~123 local commits ahead of origin/main), so no CI run exists to observe, the last completed run's logs return HTTP 410, and the proxy migration's Tier 3 human verification has no preview deployment to run against. Unblocks three requirement clauses at once.
- Renovate GitHub App is NOT installed. renovate.json is committed and strict-validated in both modes but inert — zero PRs or issues ever authored by app/renovate. Install at https://github.com/apps/renovate on the owning org, grant this repository, confirm the Dependency Dashboard issue appears. Evidence: evidence/renovate-validation.txt, STAGE-2-COMPLETION.md section 7.
- ~~03-04 Task 2 BLOCKED on SUPABASE_DB_PASSWORD~~ **RESOLVED 2026-09-15.** The password was supplied via the macOS keychain, read only in the command that used it and written to no file. Tasks 2 and 3 completed. The flagged concern was upheld as decision D-15: `supabase db pull --linked` may write the REMOTE migration history, so the baseline was produced with `supabase db dump --linked` instead — a pure pg_dump read. Production's `schema_migrations` is provably untouched.
- ~~OUTSTANDING: the only production write left in Phase 3~~ **RESOLVED 2026-09-16 as a written DEFERRAL to Phase 8** (03-08 task 2, `evidence/repair-outcome.md`). Production's history table still has no row for baseline version `20260915214553` — 45 rows, unchanged, sha256 identical to the 03-01 census. **The constraint therefore STANDS for the whole of Stage 3: `supabase db push` must not be run against production until Phase 8 or an explicit owner decision.** The exact command is captured unrun in `evidence/repair-preflight.md` § 2. The 45 historical versions are never marked `reverted` under any option. Registered as DI-23. **What this costs today, measured not supposed:** club-invitation acceptance (F-016) is broken in production, `search_events_fuzzy` runs with no trigram index, and `events.status` — the predicate of the anonymous feed's only governing policy — is unindexed there. All nine absent objects are enumerated in `evidence/db-diff.after-fixes.sql`.
- NEW, found by the baseline and worth acting on in 03-05: production runs `public.search_events_fuzzy` (which calls `similarity()` and sets `pg_trgm.similarity_threshold`) with **no trigram index on `public.events` at all** — its five indexes are all btree. Every fuzzy search is a sequential scan computing trigram similarity per row, degrading with every event added. `20260308000001_fuzzy_search.sql` declares the two missing GIN indexes and is REFAC-02's strongest candidate.
- Local `supabase db reset` now depends on the storage schema being service-created (D-16). The baseline deliberately carries storage POLICIES only; the storage schema's structure is owned by `supabase_storage_admin` and the migration role cannot create in it. A local stack whose storage container has not initialised will fail differently from a schema problem — check `information_schema.tables where table_schema='storage'` before suspecting the baseline.
- ~~03-06 stopped at a decision on the last two Supabase client casts~~ **RESOLVED 2026-09-15 as D-22: accept 45/47.** Both retained casts are annotated in source with their finding id, mechanism and pinning test. REFAC-04 is recorded PARTIAL and is NOT ticked — its generated-types and CI-drift-gate clauses are met; its cast clause closes in Phase 4 (F-071) and Phase 5 (F-072/F-073). **What remains outstanding is the DEFECT, not the decision:** in the running production database `admin_audit_log.admin_email` does not exist, so the moderation Recent Activity panel renders empty and every admin audit write — every approval, rejection, ban and unban — is rejected with PGRST204 and silently discarded, because `logAdminAction` never reads its result and all fourteen callsites catch only throws. F-073 is High for that reason. Nothing in Phase 3 changes it.
- REFAC-07's staging clause remains open: no staging Supabase project exists for the seed's guarded staging branch to be exercised against. Blocking nothing. **Carried into 03-08's completion note as a stated PARTIAL rather than rounded up** (`evidence/FOUNDATION-READINESS.md` § 11, DI-29). Owner: the phase owner to provision, CERT-01 in Phase 7 to load.
- **NEW, found by 03-08: the CI `e2e` job is RED on a real runner and the persona harness has never been observed outside one machine.** Run 35049602081 on 7c1ca29 — `ci` and `types` both green, `e2e` failing at config load. Cause diagnosed to the line and reproduced: `.github/workflows/ci.yml:9-11` exports a placeholder `NEXT_PUBLIC_SUPABASE_URL` to every job, `e2e/env.ts:29-32,61-65` prefers it over `supabase status -o env`, and `??` only falls through on null/undefined. The seed guard then correctly refuses the placeholder. Two candidate fixes worked out in `evidence/ci-e2e-red.txt` § 6 (recommended: invert the precedence in `e2e/env.ts`). Owner: Phase 4. DI-32.
- ~~**`.mcp.json` is untracked but NOT gitignored, and it contains the production project ref in cleartext.**~~ **RESOLVED 2026-09-16** — gitignored in `b9f9bcb` (`.gitignore:84`, verified with `git check-ignore`). Original note: A `git add -A` would commit a value `.planning/audit/REDACTION.md` forbids in committed artifacts. Its `read_only=true` parameter is simultaneously the standing server-side control behind every Phase 3 production read and must not be removed. Unblock: add `.mcp.json` to `.gitignore` (a one-line owner decision).
- **The production database password should be rotated** — it transited a chat session during plan 03-04. No committed file contains it (asserted by every plan's pre-commit credential grep), so rotation affects nothing in this repository. Update the macOS keychain item "Event-Radar DB password" afterwards. This is human step 1 in `evidence/FOUNDATION-READINESS.md` § 10.
- ~~`.claude/CLAUDE.md`'s correction is still gitignored and a fresh clone does not carry it.~~ **RESOLVED 2026-09-16 (quick 260916-nst, `33f5783`): the owner chose to track the file; `.claude/*` stays ignored, `!.claude/CLAUDE.md` is versioned, and the false zustand claim is corrected. DI-28 closed.** Original note: Assigned to Phase 3 by Phase 2 and **not resolved** — overriding a deliberate `.gitignore` is the repository owner's call, and Phase 3 held the same line Phase 2 did. It has now crossed two phases undecided. DI-28, owner: the phase owner.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260916-nst | Clear pre-Phase-4 blockers: DI-20 flaky useEvents test, DI-28 CLAUDE.md tracking, research cache ignore | 2026-09-16 | 33f5783 | [260916-nst-clear-pre-phase-4-blockers-di-20-flaky-u](./quick/260916-nst-clear-pre-phase-4-blockers-di-20-flaky-u/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Upgrades | React 18 → 19, Next.js major beyond 16, declarative schema (UPG-01..03) | Deferred to post-certification | 2026-09-13 |
| Quality | Visual regression, axe accessibility smoke, scheduled staging refresh (QUAL-01..03) | Deferred to post-certification | 2026-09-13 |

## Session Continuity

Last session: 2026-09-24T04:48:16.192Z
Stopped at: Completed 05-02-PLAN.md
Next: execute 05-03-PLAN.md (slice 3 characterization, the write handlers). 05-02's ring net is in place: tag gate ok 23, Jest 785/785 (evidence/slice-3-characterization-ring.txt). DI-42 (provision Upstash with both env-name pairs) is an owner action required before any push to `main`.
Resume file: None
