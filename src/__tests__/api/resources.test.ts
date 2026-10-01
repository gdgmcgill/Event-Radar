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
let removeResult: { data: unknown; error: unknown } = { data: {}, error: null };

const mockFrom = jest.fn((table: string) => {
  const next = fromQueue.shift();
  if (!next) throw new Error(`no queued query result for table "${table}"`);
  return next;
});
const mockRpc = jest.fn(async () => rpcResult);
// Stable spies shared across every `.storage.from(...)` call (the route may
// call `.storage.from("resource-files")` more than once per request), so a
// test can assert on `uploadMock`/`removeMock` directly.
const createSignedUrlMock = jest.fn(async () => signedUrlResult);
const uploadMock = jest.fn(async () => uploadResult);
const removeMock = jest.fn(async () => removeResult);
const mockStorage = {
  from: jest.fn(() => ({
    createSignedUrl: createSignedUrlMock,
    upload: uploadMock,
    remove: removeMock,
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
  removeResult = { data: {}, error: null };
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

  it("a partial edit sends the RPC p_data with exactly the sent keys (fix round 1, IMPORTANT)", async () => {
    rpcResult = { data: { id: RESOURCE_ID }, error: null };
    fromQueue.push(qbuilder({ data: { id: RESOURCE_ID }, error: null }));
    const { PATCH } = await import("@/app/api/admin/resources/[id]/route");
    await PATCH(
      new NextRequest(`http://localhost/api/admin/resources/${RESOURCE_ID}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "edit",
          expected_updated_at: "2026-01-01T00:00:00Z",
          data: { title: "Updated title" },
        }),
        headers: { "content-type": "application/json" },
      }),
      params
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "curate_resource",
      expect.objectContaining({ p_data: { title: "Updated title" } })
    );
  });
});

describe("POST /api/admin/resources/[id]/file", () => {
  const params = { params: Promise.resolve({ id: RESOURCE_ID }) };
  const EXPECTED = "2026-01-01T00:00:00Z";
  const FILE_PATH_RE = /^[0-9a-f-]{36}\/[a-z0-9-]{1,80}\.(pdf|docx|xlsx|pptx)$/;
  const pdfFile = (name = "template.pdf") =>
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3])], name, { type: "application/pdf" });
  function formRequest(file: File, fields: Record<string, string> = { expected_updated_at: EXPECTED }) {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return new NextRequest(`http://localhost/api/admin/resources/${RESOURCE_ID}/file`, { method: "POST", body: form });
  }
  const existingTemplate = (overrides: Record<string, unknown> = {}) => ({
    id: RESOURCE_ID,
    resource_type: "template",
    status: "draft",
    deleted_at: null,
    updated_at: EXPECTED,
    file_path: null,
    ...overrides,
  });

  it("400s a .pdf whose bytes do not start with the PDF signature, before touching the DB or storage", async () => {
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])], "fake.pdf", { type: "application/pdf" });
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(file), params);
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("400s a file over the 10MB limit, before touching the DB or storage", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(file), params);
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("404s a missing resource without ever calling storage (fix round 1, IMPORTANT)", async () => {
    fromQueue.push(qbuilder({ data: null, error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("400s a non-template resource without ever calling storage (fix round 1, IMPORTANT)", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate({ resource_type: "guide" }), error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("409s a stale expected version without ever calling storage (fix round 1, IMPORTANT)", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate({ updated_at: "2020-01-01T00:00:00Z" }), error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(409);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("removes the uploaded object when the follow-up RPC fails (fix round 1, IMPORTANT)", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate(), error: null }));
    rpcResult = { data: null, error: { code: "40001", message: "stale resource" } };
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(409);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledTimes(1);
    const uploadedPath = (uploadMock.mock.calls[0] as unknown as [string])[0];
    const removedPaths = (removeMock.mock.calls[0] as unknown as [string[]])[0];
    expect(removedPaths).toEqual([uploadedPath]);
  });

  it("accepts a correctly signed PDF, uploads to a fresh path matching the DB CHECK, and updates the resource", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate(), error: null }));
    rpcResult = { data: { id: RESOURCE_ID }, error: null };
    fromQueue.push(qbuilder({ data: existingTemplate(), error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "curate_resource",
      expect.objectContaining({ p_action: "edit", p_id: RESOURCE_ID })
    );
    const callArgs = (mockRpc.mock.calls[0] as unknown as [string, { p_data: { file_path: string } }])[1];
    expect(callArgs.p_data.file_path).toMatch(FILE_PATH_RE);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const uploadOptions = (uploadMock.mock.calls[0] as unknown as [string, File, { upsert: boolean }])[2];
    expect(uploadOptions.upsert).toBe(false);
    // No previous file_path on this fixture, so no removal is attempted.
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("removes the previous file after a successful replace", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate({ file_path: `${RESOURCE_ID}/old-file.pdf` }), error: null }));
    rpcResult = { data: { id: RESOURCE_ID }, error: null };
    fromQueue.push(qbuilder({ data: existingTemplate({ file_path: `${RESOURCE_ID}/old-file.pdf` }), error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    const response = await POST(formRequest(pdfFile()), params);
    expect(response.status).toBe(200);
    expect(removeMock).toHaveBeenCalledTimes(1);
    const removedPaths = (removeMock.mock.calls[0] as unknown as [string[]])[0];
    expect(removedPaths).toEqual([`${RESOURCE_ID}/old-file.pdf`]);
  });

  it("derives the stored extension from the sniffed type, not a mismatched file name", async () => {
    fromQueue.push(qbuilder({ data: existingTemplate(), error: null }));
    rpcResult = { data: { id: RESOURCE_ID }, error: null };
    fromQueue.push(qbuilder({ data: existingTemplate(), error: null }));
    const { POST } = await import("@/app/api/admin/resources/[id]/file/route");
    // The name claims .exe; the bytes and declared type are a valid PDF.
    const response = await POST(formRequest(pdfFile("payload.exe")), params);
    expect(response.status).toBe(200);
    const uploadedPath = (uploadMock.mock.calls[0] as unknown as [string])[0];
    expect(uploadedPath).toMatch(FILE_PATH_RE);
    expect(uploadedPath.endsWith(".pdf")).toBe(true);
  });
});
