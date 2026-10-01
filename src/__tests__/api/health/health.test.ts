/**
 * GET /api/health — liveness for everyone, the documented report for an
 * active admin or the uptime monitor's token (plan 06-17, REFAC-22, DEC-78).
 *
 * The contract under test is `docs/health.md` and `src/contracts/health.ts`:
 *   - anonymous, non-admin, banned-admin and wrong-token callers get 200
 *     `{ status: "ok", version }` and nothing else;
 *   - an active admin, or `Authorization: Bearer <HEALTH_TOKEN>` with a token
 *     of 32+ characters, gets `{ status, version, ts, checks: { db, auth,
 *     storage, pg_cron, webhook } }`, 200 when status is "ok" and 503
 *     otherwise;
 *   - db down → "down"; auth or storage non-200 or timed out → "degraded"; a
 *     job older than twice its schedule → pg_cron "stale" and "degraded"; the
 *     rpc answering PGRST202, or a job that never ran → "unknown", overall
 *     unaffected;
 *   - every answer is `private, no-store` with a UUID `x-request-id`, and no
 *     body carries an error's text, a variable name, memory figures or OAuth
 *     state; the session accessor is never called.
 *
 * Seams: `@/lib/supabase/server` returns the cookie fake (the request
 * context's client), `@/lib/supabase/service` the elevated fake (the door);
 * `fetch` is spied for the auth and storage probes. The handler is typed as
 * its own export.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { HealthLiveness, HealthReport } from "@/contracts/health";
import {
  createFakeSupabase,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

type HealthGET = (typeof import("@/app/api/health/route"))["GET"];

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
const getSession = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      ...mockCookie.client,
      from: (table: string) => mockCookie.client.from(table),
      rpc: (name: string, args?: unknown) => mockCookie.client.rpc(name, args),
      auth: { getUser: mockCookie.client.auth.getUser, getSession },
    }),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

const SUPABASE_URL = "http://supabase.test";
const ANON_KEY = "anon-key-for-tests";
const TOKEN = "h".repeat(40);
const SENTINEL = "SENTINEL-HEALTH-TEXT";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const USER_ID = "5eed0000-0000-4000-8000-0a7000000017";
const HOUR = 3_600_000;
const MINUTE = 60_000;

const ENV = process.env as Record<string, string | undefined>;
const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "HEALTH_TOKEN"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

type Persona = "anonymous" | "student" | "admin" | "banned-admin";

function profileFor(persona: Persona): FakeRow[] {
  if (persona === "anonymous") return [];
  return [
    {
      id: USER_ID,
      roles: persona === "student" ? ["user"] : ["user", "admin"],
      onboarding_completed: true,
      banned_at: persona === "banned-admin" ? "2026-01-01T00:00:00Z" : null,
      ban_expires_at: null,
    },
  ];
}

function iso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

/** All three jobs ran recently: nothing stale. */
function freshJobs(): FakeRow[] {
  return [
    { jobname: "compute-user-scores", schedule: "0 */6 * * *", active: true, last_start: iso(2 * HOUR), last_status: "succeeded" },
    { jobname: "send-event-reminders", schedule: "*/15 * * * *", active: true, last_start: iso(5 * MINUTE), last_status: "succeeded" },
    { jobname: "send-feedback-requests", schedule: "*/30 * * * *", active: true, last_start: iso(10 * MINUTE), last_status: "succeeded" },
  ];
}

interface World {
  persona: Persona;
  cookie?: (init: FakeSupabaseInit) => void;
  elevated?: (init: FakeSupabaseInit) => void;
}

function build(world: World): void {
  const cookieInit: FakeSupabaseInit = {
    user: world.persona === "anonymous" ? null : { id: USER_ID, email: "someone@mail.mcgill.ca" },
    tables: {
      users: profileFor(world.persona),
      events: [{ id: "e1", status: "approved", source: "manual", created_at: iso(HOUR) }],
    },
  };
  world.cookie?.(cookieInit);
  const elevatedInit: FakeSupabaseInit = {
    tables: {
      events: [
        { id: "e1", source: "manual", created_at: iso(HOUR) },
        { id: "e2", source: "instagram", created_at: "2026-09-20T12:00:00.000Z" },
        { id: "e3", source: "instagram", created_at: "2026-09-21T08:30:00.000Z" },
        { id: "e4", source: "admin", created_at: iso(MINUTE) },
      ],
    },
    rpc: { cron_job_status: { data: freshJobs(), error: null } },
  };
  world.elevated?.(elevatedInit);
  mockCookie = createFakeSupabase(cookieInit);
  mockElevated = createFakeSupabase(elevatedInit);
}

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function probeAnswers(auth: number | Error, storage: number | Error): void {
  fetchSpy.mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const answer = url.includes("/auth/v1/health") ? auth : url.includes("/storage/v1/status") ? storage : 404;
    if (answer instanceof Error) throw answer;
    return new Response("{}", { status: answer });
  });
}

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
  ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  ENV.HEALTH_TOKEN = TOKEN;
  getSession.mockReset();
  fetchSpy = jest.spyOn(global, "fetch");
  probeAnswers(200, 200);
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function health(
  world: World,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Headers; body: Record<string, any>; text: string }> {
  build(world);
  const GET: HealthGET = (await import("@/app/api/health/route")).GET;
  const response = await GET(new NextRequest("http://localhost:3000/api/health", { headers }));
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: JSON.parse(text), text };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

