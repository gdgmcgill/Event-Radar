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
 *      `auth/callback` and non-API image-suffixed paths, so those requests arrive with
 *      a client-controlled id; those paths always get a fresh one.
 *   2. Runs the handler inside `runWithRequest({ requestId, route })`, so the
 *      handler's log lines and `createRequestContext()` share that id.
 *   3. Turns an uncaught throw into the seam's JSON 500,
 *      `{ "error": "Failed to <action>" }` (default "process request"), with
 *      one `log.error("unhandled route error")` line. Next's default for an
 *      uncaught throw is an HTML 500; this is the INTENTIONAL change F-058
 *      names, and it lands on a route when that route adopts the wrapper.
 *      After the log line the throw goes to Sentry through
 *      `captureServerError(error, { requestId, route })` (plan 06-16,
 *      REFAC-21): the event is tagged `request_id` with the same id the
 *      response carries as `x-request-id`. With no DSN the capture is a no-op.
 *      Returned 5xx responses are reported too: the last request-local
 *      log.error cause is captured, or a generic action error is logged and
 *      captured when the handler was silent. Successful recovery is not
 *      captured. Next control-flow errors are rethrown to the framework.
 *   4. Applies the handler's cache class (`applyCachePolicy`) and sets
 *      `x-request-id` on the response.
 *
 * THE HANDLER'S TYPE IS PRESERVED
 *   `withRoute<A>` returns `(...args: A) => Promise<Response>`, the handler's
 *   own parameter list, so Next's route-export type check still sees
 *   `(request: NextRequest, context: { params: Promise<…> })`, a zero-argument
 *   handler stays zero-argument, and tests keep calling `GET(request, { params })`.
 *   A handler that answers only `NextResponse`s keeps `Promise<NextResponse>`
 *   (plan 06-14: the auth callback's suites read `res.cookies`): every path
 *   then yields a NextResponse, since the wrapper's own 500 is `serverError`'s
 *   NextResponse and a NextResponse's headers are always settable, so
 *   `withMutableHeaders` returns it unchanged.
 */

import type { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { currentRequestError, log, runWithRequest } from "./log";
import { serverError } from "./errors";
import { applyCachePolicy, type CacheClass } from "./http";
import { captureServerError } from "./observability/sentry";

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

/** The proxy matcher excludes these paths; their incoming ids are untrusted. */
const PROXY_EXCLUDED_PATH = /^\/(?:_next\/static|_next\/image|favicon\.ico|auth\/callback)|\.(?:svg|png|jpg|jpeg|gif|webp)$/;

/** Trust the incoming UUID only on paths where the proxy replaces it. */
export function requestIdFrom(request: Request | undefined): string {
  if (request && !new URL(request.url).pathname.startsWith("/api/") &&
      PROXY_EXCLUDED_PATH.test(new URL(request.url).pathname)) {
    return crypto.randomUUID();
  }
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

/** Retain a handled failure's original cause; withRoute owns the single capture. */
export function logRouteError(error: unknown): void {
  unstable_rethrow(error);
  log.error("handled route error", { error });
}

export function withRoute<A extends unknown[]>(
  opts: RouteOptions,
  fn: (...args: A) => Promise<NextResponse>
): (...args: A) => Promise<NextResponse>;
export function withRoute<A extends unknown[]>(
  opts: RouteOptions,
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response>;
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
        unstable_rethrow(error);
        log.error("unhandled route error", { error, method });
        response = serverError(opts.action ?? "process request");
      }
      // One capture for every server failure, including locally handled errors.
      // Reuse a logged cause when available; never inspect the response body.
      if (response.status >= 500) {
        let failure = currentRequestError();
        if (!failure) {
          const error = new Error(`Failed to ${opts.action ?? "process request"}`);
          log.error("route returned server error", { error, method, status: response.status });
          failure = { cause: error };
        }
        captureServerError(failure.cause, { requestId, route });
      }
      response = withMutableHeaders(response);
      applyCachePolicy(response, opts.cache, method);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    });
  };
}
