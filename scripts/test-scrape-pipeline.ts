/**
 * End-to-end test script for the scraping pipeline.
 *
 * Usage:
 *   npx tsx scripts/test-scrape-pipeline.ts [--live]
 *
 * Without --live: uses sample Instagram post data (no Apify call)
 * With --live: calls Apify to scrape a real McGill club account
 */

import { runPipeline, runPipelineWithImages, buildWebhookPayload, type ApifyInstagramItem } from "../src/lib/classifier-pipeline";
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

  // Run pipeline (without image upload)
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

  // Test webhook payload construction
  const highConfidence = result.results.filter(
    (r) => r.extracted_fields !== null && r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING
  );
  if (highConfidence.length > 0) {
    const payload = buildWebhookPayload(highConfidence);
    console.log("--- Webhook Payload ---");
    console.log(JSON.stringify(payload, null, 2));
    console.log();
  }

  // Test image upload (only if --upload flag)
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
