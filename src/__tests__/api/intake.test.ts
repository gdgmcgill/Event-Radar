/** M3 P1-09 public intake routes: submissions, company hiring requests and
 * listing reports. Beyond the generic arms in m2-route-boundaries.test.ts,
 * this pins the discovery gate, the honeypot (no DB call), the server-fixed
 * RPC argument set (no status or editorial key can reach the database),
 * optional user attribution, quota/visibility mapping, and that no public
 * response ever echoes private contact data. */
import { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";

let mockCtx: RequestContext;
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockRpc = jest.fn(async (..._args: unknown[]) => rpcResult);
const mockFrom = jest.fn(() => {
  throw new Error("public intake must not query tables directly");
});
const mockDb = { rpc: mockRpc, from: mockFrom };
jest.mock("@/server/context", () => ({ createRequestContext: () => Promise.resolve(mockCtx) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockDb }));
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockDb) }));

const USER_ID = "ad090001-0000-4000-8000-000000000001";
const LISTING_ID = "ad090001-0000-4000-8000-000000000002";
const original = process.env.FEATURE_DISCOVERY_UI;

const submission = {
  kind: "job",
  title: "Research assistant",
  organization: "Neuro lab",
  source_url: "https://example.org/ra",
  description: "Help run experiments.",
  location: "Montréal",
  contact_name: "Sam Submitter",
  contact_email: "sam@private.example",
};
const company = {
  company_name: "Acme Robotics",
  company_context: "We build warehouse robots.",
  role_title: "Junior developer",
  duties: "Write and test TypeScript services.",
  must_have_skills: "TypeScript",
  hours: "15 hours a week",
  compensation: "$22/hour",
  location: "Montréal",
  work_mode: "hybrid",
  start_date: "January 2027",
  employment_type: "part_time",
  why_worth_it: "Real mentorship.",
  contact_name: "Pat Recruiter",
  contact_email: "hiring@acme.example",
};
const report = { kind: "event", id: LISTING_ID, reason: "wrong_date", details: "Starts at 7, not 6." };

function post(path: string, body: unknown, ip = "203.0.113.9") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-real-ip": ip },
  });
}
const submissions = async () => (await import("@/app/api/submissions/route")).POST;
const companyRequests = async () => (await import("@/app/api/company-requests/route")).POST;
const listingReports = async () => (await import("@/app/api/listing-reports/route")).POST;
const rpcArgs = () => mockRpc.mock.calls[0] as [string, Record<string, unknown>];

beforeEach(() => {
  process.env.FEATURE_DISCOVERY_UI = "true";
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  rpcResult = { data: null, error: null };
  mockCtx = { user: null, profile: null, supabase: mockDb, requestId: "intake-test" } as unknown as RequestContext;
});
afterEach(() => {
  jest.restoreAllMocks();
  if (original === undefined) delete process.env.FEATURE_DISCOVERY_UI;
  else process.env.FEATURE_DISCOVERY_UI = original;
});

