---
phase: 01-read-only-foundation-audit
plan: 13
subsystem: audit-synthesis
tags: [threat-model, findings, redaction, phase-gate, stride, audit]
status: complete

requires:
  - "01-03 … 01-12 registers, reviews and captures — every finding candidate this plan banks"
  - ".planning/audit/findings.schema.json and SEVERITY_SLA.md — written in Wave 1 before the first finding existed"
  - ".planning/audit/tools/validate.mjs and readonly-guard.sh — the two gates"
provides:
  - "Three one-page trust-boundary threat models (AUDIT-17)"
  - "findings.json — 70-record machine finding register (AUDIT-20)"
  - "FOUNDATION_AUDIT.md — generated human register, the phase's headline deliverable (AUDIT-20)"
  - "tools/gen-foundation-audit.mjs — deterministic zero-dependency generator"
  - "REDACTION.md — consolidated ledger plus the phase-gate self-sweep result"
  - "README.md — finalised artifact index covering all 21 requirements"
affects:
  - "Stage 3 slices consume findings.json's recommended_fix and validation_criterion fields"
  - "CERT-11 iterates the validation_criterion field"
  - "The phase-completion step consumes the PROJECT.md/CLAUDE.md contradiction list below"

tech-stack:
  added: []
  patterns:
    - "Human register generated from the machine register so the two cannot drift; validator asserts the counts match"
    - "Evidence as a resolvable path plus an anchor, never an inline value"
    - "Redaction classification by value shape, not by path allowlist"
    - "Severity graded against a pre-committed policy, each with a written exposure rationale"

key-files:
  created:
    - .planning/audit/security/threat-model-anonymous.md
    - .planning/audit/security/threat-model-tenant.md
    - .planning/audit/security/threat-model-escalation.md
    - .planning/audit/tools/gen-foundation-audit.mjs
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
  modified:
    - .planning/audit/REDACTION.md
    - .planning/audit/README.md

key-decisions:
  - "Redaction classification moved from a path allowlist to a value-shape residual, because eleven artifact families legitimately name a credential class and an allowlist that long is a way of not looking"
  - "Seventy findings rather than a curated subset — every candidate any plan queued is banked, because a candidate dropped at synthesis has no trace"
  - "Cache findings held at verdict latent-hazard while carrying severity Critical: the mechanism is proven, only the victim is unobserved, and the label should say which"
  - "Gate 2 left red on the two blocked schema snapshots rather than weakened; AUDIT-01 stays withheld with its reason intact"

requirements-completed: [AUDIT-17, AUDIT-20]

metrics:
  duration: "~35 min"
  tasks: 3
  files: 8
  completed: 2026-09-14
---

# Phase 1 Plan 13: Synthesis and Phase Gates Summary

Seventy evidence-backed findings — 4 Critical, 17 High — banked into a schema-validated machine register, rendered into a human document by a committed generator so the two cannot drift, with three one-page trust-boundary threat models and both phase gates closed on a working tree that is byte-identical to where the audit started.

**Duration:** ~35 min (19:14 → 19:49 UTC) · **Tasks:** 3 · **Files:** 6 created, 2 rewritten

---

## Accomplishments

- **The phase's headline deliverable exists and is generated, not written.** `FOUNDATION_AUDIT.md` is 2,048 lines rendered from `findings.json` by `tools/gen-foundation-audit.mjs`. `validate.mjs --check findings` asserts the document and the register reference the same 70 ids, and `gen-foundation-audit.mjs --check` fails if the Markdown is stale — so a hand-edit is caught mechanically rather than by convention.
- **Every finding candidate any plan queued is banked.** Nothing was curated away at synthesis: the two RLS Criticals, the five RLS Highs, FO-01 through FO-05, the 14-item classification divergence queue, ST-01 through ST-07, CW-01 and CW-02, all six named schema-drift consequences, D-1 through D-8 from the dependency report, the twelve-row stale-documentation table, the test-hygiene gaps, and the four method findings about the audit's own instruments.
- **Severity is graded, not argued.** Every record carries a written `severity_rationale` naming anonymous reachability, tenant crossing, credential exposure, or the compensating control that bounds it. No CVSS vector is assigned to an application-logic finding, per the Wave 1 policy.
- **Four findings are Critical and each one is reachable today, not conditionally.** The admin popularity route's gate is skipped because `ADMIN_API_KEY` is absent from production; `users` self-escalation is one PostgREST statement; `admin_audit_log` accepts anonymous forged inserts; and personalized responses are demonstrably stored by a shared cache whose key ignores the session.
- **The three threat models are coverage arguments, not finding lists.** Each quantifies its entry points from the classified inventories rather than describing them, each has a ten-row STRIDE table citing finding ids, and each records what *held* as well as what failed — five positives for the anonymous boundary, five for tenant isolation, six for escalation. All three fit inside the 120-line one-page cap.
- **The redaction self-sweep caught its own false-clean case and was fixed rather than excused.** The Wave 1 path allowlist (`REDACTION.md` and `tools/`) no longer covered the eleven artifact families that legitimately name a credential class. Classification moved to value shape: four residual patterns each requiring an actual payload, all returning zero across 33 shape matches.
- **Both gates closed with the working tree untouched.** `git diff --stat 8d329c3..HEAD -- . ':!.planning'` is empty across the entire phase, the tree is byte-identical to the Wave 1 baseline, and the lockfile hash is unchanged.

