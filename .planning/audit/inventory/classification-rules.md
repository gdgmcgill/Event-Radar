# Classification Rules — the derivation behind `endpoints.json` and `pages.json`

| | |
|---|---|
| Requirement | AUDIT-03, AUDIT-04; consumed verbatim by CERT-05 / CERT-06 |
| Produced by | plan 01-11 |
| Executable form | `.planning/audit/tools/classify-inventory.mjs` |
| Rule of precedence | **this document is the contract.** The script is this document made executable. If they ever disagree, the script is wrong. |

This file exists so the persona matrix is **derived rather than asserted**. Ninety-four
endpoints × thirteen personas is 1,222 cells; nobody can defend 1,222 hand-typed cells, and
nobody downstream can re-derive them. Every cell in `endpoints.json → expected_status` is
produced by one of the rules in § 3, applied by the script, or is one of the four recorded
overrides in § 5.

---

## 0. What `expected_status` means, and what it does not

`expected_status` is **the status the endpoint should return under a correct implementation**,
not the status it returns today.

This distinction is the whole point of the column. Where the two diverge, the divergence *is*
the finding, and § 6 enumerates every divergence this plan found. Recording today's broken
behaviour as the contract would launder a defect into a specification — threat T-01-11-04 in the
plan's own model.

Concretely: `/api/admin/calculate-popularity` has `machine_no_credential: 401` even though it
returns **200 to an anonymous caller in production right now**, because `ADMIN_API_KEY` is unset
and the gate is `if (expectedKey && ...)`. The 401 is the contract; the 200 is finding FO-01.

### The four human verdicts everything else is derived from

The script carries one `VERDICTS` record per endpoint id with five fields read out of the
handler source by a human: `auth`, `role`, `rls`, `pers`, `scope`. **Those five are the human
classification.** The thirteen persona columns, `input_validation`, `cache_policy_today`,
`cache_policy_target`, `test_present` and `dead_or_duplicate` are all computed from them plus
the machine signals plus the captured baselines, and re-running the script reproduces them
exactly.

---

## 1. Endpoint field rules

### A1 — `auth_requirement` is what the handler enforces, not what its path suggests

Four values: `anonymous`, `authenticated`, `admin`, `machine`.

- `admin` — the handler calls `verifyAdmin()` (`src/lib/admin.ts`, `users.roles` includes
  `"admin"`) **or** performs an equivalent inline roles-membership check, and returns before
  acting when it fails.
- `machine` — the handler's only gate is a shared secret compared against an environment
  variable. Three rows: `/api/admin/calculate-popularity` (`ADMIN_API_KEY`) and both
  `/api/cron/*` (`CRON_SECRET`).
- `authenticated` — the handler reads a verified user and has an unauthenticated branch that
  refuses (a `401` return).
- `anonymous` — everything else, **including handlers that call `getUser()` but never refuse.**

A handler under `/api/admin/` that never verifies a role is `authenticated`-at-best and is a
finding, not an `admin` route. `/api/admin/calculate-popularity` is the live instance: it sits
under the admin path prefix and is classified `machine`, because `ADMIN_API_KEY` is the only
thing it ever checks.

### A5 — a route's `auth_requirement` is its **weakest** method

`endpoints.json` has one row per `route.ts` file, not per exported method. Where methods
disagree, the row records the weakest gate any exported method enforces, because that is the
route's actual exposure. Four rows are `anonymous` on this rule while a mutating method 401s:
`/api/clubs`, `/api/clubs/[id]`, `/api/events/[id]`, `/api/events/[id]/rsvp`.

The cost of this rule is that it hides a gated PATCH behind an ungated GET. That is the correct
trade for an audit: an attacker reads the weakest method too.

### A2 — `role_required` names the mechanism, not just the role

`null`, or a string naming both the role and how it is enforced — `verifyAdmin()`, an inline
roles check, a `club_members` lookup, or a `club_members.role === "owner"` lookup. Two handlers
enforce an admin role **without** `verifyAdmin()`
(`/api/moderation/reviews/[targetType]/[targetId]` uses an inline check on the service client);
naming the mechanism is what makes that visible.

