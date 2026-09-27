/**
 * The Sentry event scrubber shared by the server and the browser (DEC-76,
 * REFAC-21, threat T-06-16-01).
 *
 * Phase 06 · plan 06-16.
 *
 * ISOMORPHIC ON PURPOSE
 *   `src/instrumentation-client.ts` runs this in the browser, so it imports
 *   nothing from Node (no `node:crypto`; the server's user hash lives in
 *   `src/server/observability/sentry.ts`) and only a type from the SDK.
 *
 * WHAT `scrubEventFields` REMOVES, WHATEVER `sendDefaultPii` SAYS
 *   @sentry/nextjs 10.75.3's RequestData integration attaches the request's
 *   body ("data") to an event unconditionally, and cookies, headers and the
 *   query string according to its data-collection options. Next's
 *   `captureRequestError` also records the request path WITH its query string
 *   under `contexts.nextjs.request_path`. So the scrubber, not the SDK
 *   default, is the control:
 *   - `request.cookies`, `request.data`, `request.query_string` and
 *     `request.env` (which can carry the client address) are deleted;
 *   - the query string and fragment are cut from `request.url`,
 *     `contexts.nextjs.request_path` and breadcrumb `data.url/from/to`;
 *   - the `cookie`, `set-cookie`, `authorization` and `proxy-authorization`
 *     request headers, and every client-address header, are deleted in any
 *     case;
 *   - every email-shaped substring anywhere in the event becomes "[email]"
 *     (the message, exception values and breadcrumb messages among them).
 *   `sdkProcessingMetadata` is SDK-internal, never serialized, and left
 *   alone. The user is left to the caller: the server keeps only a hash of
 *   the id, the browser removes it.
 *
 *   The same email pattern as the server logger (`src/server/log.ts`), so a
 *   string redacted in a log line is redacted the same way in an event.
 */

import type { Event } from "@sentry/nextjs";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Request headers that are never sent: credentials and client addresses. */
const DROPPED_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxied-for",
]);

const MAX_DEPTH = 16;

/** Replaces every email-shaped substring with "[email]". */
export function redactEmails(text: string): string {
  return text.replace(EMAIL, "[email]");
}

/** The text before the first "?" or "#": a URL or path without its query. */
function withoutQuery(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Redacts emails in every string reachable through plain objects and arrays, in place. */
function redactDeep(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactEmails(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  if (Array.isArray(value)) {
    seen.add(value);
    for (let i = 0; i < value.length; i += 1) {
      value[i] = redactDeep(value[i], depth + 1, seen);
    }
    return value;
  }
  if (!isPlainObject(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) {
    value[key] = redactDeep(value[key], depth + 1, seen);
  }
  return value;
}

function scrubRequest(request: NonNullable<Event["request"]>): void {
  delete request.cookies;
  delete request.data;
  delete request.query_string;
  delete (request as { env?: unknown }).env;
  if (typeof request.url === "string") request.url = withoutQuery(request.url);
  if (request.headers) {
    for (const name of Object.keys(request.headers)) {
      if (DROPPED_HEADERS.has(name.toLowerCase())) delete request.headers[name];
    }
  }
}

function scrubBreadcrumbData(data: Record<string, unknown>): void {
  for (const key of ["url", "from", "to"]) {
    const value = data[key];
    if (typeof value === "string") data[key] = withoutQuery(value);
  }
}

/**
 * Scrubs a Sentry event in place and returns it (see the module comment for
 * the list). Never throws on a well-formed event; the user is untouched.
 */
export function scrubEventFields<T extends Event>(event: T): T {
  if (event.request) scrubRequest(event.request);

  const nextjs = event.contexts?.nextjs as Record<string, unknown> | undefined;
  if (nextjs && typeof nextjs.request_path === "string") {
    nextjs.request_path = withoutQuery(nextjs.request_path);
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (isPlainObject(breadcrumb.data)) scrubBreadcrumbData(breadcrumb.data);
  }

  const seen = new WeakSet<object>();
  const record = event as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "sdkProcessingMetadata") continue;
    record[key] = redactDeep(record[key], 0, seen);
  }
  return event;
}
