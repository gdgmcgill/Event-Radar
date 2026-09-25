/**
 * The rate-limit policy: the one place the budgets live (plan 05-17, DEC-50,
 * REFAC-13, REFAC-18).
 *
 * Both entry points read this module: the synchronous public-only wrapper
 * `applyApiRateLimit` (`src/middlewareRateLimit.ts`, kept for its PRESERVE
 * suite) and the async `applyRateLimit(req, store)` the proxy calls
 * (`./index.ts`). A budget changed here changes both, so they cannot drift.
 */

import { NextResponse, type NextRequest } from "next/server";

/** Every budget is per method, per path, per client address, per minute. */
export const WINDOW_MS = 60_000;

/**
 * Public `/api/*` budgets, unchanged from the pre-05-17 limiter.
 *  - GET: the generous read budget.
 *  - mutation: every other method (POST, PUT, PATCH, DELETE, HEAD, OPTIONS).
 *  - highFrequencyMutation: analytics writes, so they cannot consume the
 *    same quota as save, RSVP and follow.
 */
export const PUBLIC_BUDGETS = {
  GET: 300,
  mutation: 30,
  highFrequencyMutation: 300,
} as const;

/** Analytics writes that get `PUBLIC_BUDGETS.highFrequencyMutation`. */
export const HIGH_FREQUENCY_POST_PREFIXES = [
  "/api/interactions",
  "/api/recommendations/feedback",
] as const;

/** Every path under this prefix gets the admin budgets, not the public ones. */
export const ADMIN_PREFIX = "/api/admin";

/**
 * `/api/admin/*` budgets (DEC-50; F-058's rate-limit clause).
 *
 * Before 05-17 the admin prefix was excluded from rate limiting entirely,
 * leaning on the admin guard alone. The guard stops a non-admin; it does not
 * bound a stolen admin session or a runaway script. These budgets do.
 *
 * Why 600 and 120 (2x and 4x the public budgets):
 *  - Moderation pages are client components that fan out GETs, but each load
 *    reaches a given path at most once (the widest, `/moderation/stats`, hits
 *    three distinct paths once each; `evidence/ratelimit.txt` counts every
 *    page). The busiest single key is `/api/admin/events` from the featured
 *    picker's search-as-you-type. 600 a minute is 10 a second on one path,
 *    far above interactive use.
 *  - Moderators batch-approve: one status PATCH per click on the same
 *    `/api/admin/events/[id]/status` path shape, but the key includes the
 *    event id, so each event has its own bucket. 120 a minute on one path
 *    still clears a human clicking through a queue and bounds a script to
 *    two writes a second per path per address.
 */
export const ADMIN_BUDGETS = {
  GET: 600,
  mutation: 120,
} as const;

export type RateLimitScope = "public" | "admin";

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
  scope: RateLimitScope;
};

/**
 * The client address the budget is keyed on.
 *
 * Prefers `x-real-ip`, then the first `x-forwarded-for` hop, then "unknown"
 * (research A5, DEC-50). Vercel sets `x-real-ip` to the connecting client and
 * overwrites a client-supplied `x-forwarded-for` on non-Enterprise plans, so
 * reading `x-real-ip` first keeps the key from being chosen by the caller
 * wherever the platform provides it.
 */
export function clientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

/**
 * The rule for this request, or null when it is not rate limited
 * (anything outside `/api/`).
 */
export function rateLimitPolicy(req: NextRequest): RateLimitRule | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return null;

  const method = req.method.toUpperCase();
  const isGet = method === "GET";

  let scope: RateLimitScope;
  let limit: number;
  if (pathname.startsWith(ADMIN_PREFIX)) {
    scope = "admin";
    limit = isGet ? ADMIN_BUDGETS.GET : ADMIN_BUDGETS.mutation;
  } else {
    scope = "public";
    const isHighFrequencyWrite =
      !isGet &&
      HIGH_FREQUENCY_POST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    limit = isGet
      ? PUBLIC_BUDGETS.GET
      : isHighFrequencyWrite
        ? PUBLIC_BUDGETS.highFrequencyMutation
        : PUBLIC_BUDGETS.mutation;
  }

  // Scoped by path so analytics writes cannot starve RSVP and save endpoints.
  const key = `${method}:${pathname}:${clientIp(req)}`;
  return { key, limit, windowMs: WINDOW_MS, scope };
}

/**
 * The 429, byte-for-byte the response the limiter has always sent: the JSON
 * body with a singular/plural "second", and Retry-After (never below 1),
 * X-RateLimit-Limit, X-RateLimit-Remaining "0" and X-RateLimit-Reset (epoch
 * seconds, rounded up).
 */
export function tooManyRequests(
  limit: number,
  resetAtMs: number,
  nowMs: number
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAtMs / 1000)),
      },
    }
  );
}
