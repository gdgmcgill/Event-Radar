---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 15
subsystem: cache-e2e-and-contract-regeneration
status: complete
tags: [cache, shared-cache, cross-user, endpoints-json, classify-inventory, playwright, REFAC-19, F-025, F-026, DI-26, DI-58, DI-81]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-12: CACHE_CLASSES, cachePolicy, applyCachePolicy (src/server/http.ts), withRoute, the census; 06-13/06-14: every route on withRoute and vercel.json without headers; 06-01: DI-58, DI-81, DEC-69, DEC-72, DEC-73"
provides:
  - "endpoints.json regenerated from the implemented classes: cache_policy_today and the cache signals read from each export's withRoute class; cache_policy_target carries C7, C8, C9 and DEC-69 as recorded corrections; DI-58 (a) and (b) fixed; rule V1 reads the zod contract boundary"
  - "e2e/helpers/sharedCacheProxy.ts: startSharedCacheProxy(upstream) -> { url, stats(), close() }, an in-memory stand-in for Vercel's shared CDN cache answering x-sim-cache HIT|MISS|BYPASS"
  - "e2e/specs/cross-user-cache.spec.ts: positive control, negative control (and eight rule refusals), nine personalized GETs A->B->anonymous, the C7 pending-event pair, the recorded public 404"
  - "e2e/specs/cache-headers.spec.ts: the live header sweep over every live endpoint row (118 GET requests, 59 anonymous mutations)"
  - "evidence/contract-regen-slice-7.txt, evidence/cache-e2e.txt; DI-87 and DI-88 in the phase deferred register"
affects: [06-16, 06-17, 06-18, phase-07]
tech-stack:
  added: []
  patterns:
    - "A shared-cache test needs a stand-in cache plus two controls: a public read must HIT, and a per-cookie body marked public must leak; without them 'B never sees A' passes trivially"
    - "The inventory's target column never reads the wrapper, so the census compares two independent sources"
    - "A cross-user absence check first proves the marker is in A's body, so it is never vacuous"
key-files:
  created:
    - e2e/helpers/sharedCacheProxy.ts
    - e2e/specs/cross-user-cache.spec.ts
    - e2e/specs/cache-headers.spec.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/contract-regen-slice-7.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/cache-e2e.txt
  modified:
    - .planning/audit/tools/classify-inventory.mjs
    - .planning/audit/inventory/endpoints.json
    - .planning/audit/inventory/classification-rules.md
    - .planning/audit/inventory/endpoints.csv
    - src/__tests__/api/cache-headers-census.test.ts
    - src/__tests__/api/cache-headers-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/deferred-items.md
decisions:
  - "cache_policy_today is read from each export's withRoute class, with the header text taken from src/server/http.ts POLICIES. cache_policy_target stays derived from the verdicts plus CACHE_TARGET_OVERRIDES and never reads the wrapper, so the census compares two independent sources."
  - "The classifier refreshes only four signals: the two cache signals and the two env signals (DI-58 (b)). The generator's regexes predate the seam, and a blanket refresh would flip uses_service_client on 20 elevated-door rows and rewrite their rls_reliance. Rule V1 reads the zod contract boundary; without that, 24 rows would have gone from manual to none."
  - "The three deleted-handler rows stay byte-for-byte (DEC-55), so they keep the audit-time blanket value, with a handler_deleted note. No live row carries it."
  - "The stand-in listens on 127.0.0.1, not localhost, because the persona cookies are host-only for 127.0.0.1."
metrics:
  duration: 22min
  completed: 2026-09-27
  tasks: 3
  files: 12
---

# Phase 6 Plan 15: Cache e2e and contract regeneration Summary

**Personalized responses were proven unshareable on the running app. A local stand-in for Vercel's CDN, with a positive control that HITs and a negative control that leaks, sat in front of every cross-user check. `endpoints.json` now records the cache class each route actually declares.** Every live route's `Cache-Control` and `x-request-id` were checked live, anonymous and signed in. The real-CDN probe is recorded as the owner's action DI-81.

## What was built

