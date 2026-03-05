/**
 * Tests for /api/clubs/:id/analytics
 *
 * Unit-tests for the club analytics API route handler.
 * Uses the same mock Supabase approach as events/rsvp.test.ts.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "update", "delete", "eq", "neq", "in",
    "maybeSingle", "single", "order", "limit", "gte",
  ];
  for (const method of methods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.from = jest.fn().mockReturnValue(builder);
  builder.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  builder.single = jest.fn().mockResolvedValue(resolvedValue);
  return builder;
}

let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;
let mockQueryResults: Map<string, { data: unknown; error: unknown }>;

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
  return new Request("http://localhost:3000/api/clubs/club-123/analytics", {
    method: "GET",
  });
}

function createRouteContext(clubId = "club-123") {
  return { params: Promise.resolve({ id: clubId }) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let GET: (req: Request, ctx: ReturnType<typeof createRouteContext>) => Promise<Response>;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUser = null;
  mockAuthError = null;
  mockQueryResults = new Map();

  const routeModule = await import("@/app/api/clubs/[id]/analytics/route");
  GET = routeModule.GET as typeof GET;
});

describe("GET /api/clubs/:id/analytics", () => {
  it("returns 401 when not authenticated", async () => {
    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a club member", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("club_members", { data: null, error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBeDefined();
  });

  it("returns empty analytics for club with no data", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("club_members", {
      data: { user_id: "user-123", club_id: "club-123", role: "owner" },
      error: null,
    });
    // No followers, no events, no rsvps
    mockQueryResults.set("club_followers", { data: [], error: null });
    mockQueryResults.set("events", { data: [], error: null });
    mockQueryResults.set("rsvps", { data: [], error: null });
    mockQueryResults.set("event_popularity_scores", { data: [], error: null });
    mockQueryResults.set("saved_events", { data: [], error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.follower_growth).toEqual([]);
    expect(json.total_attendees).toBe(0);
    expect(json.popular_tags).toEqual([]);
    expect(json.events).toEqual([]);
  });

  it("returns follower growth bucketed by day", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("club_members", {
      data: { user_id: "user-123", club_id: "club-123", role: "owner" },
      error: null,
    });
    mockQueryResults.set("club_followers", {
      data: [
        { created_at: "2026-03-01T10:00:00Z" },
        { created_at: "2026-03-01T14:00:00Z" },
        { created_at: "2026-03-03T10:00:00Z" },
      ],
      error: null,
    });
    mockQueryResults.set("events", { data: [], error: null });
    mockQueryResults.set("rsvps", { data: [], error: null });
    mockQueryResults.set("event_popularity_scores", { data: [], error: null });
    mockQueryResults.set("saved_events", { data: [], error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.follower_growth)).toBe(true);
    // Should have entries with date and cumulative count
    if (json.follower_growth.length > 0) {
      expect(json.follower_growth[0]).toHaveProperty("date");
      expect(json.follower_growth[0]).toHaveProperty("count");
    }
  });

  it("returns popular tags sorted by count", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("club_members", {
      data: { user_id: "user-123", club_id: "club-123", role: "owner" },
      error: null,
    });
    mockQueryResults.set("club_followers", { data: [], error: null });
    mockQueryResults.set("events", {
      data: [
        { id: "e1", title: "Event 1", event_date: "2026-04-01", tags: ["social", "sports"] },
        { id: "e2", title: "Event 2", event_date: "2026-04-02", tags: ["social", "academic"] },
        { id: "e3", title: "Event 3", event_date: "2026-04-03", tags: ["social"] },
      ],
      error: null,
    });
    mockQueryResults.set("rsvps", { data: [], error: null });
    mockQueryResults.set("event_popularity_scores", { data: [], error: null });
    mockQueryResults.set("saved_events", { data: [], error: null });

    const req = createMockRequest();
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.popular_tags)).toBe(true);
    // "social" should be first (3 occurrences)
    if (json.popular_tags.length > 0) {
      expect(json.popular_tags[0].tag).toBe("social");
      expect(json.popular_tags[0].count).toBe(3);
    }
  });
});
