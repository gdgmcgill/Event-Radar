/**
 * DEFECT characterization — F-059: the batch-scoring 500 carried the rpc
 * error's text in `details` (moved out of PRESERVE by plan 06-14, REFAC-20)
 *
 * Moved out of `recommendations-family-characterization.test.ts` (PRESERVE,
 * plan 06-02), whose row "admin, rpc error → 500 with the error message in
 * details (today's bytes)" pinned `{ error: "Batch scoring failed",
 * details: <the rpc error's message> }`. 06-14 puts the route on `withRoute`
 * and the logger and stops returning a caught error's text (F-059, DEC-75):
 * the 500 keeps its status and its `error` text, and `details` is gone. The
 * error is logged instead (`log.error("Batch scoring error", { error })`).
 * The PRESERVE file keeps every other row, unedited; this row's move has a
 * defect-ledger row.
 *
 * What is pinned:
 *   - B1 admin, the compute_user_scores rpc errors: 500
 *     `{ "error": "Batch scoring failed" }`, the rpc's text nowhere in the
 *     body, `private, no-store` and a UUID `x-request-id`; the rpc ran once,
 *     on the elevated client.
 *
 * Seams and fixtures are the PRESERVE file's (`recommendationFixtures.ts`).
 */

import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import { cookieInit, elevatedInit, read } from "./recommendationFixtures";

type BatchPOST = (typeof import("@/app/api/recommendations/batch/route"))["POST"];

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("B1 (F-059 fixed): the batch-scoring 500 carries no rpc error text", () => {
  it("admin, rpc error → 500 Batch scoring failed, no details", async () => {
    mockCookie = createFakeSupabase(cookieInit({ persona: "admin", onboarded: true }));
    mockElevated = createFakeSupabase({
      ...elevatedInit({ persona: "admin" }),
      rpc: {
        compute_user_scores: {
          data: null,
          error: { code: "XX000", message: "scoring exploded" },
        },
      },
    });
    const POST: BatchPOST = (await import("@/app/api/recommendations/batch/route")).POST;
    const response = await POST();
    const cacheControl = response.headers.get("Cache-Control");
    const requestId = response.headers.get("x-request-id");
    const outcome = await read(response);
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual({ error: "Batch scoring failed" });
    expect(JSON.stringify(outcome.body)).not.toContain("scoring exploded");
    expect(cacheControl).toBe("private, no-store");
    expect(requestId).toMatch(UUID);
    expect(
      mockElevated.calls.filter((c) => c.operation === "rpc").map((c) => c.table)
    ).toEqual(["compute_user_scores"]);
  });
});
