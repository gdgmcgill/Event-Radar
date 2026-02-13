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

function isMcGillEmail(email: string): boolean {
  return VALID_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  console.log("[Callback] Starting OAuth callback handler");
  console.log("[Callback] Request cookies count:", request.cookies.getAll().length);
  console.log("[Callback] Request cookie names:", request.cookies.getAll().map(c => c.name).join(", "));

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

  console.log("[Callback] Got authorization code, exchanging...");

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
          console.log("[Callback] setAll called with", cookiesToSet.length, "cookies:",
            cookiesToSet.map(c => `${c.name} (${c.value.length} chars)`).join(", "));

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

  console.log("[Callback] Code exchange succeeded. Accumulated cookies so far:", allCookies.size);

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

  console.log("[Callback] Got user:", user.email);

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

  // Build the final redirect response and attach ALL accumulated cookies
  const redirectUrl = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  console.log("[Callback] Building redirect to:", redirectUrl.toString());
  console.log("[Callback] Setting", allCookies.size, "cookies on redirect response");

  for (const [cookieName, { value, options }] of allCookies) {
    console.log("[Callback] Setting cookie:", cookieName, "length:", value.length);
    response.cookies.set(cookieName, value, options);
  }

  // Log the final Set-Cookie headers for debugging
  const setCookieHeaders = response.headers.getSetCookie();
  console.log("[Callback] Response Set-Cookie headers count:", setCookieHeaders.length);
  setCookieHeaders.forEach((header, i) => {
    const name = header.split("=")[0];
    console.log(`[Callback]   ${i}: ${name} (${header.length} chars)`);
  });

  console.log("[Callback] Returning redirect response");
  return response;
}
