/**
 * Unit tests for src/lib/dateValidation.ts
 *
 * Covers:
 *   - isValidISODate  – format + calendar validity
 *   - isDateInFuture  – future / past / present boundary
 *   - isEndAfterStart – ordering validation
 *   - validateEventDates – full combined validator
 */
import { describe, it, expect } from "vitest";
import {
  isValidISODate,
  isDateInFuture,
  isEndAfterStart,
  validateEventDates,
} from "./dateValidation";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A date guaranteed to be in the future relative to any test run. */
const FUTURE_DATE = "2099-12-31";
const FUTURE_DATETIME = "2099-12-31T09:00:00Z";
const FUTURE_DATETIME_OFFSET = "2099-12-31T23:59:59+05:00";

/** A date safely in the past. */
const PAST_DATE = "2000-01-01";
const PAST_DATETIME = "2000-01-01T00:00:00Z";

// ── isValidISODate ───────────────────────────────────────────────────────────

describe("isValidISODate", () => {
  // Valid formats
  it("accepts YYYY-MM-DD date-only strings", () => {
    expect(isValidISODate("2026-03-15")).toBe(true);
  });

  it("accepts ISO 8601 UTC datetime (Z suffix)", () => {
    expect(isValidISODate("2026-03-15T09:00:00Z")).toBe(true);
  });

  it("accepts ISO 8601 datetime with milliseconds", () => {
    expect(isValidISODate("2026-03-15T09:00:00.000Z")).toBe(true);
  });

  it("accepts ISO 8601 datetime with positive UTC offset", () => {
    expect(isValidISODate("2026-03-15T09:00:00+05:30")).toBe(true);
  });

  it("accepts ISO 8601 datetime with negative UTC offset", () => {
    expect(isValidISODate("2026-03-15T09:00:00-04:00")).toBe(true);
  });

  // Invalid formats
  it("rejects an empty string", () => {
    expect(isValidISODate("")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidISODate(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidISODate(undefined)).toBe(false);
  });

  it("rejects a number", () => {
    expect(isValidISODate(1234567890)).toBe(false);
  });

  it("rejects MM/DD/YYYY format", () => {
    expect(isValidISODate("03/15/2026")).toBe(false);
  });

  it("rejects DD-MM-YYYY format", () => {
    expect(isValidISODate("15-03-2026")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidISODate("not-a-date")).toBe(false);
  });

  it("rejects partial ISO string missing day", () => {
    expect(isValidISODate("2026-03")).toBe(false);
  });

  it("rejects ISO string with invalid month 13", () => {
    expect(isValidISODate("2026-13-01")).toBe(false);
  });

  it("rejects ISO string with invalid day 32", () => {
    expect(isValidISODate("2026-01-32")).toBe(false);
  });

  it("rejects ISO string with invalid day 00", () => {
    expect(isValidISODate("2026-01-00")).toBe(false);
  });

  it("rejects calendar-invalid Feb 30", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
  });

  it("rejects calendar-invalid Feb 29 on non-leap year", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
  });

  it("accepts calendar-valid Feb 29 on a leap year", () => {
    expect(isValidISODate("2028-02-29")).toBe(true);
  });

  it("rejects a datetime string missing the time-zone designator", () => {
    // No Z or offset — not a valid ISO 8601 with time component per our spec
    expect(isValidISODate("2026-03-15T09:00:00")).toBe(false);
  });
});

// ── isDateInFuture ───────────────────────────────────────────────────────────

describe("isDateInFuture", () => {
  it("returns true for a far-future date", () => {
    expect(isDateInFuture(FUTURE_DATE)).toBe(true);
  });

  it("returns true for a far-future datetime", () => {
    expect(isDateInFuture(FUTURE_DATETIME)).toBe(true);
  });

  it("returns false for a past date", () => {
    expect(isDateInFuture(PAST_DATE)).toBe(false);
  });

  it("returns false for a past datetime", () => {
    expect(isDateInFuture(PAST_DATETIME)).toBe(false);
  });

  it("returns false when date equals `now` exactly", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(isDateInFuture("2026-06-01T12:00:00Z", now)).toBe(false);
  });

  it("accepts a custom `now` reference for deterministic testing", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isDateInFuture("2026-06-01T00:00:00Z", now)).toBe(true);
    expect(isDateInFuture("2025-12-31T23:59:59Z", now)).toBe(false);
  });
});

// ── isEndAfterStart ──────────────────────────────────────────────────────────

describe("isEndAfterStart", () => {
  it("returns true when end is after start", () => {
    expect(isEndAfterStart("2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z")).toBe(true);
  });

  it("returns true when end is a different day after start", () => {
    expect(isEndAfterStart("2026-03-15", "2026-03-16")).toBe(true);
  });

  it("returns false when end equals start", () => {
    expect(isEndAfterStart("2026-03-15T09:00:00Z", "2026-03-15T09:00:00Z")).toBe(false);
  });

  it("returns false when end is before start", () => {
    expect(isEndAfterStart("2026-03-15T11:00:00Z", "2026-03-15T09:00:00Z")).toBe(false);
  });
});

// ── validateEventDates ───────────────────────────────────────────────────────

describe("validateEventDates", () => {
  it("returns null for a valid future start_date without end_date", () => {
    expect(validateEventDates(FUTURE_DATE)).toBeNull();
  });

  it("returns null for a valid future start_date with valid end_date after it", () => {
    expect(validateEventDates(FUTURE_DATETIME, FUTURE_DATETIME_OFFSET)).toBeNull();
  });

  it("returns null when end_date is undefined (explicitly)", () => {
    expect(validateEventDates(FUTURE_DATE, undefined)).toBeNull();
  });

  it("returns null when end_date is null (explicitly)", () => {
    expect(validateEventDates(FUTURE_DATE, null)).toBeNull();
  });

  it("returns null when end_date is empty string (treated as absent)", () => {
    expect(validateEventDates(FUTURE_DATE, "")).toBeNull();
  });

  // Invalid start_date
  it("returns start_date error for a non-ISO format", () => {
    const err = validateEventDates("15/03/2026");
    expect(err).not.toBeNull();
    expect(err!.field).toBe("start_date");
  });

  it("returns start_date error for a null value", () => {
    const err = validateEventDates(null);
    expect(err).not.toBeNull();
    expect(err!.field).toBe("start_date");
  });

  it("returns start_date error for a past date", () => {
    const err = validateEventDates(PAST_DATE);
    expect(err).not.toBeNull();
    expect(err!.field).toBe("start_date");
    expect(err!.message).toMatch(/future/i);
  });

  it("returns start_date error for a past datetime", () => {
    const err = validateEventDates(PAST_DATETIME);
    expect(err).not.toBeNull();
    expect(err!.field).toBe("start_date");
  });

  // Invalid end_date
  it("returns end_date error for a non-ISO end_date", () => {
    const err = validateEventDates(FUTURE_DATE, "not-a-date");
    expect(err).not.toBeNull();
    expect(err!.field).toBe("end_date");
  });

  it("returns end_date error when end_date is before start_date", () => {
    const err = validateEventDates(FUTURE_DATETIME, "2026-01-01T00:00:00Z");
    expect(err).not.toBeNull();
    expect(err!.field).toBe("end_date");
    expect(err!.message).toMatch(/after/i);
  });

  it("returns end_date error when end_date equals start_date", () => {
    const err = validateEventDates(FUTURE_DATETIME, FUTURE_DATETIME);
    expect(err).not.toBeNull();
    expect(err!.field).toBe("end_date");
  });
});
