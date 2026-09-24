/**
 * The admin arm table for slice 5 (plan 05-12, REFAC-13).
 *
 * One descriptor per exported verb under `src/app/api/admin/**` plus the two
 * admin-gated recommendation routes (`recommendations/analytics` GET and
 * `recommendations/batch` POST). The list was derived from the tree by a node
 * enumeration, not typed from memory: 35 arms in 26 files, of which 33 arms in
 * 25 files call the admin-verify helper (`src/lib/admin.ts`) and 2 arms
 * (`admin/calculate-popularity` POST and GET) gate on the machine key alone.
 * The enumeration and its output are recorded in
 * `.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/slice-5-characterization.txt`.
 * An admin arm added to the tree must be added here too; the PRESERVE suite's
 * P0 re-derives the list from the tree on every run and goes red otherwise.
 *
 * Each descriptor carries:
 *   - `id`: "<route path under /api> <VERB>", for example "admin/stats GET";
 *   - `invoke(req)`: a closure that dynamically imports the route module and
 *     calls the verb with the request and `{ params: Promise.resolve({ … }) }`.
 *     The call is type-checked against the handler's own exported signature,
 *     so no handler signature is widened to fit this table. Handlers that take
 *     no arguments are called with none;
 *   - `makeRequest()`: a minimal request for the arm, read from the handler's
 *     own body contract. The gate runs before any body read, so the body
 *     matters only on the admin row, where any outcome other than 401 and 403
 *     counts as admission;
 *   - `anonymous401`: the arm answers an anonymous caller 401
 *     `{"error":"Unauthorized"}` today. Measured, three arms: `admin/clubs`
 *     GET and `admin/organizer-requests` GET (an explicit `!user` branch before
 *     the role check) and `recommendations/batch` POST (401 for every refusal);
 *   - `student401`: the arm answers an authenticated non-admin 401 today.
 *     Measured, one arm: `recommendations/batch` POST. Research § B names all
 *     three `anonymous401` arms as 401 to non-admins too; the measurement
 *     shows `admin/clubs` GET and `admin/organizer-requests` GET already answer
 *     a non-admin 403 `{"error":"Forbidden"}`, and the measurement is pinned;
 *   - `machineKey`: the arm gates on `ADMIN_API_KEY` alone and accepts every
 *     request when the variable is unset (`admin/calculate-popularity`).
 *
 * Personas (`PERSONAS`) return a `FakeSupabaseInit` for the cookie fake:
 * anonymous, student (onboarded, roles ["user"]), admin (roles
 * ["user","admin"]) and bannedAdmin (roles ["user","admin"], `banned_at` set,
 * no expiry). The elevated fake is built from `elevatedInit()`: the same rows,
 * no session, and the two rpcs the admin arms call scripted to succeed.
 *
 * This module registers no jest mock. Each suite that imports it mocks
 * `@/lib/supabase/server` (the cookie fake), `@/lib/supabase/service` and
 * `@supabase/supabase-js` (both the elevated fake) itself, so the dynamic
 * imports below resolve against that suite's mocks.
 */

import { NextRequest } from "next/server";
import type {
  FakeCall,
  FakeRow,
  FakeSupabaseInit,
} from "../../helpers/fakeSupabase";

// ─── Fixture ids (synthetic, not seed ids) ─────────────────────────────────

export const CALLER = {
  id: "5eed0000-0000-4000-8000-0a5000000001",
  email: "admin.ring.caller@mail.mcgill.ca",
};
export const TARGET_USER_ID = "5eed0000-0000-4000-8000-0a5000000002";
export const EVENT_ID = "5eed0000-0000-4000-8000-0a50000000e1";
export const CLUB_ID = "5eed0000-0000-4000-8000-0a50000000c1";
export const EXPERIMENT_ID = "5eed0000-0000-4000-8000-0a50000000a1";
export const FEATURED_ID = "5eed0000-0000-4000-8000-0a50000000f1";
export const REQUEST_ID = "5eed0000-0000-4000-8000-0a50000000b1";
export const REPORT_ID = "5eed0000-0000-4000-8000-0a50000000d1";

