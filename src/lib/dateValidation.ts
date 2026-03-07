/**
 * Date validation utilities for event creation and updates.
 *
 * Accepted formats (ISO 8601):
 *   - Date-only:           YYYY-MM-DD              (e.g. "2026-03-15")
 *   - Date + time (UTC):   YYYY-MM-DDTHH:mm:ssZ    (e.g. "2026-03-15T09:00:00Z")
 *   - Date + time + ms:    YYYY-MM-DDTHH:mm:ss.sssZ
 *   - Date + time + offset YYYY-MM-DDTHH:mm:ss±HH:mm
 *
 * The date part itself must be a calendar-valid date (no Feb 30, etc.).
 */

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

/**
 * Matches any ISO 8601 string that starts with a YYYY-MM-DD date component,
 * optionally followed by a time component.
 */
const ISO_8601_RE =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/;

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function maxDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month];
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `value` is a non-empty string matching ISO 8601 format
 * AND represents a calendar-valid date (e.g. rejects "2026-02-30", and
 * rejects "2026-02-29" on non-leap years).
 *
 * Pure calendar arithmetic is used rather than UTC round-trip to avoid
 * UTC-offset edge cases (e.g. "2026-03-01T00:00:00+05:30" is valid even
 * though its UTC equivalent falls on Feb 28).
 */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_8601_RE.test(value)) {
    return false;
  }
  const year = parseInt(value.slice(0, 4), 10);
  const month = parseInt(value.slice(5, 7), 10); // 1-based
  const day = parseInt(value.slice(8, 10), 10);
  return day <= maxDaysInMonth(year, month);
}

/**
 * Returns true if the parsed date is strictly in the future
 * (compared to `now`, which defaults to the current time).
 */
export function isDateInFuture(
  dateStr: string,
  now: Date = new Date()
): boolean {
  const d = new Date(dateStr);
  return d > now;
}

/**
 * Returns true when `endStr` is strictly after `startStr`.
 * Both must be valid ISO dates (call isValidISODate first).
 */
export function isEndAfterStart(startStr: string, endStr: string): boolean {
  return new Date(endStr) > new Date(startStr);
}

// ---------------------------------------------------------------------------
// Consolidated validator
// ---------------------------------------------------------------------------

export interface DateValidationError {
  field: "start_date" | "end_date";
  message: string;
}

/**
 * Validates the event date fields supplied in a request body.
 *
 * @param start_date - required; must be a valid ISO 8601 date in the future
 * @param end_date   - optional; when provided must be valid ISO 8601 and ≥ start_date
 * @returns An error descriptor, or `null` when everything is valid.
 */
export function validateEventDates(
  start_date: unknown,
  end_date?: unknown
): DateValidationError | null {
  // ── start_date ──────────────────────────────────────────────────────────
  if (!isValidISODate(start_date)) {
    return {
      field: "start_date",
      message:
        "start_date must be a valid ISO 8601 date (e.g. \"2026-03-15\" or \"2026-03-15T09:00:00Z\")",
    };
  }

  if (!isDateInFuture(start_date)) {
    return {
      field: "start_date",
      message: "start_date must be a date in the future",
    };
  }

  // ── end_date (optional) ─────────────────────────────────────────────────
  if (end_date !== undefined && end_date !== null && end_date !== "") {
    if (!isValidISODate(end_date)) {
      return {
        field: "end_date",
        message:
          "end_date must be a valid ISO 8601 date (e.g. \"2026-03-15\" or \"2026-03-15T11:00:00Z\")",
      };
    }

    if (!isEndAfterStart(start_date, end_date as string)) {
      return {
        field: "end_date",
        message: "end_date must be after start_date",
      };
    }
  }

  return null;
}
