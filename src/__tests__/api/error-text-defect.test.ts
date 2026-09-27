/**
 * DEFECT characterization — F-059: route handlers put a caught error's text
 * in the response body (plan 06-07 pins it; plans 06-13 and 06-14 replace
 * each with a generic body through the wrapper, and 06-17 rewrites health,
 * REFAC-20)
 *
 * The worklist is census C7 of `evidence/floor.before.txt`: every line of a
 * `src/app/**\/route.ts` matching `.message` (except `dateError.message`),
 * 40 hits in 22 files, re-derived at f550de9 with the same 40 lines. Each
 * reachable site gets its own sentinel: the fake's error (or a thrown
 * error) carries the message `SENTINEL-<n>`, n being the site's position in
 * the census, and the row asserts that the sentinel reaches the caller.
 * Every status below was measured on the UNMODIFIED handlers with a first
 * run of this suite before any expectation was fixed (the run is in the
 * phase evidence `slice-7-characterization.txt`).
 *
 * What is pinned:
 *   - E0 the rows plus `NOT_DRIVEN` are census C7, file by file (34 + 6 = 40);
 *   - E1 each of the 34 reachable sites: today's status, and the sentinel
 *     inside the body (at the named path where one response carries two
 *     sites: health's `azure_oauth.message` and `azure_oauth.details.error`).
 *     This includes `events/route.ts:448`, which the census cell classed as
 *     "feeds a benign-error test": measured, its text reaches the body
 *     through `safeMessage` (`route.ts:470-473`) whenever the message does
 *     not start with "{";
 *   - `NOT_DRIVEN` names the 6 lines that are not a response body reachable
 *     through this fake, each with its reason.
 *
 * When a site's route adopts the wrapper (or health is rewritten), its E1
 * row MOVES to a generic body with no sentinel, with a defect-ledger row
 * citing F-059, and E0's census shrinks with it.
 *
 * Moved so far (`FIXED` below): E2 drives each fixed site the same way and
 * pins the route's generic text where the sentinel was, with the sentinel
 * nowhere in the body (06-13: admin, moderation, clubs and organizer
 * requests; 06-14 Task 1: events and calendar; 06-14 Task 2: notifications,
 * recommendations/batch and user/following, which leaves only health's nine
 * rows in E1 for 06-17). A NOT_DRIVEN line that the
 * sweep rewrote so that it no longer holds a `.message` token moves to
 * `RETIRED` with its reason. C7's
 * exclusion of `dateError.message` also skips `updateError.message` (the
 * substring match), which is why the two appeal `updateError.message` 500s
 * were never in C7; each is added to E2 as an addition (`ADDED`) by the plan
 * that fixes it, driven the same way (06-13: clubs; 06-14: events).
 *
 * Seams: `@/lib/supabase/server` returns the cookie fake, with
 * `auth.getSession` and `auth.signInWithOAuth` added for the health rows;
 * `@/lib/supabase/service` and `@supabase/supabase-js` return the elevated
 * fake. Personas and the world come from `src/__tests__/contracts/badRequestTable.ts`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeError,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../helpers/fakeSupabase";
import {
  CALLER,
  CLUB_ID,
  EVENT_OWN,
  EVENT_PENDING,
  PERSONAS,
  elevatedInit,
  withContainsAndNot,
  type PersonaName,
} from "../contracts/badRequestTable";

type Client = FakeSupabase["client"];

let mockCookieClient: Client;
let mockElevatedClient: Client;
const getSession = jest.fn();
const signInWithOAuth = jest.fn();

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

jest.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () => undefined,
      getAll: () => [],
      set: () => undefined,
      delete: () => undefined,
    }),
}));

const ENV = process.env as Record<string, string | undefined>;
const ORIGINAL_ENV = process.env;
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
  getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  signInWithOAuth.mockReset().mockResolvedValue({
    data: { provider: "azure", url: "http://supabase.test/auth/v1/authorize" },
    error: null,
  });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

// ─── Rows ──────────────────────────────────────────────────────────────────

const S = (n: number) => `SENTINEL-${n}`;
const pg = (n: number): FakeError => ({ code: "XX000", message: S(n) });

interface Site {
  /** "src/app/…/route.ts:<line>" as the census printed it at f550de9. */
  site: string;
  n: number;
  persona: PersonaName | "anonymous";
  invoke(): Promise<Response | undefined>;
  /** Edits to the cookie fake's init (errors, throwOn, rows). */
  cookie?: (init: FakeSupabaseInit) => void;
  elevated?: (init: FakeSupabaseInit) => void;
  wrapCookie?: (client: Client) => Client;
  wrapElevated?: (client: Client) => Client;
  /** Installs a throw outside the fakes; restored by afterEach. */
  before?: () => void;
  /** Where in the body the sentinel must appear (default: anywhere). */
  at?: (body: any) => unknown;
  status: number;
}

