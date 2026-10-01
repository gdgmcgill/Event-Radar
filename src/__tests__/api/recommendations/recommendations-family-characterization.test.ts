/**
 * PRESERVE characterization — the recommendations family: batch POST,
 * analytics GET and feedback GET/POST (plan 06-02, REFAC-14, REFAC-15)
 *
 * Written against the UNMODIFIED routes at plan 06-02's base commit, before
 * 06-04 puts zod contracts on their inputs. This file must pass UNEDITED
 * after that: the contracts must reproduce every 400 body byte for byte and
 * in today's check order (CONTEXT Area 2, C10, Pitfall 6). Pinned:
 *
 *   batch POST      anonymous 401 Unauthorized, non-admin 403 Forbidden, both
 *                   with no rpc on either client; admin 200 with the
 *                   compute_user_scores rpc on the elevated client (the rpc
 *                   error row moved to batch-error-text-defect.test.ts in
 *                   06-14, F-059);
 *   analytics GET   anonymous 401, non-admin 403; admin `period=90d` 400
 *                   "Invalid period. Use 7d or 30d"; admin 7d 200 with the
 *                   metrics computed from the fixture rows;
 *   feedback POST   anonymous 401 with this arm's own text (DEC-34), a
 *                   not-onboarded caller 403 "Onboarding required", and every
 *                   shape-400 in the order the handler checks it today:
 *                   thumbs (invalid feedback before missing event_id), then
 *                   analytics (missing fields before invalid action before
 *                   rank < 1). A non-string `feedback` falls through to the
 *                   analytics branch;
 *                   a body naming another user's id does not change whose
 *                   feedback is written (DI-44: the body `user_id` fallback is
 *                   unreachable after the anonymous 401), on both branches;
 *   feedback GET    anonymous 401; no event_ids answers `{ feedback: {} }`;
 *                   the caller's own thumbs only.
 *
 * The thumbs branch upserts; the fake has no `upsert`, so the thumbs rows use
 * the fixture's `withUpsertAsInsert` wrapper (recorded as an insert). The
 * shared fake is unchanged.
 *
 * Seams: `@/lib/supabase/server` returns the cookie fake;
 * `@/lib/supabase/service` returns the elevated fake.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import {
  E1,
  E2,
  E3,
  OTHER_USER_ID,
  STUDENT,
  cookieInit,
  elevatedInit,
  read,
  withUpsertAsInsert,
  type Persona,
} from "./recommendationFixtures";

type BatchPOST = (typeof import("@/app/api/recommendations/batch/route"))["POST"];
type AnalyticsGET =
  (typeof import("@/app/api/recommendations/analytics/route"))["GET"];
type FeedbackPOST =
  (typeof import("@/app/api/recommendations/feedback/route"))["POST"];
type FeedbackGET =
  (typeof import("@/app/api/recommendations/feedback/route"))["GET"];

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
let cookieClient: FakeSupabase["client"];

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(cookieClient),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const BASE = "http://localhost:3000/api/recommendations";

function as(
  persona: Persona,
  extra: Partial<FakeSupabaseInit> = {},
  onboarded = true
): void {
  const init = cookieInit({ persona, onboarded });
  mockCookie = createFakeSupabase({
    ...init,
    ...extra,
    tables: { ...init.tables, ...(extra.tables ?? {}) },
  });
  cookieClient = withUpsertAsInsert(
    mockCookie.client,
    "recommendation_explicit_feedback"
  );
  const elevated = elevatedInit({ persona });
  mockElevated = createFakeSupabase({
    ...elevated, errors: extra.errors,
    tables: { ...elevated.tables, recommendation_feedback: extra.tables?.recommendation_feedback ?? [] },
  });
}

function writes(fake: FakeSupabase): FakeCall[] {
  return fake.calls.filter((c) =>
    ["insert", "update", "delete", "rpc"].includes(c.operation)
  );
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ─── batch POST ────────────────────────────────────────────────────────────

describe("recommendations/batch POST", () => {
  async function batch() {
    const POST: BatchPOST = (
      await import("@/app/api/recommendations/batch/route")
    ).POST;
    return read(await POST());
  }

  it.each([
    ["anonymous", 401, "Unauthorized"],
    ["student", 403, "Forbidden"],
  ] as const)("%s → %i %s, no rpc on either client", async (persona, status, error) => {
    as(persona);
    const outcome = await batch();
    expect(outcome.status).toBe(status);
    expect(outcome.body).toEqual({ error });
    expect([...writes(mockCookie), ...writes(mockElevated)]).toHaveLength(0);
  });

  it("admin → 200 and compute_user_scores on the elevated client only", async () => {
    as("admin");
    const outcome = await batch();
    expect(outcome.status).toBe(200);
    expect(outcome.body.success).toBe(true);
    expect(outcome.body.message).toBe("Batch scoring completed");
    expect(typeof outcome.body.timestamp).toBe("string");
    expect(writes(mockCookie)).toHaveLength(0);
    expect(writes(mockElevated).map((c) => c.table)).toEqual([
      "compute_user_scores",
    ]);
  });
});

// ─── analytics GET ─────────────────────────────────────────────────────────

describe("recommendations/analytics GET", () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const FEEDBACK_ROWS: FakeRow[] = [
    { action: "impression", event_id: E1, recommendation_rank: 1, created_at: recent },
    { action: "impression", event_id: E1, recommendation_rank: 2, created_at: recent },
    { action: "impression", event_id: E3, recommendation_rank: 3, created_at: recent },
    { action: "impression", event_id: E3, recommendation_rank: 4, created_at: recent },
    { action: "click", event_id: E1, recommendation_rank: 1, created_at: recent },
    { action: "click", event_id: E3, recommendation_rank: 3, created_at: recent },
    { action: "save", event_id: E1, recommendation_rank: 1, created_at: recent },
    { action: "dismiss", event_id: E3, recommendation_rank: 4, created_at: recent },
    // outside every window
    { action: "impression", event_id: E2, recommendation_rank: 1, created_at: "2020-01-01T00:00:00+00:00" },
  ];

  async function analytics(query: string) {
    const GET: AnalyticsGET = (
      await import("@/app/api/recommendations/analytics/route")
    ).GET;
    return read(await GET(new NextRequest(`${BASE}/analytics${query}`)));
  }

  it.each([
    ["anonymous", 401, "Unauthorized"],
    ["student", 403, "Forbidden"],
  ] as const)("%s → %i %s", async (persona, status, error) => {
    as(persona);
    const outcome = await analytics("?period=7d");
    expect(outcome.status).toBe(status);
    expect(outcome.body).toEqual({ error });
  });

  it("admin, period=90d → 400 Invalid period. Use 7d or 30d", async () => {
    as("admin");
    const outcome = await analytics("?period=90d");
    expect(outcome.status).toBe(400);
    expect(outcome.body).toEqual({ error: "Invalid period. Use 7d or 30d" });
  });

  it("admin, period absent → 7d metrics from the fixture rows", async () => {
    as("admin", { tables: { recommendation_feedback: FEEDBACK_ROWS } });
    const outcome = await analytics("");
    expect(outcome.status).toBe(200);
    expect(outcome.body.period).toBe("7d");
    expect(outcome.body.metrics).toEqual({
      impressions: 4,
      clicks: 2,
      saves: 1,
      dismisses: 1,
      ctr_percent: 50,
      save_rate_percent: 25,
      dismiss_rate_percent: 25,
      avg_rank_of_clicked: 2,
    });
    expect(outcome.body.diversity).toEqual({
      recommended_tag_distribution: { academic: 1, tech: 1, sports: 1 },
      unique_tags_shown: 3,
    });
  });
});

// ─── feedback POST ─────────────────────────────────────────────────────────

describe("recommendations/feedback POST: guards", () => {
  async function feedback(body: unknown) {
    const POST: FeedbackPOST = (
      await import("@/app/api/recommendations/feedback/route")
    ).POST;
    return read(await POST(post("/feedback", body)));
  }

  it("anonymous → 401 with this arm's own text (DEC-34), no write", async () => {
    as("anonymous");
    const outcome = await feedback({ event_id: E1, feedback: "positive" });
    expect(outcome.status).toBe(401);
    expect(outcome.body).toEqual({
      error: "Unauthorized. Must be logged in to submit feedback.",
    });
    expect(writes(mockCookie)).toHaveLength(0);
  });

  it("signed in, not onboarded → 403 Onboarding required, no write", async () => {
    as("student", {}, false);
    const outcome = await feedback({ event_id: E1, feedback: "positive" });
    expect(outcome.status).toBe(403);
    expect(outcome.body).toEqual({ error: "Onboarding required" });
    expect(writes(mockCookie)).toHaveLength(0);
  });
});

const MISSING = {
  error: "Missing required fields: event_id, recommendation_rank, action",
};
const BAD_ACTION = {
  error: "Invalid action. Must be one of: impression, click, save, dismiss",
};
const BAD_RANK = { error: "recommendation_rank must be >= 1" };
const BAD_THUMBS = {
  error: "Invalid feedback. Must be 'positive' or 'negative'",
};
const NO_EVENT = { error: "Missing event_id" };

const SHAPE_400S: Array<[string, unknown, unknown]> = [
  ["thumbs: feedback 'meh'", { event_id: E1, feedback: "meh" }, BAD_THUMBS],
  ["thumbs: invalid feedback AND no event_id → the feedback check first", { feedback: "meh" }, BAD_THUMBS],
  ["thumbs: valid feedback, no event_id", { feedback: "positive" }, NO_EVENT],
  ["thumbs: valid feedback, empty event_id", { event_id: "", feedback: "negative" }, NO_EVENT],
  ["analytics: empty body", {}, MISSING],
  ["analytics: no event_id", { recommendation_rank: 1, action: "click" }, MISSING],
  ["analytics: no recommendation_rank", { event_id: E1, action: "click" }, MISSING],
  ["analytics: null recommendation_rank", { event_id: E1, recommendation_rank: null, action: "click" }, MISSING],
  ["analytics: no action", { event_id: E1, recommendation_rank: 1 }, MISSING],
  ["analytics: missing event_id AND invalid action → missing first", { recommendation_rank: 1, action: "like" }, MISSING],
  ["analytics: invalid action", { event_id: E1, recommendation_rank: 1, action: "like" }, BAD_ACTION],
  ["analytics: invalid action AND rank 0 → action first", { event_id: E1, recommendation_rank: 0, action: "like" }, BAD_ACTION],
  ["analytics: rank 0", { event_id: E1, recommendation_rank: 0, action: "click" }, BAD_RANK],
  ["analytics: rank -3", { event_id: E1, recommendation_rank: -3, action: "click" }, BAD_RANK],
  ["non-string feedback falls through to the analytics branch", { event_id: E1, feedback: 1 }, MISSING],
];

describe("recommendations/feedback POST: shape-400s in today's order", () => {
  it.each(SHAPE_400S)("%s", async (_label, body, expected) => {
    as("student");
    const POST: FeedbackPOST = (
      await import("@/app/api/recommendations/feedback/route")
    ).POST;
    const outcome = await read(await POST(post("/feedback", body)));
    expect(outcome.status).toBe(400);
    expect(outcome.body).toEqual(expected);
    expect(writes(mockCookie)).toHaveLength(0);
  });
});

describe("recommendations/feedback POST: success and whose feedback is written (DI-44)", () => {
  async function feedback(body: unknown) {
    const POST: FeedbackPOST = (
      await import("@/app/api/recommendations/feedback/route")
    ).POST;
    return read(await POST(post("/feedback", body)));
  }

  it("thumbs with another user's id in the body → 200 {ok, feedback}; the row is the caller's", async () => {
    as("student");
    const outcome = await feedback({
      event_id: E1,
      feedback: "positive",
      user_id: OTHER_USER_ID,
    });
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ ok: true, feedback: "positive" });
    const [write] = writes(mockCookie);
    expect(write.table).toBe("recommendation_explicit_feedback");
    expect(write.payload).toEqual({
      user_id: STUDENT.id,
      event_id: E1,
      feedback_type: "positive",
    });
  });

  it("analytics with another user's id in the body → 200 {ok}; the row is the caller's", async () => {
    as("student");
    const outcome = await feedback({
      event_id: E1,
      recommendation_rank: 2,
      action: "click",
      user_id: OTHER_USER_ID,
      session_id: "s-1",
    });
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ ok: true });
    const [write] = writes(mockElevated);
    expect(writes(mockCookie)).toHaveLength(0);
    expect(write.table).toBe("recommendation_feedback");
    expect(write.payload).toEqual({
      user_id: STUDENT.id,
      event_id: E1,
      recommendation_rank: 2,
      action: "click",
      session_id: "s-1",
      experiment_variant_id: null,
    });
  });

  it("analytics insert error → 500 Failed to store feedback", async () => {
    as("student", {
      errors: {
        "recommendation_feedback.insert": { code: "42501", message: "denied" },
      },
    });
    const outcome = await feedback({
      event_id: E1,
      recommendation_rank: 1,
      action: "impression",
    });
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual({ error: "Failed to store feedback" });
  });
});

// ─── feedback GET ──────────────────────────────────────────────────────────

describe("recommendations/feedback GET", () => {
  async function thumbs(query: string) {
    const GET: FeedbackGET = (
      await import("@/app/api/recommendations/feedback/route")
    ).GET;
    return read(await GET(new NextRequest(`${BASE}/feedback${query}`)));
  }

  const EXPLICIT: FakeRow[] = [
    { user_id: STUDENT.id, event_id: E1, feedback_type: "positive" },
    { user_id: STUDENT.id, event_id: E2, feedback_type: "negative" },
    { user_id: STUDENT.id, event_id: E3, feedback_type: "meh" },
    { user_id: OTHER_USER_ID, event_id: E3, feedback_type: "positive" },
  ];

  it("anonymous → 401 Unauthorized", async () => {
    as("anonymous");
    const outcome = await thumbs(`?event_ids=${E1}`);
    expect(outcome.status).toBe(401);
    expect(outcome.body).toEqual({ error: "Unauthorized" });
  });

  it("no event_ids → 200 { feedback: {} } without a read", async () => {
    as("student", { tables: { recommendation_explicit_feedback: EXPLICIT } });
    const outcome = await thumbs("");
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ feedback: {} });
    expect(
      mockCookie.calls.filter((c) => c.table === "recommendation_explicit_feedback")
    ).toHaveLength(0);
  });

  it("the caller's own valid thumbs only; invalid types and other users' rows dropped", async () => {
    as("student", { tables: { recommendation_explicit_feedback: EXPLICIT } });
    const outcome = await thumbs(`?event_ids=${E1}, ${E2},${E3},`);
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({
      feedback: { [E1]: "positive", [E2]: "negative" },
    });
  });
});
