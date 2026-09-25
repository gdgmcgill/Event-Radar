/**
 * The rate limiter's entry point (plan 05-17, DEC-50, REFAC-13, REFAC-18).
 *
 * `src/proxy.ts` calls `applyRateLimit(request, getRateLimitStore())` as its
 * first statement, before the CSRF check and before any session work. It
 * covers every `/api/*` path, `/api/admin/*` included, with the budgets in
 * `./policy.ts`.
 *
 * `getRateLimitStore()` selects the store once per process (plan 05-18,
 * DEC-50 as amended by DEC-59 Part 2): the Upstash store when
 * `upstashConfig()` returns a pair, otherwise the in-process memory store
 * with one logged warning. Production without a pair also gets the memory
 * store (today's behaviour); the boot check in `src/instrumentation.ts` logs
 * that degradation as an error, or refuses to start when
 * `RATE_LIMIT_REQUIRE_DISTRIBUTED` is true. `rateLimitStoreKind()` reports
 * which store was selected.
 */

import type { NextRequest, NextResponse } from "next/server";
import { upstashConfig, upstashConfigProblem } from "@/lib/env";
import { MemoryRateLimitStore } from "./memoryStore";
import { rateLimitPolicy, tooManyRequests } from "./policy";
import type { RateLimitStore } from "./types";
import { UpstashRateLimitStore } from "./upstashStore";

export type { RateDecision, RateLimitStore } from "./types";

const memoryStore = new MemoryRateLimitStore();

export type RateLimitStoreKind = "upstash" | "memory";

let selected: { kind: RateLimitStoreKind; store: RateLimitStore } | undefined;

/**
 * Selection never throws (REVIEW-05 CR-02). An unusable pair (a `rediss://`
 * URL, a `KV_URL` value, anything `@upstash/redis` refuses) or any error the
 * Upstash constructors raise is logged ONCE and the memory store is used for
 * the life of the process: rate limiting fails open, it never answers 500.
 * The log names the problem or the error's class, never its message, because
 * `UrlError`'s message echoes the URL and a `rediss://` URL carries the
 * database password.
 */
function select(): { kind: RateLimitStoreKind; store: RateLimitStore } {
  if (!selected) {
    const config = upstashConfig();
    const problem = config ? upstashConfigProblem(config) : null;
    if (config && problem) {
      console.error(
        `[RateLimit] Upstash configuration unusable (${problem}); using the in-memory store (not shared across instances)`
      );
      selected = { kind: "memory", store: memoryStore };
    } else if (config) {
      try {
        selected = {
          kind: "upstash",
          store: new UpstashRateLimitStore(config),
        };
      } catch (err) {
        console.error(
          "[RateLimit] Upstash store construction failed; using the in-memory store (not shared across instances)",
          { error: err instanceof Error ? err.name : typeof err }
        );
        selected = { kind: "memory", store: memoryStore };
      }
    } else {
      console.warn(
        "[RateLimit] Upstash not configured; using the in-memory store (not shared across instances)"
      );
      selected = { kind: "memory", store: memoryStore };
    }
  }
  return selected;
}

/** The store the proxy counts against, chosen on first call and kept. */
export function getRateLimitStore(): RateLimitStore {
  return select().store;
}

/** Which store `getRateLimitStore()` returns, for health reporting. */
export function rateLimitStoreKind(): RateLimitStoreKind {
  return select().kind;
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
