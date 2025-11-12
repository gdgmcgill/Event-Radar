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
    // const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    // TODO: Validate email domain (McGill only)
    // TODO: Create user profile if doesn't exist
    
    // if (error) {
    //   return NextResponse.redirect(new URL('/auth/error', requestUrl.origin));
    // }
  }

  // TODO: Handle error cases
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

