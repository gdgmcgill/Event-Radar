/**
 * DEFECT characterization — F-003, F-062, F-088, F-089
 *
 * Subject: `src/proxy.ts`, the page-level authentication ring, on the paths
 * where it fails open or answers with the wrong shape.
 *
 * The defect:
 *   - F-003: with NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *     unbound, the proxy returns NextResponse.next() before building a client
 *     (proxy.ts:13-16). Every protected page is then public.
 *   - F-088: the ring fails open on its own errors. The outer catch passes the
 *     request through (proxy.ts:140-144). The ban read's error is discarded,
 *     so a failed read and a missing row both count as "not banned"
 *     (proxy.ts:96-104).
 *   - F-062: a banned user's `/api/*` call is answered with a 307 to the HTML
 *     page `/banned` rather than a JSON 403 (proxy.ts:106-110).
 *   - F-089: the onboarding guard reads only the `needs_onboarding` cookie
 *     (proxy.ts:124). Deleting the cookie frees an un-onboarded account, and a
 *     stale cookie still redirects an onboarded one.
 *
 * What this file is and is not:
 *   Plan 05-02 wrote it to pin the wrong shapes above exactly, so the commit
 *   that fixed each one had to move an assertion visibly. Plan 05-05 fixed
 *   them (DEC-35, DEC-36) and moved every row to its fixed shape in the same
 *   commit, following the protocol in `evidence/defect-ledger.md`: the
 *   unedited rows went red against the fixed proxy, the moved rows went green,
 *   and the moved rows went red again with the pre-fix proxy restored. Each
 *   moved row has a ledger row. The line numbers in "The defect" above are the
 *   pre-fix proxy's. What must survive the fix lives in
 *   `src/proxy-characterization.test.ts`, not here.
 *
 *   Fixed shapes pinned below:
 *   - a. F-003: env unset → 500, plain text on a page, JSON
 *        `{"error":"Failed to process request"}` under `/api/`; no client built
 *   - b. F-088: `auth.getUser` rejecting → 500, logged `[Middleware] Error:`
 *   - c. F-088: a users read failing with XX000 → 500
 *   - d. F-088: no users row (PGRST116) → `/api/*` 403
 *        `{"error":"Profile not found"}`; a page signs out once and gets 307 to
 *        `/?error=profile_sync_failed`, carrying the sign-out's cookies
 *   - e. F-062: a banned `/api/*` call → 403 `{"error":"Account suspended"}`
 *        with a JSON content type
 *   - f. F-089: no cookie, database says not onboarded → 307 to `/onboarding`
 *   - g. F-089: a stale cookie on an onboarded user → no redirect
 *
 * Registered as F-003 (Medium), F-062 (Medium), F-088 (Medium) and F-089
 * (Low) in .planning/audit/findings.json.
 *
 * Status: FIXED in 05-05 by the commit "fix(05-05): proxy fails closed,
 * answers /api/* with JSON 403, reads onboarding from the database"; its hash
 * is recorded against each row in evidence/defect-ledger.md (a commit cannot
 * name its own hash)
 *
 * The mock seam is "@supabase/ssr", for the reason given in the characterization
 * file: the proxy imports createServerClient from it directly. The users read
 * returns the full persona row whatever column string is asked for. Every
 * request carries its own `x-forwarded-for` address so the shared rate-limit
 * bucket store cannot leak between tests.
 *
 * Every credential-shaped value here is a literal placeholder. No real key,
 * token or project URL appears in this file, and `.env.local` is never read.
 *
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/proxy.ts`.
 */

import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// ─── Seam mocks ──────────────────────────────────────────────────────────────

/** supabase.auth.getUser() */
const mockGetUser = jest.fn();

/** Called once on a page with no users row (DEC-35); asserted wherever a sign-out must or must not happen. */
const mockSignOut = jest.fn();

/** .single() at the end of the one users read */
const mockSingle = jest.fn();

/** createServerClient(url, key, { cookies }) */
const mockCreateServerClient = jest.fn();

type UsersRead = { table: string; columns: string; eq: [string, unknown] };
const reads: UsersRead[] = [];

jest.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

function scriptedClient() {
  return {
    auth: { getUser: mockGetUser, signOut: mockSignOut },
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              reads.push({ table, columns, eq: [column, value] });
              return { single: mockSingle };
            },
          };
        },
      };
    },
  };
}

// ─── Personas ────────────────────────────────────────────────────────────────

const ROWS = {
  active: { onboarding_completed: true, banned_at: null, ban_expires_at: null },
  banned_permanent: {
    onboarding_completed: true,
    banned_at: "2026-01-01T00:00:00.000Z",
    ban_expires_at: null,
  },
  unonboarded: {
    onboarding_completed: false,
    banned_at: null,
    ban_expires_at: null,
  },
} as const;

type Persona = keyof typeof ROWS;

/** Synthetic ids; none of them is a seed or production id. */
const IDS: Record<Persona, string> = {
  active: "00000000-0000-4000-8000-000000000b01",
  banned_permanent: "00000000-0000-4000-8000-000000000b02",
  unonboarded: "00000000-0000-4000-8000-000000000b05",
};

function authenticatedAs(persona: Persona) {
  const id = IDS[persona];
  mockGetUser.mockResolvedValue({
    data: { user: { id, email: `${persona}@mail.mcgill.ca` } },
    error: null,
  });
  return id;
}

