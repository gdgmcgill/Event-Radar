/**
 * An in-memory, PostgREST-shaped Supabase fake for characterization suites.
 *
 * Plan 04-02 (REFAC-09). The Slice 1 characterization suites drive the real
 * exported route handlers against this fake instead of a chain of mock-function
 * stubs. A stub returns whatever the test told it to, whatever the handler
 * asked for, so a suite built on stubs cannot notice a handler that stops
 * filtering by `user_id`. This fake evaluates the filters it is given against
 * rows it holds, so a query that asks the wrong question gets the wrong answer.
 *
 * What it models, deliberately:
 *   - `eq`, `neq`, `is`, `in`, `gte`, `lte`, `lt`, `gt` are EVALUATED against
 *     the table's rows, with SQL's NULL rule: a comparison against a null
 *     column value is not true (so `neq("status", "cancelled")` drops a row
 *     whose status is null, as Postgres does). Timestamps are compared as
 *     instants when both sides parse as ISO dates, so `2026-01-01` and
 *     `2026-01-01T00:00:00+00:00` compare correctly.
 *   - `or` and `overlaps` are RECORDED in the call log and not evaluated.
 *   - Successive `order()` calls are cumulative sort keys in call order: the
 *     first is primary, a later one only breaks ties. Postgres' default null
 *     placement is followed (NULLS LAST ascending, NULLS FIRST descending).
 *     `range()` and `limit()` apply after ordering.
 *   - `select(columns, { count: "exact" })` returns `{ data, count }`; with
 *     `head: true` it returns `{ data: null, count }`. A count is the number of
 *     rows matching the filters, before `range`/`limit` — PostgREST's
 *     semantics, and the reason a head count is not capped by max_rows.
 *   - Columns are projected: `select("id")` returns rows holding only `id`.
 *     `*` keeps every stored key. An embed such as `club:clubs(id, name)` is
 *     answered from the row's own `club` key (null when absent), so a fixture
 *     supplies the embedded object directly.
 *   - `single()` returns error code PGRST116 unless exactly one row matches;
 *     `maybeSingle()` returns null data on zero rows and PGRST116 on several.
 *   - `insert`, `update` and `delete` mutate the in-memory table and return
 *     the affected rows (projected) only when `select()` is chained. An insert
 *     is given a deterministic `id` and `created_at`/`updated_at` when the
 *     payload lacks them, standing in for the column defaults.
 *
 * Injection:
 *   - `errors["<table>"]` is returned by every query on that table;
 *     `errors["<table>.<operation>"]` (operation: select, insert, update,
 *     delete) only by that operation and takes precedence. Neither mutates.
 *   - `throwOn["<table>"]` makes `from(table)` throw synchronously, which is
 *     how a suite reaches a handler's outer catch.
 *   - `rpc["<name>"]` is the `{ data, error }` a call to that function returns.
 *
 * Every executed query appends one entry to `calls` (table, operation, columns,
 * options, the ordered filter list, ordering, range/limit, payload and the
 * terminal used), so a DEFECT suite can assert on the shape of a query.
 *
 * This module uses no jest global and imports no type from the Supabase SDK:
 * it is structural, so it type-checks inside the main tsconfig program.
 */

export type FakeRow = Record<string, unknown>;

export interface FakeError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export interface FakeUser {
  id: string;
  email?: string;
}

export interface FakeAuthError {
  message: string;
  status?: number;
}

export interface FakeRpcResult {
  data: unknown;
  error: FakeError | null;
}

export interface FakeSupabaseInit {
  user?: FakeUser | null;
  authError?: FakeAuthError | null;
  tables?: Record<string, FakeRow[]>;
  errors?: Record<string, FakeError>;
  throwOn?: Record<string, string>;
  rpc?: Record<string, FakeRpcResult>;
  /** Timestamp stamped on inserted rows that lack created_at/updated_at. */
  now?: string;
}

export type FakeOperation = "select" | "insert" | "update" | "delete" | "rpc";

