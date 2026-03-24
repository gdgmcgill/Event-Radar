/**
 * Fix Instagram CDN image URLs by downloading and re-uploading to Supabase Storage.
 *
 * Usage: npx tsx scripts/fix-instagram-images.ts
 *
 * Queries all events with cdninstagram.com image URLs, downloads them server-side,
 * uploads to Supabase Storage (event-images bucket), and updates the DB record.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const CONCURRENCY = 5;

async function downloadImage(url: string, retries = MAX_RETRIES): Promise<Buffer> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Unreachable");
}

function slugFromSourceUrl(sourceUrl: string): string {
  // Extract shortcode from https://www.instagram.com/p/SHORTCODE/
  const match = sourceUrl.match(/\/p\/([^/]+)/);
  return match ? match[1] : `unknown-${Date.now()}`;
}

async function processEvent(event: { id: string; title: string; image_url: string; source_url: string }): Promise<boolean> {
  const shortcode = slugFromSourceUrl(event.source_url);
  const fileName = `ig-${shortcode}.jpg`;

  try {
    // Download from CDN
    const data = await downloadImage(event.image_url);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(fileName, data, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error(`  ✗ Upload failed [${event.title}]: ${uploadError.message}`);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Update DB
    const { error: updateError } = await supabase
      .from("events")
      .update({ image_url: publicUrl })
      .eq("id", event.id);

    if (updateError) {
      console.error(`  ✗ DB update failed [${event.title}]: ${updateError.message}`);
      return false;
    }

    console.log(`  ✓ ${event.title} → ${fileName}`);
    return true;
  } catch (err) {
    console.error(`  ✗ Download failed [${event.title}]: ${err}`);
    return false;
  }
}

async function main() {
  // Fetch all events with Instagram CDN URLs
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, image_url, source_url")
    .like("image_url", "%cdninstagram.com%");

  if (error) {
    console.error("Failed to query events:", error.message);
    process.exit(1);
  }

  console.log(`Found ${events.length} events with Instagram CDN URLs\n`);

  let success = 0;
  let failed = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(processEvent));
    for (const r of results) {
      if (r) success++;
      else failed++;
    }
    console.log(`  Progress: ${i + batch.length}/${events.length}\n`);
  }

  console.log(`\nDone! ${success} fixed, ${failed} failed out of ${events.length} total.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
