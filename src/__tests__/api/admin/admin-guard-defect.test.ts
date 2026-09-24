/**
 * DEFECT characterization — F-061, F-001 (and DI-48)
 *
 * Status: OPEN — rows move in 05-13 and 05-14. 05-13 adds the 33 helper arms
 * to `FIXED_ARMS` as each file adopts `requireRole(ctx, "admin")` (DEC-44);
 * 05-14 adds the two calculate-popularity arms (DEC-44, F-001). The banned
 * admin rows move through their own set, `BAN_GUARDED_ARMS`, when an arm
 * composes `requireActiveUser(ctx)` ahead of the role check (DI-48's owner
 * note); they are kept apart so that the F-061 swap does not have to decide
 * DI-48 in the same commit.
 *
 * What is pinned, measured first (the measurement is in
 * `evidence/slice-5-characterization.txt`):
 *
 *   D1  F-061, 30 arms: an anonymous caller gets `403 {"error":"Forbidden"}`
 *       today where the contract says 401. Fixed: `401 {"error":"Unauthorized"}`.
 *       Neither shape writes. The three arms that answer an anonymous caller
 *       401 already are pinned in `admin-guard-characterization.test.ts`
 *       and carry no D1 row.
 *   D2  F-061, 1 arm (`recommendations/batch` POST): an authenticated
 *       non-admin gets `401 {"error":"Unauthorized"}` today where the contract
 *       says 403. Fixed: `403 {"error":"Forbidden"}`, no rpc. Research § B
 *       also names `admin/clubs` GET and `admin/organizer-requests` GET; the
 *       measurement shows both already answer a non-admin 403 Forbidden (an
 *       explicit `!user` branch precedes the role check), so they have no D2
 *       row and their 403 is pinned in `admin-guard-characterization.test.ts`.
 *   D3  F-001, calculate-popularity POST and GET with `ADMIN_API_KEY` unset
 *       (the production condition, F-040): an anonymous caller and an
 *       authenticated non-admin both get 200 today. POST reaches the
 *       `update_event_popularity` rpc on the elevated client once per approved
 *       event; GET reads `event_popularity_scores` on the elevated client.
 *       Fixed: anonymous 401 `{"error":"Unauthorized"}`, non-admin 403
 *       `{"error":"Forbidden"}`, and the elevated client is never touched.
 *       The admin's admission stays green in
 *       `admin-guard-characterization.test.ts` (P3).
 *   D4  DI-48, all 35 arms: an admin whose `banned_at` is set with no expiry
 *       is admitted today (neither 401 nor 403), because the helper reads
 *       `roles` only. Fixed: `403 {"error":"Account suspended"}` with no
 *       write, the active-user guard's bytes.
 *
 * Flipping a row: in the commit that fixes an arm, add its id to the set,
 * after showing the today-shape goes red against the fix unedited (the
 * `evidence/defect-ledger.md` protocol). `admin-guard-characterization.test.ts`
 * and `adminArmTable.ts` are never edited to make a row move.
 *
 * Seams as in `admin-guard-characterization.test.ts`: `@/lib/supabase/server`
 * is the cookie fake A, `@/lib/supabase/service` and `@supabase/supabase-js` are the
 * elevated fake B.
 */

import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  ADMIN_ARMS,
  PERSONAS,
  elevatedInit,
  runArm,
  writeCalls,
  type PersonaName,
} from "./adminArmTable";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => mockElevated.client,
}));

// ─── The ledger sets ───────────────────────────────────────────────────────

/** Arms whose F-061 / F-001 rows have moved to the fixed shape. */
const FIXED_ARMS: ReadonlySet<string> = new Set<string>([]);

/** Arms whose DI-48 banned-admin row has moved to the fixed shape. */
const BAN_GUARDED_ARMS: ReadonlySet<string> = new Set<string>([]);

// ─── Environment and fakes ─────────────────────────────────────────────────