### A3 — `rls_reliance`

`primary` (cookie client, row-level security does the filtering), `partial` (an
application-level check combined with RLS), `none` (the tables touched have no governing policy
per `rls/rls-heatmap.csv`, or the handler touches no table), `bypassed` (service-role client).

**`bypassed` is asserted, not chosen.** The script forces `rls_reliance = "bypassed"` whenever
`signals.uses_service_client` is true, so a verdict table typo cannot understate a bypass.
`/api/admin/calculate-popularity` is `bypassed` via the verdict table instead, because it
constructs its client with an inline `createAdminClient()` rather than importing
`createServiceClient()` — which is also why it is absent from the 01-07 register.

Caveat carried forward from plan 01-09: `partial` and `primary` describe *the handler's
posture*, not the strength of the policy behind it. `rls/rls-review.md` records that `anon`
holds full grants on all thirty public tables, so `primary` here means "the handler delegates to
RLS", not "RLS is sufficient".

### A4 — `service_role_justified` is transcribed, never re-decided

Copied from `authz/service-role-register.json` by `file` key. Twenty-two rows;
`/api/admin/calculate-popularity` gets the literal string
`not-in-register — inline createAdminClient() ...`. A single verdict with a single rationale is
the entire point of having a register, and the script asserts the transcription rather than
re-reasoning it.

### P1 — `personalized`

> **True when the SUCCESS body can differ between two callers who are both authorized for the
> route, given an identical request URL.**

Two deliberate exclusions:

1. **Error bodies are excluded from the comparison.** Otherwise every authenticated route would
   be "personalized" merely because an unauthorized caller gets a 403 — which would make the
   column mean "requires auth", a question `auth_requirement` already answers, and would hand
   plan 01-12 a probe set of all ninety-four rows.
2. **Requiring a session is neither necessary nor sufficient.** A route returning a global list
   is not personalized even when it demands a session (`/api/clubs/[id]/members`). A route whose
   path looks public *is* personalized when it filters by the caller
   (`/api/notifications/count`).

Twenty-seven rows are personalized. **Eight of them are anonymously reachable** — they call
`getUser()`, never refuse, and return a degraded body to anonymous callers and a caller-scoped
body to signed-in ones. That combination, under a shared cache keyed by URL, is a cross-user
disclosure channel, and it is the set plan 01-12 must probe first:

`/api/auth-debug`, `/api/clubs/[id]/events`, `/api/events/[id]/friends`,
`/api/events/[id]/rsvp`, `/api/events/following`, `/api/events/friends-activity`,
`/api/events/friends-organizing`, `/api/notifications/count`.

### C1 — `cache_policy_today` is the header the response actually carries

The handler's own `Cache-Control` value where `signals.sets_cache_control` is true (three rows),
otherwise the blanket platform header, quoted exactly from `vercel.json`:

```
s-maxage=60, stale-while-revalidate=300
```

That rule's `source` is `/api/(.*)` with **no exception for authenticated or personalized
routes**. `next.config.ts → headers()` sets only security headers for `/(.*)` and no
`Cache-Control` at all, so the two `/auth/*` rows — which are outside the `/api/` prefix —
carry no platform cache header; they record that fact explicitly rather than a blank.

**Twenty-five of the twenty-seven personalized rows carry the blanket header.** The two that do
not are `/api/recommendations` (the only handler in the tree that sets `private, no-store`
itself) and `/auth/callback`.

### C2 — `cache_policy_target` is REFAC-19's input

- personalized → `private, no-store`
- mutating-only (no `GET`) → `no-store`
- non-personalized and `anonymous` → an explicit public opt-in,
  `public, s-maxage=60, stale-while-revalidate=300`
- non-personalized but session-requiring → `private, no-store`

The last line is the one that matters: the target policy is opt-*in* to sharing. REFAC-19
inverts today's default, where every `/api/*` route is shared unless it opts out, and exactly
one route ever has.

