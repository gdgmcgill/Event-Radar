/**
 * DEFECT characterization — F-094: the slice-7 parse sites read input by hand
 * with no schema (plan 06-07 pins it; plans 06-08, 06-09 and 06-10 fix it,
 * REFAC-15, DEC-65)
 *
 * Every value below was measured on the UNMODIFIED handlers at f550de9 with a
 * temporary harness first (the run is in the phase evidence
 * `slice-7-characterization.txt`) and is pinned exactly as measured. It is
 * today's KNOWN-WRONG behaviour. When a route adopts `parseBody` with its
 * contract, its rows here MOVE (not-JSON to 400 `Invalid JSON body`, an array
 * to 400 `Request body must be a JSON object`, a wrongly typed field to the
 * contract's 400), each move with a defect-ledger row citing F-094. A row
 * that does not move when its route adopts a contract means the contract
 * kept the defect.
 *
 * What is pinned:
 *   - D0 the site lists are the tree: `RAW_SITES` equals every raw
 *     `request.json()` in a route file (18 sites, 17 files at 06-07; 12 sites,
 *     12 files after 06-08), and `RJO_SITES` equals every route file calling
 *     `readJsonObject` (15 at 06-07; 13 after 06-08). A route that
 *     adopts `parseBody` leaves a list, so D0 goes red on the fix commit;
 *     that red is expected and is resolved by moving the site's rows;
 *   - D1 each raw site, a body that is not JSON: the route's generic 500
 *     (caught), a 400 (the three sites with their own catch), or a rejected
 *     handler promise with no JSON body at all (4 sites with no outer try,
 *     which Next answers with an HTML 500, F-058);
 *   - D2 each raw site, a JSON array `[1,2]`: the route's first "missing"
 *     400, or, at `admin/experiments/[id]` PATCH and `admin/events/[id]` PUT,
 *     a 200 that performs the update with nothing but `updated_at`;
 *   - D3 each raw and each readJsonObject site, a number in a field the
 *     handler trims, sanitizes or compares: refused by a ladder rule, or
 *     written as-is (a numeric experiment name and status, a numeric event
 *     title, a numeric pending edit), or coerced to a string by
 *     `sanitizeText` ("5"), or a rejected promise from `.trim()` on a number
 *     at the four sites with no outer try (F-058). The write list is pinned
 *     on every row, so a refusal is also proven to write nothing.
 *
 * MOVED (plan 06-08, F-094, INTENTIONAL BEHAVIOUR CHANGE). The events family
 * adopted `parseBody` with src/contracts/events.ts: its six raw sites left
 * `RAW_SITES` for `ADOPTED_RAW_SITES` and its two readJsonObject files left
 * `RJO_SITES` for `ADOPTED_RJO_SITES`. At those sites a body that is not JSON
 * now answers 400 `Invalid JSON body` (events/[id]/rsvp DELETE read it as {}),
 * an array 400 `Request body must be a JSON object`, and a numeric create
 * title, edit title or appeal message the contract's 400. The rows already
 * refused by a ladder rule (invite, rsvp status, rsvp DELETE's 403, reviews,
 * report) keep their outcome, now from the contract. Each moved row has a
 * defect-ledger row.
 *
 * Personas and the world come from `badRequestTable.ts` (student, owner of
 * the club and creator of the approved event, admin). Seams as in the
 * sibling `bad-request-characterization.test.ts`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../helpers/fakeSupabase";
import {
  CALLER,
  CLUB_ID,
  EVENT_OWN,
  EVENT_PENDING,
  EXPERIMENT_ID,
  FEATURED_ID,
  MEMBER_ORGANIZER,
  OTHER_USER_ID,
  PERSONAS,
  REPORT_ID,
  REQUEST_ID,
  elevatedInit,
  run,
  type PersonaName,
  type Verb,
} from "./badRequestTable";

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

// ─── The sites ─────────────────────────────────────────────────────────────

interface Site {
  route: string;
  verb: Verb;
  persona: PersonaName;
  params?: Record<string, string>;
}

const club = { id: CLUB_ID };
const ev = { id: EVENT_OWN };

/** Every raw `await request.json()` in a route file today (12 sites). */
const RAW_SITES: Record<string, Site> = {
  "clubs/[id] PATCH": { route: "clubs/[id]", verb: "PATCH", persona: "owner", params: club },
  "clubs/[id]/members DELETE": { route: "clubs/[id]/members", verb: "DELETE", persona: "owner", params: club },
  "clubs/[id]/invites POST": { route: "clubs/[id]/invites", verb: "POST", persona: "owner", params: club },
  "admin/experiments/[id] PATCH": { route: "admin/experiments/[id]", verb: "PATCH", persona: "admin", params: { id: EXPERIMENT_ID } },
  "admin/experiments POST": { route: "admin/experiments", verb: "POST", persona: "admin" },
  "admin/featured POST": { route: "admin/featured", verb: "POST", persona: "admin" },
  "admin/events POST": { route: "admin/events", verb: "POST", persona: "admin" },
  "admin/featured/[id] PATCH": { route: "admin/featured/[id]", verb: "PATCH", persona: "admin", params: { id: FEATURED_ID } },
  "admin/events/[id] PUT": { route: "admin/events/[id]", verb: "PUT", persona: "admin", params: ev },
  "profile/interests PUT": { route: "profile/interests", verb: "PUT", persona: "student" },
  "profile/inferred-tags DELETE": { route: "profile/inferred-tags", verb: "DELETE", persona: "student" },
  "users/[id] PATCH": { route: "users/[id]", verb: "PATCH", persona: "student", params: { id: CALLER.id } },
};

