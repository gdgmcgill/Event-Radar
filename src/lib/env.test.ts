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
 *   - "production" is VERCEL_ENV === "production", never NODE_ENV.
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
