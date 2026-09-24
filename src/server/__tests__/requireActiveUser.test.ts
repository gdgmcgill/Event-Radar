/**
 * Unit tests for the active-user guard (DEC-34, DEC-35).
 *
 * Every deny arm is asserted to the byte: the status and the exact JSON body,
 * because this guard's responses become the wire bytes of every write handler
 * that adopts it (05-06, 05-07). The order of the arms matters as much as their
 * bytes: anonymous is 401 before anything else, a missing profile row is 403
 * "Profile not found" (never "not banned"), and only then is the ban read.
 */

import type { RequestContext } from "../context";
import { requireActiveUser } from "../authz/requireActiveUser";

const AUTHENTICATED_USER = { id: "user-1", email: "someone@mail.mcgill.ca" };

const FAR_FUTURE = "2999-01-01T00:00:00.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

function makeContext(overrides: Partial<RequestContext>): RequestContext {
  return {
    supabase: null,
    user: null,
    profile: null,
    requestId: "req-1",
    ...overrides,
  } as unknown as RequestContext;
}

function contextWithBan(
  banned_at: string | null,
  ban_expires_at: string | null
): RequestContext {
  return makeContext({
    user: AUTHENTICATED_USER,
    profile: {
      id: "user-1",
      roles: ["user"],
      onboarding_completed: true,
      banned_at,
      ban_expires_at,
    },
  } as unknown as Partial<RequestContext>);
}

async function expectDenied(
  result: ReturnType<typeof requireActiveUser>,
  status: number,
  body: unknown
): Promise<void> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected the deny arm");
  expect(result.response.status).toBe(status);
  expect(await result.response.json()).toEqual(body);
}

describe("requireActiveUser", () => {
  it('denies an anonymous request with 401 {"error":"Unauthorized"}', async () => {
    const result = requireActiveUser(makeContext({ user: null }));

    await expectDenied(result, 401, { error: "Unauthorized" });
  });

  it("denies an anonymous request with 401 even when a profile is somehow present", async () => {
    const ctx = contextWithBan(null, null);
    const result = requireActiveUser({ ...ctx, user: null });

    await expectDenied(result, 401, { error: "Unauthorized" });
  });

  it('denies a signed-in user with no profile row: 403 {"error":"Profile not found"} (DEC-35)', async () => {
    const result = requireActiveUser(
      makeContext({
        user: AUTHENTICATED_USER,
        profile: null,
      } as unknown as Partial<RequestContext>)
    );

    await expectDenied(result, 403, { error: "Profile not found" });
  });

  it('denies a permanent ban (banned_at set, ban_expires_at null): 403 {"error":"Account suspended"}', async () => {
    const result = requireActiveUser(contextWithBan(FAR_PAST, null));

    await expectDenied(result, 403, { error: "Account suspended" });
  });

  it("denies a ban whose expiry is in the future: 403 Account suspended", async () => {
    const result = requireActiveUser(contextWithBan(FAR_PAST, FAR_FUTURE));

    await expectDenied(result, 403, { error: "Account suspended" });
  });

  it("permits a ban whose expiry is in the past, carrying the user", () => {
    const result = requireActiveUser(contextWithBan(FAR_PAST, FAR_PAST));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.user).toEqual(AUTHENTICATED_USER);
  });

  it("permits a user who was never banned (banned_at null), carrying the user", () => {
    const result = requireActiveUser(contextWithBan(null, null));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.user).toEqual(AUTHENTICATED_USER);
  });

  it("does not read onboarding: an un-onboarded, unbanned user is permitted", () => {
    const ctx = contextWithBan(null, null);
    const result = requireActiveUser({
      ...ctx,
      profile: { ...ctx.profile!, onboarding_completed: false },
    });

    expect(result.ok).toBe(true);
  });
});