const BASE = "http://localhost:3000/api";

// ─── Descriptor shape ──────────────────────────────────────────────────────

export interface AdminArm {
  id: string;
  invoke(req: NextRequest): Promise<Response>;
  makeRequest(): NextRequest;
  anonymous401: boolean;
  student401: boolean;
  machineKey: boolean;
}

// ─── Request builders ──────────────────────────────────────────────────────

function req(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`${BASE}/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

function id(value: string) {
  return { params: Promise.resolve({ id: value }) };
}

const PLAIN = { anonymous401: false, student401: false, machineKey: false };

// ─── The arms (35, in the enumeration's order) ─────────────────────────────

export const ADMIN_ARMS: readonly AdminArm[] = [
  {
    id: "admin/analytics/events GET",
    invoke: async () =>
      (await import("@/app/api/admin/analytics/events/route")).GET(),
    makeRequest: () => req("admin/analytics/events", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/analytics/users GET",
    invoke: async () =>
      (await import("@/app/api/admin/analytics/users/route")).GET(),
    makeRequest: () => req("admin/analytics/users", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/audit-log GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/audit-log/route")).GET(r),
    makeRequest: () => req("admin/audit-log?page=1", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/calculate-popularity POST",
    invoke: async (r) =>
      (await import("@/app/api/admin/calculate-popularity/route")).POST(r),
    makeRequest: () => req("admin/calculate-popularity", "POST"),
    anonymous401: false,
    student401: false,
    machineKey: true,
  },
  {
    id: "admin/calculate-popularity GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/calculate-popularity/route")).GET(r),
    makeRequest: () => req("admin/calculate-popularity", "GET"),
    anonymous401: false,
    student401: false,
    machineKey: true,
  },
  {
    id: "admin/clubs/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/clubs/[id]/route")).PATCH(r, id(CLUB_ID)),
    makeRequest: () => req(`admin/clubs/${CLUB_ID}`, "PATCH", { status: "approved" }),
    ...PLAIN,
  },
  {
    id: "admin/clubs GET",
    invoke: async (r) => (await import("@/app/api/admin/clubs/route")).GET(r),
    makeRequest: () => req("admin/clubs?status=pending", "GET"),
    anonymous401: true,
    student401: false,
    machineKey: false,
  },
  {
    id: "admin/events/[id]/edits PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/events/[id]/edits/route")).PATCH(
        r,
        id(EVENT_ID)
      ),
    makeRequest: () =>
      req(`admin/events/${EVENT_ID}/edits`, "PATCH", { action: "approve" }),
    ...PLAIN,
  },
  {
    id: "admin/events/[id] PUT",
    invoke: async (r) =>
      (await import("@/app/api/admin/events/[id]/route")).PUT(r, id(EVENT_ID)),
    makeRequest: () =>
      req(`admin/events/${EVENT_ID}`, "PUT", { title: "Admin Ring Event" }),
    ...PLAIN,
  },
  {
    id: "admin/events/[id] DELETE",
    invoke: async (r) =>
      (await import("@/app/api/admin/events/[id]/route")).DELETE(r, id(EVENT_ID)),
    makeRequest: () => req(`admin/events/${EVENT_ID}`, "DELETE"),
    ...PLAIN,
  },
  {
    id: "admin/events/[id]/status PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/events/[id]/status/route")).PATCH(
        r,
        id(EVENT_ID)
      ),
    makeRequest: () =>
      req(`admin/events/${EVENT_ID}/status`, "PATCH", { status: "approved" }),
    ...PLAIN,
  },
  {
    id: "admin/events GET",
    invoke: async (r) => (await import("@/app/api/admin/events/route")).GET(r),
    makeRequest: () => req("admin/events?limit=5", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/events POST",
    invoke: async (r) => (await import("@/app/api/admin/events/route")).POST(r),
    makeRequest: () =>
      req("admin/events", "POST", {
        title: "Admin Ring Event",
        description: "Created by the admin arm table",
        start_date: "2030-01-01T18:00:00.000Z",
        end_date: "2030-01-01T20:00:00.000Z",
        location: "Ring Hall",
        tags: ["academic"],
      }),
    ...PLAIN,
  },
  {
    id: "admin/experiments/[id]/results GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/results/route")).GET(
        r,
        id(EXPERIMENT_ID)
      ),
    makeRequest: () => req(`admin/experiments/${EXPERIMENT_ID}/results`, "GET"),
    ...PLAIN,
  },
  {
    id: "admin/experiments/[id] GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/route")).GET(
        r,
        id(EXPERIMENT_ID)
      ),
    makeRequest: () => req(`admin/experiments/${EXPERIMENT_ID}`, "GET"),
    ...PLAIN,
  },
  {
    id: "admin/experiments/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/route")).PATCH(
        r,
        id(EXPERIMENT_ID)
      ),
    makeRequest: () =>
      req(`admin/experiments/${EXPERIMENT_ID}`, "PATCH", {
        description: "Updated by the admin arm table",
      }),
    ...PLAIN,
  },
  {
    id: "admin/experiments/[id] DELETE",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/route")).DELETE(
        r,
        id(EXPERIMENT_ID)
      ),
    makeRequest: () => req(`admin/experiments/${EXPERIMENT_ID}`, "DELETE"),
    ...PLAIN,
  },
  {
    id: "admin/experiments GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/route")).GET(r),
    makeRequest: () => req("admin/experiments", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/experiments POST",
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/route")).POST(r),
    makeRequest: () =>
      req("admin/experiments", "POST", {
        name: "admin-ring-experiment",
        description: "Created by the admin arm table",
        variants: [
          { name: "control", weight: 50, config: {} },
          { name: "treatment", weight: 50, config: {} },
        ],
      }),
    ...PLAIN,
  },
  {
    id: "admin/featured/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/featured/[id]/route")).PATCH(
        r,
        id(FEATURED_ID)
      ),
    makeRequest: () =>
      req(`admin/featured/${FEATURED_ID}`, "PATCH", { priority: 1 }),
    ...PLAIN,
  },
  {
    id: "admin/featured/[id] DELETE",
    invoke: async (r) =>
      (await import("@/app/api/admin/featured/[id]/route")).DELETE(
        r,
        id(FEATURED_ID)
      ),
    makeRequest: () => req(`admin/featured/${FEATURED_ID}`, "DELETE"),
    ...PLAIN,
  },
  {
    id: "admin/featured GET",
    invoke: async () => (await import("@/app/api/admin/featured/route")).GET(),
    makeRequest: () => req("admin/featured", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/featured POST",
    invoke: async (r) =>
      (await import("@/app/api/admin/featured/route")).POST(r),
    makeRequest: () =>
      req("admin/featured", "POST", {
        event_id: EVENT_ID,
        starts_at: "2030-01-01T00:00:00.000Z",
        ends_at: "2030-01-08T00:00:00.000Z",
        priority: 1,
      }),
    ...PLAIN,
  },
  {
    id: "admin/organizer-requests/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/organizer-requests/[id]/route")).PATCH(
        r,
        id(REQUEST_ID)
      ),
    makeRequest: () =>
      req(`admin/organizer-requests/${REQUEST_ID}`, "PATCH", {
        status: "approved",
      }),
    ...PLAIN,
  },
  {
    id: "admin/organizer-requests GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/organizer-requests/route")).GET(r),
    makeRequest: () => req("admin/organizer-requests?status=pending", "GET"),
    anonymous401: true,
    student401: false,
    machineKey: false,
  },
  {
    id: "admin/organizers GET",
    invoke: async (r) =>
      (await import("@/app/api/admin/organizers/route")).GET(r),
    makeRequest: () => req("admin/organizers", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/reports/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/reports/[id]/route")).PATCH(r, id(REPORT_ID)),
    makeRequest: () =>
      req(`admin/reports/${REPORT_ID}`, "PATCH", { status: "dismissed" }),
    ...PLAIN,
  },
  {
    id: "admin/reports GET",
    invoke: async (r) => (await import("@/app/api/admin/reports/route")).GET(r),
    makeRequest: () => req("admin/reports", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/stats GET",
    invoke: async () => (await import("@/app/api/admin/stats/route")).GET(),
    makeRequest: () => req("admin/stats", "GET"),
    ...PLAIN,
  },
  {
    id: "admin/users/[id]/ban POST",
    invoke: async (r) =>
      (await import("@/app/api/admin/users/[id]/ban/route")).POST(
        r,
        id(TARGET_USER_ID)
      ),
    makeRequest: () =>
      req(`admin/users/${TARGET_USER_ID}/ban`, "POST", {
        reason: "Admin ring characterization",
      }),
    ...PLAIN,
  },
  {
    id: "admin/users/[id]/ban DELETE",
    invoke: async (r) =>
      (await import("@/app/api/admin/users/[id]/ban/route")).DELETE(
        r,
        id(TARGET_USER_ID)
      ),
    makeRequest: () => req(`admin/users/${TARGET_USER_ID}/ban`, "DELETE"),
    ...PLAIN,
  },
  {
    id: "admin/users/[id] PATCH",
    invoke: async (r) =>
      (await import("@/app/api/admin/users/[id]/route")).PATCH(
        r,
        id(TARGET_USER_ID)
      ),
    makeRequest: () =>
      req(`admin/users/${TARGET_USER_ID}`, "PATCH", { name: "Renamed Target" }),
    ...PLAIN,
  },
  {
    id: "admin/users GET",
    invoke: async () => (await import("@/app/api/admin/users/route")).GET(),
    makeRequest: () => req("admin/users", "GET"),
    ...PLAIN,
  },
  {
    id: "recommendations/analytics GET",
    invoke: async (r) =>
      (await import("@/app/api/recommendations/analytics/route")).GET(r),
    makeRequest: () => req("recommendations/analytics?period=7d", "GET"),
    ...PLAIN,
  },
  {
    id: "recommendations/batch POST",
    invoke: async () =>
      (await import("@/app/api/recommendations/batch/route")).POST(),
    makeRequest: () => req("recommendations/batch", "POST"),
    anonymous401: true,
    student401: true,
    machineKey: false,
  },
];

/** The ids of the 33 arms that call the admin-verify helper today. */
export const HELPER_ARM_IDS: readonly string[] = ADMIN_ARMS.filter(
  (arm) => !arm.machineKey
).map((arm) => arm.id);

// ─── Personas ──────────────────────────────────────────────────────────────

function callerRow(overrides: FakeRow = {}): FakeRow {
  return {
    id: CALLER.id,
    email: CALLER.email,
    name: "Admin Ring Caller",
    roles: ["user"],
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
    ...overrides,
  };
}

const TARGET_ROW: FakeRow = {
  id: TARGET_USER_ID,
  email: "admin.ring.target@mail.mcgill.ca",
  name: "Admin Ring Target",
  roles: ["user"],
  onboarding_completed: true,
  banned_at: null,
  ban_expires_at: null,
  ban_reason: null,
};

/** The rows the admin arms read first. None of them is required to succeed. */
function tables(caller: FakeRow | null): Record<string, FakeRow[]> {
  return {
    users: caller ? [caller, TARGET_ROW] : [TARGET_ROW],
    events: [
      {
        id: EVENT_ID,
        title: "Admin Ring Event",
        status: "approved",
        deleted_at: null,
        created_by: TARGET_USER_ID,
        club_id: CLUB_ID,
        start_date: "2030-01-01T18:00:00+00:00",
        end_date: "2030-01-01T20:00:00+00:00",
        pending_edits: null,
        tags: ["academic"],
      },
    ],
    clubs: [
      {
        id: CLUB_ID,
        name: "Admin Ring Club",
        status: "pending",
        created_by: TARGET_USER_ID,
      },
    ],
    club_members: [],
    experiments: [
      {
        id: EXPERIMENT_ID,
        name: "admin-ring-existing",
        status: "draft",
        description: "Existing experiment",
      },
    ],
    featured_events: [
      {
        id: FEATURED_ID,
        event_id: EVENT_ID,
        priority: 0,
        starts_at: "2030-01-01T00:00:00+00:00",
        ends_at: "2030-01-08T00:00:00+00:00",
      },
    ],
    organizer_requests: [
      {
        id: REQUEST_ID,
        user_id: TARGET_USER_ID,
        club_id: CLUB_ID,
        status: "pending",
      },
    ],
    event_reports: [
      { id: REPORT_ID, event_id: EVENT_ID, reporter_id: TARGET_USER_ID, status: "pending" },
    ],
    event_popularity_scores: [
      {
        event_id: EVENT_ID,
        last_calculated_at: "2026-01-01T00:00:00+00:00",
        popularity_score: 1,
        trending_score: 1,
      },
    ],
  };
}

export type PersonaName = "anonymous" | "student" | "admin" | "bannedAdmin";

export const PERSONAS: Record<PersonaName, () => FakeSupabaseInit> = {
  anonymous: () => ({ user: null, tables: tables(null) }),
  student: () => ({ user: CALLER, tables: tables(callerRow()) }),
  admin: () => ({
    user: CALLER,
    tables: tables(callerRow({ roles: ["user", "admin"] })),
  }),
  bannedAdmin: () => ({
    user: CALLER,
    tables: tables(
      callerRow({
        roles: ["user", "admin"],
        banned_at: "2026-09-01T00:00:00+00:00",
        ban_expires_at: null,
      })
    ),
  }),
};

/**
 * The elevated fake: no session, the admin persona's rows (the elevated
 * client bypasses RLS, so it sees every row), and the two rpcs the admin arms
 * call (`update_event_popularity` from calculate-popularity POST,
 * `compute_user_scores` from recommendations/batch POST) scripted to succeed.
 */
export function elevatedInit(): FakeSupabaseInit {
  return {
    user: null,
    tables: tables(callerRow({ roles: ["user", "admin"] })),
    rpc: {
      update_event_popularity: { data: null, error: null },
      compute_user_scores: { data: null, error: null },
    },
  };
}

// ─── Running an arm ────────────────────────────────────────────────────────

/**
 * What an arm did: its status and parsed body, or `"threw"` and the message
 * when the handler has no outer catch and a fake gap made it throw. A throw is
 * an admission: the caller got past the gate.
 */
export interface ArmOutcome {
  status: number | "threw";
  body: unknown;
}

export async function runArm(arm: AdminArm): Promise<ArmOutcome> {
  try {
    const response = await arm.invoke(arm.makeRequest());
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON; keep the text
    }
    return { status: response.status, body };
  } catch (error) {
    return {
      status: "threw",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

/** True when the outcome is exactly `status` with `{ error }` as its whole body. */
export function refusedWith(
  outcome: ArmOutcome,
  status: number,
  error: string
): boolean {
  return (
    outcome.status === status &&
    JSON.stringify(outcome.body) === JSON.stringify({ error })
  );
}

/** Inserts, updates, deletes and rpcs: the calls that changed state or could have. */
export function writeCalls(calls: readonly FakeCall[]): FakeCall[] {
  return calls.filter((call) =>
    ["insert", "update", "delete", "rpc"].includes(call.operation)
  );
}