### V1 — `input_validation`

Schema enum is `none | manual | zod | unknown`. **No schema validator is imported anywhere in
`src/`** — `signals.has_zod` is false on all ninety-four rows — so only `manual` and `none`
occur: 77 manual, 17 none.

Derived mechanically: a handler that parses a body and has at least one `400` path is `manual`
(an inline `status: 400`, or, from Phase 4 on, a call to the seam's `badRequest()` helper in
`src/server/errors.ts`; the helper clause was added by 05-08 so that `/api/events/[id]/rsvp`, which
adopted the helper in 04-05, is not misread as validating nothing);
a handler that parses a body with no `400` path validates nothing and is `none`; a handler that
parses no body is `none` (vacuously).

**Two handlers parse a body and validate nothing**, which is the REFAC-15 candidate set:
`/api/admin/events/[id]` and `/api/admin/users/[id]`. Both are admin-gated, which bounds but
does not remove the exposure — `/api/admin/users/[id]` PATCHes the `users` table, the same table
`rls/rls-review.md` records a Critical self-escalation hole on.

> Note on the plan's wording: the plan text says the third value is `schema`; the schema file
> (`endpoints.schema.json`) says `zod`. The schema file wins, because `validate.mjs` enforces
> it. No row uses either value.

### T1 — `test_present`

Matched against `baseline/jest-listtests.txt`, never guessed. Two mechanisms: a colocated
`route.test.ts` beside the handler (detected by `fs.existsSync`), and an explicit map for the
suites under `src/__tests__/api/`.

`src/__tests__/api/events/date-validation.test.ts` is **deliberately unmapped**: it exercises
the pure functions in `src/lib/dateValidation.ts`, not a handler, so mapping it to a route would
overstate coverage.

**Seven of ninety-four handlers have a test.** Cross-reference `quality/dead-code.md` row 12:
CI runs lint, tsc and build and executes none of the twenty-one suites, so the real figure
enforced on every commit is zero.

### D1 — `dead_or_duplicate` (endpoints)

`quality/dead-code.md` lists five unused **component** files and no route handlers — knip treats
every `route.ts` as an entry point and structurally cannot flag one. The only dead handlers in
the tree were found by plan 01-10 against the live `pg_cron` catalog: both `/api/cron/*` routes
are dead duplicates of PL/pgSQL functions that `pg_cron` has been running successfully every 15
and 30 minutes. `async/cron-webhook-inventory.md` § 8 is the evidence.

---

## 2. The personas

Thirteen keys, from `.planning/research/FEATURES.md` § Stage 4 and fixed by
`endpoints.schema.json`. A missing key is a schema error, not an implicit placeholder.

| key | who |
|---|---|
| `anonymous` | no session at all |
| `onboarded_student` | signed-in McGill student, onboarding complete, member of no club |
| `mid_onboarding_student` | signed in, `users.onboarding_completed` not true (since Phase 5 slice 3 the database value decides; the `needs_onboarding` cookie is a hint nothing reads) |
| `club_member` | non-owner member of **the club the request concerns** |
| `club_owner` | owner of the club the request concerns |
| `multi_club_organizer` | owner/organizer of several clubs, including this one |
| `cross_club_attacker` | member of a **different** club, never this one |
| `admin` | `users.roles` includes `"admin"` |
| `banned_permanent` | `banned_at` set, `ban_expires_at` null |
| `suspended_active` | `banned_at` set, `ban_expires_at` in the future |
| `suspension_expired` | `banned_at` set, `ban_expires_at` in the past |
| `non_mcgill_signin` | a non-McGill identity attempting to sign in |
| `machine_no_credential` | a machine caller presenting no bearer secret |

---

## 3. Persona derivation rules

`S` below is the route's success code, itself derived (rule S1): `302` for the two `/auth/*`
rows; `200` when the route exports a `GET`; otherwise `201` when the handler contains a `201`
return; otherwise `200`.

`student` is the shared baseline every non-special persona falls back to:

```
student = 401                       when auth_requirement == "machine"
        = 403                       when auth_requirement == "admin"
        = 403                       when scope is club or club-owner
        = S                         otherwise
```

| # | Persona | Rule |
|---|---|---|
| **R2** | `anonymous` | `S` when `auth_requirement == "anonymous"`, else **401**. An anonymous caller against an authenticated route expects *unauthorized*, never *forbidden* — 403 asserts a known identity that lacks permission, which is a different fact. |
| **R3** | `onboarded_student` | `student` |
| **R4** | `mid_onboarding_student` | **403** when (a) every method of the row is non-`GET`, (b) the route is under `/api/`, (c) the row id is neither `api.users.id` nor `api.onboarding.complete`, and (d) `student == S`; otherwise `student`. Rationale (DEC-34, Phase 5 slice 3): since 05-06 and 05-07 every state-changing, non-admin, authenticated arm under `src/app/api` calls `requireOnboarded()` and answers `403 {"error":"Onboarding required"}`; `POST /api/interactions` and `POST /api/feedback` apply it whenever a user is signed in. The two wizard calls are exempt. A row with a `GET` keeps `student`, because GET arms gain no guard and rule A5 records the weakest method. `/auth/*` rows keep `student`: they are outside `src/app/api` and `/auth/signout` carries no onboarding guard. Clause (d) leaves rows the student cannot reach (admin, club-scoped, machine) at their existing code. The proxy's onboarding redirect still skips `/api/` and `/auth/`, so this 403 comes from the handler ring, not the proxy. For pages the guard is a 307 redirect to `/onboarding`, now read from the database. Applied by `classify-inventory.mjs` in the 05-08 commit `docs(05-08): endpoint contract agrees with slice 3 (F-028, DEC-34)`; it moved 12 cells (`evidence/contract-regen-slice-3.txt` in the Phase 5 directory). |
| **R5** | `club_member` | `S` when `scope == "club"`; **403** when `scope == "club-owner"`; else `student` |
| **R6** | `club_owner` | `S` when `scope` is `club` or `club-owner`; else `student` |
| **R7** | `multi_club_organizer` | identical to R6. Holding a role in several clubs confers nothing extra in *this* club. |
| **R8** | `cross_club_attacker` | **403** on every club-scoped route; `student` elsewhere. This is the tenant-isolation boundary encoded per endpoint. |
| **R9** | `admin` | `S` on admin routes; **401** on machine routes; **403** on club-scoped routes; else `S`. Admin is **not** a club-role bypass anywhere in this tree — `/api/clubs/[id]` DELETE says so in as many words ("Only the club owner can delete the club"). Recorded rather than assumed. |
| **R10** | `banned_permanent` | **403** on every route the ban ring gates. `src/middleware.ts` gates every path except `BAN_EXEMPT_PATHS = ["/banned", "/auth/signout", "/auth/callback"]`, so this is 403 on 92 of 94 rows. |
| **R11** | `suspended_active` | identical to R10 — `isBanned()` is true while `ban_expires_at` is in the future. |
| **R12** | `suspension_expired` | `student`. `src/lib/ban.ts:12` returns false once the expiry has passed; an expired suspension is not a ban. |
| **R13** | `non_mcgill_signin` | **`"n/a"`** on every endpoint row except `/auth/callback` (302). A non-McGill identity is an authentication-flow case, resolved at the callback before any API call is ever made; asserting a status for it on `/api/events` would be fiction. |
| **R14** | `machine_no_credential` | **401** on machine routes; otherwise identical to `anonymous`, because a machine caller with no credential is indistinguishable from an anonymous browser. |

### The three machine-credential cases

The plan asks for all three explicitly. Only the third is a persona column; the other two are
recorded here because CERT-06 needs them.

