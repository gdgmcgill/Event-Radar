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
 *   It pins TODAY's wrong shapes exactly, so the commit that fixes each one
 *   has to move an assertion visibly. It is not the specification of the fix.
 *   The after-shapes are DEC-34..DEC-36 in the phase decision record and
 *   05-RESEARCH.md § B. What must survive the fix lives in
 *   `src/proxy-characterization.test.ts`, not here.
 *
 * Registered as F-003 (Medium), F-062 (Medium), F-088 (Medium) and F-089
 * (Low) in .planning/audit/findings.json. Closes in Phase 5 (plan 05-05).
 *
 * Status: OPEN — assertions move in 05-05's proxy commit
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

/** proxy.ts:54-56 — supabase.auth.getUser() */
const mockGetUser = jest.fn();

/** Not called by today's proxy; asserted so a no-row sign-out would be seen. */
const mockSignOut = jest.fn();

/** proxy.ts:96-100 — .single() at the end of the users read */
const mockSingle = jest.fn();

/** proxy.ts:27 — createServerClient(url, key, { cookies }) */
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

describe("proxy ring (DEFECT — F-003, F-062, F-088, F-089; OPEN until 05-05)", () => {
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
  it("F-003: with NEXT_PUBLIC_SUPABASE_URL unset, anonymous /profile is passed through and no client is built", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await proxy(req("/profile"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  // ── b. F-088: the outer catch ─────────────────────────────────────────────
  it("F-088: auth.getUser rejecting is swallowed by the outer catch — passed through with status 200 and logged", async () => {
    const failure = new Error("auth server unreachable");
    mockGetUser.mockRejectedValue(failure);

    const res = await proxy(req("/profile"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalledWith("[Middleware] Error:", failure);
  });

  // ── c. F-088: a failed ban read ───────────────────────────────────────────
  it("F-088: a users read failing with XX000 is read as not banned — /my-events passed through", async () => {
    authenticatedAs("active");
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "internal error" },
    });

    const res = await proxy(req("/my-events"));

    expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  // ── d. F-088: no users row ────────────────────────────────────────────────
  it.each([
    ["POST", "/api/events/x/save"],
    ["GET", "/my-events"],
  ])(
    "F-088: a users read answering PGRST116 (no row) is read as not banned — %s %s passed through, no sign-out",
    async (method, route) => {
      authenticatedAs("active");
      mockSingle.mockResolvedValue({
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
        },
      });

      const res = await proxy(req(route, { method }));

      expect(reads.filter((r) => r.table === "users")).toHaveLength(1);
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
      expect(mockSignOut).not.toHaveBeenCalled();
    }
  );

  // ── e. F-062 ──────────────────────────────────────────────────────────────
  it("F-062: a banned user's POST /api/events/x/save is answered with a 307 to the HTML page /banned, not JSON", async () => {
    signedInAs("banned_permanent");

    const res = await proxy(req("/api/events/x/save", { method: "POST" }));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res)?.pathname).toBe("/banned");
    expect(res.headers.get("content-type") ?? "").not.toContain("application/json");
  });

  // ── f. F-089: cookie deleted ──────────────────────────────────────────────
  it("F-089: an un-onboarded user with NO needs_onboarding cookie on /my-events is passed through", async () => {
    signedInAs("unonboarded");

    const res = await proxy(req("/my-events"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  // ── g. F-089: stale cookie ────────────────────────────────────────────────
  it("F-089: an onboarded user carrying a stale needs_onboarding=1 cookie on / → 307 to /onboarding", async () => {
    signedInAs("active");

    const res = await proxy(req("/", { cookie: "needs_onboarding=1" }));

    expect(res.status).toBe(REDIRECT_STATUS);
    expect(location(res)?.pathname).toBe("/onboarding");
  });
});
