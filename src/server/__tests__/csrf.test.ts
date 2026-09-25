/**
 * The CSRF origin check (plan 05-17, DEC-52, F-090, REFAC-17).
 *
 * `isCrossSiteMutation(req)` is a pure predicate over the method, the path,
 * `Sec-Fetch-Site`, `Origin` and the host headers. These cases pin every arm:
 *   - safe methods (GET, HEAD, OPTIONS) and non-/api paths are never checked;
 *   - `Sec-Fetch-Site: cross-site` on a mutation is refused;
 *   - an `Origin` whose host differs from `x-forwarded-host`, else `host`,
 *     else the URL's host, is refused, and so are the literal "null" Origin
 *     and one that does not parse;
 *   - a same-origin request passes, and so does one carrying neither header
 *     (curl, cron callers, server-to-server), which DEC-52 keeps open.
 */

import { NextRequest } from "next/server";
import { crossSiteBlocked, isCrossSiteMutation } from "@/server/csrf";
import { proxy } from "@/proxy";

// The proxy cases at the end of this file build no real Supabase client: an
// anonymous scripted client stands in, and the placeholders below are the only
// environment values used (never read from .env.local).
const mockCreateServerClient = jest.fn();
jest.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

function req(
  path: string,
  method: string,
  headers: Record<string, string> = {},
  base = "https://uni-verse.test"
): NextRequest {
  return new NextRequest(`${base}${path}`, { method, headers });
}

const SAVE = "/api/events/e1/save";

describe("isCrossSiteMutation", () => {
  it.each(["GET", "HEAD", "OPTIONS"])(
    "never treats %s as a mutation, whatever the headers say",
    (method) => {
      expect(
        isCrossSiteMutation(
          req(SAVE, method, {
            "sec-fetch-site": "cross-site",
            origin: "https://evil.example",
          })
        )
      ).toBe(false);
    }
  );

  it.each(["/profile", "/auth/signout", "/api", "/apix/events"])(
    "never checks a path outside /api/ (%s)",
    (path) => {
      expect(
        isCrossSiteMutation(
          req(path, "POST", {
            "sec-fetch-site": "cross-site",
            origin: "https://evil.example",
          })
        )
      ).toBe(false);
    }
  );

  it.each(["POST", "PUT", "PATCH", "DELETE", "patch"])(
    "refuses %s /api/* with Sec-Fetch-Site: cross-site",
    (method) => {
      expect(
        isCrossSiteMutation(req(SAVE, method, { "sec-fetch-site": "cross-site" }))
      ).toBe(true);
    }
  );

  it("refuses Sec-Fetch-Site: cross-site even when the Origin matches", () => {
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", {
          "sec-fetch-site": "cross-site",
          origin: "https://uni-verse.test",
        })
      )
    ).toBe(true);
  });

  it("refuses a foreign Origin against the URL's host when no host header is set", () => {
    expect(
      isCrossSiteMutation(req(SAVE, "POST", { origin: "https://evil.example" }))
    ).toBe(true);
  });

  it("refuses an Origin that differs from the host header", () => {
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", {
          host: "uni-verse.test",
          origin: "https://uni-verse.test.evil.example",
        })
      )
    ).toBe(true);
  });

  it("refuses an Origin on another port of the same host name", () => {
    expect(
      isCrossSiteMutation(
        req(
          SAVE,
          "POST",
          { host: "127.0.0.1:3000", origin: "http://127.0.0.1:4000" },
          "http://127.0.0.1:3000"
        )
      )
    ).toBe(true);
  });

  it("prefers x-forwarded-host over host: an Origin matching only host is refused", () => {
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", {
          "x-forwarded-host": "uni-verse.app",
          host: "internal.vercel.test",
          origin: "https://internal.vercel.test",
        })
      )
    ).toBe(true);
  });

  it.each(["null", "not a url", "://", "evil.example"])(
    "refuses the unparseable or opaque Origin %p",
    (origin) => {
      expect(isCrossSiteMutation(req(SAVE, "POST", { origin }))).toBe(true);
    }
  );

  it("passes a same-origin Origin against the URL's host", () => {
    expect(
      isCrossSiteMutation(req(SAVE, "POST", { origin: "https://uni-verse.test" }))
    ).toBe(false);
  });

  it("passes a same-origin Origin against the host header, case-insensitively", () => {
    expect(
      isCrossSiteMutation(
        req(
          SAVE,
          "DELETE",
          { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
          "http://127.0.0.1:3000"
        )
      )
    ).toBe(false);
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", { host: "Uni-Verse.TEST", origin: "https://uni-verse.test" })
      )
    ).toBe(false);
  });

  it("passes when x-forwarded-host names the same host as the Origin", () => {
    expect(
      isCrossSiteMutation(
        req(SAVE, "PATCH", {
          "x-forwarded-host": "uni-verse.app",
          host: "internal.vercel.test",
          origin: "https://uni-verse.app",
        })
      )
    ).toBe(false);
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", {
          "x-forwarded-host": "uni-verse.app, internal.vercel.test",
          origin: "https://uni-verse.app",
        })
      )
    ).toBe(false);
  });

  it.each(["same-origin", "none", "same-site"])(
    "passes Sec-Fetch-Site %s with a matching Origin",
    (site) => {
      expect(
        isCrossSiteMutation(
          req(SAVE, "POST", {
            "sec-fetch-site": site,
            origin: "https://uni-verse.test",
          })
        )
      ).toBe(false);
    }
  );

  it.each(["same-origin", "none"])(
    "passes Sec-Fetch-Site %s with no Origin",
    (site) => {
      expect(
        isCrossSiteMutation(req(SAVE, "POST", { "sec-fetch-site": site }))
      ).toBe(false);
    }
  );

  it("refuses Sec-Fetch-Site same-site when the Origin is a sibling host", () => {
    expect(
      isCrossSiteMutation(
        req(SAVE, "POST", {
          "sec-fetch-site": "same-site",
          origin: "https://blog.uni-verse.test",
        })
      )
    ).toBe(true);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "passes %s carrying neither Origin nor Sec-Fetch-Site (machine callers)",
    (method) => {
      expect(isCrossSiteMutation(req(SAVE, method))).toBe(false);
      expect(
        isCrossSiteMutation(req("/api/cron/send-reminders", method, { authorization: "Bearer x" }))
      ).toBe(false);
    }
  );
});

