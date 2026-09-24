/**
 * Unit tests for the onboarding guard (DEC-34, DEC-35).
 *
 * The guard answers one question: may a signed-in caller act before finishing
 * onboarding? Authentication is not its job, so an anonymous caller passes
 * through to whichever guard owns that (research C2). A missing profile row is
 * denied with the same bytes requireActiveUser uses, so the order in which a
 * handler calls the two guards can never turn a missing row into an admission.
 */

import type { RequestContext } from "../context";
import { requireOnboarded } from "../authz/requireOnboarded";

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

function contextWithOnboarding(
  onboarding_completed: boolean | null
): RequestContext {
  return makeContext({
    user: AUTHENTICATED_USER,
    profile: {
      id: "user-1",
      roles: ["user"],
      onboarding_completed,
      banned_at: null,
      ban_expires_at: null,
    },
  } as unknown as Partial<RequestContext>);
}

async function expectDenied(
  result: ReturnType<typeof requireOnboarded>,
  status: number,
  body: unknown
): Promise<void> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected the deny arm");
  expect(result.response.status).toBe(status);
  expect(await result.response.json()).toEqual(body);
}

describe("requireOnboarded", () => {
  it("passes an anonymous request: authentication is another guard's job", () => {
    const result = requireOnboarded(makeContext({ user: null }));

    expect(result).toEqual({ ok: true });
  });

  it('denies a signed-in user with no profile row: 403 {"error":"Profile not found"} (DEC-35)', async () => {
    const result = requireOnboarded(
      makeContext({
        user: AUTHENTICATED_USER,
        profile: null,
      } as unknown as Partial<RequestContext>)
    );

    await expectDenied(result, 403, { error: "Profile not found" });
  });

  it('denies onboarding_completed false: 403 {"error":"Onboarding required"}', async () => {
    const result = requireOnboarded(contextWithOnboarding(false));

    await expectDenied(result, 403, { error: "Onboarding required" });
  });

  it("denies onboarding_completed null: 403 Onboarding required (only true admits)", async () => {
    const result = requireOnboarded(contextWithOnboarding(null));

    await expectDenied(result, 403, { error: "Onboarding required" });
  });

  it("passes onboarding_completed true", () => {
    const result = requireOnboarded(contextWithOnboarding(true));

    expect(result).toEqual({ ok: true });
  });

  it("does not read the ban: a banned, onboarded user passes this guard", () => {
    const ctx = contextWithOnboarding(true);
    const result = requireOnboarded({
      ...ctx,
      profile: { ...ctx.profile!, banned_at: "2000-01-01T00:00:00.000Z" },
    } as unknown as RequestContext);

    expect(result).toEqual({ ok: true });
  });
});
