import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// In-memory rate-limit store (survives hot-reloads via globalThis)
// Works for single-process deployments; for multi-region Edge deployments
// replace with a distributed store (e.g. Vercel KV / Upstash Redis).
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

const STORE_KEY = "__uni_verse_mw_rate_limit__";
type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: Map<string, Bucket>;
};

const g = globalThis as GlobalWithStore;
if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Bucket>();
const store = g[STORE_KEY]!;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000; // 1 minute

const LIMITS: Record<string, number> = {
  GET: 300,
  POST: 30,
};

// Paths that bypass public rate limits
const ADMIN_PREFIX = "/api/admin";

// High-frequency analytics endpoints should not consume the same POST quota
// as user-facing mutations (save/RSVP/follow/etc.).
const HIGH_FREQUENCY_POST_PREFIXES = [
  "/api/interactions",
  "/api/recommendations/feedback",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Applies rate limiting to public API routes at the middleware level.
 *
 * Rules:
 *  - Only paths under /api/** are rate-limited.
 *  - Paths under /api/admin/** are excluded (admin has its own auth layer).
 *  - GET requests: 300 req / min / IP / path
 *  - Mutating methods: 30 req / min / IP / path
 *  - High-frequency analytics writes (/api/interactions, /api/recommendations/feedback):
 *    300 req / min / IP / path
 *  - Responses beyond the limit receive HTTP 429 with a Retry-After header.
 *
 * Returns a NextResponse if the request should be blocked, otherwise null.
 */
export function applyApiRateLimit(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;

  // Only apply to /api/* routes
  if (!pathname.startsWith("/api/")) return null;

  // Exclude admin endpoints
  if (pathname.startsWith(ADMIN_PREFIX)) return null;

  const method = req.method.toUpperCase();
  // GET gets the generous limit; everything else (POST, PUT, PATCH, DELETE…) gets the strict limit.
  // For high-frequency analytics routes, use a larger write budget.
  const isHighFrequencyPostRoute =
    method !== "GET" &&
    HIGH_FREQUENCY_POST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const limit = isHighFrequencyPostRoute
    ? 300
    : (LIMITS[method] ?? LIMITS.POST);

  const now = Date.now();
  pruneExpired(now);

  const ip = getIp(req);
  // Scope bucket by path so analytics writes can't starve RSVP/save endpoints.
  const key = `${method}:${pathname}:${ip}`;
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null; // allowed
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
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
          "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
        },
      }
    );
  }

  bucket.count += 1;
  store.set(key, bucket);
  return null; // allowed
}
