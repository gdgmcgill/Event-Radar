/**
 * public-profile-privacy.spec.ts — a private profile is a 404 to anonymous
 * readers, and no profile page carries its owner's email.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-15
 *
 * WHAT IS UNDER TEST (F-005, DEC-48)
 *   Before 05-15, `/users/[id]` read the target on the service-role client with
 *   a select that included `email`, and gated nothing on `visibility`: an
 *   anonymous reader of a private profile got the page. 05-15 reads the target
 *   through the elevated door with a narrowed column list (no `email`) and one
 *   gate shared by `generateMetadata` and the page: anonymous viewer plus
 *   `visibility === "private"` → `notFound()`. A signed-in viewer still gets
 *   the page (with its own "private" handling), and a public profile still
 *   renders for everyone.
 *
 * WHAT "404" MEANS ON THIS ROUTE (measured; recorded in 05-15's evidence)
 *   `src/app/loading.tsx` wraps every page in a Suspense boundary, so the
 *   response starts streaming as HTTP 200 before the page runs, and a
 *   `notFound()` renders the not-found UI into the stream with
 *   `<meta name="robots" content="noindex"/>` (Next's documented soft 404:
 *   node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md,
 *   "Status Codes"). A profile id that does not exist has always answered
 *   this way. So the assertion is the one that matters to a reader: the
 *   anonymous response for a private profile is the SAME not-found response a
 *   missing profile gets (same status, same title, noindex), and it carries
 *   neither the owner's name nor their email.
 *
 * STATE (DEC-54)
 *   Every seeded persona is `visibility: "public"` (scripts/seed/load.ts). The
 *   spec flips onboarded_student to private through the product's own route
 *   (`PATCH /api/users/[id]`, which 05-15 moved to the cookie client, so this
 *   also proves the self-update on the real policies) and restores the seed's
 *   value in a `finally` block. `afterAll` re-reads the row with the LOCAL
 *   service key and asserts it is public again.
 */

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { BASE_URL } from "../../playwright.config";
import { localStackEnv } from "../env";
import { IDS, PERSONA_CREDENTIALS, storageStateFor } from "../fixtures";

const TARGET = IDS.onboarded_student;
const TARGET_EMAIL = PERSONA_CREDENTIALS.onboarded_student.email;
const TARGET_NAME = "Seed Onboarded Student";
const PROFILE_PATH = `/users/${TARGET}`;
/** A well-formed id with no users row: the reference not-found response. */
const MISSING_PATH = "/users/5eed0000-0000-4000-8000-00000000dead";
const NOINDEX = '<meta name="robots" content="noindex"/>';

const titleOf = (html: string): string | null =>
  html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;

test.describe.serial("public profile privacy (F-005)", () => {
  test.afterAll(async () => {
    const stack = localStackEnv();
    const service = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await service
      .from("users")
      .select("visibility")
      .eq("id", TARGET)
      .single();
    expect(error).toBeNull();
    expect(data?.visibility).toBe("public");
  });

  test("private: the not-found response to an anonymous reader, the page to a signed-in viewer; public again: the page, never the email", async ({
    playwright,
  }) => {
    const owner = await playwright.request.newContext({
      baseURL: BASE_URL,
      storageState: storageStateFor("onboarded_student"),
    });
    const viewer = await playwright.request.newContext({
      baseURL: BASE_URL,
      storageState: storageStateFor("club_member"),
    });
    const anonymous = await playwright.request.newContext({ baseURL: BASE_URL });

    const missing = await anonymous.get(MISSING_PATH);
    const missingHtml = await missing.text();
    expect(missingHtml).toContain(NOINDEX);

    try {
      const privatised = await owner.patch(`/api/users/${TARGET}`, {
        data: { visibility: "private" },
      });
      expect(privatised.status()).toBe(200);
      expect((await privatised.json()).data.visibility).toBe("private");

      const anonymousView = await anonymous.get(PROFILE_PATH);
      const anonymousHtml = await anonymousView.text();
      expect(anonymousView.status()).toBe(missing.status());
      expect(anonymousHtml).toContain(NOINDEX);
      expect(titleOf(anonymousHtml)).toBe(titleOf(missingHtml));
      expect(anonymousHtml).not.toContain(TARGET_NAME);
      expect(anonymousHtml).not.toContain(TARGET_EMAIL);

      const signedInView = await viewer.get(PROFILE_PATH);
      const signedInHtml = await signedInView.text();
      expect(signedInView.status()).toBe(200);
      expect(signedInHtml).not.toContain(NOINDEX);
      expect(signedInHtml).toContain(TARGET_NAME);
      expect(signedInHtml).not.toContain(TARGET_EMAIL);
    } finally {
      const restored = await owner.patch(`/api/users/${TARGET}`, {
        data: { visibility: "public" },
      });
      expect(restored.status()).toBe(200);
    }

    const publicView = await anonymous.get(PROFILE_PATH);
    expect(publicView.status()).toBe(200);
    const html = await publicView.text();
    expect(html).not.toContain(NOINDEX);
    expect(html).toContain(TARGET_NAME);
    expect(html).not.toContain(TARGET_EMAIL);

    await Promise.all([owner.dispose(), viewer.dispose(), anonymous.dispose()]);
  });
});
