# Phase 2: Dependency and Runtime Stabilization - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 31 created/modified/deleted (from `02-RESEARCH.md`; no CONTEXT.md exists for this phase)
**Analogs found:** 26 / 31

> **Read this first.** Phase 2 is a toolchain/manifest phase, not a feature phase. Most "new files"
> are config, evidence documents, or zero-dependency Node/bash tools. The strongest analogs in this
> repo are **Phase 1's audit tooling** (`.planning/audit/tools/`) and **Phase 1's evidence docs**
> (`.planning/audit/SEVERITY_SLA.md`, `baseline/test-runner-decision.md`, `baseline/versions.txt`),
> not `src/`. Only four files touch `src/`: the `middleware.ts` → `proxy.ts` rename, two new test
> files, and the five previously-skipped suites.

---

## File Classification

| New/Modified File | Batch | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `package.json` (engines, `test` script, dep add/remove/move) | 0,1,2,4,5 | config / manifest | n/a (declarative) | `package.json` itself (current shape) | exact (self) |
| `.nvmrc` (new) | 0 | config | n/a | *(none — no single-value config file exists in repo)* | none |
| `.github/workflows/ci.yml` (node-version-file, `npm test`, `npm audit` step) | 0,6 | config / CI | batch | `.github/workflows/ci.yml` itself | exact (self) |
| `jest.config.js` (→ `projects: [node, jsdom]`) | 5 | config / test harness | n/a | `jest.config.js` itself | exact (self) |
| `jest.setup.ts` (new) | 5 | config / test harness | n/a | `vitest.setup.ts` (being deleted — shape only) | partial |
| `tsconfig.json` (drop `"vitest.config.ts"` from `exclude`) | 0 | config | n/a | `tsconfig.json` itself lines 32-39 | exact (self) |
| `.gitignore` (`+ test-results/`) | 0 | config | n/a | `.gitignore` itself | exact (self) |
| `next.config.js` (source comment on `images.unoptimized`) | 2 | config | n/a | `next.config.js` itself | exact (self) |
| `renovate.json` (new) | 6 | config / automation | event-driven | *(none — no bot config in repo)* | none |
| `sbom.cyclonedx.json` (new, generated) | 6 | generated artifact | batch | `.planning/audit/quality/npm-audit.prod.json` (committed generated JSON) | partial |
| DELETE `vitest.config.ts`, `vitest.setup.ts` | 0 | config | n/a | n/a | n/a |
| DELETE `test-results/.last-run.json` | 0 | artifact | n/a | n/a | n/a |
| DELETE `src/components/ui/dropdown-menu.tsx` | 1 | component | n/a | n/a (pair-removal with the Radix dep) | n/a |
| `src/middleware.ts` → **`src/proxy.ts`** (codemod rename) | 3 | middleware | request-response | `src/middleware.ts` itself (the rename is the change) | exact (self) |
| `src/middlewareRateLimit.test.ts` (new) | 0 | test (node env) | request-response | `src/lib/sanitize.test.ts` + `src/__tests__/api/events/date-validation.test.ts` | exact |
| `src/middleware.test.ts` → `src/proxy.test.ts` (new, renamed in B3) | 0,3 | test (node env) | request-response | `src/lib/sanitize.test.ts` | role-match |
| `src/components/ErrorBoundary.test.tsx` (un-skip) | 5 | test (jsdom) | request-response | its own stub block, lines 1-7 | exact (self) |
| `src/components/events/EventFilters.test.tsx` (un-skip) | 5 | test (jsdom) | request-response | `src/components/events/FilterSidebar.test.tsx` lines 1-15 | exact |
| `src/components/events/FilterSidebar.test.tsx` (un-skip + fixture fix) | 5 | test (jsdom) | request-response | its own stub block, lines 1-15 | exact (self) |
| `src/hooks/useEvents.test.ts` (un-skip + fixture fix) | 5 | test (jsdom) | CRUD / fetch | its own stub block, lines 1-8 | exact (self) |
| `src/app/api/events/route.test.ts` (**decide, do not fix**) | 5 | test (node) | CRUD | `src/__tests__/api/events/get-events.test.ts` | role-match |
| `.planning/.../evidence/tools/check-baseline.mjs` (new comparator) | 0 | utility / CLI tool | transform | **`.planning/audit/tools/validate.mjs`** | exact |
| `scripts/smoke.sh` (new, Tier 2 HTTP smoke) | 0 | utility / shell probe | request-response | **`.planning/audit/tools/cache-probe.sh`** + `readonly-guard.sh` | exact |
| `evidence/VULNERABILITY-POLICY.md` (new) | 0 | doc / policy | n/a | **`.planning/audit/SEVERITY_SLA.md`** | exact |
| `evidence/STAGE-2-COMPLETION.md` (new) | 6 | doc / evidence | n/a | `SEVERITY_SLA.md` prose + `baseline/versions.txt` numbers | role-match |
| `evidence/devdir-investigation.md` (new) | 0 | doc / decision note | n/a | **`.planning/audit/baseline/test-runner-decision.md`** | exact |
| `evidence/vercel-removal-decision.md` (new) | 1 | doc / decision note | n/a | `baseline/test-runner-decision.md` | exact |
| `evidence/proxy-migration-note.md` (new) | 3 | doc / decision note | n/a | `baseline/test-runner-decision.md` | exact |
| `evidence/bundle-size.{before,after}.json` + `bundle-size.md` | 6 | evidence capture | batch | `.planning/audit/baseline/versions.txt` (key=value) | exact |
| `evidence/{cleanroom-npm-ci,batch-NN-*}.txt`, `audit.b*.json` | 1-6 | evidence capture | file-I/O | `.planning/audit/baseline/{build,jest,lint,tsc}.txt` | exact |
| `.planning/audit/findings.json` (`closes_in_phase` → `02` for F-051/52/53/56/57) + regenerate `FOUNDATION_AUDIT.md` | 6 | data / generated doc | transform | `.planning/audit/tools/gen-foundation-audit.mjs` (`--check` mode) | exact |
| `CLAUDE.md`, `.claude/CLAUDE.md`, `README.md` (stale-claim corrections) | rides along | doc | n/a | the files themselves | exact (self) |

