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
 *     unset), because the edge runtime never holds the service key.
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
