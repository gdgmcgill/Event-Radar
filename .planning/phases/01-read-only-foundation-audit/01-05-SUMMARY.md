---
phase: 01-read-only-foundation-audit
plan: 05
subsystem: infra
tags: [audit, dependencies, npm-audit, knip, dependency-cruiser, reachability, dead-code, stale-docs, supply-chain, read-only]

# Dependency graph
requires:
  - phase: 01-01
    provides: "readonly-guard.sh (run after every npm and npx invocation), validate.mjs --check deps and --check dead-code (the AUDIT-12/AUDIT-15 gates), baseline/lock.sha256 (the lockfile hash this plan had to preserve), baseline/versions.txt (the authoritative route/page/migration counts the stale-docs table is judged against), and the withheld-mark-complete precedent"
  - phase: 01-03
    provides: "the page inventory and the App Router special-file census that make the 13 dependency-cruiser orphans legible as framework entry points rather than dead files"
  - phase: 01-04
    provides: "baseline/jest.txt and jest-listtests.txt — the 21-suite denominator behind the stale-docs row that .claude/CLAUDE.md names Vitest and never mentions Jest"
provides:
  - "quality/dependency-report.md — AUDIT-12: a written reachability judgment for all 24 High/Critical production advisories, a per-advisory breakdown of next 16.2.1's 25 records, the moderate/low and dev-only registers, the 41-row npm outdated table, and 8 finding candidates for 01-13"
  - "The STAB-07 answer, mechanically derived: redoc and next-swagger-doc ARE reachable from /docs; swagger-ui-react is absent from the module graph entirely"
  - "quality/dead-code.md — AUDIT-15: 5 unreferenced files cross-checked against an independent module graph, 27 unused exports dispositioned, a 13-row false-positive triage with the deciding grep recorded per hit, both legacy directories closed with commit evidence, and 12 stale-documentation rows"
  - "quality/depcruise.out.json — a 308-module, 703-dependency, zero-unresolved module graph of src/ that later plans can query instead of re-deriving"
  - "quality/knip.out.json + knip.md, npm-audit.prod.json, npm-audit.all.json, npm-outdated.json, npm-ls-prod.json — raw tool evidence, never hand-edited"
  - "The arithmetic STAB-03 needs: of 24 High/Critical rows, 7 are rooted in an unimported CLI, 6 in an unimported UI package, 3 are patch-bump fixes, 4 are build-time-only, 1 needs an unopened WebSocket, and exactly 1 (next) is reachable on every request"
