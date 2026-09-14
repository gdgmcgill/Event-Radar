#!/usr/bin/env node
/**
 * gen-cache-matrix.mjs — AUDIT-08 shared-cache exposure matrix
 * Phase 01-read-only-foundation-audit, plan 01-12
 *
 * Reads:
 *   .planning/audit/inventory/endpoints.json   (plan 01-11 personalization verdicts)
 *   .planning/audit/cache/curl-summary.json    (plan 01-12 wire observations)
 *   vercel.json                                (the blanket platform header under audit)
 *
 * Writes:
 *   .planning/audit/cache/cache-matrix.json
 *   .planning/audit/cache/cache-matrix.csv
 *
 * Zero dependencies, deterministic, ESM. CSV quoting is reimplemented inline on
 * purpose: importing the app-layer export helper from src/ would make an audit
 * artifact depend on the code under audit, and this phase must not touch src/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(AUDIT_DIR, '../..');

const ENDPOINTS_PATH = path.join(AUDIT_DIR, 'inventory/endpoints.json');
const SUMMARY_PATH = path.join(AUDIT_DIR, 'cache/curl-summary.json');
const VERCEL_PATH = path.join(REPO_ROOT, 'vercel.json');
const OUT_JSON = path.join(AUDIT_DIR, 'cache/cache-matrix.json');
const OUT_CSV = path.join(AUDIT_DIR, 'cache/cache-matrix.csv');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const endpoints = readJson(ENDPOINTS_PATH);
const probe = readJson(SUMMARY_PATH);
const vercel = readJson(VERCEL_PATH);

/* ------------------------------------------------------------------ verdicts */
const LEAK_CONFIRMED = 'leak-confirmed';
const LATENT_HAZARD = 'latent-hazard';
const SAFE_BY_ACCIDENT = 'safe-by-accident';
const SAFE_BY_DESIGN = 'safe-by-design';
const NOT_PROBED = 'not-probed';

/* ------------------------------------------------- the blanket platform header */
// vercel.json `source` patterns are path patterns, not response predicates: the
// header is attached by URL path regardless of status code, auth outcome, or who
// is asking. That is why an anonymous 401 is still evidence about the directive
// a 200 on the same path would carry.
const blanketRules = (vercel.headers || [])
  .map((entry) => ({
    source: entry.source,
    regex: new RegExp('^' + String(entry.source).replace(/\(\.\*\)/g, '.*') + '$'),
    cacheControl: (entry.headers || []).find((h) => String(h.key).toLowerCase() === 'cache-control')?.value || null,
  }))
  .filter((r) => r.cacheControl);

const blanketFor = (route) => blanketRules.find((r) => r.regex.test(route)) || null;

/* ------------------------------------------------------- wire observations */
const CONTROL_ROUTES = new Set(probe.requests.filter((r) => r.kind === 'control').map((r) => r.route));

const observedByRoute = new Map();
for (const r of probe.requests) {
  if (!observedByRoute.has(r.route)) observedByRoute.set(r.route, []);
  observedByRoute.get(r.route).push(r);
}
for (const rows of observedByRoute.values()) {
  rows.sort((a, b) => a.iteration - b.iteration || a.session.localeCompare(b.session));
}

const controlRows = probe.requests.filter((r) => r.kind === 'control');
const CONTROL_VALID = controlRows.some((r) => String(r.cache_state).toUpperCase() === 'HIT');
const CROSS_SESSION_RAN = probe.cross_session_probe?.ran === true;
const CACHE_KEY_IGNORES_SESSION = probe.cache_key?.varies_on_session === false;

const isCacheServe = (state) => ['HIT', 'STALE'].includes(String(state).toUpperCase());

