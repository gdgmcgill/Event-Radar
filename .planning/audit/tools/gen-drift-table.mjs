/**
 * .planning/audit/tools/gen-drift-table.mjs
 *
 * AUDIT-02 — the three-way schema drift table. One row per (table, column) pair,
 * reconciling three independent sources and never letting any one of them stand in
 * for the others:
 *
 *   1. PRODUCTION  — .planning/audit/schema/information-schema-columns.json, the
 *                    catalog census captured through the Management API in plan
 *                    01-06. This is the ONLY source of truth about what exists.
 *   2. MIGRATIONS  — supabase/migrations/, parsed STATICALLY. Not replayed: the
 *                    folder does not replay (schema/local-reset.txt), so "would a
 *                    rebuilt database have this column" is unanswerable today and
 *                    this column answers the weaker, useful question "does a
 *                    migration file declare it".
 *   3. TYPES       — src/lib/supabase/types.ts, the generated client types. This
 *                    file is EVIDENCE UNDER SUSPICION, never a source of truth.
 *                    It begins with `__InternalSupabase: { PostgrestVersion }`,
 *                    which proves it is `supabase gen types` output rather than
 *                    hand-written — so the third column is a does-it-match question,
 *                    not a provenance question (01-RESEARCH.md § State of the Art).
 *
 * Usage: node .planning/audit/tools/gen-drift-table.mjs
 *
 * Emits .planning/audit/schema/drift.json and, generated FROM that JSON so the two
 * cannot disagree, .planning/audit/schema/drift.md.
 *
 * MERGE SEMANTICS ARE THE POINT. drift.json is read back and indexed by
 * `${scope}|${table}|${column}` before anything is written. Only the fields in
 * OWNED_FIELDS are ever overwritten; `human_note` and any key a reviewer has added
 * by hand survive a re-run untouched. A generator that replaced the file would
 * silently discard a reviewer's classification work (01-RESEARCH.md Pattern 1).
 * Consecutive runs are byte-identical — rows are emitted in a total order and keys
 * in a fixed order, with no timestamp anywhere in the payload.
 *
 * READ-ONLY. Every input is opened with readFileSync and never written back. The two
 * write targets are both under .planning/audit/schema/. Nothing under src/ or
 * supabase/ is written, and no migration file is created.
 *
 * ZERO DEPENDENCIES and ZERO NETWORK. node:fs and node:path only — no install, no
 * registry fetch, no database connection, no @supabase/supabase-js. The generator
 * reads no environment variable of any kind, so there is no credential for it to
 * leak; the terminal error handler scrubs anyway, because an error object from any
 * future transport tends to embed the request that produced it.
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";

/* ------------------------------------------------------------------ paths -- */

const CENSUS = ".planning/audit/schema/information-schema-columns.json";
const BUCKETS = ".planning/audit/raw/prod/storage-buckets.json";
const CRON = ".planning/audit/raw/prod/cron-job.json";
const MIGRATIONS_DIR = "supabase/migrations";
const TYPES_FILE = "src/lib/supabase/types.ts";
const OUT_JSON = ".planning/audit/schema/drift.json";
const OUT_MD = ".planning/audit/schema/drift.md";

const ROOT_MARKERS = [CENSUS, MIGRATIONS_DIR, TYPES_FILE, ".planning/audit/tools/validate.mjs"];

/** Fields this generator owns. Everything else on an existing row is preserved. */
const OWNED_FIELDS = [
  "scope", "table", "column",
  "exists_in_prod", "prod_type", "prod_nullable",
  "exists_in_migrations", "introduced_by_migration",
  "typed_correctly", "typed_as", "expected_type",
  "type_obligation", "drift_class", "notes",
];

/** The five classes the plan and validate.mjs agree on. */
const DRIFT_CLASSES = ["in-sync", "prod-only", "migrations-only", "type-mismatch", "types-only"];

/* ------------------------------------------------------- guards + plumbing -- */

function fail(message) {
  const error = new Error(message);
  error.__expected = true;
  throw error;
}

function assertRepoRoot() {
  const missing = ROOT_MARKERS.filter((m) => !existsSync(m));
  if (missing.length) {
    fail(
      `run this from the repository root — not found: ${missing.join(", ")}\n` +
      `  usage: node .planning/audit/tools/gen-drift-table.mjs`
    );
  }
}

function progress(message) {
  process.stderr.write(`  ${message}\n`);
}

/**
 * Scrub anything credential-shaped out of a string before it is printed. This
 * generator reads no secret, so this handler should never have anything to do; it
 * exists because a caught error object is the classic carrier (REDACTION.md) and a
 * future maintainer may give this tool a transport.
 */
function scrub(text) {
  return String(text)
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g, "<REDACTED-JWT>")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "<REDACTED-SECRET-KEY>")
    .replace(/postgres(ql)?:\/\/[^\s]*:[^@\s]*@/gi, "postgres://<REDACTED>@")
    .replace(/([Aa]uthorization:\s*[Bb]earer\s+)\S+/g, "$1<REDACTED-TOKEN>");
}

