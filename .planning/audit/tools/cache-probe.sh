#!/usr/bin/env bash
# =============================================================================
# cache-probe.sh — AUDIT-08 shared-cache exposure probe
# Phase 01-read-only-foundation-audit, plan 01-12
#
# WHAT THIS DOES
#   Issues header-only GET requests against the PRODUCTION deployment and
#   records, per route / session / iteration, whether the shared CDN served a
#   cached response. The question under test is whether the blanket
#   `Cache-Control: s-maxage=60, stale-while-revalidate=300` that vercel.json
#   attaches to `/api/(.*)` reaches PERSONALIZED responses, which would let the
#   CDN serve one user's JSON to another user.
#
# READ-ONLY CONTRACT
#   * GET only. No -X POST/PUT/PATCH/DELETE anywhere in this file.
#   * Response bodies are discarded (-o /dev/null); only headers are captured.
#   * `set-cookie` values are replaced with <REDACTED> INSIDE the same pipeline
#     that writes the file, so an unredacted token never reaches disk even
#     momentarily. The production deployment emits a Supabase PKCE
#     code-verifier cookie on every response, so this is not hypothetical.
#   * Command tracing (`set -x`) is never enabled: this script receives live
#     session tokens through the environment.
#
# INPUTS (environment only — never CLI arguments, never files)
#   PROD_HOST   required. Production origin including the scheme.
#               No default: a fallback could silently target the wrong system.
#   COOKIE_A    optional. Complete signed-in session cookie set, account A.
#   COOKIE_B    optional. Complete signed-in session cookie set, a DIFFERENT
#               account. Both are needed for the cross-session half; when
#               either is absent the run degrades to the anonymous half and
#               records the cross-session half as BLOCKED rather than clean.
#   CLUB_ID     optional. A real public club id, so the `/api/clubs/[id]/...`
#               routes are probed against a live resource instead of a 404.
#   EVENT_ID    optional. Same, for `/api/events/[id]/...`.
#   ITERATIONS  optional, default 3.
#   SPACING     optional, default 2 (seconds between requests).
#
# OUTPUTS
#   .planning/audit/cache/curl/<slug>.<session>.<n>.headers.txt
#   .planning/audit/cache/curl-summary.json
#
# ROUTE LIST
#   Derived from .planning/audit/inventory/endpoints.json — the personalization
#   verdicts resolved by plan 01-11. Never hand-typed. Ordered by suspicion:
#   recommendations, saved-events, notifications, club-membership, invite and
#   personal-event routes come first.
# =============================================================================

set -uo pipefail

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENDPOINTS="${AUDIT_DIR}/inventory/endpoints.json"
OUT_DIR="${AUDIT_DIR}/cache/curl"
SUMMARY="${AUDIT_DIR}/cache/curl-summary.json"

ITERATIONS="${ITERATIONS:-3}"
SPACING="${SPACING:-2}"

# --- input gate -------------------------------------------------------------
if [ -z "${PROD_HOST:-}" ]; then
  echo "FATAL: PROD_HOST is not set. There is no default; set it in the environment." >&2
  exit 2
fi
if [ ! -f "$ENDPOINTS" ]; then
  echo "FATAL: ${ENDPOINTS} is missing — run plan 01-02/01-11 first." >&2
  exit 2
fi

HAVE_SESSIONS=0
if [ -n "${COOKIE_A:-}" ] && [ -n "${COOKIE_B:-}" ]; then
  if [ "${COOKIE_A}" = "${COOKIE_B}" ]; then
    echo "FATAL: COOKIE_A and COOKIE_B are identical. A cross-session hit can only" >&2
    echo "       be demonstrated with two DISTINCT accounts." >&2
    exit 2
  fi
  HAVE_SESSIONS=1
fi

mkdir -p "$OUT_DIR"

