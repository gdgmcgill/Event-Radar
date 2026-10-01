/**
 * DEFECT characterization — F-017: A/B assignment silently degraded for every
 * non-admin caller (plan 06-02 pinned it; plan 06-04 fixed it, REFAC-14,
 * DEC-68)
 *
 * `experiments` and `experiment_variants` carry only admin policies, and
 * `experiment_assignments` carries admin-ALL plus own-row SELECT (06-RESEARCH
 * § H, measured by probe). GET /api/recommendations read all three on the
 * cookie client, so a non-admin read no running experiment, was never
 * assigned a variant, and nothing was written: the experiment silently
 * measured admins only.
 *
 * Plan 06-04 moved the three reads and the insert to the elevated door
 * (`getElevatedClient()`, REGISTRY.md row "A/B experiment reads and the
 * caller's own variant assignment"). The rows MOVED (INTENTIONAL BEHAVIOUR
 * CHANGE, one defect-ledger row each citing F-017):
 *   D1  was: a non-admin with scores, while an experiment is running, got
 *       `experiment_variant_id: null`, the diversity parameter's λ (0.5) and
 *       no insert. Now: `pickVariant`'s variant ("control", λ 1) and exactly
 *       one experiment_assignments insert, on the elevated client, whose
 *       `user_id` is the caller's own id;
 *   D2  was: a non-admin holding an assignment row was not given it. Now:
 *       that variant ("diverse", λ 0) and no insert.
 *
 * Controls in this file that do not move:
 *   C1  an admin with scores is assigned `pickVariant`'s variant ("diverse",
 *       λ 0), with exactly one insert whose `user_id` is the admin's id;
 *   C2  an admin with an existing assignment is given that variant and no
 *       insert is made.
 *
 * RLS is modelled by what each fake holds (recommendationFixtures.ts): the
 * cookie fake holds the experiment rows only for an admin; the elevated fake
 * holds them for every caller, so the fix flips D1 and D2 without a fixture
 * edit. Values were measured before they were written.
 */

import { NextRequest } from "next/server";
import { pickVariant, type ExperimentVariantInput } from "@/lib/experiments";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  ADMIN,
  EXPERIMENT_ID,
  STUDENT,
  VARIANTS,
  VARIANT_CONTROL,
  VARIANT_DIVERSE,
  cookieInit,
  elevatedInit,
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

async function run(scenario: Scenario, query = "?diversity=0.5") {
  mockCookie = createFakeSupabase(cookieInit(scenario));
  mockElevated = createFakeSupabase(elevatedInit(scenario));
  const GET: RecommendationsGET = (
    await import("@/app/api/recommendations/route")
  ).GET;
  return read(
    await GET(new NextRequest(`http://localhost:3000/api/recommendations${query}`))
  );
}

function assignmentInserts(): FakeCall[] {
  return [...mockCookie.calls, ...mockElevated.calls].filter(
    (c) => c.table === "experiment_assignments" && c.operation === "insert"
  );
}

const variants = VARIANTS as unknown as ExperimentVariantInput[];

describe("fixture sanity: pickVariant's choice for each fixture user", () => {
  it("the student falls in control and the admin in diverse", () => {
    expect(pickVariant(STUDENT.id, EXPERIMENT_ID, variants).id).toBe(
      VARIANT_CONTROL
    );
    expect(pickVariant(ADMIN.id, EXPERIMENT_ID, variants).id).toBe(
      VARIANT_DIVERSE
    );
  });
});

describe("F-017 fixed: a non-admin is assigned a variant through the elevated door", () => {
  it("D1: running experiment, no assignment yet — pickVariant's variant, its λ, one insert carrying the caller's id", async () => {
    const outcome = await run({
      persona: "student",
      scores: "all",
      experiment: true,
    });

    expect(outcome.status).toBe(200);
    expect(outcome.body.source).toBe("personalized");
    expect(outcome.body.experiment_variant_id).toBe(VARIANT_CONTROL);
    expect(reportedLambda(outcome.body)).toBe(1);
    const inserts = assignmentInserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual({
      experiment_id: EXPERIMENT_ID,
      variant_id: VARIANT_CONTROL,
      user_id: STUDENT.id,
    });
    // The insert and all three reads are on the elevated client; none on the cookie client.
    expect(
      mockElevated.calls.filter(
        (c) => c.table === "experiment_assignments" && c.operation === "insert"
      )
    ).toHaveLength(1);
    expect(
      mockCookie.calls.filter((c) =>
        ["experiments", "experiment_variants", "experiment_assignments"].includes(
          c.table
        )
      )
    ).toHaveLength(0);
    expect(
      mockElevated.calls.filter((c) => c.table === "experiments")
    ).toHaveLength(1);
    expect(
      mockElevated.calls.filter((c) => c.table === "experiment_variants")
    ).toHaveLength(1);
  });

  it("D2: an existing own assignment row is honoured — that variant, its λ, zero inserts", async () => {
    const outcome = await run({
      persona: "student",
      scores: "all",
      experiment: true,
      assignedVariant: VARIANT_DIVERSE,
    });

    expect(outcome.status).toBe(200);
    expect(outcome.body.experiment_variant_id).toBe(VARIANT_DIVERSE);
    expect(reportedLambda(outcome.body)).toBe(0);
    expect(assignmentInserts()).toHaveLength(0);
  });
});

describe("controls that do not move: an admin is assigned", () => {
  it("C1: admin with scores is assigned pickVariant's variant with exactly one insert carrying the admin's id", async () => {
    const outcome = await run({
      persona: "admin",
      scores: "all",
      experiment: true,
    });

    expect(outcome.status).toBe(200);
    expect(outcome.body.experiment_variant_id).toBe(VARIANT_DIVERSE);
    expect(reportedLambda(outcome.body)).toBe(0);
    const inserts = assignmentInserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual({
      experiment_id: EXPERIMENT_ID,
      variant_id: VARIANT_DIVERSE,
      user_id: ADMIN.id,
    });
  });

  it("C2: admin with an existing assignment is given that variant and nothing is inserted", async () => {
    const outcome = await run({
      persona: "admin",
      scores: "all",
      experiment: true,
      assignedVariant: VARIANT_CONTROL,
    });

    expect(outcome.status).toBe(200);
    expect(outcome.body.experiment_variant_id).toBe(VARIANT_CONTROL);
    expect(reportedLambda(outcome.body)).toBe(1);
    expect(assignmentInserts()).toHaveLength(0);
  });
});