---

## Pattern Assignments

### `.planning/.../evidence/tools/check-baseline.mjs` (utility, CLI, new)

**Analog:** `.planning/audit/tools/validate.mjs` — this is the precedent RESEARCH.md § Wave 0 Gaps
names by path ("zero-dependency, `--check <name>`, exit non-zero on failure"). Copy four things:

**1. Header block stating the zero-dependency contract and the CLI surface** (`validate.mjs` lines 1-31):

```js
#!/usr/bin/env node
/**
 * .planning/audit/tools/validate.mjs
 *
 * Phase 1 artifact + schema + cross-reference validator.
 *
 * Zero dependencies by design. [...] Only node:fs and node:path are imported.
 * Nothing from src/ is imported. This file is never added to package.json.
 *
 * CLI contract
 *   node validate.mjs                 run all checks; exit 0 only if none FAILed
 *   node validate.mjs --check <name>  run exactly one check; absent inputs are a FAIL
 *   node validate.mjs --quick         run only checks whose inputs exist; rest are SKIP
 *   node validate.mjs --list          print the check registry
 *
 * Output is one line per rule:
 *   PASS|FAIL|SKIP <check-name> :: <rule> :: <detail>
 */

import fs from 'node:fs';
import path from 'node:path';
```

**2. The emit/assert context and the one-line-per-rule reporter** (lines 79-97):

```js
const results = [];

function emit(status, check, rule, detail) {
  results.push({ status, check, rule });
  console.log(`${status} ${check} :: ${rule} :: ${scrub(detail)}`);
}

function makeCtx(check, versions) {
  return {
    versions,
    assert(condition, rule, detail) {
      emit(condition ? 'PASS' : 'FAIL', check, rule, detail);
      return Boolean(condition);
    },
    note(rule, detail) {
      emit('SKIP', check, rule, detail);
    },
  };
}
```

**3. The check registry shape — `{ requirement, inputs, run(ctx) }`** (lines 336-348). The new
comparator's requirement tags are `STAB-13` / `STAB-01` / `STAB-05` etc., exactly as Phase 1 tagged
`AUDIT-01`:

