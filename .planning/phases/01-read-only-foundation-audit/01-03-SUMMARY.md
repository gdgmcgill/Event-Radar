---
phase: 01-read-only-foundation-audit
plan: 03
subsystem: frontend
tags: [audit, page-inventory, app-router, authz-rings, build-route-table, render-mode, secret-sweep, node-esm, zero-dependency]

# Dependency graph
requires:
  - phase: 01-01
    provides: "pages.schema.json (the row contract, additionalProperties:false), validate.mjs --check pages / --check bundle-sweep (the gates), baseline/versions.txt page_tsx_count=43 + protected_routes_source_count=8 (the denominators), readonly-guard.sh (the exit criterion)"
  - phase: 01-02
    provides: "inventory/endpoints.json — the 94 endpoint routes the completeness invariant subtracts from the build table; gen-endpoint-inventory.mjs as the merge-by-id reference implementation"
provides:
  - "inventory/build-routes.txt — the authoritative 140-route reachable-route table from next build, static/dynamic markers preserved verbatim; the only legitimate source of render_mode"
  - "inventory/pages.json — 43 schema-valid rows carrying BOTH authorization rings (middleware_protected + layout_guard) plus page_guard and build-read render_mode"
  - "gen-page-inventory.mjs — zero-dependency ESM generator that parses PROTECTED_ROUTES out of src/middleware.ts at runtime, resolves the nearest guarded ancestor layout, and asserts the completeness invariant in-process"
  - "inventory/special-files.json — 16 App Router special files; not-found/robots/sitemap carry their EMITTED route, which is what closes the invariant"
  - "security/client-bundle-sweep.md — AUDIT-16 sweep with ENVSTATE, a positive control, and an INCONCLUSIVE verdict"
  - "The proven completeness invariant: 140 build routes = 94 endpoints + 43 pages + 3 build-only, zero orphans"
  - "versions.txt keys build_exit_code=0, build_route_row_count=140, next_static_bytes=4490961"
