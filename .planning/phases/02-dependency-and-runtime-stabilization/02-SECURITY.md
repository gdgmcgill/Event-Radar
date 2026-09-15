---
phase: 2
slug: dependency-and-runtime-stabilization
status: draft
threats_open: 2
asvs_level: 1
created: 2026-09-15
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Phase nature.** Phase 2 is a dependency and runtime stabilization phase: a Node 24 pin, a `@types/node` major, eleven package removals, the `next` 16.3.5 upgrade, the `middleware.ts` → `proxy.ts` rename, four testing devDependencies, a CI test step and an unsuppressed production audit gate, Renovate configuration, a CycloneDX SBOM, and a clean-room reproducibility proof. Almost no application logic changed. Accordingly most mitigations are lockfile-discipline, evidence-integrity and configuration controls, and the register's single highest-risk item (T-02-06-01, the authentication ring surviving the rename) is verified by a characterization suite, a smoke pass and a rename diff rather than by new code.

**Independent re-verification performed by this audit** (re-derived from the tree, not read from the phase's own reports):

| Check | Command / method | Result |
|---|---|---|
| Proxy rename assertion-set identity | Re-ran both PRESERVE suites; compared assertion sets to `evidence/proxy.before.txt` | 27/27, 0 differences |
| Baseline tool | `node evidence/tools/check-baseline.mjs` (22 rules) | all PASS: 278 passing vs 220 baseline, 5 skipped vs 36, react ranges byte-identical, node pin, no forced remediation in `c7c5c49..HEAD` |
| SBOM / lockfile / manifest integrity | `shasum -a 256` on `sbom.cyclonedx.json`, `package-lock.json`, `package.json` | all three match the values recorded in `evidence/sbom-generation.txt` |
| Completion-note citations | Parsed every path cited in `evidence/STAGE-2-COMPLETION.md` | 41 distinct paths, 0 missing (criterion ≥ 12) |
| Credential sweep over evidence | JWT / `sb_secret_` / Postgres-URL / bearer / cookie shapes over all 80 files under `evidence/` | 3 hits, all regex source or pattern documentation; 0 real secrets |
| CI gate not suppressed | `grep -nE 'continue-on-error\|\|\| true\|set +e\|exit 0' .github/workflows/ci.yml` | no match |
| Image Optimization endpoint disabled | `next.config.js:4-11` | `unoptimized: true` with the SECURITY CONTROL comment; `next` resolved at 16.3.5 |
| Production audit census | `evidence/audit.after.json` | 0 critical, 0 high; 2 moderate (`dompurify` via redoc, `yaml`) below the gate |
| Implementation files untouched by the audit | `git status --porcelain` over manifests, `src/`, `next.config.js`, `renovate.json`, `sbom.cyclonedx.json`, `scripts/`, `.github/`, `jest.config.js`, `.nvmrc` | empty |

---

## Trust Boundaries

Consolidated from the 11 plan-level boundary tables.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → lockfile | `@types/node` major, six version moves, four new devDependency names, the `next` upgrade | Third-party code; dependency graph integrity |
| npm registry → lockfile → every request | The framework serves every route; its resolved version is a request-path trust decision | Framework code |
| manifest edit → lockfile → installed tree | Eleven declarations leave; npm re-resolves affected subtrees | Dependency graph |
| npm registry → devDependency tree | Four new package names enter the repository for the first time in this phase | Third-party test-harness code |
| repository → CI runner | `.nvmrc` and the workflow file determine what runs against every pull request | Node version, commands |
| pull request → merge | The audit gate is the mechanical control between a vulnerable dependency and the default branch | Exit codes |
| update bot → default branch | Auto-merge lets a machine land dependency changes without a human reading them | Dependency changes |
| CI logs → evidence | Workflow logs are read and quoted into committed files | Step names, conclusions |
| working tree → `.planning/` evidence | Captured command output is committed and publicly readable | Lint/tsc/jest/build output |
| captured output → committed `.planning/` | Response headers can carry session cookies and bearer tokens | Session tokens (must be redacted) |
| developer machine config → evidence document | The `npm config` probe reads scopes that can contain auth tokens | Registry tokens (must not cross) |
| npm registry advisory data → committed evidence | `npm audit --json` output is written verbatim into `.planning/` | Public advisory identifiers |
| smoke script → running application | The script issues real requests, including 31 POSTs, against whatever `SMOKE_HOST` names | HTTP requests |
| anonymous request → protected page | The renamed file is the only page-level authentication ring in the application | Session cookie, redirects |
| anonymous request → API rate limiter | The limiter runs first inside the same file, before any auth work | `x-forwarded-for`, 429s |
| build-time file convention → deployed platform function | Next compiles the convention into a platform function; the next deploy regenerates it | Auth ring behaviour |
| `next.config.js` → the Image Optimization endpoint | One boolean decides whether an unauthenticated RCE surface is exposed | Image requests |
| public documentation route → the renderer | The patched renderer serves an anonymous public route | Rendered docs |
| Supabase SDK → every data call | The three client factories route the entire application through this package | All data |
| production build → devDependency availability | `tailwindcss-animate` moves out of production dependencies | CSS utilities |
| source deletion → build graph | One component file is removed alongside its package | Import graph |
| test environment → production modules | Reviving suites creates pressure to edit production code to make assertions pass | `src/` |
| test process → `globalThis` rate-limit store | The characterization suite mutates a process-global bucket map | In-memory state |
| skipped suite → recorded contract | Reviving a drifted suite would write a possible defect into the specification | Test assertions |
| exception register → the exit gate | A register row is the only documented bypass of the audit gate | Accepted advisories |
| policy document → future gate decisions | Whatever the policy says becomes the standard the exit gate is measured against | Thresholds, SLA |
| advisory closure narrative → the exit gate | How a batch describes what it closed becomes what the completion note claims | Closure claims |
| finding register → program-wide closure tracking | `closes_in_phase` drives which findings later phases still consider open | Finding status |
| build output → recorded metrics | Bundle figures are quoted in the exit-gate note | Sizes |
| SBOM → downstream consumers | A committed bill of materials is treated as an accurate description of what ships | Component list |
| fresh clone → clean-room build | The clean room is the only place the lockfile's reproducibility claim is actually tested | Lockfile hash, install result |
| completion note → the Stage 3 gate | Phase 3 starts on the strength of what the note asserts | Exit-gate claims |

---

## Threat Register

Status legend: **closed** · **open**. Superscript notes follow the table.

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01-01 | Tampering | `package-lock.json` during the `@types/node` bump | mitigate | `evidence/lock.b0.before.sha256`; `lockfile-review-log.md:19` — 46 lines, 1270→1270 entries, 0 added/removed | closed |
| T-02-01-02 | Spoofing | `@types/node` identity | accept | AR-01 — same-name bump; `^24.13.4` → lock 24.13.4, 0 entries added | closed |
| T-02-01-03 | Elevation of Privilege | CI running untrusted PR code | accept | AR-02 — `ci.yml:10-11` carries only two literal placeholder values | closed |
| T-02-01-04 | Information Disclosure | Evidence captures committed to `.planning/` | mitigate | Credential sweep over all 80 evidence files: 0 real secrets | closed |
| T-02-01-05 | Repudiation | Node pin not honoured by the platform | mitigate | `check-baseline.mjs` node-pin PASS; Vercel dashboard divergence recorded as user_setup at `02-01-SUMMARY.md:212-217` | closed |
| T-02-01-SC | Tampering | npm installs | mitigate | Lockfile b0: 0 entries added or removed | closed |
| T-02-02-01 | Information Disclosure | `scripts/smoke.sh` captures | mitigate | `scripts/smoke.sh:108-114` five redaction patterns, `:309` redact inside the write pipeline; `set -x` count 0 | closed |
| T-02-02-02 | Denial of Service | Target named by `SMOKE_HOST` | mitigate | `scripts/smoke.sh:83-85` fatal when unset, no default | closed |
| T-02-02-03 | Tampering | Characterization suite weakened | mitigate | `check-baseline.mjs` passing-count-not-below-baseline: 278 vs 220 PASS | closed |
| T-02-02-04 | Spoofing | `x-forwarded-for` rate-limit keying | accept | AR-03 — pre-existing at `src/middlewareRateLimit.ts:46`; file unchanged this phase; REFAC-18 / Phase 5 | closed |
| T-02-02-05 | Repudiation | Smoke rows degrading silently | mitigate | `smoke.b6.txt:13-16` prints `expected X got Y` per row | closed |
| T-02-02-SC | Tampering | npm installs | mitigate | No `check-baseline` / `smoke` entry in `package.json` | closed |
| T-02-03-01 | Information Disclosure | `npm config ls -l` capture | mitigate | `devdir-investigation.md:44-46` — only the two config paths and the `devdir` result | closed |
| T-02-03-02 | Repudiation | Policy tuned to the counts | mitigate | `git merge-base --is-ancestor 50e9e26` true for all five remediation commits; census 38→38 across the two pre-policy commits¹ | closed |
| T-02-03-03 | Tampering | Exception register laundering a High | mitigate | `VULNERABILITY-POLICY.md:57-62,100-103` — named human, ISO date, ≤ 90-day expiry, reachability argument, auto-revert | closed |
| T-02-03-04 | Information Disclosure | `audit.phase-start.json` committed | accept | AR-04 — three top-level keys, 0 local-path or secret matches | closed |
| T-02-03-05 | Elevation of Privilege | Cache advisories closed while precondition stays live | mitigate | `VULNERABILITY-POLICY.md:146` cites F-025, the Phase 1 cache matrix and REFAC-19 / Phase 6 | closed |
| T-02-03-SC | Tampering | npm installs | mitigate | `--package-lock-only` only; no manifest touched by 02-03 | closed |
| T-02-04-01 | Tampering | Lockfile during the eleven-package removal | mitigate | `lockfile-review-log.md:20` — 299 removed, 0 added, 0 re-resolved² | closed |
| T-02-04-02 | Denial of Service | Build losing Tailwind animation utilities | mitigate | `tailwindcss-animate` in devDependencies only; `batch-01-build.txt:201` exit_code=0 | closed |
| T-02-04-03 | Denial of Service | Surviving importer of the deleted Radix wrapper | mitigate | `src/components/ui/dropdown-menu.tsx` absent; repo grep for the path returns nothing | closed |
| T-02-04-04 | Elevation of Privilege | `@vercel/*` telemetry removed by accident | mitigate | `@vercel/analytics ^2.0.1` and `@vercel/speed-insights ^2.0.0` both present | closed |
| T-02-04-05 | Spoofing | Same-name replacement during re-resolution | mitigate | 0 lock entries added across batch 1 | closed |
| T-02-04-06 | Repudiation | Advisory improvement claimed without measurement | mitigate | `audit.b1.before.json` → `audit.b1.after.json`: 38 → 15, parsed programmatically | closed |
| T-02-04-SC | Tampering | npm installs | mitigate | Every batch-1 change is a deletion or section move; 0 added | closed |
| T-02-05-01 | Elevation of Privilege | Unauthenticated AVIF RCE in Image Optimization | mitigate | `next` resolved 16.3.5 (≥ 16.3.3); `next.config.js:4-11` `unoptimized: true` with SECURITY CONTROL comment | closed |
| T-02-05-02 | Elevation of Privilege | Unauthenticated RCE on Windows hosts | mitigate | Same 16.3.5 pin; advisory absent from `audit.after.json` | closed |
| T-02-05-03 | Tampering / Information Disclosure | Five RSC cache-poisoning advisories | mitigate + carry-forward | Closed by version; precondition F-025 recorded live at `VULNERABILITY-POLICY.md:146`, `STAGE-2-COMPLETION.md § 12.3`, `deferred-items.md:81`; REFAC-19 / Phase 6 named³ | closed |
| T-02-05-04 | Tampering | React riding along with the framework upgrade | mitigate | `check-baseline.mjs` react-range-byte-identical `^18.3.0 → ^18.3.0` PASS; lock react 18.3.1 | closed |
| T-02-05-05 | Tampering | Upgrading into a version that does not close the advisories | mitigate | `next-target-verification.txt:21-74` — live registry and GHSA `first_patched=16.3.3` | closed |
| T-02-05-06 | Spoofing | Framework identity during re-resolution | accept | AR-05 — same-name bump installed by `npm ci` from the reviewed lockfile | closed |
| T-02-05-SC | Tampering | npm installs | mitigate | No new package name in batch 2 | closed |
| T-02-06-01 | Elevation of Privilege | **Authentication ring disabled by the rename** | mitigate | Assertion sets re-derived 27/27 with 0 differences; `smoke.b6.txt:13-14` 307 → `?signin=required`; `src/proxy.ts:113-120` eight routes⁴ | closed |
| T-02-06-02 | Denial of Service | Rate limiter lost or reordered | mitigate | `src/proxy.ts:6-8` limiter before auth; `smoke.b6.txt:16` 429 with `Retry-After: 60`; rename diff byte-identical | closed |
| T-02-06-03 | Elevation of Privilege | Onboarding guard or ban check lost | mitigate (partial, stated) | `src/proxy.ts:91-110` ban, `:123-135` onboarding; rename diff 2 insertions / 2 deletions; ban-check half deferred to CERT-05 / Phase 7 at `STAGE-2-COMPLETION.md:11`⁵ | closed |
| T-02-06-04 | Denial of Service | Both convention files present | mitigate | `src/middleware.ts` absent; `batch-03-build.txt` has no two-files error, `deprecation_warning_lines_after=0` | closed |
| T-02-06-05 | Tampering | Behaviour fix smuggled into the rename | mitigate | `proxy.rename-diff.txt` — similarity 98%, 2 insertions / 2 deletions across both files | closed |
| T-02-06-06 | Spoofing | Codemod package identity | mitigate | `@next/codemod@16.3.5`, pinned to the installed framework, one-shot, absent from `package.json` | closed |
| T-02-06-07 | Repudiation | Green local run standing in for deployed behaviour | mitigate | **Tier 3 preview-deployment run not executed** — `STAGE-2-COMPLETION.md:11` and `proxy-migration-note.md § 9` carry an empty URL and date. Tracked as UAT in `02-VERIFICATION.md` | **open** |
| T-02-06-SC | Tampering | npm installs | mitigate | `git show --stat 0d66a1d` — manifests not in the rename commit | closed |
| T-02-07-01 | Tampering | React moved by a bare update command | mitigate | `check-baseline.mjs` react / react-dom ranges byte-identical PASS | closed |
| T-02-07-02 | Tampering | Supabase SDK behaviour change across 35 minors | mitigate | Sub-commit reverted; lock `@supabase/supabase-js` 2.81.1; `supabase-js-decision.md`; `STAGE-2-COMPLETION.md § 12.4` | closed |
| T-02-07-03 | Information Disclosure | XSS through the patched sanitizer | mitigate | `src/lib/sanitize.test.ts` four cases; `batch-04-jest.txt:5` PASS as a dedicated criterion | closed |
| T-02-07-04 | Information Disclosure | `/docs` route after the renderer patch | mitigate | `smoke.b4.txt:15` `PASS 7 GET /docs :: expected 200 got 200` | closed |
| T-02-07-05 | Tampering | Unreviewable six-version lockfile | mitigate | `lockfile-review-log.md` per-batch structural table, 4a and 4b reviewed separately | closed |
| T-02-07-06 | Repudiation | High crushed by forced remediation | mitigate | `check-baseline.mjs` no-forced-remediation-in-commit-range `c7c5c49..HEAD` clean PASS | closed |
| T-02-07-07 | Information Disclosure | Clean-room capture carrying a credential | mitigate | JWT grep 0; `.env.local` absent; the two CI placeholders used | closed |
| T-02-07-SC | Tampering | npm installs | mitigate | Six version moves, 0 new names | closed |
| T-02-08-01 | Tampering | Production changed to satisfy a newly-executing assertion | mitigate | `git show --stat 0556444` — jest config, setup and manifests only; no `src/app`, no `src/lib` | closed |
| T-02-08-02 | Tampering | Fixture drift hidden with a cast | mitigate | `as any` / `as unknown as` count in `src/hooks/useEvents.test.ts` → 0 | closed |
| T-02-08-03 | Repudiation | Drifted suite freezing a defect as the contract | mitigate | `skipped-suite-disposition.md:55-58` cursor grep; REFAC-10 / Phase 4 | closed |
| T-02-08-04 | Tampering | React pulled forward by the testing-library install | mitigate | react-untouched PASS; lock react 18.3.1 | closed |
| T-02-08-05 | Denial of Service | Jest matching nothing while CI reports green | mitigate | `passWithNoTests` absent; executing-suites-not-below-baseline 22 of 23 vs 16 of 21 PASS | closed |
| T-02-08-06 | Repudiation | Pass count up, skip count hidden | mitigate | Both asserted independently: 278 vs 220 and 5 skipped vs 36 | closed |
| T-02-08-SC | Tampering | Four new package names | mitigate | All four present at declared ranges; legitimacy audit 0 SLOP / 0 genuine SUS | closed |
| T-02-09-01 | Repudiation | Gate configured but never observed green | mitigate | **Local half met** (`audit-gate-local.txt` exit_code=0, identical command); **the run identifier is unobserved** — `ci-green-run.md:109-118` records UNOBSERVED for all six steps because nothing has been pushed. Tracked as UAT in `02-VERIFICATION.md` | **open** |
| T-02-09-02 | Tampering | Gate defeated by a suppressed exit code | mitigate | `ci.yml` grep for `continue-on-error`, `\|\| true`, `set +e`, `exit 0` → no match | closed |
| T-02-09-03 | Repudiation | Exception register laundering a High | mitigate | Four mandatory attributes at `VULNERABILITY-POLICY.md:100-103`; register examined and empty (0 High) | closed |
| T-02-09-04 | Elevation of Privilege | Surviving production Critical papered over | mitigate | `audit.after.json` → 0 critical, 0 high; policy line 51: a Critical may not be risk-accepted | closed |
| T-02-09-05 | Information Disclosure | Cache advisories reported closed while precondition live | mitigate | Policy still cites F-025 and REFAC-19; caveat not softened | closed |
| T-02-09-06 | Information Disclosure | CI log content quoted into evidence | mitigate | `ci-green-run.md` — step names and conclusions only; credential grep clean | closed |
| T-02-09-SC | Tampering | npm installs / manifest frozen | mitigate → accept | **Mitigation text false as written**: `445f7dc` added `overrides.postcss ^8.5.28` to `package.json` and changed the lockfile. Ratified as AR-07 — user decision recorded at `02-09-SUMMARY.md:115-148`; `lock.b6.diff-review.md` 0 insertions / 57 deletions, 2 removed / 0 added / 0 re-resolved; smoke row 7 PASS | closed |
| T-02-10-01 | Tampering | Compromised package auto-merged by the bot | mitigate | `renovate.json:14` `minimumReleaseAge: 3 days`; `:19-24` patch / pin / digest only; `:27-64` supabase, test-harness, next and major groups `automerge: false` | closed |
| T-02-10-02 | Tampering | React pulled to 19 by a bot PR | mitigate | `renovate.json:66-77` react, react-dom, `@types/react`, `@types/react-dom` majors `enabled: false` | closed |
| T-02-10-03 | Repudiation | SBOM drifting from the lockfile | mitigate | Re-derived: SBOM, lockfile and manifest sha256 all match `sbom-generation.txt`; `--output-reproducible --validate` | closed |
| T-02-10-04 | Spoofing | Malicious one-shot generator or validator | mitigate | `@cyclonedx/cyclonedx-npm@6.0.1` and `renovate@44.93.2` pinned; both absent from `package.json` | closed |
| T-02-10-05 | Information Disclosure | SBOM exposing the dependency surface | accept | AR-06 — `--omit dev`, 320 components; manifests already committed | closed |
| T-02-10-06 | Repudiation | Bundle-size claim without evidence | mitigate | `bundle-size.md:24-39` two metric families, per-change attribution, batch-1 tree-shake stated | closed |
| T-02-10-07 | Repudiation | Automation with no bot behind it | mitigate | `renovate-validation.txt:153` `renovate_github_app_installed = NOT INSTALLED` plus the named human step | closed |
| T-02-10-SC | Tampering | npm installs | mitigate | Generator and validator absent from the manifest; manifests unchanged | closed |
| T-02-11-01 | Information Disclosure | Clean-room capture carrying a credential | mitigate | JWT grep 0; `.env.local` absent (only `.env.local.example`) | closed |
| T-02-11-02 | Repudiation | Completion note asserting unverifiable figures | mitigate | Re-derived: 41 distinct cited paths, 0 missing | closed |
| T-02-11-03 | Repudiation | "Tests pass" standing in for the gate | mitigate | `STAGE-2-COMPLETION.md:70` — 278 passed / 5 skipped quoted against both baselines | closed |
| T-02-11-04 | Tampering | Finding register hand-edited | mitigate | `02-11-SUMMARY.md:106` generator staleness `up to date (70 findings)`; `validate.mjs --check findings` 8 / 0 | closed |
| T-02-11-05 | Repudiation | Silence read as closure | mitigate | `STAGE-2-COMPLETION.md § 12` — four items, each with an owning phase (03, REFAC-10 / 04, REFAC-19 / 06, 03) | closed |
| T-02-11-06 | Repudiation | Automation reported as configured | mitigate | `§ 7` heading: "CONFIGURED; THE BOT IS NOT INSTALLED" | closed |
| T-02-11-07 | Tampering | Masked install via stale `node_modules` | mitigate | `cleanroom-npm-ci.txt:4` temp dir outside the tree; `:35-45` engines asserted before install; `:47-52` lock hash MATCH; `:57` `rm -rf node_modules && npm ci` | closed |
| T-02-11-SC | Tampering | npm installs | mitigate | Throwaway clean-room clone; manifests and `src/` unchanged by 02-11 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

¹ Plan 02-03 line 202 overstates the ordering ("before any `package.json` edit in this phase"): commits `1e2647e` and `3eeaa2a` precede the policy commit. The operative criterion at line 127 ("every **later** batch commit") holds, and the production census is provably unmoved (38 → 38) across the two earlier commits, so the threat was not realized. Documentation inaccuracy only.
² The plan's "roughly 2,000 line" diff threshold was exceeded (8,842 lines). It was retired and replaced by a stronger structural check (0 added / 0 re-resolved), recorded at `lockfile-review-log.md:122`. A substitution upward, not a weakening.
³ The advisories are closed by version; the **exposure is not**. See Residuals.
⁴ Two of the three declared controls are fully verified; the third (Tier 3) is the T-02-06-07 residual.
⁵ The ban-check half has no automated evidence, exactly as the plan declared. See Residuals.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-01-02 | `@types/node` 20 → 24 is a same-name major on a first-party DefinitelyTyped package already declared as a direct devDependency. Verified: lock resolved 24.13.4, 0 entries added or removed (`lockfile-review-log.md:19`) | gsd-security-auditor / plan 02-01 author | 2026-09-15 |
| AR-02 | T-02-01-03 | The `pull_request` workflow on a public repository already ran `npm ci` and `npm run build`; adding `npm test` widens no boundary. Verified: `ci.yml:10-11` carries only two literal placeholder Supabase values and no secret | gsd-security-auditor / plan 02-01 author | 2026-09-15 |
| AR-03 | T-02-02-04 | `x-forwarded-for` as the rate-limit key is a pre-existing property of `src/middlewareRateLimit.ts:46`, not introduced here. Verified: `git log 50e9e26..HEAD -- src/middlewareRateLimit.ts` is empty. Owned by REFAC-18 in Phase 5 | gsd-security-auditor / plan 02-02 author | 2026-09-15 |
| AR-04 | T-02-03-04 | `audit.phase-start.json` is public advisory data produced with `--package-lock-only`. Verified: three top-level keys, 0 local-path or secret matches | gsd-security-auditor / plan 02-03 author | 2026-09-15 |
| AR-05 | T-02-05-06 | `next` is an existing direct dependency; the upgrade is a same-name version bump installed by `npm ci` from a reviewed lockfile. `02-RESEARCH.md` § Package Legitimacy Audit approves the row | gsd-security-auditor / plan 02-05 author | 2026-09-15 |
| AR-06 | T-02-10-05 | The SBOM restates the already-committed `package.json` and `package-lock.json` in CycloneDX form with `--omit dev` (320 components); it discloses nothing new | gsd-security-auditor / plan 02-10 author | 2026-09-15 |
| AR-07 | T-02-09-SC | Plan 02-09's `phase_locked_constraints` #7 and T-02-09-SC's mitigation ("no manifest file is touched") were set aside on a recorded decision to close the last production High (`postcss` GHSA-6g55-p6wh-862q / GHSA-r28c-9q8g-f849). The plan required the gate to be rehearsed green locally before the CI step was added and forbade any manifest change; an exception-register row cannot change an exit code, so both could not hold. What shipped is a single `overrides.postcss ^8.5.28` entry (commit `445f7dc`), strictly smaller than the `styled-components` pin 02-07 recommended, which is infeasible on this tree and recorded as such. Compensating controls executed: `lock.b6.diff-review.md` (0 insertions / 57 deletions; 2 entries removed, 0 added, 0 re-resolved), both install paths checked for manifest/lockfile sync, batch-6 gate green, smoke row 7 PASS at byte-identical size. Neither `--force` nor `--legacy-peer-deps` was used and `npm audit fix` was never run. Decision record: `02-09-SUMMARY.md:115-148`, `VULNERABILITY-POLICY.md:117-120` | Adyan Ullah (phase owner, decision recorded in plan 02-09) — ratified via /gsd-secure-phase | 2026-09-15 |

*Accepted risks do not resurface in future audit runs.*

**Cross-cutting evidence for the `-SC` supply-chain rows:** every `-SC` threat except T-02-08-SC and T-02-09-SC asserts no new package name entered the tree, verified per batch by `lockfile-review-log.md`'s added / removed / re-resolved counts. T-02-08-SC's four new names (the Jest jsdom harness) are dispositioned in `02-RESEARCH.md` § Package Legitimacy Audit. T-02-09-SC is AR-07 above.

---

## Residuals and Carry-Forwards

Recorded so that silence is not read as closure. None is a Phase 2 code gap; each names its owning phase.

| Item | Threat Ref | State | Owner |
|---|---|---|---|
| Real GitHub Actions run of the test step and the production audit gate | T-02-09-01 | **Open.** The workflow is correctly wired and every command was rehearsed green locally, but `main` is ahead of `origin/main` and no run object exists. `ci-green-run.md` records UNOBSERVED honestly | Phase owner: push, observe, fill `ci-green-run.md` § 1 and § 5, re-run `/gsd-secure-phase 2` |
| Tier 3 preview-deployment pass for the proxy rename (five steps) | T-02-06-07 | **Open.** Blocked on the same push. The platform function is regenerated only at deploy time, so `npm run dev` cannot exercise the CDN path | Phase owner: run the checklist in `proxy-migration-note.md` § 9 against a Vercel preview, re-run `/gsd-secure-phase 2` |
| RSC cache-poisoning exposure | T-02-05-03 | Advisories closed by version at 16.3.5; the precondition (F-025, personalized responses under a session-independent CDN key) is **live and Open at Critical** | REFAC-19, Phase 6 |
| Ban-check positive case (a banned user IS redirected) | T-02-06-03 | Byte-identity proven; behavioural assertion needs a banned session from the Phase 3 seed | CERT-05, Phase 7 |
| Two Moderate production advisories (`dompurify` via redoc, `yaml`) | policy clause 4 | Below the `--audit-level=high` gate; tracked, not blocking | Renovate once the app is installed; REFAC-19 review |
| Renovate GitHub App not installed | T-02-10-07 | `renovate.json` is validated but inert until a human installs the app | Phase owner (human step named in `renovate-validation.txt:153`) |
| `.claude/CLAUDE.md` correction is gitignored | F-063 | A fresh clone does not carry the corrected file; self-disclosed at `STAGE-2-COMPLETION.md § 12` | Phase 3 |

**Unmet obligation inherited from Phase 1 (AR-12 / AR-13).** The Phase 1 sign-off accepted the MCP production transport on the condition that "Stage 2 must register the Supabase MCP server as a privileged production transport in its threat model, and every production read in Phases 2+ must either run through `sql-readonly.mjs` or capture `current_setting('transaction_read_only') = on`." This audit checked both halves. Phase 2 issued **no production database reads** (no `raw/prod` capture, no `execute_sql`, no transport-identity envelope exists in the phase directory), so the second clause was never triggered. The first clause was **not met**: none of the eleven Phase 2 threat models registers the MCP transport or the laptop service-role write path flagged in Phase 1. Because Phase 2 never crossed that boundary, no risk was realized, but the registration obligation stands and is carried to **Phase 3**, the first phase that will touch a database (synthetic seed data). Phase 3's plans must carry that boundary and those two flags in their `<threat_model>` blocks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-15 | 78 | 75 | 3 | gsd-security-auditor |
| 2026-09-15 | 78 | 76 | 2 | /gsd-secure-phase — T-02-09-SC ratified as AR-07 from the phase owner's recorded decision; T-02-09-01 and T-02-06-07 left open pending the push |

Breakdown after ratification: 69 `mitigate` (67 closed, 2 open) · 7 `accept` (7 closed via the Accepted Risks Log) · 1 `mitigate (partial, stated)` (closed, residual recorded) · 1 `mitigate + carry-forward` (closed, residual recorded) · 0 `transfer`.

**Disposition against `security_block_on: high`.** Neither open item is a High-severity threat and neither is an exploitable code gap; both are Repudiation-category evidence gaps that the phase's own `02-VERIFICATION.md` already routes to `human_needed`. The auditor's recommendation: not a ship-blocker for the tree as it stands, but both must close before the Stage 3 gate is treated as evidenced.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed — **2 open** (T-02-09-01, T-02-06-07), both blocked on pushing the branch
- [ ] `status: verified` set in frontmatter

**Approval:** pending — close the two open items by (a) pushing and observing a green CI run plus running the Tier 3 preview checklist, then re-running `/gsd-secure-phase 2`, or (b) recording both as accepted risks here with a rationale and an owner, then re-running.
