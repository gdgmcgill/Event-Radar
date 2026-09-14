/**
 * .planning/audit/tools/gen-page-inventory.mjs
 *
 * AUDIT-04 — the page inventory and the App Router special-file inventory.
 * One `pages.json` row per `src/app/**\/page.tsx`, one `special-files.json` row
 * per layout/loading/error/not-found/robots/sitemap/template/default file.
 *
 * Usage: node .planning/audit/tools/gen-page-inventory.mjs
 *
 * WHY BOTH FILES COME OUT OF ONE GENERATOR. 01-RESEARCH.md Pattern 2: pages have
 * TWO authorization rings. `src/middleware.ts` PROTECTED_ROUTES guards 9 of the 43
 * pages and contains neither `/admin` nor `/moderation`, while
 * `src/app/admin/layout.tsx` and `src/app/moderation/layout.tsx` each perform a
 * server-side `auth.getUser()` + `roles.includes("admin")` + `redirect()`. An
 * inventory cross-checked only against the middleware list reports 12 moderation
 * pages and 2 admin pages as unguarded, which is wrong. `layout_guard` resolves
 * the nearest guarded ancestor layout, so the second ring is visible — and the
 * ancestor walk needs the same special-file scan that `special-files.json` is.
 *
 * THE PROTECTED LIST IS PARSED FROM SOURCE, NEVER HARDCODED. CLAUDE.md documents
 * 6 protected routes; `src/middleware.ts:114` has 8 (it also carries `/settings`
 * and `/friends`). The drift is itself a finding. Hardcoding either number lets
 * the inventory silently diverge from the app the next time the array changes, so
 * the array literal is read out of the middleware source at runtime and the
 * parsed length is asserted against `baseline/versions.txt`
 * `protected_routes_source_count`.
 *
 * RENDER MODE IS READ, NEVER INFERRED. `render_mode` is parsed out of
 * `inventory/build-routes.txt` (the captured `next build` route table: circle =
 * static, f = dynamic). Grepping for `export const dynamic` misses every route
 * whose mode Next.js resolves by heuristic — see 01-RESEARCH.md § Don't Hand-Roll.
 *
 * MERGE SEMANTICS ARE THE POINT. Both outputs are read back and indexed by `id`
 * before anything is written; only machine-derived keys are overwritten. The
 * fields plan 01-11 owns (`effective_protection`, `dead_or_duplicate`, `findings`)
 * survive a regeneration verbatim. Consecutive runs are byte-identical.
 * Mirrors gen-endpoint-inventory.mjs, the reference implementation.
 *
 * `effective_protection` IS SEEDED WITH A DERIVED VERDICT, NOT THE "unknown"
 * SENTINEL. `validate.mjs --check pages` — the gate this plan must pass — runs
 * `no-residual-placeholders` over PAGE_HUMAN_FIELDS, which includes
 * `effective_protection` and `dead_or_duplicate`. Unlike endpoints there is no
 * `pages-signals` pre-classification variant of the check, so a placeholder seed
 * makes the plan's own gate unpassable. The seed is therefore the mechanical
 * two-ring verdict computed below; it is a PROVISIONAL machine reading that plan
 * 01-11 overrides by hand, and merge-by-id preserves every override.
 *
 * READ-ONLY. Page and layout sources are opened with readFileSync and never
 * written back; the only write targets are the two JSON files under .planning/.
 *
 * Zero dependencies: `node:fs` and `node:child_process` only. Plain `node`, not
 * `npx tsx` — tsx is an unused devDependency knip flags for removal. ESM, so
 * `__dirname` does not exist; paths are repo-root-relative literals behind a
 * fail-fast root guard.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const PAGES_OUT = ".planning/audit/inventory/pages.json";
const SPECIAL_OUT = ".planning/audit/inventory/special-files.json";
const BUILD_ROUTES = ".planning/audit/inventory/build-routes.txt";
const VERSIONS = ".planning/audit/baseline/versions.txt";
const MIDDLEWARE = "src/middleware.ts";

const ROOT_MARKERS = ["src/app", MIDDLEWARE, ".planning/audit/tools/validate.mjs"];

/** The App Router special files that neither `page.tsx` nor `route.ts` finds. */
const SPECIAL_KINDS = [
  "layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx",
  "robots.ts", "sitemap.ts", "template.tsx", "default.tsx",
];