/* --------------------------------------------------------------- classifier */
function classify(endpoint, method, observed) {
  const route = endpoint.route;
  const personalized = endpoint.personalized === true;
  const ownCc = (endpoint.signals?.cache_control_values || []).join('; ');
  const blanket = blanketFor(route);
  const isControl = CONTROL_ROUTES.has(route) && method === 'GET';

  const states = observed.map((o) => o.cache_state).filter(Boolean);
  const served = states.some(isCacheServe);
  const hit = states.some((s) => String(s).toUpperCase() === 'HIT');
  const everySetCookie = observed.length > 0 && observed.every((o) => o.set_cookie === true);
  const anonymousReachable = endpoint.expected_status?.anonymous === 200;

  // A cross-session hit is a hit observed on a request carrying session B after
  // an entry was populated by session A. Only the two-cookie run can see it.
  const crossSessionHit = CROSS_SESSION_RAN
    ? observed.some((o) => o.session === 'b' && String(o.cache_state).toUpperCase() === 'HIT')
    : null;

  const declaresPrivate = /no-store|private/i.test(ownCc);
  const sharedDirective = declaresPrivate ? null : (ownCc || blanket?.cacheControl || null);

  const base = {
    route,
    method,
    personalized,
    declared_cache_control: ownCc || null,
    blanket_header_applies: Boolean(blanket) && !declaresPrivate,
    blanket_header_source: blanket ? blanket.source : null,
    observed_cache_control: observed.find((o) => o.cache_control)?.cache_control || null,
    observed_cache_states: states.join('|'),
    max_age_seen: observed.length ? Math.max(0, ...observed.map((o) => o.age ?? 0)) : null,
    set_cookie_seen: observed.length ? observed.some((o) => o.set_cookie) : null,
    shared_cache_hit_observed: observed.length ? hit : null,
    shared_cache_serve_observed: observed.length ? served : null,
    cache_key_ignores_session: CACHE_KEY_IGNORES_SESSION,
    cross_session_hit: crossSessionHit,
    positive_control: isControl,
    is_control: isControl,
    evidence_basis: observed.length
      ? 'wire (anonymous session)'
      : (blanket ? 'static (vercel.json path rule + probed path samples on the same prefix)' : 'static (source + vercel.json path rule)'),
    evidence: observed.length ? observed.map((o) => o.capture).slice(0, 3) : [],
  };

  // -- gate 0: a run whose control never cached licenses no conclusion at all.
  if (!CONTROL_VALID) {
    return {
      ...base,
      verdict: NOT_PROBED,
      severity: null,
      reason: 'BROKEN HARNESS — the positive control never returned x-vercel-cache: HIT, so nothing in this run distinguishes "does not cache" from "probe cannot observe caching". Re-run the probe before reading any verdict here.',
      finding_candidate: null,
    };
  }

  // -- gate 1: non-GET responses are not stored by the shared cache.
  if (method !== 'GET') {
    return {
      ...base,
      verdict: SAFE_BY_DESIGN,
      severity: null,
      reason: `Method ${method}: the shared cache does not store responses to non-GET requests, so the blanket directive cannot expose this representation.`,
      finding_candidate: null,
    };
  }

  // -- gate 2: an observed cross-session hit is the confirmed leak.
  if (crossSessionHit === true) {
    return {
      ...base,
      verdict: LEAK_CONFIRMED,
      severity: 'Critical',
      reason: `Confirmed cross-user serve: a request carrying session B received x-vercel-cache: HIT on ${route}, a personalized response populated by session A.`,
      finding_candidate: {
        route,
        severity: 'Critical',
        title: `Shared CDN serves one user's ${route} response to another user`,
        evidence: base.evidence,
      },
    };
  }

  // -- gate 3: an explicit private/no-store directive is the designed defence.
  if (declaresPrivate) {
    return {
      ...base,
      verdict: SAFE_BY_DESIGN,
      severity: null,
      reason: `The handler sets "${ownCc}" itself, which overrides the blanket header; observed on the wire as "${base.observed_cache_control ?? 'not probed'}" and never served from cache in this run.`,
      finding_candidate: null,
    };
  }

  // -- gate 4: nothing shared-cacheable attaches to this path at all.
  if (!blanket && !ownCc) {
    const mechanism = observed.length
      ? `no shared-cache directive is attached to this path (it is outside ${blanketRules.map((r) => r.source).join(', ')}) and every observed response was x-vercel-cache: MISS`
      : `no shared-cache directive is attached to this path (it is outside ${blanketRules.map((r) => r.source).join(', ')})`;
    return {
      ...base,
      verdict: personalized ? SAFE_BY_ACCIDENT : SAFE_BY_DESIGN,
      severity: null,
      reason: personalized
        ? `Safe only incidentally: ${mechanism}. Nothing in the handler declares the response private, so moving this route under a header rule would expose it. Stage 3 must not rely on this.`
        : `Not personalized and no shared-cache directive attaches to this path.`,
      finding_candidate: null,
    };
  }

  // -- gate 5: a set-cookie on every observed response suppresses caching.
  if (everySetCookie && !served) {
    return {
      ...base,
      verdict: personalized ? SAFE_BY_ACCIDENT : SAFE_BY_DESIGN,
      severity: personalized ? 'Medium' : null,
      reason: `Incidental, not designed: every observed response carried a set-cookie header (the Supabase PKCE code-verifier), and the shared cache declines to store a response that sets cookies. The route still declares "${sharedDirective}". The moment that cookie stops being emitted — a refactor, a session-handling change — this route caches. Stage 3 cannot rely on this.`,
      finding_candidate: personalized
        ? { route, severity: 'Medium', title: `${route} is uncached only because it emits set-cookie on every response`, evidence: base.evidence }
        : null,
    };
  }

  // -- gate 6: personalized response under a shared-cache directive.
  if (personalized) {
    const proven = served || hit;
    const severity = proven ? 'Critical' : 'High';
    return {
      ...base,
      verdict: LATENT_HAZARD,
      severity,
      reason: proven
        ? `Shared caching of a personalized response is PROVEN on the wire: ${route} answered ${states.join(', ')} with age up to ${base.max_age_seen}s while carrying "${sharedDirective}". The cache key is the URL alone — no response varied on Cookie or Authorization — so the stored entry is served to every caller of this URL regardless of which session produced it. The verdict is held at latent-hazard rather than leak-confirmed only because the two-account observation was blocked: COOKIE_A/COOKIE_B were not supplied. Treat as Critical.`
        : `No cache serve observed in this window, but the personalized response still carries the shared-cache directive "${sharedDirective}" and the cache key ignores the session. Absence of a hit in a short window is not evidence of safety.`,
      finding_candidate: {
        route,
        severity,
        title: proven
          ? `Personalized ${route} is stored and re-served by the shared CDN under the blanket s-maxage header`
          : `Personalized ${route} carries a shared-cache directive with a session-independent cache key`,
        evidence: base.evidence,
      },
    };
  }

  // -- gate 7: not personalized, but is the 200 actually public?
  if (!anonymousReachable) {
    return {
      ...base,
      verdict: LATENT_HAZARD,
      severity: 'High',
      reason: `Not user-specific, but not public either: anonymous callers receive ${endpoint.expected_status?.anonymous}, while an authorized caller's 200 carries "${sharedDirective}". Because the cache key ignores the session, a 200 generated for an authorized caller can be stored and then served to an unauthorized one. Auth is enforced in the handler, which the shared cache sits in front of.`,
      finding_candidate: {
        route,
        severity: 'High',
        title: `Auth-gated ${route} carries a shared-cache directive with a session-independent cache key`,
        evidence: base.evidence,
      },
    };
  }

  // -- gate 8: genuinely public content; shared caching is the intent.
  return {
    ...base,
    verdict: SAFE_BY_DESIGN,
    severity: null,
    reason: `Public and identical for every caller (anonymous callers receive 200 and the response is not personalized), so a shared-cache entry exposes nothing that the caller could not fetch directly.`,
    finding_candidate: null,
  };
}