affects: [01-13, 02-stabilization, STAB-03, STAB-07, STAB-08, STAB-09, STAB-01, AUDIT-08, AUDIT-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pinned one-shot tooling: knip@6.35.1 and dependency-cruiser@18.3.0 run via npx --yes at an exact version behind a blocking human gate; neither is installed and neither enters package-lock.json"
    - "Ad-hoc configs outside the repo root: knip.config.json and depcruise.config.cjs live under .planning/audit/quality/ and are passed with -c, so the analysis leaves no config file in the repository"
    - "Two-tool corroboration: knip's unused-file list is cross-checked against an independently produced dependency-cruiser graph, and the disagreement (EventImageUpload has one dead importer) is itself the finding"
    - "Reachability is mechanical, not hand-traced: the STAB-07 verdict cites a --reaches module path, so a reviewer re-runs a command instead of re-reading imports"
    - "No package enters the dead list on a tool's word: every knip unused-dependency hit carries the grep that confirmed or refuted it, and the refuted ones (prettier, tsx) are held back"
    - "Four-value disposition vocabulary (Stage 2 / Stage 3 / keep / needs-decision) applied to every row, so the report hands over decisions rather than observations"

key-files:
  created:
    - .planning/audit/quality/knip.config.json
    - .planning/audit/quality/depcruise.config.cjs
    - .planning/audit/quality/npm-audit.prod.json
    - .planning/audit/quality/npm-audit.all.json
    - .planning/audit/quality/npm-outdated.json
    - .planning/audit/quality/npm-ls-prod.json
    - .planning/audit/quality/knip.out.json
    - .planning/audit/quality/knip.md
    - .planning/audit/quality/depcruise.out.json
    - .planning/audit/quality/depcruise.reaches-apidocs.json
    - .planning/audit/quality/dependency-report.md
    - .planning/audit/quality/dead-code.md
  modified: []

key-decisions:
  - "The research's dependency-cruiser invocation was corrected before it was trusted. `depcruise ... -T json -x node_modules src` returns `totalCruised: 0` on 18.3.0 against this tree — a bare directory argument cruises nothing, and the same command with a glob cruises 308 modules. Had the empty output been accepted, the report would have concluded that NOTHING reaches redoc, which is the exact opposite of the truth and would have sent STAB-07 to delete a live route."
  - "`--reaches` cannot reach a module that is not in the graph. Excluding node_modules while filtering for `redoc|swagger-ui-react|next-swagger-doc` is structurally guaranteed to return zero matches. The reachability run therefore keeps node_modules as unfollowed leaf nodes via an AUDIT_DC_REACHES=1 switch in the config, documented in the file; doNotFollow still prevents descending, so the cost is one node per package."
  - "The reaches regex is anchored to `node_modules/(...)`. The unanchored form additionally matches the local directory `src/components/redoc/`, which would credit the verdict to a folder name rather than the package. Both forms agree here; the anchored one agrees for the right reason."
  - "The 13 dependency-cruiser orphans are dispositioned `keep`, not `remove`. All 13 are App Router convention files (page/layout/loading/route/robots) that the framework routes by filesystem position. `src/app/settings/page.tsx` is among them and is actively protected by src/middleware.ts — deleting it on an orphan signal would delete a guarded route. The correct dead-file filter is non-entry modules with zero dependents, which returns exactly the 4 files knip agrees on."
  - "`prettier` and `tsx` were refused entry to the dead list despite knip flagging both. Prettier is invoked by editors and humans, and tsx is how the three scripts/*.ts maintenance files are run — they have no npm script, which is why knip cannot see them. Assumption A6 warned that an unconfirmed hit would make Stage 2 remove something the project needs; these two are that case."
  - "`API_ENDPOINTS` is dispositioned needs-decision, not remove. It has exactly one occurrence in src/ (its own definition) while 60 files hardcode `fetch(\"/api/...\")`, and three of its seven paths are duplicated verbatim elsewhere. It is dead because every call site ignores it, not because it is obsolete — deleting it makes the drift permanent, so a human chooses between deletion and adoption."
  - "`vercel` ^32.3.0 sitting in `dependencies` is the single highest-leverage dependency finding. It is imported by nothing and roots 7 of the 24 High/Critical rows including the `tar` critical. npm's own fix advice is a 27-major upgrade to 59.16.0; removal is strictly cheaper."
  - "Two of the register's criticals are defused by configuration, and the report says so explicitly rather than counting them as emergencies: `images.unoptimized: true` in next.config.js disables the Image Optimization API (retiring the AVIF RCE and both image DoS advisories), and the Windows-RCE critical needs a Windows host. The Windows disposition is flagged as an unverified assumption (finding candidate D-7) rather than presented as fact."
  - "AUDIT-12 and AUDIT-15 ARE marked complete, following the 01-04 precedent rather than the 01-01/01-03 withholding. Every clause of both requirement texts maps to a section that exists on disk, and `validate.mjs --check deps` (4 rules) and `--check dead-code` (3 rules) both exit 0. The precedent is to withhold when the artifacts contradict the claim, not to withhold reflexively."

patterns-established:
  - "Correct the tool invocation before trusting its silence: a zero-result run is verified to be a real zero, not a mis-scoped one, before any conclusion is drawn from it"
  - "Record the deciding grep next to the verdict, so a reviewer can refute a single row without re-running the whole analysis"
  - "Separate PATH reachability from INPUT reachability: the redoc subtree advisories sit on a live code path but need attacker-controlled YAML/URI/glob input that a first-party generated spec never supplies, and the report says both halves"
  - "Name the cheap wrong answer: for the rows with an attractive-but-incorrect remediation (upgrade vercel, delete API_ENDPOINTS), the report states it so the next stage does not discover it by doing it"

requirements-completed: [AUDIT-12, AUDIT-15]

# Metrics
duration: 11 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 05: Dependency and Dead-Code Slice Summary

**24 High/Critical production advisories each carry a written reachability judgment, and the STAB-07 question is answered mechanically per package: `redoc` and `next-swagger-doc` are reachable from the public `/docs` route, `swagger-ui-react` is absent from the module graph entirely.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-14T17:15:21Z
- **Completed:** 2026-09-14T17:26:33Z
- **Tasks:** 3 (1 human gate + 2 execution)
- **Files created:** 12 (all under `.planning/audit/quality/`)

## Accomplishments

- **The API-doc reachability question is closed with a citable module path.** `depcruise.reaches-apidocs.json` cruises exactly 5 modules: `src/app/docs/page.tsx` → `src/components/redoc/RedocUI.tsx` → `node_modules/redoc/bundles/redoc.lib.js`, and `src/app/docs/page.tsx` → `src/lib/swagger.ts` → `node_modules/next-swagger-doc/dist/index.cjs`. `swagger-ui-react` appears in none of them. STAB-07's disposition differs per package and no longer requires a judgment call.
- **`/docs` is confirmed anonymously reachable.** `find src/app/docs -type f` returns one file, so there is no layout auth ring, and `src/middleware.ts:113` lists 8 protected routes with `/docs` absent. Filed as finding candidate D-3 for the AUDIT-17 threat models.
- **The 24 High/Critical rows resolve into 6 buckets, only one of which is an emergency.** 7 rooted in `vercel` (an unimported CLI in `dependencies`), 6 in `swagger-ui-react` (unimported), 3 under `redoc` (reachable path, first-party input, fixed by 2.5.2 → 2.5.4), 4 build-time-only, 1 needing a Realtime channel the app never opens, and `next` 16.2.1 — reachable on every request, 25 advisories, fixable inside the declared `^16.0.3` range.
- **Every one of `next`'s 25 advisories is individually dispositioned**, with 10 ruled out by verified configuration or unused features (`images.unoptimized: true`, no `use server`, no `rewrites`, no `i18n`, no CSP nonces) and 5 cache-poisoning records explicitly held open pending plan 01-12's cache matrix.
- **No dependency entered the dead list on a tool's word.** 13 knip unused-dependency hits were hand-confirmed: 9 confirmed dead, 2 refuted as tooling false-positives (`prettier`, `tsx`), 1 corrected to a package-plus-wrapper pair, 2 escalated to a human.
- **AUDIT-15's named targets are closed:** `API_ENDPOINTS` dispositioned with the 60-file hardcoded-URL evidence, `backend/` recorded as removed in `5e7bf27`, `internal/` recorded as never-tracked and gitignored — which closes an open question the project research summary has been carrying.
- **The read-only invariant held throughout.** `readonly-guard.sh` exits 0 after every npm and npx invocation, the lockfile matches its Wave 1 hash, and `git diff --stat adffe81..HEAD` touches nothing outside `.planning/`.

## Task Commits

1. **Task 1: Confirm the two pinned one-shot tool versions** — no commit (human gate; see Authentication and Approval Gates below)
2. **Task 2: Capture npm and module-graph evidence and write the dependency report** — `0edfdc6` (feat)
3. **Task 3: Write the dead-code, stale-docs and legacy-directory disposition report** — `52676b6` (feat)

**Plan metadata:** see the `docs(01-05)` commit following this file.

## Files Created/Modified

- `.planning/audit/quality/knip.config.json` — ad-hoc knip config; entry list covers the App Router special files, both middleware modules, the root configs, `scripts/`, `load-tests/` and the test files
- `.planning/audit/quality/depcruise.config.cjs` — ad-hoc dependency-cruiser config; resolves `@/` from `tsconfig.json` rather than re-declaring it, and documents the two 18.3.0 execution facts that make the difference between a real graph and an empty one
- `.planning/audit/quality/npm-audit.prod.json` — `npm audit --omit=dev --json --package-lock-only`; 38 advisories (2 critical, 22 high, 13 moderate, 1 low) over 680 prod dependencies
- `.planning/audit/quality/npm-audit.all.json` — whole-tree audit; 42 advisories, isolating the 4 dev-only entries
- `.planning/audit/quality/npm-outdated.json` — 41 packages behind (no `--package-lock-only` flag exists; lockfile hash re-asserted immediately after)
- `.planning/audit/quality/npm-ls-prod.json` — the production tree the advisory paths are derived from
- `.planning/audit/quality/knip.out.json` / `knip.md` — 5 unused files, 9 unused prod deps, 4 unused dev deps, 27 unused exports, 1 duplicate export
- `.planning/audit/quality/depcruise.out.json` — 308 modules, 703 dependencies, 0 unresolved
- `.planning/audit/quality/depcruise.reaches-apidocs.json` — the 5-module reachability closure
- `.planning/audit/quality/dependency-report.md` — AUDIT-12
- `.planning/audit/quality/dead-code.md` — AUDIT-15

## Decisions Made

See `key-decisions` in the frontmatter. The three that change downstream work:

1. **The dependency-cruiser command from RESEARCH was corrected, not copied.** An empty graph that reads as a clean graph is the worst failure mode available to this audit, and this run hit it twice before diagnosing it.
2. **`vercel` in `dependencies` is the highest-leverage single finding** — one removal retires 7 of 24 High/Critical rows, versus npm's own advice of a 27-major-version upgrade to a CLI nothing imports.
3. **Both requirements are marked complete**, departing from the 01-01/01-03 withholding precedent for the same reason 01-04 did: the artifacts corroborate the claim and both validator checks exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The planned dependency-cruiser invocation produces an empty graph on 18.3.0**

- **Found during:** Task 2 (reachability capture)
- **Issue:** RESEARCH § Code Examples 7 specifies `npx --yes dependency-cruiser@18.3.0 --no-config -T json -x 'node_modules' -R 'swagger-ui-react|redoc|next-swagger-doc' src`. Executed against this tree it returns `modules: []` and `summary.totalCruised: 0`. Two independent causes: (a) a **bare directory argument** cruises nothing in 18.3.0 — the same config with `"src/**/*.{ts,tsx}"` cruises 308 modules with 0 unresolved dependencies; (b) `--reaches` cannot reach a module that has been removed from the graph, so `-x node_modules` guarantees zero matches for a filter that names three npm packages. Either alone yields a **false negative that reads as a clean result** — the report would have stated that nothing reaches `redoc`, sending STAB-07 to delete a package that a live public route renders.
- **Fix:** All cruises use the glob form. The config gained an `AUDIT_DC_REACHES=1` switch that keeps node_modules as *unfollowed leaf nodes* for the reachability run (`doNotFollow` still prevents descending, so the cost is one node per package) while the full-graph run keeps them excluded as the plan specified. Both facts, their verification, and the exact invocations are documented in the config header so the next reader does not rediscover them.
- **Files modified:** `.planning/audit/quality/depcruise.config.cjs`
- **Verification:** The corrected reaches run cruises 5 modules and emits the `page.tsx → RedocUI.tsx → node_modules/redoc/...` path; the full run cruises 308 modules / 703 dependencies / 0 unresolved.
- **Committed in:** `0edfdc6`

**2. [Rule 2 — Missing Critical] The reaches regex was anchored to `node_modules/(...)`**

- **Found during:** Task 2
- **Issue:** The unanchored pattern `swagger-ui-react|redoc|next-swagger-doc` is a regex over module paths, so it also matches the local directory `src/components/redoc/`. A verdict reached that way is credited to a folder name rather than to the package, and would still have "passed" if the package import were removed.
- **Fix:** The filter is `node_modules/(swagger-ui-react|redoc|next-swagger-doc)`. Both forms give the same verdict on this tree; the difference is recorded in `dependency-report.md` § 1 so the weaker form is not reintroduced.
- **Files modified:** `.planning/audit/quality/dependency-report.md`
- **Verification:** 5-module closure, each entry a real package path.
- **Committed in:** `0edfdc6`

**3. [Rule 2 — Missing Critical] Two stale-doc rows were corrected against the tree instead of transcribed**

- **Found during:** Task 3
- **Issue:** The plan (via RESEARCH § State of the Art) directs the report to record "REQUIREMENTS.md and PROJECT.md carrying route and migration counts that disagree with `baseline/versions.txt`". Re-derived today, that is **partly already fixed**: `REQUIREMENTS.md` AUDIT-03 now reads 94, and `PROJECT.md:109` now reads 44 migrations. The only surviving stale count in the repo is `PROJECT.md:41` ("all 92 API handlers"); the "45 migrations" claim survives solely in the out-of-repo orchestrator brief.
- **Fix:** `dead-code.md` § 4 rows 7 and 8 record the **current** state — row 7 as a Stage 2 doc fix, row 8 as `keep` with an explicit note that the in-repo number is correct and should not be "fixed". Transcribing the research verbatim would have manufactured a finding against a document that had already been corrected, and risked a future editor changing 44 back to 45.
- **Files modified:** `.planning/audit/quality/dead-code.md`
- **Verification:** `ls supabase/migrations | wc -l` → 44; `grep -rn "92\|45 migration" .planning/PROJECT.md .planning/REQUIREMENTS.md` → one hit, `PROJECT.md:41`.
- **Committed in:** `52676b6`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical)
**Impact on plan:** No scope change. Deviation 1 is the one that mattered — without it this plan would have shipped a confident, cited, and exactly-wrong reachability verdict.

