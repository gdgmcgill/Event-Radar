/**
 * The slice-6 contracts, input by input (plan 06-04, REFAC-15, DEC-65).
 *
 * Every expected 400 body below is COPIED from the 06-02 suites that pin the
 * handlers (recommendations-family, notifications, interactions-feedback and
 * the F-094 malformed-input suite), not re-derived: a contract is correct
 * only if it answers the same first 400 the handler's own ladder answered, in
 * the same order. Valid inputs are asserted to parse to the values the
 * handler used before (top_k, diversity and the other silently coerced query
 * values keep today's parse-with-default semantics and never become a 400).
 */

import { z } from "zod";
import { parseQuery, parseWith } from "@/server/body";
import {
  AnalyticsQuery,
  FeedbackEventIdsQuery,
  RecommendationFeedbackBody,
  RecommendationsQuery,
} from "@/contracts/recommendations";
import { InteractionBody } from "@/contracts/interactions";
import {
  NotificationsListQuery,
  NotificationsQuery,
} from "@/contracts/notifications";
import { FeedbackBody } from "@/contracts/feedback";

const E1 = "06000000-0000-4000-8000-0000000001e1";
const OTHER = "06000000-0000-4000-8000-0000000000ff";

async function firstError(schema: z.ZodType, input: unknown) {
  const result = parseWith(schema, input);
  if (result.ok) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    status: result.response.status,
    body: await result.response.json(),
  };
}

function query(schema: z.ZodType, qs: string) {
  const result = parseQuery(new URLSearchParams(qs), schema);
  if (!result.ok) throw new Error(`unexpected 400 for ?${qs}`);
  return result.data;
}

// ─── recommendations/feedback POST (recommendations-family SHAPE_400S) ─────

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

describe("RecommendationFeedbackBody", () => {
  it.each<[string, unknown, unknown]>([
    ["thumbs: feedback 'meh'", { event_id: E1, feedback: "meh" }, BAD_THUMBS],
    ["thumbs: invalid feedback AND no event_id", { feedback: "meh" }, BAD_THUMBS],
    ["thumbs: valid feedback, no event_id", { feedback: "positive" }, NO_EVENT],
    ["thumbs: empty event_id", { event_id: "", feedback: "negative" }, NO_EVENT],
    ["analytics: empty body", {}, MISSING],
    ["analytics: no event_id", { recommendation_rank: 1, action: "click" }, MISSING],
    ["analytics: no rank", { event_id: E1, action: "click" }, MISSING],
    ["analytics: null rank", { event_id: E1, recommendation_rank: null, action: "click" }, MISSING],
    ["analytics: no action", { event_id: E1, recommendation_rank: 1 }, MISSING],
    ["analytics: missing event_id AND invalid action", { recommendation_rank: 1, action: "like" }, MISSING],
    ["analytics: invalid action", { event_id: E1, recommendation_rank: 1, action: "like" }, BAD_ACTION],
    ["analytics: invalid action AND rank 0", { event_id: E1, recommendation_rank: 0, action: "like" }, BAD_ACTION],
    ["analytics: rank 0", { event_id: E1, recommendation_rank: 0, action: "click" }, BAD_RANK],
    ["analytics: rank -3", { event_id: E1, recommendation_rank: -3, action: "click" }, BAD_RANK],
    ["non-string feedback falls through to analytics", { event_id: E1, feedback: 1 }, MISSING],
    // slice6-malformed-input-defect.test.ts, the number row (unchanged bytes)
    ["action sent as a number", { event_id: E1, recommendation_rank: 1, action: 5 }, BAD_ACTION],
    // F-094: a non-string event id is refused with the presence text, not a 500
    ["thumbs: numeric event_id", { event_id: 5, feedback: "positive" }, NO_EVENT],
    ["analytics: numeric event_id", { event_id: 5, recommendation_rank: 1, action: "click" }, MISSING],
  ])("%s → 400", async (_label, input, expected) => {
    expect(await firstError(RecommendationFeedbackBody, input)).toEqual({
      ok: false,
      status: 400,
      body: expected,
    });
  });

  it("thumbs parses without any user id (DI-44)", async () => {
    expect(
      await firstError(RecommendationFeedbackBody, {
        event_id: E1,
        feedback: "positive",
        user_id: OTHER,
      })
    ).toEqual({
      ok: true,
      data: { kind: "thumbs", feedback: "positive", event_id: E1 },
    });
  });

  it("analytics parses the handler's fields and drops a body user id (DI-44)", async () => {
    const outcome = await firstError(RecommendationFeedbackBody, {
      event_id: E1,
      recommendation_rank: 2,
      action: "click",
      user_id: OTHER,
      session_id: "s-1",
    });
    expect(outcome).toEqual({
      ok: true,
      data: {
        kind: "analytics",
        event_id: E1,
        recommendation_rank: 2,
        action: "click",
        session_id: "s-1",
      },
    });
    expect(outcome.ok && "user_id" in (outcome.data as object)).toBe(false);
  });

  it("keeps today's rank comparison: a numeric string below 1 is refused", async () => {
    expect(
      await firstError(RecommendationFeedbackBody, {
        event_id: E1,
        recommendation_rank: "0",
        action: "save",
      })
    ).toEqual({ ok: false, status: 400, body: BAD_RANK });
  });
});

