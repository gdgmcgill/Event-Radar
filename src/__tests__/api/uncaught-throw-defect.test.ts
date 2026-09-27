/**
 * DEFECT characterization — F-058: route files with no error handling reject
 * with no JSON body (plan 06-07 pins it; plans 06-13 and 06-14 wrap every
 * route in `withRoute`, whose catch answers a JSON 500, REFAC-20)
 *
 * Measured at f550de9. 22 route files under `src/app` contain no `try {` at
 * all (F-058's "twenty-two"; the inventory's `signals.has_try_catch` agrees
 * file for file). They export 26 handlers. When a dependency throws inside
 * one of them, nothing catches it: the handler's promise rejects and Next
 * answers an HTML 500 with no JSON body and no request correlation.
 *
 * What is pinned:
 *   - U0 the arm list is the tree: the files in `ARMS` are exactly the
 *     no-try route files, and every exported verb of each has one row;
 *   - U1 each arm, its first dependency after the guards throws
 *     `SENTINEL-F058`: the handler promise REJECTS with that error (today's
 *     behaviour). The throwing dependency per arm: a table read on the
 *     cookie or elevated fake (`throwOn`, the context's own profile read
 *     spared), `cookies()` for onboarding/complete, and the ssr client's
 *     `signOut()` for auth/signout;
 *   - U2 the control: a route that has a try (`events/featured` GET) answers
 *     a JSON 500 to the same throw, so U1 is a property of the missing try,
 *     not of the harness.
 *
 * When a file adopts the wrapper, its U1 rows MOVE to a JSON 500 (the
 * wrapper's generic body), with a defect-ledger row citing F-058, and U0's
 * list shrinks with it.
 *
 * Personas and the world come from `src/__tests__/contracts/badRequestTable.ts`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../helpers/fakeSupabase";
import {
  CLUB_ID,
  EVENT_OWN,
  EXPERIMENT_ID,
  MEMBER_ORGANIZER,
  OTHER_USER_ID,
  PERSONAS,
  elevatedInit,
  type PersonaName,
} from "../contracts/badRequestTable";

const SENTINEL = "SENTINEL-F058";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
let mockCookieClient: FakeSupabase["client"];
let mockElevatedClient: FakeSupabase["client"];
let mockCookiesThrow = false;
const mockSignOut = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookieClient),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevatedClient,
  serviceRoleKey: () => "test-service-role-key",
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => mockElevatedClient,
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { signOut: mockSignOut } }),
}));

jest.mock("next/headers", () => ({
  cookies: () =>
    mockCookiesThrow
      ? Promise.reject(new Error("SENTINEL-F058"))
      : Promise.resolve({
          get: () => undefined,
          getAll: () => [],
          set: () => undefined,
          delete: () => undefined,
        }),
}));

const ENV = process.env as Record<string, string | undefined>;
const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = ENV[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete ENV[key];
    else ENV[key] = savedEnv[key];
  }
});

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  ENV.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  mockCookiesThrow = false;
  mockSignOut.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Wraps a fake client so `from(table)` throws SENTINEL. On the cookie client
 * the first `users` call is spared: it is the request context's own profile
 * read, and the guards must pass so the throw lands inside the handler body.
 * The elevated client never serves that read, so nothing is spared there.
 */
function throwingOn(
  client: FakeSupabase["client"],
  table: string,
  spareContextRead: boolean
): FakeSupabase["client"] {
  let spared = !(spareContextRead && table === "users");
  return {
    auth: client.auth,
    rpc: (name, args) => client.rpc(name, args),
    from(name) {
      if (name === table) {
        if (spared) throw new Error(SENTINEL);
        spared = true;
      }
      return client.from(name);
    },
  };
}

// ─── The arms ──────────────────────────────────────────────────────────────

type Throws = { table: string } | { cookies: true } | { signOut: true };

interface Arm {
  file: string;
  verb: string;
  persona: PersonaName;
  throws: Throws;
  invoke(): Promise<Response | undefined>;
}