---

## Finding counts

| Severity | Count | Category | Count |
|---|---:|---|---:|
| Critical | 4 | authz | 25 |
| High | 17 | config | 12 |
| Medium | 27 | schema-drift | 10 |
| Low | 22 | observability | 6 |
| **Total** | **70** | dependency | 5 |
| | | cache-exposure | 4 |
| | | performance | 3 |
| | | dead-code | 3 |
| | | validation | 2 |

**The four Criticals:** F-001 (admin popularity route fail-open on a service-role client, live), F-006 (`users` self-privilege-escalation), F-007 (anonymous insert into `admin_audit_log`), F-025 (personalized responses shared-cached under a session-independent key).

All 70 are `status: Open`. No risk acceptance was signed — a Critical may not be risk-accepted under the Wave 1 policy, and no High had a reachability argument strong enough to justify one at synthesis time.

---

## Phase gates

| Gate | Command | Result |
|---|---|---|
| Read-only guard | `bash .planning/audit/tools/readonly-guard.sh` | **exit 0** |
| Read-only, independent | `git diff --stat 8d329c3..HEAD -- . ':!.planning'` | **empty** |
| Baseline byte-identity | `git status --porcelain -- . ':(exclude).planning' \| diff -q baseline/git-status.before.txt -` | **identical** |
| Lockfile hash | `shasum -a 256 -c baseline/lock.sha256 --status` | **exit 0** |
| Redaction self-sweep | script over `.planning/audit/`, `public/`, the phase's plans and summaries | **`SWEEP_RESULT=CLEAN`** — 33 shape matches, 0 payloads |
| Full validator | `node .planning/audit/tools/validate.mjs` | **118 passed, 2 failed, 1 skipped** |

