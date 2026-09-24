/**
 * OAuth callback handler
 * Processes the OAuth callback from Supabase/Azure and creates user profile
 *
 * Uses the request/response cookie pattern (same as middleware) instead of
 * the cookies() API. Accumulates all cookies across multiple setAll calls
 * and applies them to the final redirect response.
 *
 * This is critical for Azure OAuth because Microsoft tokens are large and
 * Supabase chunks them into multiple cookies.
 *
 * Phase 05 · plan 05-05 · DEC-38 (F-004, F-077, FO-05):
 *   - Sign-in grants no role. The environment allowlist and the admin grant
 *     are deleted; roles change only through the admin users route.
 *   - The profile sync fails closed. An upsert error, a read error, a missing
 *     row or any throw (including MissingEnvError for the service key) signs
 *     the user out and redirects to `/?error=profile_sync_failed`.
 *   - `next` is honoured only when it stays on the request origin
 *     (`safeNextPath`); anything else lands on `/`.
 *   - Both service-role uses (deleting a rejected non-McGill auth user, and
 *     the profile upsert and read) go through `getElevatedClient()`, with a
 *     row each in `src/server/db/elevated/REGISTRY.md`.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { isMcGillEmail } from "@/lib/utils";
import { getElevatedClient } from "@/server/db/elevated";

/**
 * The redirect target for `next`, or `/` when `next` could leave the origin
 * (F-077). Accepted only when it starts with `/`, its second character is
 * neither `/` nor a backslash (browsers read `/\host` as `//host`), and it
 * resolves to the request origin. The origin check is the final word: it also
 * catches forms the prefix rules miss, such as a tab the URL parser strips.
 *
 * @param next - the raw `next` query value, or null
 * @param origin - the callback request's origin
 * @returns a path (with its query and hash) on `origin`
 */
function safeNextPath(next: string | null, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next[1] === "/" || next[1] === "\\") return "/";
  try {
    const resolved = new URL(next, origin);
    if (resolved.origin !== origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: NextRequest) {
  let stage = "init";
  try {
  stage = "parse_request";
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(
    requestUrl.searchParams.get("next"),
    requestUrl.origin
  );
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle OAuth provider errors
  if (errorParam) {
    console.error("[Callback] OAuth error:", errorParam, errorDescription);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorParam)}`, requestUrl.origin)
    );
  }

  if (!code) {
    console.error("[Callback] No code parameter found");
    return NextResponse.redirect(
      new URL(`/?error=no_code`, requestUrl.origin)
    );
  }

  // Accumulate ALL cookies across multiple setAll calls
  stage = "create_supabase_client";
  const allCookies = new Map<string, { name: string; value: string; options: Record<string, unknown> }>();

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies so subsequent reads see the new values
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Accumulate cookies (later calls override earlier ones for same name)
          cookiesToSet.forEach(({ name, value, options }) => {
            allCookies.set(name, { name, value, options: options as Record<string, unknown> });
          });
        },
      },
    }
  );

  /** A redirect on the request origin carrying every accumulated cookie. */
  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    for (const [, { name: cookieName, value, options }] of allCookies) {
      response.cookies.set(cookieName, value, options);
    }
    return response;
  };

  // Exchange the authorization code for a session
  stage = "exchange_code_for_session";
  console.log("[Callback] Exchanging code for session, origin:", requestUrl.origin);
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[Callback] Code exchange FAILED:", exchangeError.message, exchangeError);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
    );
  }

  // Get the authenticated user
  stage = "get_user";
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[Callback] Get user FAILED:", userError?.message);
    return NextResponse.redirect(
      new URL(`/?error=not_authenticated`, requestUrl.origin)
    );
  }

  const email = user.email ?? "";

  // Enforce McGill domain
  if (!isMcGillEmail(email)) {
    stage = "enforce_mcgill_email";
    console.error("[Callback] Not a McGill email:", email);
    await supabase.auth.signOut();

    // Delete the orphaned auth.users row — exchangeCodeForSession() already
    // created it before we could check the email. Service role is required
    // because the anon client cannot call auth admin methods (REGISTRY.md).
    try {
      await getElevatedClient().auth.admin.deleteUser(user.id);
    } catch (err) {
      console.error("[Callback] Failed to delete non-McGill auth user:", err);
    }

    return NextResponse.redirect(
      new URL(`/?error=not_mcgill`, requestUrl.origin)
    );
  }

  // Extract user metadata
  const metadata = user.user_metadata ?? {};
  const name =
    (metadata.name as string) ??
    (metadata.full_name as string) ??
    (metadata.preferred_username as string) ??
    null;
  const avatarUrl = (metadata.avatar_url as string) ?? null;

  // Upsert user profile into public.users table through the elevated door:
  // the row may not exist yet, the payload writes email, and INSERT on users
  // is not the caller's to make (REGISTRY.md).
  const upsertPayload: Database["public"]["Tables"]["users"]["Insert"] = {
    id: user.id,
    email,
    name,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  };

  // Check if user needs onboarding. The profile sync fails closed (FO-05): a
  // user whose row could not be written or read is signed out, not admitted.
  stage = "profile_sync";
  let needsOnboarding: boolean;
  try {
    const elevated = getElevatedClient();
    const { error: upsertError } = await elevated.from("users").upsert(
      upsertPayload,
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );

    if (upsertError) {
      throw new Error(`profile upsert failed: ${upsertError.message}`);
    }

    // `roles` is read and unused; the column list is pinned (DEC-38 (e)).
    const { data: profile, error: profileError } = await elevated
      .from("users")
      .select("onboarding_completed, roles")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(
        `profile read failed: ${profileError?.message ?? "no row"}`
      );
    }

    needsOnboarding = !profile.onboarding_completed;
  } catch (err) {
    console.error("[Callback] Profile sync failed; signing out:", err);
    await supabase.auth.signOut();
    return redirectWithCookies(
      new URL("/?error=profile_sync_failed", requestUrl.origin)
    );
  }

  // Build the final redirect response and attach ALL accumulated cookies
  stage = "build_redirect_response";
  const redirectUrl = needsOnboarding
    ? new URL("/onboarding", requestUrl.origin)
    : new URL(next, requestUrl.origin);

  console.log("[Callback] Redirecting to:", redirectUrl.toString());
  console.log("[Callback] Accumulated cookies:", allCookies.size, [...allCookies.keys()]);

  const response = redirectWithCookies(redirectUrl);

  // Log cookie names in a runtime-safe way. `headers.getSetCookie()` is not
  // available in all server runtimes and can throw, which would break login.
  const cookieNames = response.cookies.getAll().map((cookie) => cookie.name);
  console.log("[Callback] Response cookies count:", cookieNames.length);
  console.log("[Callback] Response cookies:", cookieNames);

  // Set onboarding cookie if user needs onboarding
  stage = "set_onboarding_cookie";
  if (needsOnboarding) {
    response.cookies.set("needs_onboarding", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600, // 1 hour auto-expiry
    });
  }

  stage = "done";
  return response;

  } catch (err) {
    console.error("[Callback] Unhandled error at stage:", stage, err);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      new URL(`/?error=callback_error&stage=${encodeURIComponent(stage)}`, origin)
    );
  }
}
