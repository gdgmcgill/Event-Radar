#!/usr/bin/env bash
# =============================================================================
# smoke.sh — Tier 2 anonymous HTTP smoke pass
# Phase 02-dependency-and-runtime-stabilization, plan 02-02
#
# WHAT THIS DOES
#   Issues ten anonymous HTTP requests against a running Uni-Verse instance and
#   prints one PASS/FAIL line per row. It exists so that STAB-09's "followed by
#   a smoke pass" is a command with captured output rather than a claim in a
#   commit message. Phase 3 replaces it with the Playwright persona harness
#   (REFAC-06); until then this is what "a smoke pass" means.
#
#   Row 5 is the single most important line in the table. src/middleware.ts is
#   this application's only page-level authentication ring, and batch 3 renames
#   that file. If the rename silently disables the ring, row 5 turns 200 and
#   every protected page becomes public. Rows 6, 8 and 10 cover the rest of the
#   request path: the second protected route, the rate limiter, and the
#   matcher's negative lookahead.
#
# METHOD CONTRACT — read this before copying the cache-probe.sh contract in
#   * NOT GET-only. Row 8 issues 31 POSTs to /api/events to prove the rate
#     limiter still returns 429. cache-probe.sh is GET-only and says so; that
#     sentence would be a lie in this file, so it is not copied. Every other
#     row is a GET.
#   * Anonymous only. No credential is read, sent, or required. .env.local is
#     never read by this script.
#   * No -L anywhere. Rows 5 and 6 assert a redirect; following it would turn
#     the assertion into a test of the landing page instead of the auth ring.
#   * Response bodies are fetched but never echoed wholesale. Only derived
#     facts (status, header value, array length, marker found) are printed.
#   * Secrets are replaced INSIDE the same pipeline that writes the capture
#     file, so an unredacted token never reaches disk even momentarily.
#     .planning/ is committed.
#   * Command tracing is never enabled. The shell trace option (the `-x` flag)
#     appears nowhere in this file, and an automated gate greps for it: this
#     script may one day run against a deployment whose environment carries a
#     token, and a trace would echo it.
#
# DELIBERATE SHELL OPTIONS
#   set -u    : catch unset variables.
#   NO set -e : an early abort would suppress the diagnostic output that makes
#               a failure actionable. Failures accumulate in $fail instead, and
#               the exit code is that count.
#   NO trace  : the `-x` option is absent by contract; see above.
#
# INPUTS (environment only — never CLI arguments, never files)
#   SMOKE_HOST         required. Target origin including the scheme, e.g.
#                      http://localhost:3000. No default: a fallback could
#                      silently smoke the wrong system, which is the reasoning
#                      cache-probe.sh gives for the same choice.
#   SMOKE_OUT          optional. Capture path. Defaults under the phase
#                      evidence directory as smoke.<SMOKE_LABEL>.txt.
#   SMOKE_LABEL        optional, default "manual". Names the batch in the
#                      default capture filename.
#   SMOKE_IP           optional, default 203.0.113.77 (TEST-NET-3, RFC 5737).
#                      The simulated client address row 8 rate-limits against.
#   SMOKE_CARD_MARKER  optional, default "Happening Now". See row 1.
#   SMOKE_TIMEOUT      optional, default 90 (seconds per request; a cold
#                      Turbopack dev compile of a route can exceed 30).
#
# OUTPUTS
#   $SMOKE_OUT (default:
#   .planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.<label>.txt)
#   and the same text on stdout, so a CI log carries it.
#
# EXIT CONTRACT
#   0            all ten rows passed
#   1..10        that many rows failed
#   2 before any row runs means the input gate rejected the invocation; the
#   gate message is printed to stderr and names the variable.
#
# NOT COVERED, DELIBERATELY
#   The ban check. Exercising it needs a banned user's session, which needs the
#   Phase 3 seed. Claiming it here would be claiming coverage the phase does
#   not have; it lands in Phase 7's CERT-05 persona matrix.
# =============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- input gate -------------------------------------------------------------
if [ -z "${SMOKE_HOST:-}" ]; then
  echo "FATAL: SMOKE_HOST is not set. There is no default; set it in the" >&2
  echo "       environment, e.g. SMOKE_HOST=http://localhost:3000" >&2
  echo "       A default could silently smoke the wrong system." >&2
  exit 2
fi

SMOKE_LABEL="${SMOKE_LABEL:-manual}"
SMOKE_OUT="${SMOKE_OUT:-${REPO_ROOT}/.planning/phases/02-dependency-and-runtime-stabilization/evidence/smoke.${SMOKE_LABEL}.txt}"
SMOKE_IP="${SMOKE_IP:-203.0.113.77}"
SMOKE_CARD_MARKER="${SMOKE_CARD_MARKER:-Happening Now}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-90}"

# src/middlewareRateLimit.ts:28 declares LIMITS.POST = 30, and the block fires
# on the request AFTER the budget is filled. 31 is one over, bounded by
# construction, and is the smallest number that can prove the 429.
RATE_LIMIT_POSTS=31

HOST="${SMOKE_HOST%/}"

