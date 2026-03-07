/**
 * Tests for /api/events/:id/analytics
 *
 * Unit-tests for the event analytics API route handler.
 * Uses the same mock Supabase approach as rsvp.test.ts.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "update", "delete", "eq", "neq", "in",
    "maybeSingle", "single", "order", "limit",
  ];
  for (const method of methods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.from = jest.fn().mockReturnValue(builder);
  // Terminal methods resolve the value
  builder.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  builder.single = jest.fn().mockResolvedValue(resolvedValue);
  // Make builder thenable so `await supabase.from(...).select(...).eq(...)` resolves
  builder.then = jest.fn((resolve: (v: unknown) => void) => resolve(resolvedValue));
  return builder;
}

let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;
let mockQueryResults: Map<string, { data: unknown; error: unknown }>;

// Track from() calls to return different results per table
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

function createMockRequest(): Request {
  return new Request("http://localhost:3000/api/events/event-123/analytics", {
    method: "GET",
  });
}

function createRouteContext(eventId = "event-123") {
  return { params: Promise.resolve({ id: eventId }) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let GET: (req: Request, ctx: ReturnType<typeof createRouteContext>) => Promise<Response>;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUser = null;
  mockAuthError = null;
  mockQueryResults = new Map();

  const routeModule = await import("@/app/api/events/[id]/analytics/route");
  GET = routeModule.GET as typeof GET;
});

describe("GET /api/events/:id/analytics", () => {
  it("returns 401 when not authenticated", async () => {
    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a club member", async () => {
    mockUser = { id: "user-123" };
    // Event exists with a club_id
    mockQueryResults.set("events", {
      data: { id: "event-123", title: "Test Event", event_date: "2026-04-01", club_id: "club-abc" },
      error: null,
    });
    // User is NOT a member of the club
    mockQueryResults.set("club_members", { data: null, error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBeDefined();
  });

  it("returns event analytics with zero defaults for new event", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("events", {
      data: { id: "event-123", title: "Test Event", event_date: "2026-04-01", club_id: "club-abc" },
      error: null,
    });
    mockQueryResults.set("club_members", {
      data: { user_id: "user-123", club_id: "club-abc", role: "owner" },
      error: null,
    });
    // No popularity scores, no rsvps, no saved_events
    mockQueryResults.set("event_popularity_scores", { data: null, error: null });
    mockQueryResults.set("rsvps", { data: [], error: null });
    mockQueryResults.set("saved_events", { data: [], error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.event_id).toBe("event-123");
    expect(json.views).toBe(0);
    expect(json.clicks).toBe(0);
    expect(json.saves).toBe(0);
    expect(json.rsvp_going).toBe(0);
    expect(json.rsvp_interested).toBe(0);
  });

  it("returns correct analytics aggregation", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("events", {
      data: { id: "event-123", title: "Big Event", event_date: "2026-04-01", club_id: "club-abc" },
      error: null,
    });
    mockQueryResults.set("club_members", {
      data: { user_id: "user-123", club_id: "club-abc", role: "organizer" },
      error: null,
    });
    mockQueryResults.set("event_popularity_scores", {
      data: { view_count: 150, click_count: 45, save_count: 20, unique_viewers: 120 },
      error: null,
    });
    mockQueryResults.set("rsvps", {
      data: [
        { status: "going" },
        { status: "going" },
        { status: "interested" },
      ],
      error: null,
    });
    mockQueryResults.set("saved_events", {
      data: [{ id: "1" }, { id: "2" }, { id: "3" }],
      error: null,
    });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.event_id).toBe("event-123");
    expect(json.title).toBe("Big Event");
    expect(json.views).toBe(150);
    expect(json.clicks).toBe(45);
    expect(json.saves).toBe(3); // from saved_events count, not popularity
    expect(json.unique_viewers).toBe(120);
    expect(json.rsvp_going).toBe(2);
    expect(json.rsvp_interested).toBe(1);
  });
});