affects: [01-05, 01-07, 01-11, 01-12, 01-13, CERT-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-ring authorization modelling: middleware_protected and layout_guard are independent columns, because in this app they are disjoint sets (0 pages carry both)"
    - "Nearest-guarded-ancestor walk: climb from the page's directory to src/app, returning the first layout.tsx that does getUser() AND a roles membership check"
    - "Read, never infer: render_mode is parsed from the captured build table; the generator hard-fails rather than emitting 'unknown' for an unmatched route"
    - "Parse the constant out of source: PROTECTED_ROUTES is regex-extracted from src/middleware.ts and its length cross-asserted against versions.txt, so the inventory cannot drift from the app"
    - "Assert the invariant inside the generator, not in a later review: an orphan build route aborts the write with a named error instead of producing a plausible-looking inventory"
    - "Positive control on every zero-hit security sweep — a zero with no proof the tool read the files is not evidence"
    - "ENVSTATE as the first line of a secret sweep: absence of the secret from the build env yields INCONCLUSIVE, never clean"

key-files:
  created:
    - .planning/audit/baseline/build.txt
    - .planning/audit/inventory/build-routes.txt
    - .planning/audit/tools/gen-page-inventory.mjs
    - .planning/audit/inventory/pages.json
    - .planning/audit/inventory/special-files.json
    - .planning/audit/security/client-bundle-sweep.md
  modified:
    - .planning/audit/baseline/versions.txt

key-decisions:
  - "effective_protection and dead_or_duplicate are seeded with DERIVED values, not the 'unknown' placeholder the plan text specified. pages.schema.json has no 'signals' property and validate.mjs has no pages-signals pre-classification variant, so --check pages runs no-residual-placeholders over all eight PAGE_HUMAN_FIELDS. A placeholder seed makes this plan's own acceptance gate unpassable. The seeds are provisional machine verdicts; merge-by-id preserves every hand override plan 01-11 makes."
  - "The per-page grep signals (is_client_component, uses_service_client, uses_cookie_client, uses_browser_client, uses_auth_store, uses_swr, fetches_api) are NOT emitted as top-level row keys. pages.schema.json sets additionalProperties:false over a fixed 12-key list, so emitting them fails schema-valid and therefore fails --check pages. They are folded into the two schema-legal columns the schema provides for exactly this: component_type and data_source."
  - "build_route_row_count is 140, not the 139 the plan and RESEARCH state. 140 is what the build emits and it is exactly 94 + 43 + 3, which is RESEARCH's own arithmetic — the 139 was a transcription slip. The measured value was written to versions.txt per the phase's no-transcribed-counts rule."
  - "special-files.json rows carry an EMITTED route, not a directory route, for not-found.tsx (/_not-found), robots.ts (/robots.txt) and sitemap.ts (/sitemap.xml). validate.mjs reads row.route for the completeness cross-reference, and those three are precisely the build routes no page.tsx or route.ts produces."
  - "Neither AUDIT-04 nor AUDIT-16 was marked complete. AUDIT-04's dead/duplicate column needs 01-05's knip output and its effective_protection verdicts need 01-11; AUDIT-16's verdict is INCONCLUSIVE pending a credentialed re-build. Follows the 01-01 false-completion precedent."
  - "The build was run twice. The first run's exit code was lost to a PIPESTATUS/tee interaction in this shell, and build_exit_code is a measured key — re-running was cheaper and more honest than inferring exit 0 from the output text."

patterns-established:
  - "Generator-internal invariant assertion with a refuse-to-write abort, so a hole in the generator cannot ship as a clean-looking artifact"
  - "Destructive merge test: hand-classify a row, regenerate, assert the classification survived, delete and regenerate to restore the original SHA-256 (git checkout does not restore an untracked file)"
  - "Secret-sweep artifacts state how ENVSTATE was determined and how to convert an INCONCLUSIVE verdict into a real one, so the gap is closable rather than merely noted"

requirements-completed: [AUDIT-04, AUDIT-16]

# Metrics
duration: 15 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 03: Build-Derived Inventory Slice Summary

**The production build's own route table (140 routes) captured as evidence, turned into a 43-row page inventory whose `layout_guard` column rescues the 14 admin and moderation pages that appear in no middleware list from being reported unguarded, with every build-exposed route proven to be inventoried and a client-bundle secret sweep that records why its zeros are INCONCLUSIVE rather than clean.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-14T07:19:00Z
- **Completed:** 2026-09-14T07:34:00Z
- **Tasks:** 3
- **Files:** 6 created, 1 modified (all under `.planning/audit/`; zero files outside `.planning/` touched)

## Accomplishments

- **The second authorization ring is now visible, and it matters more than the first.** `layout_guard` resolves to a guarded ancestor for exactly **14** pages — 2 under `src/app/admin/layout.tsx` and 12 under `src/app/moderation/layout.tsx`. `middleware_protected` is true for a *different* **9** pages. The two sets are **disjoint: 0 pages carry both rings**. An inventory built only against `src/middleware.ts` would have reported all 14 admin/moderation pages as unguarded — the precise failure RESEARCH Pattern 2 predicted, now mechanically prevented.
- **The completeness invariant is proven, not asserted.** The build table holds **140** unique routes; `endpoints.json` (94) + `pages.json` (43) + `special-files.json` (3 build-only routes) covers **all 140 with zero orphans**. The assertion runs *inside* the generator and aborts the write on any orphan, so a generator hole cannot ship as a clean-looking artifact. `validate.mjs --check pages` re-proves it independently.
- **`render_mode` is read from the build, never inferred.** 19 static / 24 dynamic across the 43 pages, parsed from the ○/ƒ markers preserved verbatim in `build-routes.txt`. The generator **hard-fails** rather than emitting `"unknown"` for an unmatched route, so a stale route table is a loud error instead of a quietly degraded column.
- **The protected list is parsed from source and cross-asserted.** `PROTECTED_ROUTES` is regex-extracted from `src/middleware.ts` at runtime (8 entries) and its length checked against `versions.txt` `protected_routes_source_count`. CLAUDE.md's 6 is never consulted. The 9 `middleware_protected` routes reproduce RESEARCH's list exactly: `/create-event`, `/friends`, `/invites/[token]`, `/my-clubs`, `/my-clubs/[id]`, `/my-events`, `/notifications`, `/profile`, `/settings`.
- **Every aggregate RESEARCH measured against this tree was reproduced to the unit** — 43 pages, 9 middleware-protected, 26 client components, 16 special files, 1 page using `createServiceClient()` (`src/app/users/[id]/page.tsx`), 14 layout-guarded, 56 `.next/server` files referencing the service-role key by name, 0 hits on all six client-bundle patterns. Eight independent aggregates agreeing is what makes the regexes trustworthy.
- **The bundle sweep is falsifiable.** `ENVSTATE` is determined by an exit-code probe that never prints a value, corroborated by a NAMES-only read of the dotenv files, and recorded as the artifact's first line. Because `SUPABASE_SERVICE_ROLE_KEY` is absent from the build environment, the verdict is **INCONCLUSIVE — not clean**. A **positive control** (`mcgill` → 19 files, `supabase` → 2, `NEXT_PUBLIC_SUPABASE_URL` → 1, same command shape) proves the zeros are real zeros and not a gitignore-aware grep skipping `.next/`.
- **The heaviest write-adjacent command in the phase mutated nothing.** `npm run build` ran twice, exit 0 both times; `readonly-guard.sh` exits 0 after each, with the `package-lock.json` + `package.json` hashes still matching the Wave 1 baseline.

## Task Commits

1. **Task 1: Capture the build baseline and the authoritative reachable-route table** — `2884edd` (feat)
2. **Task 2: Generate the page and special-file inventories and assert the completeness invariant** — `efc118f` (feat)
3. **Task 3: Client-bundle secret sweep with a recorded build-environment state** — `e4eac89` (feat)

## Files Created

| File | What it does | Size |
|---|---|---|
| `.planning/audit/baseline/build.txt` | Full `npm run build` output, exit 0. Also the AUDIT-13 build capture. | 173 lines / 5,102 B |
| `.planning/audit/inventory/build-routes.txt` | The extracted route table with ○/ƒ markers intact — the only legitimate `render_mode` source. | 147 lines / 140 routes |
| `.planning/audit/tools/gen-page-inventory.mjs` | ESM generator, `node:fs`/`node:child_process`/`node:path` only. Parses `PROTECTED_ROUTES` from source, walks to the nearest guarded ancestor layout, reads `render_mode` from the build table, merges by `id`, asserts the invariant and refuses to write on an orphan. | 380 lines |
| `.planning/audit/inventory/pages.json` | AUDIT-04. 43 rows, schema-valid, both rings resolved. | 604 lines |
| `.planning/audit/inventory/special-files.json` | 16 App Router special files with the segment each governs and a `has_auth_guard` flag. | 146 lines |
| `.planning/audit/security/client-bundle-sweep.md` | AUDIT-16. `ENVSTATE`, six-pattern table, literal + shape sweeps, server-side control, positive control, re-run instructions. | 202 lines |

`.planning/audit/baseline/versions.txt` gained `build_exit_code=0`, `build_route_row_count=140`, `next_static_bytes=4490961`, `build_derived_at`.

## Measured aggregates

| Page signal | Count of 43 |
|---|---|
| rows emitted | 43 |
| `middleware_protected` (ring 1) | 9 |
| `layout_guard` non-null (ring 2) | 14 — admin 2, moderation 12 |
| **carrying BOTH rings** | **0 — the sets are disjoint** |
| no ring and no `page_guard` | 12 |
| `component_type: client` | 26 (server 17) |
| `render_mode` | static 19 / dynamic 24 |
| `page_guard` | null 27, `getUser` 8, `useAuthStore` 7, `inline_role_check` 1 |
| pages using `createServiceClient()` | 1 — `src/app/users/[id]/page.tsx` |
| `data_source: none` | 10 |
| provisional `effective_protection` | public 12, auth 17, admin 14 |

| Special files | Count of 16 |
|---|---|
| `layout` | 5 (2 guarded) |
| `loading` | 6 |
| `error` | 2 |
| `not-found` / `robots` / `sitemap` | 1 each — the 3 build-only routes |

| Bundle sweep | `.next/static` |
|---|---|
| all six secret patterns | 0 files each |
| JWT-shaped strings | 0 (also 0 in `public/`, 0 in `.planning/audit/`) |
| literal service-role key | not-run — no value in env |
| positive controls | 19 / 2 / 1 files — the sweep demonstrably read the bundle |
| `.next/server` referencing the key **by name** | 56 — correct server-side behavior, explicitly **not** a finding |

## Decisions Made

See `key-decisions` in the frontmatter. The two load-bearing ones both come from the same root cause — **`pages.schema.json` is stricter than the plan text assumed**:

1. **The grep signals cannot be top-level row keys.** The schema fixes 12 properties with `additionalProperties: false`, and `is_client_component` / `uses_service_client` are not among them. Emitting them produces a schema error per row and fails `--check pages`, which is both an acceptance criterion and the plan-level verification. They are carried by `component_type` and `data_source` instead.
2. **`effective_protection` cannot be a placeholder.** Endpoints have a `--check endpoints-signals` pre-classification gate; **pages have no such variant** in `validate.mjs`. `--check pages` runs `no-residual-placeholders` over all eight `PAGE_HUMAN_FIELDS` unconditionally, so the plan's "placeholder-seeded" instruction and its "`--check pages` exits 0" criterion are mutually exclusive. Derived seeds satisfy both, and merge-by-id keeps 01-11's overrides.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `effective_protection`/`dead_or_duplicate` placeholder seeds would have made the plan's own gate unpassable**

- **Found during:** Task 2 (generator authoring, before first run)
- **Issue:** The action text says to emit "the placeholder-seeded human fields `effective_protection` and `dead_or_duplicate`", while acceptance criterion 8 and the plan-level `<verification>` both require `node .planning/audit/tools/validate.mjs --check pages` to exit 0. `validate.mjs:420` runs `placeholderHits(rows, PAGE_HUMAN_FIELDS, 'pages')`, and `PAGE_HUMAN_FIELDS` (validate.mjs:216) contains both fields. Unlike AUDIT-03 — where plan 01-02 satisfied its gate with the weaker `--check endpoints-signals` variant — **the registry has no `pages-signals` check** (`CHECK_NAMES`, validate.mjs:316). A placeholder seed therefore fails the only gate this plan has.
- **Fix:** `effective_protection` is seeded with a conservative derived two-ring verdict (`admin` when a guarded admin layout is the nearest ancestor or the page does an inline role check; `auth` when middleware-protected or self-guarding; `public` otherwise — it never claims `unprotected_but_should_be`, which is a judgement about intent the generator cannot make). `dead_or_duplicate` is seeded boolean `false`, which is schema-legal (`["boolean","string"]`) and is not the `"unknown"` sentinel. Both remain in the generator's `HUMAN_FIELDS` merge set, so plan 01-11's hand classification survives regeneration verbatim.
- **Files modified:** `.planning/audit/tools/gen-page-inventory.mjs`
- **Verification:** `--check pages` → 4 passed, 0 failed, including `no-residual-placeholders :: fully classified`. Destructive merge test: `pages[0]` hand-set to `effective_protection: "unprotected_but_should_be"`, `dead_or_duplicate: true`, `findings: ["F-001"]`; regenerated; **all three survived**; file then deleted and regenerated back to the identical SHA-256.
- **Committed in:** `efc118f`

**2. [Rule 1 — Bug] Per-page grep signals cannot be emitted as top-level keys; acceptance criteria 3 and 4 are unsatisfiable as literally written**

- **Found during:** Task 2 (acceptance verification)
- **Issue:** The action text lists `is_client_component`, `uses_cookie_client`, `uses_browser_client`, `uses_service_client`, `uses_auth_store`, `uses_swr` and `fetches_api` as emitted fields, and criteria 3 and 4 read them off the row (`x.is_client_component`, `x.uses_service_client`). But `pages.schema.json` declares `additionalProperties: false` over a fixed 12-property list containing none of them — measured directly: `additionalProperties: false`, `is_client_component allowed? false`, `uses_service_client allowed? false`. Emitting them yields a schema error on every one of the 43 rows and fails criterion 8 / the plan verification. Unlike `endpoints.schema.json`, which has a `signals` object with `additionalProperties: true`, the page schema provides no such escape hatch. The schema is a 01-01 artifact and is **not** in this plan's `files_modified`, so it could not be widened.
- **Fix:** The signals are still derived (`deriveSignals()` computes all seven) but are folded into the two schema-legal columns the schema provides for exactly this purpose: `component_type` (`"client"`/`"server"`) and `data_source` (e.g. `api:/api/clubs+/api/events; supabase-browser; auth-store`). Criteria 3 and 4 were re-expressed against those columns without changing what they assert.
- **Verification:** `component_type === "client"` → **26**, identical to the criterion's expected `is_client_component` count. `data_source` matching `supabase-service-role` → **1 row**, `src/app/users/[id]/page.tsx`, identical to the criterion's expected `uses_service_client` row and file. `--check pages :: schema-valid :: all rows valid`.
- **Committed in:** `efc118f`

**3. [Rule 1 — Bug] The build route table has 140 rows, not the 139 the plan states**

- **Found during:** Task 1
- **Issue:** The plan and RESEARCH § Pattern 2 both say "139 rows today", but the same RESEARCH sentence gives the decomposition `94 + 43 = 137, plus /robots.txt, /sitemap.xml, /_not-found`, which is 140. The measured table has **140** unique routes.
- **Fix:** `versions.txt` records the **measured** `build_route_row_count=140`, per the phase's standing rule that no count is ever transcribed from a planning document (RESEARCH Pitfall 8). The invariant was then proven set-wise rather than by arithmetic: build ∖ (endpoints ∪ pages) = exactly `/_not-found`, `/robots.txt`, `/sitemap.xml`; pages ∖ build = ∅; endpoints ∖ build = ∅.
- **Files modified:** `.planning/audit/baseline/versions.txt`
- **Verification:** `--check pages :: every-build-route-is-inventoried :: 140 build routes all covered`.
- **Committed in:** `2884edd`, proven in `efc118f`

**4. [Rule 2 — Missing Critical] `requirements mark-complete` not run for AUDIT-04 or AUDIT-16**

- **Found during:** State update
- **Issue:** The frontmatter declares `requirements: [AUDIT-04, AUDIT-16]`, but neither is actually closed by this plan. **AUDIT-04** requires each page to carry "dead/duplicate status" and an auth verdict; `dead_or_duplicate` is seeded `false` pending plan 01-05's knip unused-files list (RESEARCH Pattern 2 sources that column from knip) and `effective_protection` carries a provisional machine verdict pending 01-11 — README.md itself scopes `pages.json` as "01-03 signals, 01-11 classification". **AUDIT-16**'s verdict is `INCONCLUSIVE` by construction: the swept build had no service-role key in its environment, so the requirement's substantive question is unanswered until a credentialed re-build. Marking either complete would let REQUIREMENTS.md and ROADMAP.md claim a delivery that the artifacts themselves contradict.
- **Fix:** `requirements-completed` copies the plan array verbatim as the template mandates, but `requirements mark-complete` was **not** run for either id. Both stay Pending. This follows the precedent 01-01 set when it withheld AUDIT-13 and AUDIT-20.
- **Files modified:** none (the omission is the fix)
- **Verification:** `REQUIREMENTS.md` rows for AUDIT-04 and AUDIT-16 remain `Pending`; `client-bundle-sweep.md` states the INCONCLUSIVE verdict and its closing procedure in § 7.
- **Committed in:** n/a — no change made

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 missing-critical/false-completion guard)
**Impact on plan:** No scope change, no new files, nothing outside `files_modified`. Deviations 1 and 2 were both required for the plan's own gate to pass at all and both preserve the criteria's intent; deviation 3 replaced a transcribed count with a measured one; deviation 4 prevents a false completion signal on two requirements that three other plans still contribute to.

