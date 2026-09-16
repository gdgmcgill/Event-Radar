#!/usr/bin/env node
/**
 * scripts/check-migration-filenames.mjs
 *
 * Turns the Supabase CLI's SILENT migration skip into a non-zero exit.
 *
 * The defect this implements the fix for is F-047. `008b_add_is_admin_to_users.sql`
 * does not match the CLI's `<version>_<name>.sql` pattern — the trailing `b` breaks
 * the match — so the CLI prints
 *
 *   Skipping migration 008b_add_is_admin_to_users.sql... (file name must match
 *   pattern "<timestamp>_name.sql")
 *
 * and CONTINUES WITH EXIT STATUS 0. A skip is worse than a failure because it is
 * silent: the column that file declares is applied in no environment built from the
 * folder, and `009_user_roles.sql` guards its `DROP COLUMN is_admin` behind
 * `DO $$ … IF EXISTS` precisely because of it. This check is F-047's own recommended
 * fix, and it survives the baseline — it is about filenames, not about contents.
 *
 * Zero dependencies by design. Only `node:fs` and `node:path` are imported, nothing
 * from `src/` is imported, and **this file is never added to package.json**. It is
 * invoked by path. The convention is `.planning/audit/tools/validate.mjs:7-11`.
 *
 * TWO DESIGN POINTS, both load-bearing:
 *
 *   1. TOP LEVEL ONLY, never recursive. After plan 03-04 archives the 44 files into
 *      `supabase/migrations/_archive_pre_baseline/`, those names are historical record
 *      that the CLI never reads. A recursive check would fail forever on files that
 *      have correctly stopped being migrations. This check scans exactly what the CLI
 *      scans, which is the only scope at which its answer means anything.
 *
 *   2. AN EMPTY DIRECTORY IS A FAILURE, and is reported distinctly. A check that
 *      passes silently on zero inputs is the same class of defect as the CLI skip it
 *      exists to catch — it reports success for work it did not do.
 *
 * CLI contract:
 *   node scripts/check-migration-filenames.mjs
 *
 * Exit codes: 0 every top-level .sql parses | 1 an unparseable name, an empty
 *             directory, or a missing directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* --------------------------------------------------------------- the rule -- */

const MIGRATIONS_DIR = 'supabase/migrations';

/**
 * Resolved against THIS FILE, not against `process.cwd()` (IN-07).
 *
 * `process.cwd()` made the check cwd-dependent: run from any subdirectory it
 * reported "the directory is missing or unreadable" and exited 1. That fails
 * closed, which is the right direction — but for the wrong reason, and a gate
 * whose red means two different things is a gate nobody reads carefully. Its
 * sibling `scripts/check-elevated-ratchet.mjs` already resolves this way; the
 * two zero-dependency checkers now agree.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The CLI derives the version from the LEADING DIGITS and requires the whole name to
 * match `<version>_<name>.sql`. Anchored at both ends: an unanchored test would accept
 * `008b_…` on the strength of its `008` prefix, which is the exact mistake that lets
 * the silent skip through.
 */
const MIGRATION_FILENAME = /^\d+_.+\.sql$/;

/* ------------------------------------------------------------------- main -- */

function main() {
  const dir = path.resolve(REPO_ROOT, MIGRATIONS_DIR);

  let entries;
  try {
    // withFileTypes so a directory named `something.sql` cannot be counted as a file.
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    console.error(`FAIL: cannot read ${MIGRATIONS_DIR}/ — the directory is missing or unreadable`);
    return 1;
  }

  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  if (sqlFiles.length === 0) {
    console.error(`FAIL: no .sql files at the top level of ${MIGRATIONS_DIR}/`);
    console.error('      An empty migrations directory is reported as a failure, not a pass:');
    console.error('      a check that passes on zero inputs is the silent skip it exists to catch.');
    return 1;
  }

  const unparseable = sqlFiles.filter((name) => !MIGRATION_FILENAME.test(name));

  if (unparseable.length > 0) {
    console.error(
      `FAIL: ${unparseable.length} of ${sqlFiles.length} migration filename(s) do not match ` +
        '<version>_<name>.sql and would be SKIPPED SILENTLY by the Supabase CLI:'
    );
    for (const name of unparseable) console.error(`  ${MIGRATIONS_DIR}/${name}`);
    console.error('');
    console.error('The CLI prints "Skipping migration <name>..." and continues with exit status 0.');
    console.error('Rename the file to <version>_<name>.sql, or move it out of the top level.');
    return 1;
  }

  console.log(`PASS: ${sqlFiles.length} top-level migration filename(s) in ${MIGRATIONS_DIR}/ parse as <version>_<name>.sql`);
  return 0;
}

process.exit(main());
