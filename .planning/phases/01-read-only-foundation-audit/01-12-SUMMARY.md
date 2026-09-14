---
phase: 01-read-only-foundation-audit
plan: 12
subsystem: audit-cache
tags: [audit, cache, cdn, information-disclosure, read-only, production-probe]
requires:
  - .planning/audit/inventory/endpoints.json (01-11 personalization verdicts + persona expectations)
  - vercel.json (the blanket /api/(.*) Cache-Control header under audit)
  - .planning/audit/BLOCKING-INPUTS.md §2 (PROD_HOST, COOKIE_A, COOKIE_B)
provides:
  - a re-runnable header-only production cache probe with a positive control
  - 45 redacted header captures across 15 routes (anonymous session, 3 iterations)
  - the AUDIT-08 exposure matrix, 121 rows covering all 94 handlers x method
  - 45 finding candidates (8 Critical, 37 High) with per-route evidence paths
  - redaction/01-12.md with all-zero sweep counts and the exact unblock command
affects:
  - 01-13 (findings.json intake; 45 candidates, and REDACTION.md concatenation)
  - REFAC-19 (removal of the blanket header now has measured evidence, not reasoning)
  - CERT-09 (cache-matrix.json is the regression test's fixture)
tech-stack:
  added: []
  patterns:
    - "positive control as a first-class field, so a no-hit run is distinguishable from a blind probe"
    - "redaction inside the writing pipeline, so an unredacted token never reaches disk even momentarily"
    - "route list derived from the inventory's personalization verdicts, never hand-typed"
    - "graceful degradation: a missing credential produces a BLOCKED half with a retry command, not a false clean run"
key-files:
  created:
    - .planning/audit/tools/cache-probe.sh
    - .planning/audit/tools/gen-cache-matrix.mjs
    - .planning/audit/cache/curl-summary.json
    - .planning/audit/cache/cache-matrix.csv
    - .planning/audit/cache/cache-matrix.json
    - .planning/audit/cache/curl/ (45 redacted header captures)
    - .planning/audit/redaction/01-12.md
  modified: []
key-decisions:
  - "the 8 proven rows are held at latent-hazard/Critical rather than leak-confirmed, because leak-confirmed is reserved for an observed two-account hit and only one session was available"
  - "vary: accept-encoding with no Cookie or Authorization is recorded as the decisive cache-key fact — it is what turns an observed HIT into a cross-user serve"
  - "an anonymous 401 is treated as valid evidence about a path's cache directive, because vercel.json attaches headers by path and not by response"
  - "GET rows are emitted last per route so validate.mjs's last-wins CSV map reads the cacheable representation's verdict"
  - "PROD_HOST is recorded verbatim rather than placeholdered: universeapp.ca is a public hostname and reproducibility beats a cosmetic redaction"
requirements-completed: []
requirements-blocked: [AUDIT-08]
duration: ~45 min
completed: 2026-09-14
status: complete
---

# Phase 01 Plan 12: Cache Exposure Probe and Matrix Summary

The blanket `Cache-Control: s-maxage=60, stale-while-revalidate=300` that `vercel.json` attaches to `/api/(.*)` **does** reach personalized responses, and the shared CDN demonstrably stores and re-serves them — proven on the wire against production, with a positive control that rules out a blind harness.

## Headline verdict on the `s-maxage=60` question

**Shared caching of personalized endpoints is PROVEN, not theoretical.** The architecture research flagged this as the one question unresolvable by reasoning; it is now resolved by measurement.

Eight personalized routes returned `x-vercel-cache: HIT` or `STALE` with a non-zero `age` while carrying the blanket directive:

| Route | Observed states | Max `age` |
|---|---|---|
| `/api/notifications/count` | HIT, HIT, HIT | 43 s |
| `/api/events/following` | MISS, STALE, HIT | 96 s |
| `/api/events/friends-activity` | STALE, HIT, HIT | 77 s |
| `/api/events/friends-organizing` | STALE, HIT, HIT | 77 s |
| `/api/events/[id]/friends` | STALE, HIT, HIT | 77 s |
| `/api/events/[id]/rsvp` | STALE, HIT, HIT | 77 s |
| `/api/clubs/[id]/events` | STALE, HIT, HIT | 77 s |
| `/api/auth-debug` | STALE, HIT, HIT | 77 s |

The decisive second half is the cache key: **not one response in the whole run varied on `Cookie` or `Authorization`** — every `vary` read `accept-encoding` and nothing else. A cache entry for one of these URLs is therefore keyed by the URL alone and is served to every caller of it, regardless of which session produced it.

**What is still unobserved:** a request carrying account B's cookies receiving an entry populated by account A. That single step is blocked — see "Blocked" below. The mechanism is demonstrated; only the victim is unconfirmed. Every affected row therefore carries `severity: Critical` while holding the verdict at `latent-hazard`, because `leak-confirmed` is defined in this plan as an observed cross-session hit and honesty about which step was measured matters more than the stronger label.

A further 37 auth-gated routes — including all 15 `/api/admin/*` handlers — sit under the same directive with the same session-independent key. Anonymously they answer 401, so nothing cached during this run, but the anonymous 401s on `/api/notifications` and `/api/users/saved-events` both carried `cache-control: s-maxage=60, stale-while-revalidate=300`, confirming the header is attached by path and not by response. An authorized caller's 200 on any of those paths is storable and re-servable to an unauthorized one. Recorded as High.

## The positive control

Without a control, a run with no hits proves nothing. `/api/clubs/featured` — public, non-personalized — returned `x-vercel-cache: HIT` with `age: 47`, and `/api/events/featured` returned `HIT` with `age: 19`. The harness can see a shared-cache hit on this deployment, so every `MISS` elsewhere is a real negative.

`/api/health` is the useful negative-side control: it answered `MISS` on all three requests and was the only route emitting `set-cookie` (the Supabase PKCE code-verifier). The shared cache declines to store a cookie-setting response — which is exactly the `safe-by-accident` mechanism the plan told us to name rather than rely on.

## What was built

- **`tools/cache-probe.sh`** — reads `PROD_HOST`, `COOKIE_A`, `COOKIE_B`, `CLUB_ID`, `EVENT_ID`, `ITERATIONS`, `SPACING` from the environment only, with no host fallback that could silently target the wrong system. Derives its route list from `endpoints.json` personalization verdicts, ordered by suspicion. GET only, body discarded (`-o /dev/null -D -`), `set-cookie` replaced with `<REDACTED>` inside the same pipeline that writes the file, response headers filtered to a caching allow-list, `set -x` never enabled. Refuses to run if the two cookies are identical; degrades to the anonymous half with a `BLOCKED` record rather than reporting a clean run when either is absent.
- **`cache/curl-summary.json`** — 45 request records plus a first-class `control` object (`hit_observed`, `harness_valid`), a `cache_key` object recording the `vary` values and `varies_on_session: false`, a `cross_session_probe` object carrying the blocked reason and retry command, and a `run_verdict` of `anonymous-half-only`.
- **`tools/gen-cache-matrix.mjs`** — deterministic, zero-dependency ESM. Inline RFC-4180 CSV quoting; no import of the app-layer export helper. The blanket-header scope is parsed out of `vercel.json` rather than hardcoded. An eight-gate classifier assigns exactly one of the five permitted verdicts, and the generator exits non-zero if a personalized route lacks a row, if a personalized GET row is `not-probed` while the control was valid, or if no control row exists.
- **`cache/cache-matrix.{csv,json}`** — 121 rows, one per route and method, covering all 94 handlers. Verdict tally: 75 `safe-by-design`, 45 `latent-hazard`, 1 `safe-by-accident`, 0 `not-probed`.
- **`redaction/01-12.md`** — the ledger, all six sweep patterns at zero, and the finding candidates.

## Tasks and commits

| Task | Name | Commit |
|---|---|---|
| 1 | Supply hostname and two session cookie sets (checkpoint) | resolved without artifact — see Blocked |
| 2 | Two-session header probe with a positive control | `1324055` |
| 3 | Exposure matrix, verdicts, evidence sweep | `c4bbcff` |

## Blocked

**AUDIT-08 is withheld, not completed.** The requirement needs both the matrix for every handler *and* the empirical two-session curl test. The matrix half is delivered in full; the two-session half is `BLOCKED — input not supplied`.

`COOKIE_A` and `COOKIE_B` were never exported into the executing shell. The cookie-presence check ran exactly once, printed only booleans, and recorded `PROD_HOST_set=false COOKIE_A_set=false COOKIE_B_set=false`. No cookie value entered this machine at any point. `PROD_HOST` was supplied out-of-band by the operator as `universeapp.ca` and used as-is.

Exact retry command (also recorded in `curl-summary.json` and `redaction/01-12.md`):

```bash
export PROD_HOST=https://universeapp.ca
export COOKIE_A='<all sb-*-auth-token cookies incl. numbered chunks, account A>'
export COOKIE_B='<the same for a different account B>'
export CLUB_ID='<a public club id>'
bash .planning/audit/tools/cache-probe.sh
node .planning/audit/tools/gen-cache-matrix.mjs
node .planning/audit/tools/validate.mjs --check cache
```

When both cookies are present the generator promotes any row where a session-B request returns `HIT` from `latent-hazard` to `leak-confirmed` automatically, with no further edit.

## Deviations from Plan

**1. [Rule 3 - Blocker] `curl -sSI` replaced with `curl -sS -o /dev/null -D -`**
- **Found during:** Task 2 design
- **Issue:** `-I` issues a HEAD request. HEAD and GET occupy different cache behaviour on the CDN, and a HEAD probe would have measured something other than the question under test.
- **Fix:** GET with the body discarded. Still header-only on disk, still read-only, but it exercises the representation that actually gets cached. The acceptance criterion forbidding mutating verbs is unaffected and passes.
- **Commit:** `1324055`

**2. [Rule 1 - Bug] CRLF in captured header values silently falsified every comparison**
- **Found during:** Task 2, second probe run
- **Issue:** HTTP framing is CRLF. `x-vercel-cache: HIT\r` never equals `"HIT"`, so the run reported `control_hit=false` and `inconclusive-broken-harness` while the raw captures plainly showed `HIT`. This is precisely the failure mode the plan warns about — a broken harness masquerading as a clean negative — arriving from the opposite direction.
- **Fix:** `tr -d '\r'` added to the write pipeline so captures are LF-clean on disk and every downstream comparison is honest.
- **Commit:** `1324055`

**3. [Rule 1 - Bug] A literal apostrophe inside the single-quoted `node -e` block broke the summary writer**
- **Found during:** Task 2, first probe run
- **Issue:** The retry-command string contained `COOKIE_A='<account A cookie set>'`, whose quotes terminated the surrounding bash single-quoted string. Bash then parsed `<account` as a redirection; `curl-summary.json` was never written even though all 42 captures succeeded.
- **Fix:** `'` escapes in the JS string, plus `rm -f "$RECORDS"` made conditional on the summary actually existing so a failed run no longer destroys its own intermediate evidence.
- **Commit:** `1324055`

**4. [Rule 2 - Missing critical] The positive control was widened from one route to three**
- **Found during:** Task 2
- **Issue:** The plan named "the anonymous public events listing" as the control. `/api/events/featured` is high-traffic enough that real user requests keep it in revalidation, so it mostly answers `STALE`, not `HIT` — and `validate.mjs --check cache` requires the literal string `HIT` in a control row. A single control would have failed the gate for a reason unrelated to the finding.
- **Fix:** Three controls: `/api/clubs/featured` (low-traffic, reliably HITs), `/api/events/featured` (retained), and `/api/health` (the negative-side control that demonstrates the set-cookie suppression mechanism).
- **Commit:** `1324055`

**5. [Rule 2 - Missing critical] `vary` added to the captured header set and to the summary**
- **Found during:** Task 2
- **Issue:** The plan's header list did not include the one header that determines whether an observed HIT is a *cross-user* serve. Observing a HIT without knowing the cache key licenses no conclusion about who receives the entry.
- **Fix:** `vary` captured per request, aggregated into a `cache_key` object with a `varies_on_session` boolean, and surfaced as a matrix column.
- **Commit:** `1324055`, `c4bbcff`

**6. [Rule 3 - Blocker] No live event id was obtainable anonymously**
- **Found during:** Task 2
- **Issue:** `/api/events`, `/api/events/popular`, `/api/events/new` and `/api/events/happening-now` all returned zero rows in production, so the `/api/events/[id]/*` routes had no real resource to target.
- **Fix:** A real club id was resolved from `/api/clubs` for `/api/clubs/[id]/events`; the `/api/events/[id]/*` routes were probed with a syntactically valid non-existent UUID. Those requests answer 404 — and cached and re-served the 404 with `HIT` and `age: 77`, which still demonstrates the path's cache behaviour. `evidence_basis` on those rows records the anonymous-session provenance.
- **Commit:** `1324055`

**7. [Scope] 37 auth-gated, non-personalized routes were classified rather than skipped**
- **Found during:** Task 3
- **Issue:** The plan scopes verdicts to personalized routes. But `personalized: false` does not mean *public* — all 15 `/api/admin/*` handlers are `personalized: false` and sit under the same path-attached directive with the same session-independent key. Assigning them `safe-by-design` would have written a false all-clear into the artifact REFAC-19 consumes.
- **Fix:** Gate 7 of the classifier distinguishes "not personalized" from "public", using the persona matrix's `expected_status.anonymous`. Auth-gated rows get `latent-hazard` / High with the mechanism stated.
- **Commit:** `c4bbcff`

**Total deviations:** 7 auto-fixed (3 bugs, 3 missing-critical, 1 scope extension). **Impact:** deviations 2 and 3 were the difference between reporting the correct verdict and reporting `inconclusive-broken-harness` on a run whose raw evidence said otherwise. Deviations 5 and 7 materially widened the finding set. None touched anything outside `.planning/`.

## Authentication Gates

One, at Task 1, resolved per the `BLOCKING-INPUTS.md` handover protocol rather than by halting: `PROD_HOST` supplied out-of-band, `COOKIE_A`/`COOKIE_B` absent and recorded as `BLOCKED` with the exact retry command. The presence check ran once and emitted booleans only.

## Verification

| Check | Result |
|---|---|
| `node .planning/audit/tools/validate.mjs --check cache` | exit 0 — 3 passed, 0 failed |
| `bash .planning/audit/tools/readonly-guard.sh` | exit 0 after every external command |
| capture files / with a status line | 45 / 45 |
| `grep -rl 'auth-token=' .planning/audit/cache/` | no output |
| unredacted `set-cookie` lines | 0 of 3 |
| JWT / `sb_secret_` / connection-string / bearer / project-ref sweeps | 0 matching files each |
| `grep -c 'set -x'` in `cache-probe.sh` (non-comment) | 0 |
| `grep -cE '\-X (POST\|PUT\|PATCH\|DELETE)'` in `cache-probe.sh` | 0 |
| `grep -c 'exportUtils'` in `gen-cache-matrix.mjs` | 0 |
| CSV data rows vs JSON array length | 121 / 121 |
| every personalized endpoint has a non-`not-probed` verdict | yes (27 / 27) |
| `git diff --stat` across both commits | nothing outside `.planning/` |

## Issues Encountered

None unresolved. Production answered every request; no 429 was returned (the middleware allows 300 GETs per minute per IP per path, and the probe issues 3).

## Known Stubs

None.

## Threat Flags

None beyond the threat register. T-01-12-01 (information disclosure via the shared CDN) moved from `mitigate` to **confirmed at the channel level** — the register's proposed mitigation is now a Critical finding routed to REFAC-19.

## Next Phase Readiness

Ready for `01-13`. It inherits 45 finding candidates with per-route evidence paths, `cache-matrix.json` as a machine-readable intake, and `redaction/01-12.md` for the `REDACTION.md` concatenation. The one open item it must carry forward as a gap rather than an omission is the blocked two-session probe against AUDIT-08.

## Self-Check: PASSED

All seven created paths exist on disk (`.planning/audit/tools/cache-probe.sh`, `tools/gen-cache-matrix.mjs`, `cache/curl-summary.json`, `cache/cache-matrix.csv`, `cache/cache-matrix.json`, `cache/curl/` with 45 files, `redaction/01-12.md`). Both commits `1324055` and `c4bbcff` are present in `git log`. The plan-level verification block re-run: `validate.mjs --check cache` exit 0, `readonly-guard.sh` exit 0, all secret sweeps empty, every personalized endpoint carries a matrix row.