export type FakeFilterOp =
  | "eq"
  | "neq"
  | "is"
  | "in"
  | "gte"
  | "lte"
  | "lt"
  | "gt"
  | "or"
  | "overlaps";

export interface FakeFilter {
  op: FakeFilterOp;
  column: string;
  value: unknown;
}

export interface FakeSelectOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

export interface FakeOrder {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

export type FakeTerminal = "then" | "single" | "maybeSingle";

export interface FakeCall {
  table: string;
  operation: FakeOperation;
  /** Columns passed to select(); null when select() was never called. */
  columns: string | null;
  /** The options object passed to select(); null when none was passed. */
  options: FakeSelectOptions | null;
  filters: FakeFilter[];
  order: FakeOrder[];
  range: { from: number; to: number } | null;
  limit: number | null;
  payload: unknown;
  terminal: FakeTerminal;
}

export interface FakeResult {
  data: unknown;
  error: FakeError | null;
  count: number | null;
}

const DEFAULT_NOW = "2026-01-01T00:00:00.000Z";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

/** Three-way compare with instants for ISO dates; null when incomparable. */
function compare(a: unknown, b: unknown): number | null {
  if (isNullish(a) || isNullish(b)) return null;
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    ISO_DATE.test(a) &&
    ISO_DATE.test(b)
  ) {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
      return ta === tb ? 0 : ta < tb ? -1 : 1;
    }
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  const sa = String(a);
  const sb = String(b);
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function matches(row: FakeRow, filter: FakeFilter): boolean {
  const actual = row[filter.column];
  switch (filter.op) {
    case "is":
      return filter.value === null
        ? isNullish(actual)
        : actual === filter.value;
    case "in":
      return (
        !isNullish(actual) &&
        Array.isArray(filter.value) &&
        filter.value.some((v) => compare(actual, v) === 0)
      );
    case "eq":
      return compare(actual, filter.value) === 0;
    case "neq": {
      const c = compare(actual, filter.value);
      return c !== null && c !== 0;
    }
    case "gte": {
      const c = compare(actual, filter.value);
      return c !== null && c >= 0;
    }
    case "lte": {
      const c = compare(actual, filter.value);
      return c !== null && c <= 0;
    }
    case "gt": {
      const c = compare(actual, filter.value);
      return c !== null && c > 0;
    }
    case "lt": {
      const c = compare(actual, filter.value);
      return c !== null && c < 0;
    }
    case "or":
    case "overlaps":
      // Recorded, not evaluated.
      return true;
  }
}

/** Splits a select list on top-level commas, leaving embeds intact. */
function splitColumns(columns: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of columns) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function project(row: FakeRow, columns: string | null): FakeRow {
  if (columns === null) return { ...row };
  const out: FakeRow = {};
  for (const token of splitColumns(columns)) {
    if (token === "*") {
      Object.assign(out, row);
      continue;
    }
    const paren = token.indexOf("(");
    if (paren !== -1) {
      // alias:relation(...) or relation(...) — answered from row[alias].
      const head = token.slice(0, paren).trim();
      const alias = head.includes(":") ? head.split(":")[0].trim() : head;
      out[alias] = isNullish(row[alias]) ? null : row[alias];
      continue;
    }
    const name = token.includes(":") ? token.split(":")[0].trim() : token;
    const source = token.includes(":") ? token.split(":")[1].trim() : token;
    out[name] = isNullish(row[source]) ? null : row[source];
  }
  return out;
}

function sortRows(rows: FakeRow[], order: FakeOrder[]): FakeRow[] {
  if (order.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const key of order) {
      const av = a[key.column];
      const bv = b[key.column];
      const an = isNullish(av);
      const bn = isNullish(bv);
      if (an && bn) continue;
      if (an || bn) {
        const nullFirst = key.nullsFirst;
        if (an) return nullFirst ? -1 : 1;
        return nullFirst ? 1 : -1;
      }
      const c = compare(av, bv) ?? 0;
      if (c !== 0) return key.ascending ? c : -c;
    }
    return 0;
  });
}

