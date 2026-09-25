/**
 * The live Upstash store contract (plan 05-18, DEC-50, threat T-05-18-05).
 *
 * RUNS ONLY WITH REAL CONFIGURATION. When `upstashConfig()` finds neither
 * UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN nor
 * KV_REST_API_URL/KV_REST_API_TOKEN, the whole suite is `describe.skip` with
 * the reason in its title. Jest then reports its test as skipped (status
 * "pending"), never as passed, and the evidence must say "skipped".
 *
 * Nothing in this repository sets those variables: Jest loads no `.env`,
 * CI defines none of them, and the Playwright webServer blanks all four. To
 * run it deliberately against a disposable store:
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
 *     npx jest src/server/ratelimit/upstash.contract.test.ts
 *
 * With a store, it consumes twice on a fresh random key with a limit of 1:
 * the first hit is allowed, the second is denied with a reset in the future.
 * The key lives under the "uv:rl" prefix and expires with its 60 s window.
 */

import { randomUUID } from "node:crypto";
import { upstashConfig } from "@/lib/env";
import { UpstashRateLimitStore } from "./upstashStore";

const config = upstashConfig();

const describeWithStore = config ? describe : describe.skip;
const title = config
  ? "UpstashRateLimitStore against the configured store"
  : "UpstashRateLimitStore against a live store (SKIPPED: no UPSTASH_REDIS_REST_* or KV_REST_API_* configuration)";

describeWithStore(title, () => {
  it("allows the first hit and denies the second at limit 1", async () => {
    const store = new UpstashRateLimitStore(config ?? { url: "", token: "" });
    const key = `contract:${randomUUID()}`;
    const before = Date.now();

    const first = await store.consume(key, 1, 60_000);
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(1);

    const second = await store.consume(key, 1, 60_000);
    expect(second.allowed).toBe(false);
    expect(second.limit).toBe(1);
    expect(second.resetAtMs).toBeGreaterThan(before);
  }, 10_000);
});
