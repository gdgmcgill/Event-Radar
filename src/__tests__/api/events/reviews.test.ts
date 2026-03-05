/**
 * Tests for /api/events/:id/reviews
 *
 * These tests mock the Supabase client to unit-test the API route handlers
 * without requiring a live database connection.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock chainable Supabase query builder
function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "maybeSingle", "single", "gte", "lte", "limit", "order"];
  for (const method of methods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.from = jest.fn().mockReturnValue(builder);
  // Terminal methods resolve the value
  builder.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  builder.single = jest.fn().mockResolvedValue(resolvedValue);
  // select after insert/update should still chain
  const selectAfterMutation = {
    single: jest.fn().mockResolvedValue(resolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
  };
  builder.select = jest.fn().mockReturnValue({ ...builder, ...selectAfterMutation });
  return builder;
}

let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;
// Per-table mock results with array support for ordered calls
let mockQueryResults: Map<string, { data: unknown; error: unknown }>;
// Call counters for tables that need different results on different calls
let mockCallCounters: Map<string, number>;

const mockSupabase = {
  auth: {
    getUser: jest.fn(() =>
      Promise.resolve({
        data: { user: mockUser },
        error: mockAuthError,
      })
    ),
  },
  from: jest.fn((table: string) => {
    const defaultResult = { data: null, error: null };
    const result = mockQueryResults.get(table) ?? defaultResult;
    const builder = createMockQueryBuilder(result);
    return builder;
  }),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockRequest(method: string, body?: Record<string, unknown>): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/events/test-event-id/reviews", init);
}

function createRouteContext(eventId = "test-event-id") {
  return { params: Promise.resolve({ id: eventId }) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let GET: any, POST: any;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUser = null;
  mockAuthError = null;
  mockQueryResults = new Map();
  mockCallCounters = new Map();

  // Default: event exists with a past date
  mockQueryResults.set("events", {
    data: { id: "test-event-id", event_date: "2020-01-01", club_id: "club-1" },
    error: null,
  });

  const routeModule = await import("@/app/api/events/[id]/reviews/route");
  GET = routeModule.GET as typeof GET;
  POST = routeModule.POST as typeof POST;
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/events/:id/reviews", () => {
  it("returns 401 when not authenticated", async () => {
    const req = createMockRequest("POST", { rating: 5 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when rating is out of range (too low)", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", { rating: 0 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Rating must be");
  });

  it("returns 400 when rating is out of range (too high)", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", { rating: 6 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Rating must be");
  });

  it("returns 400 when event has not ended yet", async () => {
    mockUser = { id: "user-123" };
    // Set event date to the future
    mockQueryResults.set("events", {
      data: { id: "test-event-id", event_date: "2099-12-31", club_id: "club-1" },
      error: null,
    });

    const req = createMockRequest("POST", { rating: 4 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("after the event has ended");
  });

  it("returns 403 when user did not RSVP going", async () => {
    mockUser = { id: "user-123" };
    // Event in the past
    mockQueryResults.set("events", {
      data: { id: "test-event-id", event_date: "2020-01-01", club_id: "club-1" },
      error: null,
    });
    // No RSVP found
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("POST", { rating: 4 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("RSVP");
  });

  it("returns 409 when user already reviewed", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("events", {
      data: { id: "test-event-id", event_date: "2020-01-01", club_id: "club-1" },
      error: null,
    });
    mockQueryResults.set("rsvps", {
      data: { id: "rsvp-1", status: "going" },
      error: null,
    });
    // Existing review
    mockQueryResults.set("reviews", {
      data: { id: "review-1", rating: 5 },
      error: null,
    });

    const req = createMockRequest("POST", { rating: 4 });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("already reviewed");
  });

  it("returns 201 and creates review on valid submission", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("events", {
      data: { id: "test-event-id", event_date: "2020-01-01", club_id: "club-1" },
      error: null,
    });
    mockQueryResults.set("rsvps", {
      data: { id: "rsvp-1", status: "going" },
      error: null,
    });
    // No existing review -- use null for reviews so the "already reviewed" check sees no existing
    mockQueryResults.set("reviews", {
      data: null,
      error: null,
    });

    const req = createMockRequest("POST", { rating: 4, comment: "Great event!" });
    const res = await POST(req, createRouteContext());

    // The insert mock returns the same result, so we just check status
    expect(res.status).toBe(201);
  });
});

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/events/:id/reviews", () => {
  it("returns 401 when not authenticated", async () => {
    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns aggregate with empty data for no reviews", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("reviews", { data: [], error: null });
    mockQueryResults.set("club_members", { data: null, error: null });
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aggregate.total_reviews).toBe(0);
    expect(json.aggregate.average_rating).toBe(0);
  });

  it("returns correct aggregate calculation", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("reviews", {
      data: [
        { id: "r1", user_id: "u1", rating: 3, comment: null, created_at: "2020-01-02" },
        { id: "r2", user_id: "u2", rating: 4, comment: "Good", created_at: "2020-01-03" },
        { id: "r3", user_id: "u3", rating: 5, comment: "Great", created_at: "2020-01-04" },
      ],
      error: null,
    });
    mockQueryResults.set("club_members", { data: null, error: null });
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aggregate.total_reviews).toBe(3);
    expect(json.aggregate.average_rating).toBe(4.0);
  });

  it("includes anonymized comments for organizer", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("reviews", {
      data: [
        { id: "r1", user_id: "u1", rating: 4, comment: "Nice event", created_at: "2020-01-02" },
      ],
      error: null,
    });
    // User is a club member (organizer)
    mockQueryResults.set("club_members", {
      data: { id: "cm-1", user_id: "user-123", club_id: "club-1" },
      error: null,
    });
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aggregate.comments.length).toBe(1);
    expect(json.aggregate.comments[0].comment).toBe("Nice event");
    // Should NOT contain user_id
    expect(json.aggregate.comments[0]).not.toHaveProperty("user_id");
  });

  it("excludes comments for non-organizer", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("reviews", {
      data: [
        { id: "r1", user_id: "u1", rating: 4, comment: "Nice event", created_at: "2020-01-02" },
      ],
      error: null,
    });
    // User is NOT a club member
    mockQueryResults.set("club_members", { data: null, error: null });
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aggregate.comments).toEqual([]);
  });

  it("returns can_review and user_review fields", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("reviews", { data: [], error: null });
    mockQueryResults.set("club_members", { data: null, error: null });
    // User RSVP'd going
    mockQueryResults.set("rsvps", {
      data: { id: "rsvp-1", status: "going" },
      error: null,
    });
    // Event is in the past
    mockQueryResults.set("events", {
      data: { id: "test-event-id", event_date: "2020-01-01", club_id: "club-1" },
      error: null,
    });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("can_review");
    expect(json).toHaveProperty("user_review");
  });
});
