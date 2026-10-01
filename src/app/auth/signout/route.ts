import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { withRoute } from "@/server/route";

export const POST = withRoute({ cache: "private", action: "sign out" }, async (request: NextRequest) => {
  const supabaseResponse = NextResponse.redirect(new URL("/", request.url), {
    status: 302,
  });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.signOut();

  return supabaseResponse;
});