interface FakeState {
  tables: Record<string, FakeRow[]>;
  calls: FakeCall[];
  errors: Record<string, FakeError>;
  now: string;
  sequence: { value: number };
}

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private operation: FakeOperation = "select";
  private columns: string | null = null;
  private options: FakeSelectOptions | null = null;
  private returning = false;
  private readonly filters: FakeFilter[] = [];
  private readonly orderKeys: FakeOrder[] = [];
  private rangeValue: { from: number; to: number } | null = null;
  private limitValue: number | null = null;
  private payload: unknown = null;
  private terminal: FakeTerminal = "then";

  constructor(
    private readonly table: string,
    private readonly state: FakeState
  ) {}

  select(columns = "*", options?: FakeSelectOptions): this {
    if (this.operation === "select") {
      this.columns = columns;
      this.options = options ?? null;
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }

  insert(payload: FakeRow | FakeRow[]): this {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: FakeRow): this {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    return this;
  }

  private filter(op: FakeFilterOp, column: string, value: unknown): this {
    this.filters.push({ op, column, value });
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter("eq", column, value);
  }

  neq(column: string, value: unknown): this {
    return this.filter("neq", column, value);
  }

  is(column: string, value: unknown): this {
    return this.filter("is", column, value);
  }

  in(column: string, values: readonly unknown[]): this {
    return this.filter("in", column, values);
  }

  gte(column: string, value: unknown): this {
    return this.filter("gte", column, value);
  }

  lte(column: string, value: unknown): this {
    return this.filter("lte", column, value);
  }

  lt(column: string, value: unknown): this {
    return this.filter("lt", column, value);
  }

  gt(column: string, value: unknown): this {
    return this.filter("gt", column, value);
  }

  or(expression: string): this {
    return this.filter("or", "", expression);
  }

  overlaps(column: string, value: unknown): this {
    return this.filter("overlaps", column, value);
  }

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): this {
    const ascending = options?.ascending ?? true;
    this.orderKeys.push({
      column,
      ascending,
      nullsFirst: options?.nullsFirst ?? !ascending,
    });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeValue = { from, to };
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  single(): this {
    this.terminal = "single";
    return this;
  }

  maybeSingle(): this {
    this.terminal = "maybeSingle";
    return this;
  }

  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((value: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private record(): void {
    this.state.calls.push({
      table: this.table,
      operation: this.operation,
      columns: this.columns,
      options: this.options,
      filters: [...this.filters],
      order: [...this.orderKeys],
      range: this.rangeValue,
      limit: this.limitValue,
      payload: this.payload,
      terminal: this.terminal,
    });
  }

  private rows(): FakeRow[] {
    if (!this.state.tables[this.table]) this.state.tables[this.table] = [];
    return this.state.tables[this.table];
  }

  private matching(): FakeRow[] {
    return this.rows().filter((row) =>
      this.filters.every((f) => matches(row, f))
    );
  }

  private finish(rows: FakeRow[], count: number | null): FakeResult {
    const shaped = rows.map((row) => project(row, this.columns));
    if (this.terminal === "single") {
      if (shaped.length !== 1) {
        return {
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${shaped.length} rows`,
            hint: null,
          },
          count,
        };
      }
      return { data: shaped[0], error: null, count };
    }
    if (this.terminal === "maybeSingle") {
      if (shaped.length > 1) {
        return {
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${shaped.length} rows`,
            hint: null,
          },
          count,
        };
      }
      return { data: shaped[0] ?? null, error: null, count };
    }
    return { data: shaped, error: null, count };
  }

  private execute(): FakeResult {
    this.record();

    const injected =
      this.state.errors[`${this.table}.${this.operation}`] ??
      this.state.errors[this.table];
    if (injected) return { data: null, error: injected, count: null };

    if (this.operation === "select") {
      const matched = sortRows(this.matching(), this.orderKeys);
      const count = this.options?.count ? matched.length : null;
      if (this.options?.head) return { data: null, error: null, count };
      let windowed = matched;
      if (this.rangeValue) {
        windowed = windowed.slice(this.rangeValue.from, this.rangeValue.to + 1);
      }
      if (this.limitValue !== null) {
        windowed = windowed.slice(0, this.limitValue);
      }
      return this.finish(windowed, count);
    }

    if (this.operation === "insert") {
      const payloads = Array.isArray(this.payload)
        ? (this.payload as FakeRow[])
        : [this.payload as FakeRow];
      const inserted = payloads.map((p) => {
        this.state.sequence.value += 1;
        const row: FakeRow = {
          id: `fake-${this.table}-${this.state.sequence.value}`,
          created_at: this.state.now,
          updated_at: this.state.now,
          ...p,
        };
        this.rows().push(row);
        return row;
      });
      return this.returning
        ? this.finish(inserted, null)
        : { data: null, error: null, count: null };
    }

    if (this.operation === "update") {
      const updated = this.matching();
      for (const row of updated) Object.assign(row, this.payload as FakeRow);
      return this.returning
        ? this.finish(updated, null)
        : { data: null, error: null, count: null };
    }

    // delete
    const removed = this.matching();
    this.state.tables[this.table] = this.rows().filter(
      (row) => !removed.includes(row)
    );
    return this.returning
      ? this.finish(removed, null)
      : { data: null, error: null, count: null };
  }
}

class FakeRpcCall implements PromiseLike<FakeResult> {
  constructor(
    private readonly name: string,
    private readonly args: unknown,
    private readonly result: FakeRpcResult,
    private readonly state: FakeState
  ) {}

  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((value: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => {
        this.state.calls.push({
          table: this.name,
          operation: "rpc",
          columns: null,
          options: null,
          filters: [],
          order: [],
          range: null,
          limit: null,
          payload: this.args,
          terminal: "then",
        });
        return { ...this.result, count: null };
      })
      .then(onfulfilled, onrejected);
  }
}

export interface FakeSupabaseClient {
  auth: {
    getUser(): Promise<{
      data: { user: FakeUser | null };
      error: FakeAuthError | null;
    }>;
  };
  from(table: string): FakeQueryBuilder;
  rpc(name: string, args?: unknown): FakeRpcCall;
}

export interface FakeSupabase {
  client: FakeSupabaseClient;
  calls: FakeCall[];
  /** Live view of the in-memory tables; read it after a write to assert state. */
  tables: Record<string, FakeRow[]>;
}

/**
 * Builds a fresh fake. Table arrays are copied row-by-row, so a fixture object
 * shared between tests is never mutated by a handler's write.
 */
export function createFakeSupabase(init: FakeSupabaseInit = {}): FakeSupabase {
  const tables: Record<string, FakeRow[]> = {};
  for (const [name, rows] of Object.entries(init.tables ?? {})) {
    tables[name] = rows.map((row) => ({ ...row }));
  }
  const state: FakeState = {
    tables,
    calls: [],
    errors: init.errors ?? {},
    now: init.now ?? DEFAULT_NOW,
    sequence: { value: 0 },
  };
  const user = init.user ?? null;
  const authError = init.authError ?? null;
  const throwOn = init.throwOn ?? {};
  const rpcResults = init.rpc ?? {};

  const client: FakeSupabaseClient = {
    auth: {
      getUser: async () => ({ data: { user }, error: authError }),
    },
    from(table: string) {
      if (throwOn[table]) throw new Error(throwOn[table]);
      return new FakeQueryBuilder(table, state);
    },
    rpc(name: string, args?: unknown) {
      const result = rpcResults[name] ?? {
        data: null,
        error: {
          code: "PGRST202",
          message: `Could not find the function public.${name}`,
        },
      };
      return new FakeRpcCall(name, args ?? null, result, state);
    },
  };

  return {
    client,
    calls: state.calls,
    get tables() {
      return state.tables;
    },
  };
}
