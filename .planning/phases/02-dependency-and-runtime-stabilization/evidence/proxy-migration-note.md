# Proxy Migration Note — STAB-06 (batch 3)

**Plan:** 02-06 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Status:** Shipped locally, Tier 3 outstanding. The file convention moved in one atomic commit
with two changed lines; the human verification against a preview deployment has not been run yet
and is recorded below as outstanding rather than as passed.

> **Shipped: `src/middleware.ts` → `src/proxy.ts` and `src/middleware.test.ts` →
> `src/proxy.test.ts`, in a single commit whose entire content is two rename headers and two
> changed lines — the exported function's name and the test's import specifier.** The 27
> characterization assertions that held before the rename hold after it, unchanged. All ten
> smoke rows are byte-identical before and after. The build's file-convention deprecation
> warning went 1 → 0 and no coexistence error ever appeared.

Every number below was produced by a command in this working tree on 2026-09-15 and is either
printed here with its command or cited to a committed capture file. Nothing is transcribed from
`02-RESEARCH.md`; where this note disagrees with that document, the live reading wins and the
disagreement is named.

**Commits:** `ad884e1` (before captures) · `0d66a1d` (the rename) · the gate captures and this
note follow.

---

## 1. What moved, and only what moved

Producing command, one-shot and pinned to the framework version batch 2 installed:

```bash
npx --yes @next/codemod@16.3.5 middleware-to-proxy . --force
# 0 errors, 319 unmodified, 1 skipped
```

`@next/codemod` is **not** in `package.json` and was never installed into the project. `npx`
resolved it into the user-level npm cache for the duration of one invocation. `package.json` and
`package-lock.json` are byte-identical across the whole plan:

```bash
git diff --name-only 2a56084..HEAD -- package.json package-lock.json   # prints nothing
```

The "1 skipped" line is the rename itself and is not a failure. The transform's
`handleMiddlewareFileRename` calls `writeFileSync` on the new path and `unlinkSync` on the old
one and then returns `null`; jscodeshift tallies a `null` return as a skip rather than an ok.
That single-pass write-and-unlink is what makes a both-files-present state impossible to stage,
which matters because Next 16 hard-**throws** at build time when both exist.

The complete diff, with rename detection on (`evidence/proxy.rename-diff.txt`):

```
 src/{middleware.test.ts => proxy.test.ts} | 2 +-
 src/{middleware.ts => proxy.ts}           | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
```

Both files were detected as renames at **similarity index 98%**. Beyond the renames themselves,
**one changed line per file**:

| File | The one line |
|---|---|
| `src/middleware.ts` → `src/proxy.ts` | `-export async function middleware(request: NextRequest) {` / `+export async function proxy(request: NextRequest) {` |
| `src/middleware.test.ts` → `src/proxy.test.ts` | `-import { config } from "./middleware";` / `+import { config } from "./proxy";` |

Byte-identical across the rename, verified by a mechanical comparison that normalises only the
function name and then requires string equality of the whole file:

- the three imports, including `from "./middlewareRateLimit"`
- the rate-limit-first ordering — `applyApiRateLimit` is still the first statement in the body
- the environment-variable pass-through guard
- the cookie `getAll` / `setAll` block and the stale-cookie cleanup
- the ban check and its `BAN_EXEMPT_PATHS`
- the eight-entry `PROTECTED_ROUTES` array and its redirect construction
- the onboarding guard
- the `catch` block, **including its `[Middleware]` log prefix**
- the exported `matcher` array and its comment

## 2. Three things deliberately not done

Each would have been a behaviour-visible line inside the one commit that has to read as a rename.

| Not done | Why |
|---|---|
| Rename the `[Middleware]` log prefix at `src/proxy.ts:142` to `[Proxy]` | It is the project's logging convention (`.claude/CLAUDE.md` § Logging). Change it later in its own commit or leave it. |
| Rename `src/middlewareRateLimit.ts` | The relative import survives the rename unchanged, nothing forces it, and REFAC-18 rewrites that module onto a distributed store in Phase 5 anyway. |
| Fix any finding in the file | The fail-open env guard (F-003), the `getSession()` usage and the pass-through catch are real findings assigned to Phase 5. Fixing one here would make "same behaviour as before" unprovable, which is the entire point of the batch. |

No runtime change is attributed to this rename either. Proxy defaults to the Node.js runtime
rather than the Edge runtime, but that landed when the project moved to Next 16; the *rename*
changes nothing further about the runtime.

## 3. Codemod no-ops, each asserted rather than assumed

