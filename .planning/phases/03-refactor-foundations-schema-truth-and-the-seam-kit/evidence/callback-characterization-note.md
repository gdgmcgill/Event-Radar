# The auth callback characterization — what it pins, and what it does not

**Plan:** 03-02 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

REFAC-08 asks for "auth callback characterization tests **before** it is
modified." That word is the requirement. `src/app/auth/callback/route.ts` carries
McGill email enforcement — which PROJECT.md § Constraints names as
non-negotiable — plus profile upsert, admin auto-assignment and onboarding
routing. Phases 5 and 6 rewrite the authorization ring around it. A contract
written after the first edit records whatever the edit produced; this one was
written against source that nobody touched, and `callback-unmodified.txt` proves
the file is byte-identical to where the plan started.

---

## 1. The eight behaviours, tagged

Tags are against real finding ids read from `.planning/audit/findings.json`. Where
a behaviour maps to no existing finding, this note says so rather than inventing
an id — two of the eight have no finding, and that is a fact about the audit, not
a gap in the tagging.

| # | Behaviour | Source | Tag | Finding |
|---|-----------|--------|-----|---------|
| 1 | An inbound provider `error` parameter passes through to `/?error=<param>` **before** any exchange is attempted | `route.ts:42-47` | **PRESERVE** | none — no audit finding covers this branch |
| 2 | An absent `code` parameter redirects to `/?error=no_code` | `route.ts:49-54` | **PRESERVE** | none — no audit finding covers this branch |
| 3 | A failed `exchangeCodeForSession` redirects to `/?error=auth_failed&message=<provider message>` | `route.ts:89-94` | **PRESERVE** | none directly. Note the provider's message is reflected into a URL the browser follows; not an audit finding, but worth a second look in Phase 5 |
| 4 | A non-McGill address is signed out, its orphaned `auth.users` row deleted by id, and rejected with `/?error=not_mcgill` | `route.ts:113-134` | **PRESERVE** — the highest-value assertion in this suite | none. This is the constraint PROJECT.md calls non-negotiable, and the audit raised nothing against it because it works |
| 5 | A new McGill user's profile is upserted (`onConflict: "id"`, `ignoreDuplicates: false`) and they are routed to `/onboarding` with `needs_onboarding=1` | `route.ts:148-154, 165-183, 203-231` | **PRESERVE** | none |
| 6 | An already-onboarded McGill user is routed to the `next` destination with no onboarding cookie | `route.ts:183, 203-205` | **PRESERVE** | none |
| 7 | An address in `ADMIN_EMAILS` has `"admin"` appended to its existing roles, on a service-role client, during sign-in | `route.ts:22-29, 186-193` | **DEFECT** | **F-004** (Low, Open, closes in phase 05) |
| 8 | When `SUPABASE_SERVICE_ROLE_KEY` is absent, profile sync is skipped **wholesale** and the user is admitted anyway | `route.ts:162, 197-199` | **DEFECT** | **F-004** (the fail-open half, same block) and **F-040** (High, Open, closes in phase 05) |

**Why 7 and 8 are DEFECT rather than PRESERVE.** F-004's own wording: the
allowlist block "is the only automatic privilege-grant path in the codebase — a
future edit to the allowlist is a privilege escalation, not a configuration
tweak, and it runs on a service-role client. The onboarding half of the same
block fails open, skipping profile sync entirely when the variable is absent."
The recommended fix moves the role grant out of the sign-in path entirely and
separates it from profile sync so the two stop sharing a failure condition.

Tagging them DEFECT does not mean the tests should be deleted when the defect is
fixed. It means the opposite: they exist so that Phase 5 removes this behaviour
**deliberately**, sees exactly which assertions go red, and updates them as a
recorded decision — rather than removing it by accident and discovering the
consequence in production. A DEFECT test is a tripwire with a note attached.

Behaviours 1–6 are PRESERVE: they must still hold, byte-for-byte, after every
later phase touches this route.

---

## 2. Why the mock seams are these three and not the obvious one

The route's own import block, `route.ts:13-18`:

```ts
import { createServerClient } from "@supabase/ssr";           // line 13
import { createClient } from "@supabase/supabase-js";         // line 14
import { createServiceClient } from "@/lib/supabase/service"; // line 18
```

