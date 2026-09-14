# Threat Model 3 — Organizer → Administrator Escalation

**Requirement:** AUDIT-17 · **Plan:** 01-13 · **Boundary:** a club organizer (or any signed-in student) reaching administrative capability — moderation, bans, featured curation, analytics, and the service-role key behind them.

> **The boundary in one sentence.** Everything gated on `roles` containing `admin`, plus every path that can *write* that array or run on the RLS-bypassing client without checking it.

This is a **coverage argument**, not a findings list. Depth lives in `findings.json`.

---

## Assets on the protected side

| Asset | Why it matters |
|---|---|
| The `admin` element of `users.roles` | The single token the whole administrative ring is derived from |
| The 25 `/api/admin/*` handlers and the 15 moderation pages | Approve/reject events and clubs, ban users, curate featured content |
| `admin_audit_log` | The accountability record for every action above; 0 rows in production |
| `SUPABASE_SERVICE_ROLE_KEY` | Held by 25 construction sites; bypasses every policy in the previous two models |
| `ADMIN_EMAILS`, `ADMIN_API_KEY`, `CRON_SECRET` | The three administrative/machine secrets — **none configured in production** |

## Entry points that cross this boundary — quantified

| Surface | Count | Source |
|---|---|---|
| Handlers classified `auth_requirement: admin` | 25 of 94 | `inventory/endpoints.json` |
| Pages with `effective_protection: admin` | 14 of 43 | `inventory/pages.json` |
| Pages protected by a **layout** ring the middleware list cannot see | 14 (`admin/layout.tsx` ×2, `moderation/layout.tsx` ×12) | `inventory/pages.json` |
| Entries in `PROTECTED_ROUTES` (`src/middleware.ts:114`) | 8 — and `CLAUDE.md:50` documents 6 | `inventory/pages.json`, `quality/dead-code.md` |
| Admin paths covered by rate limiting | 0 | `inventory/endpoints.json`, `quality/error-observability.md` |
| Environment variables actually configured in production | 3 — `ADMIN_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS` all absent | `../raw/vercel/env-names.json` |

---

## STRIDE threat table