// ─── recommendations GET query ─────────────────────────────────────────────

describe("RecommendationsQuery (bounded, never a 400)", () => {
  it.each<[string, { top_k: number; diversity: number }]>([
    ["", { top_k: 10, diversity: 0.7 }],
    ["top_k=2", { top_k: 2, diversity: 0.7 }],
    ["top_k=", { top_k: 10, diversity: 0.7 }],
    ["top_k=5abc", { top_k: 5, diversity: 0.7 }],
    ["diversity=0", { top_k: 10, diversity: 0 }],
    ["diversity=1", { top_k: 10, diversity: 1 }],
    ["diversity=5", { top_k: 10, diversity: 5 }],
    ["diversity=-1", { top_k: 10, diversity: -1 }],
    ["diversity=", { top_k: 10, diversity: 0.7 }],
  ])("?%s → today's values", (qs, expected) => {
    expect(query(RecommendationsQuery, qs)).toEqual(expected);
  });

  it("a non-numeric top_k defaults to 10; diversity retains its NaN fallback", () => {
    const parsed = query(RecommendationsQuery, "top_k=abc&diversity=abc") as {
      top_k: number;
      diversity: number;
    };
    expect(parsed.top_k).toBe(10);
    expect(Number.isNaN(parsed.diversity)).toBe(true);
  });
});

describe("FeedbackEventIdsQuery (never a 400)", () => {
  it.each<[string, string[]]>([
    ["", []],
    ["event_ids=", []],
    [`event_ids=${E1}`, [E1]],
    [`event_ids=${E1},%20${OTHER},,`, [E1, OTHER]],
  ])("?%s → today's id list", (qs, expected) => {
    expect(query(FeedbackEventIdsQuery, qs)).toEqual({ event_ids: expected });
  });
});

describe("AnalyticsQuery", () => {
  it.each([
    ["", "7d"],
    ["period=", "7d"],
    ["period=7d", "7d"],
    ["period=30d", "30d"],
  ])("?%s → period %s", (qs, period) => {
    expect(query(AnalyticsQuery, qs)).toEqual({ period });
  });

  it("period=90d → 400 Invalid period. Use 7d or 30d", async () => {
    expect(await firstError(AnalyticsQuery, { period: "90d" })).toEqual({
      ok: false,
      status: 400,
      body: { error: "Invalid period. Use 7d or 30d" },
    });
  });
});

// ─── interactions POST (interactions-feedback INTERACTION_400S) ────────────

const REQUIRED = { error: "event_id and interaction_type are required" };
const BAD_TYPE = {
  error:
    "Invalid interaction_type. Must be one of: view, click, save, unsave, share, calendar_add",
};
const BAD_SOURCE = {
  error:
    "Invalid source. Must be one of: home, search, recommendation, calendar, direct, modal, my-events",
};

