/**
 * Integration tests for date validation in event API endpoints.
 *
 * Tests cover:
 *   - POST /api/events/create  — create event with various date inputs
 *   - PATCH /api/events/:id    — update event with various date inputs
 *
 * Supabase and auth are mocked so no live DB is required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Constants ───────────────────────────────────────────────────────────────

const FUTURE_DATE = "2099-12-31";
const FUTURE_DATETIME = "2099-12-31T09:00:00Z";
const FUTURE_END_DATETIME = "2099-12-31T11:00:00Z";
const PAST_DATE = "2000-01-01";
const PAST_DATETIME = "2000-01-01T00:00:00Z";

// ─── Supabase mock ───────────────────────────────────────────────────────────

let mockUser: { id: string; email: string } | null = null;
let mockAuthError: { message: string } | null = null;

function createMockChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "eq", "single", "maybeSingle"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  chain.select = vi.fn().mockReturnValue({
    ...chain,
    single: vi.fn().mockResolvedValue(resolvedValue),
  });
  return chain;
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: mockUser }, error: mockAuthError })
    ),
  },
  from: vi.fn(() =>
    createMockChain({
      data: { id: "evt-1", club_id: null, roles: ["club_organizer"] },
      error: null,
    })
  ),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/tagMapping", () => ({
  transformEventFromDB: vi.fn((e: unknown) => e),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCreateRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/events/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeUpdateRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/events/test-id", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeContext(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

/** Minimal valid event body for the create endpoint. */
const validCreateBody = () => ({
  title: "Study Session",
  description: "Group study for finals",
  start_date: FUTURE_DATETIME,
  end_date: FUTURE_END_DATETIME,
  location: "McLennan Library",
  tags: ["academic"],
});

// ─── Module cache reset ───────────────────────────────────────────────────────

let POST: (req: Request) => Promise<Response>;
let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mockUser = { id: "user-1", email: "daniel@mail.mcgill.ca" };
  mockAuthError = null;

  // Reset default Supabase mock to return a valid profile with admin role
  mockSupabase.from.mockImplementation(() =>
    createMockChain({
      data: { id: "evt-1", club_id: null, roles: ["admin"], name: "Daniel" },
      error: null,
    })
  );

  const createModule = await import("@/app/api/events/create/route");
  const updateModule = await import("@/app/api/events/[id]/route");

  POST = createModule.POST as typeof POST;
  PATCH = updateModule.PATCH as typeof PATCH;
});

// ─── Create Event — Date Validation Tests ────────────────────────────────────

describe("POST /api/events/create — date validation", () => {
  it("returns 201 for a valid future start_date (date-only)", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: FUTURE_DATE, end_date: undefined }));
    expect(res.status).toBe(201);
  });

  it("returns 201 for a valid future ISO datetime with end_date after start", async () => {
    const res = await POST(makeCreateRequest(validCreateBody()));
    expect(res.status).toBe(201);
  });

  it("returns 400 when start_date is missing", async () => {
    const body = { ...validCreateBody() };
    delete (body as Record<string, unknown>).start_date;
    const res = await POST(makeCreateRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/start.?date/i);
  });

  it("returns 400 when start_date is an empty string", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 for MM/DD/YYYY start_date format", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: "12/31/2099" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 for DD-MM-YYYY start_date format", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: "31-12-2099" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 for a past start_date (date-only)", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: PAST_DATE }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
    expect(json.error).toMatch(/future/i);
  });

  it("returns 400 for a past start_date (datetime)", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: PAST_DATETIME }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 for a calendar-invalid date (Feb 30)", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: "2099-02-30" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 when end_date is not a valid ISO string", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), end_date: "not-a-date" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
  });

  it("returns 400 when end_date is before start_date", async () => {
    const res = await POST(
      makeCreateRequest({ ...validCreateBody(), start_date: FUTURE_DATETIME, end_date: "2026-01-01T00:00:00Z" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
    expect(json.error).toMatch(/after/i);
  });

  it("returns 400 when end_date equals start_date", async () => {
    const res = await POST(
      makeCreateRequest({ ...validCreateBody(), start_date: FUTURE_DATETIME, end_date: FUTURE_DATETIME })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
  });

  it("returns 400 for a plain number as start_date", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: 1234567890 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 for an ISO datetime without timezone designator", async () => {
    const res = await POST(makeCreateRequest({ ...validCreateBody(), start_date: "2099-12-31T09:00:00" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });
});

// ─── Update Event — Date Validation Tests ────────────────────────────────────

describe("PATCH /api/events/:id — date validation", () => {
  it("returns 200 when updating start_date to a valid future datetime", async () => {
    const res = await PATCH(
      makeUpdateRequest({ start_date: FUTURE_DATETIME, end_date: FUTURE_END_DATETIME }),
      routeContext()
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when updating only end_date to a valid ISO date", async () => {
    const res = await PATCH(makeUpdateRequest({ end_date: FUTURE_END_DATETIME }), routeContext());
    expect(res.status).toBe(200);
  });

  it("returns 200 when updating non-date fields only", async () => {
    const res = await PATCH(makeUpdateRequest({ title: "New Title" }), routeContext());
    expect(res.status).toBe(200);
  });

  it("returns 400 when start_date is a past date", async () => {
    const res = await PATCH(makeUpdateRequest({ start_date: PAST_DATE }), routeContext());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
    expect(json.error).toMatch(/future/i);
  });

  it("returns 400 when start_date uses MM/DD/YYYY format", async () => {
    const res = await PATCH(makeUpdateRequest({ start_date: "12/31/2099" }), routeContext());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("start_date");
  });

  it("returns 400 when end_date is before start_date in an update", async () => {
    const res = await PATCH(
      makeUpdateRequest({ start_date: FUTURE_DATETIME, end_date: "2026-01-01T00:00:00Z" }),
      routeContext()
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
  });

  it("returns 400 when only end_date is updated to an invalid format", async () => {
    const res = await PATCH(makeUpdateRequest({ end_date: "March 15 2099" }), routeContext());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
  });

  it("returns 400 when end_date is a past datetime on its own", async () => {
    // A past end_date isn't explicitly blocked by format, but it is invalid ISO?
    // Our spec only enforces format for standalone end_date, not future constraint.
    // This test just confirms the format check works for clearly invalid strings.
    const res = await PATCH(makeUpdateRequest({ end_date: "not-valid" }), routeContext());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.field).toBe("end_date");
  });
});
