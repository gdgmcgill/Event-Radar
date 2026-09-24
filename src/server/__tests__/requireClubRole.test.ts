/**
 * Unit tests for the club-membership guard (D-09).
 *
 * The load-bearing assertion in this file is the last one: an admin with no
 * club membership is DENIED. The audit's persona rule R9 records that admin is
 * not a club-role bypass anywhere in this tree, and /api/clubs/[id] DELETE says
 * so in as many words. Encoding a bypass here would be both a behaviour change
 * and a privilege escalation.
 */

import type { ServerSupabaseClient } from "../context";
import {
  CLUB_ROLES,
  isClubRole,
  requireClubRole,
  type ClubRole,
} from "../authz/requireClubRole";

type QueryResult = { data: { role: string } | null; error: unknown };

const mockFrom = jest.fn();
let lastChain: Record<string, jest.Mock>;

function makeSupabase(result: QueryResult): ServerSupabaseClient {
  mockFrom.mockImplementation(() => {
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => Promise.resolve(result));
    chain.single = jest.fn(() => Promise.resolve(result));
    lastChain = chain;
    return chain;
  });
  return { from: mockFrom } as unknown as ServerSupabaseClient;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireClubRole", () => {
  it("denies a user with no membership row", async () => {
    const supabase = makeSupabase({ data: null, error: null });

    const result = await requireClubRole(supabase, "club-1", "user-1", [
      "owner",
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(403);
    expect(result.actualRole).toBeNull();
  });

  it("denies a member whose role is outside the accepted set", async () => {
    const supabase = makeSupabase({ data: { role: "organizer" }, error: null });

    const result = await requireClubRole(supabase, "club-1", "user-1", [
      "owner",
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the deny arm");
    expect(result.response.status).toBe(403);
  });

  it("reports the actual role on the deny arm", async () => {
    const supabase = makeSupabase({ data: { role: "organizer" }, error: null });

    const result = await requireClubRole(supabase, "club-1", "user-1", [
      "owner",
    ]);

    if (result.ok) throw new Error("expected the deny arm");
    expect(result.actualRole).toBe("organizer");
  });

  it("denies a stored role the schema does not admit, and reports it (DEC-40)", async () => {
    // club_members_role_check admits only owner and organizer. A row holding
    // anything else is a deny, even when a caller's accepted set (forced past
    // the type here) names that value.
    const supabase = makeSupabase({ data: { role: "member" }, error: null });
    const forcedSet = ["owner", "member"] as unknown as readonly ClubRole[];

    const result = await requireClubRole(
      supabase,
      "club-1",
      "user-1",
      forcedSet,
      "Only the club owner can do this"
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("an unexpected stored role must be denied");
    expect(result.actualRole).toBe("member");
    expect(result.response.status).toBe(403);
    expect(await result.response.json()).toEqual({
      error: "Only the club owner can do this",
    });
  });

  it("CLUB_ROLES is exactly the schema's two roles, and isClubRole admits nothing else", () => {
    expect(CLUB_ROLES).toEqual(["owner", "organizer"]);
    expect(isClubRole("owner")).toBe(true);
    expect(isClubRole("organizer")).toBe(true);
    expect(isClubRole("member")).toBe(false);
    expect(isClubRole("admin")).toBe(false);
    expect(isClubRole("")).toBe(false);
  });

  it("permits a member whose role is in the accepted set and reports it", async () => {
    const supabase = makeSupabase({ data: { role: "owner" }, error: null });

    const result = await requireClubRole(supabase, "club-1", "user-1", [
      "owner",
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.role).toBe("owner");
  });

  it("accepts a set of roles rather than a single hard-coded one", async () => {
    const organizer = makeSupabase({ data: { role: "organizer" }, error: null });

    const result = await requireClubRole(
      organizer,
      "club-1",
      "user-1",
      CLUB_ROLES
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the permit arm");
    expect(result.role).toBe("organizer");
  });

  it("denies when the accepted set is empty", async () => {
    const supabase = makeSupabase({ data: { role: "owner" }, error: null });

    const result = await requireClubRole(supabase, "club-1", "user-1", []);

    expect(result.ok).toBe(false);
  });

  it("scopes the membership read to both the club and the user", async () => {
    const supabase = makeSupabase({ data: { role: "owner" }, error: null });

    await requireClubRole(supabase, "club-1", "user-1", ["owner"]);

    expect(mockFrom).toHaveBeenCalledWith("club_members");
    expect(lastChain.eq).toHaveBeenCalledWith("club_id", "club-1");
    expect(lastChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("denies a site-wide admin who holds no club membership (persona rule R9)", async () => {
    // The admin's site-wide role is real, and it is irrelevant here: this guard
    // reads club_members and nothing else. Denial is the correct outcome.
    const supabase = makeSupabase({ data: null, error: null });

    const result = await requireClubRole(
      supabase,
      "club-1",
      "site-admin-user",
      ["owner"]
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("an admin without membership must be denied");
    expect(result.response.status).toBe(403);
  });

  it("never consults the users table, so no site-wide role can bypass it", async () => {
    const supabase = makeSupabase({ data: null, error: null });

    await requireClubRole(supabase, "club-1", "site-admin-user", ["owner"]);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("club_members");
    expect(mockFrom).not.toHaveBeenCalledWith("users");
  });
});
