---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
verified: 2026-09-16T03:34:51Z
status: passed
score: 5/5 success criteria verified (17/17 clauses evidenced; 1 clause carries a recorded human decision, DEC-22)
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "No file under src/ casts the Supabase client away to escape its own types (03-06 must_haves.truths, feeding ROADMAP SC2's 'casts... count zero' clause)"
    reason: "45 of 47 in-scope casts were removed. The remaining 2 (src/app/api/events/[id]/friends/route.ts, src/app/moderation/page.tsx) are each the only thing making their file type-check; every route to zero casts requires a behaviour change the phase's own characterize-first rule forbids. Both sites are annotated in source with a registered finding id (F-071, F-072/F-073) and a pinning characterization test, and the deviation is recorded as decision DEC-22. REFAC-04 is correspondingly recorded PARTIAL, not Complete, in both ROADMAP.md and REQUIREMENTS.md — the gap is disclosed, not hidden."
    accepted_by: "Adyan Ullah (recorded in evidence/FOUNDATION-READINESS.md §2c and .planning/audit/quality/cast-removal-defects.md as DEC-22)"
    accepted_at: "2026-09-15"
---

# Phase 3: Refactor Foundations — Schema Truth and the Seam Kit — Verification Report

**Phase Goal:** The schema, the generated types, the server seam, the persona test harness, and the deterministic seed all exist and agree with production — so a vertical slice has a layer to refactor into and a net to fall into.
**Verified:** 2026-09-16T03:34:51Z
**Status:** passed
**Re-verification:** No — initial verification

**Note on `Mode: mvp`:** ROADMAP.md tags Phase 3 `Mode: mvp`, but the phase goal text is not a User Story (`As a … I want … so that ….`) and this phase delivers infrastructure (schema, types, seam, harness, seed), not a user-facing feature. `gsd_run query user-story.validate` would correctly reject this goal text. Standard goal-backward verification against the five ROADMAP.md success criteria was applied instead, per the explicit verification task given for this phase. This is a roadmap metadata inconsistency worth fixing (info-level, not a phase gap).

## Goal Achievement

All five ROADMAP.md Phase 3 success criteria were independently re-derived against the current tree (HEAD `b9f9bcb`) rather than trusted from SUMMARY.md or evidence/ narrative. Every command below was executed by the verifier in this session; none of the results were copy-pasted from a prior evidence file without re-running.

