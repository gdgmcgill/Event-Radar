/**
 * Sentry in the browser, on the posture decided before install (DEC-76,
 * REFAC-21, threat T-06-16-01).
 *
 * Phase 06 · plan 06-16.
 *
 * Next runs this file before the app becomes interactive
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md).
 *
 * THE POSTURE
 *   - the DSN is the literal `process.env.NEXT_PUBLIC_SENTRY_DSN`, which Next
 *     inlines at build time (a computed read would not be inlined), checked
 *     with the same rule as the server's (`usableSentryDsn`); absent or
 *     unusable means `enabled: false` and nothing is sent;
 *   - `sendDefaultPii: false`, `tracesSampleRate: 0` (errors only), no
 *     session replay;
 *   - `beforeSend` is the shared field scrubber (cookies, bodies, query
 *     strings, credential headers, emails) with the user REMOVED: the browser
 *     has no hash, and needs none.
 *   It never throws: a failing init leaves the page without error reporting,
 *   never without the page.
 *
 * `onRouterTransitionStart` is Sentry's navigation hook (a no-op when
 * disabled, and when tracing is off it records no spans).
 */

import * as Sentry from "@sentry/nextjs";
import { usableSentryDsn } from "@/lib/env";
import { scrubEventFields } from "@/lib/observability/scrub";

const dsn = usableSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);

try {
  Sentry.init({
    dsn: dsn ?? undefined,
    enabled: dsn !== null,
    sendDefaultPii: false,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    beforeSend(event) {
      scrubEventFields(event);
      delete event.user;
      return event;
    },
  });
} catch {
  // Error reporting is best-effort; the page must still load.
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
