/**
 * PRESERVE characterization — src/proxy.ts ring behaviour (REFAC-11)
 *
 * The proxy is the only page-level authentication ring in this application. It
 * also runs the API rate limiter, the ban check and the onboarding guard.
 * `src/proxy.test.ts` pins its MATCHER only: 02-REVIEW WR-04 found that suite
 * stays green when the redirect block is deleted. This file pins what the ring
 * DOES on a request. Every expectation here is written against today's
 * unmodified `src/proxy.ts`, and it must pass unedited after plan 05-05
 * rewrites the ring. A red result in this file after that rewrite is a
 * behaviour change, not a test problem.
 *
 * Tests cover:
 *   - anonymous GET on every PROTECTED_ROUTES entry (re-derived from the
 *     source literal) and on a nested path: 307 to `/` with signin=required
 *     and next=<path>, encoded as encodeURIComponent encodes it; `/profiles`
 *     is not a protected prefix
 *   - anonymous GET on a public page and a public API: passed through
 *   - an active user on a protected page: passed through after exactly one
 *     users read keyed on the user's id
 *   - a banned user (permanent, and suspended with a future expiry): 307 to
 *     `/banned` with the original query string preserved
 *   - an expired suspension: admitted
 *   - the ban-exempt paths `/banned` and `/auth/signout`: no users read
 *   - the onboarding redirect, and its three exemptions (`/onboarding`,
 *     `/api/*`, `/auth/*`)
 *   - the rate limiter runs before any auth work: the 31st POST from one IP is
 *     answered 429 without a Supabase client being constructed
 *
 * WHY THE MOCK SEAM IS @supabase/ssr:
 *   The proxy imports `createServerClient` from "@supabase/ssr" directly
 *   (proxy.ts:1). It does not use `src/lib/supabase/server.ts`, which reads
 *   `next/headers` cookies and cannot run in the proxy. Mocking that factory
 *   would mock nothing here. The mock returns a client whose `auth.getUser`
 *   and `auth.signOut` are scripted `jest.fn`s and whose
 *   `from(table).select(cols).eq(col, val).single()` chain records each read
 *   and returns a scripted `{ data, error }`. It returns the FULL persona row
 *   whatever column string is asked for, so this suite survives 05-05
 *   narrowing or widening the select.
 *
 * WHY EVERY TEST USES ITS OWN IP:
 *   The rate limiter's bucket store lives on `globalThis` and is keyed by
 *   `method:pathname:ip` (src/middlewareRateLimit.ts:102). It survives across
 *   the tests in this file. `nextIp()` hands every request a fresh
 *   `x-forwarded-for` address so no test inherits another's bucket.
 *
 * Deliberately NOT pinned:
 *   - the users select column list (05-05 changes it to add
 *     onboarding_completed; the ring's decision is what matters)
 *   - response bodies of pass-through responses (NextResponse.next() has none)
 *   - any shape slice 3 must change (the env pass-through, the catch
 *     pass-through, the fail-open ban read, the 307 on a banned `/api/*` call,
 *     the cookie-only onboarding predicate); those are pinned in
 *     `src/proxy-defect.test.ts`, whose assertions 05-05 moves
 *
 * Every credential-shaped value here is a literal placeholder. No real key,
 * token or project URL appears in this file, and `.env.local` is never read.
 *
 * The subject is imported and exercised only. This suite never modifies,
 * wraps, or re-exports anything from `src/proxy.ts`.
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// ─── Seam mocks ──────────────────────────────────────────────────────────────

/** proxy.ts:54-56 — supabase.auth.getUser() */
const mockGetUser = jest.fn();

/** Never called by today's proxy; recorded so no future path signs anyone out unseen. */
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

// ─── Constants read from the subject, not from the plan ──────────────────────

/**
 * PROTECTED_ROUTES, re-derived from the array literal at proxy.ts:114 with the
 * same regex as e2e/fixtures.ts:49. CLAUDE.md names that literal as the only
 * authority, so this file does not keep a copy of it.
 */
function protectedRoutes(): string[] {
  const source = fs.readFileSync(path.resolve(__dirname, "proxy.ts"), "utf8");
  const body = source.match(/PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]/)?.[1];
  if (!body) {
    throw new Error(
      "Could not re-derive PROTECTED_ROUTES from src/proxy.ts. Fix this parser rather than hard-coding the list."
    );
  }
  return body
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

const PROTECTED = protectedRoutes();

/** NextResponse.redirect()'s default status, asserted rather than assumed */
const REDIRECT_STATUS = 307;

/** src/middlewareRateLimit.ts:28 — LIMITS.POST */
const POST_BUDGET = 30;

// ─── Personas ────────────────────────────────────────────────────────────────

const ROWS = {
  active: { onboarding_completed: true, banned_at: null, ban_expires_at: null },
  banned_permanent: {
    onboarding_completed: true,
    banned_at: "2026-01-01T00:00:00.000Z",
    ban_expires_at: null,
  },
  suspended_active: {
    onboarding_completed: true,
    banned_at: "2026-01-01T00:00:00.000Z",
    ban_expires_at: "2099-01-01T00:00:00.000Z",
  },
  suspension_expired: {
    onboarding_completed: true,
    banned_at: "2019-01-01T00:00:00.000Z",
    ban_expires_at: "2020-01-01T00:00:00.000Z",
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
  active: "00000000-0000-4000-8000-000000000a01",
  banned_permanent: "00000000-0000-4000-8000-000000000a02",
  suspended_active: "00000000-0000-4000-8000-000000000a03",
  suspension_expired: "00000000-0000-4000-8000-000000000a04",
  unonboarded: "00000000-0000-4000-8000-000000000a05",
};

function signedInAs(persona: Persona) {
  const id = IDS[persona];
  mockGetUser.mockResolvedValue({
    data: { user: { id, email: `${persona}@mail.mcgill.ca` } },
    error: null,
  });
  mockSingle.mockResolvedValue({ data: { id, ...ROWS[persona] }, error: null });
  return id;
}

function anonymous() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── Request helpers ─────────────────────────────────────────────────────────

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.52.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function req(
  urlPath: string,
  { method = "GET", cookie, ip = nextIp() }: { method?: string; cookie?: string; ip?: string } = {}
): NextRequest {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`https://proxy.test${urlPath}`, { method, headers });
}

