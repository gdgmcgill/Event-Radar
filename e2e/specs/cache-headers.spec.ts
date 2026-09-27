/**
 * cache-headers.spec.ts — the live header sweep over the endpoint table.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-15
 * (REFAC-19, F-026, DI-26, DEC-73)
 *
 * The rows are `.planning/audit/inventory/endpoints.json`, read at spec load
 * (regenerated from the implemented classes in 06-15 Task 1); a row whose
 * handler file no longer exists is skipped and listed below. Dynamic segments
 * are filled from the seed's fixed ids by family.
 *
 * WHAT IS ASSERTED, ON THE RUNNING PRODUCTION BUILD
 *   - Every GET row, as anonymous and as the persona its `auth_requirement`
 *     implies (admin for admin rows, onboarded_student otherwise):
 *     `Cache-Control` equals the row's class value (`cache_policy_target`)
 *     when the answer is a 200 or a 404, and `private, no-store` for any
 *     other status (a 401, 403, 400, 3xx or 500 is never shareable); and
 *     `x-request-id` is UUID-shaped.
 *   - Every public row answers 200 anonymously, so each public value is
 *     observed on the wire, not only inferred from source.
 *   - Every mutation method, sent anonymously with no body: the status is
 *     401, 400 or 403, and `Cache-Control` is `private, no-store`. The one
 *     exception is recorded in MUTATION_STATUS_EXCEPTIONS with its reason.
 *   - The sweep covered every live row and every method.
 *
 * WHAT IS NEVER SENT
 *   No authenticated mutation (plan prohibition). Mutations go out
 *   anonymously only, with no body. Redirects are not followed, so a 3xx is
 *   judged on its own headers.
 *
 * Each observation is printed as one `SWEEP {…}` line (route, caller, method,
 * status, Cache-Control, whether a UUID request id was present). No body,
 * cookie or id value is printed. The evidence file quotes those lines.
 */

import fs from "node:fs";
import path from "node:path";

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

import { BASE_URL } from "../../playwright.config";
import { IDS, storageStateFor, type PersonaKey } from "../fixtures";

interface EndpointRow {
  id: string;
  file: string;
  route: string;
  methods: string[];
  auth_requirement: string;
  cache_policy_target: string;
}

const REPO = path.resolve(__dirname, "..", "..");
const ALL_ROWS: EndpointRow[] = JSON.parse(
  fs.readFileSync(
    path.join(REPO, ".planning/audit/inventory/endpoints.json"),
    "utf8"
  )
);

/** Rows not swept, each with its reason. Only deleted handlers qualify. */
const SKIPPED: Record<string, string> = Object.fromEntries(
  ALL_ROWS.filter((row) => !fs.existsSync(path.join(REPO, row.file))).map(
    (row) => [
      row.route,
      "handler file deleted; the row is retained by DEC-55 (classification-rules.md § 8)",
    ]
  )
);

const ROWS = ALL_ROWS.filter((row) => !(row.route in SKIPPED));

const PRIVATE = "private, no-store";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * An id no seed row carries, for families the seed has no row in
 * (experiments, featured entries, organizer requests, reports,
 * notifications). A GET answers 404 or its gate first; an anonymous mutation
 * is refused before any lookup.
 */
const UNSEEDED_ID = "5eed0000-0000-4000-8000-0000000000ff";

/** The seeded id a `[id]` segment takes, by the path segment before it. */
function idFor(family: string): string {
  switch (family) {
    case "events":
      return IDS.approvedEvent;
    case "clubs":
      return IDS.approvedClub;
    case "users":
      return IDS.onboarded_student;
    default:
      return UNSEEDED_ID;
  }
}

/** Query strings a read needs for its contract to accept it. */
const QUERY: Record<string, string> = {
  "/api/events/export": "?format=csv",
  "/api/users/search": "?q=seed",
};

function concrete(route: string): string {
  const filled = route
    .replace("[targetType]", "event")
    .replace("[targetId]", IDS.approvedEvent)
    .replace(/\/([^/]+)\/\[id\]/g, (_match, family: string) => `/${family}/${idFor(family)}`);
  return filled + (QUERY[route] ?? "");
}

/** Mutations whose anonymous answer is not 401, 400 or 403, and why. */
const MUTATION_STATUS_EXCEPTIONS: Record<string, { status: number; reason: string }> = {
  "POST /auth/signout": {
    status: 302,
    reason:
      "sign-out is open to every caller by design (BAN_EXEMPT_PATHS in src/proxy.ts); an anonymous POST has no session to end and is redirected to / like a signed-in one",
  },
};

