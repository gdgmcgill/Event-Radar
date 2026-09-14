# Pitfalls Research

**Domain:** Foundation audit / stabilize / refactor / certify program on an existing Next.js 16 App Router + Supabase + Vercel application
**Researched:** 2026-09-13
**Confidence:** HIGH

Stage numbering matches `PROJECT.md`: **1 = read-only audit**, **2 = dependency & runtime stabilization**, **3 = targeted refactor (tested vertical slices)**, **4 = test-data certification**.

Most findings below were verified directly against this repository on 2026-09-13 (file reads, `npm audit --omit=dev`, installed-version checks). Those are marked **[repo-verified]**. Framework/platform behavior was verified against first-party vendor documentation (nextjs.org, vercel.com, supabase.com) and is marked **[vendor-doc]**. The `classify-confidence` seam returns `LOW` for the generic `webfetch` provider; the vendor-doc claims here are treated as HIGH because they were fetched from the vendors' own documentation domains, and the distinction is noted per claim.

---

## Critical Pitfalls


### Pitfall 1: A working test suite that nobody runs, silently skipping its highest-value cases

**What goes wrong:**
Stage 3's core discipline — "capture current expected behavior with a test first, refactor, verify the same workflow passes" — is planned against an unknown. The suite actually works: `npx jest` passes **220 tests across 16 suites in ~2.2s**. But there is no `test` script, no CI step, and the project's own documentation describes a different runner, so the suite's existence is not common knowledge and its results gate nothing. Meanwhile **5 of 21 suites are skipped at the file level** and the skip is invisible unless someone reads the summary line — including every component and hook test in the repo. Stage 3 slices get written believing either that there is no safety net, or that the net is bigger than it is.

**Why it happens:**
The documentation contradicts the code, and nobody ran the command. `.planning/codebase/TESTING.md` (dated 2026-03-05) documents a Vitest suite in detail — config, `vi.mock` patterns, `npx vitest` commands — and that suite does not exist; the tests were migrated to Jest at some point and the map was never updated. `CLAUDE.md` correctly says "Jest with ts-jest" and `npx jest`. Two orphan files (`vitest.config.ts`, `vitest.setup.ts`) remain in the repo root and make the contradiction look like a live dual-runner situation rather than stale residue.

**[repo-verified] Actual state (executed 2026-09-13):**

| Fact | Evidence |
|------|----------|
| The suite runs and passes under Jest | `npx jest` → `Test Suites: 5 skipped, 16 passed, 16 of 21 total. Tests: 36 skipped, 220 passed, 256 total. Time: 2.247s` |
| Tests are written in Jest idiom, not Vitest | `grep -rlE '\bjest\.(mock\|fn\|spyOn)'` → **14 of 21 files**; `grep -rlE '\bvi\.(mock\|fn\|hoisted\|spyOn)'` → **0 files** |
| `jest@30.2.0` + `ts-jest@29.4.6` is a supported pairing | `ts-jest` declares `peerDependencies.jest: "^29.0.0 \|\| ^30.0.0"`; there is no ts-jest 30 |
| 4 skipped suites are blocked on a missing package, and say so | `describe.skip("... (@testing-library/react not installed)")` in `ErrorBoundary.test.tsx`, `EventFilters.test.tsx`, `FilterSidebar.test.tsx`, `useEvents.test.ts` |
| The 5th skipped suite targets a deleted route | `src/app/api/events/route.test.ts:19` — `describe.skip("GET /api/events cursor pagination — tests written for cursor-based route that no longer exists")` |
| `@testing-library/react`, `@testing-library/jest-dom` and `jest-environment-jsdom` are absent, and `jest.config.js` sets `testEnvironment: 'node'` | so no component or hook test can run even if un-skipped |
| `vitest` is in neither `package.json` nor the lockfile | `grep -c '"node_modules/vitest"' package-lock.json` → `0` |
| `vitest.config.ts` imports `@vitejs/plugin-react`, which is not installed, and excludes `src/lib/kmeans.test.ts`, which no longer exists | dead orphan file, ~6 months of drift |
| No `test` script in `package.json` | scripts are dev/build/start/lint/check:feedback/load:* only |
| CI runs lint + `tsc --noEmit` + build, never tests | `.github/workflows/ci.yml` |
| `tsconfig.json` excludes `**/*.test.ts(x)` from type-checking | the tests are not type-checked by the one gate that does run |

So the gap is narrower and much cheaper to close than it looks — but it is real: **zero of the 220 passing assertions currently block a merge**, and the 36 skipped ones cover exactly the UI surface Stage 3 will touch last and trust most.

**How to avoid:**
Close the gap in Stage 2, before Stage 3 starts, in one small slice:
1. Add `"test": "jest"` to `package.json` and a test step to `.github/workflows/ci.yml`, so the 220 passing tests start gating merges immediately.
2. Delete the Vitest orphans (`vitest.config.ts`, `vitest.setup.ts`) and correct `TESTING.md`, so the contradiction stops costing reader-time.
3. Install `jest-environment-jsdom`, `@testing-library/react` and `@testing-library/jest-dom`, configure a jsdom project for `.tsx`, and un-skip the 4 self-documenting suites.
4. Decide the 5th suite's fate explicitly — the cursor-pagination tests describe a route that no longer exists, so either the route regressed or the tests are obsolete. That question is a Stage 1 finding, not a Stage 2 cleanup.

Define the Stage 2 exit gate's "green tests" as *a quoted test count that executed and passed, with the skip count separately stated*. A gate that reads "tests pass" is satisfied today by a suite nobody runs.

**Warning signs:**
- Any exit-gate report that says tests pass without quoting both the pass count **and** the skip count.
- `describe.skip` / `it.skip` added during a Stage 3 slice to get a slice green.
- A roadmap phase that says "add tests for X" while the existing suite still gates nothing.
- `npm run test` exiting 0 with "No tests found" (verify whether CI passes `--passWithNoTests`).

**Phase to address:** Stage 1 records the true state as a finding (it is already a Stage 1 requirement: "which test files run under which runner"). Stage 2 wires it into CI and un-skips. Stage 3 depends on it.

---

### Pitfall 2: Re-deciding the runner from the stale map instead of from the running suite

**What goes wrong:**
Stage 1 is chartered to "recommend the single test runner to keep," and the most detailed-looking evidence in the planning directory — `TESTING.md`, with its Vitest config listing, `vi.mock` examples and `npx vitest` commands — points at Vitest. Acting on it means installing Vitest and migrating 14 files of working Jest mocks away from a runner that already passes 220 tests in 2.2 seconds, to satisfy a document that describes a suite which does not exist.

**Why it happens:**
The codebase map is six months old and is the most readable artifact in the repo. It reads as an inventory of the current state rather than a snapshot of a past one, and `PROJECT.md` itself flags the map as dated — but a decision made from `TESTING.md` alone will not feel like a guess.

**[repo-verified] The evidence that should drive the decision:**

| Signal | Value |
|--------|-------|
| Suites passing under Jest today | 16 of 21 (220 tests, ~2.2s) |
| Files using `jest.*` mocks | 14 |
| Files using `vi.*` mocks | 0 |
| `vitest` in `package.json` / lockfile | absent / absent |
| `jest@30` + `ts-jest@29.4.6` compatibility | supported — `ts-jest` peer range is `jest: "^29.0.0 \|\| ^30.0.0"`; no ts-jest 30 exists |
| Blocking the 5 skipped suites | a missing jsdom env + testing-library, not a runner problem |

**The recommendation is Jest**, and it is not a close call: keep Jest, delete the Vitest orphans, add `jest-environment-jsdom` + testing-library so the skipped `.tsx`/hook suites run, add the `test` script and the CI step. Nothing needs rewriting.

**How to avoid:**
Require the Stage 1 runner recommendation to quote executed output (`npx jest`, `npx vitest run`) rather than file listings, and to state the `jest.*` / `vi.*` call-site counts. More generally: this is the first place the six-month-old map is load-bearing, and it is wrong here — treat every `.planning/codebase/` claim as a hypothesis to re-run, which is what `PROJECT.md` already instructs ("the audit re-verifies rather than trusts it").