Three imports, three mocks:

| Seam | Why the route reaches for it |
|------|------------------------------|
| `@supabase/ssr` → `createServerClient` | The cookie-bearing session client. `exchangeCodeForSession`, `getUser` and `signOut` all hang off it. |
| `@supabase/supabase-js` → `createClient` | A **second, separate** service-role client built inline at `route.ts:122-125`, for one purpose only: `auth.admin.deleteUser` on the non-McGill rejection path. The anon client cannot call auth admin methods. |
| `@/lib/supabase/service` → `createServiceClient` | The RLS-bypassing client for the upsert, the profile read and the admin role update. |

**The trap this avoids.** Every other route test in this repo mocks
`@/lib/supabase/server` — `src/__tests__/api/events/rsvp.test.ts:52` does exactly
that, correctly, because that route imports it. **This route does not import it
at all.** Mocking it here would have registered a mock that nothing resolves,
left the real `@supabase/ssr` in the module graph, and produced a suite that
looked right in review and tested nothing. 03-PATTERNS.md flags this explicitly;
the seams above were read off the subject's import block rather than copied from
the neighbouring suite.

**The second trap: `ADMIN_EMAILS` is parsed at module load.**

```ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")   // route.ts:22-25
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
```

Setting `process.env.ADMIN_EMAILS` inside a `beforeEach` does nothing to an
already-imported module. Behaviour 7's test would then run against an empty
allowlist, assert an update that never happened, and fail — or worse, be
"fixed" by weakening the assertion until it passed. The suite's `loadRoute()`
helper calls `jest.resetModules()` and re-imports so the constant is
re-evaluated; every test uses it so no reader has to work out which ones needed
it. By contrast `SUPABASE_SERVICE_ROLE_KEY` is read **per request**
(`route.ts:162`), so behaviour 8 needs no reload. That asymmetry — one privilege
input frozen at boot, one re-read every request, in the same block — is itself a
characterized fact and part of why F-004 registers the block at all.

---

## 3. Every assertion bites — the WR-04 countermeasure

`02-REVIEW.md` **WR-04** found that `src/proxy.test.ts` asserts only
`config.matcher`, so "deleting every entry from `proxy.ts:114`, or deleting the
redirect block at `proxy.ts:115-121` entirely, leaves this suite green. A
PRESERVE suite whose assertions cannot fail when the preserved behavior is
removed is a false sense of coverage."

That criticism applies to this plan's deliverable by default, so it was answered
mechanically rather than by assertion. Every test here constructs a
`NextRequest`, calls the exported `GET`, and asserts on the returned
`NextResponse` — status, `location` parsed as a URL, cookies, or a mock's call
arguments. None reads a shape off the module. Then each characterized branch was
removed from the route in turn and the red recorded:

**Nine mutation cycles, nine reds, zero greens, nine naming the expected test.**
Full record in `callback-mutation-check.txt`; the route's hash is identical
before the first mutation and after the last restoration.

---

## 4. Four things this suite does **not** prove

These are the facts a later reader is most likely to get wrong, so they are
stated plainly rather than left to inference.

### 4.0 Behaviour 6 pins an OPEN REDIRECT — **`F-077`**, added after this note was written

Raised by the Phase 3 code review (`03-REVIEW.md` WR-11) and registered, not fixed.

`route.ts:37` reads `next` straight from the query string with no shape check, and `route.ts:205`
does `new URL(next, requestUrl.origin)` — where an **absolute** value wins over the base. So
`?next=https://evil.example/` sends the freshly-authenticated user off-origin **with the session
cookies already set on the response**.

Test 6 above is tagged **PRESERVE**, under a header stating these expectations "must pass
byte-for-byte identically afterwards". That is the part that makes this belong in *this* file rather
than only in the register: **the characterization freezes the missing validation into the contract
Phases 5-6 are instructed to keep.** A later phase reading only the tag would conclude, correctly by
the tag and wrongly in fact, that the current `next` handling is the behaviour to protect.

It is **not** a Phase 3 fix because adding the guard is an application behaviour change on the
authentication path, and the suite that pins the current behaviour is itself a Phase 3 deliverable —
editing the safety net and the thing it measures in one commit is not a review fix.