# --- route list, derived from the inventory ---------------------------------
# Emits TAB-separated: kind <TAB> route-template <TAB> url-path
# kind is one of: control | personalized | path-sample
export ENDPOINTS OUT_DIR SUMMARY PROD_HOST ITERATIONS SPACING
ROUTES_TSV="$(node --input-type=module -e '
import fs from "node:fs";
const endpoints = JSON.parse(fs.readFileSync(process.env.ENDPOINTS, "utf8"));
const clubId  = process.env.CLUB_ID  || "00000000-0000-0000-0000-000000000000";
const eventId = process.env.EVENT_ID || "00000000-0000-0000-0000-000000000000";
const concrete = (r) => r.replace(/\[id\]/g, r.startsWith("/api/clubs") ? clubId : eventId);

// Suspicion ordering: the routes whose bodies would be most damaging first.
const SUSPICION = [
  "/api/recommendations", "/api/users/saved-events", "/api/notifications/count",
  "/api/notifications", "/api/my-clubs", "/api/clubs/[id]/events",
  "/api/events/my-events", "/api/events/following", "/api/events/friends-activity",
  "/api/events/friends-organizing", "/api/events/[id]/friends", "/api/events/[id]/rsvp",
  "/api/auth-debug",
];
const rank = (r) => { const i = SUSPICION.indexOf(r); return i === -1 ? 999 : i; };

const rows = [];

// Positive controls: public, non-personalized, explicitly shared-cacheable.
// Without a control that HITs, a run with no hits anywhere proves nothing.
//   /api/clubs/featured  — low-traffic public list; repeats inside one freshness
//                          window reliably produce x-vercel-cache: HIT.
//   /api/events/featured — higher-traffic public list; usually answers STALE
//                          because real traffic keeps revalidating it.
//   /api/health          — the negative-side control. It emits set-cookie on
//                          every response and never caches, which is the
//                          mechanism that makes some routes safe-by-accident.
for (const route of ["/api/clubs/featured", "/api/events/featured", "/api/health"]) {
  rows.push(["control", route, route]);
}

// Personalized routes an anonymous client can reach with a 200. These are the
// rows where a shared-cache HIT would be a confirmed cross-user leak.
const anonReachable = endpoints
  .filter((e) => e.personalized === true
    && e.methods.includes("GET")
    && e.expected_status && e.expected_status.anonymous === 200
    && e.route.startsWith("/api/"))
  .sort((a, b) => rank(a.route) - rank(b.route));
for (const e of anonReachable) rows.push(["personalized", e.route, concrete(e.route)]);

// Personalized routes gated behind auth. Anonymously they answer 401, but the
// platform header in vercel.json is attached BY PATH, so the 401 still shows
// whether that path carries a shared-cache directive. Two samples are enough
// to establish the path rule; the rest inherit it statically.
const authGated = endpoints
  .filter((e) => e.personalized === true
    && e.methods.includes("GET")
    && e.expected_status && e.expected_status.anonymous === 401
    && e.route.startsWith("/api/"))
  .sort((a, b) => rank(a.route) - rank(b.route))
  .slice(0, 2);
for (const e of authGated) rows.push(["path-sample", e.route, concrete(e.route)]);

// The OAuth callback is personalized but sits OUTSIDE the /api/(.*) header
// rule. With no `code` query parameter the handler redirects immediately and
// exchanges nothing, so this is a safe read.
if (endpoints.some((e) => e.route === "/auth/callback" && e.personalized === true)) {
  rows.push(["personalized", "/auth/callback", "/auth/callback"]);
}

process.stdout.write(rows.map((r) => r.join("\t")).join("\n") + "\n");
')"

if [ -z "$ROUTES_TSV" ]; then
  echo "FATAL: route derivation from endpoints.json produced nothing." >&2
  exit 2
fi

# --- session list -----------------------------------------------------------
# Interleaved so a cross-session hit has the chance to appear: iteration 1 runs
# every session before iteration 2 begins, keeping all iterations for a route
# inside one s-maxage=60 freshness window.
if [ "$HAVE_SESSIONS" -eq 1 ]; then
  SESSIONS="anon a b"
else
  SESSIONS="anon"
fi

