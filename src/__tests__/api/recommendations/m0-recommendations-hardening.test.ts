/** M0 WR-05/06/07: real handlers, bounded work and server-owned attribution. */
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeSupabase, type FakeSupabaseInit } from "../../helpers/fakeSupabase";
import { E1, EXPERIMENT_ID, OTHER_USER_ID, STUDENT, VARIANT_CONTROL, VARIANT_DIVERSE, cookieInit, elevatedInit, read, type Scenario } from "./recommendationFixtures";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mockElevated.client, serviceRoleKey: () => "test-key" }));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const failure = { code: "08006", message: "database unavailable" };
function setup(scenario: Scenario = { persona: "student", scores: "all" }, cookie: Partial<FakeSupabaseInit> = {}, elevated: Partial<FakeSupabaseInit> = {}) {
  const c = cookieInit(scenario);
  const e = elevatedInit(scenario);
  mockCookie = createFakeSupabase({ ...c, ...cookie, tables: { ...c.tables, ...cookie.tables } });
  mockElevated = createFakeSupabase({ ...e, ...elevated, tables: { ...e.tables, ...elevated.tables } });
}
async function recommendations(query = "") {
  const { GET } = await import("@/app/api/recommendations/route");
  return read(await GET(new NextRequest(`http://localhost/api/recommendations${query}`)));
}
async function feedback(extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/recommendations/feedback/route");
  return read(await POST(new NextRequest("http://localhost/api/recommendations/feedback", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_id: E1, recommendation_rank: 1, action: "click", ...extra }),
  })));
}
function feedbackWrites() {
  return mockElevated.calls.filter(c => c.table === "recommendation_feedback" && c.operation === "insert");
}
function expectPrivateFailure(result: Awaited<ReturnType<typeof read>>) {
  expect(result.status).toBe(500);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(JSON.stringify(result.body)).not.toContain(failure.message);
  expect(console.error).toHaveBeenCalled();
}

describe("bounded recommendation work and actual profile schema", () => {
  it.each([
    ["", 10], ["?top_k=", 10], ["?top_k=abc", 10], ["?top_k=Infinity", 10],
    ["?top_k=0", 1], ["?top_k=-50", 1], ["?top_k=2.8", 2], ["?top_k=5abc", 5],
    ["?top_k=50", 50], ["?top_k=51", 50], ["?top_k=999999999999999999999", 50],
    [`?top_k=${"9".repeat(400)}`, 10],
  ])("%s bounds anonymous/fallback reads and the scored MMR pool", async (query, limit) => {
    for (const scenario of [
      { persona: "anonymous" }, { persona: "student", scores: "none" }, { persona: "student", scores: "all" },
    ] as Scenario[]) {
      setup(scenario);
      const result = await recommendations(query);
      expect(result.status).toBe(200);
      const expectedTable = scenario.scores === "all" ? "user_event_scores" : "events";
      const call = mockCookie.calls.find(c => c.table === expectedTable);
      expect(call?.limit).toBe(scenario.scores === "all" ? limit * 3 : limit);
      expect((result.body.recommendations as unknown[]).length).toBeLessThanOrEqual(limit);
    }
  });

  it("uses existing interest columns and generates a tag-specific explanation", async () => {
    setup();
    const result = await recommendations();
    expect(result.status).toBe(200);
    expect(mockCookie.calls.find(c => c.table === "users")?.columns).toBe("interest_tags, inferred_tags");
    const rec = (result.body.recommendations as Array<{event_id: string; explanation: string}>).find(r => r.event_id === E1);
    expect(rec?.explanation).toBe("Because you're interested in academic");
  });

  it.each(["users", "user_event_scores", "user_interactions"])("%s failure is visible instead of a degraded successful response", async table => {
    setup({ persona: "student", scores: "all" }, { errors: { [table]: failure } });
    expectPrivateFailure(await recommendations());
  });
  it.each(["anonymous", "student"] as const)("%s fallback read failure returns private 500", async persona => {
    setup({ persona, scores: "none" }, { errors: { events: failure } });
    expectPrivateFailure(await recommendations());
  });
  it.each(["experiments", "experiment_variants", "experiment_assignments.select", "experiment_assignments.insert"])("%s failure never reports an unpersisted variant", async table => {
    setup({ persona: "student", scores: "all", experiment: true }, {}, { errors: { [table]: failure } });
    expectPrivateFailure(await recommendations());
  });
});

