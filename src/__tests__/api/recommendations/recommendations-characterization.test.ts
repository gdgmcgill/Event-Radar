/**
 * PRESERVE characterization — GET /api/recommendations, input to ranked output
 * (plan 06-02, REFAC-14)
 *
 * Written against the UNMODIFIED route at plan 06-02's base commit, before
 * slice 6 moves the experiment reads to the elevated door (F-017, 06-04),
 * puts a contract on the query (06-04) and wraps the handler (06-12). This
 * file must pass UNEDITED after all three. It pins, for each input fixture:
 *
 *   - the status, the ordered event ids and `source` ("anonymous",
 *     "popular_fallback" or "personalized");
 *   - the λ the response reports in `diversity_metadata.lambda` (null on the
 *     two popularity paths, which report no diversity metadata);
 *   - `total_events`, and the pool the scored path draws from
 *     (`limit(top_k * 3)` on user_event_scores, filtered after the read);
 *   - the header the route already sends on every 200:
 *     `Cache-Control: private, no-store`.
 *
 * The rules the table exercises: λ = experiment λ ?? clamp(diversity ?? 0.7)
 * to [0, 1], a non-numeric diversity falling back to 0.7; MMR re-ranks the
 * whole pool and `top_k` truncates after it; a two-hour session interaction
 * boosts a matching event by 0.05 per shared tag; pending and past events in
 * user_event_scores are dropped. The weights (0.35/0.25/0.20/0.15/0.05) live
 * in SQL (`compute_user_scores`) and are pinned by pgTAP, not here.
 *
 * F-041 is a known limitation pinned here as today's behaviour: a signed-in
 * caller with no usable user_event_scores rows gets the popularity ordering
 * with `source: "popular_fallback"`. CONTEXT Area 1 keeps it; its cause is
 * recorded for Phase 8's operational drill.
 *
 * The admin row with a running experiment pins that a variant's λ overrides
 * the diversity parameter. It survives F-017's fix: the elevated fake holds
 * the same experiment, and `pickVariant` is deterministic. The non-admin half
 * of F-017 is in `experiment-assignment-defect.test.ts`.
 *
 * Every value was measured with a temporary harness before it was written;
 * the run is in the phase evidence `slice-6-characterization.txt`.
 *
 * Seams: `@/lib/supabase/server` returns the cookie fake;
 * `@/lib/supabase/service` returns the elevated fake.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  E1,
  E2,
  E3,
  E4,
  E5,
  POPULARITY_ORDER,
  VARIANT_DIVERSE,
  cookieInit,
  elevatedInit,
  rankedIds,
  read,
  reportedLambda,
  type Scenario,
} from "./recommendationFixtures";

type RecommendationsGET =
  (typeof import("@/app/api/recommendations/route"))["GET"];

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

async function loadGET(): Promise<RecommendationsGET> {
  return (await import("@/app/api/recommendations/route")).GET;
}

function setup(scenario: Scenario): void {
  mockCookie = createFakeSupabase(cookieInit(scenario));
  mockElevated = createFakeSupabase(elevatedInit(scenario));
}

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/recommendations${query}`);
}

/** The limit the scored path put on its user_event_scores read, if it read. */
function scorePoolLimit(): number | null {
  const call = [...mockCookie.calls, ...mockElevated.calls].find(
    (c) => c.table === "user_event_scores" && c.operation === "select"
  );
  return call ? call.limit : null;
}

// ─── The table ─────────────────────────────────────────────────────────────

interface Row {
  label: string;
  scenario: Scenario;
  query: string;
  ids: string[];
  source: "anonymous" | "popular_fallback" | "personalized";
  lambda: number | null;
  variant: string | null | undefined;
  pool: number | null;
}

