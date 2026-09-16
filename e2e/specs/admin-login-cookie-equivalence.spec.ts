/**
 * admin-login-cookie-equivalence.spec.ts — the shim, cross-checked against the
 * real sign-in surface.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * WHAT THIS CONVERTS FROM ASSUMPTION TO ASSERTION.
 *   `e2e/auth.setup.ts` produces persona sessions by handing `@supabase/ssr`'s
 *   own serializer a password sign-in and capturing what it emits. The claim
 *   underneath the whole harness is that those cookies are the same cookies the
 *   application itself would have set. That claim is testable exactly once, on
 *   exactly one persona:
 *
 *   `src/app/admin-login/page.tsx` is a REAL, SHIPPED password sign-in surface
 *   that uses the app's own browser client — and it signs out any account whose
 *   `roles` lacks `admin`. So the admin persona is the only one that can sign in
 *   through the product's own UI, and this is the only spec that may do so.
 *
 * COOKIE NAMES, NOT VALUES. Two sign-ins produce two different tokens; the
 * values SHOULD differ. What must match is the set of cookie names, because that
 * is what encodes the storage key and the chunking the app's own reader expects.
 *
 * THE ONLY RE-AUTHENTICATION IN THE SUITE. Every other spec consumes a storage
 * state. `config.toml`'s `[auth.rate_limit] sign_in_sign_ups` is 30 per five
 * minutes per IP, and a suite that re-authenticated per spec would trip it in a
 * way that reads like an outage. An acceptance criterion caps
 * `signInWithPassword` in this directory at one occurrence, and this is it.
 *
 * NO STORAGE STATE. This spec must start signed OUT — it is testing the act of
 * signing in — so it deliberately declares `storageState: undefined` rather than
 * inheriting whatever the project default would give it.
 */

import { expect, test } from "@playwright/test";

import { PERSONA_CREDENTIALS, storageStateFor } from "../fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test("the cookie shim emits the same cookie names the real sign-in page does", async ({
  page,
  context,
}) => {
  const admin = PERSONA_CREDENTIALS.admin;

  await page.goto("/admin-login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  // Scoped to the form: the shell also renders "Sign In with McGill Email" for a
  // signed-out visitor, and an unscoped /sign in/i matches both.
  await page.locator("form").getByRole("button", { name: "Sign In", exact: true }).click();

  // The page routes to /moderation only for an account that carries the admin
  // role. Reaching it is itself the proof that the seeded roles array is right.
  await page.waitForURL("**/moderation", { timeout: 30_000 });

  const fromRealUi = (await context.cookies())
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name)
    .sort();

  expect(
    fromRealUi.length,
    "the real sign-in page must set at least one Supabase auth cookie"
  ).toBeGreaterThan(0);

  // The shim's output for the same persona, read off the storage state the
  // setup project wrote earlier in this very run.
  const fs = await import("node:fs");
  const state = JSON.parse(
    fs.readFileSync(storageStateFor("admin"), "utf8")
  ) as { cookies: { name: string }[] };

  const fromShim = state.cookies
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-"))
    .sort();

  expect(
    fromShim,
    "the cookie names the shim emits must match the ones the application's own " +
      "sign-in page emits — otherwise the harness is testing a session shape the " +
      "app does not use"
  ).toEqual(fromRealUi);
});
