# Phase 6: Slices 6–7 — Async Edge, Contracts, Caching, Observability - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 24 (new or modified groups, from 06-RESEARCH.md "Recommended Project Structure" and the inventories)
**Analogs found:** 22 / 24

All analogs below were opened and verified. Line numbers are from today's tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/contracts/*.ts` (common, events, clubs, users, admin, notifications, recommendations, interactions, feedback, health) | model (schema) | transform | `src/server/body.ts` + `src/server/errors.ts` | role-match (no zod yet) |
| `src/contracts/webhook.ts` + `supabase/functions/_shared/webhook-contract.ts` | model (schema, shared Deno/Jest) | transform | `supabase/functions/events-webhook/index.ts` lines 14-52 | role-match |
| `src/server/body.ts` (add `parseBody`/`parseQuery`/`parseForm`) | utility | request-response | itself (`readJsonObject`, lines 21-41) | exact |
| `src/server/route.ts` (`withRoute`) | middleware (wrapper) | request-response | `src/server/errors.ts`, `src/server/http.ts`, `src/server/context.ts` | role-match |
| `src/server/log.ts` (JSON logger + ALS) | utility | event-driven | `src/server/ratelimit/index.ts` (module shape) + `src/lib/env.ts` (readers) | role-match |
| `src/server/cachePolicy.ts` | utility | request-response | `src/server/http.ts` | exact |
| `src/server/observability/sentry.ts`, `sentry.server.config.ts`, `instrumentation-client.ts` | config | event-driven | `src/instrumentation.ts` | role-match |
| `src/instrumentation.ts` (modify: Sentry import in `register()`, `onRequestError`) | config | event-driven | itself, lines 79+ | exact |
| `src/app/api/health/route.ts` (rewrite, no `getSession()`) | controller | request-response | `src/app/api/admin/clubs/route.ts` lines 1-34 | exact |
| `src/app/docs/layout.tsx`, `src/app/health/layout.tsx` (admin gates) | component (server) | request-response | `src/app/api/admin/clubs/route.ts` guard chain | partial |
| ~93 route handlers (adopt contracts + wrapper + cache policy) | controller | request-response | `src/app/api/admin/clubs/route.ts` | exact |
| Client hooks reusing contracts (REFAC-16) | hook | request-response | existing `src/hooks/useEvents.ts` | role-match |
| `supabase/migrations/2026092x_async_edge_definer_hardening.sql` | migration | batch | `supabase/migrations/20260925130000_events_guard_appeal_increment.sql` | exact |
| `supabase/tests/database/070-definer-functions.test.sql`, `031-cron-jobs.test.sql` | test (pgTAP) | CRUD | `supabase/tests/database/066-events-appeal-increment.test.sql`, `030-cron-schedule.test.sql` | exact |
| Characterization suites (cron, webhook, recommendations, contracts byte-preservation, cache headers) | test (Jest) | request-response | `src/__tests__/api/admin/adminArmTable.ts` + `admin-guard-characterization.test.ts`, `src/__tests__/helpers/fakeSupabase.ts` | exact |
| Server-module unit tests (`log.test.ts`, `route.test.ts`, `cachePolicy.test.ts`, `sentry.test.ts`) | test | - | `src/server/__tests__/errors.test.ts`, `src/server/ratelimit/*.test.ts` | exact |
| `supabase/functions/tests/webhook.test.ts` (extend) | test | request-response | itself | exact |
| `e2e/specs/cache-headers.spec.ts`, `e2e/specs/cross-user-cache.spec.ts` | test (Playwright) | request-response | `e2e/specs/csrf-origin.spec.ts` | exact |
| `e2e/helpers/sharedCacheProxy.ts` | utility (test) | request-response | none (RESEARCH "shared-cache simulator" example) | no analog |
| `scripts/check-contracts.mjs`, `scripts/check-server-console.mjs` | utility (CI gate) | batch (file scan) | `scripts/check-elevated-ratchet.mjs`, `scripts/check-characterization-tags.mjs` | exact |
| `.github/workflows/ci.yml` (add census steps) | config | - | existing lines 67-79 | exact |
| `vercel.json` (remove blanket `s-maxage=60`), `next.config.js` (`withSentryConfig`) | config | - | themselves | exact |
| `docs/health.md` | doc | - | none | no analog |
| Deletions + `endpoints.json`/findings register + evidence/completion notes | doc/evidence | - | 05-04-SUMMARY (auth-debug), 05-19-SUMMARY, `05-*/evidence/PHASE-5-COMPLETION.md`, `slice-5-close.md` | exact |

