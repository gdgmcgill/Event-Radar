/** M3 P1-07: persisting ingested Instagram images into event-images/ingest/*.
 * The safe fetch is mocked; its own suite pins the SSRF rules. */
import { createFakeSupabase, type FakeSupabase } from "../../../__tests__/helpers/fakeSupabase";
import { ImageFetchError } from "../safeImageFetch";

let mockFake: FakeSupabase;
const uploads: Array<{ bucket: string; path: string; size: number; options: unknown }> = [];
let uploadError: { message: string } | null = null;
const mockClient = () => ({
  from: (table: string) => mockFake.client.from(table),
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, body: Uint8Array, options: unknown) => {
        uploads.push({ bucket, path, size: body.byteLength, options });
        return uploadError ? { data: null, error: uploadError } : { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
    }),
  },
});
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockClient() }));

const mockFetchIngestImage = jest.fn();
jest.mock("../safeImageFetch", () => {
  const actual = jest.requireActual("../safeImageFetch");
  return { ...actual, fetchIngestImage: (...args: unknown[]) => mockFetchIngestImage(...args) };
});

import { persistEventImages } from "../persistImages";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const IG = (name: string) => `https://scontent.cdninstagram.com/v/${name}.jpg`;
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, source: "instagram", status: "pending", deleted_at: null, image_url: IG(id), created_at: `2026-09-2${id.length}T00:00:00Z`, ...overrides,
});

beforeEach(() => {
  uploads.length = 0;
  uploadError = null;
  mockFetchIngestImage.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function world(events: Record<string, unknown>[]) {
  mockFake = createFakeSupabase({ tables: { events } });
}

const imageOf = (id: string) => mockFake.tables.events.find((event) => event.id === id)?.image_url;

describe("persistEventImages", () => {
  it("uploads each sniffed image to event-images/ingest/<id>.<ext> and points image_url at it", async () => {
    world([row("a")]);
    mockFetchIngestImage.mockResolvedValue({ bytes: PNG, type: "png" });
    const result = await persistEventImages(10);
    expect(result).toEqual({ processed: 1, persisted: 1, cleared: 0, failed: [] });
    expect(uploads).toEqual([{ bucket: "event-images", path: "ingest/a.png", size: PNG.byteLength, options: { contentType: "image/png", upsert: true } }]);
    expect(imageOf("a")).toBe("https://project.supabase.co/storage/v1/object/public/event-images/ingest/a.png");
    expect(mockFetchIngestImage).toHaveBeenCalledWith(IG("a"));
  });

  it("a jpeg is stored as .jpg", async () => {
    world([row("a")]);
    mockFetchIngestImage.mockResolvedValue({ bytes: PNG, type: "jpeg" });
    await persistEventImages(10);
    expect(uploads[0]).toMatchObject({ path: "ingest/a.jpg", options: { contentType: "image/jpeg", upsert: true } });
  });

  it.each(["http_403", "http_404", "http_410"] as const)("an expired image (%s) clears image_url so the placeholder renders", async (code) => {
    world([row("a")]);
    mockFetchIngestImage.mockRejectedValue(new ImageFetchError(code));
    const result = await persistEventImages(10);
    expect(result).toEqual({ processed: 1, persisted: 0, cleared: 1, failed: [] });
    expect(imageOf("a")).toBeNull();
    expect(uploads).toHaveLength(0);
  });

  it.each(["private_address", "disallowed_url", "not_image", "too_large", "timeout", "http_500"] as const)(
    "any other failure (%s) leaves the row unchanged and is reported",
    async (code) => {
      world([row("a")]);
      mockFetchIngestImage.mockRejectedValue(new ImageFetchError(code));
      const result = await persistEventImages(10);
      expect(result).toEqual({ processed: 1, persisted: 0, cleared: 0, failed: [{ event_id: "a", code }] });
      expect(imageOf("a")).toBe(IG("a"));
    }
  );

  it("an unexpected error is fetch_failed; an upload error is upload_failed; neither changes the row", async () => {
    world([row("a"), row("bb")]);
    mockFetchIngestImage.mockImplementation(async (url: string) => {
      if (url === IG("bb")) throw new Error("ENOTFOUND private detail");
      return { bytes: PNG, type: "png" };
    });
    uploadError = { message: "bucket missing" };
    const result = await persistEventImages(10);
    expect(result.failed).toEqual(expect.arrayContaining([{ event_id: "a", code: "upload_failed" }, { event_id: "bb", code: "fetch_failed" }]));
    expect(imageOf("a")).toBe(IG("a"));
    expect(imageOf("bb")).toBe(IG("bb"));
  });

  it("selects only non-deleted instagram events in pending or approved, newest first, bounded by the limit", async () => {
    world([
      row("a"),
      row("deleted", { deleted_at: "2026-09-01T00:00:00Z" }),
      row("manual", { source: "manual" }),
      row("rejected", { status: "rejected" }),
      row("approved", { status: "approved" }),
      row("stored", { image_url: "https://project.supabase.co/storage/v1/object/public/event-images/ingest/stored.png" }),
      row("evil", { image_url: "https://cdninstagram.com.evil.test/a.jpg" }),
      row("noimage", { image_url: null }),
    ]);
    mockFetchIngestImage.mockResolvedValue({ bytes: PNG, type: "png" });
    const result = await persistEventImages(10);
    expect(mockFetchIngestImage.mock.calls.map(([url]) => url).sort()).toEqual([IG("a"), IG("approved")].sort());
    expect(result.processed).toBe(2);
    const select = mockFake.calls.find((call) => call.table === "events" && call.operation === "select");
    expect(select?.filters).toEqual(expect.arrayContaining([
      { op: "eq", column: "source", value: "instagram" },
      { op: "is", column: "deleted_at", value: null },
      { op: "in", column: "status", value: ["pending", "approved"] },
    ]));
    expect(select?.order).toEqual([expect.objectContaining({ column: "created_at", ascending: false })]);
    expect(select?.limit).toBe(10);
  });

  it("the image_url update is conditional on the URL it fetched (no lost update)", async () => {
    world([row("a")]);
    mockFetchIngestImage.mockImplementation(async () => {
      mockFake.tables.events[0].image_url = "https://scontent.cdninstagram.com/v/edited.jpg";
      return { bytes: PNG, type: "png" };
    });
    const result = await persistEventImages(10);
    expect(imageOf("a")).toBe("https://scontent.cdninstagram.com/v/edited.jpg");
    expect(result.persisted).toBe(0);
    expect(result.failed).toEqual([{ event_id: "a", code: "changed" }]);
  });
});
