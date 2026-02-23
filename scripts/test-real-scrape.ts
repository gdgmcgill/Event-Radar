/**
 * Real scrape test: feeds actual Apify Instagram Post Scraper output
 * through the full pipeline (classify + image upload to Supabase Storage).
 *
 * Usage:
 *   npx tsx scripts/test-real-scrape.ts
 *   npx tsx scripts/test-real-scrape.ts --upload   # also uploads images to Supabase
 */

// Load .env.local before any Supabase imports
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { runPipeline, runPipelineWithImages, buildWebhookPayload, type ApifyInstagramItem } from "../src/lib/classifier-pipeline";
import { createServiceClient } from "../src/lib/supabase/service";
import { CONFIDENCE_THRESHOLDS } from "../src/lib/classifier";

// Real Apify output from gdg_mcgill (scraped 2026-02-23)
const REAL_APIFY_ITEMS: ApifyInstagramItem[] = [
  {
    id: "3739692343466491191",
    caption: "Introducing our 2025 GDG McGill Executive Team 🚀\nHere to build, connect, and create together!",
    timestamp: "2025-10-09T16:08:09.000Z",
    displayUrl: "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-15/563354865_18068492801340386_4288691528006296331_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2QFGOWP3wTIWx5KJeDRgr3FlUih02wfMleR8EbAYpm6f1D-_yOo29D8KzMMhPLuadrI&_nc_ohc=62QRbr2e6_gQ7kNvwEFIx9-&_nc_gid=CHCgXRGNsVamlRT0qrXQlQ&edm=APs17CUBAAAA&ccb=7-5&oh=00_AfuP6qXtGwAiw21fq4MoKXOqXRBWl3dPMKMLf3lLfLCoxQ&oe=69A2CA18&_nc_sid=10d13b",
    ownerUsername: "gdg_mcgill",
    likesCount: 50,
    commentsCount: 3,
    url: "https://www.instagram.com/p/DPmDl9lkX03/",
  },
  {
    id: "3839126426143014139",
    caption: "We have so many events coming up 💪🤭🍼\n\nCome to the BUILD WITH AI: GDG GALA on March 17th!",
    timestamp: "2026-02-23T20:45:55.000Z",
    displayUrl: "https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/640162944_18082119098340386_2263148631462325153_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2QFn_hl9QLyt84A4QpVBr6cjF_3HAHq6cG6ZA8FhNWYpoBotDzS83K5l9D0Wh1G-IbA&_nc_ohc=I9CNUShHl7MQ7kNvwFC1YBO&_nc_gid=4CgazzR91hPEUeNEm7jxFg&edm=APs17CUBAAAA&ccb=7-5&oh=00_Afv4V1A1ySCO8KIukf6I0LnFtqnvd-bGKFhha01dR6SMXA&oe=69A2B85E&_nc_sid=10d13b",
    ownerUsername: "gdg_mcgill",
    likesCount: 23,
    commentsCount: 6,
    url: "https://www.instagram.com/p/DVHUSTeEbz7/",
  },
  {
    id: "3836495877926408343",
    caption: "Taking a compiler design course may be exactly what you need to start a company 🧑🏻‍💻\n\nThank you DevPro for the thorough session on Voice-based AI agents!\nCome chat with Matthew and Gianluca at our Build with AI Gala on March 17th 🥂",
    timestamp: "2026-02-20T05:42:44.000Z",
    displayUrl: "https://scontent-atl3-2.cdninstagram.com/v/t51.2885-15/632818100_908860251789326_6027039895328610016_n.jpg?stp=dst-jpg_e15_tt6&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2QEkiEp1qN9OC8iB4w0-45zcypGxY_bpHjwrBrNOjTObtArmcG7-whUT6BAs515ZMNs&_nc_ohc=sQq_RkLlbgYQ7kNvwHBaQU0&_nc_gid=g-8be0M6IUGcrqMzS7Ep0Q&edm=APs17CUBAAAA&ccb=7-5&oh=00_Afsr4Ucs0QaLOtUD_kyoAstvejaOouuynpwBnc04Of5w8Q&oe=69A2CCFD&_nc_sid=10d13b",
    ownerUsername: "gdg_mcgill",
    likesCount: 28,
    commentsCount: 2,
    url: "https://www.instagram.com/p/DU9-KyiDdCX/",
  },
  {
    id: "3829012190905600744",
    caption: "GDG McGill, Concordia, and Polytechnique are collaborating for our Build with AI Closing Summit 🚀\n\nYou don't want to miss this event !! Join us to celebrate the Montreal developer community. Whether you want to build or network, we've got you covered.\n\n📅 Date: Tuesday, March 17, 2026 \n🕓 Time: 4:00 PM – 9:00 PM \n📍 Location: McGill SSMU Ballroom \n👔 Dress Code: Business Professional \n🎟️ Cost: FREE\n\nLink in bio to grab your ticket! 🔗",
    timestamp: "2026-02-09T21:50:44.000Z",
    displayUrl: "https://scontent-atl3-2.cdninstagram.com/v/t51.2885-15/629991432_18080821664340386_8075665562056297782_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2QGodvNFmdux8-uJtk9ihZVXc_uR-pzTf7dt3lwKbyCuKoFBywC3pei-ygBSaDYkzl8&_nc_ohc=dY5zbqHJ8f0Q7kNvwEq9M-D&_nc_gid=xeD3tETB2nVMQb31F-s2Fw&edm=APs17CUBAAAA&ccb=7-5&oh=00_AfuDkw3XSb5aRXNKhhdM5YUys9edriEs1y4HjCF9ENnpzw&oe=69A2B418&_nc_sid=10d13b",
    ownerUsername: "gdg_mcgill",
    likesCount: 99,
    commentsCount: 6,
    url: "https://www.instagram.com/p/DUjYkz3kYro/",
  },
  {
    id: "3739694454451313407",
    caption: "Round 2 of our Exec introductions! 😎\nSame energy and enthusiasm. Get to know the rest of the team that makes GDG McGill happen!",
    timestamp: "2025-10-09T16:12:20.000Z",
    displayUrl: "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-15/560905012_18068493179340386_2666528920214808988_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2QEipxeX7QA882D-vdjhfakUc4C8IqBBqJnvqYi_9qhlzlyy82lpWGQ9nkr0N42CMFs&_nc_ohc=ewmgo6A_E2QQ7kNvwEMCPvf&_nc_gid=NDkCGas5yIDl-AC65veC-Q&edm=APs17CUBAAAA&ccb=7-5&oh=00_AfvrfFh2swICISnkiPHC9klL8-ZZ0iYAZ7YIN6PnL4u-Ig&oe=69A2AA40&_nc_sid=10d13b",
    ownerUsername: "gdg_mcgill",
    likesCount: 49,
    commentsCount: 4,
    url: "https://www.instagram.com/p/DPmEErmEZr_/",
  },
];