```js
const CHECKS = {
  /* ---------------------------------------------------------------- AUDIT-01 */
  'schema-snapshots': {
    requirement: 'AUDIT-01',
    inputs: ['schema/prod.schema.sql', 'schema/staging.schema.sql', 'schema/local.schema.sql'],
    run(ctx) {
      for (const rel of CHECKS['schema-snapshots'].inputs) {
        const bytes = sizeOf(rel);
        ctx.assert(bytes > MIN_SNAPSHOT_BYTES, 'dump-is-non-trivial', `${rel} is ${bytes} bytes`);
        ctx.assert(readText(rel).includes('CREATE TABLE'), 'dump-contains-create-table', rel);
      }
    },
  },
```

**4. `main()` + the summary line + the terminal-error wrapper** (lines 957-999):

```js
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); return 0; }
  if (args.includes('--list')) { /* ... */ return 0; }
  const checkIndex = args.indexOf('--check');
  if (checkIndex !== -1) {
    const name = args[checkIndex + 1];
    if (!name || !CHECKS[name]) {
      console.error(`FAIL cli :: unknown-check :: ${name === undefined ? '(none given)' : name}`);
      usage();
      return 1;
    }
    runCheck(name, versions, false);
  } else { /* all checks */ }

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  console.log(`--- ${passed} passed, ${failed} failed, ${skipped} skipped`);
  return failed === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`FAIL validator :: terminal-error :: ${scrub(err && err.stack ? err.stack : err)}`);
  process.exit(1);
}
```

**5. Expected counts come from a file, never a literal** (lines 99-120). Phase 1 refused to hard-code
route/page counts; the Phase 2 comparator must read the AUDIT-13 baseline (220 passed / 36 skipped /
16 of 21 suites) the same way rather than inlining `220`:

```js
function loadVersions() {           // baseline/versions.txt is key=value, '#' comments
  const map = new Map();
  if (!exists(VERSIONS_FILE)) return map;
  for (const line of readText(VERSIONS_FILE).split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function expectedCount(versions, key) {
  const raw = versions.get(key);
  if (raw === undefined) throw new Error(`${VERSIONS_FILE} is missing key ${key}`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) throw new Error(`${VERSIONS_FILE} key ${key} is not an integer`);
  return parsed;
}
```

**Do NOT copy** the `scrub()` secret-redaction block wholesale as dead weight — but **do keep it** if
the comparator ever prints a caught error, because `.planning/` is committed (same reasoning as
`validate.mjs` lines 58-77).

---

### `scripts/smoke.sh` (utility, shell, request-response, new)

**Analog A — the banner/contract/IO header:** `.planning/audit/tools/cache-probe.sh` lines 1-46.
Copy the boxed header naming WHAT THIS DOES, the read-only/method contract, INPUTS (environment
only), and OUTPUTS by path:

```bash
#!/usr/bin/env bash
# =============================================================================
# cache-probe.sh — AUDIT-08 shared-cache exposure probe
# Phase 01-read-only-foundation-audit, plan 01-12
#
# WHAT THIS DOES
#   Issues header-only GET requests against the PRODUCTION deployment and
#   records, per route / session / iteration, whether the shared CDN served a
#   cached response.
#
# READ-ONLY CONTRACT
#   * GET only. No -X POST/PUT/PATCH/DELETE anywhere in this file.
#   * Response bodies are discarded (-o /dev/null); only headers are captured.
#   * `set-cookie` values are replaced with <REDACTED> INSIDE the same pipeline
#     that writes the file [...]
#   * Command tracing (`set -x`) is never enabled: this script receives live
#     session tokens through the environment.
#
# INPUTS (environment only — never CLI arguments, never files)
#   PROD_HOST   required. Production origin including the scheme.
#               No default: a fallback could silently target the wrong system.
# ...
# OUTPUTS
#   .planning/audit/cache/curl/<slug>.<session>.<n>.headers.txt
# =============================================================================

set -uo pipefail

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ITERATIONS="${ITERATIONS:-3}"
SPACING="${SPACING:-2}"

# --- input gate -------------------------------------------------------------
if [ -z "${PROD_HOST:-}" ]; then
```

