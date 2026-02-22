/**
 * Tests for the event classifier
 */

import { describe, it, expect } from "vitest";
import {
  classifyPost,
  classifyBatch,
  partitionByAction,
  extractDate,
  extractTime,
  extractLocation,
  CONFIDENCE_THRESHOLDS,
  InstagramPost,
} from "./classifier";

// =============================================
// Test Fixtures
// =============================================

function makePost(overrides: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: "test-post-1",
    caption: "",
    timestamp: "2026-02-20T12:00:00Z",
    image_url: "https://example.com/image.jpg",
    account: "mcgill_sus",
    ...overrides,
  };
}

// =============================================
// classifyPost tests
// =============================================

describe("classifyPost", () => {
  it("classifies a clear event post with high confidence", () => {
    const post = makePost({
      caption: `Join us for our Annual Gala!
Date: March 15, 2026
Time: 7:00 PM
Location: SSMU Ballroom
RSVP link in bio!`,
    });
    const result = classifyPost(post);

    expect(result.is_event).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.AUTO_PENDING);
    expect(result.extracted_fields).not.toBeNull();
    expect(result.extracted_fields?.date).toBe("2026-03-15");
    expect(result.extracted_fields?.time).toBe("19:00");
    expect(result.extracted_fields?.organizer).toBe("Mcgill Sus");
  });

  it("classifies a non-event recap post with low confidence", () => {
    const post = makePost({
      caption: "Throwback to our amazing event last week! Thanks to everyone who came out. #recap #highlights",
    });
    const result = classifyPost(post);

    expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MANUAL_REVIEW);
  });

  it("classifies a meme/social post as non-event", () => {
    const post = makePost({
      caption: "POV: when your prof says the exam is non-cumulative 😭 #relatable #mcgill #meme",
    });
    const result = classifyPost(post);

    expect(result.is_event).toBe(false);
    expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.AUTO_DISCARD);
  });

  it("handles image-only posts (empty caption)", () => {
    const post = makePost({ caption: "" });
    const result = classifyPost(post);

    expect(result.is_event).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.extracted_fields).toBeNull();
  });

  it("handles bilingual (French) event posts", () => {
    const post = makePost({
      caption: `Joignez-vous a nous pour notre soirée culturelle!
Le 20 mars
18h30
📍 Thomson House
Inscription gratuit!`,
    });
    const result = classifyPost(post);

    expect(result.is_event).toBe(true);
    expect(result.extracted_fields).not.toBeNull();
    expect(result.extracted_fields?.date).toBe("2026-03-20");
  });

  it("extracts location from @ prefix", () => {
    const post = makePost({
      caption: `Study Night
January 25, 2026
📍 Redpath Library
Come join us at 6 PM!`,
    });
    const result = classifyPost(post);

    expect(result.extracted_fields?.location).toBe("Redpath Library");
  });

  it("extracts location from known McGill buildings", () => {
    const post = makePost({
      caption: `Workshop in Leacock 232
February 28, 2026
4:30 PM`,
    });
    const result = classifyPost(post);

    expect(result.extracted_fields?.location).toContain("Leacock");
  });

  it("assigns tags based on caption content", () => {
    const post = makePost({
      caption: `Career Fair 2026!
March 10, 2026
10:00 AM - 4:00 PM
@ Bronfman Building
Meet top employers and bring your resume!`,
    });
    const result = classifyPost(post);

    expect(result.extracted_fields?.tags).toContain("career");
  });

  it("defaults tag to social when no keywords match", () => {
    const post = makePost({
      caption: `Our Annual Gathering
March 5, 2026
5 PM
@ SSMU`,
    });
    const result = classifyPost(post);

    expect(result.extracted_fields?.tags).toContain("social");
  });

  it("uses first line as title", () => {
    const post = makePost({
      caption: `Trivia Night is BACK!
Come test your knowledge
Thursday, March 12
8 PM @ Gerts`,
    });
    const result = classifyPost(post);

    expect(result.extracted_fields?.title).toBe("Trivia Night is BACK!");
  });
});

// =============================================
// extractDate tests
// =============================================

describe("extractDate", () => {
  const refTimestamp = "2026-02-20T00:00:00Z";

  it("parses 'January 15' format", () => {
    expect(extractDate("Event on January 15", refTimestamp)).toBe("2026-01-15");
  });

  it("parses 'January 15, 2026' with year", () => {
    expect(extractDate("Event on January 15, 2026", refTimestamp)).toBe("2026-01-15");
  });

  it("parses 'Monday, March 10' format", () => {
    expect(extractDate("Monday, March 10", refTimestamp)).toBe("2026-03-10");
  });

  it("parses MM/DD/YYYY format", () => {
    expect(extractDate("Date: 03/15/2026", refTimestamp)).toBe("2026-03-15");
  });

  it("parses French date 'le 15 janvier'", () => {
    expect(extractDate("le 15 janvier", refTimestamp)).toBe("2026-01-15");
  });

  it("parses date with ordinal suffix '15th'", () => {
    expect(extractDate("March 15th", refTimestamp)).toBe("2026-03-15");
  });

  it("returns null for no date", () => {
    expect(extractDate("No date here!", refTimestamp)).toBeNull();
  });

  it("parses 'this Thursday' relative to post timestamp", () => {
    // 2026-02-20 (UTC) is a Friday, so "this Thursday" = next upcoming Thursday = 2026-02-26
    const result = extractDate("Join us this Thursday at 5 pm", refTimestamp);
    expect(result).toBe("2026-02-26");
  });

  it("parses 'next Friday' relative to post timestamp", () => {
    // 2026-02-20 (UTC) is a Friday, so "next Friday" skips to 2 Fridays ahead = 2026-03-06
    const result = extractDate("Event is next Friday!", refTimestamp);
    expect(result).toBe("2026-03-06");
  });
});

