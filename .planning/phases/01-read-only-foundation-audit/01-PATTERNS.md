# Phase 1: Read-Only Foundation Audit - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 12 distinct file *classes* (≈55 concrete artifacts)
**Analogs found:** 5 classes with a real in-repo analog / 12

> **Scope reminder:** every file this phase creates lives under `.planning/audit/` or
> `.planning/phases/01-read-only-foundation-audit/`. Nothing in `src/`, `scripts/`,
> `supabase/`, `.github/`, `package.json`, or `package-lock.json` is created or modified.
> The `src/` files cited below are **grep targets and read-only references**, never edit targets.

---

## File Classification

| New file (class) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.planning/audit/tools/gen-endpoint-inventory.mjs` | generator / CLI script | file-I/O → transform → JSON | `scripts/platform-analytics.ts` | role-match (language differs: TS+tsx vs zero-dep ESM) |
| `.planning/audit/tools/gen-page-inventory.mjs` | generator / CLI script | file-I/O → transform → JSON | `scripts/platform-analytics.ts` | role-match |
| `.planning/audit/tools/sql-readonly.mjs` | data-access utility | request-response (HTTPS) | `scripts/fix-instagram-images.ts` (env guard + `fetch` + retry) | partial |
| `.planning/audit/tools/sql-readonly-pg.mjs` (fallback) | data-access utility | request-response (TCP) | `scripts/platform-analytics.ts` (client construction + env guard) | partial |
| `.planning/audit/tools/pivot-rls-heatmap.mjs` | transform utility | batch transform (JSON → CSV) | `scripts/platform-analytics.ts` (aggregate-object build) | role-match |
| `.planning/audit/tools/validate.mjs` | validator / test-equivalent | batch, exit-code contract | `src/lib/dateValidation.test.ts` + `load-tests/k6-*.js` thresholds | partial |
| `.planning/audit/tools/readonly-guard.sh` | guard script (shell) | batch, exit-code contract | **none** — no `.sh` file exists in this repo | no analog |
| `.planning/audit/tools/cache-probe.sh` (AUDIT-08) | HTTP probe harness | request-response, multi-session | `load-tests/k6-online-users.js` | partial |
| `.planning/audit/quality/knip.config.json`, `depcruise.config.cjs` | config | static | `jest.config.js` / `eslint.config.mjs` (repo-root configs) | partial (location deliberately differs) |
| `.planning/audit/**/*.schema.json` | schema/contract | static | **none** — no JSON Schema in repo | no analog |
| `.planning/audit/inventory/*.json`, `findings.json`, `rls/*.json` | data artifact | static output | `.planning/*.json` (e.g. `.planning/config.json`) | partial |
| `.planning/audit/**/*.md` (FOUNDATION_AUDIT, threat models, SLA, README, REDACTION, BLOCKING-INPUTS) | document | static output | `.planning/phases/01-read-only-foundation-audit/01-RESEARCH.md` | exact (same authoring conventions) |

---

## Pattern Assignments

### `.planning/audit/tools/gen-endpoint-inventory.mjs` and `gen-page-inventory.mjs` (generator, file-I/O → JSON)

**Analog:** `/Users/adyan/Documents/GitHub/Event-Radar/scripts/platform-analytics.ts`

**Header docblock + usage line** (lines 1–4) — every standalone script in this repo opens with this shape; copy it, changing the runner to plain `node`:

```ts
/**
 * Fetch platform-wide analytics from Supabase.
 * Usage: npx tsx scripts/platform-analytics.ts [--json]
 */
```

**Precondition guard + hard exit** (lines 13–20) — the established fail-fast convention. Reuse verbatim in shape for the generators' "is this being run from the repo root?" check, and verbatim in substance for `sql-readonly.mjs`'s credential check:

```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
```

**Structured-output + `--json` flag + terminal error handler** (lines 204–216) — copy the argv-flag pattern and the `main().catch` tail exactly:

```ts
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(JSON.stringify(stats));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Deviations the planner must encode (analog is close but not copyable wholesale):**

