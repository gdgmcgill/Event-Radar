/**
 * The proxy's rate-limit step fails open (REVIEW-05 CR-02).
 *
 * Before the fix `applyRateLimit(request, getRateLimitStore())` sat outside
 * the proxy's try block, so a throw from store selection (a malformed Upstash
 * URL) or from counting answered every matched route 500, pages included.
 * Rate limiting is not an authorization control: a fault in it must let the
 * request continue down the ring, and must not log the error's message (it
 * can echo the store URL).
 *
 * The rate-limit module and the Supabase SSR client are mocked; placeholder
 * values only.
 */

import { NextRequest } from "next/server";

const mockGetRateLimitStore = jest.fn();
const mockApplyRateLimit = jest.fn();

jest.mock("@/server/ratelimit", () => ({
  getRateLimitStore: (...args: unknown[]) => mockGetRateLimitStore(...args),
  applyRateLimit: (...args: unknown[]) => mockApplyRateLimit(...args),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

import { proxy } from "./proxy";

const SECRET = "Sup3rS3cretPassw0rd";
let errorSpy: jest.SpyInstance;
const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

afterAll(() => {
  process.env = savedEnv;
});

function req(path: string, method = "GET"): NextRequest {
  return new NextRequest(`https://proxy.test${path}`, {
    method,
    headers: { "x-forwarded-for": "10.99.0.1" },
  });
}

describe("proxy() when the rate limiter faults", () => {
  it.each([
    ["GET /", "/", "GET"],
    ["GET /api/events", "/api/events", "GET"],
    ["POST /api/events/x/save (no Origin)", "/api/events/x/save", "POST"],
  ])(
    "store selection throws on %s: the request continues, no 500",
    async (_label, path, method) => {
      mockGetRateLimitStore.mockImplementation(() => {
        throw new TypeError(`Upstash URL rediss://default:${SECRET}@x`);
      });
      const res = await proxy(req(path, method));
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
      expect(mockApplyRateLimit).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).toContain("TypeError");
      expect(logged).not.toContain(SECRET);
    }
  );

  it("counting rejects: the request continues, no 500", async () => {
    mockGetRateLimitStore.mockReturnValue({});
    mockApplyRateLimit.mockRejectedValue(new Error(SECRET));
    const res = await proxy(req("/api/events"));
    expect(res.status).toBe(200);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(SECRET);
  });

  it("a 429 from the limiter is still returned unchanged", async () => {
    const tooMany = new Response(null, { status: 429 });
    mockGetRateLimitStore.mockReturnValue({});
    mockApplyRateLimit.mockResolvedValue(tooMany);
    const res = await proxy(req("/api/events"));
    expect(res).toBe(tooMany);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