function expectLiveness(result: Awaited<ReturnType<typeof health>>): void {
  expect(result.status).toBe(200);
  expect(Object.keys(result.body).sort()).toEqual(["status", "version"]);
  expect(result.body.status).toBe("ok");
  expect(typeof result.body.version).toBe("string");
  expect(HealthLiveness.safeParse(result.body).success).toBe(true);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(result.headers.get("x-request-id")).toMatch(UUID);
}

function expectNoLeak(text: string): void {
  for (const needle of [SENTINEL, "NEXT_PUBLIC", "SUPABASE_", "HEALTH_TOKEN", TOKEN, ANON_KEY, "heap", "rss", "memory", "azure", "oauth", "uptime"]) {
    expect(text.toLowerCase()).not.toContain(needle.toLowerCase());
  }
}

// ─── Who gets what ─────────────────────────────────────────────────────────

describe("liveness: anyone who is not an active admin or the token bearer", () => {
  it.each<Persona>(["anonymous", "student", "banned-admin"])(
    "%s gets 200 { status, version } only, private, no-store, a request id",
    async (persona) => {
      const result = await health({ persona });
      expectLiveness(result);
      expectNoLeak(result.text);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockElevated.calls).toEqual([]);
    }
  );

  it("a wrong token gets liveness", async () => {
    const result = await health({ persona: "anonymous" }, bearer("w".repeat(40)));
    expectLiveness(result);
    expect(mockElevated.calls).toEqual([]);
  });

  it("a token one character short of the configured one gets liveness", async () => {
    expectLiveness(await health({ persona: "anonymous" }, bearer(TOKEN.slice(0, -1))));
  });

  it("a short configured token disables token access (bearer equal to it gets liveness)", async () => {
    const SHORT = "s".repeat(31);
    ENV.HEALTH_TOKEN = SHORT;
    const result = await health({ persona: "anonymous" }, bearer(SHORT));
    expectLiveness(result);
    expect(mockElevated.calls).toEqual([]);
    expect(result.text).not.toContain(SHORT);
  });

  it("no configured token: a bearer gets liveness, never a fail-open comparison", async () => {
    delete ENV.HEALTH_TOKEN;
    expectLiveness(await health({ persona: "anonymous" }, bearer("")));
    expectLiveness(await health({ persona: "anonymous" }, bearer("undefined")));
  });

  it("a non-Bearer scheme with the right value gets liveness", async () => {
    expectLiveness(await health({ persona: "anonymous" }, { authorization: `Basic ${TOKEN}` }));
  });
});

