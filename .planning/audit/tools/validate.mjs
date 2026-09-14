#!/usr/bin/env node
/**
 * .planning/audit/tools/validate.mjs
 *
 * Phase 1 artifact + schema + cross-reference validator.
 *
 * Zero dependencies by design. Jest lives in src/ and package.json, and writing to
 * either fails this phase's exit criterion, so the validation harness is this file
 * plus readonly-guard.sh, both under .planning/audit/tools/ and both run directly.
 * Only node:fs and node:path are imported. Nothing from src/ is imported. This file
 * is never added to package.json.
 *
 * CLI contract
 *   node validate.mjs                 run all checks; exit 0 only if none FAILed
 *   node validate.mjs --check <name>  run exactly one check; absent inputs are a FAIL
 *   node validate.mjs --quick         run only checks whose inputs exist; rest are SKIP
 *   node validate.mjs --selftest      check the registry, the schemas and the schema
 *                                     checker itself; touches no evidence artifact
 *   node validate.mjs --list          print the check registry
 *
 * Output is one line per rule:
 *   PASS|FAIL|SKIP <check-name> :: <rule> :: <detail>
 * so a failure names the exact rule, mirroring the repo's Jest reporting granularity.
 *
 * Expected row counts are parsed from baseline/versions.txt. No numeric literal for
 * the route, page or migration counts appears in this file: upstream planning docs
 * disagree with the tree, and a validator that trusts them fails on a correct
 * inventory. versions.txt is re-derived from the working tree; it is the only
 * count source.
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ paths -- */

const AUDIT_ROOT = path.resolve(import.meta.dirname, '..');

const VERSIONS_FILE = 'baseline/versions.txt';
const ENDPOINTS_FILE = 'inventory/endpoints.json';
const ENDPOINTS_SCHEMA = 'inventory/endpoints.schema.json';
const PAGES_FILE = 'inventory/pages.json';
const PAGES_SCHEMA = 'inventory/pages.schema.json';
const SPECIAL_FILES = 'inventory/special-files.json';
const BUILD_ROUTES = 'inventory/build-routes.txt';
const FINDINGS_FILE = 'findings.json';
const FINDINGS_SCHEMA = 'findings.schema.json';
const AUDIT_REPORT = 'FOUNDATION_AUDIT.md';

const A = (...seg) => path.join(AUDIT_ROOT, ...seg);
const exists = (rel) => fs.existsSync(A(rel));
const readText = (rel) => fs.readFileSync(A(rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));
const sizeOf = (rel) => fs.statSync(A(rel)).size;

/* --------------------------------------------------------------- scrubbing -- */

/**
 * Never print a caught error object verbatim: a connection string or a cookie can
 * ride along inside one, and .planning/ is committed. Print the rule name and a
 * scrubbed message instead.
 */
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '<REDACTED-JWT>'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '<REDACTED-SECRET-KEY>'],
  [/postgres(ql)?:\/\/[^\s]*:[^@\s]*@/gi, 'postgres://<REDACTED>@'],
  [/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1<REDACTED-TOKEN>'],
  [/(sb-[a-z0-9]+-auth-token=)[^;\s]+/gi, '$1<REDACTED-COOKIE>'],
];

