# Phase 3: Refactor Foundations — Schema Truth and the Seam Kit — Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 34 create/modify groups (from `03-RESEARCH.md`; **no CONTEXT.md exists** — there was no discuss-phase)
**Analogs found:** 27 / 34

> **Read this first.** Phase 3 is four different kinds of work wearing one phase number, and the
> analog source differs per kind:
>
> | Kind | Analog source |
> |---|---|
> | SQL (baseline, FK indexes, RLS gaps, pg_cron) | `supabase/migrations/20260316000004_fk_indexes_and_cleanup.sql`, `011_rls_audit.sql`, `20260313000002_recommendation_engine.sql:250-253` |
> | Zero-dependency tooling + production reads | `.planning/audit/tools/sql-readonly.mjs`, `validate.mjs`, `scripts/smoke.sh` |
> | The `src/server/` seam | `src/lib/admin.ts`, `src/lib/roles.ts`, `src/lib/dateValidation.ts`, `src/app/api/clubs/[id]/route.ts` |
> | Characterization tests | `src/proxy.test.ts`, `src/middlewareRateLimit.test.ts`, `src/__tests__/api/events/rsvp.test.ts` |
>
> Phase 2's `02-PATTERNS.md` remains valid for `ci.yml` step style, evidence-file placement,
> secret scrubbing, and the zero-dependency tooling rule. **Those four are cited, not re-derived.**
>
> **Two analogs are negative examples the research names by ID and the planner must treat as such:**
> `src/proxy.test.ts` (WR-04 — asserts only `config.matcher`; deleting the redirect block leaves it
> green) and `lives_ok` in pgTAP (Pitfall 7). Copy their *headers and conventions*, never their
> assertion strength.

