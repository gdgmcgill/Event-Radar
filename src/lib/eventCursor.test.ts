/**
 * Unit tests for the event-list keyset cursor codec (F-083, DEC-25).
 *
 * The cursor crosses a trust boundary twice: the route hands it to the client,
 * and the client hands it back as a query-string value that becomes part of a
 * PostgREST `or()` filter. So the decoder must accept exactly what the encoder
 * produces and return null for everything else, and it must never throw.
 */

import { decodeEventCursor, encodeEventCursor } from "./eventCursor";

const ID = "5eed0000-0000-4000-8000-0000000c0005";
const SORT = "2026-02-02T10:00:00+00:00";

/** The skipped suite's helper, verbatim: base64 of JSON `{ sortValue, id }`. */
const suiteEncode = (payload: unknown) =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

describe("encodeEventCursor", () => {
  it("is base64 of JSON.stringify({ sortValue, id }), byte-for-byte", () => {
    expect(encodeEventCursor({ sortValue: SORT, id: ID })).toBe(
      suiteEncode({ sortValue: SORT, id: ID })
    );
  });

  it("round-trips through decodeEventCursor", () => {
    const cursor = { sortValue: SORT, id: ID };
    expect(decodeEventCursor(encodeEventCursor(cursor))).toEqual(cursor);
  });
});

describe("decodeEventCursor — accepts what the encoder produces", () => {
  it.each([
    ["a PostgREST timestamptz", "2026-10-05T15:00:00+00:00"],
    ["fractional seconds", "2026-10-05T15:00:00.123456+00:00"],
    ["a Z suffix", "2026-10-05T15:00:00.000Z"],
    ["a date alone (the skipped suite's fixtures)", "2026-02-02"],
    ["a leap day in a leap year", "2024-02-29T10:00:00+00:00"],
    ["the last day of a 31-day month", "2026-12-31"],
    ["the last day of a 30-day month", "2026-04-30T23:59:59Z"],
  ])("accepts %s", (_label, sortValue) => {
    expect(decodeEventCursor(suiteEncode({ sortValue, id: ID }))).toEqual({
      sortValue,
      id: ID,
    });
  });

  it("returns only sortValue and id, dropping any other key", () => {
    const raw = suiteEncode({ sortValue: SORT, id: ID, extra: "x" });
    expect(decodeEventCursor(raw)).toEqual({ sortValue: SORT, id: ID });
  });
});

describe("decodeEventCursor — returns null, never throws, for anything else", () => {
  it.each<[string, string]>([
    ["the empty string", ""],
    ["not-a-valid-cursor (the skipped suite's input)", "not-a-valid-cursor"],
    ["valid base64 of non-JSON", Buffer.from("hello world").toString("base64")],
    ["base64 of a JSON array", suiteEncode([SORT, ID])],
    ["base64 of JSON null", suiteEncode(null)],
    ["base64 of a JSON string", suiteEncode("cursor")],
    ["an object missing id", suiteEncode({ sortValue: SORT })],
    ["an object missing sortValue", suiteEncode({ id: ID })],
    ["a numeric sortValue", suiteEncode({ sortValue: 1767348000000, id: ID })],
    ["a sortValue Date.parse rejects", suiteEncode({ sortValue: "not-a-date", id: ID })],
    ["an impossible calendar date", suiteEncode({ sortValue: "2026-13-45", id: ID })],
    ["a rolled-over calendar date (Feb 30)", suiteEncode({ sortValue: "2026-02-30", id: ID })],
    ["a rolled-over calendar date with a time (Apr 31)", suiteEncode({ sortValue: "2026-04-31T10:00:00+00:00", id: ID })],
    ["a leap day outside a leap year", suiteEncode({ sortValue: "2026-02-29", id: ID })],
    ["a zero month", suiteEncode({ sortValue: "2026-00-10", id: ID })],
    ["a zero day", suiteEncode({ sortValue: "2026-10-00", id: ID })],
    ["a non-UUID id", suiteEncode({ sortValue: SORT, id: "evt-1" })],
    ["a numeric id", suiteEncode({ sortValue: SORT, id: 5 })],
    ["a UUID with trailing text", suiteEncode({ sortValue: SORT, id: `${ID}x` })],
    ["base64 with characters outside the alphabet", "eyJzb3J0VmFsdWUiOi!!"],
    ["an oversized token", "A".repeat(2048)],
  ])("rejects %s", (_label, raw) => {
    expect(() => decodeEventCursor(raw)).not.toThrow();
    expect(decodeEventCursor(raw)).toBeNull();
  });

  describe.each([",", "(", ")", '"'])("the PostgREST metacharacter %s", (ch) => {
    it("is rejected inside id", () => {
      expect(decodeEventCursor(suiteEncode({ sortValue: SORT, id: `${ID}${ch}` }))).toBeNull();
    });

    it("is rejected inside sortValue", () => {
      expect(
        decodeEventCursor(suiteEncode({ sortValue: `${SORT}${ch}`, id: ID }))
      ).toBeNull();
    });
  });

  it("rejects a comma-bearing sortValue that Date.parse would accept", () => {
    // V8 parses "Feb 2, 2026"; the decoder must not rely on Date.parse alone.
    expect(Number.isNaN(Date.parse("Feb 2, 2026"))).toBe(false);
    expect(decodeEventCursor(suiteEncode({ sortValue: "Feb 2, 2026", id: ID }))).toBeNull();
  });

  it("rejects a rolled-over calendar date that Date.parse would accept", () => {
    // V8 rolls "2026-02-30" over to 2026-03-02; Postgres rejects it with 22008,
    // which the route would have turned into a 500 (WR-03, Phase 4 review).
    expect(Number.isNaN(Date.parse("2026-02-30"))).toBe(false);
    expect(decodeEventCursor(suiteEncode({ sortValue: "2026-02-30", id: ID }))).toBeNull();
  });

  it("rejects a parenthesised sortValue that Date.parse would accept", () => {
    const value = "Mon Feb 02 2026 10:00:00 GMT+0000 (Coordinated Universal Time)";
    expect(Number.isNaN(Date.parse(value))).toBe(false);
    expect(decodeEventCursor(suiteEncode({ sortValue: value, id: ID }))).toBeNull();
  });
});
