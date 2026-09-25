/**
 * Unit tests for src/lib/env.ts — the lazy validated configuration readers
 * (DEC-37, REFAC-11's non-null-assertion clause, F-003 config half).
 *
 * The contract under test:
 *   - importing the module with every Supabase and Upstash variable unset
 *     does not throw (research C8: CI's build has no service key, and
 *     src/proxy.test.ts imports the proxy with no env);
 *   - each reader throws MissingEnvError naming its variable at first read
 *     when the variable is unset or whitespace only, and returns the value
 *     when it is set;
 *   - "production" is VERCEL_ENV === "production", never NODE_ENV;
 *   - upstashConfig() returns one complete pair (UPSTASH_REDIS_REST_* first,
 *     then the Marketplace's KV_REST_API_*) or null, and never throws, even
 *     in production (DEC-59 Part 2: the boot check decides, not the reader);
 *   - rateLimitRequireDistributed() is optional: absent means false, and a
 *     value other than "true"/"false" is rejected rather than read as false.
 *
 * Each case sets and deletes process.env keys itself and the originals are
 * restored after every test.
 */

// A module, not a script: without this its top-level names would share the
// global scope with every other import-free test file under tsc.
export {};

const MANAGED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "RATE_LIMIT_REQUIRE_DISTRIBUTED",
  "VERCEL_ENV",
  "NODE_ENV",
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

const env = process.env as Record<string, string | undefined>;
let saved: Partial<Record<ManagedKey, string | undefined>> = {};

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) saved[key] = env[key];
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  jest.resetModules();
});

function unsetAll(): void {
  for (const key of MANAGED_KEYS) {
    if (key !== "NODE_ENV") delete env[key];
  }
}

async function loadEnv(): Promise<typeof import("./env")> {
  jest.resetModules();
  return import("./env");
}

describe("src/lib/env.ts — import is side-effect free", () => {
  it("importing with every Supabase and Upstash variable unset does not throw", async () => {
    unsetAll();
    await expect(loadEnv()).resolves.toBeDefined();
  });
});

describe("MissingEnvError", () => {
  it("has name MissingEnvError, is an Error, and names the variable", async () => {
    const { MissingEnvError } = await loadEnv();
    const err = new MissingEnvError("SOME_VAR");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MissingEnvError);
    expect(err.name).toBe("MissingEnvError");
    expect(err.message).toBe("Missing required environment variable: SOME_VAR");
  });
});

describe("requireEnvValue", () => {
  it("returns the value when set", async () => {
    const { requireEnvValue } = await loadEnv();
    expect(requireEnvValue("X", "value")).toBe("value");
  });

  it("throws MissingEnvError naming the variable when undefined", async () => {
    const { requireEnvValue, MissingEnvError } = await loadEnv();
    expect(() => requireEnvValue("X_UNSET", undefined)).toThrow(MissingEnvError);
    expect(() => requireEnvValue("X_UNSET", undefined)).toThrow(
      "Missing required environment variable: X_UNSET"
    );
  });

  it("throws on the empty string and on whitespace only", async () => {
    const { requireEnvValue, MissingEnvError } = await loadEnv();
    expect(() => requireEnvValue("X_EMPTY", "")).toThrow(MissingEnvError);
    expect(() => requireEnvValue("X_BLANK", "  \t\n")).toThrow(
      "Missing required environment variable: X_BLANK"
    );
  });
});

