/**
 * DEFECT characterization — F-025 and F-026: vercel.json applies one shared
 * cache directive to every API route (plan 06-07 pins it; plan 06-14 deletes
 * the rule once every route sets its own class, REFAC-19)
 *
 * Measured at f550de9 by reading the file. `vercel.json` carries a single
 * `headers` rule, source `/api/(.*)`, setting
 * `Cache-Control: s-maxage=60, stale-while-revalidate=300`. With no
 * `private` and no `no-store`, Vercel's CDN may store any API answer that
 * does not set its own header, keyed on the URL alone (F-025), including all
 * the admin and authenticated GET arms (F-026; their missing header is
 * pinned by `src/__tests__/api/cache-headers-defect.test.ts`).
 *
 * What is pinned:
 *   - V1 the rule exists, exactly once, with that source, key and value;
 *   - V2 the value names neither `private` nor `no-store`;
 *   - V3 it is the file's only headers rule.
 *
 * When 06-14 deletes the rule, V1-V3 MOVE: the `headers` key is absent, with
 * a defect-ledger row citing F-025 and F-026.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

function vercelJson(): { headers?: HeaderRule[] } {
  return JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
}

describe("vercel.json: the blanket /api cache rule", () => {
  it("V1 carries /api/(.*) → Cache-Control: s-maxage=60, stale-while-revalidate=300", () => {
    const rules = (vercelJson().headers ?? []).filter((rule) => rule.source === "/api/(.*)");
    expect(rules).toHaveLength(1);
    expect(rules[0].headers).toEqual([
      { key: "Cache-Control", value: "s-maxage=60, stale-while-revalidate=300" },
    ]);
  });

  it("V2 the value is shareable: neither private nor no-store", () => {
    const value = vercelJson().headers?.[0]?.headers[0]?.value ?? "";
    expect(value).not.toMatch(/private/);
    expect(value).not.toMatch(/no-store/);
  });

  it("V3 it is the only headers rule in the file", () => {
    expect((vercelJson().headers ?? []).map((rule) => rule.source)).toEqual(["/api/(.*)"]);
  });
});