/** The raw sites that adopted `parseBody` in plan 06-08 (F-094 fixed there). */
const ADOPTED_RAW_SITES: Record<string, Site> = {
  "events/[id]/invite POST": { route: "events/[id]/invite", verb: "POST", persona: "student", params: ev },
  "events/[id] PATCH": { route: "events/[id]", verb: "PATCH", persona: "owner", params: ev },
  "events/[id]/rsvp POST": { route: "events/[id]/rsvp", verb: "POST", persona: "student", params: ev },
  "events/[id]/rsvp DELETE": { route: "events/[id]/rsvp", verb: "DELETE", persona: "student", params: ev },
  "events/[id]/reviews POST": { route: "events/[id]/reviews", verb: "POST", persona: "student", params: ev },
  "events/create POST": { route: "events/create", verb: "POST", persona: "student" },
};

/** Every route file that reads its body through `readJsonObject` today (13). */
const RJO_SITES: Record<string, Site> = {
  "admin/clubs/[id] PATCH": { route: "admin/clubs/[id]", verb: "PATCH", persona: "admin", params: club },
  "admin/events/[id]/edits PATCH": { route: "admin/events/[id]/edits", verb: "PATCH", persona: "admin", params: ev },
  "admin/events/[id]/status PATCH": { route: "admin/events/[id]/status", verb: "PATCH", persona: "admin", params: { id: EVENT_PENDING } },
  "admin/organizer-requests/[id] PATCH": { route: "admin/organizer-requests/[id]", verb: "PATCH", persona: "admin", params: { id: REQUEST_ID } },
  "admin/reports/[id] PATCH": { route: "admin/reports/[id]", verb: "PATCH", persona: "admin", params: { id: REPORT_ID } },
  "admin/users/[id]/ban POST": { route: "admin/users/[id]/ban", verb: "POST", persona: "admin", params: { id: OTHER_USER_ID } },
  "admin/users/[id] PATCH": { route: "admin/users/[id]", verb: "PATCH", persona: "admin", params: { id: OTHER_USER_ID } },
  "clubs/[id]/appeal POST": { route: "clubs/[id]/appeal", verb: "POST", persona: "student", params: club },
  "clubs/[id]/members/role PATCH": { route: "clubs/[id]/members/role", verb: "PATCH", persona: "owner", params: club },
  "clubs/[id] DELETE": { route: "clubs/[id]", verb: "DELETE", persona: "owner", params: club },
  "clubs/[id]/transfer POST": { route: "clubs/[id]/transfer", verb: "POST", persona: "owner", params: club },
  "clubs POST": { route: "clubs", verb: "POST", persona: "student" },
  "organizer-requests POST": { route: "organizer-requests", verb: "POST", persona: "student" },
};

