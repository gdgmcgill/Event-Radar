# Dependency Report — AUDIT-12

**Phase:** 01-read-only-foundation-audit **Plan:** 01-05 **Captured:** 2026-09-14
**Tree:** `main` @ `adffe81`, `node` 24.16.0, `npm` 11.13.0
**Raw evidence (never hand-edited):** `npm-audit.prod.json`, `npm-audit.all.json`, `npm-outdated.json`, `npm-ls-prod.json`, `knip.out.json`, `knip.md`, `depcruise.reaches-apidocs.json` — all in this directory.

Every number below is re-derivable from those files. Nothing was installed, upgraded, or fixed: `package.json` and `package-lock.json` are byte-identical to their Wave 1 hashes in `../baseline/lock.sha256`.

```bash
# Reproduce, in order. The guard runs after every single command.
npm audit --omit=dev --json --package-lock-only > .planning/audit/quality/npm-audit.prod.json
npm audit --json --package-lock-only          > .planning/audit/quality/npm-audit.all.json
npm outdated --json                           > .planning/audit/quality/npm-outdated.json   # no --package-lock-only exists
npm ls --omit=dev --all --json --package-lock-only > .planning/audit/quality/npm-ls-prod.json
npx --yes knip@6.35.1 -c .planning/audit/quality/knip.config.json --reporter json --no-exit-code --no-progress \
  > .planning/audit/quality/knip.out.json
AUDIT_DC_REACHES=1 npx --yes dependency-cruiser@18.3.0 -c .planning/audit/quality/depcruise.config.cjs \
  -T json -R 'node_modules/(swagger-ui-react|redoc|next-swagger-doc)' "src/**/*.{ts,tsx}" \
  > .planning/audit/quality/depcruise.reaches-apidocs.json
bash .planning/audit/tools/readonly-guard.sh
```

## Headline counts

| Scope | critical | high | moderate | low | total | Source |
|---|---|---|---|---|---|---|
| Production only (`--omit=dev`) | 2 | 22 | 13 | 1 | **38** | `npm-audit.prod.json` → `metadata.vulnerabilities` |
| Whole tree (prod + dev) | 3 | 23 | 14 | 2 | **42** | `npm-audit.all.json` → `metadata.vulnerabilities` |
| Dependency count audited | — | — | — | — | 680 prod / 488 dev / 1,269 total | `npm-audit.prod.json` → `metadata.dependencies` |

24 distinct packages carry a High or Critical advisory in the production tree. Each has a row in § 2. `npm audit --omit=dev` groups advisories by package, so 24 rows cover 100+ individual GHSA records — the per-advisory detail for the one package that dominates the register (`next`, 25 advisories) is broken out in § 3.

---

## 1. The API-doc reachability answer (STAB-07 input)

**This is the question plan 01-05 exists to answer, and the two shipped API-doc packages get opposite answers.**

The answer is mechanical, not hand-traced: `depcruise.reaches-apidocs.json` is a dependency-cruiser `--reaches` run over `src/**/*.{ts,tsx}` with node_modules kept in the graph as unfollowed leaves. It cruised 5 modules — exactly the closure that reaches the three named packages:

```
src/app/docs/page.tsx            -> src/components/redoc/RedocUI.tsx, src/lib/swagger.ts
src/components/redoc/RedocUI.tsx -> node_modules/redoc/bundles/redoc.lib.js
src/lib/swagger.ts               -> node_modules/next-swagger-doc/dist/index.cjs
```

| Package | In `dependencies` | Reachable from a production route? | Mechanical evidence | Disposition for STAB-07 |
|---|---|---|---|---|
| `redoc` ^2.5.2 (installed 2.5.2) | yes | **YES — reachable** | `depcruise.reaches-apidocs.json`: `src/app/docs/page.tsx` → `src/components/redoc/RedocUI.tsx` → `node_modules/redoc/bundles/redoc.lib.js` | **Upgrade-or-gate, not remove.** The page is live; removing the package removes a working route. |
| `next-swagger-doc` ^0.4.1 (installed 0.4.1) | yes | **YES — reachable** | `depcruise.reaches-apidocs.json`: `src/app/docs/page.tsx` → `src/lib/swagger.ts` → `node_modules/next-swagger-doc/dist/index.cjs` | **Upgrade-or-gate.** Same route, server half. Latest is 0.5.0 (§ 6). |
| `swagger-ui-react` ^5.17.10 (installed 5.32.1) | yes | **NO — not reachable, not imported at all** | Absent from every module in `depcruise.reaches-apidocs.json`; `knip.out.json` lists it under `package.json` → `dependencies` as unused; `git grep -n swagger-ui-react -- src` returns **zero** matches (the only tracked occurrences are the two `package.json` lines) | **Removable**, together with `@types/swagger-ui-react` (devDep, knip-unused) and `@swagger-api/apidom-ns-openapi-3-1` (prod dep, zero imports in `src/`) |

