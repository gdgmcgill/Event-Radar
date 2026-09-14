# Architecture Research

**Domain:** Next.js 16 App Router + Supabase monolith on Vercel — foundation hardening of an existing app (not greenfield)
**Researched:** 2026-09-13
**Confidence:** HIGH (repo-grounded claims verified by reading the code on 2026-09-13; external doc claims from official Next.js / Vercel / Supabase docs; one caching interaction flagged as MUST-VERIFY-EMPIRICALLY)

> This document describes the **target** architecture Stage 3 should converge on, and how Stage 1 (audit) and Stage 4 (certification) attach to it. It is not a description of the current state — see `.planning/codebase/ARCHITECTURE.md` for that. Every recommendation below is anchored to a measured fact about this repo; the measurements are in "Current-State Measurements" so the audit can re-verify them rather than trust them.

---

## Current-State Measurements (taken 2026-09-13, re-verify in Stage 1)

These numbers drive every recommendation. The codebase map is dated 2026-03-05 and has drifted; these are fresh.

| Fact | Value | How measured |
|---|---|---|
| Route handlers | **94** `route.ts` (PROJECT.md says 92) | `find src/app -name route.ts \| wc -l` |
| Pages | **43** `page.tsx` | `find src/app -name page.tsx \| wc -l` |
| Route files importing the cookie server client | 86 | `grep -rl "@/lib/supabase/server" src/` |
| Route files importing `createServiceClient` | **22** route handlers + `auth/callback/route.ts` + **1 page** (`src/app/users/[id]/page.tsx`) + `src/lib/audit.ts` | `grep -rl createServiceClient` |
| Route files re-implementing a club membership/role check | **19** | `grep -rln club_members src/app/api` |
| Route files exporting a mutating handler (POST/PUT/PATCH/DELETE) | **50** | grep |
| ...of which call `checkBanStatus()` | **10** | grep |
| Route files calling `request.json()` with no schema library | **34** | grep; `zod` is **not** in `package.json` |
| `as any` occurrences inside `route.ts` files | **47** | grep |
| Files using `verifyAdmin()` | 26 (vs 24 files under `api/admin/`) | grep — so the set of admin-guarded routes ≠ the set of admin-path routes |
| Route/page files doing an inline `roles.includes("admin")` instead of `verifyAdmin()` | 5 route/page files incl. `api/events/[id]`, `api/events/create`, `api/admin/users/[id]/ban`, `api/moderation/reviews/...` | grep |
| `getSession()` used for anything | **1** site: `src/app/api/health/route.ts:160` (liveness probe, not access control) | grep — the March "getSession for auth checks" concern is **largely already fixed**; audit should confirm rather than re-fix |
| `console.*` calls | 162 across `src/` | grep |
| Structured logger / request ID | **none** | grep for `logger`/`x-request-id` returns only domain "requests" |
| Migrations | 45 files, 3 naming schemes (`001_`, `008b_`, `020_`, timestamped), 2 `remote_schema` dumps | `ls supabase/migrations` |
| `src/lib/supabase/types.ts` | 1508 lines, contains `__InternalSupabase: { PostgrestVersion: "13.0.5" }` — **this is CLI-generated output**, so the March "hand-written types" concern is likely stale | `head` |
| pg_cron referenced in migrations | 1 file (`20260313000002_recommendation_engine.sql`) | grep |
| `crons` key in `vercel.json` | **absent** — `/api/cron/send-reminders` and `/api/cron/send-feedback-requests` have **no Vercel schedule** | `grep -c crons vercel.json` → 0 |
| `vitest` installed | **NO** — `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/*` are all absent from `node_modules`. `vitest.config.ts` + `vitest.setup.ts` are **dead config**. | probed `node_modules/` |
| `jest` installed | yes, `testEnvironment: "node"`, no setup file, **no `jest-environment-jsdom`** → the 3 `.tsx` component tests are listed by `jest --listTests` (21 files) but cannot pass | `npx jest --listTests` |
| `tsconfig.json` `exclude` | `**/*.test.ts`, `**/*.test.tsx`, `internal`, `supabase/functions` → **CI type-check does not cover test code** | read |
| `vercel.json` headers | blanket `Cache-Control: s-maxage=60, stale-while-revalidate=300` on `/api/(.*)` | read |
| `next.config.js` headers | full security header block already present on `/(.*)`; `images.unoptimized: true` | read |
| Middleware matcher | matches `/api/*` (only `_next/static`, `_next/image`, `favicon.ico`, `auth/callback`, image extensions excluded) | read `src/middleware.ts` |

**Two behavioural facts read out of `src/middleware.ts` that shape the target design:**

1. The ban check runs on **every matched request including `/api/*`**, costs one `auth.getUser()` (network call to Supabase Auth) **plus** one `users` SELECT, and responds with `NextResponse.redirect("/banned")` — a **307 to an HTML page** even for an API request. A client `fetch` follows that redirect and receives `200 text/html`, not `403 application/json`.
2. The whole middleware body is wrapped in `try { ... } catch { return NextResponse.next({ request }) }`. **It fails open.** If the ban SELECT throws, a banned user proceeds. This is the single strongest argument for the layering below: middleware must never be the authorization boundary.

---

## Standard Architecture

### System Overview — Target State

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT  (browser)                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ pages/   │  │ hooks/   │  │ store/       │  │ contracts/  (shared) │  │
│  │ 43 x     │──│ SWR      │──│ useAuthStore │  │ zod schemas + types  │  │
│  │ page.tsx │  │ fetchers │  │ (Zustand)    │  │ ←── same file ──┐    │  │
│  └──────────┘  └──────────┘  └──────────────┘  └─────────────────│────┘  │
└────────────────────────────────│──────────────────────────────────│──────┘
                          fetch  │                                  │
