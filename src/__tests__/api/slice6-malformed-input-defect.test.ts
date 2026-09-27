/**
 * DEFECT characterization — F-094: the slice-6 raw-parse sites had no input
 * schema (plan 06-02 pinned it; plan 06-04 fixed it, REFAC-15, DEC-65)
 *
 * Three slice-6 handlers read their body with a raw `await request.json()`
 * and checked it with their own `if` ladder:
 *   - `src/app/api/interactions/route.ts` POST
 *   - `src/app/api/feedback/route.ts` POST
 *   - `src/app/api/recommendations/feedback/route.ts` POST
 *
 * Plan 06-04 put a contract at each boundary (`parseBody` with
 * `InteractionBody`, `FeedbackBody`, `RecommendationFeedbackBody`). The rows
 * MOVED to the fixed shape (INTENTIONAL BEHAVIOUR CHANGE, one defect-ledger
 * row each, citing F-094):
 *   not-json   was the route's generic 500; now 400 `Invalid JSON body`;
 *   array      was the route's first "missing field" 400; now 400
 *              `Request body must be a JSON object`;
 *   null       was a 500 at all three sites (the handlers dereferenced it);
 *              now 400 `Request body must be a JSON object`;
 *   subject    feedback's `subject` sent as a number threw on `.trim()` and
 *              answered 500; now 400 `Subject must be a string`.
 * The three `number` rows did NOT move: each contract carries today's text
 * for a wrongly typed required field (a list or presence 400), so their
 * bytes are unchanged.
 *
 * The pre-fix values (the "old" column of each ledger row) were measured with
 * a temporary harness at 06-02; that run is in `slice-6-characterization.txt`.
 * All rows use a signed-in, onboarded caller, which every site admits, so the
 * body is always read.
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

const INVALID_JSON = { error: "Invalid JSON body" };
const NOT_OBJECT = { error: "Request body must be a JSON object" };

const MATRIX: Array<[Site, string, string, number, unknown]> = [
  ["interactions", "not-json", NOT_JSON, 400, INVALID_JSON],
  ["interactions", "array", ARRAY, 400, NOT_OBJECT],
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
  ["feedback", "not-json", NOT_JSON, 400, INVALID_JSON],
  ["feedback", "array", ARRAY, 400, NOT_OBJECT],
  [
    "feedback",
    "number (message: 5)",
    JSON.stringify({ message: 5 }),
    400,
    { error: "Message is required" },
  ],
  ["recommendations/feedback", "not-json", NOT_JSON, 400, INVALID_JSON],
  ["recommendations/feedback", "array", ARRAY, 400, NOT_OBJECT],
  [
    "recommendations/feedback",
    "number (action: 5)",
    JSON.stringify({ event_id: EVENT_ID, recommendation_rank: 1, action: 5 }),
    400,
    { error: "Invalid action. Must be one of: impression, click, save, dismiss" },
  ],
];

describe("F-094 fixed: malformed bodies at the three slice-6 sites answer 400", () => {
  it("the matrix is three sites by three inputs", () => {
    expect(MATRIX).toHaveLength(9);
    expect(new Set(MATRIX.map(([site]) => site)).size).toBe(3);
  });

  it.each(MATRIX)("%s, %s → the contract's status and body", async (site, _label, raw, status, body) => {
    const response = await call(site, raw);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(writes()).toBe(0);
  });
});

describe("F-094 fixed: beyond the matrix, same defect", () => {
  it.each([
    ["interactions"],
    ["feedback"],
    ["recommendations/feedback"],
  ] as const)("%s, a JSON null body → 400 Request body must be a JSON object", async (site) => {
    const response = await call(site, "null");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(NOT_OBJECT);
    expect(writes()).toBe(0);
  });

  it("feedback, subject sent as a number → 400 Subject must be a string", async () => {
    const response = await call("feedback", JSON.stringify({ message: "hi", subject: 5 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Subject must be a string" });
    expect(writes()).toBe(0);
  });
});