// =============================================
// extractTime tests
// =============================================

describe("extractTime", () => {
  it("parses '5:30 PM'", () => {
    expect(extractTime("Event at 5:30 PM")).toBe("17:30");
  });

  it("parses '5 PM'", () => {
    expect(extractTime("Starts at 5 PM")).toBe("17:00");
  });

  it("parses '17:30' (24-hour)", () => {
    expect(extractTime("Doors open 17:30")).toBe("17:30");
  });

  it("parses '18h30' (French)", () => {
    expect(extractTime("Début 18h30")).toBe("18:30");
  });

  it("parses '16 h 00' (French spaced)", () => {
    expect(extractTime("Heure : 16 h 00")).toBe("16:00");
  });

  it("parses '12:00 AM' as midnight", () => {
    expect(extractTime("Starts 12:00 AM")).toBe("00:00");
  });

  it("parses '12:00 PM' as noon", () => {
    expect(extractTime("Lunch at 12:00 PM")).toBe("12:00");
  });

  it("returns null for no time", () => {
    expect(extractTime("No time mentioned")).toBeNull();
  });
});

// =============================================
// extractLocation tests
// =============================================

describe("extractLocation", () => {
  it("extracts location from 'Location:' prefix", () => {
    expect(extractLocation("Location: SSMU Ballroom")).toBe("SSMU Ballroom");
  });

  it("extracts location from 'Lieu:' prefix (French)", () => {
    expect(extractLocation("Lieu : Salle de bal SSMU, McGill")).toContain("Salle de bal SSMU");
  });

  it("extracts known McGill buildings", () => {
    const result = extractLocation("The workshop is in McConnell Engineering 204");
    expect(result).toContain("McConnell");
  });

  it("extracts location from pin emoji", () => {
    expect(extractLocation("📍Thomson House")).toBe("Thomson House");
  });

  it("does NOT match bare @ Instagram handles as locations", () => {
    expect(extractLocation("Shoutout to @alayacare and @mistplay")).toBeNull();
  });

  it("extracts Gert's Bar", () => {
    const result = extractLocation("Come to Gert's Bar for trivia!");
    expect(result).toContain("Gert");
  });

  it("extracts ENGTR", () => {
    const result = extractLocation("Join us at ENGTR 0070");
    expect(result).toContain("ENGTR");
  });

  it("extracts EUS Common Room", () => {
    const result = extractLocation("Meet at EUS Common Room");
    expect(result).toContain("EUS Common Room");
  });

  it("returns null for no location", () => {
    expect(extractLocation("No location here")).toBeNull();
  });
});

// =============================================
// classifyBatch tests
// =============================================

describe("classifyBatch", () => {
  it("returns results sorted by confidence descending", () => {
    const posts = [
      makePost({ id: "low", caption: "Just vibes" }),
      makePost({
        id: "high",
        caption: "Join us March 15 at 5 PM @ SSMU for our gala! RSVP now!",
      }),
    ];
    const results = classifyBatch(posts);

    expect(results[0].post_id).toBe("high");
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
  });
});

// =============================================
// partitionByAction tests
// =============================================

describe("partitionByAction", () => {
  it("partitions results into three buckets", () => {
    const posts = [
      makePost({
        id: "event",
        caption: "Join us for our Gala! March 15, 2026 at 7 PM @ SSMU. RSVP link in bio!",
      }),
      makePost({
        id: "maybe",
        caption: "Workshop coming soon! Stay tuned for more details. Link in bio.",
      }),
      makePost({
        id: "not-event",
        caption: "Happy holidays everyone!",
      }),
    ];

    const results = classifyBatch(posts);
    const partitioned = partitionByAction(results);

    // The clear event should be in auto_pending
    const eventResult = results.find(r => r.post_id === "event");
    expect(eventResult?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.AUTO_PENDING);

    // The non-event should be in auto_discard
    const notEventResult = results.find(r => r.post_id === "not-event");
    expect(notEventResult?.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.AUTO_DISCARD);

    // Total across all partitions should equal total results
    const totalPartitioned =
      partitioned.auto_pending.length +
      partitioned.manual_review.length +
      partitioned.auto_discard.length;
    expect(totalPartitioned).toBe(results.length);
  });
});
