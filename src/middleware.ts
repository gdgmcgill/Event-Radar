import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars are missing, pass through without auth
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  try {

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Track whether setAll was called (i.e. session was refreshed)
  let sessionRefreshed = false;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          sessionRefreshed = true;
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add any logic between createServerClient and
  // supabase.auth.getUser().

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Clean up stale/orphaned Supabase auth cookies, but ONLY when the
  // session was actually refreshed (setAll was called).  When the token
  // is still valid, setAll is never invoked, so the response has no
  // Set-Cookie headers — running the cleanup in that case would
  // incorrectly delete every auth cookie chunk.
  if (user && sessionRefreshed) {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const cookiePrefix = `sb-${projectRef}-auth-token`;

    const setCookieNames = new Set<string>();
    supabaseResponse.headers.getSetCookie().forEach((header) => {
      const name = header.split("=")[0];
      if (name.startsWith(cookiePrefix)) {
        setCookieNames.add(name);
      }
    });

    request.cookies.getAll().forEach(({ name }) => {
      if (
        name.startsWith(cookiePrefix) &&
        !setCookieNames.has(name) &&
        name !== cookiePrefix
      ) {
        const suffix = name.slice(cookiePrefix.length);
        if (suffix.match(/^\.\d+$/)) {
          supabaseResponse.cookies.set(name, "", { maxAge: 0, path: "/" });
        }
      }
    });
  }

  // Onboarding guard: redirect to /onboarding if cookie is set
  const needsOnboarding = request.cookies.get("needs_onboarding")?.value === "1";
  const path = request.nextUrl.pathname;

  if (
    needsOnboarding &&
    user &&
    path !== "/onboarding" &&
    !path.startsWith("/api/") &&
    !path.startsWith("/auth/")
  ) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    return NextResponse.redirect(onboardingUrl);
  }

  return supabaseResponse;

  } catch (e) {
    // If middleware fails, pass through rather than 500ing the entire site
    console.error("[Middleware] Error:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
