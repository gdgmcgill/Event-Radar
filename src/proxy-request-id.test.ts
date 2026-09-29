/**
 * The proxy stamps a request id (plan 06-12, DEC-74, research C19 and A1).
 *
 * Subject: `src/proxy.ts`. As its first statement the proxy mints a UUID and
 * sets it as `x-request-id` on the REQUEST headers, overwriting any client
 * value, so `NextResponse.next({ request })` forwards it to the handler as
 * `x-middleware-request-x-request-id`, whether or not `setAll` refreshed the
 * session. Every response the proxy returns carries the same id as
 * `x-request-id`: the pass-through, the 429, the 403s, the 500 and the
 * redirects. The rest of the proxy runs inside the request store, so its log
 * lines (and anything the handler logs) carry that id.
 * M0 also pins private/no-store on every direct denial, error and redirect:
 * those responses never reach withRoute's cache policy. Successful next()
 * responses must leave the downstream route's cache policy available.
 *
 * Mock seams: `@supabase/ssr` (the proxy imports createServerClient from it
 * directly) and `@/server/ratelimit` (to script a 429 and a limiter fault).
 * Placeholder values only; `.env.local` is never read.
 */

import { NextRequest, NextResponse } from "next/server";
import { currentRequestId } from "@/server/log";

const mockGetUser = jest.fn();
const mockSingle = jest.fn();
const mockSignOut = jest.fn();
const mockCreateServerClient = jest.fn();
const mockApplyRateLimit = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

jest.mock("@/server/ratelimit", () => ({
  DistributedStoreRequiredError: jest.requireActual("@/server/ratelimit").DistributedStoreRequiredError,
  getRateLimitStore: () => ({}),
  applyRateLimit: (...args: unknown[]) => mockApplyRateLimit(...args),
}));

import { proxy } from "./proxy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FORWARDED = "x-middleware-request-x-request-id";
const USER_ID = "00000000-0000-4000-8000-000000000c01";

type SetAll = (
  cookies: { name: string; value: string; options?: Record<string, unknown> }[]
) => void;

/** A client whose getUser can call setAll, as a session refresh does. */
function client({ refresh }: { refresh: boolean }) {
  return (_url: string, _key: string, opts: { cookies: { setAll: SetAll } }) => ({
    auth: {
      getUser: async () => {
        if (refresh) {
          opts.cookies.setAll([
            {
              name: "sb-placeholder-project-auth-token",
              value: "refreshed",
              options: { path: "/" },
            },
          ]);
        }
        return mockGetUser();
      },
      signOut: mockSignOut,
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
    }),
  });
}

function req(
  path: string,
  {
    method = "GET",
    headers = {},
  }: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(`https://proxy.test${path}`, {
    method,
    headers: { "x-forwarded-for": "10.61.0.1", ...headers },
  });
}

function jsonLines(spy: jest.SpyInstance): Record<string, unknown>[] {
  return spy.mock.calls.map((c: unknown[]) => JSON.parse(String(c[0])));
}

