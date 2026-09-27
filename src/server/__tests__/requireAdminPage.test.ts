/**
 * Unit tests for the admin page gate (plan 06-17, DEC-79, F-054, DI-55).
 *
 * `requireAdminPage(redirectTo)` is the server-layout form of the admin
 * decision: pages cannot answer a JSON 401/403, so every refusal is
 * `redirect(redirectTo)`. It refuses an anonymous caller, a caller with no
 * profile row, a banned caller (admin or not) and a signed-in non-admin; an
 * active admin gets the request context back.
 *
 * `next/navigation`'s `redirect` is mocked to throw, as the real one does
 * (it throws NEXT_REDIRECT), so a refusal never falls through to the permit
 * arm. `getRequestContext` is mocked so each row controls the user and the
 * profile slice.
 */

import type { RequestContext } from "../context";

const redirectMock = jest.fn((to: string): never => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
jest.mock("next/navigation", () => ({
  redirect: (to: string) => redirectMock(to),
}));

let currentContext: RequestContext;
const getRequestContextMock = jest.fn(async () => currentContext);
jest.mock("../context", () => ({
  getRequestContext: () => getRequestContextMock(),
}));

import { requireAdminPage } from "../authz/requireAdminPage";

const USER = { id: "user-1", email: "someone@mail.mcgill.ca" };
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

function context(
  user: typeof USER | null,
  profile: Record<string, unknown> | null
): RequestContext {
  return {
    supabase: null,
    user,
    profile,
    requestId: "req-1",
  } as unknown as RequestContext;
}

function profile(roles: string[], ban: Partial<Record<"banned_at" | "ban_expires_at", string | null>> = {}) {
  return {
    id: USER.id,
    roles,
    onboarding_completed: true,
    banned_at: null,
    ban_expires_at: null,
    ...ban,
  };
}

beforeEach(() => {
  redirectMock.mockClear();
  getRequestContextMock.mockClear();
});

describe("requireAdminPage", () => {
  it.each([
    ["anonymous", context(null, null)],
    ["signed in with no profile row", context(USER, null)],
    ["signed-in non-admin", context(USER, profile(["user"]))],
    ["organizer without admin", context(USER, profile(["user", "club_organizer"]))],
    ["admin banned permanently", context(USER, profile(["user", "admin"], { banned_at: PAST }))],
    [
      "admin banned until tomorrow",
      context(USER, profile(["user", "admin"], { banned_at: PAST, ban_expires_at: FUTURE })),
    ],
  ])("%s → redirect to the given target", async (_label, ctx) => {
    currentContext = ctx;

    await expect(requireAdminPage("/x")).rejects.toThrow("NEXT_REDIRECT:/x");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/x");
  });

  it("passes the target through unchanged (the layouts keep their own targets)", async () => {
    currentContext = context(USER, profile(["user"]));

    await expect(requireAdminPage("/")).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("active admin → returns the request context and never redirects", async () => {
    const ctx = context(USER, profile(["user", "admin"]));
    currentContext = ctx;

    await expect(requireAdminPage("/x")).resolves.toEqual(ctx);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(getRequestContextMock).toHaveBeenCalledTimes(1);
  });

  it("admin whose ban has expired → active, returns the context", async () => {
    const ctx = context(USER, profile(["user", "admin"], { banned_at: PAST, ban_expires_at: PAST }));
    currentContext = ctx;

    await expect(requireAdminPage("/x")).resolves.toEqual(ctx);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