describe.each([
  ["supabaseUrl", "NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"],
  ["supabaseAnonKey", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-value"],
] as const)("%s()", (reader, variable, value) => {
  it(`returns ${variable} when set`, async () => {
    unsetAll();
    env[variable] = value;
    const mod = await loadEnv();
    expect(mod[reader]()).toBe(value);
  });

  it(`throws MissingEnvError naming ${variable} when unset`, async () => {
    unsetAll();
    const mod = await loadEnv();
    expect(() => mod[reader]()).toThrow(mod.MissingEnvError);
    expect(() => mod[reader]()).toThrow(
      `Missing required environment variable: ${variable}`
    );
  });

  it(`throws MissingEnvError naming ${variable} when whitespace only`, async () => {
    unsetAll();
    env[variable] = "   ";
    const mod = await loadEnv();
    expect(() => mod[reader]()).toThrow(
      `Missing required environment variable: ${variable}`
    );
  });

  it(`reads ${variable} at call time, not at import time`, async () => {
    unsetAll();
    const mod = await loadEnv();
    env[variable] = value;
    expect(mod[reader]()).toBe(value);
  });
});

describe("isVercelProduction()", () => {
  it('is true only when VERCEL_ENV is "production"', async () => {
    unsetAll();
    env.VERCEL_ENV = "production";
    const { isVercelProduction } = await loadEnv();
    expect(isVercelProduction()).toBe(true);
  });

  it("is false for VERCEL_ENV preview and development, and when unset", async () => {
    unsetAll();
    const { isVercelProduction } = await loadEnv();
    expect(isVercelProduction()).toBe(false);
    env.VERCEL_ENV = "preview";
    expect(isVercelProduction()).toBe(false);
    env.VERCEL_ENV = "development";
    expect(isVercelProduction()).toBe(false);
  });

  it('is false when NODE_ENV is "production" and VERCEL_ENV is unset', async () => {
    unsetAll();
    env.NODE_ENV = "production";
    const { isVercelProduction } = await loadEnv();
    expect(isVercelProduction()).toBe(false);
  });
});

// ─── The rate-limit store configuration (plan 05-18, DEC-50, DEC-59) ─────────

describe("upstashConfig()", () => {
  const UP = { url: "https://up.example.upstash.io", token: "up-token" };
  const KV = { url: "https://kv.example.upstash.io", token: "kv-token" };

  it("returns the UPSTASH_REDIS_REST_* pair when both are set", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = UP.url;
    env.UPSTASH_REDIS_REST_TOKEN = UP.token;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(UP);
  });

  it("falls back to the KV_REST_API_* pair (the Vercel Marketplace names)", async () => {
    unsetAll();
    env.KV_REST_API_URL = KV.url;
    env.KV_REST_API_TOKEN = KV.token;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(KV);
  });

  it("prefers the UPSTASH pair when both pairs are complete", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = UP.url;
    env.UPSTASH_REDIS_REST_TOKEN = UP.token;
    env.KV_REST_API_URL = KV.url;
    env.KV_REST_API_TOKEN = KV.token;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(UP);
  });

  it("never mixes a url from one pair with a token from the other", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = UP.url;
    env.KV_REST_API_TOKEN = KV.token;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toBeNull();
  });

  it("uses the complete KV pair when the UPSTASH pair is half set", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = UP.url;
    env.KV_REST_API_URL = KV.url;
    env.KV_REST_API_TOKEN = KV.token;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(KV);
  });

  it("treats blank and whitespace-only values as absent", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = "";
    env.UPSTASH_REDIS_REST_TOKEN = "  ";
    env.KV_REST_API_URL = " \t";
    env.KV_REST_API_TOKEN = "";
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toBeNull();
  });

  it("returns null when both pairs are absent outside production", async () => {
    unsetAll();
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toBeNull();
  });

  // INTENTIONAL (DEC-59 Part 2 supersedes DEC-50's boot clause): the reader
  // never throws. The boot check decides what an absent store means.
  it('returns null, and does not throw, when both pairs are absent and VERCEL_ENV is "production"', async () => {
    unsetAll();
    env.VERCEL_ENV = "production";
    const { upstashConfig } = await loadEnv();
    expect(() => upstashConfig()).not.toThrow();
    expect(upstashConfig()).toBeNull();
  });

  it("reads at call time, not at import time", async () => {
    unsetAll();
    const { upstashConfig } = await loadEnv();
    env.UPSTASH_REDIS_REST_URL = UP.url;
    env.UPSTASH_REDIS_REST_TOKEN = UP.token;
    expect(upstashConfig()).toEqual(UP);
  });

  // REVIEW-05 CR-02: a pasted value's trailing newline or padding is trimmed,
  // because @upstash/redis refuses it synchronously.
  it("trims a trailing newline and surrounding spaces from both halves", async () => {
    unsetAll();
    env.UPSTASH_REDIS_REST_URL = `  ${UP.url}\n`;
    env.UPSTASH_REDIS_REST_TOKEN = `${UP.token} \n`;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(UP);
  });

  it("trims the KV pair too", async () => {
    unsetAll();
    env.KV_REST_API_URL = `${KV.url}\r\n`;
    env.KV_REST_API_TOKEN = `\t${KV.token}`;
    const { upstashConfig } = await loadEnv();
    expect(upstashConfig()).toEqual(KV);
  });

  it("names all four variables in UPSTASH_ENV_NAMES", async () => {
    const { UPSTASH_ENV_NAMES } = await loadEnv();
    expect(UPSTASH_ENV_NAMES).toBe(
      "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN"
    );
  });
});

