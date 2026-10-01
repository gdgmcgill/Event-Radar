/**
 * M3 P1-07: copy ingested Instagram images into our own storage.
 *
 * Instagram CDN URLs are signed and expire, so an ingested event's image
 * breaks within days. An admin triggers this (POST /api/admin/ingestion/images)
 * and it copies up to `limit` still-remote images, newest first, through the
 * SSRF-safe fetch into the public `event-images` bucket at
 * `ingest/<event id>.<ext>`, then points `image_url` at the stored copy.
 *
 * An image that is already gone (403, 404 or 410) clears `image_url`, so every
 * surface renders its placeholder instead of a broken image. Any other failure
 * leaves the row as it was and is reported by code for the next attempt.
 *
 * The update is conditional on the URL that was fetched, so an edit made while
 * the fetch ran is never overwritten. The service role is outside the
 * moderated-update guard (supabase/tests/database/150-ingestion.test.sql).
 */
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";
import type { SniffedImageType } from "@/lib/imageSniff";
import { ImageFetchError, INGEST_IMAGE_HOSTS, fetchIngestImage } from "./safeImageFetch";

export const EVENT_IMAGES_BUCKET = "event-images";

/** The fetch codes that mean the image no longer exists at its source. */
const EXPIRED_CODES = new Set(["http_403", "http_404", "http_410"]);

const EXTENSIONS: Record<SniffedImageType, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" };

export interface PersistImagesResult {
  processed: number;
  persisted: number;
  cleared: number;
  failed: { event_id: string; code: string }[];
}

function isIngestImageUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && INGEST_IMAGE_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

export async function persistEventImages(limit: number): Promise<PersistImagesResult> {
  const db = getElevatedClient();
  const { data, error } = await db
    .from("events")
    .select("id, image_url")
    .eq("source", "instagram")
    .is("deleted_at", null)
    .in("status", ["pending", "approved"])
    // Narrows the scan to CDN-hosted images; the exact host rule is re-checked below.
    .or("image_url.ilike.*cdninstagram.com*,image_url.ilike.*fbcdn.net*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const result: PersistImagesResult = { processed: 0, persisted: 0, cleared: 0, failed: [] };
  for (const event of data ?? []) {
    const source = event.image_url;
    if (!isIngestImageUrl(source)) continue;
    result.processed++;

    let fetched: Awaited<ReturnType<typeof fetchIngestImage>>;
    try {
      fetched = await fetchIngestImage(source);
    } catch (fetchError) {
      const code = fetchError instanceof ImageFetchError ? fetchError.code : "fetch_failed";
      if (!EXPIRED_CODES.has(code)) {
        result.failed.push({ event_id: event.id, code });
        continue;
      }
      const { data: cleared, error: clearError } = await db
        .from("events")
        .update({ image_url: null })
        .eq("id", event.id)
        .eq("image_url", source)
        .select("id");
      if (clearError) result.failed.push({ event_id: event.id, code: "update_failed" });
      else if (!cleared?.length) result.failed.push({ event_id: event.id, code: "changed" });
      else result.cleared++;
      continue;
    }

    const path = `ingest/${event.id}.${EXTENSIONS[fetched.type]}`;
    const bucket = db.storage.from(EVENT_IMAGES_BUCKET);
    const { error: uploadError } = await bucket.upload(path, fetched.bytes, {
      contentType: `image/${fetched.type}`,
      upsert: true,
    });
    if (uploadError) {
      result.failed.push({ event_id: event.id, code: "upload_failed" });
      continue;
    }
    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    const { data: updated, error: updateError } = await db
      .from("events")
      .update({ image_url: publicUrl })
      .eq("id", event.id)
      .eq("image_url", source)
      .select("id");
    if (updateError) result.failed.push({ event_id: event.id, code: "update_failed" });
    else if (!updated?.length) result.failed.push({ event_id: event.id, code: "changed" });
    else result.persisted++;
  }

  log.info("ingested images persisted", {
    scope: "Ingestion",
    processed: result.processed,
    persisted: result.persisted,
    cleared: result.cleared,
    failed: result.failed.length,
  });
  return result;
}
