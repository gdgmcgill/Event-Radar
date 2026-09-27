/**
 * `withRoute` — the one wrapper every route handler will wear (DEC-73,
 * DEC-74, F-058, REFAC-19, REFAC-20).
 *
 * Phase 06 · plan 06-12. Adopted route by route in 06-13 and 06-14; until
 * then `src/__tests__/api/cache-headers-census.test.ts` lists every route file
 * as PENDING_WRAP.
 *
 *   export const GET = withRoute({ cache: "private" }, async (request, ctx) => …);
 *
 * WHAT IT DOES, ON EVERY RETURN PATH
 *   1. Takes the request id from the incoming `x-request-id` when it is
 *      UUID-shaped (the proxy overwrites any client value, so a well-formed id
 *      here is the proxy's own), otherwise mints one. The matcher skips
 *      `auth/callback` and image-suffixed paths, so those requests arrive with
 *      no id and get a fresh one.
 *   2. Runs the handler inside `runWithRequest({ requestId, route })`, so the
 *      handler's log lines and `createRequestContext()` share that id.
 *   3. Turns an uncaught throw into the seam's JSON 500,
 *      `{ "error": "Failed to <action>" }` (default "process request"), with
 *      one `log.error("unhandled route error")` line. Next's default for an
 *      uncaught throw is an HTML 500; this is the INTENTIONAL change F-058
 *      names, and it lands on a route when that route adopts the wrapper.
 *   4. Applies the handler's cache class (`applyCachePolicy`) and sets
 *      `x-request-id` on the response.
 *
 * THE HANDLER'S TYPE IS PRESERVED
 *   `withRoute<A>` returns `(...args: A) => Promise<Response>`, the handler's
 *   own parameter list, so Next's route-export type check still sees
 *   `(request: NextRequest, context: { params: Promise<…> })`, a zero-argument
 *   handler stays zero-argument, and tests keep calling `GET(request, { params })`.
 */

import { log, runWithRequest } from "./log";
import { serverError } from "./errors";
import { applyCachePolicy, type CacheClass } from "./http";

export type RouteOptions = {
  /** The handler's cache class; applied to every response it returns. */
  cache: CacheClass;
  /** The verb phrase for the uncaught-throw 500: "Failed to <action>". */
  action?: string;
};

/** The request header the proxy stamps and the wrapper echoes. */
export const REQUEST_ID_HEADER = "x-request-id";

/** A canonical 8-4-4-4-12 hex UUID and nothing else (no suffix, no newline). */
const REQUEST_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id to carry: the incoming one when it is UUID-shaped, else a new one. */
export function requestIdFrom(request: Request | undefined): string {
  const incoming = request?.headers.get(REQUEST_ID_HEADER) ?? "";
  return REQUEST_ID_SHAPE.test(incoming) ? incoming : crypto.randomUUID();
}

/**
 * A response whose headers can be set. `Response.redirect()` and fetched
 * responses have immutable headers; those are re-wrapped with the same
 * status, status text, headers and body.
 */
function withMutableHeaders(response: Response): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, response.headers.get(REQUEST_ID_HEADER) ?? "");
    return response;
  } catch {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  }
}

export function withRoute<A extends unknown[]>(
  opts: RouteOptions,
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : undefined;
    const requestId = requestIdFrom(request);
    const method = request?.method ?? "GET";
    const route = request ? new URL(request.url).pathname : undefined;

    return runWithRequest({ requestId, route }, async () => {
      let response: Response;
      try {
        response = await fn(...args);
      } catch (error) {
        log.error("unhandled route error", { error, method });
        response = serverError(opts.action ?? "process request");
      }
      response = withMutableHeaders(response);
      applyCachePolicy(response, opts.cache, method);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    });
  };
}
