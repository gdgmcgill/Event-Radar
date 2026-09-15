---
phase: 02-dependency-and-runtime-stabilization
reviewed: 2026-09-15T16:21:02Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - .github/workflows/ci.yml
  - scripts/smoke.sh
  - src/components/ErrorBoundary.test.tsx
  - src/components/events/EventFilters.test.tsx
  - src/components/events/FilterSidebar.test.tsx
  - src/hooks/useEvents.test.ts
  - src/middlewareRateLimit.test.ts
  - src/proxy.test.ts
  - src/proxy.ts
findings:
  critical: 0
  warning: 5
  info: 17
  total: 22
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-15T16:21:02Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Nine files were reviewed against diff base `506141f`: the CI workflow, the Tier 2 smoke script, six Jest suites (two new PRESERVE characterization suites, four revived), and `src/proxy.ts`.

Verification performed, not assumed:

- `git diff -M` confirms `src/middleware.ts -> src/proxy.ts` is a 98%-similarity rename with exactly one changed line (`export async function middleware` -> `export async function proxy`). Everything else in that file is pre-existing and is reported as Info per the phase framing.
- All six reviewed suites were executed locally: 6 suites, 58 tests, all passing in 1.7 s across the `node` and `jsdom` Jest projects.
- Every source line number cited in the two PRESERVE suites' comments (`middlewareRateLimit.ts:24/27/28/32/36-39/46-49/102`) was checked against the file and is accurate.
- The smoke script's `http()` failure path was exercised directly: on a curl connection failure it emits `000000`, not `000` (see WR-01).
- `CLAUDE.md` on disk already references `src/proxy.ts` and the eight-entry `PROTECTED_ROUTES`; no doc drift there.

No Critical findings. Nothing in the diff introduces incorrect production behavior or a new security exposure. The five Warnings are concentrated in two places: `scripts/smoke.sh` has three robustness/contract defects that can produce misleading diagnostics or a silently missing capture file, and `src/proxy.test.ts` does not actually exercise the authentication ring its header says it protects. The Info items are mostly pre-existing `proxy.ts` behavior (notably a fail-open auth path) that Phase 3 should ticket, plus minor test hygiene.

## Warnings

### WR-01: `http()` corrupts the status code on any curl failure

**File:** `scripts/smoke.sh:151-157`
**Issue:** `curl -w '%{http_code}'` writes its format string even when curl exits non-zero (connection refused, `--max-time` expiry, TLS failure). The `|| echo "000"` then appends a second value. Verified locally: a connection failure yields `code=000000`. Worse, a `--max-time` expiry that arrives after the headers yields e.g. `307000` or `200000`. Every row compares with `=`, so a corrupted code always FAILs (safe direction), but the value printed in the FAIL line, which the header comment calls the whole point of the report format, is wrong. A reader seeing `got 307000 /?signin=required...` for row 5 will not know whether the ring is intact.
**Fix:**
```bash
http() { # $1=method $2=path ; extra args follow. Echoes the status code.
  local method="$1" path="$2" out
  shift 2
  out="$(curl -sS --max-time "$SMOKE_TIMEOUT" -X "$method" \
    -o "$BODY" -D "$HEADERS" -w '%{http_code}' \
    "$@" "${HOST}${path}" 2>/dev/null)" || out="000"
  # curl prints 000 itself on transport failure; the fallback only covers a
  # killed/absent curl. Never concatenate the two.
  printf '%s' "${out:-000}"
}
```
Note that `|| out="000"` overwrites (rather than appends) and also normalizes the partial-transfer case, which is the correct semantics for "the request did not complete".

### WR-02: Pipeline status is never checked; a missing capture file or empty status file exits outside the documented contract

