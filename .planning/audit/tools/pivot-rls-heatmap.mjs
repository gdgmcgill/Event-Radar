/**
 * AUDIT-06 — pivot the live row-level-security capture into the table x command x role
 * coverage grid that Stage 4's pgTAP matrix transcribes directly.
 *
 * Usage: node .planning/audit/tools/pivot-rls-heatmap.mjs [--json]
 *
 * Reads   .planning/audit/rls/pg_policies.json    101 live policies (AUDIT-05, plan 01-09 task 1)
 *         .planning/audit/rls/rls-enabled.json     38 relations with relrowsecurity + policy counts
 * Writes  .planning/audit/rls/rls-heatmap.csv      the grid: one row per table x command
 *         .planning/audit/rls/rls-heatmap-notes.csv the traceability sidecar (see § Sidecar below)
 *
 * ---------------------------------------------------------------------------------------------
 * Provenance
 *
 * Both inputs derive from the SELECT-only production capture envelopes committed under
 * .planning/audit/raw/prod/, which store the executed SQL in their `query` field. Plan 01-09
 * specified that capture running through the read-only transport built in plan 01-06,
 * .planning/audit/tools/sql-readonly.mjs; in the event, production was read once through the
 * Supabase MCP server (Management API) as role `postgres` and committed as those envelopes
 * (see 01-06-SUMMARY.md for the transport deviation). Either way the rule is the same and it is
 * the rule this grid depends on for meaning: the capture is SELECT-only, and the RLS-bypassing
 * service-role client is never the transport — it is the credential under audit, and it enforces
 * nothing, so a policy set read through it would not be the policy set that applies to it.
 *
 * This script opens no socket, reads no environment variable, and imports nothing outside
 * node: built-ins. In particular it does NOT import the app-layer CSV export helper under
 * src/lib/ (01-PATTERNS.md § No Analog Found names the file) — that is application code, and a
 * tool under .planning/ must not depend on the tree it audits: importing it would make the audit
 * harness fail whenever the audited code fails, and would put a .planning/ tool in the module
 * graph that AUDIT-15's dead-code analysis walks. The CSV quoting helper below is reimplemented
 * inline for exactly that reason; it is four lines.
 *
 * ---------------------------------------------------------------------------------------------
 * Cell semantics — the whole value of the grid is this distinction
 *
 *   allow  row security is enabled and at least one PERMISSIVE policy grants this role this
 *          command on this table.
 *   deny   row security is enabled and no policy grants it. Access is refused.
 *   none   row security is DISABLED on the table, so no policy applies at all and access is
 *          ungoverned — bounded only by the table grant. A table in this state is rendered
 *          `none` across its entire row.
 *
 * `deny` and `none` look alike in a grid and mean opposite things. `deny` is a closed door;
 * `none` is no door. Production currently has zero `none` cells, because relrowsecurity is true
 * on all 38 relations — the value exists so that the day it stops being true, the grid says so
 * rather than silently reading as a wall of `allow`.
 *
 * Three caveats a reader must carry, all of them consequences of this being a STATIC pivot over
 * the catalog rather than an executed probe:
 *
 *   1. `allow` means "a policy of this command names this role". It does NOT mean the policy's
 *      predicate returns rows. `USING (auth.uid() = user_id)` is `allow` for anon here, because
 *      the policy names the catch-all `public` role — but at run time auth.uid() is NULL for anon
 *      and no row comes back. Read `allow` as "a policy is consulted", not "access succeeds".
 *      rls-review.md § 4a is where that distinction is worked through per policy.
 *   2. `service_role` carries BYPASSRLS. Its column is computed by the same mechanical rule as
 *      every other, so a `deny` in that column is a statement about policies, not about access:
 *      service_role reaches every row of every table regardless of what this grid says. The 25
 *      registered bypassing callsites are in authz/service-role-register.json.
 *   3. `public` is not a role a caller can authenticate as; it is the pseudo-role every role
 *      inherits. Its column is the floor — whatever `public` is allowed, everyone is allowed.
 *      A policy written with no TO clause is stored as roles={public} and lands in that column.
 *
 * ---------------------------------------------------------------------------------------------
 * Sidecar
 *
 * The plan asks for a policy-count column and a notes column carrying the policy names behind
 * each allow, so a reader can trace a cell back to the raw capture. Those two columns cannot live
 * in rls-heatmap.csv: tools/validate.mjs --check heatmap asserts that EVERY non-empty cell outside
 * the `table` / `table_name` / `command` columns is one of allow|deny|none, so a policy count or a
 * policy-name list in a trailing column fails the check the same plan requires to pass. Putting
 * them in a sibling file keeps the grid machine-checkable and the traceability intact. The sidecar
 * is emitted by this same script from the same inputs, one row per grid row, same order.
 *
 * ---------------------------------------------------------------------------------------------
 * Determinism: the output is a pure function of the two inputs. No timestamp, no environment, no
 * directory listing, no Set/Map iteration that is not explicitly sorted. Running this twice
 * produces byte-identical files; that is asserted by the plan and is worth preserving, because a
 * diff on this CSV is how a policy change becomes visible in review.
 */

import fs from 'node:fs';
import path from 'node:path';

const RLS_DIR = path.join('.planning', 'audit', 'rls');
const POLICIES_IN = path.join(RLS_DIR, 'pg_policies.json');
const ENABLED_IN = path.join(RLS_DIR, 'rls-enabled.json');
const GRID_OUT = path.join(RLS_DIR, 'rls-heatmap.csv');
const NOTES_OUT = path.join(RLS_DIR, 'rls-heatmap-notes.csv');

/** The four data-manipulation commands. `ALL` is expanded across all four, never emitted. */
const COMMANDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