## Issues Encountered

- **`--check pages` passing today removes a forcing function that endpoints still has.** Because the gate had to go green in this plan, page classification no longer fails mechanically the way `--check endpoints` does for the 94 endpoint rows. **Plan 01-11 must not read a green `--check pages` as "pages are classified."** The provisional rows are identifiable: any row whose `effective_protection` was never hand-touched still matches the generator's derivation. The 12 rows with no ring and no `page_guard` (currently seeded `public`) are the review queue that matters most, and `/health`, `/docs` and `/feedback` are the first three to look at.
- **The first build's exit code was lost.** `PIPESTATUS` did not populate under the `npm run build | tee` pipeline in this shell. Since `build_exit_code` is a measured key, the build was simply re-run with a plain redirect; both runs exit 0 and the guard is clean after each.
- **`git checkout --` does not restore an untracked artifact.** The merge-test restore initially failed because `pages.json` was not yet committed, so the mutated values were merged straight back by the regeneration. Correct restore for an uncommitted generator output is `rm` + regenerate, which reproduced the original SHA-256 exactly.
- **The ugrep-shim caveat held again.** Every count in this plan was produced either inside the Node generator or with `command grep`. For the bundle sweep this is load-bearing — the shim honours `.gitignore` and `.next/` is ignored — which is why § 5 of the sweep artifact records a positive control rather than trusting a zero.
- **`.env` is effectively inert.** It defines only `SUPABASE_URL`, `SUPABSE_PUSHABLE_KEY` and `SUPABSE_SECRET_KEY`; two of the three misspell `SUPABASE`, and none is a name `src/` actually reads. Recorded as a finding candidate in the sweep artifact § 6. Values were never read and `.env` was never modified.

