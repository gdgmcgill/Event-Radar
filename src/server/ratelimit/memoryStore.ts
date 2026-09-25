/**
 * The in-process rate-limit store (plan 05-17, DEC-50, REFAC-18).
 *
 * The bucket map lives on `globalThis` under `__uni_verse_mw_rate_limit__`,
 * the same key the limiter has always used, so it survives dev hot reloads
 * and is shared by the synchronous wrapper (`applyApiRateLimit`) and the
 * async path (`MemoryRateLimitStore`). It is correct for one process only;
 * across Vercel instances each has its own map, which is why 05-18 adds a
 * distributed store behind the same `RateLimitStore` interface.
 *
 * The window is fixed and anchored on the first hit: the first hit opens a
 * bucket that resets `windowMs` later, `limit` hits are allowed inside it,
 * and denied hits do not extend it. Expired buckets are pruned on every call.
 */

import type { RateDecision, RateLimitStore } from "./types";

type Bucket = { count: number; resetAt: number };

const STORE_KEY = "__uni_verse_mw_rate_limit__";
type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: Map<string, Bucket>;
};

const g = globalThis as GlobalWithStore;
if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Bucket>();
const buckets = g[STORE_KEY]!;

function pruneExpired(nowMs: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= nowMs) buckets.delete(key);
  }
}

/**
 * Records one hit against `key` at `nowMs` and returns the decision.
 * Synchronous, so `applyApiRateLimit` can stay synchronous.
 */
export function consumeSync(
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number
): RateDecision {
  pruneExpired(nowMs);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    const resetAt = nowMs + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit, resetAtMs: resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, limit, resetAtMs: bucket.resetAt };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, limit, resetAtMs: bucket.resetAt };
}

/**
 * `consumeSync` behind the async store interface. The default clock reads
 * `Date.now()` on every call (not a reference captured at construction), so
 * it and the synchronous wrapper always count on the same clock.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  constructor(private readonly now: () => number = () => Date.now()) {}

  consume(key: string, limit: number, windowMs: number): Promise<RateDecision> {
    return Promise.resolve(consumeSync(key, limit, windowMs, this.now()));
  }
}
