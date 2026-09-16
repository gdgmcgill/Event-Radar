/**
 * playwright.config.ts — the persona harness (REFAC-06)
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * HAND-WRITTEN, NOT SCAFFOLDED. `npm init playwright` would have added a
 * `tests/` directory, an example spec and a second GitHub workflow file that
 * would sit beside the single existing `ci.yml` — three unreviewed additions in
 * a phase whose lockfile discipline requires every change to be a reviewed diff.
 * Twenty-five lines written deliberately is the cheaper honest option.
 *
 * COEXISTENCE WITH JEST, WHICH REMAINS THE ONLY UNIT RUNNER.
 *   `testDir` points OUTSIDE `src/`. Jest's two `testMatch` globs are both
 *   rooted at `src/` — the node project matches ts files under it, the jsdom
 *   project matches tsx files and the hooks directory — so neither can reach
 *   `e2e/`. **`jest.config.js` is not edited by this plan**
 *   and does not need to be; an acceptance criterion asserts it is untouched.
 *
 * THE SPEC DIRECTORY IS INSIDE THE TYPE-CHECK, ON PURPOSE (decision D-14).
 *   `tsconfig.json` includes every ts file in the tree and excludes only the
 *   two test-file globs, so the specs land inside `npx tsc --noEmit`, which CI
 *   runs. That overrides the project's general "test files are excluded
 *   from the main tsconfig" guideline, and it is wanted: `@playwright/test` ships
 *   its own types, and a spec with a type error SHOULD fail CI. Do not add the
 *   spec directory to `exclude` — that would look like tidying and would be a
 *   regression.
 *
 * ONE WORKER, ALWAYS.
 *   The seed is shared mutable state: the save-and-RSVP spec writes rows that
 *   other specs read. Parallel workers would race on it and the failures would
 *   be intermittent, which is the worst kind. A suite this size does not need
 *   the parallelism, and a flaky harness is worse than a slow one in a phase
 *   whose whole purpose is to be a trustworthy safety net.
 *
 * THE SERVER IS BOUND TO THE LOCAL STACK, AND REFUSES ANYTHING ELSE.
 *   `NEXT_PUBLIC_SUPABASE_URL` is handed to the seed loader's OWN guard below,
 *   before Playwright starts anything. A harness that signed ten personas into
 *   production would be the same failure mode the seed guard exists to prevent,
 *   one layer up, so it is the same control rather than a second one.
 *
 *   `.env.local` is never read for these values — `e2e/env.ts` takes them from
 *   `supabase status -o env`. Note that Next DOES load `.env.local` on its own;
 *   the explicit `env` block below is what keeps the process environment (which
 *   wins) pointing at the local stack.
 *
 * A PRODUCTION BUILD, NOT THE DEV SERVER — AND THIS WAS MEASURED, NOT PREFERRED.
 *   Under `next dev`, the pages this harness drives never finish hydrating in
 *   Playwright's Chromium: the Turbopack HMR websocket handshake fails with
 *   ERR_INVALID_HTTP_RESPONSE, `AuthProvider`'s effect never runs, and the store
 *   therefore never sees the injected session — while the PROXY sees it
 *   perfectly, which makes the symptom read like a cookie bug rather than a
 *   hydration one. It cost an afternoon; it is written down here so it costs
 *   nobody else one.
 *
 *   `npm run build && npm run start` has no HMR, hydrates, and is also the
 *   honest target: it is the artifact that deploys. The plan sanctions either.
 *
 * `bypassCSP` IS ON, AND THAT IS A LIMITATION THIS HARNESS OWNS RATHER THAN HIDES.
 *   `next.config.js` sets an unconditional
 *   `connect-src 'self' https://*.supabase.co wss://*.supabase.co ...`.
 *   The LOCAL stack is `http://127.0.0.1:54321`, which that list does not admit,
 *   so the browser refuses every client-side Supabase call before it leaves —
 *   `Refused to connect because it violates the document's Content Security
 *   Policy`, surfacing in the UI as a bare "Failed to fetch". The server side is
 *   unaffected, which makes the symptom read like a cookie bug for a while.
 *
 *   The CSP is CORRECT for production, where the app really does talk to
 *   `https://<ref>.supabase.co`. It has no local-development entry, and adding
 *   one is a change to application source — which this plan prohibits by name
 *   and which is a behaviour change in a phase whose core value is behaviour
 *   preservation. Registered as a finding for a later phase; see
 *   `evidence/harness-note.md`.
 *
 *   The consequence to state plainly: **this harness does not exercise the CSP.**
 *   Nothing here would notice if that header were weakened or removed.
 */

import { defineConfig, devices } from "@playwright/test";

import { assertSeedTargetAllowed } from "./scripts/seed/guard";
import { localStackEnv } from "./e2e/env";

export const BASE_URL = "http://127.0.0.1:3000";

const stack = localStackEnv();

// The same control the seed loader uses, applied to the application's own
// configuration. If this throws, nothing starts — which is the point.
assertSeedTargetAllowed(stack.url);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // See the CSP note above. Without this, every client-side Supabase call the
    // application makes is refused by the browser before it leaves.
    bypassCSP: true,
  },
  projects: [
    // One sign-in per persona per run. The local stack rate-limits sign-ins
    // (config.toml [auth.rate_limit] sign_in_sign_ups = 30 per five minutes per
    // IP) and a suite that re-authenticated inside specs would trip it in a way
    // that reads like an outage. This project is the only place that signs in.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /specs\/.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: stack.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    },
  },
});