## Pattern Assignments

### `src/contracts/*.ts` (schemas) and `parseBody`/`parseQuery` in `src/server/body.ts`

**Analog:** `src/server/body.ts` (whole file, 41 lines) and `src/server/errors.ts` lines 24-29.

Result-union shape to copy (body.ts 21-41) — errors are RETURNED, never thrown:
```typescript
export type ReadJsonObjectResult =
  | { ok: true; body: JsonObject }
  | { ok: false; response: NextResponse };

export async function readJsonObject(request: Request): Promise<ReadJsonObjectResult> {
  let parsed: unknown;
  try { parsed = await request.json(); }
  catch { return { ok: false, response: badRequest("Invalid JSON body") }; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, response: badRequest("Request body must be a JSON object") };
  }
  return { ok: true, body: parsed as JsonObject };
}
```
`parseBody(request, schema)` should call `readJsonObject` first (keeps both existing 400 strings byte-identical), then `schema.safeParse`, mapping the first issue to `badRequest(message, field)`. `badRequest` omits `field` when undefined (errors.ts 24-29) — the contract must reproduce each route's current message per inventory C, not zod's default text (Pitfall 6). Keep `readJsonObject` exported; body.ts's doc block style (purpose, what is NOT validated) is the header to copy.

Import convention: `import type { NextResponse } from "next/server"; import { badRequest } from "@/server/errors";`

### `src/server/route.ts`, `src/server/cachePolicy.ts`

**Analog:** `src/server/http.ts` (29 lines) — tiny named-export helpers, file JSDoc stating "no envelope is added… same bytes".
```typescript
export function ok<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 200 });
}
```
Catch path in the wrapper must return `serverError(action)` (errors.ts 56-61: `{ error: \`Failed to ${action}\` }`, 500). Cache policy names are string literals exported as a `const` tuple + type, same as `CLUB_ROLES`/`ClubRole` in `src/server/authz/requireClubRole.ts` lines 43-49. Tests go under `src/server/__tests__/` (see `http.test.ts`, `errors.test.ts`).

### `src/server/log.ts`

**Analogs:** `src/server/ratelimit/index.ts` lines 1-30 (module docblock naming plan/DEC/REFAC, `@/lib/env` imports, module-level singleton, `export type` re-exports); `src/lib/env.ts` lines 53-97 for any new env reader (e.g. `LOG_LEVEL`, `SENTRY_DSN`):
```typescript
export function supabaseUrl(): string {
  return requireEnvValue("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}
export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}
```
Optional-but-invalid values throw `InvalidEnvError` (env.ts 98). Readers stay lazy (never read at module evaluation). Existing log prefixes (`[Auth]`, `[Middleware]`, `[RateLimit]`) become a `scope` field. Must run in proxy runtime too — no `node:` imports on the edge path.

### Sentry: `src/instrumentation.ts`, `sentry.server.config.ts`, `instrumentation-client.ts`, `src/server/observability/sentry.ts`

