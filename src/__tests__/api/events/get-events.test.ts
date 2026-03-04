/**
 * Unit tests for GET /api/events
 *
 * Covers:
 *   - Successful retrieval of events
 *   - Empty events response
 *   - Filtering by tags, search, dateFrom, dateTo
 *   - Pagination (page, limit)
 *   - Supabase error → 500
 *
 * Supabase and tagMapping are mocked — no live DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MockEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string | null;
  location: string;
  club_id: string | null;
  tags: string[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  club: null;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    id: "evt-1",
    title: "Hackathon 2099",
    description: "A coding competition",
    start_date: "2099-06-15T10:00:00Z",
    end_date: "2099-06-15T18:00:00Z",
    location: "Trottier Building",
    club_id: "club-1",
    tags: ["academic", "coding"],
    image_url: null,
    created_at: "2099-01-01T00:00:00Z",
    updated_at: "2099-01-01T00:00:00Z",
    status: "approved",
    created_by: "user-1",
    approved_by: "admin-1",
    approved_at: "2099-01-02T00:00:00Z",
    club: null,
    ...overrides,
  };
}

// ─── Supabase mock ───────────────────────────────────────────────────────────

/**
 * Resolved value that the terminal `.range()` call will return.
 * Tests override `mockResolvedValue` to control what the query resolves to.
 */
let mockQueryResult: { data: MockEvent[] | null; error: { message: string } | null; count: number | null };

/**
 * Build a chainable Supabase query builder where every intermediate method
 * returns `this`, and `.range()` is the terminal method that resolves.
 */
function createChainableBuilder() {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select",
    "eq",
    "order",
    "overlaps",
    "or",
    "gte",
    "lte",
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // `.range()` is the terminal method — resolves the query result
  builder.range = vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult));

  return builder;
}

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Pass-through: return the event as-is so assertions can check raw field values
vi.mock("@/lib/tagMapping", () => ({
  transformEventFromDB: vi.fn((e: unknown) => e),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/events");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ─── Module reset ─────────────────────────────────────────────────────────────

let GET: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  // Default: return one event, no error
  mockQueryResult = { data: [makeEvent()], error: null, count: 1 };

  // Reset from() to return a fresh chainable builder each call
  mockSupabase.from.mockImplementation(() => createChainableBuilder());

  const routeModule = await import("@/app/api/events/route");
  GET = routeModule.GET as typeof GET;
});

// ─── Success cases ────────────────────────────────────────────────────────────

describe("GET /api/events — success", () => {
  it("returns 200 with events array and pagination metadata", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("events");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("totalPages");
  });

  it("returns the events returned by Supabase", async () => {
    const event = makeEvent({ id: "evt-42", title: "Career Fair" });
    mockQueryResult = { data: [event], error: null, count: 1 };

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.events).toHaveLength(1);
    expect(body.events[0].id).toBe("evt-42");
    expect(body.events[0].title).toBe("Career Fair");
  });

  it("returns multiple events", async () => {
    const events = [
      makeEvent({ id: "evt-1", title: "Event One" }),
      makeEvent({ id: "evt-2", title: "Event Two" }),
      makeEvent({ id: "evt-3", title: "Event Three" }),
    ];
    mockQueryResult = { data: events, error: null, count: 3 };

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.events).toHaveLength(3);
    expect(body.total).toBe(3);
  });

  it("uses default pagination: page=1, limit=50", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
  });

  it("respects custom page and limit query parameters", async () => {
    mockQueryResult = { data: [], error: null, count: 0 };

    const res = await GET(makeRequest({ page: "3", limit: "10" }));
    const body = await res.json();

    expect(body.page).toBe(3);
    expect(body.limit).toBe(10);
  });

  it("computes totalPages correctly", async () => {
    mockQueryResult = { data: [], error: null, count: 25 };

    const res = await GET(makeRequest({ limit: "10" }));
    const body = await res.json();

    expect(body.totalPages).toBe(3); // ceil(25 / 10) = 3
  });

  it("returns totalPages=0 when there are no events", async () => {
    mockQueryResult = { data: [], error: null, count: 0 };

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.totalPages).toBe(0);
    expect(body.total).toBe(0);
  });
});