/** The readJsonObject files that adopted `parseBody` in plan 06-08. */
const ADOPTED_RJO_SITES: Record<string, Site> = {
  "events/[id]/appeal POST": { route: "events/[id]/appeal", verb: "POST", persona: "student", params: ev },
  "events/[id]/report POST": { route: "events/[id]/report", verb: "POST", persona: "student", params: ev },
};

// ─── Expected outcomes (measured) ──────────────────────────────────────────

/**
 * What a row pins. `body` is compared with toEqual; `bodyMatch` with
 * toMatchObject (2xx bodies carry wall-clock timestamps); `threw` is the
 * rejected promise's message; `writes` is every non-select call on both
 * fakes, in order.
 */
interface Expected {
  status: number | "threw";
  body?: unknown;
  bodyMatch?: Record<string, unknown>;
  threw?: RegExp;
  writes: string[];
}

const err = (status: number, error: string, field?: string): Expected => ({
  status,
  body: field === undefined ? { error } : { error, field },
  writes: [],
});

const SYNTAX = /JSON/;
const TRIM = /trim is not a function/;

/** D1: the body `{not json`. */
const NOT_JSON: Record<string, Expected> = {
  "clubs/[id] PATCH": err(500, "Failed to update club"),
  "clubs/[id]/members DELETE": err(500, "Failed to remove member"),
  "clubs/[id]/invites POST": err(500, "Failed to create invitation"),
  "admin/experiments/[id] PATCH": { status: "threw", threw: SYNTAX, writes: [] },
  "admin/experiments POST": { status: "threw", threw: SYNTAX, writes: [] },
  "admin/featured POST": err(500, "Failed to create featured event"),
  "admin/events POST": { status: "threw", threw: SYNTAX, writes: [] },
  "admin/featured/[id] PATCH": err(500, "Failed to update featured event"),
  "admin/events/[id] PUT": { status: "threw", threw: SYNTAX, writes: [] },
  "profile/interests PUT": err(500, "Internal server error"),
  "profile/inferred-tags DELETE": err(500, "Internal server error"),
  "users/[id] PATCH": err(500, "Internal server error"),
  // Moved in 06-08 (F-094): 500 "Failed to send invites", 500 "Failed to
  // update event", 400 "user_id is required" (DELETE read it as {}) and 500
  // "Failed to create event" became parseBody's 400. rsvp POST and reviews
  // already answered these bytes from their own catch.
  "events/[id]/invite POST": err(400, "Invalid JSON body"),
  "events/[id] PATCH": err(400, "Invalid JSON body"),
  "events/[id]/rsvp POST": err(400, "Invalid JSON body"),
  "events/[id]/rsvp DELETE": err(400, "Invalid JSON body"),
  "events/[id]/reviews POST": err(400, "Invalid JSON body"),
  "events/create POST": err(400, "Invalid JSON body"),
};

