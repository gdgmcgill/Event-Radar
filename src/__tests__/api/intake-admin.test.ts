/** M3 P1-09 admin review of public intake: submissions queue (with private
 * contact data, admin only), review via `review_submission`, and listing
 * report resolution. Guards precede every DB call; RPC errors map through
 * mutationError. */
import { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";

let mockCtx: RequestContext;
type QueryCall = { method: string; args: unknown[] };
type QueryResult = { data: unknown; error: unknown };
function qbuilder(result: QueryResult) {
  const calls: QueryCall[] = [];
  const builder: Record<string, unknown> & { calls: QueryCall[] } = { calls };
  for (const method of ["select", "eq", "is", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}
let fromQueue: ReturnType<typeof qbuilder>[] = [];
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = jest.fn((table: string) => {
  const next = fromQueue.shift();
  if (!next) throw new Error(`no queued query result for table "${table}"`);
  return next;
});
const mockRpc = jest.fn(async (..._args: unknown[]) => rpcResult);
const mockDb = { from: mockFrom, rpc: mockRpc };
jest.mock("@/server/context", () => ({ createRequestContext: () => Promise.resolve(mockCtx) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockDb }));
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockDb) }));

const ADMIN_ID = "ad090002-0000-4000-8000-000000000001";
const SUBMISSION_ID = "ad090002-0000-4000-8000-000000000002";
const TARGET_ID = "ad090002-0000-4000-8000-000000000003";
const params = () => ({ params: Promise.resolve({ id: SUBMISSION_ID }) });
const AT = "2026-09-29T12:00:00.000Z";
const row = {
  id: SUBMISSION_ID,
  kind: "company_request",
  title: "Junior developer",
  organization: "Acme Robotics",
  source_url: null,
  details: { duties: "Write code" },
  contact_name: "Pat Recruiter",
  contact_email: "hiring@acme.example",
  status: "pending",
  review_reason: null,
  reviewed_at: null,
  target_opportunity_id: null,
  target_resource_id: null,
  created_at: AT,
  updated_at: AT,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  fromQueue = [];
  rpcResult = { data: null, error: null };
  mockCtx = {
    user: { id: ADMIN_ID },
    profile: { id: ADMIN_ID, roles: ["user", "admin"], onboarding_completed: true, banned_at: null, ban_expires_at: null },
    supabase: mockDb,
    requestId: "intake-admin-test",
  } as unknown as RequestContext;
});
afterEach(() => jest.restoreAllMocks());

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });

const ARMS = [
  ["GET /api/admin/submissions", async () => (await import("@/app/api/admin/submissions/route")).GET(json("/api/admin/submissions", "GET"))],
  ["GET /api/admin/submissions/[id]", async () => (await import("@/app/api/admin/submissions/[id]/route")).GET(json(`/api/admin/submissions/${SUBMISSION_ID}`, "GET"), params())],
  ["PATCH /api/admin/submissions/[id]", async () => (await import("@/app/api/admin/submissions/[id]/route")).PATCH(json(`/api/admin/submissions/${SUBMISSION_ID}`, "PATCH", { action: "convert", expected_updated_at: AT }), params())],
  ["GET /api/admin/listing-reports", async () => (await import("@/app/api/admin/listing-reports/route")).GET(json("/api/admin/listing-reports", "GET"))],
  ["PATCH /api/admin/listing-reports/[id]", async () => (await import("@/app/api/admin/listing-reports/[id]/route")).PATCH(json(`/api/admin/listing-reports/${SUBMISSION_ID}`, "PATCH", { action: "resolve" }), params())],
] as const;

