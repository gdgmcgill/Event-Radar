# Phase 4: Slices 1–2 — Saved Events/RSVP and the Event Read Path - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 20 (new + modified, from 04-RESEARCH.md; no CONTEXT.md)
**Analogs found:** 19 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/events/[id]/save/route.ts` (MOD) | route | CRUD (toggle) | seam: `src/server/context.ts` + `authz/requireUser.ts` + `errors.ts` + `http.ts` | exact (seam built for this) |
| `src/app/api/events/[id]/rsvp/route.ts` (MOD) | route | CRUD + count | same seam; count from `src/app/profile/page.tsx:37-41` | exact |
| `src/app/api/users/saved-events/route.ts` (MOD) | route | request-response (read) | seam + `src/app/api/events/route.ts:180` (real club join) | exact |
| `src/app/api/calendar/events/route.ts` (MOD, seam only) | route | read | seam | exact |
| `src/app/api/events/[id]/friends/route.ts` (MOD, F-071 fix) | route | read | seam; `friends-defect.test.ts` pins current behaviour | exact |
| `src/app/api/events/[id]/route.ts` (MOD, drop fabricated club) | route | read | `src/app/api/events/route.ts:180` `*, club:clubs(...)` | exact |
| `src/app/api/events/route.ts` (MOD, search escape + cursor) | route | read / paginated | itself + `src/lib/searchFilter.ts` (new) | self |
| `src/app/api/events/{new,following,happening-now,popular}/route.ts` (MOD, via tag mapping only) | route | read | unchanged except `transformEventFromDB` consumer | n/a |
| `src/server/context.ts` (MOD, narrow `RequestProfile`, DI-35) | utility/seam | request-response | itself, lines 35-48 | self |
| `src/lib/tagMapping.ts` (MOD, split) | utility | transform | itself, lines 42-45, 97-155 | self |
| `src/lib/eventTags.ts` (NEW) | utility | transform | `src/lib/tagMapping.ts:1-46` (the map moves here) | exact |
| `src/lib/searchFilter.ts` (NEW) | utility | transform | `src/lib/sanitize.ts` (single-purpose pure input-escaper) | role-match |
| `src/lib/eventTags.test.ts`, `src/lib/searchFilter.test.ts` (NEW) | test (node) | transform | `src/lib/sanitize.test.ts` | exact |
| `src/__tests__/api/events/save-characterization.test.ts` (NEW, PRESERVE) | test | CRUD | header: `src/app/auth/callback/route.test.ts`; mocks: `src/__tests__/api/events/rsvp.test.ts` | exact |
| `src/__tests__/api/events/saved-events-characterization.test.ts` (NEW, PRESERVE) | test | read | same | exact |
| `src/__tests__/api/events/events-list-characterization.test.ts` (NEW, PRESERVE) | test | read | same + `get-events.test.ts` | exact |
| `src/__tests__/api/events/rsvp-count-defect.test.ts` (NEW, DEFECT) | test | read | `src/__tests__/api/events/friends-defect.test.ts` | exact |
| `src/__tests__/api/events/rsvp.test.ts`, `friends-defect.test.ts` (MOD when fixes land) | test | — | themselves | self |
| `e2e/specs/save-and-rsvp.spec.ts` (EXISTING net, possibly extended) | e2e | — | itself | self |
| `.planning/audit/findings.json` (new F-nnn records) | config | — | existing records; SURGICAL per-record insert only | self |

## Pattern Assignments

### Route handlers adopting the seam (save, rsvp, saved-events, calendar/events, friends)

**Seam imports** (to replace `createClient` from `@/lib/supabase/server`):
```ts
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { serverError, notFound, forbidden, badRequest } from "@/server/errors";
import { ok } from "@/server/http";
```

**Before — current shape** (`src/app/api/events/[id]/save/route.ts:21-50`):
```ts
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error: deleteError } = await supabase.from("saved_events").delete()
      .eq("user_id", user.id).eq("event_id", eventId);
    if (deleteError) {
      console.error("Error deleting saved event:", deleteError);
      return NextResponse.json({ error: "Failed to unsave event" }, { status: 500 });
    }
    return NextResponse.json({ saved: false });
  } catch (error) {
    console.error("Unexpected error unsaving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**After — guard contract** (`src/server/authz/requireUser.ts:17-35`):
```ts
export type AuthGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };
export function requireUser(ctx: Pick<RequestContext, "user">): AuthGuardResult {
  if (!ctx.user) return { ok: false, response: unauthorized() };
  return { ok: true, user: ctx.user };
}
```
Handler body: `const ctx = await createRequestContext(); const auth = requireUser(ctx); if (!auth.ok) return auth.response;` then use `ctx.supabase` / `auth.user` (full example: RESEARCH lines 1024-1052).

**Byte-preservation rules (from `src/server/errors.ts:1-61`, `http.ts:15-29`):**
- `unauthorized()` -> `{ error: "Unauthorized" }` 401 — identical to today.
- `serverError("unsave event")` -> `{ error: "Failed to unsave event" }` 500. Only use where today's string is literally `Failed to <action>`.
- Outer `catch` blocks that emit `"Internal server error"` must KEEP the literal `NextResponse.json` — `serverError` would change the bytes.
- `ok(body)` = `NextResponse.json(body, {status:200})`; bare `NextResponse.json({saved:false})` is equivalent.
- Call `createRequestContext()` once per handler; never `getRequestContext()` in a route (`context.ts:104-108`).
- Note for the planner: today's handlers deny on `authError || !user`; `createRequestContext()` (`context.ts:60-66`) ignores `error` and keys only on `user`. getUser returns `user: null` on error, so equivalence holds, but the PRESERVE suite should include an `authError` + null-user case to pin it.
- Note: `createRequestContext()` adds a `users` profile read for authenticated callers — tests mocking `from()` by table must return something sane for `"users"`.

**RSVP GET special case** (`src/app/api/events/[id]/rsvp/route.ts:70-123`): anonymous-tolerant. Use `createRequestContext()` and read `ctx.user` directly — do NOT call `requireUser`. Existing ban call `checkBanStatus()` (`save/route.ts:55-56`) stays as-is (DI-35: no `requireNotBanned`).

**Count query** — replace `rsvp/route.ts:93-105` (load-all + `.filter().length`) with the repo's existing head-count form, `src/app/profile/page.tsx:37-41`:
```ts
const { count } = await supabase
  .from("saved_events")
  .select("id, events!inner(start_date)", { count: "exact", head: true })
  .eq("user_id", user.id)
  .lt("events.start_date", new Date().toISOString());
```
Two parallel counts (going / interested); keep the `"Failed to fetch RSVPs"` 500 bytes (RESEARCH 1067-1078).

---

### `src/app/api/events/[id]/route.ts` and `src/app/api/users/saved-events/route.ts` (fabricated club -> real join)

**Analog:** `src/app/api/events/route.ts:180` — `select("*, club:clubs(<10 cols>)", { count: "exact" })`; copy that exact column list. Remove `[id]/route.ts:79` false comment and the cast at `:105`. Club object is then built by `transformEventFromDB` (`src/lib/tagMapping.ts:103-122`, the `dbEvent.club` branch) instead of the `organizer` legacy branch (`:123-142`) that fabricates `id: dbEvent.organizer`.

Also: saved-events uses `new Date().toISOString()` (`saved-events/route.ts:100`) vs `getESTNowISO()` (`events/route.ts:246`, import `@/lib/timezone`) — Pitfall 6; characterize before changing.

---

### `src/lib/eventTags.ts` (NEW) and `src/lib/tagMapping.ts` (MOD)

**Analog:** `src/lib/tagMapping.ts:1-46` — the `tagMapping` record and:
```ts
export function mapTags(dbTags: string[]): EventTag[] {
  ...
    return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping
```
Move the map + `mapTags` to `eventTags.ts`; keep `transformEventFromDB` in `tagMapping.ts` (`:97`, uses `mapTags` at `:155`) re-importing it. Completeness test iterates `Object.values(EventTag)` from `@/types`. Changing the SOCIAL default is a visible change — log it.

### `src/lib/searchFilter.ts` (NEW)

**Analog:** `src/lib/sanitize.ts` (tiny pure module, JSDoc per export, named exports). Content given verbatim in RESEARCH lines 1084-1100 (`escapeLikeLiteral`, `postgrestQuotedValue`, `ilikeContainsFilter`). Call site to replace: `src/app/api/events/route.ts:225-227`:
```ts
eventsQuery = eventsQuery.or(
  `title.ilike.%${search}%,description.ilike.%${search}%`
```

### `src/lib/*.test.ts` (NEW unit tests, node project)

**Analog:** `src/lib/sanitize.test.ts:1-29` — relative import of the subject, one `describe` per export, plain `it` + `toBe`. No mocks.

---

### PRESERVE characterization suites (save, saved-events, events-list)

**Header analog:** `src/app/auth/callback/route.test.ts:1-54`. Reproduce the structure: tag + requirement id on line 1-3; "written against today's *unmodified* route and must pass byte-for-byte identically afterwards"; bulleted "Tests cover"; `WHY THE MOCK SEAMS ARE THESE` section justified from the subject's own import block (for these routes that is `@/lib/supabase/server` and `@/lib/ban`; after seam adoption the mock point is unchanged because `context.ts:21` awaits the same factory); statement that every assertion invokes the handler; pointer to `evidence/<name>-mutation-check.txt`.

**Mock/driver analog:** `src/__tests__/api/events/rsvp.test.ts:10-90`:
```ts
function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ["select","insert","update","delete","eq","neq","is","maybeSingle","single"];
  for (const method of methods) builder[method] = jest.fn().mockReturnValue(builder);
  ...
}
let mockUser: { id: string } | null = null;
let mockQueryResults: Map<string, { data: unknown; error: unknown }>;
const mockSupabase = {
  auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: mockAuthError })) },
  from: jest.fn((table: string) => createMockQueryBuilder(mockQueryResults.get(table) ?? { data: null, error: null })),
};
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));
function createRouteContext(eventId = "test-event-id") {
  return { params: Promise.resolve({ id: eventId }) };
}
beforeEach(async () => { jest.resetModules(); jest.clearAllMocks(); mockQueryResults = new Map(); /* dynamic import of GET/POST/DELETE */ });
```
Extend the method list with `order`, `range`, `gte`, `lt`, `or`, `in`, `rpc`, and make the builder thenable for non-terminal awaits. Replace `let GET: any` with typed handler refs (DI-24 / F-066: test files become type-checked; do not widen handler signatures to silence TS2554). Also mock `@/lib/ban` (`checkBanStatus` -> `null`) for POST paths. Suites go in node project (`src/__tests__/**/*.test.ts`).

### `src/__tests__/api/events/rsvp-count-defect.test.ts` (NEW, DEFECT)

**Analog:** `src/__tests__/api/events/friends-defect.test.ts:1-60`. Header: `DEFECT characterization — F-nnn`; Subject with line numbers; The defect; "What this file is and is not" (passes today, NOT a failing test, NOT a fix); why the mock is shaped this way; "Registered as F-nnn ... Closes in Phase 4." Draft header given in RESEARCH 1110-1132. Assert on the query shape (no `count` option on the `rsvps` select), since the 1000-row cap lives in PostgREST. F-nnn must be inserted into `.planning/audit/findings.json` surgically first (RESEARCH "finding-register gap").

---

### `e2e/specs/save-and-rsvp.spec.ts` (existing before/after net)

Lines 1-60: fixture imports `import { IDS, storageStateFor } from "../fixtures";`, `test.use({ storageState: storageStateFor("onboarded_student") })`, navigate by fixed seed id, and await the write response rather than the optimistic label:
```ts
await Promise.all([
  page.waitForResponse((r) => r.url().includes(`/api/events/${IDS.approvedEvent}/save`) && r.request().method() === "POST"),
  save.click(),
]);
```
Note the profile assertion exercises the RSC path (`src/app/profile/page.tsx`), not `/api/users/saved-events` — Pitfall 1. Anonymous-browse analog for Slice 2: `e2e/specs/anonymous-browse.spec.ts`. Env via `e2e/env.ts`; protected-route list via `e2e/fixtures.ts protectedRoutes()`.

## Shared Patterns

### Auth
**Source:** `src/server/context.ts:56-75`, `src/server/authz/requireUser.ts:27-35`. **Apply to:** save POST/DELETE, rsvp POST/DELETE, saved-events GET, calendar/events GET. Anonymous-tolerant (rsvp GET, friends GET) read `ctx.user` without guard.

### Error bodies
**Source:** `src/server/errors.ts:24-61`. Use helpers only where the resulting bytes equal today's; keep literal `"Internal server error"` outer catches. Always `console.error("<context>:", err)` before returning.

### Characterization discipline
Header from `callback/route.test.ts`; DEFECT from `friends-defect.test.ts`; hand-run mutation cycle per PRESERVE suite with evidence file; suites committed before the handler change (`git log -1 -- <handler>` proof).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Keyset cursor (`{sortValue, id}` base64) in `src/app/api/events/route.ts` | route logic | paginated read | Only defined in the skipped suite (`src/__tests__/api/events/get-events.test.ts`); no live implementation — use RESEARCH § Q(g) |

## Metadata

**Analog search scope:** `src/server/`, `src/app/api/events/`, `src/app/api/users/`, `src/app/auth/callback/`, `src/__tests__/api/events/`, `src/lib/`, `e2e/`
**Files scanned:** ~25
**Pattern extraction date:** 2026-09-22
