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
 * MOVED by 06-17 (F-029 FIXED, DEC-78, INTENTIONAL BEHAVIOUR CHANGE): an
 * anonymous caller gets `{ status, version }` only and the report needs an
 * active admin session or the uptime monitor's HEALTH_TOKEN; the session read,
 * the OAuth probe and the environment and memory checks are deleted. Each
 * row now pins the fixed shape, with a defect-ledger row citing F-029:
 *   - H1 the anonymous body is exactly `{ status: "ok", version }`, 200,
 *     `private, no-store`, no check, no table or provider name;
 *   - H2 the route reads the caller through `getUser` and makes neither the
 *     OAuth probe nor the session read;
 *   - H3 a provider error (the probe scripted to fail) reaches nothing: the
 *     probe is never made and the anonymous body is liveness;
 *   - H4 a missing variable is named nowhere: the anonymous answer is 200
 *     liveness;
 *   - H5 no memory figure reaches the anonymous body.
 * The admin and token rows live in `health.test.ts`.
 *
 * Seam: `@/lib/supabase/server` returns the shared fake's client with
 * `auth.getSession` and `auth.signInWithOAuth` added as jest mocks (the fake
 * models only `getUser`), spied so H2 can read the calls.
 */

import { NextRequest } from "next/server";
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
const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "HEALTH_TOKEN"] as const;
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
  delete ENV.HEALTH_TOKEN;
  getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  signInWithOAuth.mockReset().mockResolvedValue({
    data: { provider: "azure", url: `${SUPABASE_URL}/auth/v1/authorize?provider=azure` },
    error: null,
  });
  getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
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

async function health(): Promise<{
  status: number;
  body: Record<string, any>;
  cacheControl: string | null;
}> {
  const GET: HealthGET = (await import("@/app/api/health/route")).GET;
  const response = await GET(new NextRequest("http://localhost:3000/api/health"));
  return {
    status: response.status,
    body: await response.json(),
    cacheControl: response.headers.get("Cache-Control"),
  };
}

describe("F-029 fixed: GET /api/health, anonymous caller gets liveness only", () => {
  it("H1 answers exactly { status: \"ok\", version }: no check, no table or provider name", async () => {
    const { status, body, cacheControl } = await health();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["status", "version"]);
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(cacheControl).toBe("private, no-store");
    const text = JSON.stringify(body);
    for (const name of ["checks", "events", "users", "saved_events", "azure", "uptime", "timestamp"]) {
      expect(text).not.toContain(name);
    }
  });

  it("H2 reads the caller through getUser and makes neither the OAuth probe nor the session read", async () => {
    await health();
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("H3 a provider error reaches nothing: the probe is never made, the answer is 200 liveness", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { provider: "azure", url: null },
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["status", "version"]);
    expect(JSON.stringify(body)).not.toContain("Unsupported provider");
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("H4 a missing variable is named nowhere: the anonymous answer is 200 liveness", async () => {
    delete ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["status", "version"]);
    expect(JSON.stringify(body)).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("H5 no memory figure reaches the anonymous body", async () => {
    const { body } = await health();
    expect(body.checks).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/heap|rss|external|MB"/);
  });
});