**Gate 2 is red on exactly the documented blocked items and was not weakened.** Both failures are `schema-snapshots :: dump-contains-create-table` on `schema/staging.schema.sql` (no staging credential) and `schema/local.schema.sql` (`supabase db reset` aborts at the 12th of 44 migrations — finding F-043, the repository's own history, not an absent input). AUDIT-01 remains withheld in `REQUIREMENTS.md` with its reason intact. The one SKIP is `endpoints-signals :: placeholders-permitted`, a pre-classification gate explicitly superseded by `--check endpoints`, which passes.

---

## PROJECT.md "Validated" claims the evidence contradicts

These are **filed as findings and listed here for the phase-completion step.** `PROJECT.md` and `CLAUDE.md` were not edited by this plan — they are outside this phase's write scope.

| Claim | Where | What the evidence shows | Finding |
|---|---|---|---|
| "In-app notifications and **email reminders** — existing" | `PROJECT.md:29` | No email provider dependency exists anywhere in the project. Both the live `pg_cron` function and the dead handler insert in-app `notifications` rows and nothing else. `email_reminder_log` holds exactly 0 rows. | F-038 |
| "User sees **personalized recommendations** from the Postgres-native scoring engine … with popularity fallback for new users" | `PROJECT.md:22` | `user_event_scores` holds exactly 0 rows (`count(*)`, not `n_live_tup`) while `compute_user_scores` runs on schedule with zero failures. Every request takes the popularity fallback. Personalization is the fallback, not the path. | F-041 |
| "**A/B experiment framework** for recommendation variants — existing" | `PROJECT.md:31` | `experiments` and `experiment_variants` each have one live policy, admin-only `ALL`; the five migration-declared read policies are absent. Every non-admin caller gets zero rows and falls through to control without erroring. | F-017 |
| "Club organizers … **invite members by McGill email**" | `PROJECT.md:23` | An invitee can neither see nor accept their invitation: `club_invitations` has two live policies, both `is_club_owner(club_id)`. The invitee policies exist in a migration that was never applied. | F-016 |
| "Admins … with actions written to `admin_audit_log`" | `PROJECT.md:28` | The table holds 0 rows, and accepts forged inserts from anonymous callers through two `WITH CHECK (true)` `{public}` policies. | F-007 |
| "all **92** API handlers and 43 pages" | `PROJECT.md:41` | 94 `route.ts` files. `REQUIREMENTS.md` was already corrected to 94; `PROJECT.md:41` is the last surviving copy. | F-063 |
| "Protected routes: 6 entries" | `CLAUDE.md:50` | `src/middleware.ts:114` has 8 — it also contains `/settings` and `/friends`. The drift runs in the dangerous direction. | F-063 |
| "Vitest (config at `vitest.config.ts`) — Unit test runner" | `.claude/CLAUDE.md:43-44` | Vitest is not installed and never runs. The actual runner is Jest + ts-jest, which the file does not mention at all. | F-063 |

---

## Open items needing a later credentialed pass

Each is indexed in `FOUNDATION_AUDIT.md` § Blocked Items with its retry command.

1. **Staging schema snapshot** — needs a credential for the staging project. Blocks the AUDIT-01 completion.
2. **Local schema snapshot** — blocked on F-043, not on an input. `supabase db reset` aborts at the 12th of 44 migrations because two files derive version `011` and one file's version does not parse. Fixing the migration history unblocks it.
3. **Two-session cache probe** — `COOKIE_A` and `COOKIE_B` were never supplied, so the cross-session retrieval step is unobserved. The generator promotes `latent-hazard` to `leak-confirmed` automatically once both are present; AUDIT-08 stays withheld until then.
4. **Client-bundle sweep re-run with the real key in the build environment** — the current `ENVSTATE` is `INCONCLUSIVE-key-absent-from-build-env`, so seven zero counts prove absence from *that* build, not absence in general (F-070).
5. **GoTrue auth hook configuration** — dashboard state. The `pg-functions://` form is ruled out by the function catalog; the HTTP form is not readable through any read-only capture used in this phase.

---

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | Write the three one-page trust-boundary threat models | `07d8343` |
| 2 | Populate the finding register and generate the human audit document | `e618af3` |
| 3 | Consolidate redaction, finalise the index, close both phase gates | `43b9c09` |

Plan metadata: see the `docs(01-13)` commit carrying this file.

---

## Deviations from Plan

### 1. [Rule 2 — Missing critical] Redaction classification moved from a path allowlist to a value-shape residual

- **Found during:** Task 3
- **Issue:** Two of the task's acceptance criteria are literal-string greps — `grep -rl 'sb_secret_' .planning/audit/` and `grep -rl 'auth-token=' .planning/audit/ public/` — each required to produce no output. Both produce output. `sb_secret_` appears in 11 files and `auth-token=` in 6, in every case as a **pattern definition**: `tools/validate.mjs`'s scrub table, `REDACTION.md`'s own pattern list, all five per-plan redaction ledgers, `security/client-bundle-sweep.md`'s per-pattern count table, and `baseline/BASELINE-REFRESH.md`. Wave 1 anticipated this for two paths (`REDACTION.md` and `tools/`) and wrote a self-reference caveat; by the phase gate eleven artifact families legitimately named a credential class.
- **Why the criterion could not be satisfied as written:** the only way to make those greps silent is to delete or mangle the pattern documentation — which weakens the audit's own instrument, not the gate. An allowlist long enough to cover eleven families is not a classification; it is a way of not looking.
- **Fix:** classification by **value shape**. A credential has a payload; a pattern definition does not. Four residual patterns were added, each requiring the payload: `sb_secret_[A-Za-z0-9_-]{8,}`, `[Bb]earer\s+[A-Za-z0-9._~+/-]{16,}`, `sb-[a-z0-9]+-auth-token=[A-Za-z0-9._%+/-]{8,}`, and a `Set-Cookie:` `name=value` pair. **All four return zero.** Per-file verification confirms all 24 `sb_secret_` occurrences have a zero payload count. The gating criterion is now the residual set; the shape sweep is reported as informational.
- **Files modified:** `.planning/audit/REDACTION.md` (§ Classification is by value shape, not by path)
- **Verification:** `SWEEP_RESULT=CLEAN`, exit 0, over three target trees and six shapes
- **Commit:** `43b9c09`
- **Filed as:** F-068, so the lesson is a finding rather than a footnote

### 2. [Rule 2 — Missing critical] Gate 2 left red on the two blocked schema snapshots

- **Found during:** Task 3
- **Issue:** The task's acceptance criterion says `node validate.mjs` exits 0 with all 21 checks passing. It exits 1: `schema-snapshots` fails on `schema/staging.schema.sql` and `schema/local.schema.sql`, both BLOCKED stubs from plan 01-06.
- **Fix:** the plan's own action text resolves this — *"fix the artifact or record the deferred requirement explicitly; do not weaken the gate."* Neither artifact can be produced read-only: staging needs a credential, and local is blocked by the repository's own migration history (F-043), which this phase may not modify. So the requirement is recorded as deferred: AUDIT-01 stays withheld in `REQUIREMENTS.md` with its reason intact, both rows are marked BLOCKED in `README.md` with the blocking input named, and both appear in `FOUNDATION_AUDIT.md` § Blocked Items with retry commands. The validator was **not** edited to skip, soften, or conditionally pass the check.
- **Files modified:** `.planning/audit/README.md` (§ Gate status at phase close)
- **Verification:** 118 passed, 2 failed, 1 skipped — the two failures are exactly the two blocked stubs
- **Commit:** `43b9c09`

### 3. [Rule 2 — Missing critical] Three stale README rows corrected beyond the plan's literal instruction

- **Found during:** Task 3
- **Issue:** Plan 01-04's summary recorded an action for 01-13: re-point the `baseline/build.txt` row from plan 01-04 to 01-03 (01-03 produced it, and `versions.txt`'s `build_exit_code` depends on it), add a missing `baseline/jest-listtests.txt` row, and flip all five baseline rows from `pending` to `present`. The plan text says "every artifact row's status correct" without naming these.
- **Fix:** all three applied, plus a per-artifact `Status` column that distinguishes `present` from `BLOCKED — <named input>` so a reader can tell a gap from an omission, and a requirement-coverage table mapping all 21 identifiers to complete or withheld.
- **Files modified:** `.planning/audit/README.md`
- **Verification:** 21 distinct `AUDIT-nn` identifiers present, 101 total occurrences
- **Commit:** `43b9c09`

