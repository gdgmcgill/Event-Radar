/**
 * Reading a JSON request body that must be an object (REVIEW-05 WR-08).
 *
 * `await request.json()` throws on an invalid body, and a valid body can be
 * `null`, a string, a number or an array, on which `"key" in body` or
 * `body.key` throws. Outside a `try` either one reaches the framework, which
 * answers an HTML 500 with no context. This reader turns both into the
 * project's JSON 400 (`badRequest`), and hands back a plain object.
 *
 * The object's values are NOT validated here: the handler still checks each
 * field it reads. They are typed as `any`, exactly what `request.json()`
 * returned before, so adopting the reader changes no handler's field logic.
 *
 * THE CONTRACT BOUNDARY (plan 06-04, REFAC-15, DEC-65). `parseBody`,
 * `parseQuery` and `parseWith` below validate input against a zod schema from
 * src/contracts/ and keep today's wire bytes:
 *
 *   - parseBody reads through readJsonObject first, so an invalid body is
 *     still 400 "Invalid JSON body" and a non-object body still 400
 *     "Request body must be a JSON object" (the 21 raw sites gain these in
 *     place of a 500: F-094, INTENTIONAL BEHAVIOUR CHANGE per adopting route).
 *   - The FIRST issue decides the 400. zod reports issues in schema key order,
 *     so a schema declares its keys in the order the handler checked them, and
 *     every rule carries today's message through zod's `error` parameter
 *     (Pitfall 6).
 *   - `field` is emitted only when the first issue's top-level key is named in
 *     `opts.fieldFor` (C10). Everywhere else the body stays `{ error }`.
 *   - Schemas carry shape and format only. A business rule evaluated after a
 *     database read (an owner check, a state check) stays in the handler as a
 *     `badRequest()` (C11).
 *   - Parsing runs after the guard prologue, where readJsonObject sat, so a
 *     401 or 403 still precedes any 400.
 *
 * scripts/check-contracts.mjs fails CI on a raw JSON, multipart or route query
 * read outside this file, and on a readJsonObject call in a route file (a body
 * read with no schema), unless its shrink-only allow-list holds the site.
 */

import type { NextResponse } from "next/server";
import type { z } from "zod";
import { badRequest } from "@/server/errors";

// Same typing as `Request.json()`'s `Promise<any>`, narrowed to an object.
export type JsonObject = Record<string, any>;

export type ReadJsonObjectResult =
  | { ok: true; body: JsonObject }
  | { ok: false; response: NextResponse };

export async function readJsonObject(
  request: Request
): Promise<ReadJsonObjectResult> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, response: badRequest("Invalid JSON body") };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      response: badRequest("Request body must be a JSON object"),
    };
  }
  return { ok: true, body: parsed as JsonObject };
}

// ─── The contract boundary (plan 06-04, DEC-65) ──────────────────────────────

/** A parse result: the schema's output, or the 400 to return as-is. */
export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export interface ParseOptions {
  /**
   * Top-level keys whose 400 carries `field` (C10). Only the four sites that
   * emit `field` today name any; everywhere else the body is `{ error }`.
   */
  fieldFor?: readonly string[];
}

/**
 * Validates `input` against `schema`. On failure the 400 body is the first
 * issue's message, plus `field` when that issue's top-level key is named in
 * `opts.fieldFor`.
 */
export function parseWith<S extends z.ZodType>(
  schema: S,
  input: unknown,
  opts: ParseOptions = {}
): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const top = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
  const field =
    top !== undefined && opts.fieldFor?.includes(top) ? top : undefined;
  return {
    ok: false,
    response: badRequest(issue?.message ?? "Invalid request", field),
  };
}

/**
 * Reads a JSON object body (readJsonObject's two 400s unchanged) and hands it
 * to the schema. Called after the handler's guards.
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  opts?: ParseOptions
): Promise<Parsed<z.output<S>>> {
  const read = await readJsonObject(request);
  if (!read.ok) return read;
  return parseWith(schema, read.body, opts);
}

/**
 * The wrapper kinds that do not change what a query value looks like; an
 * array under any of them still asks for every value of a repeated key.
 */
const TRANSPARENT_WRAPPERS = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "catch",
  "readonly",
]);

interface SchemaInternals {
  _zod?: { def?: { type?: string; innerType?: unknown; in?: unknown } };
  shape?: Record<string, unknown>;
}

/** True when the key's schema (through optional/default/pipe input) is an array. */
function asksForArray(fieldSchema: unknown): boolean {
  let current = fieldSchema as SchemaInternals | undefined;
  for (let depth = 0; current && depth < 8; depth++) {
    const def = current._zod?.def;
    if (!def) return false;
    if (def.type === "array") return true;
    if (def.type && TRANSPARENT_WRAPPERS.has(def.type)) {
      current = def.innerType as SchemaInternals | undefined;
    } else if (def.type === "pipe") {
      current = def.in as SchemaInternals | undefined;
    } else {
      return false;
    }
  }
  return false;
}

/**
 * Turns URLSearchParams into a plain object and hands it to the schema.
 *
 * A key appears once, with its FIRST value, exactly what `searchParams.get`
 * returned to the handler before (Object.fromEntries would keep the last). A
 * repeated key becomes an array of every value only when the schema declares
 * that key as an array. A missing key is absent, so a schema reproduces a
 * handler's `get(k) || default` with `.optional()` and a transform.
 */
export function parseQuery<S extends z.ZodType>(
  params: URLSearchParams,
  schema: S,
  opts?: ParseOptions
): Parsed<z.output<S>> {
  const shape = (schema as unknown as SchemaInternals).shape ?? {};
  const input: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    input[key] = asksForArray(shape[key])
      ? params.getAll(key)
      : (params.get(key) as string);
  }
  return parseWith(schema, input, opts);
}
