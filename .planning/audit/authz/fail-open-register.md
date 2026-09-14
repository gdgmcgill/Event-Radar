# AUDIT-10 — Environment-Variable-Conditional Authorization Register

**Every authorization check in this codebase that stops applying, or degrades, when an
environment variable is unset.** Four such checks exist. Two are open, one fails closed, and one
is the detector's false positive — recorded so the population is auditable rather than asserted.

| | |
|---|---|
| Requirement | AUDIT-10 |
| Produced by | plan 01-07, Task 2 |
| Discovered by | the generalized detector below over `src/app/api`, cross-checked against `inventory/endpoints.json` → `signals.env_gated_auth` and `signals.env_vars_referenced` |
| Read-only | **nothing here is fixed.** `git diff --exit-code -- src/` is clean, asserted as an acceptance criterion of this task |

> **Why nothing is fixed.** Every row below has a one- or two-line remedy, and one of them is
> literally "copy the two lines from the sibling file". Applying any of them would destroy the
> baseline that Stage 3 must prove its behavior against: an audit that changes the thing it is
> measuring produces a report about a system that no longer exists. This is threat T-01-07-06 in
> the plan's own model, and the read-only guard is the control. The fixes belong to REFAC-13.

---

## 1. Discovery method

Three detectors, because no single one finds all four rows — which is itself the point: the
fail-open shape has more than one syntax.

