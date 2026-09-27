/**
 * Unit tests for `withRoute` (DEC-73, DEC-74, F-058, REFAC-19, REFAC-20).
 *
 * The wrapper runs a handler inside the request's store, echoes a UUID-shaped
 * x-request-id (and mints one otherwise), applies the handler's cache class on
 * every return path, and turns an uncaught throw into the seam's JSON 500 with
 * one error log line. The wrapped export keeps the handler's parameter list.
 */

import { NextRequest, NextResponse } from "next/server";
import { currentRequestId } from "../log";
import { withRoute } from "../route";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INCOMING = "0b7e3d2a-5c1f-4e8a-9b6d-2f4a8c1e7d30";

function request(
  path: string,
  { method = "GET", id }: { method?: string; id?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};
  if (id !== undefined) headers["x-request-id"] = id;
  return new NextRequest(`https://route.test${path}`, { method, headers });
}

type Params = { params: Promise<{ id: string }> };
const params = (id: string): Params => ({ params: Promise.resolve({ id }) });

// ─── Type-level: the wrapped export keeps the handler's exact parameters ─────

type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type Handler = (req: NextRequest, ctx: Params) => Promise<Response>;
const typedHandler: Handler = async () => new Response(null, { status: 204 });
const wrappedTyped = withRoute({ cache: "private" }, typedHandler);
const assignableTo: Handler = wrappedTyped;
const assignableFrom: typeof wrappedTyped = typedHandler;
const sameType: Equals<typeof wrappedTyped, Handler> = true;

const wrappedZero = withRoute({ cache: "private" }, async () =>
  NextResponse.json({ ok: true })
);
const zeroArgs: Equals<Parameters<typeof wrappedZero>, []> = true;

// @ts-expect-error a handler typed with (req, ctx) cannot be called with no arguments
void (() => wrappedTyped());

describe("withRoute: types", () => {
  it("keeps the handler's parameter list (checked by tsc)", () => {
    expect([assignableTo, assignableFrom, sameType, zeroArgs]).toEqual([
      expect.any(Function),
      expect.any(Function),
      true,
      true,
    ]);
  });
});

// ─── Runtime ─────────────────────────────────────────────────────────────────

describe("withRoute: request id", () => {
  it("echoes a UUID-shaped incoming x-request-id and exposes it to the handler", async () => {
    let seen: string | undefined;
    const GET = withRoute({ cache: "private" }, async (_req: NextRequest) => {
      seen = currentRequestId();
      return NextResponse.json({ ok: true });
    });

    const res = await GET(request("/api/x", { id: INCOMING }));

    expect(res.headers.get("x-request-id")).toBe(INCOMING);
    expect(seen).toBe(INCOMING);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not a uuid", "hello"],
    // Fetch refuses a newline in a header value, so the realistic smuggling
    // shape is a repeated header, which arrives comma-joined.
    ["two ids comma-joined", `${INCOMING}, ${INCOMING}`],
    ["too long", `${INCOMING}0`],
  ])("mints a fresh UUID when the incoming id is %s", async (_label, id) => {
    let seen: string | undefined;
    const GET = withRoute({ cache: "private" }, async (_req: NextRequest) => {
      seen = currentRequestId();
      return NextResponse.json({ ok: true });
    });

    const res = await GET(request("/api/x", { id }));
    const header = res.headers.get("x-request-id");

    expect(header).toMatch(UUID);
    expect(header).not.toBe(INCOMING);
    expect(seen).toBe(header);
  });

  it("mints an id for a zero-argument handler", async () => {
    const res = await wrappedZero();
    expect(res.headers.get("x-request-id")).toMatch(UUID);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes the handler's arguments through untouched", async () => {
    const GET = withRoute(
      { cache: "private" },
      async (_req: NextRequest, { params: p }: Params) => {
        const { id } = await p;
        return NextResponse.json({ id });
      }
    );
    const res = await GET(request("/api/x/abc"), params("abc"));
    await expect(res.json()).resolves.toEqual({ id: "abc" });
  });
});

describe("withRoute: uncaught throw (F-058)", () => {
  let err: jest.SpyInstance;
  beforeEach(() => {
    err = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => err.mockRestore());

  it("answers the seam's JSON 500 with the cache header and the incoming id, and logs one error line", async () => {
    const GET = withRoute({ cache: "public-60-300" }, async (_req: NextRequest) => {
      throw new Error("relation \"events\" does not exist");
    });

    const res = await GET(request("/api/clubs", { id: INCOMING }));

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Failed to process request"}');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-request-id")).toBe(INCOMING);

    expect(err).toHaveBeenCalledTimes(1);
    const line = JSON.parse(err.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      level: "error",
      msg: "unhandled route error",
      requestId: INCOMING,
      route: "/api/clubs",
      error: { name: "Error", message: 'relation "events" does not exist' },
    });
  });

  it("uses the action when given", async () => {
    const POST = withRoute(
      { cache: "private", action: "create event" },
      async (_req: NextRequest) => {
        throw new TypeError("x is undefined");
      }
    );
    const res = await POST(request("/api/events/create", { method: "POST" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to create event" });
  });

  it("does not log on a returned 500", async () => {
    const GET = withRoute({ cache: "private" }, async (_req: NextRequest) =>
      NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    );
    const res = await GET(request("/api/x"));
    expect(res.status).toBe(500);
    expect(err).not.toHaveBeenCalled();
  });
});

describe("withRoute: cache classes on every path", () => {
  it("sets the public value on a GET 200 of a public class", async () => {
    const GET = withRoute({ cache: "public-30-60" }, async (_req: NextRequest) =>
      NextResponse.json([])
    );
    const res = await GET(request("/api/events"));
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=30, stale-while-revalidate=60"
    );
  });

  it("sets private, no-store on a 401 of a public class", async () => {
    const GET = withRoute({ cache: "public-60-300" }, async (_req: NextRequest) =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(request("/api/clubs"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sets private, no-store on a POST of a public class", async () => {
    const POST = withRoute({ cache: "public-60-300" }, async (_req: NextRequest) =>
      NextResponse.json({ id: "c" }, { status: 201 })
    );
    const res = await POST(request("/api/clubs", { method: "POST" }));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("overrides a Cache-Control the handler set itself", async () => {
    const GET = withRoute({ cache: "private" }, async (_req: NextRequest) =>
      NextResponse.json([], {
        headers: { "Cache-Control": "public, s-maxage=60" },
      })
    );
    const res = await GET(request("/api/x"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("never sets Vary", async () => {
    const GET = withRoute({ cache: "public-60-120" }, async (_req: NextRequest) =>
      NextResponse.json([])
    );
    const res = await GET(request("/api/events/featured"));
    expect(res.headers.get("vary")).toBeNull();
  });

  it("stamps a response whose headers are immutable, keeping status, body and headers", async () => {
    const GET = withRoute({ cache: "private" }, async (_req: NextRequest) =>
      Response.redirect("https://route.test/elsewhere", 307)
    );
    const res = await GET(request("/auth/x", { id: INCOMING }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://route.test/elsewhere");
    expect(res.headers.get("x-request-id")).toBe(INCOMING);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