const BASE = "http://localhost:3000/api";
const get = (path: string) => new NextRequest(`${BASE}/${path}`);
const send = (path: string, method: string, body?: unknown) =>
  new NextRequest(`${BASE}/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
const idOf = (id: string) => ({ params: Promise.resolve({ id }) });
const health = async () => (await import("@/app/api/health/route")).GET();

const CREATE = {
  title: "Error Text Night",
  description: "An evening of errors",
  start_date: "2030-06-01T18:00:00Z",
  location: "Leacock 132",
  tags: ["academic"],
};

const SITES: Site[] = [
  {
    site: "src/app/api/admin/calculate-popularity/route.ts:108", n: 1, persona: "admin", status: 200,
    elevated: (i) => { i.rpc = { ...i.rpc, update_event_popularity: { data: null, error: pg(1) } }; },
    invoke: async () =>
      (await import("@/app/api/admin/calculate-popularity/route")).POST(
        send(`admin/calculate-popularity?event_id=${EVENT_OWN}`, "POST")
      ),
  },
  {
    site: "src/app/api/admin/calculate-popularity/route.ts:118", n: 2, persona: "admin", status: 200,
    wrapElevated: (c) => ({ ...c, from: (t) => c.from(t), rpc: () => { throw new Error(S(2)); } }),
    invoke: async () =>
      (await import("@/app/api/admin/calculate-popularity/route")).POST(
        send(`admin/calculate-popularity?event_id=${EVENT_OWN}`, "POST")
      ),
  },
  {
    site: "src/app/api/calendar/events/route.ts:67", n: 4, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(4) }; },
    invoke: async () => (await import("@/app/api/calendar/events/route")).GET(get("calendar/events")),
  },
  {
    site: "src/app/api/clubs/[id]/appeal/route.ts:72", n: 5, persona: "student", status: 500,
    cookie: (i) => {
      i.tables!.clubs = [{ id: CLUB_ID, name: "Club", status: "rejected", created_by: CALLER.id, appeal_count: 0 }];
      i.errors = { "moderation_reviews.insert": pg(5) };
    },
    invoke: async () =>
      (await import("@/app/api/clubs/[id]/appeal/route")).POST(
        send(`clubs/${CLUB_ID}/appeal`, "POST", { message: "please" }),
        idOf(CLUB_ID)
      ),
  },
  {
    site: "src/app/api/clubs/featured/route.ts:17", n: 6, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { featured_clubs: pg(6) }; },
    invoke: async () => (await import("@/app/api/clubs/featured/route")).GET(),
  },
  {
    site: "src/app/api/events/[id]/appeal/route.ts:77", n: 7, persona: "student", status: 500,
    elevated: (i) => { i.tables!.events = i.tables!.events.map((e) => (e.id === EVENT_OWN ? { ...e, status: "rejected" } : e)); },
    cookie: (i) => { i.errors = { "moderation_reviews.insert": pg(7) }; },
    invoke: async () =>
      (await import("@/app/api/events/[id]/appeal/route")).POST(
        send(`events/${EVENT_OWN}/appeal`, "POST", { message: "please" }),
        idOf(EVENT_OWN)
      ),
  },
  {
    site: "src/app/api/events/[id]/report/route.ts:73", n: 8, persona: "student", status: 500,
    cookie: (i) => {
      i.tables!.events = i.tables!.events.map((e) => (e.id === EVENT_PENDING ? { ...e, status: "approved" } : e));
      i.errors = { "event_reports.insert": pg(8) };
    },
    invoke: async () =>
      (await import("@/app/api/events/[id]/report/route")).POST(
        send(`events/${EVENT_PENDING}/report`, "POST", { category: "other" }),
        idOf(EVENT_PENDING)
      ),
  },
  {
    site: "src/app/api/events/[id]/route.ts:106", n: 9, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(9) }; },
    invoke: async () =>
      (await import("@/app/api/events/[id]/route")).GET(get(`events/${EVENT_OWN}`), idOf(EVENT_OWN)),
  },
  {
    site: "src/app/api/events/[id]/route.ts:331", n: 10, persona: "owner", status: 500,
    cookie: (i) => { i.errors = { "events.update": pg(10) }; },
    invoke: async () =>
      (await import("@/app/api/events/[id]/route")).PATCH(
        send(`events/${EVENT_OWN}`, "PATCH", { description: "new" }),
        idOf(EVENT_OWN)
      ),
  },
  {
    site: "src/app/api/events/[id]/route.ts:401", n: 11, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "events.update": pg(11) }; },
    invoke: async () =>
      (await import("@/app/api/events/[id]/route")).DELETE(send(`events/${EVENT_OWN}`, "DELETE"), idOf(EVENT_OWN)),
  },
  {
    site: "src/app/api/events/create/route.ts:196", n: 12, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "events.insert": pg(12) }; },
    invoke: async () => (await import("@/app/api/events/create/route")).POST(send("events/create", "POST", CREATE)),
  },
  {
    site: "src/app/api/events/export/route.ts:211", n: 13, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(13) }; },
    invoke: async () => (await import("@/app/api/events/export/route")).GET(get("events/export?format=csv")),
  },
  {
    site: "src/app/api/events/featured/route.ts:17", n: 14, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { featured_events: pg(14) }; },
    invoke: async () => (await import("@/app/api/events/featured/route")).GET(),
  },
  {
    site: "src/app/api/events/happening-now/route.ts:40", n: 15, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(15) }; },
    wrapCookie: withContainsAndNot,
    invoke: async () => (await import("@/app/api/events/happening-now/route")).GET(),
  },
  {
    site: "src/app/api/events/happening-now/route.ts:51", n: 16, persona: "anonymous", status: 500,
    cookie: (i) => { i.throwOn = { events: S(16) }; },
    invoke: async () => (await import("@/app/api/events/happening-now/route")).GET(),
  },
  {
    site: "src/app/api/events/my-events/route.ts:24", n: 17, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(17) }; },
    invoke: async () => (await import("@/app/api/events/my-events/route")).GET(),
  },
  {
    site: "src/app/api/events/route.ts:448", n: 18, persona: "anonymous", status: 500,
    cookie: (i) => { i.errors = { "events.select": pg(18) }; },
    invoke: async () => (await import("@/app/api/events/route")).GET(get("events")),
  },
  {
    site: "src/app/api/health/route.ts:118", n: 19, persona: "anonymous", status: 503,
    cookie: (i) => { i.errors = { "events.select": pg(19) }; },
    at: (b) => b.checks.database.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:143", n: 20, persona: "anonymous", status: 503,
    cookie: (i) => { i.throwOn = { events: S(20) }; },
    at: (b) => b.checks.database.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:167", n: 21, persona: "anonymous", status: 503,
    before: () => getSession.mockResolvedValue({ data: { session: null }, error: { message: S(21) } }),
    at: (b) => b.checks.supabase_auth.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:181", n: 22, persona: "anonymous", status: 503,
    before: () => getSession.mockRejectedValue(new Error(S(22))),
    at: (b) => b.checks.supabase_auth.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:211", n: 23, persona: "anonymous", status: 503,
    before: () => signInWithOAuth.mockResolvedValue({ data: { provider: "azure", url: null }, error: { message: S(23) } }),
    at: (b) => b.checks.azure_oauth.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:214", n: 24, persona: "anonymous", status: 503,
    before: () => signInWithOAuth.mockResolvedValue({ data: { provider: "azure", url: null }, error: { message: S(24) } }),
    at: (b) => b.checks.azure_oauth.details.error,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:247", n: 25, persona: "anonymous", status: 503,
    before: () => signInWithOAuth.mockRejectedValue(new Error(S(25))),
    at: (b) => b.checks.azure_oauth.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:322", n: 26, persona: "anonymous", status: 200,
    before: () => {
      jest.spyOn(process, "memoryUsage").mockImplementation(() => {
        throw new Error(S(26));
      });
    },
    at: (b) => b.checks.memory.message,
    invoke: health,
  },
  {
    site: "src/app/api/health/route.ts:383", n: 27, persona: "anonymous", status: 503,
    before: () => {
      process.env = new Proxy(ORIGINAL_ENV, {
        get(target, key, receiver) {
          if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") throw new Error(S(27));
          return Reflect.get(target, key, receiver);
        },
      });
    },
    at: (b) => b.error,
    invoke: health,
  },
  {
    site: "src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts:55", n: 28, persona: "admin", status: 500,
    cookie: (i) => { i.errors = { "moderation_reviews.select": pg(28) }; },
    invoke: async () =>
      (await import("@/app/api/moderation/reviews/[targetType]/[targetId]/route")).GET(
        get(`moderation/reviews/event/${EVENT_OWN}`),
        { params: Promise.resolve({ targetType: "event", targetId: EVENT_OWN }) }
      ),
  },
  {
    site: "src/app/api/notifications/[id]/route.ts:32", n: 29, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "notifications.update": pg(29) }; },
    invoke: async () =>
      (await import("@/app/api/notifications/[id]/route")).PATCH(
        send(`notifications/${EVENT_OWN}`, "PATCH"),
        idOf(EVENT_OWN)
      ),
  },
  {
    site: "src/app/api/notifications/route.ts:51", n: 30, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "notifications.select": pg(30) }; },
    invoke: async () => (await import("@/app/api/notifications/route")).GET(get("notifications")),
  },
  {
    site: "src/app/api/notifications/route.ts:104", n: 31, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "notifications.update": pg(31) }; },
    invoke: async () =>
      (await import("@/app/api/notifications/route")).POST(send("notifications?action=mark-all-read", "POST")),
  },
  {
    site: "src/app/api/organizer-requests/route.ts:59", n: 32, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "organizer_requests.insert": pg(32) }; },
    invoke: async () =>
      (await import("@/app/api/organizer-requests/route")).POST(
        send("organizer-requests", "POST", { club_id: CLUB_ID })
      ),
  },
  {
    site: "src/app/api/organizer-requests/route.ts:84", n: 33, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "organizer_requests.select": pg(33) }; },
    invoke: async () => (await import("@/app/api/organizer-requests/route")).GET(),
  },
  {
    site: "src/app/api/recommendations/batch/route.ts:25", n: 34, persona: "admin", status: 500,
    elevated: (i) => { i.rpc = { ...i.rpc, compute_user_scores: { data: null, error: pg(34) } }; },
    invoke: async () => (await import("@/app/api/recommendations/batch/route")).POST(),
  },
  {
    site: "src/app/api/user/following/route.ts:45", n: 35, persona: "student", status: 500,
    cookie: (i) => { i.errors = { "club_followers.select": pg(35) }; },
    invoke: async () => (await import("@/app/api/user/following/route")).GET(),
  },
];

/** Census C7 lines that are not a response body reachable through this fake. */
const NOT_DRIVEN: Record<string, string> = {
  "src/app/api/admin/events/[id]/status/route.ts:244":
    "not caught-error text: row.message is the moderation message the admin typed, copied into the creator's notification row; it never reaches a response",
  "src/app/auth/callback/route.ts:127": "a console.error log line, not a response",
  "src/app/auth/callback/route.ts:129":
    "reaches the caller in the redirect Location's `message` query, not a JSON body, and the callback builds its client with @supabase/ssr, not this fake; pinned today by the PRESERVE assertion src/app/auth/callback/route.test.ts:269 (`message` = the provider text), which F-059's fix must move",
  "src/app/auth/callback/route.ts:141": "a console.error log line, not a response",
  "src/app/auth/callback/route.ts:204":
    "thrown into the handler's own catch, which logs it and redirects to /?error=profile_sync_failed with no text",
  "src/app/auth/callback/route.ts:216":
    "thrown into the handler's own catch, which logs it and redirects to /?error=profile_sync_failed with no text",
};

/**
 * Fixed sites (F-059 fixed for the site, DEC-75): the route's generic text
 * now stands where the sentinel was. `at` reads it; the whole body must not
 * contain the sentinel. One defect-ledger row per moved row.
 */
const FIXED: Readonly<Record<string, { at: (body: any) => unknown; generic: unknown }>> = {
  // 06-13 Task 1: admin and moderation
  "src/app/api/admin/calculate-popularity/route.ts:108": {
    at: (b) => b.results.errors,
    generic: [{ event_id: EVENT_OWN, error: "Failed to update popularity" }],
  },
  "src/app/api/admin/calculate-popularity/route.ts:118": {
    at: (b) => b.results.errors,
    generic: [{ event_id: EVENT_OWN, error: "Failed to update popularity" }],
  },
  "src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts:55": {
    at: (b) => b,
    generic: { error: "Failed to fetch moderation reviews" },
  },
  // 06-13 Task 2: clubs and organizer-requests
  "src/app/api/clubs/[id]/appeal/route.ts:72": {
    at: (b) => b,
    generic: { error: "Failed to submit appeal" },
  },
  "src/app/api/clubs/featured/route.ts:17": {
    at: (b) => b,
    generic: { error: "Failed to fetch featured clubs" },
  },
  "src/app/api/organizer-requests/route.ts:59": {
    at: (b) => b,
    generic: { error: "Failed to create organizer request" },
  },
  "src/app/api/organizer-requests/route.ts:84": {
    at: (b) => b,
    generic: { error: "Failed to fetch organizer requests" },
  },
  // 06-14 Task 1: events and calendar
  "src/app/api/calendar/events/route.ts:67": {
    at: (b) => b,
    generic: { error: "Failed to fetch calendar events" },
  },
  "src/app/api/events/[id]/appeal/route.ts:77": {
    at: (b) => b,
    generic: { error: "Failed to submit appeal" },
  },
  "src/app/api/events/[id]/report/route.ts:73": {
    at: (b) => b,
    generic: { error: "Failed to report event" },
  },
  "src/app/api/events/[id]/route.ts:106": {
    at: (b) => b,
    generic: { error: "Failed to fetch event" },
  },
  "src/app/api/events/[id]/route.ts:331": {
    at: (b) => b,
    generic: { error: "Failed to update event" },
  },
  "src/app/api/events/[id]/route.ts:401": {
    at: (b) => b,
    generic: { error: "Failed to delete event" },
  },
  "src/app/api/events/create/route.ts:196": {
    at: (b) => b,
    generic: { error: "Failed to create event" },
  },
  "src/app/api/events/export/route.ts:211": {
    at: (b) => b,
    generic: { error: "Failed to generate export" },
  },
  "src/app/api/events/featured/route.ts:17": {
    at: (b) => b,
    generic: { error: "Failed to fetch featured events" },
  },
  "src/app/api/events/happening-now/route.ts:40": {
    at: (b) => b,
    generic: { error: "Failed to fetch happening now events" },
  },
  "src/app/api/events/happening-now/route.ts:51": {
    at: (b) => b,
    generic: { error: "Failed to fetch happening now events" },
  },
  "src/app/api/events/my-events/route.ts:24": {
    at: (b) => b,
    generic: { error: "Failed to fetch your events" },
  },
  "src/app/api/events/route.ts:448": {
    at: (b) => b,
    generic: { error: "Failed to fetch events" },
  },
  // 06-14 Task 2: notifications, recommendations/batch, user/following
  "src/app/api/notifications/[id]/route.ts:32": {
    at: (b) => b,
    generic: { error: "Failed to update notification" },
  },
  "src/app/api/notifications/route.ts:51": {
    at: (b) => b,
    generic: { error: "Failed to fetch notifications" },
  },
  "src/app/api/notifications/route.ts:104": {
    at: (b) => b,
    generic: { error: "Failed to update notifications" },
  },
  "src/app/api/recommendations/batch/route.ts:25": {
    at: (b) => b,
    generic: { error: "Batch scoring failed" },
  },
  "src/app/api/user/following/route.ts:45": {
    at: (b) => b,
    generic: { error: "Failed to fetch followed clubs" },
  },
};

/**
 * Sites outside census C7 that a sweep fixed, pinned in E2 like a moved row:
 * the `updateError.message` 500s, which C7's `dateError.message` exclusion
 * skipped by substring. The site label is the line at the base of 06-13.
 */
const ADDED: { row: Site; at: (body: any) => unknown; generic: unknown }[] = [
  {
    row: {
      site: "src/app/api/clubs/[id]/appeal/route.ts:83", n: 36, persona: "student", status: 500,
      cookie: (i) => {
        i.tables!.clubs = [{ id: CLUB_ID, name: "Club", status: "rejected", created_by: CALLER.id, appeal_count: 0 }];
      },
      elevated: (i) => { i.errors = { ...(i.errors ?? {}), "clubs.update": pg(36) }; },
      invoke: async () =>
        (await import("@/app/api/clubs/[id]/appeal/route")).POST(
          send(`clubs/${CLUB_ID}/appeal`, "POST", { message: "please" }),
          idOf(CLUB_ID)
        ),
    },
    at: (b) => b,
    generic: { error: "Failed to submit appeal" },
  },
  // 06-14 Task 1: the events appeal's status-reset error (line 88 at the
  // base of 06-14), on the cookie client's events update.
  {
    row: {
      site: "src/app/api/events/[id]/appeal/route.ts:88", n: 37, persona: "student", status: 500,
      elevated: (i) => { i.tables!.events = i.tables!.events.map((e) => (e.id === EVENT_OWN ? { ...e, status: "rejected" } : e)); },
      cookie: (i) => { i.errors = { "events.update": pg(37) }; },
      invoke: async () =>
        (await import("@/app/api/events/[id]/appeal/route")).POST(
          send(`events/${EVENT_OWN}/appeal`, "POST", { message: "please" }),
          idOf(EVENT_OWN)
        ),
    },
    at: (b) => b,
    generic: { error: "Failed to submit appeal" },
  },
];

/** NOT_DRIVEN lines the sweep rewrote so that no `.message` token remains. */
const RETIRED: Record<string, string> = {
  "src/app/api/admin/events/[id]/status/route.ts:244":
    "06-13: the notification copy reads `const { title, message } = row`, so the line no longer carries a `.message` token (no behaviour change; it was never a response)",
  // 06-14 Task 2: the callback's log lines and internal throws. Its :129
  // redirect `message` stays live: the PRESERVE callback suite pins it and
  // 06-14 changes only the callback's logging and wrapper.
  "src/app/auth/callback/route.ts:127":
    "06-14: the code-exchange log line is log.error(msg, { scope, error }); the logger reduces the error to { name, message, code }",
  "src/app/auth/callback/route.ts:141":
    "06-14: the get-user log line is log.error(msg, { scope, error })",
  "src/app/auth/callback/route.ts:204":
    "06-14: the upsert error is logged as a field and the internal throw reads \"profile upsert failed\"; the redirect to /?error=profile_sync_failed is unchanged",
  "src/app/auth/callback/route.ts:216":
    "06-14: the read error is logged as a field and the internal throw reads \"profile read failed\"; the redirect to /?error=profile_sync_failed is unchanged",
};

const LIVE_SITES = SITES.filter((row) => !(row.site in FIXED));
const FIXED_SITES: [string, Site, { at: (body: any) => unknown; generic: unknown }][] = [
  ...SITES.filter((row) => row.site in FIXED).map(
    (row): [string, Site, (typeof FIXED)[string]] => [row.site, row, FIXED[row.site]]
  ),
  ...ADDED.map(
    ({ row, at, generic }): [string, Site, (typeof FIXED)[string]] => [row.site, row, { at, generic }]
  ),
];
const LIVE_NOT_DRIVEN = Object.keys(NOT_DRIVEN).filter((site) => !(site in RETIRED));

// ─── Running a row ─────────────────────────────────────────────────────────

function withHealthAuth(client: Client): Client {
  return {
    from: (table) => client.from(table),
    rpc: (name, args) => client.rpc(name, args),
    auth: Object.assign({}, client.auth, { getSession, signInWithOAuth }),
  };
}

async function drive(row: Site): Promise<{ status: number; body: unknown }> {
  const persona: PersonaName = row.persona === "anonymous" ? "student" : row.persona;
  const cookieInit = PERSONAS[persona]();
  if (row.persona === "anonymous") cookieInit.user = null;
  row.cookie?.(cookieInit);
  const elevated = elevatedInit(persona);
  row.elevated?.(elevated);
  let cookieClient = withHealthAuth(createFakeSupabase(cookieInit).client);
  if (row.wrapCookie) cookieClient = row.wrapCookie(cookieClient);
  let elevatedClient = createFakeSupabase(elevated).client;
  if (row.wrapElevated) elevatedClient = row.wrapElevated(elevatedClient);
  mockCookieClient = cookieClient;
  mockElevatedClient = elevatedClient;
  row.before?.();
  const response = await row.invoke();
  if (!response) throw new Error(`${row.site}: no response`);
  const status = response.status;
  const body: unknown = await response.json();
  process.env = ORIGINAL_ENV;
  return { status, body };
}

// ─── E0: the rows are census C7 ────────────────────────────────────────────

const APP = join(process.cwd(), "src", "app");

function censusC7(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of readdirSync(APP, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const path = join(entry.parentPath, entry.name);
    const file = relative(process.cwd(), path).split(sep).join("/");
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (/\.message\b/.test(line) && !line.includes("dateError.message")) {
        counts[file] = (counts[file] ?? 0) + 1;
      }
    }
  }
  return counts;
}

describe("E0: the rows plus NOT_DRIVEN are census C7", () => {
  it("file by file, the live driven rows plus the live NOT_DRIVEN lines are the census", () => {
    const listed: Record<string, number> = {};
    for (const site of [...LIVE_SITES.map((row) => row.site), ...LIVE_NOT_DRIVEN]) {
      const file = site.replace(/:\d+$/, "");
      listed[file] = (listed[file] ?? 0) + 1;
    }
    expect(listed).toEqual(censusC7());
    expect(LIVE_SITES).toHaveLength(9);
    expect(LIVE_NOT_DRIVEN).toHaveLength(1);
    expect(FIXED_SITES).toHaveLength(27);
  });

  it("the census at f550de9 is unchanged: 34 driven + 6 listed = 40, and every move is accounted for", () => {
    expect(SITES).toHaveLength(34);
    expect(Object.keys(NOT_DRIVEN)).toHaveLength(6);
    expect(new Set(SITES.map((row) => row.site)).size).toBe(34);
    for (const site of Object.keys(FIXED)) {
      expect(SITES.some((row) => row.site === site)).toBe(true);
    }
    for (const site of Object.keys(RETIRED)) expect(site in NOT_DRIVEN).toBe(true);
    expect(LIVE_SITES.length + Object.keys(FIXED).length).toBe(34);
  });
});

// ─── E1: the sentinel reaches the caller ───────────────────────────────────

describe("E1: a caught error's text reaches the response body today", () => {
  it.each(LIVE_SITES.map((row): [string, Site] => [row.site, row]))("%s", async (_label, row) => {
    const { status, body } = await drive(row);
    expect(status).toBe(row.status);
    const where = row.at ? row.at(body) : body;
    expect(JSON.stringify(where)).toContain(S(row.n));
  });
});

// ─── E2: fixed, the generic text instead of the sentinel ──────────────────

describe("E2: fixed, the caller gets the route's generic text (F-059 fixed)", () => {
  it.each(FIXED_SITES)("%s", async (_label, row, fix) => {
    const { status, body } = await drive(row);
    expect(status).toBe(row.status);
    expect(JSON.stringify(body)).not.toContain(S(row.n));
    expect(fix.at(body)).toEqual(fix.generic);
  });
});
