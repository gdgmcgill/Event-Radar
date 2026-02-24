# Event Card Images & Scraping Robustness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make scraped Instagram event images display on event cards by re-hosting images to Supabase Storage, fix the source_url pipeline gap, fix event detail scroll, and test the full scraping pipeline end-to-end.

**Architecture:** The scraping pipeline (Apify → classifier → webhook → DB) already exists but has two gaps: (1) Instagram CDN image URLs expire within 1-3 hours so images must be downloaded and uploaded to Supabase Storage during the pipeline run, and (2) `post_url` (Instagram link) is captured by the normalizer but never passed through to the database. We fix both gaps, fix the scroll issue on the event detail page, and add tests.

**Tech Stack:** TypeScript, Supabase Storage, Supabase JS SDK, Next.js, Vitest

---

## Task 1: Add `source_url` to ExtractedEvent and classifier output

The `post_url` field exists on `InstagramPost` but is never carried through to `ExtractedEvent`. The DB already has `source` and `source_url` columns (migration 008) but they're never populated.

**Files:**
- Modify: `src/lib/classifier.ts:27-38` (ExtractedEvent interface)
- Modify: `src/lib/classifier.ts:310-319` (classifyPost extracted_fields)
- Test: `src/lib/classifier.test.ts`

**Step 1: Write the failing test**

In `src/lib/classifier.test.ts`, add a test that verifies `source_url` is extracted:

```typescript
it("includes source_url from post_url in extracted fields", () => {
  const post = makePost({
    caption: `Join us for our Annual Gala!
Date: March 15, 2026
Time: 7:00 PM
Location: SSMU Ballroom`,
    post_url: "https://www.instagram.com/p/ABC123/",
  });
  const result = classifyPost(post);

  expect(result.extracted_fields).not.toBeNull();
  expect(result.extracted_fields?.source_url).toBe("https://www.instagram.com/p/ABC123/");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/classifier.test.ts --reporter=verbose`
Expected: FAIL — `source_url` doesn't exist on `ExtractedEvent`

**Step 3: Add `source_url` to ExtractedEvent and populate it**

In `src/lib/classifier.ts`, add `source_url` to the `ExtractedEvent` interface (after `image_url`):

```typescript
export interface ExtractedEvent {
  title: string;
  description: string;
  category?: string;
  date: string;
  time?: string;
  duration?: number;
  location: string;
  organizer: string;
  image_url?: string;
  source_url?: string;
  tags?: string[];
}
```

In `classifyPost()`, add `source_url` to the extracted_fields object (around line 317):

```typescript
extracted_fields = {
  title,
  description: truncateDescription(caption),
  date: dateMatch,
  time: timeMatch || undefined,
  location: locationMatch || "TBD",
  organizer: cleanAccountName(post.account),
  image_url: post.image_url,
  source_url: post.post_url,
  tags,
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/classifier.test.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/classifier.ts src/lib/classifier.test.ts
git commit -m "feat: pass source_url through classifier extracted fields"
```

---

## Task 2: Add `source_url` and `source` to webhook pipeline

The webhook needs to accept `source_url` in the payload and store `source` + `source_url` in the database.

**Files:**
- Modify: `supabase/functions/events-webhook/index.ts:18-34` (WebhookEvent interface)
- Modify: `supabase/functions/events-webhook/index.ts:100-111` (DatabaseEvent interface)
- Modify: `supabase/functions/events-webhook/index.ts:117-174` (mapEventToDatabase)

**Step 1: Update WebhookEvent interface**

Add `source_url` after `image_url` (line ~27):

```typescript
interface WebhookEvent {
  title: string;
  description: string;
  category?: string;
  date: string;
  time?: string;
  duration?: number;
  location: string;
  organizer?: string;
  image_url?: string;
  source_url?: string;
  tags?: string[];
  capacity?: number;
  price?: number;
  registration_url?: string;
  contact_email?: string;
  contact_phone?: string;
}
```

**Step 2: Update DatabaseEvent interface**

Add `source` and `source_url` fields (after `status`):

```typescript
interface DatabaseEvent {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  category: string | null;
  tags: string[];
  image_url: string | null;
  organizer: string | null;
  status: "pending" | "approved" | "rejected";
  source: string;
  source_url: string | null;
}
```

