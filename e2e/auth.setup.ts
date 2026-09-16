/**
 * auth.setup.ts — ten persona sessions, produced by the library's own serializer.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * THE PROBLEM THIS SOLVES. The application signs in with Google OAuth only
 * (`SignInButton.tsx` → `signInWithOAuth`), which cannot run against a local
 * Supabase stack. Three options were evaluated (research § Pattern 6):
 *
 *   - drive `/admin-login` — real and shipped, but it signs out any account
 *     whose `roles` lacks `admin`, so it works for exactly one persona;
 *   - add a test-only sign-in route — REJECTED. A new route is a behaviour
 *     change and an attack surface, in the phase whose core value is behaviour
 *     preservation. It is prohibited by name in this plan;
 *   - hand the library's own cookie serializer a password sign-in and capture
 *     what it emits. That is what this file does.
 *
 * NO COOKIE IS EVER HAND-BUILT. The chunking threshold and the encoding prefix
 * of `sb-<ref>-auth-token` are internal to `@supabase/ssr` and have changed
 * between minor versions. Every cookie below came out of the library's own
 * `setAll`, and ALL emissions are accumulated rather than the first one taken —
 * sessions are chunked across several cookies, and `src/app/auth/callback/
 * route.ts` accumulates for exactly this reason.
 *
 * THE SESSION IS PROVEN THROUGH THE RUNNING APPLICATION, NOT THROUGH THE CLIENT.
 * After injecting the cookies, each persona loads the home page and the signed-
 * out affordance must be gone. A `getUser()` check would only prove the client
 * was happy; this proves the cookies the app receives produce a session the app
 * accepts. It is the assertion that resolves the two load-bearing cookie
 * assumptions — that injected cookies are honoured, and that the flags used are
 * right. If it fails, the flags are the first thing to revisit.
 *
 * ONE SIGN-IN PER PERSONA PER RUN. The local stack rate-limits sign-ins
 * (`config.toml` `[auth.rate_limit] sign_in_sign_ups = 30` per five minutes per
 * IP). This project is the only place that authenticates; no spec does.
 *
 * NO APPLICATION FILE IS TOUCHED. The harness adapts to the app, never the
 * reverse.
 */

import fs from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { PERSONAS } from "../scripts/seed/personas";
import { localStackEnv } from "./env";
import { BASE_URL } from "../playwright.config";
import { SIGN_IN_AFFORDANCE, STORAGE_STATE_DIR, storageStateFor } from "./fixtures";

const stack = localStackEnv();

setup.beforeAll(() => {
  fs.mkdirSync(path.resolve(process.cwd(), STORAGE_STATE_DIR), { recursive: true });
});

for (const persona of PERSONAS) {
  setup(`authenticate as ${persona.key}`, async ({ browser }) => {
    const emitted: { name: string; value: string; options: CookieOptions }[] = [];

    const client = createServerClient(stack.url, stack.anonKey, {
      cookies: {
        // Nothing to read: this client exists only to emit a fresh session.
        getAll: () => [],
        // Accumulate. A session is chunked across several cookies and taking
        // only the first would produce a state that looks right and is not.
        setAll: (toSet) => {
          emitted.push(...toSet);
        },
      },
    });

    const { error } = await client.auth.signInWithPassword({
      email: persona.email,
      password: persona.password,
    });
    expect(error, `${persona.key} must sign in — is the seed loaded?`).toBeNull();
    expect(emitted.length, `${persona.key} must emit at least one cookie`).toBeGreaterThan(0);

    // bypassCSP: the app's connect-src allow-lists https://*.supabase.co only,
    // so without this the browser refuses every client-side call to the LOCAL
    // stack. See the long note in playwright.config.ts — this context is built
    // by hand and therefore does not inherit the project's `use` block.
    const context = await browser.newContext({ bypassCSP: true });
    await context.addCookies(
      emitted.map((c) => ({
        name: c.name,
        value: c.value,
        url: BASE_URL,
        // @supabase/ssr's browser cookies are readable by JS — the browser
        // client reads document.cookie — so httpOnly must be false or the
        // Zustand store would never see the session the proxy already has.
        httpOnly: false,
        sameSite: "Lax" as const,
      }))
    );

    // The mid-onboarding persona is the one whose whole point is the guard
    // path in src/proxy.ts, so its state carries the guard cookie too.
    if (persona.key === "mid_onboarding_student") {
      await context.addCookies([
        { name: "needs_onboarding", value: "1", url: BASE_URL },
      ]);
    }

    const page = await context.newPage();

    // Where the app's own ring should put this persona when it asks for "/".
    // An anonymous caller reaches "/" untouched, so a redirect is itself proof
    // that the injected session was read by the proxy — and for the personas who
    // do land on "/", the absence of the signed-out affordance is the proof.
    //
    // `suspension_expired` is the interesting row: banned_at IS set, so it LOOKS
    // banned in the table, and it must still reach "/". Getting that wrong in
    // either direction is a real authorization defect, and it is checked here on
    // every run rather than only in the one spec that features it.
    const expectedLanding =
      persona.key === "mid_onboarding_student"
        ? "/onboarding"
        : persona.banned_at !== null && persona.key !== "suspension_expired"
          ? "/banned"
          : "/";

    await page.goto("/");
    expect(
      new URL(page.url()).pathname,
      `${persona.key} must be routed by the app's own ring, which proves the session is live`
    ).toBe(expectedLanding);

    if (expectedLanding === "/") {
      await expect(
        page.getByRole("button", { name: SIGN_IN_AFFORDANCE }),
        `${persona.key}'s injected cookies must produce a session the APP accepts`
      ).toHaveCount(0);
    }

    await context.storageState({ path: storageStateFor(persona.key) });
    await context.close();
  });
}