## Authentication and Approval Gates

**Task 1 — `checkpoint:human-verify`, `gate="blocking-human"`: APPROVED.**

- **Date of response:** 2026-09-14
- **Exact wording of the response:** **"Approved"**
- **What was authorised:** one-shot execution of `knip@6.35.1` and `dependency-cruiser@18.3.0` via `npx --yes <pkg>@<exact version>`, with **no install into `package.json` or `package-lock.json`**.
- **Evidence presented at the gate:** the package-legitimacy run of 2026-09-14 — `knip` (npm, latest 2026-09-09, 10,663,805 weekly downloads, github.com/webpro-nl/knip, verdict SUS/`too-new`, no postinstall) and `dependency-cruiser` (npm, latest 2026-09-13, 2,822,805 weekly downloads, github.com/sverweij/dependency-cruiser, verdict SUS/`too-new`, no postinstall). No package received a SLOP verdict. The `too-new` reason refers to the latest release date, not package age.
- **Honoured in execution:** every invocation in this plan uses the exact pinned version. `git grep`-able proof is in the reproduce blocks at the top of both reports, and `readonly-guard.sh` confirms `package.json` and `package-lock.json` are byte-identical to their Wave 1 hashes after all six tool runs.
- **Note:** a previous executor agent halted at this gate without executing anything; this run resumed at Task 2 with the approval recorded above. No partial artifacts existed to reconcile — `.planning/audit/quality/` did not exist before this run.