> Note the deviation `smoke.sh` must make: cache-probe is GET-only, but Tier 2 row 8 needs
> `POST /api/events` x31 to prove the 429. Restate the contract honestly in the header rather than
> copying "GET only" into a script that posts.

**Analog B — the shell-option rationale and the accumulate-don't-abort exit contract:**
`.planning/audit/tools/readonly-guard.sh` lines 1-53:

```bash
#!/usr/bin/env bash
# Contract: exit 0 = clean, exit 1 = violation. No functions, exit-code contract only.
#
# Deliberate shell-option choices:
#   set -u  : catch unset variables.
#   NO set -e : an early abort would suppress the diagnostic output that makes
#               a violation actionable. Failures are accumulated in $fail instead.
#   NO set -x : this script runs in the same phase as credentialed tasks; tracing
#               would echo any password present in the environment.

set -u
fail=0

if ! <check>; then
  echo "READ-ONLY VIOLATION — files changed outside .planning/:"
  fail=1
fi

exit $fail
```

Smoke row 5 (`GET /profile` → 307) is the check that must print its actual value on failure, not
just fail — copy the `echo` + `diff` diagnostic style above.

---

### `src/middlewareRateLimit.test.ts` and `src/proxy.test.ts` (test, node env, new)

**Analog A — minimal pure-module suite:** `src/lib/sanitize.test.ts` lines 1-10. Relative import of
the subject, bare `describe`/`it`, no setup file, no mocks:

```ts
import { sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  it("strips <script> tags from input", () => {
    const input = `<script>alert('xss')</script>`;
    const result = sanitizeText(input);
    expect(result).not.toContain("<script>");
    expect(result).toBe("");
  });
});
```

**Analog B — file-level JSDoc header for a non-obvious suite:**
`src/__tests__/api/events/date-validation.test.ts` lines 1-19 (header + `// ─── Section ───`
dividers + SCREAMING_SNAKE module constants). The rate-limit suite needs the same header to record
*why* each test uses a distinct IP:

```ts
/**
 * Integration tests for date validation in event API endpoints.
 *
 * Tests cover:
 *   - POST /api/events/create  — create event with various date inputs
 *
 * Supabase and auth are mocked so no live DB is required.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const FUTURE_DATE = "2099-12-31";
```

**Subject contract to write against** — `src/middlewareRateLimit.ts`:
`export function applyApiRateLimit(req: NextRequest): NextResponse | null` (line 78), store key
`"__uni_verse_mw_rate_limit__"` on `globalThis` (line 11), `WINDOW_MS = 60_000` (line 24),
`ADMIN_PREFIX = "/api/admin"` (line 32), `HIGH_FREQUENCY_POST_PREFIXES` (line 36). Buckets are keyed
by IP **and** path — use a distinct IP or path per test.

**Matcher contract to write against** — `src/middleware.ts` lines 149-158 exports
`config.matcher` as a single-entry array; the test imports `{ config }` and passes it to
`unstable_doesMiddlewareMatch` (NOT `unstable_doesProxyMatch` — RESEARCH.md Pitfall 4).

**Import-path convention:** both styles are live in this repo — relative (`./sanitize`) and alias
(`@/components/events/FilterSidebar`). For `src/`-sibling test files use relative, matching
`sanitize.test.ts` and `classifier.test.ts`.

---

### `src/proxy.ts` (middleware, request-response, renamed from `src/middleware.ts`)

**Analog:** the file itself. The codemod changes exactly two things; everything else must be
byte-identical so `git diff -M` reads as a pure rename (that diff *is* the STAB-06 evidence).

**Export contract that changes** (`src/middleware.ts` line 5):

```ts
export async function middleware(request: NextRequest) {   // ->  export async function proxy(
```

**Everything that must NOT change** — imports (lines 1-3), the rate-limit-first ordering, the
fail-open env guard, the cookie `getAll`/`setAll` block, the catch, and the matcher:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyApiRateLimit } from "./middlewareRateLimit";   // relative path survives the rename