**File:** `scripts/smoke.sh:78, 103, 305-314`
**Issue:** The script sets `pipefail` but never inspects the status of the `{ run_rows; ... } | redact | tee "$SMOKE_OUT"` pipeline, so `pipefail` is inert. Because there is no `set -e`, a failing `mkdir -p` at line 103 (unwritable evidence dir) does not abort; `tee` then fails to open `$SMOKE_OUT`, the rows still print to stdout, and the script exits with the row failure count, typically `0`. The result is a green exit with no capture file, in a script whose stated purpose is producing a captured artifact. Separately, if the subshell dies before line 308 writes `$fail`, `cat` of the empty file succeeds and `fail=""`, so `exit ""` produces bash's "numeric argument required" error and exit status 255, which is outside the `0..10 | 2` contract at lines 66-70.
**Fix:**
```bash
mkdir -p "$(dirname "$SMOKE_OUT")" || { echo "FATAL: cannot create $(dirname "$SMOKE_OUT")" >&2; exit 2; }
# ...
{
  run_rows
  echo "$fail" > "$STATUS_FILE"
} 2>&1 | redact | tee "$SMOKE_OUT"
pipe_status=$?

fail="$(cat "$STATUS_FILE" 2>/dev/null)"
rm -f "$STATUS_FILE"

if [ "$pipe_status" -ne 0 ] || [ ! -s "$SMOKE_OUT" ]; then
  echo "FATAL: capture pipeline failed (status ${pipe_status}); ${SMOKE_OUT} is missing or empty" >&2
  exit 2
fi
case "$fail" in
  ''|*[!0-9]*) echo "FATAL: row runner did not report a failure count" >&2; exit 2 ;;
esac
exit "$fail"
```

### WR-03: The redaction contract claims no unredacted data reaches disk; the request helpers write raw responses to disk on every row

**File:** `scripts/smoke.sh:29-33, 145-149, 154-156`
**Issue:** The METHOD CONTRACT states "an unredacted token never reaches disk even momentarily". Lines 145-147 create three `mktemp` files and line 155 writes every raw response body (`-o "$BODY"`) and every raw response header block including any `Set-Cookie` (`-D "$HEADERS"`) to them, unredacted, for the lifetime of the run. Today the script is anonymous, so the exposure is theoretical, but the header explicitly tells future authors to read and copy this contract, and the contract is false as written. A future authenticated variant copied from this file would leak session cookies to `$TMPDIR`.
**Fix:** Either make the claim true or narrow it. Narrowing is cheapest and honest:
```bash
#   * Secrets are replaced INSIDE the same pipeline that writes the CAPTURE
#     file, so an unredacted token never reaches the committed .planning/ tree.
#     Raw response bodies and headers DO transit mktemp files (mode 0600,
#     removed on exit) for the duration of the run; do not copy this script
#     for an authenticated pass without also redacting those.
```
If the stronger guarantee is wanted, pipe `-D -` through `redact` before writing `$HEADERS`, and `umask 077` at the top so the guarantee does not depend on `mktemp`'s default mode.

### WR-04: `proxy.test.ts` never invokes `proxy()`; it cannot detect the regression its header says it guards against