**Task 1 (`83e2f7e`): the contract, regenerated through the classifier only.**
- `classify-inventory.mjs` changes:
  - It reads `export const VERB = withRoute({ cache })` and maps the class to its header text from `POLICIES`.
  - vercel.json no longer contributes.
  - A live file with an unwrapped export is FATAL.
- `cache_policy_target` corrections, each recorded with its decision:
  - `/api/events/[id]` (C7) and `/api/health` (C8) become private.
  - The rsvp GET and `clubs/[id]/events` are pinned private (DEC-69).
  - `/api/events` gets public-30-60, and both featured routes get public-60-120 (C9).
- DI-58 fixes:
  - (a) the moderation-reviews mechanism text, and `/auth/callback`'s stale ADMIN_EMAILS-grant text;
  - (b) calculate-popularity's `ADMIN_API_KEY` env signals.
- Result: 91 rows changed (329 fields). The second run changes 0. `validate --check endpoints` passes 5/5. `--quick` matches the pre-edit run except for the env-gated count (2 → 1).
- The census keeps no override list, only the target-value → class map. The defect suite drives the two corrected rows at C4/C5 (44 → 46).

**Task 2 (`eaed119`): the stand-in and the cross-user spec.**
- The stand-in uses Node built-ins only. It applies Vercel's rules, keys on `METHOD URL` and holds bodies in memory only.
- RED on a pass-through stand-in: both controls fail. GREEN twice: 33/33, including 10 setup tests.
- Nine personalized GETs went club_member → onboarded_student → anonymous. None was a HIT, all answered `private, no-store`, and no A-only marker reached B.
- On the pending event, the admin's 200 is not served to an anonymous visitor, and the anonymous 404 is not served to the admin.

**Task 3 (`64939b2`): the live sweep.**
- Coverage: 91 live rows, 118 GET requests and 59 anonymous bodiless mutations. The 3 deleted-handler rows are skipped, each with its reason.
- Every 200 or 404 carries its row's class value; every other status is private.
- All 11 public rows answer 200 anonymously with their own value.
- Both cache specs passed 153/153 twice. The full suite passed 243/243 (21 spec files) from a fresh reset.

## Verification

- Task 1 verify: exit 0. validate 5/5; census 279 passed; the C7/C8 one-liner exits 0.
- Floor:
  - `npx jest --ci`: 125 suites, 3340 passed, 1 skipped (floor 3335, plus the new census and defect rows).
  - `tsc` exit 0; lint 0 errors (17 warnings, pre-existing).
  - Tag gate `ok 57 files`; contracts 0/0, `--client` violations 0.
  - Server-console census green; elevated ratchet 0/0.
- Task 2 verify: `tsc` exit 0, and `npx playwright test e2e/specs/cross-user-cache.spec.ts` exit 0 twice.
- Task 3 verify: `npx playwright test e2e/specs/cache-headers.spec.ts e2e/specs/cross-user-cache.spec.ts` exit 0 twice. The full `npx playwright test` exits 0 with 0 failed.
- `git status --porcelain -- src/` prints nothing.
- Port 3000 was free before and after every run. The stand-ins close in `afterAll`, and no listener outlived a run. The Docker stack is healthy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule V1 would have written a false `none` on 24 rows**
- **Found during:** Task 1 dry-run drift.
- **Issue:** The contracts from 06-04..06-10 replaced the handlers' inline `status: 400` lines. So the unedited classifier moved 24 validated rows from `manual` to `none`.
- **Fix:** A handler that reads input through `parseBody`, `parseQuery`, `readQuery`, `parseForm` or `parseWith` is `zod`. Live rows: 56 zod, 35 none, 0 manual. No live `none` row reads a body. The change is recorded in rules § V1.
- **Commit:** `83e2f7e`.

**2. [Rule 3 - Blocking] The cache defect suite's worklist grew with the corrected data**
- **Found during:** Task 1.
- **Issue:** `cache-headers-defect.test.ts` selects every GET row whose target is private. `/api/events/[id]` and `/api/health` therefore joined it without invokers, and C0 failed (6 failures).
- **Fix:** Both routes were already wrapped private by 06-14. They got invokers and joined ADOPTED (C4/C5), and the count moved 44 → 46. No pin moved, so no ledger row was added. The auth-debug reason now cites DEC-55.
- **Commit:** `83e2f7e`.