┌────────────────────────────────▼──────────────────────────────────│──────┐
│ EDGE / PLATFORM                                                    │      │
│  ┌──────────────────────────────────────────────────────────────┐ │      │
│  │ middleware.ts   RING 1 — ADVISORY ONLY, FAILS OPEN           │ │      │
│  │  • session cookie refresh (the one thing only it can do)     │ │      │
│  │  • page-level redirects (UX)   • rate limit   • x-request-id │ │      │
│  │  NOT an authorization boundary. Never the last check.        │ │      │
│  └──────────────────────────────────────────────────────────────┘ │      │
│  ┌──────────────────────────────────────────────────────────────┐ │      │
│  │ Vercel CDN — caches ONLY what a handler explicitly opts in    │ │      │
│  └──────────────────────────────────────────────────────────────┘ │      │
└────────────────────────────────│──────────────────────────────────│──────┘
┌────────────────────────────────▼──────────────────────────────────│──────┐
│ src/app/  TRANSPORT LAYER  (94 route.ts + 43 page.tsx)             │      │
│   route.ts = parse → delegate → serialize.  Nothing else.          │      │
│   ┌──────────────────────────────────────────────────────────────┐ │      │
│   │ withRoute(handler, { auth, cache, contract }) ────────────────┼─┘      │
│   └──────────────────────────────────────────────────────────────┘        │
└────────────────────────────────│─────────────────────────────────────────┘
┌────────────────────────────────▼─────────────────────────────────────────┐
│ src/server/  SERVER CORE  (no React, no NextResponse below http.ts)       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ context.ts │ │ authz/     │ │ services/  │ │ errors.ts  │ │ obs/    │ │
│  │ ONE getUser│ │ RING 2 —   │ │ events     │ │ AppError → │ │ logger  │ │
│  │ ONE profile│ │ THE authz  │ │ clubs      │ │ HTTP map   │ │ sentry  │ │
│  │ per request│ │ boundary   │ │ rsvps      │ │            │ │ health  │ │
│  │ ban/roles/ │ │ FAILS      │ │ moderation │ │            │ │         │ │
│  │ club roles │ │ CLOSED     │ │ recs ...   │ │            │ │         │ │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────────────┘ └─────────┘ │
│        └──────────────┴──────────────┘                                   │
│                       │                                                   │
│  ┌────────────────────▼───────────────────────────────────────────────┐  │
│  │ src/server/db/                                                      │  │
│  │  userClient()      → cookie-bound, RLS ON      ← default, 100% use  │  │
│  │  anonClient()      → no cookies, RLS ON        ← public read paths  │  │
│  │  elevated/*.ts     → service role, RLS OFF     ← THE ONLY door      │  │
│  │     each export = one named, justified, audited operation           │  │
│  │     ESLint forbids importing lib/supabase/service.ts anywhere else  │  │
│  └────────────────────┬───────────────────────────────────────────────┘  │
└───────────────────────│──────────────────────────────────────────────────┘
┌───────────────────────▼──────────────────────────────────────────────────┐
│ SUPABASE / POSTGRES                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ RLS POLICIES   RING 3 — LAST LINE. Must hold with rings 1+2 removed│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  tables · SECURITY DEFINER helpers · compute_user_scores() · pg_cron      │
│  Storage buckets (event-images, avatars, logos) · events-webhook (Deno)   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Must NOT |
|---|---|---|
| `middleware.ts` (Ring 1) | Session cookie refresh; `x-request-id` minting; page redirects for UX (sign-in, onboarding, `/banned`); rate limiting | Be trusted for authorization. Do a DB read on every request. Fail open silently. |
| `src/app/**/route.ts` | HTTP: read params/body, call one service function, map `AppError`→status, stamp cache headers | Contain business rules, Supabase queries, role logic, or `try/catch`-to-500 boilerplate |
| `src/server/context.ts` | Exactly **one** `auth.getUser()` and **one** `users` profile read per request; expose `{ user, profile, roles, banState, clubRoles(clubId) }` | Throw on anonymous (public routes need it too) |
| `src/server/authz/` (Ring 2) | `requireUser`, `requireRole`, `requireNotBanned`, `requireClubRole(clubId, min)`, `canModerate` — pure predicates + throwing guards | Read cookies, build responses, or know about HTTP |
| `src/server/services/` | All Supabase queries; all business rules; returns domain objects or throws `AppError` | Import `next/server`, return `NextResponse`, or read `cookies()` directly |
| `src/server/db/elevated/` | Named service-role operations, each with a written justification comment | Grow. Every addition is a reviewed exception. |
| `src/contracts/` | zod schemas, one module per resource; request + response; `z.infer` types consumed by both client and server | Import anything from `src/server/` or `src/app/` |
| RLS policies (Ring 3) | Row visibility and write permission, independent of the app | Be the only check (403-vs-empty-result is a UX difference the app layer must own) |

**The single most important boundary rule:** *authorization decisions live in exactly one place (Ring 2), are enforced independently in the database (Ring 3), and are never inferred from the middleware matcher (Ring 1).*

---

## Recommended Project Structure

```
src/
├── app/                          # TRANSPORT ONLY
│   ├── api/**/route.ts           #   94 files → each shrinks to ~15-30 lines
│   ├── **/page.tsx               #   43 files → server pages call services directly
│   ├── middleware.ts             #   (stays at src/middleware.ts — Next convention)
│   └── auth/callback/route.ts    #   the one route that legitimately writes cookies + elevates
├── contracts/                    # NEW — shared client/server API contracts
│   ├── common.ts                 #   Pagination, Cursor, ErrorResponse, Uuid, McGillEmail
│   ├── events.ts                 #   EventCreateInput, EventListQuery, EventResponse
│   ├── clubs.ts                  #   ClubCreateInput, MemberRoleInput, InviteInput
│   ├── rsvps.ts  reviews.ts  admin.ts  recommendations.ts
│   └── openapi.ts                #   generates the OpenAPI doc FROM the schemas
├── server/                       # NEW — the server core. Import-restricted.
│   ├── context.ts                #   requestContext(req) → RequestContext
│   ├── http.ts                   #   withRoute(), json(), cachePolicy(), errorToResponse()
│   ├── errors.ts                 #   AppError taxonomy: Unauthorized, Forbidden, NotFound,
│   │                             #     Validation, Conflict, RateLimited, Upstream
│   ├── authz/
│   │   ├── guards.ts             #   requireUser/requireRole/requireNotBanned/requireClubRole
│   │   └── policies.ts           #   pure: canEditEvent(ctx, event) → boolean
│   ├── services/
│   │   ├── events.ts  clubs.ts  rsvps.ts  savedEvents.ts  reviews.ts
│   │   ├── users.ts   notifications.ts    moderation.ts   recommendations.ts
│   │   └── ingestion.ts          #   scraper/webhook-facing operations
│   ├── db/
│   │   ├── index.ts              #   userClient() / anonClient()
│   │   └── elevated/             #   ONE file per justified service-role operation
│   │       ├── README.md         #   the register: op, reason, tables, who reviewed
│   │       ├── upsertAuthUser.ts       # auth/callback: writes before a session exists
│   │       ├── writeAuditLog.ts        # audit rows must be unforgeable by the actor
│   │       ├── banUser.ts              # admin acts on another user's row
│   │       └── cronJobs.ts             # no session exists in a cron invocation
│   └── obs/
│       ├── logger.ts             #   structured JSON, request-scoped child logger
│       ├── sentry.ts             #   thin wrapper; init lives in instrumentation.ts
│       └── health.ts             #   liveness vs readiness vs operational status
├── lib/                          # PURE helpers only (keep; prune)
│   ├── supabase/{client,server,service,types}.ts   # factories; service.ts becomes private
│   ├── utils.ts constants.ts tagMapping.ts timezone.ts sanitize.ts
│   └── classifier*.ts diversity.ts experiments.ts  # already pure — good, leave alone
├── components/  hooks/  store/   # CLIENT (unchanged shape)
└── types/index.ts                # domain types; DB row types come from lib/supabase/types.ts
instrumentation.ts                # NEW — Sentry server init + onRequestError
supabase/
├── migrations/                   # frozen history + one reconcile baseline + timestamped only
├── seed/
│   ├── 00_functional.sql         # 7 personas, fixed UUIDs, every status/role/edge case
│   ├── 10_adversarial.sql        # malformed, unsafe links, dupes, DST, expired, cross-tenant
│   └── 20_scale.sql              # generate_series: 1000s of users/clubs/events/rsvps
└── tests/database/               # pgTAP, one rls_<table>.test.sql per table
tests/
├── integration/                  # route handlers against LOCAL supabase (real RLS)
└── e2e/                          # Playwright persona journeys against STAGING
load-tests/                       # existing k6 — keep, extend
```

### Structure Rationale

- **`src/server/` as a sibling of `src/app/`, not `src/lib/server/`.** A top-level directory is what makes the boundary *mechanically enforceable*. Add to `eslint.config.mjs`:
  ```js
  // src/server/** may not import from next/server or src/app
  // src/app/** may not import @/lib/supabase/service
  // src/contracts/** may not import @/server or @/app
  {
    files: ["src/app/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      "@/lib/supabase/service", "@/lib/supabase/service.*"
    ]}]}
  }
  ```
  This is the difference between a convention that decays and a rule CI enforces. It is the only reason the "22 route files import the service client" number can be driven to zero and *stay* at zero.
- **`src/contracts/` above both.** It is imported by client components (form validation) and route handlers (body parsing) and the OpenAPI generator. If it depended on `src/server/`, importing a schema into a client component would drag the Supabase service key path into the browser bundle.
- **`src/server/db/elevated/` instead of free `createServiceClient()` calls.** Today service-role usage is a grep. After this it is a directory listing with a README register — countable, diffable, and reviewable. `src/app/users/[id]/page.tsx` calling `createServiceClient()` twice inside a **page component** is the concrete case this prevents.
- **`src/lib/` survives.** `classifier.ts`, `diversity.ts`, `experiments.ts`, `sanitize.ts`, `dateValidation.ts` are already pure functions with tests. Don't churn them.
- **`supabase/seed/` and `supabase/tests/` under `supabase/`, not `tests/`.** They are executed by the Supabase CLI (`supabase db reset` picks up seeds; `supabase test db` picks up `tests/database/`), so they must live where the CLI looks.

---

## Architectural Patterns

### Pattern 1: One request context, computed once

**What:** A single object built at the top of every handler that owns the identity facts, so nothing below it touches `cookies()` or `auth.getUser()`.

**Why here:** Today a ban-checked admin request can perform **three** `auth.getUser()` network round-trips and **two** `users` SELECTs — middleware (getUser + ban SELECT), `checkBanStatus()` (getUser + ban SELECT), `verifyAdmin()` (getUser + roles SELECT) — before the handler runs its own query. `verifyAdmin()` and `checkBanStatus()` each independently call `await createClient()` then `getUser()`.

**Trade-offs:** Adds one indirection; in exchange it removes a latency floor, makes authorization testable without a Next request scope, and gives every log line a user/role field for free.

```ts
// src/server/context.ts
export interface RequestContext {
  requestId: string;
  supabase: SupabaseClient<Database>;     // cookie-bound, RLS ON
  user: User | null;                      // from auth.getUser() — verified, never getSession()
  profile: { roles: UserRole[]; banned_at: string | null; ban_expires_at: string | null } | null;
  log: Logger;
  clubRole(clubId: string): Promise<ClubRole | null>;  // memoized per request
}

