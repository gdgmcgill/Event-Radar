/**
 * DEFECT characterization — F-077 and F-004 (with FO-05, the profile sync's
 * fail-open half)
 *
 * Subject: `GET /auth/callback` (`src/app/auth/callback/route.ts`): the final
 * redirect target, the sign-in role grant, and the profile sync.
 *
 * The defects, as they stood before plan 05-05:
 *   - F-077: the route read `next` with no shape check and built the redirect
 *     as `new URL(next, requestUrl.origin)`. By WHATWG URL rules an absolute
 *     value ignores the base, a protocol-relative value (`//host`) takes only
 *     the scheme from it, and a slash-backslash value (`/\host`) is normalised
 *     to `//host` for special schemes. All three sent the freshly signed-in
 *     user off-origin, on the response that carries the new session cookies.
 *     The values were measured with a node probe (plan 05-02,
 *     `evidence/slice-3-characterization-ring.txt`).
 *   - F-004: the route parsed an environment allowlist of addresses at module
 *     load and appended "admin" to the roles of any listed address at sign-in.
 *   - FO-05: when the service key was absent the profile sync was skipped and
 *     the user admitted with no row written; an upsert error or a failed
 *     profile read was logged and the user admitted anyway.
 *
 * Status: FIXED in 05-05 (DEC-38) by the commit "fix(05-05): callback grants
 * no roles, fails closed on profile sync, validates next"; its hash is
 * recorded against each row in evidence/defect-ledger.md (a commit cannot
 * name its own hash). F-077 and F-004 are both FIXED in 05-05.
 *
 * What this file pins now (the fixed shapes):
 *   - F-077: the three hostile `next` values land on `https://callback.test/`.
 *     The control (a same-origin path honoured) stays, so the fix cannot have
 *     been made by dropping `next`; it is also test 6 of `route.test.ts`.
 *   - F-004: with the allowlist variable naming the signing-in address, no
 *     `users` update is issued. This row moved here from `route.test.ts`
 *     (its test 7) in the fixing commit, with a defect-ledger row.
 *   - F-004 / FO-05: with the elevated door throwing MissingEnvError for the
 *     service key, the user is signed out and sent to
 *     `/?error=profile_sync_failed` with no onboarding cookie. This row moved
 *     here from `route.test.ts` (its test 8).
 *   - FO-05: an upsert error, and a profile read returning no row, each fail
 *     closed the same way, and the failed-sync redirect carries the sign-out's
 *     clearing cookie rather than the session the exchange had just set.
 *
 * The mock seams mirror `route.test.ts`: "@supabase/ssr" for the cookie
 * client, and "@/lib/supabase/service" for the service factory, which the
 * elevated door (`@/server/db/elevated`) wraps. The door now serves both
 * service-role uses, so the service mock carries `auth.admin.deleteUser` as
 * well as `from`. The route no longer imports "@supabase/supabase-js", so
 * that module is not mocked. Every credential-shaped value is a literal
 * placeholder; `.env.local` is never read.
 *
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/app/auth/callback/route.ts`.
 */

import { NextRequest } from "next/server";
import { MissingEnvError } from "@/lib/env";

// ─── Seam mocks ──────────────────────────────────────────────────────────────

/** supabase.auth.exchangeCodeForSession(code) */
const mockExchangeCodeForSession = jest.fn();

/** supabase.auth.getUser() */
const mockGetUser = jest.fn();

/** supabase.auth.signOut(): the non-McGill path and the failed profile sync */
const mockSignOut = jest.fn();

/** getElevatedClient().auth.admin.deleteUser(user.id) */
const mockDeleteUser = jest.fn();

/** createServiceClient(), reached through getElevatedClient() */
const mockCreateServiceClient = jest.fn();

/** elevated.from("users") */
const mockFrom = jest.fn();

/** .upsert(payload, options) */
const mockUpsert = jest.fn();

/** .select(cols).eq("id", …).single() */
const mockSelect = jest.fn();
const mockSelectEq = jest.fn();
const mockSingle = jest.fn();

/** .update(…).eq("id", …): must never be reached (F-004) */
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();

/** The cookie adapter the route hands to createServerClient, captured per call. */
type CookieAdapter = {
  setAll(cookies: { name: string; value: string; options: object }[]): void;
};
let mockCookieAdapter: CookieAdapter | null = null;

jest.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    mockCookieAdapter = options.cookies;
    return {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    };
  },
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

// ─── Constants ───────────────────────────────────────────────────────────────

/** The request origin every case uses. */
const ORIGIN = "https://callback.test";

/** NextResponse.redirect()'s status */
const REDIRECT_STATUS = 307;

/** src/lib/utils.ts — /^[^@]+@(mail\.)?mcgill\.ca$/i */
const MCGILL_EMAIL = "returning@mail.mcgill.ca";

/** The onboarding hint cookie the success path sets for a new user. */
const ONBOARDING_COOKIE = "needs_onboarding";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type CallbackGet = (typeof import("./route"))["GET"];

