/**
 * OAuth callback handler
 * Processes the OAuth callback from Supabase/Azure and creates user profile
 */

import { createClient } from "@/lib/supabase/server";
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
  const next = requestUrl.searchParams.get("next") ?? "/profile";
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle OAuth provider errors
  if (errorParam) {
    console.error("OAuth error:", errorParam, errorDescription);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorParam)}`, requestUrl.origin)
    );
  }

  const supabase = await createClient();

  // Exchange the authorization code for a session
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError.message);
      return NextResponse.redirect(
        new URL(`/?error=auth_failed`, requestUrl.origin)
      );
    }
  }

  // Get the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Get user error:", userError?.message);
    return NextResponse.redirect(
      new URL(`/?error=not_authenticated`, requestUrl.origin)
    );
  }

  const email = user.email ?? "";

  // Enforce McGill domain
  if (!isMcGillEmail(email)) {
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
    updated_at: new Date().toISOString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any).from("users").upsert(
    upsertPayload,
    {
      onConflict: "id",
      ignoreDuplicates: false,
    }
  );

  if (upsertError) {
    console.error("Profile upsert error:", upsertError.message);
    // Continue anyway - user is authenticated, profile creation is secondary
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}