const ENV_KEYS = [
  "ADMIN_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

beforeEach(() => {
  delete process.env.ADMIN_API_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function as(persona: PersonaName): void {
  mockCookie = createFakeSupabase(PERSONAS[persona]());
  mockElevated = createFakeSupabase(elevatedInit());
}

function allWrites(): string[] {
  return [...writeCalls(mockCookie.calls), ...writeCalls(mockElevated.calls)].map(
    (call) => `${call.table}.${call.operation}`
  );
}

function elevatedShape(): string[] {
  return mockElevated.calls.map((call) => `${call.table}.${call.operation}`);
}

const rows = <T extends { id: string }>(arms: readonly T[]) =>
  arms.map((arm) => [arm.id, arm] as const);

// ─── D1: F-061, the anonymous 403 ──────────────────────────────────────────

const D1_ARMS = ADMIN_ARMS.filter((arm) => !arm.anonymous401 && !arm.machineKey);

describe("D1 (F-061): an anonymous caller at a helper arm", () => {
  it("covers 30 arms", () => {
    expect(D1_ARMS).toHaveLength(30);
  });

  it.each(rows(D1_ARMS))("%s", async (armId, arm) => {
    as("anonymous");
    const outcome = await runArm(arm);
    if (FIXED_ARMS.has(armId)) {
      expect(outcome).toEqual({ status: 401, body: { error: "Unauthorized" } });
    } else {
      expect(outcome).toEqual({ status: 403, body: { error: "Forbidden" } });
    }
    expect(allWrites()).toEqual([]);
  });
});

// ─── D2: F-061, the non-admin 401 ──────────────────────────────────────────

const D2_ARMS = ADMIN_ARMS.filter((arm) => arm.student401);

describe("D2 (F-061): an authenticated non-admin where the arm answers 401", () => {
  it("covers exactly recommendations/batch POST", () => {
    expect(D2_ARMS.map((arm) => arm.id)).toEqual(["recommendations/batch POST"]);
  });

  it.each(rows(D2_ARMS))("%s", async (armId, arm) => {
    as("student");
    const outcome = await runArm(arm);
    if (FIXED_ARMS.has(armId)) {
      expect(outcome).toEqual({ status: 403, body: { error: "Forbidden" } });
    } else {
      expect(outcome).toEqual({ status: 401, body: { error: "Unauthorized" } });
    }
    expect(allWrites()).toEqual([]);
  });
});

// ─── D3: F-001, calculate-popularity's open door ───────────────────────────

const D3_ARMS = ADMIN_ARMS.filter((arm) => arm.machineKey);

/** What each verb does on the elevated client once it is past the (absent) gate. */
const TODAY_ELEVATED: Record<string, string[]> = {
  "admin/calculate-popularity POST": ["events.select", "update_event_popularity.rpc"],
  "admin/calculate-popularity GET": [
    "event_popularity_scores.select",
    "events.select",
  ],
};

describe("D3 (F-001): calculate-popularity with ADMIN_API_KEY unset", () => {
  it("covers both verbs", () => {
    expect(D3_ARMS.map((arm) => arm.id).sort()).toEqual([
      "admin/calculate-popularity GET",
      "admin/calculate-popularity POST",
    ]);
  });

  const cases: Array<[string, PersonaName, number, string]> = [];
  for (const arm of D3_ARMS) {
    cases.push([arm.id, "anonymous", 401, "Unauthorized"]);
    cases.push([arm.id, "student", 403, "Forbidden"]);
  }

  it.each(cases)(
    "%s as %s",
    async (armId, persona, fixedStatus, fixedError) => {
      const arm = D3_ARMS.find((candidate) => candidate.id === armId);
      if (!arm) throw new Error(`no arm ${armId}`);
      as(persona);
      const outcome = await runArm(arm);
      if (FIXED_ARMS.has(armId)) {
        expect(outcome).toEqual({ status: fixedStatus, body: { error: fixedError } });
        expect(elevatedShape()).toEqual([]);
        expect(allWrites()).toEqual([]);
      } else {
        expect(outcome.status).toBe(200);
        expect(elevatedShape()).toEqual(TODAY_ELEVATED[armId]);
        if (armId.endsWith("POST")) {
          expect(outcome.body).toMatchObject({
            success: true,
            message: "Processed 1 events",
            results: { total: 1, success: 1, failed: 0 },
          });
          const rpc = mockElevated.calls.find((call) => call.operation === "rpc");
          expect(rpc?.table).toBe("update_event_popularity");
          expect(rpc?.payload).toEqual({ p_event_id: expect.any(String) });
        } else {
          expect(outcome.body).toMatchObject({
            total_events: 1,
            events_with_scores: 1,
          });
        }
        // The anonymous or non-admin caller never touched the cookie client.
        expect(mockCookie.calls).toEqual([]);
      }
    }
  );
});

// ─── D4: DI-48, the banned admin ───────────────────────────────────────────

describe("D4 (DI-48): an admin whose ban is in force", () => {
  it.each(rows(ADMIN_ARMS))("%s", async (armId, arm) => {
    as("bannedAdmin");
    const outcome = await runArm(arm);
    if (BAN_GUARDED_ARMS.has(armId)) {
      expect(outcome).toEqual({
        status: 403,
        body: { error: "Account suspended" },
      });
      expect(allWrites()).toEqual([]);
    } else {
      expect(outcome.status).not.toBe(401);
      expect(outcome.status).not.toBe(403);
    }
  });
});