**File:** `src/proxy.test.ts:4-10, 39-48, 75-91`
**Issue:** The header says the suite exists so that "if that rename silently narrows the matcher, every protected page becomes public and nothing else in the suite notices". The assertions only test `config.matcher` via `unstable_doesMiddlewareMatch`. The matcher is a single negative-lookahead that matches essentially every path, so "runs on /profile" is nearly tautological. The `PROTECTED_ROUTES` array at lines 39-48 is a hand copy that is never compared to anything in `proxy.ts`; deleting every entry from `proxy.ts:114`, or deleting the redirect block at `proxy.ts:115-121` entirely, leaves this suite green. The actual 307 behavior is covered only by `scripts/smoke.sh` row 5, which requires a running server and is not in CI. A PRESERVE suite whose assertions cannot fail when the preserved behavior is removed is a false sense of coverage.
**Fix:** Add one test that calls `proxy()` with the Supabase client mocked to return no user and asserts the redirect. This stays within "import only, never wrap the subject":
```ts
import { NextRequest } from "next/server";
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
import { proxy, config } from "./proxy";

describe("proxy() protected-route ring (PRESERVE)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it.each(PROTECTED_ROUTES)("redirects an anonymous GET %s to /?signin=required", async (path) => {
    const res = await proxy(new NextRequest(`https://x.test${path}`));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/");
    expect(loc.searchParams.get("signin")).toBe("required");
    expect(loc.searchParams.get("next")).toBe(path);
  });

  it("passes an anonymous GET / through", async () => {
    const res = await proxy(new NextRequest("https://x.test/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
```
Note: `next/experimental/testing/server` currently throws on bare `require` outside Jest ("AsyncLocalStorage accessed in runtime where it is not available"); it works under the `node` Jest project, so keep this file in that project.

### WR-05: Fixed 10 ms real-time sleep in a concurrency test is a flaky pattern

**File:** `src/hooks/useEvents.test.ts:300-311`
**Issue:** Line 305 (`await new Promise(resolve => setTimeout(resolve, 10))`) is used to wait for `loadingMore` to flip to `true` after the first `loadMore()` call. On a loaded CI runner, React's state commit can land after 10 ms, in which case the two guarded `loadMore()` calls at lines 309-310 see `loadingMore === false`, issue extra fetches, and the assertion at line 325 fails intermittently. The suite already has the right primitive in scope.
**Fix:**
```ts
act(() => {
  result.current.loadMore();
});

await waitFor(() => {
  expect(result.current.loadingMore).toBe(true);
});

act(() => {
  result.current.loadMore();
  result.current.loadMore();
});
```

## Info

### IN-01: `test:ci` script is dead; CI runs `npm test`

**File:** `.github/workflows/ci.yml:36-37`; `package.json` scripts
**Issue:** The phase added both `test` (`jest`) and `test:ci` (`jest --ci`) but CI invokes `npm test`. This is not a correctness gap because Jest auto-enables `--ci` when the `CI` environment variable is set, which GitHub Actions does. It is dead surface area that invites someone to "fix" the workflow later for no reason, or to assume `--ci` semantics are missing.
**Fix:** Either delete `test:ci` from `package.json` or change line 37 to `run: npm run test:ci` and keep the explicit intent. Pick one.

### IN-02: Workflow does not declare least-privilege token permissions

**File:** `.github/workflows/ci.yml:13-15`
**Issue:** Pre-existing. No `permissions:` block, so the job runs with the repository default `GITHUB_TOKEN` scope. The phase touched this file and added a security gate; this is the cheapest hardening available.
**Fix:**
```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    timeout-minutes: 20
```

### IN-03: `npm audit` gate also fails on registry/network errors

**File:** `.github/workflows/ci.yml:39-40`
**Issue:** `npm audit` exits non-zero on `ENOAUDIT`/registry unavailability, not only on findings. That produces a red CI run that looks like a vulnerability. Acceptable for a gate, but worth a comment so the next person does not chase a phantom CVE.
**Fix:** Add a YAML comment above the step, or wrap as `npm audit --audit-level=high --omit=dev || (echo "::error::audit failed; check for ENOAUDIT vs a real finding" && exit 1)`.

### IN-04: Exit code 2 is overloaded

**File:** `scripts/smoke.sh:66-70, 87`
**Issue:** The contract says `2` means the input gate rejected the invocation, but two failing rows also exit `2`. The header acknowledges "before any row runs" as the disambiguator, which only works if the caller reads the output. A CI consumer keyed on exit code cannot tell them apart.
**Fix:** Use an exit code outside the row range for the gate, e.g. `exit 64` (EX_USAGE), and update the contract.

### IN-05: `-S` is contradicted by `2>/dev/null`

**File:** `scripts/smoke.sh:154-156`
**Issue:** `-sS` asks curl to print errors, then stderr is discarded. Either intent is fine; both together is noise and hides useful failure text (e.g. "Connection refused" vs "SSL certificate problem") from the diagnostic the header says matters.
**Fix:** Drop `-S`, or route curl stderr to a variable and include it in the FAIL line when the code is `000`.

### IN-06: `header_value` assumes a `": "` separator

**File:** `scripts/smoke.sh:159-166`
**Issue:** `${line#*: }` only strips when the header is written as `name: value`. A `name:value` form (legal per RFC 9110) returns the whole line including the name. Next always emits the space today, so this is latent.
**Fix:** `printf '%s' "${line#*:}" | sed -E 's/^[[:space:]]+//'`.

### IN-07: Row 8 is only deterministic against a single-process target

**File:** `scripts/smoke.sh:251-267`
**Issue:** The rate-limit store is a per-process `globalThis` Map (`middlewareRateLimit.ts:11-18`). Against a Vercel preview, (a) `x-forwarded-for` is overwritten by the platform so `SMOKE_IP` is ignored, and (b) 31 requests may be spread across isolates, none of which reaches 30. The header at lines 34-37 anticipates running against a deployment; row 8 will produce false FAILs there.
**Fix:** Add to the NOT COVERED section: "Row 8 is meaningful only against a single-process target (local dev, `next start`). Against a multi-instance deployment it is expected to FAIL and should be reported as environment-limited, not as a regression."

### IN-08: Auth ring fails open when env is missing or on any exception (pre-existing)

**File:** `src/proxy.ts:14-16, 140-144`
**Issue:** Pre-existing; the phase deliberately did not alter this. If `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset, or if `getUser()`/the ban query throws (Supabase outage, malformed cookie), the proxy returns `NextResponse.next()` and every protected page and the ban check are bypassed. Client pages then render their unauthenticated shell, so data exposure is bounded by RLS, but the page-level ring the whole phase was built to preserve is conditional on a healthy dependency. Flagged here so Phase 3 tickets it; it is not a Phase 2 regression.
**Fix:** In Phase 3: for `PROTECTED_ROUTES`, fail closed (redirect to `/?signin=required`) when the client cannot be constructed or `getUser()` throws; keep pass-through for public paths.

### IN-09: Ban check redirects API callers to an HTML page (pre-existing)

**File:** `src/proxy.ts:91-111`
**Issue:** Pre-existing. `BAN_EXEMPT_PATHS` does not exclude `/api/*`, so a banned user's `fetch("/api/...")` receives a 307 to `/banned` (HTML). Client `fetch` follows it and then fails to parse JSON, producing a confusing error instead of a 403. The onboarding guard at lines 129-131 already excludes `/api/` and `/auth/`; the ban check should mirror that with a JSON 403.
**Fix:** `if (isBanned) { if (path.startsWith("/api/")) return NextResponse.json({ error: "Account suspended" }, { status: 403 }); ... }`

### IN-10: `try` body is not indented (pre-existing)

**File:** `src/proxy.ts:18-140`
**Issue:** Pre-existing. The `try {` at line 18 and `} catch` at line 140 wrap 120 lines that are indented as if at function scope. Prettier would reformat this file; it is a sign the file was never run through the project's formatter.
**Fix:** `npx prettier --write src/proxy.ts` in a formatting-only commit.

### IN-11: Matcher regex has an unescaped `.` and prefix semantics; one exempt path is dead (pre-existing)

**File:** `src/proxy.ts:92, 156`
**Issue:** Pre-existing. In the matcher, `favicon.ico` matches `faviconXico`, and every alternative is a prefix match (`/auth/callbackanything` is excluded). Harmless today. Separately, `BAN_EXEMPT_PATHS` includes `/auth/callback` (line 92), but the matcher already excludes that path, so the proxy never runs there; the entry is unreachable.
**Fix:** Escape the dot (`favicon\\.ico`) and anchor alternatives where a prefix is not intended; drop `/auth/callback` from `BAN_EXEMPT_PATHS` or drop it from the matcher exclusion, but not both.

### IN-12: Stale `src/middleware.ts:NNN` source references after the rename

**File:** `src/proxy.test.ts:34, 58`
**Issue:** The comments point at `src/middleware.ts:114` and `src/middleware.ts:156`. That file no longer exists. The line numbers are still correct for `src/proxy.ts`, but a reader following the reference hits a missing file. The narrative mentions of `middleware.ts` in the header (lines 4, 12) and in `middlewareRateLimit.test.ts:4` are historical and fine.
**Fix:** `s#src/middleware.ts:#src/proxy.ts:#` on lines 34 and 58.

### IN-13: High-frequency budget is not proven at its boundary

**File:** `src/middlewareRateLimit.test.ts:105-115`
**Issue:** The test sends `POST_BUDGET + 10` (40) requests and asserts none are blocked. That proves the budget is greater than 40, not that it is 300. A change to `middlewareRateLimit.ts:94` from `300` to `50` passes this suite. The boundary test at lines 127-138 shows the pattern; it is only applied to the standard budget.
**Fix:** Add a case that hammers a high-frequency prefix `HIGH_FREQUENCY_POST_BUDGET` times (all null) and asserts the next is 429, using a fresh IP.

### IN-14: Misleading hoisting comment, unused import, `any` in mock factory

**File:** `src/components/events/FilterSidebar.test.tsx:1-7, 11`
**Issue:** The comment at lines 3-5 says the factory "reads EventTag when EventFilters is first required". It does not: `EventTag.ACADEMIC` is referenced inside the `onClick` closure (line 15) and is evaluated at click time, by which point every import is resolved. The import order is not load-bearing; the comment will mislead the next person who reorganizes imports. Also `import React from "react"` (line 1) is unused under `jsx: react-jsx` (the sibling suites do not import it), and the factory props are typed `any`.
**Fix:** Correct or delete the comment; drop the React import; type the props as `{ onFilterChange?: (f: { tags?: EventTag[] }) => void; initialTags?: EventTag[] }`.

### IN-15: Redundant double cast

**File:** `src/components/events/EventFilters.test.tsx:16`
**Issue:** `EVENT_CATEGORIES[tag as unknown as keyof typeof EVENT_CATEGORIES]` — line 34 in the same file indexes `EVENT_CATEGORIES[targetTag]` directly and type-checks, so the cast is dead weight that also hides a real type error if `EVENT_CATEGORIES` and `EventTag` ever diverge.
**Fix:** `const category = EVENT_CATEGORIES[tag];`

### IN-16: Return type depends on the global `JSX` namespace

**File:** `src/components/ErrorBoundary.test.tsx:5`
**Issue:** `function Thrower(): JSX.Element` relies on the global `JSX` namespace that `@types/react` 18 declares. `@types/react` 19 removes it (it becomes `React.JSX`). This will break at the React 19 upgrade, which is plausible Phase 3+ work.
**Fix:** `import type { ReactElement } from "react"; function Thrower(): ReactElement { ... }` or simply `function Thrower(): never`.

### IN-17: `any` and floating promises in the concurrency test

**File:** `src/hooks/useEvents.test.ts:292, 300-302, 308-311`
**Issue:** `let resolveLoadMore: any;` and three `loadMore()` promises are started inside synchronous `act()` callbacks and never awaited. This works because the test later awaits `loadingMore === false`, but any rejection in those promises would surface as an unhandled rejection rather than a test failure.
**Fix:** `let resolveLoadMore!: (value: unknown) => void;` and `void result.current.loadMore();` to make the intent explicit, or `await act(async () => { result.current.loadMore(); })`.

---

_Reviewed: 2026-09-15T16:21:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