mkdir -p "$(dirname "$SMOKE_OUT")"

# --- redaction --------------------------------------------------------------
# Phase 1 pattern set. Applied in the pipeline that writes the capture, not
# after it, so no unredacted value is ever on disk.
redact() {
  sed -E \
    -e 's/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/<REDACTED-JWT>/g' \
    -e 's/sb_secret_[A-Za-z0-9_-]+/<REDACTED-SECRET-KEY>/g' \
    -e 's#[Pp]ostgres([Qq][Ll])?://[^[:space:]]*:[^@[:space:]]*@#postgres://<REDACTED>@#g' \
    -e 's/([Bb]earer[[:space:]]+)[A-Za-z0-9._~+/-]+=*/\1<REDACTED-TOKEN>/g' \
    -e 's/(sb-[a-z0-9]+-auth-token=)[^;[:space:]]+/\1<REDACTED-COOKIE>/g'
}

# --- reporting --------------------------------------------------------------
# One line per row: PASS|FAIL <n> <method> <path> :: expected <x> got <y>
# A failing row prints the value it actually saw. "FAIL 5" with no observed
# value tells the next reader nothing, which is the whole complaint behind
# readonly-guard.sh's echo-plus-diff style.

fail=0
ring_fail=0
data_fail=0
RING_ROWS=" 5 6 8 10 "

report() { # $1=n $2=method $3=path $4=expected $5=got $6=ok(0/1)
  if [ "$6" -eq 0 ]; then
    printf 'PASS %s %s %s :: expected %s got %s\n' "$1" "$2" "$3" "$4" "$5"
  else
    printf 'FAIL %s %s %s :: expected %s got %s\n' "$1" "$2" "$3" "$4" "$5"
    fail=$((fail + 1))
    case "$RING_ROWS" in
      *" $1 "*) ring_fail=$((ring_fail + 1)) ;;
      *) data_fail=$((data_fail + 1)) ;;
    esac
  fi
}

# --- request helpers --------------------------------------------------------
# No -L in any of these. curl's --max-time is bounded so a hung target cannot
# wedge the run.

BODY="$(mktemp)"
HEADERS="$(mktemp)"
HOME_HTML="$(mktemp)"
cleanup() { rm -f "$BODY" "$HEADERS" "$HOME_HTML"; }
trap cleanup EXIT

http() { # $1=method $2=path ; extra args follow. Echoes the status code.
  local method="$1" path="$2"
  shift 2
  curl -sS --max-time "$SMOKE_TIMEOUT" -X "$method" \
    -o "$BODY" -D "$HEADERS" -w '%{http_code}' \
    "$@" "${HOST}${path}" 2>/dev/null || echo "000"
}

header_value() { # $1=header name (lowercase)
  tr -d '\r' < "$HEADERS" \
    | while IFS= read -r line; do
        case "$(printf '%s' "$line" | tr '[:upper:]' '[:lower:]')" in
          "$1:"*) printf '%s' "${line#*: }"; break ;;
        esac
      done
}

# Location values are percent-encoded by NextResponse.redirect
# (observed: /?signin=required&next=%2Fprofile). Decode the one escape the
# assertion cares about rather than weakening the assertion to a prefix match.
decode_slash() { printf '%s' "${1//%2F//}"; }

