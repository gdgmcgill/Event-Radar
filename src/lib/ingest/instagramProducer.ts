/**
 * M3 P1-07: the pure half of the Instagram producer.
 *
 * Apify's instagram-profile-scraper output → classifier → signed webhook
 * payloads for supabase/functions/events-webhook. No I/O here: the CLI in
 * scripts/ingest/instagram.ts fetches, posts and prints counts.
 *
 * Events are the classifier's ExtractedEvent, which the webhook contract's
 * drift guard (src/__tests__/webhook/webhook-contract.test.ts) proves is
 * assignable to the contract's input; the contract's own output type strips
 * organizer, image_url and source_url, which the handler still maps.
 */
import { createHmac } from "node:crypto";
import { classifyBatch, partitionByAction, type ExtractedEvent, type InstagramPost } from "@/lib/classifier";
import { webhookEventErrors } from "@/contracts/webhook";

export const PRODUCER_ID = "instagram-apify@1";

export type ProducerEvent = ExtractedEvent;

export interface ProducerRun {
  id: string;
  status: "ok" | "failed";
  error_code?: string;
  items_seen?: number;
}

const DAY_MS = 86_400_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Posts from Apify profile items. A profile without a string `username` or an
 * array `latestPosts` (Apify's error items, for one) is dropped, and so is a
 * post without an id or a parseable timestamp.
 */
export function mapApifyProfiles(items: unknown[]): InstagramPost[] {
  const posts: InstagramPost[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const account = text(item.username);
    if (!account || !Array.isArray(item.latestPosts)) continue;
    for (const raw of item.latestPosts) {
      if (!isRecord(raw)) continue;
      const id = text(raw.id);
      const timestamp = text(raw.timestamp);
      if (!id || !timestamp || Number.isNaN(Date.parse(timestamp))) continue;
      posts.push({
        id,
        caption: typeof raw.caption === "string" ? raw.caption : "",
        timestamp,
        image_url: text(raw.displayUrl) ?? "",
        account,
        likes: count(raw.likesCount),
        comments: count(raw.commentsCount),
        post_url: text(raw.url) ?? undefined,
      });
    }
  }
  return posts;
}

/**
 * Webhook events for the posts inside the window. The classifier's
 * auto_pending and manual_review partitions with extracted fields are kept
 * (every one still lands as a pending event for a moderator); an event that
 * would fail the webhook contract is dropped here, so one bad caption never
 * rejects a whole batch. `seen` counts posts in the window; `discarded`
 * counts those that produced no event.
 */
export function buildWebhookEvents(
  posts: InstagramPost[],
  opts: { now: Date; days: number }
): { events: ProducerEvent[]; seen: number; discarded: number } {
  const since = opts.now.getTime() - opts.days * DAY_MS;
  const recent = posts.filter((post) => Date.parse(post.timestamp) >= since);
  const { auto_pending, manual_review } = partitionByAction(classifyBatch(recent));
  const events: ProducerEvent[] = [];
  for (const result of [...auto_pending, ...manual_review]) {
    const fields = result.extracted_fields;
    if (!fields) continue;
    const event: ProducerEvent = {
      ...fields,
      source_url: result.raw_post.post_url,
      image_url: result.raw_post.image_url || undefined,
      organizer: fields.organizer,
    };
    if (webhookEventErrors(event).length === 0) events.push(event);
  }
  return { events, seen: recent.length, discarded: recent.length - events.length };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

/** Hex HMAC-SHA256 of the exact body, as the webhook's verifySignature expects. */
export function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function webhookPayload(events: ProducerEvent[], run: ProducerRun): string {
  return JSON.stringify({
    event_count: events.length,
    events,
    run: { id: run.id, producer: PRODUCER_ID, status: run.status, error_code: run.error_code, items_seen: run.items_seen },
  });
}