**Step 3: Update mapEventToDatabase**

Add `source` and `source_url` to the `dbEvent` object (around line 161-172):

```typescript
const dbEvent: DatabaseEvent = {
  title: event.title.trim(),
  description: event.description.trim(),
  start_date: startDate.toISOString(),
  end_date: endDate.toISOString(),
  location: event.location.trim(),
  category: category,
  tags: [...new Set(tags)],
  image_url: event.image_url || null,
  organizer: event.organizer?.trim() || null,
  status: "pending",
  source: event.source_url ? "instagram" : "manual",
  source_url: event.source_url || null,
};
```

**Step 4: Commit**

```bash
git add supabase/functions/events-webhook/index.ts
git commit -m "feat: accept source_url in webhook and store source fields"
```

---

## Task 3: Create `downloadAndUploadImage` utility

This function downloads an image from a URL (Instagram CDN) and uploads it to Supabase Storage. It's used by the pipeline before sending events to the webhook.

**Files:**
- Create: `src/lib/image-upload.ts`
- Test: `src/lib/image-upload.test.ts`

**Step 1: Write the failing test**

Create `src/lib/image-upload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadAndUploadImage } from "./image-upload";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Supabase client
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
const mockSupabase = { storage: { from: mockFrom } } as any;

describe("downloadAndUploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads image and uploads to Supabase Storage, returns public URL", async () => {
    const imageBuffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: () => Promise.resolve(imageBuffer),
    });
    mockUpload.mockResolvedValueOnce({ data: { path: "1234-abcd.jpg" }, error: null });
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/event-images/1234-abcd.jpg" },
    });

    const result = await downloadAndUploadImage(
      "https://scontent.cdninstagram.com/image.jpg",
      mockSupabase,
    );

    expect(result).toBe("https://project.supabase.co/storage/v1/object/public/event-images/1234-abcd.jpg");
    expect(mockFetch).toHaveBeenCalledWith("https://scontent.cdninstagram.com/image.jpg");
    expect(mockFrom).toHaveBeenCalledWith("event-images");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^\d+-[a-f0-9]+\.jpg$/),
      expect.any(Buffer),
      { contentType: "image/jpeg", upsert: false },
    );
  });

  it("returns null when image download fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await downloadAndUploadImage(
      "https://expired-url.com/image.jpg",
      mockSupabase,
    );

    expect(result).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("returns null when Supabase upload fails", async () => {
    const imageBuffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: () => Promise.resolve(imageBuffer),
    });
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "Bucket not found" } });

    const result = await downloadAndUploadImage(
      "https://scontent.cdninstagram.com/image.png",
      mockSupabase,
    );

    expect(result).toBeNull();
  });

  it("returns null for empty URL", async () => {
    const result = await downloadAndUploadImage("", mockSupabase);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image-upload.test.ts --reporter=verbose`
Expected: FAIL — module `./image-upload` not found

**Step 3: Implement `downloadAndUploadImage`**

Create `src/lib/image-upload.ts`:

```typescript
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "event-images";

/**
 * Download an image from a URL and upload it to Supabase Storage.
 * Returns the permanent public URL, or null if anything fails.
 */
export async function downloadAndUploadImage(
  imageUrl: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!imageUrl) return null;

  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to download image (${response.status}): ${imageUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await response.arrayBuffer());

    // Generate unique filename
    const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
    const filename = `${Date.now()}-${hash}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.warn(`Failed to upload image to Supabase Storage: ${error.message}`);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.warn(`Image download/upload error: ${err}`);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/image-upload.test.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/image-upload.ts src/lib/image-upload.test.ts
git commit -m "feat: add downloadAndUploadImage utility for Supabase Storage"
```

---

## Task 4: Integrate image upload into the pipeline

Add an async version of `runPipeline` that downloads and re-hosts images before building the webhook payload.

**Files:**
- Modify: `src/lib/classifier-pipeline.ts`
- Test: `src/lib/classifier-pipeline.test.ts`

**Step 1: Write the failing test**

Create `src/lib/classifier-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeApifyOutput,
  buildWebhookPayload,
  runPipeline,
  runPipelineWithImages,
  type ApifyInstagramItem,
} from "./classifier-pipeline";