describe("rateLimitRequireDistributed() (optional, DEC-59)", () => {
  it("is false when RATE_LIMIT_REQUIRE_DISTRIBUTED is unset, empty or whitespace", async () => {
    unsetAll();
    const { rateLimitRequireDistributed } = await loadEnv();
    expect(rateLimitRequireDistributed()).toBe(false);
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "";
    expect(rateLimitRequireDistributed()).toBe(false);
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "  ";
    expect(rateLimitRequireDistributed()).toBe(false);
  });

  it.each(["true", "TRUE", " true "])('is true for "%s"', async (value) => {
    unsetAll();
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = value;
    const { rateLimitRequireDistributed } = await loadEnv();
    expect(rateLimitRequireDistributed()).toBe(true);
  });

  it('is false for "false"', async () => {
    unsetAll();
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "false";
    const { rateLimitRequireDistributed } = await loadEnv();
    expect(rateLimitRequireDistributed()).toBe(false);
  });

  // A typo must not silently turn an opt-in fail-closed switch off.
  it.each(["1", "yes", "on", "ture"])(
    'throws InvalidEnvError naming the variable for "%s"',
    async (value) => {
      unsetAll();
      env.RATE_LIMIT_REQUIRE_DISTRIBUTED = value;
      const { rateLimitRequireDistributed, InvalidEnvError } = await loadEnv();
      expect(() => rateLimitRequireDistributed()).toThrow(InvalidEnvError);
      expect(() => rateLimitRequireDistributed()).toThrow(
        'Invalid environment variable: RATE_LIMIT_REQUIRE_DISTRIBUTED (expected "true" or "false")'
      );
    }
  );
});

// ─── REVIEW-05 CR-02: is a present Upstash pair usable? ──────────────────────

describe("upstashConfigProblem()", () => {
  const PASSWORD = "Sup3rS3cretPassw0rd";
  const TOKEN = "placeholder-token";

  it("is null for an https REST URL", async () => {
    const { upstashConfigProblem } = await loadEnv();
    expect(
      upstashConfigProblem({ url: "https://example-1234.upstash.io", token: TOKEN })
    ).toBeNull();
  });

  it.each([
    ["a rediss:// TCP connection string", `rediss://default:${PASSWORD}@example-1234.upstash.io:6379`, /https:/],
    ["a KV_URL-style redis:// value", `redis://default:${PASSWORD}@example-1234.upstash.io:6379`, /https:/],
    ["an http:// URL", "http://example-1234.upstash.io", /https:/],
    ["an unparseable value", "not a url", /does not parse/],
    ["an https URL the Upstash client refuses", "https://.example.upstash.io", /form the Upstash client accepts/],
  ])("names the problem for %s, never the URL", async (_label, url, expected) => {
    const { upstashConfigProblem } = await loadEnv();
    const problem = upstashConfigProblem({ url, token: TOKEN });
    expect(problem).toMatch(expected);
    expect(problem).not.toContain(PASSWORD);
    expect(problem).not.toContain(TOKEN);
    expect(problem).not.toContain("example-1234");
  });
});
