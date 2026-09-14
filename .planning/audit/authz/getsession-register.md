# AUDIT-09 — Session-Reading Callsite Register

**One callsite in the entire repository, and it is non-gating.**

| | |
|---|---|
| Requirement | AUDIT-09 |
| Produced by | plan 01-07, Task 2 |
| Derived from | `.planning/audit/inventory/endpoints.json` → `signals.calls_get_session === true`, **plus** a repository-wide grep over `src/` to catch non-route callsites |
| Baseline agreement | `.planning/audit/baseline/versions.txt` → `get_session_callsite_count=1` |
| Read-only | this plan reads `src/` and writes only under `.planning/`; `git diff --exit-code -- src/` is clean |

**This is a negative finding, and it is a deliverable.** `getSession()` reads the session from
the cookie without asking the auth server to verify it, so Supabase's own guidance is that it
must never carry an authorization decision on the server. The March codebase map records that
it does, in two routes. It does not, in either — and the artifact that says so is worth more
than an empty section, because the next person to read that map will otherwise re-open the
question.

---

## 1. Discovery — both sources, with the commands

The endpoint inventory signal and an independent repository-wide grep are run against each
other; agreement is what licenses the claim that the population is complete.

```bash
# source 1 — the endpoint inventory signal (94 route handlers)
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/inventory/endpoints.json","utf8"));r.filter(x=>x.signals.calls_get_session===true).forEach(x=>console.log(x.file,x.route))'
# -> src/app/api/health/route.ts /api/health

# source 2 — repository-wide, so that pages, components, hooks, stores and lib modules
# are covered and not just route.ts files. `command grep` bypasses the ugrep shim.
command grep -rn 'getSession' src/
# -> src/app/api/health/route.ts:160
# -> src/hooks/useTracking.ts:6,29,48          (excluded — see below)

# and the baseline's own re-derivation
command grep -n '^get_session_callsite_count=' .planning/audit/baseline/versions.txt
# -> get_session_callsite_count=1
```

**Excluded matches.** `src/hooks/useTracking.ts` lines 6, 29 and 48 call a locally-declared
`getSessionId()` (`function getSessionId(): string` at line 6) that mints an
analytics-correlation string for the `session_id` column of `user_interactions`. It is a name
collision, not a Supabase auth call: it never touches `supabase.auth`, and it is client-side.
Recording the exclusion rather than silently dropping it is what makes the count of 1
falsifiable by the next reader.

No `getSession()` call exists anywhere in `src/app`, `src/components`, `src/lib`, `src/store` or
`src/middleware.ts` other than the one row below.

---

## 2. The register

| # | file:line | enclosing function | gating or non-gating? | result used for |
|---|---|---|---|---|
| 1 | `src/app/api/health/route.ts:160` | `checkSupabaseAuth()` (lines 153-185) | **non-gating** | liveness reporting only — the returned session is discarded |

### 1. `src/app/api/health/route.ts:160` — non-gating

```
153  async function checkSupabaseAuth(): Promise<HealthCheck> {
...
158      // Try to get the current session (will return null if no user, but connection works)
159      // Check if the connection to the Supabase Auth service is working
160      const { data, error } = await supabase.auth.getSession();
...
164      if (error) { return { status: "unhealthy", message: `Supabase Auth error: ${error.message}`, ... }; }
172      return { status: "healthy", message: "Supabase Auth is operational", responseTime };
```

- **Classification:** non-gating. It does not gate access to anything.
- **Why it is safe, explicitly:** the call is a **liveness probe** of the Supabase Auth service.
  Only `error` is read (line 164). The `data` binding — the session itself, the spoofable part —
  is destructured at line 160 and then **never referenced again anywhere in the file**; no
  branch, no filter, no response field derives from it. A forged session cookie therefore
  changes nothing an attacker could want: it cannot flip `status`, because a *valid* session and
  *no* session both produce `status: "healthy"` (the doc comment at line 158 says so
  deliberately — "will return null if no user, but connection works"). The only way to change
  the outcome is to make the auth service itself return an error, which is not something a
  cookie can do.
- **Is `getUser()` the right replacement?** No — and this matters, because the obvious
  remediation is wrong here. `getUser()` performs a network round-trip to the auth server, which
  is precisely what a liveness probe wants, but it returns an error for an anonymous caller, and
  `/api/health` is anonymous-reachable by design. Swapping it would make the health check report
  the service as unhealthy whenever nobody is signed in. The call is correct as written; the
  defect class simply does not apply to it.
