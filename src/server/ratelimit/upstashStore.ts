/**
 * The distributed rate-limit store (plan 05-18, DEC-50, REFAC-18).
 *
 * Counts in Upstash Redis through `@upstash/ratelimit`'s fixed window, so a
 * budget holds across every serverless instance instead of per process.
 * Pinned exactly: `@upstash/ratelimit` 2.0.8 and `@upstash/redis` 1.38.2
 * (DEC-51, DEC-59; registry facts in
 * `.planning/phases/05-.../evidence/upstash-legitimacy.txt`).
 *
 * CONFIGURATION IS EXPLICIT
 *   The Redis client is constructed from the pair `upstashConfig()` validated
 *   (`src/lib/env.ts`), never from the library's own environment lookup, and
 *   with telemetry off.
 *   `analytics: false` keeps `@upstash/core-analytics` from writing anything.
 *
 * AVAILABILITY OVER LIMITING (DEC-50)
 *   Rate limiting is not an authorization control. A store call that takes
 *   longer than 1000 ms resolves as allowed (the library's `timeout`), and a
 *   store call that fails (network, auth, quota) is allowed too. Both are
 *   logged with the key and never with the token. A store outage therefore
 *   slows no request by more than a second and fails none.
 *
 * ONE LIMITER PER BUDGET
 *   The store lives for the module's lifetime (`getRateLimitStore()` builds
 *   it once), and so do its `Ratelimit` instances, one per limit and window.
 *   That keeps the library's ephemeral cache effective: an identifier already
 *   over its budget is refused in-process until its window resets, without a
 *   Redis round trip.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { UpstashConfig } from "@/lib/env";
import type { RateDecision, RateLimitStore } from "./types";

/** Every key this store writes starts with this prefix. */
export const UPSTASH_PREFIX = "uv:rl";

export class UpstashRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;
  private readonly limiters = new Map<string, Ratelimit>();

  constructor({ url, token }: UpstashConfig) {
    this.redis = new Redis({ url, token, enableTelemetry: false });
  }

  private limiterFor(limit: number, windowMs: number): Ratelimit {
    const id = `${limit}:${windowMs}`;
    let limiter = this.limiters.get(id);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
        prefix: UPSTASH_PREFIX,
        timeout: 1000, // ms; then the call resolves as allowed (DEC-50)
        analytics: false,
      });
      this.limiters.set(id, limiter);
    }
    return limiter;
  }

  async consume(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateDecision> {
    try {
      const r = await this.limiterFor(limit, windowMs).limit(key);
      if (r.reason === "timeout") {
        console.error("[RateLimit] store timeout; request allowed", { key });
        return { allowed: true, limit, resetAtMs: Date.now() + windowMs };
      }
      return { allowed: r.success, limit: r.limit, resetAtMs: r.reset };
    } catch (err) {
      console.error("[RateLimit] store error; request allowed", {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return { allowed: true, limit, resetAtMs: Date.now() + windowMs };
    }
  }
}