// ─── Empty response ───────────────────────────────────────────────────────────

describe("GET /api/events — empty response", () => {
  it("returns 200 with an empty events array when no events exist", async () => {
    mockQueryResult = { data: [], error: null, count: 0 };

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.events).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("handles null data from Supabase gracefully", async () => {
    mockQueryResult = { data: null, error: null, count: 0 };

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.events).toEqual([]);
  });

  it("returns empty events when search query matches nothing", async () => {
    mockQueryResult = { data: [], error: null, count: 0 };

    const res = await GET(makeRequest({ search: "xyznonexistent123" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.events).toEqual([]);
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe("GET /api/events — filters", () => {
  it("calls overlaps() when tags parameter is provided", async () => {
    // Capture the builder to inspect method calls
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest({ tags: "academic,social" }));

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).overlaps).toHaveBeenCalledWith(
      "tags",
      ["academic", "social"]
    );
  });

  it("calls or() with ilike when search parameter is provided", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest({ search: "hackathon" }));

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).or).toHaveBeenCalledWith(
      "title.ilike.%hackathon%,description.ilike.%hackathon%"
    );
  });

  it("calls gte() when dateFrom parameter is provided", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest({ dateFrom: "2099-06-01" }));

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).gte).toHaveBeenCalledWith(
      "start_date",
      "2099-06-01"
    );
  });

  it("calls lte() when dateTo parameter is provided", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest({ dateTo: "2099-12-31" }));

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).lte).toHaveBeenCalledWith(
      "start_date",
      "2099-12-31"
    );
  });

  it("does not call overlaps() when tags parameter is absent", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest());

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).overlaps).not.toHaveBeenCalled();
  });

  it("trims whitespace from individual tag values", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest({ tags: " academic , social " }));

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).overlaps).toHaveBeenCalledWith(
      "tags",
      ["academic", "social"]
    );
  });

  it("applies correct range offset for page 2 with limit 10", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    mockQueryResult = { data: [], error: null, count: 0 };

    await GET(makeRequest({ page: "2", limit: "10" }));

    expect(capturedBuilder).not.toBeNull();
    // page=2, limit=10 → from=10, to=19
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).range).toHaveBeenCalledWith(10, 19);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("GET /api/events — error handling", () => {
  it("returns 500 when Supabase returns an error", async () => {
    mockQueryResult = {
      data: null,
      error: { message: "Database connection failed" },
      count: null,
    };

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("includes the Supabase error message in the 500 response", async () => {
    const errorMessage = "relation \"events\" does not exist";
    mockQueryResult = {
      data: null,
      error: { message: errorMessage },
      count: null,
    };

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.error).toBe(errorMessage);
  });

  it("returns 500 with generic message when an unexpected exception is thrown", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("Unexpected crash");
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ─── Response shape ───────────────────────────────────────────────────────────

describe("GET /api/events — response shape", () => {
  it("only queries with eq('status', 'approved')", async () => {
    let capturedBuilder: ReturnType<typeof createChainableBuilder> | null = null;
    mockSupabase.from.mockImplementation(() => {
      capturedBuilder = createChainableBuilder();
      return capturedBuilder;
    });

    await GET(makeRequest());

    expect(capturedBuilder).not.toBeNull();
    expect((capturedBuilder as ReturnType<typeof createChainableBuilder>).eq).toHaveBeenCalledWith(
      "status",
      "approved"
    );
  });

  it("queries the 'events' table", async () => {
    await GET(makeRequest());

    expect(mockSupabase.from).toHaveBeenCalledWith("events");
  });

  it("response contains exactly the keys: events, total, page, limit, totalPages", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(
      ["events", "limit", "page", "total", "totalPages"].sort()
    );
  });

  it("total reflects the count returned by Supabase, not the events array length", async () => {
    // Simulate a paginated scenario: 1 page of results but 100 total in DB
    mockQueryResult = { data: [makeEvent()], error: null, count: 100 };

    const res = await GET(makeRequest({ limit: "1" }));
    const body = await res.json();

    expect(body.events).toHaveLength(1);
    expect(body.total).toBe(100);
    expect(body.totalPages).toBe(100);
  });
});