---

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `.mcp.json` (add `?project_ref=…&read_only=true`) | 03-01 | config / transport | request-response | `.planning/audit/tools/sql-readonly.mjs:120-160` (the `read_only:true` contract) | role-match |
| `.planning/audit/tools/sql-readonly.mjs` (+2 named queries) | 03-01 | utility / CLI | transform | itself, `QUERIES` at lines 99-114 | exact (self) |
| `evidence/transport-identity.json` (new capture) | 03-01 | evidence capture | file-I/O | `.planning/audit/raw/prod/transport-identity.json` | exact |
| migration-filename parse check (script + CI step) | 03-01 | utility / CLI | transform | `.planning/audit/tools/validate.mjs` check registry | exact |
| `src/app/auth/callback/route.test.ts` (new) | 03-02 | test (node) | request-response | `src/__tests__/api/events/rsvp.test.ts` + `src/middlewareRateLimit.test.ts` header | exact |
| `src/server/context.ts` (new) | 03-03 | service / DAL | request-response | `src/lib/admin.ts` (whole file) + `src/lib/supabase/server.ts` | role-match |
| `src/server/http.ts` (new) | 03-03 | utility | request-response | `src/app/api/clubs/[id]/route.ts:24-37` | role-match |
| `src/server/errors.ts` (new) | 03-03 | utility | request-response | `src/app/api/events/create/route.ts:38-78` | role-match |
| `src/server/authz/requireUser.ts` (new) | 03-03 | middleware / guard | request-response | `src/lib/admin.ts:3-17` + `src/lib/dateValidation.ts:100-111` (result shape) | role-match |
| `src/server/authz/requireRole.ts` (new) | 03-03 | middleware / guard | request-response | `src/lib/roles.ts` (whole file) + `src/lib/admin.ts:15-16` | exact |
| `src/server/authz/requireClubRole.ts` (new) | 03-03 | middleware / guard | request-response | `src/app/api/clubs/[id]/route.ts:167-177` (DELETE) | exact |
| `src/server/db/elevated/index.ts` (new) | 03-03 | service / factory wrapper | CRUD | `src/lib/supabase/service.ts` (wrap, do not re-implement) | exact |
| `src/server/db/elevated/REGISTRY.md` (new) | 03-03 | doc / register | n/a | `.planning/audit/SEVERITY_SLA.md` exception register (via 02-PATTERNS.md) | role-match |
| `src/server/__tests__/*.test.ts` (new) | 03-03 | test (node) | request-response | `src/__tests__/api/events/rsvp.test.ts:8-54` | exact |
| `eslint.config.mjs` (boundary rule) | 03-03 | config | n/a | itself (6 lines today) | exact (self) |
| `eslint.elevated-allowlist.mjs` (new, generated) | 03-03 | config / generated ratchet | transform | `.planning/audit/baseline/versions.txt` (generated-count handling) | partial |
| `supabase/migrations/_archive_pre_baseline/**` (44 `git mv`) | 03-04 | migration | n/a | n/a — a move, not authored content | n/a |
| `supabase/migrations/_archive_pre_baseline/README.md` (new) | 03-04 | doc / decision note | n/a | `.planning/audit/baseline/test-runner-decision.md` | exact |
| `supabase/migrations/<ts>_baseline.sql` (new, generated) | 03-04 | migration | n/a | `supabase/migrations/20251128053245_remote_schema.sql` (a prior `db pull` dump) | exact |
| `supabase/migrations/<ts>_fk_indexes_and_policy_gaps.sql` (new) | 03-05 | migration | n/a | `20260316000004_fk_indexes_and_cleanup.sql` + `011_rls_audit.sql` | exact |
| `supabase/migrations/<ts>_cron_compute_user_scores.sql` (new) | 03-05 | migration | event-driven / batch | `20260313000002_recommendation_engine.sql:250-253` (commented-out line) | partial |
| `supabase/tests/database/000-setup.sql` (new) | 03-05 | test (db) | n/a | *(none — no pgTAP in tree)* | none |
| `supabase/tests/database/0[123]0-*.test.sql` (new) | 03-05 | test (db) | CRUD | *(none)* | none |
| `supabase/config.toml` (ports / `[auth.rate_limit]`) | 03-01/07 | config | n/a | itself, `[db] port=54322`, `[db.seed] sql_paths` line 63 | exact (self) |
| `src/lib/supabase/types.ts` (regenerated) | 03-06 | generated types | transform | itself — already generator output (`PostgrestVersion: "13.0.5"`) | exact (self) |
| the 47 `(supabase as any)` cast sites (5 files error) | 03-06 | mixed | mixed | `src/lib/audit.ts:31` and `src/app/api/clubs/[id]/route.ts` (uncast sibling) | exact |
| `.github/workflows/ci.yml` (types job, e2e job) | 03-06/07 | config / CI | batch | itself, lines 17-43 | exact (self) |
| `scripts/seed/{load,guard,prng,clock,personas}.ts` (new) | 03-07 | utility / CLI | batch | `scripts/platform-analytics.ts:1-22` | role-match |
| `scripts/seed/__tests__/guard.test.ts` (new) | 03-07 | test (node) | n/a | `src/lib/sanitize.test.ts` (minimal pure-module suite) | exact |
| `playwright.config.ts` (new) | 03-07 | config / test harness | n/a | `jest.config.js` (config-file conventions only) | partial |
| `e2e/auth.setup.ts` (new) | 03-07 | test setup | request-response | `src/app/auth/callback/route.ts:56-80` (the cookie accumulator) | role-match |
| `e2e/specs/*.spec.ts` ×6 | 03-07 | test (e2e) | request-response | `scripts/smoke.sh` rows 5/6/8/10 (the same assertions, one tier up) | role-match |
| `package.json` / `package-lock.json` (`@playwright/test@1.63.0`) | 03-07 | config / manifest | n/a | 02-PATTERNS.md § Lockfile reconciliation | exact |
| `.gitignore` (`playwright-report/`, `playwright/.auth/`) | 03-07 | config | n/a | itself, lines 8-10 (`test-results/`) | exact (self) |

---

## Pattern Assignments

### `.mcp.json` + `sql-readonly.mjs` (config / utility, AR-12) — plan 03-01

**Analog:** `.planning/audit/tools/sql-readonly.mjs`.

**Current `.mcp.json` (untracked) — the whole file, and the whole problem:**

```json
{ "mcpServers": { "supabase": { "type": "http", "url": "https://mcp.supabase.com/mcp" } } }
```

Target URL: `https://mcp.supabase.com/mcp?project_ref=<PROD-REF>&read_only=true`.

**The named-query pattern to extend** (`sql-readonly.mjs:99-114`) — new queries are added here, never
free-form, so the artifact is reproducible from the command alone:

