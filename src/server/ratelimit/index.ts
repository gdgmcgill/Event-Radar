/**
 * The rate limiter's entry point (plan 05-17, DEC-50, REFAC-13, REFAC-18).
 *
 * `src/proxy.ts` calls `applyRateLimit(request, getRateLimitStore())` as its
 * first statement, before the CSRF check and before any session work. It
 * covers every `/api/*` path, `/api/admin/*` included, with the budgets in
 * `./policy.ts`.
 *
 * `getRateLimitStore()` returns the module-level in-process store today.
 * 05-18 adds the distributed store's selection here; nothing else changes.
 */

import type { NextRequest, NextResponse } from "next/server";
import { MemoryRateLimitStore } from "./memoryStore";
import { rateLimitPolicy, tooManyRequests } from "./policy";
import type { RateLimitStore } from "./types";

export type { RateDecision, RateLimitStore } from "./types";

const memoryStore = new MemoryRateLimitStore();

/** The store the proxy counts against. */
export function getRateLimitStore(): RateLimitStore {
  return memoryStore;
}

/**
 * Returns the 429 when this request is over its budget, otherwise null.
 * Requests outside `/api/` never reach the store.
 */
export async function applyRateLimit(
  req: NextRequest,
  store: RateLimitStore
): Promise<NextResponse | null> {
  const rule = rateLimitPolicy(req);
  if (!rule) return null;

  const decision = await store.consume(rule.key, rule.limit, rule.windowMs);
  if (decision.allowed) return null;

  return tooManyRequests(decision.limit, decision.resetAtMs, Date.now());
}