slugify() {
  printf '%s' "$1" | tr '/' '_' | tr -cd 'A-Za-z0-9_.-' | sed 's/^_//'
}

# Capture a single request. Headers only; set-cookie redacted in the pipeline.
capture() {
  local url_path="$1" session="$2" iter="$3" outfile="$4"
  local cookie=""
  case "$session" in
    a) cookie="${COOKIE_A:-}" ;;
    b) cookie="${COOKIE_B:-}" ;;
  esac

  if [ -n "$cookie" ]; then
    curl -sS -o /dev/null -D - --max-time 25 \
      -H "Cookie: $cookie" \
      -H 'Accept: application/json' \
      "${PROD_HOST}${url_path}" 2>&1
  else
    curl -sS -o /dev/null -D - --max-time 25 \
      -H 'Accept: application/json' \
      "${PROD_HOST}${url_path}" 2>&1
  fi |
    # Redaction happens HERE, before the write. Any set-cookie value — the
    # Supabase PKCE code-verifier, a refreshed session token, anything — is
    # replaced with the marker while still in the pipe.
    sed -E 's/^([Ss]et-[Cc]ookie:).*$/\1 <REDACTED>/' |
    # HTTP framing is CRLF; strip the CR so downstream string comparisons on
    # header values ("HIT" vs "HIT\r") are not silently false.
    tr -d '\r' |
    # Keep only the status line and the headers that bear on caching. Dropping
    # everything else also drops any header we have not reasoned about.
    awk 'BEGIN{IGNORECASE=1}
         /^HTTP\// {print; next}
         /^(cache-control|cdn-cache-control|vary|age|x-vercel-cache|x-matched-path|x-vercel-id|set-cookie|cf-cache-status|cf-ray|retry-after|content-type):/ {print}' \
    > "$outfile"
}

# --- run --------------------------------------------------------------------
RECORDS="${AUDIT_DIR}/cache/.records.tsv"
export RECORDS
: > "$RECORDS"

REQ_N=0
for iter in $(seq 1 "$ITERATIONS"); do
  while IFS="$(printf '\t')" read -r kind route url_path; do
    [ -z "${route:-}" ] && continue
    for session in $SESSIONS; do
      slug="$(slugify "$route")"
      outfile="${OUT_DIR}/${slug}.${session}.${iter}.headers.txt"
      capture "$url_path" "$session" "$iter" "$outfile"
      REQ_N=$((REQ_N + 1))

      status="$(awk '/^HTTP\//{print $2; exit}' "$outfile")"
      if [ "${status:-}" = "429" ]; then
        echo "STOP: received 429 from ${route}. Halting to respect the rate limit." >&2
        printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
          "$kind" "$route" "$url_path" "$session" "$iter" "429" "" "" "" >> "$RECORDS"
        break 3
      fi

      cache_state="$(awk 'BEGIN{IGNORECASE=1}/^x-vercel-cache:/{print $2; exit}' "$outfile")"
      age="$(awk 'BEGIN{IGNORECASE=1}/^age:/{print $2; exit}' "$outfile")"
      cc="$(awk 'BEGIN{IGNORECASE=1}/^cache-control:/{sub(/^[^:]*: */,""); print; exit}' "$outfile")"
      sc="$(awk 'BEGIN{IGNORECASE=1}/^set-cookie:/{c=1}END{print (c?"true":"false")}' "$outfile")"
      vary="$(awk 'BEGIN{IGNORECASE=1}/^vary:/{sub(/^[^:]*: */,""); print; exit}' "$outfile")"

      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$kind" "$route" "$url_path" "$session" "$iter" \
        "${status:-}" "${cache_state:-}" "${age:-}" "$sc" "${cc:-}" "${vary:-}" >> "$RECORDS"

      sleep "$SPACING"
    done
  done <<< "$ROUTES_TSV"
done

