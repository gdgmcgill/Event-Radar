/**
 * DEFECT characterization — F-026 and F-025: personalized and auth-gated GET
 * responses carry no private, no-store (plan 06-07 pins it; plans 06-12,
 * 06-13 and 06-14 fix it with the cache classes, REFAC-19)
 *
 * Every value was measured on the UNMODIFIED handlers at f550de9 with a
 * temporary harness first (the run is in the phase evidence
 * `slice-7-characterization.txt`). Today no handler below sets
 * Cache-Control, so in production the `vercel.json` blanket rule
 * (`s-maxage=60, stale-while-revalidate=300` on `/api/(.*)`, pinned by
 * `src/__tests__/config/vercel-json-defect.test.ts`) lets the shared CDN
 * store an admin's or a student's personalized answer under a key that
 * ignores the session (F-025).
 *
 * The rows are read from `.planning/audit/inventory/endpoints.json`: every
 * GET row whose `cache_policy_target` is `private, no-store`. Each is driven
 * through a local descriptor (the invoker map below, typed by each handler's
 * own export) with the world of `src/__tests__/contracts/badRequestTable.ts`:
 * the admin persona for admin rows, the club owner for every other row, and
 * the same world with no session for the anonymous path (F-026's criterion
 * names both the success and the 401 path).
 *
 * What is pinned:
 *   - C0 the worklist is the inventory: every such row has an invoker here,
 *     except the two named in `NOT_DRIVABLE` with their reason;
 *   - C1 each arm, signed in: the response's Cache-Control is null today
 *     (so neither private nor no-store);
 *   - C2 each arm, anonymous: the same;
 *   - C3 the control: `/api/recommendations` already answers
 *     `private, no-store` on both paths, so the check can see the header.
 *
 * When 06-12's `cachePolicy` lands on an arm, C1 and C2 for that arm MOVE to
 * `private, no-store`, with a defect-ledger row citing F-026.
 *
 * Since 06-15 the inventory carries research C7 and C8, so `/api/events/[id]`
 * and `/api/health` are in the worklist too (46 drivable rows); both were
 * wrapped private by 06-14 and enter at C4/C5 without a C1/C2 history.
 *
 * M1/M2 adds eight private GETs; M3 P1-08 adds five more resources GETs and
 * M3 P1-09 three admin intake GETs (62 total), with explicit typed invokers.
 *
 * Moved so far (`ADOPTED` below): C4 and C5 pin the adopted arms at
 * `private, no-store` with a UUID `x-request-id`, signed in and anonymous
 * (06-13: the admin and moderation arms; the club, organizer-request and
 * my-clubs arms; 06-14 Task 1: the events and calendar arms; 06-14 Task 2:
 * the rest). C1 and C2 kept the arms not yet wrapped; after 06-14 none is
 * left, and each asserts its list is empty (Jest refuses an empty
 * `it.each`).
 *
 * The cookie fake is served through the table's `withContainsAndNot`
 * wrapper for every row (admin/organizers and events/happening-now call
 * `contains`/`not`, which the shared fake lacks); `users/search` still meets
 * the fake's `ilike` gap and answers its caught 500, whose header is what is
 * pinned.
 */

import { NextRequest } from "next/server";
import { M2_ARMS, M2_ID } from "./m2RouteArms";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../helpers/fakeSupabase";
import {
  CLUB_ID,
  EVENT_OWN,
  EXPERIMENT_ID,
  PERSONAS,
  elevatedInit,
  withContainsAndNot,
} from "../contracts/badRequestTable";

let mockCookie: FakeSupabase;
let mockElevated: FakeSupabase;
let mockClient: FakeSupabase["client"];

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockClient),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => mockElevated.client,
}));

jest.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () => undefined,
      getAll: () => [],
      set: () => undefined,
      delete: () => undefined,
    }),
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── The invokers ──────────────────────────────────────────────────────────

type GetInvoke = (req: NextRequest) => Promise<Response | undefined>;

const idOf = (id: string) => ({ params: Promise.resolve({ id }) });

