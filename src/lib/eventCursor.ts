/**
 * Keyset cursor codec for the event list.
 *
 * F-083 / REFAC-10 (plan 04-09), implementing DEC-25. `useEvents` has always
 * paged by an opaque cursor: it sends `cursor` and reads `nextCursor` /
 * `prevCursor`. `GET /api/events` now speaks the same contract. The cursor
 * names a position in the list's `(start_date, id)` ascending order.
 * `start_date` alone is not unique, so a single-column cursor would skip or
 * repeat rows that share a start time.
 *
 * Wire format: base64 of `JSON.stringify({ sortValue, id })`, where
 * `sortValue` is the row's `start_date` exactly as PostgREST returned it.
 * This is byte-compatible with the helpers of the suite that described the
 * contract before the route implemented it (`src/app/api/events/route.test.ts`).
 *
 * The token comes back from the client, so it is untrusted input, and its two
 * values end up inside a PostgREST `or()` logic tree. `decodeEventCursor`
 * therefore accepts only what `encodeEventCursor` can produce:
 *
 *   - `id` must be a canonical UUID;
 *   - `sortValue` must be an ISO-8601 date or timestamp that `Date.parse`
 *     accepts, whose calendar date exists, and must not contain a comma,
 *     parenthesis, double quote or backslash (V8's `Date.parse` accepts
 *     "Feb 2, 2026" and rolls "2026-02-30" over to March 2, so the parse
 *     alone is not a sufficient check).
 *
 * These checks are defence in depth. The route also wraps both values with
 * `postgrestQuotedValue` (`src/lib/searchFilter.ts`), so even a value that got
 * past the decoder could not leave its quoted string (threat T-04-09-01).
 *
 * Decoding never throws. It returns null for any malformed input, following
 * the house convention for parse helpers. The route turns null into a
 * 400 `{ error: "Invalid cursor" }` before issuing any query.
 */

/** A position in the event list's `(start_date, id)` ascending order. */
export interface EventCursor {
  /** The row's `start_date`, as returned by PostgREST. */
  sortValue: string;
  /** The row's `id` (a UUID), which breaks ties between equal start dates. */
  id: string;
}

/** Longest token accepted; a real cursor is about 120 characters. */
const MAX_CURSOR_LENGTH = 512;

/** Standard base64, padded (what `Buffer#toString("base64")` produces). */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A date, optionally followed by a time and a zone, as PostgREST emits them. */
const ISO_DATE_OR_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** Characters with meaning in a PostgREST logic tree or quoted value. */
const POSTGREST_METACHARACTERS = /[,()"\\]/;

/**
 * Whether the leading `YYYY-MM-DD` of an ISO value names a day that exists.
 *
 * `Date.parse` accepts "2026-02-30" and "2026-04-31" by rolling them over to
 * the next month, but Postgres rejects them (`22008 date/time field value out
 * of range`), which the route would surface as a 500 echoing that message
 * instead of the 400 the decoder promises. Fields are re-read from a Date
 * built with `setUTCFullYear`, so years below 100 are not shifted to 19xx.
 */
function isRealCalendarDate(isoValue: string): boolean {
  const [year, month, day] = isoValue.slice(0, 10).split("-").map(Number);
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Encode a list position as an opaque cursor.
 *
 * @param cursor - The row's `start_date` and `id`
 * @returns base64 of `JSON.stringify({ sortValue, id })`
 */
export function encodeEventCursor(cursor: EventCursor): string {
  const payload = { sortValue: cursor.sortValue, id: cursor.id };
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

/**
 * Decode and validate a cursor received from a client.
 *
 * @param raw - The `cursor` query-string value
 * @returns The cursor, or null when `raw` is anything `encodeEventCursor`
 *   could not have produced
 */
export function decodeEventCursor(raw: string): EventCursor | null {
  if (!raw || raw.length > MAX_CURSOR_LENGTH || !BASE64.test(raw)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const { sortValue, id } = parsed as Record<string, unknown>;
  if (typeof sortValue !== "string" || typeof id !== "string") {
    return null;
  }

  if (!CANONICAL_UUID.test(id)) {
    return null;
  }

  if (
    POSTGREST_METACHARACTERS.test(sortValue) ||
    !ISO_DATE_OR_TIMESTAMP.test(sortValue) ||
    Number.isNaN(Date.parse(sortValue)) ||
    !isRealCalendarDate(sortValue)
  ) {
    return null;
  }

  return { sortValue, id };
}