```js
export const QUERIES = {
  'columns-census': {
    requirement: 'AUDIT-19 evidence, AUDIT-02 drift input',
    sql: `SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position`,
  },
};
```

Phase 3 adds two rows with `requirement: 'REFAC-01'` — the `supabase_migrations.schema_migrations`
census (Q1) and the final verification read.

**The server-side-enforced read-only contract to quote in every threat model** (lines 120-140):

```js
body: JSON.stringify({ query: sql, parameters, read_only: true }),
```

with the header rationale at lines 6-13: *"read-only only by the author's good intentions"* is the
exact argument that rules out `supabase migration fetch --linked` (Pitfall 10).

**Credential and scrub discipline — copy verbatim** (lines 60-90): `requireCredentials()` prints
variable **names** only and exits `2`; `scrub()` runs before anything reaches `.planning/`, which is
committed. Exit codes: `0 ok | 1 request failed | 2 credentials absent | 3 bad usage`.

---

### `src/app/auth/callback/route.test.ts` (test, node, new) — plan 03-02

**Analog A — the mock-seam machinery:** `src/__tests__/api/events/rsvp.test.ts:8-54`. The chainable
builder factory is the repo's established way to unit-test a route against no database:

```ts
function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "is", "maybeSingle", "single"];
  for (const method of methods) builder[method] = jest.fn().mockReturnValue(builder);
  builder.from = jest.fn().mockReturnValue(builder);
  builder.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  builder.single = jest.fn().mockResolvedValue(resolvedValue);
  return builder;
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));
```

**Mock the right modules.** `rsvp.test.ts` mocks `@/lib/supabase/server` — **the callback route does
not import it.** Read from `src/app/auth/callback/route.ts:13-18`:

```ts
import { createServerClient } from "@supabase/ssr";        // line 13  → jest.mock("@supabase/ssr")
import { createClient } from "@supabase/supabase-js";      // line 14  → jest.mock("@supabase/supabase-js")
import { createServiceClient } from "@/lib/supabase/service"; // line 18 → jest.mock("@/lib/supabase/service")
```

**The module-load trap** (`route.ts:22-25`) — `jest.resetModules()` + dynamic `await import("./route")`
is mandatory for the admin-assignment test:

```ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
```

**Analog B — the PRESERVE header:** `src/middlewareRateLimit.test.ts:1-30`. Copy the shape exactly —
purpose, `Tests cover:` list, a `WHY …:` block for the non-obvious seam, and the closing
non-modification sentence:

```ts
/**
 * Characterization tests for the middleware-level API rate limiter.
 *
 * PRESERVE suite. [...] These expectations are written against today's
 * unmodified `src/middlewareRateLimit.ts` [...] A diff in this file's results is
 * a behaviour change, not a test problem.
 *
 * Tests cover:
 *   - the standard POST budget and its 429 + Retry-After response
 *   ...
 * WHY EVERY TEST USES A DISTINCT IP:
 *   ...
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/middlewareRateLimit.ts`.
 */
```

**Constants carry their source line** (`middlewareRateLimit.test.ts:37-47`) — *"A planning document
can go stale; the source cannot."*

```ts
/** src/middlewareRateLimit.ts:28 — LIMITS.POST */
const POST_BUDGET = 30;
```

**The anti-pattern this suite must beat:** `src/proxy.test.ts` asserts `config.matcher` only. It is
the WR-04 negative example. Every REFAC-08 assertion must **call the exported `GET`** and assert on
the returned `NextResponse`, not on a shape read off the module.

---

### `src/server/` seam kit (service / guards, new) — plan 03-03

#### `src/server/context.ts`

**Analog:** `src/lib/admin.ts` — the whole 17-line file. It is already the correct `getUser()`
(never `getSession()`) shape and the correct profile read; `createRequestContext` is this generalized.

```ts
import { createClient } from "@/lib/supabase/server";

