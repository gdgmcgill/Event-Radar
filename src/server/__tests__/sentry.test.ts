/**
 * Sentry on the server: the scrubber, the user hash, the capture helper, and
 * the transport proof that a thrown error reaches Sentry carrying the
 * request's correlation id (REFAC-21, DEC-76, threats T-06-16-01/02/03).
 *
 * Phase 06 · plan 06-16.
 *
 * THE TRANSPORT PROOF (research A3)
 *   The real SDK is initialized with the real posture from
 *   `sentryServerOptions()` (src/sentry.server.config.ts) and ONE substitution:
 *   an in-memory transport built with the SDK's own `createTransport`, so every
 *   envelope the SDK would send is captured here and nothing leaves the
 *   process. The DSN's host is under `.invalid` (RFC 2606), so even a
 *   misrouted transport could not reach a real Sentry. The default
 *   integrations are narrowed to those that do not install process-wide
 *   handlers or patch Node's http stack inside the Jest worker; the posture
 *   (dsn, enabled, sendDefaultPii, environment, release, tracesSampleRate,
 *   beforeSend) is exactly what production uses.
 *
 *   A positive control records the event as `beforeSend` receives it, before
 *   the scrubber runs: it must carry the cookies, body, query string and email
 *   the Next request layer would attach. Without that control "no cookies in
 *   the event" could pass because nothing was ever there.
 */

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent, Event, EventHint } from "@sentry/nextjs";
import { captureServerError, hashUserId, scrubEvent } from "@/server/observability/sentry";
import { withRoute } from "@/server/route";
import { sentryServerOptions } from "@/sentry.server.config";

const EMAIL_SHAPE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const TEST_DSN = "https://0000aaaa@o0.ingest.sentry.invalid/1";
const RELEASE = "0123456789abcdef0123456789abcdef01234567";
const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const STUDENT_EMAIL = "student.one@mail.mcgill.ca";

// ─── The in-memory transport ─────────────────────────────────────────────────

type EnvelopeItem = { header: Record<string, unknown>; payload: unknown };

const sentEnvelopes: EnvelopeItem[][] = [];
const beforeScrub: Event[] = [];

function decode(body: string | Uint8Array): string {
  return typeof body === "string" ? body : new TextDecoder().decode(body);
}

/** Parses a serialized envelope: a header line, then item-header/payload pairs. */
function parseEnvelope(raw: string): EnvelopeItem[] {
  const lines = raw.split("\n").filter((line) => line.length > 0);
  const items: EnvelopeItem[] = [];
  for (let i = 1; i + 1 < lines.length; i += 2) {
    items.push({ header: JSON.parse(lines[i]), payload: JSON.parse(lines[i + 1]) });
  }
  return items;
}

function sentEvents(): ErrorEvent[] {
  return sentEnvelopes
    .flat()
    .filter((item) => item.header.type === "event")
    .map((item) => item.payload as ErrorEvent);
}

const inMemoryTransport = (
  options: Parameters<typeof Sentry.createTransport>[0]
): ReturnType<typeof Sentry.createTransport> =>
  Sentry.createTransport(options, async (request) => {
    sentEnvelopes.push(parseEnvelope(decode(request.body)));
    return { statusCode: 200 };
  });

/** Integrations that neither register process handlers nor patch http in the worker. */
const KEPT_INTEGRATIONS = new Set([
  "InboundFilters",
  "FunctionToString",
  "LinkedErrors",
  "RequestData",
  "Dedupe",
]);

const env = process.env as Record<string, string | undefined>;
const savedEnv = {
  VERCEL_ENV: env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_SHA: env.VERCEL_GIT_COMMIT_SHA,
};

let errorSpy: jest.SpyInstance;

beforeAll(() => {
  env.VERCEL_ENV = "preview";
  env.VERCEL_GIT_COMMIT_SHA = RELEASE;
  const options = sentryServerOptions(TEST_DSN);
  const scrub = options.beforeSend as (event: ErrorEvent, hint: EventHint) => ErrorEvent | null;
  Sentry.init({
    ...options,
    transport: inMemoryTransport,
    integrations: (defaults) => defaults.filter((i) => KEPT_INTEGRATIONS.has(i.name)),
    beforeSend: (event, hint) => {
      beforeScrub.push(JSON.parse(JSON.stringify(event)) as Event);
      return scrub(event, hint);
    },
  });
});

