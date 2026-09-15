/**
 * The seam's error vocabulary.
 *
 * Every helper here emits a response that is byte-identical to what handlers
 * under src/app/** already return. The status vocabulary in use is 400 for
 * validation (optionally carrying `field`), 401 "Unauthorized", 403, 404, and
 * 500 with the generic "Failed to <action>" body. Nothing new is invented: a
 * seam that changes the wire format is a behaviour change wearing a refactor's
 * clothes, and behaviour preservation is this program's core value.
 *
 * Errors are RETURNED, never thrown, matching the repo's existing convention.
 */

import { NextResponse } from "next/server";

/**
 * 400 Validation failure.
 *
 * @param message - The human-readable reason.
 * @param field   - The offending request field, when one can be named. Omitted
 *                  from the body entirely when absent, rather than serialized
 *                  as `undefined`.
 */
export function badRequest(message: string, field?: string): NextResponse {
  return NextResponse.json(
    field === undefined ? { error: message } : { error: message, field },
    { status: 400 }
  );
}

/**
 * 401 Not authenticated. The default message is the exact string every
 * existing handler emits.
 */
export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** 403 Authenticated, but not permitted. */
export function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** 404 The addressed resource does not exist, or is not visible to the caller. */
export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * 500 Unexpected failure.
 *
 * @param action - The verb phrase the handler was attempting, e.g. "fetch
 *                 club". The body is always the generic "Failed to <action>"
 *                 form so the underlying cause is logged but never returned.
 */
export function serverError(action: string): NextResponse {
  return NextResponse.json(
    { error: `Failed to ${action}` },
    { status: 500 }
  );
}
