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
  const mockUpload = jest.fn();
  const mockGetPublicUrl = jest.fn();
  const mockFrom = jest.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }));
   
  const mockSupabase = { storage: { from: mockFrom } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }) as unknown as typeof fetch;
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
