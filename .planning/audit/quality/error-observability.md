# AUDIT-14 — Error Handling and Observability Assessment

**Five quantities, five reproducible derivations.** Every number below carries the exact command
or the exact aggregation over `inventory/endpoints.json` that produced it, so a reader can
re-derive it rather than trust it.

| | |
|---|---|
| Requirement | AUDIT-14 |
| Produced by | plan 01-07, Task 3 |
| Inputs | `.planning/audit/inventory/endpoints.json` (`signals.has_try_catch`, `catch_any_count`, `console_count`), plus repository-wide scans for the repo-level measures |
| Measured at | 2026-09-14, on the tree at `.planning/audit/baseline/versions.txt` |
| Read-only | this plan reads `src/`, `next.config.js` and `package.json`, and writes only under `.planning/`; `git diff --exit-code -- src/` is clean |

---

## 1. The five quantities

| quantity | value | derivation |
|---|---|---|
| routes_without_try_catch | 22 | aggregate of `signals.has_try_catch === false` over all 94 route handlers — § 2 |
| routes_leaking_internal_error_text | 22 | repository scan over `src/app/**/route.ts` — § 3 |
| catch_any_count | 5 | aggregate of `signals.catch_any_count` — § 4 |
| console_call_count | 162 | repository-wide scan across 60 files — § 5 |
| request_correlation_callsite_count | 0 | repository-wide scan, zero hits after exclusions — § 6 |

Supporting count, recorded because §5's claim is a pair and not a single number:

| quantity | value |
|---|---|
| console_file_count | 60 |

**The two 22s are a coincidence, not a copy-paste.** The sets overlap in exactly 4 files
(`/api/events/[id]/report`, `/api/events/my-events`,
`/api/moderation/reviews/[targetType]/[targetId]`, `/api/organizer-requests`). The union is 40
distinct route files — 43% of the 94-handler surface has at least one of the two defects. The
overlap is computed in § 3.

---

## 2. `routes_without_try_catch = 22`

**22 of 94 route handler files contain no `try` block at all.**

```bash
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/inventory/endpoints.json","utf8"));const n=r.filter(x=>x.signals.has_try_catch===false);console.log(n.length+" of "+r.length);n.forEach(x=>console.log(x.file))'
```

Aggregated from the signal the inventory already captured in plan 01-02, not re-grepped — the
same discipline the service-role register follows, and for the same reason.

| # | file |
|---|---|
| 1 | `src/app/api/admin/analytics/events/route.ts` |
| 2 | `src/app/api/admin/analytics/users/route.ts` |
| 3 | `src/app/api/admin/audit-log/route.ts` |
| 4 | `src/app/api/admin/clubs/route.ts` |
| 5 | `src/app/api/admin/events/[id]/edits/route.ts` |
| 6 | `src/app/api/admin/experiments/[id]/results/route.ts` |
| 7 | `src/app/api/admin/experiments/[id]/route.ts` |
| 8 | `src/app/api/admin/experiments/route.ts` |
| 9 | `src/app/api/admin/organizer-requests/route.ts` |
| 10 | `src/app/api/admin/organizers/route.ts` |
| 11 | `src/app/api/admin/reports/route.ts` |
| 12 | `src/app/api/admin/stats/route.ts` |
| 13 | `src/app/api/admin/users/[id]/route.ts` |
| 14 | `src/app/api/admin/users/route.ts` |
| 15 | `src/app/api/clubs/[id]/members/role/route.ts` |
| 16 | `src/app/api/clubs/[id]/transfer/route.ts` |
| 17 | `src/app/api/events/[id]/report/route.ts` |
| 18 | `src/app/api/events/my-events/route.ts` |
| 19 | `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` |
| 20 | `src/app/api/onboarding/complete/route.ts` |
| 21 | `src/app/api/organizer-requests/route.ts` |
| 22 | `src/app/auth/signout/route.ts` |

**Why the list is here and not just the count.** A handler with no error handling is also a
handler with no *shaped* error: an unhandled throw becomes the framework's default 500, whose
body is not written by this codebase and whose content depends on the deployment's
`NODE_ENV` and on the Next.js version — a stack trace in one configuration and an opaque page in
another. The defect is therefore both an availability question and an
information-disclosure question, and neither can be judged without knowing which routes.

