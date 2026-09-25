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
 */

import type { NextResponse } from "next/server";
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
