/**
 * OAuth callback handler
 * TODO: Implement OAuth callback processing and user profile creation
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();

    // TODO: Exchange code for session
  //   const { error } = await supabase.auth.exchangeCodeForSession(code);

  //   if (error) {
  //     return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  //   }
  //   // TODO: Validate email domain (McGill only)

  //   const {
  //     data: { user },
  //   } = await supabase.auth.getUser();
  //   if (!user) {
  //     return NextResponse.redirect(`${requestUrl.origin}/auth/error`);
  //   }

  //   const email = user.email ?? "";

  //   if (!email.endsWith("@mcgill.ca") && !email.endsWith("@mail.mcgill.ca")) {
  //     await supabase.auth.signOut();
  //     return NextResponse.redirect("/login?error=not_mcgill");
  //   }
  //   // TODO: Create user profile if doesn't exist
  //   const userMetadata = user.user_metadata ?? {};
  //   const interestTags = Array.isArray(userMetadata.interest_tags)
  //     ? userMetadata.interest_tags
  //     : [];

  //   await supabase.from("users").upsert({
  //     id: user.id,
  //     email,
  //     full_name:
  //       userMetadata.full_name ??
  //       userMetadata.name ??
  //       userMetadata.first_name ??
  //       null,
  //     interest_tags: interestTags,
  //     created_at: new Date().toISOString(),
  //     updated_at: new Date().toISOString(),
  //   });
   }

  // TODO: Handle error cases
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}