`02-RESEARCH.md` § Code Examples 3 predicts that every other capability of the transform is a
no-op on this repository. Each was checked against the post-rename tree rather than taken on
trust.

| Transform capability | Assertion run | Result |
|---|---|---|
| Four `next.config` key renames (`skipMiddlewareUrlNormalize` and siblings) | `grep -E 'skipMiddlewareUrlNormalize\|middlewarePrefetch\|middlewareClientMaxBodySize\|externalMiddlewareRewritesResolve' next.config.js` | no matches |
| `NextMiddleware`→`NextProxy`, `MiddlewareConfig`→`ProxyConfig` type imports | `grep -E 'NextMiddleware\|MiddlewareConfig' src/proxy.ts`; line 2 imports `NextResponse` and `type NextRequest` only | no matches |
| Strip `export const runtime` / `config.runtime` | `grep -E 'export const runtime\|runtime:' src/proxy.ts` | no matches |
| Name-collision aliasing (`_proxy1`) | `grep '_proxy1' src/proxy.ts` | no matches |
| Rate-limit relative import | `src/proxy.ts:3` — `import { applyApiRateLimit } from "./middlewareRateLimit";` | unchanged |
| Stale importers of the old module | `grep -rn 'from "@/middleware"\|from "./middleware"' src/` | no matches |

## 4. The characterization suites, before and after

| | Before (`evidence/proxy.before.txt`) | After (`evidence/proxy.after.txt`) |
|---|---|---|
| Tree | `2a56084`, `src/middleware.ts` present | `0d66a1d`, `src/proxy.ts` present |
| Suites | `src/middlewareRateLimit.test.ts`, `src/middleware.test.ts` | `src/middlewareRateLimit.test.ts`, `src/proxy.test.ts` |
| Result | 27 passed, 0 failed | 27 passed, 0 failed |
| `exit_code` | 0 | 0 |

Result-marker diff:

```bash
strip() { grep -E '✓|✕' "$1" | sed -E 's/ \([0-9]+ ms\)$//'; }
diff <(strip evidence/proxy.before.txt) <(strip evidence/proxy.after.txt)
# IDENTICAL: 0 differences across 27 assertion lines
```

**One deliberate departure from the research recipe.** `02-RESEARCH.md` § Code Examples 3 step 3
shows this diff as a bare `grep -E '✓|✕'` with no normalisation. Run that way it reports six
differences — every one of them a per-test wall-clock suffix moving between `(1 ms)` and nothing,
on a tree where the assertions are provably unchanged. A comparison that needs six lines
eyeballed and waved away is not evidence; it is an invitation to wave away the seventh. The
`sed` strips only a trailing `(N ms)`, is applied identically to both sides, and cannot conceal a
renamed, added or removed assertion — those change the text before the suffix.

What the 27 cover: the matcher's include set (8 protected routes plus `/`, `/api/events`,
`/docs`, `/banned`, `/onboarding`), its exclude set (`/_next/static/...`, `/_next/image`,
`/favicon.ico`, `/auth/callback`, `/logo.png`, `/icon.svg`), its single-entry length, and seven
rate-limiter behaviours including the 429-plus-`Retry-After` past the POST budget, the
`/api/admin/*` exemption, the high-frequency analytics budget, the non-`/api` pass-through and
the exact budget boundary.

The suites reach the matcher through `unstable_doesMiddlewareMatch` from
`next/experimental/testing/server` — Next's own matcher compiler, not a hand-rolled regex. The
export is still named for *middleware* in 16.3.5 despite the docs naming a proxy variant; that
trap is documented at the top of `src/proxy.test.ts` and the rename did not disturb it.

## 5. The smoke pass, before and after

`scripts/smoke.sh` against `npm run dev` on `http://localhost:3000`. The server was **stopped
before the codemod ran and started fresh afterwards**, so the after reading cannot have been
served by a process that still had the old file compiled in.

| Row | Assertion | Before | After |
|---|---|---|---|
| **5** | `GET /profile` → 307 to `signin=required&next=/profile` | PASS — `307 /?signin=required&next=/profile` | PASS — `307 /?signin=required&next=/profile` |
| **6** | `GET /my-events` → 307 to `signin=required` | PASS — `307 /?signin=required&next=/my-events` | PASS — `307 /?signin=required&next=/my-events` |
| **8** | `POST /api/events` ×31 from one IP → 429 + `Retry-After` | PASS — `429 Retry-After=60` | PASS — `429 Retry-After=60` |
| **10** | `GET /_next/static/...` → 200, no `Location` | PASS — `200 no-location` | PASS — `200 no-location` |
| | ring rows | **4/4** | **4/4** |
| | all rows | 9/10 | 9/10 |

