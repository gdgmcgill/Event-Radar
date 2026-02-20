/**
 * Tests for /api/events/:id/rsvp
 *
 * These tests mock the Supabase client to unit-test the API route handlers
 * without requiring a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock chainable Supabase query builder
function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "maybeSingle", "single"];
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // from() returns the builder
  builder.from = vi.fn().mockReturnValue(builder);
  // Terminal methods resolve the value
  builder.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  builder.single = vi.fn().mockResolvedValue(resolvedValue);
  // select after insert/update should still chain
  const selectAfterMutation = {
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  builder.select = vi.fn().mockReturnValue({ ...builder, ...selectAfterMutation });
  return builder;
}

let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;
let mockQueryResults: Map<string, { data: unknown; error: unknown }>;

const mockSupabase = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: mockUser },
        error: mockAuthError,
      })
    ),
  },
  from: vi.fn((table: string) => {
    const defaultResult = { data: null, error: null };
    const result = mockQueryResults.get(table) ?? defaultResult;
    const builder = createMockQueryBuilder(result);
    return builder;
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockRequest(method: string, body?: Record<string, unknown>): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/events/test-event-id/rsvp", init);
}

function createRouteContext(eventId = "test-event-id") {
  return { params: Promise.resolve({ id: eventId }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

// Dynamically import route handlers (after mocks are set up)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GET: any, POST: any, DELETE: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser = null;
  mockAuthError = null;
  mockQueryResults = new Map();

  // Default: event exists
  mockQueryResults.set("events", { data: { id: "test-event-id" }, error: null });
  // Default: no existing RSVPs
  mockQueryResults.set("rsvps", { data: null, error: null });

  const routeModule = await import("@/app/api/events/[id]/rsvp/route");
  GET = routeModule.GET as typeof GET;
  POST = routeModule.POST as typeof POST;
  DELETE = routeModule.DELETE as typeof DELETE;
});

// ─── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/events/:id/rsvp", () => {
  it("returns RSVP counts and null user_rsvp for unauthenticated user", async () => {
    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("counts");
    expect(json).toHaveProperty("user_rsvp");
    expect(json.counts).toHaveProperty("going");
    expect(json.counts).toHaveProperty("interested");
    expect(json.counts).toHaveProperty("total");
  });

  it("returns 404 when event does not exist", async () => {
    mockQueryResults.set("events", { data: null, error: null });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Event not found");
  });

  it("returns 500 when event lookup fails", async () => {
    mockQueryResults.set("events", { data: null, error: { message: "DB error" } });

    const req = createMockRequest("GET");
    const res = await GET(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to verify event");
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/events/:id/rsvp", () => {
  it("returns 401 when user is not authenticated", async () => {
    const req = createMockRequest("POST", {
      user_id: "user-123",
      status: "going",
    });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when user_id is missing", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", { status: "going" });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("user_id is required");
  });

  it("returns 403 when user_id does not match authenticated user", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", {
      user_id: "different-user",
      status: "going",
    });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("user_id does not match authenticated user");
  });

  it("returns 400 when status is missing", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", { user_id: "user-123" });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("status is required");
  });

  it("returns 400 when status is invalid", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("POST", {
      user_id: "user-123",
      status: "maybe",
    });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Invalid status");
  });

  it("returns 404 when event does not exist", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("events", { data: null, error: null });

    const req = createMockRequest("POST", {
      user_id: "user-123",
      status: "going",
    });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Event not found");
  });

  it("returns 400 when JSON body is invalid", async () => {
    mockUser = { id: "user-123" };

    const req = new Request("http://localhost:3000/api/events/test-event-id/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });
});

// ─── DELETE Tests ───────────────────────────────────────────────────────────

describe("DELETE /api/events/:id/rsvp", () => {
  it("returns 401 when user is not authenticated", async () => {
    const req = createMockRequest("DELETE", { user_id: "user-123" });
    const res = await DELETE(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when user_id is missing", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("DELETE", {});
    const res = await DELETE(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("user_id is required");
  });

  it("returns 403 when user_id does not match authenticated user", async () => {
    mockUser = { id: "user-123" };

    const req = createMockRequest("DELETE", { user_id: "different-user" });
    const res = await DELETE(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("user_id does not match authenticated user");
  });

  it("returns 404 when no active RSVP exists", async () => {
    mockUser = { id: "user-123" };
    mockQueryResults.set("rsvps", { data: null, error: null });

    const req = createMockRequest("DELETE", { user_id: "user-123" });
    const res = await DELETE(req, createRouteContext());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("No active RSVP found for this event");
  });
});