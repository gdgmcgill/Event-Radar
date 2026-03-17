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
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { createServiceClient } from "@/lib/supabase/service";
import { isMcGillEmail } from "@/lib/utils";

// Hardcoded admin emails — only these accounts can have the admin role
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET(request: NextRequest) {
  let stage = "init";
  try {
  stage = "parse_request";
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    // because the anon client cannot call auth admin methods.
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await adminClient.auth.admin.deleteUser(user.id);
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

  // Upsert user profile into public.users table
  // Use service client to bypass RLS — the anon client's upsert can fail
  // silently under RLS, leaving no row for the onboarding PATCH to update.
  const upsertPayload: Database["public"]["Tables"]["users"]["Insert"] = {
    id: user.id,
    email,
    name,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  };

  // Check if user needs onboarding (no interest_tags set)
  // Also fetch current roles for admin auto-assignment
  stage = "profile_sync";
  let needsOnboarding = false;
  // Profile sync should never block login. If service key/config is missing,
  // keep the user signed in and skip non-critical profile enrichment.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const serviceClient = createServiceClient();
      const { error: upsertError } = await serviceClient.from("users").upsert(
        upsertPayload,
        {
          onConflict: "id",
          ignoreDuplicates: false,
        }
      );

      if (upsertError) {
        console.error("[Callback] Profile upsert error:", upsertError.message);
      }

      const { data: profile } = await serviceClient
        .from("users")
        .select("onboarding_completed, roles")
        .eq("id", user.id)
        .single();

      needsOnboarding = !profile?.onboarding_completed;

      // Auto-assign admin role if email is in the hardcoded list
      const currentRoles = (profile?.roles ?? ["user"]) as Database["public"]["Enums"]["user_role"][];
      if (isAdminEmail(email) && !currentRoles.includes("admin")) {
        const newRoles: Database["public"]["Enums"]["user_role"][] = [...currentRoles, "admin"];
        await serviceClient
          .from("users")
          .update({ roles: newRoles })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("[Callback] Profile sync/onboarding check failed:", err);
    }
  } else {
    console.error("[Callback] SUPABASE_SERVICE_ROLE_KEY is missing; skipping profile sync");
  }

  // Build the final redirect response and attach ALL accumulated cookies
  stage = "build_redirect_response";
  const redirectUrl = needsOnboarding
    ? new URL("/onboarding", requestUrl.origin)
    : new URL(next, requestUrl.origin);

  console.log("[Callback] Redirecting to:", redirectUrl.toString());
  console.log("[Callback] Accumulated cookies:", allCookies.size, [...allCookies.keys()]);

  const response = NextResponse.redirect(redirectUrl);

  for (const [, { name: cookieName, value, options }] of allCookies) {
    response.cookies.set(cookieName, value, options);
  }

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
