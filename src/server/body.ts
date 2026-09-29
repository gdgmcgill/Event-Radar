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
 * parseForm (plan 06-08) is the multipart door. It reads the form inside a
 * try (production contracts classify an unreadable form as a 400 client error),
 * checks the one file field with the route's own texts
 * and order (missing, then size and type in the order the route checked them)
 * and hands the non-file fields, first value per key, to a zod schema.
 *
 * scripts/check-contracts.mjs fails CI on a raw JSON, multipart or route query
 * read outside this file, and on a readJsonObject call in a route file (a body
 * read with no schema), unless its shrink-only allow-list holds the site.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { sniffImageType } from "@/lib/imageSniff";
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
  return parseWith(schema, queryInput(params, schema), opts);
}

/** The plain object parseQuery and readQuery hand to a schema. */
function queryInput(
  params: URLSearchParams,
  schema: z.ZodType
): Record<string, string | string[]> {
  const shape = (schema as unknown as SchemaInternals).shape ?? {};
  const input: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    input[key] = asksForArray(shape[key])
      ? params.getAll(key)
      : (params.get(key) as string);
  }
  return input;
}

/**
 * parseQuery for a query that answers no 400 today (plan 06-08): every value
 * is read as sent or coerced silently, so the schema cannot refuse and the
 * route carries no 400 branch it could never take. A refusal would be a
 * programming error in the schema, and throws (the route's catch answers it).
 * A schema with a 400 goes through parseQuery.
 */
export function readQuery<S extends z.ZodType>(
  params: URLSearchParams,
  schema: S
): z.output<S> {
  return schema.parse(queryInput(params, schema));
}

// ─── The multipart door (plan 06-08, DEC-65) ─────────────────────────────────

/** A route's rule for its one uploaded file, with the route's own texts. */
export interface FileRule {
  /** The form key the file is sent under. */
  field: string;
  /** The accepted MIME types (compared with `file.type` exactly). */
  types: readonly string[];
  /** The largest accepted size in bytes (a file of exactly this size passes). */
  maxBytes: number;
  /** The order the route checked size and type in; size first by default. */
  order?: readonly ["size", "type"] | readonly ["type", "size"];
  messages: {
    missing: string;
    tooLarge: string;
    /** A string, or a function of the refused type for a text that names it. */
    badType: string | ((type: string) => string);
  };
}

export interface FormOptions extends ParseOptions {
  file: FileRule;
  /**
   * Response when the body cannot be read as a form. Production upload
   * contracts classify malformed multipart as a client error (400).
   */
  unreadable: { status: number; error: string };
  /**
   * The route checked the file's size and type only after a guard (06-09:
   * clubs/logo and clubs/banner check them after the ownership gate, so a
   * non-owner still gets the 403). parseForm then checks presence and the
   * fields only, and the route calls checkFile where the checks sat.
   */
  deferFileChecks?: boolean;
}

/** An uploaded file as the platform's FormData hands it back. */
function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).size === "number" &&
    typeof (value as File).type === "string" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).slice === "function"
  );
}

/**
 * The route's size and type checks on a present file, in the route's order.
 * Exported for a route whose content checks run after a guard (06-09): it
 * calls parseForm for presence and fields, then this where it checked before.
 */
export function checkFile(file: File, rule: FileRule): NextResponse | null {
  for (const check of rule.order ?? (["size", "type"] as const)) {
    if (check === "size" && file.size > rule.maxBytes) {
      return badRequest(rule.messages.tooLarge);
    }
    if (check === "type" && !rule.types.includes(file.type)) {
      const { badType } = rule.messages;
      return badRequest(
        typeof badType === "function" ? badType(file.type) : badType
      );
    }
  }
  return null;
}

/** M0 upload boundary: declared MIME must agree with the bounded file header.
 * This rejects renamed executable/HTML files; it is not a full image decoder.
 */
export async function checkFileContent(file: File): Promise<NextResponse | null> {
  const sniffed = sniffImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  return sniffed && file.type === `image/${sniffed}`
    ? null
    : badRequest("File content does not match its image type");
}

/**
 * Reads a multipart form: the file under `opts.file.field` (missing, or a
 * string where a file belongs, answers the route's missing text), the
 * non-file fields through `schema` (first value per key, as `formData.get`
 * returned it), then the route's size and type checks (unless the route
 * defers them past a guard: `deferFileChecks`). Called after the handler's
 * guards, where `request.formData()` sat.
 */
export async function parseForm<S extends z.ZodType>(
  request: Request,
  schema: S,
  opts: FormOptions
): Promise<Parsed<{ fields: z.output<S>; file: File }>> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: opts.unreadable.error },
        { status: opts.unreadable.status }
      ),
    };
  }

  const file = form.get(opts.file.field);
  if (!isUploadedFile(file)) {
    return { ok: false, response: badRequest(opts.file.messages.missing) };
  }

  const input: Record<string, string> = {};
  for (const key of new Set(form.keys())) {
    if (key === opts.file.field) continue;
    const value = form.get(key);
    if (typeof value === "string") input[key] = value;
  }
  const fields = parseWith(schema, input, opts);
  if (!fields.ok) return fields;

  if (!opts.deferFileChecks) {
    const refused = checkFile(file, opts.file) ?? await checkFileContent(file);
    if (refused) return { ok: false, response: refused };
  }

  return { ok: true, data: { fields: fields.data, file } };
}
