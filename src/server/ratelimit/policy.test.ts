/**
 * The rate-limit policy and the async entry point (plan 05-17, DEC-50,
 * REFAC-13, REFAC-18).
 *
 * What this suite proves:
 *   - the budgets: public GET 300, public mutation 30, the high-frequency
 *     analytics writes 300, admin GET 600, admin mutation 120, all per 60 s
 *     window, keyed `${method}:${pathname}:${ip}`;
 *   - the client address prefers `x-real-ip`, then the first
 *     `x-forwarded-for` hop, then "unknown" (research A5);
 *   - the 601st admin GET and the 121st admin POST from one IP to one path
 *     are answered 429 with the existing body and headers;
 *   - for a table of public requests the async path
 *     (`applyRateLimit(req, memory store)`) and the synchronous wrapper
 *     (`applyApiRateLimit(req)`) make the same decision and emit the same
 *     status, body and headers, so the budgets cannot drift between the two.
 *
 * WHY EVERY TEST USES A DISTINCT IP
 *   The memory store's bucket map lives on `globalThis` and is shared by the
 *   sync wrapper and the async path. Jest isolates it per file, not per test,
 *   so two tests sharing an IP and a path would share a bucket. Every test
 *   below takes a fresh address from `nextIp()`.
 */

import { NextRequest } from "next/server";
import { applyApiRateLimit } from "@/middlewareRateLimit";
import {
  ADMIN_BUDGETS,
  PUBLIC_BUDGETS,
  WINDOW_MS,
  clientIp,
  rateLimitPolicy,
  tooManyRequests,
} from "./policy";
import { MemoryRateLimitStore } from "./memoryStore";
import { applyRateLimit, getRateLimitStore } from "./index";
import type { RateLimitStore } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.117.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function req(
  path: string,
  method: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`https://x.test${path}`, { method, headers });
}

function fromIp(path: string, method: string, ip: string): NextRequest {
  return req(path, method, { "x-forwarded-for": ip });
}

const FROZEN_NOW = 1_800_000_000_123;

type Snapshot = {
  status: number;
  body: unknown;
  headers: Record<string, string | null>;
} | null;

const RATE_HEADERS = [
  "Retry-After",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset",
] as const;