/** Keyed by the inventory's `route` field. */
const GET_ARMS: Record<string, { path: string; invoke: GetInvoke }> = {
  // M1/M2: typed, explicit descriptors also driven through validation,
  // authorization and injected backend faults in m2-route-boundaries.test.ts.
  ...Object.fromEntries(M2_ARMS.filter(arm => arm.verb === "GET").map(arm => [
    `/api/${arm.route}`, { path: arm.route.replace("[id]", M2_ID), invoke: arm.invoke },
  ])),
  "/api/admin/analytics/events": {
    path: "admin/analytics/events",
    invoke: async () => (await import("@/app/api/admin/analytics/events/route")).GET(),
  },
  "/api/admin/analytics/users": {
    path: "admin/analytics/users",
    invoke: async () => (await import("@/app/api/admin/analytics/users/route")).GET(),
  },
  "/api/admin/audit-log": {
    path: "admin/audit-log",
    invoke: async (r) => (await import("@/app/api/admin/audit-log/route")).GET(r),
  },
  "/api/admin/calculate-popularity": {
    path: "admin/calculate-popularity",
    invoke: async (r) => (await import("@/app/api/admin/calculate-popularity/route")).GET(r),
  },
  "/api/admin/clubs": {
    path: "admin/clubs",
    invoke: async (r) => (await import("@/app/api/admin/clubs/route")).GET(r),
  },
  "/api/admin/events": {
    path: "admin/events",
    invoke: async (r) => (await import("@/app/api/admin/events/route")).GET(r),
  },
  "/api/admin/experiments/[id]/results": {
    path: `admin/experiments/${EXPERIMENT_ID}/results`,
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/results/route")).GET(r, idOf(EXPERIMENT_ID)),
  },
  "/api/admin/experiments/[id]": {
    path: `admin/experiments/${EXPERIMENT_ID}`,
    invoke: async (r) =>
      (await import("@/app/api/admin/experiments/[id]/route")).GET(r, idOf(EXPERIMENT_ID)),
  },
  "/api/admin/experiments": {
    path: "admin/experiments",
    invoke: async (r) => (await import("@/app/api/admin/experiments/route")).GET(r),
  },
  "/api/admin/featured": {
    path: "admin/featured",
    invoke: async () => (await import("@/app/api/admin/featured/route")).GET(),
  },
  "/api/admin/organizer-requests": {
    path: "admin/organizer-requests",
    invoke: async (r) => (await import("@/app/api/admin/organizer-requests/route")).GET(r),
  },
  "/api/admin/organizers": {
    path: "admin/organizers",
    invoke: async (r) => (await import("@/app/api/admin/organizers/route")).GET(r),
  },
  "/api/admin/reports": {
    path: "admin/reports",
    invoke: async (r) => (await import("@/app/api/admin/reports/route")).GET(r),
  },
  "/api/admin/stats": {
    path: "admin/stats",
    invoke: async () => (await import("@/app/api/admin/stats/route")).GET(),
  },
  "/api/admin/users": {
    path: "admin/users",
    invoke: async () => (await import("@/app/api/admin/users/route")).GET(),
  },
  "/api/calendar/events": {
    path: "calendar/events",
    invoke: async (r) => (await import("@/app/api/calendar/events/route")).GET(r),
  },
  "/api/clubs/[id]/analytics": {
    path: `clubs/${CLUB_ID}/analytics`,
    invoke: async (r) =>
      (await import("@/app/api/clubs/[id]/analytics/route")).GET(r, idOf(CLUB_ID)),
  },
  "/api/clubs/[id]/events": {
    path: `clubs/${CLUB_ID}/events`,
    invoke: async (r) =>
      (await import("@/app/api/clubs/[id]/events/route")).GET(r, idOf(CLUB_ID)),
  },
  "/api/clubs/[id]/follow": {
    path: `clubs/${CLUB_ID}/follow`,
    invoke: async (r) =>
      (await import("@/app/api/clubs/[id]/follow/route")).GET(r, idOf(CLUB_ID)),
  },
  "/api/clubs/[id]/invites": {
    path: `clubs/${CLUB_ID}/invites`,
    invoke: async (r) =>
      (await import("@/app/api/clubs/[id]/invites/route")).GET(r, idOf(CLUB_ID)),
  },
  "/api/clubs/[id]/members": {
    path: `clubs/${CLUB_ID}/members`,
    invoke: async (r) =>
      (await import("@/app/api/clubs/[id]/members/route")).GET(r, idOf(CLUB_ID)),
  },
  "/api/clubs/friends": {
    path: "clubs/friends",
    invoke: async () => (await import("@/app/api/clubs/friends/route")).GET(),
  },
  "/api/events/[id]/analytics": {
    path: `events/${EVENT_OWN}/analytics`,
    invoke: async (r) =>
      (await import("@/app/api/events/[id]/analytics/route")).GET(r, idOf(EVENT_OWN)),
  },
  "/api/events/[id]/friends": {
    path: `events/${EVENT_OWN}/friends`,
    invoke: async (r) =>
      (await import("@/app/api/events/[id]/friends/route")).GET(r, idOf(EVENT_OWN)),
  },
  "/api/events/[id]/reviews": {
    path: `events/${EVENT_OWN}/reviews`,
    invoke: async (r) =>
      (await import("@/app/api/events/[id]/reviews/route")).GET(r, idOf(EVENT_OWN)),
  },
  // 06-15: the inventory now carries C7 and C8, so these two GET rows joined the
  // worklist; both were wrapped private by 06-14 and pin at C4/C5 directly.
  "/api/events/[id]": {
    path: `events/${EVENT_OWN}`,
    invoke: async (r) =>
      (await import("@/app/api/events/[id]/route")).GET(r, idOf(EVENT_OWN)),
  },
  "/api/health": {
    path: "health",
    invoke: async (r) => (await import("@/app/api/health/route")).GET(r),
  },
  "/api/events/[id]/rsvp": {
    path: `events/${EVENT_OWN}/rsvp`,
    invoke: async (r) =>
      (await import("@/app/api/events/[id]/rsvp/route")).GET(r, idOf(EVENT_OWN)),
  },
  "/api/events/following": {
    path: "events/following",
    invoke: async () => (await import("@/app/api/events/following/route")).GET(),
  },
  "/api/events/friends-activity": {
    path: "events/friends-activity",
    invoke: async () => (await import("@/app/api/events/friends-activity/route")).GET(),
  },
  "/api/events/friends-organizing": {
    path: "events/friends-organizing",
    invoke: async () => (await import("@/app/api/events/friends-organizing/route")).GET(),
  },
  "/api/events/my-events": {
    path: "events/my-events",
    invoke: async () => (await import("@/app/api/events/my-events/route")).GET(),
  },
  "/api/moderation/reviews/[targetType]/[targetId]": {
    path: `moderation/reviews/event/${EVENT_OWN}`,
    invoke: async (r) =>
      (await import("@/app/api/moderation/reviews/[targetType]/[targetId]/route")).GET(r, {
        params: Promise.resolve({ targetType: "event", targetId: EVENT_OWN }),
      }),
  },
  "/api/my-clubs": {
    path: "my-clubs",
    invoke: async () => (await import("@/app/api/my-clubs/route")).GET(),
  },
  "/api/notifications/count": {
    path: "notifications/count",
    invoke: async () => (await import("@/app/api/notifications/count/route")).GET(),
  },
  "/api/notifications": {
    path: "notifications",
    invoke: async (r) => (await import("@/app/api/notifications/route")).GET(r),
  },
  "/api/organizer-requests": {
    path: "organizer-requests",
    invoke: async () => (await import("@/app/api/organizer-requests/route")).GET(),
  },
  "/api/recommendations/analytics": {
    path: "recommendations/analytics?period=7d",
    invoke: async (r) => (await import("@/app/api/recommendations/analytics/route")).GET(r),
  },
  "/api/recommendations/feedback": {
    path: `recommendations/feedback?event_ids=${EVENT_OWN}`,
    invoke: async (r) => (await import("@/app/api/recommendations/feedback/route")).GET(r),
  },
  "/api/recommendations": {
    path: "recommendations",
    invoke: async (r) => (await import("@/app/api/recommendations/route")).GET(r),
  },
  "/api/user/engagement": {
    path: "user/engagement",
    invoke: async () => (await import("@/app/api/user/engagement/route")).GET(),
  },
  "/api/user/following": {
    path: "user/following",
    invoke: async () => (await import("@/app/api/user/following/route")).GET(),
  },
  "/api/users/me/friends": {
    path: "users/me/friends",
    invoke: async () => (await import("@/app/api/users/me/friends/route")).GET(),
  },
  "/api/users/me/requests": {
    path: "users/me/requests",
    invoke: async () => (await import("@/app/api/users/me/requests/route")).GET(),
  },
  "/api/users/me/suggestions": {
    path: "users/me/suggestions",
    invoke: async () => (await import("@/app/api/users/me/suggestions/route")).GET(),
  },
  "/api/users/saved-events": {
    path: "users/saved-events",
    invoke: async (r) => (await import("@/app/api/users/saved-events/route")).GET(r),
  },
  "/api/users/search": {
    path: "users/search?q=ot",
    invoke: async (r) => (await import("@/app/api/users/search/route")).GET(r),
  },
};