run_rows() {
  echo "# smoke.sh — Tier 2 anonymous HTTP smoke pass"
  echo "# host        : ${HOST}"
  echo "# label       : ${SMOKE_LABEL}"
  echo "# started_at  : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# curl        : $(curl --version 2>/dev/null | head -1)"
  echo "# ring rows   : 5 6 8 10 (request path only — independent of Supabase data)"
  echo "# data rows   : 1 2 3 4 7 9 (need a reachable Supabase with content)"
  echo

  # --- row 1: GET / --------------------------------------------------------
  # The homepage is a client component that fetches events after hydration, so
  # the server HTML carries the discovery-feed scaffold rather than rendered
  # cards. SMOKE_CARD_MARKER therefore names the event-card feed region, not a
  # card. Overriding it to a per-event string would make this row assert data
  # availability, which is row 2's job.
  code="$(http GET /)"
  cp "$BODY" "$HOME_HTML"
  if [ "$code" = "200" ] && grep -qF "$SMOKE_CARD_MARKER" "$HOME_HTML"; then
    report 1 GET / "200+marker" "200+marker" 0
  else
    marker="absent"
    grep -qF "$SMOKE_CARD_MARKER" "$HOME_HTML" && marker="present"
    report 1 GET / "200 with marker '${SMOKE_CARD_MARKER}'" "${code} marker=${marker}" 1
  fi

  # --- row 2: GET /api/events?limit=5 --------------------------------------
  code="$(http GET '/api/events?limit=5')"
  len="$(node -e '
    const fs = require("node:fs");
    try {
      const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const a = Array.isArray(j) ? j : j.events;
      process.stdout.write(Array.isArray(a) ? String(a.length) : "not-an-array");
    } catch { process.stdout.write("unparseable"); }
  ' "$BODY" 2>/dev/null)"
  if [ "$code" = "200" ] && [ "$len" -ge 1 ] 2>/dev/null; then
    report 2 GET /api/events "200 and >=1 event" "200 and ${len} events" 0
  else
    report 2 GET /api/events "200 and >=1 event" "${code} and ${len} events" 1
  fi

  # --- row 3: GET /api/events?search=test&tags=academic --------------------
  code="$(http GET '/api/events?search=test&tags=academic')"
  [ "$code" = "200" ]
  report 3 GET '/api/events?search=test&tags=academic' 200 "$code" $?

  # --- row 4: GET /clubs ---------------------------------------------------
  code="$(http GET /clubs)"
  [ "$code" = "200" ]
  report 4 GET /clubs 200 "$code" $?

  # --- row 5: GET /profile — THE PROTECTED-ROUTE RING ----------------------
  # No -L. A 200 here means the auth ring is gone.
  code="$(http GET /profile)"
  loc="$(decode_slash "$(header_value location)")"
  if [ "$code" = "307" ] \
    && [ "${loc#*signin=required}" != "$loc" ] \
    && [ "${loc#*next=/profile}" != "$loc" ]; then
    report 5 GET /profile "307 -> signin=required&next=/profile" "307 ${loc}" 0
  else
    report 5 GET /profile "307 -> signin=required&next=/profile" "${code} ${loc:-<no-location>}" 1
  fi

  # --- row 6: GET /my-events ------------------------------------------------
  code="$(http GET /my-events)"
  loc="$(decode_slash "$(header_value location)")"
  if [ "$code" = "307" ] && [ "${loc#*signin=required}" != "$loc" ]; then
    report 6 GET /my-events "307 -> signin=required" "307 ${loc}" 0
  else
    report 6 GET /my-events "307 -> signin=required" "${code} ${loc:-<no-location>}" 1
  fi

  # --- row 7: GET /docs -----------------------------------------------------
  code="$(http GET /docs)"
  [ "$code" = "200" ]
  report 7 GET /docs 200 "$code" $?

  # --- row 8: POST /api/events x31 from one address — THE RATE LIMITER -----
  # The route has no POST handler, so the first 30 return 405. That is the
  # point: the limiter runs in the request path BEFORE routing, so the row
  # proves the limiter and not the handler.
  code=""
  i=1
  while [ "$i" -le "$RATE_LIMIT_POSTS" ]; do
    code="$(http POST /api/events -H "x-forwarded-for: ${SMOKE_IP}")"
    i=$((i + 1))
  done
  retry_after="$(header_value retry-after)"
  if [ "$code" = "429" ] && [ -n "$retry_after" ]; then
    report 8 "POST(x${RATE_LIMIT_POSTS})" /api/events "429 + Retry-After" "429 Retry-After=${retry_after}" 0
  else
    report 8 "POST(x${RATE_LIMIT_POSTS})" /api/events "429 + Retry-After" \
      "${code} Retry-After=${retry_after:-<absent>}" 1
  fi

  # --- row 9: GET /api/health ----------------------------------------------
  code="$(http GET /api/health)"
  [ "$code" = "200" ]
  report 9 GET /api/health 200 "$code" $?

  # --- row 10: GET a built chunk — THE MATCHER EXCLUSION -------------------
  # The chunk path is discovered from row 1's HTML so the row works against a
  # dev server and a preview deployment alike. A redirect here means the
  # negative lookahead stopped excluding /_next/static.
  chunk="$(tr '"' '\n' < "$HOME_HTML" | sed -n 's#^\(/_next/static/[^"]*\.js\)$#\1#p' | head -1)"
  if [ -z "$chunk" ]; then
    report 10 GET /_next/static "200 no redirect" "no-chunk-discovered-in-html" 1
  else
    code="$(http GET "$chunk")"
    loc="$(header_value location)"
    if [ "$code" = "200" ] && [ -z "$loc" ]; then
      report 10 GET "$chunk" "200 no redirect" "200 no-location" 0
    else
      report 10 GET "$chunk" "200 no redirect" "${code} location=${loc:-<none>}" 1
    fi
  fi

  echo
  echo "--- ring rows (5 6 8 10): $((4 - ring_fail))/4 passed"
  echo "--- data rows (1 2 3 4 7 9): $((6 - data_fail))/6 passed"
  echo "--- total: $((10 - fail))/10 passed, ${fail} failed"
  if [ "$data_fail" -gt 0 ]; then
    echo "--- NOTE: a failing data row may be environment-limited (unreachable or"
    echo "---       empty Supabase). The expectation is NOT lowered; name the row"
    echo "---       and the reason in the run record instead."
  fi
  echo "# finished_at : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

# The body runs in a subshell because of the pipe, so the failure count is
# handed back through a file rather than a variable.
STATUS_FILE="$(mktemp)"
{
  run_rows
  echo "$fail" > "$STATUS_FILE"
} 2>&1 | redact | tee "$SMOKE_OUT"

fail="$(cat "$STATUS_FILE" 2>/dev/null || echo 1)"
rm -f "$STATUS_FILE"

exit "$fail"
