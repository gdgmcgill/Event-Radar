/** M3 P1-07 admin ingestion status: GET /api/admin/ingestion answers the
 * freshness summary, the newest deliveries and the stale pending queue to an
 * active admin only; every guard runs before any database read. */
import { NextRequest } from "next/server";
import type { RequestContext } from "@/server/context";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fakeSupabase";
import { getESTNowISO } from "@/lib/timezone";

type IngestionGET = (typeof import("@/app/api/admin/ingestion/route"))["GET"];
type PersistPOST = (typeof import("@/app/api/admin/ingestion/images/route"))["POST"];

let mockCtx: RequestContext;
let mockElevated: FakeSupabase;
jest.mock("@/server/context", () => ({ createRequestContext: () => Promise.resolve(mockCtx) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockElevated.client }));
const mockPersist = jest.fn();
jest.mock("@/server/ingestion/persistImages", () => ({ persistEventImages: (...args: unknown[]) => mockPersist(...args) }));

const USER_ID = "ad070002-0000-4000-8000-000000000001";
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
// DEC-80 (docs/time-semantics.md): a legacy start_date is Toronto wall-clock
// labelled UTC, so "an hour ago" is an hour before the wall-clock now.
const wallClockAgo = (ms: number) => new Date(Date.parse(getESTNowISO()) - ms).toISOString();

function persona(kind: "anonymous" | "student" | "admin" | "banned-admin") {
  mockCtx = {
    user: kind === "anonymous" ? null : { id: USER_ID },
    profile: kind === "anonymous" ? null : {
      id: USER_ID,
      roles: kind === "student" ? ["user"] : ["user", "admin"],
      onboarding_completed: true,
      banned_at: kind === "banned-admin" ? "2026-01-01T00:00:00Z" : null,
      ban_expires_at: null,
    },
    supabase: {},
    requestId: "ingestion-admin-test",
  } as unknown as RequestContext;
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockElevated = createFakeSupabase({
    tables: {
      events: [
        { id: "past", title: "Past pending", status: "pending", deleted_at: null, source: "instagram", source_url: "https://www.instagram.com/p/past/", created_at: ago(2 * HOUR), start_date: wallClockAgo(HOUR) },
        { id: "old", title: "Old pending", status: "pending", deleted_at: null, source: "instagram", source_url: null, created_at: ago(100 * HOUR), start_date: ahead(100 * HOUR) },
      ],
      ingestion_deliveries: [
        { id: "d1", producer: "instagram-apify@1", run_id: null, received_at: ago(HOUR), outcome: "succeeded", event_count: 2, inserted: 2, duplicates: 0, invalid: 0, items_seen: 24, error_code: null },
      ],
    },
  });
});
afterEach(() => jest.restoreAllMocks());

async function get() {
  const GET: IngestionGET = (await import("@/app/api/admin/ingestion/route")).GET;
  const response = await GET();
  return { status: response.status, headers: response.headers, body: await response.json() };
}

describe("GET /api/admin/ingestion", () => {
  it.each([
    ["anonymous", 401],
    ["student", 403],
    ["banned-admin", 403],
  ] as const)("refuses %s with %i before any database read", async (kind, status) => {
    persona(kind);
    const result = await get();
    expect(result.status).toBe(status);
    expect(mockElevated.calls).toEqual([]);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers an admin with the summary, the deliveries and the stale queue", async () => {
    persona("admin");
    const result = await get();
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(Object.keys(result.body).sort()).toEqual(["deliveries", "stale", "summary"]);
    expect(result.body.summary).toMatchObject({ pending_review: 2, last_error_code: null });
    expect(result.body.summary.last_success_at).toEqual(expect.any(String));
    expect(result.body.deliveries).toEqual([expect.objectContaining({ id: "d1", outcome: "succeeded", inserted: 2 })]);
    // A pending event whose date passed stays visible to moderators here.
    expect(result.body.stale.map((row: { id: string }) => row.id)).toContain("past");
    expect(result.body.stale.map((row: { id: string }) => row.id)).toEqual(["old", "past"]);
    expect(Object.keys(result.body.stale[0]).sort()).toEqual(["created_at", "id", "is_past", "source", "source_url", "start_date", "title"]);
    // M3 final review: the server judges "past" with the wall-clock rule.
    expect(result.body.stale.map((row: { id: string; is_past: boolean }) => [row.id, row.is_past])).toEqual([
      ["old", false],
      ["past", true],
    ]);
  });

  it("a database error answers the wrapper's generic 500", async () => {
    persona("admin");
    mockElevated = createFakeSupabase({ errors: { ingestion_deliveries: { code: "XX000", message: "private detail" } } });
    const result = await get();
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "Failed to load ingestion status" });
  });
});

describe("POST /api/admin/ingestion/images", () => {
  async function post(body: unknown) {
    const POST: PersistPOST = (await import("@/app/api/admin/ingestion/images/route")).POST;
    const response = await POST(new NextRequest("http://localhost/api/admin/ingestion/images", {
      method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
    }));
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  const SUMMARY = { processed: 2, persisted: 1, cleared: 1, failed: [] };
  beforeEach(() => { mockPersist.mockReset(); mockPersist.mockResolvedValue(SUMMARY); });

  it.each([
    ["anonymous", 401],
    ["student", 403],
    ["banned-admin", 403],
  ] as const)("refuses %s with %i before any fetch or write", async (kind, status) => {
    persona(kind);
    const result = await post({});
    expect(result.status).toBe(status);
    expect(mockPersist).not.toHaveBeenCalled();
  });

  it("an admin persists with the default limit of 10 and gets the summary", async () => {
    persona("admin");
    const result = await post({});
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.body).toEqual(SUMMARY);
    expect(mockPersist).toHaveBeenCalledWith(10);
  });

  it("passes an explicit limit", async () => {
    persona("admin");
    await post({ limit: 3 });
    expect(mockPersist).toHaveBeenCalledWith(3);
  });

  it.each([
    ["limit 0", { limit: 0 }],
    ["limit 11", { limit: 11 }],
    ["limit fractional", { limit: 2.5 }],
    ["an unknown key", { limit: 2, url: "http://169.254.169.254/" }],
  ])("%s is a 400 without persisting", async (_label, body) => {
    persona("admin");
    const result = await post(body);
    expect(result.status).toBe(400);
    expect(mockPersist).not.toHaveBeenCalled();
  });
});
