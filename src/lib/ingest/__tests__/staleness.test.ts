/**
 * M3 final review, finding 1a (DEC-80, docs/time-semantics.md): legacy
 * `start_date` holds Toronto wall-clock time labelled UTC, so "past" must
 * compare it with the wall-clock now, not the true UTC instant.
 */
import { isPastWallClock, staleFilter, STALE_PENDING_HOURS } from "../staleness";

// 2026-09-29 16:00 UTC is 12:00 noon in Toronto (EDT, UTC-4).
const NOW = new Date("2026-09-29T16:00:00Z");
// Stored as the DB returns legacy values: wall-clock digits with a +00 offset.
const LATER_TODAY = "2026-09-29T15:00:00+00:00"; // 3 PM Toronto, still ahead
const EARLIER_TODAY = "2026-09-29T09:00:00+00:00"; // 9 AM Toronto, already past

describe("staleness (DEC-80 wall-clock)", () => {
  it("an event later today in Toronto is not past, even though its stored value is before true UTC now", () => {
    expect(Date.parse(LATER_TODAY)).toBeLessThan(NOW.getTime());
    expect(isPastWallClock(LATER_TODAY, NOW)).toBe(false);
  });

  it("an event earlier today in Toronto is past", () => {
    expect(isPastWallClock(EARLIER_TODAY, NOW)).toBe(true);
  });

  it("an unparseable start is never past", () => {
    expect(isPastWallClock("not a date", NOW)).toBe(false);
  });

  it("the stale filter compares start_date with the wall-clock now and created_at with the true instant", () => {
    const cutoff = new Date(NOW.getTime() - STALE_PENDING_HOURS * 3_600_000).toISOString();
    expect(staleFilter(NOW)).toBe(
      `created_at.lt.${cutoff},start_date.lt.2026-09-29T12:00:00.000Z`
    );
    // The filter boundary agrees with isPastWallClock for both events.
    const boundary = Date.parse("2026-09-29T12:00:00.000Z");
    expect(Date.parse(LATER_TODAY) < boundary).toBe(false);
    expect(Date.parse(EARLIER_TODAY) < boundary).toBe(true);
  });

  it("uses the standard-time offset in winter (EST, UTC-5)", () => {
    const winter = new Date("2026-12-01T17:00:00Z"); // noon EST
    expect(staleFilter(winter)).toContain("start_date.lt.2026-12-01T12:00:00.000Z");
  });
});
