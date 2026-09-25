/**
 * Post-response work that the platform keeps alive (REVIEW-05 iter3 WR-06).
 *
 * A promise a route handler starts and does not await can be frozen or
 * reclaimed on Vercel once the response is sent, so the work may never run
 * and nothing is logged. `after()` from `next/server` schedules it with the
 * platform instead: it runs after the response, within the route's max
 * duration (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md).
 *
 * `after()` throws E468 ("called outside a request scope") when there is no
 * request scope, which is the case when a unit test calls a handler
 * directly. Only then is the task run detached, exactly as it ran before
 * this helper existed. Any other error from `after()` is rethrown.
 */

import { after } from "next/server";

/** Next's error code for `after()` called outside a request scope. */
const OUTSIDE_REQUEST_SCOPE = "E468";

function isOutsideRequestScope(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE ===
      OUTSIDE_REQUEST_SCOPE
  );
}

/**
 * Runs `task` after the response is sent. The task must handle its own
 * errors: a rejection is logged here, never thrown into the handler.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[afterResponse] task failed:", error);
    }
  };
  try {
    after(guarded);
  } catch (error) {
    if (!isOutsideRequestScope(error)) throw error;
    void guarded();
  }
}
