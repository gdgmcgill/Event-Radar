/**
 * `/sitemap.xml` (Task 7): switch off keeps the legacy sitemap shape
 * exactly (no `/discover`/`/resources`, `/landing` stays); switch on adds
 * the new public routes and the published opportunity/resource URLs, and
 * drops `/landing` (which now just redirects to `/`). The admin-preview
 * flag alone must never affect it — the sitemap is public and unauthenticated.
 *
 * Deviation from the brief: `discovery_public` has no `updated_at` column
 * (confirmed against `src/lib/supabase/types.ts`), so opportunity entries
 * use `published_at` as the closest freshness signal instead.
 */

interface Row {
  [key: string]: unknown;
}

let eventsRows: Row[];
let opportunityRows: Row[];
let resourceRows: Row[];

function builder(rows: Row[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return chain;
}

const mockClient = {
  from: (table: string) => {
    if (table === "events") return builder(eventsRows);
    if (table === "discovery_public") return builder(opportunityRows);
    if (table === "resources") return builder(resourceRows);
    throw new Error(`Unexpected table ${table}`);
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockClient),
}));

import sitemap from "../../app/sitemap";

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
});
