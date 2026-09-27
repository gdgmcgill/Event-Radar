/**
 * PRESERVE characterization — every slice-7 shape-400, in today's check order
 * (plan 06-07, REFAC-15)
 *
 * Written against the UNMODIFIED handlers at f550de9. Plans 06-08 (events),
 * 06-09 (clubs, users) and 06-10 (admin) replace each handler's if-ladder
 * with a zod contract through `parseBody`/`parseQuery`/`parseForm`, and 06-13
 * and 06-14 wrap every route. This file must pass byte for byte, unedited,
 * after each of them. A red here is a moved 400, not a test problem: the
 * contract's key order or its `error` text differs from the ladder it
 * replaced (Pitfall 6), or `field` appeared where the ladder never sent it
 * (C10).
 *
 * The rows come from `badRequestTable.ts`. Every value was measured with a
 * temporary harness before it was pinned (the run is in the phase evidence
 * `slice-7-characterization.txt`). What is pinned:
 *   - P0 the table covers the tree: every route file under src/app/api that
 *     can answer a 400 (a `status: 400`, a `badRequest(`, a readJsonObject or
 *     a parseBody/parseQuery call) has at least one row here, or is named in
 *     `PINNED_ELSEWHERE` with the suites that already pin its 400s (the
 *     slice-6 families and the event list); row ids are unique; there are at
 *     least 100 rows; `field` appears only on the measured sites;
 *   - P1 one row per shape rule per route and verb (status 400, exact body
 *     with `toEqual`), the `order` rows (two rules broken, the first one's
 *     body answers) and the reachable business-rule rows (C11);
 *   - P2 the query-coercion rows: a parameter that is silently coerced today
 *     (no 400) and the value the handler used, read from the response or the
 *     query the fake recorded.
 *
 * Deliberately NOT pinned here: what a malformed body (not JSON, an array, a
 * wrongly typed field) does at the raw-parse sites. That is known-wrong and
 * pinned by the sibling `malformed-input-defect.test.ts`, which the
 * contracts move. Nor any 500 body (the error-text sibling in
 * `src/__tests__/api/`), nor any header (06-12's wrapper).
 *
 * Mocks: `@/lib/supabase/server` (the cookie fake, or the table's
 * `withContainsAndNot` wrapper around it for the one admin/organizers row),
 * `@/lib/supabase/service` and `@supabase/supabase-js` (the elevated fake),
 * `next/headers` (an inert cookie store).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "../helpers/fakeSupabase";
import {
  BAD_REQUEST_ROWS,
  PERSONAS,
  QUERY_COERCION_ROWS,
  elevatedInit,
  run,
  withContainsAndNot,
  type BadRequestRow,
  type PersonaName,
  type QueryCoercionRow,
} from "./badRequestTable";

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

function as(persona: PersonaName, wrapContains = false): void {
  mockCookie = createFakeSupabase(PERSONAS[persona]());
  mockElevated = createFakeSupabase(elevatedInit(persona));
  mockClient = wrapContains
    ? withContainsAndNot(mockCookie.client)
    : mockCookie.client;
}

// ─── P0: the table covers the tree ─────────────────────────────────────────

const API_DIR = join(process.cwd(), "src", "app", "api");
const CAN_ANSWER_400 =
  /status:\s*400|badRequest\(|readJsonObject\(|parseBody\(|parseQuery\(/;

/**
 * Route files whose 400s are pinned by existing suites, not duplicated here.
 * The event list's limit, page, timeOfDay, dayType and cursor 400s are pinned
 * by its own PRESERVE suites (this table adds only two order rows for it).
 * The slice-6 families were characterized by 06-02 and moved to contracts by
 * 06-04.
 */
const PINNED_ELSEWHERE: Record<string, readonly string[]> = {
  events: [
    "src/__tests__/api/events/events-list-characterization.test.ts",
    "src/app/api/events/route.test.ts",
  ],
  interactions: [
    "src/__tests__/api/interactions/interactions-feedback-characterization.test.ts",
  ],
  feedback: [
    "src/__tests__/api/interactions/interactions-feedback-characterization.test.ts",
  ],
  notifications: [
    "src/__tests__/api/notifications/notifications-characterization.test.ts",
  ],
  recommendations: [
    "src/__tests__/api/recommendations/recommendations-characterization.test.ts",
  ],
  "recommendations/analytics": [
    "src/__tests__/api/recommendations/recommendations-family-characterization.test.ts",
  ],
  "recommendations/feedback": [
    "src/__tests__/api/recommendations/recommendations-family-characterization.test.ts",
  ],
};

