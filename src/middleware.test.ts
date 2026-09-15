/**
 * Characterization tests for the middleware matcher.
 *
 * PRESERVE suite. `src/middleware.ts` is this application's only page-level
 * authentication ring; it also carries the rate limiter, the ban check and the
 * onboarding guard. Phase 2 batch 3 renames the file to `src/proxy.ts` in one
 * atomic commit. If that rename silently narrows the matcher, every protected
 * page becomes public and nothing else in the suite notices. These assertions
 * record the include/exclude sets of today's matcher so the rename can be
 * proven identical rather than asserted identical.
 *
 * This file is renamed to `src/proxy.test.ts` inside the same batch-3 commit;
 * only the import specifier changes.
 *
 * WHY Next's OWN COMPILER AND NOT A REGEX:
 *   `unstable_doesMiddlewareMatch` runs the real matcher compiler, including
 *   the `_next/data` special case. A hand-rolled regex test asserts our regex,
 *   not Next's. The export is named for MIDDLEWARE, not for proxy: the Next
 *   documentation shows a proxy-named variant of this helper, and that export
 *   exists in neither the installed 16.2.1 nor 16.3.5 (both tarballs were
 *   checked). Importing the documented name fails at run time with an
 *   is-not-a-function TypeError that reads like a Jest ESM interop problem and
 *   sends you down entirely the wrong road. Do not "fix" this import to match
 *   the docs page — the docs page is ahead of the shipped code.
 *
 * The subject is imported only. This suite never modifies, wraps, or
 * re-exports anything from `src/middleware.ts`.
 */

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "./middleware";

// ─── Paths under test ────────────────────────────────────────────────────────
// PROTECTED_ROUTES is src/middleware.ts:114, read from the source array literal.
// The remaining included paths are public surfaces that still need the ring to
// run on them (the rate limiter, the ban check and the onboarding guard all
// live behind this same matcher).

const PROTECTED_ROUTES = [
  "/my-events",
  "/create-event",
  "/notifications",
  "/profile",
  "/settings",
  "/my-clubs",
  "/invites",
  "/friends",
];

const OTHER_INCLUDED_PATHS = [
  "/",
  "/api/events",
  "/docs",
  "/banned",
  "/onboarding",
];

// src/middleware.ts:156 — the single negative-lookahead matcher entry.
const EXCLUDED_PATHS = [
  "/_next/static/chunks/main-app.js",
  "/_next/image",
  "/favicon.ico",
  "/auth/callback",
  "/logo.png",
  "/icon.svg",
];

// ─── Helper ──────────────────────────────────────────────────────────────────

const matches = (url: string): boolean =>
  unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("middleware matcher (PRESERVE — must be identical after the proxy rename)", () => {
  it.each([...PROTECTED_ROUTES, ...OTHER_INCLUDED_PATHS])(
    "runs on %s",
    (url) => {
      expect(matches(url)).toBe(true);
    }
  );

  it.each(EXCLUDED_PATHS)("skips %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  it("exports exactly one matcher entry", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher).toHaveLength(1);
  });
});
