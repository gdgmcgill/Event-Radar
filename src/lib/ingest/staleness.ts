/**
 * M3 P1-07: when a pending event is stale. Shared by the server ingestion
 * summary and the client Pending Review banner so both count the same rows.
 *
 * DEC-80 (docs/time-semantics.md): `created_at` is a true instant, but legacy
 * `start_date` holds Toronto wall-clock time labelled UTC, so "already
 * started" compares it with the wall-clock now from `getESTNowISO`.
 */
import { getESTNowISO } from "@/lib/timezone";

/** Pending events older than this, or already past their start, are stale. */
export const STALE_PENDING_HOURS = 72;

/**
 * The PostgREST `or` filter for a stale pending event: created more than
 * STALE_PENDING_HOURS ago, or its (wall-clock) start already passed.
 */
export function staleFilter(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - STALE_PENDING_HOURS * 3_600_000).toISOString();
  return `created_at.lt.${cutoff},start_date.lt.${getESTNowISO(now)}`;
}

/** Whether a legacy `start_date` (DEC-80 wall-clock) is already past. */
export function isPastWallClock(startDate: string, now: Date = new Date()): boolean {
  const start = Date.parse(startDate);
  return !Number.isNaN(start) && start < Date.parse(getESTNowISO(now));
}
