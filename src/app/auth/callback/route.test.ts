/**
 * Characterization tests for the OAuth callback route handler.
 *
 * PRESERVE suite (REFAC-08). Phases 5 and 6 rewrite the authorization ring
 * around `src/app/auth/callback/route.ts` — F-004 moves the admin grant out of
 * the sign-in path, F-040 supplies the environment variables that are absent in
 * production today. These expectations are written against today's *unmodified*
 * route and must pass byte-for-byte identically afterwards. A diff in this
 * file's results is a behaviour change, not a test problem.
 *
 * Tests cover:
 *   - the inbound provider-error parameter passing through, before any exchange
 *   - the absent `code` parameter redirecting with error=no_code
 *   - a failed code-for-session exchange redirecting with error=auth_failed
 *   - a non-McGill address: sign-out, orphaned auth user deleted by id, error=not_mcgill
 *   - a new McGill user: profile upsert payload, /onboarding, needs_onboarding=1
 *   - an already-onboarded McGill user routing to the `next` destination instead
 *   - the sign-in admin grant and the absent-service-key path: moved to
 *     `route-defect.test.ts` in plan 05-05 (F-004), where they pin the fixed shapes
 *
 * WHY THE MOCK SEAMS ARE THESE THREE:
 *   Read the subject's own import block (route.ts:13-18), not habit. The route
 *   imports `createServerClient` from "@supabase/ssr" DIRECTLY (line 13) — it
 *   does *not* import the cookie-reading factory at `src/lib/supabase/server.ts`
 *   that every API route uses, so mocking THAT module mocks nothing here while
 *   looking entirely correct. It builds a SECOND, separate
 *   service-role client inline from "@supabase/supabase-js" (line 14) purely to
 *   reach `auth.admin.deleteUser` on the non-McGill rejection path (line 122).
 *   And it reaches the `users` table through `createServiceClient` from
 *   "@/lib/supabase/service" (line 18). Three imports, three mocks, no fourth.
 *
 * WHY EVERY TEST LOADS THE ROUTE THROUGH loadRoute():
 *   `ADMIN_EMAILS` is parsed at MODULE LOAD (route.ts:22-25), not per request.
 *   Setting `process.env.ADMIN_EMAILS` inside a `beforeEach` does nothing at all
 *   to an already-imported module, so the admin-assignment test would pass
 *   vacuously against an empty allowlist. `loadRoute()` calls
 *   `jest.resetModules()` and re-imports, which is the only way that constant
 *   gets re-evaluated. Every test uses it so no reader has to work out which
 *   ones needed it. By contrast `SUPABASE_SERVICE_ROLE_KEY` is read per request
 *   (route.ts:162), so that branch needs no reload — the difference is itself a
 *   characterized fact.
 *
 * Every assertion below constructs a request, calls the exported `GET`, and
 * asserts on the returned `NextResponse` — its status, its `location` parsed as
 * a URL, its cookies, or a mock's call arguments. None of them reads a shape off
 * the module without invoking the handler. That is deliberate: `02-REVIEW.md`
 * WR-04 found `src/proxy.test.ts` asserting only `config.matcher`, so deleting
 * the redirect block it claims to guard leaves it green. Each behaviour above
 * has been observed turning this suite red when its branch was removed from the
 * route; see `evidence/callback-mutation-check.txt`.
 *
 * Every credential-shaped value here is a literal placeholder. No real key,
 * token or project URL appears in this file, and `.env.local` is never read.
 *
 * The subject is imported and exercised only. This suite never modifies, wraps,
 * or re-exports anything from `src/app/auth/callback/route.ts`.
 */

import { NextRequest } from "next/server";

// ─── Seam mocks ──────────────────────────────────────────────────────────────
// Declared before the factories that close over them. The factories are not
// invoked until `loadRoute()` requires the route, which happens inside a test,
// long after these initialize.

/** route.ts:87 — supabase.auth.exchangeCodeForSession(code) */
const mockExchangeCodeForSession = jest.fn();

/** route.ts:101 — supabase.auth.getUser() */
const mockGetUser = jest.fn();

/** route.ts:116 — supabase.auth.signOut() on the non-McGill path */
const mockSignOut = jest.fn();

/** route.ts:126 — adminClient.auth.admin.deleteUser(user.id) */
const mockDeleteUser = jest.fn();

/** route.ts:164 — createServiceClient() */
const mockCreateServiceClient = jest.fn();

/** route.ts:165 — serviceClient.from("users") */
const mockFrom = jest.fn();

/** route.ts:165-171 — .upsert(payload, { onConflict, ignoreDuplicates }) */
const mockUpsert = jest.fn();

/** route.ts:178-181 — .select("onboarding_completed, roles").eq("id", …).single() */
const mockSelect = jest.fn();
const mockSelectEq = jest.fn();
const mockSingle = jest.fn();

/** route.ts:189-192 — .update({ roles }).eq("id", …) */
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();

// route.ts:13 — the cookie-bearing SSR client. The handler passes a `cookies`
// adapter that this mock deliberately never calls, so `allCookies` stays empty
// and the only cookie on the response is the one the handler sets itself. That
// keeps the onboarding-cookie assertion unambiguous.
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }),
}));

// route.ts:14 — the inline service-role client, built only to delete the
// orphaned auth.users row when the address is not McGill.
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { deleteUser: mockDeleteUser } } }),
}));

// route.ts:18 — the RLS-bypassing client used for the upsert, the profile read
// and the admin role update.
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

// ─── Constants read from the subject, not from the plan ──────────────────────
// A planning document can go stale; the source cannot.

/** route.ts:37 — the `next` parameter's default */
const DEFAULT_DESTINATION = "/";