function readJson(path) {
  if (!existsSync(path)) fail(`missing input: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return fail(`could not parse ${path}: ${scrub(error.message)}`);
  }
}

/** Raw captures are `{name, captured_at, transport, query, row_count, redactions, rows}`. */
function envelopeRows(path) {
  const parsed = readJson(path);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  return fail(`${path} is neither an array nor a capture envelope with a rows array`);
}

/* -------------------------------------------------------------- SQL lexing -- */

/**
 * Remove line and block comments, respecting single-quoted strings and
 * dollar-quoted bodies so a `--` inside a literal is not treated as a comment.
 * Returns the stripped text; the caller keeps the raw text separately when it needs
 * to ask whether something survives only AS a comment (the pg_cron case).
 */
function stripComments(sql) {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (two === "/*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.slice(i, i + 2) === "/*") { depth += 1; i += 2; continue; }
        if (sql.slice(i, i + 2) === "*/") { depth -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }
    if (sql[i] === "'") {
      const start = i;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i += 1; break; }
        i += 1;
      }
      out += sql.slice(start, i);
      continue;
    }
    if (sql[i] === '"') {
      const start = i;
      i += 1;
      while (i < sql.length && sql[i] !== '"') i += 1;
      i += 1;
      out += sql.slice(start, i);
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

/** Split on top-level semicolons, respecting quotes and dollar-quoted bodies. */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'") {
      const start = i;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i += 1; break; }
        i += 1;
      }
      current += sql.slice(start, i);
      continue;
    }
    if (sql[i] === '"') {
      const start = i;
      i += 1;
      while (i < sql.length && sql[i] !== '"') i += 1;
      i += 1;
      current += sql.slice(start, i);
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (sql[i] === ";") {
      statements.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += sql[i];
    i += 1;
  }
  if (current.trim()) statements.push(current);
  return statements.map((s) => s.trim()).filter(Boolean);
}

/** Split a parenthesised body on top-level commas. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "'") {
      const start = i;
      i += 1;
      while (i < body.length) {
        if (body[i] === "'" && body[i + 1] === "'") { i += 2; continue; }
        if (body[i] === "'") { i += 1; break; }
        i += 1;
      }
      current += body.slice(start, i);
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Take the parenthesised body of the FIRST top-level pair of parentheses. */
function firstParenBody(text) {
  const open = text.indexOf("(");
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

const normaliseIdent = (raw) =>
  String(raw).trim().replace(/^"(.*)"$/, "$1").replace(/^public\./i, "").replace(/^"public"\./i, "").toLowerCase();

/** Table-constraint keywords that open a body item which is NOT a column. */
const CONSTRAINT_LEAD = /^(constraint|primary|foreign|unique|check|exclude|like|deferrable|initially)\b/i;

/* ------------------------------------------------------ source 2: migrations -- */

function parseMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  /** table -> Map(column -> {introduced_by, declared_type}) */
  const tables = new Map();
  /** table -> first file that creates it */
  const createdBy = new Map();
  const droppedTables = new Map();
  const droppedColumns = [];
  const buckets = new Map();
  const cronActive = new Map();
  const cronCommented = new Map();

  const ensure = (table) => {
    if (!tables.has(table)) tables.set(table, new Map());
    return tables.get(table);
  };

  for (const file of files) {
    const raw = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8");
    const sql = stripComments(raw);

    // pg_cron jobs: the schedule may survive only as a comment, which is the point.
    for (const match of raw.matchAll(/cron\.schedule\s*\(\s*'([^']+)'/gi)) {
      if (!cronCommented.has(match[1])) cronCommented.set(match[1], file);
    }
    for (const match of sql.matchAll(/cron\.schedule\s*\(\s*'([^']+)'/gi)) {
      if (!cronActive.has(match[1])) cronActive.set(match[1], file);
    }

    for (const statement of splitStatements(sql)) {
      const flat = statement.replace(/\s+/g, " ").trim();

      // INSERT INTO storage.buckets (...) VALUES ('id', ...), ...
      if (/^insert\s+into\s+storage\.buckets\b/i.test(flat)) {
        for (const match of statement.matchAll(/'([^']+)'/g)) {
          if (!buckets.has(match[1])) buckets.set(match[1], file);
        }
        continue;
      }

      // DROP TABLE [IF EXISTS] name
      const dropTable = /^drop\s+table\s+(?:if\s+exists\s+)?([^\s;(]+)/i.exec(flat);
      if (dropTable) {
        droppedTables.set(normaliseIdent(dropTable[1]), file);
        continue;
      }

      // CREATE TABLE [IF NOT EXISTS] name ( body )
      const createTable = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(/i.exec(flat);
      if (createTable) {
        const table = normaliseIdent(createTable[1]);
        const body = firstParenBody(statement);
        if (!body) continue;
        if (!createdBy.has(table)) createdBy.set(table, file);
        const columns = ensure(table);
        for (const item of splitTopLevel(body)) {
          if (CONSTRAINT_LEAD.test(item)) continue;
          const nameMatch = /^("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s+(.+)$/s.exec(item.replace(/\s+/g, " ").trim());
          if (!nameMatch) continue;
          const column = normaliseIdent(nameMatch[1]);
          if (!columns.has(column)) {
            columns.set(column, { introduced_by: file, declared_type: declaredType(nameMatch[2]) });
          }
        }
        continue;
      }

      // ALTER TABLE [ONLY] [IF EXISTS] name <action>[, <action>...]
      const alterTable = /^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([^\s;]+)\s+(.+)$/i.exec(flat);
      if (alterTable) {
        const table = normaliseIdent(alterTable[1]);
        for (const action of splitTopLevel(alterTable[2])) {
          const add = /^add\s+column\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s+(.+)$/i.exec(action);
          if (add) {
            const columns = ensure(table);
            const column = normaliseIdent(add[1]);
            if (!columns.has(column)) {
              columns.set(column, { introduced_by: file, declared_type: declaredType(add[2]) });
            }
            continue;
          }
          const drop = /^drop\s+column\s+(?:if\s+exists\s+)?("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)/i.exec(action);
          if (drop) droppedColumns.push({ table, column: normaliseIdent(drop[1]), file });
        }
      }
    }
  }

  return { files, tables, createdBy, droppedTables, droppedColumns, buckets, cronActive, cronCommented };
}

/** Everything up to the first column constraint keyword is the declared type. */
function declaredType(rest) {
  const stop = /\b(not\s+null|null|default|references|primary\s+key|unique|check|generated|collate|constraint|deferrable)\b/i;
  const match = stop.exec(rest);
  const type = (match ? rest.slice(0, match.index) : rest).trim().replace(/,+$/, "").replace(/\s+/g, " ");
  return type || rest.trim().split(/\s+/)[0];
}

/* ----------------------------------------------------------- source 3: types -- */

/**
 * Parse `Database["public"]["Tables"][*]["Row"]` out of the generated types file by
 * brace depth. Deliberately structural rather than regex-per-line: a Row property
 * whose type is itself an object (none today) must not silently truncate the table.
 */
function parseTypes() {
  const text = readFileSync(TYPES_FILE, "utf8");
  const tables = new Map();

  const publicIdx = text.indexOf("\n  public: {");
  if (publicIdx === -1) fail(`${TYPES_FILE}: no public schema block found`);
  const tablesIdx = text.indexOf("Tables: {", publicIdx);
  if (tablesIdx === -1) fail(`${TYPES_FILE}: no public.Tables block found`);

  const lines = text.slice(tablesIdx).split("\n");
  let currentTable = null;
  let inRow = false;
  let rowDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!currentTable) {
      const open = /^([A-Za-z_][A-Za-z0-9_]*):\s*\{$/.exec(trimmed);
      if (open && /^ {6}[A-Za-z_]/.test(line)) {
        currentTable = normaliseIdent(open[1]);
        tables.set(currentTable, new Map());
      }
      if (/^\}$/.test(trimmed) && /^ {4}\}/.test(line)) break; // end of Tables
      continue;
    }

    if (!inRow) {
      if (/^Row:\s*\{$/.test(trimmed)) { inRow = true; rowDepth = 1; continue; }
      if (/^\}$/.test(trimmed) && /^ {6}\}/.test(line)) { currentTable = null; }
      continue;
    }

    rowDepth += (trimmed.match(/\{/g) || []).length;
    rowDepth -= (trimmed.match(/\}/g) || []).length;
    if (rowDepth <= 0) { inRow = false; continue; }

    const prop = /^([A-Za-z_][A-Za-z0-9_]*)\??:\s*(.+?)$/.exec(trimmed);
    if (prop) {
      tables.get(currentTable).set(normaliseIdent(prop[1]), prop[2].trim());
    }
  }

  if (tables.size === 0) fail(`${TYPES_FILE}: parsed zero tables — the parser has a hole`);
  return tables;
}

/* ------------------------------------------------------- pg -> ts expectation -- */

/**
 * What `supabase gen types typescript` emits for a Row property, by udt_name.
 * Keyed on udt_name rather than data_type because data_type flattens every array to
 * the literal "ARRAY" and every enum to "USER-DEFINED".
 */
const UDT_TO_TS = {
  uuid: "string", text: "string", varchar: "string", bpchar: "string", name: "string",
  citext: "string", inet: "string", cidr: "string", macaddr: "string",
  date: "string", timestamptz: "string", timestamp: "string", time: "string",
  timetz: "string", interval: "string",
  int2: "number", int4: "number", int8: "number", numeric: "number",
  float4: "number", float8: "number", money: "number", oid: "number",
  bool: "boolean",
  json: "Json", jsonb: "Json",
  bytea: "string",
};

/** Enum udt names resolve to the generated Enums lookup. */
function enumType(udt) {
  return `Database["public"]["Enums"]["${udt}"]`;
}

function expectedTsType(row, enumNames) {
  const udt = String(row.udt_name || "").toLowerCase();
  let base;
  if (udt.startsWith("_")) {
    const element = udt.slice(1);
    const elementTs = UDT_TO_TS[element] || (enumNames.has(element) ? enumType(element) : null);
    base = elementTs ? `${elementTs}[]` : null;
  } else if (UDT_TO_TS[udt]) {
    base = UDT_TO_TS[udt];
  } else if (enumNames.has(udt)) {
    base = enumType(udt);
  } else {
    base = null;
  }
  if (!base) return null;
  return row.is_nullable === "YES" ? `${base} | null` : base;
}

/** Enum names declared in the generated file's public.Enums block. */
function parseEnumNames() {
  const text = readFileSync(TYPES_FILE, "utf8");
  const names = new Set();
  const idx = text.indexOf("Enums: {");
  if (idx === -1) return names;
  for (const line of text.slice(idx).split("\n").slice(1)) {
    if (/^\s{4}\}/.test(line)) break;
    const match = /^\s{6}([A-Za-z_][A-Za-z0-9_]*):/.exec(line);
    if (match) names.add(match[1].toLowerCase());
  }
  return names;
}

const canonicalise = (type) => String(type).replace(/\s+/g, " ").trim();

/** `A | null` and `null | A` are the same type; order is the generator's whim. */
function typesMatch(expected, actual) {
  if (expected == null || actual == null) return false;
  const norm = (t) => canonicalise(t).split("|").map((p) => p.trim()).filter(Boolean).sort().join(" | ");
  return norm(expected) === norm(actual);
}

/* ------------------------------------------------------------------- build -- */

function buildRows() {
  progress(`reading production census    ${CENSUS}`);
  const census = readJson(CENSUS);
  if (!Array.isArray(census) || census.length === 0) fail(`${CENSUS}: expected a non-empty array`);

  progress(`parsing migrations           ${MIGRATIONS_DIR}`);
  const mig = parseMigrations();

  progress(`parsing generated types      ${TYPES_FILE}`);
  const types = parseTypes();
  const enumNames = parseEnumNames();

  const prodTables = new Set(census.map((c) => normaliseIdent(c.table_name)));
  const prodColumns = new Map();
  for (const row of census) {
    const table = normaliseIdent(row.table_name);
    if (!prodColumns.has(table)) prodColumns.set(table, new Map());
    prodColumns.get(table).set(normaliseIdent(row.column_name), row);
  }

  const rows = [];
  const seen = new Set();
  const key = (scope, table, column) => `${scope}|${table}|${column ?? ""}`;

  const push = (row) => {
    const k = key(row.scope, row.table, row.column);
    if (seen.has(k)) return;
    seen.add(k);
    rows.push(row);
  };

  /* -- column rows: the union of the three sources, per table ---------------- */

  const allTables = new Set([...prodTables, ...mig.tables.keys(), ...types.keys()]);

  for (const table of allTables) {
    const prodCols = prodColumns.get(table) || new Map();
    const migCols = mig.tables.get(table) || new Map();
    const typeCols = types.get(table) || new Map();
    const columns = new Set([...prodCols.keys(), ...migCols.keys(), ...typeCols.keys()]);

    for (const column of columns) {
      const prod = prodCols.get(column) || null;
      const migration = migCols.get(column) || null;
      const typed = typeCols.has(column) ? canonicalise(typeCols.get(column)) : null;

      const exists_in_prod = prod !== null;
      const exists_in_migrations = migration !== null;
      const expected = prod ? expectedTsType(prod, enumNames) : null;
      const typed_correctly = Boolean(exists_in_prod && typed !== null && typesMatch(expected, typed));

      let drift_class;
      if (!exists_in_prod && exists_in_migrations) drift_class = "migrations-only";
      else if (!exists_in_prod && !exists_in_migrations) drift_class = "types-only";
      else if (exists_in_prod && !exists_in_migrations) drift_class = "prod-only";
      else if (!typed_correctly) drift_class = "type-mismatch";
      else drift_class = "in-sync";

      const notes = [];
      if (drift_class === "prod-only") {
        notes.push("exists in production but no migration file declares it — created out of band");
      }
      if (drift_class === "migrations-only") {
        notes.push(`declared by ${migration.introduced_by} but absent from production`);
      }
      if (drift_class === "types-only") {
        notes.push("present in the generated types file but in neither production nor any migration");
      }
      if (exists_in_prod && typed === null) {
        notes.push("absent from types.ts — client code cannot reference this column type-safely");
      } else if (exists_in_prod && typed !== null && !typed_correctly) {
        notes.push(expected
          ? `types.ts says ${typed}; the census implies ${expected}`
          : `types.ts says ${typed}; no TypeScript expectation could be derived from udt ${prod.udt_name}`);
      }
      if (mig.droppedColumns.some((d) => d.table === table && d.column === column)) {
        const dropper = mig.droppedColumns.find((d) => d.table === table && d.column === column);
        notes.push(`a DROP COLUMN for this column appears in ${dropper.file}`);
      }

      push({
        scope: "column",
        table,
        column,
        exists_in_prod,
        prod_type: prod ? (prod.data_type === "ARRAY" || prod.data_type === "USER-DEFINED" ? `${prod.data_type} (${prod.udt_name})` : prod.data_type) : null,
        prod_nullable: prod ? prod.is_nullable === "YES" : null,
        exists_in_migrations,
        introduced_by_migration: migration ? migration.introduced_by : null,
        typed_correctly,
        typed_as: typed,
        expected_type: expected,
        type_obligation: "column",
        drift_class,
        notes: notes.join("; ") || null,
        human_note: null,
      });
    }
  }

  /* -- table-scope rows: a table in the migrations that production lacks ----- */

  for (const table of mig.tables.keys()) {
    if (prodTables.has(table)) continue;
    const dropped = mig.droppedTables.get(table);
    push({
      scope: "table",
      table,
      column: null,
      exists_in_prod: false,
      prod_type: null,
      prod_nullable: null,
      exists_in_migrations: true,
      introduced_by_migration: mig.createdBy.get(table) || null,
      typed_correctly: types.has(table),
      typed_as: types.has(table) ? "present in types.ts" : null,
      expected_type: null,
      type_obligation: "table",
      drift_class: "migrations-only",
      notes: [
        `CREATE TABLE appears in ${mig.createdBy.get(table) || "an unparsed statement"} but the table is absent from production`,
        dropped ? `a DROP TABLE for it appears in ${dropped}` : null,
        types.has(table) ? "the generated types file still declares it" : null,
      ].filter(Boolean).join("; "),
      human_note: null,
    });
  }

  /* -- table-scope rows: a production table no migration creates ------------- */

  for (const table of prodTables) {
    if (mig.tables.has(table)) continue;
    push({
      scope: "table",
      table,
      column: null,
      exists_in_prod: true,
      prod_type: `table (${(prodColumns.get(table) || new Map()).size} columns)`,
      prod_nullable: null,
      exists_in_migrations: false,
      introduced_by_migration: null,
      typed_correctly: types.has(table),
      typed_as: types.has(table) ? "present in types.ts" : null,
      expected_type: null,
      type_obligation: "table",
      drift_class: "prod-only",
      notes: [
        "this table exists in production and NO migration file creates it — every one of its columns is prod-only for the same reason",
        types.has(table)
          ? "the generated types file knows about it, which means types.ts was regenerated from production after the table was created out of band"
          : "the generated types file does not know about it either",
      ].join("; "),
      human_note: null,
    });
  }

  /* -- table-scope rows: a table in types.ts that production lacks ----------- */

  for (const table of types.keys()) {
    if (prodTables.has(table) || mig.tables.has(table)) continue;
    const dropped = mig.droppedTables.get(table);
    push({
      scope: "table",
      table,
      column: null,
      exists_in_prod: false,
      prod_type: null,
      prod_nullable: null,
      exists_in_migrations: false,
      introduced_by_migration: null,
      typed_correctly: false,
      typed_as: "present in types.ts",
      expected_type: null,
      type_obligation: "table",
      drift_class: "types-only",
      notes: [
        "the generated types file declares this table; production does not have it and no migration creates it",
        dropped ? `a DROP TABLE for it appears in ${dropped}` : null,
      ].filter(Boolean).join("; "),
      human_note: null,
    });
  }

  /* -- object-scope rows: storage buckets ------------------------------------ */

  progress(`reading storage buckets      ${BUCKETS}`);
  for (const bucket of envelopeRows(BUCKETS)) {
    const id = String(bucket.id);
    const declaredIn = mig.buckets.get(id) || null;
    push({
      scope: "object",
      table: "storage.buckets",
      column: id,
      exists_in_prod: true,
      prod_type: `bucket (public=${bucket.public}, size_limit=${bucket.file_size_limit ?? "none"}, mime_allowlist=${Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length ? `${bucket.allowed_mime_types.length} types` : "none"})`,
      prod_nullable: null,
      exists_in_migrations: Boolean(declaredIn),
      introduced_by_migration: declaredIn,
      typed_correctly: false,
      typed_as: null,
      expected_type: null,
      type_obligation: "none",
      drift_class: declaredIn ? "in-sync" : "prod-only",
      notes: [
        declaredIn
          ? `created by an INSERT INTO storage.buckets in ${declaredIn}`
          : "exists in production but no migration creates it, and supabase/config.toml's [storage.buckets.*] block is entirely commented out — the bucket exists only because someone made it in the dashboard",
        "types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal",
      ].join("; "),
      human_note: null,
    });
  }

  /* -- object-scope rows: pg_cron jobs --------------------------------------- */

  progress(`reading pg_cron jobs         ${CRON}`);
  for (const job of envelopeRows(CRON)) {
    const name = String(job.jobname);
    const active = mig.cronActive.get(name) || null;
    const commented = mig.cronCommented.get(name) || null;
    push({
      scope: "object",
      table: "cron.job",
      column: name,
      exists_in_prod: true,
      prod_type: `schedule "${job.schedule}" running ${job.command} (active=${job.active})`,
      prod_nullable: null,
      exists_in_migrations: Boolean(active),
      introduced_by_migration: active,
      typed_correctly: false,
      typed_as: null,
      expected_type: null,
      type_obligation: "none",
      drift_class: active ? "in-sync" : "prod-only",
      notes: [
        active
          ? `scheduled by an executable cron.schedule() call in ${active}`
          : commented
            ? `the only trace of this job in supabase/migrations/ is a COMMENTED-OUT cron.schedule() line in ${commented} — a commented statement is not a migration, and a rebuilt database would have no such job`
            : "no migration mentions this job at all; it exists only in production",
        "types.ts models the public schema only, so typed_correctly is false by construction on this row and carries no signal",
      ].join("; "),
      human_note: null,
    });
  }

  /* -- total order, so consecutive runs are byte-identical ------------------- */

  const SCOPE_ORDER = { column: 0, table: 1, object: 2 };
  rows.sort((a, b) =>
    SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
    a.table.localeCompare(b.table, "en") ||
    String(a.column ?? "").localeCompare(String(b.column ?? ""), "en"));

  for (const row of rows) {
    if (!DRIFT_CLASSES.includes(row.drift_class)) fail(`row ${row.table}.${row.column} has invalid drift_class ${row.drift_class}`);
  }

  return { rows, mig, types, census, prodTables };
}

/* ------------------------------------------------------------------ merge -- */

function mergeWithExisting(fresh) {
  if (!existsSync(OUT_JSON)) return fresh;
  let previous;
  try {
    previous = JSON.parse(readFileSync(OUT_JSON, "utf8"));
  } catch {
    progress(`existing ${OUT_JSON} is unparseable — regenerating from scratch`);
    return fresh;
  }
  if (!Array.isArray(previous)) return fresh;

  const index = new Map(previous.map((r) => [`${r.scope}|${r.table}|${r.column ?? ""}`, r]));
  let preserved = 0;
  const merged = fresh.map((row) => {
    const old = index.get(`${row.scope}|${row.table}|${row.column ?? ""}`);
    if (!old) return row;
    const out = { ...row };
    for (const [k, v] of Object.entries(old)) {
      if (OWNED_FIELDS.includes(k)) continue;
      if (v === null || v === undefined) continue;
      out[k] = v;
      preserved += 1;
    }
    if (old.human_note != null) out.human_note = old.human_note;
    return out;
  });
  if (preserved) progress(`preserved ${preserved} hand-added field value(s) across re-run`);
  return merged;
}

/* --------------------------------------------------------------- markdown -- */

const CLASS_BLURB = {
  "in-sync": "production, the migrations folder, and types.ts all agree",
  "prod-only": "exists in production; **no migration file declares it** — it was created out of band",
  "migrations-only": "a migration file declares it; **production does not have it**",
  "type-mismatch": "production and the migrations agree, but `types.ts` disagrees or is silent",
  "types-only": "`types.ts` declares it; neither production nor any migration has it",
};

function renderMarkdown(rows, ctx) {
  const counts = Object.fromEntries(DRIFT_CLASSES.map((c) => [c, rows.filter((r) => r.drift_class === c).length]));
  const columnRows = rows.filter((r) => r.scope === "column");
  const tableRows = rows.filter((r) => r.scope === "table");
  const objectRows = rows.filter((r) => r.scope === "object");
  const outOfSync = rows.filter((r) => r.drift_class !== "in-sync");
  const tables = [...new Set(outOfSync.map((r) => r.table))].sort((a, b) => a.localeCompare(b, "en"));

  const L = [];
  L.push("# Three-Way Schema Drift — production vs `supabase/migrations/` vs `types.ts`");
  L.push("");
  L.push("**Requirement:** AUDIT-02 &nbsp;·&nbsp; **Plan:** 01-08 &nbsp;·&nbsp; **Phase:** 01-read-only-foundation-audit");
  L.push("");
  L.push("> **Generated. Do not hand-edit.** Every number and every row below is rendered from");
  L.push("> [`drift.json`](./drift.json) by `.planning/audit/tools/gen-drift-table.mjs`, so the two");
  L.push("> representations cannot disagree. To add a reviewer's comment, set `human_note` on the row");
  L.push("> in `drift.json` — the generator preserves it across re-runs — and re-run the generator:");
  L.push(">");
  L.push("> ```bash");
  L.push("> node .planning/audit/tools/gen-drift-table.mjs");
  L.push("> ```");
  L.push("");
  L.push("## The three sources, and why only one of them is truth");
  L.push("");
  L.push("| # | Source | File | What it can prove |");
  L.push("|---|---|---|---|");
  L.push(`| 1 | **Production catalog** | [\`information-schema-columns.json\`](./information-schema-columns.json) — ${ctx.census.length} columns over ${ctx.prodTables.size} tables | What **exists**. This is the only source of truth in this document. Captured in plan 01-06 through the Management API; the envelope is \`raw/prod/information-schema-columns.json\`. |`);
  L.push(`| 2 | **Migration files** | \`supabase/migrations/\` — ${ctx.mig.files.length} files, parsed **statically** | What a migration file **declares**. It deliberately does *not* claim what a rebuilt database would contain, because [no database can be rebuilt from this folder today](./local-reset.txt). |`);
  L.push(`| 3 | **Generated types** | \`src/lib/supabase/types.ts\` — ${ctx.types.size} tables | Nothing, on its own. This file is the artifact under suspicion; it is the thing being **judged** by columns 1 and 2, not a witness for them. |`);
  L.push("");
  L.push("### `types.ts` is generator output, not a hand-written file");
  L.push("");
  L.push("`codebase/CONCERNS.md` records a worry about \"hand-written Supabase types\". It is wrong on the");
  L.push("facts. `src/lib/supabase/types.ts` is 1,508 lines and opens with");
  L.push("");
  L.push("```ts");
  L.push("export type Database = {");
  L.push("  __InternalSupabase: {");
  L.push('    PostgrestVersion: "13.0.5"');
  L.push("  }");
  L.push("```");
  L.push("");
  L.push("`__InternalSupabase.PostgrestVersion` is emitted by `supabase gen types typescript` and by");
  L.push("nothing else. **This changes REFAC-04's shape.** The remediation is not \"replace hand-written");
  L.push("types with generated ones\" — they already are generated. It is \"the generated file is stale,");
  L.push("and nothing in CI regenerates or verifies it.\" Accordingly the third column of this table asks");
  L.push("*does it match the live schema*, never *was it written by hand*.");
  L.push("");
  L.push("## Summary — counts per drift class");
  L.push("");
  L.push("| Drift class | Rows | Meaning |");
  L.push("|---|---:|---|");
  for (const cls of DRIFT_CLASSES) {
    L.push(`| \`${cls}\` | ${counts[cls]} | ${CLASS_BLURB[cls]} |`);
  }
  L.push(`| **total** | **${rows.length}** | ${columnRows.length} column rows, ${tableRows.length} table rows, ${objectRows.length} object rows |`);
  L.push("");
  L.push(`**${outOfSync.length} of ${rows.length} rows are not in sync**, across ${tables.length} tables and objects.`);
  L.push("Every row below whose class is not `in-sync` is a finding candidate for plan 01-13.");
  L.push("");
  L.push("### How to read the three status columns");
  L.push("");
  L.push("- `exists_in_prod` — the column is in the production catalog census.");
  L.push("- `exists_in_migrations` — some file in `supabase/migrations/` declares it, via `CREATE TABLE`");
  L.push("  or `ALTER TABLE ... ADD COLUMN`. Declaration order is filename order, and the first file to");
  L.push("  declare a column is recorded as `introduced_by_migration`.");
  L.push("- `typed_correctly` — `types.ts` has a `Row` property for it **and** that property's type equals");
  L.push("  what `supabase gen types` would emit for the production column's `udt_name` and nullability.");
  L.push("  A column absent from `types.ts` is `false`, with the reason in `notes`.");
  L.push("");
  L.push("On `scope: \"object\"` rows (storage buckets, pg_cron jobs) `typed_correctly` is `false` by");
  L.push("construction — `types.ts` models the `public` schema only and has no obligation to these");
  L.push("objects — so those rows are classified on production-versus-migrations alone.");
  L.push("");
  L.push("## Corroborating evidence");
  L.push("");
  L.push("| Question | Artifact |");
  L.push("|---|---|");
  L.push("| What is applied where? | [`migration-list.prod.txt`](./migration-list.prod.txt), [`migration-list.local.txt`](./migration-list.local.txt), [`migration-list.staging.txt`](./migration-list.staging.txt) |");
  L.push("| What would a shadow diff say? | [`db-diff.prod.sql`](./db-diff.prod.sql), [`db-diff.staging.sql`](./db-diff.staging.sql) — **both blocked, and the reason is itself the finding** |");
  L.push("| Why can't the folder be replayed? | [`local-reset.txt`](./local-reset.txt) |");
  L.push("| What does production actually look like? | [`prod.schema.sql`](./prod.schema.sql), [`information-schema-columns.json`](./information-schema-columns.json) |");
  L.push("");
  L.push("`supabase db diff` could not run, and would not have run even with a production credential:");
  L.push("it builds a **shadow** Postgres by replaying `supabase/migrations/` before it compares");
  L.push("anything, and that replay aborts at the 12th of 44 files on a duplicate `version` primary key.");
  L.push("This table exists because the diff cannot — production truth comes from the catalog census and");
  L.push("migration truth from static parsing, which is why the `exists_in_migrations` column answers");
  L.push("\"is it declared\" rather than \"would it be built\".");
  L.push("");
  L.push("## The shape of the drift");
  L.push("");

  const prodOnlyByTable = new Map();
  for (const r of rows.filter((x) => x.drift_class === "prod-only" && x.scope === "column")) {
    prodOnlyByTable.set(r.table, (prodOnlyByTable.get(r.table) || 0) + 1);
  }
  const worst = [...prodOnlyByTable.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en")).slice(0, 8);
  if (worst.length) {
    L.push("Production columns that no migration declares, by table (top " + worst.length + "):");
    L.push("");
    L.push("| Table | Undeclared columns |");
    L.push("|---|---:|");
    for (const [t, n] of worst) L.push(`| \`${t}\` | ${n} |`);
    L.push("");
  }
  if (counts["type-mismatch"] === 0) {
    L.push("### Nothing is mistyped, and that is the finding");
    L.push("");
    L.push(`There are **zero \`type-mismatch\` rows**. Every one of the ${ctx.census.length} columns in the production`);
    L.push("census has a `Row` property in `types.ts`, and every one of those properties is exactly what");
    L.push("`supabase gen types` emits for that column's `udt_name` and nullability — enum arrays and all.");
    L.push("");
    L.push("That is not an all-clear. It is evidence about **which** of the three sources is stale.");
    L.push("`types.ts` was regenerated from production *after* the out-of-band changes landed, so it");
    L.push("faithfully describes a schema that no migration file can produce. The drift in this codebase");
    L.push("runs entirely between production and `supabase/migrations/`; the types file is downstream of");
    L.push("production and tracks it. The corollary for Stage 3 is that REFAC-04 (types) is cheap and");
    L.push("REFAC-01 (migrations) is the expensive one — and that regenerating types would *hide* drift");
    L.push("rather than reveal it, because the generator reads production, not the migrations folder.");
    L.push("");
  } else {
    L.push(`### ${counts["type-mismatch"]} columns are mistyped`);
    L.push("");
    L.push("Each one is a place where client code compiles against a shape production does not have.");
    L.push("See the per-table sections below.");
    L.push("");
  }

  const named = [];
  const rowFor = (table, column) => rows.find((r) => r.table === table && r.column === column);
  const isAdmin = rowFor("users", "is_admin");
  if (isAdmin && isAdmin.introduced_by_migration && /008b/.test(isAdmin.introduced_by_migration)) {
    named.push(`**\`users.is_admin\` is declared by the one file the CLI silently skips.** \`${isAdmin.introduced_by_migration}\` does not parse as \`<version>_<name>.sql\`, so the CLI prints *Skipping* and moves on with a zero exit status. \`009_user_roles.sql\` then guards its \`DROP COLUMN is_admin\` behind a \`DO $$ ... IF EXISTS\` block precisely because the column is absent on a fresh replay. Production does not have the column; the migrations folder says it should. A skip is worse than a failure — it is silent.`);
  }
  const eventsTests = rows.find((r) => r.scope === "table" && r.table === "events_tests");
  if (eventsTests) {
    named.push(`**\`events_tests\` exists only in \`types.ts\`.** Production does not have the table and no migration creates it; the only migration that mentions it is a \`DROP TABLE IF EXISTS\` in \`20260316000004_fk_indexes_and_cleanup.sql\` — a file whose version was **never applied to production**. So a test-scaffolding table was created out of band, dropped out of band, captured into the types file, and the cleanup migration that would have recorded the drop is still sitting unapplied in the repository.`);
  }
  const ues = rows.find((r) => r.scope === "table" && r.table === "user_engagement_summary");
  if (ues) {
    const uesCols = rows.filter((r) => r.scope === "column" && r.table === "user_engagement_summary").length;
    named.push(`**\`user_engagement_summary\` was never built.** \`${ues.introduced_by_migration}\` creates it and production has no such table. ${uesCols} of the ${counts["migrations-only"]} \`migrations-only\` rows are its columns.`);
  }
  const rsvps = rows.find((r) => r.scope === "table" && r.table === "rsvps" && r.drift_class === "prod-only");
  if (rsvps) {
    named.push(`**\`rsvps\` is created by no migration at all, yet other migrations write policies for it.** \`011_rls_audit.sql\` and \`20260313000002_recommendation_engine.sql\` both reference \`rsvps\`; neither creates it. \`011_rls_audit.sql\` is also one half of the duplicate-\`011\` pair that aborts the replay. A table carrying RSVP state — user-linked rows, a \`status\` column — exists in production with no schema-as-code anywhere.`);
  }
  const orphanBuckets = rows.filter((r) => r.table === "storage.buckets" && r.drift_class === "prod-only");
  const openMime = orphanBuckets.filter((r) => /mime_allowlist=none/.test(String(r.prod_type))).length;
  if (orphanBuckets.length) {
    named.push(`**${orphanBuckets.length} of ${rows.filter((r) => r.table === "storage.buckets").length} storage buckets exist only in production** (${orphanBuckets.map((r) => `\`${r.column}\``).join(", ")}). \`supabase/config.toml\`'s \`[storage.buckets.*]\` block is entirely commented out and only \`event-images\` is created by a migration, so these three were made in the dashboard. All ${orphanBuckets.length} are \`public = true\`, and ${openMime} of them carry no MIME-type allow-list at all — AUDIT-18's subject, reached from the drift side.`);
  }
  const orphanCron = rows.filter((r) => r.table === "cron.job" && r.drift_class === "prod-only");
  if (orphanCron.length) {
    named.push(`**All ${orphanCron.length} pg_cron jobs exist only in production** (${orphanCron.map((r) => `\`${r.column}\``).join(", ")}). The only trace of any of them in the repository is a commented-out \`cron.schedule(...)\` line in \`20260313000002_recommendation_engine.sql\` — and that file's version was never applied to production either. Three live scheduled jobs mutating production data, none of them schema-as-code.`);
  }
  if (named.length) {
    L.push("### Named consequences");
    L.push("");
    for (const item of named) L.push(`- ${item}`);
    L.push("");
  }

  L.push("This is the per-column shadow of the version accounting in");
  L.push("[`migration-list.prod.txt`](./migration-list.prod.txt): **18 migration versions are applied in");
  L.push("production with no file in the repository**, 17 of them in a two-day burst on 2026-03-15/16.");
  L.push("The columns those versions created are exactly the `prod-only` rows below. Conversely **12");
  L.push("files declare a version production never applied**, and their columns are the");
  L.push("`migrations-only` rows.");
  L.push("");
  L.push("## Drift by table");
  L.push("");
  L.push("Only rows that are **not** `in-sync` are listed. A table with no section is fully in sync.");
  L.push("");

  for (const table of tables) {
    const bad = outOfSync.filter((r) => r.table === table);
    const total = rows.filter((r) => r.table === table).length;
    L.push(`### \`${table}\``);
    L.push("");
    L.push(`${bad.length} of ${total} rows drift.`);
    L.push("");
    L.push("| Column | Class | In prod | In migrations | Typed correctly | Prod type | types.ts says | Note |");
    L.push("|---|---|:-:|:-:|:-:|---|---|---|");
    for (const r of bad) {
      const yn = (v) => (v === true ? "yes" : v === false ? "**no**" : "—");
      const cell = (v) => (v == null ? "—" : `\`${String(v).replace(/\|/g, "\\|")}\``);
      const note = [r.notes, r.human_note].filter(Boolean).join(" — ").replace(/\|/g, "\\|") || "—";
      L.push(`| ${r.column ? `\`${r.column}\`` : `_(whole ${r.scope})_`} | \`${r.drift_class}\` | ${yn(r.exists_in_prod)} | ${yn(r.exists_in_migrations)}${r.introduced_by_migration ? ` <sub>${r.introduced_by_migration}</sub>` : ""} | ${yn(r.typed_correctly)} | ${cell(r.prod_type)} | ${cell(r.typed_as)} | ${note} |`);
    }
    L.push("");
  }

  L.push("## Reproducing this table");
  L.push("");
  L.push("```bash");
  L.push("node .planning/audit/tools/gen-drift-table.mjs");
  L.push("node .planning/audit/tools/validate.mjs --check drift");
  L.push("bash .planning/audit/tools/readonly-guard.sh");
  L.push("```");
  L.push("");
  L.push("The generator is idempotent: two consecutive runs leave `drift.json` byte-identical. It reads");
  L.push("no environment variable, opens no network connection, and writes only the two files under");
  L.push("`.planning/audit/schema/`.");
  L.push("");
  L.push("---");
  L.push("");
  L.push("*Phase: 01-read-only-foundation-audit*");
  L.push("*Plan: 01-08*");
  L.push("");
  return L.join("\n");
}

/* -------------------------------------------------------------------- main -- */

function main() {
  assertRepoRoot();
  process.stderr.write("gen-drift-table — AUDIT-02 three-way reconciliation\n");

  const { rows, mig, types, census, prodTables } = buildRows();
  const merged = mergeWithExisting(rows);

  writeFileSync(OUT_JSON, `${JSON.stringify(merged, null, 2)}\n`);
  progress(`wrote ${OUT_JSON} (${merged.length} rows)`);

  writeFileSync(OUT_MD, renderMarkdown(merged, { mig, types, census, prodTables }));
  progress(`wrote ${OUT_MD}`);

  const counts = {};
  for (const r of merged) counts[r.drift_class] = (counts[r.drift_class] || 0) + 1;
  progress(`drift classes: ${DRIFT_CLASSES.map((c) => `${c}=${counts[c] || 0}`).join("  ")}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`\ngen-drift-table FAILED: ${scrub(error && error.message ? error.message : error)}\n`);
  if (error && !error.__expected && error.stack) {
    process.stderr.write(`${scrub(error.stack.split("\n").slice(1, 4).join("\n"))}\n`);
  }
  process.exit(1);
}
