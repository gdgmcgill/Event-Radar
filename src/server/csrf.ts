/**
 * The CSRF origin check for state-changing API requests (plan 05-17, DEC-52,
 * F-090, REFAC-17).
 *
 * WHY IT EXISTS
 *   Route handlers get no origin check from Next.js. Server Actions do: Next
 *   compares their `Origin` with `Host` / `X-Forwarded-Host` and aborts on a
 *   mismatch (node_modules/next/dist/docs/01-app/02-guides/data-security.md,
 *   "Allowed origins"). This app has no Server Actions; every mutation is a
 *   `/api/*` route handler. Before 05-17 the only barrier was the
 *   `SameSite=Lax` default on the `@supabase/ssr` session cookies (F-090).
 *   This check is the explicit control; Lax stays as the first layer.
 *   `evidence/csrf-assessment.md` is the written assessment.
 *
 * WHAT IT REFUSES
 *   A request to `/api/*` whose method is not GET, HEAD or OPTIONS, when
 *     - `Sec-Fetch-Site` is `cross-site`, or
 *     - an `Origin` header is present and its host differs from
 *       `x-forwarded-host` (first entry), else `host`, else the URL's host.
 *       The literal "null" Origin (sandboxed frames, some redirects) and one
 *       that does not parse are refused too.
 *
 * WHAT IT DELIBERATELY PASSES
 *   - A request carrying neither `Origin` nor `Sec-Fetch-Site`. Browsers
 *     send `Origin` on every cross-origin POST, PUT, PATCH and DELETE, so a
 *     header-less mutation is not a browser acting for a victim. Curl, cron
 *     callers and server-to-server calls (Phase 6's machine routes) send
 *     neither and must keep working.
 *   - Safe methods, and every path outside `/api/`.
 *
 * The proxy calls it after the rate limiter and before any env read or
 * session work, and answers `crossSiteBlocked()` when it returns true.
 */

import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The host the request was addressed to, lower-cased. */
function requestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || req.headers.get("host")?.trim() || req.nextUrl.host;
  return host.toLowerCase();
}

/** True when this request is a state-changing `/api/*` call from another site. */
export function isCrossSiteMutation(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;
  if (!req.nextUrl.pathname.startsWith("/api/")) return false;

  if (req.headers.get("sec-fetch-site") === "cross-site") return true;

  const origin = req.headers.get("origin");
  if (origin === null) return false; // curl, cron, server-to-server

  try {
    return new URL(origin).host !== requestHost(req);
  } catch {
    return true; // "null" or unparseable: refuse
  }
}

/** The 403 the proxy answers a cross-site mutation with. */
export function crossSiteBlocked(): NextResponse {
  return NextResponse.json(
    { error: "Cross-site request blocked" },
    { status: 403 }
  );
}