**Total deviations:** 3, all Rule 2. **Impact:** no scope creep — every addition serves an acceptance criterion the plan already carried. All `files_modified` are exactly as specified; nothing outside `.planning/` was created, modified, or opened for write.

---

## Issues Encountered

- **The generator's finding-count assertion caught a real class of error at authoring time.** `gen-foundation-audit.mjs` exits non-zero if the rendered document references a different number of distinct ids than the register holds, or if the Tempting One-Liners list names an id that does not exist. Both checks are cheap and both are the failure mode the plan's T-01-13-05 threat names.
- **`grep` in this shell is a ugrep shim** that honours `.gitignore` and rejects some BRE patterns. Every count this plan relies on was taken with `command grep` inside a script file. The sweep in particular runs from a file under `bash` with its target paths in an array, because this shell is zsh and does not word-split unquoted expansions — 01-08's lesson, applied rather than re-learned.
- **Five untracked paths that are not this plan's were left alone throughout:** `docs/product-master-plan.md`, `.agents/`, `skills-lock.json`, `.mcp.json`, `.planning/research/.cache/`. Every commit staged named files individually; `git add -A` and `git add .` were never used, and no `git clean`, `git stash` or `git reset` ran at any point.

---

## Known Stubs

None. Every artifact is populated from committed evidence. The six BLOCKED entries are not stubs — each names its blocking input and carries a retry command, and each is marked as blocked in both `README.md` and `FOUNDATION_AUDIT.md` rather than presented as a result.

---

## Self-Check: PASSED

- `security/threat-model-anonymous.md`, `-tenant.md`, `-escalation.md` — FOUND, 71/69/69 lines, cap 120
- `tools/gen-foundation-audit.mjs` — FOUND, 316 lines (min 50)
- `findings.json` — FOUND, 70 records, schema-valid, all evidence paths resolve
- `FOUNDATION_AUDIT.md` — FOUND, 2,048 lines, 70 finding sections, `--check` reports up to date
- `REDACTION.md`, `README.md` — FOUND, rewritten
- Commits `07d8343`, `e618af3`, `43b9c09` — all present in `git log`
- `node validate.mjs --check threat-models` → 7 passed, 0 failed
- `node validate.mjs --check findings` → 8 passed, 0 failed
- `bash readonly-guard.sh` → exit 0

---

## Next Phase Readiness

**Phase 1 is complete.** Thirteen plans, thirteen summaries, nineteen of twenty-one requirements complete and two withheld with reasons and retry commands. The phase goal — *the true current state of the codebase is known with captured evidence, without a single source, config, dependency, or database change* — is met and mechanically demonstrated: 70 findings each with a reproduction and a validation criterion, and a working tree byte-identical to where the audit began.

**What Stage 3 inherits:** `findings.json` as a work queue. Its `recommended_fix` field is written to be sliceable and its `validation_criterion` field is written to be testable, which is the field CERT-11 iterates. The Tempting One-Liners list in `FOUNDATION_AUDIT.md` is the natural first slice — nine fixes already scoped, each with the reason it was deliberately not applied here.

**What the phase-completion step must handle:** the eight PROJECT.md and CLAUDE.md contradictions tabulated above. They are findings, not edits, because those files are outside this phase's write scope.

**Sequencing note for Stage 3:** F-043 (the migration history does not replay) gates F-012, F-016, F-035, F-042, F-044, F-045 and F-047. Nothing that needs a reproducible database should be scheduled before it.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