/**
 * The measured sites that emit `field` today. Research C10 named the first
 * three families; clubs POST, clubs/[id] PATCH ("Invalid value for …") and
 * the end_date-only branch of events/[id] PATCH also emit it.
 */
const FIELD_SITES: Record<string, readonly string[]> = {
  "events/create POST": ["start_date", "end_date"],
  "events/[id] PATCH": ["start_date", "end_date"],
  "admin/users/[id] PATCH": ["roles", "name"],
  "clubs POST": ["website_url", "logo_url", "twitter_url"],
  "clubs/[id] PATCH": ["description", "name"],
};

function routesThatCanAnswer400(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(API_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const file = join(entry.parentPath, entry.name);
    if (!CAN_ANSWER_400.test(readFileSync(file, "utf8"))) continue;
    found.push(relative(API_DIR, entry.parentPath).split(sep).join("/"));
  }
  return found.sort();
}

describe("P0: the table covers the tree", () => {
  it("every route file that can answer a 400 has a row here or a named suite elsewhere", () => {
    const covered = new Set(BAD_REQUEST_ROWS.map((row) => row.route));
    const uncovered = routesThatCanAnswer400().filter(
      (route) => !covered.has(route) && !(route in PINNED_ELSEWHERE)
    );
    expect(uncovered).toEqual([]);
  });

  it("every suite named in PINNED_ELSEWHERE exists", () => {
    const missing = Object.values(PINNED_ELSEWHERE)
      .flat()
      .filter((path) => !existsSync(join(process.cwd(), path)));
    expect(missing).toEqual([]);
  });

  it("every row's route file exists", () => {
    const missing = [...new Set(BAD_REQUEST_ROWS.map((row) => row.route))].filter(
      (route) => !existsSync(join(API_DIR, route, "route.ts"))
    );
    expect(missing).toEqual([]);
  });

  it("row ids are unique and there are at least 100 rows", () => {
    const ids = BAD_REQUEST_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(100);
  });

  it("field appears only on the measured sites", () => {
    const stray = BAD_REQUEST_ROWS.filter((row) => row.expected.field !== undefined)
      .filter(
        (row) =>
          !(FIELD_SITES[`${row.route} ${row.verb}`] ?? []).includes(
            row.expected.field as string
          )
      )
      .map((row) => row.id);
    expect(stray).toEqual([]);
  });
});

// ─── P1: every shape-400, order row and reachable rule row ─────────────────

function rows(kind: BadRequestRow["kind"]): [string, BadRequestRow][] {
  return BAD_REQUEST_ROWS.filter((row) => row.kind === kind).map((row) => [
    `${row.route} ${row.verb} — ${row.id}`,
    row,
  ]);
}

async function expect400(row: BadRequestRow): Promise<void> {
  as(row.persona);
  const outcome = await run(row);
  expect(outcome.status).toBe(row.status);
  expect(outcome.body).toEqual(row.expected);
}

describe("P1: shape rules — today's exact 400", () => {
  it.each(rows("shape"))("%s", async (_label, row) => {
    await expect400(row);
  });
});

describe("P1: check order — the first broken rule answers", () => {
  it.each(rows("order"))("%s", async (_label, row) => {
    await expect400(row);
  });
});

describe("P1: business rules reachable through the fake (C11, stay in the handler)", () => {
  it.each(rows("rule"))("%s", async (_label, row) => {
    await expect400(row);
  });
});

// ─── P2: silently coerced query parameters ─────────────────────────────────

describe("P2: a coerced query parameter, and the value the handler used", () => {
  it.each(
    QUERY_COERCION_ROWS.map((row): [string, QueryCoercionRow] => [
      `${row.route} — ${row.id}`,
      row,
    ])
  )("%s", async (_label, row) => {
    as(row.persona, row.wrapContains);
    const outcome = await run({ route: row.route, verb: "GET", query: row.query });
    expect(row.observe({ ...outcome, cookieCalls: mockCookie.calls })).toEqual(
      row.expected
    );
  });
});