describe.each(ARMS)("%s", (_name, invoke) => {
  it("refuses a student with 403 before any DB call", async () => {
    mockCtx.profile!.roles = ["user"];
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 before any DB call", async () => {
    mockCtx.user = null;
    expect((await invoke()).status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/submissions", () => {
  it("lists the pending queue with private contact fields for the admin", async () => {
    const builder = qbuilder({ data: [row], error: null });
    fromQueue.push(builder);
    const { GET } = await import("@/app/api/admin/submissions/route");
    const response = await GET(json("/api/admin/submissions", "GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].contact_email).toBe("hiring@acme.example");
    expect(builder.calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
    expect(JSON.stringify(builder.calls)).not.toContain("client_hash");
  });

  it("refuses a malformed status before any DB call", async () => {
    const { GET } = await import("@/app/api/admin/submissions/route");
    expect((await GET(json("/api/admin/submissions?status=published", "GET"))).status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/submissions/[id]", () => {
  it("404s for a missing submission", async () => {
    fromQueue.push(qbuilder({ data: null, error: null }));
    const { GET } = await import("@/app/api/admin/submissions/[id]/route");
    expect((await GET(json(`/api/admin/submissions/${SUBMISSION_ID}`, "GET"), params())).status).toBe(404);
  });
});

describe("PATCH /api/admin/submissions/[id]", () => {
  const patch = async (body: unknown) =>
    (await import("@/app/api/admin/submissions/[id]/route")).PATCH(json(`/api/admin/submissions/${SUBMISSION_ID}`, "PATCH", body), params());

  it("converts through review_submission with the server-derived actor and returns the target", async () => {
    const result = { submission: { ...row, status: "converted" }, target: { kind: "opportunity", id: TARGET_ID } };
    delete (result.submission as Record<string, unknown>).contact_email;
    rpcResult = { data: result, error: null };
    const response = await patch({ action: "convert", expected_updated_at: AT });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mockRpc).toHaveBeenCalledWith("review_submission", {
      p_actor: ADMIN_ID,
      p_id: SUBMISSION_ID,
      p_action: "convert",
      p_reason: null,
      p_expected: AT,
    });
  });

  // Pass-through only: the mocked RPC answers the same fixture twice, so this
  // proves the route returns the RPC's target unchanged, not idempotency.
  // Idempotency of a retried convert is proven in the database by
  // supabase/tests/database/140-intake.test.sql ("a retried convert with a
  // stale version returns the same target" / "a retried convert creates no
  // second opportunity").
  it("passes the RPC's target through unchanged on a retried convert", async () => {
    rpcResult = { data: { submission: { ...row, status: "converted" }, target: { kind: "opportunity", id: TARGET_ID } }, error: null };
    const first = await (await patch({ action: "convert", expected_updated_at: AT })).json();
    const second = await (await patch({ action: "convert", expected_updated_at: AT })).json();
    expect(second.target.id).toBe(first.target.id);
  });

  it("maps a stale version (40001) to 409", async () => {
    rpcResult = { data: null, error: { code: "40001", message: "Submission changed; reload before reviewing" } };
    expect((await patch({ action: "spam", expected_updated_at: AT })).status).toBe(409);
  });

  it("requires a reason to reject before any DB call", async () => {
    expect((await patch({ action: "reject", expected_updated_at: AT })).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes the rejection reason", async () => {
    rpcResult = { data: { submission: { ...row, status: "rejected" }, target: null }, error: null };
    await patch({ action: "reject", expected_updated_at: AT, reason: "Duplicate" });
    expect(mockRpc).toHaveBeenCalledWith("review_submission", expect.objectContaining({ p_action: "reject", p_reason: "Duplicate" }));
  });
});

describe("GET /api/admin/listing-reports", () => {
  it("lists open reports with the target kind, id and display title", async () => {
    const builder = qbuilder({
      data: [
        { id: "r1", event_id: TARGET_ID, opportunity_id: null, resource_id: null, reason: "wrong_date", details: null, status: "open", resolution_note: null, resolved_at: null, created_at: AT, events: { title: "Fair" }, opportunities: null, resources: null },
        { id: "r2", event_id: null, opportunity_id: null, resource_id: TARGET_ID, reason: "dead_link", details: "404", status: "open", resolution_note: null, resolved_at: null, created_at: AT, events: null, opportunities: null, resources: { title: "Guide" } },
      ],
      error: null,
    });
    fromQueue.push(builder);
    const { GET } = await import("@/app/api/admin/listing-reports/route");
    const body = await (await GET(json("/api/admin/listing-reports", "GET"))).json();
    expect(body.items.map((item: Record<string, unknown>) => [item.kind, item.target_id, item.target_title])).toEqual([
      ["event", TARGET_ID, "Fair"],
      ["resource", TARGET_ID, "Guide"],
    ]);
    expect(builder.calls).toContainEqual({ method: "eq", args: ["status", "open"] });
    expect(JSON.stringify(body)).not.toContain("client_hash");
  });
});

describe("PATCH /api/admin/listing-reports/[id]", () => {
  it("resolves through resolve_listing_report and maps an already-handled report (22023) to 400", async () => {
    const { PATCH } = await import("@/app/api/admin/listing-reports/[id]/route");
    rpcResult = { data: { id: SUBMISSION_ID, status: "resolved" }, error: null };
    const ok = await PATCH(json(`/api/admin/listing-reports/${SUBMISSION_ID}`, "PATCH", { action: "resolve", note: "Fixed" }), params());
    expect(ok.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("resolve_listing_report", { p_actor: ADMIN_ID, p_id: SUBMISSION_ID, p_action: "resolve", p_note: "Fixed" });
    rpcResult = { data: null, error: { code: "22023", message: "Report was already handled" } };
    expect((await PATCH(json(`/api/admin/listing-reports/${SUBMISSION_ID}`, "PATCH", { action: "dismiss" }), params())).status).toBe(400);
  });
});

describe("public intake never exposes what the admin queue shows", () => {
  it("no public intake response carries a contact email", async () => {
    const prior = process.env.FEATURE_DISCOVERY_UI;
    try {
      process.env.FEATURE_DISCOVERY_UI = "true";
      mockCtx.user = null;
      rpcResult = { data: null, error: null };
      const { POST } = await import("@/app/api/company-requests/route");
      const response = await POST(json("/api/company-requests", "POST", {
        company_name: "Acme Robotics", company_context: "Robots", role_title: "Dev", duties: "Code", must_have_skills: "TS",
        hours: "10", compensation: "$20", location: "Montréal", work_mode: "remote", start_date: "Soon",
        employment_type: "internship", why_worth_it: "Growth", contact_name: "Pat", contact_email: "hiring@acme.example",
      }));
      expect(response.status).toBe(202);
      expect(await response.text()).not.toContain("hiring@acme.example");
    } finally {
      if (prior === undefined) delete process.env.FEATURE_DISCOVERY_UI;
      else process.env.FEATURE_DISCOVERY_UI = prior;
    }
  });
});
