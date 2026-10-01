/**
 * M3 P1-07: ingestion freshness for /api/health and /moderation/ingestion.
 *
 * Every read goes through the elevated door: the delivery log is admin-read
 * only, and health's token path has no admin session. Callers are the health
 * report (admin or HEALTH_TOKEN) and the admin ingestion route; neither
 * exposes anything but counts, timestamps, short codes and pending titles.
 */
import { getElevatedClient } from "@/server/db/elevated";
import { isPastWallClock, staleFilter } from "@/lib/ingest/staleness";
import type {
  IngestionDeliveryRecord,
  IngestionSummaryRecord,
  StalePendingRecord,
} from "@/contracts/ingestion";

/** Outcomes that prove the producer and the webhook both worked. */
export const SUCCESS_OUTCOMES = ["succeeded", "partial", "duplicate", "heartbeat"] as const;

/** Outcomes that need an operator's attention. */
export const FAILURE_OUTCOMES = ["failed", "rejected"] as const;

export { STALE_PENDING_HOURS, isPastWallClock, staleFilter } from "@/lib/ingest/staleness";

export type IngestionSummary = IngestionSummaryRecord;

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

export async function ingestionSummary(now: Date = new Date()): Promise<IngestionSummary> {
  const db = getElevatedClient();
  const [ingest, delivery, success, failure, pending, stale] = await Promise.all([
    db.from("events").select("created_at").eq("source", "instagram")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ingestion_deliveries").select("received_at")
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ingestion_deliveries").select("received_at").in("outcome", [...SUCCESS_OUTCOMES])
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ingestion_deliveries").select("received_at, error_code").in("outcome", [...FAILURE_OUTCOMES])
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("events").select("id", { count: "exact", head: true })
      .eq("status", "pending").is("deleted_at", null),
    db.from("events").select("id", { count: "exact", head: true })
      .eq("status", "pending").is("deleted_at", null).or(staleFilter(now)),
  ]);
  for (const result of [ingest, delivery, success, failure, pending, stale]) {
    if (result.error) throw result.error;
  }
  return {
    last_ingest_at: iso(ingest.data?.created_at),
    last_delivery_at: iso(delivery.data?.received_at),
    last_success_at: iso(success.data?.received_at),
    last_failure_at: iso(failure.data?.received_at),
    last_error_code: failure.data?.error_code ?? null,
    pending_review: pending.count ?? 0,
    stale_pending: stale.count ?? 0,
  };
}

/** Stale pending events, oldest first, so the queue drains from the back.
 * `is_past` is computed here, with the same wall-clock rule as the filter,
 * so the admin page never re-derives it from the viewer's clock and zone. */
export async function stalePendingEvents(limit = 50, now: Date = new Date()): Promise<StalePendingRecord[]> {
  const { data, error } = await getElevatedClient()
    .from("events")
    .select("id, title, created_at, start_date, source, source_url")
    .eq("status", "pending")
    .is("deleted_at", null)
    .or(staleFilter(now))
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, is_past: isPastWallClock(row.start_date, now) }));
}

/** The newest deliveries first. */
export async function recentDeliveries(limit = 20): Promise<IngestionDeliveryRecord[]> {
  const { data, error } = await getElevatedClient()
    .from("ingestion_deliveries")
    .select("id, producer, run_id, received_at, outcome, event_count, inserted, duplicates, invalid, items_seen, error_code")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