**Analog:** `src/instrumentation.ts` lines 1-80. Copy the guards exactly:
```typescript
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // NEXT_PHASE === "phase-production-build" checks nothing (build has no secrets)
```
Messages are module-level constants naming variables never values (lines 64-77). Boot test lives in `src/server/__tests__/` / existing instrumentation test; evidence precedent `05-*/evidence/boot-check.txt`. Build must pass without `SENTRY_AUTH_TOKEN` (Pitfall 8; `evidence/build-ci-env.txt` precedent).

### `src/app/api/health/route.ts` and every route adoption

**Analog:** `src/app/api/admin/clubs/route.ts` lines 1-34:
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";

  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  ...
    console.error("Error fetching admin clubs:", error);   // -> log.error once log.ts lands
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ clubs: data ?? [], total: count ?? 0 });
```
`createRequestContext` uses `getUser()`, which is what satisfies REFAC-22 "no getSession()"; the existing `src/server/__tests__/getsession-gate.test.ts` is the gate to extend to `/api/health`. The docs/health layouts reuse the same guard chain in a server component and `redirect`/`notFound` instead of returning a response.

### Migration `2026092x_async_edge_definer_hardening.sql`

**Analog:** `supabase/migrations/20260925130000_events_guard_appeal_increment.sql` lines 1-40. Copy the header: `=====` banner, filename, phase/plan/finding ids, "FIX FORWARD, NEVER EDIT IN PLACE", idempotence statement, "BLAST RADIUS, STATED PLAINLY… locally only until DI-23", then "WHAT WAS WRONG" / "WHAT THE GUARD NOW SAYS" sections. Use `CREATE OR REPLACE`, `REVOKE ... FROM PUBLIC, anon, authenticated` plus `ALTER DEFAULT PRIVILEGES` (Pitfall 2). Filename must pass `scripts/check-migration-filenames.mjs` (CI line 67).

### pgTAP `070-definer-functions.test.sql`, `031-cron-jobs.test.sql`

**Analog:** `supabase/tests/database/066-events-appeal-increment.test.sql` lines 1-50: header block (what was wrong, ASSERTION SHAPES: refusal = `throws_ok(…, '42501')`, allowed = `results_eq` on RETURNING), `BEGIN; SELECT plan(N);`, literal ids in a numbered block (`00000000-0000-4000-8000-0000000070xx`), fixture as session role, `tests.act_as(uid)` / `tests.act_as_anon()` / `tests.act_as_owner()` from `000-setup.sql` lines 53-73, final `ROLLBACK`. Cron analog: `030-cron-schedule.test.sql`. Mutation proof: `scripts/pgtap-mutation-check.sh`.

### Jest characterization suites

**Analog:** `src/__tests__/api/admin/adminArmTable.ts` (descriptor table: `id` = "<route> VERB", `invoke(req)` dynamic-importing the handler typed as `(typeof import(...))["GET"]`, `makeRequest()`, measured flags) + `admin-guard-characterization.test.ts`:
- console muted in `beforeEach` via `jest.spyOn(console, "error").mockImplementation(() => {})` (lines 100-107)
- P0 "table equals the tree" re-derives route files with `readdirSync` walk from `src/app/api` (lines 122-160) — reuse for "every route has a contract / cache policy"
- `describe("P1: …")` + `it.each(ARMS.map((arm) => [arm.id, arm] as const))`
- Fakes: `createFakeSupabase(init)` from `src/__tests__/helpers/fakeSupabase.ts` line 605; assert no writes via `calls` filtered to insert/update/delete.
Tag with the characterization tag format enforced by `scripts/check-characterization-tags.mjs --all`.

### Webhook (`supabase/functions/events-webhook/index.ts`, `_shared/webhook-contract.ts`, `supabase/functions/tests/webhook.test.ts`)

**Analog:** the function itself. Current payload interface at lines 14-30 (`WebhookEvent`) becomes the zod schema; signature check at lines 43-52:
```typescript
const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
```
(note: `timingSafeEqual` throws on length mismatch — the pure `verifySignature` should length-check first). Headers read at lines 215-217 (`x-signature` / `x-hub-signature-256` / `x-webhook-signature`). The shared file must import nothing Deno-specific so Jest can load it; existing test is `supabase/functions/tests/webhook.test.ts`.

### Playwright `cache-headers.spec.ts`, `cross-user-cache.spec.ts`

**Analog:** `e2e/specs/csrf-origin.spec.ts`:
```typescript
import { expect, test, type APIRequestContext } from "@playwright/test";
import { IDS, storageStateFor } from "../fixtures";
```
Per-persona requests via `storageStateFor(...)`, ids from `IDS`. For service-client setup/teardown copy `e2e/specs/event-moderation-notifications.spec.ts` lines 36-42 (`randomUUID`, `createClient` from supabase-js, `localStackEnv` from `../env`). Floor evidence precedent: `05-*/evidence/playwright.slice-*-after.txt`.

### Census gates `scripts/check-contracts.mjs`, `scripts/check-server-console.mjs`

**Analog:** `scripts/check-elevated-ratchet.mjs` — shebang, PURPOSE/SCOPE docblock, `REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")`, recursive scan of `src/`, `TEST_FILE = /\.test\.[cm]?[jt]sx?$/` exclusion, allow-list that may only shrink (passes naming retired rows, fails on new rows), `process.exit(1)` on failure. Wire into `.github/workflows/ci.yml` next to lines 67-79 as `run: node scripts/check-*.mjs`. Beware the empty allow-list case (Pitfall 3).