/* ------------------------------------------------------------------ assemble */
const matrix = [];
const sorted = [...endpoints].sort((a, b) => a.route.localeCompare(b.route));
for (const endpoint of sorted) {
  // GET is emitted LAST for each route on purpose. validate.mjs builds a
  // route-keyed map from the CSV where the last row for a route wins, and the
  // GET row is the one that carries the cacheable representation's verdict.
  const methods = [...endpoint.methods].sort((a, b) => (a === 'GET' ? 1 : 0) - (b === 'GET' ? 1 : 0) || a.localeCompare(b));
  for (const method of methods) {
    const observed = (observedByRoute.get(endpoint.route) || []).filter(() => method === 'GET');
    matrix.push(classify(endpoint, method, observed));
  }
}

/* ----------------------------------------------------------------- coverage */
const personalizedRoutes = endpoints.filter((e) => e.personalized === true).map((e) => e.route);
const covered = new Set(matrix.map((r) => r.route));
const missing = personalizedRoutes.filter((r) => !covered.has(r));
if (missing.length) {
  console.error(`FATAL: ${missing.length} personalized routes have no matrix row: ${missing.join(', ')}`);
  process.exit(1);
}
const unprobedPersonalized = matrix.filter((r) => r.personalized && r.method === 'GET' && r.verdict === NOT_PROBED);
if (unprobedPersonalized.length && CONTROL_VALID) {
  console.error(`FATAL: ${unprobedPersonalized.length} personalized GET rows are not-probed while the control was valid.`);
  process.exit(1);
}
if (!matrix.some((r) => r.is_control === true)) {
  console.error('FATAL: no control row in the matrix.');
  process.exit(1);
}

/* ---------------------------------------------------------------- CSV writer */
// Inline, deliberately. RFC 4180: quote when the cell contains a comma, a quote,
// a newline or leading/trailing whitespace; escape an embedded quote by doubling.
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const s = Array.isArray(value) ? value.join(' ') : String(value);
  const flat = s.replace(/\r?\n/g, ' ');
  return /[",]/.test(flat) || flat !== flat.trim() ? `"${flat.replace(/"/g, '""')}"` : flat;
};

const COLUMNS = [
  'route', 'method', 'personalized', 'declared_cache_control', 'blanket_header_applies',
  'observed_cache_control', 'observed_cache_states', 'max_age_seen', 'set_cookie_seen',
  'shared_cache_hit_observed', 'cache_key_ignores_session', 'cross_session_hit',
  'positive_control', 'evidence_basis', 'verdict', 'severity', 'reason',
];

const csv = [COLUMNS.join(',')]
  .concat(matrix.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(',')))
  .join('\n') + '\n';

fs.writeFileSync(OUT_JSON, JSON.stringify(matrix, null, 2) + '\n');
fs.writeFileSync(OUT_CSV, csv);

const tally = matrix.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
console.error(`rows=${matrix.length} routes=${covered.size} control_valid=${CONTROL_VALID} cross_session_ran=${CROSS_SESSION_RAN}`);
console.error(Object.entries(tally).map(([k, v]) => `${k}=${v}`).join(' '));
console.error(`finding_candidates=${matrix.filter((r) => r.finding_candidate).length}`);
