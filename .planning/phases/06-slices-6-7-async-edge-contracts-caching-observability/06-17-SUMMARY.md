---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 17
subsystem: health-and-admin-page-gates
status: complete
tags: [health, observability, authz, admin, REFAC-22, F-029, F-054, F-059, DI-55, DEC-78, DEC-79, playwright]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-05: public.cron_job_status() and the three local pg_cron jobs; 06-07: the F-029, F-054 and F-059 DEFECT pins; 06-12/06-14: withRoute, cache classes, the request id; 06-16: sentry state and the CSP-enforced harness"
provides:
  - "src/contracts/health.ts: HealthLiveness, HealthReport (strict zod schemas and types)"
  - "healthToken() in src/lib/env.ts (null when unset or under 32 characters, one warn line, never throws)"
  - "/api/health: liveness { status, version } for everyone; the documented report for an active admin or a bearer equal to HEALTH_TOKEN (SHA-256 digests, timingSafeEqual); private, no-store"
  - "REGISTRY row: health diagnostics (cron job status and the newest scraper-sourced insert)"
  - "docs/health.md: both shapes, auth modes, thresholds, statuses and HTTP codes"
  - "src/server/authz/requireAdminPage.ts: requireAdminPage(redirectTo) returning AdminPageContext"
  - "src/app/docs/layout.tsx and src/app/health/layout.tsx (admin-only, dynamic)"
  - "the /health page on the documented report shape"
  - "the moderation reviews route's admin path refuses a banned admin"
  - "e2e/specs/health.spec.ts, e2e/specs/admin-page-gates.spec.ts"
affects: [06-18, phase-07, phase-08]
tech-stack:
  added: []
  patterns:
    - "A page-shaped guard composes the route guards' predicates (isBanned, hasRole) and turns every refusal into redirect(target)"
    - "A client page parses its API body with the contract, so an unexpected shape renders as a state instead of a crash"
    - "Ledger-protocol swaps run from a .mjs with spawnSync's own timeout and file-descriptor stdio, never through a pipe a watcher process can hold open"
key-files:
  created:
    - src/contracts/health.ts
    - src/__tests__/api/health/health.test.ts
    - docs/health.md
    - src/server/authz/requireAdminPage.ts
    - src/server/__tests__/requireAdminPage.test.ts
    - src/app/docs/layout.tsx
    - src/app/health/layout.tsx
    - e2e/specs/health.spec.ts
    - e2e/specs/admin-page-gates.spec.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/health.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/admin-page-gates.txt
  modified:
    - src/app/api/health/route.ts
    - src/lib/env.ts
    - src/lib/env.test.ts
    - src/server/db/elevated/REGISTRY.md
    - scripts/server-console-allowlist.json
    - src/__tests__/api/health/health-defect.test.ts
    - src/__tests__/api/error-text-defect.test.ts
    - src/__tests__/api/cache-headers-defect.test.ts
    - src/server/__tests__/getsession-gate.test.ts
    - src/app/admin/layout.tsx
    - src/app/moderation/layout.tsx
    - src/app/health/page.tsx
    - src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts
    - src/__tests__/api/service-role-routing.test.ts
    - src/__tests__/pages/docs-gate-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "requireAdminPage returns an AdminPageContext (user and profile non-null). The moderation layout keeps its anonymous redirect to /admin-login and then calls requireAdminPage(\"/\"), so both of its targets stay what they were (DEC-44, DEC-79)."
  - "The moderation reviews ban check runs on the admin path only, as DEC-79 words it; the creator path is unchanged."
  - "The /health page parses the body with HealthReport and HealthLiveness and renders a liveness-only or unexpected body as such (research C18)."
metrics:
  duration: "22min for this run (17:37Z to 17:59Z); two earlier executors on this plan were lost before any commit"
  completed: 2026-09-27
  tasks: 2
  files: 27
---

# Phase 6 Plan 17: Health liveness and diagnostics; admin page gates Summary

`/api/health` now tells any caller only `{ status: "ok", version }`. An active admin, or an uptime monitor holding `HEALTH_TOKEN`, gets the documented report: db, auth, storage, pg_cron freshness per job, and the last scraper-sourced insert. No `getSession(` call is left under `src/`. `/docs` and `/health` are admin-only through one server helper, `requireAdminPage`. That helper also closes DI-55: a banned admin is now refused by the admin and moderation pages and by the moderation reviews API.

## What was built

**Task 1 (commit `747ef77`).** This run inherited the code, uncommitted, from the lost executors. I verified it, gave it its evidence and committed it:
- the contract (`src/contracts/health.ts`) and `healthToken()`;
- the rewritten route. It checks the bearer by comparing SHA-256 digests with `timingSafeEqual`, and otherwise decides the caller through `createRequestContext` → `requireActiveUser` → `requireRole(admin)`. The checks run concurrently. pg_cron is read through `getElevatedClient().rpc("cron_job_status")`, and PGRST202 reports `unknown` instead of a 500;
- the REGISTRY row and `docs/health.md` (189 lines);
- the moved pins: F-029 H1–H5, health's nine F-059 rows plus E0, and two cache-header lines;
- the getsession-gate tightening, and the health entries removed from the allow-list.

Five-step protocol: unedited DEFECT suites red (15 failed), moved suites green, pre-fix route red, `cmp` exit 0. The targeted suites pass 232/232, and tsc, lint and every census exit 0.

