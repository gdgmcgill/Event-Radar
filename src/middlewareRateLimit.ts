import type { NextRequest, NextResponse } from "next/server";
import { consumeSync } from "@/server/ratelimit/memoryStore";
import { rateLimitPolicy, tooManyRequests } from "@/server/ratelimit/policy";

// ---------------------------------------------------------------------------
// In-memory rate-limit store (survives hot-reloads via globalThis)
// Works for single-process deployments; for multi-region Edge deployments
// replace with a distributed store (e.g. Vercel KV / Upstash Redis).
// ---------------------------------------------------------------------------
//
// Since plan 05-17 (DEC-50) this module is a thin synchronous wrapper. The
// budgets, the client-address rule and the 429 live once in
// `src/server/ratelimit/policy.ts`; the globalThis bucket map and its
// fixed-window counting live in `src/server/ratelimit/memoryStore.ts`. The
// proxy calls the async `applyRateLimit(req, store)` from
// `src/server/ratelimit/index.ts`, which also budgets `/api/admin/*`. This
// function keeps its synchronous, public-only contract for its PRESERVE
// suite (`src/middlewareRateLimit.test.ts`, research Pitfall 5).

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Applies rate limiting to public API routes at the middleware level.
 *
 * Rules:
 *  - Only paths under /api/** are rate-limited.
 *  - Paths under /api/admin/** are excluded here; their own budget is applied
 *    by the async `applyRateLimit` the proxy calls.
 *  - GET, mutating and high-frequency analytics budgets (per minute, per IP,
 *    per path) are `PUBLIC_BUDGETS` in src/server/ratelimit/policy.ts.
 *  - Responses beyond the limit receive HTTP 429 with a Retry-After header.
 *
 * Returns a NextResponse if the request should be blocked, otherwise null.
 */
export function applyApiRateLimit(req: NextRequest): NextResponse | null {
  const rule = rateLimitPolicy(req);

  // Only /api/* routes, and not the admin prefix.
  if (!rule || rule.scope !== "public") return null;

  const now = Date.now();
  const decision = consumeSync(rule.key, rule.limit, rule.windowMs, now);
  if (decision.allowed) return null;

  return tooManyRequests(decision.limit, decision.resetAtMs, now);
}
