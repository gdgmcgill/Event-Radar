/**
 * A payload-recording Supabase fake for the REVIEW-05 warning suites.
 *
 * Not a test file: `jest.mock` calls stay in each suite, which points
 * `@/lib/supabase/server` at a cookie fake and `@/lib/supabase/service` at an
 * elevated fake built here. Every call records its table, operation, payload,
 * filters and selected columns, so a suite can pin WHAT a handler writes and
 * how the write is scoped, not only which client performs it.
 *
 * Answers are keyed `<table>.<operation>` (or `rpc:<name>`). An array answer
 * is consumed one element per call, the last element repeating.
 */

import { NextRequest } from "next/server";

export type Operation = "select" | "insert" | "update" | "upsert" | "delete";

export interface Answer {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

export type Answers = Record<string, Answer | Answer[]>;

export interface Call {
  table: string;
  operation: Operation;
  payload?: unknown;
  filters: Array<{ op: string; column: string; value: unknown }>;
  columns: string | null;
}

export interface Fake {
  client: unknown;
  calls: Call[];
}

export const PROFILE_COLUMNS =
  "id, roles, onboarding_completed, banned_at, ban_expires_at";

export interface FakeOptions {
  user?: { id: string; email: string } | null;
  profile?: Record<string, unknown> | null;
  answers?: Answers;
}

export function makeFake(options: FakeOptions = {}): Fake {
  const calls: Call[] = [];
  const answers = options.answers ?? {};
  const consumed: Record<string, number> = {};

  function answerFor(key: string): Answer {
    const entry = answers[key];
    if (entry === undefined) return {};
    if (!Array.isArray(entry)) return entry;
    const index = consumed[key] ?? 0;
    consumed[key] = index + 1;
    return entry[Math.min(index, entry.length - 1)] ?? {};
  }

  function builder(table: string) {
    const call: Call = {
      table,
      operation: "select",
      filters: [],
      columns: null,
    };
    let terminal: "then" | "single" | "maybeSingle" = "then";

    const resolve = () => {
      const isContextRead =
        table === "users" &&
        call.operation === "select" &&
        call.columns === PROFILE_COLUMNS;
      if (isContextRead) {
        return { data: options.profile ?? null, error: null, count: null };
      }
      calls.push(call);
      const answer = answerFor(`${table}.${call.operation}`);
      const error = answer.error ?? null;
      let data: unknown = answer.data ?? null;
      if (terminal !== "then" && Array.isArray(data)) data = data[0] ?? null;
      if (terminal === "single" && data === null && error === null) {
        return {
          data: null,
          error: { code: "PGRST116", message: "no rows" },
          count: null,
        };
      }
      return { data, error, count: Array.isArray(data) ? data.length : null };
    };

    const chain: Record<string, unknown> = {};
    for (const op of [
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "or",
      "gte",
      "lte",
      "gt",
      "lt",
      "ilike",
      "like",
      "contains",
      "overlaps",
    ]) {
      chain[op] = (column: string, ...rest: unknown[]) => {
        call.filters.push({
          op,
          column,
          value: rest.length > 1 ? rest : rest[0],
        });
        return chain;
      };
    }
    for (const op of ["order", "range", "limit"]) chain[op] = () => chain;
    chain.select = (cols?: string) => {
      if (call.operation === "select") call.columns = cols ?? "*";
      return chain;
    };
    for (const op of ["insert", "update", "upsert", "delete"] as const) {
      chain[op] = (payload?: unknown) => {
        call.operation = op;
        call.payload = payload;
        return chain;
      };
    }
    chain.single = () => {
      terminal = "single";
      return chain;
    };
    chain.maybeSingle = () => {
      terminal = "maybeSingle";
      return chain;
    };
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve().then(resolve).then(onFulfilled, onRejected);
    return chain;
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: null,
      }),
    },
    from: (table: string) => builder(table),
    rpc: (name: string) => {
      const settle = () => {
        calls.push({ table: `rpc:${name}`, operation: "select", filters: [], columns: null });
        const answer = answerFor(`rpc:${name}`);
        return { data: answer.data ?? null, error: answer.error ?? null };
      };
      return {
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve().then(settle).then(onFulfilled, onRejected),
      };
    },
  };

  return { client, calls };
}

/** The writes (every operation but select) a fake recorded, as `table.op`. */
export function writes(fake: Fake): string[] {
  return fake.calls
    .filter((c) => c.operation !== "select")
    .map((c) => `${c.table}.${c.operation}`);
}

/** The recorded calls for one table and operation. */
export function callsTo(fake: Fake, table: string, operation: Operation): Call[] {
  return fake.calls.filter((c) => c.table === table && c.operation === operation);
}

export function profileOf(id: string, roles: string[]) {
  return {
    id,
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

// Synthetic ids, not seed ids.
export const ADMIN = {
  id: "5eed0000-0000-4000-8000-0f0500000001",
  email: "review05.admin@mail.mcgill.ca",
};
export const STUDENT = {
  id: "5eed0000-0000-4000-8000-0f0500000002",
  email: "review05.student@mail.mcgill.ca",
};
export const OTHER = "5eed0000-0000-4000-8000-0f0500000003";
export const THIRD = "5eed0000-0000-4000-8000-0f0500000004";
export const CLUB_ID = "5eed0000-0000-4000-8000-0f05000000c1";
export const OTHER_CLUB_ID = "5eed0000-0000-4000-8000-0f05000000c2";
export const EVENT_ID = "5eed0000-0000-4000-8000-0f05000000e1";
export const MEMBERSHIP_ID = "5eed0000-0000-4000-8000-0f05000000d1";
export const OWNER_MEMBERSHIP_ID = "5eed0000-0000-4000-8000-0f05000000d2";
export const REQUEST_ID = "5eed0000-0000-4000-8000-0f05000000f1";
export const REPORT_ID = "5eed0000-0000-4000-8000-0f05000000a1";

const BASE = "http://localhost:3000/api";

/** A request with a JSON body, or with `rawBody` sent verbatim. */
export function jsonRequest(
  path: string,
  method: string,
  body?: unknown,
  rawBody?: string
): NextRequest {
  const text = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  return new NextRequest(`${BASE}/${path}`, {
    method,
    ...(text === undefined
      ? {}
      : { body: text, headers: { "content-type": "application/json" } }),
  });
}

export function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