function location(res: Response): URL | null {
  const header = res.headers.get("location");
  return header ? new URL(header, "https://proxy.test") : null;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("proxy ring (PRESERVE — REFAC-11)", () => {
  const savedEnv = { ...process.env };

  afterAll(() => {
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
    anonymous();
  });

  it("re-derives a non-empty PROTECTED_ROUTES list from the source literal", () => {
    expect(PROTECTED.length).toBeGreaterThan(0);
    for (const route of PROTECTED) expect(route.startsWith("/")).toBe(true);
  });

  // ── 1. Anonymous on protected routes ───────────────────────────────────────
  describe("1. anonymous GET on a protected route", () => {
    it.each([...PROTECTED, "/profile/edit"])(
      "%s → 307 to / with signin=required and next=<path>",
      async (route) => {
        const res = await proxy(req(route));

        expect(res.status).toBe(REDIRECT_STATUS);
        const loc = location(res);
        expect(loc).not.toBeNull();
        expect(loc!.pathname).toBe("/");
        expect(loc!.searchParams.get("signin")).toBe("required");
        expect(loc!.searchParams.get("next")).toBe(route);
        // The raw header carries the path as encodeURIComponent encodes it,
        // which is what e2e/fixtures.ts signInRedirectFor() expects.
        expect(res.headers.get("location")).toContain(
          `next=${encodeURIComponent(route)}`
        );
        expect(decodeURIComponent(encodeURIComponent(route))).toBe(
          loc!.searchParams.get("next")
        );
      }
    );

    it("/profiles is not a protected prefix: anonymous GET is not redirected", async () => {
      const res = await proxy(req("/profiles"));

      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    });
  });

  // ── 2. Anonymous on public surfaces ────────────────────────────────────────
  it.each(["/", "/api/events"])(
    "2. anonymous GET %s is passed through: no Location, status 200",
    async (route) => {
      const res = await proxy(req(route));

      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    }
  );

  // ── 3. Active user ────────────────────────────────────────────────────────
  it("3. an active user on /my-events is passed through after exactly one users read keyed on its id", async () => {
    const id = signedInAs("active");

    const res = await proxy(req("/my-events"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
    const usersReads = reads.filter((r) => r.table === "users");
    expect(usersReads).toHaveLength(1);
    expect(usersReads[0].eq).toEqual(["id", id]);
  });

  // ── 4. Banned users ───────────────────────────────────────────────────────
  it.each<Persona>(["banned_permanent", "suspended_active"])(
    "4. %s GET /events?x=1 → 307 to /banned with the query string preserved",
    async (persona) => {
      signedInAs(persona);

      const res = await proxy(req("/events?x=1"));

      expect(res.status).toBe(REDIRECT_STATUS);
      const loc = location(res);
      expect(loc).not.toBeNull();
      expect(loc!.pathname).toBe("/banned");
      expect(loc!.search).toBe("?x=1");
    }
  );

  // ── 5. Expired suspension ─────────────────────────────────────────────────
  it("5. a suspension whose expiry has passed is admitted on /my-events", async () => {
    signedInAs("suspension_expired");

    const res = await proxy(req("/my-events"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  // ── 6. Ban-exempt paths ───────────────────────────────────────────────────
  it.each(["/banned", "/auth/signout"])(
    "6. a permanently banned user on %s: no users read, no Location",
    async (route) => {
      signedInAs("banned_permanent");

      const res = await proxy(req(route));

      expect(reads.filter((r) => r.table === "users")).toHaveLength(0);
      expect(res.headers.get("location")).toBeNull();
    }
  );

  // ── 7. Onboarding guard ───────────────────────────────────────────────────
  describe("7. onboarding guard", () => {
    it("an un-onboarded user carrying needs_onboarding=1 on / → 307 to /onboarding", async () => {
      signedInAs("unonboarded");

      const res = await proxy(req("/", { cookie: "needs_onboarding=1" }));

      expect(res.status).toBe(REDIRECT_STATUS);
      expect(location(res)?.pathname).toBe("/onboarding");
    });

    it.each(["/onboarding", "/api/events", "/auth/signout"])(
      "the same user on %s is not sent to /onboarding",
      async (route) => {
        signedInAs("unonboarded");

        const res = await proxy(req(route, { cookie: "needs_onboarding=1" }));

        expect(location(res)?.pathname).not.toBe("/onboarding");
      }
    );
  });

  // ── 8. Rate limit before auth ─────────────────────────────────────────────
  it("8. the 31st POST from one IP to /api/events/x/save is answered 429 before a Supabase client is built", async () => {
    const ip = nextIp();
    for (let i = 0; i < POST_BUDGET; i++) {
      const allowed = await proxy(req("/api/events/x/save", { method: "POST", ip }));
      expect(allowed.status).not.toBe(429);
    }
    const constructedBefore = mockCreateServerClient.mock.calls.length;
    const getUserBefore = mockGetUser.mock.calls.length;

    const res = await proxy(req("/api/events/x/save", { method: "POST", ip }));

    expect(res.status).toBe(429);
    expect(mockCreateServerClient.mock.calls.length).toBe(constructedBefore);
    expect(mockGetUser.mock.calls.length).toBe(getUserBefore);
  });
});