**When Phase 5 fixes it, test 6 is expected to change**, and that change is sanctioned here in
advance so nobody reads it as a PRESERVE violation. The fix and its test are specified in `F-077`;
the `!raw.startsWith("//")` half is load-bearing, because `//evil.example` is protocol-relative and
passes a naive leading-slash check.

Exploitation is not direct — `src/components/auth/SignInButton.tsx:30` only ever sets a pathname, so
an attacker needs their value in the OAuth `redirect_to`, which is governed by the Supabase redirect
allow-list this repository neither controls nor captures. That is why `F-077` is Medium and not High,
and it is also a second thing for Phase 5 to check.

### 4.1 The admin-assignment path does not fire in production today

`ADMIN_EMAILS` is **absent from production's configured environment variables**.
F-040 records that only three variables are configured on Vercel —
`ADMIN_API_KEY`, `CRON_SECRET` and `ADMIN_EMAILS` are all missing — and F-004's
severity rationale turns on it: "Fails closed today: ADMIN_EMAILS is not
configured in production, so the empty allowlist promotes nobody."

Behaviour 7 therefore pins **code behaviour**, not **observed production
behaviour**. The test is correct and it is valuable — it is the only thing
standing between a future one-line environment change and a silent privilege
escalation — but the distinction matters: this is a contract about what the code
does if the variable is set, not a claim about what the deployed application is
doing. Anyone citing this suite as evidence that admin assignment "works in
production" would be citing it wrongly.

The same absence is why behaviour 8 is a live production condition rather than a
hypothetical: if the service key were ever unset on the deployed app, sign-in
would keep working and profile sync would silently stop.

### 4.2 The Playwright persona harness never traverses this route

The personas built in plan **03-07** authenticate by **cookie injection** —
serializing a session directly into storage state rather than completing an OAuth
round trip. 03-RESEARCH.md § Pattern 6 states the limitation outright: personas
authenticated that way "**never traverse `/auth/callback`**. McGill enforcement
and admin auto-assignment live in that route and are covered by REFAC-08's unit
characterization, not by the harness."

So this suite is **the only coverage McGill enforcement and admin
auto-assignment receive anywhere in Phase 3**. Adding six end-to-end specs does
not add a single assertion against this route. If these eight tests are weakened,
nothing else catches it.

### 4.3 The five signed-in Tier 3 steps remain a human item

`STAGE-2-COMPLETION.md` § 13, row **STAB-06**, carries five smoke steps that
still need a human with a real McGill account: real McGill sign-in, non-McGill
rejection, mid-onboarding redirect, non-banned user, and save/RSVP. They are
`02-UAT.md` test 1 and they are **not** discharged by this plan.

The overlap is real but partial. Behaviour 4 pins the *handler's* response to a
non-McGill address with every collaborator mocked; it says nothing about whether
Azure returns the address in the shape the handler expects, whether the real
`auth.admin.deleteUser` succeeds against a real orphaned row, or whether the
session cookies Supabase chunks across several `Set-Cookie` headers survive the
accumulator at `route.ts:56-80`. That accumulator is, deliberately, **not**
characterized here: the `createServerClient` mock never invokes the `cookies`
adapter, so `allCookies` stays empty in every test. Cookie chunking is an
integration property and needs an integration test.

---

## 5. Scope and safety

- **No database, no network, no Supabase stack.** The suite runs with nothing
  started. This plan issued no production read of any kind (T-03-02-01).
- **`.env.local` was never read** (T-03-02-02). Every credential-shaped value in
  the suite is a literal placeholder — `https://placeholder-project.supabase.co`,
  `placeholder-anon-key`, `placeholder-service-role-key` — set on `process.env`
  inside the test process only, with the real environment snapshotted in
  `beforeAll` and restored in `afterAll`. The suite and all four evidence files
  were grepped for JWT, `sb_secret_`, `sbp_`, Postgres-URL, bearer and
  service-key shapes before commit; no match.
- **No package was installed** (T-03-02-SC). `npm ci` installed the committed
  lockfile in the execution worktree and left `package.json` and
  `package-lock.json` untouched.
- **`jest.config.js` was not edited.** The suite is a `.test.ts` under `src/`
  and outside `src/hooks/`, so the existing `node` project matches it as-is.

---

