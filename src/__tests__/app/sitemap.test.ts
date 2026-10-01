/**
 * `/sitemap.xml` (Task 7; fix round 1 finding 3): switch off keeps the
 * legacy sitemap shape exactly (no `/discover`/`/resources`, `/landing`
 * stays); switch on adds the new public routes and the published
 * opportunity/resource URLs, and drops `/landing` (which now just redirects
 * to `/`). The admin-preview flag alone must never affect it — the sitemap
 * is public and unauthenticated.
 *
 * The opportunities and resources query builders are recorded (like
 * `src/server/home/__tests__/sections.test.ts`) so the filters themselves
 * are pinned, not just the rows a mock happens to return: `kind =
 * 'opportunity'`, `canonical_id is null`, `published_at <= now` for
 * opportunities; `status = 'published'`, `deleted_at is null` for
 * resources. A query that comes back with an `error` logs a `log.warn`
 * with no error message text and is treated as empty, never thrown.
 *
 * Deviation from the brief: `discovery_public` has no `updated_at` column
 * (confirmed against `src/lib/supabase/types.ts`), so opportunity entries
 * use `published_at` as the closest freshness signal instead.
 */

interface Row {
  [key: string]: unknown;
}

interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

let eventsRows: Row[];
let opportunityRows: Row[];
let resourceRows: Row[];
let opportunitiesError: { message: string } | null;
let resourcesError: { message: string } | null;
let calls: RecordedCall[];

function builder(table: string, rows: Row[], error: { message: string } | null) {
  const record = (method: string, args: unknown[]) => {
    calls.push({ table, method, args });
    return chain;
  };
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    select: (...args: unknown[]) => record("select", args),
    eq: (...args: unknown[]) => record("eq", args),
    is: (...args: unknown[]) => record("is", args),
    lte: (...args: unknown[]) => record("lte", args),
    order: (...args: unknown[]) => record("order", args),
    limit: (...args: unknown[]) => {
      calls.push({ table, method: "limit", args });
      return Promise.resolve({ data: error ? null : rows, error });
    },
  };
  return chain;
}

const mockClient = {
  from: (table: string) => {
    if (table === "events") return builder(table, eventsRows, null);
    if (table === "discovery_public") return builder(table, opportunityRows, opportunitiesError);
    if (table === "resources") return builder(table, resourceRows, resourcesError);
    throw new Error(`Unexpected table ${table}`);
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockClient),
}));

jest.mock("@/server/log", () => ({ log: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

import sitemap from "../../app/sitemap";
import { log } from "@/server/log";

const ORIGINAL_ENV = process.env;

describe("sitemap", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.FEATURE_DISCOVERY_UI;
    delete process.env.FEATURE_DISCOVERY_ADMIN_PREVIEW;
    eventsRows = [];
    opportunityRows = [
      { id: "22222222-2222-4222-8222-222222222222", published_at: "2026-01-01T00:00:00Z" },
    ];
    resourceRows = [{ slug: "resume-guide", reviewed_at: "2026-01-02T00:00:00Z" }];
    opportunitiesError = null;
    resourcesError = null;
    calls = [];
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("excludes discovery routes and keeps /landing when the switch is unset", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://universeapp.ca/landing");
    expect(urls.some((url) => url.includes("/discover"))).toBe(false);
    expect(urls.some((url) => url.includes("/resources"))).toBe(false);
    expect(urls.some((url) => url.includes("/submit"))).toBe(false);
    expect(urls.some((url) => url.includes("/for-companies"))).toBe(false);
    // Switch off never queries discovery_public or resources at all.
    expect(calls.some((call) => call.table === "discovery_public")).toBe(false);
    expect(calls.some((call) => call.table === "resources")).toBe(false);
  });

  it("includes discovery routes, published opportunities and resources, and drops /landing when true", async () => {
    process.env.FEATURE_DISCOVERY_UI = "true";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://universeapp.ca/discover");
    expect(urls).toContain("https://universeapp.ca/resources");
    expect(urls).toContain("https://universeapp.ca/submit");
    expect(urls).toContain("https://universeapp.ca/for-companies");
    expect(urls).toContain(
      `https://universeapp.ca/opportunities/${opportunityRows[0].id}`
    );
    expect(urls).toContain(
      `https://universeapp.ca/resources/${resourceRows[0].slug}`
    );
    expect(urls).not.toContain("https://universeapp.ca/landing");
  });

  it("adds nothing for the admin-preview flag alone", async () => {
    process.env.FEATURE_DISCOVERY_ADMIN_PREVIEW = "true";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/discover"))).toBe(false);
    expect(urls.some((url) => url.includes("/resources"))).toBe(false);
    expect(urls).toContain("https://universeapp.ca/landing");
  });

  it("filters opportunities by kind, canonical_id and published_at <= now", async () => {
    process.env.FEATURE_DISCOVERY_UI = "true";
    await sitemap();
    const opportunityCalls = calls.filter((call) => call.table === "discovery_public");
    expect(opportunityCalls).toContainEqual({ table: "discovery_public", method: "eq", args: ["kind", "opportunity"] });
    expect(opportunityCalls).toContainEqual({ table: "discovery_public", method: "is", args: ["canonical_id", null] });
    const lteCall = opportunityCalls.find((call) => call.method === "lte");
    expect(lteCall?.args[0]).toBe("published_at");
    expect(typeof lteCall?.args[1]).toBe("string");
  });

  it("filters resources by status and deleted_at", async () => {
    process.env.FEATURE_DISCOVERY_UI = "true";
    await sitemap();
    const resourceCalls = calls.filter((call) => call.table === "resources");
    expect(resourceCalls).toContainEqual({ table: "resources", method: "eq", args: ["status", "published"] });
    expect(resourceCalls).toContainEqual({ table: "resources", method: "is", args: ["deleted_at", null] });
  });

  it("logs a warning with no error message text when the opportunities query errors, and treats it as empty", async () => {
    process.env.FEATURE_DISCOVERY_UI = "true";
    opportunitiesError = { message: "connection refused at 10.0.0.5" };
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/opportunities/"))).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      "sitemap query failed",
      expect.objectContaining({ section: "opportunities" })
    );
    const loggedFields = (log.warn as jest.Mock).mock.calls
      .map(([, fields]: [string, Record<string, unknown>]) => JSON.stringify(fields))
      .join(" ");
    expect(loggedFields).not.toContain("connection refused");
  });

  it("logs a warning with no error message text when the resources query errors, and treats it as empty", async () => {
    process.env.FEATURE_DISCOVERY_UI = "true";
    resourcesError = { message: "relation resources does not exist" };
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/resources/resume-guide"))).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      "sitemap query failed",
      expect.objectContaining({ section: "resources" })
    );
    const loggedFields = (log.warn as jest.Mock).mock.calls
      .map(([, fields]: [string, Record<string, unknown>]) => JSON.stringify(fields))
      .join(" ");
    expect(loggedFields).not.toContain("does not exist");
  });
});
