/**
 * The seam's success vocabulary.
 *
 * Three shapes, all of which already exist in this tree:
 *   - a plain JSON body at 200      (src/app/api/clubs/[id]/route.ts)
 *   - `{ success: true }` at 200    (src/app/api/clubs/[id]/transfer/route.ts)
 *   - a created resource at 201     (src/app/api/clubs/route.ts)
 *
 * No envelope is added. Handlers that adopt the seam in later phases must emit
 * the same bytes they emit today.
 *
 * The named cache classes (DEC-73, research C7-C9, Pattern 3) live here too.
 * `withRoute` (src/server/route.ts) applies a handler's class to every
 * response it returns, so the header is decided per class rather than per
 * path, and a 401 or a 500 can never be shared by the CDN.
 */

import { NextResponse } from "next/server";

/** 200 with the body echoed unchanged. */
export function ok<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 200 });
}

/** 201 with the created resource echoed unchanged. */
export function created<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 201 });
}

/** 200 `{ success: true }` — the existing acknowledgement for a mutation that
 * returns no resource. */
export function success(): NextResponse {
  return NextResponse.json({ success: true }, { status: 200 });
}

// ─── Cache classes (DEC-73) ──────────────────────────────────────────────────

/**
 * Every cache class a route can declare. `private` is the default for any
 * viewer-dependent or state-changing handler. The three public classes are
 * the values production serves today (research C9): `public-60-300` is the
 * `vercel.json` value eight routes inherit, `public-30-60` is `/api/events`'
 * own, `public-60-120` the two featured routes' own.
 */
export const CACHE_CLASSES = [
  "private",
  "public-60-300",
  "public-30-60",
  "public-60-120",
] as const;

/** A cache class, narrowed to the values `CACHE_CLASSES` admits. */
export type CacheClass = (typeof CACHE_CLASSES)[number];

const PRIVATE_NO_STORE = "private, no-store";

const POLICIES: Record<CacheClass, string> = {
  private: PRIVATE_NO_STORE,
  "public-60-300": "public, s-maxage=60, stale-while-revalidate=300",
  "public-30-60": "public, s-maxage=30, stale-while-revalidate=60",
  "public-60-120": "public, s-maxage=60, stale-while-revalidate=120",
};

/** The `Cache-Control` value a class names, before any method or status rule. */
export function cachePolicy(cls: CacheClass): string {
  return POLICIES[cls];
}

/** Only a successful or not-found read may be shared (Vercel caches 404s). */
const SHAREABLE_METHODS = new Set(["GET", "HEAD"]);
const SHAREABLE_STATUSES = new Set([200, 404]);

/**
 * Sets `Cache-Control` on `response` for its class and returns the same
 * object. A public class applies only to GET or HEAD answering 200 or 404;
 * every other method or status gets `private, no-store`, so a mutation, a
 * 401 or a 500 is never cacheable. Any header the handler set is replaced.
 * Never sets `Vary`: Vercel refuses to cache a response that varies on the
 * cookie, which would silently make a public class uncached.
 */
export function applyCachePolicy<R extends Response>(
  response: R,
  cls: CacheClass,
  method = "GET"
): R {
  const shareable =
    SHAREABLE_METHODS.has(method.toUpperCase()) &&
    SHAREABLE_STATUSES.has(response.status);
  response.headers.set(
    "Cache-Control",
    shareable ? POLICIES[cls] : PRIVATE_NO_STORE
  );
  return response;
}
