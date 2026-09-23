/**
 * Unit tests for the role guard.
 *
 * The distinction that matters is 401 vs 403: an anonymous request is not
 * authenticated, a request from a user without the role is authenticated but
 * not permitted. Collapsing the two hides which one happened.
 */

import type { RequestContext } from "../context";
import { requireRole } from "../authz/requireRole";

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

function contextWithRoles(roles: string[]): RequestContext {
  return makeContext({
    user: AUTHENTICATED_USER,
    profile: {
      id: "user-1",
      roles,
      onboarding_completed: true,
    },
  } as unknown as Partial<RequestContext>);
}

describe("requireRole", () => {
  it("denies an anonymous request with 401, not 403", async () => {
    const result = requireRole(makeContext({ user: null }), "admin");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(401);
  });

  it("denies an authenticated user whose profile is missing", async () => {
    const result = requireRole(
      makeContext({
        user: AUTHENTICATED_USER,
        profile: null,
      } as unknown as Partial<RequestContext>),
      "admin"
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(403);
  });

  it("denies a user who lacks the role with 403 rather than 401", async () => {
    const result = requireRole(contextWithRoles(["user"]), "admin");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(403);
  });

  it("denies a user whose roles array is empty", () => {
    const result = requireRole(contextWithRoles([]), "admin");

    expect(result.ok).toBe(false);
  });

  it("permits a user who carries the required role", () => {
    const result = requireRole(contextWithRoles(["user", "admin"]), "admin");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.user).toEqual(AUTHENTICATED_USER);
  });

  it("does not treat one role as a substitute for another", () => {
    const organizer = contextWithRoles(["club_organizer"]);

    expect(requireRole(organizer, "admin").ok).toBe(false);
    expect(requireRole(organizer, "club_organizer").ok).toBe(true);
  });
});