| Aspect | Analog does | New tools must do | Why |
|---|---|---|---|
| Language / runner | TypeScript, `npx tsx` | **`.mjs`, plain `node`** | `tsx` is an unused devDependency knip flags for removal; the generators must not depend on it |
| Module system | CJS-ish (`__dirname`, `import { config } from "dotenv"`) | **ESM** — `__dirname` does NOT exist; use `import.meta.dirname` or repo-root-relative literals | `.mjs` is always ESM |
| Dependencies | `dotenv`, `@supabase/supabase-js` | **zero** — `node:fs`, `node:child_process`, global `fetch` only | no install is permitted this phase |
| Output destination | stdout | **`writeFileSync` into `.planning/audit/…`**, progress to `console.error` | stdout must stay clean when piped |
| Write semantics | n/a | **merge into the existing JSON by `id`**, never replace | RESEARCH.md Pattern 1 — a re-run must not discard human classification |

The concrete generator bodies are already prototyped and verified in `01-RESEARCH.md` § Code Examples 3 and 4 (94 rows / 43 rows). Use those as the implementation; use `platform-analytics.ts` only for the surrounding conventions above.

---

### `.planning/audit/tools/sql-readonly.mjs` (data-access utility, request-response)

**Analog:** `/Users/adyan/Documents/GitHub/Event-Radar/scripts/fix-instagram-images.ts`

**Env-guard header** (lines 16–25) — same shape as above, plus the module-level tunables convention:

```ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const CONCURRENCY = 5;
```

**`fetch` + AbortController timeout + bounded retry** (lines 30–45) — copy this structure for the Management API call:

```ts
for (let attempt = 0; attempt <= retries; attempt++) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt === retries) throw err;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
```

**Mandatory deviations:**
- Credentials are `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` (PAT), **not** the service-role key. RESEARCH.md explicitly rejects a `createServiceClient()` transport — it is the credential under audit.
- Body must carry `"read_only": true` (server-enforced).
- **Never** `console.error` a caught error whose message could embed a token or connection string; log `res.status` and a scrubbed body only. The analog's bare `console.error(e)` tail is unsafe here — wrap it.

---

### `.planning/audit/tools/validate.mjs` (validator, exit-code contract)

**Analog (threshold semantics):** `/Users/adyan/Documents/GitHub/Event-Radar/load-tests/k6-online-users.js` lines 22–26 — the repo's existing "declare pass/fail thresholds as data, then assert" pattern:

```js
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
```