describe("the report: an active admin or the token bearer", () => {
  it("an active admin gets the documented report, 200 when everything is ok", async () => {
    const result = await health({ persona: "admin" });
    expect(result.status).toBe(200);
    expect(HealthReport.safeParse(result.body).success).toBe(true);
    expect(Object.keys(result.body).sort()).toEqual(["checks", "status", "ts", "version"]);
    expect(Object.keys(result.body.checks).sort()).toEqual(["auth", "db", "pg_cron", "storage", "webhook"]);
    expect(result.body.status).toBe("ok");
    expect(result.body.checks.db).toMatchObject({ status: "ok" });
    expect(result.body.checks.auth).toMatchObject({ status: "ok" });
    expect(result.body.checks.storage).toMatchObject({ status: "ok" });
    expect(typeof result.body.checks.db.latency_ms).toBe("number");
    expect(result.body.checks.pg_cron.status).toBe("ok");
    expect(result.body.checks.pg_cron.jobs.map((j: any) => j.jobname)).toEqual([
      "compute-user-scores",
      "send-event-reminders",
      "send-feedback-requests",
    ]);
    expect(result.body.checks.pg_cron.jobs.every((j: any) => j.stale === false)).toBe(true);
    expect(Number.isNaN(Date.parse(result.body.ts))).toBe(false);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(result.headers.get("x-request-id")).toMatch(UUID);
    expectNoLeak(result.text);
  });

  it("the correct token gets the report without a session", async () => {
    const result = await health({ persona: "anonymous" }, bearer(TOKEN));
    expect(result.status).toBe(200);
    expect(HealthReport.safeParse(result.body).success).toBe(true);
    expect(result.body.status).toBe("ok");
    expectNoLeak(result.text);
  });

  it("probes auth and storage with the anon key and a timeout signal", async () => {
    await health({ persona: "admin" });
    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(urls.sort()).toEqual([`${SUPABASE_URL}/auth/v1/health`, `${SUPABASE_URL}/storage/v1/status`]);
    for (const [, init] of fetchSpy.mock.calls) {
      expect(new Headers(init?.headers).get("apikey")).toBe(ANON_KEY);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("reads pg_cron through the door's cron_job_status() and the db through the cookie client", async () => {
    await health({ persona: "admin" });
    expect(mockElevated.calls.filter((c) => c.operation === "rpc").map((c) => c.table)).toEqual(["cron_job_status"]);
    const dbCall = mockCookie.calls.find((c) => c.table === "events");
    expect(dbCall?.options).toMatchObject({ head: true });
  });

  it("webhook.last_ingest_at is the newest instagram-sourced insert, read through the door", async () => {
    const result = await health({ persona: "admin" });
    expect(result.body.checks.webhook.last_ingest_at).toBe("2026-09-21T08:30:00.000Z");
    const read = mockElevated.calls.find((c) => c.table === "events");
    expect(read?.filters).toEqual(expect.arrayContaining([{ op: "eq", column: "source", value: "instagram" }]));
  });

  it("webhook.last_ingest_at is null when no scraper-sourced event exists", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => { i.tables!.events = [{ id: "m", source: "manual", created_at: iso(HOUR) }]; },
    });
    expect(result.body.checks.webhook.last_ingest_at).toBeNull();
    expect(result.body.status).toBe("ok");
  });

  it("M3 P1-07: the webhook check carries delivery freshness and the pending queue for an admin", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => {
        i.tables!.ingestion_deliveries = [
          { id: "d1", producer: "instagram-apify@1", received_at: "2026-09-20T10:00:00.000Z", outcome: "succeeded", error_code: null },
          { id: "d2", producer: "instagram-apify@1", received_at: "2026-09-21T10:00:00.000Z", outcome: "duplicate", error_code: null },
          { id: "d3", producer: "instagram-apify@1", received_at: "2026-09-22T10:00:00.000Z", outcome: "failed", error_code: "apify_http_401" },
        ];
        i.tables!.events = [
          { id: "e3", source: "instagram", status: "pending", deleted_at: null, created_at: "2026-09-21T08:30:00.000Z", start_date: "2020-01-01T00:00:00.000Z" },
          { id: "e5", source: "manual", status: "pending", deleted_at: null, created_at: iso(HOUR), start_date: "2099-01-01T00:00:00.000Z" },
          { id: "e6", source: "manual", status: "pending", deleted_at: iso(HOUR), created_at: iso(HOUR), start_date: "2099-01-01T00:00:00.000Z" },
          { id: "e7", source: "manual", status: "approved", deleted_at: null, created_at: iso(HOUR), start_date: "2099-01-01T00:00:00.000Z" },
        ];
      },
    });
    expect(HealthReport.safeParse(result.body).success).toBe(true);
    expect(result.body.checks.webhook).toEqual({
      last_ingest_at: "2026-09-21T08:30:00.000Z",
      last_delivery_at: "2026-09-22T10:00:00.000Z",
      last_success_at: "2026-09-21T10:00:00.000Z",
      last_failure_at: "2026-09-22T10:00:00.000Z",
      last_error_code: "apify_http_401",
      pending_review: 2,
      // The fake records the stale `or` filter without evaluating it, so this
      // counts every pending, non-deleted event; the filter itself is pinned below.
      stale_pending: 2,
    });
    const staleRead = mockElevated.calls.filter((c) => c.table === "events" && c.filters.some((f) => f.op === "or"));
    expect(staleRead).toHaveLength(1);
    expect(String(staleRead[0].filters.find((f) => f.op === "or")?.value)).toMatch(/^created_at\.lt\.[^,]+,start_date\.lt\./);
    expect(result.body.status).toBe("ok");
  });

  it("M3 P1-07: a failing summary read leaves the webhook fields unknown and the status unchanged", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => { i.errors = { ingestion_deliveries: { code: "42P01", message: `${SENTINEL} relation does not exist` } }; },
    });
    expect(result.body.checks.webhook).toEqual({
      last_ingest_at: null, last_delivery_at: null, last_success_at: null, last_failure_at: null,
      last_error_code: null, pending_review: null, stale_pending: null,
    });
    expect(result.body.status).toBe("ok");
    expect(result.text).not.toContain(SENTINEL);
  });
});

// ─── The status rules ──────────────────────────────────────────────────────