/**
 * Role columns: the union of every role named in the capture (public, authenticated,
 * service_role) plus the anonymous and signed-in roles, which are always present even when no
 * policy names them — their absence from the policy set is precisely the interesting case.
 * Sorted, so the header is stable regardless of capture order.
 */
const ALWAYS_PRESENT_ROLES = ['anon', 'authenticated'];

const CELL_ALLOW = 'allow';
const CELL_DENY = 'deny';
const CELL_NONE = 'none';

/* ------------------------------------------------------------------ precondition guard -- */

for (const input of [POLICIES_IN, ENABLED_IN]) {
  if (!fs.existsSync(input)) {
    console.error(`Missing ${input} — run this from the repository root, after plan 01-09 task 1.`);
    process.exit(1);
  }
}

/* --------------------------------------------------------------------------- helpers -- */

/**
 * Minimal RFC-4180 quoting. Inline by design — see the provenance note above on why the
 * app-layer CSV helper is not imported.
 */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvRow = (cells) => cells.map(csvCell).join(',');

/**
 * A policy applies to a concrete role when its role list names that role, or when it names the
 * catch-all `public` pseudo-role, which every role inherits.
 */
const policyNamesRole = (policy, role) =>
  policy.roles.includes('public') || policy.roles.includes(role);

/** A policy covers a command when it targets it directly or is a cmd=ALL policy. */
const policyCoversCommand = (policy, command) => policy.cmd === command || policy.cmd === 'ALL';

/* ------------------------------------------------------------------------------ main -- */

function main() {
  const policies = JSON.parse(fs.readFileSync(POLICIES_IN, 'utf8'));
  const relations = JSON.parse(fs.readFileSync(ENABLED_IN, 'utf8'));

  // Index policies by the same schema-qualified key rls-enabled.json uses, so the two files
  // cannot silently disagree about what a table is called.
  const byRelation = new Map();
  for (const policy of policies) {
    const key = `${policy.schemaname}.${policy.tablename}`;
    if (!byRelation.has(key)) byRelation.set(key, []);
    byRelation.get(key).push(policy);
  }

  // Role columns: union of what the capture names, plus anon and authenticated, sorted.
  const roleSet = new Set(ALWAYS_PRESENT_ROLES);
  for (const policy of policies) for (const role of policy.roles) roleSet.add(role);
  const roles = [...roleSet].sort();

  const gridLines = [csvRow(['table', 'command', ...roles])];
  const noteLines = [
    csvRow(['table', 'command', 'rls_enabled', 'policy_count', 'allowing_policies']),
  ];

  const tally = { [CELL_ALLOW]: 0, [CELL_DENY]: 0, [CELL_NONE]: 0 };

  const ordered = [...relations].sort((a, b) => (a.key || '').localeCompare(b.key || ''));

  for (const relation of ordered) {
    const key = relation.key || `${relation.schema}.${relation.table}`;
    const relationPolicies = (byRelation.get(key) || [])
      .slice()
      .sort((a, b) => a.cmd.localeCompare(b.cmd) || a.policyname.localeCompare(b.policyname));

    for (const command of COMMANDS) {
      // A RESTRICTIVE policy subtracts rather than grants, so it can never produce an `allow`.
      // The capture reports all 101 as PERMISSIVE; the filter is kept so a future restrictive
      // policy does not get silently counted as a grant.
      const covering = relationPolicies.filter(
        (p) => policyCoversCommand(p, command) && p.permissive === 'PERMISSIVE'
      );

      const cells = [];
      const allowing = new Map(); // policy name -> roles it allows, for the sidecar

      for (const role of roles) {
        if (relation.rls_enabled === false) {
          cells.push(CELL_NONE);
          continue;
        }
        const granting = covering.filter((p) => policyNamesRole(p, role));
        if (granting.length === 0) {
          cells.push(CELL_DENY);
          continue;
        }
        cells.push(CELL_ALLOW);
        for (const p of granting) {
          if (!allowing.has(p.policyname)) allowing.set(p.policyname, []);
          allowing.get(p.policyname).push(role);
        }
      }

      for (const cell of cells) tally[cell] += 1;
      gridLines.push(csvRow([key, command, ...cells]));

      const trace = [...allowing.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, grantedTo]) => `${name} [${grantedTo.join(' ')}]`)
        .join('; ');
      noteLines.push(
        csvRow([key, command, String(relation.rls_enabled), String(covering.length), trace])
      );
    }
  }

  fs.writeFileSync(GRID_OUT, `${gridLines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(NOTES_OUT, `${noteLines.join('\n')}\n`, 'utf8');

  const dataRows = gridLines.length - 1;
  const expected = ordered.length * COMMANDS.length;
  const summary = {
    relations: ordered.length,
    commands: COMMANDS.length,
    role_columns: roles,
    data_rows: dataRows,
    expected_rows: expected,
    cells: tally,
    grid: GRID_OUT,
    notes: NOTES_OUT,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`${GRID_OUT}  ${dataRows} rows (${ordered.length} relations x ${COMMANDS.length} commands)`);
    console.log(`${NOTES_OUT}  ${noteLines.length - 1} rows`);
    console.log(`role columns: ${roles.join(', ')}`);
    console.log(`cells: allow=${tally.allow} deny=${tally.deny} none=${tally.none}`);
  }

  // The plan's invariant. A disagreement here means the pivot dropped a relation, not that the
  // database is unusual — fail loudly rather than write a short grid that still parses.
  if (dataRows !== expected) {
    console.error(`Row count ${dataRows} does not equal ${ordered.length} relations x ${COMMANDS.length} commands.`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`pivot-rls-heatmap failed: ${error && error.message ? error.message : error}`);
  process.exit(1);
}
