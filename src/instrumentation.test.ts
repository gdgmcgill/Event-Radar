/**
 * Unit tests for src/instrumentation.ts register() — the boot completeness
 * check (DEC-37).
 *
 * The contract under test:
 *   - on the Node.js server runtime, register() resolves when the Supabase URL,
 *     the anon key and the service-role key are all set, and rejects with a
 *     MissingEnvError naming the first missing variable when any one of them
 *     is unset or blank, after logging one "[Config] refusing to start:" line;
 *   - it checks nothing during `next build` (NEXT_PHASE is
 *     "phase-production-build"), because CI builds with no service key;
 *   - it checks nothing outside the Node.js runtime (NEXT_RUNTIME "edge", or
 *     unset), because the edge runtime never holds the service key;
 *   - the rate-limit store arm (plan 05-18, DEC-50 as amended by DEC-59
 *     Part 2): a configured Upstash pair passes silently; no pair in
 *     production logs ONE error naming all four variables and the
 *     degradation, and the server still starts; no pair with
 *     RATE_LIMIT_REQUIRE_DISTRIBUTED=true refuses to start; no pair outside
 *     production logs nothing here (the store selection warns instead).
 *
 * These tests are the authority on register()'s behaviour. What Next itself
 * does with a rejecting register() is measured separately, in
 * evidence/boot-check.txt.
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
  "NEXT_RUNTIME",
  "NEXT_PHASE",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "VERCEL_ENV",
  "RATE_LIMIT_REQUIRE_DISTRIBUTED",
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const env = process.env as Record<string, string | undefined>;
let saved: Partial<Record<ManagedKey, string | undefined>> = {};
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) saved[key] = env[key];
  for (const key of MANAGED_KEYS) delete env[key];
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.resetModules();
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  errorSpy.mockRestore();
});

function setAllRequired(): void {
  env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-value";
  env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";
}

async function load(): Promise<{
  register: (typeof import("./instrumentation"))["register"];
  MissingEnvError: (typeof import("@/lib/env"))["MissingEnvError"];
}> {
  const { register } = await import("./instrumentation");
  const { MissingEnvError } = await import("@/lib/env");
  return { register, MissingEnvError };
}

describe("register() on the Node.js server runtime", () => {
  beforeEach(() => {
    env.NEXT_RUNTIME = "nodejs";
  });

  it("resolves when all three required variables are set, and logs nothing", async () => {
    setAllRequired();
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each(REQUIRED)(
    "rejects with MissingEnvError naming %s when it is unset",
    async (variable) => {
      setAllRequired();
      delete env[variable];
      const { register, MissingEnvError } = await load();
      const outcome = register();
      await expect(outcome).rejects.toBeInstanceOf(MissingEnvError);
      await expect(outcome).rejects.toThrow(
        `Missing required environment variable: ${variable}`
      );
      expect(errorSpy).toHaveBeenCalledWith(
        "[Config] refusing to start:",
        `Missing required environment variable: ${variable}`
      );
    }
  );

  it.each(REQUIRED)(
    "rejects with MissingEnvError naming %s when it is blank",
    async (variable) => {
      setAllRequired();
      env[variable] = " ";
      const { register, MissingEnvError } = await load();
      const outcome = register();
      await expect(outcome).rejects.toBeInstanceOf(MissingEnvError);
      await expect(outcome).rejects.toThrow(
        `Missing required environment variable: ${variable}`
      );
    }
  );
});

describe("register() outside the serving Node.js runtime checks nothing", () => {
  it('resolves with every variable unset when NEXT_PHASE is "phase-production-build"', async () => {
    env.NEXT_RUNTIME = "nodejs";
    env.NEXT_PHASE = "phase-production-build";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('resolves with every variable unset when NEXT_RUNTIME is "edge"', async () => {
    env.NEXT_RUNTIME = "edge";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("resolves with every variable unset when NEXT_RUNTIME is not set", async () => {
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// ─── The rate-limit store arm (plan 05-18, DEC-50, DEC-59 Part 2) ────────────

describe("register() and the rate-limit store", () => {
  const FOUR_NAMES =
    "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN";

  beforeEach(() => {
    env.NEXT_RUNTIME = "nodejs";
    setAllRequired();
  });

  it("configured (UPSTASH pair) in production: resolves and logs nothing", async () => {
    env.VERCEL_ENV = "production";
    env.UPSTASH_REDIS_REST_URL = "https://up.example.upstash.io";
    env.UPSTASH_REDIS_REST_TOKEN = "up-token";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("configured (KV pair) in production with the enforce flag: resolves and logs nothing", async () => {
    env.VERCEL_ENV = "production";
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    env.KV_REST_API_URL = "https://kv.example.upstash.io";
    env.KV_REST_API_TOKEN = "kv-token";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // INTENTIONAL BEHAVIOUR (DEC-59 Part 2 supersedes DEC-50's boot clause):
  // production without a store degrades loudly and keeps serving.
  it("unconfigured in production: resolves, and logs exactly one error naming all four variables and the degradation", async () => {
    env.VERCEL_ENV = "production";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toMatch(/^\[RateLimit\] /);
    for (const name of [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
      "RATE_LIMIT_REQUIRE_DISTRIBUTED",
    ]) {
      expect(line).toContain(name);
    }
    expect(line).toContain("in-memory store");
    expect(line).toContain("not shared across instances");
  });

  it("unconfigured in production with RATE_LIMIT_REQUIRE_DISTRIBUTED=true: rejects with MissingEnvError naming both pairs", async () => {
    env.VERCEL_ENV = "production";
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    const { register, MissingEnvError } = await load();
    const outcome = register();
    await expect(outcome).rejects.toBeInstanceOf(MissingEnvError);
    await expect(outcome).rejects.toThrow(
      `Missing required environment variable: ${FOUR_NAMES}`
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[Config] refusing to start:",
      `Missing required environment variable: ${FOUR_NAMES}`
    );
  });

  it("unconfigured outside production with the enforce flag: the explicit opt-in is honoured and it rejects", async () => {
    env.VERCEL_ENV = "preview";
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    const { register, MissingEnvError } = await load();
    await expect(register()).rejects.toBeInstanceOf(MissingEnvError);
  });

  it("unconfigured outside production without the flag: resolves and logs nothing", async () => {
    env.VERCEL_ENV = "preview";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("an unreadable RATE_LIMIT_REQUIRE_DISTRIBUTED refuses to start, even with a store configured", async () => {
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "yes";
    env.UPSTASH_REDIS_REST_URL = "https://up.example.upstash.io";
    env.UPSTASH_REDIS_REST_TOKEN = "up-token";
    const { register } = await load();
    const { InvalidEnvError } = await import("@/lib/env");
    const outcome = register();
    await expect(outcome).rejects.toBeInstanceOf(InvalidEnvError);
    expect(errorSpy).toHaveBeenCalledWith(
      "[Config] refusing to start:",
      'Invalid environment variable: RATE_LIMIT_REQUIRE_DISTRIBUTED (expected "true" or "false")'
    );
  });

  it("checks nothing during next build, even in production with the flag set", async () => {
    env.NEXT_PHASE = "phase-production-build";
    env.VERCEL_ENV = "production";
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// ─── REVIEW-05 CR-02: a present but unusable Upstash URL ─────────────────────

describe("register() and an unusable Upstash URL", () => {
  const PASSWORD = "Sup3rS3cretPassw0rd";
  const REDISS = `rediss://default:${PASSWORD}@example-1234.upstash.io:6379`;

  beforeEach(() => {
    env.NEXT_RUNTIME = "nodejs";
    setAllRequired();
  });

  it("a rediss:// URL without the enforce flag: resolves and logs exactly one error, without the URL", async () => {
    env.VERCEL_ENV = "production";
    env.UPSTASH_REDIS_REST_URL = REDISS;
    env.UPSTASH_REDIS_REST_TOKEN = "up-token";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toMatch(/^\[RateLimit\] /);
    expect(line).toContain("UPSTASH_REDIS_REST_URL or KV_REST_API_URL");
    expect(line).toContain("in-memory store");
    expect(line).not.toContain(PASSWORD);
    expect(line).not.toContain("up-token");
  });

  it("a KV_URL-style value in KV_REST_API_URL outside production is reported too", async () => {
    env.VERCEL_ENV = "preview";
    env.KV_REST_API_URL = `redis://default:${PASSWORD}@example-1234.upstash.io:6379`;
    env.KV_REST_API_TOKEN = "kv-token";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).not.toContain(PASSWORD);
  });

  it("a rediss:// URL with RATE_LIMIT_REQUIRE_DISTRIBUTED=true: refuses to start with InvalidEnvError naming the variables, never the value", async () => {
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    env.UPSTASH_REDIS_REST_URL = REDISS;
    env.UPSTASH_REDIS_REST_TOKEN = "up-token";
    const { register } = await load();
    const { InvalidEnvError } = await import("@/lib/env");
    const outcome = register();
    await expect(outcome).rejects.toBeInstanceOf(InvalidEnvError);
    await expect(outcome).rejects.toThrow(
      "Invalid environment variable: UPSTASH_REDIS_REST_URL or KV_REST_API_URL (expected an https:// Upstash REST URL)"
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PASSWORD);
  });

  it("an https URL with a trailing newline is usable: resolves and logs nothing", async () => {
    env.VERCEL_ENV = "production";
    env.RATE_LIMIT_REQUIRE_DISTRIBUTED = "true";
    env.UPSTASH_REDIS_REST_URL = "https://up.example.upstash.io\n";
    env.UPSTASH_REDIS_REST_TOKEN = "up-token\n";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
