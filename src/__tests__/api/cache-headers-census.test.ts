/**
 * The static cache census (plan 06-12, REFAC-19, DEC-73, research C7-C9 and
 * § Inventory E).
 *
 * Every route file under src/app/api and src/app/auth is in exactly one of
 * two states:
 *   - PENDING_WRAP: not yet adopted. The file must still be unwrapped (no
 *     `withRoute(`), so a sweep that wraps a file must also delete it here.
 *     The list only ever shrinks: 06-13 and 06-14 empty it (T-06-12-05).
 *   - adopted: every HTTP export is `export const <VERB> = withRoute({ cache:
 *     "<class>" …}, …)`, the GET class equals the file's corrected
 *     classification, every other verb is "private", and the file holds no
 *     literal Cache-Control (the wrapper owns the header on every status).
 *
 * The classification is `.planning/audit/inventory/endpoints.json`'s
 * `cache_policy_target`, read through INVENTORY_CLASS (header text to class
 * name). Since 06-15 the inventory carries the C7/C8/C9 and DEC-69 corrections
 * itself (classify-inventory.mjs CACHE_TARGET_OVERRIDES, classification-rules.md
 * § C2), so this file keeps no override list. The target never reads the
 * wrapper, so the comparison below is between two independent sources. P0
 * checks that the tree and the inventory agree, so a new route cannot arrive
 * unclassified.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { CACHE_CLASSES, cachePolicy, type CacheClass } from "@/server/http";

const REPO = resolve(__dirname, "../../..");

type EndpointRow = {
  file: string;
  route: string;
  methods: string[];
  cache_policy_target: string;
};

const ENDPOINTS: EndpointRow[] = JSON.parse(
  readFileSync(join(REPO, ".planning/audit/inventory/endpoints.json"), "utf8")
);

/**
 * Rows whose file no longer exists. They are skipped, never classified; the
 * classifier retains them byte-for-byte (DEC-55, classification-rules.md § 8).
 */
const DELETED: Record<string, string> = {
  "src/app/api/auth-debug/route.ts": "deleted in Phase 5",
  "src/app/api/cron/send-reminders/route.ts":
    "deleted in 06-03 (pg_cron runs send_event_reminders)",
  "src/app/api/cron/send-feedback-requests/route.ts":
    "deleted in 06-03 (pg_cron runs send_feedback_requests)",
};

/**
 * Every route file not yet wrapped. Only ever shrank: 91 at 06-12, 48 after
 * 06-13, empty after 06-14 (asserted empty below). A new route file must be
 * wrapped when it lands; it can no longer be parked here.
 */
const PENDING_WRAP: readonly string[] = [];

/** Each `cache_policy_target` value the inventory uses, to its class name. */
const INVENTORY_CLASS: Record<string, CacheClass> = {
  "private, no-store": "private",
  "no-store": "private",
  "public, s-maxage=60, stale-while-revalidate=300": "public-60-300",
  "public, s-maxage=30, stale-while-revalidate=60": "public-30-60",
  "public, s-maxage=60, stale-while-revalidate=120": "public-60-120",
};

/** The GET class a route's file must declare. */
function classify(row: EndpointRow): CacheClass {
  const cls = INVENTORY_CLASS[row.cache_policy_target];
  if (!cls) throw new Error(`unmapped cache_policy_target ${row.cache_policy_target}`);
  return cls;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.[cm]?[jt]sx?$/.test(name)) {
      out.push(relative(REPO, full).split(sep).join("/"));
    }
  }
  return out;
}

const TREE = [
  ...routeFiles(join(REPO, "src/app/api")),
  ...routeFiles(join(REPO, "src/app/auth")),
].sort();

const LIVE_ROWS = ENDPOINTS.filter((row) => !(row.file in DELETED));
const ROW_BY_FILE = new Map(LIVE_ROWS.map((row) => [row.file, row]));

const VERBS = "GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS";