**Warning signs:**
- A runner recommendation citing `TESTING.md` without a command transcript.
- Any plan item proposing to migrate test files between runners.
- A "dual runner situation" framing that counts config files instead of running them.

**Phase to address:** Stage 1 (decision, from executed evidence), Stage 2 (execution — additive only).

---

### Pitfall 3: The blanket `s-maxage=60` on `/api/*` is an intermittent cross-user data leak — and it is invisible in browser devtools

**What goes wrong:**
`vercel.json` applies `Cache-Control: s-maxage=60, stale-while-revalidate=300` to `/api/(.*)` **[repo-verified]**. Vercel's shared CDN caches a function response whenever `s-maxage` is present and the cacheability criteria are met. The **Cookie request header is not part of the cache key and does not bypass the cache** **[vendor-doc: vercel.com/docs/caching/cdn-cache]**. So a personalized JSON response — recommendations, saved events, notifications, invites, "my clubs" — can be stored once and served to a different McGill student for up to 60 seconds, with another 300 seconds of stale-while-revalidate on top.

**Why it happens:**
Two reinforcing reasons. First, the header was almost certainly added as a blanket performance win before any route was classified as personalized. Second — and this is what keeps it alive — **the bug is intermittent and undetectable from the browser**:

- Vercel's documented cacheability criteria exclude responses that carry a `set-cookie` header. The `@supabase/ssr` middleware emits `Set-Cookie` **only on requests where it actually refreshes the session**. So the same endpoint is uncacheable on the refresh request and cacheable on all the others. Symptoms appear randomly, which reads like "a weird stale-data glitch" rather than a leak.
- Vercel strips `s-maxage` and `stale-while-revalidate` from the response before sending it to the browser when no `CDN-Cache-Control` is set **[vendor-doc]**. Opening devtools and reading `Cache-Control` shows nothing alarming.
- Only one region is deployed (`regions: ["iad1"]`), so there is a single shared cache pool — maximizing the chance that two different users hit the same cache entry.

**How to avoid:**
Invert the default. `/api/*` gets `private, no-store` as the baseline; caching becomes opt-in *per handler*, returned from the handler itself (function-returned headers override `vercel.json` **[vendor-doc]**), and only for handlers the Stage 1 classification marked anonymous-safe (public event lists, public club pages, health). Where a route is public but varies, add an explicit `Vary` on the varying request header rather than relying on the default key.

**Do not "fix" it by deleting all caching.** The Stage 1 requirement to classify all 92 handlers exists precisely to produce the opt-in list; skipping that and going to `no-store` everywhere trades a security bug for a latency regression and burns the classification work.

**Warning signs / how to detect it in Stage 1 (read-only):**
```
curl -sS -D- -o/dev/null -H "Cookie: <session A>" https://<prod>/api/<route>
curl -sS -D- -o/dev/null -H "Cookie: <session B>" https://<prod>/api/<route>
```
Read `x-vercel-cache` (`MISS` then `HIT` across two *different* sessions is the proof) and the `age` header. Do this against production for read-only observation; do the mutation of headers in Stage 3.