/** D2: the body `[1,2]`. */
const ARRAY: Record<string, Expected> = {
  "clubs/[id] PATCH": err(400, "No valid fields to update"),
  "clubs/[id]/members DELETE": err(400, "memberId is required"),
  "clubs/[id]/invites POST": err(400, "Email is required"),
  "admin/experiments/[id] PATCH": {
    status: 200,
    bodyMatch: { experiment: { id: EXPERIMENT_ID, status: "running" } },
    writes: ["experiments.update"],
  },
  "admin/experiments POST": err(400, "name is required"),
  "admin/featured POST": err(400, "event_id, starts_at, and ends_at are required"),
  "admin/events POST": err(400, "title, start_date, and end_date are required"),
  "admin/featured/[id] PATCH": err(400, "No fields to update"),
  "admin/events/[id] PUT": {
    status: 200,
    bodyMatch: { event: { id: EVENT_OWN, title: "Bad Request Event" } },
    writes: ["events.update", "admin_audit_log.insert"],
  },
  "profile/interests PUT": err(400, "interest_tags must be an array"),
  "profile/inferred-tags DELETE": err(400, "tag is required and must be a string"),
  "users/[id] PATCH": err(400, "No fields to update"),
  // Moved in 06-08 (F-094): each answered its first "missing" 400 (an array
  // read as an object with no keys); parseBody now refuses the array itself.
  "events/[id]/invite POST": err(400, "Request body must be a JSON object"),
  "events/[id] PATCH": err(400, "Request body must be a JSON object"),
  "events/[id]/rsvp POST": err(400, "Request body must be a JSON object"),
  "events/[id]/rsvp DELETE": err(400, "Request body must be a JSON object"),
  "events/[id]/reviews POST": err(400, "Request body must be a JSON object"),
  "events/create POST": err(400, "Request body must be a JSON object"),
};

const CREATE = {
  title: "Contract Night",
  description: "An evening of contracts",
  start_date: "2030-06-01T18:00:00Z",
  location: "Leacock 132",
  tags: ["academic"],
};