/** The HTTP exports a file declares, and how. */
function exportsOf(text: string): { verb: string; cache: string | null }[] {
  const found: { verb: string; cache: string | null }[] = [];
  const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${VERBS})\\b`, "g");
  for (const m of text.matchAll(fn)) found.push({ verb: m[1], cache: null });
  const constant = new RegExp(`export\\s+const\\s+(${VERBS})\\s*=\\s*([^\\n]*)`, "g");
  for (const m of text.matchAll(constant)) {
    const rest = text.slice((m.index ?? 0) + m[0].length - m[2].length);
    const wrapped = /^withRoute\(\s*\{\s*cache:\s*"([^"]+)"/.exec(rest);
    found.push({ verb: m[1], cache: wrapped ? wrapped[1] : null });
  }
  return found;
}

const read = (file: string) => readFileSync(join(REPO, file), "utf8");

describe("cache census: the tree and the inventory (P0)", () => {
  it("every route file has exactly one inventory row, and every row is a live file or a deleted one", () => {
    expect(TREE).toEqual(LIVE_ROWS.map((row) => row.file).sort());
    for (const file of Object.keys(DELETED)) {
      expect(existsSync(join(REPO, file))).toBe(false);
      expect(ENDPOINTS.some((row) => row.file === file)).toBe(true);
    }
    expect(TREE).toHaveLength(ENDPOINTS.length - Object.keys(DELETED).length);
  });

  it("every public target value maps to a class, and every class's header is a target value", () => {
    for (const row of LIVE_ROWS) expect(INVENTORY_CLASS).toHaveProperty([row.cache_policy_target]);
    for (const [value, cls] of Object.entries(INVENTORY_CLASS)) {
      if (cls !== "private") expect(cachePolicy(cls)).toBe(value);
    }
  });

  it("the C7, C8 and DEC-69 routes are private in the data", () => {
    for (const route of [
      "/api/events/[id]",
      "/api/health",
      "/api/events/[id]/rsvp",
      "/api/clubs/[id]/events",
    ]) {
      const row = LIVE_ROWS.find((r) => r.route === route) as EndpointRow;
      expect({ route, target: row.cache_policy_target }).toEqual({
        route,
        target: "private, no-store",
      });
    }
  });

  it("the corrected public set is research § Inventory E exactly", () => {
    const pub = LIVE_ROWS.filter((row) => classify(row) !== "private")
      .map((row) => `${row.route} ${classify(row)}`)
      .sort();
    expect(pub).toEqual(
      [
        "/api/clubs public-60-300",
        "/api/clubs/[id] public-60-300",
        "/api/clubs/new public-60-300",
        "/api/clubs/trending public-60-300",
        "/api/events/export public-60-300",
        "/api/events/happening-now public-60-300",
        "/api/events/new public-60-300",
        "/api/events/popular public-60-300",
        "/api/events public-30-60",
        "/api/events/featured public-60-120",
        "/api/clubs/featured public-60-120",
      ].sort()
    );
  });

  it("PENDING_WRAP is empty: every route file is wrapped (06-14)", () => {
    expect(PENDING_WRAP).toEqual([]);
  });

  it("PENDING_WRAP names live route files only, each once", () => {
    expect(new Set(PENDING_WRAP).size).toBe(PENDING_WRAP.length);
    for (const file of PENDING_WRAP) expect(TREE).toContain(file);
  });
});

describe.each(TREE)("cache census: %s", (file) => {
  const text = read(file);
  const row = ROW_BY_FILE.get(file) as EndpointRow;

  if (PENDING_WRAP.includes(file)) {
    it("is pending: still unwrapped (a wrapped file must leave PENDING_WRAP)", () => {
      expect(text).not.toMatch(/\bwithRoute\(/);
    });
    return;
  }

  it("declares every HTTP export through withRoute with a known class", () => {
    const exported = exportsOf(text);
    expect(exported.length).toBeGreaterThan(0);
    for (const { verb, cache } of exported) {
      expect({ verb, wrapped: cache !== null }).toEqual({ verb, wrapped: true });
      expect(CACHE_CLASSES).toContain(cache);
    }
  });

  it("uses the corrected class on GET and private on every other verb", () => {
    for (const { verb, cache } of exportsOf(text)) {
      const expected = verb === "GET" || verb === "HEAD" ? classify(row) : "private";
      expect({ verb, cache }).toEqual({ verb, cache: expected });
    }
  });

  it("sets no Cache-Control itself (the wrapper owns the header)", () => {
    expect(text).not.toMatch(/cache-control/i);
  });
});
