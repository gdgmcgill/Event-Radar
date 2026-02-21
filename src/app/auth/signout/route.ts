import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse, supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookiePrefix = `sb-${projectRef}-auth-token`;

  request.cookies.getAll().forEach(({ name }) => {
    if (name === cookiePrefix || name.startsWith(`${cookiePrefix}.`)) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  });
}

async function handleSignOut(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirectUrl = new URL("/", request.url);

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut({ scope: "global" });

  clearSupabaseAuthCookies(request, response, supabaseUrl);
  response.cookies.set("needs_onboarding", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
