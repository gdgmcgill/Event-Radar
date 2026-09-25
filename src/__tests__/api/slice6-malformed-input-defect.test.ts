/**
 * DEFECT characterization — F-094: the slice-6 raw-parse sites have no input
 * schema (plan 06-02, REFAC-15)
 *
 * Three slice-6 handlers read their body with a raw `await request.json()`
 * and check it with their own `if` ladder:
 *   - `src/app/api/interactions/route.ts` POST
 *   - `src/app/api/feedback/route.ts` POST
 *   - `src/app/api/recommendations/feedback/route.ts` POST
 *
 * The matrix pins, for each site, today's status and body for three
 * malformed inputs (3 × 3 = 9 rows):
 *   not-json   a body that is not JSON: the parse throws inside the `try`,
 *              and the catch answers a JSON 500 with the route's generic text;
 *   array      a JSON array: accepted as if it were an object with no keys,
 *              so it answers the route's first "missing field" 400;
 *   number     a required string field sent as a number (interactions'
 *              `interaction_type`, feedback's `message`, recommendations
 *              feedback's `action`): each answers a list or presence 400.
 *
 * Beyond the matrix, measured at the same time and pinned because they are
 * the same defect: a JSON `null` body answers 500 at all three sites (the
 * handlers dereference it), and feedback's optional `subject` sent as a
 * number throws on `.trim()` and answers 500.
 *
 * DEC-65 fixes these at the contract boundary (06-04): an invalid body
 * answers 400 `Invalid JSON body`, a non-object body 400
 * `Request body must be a JSON object`, and a non-string field a 400 rather
 * than a 500. Each moved byte is an INTENTIONAL BEHAVIOUR CHANGE with a
 * defect-ledger row citing F-094. Rows whose bytes the contract reproduces
 * (the number rows keep today's texts if the schema carries them) are
 * expected not to move; the ledger records which did.
 *
 * Every value was measured with a temporary harness first; the run is in the
 * phase evidence `slice-6-characterization.txt`. All rows use a signed-in,
 * onboarded caller, which every site admits, so the body is always read.
 *
 * Seam: `@/lib/supabase/server` returns the cookie fake.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../helpers/fakeSupabase";

type InteractionsPOST = (typeof import("@/app/api/interactions/route"))["POST"];
type FeedbackPOST = (typeof import("@/app/api/feedback/route"))["POST"];
type RecommendationFeedbackPOST =
  (typeof import("@/app/api/recommendations/feedback/route"))["POST"];

let mockCookie: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockCookie = createFakeSupabase({
    user: CALLER,
    tables: {
      users: [
        {
          id: CALLER.id,
          email: CALLER.email,
          roles: ["user"],
          onboarding_completed: true,
          banned_at: null,
          ban_expires_at: null,
        },
      ],
      events: [{ id: EVENT_ID, status: "approved", deleted_at: null }],
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const CALLER = {
  id: "06000000-0000-4000-8000-000000000041",
  email: "slice6.malformed@mail.mcgill.ca",
};
const EVENT_ID = "06000000-0000-4000-8000-0000000004e1";

type Site = "interactions" | "feedback" | "recommendations/feedback";

async function call(site: Site, raw: string): Promise<Response> {
  const request = new NextRequest(`http://localhost:3000/api/${site}`, {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json" },
  });
  if (site === "interactions") {
    const POST: InteractionsPOST = (await import("@/app/api/interactions/route")).POST;
    return POST(request);
  }
  if (site === "feedback") {
    const POST: FeedbackPOST = (await import("@/app/api/feedback/route")).POST;
    return POST(request);
  }
  const POST: RecommendationFeedbackPOST = (
    await import("@/app/api/recommendations/feedback/route")
  ).POST;
  return POST(request);
}

function writes(): number {
  return mockCookie.calls.filter((c) =>
    ["insert", "update", "delete"].includes(c.operation)
  ).length;
}

const NOT_JSON = "{not json";
const ARRAY = "[]";

const MATRIX: Array<[Site, string, string, number, unknown]> = [
  ["interactions", "not-json", NOT_JSON, 500, { error: "Internal server error" }],
  ["interactions", "array", ARRAY, 400, { error: "event_id and interaction_type are required" }],
  [
    "interactions",
    "number (interaction_type: 5)",
    JSON.stringify({ event_id: EVENT_ID, interaction_type: 5 }),
    400,
    {
      error:
        "Invalid interaction_type. Must be one of: view, click, save, unsave, share, calendar_add",
    },
  ],
  ["feedback", "not-json", NOT_JSON, 500, { error: "Internal server error" }],
  ["feedback", "array", ARRAY, 400, { error: "Message is required" }],
  [
    "feedback",
    "number (message: 5)",
    JSON.stringify({ message: 5 }),
    400,
    { error: "Message is required" },
  ],
  ["recommendations/feedback", "not-json", NOT_JSON, 500, { error: "Failed to submit feedback" }],
  [
    "recommendations/feedback",
    "array",
    ARRAY,
    400,
    { error: "Missing required fields: event_id, recommendation_rank, action" },
  ],
  [
    "recommendations/feedback",
    "number (action: 5)",
    JSON.stringify({ event_id: EVENT_ID, recommendation_rank: 1, action: 5 }),
    400,
    { error: "Invalid action. Must be one of: impression, click, save, dismiss" },
  ],
];

describe("DEFECT F-094: malformed bodies at the three slice-6 raw-parse sites", () => {
  it("the matrix is three sites by three inputs", () => {
    expect(MATRIX).toHaveLength(9);
    expect(new Set(MATRIX.map(([site]) => site)).size).toBe(3);
  });

  it.each(MATRIX)("%s, %s → today's status and body", async (site, _label, raw, status, body) => {
    const response = await call(site, raw);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(writes()).toBe(0);
  });
});

describe("DEFECT F-094: beyond the matrix, same defect", () => {
  it.each([
    ["interactions", { error: "Internal server error" }],
    ["feedback", { error: "Internal server error" }],
    ["recommendations/feedback", { error: "Failed to submit feedback" }],
  ] as const)("%s, a JSON null body → 500", async (site, body) => {
    const response = await call(site, "null");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(body);
    expect(writes()).toBe(0);
  });

  it("feedback, subject sent as a number → 500 (subject.trim throws)", async () => {
    const response = await call("feedback", JSON.stringify({ message: "hi", subject: 5 }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(writes()).toBe(0);
  });
});