describe.each([
  ["/api/submissions", submissions, submission],
  ["/api/company-requests", companyRequests, company],
  ["/api/listing-reports", listingReports, report],
] as const)("POST %s", (path, load, body) => {
  it("404s with the discovery switch off and makes no DB call", async () => {
    process.env.FEATURE_DISCOVERY_UI = "false";
    const response = await (await load())(post(path, body));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers a filled honeypot with 202 and no DB call", async () => {
    const response = await (await load())(post(path, { ...body, website: "https://spam.example" }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ received: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses a forged status or editorial key before any DB call", async () => {
    for (const forged of [{ status: "published" }, { is_pick: true }, { checked_at: "2026-01-01T00:00:00Z" }]) {
      const response = await (await load())(post(path, { ...body, ...forged }));
      expect(response.status).toBe(400);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("accepts an anonymous caller with p_user null, a salted hash and a private 202 that echoes nothing", async () => {
    const response = await (await load())(post(path, body));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ received: true });
    expect(text).not.toContain("@");
    const [, args] = rpcArgs();
    expect(args.p_user).toBeNull();
    expect(args.p_client_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.9");
    for (const key of Object.keys(args)) expect(key).not.toMatch(/status|pick|priority|checked|published/);
  });

  it("attributes an active signed-in caller and ignores a suspended one", async () => {
    mockCtx.user = { id: USER_ID } as RequestContext["user"];
    mockCtx.profile = { id: USER_ID, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null } as unknown as RequestContext["profile"];
    await (await load())(post(path, body));
    expect(rpcArgs()[1].p_user).toBe(USER_ID);
    mockRpc.mockClear();
    mockCtx.profile = { ...mockCtx.profile!, banned_at: "2026-01-01T00:00:00Z" } as RequestContext["profile"];
    await (await load())(post(path, body));
    expect(rpcArgs()[1].p_user).toBeNull();
  });

  it("maps the database quota (UV429) to a private 429", async () => {
    rpcResult = { data: null, error: { code: "UV429", message: "Too many submissions" } };
    const response = await (await load())(post(path, body));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Too many submissions. Try again later." });
  });

  it("answers 503 with no DB call when a hosted deploy has no hash secret", async () => {
    const secret = process.env.INTAKE_HASH_SECRET;
    const vercel = process.env.VERCEL;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      delete process.env.INTAKE_HASH_SECRET;
      process.env.VERCEL = "1";
      const response = await (await load())(post(path, body));
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Submissions are temporarily unavailable." });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls.flat().join(" ")).toContain("intake hash secret not configured");
    } finally {
      if (secret === undefined) delete process.env.INTAKE_HASH_SECRET;
      else process.env.INTAKE_HASH_SECRET = secret;
      if (vercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = vercel;
    }
  });

  it("turns an unexpected database error into the generic private 500", async () => {
    rpcResult = { data: null, error: { code: "XX000", message: "PRIVATE_DATABASE_SENTINEL" } };
    const response = await (await load())(post(path, body));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("PRIVATE_DATABASE_SENTINEL");
  });
});

describe("POST /api/submissions", () => {
  it("sends the server-fixed argument set with details built from the per-kind fields", async () => {
    await (await submissions())(post("/api/submissions", submission));
    const [fn, args] = rpcArgs();
    expect(fn).toBe("intake_submission");
    expect(Object.keys(args).sort()).toEqual([
      "p_client_hash",
      "p_contact_email",
      "p_contact_name",
      "p_details",
      "p_kind",
      "p_organization",
      "p_source_url",
      "p_title",
      "p_user",
    ]);
    expect(args).toMatchObject({
      p_kind: "job",
      p_title: "Research assistant",
      p_organization: "Neuro lab",
      p_source_url: "https://example.org/ra",
      p_details: { description: "Help run experiments.", location: "Montréal" },
      p_contact_name: "Sam Submitter",
      p_contact_email: "sam@private.example",
    });
  });

  it("refuses javascript:, HTML and oversized descriptions before any DB call", async () => {
    const post1 = await (await submissions())(post("/api/submissions", { ...submission, source_url: "javascript:alert(1)" }));
    const post2 = await (await submissions())(post("/api/submissions", { ...submission, description: "<img src=x onerror=alert(1)>" }));
    const post3 = await (await submissions())(post("/api/submissions", { ...submission, description: "a".repeat(2001) }));
    expect([post1.status, post2.status, post3.status]).toEqual([400, 400, 400]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("maps a database size violation (23514) to a 400, never a 500", async () => {
    rpcResult = { data: null, error: { code: "23514", message: "violates check constraint" } };
    const response = await (await submissions())(post("/api/submissions", submission));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Submission is too long." });
  });

  it("names the offending field in a validation 400", async () => {
    const response = await (await submissions())(post("/api/submissions", { ...submission, source_url: "javascript:alert(1)" }));
    expect(response.status).toBe(400);
    expect((await response.json()).field).toBe("source_url");
  });

  it("maps a database refusal of the submitter (42501) to 403", async () => {
    rpcResult = { data: null, error: { code: "42501", message: "Account suspended" } };
    const response = await (await submissions())(post("/api/submissions", submission));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/company-requests", () => {
  it("files the request as a company_request with the role as title and contact kept out of details", async () => {
    await (await companyRequests())(post("/api/company-requests", company));
    const [fn, args] = rpcArgs();
    expect(fn).toBe("intake_submission");
    expect(args).toMatchObject({
      p_kind: "company_request",
      p_title: "Junior developer",
      p_organization: "Acme Robotics",
      p_source_url: null,
      p_contact_name: "Pat Recruiter",
      p_contact_email: "hiring@acme.example",
    });
    const details = args.p_details as Record<string, string>;
    expect(details).toMatchObject({ duties: company.duties, employment_type: "part_time", hours: "15 hours a week" });
    expect(JSON.stringify(details)).not.toContain("hiring@acme.example");
    expect(details).not.toHaveProperty("company_name");
    expect(details).not.toHaveProperty("role_title");
  });

  it("refuses a multibyte request over the byte budget with 400 before any DB call", async () => {
    const euro = (n: number) => "€".repeat(n);
    const response = await (await companyRequests())(post("/api/company-requests", {
      ...company, company_context: euro(1000), duties: euro(3000), must_have_skills: euro(1000), nice_to_have_skills: euro(1000), why_worth_it: euro(1000),
    }));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses a request without a contact email", async () => {
    const { contact_email: _omit, ...rest } = company;
    void _omit;
    const response = await (await companyRequests())(post("/api/company-requests", rest));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/listing-reports", () => {
  it("calls intake_listing_report with the target and reason", async () => {
    await (await listingReports())(post("/api/listing-reports", report));
    const [fn, args] = rpcArgs();
    expect(fn).toBe("intake_listing_report");
    expect(args).toMatchObject({ p_kind: "event", p_id: LISTING_ID, p_reason: "wrong_date", p_details: "Starts at 7, not 6.", p_user: null });
  });

  it("404s for an invisible or guessed target (P0002)", async () => {
    rpcResult = { data: null, error: { code: "P0002", message: "Listing not found" } };
    const response = await (await listingReports())(post("/api/listing-reports", report));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses a non-UUID target before any DB call", async () => {
    const response = await (await listingReports())(post("/api/listing-reports", { ...report, id: "../admin" }));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