describe("normalizeApifyOutput", () => {
  it("maps displayUrl to image_url and url to post_url", () => {
    const items: ApifyInstagramItem[] = [
      {
        id: "post-1",
        caption: "Join us March 15 at SSMU Ballroom at 7pm for our Gala!",
        timestamp: "2026-02-20T12:00:00Z",
        displayUrl: "https://scontent.cdninstagram.com/v/image.jpg",
        ownerUsername: "mcgill_sus",
        url: "https://www.instagram.com/p/ABC123/",
      },
    ];

    const posts = normalizeApifyOutput(items);

    expect(posts[0].image_url).toBe("https://scontent.cdninstagram.com/v/image.jpg");
    expect(posts[0].post_url).toBe("https://www.instagram.com/p/ABC123/");
  });
});

describe("buildWebhookPayload", () => {
  it("includes source_url in webhook payload events", () => {
    // We need a classified result with source_url in extracted_fields
    const items: ApifyInstagramItem[] = [
      {
        id: "post-1",
        caption: "Join us for our Annual Gala!\nDate: March 15, 2026\nTime: 7:00 PM\nLocation: SSMU Ballroom",
        timestamp: "2026-02-20T12:00:00Z",
        displayUrl: "https://scontent.cdninstagram.com/v/image.jpg",
        ownerUsername: "mcgill_sus",
        url: "https://www.instagram.com/p/ABC123/",
      },
    ];
    const result = runPipeline(items);
    const highConfidence = result.results.filter(
      (r) => r.extracted_fields !== null
    );

    if (highConfidence.length > 0) {
      const payload = buildWebhookPayload(highConfidence);
      expect(payload.events[0].source_url).toBe("https://www.instagram.com/p/ABC123/");
    }
  });
});