/** D3: a number where the handler trims, sanitizes or compares. */
const NON_STRING: Record<string, { body: Record<string, unknown>; expected: Expected }> = {
  // raw sites
  "clubs/[id] PATCH": { body: { name: 5 }, expected: err(400, "Invalid value for name", "name") },
  "clubs/[id]/members DELETE": { body: { memberId: 5 }, expected: err(404, "Member not found") },
  "clubs/[id]/invites POST": { body: { email: 5 }, expected: err(500, "Failed to create invitation") },
  "admin/experiments/[id] PATCH": {
    body: { status: 5 },
    expected: { status: 200, bodyMatch: { experiment: { status: 5 } }, writes: ["experiments.update"] },
  },
  "admin/experiments POST": {
    body: { name: 5, variants: [{ name: "a" }, { name: "b" }] },
    expected: {
      status: 201,
      bodyMatch: { experiment: { name: 5 } },
      writes: ["experiments.insert", "experiment_variants.insert"],
    },
  },
  "admin/featured POST": {
    body: { event_id: EVENT_OWN, starts_at: "2030-01-01", ends_at: "2030-01-02", sponsor_name: 5 },
    expected: {
      status: 201,
      bodyMatch: { featured: { sponsor_name: "5" } },
      writes: ["featured_events.insert", "admin_audit_log.insert"],
    },
  },
  "admin/events POST": {
    body: { title: 5, start_date: "2030-01-01", end_date: "2030-01-02" },
    expected: {
      status: 201,
      bodyMatch: { event: { title: "5" } },
      writes: ["events.insert", "admin_audit_log.insert"],
    },
  },
  "admin/featured/[id] PATCH": {
    body: { sponsor_name: 5 },
    expected: {
      status: 200,
      bodyMatch: { featured: { sponsor_name: "5" } },
      writes: ["featured_events.update", "admin_audit_log.insert"],
    },
  },
  "admin/events/[id] PUT": {
    body: { title: 5 },
    expected: {
      status: 200,
      bodyMatch: { event: { title: 5 } },
      writes: ["events.update", "admin_audit_log.insert"],
    },
  },
  "profile/interests PUT": { body: { interest_tags: [5] }, expected: err(400, "Invalid tag values provided") },
  "profile/inferred-tags DELETE": { body: { tag: 5 }, expected: err(400, "tag is required and must be a string") },
  "users/[id] PATCH": { body: { name: 5 }, expected: err(400, "Name must be between 2 and 50 characters long") },
  "events/[id]/invite POST": { body: { invitee_ids: 5 }, expected: err(400, "No invitees provided") },
  // Moved in 06-08 (F-094): was 200, the number written as a pending edit.
  "events/[id] PATCH": { body: { title: 5 }, expected: err(400, "Title must be a string") },
  "events/[id]/rsvp POST": {
    body: { user_id: CALLER.id, status: 5 },
    expected: err(400, "Invalid status. Must be one of: going, interested"),
  },
  "events/[id]/rsvp DELETE": { body: { user_id: 5 }, expected: err(403, "user_id does not match authenticated user") },
  "events/[id]/reviews POST": { body: { rating: "5" }, expected: err(400, "Rating must be an integer between 1 and 5") },
  // Moved in 06-08 (F-094): was 201 with the title coerced to "5".
  "events/create POST": { body: { ...CREATE, title: 5 }, expected: err(400, "Title is required") },

  // readJsonObject sites
  "admin/clubs/[id] PATCH": {
    body: { status: "rejected", category: "other", message: 5 },
    expected: { status: "threw", threw: TRIM, writes: [] },
  },
  "admin/events/[id]/edits PATCH": { body: { action: 5 }, expected: err(400, "action must be 'approve' or 'reject'") },
  "admin/events/[id]/status PATCH": {
    body: { status: "rejected", category: "other", message: 5 },
    expected: { status: "threw", threw: TRIM, writes: [] },
  },
  "admin/organizer-requests/[id] PATCH": { body: { status: 5 }, expected: err(400, "Status must be 'approved' or 'rejected'") },
  "admin/reports/[id] PATCH": { body: { status: 5 }, expected: err(400, "Invalid status") },
  "admin/users/[id]/ban POST": { body: { reason: 5 }, expected: err(400, "Reason is required") },
  "admin/users/[id] PATCH": {
    body: { name: 5 },
    expected: err(400, "Name must be between 2 and 50 characters long", "name"),
  },
  "clubs/[id]/appeal POST": { body: { message: 5 }, expected: { status: "threw", threw: TRIM, writes: [] } },
  "clubs/[id]/members/role PATCH": {
    body: { memberId: MEMBER_ORGANIZER, role: 5 },
    expected: err(400, "Invalid request. Role must be 'organizer'."),
  },
  "clubs/[id] DELETE": { body: { confirmName: 5 }, expected: err(400, "Club name confirmation does not match") },
  "clubs/[id]/transfer POST": { body: { newOwnerId: 5 }, expected: err(400, "Target user is not a member of this club") },
  // A numeric name passes the required check (sanitizeText coerces it to
  // "5"); the missing email is what answers.
  "clubs POST": {
    body: { name: 5, description: "We write schemas", category: "academic" },
    expected: err(400, "Contact email is required"),
  },
  // Moved in 06-08 (F-094): the handler threw on `.trim()` of a number.
  "events/[id]/appeal POST": { body: { message: 5 }, expected: err(400, "Appeal message is required") },
  "events/[id]/report POST": { body: { category: 5 }, expected: err(400, "Invalid category") },
  "organizer-requests POST": { body: { club_id: 5 }, expected: err(404, "Club not found") },
};

// ─── Running ───────────────────────────────────────────────────────────────

async function check(site: Site, input: { raw?: string; body?: unknown }, expected: Expected) {
  mockCookie = createFakeSupabase(PERSONAS[site.persona]());
  mockElevated = createFakeSupabase(elevatedInit(site.persona));
  const outcome = await run({ ...site, ...input });
  const writes = [...mockCookie.calls, ...mockElevated.calls]
    .filter((call) => call.operation !== "select")
    .map((call) => `${call.table}.${call.operation}`);

  expect(outcome.status).toBe(expected.status);
  if (expected.body !== undefined) expect(outcome.body).toEqual(expected.body);
  if (expected.bodyMatch !== undefined) expect(outcome.body).toMatchObject(expected.bodyMatch);
  if (expected.threw !== undefined) expect(String(outcome.body)).toMatch(expected.threw);
  expect(writes).toEqual(expected.writes);
}