async function main() {
  const doUpload = process.argv.includes("--upload");

  console.log("=== Real Scrape Pipeline Test (gdg_mcgill) ===\n");
  console.log(`Posts: ${REAL_APIFY_ITEMS.length}`);
  console.log(`Image upload: ${doUpload ? "YES" : "NO (pass --upload to enable)"}\n`);

  // Step 1: Classify
  console.log("--- Classification Results ---\n");

  let result;
  if (doUpload) {
    const supabase = createServiceClient();
    result = await runPipelineWithImages(REAL_APIFY_ITEMS, supabase);
  } else {
    result = runPipeline(REAL_APIFY_ITEMS);
  }

  for (const r of result.results) {
    const status =
      r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING
        ? "✅ AUTO_PENDING"
        : r.confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW
        ? "⚠️  MANUAL_REVIEW"
        : "❌ AUTO_DISCARD";

    console.log(`[${status}] ${r.post_id}`);
    console.log(`  Account: ${REAL_APIFY_ITEMS.find(i => i.id === r.post_id)?.ownerUsername}`);
    console.log(`  Confidence: ${(r.confidence * 100).toFixed(1)}%`);
    console.log(`  Is Event: ${r.is_event}`);

    if (r.extracted_fields) {
      console.log(`  Title: ${r.extracted_fields.title}`);
      console.log(`  Date: ${r.extracted_fields.date}`);
      console.log(`  Time: ${r.extracted_fields.time || "N/A"}`);
      console.log(`  Location: ${r.extracted_fields.location}`);
      console.log(`  Source URL: ${r.extracted_fields.source_url || "N/A"}`);
      console.log(`  Image URL: ${r.extracted_fields.image_url || "N/A"}`);
      if (doUpload && r.extracted_fields.image_url?.includes("supabase")) {
        console.log(`  ☁️  Image uploaded to Supabase Storage!`);
      }
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

  // Webhook payload for events
  const eventsToSend = result.results.filter(
    (r) => r.extracted_fields !== null && r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING
  );
  if (eventsToSend.length > 0) {
    const payload = buildWebhookPayload(eventsToSend);
    console.log("--- Webhook Payload (would be sent) ---");
    console.log(JSON.stringify(payload, null, 2));
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