### Observable Truths (mapped to the 5 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `supabase db reset` replays the migrations folder to completion with no skipped file, and the resulting schema diffs clean against production | ✓ VERIFIED | Re-ran `supabase db reset --local` live: 3 top-level migrations applied (`baseline`, `fk_indexes_and_policy_gaps`, `cron_compute_user_scores`), exit 0, no skip. `evidence/db-diff.prod.sql` is 0 bytes on disk (confirmed `ls -la`). 44 pre-baseline files independently confirmed as pure git renames: `git show --diff-filter=R --stat 799bce0` → "44 files changed, 0 insertions(+), 0 deletions(-)". |
| 2 | Audit-named FK indexes and RLS policy gaps are fixed via new migrations, each carrying a pgTAP allow/deny test that is proven to bite | ✓ VERIFIED | Re-ran `supabase test db --local`: `Files=5, Tests=68, Result: PASS` (010-fk-indexes, 020-rls-policy-gaps, 030-cron-schedule, 040-seed-coverage all `ok`). Mutation-check evidence (`pgtap-mutation-check.txt`) shows each of the 3 new policies removed in turn produces named failures and green on restore — narrative only reviewed here, not independently re-mutated (would require editing migration files, prohibited by this verifier's read-only mandate). |
| 3 | The `compute_user_scores` pg_cron schedule is codified as an idempotent migration | ✓ VERIFIED | `030-cron-schedule.test.sql` passed live in the `supabase test db --local` run above (part of the 68 assertions). Migration `20260915230100_cron_compute_user_scores.sql` present at top level of `supabase/migrations/`. |
| 4 | Supabase types are generated from the reconciled schema, a CI step fails on type drift, and `(supabase as any)` casts in `src/` are near-zero with the remainder deliberately negotiated | ⚠️ VERIFIED WITH RECORDED OVERRIDE | Re-ran `supabase gen types typescript --local --schema public` and diffed against the committed `src/lib/supabase/types.ts`: **byte-identical** (`diff` exit 0). CI drift-gate job (`types`) independently confirmed **green on the current HEAD** via `gh run view 35051675626` (see CI Verification below). Cast census: `grep -rn "supabase as any" src/` → exactly 2 hits in source (`friends/route.ts`, `moderation/page.tsx`), both annotated in-source with finding IDs F-071 / F-072-F-073 and a named pinning test; both pinning tests (`friends-defect.test.ts`, `audit-shape.test.ts`) pass (11/11). This is a disclosed, human-decided partial (DEC-22), not a hidden gap — REFAC-04 is correctly recorded PARTIAL in REQUIREMENTS.md. See `overrides` in frontmatter. |
| 5 | `src/server/` exists with request context, http/error helpers, three authz guards, and `src/server/db/elevated/` as the only door to the service-role client, applied to zero routes, with an ESLint boundary rule that fails the build on violation | ✓ VERIFIED | All seven files exist, substantive (397 total lines across context/http/errors/3 guards/elevated door, none stubbed). `grep -rl "from \"@/server" src/app/` → empty (zero routes use the seam). Independently reproduced the ESLint boundary bite: wrote a throwaway fixture importing `@/lib/supabase/service` under `src/app/`, ran `npx eslint` → exit 1, exact message "Service-role access must go through src/server/db/elevated/...". Fixture deleted immediately after; `git status` confirmed clean. Ratchet re-run live: `node scripts/check-elevated-ratchet.mjs` → `committed=24 live=24 delta=0`, exit 0. |
| 6 | A Playwright persona harness runs against local Supabase with one storage state per persona and at least 6 happy-path specs, backed by a deterministic seed covering every role/ban/club/event axis with a hard-refusing target guard | ✓ VERIFIED | `npx playwright test --list` re-run live → **27 tests in 8 files** (10 setup + 17 specs across 7 spec files), matching claim exactly. No storage states tracked in git (`git ls-files \| grep storage-state` empty; `.gitignore` excludes `playwright/.auth/`). Seed determinism independently re-derived: reset DB, loaded seed twice with no reset in between, dumped both times — **byte-identical, sha256 `964ac785…`, matching the claimed hash exactly**. Guard unit tests re-run: 5/5 pass. Guard refusal live-reproduced: `SUPABASE_URL=https://someoneelsesproject.supabase.co ... npx tsx scripts/seed/load.ts` → `REFUSED:...`, exit 1. |
| 7 | The auth callback route has passing characterization tests written before anything modifies it, and the route file is unmodified | ✓ VERIFIED | `npx jest src/app/auth/callback/route.test.ts` re-run live → 8/8 pass. `git log -1 -- src/app/auth/callback/route.ts` → last touched `4fc9c9f` (2026-03-17), predating Phase 3 entirely — the route was never modified by this phase. Mutation-check evidence shows 9/9 mutation cycles turned the suite red with the hash before/after mutation cycles identical, confirming assertions are load-bearing (reviewed narrative, not independently re-mutated for the same reason as #2). |

**Score:** 7/7 truths verified (1 carries a disclosed, human-approved override on its cast-count sub-clause). 0 behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/context.ts`, `http.ts`, `errors.ts` | Request-context + http/error helpers | ✓ VERIFIED | 108/29/61 lines, substantive; `createRequestContext()` reads user then scoped profile, returns null-safe shape for anonymous requests |
| `src/server/authz/requireUser.ts`, `requireRole.ts`, `requireClubRole.ts` | Fail-closed authz guards | ✓ VERIFIED | 35/56/74 lines; 46 passing unit tests across all seam files exercise deny-by-default (no membership → deny, empty role set → deny, anonymous → 401 not 403) |
| `src/server/db/elevated/index.ts` + `REGISTRY.md` | Single door to service-role client | ✓ VERIFIED | Wraps `createServiceClient()`, no re-implementation; register deliberately empty (0 rows), matching "applied to zero routes" claim |
| `eslint.elevated-allowlist.mjs` + `scripts/check-elevated-ratchet.mjs` | Shrink-only ratchet | ✓ VERIFIED | 24 committed = 24 live, delta 0, exit 0 |
| `supabase/migrations/*` (3 top-level) + `_archive_pre_baseline/` | Reconciled baseline + fixes | ✓ VERIFIED | `db reset --local` replays all 3 clean; 44 archived files are pure renames (git-confirmed) |
| `supabase/tests/database/*.test.sql` | pgTAP allow/deny + coverage | ✓ VERIFIED | 68 assertions, `supabase test db --local` → PASS |
| `src/lib/supabase/types.ts` | Generated types | ✓ VERIFIED | Byte-identical to a fresh `supabase gen types --local` run |
| `scripts/seed/*.ts` | Deterministic seed + guard | ✓ VERIFIED | Determinism hash re-derived and matched; guard refusal reproduced live |
| `playwright.config.ts`, `e2e/*` | Persona harness | ✓ VERIFIED | 27 tests / 8 files listed live |
| `src/app/auth/callback/route.test.ts` | Characterization suite | ✓ VERIFIED | 8/8 pass, route file untouched since before the phase |
| `evidence/FOUNDATION-READINESS.md`, `repair-outcome.md`, `deferred-items.md` | Close-out record | ✓ VERIFIED | 134 path-like citations extracted from FOUNDATION-READINESS.md, 0 missing on disk (superset of the claimed 107-citation floor) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/app/**` (any file) | `@/lib/supabase/service` | ESLint `no-restricted-imports` boundary | ✓ WIRED | Reproduced live: a fixture importing the service client under `src/app/` fails lint (exit 1) with the exact configured message |
| `.github/workflows/ci.yml` (`types` job) | `src/lib/supabase/types.ts` | `supabase gen types --local` + `diff` | ✓ WIRED | Independently regenerated and diffed locally (exit 0, byte-identical); CI run `35051675626` on current HEAD shows the `types` job green |
| `scripts/seed/load.ts` | `scripts/seed/guard.ts` | `assertSeedTargetAllowed()` called as the loader's first statement | ✓ WIRED | `grep -n "assertSeedTargetAllowed" scripts/seed/load.ts` → imported and called at line 446, before any client is constructed; refusal reproduced live |
| `e2e/auth.setup.ts` | seeded personas | Playwright setup project | ✓ WIRED | `playwright test --list` shows 10 setup-project entries, one per persona named in `scripts/seed/personas.ts` |
| `supabase/migrations/` | `supabase/tests/database/` | `supabase test db` | ✓ WIRED | All 3 new-migration test files execute and pass against the replayed local schema |

### CI Verification (independently re-checked, not trusted from SUMMARY)

The task brief flagged CI run `35049602081` as RED on the `e2e` job (environment-precedence bug) and a fix (`855da7f`) plus a follow-up run `35051675626` "in progress." Checked live:

```
$ gh run view 35051675626 --json conclusion,jobs
headSha: b9f9bcb8efdea49c0c4cf819cd8d23fb0e930604  (= current HEAD)
conclusion: success
  job "Schema truth — type drift gate and database tests" -> success
  job "ci" -> success
  job "Persona harness — end-to-end specs against the seeded local stack" -> success
```

**All three jobs are green on the current HEAD, including the previously-red `e2e` job.** This is better than what REQUIREMENTS.md's REFAC-06 row and ROADMAP.md's Wave 6 narrative currently state (both still describe the `e2e` job as RED / "observed on exactly one machine") — those documents were written between commits `447724c` and `64defcd`, before the `855da7f` fix and the subsequent green run landed. This is a **documentation staleness note, not a functional gap**: the underlying reality is now stronger than what is written down, and REFAC-06 was already recorded Complete regardless. Diagnosis in `evidence/ci-e2e-red.txt` was independently confirmed against `e2e/env.ts` — the fix correctly stops consulting ambient `NEXT_PUBLIC_SUPABASE_*` in favor of the explicit `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` trio.

### Requirements Coverage

| Requirement | Source Plan(s) | REQUIREMENTS.md State | Verifier Assessment |
|-------------|-----------------|------------------------|----------------------|
| REFAC-01 | 03-01, 03-04 | Partial — migration repair deferred to Phase 8 | ✓ Confirmed accurate. `db reset`/`db diff` clauses independently re-verified; production untouched (repair command never run, confirmed in `evidence/repair-outcome.md`) |
| REFAC-02 | 03-05 | Complete | ✓ Confirmed. 68 pgTAP assertions pass live |
| REFAC-03 | 03-05 | Complete | ✓ Confirmed. Cron schedule migration present and tested |
| REFAC-04 | 03-06 | Partial — 45/47 casts, DEC-22 | ✓ Confirmed accurate and disclosed (see override above) |
| REFAC-05 | 03-03 | Complete | ✓ Confirmed. Seam substantive, zero routes, boundary bites live |
| REFAC-06 | 03-07 | Complete | ✓ Confirmed, and stronger than documented (e2e CI now green, see CI Verification) |
| REFAC-07 | 03-07 | Partial — "and staging" clause unmet, no staging project exists | ✓ Confirmed accurate. Local/guard clauses independently re-verified; staging is genuinely absent (no staging project in this program per Phase 1 capture) |
| REFAC-08 | 03-02 | Complete | ✓ Confirmed. 8/8 tests pass, route file provably untouched since before the phase |

**No orphaned requirements.** All 8 REFAC IDs declared in Phase 3 plans (`grep "requirements:"` across all 8 PLAN files) match exactly the 8 REFAC IDs the phase brief and ROADMAP.md assign to Phase 3.

### Regression Check Against Phase 2 Floor

| Check | Phase 2 Floor | Phase 3 (re-run live) | Status |
|-------|----------------|------------------------|--------|
| `check-baseline.mjs` | 22/0 | 22 passed, 0 failed, 0 skipped | ✓ NO REGRESSION |
| `npx tsc --noEmit` | clean | exit 0, zero bytes stdout/stderr | ✓ NO REGRESSION |
| `npm run lint` | 0 errors | 0 errors, 19 warnings (baseline check attributes the +7 delta to a pre-existing rule, not a regression) | ✓ NO REGRESSION |
| `npx jest --ci` | 220 passing baseline | 348 passed, 5 skipped, 33/34 suites | ✓ IMPROVED |
| `npm audit --audit-level=high --omit=dev` | 0 high | exit 0 (2 moderate, unrelated to `--audit-level=high` gate) | ✓ NO REGRESSION |
| `npx next build` | — | Completes, full route manifest emitted | ✓ PASS |

### Anti-Patterns Found

Scanned all 35 `src/`, `scripts/`, and `eslint.*` files declared across the 8 plans' `files_modified` frontmatter for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub patterns (`return null` used as a stand-in, empty handlers, hardcoded-empty state feeding render).

**None found.** The two retained `(supabase as any)` casts are the only deliberately-left-incomplete items in source, and both are annotated with a registered finding ID and a pinning characterization test rather than a bare debt marker — they do not match the debt-marker gate pattern and are already accounted for as a disclosed override above.

### Human Verification Required

None. This phase delivers infrastructure (schema, generated types, a server-side seam kit, a test harness, a seed loader) with no new user-facing UI, and every must-have was verifiable through re-run commands, live fixture reproduction, and passing tests rather than visual or subjective judgment.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are met; the one sub-clause that is not literally satisfied (zero Supabase-client casts, 45/47 achieved) is a disclosed, human-decided, evidenced exception (DEC-22) rather than an unaddressed gap, and is already correctly reflected as a "Partial" requirement state in both ROADMAP.md and REQUIREMENTS.md rather than being rounded up to "Complete." REFAC-01's production migration repair and REFAC-07's staging clause are likewise correctly recorded as deferred/partial with named owning phases (Phase 8, Phase 7/CERT-01) — this phase closes entirely read-only toward production, independently confirmed via `evidence/repair-outcome.md` and the byte-identical migration-history hash across all 8 plans.

One informational note: REQUIREMENTS.md's REFAC-06 narrative and ROADMAP.md's Wave 6 summary describe the CI `e2e` job as still RED; a later commit (`855da7f`, followed by CI run `35051675626`) fixed it and it is now green on the current HEAD. Since REFAC-06 was already recorded Complete and no success criterion depended on the fix, this is not a gap — but the two documents could be touched up in a future pass to reflect the improved state.

---

_Verified: 2026-09-16T03:34:51Z_
_Verifier: Claude (gsd-verifier)_

---

## Addendum — post-verification code review and fixes (2026-09-16, orchestrator)

The verification above was performed at `b9f9bcb`. After it, the phase's advisory code review (`03-REVIEW.md`, 74 files, 5 Critical / 12 Warning / 9 Info) was actioned in `03-REVIEW-FIX.md`: eleven fix commits (`20db8e3` … `bb4b77a`) landed a fix-forward migration `20260916000000_invitation_policy_fixes.sql` (invitee UPDATE policy pins `club_id`, enforces expiry and compares emails case-insensitively; the `club_members` INSERT policy an invitee needs to accept), harness hardening (`reuseExistingServer: false`, all-or-nothing `SUPABASE_*` overrides), seed purge error checks, CI least-privilege permissions with SHA-pinned actions, and registrations F-074..F-078 / DI-34, DI-35 for the production-codified findings that are out of this phase's charter.

Gates re-run on `5657a3c` (the tree the phase closes on): build 0 · `npx jest --ci` **358 passed / 5 skipped, 34 of 35 suites** (was 348) · `check-baseline.mjs` 22/0 · lint 0 errors / 19 warnings · `tsc --noEmit` clean · `npm audit --audit-level=high --omit=dev` 0 · ratchet census 24/24 · 4 migration filenames parse · `supabase test db --local` 86 (was 68) · mutation harness 4 policies green · `npx playwright test` 27 passed (fixer's run). CI on `5657a3c`: run `35055054211` — see the phase-complete report for its conclusion. Status above stands: **passed**. Production remains unwritten.