**Why `/docs` counts as a production route with no gate.** `src/app/docs/page.tsx` is an App Router page; `find src/app/docs -type f` returns that one file, so there is **no `src/app/docs/layout.tsx`** and therefore no layout auth ring. `src/middleware.ts:113` lists exactly 8 `PROTECTED_ROUTES` — `/my-events`, `/create-event`, `/notifications`, `/profile`, `/settings`, `/my-clubs`, `/invites`, `/friends` — and `/docs` is not among them. The middleware `matcher` does run on the path, but the only redirects it can issue are for banned users and onboarding, neither of which is an authentication gate. `/docs` is therefore anonymously reachable and renders the full generated OpenAPI surface of the API.

**Consequence carried into § 2:** every advisory whose only path runs through `swagger-ui-react` is **not reachable** — the package ships in `node_modules` but no code imports it. Every advisory under `redoc` **is** on a reachable path, and is judged on its input surface instead.

**Filed as a finding candidate for 01-13 (AUDIT-17 / T-01-05-03):** a public, unauthenticated `/docs` route publishing the API's own shape. That is an information-disclosure question independent of any CVE, and it is not answered by upgrading anything.

**A note on the filter pattern.** The reaches regex is anchored to `node_modules/(...)` deliberately. The unanchored form `swagger-ui-react|redoc|next-swagger-doc` from RESEARCH § Code Examples 7 additionally matches the local directory `src/components/redoc/`, which inflates the result with modules that reach a *folder name* rather than the package. Both forms give the same verdict here; the anchored one gives it for the right reason.

---

## 2. High and Critical advisories in production dependencies

One row per package, with the path from a direct dependency and a written reachability judgment. "Reachable" means: **does the vulnerable code path execute in response to a request to a production route, or during the production build?** The path column is from `npm-ls-prod.json`; the advisory detail is from `npm-audit.prod.json`.

