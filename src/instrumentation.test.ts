/**
 * Unit tests for src/instrumentation.ts register() — the boot completeness
 * check (DEC-37).
 *
 * The contract under test:
 *   - on the Node.js server runtime, register() resolves when the Supabase URL,
 *     the anon key and the service-role key are all set, and rejects with a
 *     MissingEnvError naming the first missing variable when any one of them
 *     is unset or blank, after logging one JSON line (scope "Config", msg
 *     "refusing to start", the error's name and message; plan 06-12, DEC-74);
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
 *   - Sentry (plan 06-16, DEC-76): register() initializes Sentry first, with
 *     the decided posture; no usable SENTRY_DSN means init with enabled false
 *     and exactly ONE info line "Sentry disabled" (scope "Sentry", a reason,
 *     never the value); a throwing init never fails boot; onRequestError
 *     hands Next's error to Sentry's captureRequestError inside a scope
 *     tagged request_id when the request carries a UUID-shaped x-request-id.
 *     `@sentry/nextjs` is mocked for the whole file: these rows test
 *     register()'s logic, and src/server/__tests__/sentry.test.ts drives the
 *     real SDK through an in-memory transport.
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

type SentryMock = {
  init: jest.Mock;
  withScope: jest.Mock;
  captureRequestError: jest.Mock;
  scope: { setTag: jest.Mock };
};

jest.mock("@sentry/nextjs", () => {
  const scope = { setTag: jest.fn() };
  return {
    scope,
    init: jest.fn(),
    withScope: jest.fn((callback: (s: typeof scope) => unknown) => callback(scope)),
    captureRequestError: jest.fn(),
  };
});

/** The mock instance the most recent load() wired into the module under test. */
function sentryMock(): SentryMock {
  return jest.requireMock("@sentry/nextjs") as SentryMock;
}

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
  "SENTRY_DSN",
  "VERCEL_GIT_COMMIT_SHA",
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
let logSpy: jest.SpyInstance;

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) saved[key] = env[key];
  for (const key of MANAGED_KEYS) delete env[key];
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  // The "Sentry disabled" info line goes to console.log (plan 06-16).
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  jest.resetModules();
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  errorSpy.mockRestore();
  logSpy.mockRestore();
});

function setAllRequired(): void {
  env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-value";
  env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";
}

/** The Nth console.error call, parsed: the logger writes one JSON line (DEC-74). */
function loggedLine(index = 0): Record<string, unknown> {
  const call = errorSpy.mock.calls[index] as unknown[];
  expect(call).toHaveLength(1);
  return JSON.parse(String(call[0])) as Record<string, unknown>;
}