describe("proxy request id (DEC-74, C19)", () => {
  const savedEnv = { ...process.env };
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
    mockCreateServerClient.mockImplementation(client({ refresh: false }));
    mockApplyRateLimit.mockResolvedValue(null);
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => consoleError.mockRestore());
  afterAll(() => {
    process.env = savedEnv;
  });

  it("non-refreshed pass-through: forwards a fresh UUID in place of the client's value and echoes it", async () => {
    const res = await proxy(req("/", { headers: { "x-request-id": "client-chosen" } }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBeNull();
    const forwarded = res.headers.get(FORWARDED);
    expect(forwarded).toMatch(UUID);
    expect(forwarded).not.toBe("client-chosen");
    expect(res.headers.get("x-request-id")).toBe(forwarded);
  });

  it("refreshed pass-through (setAll rebuilt the response): still forwards and echoes the id, and keeps the cookie", async () => {
    mockCreateServerClient.mockImplementation(client({ refresh: true }));
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockSingle.mockResolvedValue({
      data: { banned_at: null, ban_expires_at: null, onboarding_completed: true },
      error: null,
    });

    const res = await proxy(req("/", { headers: { "x-request-id": "client-chosen" } }));

    expect(res.status).toBe(200);
    const forwarded = res.headers.get(FORWARDED);
    expect(forwarded).toMatch(UUID);
    expect(forwarded).not.toBe("client-chosen");
    expect(res.headers.get("x-request-id")).toBe(forwarded);
    expect(res.headers.get("set-cookie")).toContain(
      "sb-placeholder-project-auth-token=refreshed"
    );
  });

  it("never trusts a client-supplied id, even a UUID-shaped one", async () => {
    const res = await proxy(req("/api/events", { headers: { "x-request-id": CLIENT_UUID } }));

    expect(res.headers.get(FORWARDED)).toMatch(UUID);
    expect(res.headers.get(FORWARDED)).not.toBe(CLIENT_UUID);
    expect(res.headers.get("x-request-id")).not.toBe(CLIENT_UUID);
  });

  it("mints a distinct id per request", async () => {
    const a = await proxy(req("/"));
    const b = await proxy(req("/"));
    expect(a.headers.get("x-request-id")).not.toBe(b.headers.get("x-request-id"));
  });

  it("runs the ring inside the request store: getUser sees the forwarded id", async () => {
    let seen: string | undefined;
    mockGetUser.mockImplementation(async () => {
      seen = currentRequestId();
      return { data: { user: null }, error: null };
    });

    const res = await proxy(req("/"));

    expect(seen).toMatch(UUID);
    expect(seen).toBe(res.headers.get(FORWARDED));
  });

  it("429 keeps the limiter's body and retry metadata while forcing private caching", async () => {
    const tooMany = NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": "42", "X-RateLimit-Limit": "300", "X-RateLimit-Remaining": "0", "Cache-Control": "public, max-age=60" },
    });
    mockApplyRateLimit.mockResolvedValue(tooMany);

    const res = await proxy(req("/api/events", { headers: { "x-request-id": CLIENT_UUID } }));

    expect(res).toBe(tooMany);
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("retry-after")).toBe("42");
    expect(res.headers.get("x-ratelimit-limit")).toBe("300");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expect(res.headers.get("x-request-id")).toMatch(UUID);
    expect(res.headers.get("x-request-id")).not.toBe(CLIENT_UUID);
  });

  it("a limiter fault logs one JSON line carrying the request's id, then passes through", async () => {
    mockApplyRateLimit.mockRejectedValue(new TypeError("store down"));

    const res = await proxy(req("/api/events"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBeNull();
    const [line] = jsonLines(consoleError);
    expect(line).toMatchObject({
      level: "error",
      scope: "Middleware",
      msg: "Rate limit check failed; allowing request",
      error: "TypeError",
      requestId: res.headers.get("x-request-id"),
      route: "/api/events",
    });
  });

  it("403 cross-site mutation carries the id", async () => {
    const res = await proxy(
      req("/api/events/x/save", {
        method: "POST",
        headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site" },
      })
    );

    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: "Cross-site request blocked" });
    expect(res.headers.get("x-request-id")).toMatch(UUID);
  });

  it("500 on the ring's own error carries the id, and the error line is JSON with the same id", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await proxy(req("/api/events"));

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: "Failed to process request" });
    const id = res.headers.get("x-request-id");
    expect(id).toMatch(UUID);
    expect(consoleError).toHaveBeenCalledTimes(1);
    const [line] = jsonLines(consoleError);
    expect(line).toMatchObject({
      level: "error",
      scope: "Middleware",
      msg: "Error",
      requestId: id,
      route: "/api/events",
      error: { name: "MissingEnvError" },
    });
  });

  it("500 on a page carries the id", async () => {
    mockGetUser.mockRejectedValue(new Error("auth server unreachable"));

    const res = await proxy(req("/profile"));

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("Internal Server Error");
    expect(res.headers.get("x-request-id")).toMatch(UUID);
  });

  it("sign-in redirect on a protected page carries the id", async () => {
    const res = await proxy(req("/profile"));

    expect(res.status).toBe(307);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("location")).toContain("signin=required");
    expect(res.headers.get("x-request-id")).toMatch(UUID);
  });

  it("banned /api/* 403 and banned page redirect carry the id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockSingle.mockResolvedValue({
      data: {
        banned_at: "2026-01-01T00:00:00.000Z",
        ban_expires_at: null,
        onboarding_completed: true,
      },
      error: null,
    });

    const api = await proxy(req("/api/events"));
    expect(api.status).toBe(403);
    expect(api.headers.get("cache-control")).toBe("private, no-store");
    expect(await api.json()).toEqual({ error: "Account suspended" });
    expect(api.headers.get("x-request-id")).toMatch(UUID);

    const page = await proxy(req("/"));
    expect(page.status).toBe(307);
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(page.headers.get("location")).toContain("/banned");
    expect(page.headers.get("x-request-id")).toMatch(UUID);
  });

  it("profile-not-found 403 and sync-failed redirect carry the id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const api = await proxy(req("/api/events"));
    expect(api.status).toBe(403);
    expect(api.headers.get("cache-control")).toBe("private, no-store");
    expect(await api.json()).toEqual({ error: "Profile not found" });
    expect(api.headers.get("x-request-id")).toMatch(UUID);

    const page = await proxy(req("/"));
    expect(page.status).toBe(307);
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(page.headers.get("location")).toContain("error=profile_sync_failed");
    expect(page.headers.get("x-request-id")).toMatch(UUID);
  });

  it("student authoring onboarding redirect carries the id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockSingle.mockResolvedValue({
      data: { banned_at: null, ban_expires_at: null, onboarding_completed: false },
      error: null,
    });

    const res = await proxy(req("/my-events"));
    expect(res.status).toBe(307);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("location")).toContain("/onboarding");
    expect(res.headers.get("x-request-id")).toMatch(UUID);
  });
});