export async function requestContext(req: NextRequest): Promise<RequestContext> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const supabase = await userClient();
  const { data: { user } } = await supabase.auth.getUser();   // ONE call
  const profile = user
    ? (await supabase.from("users")
        .select("roles, banned_at, ban_expires_at").eq("id", user.id).single()).data
    : null;                                                    // ONE read
  return { requestId, supabase, user, profile, log: logger.child({ requestId, userId: user?.id }), clubRole: memo(...) };
}
```

> **Implementation note:** prefer passing the context explicitly through `withRoute` over React `cache()`. Explicit passing means a service function can be unit-tested by constructing a context literal, with no Next request scope. `cache()` is a fine optimization *inside* `requestContext` later, but should not be the mechanism the tests depend on.

### Pattern 2: `withRoute` — the transport wrapper that makes defaults safe

**What:** A higher-order function every `route.ts` uses. Auth, validation, cache policy, logging, and error mapping are **declared**, not re-implemented 94 times.

**Why here:** The current failure mode is *inconsistency*, not absence. Ban enforcement exists in 10 of 50 mutating route files. Admin checks are split between `verifyAdmin()` (26 files) and inline `roles.includes("admin")` (5 files). Two endpoints fail open (`calculate-popularity` without `ADMIN_API_KEY`; `recommendations/analytics` with no role check at all). A wrapper converts "did the author remember?" into "did the author declare?" — and an absent declaration is a **type error**, not a silent hole.

**Trade-offs:** One more abstraction to learn, and stack traces get one frame deeper. Worth it at 94 handlers; it would be overkill at 10.

```ts
// src/app/api/clubs/[id]/members/route.ts — target shape
import { withRoute } from "@/server/http";
import { listMembers } from "@/server/services/clubs";
import { ClubMembersResponse } from "@/contracts/clubs";