```bash
diff <(grep -E '^(PASS|FAIL) ' evidence/smoke.b3.before.txt) \
     <(grep -E '^(PASS|FAIL) ' evidence/smoke.b3.after.txt)
# zero differences — all ten rows byte-identical, down to row 10's
# run-time-discovered chunk filename
```

Row 5 is the line the whole batch exists for. `src/proxy.ts` is this application's only
page-level authentication ring; a 200 there would mean every protected page is public. It
returns the same 307 to the same sign-in URL on both sides.

**Row 2 fails on both sides, for a pre-existing reason.** Expected `200 and >=1 event`, got
`200 and 0 events`: the local Supabase reachable from this machine holds no approved events. The
route is correct and the dataset is empty. Identical in `smoke.b0.txt`, `smoke.b1.txt`,
`smoke.b2.txt` and both b3 captures, which is what establishes it as environmental rather than
introduced here. The expectation is not lowered and the row is not removed from the script.

## 6. The deprecation warning, and the coexistence error that never appeared

| | Value | Source |
|---|---|---|
| `deprecation_warning_lines_before` | **1** | `evidence/batch-02-build.txt` line 9 — `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` |
| `deprecation_warning_lines_after` | **0** | `evidence/batch-03-build.txt`, cold build with `.next` deleted first |

Derived both times by counting lines matching `file convention is deprecated` in command output
only; the one other occurrence of that string in the batch-2 capture is inside its own provenance
block at line 193 and is not command output. The dev server's banner tells the same story — it
printed the warning on the before run and does not print it on the after run.

**No coexistence error anywhere in the build log.** Next 16 hard-throws at build time if
`middleware.*` and `proxy.*` both exist, naming both detected paths; that is the failure mode of
a non-atomic migration. The plan's gate greps `evidence/batch-03-build.txt` for that error's
wording and finds nothing, and a probe for a message naming both conventions together finds
nothing either.

The gate's probe string is deliberately not spelled out in either that capture's provenance block
or here. The first version of the provenance note quoted it while describing its absence, and the
gate promptly failed on the prose — a note about a clean log is not a dirty log. This is the same
hazard `check-baseline.mjs` guards against by assembling its `FORCED_REMEDIATION` regex from
fragments, and it is called out so the next person writing an evidence note does not rediscover
it the same way.

**One claim explicitly *not* made.** The route table's `ƒ Proxy (Middleware)` line is not a
rename receipt. `evidence/batch-02-build.txt` line 175 already read exactly that, on the
pre-rename tree — Next 16.3.5 labels the request-boundary function that way regardless of which
file convention produced it. The receipt is the absent deprecation warning and nothing else.

## 7. The batch-3 gate

| Command | Result | Capture |
|---|---|---|
| `npm run lint` | exit 0 — 19 problems (0 errors, 19 warnings), rule-for-rule identical to batch 2; neither renamed file appears in the warning list | `evidence/batch-03-lint.txt` |
| `npx tsc --noEmit` | exit 0 — 0 bytes on stdout and stderr | `evidence/batch-03-tsc.txt` |
| `npx jest --ci` | exit 0 — **247 passed, 36 skipped, 0 failed**, 18 of 23 suites; identical to batch 2 and to the wave-3 post-merge gate | `evidence/batch-03-jest.txt` |
| `npm run build` | exit 0, cold; 139 route-table lines, same as batch 2 | `evidence/batch-03-build.txt` |
| `node evidence/tools/check-baseline.mjs` | exit 0 — **22 passed, 0 failed, 0 skipped** | run inline |

The 19 lint warnings are the 12 AUDIT-13 baseline warnings unchanged plus the 7
`@next/next/no-location-assign-relative-destination` findings that arrived with
`eslint-config-next` 16.3.5 in batch 2, all in files batch 3 does not touch. `check-baseline.mjs`
compares per rule rather than on the aggregate and reports `no-baseline-rule-regressed` with
4 baseline rules compared and none above baseline.

## 8. Coverage limitation — the ban check

**The ban check is not covered by automated evidence in this phase.** Saying so plainly is the
point of this section; the alternative is a note that reads as though the rename were fully
verified when one of its four behaviours is not.

Exercising the ban check requires a session belonging to a banned user. That requires the
deterministic seed dataset that arrives in **Phase 3**. Neither tier available in Phase 2 can
produce it: Tier 1 is Jest over pure functions and the ban check is an `await`ed Supabase query
inside the request boundary; Tier 2 (`scripts/smoke.sh`) is anonymous by contract and reads no
credential at all — the script says so in its own header, under "NOT COVERED, DELIBERATELY".