// ─── The worklist, read from the inventory ─────────────────────────────────

interface InventoryRow {
  route: string;
  methods: string[];
  auth_requirement: string;
  cache_policy_target: string;
}

const INVENTORY: InventoryRow[] = require("../../../.planning/audit/inventory/endpoints.json");

const CONTROL = "/api/recommendations";

/** Inventory rows with no invoker, and why. */
const NOT_DRIVABLE: Record<string, string> = {
  "/api/auth-debug":
    "the route file was deleted in Phase 5; the classifier retains its audit-time row (DEC-55)",
  "/auth/callback":
    "not under /api and a redirect, not a JSON GET, and its client comes from @supabase/ssr, not this fake; 06-14 wraps it with the private class (the cache census checks the declaration)",
};

const WORKLIST = INVENTORY.filter(
  (row) =>
    row.methods.includes("GET") &&
    row.cache_policy_target === "private, no-store" &&
    row.route !== CONTROL
);

type Who = "signed-in" | "anonymous";

async function headersOf(route: string, auth: string, who: Who): Promise<Headers> {
  const persona = auth === "admin" ? "admin" : "owner";
  const init = PERSONAS[persona]();
  if (who === "anonymous") init.user = null;
  mockCookie = createFakeSupabase(init);
  mockElevated = createFakeSupabase(elevatedInit(persona));
  mockClient = withContainsAndNot(mockCookie.client);
  const arm = GET_ARMS[route];
  const response = await arm.invoke(
    new NextRequest(`http://localhost:3000/api/${arm.path}`)
  );
  if (!response) throw new Error(`${route} returned no response`);
  return response.headers;
}

