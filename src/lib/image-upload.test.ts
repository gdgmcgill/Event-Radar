import { downloadAndUploadImage } from "./image-upload";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock Supabase client
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
 
const mockSupabase = { storage: { from: mockFrom } } as any;

describe("downloadAndUploadImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