**Analog (assertion granularity):** the Jest suite — 21 test files, `jest.*` only, zero `vi.*` (AUDIT-13's pre-resolved evidence). Mirror Jest's one-assertion-per-rule reporting style so a failure names the exact rule.

**Rules to encode (from RESEARCH.md Patterns 1 and 3):** no `"unknown"` remaining in `endpoints.json`; missing key = schema error, not implicit unknown; `^F-\d{3}$` unique ids; every Critical/High has `affected_paths` with line numbers; `evidence` resolves to an existing path; expired `risk_acceptance` reverts to Open.

**Counts must be read from `baseline/versions.txt`, never hardcoded** (RESEARCH.md Pitfall 8 — upstream docs say 92/45, reality is **94 routes / 43 pages / 44 migrations**).

---

### `.planning/audit/tools/readonly-guard.sh` (guard script) — NO ANALOG

There is **no `.sh` file anywhere in this repository** (verified: `find . -name "*.sh"` excluding `node_modules`/`.next` → empty). The closest thing to a "how are commands invoked here" reference is the CI workflow.

**Reference:** `/Users/adyan/Documents/GitHub/Event-Radar/.github/workflows/ci.yml` — the authoritative list of baseline commands AUDIT-13 must capture, and the Node-version hazard:

```yaml
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: TypeScript type-check
        run: npx tsc --noEmit
      - name: Run build
        run: npm run build
```

Notes for the planner:
- CI has **no test step** — `npx jest` is never run in CI. That is an AUDIT-13 finding in itself.
- CI pins **Node 20**, which per RESEARCH.md would fail `dependency-cruiser@18.3.0` (needs `^22|^24|>=26`). Local is 24.16.0. Record the version split in `baseline/versions.txt`.
- CI injects only placeholder `NEXT_PUBLIC_*` env, which is exactly RESEARCH.md Pitfall 7's INCONCLUSIVE case for AUDIT-16.

Implementation source: `01-RESEARCH.md` § Code Examples 9 (complete, verified script). Use `set -u` (not `set -e`, which would abort before the diagnostic prints) and **never `set -x`** in any script that receives a password (Pitfall 4).

---

### `.planning/audit/tools/cache-probe.sh` (HTTP probe harness, multi-session)

**Analog:** `/Users/adyan/Documents/GitHub/Event-Radar/load-tests/k6-online-users.js`

**Env-var config with defaults** (lines 4–7) — copy this convention so the operator supplies the host without editing the file:

```js
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = Number(__ENV.TARGET_VUS || 500);
```

**Route-list-as-data + named checks** (lines 36–55) — the harness already batches exactly the endpoints AUDIT-08 cares about, and is the repo's precedent for `/api/events` as a stable anonymous probe target (the positive control RESEARCH.md Pitfall 3 requires):

```js
  const responses = http.batch([
    ["GET", `${BASE_URL}/api/events?page=${page}&limit=20&tags=${encodeURIComponent(tag)}`],
    ["GET", `${BASE_URL}/api/events/featured`],
    ["GET", `${BASE_URL}/api/clubs/featured`],
    ["GET", `${BASE_URL}/api/health`],
  ]);
```

**Mandatory deviations:** GET only, `curl -sSI` (headers only), route list derived from `endpoints.json` via `jq`, `set-cookie` values replaced with `<REDACTED>` before the file is written, cookies live in shell variables only and never under `.planning/`. Full verified harness in `01-RESEARCH.md` § Code Examples 6.

---

### `.planning/audit/**/*.md` (documents)

**Analog:** `/Users/adyan/Documents/GitHub/Event-Radar/.planning/phases/01-read-only-foundation-audit/01-RESEARCH.md`

Conventions to carry over: front-matter `**Key:** value` block; dense tables over prose; `[VERIFIED: <command> <date>]` / `[CITED: <source>]` annotations on every factual claim; fenced blocks carrying the exact reproducing command. `FOUNDATION_AUDIT.md`, `rls-review.md`, `dependency-report.md`, and the three threat models are all **generated or derived views** — `FOUNDATION_AUDIT.md` specifically must be generated *from* `findings.json` so the two cannot drift (RESEARCH.md Pattern 3).

---

## Shared Patterns

### Read-only guard (applies to EVERY task in every plan)
**Source:** `01-RESEARCH.md` § Code Examples 9; baseline behavior verified against this working tree.
```bash
git status --porcelain -- . ':(exclude).planning' | diff .planning/audit/baseline/git-status.before.txt -
git diff --exit-code --quiet -- . ':(exclude).planning' || echo "READ-ONLY VIOLATION"
shasum -a 256 -c .planning/audit/baseline/lock.sha256 --status || echo "LOCKFILE MUTATED"
```
Never assert `git status --porcelain` is *empty* — `docs/product-master-plan.md` is already untracked.

### Fail-fast env guard (applies to every `.mjs` tool that touches a credential)
**Source:** `scripts/platform-analytics.ts:13-20`, `scripts/fix-instagram-images.ts:16-22`
Check names, `console.error` the **names** only, `process.exit(1)`. Never echo a value.

### Terminal error handler (applies to every `.mjs` tool)
**Source:** `scripts/platform-analytics.ts:212-216` — `main().catch(e => { console.error(e); process.exit(1); })`, hardened to scrub credentials before printing.

### Grep targets — the authorization surfaces the inventory generators must detect
These are **read-only references**; the signals in `endpoints.json` / `pages.json` are booleans derived from them.

**Cookie-client + `getUser` + role check (the correct pattern)** — `src/lib/admin.ts:3-17`:
```ts
export async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase.from("users").select("roles").eq("id", user.id).single();
  const roles: string[] = profile?.roles ?? [];
  return { supabase, user, isAdmin: roles.includes("admin") };
}
```

**Second auth ring the middleware list misses (AUDIT-04 / RESEARCH.md Pattern 2)** — `src/app/admin/layout.tsx` (and the parallel `src/app/moderation/layout.tsx`) inline the same `getUser()` + `roles.includes("admin")` + `redirect("/")` guard. `pages.json` needs a `layout_guard` column resolving the nearest guarded ancestor.

**Middleware protected list — read from source, not CLAUDE.md** — `src/middleware.ts:114` has **8** entries (CLAUDE.md documents 6; the drift is itself a finding):
```ts
const PROTECTED_ROUTES = ["/my-events", "/create-event", "/notifications", "/profile", "/settings", "/my-clubs", "/invites", "/friends"];
```

**Fail-open shape (AUDIT-10)** — `src/app/api/admin/calculate-popularity/route.ts`, both POST (~lines 57–66) and GET (~lines 166–175), on a service-role client:
```ts
const expectedKey = process.env.ADMIN_API_KEY;
if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```
Generalized detector regex for the fail-open register: `if\s*\(\s*[A-Za-z_]\w*\s*&&\s*[^)]*!==`.

### Redaction (applies to every credentialed task in Wave 2)
**Source:** `01-RESEARCH.md` Pitfall 4. Every credentialed task ends with a redaction step appending to `REDACTION.md`. Sweep patterns: `eyJ[A-Za-z0-9_-]{10,}\.`, `sb_secret_`, `postgres(ql)?://[^ ]*:[^@]*@`, plus both project refs.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.planning/audit/tools/readonly-guard.sh` | guard script | batch | Zero `.sh` files in the repo. Use RESEARCH.md § Code Examples 9 verbatim. |
| `.planning/audit/tools/cache-probe.sh` | probe harness | request-response | No curl/shell harness exists; k6 files are JS and load-oriented, not header-oriented. |
| `.planning/audit/**/*.schema.json` | schema | static | No JSON Schema anywhere in the repo. Author against draft 2020-12; `validate.mjs` must be a hand-rolled zero-dependency checker (no `ajv` install permitted). |
| `.planning/audit/inventory/*.csv`, `rls/rls-heatmap.csv`, `cache/cache-matrix.csv` | derived view | transform | No CSV emitters in `src/`. `src/lib/exportUtils.ts` (with `exportUtils.test.ts`) is the nearest CSV-writing code but is app-layer and must not be imported by a `.planning/` tool — reimplement the trivial quote/escape inline. |
| `.planning/audit/quality/knip.config.json`, `depcruise.config.cjs` | config | static | Repo config precedent (`jest.config.js`, `eslint.config.mjs`) exists but lives at the **repo root** — copying that location would violate the read-only constraint. Pass `-c <path>` instead (RESEARCH.md anti-pattern list). |

---

## Incidental Findings Surfaced During Pattern Mapping

Feed these to the planner as pre-seeded AUDIT-15 / AUDIT-13 candidates (verified 2026-09-14):

1. **`package.json` declares `"check:feedback": "node scripts/check-feedback-loop.mjs"`, but `scripts/check-feedback-loop.mjs` does not exist.** `scripts/` contains only `fix-instagram-images.ts`, `platform-analytics.ts`, `upload-images.ts`. A broken npm script is a Low-severity dead-config finding — and it invalidates the orchestrator brief's suggestion to use that file as an analog.
2. **CI runs lint + tsc + build but never runs the tests.** 21 Jest test files exist and are never executed by CI.
3. **CI Node 20 vs local Node 24.16.0** — `dependency-cruiser@18.3.0` would not run under CI's Node.

---

## Metadata

**Analog search scope:** `scripts/`, `load-tests/`, `.github/workflows/`, repo-root configs, `src/lib/`, `src/app/`, `src/middleware.ts`, `.planning/`
**Files read in full or in targeted ranges:** 10
**Pattern extraction date:** 2026-09-14