export const GET = withRoute(
  { auth: "user", cache: "personalized" },            // required keys — no default-open
  async (ctx, { params }) => {
    const { id } = await params;
    await ctx.require.clubRole(id, "member");          // Ring 2. Throws Forbidden.
    return ClubMembersResponse.parse(await listMembers(ctx, id));
  }
);
```

Compare to today's version of that same file: 78 lines, its own `getUser()`, its own membership SELECT, its own N+1-avoidance `userMap`, its own `catch {}` → 500, and no declared cache policy — so it inherits `s-maxage=60` from `vercel.json`.

**Auth modes:** `"public" | "user" | "role:admin" | "club:member" | "club:organizer" | "club:owner" | "cron" | "webhook"`. The value is a required field, so adding a new route forces an explicit decision — this is the mechanism that closes the fail-open class of bug permanently.

### Pattern 3: Three-ring defense in depth, with each ring independently testable

| Ring | Where | Failure mode | Purpose | Stage 4 test |
|---|---|---|---|---|
| 1 | `middleware.ts` | **Open** (by design — `catch → next()`) | Session refresh, UX redirects, rate limit | E2E: unauthenticated user hitting `/my-events` lands on `/?signin=required` |
| 2 | `src/server/authz/` | **Closed** | The authorization decision; correct status codes | Integration: each role × each endpoint → expected 200/401/403 |
| 3 | RLS policies | **Closed** | Holds even if the app is wrong or bypassed | pgTAP: allow/deny per table, run with rings 1+2 absent |

Supabase's own guidance is explicit that RLS is the layer that protects data *"when it is reached through third-party tooling"* — i.e. it is the backstop, and app-layer authz is still required for correct HTTP semantics (a 403 and an empty list are different products).

**The concrete rule this repo needs written down:** *a route is not correctly protected if removing its `auth:` declaration would still return the right data.* If deleting Ring 2 changes nothing, Ring 3 is missing. If deleting Ring 3 changes nothing, Ring 3 is missing.

**Two corrections this pattern forces on the current middleware:**
- Ban enforcement must branch on path shape: `/api/*` → `403 {error:"Account suspended"}`; pages → `redirect("/banned")`. Today both get a 307 to HTML, so a client `fetch` sees `200 text/html`.
- The per-request `users` SELECT should move out of middleware into `requestContext` (where it is needed anyway), leaving middleware to do only what *only* it can do: refresh the session cookie.

### Pattern 4: Cache classification as code, not as a path glob

**What:** Delete the blanket `vercel.json` header. Every route declares a policy; a helper stamps the headers; a test asserts the invariant.

**The mechanics (verified against Vercel docs):** A response is cacheable by the Vercel CDN only if the request is GET/HEAD with **no `Authorization` header**, status is in {200, 404, 410, 301, 302, 307, 308}, body ≤10 MB, and the response has **no `set-cookie`** and no `private`/`no-cache`/`no-store`. **A request `Cookie` header does *not* prevent caching and is *not* part of the cache key unless named in `Vary`.** Separately, `Cache-Control` returned *by the function* **overrides** headers declared for the same route in `vercel.json`/`next.config.js`.

**Why this is a live risk here and not a theoretical one:** Next.js changed the default caching of `GET` Route Handlers *from static to dynamic* in v15 ("`v15.0.0-RC` — The default caching for `GET` handlers was changed from static to dynamic"), so **nothing in this app opts into CDN caching except the `vercel.json` glob**. That glob covers `/api/recommendations`, `/api/users/saved-events`, `/api/notifications`, `/api/my-clubs`, `/api/health` — all personalized — and the only thing standing between them and a cross-user cache hit is whether the response happens to carry a `Set-Cookie`. Middleware only sets cookies *when the session is actually refreshed* (`sessionRefreshed` flag), so the steady-state request from a logged-in user emits **no** `Set-Cookie`.

> **MUST VERIFY EMPIRICALLY IN STAGE 1 — do not treat as settled.** It is genuinely ambiguous whether Next.js's own `cache-control: private, no-store` on a dynamic route handler response wins over the `vercel.json` header at the routing layer. Resolve it with evidence, not reasoning:
> ```bash
> # against production, with a real session cookie, twice
> curl -sI https://<prod>/api/recommendations -H "Cookie: sb-<ref>-auth-token=..." \
>   | grep -iE 'cache-control|x-vercel-cache|set-cookie|age'
> ```
> `x-vercel-cache: HIT` on the second call, or any `s-maxage` on a personalized response, is a **critical** finding. `BYPASS`/`MISS` with `no-store` downgrades it to a latent hazard that still must be removed. Record the raw output as audit evidence either way.

**Target policy set:**

| Policy | Headers | Applies to (examples from this repo) |
|---|---|---|
| `public-cacheable` | `public, s-maxage=60, stale-while-revalidate=300` + `Vercel-CDN-Cache-Control` for a longer edge TTL | `/api/events` (anonymous), `/api/events/popular`, `/api/events/happening-now`, `/api/clubs`, `/api/clubs/featured`, `/api/clubs/trending` |
| `public-uncached` | `no-store` | search-heavy or freshness-critical public reads |
| `personalized` | `private, no-store` | `/api/recommendations`, `/api/users/saved-events`, `/api/notifications*`, `/api/my-clubs`, `/api/user/*`, `/api/users/me/*`, `/api/events/my-events`, `/api/events/following`, `/api/events/friends-*` |
| `mutating` | `no-store` | all 50 mutating route files |
| `admin` | `private, no-store` | all 24 `api/admin/*` + `api/moderation/*` |
| `ops` | `no-store` | `/api/health`, `/api/cron/*` |

**Invariant test (Stage 4, cheap and high-value):** for every route in the classification table, issue the request as an authenticated persona and assert `cache-control` contains `private` or `no-store` unless the route is declared `public-cacheable`; and for `public-cacheable` routes, assert the handler never reads `ctx.user`. That second assertion is what stops a future personalization from silently leaking into a cached route.

**Also:** move the header config out of `vercel.json` into `next.config.js`, which already has a `headers()` block — Vercel's docs say Next.js projects should use `next.config.js` rather than `vercel.json` for headers. Fewer places to look.

### Pattern 5: Contracts generated once, consumed three ways

**What:** zod schema is the single source; the TypeScript type, the runtime parse, and the OpenAPI doc all derive from it.

**Why here:** 34 route files call `request.json()` with no schema (zod is not installed). Separately, `/docs` serves a hand-written Swagger JSDoc doc via `next-swagger-doc` + `redoc` + `swagger-ui-react` — two heavyweight dependencies Stage 2 wants to prune, kept alive by annotations that can drift from the handler silently.

```ts
// src/contracts/events.ts — one file, three consumers
export const EventCreateInput = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  starts_at: z.string().datetime({ offset: true }),   // settles the dual-date schema
  ends_at:   z.string().datetime({ offset: true }).optional(),
  location: z.string().max(300),
  tags: z.array(z.nativeEnum(EventTag)).min(1).max(5),
  club_id: z.string().uuid().optional(),
}).refine(v => !v.ends_at || v.ends_at > v.starts_at, { message: "ends_at must follow starts_at" });

export type EventCreateInput = z.infer<typeof EventCreateInput>;
```

**Incremental adoption — the safe three-step, because behavior preservation is the program's core value:**
1. **Characterize.** Write a test capturing what the handler accepts *today*, including the sloppy cases (extra keys, `""` vs `null`, string-vs-number ids). This is the behavioral baseline.
2. **Shadow.** Add the schema in non-enforcing mode: `const r = Schema.safeParse(body); if (!r.success) ctx.log.warn({ issues: r.error.issues }, "contract_shadow_reject");` — then ship and read the logs for one deploy cycle. Real clients send shapes you did not predict; this is how you find them without a 400 storm.
3. **Enforce.** Flip to `.parse()`; `AppError.Validation` maps to `400` with `{ error, issues }`.

Skipping step 2 is how a foundation refactor breaks a workflow that used to work — exactly the failure condition PROJECT.md names.

### Pattern 6: Migration reconciliation by baseline + repair, never by renaming

**What:** Accept the 45 existing files as immutable history. Add one reconciliation baseline. Enforce one naming scheme *going forward only*.

**Why never rename:** The migration version is the filename prefix, and it is the primary key in the remote `supabase_migrations.schema_migrations` table. Renaming `008b_add_is_admin_to_users.sql` changes its version and makes the remote history permanently inconsistent with the folder.

**The sequence (Stage 1 does 1–2 read-only; Stage 3 does 3–5):**
1. `supabase migration list` against production → three buckets: local-only (never applied), remote-only (applied, file deleted), present-in-both.
2. `supabase db pull` into a **scratch branch** → the true production schema as one dump. Apply the 45 files to a fresh local DB, then `supabase db diff` local-vs-dump → **the drift report**. This is a Stage 1 deliverable and it is read-only against prod.
3. `supabase migration repair <version> --status applied|reverted` to align history rows — `--status reverted` for remote rows with no local file, `--status applied` for files already reflected in prod but absent from history.
4. Add `supabase/migrations/<ts>_reconcile_baseline.sql` containing **only** the diff from step 2. Everything before it is archival; everything after is timestamped-only (`supabase migration new`).
5. `supabase gen types typescript --local > src/lib/supabase/types.ts` and add `git diff --exit-code src/lib/supabase/types.ts` to CI. Generating from **local-after-migrations** (not from prod) is what proves migrations ≡ types. A separate staging job proves staging ≡ migrations.

> `types.ts` already carries the CLI's `__InternalSupabase` marker, so it is probably already generated and the 2026-03 concern is stale. **The audit's job is to regenerate and diff, not to assume.** The 47 `as any` casts in `route.ts` files are the real signal — each one is either a genuine type gap or a leftover from the hand-written era, and the diff tells you which.

---

## Data Flow

### Request Flow — target

```
Browser fetch("/api/clubs/abc/members")
   │
   ▼ RING 1  middleware.ts  (advisory, fails open)
   │   rate limit → mint x-request-id → supabase.auth.getUser() → refresh cookie if needed
   │   page-shaped redirects only; API paths pass through with headers attached
   ▼ Vercel CDN  (consults Cache-Control emitted by the function; personalized ⇒ no-store)
   ▼ TRANSPORT  app/api/clubs/[id]/members/route.ts
   │   withRoute({ auth:"club:member", cache:"personalized" })
   │     1. requestContext(req)      → ONE getUser(), ONE users read, child logger
   │     2. contract.parse(input)    → AppError.Validation on failure
   ▼ RING 2  server/authz/guards.ts      requireClubRole(ctx,"abc","member")
   │     → ctx.clubRole("abc") (memoized) → throws AppError.Forbidden ⇒ 403
   ▼ SERVICE  server/services/clubs.ts   listMembers(ctx, "abc")
   │     single joined query via ctx.supabase (RLS ON) — no `as any`, no fabricated objects
   ▼ RING 3  Postgres RLS
   │     club_members SELECT policy re-evaluates (select auth.uid()) independently
   ▼ rows → domain objects → ResponseSchema.parse() → json() + cachePolicy("personalized")
   ▼ one structured log line: { requestId, route, method, status, durationMs, userId, role }
```

Error path: every `AppError` carries a code; `errorToResponse` maps `Unauthorized→401, Forbidden→403, NotFound→404, Validation→400, Conflict→409, RateLimited→429, *→500`. Unexpected throws go to Sentry with the `requestId` attached, and the client gets `500 { error: "...", requestId }` so a user report maps to a log line.

### The service-role path (deliberately narrow)

```
route.ts ──▶ service ──▶ server/db/elevated/banUser.ts ──▶ service-role client ──▶ Postgres (RLS bypassed)
                                     ▲
                       requireRole(ctx,"admin") already passed;
                       writeAuditLog() is called by the same elevated module,
                       so an elevated write cannot happen without an audit row
```

Pairing the elevated operation with its audit write **inside the same module** is what makes "every service-role usage is auditable" a structural property rather than a code-review habit. `src/lib/audit.ts` already uses the service client — it becomes one of the elevated modules rather than a free import.

### State management (client — largely unchanged, one correction)

```
AuthProvider ──initialize()──▶ useAuthStore (Zustand)  ◀──onAuthStateChange── supabase browser client
      │                              │
      │                       roles, interest_tags, ban state
      ▼                              ▼
  components ◀── SWR hooks ──▶ fetch(/api/*) ──▶ transport layer
```

The store is **display state, not authorization state**. `isAdmin(user)` from `src/lib/roles.ts` may hide a nav item; it must never be the reason a mutation succeeds. Today `src/app/admin/layout.tsx` and `src/app/moderation/layout.tsx` do client-visible role checks — keep them for UX, but Stage 4 must prove that calling the underlying admin API directly as a non-admin returns 403.

### Key data flows to settle during Stage 3

1. **Event read.** Today: `select('*')` then synthetic `club` objects fabricated from an `organizer` string, plus a dual `start_date|event_date` fallback and two competing tag-mapping implementations (an inline `Record` in `api/events/route.ts` with a silent fallback to `EventTag.SOCIAL`, and `src/lib/tagMapping.ts`). Target: one joined select, one date schema, one tag mapper, one `EventResponse` contract. This flow is read by ~8 endpoints and most of the 43 pages, so it must be settled before anything downstream.
2. **Ban/session.** Target: middleware refreshes only; `requestContext` computes ban state once; `requireNotBanned` is the default for every mutating route via `withRoute`, not an opt-in call 10 of 50 handlers remember.
3. **Recommendations.** `compute_user_scores()` on pg_cron every 6h → `user_scores` → `/api/recommendations` → MMR re-rank → client. The *architectural* requirement is freshness observability: expose `computed_at` age so a silently-dead cron job is detectable.
4. **Ingestion.** Apify → `classifier-pipeline` → HMAC-signed `events-webhook` (Deno edge function) → `events` with `status:"pending"` and content-hash dedup. The edge function is **excluded from `tsconfig.json`** and has its own Deno test — keep it out-of-process, but add it to CI explicitly (`deno check`) so "excluded from tsconfig" doesn't mean "unverified".

---

## Build Order for Stage 3 Slices

PROJECT.md specifies both "bottom-up (schema → types → auth → services → validation → endpoints → routing → pages → performance → observability)" and "tested vertical slices". These reconcile cleanly: **the bottom-up list is the order of layers *within* a slice; the slices are ordered by dependency and blast radius.** Each slice walks the full stack for one workflow.

### F0 — Foundations (horizontal, unavoidable, keep small)

A vertical slice cannot "refactor one layer for one workflow" if the layer does not exist yet. Two horizontal pieces come first, and are proven by Slice 1 rather than by themselves.

- **F0a — Schema truth.** Migration reconciliation (Pattern 6), generated types + CI drift gate, RLS policy inventory per table, index audit on every column any policy filters on. *Everything types against this; doing it later means redoing every slice.*
- **F0b — The seam kit, applied to zero routes.** `context.ts`, `http.ts` (`withRoute`, `cachePolicy`), `errors.ts`, `authz/guards.ts` (signatures, thin bodies), `obs/logger.ts`, `contracts/common.ts`, ESLint import boundaries, and the test harness: Jest with projects (`unit`=node, `dom`=jsdom, `integration`=node+local Supabase), `supabase/tests/database/` wired to `supabase test db`, `supabase/seed/00_functional.sql` with the 7 personas at fixed UUIDs.
  *Test-runner decision, with evidence for Stage 1 to confirm:* **keep Jest, delete Vitest.** `vitest`, `@vitejs/plugin-react`, `jsdom`, and `@testing-library/*` are **not installed** — `vitest.config.ts` and `vitest.setup.ts` are dead files. Jest is installed and lists 21 test files, but `testEnvironment: "node"` with no `jest-environment-jsdom` means the 3 `.tsx` component tests cannot pass. So the work is: add `jest-environment-jsdom` + `@testing-library/react`, add a `test` script (there is none), delete the Vitest files, and stop excluding `**/*.test.ts*` from `tsconfig.json` so CI type-checks tests too.

### Slice order

| # | Slice | Surface | Why here | Depends on |
|---|---|---|---|---|
| 1 | **Saved events + RSVP** | `/api/events/[id]/rsvp`, `/api/events/[id]/save`, `/api/users/saved-events`, `/my-events` | **Smallest true end-to-end workflow.** User-owned rows only — no cross-tenant authz, no service role, no admin. Already has tests (`__tests__/api/events/rsvp.test.ts`) to characterize against, and a known perf bug (RSVP counts loaded as rows then `.filter().length`) that makes it a clean demonstration of characterize → refactor → verify. If the seam is wrong, you find out here at minimum cost. | F0 |
| 2 | **Event read path** | `/api/events`, `/api/events/[id]`, `popular`, `happening-now`, `featured`, `export`, `calendar/events`; home, `/events/[id]`, `/categories`, `/calendar` | Highest traffic and **every later slice reads events**. Settles the three things that block everything downstream: dual date schema, duplicate tag mapping, fabricated club objects. Unblocks the cache reclassification (this is where `public-cacheable` actually pays). Anonymous-accessible, so it is testable without auth fixtures. | 1 |
| 3 | **Auth · session · ban · onboarding** | `middleware.ts`, `auth/callback`, `auth/signout`, `requireUser`, `requireNotBanned`, `/banned`, `/onboarding` | Deliberately **not first**, despite being the lowest layer. Highest blast radius in the program — a mistake locks out every user, including you. Slices 1–2 give you working integration + E2E coverage that will *catch* that mistake. Also: `auth/callback` has **zero tests** and 3 `as any` casts, so it needs the harness from F0b + a proven seam before it is safe to touch. Fixes here: 403-JSON vs redirect for `/api`, middleware stops failing open on authz, per-request identity consolidation. | 1, 2 |
| 4 | **Club authorization + membership** | `/api/clubs/**` (19 files re-implement club-role checks), `/api/my-clubs`, `/api/organizer-requests`, `/my-clubs`, `/clubs/[id]`, `/invites/[token]` | The largest cross-tenant risk surface, and the one where RLS and app authz must agree exactly. Needs `requireUser` from slice 3 before `requireClubRole` can be built on it. Collapsing 19 hand-rolled checks into one guard is the single biggest consistency win in the program. | 3 |
| 5 | **Admin · moderation · service-role containment** | 24 `api/admin/*`, `api/moderation/*`, `lib/admin.ts`, `lib/audit.ts`, `/moderation/**` | Admin operations act **on** clubs and events, so their authorization model only makes sense once 3 and 4 define it. This is where the 22 route-level `createServiceClient()` imports move behind `server/db/elevated/`, `verifyAdmin()` becomes `requireRole("admin")`, the 5 inline `roles.includes("admin")` checks are removed, and the two fail-open endpoints (`calculate-popularity` without `ADMIN_API_KEY`; `recommendations/analytics` with no role check) are closed. Admin routes also currently bypass rate limiting entirely — fix it here with a generous limit. | 3, 4 |
| 6 | **Recommendations · interactions · notifications · cron · webhook** | `/api/recommendations/**`, `/api/interactions`, `/api/notifications/**`, `/api/cron/*`, `events-webhook` | The asynchronous edge: correctness is time-dependent and hardest to assert, so certify everything synchronous first. Depends on events (2) for the item model and users (3) for identity. Resolve here: the **missing `crons` key in `vercel.json`** — two cron route handlers exist with no Vercel schedule, so either they are externally triggered or they never run, and the audit must say which. Add pg_cron and scraper freshness to the ops health endpoint. | 2, 3 |
| 7 | **Close-out** (not a slice) | `vercel.json`, `next.config.js`, `instrumentation.ts`, all routes | Only now is every route classified, so the blanket `/api/*` cache header can be deleted safely. Wire Sentry `onRequestError`, sweep remaining `console.*` (162) to the structured logger, clear residual `as any` (47), delete dead config. | 1–6 |

```
                    F0a schema+types ──┐
                                       ├──▶ 1 saved/RSVP ──▶ 2 event read ──┬──▶ 3 auth/ban ──▶ 4 clubs ──▶ 5 admin ──┐
                    F0b seam kit ──────┘                                     └──▶ 6 recs/cron/webhook ────────────────┴──▶ 7 close-out
```

**The rule that makes each slice independently testable:** a slice is done when its workflow passes at all three rings *with the other slices untouched* — pgTAP allow/deny for its tables, integration tests for its endpoints across all 7 personas, and one E2E journey. Nothing in slice N may require slice N+1 to be finished. That is what lets you stop between slices without leaving the app in a half-migrated state — which matters because "if a foundation change breaks a workflow that worked before, the program has failed."

---

## How Stages 1 and 4 Map onto This Structure

The target architecture doubles as the audit's inventory schema and the certification's test plan. Same rows, three columns.

| Target component | Stage 1 inventories (read-only) | Stage 4 exercises |
|---|---|---|
| `middleware.ts` (Ring 1) | Matcher coverage vs. actual protected set; the fail-open `catch`; per-request DB read cost; the 307-to-HTML ban response for `/api` | E2E: anonymous → protected page redirects; banned persona gets 403 JSON from API and `/banned` from pages; rate limit returns 429 |
| Transport (94 routes) | Per-route table: method, auth requirement, role, personalization, cache policy today, validation present, dead/duplicate | Every route called as all 7 personas; expected status asserted; every page smoke-tested |
| `context.ts` | Count of `getUser()` + profile reads per request for a representative admin call (expect 3 + 2) | Assert ≤1 auth round-trip per request under load (k6) |
| `authz/` (Ring 2) | The 26 `verifyAdmin` files vs 24 admin-path files vs 5 inline role checks vs 19 club-role reimplementations; the 2 fail-open endpoints | Role matrix: `roles × endpoints → {200,401,403}`; cross-club access attempts; privilege escalation via direct API call while UI hides the control |
| RLS (Ring 3) | Policy inventory per table; tables with RLS off; policy columns without an index; `auth.uid()` not wrapped in `(select ...)` | pgTAP `rls_<table>.test.sql` for **every** table: `tests.rls_enabled('public')`, `results_eq` for visibility, `lives_ok`/`throws_ok(...,'42501')` for write allow/deny |
| `db/elevated/` | The 22 route files + 1 **page** (`users/[id]/page.tsx`) using the service client, each with a yes/no on "is RLS bypass actually required here?" | Assert the count of modules importing `lib/supabase/service` is exactly the elevated register; every elevated op writes an `admin_audit_log` row |
| `contracts/` | The 34 handlers parsing unvalidated JSON; the 47 `as any` in routes; drift between Swagger JSDoc and handlers | Adversarial dataset: malformed payloads, oversize strings, wrong types, unsafe links, injection-ish `%`/`_` in `ilike` search, upload abuse → all 400, never 500 |
| Cache policy | Per-route classification + **the empirical curl** (`x-vercel-cache`, `cache-control`, `set-cookie`) against production for at least `/api/recommendations`, `/api/users/saved-events`, `/api/notifications`, `/api/health` | Invariant test: no authenticated response carries `s-maxage`; `public-cacheable` handlers never read `ctx.user` |
| Migrations / types | `supabase migration list` buckets; `db pull` + `db diff` drift report; regenerate `types.ts` and diff | `supabase db reset` from migrations + seed succeeds from scratch; `gen types` diff is empty in CI; staging matches migrations |
| `obs/` | 162 `console.*` across `src/`; no logger, no request IDs, no Sentry; `/api/health` does auth + memory checks and is under the blanket cache header | `/api/health` liveness under load; ops endpoint reports pg_cron last-run age, `user_scores` freshness, scraper last-ingest age, webhook signature-reject count |
| Cron / webhook | **No `crons` key in `vercel.json`** — determine whether `send-reminders` / `send-feedback-requests` are externally triggered or dead; `CRON_SECRET` bearer check; edge function excluded from `tsconfig` | Cron invoked without/with bad/with good secret → 401/401/200; webhook with bad HMAC → rejected and counted |
| Test harness | 21 files under Jest; Vitest config present but **package not installed**; 3 `.tsx` tests unrunnable under `testEnvironment: "node"`; no `test` script; tests excluded from `tsc` | Single runner, green; CI runs `test` (it does not today — CI is lint + tsc + build only) |

### Environment ladder

| Environment | Source of truth for | Never |
|---|---|---|
| **Local** (`supabase/config.toml`, `supabase db reset`) | Migrations apply from zero; RLS pgTAP; integration tests against a real Postgres with real policies | Persist state between runs — reset per suite for determinism |
| **Staging** (existing project) | E2E persona journeys; deploy/rollback/backup drill; k6 load against the scale dataset; staging ≡ migrations | Share credentials with production |
| **Production** | Nothing is written by tests. Read-only verification: health/ops endpoint, the cache-header curl, `migration list`, monitoring/alert validation | **Receive any synthetic data** (hard constraint) |

Seeds live in `supabase/seed/` as idempotent SQL with **fixed UUIDs per persona**, so pgTAP (`tests.authenticate_as('organizer@mail.mcgill.ca')`), integration tests, and Playwright all address the same rows. The 7 personas from PROJECT.md become 7 constants in one file — that file is the interface between the three test layers, and generating it randomly would break all three.

The existing `load-tests/k6-online-users.js` and `k6-onboarding.js` stay as-is and run against staging loaded with `20_scale.sql`. Add one k6 scenario per slice as it lands, so the load suite grows with the refactor instead of being written at the end.

---

## Scaling Considerations

Realistic framing: this serves one campus. McGill is ~40k students; plausible peak is low thousands of concurrent users around a big event. Nothing here needs to be distributed.

| Scale | Adjustments |
|---|---|
| 0–1k MAU (today) | Current monolith shape is correct. The wins are correctness and per-request round-trips, not throughput. |
| 1k–20k MAU (realistic ceiling) | Collapse the 3 `getUser()` calls to 1; index every RLS policy column; replace the in-memory rate limiter with Upstash/Vercel KV; enable `public-cacheable` on the anonymous event read path so the biggest endpoint mostly serves from the CDN. |
| 20k+ MAU | Only then consider `use cache` + Cache Components for the public event pages, and moving recommendation recomputation from a 6h batch to incremental. |

**Bottlenecks in the order they will actually bite:**
1. **Per-request auth round-trips.** Middleware `getUser()` + ban SELECT, then `checkBanStatus()` + `verifyAdmin()` repeating both. Fixed by `requestContext` in F0b/slice 3 — this is latency on *every* request, including anonymous page loads.
2. **Unindexed RLS policy columns.** Supabase's guidance is blunt: an unindexed policy filter column turns a read into a sequential scan, evaluated per candidate row. With ~18 tables carrying policies this is the most likely source of a sudden cliff. `20260316000004_fk_indexes_and_cleanup.sql` suggests some of this was already addressed — verify coverage against the *policy* predicates, not just the FKs.
3. **`select('*')` + count-in-JS.** The events list loads all columns; RSVP counts load all rows and `.filter().length`. Fine at hundreds of rows, quadratic-feeling at thousands. Slices 1 and 2.
4. **In-memory rate limiter.** Per-instance on Vercel, so the effective limit is `N_instances × limit` and collapses to near-zero enforcement under scale-out. Not urgent at current traffic; must be *documented as a known limit* rather than silently assumed to work.
5. **Recommendation staleness.** 6h pg_cron means a new user's scores may not exist for hours; the popularity fallback covers it. Architecturally the requirement is *observability* of the cron, not a faster cron.

---

## Anti-Patterns

### Anti-Pattern 1: Treating the middleware matcher as the authorization boundary

**What people do:** Add a path to `PROTECTED_ROUTES` and consider the route protected.
**Why it's wrong, concretely here:** `src/middleware.ts` wraps its entire body in `catch { return NextResponse.next({ request }) }` — it **fails open**. It also cannot express "this user may edit *this* club". And the matcher regex excludes `auth/callback` and any path ending in an image extension, so protection silently depends on a URL's spelling.
**Do this instead:** Middleware does session refresh, request IDs, rate limiting, and *UX* redirects. Every authorization decision is re-made in Ring 2 inside the handler and independently enforced by Ring 3 in the database.

### Anti-Pattern 2: Reaching for the service client to make a query work

**What people do:** A query returns empty because RLS blocks it, so swap in `createServiceClient()`.
**Why it's wrong:** It converts an RLS *bug* into a permanent RLS *bypass*. It is already load-bearing in 22 route handlers and — most tellingly — inside a **page component**, `src/app/users/[id]/page.tsx`, which calls `createServiceClient()` twice while rendering a public-ish profile.
**Do this instead:** An empty result under RLS is a policy bug or a missing app-level join — fix the policy. If elevation is genuinely required (writing before a session exists in `auth/callback`; writing an audit row the actor must not be able to forge; a cron with no session), add a named module under `server/db/elevated/` with a written justification, and let ESLint reject the import anywhere else.

### Anti-Pattern 3: Big-bang "add zod to all 34 handlers"

**What people do:** One PR that adds strict schemas everywhere.
**Why it's wrong:** Real clients send shapes you did not predict (extra keys, `""` for `null`, numeric strings). Strict-on-day-one turns a silent tolerance into a 400 storm — a workflow that worked before now fails, which is the program's defined failure condition.
**Do this instead:** characterize → shadow-parse with warn logs for one deploy cycle → enforce. Per slice, never globally.

### Anti-Pattern 4: Renaming migrations to unify the three naming schemes

**What people do:** Renumber `001_`/`008b_`/`020_`/timestamped into one consistent scheme.
**Why it's wrong:** The filename prefix *is* the version key in the remote `supabase_migrations.schema_migrations` table. Renaming permanently desynchronizes the folder from production history, and no `migration repair` invocation fixes a version that no longer exists on either side cleanly.
**Do this instead:** Freeze the 45 files. Add one `<ts>_reconcile_baseline.sql`. Enforce timestamped naming for new migrations only. Document the cutoff in a `supabase/migrations/README.md`.

### Anti-Pattern 5: Blanket cache headers on a path prefix

**What people do:** `"source": "/api/(.*)"` with `s-maxage=60` — it made the anonymous event list fast.
**Why it's wrong:** The glob cannot distinguish `/api/events` from `/api/recommendations`. The Vercel CDN's cache key does **not** include the request `Cookie` header unless `Vary` names it, and a request cookie does not disqualify a response from caching — only a `Set-Cookie` on the *response* does. Middleware only sets cookies when a session is actually refreshed, so the steady-state authenticated request emits none.
**Do this instead:** Delete the glob. Classify every route. Emit headers from the handler (they override config). Add the invariant test.

### Anti-Pattern 6: Each helper fetching the user again

**What people do:** `verifyAdmin()` and `checkBanStatus()` each call `await createClient()` then `auth.getUser()` then a `users` SELECT — because each is independently convenient.
**Why it's wrong:** An admin mutation can pay 3 auth round-trips and 2 profile reads before its first real query, and the three call sites can disagree about the same user.
**Do this instead:** One `requestContext` per request, passed explicitly into services and guards, with `clubRole()` memoized.

### Anti-Pattern 7: Excluding code from the type-check to make CI green

**What people do:** `tsconfig.json` excludes `**/*.test.ts*`, `internal`, `supabase/functions`.
**Why it's wrong:** Test code is the thing asserting the refactor is safe; untyped tests drift from the code they guard. The Deno edge function is an *ingestion entry point* and is currently verified by nothing in CI.
**Do this instead:** Type-check tests in the main project (or a second `tsconfig.test.json` that CI also runs); add `deno check supabase/functions/**` as a separate CI step.

---

## Integration Points

### External services

| Service | Integration pattern (target) | Gotchas |
|---|---|---|
| Supabase Auth (Azure AD / Google OAuth) | `auth/callback` route is the one place that writes cookies *and* elevates; McGill domain enforced there; non-McGill → sign out + delete `auth.users` row | Zero tests today, 3 `as any`. Azure tokens are large → cookie chunking; the middleware's stale-chunk cleanup is subtle and must be characterized before touching. |
| Supabase Postgres | `server/db/` only; RLS on by default; service role behind `elevated/` | Service role bypasses RLS only when the request carries no user token — so never construct an elevated client from a user session |
| Supabase Storage | `events/upload-image`, `profile/avatar`, `profile/banner`, `clubs/logo`, `clubs/banner` → one `services/uploads.ts` | 5 near-duplicate handlers today; size/MIME limits must move into contracts and be adversarially tested |
| pg_cron (`compute_user_scores`, every 6h) | Scheduled in-DB; app reads pre-computed scores | Invisible when it dies. Ops endpoint must surface last-run + `user_scores` freshness. |
| Vercel Cron | **Currently unconfigured** — no `crons` key in `vercel.json` despite two `/api/cron/*` handlers | Audit must determine: externally triggered, or never running? Reminder emails are a user-visible Validated requirement. |
| Apify → `events-webhook` (Deno edge fn) | HMAC-SHA256 verified; inserts `status:"pending"`; content-hash dedup | Out of `tsconfig`; separate Deno test; needs its own CI step and a signature-rejection counter |
| Vercel CDN | Per-route `Cache-Control` from the handler; `Vercel-CDN-Cache-Control` for a longer edge TTL on public reads | Function headers override `vercel.json`/`next.config.js`; `x-vercel-cache` is the observability hook |
| Sentry | `instrumentation.ts` (server) + `instrumentation-client.ts`; `onRequestError` hook; `requestId` as a tag | Not installed yet. Add in slice 7 so it captures a stabilized error taxonomy rather than the current 500-everything shape. |

### Internal boundaries

| Boundary | Communication | Enforcement |
|---|---|---|
| `app/` → `server/` | Direct import of service functions; `withRoute` is the only wrapper | ESLint: `app/**` may not import `@/lib/supabase/service` |
| `server/services` → `server/db` | Through `ctx.supabase` (RLS on) or a named `elevated/` module | ESLint: `services/**` may not import `@/lib/supabase/service` |
| `server/` → `next/server` | Only `server/http.ts` touches `NextResponse` | ESLint: restrict `next/server` below `http.ts` |
| client ↔ server | `contracts/` schemas + `API_ENDPOINTS` constants (which exist in `lib/constants.ts` but are inconsistently used — many components hardcode fetch URLs) | Lint rule or codemod to route all fetches through the constants |
| `internal/` (separate Vite app) and `backend/` (legacy Python) | Currently committed, excluded from `tsconfig`, not in CI | Stage 1 decides: own them (add to CI) or archive them. Leaving them half-present is what stale documentation is made of. |

---

## Confidence and Gaps

| Area | Confidence | Basis |
|---|---|---|
| Current-state measurements | HIGH | Read/grepped the repo on 2026-09-13 |
| Next.js 16 route-handler caching default is dynamic | HIGH | Official `route.js` reference, Version History: "`v15.0.0-RC` — The default caching for `GET` handlers was changed from static to dynamic" |
| Vercel CDN cacheability criteria (no `set-cookie`; request `Cookie` not disqualifying; function headers override config) | HIGH | Official Vercel CDN Cache docs |
| Supabase RLS guidance (`(select auth.uid())`, index policy columns, service-role semantics, SECURITY DEFINER with `search_path=''`) | HIGH | Official Supabase RLS docs |
| Supabase migration reconciliation (`migration list` / `repair --status` / `db pull` / `db diff`, CI type-drift gate) | HIGH | Official Supabase CLI + managing-environments docs |
| pgTAP RLS test helpers (`authenticate_as`, `rls_enabled`, `throws_ok('42501')`) | MEDIUM | Supabase pgTAP-extended docs; helper API surface may have shifted — verify against the installed CLI version in F0b |
| **Whether `vercel.json`'s `s-maxage` actually reaches personalized responses in production** | **UNVERIFIED — flagged** | Next.js emits its own `no-store` on dynamic handlers; Vercel applies config headers at the routing layer. Precedence is genuinely ambiguous. **Stage 1 must resolve by curl against production and record the raw headers.** Severity is critical-if-confirmed, latent-hazard-if-not. |
| Slice ordering | MEDIUM-HIGH | Derived from measured dependencies in this repo, not a template. The main judgment call is placing auth at #3 rather than #1; the reasoning (blast radius vs. bottom-up purity) is stated so it can be overridden deliberately. |

**Open questions for the audit to close:**
- Are the two `/api/cron/*` handlers scheduled externally, or dead? Email reminders are a Validated requirement.
- Is `types.ts` actually current? Regenerate and diff — do not assume the March "hand-written" note still holds.
- Do `internal/` and `backend/` stay in the repo? Both are excluded from `tsconfig` and CI today.
- Which of the 22 service-client route handlers genuinely require RLS bypass? That count is the headline metric for slice 5.

---

## Sources

- Next.js — [`route.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route) (v16.3.5 docs; Version History table) — HIGH
- Next.js 16 — Cache Components / `use cache` / `cacheLife` / `cacheTag` / `updateTag` (`vercel:next-cache-components` reference, citing [Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components) and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)) — HIGH
- Vercel — [CDN Cache](https://vercel.com/docs/caching/cdn-cache): cacheable-response criteria, header precedence, `CDN-Cache-Control` / `Vercel-CDN-Cache-Control`, `Vary`, `x-vercel-cache` — HIGH
- Supabase — [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): service-role semantics, `(select auth.uid())` initPlan, indexing policy columns, SECURITY DEFINER with `search_path=''`, defense in depth — HIGH
- Supabase — [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments): local → staging → production, `db pull` / `db diff`, CI type-drift check — HIGH
- Supabase — [`migration repair`](https://supabase.com/docs/reference/cli/supabase-migration-repair): `--status applied|reverted`, reconciling with `migration list` — HIGH
- Supabase — [pgTAP extended testing](https://supabase.com/docs/guides/local-development/testing/pgtap-extended): `supabase test new` / `test db`, `tests.authenticate_as`, `tests.rls_enabled`, `results_eq` / `lives_ok` / `throws_ok('42501')` — MEDIUM
- This repository, read 2026-09-13: `src/middleware.ts`, `vercel.json`, `next.config.js`, `package.json`, `tsconfig.json`, `jest.config.js`, `vitest.config.ts`, `src/lib/supabase/{server,service,types}.ts`, `src/lib/{admin,roles,ban}.ts`, `src/app/api/clubs/[id]/members/route.ts`, `supabase/migrations/`, plus the greps tabulated in Current-State Measurements — HIGH
- `.planning/codebase/{ARCHITECTURE,STRUCTURE,INTEGRATIONS,CONCERNS}.md` (dated 2026-03-05) — treated as **leads to re-verify**, not as facts; several are demonstrably stale (`getSession()`, hand-written types)

---
*Architecture research for: Next.js 16 + Supabase foundation hardening (Uni-Verse)*
*Researched: 2026-09-13*
