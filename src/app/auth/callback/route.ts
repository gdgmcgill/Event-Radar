/**
 * OAuth callback handler
 * Processes OAuth or a verified email-OTP session and synchronizes the profile
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
 *   - Profile synchronization uses the elevated door. P1-02 removes the
 *     domain-rejection/account-deletion path; admission requires verified email.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { getElevatedClient } from "@/server/db/elevated";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";
import { readQuery } from "@/server/body";
import { AuthCallbackQuery } from "@/contracts/auth";

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

export const GET = withRoute({ cache: "private", action: "complete sign-in" }, async (request: NextRequest) => {
  let stage = "init";
  try {
  stage = "parse_request";
  const requestUrl = new URL(request.url);
  const query = readQuery(requestUrl.searchParams, AuthCallbackQuery);
  const code = query.code;
  const next = safeNextPath(query.next, requestUrl.origin);
  const errorParam = query.error;
  const errorDescription = query.error_description;

  // Handle OAuth provider errors
  if (errorParam) {
    log.error("OAuth provider error", {
      scope: "Callback",
      oauthError: errorParam,
      description: errorDescription,
    });
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorParam)}`, requestUrl.origin)
    );
  }

  // Email OTP is verified by Supabase before this shared completion path.
  // The marker is not proof: getUser + email_confirmed_at below are mandatory.
  const verifiedOtpSession = query.verified;
  if (!code && !verifiedOtpSession) {
    log.error("No code parameter found", { scope: "Callback" });
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
  log.info("Exchanging code for session", {
    scope: "Callback",
    origin: requestUrl.origin,
  });
  const { error: exchangeError } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : { error: null };

  if (exchangeError) {
    log.error("Code exchange failed", { scope: "Callback", error: exchangeError });
    // M0 / DI-98: provider details belong in server diagnostics, never browser
    // history or Referer URLs. The stable public error is enough for the UI.
    return NextResponse.redirect(
      new URL("/?error=auth_failed", requestUrl.origin)
    );
  }

  // Get the authenticated user
  stage = "get_user";
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    log.error("Get user failed", { scope: "Callback", error: userError });
    return NextResponse.redirect(
      new URL(`/?error=not_authenticated`, requestUrl.origin)
    );
  }

  const email = user.email ?? "";

  // P1-02: any verified email may enter. Never delete an account because of
  // its domain; user-editable metadata cannot establish email verification.
  if (!email || !user.email_confirmed_at) {
    await supabase.auth.signOut();
    return redirectWithCookies(new URL("/?error=email_not_verified", requestUrl.origin));
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
        ignoreDuplicates: true,
      }
    );

    if (upsertError) {
      log.error("Profile upsert failed", {
        scope: "Callback",
        userId: user.id,
        error: upsertError,
      });
      throw new Error("profile upsert failed");
    }

    // P1-02: an existing profile keeps its chosen name/avatar, roles, bans,
    // completion and saved state. Only the authoritative verified address is
    // synchronized; OAuth metadata never overwrites returning-user choices.
    const { error: emailSyncError } = await elevated.from("users")
      .update({ email, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (emailSyncError) throw new Error("profile email sync failed");

    // `roles` is read and unused; the column list is pinned (DEC-38 (e)).
    const { data: profile, error: profileError } = await elevated
      .from("users")
      .select("onboarding_completed, roles")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      log.error("Profile read failed", {
        scope: "Callback",
        userId: user.id,
        error: profileError ?? "no row",
      });
      throw new Error("profile read failed");
    }

    needsOnboarding = !profile.onboarding_completed;
  } catch (err) {
    log.error("Profile sync failed; signing out", {
      scope: "Callback",
      userId: user.id,
      error: err,
    });
    await supabase.auth.signOut();
    return redirectWithCookies(
      new URL("/?error=profile_sync_failed", requestUrl.origin)
    );
  }

  // Build the final redirect response and attach ALL accumulated cookies
  stage = "build_redirect_response";
  // A requested destination (including recruiter workspaces) is not trapped
  // in student onboarding. Student mutations retain their own completion gate.
  const redirectUrl = needsOnboarding && next === "/"
    ? new URL("/onboarding", requestUrl.origin)
    : new URL(next, requestUrl.origin);

  // The target is not logged: it carries the `next` value.
  log.info("Redirecting", {
    scope: "Callback",
    needsOnboarding,
    accumulatedCookies: allCookies.size,
    cookieNames: [...allCookies.keys()],
  });

  const response = redirectWithCookies(redirectUrl);

  // Log cookie names in a runtime-safe way. `headers.getSetCookie()` is not
  // available in all server runtimes and can throw, which would break login.
  const cookieNames = response.cookies.getAll().map((cookie) => cookie.name);
  log.info("Response cookies", {
    scope: "Callback",
    count: cookieNames.length,
    cookieNames,
  });

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
    log.error("Unhandled error", { scope: "Callback", stage, error: err });
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      new URL(`/?error=callback_error&stage=${encodeURIComponent(stage)}`, origin)
    );
  }
});