## 6. One artifact of where this plan executed, recorded rather than hidden

This plan ran in a parallel-execution git worktree rooted under
`<repo>/.claude/worktrees/`. `jest.config.js` carries
`testPathIgnorePatterns: ['/node_modules/', '/.claude/', ...]`, so **every** path
in that worktree contains `/.claude/` and Jest discovers zero test files there —
not this suite, and not the twenty pre-existing ones either.

The canonical command is unchanged and is what a reader should run from a normal
checkout:

```
npx jest --ci --selectProjects node --testPathPatterns "auth/callback"
```

The runs recorded in `callback-characterization.txt` and
`callback-mutation-check.txt` append
`--testPathIgnorePatterns "/node_modules/" "/supabase/functions/tests/" "src/hooks/"`,
which is the minimum adaptation that lets the worktree see its own files. Both
the canonical invocation and its worktree-local result are recorded verbatim in
`callback-characterization.txt § COMMAND A`, so the discovery failure is on the
record rather than quietly worked around. The committed file lives at
`src/app/auth/callback/route.test.ts`, which contains no `/.claude/` segment in a
normal checkout and is picked up by `npm test` with no config change.

### The same artifact reaches `check-baseline.mjs`, and the arithmetic is exact

`node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs`
returns **17 passed, 1 failed** in this worktree, not the expected 22/0. The plan's
acceptance criterion says 22/0, so the gap is stated rather than glossed.

The one failure is:

```
FAIL jest :: jest-json-parsed :: no JSON object on stdout (exit 1)
```

The tool shells out to `npx jest --ci --json` (check-baseline.mjs:311) and gets
no report back, for the identical `/.claude/` reason. That check `return`s early
on failure, so the **four** assertions downstream of it inside the same `jest`
family never execute: `no-failing-tests`, `passing-count-not-below-baseline`,
`skipped-count-not-above-baseline`, `executing-suites-not-below-baseline`. One
failed plus four never-run is exactly the five-assertion gap between 17 and 22.
Every non-jest check passed, including the two that a foundation phase most needs
to see green:

```
PASS tsc  :: tsc-emits-no-diagnostics       :: zero bytes on stdout and stderr
PASS lint :: zero-eslint-errors             :: 0 errors
PASS lint :: no-baseline-rule-regressed     :: 4 baseline rule(s) compared, none above baseline
PASS lockfile-discipline :: lockfile-version-unchanged :: 3 -> 3
```

The four suppressed assertions were then evaluated by hand against the same
baseline file the tool reads (`.planning/audit/baseline/jest.txt`: 220 passed,
36 skipped, 16 of 21 suites executing), using a `--json` run of the full suite:

```
PASS jest :: no-failing-tests                    :: 0 failing
PASS jest :: passing-count-not-below-baseline    :: 286 passing vs baseline 220
PASS jest :: skipped-count-not-above-baseline    :: 5 skipped vs baseline 36
PASS jest :: executing-suites-not-below-baseline :: 23 of 24 executing vs baseline 16 of 21
```

All four pass with margin. The tool will therefore report **22 passed, 0 failed**
when run from the repo root after this wave merges — but that sentence is a
prediction from four hand-checked assertions, not an observation, and it should
be read as such until someone runs it.

### The full-suite numbers this plan is responsible for

```
Test Suites: 1 skipped, 23 passed, 23 of 24 total
Tests:       5 skipped, 286 passed, 291 total
```

286 is the Phase 2 floor of 278 plus this suite's 8, with the skip count
unchanged at 5. `npm run lint` exits 0 with 0 errors and 19 warnings;
`npx tsc --noEmit` exits 0 with zero bytes of output. ESLint and TypeScript are
both unaffected by the worktree's location — `eslint.config.mjs` ignores
`.claude/**` relative to its own working directory, and `tsconfig.json` excludes
`**/*.test.ts` outright, so this suite is type-checked by ts-jest at run time
rather than by `tsc`.

**Two things for whoever merges this wave to confirm**, both of which this
worktree structurally could not assert for itself:

1. `npx jest --ci --selectProjects node --testPathPatterns "auth/callback"` from
   the repo root → 1 suite passed, 8 tests passed.
2. `node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs`
   from the repo root → 22 passed, 0 failed.