describe("server-owned feedback experiment attribution", () => {
  it.each([undefined, VARIANT_DIVERSE, { forged: true }])("ignores client variant %p and uses the caller's assigned running variant", async maliciousVariant => {
    setup({ persona: "student", experiment: true, assignedVariant: VARIANT_CONTROL });
    const result = await feedback({ experiment_variant_id: maliciousVariant, user_id: OTHER_USER_ID });
    expect(result.status).toBe(200);
    expect(feedbackWrites()[0].payload).toMatchObject({ user_id: STUDENT.id, experiment_variant_id: VARIANT_CONTROL });
    expect(mockCookie.calls.some(c => c.operation === "insert")).toBe(false);
    expect(mockElevated.calls.filter(c => c.operation === "insert").map(c => c.table)).toEqual(["recommendation_feedback"]);
  });
  it("does not create an assignment or borrow another user's assignment", async () => {
    setup({ persona: "student", experiment: true }, {}, { tables: { experiment_assignments: [
      { experiment_id: EXPERIMENT_ID, user_id: OTHER_USER_ID, variant_id: VARIANT_DIVERSE },
    ] } });
    expect((await feedback({ experiment_variant_id: VARIANT_DIVERSE })).status).toBe(200);
    expect(feedbackWrites()[0].payload).toMatchObject({ experiment_variant_id: null });
    expect(mockElevated.calls.filter(c => c.operation === "insert").map(c => c.table)).toEqual(["recommendation_feedback"]);
  });
  it.each(["completed", "draft"])("%s experiment cannot receive new attribution", async status => {
    setup({ persona: "student", experiment: true, assignedVariant: VARIANT_CONTROL }, {}, { tables: {
      experiments: [{ id: EXPERIMENT_ID, status }],
    } });
    expect((await feedback({ experiment_variant_id: VARIANT_CONTROL })).status).toBe(200);
    expect(feedbackWrites()[0].payload).toMatchObject({ experiment_variant_id: null });
  });
  it("no running experiment stores valid feedback without attribution", async () => {
    setup();
    expect((await feedback({ experiment_variant_id: VARIANT_DIVERSE })).body).toEqual({ ok: true });
    expect(feedbackWrites()[0].payload).toMatchObject({ experiment_variant_id: null });
  });
  it.each(["experiments", "experiment_assignments"])("%s lookup failure does not write unattributed analytics", async table => {
    setup({ persona: "student", experiment: true }, {}, { errors: { [table]: failure } });
    expectPrivateFailure(await feedback());
    expect(feedbackWrites()).toHaveLength(0);
  });
  it.each([
    [{ persona: "anonymous" }, 401], [{ persona: "student", onboarded: false }, 403],
  ] as [Scenario, number][])("rejects %p before elevated access", async (scenario, status) => {
    setup(scenario);
    expect((await feedback()).status).toBe(status);
    expect(mockElevated.calls).toHaveLength(0);
  });
  it("rejects a banned user before elevated access", async () => {
    const init = cookieInit({ persona: "student" });
    setup({ persona: "student" }, { tables: { users: init.tables!.users.map(u => ({ ...u, banned_at: "2026-01-01T00:00:00Z" })) } });
    expect((await feedback()).status).toBe(403);
    expect(mockElevated.calls).toHaveLength(0);
  });
});


describe("admin aggregate feedback reads", () => {
  const recent = new Date().toISOString();
  async function analytics() {
    const { GET } = await import("@/app/api/recommendations/analytics/route");
    return read(await GET(new NextRequest("http://localhost/api/recommendations/analytics")));
  }
  async function experimentResults() {
    const { GET } = await import("@/app/api/admin/experiments/[id]/results/route");
    return read(await GET(new NextRequest(`http://localhost/api/admin/experiments/${EXPERIMENT_ID}/results`), { params: Promise.resolve({ id: EXPERIMENT_ID }) }));
  }
  const participants = [
    { user_id: STUDENT.id, event_id: E1, action: "impression", recommendation_rank: 1, experiment_variant_id: VARIANT_CONTROL, created_at: recent },
    { user_id: STUDENT.id, event_id: E1, action: "click", recommendation_rank: 1, experiment_variant_id: VARIANT_CONTROL, created_at: recent },
  ];
  it("analytics includes participants hidden by the cookie client's own-row RLS", async () => {
    setup({ persona: "admin" }, {}, { tables: { recommendation_feedback: participants } });
    const result = await analytics();
    expect(result.status).toBe(200);
    expect(result.body.metrics).toMatchObject({ impressions: 1, clicks: 1, ctr_percent: 100 });
    expect(result.body.diversity).toMatchObject({ unique_tags_shown: 2 });
    expect(mockCookie.calls.filter(c => c.table === "recommendation_feedback")).toHaveLength(0);
  });
  it("experiment results includes participant feedback only for the requested variants", async () => {
    setup({ persona: "admin", experiment: true }, {}, { tables: { recommendation_feedback: [
      ...participants, { ...participants[0], experiment_variant_id: "other-experiment-variant" },
    ] } });
    const result = await experimentResults();
    expect(result.status).toBe(200);
    expect(result.body.variant_metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ variant_id: VARIANT_CONTROL, impressions: 1, clicks: 1, ctr_percent: 100 }),
      expect.objectContaining({ variant_id: VARIANT_DIVERSE, impressions: 0 }),
    ]));
    expect(mockCookie.calls.filter(c => c.table === "recommendation_feedback")).toHaveLength(0);
  });
  it.each(["anonymous", "student"] as const)("%s cannot access aggregate feedback", async persona => {
    for (const run of [analytics, experimentResults]) {
      setup({ persona });
      expect((await run()).status).toBe(persona === "anonymous" ? 401 : 403);
      expect(mockElevated.calls).toHaveLength(0);
    }
  });
  it("analytics tag lookup failures do not report incomplete metrics", async () => {
    setup({ persona: "admin" }, { errors: { events: failure } }, { tables: { recommendation_feedback: participants } });
    expectPrivateFailure(await analytics());
  });
});

describe("assignment insert races", () => {
  it("reuses the persisted winner when another request assigns the user first", async () => {
    setup({ persona: "student", scores: "all", experiment: true }, {}, {
      errors: { "experiment_assignments.insert": { code: "23505", message: "duplicate assignment" } },
    });
    const from = mockElevated.client.from.bind(mockElevated.client);
    let assignmentQueries = 0;
    jest.spyOn(mockElevated.client, "from").mockImplementation(table => {
      if (table === "experiment_assignments" && ++assignmentQueries === 2) {
        mockElevated.tables.experiment_assignments.push({ user_id: STUDENT.id, experiment_id: EXPERIMENT_ID, variant_id: VARIANT_DIVERSE });
      }
      return from(table);
    });
    const result = await recommendations();
    expect(result.status).toBe(200);
    expect(result.body.experiment_variant_id).toBe(VARIANT_DIVERSE);
    expect(result.body.diversity_metadata).toMatchObject({ lambda: 0 });
  });
});
