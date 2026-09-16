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
 * ============================================================================
 * THE HORIZON, AND WHY A PINNED NOW IS NOT ENOUGH ON ITS OWN
 * ============================================================================
 *
 * REFAC-07 wants determinism: the same rows on every load, forever. The
 * application wants now-relative correctness: `/api/events` filters
 * `start_date >= now()`, and `src/proxy.ts` treats a suspension as active when
 * `ban_expires_at > new Date()`. Both compare seeded data to the WALL CLOCK.
 *
 * Those two wants pull against each other, and the first run of the persona
 * harness is where it showed. With every offset taken from `PINNED_NOW`, the
 * "active suspension" expired the moment real time passed 2026-06-08 — so the
 * persona whose entire purpose is to be suspended walked straight past the ban
 * ring, and every "upcoming" event had quietly become a past one and vanished
 * from the feed. Nothing errored. The seed just started meaning something else.
 *
 * There is exactly one way to have both properties: place the rows whose
 * meaning is wall-clock-relative FAR enough from the pinned instant that the
 * clock cannot cross them. So the seed has two clocks, both pinned:
 *
 *   PINNED_NOW      — stored metadata (`created_at`, `updated_at`, `banned_at`).
 *                     Nothing compares these to now, so they can sit anywhere.
 *   HORIZON_FUTURE  — "always still ahead": upcoming events, active suspensions
 *   HORIZON_PAST    — "always already behind": expired suspensions, past events
 *
 * Ten years is not a magic number; it is "longer than this codebase will
 * plausibly run without the seed being revisited," and the failure mode if it
 * ever is crossed is loud rather than silent — the suspension spec goes red.
 */

/** Always still ahead of the wall clock. PINNED_NOW + 10 years. */
export const HORIZON_FUTURE = new Date("2036-06-01T16:00:00.000Z");

/** Always already behind the wall clock. PINNED_NOW − 10 years. */
export const HORIZON_PAST = new Date("2016-06-01T16:00:00.000Z");

/** A fixed instant that is always in the future: `HORIZON_FUTURE + n days`. */
export const upcoming = (n: number, h = 0): Date =>
  new Date(HORIZON_FUTURE.getTime() + n * DAY + h * HOUR);

/** A fixed instant that is always in the past: `HORIZON_PAST + n days`. */
export const elapsed = (n: number, h = 0): Date =>
  new Date(HORIZON_PAST.getTime() + n * DAY + h * HOUR);

/**
 * Toronto's 2026 daylight-saving transitions, as UTC instants.
 * Spring forward: 2026-03-08 02:00 EST → 03:00 EDT (07:00 UTC).
 * Fall back:      2026-11-01 02:00 EDT → 01:00 EST (06:00 UTC).
 * Exported for CERT-02; the seed itself sits comfortably inside EDT.
 */
export const DST_SPRING_FORWARD_2026 = new Date("2026-03-08T07:00:00.000Z");
export const DST_FALL_BACK_2026 = new Date("2026-11-01T06:00:00.000Z");