### Deletions, register, evidence

- Deletion: 05-04-SUMMARY line 91 — grep for callers in `src` and `e2e` before deleting, record the finding id, state whether `endpoints.json` is touched and why, and regenerate the contract (`evidence/contract-regen-slice-5.txt`).
- Findings register (`.planning/audit/findings.json`): 05-19-SUMMARY lines 15-17, 48 — mark Fixed only with a test cited; re-point unmet ones with a phase; register new DIs in sequence.
- Close-out: copy structure of `05-*/evidence/slice-5-close.md` (floor, Validated table, findings, behaviour changes, local-only closures) and `PHASE-5-COMPLETION.md` (each criterion measured against its own words, Complete/PARTIAL, owner actions).

## Shared Patterns

### Error vocabulary (all handlers, wrapper, contracts)
**Source:** `src/server/errors.ts` 24-61 — `badRequest(message, field?)`, `unauthorized()`, `forbidden()`, `notFound()`, `serverError(action)`. Returned, never thrown; bytes must not change.

### Guard chain (health, admin routes, docs/health layouts)
**Source:** `src/app/api/admin/clubs/route.ts` 8-12 (`createRequestContext` → `requireActiveUser` → `requireRole`).

### Validated env readers (Sentry DSN, log level, cron secret)
**Source:** `src/lib/env.ts` 53-97 — lazy, `MissingEnvError`/`InvalidEnvError`, messages name the variable, never the value.

### Behaviour preservation evidence
Every slice ends with a floor (Jest, Playwright, pgTAP twice, ratchet, types drift) recorded like `05-*/evidence/floor.slice-*-after.txt`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `e2e/helpers/sharedCacheProxy.ts` | test utility | request-response | No shared-cache simulator exists; use RESEARCH "Code Examples: The shared-cache simulator" |
| `docs/health.md` | doc | - | No existing endpoint shape doc; follow RESEARCH § G |
| zod itself | - | - | zod is new to the project; no existing schema file — contracts use RESEARCH Pattern 2 |

## Metadata

**Analog search scope:** `src/server/`, `src/lib/env.ts`, `src/instrumentation.ts`, `src/app/api/admin/`, `src/__tests__/`, `supabase/migrations/`, `supabase/tests/database/`, `supabase/functions/`, `e2e/specs/`, `scripts/`, `.github/workflows/ci.yml`, `.planning/phases/05-*/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-09-25
