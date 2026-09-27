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
 * `cache_policy_target` with the OVERRIDES below applied. P0 checks that the
 * tree and the inventory agree, so a new route cannot arrive unclassified.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { CACHE_CLASSES, type CacheClass } from "@/server/http";

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
 * inventory is regenerated in 06-15 (DI-58).
 */
const DELETED: Record<string, string> = {
  "src/app/api/auth-debug/route.ts": "deleted in Phase 5",
  "src/app/api/cron/send-reminders/route.ts":
    "deleted in 06-03 (pg_cron runs send_event_reminders)",
  "src/app/api/cron/send-feedback-requests/route.ts":
    "deleted in 06-03 (pg_cron runs send_feedback_requests)",
};

/** Where the corrected classification differs from, or pins, the inventory. */
const OVERRIDES: Record<string, { cache: CacheClass; reason: string }> = {
  "/api/events/[id]": {
    cache: "private",
    reason:
      "C7: viewer-dependent (admins and the creator read pending and rejected rows; pending_edits for creator and admins), and Vercel caches 404s",
  },
  "/api/health": {
    cache: "private",
    reason: "C8: a cached liveness answer would mask an origin outage",
  },
  "/api/clubs/[id]/events": {
    cache: "private",
    reason: "DEC-69: members see the club's pending events",
  },
  "/api/events/[id]/rsvp": {
    cache: "private",
    reason: "DEC-69: the caller's own RSVP state",
  },
  "/api/events": {
    cache: "public-30-60",
    reason: "C9: the value production serves today (route.ts sets s-maxage=30, swr=60)",
  },
  "/api/events/featured": {
    cache: "public-60-120",
    reason: "C9: the value production serves today (s-maxage=60, swr=120)",
  },
  "/api/clubs/featured": {
    cache: "public-60-120",
    reason: "C9: the value production serves today (s-maxage=60, swr=120)",
  },
};

/** Every route file not yet wrapped. Only ever shrinks (06-13, 06-14). */
const PENDING_WRAP: readonly string[] = [
  "src/app/api/admin/analytics/events/route.ts",
  "src/app/api/admin/analytics/users/route.ts",
  "src/app/api/admin/audit-log/route.ts",
  "src/app/api/admin/calculate-popularity/route.ts",
  "src/app/api/admin/clubs/[id]/route.ts",
  "src/app/api/admin/clubs/route.ts",
  "src/app/api/admin/events/[id]/edits/route.ts",
  "src/app/api/admin/events/[id]/route.ts",
  "src/app/api/admin/events/[id]/status/route.ts",
  "src/app/api/admin/events/route.ts",
  "src/app/api/admin/experiments/[id]/results/route.ts",
  "src/app/api/admin/experiments/[id]/route.ts",
  "src/app/api/admin/experiments/route.ts",
  "src/app/api/admin/featured/[id]/route.ts",
  "src/app/api/admin/featured/route.ts",
  "src/app/api/admin/organizer-requests/[id]/route.ts",
  "src/app/api/admin/organizer-requests/route.ts",
  "src/app/api/admin/organizers/route.ts",
  "src/app/api/admin/reports/[id]/route.ts",
  "src/app/api/admin/reports/route.ts",
  "src/app/api/admin/stats/route.ts",
  "src/app/api/admin/users/[id]/ban/route.ts",
  "src/app/api/admin/users/[id]/route.ts",
  "src/app/api/admin/users/route.ts",
  "src/app/api/calendar/events/route.ts",
  "src/app/api/clubs/[id]/analytics/route.ts",
  "src/app/api/clubs/[id]/appeal/route.ts",
  "src/app/api/clubs/[id]/events/route.ts",
  "src/app/api/clubs/[id]/follow/route.ts",
  "src/app/api/clubs/[id]/invites/route.ts",
  "src/app/api/clubs/[id]/members/role/route.ts",
  "src/app/api/clubs/[id]/members/route.ts",
  "src/app/api/clubs/[id]/route.ts",
  "src/app/api/clubs/[id]/transfer/route.ts",
  "src/app/api/clubs/banner/route.ts",
  "src/app/api/clubs/featured/route.ts",
  "src/app/api/clubs/friends/route.ts",
  "src/app/api/clubs/logo/route.ts",
  "src/app/api/clubs/new/route.ts",
  "src/app/api/clubs/route.ts",
  "src/app/api/clubs/trending/route.ts",
  "src/app/api/events/[id]/analytics/route.ts",
  "src/app/api/events/[id]/appeal/route.ts",
  "src/app/api/events/[id]/friends/route.ts",
  "src/app/api/events/[id]/invite/route.ts",
  "src/app/api/events/[id]/report/route.ts",
  "src/app/api/events/[id]/reviews/route.ts",
  "src/app/api/events/[id]/route.ts",
  "src/app/api/events/[id]/rsvp/route.ts",
  "src/app/api/events/[id]/save/route.ts",
  "src/app/api/events/create/route.ts",
  "src/app/api/events/export/route.ts",
  "src/app/api/events/featured/route.ts",
  "src/app/api/events/following/route.ts",
  "src/app/api/events/friends-activity/route.ts",
  "src/app/api/events/friends-organizing/route.ts",
  "src/app/api/events/happening-now/route.ts",
  "src/app/api/events/my-events/route.ts",
  "src/app/api/events/new/route.ts",
  "src/app/api/events/popular/route.ts",
  "src/app/api/events/route.ts",
  "src/app/api/events/upload-image/route.ts",
  "src/app/api/feedback/route.ts",
  "src/app/api/health/route.ts",
  "src/app/api/interactions/route.ts",
  "src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts",
  "src/app/api/my-clubs/route.ts",
  "src/app/api/notifications/[id]/route.ts",
  "src/app/api/notifications/count/route.ts",
  "src/app/api/notifications/route.ts",
  "src/app/api/onboarding/complete/route.ts",
  "src/app/api/organizer-requests/route.ts",
  "src/app/api/profile/avatar/route.ts",
  "src/app/api/profile/banner/route.ts",
  "src/app/api/profile/inferred-tags/route.ts",
  "src/app/api/profile/interests/route.ts",
  "src/app/api/recommendations/analytics/route.ts",
  "src/app/api/recommendations/batch/route.ts",
  "src/app/api/recommendations/feedback/route.ts",
  "src/app/api/recommendations/route.ts",
  "src/app/api/user/engagement/route.ts",
  "src/app/api/user/following/route.ts",
  "src/app/api/users/[id]/follow/route.ts",
  "src/app/api/users/[id]/route.ts",
  "src/app/api/users/me/friends/route.ts",
  "src/app/api/users/me/requests/route.ts",
  "src/app/api/users/me/suggestions/route.ts",
  "src/app/api/users/saved-events/route.ts",
  "src/app/api/users/search/route.ts",
  "src/app/auth/callback/route.ts",
  "src/app/auth/signout/route.ts",
];

const INVENTORY_CLASS: Record<string, CacheClass> = {
  "private, no-store": "private",
  "no-store": "private",
  "public, s-maxage=60, stale-while-revalidate=300": "public-60-300",
};

/** The GET class a route's file must declare. */
function classify(row: EndpointRow): CacheClass {
  const override = OVERRIDES[row.route];
  if (override) return override.cache;
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

  it("every override names a live route and carries a reason", () => {
    for (const [route, { cache, reason }] of Object.entries(OVERRIDES)) {
      expect(LIVE_ROWS.some((row) => row.route === route)).toBe(true);
      expect(CACHE_CLASSES).toContain(cache);
      expect(reason.length).toBeGreaterThan(10);
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
