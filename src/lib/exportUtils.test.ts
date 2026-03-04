import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportEventsCsv } from "./exportUtils";

const mockFetch = vi.fn();
const mockBlob = new Blob(["event_id,title\n1,Test"]);
const createObjectURLSpy = vi.fn(() => "blob:mock-url");
const revokeObjectURLSpy = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("exportEventsCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window.URL, "createObjectURL", {
      value: createObjectURLSpy,
      writable: true,
    });

    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: revokeObjectURLSpy,
      writable: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    });
  });

  it("uses eventIds query parameter for bulk CSV export", async () => {
    await exportEventsCsv([
      "1f4f1a1a-1111-4f4f-9a9a-111111111111",
      "2f4f1a1a-2222-4f4f-9a9a-222222222222",
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/events/export?format=csv&eventIds=1f4f1a1a-1111-4f4f-9a9a-111111111111%2C2f4f1a1a-2222-4f4f-9a9a-222222222222",
    );
  });

  it("de-duplicates event IDs before export", async () => {
    await exportEventsCsv([
      "1f4f1a1a-1111-4f4f-9a9a-111111111111",
      "1f4f1a1a-1111-4f4f-9a9a-111111111111",
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/events/export?format=csv&eventIds=1f4f1a1a-1111-4f4f-9a9a-111111111111",
    );
  });

  it("throws when no event IDs are provided", async () => {
    await expect(exportEventsCsv([])).rejects.toThrow(
      "No event IDs provided for CSV export",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
