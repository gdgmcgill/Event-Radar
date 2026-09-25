/**
 * proxy.ts — the page-level ring: the API rate limiter, the CSRF origin
 * check, the session refresh, the ban and onboarding redirects, and the
 * anonymous sign-in redirect.
 *
 * Phase 05 · plan 05-05 · DEC-36 (with DEC-35 and DEC-37). Fixes F-003,
 * F-062, F-088 and F-089.
 *
 * THIS RING IS ADVISORY
 *   The proxy redirects pages and keeps cookies tidy. It is not where an
 *   authorization decision is made. Every route handler re-decides the
 *   caller, the ban and onboarding through the seam (`src/server/context.ts`
 *   with `requireActiveUser` and `requireOnboarded`), because a matcher change
 *   or a moved route can silently remove proxy coverage (Next.js 16 proxy
 *   docs: "Always verify authentication and authorization inside each
 *   Server Function rather than relying on Proxy alone").
 *
 * IT FAILS CLOSED ON ITS OWN ERRORS
 *   - A missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *     throws MissingEnvError inside the try (F-003).
 *   - A rejected `auth.getUser()` or a failed users read (any error other than
 *     PGRST116, or no data) throws too (F-088).
 *   Every throw reaches the catch, which logs `[Middleware] Error:` and
 *   answers 500: `{"error":"Failed to process request"}` as JSON under
 *   `/api/`, plain-text `Internal Server Error` otherwise. It never passes the
 *   request through.
 *
 * ONE USERS READ, THREE DECISIONS
 *   A signed-in request outside BAN_EXEMPT_PATHS gets exactly one read of
 *   `banned_at, ban_expires_at, onboarding_completed`:
 *   - no row (PGRST116, DEC-35): `/api/*` gets 403 `{"error":"Profile not
 *     found"}`; a page signs the user out and redirects to
 *     `/?error=profile_sync_failed`, carrying the sign-out's cookies.
 *   - banned (F-062): `/api/*` gets 403 `{"error":"Account suspended"}` as
 *     JSON; a page redirects to `/banned` with its query string preserved.
 *   - not onboarded (F-089): the database value decides, not the
 *     `needs_onboarding` cookie. The callback still sets that cookie as a hint
 *     and nothing here reads it, so deleting it no longer frees an
 *     un-onboarded account and a stale one no longer traps an onboarded one.
 *   The exempt paths (`/banned`, `/auth/signout`, `/auth/callback`) get no
 *   users read, so a banned user can always reach the ban page and sign out.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import * as env from "@/lib/env";
import { isBanned } from "@/lib/ban";
import { applyRateLimit, getRateLimitStore } from "@/server/ratelimit";
import { crossSiteBlocked, isCrossSiteMutation } from "@/server/csrf";

/** PostgREST's code when `.single()` finds no row. */
const NO_PROFILE_ROW = "PGRST116";

/** The columns the single users read selects (DEC-36). */
type RingProfile = {
  banned_at: string | null;
  ban_expires_at: string | null;
  onboarding_completed: boolean | null;
};

export async function proxy(request: NextRequest) {
  // Rate limit every /api/* path, /api/admin/* included, before any auth
  // work (DEC-50). The budgets live in src/server/ratelimit/policy.ts.
  // Fail open (REVIEW-05 CR-02): rate limiting is not an authorization
  // control, so no fault in store selection or counting may answer 500 or
  // stop a request. The error's class is logged, never its message, which
  // can echo a misconfigured store URL.
  let rateLimitResponse: NextResponse | null = null;
  try {
    rateLimitResponse = await applyRateLimit(request, getRateLimitStore());
  } catch (err) {
    console.error("[Middleware] Rate limit check failed; allowing request", {
      error: err instanceof Error ? err.name : typeof err,
    });
  }
  if (rateLimitResponse) return rateLimitResponse;

  // Refuse a state-changing /api/* request from another site (DEC-52, F-090)
  // before any env read or session work. Requests carrying neither Origin nor
  // Sec-Fetch-Site (curl, cron, server-to-server) pass.
  if (isCrossSiteMutation(request)) return crossSiteBlocked();

  try {
  // Validated reads (DEC-37). A missing variable throws MissingEnvError into
  // the catch below, which answers 500 rather than passing through (F-003).
  const supabaseUrl = env.supabaseUrl();
  const supabaseAnonKey = env.supabaseAnonKey();

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

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // One users read serves the no-row check, the ban check and the onboarding
  // guard (DEC-36). The exempt paths get no read at all.
  const BAN_EXEMPT_PATHS = ["/banned", "/auth/signout", "/auth/callback"];
  let profile: RingProfile | null = null;
  if (user && !BAN_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    const { data, error } = await supabase
      .from("users")
      .select("banned_at, ban_expires_at, onboarding_completed")
      .eq("id", user.id)
      .single();

    // No profile row (DEC-35): never read as "not banned".
    if (error?.code === NO_PROFILE_ROW) {
      if (isApi) {
        return NextResponse.json({ error: "Profile not found" }, { status: 403 });
      }
      await supabase.auth.signOut();
      const syncFailedUrl = request.nextUrl.clone();
      syncFailedUrl.pathname = "/";
      syncFailedUrl.search = "error=profile_sync_failed";
      const syncFailedResponse = NextResponse.redirect(syncFailedUrl);
      // The sign-out's clearing cookies were set on supabaseResponse by setAll.
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => syncFailedResponse.cookies.set(cookie));
      return syncFailedResponse;
    }

    // Any other read failure is the ring's own error: fail closed (F-088).
    if (error || !data) {
      throw new Error("[Middleware] profile read failed", { cause: error });
    }
    profile = data as RingProfile;

    if (isBanned(profile)) {
      // An API client gets JSON it can parse, not an HTML redirect (F-062).
      if (isApi) {
        return NextResponse.json({ error: "Account suspended" }, { status: 403 });
      }
      const bannedUrl = request.nextUrl.clone();
      bannedUrl.pathname = "/banned";
      return NextResponse.redirect(bannedUrl);
    }
  }

  // Route protection: redirect unauthenticated users from protected pages
  const PROTECTED_ROUTES = ["/my-events", "/create-event", "/notifications", "/profile", "/settings", "/my-clubs", "/invites", "/friends"];
  if (!user && PROTECTED_ROUTES.some((route) => path === route || path.startsWith(route + "/"))) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/";
    signInUrl.searchParams.set("signin", "required");
    signInUrl.searchParams.set("next", path);
    return NextResponse.redirect(signInUrl);
  }

  // Onboarding guard: the database value from the read above decides (F-089).
  // The needs_onboarding cookie is a hint the callback sets; it is not read.
  if (
    user &&
    profile &&
    profile.onboarding_completed !== true &&
    path !== "/onboarding" &&
    !isApi &&
    !path.startsWith("/auth/")
  ) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    return NextResponse.redirect(onboardingUrl);
  }

  return supabaseResponse;

  } catch (e) {
    // Fail closed: the ring's own error is never a pass-through (F-003, F-088).
    console.error("[Middleware] Error:", e);
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
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