async function snapshot(res: Response | null): Promise<Snapshot> {
  if (!res) return null;
  const headers: Record<string, string | null> = {};
  for (const name of RATE_HEADERS) headers[name] = res.headers.get(name);
  return { status: res.status, body: await res.json(), headers };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Budgets and keys ────────────────────────────────────────────────────────

describe("rateLimitPolicy", () => {
  it("returns null for a path outside /api/", () => {
    expect(rateLimitPolicy(req("/profile", "GET"))).toBeNull();
    expect(rateLimitPolicy(req("/moderation", "POST"))).toBeNull();
    expect(rateLimitPolicy(req("/api", "POST"))).toBeNull();
  });

  it("gives public GETs 300 and public mutations 30 per 60 s window", () => {
    expect(PUBLIC_BUDGETS).toEqual({
      GET: 300,
      mutation: 30,
      highFrequencyMutation: 300,
    });
    expect(WINDOW_MS).toBe(60_000);

    const get = rateLimitPolicy(fromIp("/api/events", "GET", "1.1.1.1"));
    expect(get).toMatchObject({ limit: 300, windowMs: 60_000, scope: "public" });

    for (const method of ["POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]) {
      expect(
        rateLimitPolicy(fromIp("/api/events/x/save", method, "1.1.1.1"))
      ).toMatchObject({ limit: 30, windowMs: 60_000, scope: "public" });
    }
  });

  it.each(["/api/interactions", "/api/recommendations/feedback"])(
    "gives %s the high-frequency write budget of 300",
    (path) => {
      expect(rateLimitPolicy(fromIp(path, "POST", "1.1.1.1"))).toMatchObject({
        limit: 300,
        scope: "public",
      });
    }
  );

  it("gives /api/admin/* GETs 600 and admin mutations 120 per 60 s window", () => {
    expect(ADMIN_BUDGETS).toEqual({ GET: 600, mutation: 120 });

    expect(
      rateLimitPolicy(fromIp("/api/admin/users", "GET", "1.1.1.1"))
    ).toMatchObject({ limit: 600, windowMs: 60_000, scope: "admin" });

    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(
        rateLimitPolicy(fromIp("/api/admin/events/e1/status", method, "1.1.1.1"))
      ).toMatchObject({ limit: 120, windowMs: 60_000, scope: "admin" });
    }
  });

  it("keys the bucket by method, path and client address", () => {
    expect(
      rateLimitPolicy(fromIp("/api/events/x/save", "post", "9.9.9.9"))?.key
    ).toBe("POST:/api/events/x/save:9.9.9.9");
    expect(
      rateLimitPolicy(fromIp("/api/admin/users?page=2", "GET", "9.9.9.9"))?.key
    ).toBe("GET:/api/admin/users:9.9.9.9");
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    expect(
      clientIp(
        req("/api/events", "GET", {
          "x-real-ip": " 203.0.113.9 ",
          "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        })
      )
    ).toBe("203.0.113.9");
  });

  it("falls back to the first x-forwarded-for hop, trimmed", () => {
    expect(
      clientIp(req("/api/events", "GET", { "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" }))
    ).toBe("198.51.100.1");
  });

  it("answers 'unknown' when neither header carries an address", () => {
    expect(clientIp(req("/api/events", "GET"))).toBe("unknown");
    expect(
      clientIp(req("/api/events", "GET", { "x-real-ip": "  ", "x-forwarded-for": " , " }))
    ).toBe("unknown");
  });
});

// ─── The 429 ─────────────────────────────────────────────────────────────────

describe("tooManyRequests", () => {
  it("builds the existing 429 body and the four rate-limit headers", async () => {
    const res = tooManyRequests(30, 61_000, 1_000);
    expect(await snapshot(res)).toEqual({
      status: 429,
      body: {
        error: "Too Many Requests",
        message: "Rate limit exceeded. Try again in 60 seconds.",
      },
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "61",
      },
    });
  });

  it("says 'second' in the singular and never advertises less than one", async () => {
    const one = await snapshot(tooManyRequests(30, 10_400, 10_000));
    expect(one?.headers["Retry-After"]).toBe("1");
    expect(one?.body).toEqual({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again in 1 second.",
    });
    const past = await snapshot(tooManyRequests(30, 9_000, 10_000));
    expect(past?.headers["Retry-After"]).toBe("1");
  });
});

// ─── The async entry point ───────────────────────────────────────────────────

describe("applyRateLimit with the memory store", () => {
  it("getRateLimitStore returns one memory store instance", () => {
    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(MemoryRateLimitStore);
    expect(getRateLimitStore()).toBe(store);
  });

  it("passes a non-/api request without consulting the store", async () => {
    const consume = jest.fn();
    const spy: RateLimitStore = { consume };
    expect(await applyRateLimit(req("/profile", "POST"), spy)).toBeNull();
    expect(consume).not.toHaveBeenCalled();
  });

  it("builds the 429 from the store's decision", async () => {
    jest.spyOn(Date, "now").mockReturnValue(100_000);
    const store: RateLimitStore = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        limit: 120,
        resetAtMs: 130_000,
      }),
    };
    const res = await applyRateLimit(
      fromIp("/api/admin/users/u1/ban", "POST", nextIp()),
      store
    );
    expect(await snapshot(res)).toEqual({
      status: 429,
      body: {
        error: "Too Many Requests",
        message: "Rate limit exceeded. Try again in 30 seconds.",
      },
      headers: {
        "Retry-After": "30",
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "130",
      },
    });
  });

  it("the 601st admin GET from one IP to one path is answered 429 with X-RateLimit-Limit 600", async () => {
    const ip = nextIp();
    const store = new MemoryRateLimitStore();
    for (let i = 1; i <= 600; i++) {
      expect(await applyRateLimit(fromIp("/api/admin/users", "GET", ip), store)).toBeNull();
    }
    const blocked = await applyRateLimit(fromIp("/api/admin/users", "GET", ip), store);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("X-RateLimit-Limit")).toBe("600");
    expect(blocked?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
    expect(await blocked?.json()).toMatchObject({ error: "Too Many Requests" });

    // Per path: the same address still has a fresh budget on another admin path.
    expect(await applyRateLimit(fromIp("/api/admin/stats", "GET", ip), store)).toBeNull();
  });

  it("the 121st admin POST from one IP to one path is answered 429 with X-RateLimit-Limit 120", async () => {
    const ip = nextIp();
    const store = new MemoryRateLimitStore();
    const path = "/api/admin/events/e1/status";
    for (let i = 1; i <= 120; i++) {
      expect(await applyRateLimit(fromIp(path, "POST", ip), store)).toBeNull();
    }
    const blocked = await applyRateLimit(fromIp(path, "POST", ip), store);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(blocked?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(await blocked?.json()).toMatchObject({ error: "Too Many Requests" });

    // Per address: another IP is unaffected.
    expect(await applyRateLimit(fromIp(path, "POST", nextIp()), store)).toBeNull();
  });

  it("the synchronous wrapper still exempts /api/admin/* while the async path limits it", async () => {
    const syncIp = nextIp();
    for (let i = 0; i < 130; i++) {
      expect(applyApiRateLimit(fromIp("/api/admin/users/u2", "PATCH", syncIp))).toBeNull();
    }
    const asyncIp = nextIp();
    const store = new MemoryRateLimitStore();
    let last: Response | null = null;
    for (let i = 0; i < 121; i++) {
      last = await applyRateLimit(fromIp("/api/admin/users/u2", "PATCH", asyncIp), store);
    }
    expect(last?.status).toBe(429);
  });
});