The honest evidence for the ban check after this rename is exactly two things, and neither is a
behavioural assertion:

1. **The rename diff.** `evidence/proxy.rename-diff.txt` shows the ban block — the
   `BAN_EXEMPT_PATHS` array, the `banned_at` / `ban_expires_at` query, the expiry comparison and
   the redirect to `/banned` — is byte-identical apart from the enclosing function's name. The
   mechanical check normalises the function name and then requires whole-file string equality,
   so a single altered character inside that block would have failed it.
2. **Tier 3 step 4**, once run: a signed-in non-banned user is not redirected to `/banned`. That
   is the negative case only. It says nothing about whether a banned user *is* redirected.

The positive assertion — a banned user's session is redirected to `/banned`, and an expired ban
is not — lands in **CERT-05**, the Phase 7 persona matrix, against the Phase 3 seed. It is not
claimed here.

The same limitation, in the phase's own terms: threat `T-02-06-03` is dispositioned
*mitigate (partial, stated)*, not *mitigate*.

## 9. Tier 3 — human verification (OUTSTANDING)

This is the only human step in Phase 2 and it is needed exactly once, on the one change that
touches the request path. It is **outstanding as of this note** and is deferred to the
end-of-phase verification pass (`workflow.human_verify_mode: end-of-phase`).

**It must run against a preview deployment, not only against a local server.** Next compiles the
file convention into a platform function at build time, so the first post-rename production or
preview deploy is the only place the rename is exercised against the CDN. A green local smoke
pass — which section 5 records — does not exercise that path. Recording it as if it did would be
the repudiation failure that `T-02-06-07` names.

| # | Step | Expected | Outcome |
|---|---|---|---|
| 1 | Sign in with a real McGill Google account | Sign-in completes; you land on the app signed in | ☐ not yet run |
| 2 | Attempt sign-in with a non-McGill Google account | Rejected, with the existing error behaviour unchanged | ☐ not yet run |
| 3 | With a mid-onboarding session, navigate to any non-onboarding page | Redirected to `/onboarding` | ☐ not yet run |
| 4 | As a signed-in **non-banned** user, navigate to any page | **Not** redirected to `/banned` (see § 8 — negative case only) | ☐ not yet run |
| 5 | Save and unsave an event; RSVP to an event | Both work exactly as before | ☐ not yet run |

**Preview deployment URL:** _to be recorded when Tier 3 runs_
**Date run:** _to be recorded when Tier 3 runs_

**If any step fails, the rename is reverted, not patched.** `0d66a1d` is a two-line commit with
rename detection on both files; `git revert 0d66a1d` restores the previous request boundary
exactly, and the batch is re-attempted rather than repaired in place.

## 10. Reproducing this

```bash
# before side
git status --porcelain --untracked-files=no       # expect empty (tracked tree clean)
git status --porcelain --untracked-files=all -- src/   # expect empty (nothing stray in src/)
npx jest --ci --verbose src/middlewareRateLimit.test.ts src/middleware.test.ts
SMOKE_HOST=http://localhost:3000 SMOKE_LABEL=b3.before bash scripts/smoke.sh

# the rename
npx --yes @next/codemod@16.3.5 middleware-to-proxy . --force
git mv src/middleware.test.ts src/proxy.test.ts
# then change the one import specifier in src/proxy.test.ts
git add -- src/middleware.ts src/proxy.ts src/proxy.test.ts
git --no-pager diff --cached -M --stat

# after side
npx jest --ci --verbose src/middlewareRateLimit.test.ts src/proxy.test.ts
npm run lint && npx tsc --noEmit && npx jest --ci && rm -rf .next && npm run build
SMOKE_HOST=http://localhost:3000 SMOKE_LABEL=b3.after bash scripts/smoke.sh
node .planning/phases/02-dependency-and-runtime-stabilization/evidence/tools/check-baseline.mjs
```

Captured artifacts this file cites: `proxy.before.txt`, `proxy.after.txt`,
`proxy.rename-diff.txt`, `smoke.b3.before.txt`, `smoke.b3.after.txt`, `batch-03-lint.txt`,
`batch-03-tsc.txt`, `batch-03-jest.txt`, `batch-03-build.txt`, and — for the before-side
deprecation marker and the lint/jest comparison — `batch-02-build.txt`, `batch-02-lint.txt`,
`batch-02-jest.txt`.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-06*
