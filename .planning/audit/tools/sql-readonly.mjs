#!/usr/bin/env node
/**
 * .planning/audit/tools/sql-readonly.mjs
 *
 * Phase 1 PRIMARY read-only SQL transport — Supabase Management API.
 *
 * Why this transport and not a database client built from the project's own
 * factories: the RLS-bypassing service-role credential is the thing this phase is
 * auditing. It enforces nothing — a transport built on it is read-only only by the
 * author's good intentions, and there is no generic SQL RPC to call through it
 * anyway (adding one would be a schema change, which this phase forbids). The
 * Management API's query endpoint takes a `read_only` flag that is enforced
 * SERVER-SIDE, which makes a write impossible rather than merely discouraged.
 *
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 *   body: { query, parameters?, read_only: true }
 *   auth: Bearer <personal access token with database_read scope>
 *
 * Zero dependencies: global fetch, node:fs, node:path only. Nothing from src/ is
 * imported and this file is never added to package.json — installing anything into
 * the repository would fail the phase's own read-only exit criterion.
 *
 * Credentials come from the environment and NOWHERE else. Nothing here ever prints,
 * echoes, logs or writes a credential value: the env guard names the missing
 * variable NAMES only, and the terminal error handler prints an HTTP status plus a
 * scrubbed body, never a caught error object (a caught error can carry a token or a
 * connection string inside it, and `.planning/` is committed to git permanently).
 * No wrapper around this script may ever enable shell command tracing (`set -x`) —
 * tracing would echo whatever is in the environment.
 *
 * Environment (NAMES only — see .planning/audit/BLOCKING-INPUTS.md):
 *   SUPABASE_ACCESS_TOKEN                     personal access token, database_read scope
 *   SUPABASE_PROJECT_REF | PROD_PROJECT_REF   the project reference to query
 *
 * CLI:
 *   node .planning/audit/tools/sql-readonly.mjs --list
 *   node .planning/audit/tools/sql-readonly.mjs --query columns-census \
 *        --out .planning/audit/schema/information-schema-columns.json
 *   node .planning/audit/tools/sql-readonly.mjs --query events-columns --out -
 *
 * Exit codes: 0 ok | 1 request failed | 2 credentials absent | 3 bad usage.
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------- module tunables -- */

const API_ROOT = 'https://api.supabase.com';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

/* ----------------------------------------------------------- credentials -- */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || process.env.PROD_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

/**
 * Names only. A message that interpolated a value would be the leak this whole
 * phase exists to prevent. Lazy rather than top-level so the query catalog below
 * can be imported by the fallback transport without tripping the guard.
 */
export function requireCredentials() {
  const missing = [];
  if (!PROJECT_REF) missing.push('SUPABASE_PROJECT_REF (or PROD_PROJECT_REF)');
  if (!ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  if (missing.length > 0) {
    console.error(`missing environment variable(s): ${missing.join(', ')}`);
    console.error('see .planning/audit/BLOCKING-INPUTS.md § 1 — export them, never write them to a file');
    process.exit(2);
  }
}

/* -------------------------------------------------------------- scrubbing -- */

const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '<REDACTED-JWT>'],
  [/sbp_[A-Za-z0-9]+/g, '<REDACTED-TOKEN>'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '<REDACTED-SECRET-KEY>'],
  [/postgres(ql)?:\/\/[^\s]*:[^@\s]*@/gi, 'postgres://<REDACTED>@'],
  [/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1<REDACTED-TOKEN>'],
];

export function scrub(input) {
  let text = typeof input === 'string' ? input : String(input);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

/* --------------------------------------------------------- query catalog -- */

/**
 * Named, reviewable, SELECT-only statements. Transcribed from
 * 01-RESEARCH.md § Code Examples 5. Named rather than free-form so the artifact a
 * command produced is reproducible from the command alone, and so the FALLBACK
 * transport (sql-readonly-pg.mjs) emits a byte-comparable artifact.
 */
export const QUERIES = {
  'columns-census': {
    requirement: 'AUDIT-19 evidence, AUDIT-02 drift input',
    sql: `SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position`,
  },
  'events-columns': {
    requirement: 'AUDIT-19',
    sql: `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'events'
          ORDER BY ordinal_position`,
  },
};

/* ------------------------------------------------------------- transport -- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run one read-only statement. `read_only: true` is enforced by the API, not here.
 * Returns parsed rows.
 */
export async function query(sql, parameters = []) {
  requireCredentials();
  const url = `${API_ROOT}/v1/projects/${PROJECT_REF}/database/query`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql, parameters, read_only: true }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // Status + scrubbed body. NEVER the request, which carries the bearer token.
        const body = scrub(await res.text()).slice(0, 500);
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        err.body = body;
        // 4xx other than 429 will not become a 2xx on retry.
        if (res.status !== 429 && res.status < 500) throw err;
        if (attempt === MAX_RETRIES) throw err;
      } else {
        return await res.json();
      }
    } catch (caught) {
      clearTimeout(timer);
      if (attempt === MAX_RETRIES) throw caught;
    }
    await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  throw new Error('unreachable');
}

/* ------------------------------------------------------------------- CLI -- */

function usage() {
  console.error('usage: node sql-readonly.mjs --query <name> [--out <path|->]');
  console.error(`       known queries: ${Object.keys(QUERIES).join(', ')}`);
  process.exit(3);
}

export function writeRows(rows, outPath) {
  const json = `${JSON.stringify(rows, null, 2)}\n`;
  if (!outPath || outPath === '-') {
    process.stdout.write(json);
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.error(`wrote ${Array.isArray(rows) ? rows.length : 0} rows to ${outPath}`);
}

async function main(argv) {
  if (argv.includes('--list')) {
    for (const [name, def] of Object.entries(QUERIES)) console.log(`${name}\t${def.requirement}`);
    return;
  }
  const queryName = argv[argv.indexOf('--query') + 1];
  if (!argv.includes('--query') || !queryName || !QUERIES[queryName]) usage();
  const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '-';

  const rows = await query(QUERIES[queryName].sql);
  writeRows(rows, outPath);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  main(process.argv.slice(2)).catch((caught) => {
    // Status and scrubbed body only — never the error object, never the request.
    const status = caught && caught.status ? caught.status : 'none';
    const body = caught && caught.body ? caught.body : scrub(caught && caught.message ? caught.message : 'request failed');
    console.error(`request failed — http status: ${status}`);
    console.error(`scrubbed body: ${body}`);
    process.exit(1);
  });
}
