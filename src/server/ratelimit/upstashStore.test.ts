/**
 * The Upstash rate-limit store and the store selection (plan 05-18, DEC-50,
 * DEC-59 Part 2, REFAC-18).
 *
 * Both Upstash packages are mocked: nothing here reaches a network. The live
 * store is exercised only by `upstash.contract.test.ts`, which is skipped
 * without real configuration.
 *
 * What this suite proves:
 *   - the Redis client is built once, explicitly, from the given pair with
 *     `enableTelemetry: false`, and `Redis.fromEnv()` is never called;
 *   - each budget gets one `Ratelimit` instance (module-lifetime, so the
 *     ephemeral cache works), built with `fixedWindow(limit, window)`,
 *     `prefix: "uv:rl"`, `timeout: 1000` and `analytics: false`;
 *   - `limit()`'s success/limit/reset map to allowed/limit/resetAtMs;
 *   - a store timeout allows the request and logs
 *     "[RateLimit] store timeout; request allowed" with the key; a store
 *     error also allows it and logs "[RateLimit] store error; request
 *     allowed" (availability over limiting, DEC-50);
 *   - `getRateLimitStore()` selects the Upstash store when a pair is
 *     configured and the memory store otherwise, warning once, production
 *     included (DEC-59 Part 2: production degrades, the boot check logs the
 *     error).
 */

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
  reason?: "timeout" | "cacheBlock" | "denyList";
};

const mockLimit = jest.fn<Promise<LimitResult>, [string]>();
const mockRatelimitCtor = jest.fn();
const mockFixedWindow = jest.fn((tokens: number, window: string) => ({
  algorithm: "fixedWindow",
  tokens,
  window,
}));
const mockRedisCtor = jest.fn();
const mockFromEnv = jest.fn();

jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow(tokens: number, window: string) {
      return mockFixedWindow(tokens, window);
    }
    constructor(config: unknown) {
      mockRatelimitCtor(config);
    }
    limit(identifier: string) {
      return mockLimit(identifier);
    }
  },
}));

jest.mock("@upstash/redis", () => ({
  Redis: class {
    static fromEnv(...args: unknown[]) {
      return mockFromEnv(...args);
    }
    constructor(config: unknown) {
      mockRedisCtor(config);
    }
  },
}));

import { UpstashRateLimitStore } from "./upstashStore";

const CONFIG = { url: "https://unit.example.upstash.io", token: "unit-token" };
const WINDOW_MS = 60_000;

function result(overrides: Partial<LimitResult>): LimitResult {
  return {
    success: true,
    limit: 30,
    remaining: 29,
    reset: 1_700_000_060_000,
    pending: Promise.resolve(),
    ...overrides,
  };
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  mockLimit.mockReset();
  mockRatelimitCtor.mockClear();
  mockFixedWindow.mockClear();
  mockRedisCtor.mockClear();
  mockFromEnv.mockClear();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("UpstashRateLimitStore construction", () => {
  it("builds one Redis client from the pair with telemetry off, and never calls fromEnv", () => {
    new UpstashRateLimitStore(CONFIG);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: CONFIG.url,
      token: CONFIG.token,
      enableTelemetry: false,
    });
    expect(mockFromEnv).not.toHaveBeenCalled();
  });

  it("builds no Ratelimit until the first consume", () => {
    new UpstashRateLimitStore(CONFIG);
    expect(mockRatelimitCtor).not.toHaveBeenCalled();
  });
});

