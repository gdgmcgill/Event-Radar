/**
 * DEFECT characterization — F-029: GET /api/health hands any anonymous caller
 * a full infrastructure report (plan 06-07 pins it; plan 06-17 splits it into
 * an anonymous liveness answer and an admin-only report, research § G)
 *
 * Measured at f550de9 against the UNMODIFIED route
 * (`src/app/api/health/route.ts`, 389 lines) with a temporary harness first;
 * the run is in the phase evidence `slice-7-characterization.txt`. The route
 * never asks who is calling (no `getUser`, no guard). It runs five checks and
 * returns all of them:
 *   - database: head counts on events, users and saved_events through the
 *     cookie client, and names each table in `details.tables`;
 *   - supabase_auth: `supabase.auth.getSession()` (the census's one
 *     remaining session read, C6);
 *   - azure_oauth: `supabase.auth.signInWithOAuth({ provider: "azure", … })`
 *     on the server client, a live auth-configuration probe on every call,
 *     whose provider error text is returned verbatim;
 *   - environment: which required variables are missing, by name;
 *   - memory: heap, RSS and external figures;
 * plus `uptime` and `version`.
 *
 * What is pinned (an anonymous caller throughout):
 *   - H1 the body's shape: status, timestamp, uptime, version and the six
 *     named checks, with the checked table names and the provider name;
 *   - H2 the route makes the live OAuth probe and the session read, and
 *     never reads the caller;
 *   - H3 a provider error's text reaches the anonymous body;
 *   - H4 a missing variable is named in the anonymous body, and the answer
 *     is 503;
 *   - H5 memory figures reach the anonymous body.
 *
 * When 06-17 lands, H1-H5 MOVE: an anonymous caller gets `{ status, version }`
 * only and the report needs an admin session; the session read, the OAuth
 * probe and the environment and memory checks are deleted. Each move takes a
 * defect-ledger row citing F-029.
 *
 * Seam: `@/lib/supabase/server` returns the shared fake's client with
 * `auth.getSession` and `auth.signInWithOAuth` added as jest mocks (the fake
 * models only `getUser`), spied so H2 can read the calls.
 */

import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";

type HealthGET = (typeof import("@/app/api/health/route"))["GET"];

const SUPABASE_URL = "http://supabase.test";

const getSession = jest.fn();
const signInWithOAuth = jest.fn();
const getUser = jest.fn();
let mockClient: FakeSupabase["client"] & {
  auth: FakeSupabase["client"]["auth"] & {
    getSession: typeof getSession;
    signInWithOAuth: typeof signInWithOAuth;
  };
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockClient),
}));

const ENV = process.env as Record<string, string | undefined>;
const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeAll(() => {
  for (const key of KEYS) saved[key] = ENV[key];
});

afterAll(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete ENV[key];
    else ENV[key] = saved[key];
  }
});

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  ENV.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  signInWithOAuth.mockReset().mockResolvedValue({
    data: { provider: "azure", url: `${SUPABASE_URL}/auth/v1/authorize?provider=azure` },
    error: null,
  });
  getUser.mockReset();
  const fake = createFakeSupabase({
    user: null,
    tables: { events: [{ id: "e" }], users: [{ id: "u" }], saved_events: [] },
  });
  mockClient = {
    ...fake.client,
    from: (table: string) => fake.client.from(table),
    rpc: (name: string, args?: unknown) => fake.client.rpc(name, args),
    auth: { getUser, getSession, signInWithOAuth },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function health(): Promise<{ status: number; body: Record<string, any> }> {
  const GET: HealthGET = (await import("@/app/api/health/route")).GET;
  const response = await GET();
  return { status: response.status, body: await response.json() };
}

describe("F-029: GET /api/health, anonymous caller", () => {
  it("H1 answers the full report: six named checks, table names, provider name", async () => {
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["checks", "status", "timestamp", "uptime", "version"]);
    expect(Object.keys(body.checks)).toEqual([
      "server",
      "database",
      "supabase_auth",
      "azure_oauth",
      "environment",
      "memory",
    ]);
    expect(body.checks.database).toMatchObject({
      status: "healthy",
      message: "All database tables accessible",
      details: { tables: { events: true, users: true, saved_events: true } },
    });
    expect(body.checks.supabase_auth).toMatchObject({
      status: "healthy",
      message: "Supabase Auth is operational",
    });
    expect(body.checks.azure_oauth).toMatchObject({
      status: "healthy",
      message: "Azure OAuth is configured and operational",
      details: { provider: "azure", configured: true },
    });
    expect(body.checks.environment).toEqual({
      status: "healthy",
      message: "All required environment variables are set",
      details: { variables_checked: 2 },
    });
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.version).toBe("string");
  });

  it("H2 makes the live OAuth probe and the session read, and never reads the caller", async () => {
    await health();
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
      options: {
        redirectTo: `${SUPABASE_URL}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("H3 a provider error's text reaches the anonymous body (503)", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { provider: "azure", url: null },
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    const { status, body } = await health();
    expect(status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.azure_oauth).toMatchObject({
      status: "unhealthy",
      message: "Azure OAuth not configured: Unsupported provider: provider is not enabled",
      details: {
        error: "Unsupported provider: provider is not enabled",
        hint: "Configure Azure OAuth provider in Supabase dashboard",
      },
    });
  });

  it("H4 a missing variable is named in the anonymous body (503)", async () => {
    delete ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { status, body } = await health();
    expect(status).toBe(503);
    expect(body.checks.environment).toEqual({
      status: "unhealthy",
      message: "Missing required environment variables",
      details: { missing: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
    });
  });

  it("H5 memory figures reach the anonymous body", async () => {
    const { body } = await health();
    expect(Object.keys(body.checks.memory.details).sort()).toEqual([
      "external",
      "heapPercentage",
      "heapTotal",
      "heapUsed",
      "rss",
    ]);
    expect(body.checks.memory.details.heapUsed).toMatch(/^\d+MB$/);
    expect(body.checks.memory.details.rss).toMatch(/^\d+MB$/);
  });
});