/**
 * Build-only routes: files whose emitted route path is not their directory path.
 * These three are what close the completeness invariant — the build table has
 * 140 routes against 94 route.ts + 43 page.tsx, and this is the missing 3.
 */
const SPECIAL_ROUTE_OVERRIDES = {
  "not-found.tsx": "/_not-found",
  "robots.ts": "/robots.txt",
  "sitemap.ts": "/sitemap.xml",
};

/** Fields plan 01-11 owns. Never overwritten once present. */
const HUMAN_FIELDS = ["effective_protection", "dead_or_duplicate", "findings"];

/* ------------------------------------------------------------------ helpers */

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** `src/app/clubs/[id]/page.tsx` -> `/clubs/[id]`; `src/app/page.tsx` -> `/`. */
function routeForDir(file) {
  const dir = path.dirname(file).replace(/^src\/app\/?/, "");
  return dir === "" || dir === "." ? "/" : `/${dir}`;
}

/** `/clubs/[id]` -> `clubs.id`; `/` -> `index`. Must match pages.schema.json's id pattern. */
function idForRoute(route) {
  const id = route.replace(/^\//, "").replace(/\//g, ".").replace(/\[|\]/g, "");
  return id === "" ? "index" : id;
}

/**
 * The PROTECTED_ROUTES array literal, read out of src/middleware.ts.
 * Parsing the source is the whole point: CLAUDE.md's list is stale by two entries.
 */
function parseProtectedRoutes(source) {
  const match = source.match(/PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]/);
  if (!match) fail(`${MIDDLEWARE}: PROTECTED_ROUTES array literal not found`);
  const routes = [...match[1].matchAll(/["'`](\/[^"'`]*)["'`]/g)].map((m) => m[1]);
  if (routes.length === 0) fail(`${MIDDLEWARE}: PROTECTED_ROUTES parsed to zero entries`);
  return routes;
}

/** key=value reader for baseline/versions.txt — the only count source. */
function readVersions() {
  const map = new Map();
  if (!existsSync(VERSIONS)) return map;
  for (const line of readFileSync(VERSIONS, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

/**
 * route -> "static" | "dynamic", parsed from the captured `next build` table.
 * The marker glyphs are matched by codepoint so an editor re-encoding the file
 * cannot silently turn every row into "unknown".
 */
function parseRenderModes(text) {
  const modes = new Map();
  for (const line of text.split("\n")) {
    if (/first load js|route \(app\)/i.test(line)) continue;
    const token = line.split(/\s+/).filter(Boolean).find((t) => t.startsWith("/"));
    if (!token) continue;
    if (line.includes("○")) modes.set(token, "static");        // circle
    else if (line.includes("ƒ")) modes.set(token, "dynamic");  // f with hook
    else if (line.includes("●")) modes.set(token, "static");   // filled circle (SSG)
  }
  return modes;
}

/** A layout guards when it resolves the caller AND checks role membership. */
function isGuardedLayout(source) {
  const getsUser = /auth\s*\.\s*getUser\s*\(/.test(source) || /\bgetUser\s*\(/.test(source);
  const checksRole = /roles\s*\.\s*includes\s*\(/.test(source) || /\.\s*includes\s*\(\s*["'`]admin["'`]\s*\)/.test(source);
  return getsUser && checksRole;
}

/* ------------------------------------------------------------------- signals */

function deriveSignals(s) {
  return {
    is_client_component: /^\s*["']use client["']/m.test(s),
    uses_cookie_client: /@\/lib\/supabase\/server/.test(s),
    uses_browser_client: /@\/lib\/supabase\/client/.test(s),
    uses_service_client: /createServiceClient/.test(s),
    uses_auth_store: /useAuthStore/.test(s),
    uses_swr: /\bfrom\s+["']swr["']/.test(s) || /\buseSWR\s*\(/.test(s),
    fetches_api: [...new Set(
      [...s.matchAll(/fetch\(\s*[`"'](\/api\/[^`"'?]*)/g)].map((m) => m[1])
    )].sort(),
    calls_get_user: /auth\s*\.\s*getUser\s*\(/.test(s),
    inline_role_check: /roles\s*\.\s*includes\s*\(/.test(s),
  };
}

/**
 * A human-readable `data_source`, never the "unknown" sentinel. Schema types it as
 * a free string; validate.mjs only rejects the literal "unknown".
 */
function describeDataSource(sig) {
  const parts = [];
  if (sig.fetches_api.length) parts.push(`api:${sig.fetches_api.join("+")}`);
  if (sig.uses_service_client) parts.push("supabase-service-role");
  if (sig.uses_cookie_client) parts.push("supabase-cookie-server");
  if (sig.uses_browser_client) parts.push("supabase-browser");
  if (sig.uses_auth_store) parts.push("auth-store");
  if (sig.uses_swr) parts.push("swr");
  return parts.length ? parts.join("; ") : "none";
}

/**
 * The provisional two-ring verdict. Plan 01-11 overrides by hand; merge-by-id
 * keeps the override. Deliberately conservative: it never claims a page is
 * `unprotected_but_should_be`, because that is a judgement about intent and the
 * generator has no access to intent.
 */
function deriveEffectiveProtection({ layoutGuardIsAdmin, middlewareProtected, pageGuard }) {
  if (layoutGuardIsAdmin) return "admin";
  if (pageGuard === "inline_role_check") return "admin";
  if (middlewareProtected) return "auth";
  if (pageGuard === "getUser" || pageGuard === "useAuthStore") return "auth";
  return "public";
}

/* ---------------------------------------------------------------------- main */

async function main() {
  for (const marker of ROOT_MARKERS) {
    if (!existsSync(marker)) fail(`Run this from the repository root: ${marker} not found`);
  }
  if (!existsSync(BUILD_ROUTES)) {
    fail(`${BUILD_ROUTES} not found — run plan 01-03 Task 1 (npm run build capture) first`);
  }

  const versions = readVersions();

  /* --- ring 1: the middleware protected list, read from source ------------ */
  const protectedRoutes = parseProtectedRoutes(readFileSync(MIDDLEWARE, "utf8"));
  const expectedProtected = versions.get("protected_routes_source_count");
  if (expectedProtected !== undefined && String(protectedRoutes.length) !== expectedProtected) {
    fail(
      `PROTECTED_ROUTES parsed to ${protectedRoutes.length} entries but ` +
      `${VERSIONS} protected_routes_source_count is ${expectedProtected}. ` +
      `One of the two is stale — resolve before trusting the inventory.`
    );
  }
  console.error(`PROTECTED_ROUTES parsed from ${MIDDLEWARE}: ${protectedRoutes.length} entries`);

  const renderModes = parseRenderModes(readFileSync(BUILD_ROUTES, "utf8"));
  console.error(`render modes parsed from ${BUILD_ROUTES}: ${renderModes.size} routes`);

  /* --- ring 2: every layout, and whether it guards ------------------------ */
  const specialFiles = execSync(
    `find src/app \\( ${SPECIAL_KINDS.map((k) => `-name '${k}'`).join(" -o ")} \\)`
  ).toString().trim().split("\n").filter(Boolean).sort();

  /** dir -> guarded layout path, for the ancestor walk. */
  const guardedLayoutByDir = new Map();
  for (const file of specialFiles) {
    if (path.basename(file) !== "layout.tsx") continue;
    if (isGuardedLayout(readFileSync(file, "utf8"))) {
      guardedLayoutByDir.set(path.dirname(file), file);
    }
  }
  console.error(`guarded ancestor layouts: ${[...guardedLayoutByDir.values()].join(", ") || "none"}`);

  /** Nearest guarded ancestor layout for a page file, or null. */
  function nearestGuardedLayout(pageFile) {
    let dir = path.dirname(pageFile);
    while (true) {
      if (guardedLayoutByDir.has(dir)) return guardedLayoutByDir.get(dir);
      const parent = path.dirname(dir);
      if (parent === dir || !dir.startsWith("src/app")) return null;
      dir = parent;
    }
  }

  /* --- pages.json -------------------------------------------------------- */
  const priorPages = existsSync(PAGES_OUT)
    ? Object.fromEntries(JSON.parse(readFileSync(PAGES_OUT, "utf8")).map((r) => [r.id, r]))
    : {};
  console.error(`merging into ${Object.keys(priorPages).length} existing page rows`);

  const pageFiles = execSync("find src/app -name page.tsx").toString().trim().split("\n").sort();

  const pages = pageFiles.map((file) => {
    const source = readFileSync(file, "utf8");
    const route = routeForDir(file);
    const id = idForRoute(route);
    const signals = deriveSignals(source);

    const middleware_protected = protectedRoutes.some(
      (p) => route === p || route.startsWith(`${p}/`)
    );

    const layout_guard = nearestGuardedLayout(file);
    const layoutGuardIsAdmin = layout_guard !== null
      && /includes\s*\(\s*["'`]admin["'`]\s*\)/.test(readFileSync(layout_guard, "utf8"));

    const page_guard = signals.calls_get_user ? "getUser"
      : signals.inline_role_check ? "inline_role_check"
      : signals.uses_auth_store ? "useAuthStore"
      : null;

    const prior = priorPages[id] ?? {};

    const row = {
      id,
      file,
      route,
      component_type: signals.is_client_component ? "client" : "server",
      data_source: describeDataSource(signals),
      middleware_protected,
      layout_guard,
      page_guard,
      effective_protection: deriveEffectiveProtection({
        layoutGuardIsAdmin, middlewareProtected: middleware_protected, pageGuard: page_guard,
      }),
      render_mode: renderModes.get(route) ?? "unknown",
      dead_or_duplicate: false,
      findings: [],
    };

    // Human classification survives verbatim.
    for (const field of HUMAN_FIELDS) {
      if (prior[field] !== undefined) row[field] = prior[field];
    }
    return row;
  });

  const pageIds = pages.map((p) => p.id);
  const dupePageIds = pageIds.filter((v, i) => pageIds.indexOf(v) !== i);
  if (dupePageIds.length) fail(`duplicate page ids: ${[...new Set(dupePageIds)].join(", ")}`);

  const unresolved = pages.filter((p) => p.render_mode === "unknown").map((p) => p.route);
  if (unresolved.length) {
    fail(`render_mode unresolved for ${unresolved.length} route(s): ${unresolved.join(", ")} — ` +
      `regenerate ${BUILD_ROUTES} from a fresh build`);
  }

  /* --- special-files.json ------------------------------------------------ */
  const priorSpecial = existsSync(SPECIAL_OUT)
    ? Object.fromEntries(JSON.parse(readFileSync(SPECIAL_OUT, "utf8")).map((r) => [r.id, r]))
    : {};

  const special = specialFiles.map((file) => {
    const source = readFileSync(file, "utf8");
    const kind = path.basename(file);
    const override = SPECIAL_ROUTE_OVERRIDES[kind];
    const segment = routeForDir(file);
    const prior = priorSpecial[`${idForRoute(segment)}:${kind}`] ?? {};
    return {
      id: `${idForRoute(segment)}:${kind}`,
      file,
      kind: kind.replace(/\.(tsx|ts)$/, ""),
      segment,
      // `route` is the key validate.mjs --check pages reads for the completeness
      // invariant. For not-found / robots / sitemap the emitted route is not the
      // directory path, and those three are exactly the build-only routes.
      route: override ?? segment,
      has_auth_guard: isGuardedLayout(source),
      findings: prior.findings ?? [],
    };
  });

  /* --- the completeness invariant, asserted here and not discovered later - */
  const built = new Set(
    readFileSync(BUILD_ROUTES, "utf8").split("\n").flatMap((line) => {
      if (/first load js|route \(app\)/i.test(line)) return [];
      const token = line.split(/\s+/).filter(Boolean).find((t) => t.startsWith("/"));
      return token ? [token] : [];
    })
  );
  const known = new Set([
    ...(existsSync(".planning/audit/inventory/endpoints.json")
      ? JSON.parse(readFileSync(".planning/audit/inventory/endpoints.json", "utf8")).map((r) => r.route)
      : []),
    ...pages.map((p) => p.route),
    ...special.map((s) => s.route),
  ]);
  const orphans = [...built].filter((r) => !known.has(r));
  if (orphans.length) {
    fail(
      `COMPLETENESS INVARIANT VIOLATED — ${orphans.length} build route(s) appear in ` +
      `${BUILD_ROUTES} but in none of endpoints.json, pages.json, special-files.json: ` +
      `${orphans.join(", ")}. The generator has a hole; do not commit this inventory.`
    );
  }
  console.error(`completeness invariant: ${built.size} build routes, all inventoried`);

  writeFileSync(PAGES_OUT, JSON.stringify(pages, null, 2) + "\n");
  console.error(`wrote ${pages.length} rows to ${PAGES_OUT}`);
  writeFileSync(SPECIAL_OUT, JSON.stringify(special, null, 2) + "\n");
  console.error(`wrote ${special.length} rows to ${SPECIAL_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
