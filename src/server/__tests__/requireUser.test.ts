/**
 * Unit tests for the authentication guard.
 *
 * The property under test is that the guard fails CLOSED: the deny arm is what
 * every path that is not explicitly permitted produces.
 */

import type { RequestContext } from "../context";
import { requireUser } from "../authz/requireUser";

const AUTHENTICATED_USER = { id: "user-1", email: "someone@mail.mcgill.ca" };

function makeContext(overrides: Partial<RequestContext>): RequestContext {
  return {
    supabase: null,
    user: null,
    profile: null,
    requestId: "req-1",
    ...overrides,
  } as unknown as RequestContext;
}

describe("requireUser", () => {
  it("denies an anonymous request with a ready-to-return 401", async () => {
    const result = requireUser(makeContext({ user: null }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("denies when the user is undefined rather than explicitly null", () => {
    const result = requireUser(makeContext({ user: undefined }));

    expect(result.ok).toBe(false);
  });

  it("permits an authenticated request and carries the user through", () => {
    const result = requireUser(
      makeContext({ user: AUTHENTICATED_USER } as Partial<RequestContext>)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.user).toEqual(AUTHENTICATED_USER);
  });

  it("carries no response on the permit arm", () => {
    const result = requireUser(
      makeContext({ user: AUTHENTICATED_USER } as Partial<RequestContext>)
    );

    expect(result).not.toHaveProperty("response");
  });
});