export async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  return { supabase, user, isAdmin: roles.includes("admin") };
}
```

Widen `.select("roles")` to `id, roles, banned_at, ban_expires_at, onboarding_completed`, keep
`await createClient()` from `@/lib/supabase/server` (never a fourth factory — CLAUDE.md), and keep
the bare-object return (no throw).

#### `src/server/authz/requireUser.ts` / `requireRole.ts`

**Result-shape analog:** `src/lib/dateValidation.ts:100-111` — the repo already returns a
discriminated "error object or null" rather than throwing:

```ts
export function validateEventDates(
  start_date: unknown,
  end_date?: unknown
): DateValidationError | null {
  if (!isValidISODate(start_date)) {
    return { field: "start_date", message: "start_date must be a valid ISO 8601 date (…)" };
  }
```

Research § Pattern 3 non-negotiable 2 fixes the seam's variant as
`{ ok: true, user } | { ok: false, response: NextResponse }`.

**Role-predicate analog:** `src/lib/roles.ts` — whole file. `requireRole` is the async guard wrapper
over these; do not re-implement the `roles.includes` logic:

```ts
export const hasRole = (user: User, role: UserRole): boolean => user.roles.includes(role);
export const isAdmin = (user: User): boolean => hasRole(user, "admin");
export const isOrganizer = (user: User): boolean => hasRole(user, "club_organizer");
```

#### `src/server/authz/requireClubRole.ts`

**Analog:** `src/app/api/clubs/[id]/route.ts:167-177` (DELETE). This is the file the audit's persona
rule R9 cites as *saying in as many words* that admin is not a club-role bypass. **Copy it including
the absence of an admin branch:**

```ts
  // Verify owner
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the club owner can delete the club" }, { status: 403 });
  }
```

Note the PATCH variant at lines 56-69 uses `.eq("role","owner").maybeSingle()` instead — **both live
shapes exist**; `requireClubRole` should use the `select("role") + maybeSingle()` form so it can
report the actual role, and must accept a required-role set rather than hard-coding `"owner"`.

#### `src/server/http.ts` / `errors.ts`

**Success shapes** — `src/app/api/clubs/[id]/route.ts:24-37`:

```ts
    if (clubResult.error || !clubResult.data) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    return NextResponse.json({ club: clubResult.data, followerCount: followerResult.count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch club" }, { status: 500 });
  }
```

**The `field` variant** — `src/app/api/events/create/route.ts:45,78`. This is the convention
`.claude/CLAUDE.md § Error Handling` names; `badRequest()` must support it:

```ts
      return NextResponse.json({ error: "Start date is required", field: "start_date" }, { status: 400 });
      ...
      return NextResponse.json({ error: dateError.message, field: dateError.field }, { status: 400 });
```

Status vocabulary in use, unchanged: 400 validation · 401 `"Unauthorized"` · 403 · 404 · 500
`"Failed to <action>"`.

#### `src/server/db/elevated/index.ts`

**Analog:** `src/lib/supabase/service.ts` — **wrap it, do not re-implement `createClient`.**

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Supabase client using the service role key.
 * Bypasses RLS — use only in trusted server-side contexts (admin routes, cron jobs).
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

The elevated module re-exports a narrowed accessor and carries the same "bypasses RLS" JSDoc, plus
the `REGISTRY.md` row requirement.

#### `eslint.config.mjs`

**Analog:** itself — the file is six lines, so the diff is unambiguous:

```js
import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".claude/**", ".next/**", "AI/**", "node_modules/**", "demo-video/**"] },
  ...coreWebVitals,
];