afterAll(async () => {
  await Sentry.close(2000);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

beforeEach(() => {
  sentEnvelopes.length = 0;
  beforeScrub.length = 0;
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

// ─── Unit rows ───────────────────────────────────────────────────────────────

describe("hashUserId", () => {
  it("is the hex SHA-256 of the id", () => {
    const expected = createHash("sha256").update(USER_ID).digest("hex");
    expect(hashUserId(USER_ID)).toBe(expected);
    expect(hashUserId(USER_ID)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashUserId(USER_ID)).not.toContain(USER_ID);
  });
});

describe("scrubEvent", () => {
  it("replaces the user with { id: sha256(id) } and drops every other user field", () => {
    const event = {
      event_id: "e",
      user: { id: USER_ID, email: STUDENT_EMAIL, ip_address: "203.0.113.9", username: "s1" },
    } as unknown as ErrorEvent;
    expect(scrubEvent(event).user).toEqual({ id: hashUserId(USER_ID) });
  });

  it("removes a user that has no id", () => {
    const event = { event_id: "e", user: { email: STUDENT_EMAIL } } as unknown as ErrorEvent;
    expect(scrubEvent(event)).not.toHaveProperty("user");
  });

  it("applies the shared field scrubber (cookies, data, query string, emails)", () => {
    const event = {
      event_id: "e",
      message: `boom for ${STUDENT_EMAIL}`,
      request: { url: "https://x.example/a?b=c", cookies: { a: "b" }, data: "{}", query_string: "b=c" },
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.message).toBe("boom for [email]");
    expect(scrubbed.request).toEqual({ url: "https://x.example/a" });
  });
});

describe("sentryServerOptions (the decided posture, DEC-76)", () => {
  it("has sendDefaultPii false, tracesSampleRate 0, the scrubber, and VERCEL_ENV / VERCEL_GIT_COMMIT_SHA", () => {
    const options = sentryServerOptions(TEST_DSN);
    expect(options).toMatchObject({
      dsn: TEST_DSN,
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: "preview",
      release: RELEASE,
    });
    expect(options.beforeSend).toBe(scrubEvent);
  });

  it("is disabled with no DSN, and the environment defaults to development", () => {
    const saved = env.VERCEL_ENV;
    delete env.VERCEL_ENV;
    try {
      const options = sentryServerOptions(null);
      expect(options.enabled).toBe(false);
      expect(options.dsn).toBeUndefined();
      expect(options.environment).toBe("development");
    } finally {
      env.VERCEL_ENV = saved;
    }
  });
});

// ─── The transport proof ─────────────────────────────────────────────────────

describe("transport proof: a thrown error in a withRoute handler reaches Sentry with its request id", () => {
  const REQUEST_ID = "3f0c2b1a-9d8e-4f7a-8b6c-5d4e3f2a1b0c";

  async function throwThroughTheWrapper(): Promise<Response> {
    const handler = withRoute({ cache: "private", action: "probe" }, async (_request: Request) => {
      throw new Error(`insert failed for ${STUDENT_EMAIL}`);
    });
    const request = new Request(
      `http://127.0.0.1:3000/api/probe?email=${encodeURIComponent(STUDENT_EMAIL)}&page=2`,
      {
        method: "POST",
        headers: {
          "x-request-id": REQUEST_ID,
          cookie: "sb-access-token=secret-cookie-value",
          authorization: "Bearer secret-bearer",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: STUDENT_EMAIL, password: "hunter2" }),
      }
    );
    // What Next's request layer puts on the isolation scope for a real
    // request (the http integration is not installed in the worker), and a
    // user the way any code path calling Sentry.setUser would.
    return Sentry.withIsolationScope(async (isolation) => {
      isolation.setSDKProcessingMetadata({
        normalizedRequest: {
          url: request.url,
          method: "POST",
          query_string: `email=${STUDENT_EMAIL}&page=2`,
          headers: {
            "x-request-id": REQUEST_ID,
            cookie: "sb-access-token=secret-cookie-value",
            authorization: "Bearer secret-bearer",
            "x-forwarded-for": "203.0.113.9",
            "user-agent": "jest",
          },
          cookies: { "sb-access-token": "secret-cookie-value" },
          data: JSON.stringify({ email: STUDENT_EMAIL, password: "hunter2" }),
        },
      });
      isolation.setUser({ id: USER_ID, email: STUDENT_EMAIL });
      const response = await handler(request);
      await Sentry.flush(2000);
      return response;
    });
  }

  it("answers the wrapper's JSON 500 carrying x-request-id", async () => {
    const response = await throwThroughTheWrapper();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to probe" });
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
  });

  it("sends exactly one event whose tag request_id equals the response's x-request-id", async () => {
    const response = await throwThroughTheWrapper();
    const events = sentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].tags).toMatchObject({
      request_id: response.headers.get("x-request-id"),
      route: "/api/probe",
    });
    expect(events[0].tags?.request_id).toBe(REQUEST_ID);
  });

  it("carries environment (VERCEL_ENV) and release (VERCEL_GIT_COMMIT_SHA)", async () => {
    await throwThroughTheWrapper();
    const [event] = sentEvents();
    expect(event.environment).toBe("preview");
    expect(event.release).toBe(RELEASE);
  });

  it("positive control: before the scrubber the event carries cookies, body, query string and an email", async () => {
    await throwThroughTheWrapper();
    expect(beforeScrub).toHaveLength(1);
    const raw = beforeScrub[0];
    expect(raw.request).toHaveProperty("cookies");
    expect(raw.request).toHaveProperty("data");
    expect(raw.request).toHaveProperty("query_string");
    expect(JSON.stringify(raw)).toMatch(EMAIL_SHAPE);
    expect(JSON.stringify(raw)).toContain("secret-cookie-value");
    expect(raw.user).toMatchObject({ id: USER_ID });
  });

  it("the sent event has no request cookies, data or query string, and no cookie or authorization header", async () => {
    await throwThroughTheWrapper();
    const [event] = sentEvents();
    expect(event.request).toBeDefined();
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("data");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.request?.url).toBe("http://127.0.0.1:3000/api/probe");
    const headerNames = Object.keys(event.request?.headers ?? {}).map((name) => name.toLowerCase());
    expect(headerNames).not.toContain("cookie");
    expect(headerNames).not.toContain("authorization");
    expect(headerNames).not.toContain("x-forwarded-for");
  });

  it("the sent envelope contains no email, cookie value, bearer, password or raw user id anywhere", async () => {
    await throwThroughTheWrapper();
    const serialized = JSON.stringify(sentEnvelopes);
    expect(serialized).not.toMatch(EMAIL_SHAPE);
    expect(serialized).not.toContain("secret-cookie-value");
    expect(serialized).not.toContain("secret-bearer");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain("203.0.113.9");
  });

  it("the sent user is only the SHA-256 of the id", async () => {
    await throwThroughTheWrapper();
    const [event] = sentEvents();
    expect(event.user).toEqual({ id: hashUserId(USER_ID) });
  });

  it("the exception value keeps its text with the email redacted", async () => {
    await throwThroughTheWrapper();
    const [event] = sentEvents();
    expect(event.exception?.values?.[0]?.value).toBe("insert failed for [email]");
  });
});

describe("transport proof: the proxy's fail-closed 500 reaches Sentry with its request id", () => {
  const SUPABASE_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of SUPABASE_KEYS) {
      saved[key] = env[key];
      delete env[key];
    }
  });

  afterEach(() => {
    for (const key of SUPABASE_KEYS) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  });

  it("a missing Supabase URL (MissingEnvError in the ring) is one event tagged with the response's id", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/events?ref=mail"));
    await Sentry.flush(2000);
    expect(response.status).toBe(500);
    const id = response.headers.get("x-request-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const events = sentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].tags).toMatchObject({ request_id: id, route: "/events" });
    expect(events[0].exception?.values?.[0]?.type).toBe("MissingEnvError");
  });
});

describe("captureServerError", () => {
  it("omits the request_id tag when no id is known, and still captures", async () => {
    captureServerError(new Error("no id"), {});
    await Sentry.flush(2000);
    const events = sentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].tags ?? {}).not.toHaveProperty("request_id");
  });

  it("never throws, whatever it is handed", () => {
    expect(() => captureServerError(undefined, { requestId: "x", route: "/r" })).not.toThrow();
    expect(() => captureServerError("a string", { requestId: "x" })).not.toThrow();
  });
});
