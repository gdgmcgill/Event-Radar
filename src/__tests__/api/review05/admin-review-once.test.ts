/**
 * Admin review routes act once (REVIEW-05 WR-07).
 *
 * PATCH /api/admin/organizer-requests/[id] and PATCH /api/admin/reports/[id]
 * read `status === "pending"` and then updated by id alone, so two
 * moderators (or a double click) both passed the read and both ran the side
 * effects. The update is now conditional on `status = pending`, and a write
 * that changes no row answers 409 before any side effect.
 */

import {
  ADMIN,
  CLUB_ID,
  OTHER,
  REPORT_ID,
  REQUEST_ID,
  EVENT_ID,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  writes,
  type Answers,
  type Fake,
} from "./fake";

let mockCookie: Fake;
let mockElevated: Fake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

function asAdmin(cookie: Answers): void {
  mockCookie = makeFake({
    user: ADMIN,
    profile: profileOf(ADMIN.id, ["user", "admin"]),
    answers: cookie,
  });
  mockElevated = makeFake();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("admin/organizer-requests/[id] PATCH", () => {
  type Route = typeof import("@/app/api/admin/organizer-requests/[id]/route");
  const pending = {
    "organizer_requests.select": {
      data: { id: REQUEST_ID, user_id: OTHER, club_id: CLUB_ID, status: "pending" },
    },
    "users.select": { data: { roles: ["user"] } },
    "clubs.select": { data: { name: "Club" } },
  };

  async function review() {
    const { PATCH }: Route = await import("@/app/api/admin/organizer-requests/[id]/route");
    return PATCH(
      jsonRequest(`admin/organizer-requests/${REQUEST_ID}`, "PATCH", { status: "approved" }),
      idParams(REQUEST_ID)
    );
  }

  it("the update is filtered by id and status = pending", async () => {
    asAdmin({ ...pending, "organizer_requests.update": { data: [{ id: REQUEST_ID }] } });
    const res = await review();
    expect(res.status).toBe(200);
    const [update] = callsTo(mockCookie, "organizer_requests", "update");
    expect(update.filters).toEqual([
      { op: "eq", column: "id", value: REQUEST_ID },
      { op: "eq", column: "status", value: "pending" },
    ]);
  });

  it("losing the race answers 409 and runs no side effect", async () => {
    asAdmin({ ...pending, "organizer_requests.update": { data: [] } });
    const res = await review();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This request has already been reviewed" });
    expect(writes(mockCookie)).toEqual(["organizer_requests.update"]);
    expect(writes(mockElevated)).toEqual([]);
  });
});

describe("admin/reports/[id] PATCH", () => {
  type Route = typeof import("@/app/api/admin/reports/[id]/route");
  const pending = {
    "event_reports.select": { data: { id: REPORT_ID, event_id: EVENT_ID, status: "pending" } },
  };

  async function review() {
    const { PATCH }: Route = await import("@/app/api/admin/reports/[id]/route");
    return PATCH(
      jsonRequest(`admin/reports/${REPORT_ID}`, "PATCH", { status: "dismissed" }),
      idParams(REPORT_ID)
    );
  }

  it("the update is filtered by id and status = pending", async () => {
    asAdmin({ ...pending, "event_reports.update": { data: [{ id: REPORT_ID }] } });
    const res = await review();
    expect(res.status).toBe(200);
    const [update] = callsTo(mockCookie, "event_reports", "update");
    expect(update.filters).toEqual([
      { op: "eq", column: "id", value: REPORT_ID },
      { op: "eq", column: "status", value: "pending" },
    ]);
  });

  it("losing the race answers 409 and writes no audit row", async () => {
    asAdmin({ ...pending, "event_reports.update": { data: [] } });
    const res = await review();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Report has already been actioned" });
    expect(writes(mockElevated)).toEqual([]);
  });
});
