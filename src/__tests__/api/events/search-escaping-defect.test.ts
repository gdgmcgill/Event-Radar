/**
 * DEFECT characterization — F-082 (and the F-059 echo it triggers)
 *
 * Subject: `src/app/api/events/route.ts` GET, lines 214-243 (the fuzzy RPC and
 * its ILIKE fallback) and lines 280-307 (the error path).
 *
 *     // 225-227 — the only path a search takes today, because the fuzzy RPC
 *     // always errors on the local stack (F-078)
 *     eventsQuery = eventsQuery.or(
 *       `title.ilike.%${search}%,description.ilike.%${search}%`
 *     );
 *
 * The defect: the search term is interpolated raw into a PostgREST logic-tree
 * string. `.or()` escapes nothing. A comma splits the group, so `a,b` makes
 * PostgREST answer 400 PGRST100 "failed to parse logic tree"; `%` and `_` are
 * live ILIKE wildcards, so a search for `%` matches every event. Measured
 * against local PostgREST on 2026-09-23 in
 * `.planning/audit/quality/phase-04-slice-defects.md` § F-082.
 *
 * The echo (F-059): lines 286-289 treat only PGRST103, PGRST116 and a message
 * starting with `{` as benign. The PGRST100 message starts with `"`, so lines
 * 303-306 return 500 with `{ error: <the PostgREST message> }` — and that
 * message quotes the internal logic tree back to an anonymous caller.
 *
 * What this file is and is not:
 *
 *   - It is a DEFECT test. It pins what the handler does TODAY: for the terms
 *     `a,b`, `%` and `_` the or() argument is exactly the raw interpolation,
 *     and a PGRST100 from the events query comes back as a 500 whose `error`
 *     is the PostgREST message verbatim. It passes today and is expected to
 *     keep passing until the fixing commit lands.
 *   - It is NOT a failing test and NOT a fix. Plan 04-08 (DEC-32) quotes and
 *     escapes the term. In that commit the four "raw interpolation"
 *     assertions below move — deliberately and visibly — to the escaped,
 *     double-quoted form.
 *   - The PGRST100-to-500 ECHO assertion does NOT move in 04-08. 04-08 removes
 *     the trigger (a comma can no longer break the tree), but the echo branch
 *     itself is F-059's, and F-059 is Phase 5's. That assertion stays until
 *     Phase 5 changes the error path.
 *   - It does not pin search results. `events-list-characterization.test.ts`
 *     pins the fallback's shape loosely (one or() mentioning both columns and
 *     the term) so that it survives 04-08.
 *
 * Why the assertions are on the fake's CALL LOG: the parse failure and the
 * wildcard semantics are properties of PostgREST's grammar and of Postgres'
 * ILIKE, which no in-process fake reproduces. The observable, mockable
 * property is the exact string handed to `.or()`. The real-parser half of
 * this defect — the 500 on a comma and `%` matching every seeded event — is
 * pinned against the local stack in `e2e/specs/event-read-path.spec.ts`.
 *
 * Registered as F-082 in .planning/audit/findings.json (the echo is F-059).
 * Observed red under a mutation that double-quotes the interpolated values;
 * see `evidence/slice-2-mutation-check.txt`.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeCall,
  type FakeSupabase,
  type FakeSupabaseInit,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/events/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

jest.mock("@/lib/timezone", () => ({
  ...jest.requireActual<typeof import("@/lib/timezone")>("@/lib/timezone"),
  getESTNowISO: () => "2026-09-23T12:00:00.000Z",
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** F-078: the fuzzy RPC fails on the local stack, so search takes the ILIKE fallback. */
const FUZZY_ERROR = {
  search_events_fuzzy: {
    data: null,
    error: { code: "0A000", message: "SET is not allowed in a non-volatile function" },
  },
};

/**
 * The PostgREST error the running app logs for `search=a,b`, verbatim from the
 * persona-harness run in `evidence/playwright.slice-2-before.txt`.
 */
const PGRST100 = {
  code: "PGRST100",
  details: "unexpected \"%\" expecting letter, digit, \"-\", \"->>\", \"->\" or delimiter (.)",
  hint: null,
  message:
    "\"failed to parse logic tree ((title.ilike.%a,b%,description.ilike.%a,b%))\" (line 1, column 20)",
};

async function get(search: string, init: Partial<FakeSupabaseInit> = {}) {
  mockFake = createFakeSupabase({
    user: null,
    tables: { events: [] },
    rpc: FUZZY_ERROR,
    ...init,
  });
  const res = await GET(
    new NextRequest(`http://localhost:3000/api/events?search=${encodeURIComponent(search)}`)
  );
  return { res, fake: mockFake };
}

function orFilters(calls: FakeCall[]): unknown[] {
  const select = calls.find((c) => c.table === "events" && c.operation === "select");
  return (select?.filters ?? []).filter((f) => f.op === "or").map((f) => f.value);
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("F-082 — the search term is interpolated raw into the or() logic tree (moves in 04-08)", () => {
  it.each([
    ["a,b", "title.ilike.%a,b%,description.ilike.%a,b%"],
    ["%", "title.ilike.%%%,description.ilike.%%%"],
    ["_", "title.ilike.%_%,description.ilike.%_%"],
  ])("search=%s hands .or() exactly the raw string %s", async (term, expected) => {
    const { fake } = await get(term);
    expect(orFilters(fake.calls)).toEqual([expected]);
  });

  it("a comma in the term is not quoted, so it lands at the logic tree's top level", async () => {
    const { fake } = await get("a,b");
    const [expression] = orFilters(fake.calls) as string[];
    // Four comma-separated pieces instead of two conditions.
    expect(expression.split(",")).toEqual([
      "title.ilike.%a",
      "b%",
      "description.ilike.%a",
      "b%",
    ]);
    expect(expression).not.toContain("\"");
  });
});

describe("F-059 echo — a PGRST100 from the events query is returned to the caller verbatim (stays after 04-08; Phase 5)", () => {
  it("returns 500 whose error is the PostgREST message, internal logic tree included", async () => {
    const { res } = await get("a,b", { errors: { events: PGRST100 } });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: PGRST100.message });
    expect(body.error).toContain("failed to parse logic tree");
    expect(body.error).toContain("title.ilike.%a,b%");
  });
});