describe("crossSiteBlocked", () => {
  it("answers 403 with the JSON error body", async () => {
    const res = crossSiteBlocked();
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Cross-site request blocked" });
  });
});

describe("the proxy runs the check after the rate limiter and before session work", () => {
  const savedEnv = { ...process.env };
  let ip = 0;
  const nextIp = () => `10.170.0.${++ip}`;

  beforeEach(() => {
    mockCreateServerClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
    mockCreateServerClient.mockImplementation(() => ({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    }));
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it.each<Record<string, string>>([
    { origin: "https://evil.example" },
    { "sec-fetch-site": "cross-site" },
  ])("answers 403 to a cross-site POST %p without building a Supabase client", async (headers) => {
    const res = await proxy(
      req(SAVE, "POST", { ...headers, "x-forwarded-for": nextIp() })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Cross-site request blocked" });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("does not answer a missing environment first: the check needs no env", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await proxy(
      req(SAVE, "POST", { origin: "https://evil.example", "x-forwarded-for": nextIp() })
    );
    expect(res.status).toBe(403);
  });

  it.each<Record<string, string>>([
    { origin: "https://uni-verse.test" },
    {},
  ])("lets a same-origin or header-less POST %p through to session work", async (headers) => {
    const res = await proxy(
      req(SAVE, "POST", { ...headers, "x-forwarded-for": nextIp() })
    );
    expect(res.status).not.toBe(403);
    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
  });

  it("answers the rate limit before the origin check", async () => {
    const addr = nextIp();
    const cross = () =>
      proxy(req(SAVE, "POST", { origin: "https://evil.example", "x-forwarded-for": addr }));
    for (let i = 0; i < 30; i++) expect((await cross()).status).toBe(403);
    expect((await cross()).status).toBe(429);
  });
});
