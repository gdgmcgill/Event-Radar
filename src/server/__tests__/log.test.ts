/**
 * Unit tests for the structured logger (REFAC-20, DEC-74).
 *
 * One call writes one JSON line. info and debug go through `console.log`,
 * warn and error through `console.error`, so a suite that only silences or
 * counts console calls keeps working. The request store supplies requestId and
 * route; fields never carry cookies, tokens, passwords, bodies or emails.
 */

import { currentRequestId, log, redact, runWithRequest } from "../log";

type Line = Record<string, unknown>;

function lines(spy: jest.SpyInstance): Line[] {
  return spy.mock.calls.map((call: unknown[]) => {
    expect(call).toHaveLength(1);
    expect(typeof call[0]).toBe("string");
    return JSON.parse(call[0] as string) as Line;
  });
}

const REQUEST_ID = "3f1c9a52-7d44-4b8e-9d0a-6f2b1e8c4a10";

describe("log", () => {
  let out: jest.SpyInstance;
  let err: jest.SpyInstance;

  beforeEach(() => {
    out = jest.spyOn(console, "log").mockImplementation(() => {});
    err = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    out.mockRestore();
    err.mockRestore();
  });

  it("writes one console.log call carrying one JSON line for info inside a request store", () => {
    runWithRequest({ requestId: REQUEST_ID, route: "/api/events" }, () => {
      log.info("x", { a: 1 });
    });

    expect(out).toHaveBeenCalledTimes(1);
    expect(err).not.toHaveBeenCalled();
    const [line] = lines(out);
    expect(line).toMatchObject({
      level: "info",
      msg: "x",
      requestId: REQUEST_ID,
      route: "/api/events",
      a: 1,
    });
    expect(typeof line.ts).toBe("string");
    expect(new Date(line.ts as string).toISOString()).toBe(line.ts);
  });

  it("orders the line ts, level, msg, requestId, route, scope, then the fields", () => {
    runWithRequest({ requestId: REQUEST_ID, route: "/r" }, () => {
      log.info("m", { z: 1, scope: "Auth" });
    });
    const [line] = lines(out);
    expect(Object.keys(line)).toEqual([
      "ts",
      "level",
      "msg",
      "requestId",
      "route",
      "scope",
      "z",
    ]);
  });

  it("sends debug to console.log and warn and error to console.error", () => {
    log.debug("d");
    log.warn("w");
    log.error("e");

    expect(lines(out).map((l) => l.level)).toEqual(["debug"]);
    expect(lines(err).map((l) => l.level)).toEqual(["warn", "error"]);
  });

  it("omits requestId and route outside a request store", () => {
    log.info("outside");
    const [line] = lines(out);
    expect(line).not.toHaveProperty("requestId");
    expect(line).not.toHaveProperty("route");
  });

  it("carries scope from the scope field", () => {
    log.error("Error", { scope: "Middleware" });
    const [line] = lines(err);
    expect(line.scope).toBe("Middleware");
  });

  it("never lets a field overwrite ts, level or msg", () => {
    log.info("kept", { level: "error", msg: "forged", ts: "then" });
    const [line] = lines(out);
    expect(line.level).toBe("info");
    expect(line.msg).toBe("kept");
    expect(line.ts).not.toBe("then");
  });

  it("serializes an Error field to { name, message, code }", () => {
    const failure = Object.assign(new TypeError("boom"), { code: "PGRST301" });
    log.error("failed", { error: failure });
    const [line] = lines(err);
    expect(line.error).toEqual({
      name: "TypeError",
      message: "boom",
      code: "PGRST301",
    });
  });

  it("omits code from a serialized Error that has none, and never includes the stack", () => {
    log.error("failed", { error: new Error("plain") });
    const [line] = lines(err);
    expect(line.error).toEqual({ name: "Error", message: "plain" });
    expect(JSON.stringify(line)).not.toContain("at ");
  });

  it.each([
    "cookie",
    "authorization",
    "password",
    "token",
    "access_token",
    "refresh_token",
    "email",
    "body",
  ])("redacts the %s key", (key) => {
    log.info("keys", { [key]: "sb-secret-value", nested: { [key]: "x" } });
    const [line] = lines(out);
    expect(line[key]).toBe("[redacted]");
    expect(line.nested).toEqual({ [key]: "[redacted]" });
    expect(JSON.stringify(line)).not.toContain("sb-secret-value");
  });

  it("redacts a cookie key whatever its case", () => {
    log.info("headers", { headers: { Cookie: "sb-access=abc", Authorization: "Bearer t" } });
    const [line] = lines(out);
    expect(line.headers).toEqual({
      Cookie: "[redacted]",
      Authorization: "[redacted]",
    });
  });

  it("replaces an email inside the message with [email]", () => {
    log.warn("lookup failed for x@mcgill.ca today");
    const [line] = lines(err);
    expect(line.msg).toBe("lookup failed for [email] today");
  });

  it("replaces an email inside any string field, an array or an Error message", () => {
    log.error("m", {
      detail: "user x@mcgill.ca missing",
      list: ["a", "y.z@mail.mcgill.ca"],
      error: new Error("duplicate key for x@mcgill.ca"),
    });
    const [line] = lines(err);
    expect(line.detail).toBe("user [email] missing");
    expect(line.list).toEqual(["a", "[email]"]);
    expect((line.error as Line).message).toBe("duplicate key for [email]");
    expect(JSON.stringify(line)).not.toContain("mcgill.ca");
  });

  it("keeps a newline in msg inside the one line (no log injection)", () => {
    log.info('first\n{"level":"error","msg":"forged"}');
    expect(out).toHaveBeenCalledTimes(1);
    const raw = out.mock.calls[0][0] as string;
    expect(raw).not.toContain("\n");
    expect(JSON.parse(raw).msg).toBe('first\n{"level":"error","msg":"forged"}');
  });

  it("never throws on an unserializable field", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => log.info("odd", { big: BigInt(1), cyclic })).not.toThrow();
    expect(out).toHaveBeenCalledTimes(1);
    expect(JSON.parse(out.mock.calls[0][0] as string).msg).toBe("odd");
  });
});

describe("runWithRequest and currentRequestId", () => {
  it("returns the store's id inside, across an await, and undefined outside", async () => {
    expect(currentRequestId()).toBeUndefined();
    const seen = await runWithRequest({ requestId: REQUEST_ID }, async () => {
      await Promise.resolve();
      return currentRequestId();
    });
    expect(seen).toBe(REQUEST_ID);
    expect(currentRequestId()).toBeUndefined();
  });

  it("returns the callback's value", () => {
    expect(runWithRequest({ requestId: REQUEST_ID }, () => 42)).toBe(42);
  });
});

describe("redact", () => {
  it("leaves numbers, booleans and null alone", () => {
    expect(redact({ n: 1, b: true, z: null })).toEqual({ n: 1, b: true, z: null });
  });

  it("does not mutate its input", () => {
    const input = { password: "p", inner: { email: "a@b.co" } };
    redact(input);
    expect(input).toEqual({ password: "p", inner: { email: "a@b.co" } });
  });
});
