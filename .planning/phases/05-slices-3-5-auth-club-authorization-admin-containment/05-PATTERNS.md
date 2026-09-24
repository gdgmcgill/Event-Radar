# Phase 5: Slices 3–5 — Auth, Club Authorization, Admin Containment - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** ~70 (grouped into 22 file families below; per-route inventories live in 05-RESEARCH.md §A–§H)
**Analogs found:** 20 / 22 families

All excerpts below were read from the tree at `66df3dc`. Line numbers are current.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/server/authz/requireActiveUser.ts` (new) | guard | request-response | `src/server/authz/requireRole.ts` + `src/lib/ban.ts` (`isBanned`) | exact |
| `src/server/authz/requireOnboarded.ts` (new) | guard | request-response | `src/server/authz/requireRole.ts` | exact |
| `src/server/authz/requireClubRole.ts` (mod: `CLUB_ROLES`) | guard | CRUD read | itself | exact |
| `src/server/context.ts` (mod: `PROFILE_COLUMNS` += ban cols) | provider | request-response | itself (docblock :28-58 already names this change) | exact |
| `src/server/__tests__/requireActiveUser.test.ts`, `requireOnboarded.test.ts` (new) | test | — | `src/server/__tests__/requireRole.test.ts` | exact |
| `src/lib/env.ts` (new: `requireEnvValue`, `MissingEnvError`, lazy readers) | utility/config | config | `src/lib/supabase/service.ts`, `scripts/seed/guard.ts` (fail-closed docblock) | partial |
| `src/lib/supabase/{server,client,service}.ts`, `auth/signout/route.ts` (mod: drop `!`) | utility | config | `src/lib/supabase/service.ts` | exact |
| `src/instrumentation.ts` (new, optional) | config | boot | none in tree | none |
| ~40 API route handlers adopting the seam (10 `checkBanStatus` callers, 33 `verifyAdmin` sites, 17 club gates, F-028 four) | controller | request-response | `src/app/api/events/[id]/save/route.ts` | exact |
| Routes moving to `getElevatedClient()` (research §F) + `src/lib/audit.ts` | controller/service | CRUD | `src/server/db/elevated/index.ts` | role-match |
| `src/server/db/elevated/REGISTRY.md` (rows added) | doc/config | — | itself (table :12-14, "Adding a row" :59-72) | exact |
| `eslint.elevated-allowlist.mjs` (regenerated, shrink) | config (generated) | — | `scripts/check-elevated-ratchet.mjs --write` | exact |
| `src/proxy.ts` (mod: single users read, ban 403 for `/api/*`, onboarding by DB, fail-closed catch, CSRF, admin RL) | middleware | request-response | itself | exact |
| `src/middlewareRateLimit.ts` (keep `applyApiRateLimit` byte-identical) + `src/server/ratelimit/{policy,memoryStore,upstashStore,index}.ts` (new) | middleware/utility | request-response | `src/middlewareRateLimit.ts` | role-match |
| `src/server/csrf.ts` (new pure predicate) + test | utility | transform | `src/server/errors.ts` (pure, returned values) | partial |
| `*-defect.test.ts` moved pins (save, rsvp ban asymmetry; callback F-004) and new DEFECT/PRESERVE suites | test | — | `src/__tests__/api/events/save-characterization.test.ts`, `friends-defect.test.ts` | exact |
| `supabase/migrations/2026092x_users_column_grants_audit_log_insert.sql`, `..._events_insert_policy.sql` | migration | — | `supabase/migrations/20260916000000_invitation_policy_fixes.sql` | exact |
| `supabase/tests/database/050-*.sql`, `055-*.sql`, `060-*.sql` | test (pgTAP) | — | `supabase/tests/database/020-rls-policy-gaps.test.sql`, `025-invitation-acceptance.test.sql` | exact |
| `e2e/specs/*.spec.ts` (new persona specs: cross-club, admin 401/403, banned API 403) | test (e2e) | — | `e2e/specs/banned-redirect.spec.ts`, `e2e/fixtures.ts` | exact |
| `.planning/audit/findings.json` (F-086, F-087, re-pointing) + `FOUNDATION_AUDIT.md` + `classify-inventory.mjs` row | doc/data | batch | Phase 4 method, `04-01-PLAN.md` Task 2 | exact |
| `evidence/{defect-ledger.md, slice-N-close.md, csrf-assessment.md, PHASE-5-COMPLETION.md}` | doc | — | Phase 4 `evidence/` | exact |
| `src/app/api/auth-debug/route.ts` (delete) | — | — | n/a | n/a |

---

## Pattern Assignments

### `src/server/authz/requireActiveUser.ts` / `requireOnboarded.ts` (guard)

**Analog:** `src/server/authz/requireRole.ts` (whole file, 56 lines) and `requireUser.ts`.

Conventions to copy exactly:
- File docblock explaining the guard's fail-closed rule (requireRole.ts:1-11).
- Imports (requireRole.ts:13-17):
```typescript
import type { RequestContext } from "../context";
import { forbidden } from "../errors";
import { requireUser, type AuthGuardResult } from "./requireUser";
```
- Signature takes `Pick<RequestContext, "user" | "profile">`, returns `AuthGuardResult`, compose `requireUser` first (requireRole.ts:31-39):
```typescript
export function requireRole(
  ctx: Pick<RequestContext, "user" | "profile">,
  role: UserRole,
  message = "Forbidden"
): AuthGuardResult {
  const authenticated = requireUser(ctx);
  if (!authenticated.ok) {
    return authenticated;
  }
  // No profile row means no roles can be established. Fail closed
  if (!ctx.profile) {
    return { ok: false, response: forbidden(message) };
  }
```
- Ban predicate: reuse `isBanned` from `src/lib/ban.ts:9-13` (do not re-implement); deny body is `forbidden("Account suspended")` — byte-identical to ban.ts:34 `NextResponse.json({ error: "Account suspended" }, { status: 403 })`.
- `requireOnboarded` deny: `forbidden("Onboarding required")`; applies only when `ctx.user` present (amendment C2); exemptions live at the call sites (`onboarding/complete` POST, `users/[id]` PATCH), not in the guard.
- Null profile → 403 (DEFECT change vs ban.ts:33 fail-open; research §B row 2).

### `src/server/context.ts` (modify)

Change only `RequestProfile` Pick (:55-58) and `PROFILE_COLUMNS` (:67-68) to add `banned_at, ban_expires_at`; rewrite the docblock paragraph at :37-53 ("THE SEAM PERFORMS NO BAN CHECK… REFAC-11, Phase 5 will re-add…") to state the guard now exists. `createRequestContext()` body (:76-95) unchanged.

### `src/server/authz/requireClubRole.ts` (modify)

Current `ClubRole = Tables<"club_members">["role"]` (:29) is `string`. Add beside it:
```typescript
export const CLUB_ROLES = ["owner", "organizer"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];
```
Keep the no-admin-bypass contract (docblock :13-17) and the result shape (:31-33). `transfer` needs the membership id (research §C row 10): demote by `(club_id, user_id)` rather than widening the guard.

### Guard unit tests (`src/server/__tests__/requireActiveUser.test.ts`, etc.)

**Analog:** `src/server/__tests__/requireRole.test.ts` lines 1-78.
```typescript
import type { RequestContext } from "../context";
import { requireRole } from "../authz/requireRole";

const AUTHENTICATED_USER = { id: "user-1", email: "someone@mail.mcgill.ca" };

function makeContext(overrides: Partial<RequestContext>): RequestContext {
  return { supabase: null, user: null, profile: null, requestId: "req-1", ...overrides } as unknown as RequestContext;
}
...
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(401);
```
Cases to mirror: anonymous 401; null profile 403; banned permanent 403; `ban_expires_at` future 403; expired suspension permits (the case `banned-redirect.spec.ts` docblock :20-24 calls "the one worth having"); assert body `{ error: "Account suspended" }` via `await result.response.json()`.

### Route handlers adopting the seam (controller, request-response)

**Analog:** `src/app/api/events/[id]/save/route.ts` (125 lines).

Imports (:10-16):
```typescript
import { NextResponse } from "next/server";
import { checkBanStatus } from "@/lib/ban";          // → removed; replaced by requireActiveUser
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { notFound, serverError } from "@/server/errors";
import { ok } from "@/server/http";
import type { NextRequest } from "next/server";
```
Core flow (:51-62), which becomes `requireActiveUser` in place of the separate `checkBanStatus()` + `requireUser`:
```typescript
    const banResponse = await checkBanStatus();
    if (banResponse) return banResponse;
    const { id: eventId } = await params;
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;
```
Error handling (:39-42, :121-124): `console.error("<context>:", err); return serverError("<action>")`; outer catch keeps its pre-existing literal body (`"Internal server error"`) — do not normalize bodies the PRESERVE suite pins.

Ordering note: today the ban check runs BEFORE `await params` and before any read (save-characterization docblock :16-17 "the ban check runs FIRST — … 403 before any event is read"). Keep `requireActiveUser` as the first gate after `createRequestContext()`.

**Admin sites** — replace the `verifyAdmin` shape (e.g. `src/app/api/admin/reports/route.ts:6-10`):
```typescript
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```
with
```typescript
  const ctx = await createRequestContext();
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
```
(anonymous now 401 — F-061 DEFECT; research §B). `src/lib/admin.ts` (17 lines) is the retiring helper.

**Club gate sites** — replace the hand-rolled read (e.g. `src/app/api/clubs/[id]/route.ts:58-70`):
```typescript
    const { data: membership } = await supabase.from("club_members").select("role")
      .eq("user_id", user.id).eq("club_id", clubId).eq("role", "owner").maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Only the club owner can update club details" }, { status: 403 });
    }
```
with `const gate = await requireClubRole(ctx.supabase, clubId, user.id, ["owner"], "Only the club owner can update club details"); if (!gate.ok) return gate.response;` — the 403 message per site is in research §C (keep bytes).

### Elevated door adoption (`getElevatedClient()` callers, `src/lib/audit.ts`)

**Analog:** `src/server/db/elevated/index.ts:19-34`
```typescript
import { getElevatedClient } from "@/server/db/elevated";
const admin = getElevatedClient();   // per call, never a module singleton
```
Replace `import { createServiceClient } from "@/lib/supabase/service"` + `createServiceClient()` (e.g. `src/lib/audit.ts:1,35`; `admin/reports/route.ts:4,20`). `audit.ts:36` currently ignores `{ error }` — research §F says inspect it. Sites research §F marks "cookie client" switch to `ctx.supabase` instead (admin/organizers, admin/reports, admin/reports/[id], profile/avatar, profile/banner, users/[id] PATCH).

**REGISTRY.md row** — table header `REGISTRY.md:12-13`:
```
| Operation | Calling module | Why RLS cannot express it | Phase added |
```
Replace the `_(none)_` row (:14) and the "empty in this phase" paragraph (:16-23); the `src/lib/audit.ts` "note, not a row" section (:25-53) becomes a row. Reason text per research §F / amendments C6, C11, C12.

**Allowlist:** never hand-edit `eslint.elevated-allowlist.mjs` (header "GENERATED — do not hand-edit"); run `node scripts/check-elevated-ratchet.mjs --write` (:310-311) at phase exit and capture the diff to evidence (Phase 4 precedent: `evidence/boundary-widening.txt`).

### `src/lib/env.ts` (utility/config)

**Analogs:** `src/lib/supabase/service.ts:9-14` (the `!` reads being replaced) and `scripts/seed/guard.ts:1-40` (fail-closed docblock voice: "IT FAILS CLOSED, DELIBERATELY", "WHAT IT READS").
```typescript
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```
Target (keep the literal key read inside `service.ts`, research C9):
```typescript
requireEnvValue("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
```
Lint constraint to respect: `eslint.config.mjs:82-107` bans `process.env.SUPABASE_SERVICE_ROLE_KEY` (member, bracket and destructuring forms) outside `src/lib/supabase/**` and `src/server/db/elevated/**`. Never read by computed key. Validate lazily at first read (C8); "production" = `VERCEL_ENV === "production"`. Code example: 05-RESEARCH.md §"Lazy validated env".

### `src/proxy.ts` (middleware)

Current structure to preserve (read whole file, 158 lines):
- Rate limit first (:6-8) — CSRF check goes next to it, before session work.
- `:10-16` F-003 pass-through → replaced by lazy env reader (throws → fail-closed catch).
- `:51-56` "Do not add any logic between createServerClient and getUser" — keep.
- `:92-111` ban read → becomes the single read `select("banned_at, ban_expires_at, onboarding_completed")`; for `/api/*` return `NextResponse.json({ error: "Account suspended" }, { status: 403 })`, pages keep the `nextUrl.clone()` redirect (query string preserved — research §B).
- `:114` `PROTECTED_ROUTES` must remain a one-line regex-parseable literal (CLAUDE.md derivation command; Pitfall 12; `e2e/fixtures.ts:43 protectedRoutes()` parses it).
- `:124-136` onboarding: same exemptions (`/onboarding`, `/api/*`, `/auth/*`), predicate from DB `onboarding_completed !== true`.
- `:140-144` catch → 500 JSON under `/api/`, plain 500 otherwise.
- `:147-158` `config.matcher` untouched (pinned by `src/proxy.test.ts:75` PRESERVE).

### Rate limit (`src/middlewareRateLimit.ts`, `src/server/ratelimit/*`)

`applyApiRateLimit` (:78-133) stays synchronous and byte-identical for the memory path (`src/middlewareRateLimit.test.ts:85` PRESERVE, imported at :33). Reusable pieces: the `globalThis` store (:9-18), `getIp` (:45-52; amendment: prefer `x-real-ip` when present — implement in the new policy module, not by editing this function if the PRESERVE test pins XFF order), and the 429 body/headers (:110-127):
```typescript
return NextResponse.json(
  { error: "Too Many Requests", message: `Rate limit exceeded. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.` },
  { status: 429, headers: { "Retry-After": String(retryAfter), "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)) } }
);
```
Admin exclusion is `:32` + `:85` — the new admin budget is a separate policy invoked from the proxy, not a change to that early return. Upstash store: 05-RESEARCH.md §"Upstash store".

### Characterization / DEFECT suites (test)

**PRESERVE analog:** `src/__tests__/api/events/save-characterization.test.ts`
- Docblock with `PRESERVE characterization — <route> (REFAC-nn)` headline, "Tests cover", "WHY THE MOCK SEAM IS …", "Deliberately NOT pinned" (:1-47).
- Mock seam is the server factory, fed by the shared fake (:49-60):
```typescript
import { createFakeSupabase, type FakeRow, type FakeSupabase, type FakeSupabaseInit } from "../../helpers/fakeSupabase";
import { DELETE, POST } from "@/app/api/events/[id]/save/route";
let mockFake: FakeSupabase;
jest.mock("@/lib/supabase/server", () => ({ ...
```
- `createFakeSupabase(init)` at `src/__tests__/helpers/fakeSupabase.ts:605`; supports `throwOn`, tables, rpc (types :60-143).
- Block to MOVE out (C15): `describe("ban asymmetry — pinned for Phase 5 (DEC-24)")` at save-characterization.test.ts:344-357 (and the equivalent in `rsvp-characterization.test.ts`; callback tests at `src/app/auth/callback/route.test.ts:331,350`).

**DEFECT analog:** `src/__tests__/api/events/friends-defect.test.ts:1-53` — headline `DEFECT characterization — F-nnn`, "Subject:", "The defect:", "What this file is and is not", "Registered as F-nnn … Closes in Phase N", then a "Status: FIXED in <plan>, by the commit …" paragraph describing how assertions moved. Tag gate: `node scripts/check-characterization-tags.mjs --all` reads only the leading docblock (file-level tags).

### Migrations (F-006/F-007, F-008)

**Analog:** `supabase/migrations/20260916000000_invitation_policy_fixes.sql`
- Header block (:1-19): `-- ====` rule, filename, phase line, "FIX FORWARD, NEVER EDIT IN PLACE", "BLAST RADIUS, STATED PLAINLY" (local-only until DI-23), then a "WHAT WAS WRONG" section per finding (:20-60).
- Idempotent policy rewrite (:212-216):
```sql
DROP POLICY IF EXISTS "Invitees can view their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can view their own invitations"
  ...
  TO authenticated
```
- Helper functions carry `COMMENT ON FUNCTION` and explicit `GRANT EXECUTE … TO authenticated, service_role` (:139-147, :193). Apply to `update_saved_events_count()` as `SECURITY DEFINER SET search_path = ''` (C3). Skeleton: 05-RESEARCH.md §"F-006 / F-007 migration skeleton".

### pgTAP tests (050/055/060)

**Analog:** `supabase/tests/database/020-rls-policy-gaps.test.sql`
- Docblock stating the two denial shapes (:6-19): WITH CHECK → `throws_ok(..., '42501', NULL, ...)`; USING → `is_empty` then `tests.act_as_owner()` + `isnt_empty` integrity check.
- `BEGIN; SELECT plan(N);` … rollback; fixture as session role with literal `00000000-0000-4000-8000-…` UUIDs (:31-68) — NOT seed UUIDs (Pitfall 4: CI `types` job is unseeded).
- Impersonation proof first (:80-81):
```sql
SELECT tests.act_as('00000000-0000-4000-8000-000000000002');
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000000002'::uuid,
          'act_as moved auth.uid() to the invitee — impersonation is real');
```
- Allow via `results_eq(... RETURNING col, ARRAY[...])` (:84-88, :111-116). Deny inserts for anon audit-log forge must omit RETURNING (research §D note); helpers in `000-setup.sql:53,64,73` (`act_as`, `act_as_anon`, `act_as_owner`). `025-invitation-acceptance.test.sql:92` explains why bare `results_eq(INSERT … RETURNING)` is insufficient.

### Playwright persona specs

**Analog:** `e2e/specs/banned-redirect.spec.ts:1-60`
```typescript
import { expect, test } from "@playwright/test";
import { BANNED_PATH, protectedRoutes, storageStateFor } from "../fixtures";
test.describe("a permanently banned user", () => {
  test.use({ storageState: storageStateFor("banned_permanent") });
  test("...", async ({ page }) => {
    await page.goto(A_PROTECTED_PATH);
    expect(new URL(page.url()).pathname, "<why>").toBe(BANNED_PATH);
```
Fixtures exports (`e2e/fixtures.ts`): `IDS`, `PERSONA_CREDENTIALS`, `PersonaKey` (:25-26), `storageStateFor` (:31), `protectedRoutes()` (:43), `signInRedirectFor` (:63), `BANNED_PATH` (:67). Personas incl. `club_owner` and `cross_club_attacker` from `scripts/seed/personas.ts:61-95`. Assert redirect/status, never follow into rendered page content (docblock :12-18). For API checks use `page.request` with the persona's storage state. No shared mutable seed (Pitfall 10).

### Findings register edits

**Method:** `04-01-PLAN.md` Task 2 (:151-185). Correction to the prompt's premise: `findings.json` is **not** generated. It is edited by per-record insertion after the last record and single-field edits for re-pointing (`closes_in_phase`), never parse-and-restringify. Then:
```
node .planning/audit/tools/gen-foundation-audit.mjs
node .planning/audit/tools/validate.mjs --check findings
git diff --stat -- .planning/audit/findings.json   # insertions + the intended one-line edits only
```
captured into `evidence/findings-registration.txt`; each new record's `evidence` anchors a section in a `.planning/audit/quality/phase-05-*.md` document (Phase 4: `phase-04-slice-defects.md`). `endpoints.json` calculate-popularity row is regenerated through `.planning/audit/tools/classify-inventory.mjs` (row :145, `EXPECTED_OVERRIDES` :283).

### Evidence and completion note

- `evidence/defect-ledger.md` — copy Phase 4 header + 5-step protocol and the table `| F-nnn | Suite | Old assertion | New assertion | Commit | Plan |`.
- `evidence/slice-N-close.md` — sections: Floor before/after; Playwright before/after; Validated-workflow re-confirmation; Findings; how "no intentional visual change" was established.
- `evidence/PHASE-5-COMPLETION.md` — Phase 4 skeleton: How to read; success criteria clause by clause; requirements; workflow re-confirmation; intentional behaviour changes with authority; deferred items/assumptions/findings; floor at close; CI observation; citation count. Add the Upstash (both env names) Phase 8 prerequisite and local-only closures pending DI-23.

---

## Shared Patterns

### Error vocabulary (apply to every handler and guard)
**Source:** `src/server/errors.ts:24-61` — `badRequest(message, field?)`, `unauthorized()` → `{error:"Unauthorized"}` 401, `forbidden(msg)`, `notFound(msg)`, `serverError(action)` → `{error:"Failed to <action>"}`. Returned, never thrown.

### Guard result discipline
**Source:** `src/server/authz/requireUser.ts:17-19` — `{ ok: true; user } | { ok: false; response }`; call sites are always `if (!x.ok) return x.response;`.

### One context per request
**Source:** `src/server/context.ts:76-95` — handlers call `createRequestContext()` once and use `ctx.supabase`; server layouts/pages use `getRequestContext()` (:128).

### Elevated access
**Source:** `src/server/db/elevated/index.ts:32` + REGISTRY row + ratchet regeneration. No `createServiceClient` import outside `src/lib/supabase/` and the door.

### Behaviour-change bookkeeping
Every assertion that moves: DEFECT file citing F-nnn, same commit as the fix, ledger row. PRESERVE files stay unedited.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/instrumentation.ts` | config | boot | No instrumentation hook exists; follow `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` and guard `NEXT_PHASE === "phase-production-build"` |
| `src/server/ratelimit/upstashStore.ts` | utility | request-response (network) | No Redis client in tree; use 05-RESEARCH.md §"Upstash store", `new Redis({ url, token, enableTelemetry: false })`, pinned `@upstash/ratelimit@2.1.0`, `@upstash/redis@1.38.4` |
| `src/server/csrf.ts` | utility | transform | No origin check exists; use 05-RESEARCH.md Pattern 5; pass-through when neither `Origin` nor `Sec-Fetch-Site` is present |

## Metadata

**Analog search scope:** `src/server/**`, `src/lib/{ban,admin,audit,supabase/*}.ts`, `src/app/api/events/[id]/save`, `src/app/api/clubs/[id]`, `src/app/api/admin/reports`, `src/proxy.ts`, `src/middlewareRateLimit.ts`, `src/__tests__/**`, `supabase/migrations`, `supabase/tests/database`, `e2e/`, `eslint.config.mjs`, `eslint.elevated-allowlist.mjs`, `scripts/`, `.planning/audit/tools`, Phase 4 plan and evidence
**Files scanned:** ~35
**Pattern extraction date:** 2026-09-23
