/** Dedicated boundary and behavior coverage for the resources family
 * (M3 P1-08), beyond what m2-route-boundaries.test.ts pins generically
 * through m2RouteArms.ts: discovery gating, the open redirect + action-log
 * write, admin validation-before-DB, RPC error mapping, and the file upload's
 * size/type/content checks. */
import { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";

let mockCtx: RequestContext;
type QueryCall = { method: string; args: unknown[] };
type QueryResult = { data: unknown; error: unknown };

function qbuilder(result: QueryResult) {
  const calls: QueryCall[] = [];
  const chain = ["select", "eq", "is", "order", "limit", "insert"] as const;
  const builder: Record<string, unknown> & { calls: QueryCall[] } = { calls };
  for (const method of chain) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder as unknown as {
    calls: QueryCall[];
    select: (...a: unknown[]) => typeof builder;
    eq: (...a: unknown[]) => typeof builder;
    is: (...a: unknown[]) => typeof builder;
    order: (...a: unknown[]) => typeof builder;
    limit: (...a: unknown[]) => typeof builder;
    insert: (...a: unknown[]) => typeof builder;
    maybeSingle: () => Promise<QueryResult>;
  };
}

let fromQueue: ReturnType<typeof qbuilder>[] = [];
let rpcResult: { data?: unknown; error?: unknown } = { data: null, error: null };
let signedUrlResult: { data: { signedUrl: string } | null; error: unknown } = {
  data: { signedUrl: "https://storage.example/signed" },
  error: null,
};
let uploadResult: { data: unknown; error: unknown } = { data: {}, error: null };

const mockFrom = jest.fn((table: string) => {
  const next = fromQueue.shift();
  if (!next) throw new Error(`no queued query result for table "${table}"`);
  return next;
});
const mockRpc = jest.fn(async () => rpcResult);
const mockStorage = {
  from: jest.fn(() => ({
    createSignedUrl: jest.fn(async () => signedUrlResult),
    upload: jest.fn(async () => uploadResult),
  })),
};
const mockDb = { from: mockFrom, rpc: mockRpc, storage: mockStorage };

jest.mock("@/server/context", () => ({ createRequestContext: () => Promise.resolve(mockCtx) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockDb }));
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockDb) }));

const original = process.env.FEATURE_DISCOVERY_UI;
const RESOURCE_ID = "ad080001-0000-4000-8000-000000000001";

beforeEach(() => {
  process.env.FEATURE_DISCOVERY_UI = "true";
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  fromQueue = [];
  rpcResult = { data: null, error: null };
  signedUrlResult = { data: { signedUrl: "https://storage.example/signed" }, error: null };
  uploadResult = { data: {}, error: null };
  mockCtx = {
    user: { id: RESOURCE_ID },
    profile: { id: RESOURCE_ID, roles: ["user", "admin"], onboarding_completed: true, banned_at: null, ban_expires_at: null },
    supabase: mockDb,
    requestId: "resources-test",
  } as unknown as RequestContext;
});
afterEach(() => {
  jest.restoreAllMocks();
  if (original === undefined) delete process.env.FEATURE_DISCOVERY_UI;
  else process.env.FEATURE_DISCOVERY_UI = original;
});

describe("GET /api/resources", () => {
  it("404s with the discovery switch off and makes no DB call", async () => {
    process.env.FEATURE_DISCOVERY_UI = "false";
    mockCtx.profile = null;
    const { GET } = await import("@/app/api/resources/route");
    const response = await GET(new NextRequest("http://localhost/api/resources"));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("200s with the switch on and filters on status=published", async () => {
    const builder = qbuilder({ data: [{ id: "r1", slug: "s1" }], error: null });
    fromQueue.push(builder);
    const { GET } = await import("@/app/api/resources/route");
    const response = await GET(new NextRequest("http://localhost/api/resources"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ id: "r1", slug: "s1" }] });
    expect(builder.calls).toContainEqual({ method: "eq", args: ["status", "published"] });
  });
});