function scrub(input) {
  let text = typeof input === 'string' ? input : String(input);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

/* --------------------------------------------------------------- reporting -- */

const results = [];

function emit(status, check, rule, detail) {
  results.push({ status, check, rule });
  console.log(`${status} ${check} :: ${rule} :: ${scrub(detail)}`);
}

function makeCtx(check, versions) {
  return {
    versions,
    assert(condition, rule, detail) {
      emit(condition ? 'PASS' : 'FAIL', check, rule, detail);
      return Boolean(condition);
    },
    note(rule, detail) {
      emit('SKIP', check, rule, detail);
    },
  };
}

/* ------------------------------------------------------------ versions.txt -- */

function loadVersions() {
  const map = new Map();
  if (!exists(VERSIONS_FILE)) return map;
  for (const line of readText(VERSIONS_FILE).split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function expectedCount(versions, key) {
  const raw = versions.get(key);
  if (raw === undefined) throw new Error(`${VERSIONS_FILE} is missing key ${key}`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) throw new Error(`${VERSIONS_FILE} key ${key} is not an integer`);
  return parsed;
}

/* ------------------------------------------------- hand-rolled schema check -- */

/**
 * Draft-2020-12 SUBSET checker. Supported keywords, and only these:
 *   type (string or array of strings), required, properties, items, enum,
 *   pattern, additionalProperties (false only).
 * The three schema files under .planning/audit/ are authored against exactly this
 * subset. No schema library is installed; installing one would touch package.json.
 */
function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, type) {
  switch (type) {
    case 'null': return value === null;
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number';
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    default: return false;
  }
}

function checkSchema(value, schema, loc, errors) {
  if (schema === null || typeof schema !== 'object') return errors;

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${loc}: expected ${types.join(' or ')}, got ${typeName(value)}`);
      return errors;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((allowed) => allowed === value)) {
    errors.push(`${loc}: ${JSON.stringify(value)} is not one of the permitted values`);
  }

  if (typeof schema.pattern === 'string' && typeof value === 'string') {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push(`${loc}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${loc}.${key}: missing key (a missing key is a schema error, never an implicit placeholder)`);
      }
    }
    const props = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (props[key] !== undefined) checkSchema(child, props[key], `${loc}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${loc}.${key}: property not permitted by the schema`);
    }
  }

  if (Array.isArray(value) && schema.items !== undefined) {
    value.forEach((item, index) => checkSchema(item, schema.items, `${loc}[${index}]`, errors));
  }

  return errors;
}

function schemaErrorsForRows(rows, schema, label) {
  const errors = [];
  rows.forEach((row, index) => checkSchema(row, schema, `${label}[${index}]`, errors));
  return errors;
}

/* ----------------------------------------------------- small shared helpers -- */

const PLACEHOLDER = 'unknown';
const NOT_PROBED = 'not-probed';
const MIN_SNAPSHOT_BYTES = 1024;
const MAX_THREAT_MODEL_LINES = 120;
const RLS_COMMANDS = ['select', 'insert', 'update', 'delete'];
const RLS_CELL_VALUES = ['allow', 'deny', 'none'];
/**
 * The service-role callsites that are not route.ts handlers:
 *   src/app/users/[id]/page.tsx   — the single page component
 *   src/lib/audit.ts              — the admin audit-logging library module
 *   src/lib/supabase/service.ts   — the factory itself
 *
 * Seeded as 2 in plan 01-01 (page + lib/audit.ts, following 01-RESEARCH.md
 * § Validation Architecture Test Map), which omitted the factory module. That
 * disagreed with this file's own rule that versions.txt is the only count
 * source: baseline/versions.txt records service_client_file_count=25 from
 * `grep -rl createServiceClient src/`, whose comment states it "includes the
 * definition module itself", and 22 route handlers + 2 is 24. Plan 01-07 Task 1
 * registers all three non-route callsites, so the literal is now only a
 * fallback and the assertion below is cross-checked against versions.txt.
 */
const NON_ROUTE_SERVICE_CLIENT_CALLSITES = 3;
const MAX_RISK_ACCEPTANCE_DAYS = 90;
const MS_PER_DAY = 86400000;

const ENDPOINT_HUMAN_FIELDS = [
  'auth_requirement', 'role_required', 'rls_reliance', 'service_role_justified',
  'personalized', 'cache_policy_today', 'cache_policy_target', 'input_validation',
  'test_present', 'dead_or_duplicate',
];

const PAGE_HUMAN_FIELDS = [
  'component_type', 'data_source', 'middleware_protected', 'layout_guard',
  'page_guard', 'effective_protection', 'render_mode', 'dead_or_duplicate',
];

const SERVICE_ROLE_JUSTIFICATIONS = [
  'rls_bypass_required', 'caller_authenticated_first',
  'user_input_used_as_filter', 'reachable_from_client_bundle',
];

const FINDING_REQUIRED_FIELDS = [
  'id', 'title', 'severity', 'severity_rationale', 'category', 'affected_paths',
  'evidence', 'reproduction', 'recommended_fix', 'validation_criterion', 'status',
];

const FINDING_ID_PATTERN = /^F-\d{3}$/;
const FINDING_ID_SCAN = /\bF-\d{3}\b/g;

function placeholderHits(rows, fields, label) {
  const hits = [];
  rows.forEach((row, index) => {
    for (const field of fields) {
      if (row[field] === PLACEHOLDER) hits.push(`${label}[${index}].${field}`);
    }
    const expected = row.expected_status;
    if (expected !== null && typeof expected === 'object') {
      for (const [persona, value] of Object.entries(expected)) {
        if (value === PLACEHOLDER) hits.push(`${label}[${index}].expected_status.${persona}`);
      }
    }
  });
  return hits;
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

/** Minimal CSV reader: no embedded newlines, double-quote escaping only. */
function parseCsv(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { header: [], rows: [] };
  const split = (line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { cells.push(cell); cell = ''; }
      else cell += ch;
    }
    cells.push(cell);
    return cells.map((c) => c.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    const row = {};
    header.forEach((key, i) => { row[key] = cells[i] === undefined ? '' : cells[i]; });
    row.__cells = cells;
    return row;
  });
  return { header, rows };
}

/** Pull route paths out of the `next build` route table. */
function parseBuildRoutes(text) {
  const routes = new Set();
  for (const line of text.split('\n')) {
    if (/first load js|route \(app\)|^\s*[+└├│]?\s*$/i.test(line)) continue;
    const token = line.split(/\s+/).filter(Boolean).find((t) => t.startsWith('/'));
    if (token) routes.add(token);
  }
  return routes;
}

function containsAll(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => !lower.includes(n.toLowerCase()));
}

function integerFor(text, key) {
  const match = text.match(new RegExp(`${key}\\s*[:=|]+\\s*\\**\\s*(\\d+)`, 'i'));
  return match ? Number.parseInt(match[1], 10) : null;
}

/* -------------------------------------------------------- the check registry -- */

const CHECK_NAMES = [
  'schema-snapshots', 'drift', 'endpoints', 'endpoints-signals', 'pages', 'rls',
  'heatmap', 'service-role', 'cache', 'authz-registers', 'cron', 'deps',
  'baseline', 'observability', 'dead-code', 'bundle-sweep', 'threat-models',
  'storage', 'dates', 'findings', 'sla',
];

const CHECKS = {
  /* ---------------------------------------------------------------- AUDIT-01 */
  'schema-snapshots': {
    requirement: 'AUDIT-01',
    inputs: ['schema/prod.schema.sql', 'schema/staging.schema.sql', 'schema/local.schema.sql'],
    run(ctx) {
      for (const rel of CHECKS['schema-snapshots'].inputs) {
        const bytes = sizeOf(rel);
        ctx.assert(bytes > MIN_SNAPSHOT_BYTES, 'dump-is-non-trivial', `${rel} is ${bytes} bytes`);
        ctx.assert(readText(rel).includes('CREATE TABLE'), 'dump-contains-create-table', rel);
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-02 */
  drift: {
    requirement: 'AUDIT-02',
    inputs: ['schema/information-schema-columns.json', 'schema/drift.json'],
    run(ctx) {
      const columns = readJson('schema/information-schema-columns.json');
      const drift = readJson('schema/drift.json');
      ctx.assert(Array.isArray(columns) && columns.length > 0, 'columns-non-empty', `${columns.length} column rows`);
      ctx.assert(Array.isArray(drift) && drift.length > 0, 'drift-non-empty', `${drift.length} drift rows`);

      const liveTables = new Set(columns.map((c) => c.table_name || c.table));
      const driftTables = new Set(drift.map((d) => d.table || d.table_name));
      const missing = [...liveTables].filter((t) => !driftTables.has(t));
      ctx.assert(missing.length === 0, 'every-live-table-has-a-drift-row', missing.length ? missing.join(', ') : 'all covered');

      const statusColumns = ['exists_in_prod', 'exists_in_migrations', 'typed_correctly'];
      const incomplete = drift.filter((row) => statusColumns.some((k) => row[k] === undefined || row[k] === null));
      ctx.assert(incomplete.length === 0, 'all-three-status-columns-set', incomplete.length ? `${incomplete.length} incomplete rows` : 'all set');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-03 */
  endpoints: {
    requirement: 'AUDIT-03',
    inputs: [ENDPOINTS_FILE, ENDPOINTS_SCHEMA, VERSIONS_FILE],
    run(ctx) {
      const rows = readJson(ENDPOINTS_FILE);
      const schema = readJson(ENDPOINTS_SCHEMA);
      const want = expectedCount(ctx.versions, 'route_ts_count');

      ctx.assert(Array.isArray(rows), 'is-an-array', typeName(rows));
      ctx.assert(rows.length === want, 'row-count-matches-baseline',
        `baseline/versions.txt route_ts_count is ${want}, inventory has ${rows.length}`);

      const errors = schemaErrorsForRows(rows, schema, 'endpoints');
      ctx.assert(errors.length === 0, 'schema-valid', errors.length ? errors.slice(0, 5).join(' | ') : 'all rows valid');

      const dupes = duplicates(rows.map((r) => r.id));
      ctx.assert(dupes.length === 0, 'ids-unique', dupes.length ? dupes.join(', ') : 'all ids distinct');

      const hits = placeholderHits(rows, ENDPOINT_HUMAN_FIELDS, 'endpoints');
      ctx.assert(hits.length === 0, 'no-residual-placeholders',
        hits.length ? `${hits.length} unclassified: ${hits.slice(0, 5).join(', ')}` : 'fully classified');
    },
  },

  /* --------------------- AUDIT-03, weaker pre-classification gate ---------- */
  'endpoints-signals': {
    requirement: 'AUDIT-03 (pre-classification)',
    inputs: [ENDPOINTS_FILE, ENDPOINTS_SCHEMA, VERSIONS_FILE],
    run(ctx) {
      const rows = readJson(ENDPOINTS_FILE);
      const schema = readJson(ENDPOINTS_SCHEMA);
      const want = expectedCount(ctx.versions, 'route_ts_count');

      ctx.assert(rows.length === want, 'row-count-matches-baseline',
        `baseline/versions.txt route_ts_count is ${want}, inventory has ${rows.length}`);

      const errors = schemaErrorsForRows(rows, schema, 'endpoints');
      ctx.assert(errors.length === 0, 'schema-valid', errors.length ? errors.slice(0, 5).join(' | ') : 'all rows valid');

      const without = rows.filter((r) => r.signals === undefined || r.signals === null).map((r) => r.id);
      ctx.assert(without.length === 0, 'signals-present-on-every-row',
        without.length ? without.slice(0, 5).join(', ') : 'every row carries signals');

      ctx.note('placeholders-permitted', 'this gate runs before hand classification; use --check endpoints afterwards');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-04 */
  pages: {
    requirement: 'AUDIT-04',
    inputs: [PAGES_FILE, PAGES_SCHEMA, VERSIONS_FILE, BUILD_ROUTES, ENDPOINTS_FILE, SPECIAL_FILES],
    run(ctx) {
      const rows = readJson(PAGES_FILE);
      const schema = readJson(PAGES_SCHEMA);
      const want = expectedCount(ctx.versions, 'page_tsx_count');

      ctx.assert(rows.length === want, 'row-count-matches-baseline',
        `baseline/versions.txt page_tsx_count is ${want}, inventory has ${rows.length}`);

      const errors = schemaErrorsForRows(rows, schema, 'pages');
      ctx.assert(errors.length === 0, 'schema-valid', errors.length ? errors.slice(0, 5).join(' | ') : 'all rows valid');

      const hits = placeholderHits(rows, PAGE_HUMAN_FIELDS, 'pages');
      ctx.assert(hits.length === 0, 'no-residual-placeholders',
        hits.length ? `${hits.length} unclassified: ${hits.slice(0, 5).join(', ')}` : 'fully classified');

      const known = new Set();
      for (const row of readJson(ENDPOINTS_FILE)) known.add(row.route);
      for (const row of rows) known.add(row.route);
      for (const row of readJson(SPECIAL_FILES)) known.add(row.route);
      const built = parseBuildRoutes(readText(BUILD_ROUTES));
      const orphans = [...built].filter((route) => !known.has(route));
      ctx.assert(orphans.length === 0, 'every-build-route-is-inventoried',
        orphans.length ? `${orphans.length} build routes absent from endpoints, pages and special-files: ${orphans.slice(0, 5).join(', ')}` : `${built.size} build routes all covered`);
    },
  },

  /* ---------------------------------------------------------------- AUDIT-05 */
  rls: {
    requirement: 'AUDIT-05',
    inputs: ['rls/pg_policies.json', 'rls/rls-review.md'],
    run(ctx) {
      const policies = readJson('rls/pg_policies.json');
      ctx.assert(Array.isArray(policies) && policies.length > 0, 'pg-policies-non-empty',
        `${Array.isArray(policies) ? policies.length : 0} policy rows read from the live catalog`);

      const review = readText('rls/rls-review.md');
      const flagClasses = [
        ['rls-disabled-tables', /rls[\s_-]*disabled/i],
        ['rls-enabled-with-no-policy', /no polic|zero polic|without a polic/i],
        ['using-true-policies', /using\s*\(\s*true\s*\)/i],
        ['policies-with-no-to-clause', /no\s+`?to`?\s+clause|missing\s+`?to`?\s+clause/i],
      ];
      for (const [rule, pattern] of flagClasses) {
        ctx.assert(pattern.test(review), `review-addresses-${rule}`, rule);
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-06 */
  heatmap: {
    requirement: 'AUDIT-06',
    inputs: ['rls/rls-heatmap.csv'],
    run(ctx) {
      const { rows } = parseCsv(readText('rls/rls-heatmap.csv'));
      const tables = new Set(rows.map((r) => r.table || r.table_name || r.__cells[0]));
      const want = tables.size * RLS_COMMANDS.length;
      ctx.assert(rows.length === want, 'row-count-equals-tables-times-commands',
        `${tables.size} distinct tables times ${RLS_COMMANDS.length} commands is ${want}, csv has ${rows.length}`);

      const badCells = [];
      rows.forEach((row, index) => {
        for (const [key, value] of Object.entries(row)) {
          if (key === '__cells' || key === 'table' || key === 'table_name' || key === 'command') continue;
          if (value === '') continue;
          if (!RLS_CELL_VALUES.includes(value.toLowerCase())) badCells.push(`row ${index} ${key}=${value}`);
        }
      });
      ctx.assert(badCells.length === 0, 'every-cell-is-allow-deny-or-none',
        badCells.length ? badCells.slice(0, 5).join(', ') : 'all cells in the permitted set');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-07 */
  'service-role': {
    requirement: 'AUDIT-07',
    inputs: ['authz/service-role-register.json', ENDPOINTS_FILE, VERSIONS_FILE],
    run(ctx) {
      const register = readJson('authz/service-role-register.json');
      const endpoints = readJson(ENDPOINTS_FILE);
      const routeCallsites = endpoints.filter((r) => r.signals && r.signals.uses_service_client === true).length;
      const want = routeCallsites + NON_ROUTE_SERVICE_CLIENT_CALLSITES;

      ctx.assert(register.length === want, 'row-count-equals-callsite-count',
        `${routeCallsites} route handlers with signals.uses_service_client true plus ${NON_ROUTE_SERVICE_CLIENT_CALLSITES} non-route callsites is ${want}, register has ${register.length}`);

      // versions.txt is this harness's only count source; a register that agrees
      // with the inventory signal but not with the re-derived file count means a
      // callsite that does not go through the factory is being missed.
      const baseline = expectedCount(ctx.versions, 'service_client_file_count');
      ctx.assert(want === baseline, 'callsite-count-agrees-with-baseline',
        `baseline/versions.txt service_client_file_count is ${baseline}, derived count is ${want}`);

      const incomplete = [];
      register.forEach((row, index) => {
        for (const field of SERVICE_ROLE_JUSTIFICATIONS) {
          if (row[field] === undefined || row[field] === null) incomplete.push(`row ${index} ${field}`);
        }
      });
      ctx.assert(incomplete.length === 0, 'all-four-justifications-answered',
        incomplete.length ? incomplete.slice(0, 5).join(', ') : 'every row answers all four questions');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-08 */
  cache: {
    requirement: 'AUDIT-08',
    inputs: ['cache/cache-matrix.csv', ENDPOINTS_FILE],
    run(ctx) {
      const { rows } = parseCsv(readText('cache/cache-matrix.csv'));
      const endpoints = readJson(ENDPOINTS_FILE);
      const byRoute = new Map(rows.map((r) => [r.route, r]));

      const unprobed = [];
      for (const endpoint of endpoints) {
        if (endpoint.personalized !== true) continue;
        const row = byRoute.get(endpoint.route);
        if (!row || row.verdict === '' || row.verdict.toLowerCase() === NOT_PROBED) unprobed.push(endpoint.route);
      }
      ctx.assert(unprobed.length === 0, 'every-personalized-endpoint-is-probed',
        unprobed.length ? `${unprobed.length} personalized routes with no verdict: ${unprobed.slice(0, 5).join(', ')}` : 'all personalized routes carry a verdict');

      const controls = rows.filter((r) => String(r.positive_control).toLowerCase() === 'true');
      ctx.assert(controls.length > 0, 'positive-control-row-exists',
        'a run where nothing ever cached proves nothing about personalized routes');
      const controlHit = controls.some((r) => String(r.observed_cache_states).toUpperCase().includes('HIT'));
      ctx.assert(controlHit, 'positive-control-recorded-a-hit',
        controlHit ? 'control cached at least once' : 'no control row records a HIT, so the harness is unproven');
    },
  },

  /* ------------------------------------------------------------ AUDIT-09/10 */
  'authz-registers': {
    requirement: 'AUDIT-09, AUDIT-10',
    inputs: ['authz/getsession-register.md', 'authz/fail-open-register.md', ENDPOINTS_FILE],
    run(ctx) {
      const endpoints = readJson(ENDPOINTS_FILE);
      const getSession = readText('authz/getsession-register.md');
      const failOpen = readText('authz/fail-open-register.md');

      const sessionRoutes = endpoints.filter((r) => r.signals && r.signals.calls_get_session === true).map((r) => r.route);
      const missingSession = sessionRoutes.filter((route) => !getSession.includes(route));
      ctx.assert(missingSession.length === 0, 'every-getsession-callsite-is-registered',
        missingSession.length ? missingSession.slice(0, 5).join(', ') : `${sessionRoutes.length} callsites registered`);
      ctx.assert(/gating/i.test(getSession) && /non-gating/i.test(getSession), 'getsession-rows-carry-a-classification',
        'each row must read authorization-gating or non-gating with a reason');

      const envGated = endpoints.filter((r) => r.signals && r.signals.env_gated_auth === true).map((r) => r.route);
      const missingFailOpen = envGated.filter((route) => !failOpen.includes(route));
      ctx.assert(missingFailOpen.length === 0, 'every-env-gated-check-is-registered',
        missingFailOpen.length ? missingFailOpen.slice(0, 5).join(', ') : `${envGated.length} env-gated routes registered`);
      ctx.assert(failOpen.trim().length > 0, 'fail-open-register-non-empty', 'register must list the reachable route for each env-gated check');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-11 */
  cron: {
    requirement: 'AUDIT-11',
    inputs: ['async/cron-webhook-inventory.md'],
    run(ctx) {
      const md = readText('async/cron-webhook-inventory.md');
      const sources = [
        ['pg-cron-jobs', 'pg_cron'],
        ['api-cron-handlers', '/api/cron/'],
        ['vercel-json-crons', 'vercel.json'],
        ['supabase-edge-function', 'edge function'],
        ['apify-instagram-webhook', 'apify'],
        ['supabase-auth-hooks', 'auth hook'],
      ];
      for (const [rule, token] of sources) {
        ctx.assert(md.toLowerCase().includes(token.toLowerCase()), `covers-${rule}`, token);
      }
      const verdicts = (md.toLowerCase().match(/verdict/g) || []).length;
      ctx.assert(verdicts >= sources.length, 'each-source-carries-an-explicit-verdict',
        `${verdicts} verdict markers for ${sources.length} named sources`);
    },
  },

  /* ---------------------------------------------------------------- AUDIT-12 */
  deps: {
    requirement: 'AUDIT-12',
    inputs: ['quality/npm-audit.prod.json', 'quality/dependency-report.md'],
    run(ctx) {
      const audit = readJson('quality/npm-audit.prod.json');
      ctx.assert(audit !== null && typeof audit === 'object', 'npm-audit-parses', 'production-only audit json');

      const report = readText('quality/dependency-report.md');
      const vulns = audit.vulnerabilities || {};
      const serious = Object.entries(vulns)
        .filter(([, v]) => ['high', 'critical'].includes(String(v.severity).toLowerCase()))
        .map(([name]) => name);
      const unjudged = serious.filter((name) => !report.includes(name));
      ctx.assert(unjudged.length === 0, 'every-high-or-critical-has-a-reachability-row',
        unjudged.length ? unjudged.join(', ') : `${serious.length} high or critical advisories judged`);
      ctx.assert(/reachab/i.test(report), 'report-states-reachability', 'a reachability judgment is required, not just a severity');

      const missing = containsAll(report, ['swagger-ui-react', 'redoc']);
      ctx.assert(missing.length === 0, 'swagger-and-redoc-question-answered',
        missing.length ? `no explicit answer for ${missing.join(', ')}` : 'both answered');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-13 */
  baseline: {
    requirement: 'AUDIT-13',
    inputs: ['baseline/jest.txt', 'baseline/tsc.txt', 'baseline/lint.txt', 'baseline/build.txt', VERSIONS_FILE, 'baseline/test-runner-decision.md'],
    run(ctx) {
      for (const rel of ['baseline/jest.txt', 'baseline/tsc.txt', 'baseline/lint.txt', 'baseline/build.txt', VERSIONS_FILE]) {
        ctx.assert(sizeOf(rel) > 0, 'baseline-file-non-empty', rel);
      }
      const jest = readText('baseline/jest.txt');
      ctx.assert(/\d+\s+passed/i.test(jest), 'jest-records-a-pass-count', 'pass count present');
      const skipMatch = jest.match(/(\d+)\s+skipped/i);
      ctx.assert(skipMatch !== null, 'jest-records-a-skip-count', 'skip count present');

      const decision = readText('baseline/test-runner-decision.md');
      const skipped = skipMatch ? Number.parseInt(skipMatch[1], 10) : 0;
      const reasons = (decision.match(/^\s*[-*]\s+/gm) || []).length;
      ctx.assert(skipped === 0 || reasons >= skipped, 'a-reason-exists-per-skipped-suite',
        `${skipped} skipped suites, ${reasons} reason bullets in baseline/test-runner-decision.md`);
      ctx.assert(/jest/i.test(decision) && /vitest/i.test(decision), 'test-runner-decision-cites-the-mock-call-evidence',
        'the jest versus vitest mock-call counts must be recorded');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-14 */
  observability: {
    requirement: 'AUDIT-14',
    inputs: ['quality/error-observability.md'],
    run(ctx) {
      const md = readText('quality/error-observability.md');
      const quantities = [
        'routes_without_try_catch',
        'routes_leaking_internal_error_text',
        'catch_any_count',
        'console_call_count',
        'request_correlation_callsite_count',
      ];
      for (const key of quantities) {
        const value = integerFor(md, key);
        ctx.assert(value !== null, `quantity-${key}-is-an-integer`, value === null ? 'absent or not an integer' : String(value));
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-15 */
  'dead-code': {
    requirement: 'AUDIT-15',
    inputs: ['quality/knip.out.json', 'quality/dead-code.md'],
    run(ctx) {
      const knip = readJson('quality/knip.out.json');
      ctx.assert(knip !== null && typeof knip === 'object', 'knip-output-parses', 'knip json');
      const md = readText('quality/dead-code.md');
      const missing = containsAll(md, ['internal/', 'backend/', 'API_ENDPOINTS']);
      ctx.assert(missing.length === 0, 'explicit-disposition-for-each-named-target',
        missing.length ? `no disposition for ${missing.join(', ')}` : 'all dispositioned');
      ctx.assert(/stale doc|stale-doc|stale documentation/i.test(md), 'stale-docs-list-dispositioned', 'stale docs list');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-16 */
  'bundle-sweep': {
    requirement: 'AUDIT-16',
    inputs: ['security/client-bundle-sweep.md'],
    run(ctx) {
      const md = readText('security/client-bundle-sweep.md');
      ctx.assert(md.includes('ENVSTATE'), 'records-envstate',
        'a sweep run without the real key in the build env is INCONCLUSIVE, not clean');
      const patterns = ['sb_secret_', 'service_role', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_API_KEY', 'ADMIN_EMAILS', 'CRON_SECRET', 'jwt-shape'];
      for (const token of patterns) {
        const value = integerFor(md, token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        ctx.assert(value !== null, `count-recorded-for-${token}`, value === null ? 'no integer count' : String(value));
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-17 */
  'threat-models': {
    requirement: 'AUDIT-17',
    inputs: ['security/threat-model-anonymous.md', 'security/threat-model-tenant.md', 'security/threat-model-escalation.md'],
    run(ctx) {
      const present = fs.readdirSync(A('security')).filter((f) => /^threat-model-.*\.md$/.test(f));
      ctx.assert(present.length === 3, 'exactly-three-threat-models', present.join(', '));
      for (const file of present) {
        const text = readText(path.join('security', file));
        const lines = text.split('\n').length;
        ctx.assert(lines <= MAX_THREAT_MODEL_LINES, 'stays-within-one-page', `${file} is ${lines} lines, cap is ${MAX_THREAT_MODEL_LINES}`);
        const tableRows = (text.match(/^\|.*\|\s*$/gm) || []).length;
        ctx.assert(/stride/i.test(text) && tableRows >= 3, 'stride-table-populated', `${file} has ${tableRows} table lines`);
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-18 */
  storage: {
    requirement: 'AUDIT-18',
    inputs: ['storage/buckets.json', 'storage/storage-review.md'],
    run(ctx) {
      const buckets = readJson('storage/buckets.json');
      ctx.assert(Array.isArray(buckets) && buckets.length > 0, 'buckets-non-empty',
        `${Array.isArray(buckets) ? buckets.length : 0} buckets returned from the live catalog`);
      const review = readText('storage/storage-review.md');
      const names = buckets.map((b) => b.name || b.id).filter(Boolean);
      const topics = [['read-visibility', /public|read visibility|read-visibility/i],
        ['path-prefix-ownership', /path[\s-]*prefix/i],
        ['size-and-mime-limits', /mime|file size|size limit/i]];
      for (const name of names) {
        const start = review.indexOf(name);
        if (start < 0) { ctx.assert(false, `bucket-${name}-reviewed`, 'bucket not mentioned in storage-review.md'); continue; }
        const nextStarts = names.map((n) => review.indexOf(n, start + name.length)).filter((i) => i > start);
        const end = nextStarts.length ? Math.min(...nextStarts) : review.length;
        const block = review.slice(start, end);
        for (const [rule, pattern] of topics) {
          ctx.assert(pattern.test(block), `bucket-${name}-answers-${rule}`, rule);
        }
      }
    },
  },

  /* ---------------------------------------------------------------- AUDIT-19 */
  dates: {
    requirement: 'AUDIT-19',
    inputs: ['schema/events-date-columns.md', 'schema/information-schema-columns.json'],
    run(ctx) {
      const md = readText('schema/events-date-columns.md');
      const missing = containsAll(md, ['start_date', 'end_date', 'event_date', 'event_time']);
      ctx.assert(missing.length === 0, 'both-candidate-column-pairs-named',
        missing.length ? `absent: ${missing.join(', ')}` : 'all four candidate columns named');
      ctx.assert(/authoritative/i.test(md), 'authoritative-columns-declared', 'an explicit verdict is required');
      ctx.assert(md.includes('information-schema-columns.json'), 'cites-the-live-catalog-artifact',
        'the answer comes from information_schema.columns, never from the types file');
    },
  },

  /* ---------------------------------------------------------------- AUDIT-20 */
  findings: {
    requirement: 'AUDIT-20',
    inputs: [FINDINGS_FILE, FINDINGS_SCHEMA, AUDIT_REPORT],
    run(ctx) {
      const rows = readJson(FINDINGS_FILE);
      const schema = readJson(FINDINGS_SCHEMA);
      const report = readText(AUDIT_REPORT);

      const errors = schemaErrorsForRows(rows, schema, 'findings');
      ctx.assert(errors.length === 0, 'schema-valid', errors.length ? errors.slice(0, 5).join(' | ') : 'all findings valid');

      const badIds = rows.map((r) => r.id).filter((id) => !FINDING_ID_PATTERN.test(String(id)));
      ctx.assert(badIds.length === 0, 'ids-match-the-stable-id-pattern', badIds.length ? badIds.join(', ') : 'all ids well formed');
      const dupes = duplicates(rows.map((r) => r.id));
      ctx.assert(dupes.length === 0, 'ids-unique', dupes.length ? dupes.join(', ') : 'all ids distinct');

      const incomplete = [];
      for (const row of rows) {
        for (const field of FINDING_REQUIRED_FIELDS) {
          const value = row[field];
          const empty = value === undefined || value === null || value === ''
            || (Array.isArray(value) && value.length === 0);
          if (empty) incomplete.push(`${row.id}.${field}`);
        }
      }
      ctx.assert(incomplete.length === 0, 'ten-required-fields-present-and-non-empty',
        incomplete.length ? incomplete.slice(0, 5).join(', ') : `${rows.length} findings complete`);

      const noLines = rows
        .filter((r) => ['Critical', 'High'].includes(r.severity))
        .filter((r) => !(Array.isArray(r.affected_paths) && r.affected_paths.some((p) => p && p.lines)))
        .map((r) => r.id);
      ctx.assert(noLines.length === 0, 'critical-and-high-carry-line-numbers',
        noLines.length ? noLines.join(', ') : 'every critical and high is pinned to lines');

      const badEvidence = [];
      for (const row of rows) {
        const value = row.evidence;
        if (typeof value !== 'string' || /\s/.test(value)) { badEvidence.push(`${row.id}: inline literal, not a path`); continue; }
        const target = value.split('#')[0];
        if (!exists(target)) badEvidence.push(`${row.id}: ${target} does not resolve under .planning/audit/`);
      }
      ctx.assert(badEvidence.length === 0, 'evidence-resolves-and-is-never-inline',
        badEvidence.length ? badEvidence.slice(0, 5).join(', ') : 'all evidence paths resolve');

      const now = Date.now();
      const expired = [];
      for (const row of rows) {
        const ra = row.risk_acceptance;
        if (!ra) continue;
        const expiry = Date.parse(ra.expiry);
        const accepted = Date.parse(ra.date);
        if (Number.isFinite(expiry) && Number.isFinite(accepted)) {
          const days = Math.round((expiry - accepted) / MS_PER_DAY);
          if (days > MAX_RISK_ACCEPTANCE_DAYS) expired.push(`${row.id}: expiry is ${days} days out, cap is ${MAX_RISK_ACCEPTANCE_DAYS}`);
        }
        if (Number.isFinite(expiry) && expiry < now && row.status !== 'Open') {
          expired.push(`${row.id}: acceptance expired ${ra.expiry} but status is ${row.status}`);
        }
      }
      ctx.assert(expired.length === 0, 'expired-risk-acceptance-reverts-to-open',
        expired.length ? expired.join(', ') : 'no expired or over-long acceptances');

      const inReport = new Set(report.match(FINDING_ID_SCAN) || []);
      ctx.assert(inReport.size === rows.length, 'report-and-json-agree-on-finding-count',
        `${AUDIT_REPORT} references ${inReport.size} ids, ${FINDINGS_FILE} has ${rows.length}`);
    },
  },

  /* ---------------------------------------------------------------- AUDIT-21 */
  sla: {
    requirement: 'AUDIT-21',
    inputs: ['SEVERITY_SLA.md'],
    run(ctx) {
      const md = readText('SEVERITY_SLA.md');
      for (const level of ['Critical', 'High', 'Medium', 'Low']) {
        const row = md.split('\n').find((line) => new RegExp(`^\\|\\s*${level}\\s*\\|`).test(line));
        ctx.assert(row !== undefined, `severity-${level.toLowerCase()}-has-a-table-row`, level);
        const cells = row ? row.split('|').map((c) => c.trim()).filter((c) => c !== '') : [];
        ctx.assert(cells.length >= 4 && cells[2] !== '', `severity-${level.toLowerCase()}-names-a-deadline`,
          cells.length >= 4 ? cells[2].slice(0, 60) : 'row has too few cells');
      }
      ctx.assert(/risk-accepted/i.test(md), 'exception-register-defined', 'the Risk-accepted status must be defined');
      const missing = containsAll(md, ['owner', 'expiry', 'rationale']);
      ctx.assert(missing.length === 0, 'exception-requires-owner-date-expiry-and-rationale',
        missing.length ? `absent: ${missing.join(', ')}` : 'all four attributes required');
      ctx.assert(md.includes(String(MAX_RISK_ACCEPTANCE_DAYS)), 'expiry-capped-at-ninety-days', `${MAX_RISK_ACCEPTANCE_DAYS} day cap stated`);
      ctx.assert(/reverts?\s+to\s+`?Open/i.test(md), 'expired-acceptance-reverts-to-open', 'enforced by --check findings');
      ctx.assert(/cvss/i.test(md), 'cvss-position-stated', 'severity is exposure-adjusted; CVSS is not assigned to application-logic findings');
      ctx.assert(/exposure-adjusted/i.test(md), 'severity-is-exposure-adjusted', 'each level needs an exposure-adjusted definition');
    },
  },
};