const isPublic = (row: EndpointRow) => row.cache_policy_target.startsWith("public");

function expectedCacheControl(row: EndpointRow, status: number): string {
  return status === 200 || status === 404 ? row.cache_policy_target : PRIVATE;
}

const personaFor = (row: EndpointRow): PersonaKey =>
  row.auth_requirement === "admin" ? "admin" : "onboarded_student";

const contexts = new Map<string, APIRequestContext>();
const covered = { gets: new Set<string>(), mutations: new Set<string>() };

async function contextFor(who: PersonaKey | "anonymous"): Promise<APIRequestContext> {
  let ctx = contexts.get(who);
  if (!ctx) {
    ctx = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: who === "anonymous" ? undefined : storageStateFor(who),
    });
    contexts.set(who, ctx);
  }
  return ctx;
}

function record(row: EndpointRow, who: string, method: string, res: APIResponse): void {
  const headers = res.headers();
  console.log(
    `SWEEP ${JSON.stringify({
      route: row.route,
      who,
      method,
      status: res.status(),
      cacheControl: headers["cache-control"] ?? null,
      requestId: UUID.test(headers["x-request-id"] ?? "") ? "uuid" : "missing",
    })}`
  );
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  for (const ctx of contexts.values()) await ctx.dispose();
});

test("the table: live rows, and the skipped rows with their reasons", () => {
  expect(ROWS.length).toBeGreaterThan(0);
  for (const [route, reason] of Object.entries(SKIPPED)) {
    console.log(`SKIPPED ${route}: ${reason}`);
  }
  expect(Object.keys(SKIPPED).sort()).toEqual(
    ["/api/auth-debug", "/api/cron/send-feedback-requests", "/api/cron/send-reminders"].sort()
  );
});

test.describe("GET rows: the class value on 200/404, private otherwise, and a request id", () => {
  for (const row of ROWS.filter((r) => r.methods.includes("GET"))) {
    test(`GET ${row.route}`, async () => {
      const url = concrete(row.route);
      for (const who of ["anonymous", personaFor(row)] as const) {
        const ctx = await contextFor(who);
        const res = await ctx.get(url, { maxRedirects: 0 });
        record(row, who, "GET", res);
        const headers = res.headers();
        expect(
          { who, status: res.status(), cacheControl: headers["cache-control"] },
          `${who} GET ${row.route}`
        ).toEqual({
          who,
          status: res.status(),
          cacheControl: expectedCacheControl(row, res.status()),
        });
        expect(headers["x-request-id"], `${who} GET ${row.route} x-request-id`).toMatch(UUID);
        if (who === "anonymous" && isPublic(row)) {
          expect(res.status(), "a public read answers 200 anonymously").toBe(200);
        }
      }
      covered.gets.add(row.route);
    });
  }
});

test.describe("mutations, anonymous and bodiless: refused, and private", () => {
  for (const row of ROWS) {
    for (const method of row.methods.filter((m) => m !== "GET")) {
      test(`${method} ${row.route}`, async () => {
        const ctx = await contextFor("anonymous");
        const res = await ctx.fetch(concrete(row.route), { method, maxRedirects: 0 });
        record(row, "anonymous", method, res);
        const exception = MUTATION_STATUS_EXCEPTIONS[`${method} ${row.route}`];
        if (exception) {
          expect(res.status(), exception.reason).toBe(exception.status);
        } else {
          expect([400, 401, 403], `${method} ${row.route}`).toContain(res.status());
        }
        expect(res.headers()["cache-control"], `${method} ${row.route}`).toBe(PRIVATE);
        expect(res.headers()["x-request-id"]).toMatch(UUID);
        covered.mutations.add(`${method} ${row.route}`);
      });
    }
  }
});

test("the sweep covered every live GET row and every mutation method", () => {
  const gets = ROWS.filter((r) => r.methods.includes("GET")).map((r) => r.route);
  const mutations = ROWS.flatMap((r) =>
    r.methods.filter((m) => m !== "GET").map((m) => `${m} ${r.route}`)
  );
  expect([...covered.gets].sort()).toEqual(gets.sort());
  expect([...covered.mutations].sort()).toEqual(mutations.sort());
  console.log(
    `COVERAGE live_rows=${ROWS.length} get_rows=${gets.length} get_requests=${gets.length * 2} mutation_methods=${mutations.length} skipped=${Object.keys(SKIPPED).length}`
  );
});