## Issues Encountered

- **`npm audit` and `npm outdated` exit non-zero by design** (1 when advisories or outdated packages exist). Each capture's exit code was treated as data, not failure; the JSON is complete and parses.
- **The shell `grep` is a ugrep shim** that honours `.gitignore` and rejects some BRE patterns (documented by 01-01). Every count relied on in either report was taken with `command grep` or `git grep`.
- **`validate.mjs --quick` reports 49 passed / 1 failed / 14 skipped.** The single failure is `endpoints :: no-residual-placeholders` — the 2,068 unclassified classification fields in `inventory/endpoints.json` that **plan 01-11** exists to fill. It is unrelated to this plan and was correctly failing before it started. Both of this plan's own checks (`--check deps`, `--check dead-code`) exit 0.
- **No package install was attempted or needed**, so the package-manager exclusion in the deviation rules never came into play.

## Requirements

Both requirement ids declared in the plan frontmatter were passed to `requirements mark-complete`.

- **AUDIT-12 — complete.** Every clause maps to a section on disk: `npm audit --omit=dev` output (`npm-audit.prod.json`, § Headline counts), `npm outdated` output (`npm-outdated.json`, § 6), a reachability judgment for every High/Critical in production dependencies (§ 2, all 24 rows; `validate.mjs --check deps` asserts none is unjudged), and the `swagger-ui-react`/`redoc` reachability answer (§ 1, per package, with a cited module path).
- **AUDIT-15 — complete.** Unreferenced files and exports (§ 1a/1b, two-tool cross-check), components superseded by prior milestones (the 4 dead components; `chart.js`/`react-chartjs-2` superseded by `recharts`), `API_ENDPOINTS` bypassed by hardcoded URLs (§ 1b, with the 60-file count and the three verbatim duplications), stale docs (§ 4, 12 rows), and the disposition of `internal/` and `backend/` (§ 3, with commit `5e7bf27`). `validate.mjs --check dead-code` exits 0 on all 3 rules.