/* -------------------------------------------------------------------- runner -- */

function runCheck(name, versions, quick) {
  const def = CHECKS[name];
  const missing = def.inputs.filter((rel) => !exists(rel));
  if (missing.length > 0) {
    emit(quick ? 'SKIP' : 'FAIL', name, 'inputs-present', `absent: ${missing.join(', ')}`);
    return;
  }
  const ctx = makeCtx(name, versions);
  try {
    def.run(ctx);
  } catch (err) {
    emit('FAIL', name, 'check-threw', scrub(err && err.message ? err.message : String(err)));
  }
}

/* ------------------------------------------------------------------ selftest -- */

const VALID_FIXTURE = {
  id: 'api.example',
  file: 'src/app/api/example/route.ts',
  route: '/api/example',
  methods: ['GET'],
  dynamic_segments: [],
  signals: {
    uses_cookie_client: true, uses_service_client: false, calls_verify_admin: false,
    calls_get_user: true, calls_get_session: false, calls_check_ban: false,
    inline_role_check: false, references_club_members: false, parses_body: false,
    has_zod: false, sets_cache_control: false, cache_control_values: [],
    env_vars_referenced: [], has_try_catch: true, catch_any_count: 0,
    console_count: 0, as_any_count: 0, tables_referenced: ['events'], loc: 20,
  },
  auth_requirement: 'authenticated',
  role_required: null,
  rls_reliance: 'primary',
  service_role_justified: null,
  personalized: true,
  cache_policy_today: 'none',
  cache_policy_target: 'personalized',
  input_validation: 'none',
  test_present: false,
  dead_or_duplicate: false,
  expected_status: {
    anonymous: 401, onboarded_student: 200, mid_onboarding_student: 200,
    club_member: 200, club_owner: 200, multi_club_organizer: 200,
    cross_club_attacker: 200, admin: 200, banned_permanent: 403,
    suspended_active: 403, suspension_expired: 200,
    non_mcgill_signin: 'n/a', machine_no_credential: 401,
  },
  findings: ['F-001'],
};