describe("GET /api/resources/[slug]/open", () => {
  const params = (slug = "some-resource") => ({ params: Promise.resolve({ slug }) });

  it("redirects to the external URL and records one outbound action", async () => {
    fromQueue.push(qbuilder({ data: { id: "r1", resource_type: "external", external_url: "https://example.org/apply" }, error: null }));
    const actions = qbuilder({ data: null, error: null });
    fromQueue.push(actions);
    const { GET } = await import("@/app/api/resources/[slug]/open/route");
    const response = await GET(new NextRequest("http://localhost/api/resources/some-resource/open"), params());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.org/apply");
    expect(actions.calls).toContainEqual({ method: "insert", args: [{ resource_id: "r1", action: "outbound" }] });
  });

  it("still redirects when the action-log insert fails", async () => {
    fromQueue.push(qbuilder({ data: { id: "r1", resource_type: "external", external_url: "https://example.org/apply" }, error: null }));
    fromQueue.push(qbuilder({ data: null, error: { message: "insert failed" } }));
    const { GET } = await import("@/app/api/resources/[slug]/open/route");
    const response = await GET(new NextRequest("http://localhost/api/resources/some-resource/open"), params());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.org/apply");
  });

  it("404s for a guide, which has nothing to open", async () => {
    fromQueue.push(qbuilder({ data: { id: "r1", resource_type: "guide", external_url: null }, error: null }));
    const { GET } = await import("@/app/api/resources/[slug]/open/route");
    const response = await GET(new NextRequest("http://localhost/api/resources/some-resource/open"), params());
    expect(response.status).toBe(404);
  });
});

describe("POST /api/admin/resources", () => {
  const validBody = {
    slug: "student-guide",
    resource_type: "template",
    title: "A template",
    summary: "A useful template",
    category: "career",
    audience: "Everyone",
    author_name: "Ady",
  };

  it("403s a non-admin caller before any DB call", async () => {
    mockCtx.profile!.roles = ["user"];
    const { POST } = await import("@/app/api/admin/resources/route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/resources", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "content-type": "application/json" },
      })
    );
    expect(response.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400s a hostile <script> body before any DB call", async () => {
    const hostile = {
      ...validBody,
      resource_type: "guide",
      external_url: undefined,
      body_markdown: "<script>alert(1)</script>",
    };
    const { POST } = await import("@/app/api/admin/resources/route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/resources", {
        method: "POST",
        body: JSON.stringify(hostile),
        headers: { "content-type": "application/json" },
      })
    );
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/resources/[id]: RPC error mapping", () => {
  const params = { params: Promise.resolve({ id: RESOURCE_ID }) };
  const body = () =>
    new NextRequest(`http://localhost/api/admin/resources/${RESOURCE_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "publish", expected_updated_at: "2026-01-01T00:00:00Z" }),
      headers: { "content-type": "application/json" },
    });

  it("maps a stale version (40001) to 409", async () => {
    rpcResult = { data: null, error: { code: "40001", message: "stale resource" } };
    const { PATCH } = await import("@/app/api/admin/resources/[id]/route");
    expect((await PATCH(body(), params)).status).toBe(409);
  });

  it("maps a business-rule violation (22023) to 400", async () => {
    rpcResult = { data: null, error: { code: "22023", message: "invalid action" } };
    const { PATCH } = await import("@/app/api/admin/resources/[id]/route");
    expect((await PATCH(body(), params)).status).toBe(400);
  });

  it("maps a missing resource (P0002) to 404", async () => {
    rpcResult = { data: null, error: { code: "P0002", message: "resource not found" } };
    const { PATCH } = await import("@/app/api/admin/resources/[id]/route");
    expect((await PATCH(body(), params)).status).toBe(404);
  });
});

describe("POST /api/admin/resources/[id]/file", () => {
  const params = { params: Promise.resolve({ id: RESOURCE_ID }) };
  function formRequest(file: File, fields: Record<string, string> = { expected_updated_at: "2026-01-01T00:00:00Z" }) {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return new NextRequest(`http://localhost/api/admin/resources/${RESOURCE_ID}/file`, { method: "POST", body: form });
  }

  it("400s a .pdf whose bytes do not start with the PDF signature", async () => {
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])], "fake.pdf", { type: "application/pdf" });
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(file), params);
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400s a file over the 10MB limit", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(file), params);
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed PDF and updates the resource's file fields", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
    const file = new File([pdfBytes], "template.pdf", { type: "application/pdf" });
    rpcResult = { data: { id: RESOURCE_ID }, error: null };
    fromQueue.push(qbuilder({ data: { id: RESOURCE_ID }, error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(file), params);
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "curate_resource",
      expect.objectContaining({ p_action: "edit", p_id: RESOURCE_ID })
    );
  });
});
