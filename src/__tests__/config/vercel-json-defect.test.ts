/**
 * DEFECT characterization — F-025 and F-026: vercel.json applied one shared
 * cache directive to every API route (plan 06-07 pinned it; plan 06-14
 * deleted the rule once every route declared its own class, REFAC-19)
 *
 * Measured at f550de9 by reading the file. `vercel.json` carried a single
 * `headers` rule, source `/api/(.*)`, setting
 * `Cache-Control: s-maxage=60, stale-while-revalidate=300`. With no
 * `private` and no `no-store`, Vercel's CDN could store any API answer that
 * did not set its own header, keyed on the URL alone (F-025), including all
 * the admin and authenticated GET arms (F-026; their header is pinned by
 * `src/__tests__/api/cache-headers-defect.test.ts`).
 *
 * Moved in 06-14 (defect-ledger rows, F-025 and F-026): every route handler
 * now wears `withRoute` with a declared cache class
 * (`src/__tests__/api/cache-headers-census.test.ts`, PENDING_WRAP empty), so
 * the rule is gone. What is pinned now:
 *   - V1 the file has no `headers` key at all, so no path-level rule can
 *     add a shareable directive to a response;
 *   - V2 no value anywhere in the file names `s-maxage` (a rule cannot come
 *     back under another key such as `routes`);
 *   - V3 the deploy settings are unchanged: `$schema`, `buildCommand`,
 *     `framework` and `regions` keep their values, and the only other key is
 *     the M3 preview guard below.
 * The change takes effect on the owner's next deploy.
 *
 * INTENTIONAL CHANGE (M3, owner decision 2026-10-01): `git.deploymentEnabled`
 * turns off Vercel Git deployments for `codex/*` branches. The Preview
 * environment shares the production Supabase project, which does not have the
 * M1–M3 migrations, so a pushed review branch must not build a live preview.
 * `main` stays unspecified and therefore keeps deploying.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function raw(): string {
  return readFileSync(join(process.cwd(), "vercel.json"), "utf8");
}

function vercelJson(): Record<string, unknown> {
  return JSON.parse(raw());
}

describe("vercel.json: no blanket /api cache rule (F-025, F-026 fixed)", () => {
  it("V1 has no headers key", () => {
    expect(vercelJson()).not.toHaveProperty("headers");
  });

  it("V2 names no s-maxage anywhere", () => {
    expect(raw()).not.toMatch(/s-maxage/i);
  });

  it("V3 keeps the deploy settings and adds only the codex/* preview guard", () => {
    expect(vercelJson()).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      buildCommand: "npm run build",
      framework: "nextjs",
      regions: ["iad1"],
      git: { deploymentEnabled: { "codex/*": false } },
    });
  });
});