## Read-Only Compliance

| Gate | Result |
|---|---|
| `bash .planning/audit/tools/readonly-guard.sh` after **both** builds and after every task | exit 0 |
| `git check-ignore -q .next/static` | exit 0 — `.gitignore:12` → `/.next/` |
| Files outside `.planning/` in `2884edd~1..HEAD` | **0** |
| Deletions in this run's commits | 0 |
| `shasum -a 256 -c baseline/lock.sha256` (inside the guard) | exit 0 — lockfile and manifest untouched by two builds |
| Secret sweep over the 6 new artifacts (JWT / `sb_secret_` / connection-string shapes) | 0 hits |
| `.env` / `.env.local` read for values or modified | no — NAMES only, via `grep -oE '^[A-Za-z_][A-Za-z0-9_]*='` |

No `npm install`, `npm ci`, `npx`, or `supabase` command was run; `npm run build` executes the already-installed tree. The two pre-existing untracked paths (`docs/product-master-plan.md`, `.planning/research/.cache/`) were left exactly as found and were never staged.

## Threat Flags

None. No new security surface was introduced. The registered threats were handled as planned: **T-01-03-01** swept (0 hits, six patterns plus shape); **T-01-03-02** mitigated by names-and-counts-only reporting, re-verified by negative-grepping the artifact for JWT and connection-string shapes (both 0); **T-01-03-03** mitigated by `ENVSTATE` plus the positive control; **T-01-03-04** mitigated by the guard after both builds; **T-01-03-05** mitigated by `layout_guard`, which resolves 14 pages that ring 1 alone would have missed.

