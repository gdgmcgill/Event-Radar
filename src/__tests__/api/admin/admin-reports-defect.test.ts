/**
 * DEFECT characterization — F-092: the admin reports list always answers 500
 * (plan 06-02)
 *
 * `src/app/api/admin/reports/route.ts:27-36` selects event_reports with the
 * embed `reporter:users!event_reports_reporter_id_fkey(id, display_name,
 * avatar_url)`. `event_reports.reporter_id` references `auth.users`, not
 * `public.users`, so PostgREST finds no relationship by that hint and answers
 * PGRST200 (reproduced on the local stack, verbatim in
 * `.planning/audit/quality/phase-05-close-defects.md` § F-092). The route
 * answers `500 {"error":"Internal server error"}` (`:48-50`), so the
 * moderation reports queue is empty for every admin.
 *
 * The fake models PostgREST's schema-cache check, not a blanket table error:
 * a select on event_reports whose column list names the
 * `users!event_reports_reporter_id_fkey` hint answers PGRST200 with the
 * reproduction's code, message, details and hint; the same select without
 * that embed succeeds. So DEC-69's fix (drop the embed, read `users` for
 * id, name, avatar_url and map `name` to `reporter.display_name`) flips the
 * pinned row without a fixture edit.
 *
 * Pinned today:
 *   D1  admin GET → 500 `{"error":"Internal server error"}`, and the
 *       report-count query never runs.
 *       Fixed shape: 200 `{ reports: [{ …report, event, reporter:
 *       { id, display_name, avatar_url }, report_count }] }`.
 *
 * Rows that do not move: anonymous 401 Unauthorized and non-admin 403
 * Forbidden, each with no event_reports read.
 *
 * Seam: the request context (`createRequestContext`) builds on
 * `@/lib/supabase/server`, which returns the cookie fake.
 */

import { NextRequest } from "next/server";
import {
  createFakeSupabase,
  type FakeError,
  type FakeRow,
  type FakeSupabase,
} from "../../helpers/fakeSupabase";

type ReportsGET = (typeof import("@/app/api/admin/reports/route"))["GET"];

let mockCookie: FakeSupabase;
let cookieClient: FakeSupabase["client"];

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(cookieClient),
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const CALLER = {
  id: "06000000-0000-4000-8000-000000000051",
  email: "slice6.moderator@mail.mcgill.ca",
};
const REPORTER_ID = "06000000-0000-4000-8000-000000000052";
const EVENT_ID = "06000000-0000-4000-8000-0000000005e1";

/** The error PostgREST returned in F-092's local-stack reproduction. */
const PGRST200: FakeError = {
  code: "PGRST200",
  message:
    "Could not find a relationship between 'event_reports' and 'users' in the schema cache",
  details:
    "Searched for a foreign key relationship between 'event_reports' and 'users' using the hint 'event_reports_reporter_id_fkey' in the schema 'public', but no matches were found.",
  hint: "Perhaps you meant 'events' instead of 'users'.",
};

const EMBED_HINT = "users!event_reports_reporter_id_fkey";

/**
 * Wraps the cookie fake so that a select on event_reports naming the broken
 * embed answers PGRST200, as PostgREST's schema cache does. The query is
 * still executed against the fake (so it is recorded in `calls`); only its
 * result is replaced.
 */
function withSchemaCacheCheck(fake: FakeSupabase): FakeSupabase["client"] {
  const client = fake.client;
  return {
    ...client,
    from(table: string) {
      const builder = client.from(table);
      if (table !== "event_reports") return builder;
      let brokenEmbed = false;
      const select = builder.select.bind(builder);
      builder.select = ((columns?: string, options?: Parameters<typeof select>[1]) => {
        if (columns && columns.includes(EMBED_HINT)) brokenEmbed = true;
        return select(columns, options);
      }) as typeof builder.select;
      const then = builder.then.bind(builder);
      builder.then = ((onfulfilled, onrejected) =>
        brokenEmbed
          ? then(() => ({ data: null, error: PGRST200, count: null })).then(
              onfulfilled,
              onrejected
            )
          : then(onfulfilled, onrejected)) as typeof builder.then;
      return builder;
    },
  };
}

function profile(roles: string[]): FakeRow {
  return {
    id: CALLER.id,
    email: CALLER.email,
    name: "Slice Six Moderator",
    avatar_url: null,
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
  };
}

function as(persona: "anonymous" | "student" | "admin"): void {
  mockCookie = createFakeSupabase({
    user: persona === "anonymous" ? null : CALLER,
    tables: {
      users: [
        ...(persona === "anonymous"
          ? []
          : [profile(persona === "admin" ? ["user", "admin"] : ["user"])]),
        {
          id: REPORTER_ID,
          name: "Reporting Student",
          avatar_url: null,
          roles: ["user"],
        },
      ],
      event_reports: [
        {
          id: "06000000-0000-4000-8000-0000000005d1",
          event_id: EVENT_ID,
          reporter_id: REPORTER_ID,
          reason: "spam",
          status: "pending",
          created_at: "2026-09-20T12:00:00+00:00",
          event: {
            id: EVENT_ID,
            title: "Reported Event",
            status: "approved",
            deleted_at: null,
          },
        },
      ],
    },
  });
  cookieClient = withSchemaCacheCheck(mockCookie);
}

async function list() {
  const GET: ReportsGET = (await import("@/app/api/admin/reports/route")).GET;
  const response = await GET(
    new NextRequest("http://localhost:3000/api/admin/reports?status=pending")
  );
  return { status: response.status, body: await response.json() };
}

function reportReads(): number {
  return mockCookie.calls.filter((c) => c.table === "event_reports").length;
}

describe("DEFECT F-092: the reports list answers 500 on PGRST200", () => {
  it("D1: admin → 500 Internal server error; the count query never runs", async () => {
    as("admin");
    expect(await list()).toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
    const reads = mockCookie.calls.filter((c) => c.table === "event_reports");
    expect(reads).toHaveLength(1);
    expect(reads[0].columns).toContain(EMBED_HINT);
  });
});

describe("rows that do not move", () => {
  it("anonymous → 401 Unauthorized, no event_reports read", async () => {
    as("anonymous");
    expect(await list()).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(reportReads()).toBe(0);
  });

  it("non-admin → 403 Forbidden, no event_reports read", async () => {
    as("student");
    expect(await list()).toEqual({ status: 403, body: { error: "Forbidden" } });
    expect(reportReads()).toBe(0);
  });

  it("the schema-cache model answers a select without the broken embed normally", async () => {
    as("admin");
    const { data, error } = await cookieClient
      .from("event_reports")
      .select("id, event_id, reporter_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
