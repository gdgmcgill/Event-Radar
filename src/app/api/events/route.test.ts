import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tagMapping", () => ({
  transformEventFromDB: (event: unknown) => event,
}));

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
};

describe("GET /api/events cursor pagination", () => {
  const mockFrom = vi.fn();
  const mockQueryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    overlaps: vi.fn(),
    or: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    returns: vi.fn(),
  };

  let queryResult: QueryResult;

  beforeEach(() => {
    Object.values(mockQueryBuilder).forEach((fn) => fn.mockReset());
    mockFrom.mockReset();

    Object.values(mockQueryBuilder).forEach((fn) => fn.mockReturnThis());
    mockQueryBuilder.returns.mockImplementation(async () => queryResult);
    mockFrom.mockReturnValue(mockQueryBuilder);

    const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
    mockCreateClient.mockResolvedValue({ from: mockFrom });
  });

  const encodeCursor = (payload: { sortValue: string | number; id: string }) =>
    Buffer.from(JSON.stringify(payload)).toString("base64");

  const decodeCursor = (cursor: string) =>
    JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as {
      sortValue: string | number;
      id: string;
    };

  const buildEvent = (id: string, startDate: string) => ({
    id,
    start_date: startDate,
    created_at: startDate,
  });

  it("returns nextCursor on first page when more results exist", async () => {
    queryResult = {
      data: [
        buildEvent("1", "2026-02-01"),
        buildEvent("2", "2026-02-02"),
        buildEvent("3", "2026-02-03"),
      ],
      error: null,
      count: 3,
    };

    const request = new NextRequest("http://localhost/api/events?limit=2");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.prevCursor).toBeNull();
    expect(body.nextCursor).toBeTruthy();

    const cursorPayload = decodeCursor(body.nextCursor);
    expect(cursorPayload.id).toBe("2");
    expect(cursorPayload.sortValue).toBe("2026-02-02");
  });

  it("returns prevCursor when requesting with cursor", async () => {
    queryResult = {
      data: [buildEvent("3", "2026-02-03"), buildEvent("4", "2026-02-04")],
      error: null,
      count: 4,
    };

    const cursor = encodeCursor({ sortValue: "2026-02-02", id: "2" });
    const request = new NextRequest(
      `http://localhost/api/events?limit=2&cursor=${cursor}`
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
    expect(body.prevCursor).toBeTruthy();

    const cursorPayload = decodeCursor(body.prevCursor);
    expect(cursorPayload.id).toBe("3");
    expect(cursorPayload.sortValue).toBe("2026-02-03");
  });

  it("returns prevCursor and nextCursor when requesting with before", async () => {
    queryResult = {
      data: [
        buildEvent("1", "2026-02-01"),
        buildEvent("2", "2026-02-02"),
        buildEvent("3", "2026-02-03"),
      ],
      error: null,
      count: 3,
    };

    const before = encodeCursor({ sortValue: "2026-02-04", id: "4" });
    const request = new NextRequest(
      `http://localhost/api/events?limit=2&before=${before}`
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.prevCursor).toBeTruthy();
    expect(body.nextCursor).toBeTruthy();

    const prevPayload = decodeCursor(body.prevCursor);
    const nextPayload = decodeCursor(body.nextCursor);

    expect(prevPayload.id).toBe("2");
    expect(prevPayload.sortValue).toBe("2026-02-02");
    expect(nextPayload.id).toBe("1");
    expect(nextPayload.sortValue).toBe("2026-02-01");
  });

  it("rejects invalid cursor values", async () => {
    queryResult = {
      data: [],
      error: null,
      count: 0,
    };

    const request = new NextRequest(
      "http://localhost/api/events?cursor=not-a-valid-cursor"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid cursor");
  });
});