async function cacheControl(route: string, auth: string, who: Who): Promise<string | null> {
  return (await headersOf(route, auth, who)).get("Cache-Control");
}

/**
 * Arms whose handler now wears `withRoute({ cache: "private" })`: their C1 and
 * C2 rows moved to C4 and C5 (F-026 fixed for the arm; one defect-ledger row
 * per moved row). Only ever grows, until C1 and C2 are empty (06-14).
 */
const ADOPTED: ReadonlySet<string> = new Set([
  ...M2_ARMS.filter(arm => arm.verb === "GET").map(arm => `/api/${arm.route}`),
  // 06-13 Task 1: admin and moderation
  "/api/admin/analytics/events",
  "/api/admin/analytics/users",
  "/api/admin/audit-log",
  "/api/admin/calculate-popularity",
  "/api/admin/clubs",
  "/api/admin/events",
  "/api/admin/experiments/[id]/results",
  "/api/admin/experiments/[id]",
  "/api/admin/experiments",
  "/api/admin/featured",
  "/api/admin/organizer-requests",
  "/api/admin/organizers",
  "/api/admin/reports",
  "/api/admin/stats",
  "/api/admin/users",
  "/api/moderation/reviews/[targetType]/[targetId]",
  // 06-13 Task 2: clubs, organizer-requests, my-clubs
  "/api/clubs/[id]/analytics",
  "/api/clubs/[id]/events",
  "/api/clubs/[id]/follow",
  "/api/clubs/[id]/invites",
  "/api/clubs/[id]/members",
  "/api/clubs/friends",
  "/api/my-clubs",
  "/api/organizer-requests",
  // 06-14 Task 1: events and calendar
  "/api/calendar/events",
  "/api/events/[id]/analytics",
  "/api/events/[id]/friends",
  "/api/events/[id]/reviews",
  "/api/events/[id]/rsvp",
  "/api/events/following",
  "/api/events/friends-activity",
  "/api/events/friends-organizing",
  "/api/events/my-events",
  // 06-14 Task 2: notifications, recommendations, user, users
  "/api/notifications/count",
  "/api/notifications",
  "/api/recommendations/analytics",
  "/api/recommendations/feedback",
  "/api/user/engagement",
  "/api/user/following",
  "/api/users/me/friends",
  "/api/users/me/requests",
  "/api/users/me/suggestions",
  "/api/users/saved-events",
  "/api/users/search",
  // 06-15: the regenerated inventory's C7 and C8 targets (already private, 06-14)
  "/api/events/[id]",
  "/api/health",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const drivable = WORKLIST.filter((row) => !(row.route in NOT_DRIVABLE)).map(
  (row): [string, InventoryRow] => [row.route, row]
);
const pending = drivable.filter(([route]) => !ADOPTED.has(route));
const adopted = drivable.filter(([route]) => ADOPTED.has(route));

describe("C0: the worklist is the inventory", () => {
  it("every private-target GET row has an invoker or a NOT_DRIVABLE reason", () => {
    const missing = WORKLIST.map((row) => row.route).filter(
      (route) => !(route in GET_ARMS) && !(route in NOT_DRIVABLE)
    );
    expect(missing).toEqual([]);
    expect(drivable).toHaveLength(62);
  });

  it("every ADOPTED route is a drivable worklist row", () => {
    const routes = drivable.map(([route]) => route);
    expect([...ADOPTED].filter((r) => !routes.includes(r))).toEqual([]);
    expect(pending.length + adopted.length).toBe(62);
  });

  it("every NOT_DRIVABLE route is in the worklist", () => {
    const routes = WORKLIST.map((row) => row.route);
    expect(Object.keys(NOT_DRIVABLE).filter((r) => !routes.includes(r))).toEqual([]);
  });
});

describe("C1: signed in, no private, no-store today", () => {
  if (pending.length === 0) {
    it("no arm is pending (06-14 moved the last to C4)", () => {
      expect(pending).toEqual([]);
    });
    return;
  }
  it.each(pending)("%s", async (route, row) => {
    const value = await cacheControl(route, row.auth_requirement, "signed-in");
    expect(value).toBeNull();
  });
});

describe("C2: anonymous, no private, no-store today", () => {
  if (pending.length === 0) {
    it("no arm is pending (06-14 moved the last to C5)", () => {
      expect(pending).toEqual([]);
    });
    return;
  }
  it.each(pending)("%s", async (route, row) => {
    const value = await cacheControl(route, row.auth_requirement, "anonymous");
    expect(value).toBeNull();
  });
});

describe("C3: the control already sends it", () => {
  it.each<Who>(["signed-in", "anonymous"])("/api/recommendations, %s", async (who) => {
    expect(await cacheControl(CONTROL, "anonymous", who)).toBe("private, no-store");
  });
});

describe("C4: adopted, signed in: private, no-store and a request id (F-026 fixed)", () => {
  it.each(adopted)("%s", async (route, row) => {
    const headers = await headersOf(route, row.auth_requirement, "signed-in");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("x-request-id")).toMatch(UUID);
    expect(headers.get("Vary")).toBeNull();
  });
});

describe("C5: adopted, anonymous: private, no-store and a request id (F-026 fixed)", () => {
  it.each(adopted)("%s", async (route, row) => {
    const headers = await headersOf(route, row.auth_requirement, "anonymous");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("x-request-id")).toMatch(UUID);
    expect(headers.get("Vary")).toBeNull();
  });
});