const BASE = "http://localhost:3000";
const get = (path: string) => new NextRequest(`${BASE}${path}`);
const json = (path: string, method: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const idOf = (id: string) => ({ params: Promise.resolve({ id }) });

const ARMS: Arm[] = [
  { file: "api/admin/analytics/events", verb: "GET", persona: "admin", throws: { table: "events" },
    invoke: async () => (await import("@/app/api/admin/analytics/events/route")).GET() },
  { file: "api/admin/analytics/users", verb: "GET", persona: "admin", throws: { table: "users" },
    invoke: async () => (await import("@/app/api/admin/analytics/users/route")).GET() },
  { file: "api/admin/audit-log", verb: "GET", persona: "admin", throws: { table: "admin_audit_log" },
    invoke: async () => (await import("@/app/api/admin/audit-log/route")).GET(get("/api/admin/audit-log")) },
  { file: "api/admin/clubs", verb: "GET", persona: "admin", throws: { table: "clubs" },
    invoke: async () => (await import("@/app/api/admin/clubs/route")).GET(get("/api/admin/clubs")) },
  { file: "api/admin/events/[id]/edits", verb: "PATCH", persona: "admin", throws: { table: "events" },
    invoke: async () =>
      (await import("@/app/api/admin/events/[id]/edits/route")).PATCH(
        json(`/api/admin/events/${EVENT_OWN}/edits`, "PATCH", { action: "approve" }),
        idOf(EVENT_OWN)
      ) },
  { file: "api/admin/experiments/[id]/results", verb: "GET", persona: "admin", throws: { table: "experiments" },
    invoke: async () =>
      (await import("@/app/api/admin/experiments/[id]/results/route")).GET(
        get(`/api/admin/experiments/${EXPERIMENT_ID}/results`),
        idOf(EXPERIMENT_ID)
      ) },
  { file: "api/admin/experiments/[id]", verb: "GET", persona: "admin", throws: { table: "experiments" },
    invoke: async () =>
      (await import("@/app/api/admin/experiments/[id]/route")).GET(
        get(`/api/admin/experiments/${EXPERIMENT_ID}`),
        idOf(EXPERIMENT_ID)
      ) },
  { file: "api/admin/experiments/[id]", verb: "PATCH", persona: "admin", throws: { table: "experiments" },
    invoke: async () =>
      (await import("@/app/api/admin/experiments/[id]/route")).PATCH(
        json(`/api/admin/experiments/${EXPERIMENT_ID}`, "PATCH", { description: "x" }),
        idOf(EXPERIMENT_ID)
      ) },
  { file: "api/admin/experiments/[id]", verb: "DELETE", persona: "admin", throws: { table: "experiments" },
    invoke: async () =>
      (await import("@/app/api/admin/experiments/[id]/route")).DELETE(
        get(`/api/admin/experiments/${EXPERIMENT_ID}`),
        idOf(EXPERIMENT_ID)
      ) },
  { file: "api/admin/experiments", verb: "GET", persona: "admin", throws: { table: "experiments" },
    invoke: async () => (await import("@/app/api/admin/experiments/route")).GET(get("/api/admin/experiments")) },
  { file: "api/admin/experiments", verb: "POST", persona: "admin", throws: { table: "experiments" },
    invoke: async () =>
      (await import("@/app/api/admin/experiments/route")).POST(
        json("/api/admin/experiments", "POST", { name: "x", variants: [{ name: "a" }, { name: "b" }] })
      ) },
  { file: "api/admin/organizer-requests", verb: "GET", persona: "admin", throws: { table: "organizer_requests" },
    invoke: async () =>
      (await import("@/app/api/admin/organizer-requests/route")).GET(get("/api/admin/organizer-requests")) },
  { file: "api/admin/organizers", verb: "GET", persona: "admin", throws: { table: "users" },
    invoke: async () => (await import("@/app/api/admin/organizers/route")).GET(get("/api/admin/organizers")) },
  { file: "api/admin/reports", verb: "GET", persona: "admin", throws: { table: "event_reports" },
    invoke: async () => (await import("@/app/api/admin/reports/route")).GET(get("/api/admin/reports")) },
  { file: "api/admin/stats", verb: "GET", persona: "admin", throws: { table: "events" },
    invoke: async () => (await import("@/app/api/admin/stats/route")).GET() },
  { file: "api/admin/users/[id]", verb: "PATCH", persona: "admin", throws: { table: "users" },
    invoke: async () =>
      (await import("@/app/api/admin/users/[id]/route")).PATCH(
        json(`/api/admin/users/${OTHER_USER_ID}`, "PATCH", { name: "Valid Name" }),
        idOf(OTHER_USER_ID)
      ) },
  { file: "api/admin/users", verb: "GET", persona: "admin", throws: { table: "users" },
    invoke: async () => (await import("@/app/api/admin/users/route")).GET() },
  { file: "api/clubs/[id]/members/role", verb: "PATCH", persona: "owner", throws: { table: "club_members" },
    invoke: async () =>
      (await import("@/app/api/clubs/[id]/members/role/route")).PATCH(
        json(`/api/clubs/${CLUB_ID}/members/role`, "PATCH", { memberId: MEMBER_ORGANIZER, role: "organizer" }),
        idOf(CLUB_ID)
      ) },
  { file: "api/clubs/[id]/transfer", verb: "POST", persona: "owner", throws: { table: "club_members" },
    invoke: async () =>
      (await import("@/app/api/clubs/[id]/transfer/route")).POST(
        json(`/api/clubs/${CLUB_ID}/transfer`, "POST", { newOwnerId: OTHER_USER_ID }),
        idOf(CLUB_ID)
      ) },
  { file: "api/events/[id]/report", verb: "POST", persona: "student", throws: { table: "events" },
    invoke: async () =>
      (await import("@/app/api/events/[id]/report/route")).POST(
        json(`/api/events/${EVENT_OWN}/report`, "POST", { category: "other" }),
        idOf(EVENT_OWN)
      ) },
  { file: "api/events/my-events", verb: "GET", persona: "student", throws: { table: "events" },
    invoke: async () => (await import("@/app/api/events/my-events/route")).GET() },
  { file: "api/moderation/reviews/[targetType]/[targetId]", verb: "GET", persona: "admin", throws: { table: "moderation_reviews" },
    invoke: async () =>
      (await import("@/app/api/moderation/reviews/[targetType]/[targetId]/route")).GET(
        get(`/api/moderation/reviews/event/${EVENT_OWN}`),
        { params: Promise.resolve({ targetType: "event", targetId: EVENT_OWN }) }
      ) },
  { file: "api/onboarding/complete", verb: "POST", persona: "student", throws: { cookies: true },
    invoke: async () => (await import("@/app/api/onboarding/complete/route")).POST() },
  { file: "api/organizer-requests", verb: "POST", persona: "student", throws: { table: "clubs" },
    invoke: async () =>
      (await import("@/app/api/organizer-requests/route")).POST(
        json("/api/organizer-requests", "POST", { club_id: CLUB_ID })
      ) },
  { file: "api/organizer-requests", verb: "GET", persona: "student", throws: { table: "organizer_requests" },
    invoke: async () => (await import("@/app/api/organizer-requests/route")).GET() },
  { file: "auth/signout", verb: "POST", persona: "student", throws: { signOut: true },
    invoke: async () =>
      (await import("@/app/auth/signout/route")).POST(
        new NextRequest(`${BASE}/auth/signout`, { method: "POST" })
      ) },
];

function arrange(persona: PersonaName, throws: Throws): void {
  mockCookie = createFakeSupabase(PERSONAS[persona]());
  mockElevated = createFakeSupabase(elevatedInit(persona));
  mockCookieClient = mockCookie.client;
  mockElevatedClient = mockElevated.client;
  if ("table" in throws) {
    mockCookieClient = throwingOn(mockCookie.client, throws.table, true);
    mockElevatedClient = throwingOn(mockElevated.client, throws.table, false);
  } else if ("cookies" in throws) {
    mockCookiesThrow = true;
  } else {
    mockSignOut.mockRejectedValue(new Error(SENTINEL));
  }
}

// ─── U0: the arm list is the tree ──────────────────────────────────────────

const APP = join(process.cwd(), "src", "app");
const VERB = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

function noTryRouteFiles(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of readdirSync(APP, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const source = readFileSync(join(entry.parentPath, entry.name), "utf8");
    if (/\btry\s*\{/.test(source)) continue;
    const file = relative(APP, entry.parentPath).split(sep).join("/");
    out[file] = [...source.matchAll(VERB)].map((m) => m[1]).sort();
  }
  return out;
}

describe("U0: the arm list is the tree", () => {
  it("the files are exactly the 22 route files with no try, each verb once", () => {
    const listed: Record<string, string[]> = {};
    for (const arm of ARMS) (listed[arm.file] ??= []).push(arm.verb);
    for (const verbs of Object.values(listed)) verbs.sort();
    const tree = noTryRouteFiles();
    expect(listed).toEqual(tree);
    expect(Object.keys(tree)).toHaveLength(22);
    expect(ARMS).toHaveLength(26);
  });
});

// ─── U1: a throw inside the handler rejects its promise ────────────────────

describe("U1: a throwing dependency rejects the handler promise (no JSON body)", () => {
  it.each(ARMS.map((arm): [string, Arm] => [`${arm.file} ${arm.verb}`, arm]))(
    "%s",
    async (_label, arm) => {
      arrange(arm.persona, arm.throws);
      await expect(arm.invoke()).rejects.toThrow(SENTINEL);
    }
  );
});

// ─── U2: the control ───────────────────────────────────────────────────────

describe("U2: control — a route with a try answers a JSON 500 to the same throw", () => {
  it("events/featured GET, featured_events throws → 500 JSON", async () => {
    arrange("student", { table: "featured_events" });
    const response = await (await import("@/app/api/events/featured/route")).GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
  });
});
