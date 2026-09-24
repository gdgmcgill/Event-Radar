/**
 * PRESERVE characterization — admin guard at every admin arm (REFAC-13)
 *
 * Written against the UNMODIFIED admin routes at plan 05-12's base commit
 * (4e368b6), before 05-13 replaces the admin-verify helper with
 * `requireRole(ctx, "admin")` and 05-14 closes calculate-popularity. This file
 * must pass UNEDITED after both. It pins only what survives them:
 *
 *   P0  the table equals the tree: `ADMIN_ARMS` holds exactly the exported
 *       verbs under `src/app/api/admin/**` plus `recommendations/analytics`
 *       GET and `recommendations/batch` POST (35 arms), and the three flag
 *       sets are exactly the measured ones;
 *   P1  an authenticated non-admin (onboarded, roles ["user"]) gets exactly
 *       `403 {"error":"Forbidden"}` at the 32 arms that answer it today, and
 *       neither client records an insert, update, delete or rpc. The two arms
 *       excluded are `recommendations/batch` POST (401 today, which F-061
 *       moves to 403) and the two calculate-popularity arms (200 today, which
 *       F-001 moves to 403). `admin/clubs` GET and `admin/organizer-requests`
 *       GET are INCLUDED: research § B lists them as 401 to non-admins, but
 *       the measurement shows 403 `{"error":"Forbidden"}`, which is already
 *       the contract (`endpoints.json` onboarded_student 403);
 *   P2  an anonymous caller gets exactly `401 {"error":"Unauthorized"}` at the
 *       three arms that answer it today (`admin/clubs` GET,
 *       `admin/organizer-requests` GET, `recommendations/batch` POST), with no
 *       write on either client;
 *   P3  an admin (roles ["user","admin"]) is admitted at all 35 arms: the
 *       outcome is neither 401 nor 403. What the handler does next (200, 201,
 *       a 400 or 409 on the fixture, a throw on a fake gap such as `upsert`
 *       or `contains`) is not pinned; only that the gate let the admin in.
 *
 * Every value was measured first with a temporary harness that was never
 * committed; the measurement is in
 * `.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-5-characterization.txt`.
 * The anonymous 403s at the other 30 helper arms, the non-admin 401 at
 * `recommendations/batch`, calculate-popularity's open door (F-001) and the
 * banned admin's admission (DI-48) are pinned in the sibling file
 * `admin-guard-defect.test.ts`, where they are expected to move.
 *
 * Seams: `@/lib/supabase/server` returns the cookie fake A;
 * `@/lib/supabase/service` and `@supabase/supabase-js` (calculate-popularity's
 * inline client) return the elevated fake B. `ADMIN_API_KEY` is unset, which
 * is the production condition (F-040).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";
import {
  ADMIN_ARMS,
  PERSONAS,
  elevatedInit,
  refusedWith,
  runArm,
  writeCalls,
  type AdminArm,
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

function noWrites(): string[] {
  return [...writeCalls(mockCookie.calls), ...writeCalls(mockElevated.calls)].map(
    (call) => `${call.table}.${call.operation}`
  );
}

// ─── P0: the table equals the tree ─────────────────────────────────────────

const API_DIR = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(dir, entry.name))
      : entry.name === "route.ts"
        ? [join(dir, entry.name)]
        : []
  );
}

function treeArms(): string[] {
  const files = [
    ...routeFiles(join(API_DIR, "admin")),
    join(API_DIR, "recommendations", "analytics", "route.ts"),
    join(API_DIR, "recommendations", "batch", "route.ts"),
  ];
  const ids: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const route = relative(API_DIR, file).split("\\").join("/").replace(/\/route\.ts$/, "");
    for (const match of source.matchAll(
      /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g
    )) {
      ids.push(`${route} ${match[1]}`);
    }
  }
  return ids.sort();
}

const ids = (arms: readonly AdminArm[]) => arms.map((arm) => arm.id).sort();

describe("P0: the admin arm table equals the tree", () => {
  it("holds exactly the exported verbs of the admin family (35 arms)", () => {
    expect(ids(ADMIN_ARMS)).toEqual(treeArms());
    expect(ADMIN_ARMS).toHaveLength(35);
    expect(new Set(ids(ADMIN_ARMS)).size).toBe(ADMIN_ARMS.length);
  });

  it("flags exactly the measured arms", () => {
    expect(ids(ADMIN_ARMS.filter((arm) => arm.anonymous401))).toEqual([
      "admin/clubs GET",
      "admin/organizer-requests GET",
      "recommendations/batch POST",
    ]);
    expect(ids(ADMIN_ARMS.filter((arm) => arm.student401))).toEqual([
      "recommendations/batch POST",
    ]);
    expect(ids(ADMIN_ARMS.filter((arm) => arm.machineKey))).toEqual([
      "admin/calculate-popularity GET",
      "admin/calculate-popularity POST",
    ]);
  });
});

// ─── P1: the authenticated non-admin's 403 ─────────────────────────────────

const STUDENT_403_ARMS = ADMIN_ARMS.filter(
  (arm) => !arm.student401 && !arm.machineKey
);

describe("P1: an authenticated non-admin gets 403 Forbidden and nothing is written", () => {
  it("covers 32 arms", () => {
    expect(STUDENT_403_ARMS).toHaveLength(32);
  });

  it.each(STUDENT_403_ARMS.map((arm) => [arm.id, arm] as const))(
    "%s",
    async (_id, arm) => {
      as("student");
      const outcome = await runArm(arm);
      expect(outcome).toEqual({ status: 403, body: { error: "Forbidden" } });
      expect(refusedWith(outcome, 403, "Forbidden")).toBe(true);
      expect(noWrites()).toEqual([]);
    }
  );
});

// ─── P2: the anonymous 401 where it is already the contract ────────────────

const ANONYMOUS_401_ARMS = ADMIN_ARMS.filter((arm) => arm.anonymous401);

describe("P2: an anonymous caller gets 401 Unauthorized at the three arms that answer it today", () => {
  it.each(ANONYMOUS_401_ARMS.map((arm) => [arm.id, arm] as const))(
    "%s",
    async (_id, arm) => {
      as("anonymous");
      const outcome = await runArm(arm);
      expect(outcome).toEqual({ status: 401, body: { error: "Unauthorized" } });
      expect(noWrites()).toEqual([]);
    }
  );
});

// ─── P3: the admin is admitted ─────────────────────────────────────────────

describe("P3: an admin is admitted at every arm (neither 401 nor 403)", () => {
  it.each(ADMIN_ARMS.map((arm) => [arm.id, arm] as const))(
    "%s",
    async (_id, arm) => {
      as("admin");
      const outcome = await runArm(arm);
      expect(outcome.status).not.toBe(401);
      expect(outcome.status).not.toBe(403);
    }
  );
});