export default eslintConfig;
```

Research § Code Examples 8 is the verified target. Three things are load-bearing and must survive
into the plan: `patterns` **only** (adding `paths` double-reports every import); `files` scoped to
`src/app/**`; and **escaped brackets** in the allow-list (`src/app/users/\\[id\\]/page.tsx`) or 12
dynamic-route files leak through (Pitfall 4).

---

### `supabase/migrations/<ts>_fk_indexes_and_policy_gaps.sql` (migration, new) — plan 03-05

**Analog A — the index half:** `supabase/migrations/20260316000004_fk_indexes_and_cleanup.sql`, the
whole 39-line file. It is never-applied, so its **content is re-issued** under a new post-baseline
timestamp; the file itself stays in the archive.

```sql
-- Add missing indexes on foreign key columns for query performance
-- and clean up orphaned test table.

-- =============================================
-- FK indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_club_invitations_inviter_id
  ON public.club_invitations (inviter_id);
...
-- =============================================
-- Drop orphaned test table (has RLS enabled but zero policies)
-- =============================================

DROP TABLE IF EXISTS public.events_tests;
```

Nine `CREATE INDEX IF NOT EXISTS` + one `DROP TABLE IF EXISTS`. Banner-comment section dividers,
`public.` schema qualification, two-line statement wrapping.

**Analog B — the policy half:** `supabase/migrations/011_rls_audit.sql:1-60`. The idempotence
contract is stated in the header and executed as `DROP POLICY IF EXISTS` before every `CREATE POLICY`:

```sql
-- =============================================
-- Uni-Verse RLS Audit Migration — Issue #207
-- Full audit of all tables; fixes 7 security gaps.
-- Idempotent: all policies use DROP ... IF EXISTS before CREATE.
-- =============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- Authenticated users may only read their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

Also copy the `is_admin()` `SECURITY DEFINER` + `SET search_path = public` helper (lines 15-26) —
the recursion-avoidance rationale is written into the comment and stays true.

> The policy gaps this migration must re-add include the `20260226000001_invitee_select_update_policy.sql`
> invitee policies (F-016): they are **not live in production**, so the baseline will not contain
> them and club-invitation acceptance is broken there.

---

### `supabase/migrations/<ts>_cron_compute_user_scores.sql` (migration, new) — plan 03-05

**Analog:** `supabase/migrations/20260313000002_recommendation_engine.sql:49-53, 250-253` — the
repository's only trace of the three live pg_cron jobs, and it is a **comment**:

```sql
-- =============================================================
-- compute_user_scores()
-- Batch scoring function. Called by pg_cron every 6 hours.
-- =============================================================
CREATE OR REPLACE FUNCTION compute_user_scores()
...
-- Schedule pg_cron to run every 6 hours
-- NOTE: pg_cron must be enabled in Supabase dashboard (Database > Extensions)
-- Run this manually in SQL editor after enabling pg_cron:
-- SELECT cron.schedule('compute-user-scores', '0 */6 * * *', 'SELECT compute_user_scores()');
```

REFAC-03 uncomments this into a real, **idempotent** statement (unschedule-if-exists then schedule,
or `cron.schedule` guarded on `cron.job`), keeping the job name `compute-user-scores` and the
expression `0 */6 * * *` byte-identical — those two literals are the pgTAP assertion.

---

### `scripts/seed/*.ts` (utility / CLI, new) — plan 03-07

**Analog:** `scripts/platform-analytics.ts:1-22` — the repo's one existing `tsx` + `dotenv` +
service-client script, and the only precedent for a script that reads `.env.local`:

```ts
/**
 * Fetch platform-wide analytics from Supabase.
 * Usage: npx tsx scripts/platform-analytics.ts [--json]
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";

config({ path: resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
```

Copy: the `Usage:` JSDoc line, relative `../src/lib/supabase/types` import (scripts are outside the
`@/` alias), the env gate that names variables and `process.exit(1)`.

**Invert one thing.** This analog points at production by default. `scripts/seed/guard.ts` is the
opposite: it reads `.env.local`'s project ref **only as a deny key** and hard-refuses any URL that
is not local or the (nonexistent) staging project — L5 and the AR-12 tampering row.

**Refusal-message discipline:** `scripts/smoke.sh:19-36`, the METHOD CONTRACT block. When the new
tool's contract differs from its analog's, **restate it honestly rather than copying the sentence**
— smoke.sh does exactly this about cache-probe.sh's "GET only". The seed loader's header must say
in as many words that it writes, that it is destructive, and where it refuses to run.

**Guard tests:** `src/lib/sanitize.test.ts` shape — relative import, bare `describe`/`it`, no setup,
three negative cases each asserting a throw.

---

### `e2e/auth.setup.ts` (test setup, new) — plan 03-07

**Analog:** `src/app/auth/callback/route.ts:56-80` — the app's own cookie-accumulation trick, which
is what the persona shim reuses so no cookie format is ever guessed:

```ts
  // Accumulate ALL cookies across multiple setAll calls
  const allCookies = new Map<string, { name: string; value: string; options: Record<string, unknown> }>();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => {
            allCookies.set(name, { name, value, options: options as Record<string, unknown> });
          });
        },
      },
    }
  );
```

The file header (lines 1-11) also documents *why* accumulation is required — "Microsoft tokens are
large and Supabase chunks them into multiple cookies" — which is the same reason the setup project
cannot hand-write one cookie per persona.

---

### `e2e/specs/*.spec.ts` ×6 (test, e2e, new) — plan 03-07

**Analog:** `scripts/smoke.sh` — same assertions, one tier up, and the header states the succession
explicitly (lines 8-10): *"Phase 3 replaces it with the Playwright persona harness (REFAC-06)."*

Three conventions to carry over from its contract block (lines 19-36):

- **No redirect-following.** `NO -L anywhere. Rows 5 and 6 assert a redirect; following it would
  turn the assertion into a test of the landing page instead of the auth ring.` Specs 3 and 6
  assert the redirect *target*, not the rendered page.
- **Row 5 is the important one.** Its Playwright successor is spec 3 (`/my-events` anonymous →
  `/?signin=required&next=/my-events`), and spec 6 (banned → `/banned`) closes the `T-02-06-03`
  residual that smoke.sh could not reach without a seeded banned session.
- **Accumulate, don't abort** (`set -u`, no `set -e`) → Playwright's default is already
  per-spec isolation; do not add `--max-failures=1`.

`PROTECTED_ROUTES` must be re-derived from `src/proxy.ts:114` with the CLAUDE.md one-liner before any
redirect assertion is written — not copied from `src/proxy.test.ts:39-48`, which is a transcription.

---

### `src/lib/supabase/types.ts` + the 47 casts (generated types / mixed) — plan 03-06

**Analog:** the file itself. It is **already generator output** — this header is emitted only by
`supabase gen types`, which is why REFAC-04 is "nothing regenerates or verifies it", not "replace
hand-written types":

```ts
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
```

**The cast to fix, with its analog next door:** `src/lib/audit.ts:31` is the `Record<string, unknown>`
→ `Json` case, and fixing it retires part of Open Question Q3:

```ts
  const supabase = createServiceClient();
  await (supabase as any).from("admin_audit_log").insert({
    ...
    metadata: params.metadata ?? {},
  });
```

Its **uncast** counterpart is `src/app/api/clubs/[id]/route.ts:17-23`, which chains
`.from().select().eq().single()` with no cast at all and type-checks today — that is the target shape.

Verified live on this tree: `grep -rc "(supabase as any)" src/ | awk -F: '{s+=$2} END {print s}'` →
**47**. The other 14 of the 61 `as any` occurrences are mock-factory and local casts and are **not in
scope**.

---

### `.github/workflows/ci.yml` (config, modified) — plans 03-01/06/07

**Analog:** itself. Step style is `- name: <Sentence case>` + `run:`; workflow-level `env` carries
the placeholder Supabase credentials that make the fast job need no secret:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-key"

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: TypeScript type-check
        run: npx tsc --noEmit
      - name: Run tests
        run: npm test
      - name: Production vulnerability gate
        run: npm audit --audit-level=high --omit=dev
      - name: Run build
        run: npm run build
```

**Two new jobs, not new steps.** The research is explicit: *"Do not add Docker steps to the existing
fast `ci` job."* `types:` and `e2e:` are siblings of `ci:` under `jobs:`, reusing the same
`actions/setup-node@v4` + `node-version-file: '.nvmrc'` + `npm ci` preamble. `node-version-file` is
the only correct form — a literal `node-version:` would break the three-way Node 24 pin (L8).

---

### `.gitignore` (config, modified) — plan 03-07

**Analog:** itself, lines 8-10. Sectioned by lowercase comment; Phase 2 added `test-results/` here:

```
# testing
/coverage
test-results/
```

Phase 3 appends `playwright-report/` and `playwright/.auth/` to this same block. `playwright/.auth/`
is **not optional** — it holds live session cookies.

---

## Shared Patterns

### AR-12 threat-model rows (applies to EVERY plan, 03-01 … 03-07)

**Source:** 03-RESEARCH.md § Production Transport; the obligation is carried from
`01-SECURITY.md` AR-12 and was **not met** in Phase 2.

Three rows, verbatim, in every plan's `<threat_model>`: the MCP privileged transport, the laptop
service-role write path, and the "how a tree reaches Vercel" repudiation row. Plans that issue no
production read still carry them — that is what "unmet in Phase 2 because no read fired" means.

### Migration authoring conventions

**Source:** `011_rls_audit.sql`, `20260316000004_fk_indexes_and_cleanup.sql`.
**Apply to:** every new `.sql` under `supabase/migrations/`.

- `-- =====` banner comment at the top naming the migration and its issue/requirement
- Idempotence stated in the header **and** enforced: `IF NOT EXISTS` / `DROP … IF EXISTS` / `CREATE OR REPLACE`
- `public.` schema qualification everywhere
- `-- =====` section dividers with a one-line title
- A prose comment above each policy explaining the gap it closes
- Helper functions: `LANGUAGE sql|plpgsql`, `SECURITY DEFINER`, `SET search_path = public`

### Zero-dependency tooling rule

**Source:** `validate.mjs:7-11` — *"This file is never added to package.json."* Restated in
02-PATTERNS.md § Zero-dependency tooling rule.
**Apply to:** the migration-filename parse check and the allow-list regenerator. Both are
`node:`-only `.mjs` under `.planning/` or `scripts/`, invoked by path. `@playwright/test` is the
phase's **only** `package.json` addition.

### Evidence capture, secret scrubbing, lockfile reconciliation

**Source:** 02-PATTERNS.md §§ Evidence-file placement, Secret scrubbing, Lockfile reconciliation.
**Apply to:** every plan. Unchanged and still correct — raw stdout to `.txt` verbatim, derived
counts as `key=value` with the producing command above each key, decision notes with the
`**Plan:** · **Phase:** · **Recorded:**` metadata line, `shasum -a 256` (not `sha256sum`), and
`npm install --package-lock-only` + a reviewed `git diff package-lock.json` before `npm ci`.

### Test conventions

**Source:** `src/middlewareRateLimit.test.ts`, `src/__tests__/api/events/rsvp.test.ts`, `src/lib/sanitize.test.ts`.

- Co-located `*.test.ts` beside the subject (`src/server/__tests__/` and `src/app/auth/callback/route.test.ts`),
  or `src/__tests__/api/**` for route tests — both layouts are live
- `describe`/`it` (never `test`); double-quoted strings in `src/`
- File-level JSDoc naming PRESERVE vs DEFECT and the `F-nnn` it is tagged against (L2)
- `// ─── Section ───` dividers; SCREAMING_SNAKE module constants, each carrying `/** <file>:<line> */`
- `jest.fn()` only — **no `vi.*` anywhere** (L7)
- Quick run: `npx jest --ci --selectProjects node --testPathPatterns "<regex>"` — **plural**, Jest 30 (Pitfall 11)
- `e2e/` lives outside `src/`, so Jest's `testMatch` never sees it. **Do not edit `jest.config.js`.**

### The assertion-strength rule (this phase's defining constraint)

**Source:** `02-REVIEW.md` WR-04 (`src/proxy.test.ts`) and 03-RESEARCH.md Pitfall 7 (`lives_ok`).

Both tiers have the same failure mode: *a suite whose assertions cannot fail when the behavior is
removed.* The countermeasures are mechanical and belong in the plan as tasks, not as advice —

| Tier | Countermeasure |
|---|---|
| pgTAP | Never `lives_ok` for an allowed write; use `RETURNING` + `results_eq`. Mutation-check each test: comment the policy out, observe red, restore. A human observes the red. |
| ESLint boundary | Add a violating fixture, capture the failing `npm run lint`, remove it, capture the passing one. |
| Jest characterization | Call the exported handler and assert the response; never assert a shape read off the module. |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/tests/database/000-setup.sql` | test (db) | n/a | **No pgTAP anywhere in this tree** and `pgtap` is `installed: false` in production. Use 03-RESEARCH.md § Code Examples 4 verbatim (`create extension pgtap with schema extensions`, plus `tests.act_as` / `tests.act_as_anon` built from two `set local` statements). The rejected alternative — `basejump-supabase_test_helpers` via `dbdev` — is a network dependency inside `supabase test db`; do not reach for it. |
| `supabase/tests/database/0[123]0-*.test.sql` | test (db) | CRUD | Same. Assertion vocabulary (`has_index`, `throws_ok`, `is_empty`, `results_eq`) comes from § Pattern 4's denial-type table, not from any file in this repo. |
| `playwright.config.ts` | config / test harness | n/a | No e2e config precedent. `jest.config.js` contributes conventions only (single-quoted config files, `<rootDir>` paths). Spec is 03-RESEARCH.md § Code Examples 9; `testDir: "e2e"`, a `setup` project with `testMatch: /.*\.setup\.ts/`, and `dependencies: ['setup']`. |
| `e2e/fixtures.ts` | test harness | n/a | No Playwright fixture precedent. |
| `eslint.elevated-allowlist.mjs` | config / generated ratchet | transform | No generated-config precedent. `.planning/audit/baseline/versions.txt` contributes only the handling rule (generated, carries its producing command in a comment, never hand-edited). Generator: the `grep … | sed 's\|\[\|\\\\[\|g; …' | sort` one-liner in § Code Examples 8. |
| `supabase/migrations/<ts>_baseline.sql` | migration | n/a | *Partial.* `20251128053245_remote_schema.sql` and `20260223193741_remote_schema.sql` are prior `db pull` dumps and show the emitted shape — but the new baseline is **generated, never authored**, and the only review is the four-point eye check (must contain `rsvps` / must not contain `user_engagement_summary`, `events_tests`, `users.is_admin`). |
| `scripts/seed/prng.ts`, `clock.ts` | utility | transform | No PRNG or pinned-clock precedent. mulberry32 seeded `0x554e4956` and `PINNED_NOW = 2026-06-01T12:00:00.000Z` come from § Code Examples 11. `seedrandom` and `@faker-js/faker` are explicitly rejected. |

