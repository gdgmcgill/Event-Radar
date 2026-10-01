/**
 * Sentry.init for the Node.js server, on the posture decided before install
 * (DEC-76, REFAC-21).
 *
 * Phase 06 · plan 06-16.
 *
 * `register()` in src/instrumentation.ts calls `initSentryServer()` on the
 * Node.js runtime, outside the build phase, before the boot checks. There is
 * no edge config: the proxy runs on Node (DEC-76).
 *
 * THE POSTURE
 *   - `sendDefaultPii: false`, and `beforeSend: scrubEvent`, which deletes
 *     cookies, bodies, query strings and credential headers, redacts emails,
 *     and keeps only a SHA-256 of the user id (the scrubber, not the SDK
 *     default, is the control; see src/lib/observability/scrub.ts);
 *   - `tracesSampleRate: 0`: errors only, no spans on the request path
 *     (research Pitfall 7);
 *   - `environment` from `VERCEL_ENV` ("development" when unset), `release`
 *     from `VERCEL_GIT_COMMIT_SHA`;
 *   - `enabled` only with a usable `SENTRY_DSN` (`sentryDsn()`, which never
 *     throws). Absent or unusable means disabled: init still runs with
 *     `enabled: false` (the SDK installs no integrations then), and ONE info
 *     line says so, with the reason and never the value.
 *
 * `sentryServerOptions()` is exported so the transport proof
 * (src/server/__tests__/sentry.test.ts) initializes the SDK with exactly
 * these options and only its transport substituted.
 */

import * as Sentry from "@sentry/nextjs";
import type { NodeOptions } from "@sentry/nextjs";
import { sentryDsn, sentryDsnProblem } from "@/lib/env";
import { log } from "@/server/log";
import { scrubEvent } from "@/server/observability/sentry";

/** The server's Sentry options for a DSN (null: disabled). Reads the env at call time. */
export function sentryServerOptions(dsn: string | null): NodeOptions {
  return {
    dsn: dsn ?? undefined,
    enabled: dsn !== null,
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}

/**
 * Initializes Sentry on the server. With no usable DSN it initializes the
 * SDK disabled and logs exactly one info line. Never throws: a Sentry
 * failure is logged once as a warning and the server starts without error
 * reporting.
 */
export function initSentryServer(): void {
  try {
    const dsn = sentryDsn();
    Sentry.init(sentryServerOptions(dsn));
    if (dsn === null) {
      log.info("Sentry disabled", { scope: "Sentry", reason: sentryDsnProblem() });
    }
  } catch (error) {
    log.warn("Sentry init failed; continuing without error reporting", {
      scope: "Sentry",
      error,
    });
  }
}