/** The refusal line: level error, scope Config, the error's name and message. */
function expectRefusal(name: string, message: string): void {
  expect(loggedLine()).toMatchObject({
    level: "error",
    scope: "Config",
    msg: "refusing to start",
    error: { name, message },
  });
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
      expectRefusal(
        "MissingEnvError",
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
    const logged = loggedLine();
    expect(logged).toMatchObject({ level: "error", scope: "RateLimit" });
    const line = String(logged.msg);
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
    expectRefusal(
      "MissingEnvError",
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
    expectRefusal(
      "InvalidEnvError",
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
    const logged = loggedLine();
    expect(logged).toMatchObject({ level: "error", scope: "RateLimit" });
    const line = String(logged.msg);
    expect(line).toContain("UPSTASH_REDIS_REST_URL or KV_REST_API_URL");
    expect(line).toContain("in-memory store");
    expect(line).not.toContain(PASSWORD);
    expect(line).not.toContain("up-token");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PASSWORD);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("up-token");
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

// ─── Sentry (plan 06-16, DEC-76) ─────────────────────────────────────────────

/** Every console.log line that is the logger's "Sentry disabled" line. */
function disabledLines(): Record<string, unknown>[] {
  return logSpy.mock.calls
    .map((call) => {
      try {
        return JSON.parse(String(call[0])) as Record<string, unknown>;
      } catch {
        return {};
      }
    })
    .filter((line) => line.msg === "Sentry disabled");
}

describe("register() and Sentry", () => {
  const DSN = "https://0123abcd@o42.ingest.us.sentry.io/4507";

  beforeEach(() => {
    env.NEXT_RUNTIME = "nodejs";
    setAllRequired();
  });

  it("no SENTRY_DSN: init once with enabled false and the posture; exactly one info line; boot resolves", async () => {
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    const { init } = sentryMock();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toMatchObject({
      enabled: false,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: "development",
    });
    expect(disabledLines()).toEqual([
      expect.objectContaining({
        level: "info",
        msg: "Sentry disabled",
        scope: "Sentry",
        reason: "SENTRY_DSN is not set",
      }),
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("a SENTRY_DSN that is not an https DSN: disabled with its reason, and the value is never logged", async () => {
    env.SENTRY_DSN = "http://0123abcd@o42.ingest.us.sentry.io/4507";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(sentryMock().init.mock.calls[0][0]).toMatchObject({ enabled: false });
    const lines = disabledLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].reason).toBe("SENTRY_DSN is not an https Sentry DSN");
    const everything = JSON.stringify(logSpy.mock.calls) + JSON.stringify(errorSpy.mock.calls);
    expect(everything).not.toContain("0123abcd");
  });

  it("a usable SENTRY_DSN: init once with enabled true, that dsn, VERCEL_ENV and the commit sha; no disabled line", async () => {
    env.SENTRY_DSN = DSN;
    env.VERCEL_ENV = "preview";
    env.VERCEL_GIT_COMMIT_SHA = "abc123";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    const { init } = sentryMock();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toMatchObject({
      dsn: DSN,
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: "preview",
      release: "abc123",
    });
    expect(typeof init.mock.calls[0][0].beforeSend).toBe("function");
    expect(disabledLines()).toEqual([]);
  });

  it("Sentry is initialized before the boot check, so a refusal still happens after it", async () => {
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    const { register, MissingEnvError } = await load();
    await expect(register()).rejects.toBeInstanceOf(MissingEnvError);
    expect(sentryMock().init).toHaveBeenCalledTimes(1);
  });

  it("a throwing Sentry.init never fails boot: one warn line, and register resolves", async () => {
    env.SENTRY_DSN = DSN;
    const { register } = await load();
    // load() wired this instance in; register() imports the config from the
    // same module registry, so it sees this implementation.
    sentryMock().init.mockImplementation(() => {
      throw new Error("sdk exploded");
    });
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toMatchObject({
      level: "warn",
      scope: "Sentry",
      msg: "Sentry init failed; continuing without error reporting",
    });
  });

  it('checks nothing and initializes nothing when NEXT_PHASE is "phase-production-build"', async () => {
    env.NEXT_PHASE = "phase-production-build";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(sentryMock().init).not.toHaveBeenCalled();
  });

  it('initializes nothing when NEXT_RUNTIME is "edge" (no edge config, DEC-76)', async () => {
    env.NEXT_RUNTIME = "edge";
    const { register } = await load();
    await expect(register()).resolves.toBeUndefined();
    expect(sentryMock().init).not.toHaveBeenCalled();
  });
});

describe("onRequestError", () => {
  const ERROR_REQUEST = (headers: Record<string, string | string[]>) => ({
    path: "/events/abc?invite=x",
    method: "GET",
    headers,
  });
  const CONTEXT = {
    routerKind: "App Router" as const,
    routePath: "/events/[id]",
    routeType: "render" as const,
    renderSource: "server-rendering" as const,
    revalidateReason: undefined,
    renderType: "dynamic" as const,
  };

  async function loadHook(): Promise<(typeof import("./instrumentation"))["onRequestError"]> {
    const { onRequestError } = await import("./instrumentation");
    return onRequestError;
  }

  it("hands the error to captureRequestError inside a scope tagged with a UUID-shaped x-request-id", async () => {
    const onRequestError = await loadHook();
    const error = new Error("render failed");
    const request = ERROR_REQUEST({ "x-request-id": "3f0c2b1a-9d8e-4f7a-8b6c-5d4e3f2a1b0c" });
    await onRequestError(error, request, CONTEXT);
    const { withScope, captureRequestError, scope } = sentryMock();
    expect(withScope).toHaveBeenCalledTimes(1);
    expect(scope.setTag).toHaveBeenCalledWith("request_id", "3f0c2b1a-9d8e-4f7a-8b6c-5d4e3f2a1b0c");
    expect(captureRequestError).toHaveBeenCalledWith(error, request, CONTEXT);
  });

  it("captures without a request_id tag when the header is absent or not UUID-shaped", async () => {
    const onRequestError = await loadHook();
    await onRequestError(new Error("a"), ERROR_REQUEST({}), CONTEXT);
    await onRequestError(new Error("b"), ERROR_REQUEST({ "x-request-id": "forged\nline" }), CONTEXT);
    const { captureRequestError, scope } = sentryMock();
    expect(captureRequestError).toHaveBeenCalledTimes(2);
    expect(scope.setTag).not.toHaveBeenCalled();
  });
});
