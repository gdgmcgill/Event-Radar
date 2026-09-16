/**
 * clock.ts — the pinned instant every seeded timestamp is derived from.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * REFAC-07 clause 2 of 3: "fixed timestamps relative to a pinned now". Nothing
 * in the seed may call `Date.now()`. Two loads a week apart must produce the
 * same rows, so every timestamp below is `PINNED_NOW` plus a fixed offset.
 *
 * THE OFFSETS ARE CHOSEN IN THE America/Toronto SENSE, ON PURPOSE.
 *   This is a McGill application; its users read every date in Montreal local
 *   time, and Phase 7's certification (CERT-02) will test daylight-saving
 *   edges. A seed whose instants are timezone-naive would have to be redone
 *   then. `PINNED_NOW` is therefore noon on a Toronto summer day — 12:00 EDT,
 *   which is 16:00 UTC — rather than a round UTC number that lands at an
 *   arbitrary local hour.
 *
 *   The two 2026 transition instants are exported for the same reason: so the
 *   later phase inherits them instead of re-deriving them, and so the choice is
 *   recorded where a reader will find it.
 */

/** 2026-06-01, 12:00 noon in Toronto (EDT, UTC−4) expressed as a UTC instant. */
export const PINNED_NOW = new Date("2026-06-01T16:00:00.000Z");

/** The IANA zone every seeded instant was reasoned about in. */
export const SEED_TIMEZONE = "America/Toronto";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `PINNED_NOW` shifted by `n` days. Negative is the past. */
export const days = (n: number): Date => new Date(PINNED_NOW.getTime() + n * DAY);

/** `PINNED_NOW` shifted by `n` hours. */
export const hours = (n: number): Date => new Date(PINNED_NOW.getTime() + n * HOUR);

/** `PINNED_NOW` shifted by `n` days and `h` hours — the common seed shape. */
export const at = (n: number, h = 0): Date =>
  new Date(PINNED_NOW.getTime() + n * DAY + h * HOUR);

/** ISO-8601 with milliseconds, which is what Postgres `timestamptz` round-trips. */
export const iso = (d: Date): string => d.toISOString();

/**
 * Toronto's 2026 daylight-saving transitions, as UTC instants.
 * Spring forward: 2026-03-08 02:00 EST → 03:00 EDT (07:00 UTC).
 * Fall back:      2026-11-01 02:00 EDT → 01:00 EST (06:00 UTC).
 * Exported for CERT-02; the seed itself sits comfortably inside EDT.
 */
export const DST_SPRING_FORWARD_2026 = new Date("2026-03-08T07:00:00.000Z");
export const DST_FALL_BACK_2026 = new Date("2026-11-01T06:00:00.000Z");
