#!/usr/bin/env node
/** CERT-07: schema-complete client-role coverage and no elevated impersonation.
 * The dedicated matrix certifies RLS. A small explicit list of pre-existing
 * functional suites also tests privileged server capabilities; those assertions
 * do not count toward coverage. New elevated test files require classification.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const dbDir = resolve(root, "supabase/tests/database");
const matrixName = "100-public-table-rls-matrix.test.sql";
const privilegedFunctional = new Set([
  "055-admin-audit-log-insert.test.sql",
  "065-events-moderated-update.test.sql",
  "070-definer-functions.test.sql",
  "075-feedback-write-boundary.test.sql",
  "080-interaction-popularity-write-boundary.test.sql",
  "090-client-destructive-grants.test.sql",
  "095-atomic-moderation-workflows.test.sql",
  "110-m1-account-affiliation.test.sql",
  "120-discovery-functional.test.sql",
]);
const failures = [];
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const elevated = /\bSET\s+(?:LOCAL\s+)?ROLE\s+["']?service_role\b|set_config\s*\(\s*'role'\s*,\s*'service_role'|createServiceClient|getElevatedClient|SUPABASE_SERVICE_ROLE_KEY/i;
for (const file of readdirSync(dbDir).filter((name) => name.endsWith(".sql"))) {
  const sql = withoutComments(readFileSync(resolve(dbDir, file), "utf8"));
  if (elevated.test(sql) && !privilegedFunctional.has(file)) {
    failures.push(`${file}: elevated role/client cannot impersonate an RLS caller`);
  }
}

const types = readFileSync(resolve(root, "src/lib/supabase/types.ts"), "utf8");
const tableBlock = types.split("    Tables: {")[1]?.split("    Views:")[0] ?? "";
const tables = [...tableBlock.matchAll(/^      (\w+): \{/gm)].map((match) => match[1]);
if (!tables.length) failures.push("Cannot inventory public tables from generated schema types");
const matrix = readFileSync(resolve(dbDir, matrixName), "utf8");
if (/\bSECURITY\s+DEFINER\b/i.test(withoutComments(matrix))) failures.push("RLS matrix cannot define privileged query helpers");
const region = matrix.split("-- CERT-07 assertion region start")[1]?.split("-- CERT-07 assertion region end")[0];
if (!region) failures.push("RLS matrix must delimit its client-role assertion region");
const assertions = withoutComments(region ?? "");
if (elevated.test(assertions) || /\bSECURITY\s+DEFINER\b|\blives_ok\s*\(|act_as_owner\s*\(|\bRESET\s+ROLE\b|\bSET\s+(?:LOCAL\s+)?ROLE\s+(?!anon\b|authenticated\b)/i.test(assertions)) {
  failures.push("RLS matrix must use real anon/authenticated roles and affected-row assertions");
}
if (!/SET LOCAL ROLE anon\s*;/i.test(assertions) || !/SET LOCAL ROLE authenticated\s*;/i.test(assertions) || !/request\.jwt\.claim\.sub/.test(assertions)) {
  failures.push("RLS matrix is missing explicit database role and JWT impersonation");
}
const covered = new Map();
const reads = /SELECT is\(\(SELECT count\(\*\)::integer FROM public\.(\w+) WHERE [^\n]+\),(\d+),'(\w+) (anon|subject|outsider|admin) read (allow|deny)'\);/g;
for (const match of assertions.matchAll(reads)) {
  const [, table, count, label, role, outcome] = match;
  if (table !== label || (Number(count) > 0) !== (outcome === "allow")) {
    failures.push(`${table}: assertion label disagrees with executable count`);
  }
  const entry = covered.get(table) ?? { roles: new Set(), allow: false, deny: false };
  if (entry.roles.has(role)) failures.push(`${table}: duplicate ${role} read case`);
  entry.roles.add(role);
  entry.allow ||= Number(count) > 0;
  entry.deny ||= Number(count) === 0;
  covered.set(table, entry);
}
// Revoked SELECT is stronger than a zero-row RLS result. Recognize only a
// literal SELECT on the named table with PostgreSQL's insufficient_privilege
// code, so a comment or assertion on another object cannot satisfy coverage.
const deniedReads = /SELECT throws_ok\('SELECT \* FROM public\.(\w+)','42501',NULL,'(\w+) (anon|subject|outsider|admin) read deny'\);/g;
for (const [, table, label, role] of assertions.matchAll(deniedReads)) {
  if (table !== label) failures.push(`${table}: privilege-denial label disagrees with queried table`);
  const entry = covered.get(table) ?? { roles: new Set(), allow: false, deny: false };
  if (entry.roles.has(role)) failures.push(`${table}: duplicate ${role} read case`);
  entry.roles.add(role);
  entry.deny = true;
  covered.set(table, entry);
}
for (const [table, entry] of covered) {
  // Public reads deliberately permit every role. Their denial must be an
  // executable write check on that same table, never a descriptive comment.
  entry.deny ||= assertions.split("\n").some((line) =>
    line.includes(`public.${table} `) && line.includes(`'${table} `) &&
    (/SELECT throws_ok\(/.test(line) && line.includes("'42501'") ||
      /RETURNING 1\) SELECT is\(\(SELECT count\(\*\)::integer FROM changed\),0,/.test(line)) &&
    line.includes("write deny'")
  );
}
for (const table of tables) {
  const entry = covered.get(table);
  if (!entry || entry.roles.size !== 4 || !entry.allow || !entry.deny) {
    failures.push(`${table}: needs anon/subject/outsider/admin reads plus executable allow and deny`);
  }
}
for (const table of covered.keys()) if (!tables.includes(table)) failures.push(`${table}: stale coverage for a table absent from generated schema`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`RLS coverage: ${tables.length} public tables, ${tables.length * 4} client-role read cases, executable allow/deny for every table; elevated functional controls excluded.`);
}