describe("runPipelineWithImages", () => {
  const mockUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockFrom = vi.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }));
  const mockSupabase = { storage: { from: mockFrom } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for image downloads
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    mockUpload.mockResolvedValue({ data: { path: "1234-abcd.jpg" }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/event-images/1234-abcd.jpg" },
    });
  });

  it("replaces instagram CDN image_url with Supabase Storage URL in results", async () => {
    const items: ApifyInstagramItem[] = [
      {
        id: "post-1",
        caption: "Join us for our Annual Gala!\nDate: March 15, 2026\nTime: 7:00 PM\nLocation: SSMU Ballroom",
        timestamp: "2026-02-20T12:00:00Z",
        displayUrl: "https://scontent.cdninstagram.com/v/image.jpg",
        ownerUsername: "mcgill_sus",
        url: "https://www.instagram.com/p/ABC123/",
      },
    ];

    const result = await runPipelineWithImages(items, mockSupabase);

    const withFields = result.results.filter((r) => r.extracted_fields !== null);
    if (withFields.length > 0) {
      expect(withFields[0].extracted_fields!.image_url).toContain("supabase.co");
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/classifier-pipeline.test.ts --reporter=verbose`
Expected: FAIL — `runPipelineWithImages` not exported

**Step 3: Add `runPipelineWithImages` to classifier-pipeline.ts**

Add to `src/lib/classifier-pipeline.ts`:

```typescript
import { downloadAndUploadImage } from "./image-upload";
import type { SupabaseClient } from "@supabase/supabase-js";
```

Then add this function after `runPipeline()`:

```typescript
/**
 * Run the classification pipeline with image re-hosting.
 * Downloads Instagram CDN images and uploads them to Supabase Storage
 * so that image URLs are permanent.
 */
export async function runPipelineWithImages(
  apifyItems: ApifyInstagramItem[],
  supabase: SupabaseClient,
): Promise<PipelineResult> {
  const result = runPipeline(apifyItems);

  // Re-host images for all classified events that have extracted_fields
  const uploadPromises = result.results.map(async (r) => {
    if (!r.extracted_fields?.image_url) return;

    const permanentUrl = await downloadAndUploadImage(
      r.extracted_fields.image_url,
      supabase,
    );

    if (permanentUrl) {
      r.extracted_fields.image_url = permanentUrl;
    }
    // If upload fails, keep original URL (will likely expire, but better than null)
  });

  await Promise.all(uploadPromises);
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/classifier-pipeline.test.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/classifier-pipeline.ts src/lib/classifier-pipeline.test.ts
git commit -m "feat: add runPipelineWithImages for Supabase Storage re-hosting"
```

---

## Task 5: Fix event detail page scroll position

When navigating from an EventCard to the detail page, the page should start at the top.

**Files:**
- Modify: `src/app/events/[id]/EventDetailClient.tsx`

**Step 1: Add scroll-to-top on mount**

In `EventDetailClient.tsx`, add a `useEffect` after the existing `useEffect` hooks (after line ~92):

```typescript
// Scroll to top when navigating to event detail
useEffect(() => {
  window.scrollTo(0, 0);
}, []);
```

**Step 2: Verify manually**

Run: `npm run dev`
Navigate to any event card → click it → verify the detail page starts at the top.

**Step 3: Commit**

```bash
git add src/app/events/[id]/EventDetailClient.tsx
git commit -m "fix: scroll to top when navigating to event detail page"
```

---

## Task 6: Create Supabase Storage bucket

The `event-images` bucket needs to exist for the image upload to work.

**Files:**
- Create: `supabase/migrations/009_event_images_bucket.sql`

**Step 1: Create migration**

```sql
-- Create the event-images storage bucket (public, for scraped event images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to event images
CREATE POLICY "Public read access for event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Allow service role to upload event images
CREATE POLICY "Service role upload for event images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'event-images');
```

Note: If using Supabase dashboard instead of migrations, create the bucket manually:
1. Go to Storage in Supabase Dashboard
2. Create new bucket: `event-images`, set to Public
3. Add policies: public SELECT, service_role INSERT

**Step 2: Commit**

```bash
git add supabase/migrations/009_event_images_bucket.sql
git commit -m "feat: add event-images storage bucket migration"
```

---

## Task 7: End-to-end scraping test script

A runnable script to test the full pipeline with real Apify data (or sample data).

**Files:**
- Create: `scripts/test-scrape-pipeline.ts`

**Step 1: Create the test script**

Create `scripts/test-scrape-pipeline.ts`:

```typescript
/**
 * End-to-end test script for the scraping pipeline.
 *
 * Usage:
 *   npx tsx scripts/test-scrape-pipeline.ts [--live]
 *
 * Without --live: uses sample Instagram post data (no Apify call)
 * With --live: calls Apify to scrape a real McGill club account
 */

import { runPipeline, runPipelineWithImages, normalizeApifyOutput, buildWebhookPayload, type ApifyInstagramItem } from "../src/lib/classifier-pipeline";
import { createServiceClient } from "../src/lib/supabase/service";
import { CONFIDENCE_THRESHOLDS } from "../src/lib/classifier";

// Sample data mimicking Apify Instagram Post Scraper output
const SAMPLE_ITEMS: ApifyInstagramItem[] = [
  {
    id: "sample-event-post",
    caption: `🎉 Annual Winter Gala 2026! 🎉

Join SSMU for an unforgettable evening of music, dance, and celebration!

📅 Date: March 15, 2026
🕖 Time: 7:00 PM - 11:00 PM
📍 Location: SSMU Ballroom, 3480 McTavish Street

Tickets available at the link in bio. Don't miss out!

#McGill #WinterGala #StudentLife`,
    timestamp: "2026-02-20T14:30:00Z",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.2885-15/sample_event_image.jpg",
    ownerUsername: "ssabordssmume",
    likesCount: 342,
    commentsCount: 28,
    url: "https://www.instagram.com/p/SAMPLE123/",
  },
  {
    id: "sample-non-event",
    caption: "Throwback to last week's amazing turnout! Thanks everyone for coming out 🙏 #recap #mcgill",
    timestamp: "2026-02-19T10:00:00Z",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.2885-15/sample_recap.jpg",
    ownerUsername: "ssabordssmume",
    likesCount: 156,
    commentsCount: 8,
    url: "https://www.instagram.com/p/SAMPLE456/",
  },
  {
    id: "sample-workshop",
    caption: `📚 Resume Workshop with Career Services

Looking to land your dream internship? Join us!

Date: February 28, 2026
Time: 2:00 PM
Location: Leacock Building Room 232

Free pizza will be provided! Register at the link in bio.

#McGill #CareerDevelopment #Workshop`,
    timestamp: "2026-02-18T16:00:00Z",
    displayUrl: "https://scontent.cdninstagram.com/v/t51.2885-15/sample_workshop.jpg",
    ownerUsername: "mcgillcaps",
    likesCount: 89,
    commentsCount: 12,
    url: "https://www.instagram.com/p/SAMPLE789/",
  },
];

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("=== Scrape Pipeline Test ===\n");
  console.log(`Mode: ${isLive ? "LIVE (Apify)" : "SAMPLE DATA"}\n`);

  // Step 1: Get items (sample or live)
  let items: ApifyInstagramItem[];
  if (isLive) {
    console.log("Live scraping not implemented in this script yet.");
    console.log("Use Apify console to run the Instagram Post Scraper,");
    console.log("then paste the JSON output into this script.\n");
    process.exit(0);
  } else {
    items = SAMPLE_ITEMS;
  }

  console.log(`Input: ${items.length} posts\n`);

  // Step 2: Run pipeline (without image upload first)
  console.log("--- Classification Results ---\n");
  const result = runPipeline(items);

  for (const r of result.results) {
    const status =
      r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING
        ? "✅ AUTO_PENDING"
        : r.confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW
        ? "⚠️  MANUAL_REVIEW"
        : "❌ AUTO_DISCARD";

    console.log(`[${status}] ${r.post_id}`);
    console.log(`  Confidence: ${(r.confidence * 100).toFixed(1)}%`);
    console.log(`  Is Event: ${r.is_event}`);

    if (r.extracted_fields) {
      console.log(`  Title: ${r.extracted_fields.title}`);
      console.log(`  Date: ${r.extracted_fields.date}`);
      console.log(`  Time: ${r.extracted_fields.time || "N/A"}`);
      console.log(`  Location: ${r.extracted_fields.location}`);
      console.log(`  Image URL: ${r.extracted_fields.image_url || "N/A"}`);
      console.log(`  Source URL: ${r.extracted_fields.source_url || "N/A"}`);
      console.log(`  Tags: ${r.extracted_fields.tags?.join(", ") || "none"}`);
    }
    console.log();
  }

  console.log("--- Summary ---");
  console.log(`Total posts: ${result.total_posts}`);
  console.log(`Events (auto pending): ${result.events_sent_to_pending}`);
  console.log(`Events (manual review): ${result.events_flagged_for_review}`);
  console.log(`Discarded: ${result.posts_discarded}`);
  console.log();

  // Step 3: Test webhook payload construction
  const highConfidence = result.results.filter(
    (r) => r.extracted_fields !== null && r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING
  );
  if (highConfidence.length > 0) {
    const payload = buildWebhookPayload(highConfidence);
    console.log("--- Webhook Payload ---");
    console.log(JSON.stringify(payload, null, 2));
    console.log();
  }

  // Step 4: Test image upload (only if --upload flag)
  if (process.argv.includes("--upload")) {
    console.log("--- Image Upload Test ---\n");
    const supabase = createServiceClient();
    const resultWithImages = await runPipelineWithImages(items, supabase);

    for (const r of resultWithImages.results) {
      if (r.extracted_fields?.image_url) {
        console.log(`${r.post_id}: ${r.extracted_fields.image_url}`);
      }
    }
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
```

**Step 2: Run the test script**

Run: `npx tsx scripts/test-scrape-pipeline.ts`
Expected: Classification output showing events detected from sample data with source_url populated.

**Step 3: Commit**

```bash
git add scripts/test-scrape-pipeline.ts
git commit -m "test: add end-to-end scrape pipeline test script"
```

---

## Task Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Add `source_url` to classifier | `classifier.ts`, `classifier.test.ts` |
| 2 | Add `source_url` to webhook | `events-webhook/index.ts` |
| 3 | Create image upload utility | `image-upload.ts`, `image-upload.test.ts` |
| 4 | Integrate image upload into pipeline | `classifier-pipeline.ts`, `classifier-pipeline.test.ts` |
| 5 | Fix event detail page scroll | `EventDetailClient.tsx` |
| 6 | Create storage bucket migration | `009_event_images_bucket.sql` |
| 7 | E2E test script | `scripts/test-scrape-pipeline.ts` |
