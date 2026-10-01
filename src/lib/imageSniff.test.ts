/** M3 P1-07: content sniffing for the four web image types. */
import { sniffImageType } from "./imageSniff";

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];
const JPEG = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1];
const GIF87 = [71, 73, 70, 56, 55, 97, 1, 0, 1, 0, 0, 0];
const GIF89 = [71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0];
const WEBP = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80];

describe("sniffImageType", () => {
  it.each([
    ["png", PNG],
    ["jpeg", JPEG],
    ["gif", GIF87],
    ["gif", GIF89],
    ["webp", WEBP],
  ])("recognizes %s", (type, header) => {
    expect(sniffImageType(bytes(...header, 1, 2, 3))).toBe(type);
  });

  it.each([
    ["HTML", Array.from(new TextEncoder().encode("<!doctype html><html>"))],
    ["an executable header", Array.from(new TextEncoder().encode("MZ executable"))],
    ["a RIFF that is not WEBP", [82, 73, 70, 70, 36, 0, 0, 0, 65, 86, 73, 32]],
    ["a truncated PNG", PNG.slice(0, 4)],
    ["a truncated WEBP", WEBP.slice(0, 10)],
    ["nothing", []],
  ])("refuses %s", (_label, header) => {
    expect(sniffImageType(bytes(...header))).toBeNull();
  });
});
