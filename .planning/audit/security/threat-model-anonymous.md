# Threat Model 1 — Anonymous Visitor → Application

**Requirement:** AUDIT-17 · **Plan:** 01-13 · **Boundary:** an unauthenticated HTTP request crossing into the application, its database, and its shared cache.

> **The boundary in one sentence.** Anything reachable without a McGill session — no cookie, no bearer token, no prior state — and everything those requests can read, write, or cause to be stored on a shared cache.

This is a **coverage argument**, not a findings list. Depth lives in `findings.json`; this page records what was examined at this boundary and what was found, including the controls that hold.

---

## Assets on the protected side

| Asset | Why it matters |
|---|---|
| The `users` table (`email`, `interest_tags`, `visibility`, `roles`, ban state) | Personal data and the role array that `is_admin()` reads |
| `admin_audit_log` | The only trace of moderation action; 0 rows in production today |
| `rsvps`, `user_follows`, `club_followers`, `reviews` | The social and attendance graph, per-account attributable |
| Service-role capability (`SUPABASE_SERVICE_ROLE_KEY`) | Bypasses every row-level policy |
| The Vercel shared cache | Stores responses keyed by URL alone (`inventory/../cache/curl-summary.json`) |

## Entry points that cross this boundary — quantified, not described

| Surface | Count | Source |
|---|---|---|
| API handlers classified `auth_requirement: anonymous` | 26 of 94 | `inventory/endpoints.json` |
| Handlers classified `machine` (cron/webhook, no session) | 3 | `inventory/endpoints.json` |
| Pages with `effective_protection: public` | 12 of 43 | `inventory/pages.json` |
| Pages classified `unprotected_but_should_be` | 1 (`/users/[id]`) | `inventory/pages.json` |
| Handlers carrying the blanket `s-maxage=60, stale-while-revalidate=300` | 88 of 94 | `cache/cache-matrix.csv` |
| Live policies whose predicate does not depend on the caller at all | 14 of 101 | `rls/rls-review.md:297` |
| Asynchronous entry points with no confirmed credential | 2 of 6 | `async/cron-webhook-inventory.md` |

Note that the enforcement does not always match the classification: two routes classified `admin`/`machine` are reachable anonymously because their gate is environment-variable-conditional and the variable is absent in production (`../raw/vercel/env-names.json` lists exactly three configured variables).

---

## STRIDE threat table

| # | Threat (STRIDE) | Control that should stop it | Exists today? | Evidence | Findings |
|---|---|---|---|---|---|
| A-1 | **Elevation of privilege** — anonymous caller invokes an admin route and drives a service-role write | `ADMIN_API_KEY` bearer check before `createAdminClient()` | **No.** `if (expectedKey && …)` short-circuits when the variable is unset; the variable is unset in production, on both GET and POST | `authz/fail-open-register.md:71`, `authz/fail-open-register.md:82` | F-001 |
| A-2 | **Spoofing** — anonymous caller impersonates the scheduler | `CRON_SECRET` bearer comparison | **Degraded.** The comparison target interpolates to the fixed literal `Bearer undefined`, which anyone can send | `authz/fail-open-register.md:72`, `authz/fail-open-register.md:141` | F-002 |
| A-3 | **Information disclosure** — anonymous read of another account's email and interests | Session check before the RLS-bypassing client | **No.** `generateMetadata()` builds the service-role client with no session read; the page's `getUser()` only redirects a *self*-view | `authz/service-role-register.md`, `inventory/pages.json` | F-005 |
| A-4 | **Tampering** — anonymous write to the moderation audit log | A `WITH CHECK` predicate on the INSERT policies | **No.** Two INSERT policies, both `WITH CHECK (true)`, both `{public}`, on a table where `anon` holds `INSERT` | `rls/rls-review.md:164`, `rls/rls-review.md:330` | F-007 |
| A-5 | **Tampering** — anonymous forgery of interaction history feeding the recommender | Caller-bound `WITH CHECK` on `user_interactions` | **No.** `WITH CHECK (true)` with `{public}`, amplified by an `AFTER INSERT` trigger | `rls/rls-review.md:167`, `rls/rls-review.md:196` | F-009 |
| A-6 | **Information disclosure** — anonymous bulk read of the attendance and social graph | Row-level predicates binding rows to the caller | **No.** `rsvps`, `user_follows`, `club_followers`, `reviews` all carry `USING (true)` with `{public}` | `rls/rls-review.md:216`, `rls/rls-review.md:225` | F-011, F-013, F-014 |
| A-7 | **Information disclosure** — a personalized response stored by the shared cache and served to an anonymous caller | `Cache-Control: private` or a `Vary` on the session cookie | **No.** 8 personalized routes observed `HIT`/`STALE` with non-zero `age`; **not one response in the run varied on `Cookie` or `Authorization`** | `cache/cache-matrix.csv`, `cache/curl-summary.json` | F-025, F-026, F-027 |
| A-8 | **Information disclosure** — the API surface and infrastructure state published to anyone | Route guard on `/docs` and `/api/health` | **No.** `/docs` renders redoc with no layout ring and is absent from the 8-entry `PROTECTED_ROUTES`; `/api/health` returns a live auth-configuration probe | `quality/dependency-report.md`, `inventory/pages.json` | F-054, F-029 |
| A-9 | **Denial of service** — anonymous traffic paying an unindexed policy predicate on every feed read | An index on `events.status` | **No.** The anonymous feed policy's predicate column is unindexed | `rls/rls-review.md` § 5 | F-015 |
| A-10 | **Spoofing** — unauthenticated invocation of the deployed edge function | Gateway JWT verification | **No** at the gateway (`verify_jwt=false`); an in-body HMAC check does exist and was verified | `../raw/prod/edge-functions.json` | F-039 |

---

## What held

- **Row security is enabled on all 30 `public` tables and all 8 `storage` relations**, and `relforcerowsecurity` being false is informational only — no table has RLS disabled (`rls/rls-review.md:69`). Enablement is necessary, not sufficient, but the common catastrophic case is absent.
- **No policy anywhere targets `TO anon` explicitly**, and 32 of the caller-independent-looking policies are in fact shut because `auth.uid()` is `NULL` for the anonymous role (`rls/rls-review.md:295`).
- **`/api/cron/send-feedback-requests` fails closed** — it returns 500 before the comparison when its secret is absent. It is the positive control proving the fail-open shape is a defect, not a house style (`authz/fail-open-register.md:74`).
- **The shared cache declines to store a cookie-setting response.** `/api/health` was `MISS` on all three probes and was the only route emitting `set-cookie`. This is `safe-by-accident`, named as such rather than relied on (`cache/cache-matrix.csv`).
- **The positive control fired.** `/api/clubs/featured` returned `HIT` with `age: 47`, so every `MISS` elsewhere in the probe is a real negative rather than a broken harness (`cache/curl-summary.json`).

## Coverage statement

**Examined:** all 94 API handlers by classification, all 43 pages by effective protection, all 101 live row-level policies, all 4 storage buckets and 15 object policies, all 6 asynchronous entry-point classes, and 15 routes probed live for shared-cache behaviour with a positive control.

**Deliberately not examined:** cross-session cache retrieval with a second account's cookies (`BLOCKED — input not supplied`, retry command in `cache/curl-summary.json`); rate limiting under load; the client bundle with the real service-role key present in the build environment (`security/client-bundle-sweep.md` records `INCONCLUSIVE`, not clean); any authenticated-caller behaviour, which is the subject of `threat-model-tenant.md`.

---

*Phase: 01-read-only-foundation-audit · Plan: 01-13 · Generated by hand; findings are generated from `findings.json`*