- **Reachability context, recorded so this row is not re-litigated:** `/api/health` has no
  authorization gate at all — see `inventory/endpoints.json` id `api.health`, where
  `calls_verify_admin`, `calls_get_user` and `calls_check_ban` are all `false`. That is an
  AUDIT-03 question about the route (it returns memory statistics, table names and OAuth
  configuration state to an anonymous caller), **not** an AUDIT-09 question about this line.
  It is noted here so plan 01-13 picks it up from the right register. The route also holds all
  5 of the repository's `catch (error: any)` clauses and returns `error.message` to the caller
  in 9 places — see `.planning/audit/quality/error-observability.md`.

---

## 3. The negative finding — the March map is stale

**Stale source: `.planning/codebase/CONCERNS.md`, "Analysis Date: 2026-03-05", § Known Bugs,
lines 39-43.** It states:

> **`getSession()` used for auth checks instead of `getUser()`:**
> Two API routes use `supabase.auth.getSession()` for authentication. […]
> Files: `src/app/api/recommendations/analytics/route.ts` (line 19), `src/app/api/health/route.ts` (line 160)

Both halves of that claim are now wrong, and the second one is wrong in a way that matters:

| claim (2026-03-05) | evidence today (2026-09-14) | status |
|---|---|---|
| "Two API routes use `getSession()` for authentication" | one callsite exists in the whole repository | **superseded** |
| `src/app/api/recommendations/analytics/route.ts:19` reads a session | line 19 is the closing brace of the admin guard. The handler now calls `verifyAdmin()` at line 16 — the `getUser()`-plus-role-check helper in `src/lib/admin.ts` — and returns 403 at line 18. The file contains no `getSession` at any line. | **fixed since; doc not updated** |
| `src/app/api/health/route.ts:160` is used "for authentication" | the callsite exists at exactly that line, but discards the session — see §2 | **misclassified** (CONCERNS.md's own workaround note already concedes it is "not for access control") |
| (same document, § Security Considerations) "Admin analytics endpoint lacks authorization — `GET /api/recommendations/analytics` requires only any authenticated session. The TODO on line 25 notes admin restriction should be added but is not implemented." | `verifyAdmin()` at line 16, `if (!isAdmin)` at line 17, 403 at line 18; the TODO is gone | **superseded by the same fix** |

```bash
# reproduction of the correction
command grep -n 'getSession' src/app/api/recommendations/analytics/route.ts   # -> no output, exit 1
sed -n '14,20p' src/app/api/recommendations/analytics/route.ts
```

**Finding candidate for plan 01-13 — stale documentation, Low.** `.planning/codebase/CONCERNS.md`
asserts a live authentication defect that was remediated at least once between 2026-03-05 and
2026-09-14 without the document being revised. Severity Low under `SEVERITY_SLA.md` (hygiene:
stale documentation), but the *exposure* is not zero: a planner reading that map would schedule
a `getSession` migration slice that has no work in it, and would trust the same document's other
unverified claims. Two of them are already known to be off — the `console.*` census (see
`quality/error-observability.md` § 4) is the other. Recommended disposition: annotate
`CONCERNS.md` with a verified-against date rather than deleting it, so the correction is
traceable.

This is the second stale-documentation candidate this phase has produced from the same class of
source; `baseline/versions.txt` carries three more (route count, migration count, protected-route
drift). Plan 01-13 should file them as one grouped finding rather than five.

---

## 4. Guard against regression

The property this register asserts is *"no session read decides anything"*, and it is cheap to
keep asserting:

```bash
# every getSession callsite in the repo, minus the known liveness probe
command grep -rn 'auth\.getSession' src/ | command grep -v 'src/app/api/health/route.ts:160'
# any output at all = a new callsite that this register has not classified
```

`validate.mjs --check authz-registers` enforces the weaker machine-checkable version: every
route the endpoint inventory flags with `signals.calls_get_session` must appear in this file,
and this file must carry an explicit gating / non-gating classification.

---

*Requirement AUDIT-09 · phase 01-read-only-foundation-audit · plan 01-07 · verified 2026-09-14*
