---
phase: 1
slug: read-only-foundation-audit
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-14
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Phase nature.** Phase 1 is a read-only audit of an existing Next.js + Supabase codebase. The "implementation" under audit is not application code — it is audit tooling and audit artifacts under `.planning/audit/`. Accordingly, most declared mitigations are process and tooling controls (a read-only guard, read-only SQL transports, names-and-counts-only secret sweeps, GET-only probes, set-cookie redaction in the writing pipeline), and application-level threats are mitigated by *banking a finding* with line ranges and severity — not by fixing source, which was explicitly out of scope.

**Independent re-verification performed by this audit** (not taken from the phase's own reports):

| Check | Command | Result |
|---|---|---|
| Read-only guard | `bash .planning/audit/tools/readonly-guard.sh` | exit 0 |
| Source byte-identity | `git diff --exit-code --stat -- src/` | exit 0, empty |
| `supabase/` + `scripts/` byte-identity | `git diff --exit-code --stat -- supabase/ scripts/` | exit 0, empty |
| Whole phase commit range | `git diff --name-only 8d329c3~1..HEAD -- . ':!.planning'` | empty |
| Lockfile / manifest hash | `shasum -a 256 -c .planning/audit/baseline/lock.sha256` | both OK |
| Migration count vs baseline | `ls supabase/migrations/*.sql \| wc -l` vs `versions.txt` | 44 = 44 |
| Residual credential sweep (6 payload-bearing shapes over `.planning/audit/`, `public/`, phase dir) | `command grep -rIlE` | **0 files on every shape** |
| Artifact validator | `node .planning/audit/tools/validate.mjs` | 118 pass, 2 fail (documented AUDIT-01 blocks), 1 skip |
| Prod capture SQL audit | parsed all 22 `raw/prod/*.json` envelopes | 22/22 SELECT/WITH or read-only MCP list; **0 DML/DDL** |

---

## Trust Boundaries

Consolidated from the 13 plan-level boundary tables.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| planner/executor → working tree | The executor has write access to the whole repo while the phase contract is `.planning/` only | Source, config, lockfile — must be unchanged |
| build / test runner → working tree | `npm run build`, `npx jest`, `npx tsc` can write caches, build-info and lockfile metadata | Generated files, lockfile metadata |
| `src/` source files → audit artifact | Route and page source is read; nothing is written back | Route shapes, env-var NAMES |
| npm registry → local execution | One-shot `npx` fetched packages execute with full local filesystem access | Third-party code |
| npm read commands → lockfile | npm silently repairs lockfile metadata on read commands when the installed tree has drifted | Dependency graph integrity |
| operator terminal → `.planning/` | Credentials enumerated in `BLOCKING-INPUTS.md` must never cross this boundary | PATs, DB passwords, session cookies, project refs |
| operator terminal → audit tooling | Credentials cross here as environment variables and must never cross further | PAT, connection string, cookies |
| audit tooling → production database | A statement that could write would violate the phase's core constraint | SQL statements |
| audit tooling → `supabase/migrations/` | The directory under audit must not gain a file produced by the audit | Generated migration DDL |
| audit tooling → production application state | Any non-GET request would mutate real user data | HTTP verbs |
| captured database output → git history | Schema dumps and policy expressions carry grants, function bodies, connection details, hard-coded literals | DDL, policy SQL, grants |
| captured HTTP output → git history | `set-cookie` values and response bodies carry live session tokens | Session tokens |
| audit artifacts → git history | `commit_docs` is true; a leaked credential cannot be undone by deleting the file | Every artifact under `.planning/audit/` |
| finding record → evidence | A finding that inlines a value publishes the secret it is about | Evidence fields |
| audit process → audited codebase | The audit must leave the thing it measured unchanged | All tracked files outside `.planning/` |
| server code → client bundle | Any secret crossing this boundary is shipped to every visitor | Service-role key, admin allowlist |
| anonymous request → admin route | The fail-open shape lets this boundary dissolve when a variable is unset | Admin privilege |
| anonymous request → cron handler | A cron route with no confirmed credential is an unauthenticated entry point | Machine privilege |
| anonymous caller → endpoint | The persona matrix records what this boundary should enforce per endpoint | Any API response |
| anonymous key → table data | Row-level security is the only control on this boundary for direct client reads | Every public-schema row |
| authorization ring → RLS ring | The service-role client removes the second ring entirely | RLS-protected rows |
| one tenant's rows → another tenant | A policy with no role clause or an unconditional expression dissolves this boundary | Cross-user rows |
| one club's members → another club's data | Encoded per endpoint by the cross-club persona expectation | Club-scoped data |
| one user's stored objects → another user | Path-prefix ownership is the only control on this boundary | Storage objects |
| public bucket URL → object content | A public bucket is readable by anyone holding the path | Uploaded media |
| external webhook sender → ingestion pipeline | An unverified webhook body reaches the database | Event payloads |
| shared CDN → personalized response | The personalization verdict defines which responses must never be shared | Personalized JSON |
| one user's session → another user's response | The shared CDN is the channel under test | Personalized JSON |
| server error → client response body | Internal error text crossing here is information disclosure | Stack/driver text |
| public route → shipped dependency | An unguarded page importing a vulnerable package is the reachability question | Vulnerable code paths |
| generated types file → trust | The types file is evidence under suspicion, not a source of truth | Schema claims |

---

## Threat Register

All 85 threats from the 13 plan-level `<threat_model>` blocks. `register_authored_at_plan_time: true`.

### Plan 01-01 — Audit harness foundation

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01-01 | Tampering | Working tree outside `.planning/` | mitigate | `tools/readonly-guard.sh` exists; baseline-diffed not emptiness-asserted (check 1 `git status --porcelain -- . ':(exclude).planning' \| diff`); referenced in all 13 plans and 13 summaries. Re-run live → exit 0; commit range `8d329c3~1..HEAD` touches nothing outside `.planning/`. Two baseline refreshes (`c93a5ab`, `e558a80`) are logged in `baseline/BASELINE-REFRESH.md` and affect only untracked non-application paths | closed |
| T-01-01-02 | Tampering | `package.json` / `package-lock.json` | mitigate | `baseline/lock.sha256` captured in Wave 0; guard check 2 (`shasum -a 256 -c`) prints the `git checkout --` restore command. Re-verified live: both OK | closed |
| T-01-01-03 | Information Disclosure | `BLOCKING-INPUTS.md` committed to git | mitigate | File records env-var NAMES only; header block "No value listed in this file is ever pasted into any file under `.planning/`"; covered by the 01-13 gate sweep over the whole audit dir. Independent residual sweep of the file's tree → 0 payloads | closed |
| T-01-01-04 | Repudiation | Finding severity argued after the fact | mitigate | `SEVERITY_SLA.md` first committed at `f02daee` (plan 01-01, Wave 1); `findings.json` first committed at `e618af3` (plan 01-13). Pre-commitment proven by git ordering. `validate.mjs --check sla` → 10/10 PASS | closed |
| T-01-01-05 | Tampering | Audit integrity via an "obvious one-liner" fix | **accept** | Accepted Risks Log AR-01. Procedural controls verified: guard exit 0, `git diff -- src/` clean, and `FOUNDATION_AUDIT.md:1988` "Tempting One-Liners" section present with 9 rows | closed |
| T-01-01-SC | Tampering | npm/npx package installs | mitigate | This plan installs nothing and invokes no `npx`; gate lives in 01-05 and 01-08. Lockfile hash unchanged | closed |

### Plan 01-02 — Endpoint inventory

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-02-01 | Tampering | `src/app/**/route.ts` | mitigate | `tools/gen-endpoint-inventory.mjs:32` imports `readFileSync, existsSync, writeFileSync`; the only `writeFileSync` (:138) targets `inventory/endpoints.json`. Guard in both task verifies | closed |
| T-01-02-02 | Information Disclosure | `env_vars_referenced` in a committed artifact | mitigate | Cited at `gen-endpoint-inventory.mjs:28-29`. Extracted values verified to be 6 distinct NAMES only (`ADMIN_API_KEY`, `ADMIN_EMAILS`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) | closed |
| T-01-02-03 | Repudiation | Regenerated inventory discards hand classification | mitigate | Merge-by-`id` at `gen-endpoint-inventory.mjs:110`; header (:13-16) names the threat and lists the generator-owned fields | closed |
| T-01-02-04 | Information Disclosure | Unclassified endpoint reaching Stage 4 | mitigate | `validate.mjs` `endpoints :: no-residual-placeholders` (PLACEHOLDER `'unknown'`, 10 human fields + every persona cell). Live: 94 rows, 0 placeholder hits | closed |
| T-01-02-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-02. Verified: all `tools/*.mjs` imports are `node:` builtins or relative; no package-manager execution anywhere in `tools/` | closed |

### Plan 01-03 — Build-derived inventory and client-bundle sweep

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-03-01 | Information Disclosure | Client bundle carrying service-role key / admin allowlist | mitigate | `security/client-bundle-sweep.md` § 2–3: six named patterns + literal-value sweep + JWT shape, all 0 over `.next/static`; positive control (§ 5) proves the grep reached the files; 56 `.next/server` hits explained as correct (§ 4). INCONCLUSIVE verdict banked as **F-070** | closed |
| T-01-03-02 | Information Disclosure | Sweep artifact echoing a matched secret | mitigate | Artifact states "`-l` (names) and `-c`/`wc -l` (counts) only", naming the threat. Independent negative-grep of the artifact's tree for JWT and connection-string shapes → 0 | closed |
| T-01-03-03 | Spoofing | Clean sweep proving nothing because the build env had no secret | mitigate | `ENVSTATE: INCONCLUSIVE-key-absent-from-build-env` is the artifact's **first line**; determined by `node -e "process.exit(process.env.SUPABASE_SERVICE_ROLE_KEY ? 0 : 1)"`, never printing the value | closed |
| T-01-03-04 | Tampering | `npm run build` mutating `tsconfig.json` / `next-env.d.ts` / lockfile | mitigate | Guard after both builds (8 references in 01-03-PLAN.md); `.gitignore:12 /.next/`, `:35 *.tsbuildinfo`; lockfile hash verified unchanged | closed |
| T-01-03-05 | Elevation of Privilege | Pages reported unguarded because only the middleware ring was checked | mitigate | `inventory/pages.json` `layout_guard` resolves **14** pages (12 → `moderation/layout.tsx`, 2 → `admin/layout.tsx`), meeting the ≥14 criterion | closed |
| T-01-03-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-03. Lockfile + manifest SHA-256 verified byte-identical after both builds | closed |

### Plan 01-04 — Test / type-check / lint baseline

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-04-01 | Tampering | `tsconfig.tsbuildinfo`, Jest cache | mitigate | `.gitignore:35 *.tsbuildinfo`; guard after every capture; `git diff --exit-code` on tracked files clean | closed |
| T-01-04-02 | Tampering | Installing a test-env package to make a suite pass | mitigate | `baseline/test-runner-decision.md:149-152` names the threat and records "Nothing was installed". Lockfile hash OK. Skipped suites recorded with reasons → **F-066**, handed to STAB-08 | closed |
| T-01-04-03 | Information Disclosure | Captured Jest output embedding a real env value | mitigate | Scoped sweep of `.planning/audit/baseline/` for JWT, secret-prefix, connection-string and bearer shapes → **0 files on all four** | closed |
| T-01-04-04 | Repudiation | A locked decision re-argued later without evidence | mitigate | `test-runner-decision.md` cites captured files by path 12 times (`baseline/tsc.txt`, `jest.txt`, `jest-listtests.txt`, `versions.txt`) rather than asserting counts inline | closed |
| T-01-04-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-04. `npx jest` / `npx tsc` resolved from the installed tree; lockfile hash unchanged | closed |

### Plan 01-05 — Dependency and dead-code slice

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-05-SC | Tampering | `npx --yes knip@6.35.1`, `npx --yes dependency-cruiser@18.3.0` | mitigate | `01-05-PLAN.md:88` `<task type="checkpoint:human-verify" gate="blocking-human">`, ":112" never auto-approved. `01-05-SUMMARY.md:166-172`: APPROVED 2026-09-14, response "Approved", legitimacy evidence recorded, no postinstall on either. `grep -c 'knip\|dependency-cruiser' package.json package-lock.json` → **0 / 0** | closed |
| T-01-05-01 | Tampering | `package-lock.json` / `package.json` | mitigate | Hash assertion after every npm invocation + guard in task verify. Re-verified live: both SHA-256 OK after all six tool runs | closed |
| T-01-05-02 | Tampering | Repository root config files | mitigate | Configs live at `quality/knip.config.json` and `quality/depcruise.config.cjs`; verified **no** root `knip.json`, `.knip.json`, `knip.config.json`, `.dependency-cruiser.*`, or root `depcruise.config.cjs` exists | closed |
| T-01-05-03 | Information Disclosure | Public `/docs` route exposing an OpenAPI surface | mitigate | `quality/dependency-report.md:57` files it as a candidate naming the threat ID; banked as **F-054** (Medium, anonymous public route publishing the full API surface) | closed |
| T-01-05-04 | Elevation of Privilege | Reachable High advisory in a production dependency | mitigate | `dependency-report.md` § 2: one row per package with a written reachability judgment, 18 reachability statements across all 24 High/Critical rows → **F-051**, **F-052**, **F-053**, **F-057** | closed |
| T-01-05-05 | Tampering | knip false positive removing a needed dependency | mitigate | `quality/dead-code.md:66-81`: "No package enters the removal list on knip's word alone"; each of 13 hits carries its **deciding grep** verbatim in a dedicated column | closed |

### Plan 01-06 — Live schema slice

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-06-01 | Tampering | Production and staging databases | mitigate → accept (AR-12) | **Accepted risk AR-12 — see Open Threats (resolved) below.** The declared transports exist and are correct (`tools/sql-readonly.mjs:138` sends `read_only: true`; `tools/sql-readonly-pg.mjs:116-118` sets `default_transaction_read_only = on` then `BEGIN TRANSACTION READ ONLY`), and the service-role client is never used as a transport. But the 22 production captures ran through the Supabase MCP `execute_sql` tool as role `postgres` with `raw/prod/transport-identity.json` self-reporting `txn_read_only: "off"` — no server-enforced read-only flag was in force | closed |
| T-01-06-02 | Information Disclosure | Committed dumps carrying auth-schema grants or an inline key | mitigate | `schema/prod.schema.sql` header states the auth schema is deliberately excluded; scoped to `public` (all objects) + `storage` (buckets/policies) + `cron` (job inventory). Negative-grep: `CREATE SCHEMA auth` 0, `auth.identities`/`auth.sessions`/`auth.refresh_tokens` 0, `CREATE ROLE`/`ALTER ROLE`/`PASSWORD` 0. All 20 `auth.users` occurrences classified as FK constraints on public tables | closed |
| T-01-06-03 | Information Disclosure | DB password captured into a log because it was a CLI argument | mitigate | Both transports read credentials from `process.env` only (`sql-readonly.mjs:56-57`, `sql-readonly-pg.mjs:84-85`) with headers forbidding `set -x`. Verified: **no `set -x` / `set -o xtrace` anywhere under `tools/`**. `redaction/01-06.md` records the practice and sweep counts | closed |
| T-01-06-04 | Information Disclosure | Connection string or token in a committed artifact | mitigate | `MANIFEST.json` `total_redactions: 0` across 20 captures; project ref substituted at capture time (`<PROD-PROJECT-REF>` present in `prod.schema.sql` and `MANIFEST.json`). Independent residual sweep for JWT, secret-prefix, password-bearing connection string → 0 files | closed |
| T-01-06-05 | Tampering | Migration-writing flag creating a migration file | mitigate | `-f` on the phase forbidden list (`BLOCKING-INPUTS.md:52`); `schema/db-diff.prod.sql` header: "No migration file was written to produce it; `-f` was never passed to any command". `ls supabase/migrations/*.sql` → 44 = `versions.txt migration_count=44`; `git status --porcelain -- supabase/` empty | closed |
| T-01-06-06 | Tampering | Local reset accidentally targeting a linked remote | mitigate | `schema/local-reset.txt`: the replay was run against an **out-of-repo copy** of `supabase/`; the failure is recorded as the artifact (→ **F-043**) rather than retried against a remote. Repo is not linked to any project | closed |
| T-01-06-SC | Tampering | Out-of-repo `pg` install for the fallback transport | mitigate | `sql-readonly-pg.mjs:14-28`: install targets `--prefix "$AUDIT_TMP/deps"` outside the repository, reached via `NODE_PATH`, with "never `npm install pg` inside this repository". Lockfile hash verified byte-identical | closed |

### Plan 01-07 — Static authorization slice

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-07-01 | Elevation of Privilege | `api/admin/calculate-popularity` GET and POST | mitigate | `authz/fail-open-register.md` FO-01 (Critical, threat ID cited, fix owner REFAC-13 Stage 3) → **F-001** Critical, 3 line ranges (15-29, 54-66, 165-175), evidence `authz/fail-open-register.md#fo-01`, RLS-bypass noted. Source unchanged | closed |
| T-01-07-02 | Spoofing | `api/cron/send-reminders` comparing an interpolated template | mitigate | FO-02 (High, threat ID cited) → **F-002** High, lines 6-13, fail-closed sibling route named as the recommended fix | closed |
| T-01-07-03 | Elevation of Privilege | RLS-bypassing client constructed in a page component | mitigate | `authz/service-role-register.json` — 25 rows, **0 missing cells** across all four justification fields (`rls_bypass_required`, `caller_authenticated_first`, `user_input_used_as_filter`, `reachable_from_client_bundle`); the page callsite `src/app/users/[id]/page.tsx` is registered → **F-005**. Cross-referenced to the 01-03 bundle sweep with the F-070 caveat carried | closed |
| T-01-07-04 | Elevation of Privilege | Middleware fail-open handler continuing on error | mitigate | FO-03 in the fail-open register + `quality/error-observability.md` (both cite the threat ID); cross-referenced to `pages.json` protection columns → **F-003** (lines 10-16, 113-115) | closed |
| T-01-07-05 | Information Disclosure | Handlers serialising internal error text into the body | mitigate | `quality/error-observability.md` cites the threat ID and counts the class → **F-059** (22 route files, 40 sites) | closed |
| T-01-07-06 | Tampering | The audit fixing an obvious one-liner | mitigate | `fail-open-register.md` closing lines assert `git diff --exit-code --quiet -- src/` and guard. Re-verified live: `git diff --exit-code --stat -- src/` exit 0 | closed |
| T-01-07-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-05. No package-manager execution in this plan's tooling; lockfile unchanged | closed |

### Plan 01-08 — Schema drift slice

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-08-01 | Tampering | `supabase/migrations/` gaining a generated migration | mitigate | `-f` forbidden and never passed (db-diff stub headers); migration count 44 = Wave 1 baseline; `git status -- supabase/` empty | closed |
| T-01-08-02 | Tampering | Production or staging schema mutated by push/repair | mitigate | `db push`, `migration repair`, `db diff -f`, `db reset --linked` on the forbidden list. Grep over the whole audit tree finds **2 occurrences, both prose** (`BLOCKING-INPUTS.md:52` forbidden-list, `migration-list.prod.txt:169` explanatory); no execution | closed |
| T-01-08-03 | Information Disclosure | Captured diff carrying a connection string or key-bearing function body | mitigate | Both `db-diff.*.sql` are documented BLOCKED stubs containing no DDL; drift artifacts hold schema identifiers only. Independent sweep of `schema/` for JWT, secret-prefix, connection-string, bearer → 0 | closed |
| T-01-08-04 | Spoofing | Trusting the types file as schema truth | mitigate | `tools/gen-drift-table.mjs:8-16,51-55`: source 1 = the census (`information-schema-columns.json`), source 3 = `src/lib/supabase/types.ts` "the artifact under suspicion", judged not trusted. Generator-output findings recorded → **F-049**, **F-047** | closed |
| T-01-08-05 | Repudiation | A drift table silently omitting a table its parser could not read | mitigate | `validate.mjs` `drift :: every-live-table-has-a-drift-row` + `all-three-status-columns-set`. Live run: both PASS over 288 rows | closed |
| T-01-08-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-06. Lockfile hash verified in both task verifies; only the installed CLI and Node builtins used | closed |

### Plan 01-09 — RLS and authorization

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-09-01 | Information Disclosure | Tables with row security disabled | mitigate | `rls/rls-review.md` § 1 "Tables with row-level security disabled" — count zero, reported explicitly rather than omitted, cross-referenced to `anon` DML grants on every public table, with the `relforcerowsecurity = false` caveat carried into § 4 | closed |
| T-01-09-02 | Tampering | Policies whose USING is unconditionally true | mitigate | Dedicated flag query (`rls-flags.json`, 94 flags, `qual_is_unconditional_true`); `rls-review.md` § 3 judges per policy across § 3a write-side, § 3b read-side, § 3c intentional-public, § 3d inert-by-role → **F-008**, **F-010**, **F-021**, **F-034** | closed |
| T-01-09-03 | Information Disclosure | Policies applying to the catch-all role | mitigate | `rls-review.md` § 4 "Policies with no `TO` clause" — § 4a the 53 held shut by predicate, § 4b the 8 where the missing role clause *is* the finding, § 4c the privilege-escalation path, § 4d the two `SECURITY DEFINER` helpers → **F-018**, **F-006**, **F-007** | closed |
| T-01-09-04 | Denial of Service | Unindexed policy columns | mitigate | `rls-review.md` § 5 "Unindexed policy columns" + `rls/policy-column-indexes.json`; feeds REFAC-01 (referenced in both) → **F-015**, **F-019**, **F-020** | closed |
| T-01-09-05 | Tampering | A read-only capture accidentally writing | mitigate → accept (AR-13) | **Accepted risk AR-13 — see Open Threats (resolved) below.** Sub-clause verified: this plan issued no SQL at all (read `raw/prod/*.json` from disk) and `redaction/01-09.md:54-58` proves the RLS-bypassing client was never the transport. But the *upstream* capture it consumes ran on the MCP transport with `transaction_read_only: off`, so "server-enforced read-only flag" was not in force | closed |
| T-01-09-06 | Information Disclosure | Captured policy expression carrying a hard-coded value | mitigate | `redaction/01-09.md` § 4: all 101 policy expressions inspected literal-by-literal (named the phase's highest-risk artifact family); all four artifacts swept. Independent residual sweep of `rls/` → 0 | closed |
| T-01-09-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-07. `redaction/01-09.md:59-61`: Node builtins only, lockfile byte-identical | closed |

### Plan 01-10 — Cron, webhook and storage

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-10-01 | Spoofing | `api/cron/send-reminders` and its sibling | mitigate | `async/cron-webhook-inventory.md` § 2.1–2.4: required credential (`CRON_SECRET`) recorded, unset-credential behavior cross-referenced to the fail-open register (§ 2.3), and **none** of the six sources confirms a trigger (§ 2.4, established three independent ways) → **F-002**, **F-038**, **F-040** | closed |
| T-01-10-02 | Tampering | Storage objects overwritten across users | mitigate | `storage/storage-review.md:166,169` ST-01 and ST-04 cite the threat ID; absent ownership predicate on write commands recorded as a cross-user overwrite finding → **F-030** (High), **F-033** (Medium) | closed |
| T-01-10-03 | Information Disclosure | Publicly readable bucket holding non-public content | mitigate | `storage-review.md` § 2 per-bucket read visibility from the live capture compared against application usage; ST-05 cites the threat ID → **F-024**, **F-034** | closed |
| T-01-10-04 | Denial of Service | Bucket with no size or content-type limit | mitigate | ST-02 and ST-03 cite the threat ID; limits recorded per bucket, absent limits named as upload-abuse candidates → **F-031**, **F-032**. Project-wide ceiling recorded as a gap, not assumed | closed |
| T-01-10-05 | Spoofing | Storage webhook edge function processing an unverified body | mitigate | `cron-webhook-inventory.md` § 4.1 "Is the secret verified before the body is processed? **Yes — and the ordering is correct.**" with the full sequence recorded, HMAC over raw text, fail-closed at 500/401 | closed |
| T-01-10-06 | Repudiation | Buckets and a scheduled job in production but in no migration | mitigate | ST-06 cites the threat ID; `storage-review.md` § 4 Drift + `cron-webhook-inventory.md` § 1.4 Drift, cross-referenced to the 01-08 drift table → **F-035**, **F-042** | closed |
| T-01-10-07 | Information Disclosure | Deployment token or cron secret in the dashboard transcription | mitigate | `redaction/01-10.md` § 2 carries a dedicated `WEBHOOK_SECRET\s*[=:]\s*[A-Za-z0-9]` sweep pattern; `async/vercel-crons.md` transcribes only opaque `prj_`/`dpl_` ids (retention justified in `REDACTION.md`). 13/14 patterns 0; the 14th (bearer) resolved to 3 finding-text hits with residual 0. Independent re-sweep of `async/` → 0 payloads | closed |
| T-01-10-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-08. `redaction/01-10.md:33`: Node builtins only; derivation scripts held outside the repository; lockfile byte-identical | closed |

### Plan 01-11 — Persona classification

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-11-01 | Elevation of Privilege | An endpoint left unclassified reaching Stage 4 | mitigate | `validate.mjs` `endpoints :: no-residual-placeholders` and `pages :: …`. Live: 94 endpoint rows × 13 persona keys, **0 "unknown" cells**; 43 page rows clean | closed |
| T-01-11-02 | Information Disclosure | Personalized response misclassified as not personalized | mitigate | `inventory/classification-rules.md` § P1: "True when the SUCCESS body can differ between two callers who are both authorized for the route, given an identical request URL", with two explicit exclusions decoupling it from `auth_requirement`. 27 personalized rows, 8 anonymously reachable, handed to 01-12 as the priority probe set | closed |
| T-01-11-03 | Elevation of Privilege | Layout-guarded pages misreported as unprotected | mitigate | § G1 "`effective_protection` reconciles **both** rings". Live count: `effective_protection = admin` on exactly **14** pages, meeting the ≥14 criterion | closed |
| T-01-11-04 | Spoofing | Persona expectations recording broken behavior as the contract | mitigate | `classification-rules.md` § 0 (lines 19-30) names the threat ID: "`expected_status` is the status the endpoint should return under a correct implementation, not the status it returns today… Recording today's broken behaviour as the contract would launder a defect into a specification". Worked example given for `/api/admin/calculate-popularity` (401 is the contract, 200 is FO-01) | closed |
| T-01-11-05 | Repudiation | A persona matrix that cannot be defended | mitigate | `classification-rules.md` written before the matrix was filled; § 2 personas, § 3 persona derivation rules (incl. the three machine-credential cases), § 5 "Recorded hand overrides" — 4 endpoint cells + 1 page row, each with its reason, plus § "Routes that could not be decided from source" | closed |
| T-01-11-06 | Tampering | Fixing a gap discovered during classification | mitigate | `git diff --exit-code -- src/` re-verified live, exit 0; divergences queued in § 6 for plan 01-13 instead of being fixed | closed |
| T-01-11-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-09. Node builtins only; lockfile unchanged | closed |

### Plan 01-12 — Cache and personalization exposure

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-12-01 | Information Disclosure | Personalized JSON served from a shared CDN to a different user | mitigate | `tools/cache-probe.sh` implements the interleaved two-session probe and the `latent-hazard → leak-confirmed` promotion. Cross-session half withheld (`COOKIE_A`/`COOKIE_B` never supplied) and disclosed in three places with a retry command; the channel was nonetheless **confirmed** by the anonymous run — `curl-summary.json` `varies_on_session: false` (URL-only cache key) with 23 personalized served-from-cache observations incl. `/api/notifications/count` HIT age 43s → **F-025** Critical, routed to REFAC-19 | closed |
| T-01-12-02 | Information Disclosure | Live session token committed inside a captured set-cookie line | mitigate | `cache-probe.sh` `capture()`: `sed -E 's/^([Ss]et-[Cc]ookie:).*$/\1 <REDACTED>/'` runs **inside the writing pipe** before `> "$outfile"`; headers-only (`-o /dev/null -D -`). Verified: all 3 `set-cookie` lines across 45 capture files read exactly `set-cookie: <REDACTED>`; `cache/` negative-grep for `sb-*-auth-token`, JWT shape, bearer → **0 files each** | closed |
| T-01-12-03 | Information Disclosure | Cookie values written into a file under `.planning/` | mitigate | Cookies read only from `${COOKIE_A:-}` / `${COOKIE_B:-}` in the environment (`cache-probe.sh` § INPUTS: "environment only — never CLI arguments, never files"); `BLOCKING-INPUTS.md` § 2 forbids writing them anywhere. `REDACTION.md` records the presence check printed booleans only | closed |
| T-01-12-04 | Tampering | A probe request mutating production data | mitigate | Both `curl` invocations (`:179`, `:184`) are default GET with `-o /dev/null -D -`. Grep for `-X (POST\|PUT\|PATCH\|DELETE)`: the only match is the prohibition comment at `:15`. No `-d`/`--data*` flag present | closed |
| T-01-12-05 | Spoofing | A run with no hits mistaken for an all-clear | mitigate | `control.harness_valid` is a first-class summary field; when false, `run_verdict` becomes `inconclusive-broken-harness` and every personalized row is forced to not-probed. Live: control HIT observed on `/api/clubs/featured`, `harness_valid: true`, `run_verdict: anonymous-half-only` — the negatives are real negatives | closed |
| T-01-12-06 | Information Disclosure | DB password or token echoed by shell command tracing | mitigate | `cache-probe.sh` opens `set -uo pipefail`; grep for `set -x` / `set -o xtrace` across the whole `tools/` tree returns **nothing** | closed |
| T-01-12-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-10. System `curl` + Node builtins only; lockfile unchanged | closed |

### Plan 01-13 — Synthesis and phase gates

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-13-01 | Information Disclosure | Any committed audit artifact carrying a credential | mitigate | `REDACTION.md` § Phase-gate self-sweep: 3 target trees × 6 shapes + both project refs, names-and-counts only, `SWEEP_RESULT=CLEAN`, with a residual payload-shape re-sweep after the F-068 lesson. **Independently re-run by this audit** over `.planning/audit/`, `public/` and the phase dir: 0 files on all six payload-bearing shapes | closed |
| T-01-13-02 | Information Disclosure | A finding's evidence field inlining the value | mitigate | `validate.mjs` `findings :: evidence-resolves-and-is-never-inline` — rejects any whitespace in `evidence` (so an inline literal fails mechanically) and asserts the path resolves under `.planning/audit/`. Live: PASS, 70/70 | closed |
| T-01-13-03 | Tampering | The audit having modified the codebase it audited | mitigate | Guard exit 0; commit-range inspection `git diff --name-only 8d329c3~1..HEAD -- . ':!.planning'` → **empty**; `git show --name-only 8d329c3` outside `.planning/` → empty; lockfile SHA-256 matches Wave 1 | closed |
| T-01-13-04 | Repudiation | A finding that cannot be reproduced or closed | mitigate | `validate.mjs` `ten-required-fields-present-and-non-empty` (includes `reproduction`, `recommended_fix`, `validation_criterion`) PASS 70/70, and `critical-and-high-carry-line-numbers` PASS over all 4 Critical + 17 High | closed |
| T-01-13-05 | Tampering | Human and machine registers drifting apart | mitigate | `FOUNDATION_AUDIT.md` generated by the committed `tools/gen-foundation-audit.mjs`; `validate.mjs` `report-and-json-agree-on-finding-count` → 70 = 70, PASS | closed |
| T-01-13-06 | Repudiation | A severity argued rather than graded | mitigate | `SEVERITY_SLA.md` committed at `f02daee`, findings at `e618af3` (git-proven pre-commitment). 70/70 findings carry non-empty `severity_rationale`; **0 findings contain a CVSS vector**; `sla :: cvss-position-stated` and `severity-is-exposure-adjusted` PASS | closed |
| T-01-13-07 | Tampering | A deferred requirement silently disappearing | mitigate | `README.md` index marks every deferred artifact with `BLOCKED — <reason>` and the blocking input named (lines 77, 122, 123, 129, 130, 145, 157), plus `FOUNDATION_AUDIT.md` § Blocked Items with retry commands. Stated as a principle at `README.md:213` | closed |
| T-01-13-SC | Tampering | npm/npx package installs | **accept** | Accepted Risks Log AR-11. Node builtins, grep and git only; lockfile hash checked in every task verify and verified byte-identical here | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Open Threats (resolved 2026-09-14 — accepted as documented risk)

> Both threats below were OPEN at the end of the auditor's verification pass. The phase owner elected to accept them as documented risks (AR-12, AR-13 in the Accepted Risks Log) rather than bank a new finding into the closed Phase 1 register. The evidence and remediation text is preserved unchanged for the Stage 2 threat model.

### T-01-06-01 — Tampering — Production and staging databases

**Declared mitigation:** "The Management API transport sends a server-enforced read-only flag; the fallback opens a read-only transaction before any statement; a service-role client transport is rejected outright because it enforces nothing."

**What is present.** Both transports exist and implement the control correctly:
- `.planning/audit/tools/sql-readonly.mjs:138` — `body: JSON.stringify({ query: sql, parameters, read_only: true })`
- `.planning/audit/tools/sql-readonly-pg.mjs:116-118` — `SET default_transaction_read_only = on` then `BEGIN TRANSACTION READ ONLY`
- No transport anywhere in `tools/` is built on `createServiceClient` / `SUPABASE_SERVICE_ROLE_KEY`.

**What is absent.** Neither transport was the executing path. All 22 production captures under `.planning/audit/raw/prod/` were taken through the Supabase MCP `execute_sql` tool, and the phase's own probe records the enforcement state:

```
.planning/audit/raw/prod/transport-identity.json
  "transport": "supabase-mcp execute_sql (Management API)"
  "role": "postgres",  "txn_read_only": "off"
```

`raw/prod/MANIFEST.json` confirms `"transport": "supabase-mcp (Management API), SELECT-only"` for all 20 captures, and `01-06-SUMMARY.md` key-decision 2 states it plainly: *"transaction_read_only is off and the role is postgres — the MCP transport does not enforce read-only server-side, so the safeguard actually in force was SELECT-only discipline."* `sql-readonly.mjs`'s own header calls this failure mode out by name: *"read-only only by the author's good intentions."*

**Compensating control, independently verified.** All 22 capture envelopes were parsed: 19 carry a SQL statement, every one beginning `select`/`with`, and 3 are read-only MCP list calls (`list_edge_functions`, `list_extensions`, `list_migrations`). **Zero** contain `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`CREATE`/`GRANT`/`REVOKE`/`TRUNCATE`. The role `postgres` also carries `BYPASSRLS`, so the session had both write capability and RLS-bypass, mitigated only by statement discipline.

**Why this is not closed.** The declared control was a *server-enforced* one, chosen precisely because discipline is not auditable. It was replaced at execution time by discipline. The substitution is disclosed in `01-06-SUMMARY.md`, `redaction/01-06.md`, `redaction/01-09.md`, `redaction/01-10.md` and `rls/rls-review.md` § Derivation — but it appears in **neither** `findings.json` (0 of 70 findings mention the transport, `read_only` or MCP) **nor** `FOUNDATION_AUDIT.md`, so it carries no severity, no owner, no validation criterion and no forward-looking remediation. Stage 2–4 will reach for the same MCP transport with the same posture.

**To close:** bank it as a finding with a validation criterion (e.g. *"every production read in a later phase is issued through `sql-readonly.mjs` or an MCP server configured `--read-only`, and `current_setting('transaction_read_only')` is captured as `on` in the transport-identity envelope"*), or record it in this file's Accepted Risks Log with the SELECT-only evidence as the rationale.

### T-01-09-05 — Tampering — A read-only capture accidentally writing

**Declared mitigation:** "All queries run through the read-only transport from plan 01-06, which sends a server-enforced read-only flag; the RLS-bypassing client is never used as the transport."

**Second clause verified.** `redaction/01-09.md:54-58` — `tools/pivot-rls-heatmap.mjs` contains zero references to `createServiceClient`, `SUPABASE_SERVICE_ROLE_KEY` or `@supabase/supabase-js`, and the reasoning ("using it to perform the audit would be circular, and it enforces nothing") is recorded. This plan additionally issued no SQL at all — it read `raw/prod/*.json` from disk.

**First clause absent.** The capture it consumes inherits the T-01-06-01 gap: no server-enforced read-only flag was in force when the 101 policies were read. Same evidence, same remediation.

---

## Unregistered Flags

Evaluated from the `## Threat Flags` sections of `01-02`, `01-03`, `01-10` and `01-12` summaries.

| # | Flag | Source | Mapping | Verdict |
|---|------|--------|---------|---------|
| 1 | tampering — `src/app/api/clubs/logo/route.ts`, `banner/route.ts`: route-level club-owner authz with no storage-policy predicate | 01-10-SUMMARY | **Mapped → F-030** (High, `authz`). `affected_paths` names both route files with line ranges (logo 34-45, banner 36) plus `storage-review.md:166`; ST-01/ST-04 in the storage review; validation criterion covers the direct-Storage-API bypass | informational |
| 2 | spoofing — `supabase/functions/events-webhook/index.ts`: no replay protection, no deduplication | 01-10-SUMMARY | **Mapped → F-039** (High, `config`). Validation criterion is explicitly *"A test replaying a previously accepted, validly-signed payload and asserting it is rejected"*; also `cron-webhook-inventory.md` § 4.2 | informational |
| 3 | information-disclosure — `scripts/upload-images.ts`, `scripts/fix-instagram-images.ts`: service-role write path from a developer laptop, outside CI and outside `admin_audit_log` (0 rows) | 01-10-SUMMARY | **UNMAPPED.** No `F-nnn` id: grep of `findings.json` for `upload-images` / `fix-instagram-images` / `scripts/` returns only F-064 (dead-tooling residue, unrelated). Absent from `authz/service-role-register.{json,md}`, whose 25 rows are all under `src/`. Described in `async/cron-webhook-inventory.md` § 5 and the § 8 verdict table (Medium) — which itself concludes it *"belongs in a different register"* — but it never entered one. 222 clubs and 229 events, the majority of the production dataset, were written this way | **unregistered_flag (WARNING)** |
| 4 | The Supabase MCP server as a privileged production transport | discovered during this audit (`raw/prod/transport-identity.json`, `01-06-SUMMARY.md` key-decisions) | **UNMAPPED.** A new, credentialed, write-capable, `BYPASSRLS` production transport was introduced mid-phase and is not a component in any plan's boundary table or threat register. Distinct from T-01-06-01/T-01-09-05 (which concern writes) — this is the surface itself, which later stages will inherit | **unregistered_flag (WARNING)** |
| 5 | T-01-12-01 moved from `mitigate` to confirmed-at-channel-level | 01-12-SUMMARY | **Mapped → F-025** Critical (`cache-exposure`), routed to REFAC-19 (`redaction/01-12.md:82`, `classification-rules.md` § C2). Stronger outcome than the register predicted | informational |
| 6 | "None" declared | 01-02-SUMMARY, 01-03-SUMMARY | Confirmed: `gen-endpoint-inventory.mjs` writes one path under `.planning/`; the 01-03 sweep introduced no new surface | informational |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-01-05 | Preventing the audit from applying an "obvious one-liner" fix is out of scope to enforce technically — an agent with write access to the repo cannot be mechanically stopped from editing one line. Mitigated procedurally instead: `tools/readonly-guard.sh` runs in every task verify of all 13 plans and detects the change after the fact, and `FOUNDATION_AUDIT.md` § "Tempting One-Liners" (line 1988, 9 rows incl. F-001, F-002, F-026, F-051, F-052) is the written record that the baseline was preserved on purpose. Verified: `git diff -- src/` clean, commit range touches nothing outside `.planning/` | gsd-security-auditor / plan 01-01 author | 2026-09-14 |
| AR-02 | T-01-02-SC | No package manager is invoked and only Node built-ins are imported, so no install surface exists. Verified: every `import … from` in `tools/*.mjs` resolves to `node:fs`, `node:path`, `node:url`, `node:module`, `node:child_process` or a relative path | gsd-security-auditor / plan 01-02 author | 2026-09-14 |
| AR-03 | T-01-03-SC | `npm run build` runs the already-installed tree — no install, no `npx` registry fetch. The guard's lockfile hash check detects any npm-initiated repair. Verified: `shasum -a 256 -c baseline/lock.sha256` → both OK after both builds | gsd-security-auditor / plan 01-03 author | 2026-09-14 |
| AR-04 | T-01-04-SC | `npx jest` and `npx tsc` resolve from the already-installed local tree; no registry fetch and no lockfile write. Verified by the guard's hash check | gsd-security-auditor / plan 01-04 author | 2026-09-14 |
| AR-05 | T-01-07-SC | This plan runs only grep, Node one-liners over existing JSON, and file writes under `.planning/`; no package manager is invoked | gsd-security-auditor / plan 01-07 author | 2026-09-14 |
| AR-06 | T-01-08-SC | Only the already-installed Supabase CLI and Node built-ins are used; no registry fetch, and the guard's lockfile hash check runs in both task verifies | gsd-security-auditor / plan 01-08 author | 2026-09-14 |
| AR-07 | T-01-09-SC | Only Node built-ins and committed on-disk envelopes are used; no package manager invoked. `redaction/01-09.md:59-61` records the assertion and the guard check | gsd-security-auditor / plan 01-09 author | 2026-09-14 |
| AR-08 | T-01-10-SC | Only Node built-ins are used; the two derivation scripts were held outside the repository in the session scratchpad and reproduced as `node -e` one-liners in the artifacts. `redaction/01-10.md:33` records the assertion | gsd-security-auditor / plan 01-10 author | 2026-09-14 |
| AR-09 | T-01-11-SC | This plan reads and writes JSON with Node built-ins and reruns an existing local generator; no package manager is invoked | gsd-security-auditor / plan 01-11 author | 2026-09-14 |
| AR-10 | T-01-12-SC | The probe uses the system HTTP client (`curl`) and Node built-ins only; no package manager is invoked | gsd-security-auditor / plan 01-12 author | 2026-09-14 |
| AR-11 | T-01-13-SC | This plan runs only Node built-ins, grep and git; no package manager is invoked, and the guard's lockfile hash check runs in every task verify | gsd-security-auditor / plan 01-13 author | 2026-09-14 |
| AR-12 | T-01-06-01 | The declared server-enforced read-only transport (`tools/sql-readonly.mjs`, `tools/sql-readonly-pg.mjs`) was built correctly but was not the executing path: all 22 production captures ran through the Supabase MCP `execute_sql` tool as role `postgres` with `transaction_read_only: off` (`raw/prod/transport-identity.json`). Accepted because the compensating control was independently verified by the auditor — all 22 capture envelopes parsed, 19 SQL statements all begin `select`/`with`, 3 are read-only MCP list calls, zero DML/DDL — and because the production schema, migration count, and policy set are unchanged. Condition of acceptance: Stage 2 must register the Supabase MCP server as a privileged production transport in its threat model, and every production read in Phases 2+ must either run through `sql-readonly.mjs` or capture `current_setting('transaction_read_only') = on` in its transport-identity envelope | Adyan Ullah (phase owner) via /gsd-secure-phase | 2026-09-14 |
| AR-13 | T-01-09-05 | Inherits AR-12: the 101 RLS policies reviewed by plan 01-09 were captured over the MCP transport with no server-enforced read-only flag. The plan itself issued no SQL (read `raw/prod/*.json` from disk) and never used the RLS-bypassing client (`redaction/01-09.md:54-58`). Same compensating evidence and same acceptance condition as AR-12 | Adyan Ullah (phase owner) via /gsd-secure-phase | 2026-09-14 |

*Accepted risks do not resurface in future audit runs.*

**Cross-cutting evidence for AR-02 … AR-11:** `package.json` and `package-lock.json` are byte-identical to their Wave 0 SHA-256 baseline (`baseline/lock.sha256`), re-verified during this security audit. `grep -c 'knip\|dependency-cruiser' package.json package-lock.json` → 0 / 0, confirming the two pinned one-shot tools from plan 01-05 never entered the manifest.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-14 | 85 | 83 | 2 | gsd-security-auditor |
| 2026-09-14 | 85 | 85 | 0 | /gsd-secure-phase — phase owner accepted T-01-06-01 and T-01-09-05 as AR-12, AR-13 |

Breakdown after acceptance: 72 `mitigate` (72 closed) · 13 `accept` (13 closed via Accepted Risks Log) · 0 `transfer`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed — T-01-06-01 and T-01-09-05 accepted as AR-12, AR-13
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-14

**Note for Stage 2 planning.** The phase owner chose route (b) below. Neither threat required a code change. Both could close by either (a) banking the production-transport deviation as a finding in `.planning/audit/findings.json` with a validation criterion that binds later phases to a read-only-enforced transport, or (b) recording it here as an accepted risk with the independently-verified SELECT-only evidence as the rationale. The two `unregistered_flag` warnings (the laptop service-role write path and the MCP transport surface) should be registered in the Stage 2 threat model regardless of which route is chosen.