describe("UpstashRateLimitStore.consume", () => {
  it("maps an allowed limit() to { allowed: true, limit, resetAtMs: reset }", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockResolvedValueOnce(
      result({ success: true, limit: 30, reset: 111 })
    );
    await expect(
      store.consume("POST:/api/a:10.0.0.1", 30, WINDOW_MS)
    ).resolves.toEqual({
      allowed: true,
      limit: 30,
      resetAtMs: 111,
    });
    expect(mockLimit).toHaveBeenCalledWith("POST:/api/a:10.0.0.1");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("maps a denied limit() to { allowed: false, limit, resetAtMs: reset }", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockResolvedValueOnce(
      result({ success: false, limit: 30, remaining: 0, reset: 222 })
    );
    await expect(
      store.consume("POST:/api/a:10.0.0.2", 30, WINDOW_MS)
    ).resolves.toEqual({
      allowed: false,
      limit: 30,
      resetAtMs: 222,
    });
  });

  it("maps an ephemeral-cache block (reason cacheBlock) as a denial", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockResolvedValueOnce(
      result({
        success: false,
        limit: 30,
        remaining: 0,
        reset: 333,
        reason: "cacheBlock",
      })
    );
    await expect(store.consume("k", 30, WINDOW_MS)).resolves.toEqual({
      allowed: false,
      limit: 30,
      resetAtMs: 333,
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("builds the limiter with fixedWindow, prefix uv:rl, timeout 1000 and analytics off", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockResolvedValue(result({}));
    await store.consume("k", 30, WINDOW_MS);
    expect(mockFixedWindow).toHaveBeenCalledWith(30, "60000 ms");
    expect(mockRatelimitCtor).toHaveBeenCalledTimes(1);
    const config = mockRatelimitCtor.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(config).toEqual({
      redis: expect.any(Object),
      limiter: { algorithm: "fixedWindow", tokens: 30, window: "60000 ms" },
      prefix: "uv:rl",
      timeout: 1000,
      analytics: false,
    });
  });

  it("reuses one Ratelimit per budget and shares the one Redis client", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockResolvedValue(result({}));
    await store.consume("a", 30, WINDOW_MS);
    await store.consume("b", 30, WINDOW_MS);
    await store.consume("c", 300, WINDOW_MS);
    await store.consume("d", 300, WINDOW_MS);
    await store.consume("e", 30, WINDOW_MS);
    expect(mockRatelimitCtor).toHaveBeenCalledTimes(2);
    expect(mockFixedWindow.mock.calls).toEqual([
      [30, "60000 ms"],
      [300, "60000 ms"],
    ]);
    const [first, second] = mockRatelimitCtor.mock.calls.map(
      (call) => (call[0] as { redis: unknown }).redis
    );
    expect(first).toBe(second);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
  });

  it("a timeout allows the request and logs the timeout line with the key", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(5_000_000);
    const store = new UpstashRateLimitStore(CONFIG);
    // What @upstash/ratelimit resolves when its timeout wins the race.
    mockLimit.mockResolvedValueOnce(
      result({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
        reason: "timeout",
      })
    );
    await expect(
      store.consume("GET:/api/events:10.0.0.3", 300, WINDOW_MS)
    ).resolves.toEqual({
      allowed: true,
      limit: 300,
      resetAtMs: 5_000_000 + WINDOW_MS,
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[RateLimit] store timeout; request allowed",
      {
        key: "GET:/api/events:10.0.0.3",
      }
    );
    nowSpy.mockRestore();
  });

  it("a store error allows the request and logs the error message, never throwing", async () => {
    const store = new UpstashRateLimitStore(CONFIG);
    mockLimit.mockRejectedValueOnce(new Error("fetch failed"));
    const decision = await store.consume("POST:/api/x:10.0.0.4", 30, WINDOW_MS);
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(30);
    expect(errorSpy).toHaveBeenCalledWith(
      "[RateLimit] store error; request allowed",
      {
        key: "POST:/api/x:10.0.0.4",
        error: "fetch failed",
      }
    );
  });
});

// ─── Store selection ─────────────────────────────────────────────────────────

describe("getRateLimitStore() selection", () => {
  const MANAGED = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "VERCEL_ENV",
  ] as const;
  const env = process.env as Record<string, string | undefined>;
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const key of MANAGED) {
      saved[key] = env[key];
      delete env[key];
    }
    jest.resetModules();
  });

  afterEach(() => {
    for (const key of MANAGED) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  });

  function load(): {
    index: typeof import("./index");
    upstash: typeof import("./upstashStore");
    memory: typeof import("./memoryStore");
  } {
    return {
      index: require("./index") as typeof import("./index"),
      upstash: require("./upstashStore") as typeof import("./upstashStore"),
      memory: require("./memoryStore") as typeof import("./memoryStore"),
    };
  }

  const MEMORY_WARNING =
    "[RateLimit] Upstash not configured; using the in-memory store (not shared across instances)";

  it("configured: returns one UpstashRateLimitStore built from the pair, and warns nothing", () => {
    env.UPSTASH_REDIS_REST_URL = CONFIG.url;
    env.UPSTASH_REDIS_REST_TOKEN = CONFIG.token;
    const { index, upstash } = load();
    const store = index.getRateLimitStore();
    expect(store).toBeInstanceOf(upstash.UpstashRateLimitStore);
    expect(index.getRateLimitStore()).toBe(store);
    expect(index.rateLimitStoreKind()).toBe("upstash");
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: CONFIG.url,
      token: CONFIG.token,
      enableTelemetry: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("configured through the Marketplace KV names: returns the Upstash store", () => {
    env.KV_REST_API_URL = "https://kv.example.upstash.io";
    env.KV_REST_API_TOKEN = "kv-token";
    const { index, upstash } = load();
    expect(index.getRateLimitStore()).toBeInstanceOf(
      upstash.UpstashRateLimitStore
    );
  });

  it("unconfigured: returns the memory store and warns exactly once across calls", () => {
    const { index, memory } = load();
    const store = index.getRateLimitStore();
    index.getRateLimitStore();
    index.getRateLimitStore();
    expect(store).toBeInstanceOf(memory.MemoryRateLimitStore);
    expect(index.getRateLimitStore()).toBe(store);
    expect(index.rateLimitStoreKind()).toBe("memory");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(MEMORY_WARNING);
    expect(mockRedisCtor).not.toHaveBeenCalled();
  });

  // INTENTIONAL (DEC-59 Part 2): production without a store serves from the
  // memory store; the boot check (src/instrumentation.ts) logs the error.
  it('unconfigured with VERCEL_ENV "production": returns the memory store, warns once, never throws', () => {
    env.VERCEL_ENV = "production";
    const { index, memory } = load();
    expect(() => index.getRateLimitStore()).not.toThrow();
    expect(index.getRateLimitStore()).toBeInstanceOf(
      memory.MemoryRateLimitStore
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(mockRedisCtor).not.toHaveBeenCalled();
  });

  it("the Upstash store plugs into applyRateLimit: a denial becomes the existing 429", async () => {
    env.UPSTASH_REDIS_REST_URL = CONFIG.url;
    env.UPSTASH_REDIS_REST_TOKEN = CONFIG.token;
    const { index } = load();
    const { NextRequest } =
      require("next/server") as typeof import("next/server");
    mockLimit.mockResolvedValueOnce(
      result({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 30_000,
      })
    );
    const req = new NextRequest("http://localhost/api/events/x/save", {
      method: "POST",
      headers: { "x-real-ip": "10.9.9.9" },
    });
    const res = await index.applyRateLimit(req, index.getRateLimitStore());
    expect(res?.status).toBe(429);
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(mockLimit).toHaveBeenCalledWith("POST:/api/events/x/save:10.9.9.9");
  });
});