function selftest() {
  const check = 'selftest';
  const ctx = makeCtx(check, new Map());

  const registered = Object.keys(CHECKS);
  ctx.assert(registered.length === CHECK_NAMES.length, 'registry-size-matches-the-canonical-list',
    `${registered.length} registered, ${CHECK_NAMES.length} expected`);
  const unimplemented = CHECK_NAMES.filter((name) => !CHECKS[name] || typeof CHECKS[name].run !== 'function');
  ctx.assert(unimplemented.length === 0, 'every-registered-name-has-a-function',
    unimplemented.length ? unimplemented.join(', ') : CHECK_NAMES.join(', '));
  const stray = registered.filter((name) => !CHECK_NAMES.includes(name));
  ctx.assert(stray.length === 0, 'no-unlisted-checks', stray.length ? stray.join(', ') : 'registry matches the list exactly');
  const noInputs = registered.filter((name) => !Array.isArray(CHECKS[name].inputs) || CHECKS[name].inputs.length === 0);
  ctx.assert(noInputs.length === 0, 'every-check-declares-its-inputs', noInputs.length ? noInputs.join(', ') : 'all declared');

  for (const rel of [ENDPOINTS_SCHEMA, PAGES_SCHEMA, FINDINGS_SCHEMA]) {
    let ok = false;
    let detail = 'absent';
    if (exists(rel)) {
      try { JSON.parse(readText(rel)); ok = true; detail = 'parses'; }
      catch (err) { detail = scrub(err.message); }
    }
    ctx.assert(ok, 'schema-file-parses', `${rel}: ${detail}`);
  }

  if (exists(ENDPOINTS_SCHEMA)) {
    const schema = JSON.parse(readText(ENDPOINTS_SCHEMA));

    const accepted = checkSchema(VALID_FIXTURE, schema, 'fixture', []);
    ctx.assert(accepted.length === 0, 'checker-accepts-a-valid-fixture',
      accepted.length ? accepted.slice(0, 3).join(' | ') : 'fixture accepted');

    const broken = JSON.parse(JSON.stringify(VALID_FIXTURE));
    broken.auth_requirement = 'definitely-not-a-permitted-value';
    delete broken.expected_status.machine_no_credential;
    delete broken.signals.has_try_catch;
    broken.methods = ['TELEPORT'];
    const rejected = checkSchema(broken, schema, 'fixture', []);
    ctx.assert(rejected.length >= 4, 'checker-rejects-an-invalid-fixture',
      `${rejected.length} errors raised: ${rejected.slice(0, 3).join(' | ')}`);

    const personas = Object.keys(schema.properties.expected_status.properties).length;
    ctx.assert(personas === 13, 'expected-status-covers-every-cert-05-persona', `${personas} personas`);
  }
}