| # | Package (installed) | Sev | Path from a direct dependency | Reachable? | Judgment |
|---|---|---|---|---|---|
| 1 | `next` 16.2.1 | **critical** | `next@16.2.1` (direct) | **YES** | The framework serves every route; 25 advisories apply at this version. Per-advisory breakdown in § 3. **The single highest-value remediation in the register.** |
| 2 | `tar` 6.2.1 | **critical** | `vercel@32.3.0 > @vercel/next@4.0.7 > @vercel/nft@0.24.1 > @mapbox/node-pre-gyp@1.0.11 > tar@6.2.1` | **NO (runtime)** / build-adjacent | Arbitrary file write on archive extraction. Nothing in `src/` imports `vercel`; it is a CLI that happens to sit in `dependencies` (§ 7). No production route extracts a tar archive. Risk is to whoever runs the CLI, not to a request. |
| 3 | `vercel` 32.3.0 | high | `vercel@32.3.0` (direct, **in `dependencies`**) | **NO** | Zero imports in `src/` (`git grep` and `knip.out.json` both agree). It is the root of rows 2, 4–7, 17, 22. Removing it or moving it to `devDependencies` retires **7 of the 24 rows** in this table at once. |
| 4 | `@vercel/node` 3.0.6 | high | `vercel@32.3.0 > @vercel/node@3.0.6` | **NO** | Builder package inside the unused CLI. Carries the `undici`, `path-to-regexp` and `esbuild` advisories. |
| 5 | `@vercel/routing-utils` 3.0.0 | high | `vercel@32.3.0 > @vercel/redwood@2.0.3 > @vercel/routing-utils@3.0.0` | **NO** | Same CLI subtree. ReDoS via `path-to-regexp`; never parses a request in this app. |
| 6 | `@vercel/redwood` 2.0.3 | high | `vercel@32.3.0 > @vercel/redwood@2.0.3` | **NO** | Framework builder for a framework this project does not use. |
| 7 | `@vercel/gatsby-plugin-vercel-builder` 2.0.6 | high | `vercel@32.3.0 > @vercel/static-build@2.0.7 > @vercel/gatsby-plugin-vercel-builder@2.0.6` | **NO** | Same — Gatsby builder, no Gatsby here. |
| 8 | `@mapbox/node-pre-gyp` 1.0.11 | high | `vercel@32.3.0 > @vercel/next@4.0.7 > @vercel/nft@0.24.1 > @mapbox/node-pre-gyp@1.0.11` | **NO** | Inherits the `tar` critical. Native-binary downloader, not a request path. |
| 9 | `path-to-regexp` 6.2.1 | high | `vercel@32.3.0 > @vercel/node@3.0.6 > path-to-regexp@6.2.1` | **NO** | Backtracking-regex ReDoS. The copy Next uses for routing is a different, unaffected one; this copy is under the CLI. |
| 10 | `undici` 5.23.0 | high | `vercel@32.3.0 > @vercel/node@3.0.6 > undici@5.23.0` | **NO** | 18 advisories incl. cookie/Proxy-Authorization leakage on cross-origin redirect. Under the CLI only — the app's own `fetch` is Node 24 / Next's bundled undici, not this copy. |
| 11 | `swagger-ui-react` 5.32.1 | high | `swagger-ui-react@5.32.1` (direct) | **NO** | **Not imported anywhere in `src/`** (§ 1). Present in the install, absent from the module graph. Root of rows 12–16. |
| 12 | `immutable` 3.8.3 | high | `swagger-ui-react@5.32.1 > immutable@3.8.3` | **NO** | `List` 32-bit trie overflow DoS. Only importer is the unreachable Swagger UI. |
| 13 | `js-yaml` 4.1.1 | high | `swagger-ui-react@5.32.1 > js-yaml@4.1.1` | **NO** | Merge-key quadratic DoS; needs attacker-supplied YAML reaching a parser that never runs. |
| 14 | `lodash` 4.17.23 | high | `swagger-ui-react@5.32.1 > lodash@4.17.23` | **NO** | `_.template` code injection (CVSS 8.1) + prototype pollution in `_.unset`/`_.omit`. Highest-CVSS item in the Swagger subtree; still unreachable because the subtree is. |
| 15 | `axios` 1.13.6 | high | `swagger-ui-react@5.32.1 > swagger-client@3.37.1 > @swagger-api/apidom-reference@1.8.0 > axios@1.13.6` | **NO** | 28 advisories (SSRF, prototype-pollution MitM, credential leakage). All in the Swagger subtree. The app itself does not depend on axios. |
| 16 | `form-data` 4.0.5 | high | `…apidom-reference@1.8.0 > axios@1.13.6 > form-data@4.0.5` | **NO** | CRLF injection via unescaped multipart field names; same dead subtree. |
| 17 | `esbuild` — see § 4 | moderate (listed for completeness) | `vercel@32.3.0 > @vercel/node@3.0.6 > esbuild` | **NO** | Dev-server-request SSRF class; not High in this tree, recorded because the orchestrator brief flagged it. |
| 18 | `brace-expansion` 2.0.2 | high | `redoc@2.5.2 > @redocly/openapi-core@1.34.6 > minimatch@5.1.9 > brace-expansion@2.0.2` | **PATH reachable, input NOT** | On a reachable subtree (§ 1) but the DoS needs attacker-controlled glob strings. The `/docs` page passes a server-generated spec object, never a user glob. **Fix by upgrading `redoc` 2.5.2 → 2.5.4 (§ 6), not by gating.** |
| 19 | `fast-uri` 3.1.0 | high | `redoc@2.5.2 > @redocly/openapi-core@1.34.6 > @redocly/ajv@8.17.2 > fast-uri@3.1.0` | **PATH reachable, input NOT** | Host confusion / SSRF via crafted URIs inside a schema being validated. The only schema validated is the one this app generates from its own JSDoc. Same fix. |
| 20 | `fast-xml-builder` 1.1.4 | high | `redoc@2.5.2 > openapi-sampler@1.7.2 > fast-xml-parser@5.5.8 > fast-xml-builder@1.1.4` | **PATH reachable, input NOT** | XML attribute-quote bypass in sample generation. Triggered by spec content, which is first-party. Same fix. |
| 21 | `postcss` 8.4.31 (nested under next) + 8.5.6 (root) | high | `next@16.2.1 > postcss@8.4.31` | **NO (runtime), YES (build)** | `sourceMappingURL` path traversal reads arbitrary `.map` files, and XSS via unescaped `</style>` in stringify output. PostCSS runs at **build** time over first-party CSS. A malicious CSS input would have to be committed to this repo first. |
| 22 | `nanoid` 3.3.11 | high | `next@16.2.1 > postcss@8.4.31 > nanoid@3.3.11` | **NO (runtime), build-only** | Infinite loop on negative/zero size. Reached only through PostCSS's build-time id generation. |
| 23 | `picomatch` 2.3.1 | high | `tailwindcss-animate@1.0.7 > tailwindcss@3.4.18 > micromatch@4.0.8 > picomatch@2.3.1` | **NO (runtime), build-only** | ReDoS on glob patterns. Tailwind's content globs are first-party and fixed in `tailwind.config.ts`. Note this arrives via a **production** dependency (`tailwindcss-animate`) that pulls the whole `tailwindcss` toolchain into the prod tree — a packaging finding, not a vulnerability. |
| 24 | `sharp` 0.34.5 | high | `next@16.2.1 > sharp@0.34.5` | **NO** | Inherited libvips/libheif heap-corruption CVEs, reachable only through the Next Image Optimization API. **`next.config.js` sets `images.unoptimized: true`**, so the optimizer never runs and sharp never decodes an attacker-supplied image. This single config line is also what defuses three of the `next` advisories in § 3. |
| 25 | `ws` 8.18.3 | high | `@supabase/supabase-js@2.81.1 > @supabase/realtime-js@2.81.1 > ws@8.18.3` | **NO** | Uninitialized-memory disclosure and fragment-DoS require an open WebSocket. `git grep -n "\.channel(\|removeChannel\|realtime" -- src` returns **zero** matches — the app imports supabase-js but never opens a Realtime channel. If a future phase adds Realtime, this row flips to reachable. |