// ─── D0: the site lists are the tree ───────────────────────────────────────

const API_DIR = join(process.cwd(), "src", "app", "api");

function routeFiles(): { route: string; source: string }[] {
  const out: { route: string; source: string }[] = [];
  for (const entry of readdirSync(API_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    out.push({
      route: relative(API_DIR, entry.parentPath).split(sep).join("/"),
      source: readFileSync(join(entry.parentPath, entry.name), "utf8"),
    });
  }
  return out;
}

describe("D0: the site lists are the tree", () => {
  it("RAW_SITES covers every raw request.json() in a route file (12 sites)", () => {
    const counted = routeFiles()
      .map(({ route, source }) => [route, (source.match(/(?:request|req)\.json\(\)/g) ?? []).length] as const)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const listed = Object.values(RAW_SITES).reduce<Record<string, number>>((acc, site) => {
      acc[site.route] = (acc[site.route] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.fromEntries(counted)).toEqual(listed);
    expect(Object.keys(RAW_SITES)).toHaveLength(12);
  });

  it("RJO_SITES is every route file calling readJsonObject (13)", () => {
    const files = routeFiles()
      .filter(({ source }) => source.includes("readJsonObject("))
      .map(({ route }) => route)
      .sort();
    expect([...new Set(Object.values(RJO_SITES).map((site) => site.route))].sort()).toEqual(files);
    expect(Object.keys(RJO_SITES)).toHaveLength(13);
  });

  it("the adopted sites read their body through parseBody and nothing raw (06-08)", () => {
    const sources = new Map(routeFiles().map(({ route, source }) => [route, source]));
    const adopted = [...new Set(
      Object.values({ ...ADOPTED_RAW_SITES, ...ADOPTED_RJO_SITES }).map((site) => site.route)
    )].sort();
    expect(adopted).toHaveLength(7);
    for (const route of adopted) {
      const source = sources.get(route) ?? "";
      expect([route, /parseBody\(request, /.test(source)]).toEqual([route, true]);
      expect([route, /(?:request|req)\.json\(\)|readJsonObject\(/.test(source)]).toEqual([route, false]);
    }
  });

  it("every site has a D3 row", () => {
    expect(Object.keys(NON_STRING).sort()).toEqual(
      [
        ...Object.keys(RAW_SITES),
        ...Object.keys(ADOPTED_RAW_SITES),
        ...Object.keys(RJO_SITES),
        ...Object.keys(ADOPTED_RJO_SITES),
      ].sort()
    );
  });
});

// ─── D1-D3 ─────────────────────────────────────────────────────────────────

describe("D1: each raw site, a body that is not JSON", () => {
  it.each(Object.entries({ ...RAW_SITES, ...ADOPTED_RAW_SITES }))("%s", async (key, site) => {
    await check(site, { raw: "{not json" }, NOT_JSON[key]);
  });
});

describe("D2: each raw site, a JSON array", () => {
  it.each(Object.entries({ ...RAW_SITES, ...ADOPTED_RAW_SITES }))("%s", async (key, site) => {
    await check(site, { raw: "[1,2]" }, ARRAY[key]);
  });
});

describe("D3: each raw and readJsonObject site, a number where a string is trimmed or compared", () => {
  it.each(
    Object.entries({ ...RAW_SITES, ...ADOPTED_RAW_SITES, ...RJO_SITES, ...ADOPTED_RJO_SITES })
  )("%s", async (key, site) => {
    const row = NON_STRING[key];
    await check(site, { body: row.body }, row.expected);
  });
});
