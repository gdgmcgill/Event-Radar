#!/usr/bin/env node
/**
 * .planning/audit/tools/sql-readonly-pg.mjs
 *
 * Phase 1 FALLBACK read-only SQL transport — direct Postgres connection.
 *
 * Use this ONLY when no Supabase personal access token can be issued, so the
 * Management API transport (`sql-readonly.mjs`, the primary) is unavailable. The
 * primary is preferred because its `read_only` flag is enforced server-side. Here
 * the equivalent guarantee is obtained one step lower down: every statement runs
 * inside `BEGIN TRANSACTION READ ONLY`, opened BEFORE any other statement, so the
 * server rejects any write for the lifetime of the connection. The session is also
 * pinned with `default_transaction_read_only = on` as a second, independent belt.
 *
 * ---------------------------------------------------------------------------
 * INSTALL — the `pg` client MUST be installed OUTSIDE this repository
 * ---------------------------------------------------------------------------
 * `npm install pg` inside the repo would rewrite package.json and
 * package-lock.json, which is a change outside `.planning/` and fails this phase's
 * exit criterion outright. Install into a scratch prefix and reach it with
 * NODE_PATH, which `createRequire` honours (a bare ESM `import` does not):
 *
 *   export AUDIT_TMP="$(mktemp -d)"                 # outside the repository
 *   npm install --prefix "$AUDIT_TMP/deps" --no-audit --no-fund pg@8
 *   NODE_PATH="$AUDIT_TMP/deps/node_modules" \
 *     node --env-file=.env .planning/audit/tools/sql-readonly-pg.mjs \
 *       --query columns-census --out .planning/audit/schema/information-schema-columns.json
 *   bash .planning/audit/tools/readonly-guard.sh   # proves the lockfile is untouched
 *
 * ---------------------------------------------------------------------------
 * CREDENTIALS — environment variable only, never a CLI argument
 * ---------------------------------------------------------------------------
 * The connection string carries the database password. Passed as a command-line
 * argument it lands in shell history, in `ps` output, and in any captured log —
 * all three of which outlive the task. It is read from the environment and nowhere
 * else, it is never printed, and no wrapper around this script may enable shell
 * command tracing (`set -x`), which would echo it.
 *
 * Connection string is read, in order, from:
 *   PROD_DB_URL | SUPABASE_CONNECTION_STRING          (default target: prod)
 *   STAGING_DB_URL | STAGING_CONNECTION_STRING        (--target staging)
 * `node --env-file=<file>` may be used to load it from a gitignored env file
 * without exporting it into the shell.
 *
 * Supabase note: a `db.<ref>.supabase.co` DIRECT connection is IPv6-only unless the
 * IPv4 add-on is enabled. ENETUNREACH / EHOSTUNREACH / an AAAA-only DNS result means
 * the machine has no IPv6 route — supply the Session-pooler string instead
 * (port 5432, host `aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`).
 * Do not guess an alternative host.
 *
 * CLI:
 *   NODE_PATH=<scratch>/node_modules node .planning/audit/tools/sql-readonly-pg.mjs \
 *     --query <name> [--target prod|staging] [--out <path|->]
 *
 * Exit codes: 0 ok | 1 query/connection failed | 2 credentials or `pg` absent | 3 bad usage.
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { QUERIES, scrub, writeRows } from './sql-readonly.mjs';

const STATEMENT_TIMEOUT = '30s';

/* ------------------------------------------------------- the `pg` client -- */

function loadPg() {
  const require = createRequire(import.meta.url);
  try {
    return require('pg');
  } catch {
    console.error('cannot resolve `pg`. Install it OUTSIDE this repository and point NODE_PATH at it:');
    console.error('  export AUDIT_TMP="$(mktemp -d)"');
    console.error('  npm install --prefix "$AUDIT_TMP/deps" --no-audit --no-fund pg@8');
    console.error('  NODE_PATH="$AUDIT_TMP/deps/node_modules" node .planning/audit/tools/sql-readonly-pg.mjs ...');
    console.error('never `npm install pg` inside this repository — it rewrites package.json and package-lock.json');
    process.exit(2);
  }
}

/* ----------------------------------------------------------- credentials -- */

function connectionStringFor(target) {
  const value = target === 'staging'
    ? (process.env.STAGING_DB_URL || process.env.STAGING_CONNECTION_STRING)
    : (process.env.PROD_DB_URL || process.env.SUPABASE_CONNECTION_STRING);
  if (!value) {
    const names = target === 'staging'
      ? 'STAGING_DB_URL (or STAGING_CONNECTION_STRING)'
      : 'PROD_DB_URL (or SUPABASE_CONNECTION_STRING)';
    console.error(`missing environment variable: ${names}`);
    console.error('see .planning/audit/BLOCKING-INPUTS.md § 1 — export it, never write it to a file');
    process.exit(2);
  }
  return value;
}

/* ------------------------------------------------------------- transport -- */

/**
 * Open a connection, make it read-only BEFORE issuing anything else, run the
 * statements, close. The read-only transaction is the whole point of this file:
 * with it, a write is rejected by the server; without it, "read-only" would be an
 * assertion about the author's intent rather than a property of the connection.
 */
export async function runReadOnly(statements, target = 'prod') {
  // Credentials first: an absent connection string is the likelier and more
  // actionable failure, and naming it beats reporting a missing package.
  const connectionString = connectionStringFor(target);
  const { Client } = loadPg();
  const client = new Client({ connectionString });
  const results = [];
  await client.connect();
  try {
    // Belt: pins the SESSION read-only, so even a statement issued outside the
    // transaction below cannot write.
    await client.query('SET default_transaction_read_only = on');
    // Braces: the transaction itself. Opened before any data statement.
    await client.query('BEGIN TRANSACTION READ ONLY');
    // A stuck catalog query must not hang the plan.
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`);
    for (const sql of statements) {
      const res = await client.query(sql);
      results.push(res.rows);
    }
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
  return results;
}

/* ------------------------------------------------------------------- CLI -- */

function usage() {
  console.error('usage: NODE_PATH=<scratch>/node_modules node sql-readonly-pg.mjs --query <name> [--target prod|staging] [--out <path|->]');
  console.error(`       known queries: ${Object.keys(QUERIES).join(', ')}`);
  process.exit(3);
}

async function main(argv) {
  if (argv.includes('--list')) {
    for (const [name, def] of Object.entries(QUERIES)) console.log(`${name}\t${def.requirement}`);
    return;
  }
  const queryName = argv[argv.indexOf('--query') + 1];
  if (!argv.includes('--query') || !queryName || !QUERIES[queryName]) usage();
  const target = argv.includes('--target') ? argv[argv.indexOf('--target') + 1] : 'prod';
  if (target !== 'prod' && target !== 'staging') usage();
  const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '-';

  const [rows] = await runReadOnly([QUERIES[queryName].sql], target);
  writeRows(rows, outPath);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  main(process.argv.slice(2)).catch((caught) => {
    // A pg error object can carry the connection string on `.client` / `.message`.
    // Print a scrubbed message and the driver's error CODE only — never the object.
    const code = caught && caught.code ? caught.code : 'none';
    console.error(`query failed — error code: ${code}`);
    console.error(`scrubbed message: ${scrub(caught && caught.message ? caught.message : 'connection failed')}`);
    if (['ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code)) {
      console.error('this is the IPv6-only direct-connection failure class — supply the Session-pooler connection string instead');
    }
    process.exit(1);
  });
}