---

## Planner Notes

1. **`src/lib/admin.ts` is the seam's single most important analog.** Seventeen lines that already
   do `getUser()` (not `getSession()`), already read the profile, already return a bare object
   instead of throwing. `createRequestContext` is this file widened. Cite it by path in 03-03's
   actions rather than describing the pattern.
2. **Three files under `supabase/migrations/` are source material, not history.**
   `20260316000004_fk_indexes_and_cleanup.sql` (all 39 lines → REFAC-02),
   `20260313000002_recommendation_engine.sql:250-253` (→ REFAC-03), and
   `20260226000001_invitee_select_update_policy.sql` (F-016 policies the baseline will not contain).
   All three get archived; their **content** is re-issued post-baseline. The plan must say "re-issue
   the content", never "move the file back".
3. **03-04 must be two commits.** The 44 `git mv`s are one commit that `git diff -M --summary` reads
   as 44 pure renames with zero content changes — that diff *is* the REFAC-01 no-rename evidence.
   The baseline is a second commit. Same reasoning as Phase 2's B3 proxy rename.
4. **Ordering that is not cosmetic:** the ESLint allow-list must be generated with escaped brackets
   *before* the rule is switched to `error`, or `check-baseline.mjs`'s `zero-eslint-errors` check
   fails the phase gate at 46 errors (Pitfall 5). Measured floor to hold: **0 errors, 19 warnings.**
