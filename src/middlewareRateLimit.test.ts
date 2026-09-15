/**
 * Characterization tests for the middleware-level API rate limiter.
 *
 * PRESERVE suite. Phase 2 batch 3 renames `src/middleware.ts` to `src/proxy.ts`
 * in one atomic commit (Next 16 hard-throws if both files coexist, so there is
 * no incremental path and no halfway point to inspect). These expectations are
 * written against today's unmodified `src/middlewareRateLimit.ts` and must pass
 * byte-for-byte identically after that rename. A diff in this file's results is
 * a behaviour change, not a test problem.
 *
 * Tests cover:
 *   - the standard POST budget and its 429 + Retry-After response
 *   - the /api/admin/* bypass
 *   - the high-frequency analytics POST budget
 *   - the non-/api pass-through
 *   - the exact budget boundary (Nth allowed, N+1th blocked)
 *
 * WHY EVERY TEST USES A DISTINCT IP:
 *   The bucket store lives on `globalThis` under `__uni_verse_mw_rate_limit__`
 *   (src/middlewareRateLimit.ts:11-18) and is keyed by `method:pathname:ip`
 *   (line 102). Jest's module-registry isolation is per FILE, not per test, so
 *   the store survives across the tests below. Two tests that share an IP *and*
 *   a path share a bucket, and the second one fails for reasons that have
 *   nothing to do with what it asserts. Give any new test its own IP.
 *   Nothing here mocks time: WINDOW_MS is 60_000 (line 24) and the whole file
 *   runs in milliseconds, so no bucket expires mid-suite.
 *
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/middlewareRateLimit.ts`.
 */

import { NextRequest } from "next/server";
import { applyApiRateLimit } from "./middlewareRateLimit";

// ─── Constants read from the subject, not from the plan ──────────────────────
// Every number below was read out of src/middlewareRateLimit.ts at the line
// named. A planning document can go stale; the source cannot.

/** src/middlewareRateLimit.ts:28 — LIMITS.POST */
const POST_BUDGET = 30;

/** src/middlewareRateLimit.ts:27 — LIMITS.GET */
const GET_BUDGET = 300;

/** src/middlewareRateLimit.ts:94 — the literal branch for high-frequency writes */
const HIGH_FREQUENCY_POST_BUDGET = 300;

/** src/middlewareRateLimit.ts:32 — ADMIN_PREFIX */
const ADMIN_PREFIX = "/api/admin";

/** src/middlewareRateLimit.ts:36-39 — HIGH_FREQUENCY_POST_PREFIXES */
const HIGH_FREQUENCY_POST_PREFIXES = [
  "/api/interactions",
  "/api/recommendations/feedback",
];

// ─── Request helper ──────────────────────────────────────────────────────────

/**
 * Builds a NextRequest whose client address resolves to `ip` through the
 * `x-forwarded-for` header — the same header getIp() reads first
 * (src/middlewareRateLimit.ts:46-49).
 */
function req(path: string, method: string, ip: string): NextRequest {
  return new NextRequest(`https://x.test${path}`, {
    method,
    headers: { "x-forwarded-for": ip },
  });
}

/** Issues `count` identical requests and returns the final result. */
function hammer(
  path: string,
  method: string,
  ip: string,
  count: number
): ReturnType<typeof applyApiRateLimit> {
  let last: ReturnType<typeof applyApiRateLimit> = null;
  for (let i = 0; i < count; i++) last = applyApiRateLimit(req(path, method, ip));
  return last;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("applyApiRateLimit (PRESERVE — must behave identically after the proxy rename)", () => {
  it("returns 429 with a Retry-After header once the POST budget is exceeded", () => {
    const last = hammer("/api/events", "POST", "10.0.0.1", POST_BUDGET + 5);

    expect(last).not.toBeNull();
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBeTruthy();
  });

  it("exempts /api/admin/* from the public budget entirely", () => {
    const last = hammer(
      `${ADMIN_PREFIX}/users`,
      "POST",
      "10.0.0.2",
      POST_BUDGET * 3
    );

    expect(last).toBeNull();
  });

  it.each(HIGH_FREQUENCY_POST_PREFIXES)(
    "gives %s the larger high-frequency write budget",
    (prefix) => {
      const ip = `10.0.1.${HIGH_FREQUENCY_POST_PREFIXES.indexOf(prefix) + 1}`;
      const count = POST_BUDGET + 10;

      expect(count).toBeGreaterThan(POST_BUDGET);
      expect(count).toBeLessThan(HIGH_FREQUENCY_POST_BUDGET);
      expect(hammer(prefix, "POST", ip, count)).toBeNull();
    }
  );

  it.each(["GET", "POST"])(
    "never rate-limits a non-/api path (%s /profile)",
    (method) => {
      const ip = method === "GET" ? "10.0.0.3" : "10.0.0.4";
      const count = Math.max(POST_BUDGET, GET_BUDGET) + 5;

      expect(hammer("/profile", method, ip, count)).toBeNull();
    }
  );

  it("allows exactly POST_BUDGET requests and blocks the next one", () => {
    const ip = "10.0.0.5";
    const path = "/api/events/boundary";

    for (let i = 1; i <= POST_BUDGET; i++) {
      expect(applyApiRateLimit(req(path, "POST", ip))).toBeNull();
    }

    const blocked = applyApiRateLimit(req(path, "POST", ip));
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });
});
