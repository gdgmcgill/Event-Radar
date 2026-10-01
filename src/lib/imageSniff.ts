/**
 * Content sniffing for the four web image types the app stores (M3 P1-07).
 *
 * Shared by the upload boundary (`checkFileContent` in src/server/body.ts)
 * and ingested-image persistence. It reads magic bytes only: it rejects HTML,
 * executables and renamed files; it is not an image decoder.
 */
export type SniffedImageType = "jpeg" | "png" | "webp" | "gif";

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((value, index) => bytes[offset + index] === value);
}

const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG = [255, 216, 255];
const GIF87A = [71, 73, 70, 56, 55, 97];
const GIF89A = [71, 73, 70, 56, 57, 97];
const RIFF = [82, 73, 70, 70];
const WEBP = [87, 69, 66, 80];

/** The image type the leading bytes declare, or null when they declare none. */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A)) return "gif";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "webp";
  return null;
}
