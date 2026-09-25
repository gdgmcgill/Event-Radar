/**
 * Rate-limit store selection never throws (REVIEW-05 CR-02).
 *
 * `getRateLimitStore()` is the proxy's first call. Before the fix a malformed
 * Upstash URL made `new Redis()` throw `UrlError` synchronously on every
 * request, so every matched route answered 500. These cases pin the repaired
 * contract: an unusable pair, or any constructor error, is logged once without
 * the URL or token and the in-memory store is used; a usable pair padded with
 * whitespace is trimmed and selects the Upstash store.
 *
 * Placeholder values only; no network call is made (constructing the Upstash
 * client does not connect).
 */

const env = process.env as Record<string, string | undefined>;
const KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

/** A secret-shaped password that must never reach a log line. */
const PASSWORD = "Sup3rS3cretPassw0rd";

let saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = env[key];
    delete env[key];
  }
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.resetModules();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.dontMock("./upstashStore");
});

async function loadIndex(): Promise<typeof import("./index")> {
  return import("./index");
}

function logged(): string {
  return JSON.stringify([...errorSpy.mock.calls, ...warnSpy.mock.calls]);
}

describe("getRateLimitStore() with an unusable Upstash pair", () => {
  it.each([
    [
      "a rediss:// TCP connection string",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      `rediss://default:${PASSWORD}@example-1234.upstash.io:6379`,
    ],
    [
      "the Marketplace's KV_URL value pasted into KV_REST_API_URL",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
      `redis://default:${PASSWORD}@example-1234.upstash.io:6379`,
    ],
    [
      "a plain http:// URL",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "http://example-1234.upstash.io",
    ],
    [
      "a value that does not parse",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "not a url",
    ],
  ])(
    "%s: does not throw, selects the memory store, logs once without the URL",
    async (_label, urlName, tokenName, url) => {
      env[urlName] = url;
      env[tokenName] = "placeholder-token";
      const { getRateLimitStore, rateLimitStoreKind } = await loadIndex();

      expect(() => getRateLimitStore()).not.toThrow();
      expect(rateLimitStoreKind()).toBe("memory");
      getRateLimitStore();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toMatch(/^\[RateLimit\] /);
      expect(logged()).not.toContain(PASSWORD);
      expect(logged()).not.toContain("placeholder-token");
    }
  );

  it("a constructor error is caught, logged by class only, and the memory store is used", async () => {
    jest.doMock("./upstashStore", () => ({
      UpstashRateLimitStore: class {
        constructor() {
          throw new TypeError(`boom https://x:${PASSWORD}@example.upstash.io`);
        }
      },
    }));
    env.UPSTASH_REDIS_REST_URL = "https://example-1234.upstash.io";
    env.UPSTASH_REDIS_REST_TOKEN = "placeholder-token";
    const { getRateLimitStore, rateLimitStoreKind } = await loadIndex();

    expect(() => getRateLimitStore()).not.toThrow();
    expect(rateLimitStoreKind()).toBe("memory");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logged()).toContain("TypeError");
    expect(logged()).not.toContain(PASSWORD);
  });

  it("the memory store it falls back to still counts and refuses over budget", async () => {
    env.UPSTASH_REDIS_REST_URL = "rediss://default:pw@example.upstash.io:6379";
    env.UPSTASH_REDIS_REST_TOKEN = "placeholder-token";
    const { getRateLimitStore } = await loadIndex();
    const store = getRateLimitStore();
    expect((await store.consume("k", 1, 60_000)).allowed).toBe(true);
    expect((await store.consume("k", 1, 60_000)).allowed).toBe(false);
  });
});

describe("getRateLimitStore() with a usable pair padded by whitespace", () => {
  it("a trailing newline and spaces are trimmed and the Upstash store is selected", async () => {
    env.UPSTASH_REDIS_REST_URL = "  https://example-1234.upstash.io\n";
    env.UPSTASH_REDIS_REST_TOKEN = "placeholder-token\n";
    const { getRateLimitStore, rateLimitStoreKind } = await loadIndex();

    expect(() => getRateLimitStore()).not.toThrow();
    expect(rateLimitStoreKind()).toBe("upstash");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