function signedInAs(persona: Persona) {
  const id = authenticatedAs(persona);
  mockSingle.mockResolvedValue({ data: { id, ...ROWS[persona] }, error: null });
  return id;
}

/** NextResponse.redirect()'s default status */
const REDIRECT_STATUS = 307;

// ─── Request helpers ─────────────────────────────────────────────────────────

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.53.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function req(
  urlPath: string,
  { method = "GET", cookie }: { method?: string; cookie?: string } = {}
): NextRequest {
  const headers: Record<string, string> = { "x-forwarded-for": nextIp() };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`https://proxy.test${urlPath}`, { method, headers });
}

function location(res: Response): URL | null {
  const header = res.headers.get("location");
  return header ? new URL(header, "https://proxy.test") : null;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

/** The session cookie name the placeholder project URL yields. */
const AUTH_COOKIE = "sb-placeholder-project-auth-token";

describe("proxy ring (DEFECT — F-003, F-062, F-088, F-089; FIXED in 05-05)", () => {
  const savedEnv = { ...process.env };
  let consoleError: jest.SpyInstance;

  beforeAll(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleError.mockRestore();
    process.env = savedEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reads.length = 0;
    // Placeholders only — never a real key, never read from .env.local.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
    mockCreateServerClient.mockImplementation(() => scriptedClient());
    mockSignOut.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  // ── a. F-003 ──────────────────────────────────────────────────────────────
  it("F-003: with NEXT_PUBLIC_SUPABASE_URL unset, anonymous /profile → 500 plain text, no client built, logged", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await proxy(req("/profile"));

    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").not.toContain("application/json");
    expect(await res.text()).toBe("Internal Server Error");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[Middleware] Error:",
      expect.objectContaining({ name: "MissingEnvError" })
    );
  });

  it('F-003: with NEXT_PUBLIC_SUPABASE_URL unset, anonymous /api/events → 500 JSON {"error":"Failed to process request"}', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await proxy(req("/api/events"));

    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await res.json()).toEqual({ error: "Failed to process request" });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  // ── b. F-088: the outer catch ─────────────────────────────────────────────
  it("F-088: auth.getUser rejecting reaches the catch — /profile → 500, not passed through, and logged", async () => {
    const failure = new Error("auth server unreachable");
    mockGetUser.mockRejectedValue(failure);

    const res = await proxy(req("/profile"));

    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toBe("Internal Server Error");
    expect(consoleError).toHaveBeenCalledWith("[Middleware] Error:", failure);
  });

  // ── c. F-088: a failed users read ─────────────────────────────────────────
  it("F-088: a users read failing with XX000 fails closed — /my-events → 500 after one users read", async () => {
    authenticatedAs("active");
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "internal error" },
    });

    const res = await proxy(req("/my-events"));

    expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // ── d. F-088: no users row ────────────────────────────────────────────────
  it('F-088: a users read answering PGRST116 (no row) on POST /api/events/x/save → 403 {"error":"Profile not found"}, no sign-out', async () => {
    authenticatedAs("active");
    mockSingle.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });

    const res = await proxy(req("/api/events/x/save", { method: "POST" }));

    expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await res.json()).toEqual({ error: "Profile not found" });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("F-088: a users read answering PGRST116 (no row) on GET /my-events → signed out once, 307 to /?error=profile_sync_failed carrying the sign-out's cookies", async () => {
    // Capture the proxy's cookie adapter so the scripted sign-out can clear
    // the session through setAll, as @supabase/ssr does.
    let setAll: ((c: { name: string; value: string; options: object }[]) => void) | null = null;
    mockCreateServerClient.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: typeof setAll } }) => {
        setAll = options.cookies.setAll;
        return scriptedClient();
      }
    );
    mockSignOut.mockImplementation(async () => {
      setAll?.([{ name: AUTH_COOKIE, value: "", options: { maxAge: 0, path: "/" } }]);
      return { error: null };
    });
    authenticatedAs("active");
    mockSingle.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });

    const res = await proxy(req("/my-events"));

    expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(REDIRECT_STATUS);
    const loc = location(res);
    expect(loc?.origin).toBe("https://proxy.test");
    expect(loc?.pathname).toBe("/");
    expect(loc?.search).toBe("?error=profile_sync_failed");
    const cleared = res.headers
      .getSetCookie()
      .find((header) => header.startsWith(`${AUTH_COOKIE}=`));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Max-Age=0/i);
  });

  // ── e. F-062 ──────────────────────────────────────────────────────────────
  it('F-062: a banned user\'s POST /api/events/x/save → 403 {"error":"Account suspended"} as JSON, no redirect', async () => {
    signedInAs("banned_permanent");

    const res = await proxy(req("/api/events/x/save", { method: "POST" }));

    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await res.json()).toEqual({ error: "Account suspended" });
  });

  // ── f. F-089: cookie deleted ──────────────────────────────────────────────
  it("F-089: an un-onboarded user with NO needs_onboarding cookie on /my-events → 307 to /onboarding (database truth)", async () => {
    signedInAs("unonboarded");

    const res = await proxy(req("/my-events"));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res)?.pathname).toBe("/onboarding");
    expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
  });

  // ── g. F-089: stale cookie ────────────────────────────────────────────────
  it("F-089: an onboarded user carrying a stale needs_onboarding=1 cookie on / is passed through", async () => {
    signedInAs("active");

    const res = await proxy(req("/", { cookie: "needs_onboarding=1" }));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});
