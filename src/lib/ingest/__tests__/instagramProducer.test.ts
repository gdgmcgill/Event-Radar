/** M3 P1-07: the pure half of the Instagram producer. Synthetic fixture only:
 * two invented clubs, invented captions, no real accounts or people. */
import fixture from "../__fixtures__/apify-profiles.json";
import {
  PRODUCER_ID,
  buildWebhookEvents,
  chunk,
  mapApifyProfiles,
  signBody,
  webhookPayload,
} from "../instagramProducer";
import { WebhookEvent, WebhookPayload, webhookPayloadError } from "../../../../supabase/functions/_shared/webhook-contract";
import { verifySignature } from "../../../../supabase/functions/_shared/webhook-signature";
import { PRODUCER_PATTERN } from "@/contracts/webhook";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const RUN_ID = "3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f";

describe("mapApifyProfiles", () => {
  it("returns the fixture's valid posts and drops the malformed profiles and the post without an id", () => {
    const posts = mapApifyProfiles(fixture as unknown[]);
    expect(posts.map((post) => post.id)).toEqual(["fixture-a-1", "fixture-a-2", "fixture-a-3", "fixture-b-1"]);
    expect(posts[0]).toEqual({
      id: "fixture-a-1",
      caption: expect.stringContaining("Robotics Build Night"),
      timestamp: "2026-09-18T15:00:00.000Z",
      image_url: "https://scontent.cdninstagram.com/v/fixture-a-1.jpg",
      account: "example_club_a",
      likes: 40,
      comments: 3,
      post_url: "https://www.instagram.com/p/fixtureA1/",
    });
  });

  it.each([[null], [5], ["text"], [[]], [{}], [{ username: "x", latestPosts: {} }]])("drops %j", (item) => {
    expect(mapApifyProfiles([item])).toEqual([]);
  });
});

describe("buildWebhookEvents", () => {
  const posts = mapApifyProfiles(fixture as unknown[]);

  it("drops posts older than `days` and posts the classifier discards", () => {
    const built = buildWebhookEvents(posts, { now: NOW, days: 14 });
    expect(built.seen).toBe(3);
    expect(built.events.map((event) => event.source_url).sort()).toEqual([
      "https://www.instagram.com/p/fixtureA1/",
      "https://www.instagram.com/p/fixtureB1/",
    ]);
    expect(built.discarded).toBe(1);
  });

  it("a wider window admits the old post", () => {
    const built = buildWebhookEvents(posts, { now: NOW, days: 120 });
    expect(built.seen).toBe(4);
    expect(built.events.map((event) => event.source_url)).toContain("https://www.instagram.com/p/fixtureA3/");
  });

  it("every event passes the shared webhook contract and carries source, image and organizer", () => {
    const { events } = buildWebhookEvents(posts, { now: NOW, days: 14 });
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(WebhookEvent.safeParse(event).success).toBe(true);
      expect(event.source_url).toMatch(/^https:\/\/www\.instagram\.com\/p\//);
      expect(event.image_url).toMatch(/^https:\/\/scontent\.cdninstagram\.com\//);
      expect(event.organizer).toBeTruthy();
    }
  });

  it("an empty post list builds nothing", () => {
    expect(buildWebhookEvents([], { now: NOW, days: 14 })).toEqual({ events: [], seen: 0, discarded: 0 });
  });
});

describe("chunk", () => {
  it("splits into batches of the given size, keeping order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 25)).toEqual([]);
    expect(chunk(Array.from({ length: 51 }, (_, i) => i), 25).map((batch) => batch.length)).toEqual([25, 25, 1]);
  });
});

describe("signBody and webhookPayload", () => {
  it("PRODUCER_ID matches the delivery log's producer pattern", () => {
    expect(PRODUCER_ID).toBe("instagram-apify@1");
    expect(PRODUCER_PATTERN.test(PRODUCER_ID)).toBe(true);
  });

  it("signBody output verifies with the webhook's verifySignature, and only under its secret", () => {
    const body = webhookPayload([], { id: RUN_ID, status: "ok", items_seen: 0 });
    const signature = signBody(body, "producer-secret");
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifySignature(body, signature, "producer-secret")).toBe(true);
    expect(verifySignature(body, signature, "another-secret")).toBe(false);
    expect(verifySignature(`${body} `, signature, "producer-secret")).toBe(false);
  });

  it("an empty failed run parses with the contract (empty events allowed with run)", () => {
    const body = webhookPayload([], { id: RUN_ID, status: "failed", error_code: "apify_http_401", items_seen: 0 });
    const parsed = JSON.parse(body);
    expect(webhookPayloadError(parsed)).toBeNull();
    expect(parsed).toEqual({
      event_count: 0,
      events: [],
      run: { id: RUN_ID, producer: PRODUCER_ID, status: "failed", error_code: "apify_http_401", items_seen: 0 },
    });
  });

  it("a batch payload carries its count, its events and the run", () => {
    const { events } = buildWebhookEvents(mapApifyProfiles(fixture as unknown[]), { now: NOW, days: 14 });
    const parsed = JSON.parse(webhookPayload(events, { id: RUN_ID, status: "ok", items_seen: 3 }));
    expect(WebhookPayload.safeParse(parsed).success).toBe(true);
    expect(parsed.event_count).toBe(events.length);
    expect(parsed.run.producer).toBe(PRODUCER_ID);
  });
});
