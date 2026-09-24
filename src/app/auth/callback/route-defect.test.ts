/**
 * DEFECT characterization — F-077 (and F-004 once 05-05 moves tests 7 and 8 here)
 *
 * Subject: `GET /auth/callback` (`src/app/auth/callback/route.ts`), the final
 * redirect for an already-onboarded user.
 *
 * The defect: the route reads `next` with no shape check (route.ts:37) and
 * builds the redirect as `new URL(next, requestUrl.origin)` (route.ts:205). By
 * WHATWG URL rules an absolute value ignores the base, a protocol-relative
 * value (`//host`) takes only the scheme from it, and a slash-backslash value
 * (`/\host`) is normalised to `//host` for special schemes. All three send the
 * freshly signed-in user off-origin, on the response that carries the new
 * session cookies. The values pinned below were measured with a node probe
 * before this file was written; the probe output is in
 * `evidence/slice-3-characterization-ring.txt`.
 *
 * What this file is and is not:
 *   It pins TODAY's off-origin redirects exactly, so the commit that adds the
 *   `/`-prefixed, not-`//` rule has to move these assertions visibly. The
 *   control case (a same-origin path honoured) must survive that fix; it is
 *   repeated here so the fix cannot be made by dropping `next` altogether,
 *   and it is also test 6 of `route.test.ts`, which this file does not edit.
 *
 * Registered as F-077 (Medium) in .planning/audit/findings.json. Closes in
 * Phase 5 (plan 05-05). F-004 (the ADMIN_EMAILS grant) is pinned today by
 * tests 7 and 8 of `route.test.ts`; 05-05 moves them into this file with a
 * defect-ledger row.
 *
 * Status: OPEN — assertions move in 05-05's callback commit
 *
 * The three mock seams and the helpers are copied from `route.test.ts`, not
 * imported from it, for the reasons its docblock gives: the route imports
 * `createServerClient` from "@supabase/ssr", an inline client from
 * "@supabase/supabase-js", and `createServiceClient` from
 * "@/lib/supabase/service". Every credential-shaped value is a literal
 * placeholder; `.env.local` is never read.
 *
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/app/auth/callback/route.ts`.
 */

import { NextRequest } from "next/server";

// ─── Seam mocks ──────────────────────────────────────────────────────────────

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

/** route.ts:165-171 — .upsert(payload, options) */
const mockUpsert = jest.fn();

/** route.ts:178-181 — .select(cols).eq("id", …).single() */
const mockSelect = jest.fn();
const mockSelectEq = jest.fn();
const mockSingle = jest.fn();

/** route.ts:189-192 — .update({ roles }).eq("id", …) */
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { deleteUser: mockDeleteUser } } }),
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

/** An already-onboarded McGill user: the branch that honours `next` (route.ts:203-205). */
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

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("GET /auth/callback next target (DEFECT — F-077; OPEN until 05-05)", () => {
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
    mockCreateServiceClient.mockReturnValue({ from: mockFrom });
    mockSignOut.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });

    onboardedMcGillUser();
  });

  it("F-077: an absolute next (https://evil.test/x) redirects off-origin to https://evil.test", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=https%3A%2F%2Fevil.test%2Fx"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).origin).toBe("https://evil.test");
    expect(location(res).pathname).toBe("/x");
  });

  it("F-077: a protocol-relative next (//evil.test/x) redirects off-origin to host evil.test", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2F%2Fevil.test%2Fx"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).host).toBe("evil.test");
    expect(location(res).origin).toBe("https://evil.test");
    expect(location(res).pathname).toBe("/x");
  });

  it("F-077: a slash-backslash next (/\\evil.test/x) redirects off-origin to host evil.test", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2F%5Cevil.test%2Fx"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).host).toBe("evil.test");
    expect(location(res).origin).toBe("https://evil.test");
    expect(location(res).pathname).toBe("/x");
  });

  it("control: a same-origin next (/my-events) is honoured on callback.test", async () => {
    const GET = await loadRoute();

    const res = await GET(callbackRequest("?code=abc&next=%2Fmy-events"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res).host).toBe("callback.test");
    expect(location(res).pathname).toBe("/my-events");
  });
});