# --- summary ----------------------------------------------------------------
node --input-type=module -e '
import fs from "node:fs";
const lines = fs.readFileSync(process.env.RECORDS, "utf8").split("\n").filter((l) => l.trim() !== "");
const requests = lines.map((l) => {
  const [kind, route, url_path, session, iteration, status, cache_state, age, set_cookie, cache_control, vary] = l.split("\t");
  return {
    kind, route, url_path, session,
    iteration: Number(iteration),
    status: status === "" ? null : Number(status),
    cache_state: cache_state === "" ? null : cache_state,
    age: age === "" ? null : Number(age),
    set_cookie: set_cookie === "true",
    cache_control: cache_control === "" ? null : cache_control,
    vary: vary === undefined || vary === "" ? null : vary,
    capture: `cache/curl/${route.replace(/\//g, "_").replace(/^_/, "").replace(/[^A-Za-z0-9_.-]/g, "")}.${session}.${iteration}.headers.txt`,
  };
});

const controlRows = requests.filter((r) => r.kind === "control");
const controlHit = controlRows.some((r) => (r.cache_state || "").toUpperCase() === "HIT");
const controlServedFromCache = controlRows.some((r) => ["HIT", "STALE"].includes((r.cache_state || "").toUpperCase()));
// The CDN cache key. If no response varies on Cookie or Authorization, then a
// cache entry for a URL is shared by every client regardless of session, and a
// HIT on a personalized URL is a cross-user serve by construction.
const varyValues = [...new Set(requests.map((r) => r.vary).filter(Boolean))];
const variesOnSession = varyValues.some((v) => /cookie|authorization/i.test(v));
const sessions = [...new Set(requests.map((r) => r.session))];
const crossSession = sessions.includes("a") && sessions.includes("b");

const control = {
  routes: [...new Set(controlRows.map((r) => r.route))],
  requests: controlRows.length,
  observed_states: controlRows.map((r) => r.cache_state),
  hit_observed: controlHit,
  served_from_cache_observed: controlServedFromCache,
  harness_valid: controlHit,
  note: controlHit
    ? "A public, non-personalized route returned x-vercel-cache: HIT, so this harness can observe a shared-cache hit. A negative result on a personalized route is therefore a real negative, not a broken probe."
    : "NO CONTROL HIT. Nothing cached anywhere in this run, so no conclusion about personalized routes is licensed. Every personalized verdict must be not-probed with a broken-harness reason.",
};

const summary = {
  plan: "01-12",
  requirement: "AUDIT-08",
  generated_at: new Date().toISOString(),
  host: process.env.PROD_HOST,
  iterations: Number(process.env.ITERATIONS || 3),
  spacing_seconds: Number(process.env.SPACING || 2),
  sessions_used: sessions,
  cross_session_probe: crossSession
    ? { ran: true, blocked_reason: null }
    : {
        ran: false,
        blocked_reason: "COOKIE_A and/or COOKIE_B were not supplied to the executing shell. Two distinct signed-in sessions are the only way to demonstrate a cross-user hit; see .planning/audit/BLOCKING-INPUTS.md section 2.",
        retry_command: "export PROD_HOST=https://universeapp.ca COOKIE_A=\u0027<account A cookie set>\u0027 COOKIE_B=\u0027<account B cookie set>\u0027; bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs",
      },
  control,
  cache_key: {
    vary_values_observed: varyValues,
    varies_on_session: variesOnSession,
    note: variesOnSession
      ? "At least one response varies on Cookie or Authorization, so cache entries may be segmented per session."
      : "No response varies on Cookie or Authorization. The shared-cache key is the URL alone, so a cached entry for a personalized URL is served to every client regardless of which session populated it.",
  },
  run_verdict: !controlHit
    ? "inconclusive-broken-harness"
    : (crossSession ? "conclusive" : "anonymous-half-only"),
  requests,
};

fs.writeFileSync(process.env.SUMMARY, JSON.stringify(summary, null, 2) + "\n");
process.stderr.write(`captures=${requests.length} control_hit=${controlHit} verdict=${summary.run_verdict}\n`);
'

if [ -s "$SUMMARY" ]; then rm -f "$RECORDS"; fi
echo "wrote ${SUMMARY}"