## Known Stubs

- **`effective_protection` on all 43 rows and `dead_or_duplicate` on all 43 rows are provisional machine seeds, not human verdicts.** This is intentional and is the subject of deviation 1. `dead_or_duplicate` cannot be resolved before plan 01-05 produces the knip unused-files list; `effective_protection` is plan 01-11's. The stub does **not** block this plan's goal — both authorization rings, the render mode and the completeness invariant, which are what AUDIT-04 needed from the build, are fully resolved.
- Unlike endpoints, this stub is **not** mechanically enforced by the validator (see Issues Encountered). It is recorded here and in the generator docblock so it cannot be forgotten.

## User Setup Required

None for this plan's execution. To **close** AUDIT-16, one credentialed input is needed — `SUPABASE_SERVICE_ROLE_KEY` present in the build environment for a single re-build. The exact procedure is in `client-bundle-sweep.md` § 7; the credential request already exists in `BLOCKING-INPUTS.md`.

## Self-Check: PASSED

All 6 created files and the 1 modified file verified present on disk. All 3 task commits verified in `git log`. All 20 acceptance criteria across the three tasks re-run: 18 pass as written, 2 (Task 2 criteria 3 and 4) pass in re-expressed schema-legal form per deviation 2, with the same expected values (26 and 1 @ `users/[id]`). Plan-level `<verification>` re-run: `--check pages` exit 0 (4/4 rules), `--check bundle-sweep` exit 0 (8/8 rules), `readonly-guard.sh` exit 0. `git diff --name-only 2884edd~1..HEAD` returns 7 paths, all under `.planning/audit/`, 0 outside, 0 deletions. Generator re-run byte-identical.