| # | Threat (STRIDE) | Control that should stop it | Exists today? | Evidence | Findings |
|---|---|---|---|---|---|
| E-1 | **Elevation of privilege** — a student writes `admin` into their own `roles` array and the whole ring accepts them | `WITH CHECK` on the self-update policy, or a column-scoped grant | **No.** This is the shortest escalation path in the system and it never touches a handler. `is_admin()` agrees from that moment | `rls/rls-review.md:345`, `rls/rls-review.md:343` | F-006 |
| E-2 | **Elevation of privilege** — an anonymous or organizer caller reaches an admin route whose gate is environment-conditional | A gate that fails **closed** when its variable is absent | **No.** `/api/admin/calculate-popularity` accepts any request on GET and POST when `ADMIN_API_KEY` is unset, then constructs a service-role client. The variable is unset in production | `authz/fail-open-register.md:71`, `../raw/vercel/env-names.json` | F-001, F-040 |
| E-3 | **Spoofing** — the administrative-email auto-promotion path grants `admin` on sign-in | An allowlist that is configured, reviewed, and audited | **Fails closed today** — `ADMIN_EMAILS` is empty, so it promotes nobody. Registered so a future edit to the allowlist is recognised as a privilege grant, not a config tweak | `authz/fail-open-register.md:75` | F-004 |
| E-4 | **Elevation of privilege** — an admin route that skips the shared verification helper | `verifyAdmin()` on every `/api/admin/*` handler | **Mostly.** 25 admin handlers are covered; the exception is the one that rolls its own gate **and** its own service-role client inline, invisible to the `uses_service_client` detector | `authz/service-role-register.md`, `authz/fail-open-register.md:82` | F-001, F-067 |
| E-5 | **Repudiation** — an administrative action leaves no trace, or a forged one is planted | Append-only audit log writable only by service role | **No.** `admin_audit_log` has two `WITH CHECK (true)` `{public}` INSERT policies and `anon` holds `INSERT`; a forged entry attributed to a real admin is a plain PostgREST call. The table holds 0 rows | `rls/rls-review.md:164`, `rls/rls-review.md:330` | F-007 |
| E-6 | **Spoofing** — a caller impersonates the scheduler to drive a service-role write | `CRON_SECRET` compared against a configured value | **No.** The comparison target interpolates to the fixed literal `Bearer undefined` because the variable is absent | `authz/fail-open-register.md:72` | F-002, F-040 |
| E-7 | **Elevation of privilege** — the entire authentication ring is skipped | Middleware that fails closed when its configuration is absent | **No.** `src/middleware.ts:10-16` returns `NextResponse.next()` unauthenticated when the two public Supabase variables are unbound; the 8-entry `PROTECTED_ROUTES` list is never consulted. The layout ring is the real second ring, and it covers pages only | `authz/fail-open-register.md:73`, `inventory/pages.json` | F-003, F-069 |
| E-8 | **Denial of service** — unbounded credential or enumeration attempts against admin paths | Rate limiting on `/api/admin/*` and on the moderation pages | **No.** Zero rate-limiting callsites on administrative paths | `quality/error-observability.md` | F-058 |
| E-9 | **Information disclosure** — an admin response stored by the shared cache and served to a non-admin | `private, no-store` on administrative responses | **No.** All 15 `/api/admin/*` handlers sit under the blanket `s-maxage=60` directive with a session-independent cache key | `cache/cache-matrix.csv` | F-026 |
| E-10 | **Tampering** — a privileged write path outside the application and outside the audit log | CI-mediated, logged, reviewed service-role writes | **No.** `scripts/upload-images.ts` and `scripts/fix-instagram-images.ts` run service-role writes from a developer laptop; the deployed edge function was likewise built from a different developer's checkout | `async/cron-webhook-inventory.md`, `../raw/prod/edge-functions.json` | F-039, F-042 |

---

## What held

- **`verifyAdmin()` exists and is used.** The administrative ring is a real, shared helper rather than 25 copies of an inline role test — the exceptions are enumerable, which is what made E-4 findable (`authz/service-role-register.md`).
- **The layout ring is genuine second-ring protection for pages.** 14 pages are guarded by `admin/layout.tsx` and `moderation/layout.tsx` independently of the middleware list (`inventory/pages.json`). The single-ring model is wrong in *both* directions, and this page uses the two-ring reading.
- **`ADMIN_EMAILS` being empty fails closed.** The auto-promotion path grants nobody anything today; it is registered as a future-edit tripwire, not as a live defect (`authz/fail-open-register.md:75`).
- **`/api/cron/send-feedback-requests` is the fail-closed positive control** and is named as the fix shape for E-6 (`authz/fail-open-register.md:74`).
- **No `getSession()` call gates authorization anywhere.** The classic "trust the unverified cookie" escalation is absent; the one callsite is non-gating and the reason is written down (`authz/getsession-register.md`).
- **`service_role` is not contemplated by the policy set**, and this was computed mechanically rather than special-cased — which surfaces the fact rather than hiding it (`rls/rls-heatmap.csv`).

## Coverage statement

**Examined:** all 25 admin handlers and 14 admin pages by classification and by guard mechanism, all 5 environment-conditional authorization shapes plus one registered false positive, all 25 service-role construction sites, the production environment-variable name census, the audit-log write path, and the administrative cache surface.

**Deliberately not examined:** whether a GoTrue auth hook is configured in the Supabase dashboard (dashboard state; the `pg-functions://` form is ruled out by the function catalog, the HTTP form is not capturable read-only); the runtime OS of the production host (leaves one dependency advisory dispositioned on an assumption); and any behaviour requiring a credentialed write, which this phase forbids.

---

*Phase: 01-read-only-foundation-audit · Plan: 01-13*
