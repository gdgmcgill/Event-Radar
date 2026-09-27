/**
 * The structured server logger and the per-request store (REFAC-20, DEC-74).
 *
 * Phase 06 · plan 06-12.
 *
 * ONE LINE PER EVENT
 *   `log.info("msg", fields)` writes ONE argument, a JSON string:
 *   `{ ts, level, msg, requestId, route, scope, ...fields }`. `requestId` and
 *   `route` come from the request store (or a `requestId` field), `scope` from a
 *   `scope` field (the old `[Prefix]`). A field can never overwrite `ts`,
 *   `level` or `msg`. `JSON.stringify` escapes newlines, so a message cannot
 *   forge a second line (log injection is closed by construction).
 *
 * THE SINK IS THE CONSOLE
 *   error and warn go through `console.error`, info and debug through
 *   `console.log`. Vercel captures both streams, and a test that silences or
 *   counts console calls keeps working (research C26).
 *
 * REDACTION (phase constraint 11: no PII, secrets, cookies or bodies)
 *   Every value is passed through `redact` before it is written:
 *   - a key named cookie, cookies, set-cookie, authorization, password, token,
 *     access_token, refresh_token, email, body, secret or apikey (any case)
 *     becomes "[redacted]", however deep;
 *   - an email-shaped substring in any string, the message included, becomes
 *     "[email]";
 *   - an Error becomes `{ name, message, code }` (no stack, no cause).
 *   The logger never throws: an unserializable value degrades the line, never
 *   the request.
 *
 * NODE RUNTIME ONLY
 *   This module imports `node:async_hooks`. The proxy runs on the Node.js
 *   runtime by default in Next 16 (proxy docs: "Proxy defaults to using the
 *   Node.js runtime"), route handlers and Server Components run on Node, and
 *   `src/instrumentation.ts` imports this module dynamically on its nodejs
 *   branch only. Client code never imports it: `src/lib/tagMapping.ts`, shared
 *   with client components, stays on console (allow-listed in
 *   `scripts/server-console-allowlist.json`).
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** What the request store carries. `route` is the pathname, never the query. */
export type RequestStore = { requestId: string; route?: string; lastError?: { cause: unknown } };

export type LogFields = Record<string, unknown>;

const storage = new AsyncLocalStorage<RequestStore>();

/** Runs `fn` with `store` as the current request store and returns its value. */
export function runWithRequest<T>(store: RequestStore, fn: () => T): T {
  return storage.run(store, fn);
}

/** The current request's id, or undefined outside a request store. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Last error logged in this request; used to report returned 5xx responses. */
export function currentRequestError(): { cause: unknown } | undefined {
  return storage.getStore()?.lastError;
}

// ─── Redaction ───────────────────────────────────────────────────────────────

const REDACTED_KEYS = new Set([
  "cookie",
  "cookies",
  "set-cookie",
  "authorization",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "email",
  "body",
  "secret",
  "apikey",
]);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

const MAX_DEPTH = 8;

function redactString(value: string): string {
  return value.replace(EMAIL, "[email]");
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") {
    return typeof value === "function" || typeof value === "symbol"
      ? undefined
      : value;
  }
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  seen.add(value);
  try {
    if (value instanceof Error) {
      const code = (value as { code?: unknown }).code;
      const out: Record<string, unknown> = {
        name: value.name,
        message: redactString(value.message),
      };
      if (typeof code === "string" || typeof code === "number") out.code = code;
      return out;
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, depth + 1, seen));
    }
    if (!isPlainObject(value)) {
      // Dates, URLs and other objects serialize through their own toJSON or
      // toString; anything else is reduced to its type name, never walked.
      if (value instanceof Date) return value.toISOString();
      if (value instanceof URL) return redactString(value.pathname);
      return `[${value.constructor?.name ?? "object"}]`;
    }
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase())
        ? "[redacted]"
        : redactValue(inner, depth + 1, seen);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

/**
 * Returns a redacted copy of `value`: named secret keys become "[redacted]",
 * email-shaped substrings become "[email]", Errors become `{ name, message,
 * code }`. The input is never mutated.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet());
}

// ─── Emission ────────────────────────────────────────────────────────────────

const RESERVED = new Set(["ts", "level", "msg", "requestId", "route", "scope"]);

function emit(level: LogLevel, msg: string, fields: LogFields = {}): void {
  const sink = level === "error" || level === "warn" ? console.error : console.log;
  let line: string;
  try {
    const store = storage.getStore();
    if (level === "error" && store) {
      store.lastError = { cause: fields.error ?? new Error(msg) };
    }
    const requestId =
      typeof fields.requestId === "string" ? fields.requestId : store?.requestId;
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: redactString(String(msg)),
      requestId,
      route: store?.route,
      scope: typeof fields.scope === "string" ? fields.scope : undefined,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (RESERVED.has(key)) continue;
      record[key] = REDACTED_KEYS.has(key.toLowerCase())
        ? "[redacted]"
        : redact(value);
    }
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: redactString(String(msg)),
      requestId: currentRequestId(),
      unserializable: true,
    });
  }
  sink(line);
}

/** The logger. Each call writes one redacted JSON line. */
export const log = {
  debug: (msg: string, fields?: LogFields): void => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields): void => emit("error", msg, fields),
};