**Task 2 (commit `00aa06d`).** Changes:
- `requireAdminPage(redirectTo)` redirects anonymous, profile-less, banned and non-admin callers. Its test was recorded red first (module missing), then passed 9/9.
- The admin layout calls it with `/`. The moderation layout keeps `/admin-login` for anonymous callers and uses `/` otherwise. The new docs and health layouts use `/`.
- The /health page was rewritten on `@/contracts/health`, without the OAuth and memory panels and with the 30-second refresh kept.
- The reviews route's admin path runs `requireActiveUser`. Its banned-admin row went red against the HEAD route and green against the fix.
- F-054 G1 and G2 moved: unedited red at G1, moved green 8/8, red with the layout moved aside (5 failed), `cmp` exit 0.

From `supabase db reset --local` and the seed, each spec ran on its own:

| Spec | Result |
|---|---|
| `health.spec.ts` | 14 passed |
| `admin-page-gates.spec.ts` | 16 passed |
| `admin-guard.spec.ts` | 13 passed |
| `admin-moderation-queue.spec.ts` | 13 passed |

Each count includes the ten setup sign-ins. `npm run build` lists `ƒ /docs`, `ƒ /health` and `ƒ /api/health`, all dynamic.

## Verification

| Check | Result |
|---|---|
| Task 1 `<verify>` suites + `getSession(` census + server-console census | exit 0; census 0 lines; committed=2 live=2 |
| Task 2 `<verify>` Jest half | exit 0, 23 tests |
| Task 2 `<verify>` Playwright half | all four spec files exit 0 from a fresh reset |
| `npx jest --ci` (combined tree) | 3439 passed, 1 skipped (the env-gated Upstash contract suite); +48 over 06-16 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 17 warnings (unchanged) |
| check-contracts (both modes), check-elevated-ratchet, check-characterization-tags --all | exit 0 |
| port 3000 before/after Playwright | free / free |

## Deviations from Plan

**1. [Known, accepted] The server-console allow-list keeps two entries, not one.** The plan's acceptance check wants only `src/lib/tagMapping.ts` and exits 1. 06-14 deliberately kept a reasoned entry for `src/app/auth/callback/route.ts`: its failed-sign-in redirect carries the provider error text, a PRESERVE suite pins that, and Phase 7 owns the decision. Every health entry was removed. The end state is exactly callback + tagMapping, and the live census agrees.

**2. [Anticipated PRESERVE tightening] `getsession-gate.test.ts`.** One assertion changes from `["src/app/api/health/route.ts"]` to `[]`, along with its header text. The suite's own header anticipated this commit, and the plan's Task 1 action directs it. Nothing is loosened; the orchestrator ruled to keep it.

**3. [Rule 2 - Missing critical] Banned-admin row for the reviews route.** The plan names no test file for this behaviour. I added the row to `src/__tests__/api/service-role-routing.test.ts`, a plain suite that already drives this route's admin and creator paths. It was recorded red, then green. Commit `00aa06d`.

**4. [Scope] The reviews ban check covers the admin path only.** This follows DEC-79's wording ("the admin path runs requireActiveUser"). The Task 2 action text could also be read as covering all callers, but that would also refuse banned or profile-less creators reading their own reviews, which no finding asks for.

**5. [Rule 3 - Blocking] The protocol script stalled for 9 minutes.** `with-timeout.sh` kills its watcher subshell but not the `sleep 400` inside it. That orphaned `sleep` held the pipe that `spawnSync` was reading, so the call waited. Jest itself took 1.5 s. I killed the script while no file was swapped, checked every file with `cmp`, and re-ran steps 3–5 with spawnSync's own timeout and file stdio. `with-timeout.sh` itself is still unfixed; it is safe only when its output goes to a file.

**6. `src/__tests__/helpers/fakeSupabase.ts` needed no change.** It was in the plan's files list, but `health.test.ts` scripts the `cron_job_status` rows and PGRST202 through the existing rpc and error scripting.

**7. Additions.** G5 in `docs-gate-defect.test.ts` checks that the /health layout carries the same gate. `AdminPageContext` narrows the returned context so the moderation layout needs no non-null assertion.

## Issues and notes

- **REFAC-22 marked complete.** Every clause is met by committed evidence: the five checks, the documented shape, and no session accessor. In production, `pg_cron` reports `unknown` until the DI-23 schema repair, and `docs/health.md` says so. `webhook.last_ingest_at` records the last scraper-sourced insert by any path, not delivery through the edge function (C23); that is documented too.
- **The banned-admin arm is unit-pinned only.** The seed has no banned admin persona, and adding one would move rows other specs read.
- The stale `npm run dev` wrappers (15950, 15966), DI-87 and DI-88 belong to other work and were left alone. The harness log's "Unmapped tags rendered as Social" lines come from the existing tagMapping path.

## Pending owner actions (DI-81; for PHASE-6-COMPLETION.md)

1. Set `HEALTH_TOKEN` (32+ characters) in Vercel for the uptime monitor, and add it to `.env.local.example`. The example-file update is the owner's (docs/health.md).

## Known Stubs

None.

## Threat Flags

None. The report path goes through the elevated door for exactly the REGISTRY row added, and the bearer path is T-06-17-02's design.

## Self-Check: PASSED

All created files exist, and commits `747ef77` and `00aa06d` are in `git log`.
