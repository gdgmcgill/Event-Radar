/**
 * Upload images to Supabase Storage from Instagram CDN URLs.
 *
 * Usage:
 *   echo '{"club_logos":[...],"event_images":[...]}' | npx tsx scripts/upload-images.ts
 *
 * Input (JSON via stdin):
 *   {
 *     "club_logos": [{ "handle": "bolt.mcgill", "url": "https://scontent-..." }],
 *     "event_images": [{ "slug": "bolt-mcgill-event", "url": "https://scontent-..." }]
 *   }
 *
 * Output (JSON to stdout):
 *   {
 *     "club_logos": { "bolt.mcgill": "https://...supabase.co/.../club-logos/bolt.mcgill.jpg" },
 *     "event_images": { "bolt-mcgill-event": "https://...supabase.co/.../event-images/bolt-mcgill-event.jpg" }
 *   }
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local from project root
config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ImageInput {
  club_logos: { handle: string; url: string }[];
  event_images: { slug: string; url: string }[];
}

interface ImageOutput {
  club_logos: Record<string, string>;
  event_images: Record<string, string>;
}

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

async function downloadImage(
  url: string,
  retries = MAX_RETRIES
): Promise<Buffer> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (attempt === retries) {
        throw new Error(
          `Failed to download ${url} after ${retries + 1} attempts: ${err}`
        );
      }
      // Wait 1s before retry
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Unreachable");
}

function detectContentType(url: string): string {
  if (url.includes(".png")) return "image/png";
  if (url.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

function getExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function uploadToStorage(
  bucket: string,
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(fileName, data, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed for ${bucket}/${fileName}: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

async function main() {
  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const rawInput = Buffer.concat(chunks).toString("utf-8");

  let input: ImageInput;
  try {
    input = JSON.parse(rawInput);
  } catch {
    console.error("Invalid JSON input");
    process.exit(1);
  }

  const output: ImageOutput = {
    club_logos: {},
    event_images: {},
  };

  // Upload club logos
  const logos = input.club_logos ?? [];
  for (const { handle, url } of logos) {
    try {
      const contentType = detectContentType(url);
      const ext = getExtension(contentType);
      const fileName = `${handle}.${ext}`;

      process.stderr.write(`Downloading logo: ${handle}...\n`);
      const data = await downloadImage(url);

      process.stderr.write(`Uploading logo: ${fileName}...\n`);
      const publicUrl = await uploadToStorage(
        "club-logos",
        fileName,
        data,
        contentType
      );
      output.club_logos[handle] = publicUrl;
      process.stderr.write(`  ✓ ${handle}\n`);
    } catch (err) {
      process.stderr.write(`  ✗ ${handle}: ${err}\n`);
    }
  }

  // Upload event images
  const events = input.event_images ?? [];
  for (const { slug, url } of events) {
    try {
      const contentType = detectContentType(url);
      const ext = getExtension(contentType);
      const fileName = `${slug}.${ext}`;

      process.stderr.write(`Downloading event image: ${slug}...\n`);
      const data = await downloadImage(url);

      process.stderr.write(`Uploading event image: ${fileName}...\n`);
      const publicUrl = await uploadToStorage(
        "event-images",
        fileName,
        data,
        contentType
      );
      output.event_images[slug] = publicUrl;
      process.stderr.write(`  ✓ ${slug}\n`);
    } catch (err) {
      process.stderr.write(`  ✗ ${slug}: ${err}\n`);
    }
  }

  // Output result as JSON to stdout
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