5. **03-02 and 03-03 depend on nothing.** They are the tributaries; start them in Wave 1 alongside
   preflight. REFAC-08 in particular is a write-the-test-before-anything-touches-it obligation, and
   `git diff -- src/app/auth/callback/route.ts` must be empty at its completion.
6. **Non-regression floor for every plan gate** (03-RESEARCH.md § Validation Architecture,
   re-measured 2026-09-15): Jest 278 passed / 5 skipped / 22 of 23 suites · `tsc --noEmit` exit 0 ·
   `eslint .` 0 errors 19 warnings · `check-baseline.mjs` 22 passed 0 failed · files under
   `src/app/**` importing the service client **stays 23** (that number moving means a route was
   refactored, which L3 forbids).

## Metadata

**Analog search scope:** `src/lib/`, `src/lib/supabase/`, `src/app/api/clubs/[id]/`,
`src/app/api/events/`, `src/app/auth/callback/`, `src/__tests__/api/`, `src/proxy.test.ts`,
`src/middlewareRateLimit.test.ts`, `supabase/migrations/`, `supabase/config.toml`,
`.planning/audit/tools/`, `scripts/`, `.github/workflows/`, `eslint.config.mjs`, `.gitignore`,
`.mcp.json`, `package.json`
**Files scanned:** 22 read in full or in targeted ranges; 44 migrations enumerated; 2 counts re-derived live (`(supabase as any)` → 47)
**Pattern extraction date:** 2026-09-15
