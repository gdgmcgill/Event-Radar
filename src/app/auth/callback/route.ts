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
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

// Valid McGill email domains
const VALID_DOMAINS = ["@mcgill.ca", "@mail.mcgill.ca"] as const;

// Hardcoded admin emails — only these accounts can have the admin role
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isMcGillEmail(email: string): boolean {
  return VALID_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain));
}

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET(request: NextRequest) {
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
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[Callback] Code exchange FAILED:", exchangeError.message);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed`, requestUrl.origin)
    );
  }

  // Get the authenticated user
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
    console.error("[Callback] Not a McGill email:", email);
    await supabase.auth.signOut();
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
  const upsertPayload: Database["public"]["Tables"]["users"]["Insert"] = {
    id: user.id,
    email,
    name,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await (supabase as any).from("users").upsert(
    upsertPayload,
    {
      onConflict: "id",
      ignoreDuplicates: false,
    }
  );

  if (upsertError) {
    console.error("[Callback] Profile upsert error:", upsertError.message);
  }

  // Check if user needs onboarding (no interest_tags set)
  // Also fetch current roles for admin auto-assignment
  let needsOnboarding = false;
  try {
    const { data: profile } = await (supabase as any)
      .from("users")
      .select("interest_tags, roles")
      .eq("id", user.id)
      .single();

    const tags = profile?.interest_tags as string[] | null;
    needsOnboarding = !tags || tags.length === 0;

    // Auto-assign admin role if email is in the hardcoded list
    const currentRoles = (profile?.roles as string[]) ?? ["user"];
    if (isAdminEmail(email) && !currentRoles.includes("admin")) {
      const newRoles = [...currentRoles, "admin"];
      await (supabase as any)
        .from("users")
        .update({ roles: newRoles })
        .eq("id", user.id);
      console.log("[Callback] Auto-assigned admin role to:", email);
    }
  } catch (err) {
    console.error("[Callback] Failed to check onboarding status:", err);
  }

  // Build the final redirect response and attach ALL accumulated cookies
  const redirectUrl = needsOnboarding
    ? new URL("/onboarding", requestUrl.origin)
    : new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  for (const [, { name: cookieName, value, options }] of allCookies) {
    response.cookies.set(cookieName, value, options);
  }

  // Set onboarding cookie if user needs onboarding
  if (needsOnboarding) {
    response.cookies.set("needs_onboarding", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600, // 1 hour auto-expiry
    });
  }

  return response;
}