describe("InteractionBody", () => {
  it.each<[string, unknown, unknown]>([
    ["empty object", {}, REQUIRED],
    ["no event_id", { interaction_type: "view" }, REQUIRED],
    ["empty event_id", { event_id: "", interaction_type: "view" }, REQUIRED],
    ["no interaction_type", { event_id: E1 }, REQUIRED],
    ["empty interaction_type", { event_id: E1, interaction_type: "" }, REQUIRED],
    ["no event_id AND invalid type", { interaction_type: "poke" }, REQUIRED],
    ["invalid interaction_type", { event_id: E1, interaction_type: "poke" }, BAD_TYPE],
    ["case variant", { event_id: E1, interaction_type: "VIEW" }, BAD_TYPE],
    ["invalid type AND invalid source", { event_id: E1, interaction_type: "poke", source: "nowhere" }, BAD_TYPE],
    ["invalid source", { event_id: E1, interaction_type: "view", source: "nowhere" }, BAD_SOURCE],
    ["interaction_type sent as a number", { event_id: E1, interaction_type: 5 }, BAD_TYPE],
    ["numeric event_id (F-094)", { event_id: 5, interaction_type: "view" }, REQUIRED],
  ])("%s → 400", async (_label, input, expected) => {
    expect(await firstError(InteractionBody, input)).toEqual({
      ok: false,
      status: 400,
      body: expected,
    });
  });

  it("valid input parses to the fields the handler writes; an empty source passes", async () => {
    expect(
      await firstError(InteractionBody, {
        event_id: E1,
        interaction_type: "calendar_add",
        source: "recommendation",
        session_id: "sess-1",
        metadata: { rank: 2 },
      })
    ).toEqual({
      ok: true,
      data: {
        event_id: E1,
        interaction_type: "calendar_add",
        source: "recommendation",
        session_id: "sess-1",
        metadata: { rank: 2 },
      },
    });
    const empty = await firstError(InteractionBody, {
      event_id: E1,
      interaction_type: "share",
      source: "",
    });
    expect(empty.ok).toBe(true);
  });
});

// ─── feedback POST (interactions-feedback FEEDBACK_400S) ───────────────────

const NO_MESSAGE = { error: "Message is required" };
const BAD_FEEDBACK_TYPE = { error: "Invalid feedback type" };

describe("FeedbackBody", () => {
  it.each<[string, unknown, unknown]>([
    ["empty object", {}, NO_MESSAGE],
    ["empty message", { message: "" }, NO_MESSAGE],
    ["whitespace message", { message: "   \n " }, NO_MESSAGE],
    ["no message AND invalid type", { type: "rant" }, NO_MESSAGE],
    ["invalid type", { message: "hello", type: "rant" }, BAD_FEEDBACK_TYPE],
    ["type case variant", { message: "hello", type: "Bug" }, BAD_FEEDBACK_TYPE],
    ["message sent as a number", { message: 5 }, NO_MESSAGE],
    ["subject sent as a number (F-094)", { message: "hi", subject: 5 }, { error: "Subject must be a string" }],
  ])("%s → 400", async (_label, input, expected) => {
    expect(await firstError(FeedbackBody, input)).toEqual({
      ok: false,
      status: 400,
      body: expected,
    });
  });

  it.each<[string, unknown]>([
    ["message only", { message: "  hello  " }],
    ["an empty type and a whitespace subject", { type: "", subject: "   ", message: "ok" }],
    ["every field", { type: "bug", subject: "  Crash ", message: "It broke" }],
    ["a null subject", { subject: null, message: "ok" }],
  ])("%s parses with the values as sent", async (_label, input) => {
    expect(await firstError(FeedbackBody, input)).toEqual({
      ok: true,
      data: input,
    });
  });
});

// ─── notifications ─────────────────────────────────────────────────────────

describe("NotificationsQuery (POST action)", () => {
  it.each(["", "action=delete-all", "action=", "action=MARK-ALL-READ"])(
    "?%s → 400 Invalid action",
    async (qs) => {
      const result = parseQuery(new URLSearchParams(qs), NotificationsQuery);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: "Invalid action" });
    }
  );

  it("?action=mark-all-read parses", () => {
    expect(query(NotificationsQuery, "action=mark-all-read")).toEqual({
      action: "mark-all-read",
    });
  });
});

describe("NotificationsListQuery (never a 400)", () => {
  it.each<[string, unknown]>([
    ["", {}],
    ["cursor=", { cursor: "" }],
    ["cursor=2026-09-01T10%3A00%3A00.000Z", { cursor: "2026-09-01T10:00:00.000Z" }],
  ])("?%s → today's cursor", (qs, expected) => {
    expect(query(NotificationsListQuery, qs)).toEqual(expected);
  });
});
