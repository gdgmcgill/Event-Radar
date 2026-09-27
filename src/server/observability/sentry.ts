/**
 * Sentry on the server: the scrubbing `beforeSend`, the user-id hash, and the
 * capture call the route wrapper and the proxy make (REFAC-21, DEC-76,
 * threats T-06-16-01 and T-06-16-02).
 *
 * Phase 06 · plan 06-16.
 *
 * `scrubEvent` is the server's `beforeSend` (src/sentry.server.config.ts): the
 * shared field scrubber (src/lib/observability/scrub.ts) plus the user
 * reduced to `{ id: <hex SHA-256 of the id> }`, or removed when there is no
 * id. The hash is synchronous (`node:crypto`), so `beforeSend` never awaits.
 *
 * `captureServerError(error, { requestId, route })` captures inside a scope
 * tagged `request_id` (the same id the response carries as `x-request-id`)
 * and `route` (the pathname with UUID identifiers normalized and no query).
 * It is called for every server-failure response from `withRoute` (src/server/route.ts) and of the proxy's ring
 * (src/proxy.ts), after their log line. With Sentry disabled (no DSN) the
 * SDK's capture is a no-op. It never throws: a failure to report an error
 * must not change the response the caller is building.
 *
 * NODE RUNTIME ONLY (`node:crypto`). The browser uses the shared scrubber
 * directly and removes the user.
 */

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEventFields, scrubRoutePath } from "@/lib/observability/scrub";

/** The hex SHA-256 of a user id: stable per user, not reversible to the id. */
export function hashUserId(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

/**
 * The server's `beforeSend`: scrubs the event's fields (cookies, body, query
 * string, credential and address headers, emails) and keeps only a hash of
 * the user id. Mutates and returns the event.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  scrubEventFields(event);
  const id = event.user?.id;
  if (id !== undefined && id !== null && String(id) !== "") {
    event.user = { id: hashUserId(String(id)) };
  } else {
    delete event.user;
  }
  return event;
}

export type CaptureContext = {
  /** The request's correlation id; the tag is omitted when unknown. */
  requestId?: string;
  /** The request's pathname. */
  route?: string;
};

/** Captures `error` tagged with the request id and route. Never throws. */
export function captureServerError(error: unknown, { requestId, route }: CaptureContext): void {
  try {
    Sentry.withScope((scope) => {
      if (requestId) scope.setTag("request_id", requestId);
      if (route) scope.setTag("route", scrubRoutePath(route));
      Sentry.captureException(error);
    });
  } catch {
    // Reporting is best-effort; the caller's 500 is already decided.
  }
}