Rows 1–25 cover all 24 High/Critical package entries in `npm-audit.prod.json` plus `esbuild` (row 17, moderate) for continuity with the orchestrator brief.

**The arithmetic that matters for STAB-03.** Of the 24 High/Critical rows, **7 are rooted in `vercel` (a CLI in `dependencies` that nothing imports)**, **6 are rooted in `swagger-ui-react` (a package nothing imports)**, **3 are rooted in `redoc` (reachable path, first-party input only, fixed by a patch bump)**, **4 are build-time-only**, **1 needs a Realtime channel that does not exist**, and **1 — `next` — is genuinely reachable on every request**. Exactly one row requires a real upgrade decision; the rest are removals, patch bumps, or documented non-issues.

---

## 3. `next` 16.2.1 — the 25 advisories, by reachability

Installed is **16.2.1** (`node_modules/next/package.json`), declared `^16.0.3`, latest 16.3.5. Every advisory below applies at 16.2.1.

| Applies? | Advisories | Reachability judgment |
|---|---|---|
| **YES — highest priority** | `GHSA-492v-c6pp-mqqv` (dynamic route parameter injection, 8.1), `GHSA-267c-6grr-h53f` + `GHSA-26hh-7cqf-hhc6` (segment-prefetch bypass), `GHSA-6gpp-xcg3-4w24` (Turbopack single-locale bypass) | **Middleware/Proxy bypass.** This app puts its *only* page-level auth ring in `src/middleware.ts` (8 protected routes). A middleware bypass is a direct authentication bypass here, not a theoretical one. Patched by 16.2.11. |
| **YES** | `GHSA-c4j6-fc7j-m34r` (SSRF via WebSocket upgrades, 8.6) | Server-side request forgery against a Next server; no app code required to opt in. |
| **YES** | `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`, `GHSA-mg66-mrh9-m8jx` (DoS via Server Components / connection exhaustion) | The app is App Router with Server Components throughout. Availability, not confidentiality. |
| **YES — cross-reference AUDIT-08** | `GHSA-3g8h-86w9-wvmq`, `GHSA-vfv6-92ff-j949`, `GHSA-wfc6-r584-vfw7`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q` (cache poisoning / cache confusion of RSC responses) | Whether these are exploitable depends on what the CDN in front of this app actually caches — which is exactly the matrix plan 01-12 produces. **Do not close these until `cache/cache-matrix.csv` exists.** |
| **NO — config rules it out** | `GHSA-h64f-5h5j-jqjh`, `GHSA-q8wf-6r8g-63ch` (Image Optimization DoS), `GHSA-2xp9-vwfh-vxw4` (**critical** — RCE via AVIF in the Image Optimization API) | `next.config.js` → `images.unoptimized: true`. The optimizer endpoint is disabled, so the AVIF decode path is never entered. **This is why one of the two criticals in the register is not an emergency** — but it is one config line away from becoming one, so the line deserves a comment in the source. |
| **NO — not a Windows host** | `GHSA-p293-qw3h-jr36` (**critical** — unauthenticated RCE on Windows-hosted servers, CVSS 9.0) | Requires a Windows server. Deployment is Vercel (Linux). **Assumption, not a verified fact** — this is the one row in the register whose disposition depends on an unverified deployment detail. Confirm the runtime OS before closing it. |
| **NO — feature unused** | `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-4c39-4ccg-62r3`, `GHSA-955p-x3mx-jcvp` (Server Actions / Server Functions) | `git grep -ln "use server" -- src` returns **zero** matches. No Server Actions exist in this codebase. |
| **NO — feature unused** | `GHSA-p9j2-gv94-2wf4` (SSRF via rewrites with attacker-controlled destination) | `next.config.js` declares no `rewrites`. |
| **NO — feature unused** | `GHSA-36qx-fr4f-26g5` (Pages Router + i18n bypass) | App Router only, and `next.config.js` has **no `i18n` block**. |
| **NO — pattern unused** | `GHSA-ffhc-5mcf-pf4q` (XSS with CSP nonces), `GHSA-gx5p-jg67-6x7h` (XSS in `beforeInteractive` scripts) | The CSP in `next.config.js` uses `'unsafe-inline' 'unsafe-eval'` and no nonces, and no `beforeInteractive` script exists. **Separate finding candidate:** a CSP with `unsafe-inline` + `unsafe-eval` is weak on its own terms, independent of this CVE. |

**Upgrade targets, in order:** 16.2.11 closes every middleware-bypass and Server-Component advisory listed as reachable. 16.3.3 additionally closes both criticals. 16.3.5 is current. All three are within the declared `^16.0.3` range, so **the fix is a lockfile bump, not a breaking upgrade** — the reason this is a Stage 2 item and not a Stage 3 one.

---

## 4. Moderate and Low in production dependencies (tracked, not blocking)

14 packages, from `npm-audit.prod.json`: `@vercel/hydrogen`, `@vercel/remix-builder`, `@vercel/static-build`, `@vercel/static-config`, `ajv`, `baseline-browser-mapping`, `dompurify`, `esbuild`, `fast-xml-parser`, `follow-redirects`, `postcss-selector-parser` (low), `sanitize-html`, `styled-components`, `yaml`.

Three deserve a note; the rest inherit the § 2 verdicts of their roots (`vercel`, `redoc`, `swagger-ui-react`):

- **`sanitize-html`** is the only moderate advisory on a first-party import path — `src/lib/sanitize.ts` is the project's own XSS boundary and has a Jest suite. Installed 2.17.1, patched at 2.17.7 (§ 6). **Reachable; upgrade it in Stage 2 with the rest.**
- **`dompurify`** arrives under `redoc` and renders the `/docs` page's markdown descriptions — reachable path, first-party input, same patch-bump fix as rows 18–20.
- **`yaml`** is a *direct production dependency with zero imports in `src/`* (`knip.out.json`). It is both an advisory and a dead dependency — see `dead-code.md`.

## 5. Dev-only advisories (tracked, never blocking)

`npm audit --json` (whole tree) reports 42 vs the production tree's 38. The four dev-only entries are:

| Package | Sev | Judgment |
|---|---|---|
| `handlebars` | high | Dev toolchain only. Never shipped, never on a request path. |
| `browserslist` | high | Build-time browser-target resolution. |
| `@babel/core` | low | Dev toolchain only. |
| `@humanfs/node` | moderate | Pulled by ESLint 9. Lint-time only. |

**Policy input for STAB-03:** dev-only advisories are recorded and re-checked, but they do not gate a release. A dev advisory becomes blocking only if the package also appears in the production tree — which is precisely the `baseline-browser-mapping` situation (declared in `devDependencies`, present in the prod audit through a transitive path, and simultaneously flagged unused by knip).

## 6. `npm outdated` — 41 packages behind

Full machine-readable output in `npm-outdated.json`. `npm outdated` has **no `--package-lock-only` flag** (verified against `npm outdated --help`), so it was run bare and the lockfile hash was re-asserted immediately after; it was unchanged.

**Security-relevant, in `wanted` range (safe bumps):**

| Package | Current | Wanted | Latest | Why it matters |
|---|---|---|---|---|
| `next` | 16.2.1 | 16.3.5 | 16.3.5 | Closes all 25 advisories in § 3, including both criticals |
| `redoc` | 2.5.2 | 2.5.4 | 2.5.4 | Closes rows 18–20 and the `dompurify` moderate |
| `sanitize-html` | 2.17.1 | 2.17.7 | 2.17.7 | The only moderate on a first-party import path |
| `postcss` | 8.5.6 | 8.5.28 | 8.5.28 | Root copy; the vulnerable 8.4.31 is nested under `next` and moves with it |
| `@supabase/supabase-js` | 2.81.1 | 2.116.0 | 2.116.0 | 35 minors behind; carries the `ws` transitive |
| `swagger-ui-react` | 5.32.1 | 5.32.15 | 5.32.15 | Irrelevant if removed per § 1 — **do not spend the upgrade** |
| `yaml` | 2.8.2 | 2.9.1 | 2.9.1 | Irrelevant if removed — unused dependency |

**Major-version gaps (Stage 3 decisions, not Stage 2 bumps):** `@supabase/ssr` 0.7.0 → 0.12.7, `react`/`react-dom` 18.3.1 → 19.3.0, `@types/react` 18 → 19, `typescript` 5.9.3 → 7.0.2, `tailwindcss` 3.4.18 → 4.3.3, `eslint` 9 → 10, `lucide-react` 0.344.0 → 1.46.0, `date-fns` 3.6.0 → 4.4.0, `tailwind-merge` 2.6.1 → 3.7.0, `react-easy-crop` 5 → 6, `next-swagger-doc` 0.4.1 → 0.5.0, `@types/node` 20 → 26, **`vercel` 32.3.0 → 59.16.0 (27 majors)**.

`npm audit` itself reports the `vercel` fix as `{"name":"vercel","version":"59.16.0","isSemVerMajor":true}` — i.e. npm's own advice for 7 of the 24 High/Critical rows is a 27-major-version jump of a CLI that no code imports. **Removing it is strictly cheaper than upgrading it.**

## 7. Finding candidates handed to plan 01-13

| # | Candidate | Evidence | Suggested severity |
|---|---|---|---|
| D-1 | **`vercel` ^32.3.0 is in `dependencies`, not `devDependencies`, and is imported by nothing** | `package.json:47`; zero `src/` imports; `knip.out.json` unused-dependency list; roots 7 of 24 High/Critical rows incl. the `tar` critical | High (packaging / attack surface) |
| D-2 | **`next` 16.2.1 carries 25 advisories, 2 critical, with a patch-range fix available** | § 3; `npm-audit.prod.json`; `npm-outdated.json` | High |
| D-3 | **`/docs` is an anonymous public route publishing the API surface** | § 1; `src/middleware.ts:113` (8 protected routes, `/docs` absent); no `src/app/docs/layout.tsx` | Medium (information disclosure) |
| D-4 | **`swagger-ui-react` + `@types/swagger-ui-react` + `@swagger-api/apidom-ns-openapi-3-1` are installed, vulnerable, and unimported** | § 1; `knip.out.json` | Medium (dead weight carrying 6 High rows) |
| D-5 | **`tailwindcss-animate` in `dependencies` drags the whole Tailwind build toolchain into the production tree** | Row 23 path | Low (packaging) |
| D-6 | **CSP allows `'unsafe-inline'` and `'unsafe-eval'`** | `next.config.js` `headers()` | Medium — noticed while dispositioning `GHSA-ffhc-5mcf-pf4q`, not itself a dependency finding |
| D-7 | **The Windows-RCE critical is dispositioned on an unverified assumption** | § 3, `GHSA-p293-qw3h-jr36` | Low (evidence gap, not a vulnerability) |
| D-8 | **Cache-poisoning advisories cannot be closed until AUDIT-08 runs** | § 3, cache row | Tracking dependency, not a finding |

---

*Requirement: AUDIT-12 · Plan: 01-05 · Phase: 01-read-only-foundation-audit*
*Nothing was installed, upgraded or fixed. `readonly-guard.sh` exits 0.*