/* ----------------------------------------------------------------------- cli -- */

function usage() {
  console.log('usage: node .planning/audit/tools/validate.mjs [--check <name> | --quick | --selftest | --list]');
  console.log(`checks: ${CHECK_NAMES.join(', ')}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) { usage(); return 0; }

  if (args.includes('--list')) {
    for (const name of CHECK_NAMES) {
      console.log(`${name}\t${CHECKS[name].requirement}\t${CHECKS[name].inputs.join(' ')}`);
    }
    return 0;
  }

  if (args.includes('--selftest')) {
    selftest();
  } else {
    const versions = loadVersions();
    const checkIndex = args.indexOf('--check');
    if (checkIndex !== -1) {
      const name = args[checkIndex + 1];
      if (!name || !CHECKS[name]) {
        console.error(`FAIL cli :: unknown-check :: ${name === undefined ? '(none given)' : name}`);
        usage();
        return 1;
      }
      runCheck(name, versions, false);
    } else {
      const quick = args.includes('--quick');
      for (const name of CHECK_NAMES) runCheck(name, versions, quick);
    }
  }

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  console.log(`--- ${passed} passed, ${failed} failed, ${skipped} skipped`);
  return failed === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`FAIL validator :: terminal-error :: ${scrub(err && err.stack ? err.stack : err)}`);
  process.exit(1);
}