const ROWS: Row[] = [
  {
    label: "anonymous: popularity by start_date, no scores read",
    scenario: { persona: "anonymous" },
    query: "",
    ids: POPULARITY_ORDER,
    source: "anonymous",
    lambda: null,
    variant: undefined,
    pool: null,
  },
  {
    label: "anonymous top_k=2: the first two by start_date",
    scenario: { persona: "anonymous" },
    query: "?top_k=2",
    ids: POPULARITY_ORDER.slice(0, 2),
    source: "anonymous",
    lambda: null,
    variant: undefined,
    pool: null,
  },
  {
    label: "signed in, zero score rows: popular_fallback (F-041, today's behaviour)",
    scenario: { persona: "student", scores: "none" },
    query: "",
    ids: POPULARITY_ORDER,
    source: "popular_fallback",
    lambda: null,
    variant: undefined,
    pool: 30,
  },
  {
    label: "signed in, only pending and past score rows: popular_fallback",
    scenario: { persona: "student", scores: "hidden-only" },
    query: "",
    ids: POPULARITY_ORDER,
    source: "popular_fallback",
    lambda: null,
    variant: undefined,
    pool: 30,
  },
  {
    label: "scores, diversity absent: λ 0.7, MMR puts E3 ahead of E2",
    scenario: { persona: "student", scores: "all" },
    query: "",
    ids: [E1, E3, E2, E4, E5],
    source: "personalized",
    lambda: 0.7,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, diversity=0: λ 0, pure novelty after the first pick",
    scenario: { persona: "student", scores: "all" },
    query: "?diversity=0",
    ids: [E1, E3, E4, E5, E2],
    source: "personalized",
    lambda: 0,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, diversity=1: λ 1, raw score order",
    scenario: { persona: "student", scores: "all" },
    query: "?diversity=1",
    ids: [E1, E2, E3, E4, E5],
    source: "personalized",
    lambda: 1,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, diversity=5: clamped to λ 1",
    scenario: { persona: "student", scores: "all" },
    query: "?diversity=5",
    ids: [E1, E2, E3, E4, E5],
    source: "personalized",
    lambda: 1,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, diversity=-1: clamped to λ 0",
    scenario: { persona: "student", scores: "all" },
    query: "?diversity=-1",
    ids: [E1, E3, E4, E5, E2],
    source: "personalized",
    lambda: 0,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, diversity=abc: not a number, λ 0.7",
    scenario: { persona: "student", scores: "all" },
    query: "?diversity=abc",
    ids: [E1, E3, E2, E4, E5],
    source: "personalized",
    lambda: 0.7,
    variant: null,
    pool: 30,
  },
  {
    label: "scores, top_k=2: pool of 6 (pending and past take two), truncated after MMR",
    scenario: { persona: "student", scores: "all" },
    query: "?top_k=2",
    ids: [E1, E3],
    source: "personalized",
    lambda: 0.7,
    variant: null,
    pool: 6,
  },
  {
    label: "scores and a session interaction with E4: E4 boosted 0.1, ranked third",
    scenario: { persona: "student", scores: "all", sessionEvent: E4 },
    query: "",
    ids: [E1, E3, E4, E2, E5],
    source: "personalized",
    lambda: 0.7,
    variant: null,
    pool: 30,
  },
  {
    label: "admin, running experiment: the variant's λ 0 overrides diversity=1",
    scenario: { persona: "admin", scores: "all", experiment: true },
    query: "?diversity=1",
    ids: [E1, E3, E4, E5, E2],
    source: "personalized",
    lambda: 0,
    variant: VARIANT_DIVERSE,
    pool: 30,
  },
];

describe("GET /api/recommendations: input fixture to ranked output", () => {
  it("the table has at least eight rows", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(ROWS.map((row) => [row.label, row] as const))(
    "%s",
    async (_label, row) => {
      setup(row.scenario);
      const GET = await loadGET();
      const outcome = await read(await GET(request(row.query)));

      expect(outcome.status).toBe(200);
      expect(rankedIds(outcome.body)).toEqual(row.ids);
      expect(outcome.body.source).toBe(row.source);
      expect(reportedLambda(outcome.body)).toBe(row.lambda);
      expect(outcome.body.experiment_variant_id).toBe(row.variant);
      expect(outcome.body.total_events).toBe(row.ids.length);
      expect(outcome.headers.get("Cache-Control")).toBe("private, no-store");
      expect(scorePoolLimit()).toBe(row.pool);
    }
  );
});

describe("GET /api/recommendations: response shapes", () => {
  it("the popularity paths answer exactly recommendations, source, total_events with a zero-score trending item", async () => {
    setup({ persona: "anonymous" });
    const GET = await loadGET();
    const { body } = await read(await GET(request("?top_k=1")));

    expect(Object.keys(body)).toEqual(["recommendations", "source", "total_events"]);
    const [item] = body.recommendations as Array<Record<string, unknown>>;
    expect(Object.keys(item)).toEqual([
      "event_id",
      "score",
      "explanation",
      "breakdown",
      "event",
    ]);
    expect(item.score).toBe(0);
    expect(item.explanation).toBe("Trending on campus");
    expect(item.breakdown).toEqual({
      tag: 0,
      interaction: 0,
      popularity: 1,
      recency: 0,
      social: 0,
    });
    expect((item.event as { id: string }).id).toBe(POPULARITY_ORDER[0]);
  });

  it("the scored path answers recommendations, source, diversity_metadata, experiment_variant_id, total_events with boosted scores", async () => {
    setup({ persona: "student", scores: "all", sessionEvent: E4 });
    const GET = await loadGET();
    const { body } = await read(await GET(request()));

    expect(Object.keys(body)).toEqual([
      "recommendations",
      "source",
      "diversity_metadata",
      "experiment_variant_id",
      "total_events",
    ]);
    expect(Object.keys(body.diversity_metadata as object)).toEqual([
      "avg_pairwise_distance",
      "lambda",
    ]);
    const recs = body.recommendations as Array<{
      event_id: string;
      score: number;
      explanation: string;
    }>;
    expect(recs.map((r) => r.score)).toEqual([0.9, 0.8, 0.7, 0.85, 0.5]);
    expect(recs[0].explanation).toBe("Because you're interested in academic");
  });

  it("a thrown read answers 500 with the generic body", async () => {
    mockCookie = createFakeSupabase({
      ...cookieInit({ persona: "student", scores: "all" }),
      throwOn: { users: "boom" },
    });
    mockElevated = createFakeSupabase(elevatedInit({ persona: "student" }));
    const GET = await loadGET();
    const outcome = await read(await GET(request()));

    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual({ error: "Failed to fetch recommendations" });
  });
});
