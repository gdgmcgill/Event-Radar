import { z } from "zod";

/** M3 P1-07: POST /api/admin/ingestion/images. At most ten images per call so
 * one admin click stays well inside the route's time budget. */
export const PersistImagesBody = z.strictObject({
  limit: z.number().int().min(1).max(10).default(10),
});

export type PersistImagesBodyInput = z.input<typeof PersistImagesBody>;

/** What the persist call answers (from src/server/ingestion/persistImages.ts). */
export interface PersistImagesResultRecord {
  processed: number;
  persisted: number;
  cleared: number;
  failed: { event_id: string; code: string }[];
}

/** GET /api/admin/ingestion `summary` (also the health report's webhook check). */
export interface IngestionSummaryRecord {
  last_ingest_at: string | null;
  last_delivery_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error_code: string | null;
  pending_review: number;
  stale_pending: number;
}

export type DeliveryOutcomeRecord = "succeeded" | "partial" | "duplicate" | "failed" | "rejected" | "heartbeat";

/** One row of public.ingestion_deliveries as the admin route answers it. */
export interface IngestionDeliveryRecord {
  id: string;
  producer: string;
  run_id: string | null;
  received_at: string;
  outcome: string;
  event_count: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  items_seen: number | null;
  error_code: string | null;
}

/** A pending event that is older than 72 hours or already past its start. */
export interface StalePendingRecord {
  id: string;
  title: string;
  created_at: string | null;
  start_date: string;
  source: string | null;
  source_url: string | null;
}

export interface IngestionStatusRecord {
  summary: IngestionSummaryRecord;
  deliveries: IngestionDeliveryRecord[];
  stale: StalePendingRecord[];
}
