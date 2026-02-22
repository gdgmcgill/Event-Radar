/**
 * Pipeline integration: connects Apify Instagram scraper output
 * to the classifier and then to the events-webhook.
 *
 * Flow: Apify output -> classifyBatch() -> partitionByAction() -> webhook POST
 */

import {
  type InstagramPost,
  type ClassificationResult,
  classifyBatch,
  partitionByAction,
  CONFIDENCE_THRESHOLDS,
} from "./classifier";
import crypto from "crypto";

// =============================================
// Types
// =============================================

/** Apify Instagram Post Scraper output item (subset of fields we use) */
export interface ApifyInstagramItem {
  id: string;
  caption: string;
  timestamp: string;
  displayUrl: string;
  ownerUsername: string;
  likesCount?: number;
  commentsCount?: number;
  url?: string;
}

/** Result of a pipeline run */
export interface PipelineResult {
  total_posts: number;
  events_sent_to_pending: number;
  events_flagged_for_review: number;
  posts_discarded: number;
  errors: PipelineError[];
  results: ClassificationResult[];
}

interface PipelineError {
  post_id: string;
  error: string;
}

// =============================================
// Pipeline Functions
// =============================================

/**
 * Transform Apify output format to our InstagramPost format.
 */
export function normalizeApifyOutput(items: ApifyInstagramItem[]): InstagramPost[] {
  return items.map(item => ({
    id: item.id,
    caption: item.caption || "",
    timestamp: item.timestamp,
    image_url: item.displayUrl,
    account: item.ownerUsername,
    likes: item.likesCount,
    comments: item.commentsCount,
    post_url: item.url,
  }));
}

/**
 * Build a webhook payload from classified results.
 * Only includes results that have extracted_fields (i.e., classified as events).
 */
export function buildWebhookPayload(results: ClassificationResult[]) {
  const events = results
    .filter(r => r.extracted_fields !== null)
    .map(r => r.extracted_fields!);

  return {
    event_count: events.length,
    events,
  };
}

/**
 * Compute HMAC signature for a payload string.
 */
export function computeHMAC(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Run the full classification pipeline on a batch of Apify items.
 *
 * 1. Normalize Apify output to InstagramPost[]
 * 2. Classify each post
 * 3. Partition into auto_pending / manual_review / auto_discard
 * 4. Return structured result (caller decides whether to POST to webhook)
 */
export function runPipeline(apifyItems: ApifyInstagramItem[]): PipelineResult {
  const posts = normalizeApifyOutput(apifyItems);
  const classified = classifyBatch(posts);
  const partitioned = partitionByAction(classified);

  return {
    total_posts: posts.length,
    events_sent_to_pending: partitioned.auto_pending.length,
    events_flagged_for_review: partitioned.manual_review.length,
    posts_discarded: partitioned.auto_discard.length,
    errors: [],
    results: classified,
  };
}

/**
 * Post classified events to the webhook endpoint.
 * This would be called from a scheduled job (cron) or Supabase Edge Function.
 */
export async function sendToWebhook(
  results: ClassificationResult[],
  webhookUrl: string,
  webhookSecret: string,
): Promise<{ success: boolean; status: number; body: unknown }> {
  const eventsToSend = results.filter(
    r => r.is_event && r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING && r.extracted_fields
  );

  if (eventsToSend.length === 0) {
    return { success: true, status: 200, body: { message: "No events to send" } };
  }

  const payload = buildWebhookPayload(eventsToSend);
  const payloadStr = JSON.stringify(payload);
  const signature = computeHMAC(payloadStr, webhookSecret);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": signature,
    },
    body: payloadStr,
  });

  const body = await response.json();
  return {
    success: response.ok,
    status: response.status,
    body,
  };
}