/** Re-imports the route with a clean registry, as route.test.ts does. */
async function loadRoute(): Promise<CallbackGet> {
  jest.resetModules();
  const mod = await import("./route");
  return mod.GET;
}

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`${ORIGIN}/auth/callback${query}`);
}

function location(res: Response): URL {
  const header = res.headers.get("location");
  if (!header) throw new Error("response carried no location header");
  return new URL(header);
}

/** An already-onboarded McGill user: the branch that honours `next`. */
function onboardedMcGillUser() {
  mockExchangeCodeForSession.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-returning", email: MCGILL_EMAIL, user_metadata: {} } },
    error: null,
  });
  mockSingle.mockResolvedValue({
    data: { onboarding_completed: true, roles: ["user"] },
    error: null,
  });
}

/** A session cookie name; the value is a placeholder, never a real token. */
const SESSION_COOKIE = "sb-placeholder-project-auth-token";

/** The fail-closed shape every broken profile sync must produce. */
function expectFailedClosed(res: Awaited<ReturnType<CallbackGet>>) {
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(res.status).toBe(REDIRECT_STATUS);
  expect(location(res).origin).toBe(ORIGIN);
  expect(location(res).pathname).toBe("/");
  expect(location(res).searchParams.get("error")).toBe("profile_sync_failed");
  expect(res.cookies.get(ONBOARDING_COOKIE)).toBeUndefined();
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("GET /auth/callback (DEFECT — F-077, F-004; FIXED in 05-05)", () => {
  const savedEnv = { ...process.env };
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeAll(() => {
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

    mockUpsert.mockResolvedValue({ error: null });
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
    mockCookieAdapter = null;

    onboardedMcGillUser();
  });

  // ── F-077: the next target ────────────────────────────────────────────────
  it.each([
    ["an absolute next (https://evil.test/x)", "https%3A%2F%2Fevil.test%2Fx"],
    ["a protocol-relative next (//evil.test/x)", "%2F%2Fevil.test%2Fx"],
    ["a slash-backslash next (/\\evil.test/x)", "%2F%5Cevil.test%2Fx"],
  ])("F-077: %s lands on https://callback.test/", async (_label, encodedNext) => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest(`?code=abc&next=${encodedNext}`));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(location(res).origin).toBe(ORIGIN);
    expect(location(res).pathname).toBe("/");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("control: a same-origin next (/my-events) is honoured on callback.test", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).host).toBe("callback.test");
    expect(location(res).pathname).toBe("/my-events");
  });

  // ── F-004: no role is granted at sign-in ──────────────────────────────────
  // Moved from route.test.ts (test 7). loadRoute() re-imports after the
  // variable is set, so a module-load parse of it would be seen.
  it("F-004: with the allowlist variable naming the signing-in address, no users update is issued", async () => {
    const adminAddress = "boss@mcgill.ca";
    process.env.ADMIN_EMAILS = adminAddress;
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-admin", email: adminAddress, user_metadata: {} } },
      error: null,
    });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc"));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateEq).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(location(res).origin).toBe(ORIGIN);
    expect(location(res).pathname).toBe("/");
    expect(location(res).searchParams.get("error")).toBeNull();
  });

  // ── F-004 / FO-05: the profile sync fails closed ──────────────────────────
  // Moved from route.test.ts (test 8), where the absent key admitted the user.
  it("F-004: the elevated door throwing MissingEnvError for the service key signs the user out → /?error=profile_sync_failed, no onboarding cookie", async () => {
    mockCreateServiceClient.mockImplementation(() => {
      throw new MissingEnvError("SUPABASE_SERVICE_ROLE_KEY");
    });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expectFailedClosed(res);
  });

  it("FO-05: an upsert error signs the user out → /?error=profile_sync_failed, no onboarding cookie", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "permission denied for table users" } });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expectFailedClosed(res);
  });

  it("FO-05: the failed-sync redirect carries the sign-out's clearing cookie, not the exchanged session", async () => {
    mockExchangeCodeForSession.mockImplementation(async () => {
      mockCookieAdapter?.setAll([
        { name: SESSION_COOKIE, value: "placeholder-session", options: { path: "/" } },
      ]);
      return { error: null };
    });
    mockSignOut.mockImplementation(async () => {
      mockCookieAdapter?.setAll([
        { name: SESSION_COOKIE, value: "", options: { path: "/", maxAge: 0 } },
      ]);
      return { error: null };
    });
    mockUpsert.mockResolvedValue({ error: { message: "permission denied for table users" } });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc"));

    expectFailedClosed(res);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe("");
    const header = res.headers
      .getSetCookie()
      .find((h) => h.startsWith(`${SESSION_COOKIE}=`));
    expect(header).toMatch(/Max-Age=0/i);
  });

  it("FO-05: a profile read returning no row ({ data: null }) signs the user out → /?error=profile_sync_failed, no onboarding cookie", async () => {
    mockSingle.mockResolvedValue({ data: null });
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(mockSelect).toHaveBeenCalledWith("onboarding_completed, roles");
    expectFailedClosed(res);
  });
});
