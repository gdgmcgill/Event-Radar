/**
 * Root layout metadata (P1-06 fix round 1, finding 6): `metadataBase` must
 * be set to the production origin the sitemap already hard-codes, so every
 * relative canonical/OG/Twitter URL emitted by a page's `generateMetadata`
 * (events, opportunities, resources) resolves to an absolute URL instead of
 * a bare path.
 *
 * Read as source rather than imported: `src/app/layout.tsx` pulls in
 * `next/font/google` and a `.css` import that this project's Jest config
 * does not transform, so importing the module directly is impractical here.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("root layout metadata", () => {
  it("sets metadataBase to https://universeapp.ca", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    );
    expect(source).toMatch(
      /metadataBase:\s*new URL\(\s*["']https:\/\/universeapp\.ca["']\s*\)/
    );
  });
});
