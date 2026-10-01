/** Signature-valid bytes for file-boundary tests, not a decodable image fixture. */
export function imageBytes(size: number, mime: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  const prefixes: Record<string, number[]> = {
    "image/png": [137,80,78,71,13,10,26,10], "image/jpeg": [255,216,255],
    "image/gif": [71,73,70,56,57,97], "image/webp": [82,73,70,70,0,0,0,0,87,69,66,80],
  };
  bytes.set((prefixes[mime] ?? []).slice(0,size));
  return bytes;
}