## User Setup Required

None. The plan's `user_setup` entry was the npm-registry confirmation, which was satisfied by the Task 1 gate and requires no ongoing configuration. Nothing was installed.

## Next Phase Readiness

- **Ready for 01-06 onward.** This plan has no downstream blockers and consumed nothing credentialed.
- **Plan 01-13 inherits 8 finding candidates** (D-1 … D-8 in `dependency-report.md` § 7) plus the dead-code report's 9 `needs-decision` rows.
- **Plan 01-12 owes an answer this plan deferred to it:** 5 `next` cache-poisoning advisories are held open pending `cache/cache-matrix.csv`. They must not be closed before it exists.
- **AUDIT-17 inherits the `/docs` exposure** (D-3) as anonymous-threat-model input, and the weak CSP (D-6) as an incidental.
- **STAB-01 inherits an unresolved fact, not a doc fix:** CI pins Node 20, which cannot run `dependency-cruiser@18.3.0`. Stage 1 tooling ran locally on Node 24.16.0; a CI-hosted re-run would fail.
- **One evidence gap is recorded rather than papered over:** the `GHSA-p293` Windows-RCE critical is dispositioned "not applicable" on the assumption of a Linux host. Confirm the production runtime OS before closing it.

---
*Phase: 01-read-only-foundation-audit*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All 12 artifacts in `key-files.created` exist on disk (`[ -f ]` verified).
- Both task commits exist in `git log`: `0edfdc6`, `52676b6`.
- `node .planning/audit/tools/validate.mjs --check deps` exits 0 (4 rules passed).
- `node .planning/audit/tools/validate.mjs --check dead-code` exits 0 (3 rules passed).
- `bash .planning/audit/tools/readonly-guard.sh` exits 0.
- No tool config exists at the repository root (`knip.json`, `.knip.json`, `.dependency-cruiser.cjs` all absent).
- `git diff --stat adffe81..HEAD --name-only` touches nothing outside `.planning/`.
- Secret sweep over the new artifacts (service-role, `sb_secret_`, JWT-shape, password patterns) returned no matches.
