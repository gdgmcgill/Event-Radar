import { isBanned } from "../ban";

describe("isBanned", () => {
  it("returns false when banned_at is null", () => {
    expect(isBanned({ banned_at: null, ban_expires_at: null })).toBe(false);
  });

  it("returns true for permanent ban (no expiry)", () => {
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: null })
    ).toBe(true);
  });

  it("returns true for active temporary ban", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: future })
    ).toBe(true);
  });

  it("returns false for expired temporary ban", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: past })
    ).toBe(false);
  });
});

// M0 DI-76: corrupted upstream data fails closed.
it("keeps a ban active when its expiry is unparseable", () => {
  expect(isBanned({ banned_at: "2026-03-01T00:00:00Z", ban_expires_at: "invalid" })).toBe(true);
});