/** route.ts:204 — the destination when the profile has no onboarding_completed */
const ONBOARDING_PATH = "/onboarding";

/** route.ts:225 — the onboarding cookie name and value */
const ONBOARDING_COOKIE = "needs_onboarding";
const ONBOARDING_COOKIE_VALUE = "1";

/** route.ts:179 — the exact column list the profile read selects */
const PROFILE_COLUMNS = "onboarding_completed, roles";

/** NextResponse.redirect()'s status, asserted rather than assumed */
const REDIRECT_STATUS = 307;

/** src/lib/utils.ts:81 — /^[^@]+@(mail\.)?mcgill\.ca$/i */
const MCGILL_EMAIL = "student@mail.mcgill.ca";
const NON_MCGILL_EMAIL = "outsider@gmail.com";
const ADMIN_EMAIL = "boss@mcgill.ca";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Re-imports the route with a clean module registry so route.ts:22-25 re-reads
 * `process.env.ADMIN_EMAILS`. See the WHY block in the file header.
 */
async function loadRoute() {
  jest.resetModules();
  const mod = await import("./route");
  return mod.GET;
}

function callbackRequest(query = ""): NextRequest {
  return new NextRequest(`https://callback.test/auth/callback${query}`);
}

/** Parses the Location header so assertions name a path or a parameter, not a string. */
function location(res: Response): URL {
  const header = res.headers.get("location");
  if (!header) throw new Error("response carried no location header");
  return new URL(header);
}

function signedInAs(id: string, email: string, metadata: Record<string, unknown> = {}) {
  mockExchangeCodeForSession.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({
    data: { user: { id, email, user_metadata: metadata } },
    error: null,
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("GET /auth/callback (PRESERVE — REFAC-08)", () => {
  const savedEnv = { ...process.env };
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeAll(() => {
    // The handler logs on every path by design (route.ts:43, 85, 207-208, 219-220).
    // Silencing keeps the evidence capture readable; it changes no behaviour and
    // does not suppress Jest's own failure output.
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
    process.env = savedEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Placeholders only — never a real key, never read from .env.local.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role-key";
    delete process.env.ADMIN_EMAILS;

    // Default: a brand-new user who has not completed onboarding.
    mockUpsert.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({
      data: { onboarding_completed: false, roles: ["user"] },
      error: null,
    });
    mockSelectEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockSelectEq });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      select: mockSelect,
      update: mockUpdate,
    });
    mockCreateServiceClient.mockReturnValue({
      from: mockFrom,
      auth: { admin: { deleteUser: mockDeleteUser } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  // ── 1. Provider error passthrough (route.ts:42-47) ─────────────────────────
  it("passes an inbound provider error through without attempting an exchange", async () => {
    const GET = await loadRoute();

    const res = await GET(
      callbackRequest("?error=access_denied&error_description=User%20declined")
    );

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).pathname).toBe("/");
    expect(location(res).searchParams.get("error")).toBe("access_denied");
    // The passthrough must happen BEFORE the exchange — it is a rejection, not
    // a swallowed error that still tries to mint a session.
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // ── 2. Missing code (route.ts:49-54) ───────────────────────────────────────
  it("redirects with error=no_code when the code parameter is absent", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest());

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).pathname).toBe("/");
    expect(location(res).searchParams.get("error")).toBe("no_code");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  // ── 3. Exchange failure (route.ts:89-94) ───────────────────────────────────
  it("redirects with error=auth_failed and the provider message when the exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid grant" },
    });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc"));

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(location(res).searchParams.get("error")).toBe("auth_failed");
    expect(location(res).searchParams.get("message")).toBe("invalid grant");
    // A failed exchange must not fall through into the user read.
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // ── 4. McGill enforcement (route.ts:113-134) ───────────────────────────────
  it("rejects a non-McGill address, signs it out, and deletes the orphaned auth user", async () => {
    signedInAs("u-non-mcgill", NON_MCGILL_EMAIL);
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc"));

    expect(location(res).pathname).toBe("/");
    expect(location(res).searchParams.get("error")).toBe("not_mcgill");
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith("u-non-mcgill");
    // The rejected address must never reach the profile table.
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(res.cookies.get(ONBOARDING_COOKIE)).toBeUndefined();
  });

  // ── 5. New McGill user (route.ts:148-154, 165-183, 203-231) ────────────────
  it("upserts the profile and routes a new McGill user to /onboarding", async () => {
    signedInAs("u-new", MCGILL_EMAIL, { name: "Student One", avatar_url: "https://img.test/a.png" });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc"));

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "u-new",
        email: MCGILL_EMAIL,
        name: "Student One",
        avatar_url: "https://img.test/a.png",
      }),
      { onConflict: "id", ignoreDuplicates: false }
    );
    expect(mockSelect).toHaveBeenCalledWith(PROFILE_COLUMNS);
    expect(mockSelectEq).toHaveBeenCalledWith("id", "u-new");
    expect(location(res).pathname).toBe(ONBOARDING_PATH);
    expect(res.cookies.get(ONBOARDING_COOKIE)?.value).toBe(ONBOARDING_COOKIE_VALUE);
  });

  // ── 6. Already-onboarded user (route.ts:183, 203-205) ──────────────────────
  it("routes an already-onboarded McGill user to the next destination, with no onboarding cookie", async () => {
    signedInAs("u-returning", MCGILL_EMAIL);
    mockSingle.mockResolvedValue({
      data: { onboarding_completed: true, roles: ["user"] },
      error: null,
    });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(mockUpsert).toHaveBeenCalled();
    expect(location(res).pathname).toBe("/my-events");
    expect(res.cookies.get(ONBOARDING_COOKIE)).toBeUndefined();
  });
});
