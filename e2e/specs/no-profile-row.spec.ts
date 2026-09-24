/**
 * no-profile-row.spec.ts — a signed-in account with no `public.users` row.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-08
 *
 * WHAT IS UNDER TEST (DEC-35, F-088)
 *   Before slice 3 the ring read a missing profile as "not banned" and let the
 *   caller through. After 05-05 the proxy fails closed on it:
 *   - `/api/*` gets 403 `{"error":"Profile not found"}` as JSON;
 *   - a page request signs the user out and redirects to
 *     `/?error=profile_sync_failed`, the code the auth callback already uses.
 *
 * WHY THIS SPEC MANAGES ITS OWN AUTH USER (DEC-54)
 *   The seed is not changed in Phase 5, and the persona setup project cannot
 *   hold a session for this user anyway: its first page load is exactly the
 *   sign-out this spec asserts. So `beforeAll` creates a temporary auth user
 *   with the LOCAL service key from `localStackEnv()` (playwright.config.ts has
 *   already run `assertSeedTargetAllowed` on that target), signs it in the way
 *   `auth.setup.ts` does, and `afterAll` deletes it and proves it is gone.
 *
 * NOTHING SECRET IS PRINTED. The service key and the random password are
 * never logged, and neither appears in an assertion message.
 */

import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { BASE_URL } from "../../playwright.config";
import { localStackEnv } from "../env";
import { IDS } from "../fixtures";

const TEMP_EMAIL = "p5-no-profile@mail.mcgill.ca";

test.describe.serial("a signed-in account with no profile row (DEC-35)", () => {
  let admin: SupabaseClient;
  let userId = "";
  let context: BrowserContext | null = null;

  /** Every auth user carrying TEMP_EMAIL, so a leftover from a crashed run is removed. */
  async function idsForTempEmail(): Promise<string[]> {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(error).toBeNull();
    return data.users.filter((u) => u.email === TEMP_EMAIL).map((u) => u.id);
  }

  test.beforeAll(async ({ browser }) => {
    const stack = localStackEnv();
    admin = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false },
    });

    for (const leftover of await idsForTempEmail()) {
      await admin.auth.admin.deleteUser(leftover);
    }

    const password = randomUUID();
    const created = await admin.auth.admin.createUser({
      email: TEMP_EMAIL,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;

    // The precondition this spec exists for: no public.users row.
    const row = await admin.from("users").select("id").eq("id", userId);
    expect(row.error).toBeNull();
    expect(row.data ?? []).toHaveLength(0);

    // Sign in exactly as auth.setup.ts does: the library's own serializer,
    // every setAll emission accumulated, nothing hand-built.
    const emitted: { name: string; value: string; options: CookieOptions }[] = [];
    const client = createServerClient(stack.url, stack.anonKey, {
      cookies: {
        getAll: () => [],
        setAll: (toSet) => {
          emitted.push(...toSet);
        },
      },
    });
    const signIn = await client.auth.signInWithPassword({ email: TEMP_EMAIL, password });
    expect(signIn.error).toBeNull();
    expect(emitted.length).toBeGreaterThan(0);

    context = await browser.newContext({ bypassCSP: true, baseURL: BASE_URL });
    await context.addCookies(
      emitted.map((c) => ({
        name: c.name,
        value: c.value,
        url: BASE_URL,
        httpOnly: false,
        sameSite: "Lax" as const,
      }))
    );
  });

  test.afterAll(async () => {
    await context?.close();
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      expect(error).toBeNull();
    }
    expect(await idsForTempEmail()).toHaveLength(0);
  });

  test("an API call gets a JSON 403 Profile not found", async () => {
    const res = await context!.request.post(`/api/events/${IDS.approvedEvent}/save`);
    expect(res.status()).toBe(403);
    expect(res.headers()["content-type"] ?? "").toContain("application/json");
    expect(await res.json()).toEqual({ error: "Profile not found" });
  });

  test("a page request is signed out and sent to /?error=profile_sync_failed", async () => {
    const page = await context!.newPage();
    await page.goto("/");

    const landed = new URL(page.url());
    expect(landed.pathname).toBe("/");
    expect(landed.searchParams.get("error")).toBe("profile_sync_failed");

    // Signed out: the same context is now anonymous, so a signed-in-only read
    // is a 401 from the handler rather than the proxy's 403 Profile not found.
    const after = await context!.request.get("/api/users/saved-events");
    expect(after.status()).toBe(401);
    await page.close();
  });
});