export async function middleware(request: NextRequest) {
  // Apply public API rate limits before any auth work
  const rateLimitResponse = applyApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars are missing, pass through without auth
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }
  try {
    /* ... session refresh, PROTECTED_ROUTES, ban check, onboarding guard ... */
  } catch (e) {
    // If middleware fails, pass through rather than 500ing the entire site
    console.error("[Middleware] Error:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

> The `[Middleware]` log prefix is the project's logging convention (see CLAUDE.md § Logging).
> Changing it to `[Proxy]` is a behaviour-visible diff in the one commit that must read as a rename —
> **leave it**, or change it in a separate commit. Same call as Open Question 4's "do not rename
> `middlewareRateLimit.ts`."

---

### The five previously-skipped suites (test, jsdom)

**Analog:** the stub blocks in the files themselves. There are **three distinct stub shapes**; the
un-skip edit differs per file. Do not write one blanket sed.

Shape 1 — `src/components/ErrorBoundary.test.tsx` lines 1-7 (carries a stray `"use client"` that
must also go):

```tsx
"use client";

import { useState } from "react";
// @testing-library/react is not installed — all tests in this file are skipped

const { render, screen, fireEvent, waitFor } = {} as any;
import { ErrorBoundary } from "./ErrorBoundary";
```

Shape 2 — `src/components/events/FilterSidebar.test.tsx` lines 1-15 (also shows the child-component
mock pattern to preserve, and the `"academic"` literal on line 52 that must become an `EventTag`):

```tsx
import React from "react";
// @testing-library/react and @testing-library/jest-dom are not installed — tests skipped

const { render, screen, fireEvent } = {} as any;
import { FilterSidebar } from "@/components/events/FilterSidebar";

jest.mock("@/components/events/EventFilters", () => ({
  EventFilters: ({ onFilterChange, initialTags }: any) => (
    <div data-testid="mock-event-filters">
      <button onClick={() => onFilterChange?.({ tags: ["academic"] })}>Trigger Filter</button>
```

Shape 3 — `src/hooks/useEvents.test.ts` lines 1-24 (a `.ts` file needing jsdom; carries a `TODO`
line, a `renderHook` stub, the global fetch mock to keep, and the `"Academic"` /
`event_date`/`event_time` fixture drift to repair):

```ts
// TODO: Rework — all tests are skipped because @testing-library/react is not installed.
// Install @testing-library/react and @testing-library/react-hooks, then remove the skip + fake imports.

// @testing-library/react is not installed — all tests in this file are skipped
const { act, renderHook, waitFor } = {} as any;
import { useEvents } from "./useEvents";
import type { Event } from "@/types";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const createMockEvent = (id: string, date: string = "2026-02-25"): Event => ({
  /* ... */ tags: ["Academic"],          // -> EventTag.ACADEMIC
  event_date: date, event_time: "18:00", // <- F-050: these columns do not exist
```

**Replacement per RESEARCH.md § Code Examples 6:**

```diff
- // @testing-library/react is not installed — all tests in this file are skipped
- const { render, screen, fireEvent, waitFor } = {} as any;
+ import { render, screen, fireEvent, waitFor } from "@testing-library/react";

- describe.skip("EventFilters Component (@testing-library/react not installed)", () => {
+ describe("EventFilters Component", () => {
```

**`src/app/api/events/route.test.ts` is the exception** — no install revives it (cursor-contract
drift). Per Open Question 2, leave it skipped and record the decision. Its sibling
`src/__tests__/api/events/get-events.test.ts` is the live analog if anyone rewrites it later.

---

### `jest.config.js` (config, modified)

**Analog:** itself. The `common` object in RESEARCH.md § Code Examples 6 must be lifted verbatim
from the current file so the two projects inherit today's exact resolution:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/supabase/functions/tests/'],
};
```

Note the file uses **single quotes** despite `.prettierrc` specifying double quotes for `src/` —
config files in this repo are single-quoted (`jest.config.js`, `eslint.config.mjs`,
`.planning/audit/tools/*.mjs`). Match the file you are editing, not the global rule.

---

### `.github/workflows/ci.yml` (config, modified)

**Analog:** itself. Step naming is `- name: <Sentence case>` + `run:`; env placeholders live at
workflow level and are reused by the clean-room protocol:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-key"

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20          # -> node-version-file: '.nvmrc'   (batch 0)
          cache: npm

      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: TypeScript type-check
        run: npx tsc --noEmit
      # + "Run tests" (batch 0), + "Production vulnerability gate" (batch 6, LAST)
      - name: Run build
        run: npm run build
```

---

### `evidence/VULNERABILITY-POLICY.md` (doc, new)

**Analog:** `.planning/audit/SEVERITY_SLA.md`. This is not a loose analog — STAB-03 requires the new
policy to be *consistent with* it, and RESEARCH.md § Vulnerability Policy Skeleton inherits five of
its eight clauses verbatim. Copy the header block, the "written before the first finding" framing,
the four-level table, and the exception register table.

**Header pattern** (lines 1-6):

```markdown
# Severity SLA — Phase 1 Foundation Audit

**Requirement:** AUDIT-21
**Written:** 2026-09-14, in Wave 1, **before the first finding was filed** — so severity is graded against a pre-committed policy rather than argued after the fact.
**Enforced by:** `node .planning/audit/tools/validate.mjs --check sla` and `--check findings`
**Applies to:** every record in `.planning/audit/findings.json` and its generated view `.planning/audit/FOUNDATION_AUDIT.md`
```

**Exception-register pattern to reuse clause-for-clause** (lines 40-54):

```markdown
A finding moves from `Open` to `Risk-accepted` **only** with a complete `risk_acceptance` object:

| Attribute | Rule |
|---|---|
| `owner` | A named human who accepts the risk. Not a team, not a role. |
| `date` | ISO date the acceptance was signed. |
| `expiry` | ISO date, **at most 90 days after `date`**. There is no indefinite acceptance. |
| `rationale` | A **reachability argument** [...] "Low priority", "no time", and "unlikely" are not rationales. |

**An expired acceptance reverts to `Open` automatically.**

A Critical may not be risk-accepted. A Critical is either fixed or the program stops.
```

**Also copy the CVSS clause** (line 13): "CVSS vectors are not assigned to application-logic
findings [...] the advisory's own severity is recorded verbatim as evidence, and the finding's
severity is still set by the reachability judgment." STAB-03's "No CVSS on app-logic findings"
clause is this sentence.

**Footer convention** (SEVERITY_SLA.md last lines):

```markdown
*Phase: 01-read-only-foundation-audit*
*Plan: 01-01*
```

---

### `evidence/{devdir-investigation,vercel-removal-decision,proxy-migration-note}.md` (doc, new)

**Analog:** `.planning/audit/baseline/test-runner-decision.md`. Four patterns to copy:

**1. Metadata line + a blockquoted decision stated up front** (lines 1-11):

```markdown
# Test Runner Decision — AUDIT-13

**Plan:** 01-04 · **Phase:** 01-read-only-foundation-audit · **Recorded:** 2026-09-14
**Status:** Recorded, not decided. The runner choice was locked before this phase began [...]

> **Decision: keep Jest.** The Vitest configuration files are orphans and are slated for
> deletion in Stage 2 (STAB-08).
```

**2. The provenance paragraph** (lines 12-15) — every number is produced by the command printed next
to it; nothing transcribed from a planning document. `devdir-investigation.md` needs exactly this,
because STAB-02 closes on probe output alone.

**3. A headline number stated three ways, then the commands that produced it** (lines 17-38):

```markdown
## 1. The 14-to-0 mock-call evidence

**14 to 0: the `jest.*` mock API is called in 14 of the 21 test files, the Vitest `vi.*` API in 0.**

```bash
# Jest mock API — 14 files
command grep -rlE '\bjest\.(mock|fn|spyOn|...)' --include='*.test.ts' src/ | wc -l   # -> 14
```
```

For `vercel-removal-decision.md` the three negative checks from RESEARCH.md Pitfall 10 go here
verbatim, **including the `@vercel/analytics` / `@vercel/speed-insights` near-miss warning**.

**4. Inline `# -> value` comments on every command**, so the note is re-runnable.

---

### `evidence/*.txt` and `evidence/bundle-size.*.json` (evidence captures)

**Analog A — raw tool output captured verbatim, no post-processing:**
`.planning/audit/baseline/build.txt` (starts with the npm banner) and `baseline/jest.txt` (starts
with `PASS <path>`). Batch gate captures follow this: redirect, do not summarize.

```
> uni-verse@0.1.0 build
> next build

▲ Next.js 16.2.1 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

> That `⚠` line is the STAB-06 before/after marker — `grep -c 'middleware.*deprecated'` must be 0
> in `evidence/build.b3.txt`.

**Analog B — derived metrics as `key=value` with the producing command in a comment:**
`.planning/audit/baseline/versions.txt` lines 1-22. Use this exact format for
`evidence/bundle-size.md`'s numeric side and for any Stage 2 count the completion note quotes:

```
# .planning/audit/baseline/versions.txt — AUDIT-13
#
# The ONLY source of expected counts for .planning/audit/tools/validate.mjs.
# Every count below was re-derived by running the command in this working tree.
#
# Format: key=value, one per line. Comments start with '#'.

# find src/app -name route.ts | wc -l
route_ts_count=94
# grep -n 'PROTECTED_ROUTES' src/middleware.ts — array literal length, read from source
protected_routes_source_count=8

# --- toolchain on the machine that produced this audit ---
node_version=24.16.0
```

---

### `.planning/audit/findings.json` + `FOUNDATION_AUDIT.md` (data + generated doc, modified)

**Analog:** `.planning/audit/tools/gen-foundation-audit.mjs`. The Markdown is **generated** — hand
editing it fails the staleness check. The pattern is: edit `findings.json`, re-run the generator,
then assert:

```
 *   node .planning/audit/tools/gen-foundation-audit.mjs --check   # exit 1 if stale
```

```js
if (process.argv.includes('--check')) {
  console.error('gen-foundation-audit: FOUNDATION_AUDIT.md is stale — re-run without --check');
```

Follow with `node .planning/audit/tools/validate.mjs --check findings`.

---

## Shared Patterns

### Per-batch gate (applies to every batch commit, B0-B6)

**Source:** RESEARCH.md § Upgrade Batching Order; commands already exist in
`.github/workflows/ci.yml` and `.planning/config.json` (`test_command: npx jest --ci`).

```bash
npm run lint && npx tsc --noEmit && npm test -- --ci && npm run build
# then: Tier 2 smoke, then the lockfile diff review
git --no-pager diff --stat package-lock.json
```

### Lockfile reconciliation (applies to B1, B2, B4, B5 — every manifest edit)

**Source:** RESEARCH.md § Pattern 1 + Pitfall 2. Never `npm install <pkg>` blind, never `npm audit
fix`, never `rm package-lock.json`.

```bash
npm audit --omit=dev --json --package-lock-only > evidence/audit.b1.before.json
shasum -a 256 package-lock.json                 > evidence/lock.b1.before.sha256
npm pkg delete dependencies.vercel
npm install --package-lock-only     # reconcile, do not regenerate
git --no-pager diff --stat package-lock.json    # human review = the STAB-11 gate
npm ci                              # never a bare `npm install`
```

> `shasum -a 256` (not `sha256sum`) is the repo's convention — `readonly-guard.sh` line 30 uses
> `shasum -a 256`, and `sha256sum` does not exist on the macOS toolchain that produced
> `baseline/lock.sha256`. RESEARCH.md's snippets say `sha256sum`; follow the repo, not the snippet.

### Evidence-file placement and naming

**Source:** `.planning/audit/{baseline,quality}/` layout.
**Apply to:** every capture in B0-B6.

- Raw tool stdout → `.txt`, verbatim, named `<tool>.txt` or `batch-NN-<tool>.txt`
- Machine-readable tool output → `.json`, committed unmodified (`npm-audit.prod.json` precedent)
- Derived counts → `key=value` with the producing command above each key
- Narrative/decision → `.md` with the `**Plan:** · **Phase:** · **Recorded:**` metadata line and a
  `*Phase: … *Plan: …` footer

### Zero-dependency tooling rule

**Source:** `validate.mjs` lines 7-11 — "This file is never added to package.json."
**Apply to:** the baseline comparator and `smoke.sh`. Phase 2 is measuring the dependency tree; a
tool that enlarges it corrupts its own measurement. Same reasoning RESEARCH.md gives for running
`@cyclonedx/cyclonedx-npm` and `update-browserslist-db` via one-shot `npx` instead of installing.

### Secret scrubbing before anything reaches `.planning/`

**Source:** `validate.mjs` lines 58-77 and `cache-probe.sh` lines 16-23.
**Apply to:** the smoke script and any evidence capture that touches a live deployment.

```js
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '<REDACTED-JWT>'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '<REDACTED-SECRET-KEY>'],
  [/postgres(ql)?:\/\/[^\s]*:[^@\s]*@/gi, 'postgres://<REDACTED>@'],
  [/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1<REDACTED-TOKEN>'],
  [/(sb-[a-z0-9]+-auth-token=)[^;\s]+/gi, '$1<REDACTED-COOKIE>'],
];
```

Redact **inside the pipeline that writes the file**, so an unredacted token never reaches disk
(cache-probe.sh's stated rule). `.planning/` is committed.

### Test file conventions (applies to all new/un-skipped suites)

**Source:** `src/lib/sanitize.test.ts`, `src/__tests__/api/events/date-validation.test.ts`.

- Co-located `*.test.ts` / `*.test.tsx` next to the subject (or under `src/__tests__/api/**` for
  route tests — both layouts are live)
- `describe` / `it` (never `test`), double-quoted strings in `src/`
- File-level JSDoc header for anything non-obvious; `// ─── Section ───` dividers
- Module-level fixtures as SCREAMING_SNAKE constants
- `jest.fn()` mocks — 14 of 21 files; no `vi.*` anywhere

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.nvmrc` | config | n/a | No single-value dotfile of this kind exists in the tree. Content is literally `24`. RESEARCH.md § Code Examples 4 is the spec. |
| `renovate.json` | config / automation | event-driven | No bot configuration exists anywhere in the repo (`.github/` holds only `workflows/ci.yml`). Use RESEARCH.md § Code Examples 9 verbatim and validate with `npx --yes renovate-config-validator renovate.json`. |
| `sbom.cyclonedx.json` | generated artifact | batch | No SBOM precedent. Nearest habit is `.planning/audit/quality/npm-audit.prod.json` (a committed, generated, never-hand-edited JSON) — copy that *handling* rule, not its shape. Generator flags are in RESEARCH.md § Code Examples 8; `--output-reproducible` is mandatory for a committed file. |
| `jest.setup.ts` | config / test harness | n/a | The only precedent is `vitest.setup.ts`, which is being deleted in the same phase. The file is one line: `import "@testing-library/jest-dom";`. |
| `package.json` `engines` block | config | n/a | The field does not exist today in any form. RESEARCH.md § Code Examples 4 is the spec. |

---

## Planner Notes

1. **`.planning/audit/tools/` is the single richest analog source for this phase.** Three of the
   phase's new executables (`check-baseline.mjs`, `smoke.sh`, and any capture helper) have
   line-for-line precedents there. Reference them by path in plan actions.
2. **Batch boundaries are commit boundaries.** Each of B0-B6 is exactly one commit with the gate
   above; that maps cleanly onto one plan per batch (or B0 split, since it carries both config edits
   and two new test files).
3. **B3 (proxy) must be a standalone plan.** Coexistence of `middleware.*` and `proxy.*` is a hard
   build throw, the codemod does the rename atomically, and the `git diff -M` is the evidence
   artifact. Do not bundle any other edit into it — including the `[Middleware]` log prefix.
4. **Ordering constraint that is not cosmetic:** `VULNERABILITY-POLICY.md` must be committed *before*
   the batch-1 commit (STAB-03 is explicit, and the check is `git log --diff-filter=A`), and the CI
   `npm audit` step must be the *last* thing added (it exits 1 today).

## Metadata

**Analog search scope:** `.planning/audit/tools/`, `.planning/audit/baseline/`, `.planning/audit/quality/`, `src/**/*.test.ts{,x}`, `src/middleware.ts`, `src/middlewareRateLimit.ts`, `jest.config.js`, `package.json`, `tsconfig.json`, `.github/workflows/`, `.gitignore`
**Files scanned:** 24 read in full or in targeted ranges; 21 test files enumerated
**Pattern extraction date:** 2026-09-14