**3. [Rule 1 - Stale text] `/auth/callback`'s mechanism text named the removed ADMIN_EMAILS grant**
- This is the same class as DI-58 (a). F-004 was fixed in 05-05, and the text was corrected with it.
- **Commit:** `83e2f7e`.

### Measured differences from the plan (recorded)

- **The plan says no row keeps the blanket value; three rows do.** They are the DEC-55 retained deleted-handler rows (auth-debug and both cron rows). They are kept byte-for-byte with a `handler_deleted` note, which is what the plan's own "retained per DEC-55" requires. No live row carries the value.
- **Census overrides.** The slice outcome says "only the three byte-value overrides left". The action's wording, "keeping only the mapping from each public target value to its class name", was followed instead. The data now carries the byte values, so no override remains.
- **`notifications/[id]` was swept, not skipped.** Its only method is PATCH, which refuses an anonymous caller before any lookup. An unseeded id was used; the same goes for experiments, featured, organizer requests and reports.
- **Sign-out answers an anonymous POST with 302, not 401/400/403.** It is ban-exempt and open by design. The spec records this exception with its reason and still asserts `private, no-store`.
- **The stand-in is on 127.0.0.1, not localhost** (see decisions).
- **The first GREEN attempt failed on the spec's own marker.** club_member is an organizer but cannot see the pending event: RLS shows it only to its creator. The marker became the organizer view (`isOrganizer:true`, `rsvp_counts`). No app file changed. DEC-69's rationale ("members see pending events") holds only for the event's creator.

## TDD Gate Compliance

Task 2 carries `tdd="true"`, but the plan names a single `test(06-15)` commit. The RED run was recorded instead of committed: the spec ran on a pass-through stand-in and both controls failed (`evidence/cache-e2e.txt` § 2.1). GREEN followed the restore, and one commit carries both. There is no separate `feat` commit, because the helper is test infrastructure.

## Issues Encountered

- **Three GET routes answer 500 on the reset schema.** Their headers are correct; the bodies are not. They are registered as **DI-87**:
  - admin clubs, `PGRST200` (an embed with no FK);
  - admin organizer-requests, `PGRST201` (an ambiguous embed, and it logs nothing);
  - user/engagement, `PGRST205` (no view since F-048's migration was retired).
  They were reproduced locally with the routes' own selects.
- **A failed club-detail read answers a shareable 404.** 06-13 flagged this. The stand-in showed the class behaviour, but the error trigger can't be injected locally, so it is registered as **DI-88**.
- **Pre-existing:** the `search_events_fuzzy` 0A000 in the server log (F-078).

## Owner Actions

- **DI-81 item 3: the real-CDN two-session probe.** It was not run, and no recorded result exists in the repo. `evidence/cache-e2e.txt` § 5 has the exact commands: `PROD_HOST`, `COOKIE_A` and `COOKIE_B`, then `bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs`. The expected result: the controls HIT, and no personalized route is a HIT or STALE for session b. F-025 stays Open at "08" until then (DEC-72).
- **Registers for 06-18:** DI-58 is resolved by `83e2f7e` (evidence § 2, § 4). F-026's header clause and DI-26 are proven live (`cache-e2e.txt` § 3.3).

## Known Stubs

None.

## Threat Flags

None beyond the plan's model. The stand-in is a local test process with no production surface, and DI-87 and DI-88 are registered above.

## Requirements

- **REFAC-19: marked complete.** Each clause has committed evidence:
  - the blanket rule was removed (`6221669`);
  - personalized routes answer `private, no-store`, proven live on every personalized row (`64939b2`);
  - public routes opt in explicitly, through withRoute classes checked against independent targets (census, `83e2f7e`);
  - the cross-user cache regression test passes through a stand-in with both controls (`eaed119`).
  F-025's own criterion, the real-CDN probe, is a separate finding and stays Open at "08".
- **REFAC-23: left open.** It closes in 06-18, which re-confirms the harness and the Validated list at the slice close. This plan's full-suite pass (243/243) is its input.
