/**
 * PRESERVE characterization — POST /api/interactions and POST /api/feedback
 * (plan 06-02, REFAC-15)
 *
 * Written against the UNMODIFIED routes at plan 06-02's base commit, before
 * 06-04 replaces their raw body reads with contracts. This file must pass
 * UNEDITED after that: every shape-400 keeps its exact body and today's
 * check order (CONTEXT Area 2, C10, Pitfall 6). Pinned:
 *
 *   interactions  anonymous tracking accepted (DEC-34): 201 with
 *                 `user_id: null` written; a signed-in caller's row carries
 *                 their id; a signed-in caller who has not onboarded is
 *                 refused 403 before the body is read. 400s, in order:
 *                 presence of event_id and interaction_type (one message for
 *                 both), then the interaction_type list, then the source
 *                 list (checked only when source is truthy). A missing or
 *                 soft-deleted event answers 404 `Event not found`;
 *   feedback      anonymous accepted (DEC-34) with `user_id` and
 *                 `user_email` null; a signed-in caller's row carries both.
 *                 400s, in order: `Message is required` (absent, empty or
 *                 whitespace), then `Invalid feedback type` (checked only
 *                 when type is truthy). Type defaults to "general"; subject
 *                 and message are trimmed; an empty subject is stored null.
 *
 * Not pinned here: malformed bodies (not JSON, a JSON array, a number where
 * a string is required), which F-094 moves; they are in
 * `slice6-malformed-input-defect.test.ts`.
 *
 * Seam: `@/lib/supabase/server` returns the cookie fake. Values were
 * measured before they were written.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeRow,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

type InteractionsPOST = (typeof import("@/app/api/interactions/route"))["POST"];
type FeedbackPOST = (typeof import("@/app/api/feedback/route"))["POST"];

let mockCookie: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Fixture ───────────────────────────────────────────────────────────────

const CALLER = {
  id: "06000000-0000-4000-8000-000000000031",
  email: "slice6.tracker@mail.mcgill.ca",
};
const EVENT_ID = "06000000-0000-4000-8000-0000000003e1";
const DELETED_EVENT_ID = "06000000-0000-4000-8000-0000000003e2";
const MISSING_EVENT_ID = "06000000-0000-4000-8000-0000000003e3";

const EVENTS: FakeRow[] = [
  { id: EVENT_ID, title: "Tracked", status: "approved", deleted_at: null },
  {
    id: DELETED_EVENT_ID,
    title: "Gone",
    status: "approved",
    deleted_at: "2026-09-01T00:00:00+00:00",
  },
];

function init(persona: "anonymous" | "student" | "unonboarded"): FakeSupabaseInit {
  return {
    user: persona === "anonymous" ? null : CALLER,
    now: "2026-09-25T12:00:00.000Z",
    tables: {
      users:
        persona === "anonymous"
          ? []
          : [
              {
                id: CALLER.id,
                email: CALLER.email,
                roles: ["user"],
                onboarding_completed: persona === "student",
                banned_at: null,
                ban_expires_at: null,
              },
            ],
      events: EVENTS,
      user_interactions: [],
      feedback: [],
    },
  };
}

function writes(): FakeCall[] {
  return mockCookie.calls.filter((c) =>
    ["insert", "update", "delete"].includes(c.operation)
  );
}

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function interact(persona: Parameters<typeof init>[0], body: unknown) {
  mockCookie = createFakeSupabase(init(persona));
  const POST: InteractionsPOST = (await import("@/app/api/interactions/route")).POST;
  const response = await POST(jsonRequest("interactions", body));
  return { status: response.status, body: await response.json() };
}

async function feedback(persona: Parameters<typeof init>[0], body: unknown) {
  mockCookie = createFakeSupabase(init(persona));
  const POST: FeedbackPOST = (await import("@/app/api/feedback/route")).POST;
  const response = await POST(jsonRequest("feedback", body));
  return { status: response.status, body: await response.json() };
}

// ─── interactions ──────────────────────────────────────────────────────────

const REQUIRED = { error: "event_id and interaction_type are required" };
const BAD_TYPE = {
  error:
    "Invalid interaction_type. Must be one of: view, click, save, unsave, share, calendar_add",
};
const BAD_SOURCE = {
  error:
    "Invalid source. Must be one of: home, search, recommendation, calendar, direct, modal, my-events",
};

const INTERACTION_400S: Array<[string, unknown, unknown]> = [
  ["empty object", {}, REQUIRED],
  ["no event_id", { interaction_type: "view" }, REQUIRED],
  ["empty event_id", { event_id: "", interaction_type: "view" }, REQUIRED],
  ["no interaction_type", { event_id: EVENT_ID }, REQUIRED],
  ["empty interaction_type", { event_id: EVENT_ID, interaction_type: "" }, REQUIRED],
  ["no event_id AND invalid type → required first", { interaction_type: "poke" }, REQUIRED],
  ["invalid interaction_type", { event_id: EVENT_ID, interaction_type: "poke" }, BAD_TYPE],
  ["interaction_type case variant", { event_id: EVENT_ID, interaction_type: "VIEW" }, BAD_TYPE],
  [
    "invalid type AND invalid source → type first",
    { event_id: EVENT_ID, interaction_type: "poke", source: "nowhere" },
    BAD_TYPE,
  ],
  ["invalid source", { event_id: EVENT_ID, interaction_type: "view", source: "nowhere" }, BAD_SOURCE],
];

describe("POST /api/interactions: shape-400s in today's order", () => {
  it.each(INTERACTION_400S)("%s", async (_label, body, expected) => {
    const outcome = await interact("student", body);
    expect(outcome).toEqual({ status: 400, body: expected });
    expect(writes()).toHaveLength(0);
  });

  it("the 400s are the same for an anonymous caller", async () => {
    expect(await interact("anonymous", {})).toEqual({ status: 400, body: REQUIRED });
    expect(
      await interact("anonymous", { event_id: EVENT_ID, interaction_type: "poke" })
    ).toEqual({ status: 400, body: BAD_TYPE });
  });
});

describe("POST /api/interactions: guards, lookup and success", () => {
  it("signed in, not onboarded → 403 Onboarding required before the body is validated", async () => {
    expect(await interact("unonboarded", {})).toEqual({
      status: 403,
      body: { error: "Onboarding required" },
    });
  });

  it.each([
    ["a missing event", MISSING_EVENT_ID],
    ["a soft-deleted event", DELETED_EVENT_ID],
  ])("%s → 404 Event not found, no write", async (_label, eventId) => {
    expect(
      await interact("student", { event_id: eventId, interaction_type: "view" })
    ).toEqual({ status: 404, body: { error: "Event not found" } });
    expect(writes()).toHaveLength(0);
  });

  it("anonymous → 201 and a row with user_id null (DEC-34)", async () => {
    const outcome = await interact("anonymous", {
      event_id: EVENT_ID,
      interaction_type: "view",
    });
    expect(outcome.status).toBe(201);
    expect(outcome.body).toEqual({
      success: true,
      interaction_id: "fake-user_interactions-1",
      recorded_at: "2026-09-25T12:00:00.000Z",
    });
    expect(writes()[0].payload).toEqual({
      user_id: null,
      event_id: EVENT_ID,
      interaction_type: "view",
      source: null,
      session_id: null,
      metadata: {},
    });
  });

  it("signed in, every optional field, empty source allowed → 201 and the caller's id", async () => {
    const outcome = await interact("student", {
      event_id: EVENT_ID,
      interaction_type: "calendar_add",
      source: "recommendation",
      session_id: "sess-1",
      metadata: { rank: 2 },
    });
    expect(outcome.status).toBe(201);
    expect(writes()[0].payload).toEqual({
      user_id: CALLER.id,
      event_id: EVENT_ID,
      interaction_type: "calendar_add",
      source: "recommendation",
      session_id: "sess-1",
      metadata: { rank: 2 },
    });

    const emptySource = await interact("student", {
      event_id: EVENT_ID,
      interaction_type: "share",
      source: "",
    });
    expect(emptySource.status).toBe(201);
    expect((writes()[0].payload as { source: unknown }).source).toBeNull();
  });
});

// ─── feedback ──────────────────────────────────────────────────────────────

const NO_MESSAGE = { error: "Message is required" };
const BAD_FEEDBACK_TYPE = { error: "Invalid feedback type" };

const FEEDBACK_400S: Array<[string, unknown, unknown]> = [
  ["empty object", {}, NO_MESSAGE],
  ["empty message", { message: "" }, NO_MESSAGE],
  ["whitespace message", { message: "   \n " }, NO_MESSAGE],
  ["no message AND invalid type → message first", { type: "rant" }, NO_MESSAGE],
  ["invalid type", { message: "hello", type: "rant" }, BAD_FEEDBACK_TYPE],
  ["type case variant", { message: "hello", type: "Bug" }, BAD_FEEDBACK_TYPE],
];

describe("POST /api/feedback: shape-400s in today's order", () => {
  it.each(FEEDBACK_400S)("%s", async (_label, body, expected) => {
    expect(await feedback("student", body)).toEqual({ status: 400, body: expected });
    expect(writes()).toHaveLength(0);
  });

  it("the 400s are the same for an anonymous caller", async () => {
    expect(await feedback("anonymous", {})).toEqual({ status: 400, body: NO_MESSAGE });
  });
});

describe("POST /api/feedback: guards and success", () => {
  it("signed in, not onboarded → 403 Onboarding required", async () => {
    expect(await feedback("unonboarded", { message: "hello" })).toEqual({
      status: 403,
      body: { error: "Onboarding required" },
    });
  });

  it("anonymous → 200 { success: true }, user_id and user_email null, type defaulted", async () => {
    expect(await feedback("anonymous", { message: "  hello  " })).toEqual({
      status: 200,
      body: { success: true },
    });
    expect(writes()[0].table).toBe("feedback");
    expect(writes()[0].payload).toEqual({
      type: "general",
      subject: null,
      message: "hello",
      user_id: null,
      user_email: null,
    });
  });

  it("signed in → 200 and the row carries the caller's id and email; subject trimmed", async () => {
    expect(
      await feedback("student", { type: "bug", subject: "  Crash ", message: "It broke" })
    ).toEqual({ status: 200, body: { success: true } });
    expect(writes()[0].payload).toEqual({
      type: "bug",
      subject: "Crash",
      message: "It broke",
      user_id: CALLER.id,
      user_email: CALLER.email,
    });
  });

  it("an empty type is defaulted, a whitespace subject is stored null", async () => {
    expect(
      await feedback("student", { type: "", subject: "   ", message: "ok" })
    ).toEqual({ status: 200, body: { success: true } });
    expect(writes()[0].payload).toMatchObject({ type: "general", subject: null });
  });

  it("an insert error → 500 Failed to save feedback", async () => {
    mockCookie = createFakeSupabase({
      ...init("student"),
      errors: { "feedback.insert": { code: "42501", message: "denied" } },
    });
    const POST: FeedbackPOST = (await import("@/app/api/feedback/route")).POST;
    const response = await POST(jsonRequest("feedback", { message: "hello" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to save feedback" });
  });
});
