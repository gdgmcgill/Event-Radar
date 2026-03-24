/**
 * Timezone utilities for Uni-Verse.
 *
 * All events are in Eastern Time (America/New_York).
 * Dates are stored in Postgres as `timestamptz` but the offset is
 * always +00, so the raw value is really "wall-clock EST/EDT".
 *
 * To compare against "now" we must express the current instant in
 * the same naive-UTC form the DB uses.
 */

const EVENT_TZ = "America/New_York";

/**
 * Returns the current wall-clock time in Eastern Time, expressed as
 * a Date whose `.toISOString()` matches the DB's naive-UTC convention.
 *
 * Example: if it's 2026-03-24 14:00 EDT (UTC-4), this returns a Date
 * whose ISO string is `2026-03-24T14:00:00.000Z` — matching how
 * "2 PM Eastern" is stored in the DB.
 */
export function getESTNow(): Date {
  const now = new Date();
  // Format current instant as EST/EDT wall-clock parts
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // Build a UTC Date that has the EST/EDT wall-clock values
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.000Z`
  );
}

/**
 * Returns the current EST date as a YYYY-MM-DD string.
 */
export function getESTToday(): string {
  return getESTNow().toISOString().split("T")[0];
}

/**
 * Returns an ISO string of the current EST time (for Supabase queries).
 */
export function getESTNowISO(): string {
  return getESTNow().toISOString();
}