// ─── Equivalence: one copy of the budgets ────────────────────────────────────

describe("the async path and the synchronous wrapper decide identically on public requests", () => {
  const TABLE: Array<{ path: string; method: string; budget: number }> = [
    { path: "/api/events", method: "GET", budget: 300 },
    { path: "/api/events/x/save", method: "POST", budget: 30 },
    { path: "/api/events/x/save", method: "DELETE", budget: 30 },
    { path: "/api/users/u1", method: "PATCH", budget: 30 },
    { path: "/api/events/x/rsvp", method: "HEAD", budget: 30 },
    { path: "/api/interactions", method: "POST", budget: 300 },
    { path: "/api/recommendations/feedback", method: "POST", budget: 300 },
    { path: "/profile", method: "POST", budget: 30 },
  ];

  it.each(TABLE)(
    "$method $path: the same decision and headers on every call up to budget + 2",
    async ({ path, method, budget }) => {
      jest.spyOn(Date, "now").mockReturnValue(FROZEN_NOW);
      const syncIp = nextIp();
      const asyncIp = nextIp();
      const store = getRateLimitStore();

      for (let i = 1; i <= budget + 2; i++) {
        const fromSync = await snapshot(applyApiRateLimit(fromIp(path, method, syncIp)));
        const fromAsync = await snapshot(
          await applyRateLimit(fromIp(path, method, asyncIp), store)
        );
        expect(fromAsync).toEqual(fromSync);
      }

      const last = await snapshot(applyApiRateLimit(fromIp(path, method, syncIp)));
      if (path.startsWith("/api/")) {
        expect(last?.status).toBe(429);
        expect(last?.headers["X-RateLimit-Limit"]).toBe(String(budget));
        expect(last?.headers["X-RateLimit-Reset"]).toBe(
          String(Math.ceil((FROZEN_NOW + WINDOW_MS) / 1000))
        );
      } else {
        expect(last).toBeNull();
      }
    }
  );
});