describe("status rules", () => {
  it("db down (a query error) → overall down, 503, no error text", async () => {
    const result = await health({
      persona: "admin",
      cookie: (i) => { i.errors = { "events.select": { code: "XX000", message: SENTINEL } }; },
    });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("down");
    expect(result.body.checks.db.status).toBe("down");
    expect(HealthReport.safeParse(result.body).success).toBe(true);
    expectNoLeak(result.text);
  });

  it("db throwing → overall down, 503, no error text", async () => {
    const result = await health({
      persona: "admin",
      cookie: (i) => { i.throwOn = { events: SENTINEL }; },
    });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("down");
    expectNoLeak(result.text);
  });

  it("auth non-200 → degraded, 503", async () => {
    probeAnswers(500, 200);
    const result = await health({ persona: "admin" });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.checks.auth.status).toBe("down");
    expect(result.body.checks.storage.status).toBe("ok");
  });

  it("storage timeout → degraded, 503, no error text", async () => {
    const timeout = new Error(SENTINEL);
    timeout.name = "TimeoutError";
    probeAnswers(200, timeout);
    const result = await health({ persona: "admin" });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.checks.storage.status).toBe("down");
    expectNoLeak(result.text);
  });

  it("db down wins over degraded", async () => {
    probeAnswers(500, 500);
    const result = await health({
      persona: "admin",
      cookie: (i) => { i.errors = { "events.select": { code: "XX000", message: SENTINEL } }; },
    });
    expect(result.body.status).toBe("down");
  });

  it("a job older than twice its schedule → pg_cron stale, overall degraded, 503", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => {
        const jobs = freshJobs();
        jobs[0] = { ...jobs[0], last_start: iso(13 * HOUR) };
        i.rpc = { cron_job_status: { data: jobs, error: null } };
      },
    });
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.checks.pg_cron.status).toBe("stale");
    const jobs = result.body.checks.pg_cron.jobs;
    expect(jobs.find((j: any) => j.jobname === "compute-user-scores").stale).toBe(true);
    expect(jobs.find((j: any) => j.jobname === "send-event-reminders").stale).toBe(false);
  });

  it.each([
    ["send-event-reminders", 31 * MINUTE, 29 * MINUTE],
    ["send-feedback-requests", 61 * MINUTE, 59 * MINUTE],
    ["compute-user-scores", 12 * HOUR + MINUTE, 12 * HOUR - MINUTE],
  ])("%s: stale past its threshold, fresh inside it", async (jobname, staleAge, freshAge) => {
    for (const [age, stale] of [[staleAge, true], [freshAge, false]] as const) {
      const result = await health({
        persona: "admin",
        elevated: (i) => {
          const jobs = freshJobs().map((j) => (j.jobname === jobname ? { ...j, last_start: iso(age) } : j));
          i.rpc = { cron_job_status: { data: jobs, error: null } };
        },
      });
      const job = result.body.checks.pg_cron.jobs.find((j: any) => j.jobname === jobname);
      expect({ jobname, age, stale: job.stale }).toEqual({ jobname, age, stale });
    }
  });

  it("the rpc answering PGRST202 (production before DI-23) → pg_cron unknown, overall ok, never 500", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => {
        i.rpc = {
          cron_job_status: {
            data: null,
            error: { code: "PGRST202", message: `${SENTINEL} Could not find the function public.cron_job_status` },
          },
        };
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.checks.pg_cron).toEqual({ status: "unknown", jobs: [] });
    expectNoLeak(result.text);
  });

  it("a job that never ran → unknown, overall unaffected", async () => {
    const result = await health({
      persona: "admin",
      elevated: (i) => {
        const jobs = freshJobs();
        jobs[1] = { ...jobs[1], last_start: null, last_status: null };
        i.rpc = { cron_job_status: { data: jobs, error: null } };
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.checks.pg_cron.status).toBe("unknown");
    const job = result.body.checks.pg_cron.jobs.find((j: any) => j.jobname === "send-event-reminders");
    expect(job).toMatchObject({ last_start: null, last_status: null, stale: null });
  });
});

// ─── What the route never does ─────────────────────────────────────────────

describe("the route's source", () => {
  const source = readFileSync(join(process.cwd(), "src", "app", "api", "health", "route.ts"), "utf8");

  it("never calls the session accessor", async () => {
    await health({ persona: "admin" });
    await health({ persona: "anonymous" });
    expect(getSession).not.toHaveBeenCalled();
    expect(source).not.toContain("getSession(");
  });

  it("compares the token by SHA-256 digest with timingSafeEqual", () => {
    expect(source).toMatch(/timingSafeEqual\(/);
    expect(source).toMatch(/createHash\("sha256"\)/);
  });

  it("keeps its wrapper and its private cache class", () => {
    expect(source).toMatch(/withRoute\(\s*\{\s*cache: "private"/);
  });

  it("reads no memory figures and makes no OAuth probe", () => {
    expect(source).not.toMatch(/memoryUsage|signInWithOAuth/);
  });
});