**14 of the 22 are under `/api/admin/`.** The concentration is not random: the admin routes are
the ones written against `verifyAdmin()`, whose early return makes the happy path look total.
Note the intersection with AUDIT-07 — `/api/admin/events/[id]/edits`, `/api/admin/organizers`,
`/api/admin/reports`, `/api/clubs/[id]/transfer` and `/api/moderation/reviews/…` all construct
the RLS-bypassing client (`authz/service-role-register.md`) inside a handler with no error
handling, so a mid-operation throw leaves whatever partial service-role writes have already
committed, with no compensating rollback and no record.

---

## 3. `routes_leaking_internal_error_text = 22`

**22 route handler files place an internal error object's message into a response body the
client receives**, across 40 distinct lines. This is an information-disclosure class, not a
style question: a PostgREST error message names tables, columns, constraints and policy
violations, and the anonymous trust boundary is on the other side of that response.

The measure is: *a line in a `route.ts` file that reads `.message` from an error-named binding
(or `String(err…)`), excluding comments, `console.*` sinks and `throw` statements.* Comments and
`console.*` are excluded deliberately — logging an internal message server-side is correct
behavior, and only the response body crosses the boundary.

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const READ=/\b[A-Za-z_]*[eE]rr(or)?[A-Za-z_]*\??\.message\b|String\(\s*[A-Za-z_]*[eE]rr(or)?[A-Za-z_]*\s*\)/;
const SINK=/^\s*(\/\/|\*)|console\.|throw /;
const files=cp.execSync("find src/app -name route.ts",{encoding:"utf8"}).trim().split("\n").sort();
const hits=[];
for(const f of files){
  const ls=fs.readFileSync(f,"utf8").split("\n");
  const bad=ls.map((l,i)=>[i+1,l]).filter(([,l])=>READ.test(l)&&!SINK.test(l));
  if(bad.length)hits.push([f,bad]);
}
console.log("FILES:",hits.length,"LINES:",hits.reduce((a,[,b])=>a+b.length,0));
hits.forEach(([f,b])=>console.log(f+"  ->  "+b.map(x=>x[0]).join(", ")));
'
# -> FILES: 22 LINES: 40
```

| file | leaking lines | shape |
|---|---|---|
| `src/app/api/admin/calculate-popularity/route.ts` | 124, 134 | per-event RPC errors accumulated into `results.errors[]` and returned in the 200 body |
| `src/app/api/auth-debug/route.ts` | 39 | `serverError` field of the debug payload |
| `src/app/api/calendar/events/route.ts` | 71 | `{ error: error.message }`, 500 |
| `src/app/api/clubs/[id]/appeal/route.ts` | 69, 84 | `{ error: reviewError.message }` / `{ error: updateError.message }`, 500 |
| `src/app/api/clubs/featured/route.ts` | 17 | `{ error: error.message }`, 500 |
| `src/app/api/events/[id]/appeal/route.ts` | 69, 84 | same pair as the club appeal route |
| `src/app/api/events/[id]/report/route.ts` | 67 | `{ error: insertError.message }`, 500 |
| `src/app/api/events/[id]/route.ts` | 95, 290, 325, 406 | three Supabase errors at 500; line 290 is an app-generated date-validation message at 400 (see below) |
| `src/app/api/events/create/route.ts` | 78, 193 | line 78 app-generated validation at 400; line 193 Supabase error at 500 |
| `src/app/api/events/export/route.ts` | 211 | `{ error: eventsError.message }`, 500 |
| `src/app/api/events/featured/route.ts` | 17 | `{ error: error.message }`, 500 |
| `src/app/api/events/happening-now/route.ts` | 40, 51 | 500 body plus a `details` field carrying the caught message |
| `src/app/api/events/my-events/route.ts` | 24 | `{ error: error.message }`, 500 |
| `src/app/api/events/route.ts` | 278 | **partially guarded** — the raw message is returned at line 301 only when it does not start with `{`; see below |
| `src/app/api/health/route.ts` | 118, 143, 167, 181, 211, 214, 247, 322, 383 | nine sites, all interpolated into `HealthCheck.message`, on an anonymous-reachable route |
| `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` | 56 | `{ error: error.message }`, 500 |
| `src/app/api/notifications/[id]/route.ts` | 31 | `{ error: error.message }`, 500 |
| `src/app/api/notifications/route.ts` | 41, 94 | `{ error: error.message }`, 500 |
| `src/app/api/organizer-requests/route.ts` | 56, 81 | `{ error: error.message }`, 500 |
| `src/app/api/recommendations/batch/route.ts` | 20 | `{ error: "Batch scoring failed", details: error.message }`, 500 |
| `src/app/api/user/following/route.ts` | 45 | `{ error: error.message }`, 500 |
| `src/app/auth/callback/route.ts` | 92 | `exchangeError.message` URL-encoded into a redirect query string — the message lands in the browser address bar and in any referrer |

**Three rows deserve their qualification rather than a flat count:**

- **App-generated validation messages are not leaks.** `src/app/api/events/[id]/route.ts:290` and
  `src/app/api/events/create/route.ts:78` return `dateError.message` at status 400, where
  `dateError` is produced by this codebase's own date validator and the text is intended for the
  user. Both files remain in the count because each also has at least one genuine internal leak
  (lines 95/325/406 and line 193 respectively), all at 500 and all from Supabase.
- **`src/app/api/events/route.ts` shows what a partial fix looks like.** Lines 298-301 filter the
  message, but the filter's only test is whether it starts with `{` — a guard against a malformed
  JSON body, not against disclosure. Any well-formed PostgREST message passes through. Worth
  citing in the fix slice as evidence that the team has already encountered the symptom.
- **`src/app/api/health/route.ts` is the highest-exposure row.** Nine leaking sites, no
  authorization gate of any kind (`inventory/endpoints.json` id `api.health`:
  `calls_verify_admin`, `calls_get_user` and `calls_check_ban` all `false`), and the leaked text
  includes database table names (line 118), error codes (line 122) and the Supabase Auth and
  Azure OAuth configuration state (lines 167, 211-216). It also holds all five of the repository's
  `catch (error: any)` clauses — § 4.

### Overlap with § 2

```bash
node -e '/* both scans above, intersected */' # full command in the plan 01-07 execution log
# -> noTry 22   leak 22   both 4
```

| in both sets |
|---|
| `src/app/api/events/[id]/report/route.ts` |
| `src/app/api/events/my-events/route.ts` |
| `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` |
| `src/app/api/organizer-requests/route.ts` |

40 distinct route files carry at least one of the two defects.

---

## 4. `catch_any_count = 5`

**Five `catch` clauses are typed as the permissive `any`, and all five are in one file.**

```bash
# aggregate over the inventory signal
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/inventory/endpoints.json","utf8"));console.log(r.reduce((a,x)=>a+(x.signals.catch_any_count||0),0));r.filter(x=>x.signals.catch_any_count>0).forEach(x=>console.log(" ",x.file,x.signals.catch_any_count))'
# -> 5
# ->   src/app/api/health/route.ts 5

# independent repository-wide confirmation
command grep -rnE 'catch\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*any\s*\)' src/ | wc -l   # -> 5
command grep -rlE 'catch\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*any\s*\)' src/ | wc -l   # -> 1
```

`src/app/api/health/route.ts` lines 139, 177, 243, 319 and 375. Each is immediately followed by
an unguarded `error.message` read — which is exactly the hazard the `any` annotation creates: a
thrown non-`Error` value (a string, or a rejected promise carrying an object) makes
`error.message` `undefined` and the handler reports `"Database connection failed: undefined"`.
The `unknown`-plus-narrowing shape used at `src/app/api/events/happening-now/route.ts:51`
(`error instanceof Error ? error.message : String(error)`) is the correct pattern and already
exists in the codebase.

**Both this number and the concentration matter.** Five is small; that all five sit in the one
route that is anonymous-reachable and returns its error text to the caller is why the row is
worth keeping rather than closing as trivial.

---

## 5. `console_call_count = 162` across `console_file_count = 60` files

```bash
command grep -rnoE 'console\.(log|error|warn|info|debug|trace|table|dir|group|groupEnd|time|timeEnd|assert|count)\s*\(' src/ | wc -l   # -> 162
command grep -rlE  'console\.(log|error|warn|info|debug|trace|table|dir|group|groupEnd|time|timeEnd|assert|count)\s*\(' src/ | wc -l   # -> 60
```

`command grep` rather than bare `grep`: the shell's `grep` is a ugrep shim that honours
`.gitignore`, so a count taken through it is not reproducible on a checkout with different
ignore rules.

| distribution | calls |
|---|---|
| `src/app/api` | 120 |
| `src/app` (incl. the above, plus pages and the auth routes) | 143 |
| `src/components` | 12 |
| `src/store` | 3 |
| `src/hooks` | 2 |
| `src/lib` | 1 |
| `src/middleware.ts` | 1 |

| by level | calls |
|---|---|
| `console.error` | 146 |
| `console.warn` | 9 |
| `console.log` | 7 |
| `console.info` / `console.debug` | 0 |

Heaviest files: `src/app/auth/callback/route.ts` (15), `src/app/api/events/[id]/rsvp/route.ts`
(13), `src/app/api/admin/users/[id]/ban/route.ts` (10).

**There is no logger.** No `pino`, `winston`, `bunyan`, `logtail` or equivalent appears in
`package.json`; every one of the 162 calls writes an unstructured line with no level field, no
timestamp of its own, no request context and no machine-parseable shape. `console.error` at 90%
of the total means severity is effectively a single value — a rate-limit warning and a
service-role write failure are indistinguishable to any log query.

### The older counts are stale — record both

`.planning/codebase/CONCERNS.md` ("Analysis Date: 2026-03-05") § Tech Debt states **"179
console.log/error/warn calls across 62 files with no structured logging"**.

| source | calls | files | status |
|---|---|---|---|
| `.planning/codebase/CONCERNS.md`, 2026-03-05 | 179 | 62 | **STALE** — superseded by the commands above |
| this artifact, 2026-09-14 | **162** | **60** | current |

The direction of the drift is worth a sentence: the count went *down* by 17 across 2 fewer files,
so some cleanup happened, but the structural claim — "no structured logging" — is unchanged and
remains correct. The same document is stale on two further counts (see
`authz/getsession-register.md` § 3); plan 01-13 should file one grouped stale-documentation
finding rather than several.

**Adjacent, same root cause, counted here for the record:** 66 `as any` assertions across 33
files (`command grep -rnoE 'as any' src/ | wc -l`; `command grep -rlE 'as any' src/ | wc -l`).
CONCERNS.md describes this as "18+ `(supabase as any)` casts". The casts matter to this
assessment because each one suppresses the type error that would otherwise surface a schema
drift at build time, converting a compile-time signal into a runtime error that lands in the
unstructured log described above. AUDIT-15 (plan 01-05) owns the disposition.

---

## 6. `request_correlation_callsite_count = 0`

**No correlation identifier is generated, propagated or logged anywhere, on either runtime.**

```bash
command grep -rniE 'x-request-id|requestId|correlationId|correlation_id|traceId|trace_id|@sentry|Sentry\.' src/   # -> 12 lines, all excluded below
command grep -niE 'sentry|datadog|opentelemetry|pino|winston|logtail|bugsnag|rollbar' package.json                # -> no output
```

All 12 raw matches are excluded, each for a stated reason — the exclusions are published so the
zero is falsifiable:

| match | lines | why excluded |
|---|---|---|
| `src/app/api/users/me/requests/route.ts` | 36, 40, 48 | `requestIds` is an array of **organizer-request row ids**, a domain identifier |
| `src/app/moderation/organizer-requests/page.tsx` | 61, 62, 65, 72 | `requestId` is the same domain identifier in a click handler |
| `src/store/useAuthStore.ts` | 121, 130, 135, 147, 156 | `authRequestId` is a monotonic counter used to discard stale in-flight auth responses — client-side, never transmitted, never logged |

What this adds up to, stated plainly:

- **No correlation id.** Nothing ties a middleware log line to the route-handler log lines from
  the same request, and nothing ties either to a browser session.
- **No propagation.** No inbound `x-request-id` is read, and none is set on any response, so a
  platform-generated id (Vercel emits one) is not carried into application logs either.
- **No error-reporting service.** No Sentry, no OpenTelemetry, no APM of any kind in
  `package.json`.
- **Two runtimes, no shared context.** `src/middleware.ts` runs in the edge/middleware runtime and
  the handlers in the Node runtime; with no correlation id there is no mechanism that could link
  them even in principle.

**Consequence.** A production failure today is investigable only by reading a flat, unstructured,
uniformly-`error`-level stream with no way to select the lines belonging to one request, one
user or one incident. That is the operative meaning of the four numbers above: 22 handlers throw
without shaping an error, 22 return the internal message to the caller instead of to an operator,
and nothing on the operator's side can reconstruct what happened.

**This is the baseline REFAC-20 is measured against.** All five quantities are stated as integers
precisely so that the same commands, re-run after REFAC-20, produce a comparable number. The
success condition for that work is `request_correlation_callsite_count > 0` with propagation
across both runtimes, `routes_leaking_internal_error_text = 0`, and `console_call_count`
displaced by a structured logger rather than merely reduced.

---

## 7. Contextual record — the middleware fails open on error

`src/middleware.ts` wraps its **entire body** in a `try` at line 18 whose `catch` at lines 140-143
logs and continues the request:

```
140    } catch (e) {
141      // If middleware fails, pass through rather than 500ing the entire site
142      console.error("[Middleware] Error:", e);
143      return NextResponse.next({ request });
144    }
```

Anything thrown between line 18 and line 138 — a Supabase call failing, the cookie handling
throwing, the onboarding lookup erroring — drops the session refresh, the onboarding guard and
the `PROTECTED_ROUTES` check at line 115, and the request proceeds unauthenticated. The comment
records the intent, and the availability trade-off is defensible; what is not recorded anywhere
in the codebase is that the failure is **silent to the user and invisible to an operator** —
line 142 is one of the 162 unstructured `console.*` calls, with no correlation id (§ 6), so a
middleware that is failing open continuously looks identical to one that is working.

- **Cross-reference:** `inventory/pages.json` — the `middleware_protected` column is `true` for
  the 8 routes in `PROTECTED_ROUTES`, and that column should be read as *"protected when the
  middleware does not throw"*. The three pages whose `effective_protection` depends on
  `middleware_protected` alone, with no `layout_guard` and no `page_guard`, have no second ring
  at all in that state. The `src/app/admin/layout.tsx` and `src/app/moderation/layout.tsx`
  guards are unaffected, which is the argument for treating layout guards as the real ring.
- **Related but distinct:** the *env-conditional* pass-through at `src/middleware.ts` lines 10-16
  is registered separately as FO-03 in `authz/fail-open-register.md`. That one fires on missing
  configuration; this one fires on any thrown error. Both produce the same unauthenticated
  pass-through.
- **Threat:** T-01-07-04. Middleware is advisory-only by design in the target architecture, so
  this is a finding about *observability and about what the page inventory's columns mean*, not a
  demand that the middleware start returning 500.

---

## 8. Positive control — what already exists

An assessment that reports only absences is not calibrated. Two controls are present and working:

**Security headers, `next.config.js` lines 20-50**, applied to `/(.*)`:

| header | value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | `default-src 'self'` with `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and an explicit `img-src`/`connect-src` allowlist |

This is a real, deliberately-configured baseline, not a framework default. Two caveats belong in
the record so the row is not over-credited: the CSP carries `'unsafe-inline' 'unsafe-eval'` on
`script-src`, which is the common Next.js accommodation and materially weakens the XSS control
it otherwise provides; and `Referrer-Policy: strict-origin-when-cross-origin` does **not** strip
the query string on same-origin navigations, which interacts with the `/auth/callback` leak at
§ 3 (`exchangeError.message` is placed in a query parameter).

**Rate limiting.** `src/middleware.ts` line 7 applies `applyApiRateLimit(request)` before any auth
work, so the public API surface has a first-line control that runs even on the paths where the
auth ring is skipped.

---

## 9. Summary for the findings pipeline

| candidate | proposed severity | basis |
|---|---|---|
| Internal error text returned to the client across 22 route files, 40 sites | **Medium**, rising to **High** for `/api/health` | anonymous-reachable for `/api/health` and `/auth/callback`; authenticated-but-cross-boundary elsewhere; T-01-07-05 |
| 22 route handlers with no error handling, 14 of them admin, 5 of them on the RLS-bypassing client | **Medium** | unshaped framework 500s; partial service-role writes with no record |
| No request correlation, no structured logging, no error reporting | **Medium** | not directly exploitable; it is what makes every other finding un-investigable in production. REFAC-20 baseline |
| Middleware fails open on any thrown error, silently | **Medium** | T-01-07-04; pairs with FO-03 in `authz/fail-open-register.md` |
| 5 `catch (error: any)` clauses, all in `/api/health` | **Low** | `undefined` in an error message; the correct `unknown` pattern already exists in the codebase |
| `CONCERNS.md` console census (179/62) stale against 162/60 | **Low** | group with the other stale-documentation candidates |

---

*Requirement AUDIT-14 · phase 01-read-only-foundation-audit · plan 01-07 · measured 2026-09-14*
