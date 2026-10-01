/** CERT-07 guard mutations: coverage cannot be certified by elevated callers,
 * missing tables/personas, labels alone, or completion-only write checks. */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const script = resolve("scripts/check-rls-coverage.mjs");
const matrix = readFileSync(resolve("supabase/tests/database/100-public-table-rls-matrix.test.sql"), "utf8");
const types = readFileSync(resolve("src/lib/supabase/types.ts"), "utf8");
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "m0-rls-guard-"));
  mkdirSync(join(dir, "src/lib/supabase"), { recursive: true });
  mkdirSync(join(dir, "supabase/tests/database"), { recursive: true });
  writeFileSync(join(dir, "src/lib/supabase/types.ts"), types);
  writeFileSync(join(dir, "supabase/tests/database/100-public-table-rls-matrix.test.sql"), matrix);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
function mutate(change: (source: string) => string) {
  writeFileSync(join(dir, "supabase/tests/database/100-public-table-rls-matrix.test.sql"), change(matrix));
}
function fails(fragment: string) {
  const result = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(fragment);
}
it("accepts complete real client-role coverage", () => {
  expect(execFileSync(process.execPath, [script, dir], { encoding: "utf8" })).toContain("41 public tables");
});
it("rejects elevated impersonation in the matrix", () => {
  mutate(source => source.replace("SET LOCAL ROLE authenticated;", "SET LOCAL ROLE service_role;"));
  fails("elevated role/client cannot impersonate an RLS caller");
});
it("rejects a new generated table without its policy matrix", () => {
  writeFileSync(join(dir, "src/lib/supabase/types.ts"), types.replace("    Tables: {", "    Tables: {\n      untested_table: {\n      }"));
  fails("untested_table: needs");
});
it("rejects missing outsider coverage", () => {
  mutate(source => source.split("\n").filter(line => !line.includes("'users outsider read deny'")).join("\n"));
  fails("users: needs");
});
it("rejects public-read tables without an executable denial", () => {
  mutate(source => source.split("\n").filter(line => !line.includes("'club_followers anon write deny'") && !line.includes("'club_followers subject write deny'")).join("\n"));
  fails("club_followers: needs");
});
it("rejects completion-only assertions even alongside passing counts", () => {
  mutate(source => source.replace("-- CERT-07 assertion region end", "SELECT lives_ok('SELECT 1');\n-- CERT-07 assertion region end"));
  fails("affected-row assertions");
});
it("rejects elevated clients in a newly added SQL policy test", () => {
  writeFileSync(join(dir, "supabase/tests/database/110-new-policy.test.sql"), "SET LOCAL ROLE service_role;");
  fails("110-new-policy.test.sql: elevated");
});
it("rejects coverage labels that name a different queried table", () => {
  mutate(source => source.replace("'users outsider read deny'", "'clubs outsider read deny'"));
  fails("users: assertion label disagrees");
});

it("rejects privileged query helpers even in the fixture prelude", () => {
  mutate(source => source.replace("BEGIN;", "BEGIN;\nCREATE FUNCTION tests.bypass() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1';"));
  fails("cannot define privileged query helpers");
});