**Phase to address:** Stage 1 classify + prove; Stage 3 fix; Stage 4 certify per persona (anonymous / student A / student B must never see each other's payload).

---

### Pitfall 4: "Upgrade Next.js to a patched version" is three differently-sized changes wearing one checkbox

**What goes wrong:**
The Stage 2 item reads as a version bump. It contains a mandatory security patch, an optional-but-load-bearing framework convention migration, and a React major that must *not* ride along.

**[repo-verified] Current state:** `next@16.2.1`, `react@18.3.1`, `react-dom@18.3.1`, no `engines`, no `.nvmrc`, local Node 24.16 / npm 11.13, CI on Node 20.

**The three changes:**

1. **The patch is mandatory.** `npm audit --omit=dev` reports `next` at **critical** severity ("Next.js has a Denial of Service with Server Components") **[repo-verified]**. This is one of only two criticals in production dependencies.

2. **`middleware.ts` → `proxy.ts` is not a rename for this app.** Next 16 deprecates the `middleware` filename and named export in favor of `proxy`; **the `proxy` runtime is Node.js only and cannot be configured to `edge`** **[vendor-doc: nextjs.org/docs/app/guides/upgrading/version-16]**. This repo's `src/middleware.ts` **[repo-verified]** runs on *every* matched request (`matcher` excludes only `_next/static`, `_next/image`, `favicon.ico`, `auth/callback` and image extensions — so all pages **and** all 92 API routes), and on each one it (a) applies an in-memory `Map`-based rate limiter, (b) calls `supabase.auth.getUser()`, (c) issues a `users` table query for `banned_at`/`ban_expires_at`. Moving that from edge to Node changes cold-start behavior, per-instance concurrency, and the lifetime of the in-memory rate-limit `Map` that `CONCERNS.md` already flags as per-instance. Migrate it deliberately, with the rate limiter's replacement decided first.

3. **React 18 → 19 must be its own gated item.** Contrary to the common assumption, **React 18.2+ is still supported on Next 16 — it is deprecated, and React 19 becomes required in Next 17** **[vendor-doc: nextjs.org/docs/messages/react-version]**. So the security patch does *not* force React 19. The pitfall is a "safe minor/patch batch" that pulls `react@19` along with `next@latest` because the install command was `npm install next@latest react@latest react-dom@latest` (which is what the official upgrade guide prints). That drags in `@types/react@19` and re-types every component in one commit, with no way to bisect a regression.

**Other Next 16 breaking changes to check against this repo before the bump [vendor-doc]:** Turbopack is now the default for `next build` (a build fails outright if any plugin injects a `webpack` config — `next.config.js` has none today, but `next-swagger-doc`/`swagger-ui-react` tooling is exactly the kind that adds one); `next lint` removed and `next build` no longer lints (this repo already uses `eslint .`, so it is covered); synchronous `cookies()`/`headers()`/`params`/`searchParams` fully removed; parallel-route slots require `default.js` or the build fails; `revalidateTag` now requires a `cacheLife` second argument; `serverRuntimeConfig`/`publicRuntimeConfig` removed; `next/image` defaults changed (`minimumCacheTTL` 60s → 4h, `qualities` → `[75]`, `maximumRedirects` → 3) — mostly moot here because `next.config.js` sets `images.unoptimized: true` **[repo-verified]**, which is itself worth a finding.

**How to avoid:** Split the checkbox into three roadmap items with independent gates: (a) `next` patch to clear the critical advisory, verify build + smoke; (b) `middleware` → `proxy` migration with the rate-limiter decision attached; (c) React 18 → 19 as a standalone major with its own migration testing, explicitly allowed to be deferred (Next 17 is the forcing function, not Next 16).

**Warning signs:** A single commit touching `next`, `react`, `react-dom`, `@types/react` together. A lockfile diff larger than the batch description.

**Phase to address:** Stage 2, as three separately-gated items.

---

### Pitfall 5: Chasing 38 vulnerabilities one advisory at a time instead of removing the one dependency that causes most of them

**What goes wrong:**
The Stage 2 exit gate is about vulnerabilities, so the work starts with `npm audit` output and proceeds down the list, or worse, with `npm audit fix --force`. Weeks of churn produce a lockfile nobody can review.

**[repo-verified] Measured 2026-09-13, `npm audit --omit=dev`:** 38 production vulnerabilities — **2 critical, 22 high, 13 moderate, 1 low** across 680 prod dependencies.

The dominant cause is one line in `dependencies`: **`vercel@^32.3.0`** — the deployment CLI, shipped as a production dependency. It pulls `@vercel/node`, `@vercel/redwood`, `@vercel/remix-builder`, `@vercel/static-build`, `@vercel/gatsby-plugin-vercel-builder`, `@vercel/hydrogen`, `@vercel/routing-utils`, `@vercel/static-config`, and through them `axios`, `path-to-regexp`, `undici`, `esbuild`, `ajv`, `@mapbox/node-pre-gyp` → **`tar` (critical)**. None of it is reachable from a request path. All of it counts against the gate.

What remains after removing it, and must be triaged on reachability rather than dismissed:

| Package | Severity | Reachable? |
|---------|----------|-----------|
| `next` | **critical** (Server Components DoS) | Yes — the framework itself. Patch. |
| `swagger-ui-react` → `immutable`, `js-yaml` | high | Only if the API-docs page is served in production. Check whether the route is public. |
| `redoc` → `styled-components`/`postcss`, `dompurify` | high/moderate | Same question. Two OpenAPI renderers are shipped; at most one is needed. |
| `sanitize-html` | moderate (incomplete URI scheme filtering) | **Yes** — `src/lib/sanitize.ts` is production code on user-supplied content. Highest real priority after `next`. |
| `sharp` | high (libvips CVEs) | Next's image optimizer — but `images.unoptimized: true`, so likely unreachable. Verify, don't assume. |
| `postcss`, `nanoid`, `brace-expansion`, `picomatch` | high/moderate | Build-time/transitive. Document as exceptions if unpatchable. |

**How to avoid:**
Order the work by blast radius, and re-measure between steps:
1. Record the baseline number (done: 38 / 2 crit / 22 high).
2. Remove `vercel` from `dependencies` (keep it out of `devDependencies` too — deploys run on Vercel's builders and the CLI is available via `npx` when a human needs it). Re-measure.
3. Patch `next`. Re-measure.
4. Decide whether one, both, or neither of `swagger-ui-react` and `redoc` ship in the production bundle. Re-measure.
5. Only then triage the remainder by reachability.

**Warning signs:** `npm audit fix --force` in any command history. A vulnerability count that goes down without anything being removed. A "0 vulnerabilities" claim that was measured with `--omit=dev` omitted, or vice versa, from the baseline.

**Phase to address:** Stage 1 records the baseline; Stage 2 executes in that order.

---

### Pitfall 6: An unpinned toolchain makes "reproducible clean install" unachievable, and the lockfile churns under you

**What goes wrong:**
"Recreate a clean installation from the lockfile and confirm it is reproducible" is a Stage 2 exit criterion, but it is attempted last, after a dozen upgrade batches have already been run with bare `npm install` on an unpinned Node.

**[repo-verified]:** no `engines` field, no `.nvmrc`, no `.node-version`, no `.npmrc`; local Node 24.16 / npm 11.13; CI uses `actions/setup-node@v4` with `node-version: 20` and `npm ci`. Next 16 requires **Node ≥ 20.9** **[vendor-doc]**. There is also a reported unexplained npm `devdir` configuration warning (`PROJECT.md` Stage 2 item) — an unexplained npm config is exactly the kind of thing that changes install output between machines.

The failure mode: `npm install` on npm 11 / Node 24 resolves optional and platform-gated packages (notably `sharp`'s prebuilt binaries and the esbuild platform packages that arrive via `vercel`) differently from `npm ci` on Node 20. The lockfile accumulates entries that CI cannot reproduce, and the divergence is discovered at the gate.

**How to avoid:**
Pin **first**, before any dependency change: add `engines.node` / `engines.npm`, add `.nvmrc`, align the CI `node-version` to the same value, and resolve the `devdir` warning — all in the first Stage 2 commit. Then for every batch, use exact installs (`npm install pkg@1.2.3`) and commit the lockfile diff as its own reviewed commit with the batch. Run `rm -rf node_modules && npm ci` after each batch, not once at the end.

**Warning signs:** "works locally, fails in CI" on an install step. A lockfile diff touching packages the batch did not name. `npm ci` erroring with `EUSAGE` / lock-file-out-of-sync.

**Phase to address:** Stage 2, as the first item — it gates every subsequent batch.

---

### Pitfall 7: Supabase migration drift — and the parts of production that exist in no migration at all

**What goes wrong:**
Stage 3 starts with "database schema, migrations, indexes, and RLS reconciled with production." The reconciliation is attempted with `supabase db push` / `db pull` / `db reset` against an ambient linked project, and either (a) it runs against the wrong project, or (b) it "succeeds" and produces a local/staging database that is quietly missing pieces production has.

**[repo-verified] Why (b) is the likelier and more damaging failure here:**

- **44 migration files, three naming schemes** (`001_`, `008b_`, `20260223_`, `20250210000000_`), and **duplicate ordering prefixes**: `011_event_images_bucket.sql` and `011_rls_audit.sql`; `20260305000002_email_reminder_log.sql` and `20260305000002_phase1_club_rls_and_schema.sql`. Apply order between duplicates is decided by lexicographic filename, which is not what the numbering communicates.
- **Two `remote_schema` dumps** (`20251128053245`, `20260223193741`) — each one a point where the folder was re-baselined from production, meaning the pre-dump migrations may or may not still be replayable.
- **The pg_cron schedule exists only as a SQL comment.** `supabase/migrations/20260313000002_recommendation_engine.sql` ends with:
  `-- SELECT cron.schedule('compute-user-scores', '0 */6 * * *', 'SELECT compute_user_scores()');`
  preceded by "Run this manually in SQL editor after enabling pg_cron." `grep` for an uncommented `cron.schedule` or `pg_cron` across all migrations returns nothing. So a freshly reset local or staging database gets the `compute_user_scores()` function and **no schedule**. Recommendations will not error — they will fall through to the popularity path, or serve empty/stale scores. Stage 4 would then certify a recommendation flow that is not the production flow.
- The same class of gap applies to anything applied through the Supabase dashboard: extensions, storage bucket creation/policies, and any RLS policy hand-edited in the UI.
- **No `supabase/seed.sql` and no `supabase/tests/` directory** exist, so `db reset` yields an empty database with no way to tell whether it matches.

**How to avoid:**
- Stage 1 (read-only) runs `supabase db diff --linked` and a `pg_cron`/extension/bucket inventory against production and records the drift as findings with evidence. No writes.
- Stage 3 makes the folder authoritative: add idempotent migrations for the cron schedule, extensions, and storage buckets/policies; collapse or explicitly document the duplicate-prefix ordering; then **prove** it by resetting a throwaway scratch project from the folder alone and diffing that against production until the diff is empty or every remaining difference is a documented exception.
- Guardrails on every Supabase CLI invocation: pass `--project-ref` explicitly rather than relying on the ambient `supabase link` target; echo the ref and the project name in the same command output before any `db push`; treat `db reset` as local-only and never run it with a linked remote in the shell's history.

**Warning signs:** A `supabase db push` that reports applying migrations you believed were already applied. A staging recommendation feed that looks "fine but generic." A `db diff` that is non-empty after a supposedly complete reconciliation.

**Phase to address:** Stage 1 (diff, read-only), Stage 3 (reconcile + prove), Stage 4 (dataset load must target a database proven equivalent).

---

### Pitfall 8: Generating Supabase types surfaces 18+ errors at once, and the fastest way to green is to re-add the casts

**What goes wrong:**
Stage 3's bottom-up order correctly puts schema → types first. The moment `supabase gen types` replaces the hand-written `src/lib/supabase/types.ts`, every hand-written assumption fails simultaneously. Under deadline the repair is `as any` / `@ts-expect-error` sprinkled to restore a green `tsc`, which preserves exactly the runtime risk the stage exists to remove.

**Why it happens:**
The existing casts are load-bearing in the most critical paths. `CONCERNS.md` counts at least 18 `(supabase as any)` occurrences in production code, including `src/app/auth/callback/route.ts` (lines 149/165/178 — user creation, admin role assignment, onboarding detection, **zero test coverage**), `src/app/api/profile/avatar/route.ts`, `src/app/api/clubs/logo/route.ts`, `src/app/api/users/saved-events/route.ts`. Two schema contradictions will surface at the same time: the dual `start_date`/`end_date` vs `event_date`/`event_time` fallback in `src/app/api/events/route.ts`, and the comment in `src/app/api/events/[id]/route.ts` claiming "Clubs table does not exist" while `clubs` is used by other routes and typed.

**How to avoid:**
- Make type generation its own vertical slice with a **numeric gate**: `grep -rc "supabase as any" src` must strictly decrease and end at zero; record the number in the slice's completion note. `@ts-expect-error` count is gated the same way.
- Resolve the dual date schema by querying production's `information_schema.columns` for the `events` table — not by reading the types file, which is the thing under suspicion.
- Write the auth-callback characterization tests **before** touching its casts. It is the highest-risk untested file in the repo.
- Add the type-generation check to CI (regenerate, `git diff --exit-code`) so drift cannot silently reappear.

**Warning signs:** `as any` or `@ts-expect-error` count rising in any slice. A slice completing with "types generated" but the same cast count as before.

**Phase to address:** Stage 3 (first slice after schema reconciliation).

---

### Pitfall 9: RLS tests that pass no matter what the policies say

**What goes wrong:**
Stage 4 requires "RLS allow/deny tests passing for every table." The tests get written through the app's own Supabase clients — and if any of them is the service client, `service_role` carries `bypassrls`, so every assertion passes regardless of the policy. The suite is green and proves nothing.

**[vendor-doc: supabase.com] The precise semantics matter here:** a service/secret key bypasses RLS **only when the request carries no user access token**; if a user JWT is present, the request runs under that user's policies. So a test harness that sometimes attaches a JWT and sometimes does not will produce inconsistent results that get "fixed" by removing the JWT — silently converting the whole suite into a bypass.

The second failure mode is asserting only the allow case. A policy of `USING (true)` passes every allow test ever written.

**[repo-verified]:** there is no `supabase/tests/` directory, no `seed.sql`, and `createServiceClient` is imported by **24 files**, including 8 non-admin API routes and one **page** (`src/app/users/[id]/page.tsx`).

**How to avoid:**
- Use the documented mechanism: pgTAP files under `supabase/tests/`, run with `supabase test db`, impersonating with `set local role authenticated | anon` and `set local request.jwt.claim.sub = '<user-id>'` **[vendor-doc]**.
- Every table gets allow **and** deny assertions for all four of select/insert/update/delete, per role (anon, authenticated-owner, authenticated-other, organizer-of-other-club, admin, banned).
- Add a mechanical guard: CI fails if any file under `supabase/tests/` references `SUPABASE_SERVICE_ROLE_KEY` or `createServiceClient`.
- Watch the documented policy-authoring mistakes while writing Stage 3 policies **[vendor-doc]**: omitting the `TO` clause; `USING` vs `WITH CHECK` (UPDATE needs both); `to anon using (true)`; a missing SELECT policy silently breaking UPDATE; grants not revoked before policies are added.

**Warning signs:** An RLS test file that constructs a client rather than issuing `set local role`. A deny test that was never observed failing against a deliberately-broken policy. A table with an allow test and no deny test.

**Phase to address:** Stage 3 writes/corrects the policies; Stage 4 writes and gates the tests.

---

### Pitfall 10: Bulk-swapping the service client for the cookie client, then widening policies to make the 403s go away

**What goes wrong:**
Stage 3 item "assess every service-role client usage for RLS bypass risk" turns into a find-and-replace. Legitimate flows start returning 403 — because in several places the service client was compensating for a policy that was never written — and the quickest apparent fix is to loosen the policy until the flow works. Net effect: RLS is now *permanently* wider, and it looks like a completed hardening task.

**[repo-verified] Scope:** `createServiceClient` appears in 24 files. Beyond the expected `/api/admin/*` and `/api/cron/*`, it is used in `src/app/api/clubs/route.ts`, `src/app/api/clubs/[id]/route.ts`, `src/app/api/clubs/[id]/transfer/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/me/suggestions/route.ts`, `src/app/api/profile/avatar/route.ts`, `src/app/api/profile/banner/route.ts`, `src/app/api/recommendations/batch/route.ts`, `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts`, and — notably — the server-rendered page `src/app/users/[id]/page.tsx`. In each of these, RLS is not a defense; the only protection is whatever check the handler remembers to perform.

**How to avoid:**
Per route, in this exact order, one slice at a time:
1. Write the **deny** test for the cross-user / cross-club case against the *current* code. Expect it to fail — that failure is the documented hole, and it is the evidence the slice needs.
2. Add the narrow policy that would make the deny case fail closed.
3. Swap the client.
4. Confirm both the allow and the deny tests pass.

Never widen a policy to unblock a swap. If a flow genuinely needs bypass (cron, admin moderation writing `admin_audit_log`), keep the service client and record it in the exceptions register with the reason.

**Warning signs:** A slice whose diff contains both a client swap and a policy `USING` clause getting broader. A 403 fixed by editing SQL rather than by editing the handler.

**Phase to address:** Stage 1 (inventory all 24 with a "why service role" column), Stage 3 (per-slice).

---

### Pitfall 11: Characterization tests that freeze known defects as the contract

**What goes wrong:**
Stage 3's rule — "capture current expected behavior with a test first" — is the right discipline, and it has a specific failure mode here because several *known security and logic defects are current behavior*. A test written naively asserts the vulnerable behavior. Later, the security fix "breaks the tests," and under time pressure either the fix is reverted or the test is loosened until it passes.

**[repo-verified] The current behaviors that must not be frozen:**

| Current behavior | Should be |
|---|---|
| Unknown event tags silently fall back to `EventTag.SOCIAL` (`src/app/api/events/route.ts`) | explicit handling; the existing test does not cover unknown tags |
| `%` and `_` unescaped in the events `ilike` search (`src/app/api/events/route.ts` ~line 197), while `export/route.ts` sanitizes them | sanitized consistently |
| `GET /api/recommendations/analytics` accessible to any authenticated user (TODO acknowledges it) | admin-only via `verifyAdmin()` |
| `/api/admin/calculate-popularity` falls **open** when `ADMIN_API_KEY` is unset — and uses the service client | fails closed (503) |
| Onboarding guard skips `path.startsWith("/api/")` (`src/middleware.ts` line 130) — an un-onboarded user can call APIs | deliberate decision, tested either way |
| `getSession()` used in `src/app/api/health/route.ts` | `getUser()` where it is an auth check |
| Ban check reads `users` on every matched request with no caching | a decision, not an accident |

**How to avoid:**
Every characterization test is tagged **PRESERVE** or **DEFECT** at the moment it is written, and the tag is sourced from the Stage 1 findings list rather than invented by the test author. DEFECT tests are written asserting the *intended* behavior and marked expected-to-fail (`.failing` / `.skip` with a finding ID in the name) until the fixing slice lands, at which point the marker is removed. A characterization test with no tag does not merge.

**Warning signs:** A test named after a symptom ("returns social for unknown tag") with no finding reference. A security fix PR whose diff includes test assertion changes that loosen rather than tighten.

**Phase to address:** Stage 1 produces the DEFECT list; Stage 3 consumes it.

---

### Pitfall 12: Refactoring with no replayable "before" baseline

**What goes wrong:**
The program's core value is "if a foundation change breaks a workflow that worked before, the program has failed." But nothing currently captures "before" in a form that can be replayed: no E2E suite, no seed data, no recorded responses, no runnable tests. The only available baseline is production, and it is a moving target. Regressions are discovered by users.

**How to avoid:**
Make Stage 1's exit artifact include a **machine-checkable** baseline, not only prose findings — for each of the 92 handlers and 43 pages, the status code and response shape observed under each persona (anonymous, student, organizer, admin, banned), captured against staging or production read-only. Stage 3 replays it after every slice; the diff, not a human's memory, is the regression check. This also gives Stage 4 its starting fixture set.

**Warning signs:** A slice PR whose verification note is "tested manually in dev." A Stage 1 deliverable that is entirely prose. Stage 3 beginning before any baseline file exists.

**Phase to address:** Stage 1 (produce), Stage 3 (replay every slice), Stage 4 (extend into the certification suite).

---

### Pitfall 13: The "read-only" audit starts fixing things

**What goes wrong:**
`PROJECT.md` constrains Stage 1 to read-only, but the pull is strong: the fall-open `ADMIN_API_KEY` check and the `getSession()` call are one-liners sitting right there. A fix lands, and three things follow — the finding never gets a severity record and a validation criterion, the baseline is now taken against changed code, and the Stage 3 slice that was supposed to prove the fix has nothing to prove.

**How to avoid:**
Run Stage 1 on a branch with a pre-commit hook that rejects any change outside `.planning/`. Keep a "tempting one-liners" section in `FOUNDATION_AUDIT.md`; it becomes the first Stage 3 slice, which makes deferring feel like scheduling rather than ignoring.

**Warning signs:** Any non-`.planning/` file modified during Stage 1. A finding whose "recommended fix" is written in past tense.

**Phase to address:** Stage 1.

---

### Pitfall 14: Synthetic data reaching production — and the three vectors specific to this app

**What goes wrong:**
"Datasets load into local Supabase and the existing staging Supabase project; never into production" is stated as a rule, and rules do not enforce themselves. The loader reads credentials from the ambient environment and writes to whatever it finds.

**Three vectors specific to this codebase:**
1. **Credential ambiguity.** `.env.local` is the only credential file today; Stage 4 adds staging credentials "via env." A loader that reads `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from whatever is loaded will point at production whenever `.env.local` is the file that got sourced.
2. **Moderation history contamination.** A mis-targeted load writes into `admin_audit_log`, `event_reports`, `moderation_reviews`, `notifications` and ban columns — rows that are indistinguishable from real moderation history and cannot be cleanly deleted afterward.
3. **`ADMIN_EMAILS` auto-promotion.** The auth callback auto-assigns the admin role from the `ADMIN_EMAILS` env var. A synthetic "admin" address left in a shared env var becomes a real admin on first sign-in.

**How to avoid:**
- The loader takes an explicit `--project-ref` and refuses to run unless (a) the ref is in a hard-coded allowlist of local + staging refs, and (b) a sentinel row exists in the target database (e.g. a `synthetic_environment` table with a matching marker) that Stage 4 creates by hand in each permitted environment. Production can never satisfy (b).
- Every synthetic user's email uses a reserved subdomain that `isMcGillEmail()` rejects — **except** the small set deliberately exercising the accept path, which are themselves listed test cases.
- `ADMIN_EMAILS` is never shared between environments; the staging value is set explicitly and contains only synthetic addresses.
- Datasets are idempotent and fully reversible (a documented teardown that is actually run once before the suite is trusted).

**Warning signs:** A loader that has no environment argument. A seed script that imports from `@/lib/supabase/service`. Any dataset run whose log does not name the target project ref.

**Phase to address:** Stage 4 (design the guardrails before the first dataset).

---

### Pitfall 15: Certifying timezone behavior against a convention that is itself the bug

**What goes wrong:**
Stage 4 requires "timezone/DST cases." Written naively, those tests assert the current convention — and the current convention is a fiction that will eventually have to change, so the tests certify the bug and then block the fix.

**[repo-verified] The convention:** `src/lib/timezone.ts` documents it explicitly — "All events are in Eastern Time (America/New_York). Dates are stored in Postgres as `timestamptz` but the offset is always +00, so the raw value is really 'wall-clock EST/EDT'." `events.start_date` is declared `TIMESTAMPTZ NOT NULL` in `001_initial_schema.sql`. `getESTNow()` reformats the current instant into that same naive-UTC fiction so comparisons line up. Separately, `src/app/api/clubs/[id]/analytics/route.ts` passes `timeZone: "America/New_York"` inline in two places rather than importing the shared constant.

**Two traps:**
1. **Certifying the fiction.** During the spring-forward transition the 02:00–02:59 local hour does not exist; an event stored as `02:30` naive-UTC on that date is unrepresentable as a real instant. A DST test written against the current convention asserts a value that has no real-world meaning, and passes.
2. **"Fixing" it in place.** Converting stored values to true UTC shifts every existing event by 4 or 5 hours. Done as an incidental part of a slice, that silently moves every event in production.

**Also worth stating plainly so nobody mistakes it for the fix:** `America/New_York` and `America/Toronto` share identical UTC offsets and identical DST rules. Renaming the constant to match the Montreal campus is cosmetic and changes no behavior. Treating the rename as the timezone fix is the pitfall.

**How to avoid:**
Decide the storage contract explicitly in Stage 3 — either (a) keep naive-local-in-`timestamptz`, document it as a deliberate contract, and add a DB constraint or check that makes the `+00` assumption enforceable, or (b) migrate to true UTC with a display timezone, which requires a data migration that rewrites every existing row and a coordinated frontend change. Only after the contract is decided does Stage 4 write DST cases against it. Centralize the timezone constant so `analytics/route.ts` cannot drift.

**Warning signs:** A DST test that passes on the first run without anyone reasoning about which hour is being asserted. A slice that changes date handling and does not include a data migration. Two different timezone strings in the codebase.

**Phase to address:** Stage 3 (decide the contract + migrate if changing), Stage 4 (certify against the decided contract).

---

### Pitfall 16: A scale dataset that is uniformly random, and E2E tests welded to seed IDs

**What goes wrong:**
"Thousands of users, clubs, events, saves, RSVPs, notifications, and interactions" gets generated with a uniform random generator. It loads, the app is fast, certification passes — and none of the known performance traps fire, because uniform data has no hot spots and no long tail.

**Why it matters specifically here:**
- The recommendation engine is the most distribution-sensitive component in the app: MMR diversity re-ranking, tag-affinity matching over a tag hierarchy, and a popularity fallback that only triggers for users with no pre-computed scores. Uniform data gives every user a similar interaction count, so the new-user fallback path and the diversity re-ranker are never meaningfully exercised.
- The known `select('*')`-then-filter pattern in `/api/events` and the "load all RSVP rows and count in JS" pattern in `/api/events/[id]/rsvp` **[repo-verified via CONCERNS.md]** only degrade when a *single event* has thousands of RSVPs. A dataset with thousands of RSVPs spread evenly across thousands of events will not surface either.
- The existing k6 scripts (`load-tests/k6-online-users.js`, `k6-onboarding.js`) are the designated starting point; run against flat data they produce a reassuring number.

**How to avoid:**
Derive the dataset's shape from production aggregates — percentiles of events-per-club, RSVPs-per-event, interactions-per-user, saves-per-user — rather than from a uniform generator. Assert the resulting distribution in the loader (e.g. "p99 event has ≥ N RSVPs") so a regression in the generator is caught. Include deliberate hot spots: one club with a large share of events, one event with a very large RSVP count, a long tail of users with 0–2 interactions.

For E2E: never reference generated UUIDs. Look records up by stable semantic attributes ("the event whose title is `E2E_SOLD_OUT_EVENT`"), so the dataset can be regenerated without rewriting the tests.

**Warning signs:** A generator with no distribution parameters. An E2E test file containing a literal UUID. A load test result that is flat across every endpoint.

**Phase to address:** Stage 4.

---

### Pitfall 17: Observability added in a form that leaks, disappears, or checks the wrong things

**What goes wrong:**
"Structured logging, Sentry, and an operational health check added" is one Stage 3 checkbox covering three things that each have a distinct way of being done wrong.

**Sentry — source maps.** Next 16 builds with **Turbopack by default** **[vendor-doc]**. A Sentry setup copied from a webpack-era guide produces uploads that never happen, and every production stack trace stays minified — leaving the team in the same debugging position it started in, but with a vendor bill.

**Sentry — PII.** This application's error contexts naturally contain McGill student emails, user IDs, ban reasons and moderation notes. The auth callback holds the full user object. Default PII capture on a university platform ships student identifiers to a third party. Decide the scrubbing rules and the data-residency question *before* the SDK is installed, not after the first incident.

**Structured logging.** Replacing 179 `console.*` calls **[repo-verified via CONCERNS.md]** with a logger that buffers and flushes asynchronously loses log lines when a Vercel function suspends between invocations. On Vercel, synchronous newline-delimited JSON to stdout is the reliable shape. Also: the existing calls carry useful context prefixes (`[Callback]`, `[Middleware]`, `[Cron]`) — a mechanical replacement that drops them makes debugging *worse* while claiming an improvement.

**Health check.** `src/app/api/health/route.ts` currently checks database, Supabase auth, and Azure OAuth **[repo-verified]** — and uses `getSession()` while doing it. It does **not** check the two things that fail silently in this system: (a) whether the `compute-user-scores` pg_cron job exists and when it last succeeded (see Pitfall 7 — it is scheduled manually and in no migration), and (b) whether the `events-webhook` edge function and the Instagram scraper ingestion path are alive. A green health check that does not cover the silent failures is worse than no health check, because it is trusted.

**Also [repo-verified]:** `vercel.json` contains **no `crons` key**, yet `src/app/api/cron/send-reminders/route.ts` and `src/app/api/cron/send-feedback-requests/route.ts` exist and are documented as "likely triggered via Vercel Cron or external scheduler." Whether reminder emails are actually firing in production is currently unknown. That is a Stage 1 finding, not a Stage 3 assumption.

**How to avoid:** Split the checkbox into three items with distinct acceptance criteria: (a) a deliberately-thrown production error resolves to original source lines in Sentry; (b) a logged line containing a known-synthetic email is confirmed scrubbed; (c) the health endpoint returns unhealthy when the cron job is stale and when the webhook is unreachable, verified by disabling each in staging.

**Phase to address:** Stage 1 (inventory what actually runs, including the cron question), Stage 3 (implement).

---

### Pitfall 18: The exceptions register that never gets written, and gates that soften under time pressure

**What goes wrong:**
The Stage 2 gate permits "no reachable high-severity production vulnerabilities **without a documented exception**." With 22 highs today **[repo-verified]**, the exception register *is* the deliverable — and it is the one most likely to be replaced by a verbal "we looked at those, they're fine." Stage 4's "no unresolved critical or high logic defects" fails the same way. A stage is then declared complete on a gate that was reinterpreted rather than met, and the next stage builds on it.

**How to avoid:**
Make the register a file with a required schema — advisory ID or finding ID, package/path, the reachability argument including the call path that does *not* exist, the owner, and a review date — and make the gate a mechanical check: every advisory ID still present in `npm audit --json` output must have a matching entry, or the gate fails. The same for Stage 4 findings. A gate that a script can evaluate cannot be softened in a meeting.

**Warning signs:** A stage marked complete with no new file in the exceptions register. An exception entry whose reachability argument is "not exploitable" with no call-path reasoning. A gate criterion reworded between the plan and the completion note.

**Phase to address:** Stage 2 and Stage 4 (define the register's schema in Stage 1, alongside the findings format).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `(supabase as any)` to silence a type mismatch | Unblocks a handler in minutes | Schema changes break at runtime, not compile time; 18+ sites now, all in write paths including the auth callback | **Never** in this program — Stage 3's type slice gates on the count reaching zero |
| Service client "because RLS is in the way" | The endpoint works today | RLS is no longer a defense for that table; the missing policy is never written; 24 files now | Only for cron and admin moderation writes, and only with an exceptions-register entry |
| Blanket cache header in `vercel.json` | One line, global latency win | Personalized responses enter a shared cache; the bug is intermittent and invisible in devtools | Never for `/api/*`; acceptable per-route, returned from the handler, for classified-public routes |
| Deployment CLI in `dependencies` | `npx vercel` available anywhere | ~30 of 38 production advisories including a critical; 680-package prod tree | Never — use `npx vercel@latest` ad hoc |
| Two OpenAPI renderers (`swagger-ui-react` **and** `redoc`) | Each was easy to drop in | Two large dependency subtrees, several high advisories, and the `'unsafe-inline' 'unsafe-eval'` in the CSP that they likely motivated | Pick one, or serve the spec statically and drop both |
| In-memory `Map` rate limiter | Zero infrastructure | Per-instance, so the real limit is `N × configured`; admin routes exempt entirely | Only while single-instance, and only with the limitation written into the exceptions register |
| Naive wall-clock values stored in `timestamptz` | Avoided a timezone refactor once | Unrepresentable instants at DST boundaries; any future correction shifts every existing event by 4–5h | Acceptable **only** if made an explicit, documented, constraint-enforced contract in Stage 3 |
| Hand-written database types | No CLI step in the workflow | Drift, then `as any`, then runtime failures | Never — generate in CI with a `git diff --exit-code` check |
| `catch (error: any)` | Fast | Defeats strict mode; `error.message` silently undefined on non-Error throws | Never; `unknown` + narrowing is the same number of lines |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel CDN | Assuming a session cookie prevents caching of a personalized response | The Cookie **request** header is not in the cache key and does not bypass the cache **[vendor-doc]**. Only a `set-cookie` **response** header, `private`/`no-cache`/`no-store`, an `Authorization` request header, or a non-cacheable status prevents it. Default `/api/*` to `private, no-store` and opt in per route. |
| Vercel CDN | Verifying cache behavior by reading `Cache-Control` in browser devtools | Vercel strips `s-maxage`/`stale-while-revalidate` before sending to the browser when `CDN-Cache-Control` is absent **[vendor-doc]**. Verify with `x-vercel-cache` and `age`. |
| Vercel Cron | Assuming cron routes run because the handlers exist | `vercel.json` has no `crons` key **[repo-verified]**. Confirm the actual trigger (Vercel Cron, external scheduler, or nothing) in Stage 1 before Stage 3 builds a health check around it. |
| Supabase Auth | `getSession()` for an authorization decision | `getSession()` reads cookies without server-side verification. Use `getUser()` anywhere the answer gates access — including `src/app/api/health/route.ts` **[repo-verified]** |
| Supabase Auth | Trusting a cookie-derived identity in middleware for authorization | Middleware is a routing/UX guard. Every API route re-verifies independently — the onboarding guard already skips `/api/` **[repo-verified]**, which is precisely why the route-level check must exist. |
| Supabase RLS | Testing policies through a client that holds the service key | `service_role` has `bypassrls` **[vendor-doc]**. Test via pgTAP with `set local role` + `set local request.jwt.claim.sub`. |
| Supabase RLS | Assuming the service key always bypasses RLS | It bypasses **only when the request carries no user access token**; with a user JWT it runs under that user's policies **[vendor-doc]**. Mixed harnesses produce inconsistent results. |
| Supabase CLI | `db push` / `db reset` against the ambient linked project | Always pass `--project-ref` explicitly and echo it. `db reset` is local-only. |
| Supabase (pg_cron / extensions / buckets) | Assuming the migrations folder can rebuild production | `cron.schedule('compute-user-scores', ...)` exists only as a comment **[repo-verified]**. Add idempotent migrations for schedules, extensions and storage policies, then prove it against a scratch project. |
| Supabase Edge Functions | Including `supabase/functions/` in the app's type-check or runner | It is Deno and already excluded from `tsconfig`, and `jest.config.js` already ignores `supabase/functions/tests/` — preserve that ignore when the Jest config is touched in Stage 2 |
| Sentry + Next 16 | Using a webpack-plugin source-map guide | Next 16 builds with Turbopack by default **[vendor-doc]**; use the Turbopack-compatible upload path or builds produce no usable maps |
| Instagram scraper (Apify) | Treating it as out of scope because the milestone excludes ingestion | "Keeping the existing Instagram scraper working" is explicitly in scope. Content-hash dedup and image migration must survive every schema slice. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Middleware does `getUser()` + a `users` ban-status query on **every** matched request — pages and all 92 API routes **[repo-verified]** | Uniform latency floor on every navigation; DB connection pressure that tracks page views, not API calls | Narrow the `matcher`; cache the ban decision in a short-lived signed cookie or the session claim; re-evaluate when moving to the Node-only `proxy` runtime | Immediately visible under the k6 online-users scenario; worsens with concurrency |
| RSVP counts loaded as rows and counted in JS **[CONCERNS.md]** | One endpoint slow only for popular events | `count: 'exact', head: true` per status, or a view/RPC | A single event with thousands of RSVPs — which a uniformly-distributed scale dataset will never create |
| `select('*')` on events with no club join, then fabricating club objects **[CONCERNS.md]** | Oversized payloads; the cache header masks it | Proper join; explicit column list | Grows with event count and column count; masked today by `s-maxage=60` |
| Popularity recalculation: one RPC per event, batched 10 at a time **[CONCERNS.md]** | Admin endpoint times out | Single bulk Postgres function | Low hundreds of events |
| Recommendation scores refreshed by a 6-hour pg_cron job | Recommendations up to 6h stale — and in any environment where the schedule was never created, they silently fall back to popularity **[repo-verified]** | Put the schedule in a migration; add a health check on last-run time | Any fresh local/staging DB, today |
| Removing caching everywhere as the fix for Pitfall 3 | Latency regression on genuinely public endpoints (event lists, club pages) that anonymous visitors hit most | Classify first, then opt in per route | Immediately, on the anonymous browse path — the app's highest-traffic flow |
| In-memory rate limiter across serverless instances **[CONCERNS.md]** | Effective limit is `instances × configured`; `/api/admin/*` exempt entirely | Distributed store, and include admin routes with a generous limit | Any multi-instance deploy — i.e. now |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Personalized API responses under a shared CDN cache | One student's saved events / recommendations / notifications served to another; intermittent, so it reads as a glitch | Default `/api/*` to `private, no-store`; opt in per classified-public route (Pitfall 3) |
| Auth checks that fall **open** when an env var is missing — `/api/admin/calculate-popularity` with `ADMIN_API_KEY` unset, on a service client **[CONCERNS.md]** | Unauthenticated access to a service-role endpoint if the var is ever dropped from an environment | Fail closed (503). Add a startup assertion listing required vars per route; certify the missing-var case in Stage 4 |
| `getSession()` where the answer gates access | Spoofable session cookie passes the check | `getUser()`; grep-based CI guard against `getSession()` outside diagnostics |
| Service client in a route that should use the cookie client (24 files, including a page) | RLS provides no defense; a single missing handler check is full exposure | Per-route deny-test → policy → swap (Pitfall 10) |
| RLS tests run as service role | Green suite, zero assurance; the certification gate is met on false evidence | pgTAP with `set local role`; CI guard against the service key in `supabase/tests/` |
| Ban/suspension enforced in middleware only | Middleware skips `auth/callback` and, for onboarding, all of `/api/` **[repo-verified]** — a banned user's direct API calls may not be re-checked | Re-check ban status inside every state-changing handler; certify the banned persona against API endpoints directly, not only through the UI |
| No CSRF protection on state-changing routes **[CONCERNS.md]** | Cookie-authenticated POST/PATCH/DELETE triggerable cross-site | Origin/Referer validation or double-submit token; note `X-Frame-Options: DENY` and `frame-ancestors 'none'` are already set, which limits but does not eliminate the vector |
| CSP with `script-src 'unsafe-inline' 'unsafe-eval'` **[repo-verified in next.config.js]** | Neutralizes CSP as an XSS control on a platform rendering user-supplied event descriptions | Likely forced by `swagger-ui-react`/`redoc` — dropping them (Pitfall 5) may allow tightening the CSP; treat as one linked decision |
| `sanitize-html` moderate advisory (incomplete URI scheme filtering) | Genuinely reachable — it processes user-supplied content | Highest-priority reachable upgrade after `next`; add adversarial `javascript:`/`data:` URI cases to the Stage 4 malformed-input dataset |
| Non-null assertions on Supabase env vars **[CONCERNS.md]** | A client built with `undefined` URL; cryptic runtime errors instead of a clear startup failure | Validated config module that throws at startup |
| Synthetic admin addresses in a shared `ADMIN_EMAILS` | Auto-promotion to real admin on first sign-in | Per-environment value; synthetic addresses only in allowlisted environments (Pitfall 14) |

---

## User-Visible Regression Pitfalls

The stated core value is behavior preservation, so "UX pitfalls" here means the regressions most likely to be introduced *by this program*.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Removing the blanket cache header wholesale | Anonymous event browsing — the highest-traffic path — gets noticeably slower right as the program claims a security win | Classify, then opt in per route; measure the anonymous browse path before and after |
| Tightening RLS without the deny-test-first order | Legitimate organizers lose access to their own club's events; looks like data loss | Deny test → policy → swap, per route (Pitfall 10) |
| Fixing the onboarding guard without tracing the loop | Redirect loop that locks users out of the entire app; middleware currently `return`s pass-through on any error, so a guard bug may fail *open* instead and be invisible | Certify the onboarding persona end-to-end including the "cookie set but profile already complete" case |
| Correcting the timezone convention in place | Every existing event shifts 4–5 hours; students arrive at the wrong time | Contract decision + data migration + a verified display layer, as one planned change (Pitfall 15) |
| Consolidating tag mapping (two implementations today, silent `SOCIAL` fallback) | Events silently recategorized; filters stop matching what users saved | Snapshot the current tag of every production event before the slice; diff after |
| Removing `select('*')` fabricated club objects | Club name/logo disappears from event cards where the real join has no row | Verify the join's coverage against production data before removing the fallback |
| Deduplicating "dead routes and duplicate components" from a six-month-old map | A page that is actually reachable gets deleted | Confirm liveness from production analytics/logs, not from the map dated 2026-03-05 |

---

## "Looks Done But Isn't" Checklist

- [ ] **Test suite green:** verify the *pass count and the skip count* are both printed and that CI actually runs them — today `npx jest` passes 220 tests with 5 suites skipped, but there is no `test` script and CI runs lint + tsc + build only, so none of it gates a merge **[repo-verified]**
- [ ] **Test runner consolidated:** verify the Vitest orphans (`vitest.config.ts`, `vitest.setup.ts`) are deleted and `TESTING.md` corrected, and that the 4 `@testing-library/react not installed` suites now run rather than skip
- [ ] **Vulnerabilities resolved:** verify the count was measured the same way as the baseline (`--omit=dev` or not, consistently), and that every remaining advisory ID has an exceptions-register entry
- [ ] **Clean install reproducible:** verify `rm -rf node_modules && npm ci` was run on the *pinned* Node version, and that CI's Node matches `engines`/`.nvmrc`
- [ ] **Next.js patched:** verify the critical Server Components DoS advisory is gone from `npm audit`, and that `react` was **not** bumped in the same commit
- [ ] **Middleware migrated:** verify `proxy.ts` runs on the Node runtime without the edge assumption, and that the rate limiter's behavior under the new runtime was measured
- [ ] **Types generated:** verify `grep -rc "supabase as any" src` is zero and `@ts-expect-error` did not rise; verify CI regenerates and diffs
- [ ] **Schema reconciled:** verify a scratch project built from the migrations folder alone diffs clean against production — including extensions, storage buckets and policies
- [ ] **pg_cron scheduled:** verify the schedule exists as a migration, and that a fresh reset produces a database where `compute_user_scores` actually runs on a schedule
- [ ] **Caching fixed:** verify with two different session cookies that `x-vercel-cache` never returns `HIT` on a personalized endpoint; verify public endpoints still cache
- [ ] **RLS tests passing:** verify each test asserts a **deny** case, and that no test file can reach the service key
- [ ] **Auth corrected:** verify no `getSession()` remains in an authorization path, and that admin endpoints fail closed with env vars unset
- [ ] **Personas tested:** verify the banned and un-onboarded personas were exercised against **API endpoints directly**, not only through the UI
- [ ] **Datasets safe:** verify the loader refuses to run without an allowlisted `--project-ref` **and** an environment sentinel; verify teardown was actually executed once
- [ ] **Scale dataset realistic:** verify distribution assertions exist and that at least one event/club is a deliberate hot spot
- [ ] **Sentry working:** verify a deliberately-thrown production error resolves to original source lines (Turbopack build), and that a synthetic email was scrubbed
- [ ] **Health check meaningful:** verify it returns unhealthy when the cron job is stale and when the webhook is unreachable — test by disabling each in staging
- [ ] **Cron jobs confirmed:** verify whether `send-reminders` and `send-feedback-requests` are actually triggered in production — there is no `crons` key in `vercel.json` **[repo-verified]**
- [ ] **Instagram scraper intact:** verify ingestion and content-hash dedup still work after every schema slice

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Personalized data served from the shared cache in production | **HIGH** | Purge the Vercel CDN cache immediately; ship `private, no-store` on `/api/*` as a hotfix; determine exposure window from `age`/`x-vercel-cache` in logs; assess disclosure obligations — this is student PII at a university |
| Wrong Supabase project received `db push` or a dataset load | **HIGH** | Point-in-time recovery if available; otherwise reconstruct from the migration diff and delete synthetic rows by sentinel marker — which only works if the sentinel/reserved-email scheme was in place beforehand (design it first) |
| Runner "consolidation" migrated working Jest tests to Vitest on the strength of the stale `TESTING.md` | **MEDIUM** | Revert the migration commit; re-decide from executed output (`npx jest` → 220 passing) and the `jest.*` (14) vs `vi.*` (0) call-site counts; the correct change is additive — jsdom env + testing-library + `test` script + CI step |
| React 19 bumped inside a batch and something regressed | **MEDIUM** | Revert the batch commit wholesale; re-run as a standalone item with its own smoke pass — this is only cheap if batches are one commit each with their own lockfile diff |
| RLS tightened and legitimate users locked out | **MEDIUM** | Revert the policy migration (keep policy changes in their own migrations so they revert independently); re-do with the deny-test-first order |
| Timezone convention changed and events shifted | **HIGH** | Requires a reverse data migration; only tractable if the forward migration was written as a reversible pair with a recorded row count |
| Characterization tests froze a defect and the security fix was reverted | **LOW** | Re-tag the test as DEFECT, rewrite it asserting intended behavior, re-land the fix — cheap only if the PRESERVE/DEFECT tag convention exists from the start |
| Stage gate declared met without evidence | **MEDIUM** | Re-run the gate mechanically; if a later stage already built on it, re-verify that stage's assumptions before continuing |

---

## Pitfall-to-Stage Mapping

| # | Pitfall | Prevention Stage | Verification |
|---|---------|------------------|--------------|
| 1 | Test suite cannot execute | 1 detect / **2 fix** (blocks 3) | CI output shows a non-zero passing test count |
| 2 | Runner re-decided from the stale map instead of the running suite | **1 decide** / 2 execute | Decision quotes `npx jest` output plus `jest.*` (14) vs `vi.*` (0) call-site counts; no test file is migrated between runners |
| 3 | Blanket `s-maxage` leaks personalized responses | 1 classify / **3 fix** / 4 certify | Two different sessions, same endpoint: never `x-vercel-cache: HIT`; public endpoints still HIT |
| 4 | Next.js bump conflates patch + proxy + React major | **2** (three separate gates) | Critical advisory cleared; `react` untouched in that commit; proxy migration has its own smoke pass |
| 5 | Vulnerability triage without removing `vercel` first | 1 baseline / **2 fix** | Advisory count re-measured after each of the four ordered steps |
| 6 | Unpinned toolchain / lockfile churn | **2** (first item) | `npm ci` on the pinned Node reproduces; CI Node matches `engines` |
| 7 | Migration drift; pg_cron in no migration | 1 diff (read-only) / **3 reconcile** | Scratch project built from migrations alone diffs clean against production |
| 8 | Generated types repaired with new casts | **3** (first slice after schema) | `grep -rc "supabase as any" src` → 0; CI regenerates and diffs |
| 9 | RLS tests that prove nothing | 3 policies / **4 tests** | Every table has a deny test; CI blocks the service key in `supabase/tests/` |
| 10 | Bulk client swap → widened policies | 1 inventory / **3 per-slice** | Each swap slice contains a deny test that failed before the policy landed |
| 11 | Characterization tests freeze defects | **1 classify** / 3 consume | Every characterization test carries a PRESERVE/DEFECT tag with a finding ID |
| 12 | No replayable baseline | **1 produce** / 3 replay | Baseline file exists before slice 1; every slice PR attaches a baseline diff |
| 13 | Read-only audit starts fixing | **1** | No non-`.planning/` file changed on the audit branch |
| 14 | Synthetic data reaching production | **4** (guardrails before first dataset) | Loader refuses without allowlisted ref + environment sentinel |
| 15 | Timezone certified against the bug | **3 decide** / 4 certify | Storage contract documented; DST cases written against the decided contract |
| 16 | Uniform scale dataset; ID-coupled E2E | **4** | Distribution assertions in the loader; no literal UUIDs in E2E files |
| 17 | Observability that leaks/vanishes/misleads | 1 inventory / **3 implement** | Source-mapped production error; scrubbed synthetic email; health check goes red for stale cron and dead webhook |
| 18 | Exit gates skipped; exceptions undocumented | schema in 1 / enforced in **2 and 4** | Script asserts every remaining advisory/finding ID has a register entry |

---

## Sources

**Repository evidence (verified directly, 2026-09-13)** — highest confidence:
- `npx jest` executed in the repo root → `Test Suites: 5 skipped, 16 passed, 16 of 21 total. Tests: 36 skipped, 220 passed, 256 total. Time: 2.247s`
- `package.json`, `package-lock.json`, `node_modules` installed-version checks (`vitest`, `@vitejs/plugin-react`, `@testing-library/*`, `jest-environment-jsdom` all absent; `next@16.2.1`, `react@18.3.1`, `jest@30.2.0`, `ts-jest@29.4.6` with peer range `jest: "^29.0.0 || ^30.0.0"`)
- `npm audit --omit=dev --json` → 38 prod vulnerabilities (2 critical / 22 high / 13 moderate / 1 low), 680 prod dependencies
- `jest.config.js`, `vitest.config.ts` and `vitest.setup.ts` (dead orphans), `.github/workflows/ci.yml`, `vercel.json`, `next.config.js`, `tsconfig.json`
- `src/middleware.ts` (matcher, ban check, onboarding guard, fail-open catch), `src/middlewareRateLimit.ts`
- `src/lib/timezone.ts`, `src/app/api/clubs/[id]/analytics/route.ts`, `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/` (44 files, duplicate `011_` and `20260305000002_` prefixes, two `remote_schema` dumps), `supabase/migrations/20260313000002_recommendation_engine.sql` lines 250–253 (pg_cron schedule commented out)
- `grep` inventories: `createServiceClient` (24 files), `getSession()` (1 remaining), 92 `route.ts` files, 21 `*.test.*` files of which 14 use `jest.*` mocks and 0 use `vi.*`; 5 `describe.skip` suites (4 self-documenting `@testing-library/react not installed`, 1 targeting a deleted cursor-pagination route)
- Absence checks: no `supabase/tests/`, no `supabase/seed.sql`, no `.nvmrc`, no `crons` key in `vercel.json`, no `test` script

**First-party vendor documentation (fetched 2026-09-13)** — treated as HIGH; note the `classify-confidence` seam returns `LOW` for the generic `webfetch` provider, so the elevation is on the basis of the source domain:
- https://nextjs.org/docs/app/guides/upgrading/version-16 — Node 20.9+, Turbopack default, async Request APIs removed, `middleware` → `proxy` (Node-only runtime), PPR → `cacheComponents`, `revalidateTag` signature, `next lint` removed, parallel-route `default.js`, `next/image` default changes
- https://nextjs.org/docs/app/guides/upgrading/version-15 — React 19 minimum for v15, async request APIs, `fetch`/Route Handler caching defaults
- https://nextjs.org/docs/messages/react-version — React 18.2+ supported but **deprecated** on Next 16; React 19 **required in Next 17**
- https://vercel.com/docs/caching/cdn-cache — cacheable-response criteria (no `Authorization` request header, no `set-cookie` response header, no `private`/`no-cache`/`no-store`), Cookie not in the cache key, `s-maxage` stripped from browser-visible headers without `CDN-Cache-Control`, `Vary` semantics, per-region cache segmentation
- https://supabase.com/docs/guides/database/postgres/row-level-security — `service_role` `bypassrls` and the no-user-token caveat, pgTAP testing with `set local role` / `set local request.jwt.claim.sub`, `TO` clause, `USING` vs `WITH CHECK`, anon-policy and missing-SELECT mistakes

**Project artifacts:**
- `.planning/PROJECT.md` (stage definitions, constraints, exit gates)
- `.planning/codebase/CONCERNS.md`, `INTEGRATIONS.md`, `TESTING.md` (dated 2026-03-05 — treated as claims to re-verify, and several were found stale)

---
*Pitfalls research for: foundation audit/stabilize/refactor/certify program on Next.js 16 + Supabase + Vercel*
*Researched: 2026-09-13*