```bash
# A — the generalized detector (01-PATTERNS.md § Grep targets): a conditional whose first
#     operand is a bare identifier and whose second is an inequality comparison
command grep -rnE 'if\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*&&\s*[^)]*!==' src/app/api
#   src/app/api/admin/calculate-popularity/route.ts:61   -> FO-01 (POST)
#   src/app/api/admin/calculate-popularity/route.ts:170  -> FO-01 (GET)
#   src/app/api/admin/events/route.ts:55                 -> FP-01, false positive

# B — comparison against a string that interpolates an env var (detector A cannot see this:
#     there is no `&&`, so the check never *disappears*, it silently changes value)
command grep -rnE '!==\s*`[^`]*\$\{\s*process\.env\.[A-Za-z_][A-Za-z0-9_]*[^}]*\}' src/
#   src/app/api/cron/send-reminders/route.ts:9           -> FO-02
#   src/app/api/cron/send-feedback-requests/route.ts:12  -> FO-04, guarded, fails closed

# C — any env var read inside a conditional across the API surface, the middleware and the
#     auth callback (catches the feature-gate shape and the middleware's local-variable form)
command grep -rnE 'if\s*\([^)]*process\.env\.[A-Za-z_]' src/app/api src/middleware.ts src/app/auth
#   src/app/auth/callback/route.ts:162                   -> FO-05, non-authorization
#   (+ the two cron hits above)

# D — the middleware's shape, which C misses because the values are bound to locals first
sed -n '10,16p' src/middleware.ts                        # -> FO-03

# cross-check against the inventory signals
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/inventory/endpoints.json","utf8"));r.filter(x=>x.signals.env_gated_auth===true).forEach(x=>console.log(x.route));console.log("---");const m={};r.forEach(x=>(x.signals.env_vars_referenced||[]).forEach(v=>{(m[v]=m[v]||[]).push(x.route)}));for(const k of ["ADMIN_API_KEY","CRON_SECRET","ADMIN_EMAILS"])console.log(k,"->",(m[k]||[]).join(", "))'
#   /api/admin/calculate-popularity
#   /api/admin/events
#   ---
#   ADMIN_API_KEY -> /api/admin/calculate-popularity
#   CRON_SECRET   -> /api/cron/send-feedback-requests, /api/cron/send-reminders
#   ADMIN_EMAILS  -> /auth/callback
```

Detector A alone would have produced one true row and one false one. The `signals.env_gated_auth`
column alone would have produced the same pair. **Both of the highest-value rows in this register
— FO-02 and FO-03 — are invisible to the detector the phase's own pattern document specifies.**
That is recorded as a method finding in §4.

---

## 2. The register

| id | file | line range | env var | reachable route | failure mode when unset | RLS-bypassing client? | proposed severity |
|---|---|---|---|---|---|---|---|
| FO-01 | `src/app/api/admin/calculate-popularity/route.ts` | POST 54-66 (gate 57-61); GET 165-175 (gate 167-170) | `ADMIN_API_KEY` | `/api/admin/calculate-popularity` | **the check is skipped entirely** — any request is accepted on both verbs | **yes** — `createAdminClient()` lines 15-29, service role key | **Critical** |
| FO-02 | `src/app/api/cron/send-reminders/route.ts` | 6-13 (gate line 9) | `CRON_SECRET` | `/api/cron/send-reminders` | the check still runs but compares against the fixed literal `Bearer undefined` — guessable, not absent | **yes** — `createServiceClient()` line 13 | **High** |
| FO-03 | `src/middleware.ts` | 10-16 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **every route** — the middleware matcher | the entire auth ring returns `NextResponse.next()` unauthenticated; the 8-entry `PROTECTED_ROUTES` list at line 114 is never consulted | no (the ring is skipped, not bypassed) | **Medium** |
| FO-04 | `src/app/api/cron/send-feedback-requests/route.ts` | 6-14 (guard 8-10, gate 12) | `CRON_SECRET` | `/api/cron/send-feedback-requests` | **fails closed** — 500 "Server misconfiguration" before the comparison | yes — `createServiceClient()` line 16 | **none — this is the positive control** |
| FO-05 | `src/app/auth/callback/route.ts` | 22-29, 162-199 (promotion 187-193) | `ADMIN_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY` | `/auth/callback` | fails closed *for the grant* (empty allowlist promotes nobody); fails **open for onboarding** — the whole profile-sync block is skipped | yes — `createServiceClient()` line 164 | **Low** |
| FP-01 | `src/app/api/admin/events/route.ts` | 55 | none | `/api/admin/events` | **not an authorization check** — detector false positive, see §3 | no | **none** |

---

## 3. Row detail

### FO-01 — `/api/admin/calculate-popularity`: the gate disappears, on a service-role client. **Critical.**

Both exported handlers carry the identical shape.

```
 54  export async function POST(request: NextRequest) {
 56      // Simple API key authentication for admin endpoints
 57      const authHeader = request.headers.get("authorization");
 58      const expectedKey = process.env.ADMIN_API_KEY;
 60      // If ADMIN_API_KEY is set, require it; otherwise allow in development
 61      if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
 62        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 66      }
 71      const supabase = createAdminClient();          // service role key, lines 15-29
```
```
165  export async function GET(request: NextRequest) {
167      const authHeader = request.headers.get("authorization");
168      const expectedKey = process.env.ADMIN_API_KEY;
170      if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
171        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
175      }
177      const supabase = createAdminClient();
```

- **Failure mode.** When `ADMIN_API_KEY` is unset, `expectedKey` is `undefined`, the left operand
  of the `&&` is falsy, and the whole conditional is false regardless of the header. The 401 is
  never returned. The next statement constructs the RLS-bypassing client. The comment on line 60
  states the intent — "otherwise allow in development" — so this is a deliberate developer
  affordance whose blast radius is production.
- **Reachability.** Anonymous. There is no other gate: `inventory/endpoints.json` id
  `api.admin.calculate-popularity` records `calls_verify_admin: false`, `calls_get_user: false`,
  `calls_get_session: false`, `inline_role_check: false`, `uses_cookie_client: false`. The
  middleware does not help — `/api/admin/*` is not in the 8-entry `PROTECTED_ROUTES` array at
  `src/middleware.ts:114`, and the middleware is advisory in any case (FO-03). The route is not
  behind the `src/app/admin/layout.tsx` guard either; that guard covers pages, not API handlers.
- **What it grants.** POST recalculates popularity for every approved event, or for a single
  attacker-chosen `event_id` (query parameter, line 69), via the `update_event_popularity` RPC on
  a service-role client — an unauthenticated write to ranking data, and an unbounded one
  (`BATCH_SIZE = 10` over every approved event, line 105-107) that doubles as a cheap
  amplification primitive. GET returns aggregate scoring statistics over the whole
  `event_popularity_scores` table.
- **Compensating control: none.** This is the phrase that sets the severity. Under
  `SEVERITY_SLA.md`, Critical is "anonymous-reachable […] with no compensating control", and
  each clause holds independently.
- **Whether the variable is actually set in production is not knowable from this artifact,** and
  the severity does not depend on it. `security/client-bundle-sweep.md` § 1 records that the
  build environment's `.env` defines three names — `SUPABASE_URL`, `SUPABSE_PUSHABLE_KEY`,
  `SUPABSE_SECRET_KEY` — none of which is `ADMIN_API_KEY`, and two of which are misspelled. A
  control whose entire effect depends on an unvalidated env var being present, in a repository
  that demonstrably ships misspelled env var names, is not a control.
- **Finding candidate for plan 01-13:** Critical, Elevation of Privilege, threat T-01-07-01.
  Fix belongs to REFAC-13 (Stage 3), not here. Note the fix is *not* "always require the key" —
  the route should use `verifyAdmin()` like the other 24 admin handlers, or fail closed the way
  FO-04 does; a shared bearer secret is the wrong control for a route under `/api/admin`.
- **Prior art:** `.planning/codebase/CONCERNS.md` (2026-03-05) § Security Considerations already
  names this defect, citing lines 57-66. It has survived at least six months and remains open.
  That the finding is not new *raises* its priority rather than lowering it.

### FO-02 — `/api/cron/send-reminders`: the gate becomes a guessable constant. **High.**

```
  6  export async function POST(request: NextRequest) {
  7    // Verify cron secret
  8    const authHeader = request.headers.get("authorization");
  9    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 10      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 11    }
 13    const supabase = createServiceClient();
```

- **Failure mode.** There is no `&&`, so the check never vanishes — it changes value. When
  `CRON_SECRET` is unset, JavaScript template interpolation renders `undefined` into the string
  and the comparison becomes `authHeader !== "Bearer undefined"`. A caller who sends
  `Authorization: Bearer undefined` passes. This is **guessable-open**, a strictly different
  failure mode from FO-01's absent check, and it is worth distinguishing: FO-01 accepts
  everything, FO-02 accepts exactly one well-known string. That string is well-known because it
  is the canonical symptom of this exact bug.
- **Reachability.** Anonymous, requiring one guessed header value. `/api/cron/*` is not in
  `PROTECTED_ROUTES`, and `inventory/endpoints.json` id `api.cron.send-reminders` records no
  user-auth signal of any kind.
- **What it grants.** The full reminder sweep on a service-role client (line 13): reads across
  `events`, `saved_events` and `email_reminder_log`, and writes reminder-log rows. Repeated
  invocation is idempotent by design (the `sent24hSet` deduplication at lines 48-59), which
  bounds the abuse to resource consumption and to inference about which events exist in the
  24-hour and 1-hour windows — that bound is why this is High and not Critical.
- **Severity rationale.** Under `SEVERITY_SLA.md`, High covers "a fail-open shape on an
  admin/machine path". A guessed constant is not authentication, but the deduplication log is a
  partial compensating control and the write surface is narrow.
- **Recommended fix — already written, in the sibling file.** FO-04 is the same handler shape,
  three lines apart in the repository, and it fails closed. The remedy is to hoist
  `send-feedback-requests`' lines 8-10 into `send-reminders` ahead of line 9. **Not applied here.**
- **Finding candidate for plan 01-13:** High, Spoofing, threat T-01-07-02. Cross-referenced from
  `authz/service-role-register.json` row `api.cron.send-reminders`, verdict `needs-decision`.
- **Production context (do not over-read).** Plan 01-10 owns the cron inventory; the note that
  belongs here is only that production's scheduled jobs call SQL functions directly and none of
  them issues an HTTP request to this handler. That does **not** reduce the severity — it means
  the route may be reachable without being *used*, which removes the "it would break the
  schedule" objection to failing it closed. Plan 01-10 must confirm whether any external
  scheduler (Vercel cron, an external pinger) calls it before REFAC-13 acts.

### FO-03 — `src/middleware.ts`: the whole authentication ring is env-conditional. **Medium.**

```
 10    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
 11    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 13    // If Supabase env vars are missing, pass through without auth
 14    if (!supabaseUrl || !supabaseAnonKey) {
 15      return NextResponse.next({ request });
 16    }
```

- **Failure mode.** When either variable is unset the middleware returns immediately, before the
  session refresh, before the onboarding guard, and before the `PROTECTED_ROUTES` check at line
  115. Ring 1 disappears for **every** route matched by the middleware config, not for one
  handler. The comment at line 13 states the behavior plainly, so this is intentional.
- **Why Medium and not High.** Both variables are `NEXT_PUBLIC_*` and are load-bearing for
  essentially every other code path — the browser client, the server client and the auth callback
  all read them — so an application missing them does not serve a usable page for an attacker to
  reach. That is the compensating control, and it is structural rather than designed. It is also
  fragile: the variables are read here through `process.env` at request time in the middleware
  runtime, which is not the same resolution path as the inlined `NEXT_PUBLIC_*` values the client
  bundle receives at build time. A deployment where the build has them and the middleware runtime
  does not is exactly the configuration this branch was written for, and in that deployment the
  site serves normally with no auth ring at all.
- **Latent-hazard clause.** `SEVERITY_SLA.md` grades Medium as including "a latent hazard that
  becomes High after a plausible future change". Moving any authorization decision into the
  middleware — which is the natural next step for anyone hardening `PROTECTED_ROUTES` — makes
  this High immediately.
- **Adjacent, same file, not env-conditional so not a row here:** the outer `try` at line 18
  wraps the entire middleware body and its `catch` at lines 140-143 `console.error`s and returns
  `NextResponse.next({ request })`. The auth ring therefore also fails open on *any thrown
  error*, not only on missing configuration. Recorded in
  `.planning/audit/quality/error-observability.md` § 6 and cross-referenced to the
  `middleware_protected` column of `inventory/pages.json`; threat T-01-07-04.

### FO-04 — `/api/cron/send-feedback-requests`: the positive control. **No severity.**

```
  6  export async function POST(request: NextRequest) {
  7    // Verify cron secret
  8    if (!process.env.CRON_SECRET) {
  9      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
 10    }
 11    const authHeader = request.headers.get("authorization");
 12    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 13      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 14    }
 16    const supabase = createServiceClient();
```

Registered deliberately as a **negative row**. It reads the same variable, guards the same class
of handler, and constructs the same RLS-bypassing client — and it returns 500 rather than
degrading, so the misconfiguration is loud instead of silent. Two properties are worth naming
because they are what the fix for FO-02 must reproduce: the presence check is separate from the
comparison, and it runs *before* the comparison rather than being folded into it with `&&`
(folding it in is precisely how FO-01 fails). A register that listed only broken things would
leave a reader unable to tell whether the codebase has any idea what correct looks like. It does.

### FO-05 — `/auth/callback`: env-conditional role assignment. **Low.**

```
 22  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
 23    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
 27  function isAdminEmail(email: string): boolean { return ADMIN_EMAILS.includes(email.toLowerCase()); }
...
162  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
164      const serviceClient = createServiceClient();
187      if (isAdminEmail(email) && !currentRoles.includes("admin")) {
188        const newRoles = [...currentRoles, "admin"];
189        await serviceClient.from("users").update({ roles: newRoles }).eq("id", user.id);
193      }
197  } else {
198    console.error("[Callback] SUPABASE_SERVICE_ROLE_KEY is missing; skipping profile sync");
199  }
```

- **The grant fails closed.** `?? ""` at line 22 followed by `.filter(Boolean)` at line 25 yields
  an empty array when `ADMIN_EMAILS` is unset, so `isAdminEmail()` returns false for everyone and
  nobody is promoted. The ordering matters and is correct: `filter(Boolean)` removes the empty
  string that `"".split(",")` produces, which is what prevents an account with an empty email
  from matching. This is the right shape, and it is why the row is Low rather than Critical.
- **What does not fail closed** is the block around it. Line 162 gates the entire profile-sync on
  the service-role key being present; when it is absent the `else` at lines 197-199 logs and
  continues, and the user completes login with **no `public.users` row at all** —
  `needsOnboarding` stays `false` (its initialization at line 159), so the onboarding redirect is
  skipped for a user who has no profile. The same outcome occurs when the `try` at line 163
  throws, since the `catch` at lines 194-196 only `console.error`s. That is a fail-open on the
  *onboarding* guard rather than on an authorization check, which is why it sits at the bottom of
  this register rather than in `quality/error-observability.md`.
- **Why it is registered at all:** it is role assignment, driven by an environment variable,
  executed on an RLS-bypassing client, in the only anonymous-reachable route in the service-role
  register. It behaves correctly today. It is here so that a future edit to line 22 — for instance
  swapping `?? ""` for a default value, or dropping `.filter(Boolean)` — is recognized as a
  privilege-escalation change rather than a formatting one.

### FP-01 — `/api/admin/events:55`: detector false positive. **Not a finding.**

```
 55    if (status && status !== "all") {
 56      query = query.eq("status", status as "pending" | "approved" | "rejected");
 57    }
```

`inventory/endpoints.json` marks id `api.admin.events` with `env_gated_auth: true`. It is a false
positive of the generalized detector: `status` is a **query-string parameter** read at line 29
(`searchParams.get("status")`), not an environment variable, and the conditional shapes a query
filter rather than an authorization decision. The route's own gate is `verifyAdmin()` at line 23
with a 403 at lines 24-26 — the correct pattern — and its `signals.env_vars_referenced` is the
empty array, which is the field that settles it.

The row is retained in this register rather than deleted because
`validate.mjs --check authz-registers` requires every `env_gated_auth` route to appear here, and
because a documented false positive is the artifact that stops the next reviewer from
re-investigating it. **Correcting the signal is a job for plan 01-11**, which owns the
classification pass over `endpoints.json`: the `env_gated_auth` boolean should be recomputed as
`detector match AND env_vars_referenced is non-empty`, which would clear this row and keep
`api.admin.calculate-popularity`.

---

## 4. Method finding — the specified detector under-reports

The detector regex in `01-PATTERNS.md` § Grep targets,
`if\s*\(\s*[A-Za-z_]\w*\s*&&\s*[^)]*!==`, finds FO-01 and nothing else. It cannot find FO-02
(no `&&` — the check degrades instead of disappearing), cannot find FO-03 (the env values are
bound to local variables first, and the operator is `||` over negations), and cannot find FO-05
(the env read is the entire condition). Two of the four real rows, including the one whose
failure mode is most often overlooked, come from detectors B, C and D above.

**Finding candidate for plan 01-13: Low, method/coverage.** Any future sweep for this defect
class must run all four detectors, and the `env_gated_auth` signal in `endpoints.json` should be
redefined per FP-01. Recorded here because a detector that is believed complete and is not is
more dangerous than no detector.

---

## 5. Summary for the findings pipeline

| id | proposed severity | category | threat | fix owner |
|---|---|---|---|---|
| FO-01 | Critical | Elevation of Privilege | T-01-07-01 | REFAC-13, Stage 3 |
| FO-02 | High | Spoofing | T-01-07-02 | REFAC-13, Stage 3 |
| FO-03 | Medium | Elevation of Privilege | T-01-07-04 | Stage 3 auth slice |
| FO-04 | — | positive control | — | — |
| FO-05 | Low | Elevation of Privilege (latent) | — | Stage 3 auth slice |
| FP-01 | — | false positive | — | plan 01-11 (signal correction) |

No fix, refactor, or "obvious one-liner" was applied by this plan. Verified:
`git diff --exit-code --quiet -- src/` and `bash .planning/audit/tools/readonly-guard.sh`.

---

*Requirement AUDIT-10 · phase 01-read-only-foundation-audit · plan 01-07 · verified 2026-09-14*