| case | expected | in production today |
|---|---|---|
| valid credential | `S` (200) | **unreachable** — `raw/vercel/env-names.json` shows only three variables configured, and neither `ADMIN_API_KEY` nor `CRON_SECRET` is among them, so no valid credential exists to present |
| invalid credential | **401** | `/api/admin/calculate-popularity`: **200** (gate skipped, FO-01). `/api/cron/send-reminders`: 401 unless the attacker sends the literal `Bearer undefined`, which succeeds (FO-02). `/api/cron/send-feedback-requests`: 500 before the comparison (FO-04, fail-closed) |
| absent credential (`machine_no_credential`) | **401** | same as the invalid row: 200, 401-or-bypass, and 500 respectively |

**All three secrets are absent in production, so the fail-open is live, not hypothetical.**

---

## 4. Rings that do *not* fire on endpoints, stated so nobody re-derives them

Two middleware rings look like they should shape the persona matrix and do not:

1. **The onboarding guard (the proxy's half).** `src/middleware.ts` gated on
   `needsOnboarding && user && path !== "/onboarding" && !path.startsWith("/api/") && !path.startsWith("/auth/")`.
   The two explicit prefix exemptions meant **every row in `endpoints.json` was out of scope**, so
   `mid_onboarding_student` equalled `onboarded_student` on all ninety-four. On pages the guard is
   a 307 redirect to `/onboarding`.
   *Phase 5 slice 3 update (DEC-34, DEC-36).* The proxy (`src/proxy.ts`) still exempts `/api/`
   and `/auth/`, and now reads `onboarding_completed` from the database rather than the cookie.
   The guard that does fire on endpoints is the handler ring: `requireOnboarded()` on every
   non-exempt write arm. Rule R4 encodes it, so `mid_onboarding_student` now differs from
   `onboarded_student` on 12 write-only rows.
2. **The route-protection list.** `PROTECTED_ROUTES` at `src/middleware.ts:114` contains eight
   **page** paths and no `/api/` prefix, so it contributes nothing to any endpoint row. Every
   401 in this inventory comes from the handler itself.

And one ring that fires on endpoints and is easy to miss: **the ban ring does gate `/api/`.**
`BAN_EXEMPT_PATHS` lists only `/banned`, `/auth/signout` and `/auth/callback`, so a banned user
calling any API route is intercepted by the middleware before the handler runs. That is why R10
applies to 92 of 94 rows rather than to the twelve handlers that call `checkBanStatus()`
themselves.

**Both rings sit behind FO-03.** `src/middleware.ts:13-16` returns `NextResponse.next()`
unauthenticated when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is unset, and
the whole body is wrapped in a `try/catch` that also falls through to `NextResponse.next()`. The
expectations in § 3 assume the ring runs.

---

## 5. Recorded hand overrides

Every override below is applied by name in the script and exists nowhere else.

### Endpoint overrides (4 cells)

| cell | value | reason |
|---|---|---|
| `auth.callback.banned_permanent` | 302 | `/auth/callback` is ban-exempt by design and must stay reachable: it is what establishes the session the ban check later reads. Applying R10 here would make the ban ring unable to observe the ban. |
| `auth.callback.suspended_active` | 302 | same |
| `auth.signout.banned_permanent` | 302 | **This is the reason the exemption exists.** A banned user must be able to clear their own session; 403-ing sign-out traps them in a session they cannot end. |
| `auth.signout.suspended_active` | 302 | same |

### Page override (1 row)

| row | from → to | reason |
|---|---|---|
| `users.id` (`src/app/users/[id]/page.tsx`) | `auth` → `unprotected_but_should_be` | `pages.json` recorded `auth` on the strength of `page_guard: "getUser"`. Plan 01-07 proved that guard does not gate: the `getUser()` at line 56 only redirects a **self**-view to `/profile` (lines 58-60) and has no unauthenticated branch, so an anonymous request reaches the service-role read at line 63, which selects `email`, `visibility` and `interest_tags` filtered on an attacker-supplied path id. `generateMetadata` at lines 33-48 constructs the same RLS-bypassing client with no session read of any kind. This is the only `unjustified` verdict in the entire service-role register. A page that renders another tenant's data while neither ring covers it is `unprotected_but_should_be` by the plan's own definition. |

### Routes that could not be decided from source

**None.** Every one of the ninety-four resolved from the handler body plus the registers. Where
a handler was ambiguous the ambiguity was about *meaning* rather than *fact* — chiefly the eight
anonymous-tolerant personalized routes, which are unambiguous once rule P1 fixes the definition
of personalization.

---

## 6. Expected versus current — the divergence queue for plan 01-13

The matrix says what each route *should* return. This is every place the tree disagrees today.
Each is a finding candidate; none is fixed, and `git diff --exit-code -- src/` is clean.

| # | Divergence | Rows | Expected | Current | Evidence |
|---|---|---|---|---|---|
| **D-1** | **Machine routes fail open.** `machine_no_credential` should be 401. | `/api/admin/calculate-popularity` | 401 | **200 on both GET and POST** — `if (expectedKey && ...)` skips entirely when `ADMIN_API_KEY` is unset, then constructs a service-role client | `authz/fail-open-register.md` FO-01; `raw/vercel/env-names.json` |
| **D-2** | Same, weaker form | `/api/cron/send-reminders` | 401 | compares against the fixed literal `Bearer undefined`; a caller who sends that string is admitted to a service-role write | FO-02 |
| **D-3** | Same, fail-closed | `/api/cron/send-feedback-requests` | 401 | **500 to every caller**, unconditionally — the route cannot execute at all | FO-04 |
| **D-4** | **Admin routes conflate 401 and 403.** `verifyAdmin()` returns `isAdmin: false` for an anonymous caller, so the handlers return 403 where the contract says 401. | 22 of the 25 admin rows | `anonymous: 401` | 403 | `src/lib/admin.ts` has no `user == null` branch distinct from the role failure |
| **D-5** | **The ban ring redirects rather than refusing, on API routes.** | 92 rows | 403 | `NextResponse.redirect("/banned")` — a **307 to an HTML page** in answer to a JSON API call | `src/middleware.ts:105-108` |
| **D-6** | **Eight personalized routes return 200 to anonymous callers instead of 401**, with a degraded body, and carry the blanket `s-maxage=60` shared-cache header. | the § P1 list | 401 *or* `private, no-store` | 200 + shared-cacheable | `signals.calls_get_user` true, no `401` path. **Status (Phase 5, F-028, DEC-39):** four routes answer anonymous callers 401 since 05-06 (`7ff08c1`): `/api/events/following`, `/api/events/friends-activity`, `/api/events/friends-organizing`, `/api/events/[id]/friends`. Their verdicts are `authenticated` and their `anonymous` and `machine_no_credential` cells are 401 since the 05-08 regeneration. `GET /api/events/[id]/rsvp`, `/api/clubs/[id]/events` and `/api/notifications/count` stay anonymous and move with REFAC-19 in Phase 6, because they feed public UI. `/api/auth-debug` (D-7) was deleted by 05-04 (F-027). Its row stays in the inventory (DEC-55) |
| **D-7** | **`/api/auth-debug` echoes the caller's own id and email with no gate**, under the blanket shared-cache header. | 1 | 401, or the route deleted | 200 to anyone | `src/app/api/auth-debug/route.ts:35-44` |
| **D-8** | **`/api/health` returns a full infrastructure health report anonymously**, including a live auth-configuration probe. | 1 | 401 or a reduced body | 200 to anyone | `src/app/api/health/route.ts:330-374` |
| **D-9** | **Two admin handlers parse a body and validate nothing.** | `/api/admin/events/[id]`, `/api/admin/users/[id]` | `manual` at minimum | `none` | REFAC-15 |
| **D-10** | **Both `/api/cron/*` handlers duplicate live `pg_cron` functions and diverge from them on four points**, three of which would double-notify real users if the handlers were ever scheduled. | 2 | route deleted | dead but reachable | `async/cron-webhook-inventory.md` § 2.5 |

### AUDIT-04 page finding candidates

| # | Finding |
|---|---|
| **D-11** | **`/users/[id]` is `unprotected_but_should_be`** — see § 5. Anonymous read of another user's `email`, `visibility` and `interest_tags` on an RLS-bypassing client, filtered on an attacker-supplied path id, plus an entirely unauthenticated `generateMetadata` construction of the same client. |
| **D-12** | **Documentation drift in the protected-route list.** `CLAUDE.md:50` documents **six** protected routes (`/my-events`, `/create-event`, `/notifications`, `/profile`, `/my-clubs`, `/invites`). `src/middleware.ts:114` `PROTECTED_ROUTES` has **eight** — it also contains **`/settings`** and **`/friends`**. The drift direction is the dangerous one for an auditor: anyone trusting `CLAUDE.md` marks two genuinely protected routes as public. `baseline/versions.txt` records `protected_routes_source_count=8`; `pages.json` was computed from the source array, never from `CLAUDE.md`. |
| **D-13** | **Fourteen pages are protected by a layout ring that appears in no middleware list.** `src/app/admin/layout.tsx` and `src/app/moderation/layout.tsx` guard server-side; `middleware_protected` is false on all fourteen. Reporting only the middleware ring would have marked every moderation page unprotected. Recorded as a **method** finding: the single-ring answer is wrong in both directions, and D-11 is the other direction. |
| **D-14** | **`/docs` renders redoc unguarded** (`quality/dead-code.md`), and `/health` and `/feedback` are `public` pages fronting the API rows in D-8. |

---

## 7. Page field rules

### G1 — `effective_protection` reconciles **both** rings

A page is protected when **either** the middleware `PROTECTED_ROUTES` list covers it **or** a
guarded ancestor `layout.tsx` covers it. Values (schema enum, underscored):
`public`, `auth`, `admin`, `club_role`, `unprotected_but_should_be`.

- `layout_guard` non-null → `admin`. Fourteen rows: the twelve `/moderation/*` pages and the two
  `/admin/experiments*` pages.
- neither ring, no in-page guard, but the page renders another tenant's or admin data →
  `unprotected_but_should_be`. One row, by override: `users.id` (§ 5).
- otherwise the verdict plan 01-03 derived from source stands.

`page_guard` records the **mechanism present**, which is not the same as a mechanism that
**gates** — `users.id` carries `page_guard: "getUser"` and is nonetheless unprotected. That gap
between "a guard is present" and "a guard refuses" is exactly what D-11 is.

### G2 — `render_mode` is read, never inferred

From `inventory/build-routes.txt` (circle = static, ƒ = dynamic), captured from the real build by
plan 01-03. Never guessed from source.

### D2 — `dead_or_duplicate` (pages)

False on all forty-three. `quality/dead-code.md` names no `page.tsx` among its five unused files
— all five are components — and `validate.mjs --check pages` independently asserts that every
route in `build-routes.txt` appears in one of the three inventories, which it does (140/140).

---

## 8. Reproducing this

```bash
node .planning/audit/tools/classify-inventory.mjs            # rewrites both inventories
node .planning/audit/tools/gen-endpoints-csv.mjs             # derived view; never hand-edited
node .planning/audit/tools/validate.mjs --check endpoints
node .planning/audit/tools/validate.mjs --check pages
bash .planning/audit/tools/readonly-guard.sh
git diff --exit-code -- src/
```

**Deleted handlers keep their row (DEC-55).** A row whose handler file no longer exists is left
byte-for-byte as classified, and the script says so on stdout. The inventory mirrors the audit
baseline (`baseline/versions.txt` `route_ts_count=94`), so dropping the row would make
`--check endpoints` disagree with its own baseline. Today this applies to one row,
`api.auth-debug`, deleted by 05-04 for F-027.

The script merges by `id` and touches only the human-verdict fields, so
`gen-endpoint-inventory.mjs` can be re-run afterwards without discarding a single classified
cell. That was verified, not assumed: all ten classified fields on all ninety-four rows survived
a full regeneration byte-for-byte.

---

*Requirement: AUDIT-03, AUDIT-04 · Plan: 01-11 · Phase: 01-read-only-foundation-audit*