## Next Phase Readiness

- **Plan 01-07 gains the page-side view of AUDIT-07.** Exactly one page calls `createServiceClient()` — `src/app/users/[id]/page.tsx` — and its `layout_guard` is `null` and `middleware_protected` is `false`, i.e. a service-role query on an unguarded dynamic route. That is the first row its service-role register should examine.
- **Plan 01-11 has an ordered page-review queue**, but must not trust a green `--check pages` (see Issues Encountered). Start with the 12 rows carrying no ring and no `page_guard`, then the 1 `inline_role_check` row, then confirm the 14 layout-guarded rows.
- **Plan 01-12's cache probe can now read `render_mode`.** The 19 static pages are the ones where a personalization bug becomes a cross-user cache leak rather than a per-request mistake.
- **Plan 01-05 closes `dead_or_duplicate`.** Its knip unused-files list is the missing input; the generator merges the values in by `id` without a rewrite.
- **Plan 01-13 has three finding candidates from this plan:** (a) `build_route_row_count` is 140 where the phase's own documents say 139 — a fourth entry for the stale-documentation cluster already holding 92-vs-94, 45-vs-44 and 6-vs-8; (b) `.env` defines two misspelled, unread variable names; (c) AUDIT-16 is INCONCLUSIVE and needs a credentialed re-build before it can be closed or dismissed.
- **One structural observation for the threat models (AUDIT-17).** The two authorization rings are **disjoint** — no page is protected by both middleware and a layout guard. Every one of the 43 pages therefore depends on a *single* control, and for the 14 admin/moderation pages that single control is one `layout.tsx` file apiece. A regression in `src/app/moderation/layout.tsx` silently exposes 12 admin pages with nothing behind it.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*
